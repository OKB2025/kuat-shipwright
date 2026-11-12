# Solid intervals of the assembled STL along vertical lines through each strut (crossing parity), compared with the strut and the parts above/below.
import numpy as np,json
import os;SP=os.environ['KS_EXE_WORK'].rstrip('/')+'/'
E=np.load(SP+'stl-exe-game.npy').astype(float);O=json.load(open(SP+'owners.json'))
lo=E[:,:,[0,2]].min(1);hi=E[:,:,[0,2]].max(1)
def column(x,z):
    m=(lo[:,0]<=x)&(hi[:,0]>=x)&(lo[:,1]<=z)&(hi[:,1]>=z);T=E[m]
    a,b,c=T[:,0],T[:,1],T[:,2];d=(b[:,2]-c[:,2])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,2]-c[:,2]);ok=np.abs(d)>1e-12
    l1=((b[:,2]-c[:,2])*(x-c[:,0])+(c[:,0]-b[:,0])*(z-c[:,2]))/np.where(ok,d,1);l2=((c[:,2]-a[:,2])*(x-c[:,0])+(a[:,0]-c[:,0])*(z-c[:,2]))/np.where(ok,d,1);l3=1-l1-l2
    h=ok&(l1>=0)&(l2>=0)&(l3>=0);y=np.sort(l1[h]*a[h,1]+l2[h]*b[h,1]+l3[h]*c[h,1])
    # merge duplicate crossings (shared edges) within 1 cm
    yy=[];
    for v in y:
        if yy and abs(v-yy[-1])<0.01:continue
        yy.append(v)
    iv=[[yy[i],yy[i+1]] for i in range(0,len(yy)-1,2)];return iv,len(yy)
rows=[]
for r in O:
    a=r['aabb'];cx=(a[0]+a[3])/2;cz=(a[2]+a[5])/2;res=[]
    for dx,dz in [(0,0),(-3,0),(3,0),(0,-3),(0,3)]:
        iv,n=column(cx+dx,cz+dz);res.append((iv,n))
    iv,n=res[0];y0,y1=a[1],a[4]
    solid=sum(max(0,min(q[1],y1)-max(q[0],y0)) for q in iv);frac=solid/(y1-y0)
    rows.append(dict(id=r['id'],x=round(cx),z=round(cz),strut=[round(y0,1),round(y1,1)],above=[(p['id'],p['form'],p['aabb'][1],p['aabb'][4]) for p in r['above']],below=[(p['id'],p['form'],p['aabb'][1],p['aabb'][4]) for p in r['below']],crossings=n,odd=n%2==1,stl_solid=[[round(q[0],1),round(q[1],1)] for q in iv if q[1]>y0-150 and q[0]<y1+150],solid_in_strut=round(frac,2),neighbours=[round(sum(max(0,min(q[1],y1)-max(q[0],y0)) for q in s[0])/(y1-y0),2) for s in res[1:]]))
for r in rows:print(json.dumps(r,ensure_ascii=False))
json.dump(rows,open(SP+'column.json','w'),ensure_ascii=False,indent=1)
