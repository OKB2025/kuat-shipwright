#!/usr/bin/env python3
"""Derive the Arquitens quad 500 GT turret from the supplied small dual-purpose gun.

Only Python's standard library is required. Each original barrel is copied twice
vertically, preserving complete barrel triangles (including the recessed muzzle)
and every original housing face. The native envelope is measured on the user's
325 m Arquitens STL. Local +X is forward, +Y up, the turntable floor is Y=0.

    python scripts/build-arquitens-turret.py --json-output /tmp/arq-quad500.json
    python scripts/build-arquitens-turret.py --write-registration
    python scripts/build-arquitens-turret.py --check
"""
import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ID = 'pd_turret_small'
ASSET_ID = 'arq_turret_quad500'
# Full main-gun envelope after the source cruiser is scaled uniformly to 325 m.
TARGET_SIZE_M = [17.8304, 5.8065, 14.1041]
VERTICAL_PAIR_OFFSET_M = .43  # source-space: within the existing side trunnions
PREFIX = 'Object.assign(YardReferenceData.assets,{"' + ASSET_ID + '":'


def registration_asset(path, asset_id):
    prefix = 'Object.assign(YardReferenceData.assets,{"' + asset_id + '":'
    matches = [line for line in path.read_text(encoding='utf-8').splitlines()
               if line.startswith(prefix)]
    if len(matches) != 1:
        raise ValueError('Expected exactly one registration for ' + asset_id)
    return json.loads(matches[0][len('Object.assign(YardReferenceData.assets,'):-2])[asset_id]


def bounds(points):
    return ([min(p[k] for p in points) for k in range(3)],
            [max(p[k] for p in points) for k in range(3)])


def decode(asset):
    data = base64.b64decode(asset['data'])
    n = asset['n']
    points = [[struct.unpack_from('<h', data, i * 6 + k * 2)[0]
               / 65532 * asset['size'][k] + asset['c'][k] for k in range(3)]
              for i in range(n)]
    uvs = [struct.unpack_from('<HH', data, n * 6 + i * 4) for i in range(n)]
    fmt = '<H' if asset['indexBytes'] == 2 else '<I'
    indices = [struct.unpack_from(fmt, data, n * 10 + i * asset['indexBytes'])[0]
               for i in range(asset['faces'] * 3)]
    return points, uvs, indices, data


def components(points, indices):
    parent = list(range(len(points)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def join(a, b):
        a, b = find(a), find(b)
        if a != b:
            parent[a] = b

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
    result = {}
    for i in range(len(points)):
        result.setdefault(find(i), []).append(i)
    return sorted(result.values(), key=min)


def build(reference, size=TARGET_SIZE_M):
    source = registration_asset(reference, SOURCE_ID)
    points, uv, indices, source_data = decode(source)
    groups = components(points, indices)
    barrels = []
    for group in groups:
        low, high = bounds([points[i] for i in group])
        if len(group) == 1824 and high[0] - low[0] > 6 and high[1] - low[1] < .7:
            barrels.append(group)
    if len(groups) != 63 or len(barrels) != 2:
        raise ValueError('PD source must retain 63 components and two intact barrels')
    barrel_set = {i for group in barrels for i in group}
    housing = [i for i in range(len(points)) if i not in barrel_set]
    housing_set = set(housing)
    housing_faces = [indices[i:i + 3] for i in range(0, len(indices), 3)
                     if indices[i] in housing_set]
    if any(any(v not in housing_set for v in tri) for tri in housing_faces):
        raise ValueError('A barrel is attached to a housing triangle')
    out_points = [points[i][:] for i in housing]
    out_uv = [uv[i] for i in housing]
    mapping = {v: i for i, v in enumerate(housing)}
    out_indices = [mapping[i] for tri in housing_faces for i in tri]
    barrel_metadata = []
    barrels.sort(key=lambda group: sum(points[i][2] for i in group) / len(group))
    for group in barrels:
        source_low, source_high = bounds([points[i] for i in group])
        center = [(a + b) / 2 for a, b in zip(source_low, source_high)]
        group_set = set(group)
        faces = [indices[i:i + 3] for i in range(0, len(indices), 3)
                 if indices[i] in group_set]
        for row, shift in [('lower', -VERTICAL_PAIR_OFFSET_M),
                           ('upper', VERTICAL_PAIR_OFFSET_M)]:
            mapping = {}
            first = len(out_points)
            for i in group:
                mapping[i] = len(out_points)
                out_points.append([points[i][0], points[i][1] + shift, points[i][2]])
                out_uv.append(uv[i])
            out_indices.extend(mapping[i] for tri in faces for i in tri)
            barrel_metadata.append({'side': 'left' if center[2] < 0 else 'right',
                                    'row': row, 'firstVertex': first,
                                    'vertices': len(group), 'faces': len(faces),
                                    'sourceCenter': [center[0], center[1] + shift, center[2]]})
    low, high = bounds(out_points)
    native_size = [b - a for a, b in zip(low, high)]
    factors = [target / span for target, span in zip(size, native_size)]
    # The turntable and housing adapt to the measured box. Each circular tube
    # retains the same radial scale in Y and Z instead of acquiring an oval bore.
    for barrel in barrel_metadata:
        z_center = barrel['sourceCenter'][2]
        for i in range(barrel['firstVertex'], barrel['firstVertex'] + barrel['vertices']):
            out_points[i][2] = z_center + (out_points[i][2] - z_center) * factors[1] / factors[2]
    out_points = [[v * factors[k] for k, v in enumerate(p)] for p in out_points]
    for barrel in barrel_metadata:
        barrel['centerM'] = [v * factors[k] for k, v in enumerate(barrel.pop('sourceCenter'))]
    low, high = bounds(out_points)
    size = [b - a for a, b in zip(low, high)]
    center = [(a + b) / 2 for a, b in zip(low, high)]
    n = len(out_points)
    index_bytes = 2 if n < 65536 else 4
    packed = bytearray()
    for point in out_points:
        for k in range(3):
            packed.extend(struct.pack('<h', round((point[k] - center[k]) / size[k] * 65532)))
    for pair in out_uv:
        packed.extend(struct.pack('<HH', *pair))
    for i in out_indices:
        packed.extend(struct.pack('<H' if index_bytes == 2 else '<I', i))
    max_error = max(math.dist(point, [struct.unpack_from('<h', packed, i * 6 + k * 2)[0]
                                     / 65532 * size[k] + center[k] for k in range(3)])
                    for i, point in enumerate(out_points))
    asset = {'title': '500GT 4連装中型ターボレーザー砲塔', 'kind': 'fit',
             'plainMetal': True, 'source': 'Turret-Small-1.fbx (user supplied), derived quad mount',
             'derivedFrom': SOURCE_ID, 'n': n, 'faces': len(out_indices) // 3,
             'indexBytes': index_bytes, 'c': center, 'size': size, 'mount': [0, 0, 0],
             'forward': [1, 0, 0], 'up': [0, 1, 0], 'barrels': 4,
             'layout': 'two vertical barrels on each side',
             'bounds': [low, high], 'sourcePackedSha256': hashlib.sha256(source_data).hexdigest(),
             'housingVertices': len(housing), 'housingFaces': len(housing_faces),
             'barrelVertices': len(barrels[0]), 'barrelFaces': len(faces),
             'barrelCenters': barrel_metadata, 'axisScale': factors,
             'barrelRadialScale': factors[1],
             'maxQuantizationErrorM': max_error,
             'modifications': 'Original housing and all its faces retained; each complete barrel copied '
                              'into upper/lower rows at the two sides, including recessed muzzle '
                              'geometry and original UVs. Native envelope follows supplied Arquitens STL.',
             'data': base64.b64encode(packed).decode('ascii')}
    return asset


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference-data', type=Path, default=ROOT / 'data/reference.js')
    parser.add_argument('--json-output', type=Path)
    parser.add_argument('--metadata-output', type=Path)
    parser.add_argument('--length', type=float, default=TARGET_SIZE_M[0])
    parser.add_argument('--height', type=float, default=TARGET_SIZE_M[1])
    parser.add_argument('--width', type=float, default=TARGET_SIZE_M[2])
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--write-registration', action='store_true')
    args = parser.parse_args()
    size = [args.length, args.height, args.width]
    if any(not math.isfinite(v) or v <= 0 for v in size):
        parser.error('Dimensions must be finite and positive')
    asset = build(args.reference_data, size)
    registration = 'Object.assign(YardReferenceData.assets,' + json.dumps({ASSET_ID: asset},
                        ensure_ascii=False, separators=(',', ':')) + ');'
    if args.json_output:
        args.json_output.parent.mkdir(parents=True, exist_ok=True)
        args.json_output.write_text(json.dumps(asset, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    metadata = {k: v for k, v in asset.items() if k != 'data'}
    metadata['packedSha256'] = hashlib.sha256(base64.b64decode(asset['data'])).hexdigest()
    if args.metadata_output:
        args.metadata_output.parent.mkdir(parents=True, exist_ok=True)
        args.metadata_output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.check:
        current = registration_asset(args.reference_data, ASSET_ID)
        if current != asset:
            raise SystemExit('Arquitens quad turret registration is stale')
    if args.write_registration:
        lines = args.reference_data.read_text(encoding='utf-8').splitlines()
        found = [i for i, line in enumerate(lines) if line.startswith(PREFIX)]
        if len(found) > 1:
            raise ValueError('Multiple quad turret registrations')
        if found:
            lines[found[0]] = registration
        else:
            lines.append(registration)
        args.reference_data.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
