#!/usr/bin/env node
// v24 Whole-design scaling in the real editor and Worker (docs/ship-scaling-v24.md): open the Imperial-class example,
// scale it to 2,200 m from the design sheet's card, compare the editor's stats before and after, and check Undo/Redo.
// Usage: node scripts/browser-ship-scaling.cjs http://127.0.0.1:8765/ OUTPUT_DIR [structures] [interior]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const url=process.argv[2],out=process.argv[3],structures=process.argv[4]||'scale',interior=process.argv[5]||'scale';
if(!url||!out){console.error('usage: browser-ship-scaling.cjs URL OUTPUT_DIR [structures] [interior]');process.exit(2);}
const stable=p=>p.waitForFunction(()=>{const Y=window.__yard;return Y?.ship&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&Y.stats;},null,{timeout:600000});
const facts=p=>p.evaluate(()=>{const Y=window.__yard,C=Y.C,S=Y.stats,h=C.primaryHullPart(Y.ship);return {hull:h.s.slice(),parts:Y.ship.parts.length,fits:Y.ship.fits.length,floatingFits:Y.ship.fits.filter(f=>f.float).map(f=>f.id),ungrounded:S?.ungrounded||null,warnings:(S?.warnings||[]).filter(w=>w.lv==='bad').map(w=>w.text),mass:S?.mass,volume:S?.volume,area:S?.area};});
(async()=>{
 fs.mkdirSync(out,{recursive:true});const exe=process.env.CHROMIUM_PATH;const browser=await chromium.launch(exe?{executablePath:exe,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}:{});
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[],log={structures,interior,checks:[]};page.on('pageerror',e=>errors.push(String(e)));
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});log.engine=await page.evaluate(()=>YardEngineClient.mode);
  await page.evaluate(()=>{window.__yard.title.hide?.();return window.__yard.openExample('imperial');});await stable(page);
  log.before=await facts(page);assert.equal(log.before.hull[0],1600);
  // The command lives in the design sheet (設計図), opened from the header button.
  await page.screenshot({path:path.join(out,'before.jpg'),type:'jpeg',quality:80});
  await page.locator('#btnMenu').click();const sheet=page.locator('#shipScaleSheet'),card=sheet.locator('[data-ship-scale]');await card.waitFor({timeout:60000});await card.scrollIntoViewIfNeeded();
  if(structures==='keep')await sheet.locator('[data-ship-scale-structures="keep"]').click();if(interior==='keep')await sheet.locator('[data-ship-scale-interior="keep"]').click();
  const input=sheet.locator('[data-ship-scale-length]');await input.fill('2200');await input.press('Tab');
  log.preview=await sheet.locator('[data-ship-scale-preview]').innerText();assert.match(log.preview,/2,200 m/);await sheet.locator('[data-ship-scale]').screenshot({path:path.join(out,'card-preview.png')});
  const t0=Date.now();await sheet.locator('[data-ship-scale-apply]').click();
  await page.waitForFunction(()=>{const Y=window.__yard;return Y.C.primaryHullPart(Y.ship).s[0]===2200;},null,{timeout:600000});log.workerMs=Date.now()-t0;await stable(page);
  log.after=await facts(page);log.report=await page.evaluate(()=>{const el=document.querySelector('#shipScaleSheet [data-ship-scale-report]');return el?el.innerText:null;});
  await sheet.locator('[data-ship-scale]').screenshot({path:path.join(out,'card-after.png')});await page.locator('#btnClose').click();await page.screenshot({path:path.join(out,'after.jpg'),type:'jpeg',quality:80});
  assert.deepEqual(log.after.hull.map(v=>+v.toFixed(6)),log.before.hull.map(v=>+(v*2200/1600).toFixed(6)));assert.equal(log.after.parts,log.before.parts);assert.equal(log.after.fits,log.before.fits);
  log.checks.push('scaled hull, nothing added or removed');
  await page.locator('#btnUndo').click();await page.waitForFunction(()=>{const Y=window.__yard;return Y.C.primaryHullPart(Y.ship).s[0]===1600;},null,{timeout:120000});await stable(page);log.undo=await facts(page);log.checks.push('undo');
  await page.locator('#btnRedo').click();await page.waitForFunction(()=>{const Y=window.__yard;return Y.C.primaryHullPart(Y.ship).s[0]===2200;},null,{timeout:120000});await stable(page);log.redo=await facts(page);log.checks.push('redo');
  await page.screenshot({path:path.join(out,'redo.jpg'),type:'jpeg',quality:80});
  log.errors=errors;log.status='ok';
 }catch(e){log.status='failed';log.error=String(e&&e.stack||e);log.errors=errors;await page.screenshot({path:path.join(out,'failed.jpg'),type:'jpeg',quality:70}).catch(()=>{});process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(log,null,1));await browser.close();}
})();
