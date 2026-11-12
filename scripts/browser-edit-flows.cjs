#!/usr/bin/env node
// Editor flows around the structures-first Worker packet, in headless Chromium with the real Worker.
// Usage: CHROMIUM_PATH=... node scripts/browser-edit-flows.cjs URL OUTPUT_DIR [--imperial]
// User-style design (tests/helpers/edit-latency-fixtures.cjs): a move through the editor's edit
// session (前後 X, apply; history), a screenshot while 「内装と装備を計算中…」 is shown, undo and redo, a
// design switch while a calculation is in flight, and a slider drag held while the packets arrive.
// With --imperial, also opens the Imperator example data and moves one structure once.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),[url,outDir]=process.argv.slice(2);
if(!url||!outDir){console.error('usage: browser-edit-flows.cjs URL OUTPUT_DIR [--imperial]');process.exit(2);}
fs.mkdirSync(outDir,{recursive:true});
const {C}=require('./update-ship-examples.cjs').loadRuntime(root),{userFixture}=require('../tests/helpers/edit-latency-fixtures.cjs');
const report={date:new Date().toISOString(),url,checks:{},errors:[],console:[]};
const save=()=>fs.writeFileSync(path.join(outDir,'flows.json'),JSON.stringify(report,null,1)+'\n');
const mem=()=>({freeMB:Math.round(os.freemem()/2**20),availableMB:(()=>{try{return +fs.readFileSync('/proc/meminfo','utf8').match(/MemAvailable:\s+(\d+)/)[1]>>10;}catch{return null;}})()});
(async()=>{
 report.memoryAtStart=mem();
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:1280,height:900},locale:'ja-JP'});page.setDefaultTimeout(300000);
 page.on('pageerror',e=>report.errors.push(String(e.stack||e).slice(0,1200)+' @'+(report.phase||'')));page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))report.console.push(m.text().slice(0,300));});
 const settled=()=>page.waitForFunction(()=>{const e=window.__yard.eng;return e.geoGen===e.gen&&e.statsGen===e.gen&&e.adoptedGen===e.gen&&!e.uploading;},null,{timeout:600000,polling:50});
 const open=async raw=>{await page.evaluate(raw=>{const Y=window.__yard;Y.setShip(Y.C.deserialize(raw));Y.title?.hide?.();},raw);await settled();};
 const state=()=>page.evaluate(()=>{const Y=window.__yard,p=Y.ship.parts.find(q=>q.id===window.__flowTarget);return {c:p&&p.c.slice(),parts:Y.ship.parts.length,gen:Y.eng.gen,statsGen:Y.eng.statsGen,mass:Y.stats?.mass,vol:Y.stats?.vol};});
 // A move through the editor's history: select the structure, then press 「艦首へ」 in the multi-selection card.
 // A move through the editor's edit session (history): select, open 編集, set 前後 X, apply.
 const select=()=>page.evaluate(()=>{const Y=window.__yard;Object.assign(Y.st,{mirror:false,vmirror:false,sel:{list:'parts',id:window.__flowTarget}});Y.st.multi.parts=new Set([window.__flowTarget]);Y.st.multi.fits.clear();Y.renderPanel();});
 const openEdit=async()=>{await select();await page.evaluate(()=>window.__yard.designUIOpen('edit'));await page.locator('[data-design-edit-session]').waitFor();const input=page.locator('#panel input[type="number"][data-sl="ex"]');await input.evaluate(el=>{for(let q=el.parentElement;q;q=q.parentElement)if(q.tagName==='DETAILS')q.open=true;});return input;};
 const move=async(dx=2)=>{try{const input=await openEdit(),x=await page.evaluate(()=>window.__yard.ship.parts.find(q=>q.id===window.__flowTarget).c[0]);await input.fill(String(Math.round((x+dx)*1000)/1000));await input.press('Tab');await page.evaluate(()=>window.__yard.designUIClose());return true;}catch(e){report.moveError=String(e).slice(0,300);return false;}};
 try{
  await page.addInitScript(()=>localStorage.setItem('yard.language','ja'));
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});
  report.mode=await page.evaluate(()=>YardEngineClient.mode);if(report.mode!=='worker')throw new Error('engine mode '+report.mode);
  const user=JSON.parse(C.publicJSON(C.serialize(userFixture(C)))),small=JSON.parse(C.publicJSON(C.serialize(userFixture(C,{interior:10,structures:1}))));small.name='Small switch target';
  await open(user);
  await page.evaluate(()=>{const Y=window.__yard,s=Y.ship.parts.filter(p=>Y.C.isShapePart(p)&&!Y.C.isHullStructure?.(p));window.__flowTarget=s[s.length-1].id;});
  const before=await state();
  // 1. Move, screenshot of the early structure state.
  // Screenshot while the settled structures are shown and the rest is still calculating; it counts only
  // if that state still holds after the capture.
  let lastBefore=null;
  const captureEarly=async(label,attempts)=>{for(let attempt=0;attempt<attempts;attempt++){
   lastBefore=await state();
   if(!await move())throw new Error('move through the edit session failed: '+report.moveError);
   const caught=await page.waitForFunction(()=>{const e=window.__yard.eng,el=document.querySelector('#engineStatus');return e.structGen===e.gen&&e.geoGen<e.gen&&el&&!el.hidden&&el.textContent.includes('内装と装備を計算中');},null,{timeout:60000,polling:'raf'}).then(()=>true,()=>false);
   if(caught){const file=path.join(outDir,'early-structures-'+label+'.png');await page.screenshot({path:file});const after=await page.evaluate(()=>{const e=window.__yard.eng;return {status:document.querySelector('#engineStatus').textContent,stillEarly:e.structGen===e.gen&&e.geoGen<e.gen};});
    if(after.stillEarly){report.checks.screenshot={design:label,file,...after,attempt};await settled();return true;}}
   await settled();
  }return false;};
  report.phase='move';
  if(!await captureEarly('user',4))report.checks.screenshot={file:null,note:'user design: the early state ended before a capture completed'};
  const moved=await state();report.checks.move={before,lastBefore,moved,changed:JSON.stringify(before.c)!==JSON.stringify(moved.c)};save();
  report.phase='undo';
  // 2. Undo and redo.
  await page.click('#btnUndo');await settled();const undone=await state();
  await page.click('#btnRedo');await settled();const redone=await state();
  report.checks.undoRedo={undone,redone,undoRestores:JSON.stringify(undone.c)===JSON.stringify(lastBefore.c)&&undone.mass===lastBefore.mass,redoReapplies:JSON.stringify(redone.c)===JSON.stringify(moved.c)&&redone.mass===moved.mass};save();
  report.phase='drag';
  // 3. A slider drag held while the move's packets arrive: nothing of the move is applied over the drag,
  // and releasing it settles to the dragged generation.
  // In one edit session: type a new X (sent to the Worker on change), then at once start dragging the
  // X slider and hold it while that edit's packets arrive.
  const input=await openEdit();const x0=await page.evaluate(()=>window.__yard.ship.parts.find(q=>q.id===window.__flowTarget).c[0]);
  await input.fill(String(x0+2));
  const drag=await page.evaluate(()=>{const n=document.querySelector('#panel input[type="number"][data-sl="ex"]');n.dispatchEvent(new Event('change',{bubbles:true}));const e=window.__yard.eng;window.__flowSent=e.gen;
   const r=document.querySelector('#panel input[type=range][data-sl="ex"]');if(!r)return null;r.value=String(Math.min(+r.max,+r.value+1));r.dispatchEvent(new Event('input',{bubbles:true}));window.__flowSlider='ex';return 'ex';});
  const sentGen=await page.evaluate(()=>window.__flowSent);
  await page.waitForTimeout(4000);
  const during=await page.evaluate(()=>{const e=window.__yard.eng;return {gen:e.gen,structGen:e.structGen,geoGen:e.geoGen,statsGen:e.statsGen,adoptedGen:e.adoptedGen};});
  await page.evaluate(()=>{const r=document.querySelector('#panel input[type=range][data-sl="'+window.__flowSlider+'"]');r?.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.evaluate(()=>window.__yard.designUIClose());
  await settled();const released=await state();
  report.checks.dragDuringPacket={slider:drag,sentGen,during,released,noStaleApplied:during.structGen!==during.gen&&during.geoGen<during.gen,settledToLatest:released.statsGen===released.gen};save();
  report.phase='switch';
  // 4. Switch designs while a calculation is in flight.
  await move();const inflight=(await state()).gen;
  await page.evaluate(raw=>{const Y=window.__yard;Y.setShip(Y.C.deserialize(raw));},small);
  await settled();
  const switched=await page.evaluate(()=>{const Y=window.__yard;return {name:Y.ship.name,parts:Y.ship.parts.length,gen:Y.eng.gen,statsGen:Y.eng.statsGen,structGen:Y.eng.structGen,mass:Y.stats?.mass};});
  report.checks.designSwitch={inflightGen:inflight,switched,expectedParts:small.parts.length,ok:switched.name==='Small switch target'&&switched.parts===small.parts.length&&switched.statsGen===switched.gen};save();
  report.phase='acclamator';
  // A larger design gives the early state long enough to capture, if the user design was too fast.
  if(!report.checks.screenshot.stillEarly){const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/acclamator/design.json.gz'))));await open(raw);
   await page.evaluate(()=>{const Y=window.__yard,s=Y.ship.parts.filter(p=>Y.C.isShapePart(p)&&!Y.C.isHullStructure?.(p));window.__flowTarget=s[Math.floor(s.length/2)].id;});
   if(!await captureEarly('acclamator',3))report.checks.screenshot.acclamator='not captured';save();}
  report.phase='imperial';
  // 5. Optional: the Imperator once.
  if(process.argv.includes('--imperial')){
   report.checks.imperial={memoryBefore:mem()};save();
   const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/imperial/design.json.gz'))));
   try{
    const t0=Date.now();await open(raw);report.checks.imperial.openMs=Date.now()-t0;report.checks.imperial.memoryOpen=mem();save();
    await page.evaluate(()=>{const Y=window.__yard,s=Y.ship.parts.filter(p=>Y.C.isShapePart(p)&&!Y.C.isHullStructure?.(p));window.__flowTarget=s.find(p=>p.id===36)?.id??s[0].id;});
    const t1=Date.now();await move();
    await page.waitForFunction(()=>{const e=window.__yard.eng;return e.structGen===e.gen;},null,{timeout:600000,polling:50});report.checks.imperial.structuresMs=Date.now()-t1;report.checks.imperial.memoryStructures=mem();save();
    await settled();report.checks.imperial.settledMs=Date.now()-t1;report.checks.imperial.ok=true;
   }catch(e){report.checks.imperial.error=String(e).slice(0,300);report.checks.imperial.memoryAtFailure=mem();}
  }
  report.status='OK';
 }catch(e){report.status='FAILED';report.errors.push(String(e&&e.stack||e));report.memoryAtFailure=mem();try{await page.screenshot({path:path.join(outDir,'failed.png')});}catch{}}
 finally{save();await browser.close();}
 process.exit(report.status==='OK'?0:1);
})();
