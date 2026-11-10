import sys,json,numpy as np
sys.path.insert(0,sys.argv[1]);from meshio import load
stl,key,sj,fx=sys.argv[2],sys.argv[3],sys.argv[4],float(sys.argv[5]);box=list(map(float,sys.argv[6].split(',')))
R=json.load(open(sj))[key];bb=R['bbox'];L=bb[3]-bb[0]
v=load(stl).reshape(-1,3);X=v[:,1]*fx;Y=v[:,2];Z=v[:,0];k=L/(X.max()-X.min())
T=np.stack([(X-X.min())*k+bb[0],(Y-Y.min())*k+bb[1],(Z-(Z.max()+Z.min())/2)*k],1).reshape(-1,3,3)
V,inv=np.unique(T.reshape(-1,3).round(4),axis=0,return_inverse=True);inv=inv.reshape(-1,3);par=np.arange(len(V))
def f(a):
    while par[a]!=a: par[a]=par[par[a]];a=par[a]
    return a
for a,b,c in inv: ra=f(a);par[f(b)]=ra;par[f(c)]=ra
lab=np.array([f(t[0]) for t in inv]);u,lab=np.unique(lab,return_inverse=True)
B=np.array(box);out=[]
for c in range(len(u)):
    Q=T[lab==c].reshape(-1,3);lo,hi=Q.min(0),Q.max(0)
    ov=np.clip(np.minimum(hi,B[3:])-np.maximum(lo,B[:3]),0,None).prod()
    if ov>0: out.append((ov,c,lo.round(1),hi.round(1),(lab==c).sum()))
for o in sorted(out,key=lambda o:-o[0])[:8]: print(' comp',o[1],'tris',o[4],'lo',o[2],'hi',o[3],'overlap vol',round(o[0]))
