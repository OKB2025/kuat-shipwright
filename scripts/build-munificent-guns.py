#!/usr/bin/env python3
"""Cut the Munificent's bow gun and its ventral twin turbolaser out of the supplied model and register them as fittings.

Source: "Munificent Class Star Frigate" by SomeGuyUsingBlender (Sketchfab, CC BY 4.0), the model the Munificent
example is measured from (assets/source/munificent/). The model's own triangles, one rigid rotation and the ship's
scale (825 m over the model's 802.40 units = 1.0282 m per unit); nothing is remodelled.
  munBow   the bow gun under the forward body: its housing and two stacked barrels, firing ahead
  munTwin  one of the 18 ventral twin turrets (the one at model z 136.6, starboard) with its housing and barrels,
           which point outboard
Frames: +X along the barrels, +Y away from the mounting face (both hang under the hull, so model -y), mount plane Y=0.
usage: build-munificent-guns.py [--json-output F] [--check]
"""
import argparse, hashlib, importlib.util, json, math, sys
from pathlib import Path
import numpy as np
sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT/'assets/source/munificent'
spec = importlib.util.spec_from_file_location('mun_gun_helpers', ROOT/'scripts/build-turret-family.py')
F = importlib.util.module_from_spec(spec); spec.loader.exec_module(F)
spec2 = importlib.util.spec_from_file_location('rec_gun_helpers', ROOT/'scripts/build-recusant-guns.py')
RG = importlib.util.module_from_spec(spec2); spec2.loader.exec_module(RG)
S = 825/802.40
CREDIT = {'sourceUrl': 'https://sketchfab.com/3d-models/munificent-class-star-frigate-966265e37e61433b919ba640a12a33f5',
          'author': 'SomeGuyUsingBlender', 'authorUrl': 'https://sketchfab.com/SomeGuyUsingBlender',
          'license': 'CC BY 4.0', 'licenseUrl': 'http://creativecommons.org/licenses/by/4.0/'}


def load():
    g = json.loads((SRC/'scene.gltf').read_text()); B = (SRC/'scene.bin').read_bytes()
    def acc(i):
        a = g['accessors'][i]; v = g['bufferViews'][a['bufferView']]; off = v.get('byteOffset', 0)+a.get('byteOffset', 0)
        ct = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]; nc = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        return np.frombuffer(B, ct, count=a['count']*nc, offset=off).reshape(-1, nc) if nc > 1 else np.frombuffer(B, ct, count=a['count'], offset=off)
    Ps, Is, Cs = [], [], []; base = 0; cbase = 0
    for m in g['meshes']:
        p = m['primitives'][0]; P = acc(p['attributes']['POSITION']).astype(float); I = acc(p['indices']).astype(np.int64).reshape(-1, 3)
        _, inv = np.unique(np.round(P*1000).astype(np.int64), axis=0, return_inverse=True); inv = inv.ravel(); par = np.arange(inv.max()+1)
        def find(x):
            while par[x] != x: par[x] = par[par[x]]; x = par[x]
            return x
        for a, b, c in inv[I]: ra = find(a); par[find(b)] = ra; par[find(c)] = ra
        _, cid = np.unique(np.array([find(x) for x in inv[I[:, 0]]]), return_inverse=True)
        Ps.append(P); Is.append(I+base); Cs.append(cid+cbase); base += len(P); cbase += cid.max()+1
    return np.concatenate(Ps), np.concatenate(Is), np.concatenate(Cs), hashlib.sha256(B).hexdigest()


GUNS = {
 'munBow': dict(asset='mun_bow_twin', title='ミュニフィセント艦首砲', bolt=2500, xf=lambda p, z0, pl: [(p[2]-z0)*S, -(p[1]-pl)*S, p[0]*S],
     fixed=[[-9.4, 8.0, 59.2, 90.3, 187.0, 219.0], [-15.9, 14.7, 64.6, 84.9, 192.6, 212.9]],
     barrels=[[-3.5, 2.0, 80.1, 85.6, 211.9, 271.1], [-3.5, 2.0, 71.6, 77.1, 211.9, 271.1]], plane=90.0, z0=203.0,
     limits={'yaw': 2*math.pi/180, 'lo': -2*math.pi/180, 'hi': 2*math.pi/180}, fixedMount=True),
 'munTwin': dict(asset='mun_ventral_twin50', title='ミュニフィセント腹部2連装ターボレーザー', bolt=50, xf=lambda p, x0, pl, zc=136.6: [(p[0]-x0)*S, -(p[1]-pl)*S, -(p[2]-zc)*S],
     fixed=[], fixedTriBox=[51.0, 70.5, 86.0, 106.0, 129.1, 144.1],
     barrels=[[52.7, 71.5, 92.8, 96.4, 132.1, 135.7], [52.7, 71.5, 92.8, 96.4, 137.6, 141.2]], plane=105.2, z0=60.0,
     limits={'yaw': None, 'lo': -10*math.pi/180, 'hi': 30*math.pi/180}, fixedMount=False),
}


def remesh_barrel(m, pts, label, segments=16, stations=24):
    """A source barrel rebuilt as a closed tube with the source's own radius profile (the model tessellates each
    barrel with ~1,500 triangles; the triangle budget allows ~5,000 for a whole gun). Axis +X in the gun frame."""
    pts = np.asarray(pts); x0, x1 = pts[:, 0].min(), pts[:, 0].max()
    cy = (pts[:, 1].min()+pts[:, 1].max())/2; cz = (pts[:, 2].min()+pts[:, 2].max())/2
    r = np.hypot(pts[:, 1]-cy, pts[:, 2]-cz); xs = np.linspace(x0, x1, stations+1); prof = []
    for a, b in zip(xs[:-1], xs[1:]):
        sel = (pts[:, 0] >= a-1e-6) & (pts[:, 0] <= b+1e-6); prof.append(r[sel].max() if sel.any() else (prof[-1] if prof else r.max()))
    prof = np.array(prof); ring_x = list(xs); ring_r = [prof[0]]+[max(prof[i-1], prof[i]) for i in range(1, len(prof))]+[prof[-1]]
    start = m.mark(); rings = []
    for x, rr in zip(ring_x, ring_r):
        ring = []
        for i in range(segments):
            t = 2*math.pi*i/segments; ring.append(len(m.points)); m.points.append([float(x), float(cy+rr*math.cos(t)), float(cz+rr*math.sin(t))]); m.uvs.append((0, 0))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for i in range(segments):
            j = (i+1) % segments; m.indices.extend([a[i], a[j], b[j], a[i], b[j], b[i]])
    for ring, rev in [(rings[0], True), (rings[-1], False)]:
        c = len(m.points); m.points.append([float(m.points[ring[0]][0]), float(cy), float(cz)]); m.uvs.append((0, 0))
        for i in range(segments):
            j = (i+1) % segments; m.indices.extend([c, ring[j], ring[i]] if rev else [c, ring[i], ring[j]])
    return m.record(start, label, sourceTriangles=None, remeshed={'segments': segments, 'stations': stations})


def build():
    P, I, comp, sha = load(); assets = {}; report = {}
    for key, G in GUNS.items():
        xf = lambda p, G=G: G['xf'](p, G['z0'], G['plane'])
        m = F.Mesh(); seen = set(); nfixed = 0
        for i, box in enumerate(G['fixed']):
            t = RG.pick(P, I, comp, box); t = np.array([x for x in t.tolist() if tuple(x) not in seen]) if len(t) else t
            for x in t.tolist(): seen.add(tuple(x))
            if len(t): RG.add_tris(m, P, t, xf, 'source fixed part %d' % (i+1)); nfixed += len(t)
        if G.get('fixedTriBox'):
            # this turret's housing is part of a longer hull detail: keep only its own triangles (centroids in the
            # box, no large hull faces), leaving the barrels to their own partition
            b = G['fixedTriBox']; T = P[I]; c = T.mean(1); ext = (T.max(1)-T.min(1)).max(1)
            mask = (c[:, 0] > b[0]) & (c[:, 0] < b[1]) & (c[:, 1] > b[2]) & (c[:, 1] < b[3]) & (c[:, 2] > b[4]) & (c[:, 2] < b[5]) & (ext < 16)
            bt = {tuple(x) for bb in G['barrels'] for x in RG.pick(P, I, comp, bb).tolist()}
            t = np.array([x for x in I[mask].tolist() if tuple(x) not in bt])
            for x in t.tolist(): seen.add(tuple(x))
            RG.add_tris(m, P, t, xf, 'source turret housing'); nfixed += len(t)
        split = m.mark(); barrels = []
        for i, box in enumerate(G['barrels']):
            t = RG.pick(P, I, comp, box); t = np.array([x for x in t.tolist() if tuple(x) not in seen])
            if not len(t): raise ValueError(key+': no barrel in '+str(box))
            for x in t.tolist(): seen.add(tuple(x))
            row = remesh_barrel(m, [xf(P[v]) for v in np.unique(t)], 'x'); row['sourceTriangles'] = int(len(t))
            barrels.append(RG.barrel_row(m, row, 'source-profile barrel %d' % (i+1)))
        pivot = [min(b['root'][0] for b in barrels), sum(b['root'][1] for b in barrels)/len(barrels), 0]
        a = F.finish(m, key, G['title'], G['bolt'], pivot, barrels, split, [], 1,
                     source='Supplied Munificent model: its own triangles, rigidly rotated and uniformly scaled to the ship',
                     nativeCalibration='munificent-source-model', materialReference='isd_heavy_octuple', weaponRole='turbolaser',
                     jointLimits=G['limits'], housingFixed=G['fixedMount'], fixedMount=G['fixedMount'], noSupportPedestal=True, supportStandHeightM=0,
                     sourceModel='assets/source/munificent/scene.gltf', sourceBinSha256=sha, sourceScaleMPerUnit=S,
                     sourceFrame={'mountPlaneModelY': G['plane'], 'mountPointModel': G['z0']}, **CREDIT)
        a['polygonBudget']['maximum'] = 5000
        assets[G['asset']] = a; report[key] = {'size': a['size'], 'faces': a['faces'], 'barrels': len(barrels), 'muzzles': a['muzzlePoints'], 'fixedTriangles': nfixed}
    return assets, report


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--json-output', type=Path, default=Path('/tmp/munificent-guns.json'))
    ap.add_argument('--check', action='store_true')
    args = ap.parse_args(); assets, report = build()
    if args.check:
        current = F.registry(ROOT/'data/reference.js')
        stale = [k for k, v in assets.items() if current.get(k) != v]
        if stale: raise SystemExit('Munificent gun registrations are stale: '+', '.join(stale))
    else:
        args.json_output.write_text(json.dumps(assets, ensure_ascii=False, separators=(',', ':'))+'\n', encoding='utf-8')
    print(json.dumps(report, indent=1))


if __name__ == '__main__': main()
