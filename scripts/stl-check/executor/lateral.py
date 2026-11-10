# For terraces that float in the example where the original is empty below: the original section loop that contains
# the terrace at its own band, and how much of that loop the example lacks (lateral connection to the rest of the city).
import json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Point
from gaps import region,game_region,E,G,ids,meta
byid={m['id']:m for m in meta}
for fid in [61,62,68,90]:
    m=byid[fid];a=m['aabb'];ym=(a[1]+a[4])/2;foot=region(G[ids==m['i']],ym);S=region(E,ym);Gm=game_region(ym)
    geoms=list(S.geoms) if hasattr(S,'geoms') else [S];hit=[g for g in geoms if g.intersects(foot)]
    for g in hit:
        miss=g.difference(Gm.buffer(1))
        mg=list(miss.geoms) if hasattr(miss,'geoms') else [miss];touch=[q for q in mg if q.distance(foot)<3]
        print(fid,'band',a[1],a[4],'terrace area',round(foot.area),'| original loop area',round(g.area),'bounds',[round(v) for v in g.bounds],'| example lacks',round(miss.area),'of it; pieces touching the terrace',[(round(q.area),[round(v) for v in q.bounds]) for q in touch][:4])
