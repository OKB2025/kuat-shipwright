// Browser check for 2026-11-27「ミサイルは基本1発ずつ発射されるように」: opens the Arquitens example (cell launchers), starts the trial
// (drone range, no battle), orders one missile launch and steps the trial in 0.05 s steps, recording when each round leaves.
// usage: node browser-check.cjs <url> <outdir>
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');const url=process.argv[2],out=process.argv[3]||__dirname;fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});const report={errors:[],launches:[]};
 page.on('pageerror',e=>report.errors.push('pageerror: '+String(e.message).slice(0,300)));page.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))report.errors.push('console: '+m.text().slice(0,300));});
 const settled=()=>page.waitForFunction(()=>{const Y=window.__yard;return Y&&Y.eng&&!Y.eng.error&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&!!Y.stats;},null,{timeout:600000});
 try{await page.goto(url);await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());
  await page.evaluate(()=>window.__yard.openExample('arquitens'));await settled();
  await page.evaluate(()=>window.__yard.trialStart({}));await page.waitForFunction(()=>window.__yard.trial.on&&!window.__yard.trial.busy,null,{timeout:600000});
  const r=await page.evaluate(()=>{const Y=window.__yard,t=Y.trial,info=t.launchers.map(l=>({kind:l.kind,cycle:l.cycle,cells:(l.cellAmmo||[]).length||l.salvo,ammo:l.ammo}));
   for(const l of t.launchers){l.reload=0;l.queue=0;}Y.trialCommand('missile');const launches=[];let before=t.missiles.length;
   for(let s=0;s<60;s++){Y.trialStep(.05);const now=t.missiles.length;if(now>before)launches.push({t:+(s*.05).toFixed(2),rounds:now-before});before=now;}
   return {info,launches,after:t.launchers.map(l=>({reload:l.reload,queue:l.queue})),toast:toast?toast.textContent:null};});
  report.single=r;
  // A four-cell launcher: the example's launchers become 2 by 2 cell launchers and the design is reloaded (the examples carry single-cell ones).
  await page.reload();await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());await page.evaluate(()=>window.__yard.openExample('arquitens'));await settled();
  await page.evaluate(()=>{const Y=window.__yard,C=Y.C,s=C.deserialize(C.serialize(Y.ship));for(const f of s.fits)if(f.k==='shipMsl'){f.launcherCols=2;f.launcherRows=2;}Y.setShip(s);});await settled();
  await page.evaluate(()=>window.__yard.trialStart({}));await page.waitForFunction(()=>window.__yard.trial.on&&!window.__yard.trial.busy,null,{timeout:600000});
  report.four=await page.evaluate(()=>{const Y=window.__yard,t=Y.trial,info=t.launchers.map(l=>({kind:l.kind,cycle:l.cycle,salvo:l.salvo,ammo:l.ammo}));for(const q of t.launchers.slice(1))q.blocked=true;
   Y.trialCommand('missile');const launches=[];let before=t.missiles.length;
   for(let s=0;s<60;s++){Y.trialStep(.05);const now=t.missiles.length;if(now>before)launches.push({t:+(s*.05).toFixed(2),rounds:now-before,cell:t.missiles[now-1].cell});before=now;}
   return {info,launches,after:t.launchers.map(l=>({reload:l.reload,queue:l.queue})),toast:toast?toast.textContent:null};});
await page.screenshot({path:path.join(out,'arquitens-trial-missiles.png')});
 }catch(e){report.errors.push('script: '+String(e.message).slice(0,400));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));await browser.close();console.log(JSON.stringify(report));})();
