# Assemble the printed Executor pieces by matching their cut faces (translation only): for each joint the two
# faces are rasterised in their plane and the in-plane offset maximising the overlap (FFT cross-correlation) is used.
import sys,json,numpy as np
sys.path.insert(0,__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)),'..'));from meshio import load
U=sys.argv[1];out=sys.argv[2];R=0.1
def L(n):
    import glob;return load(glob.glob(U+'/*-'+n)[0])
P={'bow1':L('Bow_1.3mf'),'bow2':L('Bow_2.3mf'),'midB':L('Mid_ship_B.stl'),'bridge':L('Bridge_section.stl'),'st1':L('Stern_1_Update.stl'),'st2':L('Stern_2.3mf')}
AC=L('Mid_ship_A__C.stl');cx=AC[:,:,0].mean(1);P['wingL']=AC[cx<-498.8];P['wingR']=AC[cx>=-498.8]
def face(T,ax,sg,plane,tol=0.06):
    n=np.cross(T[:,1]-T[:,0],T[:,2]-T[:,0]);a=np.linalg.norm(n,axis=1);nn=n/np.maximum(1e-12,a[:,None])
    m=(nn[:,ax]*sg>0.999)&(np.abs(T[:,:,ax].mean(1)-plane)<tol);return T[m]
def raster(F,o,lo,shape):
    img=np.zeros(shape,bool)
    for t in F:
        p=(t[:,o]-lo)/R;mn=np.floor(p.min(0)).astype(int);mx=np.ceil(p.max(0)).astype(int)
        xs=np.arange(max(mn[0],0),min(mx[0]+1,shape[0]));ys=np.arange(max(mn[1],0),min(mx[1]+1,shape[1]))
        if not len(xs) or not len(ys):continue
        X,Y=np.meshgrid(xs+.5,ys+.5,indexing='ij');a,b,c=p
        d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(d)<1e-12:continue
        l1=((b[1]-c[1])*(X-c[0])+(c[0]-b[0])*(Y-c[1]))/d;l2=((c[1]-a[1])*(X-c[0])+(a[0]-c[0])*(Y-c[1]))/d
        img[np.ix_(xs,ys)]|=(l1>=-1e-6)&(l2>=-1e-6)&(1-l1-l2>=-1e-6)
    return img
def joint(A,axA,sgA,plA,B,axB,sgB,plB):
    """offset to add to B so that its face meets A's face (A fixed)."""
    FA=face(A,axA,sgA,plA);FB=face(B,axB,sgB,plB);o=[i for i in range(3) if i!=axA]
    la=FA.reshape(-1,3)[:,o].min(0);ha=FA.reshape(-1,3)[:,o].max(0);lb=FB.reshape(-1,3)[:,o].min(0);hb=FB.reshape(-1,3)[:,o].max(0)
    S=(np.ceil((np.maximum(ha-la,hb-lb))/R)).astype(int)+40;sh=tuple(2*S)
    IA=raster(FA,o,la-20*R,sh);IB=raster(FB,o,lb-20*R,sh)
    C=np.real(np.fft.ifft2(np.fft.fft2(IA)*np.conj(np.fft.fft2(IB))));k=np.unravel_index(np.argmax(C),C.shape)
    s=[k[i] if k[i]<sh[i]//2 else k[i]-sh[i] for i in range(2)]
    d=np.zeros(3);d[o]=(la-lb)+np.array(s)*R;d[axA]=plA-plB
    iou=C[k]/max(1,(IA.sum()+IB.sum()-C[k]))
    return d,float(iou),int(IA.sum()),int(IB.sum())
off={'midB':np.zeros(3)};rep={}
def go(name,ref,*a):
    d,iou,na,nb=joint(P[ref],*a[:3],P[name],*a[3:]);off[name]=off[ref]+d;rep[name]=dict(joint=ref,offset=d.round(3).tolist(),iou=round(iou,4),faceA=na,faceB=nb);print(name,'<-',ref,d.round(3),'IoU',round(iou,4))
go('wingL','midB',0,-1,-536.8,0,1,-508.8)
go('wingR','midB',0,1,-444.8,0,-1,-488.8)
go('bridge','midB',2,1,34.8,2,-1,0.0)
# The bow and stern joints meet the whole middle group (centre + both wings), so the reference is that group.
P['mid']=np.concatenate([P['midB'],P['wingL']+off['wingL'],P['wingR']+off['wingR']]);off['mid']=np.zeros(3)
for pl in (-48.0,-68.5):
    F=face(P['mid'],1,1,pl);print('mid +y face at',pl,'tris',len(F),'x',F.reshape(-1,3)[:,0].min().round(1) if len(F) else None,F.reshape(-1,3)[:,0].max().round(1) if len(F) else None)
go('st2','mid',1,1,-48.0,1,-1,-36.6)
go('st1','st2',1,1,36.4,1,-1,-38.1)
go('bow2','mid',1,-1,-183.1,1,1,123.6)
go('bow1','bow2',1,-1,-11.4,1,1,161.7)
allT=np.concatenate([P[k]+off[k] for k in P if k!='mid']);lo=allT.reshape(-1,3).min(0);hi=allT.reshape(-1,3).max(0)
print('assembled tris',len(allT),'lo',lo.round(2),'hi',hi.round(2),'size',(hi-lo).round(2))
np.save(out+'.npy',allT.astype(np.float32));json.dump(dict(offsets={k:v.tolist() for k,v in off.items()},joints=rep,lo=lo.tolist(),hi=hi.tolist()),open(out+'.json','w'),indent=1)
