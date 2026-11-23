import numpy as np, json,sys,ctypes as ct,base64,subprocess as sp,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
d=Path(__file__).parent;k=sys.argv[1];p=d/k;T=json.loads((p/'trace.json').read_text());F=T['frames'];ids=T['ids'];teams=np.array(T['teams']);W,H=960,540;fps=16;end=T['result']['t'];focal=620;V=ct.c_void_p;I=ct.c_int;mesh=ct.CDLL(str(d/'raster.so')).mesh;mesh.argtypes=[V,V,I,I,V,V,I,V,V,ct.c_float];ptr=lambda a:a.ctypes.data
def norm(x):return x/max(1e-8,np.linalg.norm(x))
models=[]
for key in (T['a'],T['b']):
 o=json.loads((d/'models'/(key+'.json')).read_text());get=lambda key,typ:np.frombuffer(base64.b64decode(o[key]),typ)
 pos=get('pos','f4');n=get('nor','i1').reshape(-1,3)/127;col=get('col','u1').reshape(-1,4);sh=.50+.50*np.maximum(0,n@norm(np.array([.2,.83,-.4])));co=np.ascontiguousarray(np.clip(col[:,:3]*sh[:,None]+col[:,3:4]*.18,0,255).astype('u1'));models.append((pos,co,o['len']))
# A state is recorded at the end of each tick.
def at(q):return np.array([[*v[:6],*(v[6:12] if len(v)>=12 else [math.cos(v[3]),0,math.sin(v[3]),0,1,0])] for v in q['u']])
states=np.array([at(q) for q in F]);tracks={}
for i,fr in enumerate(F):
 for m in fr['m']:tracks.setdefault(m['id'],[]).append((i,np.array(m['p']),ids.index(m['b'])))
stars=np.random.default_rng(4).normal(size=(1500,3));stars/=np.linalg.norm(stars,axis=1)[:,None];cols=['#69d9ff','#ff907d'];opp=k.replace('tie_','TIE/').upper();font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';ff=lambda n:ImageFont.truetype(font,n);small,body,title=map(ff,(12,15,21))
out=p/('X-Wing_vs_'+opp.replace('/','-')+'_12v12.mp4');pipe=sp.Popen(['ffmpeg','-loglevel','error','-y','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(fps),'-i','-','-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',str(out)],stdin=sp.PIPE)
sub=None;cut=0;dir0=None;lastfocus=None
for fr in range(math.ceil(end*fps)+fps):
 t=min(end,(fr+1)/fps);ix=max(0,min(len(F)-1,t/.25-1));i=int(ix);frac=ix-i;s=states[i]*(1-frac)+states[min(i+1,len(F)-1)]*frac;pos=s[:,:3];live=np.where(states[i,:,4]==0)[0];en=lambda n:live[teams[live]!=teams[n]]
 if sub is None or (len(live) and (sub not in live or t>=cut)):
  side=int(t//6)%2;pool=[n for n in live if teams[n]==side and len(en(n))];pool=pool or list(live);sub=min(pool,key=lambda n:np.linalg.norm(pos[en(n)]-pos[n],axis=1).min() if len(en(n)) else 0);cut=t+6;dir0=None
 fo=norm(s[sub,6:9]);up=norm(s[sub,9:12]);foe=en(sub);q=pos[foe[np.argmin(np.linalg.norm(pos[foe]-pos[sub],axis=1))]] if len(foe) else pos[sub]+fo*20
 aim=norm(.55*norm(q-pos[sub])+.45*fo);dir0=aim if dir0 is None else norm(.85*dir0+.15*aim);vertical=norm(.25*up+np.array([0,.75,0]));right=norm(np.cross(dir0,vertical));size=models[teams[sub]][2];eye=pos[sub]+size*(-2.3*dir0+.54*vertical+.5*right);front=norm(pos[sub]+dir0*size*3-eye);right=norm(np.cross(front,vertical));cam=np.array([right,norm(np.cross(right,front)),front]);rgb=np.empty((H,W,3),'u1');rgb[:]=[5,9,18];dep=np.zeros((H,W),'f4')
 st=stars@cam.T;st=st[st[:,2]>.2];px=(W/2+focal*st[:,0]/st[:,2]).astype(int);py=(H/2-focal*st[:,1]/st[:,2]).astype(int);ok=(px>=0)&(px<W)&(py>=0)&(py<H);rgb[py[ok],px[ok]]=[136,152,172]
 def proj(v):
  a=cam@(v-eye)
  if a[2]<1:return None
  x=W*.5+focal*a[0]/a[2];y=H*.5-focal*a[1]/a[2];return (x,y) if -100<x<W+100 and -100<y<H+100 else None
 for n in live:
  org=np.ascontiguousarray(cam@(pos[n]-eye),dtype='f4');z=org[2];mv,mc,sz=models[teams[n]]
  if z<=1 or z>1650 or abs(org[0])>z or abs(org[1])>.6*z:continue
  f=norm(s[n,6:9]);r=norm(np.cross(f,s[n,9:12]));rot=np.ascontiguousarray(cam@np.array([f,norm(np.cross(r,f)),r]).T,dtype='f4');mesh(ptr(rgb),ptr(dep),W,H,ptr(mv),ptr(mc),len(mv)//3,ptr(rot),ptr(org),focal)
 im=Image.fromarray(rgb);dr=ImageDraw.Draw(im)
 for n in live:
  xy=proj(pos[n])
  if not xy or n==sub:continue
  x,y=xy;dr.rectangle((x-3,y-3,x+3,y+3),outline=cols[teams[n]])
 for a,b in F[i]['f']:
  a,b=ids.index(a),ids.index(b);start=pos[a]+frac*(pos[b]-pos[a]);xy=proj(start);xy2=proj(start+norm(pos[b]-pos[a])*24)
  if xy and xy2:dr.line([xy,xy2],fill=['#ff594c','#64ff92'][teams[a]],width=2)
 active=[];launched=0
 for mid,tr in tracks.items():
  j0=tr[0][0];delta=ix-j0
  if delta<0:continue
  launched+=1
  if delta>=len(tr):continue
  j=int(delta);v=tr[j][1]+(delta-j)*(tr[min(j+1,len(tr)-1)][1]-tr[j][1]);hist=[e[1] for e in tr[max(0,j-10):j+1]]+[v];active.append((mid,hist,tr[j][2]));xy=proj(v)
  if xy:dr.ellipse((xy[0]-4,xy[1]-4,xy[0]+4,xy[1]+4),fill='#ffdb4e')
  ps=[proj(h) for h in hist]
  for aa,bb in zip(ps,ps[1:]):
   if aa and bb:dr.line([aa,bb],fill='#ffc146',width=3)
 dr.rounded_rectangle((14,13,282,85),8,fill='#0d1826');dr.text((26,19),'X-WING   /   '+opp,font=title,fill='white');dr.text((26,48),'ALIVE   '+str(sum(teams[live]==0))+' / 12',font=body,fill=cols[0]);dr.text((150,48),str(sum(teams[live]==1))+' / 12',font=body,fill=cols[1])
 dr.rounded_rectangle((640,13,946,192),8,fill='#101b29',outline='#4d6070');dr.text((652,21),'MISSILE TRACK',font=body,fill='#ffdb66');dr.text((652,163),f'{len(active)} active    /    {launched} launched',font=small,fill='#ccdae6')
 if active:
  mid,hist,n=next((v for v in active if v[0]==lastfocus),max(active,key=lambda v:len(v[1])));lastfocus=mid;arr=np.array(hist+[pos[n]]);z=arr@np.array([[.8,-.25],[0,-.87],[-.6,-.34]]);z=(z-(z.max(0)+z.min(0))/2)*min(245/max(50,np.ptp(z[:,0])),73/max(50,np.ptp(z[:,1])))+[795,105];dr.line([tuple(v) for v in z[:-1]],fill='#ffcd53',width=3);x,y=z[-2];dr.ellipse((x-4,y-4,x+4,y+4),fill='#ffed94');x,y=z[-1];dr.rectangle((x-5,y-5,x+5,y+5),outline='white',width=2);dr.text((652,43),f'{mid.upper()}  >  {ids[n].upper()}     {np.linalg.norm(hist[-1]-pos[n]):.0f} m',font=small,fill='white')
 else:dr.text((652,96),'No missile in flight',font=body,fill='#8f9eae')
 dr.rectangle((0,H-34,W,H),fill='#0a1420');dr.text((16,H-26),f'T + {t:05.1f} s    /    CAM {ids[sub].upper()}    /    12 v 12',font=body,fill='white');dr.text((W-325,H-26),'3D FLIGHT REPLAY    /    SEED 24    /    1x',font=small,fill='#cad5df')
 if fr==fps*5:im.save(p/'preview.jpg')
 pipe.stdin.write(im.tobytes())
pipe.stdin.close();assert pipe.wait()==0;print(out)
