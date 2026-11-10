import sys,json,numpy as np
sys.path.insert(0,sys.argv[1]);from meshio import load
T=load(sys.argv[2]);top=json.load(open(sys.argv[3]));L=825.0
v=T.reshape(-1,3);X=-v[:,1];Y=v[:,2];Z=v[:,0];k=L/(X.max()-X.min())
P=np.stack([(X-X.min())*k,(Y-Y.min())*k+0.2,(Z-(Z.max()+Z.min())/2)*k],1).reshape(-1,3,3)
V,inv=np.unique(P.reshape(-1,3).round(4),axis=0,return_inverse=True);inv=inv.reshape(-1,3);par=np.arange(len(V))
def f(a):
    while par[a]!=a: par[a]=par[par[a]];a=par[a]
    return a
for a,b,c in inv: ra=f(a);par[f(b)]=ra;par[f(c)]=ra
lab=np.array([f(t[0]) for t in inv]);u,lab=np.unique(lab,return_inverse=True)
info=[]
for c in range(len(u)):
    Tc=P[lab==c];lo=Tc.reshape(-1,3).min(0);hi=Tc.reshape(-1,3).max(0)
    vol=abs(np.einsum('ij,ij->i',Tc[:,0],np.cross(Tc[:,1],Tc[:,2])).sum()/6)
    # closedness: every edge used twice
    e={}
    for t in inv[lab==c]:
        for a_,b_ in ((t[0],t[1]),(t[1],t[2]),(t[2],t[0])):
            key=(min(a_,b_),max(a_,b_));e[key]=e.get(key,0)+1
    closed=all(n==2 for n in e.values())
    info.append((c,lo,hi,vol,closed))
print('part  old_m3  new_m3  diff  | best STL comp: vol_m3 closed bbox-IoU')
for t in top:
    b=np.array(t['box']);best=None
    for c,lo,hi,vol,closed in info:
        il=np.maximum(lo,b[:3]);ih=np.minimum(hi,b[3:]);ov=np.clip(ih-il,0,None).prod()
        un=(hi-lo).prod()+(b[3:]-b[:3]).prod()-ov
        iou=ov/un if un>0 else 0
        if best is None or iou>best[0]:best=(iou,c,vol,closed)
    print(f"#{t['part']:3d} {t['old']:10.0f} {t['twoRow']:10.0f} {t['diffTwo']:+9.0f} | comp {best[1]} {best[2]:10.0f} {best[3]} IoU {best[0]:.2f}  mirror={t['mirror']}")
