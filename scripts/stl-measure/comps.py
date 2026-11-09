import numpy as np,sys
from refit import Mesh
def components(T):
    v=np.round(T.reshape(-1,3),4);uv,inv=np.unique(v,axis=0,return_inverse=True);f=inv.reshape(-1,3)
    parent=np.arange(len(uv))
    def find(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    for a,b,c in f:
        ra,rb,rc=find(a),find(b),find(c);parent[rb]=ra;parent[rc]=ra
    lab=np.array([find(r[0]) for r in f]);u,l=np.unique(lab,return_inverse=True);return l
if __name__=='__main__':
    stl,axes,L=sys.argv[1],tuple(map(int,sys.argv[2].split(','))),float(sys.argv[3])
    m=Mesh(stl,axes,L);lab=components(m.T);n=lab.max()+1
    sizes=[]
    for i in range(n):
        T=m.T[lab==i];P=T.reshape(-1,3);sizes.append((np.prod(P.max(0)-P.min(0)+1e-3),len(T),P.min(0),P.max(0)))
    sizes.sort(key=lambda s:-s[0])
    print('components',n)
    for s in sizes[:25]: print(round(s[0]),s[1],s[2].round(1),s[3].round(1))
    vs=np.array([s[0] for s in sizes]);print('vol>1e4',(vs>1e4).sum(),'>1e5',(vs>1e5).sum(),'>1e6',(vs>1e6).sum())
