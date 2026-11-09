import numpy as np
from contours import loops
T=np.load('/tmp/claude-0/-home-claude/9168e617-b83b-5e65-bbbf-23ebdd64786b/scratchpad/exe_stl/stern.png.npy').astype(float)
def xsection(T,x):
    m=(T[:,:,0].min(1)<=x)&(T[:,:,0].max(1)>=x);segs=[]
    for tri in T[m]:
        pts=[]
        for a,b in ((0,1),(1,2),(2,0)):
            pa,pb=tri[a],tri[b];da,db=pa[0]-x,pb[0]-x
            if (da<0<=db) or (db<0<=da):
                u=da/(da-db);q=pa+(pb-pa)*u;pts.append((q[2],q[1]))
        if len(pts)==2: segs.append(pts)
    return segs
import sys
for x in [float(v) for v in sys.argv[1:]]:
    found=[]
    for L in loops(xsection(T,x),tol=.3):
        c=L.mean(0);r=np.hypot(L[:,0]-c[0],L[:,1]-c[1])
        if len(L)>=8 and 40<r.mean()<350 and r.std()/r.mean()<.06 and np.linalg.norm(L[0]-L[-1])<5: found.append((round(c[0]),round(c[1]),round(r.mean(),1),len(L)))
    found.sort()
    print(x,found)
