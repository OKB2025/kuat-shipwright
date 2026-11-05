#!/usr/bin/env python3
"""Build four native-size capital ball turrets from the user's shared-scale photo.

The common closed spherical housing is shared by every variant. Its lower third
embeds in the mounting surface, and the complete housing and guns elevate about
the sphere center. Available charging cells exclude the common internal gun
and receiver corridor. Photograph display plinths are not equipment.
Only the Python standard library is used; existing family helpers are read-only.
"""
import argparse
import base64
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('capital_ball_family_helpers', ROOT/'scripts/build-turret-family.py')
F = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(F)
MEASUREMENTS = ROOT/'assets/source/capital-turret-photo-measurements.json'
DEFAULT_DIAMETER_M = 36.0
ORDER = ['capital_ball175_triple_ion', 'capital_ball175_quad',
         'capital_ball175_quad_ion', 'capital_ball720_single']
LIMITS = {'yaw': None, 'lo': -10*math.pi/180, 'hi': 85*math.pi/180}


def role(row, name):
    row['componentRole'] = name
    return row


def clipped_closed_cell(cell, axis, limit, below):
    """Clip a convex triangle cell without approximating its curved boundary.

    Each original face is clipped independently and the cut is closed with an
    outward-facing planar fan. Keeping every boundary intersection also keeps
    the new cap watertight against triangles split along a sphere's diagonals.
    These are invisible available-room cells, never extra rendered armor.
    """
    vertices,faces=cell
    values=[p[axis]-limit for p in vertices]
    if (max(values)<=1e-10 if below else min(values)>=-1e-10):return cell
    if (min(values)>=-1e-10 if below else max(values)<=1e-10):return None
    out_vertices=[];out_faces=[];seen={};cut={}
    def point_id(p):
        q=tuple(round(x,9)for x in p)
        if q not in seen:seen[q]=len(out_vertices);out_vertices.append(list(q))
        return seen[q]
    def add_polygon(poly):
        ids=[point_id(p)for p in poly]
        ids=[i for j,i in enumerate(ids)if j==0 or i!=ids[j-1]]
        if len(ids)>1 and ids[-1]==ids[0]:ids.pop()
        for j in range(1,len(ids)-1):
            tri=[ids[0],ids[j],ids[j+1]]
            A,B,C=[out_vertices[i]for i in tri]
            normal=F.cross(F.sub(B,A),F.sub(C,A))
            if F.dot(normal,normal)>1e-20:out_faces.append(tri)
    for face in faces:
        poly=[vertices[i]for i in face];clipped=[]
        for A,B in zip(poly,poly[1:]+poly[:1]):
            da,db=A[axis]-limit,B[axis]-limit
            inside_a=da<=1e-10 if below else da>=-1e-10
            inside_b=db<=1e-10 if below else db>=-1e-10
            if inside_a:clipped.append(A)
            if abs(da)<=1e-10:cut[tuple(round(x,9)for x in A)]=A
            if inside_a!=inside_b:
                t=da/(da-db);P=[A[k]+t*(B[k]-A[k])for k in range(3)];P[axis]=limit
                clipped.append(P);cut[tuple(round(x,9)for x in P)]=P
        if len(clipped)>=3:add_polygon(clipped)
    cap=list(cut.values());center=[sum(p[k]for p in cap)/len(cap)for k in range(3)]
    a,b=(axis+1)%3,(axis+2)%3
    cap.sort(key=lambda p:math.atan2(p[b]-center[b],p[a]-center[a]),reverse=not below)
    for A,B in zip(cap,cap[1:]+cap[:1]):add_polygon([center,A,B])
    return out_vertices,out_faces


def available_spherical_room(m, sphere, radius):
    """Reserve the largest internal gun/receiver corridor for every variant.

    The full sphere remains the visible closed armor. Only disjoint, closed
    pieces outside the shared machinery reserve count as charging room.
    The reserve extends beyond the sphere's front, so five separating cuts
    cover the exact sphere-minus-box without a tiny artificial forward cell.
    """
    source=m.compartments.pop();gross=source['volumeM3'];s=radius/18
    low=[v*s for v in [-13.025,-2.25,-8.25]]
    high=[v*s for v in [18.15,14.25,8.25]]
    source_range={k:sphere[k]for k in ['firstVertex','vertices','firstIndex','indices']}
    remaining=(source['verticesM'],source['faces'])
    for axis,bound,below in [(0,low[0],True),(1,low[1],True),(1,high[1],False),
                             (2,low[2],True),(2,high[2],False)]:
        outside=clipped_closed_cell(remaining,axis,bound,below)
        remaining=clipped_closed_cell(remaining,axis,bound,not below)
        if outside is None:continue
        V,T=outside
        m.compartments.append({'label':'common available spherical charging room '+str(len(m.compartments)+1),
            'verticesM':V,'faces':T,'volumeM3':F.triangle_volume(V,T),
            'movesWithGun':True,'conservative':True,
            'sourceSphereMeshRange':source_range.copy(),
            'sourceClosure':'actual closed sphere clipped outside common internal machinery reserve',
            'reservedMachinerySeparation':{'axis':axis,'boundM':bound,'side':'below'if below else'above'}})
    usable=sum(c['volumeM3']for c in m.compartments)
    if abs(usable+F.triangle_volume(*remaining)-gross)>1e-5:
        raise ValueError('Available room cuts fail gross sphere volume conservation')
    return gross,{'lowM':low,'highM':high}


def tube(m, root, tip_x, radius, label, radial_segments=20, ion=False):
    """Use the same per-caliber physical profiles as the angular family."""
    x0,y,z=root
    if ion:
        row=F.Mesh.ion_barrel(m,x0,tip_x,y,z,radius,label,segments=radial_segments,
                             taper_start_x=tip_x-8.5)
    else:
        row=F.Mesh.barrel(m,x0,tip_x,y,z,radius,label,bore_ratio=.66,segments=radial_segments)
        row.update(shaftRadiusM=radius,commonProfile='capital-175-source-17-station-stepped-tube')
    row.update(radialSegments=radial_segments,fullBarrelLengthM=tip_x-x0)
    return role(row,'moving-complete-barrel')


def front_mechanism(m, center, radius, ion):
    """Compact mechanical armor; its solid display volume is not capacitor room."""
    cy=center[1]
    rows=[]
    for x,r,depth,label in [
            (radius*.79,radius*.45,radius*.17,'ball armored circular gun socket'),
            (radius*.90,radius*.39,radius*.075,'ball inset circular receiver face'),
            (radius*.95,radius*(6.9/18),radius*.025,'ball thin receiver lip')]:
        rows.append(role(m.cylinder([x,cy,0],r,depth,0,label,32),'moving-front-mechanism'))
    # Low strips sit on the front plate rather than spreading onto the ball.
    for z in [-1,1]:
        rows.append(role(m.box([radius*.87,cy-radius*.31,z*radius*.22-radius*.035],
                              [radius*.97,cy+radius*.31,z*radius*.22+radius*.035],
                              'ball front receiver reinforcement '+str(z)),
                         'moving-front-mechanism'))
    if ion:
        # An ion gun has the same envelope and energetic caliber; the squared
        # feed box and paired small conduits distinguish the actual mechanism.
        rows.append(role(m.box([radius*.71,cy+radius*.27,-radius*.20],
                              [radius*.91,cy+radius*.40,radius*.20],
                              'ion transverse pulse feed cover'),'moving-ion-feed'))
    return rows


def build_one(asset_key, kind, title, caliber, guns, ion, diameter):
    m=F.Mesh();R=diameter/2;center=[0,R/3,0];split=m.mark()
    sphere=F.spherical_house(m,center,R,'common capital spherical gunhouse')
    sphere.update(componentRole='spherical-gunhouse',normalMode='sphere',normalCenterM=center[:])
    gross_sphere_volume,reserve=available_spherical_room(m,sphere,R)
    front=front_mechanism(m,center,R,ion)
    # The corrected ISD battery scale enlarges the common physical tube profile
    # by 1.5 while keeping this ball and its exterior muzzle plane unchanged.
    caliber_scale=1.5 if caliber==175 else 2.25
    barrel_radius=.55*caliber_scale
    full_length=17.5*caliber_scale
    muzzle_x=R+8.5
    root_x=muzzle_x-full_length
    # This same ball accepts a triangular triple or a compact square four-port
    # bank. The single heavy bore sits exactly on the ball's horizontal axis.
    spacing=R*.19
    if guns==1:offsets=[(0,0)]
    elif guns==3:offsets=[(spacing,0),(-spacing*.70,-spacing),(-spacing*.70,spacing)]
    else:offsets=[(y,z)for y in [-spacing,spacing]for z in [-spacing,spacing]]
    barrels=[]
    for i,(y,z) in enumerate(offsets):
        root=[root_x,center[1]+y,z]
        row=tube(m,root,muzzle_x,barrel_radius,
                 f'{caliber}TT complete ball barrel {i+1}',20,ion)
        row.update(exposedBeyondSphereM=8.5,insideSphereAxialLengthM=full_length-8.5)
        barrels.append(row)
    asset=F.finish(m,kind,title,caliber,center,barrels,split,[],1,
        source='User-supplied capital-turret photographs; parametric reconstruction',
        nativeCalibration='capital-photo-family',materialReference='isd_heavy_octuple',
        weaponRole='ion' if ion else 'turbolaser',gunhouseElevates=True,
        sphereRadiusM=R,sphereCenterM=center[:],grossSphereVolumeM3=gross_sphere_volume,
        reservedMachineryAabbM=reserve,
        sphereMeshRange={k:sphere[k]for k in ['firstVertex','vertices','firstIndex','indices']},
        ballCaseDimensionsM=[diameter,diameter,diameter],
        commonOuterDimensionsM=[diameter+8.5,diameter,diameter],
        commonMuzzlePlaneXM=muzzle_x,exposedBeyondSphereM=8.5,
        frontReceiver={'outerLipRadiusM':R*(6.9/18),'outerLipFrontXM':R*.9625,
                       'commonAcrossVariants':True,'addsCapacitorRoom':False},
        commonCaseGroup='capital-175-720-ball',
        mountEmbedding={'diameterBelowMountFraction':1/3,'centerHeightRadiusRatio':1/3,
                        'analyticCapVolumeFraction':7/27,'analyticFractionAppliesTo':'visible gross sphere only'},
        jointLimits=LIMITS.copy(),photoMeasurements=str(MEASUREMENTS.relative_to(ROOT)),
        photoFeatureComponents={'sphere':[sphere['label']],
                               'receiver':[r['label']for r in front]},
        derivation='one common whole-ball gunhouse and intrinsic front receiver; all guns, ion feeds and spherical armor elevate together')
    asset['catalogKind']=kind
    usable=asset['turretCompartment']['volumeM3']
    asset['reservedInternalMachineryVolumeM3']=gross_sphere_volume-usable
    asset['machineryMeshRanges']=[{k:row[k]for k in ['label','firstVertex','vertices','firstIndex','indices']}
                                 for row in m.components if row['componentRole']!='spherical-gunhouse']
    asset['turretCompartment'].update(grossHousingVolumeM3=gross_sphere_volume,
        reservedInternalMachineryVolumeM3=gross_sphere_volume-usable,
        reservedMachineryAabbM=reserve,conservative=True,
        excludes=['barrels','cradles','drive gears','bearing rings','display stands',
                  'common internal gun and receiver machinery corridor'])
    return asset


def build(diameter=DEFAULT_DIAMETER_M):
    variants=[
        (ORDER[0],'ball175TripleIon','175TT 3連装イオン・ボールターレット',175,3,True),
        (ORDER[1],'ball175Quad','175TT 4連装ボールターレット',175,4,False),
        (ORDER[2],'ball175QuadIon','175TT 4連装イオン・ボールターレット',175,4,True),
        (ORDER[3],'ball720','720TT 単装ボールターレット',720,1,False)]
    return {key:build_one(key,kind,title,tt,n,ion,diameter)
            for key,kind,title,tt,n,ion in variants}


def decode(asset):
    raw=base64.b64decode(asset['data']);n=asset['n'];b=asset['indexBytes']
    points=[[struct.unpack_from('<h',raw,i*6+k*2)[0]/65532*asset['size'][k]+asset['c'][k]
             for k in range(3)]for i in range(n)]
    indices=[struct.unpack_from('<H'if b==2 else '<I',raw,n*10+i*b)[0]
             for i in range(asset['faces']*3)]
    return raw,points,indices


def validate(assets):
    results={};shared=None
    for key,a in assets.items():
        if a['faces']>5000:raise ValueError(key+': exceeds 5000 real triangles')
        raw,P,I=decode(a);n=a['n']
        if len(raw)!=n*10+len(I)*a['indexBytes']:raise ValueError(key+': false packed face count')
        if min(I)<0 or max(I)>=n:raise ValueError(key+': index out of bounds')
        if a['elevationIndexStart']!=0 or a['elevationVertexStart']!=0:raise ValueError(key+': ball has an unintended fixed shell')
        room=a['turretCompartment'];common={'sphereRadiusM':a['sphereRadiusM'],'sphereCenterM':a['sphereCenterM'],
                                        'ballCaseDimensionsM':a['ballCaseDimensionsM'],
                                        'size':a['size'],'bounds':a['bounds'],'commonOuterDimensionsM':a['commonOuterDimensionsM'],
                                        'frontReceiver':a['frontReceiver'],'grossSphereVolumeM3':a['grossSphereVolumeM3'],
                                        'reservedMachineryAabbM':a['reservedMachineryAabbM'],
                                        'convexes':room['convexes'],'volumeM3':room['volumeM3']}
        if shared is None:shared=common
        elif shared!=common:raise ValueError(key+': ball variants use different closed housings')
        # Test real decoded metal, not only a declared reserve. Every receiver
        # and barrel triangle lies strictly across the selected separating
        # plane from every available cell, including the deeply buried 720 gun.
        # A plane separating all three vertices separates the whole triangle.
        metal_indices=set();metal_triangles=0
        for mesh_range in a['machineryMeshRanges']:
            start=mesh_range['firstIndex'];end=start+mesh_range['indices']
            metal_indices.update(I[start:end]);metal_triangles+=mesh_range['indices']//3
        metal=[P[i]for i in metal_indices];min_gap=math.inf
        # Independent closed-cell convexity, edge-incidence and volume checks.
        for cell in room['convexes']:
            V,T=cell['verticesM'],cell['faces'];edges={}
            sep=cell['reservedMachinerySeparation'];axis,bound=sep['axis'],sep['boundM']
            if sep['side']=='below':
                if max(p[axis]for p in V)>bound+1e-8:raise ValueError(key+': usable cell enters reserve')
                gap=min(p[axis]for p in metal)-bound
            else:
                if min(p[axis]for p in V)<bound-1e-8:raise ValueError(key+': usable cell enters reserve')
                gap=bound-max(p[axis]for p in metal)
            if gap<.14:raise ValueError(key+': actual machinery intersects available charging cell')
            min_gap=min(min_gap,gap)
            for ia,ib,ic in T:
                N=F.cross(F.sub(V[ib],V[ia]),F.sub(V[ic],V[ia]))
                if max(F.dot(N,F.sub(p,V[ia]))for p in V)>1e-6:raise ValueError(key+': nonconvex room')
                for u,v in [(ia,ib),(ib,ic),(ic,ia)]:edges[tuple(sorted([u,v]))]=edges.get(tuple(sorted([u,v])),0)+1
            if set(edges.values())!={2}:raise ValueError(key+': open spherical compartment')
            if F.triangle_volume(V,T)<=0:raise ValueError(key+': empty room')
        if abs(sum(c['volumeM3']for c in room['convexes'])-room['volumeM3'])>1e-7:
            raise ValueError(key+': usable volume sum is false')
        if not 0<room['volumeM3']<a['grossSphereVolumeM3']:
            raise ValueError(key+': full sphere incorrectly counted as available room')
        f32=lambda v:struct.unpack('<f',struct.pack('<f',v))[0]
        gpu=[[f32(f32(struct.unpack_from('<h',raw,i*6+k*2)[0]/65532)*a['size'][k]+a['c'][k])for k in range(3)]for i in range(n)]
        normals=[[0,0,0]for _ in range(n)];used=set()
        for j in range(0,len(I),3):
            ids=I[j:j+3];A,B,C=[gpu[i]for i in ids];N=F.cross(F.sub(B,A),F.sub(C,A))
            if F.dot(N,N)<=1e-24:raise ValueError(key+': quantized degenerate face '+str(j//3))
            for i in ids:
                used.add(i);normals[i]=[f32(normals[i][k]+N[k])for k in range(3)]
        if len(used)!=n:raise ValueError(key+': orphan vertices')
        if any(F.dot(N,N)==0 for N in normals):raise ValueError(key+': zero GPU normal')
        # Every complete tube is watertight after welding, and the actual bore
        # floor is recessed rather than a dark patch on a solid muzzle cap.
        bores=[]
        receiver=next(row for row in a['components']if row['label']=='ball thin receiver lip')
        receiver_T=[I[j:j+3]for j in range(receiver['firstIndex'],receiver['firstIndex']+receiver['indices'],3)]
        receiver_front=max(P[i][0]for i in range(receiver['firstVertex'],receiver['firstVertex']+receiver['vertices']))
        for row in a['barrelCenters']:
            first,last=row['firstIndex'],row['firstIndex']+row['indices'];T=[I[j:j+3]for j in range(first,last,3)]
            weld={};mapping={}
            for i in range(row['firstVertex'],row['firstVertex']+row['vertices']):
                q=tuple(P[i]);mapping[i]=weld.setdefault(q,len(weld))
            edges={}
            for tri in T:
                tri=[mapping[i]for i in tri]
                for u,v in zip(tri,tri[1:]+tri[:1]):edges[tuple(sorted([u,v]))]=edges.get(tuple(sorted([u,v])),0)+1
            if set(edges.values())!={2}:raise ValueError(key+': barrel is not closed')
            M=row['muzzle'];origin=F.add(M,[1,0,0]);distances=[]
            for j in range(0,len(I),3):
                hit=F.ray_triangle(origin,[-1,0,0],*[P[i]for i in I[j:j+3]])
                if hit is not None:distances.append(hit)
            if not distances or abs(min(distances)-(1+row['muzzleRecessM']))>.01:
                raise ValueError(key+': actual recessed bore is obstructed')
            # Sample real barrel triangles where they cross the real decoded
            # front disk. An AABB overlap cannot substitute for gun support.
            contacts=[]
            for tri in T:
                V=[P[i]for i in tri]
                for U,VV in zip(V,V[1:]+V[:1]):
                    du,dv=U[0]-receiver_front,VV[0]-receiver_front
                    if abs(du)<1e-9:contacts.append(U)
                    if du*dv<0:
                        t=du/(du-dv);contacts.append([U[k]+t*(VV[k]-U[k])for k in range(3)])
            if len(contacts)<20:raise ValueError(key+': complete tube misses the receiver face')
            for Q in contacts:
                hits=[F.ray_triangle(F.add(Q,[1,0,0]),[-1,0,0],*[P[i]for i in tri])for tri in receiver_T]
                hits=[h for h in hits if h is not None]
                if not hits or abs(min(hits)-1)>.005:raise ValueError(key+': gun is not backed by the real receiver disk')
            bores.append({'label':row['label'],'recessM':row['muzzleRecessM'],'actualRayDistanceM':min(distances),
                          'actualReceiverDiskContactSamples':len(contacts)})
        results[key]={'triangles':a['faces'],'vertices':n,'allGeometryMoves':True,
                      'sphereDiameterM':a['sphereRadiusM']*2,'roomVolumeM3':room['volumeM3'],
                      'grossSphereVolumeM3':a['grossSphereVolumeM3'],
                      'usableClosedRoomCells':len(room['convexes']),
                      'actualMachineryTrianglesTested':metal_triangles,
                      'actualUsableCellMachineryIntersections':0,'minimumActualMachinerySeparationM':min_gap,
                      'quantizedDegenerateTriangles':0,'zeroUsedNormals':0,'bores':bores}
    return results


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--diameter',type=float,default=DEFAULT_DIAMETER_M)
    parser.add_argument('--json-output',type=Path,default=Path('/tmp/capital-ball-turret-assets.json'))
    parser.add_argument('--metadata-output',type=Path,default=ROOT/'assets/source/capital-ball-turret-manifest.json')
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    if not math.isfinite(args.diameter)or args.diameter<=0:parser.error('Diameter must be a positive finite metre value')
    assets=build(args.diameter);validation=validate(assets)
    manifest={'schemaVersion':1,'source':'User-provided capital turret photographs and later ion-profile correction',
              'photoMeasurements':str(MEASUREMENTS.relative_to(ROOT)),
              'photoMeasurementsSha256':hashlib.sha256(MEASUREMENTS.read_bytes()).hexdigest()if MEASUREMENTS.exists()else None,
              'commonSphereDiameterM':args.diameter,'order':ORDER,'validation':validation,
              'assets':{key:{k:v for k,v in a.items()if k!='data'}for key,a in assets.items()}}
    if args.check:
        registry=F.registry(ROOT/'data/reference.js')
        stale=[key for key,a in assets.items()if registry.get(key)!=a]
        if stale:raise SystemExit('Capital ball registrations are stale: '+', '.join(stale))
        if not args.metadata_output.exists()or json.loads(args.metadata_output.read_text())!=manifest:
            raise SystemExit('Capital ball manifest is stale')
    else:
        args.json_output.parent.mkdir(parents=True,exist_ok=True)
        args.metadata_output.parent.mkdir(parents=True,exist_ok=True)
        args.json_output.write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':'))+'\n')
        args.metadata_output.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(validation,ensure_ascii=False,indent=2))


if __name__=='__main__':main()
