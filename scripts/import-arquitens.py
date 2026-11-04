#!/usr/bin/env python3
"""Import the user-supplied Arquitens STL as an editable reference structure.

Run with Blender (NumPy is bundled with Blender):
    blender --background --threads 4 --python scripts/import-arquitens.py -- \
      assets/source/arquitens.stl /tmp/arquitens-asset.json \
      --metadata-output assets/source/arquitens-manifest.json

The four complete main turrets are detached by connected component, leaving
pedestals below the mounting planes. The original hull/cowling detail remains
undecimated in the render mesh. A separate watertight, unioned collision mesh
uses 0.55 m voxels and topology-preserving collapse to approximately 15k faces;
its narrow bow slot remains open. Only source funnel faces wholly inside the
measured 9.25 m nozzle bores, within 14 m of the stern, are removed from the
render mesh so independent ISD-style nozzles can occupy those bores. Outer lips
and cowlings remain; the closed collision volume precedes this surface cut.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import struct
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


GUN_GROUPS = [
    ('dorsal-starboard', -28.4337, -10.7522, -0.880806, 1),
    ('dorsal-port', 28.4337, -10.7522, -0.880806, 1),
    ('ventral-starboard', -24.0026, -75.5963, -13.926204, -1),
    ('ventral-port', 24.0026, -75.5963, -13.926204, -1),
]


def components(vertices, faces):
    parent = list(range(len(vertices)))
    def root(n):
        while parent[n] != n:
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n
    for a,b,c in faces:
        a,b,c = root(a),root(b),root(c)
        parent[b] = a
        parent[c] = a
    labels = np.array([root(i) for i in range(len(vertices))])
    return labels[faces[:,0]]


def pack(positions, triangles, center, size):
    # STL has no authored smooth groups. Preserve corners sharper than 30 deg,
    # while welding the dense triangular tessellation on each smooth surface.
    normals = np.cross(positions[triangles[:,1]]-positions[triangles[:,0]],
                       positions[triangles[:,2]]-positions[triangles[:,0]])
    normals /= np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-20)
    vertex_ids = triangles.reshape(-1)
    order = np.argsort(vertex_ids,kind='stable')
    indices = np.empty(len(vertex_ids),dtype=np.uint32)
    points=[]
    active=-1
    groups=[]
    cosine=np.cos(np.deg2rad(30))
    for corner in order:
        vertex=int(vertex_ids[corner])
        if vertex!=active:
            groups=[]
            active=vertex
        normal=normals[corner//3]
        found=None
        for representative,index in groups:
            if normal[0]*representative[0]+normal[1]*representative[1]+normal[2]*representative[2]>=cosine:
                found=index
                break
        if found is None:
            found=len(points)
            points.append(positions[vertex])
            groups.append((normal,found))
        indices[corner]=found
    points=np.array(points)
    q = np.rint((points-center)/size*65532).astype('<i2')
    uv = np.tile(np.array([16384,32768],dtype='<u2'),(len(points),1))
    index_bytes = 2 if len(points)<65536 else 4
    indices=indices.astype('<u2' if index_bytes==2 else '<u4')
    payload = q.tobytes()+uv.tobytes()+indices.tobytes()
    return points,payload,index_bytes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--metadata-output',type=Path)
    parser.add_argument('--length',type=float,default=325)
    parser.add_argument('--voxel-size',type=float,default=.55)
    parser.add_argument('--collision-faces',type=int,default=15000)
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if args.length !=325:
        parser.error('The measured gun component windows are authored for --length 325')
    raw = args.source.read_bytes()
    count = struct.unpack_from('<I',raw,80)[0]
    if len(raw)!=84+count*50:
        raise ValueError('Expected binary STL with a complete triangle table')
    table = np.frombuffer(raw,dtype=np.dtype([('normal','<f4',(3,)),('vertices','<f4',(3,3)),('attribute','<u2')]),offset=84,count=count)
    corners = table['vertices'].astype('f8').reshape(-1,3)
    low,high=corners.min(0),corners.max(0)
    scale=args.length/(high[1]-low[1])
    centered=(corners-(low+high)/2)*scale
    unique,faces=np.unique(np.round(centered,5),axis=0,return_inverse=True)
    faces=faces.reshape(-1,3)
    labels=components(unique,faces)
    whole_points=unique[faces]
    groups=[]
    remove=np.zeros(len(faces),dtype=bool)
    for name,cx,cy,floor,up in GUN_GROUPS:
        lo=np.array([cx-7.09,cy-10.95,floor-.025 if up>0 else floor-5.84])
        hi=np.array([cx+7.09,cy+6.96,floor+5.84 if up>0 else floor+.025])
        selected=[]
        for label in np.unique(labels):
            q=whole_points[labels==label]
            if np.all(q.reshape(-1,3).min(0)>=lo) and np.all(q.reshape(-1,3).max(0)<=hi):
                selected.append(int(label))
        mask=np.isin(labels,selected)
        if int(mask.sum())<3500:
            raise ValueError('Incomplete main gun group '+name)
        remove|=mask
        pts=whole_points[mask].reshape(-1,3)
        # Proper rotation: source -Y => bow +X; source +Z => up +Y.
        # Game Z is the negative source X; game starboard is positive Z.
        mount=[162.5-cy,float(floor+(high[2]-low[2])*scale/2),-cx]
        groups.append({'name':name,'source_centered_bounds_m':[pts.min(0).tolist(),pts.max(0).tolist()],
                       'component_count':len(selected),'triangle_count':int(mask.sum()),
                       'mount_m':mount,'normal':[0,up,0],'forward':[1,0,0]})
    if int(remove.sum())!=sum(g['triangle_count'] for g in groups):
        raise ValueError('Main gun groups overlap')
    keep=faces[~remove]
    positions=np.column_stack((-unique[:,1]+162.5,unique[:,2]+(high[2]-low[2])*scale/2,-unique[:,0]))
    all_game=np.column_stack((-centered[:,1]+162.5,centered[:,2]+(high[2]-low[2])*scale/2,-centered[:,0]))
    game_low,game_high=all_game.min(0),all_game.max(0)
    center=(game_low+game_high)/2
    size=game_high-game_low
    # Leave the opaque union collider unchanged by this render-only bore cut.
    bore_remove=np.zeros(len(keep),dtype=bool)
    bore_groups=[]
    for name,cy,cz in [('starboard',21.776239971157235,55.432003159736624),
                       ('center',21.776226875101578,.5579580243619194),
                       ('port',21.776223341440225,-55.43189382220738)]:
        pts=positions[keep]
        radial=np.hypot(pts[:,:,1]-cy,pts[:,:,2]-cz)
        mask=np.all(radial<9.25,axis=1)&np.all(pts[:,:,0]<14,axis=1)
        bore_remove|=mask
        bore_groups.append({'name':name,'mouth_m':[0,cy,cz],
                            'bore_radius_m':9.25,'depth_m':14,
                            'removed_triangles':int(mask.sum())})
    render_faces=keep[~bore_remove]
    points,payload,index_bytes=pack(positions,render_faces,center,size)

    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    mesh=bpy.data.meshes.new('Arquitens collision source')
    mesh.from_pydata(positions.tolist(),[],keep.tolist())
    mesh.update()
    ob=bpy.data.objects.new('Arquitens unioned collision shell',mesh)
    bpy.context.collection.objects.link(ob)
    bpy.context.view_layer.objects.active=ob
    ob.select_set(True)
    remesh=ob.modifiers.new('Union detail islands into a closed shell','REMESH')
    remesh.mode='VOXEL'
    remesh.voxel_size=args.voxel_size
    remesh.use_smooth_shade=False
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    mesh=ob.data
    mesh.calc_loop_triangles()
    union_faces=len(mesh.loop_triangles)
    decimate=ob.modifiers.new('Separate topology-preserving collision simplification','DECIMATE')
    decimate.ratio=min(1,args.collision_faces/max(1,union_faces))
    decimate.use_collapse_triangulate=True
    bpy.ops.object.modifier_apply(modifier=decimate.name)
    mesh=ob.data
    mesh.calc_loop_triangles()
    collision_points=np.array([v.co[:] for v in mesh.vertices])
    collision_indices=np.array([t.vertices[:] for t in mesh.loop_triangles])
    collider=np.round((collision_points[collision_indices.reshape(-1)]-center)/size,7).reshape(-1).tolist()
    bm=bmesh.new();bm.from_mesh(mesh)
    boundary_edges=sum(not edge.is_manifold for edge in bm.edges);bm.free()
    if boundary_edges:
        raise ValueError('Collision shell must be closed/manifold: '+str(boundary_edges))
    bvh=BVHTree.FromPolygons([Vector(p) for p in collision_points],collision_indices.tolist(),all_triangles=True)
    def inside(point):
        direction=Vector((.937426,.202719,.283022));origin=Vector(point);hits=0
        for _ in range(64):
            loc,norm,index,dist=bvh.ray_cast(origin,direction,1500)
            if loc is None:break
            hits+=1;origin=loc+direction*.001
        return bool(hits%2)
    probes={name:{'point':p,'inside':inside(p)} for name,p in [
        ('bow_slot',[300,22,0]),('amidships',[170,20,0]),
        ('stern_center',[25,21.8,0]),('stern_starboard',[25,21.8,55.9]),
        ('stern_port',[25,21.8,-55.9]),('outside',[180,50,60])
    ]}
    if probes['bow_slot']['inside'] or probes['outside']['inside']:
        raise ValueError('Collision shell filled a known empty region')
    asset={'title':'Arquitens — user-supplied arquitens.stl, main turrets detached',
           'kind':'structure','plainMetal':True,'source':'arquitens.stl (user supplied)',
           'n':len(points),'faces':len(render_faces),'indexBytes':index_bytes,
           'c':center.tolist(),'size':size.tolist(),
           'data':base64.b64encode(payload).decode('ascii'),'collider':collider}
    metadata={'source':'arquitens.stl','source_sha256':hashlib.sha256(raw).hexdigest(),
              'source_header':raw[:80].rstrip(b'\0').decode('ascii','replace'),
              'source_triangles':count,'source_unique_vertices':len(unique),
              'source_bounds':[low.tolist(),high.tolist()],'uniform_scale':scale,
              'axis_mapping':['source_y_max - source_y','source_z - source_z_min','source_x_center - source_x'],
              'asset_key':'arq_hull','asset_center_m':center.tolist(),'asset_size_m':size.tolist(),
              'render_vertices':len(points),'render_triangles':len(render_faces),
              'render_smoothing_angle_degrees':30,
              'packed_sha256':hashlib.sha256(payload).hexdigest(),
              'removed_gun_triangles':int(remove.sum()),'gun_mounts':groups,
              'removed_bell_triangles':int(bore_remove.sum()),'engine_bores':bore_groups,
              'collision_voxel_size_m':args.voxel_size,'collision_union_triangles':union_faces,
              'collision_triangles':len(collision_indices),'collision_nonmanifold_edges':boundary_edges,
              'collision_probes':probes,'blender_version':bpy.app.version_string,
              'notes':['Original STL has no supplied author/license metadata.',
                       'Source engine cowling/outer lips remain; measured interior funnels are removed only from the render mesh.',
                       'Game starboard is positive Z; port is negative Z.']}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(asset,ensure_ascii=False,separators=(',',':'))+'\n')
    if args.metadata_output:
        args.metadata_output.parent.mkdir(parents=True,exist_ok=True)
        args.metadata_output.write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(metadata,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
