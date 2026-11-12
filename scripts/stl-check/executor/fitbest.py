# Best-match fit of each Executor hull station: the octagon whose symmetric difference with the original hull layer
# (the original section inside the station's starting octagon, engine casings counted as original) is smallest.
# The hull may grow as well as shrink, so the deck reaches the original deck instead of sitting below it.
import numpy as np,json,sys,os
SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import hullfit as hf
from fitstations_lib import octa,from_st,to_st
info=json.load(open(SP+'hull0.json'));ST=info['stations'];W,H,L=info['W'],info['H'],info['L']
out=[];rep=[]
for r in ST:
    t=r[0];x=min(max(t*L,20),L-20);p=from_st(r);S0=octa(p).buffer(60)
    O=hf.sect(hf.E,x,hf.bb).union(hf.casings(x)).intersection(S0);AO=max(1,O.area)
    def J(q):
        g=octa(q)
        if g.is_empty:return 9
        return (g.difference(O).area+O.difference(g).area)/AO
    best=J(p);steps=0
    while steps<300:
        steps+=1;cand=None
        for k in ((1,2,3,5,6) if t>=0.473684 else range(7)):   # trench stations keep width and belt (the trench battery needs them)
            for mag in (.01,.03,.08):
                for s in (-1,1):
                    q=p[:];h=p[1]-p[2]
                    if k==0:q[0]*=1+s*mag
                    elif k==1:q[1]+=s*mag*h
                    elif k==2:q[2]+=s*mag*h
                    elif k==3:q[3]+=s*mag*h
                    elif k==4:q[4]*=1+s*mag
                    elif k==5:q[5]=min(.98,max(0,p[5]+s*mag*2))
                    elif k==6:q[6]=min(.98,max(0,p[6]+s*mag*2))
                    hh=q[1]-q[2]
                    if hh<20 or q[0]<20 or q[4]<=1:continue
                    if not (.2<=(q[3]-q[2])/hh<=.8):continue
                    if q[4]>hh:continue
                    j=J(q)
                    if j<best-1e-5 and (cand is None or j<cand[0]):cand=(j,q)
        if cand is None:break
        best,p=cand
    g=octa(p);rep.append(dict(t=t,x=round(x),J0=round(J(from_st(r)),3),J=round(best,3),outside=round(g.difference(O).area/AO,3),missing=round(O.difference(g).area/AO,3)))
    out.append(to_st(t,p));print(json.dumps(rep[-1]),flush=True)
json.dump(out,open(SP+'stations-fit.json','w'));json.dump(rep,open(SP+'stations-fit-report.json','w'),indent=1)
