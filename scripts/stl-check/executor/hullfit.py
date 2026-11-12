# Where the primary hull (before trench/cuts) leaves the original minus the engine spaces, per x (every 100 m).
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,Point,box
from shapely.ops import unary_union
from nacelle2 import xsection as _x
import nacelle2
E=nacelle2.E
Hh=np.fromfile(SP+'hull0.f32',np.float32).reshape(-1,3,3).astype(float);NAC=json.load(open(SP+'nacelles.json'))
def sect(T,x,bb):
    nacelle2.E=T;nacelle2.xlo=T[:,:,0].min(1);nacelle2.xhi=T[:,:,0].max(1);r=_x(x,bb);return r
def casings(x):
    out=[]
    for n in NAC:
        L=max(n['free_until'],0)+150;R=n.get('casing_r',n['d']/2)+15
        if n['mouth_x']-200<=x<=n['mouth_x']+L:
            for z in {n['z'],-n['z']}:out.append(Point(z,n['y']).buffer(R,32))
    return unary_union(out) if out else Polygon()
bb=(-3400,3400,-50,1800);rows=[]
if __name__=="__main__":
  for x in range(50,19000,100):
      H=sect(Hh,x,bb);O=sect(E,x,bb).difference(casings(x))
      if H.is_empty:continue
      out=H.difference(O);rows.append((x,round(H.area),round(out.area),round(out.area/H.area,3)))
  json.dump(rows,open(SP+'hullfit.json','w'))
  bad=[r for r in rows if r[3]>0.02]
  print('stations sampled',len(rows),'with >2% of the hull section outside the original:',len(bad))
  for r in rows[::10]:print(r)
  