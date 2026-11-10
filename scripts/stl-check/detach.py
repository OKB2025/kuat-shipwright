# For each strut: find STL components overlapping the owner part's AABB, then the min surface gap from them to all other components.
import sys,json,numpy as np
sys.path.insert(0,sys.argv[1]);from meshio import load
stl,key,sj,fx=sys.argv[2],sys.argv[3],sys.argv[4],float(sys.argv[5]);h=float(sys.argv[6]) if len(sys.argv)>6 else 1.0
R=json.load(open(sj))[key];bb=R['bbox'];L=bb[3]-bb[0]
v=load(stl).reshape(-1,3);X=v[:,1]*fx;Y=v[:,2];Z=v[:,0];k=L/(X.max()-X.min())
T=np.stack([(X-X.min())*k+bb[0],(Y-Y.min())*k+bb[1],(Z-(Z.max()+Z.min())/2)*k],1).reshape(-1,3,3)
# components by shared vertices
V,inv=np.unique(T.reshape(-1,3).round(4),axis=0,return_inverse=True);inv=inv.reshape(-1,3)
par=np.arange(len(V))
def f(a):
    while par[a]!=a: par[a]=par[par[a]];a=par[a]
    return a
for a,b,c in inv:
    ra,rb,rc=f(a),f(b),f(c);par[rb]=ra;par[f(rc)]=ra
lab=np.array([f(t[0]) for t in inv]);u,lab=np.unique(lab,return_inverse=True)
print(key,'components',len(u),'scale',round(k,3))
def samples(Ts,step):
    out=[]
    for t in Ts:
        a,b,c=t;n=max(1,int(np.ceil(max(np.linalg.norm(b-a),np.linalg.norm(c-a),np.linalg.norm(c-b))/step)))
        for i in range(n+1):
            for j in range(n+1-i):
                out.append(a+(b-a)*i/n+(c-a)*j/n)
    return np.array(out)
from collections import defaultdict
for si,st in enumerate(R['struts']):
    own=R['owners'][si]
    if not own: print(' strut',st['id'],'no owner');continue
    ob=own[0]['aabb'];cen=T.mean(1)
    m=(cen[:,0]>=ob[0])&(cen[:,0]<=ob[3])&(cen[:,1]>=ob[1])&(cen[:,1]<=ob[4])&(cen[:,2]>=ob[2])&(cen[:,2]<=ob[5])
    comps,cnt=np.unique(lab[m],return_counts=True)
    if not len(comps): print(' strut',st['id'],'no STL triangles in owner box');continue
    oc=comps[np.argmax(cnt)];A=samples(T[lab==oc],h);Bt=T[lab!=oc]
    lo=A.min(0)-60;hi=A.max(0)+60;sel=np.all((Bt.max(1)>=lo)&(Bt.min(1)<=hi),1);B=samples(Bt[sel],h) if sel.any() else np.zeros((0,3))
    if not len(B): print(' strut',st['id'],'owner comp',oc,'no other geometry within 60 m');continue
    g=defaultdict(list);cs=4.0
    for i,p in enumerate(B): g[tuple((p//cs).astype(int))].append(i)
    best=1e9;bp=None
    for p in A[::max(1,len(A)//4000)]:
        c=(p//cs).astype(int)
        for dx in (-1,0,1):
            for dy in (-1,0,1):
                for dz in (-1,0,1):
                    for i in g.get((c[0]+dx,c[1]+dy,c[2]+dz),()):
                        d=np.linalg.norm(B[i]-p)
                        if d<best:best=d;bp=(p,B[i])
    Q=T[lab==oc].reshape(-1,3)
    print(f" strut #{st['id']} owner STL comp {oc} ({(lab==oc).sum()} tris, box x{Q[:,0].min():.0f}-{Q[:,0].max():.0f} y{Q[:,1].min():.0f}-{Q[:,1].max():.0f} z{Q[:,2].min():.0f}-{Q[:,2].max():.0f}): min gap to other geometry "+(f"{best:.1f} m at {np.round(bp[0],1)}" if bp is not None else ">~6 m (none within grid reach)"))
