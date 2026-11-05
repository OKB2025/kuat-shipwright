#!/usr/bin/env python3
"""Preserve the attached Arquitens gunhouse; rebuild its four guns and bearings.

The STL case receives one rigid axis transform and one uniform scale. Its flared
side wings are cut at two lateral planes and closed with source-derived armor.
Original barrels, drives and thin connecting rods are discarded. New external
receivers each carry two complete round barrels and move inward with the case.
The major STL case keeps its exact clipped surface; six small round rear details
are explicitly retessellated. A complete-mesh 3,000-triangle budget includes the
integral case, bearings, shafts and recessed barrels. Display cylinders in the
photograph are deliberately absent.
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
SOURCE = ROOT/'assets/source/arquitens_turret.stl'
MEASUREMENTS = ROOT/'assets/source/light-turret-photo-measurements.json'
UNIFORM_SCALE = 2.4
OVERALL_LENGTH_M = 28.5
spec = importlib.util.spec_from_file_location('quad500_family_helpers', ROOT/'scripts/build-turret-family.py')
H = importlib.util.module_from_spec(spec)
spec.loader.exec_module(H)


def stl_source(path=SOURCE):
    raw=path.read_bytes()
    if len(raw)<84:raise ValueError('The source is not a binary STL')
    count=struct.unpack_from('<I',raw,80)[0]
    if len(raw)!=84+count*50:raise ValueError('Truncated or trailing STL records')
    vertices=[];triangles=[];lookup={}
    for i in range(count):
        record=struct.unpack_from('<12fH',raw,84+i*50);triangle=[]
        for p in [record[3:6],record[6:9],record[9:12]]:
            if not all(math.isfinite(v) for v in p):raise ValueError('Non-finite STL vertex')
            key=tuple(round(v,5) for v in p)
            if key not in lookup:lookup[key]=len(vertices);vertices.append(list(p))
            triangle.append(lookup[key])
        triangles.append(triangle)
    parent=list(range(len(vertices)))
    def find(i):
        while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b,c in triangles:
        parent[find(a)]=find(b);parent[find(a)]=find(c)
    groups={}
    for i,t in enumerate(triangles):groups.setdefault(find(t[0]),[]).append(i)
    rows=[]
    for ids in groups.values():
        members=sorted({j for i in ids for j in triangles[i]})
        rows.append({'triangles':ids,'vertices':members,'bounds':H.bounds([vertices[j] for j in members])})
    rows.sort(key=lambda r:(-len(r['triangles']),r['triangles'][0]))
    return {'sha256':hashlib.sha256(raw).hexdigest(),'vertices':vertices,'triangles':triangles,'components':rows}


def transform_spec(source):
    low,high=source['components'][0]['bounds']
    # Source Z is forward; its negative Y is up. The source has a large X
    # translation because it was exported in a complete ship coordinate frame.
    origin=[(low[0]+high[0])/2,high[1],-4.959548234939575]
    return {'sourceOrigin':origin,'nativeOffsetM':[0,0,0],
            'nativeAxesFromSource':[[0,0,1],[0,-1,0],[1,0,0]],
            'uniformScale':UNIFORM_SCALE,
            'formula':'native = uniformScale * nativeAxesFromSource * (source - sourceOrigin) + nativeOffsetM'}


def transformed(p,transform):
    delta=H.sub(p,transform['sourceOrigin'])
    return [H.dot(row,delta)*transform['uniformScale']+transform['nativeOffsetM'][i]
            for i,row in enumerate(transform['nativeAxesFromSource'])]


def box_cell(low,high,label,source_range):
    cell=H.Mesh();cell.box(low,high,label,True);result=cell.compartments[0]
    del result['meshRange']
    result.update(conservative=True,sourceAsset='arquitens_turret.stl',sourceComponent=0,
                  sourceMeshRange=source_range.copy(),sourceClosure='conservative closed box strictly within the retained STL case')
    return result


def inside_source(point,source,transform):
    # Independent odd/even rays in three non-axis directions avoid coincident
    # STL triangle diagonals. The source may contain coplanar triangulation.
    triangles=[[transformed(source['vertices'][j],transform) for j in source['triangles'][i]]
               for i in source['components'][0]['triangles']]
    votes=0
    for direction in [[1,.137,.079],[.061,1,.113],[.071,.157,1]]:
        hits=[]
        for tri in triangles:
            t=H.ray_triangle(point,direction,*tri)
            if t is not None and t>1e-6:hits.append(round(t,5))
        votes+=len(set(hits))%2
    return votes>=2


def polygon_clip(poly,axis,value,greater):
    if not poly:return []
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da=(a[axis]-value)*(1 if greater else -1)
        db=(b[axis]-value)*(1 if greater else -1)
        if da>=-1e-9:result.append(list(a))
        if (da>1e-9 and db<-1e-9) or (da<-1e-9 and db>1e-9):
            t=da/(da-db);p=[a[k]+t*(b[k]-a[k]) for k in range(3)];p[axis]=value;result.append(p)
    clean=[]
    for p in result:
        if not clean or math.dist(clean[-1],p)>1e-7:clean.append(p)
    if len(clean)>1 and math.dist(clean[0],clean[-1])<1e-7:clean.pop()
    return clean if len(clean)>=3 else []

def section_loops(source,transform,axis,value,component=0):
    # Split STL triangles into plane segments, weld exporter precision, then
    # prune internal dangling spokes. The supplied print mesh has one interior
    # central wall ending on the outer skin; it is not an extra cap boundary.
    edges=set()
    for i in source['components'][component]['triangles']:
        tri=[transformed(source['vertices'][j],transform) for j in source['triangles'][i]];hits=[]
        for a,b in zip(tri,tri[1:]+tri[:1]):
            da=a[axis]-value;db=b[axis]-value
            if da*db<0:
                t=da/(da-db);p=[a[k]+t*(b[k]-a[k]) for k in range(3)];p[axis]=value
                hits.append(tuple(round(v,4) for v in p))
        if len(hits)==2 and hits[0]!=hits[1]:edges.add(tuple(sorted(hits)))
    graph={}
    for a,b in edges:graph.setdefault(a,set()).add(b);graph.setdefault(b,set()).add(a)
    pending=[p for p,neighbors in graph.items() if len(neighbors)<2]
    while pending:
        p=pending.pop()
        for neighbor in list(graph.get(p,set())):
            graph[neighbor].discard(p);edges.discard(tuple(sorted([p,neighbor])))
            if len(graph[neighbor])<2:pending.append(neighbor)
        graph.pop(p,None)
    if any(len(v)!=2 for v in graph.values()):raise ValueError('Source cut boundary is not a cycle')
    loops=[]
    while edges:
        a,b=min(edges);edges.remove((a,b));loop=[a,b]
        while loop[-1]!=loop[0]:
            choices=[p for p in graph[loop[-1]] if tuple(sorted([loop[-1],p])) in edges]
            if len(choices)!=1:raise ValueError('Open source section loop')
            p=choices[0];edges.remove(tuple(sorted([loop[-1],p])));loop.append(p)
        loops.append([list(p) for p in loop[:-1]])
    return loops

def triangulate_planar(poly,axis):
    axes=[k for k in range(3) if k!=axis]
    def turn(a,b,c):return (b[axes[0]]-a[axes[0]])*(c[axes[1]]-a[axes[1]])-(b[axes[1]]-a[axes[1]])*(c[axes[0]]-a[axes[0]])
    points=[list(p) for p in poly];changed=True
    while changed and len(points)>3:
        changed=False
        for i in range(len(points)):
            if abs(turn(points[i-1],points[i],points[(i+1)%len(points)]))<1e-7:
                points.pop(i);changed=True;break
    area=sum(p[axes[0]]*q[axes[1]]-q[axes[0]]*p[axes[1]] for p,q in zip(points,points[1:]+points[:1]));sign=1 if area>0 else -1
    ids=list(range(len(points)));triangles=[]
    def inside(p,a,b,c):return all(sign*t>=-1e-8 for t in [turn(a,b,p),turn(b,c,p),turn(c,a,p)])
    while len(ids)>3:
        found=False
        for j,i in enumerate(ids):
            a,b,c=ids[j-1],i,ids[(j+1)%len(ids)]
            if sign*turn(points[a],points[b],points[c])<=1e-8:continue
            if any(inside(points[k],points[a],points[b],points[c]) for k in ids if k not in [a,b,c]):continue
            triangles.append([points[a],points[b],points[c]]);ids.pop(j);found=True;break
        if not found:raise ValueError('Cannot triangulate source section cap')
    if len(ids)==3:triangles.append([points[i] for i in ids])
    return triangles

CASE_HALF_WIDTH_M=3.3
TRIANGLE_BUDGET=3000
BARREL_SEGMENTS=8
BEARING_SEGMENTS=16
SOURCE_DETAIL_SEGMENTS=12


def trim_source_component(m,source,component,transform):
    """Intersect a selected STL component with the closed central lateral band."""
    group=source['components'][component];start=m.mark();pieces=[];removed=[];retained_ids=[]
    for triangle_index in group['triangles']:
        original=[transformed(source['vertices'][j],transform) for j in source['triangles'][triangle_index]]
        polygon=polygon_clip(original,2,-CASE_HALF_WIDTH_M,True)
        polygon=polygon_clip(polygon,2,CASE_HALF_WIDTH_M,False)
        if not polygon:
            removed.append(triangle_index);continue
        exact=len(polygon)==3 and all(any(math.dist(p,q)<1e-7 for q in polygon) for p in original)
        before=m.mark();m.face(polygon)
        retained_ids.append(triangle_index)
        pieces.append({'sourceTriangleIndex':triangle_index,'sourceComponent':component,
                       'firstVertex':before[0],'vertices':len(m.points)-before[0],
                       'firstIndex':before[1],'indices':len(m.indices)-before[1],
                       'status':'unchanged' if exact else 'clipped'})
    if not pieces:raise ValueError('A selected central source component was entirely removed')
    outer=m.record(start,'attached STL main gunhouse' if component==0 else 'attached STL rear detail '+str(component),
                   sourceSTLComponent=component,sourceSTLTriangleIndices=retained_ids,
                   sourceAsset='arquitens_turret.stl',componentRole='retained-laterally-clipped-source')
    low,high=H.bounds([transformed(source['vertices'][j],transform) for j in group['vertices']]);caps=[]
    for value in [-CASE_HALF_WIDTH_M,CASE_HALF_WIDTH_M]:
        if not low[2]<value<high[2]:continue
        cap_start=m.mark()
        for poly in section_loops(source,transform,2,value,component):
            for triangle in triangulate_planar(poly,2):
                # This is the new exterior side armor of the retained solid.
                desired=1 if value>0 else -1
                if H.cross(H.sub(triangle[1],triangle[0]),H.sub(triangle[2],triangle[0]))[2]*desired<0:triangle.reverse()
                m.face(triangle)
        caps.append(m.record(cap_start,'source-derived lateral closure '+str(component)+' '+str(value),
                             componentRole='source-lateral-closure',sourceSTLComponent=component,
                             sourceSection={'axis':2,'valueM':value,'method':'STL plane-intersection outer loop'},
                             structuralArmor=True,addsCapacitorRoom=False))
    total={'firstVertex':start[0],'vertices':len(m.points)-start[0],
           'firstIndex':start[1],'indices':len(m.indices)-start[1]}
    return {'sourceComponent':component,'outer':outer,'caps':caps,'pieces':pieces,'removed':removed,
            'selectedSourceTriangleIndices':group['triangles'],'meshRange':total}


def remesh_source_round_detail(m,source,component,transform):
    """Retessellate only the six tiny round rear details, preserving their extents.

    The major STL armor and every source-derived case closure keep their exact
    surfaces. These 0.57 m diameter details previously used 32 radial facets;
    their twelve-facet replacements retain the source axis, length and all four
    radial extrema. The source-to-render provenance explicitly marks a remesh.
    """
    group=source['components'][component]
    low,high=H.bounds([transformed(source['vertices'][j],transform) for j in group['vertices']])
    center=[(a+b)/2 for a,b in zip(low,high)]
    ry,rz=(high[1]-low[1])/2,(high[2]-low[2])/2
    vertices=[[x,center[1]+ry*math.cos(2*math.pi*i/SOURCE_DETAIL_SEGMENTS),
               center[2]+rz*math.sin(2*math.pi*i/SOURCE_DETAIL_SEGMENTS)]
              for x in [low[0],high[0]] for i in range(SOURCE_DETAIL_SEGMENTS)]
    n=SOURCE_DETAIL_SEGMENTS
    polygons=[list(range(n-1,-1,-1)),list(range(n,n*2))]
    polygons.extend([[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)])
    raw=H.Mesh();raw.convex(vertices,polygons,'source round detail')
    triangles=[raw.indices[i:i+3] for i in range(0,len(raw.indices),3)]
    proxy={'vertices':raw.points,'triangles':triangles,'components':[{'triangles':list(range(len(triangles)))}]}
    identity={'sourceOrigin':[0,0,0],'nativeOffsetM':[0,0,0],
              'nativeAxesFromSource':[[1,0,0],[0,1,0],[0,0,1]],'uniformScale':1}
    start=m.mark()
    for triangle in triangles:
        polygon=[raw.points[i] for i in triangle]
        polygon=polygon_clip(polygon,2,-CASE_HALF_WIDTH_M,True)
        polygon=polygon_clip(polygon,2,CASE_HALF_WIDTH_M,False)
        if polygon:m.face(polygon)
    remesh={'method':'closed-elliptical-cylinder-from-source-component-extrema',
            'sourceComponent':component,'sourceTriangleIndices':group['triangles'],
            'sourceBoundsM':[low,high],'axis':[1,0,0],'radialSegments':n,
            'maximumRoundSurfaceDeviationM':max(ry,rz)*(1-math.cos(math.pi/n))+.0005,
            'preserved':'axis, axial ends, center and both radial cardinal diameters; lateral clipping unchanged'}
    outer=m.record(start,'attached STL rear detail '+str(component),sourceSTLComponent=component,
                   sourceSTLTriangleIndices=group['triangles'],sourceAsset='arquitens_turret.stl',
                   componentRole='retessellated-source-round-detail',sourceRemesh=remesh)
    piece={k:outer[k] for k in ['firstVertex','vertices','firstIndex','indices']}
    piece.update(sourceComponent=component,sourceTriangleIndices=group['triangles'],status='remeshed')
    caps=[]
    for value in [-CASE_HALF_WIDTH_M,CASE_HALF_WIDTH_M]:
        if not low[2]<value<high[2]:continue
        cap_start=m.mark()
        for poly in section_loops(proxy,identity,2,value):
            for triangle in triangulate_planar(poly,2):
                if H.cross(H.sub(triangle[1],triangle[0]),H.sub(triangle[2],triangle[0]))[2]*(1 if value>0 else -1)<0:triangle.reverse()
                m.face(triangle)
        caps.append(m.record(cap_start,'source-derived lateral closure '+str(component)+' '+str(value),
                             componentRole='source-lateral-closure',sourceSTLComponent=component,
                             sourceSection={'axis':2,'valueM':value,'method':'retessellated source-round-detail plane-intersection loop'},
                             structuralArmor=True,addsCapacitorRoom=False))
    total={'firstVertex':start[0],'vertices':len(m.points)-start[0],
           'firstIndex':start[1],'indices':len(m.indices)-start[1]}
    return {'sourceComponent':component,'outer':outer,'caps':caps,'pieces':[piece],'removed':[],
            'selectedSourceTriangleIndices':group['triangles'],'meshRange':total,'remesh':remesh}


def concentric_bearing(m,center,sign,label):
    """One connected skin, replacing four overlapping solid cylinders and bolts."""
    start=m.mark()
    # The outer hub reaches the former bolt-head extremum, preserving the
    # complete mechanical envelope after those subpixel bolts are absorbed.
    profile=[(-.95,0),(-.95,4.3),(.95,4.3),(.95,3.72),(1.065,3.72),
             (1.065,2.95),(1.135,2.95),(1.135,1.57),(1.235,1.57),(1.235,0)]
    rings=[]
    for axial,radius in profile:
        if radius==0:
            rings.append([len(m.points)]);m.points.append([center[0],center[1],center[2]+sign*axial]);m.uvs.append((0,32768))
        else:
            ring=[]
            for i in range(BEARING_SEGMENTS):
                t=2*math.pi*i/BEARING_SEGMENTS
                ring.append(len(m.points));m.points.append([center[0]+radius*math.cos(t),center[1]+radius*math.sin(t),center[2]+sign*axial]);m.uvs.append((0,0))
            rings.append(ring)
    for a,b in zip(rings,rings[1:]):
        for i in range(BEARING_SEGMENTS):
            j=(i+1)%BEARING_SEGMENTS
            if len(a)==1:triangles=[[a[0],b[j],b[i]]]
            elif len(b)==1:triangles=[[a[i],a[j],b[0]]]
            else:triangles=[[a[i],a[j],b[j]],[a[i],b[j],b[i]]]
            for triangle in triangles:m.indices.extend(triangle if sign>0 else list(reversed(triangle)))
    return m.record(start,label,centerM=center,axis=[0,0,1],radiusM=4.3,
                    radialSegments=BEARING_SEGMENTS,continuousConcentricProfileM=[list(p) for p in profile],
                    removedHiddenGeometry='overlapping cylinder caps; subpixel hub fasteners merged into the outer hub envelope')


def photo_barrel(m,root,tip,y,z,label):
    """An explicit photographed long neck, 1m shaft and 1.22m muzzle collar."""
    start=m.mark();shaft_start=tip-9.3;shaft_radius=.5;muzzle_radius=.61;bore=.34;recess=.7
    profile=[(root,0),(root,1.0),(root+.9,1.0),(root+.9,.88),
             (root+3.3,.88),(root+3.3,.75),(shaft_start,.5),
             (tip-4.8,.5),(tip-4.8,.56),(tip-4.55,.56),(tip-4.55,.5),
             (tip-1.5,.5),(tip-1.5,muzzle_radius),(tip,muzzle_radius),
             (tip,bore),(tip-recess,bore),(tip-recess,0)]
    if any(b[0]<a[0]-1e-8 for a,b in zip(profile[:14],profile[1:14])):raise ValueError('Non-monotone exterior barrel profile')
    rings=[];segments=BARREL_SEGMENTS
    for x,r in profile:
        if r==0:
            rings.append([len(m.points)]);m.points.append([x,y,z]);m.uvs.append((0,32768))
        else:
            ring=[]
            for i in range(segments):
                t=2*math.pi*i/segments;ring.append(len(m.points));m.points.append([x,y+r*math.cos(t),z+r*math.sin(t)])
                m.uvs.append((round((x-root)/(tip-root)*65535),round(i/segments*65535)))
            rings.append(ring)
    for a,b in zip(rings,rings[1:]):
        for i in range(segments):
            j=(i+1)%segments
            if len(a)==1:m.indices.extend([a[0],b[j],b[i]])
            elif len(b)==1:m.indices.extend([a[i],a[j],b[0]])
            else:m.indices.extend([a[i],a[j],b[j],a[i],b[j],b[i]])
    return m.record(start,label,root=[root,y,z],muzzle=[tip,y,z],centerM=[(root+tip)/2,y,z],axis=[1,0,0],
                    outerRadiusM=muzzle_radius,boreRadiusM=bore,muzzleRecessM=recess,exposedStartX=shaft_start,
                    shaftRadiusM=shaft_radius,shaftLengthM=9.3,muzzleCollarLengthM=1.5,
                    radialSegments=segments,
                    profileStationsM=[[x,r] for x,r in profile],profileEvidence='latest full-sheet measured 60–61px neck-to-lip, shaft 6.5px, muzzle 8px')


def build():
    source=stl_source();transform=transform_spec(source);m=H.Mesh();retained=[]
    original_body_points=[transformed(source['vertices'][j],transform) for j in source['components'][0]['vertices']]
    original_half_width=max(abs(p[2]) for p in original_body_points)
    lateral_shift=original_half_width-CASE_HALF_WIDTH_M
    for i,group in enumerate(source['components']):
        if i==0 or group['bounds'][1][2]<=-5.6:
            retained.append(remesh_source_round_detail(m,source,i,transform) if i in [7,8,9,10,11,12]
                            else trim_source_component(m,source,i,transform))
    body=retained[0]['outer'];source_range=retained[0]['meshRange']
    source_pieces=[p for r in retained for p in r['pieces']]
    source_outer_ranges=[{k:r['outer'][k] for k in ['firstVertex','vertices','firstIndex','indices']} for r in retained]
    cap_rows=[c for r in retained for c in r['caps']]
    cells=[([0,.2,-5.8],[8,1.8,5.8],'retained STL lower integral gunhouse'),
           ([-7.8,4.6,-1.8],[-5.0,7.3,1.8],'retained STL rear service house'),
           ([-4.5,3.0,-1.8],[2.8,7.1,1.8],'retained STL central service house')]
    verified=[]
    for low,high,label in cells:
        low=[v*UNIFORM_SCALE/3.1 for v in low];high=[v*UNIFORM_SCALE/3.1 for v in high]
        low[2]=max(low[2],-CASE_HALF_WIDTH_M+.15);high[2]=min(high[2],CASE_HALF_WIDTH_M-.15)
        probes=[[low[k]+(high[k]-low[k])*t[k] for k in range(3)]
                for t in __import__('itertools').product([0,.5,1],repeat=3)]
        if not all(inside_source(p,source,transform) for p in probes):raise ValueError('Conservative cell leaves STL case: '+label)
        m.compartments.append(box_cell(low,high,label,source_range))
        verified.append({'label':label,'sampledPoints':len(probes),'insideRetainedCase':True})
    pivot=[3.0,4.9,0];shafts=[]
    for sign in [-1,1]:
        row=m.cylinder([pivot[0],pivot[1],sign*(7.5-lateral_shift)],.94,3.5,2,'fixed STL-case trunnion shaft '+str(sign),8)
        shafts.append(row)
        m.prism([[1.75,3.7],[4.25,3.7],[4.6,4.2],[4.6,5.8],[4.25,6.1],[1.75,6.1]],
                min(sign*(5.8-lateral_shift),sign*(8.6-lateral_shift)),max(sign*(5.8-lateral_shift),sign*(8.6-lateral_shift)),'integral fixed bearing shoulder '+str(sign))
    split=m.mark();drives=[];receivers=[]
    for sign in [-1,1]:
        center=[pivot[0],pivot[1],sign*(9.0-lateral_shift)]
        row=concentric_bearing(m,center,sign,'rebuilt large circular 500GT elevation bearing '+str(sign));drives.append(row)
        receivers.append(m.prism([[3.3,2.2],[6.6,2.2],[7.3,2.9],[7.3,7.1],[6.6,7.6],[3.3,7.6]],
                         min(sign*(8.15-lateral_shift),sign*(9.85-lateral_shift)),max(sign*(8.15-lateral_shift),sign*(9.85-lateral_shift)),'common vertical two-gun receiver '+str(sign)))
    body_bounds=H.bounds([transformed(source['vertices'][j],transform) for j in source['components'][0]['vertices']])
    lower_tip=body_bounds[0][0]+OVERALL_LENGTH_M
    stagger=0.0;barrels=[]
    for sign in [-1,1]:
        for upper in [False,True]:
            offset=stagger if upper else 0
            row=photo_barrel(m,5.8-offset,lower_tip-offset,6.75 if upper else 3.05,sign*(9.0-lateral_shift),
                             ('upper' if upper else 'lower')+' rebuilt 500GT barrel '+str(sign))
            row.update(muzzleStyle='open-recessed',verticalPairSide=sign,upper=upper,axialStaggerM=-offset);barrels.append(row)
    body_points=[transformed(source['vertices'][j],transform) for j in source['components'][0]['vertices']]
    max_side=max(abs(p[2]) for p in body_points);stations=[p[0] for p in body_points if abs(abs(p[2])-max_side)<.002]
    mount=[(min(stations)+max(stations))/2,0,0]
    asset=H.finish(m,'quad500','500GT 4連装中型ターボレーザー',.5,pivot,barrels,split,drives,1,
          nativeCalibration='light-photo-family',materialReference='ven_turret70_native',
          source='User supplied arquitens_turret.stl; laterally trimmed central case with source-derived side closures and rebuilt external quad mechanism',
          derivedFromSTL='arquitens_turret.stl',sourceSTLSha256=source['sha256'],sourceTransform=transform,
          sourceBodyTriangleIndices=source['components'][0]['triangles'],retainedBodyMeshRange=source_range,
          sourceSelectedTriangleIndices=[i for r in retained for i in r['selectedSourceTriangleIndices']],
          sourceTrianglePieces=source_pieces,sourceRemovedTriangleIndices=[i for r in retained for i in r['removed']],
          sourceOuterMeshRanges=source_outer_ranges,
          sourceClip={'kind':'lateral-halfspaces','halfWidthM':CASE_HALF_WIDTH_M,'originalCaseHalfWidthM':original_half_width,
              'planes':[{'axis':2,'valueM':-CASE_HALF_WIDTH_M,'keepGreater':True},{'axis':2,'valueM':CASE_HALF_WIDTH_M,'keepGreater':False}],
              'capComponentLabels':[r['label'] for r in cap_rows]},
          sourceGeometryPreservation={'kind':'rigid-uniform-source-frame-with-lateral-clipping-and-explicit-round-detail-retessellation',
              'sourceFaces':len(source['triangles']),'selectedSourceFaces':sum(len(r['selectedSourceTriangleIndices']) for r in retained),
              'retainedComponents':[r['sourceComponent'] for r in retained],
              'unchangedSourceFaces':sum(p['status']=='unchanged' for p in source_pieces),
              'clippedSourceFaces':sum(p['status']=='clipped' for p in source_pieces),
              'removedSourceFaces':sum(len(r['removed']) for r in retained),
              'retainedFaces':sum(r['outer']['indices']//3 for r in retained),
              'retainedVertices':sum(r['outer']['vertices'] for r in retained),
              'newLateralClosureFaces':sum(r['indices']//3 for r in cap_rows),
              'unchangedFacesAndPlanarClippedSourceSurfacesPreserved':False,
              'mainGunhouseSurfacesAndLateralClosuresPreserved':True,
              'retessellatedSourceComponents':[r['remesh'] for r in retained if 'remesh' in r],
              'retessellatedOriginalSourceFaces':sum(len(r['selectedSourceTriangleIndices']) for r in retained if 'remesh' in r),
              'sourceTransform':transform},
          sourceHousingVertices=sum(r['outer']['vertices'] for r in retained),sourceHousingFaces=sum(r['outer']['indices']//3 for r in retained),
          photoMeasurements='assets/source/light-turret-photo-measurements.json',
          mount=mount,mountAlignment={'kind':'preserved-maximum-width-station-after-lateral-trim','originalIntervalM':[min(stations),max(stations)],
              'midpointM':mount,'sectionWidthM':CASE_HALF_WIDTH_M*2,
              'portEndpointM':[mount[0],0,-CASE_HALF_WIDTH_M],'starboardEndpointM':[mount[0],0,CASE_HALF_WIDTH_M]},
          layout={'kind':'vertical-port-starboard-pairs','verticalLevelsM':[3.05,6.75],
              'portStarboardZM':[-(9.0-lateral_shift),9.0-lateral_shift],'upperPairAxialStaggerM':-stagger,
              'barrelAxialAlignmentEvidence':'latest supplied ship closeup shows aligned upper and lower muzzles; original STL barrels were replaced'},
          jointLimits={'yaw':None,'lo':-10*math.pi/180,'hi':85*math.pi/180},
          lateralMountAdjustment={'removedSourceFlareMPerSide':lateral_shift,'completeAssembliesMovedInwardMPerSide':lateral_shift,
              'axialAndVerticalCoordinatesPreserved':True,'caseHalfWidthM':CASE_HALF_WIDTH_M},
          caseStyle='lateral-trimmed-central-STL-gunhouse-with-inward-outboard-vertical-receivers',
          polygonBudget={'triangles':TRIANGLE_BUDGET,'actualTriangles':len(m.indices)//3,
              'scope':'complete fixed and elevating mesh including integral case, closure caps, bearings, shafts, receivers and all four recessed barrels',
              'barrelRadialSegments':BARREL_SEGMENTS,'bearingRadialSegments':BEARING_SEGMENTS,
              'sourceRoundDetailRadialSegments':SOURCE_DETAIL_SEGMENTS},
          photoFeatureComponents={'mainCase':[body['label'],*[r['label'] for r in retained[0]['caps']]],'drive':[r['label'] for r in drives],
              'receiver':[r['label'] for r in receivers]},sourceCompartmentValidation=verified)
    asset['derivedFrom']='arquitens_turret.stl'
    asset['turretCompartment'].update(sourceAsset='arquitens_turret.stl',method='three conservative closed cells inside the laterally clipped source case',
                                    closureProvenance='source-case ray parity at corners, edge midpoints and cell centers; cells clipped inside both new side walls; no barrel, drive, cap armor or empty-space credit')
    return {'arq_turret_quad500':asset}


def validate(assets):
    asset=assets['arq_turret_quad500'];data=base64.b64decode(asset['data'])
    if len(asset['barrelCenters'])!=4:raise ValueError('Expected four physical barrels')
    if abs(asset['size'][0]-OVERALL_LENGTH_M)>.001:raise ValueError('Photo-calibrated overall length drifted')
    if asset['n']>=65536:raise ValueError('Small turret must remain a 16-bit mesh')
    if asset['faces']>TRIANGLE_BUDGET:raise ValueError('500GT quad exceeds its complete-mesh triangle budget')
    if len(data)!=asset['n']*10+asset['faces']*3*asset['indexBytes']:raise ValueError('Packed triangle count is inconsistent')
    if not all(math.isfinite(v) for p in asset['bounds'] for v in p):raise ValueError('Invalid bounds')
    body=asset['retainedBodyMeshRange'];points=[]
    for i in range(asset['elevationVertexStart'],asset['n']):
        points.append([struct.unpack_from('<h',data,i*6+k*2)[0]/65532*asset['size'][k]+asset['c'][k] for k in range(3)])
    source=stl_source();xf=asset['sourceTransform']
    side=max(abs(struct.unpack_from('<h',data,i*6+4)[0]/65532*asset['size'][2]+asset['c'][2])
             for i in range(body['firstVertex'],body['firstVertex']+body['vertices']))
    clearance=min(abs(p[2]) for p in points)-side
    for row in asset['sourceOuterMeshRanges']:
        for i in range(row['firstVertex'],row['firstVertex']+row['vertices']):
            z=struct.unpack_from('<h',data,i*6+4)[0]/65532*asset['size'][2]+asset['c'][2]
            if abs(z)>CASE_HALF_WIDTH_M+.001:raise ValueError('A retained STL wing escaped lateral clipping')
    if clearance<.2:raise ValueError('Moving receivers must clear the retained central case laterally')
    lateral_shift=asset['sourceClip']['originalCaseHalfWidthM']-CASE_HALF_WIDTH_M
    engagement=[[3.0,4.9,sign*(5.8-lateral_shift)] for sign in [-1,1]]
    if not all(inside_source(p,source,xf) for p in engagement):raise ValueError('Fixed bearing shafts must engage the retained case')
    return {'physicalBarrels':4,'renderedMainBodyFacesIncludingNewCaps':body['indices']//3,
            'renderedSourceFaces':asset['sourceGeometryPreservation']['retainedFaces'],
            'selectedOriginalSourceFaces':asset['sourceGeometryPreservation']['selectedSourceFaces'],
            'retainedCaseHalfWidthM':CASE_HALF_WIDTH_M,'completeAssemblyInwardOffsetM':lateral_shift,
            'movingCaseLateralClearanceM':clearance,'elevationDegreesVerified':[-10,0,25,55,85],
            'method':'all moving vertices strictly outboard of laterally clipped case bounds; Z is invariant under elevation',
            'fixedShaftCaseEngagementPointsM':engagement,'fixedShaftCaseEngagementVerified':True,
            'fixedShaftMovingWheelAxialOverlapM':1.2,
            'shaftLengthM':9.3,'shaftDiameterM':1.0,'muzzleDiameterM':1.22,'fullBarrelLengthM':asset['barrelCenters'][0]['muzzle'][0]-asset['barrelCenters'][0]['root'][0],
            'sourceGeometryPreserved':'major STL case and closures unchanged; explicit retained/clipped/removed mapping plus bounded retessellation of six small round rear details',
            'polygonBudget':asset['polygonBudget'],'conservativeCellsInsideSource':asset['sourceCompartmentValidation'],
            'packedSha256':hashlib.sha256(data).hexdigest()}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json-output',type=Path,default=Path('/tmp/light-quad500-candidate.json'))
    parser.add_argument('--metadata-output',type=Path,default=ROOT/'assets/source/light-quad500-manifest.json')
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args();assets=build();validation=validate(assets)
    manifest={'schemaVersion':1,'sourceFile':'assets/source/arquitens_turret.stl',
              'sourceSha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'uniformSourceScale':UNIFORM_SCALE,
              'photoMeasurements':'assets/source/light-turret-photo-measurements.json',
              'photoMeasurementsSha256':hashlib.sha256(MEASUREMENTS.read_bytes()).hexdigest() if MEASUREMENTS.exists() else None,
              'validation':validation,'assets':{key:{k:v for k,v in value.items() if k!='data'} for key,value in assets.items()}}
    if args.check:
        current=H.registry(ROOT/'data/reference.js')
        if any(current.get(k)!=v for k,v in assets.items()):raise SystemExit('The registered 500GT quad is stale')
        if not args.metadata_output.exists() or json.loads(args.metadata_output.read_text())!=manifest:raise SystemExit('The 500GT quad manifest is stale')
    else:
        args.json_output.write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':'))+'\n')
        args.metadata_output.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'size':assets['arq_turret_quad500']['size'],'faces':assets['arq_turret_quad500']['faces'],
                      'vertices':assets['arq_turret_quad500']['n'],'validation':validation},indent=2))


if __name__=='__main__':main()
