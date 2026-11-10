# Targeted restoration: under each floating terrace (city) or above each hanging one (ventral), the bands between it
# and the structure the automatic strut reached are filled with the ORIGINAL material inside the terrace's footprint:
#   piece(band) = STL section(mid) ∩ footprint(floating part) − example structures (buffer 1 m)
# Nothing outside a floating terrace's footprint is added, so the flat wedge hull and the other terraces are unchanged.
import numpy as np,json,sys
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,MultiPolygon,LineString
from shapely.ops import unary_union,split
from gaps import region,game_region,E,G,ids,meta
from restore_lib import nohole,minwidth,simp
from shapely.geometry import Point,Polygon,box
eng=json.load(open(SP+'engines.json'))
O=json.load(open(SP+'owners.json'));byid={m['id']:m for m in meta}
out=[];report=[];seen=set()
for r in O:
    a=r['aabb'];city=r['above'] and r['above'][0]['form']=='outline';F=(r['above'] if city else r['below'])[0];fid=F['id']
    if (fid,city) in seen: continue
    seen.add((fid,city));fm=byid[fid];fy=(fm['aabb'][1]+fm['aabb'][4])/2
    foot=region(G[ids==fm['i']],fy)
    # The strut overlaps both surfaces by ov (bridgeLooseStructures: tol = clamp(L*0.001,0.5,3), ov = max(2 tol, min(4, w/2))).
    w=min(a[3]-a[0],a[5]-a[2]);ov=max(2*3,min(4,w/2))
    lo,hi=(a[1]+ov,F['aabb'][1]) if city else (F['aabb'][4],a[4]-ov)
    sp=Point((a[0]+a[3])/2,(a[2]+a[5])/2)
    b0=int(np.floor(lo/30))*30;made=[];bandlist=list(range(b0,int(np.ceil(hi/30))*30,30))
    # Upward too (2 bands): a terrace cut out of a taller model solid by the 30 m bands joins the rest of that
    # solid above it; that material is restored only where it meets an existing part in the same band.
    up=[F['aabb'][4]+k*30 for k in range(2)] if city else [F['aabb'][1]-30*(k+1) for k in range(2)]
    jobs=[]
    for y0 in bandlist:
        ya,yb=y0,y0+30
        # The slab next to the supporting surface starts (city) or ends (ventral) at that surface's height at the
        # strut, so a surface in the band's upper (lower) half does not leave a gap the mid-height section misses.
        if city and y0==bandlist[0] and lo>ya:ya=round(lo,1)
        if not city and y0==bandlist[-1] and hi<yb:yb=round(hi,1)
        jobs.append(('down',ya,yb))
    jobs+=[('up',int(v),int(v)+30) for v in up]
    # Lateral: within the terrace's own band, the model solid it belongs to may meet the rest at another height of the
    # band; that material (union of sections at three heights, within 200 m) is restored where it touches both.
    jobs.append(('side',F['aabb'][1],F['aabb'][4]))
    for kind_,ya,yb in jobs:
        ym=(ya+yb)/2;Gm=game_region(ym)
        if kind_=='side':
            S=unary_union([region(E,y) for y in (ya+3,ym,yb-3)]);piece=S.intersection(foot.buffer(200)).difference(Gm.buffer(1)).buffer(-.5).buffer(.5)
        else:
            S=region(E,ym);piece=S.intersection(foot).difference(Gm.buffer(1)).buffer(-.5).buffer(.5)
        # Engines are separate parts with their own machinery volume: restored slabs keep 30 m clear of their boxes.
        ex=[box(e['aabb'][0]-30,e['aabb'][2]-30,e['aabb'][3]+30,e['aabb'][5]+30) for e in eng if e['aabb'][1]-30<=yb and e['aabb'][4]+30>=ya]
        if ex:piece=piece.difference(unary_union(ex))
        for g in nohole(piece):
            if kind_=='up' and g.buffer(2).intersection(Gm).area<1:continue
            if kind_=='side':
                others=Gm.difference(foot.buffer(1))
                if g.distance(foot)>2 or g.buffer(2).intersection(others).area<1:continue
            if kind_=='down' and not g.buffer(1).contains(sp) and (g.area<200 or minwidth(g)<5):continue
            q=simp(g)
            if q is None:continue
            pts=list(q.exterior.coords)[:-1];made.append(dict(y=[ya,yb],m=0,kind='city' if city else 'ventral',owner=fid,strut=r['id'],how=kind_,area=round(q.area),o=[round(v,1) for p in pts for v in p]))
    # Downward pieces are used when, at the strut, they cover the whole gap; otherwise they would only add new loose
    # parts, so they are dropped and the upward/lateral pieces (which meet existing parts) are used instead.
    dn=[m for m in made if m['how']=='down' and Polygon(np.array(m['o']).reshape(-1,2)).buffer(1).contains(sp)]
    cover=sorted((m['y'][0],m['y'][1]) for m in dn);reach=lo
    for y0_,y1_ in cover:
        if y0_<=reach+1:reach=max(reach,y1_)
    connected=reach>=hi-1
    made=[m for m in made if m['how']=='down'] if connected else [m for m in made if m['how']!='down']
    out+=made;report.append(dict(strut=r['id'],owner=fid,kind='city' if city else 'ventral',span=[round(lo,1),round(hi,1)],footprint=round(foot.area),pieces=len(made),downConnects=bool(connected),bands=sorted(set((m['how'],m['y'][0],m['y'][1]) for m in made)),area=sum(m['area'] for m in made)))
    print(json.dumps(report[-1]),flush=True)
json.dump(out,open(SP+'restored2.json','w'));json.dump(report,open(SP+'restored2-report.json','w'),indent=1);print('pieces',len(out))
