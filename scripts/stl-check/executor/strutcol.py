import numpy as np,json
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/'
E=np.load(SP+'stl-exe-game.npy').astype(float);R=json.load(open(SP+'struts.json'))['executor']
lo=E.min(1);hi=E.max(1);rows=[]
for st,own in zip(R['struts'],R['owners']):
    a=st['aabb'];m=(lo[:,0]<=a[3])&(hi[:,0]>=a[0])&(lo[:,2]<=a[5])&(hi[:,2]>=a[2])&(hi[:,1]>=a[1]-50)&(lo[:,1]<=a[4]+50)
    S=E[m]
    # sample points on these triangles, keep those inside the footprint
    w=np.array([(i/6,j/6) for i in range(7) for j in range(7-i)]);P=(S[:,0][:,None]+(S[:,1]-S[:,0])[:,None]*w[None,:,0:1]+(S[:,2]-S[:,0])[:,None]*w[None,:,1:2]).reshape(-1,3)
    P=P[(P[:,0]>=a[0])&(P[:,0]<=a[3])&(P[:,2]>=a[2])&(P[:,2]<=a[5])]
    ys=np.sort(P[:,1]) if len(P) else np.array([])
    # STL surface heights in the column: report distinct layers (clusters 3 m apart)
    layers=[]
    for y in ys:
        if layers and y-layers[-1][1]<=3: layers[-1][1]=y
        else: layers.append([y,y])
    span=[a[1],a[4]];inside=[l for l in layers if l[1]>=a[1]+1 and l[0]<=a[4]-1]
    ob=[o['aabb'] for o in own]
    rows.append(dict(id=st['id'],label=st['label'],x=round((a[0]+a[3])/2),z=round((a[2]+a[5])/2),strut_y=[round(a[1],1),round(a[4],1)],w=round(a[3]-a[0],1),owner_y=[[round(b[1],1),round(b[4],1)] for b in ob][:2],stl_layers=[[round(l[0],1),round(l[1],1)] for l in layers][-8:],stl_surfaces_inside_strut=len(inside)))
for r in rows:print(json.dumps(r,ensure_ascii=False))
json.dump(rows,open(SP+'strutcol.json','w'),ensure_ascii=False,indent=1)
