import json,sys,collections
p=json.load(open(sys.argv[1]))
nodes={n['id']:n for n in p['nodes']}
dt=p['timeDeltas'];samples=p['samples']
self=collections.Counter()
for s,d in zip(samples,dt): self[s]+=d
parent={}
for n in p['nodes']:
    for c in n.get('children',[]): parent[c]=n['id']
name=lambda n:(n['callFrame']['functionName'] or '(anon)')+':'+str(n['callFrame']['lineNumber']+1)
tot=sum(self.values())
byself=collections.Counter();incl=collections.Counter()
for nid,t in self.items():
    byself[name(nodes[nid])]+=t
    seen=set();x=nid
    while x is not None:
        nm=name(nodes[x])
        if nm not in seen: incl[nm]+=t;seen.add(nm)
        x=parent.get(x)
print('total s %.1f'%(tot/1e6))
print('\n## self time');[print('%6.2f s %5.1f%%  %s'%(t/1e6,100*t/tot,k)) for k,t in byself.most_common(22)]
print('\n## inclusive time');[print('%6.2f s %5.1f%%  %s'%(t/1e6,100*t/tot,k)) for k,t in incl.most_common(45)]
