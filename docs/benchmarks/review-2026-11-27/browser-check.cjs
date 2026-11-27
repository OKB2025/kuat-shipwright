// Browser check for the reviews of 2026-11-27, on the final state: the X-wing and B-wing examples with the nozzle part (whole, the muzzles
// close up, the X-wing's S-foils open and stowed), whether the page takes the structures' record saved with the example (Chromium) and what
// the first edit of a structure then costs, the TIE Avenger's open time, and two missile orders in a row in the trial (the second order's
// first round leaves at once). usage: node browser-check.cjs <url> <outdir>   (writes report.json and images to <outdir>)
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');const url=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});const report={errors:[],steps:[]};
 page.on('pageerror',e=>report.errors.push('pageerror: '+String(e.message).slice(0,300)));page.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))report.errors.push('console: '+m.text().slice(0,300));});
 const settled=()=>page.waitForFunction(()=>{const Y=window.__yard;return Y&&Y.eng&&!Y.eng.error&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.geoGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&!!Y.stats;},null,{timeout:900000});
 const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const shot=async(name,cam)=>{if(cam)await page.evaluate(c=>{const v=window.__yard.view();Object.assign(v.cam,c);window.__yard.draw();},cam);await frame();await page.waitForTimeout(600);await page.screenshot({path:path.join(out,name)});};
 const facts=()=>page.evaluate(()=>{const Y=window.__yard,C=Y.C,S=Y.stats,s=Y.ship;
  const copy=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));let t=performance.now();const r=C.structuralMaterial(copy),recordMs=performance.now()-t;
  const moved=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));const q=moved.parts.find(p=>p.k==='struct'&&!C.isHullStructure(p));if(q)q.c[0]+=.01;t=performance.now();const e=C.structuralMaterial(moved),editMs=performance.now()-t;
  const guns=s.fits.filter(f=>f.nozzle==='track').map(f=>{const o=C.fitOrigin(f),fr=C.fitFrameOf(f);return o.map((v,a)=>v+fr.fw[a]*(f.barrelM||1));});
  return {name:s.name,mass:S.mass,cost:S.cost,float:s.fits.filter(f=>f.float).length+s.parts.filter(p=>p.float).length,warnings:(S.warnings||[]).filter(w=>w.lv==='bad'||w.lv==='warn').map(w=>w.text.slice(0,60)),
   savedRecord:!!s._structuralRecord,fromRecord:!!r.fromRecord,recordMs:Math.round(recordMs),firstEditFromRecord:!!e.fromRecord,firstEditMs:Math.round(editMs),muzzles:guns};});
 try{await page.goto(url);await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());
  for(const key of ['craft_xwing','craft_bwing','craft_tie_avenger']){const t0=Date.now();await page.evaluate(k=>window.__yard.openExample(k),key);await settled();const f=await facts();report.steps.push({step:'open '+key,seconds:(Date.now()-t0)/1000,...f});
   await shot(key+'.png');if(key==='craft_tie_avenger')continue;
   const m=f.muzzles[0];if(m)await shot(key+'-muzzle.png',{th:.9,ph:1.2,r:4,target:m});
   if(key==='craft_xwing'){await shot('xwing-foils-open.png',{th:1.2,ph:1.15,r:24,target:[6.5,1.2,0]});await page.keyboard.press('KeyO');await page.waitForTimeout(900);await shot('xwing-foils-stowed.png');if(m)await shot('xwing-foils-stowed-muzzle.png',{th:.9,ph:1.2,r:4,target:m});await page.keyboard.press('KeyO');await page.waitForTimeout(600);}}
  // two missile orders in a row on 2 by 2 cell launchers (the drone range: a fresh page)
  await page.reload();await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());await page.evaluate(()=>window.__yard.openExample('arquitens'));await settled();
  await page.evaluate(()=>{const Y=window.__yard,C=Y.C,s=C.deserialize(C.serialize(Y.ship));for(const f of s.fits)if(f.k==='shipMsl'){f.launcherCols=2;f.launcherRows=2;}Y.setShip(s);});await settled();
  await page.evaluate(()=>window.__yard.trialStart({}));await page.waitForFunction(()=>window.__yard.trial.on&&!window.__yard.trial.busy,null,{timeout:900000});
  report.steps.push({step:'two missile orders, 2 by 2 cells',...await page.evaluate(()=>{const Y=window.__yard,t=Y.trial;for(const q of t.launchers.slice(1))q.blocked=true;const l=t.launchers[0],log=[];let before=t.missiles.length,time=0;
   const run=steps=>{for(let s=0;s<steps;s++){Y.trialStep(.05);time+=.05;const now=t.missiles.length;if(now>before)log.push({t:+time.toFixed(2),rounds:now-before,cell:t.missiles[now-1].cell});before=now;}};
   Y.trialCommand('missile');run(40);const second=+time.toFixed(2);Y.trialCommand('missile');run(40);return {battle:!!t.battle?.b,firstOrderAt:0,secondOrderAt:second,launches:log};})});
 }catch(e){report.errors.push('script: '+String(e.message).slice(0,400));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));await browser.close();console.log(JSON.stringify(report).slice(0,4000));})();
