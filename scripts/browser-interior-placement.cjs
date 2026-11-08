#!/usr/bin/env node
// Real canvas picks, selected hosts and explicit placement confirmation.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const url=process.argv[2]||'http://127.0.0.1:8000/',output=path.resolve(process.argv[3]||path.join(__dirname,'../docs/benchmarks/interior-placement-browser.json'));
const root=path.resolve(__dirname,'..'),files=['index.html','js/app.js','js/core.js','js/gfx.js','js/engine.js','js/design-ui.css','js/lang-en.js','scripts/browser-interior-placement.cjs'],hashes=()=>Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const stable=p=>p.waitForFunction(()=>{const Y=window.__yard;return Y?.eng.adoptedGen>=Y?.eng.gen&&Y.eng.statsGen>=Y.eng.gen},null,{timeout:120000});
async function fixture(p,room=[20,20,20],diameter=10){
 await p.evaluate(({room,diameter})=>{const Y=window.__yard,C=Y.C,s=C.newShip({L:100,W:60,H:40,assembly:true},'Interior browser acceptance');s.parts=[{id:1,k:'struct',form:'box',c:[50,0,0],s:[100,60,40]}];s.nextId=2;s.fits=[];s.armor={hull:0,cit:0};Y.setShip(s);Y.title.hide();Object.assign(Y.st,{mirror:false,vmirror:false,roomSize:room});Y.st.size.battery=diameter;Object.assign(Y.view().cam,{ortho:true,r:155,th:.7,ph:.7});Y.draw();},{room,diameter});await stable(p);
 await p.locator('[data-design-space="interior"]').click();await p.locator('[data-design-open="new"]').click();
}
async function place(p,{kind,mode,point=[50,20,0],success=true}){
 await p.locator('[data-palpick="part:'+kind+'"]').click();await p.locator('[data-design-host]').selectOption('1');
 if(mode)await p.locator('[data-design-mode="'+mode+'"]').click();
 await p.locator('[data-design-interior-depth]').fill('5');await p.locator('[data-design-interior-depth]').dispatchEvent('change');
 const modes=await p.locator('[data-design-mode]').evaluateAll(es=>es.map(e=>e.dataset.designMode));
 await p.locator('[data-design-action="arm"]').click();
 const xy=await p.evaluate(point=>{const Y=window.__yard;Y.draw();const q=Y.view().project(point);if(document.elementFromPoint(q[0],q[1])!==Y.view().canvas)throw Error('Canvas pick is covered');return q.slice(0,2);},point);
 await p.mouse.click(...xy);
 await p.locator('#designPlacementBar[data-state="'+(success?'ready':'failed')+'"]').waitFor();
 const result={kind,mode:mode||'direct',modes,status:success?'PASS':'EXPECTED_REJECTION',reason:(await p.locator('#designPlacementBar p').textContent()).trim()};
 assert.equal(await p.evaluate(()=>window.__yard.ship.parts.length),1,'preview never commits before confirmation');
 if(success){await p.locator('#designPlacementBar [data-design-action="confirm"]').click();await stable(p);result.part=await p.evaluate(()=>{const Y=window.__yard,C=Y.C,p=Y.ship.parts.find(p=>p.id!==1),s=C.serialize(Y.ship),round=C.deserialize(s);C.syncCompartments(round);const q=round.parts.find(q=>q.id===p.id);return{id:p.id,k:p.k,c:p.c,d:p.d,mode:p.placement.mode,hostId:p.placement.hostId,requestedVolume:C.partVolume(p.placement.requestedGeometry),effectiveVolume:C.partVolume(p),reloadVolume:C.partVolume(q),glError:Y.view().gl.getError()};});assert.equal(result.part.hostId,1);assert.ok(Math.abs(result.part.effectiveVolume-result.part.reloadVolume)<.01);assert.equal(result.part.glError,0);}else{assert.equal(await p.locator('#designPlacementBar [data-design-action="confirm"]').count(),0);await p.locator('#designPlacementBar [data-design-action="cancel"]').click();}
 return result;
}
(async()=>{const sourceSha256=hashes(),browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],results=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(45000);
 try{await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:120000});const worker=await page.evaluate(()=>YardEngineClient.mode);if(process.env.REQUIRE_WORKER!=='0')assert.equal(worker,'worker','use the actual Worker against final asset hashes');
  await fixture(page);results.push(await place(page,{kind:'cargo',mode:'clip',point:[95,20,0]}));assert.ok(Math.abs(results[0].part.effectiveVolume-6000)<.2);assert.ok(Math.abs(results[0].part.c[1]-4)<.01,'the requested additional 5m interior offset reaches Core');
  await fixture(page,[300,100,80]);results.push(await place(page,{kind:'cargo',mode:'preserve-volume',success:false}));
  await fixture(page,[300,100,80],100);results.push(await place(page,{kind:'battery',success:false}));assert.deepEqual(results.at(-1).modes,[]);
  await fixture(page,[10,10,10],10);results.push(await place(page,{kind:'battery'}));assert.equal(results.at(-1).part.d,10);assert.ok(Math.abs(results.at(-1).part.effectiveVolume-1000)<1e-6);assert.deepEqual(errors,[]);
  assert.deepEqual(hashes(),sourceSha256,'runtime changed during verification');fs.mkdirSync(path.dirname(output),{recursive:true});await page.screenshot({path:output.replace(/\.json$/,'.jpg'),type:'jpeg',quality:80});fs.writeFileSync(output,JSON.stringify({status:'PASS',date:new Date().toISOString(),browser:browser.version(),worker,sourceSha256,scope:'Native mouse selections, real host surface raycast, strict geometry through YardEngine, explicit confirmation, save/reload. Programmatic seed and camera projection only.',notVerified:['Safari','real iPhone hardware'],results,errors},null,2)+'\n');console.log(JSON.stringify({status:'PASS',worker,cases:results.length,output}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
