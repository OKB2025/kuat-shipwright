# python3 -I sectionsvg.py TOOLS STL KEY STRUTS_JSON AXIS POS U0 U1 V0 V1 GAMEJSON OUT.svg TITLE
import sys,json,numpy as np
sys.path.insert(0,sys.argv[1]);from meshio import load
stl,key,sj,axis,pos,u0,u1,v0,v1,gj,out,title=sys.argv[2:14];pos,u0,u1,v0,v1=map(float,(pos,u0,u1,v0,v1))
R=json.load(open(sj))[key];bb=R['bbox'];L=bb[3]-bb[0];fx=float(sys.argv[14]) if len(sys.argv)>14 else 1
v=load(stl).reshape(-1,3);X=v[:,1]*fx;Y=v[:,2];Z=v[:,0];k=L/(X.max()-X.min())
T=np.stack([(X-X.min())*k+bb[0],(Y-Y.min())*k+bb[1],(Z-(Z.max()+Z.min())/2)*k],1).reshape(-1,3,3)
ai=0 if axis=='x' else 2; ui=2 if axis=='x' else 0
segs=[]
lo=T[:,:,ai].min(1);hi=T[:,:,ai].max(1);
for tri in T[(lo<=pos)&(hi>=pos)]:
    pts=[]
    for a,b in ((0,1),(1,2),(2,0)):
        da,db=tri[a][ai]-pos,tri[b][ai]-pos
        if (da<=0<=db) or (db<=0<=da):
            u=da/(da-db) if da!=db else 0;q=tri[a]+(tri[b]-tri[a])*u;pts.append((q[ui],q[1]))
    if len(pts)>=2:segs.append(pts[:2])
G=json.load(open(gj));s=G['step'];W=900;sc=W/(u1-u0);H=int((v1-v0)*sc)
tx=lambda u:(u-u0)*sc;ty=lambda y:H-(y-v0)*sc
o=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H+40}" viewBox="0 -40 {W} {H+40}"><rect x="0" y="-40" width="{W}" height="{H+40}" fill="#fff"/>',f'<text x="6" y="-22" font-size="14" font-family="sans-serif">{title}</text><text x="6" y="-6" font-size="11" font-family="sans-serif" fill="#555">灰=作例の構造物 / 黄=船体 / 赤=接続支柱 / 黒線=原本STLの断面 / 目盛10m</text>']
for u,y in G.get('hull',[]):o.append(f'<rect x="{tx(u-s/2):.1f}" y="{ty(y+s/2):.1f}" width="{s*sc+.5:.1f}" height="{s*sc+.5:.1f}" fill="#f3d27a"/>')
for u,y,st,i in G['cells']:o.append(f'<rect x="{tx(u-s/2):.1f}" y="{ty(y+s/2):.1f}" width="{s*sc+.5:.1f}" height="{s*sc+.5:.1f}" fill="{"#e53935" if st else "#9aa4b1"}" fill-opacity="{0.85 if st else 0.55}"/>')
for (a,b),(c,d) in segs:o.append(f'<line x1="{tx(a):.1f}" y1="{ty(b):.1f}" x2="{tx(c):.1f}" y2="{ty(d):.1f}" stroke="#000" stroke-width="1"/>')
g=10
for i in range(int(u0//g)*g,int(u1)+1,g):o.append(f'<line x1="{tx(i):.1f}" y1="{H-4}" x2="{tx(i):.1f}" y2="{H}" stroke="#333"/>')
o.append('</svg>');open(out,'w').write('\n'.join(o));print(out,len(segs),'segs',len(G['cells']),'cells')
