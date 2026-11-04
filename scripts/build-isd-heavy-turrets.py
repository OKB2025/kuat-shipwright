#!/usr/bin/env python3
"""Build textured twin/eight-barrel turrets from the deployed LarsH ISD mesh.

Run from any directory; only the Python standard library is required:

    python scripts/build-isd-heavy-turrets.py

The original packed six-barrel asset remains the reproducible source. Whole
connected barrels are removed, the housing is levelled, and copies of each
chamber's middle barrel supply the two variants. No housing faces or UVs change.
"""

import argparse
import base64
import hashlib
import json
import math
from pathlib import Path
import struct


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ASSET = 'isd_turret'
SOURCE_UP = (0.06811, 0.97392, 0.21645)
TWIN_RADIAL_SCALE = 1.3
OCTUPLE_RADIAL_RATIO = (40 / 175) ** (1 / 3)
OCTUPLE_SPACING = 1.4
REGISTRATION_PREFIX = 'Object.assign(YardImperial2Data.assets,{"isd_heavy_twin":'


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]]


def unit(v):
    length = math.sqrt(dot(v, v))
    return [x / length for x in v]


def average(points):
    return [sum(p[k] for p in points) / len(points) for k in range(3)]


def bounds(points):
    return ([min(p[k] for p in points) for k in range(3)],
            [max(p[k] for p in points) for k in range(3)])


def principal_axis(points):
    center = average(points)
    centered = [sub(p, center) for p in points]
    covariance = [[sum(p[i] * p[j] for p in centered)
                   for j in range(3)] for i in range(3)]
    axis = [0, 0, 1]
    for _ in range(32):
        axis = unit([dot(row, axis) for row in covariance])
    return axis if axis[2] > 0 else [-v for v in axis]


def solve(matrix, vector):
    rows = [list(row) + [value] for row, value in zip(matrix, vector)]
    for col in range(3):
        pivot = max(range(col, 3), key=lambda row: abs(rows[row][col]))
        rows[col], rows[pivot] = rows[pivot], rows[col]
        divisor = rows[col][col]
        rows[col] = [v / divisor for v in rows[col]]
        for row in range(3):
            if row != col:
                factor = rows[row][col]
                rows[row] = [x - factor * y
                             for x, y in zip(rows[row], rows[col])]
    return [row[3] for row in rows]


def decode(asset, source):
    packed = base64.b64decode(source['data'])
    count = asset['n']
    positions = [[struct.unpack_from('<h', packed, i * 6 + k * 2)[0]
                  / 65532 * asset['size'][k] for k in range(3)]
                 for i in range(count)]
    uvs = [struct.unpack_from('<HH', packed, count * 6 + i * 4)
           for i in range(count)]
    fmt = '<H' if asset['indexBytes'] == 2 else '<I'
    indices = [struct.unpack_from(fmt, packed,
                                  count * 10 + i * asset['indexBytes'])[0]
               for i in range(asset['faces'] * 3)]
    return positions, uvs, indices, packed


def connected_components(positions, indices):
    """Join mesh vertices and exact coincident UV splits without cutting faces."""
    parents = list(range(len(positions)))

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    def join(a, b):
        a, b = find(a), find(b)
        if a != b:
            parents[a] = b

    for i in range(0, len(indices), 3):
        a, b, c = indices[i:i + 3]
        join(a, b)
        join(b, c)
    coincident = {}
    for i, position in enumerate(positions):
        key = tuple(position)
        if key in coincident:
            join(i, coincident[key])
        else:
            coincident[key] = i
    components = {}
    for i in range(len(positions)):
        components.setdefault(find(i), []).append(i)
    return sorted(components.values(), key=lambda vertices: min(vertices))


def source_frame(positions, components, barrels):
    # Fit the lower pedestal ring's authored floor. The historical renderer's
    # rounded up vector identifies that ring; a least-squares plane removes its
    # small residual tilt without introducing a dependency on NumPy or Blender.
    pedestal = max(components,
                   key=lambda c: math.prod(bounds([positions[i] for i in c])[1][k]
                                           - bounds([positions[i] for i in c])[0][k]
                                           for k in [0, 2]))
    projected = {i: dot(positions[i], SOURCE_UP) for i in pedestal}
    floor = min(projected.values())
    ring = [positions[i] for i in pedestal if projected[i] < floor + .05]
    rows = [[p[0], p[2], 1] for p in ring]
    coefficients = solve([[sum(r[i] * r[j] for r in rows)
                           for j in range(3)] for i in range(3)],
                         [sum(r[i] * p[1] for r, p in zip(rows, ring))
                          for i in range(3)])
    up = unit([-coefficients[0], 1, -coefficients[1]])
    forward = unit(average([principal_axis([positions[i] for i in c])
                            for c in barrels]))
    forward = unit(sub(forward, [dot(forward, up) * x for x in up]))
    right = unit(cross(forward, up))
    frame = (forward, up, right)
    local = [[dot(p, axis) for axis in frame] for p in positions]
    ring_local = [[dot(p, axis) for axis in frame] for p in ring]
    low, high = bounds(ring_local)
    mount = [(low[0] + high[0]) / 2, sum(p[1] for p in ring_local)
             / len(ring_local), (low[2] + high[2]) / 2]
    local = [sub(p, mount) for p in local]
    # Quantized source vertices differ from their fitted plane by < 0.2 mm.
    # Lift both variants by that common amount so no housing vertex is below 0.
    floor_correction = min(p[1] for p in local)
    for p in local:
        p[1] -= floor_correction
    return local, frame


def pack_asset(positions, uvs, indices, barrels, metadata):
    low, high = bounds(positions)
    size = [high[k] - low[k] for k in range(3)]
    center = [(high[k] + low[k]) / 2 for k in range(3)]
    count = len(positions)
    index_bytes = 2 if count < 65536 else 4
    packed = bytearray()
    for p in positions:
        for k in range(3):
            packed.extend(struct.pack('<h', round((p[k] - center[k])
                                                  / size[k] * 65532)))
    for uv in uvs:
        packed.extend(struct.pack('<HH', *uv))
    for index in indices:
        packed.extend(struct.pack('<H' if index_bytes == 2 else '<I', index))
    asset = {
        'title': '連装重ターボレーザー砲塔' if barrels == 2
                 else '8連装40TTターボレーザー砲塔',
        'kind': 'weapon', 'c': center, 'size': size, 'n': count,
        'faces': len(indices) // 3, 'indexBytes': index_bytes,
        'source': 'LarsH. (CC-BY-4.0)',
        'sourceUrl': 'https://sketchfab.com/3d-models/'
                     'imperial-i-class-star-destroyer-6913bf20402a4eaea3e59109db0fbea4',
        'license': 'CC-BY-4.0',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'derivedFrom': SOURCE_ASSET, 'mount': [0, 0, 0],
        'forward': [1, 0, 0], 'up': [0, 1, 0], 'barrels': barrels,
        'bounds': [low, high], 'housingComponents': 15,
        'housingVertices': 628, 'housingFaces': 432,
        'barrelVertices': 101, 'barrelFaces': 84,
        'barrelRadialScale': TWIN_RADIAL_SCALE
                             * (1 if barrels == 2 else OCTUPLE_RADIAL_RATIO),
        'modifications': 'Shared original housing and UVs; six whole barrel '
                         'components replaced by two thick or eight thin copies; '
                         'pedestal floor and forward axis normalized. No decimation.',
        **metadata,
        'data': base64.b64encode(packed).decode('ascii'),
    }
    error = 0
    for i, p in enumerate(positions):
        decoded = [struct.unpack_from('<h', packed, i * 6 + k * 2)[0]
                   / 65532 * size[k] + center[k] for k in range(3)]
        error = max(error, math.sqrt(sum((x - y) ** 2
                                        for x, y in zip(decoded, p))))
    asset['maxQuantizationErrorM'] = error
    return asset


def build(reference):
    line = next(line for line in reference.read_text(encoding='utf-8').splitlines()
                if line.startswith('const YardReferenceData='))
    assets = json.loads(line.removeprefix('const YardReferenceData=').removesuffix(';'))['assets']
    asset = assets[SOURCE_ASSET]
    source = asset if 'data' in asset else assets[asset['dataFrom']]
    positions, uvs, indices, source_bytes = decode(asset, source)
    components = connected_components(positions, indices)
    barrels = [c for c in components if len(c) == 101
               and bounds([positions[i] for i in c])[1][2]
               - bounds([positions[i] for i in c])[0][2] > 13]
    if len(components) != 21 or len(barrels) != 6:
        raise ValueError('Source must contain 21 components, including six intact barrels')
    local, frame = source_frame(positions, components, barrels)
    barrel_vertices = {i for c in barrels for i in c}
    housing = [i for i in range(len(positions)) if i not in barrel_vertices]
    housing_set = set(housing)
    housing_faces = [indices[i:i + 3] for i in range(0, len(indices), 3)
                     if indices[i] in housing_set]
    if len(housing) != 628 or len(housing_faces) != 432:
        raise ValueError('Source housing geometry changed')
    barrel_centers = {tuple(c): [(lo + hi) / 2
                                 for lo, hi in zip(*bounds([local[i] for i in c]))]
                      for c in barrels}
    barrels.sort(key=lambda c: barrel_centers[tuple(c)][2])
    chambers = [barrels[:3], barrels[3:]]
    metadata = {
        'sourcePackedSha256': hashlib.sha256(source_bytes).hexdigest(),
        'sourceFrame': [list(axis) for axis in frame],
        'housingSourceVertices': housing,
        'barrelLengthPreserved': True,
        'octupleToTwinRadialRatio': OCTUPLE_RADIAL_RATIO,
    }
    variants = {}
    for count, key in [(2, 'isd_heavy_twin'), (8, 'isd_heavy_octuple')]:
        out_pos, out_uv = [local[i] for i in housing], [uvs[i] for i in housing]
        mapping = {index: i for i, index in enumerate(housing)}
        out_idx = [mapping[i] for face in housing_faces for i in face]
        radial = TWIN_RADIAL_SCALE * (1 if count == 2 else OCTUPLE_RADIAL_RATIO)
        for chamber in chambers:
            source_barrel = chamber[1]
            center = barrel_centers[tuple(source_barrel)]
            chamber_center = average([barrel_centers[tuple(c)] for c in chamber])
            source_set = set(source_barrel)
            faces = [indices[i:i + 3] for i in range(0, len(indices), 3)
                     if indices[i] in source_set]
            for j in range(count // 2):
                target_z = chamber_center[2] + (j - (count // 2 - 1) / 2) * OCTUPLE_SPACING
                mapping = {}
                for index in source_barrel:
                    p = local[index]
                    mapping[index] = len(out_pos)
                    out_pos.append([p[0], center[1] + (p[1] - center[1]) * radial,
                                    target_z + (p[2] - center[2]) * radial])
                    out_uv.append(uvs[index])
                out_idx.extend(mapping[i] for face in faces for i in face)
        variants[key] = pack_asset(out_pos, out_uv, out_idx, count, metadata)
    # Repacking both variants uses the same housing bounds, so all shared
    # housing positions and UV fields must remain byte-identical.
    twin, octuple = variants.values()
    twin_bytes, octuple_bytes = [base64.b64decode(a['data']) for a in [twin, octuple]]
    assert twin['size'] == octuple['size'] and twin['c'] == octuple['c']
    assert twin_bytes[:628 * 6] == octuple_bytes[:628 * 6]
    assert twin_bytes[twin['n'] * 6:twin['n'] * 6 + 628 * 4] == octuple_bytes[octuple['n'] * 6:octuple['n'] * 6 + 628 * 4]
    return variants


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference-data', type=Path, default=ROOT / 'data/reference.js')
    parser.add_argument('--destination', type=Path, default=ROOT / 'data/imperial2.js')
    parser.add_argument('--json-output', type=Path,
                        help='Optional unpackable generated asset JSON for previews')
    parser.add_argument('--check', action='store_true',
                        help='Verify the deployed registration without writing')
    args = parser.parse_args()
    assets = build(args.reference_data)
    registration = ('Object.assign(YardImperial2Data.assets,'
                    + json.dumps(assets, ensure_ascii=False, separators=(',', ':')) + ');')
    content = args.destination.read_text(encoding='utf-8')
    lines = content.splitlines()
    found = [i for i, line in enumerate(lines) if line.startswith(REGISTRATION_PREFIX)]
    if len(found) > 1:
        raise ValueError('Multiple generated heavy-turret registrations found')
    if args.check:
        if not found or lines[found[0]] != registration:
            raise ValueError('Generated assets differ; run the converter again')
    elif found:
        lines[found[0]] = registration
        args.destination.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    else:
        args.destination.write_text(content.rstrip() + '\n'
                                    + '// Shared LarsH housing; generated by scripts/build-isd-heavy-turrets.py.\n'
                                    + registration + '\n', encoding='utf-8')
    if args.json_output:
        args.json_output.write_text(json.dumps(assets, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({key: {k: asset[k] for k in ['n', 'faces', 'size', 'bounds', 'barrels', 'maxQuantizationErrorM']}
                      for key, asset in assets.items()}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
