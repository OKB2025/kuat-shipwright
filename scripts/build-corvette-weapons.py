#!/usr/bin/env python3
"""Import the supplied CR90 and Sphyrna weapon triangles at their hull scales.

There are two deliberately separate energy classes: 500 MT = .0005 TT light
turbolasers and 6 MT = .000006 TT heavy lasers, per barrel. Source geometry
never sets output. The independent STL coordinates are preserved by one rigid
frame and one uniform scale; no generated pedestal or enlarged gun is added.
The Sphyrna bow pair is cut from the complete supplied hull's own components.

Outputs are reviewable candidates. This script does not modify runtime files.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

import numpy as np

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'assets/source/corvette-weapons'
spec = importlib.util.spec_from_file_location('corvette_mesh_writer', ROOT / 'scripts/build-turret-family.py')
F = importlib.util.module_from_spec(spec)
spec.loader.exec_module(F)
CR90_SCALE = 150 / 15758.427734375
SPHYRNA_SCALE = 116.7 / (60.848838806152344 - (-48.10793685913086))
KEYS = ['quad500MT', 'twin500MT', 'single500MT', 'single6MT', 'twin6MT', 'sphyrnaTwin500MT']
CATALOG = [
    {'key': 'quad500MT', 'asset': 'cr90_light_quad500mt', 'name': '500MT 4連装軽ターボレーザー', 'short': '500MT 軽TL4連装',
     'barrels': 4, 'boltTT': .0005, 'cycle': 1, 'mass': 260, 'crew': 4, 'cost': 45000, 'aa': .15, 'dualPurpose': False,
     'weaponFamily': 'light-turbolaser', 'variant': 'CR90 Phoenix',
     'desc': '500 MT（0.0005 TT）の軽ターボレーザー4門。一斉射2 GT。提供されたCR90フェニックス型STLの4本の砲身と砲室を、その船体に合わせた実寸で使用する。'},
    {'key': 'twin500MT', 'asset': 'cr90_light_twin500mt', 'name': '500MT 2連装軽ターボレーザー（CR90型）', 'short': '500MT 軽TL2連装',
     'barrels': 2, 'boltTT': .0005, 'cycle': 1, 'mass': 220, 'crew': 3, 'cost': 30000, 'aa': .1, 'dualPurpose': False,
     'weaponFamily': 'light-turbolaser', 'variant': 'CR90 Standard',
     'desc': '500 MT（0.0005 TT）の軽ターボレーザー2門。一斉射1 GT。提供されたCR90標準型STLの左右2本の砲身と砲室を使用する。'},
    {'key': 'single500MT', 'asset': 'cr90_light_single500mt', 'name': '500MT 単装軽ターボレーザー', 'short': '500MT 単装軽TL',
     'barrels': 1, 'boltTT': .0005, 'cycle': 1, 'mass': 90, 'crew': 2, 'cost': 18000, 'aa': .1, 'dualPurpose': False,
     'weaponFamily': 'light-turbolaser', 'variant': 'CR90 Phoenix side mount',
     'desc': '1門500 MT（0.0005 TT）の軽ターボレーザー。提供されたCR90フェニックス型の長砲身の舷側単装STLを使用する。'},
    {'key': 'single6MT', 'asset': 'cr90_heavy_single6mt', 'name': '6MT 単装重レーザー砲', 'short': '6MT 単装重レーザー',
     'barrels': 1, 'boltTT': .000006, 'cycle': .2, 'mass': 12, 'crew': 1, 'cost': 6000, 'aa': 1.5, 'dualPurpose': True,
     'weaponFamily': 'heavy-laser', 'variant': 'CR90 Standard small turret',
     'desc': '1門6 MT（0.000006 TT）の重レーザー砲。提供されたCR90標準型の小型単装STLを、その船体と同じ縮尺で使用する。'},
    {'key': 'twin6MT', 'asset': 'sphyrna_heavy_twin6mt', 'name': '6MT 2連装重レーザー砲', 'short': '6MT 重レーザー2連装',
     'barrels': 2, 'boltTT': .000006, 'cycle': .2, 'mass': 18, 'crew': 2, 'cost': 10000, 'aa': 1.5, 'dualPurpose': True,
     'weaponFamily': 'heavy-laser', 'variant': 'Sphyrna native bow mount',
     'desc': '6 MT（0.000006 TT）の重レーザー砲2門。一斉射12 MT。提供されたスフィルナ型船体の艦首側面にある上下2本の砲身と砲架を独立した装備として使用する。'},
    {'key': 'sphyrnaTwin500MT', 'asset': 'sphyrna_light_twin500mt', 'name': '500MT 2連装軽ターボレーザー（スフィルナ型）', 'short': '500MT 軽TL2連装',
     'barrels': 2, 'boltTT': .0005, 'cycle': 1, 'mass': 65, 'crew': 3, 'cost': 25000, 'aa': .1, 'dualPurpose': False,
     'weaponFamily': 'light-turbolaser', 'variant': 'Sphyrna native aft turret',
     'desc': '500 MT（0.0005 TT）の軽ターボレーザー2門。一斉射1 GT。提供されたスフィルナ型STLの低い砲室と左右2本の砲身を使用する。'},
]
FILES = {
    1: '1-CR90_Corvette_Standard_SmallTurret.STL',
    2: '2-CR90_Corvette_Phoenix_BigTurretQuad.STL',
    4: '4-CR90_Corvette_Phoenix_SideTurret.STL',
    5: '5-CR90_Corvette_Standard_BigTurret.STL',
    6: '6-HammerheadClassCorvette-2.STL',
    7: '7-HammerheadClassCorvette_Turret.STL',
}


def load(number):
    data = (SRC / FILES[number]).read_bytes()
    count = struct.unpack_from('<I', data, 80)[0]
    if len(data) != 84 + count * 50:
        raise ValueError('Invalid binary STL: ' + FILES[number])
    dtype = np.dtype([('normal', '<f4', (3,)), ('vertices', '<f4', (3, 3)), ('attribute', '<u2')])
    triangles = np.ndarray((count,), dtype=dtype, buffer=data, offset=84)['vertices'].astype(float)
    # Component IDs are deterministic: lexicographically sorted welded source
    # vertices, followed by union of exactly the original triangles.
    points, inverse = np.unique(np.round(triangles.reshape(-1, 3), 5), axis=0, return_inverse=True)
    indices = inverse.reshape(-1, 3)
    parents = list(range(len(points)))

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    for a, b, c in indices:
        root = find(a)
        parents[find(b)] = root
        parents[find(c)] = root
    ids = np.array([find(t[0]) for t in indices])
    groups = [triangles[ids == i] for i in np.unique(ids)]
    return triangles, groups, hashlib.sha256(data).hexdigest()


def add_source(mesh, triangles, transform, label, component_id):
    start = mesh.mark()
    mapping = {}
    for tri in triangles:
        for point in tri:
            key = tuple(point)
            if key not in mapping:
                mapping[key] = len(mesh.points)
                mesh.points.append(transform(point).tolist())
                mesh.uvs.append((0, 0))
            mesh.indices.append(mapping[key])
    return mesh.record(start, label, sourceComponent=component_id,
                       sourceTriangles=len(triangles), normalMode='source-faceted')


def barrel_annotation(triangles, transform, label, mesh_range=None):
    points = np.array([transform(p) for p in triangles.reshape(-1, 3)])
    x0, x1 = points[:, 0].min(), points[:, 0].max()
    front = points[points[:, 0] >= x1 - max(1e-6, (x1 - x0) * .16)]
    low, high = front.min(0), front.max(0)
    y, z = (low[1] + high[1]) / 2, (low[2] + high[2]) / 2
    return {**(mesh_range or {}), 'label': label, 'root': [x0, y, z],
            'muzzle': [x1, y, z], 'centerM': [(x0 + x1) / 2, y, z],
            'axis': [1, 0, 0], 'outerRadiusM': max(high[1] - low[1], high[2] - low[2]) / 2,
            'boreRadiusM': None, 'muzzleRecessM': None, 'exposedStartX': x0,
            'muzzleStyle': 'source-cap', 'componentRole': 'native-complete-barrel'}


def convex_compartment(mesh, row, moving=False):
    """Credit a closed convex source gunhouse only when all face planes agree.

    A missing safe cell earns no room volume. We never replace a concave source
    mechanism with a box or its larger convex hull.
    """
    base = row['firstVertex']
    points = np.array(mesh.points[base:base + row['vertices']])
    flat = mesh.indices[row['firstIndex']:row['firstIndex'] + row['indices']]
    faces = np.array(flat).reshape(-1, 3) - base
    center = points.mean(0)
    fixed = []
    edge_counts = {}
    for face in faces:
        tri = points[face]
        normal = np.cross(tri[1] - tri[0], tri[2] - tri[0])
        if np.linalg.norm(normal) < 1e-9:
            continue
        if np.dot(normal, tri.mean(0) - center) < 0:
            face = face[::-1]
            normal = -normal
        if ((points - tri[0]) @ normal).max() > max(1, np.linalg.norm(normal)) * 1e-5:
            return False
        fixed.append(face.tolist())
        for a, b in zip(face, np.roll(face, -1)):
            key = tuple(sorted((int(a), int(b))))
            edge_counts[key] = edge_counts.get(key, 0) + 1
    if not fixed or any(v != 2 for v in edge_counts.values()):
        return False
    volume = F.triangle_volume(points.tolist(), fixed)
    if volume <= 0:
        return False
    mesh.compartments.append({'label': row['label'], 'verticesM': points.tolist(),
                             'faces': fixed, 'volumeM3': volume, 'movesWithGun': moving,
                             'meshRange': {k: row[k] for k in ['firstVertex', 'vertices', 'firstIndex', 'indices']},
                             'sourceClosedConvex': True})
    return True


def make(number, kind, asset_id, title, output, scale, mount, frame,
         fixed, moving, barrels, pivot, compartment_ids=(), limits=None,
         extra=None, annotation_groups=None):
    source, groups, digest = load(number)
    mount = np.asarray(mount, dtype=float)
    matrix = np.asarray(frame, dtype=float)
    if abs(np.linalg.det(matrix) - 1) > 1e-8:
        raise ValueError('Source frame must be a proper rigid rotation')
    transform = lambda p: matrix @ (p - mount)
    mesh = F.Mesh()
    rows = {}
    for i in fixed:
        rows[i] = add_source(mesh, groups[i], transform, 'native fixed component ' + str(i), i)
    split = mesh.mark()
    for i in moving:
        rows[i] = add_source(mesh, groups[i], transform, 'native moving component ' + str(i), i)
    for i in compartment_ids:
        convex_compartment(mesh, rows[i], i in moving)
    annotations = []
    for j, i in enumerate(barrels):
        tris = groups[i] if annotation_groups is None else annotation_groups[j](groups)
        annotations.append(barrel_annotation(tris, transform, 'native barrel ' + str(j + 1), rows.get(i)))
    limits = limits or {'yaw': None, 'lo': -10 * math.pi / 180, 'hi': 70 * math.pi / 180}
    asset = F.finish(mesh, kind, title, output, transform(np.asarray(pivot)).tolist(), annotations, split, [], scale,
                     source='User-provided STL: original triangles, rigid frame and uniform hull scale',
                     nativeCalibration='corvette-user-stl', sourceModel='assets/source/corvette-weapons/' + FILES[number],
                     sourceFilename=FILES[number], sourceSha256=digest, sourceScaleMPerUnit=scale,
                     sourceHullLengthM=150 if number != 6 and number != 7 else 116.7,
                     sourceFrame={'rotationRows': frame, 'mountPointSource': mount.tolist(),
                                  'elevationPivotSource': pivot},
                     sourceComponentIds=fixed + moving, sourceTriangleCount=len(source),
                     importedTriangleCount=sum(len(groups[i]) for i in fixed + moving),
                     geometryPreservation={'rigidRotationAndUniformScaleOnly': True,
                                           'allImportedTrianglesPreserved': True,
                                           'noGeneratedGeometry': True},
                     materialReference='isd_heavy_octuple', weaponRole='heavy-laser' if output == .000006 else 'light-turbolaser',
                     energyUnit='TT', perBarrelMT=6 if output == .000006 else 500,
                     jointLimits=limits, **(extra or {}))
    asset['polygonBudget']['maximum'] = 1000
    if len(annotations) != len(barrels) or any(b['muzzle'][0] <= b['root'][0] for b in annotations):
        raise ValueError(asset_id + ': invalid forward barrel')
    if asset['faces'] != asset['importedTriangleCount']:
        raise ValueError(asset_id + ': source triangle loss')
    return asset


def build():
    assets = {}
    dorsal = [[0, -1, 0], [0, 0, 1], [-1, 0, 0]]
    assets['cr90_light_quad500mt'] = make(2, 'quad500MT', 'cr90_light_quad500mt', '500MT 4連装軽ターボレーザー', .0005,
        CR90_SCALE, [.6396331787109375, -4451.737060546875, 975.4887084960938], dorsal,
        [0, 1, 2, 7], [3, 4, 5, 6], [3, 4, 5, 6], [.6396331787109375, -4451.737060546875, 1158.1079711914062], [2])
    assets['cr90_light_twin500mt'] = make(5, 'twin500MT', 'cr90_light_twin500mt', '500MT 2連装軽ターボレーザー（CR90型）', .0005,
        CR90_SCALE, [.6476669311523438, -4499.44677734375, 983.3418579101562], dorsal,
        [0, 1, 2, 5], [3, 4], [3, 4], [.6476669311523438, -4499.44677734375, 1167.6771240234375], [2])
    assets['cr90_heavy_single6mt'] = make(1, 'single6MT', 'cr90_heavy_single6mt', '6MT 単装重レーザー砲', .000006,
        CR90_SCALE, [1097.0673828125, -2028.1897583007812, 641.781494140625],
        [[1, 0, 0], [0, 0, 1], [0, -1, 0]], [0, 1], [2, 3], [3],
        [1146.436767578125, -2028.1897583007812, 767.7443542480469], [2], extra={'gunhouseElevates': True})
    assets['cr90_light_single500mt'] = make(4, 'single500MT', 'cr90_light_single500mt', '500MT 単装軽ターボレーザー', .0005,
        CR90_SCALE, [3184.43310546875, 2028.49169921875, 2.3667755126953125],
        [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [0, 1, 4, 5], [2, 3], [3],
        [3426.1259765625, 1830.7005615234375, 2.3543777465820312], [1])
    assets['sphyrna_light_twin500mt'] = make(7, 'sphyrnaTwin500MT', 'sphyrna_light_twin500mt', '500MT 2連装軽ターボレーザー（スフィルナ型）', .0005,
        SPHYRNA_SCALE, [0, 31.438050270080566, 17.323772430419922], dorsal,
        [1], [0, 2], [0, 2], [0, 29.31097984313965, 17.941804885864258], [1])
    bow_limits = {'yaw': 2 * math.pi / 180, 'lo': -2 * math.pi / 180, 'hi': 2 * math.pi / 180}
    for starboard in [False, True]:
        side = 1 if starboard else -1
        # Full lower barrel is attached to the source gunhouse. All native
        # triangles move rigidly as one limited-traverse bow assembly; the
        # independent upper barrel and both real muzzles remain separately
        # annotated, with no invented extra tube.
        ids = [40, 41, 42] if starboard else [3, 4, 6]
        lower_id, upper_id = (40, 42) if starboard else (6, 4)
        name = 'sphyrna_heavy_twin6mt' + ('_stbd' if starboard else '')
        lower = lambda groups, i=lower_id: groups[i][groups[i].mean(1)[:, 1] < -33.0]
        upper = lambda groups, i=upper_id: groups[i]
        assets[name] = make(6, 'twin6MT', name, '6MT 2連装重レーザー砲' + ('（右舷）' if starboard else ''), .000006,
            SPHYRNA_SCALE, [side * 5.6450395584106445, -31.782641410827637, 4.82861053943634],
            [[0, -1, 0], [side, 0, 0], [0, 0, side]], [], ids, [lower_id, upper_id],
            [side * 6.014347791671753, -31.782641410827637, 4.82861053943634], [],
            limits=bow_limits, annotation_groups=[lower, upper],
            extra={'fixedMount': True, 'gunhouseElevates': True,
                   'nativeBowSide': 'starboard' if starboard else 'port'})
    return assets


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--json-output', type=Path, default=Path('/tmp/kuat-corvette-weapons-assets.json'))
    parser.add_argument('--block-output', type=Path, default=Path('/tmp/kuat-corvette-weapons-reference-block.js'))
    parser.add_argument('--manifest-output', type=Path, default=SRC / 'manifest.json')
    parser.add_argument('--catalog-output', type=Path, default=Path('/tmp/kuat-corvette-weapons-catalog.json'))
    parser.add_argument('--core-block-output', type=Path, default=Path('/tmp/kuat-corvette-weapons-core-block.js'))
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    assets = build()
    report = {key: {k: asset[k] for k in ['catalogKind', 'sourceFilename', 'sourceSha256', 'sourceScaleMPerUnit',
               'sourceFrame', 'size', 'faces', 'barrels', 'boltTT', 'volleyTT', 'muzzlePoints', 'maxQuantizationErrorM']}
              for key, asset in assets.items()}
    manifest = {'source': 'User-provided STL attachments', 'catalogKeys': KEYS,
                'scaleCalibration': {'cr90': {'lengthM': 150, 'sourceLength': 15758.427734375, 'metresPerSourceUnit': CR90_SCALE,
                                             'sourceFilename': '3-CR90_Corvette_Standard.STL',
                                             'sourceSha256': 'a9f7b02f9089420a372154f61edf6b26037a33008499acba69274bba4ff4a5ad'},
                                     'sphyrna': {'lengthM': 116.7, 'sourceLength': 108.9567756652832, 'metresPerSourceUnit': SPHYRNA_SCALE,
                                                 'sourceFilename': FILES[6], 'sourceSha256': load(6)[2]}},
                'assets': report}
    if args.check:
        current = F.registry(ROOT / 'data/reference.js')
        stale = [key for key, asset in assets.items() if current.get(key) != asset]
        if stale:
            raise SystemExit('Corvette weapon registrations are stale: ' + ', '.join(stale))
    else:
        encoded = json.dumps(assets, ensure_ascii=False, separators=(',', ':'))
        args.json_output.write_text(encoded + '\n', encoding='utf-8')
        args.block_output.write_text('// Generated by scripts/build-corvette-weapons.py; original user-provided STL triangles.\n'
                                     + 'Object.assign(YardReferenceData.assets,' + encoded + ');\n', encoding='utf-8')
        args.manifest_output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        args.catalog_output.write_text(json.dumps(CATALOG, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        args.core_block_output.write_text(
            '// Generated by scripts/build-corvette-weapons.py. Integrate before WEAPON_MODEL_SIZES / initializeWeaponSizing.\n'
            + 'const CORVETTE_WEAPON_KEYS=Object.freeze(' + json.dumps(KEYS, separators=(',', ':')) + ');\n'
            + 'const CORVETTE_WEAPON_MODELS=' + json.dumps(CATALOG, ensure_ascii=False, separators=(',', ':')) + ';\n'
            + "for(const row of CORVETTE_WEAPON_MODELS){const a=REFERENCE_ASSETS[row.asset],volleyTT=row.barrels*row.boltTT;FITS[row.key]={...FITS.pd,...row,cat:'w',tt:volleyTT,ion:0,power:volleyTT*TT/row.cycle,fm:a.size[0],hm:a.size[1],wm:a.size[2],r:Math.max(a.size[0],a.size[2])/2,nativeCalibration:'corvette-user-stl',pointDefense:false,fixedPerBarrelEnergy:true,energyBasis:'per-barrel-shot',fixedMount:!!a.fixedMount,fixed:false,casemate:false,wallOnly:false,housingFixed:false,catalogHidden:false,exposedSurfaceTurret:true,source:null,evidence:'口径・門数はユーザー指定、形状は提供されたCR90・スフィルナ型STL',rateEvidence:'連射間隔・対空値・質量・乗員・費用はゲーム用仮定'};}\n"
            + '// Add ...CORVETTE_WEAPON_KEYS to WEAPON_MODEL_SIZES population and Core exports.\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
