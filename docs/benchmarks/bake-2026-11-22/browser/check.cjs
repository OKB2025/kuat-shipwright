// Browser check: a confirmed cut is baked at once (no cut record, the hull keeps a baked shape), Undo goes back to before the cut, save/load keeps the baked shape.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const url=process.argv[2],out=process.argv[3];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(900000);
await page.addInitScript(()=>{try{if(!localStorage.getItem('yard.language'))localStorage.setItem('yard.language','ja')}catch(e){}});
const settle=async()=>{await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.stats&&Y.eng.statsGen>=Y.eng.gen;},null,{timeout:1200000});await page.waitForTimeout(2000);};
const open=async k=>{await page.evaluate(k=>{window.__prevShip=window.__yard.ship;window.__yard.openExample(k)},k);await page.waitForFunction(()=>window.__yard.ship&&window.__yard.ship!==window.__prevShip,null,{timeout:600000});await settle();};
await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:300000});await page.evaluate(()=>window.__yard.title?.hide?.());
await open('cr90');const res={};const shot=async n=>page.screenshot({path:path.join(out,n)});
const state=()=>page.evaluate(()=>{const s=window.__yard.ship;return {solidCuts:(s.solidCuts||[]).length,ownCuts:s.parts.reduce((n,p)=>n+(p.hullData?.solidCuts?.length||0),0),baked:s.parts.filter(p=>p.bakedMesh).map(p=>p.id),meshParts:s.parts.filter(p=>p.form==='mesh').length,mass:window.__yard.stats?.mass};});
res.before=await state();
await page.evaluate(()=>{const Y=window.__yard,C=Y.C;const p=Y.ship.parts.find(p=>C.isHullStructure(p))||Y.ship.parts.find(p=>p.id===1);Y.st.sel={list:'parts',id:p.id};Y.designUIOpen('edit');Y.renderPanel();});await page.waitForTimeout(400);
res.carve=await page.evaluate(()=>{const b=document.querySelector('[data-design-context="carve"]');if(!b)return false;b.click();return true;});await page.waitForTimeout(500);
// place the cutter on the hull's top: scan for a hit
const hit=await page.evaluate(()=>{const Y=window.__yard,v=Y.view(),r=v.canvas.getBoundingClientRect();for(let fy=.4;fy<.7;fy+=.02)for(let fx=.4;fx<.7;fx+=.02){const h=Y.pick(r.width*fx,r.height*fy,{parts:true,fits:false});if(h?.p)return [r.width*fx,r.height*fy];}return null;});res.hit=hit;
await page.evaluate(()=>{window.__yard.st.cutterAction='place';});
await page.evaluate(h=>window.__yard.onTap(h[0],h[1]),hit);await page.waitForTimeout(800);
res.draft=await page.evaluate(()=>!!window.__yard.st.solidCutter);
await page.evaluate(()=>{const b=document.querySelector('[data-cutter-apply]');if(b)b.click();});
await page.waitForFunction(()=>/焼き込みました|焼き込めません|変わりました/.test(document.querySelector('.toast,#toast')?.textContent||''),null,{timeout:900000}).catch(()=>{});await settle();
res.toast=await page.evaluate(()=>document.querySelector('.toast,#toast')?.textContent);res.afterCut=await state();await shot('1-baked.png');
await page.evaluate(()=>document.querySelector('#btnUndo').click());await settle();res.afterUndo=await state();
await page.evaluate(()=>document.querySelector('#btnRedo').click());await settle();res.afterRedo=await state();
await page.evaluate(()=>window.__yard.designUIClose());await settle();await page.evaluate(()=>document.querySelector('#btnSave').click());await page.waitForTimeout(4000);const id=await page.evaluate(()=>window.__yard.ship.saveId);
await open('mc30c');await page.evaluate(async id=>{window.__prevShip=window.__yard.ship;document.querySelector(`[data-load="${id}"]`).click();},id);await page.waitForFunction(()=>window.__yard.ship&&window.__yard.ship!==window.__prevShip,null,{timeout:600000});await settle();
res.afterLoad=await state();await shot('2-loaded.png');
res.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(res,null,1));console.log(JSON.stringify(res,null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
