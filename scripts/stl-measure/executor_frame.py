import numpy as np,sys,matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
from matplotlib.collections import PolyCollection
from refit import Mesh
m=Mesh(sys.argv[1],(1,2,0),19000,(-1,1,-1));T=m.T
np.save(sys.argv[2]+'.npy',T.astype(np.float32))
fig,ax=plt.subplots(3,1,figsize=(18,18))
sel=T[:,:,0].max(1)<8000;U=T[sel]
for a,(i,j,name) in zip(ax[:2],[(0,1,'side x-y (x<8000)'),(0,2,'top x-z (x<8000)')]):
    a.add_collection(PolyCollection(U[:,:,[i,j]],facecolor='0.4',edgecolor='none',alpha=.08));a.autoscale();a.set_aspect('equal');a.set_title(name);a.grid(True,alpha=.3)
# stern face: triangles facing aft (normal -x) in x<8000
n=np.cross(U[:,1]-U[:,0],U[:,2]-U[:,0]);n/=np.linalg.norm(n,axis=1)[:,None]+1e-12
aft=U[n[:,0]<-.7]
c=ax[2].add_collection(PolyCollection(aft[:,:,[2,1]],array=aft[:,:,0].mean(1),cmap='viridis',edgecolor='none',alpha=.6));ax[2].autoscale();ax[2].set_aspect('equal');ax[2].set_title('aft-facing faces z-y, colour = x');plt.colorbar(c,ax=ax[2]);ax[2].grid(True,alpha=.3)
plt.tight_layout();plt.savefig(sys.argv[2],dpi=60)
