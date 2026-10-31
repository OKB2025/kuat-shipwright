const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){const c=vm.createContext({console});vm.runInContext(`
 const C={COST_MODEL:{version:2},cleanDesignCraft:d=>d},requests=[],resolvers=[];
 const R={CRAFT:{},registerDesignCraft:d=>'dsn-'+(d.craft.cost||0)};
 const YardEngineClient={request:(type,payload)=>{requests.push({type,payload});return new Promise((resolve,reject)=>resolvers.push({resolve,reject}));}};
 const own={ctgs:[{tgs:[{ships:[{air:[]}]}]}]},foe={ctgs:[]},voy={setup:{},screen:'setup'},messages=[];
 const voySideOb=(s,side)=>side?foe:own,voyOrbatSave=()=>{},voyDraftSave=()=>{},voyRenderSetup=()=>{},voyOrbatSheet=()=>{},toast=s=>messages.push(s);
 const blueprint={format:'starship-yard',v:3,parts:[]},old={name:'Saved',blueprint,craft:{cost:5,crew:1}},row=()=>own.ctgs[0].tgs[0].ships[0].air;
 `,c);const a=app.indexOf('const voyObShips ='),b=app.indexOf('const voyObTgs =',a);assert.ok(a>=0&&b>a);vm.runInContext(app.slice(a,b),c);return code=>vm.runInContext(code,c);}
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
test('old blueprints are repriced once in the worker and current prices require no job',async()=>{
 const run=setup();run('const p1=repriceCraftDesign(old),p2=repriceCraftDesign(old);');assert.equal(run('p1===p2'),true);assert.equal(run('requests.length'),1);assert.equal(run('requests[0].type'),'craftPrice');
 run('resolvers[0].resolve({price:{build:25000,costBy:{power:25000},crewCount:1,version:2}})');const d=await run('p1');assert.equal(d.craft.cost,25000);assert.equal(d.craft.priceVersion,2);assert.equal(d.blueprint,run('blueprint'));
 await run('repriceCraftDesign({...old,craft:{...old.craft,priceVersion:2}})');assert.equal(run('requests.length'),1);
});
test('stale replies cannot replace a new design or deleted squadron',async()=>{
 const run=setup();run('const q={craft:"old",design:old,n:4};row().push(q);voyRefreshFleetPrices(own);q.design={...old,name:"Replacement"};q.craft="new";');
 run('resolvers[0].resolve({price:{build:25000,costBy:{power:25000},crewCount:1,version:2}})');await flush();assert.equal(run('row()[0].craft'),'new');assert.equal(run('voy.pendingPrices.size'),0);
});
test('a failed current price blocks sortie and success from another row cannot clear its error',async()=>{
 const run=setup();run('const a={craft:"a",design:old},b={craft:"b",design:{...old,craft:{cost:6}}};row().push(a,b);voyRefreshFleetPrices(own);');assert.equal(run('voyCraftPricesBlocked()'),true);
 run('resolvers[0].reject(new Error("worker failed"));resolvers[1].resolve({price:{build:25000,costBy:{power:25000},crewCount:1,version:2}})');await flush();assert.equal(run('voyCraftPricesBlocked()'),true);
 run('row().shift()');assert.equal(run('voyCraftPricesBlocked()'),false);
});
test('replacing a failed or pending old design with a current stock type unblocks sortie',async()=>{
 for(const fail of [true,false]){
  const run=setup();run('const q={craft:"old",design:old};row().push(q);voyRefreshFleetPrices(own);');
  if(fail){run('resolvers[0].reject(new Error("failed"))');await flush();}
  run('q.craft="xwing";delete q.design;voyRefreshFleetPrices(own)');assert.equal(run('voyCraftPricesBlocked()'),false);
  if(!fail){run('resolvers[0].resolve({price:{build:1,costBy:{power:1},crewCount:1,version:2}})');await flush();assert.equal(run('q.craft'),'xwing');}
 }
});
