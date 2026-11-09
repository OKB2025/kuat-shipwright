import numpy as np,json,sys
from shapely.geometry import Polygon,MultiPolygon
from shapely.ops import unary_union
from contours import ysection,loops,simplify,simple,area
from refit import Mesh
S='/tmp/claude-0/-home-claude/9168e617-b83b-5e65-bbbf-23ebdd64786b/scratchpad/'
T=np.load(S+'exe_stl/stern.png.npy').astype(float);L=19000.
src=open('/home/claude/kuat-shipwright/js/core.js').read();i=src.index('const EXECUTOR_BLUEPRINT=')+len('const EXECUTOR_BLUEPRINT=');D,_=json.JSONDecoder().raw_decode(src[i:])
M=Mesh.__new__(Mesh);M.T=T;M.xmin=T[:,:,0].min(1);M.xmax=T[:,:,0].max(1)
def measure(x):
    segs=M.section(x)
    if not segs: return None
    P=np.array([p for s_ in segs for p in s_]);z=np.abs(P[:,0]);y=P[:,1];HW=z.max()
    if HW<5: return None
    bins=np.linspace(.45*HW,.92*HW,16);zt=[];yt=[];yb=[]
    for a_,b_ in zip(bins[:-1],bins[1:]):
        k=(z>=a_)&(z<b_)
        if k.sum(): zt.append((a_+b_)/2);yt.append(y[k].max());yb.append(y[k].min())
    if len(zt)>=3:
        pt=np.polyfit(zt,yt,1);pb=np.polyfit(zt,yb,1);top=max(pt[1],max(yt));bot=min(pb[1],min(yb))
    else: top=y.max();bot=y.min()
    return x,HW,min(top,y.max()),max(bot,y.min())
grid=[g for g in (measure(x) for x in np.linspace(3,L-3,480)) if g]
G=np.array(grid)
def rdp_idx(P,eps):
    if len(P)<3: return [0,len(P)-1]
    a,b=P[0],P[-1];v=b-a;w=P-a;t=np.clip((w@v)/(v@v),0,1);d=np.linalg.norm(w-np.outer(t,v),axis=1);i=int(d.argmax())
    if d[i]>eps: l=rdp_idx(P[:i+1],eps);r=rdp_idx(P[i:],eps);return l[:-1]+[j+i for j in r]
    return [0,len(P)-1]
N=np.c_[G[:,0]/L,G[:,1]/G[:,1].max(),.35*G[:,2]/G[:,2].max(),.35*G[:,3]/G[:,2].max()]
eps=.002
while True:
    idx=rdp_idx(N,eps)
    if len(idx)<=32: break
    eps*=1.2
print('stations',len(idx),'eps',round(eps,4))
old=[[G[j,0]/L] for j in idx]
fits=[]
for r in old:
    x=min(max(r[0]*L,2.0),L-2.0);segs=M.section(x)
    if not segs: fits.append(None);continue
    P=np.array([p for s in segs for p in s]);z=np.abs(P[:,0]);y=P[:,1];HW=z.max()
    if HW<5: fits.append(None);continue
    bins=np.linspace(.45*HW,.92*HW,16);zt=[];yt=[];yb=[]
    for a,b in zip(bins[:-1],bins[1:]):
        k=(z>=a)&(z<b)
        if k.sum(): zt.append((a+b)/2);yt.append(y[k].max());yb.append(y[k].min())
    if len(zt)>=3:
        pt=np.polyfit(zt,yt,1);pb=np.polyfit(zt,yb,1);top=max(pt[1],max(yt));bot=min(pb[1],min(yb))
    else: top=y.max();bot=y.min()
    top=min(top,y.max());bot=max(bot,y.min())
    wide=z>=.97*HW;HH=max(1.,top-bot)
    chine=min(.8,max(.2,(y[wide].mean()-bot)/HH)) if wide.any() else .5
    belt=min(.98,max(.02,(y[wide].max()-y[wide].min())/HH)) if wide.any() else .02
    fits.append(dict(x=x,hw=HW,top=top,bot=bot,chine=chine,belt=belt))
NW=max(2*f['hw'] for f in fits if f);NH=max(f['top'] for f in fits if f)
st=[];prev=None
for r,f in zip(old,fits):
    if not f: f=prev
    st.append([r[0],round(2*f['hw']/NW,6),round((f['top']-f['bot'])/NH,6),round(((f['top']+f['bot'])/2)/NH-.5,6),0.0,0.0,round(f['belt'],4),round(f['chine'],4)]);prev=f
print('W',NW,'H',NH);[print([round(v,3) for v in s]) for s in st]
# hull half width at height y for each station (diamond octagon)
def hw_at(f,y):
    h=f['top']-f['bot'];lo=f['bot']+(f['chine']-f['belt']/2)*h;hi=f['bot']+(f['chine']+f['belt']/2)*h
    if y<=f['bot'] or y>=f['top']: return 0.
    if y<lo: return f['hw']*(y-f['bot'])/max(1e-6,lo-f['bot'])
    if y<=hi: return f['hw']
    return f['hw']*(f['top']-y)/max(1e-6,f['top']-hi)
F=[f for f in fits if f]
xs=np.array([f['x'] for f in F])
def hullpoly(y):
    up=[(f['x'],hw_at(f,y)) for f in F];lo=[(f['x'],-hw_at(f,y)) for f in F[::-1]]
    p=Polygon(up+lo).buffer(0);return p
def yc_at(x):
    return np.interp(x,xs,[(f['top']+f['bot'])/2 for f in F])
def top_at(x): return np.interp(x,xs,[f['top'] for f in F])
def bot_at(x): return np.interp(x,xs,[f['bot'] for f in F])
bridge=(5850,6320,-280,280,1400)  # bridge and neck footprint above the city roof are the source bridge asset
MERGE=float(sys.argv[3]) if len(sys.argv)>3 else .88
band=float(sys.argv[1]) if len(sys.argv)>1 else 40.;minA=float(sys.argv[2]) if len(sys.argv)>2 else 4000.
ymax=T[:,:,1].max();edges=np.arange(0,ymax+band,band)
layers=[]
for a,b in zip(edges[:-1],edges[1:]):
    ym=(a+b)/2;polys=[]
    for Lp in loops(ysection(T,ym),tol=.5):
        if len(Lp)<4 or area(Lp)<200: continue
        try: polys.append(Polygon(Lp).buffer(0))
        except Exception: pass
    if not polys: continue
    sec=unary_union(polys);rest=sec.difference(hullpoly(ym).buffer(2))
    geoms=[rest] if isinstance(rest,Polygon) else list(getattr(rest,'geoms',[]))
    for g in geoms:
        if not isinstance(g,Polygon) or g.area<minA: continue
        r=g.minimum_rotated_rectangle;ex=np.array(r.exterior.coords);e=np.hypot(*np.diff(ex,axis=0).T)
        if min(e[:2])<15: continue
        minx,minz,maxx,maxz=g.bounds
        if maxz<=0.5: continue
        if ym>bridge[4] and minx>=bridge[0] and maxx<=bridge[1] and minz>=bridge[2] and maxz<=bridge[3]: continue
        m=1 if minz>=-0.5 else 0
        if m==0 and maxz<-minz-1: continue
        Q=simplify(np.array(g.exterior.coords)[:-1],24)
        if len(Q)<3 or not simple(Q): continue
        layers.append(dict(y=[round(a,1),round(b,1)],m=m,poly=Polygon(Q),pts=Q))
# merge identical outlines on consecutive bands
layers.sort(key=lambda d:(d['y'][0]))
out=[]
for d in layers:
    for o in out:
        if o['m']==d['m'] and abs(o['y'][1]-d['y'][0])<1e-6:
            inter=o['poly'].intersection(d['poly']).area;uni=o['poly'].union(d['poly']).area
            if uni>0 and inter/uni>MERGE: o['y'][1]=d['y'][1];break
    else: out.append(d)
city=[];ventral=[]
for d in out:
    c=d['poly'].centroid;ym=(d['y'][0]+d['y'][1])/2
    o=[v for p in d['pts'] for v in (round(float(p[0]),1),round(float(p[1]),1))]
    if ym>=yc_at(c.x): k=int(max(0,min(6,(d['y'][0]-top_at(c.x)+400)//150)));city.append(dict(y=d['y'],m=d['m'],k=k,o=o))
    else: ventral.append(dict(y=d['y'],m=d['m'],k=0,o=o))
print('layers',len(layers),'merged',len(out),'city',len(city),'ventral',len(ventral))
json.dump(dict(W=round(NW,3),H=round(NH,3),stations=st,cityTerraces=city,ventralTerraces=ventral),open(S+'exe_stl/exe_fit.json','w'))
