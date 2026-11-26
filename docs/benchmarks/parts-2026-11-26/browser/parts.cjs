const fs=require('fs'),path=require('path'),{chromium}=require('playwright');const out=__dirname,url=process.argv[2];
(async()=>{const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:2});const report={errors:[]};page.on('pageerror',e=>report.errors.push('pageerror: '+String(e.message).slice(0,300)));page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
 const settled=()=>page.waitForFunction(()=>{const Y=window.__yard;return Y&&Y.eng&&!Y.eng.error&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.geoGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&!!Y.stats;},null,{timeout:300000});
 const frame=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 try{await page.goto(url);await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());
  report.built=await page.evaluate(()=>{const Y=window.__yard,C=Y.C,s=C.newShip({L:10,W:7,H:2,assembly:true},'部品の確認');s.parts=[];s.fits=[];s.nextId=1;s.shipClass='starfighter';C.placePart(s,'struct',[0,1,0],[10,7,2],{form:'box'},false);const res=[];
   const put=(k,z,o,extra)=>{const r=C.placeFit(s,k,[2,2,z],[0,1,0],0,false,o||{});if(r.fit&&extra)Object.assign(r.fit,extra);res.push({k,z,ok:!!r.fit,err:r.err||null,oneRound:r.fit?.oneRound,float:r.fit?.float,size:r.fit?[C.fitSpec(r.fit).fm,C.fitSpec(r.fit).wm,C.fitSpec(r.fit).hm]:null});return r.fit;};
   put('ctorp',-3);put('ctorp',-2.2,{oneRound:true});put('cmsl',-1.4);put('cpylon',-.6);put('cpylon',-.1,{oneRound:true});put('cdrop',.7);put('claser',1.6);put('claser',2.4,null,{ionBoxM3:1});put('cturret',3.1,null,{ionBoxM3:.5});
   Y.setShip(s);return res;});
  await settled();await frame();await page.waitForTimeout(1500);await frame();report.warnings=await page.evaluate(()=>(window.__yard.stats.warnings||[]).map(w=>w.code+': '+w.text.slice(0,60)));report.stations=await page.evaluate(()=>window.__yard.C.craftStations(window.__yard.ship,window.__yard.stats));
  await page.screenshot({path:path.join(out,'parts-default.png')});
  report.cam=await page.evaluate(()=>JSON.stringify(window.__yard.view().cam).slice(0,400));
  for(const [name,cam] of [['parts-close',{th:.55,ph:.95,r:7.5,target:[2.2,2.2,0]}],['parts-front',{th:1.35,ph:1.25,r:6.5,target:[2.2,2.2,0]}]]){await page.evaluate(c=>{const Y=window.__yard,v=Y.view();Object.assign(v.cam,c);Y.draw();},cam);await frame();await page.waitForTimeout(700);await frame();await page.screenshot({path:path.join(out,name+'.png'),clip:{x:0,y:90,width:1280,height:640}});}
  
  report.status=report.errors.length?'ERRORS':'OK';}catch(e){report.status='FAILED';report.failure=String(e.stack||e).slice(0,1200);try{await page.screenshot({path:path.join(out,'failed.png')});}catch{}}
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));console.log(JSON.stringify(report,null,1).slice(0,5000));await browser.close();})();
