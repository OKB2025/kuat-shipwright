// Before/after images of the bays lowered or extended in version 7. usage: node render.cjs <base url> <head url> <outdir>
// Each shot: same example, same camera on the bay, exterior and x-ray; base = version 6 checkout, head = this PR.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const [baseUrl,headUrl,out]=process.argv.slice(2),CENTERS=JSON.parse(fs.readFileSync(path.join(out,'centers.json'),'utf8'));
const SHOTS=[['dreadnaught',56,2.35,0,.6],['onager',72,2.3,1.2,.7],['providence',24,1.35,Math.PI/2,.55],['mc80home',72,1.35,Math.PI/2,.6],['sample',72,2.3,1.2,.8]];
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const res=[];
for(const [tag,url] of [['v6',baseUrl],['v7',headUrl]]){const page=await b.newPage({viewport:{width:1100,height:800}}),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(900000);
 await page.addInitScript(()=>{try{localStorage.setItem('yard.language','ja');localStorage.setItem('yard.designMetricsOpen','0')}catch(e){}});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:600000});
 for(const [key,id,ph,th,rk] of SHOTS){await page.evaluate(k=>{window.__prevShip=window.__yard.ship;window.__yard.title?.hide?.();window.__yard.openExample(k)},key);
  await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.ship!==window.__prevShip&&Y.stats&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.geoGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen;},null,{timeout:1800000});
  for(const mode of ['ext','xray']){const info=await page.evaluate(([id,ph,th,rk,mode,at])=>{const Y=window.__yard,C=Y.C,mid=q=>{const b=C.partAABB({...q,_clip:null,_packing:null});return [(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2];},p=Y.ship.parts.filter(q=>q.k==='hangar').sort((a,b)=>Math.hypot(...C.sub(mid(a),at))-Math.hypot(...C.sub(mid(b),at)))[0];if(!p)return {missing:true};const bb=C.partAABB({...p,_clip:null,_packing:null}),c=[(bb[0]+bb[3])/2,(bb[1]+bb[4])/2,(bb[2]+bb[5])/2],size=Math.max(bb[3]-bb[0],bb[4]-bb[1],bb[5]-bb[2]);
    if(Y.st){Y.st.xray=mode==='xray';Y.st.view=mode==='xray'?'xray':'ext';}document.querySelector(mode==='xray'?'[data-view="xray"]':'[data-view="normal"]')?.click?.();
    const v=Y.view();v.cam.target=C.add(c,v.off||[0,0,0]);v.cam.r=Math.max(size*3/rk,Y.ship.hull?.L*.35*rk||0);v.cam.ph=ph;v.cam.th=th;v.cam.frame=null;Y.draw();
    return {pickedId:p.id,box:bb.map(x=>+x.toFixed(2)),label:p.label,room:p.room,c:p.c};},[id,ph,th,rk,mode,CENTERS[key]]);
   await page.waitForTimeout(1200);await page.evaluate(()=>window.__yard.draw());const file=`${key}-${tag}-${mode}.png`;await page.screenshot({path:path.join(out,file)});res.push({tag,key,id,mode,file,shipName:await page.evaluate(()=>window.__yard.ship.name),...info});}}
 res.push({tag,errors});await page.close();}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(res,null,1));console.log(JSON.stringify(res.filter(r=>r.errors||r.missing)));await b.close();})();
