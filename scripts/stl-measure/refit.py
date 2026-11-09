"""Re-measure a ship's data block (hull stations and loft rows) on a new STL.
Every value is measured: plane sections of the new mesh at each old station or
row position, clipped to a window around the old shape so neighbouring parts
are not picked up."""
import numpy as np, json
from load import load

class Mesh:
    def __init__(s,path,axes,length,flip=(1,1,1),by=0):
        t=load(path)  # (n,3,3)
        v=t.reshape(-1,3)
        X=v[:,axes[0]]*flip[0];Y=v[:,axes[1]]*flip[1];Z=v[:,axes[2]]*flip[2]
        # by: 0 scales the length (x) to `length`, 2 scales the beam (z) to it
        k=length/((X.max()-X.min()) if by==0 else (Z.max()-Z.min()))
        P=np.stack([(X-X.min())*k,(Y-Y.min())*k,(Z-(Z.max()+Z.min())/2)*k],1)
        s.k=k;s.T=P.reshape(-1,3,3);s.lo=P.min(0);s.hi=P.max(0)
        s.xmin=s.T[:,:,0].min(1);s.xmax=s.T[:,:,0].max(1)
    def section(s,x):
        m=(s.xmin<=x)&(s.xmax>=x);T=s.T[m];segs=[]
        for tri in T:
            pts=[]
            for a,b in ((0,1),(1,2),(2,0)):
                pa,pb=tri[a],tri[b];da,db=pa[0]-x,pb[0]-x
                if da==0 and db==0: pts+= [pa[[2,1]],pb[[2,1]]];continue
                if (da<=0<=db) or (db<=0<=da):
                    u=da/(da-db) if da!=db else 0;q=pa+(pb-pa)*u;pts.append(q[[2,1]])
            if len(pts)>=2: segs.append((pts[0],pts[1]))
        return segs
    def window(s,x,z0,z1,y0,y1,step=None):
        """Points of the section at x inside the box (z0..z1, y0..y1), including
        the box-clipped ends of every crossing segment."""
        out=[]
        for a,b in s.section(x):
            c=clip(a,b,z0,z1,y0,y1)
            if c: out+=c
        return np.array(out) if out else None

def clip(a,b,z0,z1,y0,y1):
    t0,t1=0.,1.;d=b-a
    for p,q in ((-d[0],a[0]-z0),(d[0],z1-a[0]),(-d[1],a[1]-y0),(d[1],y1-a[1])):
        if p==0:
            if q<0: return None
        else:
            r=q/p
            if p<0:
                if r>t1: return None
                t0=max(t0,r)
            else:
                if r<t0: return None
                t1=min(t1,r)
    return [a+d*t0,a+d*t1]

def refit_row(m,row,margin=.2,minm=3,mirror_side=False):
    x,z0,z1,y0,y1=row
    mz=max(minm,(z1-z0)*margin);my=max(minm,(y1-y0)*margin)
    w=m.window(x,z0-mz,z1+mz,y0-my,y1+my)
    if w is None or len(w)<2: return None
    return [round(x,2),round(float(w[:,0].min()),2),round(float(w[:,0].max()),2),round(float(w[:,1].min()),2),round(float(w[:,1].max()),2)]

def octagon(L,W,H,st):
    t,pw,ph,dy=st[:4];hw=W*pw/2;h=H*ph;yc=H*(.5+dy);return t*L,hw,yc-h/2,yc+h/2

def refit_station(m,L,W,H,st,margin=.25,minm=3):
    x,hw,bot,top=octagon(L,W,H,st);h=top-bot
    if hw<2 or h<2: return None
    w=m.window(min(max(x,.01),L-.01),-hw*(1+margin)-minm,hw*(1+margin)+minm,bot-h*margin-minm,top+h*margin+minm)
    if w is None or len(w)<3: return None
    z=np.abs(w[:,0]);y=w[:,1];HW=z.max();T=y.max();B=y.min();HH=max(.5,T-B)
    near=lambda sel:(z[sel].max()/HW) if sel.any() else .5
    deck=near(y>T-.08*HH);keel=near(y<B+.08*HH)
    wide=z>=.97*HW;chine=((y[wide].mean()-B)/HH) if wide.any() else .5;belt=((y[wide].max()-y[wide].min())/HH) if wide.any() else .02
    return dict(x=x,hw=HW,bot=B,top=T,deck=min(.98,deck),keel=min(.98,keel),belt=min(.98,max(.02,belt)),chine=min(.8,max(.2,chine)))
