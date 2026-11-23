const {chromium}=require('playwright'),fs=require('fs'),path=require('path');const url=process.argv[2],out=process.argv[3],design=fs.readFileSync(process.argv[4],'utf8');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await (await b.newContext({viewport:{width:1280,height:900}})).newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));page.setDefaultTimeout(1200000);
await page.addInitScript(()=>{try{localStorage.setItem('yard.language','ja')}catch(e){}});
await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:300000});await page.evaluate(()=>window.__yard.title?.hide?.());
await page.evaluate(t=>{const Y=window.__yard;window.__prevShip=Y.ship;Y.setShip(Y.C.deserialize(JSON.parse(t)));},design);
await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship&&Y.ship!==window.__prevShip&&Y.stats&&Y.eng.statsGen>=Y.eng.gen;},null,{timeout:1800000});await page.waitForTimeout(3000);
const shot=async n=>page.screenshot({path:path.join(out,n)});
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='横');b&&b.click();});await page.waitForTimeout(1500);await shot('1-exterior-side.png');
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='透視');b&&b.click();});await page.waitForTimeout(2500);await shot('2-xray-side.png');
await page.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='区画色');b&&b.click();});await page.waitForTimeout(2500);
for(const [n,view] of [['3-xray-bridge-side.png','横'],['4-xray-bridge-top.png','上'],['5-xray-bridge-oblique.png','斜']]){await page.evaluate(v=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===v);b&&b.click();},view);await page.waitForTimeout(1200);await page.evaluate(()=>{const v=window.__yard.view();v.cam.target=[260+v.off[0],405+v.off[1],0+v.off[2]];v.cam.r=330;window.__yard.draw();});await page.waitForTimeout(2500);await shot(n);}
console.log(JSON.stringify({errors}));await b.close();})().catch(e=>{console.error(e);process.exit(1)});
