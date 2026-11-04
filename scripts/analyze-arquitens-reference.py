#!/usr/bin/env python3
"""Extract the supplied Arquitens STL for offline native-design comparisons.

This produces measurement data only; it never registers a ship mesh with the
game. The four source main-gun assemblies and three inner nozzle funnels are
excluded so normal native hull structures can be compared on the same basis.
Only the Python standard library is required.

    python3 scripts/analyze-arquitens-reference.py --output-dir /tmp/arquitens-reference
"""
import argparse
from array import array
import hashlib
import json
from pathlib import Path
import struct
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
ROW = struct.Struct('<12fH')


def extract(source, output):
    raw = source.read_bytes()
    count = struct.unpack_from('<I', raw, 80)[0]
    if len(raw) != 84 + count * ROW.size:
        raise ValueError('Expected a complete binary STL triangle table')
    low, high = [float('inf')] * 3, [float('-inf')] * 3
    for row in ROW.iter_unpack(memoryview(raw)[84:]):
        for start in (3, 6, 9):
            for k in range(3):
                low[k] = min(low[k], row[start + k])
                high[k] = max(high[k], row[start + k])
    scale = 325 / (high[1] - low[1])
    source_x_mid = (low[0] + high[0]) / 2
    vertices, triangles, index, parent = [], [], {}, []

    def find(n):
        while parent[n] != n:
            parent[n] = parent[parent[n]]
            n = parent[n]
        return n

    for row in ROW.iter_unpack(memoryview(raw)[84:]):
        triangle = []
        for start in (3, 6, 9):
            x, y, z = row[start:start + 3]
            point = ((high[1] - y) * scale, (z - low[2]) * scale,
                     (source_x_mid - x) * scale)
            key = tuple(round(v, 5) for v in point)
            i = index.get(key)
            if i is None:
                i = len(vertices)
                index[key] = i
                vertices.append(point)
                parent.append(i)
            triangle.append(i)
        a, b, c = map(find, triangle)
        parent[b] = a
        parent[c] = a
        triangles.append(triangle)

    groups = {}
    for triangle in triangles:
        key = find(triangle[0])
        group = groups.setdefault(key, {'faces': 0, 'lo': [float('inf')] * 3,
                                        'hi': [float('-inf')] * 3})
        group['faces'] += 1
        for i in triangle:
            for k, value in enumerate(vertices[i]):
                group['lo'][k] = min(group['lo'][k], value)
                group['hi'][k] = max(group['hi'][k], value)

    manifest = json.loads((ROOT / 'assets/source/arquitens-manifest.json').read_text())
    cy = (high[2] - low[2]) * scale / 2
    windows = []
    for gun in manifest['gun_mounts']:
        a, b = gun['source_centered_bounds_m']
        windows.append(([162.5 - b[1] - .005, cy + a[2] - .005, -b[0] - .005],
                        [162.5 - a[1] + .005, cy + b[2] + .005, -a[0] + .005]))
    guns = {key for key, group in groups.items()
            if any(all(group['lo'][k] >= a[k] and group['hi'][k] <= b[k]
                       for k in range(3)) for a, b in windows)}
    removed_guns, removed_bores = 0, 0
    packed = array('f')
    for triangle in triangles:
        if find(triangle[0]) in guns:
            removed_guns += 1
            continue
        points = [vertices[i] for i in triangle]
        if all(p[0] < 14 for p in points) and any(
                all((p[1] - bore['mouth_m'][1]) ** 2 +
                    (p[2] - bore['mouth_m'][2]) ** 2 < 9.25 ** 2 for p in points)
                for bore in manifest['engine_bores']):
            removed_bores += 1
            continue
        for point in points:
            packed.extend(point)
    if removed_guns != 23420 or removed_bores != 6930:
        raise ValueError(f'Incomplete source isolation: guns={removed_guns}, bores={removed_bores}')
    if sys.byteorder != 'little':
        packed.byteswap()
    output.mkdir(parents=True, exist_ok=True)
    payload = packed.tobytes()
    (output / 'hull-triangles.f32').write_bytes(payload)
    metadata = {
        'source': source.name, 'source_sha256': hashlib.sha256(raw).hexdigest(),
        'sourceTriangles': count, 'triangleCount': len(packed) // 9,
        'componentCount': len(groups), 'removedGunTriangles': removed_guns,
        'removedInnerNozzleTriangles': removed_bores,
        'format': 'Little-endian Float32, triangle-major XYZ',
        'coordinates': 'Metres: X stern 0 to bow 325; Y up; Z starboard.',
        'bounds': [[0, 0, -(high[0] - low[0]) * scale / 2],
                   [325, (high[2] - low[2]) * scale, (high[0] - low[0]) * scale / 2]],
        'payload_sha256': hashlib.sha256(payload).hexdigest(),
        'scope': 'Offline hull/cowling/detail comparison only. Source guns and inner nozzle funnels excluded. Never registered in the runtime.'}
    (output / 'hull-metadata.json').write_text(json.dumps(metadata, indent=2) + '\n')
    components = sorted(groups.values(), key=lambda g: -g['faces'])
    (output / 'source-components.json').write_text(json.dumps(components, indent=2) + '\n')
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'assets/source/arquitens.stl')
    parser.add_argument('--output-dir', type=Path, default=Path(tempfile.gettempdir()) / 'arquitens-reference')
    args = parser.parse_args()
    print(json.dumps(extract(args.source, args.output_dir)))


if __name__ == '__main__':
    main()
