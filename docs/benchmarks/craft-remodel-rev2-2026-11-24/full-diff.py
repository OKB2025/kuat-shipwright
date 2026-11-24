# Full comparison of each game-loaded example (data/examples/<key>/design.json.gz) with the user's design: every part and fit
# field (both directions, ids both ways); numbers to 1e-6 relative, angles modulo 360. Known loader normalisations are listed.
# usage: python3 docs/benchmarks/craft-remodel-rev2-2026-11-24/full-diff.py > OUT.txt
# 2026-11-24 (fidelity review): the Vulture and Hyena are compared with their Rev3 files, the Venator with the user's 1,137 m Lite file.
import json,gzip
refs={'craft_xwing':'x-wing','craft_tie_ln':'tie-ln','craft_tie_in':'tie-in','craft_awing':'a-wing','craft_tie_d':'tie-d','craft_arc170':'arc170','craft_btlb':'btlb','craft_tie_sa':'tie-sa','craft_hyena':'hyena','craft_vwing':'vwing','craft_vulture':'vulture','craft_v19':'v19','craft_z95':'z95','craft_ywing':'btl-a4'}
ANG={'yaw','pitch','roll'}
def diff(a,b,at,out,key=None):
    if a is None and b in (0,False,[],{}):return
    if b is None and a in (0,False,[],{}):return
    if isinstance(a,dict) and isinstance(b,dict):
        for k in set(a)|set(b):diff(a.get(k),b.get(k),at+'.'+k,out,k)
        return
    if isinstance(a,list) and isinstance(b,list):
        if len(a)!=len(b):out.append(f'{at}: length {len(a)} -> {len(b)}');return
        for i,(x,y) in enumerate(zip(a,b)):diff(x,y,f'{at}[{i}]',out)
        return
    if isinstance(a,(int,float)) and isinstance(b,(int,float)) and not isinstance(a,bool):
        if key in ANG:
            if abs(((a-b)+180)%360-180)<=1e-6:return
        elif abs(a-b)<=1e-6*max(1,abs(a),abs(b)):return
    if str(a)==str(b):return
    out.append(f'{at}: {json.dumps(a,ensure_ascii=False)[:80]} -> {json.dumps(b,ensure_ascii=False)[:80]}')
SRC={k:None for k in refs}
SRC['venator']='docs/handoff-2026-11-20/refs/venator-1137m-lite-2026-11-24.json.gz'
for k,f in list(refs.items())+[('venator',None)]:
    if f is None:
        R=json.loads(gzip.decompress(open(SRC[k],'rb').read()));E=json.loads(gzip.decompress(open(f'data/examples/{k}/design.json.gz','rb').read()))
    rev='rev3' if k in ('craft_vulture','craft_hyena') else 'rev2'
    if f is not None:R=json.load(open(f'docs/handoff-2026-11-20/refs/{f}-remodel-{rev}-2026-11-24.json'));E=json.loads(gzip.decompress(open(f'data/examples/{k}/design.json.gz','rb').read()))
    out=[]
    for coll in ('parts','fits'):
        r={str(x['id']):x for x in R[coll]};e={str(x['id']):x for x in E[coll]}
        out+= [f'{coll} only in design: {i}' for i in r if i not in e]+[f'{coll} only in example: {i}' for i in e if i not in r]
        for i in r:
            if i in e:diff(r[i],e[i],f'{coll}#{i}',out)
    top=[x for x in set(R)|set(E) if x not in('parts','fits')]
    for x in sorted(top):diff(R.get(x),E.get(x),x,out)
    print(f'== {k}: {len(out)} differences');[print('  '+o) for o in out]
