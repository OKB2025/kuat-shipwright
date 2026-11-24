// The flown ship's missiles in the 公試 sandbox battle go into the battle (C.manualMissileFire). usage: node check.cjs <url> <outdir>
const {chromium}=require('playwright'),http=require('http'),fs=require('fs'),path=require('path');const [rootArg,out]=process.argv.slice(2),root=path.resolve(rootArg);
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.gz':'application/gzip','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm'};
const server=http.createServer((req,res)=>{const pn=decodeURIComponent(new URL(req.url,'http://l').pathname),f=path.resolve(root,'.'+(pn==='/'?'/index.html':pn));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/?splash';const br=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const pg=await br.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});const logs=[];pg.on('console',m=>{if(m.type()==='error')logs.push(m.text());});pg.on('pageerror',e=>logs.push('pageerror '+e.message));
 await pg.addInitScript(()=>{try{localStorage.clear();localStorage.setItem('yard.language','ja');}catch(e){}});await pg.goto(url,{waitUntil:'domcontentloaded'});await pg.locator('#splash.ready .splash-start').waitFor({timeout:180000});await pg.evaluate(()=>document.querySelector('#splash .splash-start').click());await pg.waitForFunction(()=>window.__yard?.openExample,null,{timeout:120000});
 const key=process.env.K||'venator';await pg.evaluate(k=>window.__yard.openExample(k),key);await pg.waitForFunction(()=>window.__yard.stats,null,{timeout:300000});
 await pg.evaluate(()=>window.__yard.trialStart());await pg.waitForFunction(()=>window.__yard.trial.on&&window.__yard.trial.asset,null,{timeout:300000});
 await pg.waitForFunction(()=>window.__yard.trial.battle?.b?.units?.some(u=>u.trialTarget!=null),null,{timeout:300000});
 const st=()=>pg.evaluate(()=>{const t=window.__yard.trial,me=t.battle?.me;return {meId:me?.id,meMods0:me?.mods?.[0],meAmmo:(me?.ammo||[]).reduce((a,b)=>a+b,0),mode:t.mode,battle:!!t.battle,targets:t.battle?t.battle.b.units.filter(u=>u.trialTarget!=null&&!u.dead).length:0,units:t.battle?t.battle.b.units.length:0,jump:t.jump?.phase||null,sys:t.sysKey,escorts:(t.escorts||[]).length,toast:[...document.querySelectorAll('.toast,#toast')].map(e=>e.textContent).slice(-1)[0]||''};});
 const log=[];log.push(['start',await st()]);
 await pg.evaluate(()=>window.__yard.trialCommand('reset'));await pg.waitForTimeout(500);log.push(['reset',await st()]);
 await pg.waitForFunction(()=>window.__yard.trial.battle?.b?.units?.some(u=>u.trialTarget!=null&&!u.dead),null,{timeout:300000});
 await pg.evaluate(()=>{const me=window.__yard.trial.battle.me;me.mods[0]=0;me.ammo=me.ammo.map(()=>0);});log.push(['damaged',await st()]);
 const here=await pg.evaluate(()=>window.__yard.trial.sysKey);await pg.evaluate(h=>window.__yard.trialCommand('jump:'+h),here);await pg.waitForTimeout(1500);log.push(['jump to here (refused)',await st()]);
 const dest=process.env.DEST||'kuat';await pg.evaluate(d=>window.__yard.trialCommand('jump:'+d),dest);await pg.waitForTimeout(1500);log.push(['jump ordered',await st()]);
 for(let i=0;i<60;i++){await pg.waitForTimeout(5000);const x=await st();if(i%6===0)log.push(['t'+(i*5),x]);if(!x.jump&&x.sys===dest&&x.targets>0){log.push(['arrived',x]);break;}}
 log.push(['end',await st()]);console.log(JSON.stringify(log,null,0));await pg.screenshot({path:out+'/jump.png'});await br.close();server.close();return;
 await pg.screenshot({path:out+'/'+key+'-'+dist+'km.png'});
 const notes=await pg.evaluate(()=>[...document.querySelectorAll('.toast,#toast')].map(e=>e.textContent).slice(-5));
 console.log(JSON.stringify({key,dist,before,fired,notes,errors:logs.slice(0,10)},null,1));await br.close();server.close();})().catch(e=>{console.error(e);process.exit(1);});
