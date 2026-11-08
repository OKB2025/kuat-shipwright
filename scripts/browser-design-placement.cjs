#!/usr/bin/env node
// Native pointer/touch controls against the real renderer and Worker.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),url=process.argv[2]||'http://127.0.0.1:8000/',output=path.resolve(process.argv[3]||path.join(root,'docs/benchmarks/design-placement-browser.json'));
const files=['index.html','js/core.js','js/app.js','js/gfx.js','js/engine.js','js/design-ui.css','js/i18n.js','js/lang-en.js','scripts/browser-design-placement.cjs'],hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const stable=page=>page.waitForFunction(()=>{const Y=window.__yard;return Y?.ship&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen},null,{timeout:120000});
async function fixture(page){
 await page.evaluate(()=>{const Y=window.__yard,C=Y.C,s=C.newShip({L:100,W:80,H:40,assembly:true},'Placement acceptance fixture');s.parts=[{id:1,k:'struct',label:'追加元',form:'box',c:[50,0,0],s:[100,60,20]}];s.fits=[];s.nextId=2;s.armor={hull:0,cit:0};Y.setShip(s);Y.title.hide();Object.assign(Y.st,{mirror:false,vmirror:false,structForm:'box',structSize:[20,16,8],structAngles:[0,0,0,0],structPitch:0,structRoll:0,structYaw:0,structTaper:0,sel:{list:'parts',id:1}});Y.st.multi.parts=new Set([1]);Y.st.multi.fits.clear();Y.renderPanel();Object.assign(Y.view().cam,{ortho:true,r:155,th:.7,ph:.7});Y.draw();});
 await stable(page);
}
async function run(browser,profile){
 const context=await browser.newContext({viewport:profile.viewport,isMobile:profile.touch,hasTouch:profile.touch,deviceScaleFactor:1,locale:'ja-JP'}),page=await context.newPage(),errors=[],warnings=[];
 page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('yard.language','ja'));
 const began=Date.now(),result={profile:profile.name,viewport:profile.viewport,touch:profile.touch};
 const press=async selector=>{const el=page.locator(selector).first();await el.scrollIntoViewIfNeeded();if(profile.touch)await el.tap();else await el.click();};
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});
  result.boot=await page.evaluate(()=>({readyAtMs:performance.now(),worker:YardEngineClient.mode,heapBytes:performance.memory?.usedJSHeapSize,userAgent:navigator.userAgent}));assert.equal(result.boot.worker,'worker','the native workflow must use the actual Worker');
  await fixture(page);assert.match(await page.locator('body').getAttribute('class'),/designer-ui/);
  const camera=()=>page.evaluate(()=>{const c=window.__yard.view().cam;return {th:c.th,ph:c.ph,r:c.r,target:c.target.slice()}}),before=await camera();
  await press('[data-design-open="new"]');assert.equal(await page.locator('[data-design-mode]').count(),3);
  await press('[data-design-mode="horizontal"]');await page.locator('#panel').evaluate(el=>el.scrollTop=0);
  const bounds=await page.locator('#dock').boundingBox();assert.ok(bounds.y>50&&bounds.y+bounds.height<=profile.viewport.height,'drawer stays inside the viewport');
  result.drawer={bounds,preview:await page.locator('#designPartPreview').count()};assert.equal(result.drawer.preview,1);
  await page.screenshot({path:output.replace(/\.json$/,'.'+profile.name+'-drawer.jpg'),type:'jpeg',quality:75});
  await press('[data-design-action="arm"]');assert.deepEqual(await camera(),before,'opening and closing retains camera pose');
  const projected=await page.evaluate(()=>{const Y=window.__yard,v=Y.view();Y.draw();const p=v.project([50,10,12]);return {xy:p.slice(0,2),canvas:document.elementFromPoint(p[0],p[1])===v.canvas}});assert.equal(projected.canvas,true);
  const inputAt=Date.now();if(profile.touch)await page.touchscreen.tap(...projected.xy);else await page.mouse.click(...projected.xy);
  await page.locator('#designPlacementBar [data-design-action="confirm"]').waitFor();result.geometryValidationMs=Date.now()-inputAt;
  assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),1,'verified ghost stays uncommitted until confirmation');
  await page.screenshot({path:output.replace(/\.json$/,'.'+profile.name+'-ghost.jpg'),type:'jpeg',quality:75});
  await press('#designPlacementBar [data-design-action="confirm"]');await stable(page);
  result.placed=await page.evaluate(()=>{const Y=window.__yard,C=Y.C,p=Y.ship.parts.find(p=>p.placement),saved=C.serialize(Y.ship),round=C.deserialize(saved),q=round.parts.find(q=>q.id===p.id);return {parts:Y.ship.parts.length,id:p.id,mode:p.placement.mode,parentId:p.placement.parentStructureId,volume:C.partVolume(p),roundVolume:C.partVolume(q),contact:C.placementContact(round,q,round.parts.find(r=>r.id===q.placement.parentStructureId)).connected,sourceRetained:!!q.placement.requestedGeometry,format:saved.format,version:saved.v,glError:Y.view().gl.getError()}});
  assert.equal(result.placed.version,3);assert.equal(result.placed.parts,2);assert.equal(result.placed.parentId,1);assert.equal(result.placed.mode,'horizontal');assert.equal(result.placed.contact,true);assert.equal(result.placed.sourceRetained,true);assert.ok(Math.abs(result.placed.volume-result.placed.roundVolume)<1e-3);assert.equal(result.placed.glError,0);
  await press('#btnUndo');await stable(page);assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),1);await press('#btnRedo');await stable(page);assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),2);result.undoRedo=true;
  await press('[data-design-open="edit"]');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const childPoint=await page.evaluate(()=>{const Y=window.__yard,p=Y.ship.parts.find(p=>p.placement),b=Y.C.partAABB(p),T=Y.C.structTriangles(p),points=[[(b[0]+b[3])/2,b[4],(b[2]+b[5])/2]];for(let i=0;i<T.length;i+=9)points.push([0,1,2].map(a=>(T[i+a]+T[i+3+a]+T[i+6+a])/3));for(const q of points){const pixel=Y.view().project(q).slice(0,2);if(document.elementFromPoint(...pixel)===Y.view().canvas&&Y.pick(...pixel,{parts:true,fits:false})?.part?.id===p.id)return pixel;}throw Error('No visible selectable point on the placed child');});
  if(profile.touch)await page.touchscreen.tap(...childPoint);else await page.mouse.click(...childPoint);
  assert.equal(await page.evaluate(()=>window.__yard.st.sel?.id),result.placed.id,'native edit selects the actual new child');
  await press('[data-design-here]');
  await press('[data-design-mode="surface"]');await press('[data-design-action="arm"]');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const tapped=await page.evaluate(()=>{const Y=window.__yard;for(const x of [85,15,5,95])for(const z of [-12,12,-20,20]){const pixel=Y.view().project([x,10,z]).slice(0,2).map(Math.round),hit=Y.pick(...pixel,{parts:true,fits:false});if(document.elementFromPoint(...pixel)===Y.view().canvas&&(hit?.parentStructureId??hit?.part?.id)===1&&hit.n[1]>.99)return{pixel,parentId:1,surfaceId:hit.hostSurfaceId,p:hit.p};}throw Error('No unobscured root target for surface placement');});assert.equal(tapped.parentId,1);
  if(profile.touch)await page.touchscreen.tap(...tapped.pixel);else await page.mouse.click(...tapped.pixel);
  await page.locator('#designPlacementBar [data-design-action="confirm"]').waitFor();assert.equal(await page.locator('#designPlacementBar [data-design-parent-name]').getAttribute('data-parent-id'),'1','actual tap overrides the previous selected child as parent');
  assert.equal(await page.locator('#designPlacementBar [data-design-parent-name]').getAttribute('data-surface-id'),tapped.surfaceId);
  await press('#designPlacementBar [data-design-action="confirm"]');await stable(page);
  result.tapParent=await page.evaluate(()=>{const Y=window.__yard,p=Y.ship.parts.at(-1),parent=Y.ship.parts.find(q=>q.id===p.placement.parentStructureId);return{id:p.id,parentId:parent.id,mode:p.placement.mode,surfaceId:p.placement.hostSurfaceId,anchor:Y.C.worldStruct(parent,p.placement.surfaceAnchor)}});assert.equal(result.tapParent.parentId,1);assert.equal(result.tapParent.mode,'surface');assert.equal(result.tapParent.surfaceId,tapped.surfaceId);assert.ok(result.tapParent.anchor.every((v,i)=>Math.abs(v-tapped.p[i])<1e-5),'surface placement retains the exact tapped point');
  await press('[data-design-open="new"]');await press('[data-design-category="weapon"]');await press('[data-palpick="fit:pd"]');assert.equal(await page.locator('[data-design-mode]').count(),0,'ordinary fittings never offer structural modes');
  await press('[data-design-action="arm"]');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const weaponTap=await page.evaluate(()=>{const Y=window.__yard;for(const x of [18,82,5,95,50])for(const z of [-20,20,-12,12]){const pixel=Y.view().project([x,10,z]).slice(0,2).map(Math.round),hit=Y.pick(...pixel,{parts:true,fits:false});if(document.elementFromPoint(...pixel)===Y.view().canvas&&(hit?.parentStructureId??hit?.part?.id)===1&&hit.n[1]>.99)return pixel;}throw Error('No unobscured root target for weapon placement');});if(profile.touch)await page.touchscreen.tap(...weaponTap);else await page.mouse.click(...weaponTap);
  await page.locator('#designPlacementBar [data-design-action="confirm"]').waitFor();assert.equal(await page.evaluate(()=>window.__yard.ship.fits.length),0,'weapon ghost does not commit before confirmation');
  await press('#designPlacementBar [data-design-action="confirm"]');await stable(page);
  result.weapon=await page.evaluate(()=>{const Y=window.__yard,f=Y.ship.fits.at(-1),r=Y.C.deserialize(Y.C.serialize(Y.ship)).fits.find(q=>q.id===f.id);return{id:f.id,k:f.k,host:f.host,roundHost:r.host,p:f.p,roundP:r.p}});assert.equal(result.weapon.host,1);assert.equal(result.weapon.roundHost,1);assert.ok(result.weapon.p.every((v,i)=>Math.abs(v-result.weapon.roundP[i])<1e-5));
  await press('[data-design-open="new"]');
  await press('[data-design-space="interior"]');await press('[data-palpick="part:hangar"]');assert.deepEqual(await page.locator('[data-design-mode]').evaluateAll(es=>es.map(e=>e.dataset.designMode)),['clip','preserve-volume']);
  await press('[data-palpick="part:engineCore"]');assert.equal(await page.locator('[data-design-mode]').count(),0,'fixed machinery never offers deformation');
  await press('[data-design-action="close"]');assert.equal(await page.evaluate(()=>window.__yard.ship.parts.length),3,'dismissed configuration adds no part');
  if(!profile.touch){
   await press('#btnMenu');await page.locator('#sheet [data-language]').selectOption('en');await page.waitForFunction(()=>window.KS_EN&&document.documentElement.lang==='en');await press('#btnClose');
   await press('[data-design-space="exterior"]');await press('[data-design-open="new"]');
   assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test(await page.locator('#designMenu').innerText()),'new menu translates to English');
   assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test((await page.locator('[data-design-mode]').allTextContents()).join(' ')),'new modes translate to English');
   await press('[data-design-mode="vertical"]');await press('[data-design-action="arm"]');
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const top=await page.evaluate(()=>{const Y=window.__yard;for(const x of [5,15,30,70,95])for(const z of [20,-20]){const pixel=Y.view().project([x,10,z]).slice(0,2).map(Math.round),hit=Y.pick(...pixel,{parts:true,fits:false});if(document.elementFromPoint(...pixel)===Y.view().canvas&&(hit?.parentStructureId??hit?.part?.id)===1&&hit.n[1]>.99)return pixel;}throw Error('No exposed roof target for the invalid vertical-placement test');});await page.mouse.click(...top);await page.locator('#designPlacementBar[data-state="failed"]').waitFor();
   result.englishRejection=await page.locator('#designPlacementBar p').innerText();assert.ok(!/[\u3040-\u30ff\u3400-\u9fff]/.test(result.englishRejection),'strict failure reason translates to English');
   await press('#designPlacementBar [data-design-action="cancel"]');
  }
  result.final=await page.evaluate(()=>({heapBytes:performance.memory?.usedJSHeapSize,parts:window.__yard.ship.parts.length,worker:YardEngineClient.mode,glError:window.__yard.view().gl.getError()}));assert.equal(result.final.glError,0);assert.deepEqual(errors,[]);result.elapsedMs=Date.now()-began;result.errors=errors;result.warnings=warnings;result.status='PASS';return result;
 }catch(e){console.error(await page.evaluate(()=>({bar:document.querySelector('#designPlacementBar')?.innerText,parts:window.__yard?.ship?.parts.map(p=>({id:p.id,k:p.k,c:p.c}))})).catch(()=>({})));await page.screenshot({path:output.replace(/\.json$/,'.'+profile.name+'-failed.jpg'),type:'jpeg',quality:75}).catch(()=>{});throw e;}finally{await context.close();}
}
(async()=>{
 fs.mkdirSync(path.dirname(output),{recursive:true});const sourceSha256=hashes(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}),results=[];
 try{for(const p of [{name:'desktop',viewport:{width:1440,height:900},touch:false},{name:'touch-portrait',viewport:{width:390,height:844},touch:true},{name:'touch-landscape',viewport:{width:844,height:390},touch:true}]){results.push(await run(browser,p));console.log(p.name,'PASS');}
  assert.deepEqual(hashes(),sourceSha256,'runtime sources changed during verification; rerun against the final revision');fs.writeFileSync(output,JSON.stringify({status:'PASS',date:new Date().toISOString(),browser:browser.version(),graphics:'Chromium SwiftShader',sourceSha256,scope:'Native pointer/touch controls and actual Worker. Programmatic fixture seeding and camera projection only; no geometry, Worker or render substitution.',notVerified:['real iPhone hardware','Safari','large-ship interaction and memory under sustained editing'],results},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
