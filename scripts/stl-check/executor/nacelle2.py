# Original engine casings measured on x-plane sections (y-z polygons, even-odd): along each engine axis forward of the
# mouth, the solid radius around the axis in 16 directions, and the share of directions where the casing ends in open
# space within 2.2 R (a free-standing casing). Engines on +z and the centre line (the -z side is the mirror).
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,Point,LineString
from hsection import loops
E=np.load(SP+'stl-exe-game.npy').astype(float);xlo=E[:,:,0].min(1);xhi=E[:,:,0].max(1)
eng=[e for e in json.load(open(SP+'engines-detail.json')) if e['c'][2]>=0]
def xsection(x,box):
    m=(xlo<=x)&(xhi>=x);T=E[m];T=T[(T[:,:,2].max(1)>=box[0])&(T[:,:,2].min(1)<=box[1])&(T[:,:,1].max(1)>=box[2])&(T[:,:,1].min(1)<=box[3])];segs=[]
    for t in T:
        d=t[:,0]-x;p=[]
        for i,j in ((0,1),(1,2),(2,0)):
            if (d[i]<0)!=(d[j]<0):u=d[i]/(d[i]-d[j]);q=t[i]+(t[j]-t[i])*u;p.append((q[2],q[1]))
        if len(p)==2:segs.append(p)
    r=Polygon()
    for L in loops(segs):
        if len(L)>3:
            P=Polygon(L).buffer(0)
            if P.area>1:
                try:r=r.symmetric_difference(P)
                except Exception:
                    import shapely;r=shapely.set_precision(r,0.01).symmetric_difference(shapely.set_precision(P,0.01))
    return r.buffer(0)
res=[]
def _main():
  pass
for e in (eng if __name__=="__main__" else []):
    R0=e['d']/2;mx=e['c'][0]-e['nozzleLength']/2;y0,z0=e['c'][1],e['c'][2];prof=[]
    for dx in range(0,3300,150):
        x=mx+dx;S=xsection(x,(z0-3*R0,z0+3*R0,y0-3*R0,y0+3*R0));rads=[];free=0
        for a in np.linspace(0,2*np.pi,16,endpoint=False):
            ray=LineString([(z0,y0),(z0+2.2*R0*np.cos(a),y0+2.2*R0*np.sin(a))]);hit=ray.intersection(S)
            # solid run from the axis outward
            r=0
            if not hit.is_empty:
                segs=[hit] if hit.geom_type=='LineString' else [g for g in getattr(hit,'geoms',[]) if g.geom_type=='LineString']
                for g in segs:
                    c=np.array(g.coords);d0=np.hypot(c[:,0]-z0,c[:,1]-y0)
                    if d0.min()<5:r=max(r,d0.max())
            rads.append(r);free+=1 if r<2.15*R0 else 0
        prof.append((dx,round(float(np.median(rads))),round(free/16,2),round(S.area)))
    ex=[p for p in prof if p[2]>=0.5 and p[1]>0.3*R0];last=max([p[0] for p in ex],default=-1)
    res.append(dict(id=e['id'],mouth_x=round(mx),y=y0,z=z0,d=e['d'],free_until=last,profile=prof))
    print(e['id'],'mouth',round(mx),'y',y0,'z',z0,'d',e['d'],'| free casing until',last,'m | (dx, median radius, free share)',[(p[0],p[1],p[2]) for p in prof[:12]],flush=True)
if __name__=="__main__":json.dump(res,open(SP+"nacelles.json","w"),indent=1)
