// Does a trial started again after its exit on the same page run as the drone range (no battle) as the first one did?
// usage: node restart-check.cjs <url>   (prints JSON)
const {chromium}=require('playwright');const url=process.argv[2];
(async()=>{const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1280,height:800}}),r={errors:[],runs:[]};page.on('pageerror',e=>r.errors.push(String(e.message).slice(0,200)));
 const settled=()=>page.waitForFunction(()=>{const Y=window.__yard;return Y&&Y.eng&&!Y.eng.error&&Y.eng.adoptedGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&!!Y.stats;},null,{timeout:600000});
 try{await page.goto(url);await page.waitForFunction(()=>!!window.__yard,null,{timeout:120000});await page.evaluate(()=>window.__yard.title.hide());await page.evaluate(()=>window.__yard.openExample('arquitens'));await settled();
  for(let k=0;k<2;k++){await page.evaluate(()=>window.__yard.trialStart({}));await page.waitForFunction(()=>window.__yard.trial.on&&!window.__yard.trial.busy,null,{timeout:600000});
   r.runs.push(await page.evaluate(()=>{const t=window.__yard.trial;return {battle:!!t.battle?.b,battleKeys:t.battle?Object.keys(t.battle).slice(0,8):null,fleetMode:window.__yard.fleet.mode};}));
   await page.evaluate(()=>window.__yard.trialCommand('exit'));await page.waitForFunction(()=>!window.__yard.trial.on,null,{timeout:120000}).catch(e=>r.errors.push('exit wait: '+e.message.slice(0,80)));await page.waitForTimeout(500);}
 }catch(e){r.errors.push('script: '+String(e.message).slice(0,300));}
 console.log(JSON.stringify(r));await browser.close();})();
