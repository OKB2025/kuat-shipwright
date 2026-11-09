import json,numpy as np
from refit import Mesh
from comps import components
import tolofts
A='/mnt/user-data/attachments/9168e617-b83b-5e65-bbbf-23ebdd64786b/5f3fc3ce-Lucre_Combined_HD.stl'
m=Mesh(A,(1,2,0),3170,(1,1,1),0);lab=components(m.T)
info=[]
for c in range(lab.max()+1):
    Q=m.T[lab==c].reshape(-1,3);info.append((np.prod(Q.max(0)-Q.min(0)+.5),c,Q.min(0),Q.max(0)))
info.sort(key=lambda v:-v[0])
big=info[0][1]
# core sphere: least-squares fit to the big solid's vertices in the sphere's region
V=np.unique(m.T[lab==big].reshape(-1,3).round(3),axis=0)
guess=np.array([1527.,338.,0.]);sel=V[np.linalg.norm(V-guess,axis=1)<380]
for it in range(6):
    A_=np.c_[2*sel,np.ones(len(sel))];b=(sel**2).sum(1);c=np.linalg.lstsq(A_,b,rcond=None)[0];C=c[:3];R=np.sqrt(c[3]+C@C)
    d=np.abs(np.linalg.norm(sel-C,axis=1)-R);sel=sel[d<np.percentile(d,70)]
print('sphere centre',C.round(1),'R',round(R,1))
# translate into the builder's frame: sphere centre at (R, 413, 0) as before
T0=np.array([C[0]-R,C[1]-413,0.]);m.T=m.T-T0
C2=C-T0
# split the big solid: drop triangles on the sphere, re-split the rest
tri=np.where(lab==big)[0];cent=m.T[tri].mean(1);on=np.abs(np.linalg.norm(m.T[tri]-C2,axis=2).max(1))<R*1.03
rest=tri[~on]
sub=components(m.T[rest]);lab2=lab.copy();base=lab.max()+1
for i,t in enumerate(rest): lab2[t]=base+sub[i]
lab2[tri[on]]=-1
items=[]
for c in np.unique(lab2):
    if c<0: continue
    T=m.T[lab2==c];Q=T.reshape(-1,3);lo,hi=Q.min(0),Q.max(0);vol=np.prod(hi-lo+.5)
    items.append(dict(T=T,lo=lo,hi=hi,vol=vol,c=int(c)))
items.sort(key=lambda a:-a['vol'])
# ring layers: solids reaching over 1,100 m from the core axis
rad=lambda a:np.hypot(a['T'][:,:,0]-C2[0],a['T'][:,:,2]).ravel()
ring=[a for a in items if rad(a).max()>1100 and np.percentile(rad(a),2)>600 and a['vol']>1e8]
ringIds={a['c'] for a in ring}
arcs=[]
layers={}
for a in ring:
    key=(round(a['lo'][1]),round(a['hi'][1]));layers.setdefault(key,[]).append(a)
for (y0,y1),L_ in sorted(layers.items()):
    P=np.concatenate([a['T'].reshape(-1,3) for a in L_]);dx=P[:,0]-C2[0];dz=P[:,2];r=np.hypot(dx,dz);ang=np.degrees(np.arctan2(np.abs(dz),dx))
    arcs.append(dict(y0=float(P[:,1].min()),y1=float(P[:,1].max()),rOut=float(r.max()),rIn=float(np.percentile(r,1)),open=float(ang[r>np.percentile(r,50)].min())))
print('arcs',[{k:round(v,1) for k,v in a.items()} for a in arcs])
others=[a for a in items if a['c'] not in ringIds and a['vol']>3e5]
used=[False]*len(others);parts=[]
key=lambda a:[a['lo'][0],a['hi'][0],a['lo'][1],a['hi'][1]]
for i,a in enumerate(others):
    if used[i]: continue
    used[i]=True;mirror=False
    if a['lo'][2]>.5 or a['hi'][2]<-.5:
        for j,b in enumerate(others):
            if used[j] or j==i: continue
            if np.allclose(key(a),key(b),atol=8) and np.allclose([a['lo'][2],a['hi'][2]],[-b['hi'][2],-b['lo'][2]],atol=8):
                used[j]=True;mirror=True
                if a['hi'][2]<-.5: a=b
                break
    rows=tolofts.slice_rows(a['T'])
    if rows: parts.append(dict(rows=rows,mirror=mirror,round=bool(tolofts.roundness(a['T']))))
out=dict(sphere=dict(c=[round(float(v),2) for v in C2],R=round(float(R),2)),arcs=arcs,parts=parts)
json.dump(out,open('luc_new.json','w'));print('parts',len(parts),'mirrored',sum(p['mirror'] for p in parts))
