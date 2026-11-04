#!/usr/bin/env python3
"""Convert the supplied point-defense FBX to the game's reference mesh format.

Requires Blender 4.1 or newer; no extra Python packages are needed. Run from any
directory, passing a source FBX and destination JSON after Blender's `--`:

    blender --background --python scripts/import-pd-turret.py -- \
        assets/source/turret-small-1.fbx /tmp/pd-asset.json

Use --metadata-output PATH to also write a small provenance/geometry manifest,
and --reference-data data/reference.js to update the deployed asset registration.
The original mesh is retained without decimation. Indexed vertex splits preserve
the imported corner-normal boundaries when the game recomputes smooth normals.
"""

import argparse
import base64
import hashlib
import json
from pathlib import Path
import struct
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
from turret_compartment_metadata import attach_compartment
import sys

import bpy


def convert(source, length):
    """Return deterministic packed data for the single-mesh source asset."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.fbx(filepath=str(source))
    objects = [ob for ob in bpy.data.objects if ob.type == 'MESH']
    if len(objects) != 1:
        raise ValueError('Expected exactly one mesh in the point-defense FBX')
    ob = objects[0]
    mesh = ob.data
    mesh.calc_loop_triangles()

    world_points = [ob.matrix_world @ vertex.co for vertex in mesh.vertices]
    floor = min(point.z for point in world_points)
    source_length = (max(point.y for point in world_points)
                     - min(point.y for point in world_points))
    if source_length <= 0:
        raise ValueError('Source mesh has no forward-axis extent')
    scale = length / source_length
    # Authored Blender axes: barrels face -Y, floor normal is +Z. This proper
    # rotation keeps triangle winding, with the turntable center at X=Z=0.
    positions = [[-point.y * scale, (point.z - floor) * scale, -point.x * scale]
                 for point in world_points]
    low = [min(point[axis] for point in positions) for axis in range(3)]
    high = [max(point[axis] for point in positions) for axis in range(3)]
    size = [high[axis] - low[axis] for axis in range(3)]
    center = [(high[axis] + low[axis]) / 2 for axis in range(3)]
    if any(span <= 0 for span in size):
        raise ValueError('Source mesh must have extent along all three axes')

    vertices, indices, cache = [], [], {}
    normal_matrix = ob.matrix_world.to_3x3().inverted().transposed()
    for triangle in mesh.loop_triangles:
        for loop_index in triangle.loops:
            vertex_index = mesh.loops[loop_index].vertex_index
            normal = normal_matrix @ mesh.corner_normals[loop_index].vector
            normal.normalize()
            mapped_normal = (-normal.y, normal.z, -normal.x)
            # Never merge disconnected source vertices. Split a shared vertex
            # wherever the FBX supplied a different face-corner normal.
            key = (vertex_index,) + tuple(round(value, 5)
                                           for value in mapped_normal)
            if key not in cache:
                cache[key] = len(vertices)
                vertices.append(positions[vertex_index])
            indices.append(cache[key])

    count = len(vertices)
    index_bytes = 2 if count < 65536 else 4
    packed = bytearray()
    for point in vertices:
        for axis in range(3):
            value = round((point[axis] - center[axis]) / size[axis] * 65532)
            packed.extend(struct.pack('<h', value))
    # The source has a plain material and no textures. Supply the UV fields
    # required by decodeReference; the dedicated PD renderer uses plain color.
    for _ in vertices:
        packed.extend(struct.pack('<HH', 16384, 32768))
    index_format = '<H' if index_bytes == 2 else '<I'
    for index in indices:
        packed.extend(struct.pack(index_format, index))

    asset = {
        'title': 'Turret-Small-1.fbx — 連装点防御砲',
        'kind': 'fit',
        'plainMetal': True,
        'source': 'Turret-Small-1.fbx (user supplied)',
        'n': count,
        'faces': len(indices) // 3,
        'indexBytes': index_bytes,
        'c': center,
        'size': size,
        'mount': [0, 0, 0],
        'forward': [1, 0, 0],
        'up': [0, 1, 0],
        'data': base64.b64encode(packed).decode('ascii'),
    }
    attach_compartment('pd_turret_small', asset)
    metadata = {key: value for key, value in asset.items() if key != 'data'}
    metadata.update({
        'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'blender_version': bpy.app.version_string,
        'source_vertices': len(mesh.vertices),
        'source_polygons': len(mesh.polygons),
        'source_floor': floor,
        'uniform_scale': scale,
        'packed_bytes': len(packed),
        'packed_sha256': hashlib.sha256(packed).hexdigest(),
        'axis_mapping': ['-source_y', 'source_z - floor', '-source_x'],
    })
    return asset, metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Original single-mesh FBX')
    parser.add_argument('output', type=Path, help='Packed reference asset JSON')
    parser.add_argument('--length', type=float, default=9.0,
                        help='Total forward-axis extent in meters (default: 9)')
    parser.add_argument('--metadata-output', type=Path,
                        help='Optional small provenance manifest destination')
    parser.add_argument('--reference-data', type=Path,
                        help='Update the turret registration in reference.js')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:]
                             if '--' in sys.argv else [])
    if args.length <= 0:
        parser.error('--length must be positive')
    source = args.source.resolve(strict=True)
    asset, metadata = convert(source, args.length)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(asset, ensure_ascii=False,
                                     separators=(',', ':')), encoding='utf-8')
    if args.metadata_output:
        args.metadata_output.parent.mkdir(parents=True, exist_ok=True)
        args.metadata_output.write_text(json.dumps(metadata, ensure_ascii=False,
                                                  indent=2) + '\n',
                                        encoding='utf-8')
    if args.reference_data:
        prefix = 'Object.assign(YardReferenceData.assets,{"pd_turret_small":'
        content = args.reference_data.read_text(encoding='utf-8')
        registration = ('Object.assign(YardReferenceData.assets,'
                        + json.dumps({'pd_turret_small': asset},
                                     ensure_ascii=False, separators=(',', ':'))
                        + ');')
        lines = content.splitlines()
        found = [i for i, line in enumerate(lines) if line.startswith(prefix)]
        if len(found) != 1:
            raise ValueError('Expected exactly one PD registration in reference.js')
        lines[found[0]] = registration
        args.reference_data.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(json.dumps(metadata, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
