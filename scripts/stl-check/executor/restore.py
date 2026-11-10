# Original material the Executor example lacks above its hull (city) and below it (ventral), band by band.
# Per 30 m band [y0,y1] at the mid-height: M = STL section − example structures (buffer 2 m), then
#   city    = M − (hull sections of every higher band)   (nothing of the hull above: not a trench/recess/channel)
#   ventral = M ∩ (hull sections above) − (hull sections below)
# minus engine boxes (+60 m) and the model's own bridge (replaced by the Imperial-class one by the user's decision).
# Pieces keep area >= 4000 m2 and a minimum width >= 15 m (the original measurement's limits), are split into
# hole-free pieces and simplified to <= 96 points; off-centre pieces become mirrored pairs (measured on +z).
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,MultiPolygon,box,LineString
from shapely.ops import unary_union,split
from gaps import region,game_region,E,G,ids,meta
eng=json.load(open(SP+'engines.json'));hullIdx=[m['i'] for m in meta if m['form']=='hull']
def hull_at(y):
    parts=[region(G[ids==i],y) for i in hullIdx];return unary_union(parts)
bands=[(y,y+30) for y in range(0,1470,30)];mid=[(a+b)/2 for a,b in bands]
H={m:hull_at(m) for m in mid};print('hull sections done',flush=True)
def nohole(g):
    out=[];todo=[g]
    while todo:
        p=todo.pop()
        if p.is_empty:continue
        if isinstance(p,MultiPolygon):todo+=list(p.geoms);continue
        if not p.interiors:out.append(p);continue
        c=p.interiors[0].centroid;x0,z0,x1,z1=p.bounds
        cut=LineString([(c.x,z0-10),(c.x,z1+10)]);pieces=split(p,cut)
        todo+=[q for q in pieces.geoms]
    return out
def minwidth(p):
    r=p.minimum_rotated_rectangle;c=np.array(r.exterior.coords);e=np.hypot(*np.diff(c,axis=0).T);return min(e[:2])
def simp(p):
    for tol in (0.5,1,2,3,5,8,12,20):
        q=p.simplify(tol,preserve_topology=True)
        if isinstance(q,Polygon) and q.is_valid and len(q.exterior.coords)-1<=96:return q
    return None
out=[];stats={}
exclude=unary_union([box(e['aabb'][0]-60,e['aabb'][2]-60,e['aabb'][3]+60,e['aabb'][5]+60) for e in eng])
for (y0,y1),ym in zip(bands,mid):
    S=region(E,ym)
    if S.is_empty:continue
    Gm=game_region(ym);M=S.difference(Gm.buffer(2))
    above=unary_union([H[m] for m in mid if m>ym]);below=unary_union([H[m] for m in mid if m<ym])
    city=M.difference(above);ventral=M.intersection(above).difference(below)
    engx=exclude if any(e['aabb'][1]-60<=ym<=e['aabb'][4]+60 for e in eng) else Polygon()
    for kind,R in (('city',city),('ventral',ventral)):
        R=R.difference(engx)
        if ym>1380:R=R.difference(box(5850,-280,6320,280))
        R=R.buffer(-1).buffer(1)
        for g in nohole(R):
            if g.area<4000 or minwidth(g)<15:continue
            q=simp(g)
            if q is None:continue
            z0,z1=q.bounds[1],q.bounds[3]
            if z1<=0.5:continue            # the -z twin of a mirrored piece
            m=1 if z0>=-0.5 else 0
            if m==0 and z1<-z0-1:continue
            pts=list(q.exterior.coords)[:-1]
            out.append(dict(y=[y0,y1],m=m,kind=kind,area=round(q.area),o=[round(v,1) for p in pts for v in p]))
    stats[ym]=sum(o['area'] for o in out if o['y'][0]==y0)
    print(y0,y1,'pieces',sum(1 for o in out if o['y'][0]==y0),'area',stats[ym],flush=True)
json.dump(out,open(SP+'restored.json','w'));print('total pieces',len(out),'mirrored',sum(o['m'] for o in out),'parts after mirroring',len(out)+sum(o['m'] for o in out))
