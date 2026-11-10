import json,sys,numpy as np
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
E=np.load(SP+'stl-exe-game.npy').astype(float);meta={m['id']:m for m in json.load(open(SP+'game-exe.json'))['meta']}
for fid in [61,62,68,90]:
    a=meta[fid]['aabb'];pad=60
    box=lambda T,p:(T[:,:,0].max(1)>=a[0]-p)&(T[:,:,0].min(1)<=a[3]+p)&(T[:,:,1].max(1)>=a[1]-p)&(T[:,:,1].min(1)<=a[4]+p)&(T[:,:,2].max(1)>=a[2]-p)&(T[:,:,2].min(1)<=a[5]+p)
    T=E[box(E,pad)]
    V,inv=np.unique(T.reshape(-1,3).round(3),axis=0,return_inverse=True);inv=inv.reshape(-1,3);par=np.arange(len(V))
    def f(x):
        while par[x]!=x: par[x]=par[par[x]];x=par[x]
        return x
    for t in inv: r=f(t[0]);par[f(t[1])]=r;par[f(t[2])]=r
    lab=np.array([f(t[0]) for t in inv])
    cen=T.mean(1);inside=(cen[:,0]>=a[0])&(cen[:,0]<=a[3])&(cen[:,2]>=a[2])&(cen[:,2]<=a[5])&(cen[:,1]>=a[1]-15)&(cen[:,1]<=a[4]+5)
    comps,cnt=np.unique(lab[inside],return_counts=True);main=comps[np.argmax(cnt)];C=T[lab==main].reshape(-1,3)
    ext=[round(v) for v in np.r_[C.min(0),C.max(0)]]
    # gap from this component to other triangles (vertex-to-vertex, sampled)
    O=T[lab!=main].reshape(-1,3);P=C[::max(1,len(C)//3000)];d=np.inf
    if len(O):
        for p in P: d=min(d,np.min(np.linalg.norm(O-p,axis=1)))
    print(fid,'terrace box',[round(v) for v in a],'| original connected piece box',ext,'(extends beyond the terrace' if (ext[0]<a[0]-5 or ext[3]>a[3]+5 or ext[1]<a[1]-20 or ext[2]<a[2]-5 or ext[5]>a[5]+5) else '(within the terrace','| min vertex gap to other geometry within 60 m',round(float(d),1))
