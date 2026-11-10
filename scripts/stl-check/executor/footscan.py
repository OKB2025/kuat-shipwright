import json,sys,numpy as np
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/';sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from shapely.geometry import Point
from gaps import region,G,ids,meta
from column import column
byid={m['id']:m for m in meta}
for fid in [61,62,68,90]:
    m=byid[fid];a=m['aabb'];ym=(a[1]+a[4])/2;foot=region(G[ids==m['i']],ym);x0,z0,x1,z1=foot.bounds;n=0;tops=[];conn=0;thick=[]
    for x in np.arange(x0+2,x1,5):
        for z in np.arange(z0+2,z1,5):
            if not foot.contains(Point(x,z)):continue
            iv,_=column(x,z);n+=1
            q=[v for v in iv if v[0]<=ym<=v[1]] or [v for v in iv if abs((v[0]+v[1])/2-ym)<40]
            if q:thick.append(q[0][1]-q[0][0]);b=q[0][0]
            else:continue
            if b<a[1]-30:conn+=1   # solid continues well below the band: joined to material underneath
            tops.append(b)
    print(fid,'columns',n,'solid at band in',len(thick),'continues >30 m below the band in',conn,'| solid thickness median',round(float(np.median(thick)),1) if thick else None,'| lowest solid bottom',round(min(tops),1) if tops else None)
