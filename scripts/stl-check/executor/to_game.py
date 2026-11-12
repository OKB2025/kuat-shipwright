# Assembled printed model (mm, bow toward -y, z up) -> game frame (m): x from the stern (0) to the bow (19,000),
# y from the lowest point, z = -(x - centre). Scale = 19,000 / assembled length (32.67 m/mm, as Executor_Complete.stl).
import os,numpy as np
W=os.environ['KS_EXE_WORK'].rstrip('/')+'/';T=np.load(W+'assembled.npy').astype(float);v=T.reshape(-1,3);lo=v.min(0);hi=v.max(0);k=19000/(hi[1]-lo[1])
E=np.stack([(hi[1]-v[:,1])*k,(v[:,2]-lo[2])*k,-(v[:,0]-(lo[0]+hi[0])/2)*k],1);np.save(W+'stl-exe-game.npy',E.reshape(-1,3,3).astype(np.float32))
print('scale m/mm',round(k,4),'lo',E.min(0).round(1),'hi',E.max(0).round(1))
