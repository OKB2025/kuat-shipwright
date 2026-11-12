# Drop body slabs that are only a thin skin over the hull (top within SKIN m of the hull top under most of the slab):
# the original's deck surface detail, which the example leaves to the hull (user decision: no fine hull detail).
import numpy as np,json,sys,os
SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,Point
SKIN=float(os.environ.get('KS_SKIN_M','90'))
Hh=np.fromfile(SP+'hullfit1.f32',np.float32).reshape(-1,3,3).astype(float);lo=Hh[:,:,[0,2]].min(1);hi=Hh[:,:,[0,2]].max(1)
def col(x,z):
    m=(lo[:,0]<=x)&(hi[:,0]>=x)&(lo[:,1]<=z)&(hi[:,1]>=z);T=Hh[m]
    if not len(T):return None
    a,b,c=T[:,0],T[:,1],T[:,2];d=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);ok=np.abs(d)>1e-12
    l1=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/np.where(ok,d,1);l2=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/np.where(ok,d,1);l3=1-l1-l2
    h=ok&(l1>=0)&(l2>=0)&(l3>=0);y=l1[h]*a[h,1]+l2[h]*b[h,1]+l3[h]*c[h,1]
    return (y.min(),y.max()) if len(y) else None
B=json.load(open(SP+'body60.json'));keep=[];drop=0;rng=np.random.default_rng(1)
for b in B:
    P=Polygon(np.array(b['o']).reshape(-1,2));x0,z0,x1,z1=P.bounds;pts=[]
    for _ in range(400):
        q=(rng.uniform(x0,x1),rng.uniform(z0,z1))
        if P.contains(Point(q)):pts.append(q)
        if len(pts)>=24:break
    skin=0;n=0
    for x,z in pts:
        c=col(x,z)
        if c is None:continue
        n+=1
        if b['y'][1]<=c[1]+SKIN and b['y'][0]>=c[1]-SKIN:skin+=1
    if n and skin>=.8*len(pts):drop+=1;continue
    keep.append(b)
json.dump(keep,open(SP+'body60.json','w'));print('skin slabs dropped',drop,'kept',len(keep))
