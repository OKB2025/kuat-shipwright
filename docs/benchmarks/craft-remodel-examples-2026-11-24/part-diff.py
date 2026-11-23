# Compares each remodel example as the game loads it (data/examples/<key>/design.json.gz) with the user's design file in
# docs/handoff-2026-11-20/refs/: parts by id (k, c, s, form, yaw, pitch, roll; an unset rotation equals 0) and fits by id
# (k, p, n). Angles compare modulo 360 (a stored 225 loads as -135, the same pose). usage: python3 docs/benchmarks/craft-remodel-examples-2026-11-24/part-diff.py > part-diff.txt
import json,gzip
refs={'craft_arc170':'arc170-remodel-2026-11-24.json','craft_btlb':'btlb-remodel-2026-11-24.json','craft_tie_sa':'tie-sa-remodel-2026-11-24.json','craft_hyena':'hyena-remodel-2026-11-24.json','craft_vwing':'vwing-remodel-2026-11-24.json','craft_vulture':'vulture-remodel-2026-11-24.json','craft_v19':'v19-remodel-2026-11-24.json','craft_z95':'z95-remodel-2026-11-24.json','craft_ywing':'btl-a4-remodel-2026-11-24.json'}
def close(a,b,t=1e-6,ang=False):
    if ang and isinstance(a,(int,float)) and isinstance(b,(int,float)):return abs(((a-b)+180)%360-180)<=t*360
    if a is None and b==0:return True
    if isinstance(a,list) and isinstance(b,list):return len(a)==len(b) and all(close(x,y,t) for x,y in zip(a,b))
    if isinstance(a,(int,float)) and isinstance(b,(int,float)):return abs(a-b)<=t*max(1,abs(a),abs(b))
    return a==b
for k,f in refs.items():
    R=json.load(open('docs/handoff-2026-11-20/refs/'+f));E=json.loads(gzip.decompress(open(f'data/examples/{k}/design.json.gz','rb').read()))
    rp={p['id']:p for p in R['parts']};ep={p['id']:p for p in E['parts']}
    moved=[(i,rp[i].get('label'),{x:(rp[i].get(x),ep[i].get(x)) for x in ('k','c','s','form','yaw','pitch','roll') if not close(rp[i].get(x),ep[i].get(x),ang=x in ('yaw','pitch','roll'))}) for i in rp if i in ep]
    moved=[m for m in moved if m[2]]
    rf={x['id']:x for x in R['fits']};ef={x['id']:x for x in E['fits']}
    fch=[(i,rf[i]['k'],ef.get(i,{}).get('k'),None if close(rf[i].get('p'),ef.get(i,{}).get('p')) else (rf[i].get('p'),ef.get(i,{}).get('p')),None if close(rf[i].get('n'),ef.get(i,{}).get('n')) else (rf[i].get('n'),ef.get(i,{}).get('n'))) for i in rf if rf[i].get('k')!=ef.get(i,{}).get('k') or not close(rf[i].get('p'),ef.get(i,{}).get('p')) or not close(rf[i].get('n'),ef.get(i,{}).get('n'))]
    print(f"== {k} ({f}): parts {len(rp)} → {len(ep)}, only in reference {[i for i in rp if i not in ep]}, only in example {[i for i in ep if i not in rp]}")
    print(f"  parts changed: {moved}")
    print(f"  fits changed (id, kind before, kind after, position before/after, normal before/after): {fch}")
