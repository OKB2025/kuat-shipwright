"""Convert a model's connected components into measured x-lofts.
Each component is sliced on its own (no neighbours) at its vertex stations;
mirror twins (same shape at -z) are emitted once with mirror=True."""
import numpy as np,json,sys
from refit import Mesh,clip
from comps import components

def slice_rows(T,nmax=24):
    X=T[:,:,0].ravel();x0,x1=float(X.min()),float(X.max())
    if x1-x0<1e-3: return None
    xs=np.unique(np.round(X,2));eps=max(1e-4,(x1-x0)*1e-4)
    # stations: all distinct vertex x (shape changes only there), thinned to nmax
    if len(xs)>nmax: xs=np.unique(np.concatenate([[x0,x1],np.quantile(xs,np.linspace(0,1,nmax))]))
    rows=[]
    for x in xs:
        xe=min(max(x,x0+eps),x1-eps)
        m=(T[:,:,0].min(1)<=xe)&(T[:,:,0].max(1)>=xe);P=[]
        for tri in T[m]:
            for a,b in ((0,1),(1,2),(2,0)):
                pa,pb=tri[a],tri[b];da,db=pa[0]-xe,pb[0]-xe
                if (da<=0<=db) or (db<=0<=da):
                    u=da/(da-db) if da!=db else 0;P.append((pa+(pb-pa)*u)[[2,1]])
        if len(P)<2: continue
        P=np.array(P);rows.append([round(float(x),2),round(float(P[:,0].min()),2),round(float(P[:,0].max()),2),round(float(P[:,1].min()),2),round(float(P[:,1].max()),2)])
    # one row per x, merge identical consecutive rows except the ends
    out=[]
    for r in rows:
        if out and abs(out[-1][0]-r[0])<.05: continue
        out.append(r)
    if len(out)<2: return None
    return out

def roundness(T):
    # share of the bounding cross-section the component fills at its mid station
    P=T.reshape(-1,3);c=(P.min(0)+P.max(0))/2;e=(P.max(0)-P.min(0))/2+1e-6
    q=(P[:,[1,2]]-c[[1,2]])/e[[1,2]];r=np.hypot(q[:,0],q[:,1])
    corner=(r>1.2).mean()
    return corner<.02

def run(stl,axes,L,minvol,out,flip=(1,1,1),by=0):
    m=Mesh(stl,axes,L,flip,by);lab=components(m.T);n=lab.max()+1;items=[]
    for i in range(n):
        T=m.T[lab==i];P=T.reshape(-1,3);lo,hi=P.min(0),P.max(0);vol=np.prod(hi-lo+.5)
        if vol<minvol: continue
        items.append(dict(T=T,lo=lo,hi=hi,vol=vol))
    used=[False]*len(items);res=[]
    for i,a in enumerate(items):
        if used[i]: continue
        used[i]=True;mirror=False
        if a['lo'][2]>0.5:  # starboard: look for its port twin
            for j,b in enumerate(items):
                if used[j]: continue
                if np.allclose([b['lo'][0],b['hi'][0],b['lo'][1],b['hi'][1],-b['hi'][2],-b['lo'][2]],[a['lo'][0],a['hi'][0],a['lo'][1],a['hi'][1],a['lo'][2],a['hi'][2]],atol=1.0):
                    used[j]=True;mirror=True;break
        elif a['hi'][2]<-0.5:
            for j,b in enumerate(items):
                if used[j]: continue
                if np.allclose([b['lo'][0],b['hi'][0],b['lo'][1],b['hi'][1],-b['hi'][2],-b['lo'][2]],[a['lo'][0],a['hi'][0],a['lo'][1],a['hi'][1],a['lo'][2],a['hi'][2]],atol=1.0):
                    used[j]=True;mirror=True;a=b;break
        rows=slice_rows(a['T'])
        if not rows: continue
        res.append(dict(rows=rows,mirror=mirror,round=bool(roundness(a['T'])),vol=round(float(a['vol'])),lo=[round(float(v),1) for v in a['lo']],hi=[round(float(v),1) for v in a['hi']]))
    res.sort(key=lambda r:-r['vol'])
    json.dump(res,open(out,'w'))
    print(len(items),'components kept ->',len(res),'lofts',sum(r['mirror'] for r in res),'mirrored')
if __name__=='__main__':
    run(sys.argv[1],tuple(map(int,sys.argv[2].split(','))),float(sys.argv[3]),float(sys.argv[4]),sys.argv[5],tuple(map(int,sys.argv[6].split(','))) if len(sys.argv)>6 else (1,1,1),int(sys.argv[7]) if len(sys.argv)>7 else 0)
