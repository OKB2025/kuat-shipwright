#!/usr/bin/env python3
"""Build the photographed 175 TT naval turrets and the enlarged 720 TT twin.

The existing 40 m ISD octuple is the dimensional anchor. All four 175 TT
variants have the same 60 x 16.425 x 45 m native envelope, rather than being scaled
by their aggregate output. Their forward mechanism narrows with barrel count.
The ion twin has a low cast-bowl shell; the other cases are naval hexagons.
Only Python's standard library is used. Existing meshes are never rewritten.
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
SPEC = importlib.util.spec_from_file_location('capital_turret_helpers', ROOT/'scripts/build-turret-family.py')
F = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(F)
MEASUREMENTS = ROOT/'assets/source/capital-turret-photo-measurements.json'
BEVEL_REFERENCE = ROOT/'assets/source/capital-turret-front-bevel-reference.json'
ORDER = ['capital_twin175_ion', 'capital_twin175', 'capital_quad175',
         'capital_triple175', 'capital_twin720']
PROTOTYPE_SIZE = [40.0, 11.0, 30.0]
ANGULAR_175_SCALE = 1.5
COMMON_SIZE = [v*ANGULAR_175_SCALE for v in PROTOTYPE_SIZE]
REDUCED_175_SIZE = [60.0,16.425,45.0]
FRONT_175_SCALE = .8
LEGACY_720_SIZE = [90.0,24.75,67.5]
LEGACY_720_SHA256 = 'b2e696e0559820d653b3e884491bcbdc6ef9f2d1890afd443f66f940a3ab2350'
LARGE_SCALE = 1.5
POD_WIDTHS = {2: 12.0, 3: 17.25, 4: 22.5}
ROW_SPANS = {2: 7.6/ANGULAR_175_SCALE, 3: 9.5, 4: 11.4}
BARREL_LENGTH = 17.5
BARREL_RADIUS = .55
BARREL_SEGMENTS = 20
ELEVATION_DEGREES = [-10, 0, 20, 45, 65, 85]
BAY_FLOOR = 5.5
BAY_X = [-10.7, 4.8]
BAY_HALF_WIDTH = 9.4
BOWL_BAY_HALF_WIDTH = 7.9
BEVEL_KNEE_Y = 3.0
BEVEL_ROOF_SETBACK = 6.75
BEVEL_ROOF_EDGE_TRIM = .3


def role(row, name):
    row['componentRole'] = name
    return row


def piece(m, vertices, faces, label, compartment=False):
    return m.convex(vertices, faces, label, compartment)


def reduce_front_point(point,pivot,factor):
    return [pivot[k]+(point[k]-pivot[k])*factor for k in range(3)]


def reduce_front_range(m,start,end,pivot,factor):
    if factor==1:return
    for i in range(start[0],end[0]):m.points[i]=reduce_front_point(m.points[i],pivot,factor)
    for cell in m.compartments:
        if start[0]<=cell['meshRange']['firstVertex']<end[0]:
            cell['verticesM']=[reduce_front_point(p,pivot,factor) for p in cell['verticesM']]
            cell['volumeM3']*=factor**3


def ring_mesh(m, label, center_x, radius, y0, y1, segments=32):
    return m.cylinder([center_x, (y0+y1)/2, 0], radius, y1-y0, 1, label, segments)


def parent_angular_case_geometry(pod_width):
    # The widest transverse section lies forward of the footprint midpoint.
    # Narrower two/three-gun mechanisms give the front cheeks a greater taper.
    nose = pod_width/2+1.4
    bottom = [[-13.5, 0, -9.8], [4, 0, -15], [13.5, 0, -nose],
              [13.5, 0, nose], [4, 0, 15], [-13.5, 0, 9.8]]
    top=[[-12.8,8.6,-9],[4,8.6,-14],[13.2,8.6,-nose+.3],
         [13.2,8.6,nose-.3],[4,8.6,14],[-12.8,8.6,9]]
    return F.convex_hull(bottom+top),bottom


def angular_case_geometry(pod_width):
    cell,bottom=parent_angular_case_geometry(pod_width)
    for normal,distance in front_bevel_planes(pod_width):cell=clip_plane(cell,normal,distance)
    return compact_cell(cell), bottom


def front_bevel_planes(pod_width):
    k=BEVEL_ROOF_SETBACK/(8.6-BEVEL_KNEE_Y)
    a=(15-(pod_width/2+1.4))/9.5
    b=a*k+BEVEL_ROOF_EDGE_TRIM/(8.6-BEVEL_KNEE_Y)
    return [([1,k,0],13.5+k*BEVEL_KNEE_Y),
            ([a,b,1],15+4*a+b*BEVEL_KNEE_Y),
            ([a,b,-1],15+4*a+b*BEVEL_KNEE_Y)]


def compact_cell(cell):
    # Axis clipping introduces vertices in the middle of planar faces/edges.
    # Retain only genuine three-plane corners, preserving the exact convex
    # surface/volume while avoiding redundant triangles in the renderer.
    vertices,faces=cell;planes={}
    for face in faces:
        normal=F.cross(F.sub(vertices[face[1]],vertices[face[0]]),
                       F.sub(vertices[face[2]],vertices[face[0]]))
        length=math.sqrt(F.dot(normal,normal))
        if length<1e-12:continue
        normal=[v/length for v in normal];distance=F.dot(normal,vertices[face[0]])
        planes[tuple(round(v,7) for v in normal+[distance])]=(normal,distance)
    corners=[]
    for p in vertices:
        incident=[n for n,d in planes.values() if abs(F.dot(n,p)-d)<1e-7]
        rank3=any(abs(F.dot(a,F.cross(b,c)))>1e-7
                  for i,a in enumerate(incident) for j,b in enumerate(incident[i+1:],i+1)
                  for c in incident[j+1:])
        if rank3:corners.append(p)
    if len(corners)<4:raise ValueError('Convex armor compaction lost its closed volume')
    compact=F.convex_hull(corners)
    triangles=lambda faces:[[face[0],face[i],face[i+1]] for face in faces for i in range(1,len(face)-1)]
    before=F.triangle_volume(vertices,triangles(faces));after=F.triangle_volume(compact[0],triangles(compact[1]))
    if abs(before-after)>max(1e-7,before*1e-8):
        raise ValueError('Convex armor compaction changed physical room volume')
    for face in compact[1]:
        a,b,c=[compact[0][i] for i in face[:3]];normal=F.cross(F.sub(b,a),F.sub(c,a))
        tolerance=1e-7*max(1,math.sqrt(F.dot(normal,normal)))
        if any(F.dot(normal,F.sub(p,a))>tolerance for p in vertices):
            raise ValueError('Convex armor compaction clipped an original surface point')
    return compact


def intersect_side_armor(parent,low_x,low_y,z0,z1):
    """Exact convex case/side-interval intersection, built from plane corners.

    Generate corners from original edges and new clipping planes, then author
    one planar polygon per supporting plane. This avoids triangulated clipping
    debris and makes each side cheek one closed structural volume.
    """
    vertices,faces=parent;planes={};edges=set()
    for face in faces:
        a,b,c=[vertices[i] for i in face[:3]]
        n=F.cross(F.sub(b,a),F.sub(c,a));length=math.sqrt(F.dot(n,n))
        if length<1e-12:continue
        n=[v/length for v in n];d=F.dot(n,a)
        planes[tuple(round(v,8) for v in n+[d])]=(n,d)
        edges.update(tuple(sorted((a,b))) for a,b in zip(face,face[1:]+face[:1]))
    parent_planes=list(planes.values())
    bounds=[([-1,0,0],-low_x),([0,-1,0],-low_y),([0,0,-1],-z0),([0,0,1],z1)]
    all_planes=parent_planes+bounds;points={}
    def accept(p):
        if all(F.dot(n,p)<=d+1e-7 for n,d in all_planes):points.setdefault(tuple(round(v,8) for v in p),p)
    def intersection(a,b,c):
        cross=F.cross(b[0],c[0]);det=F.dot(a[0],cross)
        if abs(det)<1e-9:return None
        ca=F.cross(c[0],a[0]);ab=F.cross(a[0],b[0])
        return [(a[1]*cross[k]+b[1]*ca[k]+c[1]*ab[k])/det for k in range(3)]
    for p in vertices:accept(p)
    for ia,ib in edges:
        a,b=vertices[ia],vertices[ib];delta=F.sub(b,a)
        for n,d in bounds:
            divisor=F.dot(n,delta)
            if abs(divisor)<1e-12:continue
            t=(d-F.dot(n,a))/divisor
            if -1e-9<=t<=1+1e-9:accept([a[k]+t*delta[k] for k in range(3)])
    for i,a in enumerate(bounds):
        for b in bounds[i+1:]:
            for c in parent_planes:
                p=intersection(a,b,c)
                if p is not None:accept(p)
    for i,a in enumerate(bounds):
        for j,b in enumerate(bounds[i+1:],i+1):
            for c in bounds[j+1:]:
                p=intersection(a,b,c)
                if p is not None:accept(p)
    corners=[]
    for p in points.values():
        incident=[plane for plane in all_planes if abs(F.dot(plane[0],p)-plane[1])<2e-7]
        best=None;best_det=0
        for i,a in enumerate(incident):
            for j,b in enumerate(incident[i+1:],i+1):
                for c in incident[j+1:]:
                    det=abs(F.dot(a[0],F.cross(b[0],c[0])))
                    if det>best_det:best_det=det;best=(a,b,c)
        if best_det>1e-8:
            q=intersection(*best)
            if not any(math.dist(q,r)<1e-7 for r in corners):corners.append(q)
    polygons=[]
    for n,d in all_planes:
        ids=[i for i,p in enumerate(corners) if abs(F.dot(n,p)-d)<3e-7]
        if len(ids)<3:continue
        axis=min(range(3),key=lambda k:abs(n[k]));unit=[1 if k==axis else 0 for k in range(3)]
        u=F.cross(n,unit);length=math.sqrt(F.dot(u,u));u=[v/length for v in u];v=F.cross(n,u)
        projected=sorted((F.dot(corners[i],u),F.dot(corners[i],v),i) for i in ids)
        cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        lower=[]
        for p in projected:
            while len(lower)>1 and cross(lower[-2],lower[-1],p)<=1e-9:lower.pop()
            lower.append(p)
        upper=[]
        for p in reversed(projected):
            while len(upper)>1 and cross(upper[-2],upper[-1],p)<=1e-9:upper.pop()
            upper.append(p)
        polygon=[p[2] for p in lower[:-1]+upper[:-1]]
        if len(polygon)>=3:polygons.append(polygon)
    edge_counts={}
    for face in polygons:
        for a,b in zip(face,face[1:]+face[:1]):
            key=tuple(sorted((a,b)));edge_counts[key]=edge_counts.get(key,0)+1
    if not polygons or set(edge_counts.values())!={2}:
        raise ValueError('Side armor is not a closed convex planar volume')
    return corners,polygons


def clip_plane(cell, normal, distance):
    vertices, faces = cell
    signed = lambda p: F.dot(p, normal)-distance
    points = [p[:] for p in vertices if signed(p)<=1e-9]
    for face in faces:
        for ia, ib in zip(face, face[1:]+face[:1]):
            a,b=vertices[ia],vertices[ib];da,db=signed(a),signed(b)
            if da*db<0:
                t=da/(da-db);points.append([a[k]+t*(b[k]-a[k]) for k in range(3)])
    return F.convex_hull(list({tuple(round(v,9) for v in p):p for p in points}.values()))


def bowl_case_geometry():
    # A true longitudinal flattened ellipsoid, sharing the naval mounting
    # station/rear extremum while retaining the rounded forward shoulders.
    points = []
    for level in range(8):
        angle=math.pi/2*level/8;radial=math.cos(angle);y=9.1*math.sin(angle)
        for i in range(32):
            t = 2*math.pi*i/32
            points.append([4+17.5*radial*math.cos(t), y, 15*radial*math.sin(t)])
    points.append([4, 9.1, 0])
    # Keep the long, rounded forebody. The earlier flat x=13.5/diagonal
    # trimming made a transverse half-ball rather than the photographed oval.
    cell=F.convex_hull(points)
    floor=sorted({(round(p[0],9),round(p[2],9)) for p in cell[0] if abs(p[1])<1e-8})
    turn=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lower=[]
    for p in floor:
        while len(lower)>1 and turn(lower[-2],lower[-1],p)<=1e-10:lower.pop()
        lower.append(p)
    upper=[]
    for p in reversed(floor):
        while len(upper)>1 and turn(upper[-2],upper[-1],p)<=1e-10:upper.pop()
        upper.append(p)
    return cell, [[x,0,z] for x,z in lower[:-1]+upper[:-1]]


def add_bowl_normal_runs(m,row):
    runs=[];start=None;last=None
    for j in range(row['firstIndex'],row['firstIndex']+row['indices'],3):
        ids=m.indices[j:j+3];points=[m.points[i] for i in ids]
        tests=[[p[k] for p in points] for k in range(3)]
        tests.extend([[.8*p[0]+sign*p[2] for p in points] for sign in [-1,1]])
        curved=all(max(values)-min(values)>1e-7 for values in tests)
        if curved:
            if start is None:start=(min(ids),j)
            last=(max(ids)+1,j+3)
        elif start is not None:runs.append((start,last));start=None
    if start is not None:runs.append((start,last))
    for i,(a,b) in enumerate(runs):
        m.components.append({'label':'cast-bowl analytic curved skin '+str(row['firstVertex'])+' '+str(i),
          'firstVertex':a[0],'vertices':b[0]-a[0],'firstIndex':a[1],'indices':b[1]-a[1],
          'componentRole':'fixed-cast-curved-skin','normalMode':'ellipsoid',
          'normalCenterM':[4,0,0],'normalRadiiM':[17.5,9.1,15],
          'normalClippingCapsExcluded':True,'floorYM':0})


def add_case(m, count, bowl=False,front_scale=1,pivot=None):
    width = POD_WIDTHS[count]
    (vertices, faces), footprint = bowl_case_geometry() if bowl else angular_case_geometry(width)
    # The recoil opening is real air and is not counted as charging equipment.
    # This starts slightly behind the moving rear bevel so the -10° stop clears.
    pieces = F.convex_without_box((vertices, faces), [5.0, .12, -width/2-.85], [50, 20, width/2+.85])
    bay_half = BOWL_BAY_HALF_WIDTH if bowl else BAY_HALF_WIDTH
    bay_low = [BAY_X[0], BAY_FLOOR, -bay_half]
    bay_high = [BAY_X[1], 20, bay_half]
    source_pieces=pieces
    # Reserve interior volume for drives/feeds under the armored deck. Closing
    # its real roof is independent of charging capacity: the occupied central
    # mechanism envelope is not credited as capacitor room.
    pieces = [part for source in source_pieces for part in F.convex_without_box(source,bay_low,bay_high)]
    rows = []
    for i, (v, f) in enumerate(pieces):
        if not bowl:v,f=compact_cell((v,f))
        row=role(piece(m, v, f, ('cast-bowl' if bowl else 'naval hexagonal')+' fixed house cell '+str(i), True), 'fixed-gunhouse')
        rows.append(row)
        if bowl:add_bowl_normal_runs(m,row)
    roof_rows=[]
    if not bowl:
        v=[[x,y,z] for x in [bay_low[0],bay_high[0]] for y in [bay_low[1],8.6]
           for z in [bay_low[2],bay_high[2]]]
        cell=F.convex_hull(v)
        for normal,distance in front_bevel_planes(width):cell=clip_plane(cell,normal,distance)
        roof=role(piece(m,*compact_cell(cell),'capital closed armored machinery roof 0'), 'fixed-armored-roof')
        roof['addsCapacitorRoom']=False;roof_rows.append(roof)
    for source in source_pieces if bowl else []:
        low,high=F.bounds(source[0])
        if any(high[k]<=bay_low[k]+1e-8 or low[k]>=bay_high[k]-1e-8 for k in range(3)):continue
        cell=source
        for axis in range(3):
            cell=clip_plane(cell,[-1 if k==axis else 0 for k in range(3)],-bay_low[axis])
            cell=clip_plane(cell,[1 if k==axis else 0 for k in range(3)],bay_high[axis])
        roof=role(piece(m,*cell,'capital closed armored machinery roof '+str(len(roof_rows))), 'fixed-armored-roof')
        roof['addsCapacitorRoom']=False
        roof_rows.append(roof)
        if bowl:add_bowl_normal_runs(m,roof)
    if front_scale!=1:
        # Two complete structural cheeks close the old side gaps. They remain
        # outside every moving part's constant-Z envelope and earn no room.
        inner=(width/2+.85)*front_scale;outer=width/2+.85+.02
        for sign in [-1,1]:
            z0,z1=sorted([sign*inner,sign*outer])
            v,f=intersect_side_armor((vertices,faces),5.,.12,z0,z1)
            row=role(piece(m,v,f,'capital continuous side-gap armor '+str(sign)),
                     'fixed-socket-structural-fill')
            row.update(addsCapacitorRoom=False,structuralSocketFill=True,
                       continuousSideArmor=True,side='port' if sign<0 else 'starboard',
                       socketAdaptation='continuous-closed-case-cheek')
            roof_rows.append(row)
            if bowl:add_bowl_normal_runs(m,row)
    # This is only the intrinsic yaw race and remains inside the native house.
    role(ring_mesh(m, 'intrinsic capital yaw bearing race', 4, 8.4, 0, .16,14 if bowl else 8), 'fixed-yaw-race')
    samples=[]
    for x,z in [[-4,0],[-3,0],[-4,1.8],[-4,-1.8]]:
        hits=[t for row in roof_rows for j in range(row['firstIndex'],row['firstIndex']+row['indices'],3)
              if (t:=F.ray_triangle([x,20,z],[0,-1,0],*[m.points[i] for i in m.indices[j:j+3]])) is not None]
        samples.append([x,20-min(hits),z])
    return rows, footprint, {'reservedLowM':bay_low,
        'reservedHighM':[bay_high[0],9.1 if bowl else 8.6,bay_high[2]],
        'nominalRoofYM':9.1 if bowl else 8.6,'coverageSamplesM':samples,
        'closedArmoredDeck':True,'equipmentSpaceExcludedFromCapacitorRoom':True},roof_rows


def tapered_vertical_drum(m, center_x, center_z, radius, bottom, top, label, segments=20):
    vertices=[]
    for y,r in [(bottom,radius),(top,radius*.84)]:
        vertices.extend([[center_x+r*math.cos(2*math.pi*i/segments),y,
                          center_z+r*math.sin(2*math.pi*i/segments)] for i in range(segments)])
    faces=[list(reversed(range(segments))),list(range(segments,segments*2))]
    faces.extend([[i,(i+1)%segments,(i+1)%segments+segments,i+segments] for i in range(segments)])
    return m.convex(vertices,faces,label)


def side_relief(m, count):
    # Project each armor plaque separately onto every true support face. A
    # decorative n-gon must never bridge a crease or disappear into the case.
    vertices,faces=angular_case_geometry(POD_WIDTHS[count])[0]
    groups={}
    for face in faces:
        a,b,c=[vertices[i] for i in face[:3]]
        normal=F.cross(F.sub(b,a),F.sub(c,a));length=math.sqrt(F.dot(normal,normal))
        normal=[v/length for v in normal];distance=F.dot(normal,a)
        if abs(normal[2])<1e-7:continue
        key=tuple(round(v,7) for v in normal+[distance])
        group=groups.setdefault(key,{'normal':normal,'distance':distance,'points':[]})
        group['points'].extend([(vertices[i][0],vertices[i][1]) for i in face])
    def hull2(points):
        points=sorted(set(points));cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
        lower=[]
        for point in points:
            while len(lower)>1 and cross(lower[-2],lower[-1],point)<=1e-10:lower.pop()
            lower.append(point)
        upper=[]
        for point in reversed(points):
            while len(upper)>1 and cross(upper[-2],upper[-1],point)<=1e-10:upper.pop()
            upper.append(point)
        return lower[:-1]+upper[:-1]
    for group in groups.values():group['profile']=hull2(group['points'])
    def clip_profile(profile,normal,distance):
        result=[]
        for a,b in zip(profile,profile[1:]+profile[:1]):
            da=F.dot(a,normal)-distance;db=F.dot(b,normal)-distance
            if da<=1e-9:result.append(a)
            if (da<=1e-9)!=(db<=1e-9):
                t=da/(da-db);result.append(tuple(a[j]+(b[j]-a[j])*t for j in range(2)))
        return hull2(result) if len(set(result))>=3 else []
    k=BEVEL_ROOF_SETBACK/(8.6-BEVEL_KNEE_Y)
    def plaque(profile,sign,low,high,label,component_role):
        profile=clip_profile(profile,[1,k],13.5+BEVEL_KNEE_Y*k-.03)
        if len(profile)<3:return
        if component_role!='fixed-side-panel-border':low=-.02
        for number,group in enumerate(groups.values()):
            normal,distance=group['normal'],group['distance']
            if normal[2]*sign<=0:continue
            part=profile
            for a,b in zip(group['profile'],group['profile'][1:]+group['profile'][:1]):
                dx,dy=b[0]-a[0],b[1]-a[1]
                part=clip_profile(part,[dy,-dx],dy*a[0]-dx*a[1])
                if not part:break
            if len(part)<3:continue
            area=abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(part,part[1:]+part[:1])))/2
            if area<1e-6:continue
            base=[[x,y,(distance-normal[0]*x-normal[1]*y)/normal[2]] for x,y in part]
            v=[[p[j]+normal[j]*offset for j in range(3)] for offset in [low,high] for p in base]
            n=len(part);polygons=[list(reversed(range(n))),list(range(n,n*2))]
            polygons.extend([[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)])
            for polygon in polygons:
                a,b,c=[v[i] for i in polygon[:3]];face_n=F.cross(F.sub(b,a),F.sub(c,a));length=math.sqrt(F.dot(face_n,face_n))
                if length<1e-12:raise ValueError('Armor patch has a zero-area intended face')
                if max(abs(F.dot(face_n,F.sub(v[i],a)))/length for i in polygon)>1e-7:
                    raise ValueError('Armor patch bridges noncoplanar case faces')
            row=role(m.convex(v,polygons,label+' face '+str(number)),component_role)
            row.update(planarArmorPatch=True,supportPlaneM={'normal':normal,'distanceM':distance},
                       baseOffsetM=low,raisedOffsetM=high,
                       baseFaceVertexRange={'firstVertex':row['firstVertex'],'vertices':n},
                       raisedFaceVertexRange={'firstVertex':row['firstVertex']+n,'vertices':n},
                       intendedFaceMaximumNonplanarityM=0)
    for sign in [-1,1]:
        for index,(x0,x1) in enumerate([(-11.5,3.65),(4.35,11.4)]):
            profile=[(x0,4.0),(x1,4.0),(x1-.6,7.75),(x0+1.2,7.75)]
            profile=clip_profile(profile,[1,k],13.5+BEVEL_KNEE_Y*k-.06)
            plaque(profile,sign,.012,.10,'capital upper trapezoid armor panel '+str(sign)+' '+str(index),'fixed-side-trapezoid-panel')
            for j in range(len(profile)):
                a,b=profile[j],profile[(j+1)%len(profile)]
                dx,dy=b[0]-a[0],b[1]-a[1];length=math.hypot(dx,dy)
                nx,ny=-dy/length*.16,dx/length*.16
                plaque([a,b,(b[0]+nx,b[1]+ny),(a[0]+nx,a[1]+ny)],sign,.09,.25,
                       'capital trapezoid raised rim '+str(sign)+' '+str(index)+' '+str(j),'fixed-side-panel-border')
            for y0,y1 in [(1.0,1.35),(2.75,3.1)]:
                plaque([(x0,y0),(x1,y0),(x1,y1),(x0,y1)],sign,.012,.11,
                       'capital lower armor band '+str(sign)+' '+str(index)+' '+str(y0),'fixed-lower-armor-band')
            span=(x1-x0)/5
            for j in [0,2,4]:
                a=x0+j*span;b=a+span
                plaque([(a,1.35),(b,1.35),(b,2.75),(a,2.75)],sign,.012,.11,
                       'capital inset-slot separating armor '+str(sign)+' '+str(index)+' '+str(j),'fixed-lower-slot-frame')


def roof_mechanisms(m, count, bowl=False):
    # The user's technical view shows two slotted rear housings linked through
    # exposed recoil conduits to breech blocks ON the closed armored deck.
    first=m.mark();vents=[];slats=[];mechanism_labels=[];ion_covers=[]
    spacing=4.65 if bowl else 5.65
    vent_radius=2.55 if bowl else 2.7
    for sign in [-1,1]:
        center=[-7.9,6.4,sign*spacing]
        if bowl:
            cover=role(m.prism([[-9.8,7.8],[3.5,7.8],[3.5,9.2],
                                [1.2,10.3],[-7.8,10.3],[-9.8,9.1]],
                               sign*spacing-1.5,sign*spacing+1.5,
                               'capital ion longitudinal receiver equipment cover '+str(sign)), 'fixed-ion-low-receiver-cover')
            ion_covers.append(cover);mechanism_labels.append(cover['label'])
            role(m.box([-7.0,10.28,sign*spacing-1.1],[-2.0,10.55,sign*spacing+1.1],
                       'capital ion low roof receiver access panel '+str(sign)), 'fixed-ion-low-access-panel')
            for x in [-6.3,-4.5,-2.7]:
                role(m.box([x,10.52,sign*spacing-.95],[x+.16,10.70,sign*spacing+.95],
                           'capital ion low receiver cover rib '+str(sign)+' '+str(x)), 'fixed-ion-low-cover-rib')
            for x,base in [(-8.0,5.5),(-2.0,7.5)]:
                role(m.box([x,base,sign*spacing-.9],[x+.5,8.0,sign*spacing+.9],
                           'capital ion receiver cast-shell mounting foot '+str(sign)+' '+str(x)), 'fixed-ion-cover-mounting-foot')
        else:
            role(m.box([-9.7,8.45,sign*spacing-1.75],[-6.1,8.75,sign*spacing+1.75],
                       'capital compact rear ventilation machinery base '+str(sign)), 'fixed-rear-vent-base')
            drum=role(tapered_vertical_drum(m,center[0],center[2],vent_radius,8.65,10.65,
                        'capital rear round ventilation housing '+str(sign),14), 'fixed-rear-vent-drum')
            drum.update(axis=[0,1,0],centerM=[center[0],9.65,center[2]],radiusM=vent_radius,topYM=10.65,bottomYM=8.65)
            vents.append(drum);mechanism_labels.append(drum['label'])
            # Seven separate cap bars leave stepped, deep parallel slot bottoms
            # between them; their span is clipped to the actual circular cap.
            for j in range(-3,4):
                z=sign*spacing+j*.48
                half=math.sqrt((vent_radius*.79)**2-(j*.48+.12)**2)
                slat=role(m.box([-7.9-half,10.64,z-.13],[-7.9+half,10.91,z+.13],
                               'capital rear vent raised cap slat '+str(sign)+' '+str(j)), 'fixed-rear-vent-slat')
                slats.append(slat)
        for offset in [-.55,.55]:
            z=sign*spacing+offset
            role(m.cylinder([-1.8,9.35,z],.30,8.3,0,
                            'capital exposed paired recoil pipe '+str(sign)+' '+str(offset),10 if bowl else 8), 'fixed-recoil-pipe')
            role(m.cylinder([-1.8,10.05,z],.16,8.3,0,
                            'capital exposed hydraulic return pipe '+str(sign)+' '+str(offset),8 if bowl else 6), 'fixed-return-pipe')
        for x in [-4.7,1.15]:
            role(m.box([x,8.6,sign*spacing-.95],[x+.45,10.2,sign*spacing+.95],
                       'capital recoil pipe bridge saddle '+str(sign)+' '+str(x)), 'fixed-pipe-cross-saddle')
        role(m.prism([[-2.0,8.55],[3.75,8.55],[3.75,9.8],[2.6,10.6],[-.8,10.6],[-2.0,9.8]],
                     sign*2.3-1.0,sign*2.3+1.0,'capital central breech service block '+str(sign)), 'fixed-central-breech-block')
        role(m.box([-.4,10.55,sign*2.3-.7],[2.2,10.8,sign*2.3+.7],
                   'capital central breech stepped access cap '+str(sign)), 'fixed-central-breech-cover')
        role(m.cylinder([.85,10.85,sign*2.3],.75,.20,1,
                        'capital central breech circular service cap '+str(sign),12 if bowl else 8), 'fixed-central-service-cap')
        # Feet visibly seat the pipe assemblies on the actual armored deck.
        for x in [-4.7,1.15]:
            role(m.box([x,8.5,sign*spacing-.75],[x+.45,8.8,sign*spacing+.75],
                       'capital deck mechanism mounting foot '+str(sign)+' '+str(x)), 'fixed-deck-mounting-foot')
    for x,y in [(-4.7,8.8),(2.8,9.4)]:
        role(m.box([x,y,-spacing-.8],[x+.45,y+.45,spacing+.8],
                   'capital interconnected machinery crossbeam '+str(x)), 'fixed-deck-crossbeam')
    role(m.box([3.85,8.55,-POD_WIDTHS[count]/2-.6],[4.75,8.95,POD_WIDTHS[count]/2+.6],
               'capital fixed stepped forward trunnion frame'), 'fixed-front-step-frame')
    if not bowl:side_relief(m,count)
    return {'assemblyMeshRange':{'firstVertex':first[0],'vertices':len(m.points)-first[0],
                                'firstIndex':first[1],'indices':len(m.indices)-first[1]},
            'rearVentDrums':vents,'rearVentSlats':slats,'ionReceiverCovers':ion_covers,'mechanismLabels':mechanism_labels}


def add_bearings(m, pivot, half_width, sloped_case=False):
    fixed = []
    for sign in [-1, 1]:
        if sloped_case:
            support=role(m.cylinder([pivot[0],pivot[1],sign*(half_width+1.175)],1.65,.65,2,
                            'capital integral beveled-case trunnion support '+str(sign),12), 'fixed-bearing-stanchion')
            support.update(addsCapacitorRoom=False,structuralBearingSupport=True)
        center = [pivot[0], pivot[1], sign*(half_width+.85)]
        row = role(m.cylinder(center, .56, 1.0, 2, 'capital fixed pod trunnion axle '+str(sign),8 if sloped_case else 16), 'fixed-bearing-axle')
        row.update(centerM=center, radiusM=.56, axis=[0, 0, 1], engagementM=.30)
        fixed.append(row)
    return fixed


def moving_pod(m, count, pivot, ion=False, offset_x=0,front_scale=1,barrel_count=None):
    width = POD_WIDTHS[count];barrel_count=barrel_count or count
    first = m.mark()
    profile=[[6,6.2],[6.8,4.2],[8.5,2.8],[13.5,2.8],[15.2,4.2],
             [16,6.2],[15.2,8.4],[13.1,9.65],[8.5,9.65],[6.7,8.2]]
    raw=F.Mesh();raw.prism(profile,-width/2,width/2,'pod source')
    source=F.convex_hull(raw.points)
    # The actual receiver/breech volume is occupied hardware. Credit only the
    # remaining closed floor/roof/side cells, not a full opaque pod envelope.
    occupied_rear=8.8 if front_scale==1 else pivot[0]+(8.8-offset_x-pivot[0])/front_scale
    for i,(v,f) in enumerate(F.convex_without_box(source,[occupied_rear,4.65,-width*.42],[17.5,8.35,width*.42])):
        if not ion or front_scale!=1:v,f=compact_cell((v,f))
        role(m.convex(v,f,'capital moving pod closed equipment cell '+str(i),True),'moving-front-pod-cell')
        m.compartments[-1]['movesWithGun']=True
    pod=role(m.record(first,'capital common elevating '+str(count)+'-gun pod'),'moving-front-pod')
    role(m.prism([[8,10.0],[16,10.0],[16,10.7],[14.8,10.9],[8.6,10.9],[8,10.5]],
                 -width/2-.10,width/2+.10,'capital stepped upper mantlet ledge'),'moving-mantlet-ledge')
    for x in [8.0,13.0]:
        role(m.box([x,9.4,-width*.43],[x+.5,10.1,width*.43],
                   'capital upper mantlet ledge connecting rib '+str(x)), 'moving-mantlet-ledge-rib')
    role(m.box([10.5, 10.9, -width*.33], [13.7, 11.0, width*.33],
               'capital moving pod top service cover'), 'moving-pod-cover')
    drives = []
    for sign in [-1, 1]:
        center = [pivot[0], pivot[1], sign*(width/2+.35)]
        row = role(m.cylinder(center, 3.25, .6, 2, 'capital moving circular pod bearing '+str(sign),20 if front_scale!=1 else 22), 'moving-pod-bearing')
        row.update(centerM=center, radiusM=3.25, axis=[0, 0, 1])
        drives.append(row)
        role(m.cylinder([center[0], center[1], center[2]+sign*.38], 2.40, .16, 2,
                        'capital concentric pod bearing cover '+str(sign),(12 if front_scale!=1 else 16) if ion else (12 if front_scale!=1 else 14)), 'moving-bearing-cover')
        role(m.cylinder([center[0], center[1], center[2]+sign*.44],1.05,.10,2,
                        'capital recessed trunnion central drive boss '+str(sign),10 if ion else 6),'moving-bearing-central-boss')
        # A stepped, connected frame at the front of the gun cradle matches the
        # heavy naval mantlet in the technical reference. It rotates with the
        # complete receiver and tubes, including the forward overhang.
        role(m.box([15.78,4.1,sign*(width/2)-.18],[16.24,8.65,sign*(width/2)+.18],
                   'capital forward trunnion side frame '+str(sign)), 'moving-trunnion-step-frame')
    for y0,y1 in [(3.65,4.15),(8.6,9.15)]:
        role(m.box([15.78,y0,-width/2-.18],[16.24,y1,width/2+.18],
                   'capital forward trunnion transverse step '+str(y0)), 'moving-trunnion-step-frame')
    # The pod's front mouth includes a broad connected recoil block. Complete
    # 175 TT tubes begin inside it and emerge just beyond its front armor.
    receiver = role(m.prism([[9.0, 4.8], [16.1, 4.8], [16.7, 5.5], [16.7, 7.6],
                            [16.1, 8.2], [9.0, 8.2]], -width*.40, width*.40,
                           'capital '+str(count)+'-gun common recoil receiver'), 'moving-receiver')
    for i in range(count):
        z = (i-(count-1)/2)*ROW_SPANS[count]/(count-1)
        role(m.box([10.0, 7.7, z-.46], [15.8, 8.5, z+.46],
                   'capital individual recoil slide '+str(i+1)), 'moving-recoil-slide')
        role(m.box([16.68,5.3,z-.95],[17.1,7.85,z+.95],
                   'capital forward individual breech collar '+str(i+1)), 'moving-breech-collar')
    moving_range = {'firstVertex': first[0], 'vertices': len(m.points)-first[0],
                    'firstIndex': first[1], 'indices': len(m.indices)-first[1]}
    if offset_x:
        for p in m.points[first[0]:]:p[0]+=offset_x
        for cell in m.compartments:
            if cell.get('movesWithGun'):
                for p in cell['verticesM']:p[0]+=offset_x
        for drive in drives:drive['centerM'][0]+=offset_x
    if front_scale!=1:
        center=[pivot[0]+offset_x,pivot[1],pivot[2]]
        interface_rows=[r for r in m.components if r['firstVertex']>=first[0]
                        and r.get('componentRole') in ['moving-recoil-slide','moving-breech-collar']]
        axes=[(r,(min(p[2] for p in m.points[r['firstVertex']:r['firstVertex']+r['vertices']])+
                  max(p[2] for p in m.points[r['firstVertex']:r['firstVertex']+r['vertices']]))/2)
              for r in interface_rows]
        reduce_front_range(m,first,m.mark(),center,front_scale)
        for row,z in axes:
            for p in m.points[row['firstVertex']:row['firstVertex']+row['vertices']]:
                p[2]+=z*(1-front_scale)
                p[1]+=(6.6-pivot[1])*(1-front_scale)
        for drive in drives:
            drive['centerM']=reduce_front_point(drive['centerM'],center,front_scale)
            drive['radiusM']*=front_scale
    barrels = []
    barrel_axes=[(i-(count-1)/2)*ROW_SPANS[count]/(count-1) for i in range(count)]
    if barrel_count!=count:
        if count!=2 or barrel_count!=3:raise ValueError('Only the twin base supports an added center barrel')
        barrel_axes.append(0.)
    for i,z in enumerate(barrel_axes):
        row = (m.ion_barrel if ion else m.barrel)(9, 26.5, 6.6, z, BARREL_RADIUS,
                       ('175TT ion' if ion else '175TT turbo')+' complete barrel '+str(i+1),
                       segments=BARREL_SEGMENTS,**({'taper_start_x':16.7+offset_x} if ion else {}))
        visible_front=17.1+offset_x
        if front_scale!=1:visible_front=pivot[0]+offset_x+(17.1-pivot[0])*front_scale
        row.update(muzzleStyle='modeled-recessed', radialSegments=BARREL_SEGMENTS,
                   fullLengthM=BARREL_LENGTH,weaponRole='ion' if ion else 'turbolaser',
                   mechanicalRole='moving-complete-barrel', photoVisibleReachM=26.5-visible_front)
        if not ion:row['shaftRadiusM']=BARREL_RADIUS
        barrels.append(row)
    return pod, moving_range, drives, barrels, receiver


def build_one(kind, title, count, ion=False, bowl=False, scale=ANGULAR_175_SCALE, bolt_tt=175,
              profile_count=None,front_scale=1):
    profile_count=profile_count or count
    m = F.Mesh()
    pod_offset_x = 1.1 if bowl else 0
    pivot = [11+pod_offset_x, 6.2, 0]
    fixed_rows, footprint, deck, roof_rows = add_case(m,profile_count,bowl,front_scale,pivot)
    machinery = roof_mechanisms(m,profile_count,bowl)
    bearings_start=m.mark()
    fixed_axles = add_bearings(m,pivot,POD_WIDTHS[profile_count]/2,not bowl)
    reduce_front_range(m,bearings_start,m.mark(),pivot,front_scale)
    if front_scale!=1:
        for row in fixed_axles:
            row['centerM']=reduce_front_point(row['centerM'],pivot,front_scale)
            row['radiusM']*=front_scale;row['engagementM']*=front_scale
    split = m.mark()
    # Author around the unshifted pivot, then translate every moving cradle
    # part together. Complete tubes keep their common root/muzzle planes.
    pod, moving_range, drives, barrels, receiver = moving_pod(m,profile_count,[11,6.2,0],ion,pod_offset_x,front_scale,count)
    # Clipping arithmetic can leave a cardinal extremum a few ulps short of
    # the common family envelope. Snap only those exact intended extrema.
    for points in [m.points]+[c['verticesM'] for c in m.compartments]:
        for p in points:
            for axis,values in enumerate([[-13.5,26.5],[0,11],[-15,15]]):
                for v in values:
                    if abs(p[axis]-v)<1e-10:p[axis]=v
    point = lambda p: [v*scale for v in p]
    scaled_range = lambda row: {k: row[k] for k in ['firstVertex', 'vertices', 'firstIndex', 'indices']}
    for row in fixed_axles:
        row['centerM']=point(row['centerM']);row['radiusM']*=scale;row['engagementM']*=scale
    for row in m.components:
        if row.get('normalMode')=='ellipsoid':row['normalRadiiM']=point(row['normalRadiiM'])
        if row.get('planarArmorPatch'):
            row['supportPlaneM']['distanceM']*=scale
            row['baseOffsetM']*=scale;row['raisedOffsetM']*=scale
    for row in machinery['rearVentDrums']:
        row['centerM']=point(row['centerM'])
        for key in ['radiusM','topYM','bottomYM']:row[key]*=scale
    for b in barrels:
        b['shaftRadiusM'] *= scale
        b['fullLengthM'] *= scale
        b['photoVisibleReachM'] *= scale
    actual_case_bounds=F.bounds([m.points[i] for row in fixed_rows+roof_rows for i in range(row['firstVertex'],row['firstVertex']+row['vertices'])])
    moving_bounds=F.bounds(m.points[split[0]:])
    a = F.finish(m, kind, title, bolt_tt,
                 pivot, barrels, split, drives, scale,
                 nativeCalibration='capital-photo-family', materialReference='ven_turret70_native',
                 mount=point([4, 0, 0]), caseStyle='flattened-is-cast-bowl' if bowl else 'forward-wide-naval-hexagon',
                 photoMeasurements='assets/source/capital-turret-photo-measurements.json',
                 uniformPhotoScale=scale/ANGULAR_175_SCALE, prototypeScale=scale,
                 sameCaliberEnvelopeM=point(PROTOTYPE_SIZE),
                 caseMaximumWidthXM=4*scale, caseMaximumWidthStationFraction=.5 if bowl else 17.5/27,
                 caseBoundsM=[point(p) for p in actual_case_bounds],
                 castBowlRadiiM=point([17.5,9.1,15]) if bowl else None,
                 castBowlLongitudinalAxis=[1,0,0] if bowl else None,
                 caseFrontWidthM=(30*math.sqrt(1-(9.5/17.5)**2) if bowl else POD_WIDTHS[profile_count]+2.8)*scale,
                 caseFrontWidthStationXM=13.5*scale,
                 caseFootprintVerticesM=[point(p) for p in footprint],
                 fixedCaseMeshRanges=[scaled_range(r) for r in fixed_rows+roof_rows],
                 closedRoof={'nominalRoofYM':deck['nominalRoofYM']*scale,
                             'coverageSamplesM':[point(p) for p in deck['coverageSamplesM']],
                             'meshRanges':[scaled_range(r) for r in roof_rows],
                             'closedArmoredDeck':True,'addsCapacitorRoom':False},
                 interiorEquipmentReservation={'lowM':point(deck['reservedLowM']),
                                               'highM':point(deck['reservedHighM']),
                                               'coveredByActualArmoredRoof':True,
                                               'excludedFromCapacitorRoom':True},
                 exposedMechanisms={'assemblyMeshRange':machinery['assemblyMeshRange'],
                                    'rearVentDrums':[{**scaled_range(r),**{k:r[k] for k in ['label','centerM','radiusM','topYM','bottomYM','axis']}}
                                                     for r in machinery['rearVentDrums']],
                                    'rearVentSlatRanges':[scaled_range(r) for r in machinery['rearVentSlats']],
                                    'ionLowReceiverCoverRanges':[scaled_range(r) for r in machinery['ionReceiverCovers']],
                                    'interiorMechanismEnvelopeExcludedFromCapacitorRoom':True,
                                    'detailReference':'assets/source/capital-turret-reference-'+('6' if bowl else '5')+'.jpg'},
                 frontGunhouseElevates=True,
                 frontPod={'widthM': POD_WIDTHS[profile_count]*scale, 'rearXM': (6+pod_offset_x)*scale,
                           'completeMovingAssemblyWidthM':(moving_bounds[1][2]-moving_bounds[0][2])*scale,
                           'barrelRowSpanM':ROW_SPANS[profile_count]*scale,
                           'mainCaseFrontXM': 5.0*scale, 'frontXM': (16+pod_offset_x)*scale,
                           'forwardOffsetFromTLTwinM':pod_offset_x*scale,
                           'caseBoundsM':[point([6+pod_offset_x,2.8,-POD_WIDTHS[profile_count]/2]), point([16+pod_offset_x,9.65,POD_WIDTHS[profile_count]/2])],
                           'movingMeshRange': scaled_range(pod), 'podMeshRange': scaled_range(pod),
                           'mechanismMeshRange':moving_range,
                           'receiverMeshRange': scaled_range(receiver)},
                 frontConnection={'fixedAxleLabels':[r['label'] for r in fixed_axles],
                                  'fixedStanchionLabels':[r['label'] for r in m.components if r.get('componentRole')=='fixed-bearing-stanchion'],
                                  'movingWheelLabels':[r['label'] for r in drives],
                                  'fixedAxleEngagementM':.30*front_scale*scale,
                                  'recoilSocketClearanceM':.01*front_scale*scale,
                                  'displaySupportStand':False},
                 jointLimits={'yaw':None, 'lo':-10*math.pi/180, 'hi':85*math.pi/180},
                 photoFeatureComponents={'mainCase':[r['label'] for r in fixed_rows+roof_rows],
                                         'frontPod':[pod['label']], 'barrels':[r['label'] for r in barrels]},
                 derivation='Photo-sized 70TT-triple-derived naval case; common per-caliber envelope and narrower front mechanism at lower barrel counts')
    if not bowl:
        reference=json.loads(BEVEL_REFERENCE.read_text())
        supports=[r for r in a['components'] if r.get('componentRole') in ['fixed-bearing-stanchion','fixed-bearing-axle']]
        points=m.points[split[0]:]+[p for row in supports for p in m.points[row['firstVertex']:row['firstVertex']+row['vertices']]]
        support_bounds=F.bounds(points)
        parent,parent_footprint=parent_angular_case_geometry(POD_WIDTHS[profile_count])
        clipped,_=angular_case_geometry(POD_WIDTHS[profile_count])
        shoulder=max((p for p in clipped[0] if abs(p[1]-8.6)<1e-7),key=lambda p:p[2])
        front_normal,front_distance=front_bevel_planes(POD_WIDTHS[profile_count])[0]
        actual_knee=min((p for p in clipped[0] if abs(F.dot(front_normal,p)-front_distance)<1e-7),key=lambda p:p[1])
        a['frontArmorBevel']={
            'referenceFile':str(BEVEL_REFERENCE.relative_to(ROOT)),
            'referenceSha256':hashlib.sha256(BEVEL_REFERENCE.read_bytes()).hexdigest(),
            'imageFile':reference['image']['path'],'imageSha256':reference['image']['sha256'],
            'clipPlanes':[{'normal':n,'distanceM':d*scale} for n,d in front_bevel_planes(POD_WIDTHS[profile_count])],
            'kneeM':[13.5*scale,BEVEL_KNEE_Y*scale],
            'roofM':[(13.5-BEVEL_ROOF_SETBACK)*scale,8.6*scale],
            'sectionCoordinatesRole':'authoring-guide-plane',
            'actualFrontBevelKneeM':[actual_knee[0]*scale,actual_knee[1]*scale],
            'upperShoulderM':point(shoulder),
            'parentCaseHull':{'verticesM':[point(p) for p in parent[0]],'faces':parent[1]},
            'roofRetreatM':BEVEL_ROOF_SETBACK*scale,'lowerSkirtHeightM':BEVEL_KNEE_Y*scale,
            'meshRanges':[scaled_range(r) for r in fixed_rows+roof_rows],
            'supportComponentLabels':a['frontConnection']['fixedStanchionLabels'],
            'completeMechanicalWidthIncludingFixedSupportsM':support_bounds[1][2]-support_bounds[0][2],
            'supportsAddCapacitorRoom':False}
    if front_scale!=1:
        bounds=F.bounds(m.points[pod['firstVertex']:pod['firstVertex']+pod['vertices']])
        a['sameCaliberEnvelopeM']=a['size'][:]
        a['frontPod'].update(widthM=bounds[1][2]-bounds[0][2],rearXM=bounds[0][0],frontXM=bounds[1][0],
                             caseBoundsM=bounds,mainCaseFrontXM=5*scale)
        a['frontBaseRevision']={'baselineCommit':'0ef37aa','uniformFrontHardwareScale':front_scale,
            'pivotM':point(pivot),'baseProfileBarrels':profile_count,'actualBarrels':count,
            'barrelGeometryAndOuterAxesUnchanged':True,'centerBarrelAppendedLast':count==3,
            'barrelInterfacesRecenteredYZ':True,
            'structuralSocketFillAddsCapacitorRoom':False,
            'socketAdaptation':'continuous-closed-case-side-cheeks',
            'socketFillComponentLabels':[r['label'] for r in m.components if r.get('structuralSocketFill')],
            'sharedBaseAsset':'capital_twin175' if profile_count==2 and not ion else None}
        side_rows=[r for r in m.components if r.get('continuousSideArmor')]
        inner=(POD_WIDTHS[profile_count]/2+.85)*front_scale*scale
        old_inner=(POD_WIDTHS[profile_count]/2+.85)*scale
        half_moving=a['frontPod']['completeMovingAssemblyWidthM']/2
        samples=[]
        for sign in [-1,1]:
            for dx in [3.75,4.25,4.75]:
                for dy in [-.4,0,.4]:
                    x=pivot[0]*scale-dx;y=pivot[1]*scale+dy
                    samples.append({'originM':[x,y,sign*(half_moving+.003)],'direction':[0,0,sign],
                                    'expectedHitM':[x,y,sign*inner]})
        a['frontBaseRevision']['sideCaseFill']={
            'componentLabels':[r['label'] for r in side_rows],
            'meshRanges':[scaled_range(r) for r in side_rows],
            'boundsM':[F.bounds(m.points[r['firstVertex']:r['firstVertex']+r['vertices']]) for r in side_rows],
            'innerAbsZM':inner,'originalCaseInnerAbsZM':old_inner,'caseOverlapM':.02*scale,
            'minimumMovingClearanceM':inner-half_moving,'socketRearXM':5*scale,'socketFloorYM':.12*scale,
            'raySamples':samples,'addsCapacitorRoom':False,'preservesOriginalChargingCells':True}
    return a


def build():
    if MEASUREMENTS.exists():
        d = json.loads(MEASUREMENTS.read_text()).get('dimensions', {})
        actual = d.get('angular175SizeM', COMMON_SIZE)
        if actual != REDUCED_175_SIZE:raise ValueError('Generator dimensions do not match the reviewed photographic calibration')
        if d.get('twin720ScaleFromOriginal175Envelope')!=LARGE_SCALE:raise ValueError('720 TT original photo scale has changed')
        if d.get('twin720Original175EnvelopeM')!=COMMON_SIZE:raise ValueError('720 TT original 175 envelope has changed')
        if d.get('twin720SizeM')!=LEGACY_720_SIZE:raise ValueError('720 TT frozen native envelope has changed')
    return {
        'capital_twin175_ion':build_one('ion', '175TT 2連装イオン砲', 2, ion=True,bowl=True,front_scale=FRONT_175_SCALE),
        'capital_twin175':build_one('stl', '175TT 2連装重ターボレーザー',2,front_scale=FRONT_175_SCALE),
        'capital_quad175':build_one('quad175', '175TT 4連装重ターボレーザー',4,front_scale=FRONT_175_SCALE),
        'capital_triple175':build_one('triple175', '175TT 3連装重ターボレーザー',3,profile_count=2,front_scale=FRONT_175_SCALE),
        'capital_twin720':build_one('utl', '720TT 2連装超重ターボレーザー', 2,
                                  scale=ANGULAR_175_SCALE*LARGE_SCALE,bolt_tt=720),
    }


def decode(a):
    raw = base64.b64decode(a['data'])
    n = a['n']
    p = [[struct.unpack_from('<h', raw, i*6+k*2)[0]/65532*a['size'][k]+a['c'][k]
          for k in range(3)] for i in range(n)]
    fmt = '<H' if a['indexBytes'] == 2 else '<I'
    idx = [struct.unpack_from(fmt, raw, n*10+i*a['indexBytes'])[0] for i in range(a['faces']*3)]
    return p, idx


def validate(assets):
    legacy=json.dumps(assets['capital_twin720'],sort_keys=True,separators=(',',':'),ensure_ascii=False)
    if hashlib.sha256(legacy.encode()).hexdigest()!=LEGACY_720_SHA256:
        raise ValueError('720 TT geometry, pivots, rooms or metadata drifted from frozen 0ef37aa')
    twin,triple=assets['capital_twin175'],assets['capital_triple175']
    twin_points,twin_indices=decode(twin);triple_points,triple_indices=decode(triple)
    if triple_points[:len(twin_points)]!=twin_points or triple_indices[:len(twin_indices)]!=twin_indices:
        raise ValueError('Triple175 does not preserve the entire twin175 mesh as its exact prefix')
    for field in ['size','c','mount','elevationPivot','elevationVertexStart','elevationIndexStart','turretCompartment']:
        if twin[field]!=triple[field]:raise ValueError('Twin/triple shared-base mismatch in '+field)
    extra=triple['barrelCenters'][-1]
    if extra['firstVertex']!=twin['n'] or extra['firstIndex']!=twin['faces']*3 or extra['root'][2]!=0:
        raise ValueError('Triple175 must append only one centered complete tube')
    if triple['n']!=twin['n']+extra['vertices'] or triple['faces']*3!=twin['faces']*3+extra['indices']:
        raise ValueError('Triple175 includes geometry beyond the one added center barrel')
    result = F.validate(assets)
    f32 = lambda x: struct.unpack('<f', struct.pack('<f', x))[0]
    for key, a in assets.items():
        expected = LEGACY_720_SIZE if key=='capital_twin720' else REDUCED_175_SIZE
        if any(abs(x-y)>1e-8 for x, y in zip(a['size'], expected)):
            raise ValueError(key+': common photographic envelope changed: '+str(a['size']))
        p, idx = decode(a)
        q = [[f32(f32((v-a['c'][k])/a['size'][k])*a['size'][k]+a['c'][k]-a['mount'][k])
              for k, v in enumerate(row)] for row in p]
        normals = [[0., 0., 0.] for _ in q]
        used = set()
        for i in range(0, len(idx), 3):
            ids = idx[i:i+3]
            normal = F.cross(F.sub(q[ids[1]], q[ids[0]]), F.sub(q[ids[2]], q[ids[0]]))
            if F.dot(normal, normal) < 1e-20:raise ValueError(key+': quantized degenerate triangle '+str(i//3))
            for v in ids:
                used.add(v)
                normals[v] = [f32(x+y) for x, y in zip(normals[v], normal)]
        if len(used) != a['n']:raise ValueError(key+': unreferenced vertices')
        if any(F.dot(v, v) == 0 for v in normals):raise ValueError(key+': zero packed normal')
        clearance = F.moving_case_clearance(p, idx, a, ELEVATION_DEGREES)
        def hit_rows(rows, origin, direction):
            hits=[]
            for row in rows:
                for j in range(row['firstIndex'],row['firstIndex']+row['indices'],3):
                    t=F.ray_triangle(origin,direction,*[p[i] for i in idx[j:j+3]])
                    if t is not None:hits.append(t)
            return min(hits) if hits else math.inf
        shafts=[r for r in a['components'] if r.get('componentRole')=='fixed-bearing-axle']
        case=[r for r in a['components'] if r.get('componentRole')=='fixed-gunhouse']
        socket_fill=[r for r in a['components'] if r.get('structuralSocketFill')]
        stanchions=[r for r in a['components'] if r.get('componentRole')=='fixed-bearing-stanchion']
        for shaft,drive in zip(shafts,a['drivePivots']):
            sign=1 if shaft['centerM'][2]>0 else -1
            sl,sh=F.bounds([p[i] for i in range(shaft['firstVertex'],shaft['firstVertex']+shaft['vertices'])])
            for k in range(16):
                t=k*2*math.pi/16
                x=shaft['centerM'][0]+shaft['radiusM']*.6*math.cos(t)
                y=shaft['centerM'][1]+shaft['radiusM']*.6*math.sin(t)
                start=[x,y,sign*(a['frontPod']['widthM']/2+2*a['prototypeScale'])]
                distance=hit_rows([drive],start,[0,0,-sign])
                z=start[2]-sign*distance
                if not math.isfinite(distance) or not sl[2]+.02*a['prototypeScale']<z<sh[2]-.02*a['prototypeScale']:
                    raise ValueError(key+': axle does not engage the actual circular drive')
                start=[x,y,sign*(a['frontPod']['widthM']/2)]
                distance=hit_rows(case+socket_fill+stanchions,start,[0,0,sign]);z=start[2]+sign*distance
                if not math.isfinite(distance) or not sl[2]+.02*a['prototypeScale']<z<sh[2]-.02*a['prototypeScale']:
                    raise ValueError(key+': axle does not join the actual fixed house')
        for ear in stanchions:
            lo,hi=F.bounds(p[ear['firstVertex']:ear['firstVertex']+ear['vertices']])
            center=[(x+y)/2 for x,y in zip(lo,hi)]
            if key!='capital_twin720':center[2]+=(1 if center[2]>0 else -1)*.45*(hi[2]-lo[2])
            seat_offsets=[-.4,0,.4] if key=='capital_twin720' else [-.32,-.16,0]
            for offset in seat_offsets:
                start=[center[0]+offset*a['prototypeScale'],hi[1]+a['prototypeScale'],center[2]]
                t=hit_rows(case+socket_fill,start,[0,-1,0]);y=start[1]-t
                if not math.isfinite(t) or not lo[1]+.05*a['prototypeScale']<y<hi[1]-.05*a['prototypeScale']:
                    raise ValueError(key+': integral trunnion support floats above the actual shell')
                upper=start[1]-hit_rows([ear],start,[0,-1,0])
                below=[start[0],lo[1]-a['prototypeScale'],start[2]]
                lower=below[1]+hit_rows([ear],below,[0,1,0])
                if not lower+.005*a['prototypeScale']<y<upper-.005*a['prototypeScale']:
                    raise ValueError(key+': case interface does not overlap the actual trunnion support interior')
        # Every exposed fixed machine and the uncredited armored deck is
        # checked as solid hardware too, independently of charging capacity.
        hardware=[]
        for row in a['components']:
            if row['firstIndex']>=a['elevationIndexStart'] or row.get('componentRole') in [
                'fixed-gunhouse','fixed-cast-curved-skin','fixed-yaw-race','fixed-bearing-axle']:
                continue
            low=row['firstVertex'];high=low+row['vertices']
            hardware.append({'label':row['label'],'verticesM':p[low:high],
                             'faces':[[v-low for v in idx[j:j+3]]
                                      for j in range(row['firstIndex'],row['firstIndex']+row['indices'],3)]})
        hardware_clearance=F.moving_case_clearance(p,idx,{**a,'turretCompartment':{'convexes':hardware}},ELEVATION_DEGREES)
        side_fill=a.get('frontBaseRevision',{}).get('sideCaseFill');side_fill_rays=0
        if side_fill:
            rows=[r for r in a['components'] if r.get('continuousSideArmor')]
            if len(rows)!=2:raise ValueError(key+': both continuous side cheeks are required')
            for sample in side_fill['raySamples']:
                origin,direction=sample['originM'],sample['direction']
                expected=math.dist(origin,sample['expectedHitM'])
                hit=hit_rows(rows,origin,direction)
                if not math.isfinite(hit) or abs(hit-expected)>a['maxQuantizationErrorM']*5:
                    raise ValueError(key+': a visible side gap lacks real continuous armor backing')
                case_hit=hit_rows(case,origin,direction)
                case_z=abs(origin[2]+direction[2]*case_hit)
                if not math.isfinite(case_hit) or not side_fill['originalCaseInnerAbsZM']-a['maxQuantizationErrorM']*5<=case_z<side_fill['originalCaseInnerAbsZM']+side_fill['caseOverlapM']:
                    raise ValueError(key+': side cheek does not join the actual original case')
                side_fill_rays+=1
        for sample in a['closedRoof']['coverageSamplesM']:
            start=[sample[0],a['size'][1]+a['prototypeScale'],sample[2]]
            hit=hit_rows([r for r in a['components'] if r['firstIndex']<a['elevationIndexStart']],start,[0,-1,0])
            if abs((start[1]-hit)-sample[1])>a['maxQuantizationErrorM']*3:
                raise ValueError(key+': actual armored roof does not cover a clear independent source sample')
        coverage_samples=len(a['closedRoof']['coverageSamplesM'])
        if a['caseStyle']=='forward-wide-naval-hexagon':
            roof=[r for r in a['components'] if r.get('componentRole')=='fixed-armored-roof']
            lo,hi=a['caseBoundsM'];width=hi[2]-lo[2]
            for ix in range(7):
                for iz in range(7):
                    x=lo[0]+(hi[0]-lo[0])*(.15+.5*ix/6)
                    z=width*.46*(iz/6-.5)
                    start=[x,a['size'][1]+a['prototypeScale'],z]
                    hit=hit_rows(case+roof,start,[0,-1,0])
                    if abs(start[1]-hit-a['closedRoof']['nominalRoofYM'])>a['maxQuantizationErrorM']*3:
                        raise ValueError(key+': closed central/rear roof grid contains a cavity')
                    coverage_samples+=1
        moving_lo,moving_hi=F.bounds(p[a['elevationVertexStart']:])
        moving_width=moving_hi[2]-moving_lo[2]
        if a['barrels']==2 and moving_width>a['size'][2]/2+a['maxQuantizationErrorM']*2:
            raise ValueError(key+': complete twin mechanism is more than half the case width')
        bevel_validation=None
        if 'frontArmorBevel' in a:
            bevel=a['frontArmorBevel'];ranges=bevel['meshRanges'];planes=[]
            mechanical=p[a['elevationVertexStart']:]+[q for row in shafts+stanchions
                for q in p[row['firstVertex']:row['firstVertex']+row['vertices']]]
            ml,mh=F.bounds(mechanical);mechanical_width=mh[2]-ml[2]
            if a['barrels']==2 and mechanical_width>a['size'][2]/2+a['maxQuantizationErrorM']*2:
                raise ValueError(key+': complete twin assembly including fixed supports exceeds half the case width')
            case_points=[p[v] for row in ranges for v in range(row['firstVertex'],row['firstVertex']+row['vertices'])]
            parent=bevel['parentCaseHull'];parent_planes=[]
            for face in parent['faces']:
                x,y,z=[parent['verticesM'][i] for i in face[:3]]
                normal=F.cross(F.sub(y,x),F.sub(z,x));length=math.sqrt(F.dot(normal,normal))
                normal=[v/length for v in normal];distance=F.dot(normal,x)
                if any(F.dot(normal,q)>distance+a['maxQuantizationErrorM']*3 for q in case_points):
                    raise ValueError(key+': front bevel expands outside the original approved parent hull')
                parent_planes.append((normal,distance))
            armor=[r for r in a['components'] if r.get('planarArmorPatch')]
            patch_max_error=0.;backing_rays=0
            solid=case+[r for r in a['components'] if r.get('componentRole')=='fixed-armored-roof']
            for patch in armor:
                normal=patch['supportPlaneM']['normal'];distance=patch['supportPlaneM']['distanceM']
                for field,offset in [('baseFaceVertexRange',patch['baseOffsetM']),('raisedFaceVertexRange',patch['raisedOffsetM'])]:
                    vr=patch[field];points=p[vr['firstVertex']:vr['firstVertex']+vr['vertices']]
                    error=max(abs(F.dot(normal,q)-distance-offset) for q in points)
                    patch_max_error=max(patch_max_error,error)
                    if error>a['maxQuantizationErrorM']*1.2:
                        raise ValueError(key+': packed armor patch is not coplanar with its intended support face')
                vr=patch['raisedFaceVertexRange'];points=p[vr['firstVertex']:vr['firstVertex']+vr['vertices']]
                center=[sum(q[k] for q in points)/len(points) for k in range(3)]
                samples=[center]+[[(x[k]+y[k])/2 for k in range(3)] for x,y in zip(points,points[1:]+points[:1])]
                for q in samples:
                    offset=.3*a['prototypeScale'];start=[q[k]+normal[k]*offset for k in range(3)]
                    hit=hit_rows(solid,start,[-v for v in normal]);clearance=hit-offset
                    if not math.isfinite(hit) or abs(clearance-patch['raisedOffsetM'])>a['maxQuantizationErrorM']*10:
                        raise ValueError(key+': raised armor patch bridges or is buried inside the actual case')
                    backing_rays+=1
            for plane in bevel['clipPlanes']:
                normal,distance=plane['normal'],plane['distanceM']
                epsilon=a['maxQuantizationErrorM']*math.sqrt(F.dot(normal,normal))*3
                if any(F.dot(normal,q)>distance+epsilon for q in case_points):
                    raise ValueError(key+': closed armor/roof extends beyond an annotated bevel plane')
                area=0.;on_plane=[]
                for row in ranges:
                    for j in range(row['firstIndex'],row['firstIndex']+row['indices'],3):
                        tri=[p[v] for v in idx[j:j+3]]
                        if all(abs(F.dot(normal,q)-distance)<=epsilon for q in tri):
                            cross=F.cross(F.sub(tri[1],tri[0]),F.sub(tri[2],tri[0]))
                            area+=math.sqrt(F.dot(cross,cross))/2;on_plane.extend(tri)
                if area<a['prototypeScale']**2 or not on_plane:
                    raise ValueError(key+': annotated bevel is not a meaningful rendered armor surface')
                low,high=F.bounds(on_plane)
                if high[1]-low[1]<4*a['prototypeScale']:
                    raise ValueError(key+': bevel does not span the upper armor corner')
                planes.append({'normal':normal,'distanceM':distance,'renderedAreaM2':area,'verticalSpanM':high[1]-low[1]})
            for corner in a['caseFootprintVerticesM']:
                if min(math.dist(corner,q) for q in case_points)>a['maxQuantizationErrorM']*2:
                    raise ValueError(key+': upper bevel moved a lower skirt footprint corner')
            bevel_validation={'planes':planes,'outsidePlaneVertices':0,
                              'outsideParentHullVertices':0,
                              'planarArmorPatches':len(armor),'maximumPackedPatchPlaneErrorM':patch_max_error,
                              'actualArmorBackingRays':backing_rays,
                              'actualMechanicalWidthIncludingFixedSupportsM':mechanical_width,
                              'lowerFootprintVerticesRetained':len(a['caseFootprintVerticesM'])}
        result[key].update({'triangles':a['faces'], 'triangleLimit':5000,
                            'zeroUsedNormals':0, 'degenerateTriangles':0, 'orphanVertices':0,
                            'wholeCradleClearance':clearance,
                            'exposedFixedHardwareClearance':hardware_clearance,
                            'closedRoofCoverageRaySamples':coverage_samples,
                            'actualCompleteMovingAssemblyWidthM':moving_width,
                            'caseStanchionContactRays':3*len(stanchions),
                            'actualCaseAxleDriveContactRays':32,
                            **({'continuousSideArmorBackingRays':side_fill_rays} if side_fill else {}),
                            **({'frontArmorBevel':bevel_validation} if bevel_validation else {}),
                            'envelopeM':a['size'], 'podWidthM':a['frontPod']['widthM']})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json-output', type=Path, default=Path('/tmp/capital-turret-assets.json'))
    parser.add_argument('--metadata-output', type=Path, default=ROOT/'assets/source/capital-turret-family-manifest.json')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    assets = build()
    validation = validate(assets)
    manifest = {'schemaVersion':1, 'order':ORDER, 'anchorAsset':'isd_heavy_octuple', 'anchorFootprintM':40,
                'angular175SizeM':REDUCED_175_SIZE, '175PrototypeScale':ANGULAR_175_SCALE,
                '720TwinScale':LARGE_SCALE,
                'measurementFile':'assets/source/capital-turret-photo-measurements.json',
                'measurementSha256':hashlib.sha256(MEASUREMENTS.read_bytes()).hexdigest() if MEASUREMENTS.exists() else None,
                'frontBevelReference':{'path':str(BEVEL_REFERENCE.relative_to(ROOT)),
                                       'sha256':hashlib.sha256(BEVEL_REFERENCE.read_bytes()).hexdigest(),
                                       'image':json.loads(BEVEL_REFERENCE.read_text())['image']},
                'validation':validation,
                'assets':{k:{**{p:v for p, v in a.items() if p != 'data'},
                              'packedSha256':hashlib.sha256(base64.b64decode(a['data'])).hexdigest()}
                          for k, a in assets.items()}}
    if args.check:
        current = F.registry(ROOT/'data/reference.js')
        if any(current.get(k) != v for k, v in assets.items()):raise SystemExit('Capital turret registrations are stale')
        if not args.metadata_output.exists() or json.loads(args.metadata_output.read_text()) != manifest:
            raise SystemExit('Capital turret generation manifest is stale')
    else:
        args.json_output.write_text(json.dumps(assets, ensure_ascii=False, separators=(',', ':'))+'\n')
        args.metadata_output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(validation, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
