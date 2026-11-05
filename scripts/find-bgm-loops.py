#!/usr/bin/env python3
"""Seamless loop points for the BGM tracks (numpy only). usage: find-bgm-loops.py <out.json> <track.mp3>...
Candidates only: the lengths used in pack-bgm.py were then checked on the onset envelope (12-14 s windows) and snapped to
whole bars where the tempo is clear (e.g. 144.0 s = 48 bars at 80 bpm, 140.8 s = 44 bars at 75 bpm).
The tracks end with a 2-6 s fade-out, so the loop is internal: loopEnd L lies just before the fade, loopStart S earlier,
chosen so that the music around S (3 s before, 6 s after) matches the music around L. Search: self-similarity matrix of
0.1 s log-band spectra + onset envelope, windowed along diagonals; then refined at 23 ms frames and finally aligned to
~3 ms on the onset envelope so beats line up through the crossfade."""
import json,os,subprocess,sys,numpy as np
SR=22050
def decode(p):
    b=subprocess.run(['ffmpeg','-v','error','-i',p,'-ac','1','-ar',str(SR),'-f','f32le','-'],capture_output=True,check=True).stdout
    return np.frombuffer(b,dtype=np.float32).copy()
def bands(x,hop,nf=2048,nb=40):
    n=1+(len(x)-nf)//hop;idx=np.arange(nf)[None,:]+hop*np.arange(n)[:,None]
    F=np.abs(np.fft.rfft(x[idx]*np.hanning(nf).astype(np.float32),axis=1))**2;fr=np.fft.rfftfreq(nf,1/SR)
    e=np.geomspace(50,9000,nb+1);B=np.stack([F[:,(fr>=a)&(fr<b)].sum(1) for a,b in zip(e[:-1],e[1:])],1);return np.log(B+1e-8)
def unit(L):
    L=L-L.mean(1,keepdims=True);return L/(np.linalg.norm(L,axis=1,keepdims=True)+1e-9)
def onset(L):
    d=np.maximum(np.diff(L,axis=0),0).sum(1);d=np.concatenate([[0],d]);d-=np.convolve(d,np.ones(15)/15,'same');return np.maximum(d,0)
def winsum(M,i,j,a,b):  # sum of M[i+k,j+k] for k in [-a,b)
    return sum(M[i+k,j+k] for k in range(-a,b))
res={}
for p in sorted(sys.argv[2:]):
    tid=os.path.splitext(os.path.basename(p))[0];x=decode(p);dur=len(x)/SR
    hop=2205;Lb=bands(x,hop);n=len(Lb);t=np.arange(n)*hop/SR   # 0.1 s frames
    lvl=10*np.log10(np.exp(Lb).sum(1)+1e-12);sm=np.convolve(lvl,np.ones(10)/10,'same')
    lead=float(t[np.argmax(lvl>lvl.max()-35)])
    ref=np.median(sm[(t>dur-40)&(t<dur-10)]);fadeStart=float(t[np.where(sm>ref-4)[0][-1]])-.5
    U=unit(Lb);on=onset(Lb);on=(on-on.mean())/(on.std()+1e-9)
    M=U@U.T+.25*np.minimum(np.outer(on,on),4)/4      # spectral + rhythmic similarity
    A,Bw=30,60                                         # 3 s before, 6 s after
    lo_L=int((fadeStart-14)/0.1);hi_L=int(fadeStart/0.1)-Bw//2
    best=(-9,0,0)
    for j in range(max(lo_L,A),min(hi_L,n-Bw)):
        for i in range(int((lead+1.5)/0.1)+A,j-int(45/0.1)):   # loop at least 45 s long
            pass
        # vectorised over i: diagonal window sums
        I=np.arange(int((lead+1.5)/0.1)+A,j-int(45/0.1))
        if not len(I):continue
        s=np.zeros(len(I))
        for k in range(-A,Bw):s+=M[I+k,j+k]
        s/= (A+Bw);s+=.02*(j-I)/n                      # slight preference for a longer loop
        k=int(np.argmax(s))
        if s[k]>best[0]:best=(float(s[k]),int(I[k]),j)
    sc,i0,j0=best
    # refine at 512-sample frames (23 ms) within +-0.15 s of each point
    h2=512;F=unit(bands(x,h2));o2=onset(bands(x,h2));r=int(.15*SR/h2)+1;ci,cj=int(i0*hop/h2),int(j0*hop/h2)
    a2,b2=int(3*SR/h2),int(6*SR/h2);bb=(-9,ci,cj)
    for di in range(-r,r+1):
        for dj in range(-r,r+1):
            i,j=ci+di,cj+dj;v=np.einsum('ij,ij->',F[i-a2:i+b2],F[j-a2:j+b2])/(a2+b2)
            if v>bb[0]:bb=(v,i,j)
    _,ci,cj=bb
    # beat alignment: onset envelope at 64-sample hop, shift L by +-40 ms
    h3=64;seg=lambda c,a,b: x[c*h2-a:c*h2+b]
    def env(y):
        f=np.abs(y);n3=len(f)//h3;e=f[:n3*h3].reshape(n3,h3).mean(1);d=np.maximum(np.diff(np.log(e+1e-6)),0);return d-d.mean()
    eS=env(seg(ci,SR,4*SR));best3=(-9,0)
    for d in range(-int(.04*SR),int(.04*SR)+1,16):
        eL=env(x[cj*h2-SR+d:cj*h2+4*SR+d]);v=float(np.dot(eS,eL)/(np.linalg.norm(eS)*np.linalg.norm(eL)+1e-9))
        if v>best3[0]:best3=(v,d)
    Sx=ci*h2/SR;Lx=(cj*h2+best3[1])/SR
    res[tid]=dict(lead=round(lead,2),loopStart=round(Sx,4),loopEnd=round(Lx,4),fadeStart=round(fadeStart,2),dur=round(dur,2),
                  coarse=round(sc,3),fine=round(float(bb[0]),3),beat=round(best3[0],3),loopLen=round(Lx-Sx,2))
    print(tid,res[tid],flush=True)
json.dump(res,open(sys.argv[1],'w'),indent=1)
