import json,numpy as np
from refit import Mesh,refit_station
from comps import components
src=open('/home/claude/kuat-shipwright/js/core.js').read()
i=src.index('const RECU=')+len('const RECU=');D,end=json.JSONDecoder().raw_decode(src[i:])
A='/mnt/user-data/attachments/9168e617-b83b-5e65-bbbf-23ebdd64786b/d4cbb8ec-Recusant.stl'
m=Mesh(A,(1,2,0),1187.0);lab=components(m.T)
# hull: the two dome shells (the largest components spanning the centre line over the mid and bow sections)
vols=[];P=None
for c in range(lab.max()+1):
    T=m.T[lab==c];Q=T.reshape(-1,3);vols.append((np.prod(Q.max(0)-Q.min(0)),c,Q.min(0),Q.max(0)))
vols.sort(key=lambda v:-v[0]);hullc=[v[1] for v in vols[:2]];print('hull comps',[(v[2].round(0),v[3].round(0)) for v in vols[:2]])
H=Mesh.__new__(Mesh);H.T=m.T[np.isin(lab,hullc)];H.xmin=H.T[:,:,0].min(1);H.xmax=H.T[:,:,0].max(1);H.k=m.k
L=1187.0;W=D['W'];Hh=D['H']
fits=[refit_station(H,L,W,Hh,r,margin=2.0,minm=40) if r[1]>.05 else None for r in D['st']]
NW=max(2*f['hw'] for f in fits if f);NH=m.hi[1]
st=[]
for r,f in zip(D['st'],fits):
    if not f: st.append([r[0],round(r[1]*W/NW,4),round(r[2]*Hh/NH,4),round(((r[3]+.5)*Hh)/NH-.5,4)]+r[4:]);continue
    h=f['top']-f['bot'];st.append([r[0],round(2*f['hw']/NW,4),round(h/NH,4),round(((f['top']+f['bot'])/2)/NH-.5,4),round(f['deck'],4),round(f['keel'],4),round(f['belt'],3),round(f['chine'],3)])
parts=[p for p in json.load(open('rec_lofts.json'))]
hullboxes=[(v[2],v[3]) for v in vols[:2]]
parts=[p for p in parts if not any(np.allclose(p['lo'],lo,atol=1.5) and np.allclose(p['hi'],hi,atol=1.5) for lo,hi in hullboxes)]
N=dict(D);N['W']=round(NW,3);N['H']=round(float(NH),3);N['st']=st;N['parts']=[{k:p[k] for k in ('rows','mirror','round')} for p in parts]
json.dump(N,open('rec_new2.json','w'))
print('W',N['W'],'H',N['H'],'parts',len(parts))
