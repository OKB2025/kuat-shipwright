#!/usr/bin/env node
// Structure-move latency in headless Chromium with the real Worker.
// Usage: CHROMIUM_PATH=... node scripts/browser-edit-latency.cjs URL OUTPUT_JSON [--designs imperial,user] [--moves N]
// For each design: open it, wait until settled, then move one structure N times (touch('parts'), as
// the editor's move does) and record the time to the settled structure meshes (structureGeometry,
// when the build sends it), the full geometry adopted, and the statistics. A requestAnimationFrame
// sampler and a long-task observer record whether the page stays responsive meanwhile. Finally three
// moves 250 ms apart check that only the newest generation's figures are applied.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),url=args[0],output=args[1];
if(!url||!output){console.error('usage: browser-edit-latency.cjs URL OUTPUT_JSON [--designs a,b] [--moves N]');process.exit(2);}
const opt=(n,d)=>{const i=args.indexOf('--'+n);return i>=0?args[i+1]:d;};
const designs=opt('designs','imperial,user').split(','),moves=+opt('moves',3);
const {C}=require('./update-ship-examples.cjs').loadRuntime(root),{userFixture}=require('../tests/helpers/edit-latency-fixtures.cjs');
const report={date:new Date().toISOString(),url,designs:[],errors:[]};
const save=()=>{fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,1)+'\n');};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||process.env.KS_CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:900},locale:'ja-JP'});page.setDefaultTimeout(240000);
 page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(['warning','error'].includes(m.type()))(report.console||(report.console=[])).push(m.type()+': '+m.text().slice(0,300));});
 try{
  await page.addInitScript(()=>localStorage.setItem('yard.language','ja'));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:120000});
  report.mode=await page.evaluate(()=>YardEngineClient.mode);
  if(report.mode!=='worker')throw new Error('engine mode '+report.mode);
  await page.evaluate(()=>{
   // Responsiveness probes: frame gaps and long tasks on the interface thread.
   const probe=window.__latencyProbe={frames:[],longTasks:[]};let last=performance.now();
   const tick=t=>{probe.frames.push([t,t-last]);last=t;if(probe.frames.length>20000)probe.frames.splice(0,10000);requestAnimationFrame(tick);};requestAnimationFrame(tick);
   try{new PerformanceObserver(list=>{for(const e of list.getEntries())probe.longTasks.push([e.startTime,e.duration]);}).observe({entryTypes:['longtask']});}catch(e){}
  });
  const settled=()=>page.waitForFunction(()=>{const e=window.__yard.eng;return e.geoGen===e.gen&&e.statsGen===e.gen&&e.adoptedGen===e.gen&&!e.uploading;},null,{timeout:600000,polling:100});
  for(const name of designs){
   const row={design:name,moves:[]};report.designs.push(row);save();
   // Both designs open from the same saved data before and after a change (an example's prepared file
   // is only used by the Worker when the Core hash matches; buildDesign would make runs incomparable).
   const raw=name==='user'?JSON.parse(C.publicJSON(C.serialize(userFixture(C)))):JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(path.join(root,'data/examples',name,'design.json.gz'))));
   await page.evaluate(raw=>{const Y=window.__yard;Y.title?.hide?.();Y.setShip(Y.C.deserialize(raw));},raw);
   const t0=Date.now();await settled();row.openMs=Date.now()-t0;
   row.target=await page.evaluate(()=>{const Y=window.__yard,s=Y.ship,st=s.parts.filter(p=>Y.C.isShapePart(p)&&!Y.C.isHullStructure?.(p));const p=st.find(q=>!q.placement)||st[Math.floor(st.length/2)];window.__latencyTarget=p.id;return {id:p.id,form:p.form,placed:!!p.placement,structures:st.length,parts:s.parts.length};});
   for(let i=0;i<moves;i++){
    const r=await page.evaluate(async i=>{
     const Y=window.__yard,e=Y.eng,p=Y.ship.parts.find(q=>q.id===window.__latencyTarget),probe=window.__latencyProbe;
     const dx=(i%2?-1:1)*Math.max(.5,Y.ship.hull.L*.004);p.c=[p.c[0]+dx,p.c[1],p.c[2]];if(p.placement?.requestedGeometry?.c)p.placement.requestedGeometry.c=p.c.slice();
     const start=performance.now(),frame0=probe.frames.length,long0=probe.longTasks.length;Y.touch('parts');const gen=e.gen,at={};
     await new Promise(resolve=>{const poll=()=>{const t=performance.now()-start;if(e.structGen===gen&&at.structures==null)at.structures=t;if(e.geoGen>=gen&&at.geometry==null)at.geometry=t;if(e.adoptedGen>=gen&&at.adopted==null)at.adopted=t;if(e.statsGen>=gen&&at.stats==null)at.stats=t;if(at.stats!=null&&at.adopted!=null&&!e.uploading)resolve();else setTimeout(poll,5);};poll();});
     const gaps=probe.frames.slice(frame0).map(f=>f[1]),longTasks=probe.longTasks.slice(long0).filter(l=>l[0]>=start).map(l=>l[1]);
     return {gen,dx,ms:Object.fromEntries(Object.entries(at).map(([k,v])=>[k,Math.round(v)])),maxFrameGapMs:Math.round(Math.max(0,...gaps)),frames:gaps.length,longTasks:longTasks.length,longestTaskMs:Math.round(Math.max(0,...longTasks))};
    },i);
    row.moves.push(r);save();console.log(name,JSON.stringify(r));
   }
   // Rapid edits: three moves 250 ms apart; only the newest generation's figures may be applied.
   row.rapid=await page.evaluate(async()=>{
    const Y=window.__yard,e=Y.eng,p=Y.ship.parts.find(q=>q.id===window.__latencyTarget),seen=[];let last=e.statsGen;const start=performance.now();
    const watch=setInterval(()=>{if(e.statsGen!==last){seen.push({statsGen:e.statsGen,gen:e.gen,t:Math.round(performance.now()-start)});last=e.statsGen;}},5);
    const gens=[];for(let k=0;k<3;k++){p.c=[p.c[0]+(k%2?-1:1),p.c[1],p.c[2]];if(p.placement?.requestedGeometry?.c)p.placement.requestedGeometry.c=p.c.slice();Y.touch('parts');gens.push(e.gen);await new Promise(r=>setTimeout(r,250));}
    await new Promise(resolve=>{const poll=()=>{if(e.statsGen===e.gen&&e.adoptedGen===e.gen&&!e.uploading)resolve();else setTimeout(poll,10);};poll();});
    clearInterval(watch);if(e.statsGen!==last)seen.push({statsGen:e.statsGen,gen:e.gen,t:Math.round(performance.now()-start)});return {gens,applied:seen,finalMs:Math.round(performance.now()-start)};
   });
   // The editor accepts statistics only for its current generation; record any applied older one.
   row.rapid.staleApplied=row.rapid.applied.filter(a=>a.statsGen<a.gen);row.rapid.finalIsNewest=row.rapid.applied.at(-1)?.statsGen===row.rapid.gens.at(-1);
   save();console.log(name,'rapid',JSON.stringify(row.rapid));
  }
  report.status='OK';
 }catch(e){report.status='FAILED';report.errors.push(String(e&&e.stack||e));try{await page.screenshot({path:output.replace(/\.json$/,'')+'.failed.jpg',type:'jpeg'});}catch{}}
 finally{save();await browser.close();}
 process.exit(report.status==='OK'?0:1);
})();
