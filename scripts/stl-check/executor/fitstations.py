# Fit each Executor hull station's warship octagon inside the original minus the engine spaces (greedy shrink).
# Station: [t, pw, ph, dy, deck, keel, belt, chine]; hw=W*pw/2, h=H*ph, yc=H*(.5+dy).
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon
import hullfit as hf
info=json.load(open(SP+'hull0.json'));ST=info['stations'];W,H,L=info['W'],info['H'],info['L'];TRENCH=0.325
def octa(p):
    hw,top,bot,edge,bh,deck,keel=p;h=top-bot
    return Polygon([(-hw*keel,bot),(hw*keel,bot),(hw,max(bot,edge-bh/2)),(hw,min(top,edge+bh/2)),(hw*deck,top),(-hw*deck,top),(-hw,min(top,edge+bh/2)),(-hw,max(bot,edge-bh/2))]).buffer(0)
def from_st(r):
    t,pw,ph,dy,dw,kw,bw,cw=r;hw=W*pw/2;h=H*ph;yc=H*(.5+dy);top=yc+h/2;bot=yc-h/2;edge=bot+h*min(.8,max(.2,cw));return [hw,top,bot,edge,h*bw,min(.98,dw),min(.98,kw)]
def to_st(t,p):
    hw,top,bot,edge,bh,deck,keel=p;h=top-bot;return [round(t,6),round(2*hw/W,6),round(h/H,6),round(((top+bot)/2)/H-.5,6),round(deck,4),round(keel,4),round(min(.98,max(.02,bh/h)),4),round(min(.8,max(.2,(edge-bot)/h)),4)]
out=[];rep=[]
for r in ST:
    t=r[0];x=min(max(t*L,20),L-20);O=hf.sect(hf.E,x,hf.bb).difference(hf.casings(x));p=from_st(r);A0=octa(p).area
    def bad(q):
        g=octa(q);return g.difference(O).area/max(1,g.area)
    trench=t>=TRENCH;steps=0
    while bad(p)>0.012 and steps<400:
        steps+=1;best=None
        for k,dv in ((1,-1),(2,1),(5,-.02),(6,-.02),(3,0)) + (() if trench else ((0,-1),(4,-1))):
            for mag in (.02,.06):
                q=p[:]
                if k==1:q[1]-=mag*(p[1]-p[2])          # lower the top
                elif k==2:q[2]+=mag*(p[1]-p[2])        # raise the keel
                elif k==0:q[0]*=1-mag                 # narrow
                elif k==4:q[4]*=1-mag                 # thinner belt
                elif k==5:q[5]=max(0,p[5]-mag*2)       # narrower deck
                elif k==6:q[6]=max(0,p[6]-mag*2)       # narrower keel
                elif k==3:
                    for s in (-1,1):
                        qq=p[:];qq[3]=p[3]+s*mag*(p[1]-p[2]);
                        if (qq[3]-qq[2])/(qq[1]-qq[2])<.2 or (qq[3]-qq[2])/(qq[1]-qq[2])>.8:continue
                        g=bad(qq);lost=A0 and (octa(p).area-octa(qq).area)
                        if best is None or g<best[0]-1e-4:best=(g,qq)
                    continue
                h=q[1]-q[2]
                if h<20 or q[0]<20:continue
                if not (.2<=(q[3]-q[2])/h<=.8):q[3]=min(max(q[3],q[2]+.2*h),q[2]+.8*h)
                g=bad(q)
                if best is None or g<best[0]-1e-4 or (abs(g-best[0])<1e-4 and octa(q).area>octa(best[1]).area):best=(g,q)
        if best is None or best[0]>=bad(p)-1e-5:break
        p=best[1]
    rep.append(dict(t=t,x=round(x),outside_before=round(octa(from_st(r)).difference(O).area/octa(from_st(r)).area,3),outside_after=round(bad(p),3),area_kept=round(octa(p).area/A0,3),trench=trench))
    out.append(to_st(t,p));print(json.dumps(rep[-1]),flush=True)
json.dump(out,open(SP+'stations-fit.json','w'));json.dump(rep,open(SP+'stations-fit-report.json','w'),indent=1)
