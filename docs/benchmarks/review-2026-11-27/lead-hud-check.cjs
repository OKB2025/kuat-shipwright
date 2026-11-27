// usage: node check.cjs <url> <outdir> : X-wing trial, cockpit view, aim at a drone, read the lead mark ([data-th="lead"]) and the pilot's fire discipline.
const CAMS=['cockpit','ship'];const fs=require('fs'),path=require('path'),{chromium}=require('playwright');const url=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch(),page=await b.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});const rep={errors:[],steps:[]};
 page.on('pageerror',e=>rep.errors.push('pageerror: '+String(e.message).slice(0,300)));page.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|Failed to load resource/.test(m.text()))rep.errors.push('console: '+m.text().slice(0,300));});
 try{await page.goto(url);await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());
  await page.evaluate(()=>window.__yard.openExample('craft_xwing'));
  await page.waitForFunction(()=>{const Y=window.__yard;return Y&&Y.eng&&!Y.eng.error&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&!!Y.stats;},null,{timeout:900000});
  await page.evaluate(()=>window.__yard.trialStart({}));await page.waitForFunction(()=>window.__yard.trial.on&&!window.__yard.trial.busy,null,{timeout:900000});
  await page.waitForFunction(()=>window.__yard.trial.targets.some(x=>x.alive&&!x.ally),null,{timeout:900000});
  for(const cam of CAMS){
   const r=await page.evaluate(async cam=>{const Y=window.__yard,t=Y.trial;Y.trialCommand('cam');let guard=0;while(t.camMode!==cam&&guard++<8)Y.trialCommand('cam');
    const tg=t.targets.find(x=>x.alive&&!x.ally);if(!tg)return {cam,mode:t.camMode,noTarget:true};
    const norm=v=>{const l=Math.hypot(...v);return v.map(x=>x/l)},cross=(a,c)=>[a[1]*c[2]-a[2]*c[1],a[2]*c[0]-a[0]*c[2],a[0]*c[1]-a[1]*c[0]];
    const aim=()=>{const f=norm(tg.pos.map((v,i)=>v-t.P[i])),s=norm(cross([0,1,0],f)),u=cross(f,s);t.R=[...f,...u,...s];t.w=[0,0,0];};
    for(let i=0;i<20;i++){aim();Y.trialStep(.02);Y.trialCamera(.02);await new Promise(r=>requestAnimationFrame(r));}
    const n=document.querySelector('#trialHud [data-th="lead"]'),all=document.querySelectorAll('#trialHud [data-th="lead"]').length;
    return {cam,mode:t.camMode,lock:!!t.aim?.lock,lead:!!t.lead,leadElements:all,hidden:n?n.hidden:null,transform:n?n.style.transform:null,cockpitClass:document.querySelector('#trialHud')?.classList.contains('th-cockpit'),dist:Math.round(Math.hypot(...tg.pos.map((v,i)=>v-t.P[i])))};},cam);
   rep.steps.push(r);await page.screenshot({path:path.join(out,'xwing-'+cam+'.png')});}
 }catch(e){rep.errors.push('script: '+String(e.message).slice(0,400));}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(rep,null,1));await b.close();console.log(JSON.stringify(rep));})();
