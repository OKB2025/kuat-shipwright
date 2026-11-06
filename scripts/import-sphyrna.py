#!/usr/bin/env python3
"""Import the supplied Sphyrna hull as one selectable reference structure.

Run with Blender; source detail is retained at the uniform 116.7 m ship scale.
The two native bow twin lasers and the rear twin turret are detached by welded
component and registered independently as weapons. A separate watertight voxel
union supplies hull occupancy, so overlapping STL islands do not cancel inside
one another. No engine, plant, cooling, or weapon performance comes from a mesh.

blender --background --threads 4 --python scripts/import-sphyrna.py -- \
  --asset-output /tmp/sphyrna-hull-asset.json \
  --manifest-output assets/source/sphyrna-hull-manifest.json
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import struct
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE_NAME = '6-HammerheadClassCorvette-2.STL'
LENGTH_M = 116.7
STL_TRIANGLE = np.dtype([('n','<f4',(3,)),('v','<f4',(3,3)),('a','<u2')])
DETACH = [
    {'name':'rear-twin-turbolaser','faces':294,'lo':[-1.671,24.545,17.323],'hi':[1.671,33.679,18.558]},
    {'name':'bow-port-twin-laser','faces':238,'lo':[-6.482,-38.221,3.572],'hi':[-5.644,-30.100,6.086]},
    {'name':'bow-starboard-twin-laser','faces':236,'lo':[5.644,-38.221,3.572],'hi':[6.482,-30.100,6.086]},
]


def read_stl(path):
    raw=path.read_bytes()
    count=struct.unpack_from('<I',raw,80)[0]
    if len(raw)!=84+count*50:
        raise ValueError('Expected a complete binary STL triangle table')
    table=np.frombuffer(raw,dtype=STL_TRIANGLE,offset=84,count=count)
    vertices,faces=np.unique(np.round(table['v'].reshape(-1,3).astype('f8'),6),axis=0,return_inverse=True)
    return raw,vertices,faces.reshape(-1,3)


def component_labels(vertices,faces):
    parent=list(range(len(vertices)))
    def root(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]]
            i=parent[i]
        return i
    for row in faces:
        a,b,c=map(root,row)
        parent[b]=a
        parent[c]=a
    return np.array([root(int(row[0])) for row in faces])


def packed_mesh(positions,faces,center,size):
    normals=np.cross(positions[faces[:,1]]-positions[faces[:,0]],positions[faces[:,2]]-positions[faces[:,0]])
    normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-20)
    corners=faces.reshape(-1)
    indices=np.empty(len(corners),dtype='<u2')
    points=[]
    groups={}
    cosine=np.cos(np.deg2rad(30))
    for corner,vertex in enumerate(corners):
        normal=normals[corner//3]
        smooth=groups.setdefault(int(vertex),[])
        index=next((index for representative,index in smooth if np.dot(normal,representative)>=cosine),None)
        if index is None:
            index=len(points)
            points.append(positions[vertex])
            smooth.append((normal,index))
        indices[corner]=index
    points=np.array(points)
    if len(points)>=65536:
        raise ValueError('Sphyrna should remain below the 16-bit render vertex limit')
    quantized=np.rint((points-center)/size*65532).astype('<i2')
    uv=np.tile(np.array([16384,32768],dtype='<u2'),(len(points),1))
    payload=quantized.tobytes()+uv.tobytes()+indices.tobytes()
    return points,payload


def collider(positions,faces,voxel,max_faces):
    import bpy
    import bmesh
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    mesh=bpy.data.meshes.new('Sphyrna source hull collision islands')
    mesh.from_pydata(positions.tolist(),[],faces.tolist())
    mesh.update()
    obj=bpy.data.objects.new('Sphyrna closed union occupancy',mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj
    obj.select_set(True)
    remesh=obj.modifiers.new('Closed union of the measured STL islands','REMESH')
    remesh.mode='VOXEL'
    remesh.voxel_size=voxel
    remesh.use_smooth_shade=False
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    obj.data.calc_loop_triangles()
    union_faces=len(obj.data.loop_triangles)
    decimate=obj.modifiers.new('Independent occupancy mesh budget','DECIMATE')
    decimate.ratio=min(1,max_faces/max(1,union_faces))
    decimate.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    obj.data.calc_loop_triangles()
    points=np.array([v.co[:] for v in obj.data.vertices])
    triangles=np.array([t.vertices[:] for t in obj.data.loop_triangles])
    bm=bmesh.new()
    bm.from_mesh(obj.data)
    nonmanifold=sum(not edge.is_manifold for edge in bm.edges)
    bm.free()
    if nonmanifold:
        raise ValueError('Collision union is not closed: '+str(nonmanifold))
    return points,triangles,union_faces


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=ROOT/'assets/source/sphyrna-hull.stl')
    parser.add_argument('--asset-output',type=Path,required=True)
    parser.add_argument('--manifest-output',type=Path,required=True)
    parser.add_argument('--voxel-size',type=float,default=.2)
    parser.add_argument('--collision-faces',type=int,default=8000)
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else None)
    raw,vertices,faces=read_stl(args.source)
    source_corners=np.frombuffer(raw,dtype=STL_TRIANGLE,offset=84,count=len(faces))['v'].reshape(-1,3).astype('f8')
    lo,hi=source_corners.min(0),source_corners.max(0)
    scale=LENGTH_M/(hi[1]-lo[1])
    positions=np.column_stack(((hi[1]-vertices[:,1])*scale,(vertices[:,2]-lo[2])*scale,-vertices[:,0]*scale))
    labels=component_labels(vertices,faces)
    groups=[]
    removed=np.zeros(len(faces),dtype=bool)
    detach=[]
    for label in np.unique(labels):
        mask=labels==label
        points=vertices[faces[mask]].reshape(-1,3)
        groups.append({'label':int(label),'faces':int(mask.sum()),'lo':points.min(0).tolist(),'hi':points.max(0).tolist()})
    for selection in DETACH:
        chosen=[g['label'] for g in groups if np.all(np.array(g['lo'])>=selection['lo']) and np.all(np.array(g['hi'])<=selection['hi'])]
        mask=np.isin(labels,chosen)
        if int(mask.sum())!=selection['faces']:
            raise ValueError('Unexpected detached weapon triangle count: '+selection['name']+' '+str(mask.sum()))
        if np.any(mask&removed):
            raise ValueError('Detached weapon selections overlap')
        removed|=mask
        points=positions[faces[mask]].reshape(-1,3)
        detach.append({**selection,'source_components':len(chosen),'game_bounds_m':[points.min(0).tolist(),points.max(0).tolist()]})
    keep=faces[~removed]
    game_lo=np.array([0,0,-hi[0]*scale])
    game_hi=np.array([LENGTH_M,(hi[2]-lo[2])*scale,-lo[0]*scale])
    center=(game_lo+game_hi)/2
    size=game_hi-game_lo
    points,payload=packed_mesh(positions,keep,center,size)
    collision_points,collision_faces,union_faces=collider(positions,keep,args.voxel_size,args.collision_faces)
    # Voxel surfaces can exceed a source extremum by a fraction of one cell.
    # Occupancy keeps the supplied ship's exact overall dimensions.
    collision_points=np.clip(collision_points,game_lo,game_hi)
    triangle_points=collision_points[collision_faces]
    if np.any(np.linalg.norm(np.cross(triangle_points[:,1]-triangle_points[:,0],triangle_points[:,2]-triangle_points[:,0]),axis=1)<1e-10):
        raise ValueError('Bounding the occupancy shell created a degenerate face')
    collision=np.round((collision_points[collision_faces.reshape(-1)]-center)/size,7).reshape(-1).tolist()
    asset={'title':'スフィルナ級コルベット — 提供STLの船体','kind':'structure','plainMetal':True,'source':SOURCE_NAME+' (user supplied; author and license not supplied)','sourceSha256':hashlib.sha256(raw).hexdigest(),'n':len(points),'faces':len(keep),'indexBytes':2,'c':center.tolist(),'size':size.tolist(),'data':base64.b64encode(payload).decode('ascii'),'collider':collision}
    manifest={'source_filename':SOURCE_NAME,'stored_source':'assets/source/sphyrna-hull.stl','source_sha256':hashlib.sha256(raw).hexdigest(),'source_header':raw[:80].rstrip(b'\0').decode('ascii','replace'),'author':None,'license':None,'length_m':LENGTH_M,'uniform_scale':scale,'axis_mapping':['(source_y_max - source_y) * scale','(source_z - source_z_min) * scale','-source_x * scale'],'source_bounds':[lo.tolist(),hi.tolist()],'source_triangles':len(faces),'source_unique_vertices':len(np.unique(source_corners,axis=0)),'welded_source_vertices':len(vertices),'welding_tolerance_m':scale*1e-6,'source_components':len(groups),'detached_weapons':detach,'asset_key':'sphyrna_hull','asset_center_m':center.tolist(),'asset_size_m':size.tolist(),'render_vertices':len(points),'render_triangles':len(keep),'render_smoothing_angle_degrees':30,'packed_sha256':hashlib.sha256(payload).hexdigest(),'collision_voxel_size_m':args.voxel_size,'collision_union_triangles':union_faces,'collision_triangles':len(collision_faces),'collision_nonmanifold_edges':0,'collision_bounds_clamped_to_source':True,'notes':['Original source triangle detail retained; only separately mounted native weapon groups are detached.','Collision mesh is a separate closed union of the hull source components.','The mesh supplies hull geometry only; finite plant, cooling, machinery, feeds and nozzles remain independent installed equipment.','The supplied file contains no author or license metadata.']}
    for path,value in [(args.asset_output,asset),(args.manifest_output,manifest)]:
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_text(json.dumps(value,ensure_ascii=False,indent=2 if path==args.manifest_output else None,separators=None if path==args.manifest_output else (',',':'))+'\n')
    print(json.dumps({k:v for k,v in manifest.items() if k not in ['detached_weapons']},ensure_ascii=False,indent=2))

if __name__=='__main__':
    main()
