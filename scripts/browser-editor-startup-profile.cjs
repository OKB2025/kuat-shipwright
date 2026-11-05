#!/usr/bin/env node
// Measure the real title-menu entry path, including a cold saved draft.
// Examples:
// node scripts/browser-editor-startup-profile.cjs --case arquitens --output /tmp/arq
// node scripts/browser-editor-startup-profile.cjs --case continue --draft /tmp/imperial.json --output /tmp/isd
// KS_TEST_ROOT=/tmp/old-checkout node scripts/browser-editor-startup-profile.cjs --url http://127.0.0.1:8877 --case arquitens --output /tmp/old-arq
// CPU profiles are diagnostic artifacts beside the JSON report, not runtime files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const args=process.argv.slice(2),arg=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1];};
const sourceRoot=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const url=arg('--url','http://127.0.0.1:8876'),kind=arg('--case','new'),output=path.resolve(arg('--output','/tmp/editor-startup-profile'));
const draftPath=arg('--draft',null),draft=draftPath?JSON.parse(fs.readFileSync(draftPath,'utf8')):null;
if(kind==='continue'&&!draft)throw Error('--case continue requires --draft');
const sourceFiles=['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/app.js','js/gfx.js','js/lang-en.js','js/engine.js','index.html'];
const hashes=()=>Object.fromEntries(sourceFiles.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(sourceRoot,file))).digest('hex')]));
const sourceSha256=hashes(),cpuThrottle=Math.max(1,Number(arg('--cpu','1'))),mobile=args.includes('--mobile');
function profileSummary(profile){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(),self=new Map(),inclusive=new Map();
 for(const n of profile.nodes)for(const id of n.children||[])parents.set(id,n.id);
 for(let i=0;i<(profile.samples||[]).length;i++){
  let id=profile.samples[i];const ms=(profile.timeDeltas[i]||0)/1000;self.set(id,(self.get(id)||0)+ms);
  const seen=new Set();while(id){const name=nodes.get(id).callFrame.functionName||'(anonymous)';if(!seen.has(name)){inclusive.set(name,(inclusive.get(name)||0)+ms);seen.add(name);}id=parents.get(id);}
 }
 const top=[...self].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([id,ms])=>{
  const n=nodes.get(id),stack=[];let ancestor=id;
  while(ancestor){const p=nodes.get(ancestor);stack.push(`${p.callFrame.functionName||'(anonymous)'}:${p.callFrame.lineNumber+1}`);ancestor=parents.get(ancestor);}
  return {selfMs:Math.round(ms),name:n.callFrame.functionName||'(anonymous)',line:n.callFrame.lineNumber+1,stack:stack.reverse()};
 });
 return {top,inclusiveMs:Object.fromEntries([...inclusive].sort((a,b)=>b[1]-a[1]).map(([name,ms])=>[name,Math.round(ms)]))};
}
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const context=await browser.newContext({viewport:mobile?{width:844,height:390}:{width:1440,height:1000},locale:'ja-JP',isMobile:mobile,hasTouch:mobile,deviceScaleFactor:mobile?2:1}),page=await context.newPage();
 const errors=[],consoleErrors=[],marks=[],workerSummaries=[];page.setDefaultTimeout(120000);
 page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
 await page.addInitScript(draft=>{
  localStorage.clear();localStorage.setItem('yard.language','ja');
  if(draft){localStorage.setItem('yard.draft3',JSON.stringify(draft));localStorage.setItem('yard.draft3.meta',JSON.stringify({name:draft.name,L:draft.hull?.L,savedAt:Date.now()}));}
  window.__startupProfile={longTasks:[],workerEvents:[],uiEvents:[]};
  document.addEventListener('click',event=>{const b=event.target.closest?.('button');if(!b)return;const control=Object.hasOwn(b.dataset,'titleStart')?'new':b.dataset.titleExample?'example:'+b.dataset.titleExample:b.dataset.title==='continue'?'continue':null;if(control)window.__startupProfile.uiEvents.push({type:'nativeClick',control,timeMs:performance.now(),genBefore:window.__yard?.eng.gen||0,hasShipBefore:!!window.__yard?.ship,geometryReadyBefore:!!window.__yard?.ship&&window.__yard.eng.geoGen>=window.__yard.eng.gen});},true);
  let seenGeometry=-1,seenStats=-1;
  setInterval(()=>{const Y=window.__yard;if(!Y?.ship||!Y.eng.gen)return;const gen=Y.eng.gen;if(Y.eng.geoGen>=gen&&seenGeometry!==gen){seenGeometry=gen;window.__startupProfile.uiEvents.push({type:'geometryAdopted',gen,timeMs:performance.now()});requestAnimationFrame(()=>{const v=Y.view(),modelIndexCount=['hull','struct','refHull','refStruct','parts','fits','refFits'].reduce((n,k)=>n+(v?.meshes?.[k]?.count||0),0);window.__startupProfile.uiEvents.push({type:'geometryAnimationFrame',gen,timeMs:performance.now(),modelIndexCount,titleHidden:document.querySelector('#title')?.hidden,busyHidden:document.querySelector('#busy')?.hidden});});}if(Y.eng.statsGen>=gen&&seenStats!==gen){seenStats=gen;window.__startupProfile.uiEvents.push({type:'statisticsAdopted',gen,timeMs:performance.now()});}},20);
  new PerformanceObserver(list=>window.__startupProfile.longTasks.push(...list.getEntries().map(e=>({startMs:e.startTime,durationMs:e.duration})))).observe({type:'longtask',buffered:true});
  const NativeWorker=Worker;
  window.Worker=class extends NativeWorker{
   constructor(...args){super(...args);window.__startupProfile.workerEvents.push({kind:'created',timeMs:performance.now()});this.addEventListener('message',event=>{
    const m=event.data||{};window.__startupProfile.workerEvents.push({kind:'received',timeMs:performance.now(),type:m.type,gen:m.gen,meshMs:m.meshMs,packMs:m.packMs,syncMs:m.syncMs,totalMs:m.totalMs,statsMs:m.statsMs,buildMs:m.ms});
   });}
   postMessage(m,...args){window.__startupProfile.workerEvents.push({kind:'sent',timeMs:performance.now(),type:m?.type,gen:m?.gen});return super.postMessage(m,...args);}
  };
 },draft);
 const cdp=await context.newCDPSession(page),workerSessions=[],pending=new Map();let commandId=1;
 function workerCommand(sessionId,method,params={}){
  const id=commandId++;
  return new Promise((resolve,reject)=>{pending.set(sessionId+':'+id,{resolve,reject});cdp.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(reject);});
 }
 if(args.includes('--workers')){
  cdp.on('Target.receivedMessageFromTarget',event=>{const m=JSON.parse(event.message),key=event.sessionId+':'+m.id,p=pending.get(key);if(p){pending.delete(key);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  cdp.on('Target.attachedToTarget',async event=>{if(event.targetInfo.type!=='worker')return;const id=event.sessionId;workerSessions.push(id);try{await workerCommand(id,'Profiler.enable');await workerCommand(id,'Profiler.setSamplingInterval',{interval:1000});await workerCommand(id,'Profiler.start');}catch(error){errors.push('Worker profiler: '+String(error));}});
  await cdp.send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:false,flatten:false});
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuThrottle});
 await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 const started=Date.now(),mark=name=>{const row={name,elapsedMs:Date.now()-started};marks.push(row);process.stderr.write(`${name}: ${row.elapsedMs}ms\n`);};
 let failure=null,state=null,mainProfile=null,earlyPan=null;
 try{
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:90000});mark('domReady');
  await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});mark('engineReady');
  await page.locator('.tbig[data-title-mode="sandbox"]').click();await page.locator('.tbig[data-title-mode="design"]').click();mark('designMenu');
  if(kind==='continue')await page.locator('[data-title="continue"]').click({noWaitAfter:true});
  else if(kind==='new'){await page.locator('[data-title="new"]').click();mark('newForm');await page.locator('[data-title-start]').click({noWaitAfter:true});}
  else{await page.locator('[data-title="load"]').click();mark('loadMenu');await page.locator(`[data-title-example="${kind}"]`).click({noWaitAfter:true});}
  mark('clicked');
  await page.waitForFunction(()=>{const Y=window.__yard;return document.querySelector('#title')?.hidden&&Y.ship&&Y.eng.geoGen>=Y.eng.gen;},null,{timeout:180000});mark('firstGeometryReady');
  if(args.includes('--pan-before-stats')){
   const before=await page.evaluate(()=>{const Y=window.__yard;return{camera:JSON.stringify(Y.view().cam),statsPending:Y.eng.statsGen<Y.eng.gen};}),box=await page.locator('#cv').boundingBox();
   const x=box.x+box.width*.55,y=box.y+box.height*.55;
   await page.mouse.move(x,y);await page.mouse.down({button:'right'});await page.mouse.move(x+48,y+24,{steps:6});await page.mouse.up({button:'right'});
   const after=await page.evaluate(()=>JSON.stringify(window.__yard.view().cam));earlyPan={statsPendingAtStart:before.statsPending,cameraChanged:before.camera!==after};if(!earlyPan.cameraChanged)throw Error('Native pan failed after the first geometry packet');mark('earlyNativePan');
  }
  await page.waitForFunction(()=>{const Y=window.__yard;return document.querySelector('#title')?.hidden&&Y.ship&&Y.stats&&Y.eng.geoGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&Y.eng.adoptedGen>=Y.eng.gen&&document.querySelector('#engineStatus')?.hidden;},null,{timeout:180000});mark('editorReady');
  if(args.includes('--surface-smoke')){
   await page.locator('#tabs [data-tab="edit"]').click();await page.locator('#panel [data-editsub="surface"]').click();
   await page.waitForFunction(()=>window.__yard.st.tab==='surface'&&document.querySelector('[data-surface-action]'));mark('surfaceEditorReady');
   // Use native accordion controls so their persisted state survives a late panel
   // refresh. Setting details.open directly can race that refresh and hide the row.
   await page.locator('#panel [data-surface-pick]').first().waitFor({state:'attached'});
   for(let attempt=0;attempt<6;attempt++){
    const closed=page.locator('#panel details:not([open])').filter({has:page.locator('[data-surface-pick]')}).first();
    if(await closed.count())await closed.locator(':scope > summary').click({timeout:5000});
    const first=page.locator('#panel [data-surface-pick]:visible').first();
    if(await first.count()){try{await first.click({timeout:5000});break;}catch(error){if(attempt===5)throw error;}}
    await page.waitForTimeout(100);
   }
   await page.waitForFunction(()=>window.__yard.st.surfaceIds?.length>0,null,{timeout:15000});mark('surfaceSelected');
  }
  await page.waitForTimeout(1200);mark('settled');
 }catch(error){failure=String(error);mark('failed');fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:output+'.failure.png'}).catch(()=>{});fs.writeFileSync(output+'.failure.html',await page.content().catch(()=>''));}
 try{
  for(let i=0;i<workerSessions.length;i++){const data=await workerCommand(workerSessions[i],'Profiler.stop');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(`${output}.worker${i}.cpuprofile`,JSON.stringify(data.profile));workerSummaries.push(profileSummary(data.profile));}
  mainProfile=(await cdp.send('Profiler.stop')).profile;
  state=await page.evaluate(()=>{
   const Y=window.__yard,v=Y?.view(),modelMeshes=Object.fromEntries(['hull','struct','refHull','refStruct','parts','fits','refFits'].map(k=>[k,v?.meshes?.[k]?.count||0]));
   return {modelMeshes,modelIndexCount:Object.values(modelMeshes).reduce((a,b)=>a+b,0),ship:Y?.ship?.name,parts:Y?.ship?.parts.length,fits:Y?.ship?.fits.length,selectedSurfaces:Y?.st.surfaceIds||[],engine:Y&&{ready:Y.eng.ready,mode:Y.eng.mode,gen:Y.eng.gen,geoGen:Y.eng.geoGen,statsGen:Y.eng.statsGen,adoptedGen:Y.eng.adoptedGen},...window.__startupProfile,webglError:Y?.view()?.gl?.getError()};
  });
  if(state.webglError!==0)errors.push('WebGL error: '+state.webglError);if(!(state.modelIndexCount>0))errors.push('No uploaded native design geometry');if(kind==='new'&&(state.ship!=='新設計艦'||state.parts!==0||state.fits!==0))errors.push('Native new-design choice did not replace the prior draft');if(kind==='continue'&&draft&&(state.ship!==draft.name||state.parts!==draft.parts.length||state.fits!==draft.fits.length))errors.push('Continue did not preserve the saved design identity and inventory');
 }catch(error){errors.push('Profile collection: '+String(error));}
 finally{await browser.close();}
 fs.mkdirSync(path.dirname(output),{recursive:true});if(mainProfile)fs.writeFileSync(output+'.cpuprofile',JSON.stringify(mainProfile));
 const afterSha256=hashes(),sourcesUnchanged=JSON.stringify(afterSha256)===JSON.stringify(sourceSha256);
 const nativeClick=state?.uiEvents?.find(e=>e.type==='nativeClick'),targetGen=nativeClick?Math.max(1,nativeClick.genBefore+(nativeClick.control==='continue'?0:1)):null;
 const events=state?.workerEvents||[],built=events.find(e=>e.kind==='received'&&e.type==='built'&&(!nativeClick||e.timeMs>=nativeClick.timeMs)),sent=events.find(e=>e.kind==='sent'&&e.type==='update'&&e.gen===targetGen),geo=events.find(e=>e.kind==='received'&&e.type==='geometry'&&e.gen===targetGen);
 const firstGeometry=state?.uiEvents?.find(e=>e.type==='geometryAdopted'&&e.gen===targetGen),firstStats=state?.uiEvents?.find(e=>e.type==='statisticsAdopted'&&e.gen===targetGen),firstFrame=state?.uiEvents?.find(e=>e.type==='geometryAnimationFrame'&&e.gen===targetGen);
 const preSelectionUpdateCount=events.filter(e=>e.kind==='sent'&&e.type==='update'&&nativeClick&&e.timeMs<nativeClick.timeMs).length;
 if(args.includes('--expect-lazy-draft')&&preSelectionUpdateCount)errors.push('Unselected saved draft was sent to the worker before the native choice');
 const report={schemaVersion:1,emulation:{mobile,cpuThrottle,deviceScaleFactor:mobile?2:1,viewport:mobile?[844,390]:[1440,1000]},status:failure||errors.length?'FAIL':'PASS',date:new Date().toISOString(),url,kind,draftSha256:draftPath?crypto.createHash('sha256').update(fs.readFileSync(draftPath)).digest('hex'):null,sourceSha256,sourcesUnchanged,...(!sourcesUnchanged?{sourceSha256After:afterSha256}:{}),totalMs:Date.now()-started,marks,failure,errors,consoleErrors,measurements:{preSelectionUpdateCount,nativeClickToGeometryMs:nativeClick&&firstGeometry?Math.max(0,firstGeometry.timeMs-nativeClick.timeMs):null,nativeClickToFirstGeometryFrameMs:nativeClick&&firstFrame?Math.max(0,firstFrame.timeMs-nativeClick.timeMs):null,nativeClickToStatisticsMs:nativeClick&&firstStats?Math.max(0,firstStats.timeMs-nativeClick.timeMs):null,buildReplyToFirstUpdateMs:built&&sent?sent.timeMs-built.timeMs:null,firstWorkerGeometryRoundtripMs:sent&&geo?geo.timeMs-sent.timeMs:null,maxMainLongTaskMs:Math.max(0,...(state?.longTasks||[]).map(t=>t.durationMs)),maxMainLongTaskDuringOpeningMs:nativeClick&&firstFrame?Math.max(0,...(state?.longTasks||[]).filter(t=>t.startMs<firstFrame.timeMs&&t.startMs+t.durationMs>nativeClick.timeMs).map(t=>Math.min(firstFrame.timeMs,t.startMs+t.durationMs)-Math.max(nativeClick.timeMs,t.startMs))):null},earlyPan,mainCpu:mainProfile?profileSummary(mainProfile):null,workerCpu:workerSummaries,state,scope:{entry:'Native title controls and editor readiness; no debug setShip fixture',freshContext:true,coldSavedDraft:!!draft,surfaceSmoke:args.includes('--surface-smoke'),renderer:'Chromium software WebGL; CPU target throttling is diagnostic and does not model physical mobile GPU, network or all worker scheduling; wall times are not device FPS'}};
 fs.writeFileSync(output+'.json',JSON.stringify(report,null,2)+'\n');
 process.stdout.write(JSON.stringify({status:report.status,output:output+'.json',measurements:report.measurements,totalMs:report.totalMs,sourcesUnchanged})+'\n');
 if(failure||errors.length||args.includes('--strict-sources')&&!sourcesUnchanged)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
