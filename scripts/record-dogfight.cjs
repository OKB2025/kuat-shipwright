// Records a replay of an AI dogfight as a video (webm): a plan view that follows the craft, and a side view of their height.
// usage: KS_TRACE=<trace.json> node scripts/sim-dogfight.cjs <a> <b> 1 <nb> <na>   then   node scripts/record-dogfight.cjs <trace.json> <outdir> [speed=2]
// (outdir is required: nothing is written to docs/)
const fs=require('fs'),path=require('path');const trace=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8')),out=path.resolve(process.argv[3]),speed=+(process.argv[4]||2);fs.mkdirSync(out,{recursive:true});
const html=`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#0b0f16;color:#dfe6f0;font:14px system-ui,sans-serif}canvas{display:block}</style><canvas id="c" width="1280" height="720"></canvas><script>
const T=${JSON.stringify(trace)},SPEED=${speed},c=document.getElementById('c'),g=c.getContext('2d'),W=1280,H=720,PH=520,COL=['#6db3ff','#ff7a6b'];let view=null;
function draw(time){const i=Math.min(T.frames.length-1,Math.floor(time/T.dt)),F=T.frames[i];g.fillStyle='#0b0f16';g.fillRect(0,0,W,H);
 const live=F.u.map((u,k)=>({u,k})).filter(x=>!x.u[4]),pts=(live.length?live:F.u.map((u,k)=>({u,k}))).map(x=>x.u);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9,y0=1e9,y1=-1e9;for(const u of pts){x0=Math.min(x0,u[0]);x1=Math.max(x1,u[0]);z0=Math.min(z0,u[2]);z1=Math.max(z1,u[2]);y0=Math.min(y0,u[1]);y1=Math.max(y1,u[1]);}
 const cx=(x0+x1)/2,cz=(z0+z1)/2,span=Math.max(1500,(x1-x0)*1.25+600,(z1-z0)*1.25*W/PH+600),tgt={cx,cz,span};view=view?{cx:view.cx+(tgt.cx-view.cx)*.08,cz:view.cz+(tgt.cz-view.cz)*.08,span:view.span+(tgt.span-view.span)*.06}:tgt;
 const k=W/view.span,X=x=>W/2+(x-view.cx)*k,Z=z=>PH/2+(z-view.cz)*k;
 // grid
 const step=[100,200,500,1000,2000,5000,10000].find(s=>s*k>70)||20000;g.strokeStyle='#18202c';g.lineWidth=1;g.beginPath();for(let x=Math.floor((view.cx-view.span/2)/step)*step;x<view.cx+view.span/2;x+=step){g.moveTo(X(x),0);g.lineTo(X(x),PH);}for(let z=Math.floor((view.cz-PH/k/2)/step)*step;z<view.cz+PH/k/2;z+=step){g.moveTo(0,Z(z));g.lineTo(W,Z(z));}g.stroke();
 g.fillStyle='#7f8ea3';g.fillText('grid '+(step>=1000?step/1000+' km':step+' m'),12,PH-10);
 // trails
 for(let n=0;n<T.ids.length;n++){g.strokeStyle=COL[T.teams[n]];g.globalAlpha=.45;g.lineWidth=1.5;g.beginPath();let on=false;for(let j=Math.max(0,i-32);j<=i;j++){const u=T.frames[j].u[n];if(u[4])break;const px=X(u[0]),pz=Z(u[2]);if(on)g.lineTo(px,pz);else{g.moveTo(px,pz);on=true;}}g.stroke();g.globalAlpha=1;}
 // gun fire
 g.strokeStyle='#ffe48a';g.lineWidth=1;g.globalAlpha=.8;for(const [a,b] of F.f){const p=F.u[T.ids.indexOf(a)],q=F.u[T.ids.indexOf(b)];if(!p||!q)continue;g.beginPath();g.moveTo(X(p[0]),Z(p[2]));g.lineTo(X(q[0]),Z(q[2]));g.stroke();}g.globalAlpha=1;
 // craft
 F.u.forEach((u,n)=>{const px=X(u[0]),pz=Z(u[2]);if(u[4]){g.strokeStyle='#555f6e';g.beginPath();g.moveTo(px-5,pz-5);g.lineTo(px+5,pz+5);g.moveTo(px+5,pz-5);g.lineTo(px-5,pz+5);g.stroke();return;}
  g.save();g.translate(px,pz);g.rotate(u[3]);g.fillStyle=COL[T.teams[n]];g.beginPath();g.moveTo(11,0);g.lineTo(-7,6);g.lineTo(-3,0);g.lineTo(-7,-6);g.closePath();g.fill();g.restore();
  if(u[5]>=0){g.strokeStyle='#8fd0ff';g.globalAlpha=.25+.6*u[5];g.beginPath();g.arc(px,pz,13,0,6.283);g.stroke();g.globalAlpha=1;}g.fillStyle='#aab6c6';g.fillText(T.ids[n],px+12,pz-10);});
 // side view: height
 g.fillStyle='#0e141d';g.fillRect(0,PH,W,H-PH);g.strokeStyle='#243042';g.beginPath();g.moveTo(0,PH);g.lineTo(W,PH);g.stroke();const ys=Math.max(300,(y1-y0)*1.3,Math.abs(y0)*2.2,Math.abs(y1)*2.2),Y=y=>PH+(H-PH)/2-(y/ys)*(H-PH-30);g.strokeStyle='#1c2836';g.beginPath();g.moveTo(0,Y(0));g.lineTo(W,Y(0));g.stroke();
 F.u.forEach((u,n)=>{if(u[4])return;g.fillStyle=COL[T.teams[n]];g.beginPath();g.arc(X(u[0]),Y(u[1]),4,0,6.283);g.fill();});g.fillStyle='#7f8ea3';g.fillText('side view: height (band ±'+Math.round(ys/2)+' m)',12,PH+18);
 // legend
 const lost=t=>F.u.filter((u,n)=>T.teams[n]===t&&u[4]).length,num=t=>T.teams.filter(x=>x===t).length;g.fillStyle='#dfe6f0';g.font='16px system-ui,sans-serif';g.fillText(T.kind+'   T+'+F.t.toFixed(1)+' s   ×'+SPEED,12,24);g.fillStyle=COL[0];g.fillText(T.a.replace('craft_','')+'  '+(num(0)-lost(0))+'/'+num(0),12,48);g.fillStyle=COL[1];g.fillText(T.b.replace('craft_','')+'  '+(num(1)-lost(1))+'/'+num(1),12,70);g.font='14px system-ui,sans-serif';}
let t0=null;function loop(now){if(t0==null)t0=now;const time=(now-t0)/1000*SPEED;draw(time);if(time<T.frames.length*T.dt+1.5)requestAnimationFrame(loop);else window.__done=true;}requestAnimationFrame(loop);
</script>`;
(async()=>{const {chromium}=require('playwright'),browser=await chromium.launch({headless:true,args:['--no-sandbox']}),ctx=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:out,size:{width:1280,height:720}}}),page=await ctx.newPage();
 await page.setContent(html);await page.waitForTimeout(20000);await page.screenshot({path:path.join(out,'preview.png')});await page.waitForFunction(()=>window.__done===true,null,{timeout:600000});const video=page.video();await ctx.close();const file=await video.path();const dest=path.join(out,`dogfight-${trace.a.replace('craft_','')}-vs-${trace.b.replace('craft_','')}-${trace.kind}.webm`);fs.renameSync(file,dest);await browser.close();console.log(dest,fs.statSync(dest).size);})().catch(e=>{console.error(e);process.exit(1);});
