// Browser check: a saved user design is the first item the background preloader prepares (real Worker), and it completes.
// usage: node check.cjs <url> <outdir>
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const url=process.argv[2],out=process.argv[3];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(600000);
await page.addInitScript(()=>{try{if(!localStorage.getItem('yard.language'))localStorage.setItem('yard.language','ja')}catch(e){}window.__prog=[];addEventListener('ks-preload-progress',e=>window.__prog.push({t:Date.now(),...e.detail}));});
await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:300000});await page.evaluate(()=>window.__yard.title?.hide?.());
await page.evaluate(()=>{window.__prevShip=window.__yard.ship;window.__yard.openExample('cr90')});await page.waitForFunction(()=>window.__yard.ship&&window.__yard.ship!==window.__prevShip,null,{timeout:600000});
await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.stats&&Y.eng.statsGen>=Y.eng.gen;},null,{timeout:1200000});
await page.evaluate(()=>document.querySelector('#btnSave').click());await page.waitForTimeout(5000);
const res={saveId:await page.evaluate(()=>window.__yard.ship.saveId)};
const t0=Date.now();await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>{const p=window.__prog;const l=p[p.length-1];return l&&(l.ready+l.failed>=1||['unavailable','stopped'].includes(l.phase));},null,{timeout:3000000});
res.seconds=Math.round((Date.now()-t0)/1000);res.progress=await page.evaluate(()=>window.__prog.map(p=>({phase:p.phase,ready:p.ready,failed:p.failed,total:p.total,current:p.current,lastError:p.lastError||null})));
res.firstKey=res.progress.find(p=>p.current)?.current||null;res.firstIsSave=String(res.firstKey||'').startsWith('save:'+res.saveId);
res.status=await page.evaluate(()=>document.getElementById('preloadStatus')?.textContent||null);res.errors=errors;
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(res,null,1));console.log(JSON.stringify({...res,progress:res.progress.slice(-6)},null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
