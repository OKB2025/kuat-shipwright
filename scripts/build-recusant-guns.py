#!/usr/bin/env python3
"""Cut the Recusant's three ventral bow guns out of the supplied model and register them as fittings.

Source: "Star Wars: The Clone Wars Recusant (S3E2 style)" by lolqeeeeeeeeee (Sketchfab, CC BY-NC 4.0), the same
model the Recusant example is measured from (assets/source/recusant-s3e2/). Its triangles are copied unchanged
(one rigid rotation and the ship's uniform scale, 1,187 m / 187.73 model units = 6.3229 m per unit); nothing is
remodelled. The guns are the model's own connected components:
  recProw  A  the long ventral gun under the forward hull: its centre barrel (one 2 PT gun) between the two
              stepped side housings, all fixed to the keel strip
  recTwin  B  the pod hanging under the nose and its two barrels
  recKeel  C  the two barrels in the nose keel just above B
Local frame: +X forward (model +z), +Y away from the mounting face (model -y: the guns hang under the hull),
+Z = model +x. The mount plane is Y=0 at the top of each gun, the mount point under its attachment.
usage: build-recusant-guns.py [--json-output F] [--check]
"""
import argparse, base64, hashlib, importlib.util, json, math, struct, sys
from pathlib import Path
import numpy as np
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT/'assets/source/recusant-s3e2'
spec = importlib.util.spec_from_file_location('recusant_gun_helpers', ROOT/'scripts/build-turret-family.py')
F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
S = 1187/187.7300   # metres per model unit (the ship's length over the model's)
CREDIT = {'sourceUrl': 'https://sketchfab.com/3d-models/star-wars-the-clone-wars-recusant-s3e2-style-c0abad60cab44d9197589a69e78fb6c5',
          'author': 'lolqeeeeeeeeee', 'authorUrl': 'https://sketchfab.com/lolqeeeeeeeeee',
          'license': 'CC BY-NC 4.0', 'licenseUrl': 'http://creativecommons.org/licenses/by-nc/4.0/'}


def load():
    g = json.loads((SRC/'scene.gltf').read_text()); B = (SRC/'scene.bin').read_bytes()
    def acc(i):
        a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; off = v.get('byteOffset', 0)+a.get('byteOffset', 0)
        ct = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]; nc = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        return np.frombuffer(B, ct, count=a['count']*nc, offset=off).reshape(-1, nc) if nc > 1 else np.frombuffer(B, ct, count=a['count'], offset=off)
    p = g['meshes'][0]['primitives'][0]   # "Front Hull": the forward half of the ship
    P = acc(p['attributes']['POSITION']).astype(float); I = acc(p['indices']).astype(np.int64).reshape(-1, 3)
    # connected components after welding coincident vertices (1 mm)
    _, inv = np.unique(np.round(P*1000).astype(np.int64), axis=0, return_inverse=True); inv = inv.ravel()
    par = np.arange(inv.max()+1)
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for a, b, c in inv[I]: ra = find(a); par[find(b)] = ra; par[find(c)] = ra
    comp = np.array([find(x) for x in inv[I[:, 0]]])
    return P, I, comp, hashlib.sha256(B).hexdigest()


def pick(P, I, comp, box, centroid=None):
    """Triangles of the components whose bounds lie inside box [x0,x1,y0,y1,z0,z1] (model units)."""
    out = []
    for r in np.unique(comp):
        t = I[comp == r]; q = P[np.unique(t)]; mn, mx = q.min(0), q.max(0)
        if mn[0] >= box[0] and mx[0] <= box[1] and mn[1] >= box[2] and mx[1] <= box[3] and mn[2] >= box[4] and mx[2] <= box[5]:
            out.append(t)
    return np.concatenate(out) if out else np.zeros((0, 3), np.int64)


def add_tris(m, P, tris, xf, label):
    start = m.mark(); base = len(m.points); remap = {}
    for t in tris:
        for v in t:
            if v not in remap: remap[v] = len(m.points); m.points.append(xf(P[v])); m.uvs.append((0, 0))
        m.indices.extend(remap[v] for v in t)
    return m.record(start, label, sourceTriangles=int(len(tris)))


def barrel_row(m, row, label):
    pts = np.array(m.points[row['firstVertex']:row['firstVertex']+row['vertices']])
    root, tip = pts[:, 0].min(), pts[:, 0].max(); near = pts[pts[:, 0] > tip-.25*(tip-root)]
    y, z = (near[:, 1].min()+near[:, 1].max())/2, (near[:, 2].min()+near[:, 2].max())/2
    r = max(near[:, 1].max()-near[:, 1].min(), near[:, 2].max()-near[:, 2].min())/2
    row.update(root=[root, y, z], muzzle=[tip, y, z], centerM=[(root+tip)/2, y, z], axis=[1, 0, 0], outerRadiusM=r,
               boreRadiusM=None, muzzleRecessM=None, exposedStartX=root, componentRole='moving-complete-barrel',
               muzzleStyle='source-model', label=label)
    return row


GUNS = {
 # key: asset id, title, fixed-part boxes, barrel boxes, mount plane y, mount point z (model units), limits
 'recProw': dict(asset='rec_prow_heavy', title='レキューザント艦首重ターボレーザー', bolt=2000,
     fixed=[[-1.8, 1.8, -12.7, -10.5, 40.3, 59.0], [-2.7, -.6, -12.9, -10.8, 51.6, 64.2], [.6, 2.7, -12.9, -10.8, 51.6, 64.2], [-2.0, 2.0, -12.2, -11.0, 41.5, 63.0], [-1.8, 1.8, -12.7, -11.0, 46.4, 51.5]],
     barrels=[[-.7, .7, -11.7, -10.8, 56.9, 65.9]], plane=-10.56, z0=49.6,
     limits={'yaw': 2*math.pi/180, 'lo': -2*math.pi/180, 'hi': 2*math.pi/180}, fixedMount=True),
 'recTwin': dict(asset='rec_twin_pod', title='レキューザント艦首下2連装ターボレーザー', bolt=360,
     fixed='pod', barrels=[[-.8, -.4, -5.6, -5.2, 77.8, 82.0], [.4, .8, -5.6, -5.2, 77.8, 82.0]], plane=-4.46, z0=75.62,
     limits={'yaw': None, 'lo': -10*math.pi/180, 'hi': 30*math.pi/180}, fixedMount=False),
 'recKeel': dict(asset='rec_keel_twin', title='レキューザント艦首竜骨固定2連装ターボレーザー', bolt=360,
     fixed=[], barrels=[[-.65, -.25, -3.65, -3.25, 79.4, 84.5], [.25, .65, -3.65, -3.25, 79.4, 84.5]], plane=-3.28, z0=79.47,
     limits={'yaw': 2*math.pi/180, 'lo': -2*math.pi/180, 'hi': 2*math.pi/180}, fixedMount=True),
}
POD_COMPONENT_BOX = [-2.1, 2.1, -6.9, -1.2, 68.6, 92.4]   # the nose keel and its hanging pod are one component


def build():
    P, I, comp, sha = load(); assets = {}; report = {}
    for key, G in GUNS.items():
        xf = lambda p, G=G: [(p[2]-G['z0'])*S, -(p[1]-G['plane'])*S, p[0]*S]
        m = F.Mesh(); fixed_rows = []
        if G['fixed'] == 'pod':
            t = pick(P, I, comp, POD_COMPONENT_BOX); c = P[t].mean(1); t = t[(c[:, 1] < -4.47) & (c[:, 2] > 71.5) & (c[:, 2] < 78.6)]
            fixed_rows.append(add_tris(m, P, t, xf, 'source pod under the nose'))
        else:
            seen = set()
            for i, box in enumerate(G['fixed']):
                t = pick(P, I, comp, box); t = np.array([x for x in t.tolist() if tuple(x) not in seen]) if len(t) else t
                for x in t.tolist(): seen.add(tuple(x))
                if len(t): fixed_rows.append(add_tris(m, P, t, xf, 'source fixed part %d' % (i+1)))
        split = m.mark(); barrels = []
        for i, box in enumerate(G['barrels']):
            t = pick(P, I, comp, box)
            if not len(t): raise ValueError(key+': no barrel in '+str(box))
            if 'seen' in dir(): t = np.array([x for x in t.tolist() if tuple(x) not in seen])
            barrels.append(barrel_row(m, add_tris(m, P, t, xf, 'x'), 'source barrel %d' % (i+1)))
        pivot = [min(b['root'][0] for b in barrels), sum(b['root'][1] for b in barrels)/len(barrels), 0]
        a = F.finish(m, key, G['title'], G['bolt'], pivot, barrels, split, [], 1,
                     source='Supplied Recusant model: its own triangles, rigidly rotated and uniformly scaled to the ship',
                     nativeCalibration='recusant-source-model', materialReference='isd_heavy_octuple', weaponRole='turbolaser',
                     jointLimits=G['limits'], housingFixed=True, fixedMount=G['fixedMount'], noSupportPedestal=True, supportStandHeightM=0,
                     sourceModel='assets/source/recusant-s3e2/scene.gltf', sourceBinSha256=sha, sourceScaleMPerUnit=S,
                     sourceFrame={'localX': 'model +z', 'localY': 'model -y (away from the ventral mounting face)', 'localZ': 'model +x',
                                  'mountPlaneModelY': G['plane'], 'mountPointModelZ': G['z0']}, **CREDIT)
        a['polygonBudget']['maximum'] = 5000
        assets[G['asset']] = a; report[key] = {'size': a['size'], 'faces': a['faces'], 'barrels': len(barrels),
                                              'muzzles': a['muzzlePoints'], 'fixedTriangles': sum(r['sourceTriangles'] for r in fixed_rows)}
    return assets, report


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--json-output', type=Path, default=Path('/tmp/recusant-guns.json'))
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args(); assets, report = build()
    if args.check:
        current = F.registry(ROOT/'data/reference.js')
        stale = [k for k, v in assets.items() if current.get(k) != v]
        if stale: raise SystemExit('Recusant gun registrations are stale: '+', '.join(stale))
    else:
        args.json_output.write_text(json.dumps(assets, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    print(json.dumps(report, indent=1))


if __name__ == '__main__': main()
