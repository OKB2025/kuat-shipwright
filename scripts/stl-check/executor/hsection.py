# Horizontal section of the assembled STL at height y: chain the plane segments into loops; report the loop(s)
# around a point (area, extents, minimum rotated-box width), and whether the point is inside the solid by parity of loops.
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/'
E=np.load(SP+'stl-exe-game.npy').astype(float);ylo=E[:,:,1].min(1);yhi=E[:,:,1].max(1)
def section(y,box):
    m=(ylo<=y)&(yhi>=y);T=E[m];T=T[(T[:,:,0].max(1)>=box[0])&(T[:,:,0].min(1)<=box[1])&(T[:,:,2].max(1)>=box[2])&(T[:,:,2].min(1)<=box[3])]
    segs=[]
    for t in T:
        d=t[:,1]-y;pts=[]
        for i,j in ((0,1),(1,2),(2,0)):
            if (d[i]<0)!=(d[j]<0):u=d[i]/(d[i]-d[j]);q=t[i]+(t[j]-t[i])*u;pts.append((q[0],q[2]))
        if len(pts)==2:segs.append(pts)
    return segs
def loops(segs,tol=0.05):
    from collections import defaultdict
    key=lambda p:(round(p[0]/tol),round(p[1]/tol));adj=defaultdict(list)
    for i,(a,b) in enumerate(segs):adj[key(a)].append((i,0));adj[key(b)].append((i,1))
    used=[False]*len(segs);out=[]
    for i in range(len(segs)):
        if used[i]:continue
        used[i]=True;L=[segs[i][0],segs[i][1]];cur=key(segs[i][1]);start=key(segs[i][0])
        for _ in range(len(segs)):
            nxt=None
            for j,e in adj[cur]:
                if not used[j]:nxt=(j,e);break
            if nxt is None:break
            j,e=nxt;used[j]=True;p=segs[j][1-e];L.append(p);cur=key(p)
            if cur==start:break
        out.append(np.array(L))
    return out
def area(L):x,z=L[:,0],L[:,1];return 0.5*abs(np.dot(x,np.roll(z,1))-np.dot(z,np.roll(x,1)))
def inside(L,p):
    x,z=L[:,0],L[:,1];c=False
    for i in range(len(L)):
        j=i-1
        if (z[i]>p[1])!=(z[j]>p[1]) and p[0]<(x[j]-x[i])*(p[1]-z[i])/(z[j]-z[i]+1e-30)+x[i]:c=not c
    return c
def minwidth(L):
    best=1e18;P=L-L.mean(0)
    for a in np.linspace(0,np.pi,90,endpoint=False):
        u=np.array([np.cos(a),np.sin(a)]);v=np.array([-u[1],u[0]]);best=min(best,min(np.ptp(P@u),np.ptp(P@v)))
    return best
if __name__=='__main__':
    cases=json.loads(sys.argv[1])
    for c in cases:
        x,y,z=c;segs=section(y,(x-1500,x+1500,z-1500,z+1500));Ls=[L for L in loops(segs) if len(L)>3]
        cont=[L for L in Ls if inside(L,(x,z))]
        print(f"point x{x} y{y} z{z}: segments {len(segs)}, loops {len(Ls)}, loops containing point {len(cont)}")
        for L in sorted(cont,key=area)[:3]:
            print(f"   loop area {area(L):.0f} m2, x {L[:,0].min():.0f}-{L[:,0].max():.0f}, z {L[:,1].min():.0f}-{L[:,1].max():.0f}, min width {minwidth(L):.1f} m, closed {np.linalg.norm(L[0]-L[-1])<0.2}, points {len(L)}")
    