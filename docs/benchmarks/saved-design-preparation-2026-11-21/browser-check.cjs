const fs=require('fs'),path=require('path'),{chromium}=require('playwright');const url=process.argv[2],out=process.argv[3];
(async()=>{const browser=await chromium.launch(),ctx=await browser.newContext({viewport:{width:1400,height:900},locale:'ja-JP'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(60000);
 const log=m=>{console.log(new Date().toISOString().slice(11,19),m);};
 try{
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});log('ready');
  const saved=await page.evaluate(()=>{const C=window.__yard.C,s=C.newShip({L:300,W:80,H:60},'Background prep check');const design=C.serialize(s);const id='ship-bgprep';const rec={id,kind:'ship',name:design.name,savedAt:Date.now(),cls:'',len:300,faction:'any',data:'j1:'+JSON.stringify(design)};localStorage.setItem('yard.saves',JSON.stringify([rec]));return {id,savedAt:rec.savedAt,design};});
  log('saved '+JSON.stringify(saved));
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});log('reloaded');
  const key='save:'+saved.id+'-'+saved.savedAt;
  const t0=Date.now();let st=null;
  for(let i=0;i<240;i++){st=await page.evaluate(()=>window.KSPreload?.state||null);if(st&&(st.ready>=1||st.phase==='complete'||st.phase==='unavailable'))break;await page.waitForTimeout(1000);}
  log('preload state '+JSON.stringify(st)+' after '+(Date.now()-t0)+' ms');
  const r=await page.evaluate(async(design)=>{const t=performance.now();const res=await YardEngineClient.request('fleet',{design,trial:false,prepareOnly:true});return {ms:Math.round(performance.now()-t),src:res.src,profileSrc:res.profileSrc,geoCached:res.geoCached};},saved.design);
  log('fleet request after preparation '+JSON.stringify(r));
  fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({saved,key,preload:st,request:r,errors},null,1));
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();}
})();
