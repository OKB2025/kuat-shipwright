# Lists the repeated shells of the Mandator II source model (assets/source/mandator-stl, gunzip it first and pass the path).
# The 96 shells of 22 triangles, 9.0 m by 12.8 m by 11.6 m, are the launch tubes: four groups of 24 (two racks of 6 by 2).
# Their pitch (12.1 m along the hull, 12.2 m between rows, 21.1 m between the racks) is in
# docs/benchmarks/mandator2-launch-tubes-2026-11-19/measure.txt and sizes Core.HEAVY_LAUNCHER.cell.
import sys,struct,numpy as np,collections,pickle
U=sys.argv[1]
b=open(U,'rb').read();n=struct.unpack('<I',b[80:84])[0]
a=np.frombuffer(b,dtype=np.dtype([('n','<f4',3),('v','<f4',(3,3)),('a','<u2')]),count=n,offset=84)
V=a['v'].reshape(-1,3);key=np.round(V*1e4).astype(np.int64)
u,inv=np.unique(key,axis=0,return_inverse=True);inv=inv.reshape(-1,3)
par=np.arange(len(u))
def f(x):
    while par[x]!=x:
        par[x]=par[par[x]];x=par[x]
    return x
for t in inv:
    r=f(t[0])
    for k in (1,2):
        s=f(t[k])
        if s!=r: par[s]=r
root=np.array([f(t[0]) for t in inv])
comps=collections.defaultdict(list)
for i,r in enumerate(root): comps[r].append(i)
S=70.9
out=[]
for r,idx in comps.items():
    P=a['v'][idx].reshape(-1,3);lo=P.min(0);hi=P.max(0)
    out.append((len(idx),lo,hi))
print('tris',n,'components',len(out),'bbox',V.min(0),V.max(0))
pickle.dump(out,open('comps.pkl','wb'))
sz=collections.Counter()
for k,lo,hi in out:
    d=tuple(np.round((hi-lo)*S,0).astype(int));sz[(k,)+d]+=1
for (k,*d),c in sorted(sz.items(),key=lambda x:-x[1])[:40]:
    print(c,'x tris',k,'size m',d)
