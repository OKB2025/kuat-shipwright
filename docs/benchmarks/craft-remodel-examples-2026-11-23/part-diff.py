# Compares each remodel example as the game loads it (data/examples/<key>/design.json.gz) with the user's design file in
# docs/handoff-2026-11-20/refs/: parts by id (k, c, s, form, yaw, pitch, roll; an unset rotation equals 0) and fits by id
# (k, p, n). usage: python3 docs/benchmarks/craft-remodel-examples-2026-11-23/part-diff.py > part-diff.txt
import json,gzip
refs={'craft_xwing':'x-wing-remodel-2026-11-23b.json','craft_tie_ln':'tie-ln-remodel-2026-11-23.json','craft_tie_in':'tie-in-remodel-2026-11-23c.json','craft_awing':'a-wing-remodel-2026-11-23.json','craft_tie_d':'tie-d-remodel-2026-11-23c.json'}
def close(a,b,t=1e-6):
    if a is None and b==0:return True
    if isinstance(a,list) and isinstance(b,list):return len(a)==len(b) and all(close(x,y,t) for x,y in zip(a,b))
    if isinstance(a,(int,float)) and isinstance(b,(int,float)):return abs(a-b)<=t*max(1,abs(a),abs(b))
    return a==b
for k,f in refs.items():
    R=json.load(open('docs/handoff-2026-11-20/refs/'+f));E=json.loads(gzip.decompress(open(f'data/examples/{k}/design.json.gz','rb').read()))
    rp={p['id']:p for p in R['parts']};ep={p['id']:p for p in E['parts']}
    moved=[(i,rp[i].get('label'),{x:(rp[i].get(x),ep[i].get(x)) for x in ('k','c','s','form','yaw','pitch','roll') if not close(rp[i].get(x),ep[i].get(x))}) for i in rp if i in ep]
    moved=[m for m in moved if m[2]]
    rf={x['id']:x for x in R['fits']};ef={x['id']:x for x in E['fits']}
    fch=[(i,rf[i]['k'],ef.get(i,{}).get('k'),None if close(rf[i].get('p'),ef.get(i,{}).get('p')) else (rf[i].get('p'),ef.get(i,{}).get('p')),None if close(rf[i].get('n'),ef.get(i,{}).get('n')) else (rf[i].get('n'),ef.get(i,{}).get('n'))) for i in rf if rf[i].get('k')!=ef.get(i,{}).get('k') or not close(rf[i].get('p'),ef.get(i,{}).get('p')) or not close(rf[i].get('n'),ef.get(i,{}).get('n'))]
    print(f"== {k} ({f}): parts {len(rp)} → {len(ep)}, only in reference {[i for i in rp if i not in ep]}, only in example {[i for i in ep if i not in rp]}")
    print(f"  parts changed: {moved}")
    print(f"  fits changed (id, kind before, kind after, position before/after, normal before/after): {fch}")
