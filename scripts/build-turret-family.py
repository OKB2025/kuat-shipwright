#!/usr/bin/env python3
"""Reconstruct the nine stand-free turret houses in the user's scale lineup.

Only the standard library is used. The ISD octuple's round footprint is the
40 m reference; the four 40 TT variants follow the common side-view photograph.
DBY-827 is an independent 28.8619917 m reference for the 70 TT family. Blank
display cylinders, faceted plinths and external support stands are not modeled.
Closed metre-space gunhouse convexes are exported with the visible meshes so
the game can reserve their real exterior volume before cutting into a hull.
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
OCTUPLE_LENGTH_M = 40.0
DBY_LENGTH_M = 28.861991732993026
FAMILY_ORDER = ['family_single40', 'family_twin40_dome', 'family_twin40_box',
                'family_triple40', 'isd_heavy_octuple', 'ven_turret70_native',
                'family_triple70', 'family_quad70_side', 'family_quad40_ion']


def add(a, b):
    return [a[i]+b[i] for i in range(3)]


def sub(a, b):
    return [a[i]-b[i] for i in range(3)]


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def bounds(points):
    return [[min(p[k] for p in points) for k in range(3)],
            [max(p[k] for p in points) for k in range(3)]]


def triangle_volume(vertices, faces):
    return abs(sum(dot(vertices[t[0]], cross(vertices[t[1]], vertices[t[2]]))
                   for t in faces)/6)


class Mesh:
    def __init__(self):
        self.points, self.uvs, self.indices = [], [], []
        self.components, self.compartments = [], []

    def mark(self):
        return len(self.points), len(self.indices)

    def record(self, start, label, **kwargs):
        first, index = start
        row = {'label': label, 'firstVertex': first, 'vertices': len(self.points)-first,
               'firstIndex': index, 'indices': len(self.indices)-index, **kwargs}
        self.components.append(row)
        return row

    def face(self, points):
        first = len(self.points)
        self.points.extend([list(p) for p in points])
        self.uvs.extend([(int(i % 2)*65535, int(i//2 % 2)*65535) for i in range(len(points))])
        for i in range(1, len(points)-1):
            self.indices.extend([first, first+i, first+i+1])

    def convex(self, vertices, polygons, label, compartment=False):
        start = self.mark()
        center = [sum(p[k] for p in vertices)/len(vertices) for k in range(3)]
        triangles = []
        for polygon in polygons:
            polygon = list(polygon)
            p, q, r = [vertices[i] for i in polygon[:3]]
            face_center = [sum(vertices[i][k] for i in polygon)/len(polygon) for k in range(3)]
            if dot(cross(sub(q, p), sub(r, p)), sub(face_center, center)) < 0:
                polygon.reverse()
            self.face([vertices[i] for i in polygon])
            triangles.extend([[polygon[0], polygon[i], polygon[i+1]] for i in range(1, len(polygon)-1)])
        row = self.record(start, label, compartment=compartment)
        if compartment:
            self.compartments.append({'label': label, 'verticesM': vertices, 'faces': triangles,
                                      'volumeM3': triangle_volume(vertices, triangles),
                                      'meshRange': {k: row[k] for k in ['firstVertex', 'vertices', 'firstIndex', 'indices']}})
        return row

    def prism(self, profile, z0, z1, label, compartment=False):
        n = len(profile)
        vertices = [[x, y, z] for z in [z0, z1] for x, y in profile]
        polygons = [list(range(n-1, -1, -1)), list(range(n, n*2))]
        polygons.extend([[i, (i+1) % n, (i+1) % n+n, i+n] for i in range(n)])
        return self.convex(vertices, polygons, label, compartment)

    def box(self, low, high, label, compartment=False):
        x0, y0, z0 = low
        x1, y1, z1 = high
        return self.prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, label, compartment)

    def cylinder(self, center, radius, depth, axis, label, segments=40):
        start = self.mark()
        a = (axis+1) % 3
        b = (axis+2) % 3
        rings = []
        for offset in [-depth/2, depth/2]:
            ring = []
            for i in range(segments):
                p = list(center)
                p[axis] += offset
                p[a] += radius*math.cos(2*math.pi*i/segments)
                p[b] += radius*math.sin(2*math.pi*i/segments)
                ring.append(p)
            rings.append(ring)
        self.face(list(reversed(rings[0])))
        self.face(rings[1])
        for i in range(segments):
            j = (i+1) % segments
            self.face([rings[0][i], rings[0][j], rings[1][j], rings[1][i]])
        return self.record(start, label)

    def dome(self, radius, floor, label, compartment=True, segments=32, levels=10):
        # Convex upper hemisphere; its broad lower face is the actual gunhouse
        # floor. A blank cylindrical display pedestal is deliberately absent.
        vertices = []
        for j in range(levels):
            t = math.pi/2*j/levels
            y, r = floor+radius*math.sin(t), radius*math.cos(t)
            vertices.extend([[r*math.cos(2*math.pi*i/segments), y,
                              r*math.sin(2*math.pi*i/segments)] for i in range(segments)])
        vertices.append([0, floor+radius, 0])
        polygons = [list(reversed(range(segments)))]
        for j in range(levels-1):
            for i in range(segments):
                nxt = (i+1) % segments
                polygons.append([j*segments+i, j*segments+nxt, (j+1)*segments+nxt, (j+1)*segments+i])
        top = len(vertices)-1
        for i in range(segments):
            polygons.append([(levels-1)*segments+i, (levels-1)*segments+(i+1) % segments, top])
        return self.convex(vertices, polygons, label, compartment)

    def closed_radial_house(self, profile, label, segments=32):
        """A closed shallow armored tub, not a blank pedestal or open ring."""
        vertices = [[r*math.cos(2*math.pi*i/segments), y,
                     r*math.sin(2*math.pi*i/segments)]
                    for r, y in profile for i in range(segments)]
        polygons = [list(reversed(range(segments))),
                    list(range((len(profile)-1)*segments, len(profile)*segments))]
        for j in range(len(profile)-1):
            for i in range(segments):
                nxt=(i+1)%segments
                polygons.append([j*segments+i,j*segments+nxt,(j+1)*segments+nxt,(j+1)*segments+i])
        return self.convex(vertices,polygons,label,True)

    def ball(self, center, radius, label, segments=32, levels=16):
        # A closed mechanical mantlet, not credited as inhabitable gunhouse.
        start = self.mark()
        rings = []
        for j in range(levels+1):
            t = -math.pi/2+math.pi*j/levels
            ring = []
            for i in range(segments):
                p = [center[0]+radius*math.cos(t)*math.cos(2*math.pi*i/segments),
                     center[1]+radius*math.sin(t),
                     center[2]+radius*math.cos(t)*math.sin(2*math.pi*i/segments)]
                ring.append(p)
            rings.append(ring)
        for j in range(levels):
            for i in range(segments):
                nxt = (i+1) % segments
                self.face([rings[j][i], rings[j][nxt], rings[j+1][nxt], rings[j+1][i]])
        return self.record(start, label)

    def barrel(self, root_x, tip_x, y, z, radius, label, bore_ratio=.66, segments=36):
        start = self.mark()
        length = tip_x-root_x
        # Stepped breech, narrow collars and an open annular muzzle. Each tube
        # is one closed connected surface, including the recessed bore floor.
        shank_start = root_x+length*.28
        recess = max(radius*1.5, length*.035)
        profile = [(root_x, 0), (root_x, radius*2.2),
                   (root_x+length*.06, radius*2.2),
                   (root_x+length*.06, radius*1.75),
                   (root_x+length*.18, radius*1.75),
                   (root_x+length*.18, radius*1.45),
                   (shank_start, radius), (root_x+length*.63, radius),
                   (root_x+length*.63, radius*1.14),
                   (root_x+length*.65, radius*1.14),
                   (root_x+length*.65, radius), (tip_x-radius*.8, radius),
                   (tip_x-radius*.8, radius*1.1), (tip_x, radius*1.1),
                   (tip_x, radius*bore_ratio), (tip_x-recess, radius*bore_ratio),
                   (tip_x-recess, 0)]
        rings = []
        for x, r in profile:
            if r == 0:
                rings.append([len(self.points)])
                self.points.append([x, y, z]);self.uvs.append((0, 32768))
            else:
                ring = []
                for i in range(segments):
                    t = 2*math.pi*i/segments
                    ring.append(len(self.points));self.points.append([x, y+r*math.cos(t), z+r*math.sin(t)])
                    self.uvs.append((round((x-root_x)/length*65535), round(i/segments*65535)))
                rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for i in range(segments):
                j = (i+1) % segments
                if len(a) == 1:self.indices.extend([a[0], b[j], b[i]])
                elif len(b) == 1:self.indices.extend([a[i], a[j], b[0]])
                else:self.indices.extend([a[i], a[j], b[j], a[i], b[j], b[i]])
        return self.record(start, label, root=[root_x, y, z], muzzle=[tip_x, y, z],
                           centerM=[(root_x+tip_x)/2, y, z], axis=[1, 0, 0],
                           outerRadiusM=radius*1.1, boreRadiusM=radius*bore_ratio,
                           muzzleRecessM=recess, exposedStartX=shank_start)


def thin_turntable(m, radius):
    m.cylinder([0, .16, 0], radius, .32, 1, 'intrinsic bearing ring', 64)
    m.cylinder([0, .35, 0], radius*.95, .14, 1, 'bearing race lip', 64)


def drives(m, x, y, z, radius, thickness=.55):
    rows = []
    for sign in [-1, 1]:
        center = [x, y, sign*z]
        row = m.cylinder(center, radius, thickness, 2, 'elevation drive housing', 48)
        row.update(centerM=center, axis=[0, 0, 1], radiusM=radius)
        rows.append(row)
        m.cylinder([x, y, sign*(z+thickness*.56)], radius*.73, thickness*.18, 2, 'drive inset ring', 48)
        m.cylinder([x, y, sign*(z+thickness*.68)], radius*.58, thickness*.12, 2, 'drive central cover', 48)
    return rows


def ribs(m, x0, count, spacing, top, z0, z1, height=.18):
    for i in range(count):
        x = x0+i*spacing
        m.box([x, top, z0], [x+.14, top+height, z1], 'roof stiffener')


def bevel_house(m, profile, width, label='closed armored gunhouse'):
    return m.prism(profile, -width/2, width/2, label, True)


def finish(m, kind, title, output, pivot, barrels, split, drives_meta, scale, **extra):
    # Uniform scaling preserves real circular bores and all metadata points.
    m.points = [[v*scale for v in p] for p in m.points]
    for compartment in m.compartments:
        compartment['verticesM'] = [[v*scale for v in p] for p in compartment['verticesM']]
        compartment['volumeM3'] *= scale**3
    for row in barrels:
        for key in ['root', 'muzzle', 'centerM']:
            row[key] = [v*scale for v in row[key]]
        for key in ['outerRadiusM', 'boreRadiusM', 'muzzleRecessM', 'exposedStartX']:
            if row[key] is not None:row[key] *= scale
    for row in drives_meta:
        row['centerM'] = [v*scale for v in row['centerM']]
        row['radiusM'] *= scale
        for key in ['caseOuterSideM', 'innerFaceAbsZM', 'outerFaceAbsZM',
                    'caseSideClearanceM', 'uniformSourceScale']:
            if key in row:row[key] *= scale
    for row in m.components:
        if 'normalCenterM' in row:row['normalCenterM']=[v*scale for v in row['normalCenterM']]
        if 'floorYM' in row:row['floorYM']*=scale
    pivot = [v*scale for v in pivot]
    low, high = bounds(m.points)
    size = [high[k]-low[k] for k in range(3)]
    center = [(high[k]+low[k])/2 for k in range(3)]
    n = len(m.points);index_bytes = 2 if n < 65536 else 4
    packed = bytearray()
    for point in m.points:
        for k in range(3):packed.extend(struct.pack('<h', round((point[k]-center[k])/size[k]*65532)))
    for pair in m.uvs:packed.extend(struct.pack('<HH', *pair))
    for i in m.indices:packed.extend(struct.pack('<H' if index_bytes == 2 else '<I', i))
    error = max(math.dist(point, [struct.unpack_from('<h', packed, i*6+k*2)[0]/65532*size[k]+center[k]
                                  for k in range(3)]) for i, point in enumerate(m.points))
    asset = {'title': title, 'kind': 'fit', 'plainMetal': True,
             'source': 'User-supplied Imperial and turret-family reference photographs; parametric reconstruction',
             'nativeCalibration': 'imperial-photo-family', 'catalogKind': kind,
             'n': n, 'faces': len(m.indices)//3, 'indexBytes': index_bytes,
             'c': center, 'size': size, 'mount': [0, 0, 0],
             'forward': [1, 0, 0], 'up': [0, 1, 0], 'bounds': [low, high],
             'barrels': len(barrels), 'boltTT': output, 'volleyTT': output*len(barrels),
             'barrelCenters': barrels, 'muzzlePoints': [row['muzzle'] for row in barrels],
             'barrelAxis': [1, 0, 0], 'elevationAxis': [0, 0, 1], 'elevationPivot': pivot,
             'elevationVertexStart': split[0], 'elevationIndexStart': split[1],
             'housingVertices': split[0], 'housingFaces': split[1]//3,
             'drivePivots': drives_meta, 'noSupportPedestal': True, 'supportStandHeightM': 0,
             'turretCompartment': {'version': 1, 'role': 'gunhouse', 'convexes': m.compartments,
                                    'volumeM3': sum(c['volumeM3'] for c in m.compartments),
                                    'excludes': ['barrels', 'cradles', 'drive gears', 'bearing rings', 'display stands']},
             'components': m.components, 'maxQuantizationErrorM': error,
             'data': base64.b64encode(packed).decode('ascii'), **extra}
    if 'photoFeatureComponents' in extra:
        features={}
        for key,labels in extra['photoFeatureComponents'].items():
            selected=[row for row in m.components if row['label'] in labels]
            vertices=[p for row in selected for p in m.points[row['firstVertex']:row['firstVertex']+row['vertices']]]
            if not vertices:raise ValueError('Empty photo feature '+key)
            features[key]={'componentLabels':labels,'boundsM':bounds(vertices)}
        asset['photoGeometryFeaturesM']=features
    original_id=extra.get('derivedFrom')
    if original_id:
        original=sources()[original_id]['asset']
        for key in ['source','sourceUrl','authorUrl','license','licenseUrl']:
            if key in original:asset[key]=original[key]
    return asset


def moving_guns(m, rows, pivot, radius, root_x, muzzle_x, cradle_depth=.7):
    # Common armored cradle connects each barrel root to the mechanical axis;
    # all its triangles belong to the same moving partition as the tubes.
    for y, z in rows:
        y0=min(pivot[1]-.45,y-.7);y1=max(pivot[1]+.45,y+.1)
        m.prism([[pivot[0]-1.3,y0+.2],[root_x+2.3,y0],
                 [root_x+3.0,y0+.55],[root_x+3.0,y1-.25],
                 [root_x+2.2,y1],[pivot[0]-1.3,y1]],
                z-cradle_depth,z+cradle_depth,'elevating armored cradle')
    return [m.barrel(root_x, muzzle_x, y, z, radius, 'barrel '+str(i+1)) for i, (y, z) in enumerate(rows)]


# Original source meshes are immutable model anchors and reusable mechanical
# parts. Derivatives resize machinery and rearrange complete source components.
_SOURCE_CACHE = None
ANCHOR_COMPARTMENTS = ROOT/'assets/source/turret-family-anchor-compartments.json'


def sources():
    global _SOURCE_CACHE
    if _SOURCE_CACHE is not None:return _SOURCE_CACHE
    import importlib.util
    spec=importlib.util.spec_from_file_location('dby_source_geometry', ROOT/'scripts/build-twin40-turret.py')
    helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
    assets=registry(ROOT/'data/reference.js');assets.update(registry(ROOT/'data/imperial2.js'))
    result={}
    assets['isd_heavy_octuple_original']=json.loads((ROOT/'assets/source/isd-heavy-octuple-original.json').read_text())
    for key in ['isd_heavy_octuple_original','ven_turret']:
        asset=assets[key];data_asset=asset if 'data' in asset else assets[asset['dataFrom']]
        points,uvs,indices,packed=helper.decode(asset,data_asset)
        if key=='ven_turret':points,frame,floor=helper.canonical_frame(points)
        else:
            points=[[p[k]+asset['c'][k] for k in range(3)] for p in points]
            frame=[[1,0,0],[0,1,0],[0,0,1]];floor=0
        result[key]={'asset':asset,'points':points,'uvs':uvs,'indices':indices,
                     'groups':helper.components(points,indices),'frame':frame,
                     'floorCorrection':-floor,'sha256':hashlib.sha256(packed).hexdigest()}
    _SOURCE_CACHE=result
    return result


def source_part(m,source_id,component,transform=lambda p:p,label=None):
    source=sources()[source_id];group=source['groups'][component];members=set(group)
    start=m.mark();mapping={v:len(m.points)+i for i,v in enumerate(group)}
    m.points.extend([transform(source['points'][v][:]) for v in group]);m.uvs.extend([source['uvs'][v] for v in group])
    for i in range(0,len(source['indices']),3):
        tri=source['indices'][i:i+3]
        if tri[0] in members:
            if not all(v in members for v in tri):raise ValueError('Source component crosses a triangle')
            m.indices.extend(mapping[v] for v in tri)
    row=m.record(start,label or 'source mechanical component',sourceAsset=source_id,
                 sourceComponent=component,sourceVertexIndices=group)
    return row


def source_transform(source_id,component,low,high):
    source=sources()[source_id];a,b=bounds([source['points'][i] for i in source['groups'][component]])
    return lambda p:[low[k]+(p[k]-a[k])/(b[k]-a[k])*(high[k]-low[k]) for k in range(3)]


def convex_hull(points):
    # Incremental 3D hull, only used on the small convex machinery case (source
    # component10); no mesh approximation or imported whole-ship geometry.
    unique=[];seen=set()
    for p in points:
        key=tuple(p)
        if key not in seen:seen.add(key);unique.append(p)
    p0=min(range(len(unique)),key=lambda i:unique[i][0]);p1=max(range(len(unique)),key=lambda i:math.dist(unique[i],unique[p0]))
    a=sub(unique[p1],unique[p0]);p2=max(range(len(unique)),key=lambda i:dot(cross(a,sub(unique[i],unique[p0])),cross(a,sub(unique[i],unique[p0]))))
    normal=cross(a,sub(unique[p2],unique[p0]));p3=max(range(len(unique)),key=lambda i:abs(dot(normal,sub(unique[i],unique[p0]))))
    interior=[sum(unique[i][k] for i in [p0,p1,p2,p3])/4 for k in range(3)]
    def orient(face):
        x,y,z=face
        if dot(cross(sub(unique[y],unique[x]),sub(unique[z],unique[x])),sub(interior,unique[x]))>0:return [x,z,y]
        return list(face)
    faces=[orient(f) for f in [(p0,p1,p2),(p0,p3,p1),(p0,p2,p3),(p1,p3,p2)]]
    for i,p in enumerate(unique):
        if i in [p0,p1,p2,p3]:continue
        visible=[]
        for j,(a,b,c) in enumerate(faces):
            n=cross(sub(unique[b],unique[a]),sub(unique[c],unique[a]))
            if dot(n,sub(p,unique[a]))>1e-8*max(1,math.sqrt(dot(n,n))):visible.append(j)
        if not visible:continue
        horizon={}
        for j in visible:
            face=faces[j]
            for a,b in zip(face,face[1:]+face[:1]):
                key=tuple(sorted((a,b)))
                if key in horizon:del horizon[key]
                else:horizon[key]=(a,b)
        faces=[f for j,f in enumerate(faces) if j not in set(visible)]
        faces.extend(orient([a,b,i]) for a,b in horizon.values())
    return unique,faces


def machinery_house(m,low,high):
    # This is the original original normal octuple central machinery case, resized as requested.
    # Its original convex outline is closed into a usable gunhouse; retain the
    # neighboring authored greebles as complete source parts on its roof.
    src=sources()['isd_heavy_octuple_original'];xf=source_transform('isd_heavy_octuple_original',11,low,high)
    points=[xf(src['points'][i]) for i in src['groups'][11]]
    vertices,faces=convex_hull(points)
    row=m.convex(vertices,faces,'resized original normal octuple central machinery case',True)
    row.update(sourceAsset='isd_heavy_octuple_original',sourceComponent=11,derivation='same convex source outline; resized and closed')
    return row


def source_barrel(m,source_id,component,root,axial=1,radial=1,label='source barrel'):
    src=sources()[source_id];group=src['groups'][component];F,U,R=src['frame']
    # Original DBY source tubes are slightly tilted; derivatives rotate their
    # complete geometry into +X, while the preserved anchor keeps the raw pose.
    q={i:[dot(src['points'][i],axis) for axis in [F,U,R]] for i in group}
    low,high=bounds(list(q.values()));cy=(low[1]+high[1])/2;cz=(low[2]+high[2])/2
    transformed={i:[root[0]+(v[0]-low[0])*axial,root[1]+(v[1]-cy)*radial,root[2]+(v[2]-cz)*radial] for i,v in q.items()}
    # The import API receives original vertices; identity-by-value mapping is
    # unambiguous after the source's coincident UV split vertices are joined.
    original_to_target={tuple(src['points'][i]):transformed[i] for i in group}
    row=source_part(m,source_id,component,lambda p:original_to_target[tuple(p)],label)
    muzzle=[root[0]+(high[0]-low[0])*axial,root[1],root[2]]
    tip_radii=[math.hypot(v[1]-cy,v[2]-cz)*radial for v in q.values() if v[0]>high[0]-.001]
    outer=max(tip_radii);bore=min(tip_radii)
    if outer<.01:
        outer=max(math.hypot(v[1]-cy,v[2]-cz)*radial for v in q.values() if v[0]>high[0]-.25);bore=0
    recess=source_bore_recess(m,row,muzzle,[1,0,0])
    row.update(root=root,muzzle=muzzle,centerM=[(root[0]+muzzle[0])/2,root[1],root[2]],axis=[1,0,0],
               outerRadiusM=outer,boreRadiusM=bore,muzzleRecessM=recess,
               muzzleStyle='source-recessed' if recess is not None and recess>.002 else 'source-open-tube' if recess is None else 'source-cap',
               exposedStartX=root[0]+(muzzle[0]-root[0])*.28)
    return row


def source_bore_recess(m,row,muzzle,axis):
    origin=add(muzzle,[v*.5 for v in axis]);direction=[-v for v in axis];best=math.inf
    for j in range(row['firstIndex'],row['firstIndex']+row['indices'],3):
        t=ray_triangle(origin,direction,*[m.points[i] for i in m.indices[j:j+3]])
        if t is not None:best=min(best,t)
    return None if not math.isfinite(best) else max(0,best-.5)


def isd_drives(m,pivot,width,scale=1):
    source=sources()['isd_heavy_octuple_original'];rows=[]
    for component,z in [(4,-width),(8,width)]:
        low,high=bounds([source['points'][i] for i in source['groups'][component]])
        center=[(low[0]+high[0])/2,low[1],(low[2]+high[2])/2]
        radial=scale*.45
        xf=lambda p,c=center,z=z:[pivot[0]+(p[0]-c[0])*radial,pivot[1]+(p[1]-c[1])*radial,z+(p[2]-c[2])*.7/(high[2]-low[2])]
        row=source_part(m,'isd_heavy_octuple_original',component,xf,'original normal40 circular elevation bearing')
        row.update(centerM=[pivot[0],pivot[1],z],axis=[0,0,1],radiusM=(high[0]-low[0])*radial/2)
        rows.append(row)
    return rows


def isd_receiver(m,pivot,width_scale=1,vertical_scale=1,offset_z=0):
    source=sources()['isd_heavy_octuple_original']
    a,b=bounds([source['points'][i] for i in source['groups'][4]])
    c,d=bounds([source['points'][i] for i in source['groups'][2]])
    old=[(a[0]+b[0])/2,a[1],(c[2]+d[2])/2]
    xf=lambda p:[pivot[0]+p[0]-old[0],pivot[1]+(p[1]-old[1])*vertical_scale*.42,offset_z+(p[2]-old[2])*width_scale]
    for component in [2,3]:source_part(m,'isd_heavy_octuple_original',component,xf,'original normal40 four-port receiver resized for barrel count')


def isd_roof_details(m,low,high):
    # Complete source service rails/hatches stay together instead of arbitrary
    # decorative boxes replacing the reference's central equipment.
    source_part(m,'isd_heavy_octuple_original',9,source_transform('isd_heavy_octuple_original',9,low,high),'original normal octuple central equipment roof hatch')


def normal40_barrel_scale():
    # The selected 40 TT derivatives use the exact original octuple barrel
    # profile and physical size. Authoring units differ from the anchor's.
    return 34.56475644/sources()['isd_heavy_octuple_original']['asset']['size'][0]


def common40_rear_case(m,scale):
    """One shared lower equipment case and complete rear upper gun case."""
    m0=m.mark();thin_turntable(m,4.8)
    lower=machinery_house(m,[-10.6,.38,-5.1],[5.1,4.85,5.1])
    isd_roof_details(m,[-9.6,4.85,-3.7],[-4.7,5.2,3.7])
    source=sources()['isd_heavy_octuple_original']
    gear_lo,gear_hi=bounds([source['points'][i] for i in source['groups'][8]])
    case_lo,case_hi=bounds([source['points'][i] for i in source['groups'][2]])
    original_pivot=[(gear_lo[0]+gear_hi[0])/2,gear_lo[1],(case_lo[2]+case_hi[2])/2]
    unit_xy,unit_z=1.05,1.05*.75
    pivot=[-10.6-(case_lo[0]-original_pivot[0])*unit_xy,4.35,0]
    def transform(p):
        return [pivot[0]+(p[0]-original_pivot[0])*unit_xy,
                pivot[1]+(p[1]-original_pivot[1])*unit_xy,
                (p[2]-original_pivot[2])*unit_z]
    # The rear/side walls are part of the shared case itself. Extend them
    # into the sloping equipment roof, without adding a separate pedestal or
    # shifting any gun, receiver, wheel or articulation point.
    original_upper_points=[transform(source['points'][i]) for i in source['groups'][2]]
    original_upper_low,original_upper_high=bounds(original_upper_points)
    def case_transform(p):
        q=transform(p)
        q[1]=pivot[1]+(q[1]-original_upper_low[1])/(original_upper_high[1]-original_upper_low[1])*(original_upper_high[1]-pivot[1])
        return q
    upper=source_part(m,'isd_heavy_octuple_original',2,case_transform,'complete large normal40 upper armored gun case with integral rear wall')
    # Reuse the previously validated concave original gunhouse decomposition,
    # not its bounding box or a convex hull that would fill its real recesses.
    payload=json.loads(ANCHOR_COMPARTMENTS.read_text())['isd_heavy_octuple_original']
    selected=[]
    for index,cell in enumerate(payload['convexes']):
        lo,hi=bounds(cell['verticesM'])
        if not all(lo[k]>=case_lo[k]-.002 and hi[k]<=case_hi[k]+.002 for k in range(3)):continue
        vertices=[case_transform(p) for p in cell['verticesM']];faces=cell['faces']
        vertices,faces=clipped_convex(vertices,faces,1,4.851,False)
        m.compartments.append({'label':'shared normal40 upper case cell '+str(index),
            'verticesM':vertices,'faces':faces,'volumeM3':triangle_volume(vertices,faces),
            'conservative':True,'sourceAsset':'isd_heavy_octuple_original','sourceComponent':2,
            'sourceCompartmentCell':index,'sourceMeshRange':{k:upper[k] for k in ['firstVertex','vertices','firstIndex','indices']}})
        selected.append(index)
    if not selected:raise ValueError('Original upper gun case has no validated closed cells')
    fixed_case={'points':m.points[m0[0]:],'indices':m.indices[m0[1]:]}
    shared={'key':'normal40-complete-rear-upper-case','upperSourceComponent':2,'lowerSourceComponent':11,
            'sourceAsset':'isd_heavy_octuple_original','sourceFourPortConversion':3,
            'meshRange':{'firstVertex':m0[0],'vertices':len(m.points)-m0[0],'firstIndex':m0[1],'indices':len(m.indices)-m0[1]},
            'geometrySha256':hashlib.sha256(json.dumps(fixed_case,separators=(',',':')).encode()).hexdigest(),
            'caseVolumeM3':sum(c['volumeM3'] for c in m.compartments)*scale**3,
            'upperCaseConservativeCells':selected,'upperUnitScaleXY':unit_xy,'upperUnitScaleZ':unit_z,
            'upperCaseRearXM':-10.6*scale,
            'integralRearCaseWall':True,'upperCaseOldBottomYM':original_upper_low[1]*scale,
            'upperCaseBottomYM':pivot[1]*scale,'upperCaseRoofYM':original_upper_high[1]*scale,
            'closedCellFloorAboveLowerCaseYM':4.851*scale}
    upper_points=m.points[upper['firstVertex']:upper['firstVertex']+upper['vertices']]
    return {'pivot':pivot,'sourcePivot':original_pivot,'unitXY':unit_xy,'unitZ':unit_z,
            'transform':transform,'shared':shared,'upperBounds':bounds(upper_points),
            'sourceUpperBounds':[original_upper_low,original_upper_high]}


def large_normal40_mantlet(m,context):
    source=sources()['isd_heavy_octuple_original'];pivot=context['pivot'];sxy=context['unitXY'];sz=context['unitZ']
    # A complete source pod's two large circular cheeks, without the other
    # four-gun pod or a fabricated lower stand.
    width=4.0*sz;rows=[]
    for component,z in [(8,-width),(4,width)]:
        lo,hi=bounds([source['points'][i] for i in source['groups'][component]])
        center=[(lo[0]+hi[0])/2,lo[1],(lo[2]+hi[2])/2]
        def xf(p,c=center,z=z):return [pivot[0]+(p[0]-c[0])*sxy,pivot[1]+(p[1]-c[1])*sxy,z+(p[2]-c[2])*sz]
        row=source_part(m,'isd_heavy_octuple_original',component,xf,'complete large source normal40 circular mantlet cheek')
        row.update(centerM=[pivot[0],pivot[1],z],axis=[0,0,1],radiusM=(hi[0]-lo[0])*sxy/2)
        rows.append(row)
    return rows


def full_dby_outboard40_drives(m,pivot,scale,case_half_width=5.1,clearance=.20):
    source=sources()['ven_turret'];old=sources()['isd_heavy_octuple_original']
    old_lo,old_hi=bounds([old['points'][i] for i in old['groups'][4]])
    target_radius=(old_hi[0]-old_lo[0])/2*1.28*.45
    rows=[];centers=[]
    for component,sign in [(1,-1),(3,1)]:
        low,high=bounds([source['points'][i] for i in source['groups'][component]])
        center=[(low[k]+high[k])/2 for k in range(3)]
        source_radius=max((high[0]-low[0])/2,(high[1]-low[1])/2)
        uniform=target_radius/source_radius
        half_depth=(high[2]-low[2])*uniform/2
        outboard=case_half_width+clearance+half_depth;z=sign*outboard
        def xf(p,c=center,z=z,s=uniform):return [pivot[0]+(p[0]-c[0])*s,pivot[1]+(p[1]-c[1])*s,z+(p[2]-c[2])*s]
        row=source_part(m,'ven_turret',component,xf,'complete external full-circle DBY-827 trunnion')
        row.update(centerM=[pivot[0],pivot[1],z],axis=source['frame'][2],radiusM=target_radius,
                   completeSourceComponent=True,uniformSourceScale=uniform,
                   caseOuterSideM=case_half_width*scale,innerFaceAbsZM=(case_half_width+clearance)*scale,
                   outerFaceAbsZM=(outboard+half_depth)*scale,caseSideClearanceM=clearance*scale)
        rows.append(row);centers.append(z)
        # This short horizontal axle links the case to the external assembly;
        # it is a mechanical shaft, never an under-turret support pedestal.
        upper_side=2.10
        m.cylinder([pivot[0],pivot[1],sign*(upper_side+case_half_width+clearance)/2],.46,
                   case_half_width+clearance-upper_side+.04,2,'external trunnion horizontal axle',40)
    return rows,centers


DEFAULT_FORTY_SCALE=OCTUPLE_LENGTH_M/34.56475644


def physical40_barrel(m,root,length,label):
    src=sources()['isd_heavy_octuple_original'];lo,hi=bounds([src['points'][i] for i in src['groups'][15]])
    return source_barrel(m,'isd_heavy_octuple_original',15,root,length/(hi[0]-lo[0]),
                         OCTUPLE_LENGTH_M/src['asset']['size'][0],label)


def complete_photo_drives(m,pivot,case_half_width,diameter,label,clearance=.20):
    src=sources()['ven_turret'];rows=[];centers=[]
    for component,sign in [(1,-1),(3,1)]:
        lo,hi=bounds([src['points'][i] for i in src['groups'][component]])
        c=[(lo[k]+hi[k])/2 for k in range(3)];unit=diameter/max(hi[0]-lo[0],hi[1]-lo[1])
        half_depth=(hi[2]-lo[2])*unit/2;z=sign*(case_half_width+clearance+half_depth)
        xf=lambda p,c=c,z=z,u=unit:[pivot[0]+(p[0]-c[0])*u,pivot[1]+(p[1]-c[1])*u,z+(p[2]-c[2])*u]
        row=source_part(m,'ven_turret',component,xf,label+(' port' if sign<0 else ' starboard'))
        row.update(centerM=[pivot[0],pivot[1],z],axis=[0,0,1],radiusM=diameter/2,
                   completeSourceComponent=True,uniformSourceScale=unit,caseOuterSideM=case_half_width,
                   innerFaceAbsZM=case_half_width+clearance,outerFaceAbsZM=abs(z)+half_depth,
                   caseSideClearanceM=clearance)
        rows.append(row);centers.append(z)
        m.cylinder([pivot[0],pivot[1],sign*(abs(z)+half_depth+.06)],diameter*.105,.14,2,
                   label+' central hexagonal axle bolt',6)
        m.cylinder([pivot[0],pivot[1],sign*(case_half_width+.12)],.43,.32,2,label+' connecting axle',32)
    return rows,centers


def photo_roof_detail(m,low,high,label='original normal40 roof inspection hatch'):
    return source_part(m,'isd_heavy_octuple_original',9,
                       source_transform('isd_heavy_octuple_original',9,low,high),label)


def photo_receiver(m,root,z,width=1.3,label='photo40 angular recoil cradle'):
    # The visible breech is a stepped, bevelled receiver, not a scaled solid
    # wedge covering the entire equipment case between the wheels.
    x,y=root
    m.prism([[x-5.0,y-2.0],[x+.6,y-2.0],[x+1.4,y-1.1],
             [x+1.1,y+.6],[x-.8,y+1.1],[x-4.2,y+1.1],[x-5.0,y+.3]],
            z-width,z+width,label)
    photo_roof_detail(m,[x-4.0,y+.98,z-width*.68],[x-1.5,y+1.25,z+width*.68],label+' roof service rail')
    ribs(m,x-1.4,4,.50,y+.65,z-width*.82,z+width*.82,.12)


def finish_photo40(m,kind,title,pivot,barrels,split,drive,scale,features,**extra):
    # All four photo40 gunhouses reuse complete DBY circular drive assemblies.
    # Preserve this second source's attribution alongside the normal40 parent.
    extra.setdefault('additionalSourceAssets',['ven_turret'])
    extra.setdefault('additionalSourceReferences',[{k:v for k,v in sources()['ven_turret']['asset'].items()
                     if k in ['source','sourceUrl','authorUrl','license','licenseUrl']}])
    return finish(m,kind,title,40,pivot,barrels,split,drive,scale/DEFAULT_FORTY_SCALE,
                  derivedFrom='isd_heavy_octuple_original',materialReference='isd_heavy_octuple',
                  photoMeasurements='assets/source/turret-photo-measurements.json',
                  photoFeatureComponents=features,barrelCrossSectionPreservedFrom='isd_heavy_octuple_original',
                  **extra)


def build_single40(scale):
    m=Mesh();thin_turntable(m,4.3)
    lower=m.prism([[-10.1,.4],[10.1,.4],[10.1,2.9],[8.0,4.1],[-8.5,4.8],[-10.1,3.5]],
                  -3.8,3.8,'single40 lower armored gunhouse',True)
    hood=m.prism([[-10.1,4.8],[-10.1,5.2],[-6.8,8.1],[-2.5,8.1],[.8,4.8]],
                 -3.0,3.0,'single40 raised rear breech case',True)
    photo_roof_detail(m,[-8.6,7.8,-1.5],[-5.1,8.25,1.5])
    pivot=[-2.7,3.5,0];d,z=complete_photo_drives(m,pivot,3.8,4.5,'single40 complete circular trunnion')
    split=m.mark();root=[-1.2,6.2,0]
    photo_receiver(m,root[:2],0,1.15,'single40 angular recoil cradle')
    b=[physical40_barrel(m,root,25.7,'40TT single photo-length source barrel')]
    return finish_photo40(m,'single40','40TT 単装ターボレーザー',pivot,b,split,d,scale,
                         {'case':[lower['label'],hood['label']],'wheel':[d[0]['label']]},
                         derivation='photo1 single with full-height angular rear case, compact trunnion and long slender barrel')


def build_dome40(scale):
    m=Mesh();thin_turntable(m,13.75)
    dome=m.dome(13.75,.4,'hemispherical combined bearing gunhouse',True,64,24)
    dome.update(normalMode='sphere',normalCenterM=[0,.4,0],floorYM=.4)
    pivot=[.5,12.6,0];d,z=complete_photo_drives(m,pivot,1.7,4.5,'dome40 central circular bearing')
    split=m.mark()
    photo_receiver(m,[2.5,15.1],0,2.1,'dome40 central twin recoil cradle')
    b=[physical40_barrel(m,[2.5,15.1,z],14.6,'40TT dome photo-length source barrel') for z in [-1.0,1.0]]
    return finish_photo40(m,'twin40Dome','40TT 半球型2連装ターボレーザー',pivot,b,split,d,scale,
                         {'case':[dome['label']],'hemisphere':[dome['label']],'wheel':[d[0]['label']]},
                         derivation='photo1 broad hemisphere with the complete compact bearing and twin-gun mechanism centered in its crown')


def split_convex_axis(cell,axis,limit):
    if cell is None:return None,None
    V,F=cell;lo=min(p[axis] for p in V);hi=max(p[axis] for p in V)
    if hi<=limit+1e-9:return cell,None
    if lo>=limit-1e-9:return None,cell
    return clipped_convex(V,F,axis,limit),clipped_convex(V,F,axis,limit,False)


def convex_without_box(cell,low,high):
    remaining=cell;pieces=[]
    for axis in range(3):
        below,remaining=split_convex_axis(remaining,axis,low[axis])
        if below is not None:pieces.append(below)
        remaining,above=split_convex_axis(remaining,axis,high[axis])
        if above is not None:pieces.append(above)
    return pieces


def clip_skin_polygon(poly,axis,limit,lower):
    if not poly:return []
    distance=lambda p:(p[axis]-limit)*(1 if lower else -1)
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da,db=distance(a),distance(b);inside_a=da<=1e-9;inside_b=db<=1e-9
        if inside_a:out.append(a)
        if inside_a!=inside_b:
            t=da/(da-db);out.append([a[k]+(b[k]-a[k])*t for k in range(3)])
    return out


def common_photo40_case(m):
    # Both mounts have the SAME fixed armor frame and side profile. The centre
    # is a real recoil bay, not an opaque roof intersected by the moving gun.
    start=m.mark();thin_turntable(m,6.3);raw=Mesh()
    raw.prism([[-11.25,.4],[11.25,.4],[11.25,3.6],[9.25,5.2],[-9.65,5.2],[-11.25,3.8]],
              -6.5,6.5,'photo40 common lower equipment case',True)
    raw.prism([[-11.25,5.2],[-11.25,9.9],[-9.75,11.4],[-2.4,11.4],[.5,9.6],[.5,5.2]],
              -5.5,5.5,'photo40 common rear armored hood',True)
    raw.prism([[.5,5.2],[9.25,5.2],[7.65,7.0],[.5,9.6]],
              -5.5,5.5,'photo40 common forward sloped hood',True)
    bay_low,bay_high=[-9.9,.7,-4.9],[6.2,11.6,4.9];labels=[]
    for source in raw.compartments:
        for i,(V,F) in enumerate(convex_without_box((source['verticesM'],source['faces']),bay_low,bay_high)):
            row=m.convex(V,F,source['label']+' frame cell '+str(i),True);labels.append(row['label'])
    for sign in [-1,1]:
        z0,z1=sorted([sign*4.95,sign*5.45])
        photo_roof_detail(m,[-8.8,11.28,z0],[-5.0,11.7,z1],
                          'photo40 common shoulder service hatch')
        z=sign*5.56
        m.prism([[-8.9,7.4],[-1.6,7.4],[-1.6,8.2],[-8.2,8.8]],
                min(z,z+sign*.20),max(z,z+sign*.20),'photo40 common side armor belt')
    common_mesh={'points':m.points[start[0]:],'uvs':m.uvs[start[0]:],'indices':m.indices[start[1]:]}
    return {'raw':raw,'labels':labels,'bayLow':bay_low,'bayHigh':bay_high,
            'shared':{'key':'photo40-identical-angular-case-frame',
              'boundsM':[[-11.25,.4,-6.5],[11.25,11.4,6.5]],
              'geometrySha256':hashlib.sha256(json.dumps(common_mesh,separators=(',',':')).encode()).hexdigest(),
              'meshRange':{'firstVertex':start[0],'vertices':len(m.points)-start[0],
                           'firstIndex':start[1],'indices':len(m.indices)-start[1]},
              'recoilBayBoundsM':[bay_low,bay_high]}}


def restore_twin_case_cover(m,context):
    # Close the centre of the external-gun version with a fitted machinery
    # cover. The central-gun version instead fills this bay with its moving hood.
    raw=context['raw'];start=m.mark()
    for i in range(0,len(raw.indices),3):
        poly=[raw.points[v] for v in raw.indices[i:i+3]]
        for axis in range(3):
            poly=clip_skin_polygon(poly,axis,context['bayLow'][axis],False)
            poly=clip_skin_polygon(poly,axis,context['bayHigh'][axis],True)
        if len(poly)>=3:m.face(poly)
    return m.record(start,'twin40 fitted central machinery cover')


def build_box40(scale):
    m=Mesh();context=common_photo40_case(m);cover=restore_twin_case_cover(m,context)
    # External recoil mechanisms leave usable space within the enclosed case.
    # Exclude their real cross-shaft tunnel, rather than the triple's swept bay.
    m.compartments=[]
    for source in context['raw'].compartments:
        for i,(V,F) in enumerate(convex_without_box((source['verticesM'],source['faces']),
                                                  [1.7,6.8,-6.6],[3.3,8.4,6.6])):
            m.compartments.append({'label':source['label']+' usable external-drive room '+str(i),
                'verticesM':V,'faces':F,'volumeM3':triangle_volume(V,F),'conservative':True,
                'sourceMeshRange':{'firstVertex':0,'vertices':len(m.points),'firstIndex':0,'indices':len(m.indices)}})
    pivot=[2.5,7.6,0];d,z_centers=complete_photo_drives(m,pivot,6.5,6.5,'twin40 external complete circular trunnion')
    axle=m.cylinder(pivot,.70,17.2,2,'twin40 fixed cross-case drive shaft',48)
    split=m.mark();b=[];receivers=[]
    for z in z_centers:
        before=len(m.components)
        photo_receiver(m,[5.5,12.5],z,1.45,'twin40 external single recoil cradle')
        receivers.extend(r['label'] for r in m.components[before:])
        b.append(physical40_barrel(m,[5.5,12.5,z],13.0,'40TT external photo-length source barrel'))
    return finish_photo40(m,'twin40','40TT 2連装重ターボレーザー',pivot,b,split,d,scale,
                         {'case':context['labels'],'mainCase':context['labels'],'wheel':[d[0]['label']],
                          'receiver':receivers,'axle':[axle['label']]},
                         externalMounts=True,internalBarrels=0,fullCircularBases=True,
                         sharedCase=context['shared'],
                         mechanicalClearance={'verifiedElevationDegrees':[-10,0,25,55,85],
                           'caseMeshComponents':context['labels'],
                           'legalContactComponents':[axle['label']],
                           'method':'moving external gun mechanisms versus the closed shared case'},
                         centralEnclosure={'closedExterior':True,'fittedMechanicalCover':cover['label'],
                           'halfWidthM':6.5*scale/DEFAULT_FORTY_SCALE,'roofYM':11.4*scale/DEFAULT_FORTY_SCALE},
                         outboardTrunnions={'caseHalfWidthM':6.5*scale/DEFAULT_FORTY_SCALE,
                           'minimumClearanceM':.20*scale/DEFAULT_FORTY_SCALE,'completeSourceComponents':[1,3]},
                         derivation='one shared angular case with a fitted central cover and two fully external, axle-connected single-gun mechanisms')


def build_triple40(scale):
    m=Mesh();context=common_photo40_case(m);pivot=[-3.0,7.1,0]
    d,z=complete_photo_drives(m,pivot,5.0,6.5,'triple40 complete circular bearing')
    axle=m.cylinder(pivot,.70,14.2,2,'triple40 fixed cross-case drive shaft',48)
    split=m.mark()
    hood=m.prism([[-9.0,6.5],[-9.0,9.8],[-7.7,11.3],[-2.4,11.3],[5.0,10.3],[5.0,6.5]],
                 -4.6,4.6,'triple40 moving armored rear gun hood')
    cradle=m.prism([[-5.5,6.8],[-1.0,6.8],[5.0,10.2],[5.0,11.3],[-1.0,11.3],[-5.5,9.0]],
                   -4.5,4.5,'triple40 broad axle-connected angular cradle')
    receiver=m.prism([[-1.5,10.3],[4.4,10.3],[5.0,10.8],[5.0,12.2],[3.9,13.2],[-1.5,13.2]],
                    -4.25,4.25,'triple40 three-port angular recoil receiver')
    ribs(m,-.8,5,.65,13.2,-3.5,3.5,.15)
    photo_roof_detail(m,[-7.2,11.17,-2.7],[-3.6,11.6,2.7],
                      'triple40 moving rear hood inspection hatch')
    b=[physical40_barrel(m,[4.0,11.9,z],12.5,'40TT triple photo-length source barrel') for z in [-2.5,0,2.5]]
    return finish_photo40(m,'triple40','40TT 3連装ターボレーザー',pivot,b,split,d,scale,
                         {'case':context['labels'],'mainCase':context['labels'],'wheel':[d[0]['label']],
                          'cradle':[hood['label'],cradle['label']],'receiver':[receiver['label']],
                          'axle':[axle['label']]},
                         sharedCase=context['shared'],completeUpperGunUnit=True,
                         mechanicalClearance={'verifiedElevationDegrees':[-10,0,25,55,85],
                           'method':'actual moving hood, cradle, receiver and barrel triangles against the shared fixed closed case cells',
                           'caseMeshComponents':context['labels'],'legalContactComponents':[axle['label']]},
                         recoilBay={'actualOpening':True,'boundsM':[context['bayLow'],context['bayHigh']],
                           'stowedMovingHoodFillsBay':True,'mechanismSpaceCreditedAsChargingRoom':False},
                         derivation='the same outer case as the twin; a broad axle-connected moving armored hood and cradle fill the centre and carry all three elevated barrels')


def anchor_compartment(source_id,scale):
    if not ANCHOR_COMPARTMENTS.exists():raise ValueError('Missing original gunhouse metadata: '+str(ANCHOR_COMPARTMENTS))
    raw=ANCHOR_COMPARTMENTS.read_bytes();payload=json.loads(raw);payload=payload.get('assets',payload);meta=payload[source_id]
    if 'turretCompartment' in meta:meta=meta['turretCompartment']
    meta=json.loads(json.dumps(meta));source=sources()[source_id]
    if meta.get('sourcePackedSha256') and meta['sourcePackedSha256']!=source['sha256']:
        raise ValueError('Compiled gunhouse cells refer to a changed source mesh: '+source_id)
    meta['compiledMetadataSha256']=hashlib.sha256(raw).hexdigest();meta['appliedUniformScale']=scale
    for cell in meta['convexes']:
        volume=cell.get('volumeM3',triangle_volume(cell['verticesM'],cell['faces']))
        cell['verticesM']=[[v*scale for v in p] for p in cell['verticesM']];cell['volumeM3']=volume*scale**3
    meta['volumeM3']=sum(c['volumeM3'] for c in meta['convexes'])
    return meta


def build_oct40(scale):
    source=sources()['isd_heavy_octuple_original'];m=Mesh();moving={0,1,2,3,*range(15,23)};mapping=[]
    for i,g in enumerate(source['groups']):
        if i in moving:continue
        source_part(m,'isd_heavy_octuple_original',i,label='unchanged normal octuple housing component');mapping.extend(g)
    split=m.mark();rows=[]
    for i,g in enumerate(source['groups']):
        if i not in moving:continue
        row=source_part(m,'isd_heavy_octuple_original',i,label='unchanged normal octuple elevating component');mapping.extend(g)
        if i>=15:
            low,high=bounds([source['points'][v] for v in g]);muzzle=[high[0],(low[1]+high[1])/2,(low[2]+high[2])/2]
            radii=[math.hypot(source['points'][v][1]-muzzle[1],source['points'][v][2]-muzzle[2]) for v in g if source['points'][v][0]>high[0]-.25]
            recess=source_bore_recess(m,row,muzzle,[1,0,0])
            row.update(root=[low[0],muzzle[1],muzzle[2]],muzzle=muzzle,centerM=[(low[0]+high[0])/2,*muzzle[1:]],axis=[1,0,0],outerRadiusM=max(radii),boreRadiusM=0,muzzleRecessM=recess,muzzleStyle='source-cap',exposedStartX=7.938)
            rows.append(row)
    low,high=bounds([source['points'][i] for i in source['groups'][4]])
    pivot=[(low[0]+high[0])/2,low[1],0]
    a=finish(m,'oct40','ISD 40TT 8連装ターボレーザー',40,pivot,rows,split,[],scale,
             plainMetal=source['asset'].get('plainMetal',False),derivedFrom='isd_heavy_octuple_original',anchorSourceId='isd_heavy_octuple_original',sourcePackedSha256=source['sha256'],sourceVertexIndices=mapping,
             geometryPreservation={'kind':'uniform-scale-only','scale':scale,'sourceVertices':source['asset']['n'],'sourceFaces':source['asset']['faces'],'vertexAndFaceTopologyPreserved':True,'uvsPreserved':True},
             anchor={'kind':'1600m Imperial original normal main battery model','nominalLengthM':source['asset']['size'][0]*scale,'uncertaintyFraction':.10})
    a['turretCompartment']=anchor_compartment('isd_heavy_octuple_original',scale)
    return a


def build_dby70(scale):
    source=sources()['ven_turret'];m=Mesh();mapping=[]
    for component in [0,1,3]:source_part(m,'ven_turret',component,label='unchanged DBY-827 housing and circular bearing');mapping.extend(source['groups'][component])
    split=m.mark();rows=[];F,U,R=source['frame']
    for component in [2,4]:
        row=source_part(m,'ven_turret',component,label='unchanged DBY-827 barrel');mapping.extend(source['groups'][component]);g=source['groups'][component]
        q=[[dot(source['points'][v],axis) for axis in [F,U,R]] for v in g];low,high=bounds(q);center=[high[0],(low[1]+high[1])/2,(low[2]+high[2])/2]
        def back(p):return [sum(p[j]*source['frame'][j][k] for j in range(3)) for k in range(3)]
        muzzle=back(center);root=back([low[0],*center[1:]]);front=[p for p in q if p[0]>high[0]-.001];radii=[math.hypot(p[1]-center[1],p[2]-center[2]) for p in front];recess=source_bore_recess(m,row,muzzle,F)
        row.update(root=root,muzzle=muzzle,centerM=[(a+b)/2 for a,b in zip(root,muzzle)],axis=F,outerRadiusM=max(radii),boreRadiusM=min(radii),muzzleRecessM=recess,muzzleStyle='source-recessed' if recess else 'source-open-tube',exposedStartX=root[0]+(muzzle[0]-root[0])*.28)
        rows.append(row)
    source=sources()['ven_turret'];pivots=[]
    for component in [1,3]:
        low,high=bounds([source['points'][v] for v in source['groups'][component]]);pivots.append([(a+b)/2 for a,b in zip(low,high)])
    pivot=[sum(p[k] for p in pivots)/2 for k in range(3)]
    a=finish(m,'refVen','DBY-827 70TT 2連装重ターボレーザー',70,pivot,rows,split,[],scale,
             plainMetal=source['asset'].get('plainMetal',False),barrelAxis=F,elevationAxis=R,derivedFrom='ven_turret',anchorSourceId='ven_turret',sourcePackedSha256=source['sha256'],sourceVertexIndices=mapping,
             geometryPreservation={'kind':'rigid-source-frame-and-uniform-scale-only','scale':scale,'sourceVertices':source['asset']['n'],'sourceFaces':source['asset']['faces'],'vertexAndFaceTopologyPreserved':True,'uvsPreserved':True,'sourceUp':[.02532,.99968,.00055],'sourceYawDeg':89.7,'sourceBase':[.015,-4.985,1.401],'sourceFloorCorrectionM':source['floorCorrection']})
    a['turretCompartment']=anchor_compartment('ven_turret',scale)
    return a


def hex_prism(m,footprint,y0,y1,label,compartment=True):
    vertices=[[x,y,z] for y in [y0,y1] for x,z in footprint];n=len(footprint)
    polygons=[list(range(n-1,-1,-1)),list(range(n,2*n))]
    polygons.extend([[i,(i+1)%n,(i+1)%n+n,i+n] for i in range(n)])
    return m.convex(vertices,polygons,label,compartment)


def dby_drives(m,pivot,width,radial=1):
    source=sources()['ven_turret'];rows=[]
    for component,z in [(1,-width),(3,width)]:
        low,high=bounds([source['points'][i] for i in source['groups'][component]]);c=[(a+b)/2 for a,b in zip(low,high)]
        xf=lambda p,c=c,z=z:[pivot[0]+(p[0]-c[0])*radial,pivot[1]+(p[1]-c[1])*radial,z+(p[2]-c[2])*.7/(high[2]-low[2])]
        row=source_part(m,'ven_turret',component,xf,'DBY-827 complete circular elevation bearing')
        row.update(centerM=[pivot[0],pivot[1],z],axis=[0,0,1],radiusM=(high[1]-low[1])*radial/2);rows.append(row)
    return rows


def clipped_convex(vertices,faces,axis,limit,lower=True):
    def distance(p):return (p[axis]-limit)*(1 if lower else -1)
    points=[p[:] for p in vertices if distance(p)<=1e-9]
    for face in faces:
        for a,b in zip(face,face[1:]+face[:1]):
            pa,pb=vertices[a],vertices[b];da,db=distance(pa),distance(pb)
            if (da<-1e-9 and db>1e-9) or (db<-1e-9 and da>1e-9):
                t=da/(da-db);points.append([pa[k]+(pb[k]-pa[k])*t for k in range(3)])
    unique={tuple(round(v,9) for v in p):p for p in points}
    if len(unique)<4:raise ValueError('Empty armored case cell')
    return convex_hull(list(unique.values()))


def build_triple70(scale):
    m=Mesh();source=sources()['ven_turret'];height=bounds(source['points'])[1][1]
    roof_y=height-.85
    # Photo3: a compact six-sided warship gunhouse, broad front shoulders and
    # narrower rear, with the front mechanism taking most of its front width.
    base=[[-9.75,-6.4],[3.8,-12],[9.75,-9.1],[9.75,9.1],[3.8,12],[-9.75,6.4]]
    roof=[[-9.15,-5.6],[3.9,-10.8],[9.75,-8.4],[9.75,8.4],[3.9,10.8],[-9.15,5.6]]
    V,F=convex_hull([[x,0,z] for x,z in base]+[[x,roof_y,z] for x,z in roof])
    left=clipped_convex(V,F,2,-9.3);right=clipped_convex(V,F,2,9.3,False)
    center=clipped_convex(V,F,2,-9.3,False);center=clipped_convex(*center,2,9.3)
    rear=clipped_convex(*center,0,8.0);front=clipped_convex(*center,0,8.0,False)
    floor=clipped_convex(*front,1,.08)
    main=[]
    for label,cell in [('port sloped armored cheek',left),('starboard sloped armored cheek',right),
                       ('enclosed hexagonal rear gunhouse',rear),('front socket lower armor',floor)]:
        main.append(m.convex(*cell,'triple70 '+label,True))
    # Photo3 has three distinct longitudinal machinery/recoil covers, not
    # a flattened copy of the complete DBY body spread across the roof.
    for z in [-3.8,0,3.8]:
        m.prism([[-7.0,roof_y],[-6.2,roof_y+.65],[3.6,roof_y+.65],[4.8,roof_y]],
                z-.85,z+.85,'triple70 longitudinal roof mechanism cover')
        source_part(m,'ven_turret',0,
                    source_transform('ven_turret',0,[-6.2,roof_y-.9,z-.60],[-1.2,roof_y+.75,z+.60]),
                    'DBY roof recoil service mechanism')
        m.box([.3,roof_y+.65,z-.55],[2.4,roof_y+.79,z+.55],
              'triple70 individual roof inspection hatch')
        for side in [-1,1]:
            m.cylinder([-1.0,roof_y+.28,z+side*.98],.13,8.0,0,
                       'triple70 roof service conduit',24)
    def side_width(x,y):
        t=y/roof_y;back=-9.75*(1-t)-9.15*t;shoulder=3.8*(1-t)+3.9*t
        rear=6.4*(1-t)+5.6*t;wide=12*(1-t)+10.8*t
        return rear+(x-back)/(shoulder-back)*(wide-rear)
    def side_panel(x0,x1,y0,y1,sign,offset,thickness,label):
        pts=[[x,y,sign*(side_width(x,y)+offset)] for x,y in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]]
        V=pts+[[x,y,z+sign*thickness] for x,y,z in pts]
        return m.convex(V,[[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],label)
    for sign in [-1,1]:
        for x in [-6.5,-3.4,-.3]:
            side_panel(x,x+2.1,2.1,4.5,sign,.04,.10,'triple70 recessed side service panel')
            for v in [.25,.78,1.31,1.84]:
                side_panel(x+v,x+v+.12,2.3,4.3,sign,.14,.19,'triple70 vertical ventilation frame')
        side_panel(-6.8,2.4,5.1,5.65,sign,.04,.20,'triple70 side armor belt')
    pivot=[14.0,6.25,0]
    for sign in [-1,1]:
        m.prism([[8.0,4.7],[13.5,4.9],[14.6,5.3],[14.6,7.3],[13.5,7.7],[8.0,7.9]],
                min(sign*9.3,sign*9.75),max(sign*9.3,sign*9.75),'integral forward gun-pod bearing cheek')
        m.cylinder([pivot[0],pivot[1],sign*8.9],.63,1.3,2,'forward pod trunnion axle',48)
    split=m.mark();pod_low,pod_high=[9.75,2.6,-9.0],[17.25,height,9.0]
    xf=source_transform('ven_turret',0,pod_low,pod_high)
    pod=source_part(m,'ven_turret',0,xf,'complete detailed DBY common front gun pod')
    for i,c in enumerate(json.loads(ANCHOR_COMPARTMENTS.read_text())['ven_turret']['convexes']):
        vertices=[xf(p) for p in c['verticesM']];faces=c['faces']
        m.compartments.append({'label':'moving front DBY gunhouse cell '+str(i),'verticesM':vertices,
            'faces':faces,'volumeM3':triangle_volume(vertices,faces),'movesWithGun':True,
            'conservative':True,'sourceAsset':'ven_turret','sourceComponent':0,'sourceCompartmentCell':i,
            'sourceMeshRange':{k:pod[k] for k in ['firstVertex','vertices','firstIndex','indices']}})
    d=dby_drives(m,pivot,7.8,1.0)
    m.prism([[14.1,4.4],[17.8,4.4],[18.3,5.0],[18.3,7.7],[17.8,8.3],[14.1,8.3]],
            -7.3,7.3,'wide detailed front three-gun receiver')
    ribs(m,14.4,5,.57,8.3,-6.5,6.5,.16)
    b=[source_barrel(m,'ven_turret',2,[16.25,6.25,z],1,1,'70TT full-profile forward DBY barrel') for z in [-3.0,0,3.0]]
    return finish(m,'triple70','70TT 3連装重ターボレーザー',70,pivot,b,split,d,scale,
                  derivedFrom='ven_turret',materialReference='ven_turret70_native',
                  photoMeasurements='assets/source/turret-photo-measurements.json',
                  photoFeatureComponents={'mainCase':[r['label'] for r in main],'frontPod':[pod['label']]},
                  caseStyle='closed-battleship-hexagonal-forward-pod',
                  barrelPhysicalProfilePreservedFrom='ven_turret',barrelSourceAxialScale=1.0,
                  jointLimits={'yaw':None,'lo':-10*math.pi/180,'hi':85*math.pi/180},
                  mechanicalClearance={'verifiedElevationDegrees':[-10,0,20,55,85],
                    'method':'actual moving triangle versus fixed closed case half-space intersection',
                    'reason':'a wide front pod clears the compact rear case through its central open socket'},
                  caseMaximumWidthStationFraction=(3.8+9.75)/19.5,caseMaximumWidthXM=3.8*scale,
                  caseFootprintVerticesM=[[x*scale,0,z*scale] for x,z in base],
                  mainCaseHeightM=height*scale,frontGunhouseElevates=True,
                  frontPod={'rearXM':9.75*scale,'mainCaseFrontXM':9.75*scale,
                    'caseBoundsM':[[v*scale for v in p] for p in [pod_low,pod_high]],
                    'bodyDepthFractionOfMainCase':7.5/19.5,'barrelRootZM':[-3*scale,0,3*scale],
                    'rootSideMarginM':(7.3-3-.912)*scale,'completeSourceBodyComponent':0,
                    'movingMeshRange':{k:pod[k] for k in ['firstVertex','vertices','firstIndex','indices']}},
                  derivation='photo3 compact forward-wide hexagonal warship case, broad DBY front gun pod and centrally inset three full-length DBY barrels')


def build_quad70_side(scale):
    m=Mesh();frame=[]
    frame.append(m.prism([[0,0],[2.8,0],[2.8,10.9],[1.6,12.0],[0,12.0]],
                         -6.8,6.8,'broadside carrier rear bulkhead',True))
    frame.append(m.box([2.8,11.1,-6.8],[14.3,12.0,6.8],'broadside carrier upper rail',True))
    frame.append(m.box([2.8,0,-6.8],[14.3,.9,6.8],'broadside carrier lower rail',True))
    frame.append(m.box([2.8,2.1,-4.6],[9.0,8.6,4.6],'broadside carrier rear service block',True))
    # The gap between rails is real empty space, not a transparent material on
    # a solid box and never credited as usable internal charging-room volume.
    for sign in [-1,1]:
        for x in [3.5,5.1,6.7]:
            m.prism([[x,2.9],[x+.7,2.9],[x+.7,7.5],[x,7.5]],
                    min(sign*4.61,sign*4.76),max(sign*4.61,sign*4.76),'broadside rear service vent frame')
    m.cylinder([5.1,12.9,0],1.18,3.6,1,'broadside rear raised vent pipe',48)
    m.cylinder([5.1,11.2,0],1.55,.4,1,'broadside vent pipe mounting collar',48)
    m.cylinder([13.0,6.0,0],1.25,8.0,0,'broadside fixed traverse shaft',48)
    split=m.mark();pivot=[18.0,6.0,0]
    body=source_part(m,'ven_turret',0,
                    source_transform('ven_turret',0,[14.0,1.2,-6.2],[21.8,10.8,6.2]),
                    'broadside complete square DBY gimbal body')
    body_xf=source_transform('ven_turret',0,[14.0,1.2,-6.2],[21.8,10.8,6.2])
    for i,c in enumerate(json.loads(ANCHOR_COMPARTMENTS.read_text())['ven_turret']['convexes']):
        vertices=[body_xf(p) for p in c['verticesM']];faces=c['faces']
        m.compartments.append({'label':'moving square DBY gunhouse cell '+str(i),'verticesM':vertices,
            'faces':faces,'volumeM3':triangle_volume(vertices,faces),'movesWithGun':True,
            'conservative':True,'sourceAsset':'ven_turret','sourceComponent':0,'sourceCompartmentCell':i,
            'sourceMeshRange':{k:body[k] for k in ['firstVertex','vertices','firstIndex','indices']}})
    ring=[[1.4,-5.0],[1.4,5.0],[2.5,6.2],[9.5,6.2],[10.6,5.0],[10.6,-5.0],[9.5,-6.2],[2.5,-6.2]]
    V=[[x,y,z] for x in [20.2,22.0] for y,z in ring];n=len(ring)
    F=[list(range(n-1,-1,-1)),list(range(n,n*2))]+[[i,(i+1)%n,(i+1)%n+n,i+n]for i in range(n)]
    plate=m.convex(V,F,'broadside square chamfered four-port receiver')
    dby_drives(m,pivot,6.0,.80)
    ribs(m,15.6,5,.8,10.8,-4.5,4.5,.15)
    b=[source_barrel(m,'ven_turret',2,[21.5,y,z],1,1,'70TT four-port DBY barrel')
       for y in [3.7,8.3] for z in [-2.5,2.5]]
    return finish(m,'quad70Side','70TT 4連装舷側重ターボレーザー',70,pivot,b,split,[],scale,
                  derivedFrom='ven_turret',materialReference='ven_turret70_native',
                  photoMeasurements='assets/source/turret-photo-measurements.json',
                  photoFeatureComponents={'case':[r['label'] for r in frame],'frontPod':[body['label'],plate['label']]},
                  derivation='photo3 open-sided C carrier with separate rails and service block, supporting one detailed square DBY four-gun gimbal',
                  housingFixed=True,traversePivot=[v*scale for v in pivot],
                  carrier={'style':'open-C-frame','airGapBoundsM':[[9.05*scale,7.4*scale,-6.75*scale],[13.9*scale,11.05*scale,6.75*scale]],
                           'airGapCreditedAsCompartment':False,'closedCompartmentLabels':[r['label'] for r in frame]},
                  jointLimits={'yaw':65*math.pi/180,'lo':-20*math.pi/180,'hi':20*math.pi/180},
                  mounting={'kind':'broadside-only','normal':[1,0,0],'up':[0,1,0],'rearFaceX':0,'requiresVerticalSurface':True})


def spherical_house(m,center,radius,label):
    segments,levels=40,18;vertices=[[center[0],center[1]-radius,center[2]]]
    for j in range(1,levels):
        t=-math.pi/2+math.pi*j/levels
        vertices.extend([[center[0]+radius*math.cos(t)*math.cos(2*math.pi*i/segments),center[1]+radius*math.sin(t),center[2]+radius*math.cos(t)*math.sin(2*math.pi*i/segments)] for i in range(segments)])
    top=len(vertices);vertices.append([center[0],center[1]+radius,center[2]])
    polygons=[]
    for i in range(segments):polygons.append([0,1+(i+1)%segments,1+i])
    for j in range(levels-2):
        a=1+j*segments;b=a+segments
        for i in range(segments):polygons.append([a+i,a+(i+1)%segments,b+(i+1)%segments,b+i])
    for i in range(segments):polygons.append([1+(levels-2)*segments+i,1+(levels-2)*segments+(i+1)%segments,top])
    return m.convex(vertices,polygons,label,True)


def build_quad40_ion(scale):
    m=Mesh();split=m.mark();pivot=[0,2.5,0]
    sphere=spherical_house(m,pivot,7.5,'spherical four-port ion gunhouse')
    sphere.update(normalMode='sphere',normalCenterM=pivot[:])
    b=[]
    for y in [1.35,3.65]:
        for z in [-1.15,1.15]:b.append(source_barrel(m,'isd_heavy_octuple_original',15,[5.4,y,z],.55,1.0,'40TT spherical ion source barrel'))
    return finish(m,'quad40Ion','40TT 4連装イオン砲',40,pivot,b,split,[],scale,
                  derivedFrom='isd_heavy_octuple_original',materialReference='isd_heavy_octuple',weaponRole='ion',gunhouseElevates=True,
                  sphereRadiusM=7.5*scale,sphereCenterM=[0,2.5*scale,0],
                  sphereMeshRange={k:sphere[k] for k in ['firstVertex','vertices','firstIndex','indices']},
                  mountEmbedding={'diameterBelowMountFraction':1/3,'centerHeightRadiusRatio':1/3,'analyticCapVolumeFraction':7/27},
                  derivation='four source40 barrels in a spherical gunhouse; ball and complete four-port gun assembly elevate together within a thin neck collar')


def build(octuple_length=OCTUPLE_LENGTH_M,dby_length=DBY_LENGTH_M):
    # Original anchors preserve their native shape and topology exactly. The
    # derivatives use the same source family, then follow the photo proportions.
    source=sources()['isd_heavy_octuple_original']['asset'];forty_scale=octuple_length/34.56475644
    anchor_scale=octuple_length/source['size'][0]
    seventy_scale=dby_length/DBY_LENGTH_M
    return dict(zip(FAMILY_ORDER,[build_single40(forty_scale),build_dome40(forty_scale),
        build_box40(forty_scale),build_triple40(forty_scale),build_oct40(anchor_scale),
        build_dby70(seventy_scale),build_triple70(seventy_scale),build_quad70_side(seventy_scale),
        build_quad40_ion(forty_scale)]))


def registry(path):
    assets={}
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.startswith('const YardReferenceData=') or line.startswith('const YardImperial2Data='):
            obj=json.loads(line.split('=',1)[1].rstrip(';'));assets.update(obj.get('assets',{}))
        elif line.startswith('Object.assign(YardReferenceData.assets,') or line.startswith('Object.assign(YardImperial2Data.assets,'):
            assets.update(json.loads(line.split('.assets,',1)[1][:-2]))
    return assets


def ray_triangle(origin,direction,a,b,c):
    e1,e2=sub(b,a),sub(c,a);p=cross(direction,e2);det=dot(e1,p)
    if abs(det)<1e-10:return None
    inverse=1/det;t=sub(origin,a);u=dot(t,p)*inverse
    if u < -1e-8 or u > 1+1e-8:return None
    q=cross(t,e1);v=dot(direction,q)*inverse
    if v < -1e-8 or u+v > 1+1e-8:return None
    distance=dot(e2,q)*inverse
    return distance if distance>=-1e-8 else None


def moving_case_clearance(points,indices,asset,angles,fail=True):
    """Clip actual moving triangles against the closed armored case cells.

    This verifies the whole cradle, not just a muzzle axis or bounding box.
    Coplanar touching surfaces are excluded by a small inward tolerance.
    """
    cells=[]
    for cell in asset['turretCompartment']['convexes']:
        if cell.get('movesWithGun'):continue
        V=cell['verticesM'];planes={}
        for a,b,c in cell['faces']:
            N=cross(sub(V[b],V[a]),sub(V[c],V[a]));length=math.sqrt(dot(N,N))
            if length<1e-10:continue
            N=[v/length for v in N];d=dot(N,V[a]);planes[tuple(round(v,8) for v in N+[d])]=(N,d)
        cells.append((cell['label'],list(planes.values()),bounds(V)))
    def clip(poly,N,d):
        result=[]
        for A,B in zip(poly,poly[1:]+poly[:1]):
            da,db=dot(N,A)-d+1e-5,dot(N,B)-d+1e-5;inside_a,inside_b=da<0,db<0
            if inside_a:result.append(A)
            if inside_a!=inside_b:
                t=da/(da-db);result.append([a+(b-a)*t for a,b in zip(A,B)])
        return result
    result={}
    for degrees in angles:
        theta=math.radians(degrees);cos,sin=math.cos(theta),math.sin(theta);pivot=asset['elevationPivot'];rotated=[]
        for p in points:
            x,y,z=sub(p,pivot);rotated.append([pivot[0]+x*cos-y*sin,pivot[1]+x*sin+y*cos,pivot[2]+z])
        hits=0
        for i in range(asset['elevationIndexStart'],len(indices),3):
            tri=[rotated[v] for v in indices[i:i+3]];lo,hi=bounds(tri)
            for label,planes,(a,b) in cells:
                if any(hi[k]<a[k]+1e-5 or lo[k]>b[k]-1e-5 for k in range(3)):continue
                polygon=tri
                for normal,d in planes:
                    polygon=clip(polygon,normal,d)
                    if len(polygon)<3:break
                if len(polygon)<3:continue
                area=0
                for j in range(1,len(polygon)-1):
                    normal=cross(sub(polygon[j],polygon[0]),sub(polygon[j+1],polygon[0]));area+=math.sqrt(dot(normal,normal))/2
                if area>1e-6:hits+=1
        if hits and fail:raise ValueError('Moving cradle intersects compact gunhouse at '+str(degrees)+' degrees')
        result[str(degrees)]=hits
    return result


def validate(assets):
    result={}
    for key,asset in assets.items():
        # Exact topology and convexity, not a box-volume surrogate.
        for poly in asset['turretCompartment']['convexes']:
            vertices,faces=poly['verticesM'],poly['faces'];edges={}
            for a,b,c in faces:
                for x,y in [(a,b),(b,c),(c,a)]:edges[tuple(sorted((x,y)))]=edges.get(tuple(sorted((x,y))),0)+1
                normal=cross(sub(vertices[b],vertices[a]),sub(vertices[c],vertices[a]))
                if max(dot(normal,sub(p,vertices[a])) for p in vertices)>1e-6:
                    raise ValueError(key+': non-convex compartment '+poly['label'])
            if set(edges.values())!={2}:raise ValueError(key+': open compartment '+poly['label'])
            if triangle_volume(vertices,faces)<=0:raise ValueError(key+': zero compartment volume')
        packed=base64.b64decode(asset['data']);n=asset['n'];index_bytes=asset['indexBytes']
        points=[[struct.unpack_from('<h',packed,i*6+k*2)[0]/65532*asset['size'][k]+asset['c'][k] for k in range(3)] for i in range(n)]
        fmt='<H' if index_bytes==2 else '<I'
        indices=[struct.unpack_from(fmt,packed,n*10+i*index_bytes)[0] for i in range(asset['faces']*3)]
        split=asset['elevationIndexStart'];vertex_split=asset['elevationVertexStart']
        if any(i>=vertex_split for i in indices[:split]) or any(i<vertex_split for i in indices[split:]):raise ValueError(key+': crossed articulation partition')
        def ray(origin,direction):
            best=math.inf
            for j in range(0,len(indices),3):
                t=ray_triangle(origin,direction,*[points[i] for i in indices[j:j+3]])
                if t is not None:best=min(best,t)
            return best
        for barrel in asset['barrelCenters']:
            p=barrel['muzzle'];axis=barrel['axis'];direction=[-v for v in axis]
            origin=add(p,[v*.5 for v in axis]);center=ray(origin,direction)
            tolerance=max(.003,asset['maxQuantizationErrorM']*8)
            recess=barrel['muzzleRecessM']
            if recess is not None and abs(center-(.5+recess))>tolerance:
                raise ValueError(key+': actual source bore is obstructed '+barrel['label']+' '+str((center,recess)))
            # Source anchors preserve their original exact muzzle profiles;
            # derivatives reuse those same complete components, not fake holes.
            if not math.isfinite(center) and recess is not None:
                raise ValueError(key+': missing source bore floor '+barrel['label'])
        angles=([-10,0,20,55,85] if key=='family_triple70' else
                [-10,0,25,55,85] if key in ['family_twin40_box','family_triple40'] else None)
        clearance=moving_case_clearance(points,indices,asset,angles) if angles else None
        result[key]={'closedConvexes':len(asset['turretCompartment']['convexes']),
                     'physicalBarrels':len(asset['barrelCenters']),
                     'recessedSourceBarrels':sum(b['muzzleStyle']=='source-recessed' for b in asset['barrelCenters']),
                     'sourceCapBarrels':sum(b['muzzleStyle']=='source-cap' for b in asset['barrelCenters']),
                     'partitionCrossings':0,**({'wholeCradleClearance':clearance} if clearance is not None else {})}
    return result


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json-output',type=Path,default=Path('/tmp/turret-family-assets.json'))
    parser.add_argument('--metadata-output',type=Path,default=ROOT/'assets/source/turret-family-manifest.json')
    parser.add_argument('--octuple-length',type=float,default=OCTUPLE_LENGTH_M)
    parser.add_argument('--dby-length',type=float,default=DBY_LENGTH_M)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    if any(not math.isfinite(v) or v<=0 for v in [args.octuple_length,args.dby_length]):parser.error('Anchors must be positive finite metres')
    assets=build(args.octuple_length,args.dby_length)
    validation=validate(assets)
    if args.check:
        current=registry(ROOT/'data/reference.js');current.update(registry(ROOT/'data/imperial2.js'))
        missing=[key for key,value in assets.items() if current.get(key)!=value]
        if missing:raise SystemExit('Turret family registrations are stale: '+', '.join(missing))
    else:
        args.json_output.parent.mkdir(parents=True,exist_ok=True)
        args.json_output.write_text(json.dumps(assets,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
        manifest={'schemaVersion':2,'source':'User-provided photos1–5; original original normal octuple and DBY-827 source meshes','octupleAnchorM':args.octuple_length,'dbyAnchorM':args.dby_length,'order':FAMILY_ORDER,'validation':validation,
                  'sourceModels':{key:{'packedSha256':value['sha256'],'vertices':value['asset']['n'],'faces':value['asset']['faces']} for key,value in sources().items()},
                  'sourceInputsSha256':{str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'assets/source/isd-heavy-octuple-original.json',ANCHOR_COMPARTMENTS]},
                  'assets':{key:{**{k:v for k,v in value.items() if k!='data'},'packedSha256':hashlib.sha256(base64.b64decode(value['data'])).hexdigest()} for key,value in assets.items()}}
        args.metadata_output.parent.mkdir(parents=True,exist_ok=True);args.metadata_output.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({key:{'size':value['size'],'barrels':value['barrels'],'faces':value['faces'],'gunhouseVolumeM3':value['turretCompartment']['volumeM3']} for key,value in assets.items()},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
