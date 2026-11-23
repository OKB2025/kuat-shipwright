// Opens each remodel example in the real editor, records stats and worker mode, reloads it through the save format, screenshots.
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const url=process.argv[2],out=process.argv[3],keys=process.argv.slice(4);fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const page=await (await browser.newContext({viewport:{width:1400,height:900},locale:'ja-JP'})).newPage(),errors=[],res=[];
 page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(900000);await page.addInitScript(()=>localStorage.setItem('yard.language','ja'));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard&&window.__yard.C&&typeof YardEngineClient!=='undefined');
 const ready=()=>page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.stats&&Y.eng.geoGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen;},null,{timeout:900000});
 for(const key of keys){
  await page.evaluate(k=>window.__yard.openExample(k),key);await ready();await page.waitForTimeout(500);
  const a=await page.evaluate(k=>{const Y=window.__yard,S=Y.stats,s=Y.ship;return{key:k,name:s.name,worker:YardEngineClient.mode,parts:s.parts.length,fits:s.fits.length,mass:S.mass,accelG:S.accelG,floatFits:S.floatFits,floatingFits:S.ungrounded?.floatingFits||[],ungrounded:S.ungrounded?.fits||[],stores:s.fits.filter(f=>Y.C.FITS[f.k]?.store).map(f=>f.k+'#'+f.id+(f.float?' float':'')),rolls:k==='craft_ywing'?[60,62,71,73].map(i=>s.parts.find(p=>p.id===i)?.roll):null,warnings:(S.warnings||[]).map(w=>w.text||w)};},key);
  await page.screenshot({path:path.join(out,key+'.png')});
  const saved=await page.evaluate(()=>JSON.stringify(window.__yard.C.serialize(window.__yard.ship)));
  await page.evaluate(t=>window.__yard.setShip(window.__yard.C.deserialize(JSON.parse(t))),saved);await ready();await page.waitForTimeout(300);
  a.reload=await page.evaluate(k=>{const Y=window.__yard,S=Y.stats,s=Y.ship;return{parts:s.parts.length,fits:s.fits.length,mass:S.mass,accelG:S.accelG,floatFits:S.floatFits,floatingFits:S.ungrounded?.floatingFits||[],rolls:k==='craft_ywing'?[60,62,71,73].map(i=>s.parts.find(p=>p.id===i)?.roll):null};},key);
  res.push(a);process.stderr.write(key+' '+a.worker+' mass '+a.mass.toFixed(2)+'→'+a.reload.mass.toFixed(2)+' float '+a.floatFits+'/'+a.reload.floatFits+'\n');
 }
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({errors,res},null,1));await browser.close();})().catch(e=>{console.error(e);process.exit(1);});
