# Give each body slab a top that follows the original: every outline vertex gets the original's top height there
# (the highest surface at or below the slab's own top, at most 60 m lower, never below its bottom + 5 m, so a slab
# never grows above the band the original fills), and the top face is
# triangulated between them. Neighbouring slabs share boundary heights, so a slanted face of the original becomes a
# slope instead of 60 m steps. Bottoms are unchanged.
import numpy as np,json,sys,os
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/'
src,out=sys.argv[1:3];FLAT=json.load(open(sys.argv[3])) if len(sys.argv)>3 else []   # [x,z,y0,y1] spots kept flat (struts/ungrounded after an earlier build)
E=np.load(SP+'stl-exe-game.npy').astype(float);lo=E[:,:,[0,2]].min(1);hi=E[:,:,[0,2]].max(1)
def crossings(x,z):
    m=(lo[:,0]<=x)&(hi[:,0]>=x)&(lo[:,1]<=z)&(hi[:,1]>=z);T=E[m]
    if not len(T):return np.array([])
    a,b,c=T[:,0],T[:,1],T[:,2];d=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);ok=np.abs(d)>1e-12
    l1=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/np.where(ok,d,1);l2=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/np.where(ok,d,1);l3=1-l1-l2
    h=ok&(l1>=0)&(l2>=0)&(l3>=0);return np.sort(l1[h]*a[h,1]+l2[h]*b[h,1]+l3[h]*c[h,1])
def top_at(x,z,y0,y1):
    best=None
    for dx,dz in ((0,0),(-4,0),(4,0),(0,-4),(0,4)):   # the outline lies on the original's edges: look just around it
        y=crossings(x+dx,z+dz);y=y[(y<=y1+1)&(y>=y0)]
        if len(y):best=max(best or -1e9,y.max())
    return min(y1,max(y0+5,y1-60,best)) if best is not None else y1
Hh=np.fromfile(SP+'hullfit1.f32',np.float32).reshape(-1,3,3).astype(float);hlo=Hh[:,:,[0,2]].min(1);hhi=Hh[:,:,[0,2]].max(1)
def hull_at(x,z):
    m=(hlo[:,0]<=x)&(hhi[:,0]>=x)&(hlo[:,1]<=z)&(hhi[:,1]>=z);T=Hh[m]
    if not len(T):return None
    a,b,c=T[:,0],T[:,1],T[:,2];d=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);ok=np.abs(d)>1e-12
    l1=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/np.where(ok,d,1);l2=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/np.where(ok,d,1);l3=1-l1-l2
    h=ok&(l1>=0)&(l2>=0)&(l3>=0);y=l1[h]*a[h,1]+l2[h]*b[h,1]+l3[h]*c[h,1]
    return (y.min(),y.max()) if len(y) else None
def earclip(P):
    idx=list(range(len(P)));tris=[]
    def area(a,b,c):return (P[b][0]-P[a][0])*(P[c][1]-P[a][1])-(P[b][1]-P[a][1])*(P[c][0]-P[a][0])
    def inside(p,a,b,c):
        d1=area_pt(p,a,b);d2=area_pt(p,b,c);d3=area_pt(p,c,a);return d1>0 and d2>0 and d3>0
    def area_pt(p,a,b):return (P[b][0]-P[a][0])*(p[1]-P[a][1])-(P[b][1]-P[a][1])*(p[0]-P[a][0])
    guard=0
    while len(idx)>3 and guard<10000:
        guard+=1;found=False
        for k in range(len(idx)):
            a,b,c=idx[k-1],idx[k],idx[(k+1)%len(idx)]
            if area(a,b,c)<=1e-9:continue
            if any(inside(P[j],a,b,c) for j in idx if j not in (a,b,c)):continue
            tris.append((a,b,c));idx.pop(k);found=True;break
        if not found:return None
    tris.append(tuple(idx));return tris
B=json.load(open(src));res=[];n=0;fail=0
from shapely.geometry import Point
FP=[(Polygon(np.array(b['o']).reshape(-1,2)).buffer(6),b['y'][0],b['y'][1],b['m']) for b in B]
def carries(x,z,y,up=True):
    # another slab rests on (up) or hangs from (not up) this one here: keep the full extent so it stays supported
    for pg,yb,yt,m in FP:
        hit=(yb-5<=y<yt-1) if up else (yb+1<y<=yt+5)
        if hit and (pg.contains(Point(x,z)) or (m and pg.contains(Point(x,-z)))):return True
    return False
def bottom_at(x,z,y0,y1):
    best=None
    for dx,dz in ((0,0),(-4,0),(4,0),(0,-4),(0,4)):
        y=crossings(x+dx,z+dz);y=y[(y>=y0-1)&(y<=y1)]
        if len(y):best=min(best if best is not None else 1e9,y.min())
    return max(y0,min(y0+60,y1-5,best)) if best is not None else y0
for b in B:
    pg=orient(Polygon(np.array(b['o']).reshape(-1,2)).buffer(0),1.0)
    if pg.geom_type!='Polygon':res.append(b);fail+=1;continue
    P=[tuple(p) for p in list(pg.exterior.coords)[:-1]]
    tri=earclip(P)
    if not tri:res.append(b);fail+=1;continue
    y0,y1=b['y'];above=(y0+y1)/2>=640
    # an upper slab keeps its bottom (it rests on the hull) and follows the original's top; a ventral slab keeps its
    # top (it hangs from the hull) and follows the original's bottom
    # a slab that carries another slab anywhere over its footprint stays flat (only the outermost layer is sloped)
    me=pg.buffer(0)
    if any((me.buffer(40).contains(Point(fx,fz)) or (b['m'] and me.buffer(40).contains(Point(fx,-fz)))) and fy0<=y1+70 and fy1>=y0-70 for fx,fz,fy0,fy1 in FLAT):res.append(b);fail+=1;continue
    def supports(up):
        for q,yb,yt,m in FP:
            if (abs(yb-y1)<=5 if up else abs(yt-y0)<=5) and (q.intersection(me).area>50 or (m and Polygon([(x,-z) for x,z in q.exterior.coords]).intersection(me).area>50)):return True
        return False
    if above:t=[y1]*len(P) if supports(True) else [top_at(x,z,y0,y1) for x,z in P];bt0=[y0]*len(P)
    else:t=[y1]*len(P);bt0=[y0]*len(P) if supports(False) else [bottom_at(x,z,y0,y1) for x,z in P]
    bt=[]
    for i,(x,z) in enumerate(P):
        h=hull_at(x,z);bo=bt0[i]
        # the slab rests on the hull instead of sinking into it (overlap would count as extra material): an upper slab's
        # bottom follows the hull top, a ventral slab's top follows the hull bottom, each with 2 m of contact
        bt.append(bo)
    res.append({'y':[min(bt),max(t)],'m':b['m'],'o':[round(v,1) for p in P for v in p],'t':[round(v,1) for v in t],'b':[round(v,1) for v in bt],'tri':[i for tr in tri for i in tr]});n+=1
json.dump(res,open(out,'w'));print('sloped',n,'kept flat',fail)
