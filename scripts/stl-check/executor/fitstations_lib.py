import json,os
from shapely.geometry import Polygon
_SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/'
_info=json.load(open(_SP+'hull0.json'));W,H,L=_info['W'],_info['H'],_info['L']
def octa(p):
    hw,top,bot,edge,bh,deck,keel=p;h=top-bot
    return Polygon([(-hw*keel,bot),(hw*keel,bot),(hw,max(bot,edge-bh/2)),(hw,min(top,edge+bh/2)),(hw*deck,top),(-hw*deck,top),(-hw,min(top,edge+bh/2)),(-hw,max(bot,edge-bh/2))]).buffer(0)
def from_st(r):
    t,pw,ph,dy,dw,kw,bw,cw=r;hw=W*pw/2;h=H*ph;yc=H*(.5+dy);top=yc+h/2;bot=yc-h/2;edge=bot+h*min(.8,max(.2,cw));return [hw,top,bot,edge,h*bw,min(.98,dw),min(.98,kw)]
def to_st(t,p):
    hw,top,bot,edge,bh,deck,keel=p;h=top-bot;return [round(t,6),round(2*hw/W,6),round(h/H,6),round(((top+bot)/2)/H-.5,6),round(deck,4),round(keel,4),round(min(.98,max(.02,bh/h)),4),round(min(.8,max(.2,(edge-bot)/h)),4)]
