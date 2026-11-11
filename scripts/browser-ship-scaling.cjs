#!/usr/bin/env node
// v24 Whole-design scaling in the real editor and Worker (docs/ship-scaling-v24.md). Opens the Imperial-class example
// and checks, writing everything to OUTPUT_DIR (required):
//  1. a scaling whose result is discarded (the design changes while the Worker computes), followed by a small
//     fittings edit: the statistics must equal the original's (the Worker copy is replaced, not patched);
//  2. scaling to 2,200 m from the design sheet's card, Undo and Redo;
//  3. saving to the browser, reloading the page and opening the save: the statistics must be identical;
//  4. screenshots of the card at 390 px width in Japanese and English.
// Usage: node scripts/browser-ship-scaling.cjs http://127.0.0.1:PORT/ OUTPUT_DIR [structures] [interior]
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const url=process.argv[2],out=process.argv[3],structures=process.argv[4]||'scale',interior=process.argv[5]||'scale';
if(!url||!out){console.error('usage: browser-ship-scaling.cjs URL OUTPUT_DIR [structures] [interior]');process.exit(2);}
const stable=p=>p.waitForFunction(()=>{const Y=window.__yard;return Y?.ship&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&Y.stats;},null,{timeout:600000});
const facts=p=>p.evaluate(()=>{const Y=window.__yard,C=Y.C,S=Y.stats,h=C.primaryHullPart(Y.ship);return {hull:h.s.slice(),parts:Y.ship.parts.length,fits:Y.ship.fits.length,floatingFits:Y.ship.fits.filter(f=>f.float).map(f=>f.id),ungrounded:S?.ungrounded||null,warnings:(S?.warnings||[]).map(w=>w.lv+': '+w.text),mass:S?.mass,volume:S?.volume,area:S?.area,maximumAccelG:S?.maximumAccelMps2/9.80665};});
const same=(a,b,what)=>{for(const k of ['mass','volume','area','maximumAccelG'])assert.ok(Math.abs(a[k]-b[k])<=1e-9*Math.max(1,Math.abs(b[k])),`${what} ${k}: ${a[k]} != ${b[k]}`);};
const hullIs=(p,L)=>p.waitForFunction(L=>{const Y=window.__yard;return Y.C.primaryHullPart(Y.ship).s[0]===L;},L,{timeout:600000});
async function openPage(browser,{width=1400,height=900,language='en'}={}){const context=await browser.newContext({viewport:{width,height}});await context.addInitScript(l=>{try{if(!localStorage.getItem('ks-test-language-set')){localStorage.setItem('yard.language',l);localStorage.setItem('ks-test-language-set','1');}}catch(e){}},language);const page=await context.newPage();return {context,page};}
async function ready(page){await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const exe=process.env.CHROMIUM_PATH;const browser=await chromium.launch(exe?{executablePath:exe,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']}:{});
 const log={structures,interior,checks:[]},errors=[];let {context,page}=await openPage(browser);page.on('pageerror',e=>errors.push(String(e)));
 try{
  await ready(page);log.engine=await page.evaluate(()=>YardEngineClient.mode);
  await page.evaluate(()=>{window.__yard.title.hide?.();return window.__yard.openExample('imperial');});await stable(page);
  log.before=await facts(page);assert.equal(log.before.hull[0],1600);await page.screenshot({path:path.join(out,'before.jpg'),type:'jpeg',quality:80});
  const sheet=page.locator('#shipScaleSheet'),card=sheet.locator('[data-ship-scale]');
  const openCard=async()=>{await page.locator('#btnMenu').click();await card.waitFor({timeout:60000});await card.scrollIntoViewIfNeeded();};
  // 1. A discarded result: the name changes while the Worker computes, then a small fittings edit.
  await openCard();await sheet.locator('[data-ship-scale-length]').fill('2200');await sheet.locator('[data-ship-scale-length]').press('Tab');
  await sheet.locator('[data-ship-scale-apply]').click();await page.evaluate(()=>{window.__yard.ship.name+=' *';});
  await page.waitForFunction(()=>/設計が変更されました|The design changed/.test(document.querySelector('#shipScaleSheet [data-ship-scale-error]')?.textContent||''),null,{timeout:600000});
  await page.locator('#btnClose').click();await page.evaluate(()=>{const Y=window.__yard,f=Y.ship.fits.find(f=>!f.trenchAggregate);f.assetYaw=(f.assetYaw||0)+0;Y.touch('fits');});await page.waitForTimeout(300);await stable(page);
  log.discarded=await facts(page);same(log.discarded,log.before,'after a discarded result');assert.equal(log.discarded.hull[0],1600);log.checks.push('discarded result leaves the Worker on the original design');
  // 2. Scale, Undo, Redo.
  await openCard();if(structures==='keep')await sheet.locator('[data-ship-scale-structures="keep"]').click();if(interior==='keep')await sheet.locator('[data-ship-scale-interior="keep"]').click();
  await sheet.locator('[data-ship-scale-length]').fill('2200');await sheet.locator('[data-ship-scale-length]').press('Tab');
  log.preview=await sheet.locator('[data-ship-scale-preview]').innerText();assert.match(log.preview,/2,200 m/);await card.screenshot({path:path.join(out,'card-preview.png')});
  const t0=Date.now();await sheet.locator('[data-ship-scale-apply]').click();await hullIs(page,2200);log.workerMs=Date.now()-t0;await stable(page);
  log.after=await facts(page);log.report=await page.evaluate(()=>document.querySelector('#shipScaleSheet [data-ship-scale-report]')?.innerText||null);
  await page.locator('#btnClose').click();await page.locator('#btnMenu').click();await card.waitFor();log.reportAfterStats=await page.evaluate(()=>document.querySelector('#shipScaleSheet [data-ship-scale-report]')?.innerText||null);
  await card.screenshot({path:path.join(out,'card-after.png')});await page.locator('#btnClose').click();await page.screenshot({path:path.join(out,'after.jpg'),type:'jpeg',quality:80});
  assert.deepEqual(log.after.hull.map(v=>+v.toFixed(6)),log.before.hull.map(v=>+(v*2200/1600).toFixed(6)));assert.equal(log.after.parts,log.before.parts);assert.equal(log.after.fits,log.before.fits);log.checks.push('scaled hull, nothing added or removed');
  await page.locator('#btnUndo').click();await hullIs(page,1600);await stable(page);log.undo=await facts(page);same(log.undo,log.before,'undo');log.checks.push('undo restores the original statistics');
  await page.locator('#btnRedo').click();await hullIs(page,2200);await stable(page);log.redo=await facts(page);same(log.redo,log.after,'redo');log.checks.push('redo restores the scaled statistics');
  // 3. Save, reload the page, open the save.
  await page.locator('#btnMenu').click();await page.locator('#btnSave').click();await page.locator('#saves [data-load]').first().waitFor({timeout:60000});
  await ready(page);await page.evaluate(()=>window.__yard.title.hide?.());await page.locator('#btnMenu').click();await page.locator('#saves [data-load]').first().click();await hullIs(page,2200);await page.waitForTimeout(300);await stable(page);
  log.reloaded=await facts(page);same(log.reloaded,log.after,'saved and reloaded');log.checks.push('saved, reloaded and reopened with identical statistics');
  await context.close();
  // 4. The card at phone width, Japanese and English.
  for(const language of ['ja','en']){({context,page}=await openPage(browser,{width:390,height:844,language}));page.on('pageerror',e=>errors.push(String(e)));await ready(page);
   await page.evaluate(()=>{window.__yard.title.hide?.();return window.__yard.openExample('imperial');});await stable(page);await page.locator('#btnMenu').click();
   const c=page.locator('#shipScaleSheet [data-ship-scale]');await c.waitFor({timeout:60000});await c.scrollIntoViewIfNeeded();const box=await c.boundingBox();log['card390'+language]={width:box.width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth)};
   await c.screenshot({path:path.join(out,'card-390-'+language+'.png')});await context.close();}
  log.checks.push('card screenshots at 390 px (ja, en)');
  log.errors=errors;log.status='ok';
 }catch(e){log.status='failed';log.error=String(e&&e.stack||e);log.errors=errors;await page.screenshot({path:path.join(out,'failed.jpg'),type:'jpeg',quality:70}).catch(()=>{});process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(log,null,1));await browser.close();}
})();
