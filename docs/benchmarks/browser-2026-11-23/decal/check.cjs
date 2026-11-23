// Browser check: 塗装・エンブレム — add a circle and an imported image by tapping the hull, recolour, mirror, save/load, Undo.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const url=process.argv[2],out=process.argv[3],key=process.argv[4]||'cr90',png=process.argv[5];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const ctx=await b.newContext({viewport:{width:1280,height:900}});const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text());});page.setDefaultTimeout(600000);
await page.addInitScript(()=>{try{if(!localStorage.getItem('yard.language'))localStorage.setItem('yard.language','ja')}catch(e){}});
const settle=async()=>{await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.stats&&Y.eng.statsGen>=Y.eng.gen;},null,{timeout:1200000});await page.waitForTimeout(2500);};
const open=async k=>{await page.evaluate(k=>{window.__prevShip=window.__yard.ship;window.__yard.openExample(k)},k);await page.waitForFunction(()=>window.__yard.ship&&window.__yard.ship!==window.__prevShip,null,{timeout:600000});await settle();};
await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:300000});await page.evaluate(()=>window.__yard.title?.hide?.());
await open(key);const res={};const shot=async n=>page.screenshot({path:path.join(out,n)});
// view from above so the top of the hull faces the camera
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='上');b&&b.click();});await page.waitForTimeout(1200);
// select the largest structure and open its paint context through the design UI
res.sel=await page.evaluate(()=>{const Y=window.__yard,C=Y.C;const p=Y.ship.parts.filter(p=>C.isStructuralPart(p)).sort((a,b)=>(b.s?b.s[0]*b.s[1]*b.s[2]:0)-(a.s?a.s[0]*a.s[1]*a.s[2]:0))[0];Y.st.sel={list:'parts',id:p.id};Y.designUIOpen('edit');Y.renderPanel();return p.id;});
await page.waitForTimeout(500);res.contextButton=await page.evaluate(()=>{const b=document.querySelector('[data-design-context="paint"]');if(!b)return false;b.click();return true;});await page.waitForTimeout(500);
res.panel=await page.evaluate(()=>!!document.querySelector('[data-decal-panel]'));
const canvasTap=async(fx,fy)=>page.evaluate(([fx,fy])=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();window.__yard.onTap(r.width*fx,r.height*fy);},[fx,fy]);
await page.click('[data-decaladd="circle"]');res.armed=await page.evaluate(()=>!!document.querySelector('[data-decal-armed]'));
await canvasTap(.42,.6);await settle();res.afterCircle=await page.evaluate(()=>JSON.parse(JSON.stringify(window.__yard.ship.decals||null)));res.dbg=await page.evaluate(()=>({tab:window.__yard.st.tab,tool:window.__yard.tool(),arm:window.__yard.st.decalArm,panel:!!document.querySelector('[data-decal-panel]'),toast:document.querySelector('.toast,#toast')?.textContent}));console.log(JSON.stringify(res));console.log(JSON.stringify(await page.evaluate(()=>{const c=document.querySelector('canvas');const r=c.getBoundingClientRect();const out=[];for(const fx of [.3,.42,.5,.55])for(const fy of [.4,.5,.6]){const h=window.__yard.pick(r.width*fx,r.height*fy,{parts:true,fits:false});out.push([fx,fy,h?Object.keys(h).join(','):null]);}return {w:r.width,h:r.height,out};})));await page.screenshot({path:'/tmp/ks-verify/20261122-decal/dbg.png'});
await page.evaluate(()=>{const el=document.querySelector('[data-decalcolor]');el.value='#ffcc00';el.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
await page.evaluate(()=>{const el=document.querySelector('[data-decalmirror]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));});await settle();
await page.setInputFiles('[data-decalfile]',png);await page.waitForFunction(()=>!!document.querySelector('[data-decal-armed]'));
await canvasTap(.55,.6);await settle();await page.waitForTimeout(1500);
res.afterImage=await page.evaluate(()=>{const s=window.__yard.ship;return {decals:s.decals,images:Object.fromEntries(Object.entries(s.decalImages||{}).map(([k,v])=>[k,v.slice(0,30)+'… '+v.length]))};});
res.decalMesh=await page.evaluate(()=>{const v=window.__yard.view?.();const m=v?.meshes?.decals;return {count:m?.count||0,tex:!!v?.tex?.decals};});
await shot('1-decals-top.png');
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='斜');b&&b.click();});await page.waitForTimeout(1200);await shot('2-decals-oblique.png');
await page.evaluate(()=>window.__yard.designUIClose());await settle();res.afterClose=await page.evaluate(()=>window.__yard.ship.decals?.length);await page.evaluate(()=>document.querySelector('#btnSave').click());await page.waitForTimeout(4000);const id=await page.evaluate(()=>window.__yard.ship.saveId);
await open('mc30c');await page.evaluate(async id=>{window.__prevShip=window.__yard.ship;const btn=document.querySelector(`[data-load="${id}"]`);if(btn)btn.click();else throw new Error('no load button '+id);},id);
await page.waitForFunction(()=>window.__yard.ship&&window.__yard.ship!==window.__prevShip,null,{timeout:600000});await settle();await page.waitForTimeout(1500);
res.afterLoad=await page.evaluate(()=>{const s=window.__yard.ship;return {n:s.decals?.length,images:Object.keys(s.decalImages||{}),mesh:window.__yard.view?.()?.meshes?.decals?.count||0};});
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='上');b&&b.click();});await page.waitForTimeout(1200);await shot('3-loaded-top.png');
// Undo removes the last decal edit
res.undoCheck=await page.evaluate(async()=>{const Y=window.__yard;const id=Y.ship.decals[0].id;Y.st.sel={list:'parts',id:Y.ship.parts.find(p=>Y.C.isStructuralPart(p)).id};Y.designUIOpen('edit');Y.renderPanel();document.querySelector('[data-design-context="paint"]').click();Y.st.decalSel=id;Y.renderPanel();const el=document.querySelector('[data-decalnum="w"]');el.value='30';el.dispatchEvent(new Event('change',{bubbles:true}));const after=Y.ship.decals.find(d=>d.id===id).w;document.querySelector('#btnUndo,[data-undo]')?.click();return {after,undone:Y.ship.decals.find(d=>d.id===id).w};});
res.errors=errors;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(res,null,1));console.log(JSON.stringify(res,null,1));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
