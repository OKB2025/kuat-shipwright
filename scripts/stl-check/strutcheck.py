import sys,json,numpy as np
sys.path.insert(0,sys.argv[1]);from meshio import load
stl,key,js=sys.argv[2],sys.argv[3],sys.argv[4]
R=json.load(open(js))[key];bb=R['bbox'];L=bb[3]-bb[0]
t=load(stl);v=t.reshape(-1,3)
def frame(fx,fz):
    X=v[:,1]*fx;Y=v[:,2];Z=v[:,0]*fz;k=L/(X.max()-X.min())
    P=np.stack([(X-X.min())*k+bb[0],(Y-Y.min())*k+bb[1],(Z-(Z.max()+Z.min())/2)*k],1);return P.reshape(-1,3,3),k
def colocc(T,x0,x1,z0,z1):
    lo=T.min(1);hi=T.max(1);m=(lo[:,0]<=x1)&(hi[:,0]>=x0)&(lo[:,2]<=z1)&(hi[:,2]>=z0);return T[m]
best=None
for fx in (1,-1):
  T,k=frame(fx,1);score=0
  for st in R['struts']:
    a=st['aabb']
    for o in R['owners'][R['struts'].index(st)]:
      b=o['aabb'];S=colocc(T,b[0],b[3],b[2],b[5]);score+=((S[:,:,1].max(1)>=b[1])&(S[:,:,1].min(1)<=b[4])).sum()
  if best is None or score>best[0]:best=(score,fx,T,k)
score,fx,T,k=best;print(key,'flip x',fx,'scale m/unit',round(k,4),'owner-overlap tris',score)
for i,st in enumerate(R['struts']):
  a=st['aabb'];S=colocc(T,a[0],a[3],a[2],a[5])
  ys=sorted([(float(s[:,1].min()),float(s[:,1].max())) for s in S])
  # merge y intervals of triangles in the strut footprint
  iv=[]
  for y0,y1 in ys:
    if iv and y0<=iv[-1][1]+0.05*k: iv[-1][1]=max(iv[-1][1],y1)
    else: iv.append([y0,y1])
  inside=[[round(max(y0,a[1]),1),round(min(y1,a[4]),1)] for y0,y1 in iv if y1>=a[1] and y0<=a[4]]
  cover=sum(b-a_ for a_,b in inside);span=a[4]-a[1]
  own=[o['aabb'] for o in R['owners'][i]]
  print(f" #{st['id']} {st['label']} x{a[0]:.0f}-{a[3]:.0f} z{a[2]:.0f}-{a[5]:.0f} y{a[1]:.1f}-{a[4]:.1f} (h {span:.1f} m) | STL tris in footprint {len(S)}; STL y-cover inside strut span {cover:.1f} m = {100*cover/span:.0f}% {inside[:6]} | owner y {[ [round(b[1],1),round(b[4],1)] for b in own][:3]}")
