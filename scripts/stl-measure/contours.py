"""Layered plan contours: a solid becomes stacked outline slabs. Each band is
cut at its mid-height; every closed loop of that cut is one slab (holes are
filled), simplified to at most 48 points."""
import numpy as np
def ysection(T,y):
    m=(T[:,:,1].min(1)<=y)&(T[:,:,1].max(1)>=y);segs=[]
    for tri in T[m]:
        pts=[]
        for a,b in ((0,1),(1,2),(2,0)):
            pa,pb=tri[a],tri[b];da,db=pa[1]-y,pb[1]-y
            if (da<0<=db) or (db<0<=da):
                u=da/(da-db);q=pa+(pb-pa)*u;pts.append((q[0],q[2]))
        if len(pts)==2: segs.append(pts)
    return segs
def loops(segs,tol=.5):
    from collections import defaultdict
    key=lambda p:(round(p[0]/tol),round(p[1]/tol))
    adj=defaultdict(list)
    for i,(a,b) in enumerate(segs): adj[key(a)].append((i,0));adj[key(b)].append((i,1))
    used=[False]*len(segs);out=[]
    for i in range(len(segs)):
        if used[i]: continue
        used[i]=True;loop=[segs[i][0],segs[i][1]];cur=segs[i][1]
        for _ in range(len(segs)):
            nxt=None
            for j,e in adj[key(cur)]:
                if not used[j]: nxt=(j,e);break
            if nxt is None: break
            j,e=nxt;used[j]=True;cur=segs[j][1-e];loop.append(cur)
        if len(loop)>=4: out.append(np.array(loop))
    return out
def area(P): x,z=P[:,0],P[:,1];return .5*abs(np.dot(x,np.roll(z,1))-np.dot(z,np.roll(x,1)))
def rdp(P,eps):
    if len(P)<3: return P
    a,b=P[0],P[-1];v=b-a;w=P-a;n=np.linalg.norm(v)
    d=np.abs(v[0]*w[:,1]-v[1]*w[:,0])/n if n>1e-6 else np.linalg.norm(w,axis=1)
    i=int(d.argmax())
    if d[i]>eps: return np.vstack([rdp(P[:i+1],eps)[:-1],rdp(P[i:],eps)])
    return np.array([a,b])
def seg_x(a,b,c,d):
    o=lambda p,q,r:(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0])
    return (o(a,b,c)*o(a,b,d)<0) and (o(c,d,a)*o(c,d,b)<0)
def simple(Q):
    n=len(Q)
    if n<3: return False
    for i in range(n):
        for j in range(i+2,n):
            if i==0 and j==n-1: continue
            if seg_x(Q[i],Q[(i+1)%n],Q[j],Q[(j+1)%n]): return False
    # no repeated points
    return len({(round(p[0],1),round(p[1],1)) for p in Q})==n
def hull(P):
    P=sorted(map(tuple,P));
    def half(pts):
        h=[]
        for p in pts:
            while len(h)>=2 and (h[-1][0]-h[-2][0])*(p[1]-h[-2][1])-(h[-1][1]-h[-2][1])*(p[0]-h[-2][0])<=0: h.pop()
            h.append(p)
        return h
    lo=half(P);up=half(P[::-1]);return np.array(lo[:-1]+up[:-1])
def simplify(P,maxn=48):
    eps=max(1.0,np.ptp(P,0).max()*.005)
    while True:
        Q=rdp(np.vstack([P,P[:1]]),eps)[:-1]
        if len(Q)<=maxn and simple(Q): return Q
        if eps>1e4: break
        eps*=1.6
    H=hull(P)
    while len(H)>maxn: H=H[::2]
    return H
def slabs(T,band=40.,minarea=400.):
    y0,y1=T[:,:,1].min(),T[:,:,1].max();n=max(1,int(np.ceil((y1-y0)/band)));edges=np.linspace(y0,y1,n+1);out=[]
    for a,b in zip(edges[:-1],edges[1:]):
        for L in loops(ysection(T,(a+b)/2)):
            if area(L)<minarea: continue
            Q=simplify(L)
            if len(Q)>=3 and area(Q)>=minarea: out.append(dict(pts=[[round(float(x),1),round(float(z),1)] for x,z in Q],y0=round(float(a),1),y1=round(float(b),1)))
    return out
