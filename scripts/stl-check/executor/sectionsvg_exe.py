# Section image for the Executor: original (assembled printed parts, game frame) outline + example cells.
import sys,json,numpy as np
axis,pos,u0,u1,v0,v1,gj,out,title=sys.argv[1:10];pos,u0,u1,v0,v1=map(float,(pos,u0,u1,v0,v1))
E=np.load(__import__('os').environ['KS_EXE_WORK'].rstrip('/')+'/stl-exe-game.npy').astype(float)
ai=0 if axis=='x' else 2;ui=2 if axis=='x' else 0
lo=E[:,:,ai].min(1);hi=E[:,:,ai].max(1);T=E[(lo<=pos)&(hi>=pos)]
T=T[(T[:,:,ui].max(1)>=u0)&(T[:,:,ui].min(1)<=u1)&(T[:,:,1].max(1)>=v0)&(T[:,:,1].min(1)<=v1)];segs=[]
for t in T:
    d=t[:,ai]-pos;p=[]
    for i,j in ((0,1),(1,2),(2,0)):
        if (d[i]<0)!=(d[j]<0):u=d[i]/(d[i]-d[j]);q=t[i]+(t[j]-t[i])*u;p.append((q[ui],q[1]))
    if len(p)==2:segs.append(p)
G=json.load(open(gj));s=G['step'];W=900;sc=W/(u1-u0);H=int((v1-v0)*sc);tx=lambda u:(u-u0)*sc;ty=lambda y:H-(y-v0)*sc
o=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H+40}" viewBox="0 -40 {W} {H+40}"><rect x="0" y="-40" width="{W}" height="{H+40}" fill="#fff"/>',f'<text x="6" y="-22" font-size="14" font-family="sans-serif">{title}</text><text x="6" y="-6" font-size="11" font-family="sans-serif" fill="#555">灰=作例の構造物 / 緑=原本から補った構造物 / 赤=接続支柱 / 黒線=原本（組み立てた分割原本）の断面</text>']
for u,y,st,i,*rest in G['cells']:
    col="#e53935" if st==1 else ("#43a047" if st==2 else "#9aa4b1")
    o.append(f'<rect x="{tx(u-s/2):.1f}" y="{ty(y+s/2):.1f}" width="{s*sc+.5:.1f}" height="{s*sc+.5:.1f}" fill="{col}" fill-opacity="0.6"/>')
for (a,b),(c,d) in segs:o.append(f'<line x1="{tx(a):.1f}" y1="{ty(b):.1f}" x2="{tx(c):.1f}" y2="{ty(d):.1f}" stroke="#000" stroke-width="0.8"/>')
o.append('</svg>');open(out,'w').write('\n'.join(o));print(out,len(segs))
