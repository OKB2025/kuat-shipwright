#!/usr/bin/env python3
"""Build a raised-bore 40 TT twin from the deployed DBY-827 model.

The source remains unchanged. Its complete housing, circular drive components,
barrel faces and UVs are retained. The two tubes are levelled, raised above the
mechanical elevation axis, and supported by new armored cradles. Standard Python
only; output is a regular packed reference fitting, with a contiguous moving
barrel/cradle partition for elevation animation.

    python scripts/build-twin40-turret.py --json-output /tmp/twin40-photo.json
    python scripts/build-twin40-turret.py --check
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ID = 'ven_turret'
ASSET_ID = 'dby_twin40_raised'
SOURCE_UP = [.02532, .99968, .00055]
SOURCE_BASE = [.015, -4.985, 1.401]
SOURCE_YAW_DEG = 89.7
BORE_HEIGHT_M = 8.409


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def unit(a):
    length = math.sqrt(dot(a, a))
    return [x/length for x in a]


def bounds(points):
    return ([min(p[k] for p in points) for k in range(3)],
            [max(p[k] for p in points) for k in range(3)])


def source_assets(path):
    line = next(line for line in path.read_text(encoding='utf-8').splitlines()
                if line.startswith('const YardReferenceData='))
    return json.loads(line[len('const YardReferenceData='):-1])['assets']


def registered_asset(path, key):
    prefix = 'Object.assign(YardReferenceData.assets,'
    for line in path.read_text(encoding='utf-8').splitlines():
        if line.startswith(prefix):
            assets = json.loads(line[len(prefix):-2])
            if key in assets:
                return assets[key]
    return None


def decode(asset, source):
    packed = base64.b64decode(source['data'])
    count = asset['n']
    positions = [[struct.unpack_from('<h', packed, i*6+k*2)[0]/65532*asset['size'][k]
                  for k in range(3)] for i in range(count)]
    uvs = [struct.unpack_from('<HH', packed, count*6+i*4) for i in range(count)]
    fmt = '<H' if asset['indexBytes'] == 2 else '<I'
    indices = [struct.unpack_from(fmt, packed, count*10+i*asset['indexBytes'])[0]
               for i in range(asset['faces']*3)]
    return positions, uvs, indices, packed


def components(points, indices):
    parent = list(range(len(points)))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def join(a, b):
        parent[find(a)] = find(b)
    for a, b, c in zip(indices[::3], indices[1::3], indices[2::3]):
        join(a, b)
        join(b, c)
    coincident = {}
    for i, p in enumerate(points):
        key = tuple(p)
        if key in coincident:
            join(i, coincident[key])
        else:
            coincident[key] = i
    groups = {}
    for i in range(len(points)):
        groups.setdefault(find(i), []).append(i)
    return sorted(groups.values(), key=min)


def canonical_frame(points):
    # Exactly the source levelling and forward-yaw conventions used by refVen.
    up = unit(SOURCE_UP)
    v = cross(up, [0, 1, 0])
    sn2 = dot(v, v)
    c = up[1]
    K = [[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]]
    K2 = [[sum(K[i][k]*K[k][j] for k in range(3)) for j in range(3)] for i in range(3)]
    R = [[int(i == j)+K[i][j]+K2[i][j]*(1-c)/sn2 for j in range(3)] for i in range(3)]
    yaw = math.radians(SOURCE_YAW_DEG)
    def rotate(p, translate=True):
        q = [dot(row, p)-(SOURCE_BASE[i] if translate else 0) for i, row in enumerate(R)]
        x, y, z = q
        return [x*math.cos(yaw)-z*math.sin(yaw), y, x*math.sin(yaw)+z*math.cos(yaw)]
    local = [rotate(p) for p in points]
    floor = min(p[1] for p in local)
    for p in local:
        p[1] -= floor
    forward = unit(rotate([0, 0, -1], False))
    barrel_up = unit([-forward[0]*forward[1], 1-forward[1]**2, -forward[2]*forward[1]])
    right = unit(cross(forward, barrel_up))
    return local, [forward, barrel_up, right], floor


class Mesh:
    def __init__(self):
        self.points, self.uvs, self.indices = [], [], []

    def face(self, points):
        first = len(self.points)
        self.points.extend(points)
        self.uvs.extend([(int((i % 2)*65535), int((i//2 % 2)*65535)) for i in range(len(points))])
        for i in range(1, len(points)-1):
            self.indices.extend([first, first+i, first+i+1])

    def prism(self, profile, z0, z1):
        area = sum(a[0]*b[1]-b[0]*a[1] for a, b in zip(profile, profile[1:]+profile[:1]))
        if area < 0:
            profile = list(reversed(profile))
        self.face([[x, y, z0] for x, y in reversed(profile)])
        self.face([[x, y, z1] for x, y in profile])
        for a, b in zip(profile, profile[1:]+profile[:1]):
            self.face([[*a, z0], [*b, z0], [*b, z1], [*a, z1]])

    def box(self, low, high):
        x0, y0, z0 = low
        x1, y1, z1 = high
        self.prism([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1)


def build(reference):
    assets = source_assets(reference)
    source = assets[SOURCE_ID]
    data_asset = source if 'data' in source else assets[source['dataFrom']]
    points, uv, indices, packed_source = decode(source, data_asset)
    local, barrel_frame, floor = canonical_frame(points)
    groups = components(local, indices)
    if [len(g) for g in groups] != [2483, 256, 1272, 256, 1272]:
        raise ValueError('DBY source must contain its housing, two drives and two complete barrels')
    body, drives, barrels = groups[0], [groups[1], groups[3]], [groups[2], groups[4]]
    result = Mesh()
    drive_rows = []
    def append(group, transform=lambda p: p):
        group_set = set(group)
        first, index_start = len(result.points), len(result.indices)
        mapping = {old: first+i for i, old in enumerate(group)}
        result.points.extend([transform(local[i][:]) for i in group])
        result.uvs.extend([uv[i] for i in group])
        for tri in zip(indices[::3], indices[1::3], indices[2::3]):
            if tri[0] in group_set:
                if not all(v in group_set for v in tri):
                    raise ValueError('Source triangles cross component boundaries')
                result.indices.extend(mapping[v] for v in tri)
        return {'firstVertex': first, 'vertices': len(group), 'firstIndex': index_start,
                'indices': len(result.indices)-index_start}
    append(body)
    for drive in drives:
        row = append(drive)
        low, high = bounds([local[i] for i in drive])
        row.update(centerM=[(a+b)/2 for a, b in zip(low, high)], axis=[0, 0, 1],
                   radiusM=(high[1]-low[1])/2, boundsM=[low, high])
        drive_rows.append(row)
    housing_n, housing_faces = len(result.points), len(result.indices)//3
    pivot = [sum(row['centerM'][k] for row in drive_rows)/2 for k in range(3)]
    pivot[2] = 0
    barrel_rows = []
    front_x = max(p[0] for p in local)
    for sign, group in zip([-1, 1], barrels):
        coordinates = [[dot(local[i], axis) for axis in barrel_frame] for i in group]
        low, high = bounds(coordinates)
        cy, cz = [(low[k]+high[k])/2 for k in [1, 2]]
        by_index = dict(zip(group, coordinates))
        transformed = {i: [front_x-(high[0]-t), BORE_HEIGHT_M+(y-cy), sign*5.95+(z-cz)]
                       for i, (t, y, z) in by_index.items()}
        row = append(group, lambda p: p)
        result.points[row['firstVertex']:row['firstVertex']+row['vertices']] = [transformed[i] for i in group]
        front_radii = [math.hypot(y-cy, z-cz) for t, y, z in coordinates if t > high[0]-.01]
        inner_radius = min(front_radii)
        inner_t = [t for t, y, z in coordinates if abs(math.hypot(y-cy, z-cz)-inner_radius) < .001]
        row.update(side='left' if sign < 0 else 'right', axis=[1, 0, 0],
                   muzzle=[front_x, BORE_HEIGHT_M, sign*5.95],
                   root=[front_x-(high[0]-low[0]), BORE_HEIGHT_M, sign*5.95],
                   boreHeightM=BORE_HEIGHT_M, boreRadiusM=inner_radius,
                   outerRadiusM=max(front_radii), muzzleRecessM=high[0]-min(inner_t))
        barrel_rows.append(row)
    cradle_start, cradle_index = len(result.points), len(result.indices)
    cradle_profile = [[-3.2, 6.9], [-2.7, 8.2], [4.8, 8.2], [5.6, 7.6],
                      [5.6, 6.9], [4.8, 6.3], [-2.7, 6.3]]
    for sign in [-1, 1]:
        z = sign*5.95
        result.prism(cradle_profile, z-1.25, z+1.25)
        for x in [-1.6, -.35, .9]:
            result.box([x, 8.19, z-1.15], [x+.12, 8.4, z+1.15])
    low, high = bounds(result.points)
    size = [b-a for a, b in zip(low, high)]
    center = [(a+b)/2 for a, b in zip(low, high)]
    count, index_bytes = len(result.points), 2 if len(result.points) < 65536 else 4
    packed = bytearray()
    for point in result.points:
        for k in range(3):
            packed.extend(struct.pack('<h', round((point[k]-center[k])/size[k]*65532)))
    for pair in result.uvs:
        packed.extend(struct.pack('<HH', *pair))
    for i in result.indices:
        packed.extend(struct.pack('<H' if index_bytes == 2 else '<I', i))
    error = max(math.dist(point, [struct.unpack_from('<h', packed, i*6+k*2)[0]/65532*size[k]+center[k]
                                  for k in range(3)]) for i, point in enumerate(result.points))
    return {'title': '40TT 2連装重ターボレーザー砲塔', 'kind': 'fit', 'plainMetal': True,
            'derivedFrom': SOURCE_ID, 'source': source['source'], 'n': count,
            'faces': len(result.indices)//3, 'indexBytes': index_bytes, 'c': center, 'size': size,
            'mount': [0, 0, 0], 'forward': [1, 0, 0], 'up': [0, 1, 0], 'barrels': 2,
            'bounds': [low, high], 'sourcePackedSha256': hashlib.sha256(packed_source).hexdigest(),
            'sourceYawDeg': SOURCE_YAW_DEG, 'sourceUp': SOURCE_UP, 'sourceBase': SOURCE_BASE,
            'sourceFloorCorrectionM': -floor, 'housingVertices': housing_n, 'housingFaces': housing_faces,
            'drivePivots': drive_rows, 'barrelCenters': barrel_rows,
            'elevationPivot': pivot, 'elevationAxis': [0, 0, 1], 'barrelAxis': [1, 0, 0],
            'muzzlePoints': [row['muzzle'] for row in barrel_rows],
            'elevationVertexStart': housing_n, 'elevationIndexStart': housing_faces*3,
            'cradleVertexStart': cradle_start, 'cradleIndexStart': cradle_index,
            'nativeCalibration': 'user-photo-relative-to-quad500',
            'barrelRiseAbovePivotM': BORE_HEIGHT_M-pivot[1],
            'maxQuantizationErrorM': error,
            'modifications': 'Canonical DBY housing, turntable and circular drives retained with original UVs. '
                             'Both complete recessed-muzzle barrel meshes are levelled along +X and raised '
                             'above the mechanical drive axis; new armored cradles and ribs support their roots. '
                             'The fixed housing precedes one contiguous elevating barrel/cradle partition.',
            'data': base64.b64encode(packed).decode('ascii')}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference-data', type=Path, default=ROOT/'data/reference.js')
    parser.add_argument('--json-output', type=Path)
    parser.add_argument('--metadata-output', type=Path, default=ROOT/'assets/source/twin40-turret-manifest.json')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    asset = build(args.reference_data)
    if args.check:
        if registered_asset(args.reference_data, ASSET_ID) != asset:
            raise SystemExit('Raised twin40 turret registration is stale')
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(asset, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    metadata = {k: v for k, v in asset.items() if k != 'data'}
    metadata['packedSha256'] = hashlib.sha256(base64.b64decode(asset['data'])).hexdigest()
    if args.metadata_output and not args.check:
        args.metadata_output.parent.mkdir(parents=True, exist_ok=True)
        args.metadata_output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(json.dumps({k: metadata[k] for k in ['size', 'n', 'faces', 'elevationPivot', 'muzzlePoints',
                                             'elevationVertexStart', 'elevationIndexStart', 'packedSha256']}, indent=2))


if __name__ == '__main__':
    main()
