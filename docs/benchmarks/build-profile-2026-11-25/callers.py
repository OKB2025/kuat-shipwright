# For one stage of path.cjs (its source line), who calls each heavy function and how long each call path takes (inclusive).
import json,sys,collections
p=json.load(open(sys.argv[1]));stage=int(sys.argv[2]);nodes={n['id']:n for n in p['nodes']}
self=collections.Counter()
for s,d in zip(p['samples'],p['timeDeltas']): self[s]+=d
parent={}
for n in p['nodes']:
    for c in n.get('children',[]): parent[c]=n['id']
nm=lambda i:(nodes[i]['callFrame']['functionName'] or '(anon)')+':'+str(nodes[i]['callFrame']['lineNumber']+1)
incl=collections.Counter()
def add(i,t):
    x=i
    while x is not None: incl[x]+=t; x=parent.get(x)
for i,t in self.items(): add(i,t)
def in_stage(i):
    x=i
    while x is not None:
        cf=nodes[x]['callFrame']
        if cf['url'].endswith('path.cjs') and cf['functionName']=='' and cf['lineNumber']+1==stage: return True
        x=parent.get(x)
    return False
WATCH=sys.argv[3].split(',')
for w in WATCH:
    rows=collections.Counter();n=0
    for i,n_ in nodes.items():
        if n_['callFrame']['functionName']!=w or not in_stage(i): continue
        # skip nested same-name
        x=parent.get(i);nested=False;chain=[]
        while x is not None:
            if nodes[x]['callFrame']['functionName']==w: nested=True;break
            if len(chain)<4 and nodes[x]['callFrame']['functionName'] not in('','withHullCacheScope','withFrozenStructures'): chain.append(nm(x))
            x=parent.get(x)
        if nested: continue
        rows[' <- '.join(chain[:3])]+=incl[i]
    tot=sum(rows.values())
    print('\n%s  total %.2f s in %d call paths'%(w,tot/1e6,len(rows)))
    for k,t in rows.most_common(6): print('   %6.2f s  via %s'%(t/1e6,k))
