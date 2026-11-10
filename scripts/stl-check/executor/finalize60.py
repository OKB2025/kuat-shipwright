# Close the gaps that automatic struts bridge: for each strut, the slab it holds is extended to the surface the strut
# reached, only where the original is solid over that gap (>= 60% of the strut's footprint samples). Struts under
# plates the original itself leaves floating are kept (the user's decision).
import json,sys,numpy as np
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Polygon,Point
from column import column
B=json.load(open(sys.argv[1]));R=json.load(open(sys.argv[2]));log=[]
for s in R['struts']:
    a=s['aabb'];x=(a[0]+a[3])/2;z=(a[2]+a[5])/2;w=min(a[3]-a[0],a[5]-a[2]);ov=max(6,min(4,w/2));lo=a[1]+ov;hi=a[4]-ov
    pts=[(x+dx,z+dz) for dx in (-w/3,0,w/3) for dz in (-w/3,0,w/3)]
    share=sum(1 for px,pz in pts if any(u<=(lo+hi)/2<=v and u<=lo+1 and v>=hi-1 for u,v in column(px,pz)[0]))/len(pts)
    done=None
    for i,b in enumerate(B):
        P=Polygon(np.array(b['o']).reshape(-1,2));inside=P.contains(Point(x,z)) or (b['m'] and P.contains(Point(x,-z)))
        if not inside:continue
        if abs(b['y'][0]-hi)<2.5:done=(i,'down');break      # slab above the strut (city)
        if abs(b['y'][1]-lo)<2.5:done=(i,'up');break        # slab below the strut (hanging)
    if done and share>=0.6:
        i,how=done
        if how=='down':B[i]['y'][0]=round(lo,1)
        else:B[i]['y'][1]=round(hi,1)
    log.append(dict(strut=s['id'],x=round(x),z=round(z),gap=[round(lo,1),round(hi,1)],original_solid=round(share,2),slab=done,extended=bool(done and share>=0.6)))
json.dump(B,open(sys.argv[1].replace('.json','-final.json'),'w'));json.dump(log,open(SP+'finalize-log.json','w'),indent=1)
for l in log:print(l)
