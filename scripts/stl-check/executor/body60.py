# Executor body structures: original − fitted hull (before trench/cuts) − engine casings − the model's bridge, in 30 m bands
# with 5 m runs (structures reach the deck), simplified (<= 64 points, tolerance up to 12 m) to drop fine surface detail.
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,Point,box
from shapely.ops import unary_union
from gaps import region,E
from restore_lib import nohole,minwidth
Hh=np.fromfile(SP+'hullfit1.f32',np.float32).reshape(-1,3,3).astype(float);N=json.load(open(SP+'nacelles.json'))
ED={e['id']:e for e in json.load(open(SP+'engines-detail.json'))}
ND=[[0,290],[290,267.47],[684,267.47],[985,329.9],[1332,363.9],[1702,361],[2063,361]]   # EXECUTOR_NOZZLE_DIAMETERS in js/core.js
def nozzle_d(z):
    r=min(ND,key=lambda r:abs(abs(z)-r[0]));return r[1] if abs(abs(z)-r[0])<=40 else 0
def casings_band(y0,y1):
    out=[]
    for n in N:
        e=ED[n['id']];D=max(e['d'],247.6584*1.08,nozzle_d(n['z']));R=max(n['casing_r'],D/2*1.1)+15;L=(e['nozzleLength']+e['mlen'])*D/max(1,e['d'])+20   # the example's engine at its final size (refitShipPropulsion: >= 1.08 x 247.6584 m), nozzle + body scaled with the diameter; the model's casing beyond it stays as structure
        dy=max(0,max(y0-n['y'],n['y']-y1)) if not (y0<=n['y']<=y1) else 0
        if dy>=R:continue
        hz=np.sqrt(R*R-dy*dy)
        for z in {n['z'],-n['z']}:out.append(box(n['mouth_x']-250,z-hz,n['mouth_x']+L,z+hz))
    return unary_union(out) if out else Polygon()
def simp(p):
    for tol in (2,4,6,8,12):
        q=p.simplify(tol,preserve_topology=True)
        if isinstance(q,Polygon) and q.is_valid and len(q.exterior.coords)-1<=64:return q
    return None

# Trench openings (the user's trench batteries, x >= 0.325 L): no body structure outside the hull side at the trench
# height (trench 80 m centred on the belt edge, +-40 m margin), so the batteries keep their line of fire.
ST=json.load(open(SP+'stations-fit.json'));HW,HH=6422.508,1400.706
def prof(t):
    for a,b in zip(ST,ST[1:]):
        if a[0]<=t<=b[0]:
            u=(t-a[0])/max(1e-9,b[0]-a[0]);return [a[k]+(b[k]-a[k])*u for k in range(8)]
    return ST[-1]
def trench_zone(y0,y1):
    # outside the actual hull section (wedge planform included) between the trench's x range, at trench heights
    out=[]
    for yy in (y0+15,y0+45):
        edges=[]
        for x in range(int(0.473684*19000),int(0.9848*19000),400):
            t,pw,ph,dy,dw,kw,bw,cw=prof(x/19000);h=HH*ph;yc=HH*(.5+dy);bot=yc-h/2;edges.append(bot+h*min(.8,max(.2,cw)))
        if (yy<min(edges)-150 or yy>max(edges)+150) and (yy<300 or yy>540):continue
        Hs=region(Hh,yy).buffer(40);out.append(box(int(0.473684*19000),-4000,int(0.9848*19000)+50,4000).difference(Hs))
    return unary_union(out) if out else Polygon()

out=[]
for y0 in range(0,1500,60):
    ex=casings_band(y0,y0+60)
    if y0+60>1380:ex=ex.union(box(5850,-280,6320,280))
    ex=ex.union(trench_zone(y0,y0+60))
    n0=len(out)
    for i,j in ((0,5),):
            reg=region(E,y0+30)
            if reg.is_empty:continue
            reg=reg.difference(region(Hh,y0+30).buffer(.5))
            reg=reg.difference(ex).buffer(-1).buffer(1)
            for g in nohole(reg):
                full=(i==0 and j==5)
                if g.area<6000 or minwidth(g)<20:continue
                q=simp(g)
                if q is None:continue
                z0,z1=q.bounds[1],q.bounds[3]
                if z1<=0.5:continue
                m=1 if z0>=-0.5 else 0
                if m==0 and z1<-z0-1:continue
                pts=list(q.exterior.coords)[:-1]
                out.append(dict(y=[y0,y0+60],m=m,o=[round(v,1) for p in pts for v in p],area=round(q.area)))
    print(y0,len(out)-n0,flush=True)
json.dump(out,open(SP+'body60.json','w'));print('pieces',len(out),'parts',len(out)+sum(o['m'] for o in out),'area km2',round(sum(o['area']*(1+o['m']) for o in out)/1e6,2))
