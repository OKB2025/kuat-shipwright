// Records a 3D replay of an AI dogfight as a video: the craft's own models (built by js/gfx.js fleetGeometry from the example
// designs) flown along the positions and attitudes the simulation recorded.
// usage: KS_TRACE=<trace.json> node scripts/sim-dogfight.cjs <a> <b> 1 <nb> <na>
//        node scripts/record-dogfight-3d.cjs <trace.json> <outdir> [fps=24] [speed=1]
// (outdir is required: nothing is written to docs/. Needs ffmpeg on the PATH.)
// What it is: a replay drawn by this script's own small WebGL view, NOT the game's renderer or its trial screen. The flight (place,
// heading, roll and pitch every 0.25 s, who fired on whom, who was lost) is the simulation's; between records it is interpolated.
// The camera, the trails, the bolts drawn from gun to target, the bursts and the markers on distant craft are this script's.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),trace=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8')),out=path.resolve(process.argv[3]),FPS=+(process.argv[4]||24),SPEED=+(process.argv[5]||1);
if(!process.argv[3])throw new Error('usage: record-dogfight-3d.cjs <trace.json> <outdir> [fps] [speed]');fs.mkdirSync(path.join(out,'frames'),{recursive:true});
// The models: every mesh of the craft's fleet geometry, as plain triangles about the model's centre (x forward, y up, z starboard).
const cx=vm.createContext({console:{log(){},warn(){},error(){}},self:{},window:{},document:{createElement(){return {getContext(){return null},style:{}};}},navigator:{userAgent:''},performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const G=vm.runInContext('Gfx',cx),C=vm.runInContext('Core',cx);
function model(key){const g=G.fleetGeometry(C.buildDesign(key)),c=g.center,pos=[],nor=[],col=[];
 for(const m of Object.values(g.meshes)){const q=m.geo;if(!(q.n>0)||!q.pos||!q.nor)continue;const n=q.ni>0?q.ni:q.n%3===0?q.n:0,emi=m.emi||0;
  for(let i=0;i<n;i++){const v=q.ni>0?q.idx[i]:i;pos.push(q.pos[v*3]-c[0],q.pos[v*3+1]-c[1],q.pos[v*3+2]-c[2]);nor.push(q.nor[v*3],q.nor[v*3+1],q.nor[v*3+2]);col.push(q.col?q.col[v*4]:160,q.col?q.col[v*4+1]:160,q.col?q.col[v*4+2]:160,Math.round(255*Math.min(1,emi)));}}
 const b64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');return {key,len:g.length,verts:pos.length/3,pos:b64(new Float32Array(pos)),nor:b64(new Int8Array(nor)),col:b64(new Uint8Array(col))};}
const models=[model(trace.a),model(trace.b)];console.error('models:',models.map(m=>`${m.key} ${m.verts/3} triangles, ${m.len.toFixed(1)} m`).join('; '));
const html=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#000;overflow:hidden}canvas{position:absolute;left:0;top:0}</style><canvas id="gl" width="1280" height="720"></canvas><canvas id="hud" width="1280" height="720"></canvas><script>
const T=${JSON.stringify(trace)},M=${JSON.stringify(models)},W=1280,H=720,gl=document.getElementById('gl').getContext('webgl',{antialias:true,preserveDrawingBuffer:true}),hud=document.getElementById('hud').getContext('2d');
if(!gl)document.title='NOGL';
const bin=(s,A)=>{const b=atob(s),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new A(u.buffer);};
const sh=(t,s)=>{const o=gl.createShader(t);gl.shaderSource(o,s);gl.compileShader(o);if(!gl.getShaderParameter(o,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(o));return o;},prog=(v,f)=>{const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,v));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,f));gl.linkProgram(p);return p;};
const P=prog('attribute vec3 p;attribute vec3 n;attribute vec4 c;uniform mat4 vp;uniform vec3 o,f,u,r;uniform float s;varying vec3 vc;varying float ve;varying vec3 vn;void main(){vec3 q=p*s;vec3 w=o+f*q.x+u*q.y+r*q.z;vn=normalize(f*n.x+u*n.y+r*n.z);vc=c.rgb;ve=c.a;gl_Position=vp*vec4(w,1.);}',
 'precision mediump float;varying vec3 vc;varying float ve;varying vec3 vn;uniform vec3 sun;uniform vec3 tint;void main(){float d=max(dot(normalize(vn),sun),0.);float b=max(dot(normalize(vn),-sun),0.)*.12;vec3 k=vc*tint*(.2+.8*d+b)+vc*ve*.3;gl_FragColor=vec4(k,1.);}');
const L=prog('attribute vec3 p;attribute vec4 c;uniform mat4 vp;varying vec4 vc;void main(){vc=c;gl_Position=vp*vec4(p,1.);gl_PointSize=c.a>1.5?2.:1.5;}','precision mediump float;varying vec4 vc;void main(){gl_FragColor=vec4(vc.rgb,min(1.,vc.a));}');
const buf=(a)=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a,gl.STATIC_DRAW);return b;};
const MB=M.map(m=>({n:m.verts,pos:buf(bin(m.pos,Float32Array)),nor:buf(bin(m.nor,Int8Array)),col:buf(bin(m.col,Uint8Array)),len:m.len}));
// vectors
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(a[0],a[1],a[2]),norm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l,a[2]/l];},lerp=(a,b,k)=>[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k,a[2]+(b[2]-a[2])*k];
function persp(fov,asp,n,f){const t=1/Math.tan(fov/2);return [t/asp,0,0,0,0,t,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0];}
function look(e,c,up){const z=norm(sub(e,c)),x=norm(cross(up,z)),y=cross(z,x);return [x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,e),-dot(y,e),-dot(z,e),1];}
function mm(a,b){const o=new Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s;}return o;}
// the state of craft n at time t (interpolated between the simulation's records)
const N=T.ids.length,END=(T.frames.length-1)*T.dt;
function at(n,t){const x=Math.max(0,Math.min(END,t))/T.dt,i=Math.min(T.frames.length-2,Math.floor(x)),k=x-i,a=T.frames[i].u[n],b=T.frames[i+1].u[n];const fa=a.length>=12?[a[6],a[7],a[8]]:[Math.cos(a[3]),0,Math.sin(a[3])],fb=b.length>=12?[b[6],b[7],b[8]]:[Math.cos(b[3]),0,Math.sin(b[3])],ua=a.length>=12?[a[9],a[10],a[11]]:[0,1,0],ub=b.length>=12?[b[9],b[10],b[11]]:[0,1,0];
 const dead=!!a[4],f=norm(lerp(fa,fb,k));let up=norm(lerp(ua,ub,k));const r=norm(cross(f,up));up=cross(r,f);return {pos:lerp(a,b,b[4]&&!a[4]?0:k),f,up,r,dead,lostAt:null,field:a[5]};}
const lost=[];for(let n=0;n<N;n++){let t=null;for(let i=0;i<T.frames.length;i++)if(T.frames[i].u[n][4]){t=i*T.dt;break;}lost.push(t);}
// stars: fixed directions, drawn far away about the camera
const SN=1400,stars=new Float32Array(SN*3),starC=new Uint8Array(SN*4);let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;for(let i=0;i<SN;i++){const z=rnd()*2-1,a=rnd()*6.283,r=Math.sqrt(1-z*z),b=120+Math.floor(rnd()*135);stars.set([r*Math.cos(a),z,r*Math.sin(a)],i*3);starC.set([b,b,Math.min(255,b+20),255],i*4);}
const dyn=gl.createBuffer(),dynC=gl.createBuffer();
function lines(vp,pts,cols,mode){gl.useProgram(L);gl.uniformMatrix4fv(gl.getUniformLocation(L,'vp'),false,new Float32Array(vp));const p=gl.getAttribLocation(L,'p'),c=gl.getAttribLocation(L,'c');gl.bindBuffer(gl.ARRAY_BUFFER,dyn);gl.bufferData(gl.ARRAY_BUFFER,pts,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,dynC);gl.bufferData(gl.ARRAY_BUFFER,cols,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(c);gl.vertexAttribPointer(c,4,gl.UNSIGNED_BYTE,true,0,0);gl.drawArrays(mode,0,pts.length/3);}
// the camera: a chase view of one craft at a time (the subject changes every CUT seconds, and at once when it is lost),
// behind and above it, looking past it toward the craft it is nearest to.
const CUT=14;let cam=null,subject=0,cutAt=0;
function pick(t,avoid){const live=[];for(let n=0;n<N;n++)if(lost[n]==null||lost[n]>t+3)live.push(n);if(!live.length)return subject;const k=Math.floor(t/CUT);const side=k%3===2?1:0,pool=live.filter(n=>T.teams[n]===side&&n!==avoid);const p=pool.length?pool:live;
 // the one nearest an opponent: where the fight is
 let best=p[0],bd=1e18;for(const n of p){const s=at(n,t);for(let m=0;m<N;m++){if(T.teams[m]===T.teams[n]||(lost[m]!=null&&lost[m]<=t))continue;const d=len(sub(at(m,t).pos,s.pos));if(d<bd){bd=d;best=n;}}}return best;}
function frame(t){
 if(cam==null||t>=cutAt||(lost[subject]!=null&&t>lost[subject]+1.2)){const was=subject;subject=pick(t,cam==null?-1:was);cutAt=(Math.floor(t/CUT)+1)*CUT;cam=null;}
 const S=at(subject,t);let tgt=null,td=1e18;for(let m=0;m<N;m++){if(T.teams[m]===T.teams[subject]||(lost[m]!=null&&lost[m]<=t))continue;const q=at(m,t),d=len(sub(q.pos,S.pos));if(d<td){td=d;tgt=q;}}
 // over the shoulder: the eye sits behind the subject on the line from its opponent through it, a little above and to the side,
 // so the subject is in the foreground and the craft it is fighting is ahead in the frame. Only the direction is smoothed
 // (the craft fly a kilometre a second: an eye that lagged in place would be left behind).
 const size=MB[T.teams[subject]].len,back=size*2.4,toT=tgt?norm(sub(tgt.pos,S.pos)):S.f,wantDir=norm(add(mul(toT,.7),mul(S.f,.3))),wantUp=norm(add(mul(S.up,.35),[0,.65,0]));
 cam=cam?{dir:norm(lerp(cam.dir,wantDir,.12)),up:norm(lerp(cam.up,wantUp,.06))}:{dir:wantDir,up:wantUp};
 const side=norm(cross(cam.dir,cam.up));cam.e=add(S.pos,add(mul(cam.dir,-back),add(mul(cam.up,size*.75),mul(side,size*.6))));cam.c=add(S.pos,mul(cam.dir,size*6));
 const view=look(cam.e,cam.c,cam.up),vp=mm(persp(.95,W/H,1,60000),view);
 gl.viewport(0,0,W,H);gl.clearColor(.004,.006,.014,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 gl.disable(gl.DEPTH_TEST);{const p=new Float32Array(SN*3);for(let i=0;i<SN;i++){p[i*3]=cam.e[0]+stars[i*3]*30000;p[i*3+1]=cam.e[1]+stars[i*3+1]*30000;p[i*3+2]=cam.e[2]+stars[i*3+2]*30000;}lines(vp,p,starC,gl.POINTS);}
 gl.enable(gl.DEPTH_TEST);
 // trails (the last 4 s of each craft's path)
 {const p=[],c=[];for(let n=0;n<N;n++){if(lost[n]!=null&&t>lost[n])continue;const col=T.teams[n]?[255,110,90]:[110,180,255];for(let k=0;k<16;k++){const t0=t-k*.25,t1=t-(k+1)*.25;if(t1<0)break;const a=at(n,t0).pos,b=at(n,t1).pos,al=Math.round(150*(1-k/16));p.push(...a,...b);c.push(...col,al,...col,Math.round(150*(1-(k+1)/16)));}}
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);lines(vp,new Float32Array(p),new Uint8Array(c),gl.LINES);gl.depthMask(true);gl.disable(gl.BLEND);}
 // craft
 gl.useProgram(P);gl.uniformMatrix4fv(gl.getUniformLocation(P,'vp'),false,new Float32Array(vp));gl.uniform3fv(gl.getUniformLocation(P,'sun'),norm([.45,.75,.35]));
 const pa=gl.getAttribLocation(P,'p'),na=gl.getAttribLocation(P,'n'),ca=gl.getAttribLocation(P,'c'),marks=[];
 for(let n=0;n<N;n++){const s=at(n,t),gone=lost[n]!=null&&t>=lost[n];if(gone){if(t-lost[n]<1.6)marks.push({n,pos:s.pos,burst:(t-lost[n])/1.6});continue;}
  const b=MB[T.teams[n]];gl.bindBuffer(gl.ARRAY_BUFFER,b.pos);gl.enableVertexAttribArray(pa);gl.vertexAttribPointer(pa,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,b.nor);gl.enableVertexAttribArray(na);gl.vertexAttribPointer(na,3,gl.BYTE,true,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,b.col);gl.enableVertexAttribArray(ca);gl.vertexAttribPointer(ca,4,gl.UNSIGNED_BYTE,true,0,0);
  gl.uniform3fv(gl.getUniformLocation(P,'o'),s.pos);gl.uniform3fv(gl.getUniformLocation(P,'f'),s.f);gl.uniform3fv(gl.getUniformLocation(P,'u'),s.up);gl.uniform3fv(gl.getUniformLocation(P,'r'),s.r);gl.uniform1f(gl.getUniformLocation(P,'s'),1);gl.uniform3fv(gl.getUniformLocation(P,'tint'),T.teams[n]?[.8,.84,.92]:[.82,.8,.76]);gl.drawArrays(gl.TRIANGLES,0,b.n);marks.push({n,pos:s.pos,field:s.field});}
 // gun fire: bolts flying from the craft that fired to its target during the 0.25 s record
 {const i=Math.min(T.frames.length-1,Math.floor(t/T.dt)),k=t/T.dt-i,p=[],c=[];for(const [a,b] of T.frames[i].f){const na2=T.ids.indexOf(a),nb=T.ids.indexOf(b);if(na2<0||nb<0)continue;const A=at(na2,t),B=at(nb,t),d=sub(B.pos,A.pos),l=len(d),dir=norm(d),col=T.teams[na2]?[120,255,120]:[255,90,70];for(let j=0;j<2;j++){const u=((k+j*.5)%1),h=Math.min(l,l*u),q=add(A.pos,mul(dir,h)),q2=add(A.pos,mul(dir,Math.min(l,h+Math.max(40,l*.12))));p.push(...q,...q2);c.push(...col,255,...col,255);}}
  if(p.length){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);lines(vp,new Float32Array(p),new Uint8Array(c),gl.LINES);gl.disable(gl.BLEND);}}
 // HUD: markers on every craft (they are a few metres long and often a kilometre off), bursts, the count
 hud.clearRect(0,0,W,H);hud.font='13px system-ui,sans-serif';const proj=p=>{const x=vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12],y=vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13],w=vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15];return w>0?[W/2+x/w*W/2,H/2-y/w*H/2,w]:null;};
 for(const m of marks){const q=proj(m.pos);if(!q)continue;const col=T.teams[m.n]?'255,120,100':'120,185,255';if(m.burst!=null){const r=18+m.burst*90*Math.max(.15,Math.min(1,60/q[2]*12));const g=hud.createRadialGradient(q[0],q[1],0,q[0],q[1],r);g.addColorStop(0,'rgba(255,245,200,'+(1-m.burst)+')');g.addColorStop(.4,'rgba(255,150,60,'+(.8*(1-m.burst))+')');g.addColorStop(1,'rgba(255,80,20,0)');hud.fillStyle=g;hud.beginPath();hud.arc(q[0],q[1],r,0,6.283);hud.fill();continue;}
  if(m.n===subject)continue;const d=q[2],r=Math.max(7,Math.min(26,900/d*14));hud.strokeStyle='rgba('+col+','+(d>250?.85:.25)+')';hud.lineWidth=1.2;hud.strokeRect(q[0]-r,q[1]-r,r*2,r*2);if(d>250){hud.fillStyle='rgba('+col+',.9)';hud.fillText(T.ids[m.n]+'  '+(d>=1000?(d/1000).toFixed(1)+' km':Math.round(d)+' m'),q[0]+r+4,q[1]-r+4);}}
 const left=k=>T.teams.filter((x,n)=>x===k&&!(lost[n]!=null&&t>=lost[n])).length,num=k=>T.teams.filter(x=>x===k).length;hud.font='17px system-ui,sans-serif';hud.fillStyle='rgba(120,185,255,1)';hud.fillText(T.names[T.teams.indexOf(0)]+'  '+left(0)+' / '+num(0),18,30);hud.fillStyle='rgba(255,120,100,1)';hud.fillText(T.names[T.teams.indexOf(1)]+'  '+left(1)+' / '+num(1),18,54);
 hud.fillStyle='rgba(215,225,240,.9)';hud.font='14px system-ui,sans-serif';hud.fillText('T+'+t.toFixed(1)+' s   ×${SPEED}   camera: '+T.ids[subject]+' ('+T.names[subject]+')',18,H-18);hud.fillText('simulation replay (scripts/sim-dogfight.cjs, seed '+(T.seed??'?')+')',W-360,H-18);
 gl.finish();return true;}
window.__end=END;window.__frame=frame;
</script>`;
(async()=>{const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>{console.error('page error:',e.message);});await page.setContent(html);if(await page.title()==='NOGL')throw new Error('no WebGL in this browser');
 const end=await page.evaluate(()=>window.__end),total=Math.ceil((end+2)/SPEED*FPS)+1,only=process.env.KS_FRAMES?process.env.KS_FRAMES.split(',').map(Number):null;
 for(let i=0;i<total;i++){const t=Math.min(end+2,i/FPS*SPEED);await page.evaluate(x=>window.__frame(x),t);if(only&&!only.includes(i)){if(i>Math.max(...only))break;continue;}await page.screenshot({path:path.join(out,'frames',String(i).padStart(5,'0')+'.jpg'),type:'jpeg',quality:92});if(i%200===0)console.error(`frame ${i}/${total}`);}
 await browser.close();if(only){console.log('frames written:',only.join(','));return;}
 const name=`dogfight3d-${trace.ids.filter((_,n)=>trace.teams[n]===0).length}x-${trace.a.replace('craft_','')}-vs-${trace.ids.filter((_,n)=>trace.teams[n]===1).length}x-${trace.b.replace('craft_','')}`,dest=path.join(out,name+'.mp4');
 try{execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(FPS),'-i',path.join(out,'frames','%05d.jpg'),'-c:v','libx264','-pix_fmt','yuv420p','-crf','21','-movflags','+faststart',dest]);console.log(dest,fs.statSync(dest).size);}
 catch(e){const alt=path.join(out,name+'.webm');execFileSync('ffmpeg',['-y','-loglevel','error','-framerate',String(FPS),'-i',path.join(out,'frames','%05d.jpg'),'-c:v','libvpx-vp9','-b:v','0','-crf','32',alt]);console.log(alt,fs.statSync(alt).size);}
})().catch(e=>{console.error(e);process.exit(1);});
