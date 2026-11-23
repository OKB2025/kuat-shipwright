// Browser check: an equipment part and a gun take a colour from the editor, change the picture, survive save/load and Undo.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const url=process.argv[2],out=process.argv[3];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(600000);
await page.addInitScript(()=>{try{if(!localStorage.getItem('yard.language'))localStorage.setItem('yard.language','ja')}catch(e){}});
const settle=async()=>{await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.stats&&Y.eng.statsGen>=Y.eng.gen;},null,{timeout:1200000});await page.waitForTimeout(2500);};
const open=async k=>{await page.evaluate(k=>{window.__prevShip=window.__yard.ship;window.__yard.openExample(k)},k);await page.waitForFunction(()=>window.__yard.ship&&window.__yard.ship!==window.__prevShip,null,{timeout:600000});await settle();};
await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:300000});await page.evaluate(()=>window.__yard.title?.hide?.());
await open(process.argv[4]||'cr90');const res={};
const shot=async n=>{const f=path.join(out,n);await page.screenshot({path:f});return f;};
res.ids=await page.evaluate(()=>{const s=window.__yard.ship,C=window.__yard.C;const fit=s.fits.find(f=>C.FITS[f.k].cat==='w'&&!C.FITS[f.k].casemate);const part=s.parts.find(p=>['engine'].includes(p.k));return {fit:fit?.id,fitK:fit?.k,part:part?.id,partK:part?.k};});
await shot('0-before.png');
const pick=async(list,id,sel,val)=>{await page.evaluate(([list,id])=>{const Y=window.__yard;Y.st.sel={list,id};Y.renderPanel();},[list,id]);await page.waitForTimeout(300);
 const has=await page.evaluate(sel=>!!document.querySelector(sel),sel);if(!has)return 'no-input';
 await page.evaluate(([sel,val])=>{const el=document.querySelector(sel);el.value=val;el.dispatchEvent(new Event('change',{bubbles:true}));},[sel,val]);await settle();return 'ok';};
res.fitSet=await pick('fits',res.ids.fit,'#panel [data-fitpaint]','#ff2020');await shot('1-gun-red.png');
res.partSet=await pick('parts',res.ids.part,'#panel [data-partpaint]','#2040ff');await shot('2-engine-blue.png');await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='後');b&&b.click();});await page.waitForTimeout(1500);await shot('2b-engine-blue-aft.png');
res.afterSet=await page.evaluate(ids=>{const s=window.__yard.ship;return {fit:s.fits.find(f=>f.id===ids.fit)?.paint,part:s.parts.find(p=>p.id===ids.part)?.paint,twins:s.fits.filter(f=>f.paint).length};},res.ids);
await page.evaluate(()=>document.querySelector('#btnSave').click());await page.waitForTimeout(4000);const id=await page.evaluate(()=>window.__yard.ship.saveId);res.saveId=id;
await open('mc30c');
await page.evaluate(async id=>{window.__prevShip=window.__yard.ship;const btn=document.querySelector(`[data-load="${id}"]`);if(btn)btn.click();else throw new Error('no load button '+id);},id);
await page.waitForFunction(()=>window.__yard.ship&&window.__yard.ship!==window.__prevShip,null,{timeout:600000});await settle();
res.afterLoad=await page.evaluate(ids=>{const s=window.__yard.ship;return {fit:s.fits.find(f=>f.id===ids.fit)?.paint,part:s.parts.find(p=>p.id===ids.part)?.paint};},res.ids);await shot('3-loaded.png');
// Undo the colour and reset button
res.clear=await page.evaluate(id=>{const Y=window.__yard;Y.st.sel={list:'fits',id};Y.renderPanel();const b=document.querySelector('#panel [data-fitpaintclear]');if(!b)return 'no-button';b.click();return Y.ship.fits.find(f=>f.id===id).paint??null;},res.ids.fit);
res.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(res,null,1));console.log(JSON.stringify(res,null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
