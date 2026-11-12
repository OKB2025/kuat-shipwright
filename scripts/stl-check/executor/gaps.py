# For each 30 m band of the city/ventral terraces: original section (STL) minus the example's own hull and existing
# structures at the band's mid-height. What remains is original material the example does not have at that height.
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,MultiPolygon,Point
from shapely.ops import unary_union,polygonize
from hsection import loops
E=np.load(SP+'stl-exe-game.npy').astype(float);G=np.fromfile(SP+'game-exe.f32',np.float32).reshape(-1,3,3).astype(float);ids=np.fromfile(SP+'game-exe.ids',np.int32);meta=json.load(open(SP+'game-exe.json'))['meta']
def segs_at(T,y):
    m=(T[:,:,1].min(1)<=y)&(T[:,:,1].max(1)>=y);out=[]
    for t in T[m]:
        d=t[:,1]-y;p=[]
        for i,j in ((0,1),(1,2),(2,0)):
            if (d[i]<0)!=(d[j]<0):u=d[i]/(d[i]-d[j]);q=t[i]+(t[j]-t[i])*u;p.append((q[0],q[2]))
        if len(p)==2:out.append(p)
    return out
def region(T,y):
    """even-odd region of a closed mesh's section"""
    Ls=[L for L in loops(segs_at(T,y)) if len(L)>3]
    polys=[Polygon(L).buffer(0) for L in Ls];polys=[p for p in polys if p.area>1]
    r=Polygon()
    for p in polys:r=r.symmetric_difference(p)
    return r.buffer(0)
def game_region(y,skip_struts=True):
    parts=[]
    for m in meta:
        if skip_struts and m['strut']:continue
        a=m['aabb']
        if a[1]>y or a[4]<y:continue
        r=region(G[ids==m['i']],y)
        if not r.is_empty:parts.append(r)
    return unary_union(parts) if parts else Polygon()
if __name__=='__main__':
    bands=[float(v) for v in sys.argv[1].split(',')];res={}
    for y in bands:
        S=region(E,y);Gm=game_region(y);M=S.difference(Gm.buffer(2)).buffer(-1).buffer(1)
        geoms=[g for g in (M.geoms if hasattr(M,'geoms') else [M]) if g.area>=4000]
        res[y]=dict(stl=round(S.area),game=round(Gm.area),missing=round(M.area),missingBig=[dict(area=round(g.area),bounds=[round(v) for v in g.bounds]) for g in sorted(geoms,key=lambda g:-g.area)[:6]])
        print(y,json.dumps(res[y])[:600])
    json.dump(res,open(SP+'gaps.json','w'),indent=1)
    