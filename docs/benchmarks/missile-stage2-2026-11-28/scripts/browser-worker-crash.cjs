// The engine worker crashes in the editor (an error event on it, then it is terminated): a fresh worker takes over, the page
// sends its whole design again, an edit afterwards is computed, and the trial starts. usage: node crash.cjs <root> <key> <outdir>
const fs=require('fs'),path=require('path'),http=require('http'),zlib=require('zlib');const root=path.resolve(process.argv[2]),key=process.argv[3],out=path.resolve(process.argv[4]);fs.mkdirSync(out,{recursive:true});
const raw0=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))).toString('utf8'));
const R={key,stages:[],errors:[],console:[]};const save=()=>fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(R,null,1));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.gz':'application/gzip','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404).end();return;}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const {chromium}=require('playwright');const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 const page=await (await browser.newContext({viewport:{width:1200,height:850},locale:'ja-JP'})).newPage();page.setDefaultTimeout(600000);page.on('pageerror',e=>R.errors.push(String(e)));page.on('console',m=>{if(/worker|inline|engine|restart/i.test(m.text()))R.console.push(m.type()+': '+m.text().slice(0,300));});
 const t0=Date.now(),stage=(s,x={})=>{R.stages.push({s,t:(Date.now()-t0)/1000,...x});console.log(s,JSON.stringify(x));save();};
 await page.addInitScript(seed=>{localStorage.clear();localStorage.setItem('yard.language','ja');localStorage.setItem('yard.draft3',JSON.stringify(seed));
  const W=window.Worker;window.__workers=[];window.Worker=class extends W{constructor(...a){super(...a);this.__n=window.__workers.length;this.__updates=0;window.__workers.push(this);}postMessage(m,t){if(m&&m.type==='update')this.__updates++;return super.postMessage(m,t);}};},raw0);
 await page.goto('http://127.0.0.1:'+server.address().port+'/?splash',{waitUntil:'domcontentloaded'});await page.locator('#splash.ready .splash-start').waitFor();await page.evaluate(()=>document.querySelector('#splash .splash-start').click());await page.waitForFunction(()=>window.__yard?.eng.ready);
 await page.locator('.tbig[data-title-mode="sandbox"]').click();await page.locator('.tbig[data-title-mode="design"]').click();await page.locator('[data-title="continue"]').click({noWaitAfter:true});
 const idle=()=>page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.stats&&Y.eng.gen>0&&!Y.eng.waiting&&Y.eng.statsGen>=Y.eng.gen&&Y.eng.geoGen>=Y.eng.gen&&document.querySelector('#title')?.hidden;});
 const state=()=>page.evaluate(()=>{const Y=window.__yard;return {mode:YardEngineClient.mode,gen:Y.eng.gen,sentGen:Y.eng.sentGen,statsGen:Y.eng.statsGen,geoGen:Y.eng.geoGen,waiting:Y.eng.waiting,workers:window.__workers.map(w=>({n:w.__n,updates:w.__updates})),mass:Y.stats?.mass};});
 await idle();stage('editor ready',await state());
 // the engine worker: the one the page sends its design updates to
 const crashed=await page.evaluate(()=>{const w=window.__workers.filter(w=>w.__updates>0).at(-1);if(!w)return null;w.terminate();w.onerror?.({message:'crash test (out of memory)',preventDefault(){}});return w.__n;});
 stage('crashed worker '+crashed,await state());
 await idle();stage('after restart: idle',await state());
 // an edit after the restart: the ship renamed (the page sends an update)
 const before=await page.evaluate(()=>window.__yard.stats?.mass);
 await page.evaluate(()=>{const Y=window.__yard;Y.ship.name=(Y.ship.name||'')+'（再開後の編集）';Y.touch();});
 await idle();stage('edit computed',{...(await state()),massBefore:before});
 await page.evaluate(()=>{window.__yard.trialStart({});});await page.waitForFunction(()=>window.__yard.trial.on&&window.__yard.trial.systemsUnit||!window.__yard.trial.busy&&!window.__yard.trial.on);
 R.trialOn=await page.evaluate(()=>window.__yard.trial.on);R.titleShown=await page.evaluate(()=>!document.querySelector('#title')?.hidden);stage('trial',{trialOn:R.trialOn,titleShown:R.titleShown,...(await state())});
 await page.screenshot({path:path.join(out,'trial-after-restart.png')});save();await browser.close();server.close();})().catch(e=>{R.errors.push('script: '+e.stack);save();console.error(e);process.exit(1);});
