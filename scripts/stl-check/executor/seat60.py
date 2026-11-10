# Seat each body slab on the hull: a slab with hull material just below (city) / above (ventral) within 40 m is extended
# to the lowest hull top (highest hull bottom) under its outline, so no visible wedge gap remains over a sloping deck.
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,Point
Hh=np.fromfile(SP+'hullfit1.f32',np.float32).reshape(-1,3,3).astype(float);lo=Hh[:,:,[0,2]].min(1);hi=Hh[:,:,[0,2]].max(1)
def col(x,z):
    m=(lo[:,0]<=x)&(hi[:,0]>=x)&(lo[:,1]<=z)&(hi[:,1]>=z);T=Hh[m]
    if not len(T):return None
    a,b,c=T[:,0],T[:,1],T[:,2];d=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);ok=np.abs(d)>1e-12
    l1=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/np.where(ok,d,1);l2=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/np.where(ok,d,1);l3=1-l1-l2
    h=ok&(l1>=0)&(l2>=0)&(l3>=0);y=l1[h]*a[h,1]+l2[h]*b[h,1]+l3[h]*c[h,1]
    return (y.min(),y.max()) if len(y) else None
B=json.load(open(SP+'body60.json'));n=0
for p in B:
    P=Polygon(np.array(p['o']).reshape(-1,2));pts=[]
    x0,z0,x1,z1=P.bounds
    for x in np.linspace(x0,x1,8):
        for z in np.linspace(z0,z1,8):
            if P.contains(Point(x,z)):pts.append((x,z))
    pts.append((P.representative_point().x,P.representative_point().y))
    cols=[c for c in (col(x,z) for x,z in pts) if c]
    if not cols:continue
    y0,y1=p['y'];tops=[c[1] for c in cols if c[1]<=y0+1 and y0-c[1]<70];bots=[c[0] for c in cols if c[0]>=y1-1 and c[0]-y1<70]
    if tops:p['y'][0]=round(min(tops)-1,1);n+=1
    elif bots:p['y'][1]=round(max(bots)+1,1);n+=1
json.dump(B,open(SP+'body60-seated.json','w'));print('seated',n,'of',len(B))
