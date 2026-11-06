#!/usr/bin/env python3
"""Prepare the user-supplied CR90 STL, its six detached guns, and a closed hull.

Run with Blender. The render geometry retains the source triangles except the
six independent guns and the eleven printed nozzle closing disks.
An independent watertight voxel union supplies physical occupancy; overlapping
STL islands therefore do not cancel one another in point-in-hull tests.

blender --background --threads 4 --python scripts/import-cr90.py -- \
  --asset-output /tmp/cr90-hull-asset.json \
  --manifest-output assets/source/cr90/hull-manifest.json
"""
import argparse
import base64
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import sys

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE_NAME = '3-CR90_Corvette_Standard.STL'
LENGTH_M = 150.0
STL = np.dtype([('n', '<f4', (3,)), ('v', '<f4', (3, 3)), ('a', '<u2')])
SMALL = '1-CR90_Corvette_Standard_SmallTurret.STL'
TWIN = '5-CR90_Corvette_Standard_BigTurret.STL'
NATIVE_MOUNTS = {
    SMALL: ([1097.0673828125, -2028.1897583008, 641.7814941406], [1, 0, 0]),
    TWIN: ([.64766693115, -4499.446777344, 983.3418579102], [0, -1, 0]),
}
# These source-space rigid transforms reproduce the six mounted copies. Their
# maximum source-export rounding error is verified against actual master faces.
GUNS = [
    ('port-aft', SMALL, 'single6MT', [1, 1, 1], [0, 0, 0]),
    ('port-forward', SMALL, 'single6MT', [1, 1, 1], [.000516891479, -1017.20823, 0]),
    ('starboard-aft', SMALL, 'single6MT', [-1, -1, 1], [-8.95535133, -4056.38022, 0]),
    ('starboard-forward', SMALL, 'single6MT', [-1, -1, 1], [-8.95520592, -5073.58862, 0]),
    ('dorsal', TWIN, 'twin500MT', [1, 1, 1], [0, 0, 0]),
    ('ventral', TWIN, 'twin500MT', [-1, 1, -1], [.0131549194, .00261984542, 4.02079974]),
]


def read_stl(path):
    raw = path.read_bytes()
    if path.suffix.lower() == '.gz':
        raw = gzip.decompress(raw)
    count = struct.unpack_from('<I', raw, 80)[0]
    if len(raw) != 84 + 50 * count:
        raise ValueError('Expected a complete binary STL triangle table')
    triangles = np.frombuffer(raw, dtype=STL, offset=84, count=count)['v'].astype('f8')
    vertices, index = np.unique(np.round(triangles.reshape(-1, 3), 6), axis=0, return_inverse=True)
    return raw, triangles, vertices, index.reshape(-1, 3)


def detach_guns(vertices, faces, transform):
    from mathutils.kdtree import KDTree
    tree = KDTree(len(vertices))
    for index, point in enumerate(vertices):
        tree.insert(point, index)
    tree.balance()
    face_indices = {}
    for index, face in enumerate(faces):
        face_indices.setdefault(tuple(sorted(map(int, face))), []).append(index)
    removed, mounts = set(), []
    for label, filename, kind, signs, offset in GUNS:
        raw, triangles, _, _ = read_stl(ROOT / 'assets/source/corvette-weapons' / filename)
        signs, offset = np.array(signs), np.array(offset)
        source_copy = triangles * signs + offset
        matched, maximum_error = [], 0.0
        for triangle in source_copy:
            corners = []
            for point in triangle:
                _, vertex, distance = tree.find(point)
                if distance > .004:
                    raise ValueError('Mounted gun vertex does not match the source: ' + label)
                maximum_error = max(maximum_error, distance)
                corners.append(vertex)
            candidates = face_indices.get(tuple(sorted(corners)), [])
            face = next((index for index in candidates if index not in removed), None)
            if face is None:
                raise ValueError('Mounted gun triangle does not match the source: ' + label)
            removed.add(face)
            matched.append(face)
        source_mount, source_forward = NATIVE_MOUNTS[filename]
        mount = transform(np.array(source_mount) * signs + offset)
        origin = transform(np.zeros(3))
        forward = transform(np.array(source_forward) * signs) - origin
        up = transform(np.array([0, 0, 1]) * signs) - origin
        world = transform(source_copy.reshape(-1, 3))
        mounts.append({
            'label': label, 'kind': kind, 'source_filename': filename,
            'source_sha256': hashlib.sha256(raw).hexdigest(),
            'source_rotation_diagonal': signs.tolist(), 'source_translation': offset.tolist(),
            'removed_triangles': len(matched), 'matched_master_face_indices': matched,
            'maximum_source_vertex_error': maximum_error,
            'mount_m': mount.tolist(), 'forward': (forward / np.linalg.norm(forward)).tolist(),
            'up': (up / np.linalg.norm(up)).tolist(),
            'game_bounds_m': [world.min(0).tolist(), world.max(0).tolist()],
        })
    if len(removed) != 4 * 224 + 2 * 218:
        raise ValueError('The standard CR90 must detach four small and two twin guns')
    return np.array([i not in removed for i in range(len(faces))]), mounts


def pack_render(positions, faces, center, size):
    normals = np.cross(positions[faces[:, 1]] - positions[faces[:, 0]],
                       positions[faces[:, 2]] - positions[faces[:, 0]])
    normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-20)
    points, indices, groups = [], [], {}
    cosine = np.cos(np.deg2rad(30))
    for corner, vertex in enumerate(faces.reshape(-1)):
        normal = normals[corner // 3]
        smooth = groups.setdefault(int(vertex), [])
        index = next((index for representative, index in smooth
                      if np.dot(normal, representative) >= cosine), None)
        if index is None:
            index = len(points)
            points.append(positions[vertex])
            smooth.append((normal, index))
        indices.append(index)
    points = np.array(points)
    index_bytes = 2 if len(points) < 65536 else 4
    indices = np.array(indices, dtype='<u2' if index_bytes == 2 else '<u4')
    quantized = np.rint((points - center) / size * 65532).astype('<i2')
    uv = np.tile(np.array([16384, 32768], dtype='<u2'), (len(points), 1))
    return points, quantized.tobytes() + uv.tobytes() + indices.tobytes(), index_bytes


def bound_collision(points, faces, low, high):
    """Bisect the closed union at measured end planes and triangulate cut caps."""
    import bpy
    import bmesh
    from mathutils import Vector
    mesh = bpy.data.meshes.new('CR90 measured collision union')
    mesh.from_pydata(points.tolist(), [], faces.tolist())
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for axis in range(3):
        for coordinate, sign in [(low[axis], -1), (high[axis], 1)]:
            if not any(sign * (v.co[axis] - coordinate) > 1e-7 for v in bm.verts):
                continue
            origin, normal = [0, 0, 0], [0, 0, 0]
            origin[axis], normal[axis] = coordinate, sign
            cut = bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                                         dist=1e-7, plane_co=Vector(origin), plane_no=Vector(normal),
                                         clear_inner=False, clear_outer=True)
            edges = [edge for edge in cut['geom_cut'] if isinstance(edge, bmesh.types.BMEdge) and edge.is_boundary]
            if edges:
                bmesh.ops.triangle_fill(bm, edges=edges, normal=Vector(normal), use_beauty=True)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.0001)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=.0001)
    boundary = [edge for edge in bm.edges if edge.is_boundary]
    if boundary:
        bmesh.ops.holes_fill(bm, edges=boundary, sides=0)
    wires = [edge for edge in bm.edges if not edge.link_faces]
    if wires:
        bmesh.ops.delete(bm, geom=wires, context='EDGES')
    loose = [vertex for vertex in bm.verts if not vertex.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bad = sum(not edge.is_manifold for edge in bm.edges)
    if bad:
        raise ValueError('Bounded collision union is not closed: ' + str(bad) + ' ' + str([(len(e.link_faces), e.calc_length()) for e in bm.edges if not e.is_manifold][:10]))
    bm.to_mesh(mesh)
    bm.free()
    mesh.calc_loop_triangles()
    points = np.array([v.co[:] for v in mesh.vertices])
    faces = np.array([t.vertices[:] for t in mesh.loop_triangles])
    if np.any(np.linalg.norm(np.cross(points[faces[:, 1]] - points[faces[:, 0]],
                                      points[faces[:, 2]] - points[faces[:, 0]]), axis=1) < 1e-10):
        raise ValueError('Bounded collision union contains a collapsed triangle')
    return points, faces


def normalize_collision(points, faces, center, size):
    """Validate the actual quantized triangle payload, including cap diagonals."""
    normalized = np.round((points - center) / size, 7)
    normalized, remap = np.unique(normalized, axis=0, return_inverse=True)
    faces = remap[faces]
    groups = {}
    for index, face in enumerate(faces):
        groups.setdefault(tuple(sorted(map(int, face))), []).append(index)
    discard, removed_pairs = set(), 0
    for copies in groups.values():
        while len(copies) > 1:
            first = copies.pop()
            a = faces[first].tolist()
            reverse = next((other for other in copies if any(
                np.array_equal(faces[other], [a[i], a[(i + 2) % 3], a[(i + 1) % 3]])
                for i in range(3))), None)
            if reverse is None:
                discard.add(first)
            else:
                copies.remove(reverse)
                discard.update([first, reverse])
                removed_pairs += 1
    faces = faces[[i not in discard for i in range(len(faces))]]
    used, remap = np.unique(faces, return_inverse=True)
    normalized, faces = normalized[used], remap.reshape(-1, 3)
    cross = np.cross(normalized[faces[:, 1]] - normalized[faces[:, 0]],
                     normalized[faces[:, 2]] - normalized[faces[:, 0]])
    if np.any(np.linalg.norm(cross, axis=1) == 0):
        raise ValueError('Serialized collision payload contains a collapsed triangle')
    directed = np.concatenate((faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]))
    edges, count = np.unique(np.sort(directed, axis=1), axis=0, return_counts=True)
    if np.any(count != 2):
        raise ValueError('Serialized collision payload is not a closed manifold')
    orientation = {}
    for a, b in directed:
        key = (int(min(a, b)), int(max(a, b)))
        orientation[key] = orientation.get(key, 0) + (1 if a < b else -1)
    if any(orientation.values()):
        raise ValueError('Serialized collision payload has inconsistent face orientation')
    return normalized * size + center, faces, removed_pairs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT / 'assets/source/cr90/cr90-corvette-standard.stl.gz')
    parser.add_argument('--asset-output', type=Path, required=True)
    parser.add_argument('--manifest-output', type=Path, required=True)
    parser.add_argument('--voxel-size', type=float, default=.2)
    parser.add_argument('--collision-faces', type=int, default=8000)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else None)
    helper = importlib.util.spec_from_file_location('sphyrna_import_helpers', ROOT / 'scripts/import-sphyrna.py')
    module = importlib.util.module_from_spec(helper)
    helper.loader.exec_module(module)
    raw, triangles, vertices, faces = read_stl(args.source)
    lo, hi = triangles.min((0, 1)), triangles.max((0, 1))
    scale, lateral_center = LENGTH_M / (hi[1] - lo[1]), (lo[0] + hi[0]) / 2

    def transform(points):
        points = np.asarray(points)
        return np.stack(((hi[1] - points[..., 1]) * scale,
                         (points[..., 2] - lo[2]) * scale,
                         (lateral_center - points[..., 0]) * scale), axis=-1)

    positions = transform(vertices)
    labels = module.component_labels(vertices, faces)
    engine_components = []
    for label in np.unique(labels):
        face_mask = labels == label
        world = positions[faces[face_mask]].reshape(-1, 3)
        bounds = [world.min(0), world.max(0)]
        extent = bounds[1] - bounds[0]
        if bounds[0][0] < .001 and 23 < extent[0] < 25 and 8 < extent[1] < 9 and 8 < extent[2] < 9:
            engine_components.append({'source_component': int(label), 'triangles': int(face_mask.sum()),
                                      'mouth_m': [0, float((bounds[0][1] + bounds[1][1]) / 2),
                                                  float((bounds[0][2] + bounds[1][2]) / 2)],
                                      'outer_diameter_m': float((extent[1] + extent[2]) / 2),
                                      'source_casing_front_m': float(bounds[1][0]),
                                      'game_bounds_m': [b.tolist() for b in bounds]})
    if len(engine_components) != 11:
        raise ValueError('The supplied CR90 must preserve eleven measured engine mouths')
    engine_components.sort(key=lambda e: (-e['mouth_m'][1], e['mouth_m'][2]))
    keep, mounts = detach_guns(vertices, faces, transform)
    hull_faces = faces[keep]
    # Printed flat disks close the eleven engine mouths. Keep their closed
    # source volume for occupancy, but let the installed nozzles supply the
    # visible bell interiors and glow instead of drawing static covers.
    caps = np.zeros(len(faces), dtype=bool)
    detached_caps = []
    for engine in engine_components:
        y, z = engine['mouth_m'][1:]
        world = positions[faces]
        radial = np.sqrt((world[:, :, 1] - y) ** 2 + (world[:, :, 2] - z) ** 2)
        near_mouth = (world[:, :, 0].min(1) >= -1e-5) & (world[:, :, 0].max(1) < .75)
        cap = near_mouth & (np.ptp(world[:, :, 0], axis=1) < .001) & (radial.max(1) < 4.08)
        if int(cap.sum()) != 14:
            raise ValueError('Expected fourteen printed closing triangles per engine mouth')
        if np.any(cap & ~keep) or np.any(cap & caps):
            raise ValueError('Printed nozzle cap selections overlap')
        caps |= cap
        mouth_vertices = world[near_mouth & (radial.max(1) < 4.08)].reshape(-1, 3)
        radius = np.median(np.linalg.norm(mouth_vertices[:, 1:] - [y, z], axis=1))
        engine['nozzle_diameter_m'] = float(radius * 2)
        detached_caps.append({'mouth_m': engine['mouth_m'], 'triangles': int(cap.sum()),
                              'master_face_indices': np.flatnonzero(cap).tolist()})
    render_faces = faces[keep & ~caps]
    game_lo = np.array([0, 0, -(hi[0] - lo[0]) * scale / 2])
    game_hi = np.array([LENGTH_M, (hi[2] - lo[2]) * scale, -game_lo[2]])
    center, size = (game_lo + game_hi) / 2, game_hi - game_lo
    print('Packing non-weapon render triangles:', len(render_faces), flush=True)
    points, payload, index_bytes = pack_render(positions, render_faces, center, size)
    print('Building independent closed collision union', flush=True)
    cv, cf, union_faces = module.collider(positions, hull_faces, args.voxel_size, args.collision_faces)
    cv, cf = bound_collision(cv, cf, game_lo, game_hi)
    cv, cf, removed_pairs = normalize_collision(cv, cf, center, size)
    signed_volume = np.einsum('ij,ij->i', cv[cf[:, 0]], np.cross(cv[cf[:, 1]], cv[cf[:, 2]])).sum() / 6
    if signed_volume < 0:
        cf = cf[:, [0, 2, 1]]
        signed_volume *= -1
    collision = np.round((cv[cf.reshape(-1)] - center) / size, 7).reshape(-1).tolist()
    asset = {'title': 'CR90コルベット — 提供STLの船体', 'kind': 'structure', 'plainMetal': True,
             'source': SOURCE_NAME + ' (user supplied; author and license not supplied)',
             'sourceSha256': hashlib.sha256(raw).hexdigest(), 'n': len(points),
             'faces': len(render_faces), 'indexBytes': index_bytes, 'c': center.tolist(), 'size': size.tolist(),
             'data': base64.b64encode(payload).decode('ascii'), 'collider': collision}
    manifest = {'source_filename': SOURCE_NAME, 'stored_source': str(args.source.relative_to(ROOT)),
                'source_sha256': hashlib.sha256(raw).hexdigest(),
                'stored_source_sha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
                'source_bytes': len(raw), 'source_triangles': len(faces), 'source_unique_vertices': len(vertices),
                'source_components': len(np.unique(labels)), 'author': None, 'license': None,
                'source_bounds': [lo.tolist(), hi.tolist()], 'length_m': LENGTH_M, 'uniform_scale': scale,
                'axis_mapping': ['(source_y_max - source_y) * scale', '(source_z - source_z_min) * scale',
                                 '(source_x_mid - source_x) * scale'],
                'asset_key': 'cr90_stl_hull', 'asset_center_m': center.tolist(), 'asset_size_m': size.tolist(),
                'render_vertices': len(points), 'render_triangles': len(render_faces), 'index_bytes': index_bytes,
                'render_smoothing_angle_degrees': 30, 'packed_sha256': hashlib.sha256(payload).hexdigest(),
                'detached_weapon_triangles': int((~keep).sum()), 'detached_weapons': mounts,
                'engine_mouths': engine_components, 'detached_nozzle_caps': detached_caps,
                'detached_nozzle_cap_triangles': int(caps.sum()), 'collision_bounds_clamped_to_source': True, 'collision_voxel_size_m': args.voxel_size,
                'collision_union_triangles': union_faces, 'collision_triangles': len(cf),
                'collision_vertices': len(cv), 'collision_components': len(np.unique(module.component_labels(cv, cf))),
                'collision_nonmanifold_edges': 0, 'collision_volume_m3': float(signed_volume),
                'collision_internal_opposite_face_pairs_removed': removed_pairs,
                'collision_serialized_topology_verified': True,
                'collision_bounds_m': [cv.min(0).tolist(), cv.max(0).tolist()],
                'notes': ['Source render triangles are retained at one uniform 150 m scale, apart from six independent guns and printed nozzle closing disks.',
                          'Six exact complete native gun copies are detached; fixed sockets remain in the hull.',
                          'Only fourteen flat closing triangles per engine mouth are hidden in the render; installed nozzle bells and glow replace them. Closed source occupancy is retained.',
                          'Collision is an independent closed union; it does not supply performance or machinery.',
                          'The eleven measured engine mouths belong to eleven independent installed engine/nozzle units.',
                          'Source authorship and license were not supplied; the previous CR90 attribution does not apply.']}
    for path, value in [(args.asset_output, asset), (args.manifest_output, manifest)]:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False, indent=2 if path == args.manifest_output else None,
                                   separators=None if path == args.manifest_output else (',', ':')) + '\n')
    print(json.dumps({key: value for key, value in manifest.items()
                      if key not in ['detached_weapons', 'engine_mouths']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
