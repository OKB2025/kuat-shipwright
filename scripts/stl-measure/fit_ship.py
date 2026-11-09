"""fit_ship.py NAME STL axes flip by L minvol hullRanks out
Hull stations (at the data block's own station positions) are fitted to the
model's solids of the given volume ranks; every other solid is a measured loft."""
import json,sys,numpy as np
from refit import Mesh,refit_station
from comps import components
import tolofts
name,stl,axes,flip,by,L,minvol,ranks,out=sys.argv[1:10]
axes=tuple(map(int,axes.split(',')));flip=tuple(map(int,flip.split(',')));by=int(by);L=float(L);minvol=float(minvol);ranks=[int(r) for r in ranks.split(',')] if ranks else []
src=open('/home/claude/kuat-shipwright/js/core.js').read()
i=src.index('const '+name+'=')+len('const '+name+'=');D,_=json.JSONDecoder().raw_decode(src[i:])
m=Mesh(stl,axes,L,flip,by);lab=components(m.T);n=lab.max()+1
info=[]
for c in range(n):
    Q=m.T[lab==c].reshape(-1,3);info.append((float(np.prod(Q.max(0)-Q.min(0)+.5)),c,Q.min(0),Q.max(0)))
info.sort(key=lambda v:-v[0]);hullc=[info[r][1] for r in ranks]
for r in ranks: print('hull solid',r,info[r][2].round(0),info[r][3].round(0))
N={k:v for k,v in D.items() if k!='loft'}
if 'st' in D and hullc:
    H=Mesh.__new__(Mesh);H.T=m.T[np.isin(lab,hullc)];H.xmin=H.T[:,:,0].min(1);H.xmax=H.T[:,:,0].max(1);H.k=m.k
    Q=H.T.reshape(-1,3);x0,x1=Q[:,0].min(),Q[:,0].max();W=D['W'];Hh=D['H']
    st=[];fits=[]
    for r in D['st']:
        x=r[0]*L
        if x<x0-1 or x>x1+1: fits.append(None);continue
        w=H.window(min(max(x,x0+.01),x1-.01),-1e5,1e5,-1e5,1e5)
        if w is None or len(w)<3: fits.append(None);continue
        z=np.abs(w[:,0]);y=w[:,1];HW=z.max();T=y.max();B=y.min();HH=max(.5,T-B)
        near=lambda sel:(z[sel].max()/HW) if sel.any() else .5
        wide=z>=.97*HW
        fits.append(dict(hw=HW,top=T,bot=B,deck=min(.98,near(y>T-.08*HH)),keel=min(.98,near(y<B+.08*HH)),chine=min(.8,max(.2,(y[wide].mean()-B)/HH)),belt=min(.98,max(.02,(y[wide].max()-y[wide].min())/HH))))
    NW=max(2*f['hw'] for f in fits if f);NH=float(m.hi[1])
    for r,f in zip(D['st'],fits):
        if not f:
            # outside the fitted solids: a thin keel line at the nearest fitted height
            g=min((ff for ff in fits if ff),key=lambda ff:0);st.append([r[0],.005,.005,round(((g['top']+g['bot'])/2)/NH-.5,4),.8,.8,.5,.5]);continue
        st.append([r[0],round(2*f['hw']/NW,4),round((f['top']-f['bot'])/NH,4),round(((f['top']+f['bot'])/2)/NH-.5,4),round(f['deck'],4),round(f['keel'],4),round(f['belt'],3),round(f['chine'],3)])
    N['W']=round(NW,3);N['H']=round(NH,3);N['st']=st
# lofts of every other solid
items=[]
for vol,c,lo,hi in info:
    if c in hullc or vol<minvol: continue
    items.append(dict(T=m.T[lab==c],lo=lo,hi=hi,vol=vol))
used=[False]*len(items);parts=[]
key=lambda a:[a['lo'][0],a['hi'][0],a['lo'][1],a['hi'][1]]
for i,a in enumerate(items):
    if used[i]: continue
    used[i]=True;mirror=False
    if a['lo'][2]>.5 or a['hi'][2]<-.5:
        for j,b in enumerate(items):
            if used[j] or j==i: continue
            if np.allclose(key(a),key(b),atol=max(1.0,L*.002)) and np.allclose([a['lo'][2],a['hi'][2]],[-b['hi'][2],-b['lo'][2]],atol=max(1.0,L*.002)):
                used[j]=True;mirror=True
                if a['hi'][2]<-.5: a=b
                break
    rows=tolofts.slice_rows(a['T'])
    if rows: parts.append(dict(rows=rows,mirror=mirror,round=bool(tolofts.roundness(a['T']))))
N['parts']=parts
json.dump(N,open(out,'w'));print(name,'W',N.get('W'),'H',N.get('H'),'parts',len(parts),'mirrored',sum(p['mirror'] for p in parts))
