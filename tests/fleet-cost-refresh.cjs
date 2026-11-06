const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
const currentVersion=+core.match(/const FLEET_PROFILE_VERSION=(\d+);/)[1],costVersion=+core.match(/const COST_MODEL=Object\.freeze\(\{version:(\d+),/)[1];

// Run the production entry/refresh functions and the real, cheap cost service.
// The only asynchronous substitute is a worker response: no ship factory,
// geometry, renderer, browser state or full physics build is needed here.
function setup(){
 const cx=vm.createContext({console:{warn(){}}}),run=code=>vm.runInContext(code,cx);
 run(`const requests=[],replies=[],messages=[],worlds=[],checks=[],events=[];let busy=0,hidden=0,rendered=0,scenarioBuilds=0;
 const COST_K={crew:1000},CAPITAL_LENGTH=500,currentSignature='installed-cost-model';
 const C={FLEET_PROFILE_VERSION:${currentVersion},COST_MODEL:{version:${costVersion}},costModelSignature:()=>currentSignature,emptyDesignProfile:p=>({...p}),DESIGN_FACTIONS:{empire:1},builtinComplement:()=>({air:[],ground:[]})};
 const R={FACTIONS:{empire:{name:'Empire'}},SIDE_OF:{}};
 const voy={designs:new Map(),pending:new Map(),setup:{own:'empire',foe:'empire',seedFixed:true,costLimit:{on:true,value:150}},screen:'setup',ops:{},sel:{}};
 const voyDesign=key=>voy.designs.get(key),voyShipDesign=sh=>voyDesign(sh.key)||voyDesign(sh.src);
 const fleet={assets:new Map()},view={fleetCache:new Map()};
 const fleetAsset=key=>{requests.push(key);return new Promise((resolve,reject)=>replies.push({key,resolve,reject}));};
 const showBusyOverlay=()=>busy++,hideBusyOverlay=()=>hidden++,voyRenderSetup=()=>rendered++,toast=s=>messages.push(s),fCr=n=>'Cr '+n;
 const craftCost=()=>{throw new Error('This fleet fixture contains no aircraft');};
 const model=()=>({profileVersion:C.FLEET_PROFILE_VERSION,costVersion:C.COST_MODEL.version,costSignature:currentSignature});
 const descriptor=(key,cost)=>({key,name:key,side:'Empire',faction:'empire',cls:'Destroyer',p:{name:key,len:100,profileVersion:C.FLEET_PROFILE_VERSION},info:{len:100,cost,crewNeed:0},model:model()});
 const YardFleetData={designs:{own:descriptor('own',100),enemy:descriptor('enemy',25),carried:descriptor('carried',100),excluded:descriptor('excluded',1000)}};
 const reply=(key,cost)=>({key,design:{faction:'empire'},stats:{name:key,cost,crew:0,len:100,cls:{name:'Destroyer'}},p:{name:key,len:100,profileVersion:C.FLEET_PROFILE_VERSION}});
 `);
 run(section(core,'function designCost(S) {','// ---------- parts (compartments) ----------'));
 run('C.designCost=designCost;');
 run(section(core,'function designInfo(S, p, extra = {}) {','// Personnel and supplies'));
 run('R.designInfo=designInfo;');
 run(section(core,'function shipCost(row, designOf) {','// ---------- SBOX-001..004 battle scenarios ----------'));
 run(section(core,'const scenarioPick =','// The battle of a scenario.'));
 run(`R.shipCost=shipCost;R.fleetCost=fleetCost;R.scenarioCosts=(sc,of)=>{const result=scenarioCosts(sc,of);checks.push(result);events.push('costs');return result;};`);
 run(section(app,'function voyExampleDesigns() {','function voyDesign(key)'));
 run('for(const d of voyExampleDesigns())voy.designs.set(d.key,d);');
 run(section(app,'function voyProfileStale(','const voyShort ='));
 run(section(app,'function voyCostPending(','// The sector of the chosen area and seed'));
 run(section(app,'function voyCostCheck(s) {','// The two sides of the editor'));
 run(`const ownRows=[{key:'own'}],enemyRows=[{key:'enemy'}];
 const voySortieShips=()=>ownRows,voyFoeTgs=()=>[{ships:enemyRows}];
 let voyScenarioOf=s=>{scenarioBuilds++;return {costLimit:{...s.costLimit},sides:[ownRows,enemyRows].map((ships,i)=>({faction:'empire',fleet:{ctgs:[{tgs:[{id:'chosen'+i,ships}]}]},sel:{}}))};};
 const voyCraftPricesBlocked=()=>false,voyOnHit=()=>{},voyShow=()=>{},voyNote=()=>{},voyDraftSave=()=>{},voyCan3D=()=>false,voyWarm=()=>{},voyFormStore=()=>[];
 R.scenarioWorld=(sc,designs)=>{events.push('world');worlds.push({sc,designs});return {units:new Map(),ctgs:new Map(),sides:[],sector:{name:'Test'}};};
 `);
 run(section(app,'async function voyStartBattle()','// The 3D models of every design in the battle'));
 return {run};
}

test('old example prices retain their provenance and cannot decide an active cost limit',()=>{
 const {run}=setup();
 assert.equal(run("voyDesign('own').model.costSignature"),'installed-cost-model','production example registration must preserve price provenance');
 run("Object.assign(voyDesign('own').p,{profileVersion:C.FLEET_PROFILE_VERSION-1});voyDesign('own').model.profileVersion--;voyDesign('own').info.cost=300;");
 const costs=plain(run('voyCostCheck(voy.setup)'));
 assert.equal(costs[0].total,300);assert.equal(costs[0].pending,true);assert.equal(costs[0].over,false,'an old high quote must not prevent requesting the current price');
 assert.equal(costs[1].pending,false);assert.equal(costs[1].over,false);
 assert.equal(run("voyCostText(voyCostOf(ownRows[0]))"),'Cr 300（再計算待ち・旧計算参考）');
 assert.match(run('voyCostLine(voyFleetCost(ownRows))'),/再計算待ち・旧計算参考/);
});

test('a 100 to 200 refresh blocks a 150-limit battle before any world is created',async()=>{
 const {run}=setup();run("voyDesign('own').p.profileVersion--;voyDesign('own').model.profileVersion--;const launch=voyStartBattle();");
 assert.equal(run('worlds.length'),0);assert.deepEqual(plain(run('requests')),['own']);
 run("replies[0].resolve(reply('own',200))");await run('launch');
 assert.equal(run('worlds.length'),0);assert.equal(run('checks.at(-1)[0].total'),200);assert.equal(run('checks.at(-1)[0].over'),true);
 assert.equal(run('checks.at(-1)[1].over'),false);assert.ok(run('messages.length')>0);assert.ok(run('rendered')>0);
 assert.ok(run('scenarioBuilds')>=2,'the selected scenario must be reconstructed after refreshing its inputs');
 assert.equal(run("voyCostText(voyFleetCost(ownRows))"),'Cr 200','the old-calculation label disappears once current price provenance is installed');
 assert.equal(run("voyDesign('own').model.costSignature"),'installed-cost-model');
});

test('a 300 to 100 refresh permits a formerly over-limit quote and uses the updated price',async()=>{
 const {run}=setup();run("voyDesign('own').p.profileVersion--;voyDesign('own').info.cost=300;const before=voyCostCheck(voy.setup);const launch=voyStartBattle();");
 assert.equal(run('before[0].pending'),true);assert.equal(run('before[0].over'),false);assert.equal(run('worlds.length'),0);
 run("replies[0].resolve(reply('own',100))");await run('launch');
 assert.equal(run('worlds.length'),1);assert.equal(run('checks.at(-1)[0].total'),100);assert.equal(run('checks.at(-1).some(c=>c.over)'),false);
 assert.deepEqual(plain(run('events')),['costs','world']);assert.equal(run("worlds[0].designs.find(d=>d.key==='own').info.cost"),100);
 assert.equal(run('voyFleetCost(ownRows).pending'),false);assert.equal(run('voyCostText(voyFleetCost(ownRows))'),'Cr 100');
});

test('the enemy independently blocks departure when its fresh price exceeds the same limit',async()=>{
 const {run}=setup();run("voyDesign('own').info.cost=25;voyDesign('enemy').info.cost=100;voyDesign('enemy').p.profileVersion--;const launch=voyStartBattle();");
 assert.deepEqual(plain(run('requests')),['enemy']);assert.equal(run('worlds.length'),0);
 run("replies[0].resolve(reply('enemy',200))");await run('launch');
 assert.equal(run('worlds.length'),0);assert.equal(run('checks.at(-1)[0].over'),false);assert.equal(run('checks.at(-1)[1].total'),200);assert.equal(run('checks.at(-1)[1].over'),true);
});

test('unchanged current examples enter synchronously without a refresh or pending label',async()=>{
 const {run}=setup();run('const launch=voyStartBattle()');
 assert.equal(run('worlds.length'),1,'already current fleets must retain the synchronous entry path');assert.deepEqual(plain(run('requests')),[]);assert.equal(run('busy'),0);
 assert.equal(run('voyFleetCost(ownRows).pending'),false);assert.equal(run('voyCostText(voyFleetCost(ownRows))'),'Cr 100');assert.deepEqual(plain(run('events')),['costs','world']);await run('launch');
});

test('a current over-limit price blocks immediately without asking a worker to rebuild it',async()=>{
 const {run}=setup();run("voyDesign('own').info.cost=200;const launch=voyStartBattle()");
 assert.equal(run('worlds.length'),0);assert.equal(run('requests.length'),0);assert.equal(run('checks[0][0].over'),true);await run('launch');
});

test('price-model changes invalidate same-profile-version examples until a fresh worker price arrives',async()=>{
 for(const change of ["d.model.profileVersion--","d.model.costVersion--","d.model.costSignature='older-cost-model'"]){
  const {run}=setup();run(`const d=voyDesign('own');${change};const launch=voyStartBattle();`);
  assert.equal(run("voyCostStale(voyDesign('own'))"),true,change);assert.equal(run('voyFleetCost(ownRows).pending'),true,change);assert.deepEqual(plain(run('requests')),['own']);
  run("replies[0].resolve(reply('own',120))");await run('launch');assert.equal(run('worlds.length'),1);assert.equal(run("voyCostStale(voyDesign('own'))"),false,change);
  assert.deepEqual(plain(run("voyDesign('own').model")),{profileVersion:currentVersion,costVersion,costSignature:'installed-cost-model'});
 }
});

test('current compact descriptors have current prices while still requiring a physical combat profile',async()=>{
 const {run}=setup();run("voyDesign('own').p.catalogOnly=true;const stale=voyProfileStale(voyDesign('own')),cost=voyFleetCost(ownRows);const launch=voyStartBattle();");
 assert.equal(run('stale'),true);assert.equal(run("voyCostStale(voyDesign('own'))"),false);assert.equal(run('cost.pending'),false);assert.equal(run('voyCostText(cost)'),'Cr 100');
 assert.deepEqual(plain(run('requests')),['own']);assert.equal(run('worlds.length'),0);run("replies[0].resolve(reply('own',100))");await run('launch');assert.equal(run('worlds.length'),1);assert.equal(run("worlds[0].designs.find(d=>d.key==='own').p.catalogOnly"),undefined);
});

test('an old carried-ship quote marks its carrier and fleet totals pending, then clears after refresh',async()=>{
 const {run}=setup();run("voyDesign('own').info.cost=25;ownRows[0].carried=[{key:'carried'}];voyDesign('carried').model.costSignature='older-cost-model';const before=voyCostOf(ownRows[0]),launch=voyStartBattle();");
 assert.equal(run('before.total'),125);assert.equal(run('before.pending'),true);assert.equal(run('voyFleetCost(ownRows).pending'),true);assert.deepEqual(plain(run('requests')),['carried']);
 run("replies[0].resolve(reply('carried',100))");await run('launch');assert.equal(run('worlds.length'),1);assert.equal(run('voyCostOf(ownRows[0]).pending'),false);assert.equal(run('voyFleetCost(ownRows).pending'),false);
});

test('unselected old examples do not rebuild or affect either side of the final cost check',async()=>{
 const {run}=setup();run("voyDesign('excluded').p.profileVersion--;const baseScenario=voyScenarioOf;voyScenarioOf=s=>{const sc=baseScenario(s);sc.sides[0].fleet.ctgs[0].tgs.push({id:'excluded',ships:[{key:'excluded'}]});sc.sides[0].sel.excluded=false;return sc;};const launch=voyStartBattle();");
 await run('launch');assert.equal(run('worlds.length'),1);assert.deepEqual(plain(run('requests')),[]);assert.equal(run('checks[0][0].total'),100);assert.equal(run('checks[0][1].total'),25);
});

test('the real English catalog translates the entire pending-price label and retains the amount',()=>{
 const {run}=setup();run("voyDesign('own').model.costSignature='older-cost-model'");
 const source=run('voyCostText(voyFleetCost(ownRows))'),cx=vm.createContext({navigator:{language:'en-US'}});
 for(const file of ['lang-en.js','i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,'js',file),'utf8'),cx,{filename:file});
 const translated=cx.KSI18n.t(source);
 assert.equal(translated,'Cr 100 (recalculation pending; previous model estimate)');assert.doesNotMatch(translated,/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u);
});
