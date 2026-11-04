const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(realAsset=false){
 const cx=vm.createContext({console:{warn(){}}}),run=code=>vm.runInContext(code,cx);
 run(`const requests=[],replies=[],messages=[],worlds=[],titles=[];let busy=0,hidden=0,rendered=0,advanced=0;
 const C={FLEET_PROFILE_VERSION:2,emptyDesignProfile:p=>({...p}),DESIGN_FACTIONS:{empire:1},builtinComplement:key=>({air:[],ground:[]})};
 const R={designInfo:(s,p)=>({len:p.len,version:p.profileVersion}),FACTIONS:{empire:{name:'Empire'}},defaultAir:()=>[],makeSector:()=>({})};
 const voy={designs:new Map(),pending:new Map(),setup:{own:'empire',foe:'empire',seedFixed:true},screen:'setup',ops:{},sel:{}},voyDesign=key=>voy.designs.get(key),voyShipDesign=sh=>voyDesign(sh.key)||voyDesign(sh.src);
 const fleet={assets:new Map()},view={fleetCache:new Map(),loadFleet(key,geometry){if(!this.fleetCache.has(key))this.fleetCache.set(key,geometry);return this.fleetCache.get(key);}},Rts={CRAFT:{}};
 ${realAsset?'const YardEngineClient={request:(type,payload)=>{requests.push(payload.key);return new Promise((resolve,reject)=>replies.push({key:payload.key,resolve,reject}));}};':'const fleetAsset=key=>{requests.push(key);return new Promise((resolve,reject)=>replies.push({key,resolve,reject}));};'}
 const showBusyOverlay=()=>busy++,hideBusyOverlay=()=>hidden++,voyRenderSetup=()=>rendered++,toast=s=>messages.push(s),showTitle=s=>titles.push(s),hideTitle=()=>titles.push('hidden');
 const example=(key,version)=>({key,name:key,faction:'empire',side:'Original navy',cls:'Original class',src:'example',p:{name:key,len:100,...(version?{profileVersion:version}:{})},info:{len:100},loadPreset:{air:[{craft:'tie',n:4}],ground:[]}});
 const ready=(key,version=2)=>({key,design:{faction:'empire'},stats:{name:key,cls:{name:'New class'}},p:{name:key,len:101,profileVersion:version}});
 for(const k of ['venator','dreadnaught','munificent','unused'])voy.designs.set(k,example(k));
 voy.designs.set('manual',{key:'manual',src:'save',p:{name:'Manual'},info:{}});
 `);
 if(realAsset)run(section('async function fleetAsset(','async function fleetAdd('));
 run(section('function voyProfileStale(','const voyShort ='));return{run,cx};
}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('stale example preparation reuses one worker asset and preserves navy and optional complement metadata',async()=>{
 const {run}=setup();run("const old=voyDesign('venator'),one=voyPrepare('venator'),two=voyPrepare('venator');");
 assert.deepEqual(plain(run('requests')),['venator']);assert.equal(run('voy.pending.size'),1);
 run("replies[0].resolve(ready('venator'))");const [a,b]=await Promise.all([run('one'),run('two')]);assert.equal(a,b);
 assert.equal(a.p.profileVersion,2);assert.equal(a.faction,'empire');assert.equal(a.side,'Original navy');assert.equal(a.src,'example');assert.equal(a.loadPreset,run('old.loadPreset'));assert.equal(a.info.version,2);assert.equal(run('voy.pending.size'),0);
 await run("voyPrepare('venator')");await run("voyPrepare('manual')");assert.equal(run('requests.length'),1,'current examples and legacy manual profiles must not queue rebuilds');assert.equal(run("voyDesign('manual').p.profileVersion"),undefined);
});

test('only selected examples and carried ships refresh, repeated launch attempts do not duplicate builds',async()=>{
 const {run}=setup();run("const rows=[{key:'venator',carried:[{key:'dreadnaught'}]},{key:'venator'},{key:'manual'}],keys=voyProfileKeys(rows),one=voyRequireProfiles(keys);const two=voyRequireProfiles(keys);");
 assert.equal(await run('two'),false);assert.deepEqual(plain(run('requests')),['venator']);
 run("replies[0].resolve(ready('venator'))");await flush();assert.deepEqual(plain(run('requests')),['venator','dreadnaught']);
 run("replies[1].resolve(ready('dreadnaught'))");assert.equal(await run('one'),true);
 assert.equal(run("voyProfileStale(voyDesign('unused'))"),true);assert.equal(run('busy'),1);assert.equal(run('hidden'),1);assert.equal(run('voy.profilePreparing'),false);
});

test('failed or stale worker replies keep old examples gated and permit a later retry',async()=>{
 for(const failure of ['reject','stale']){
  const {run}=setup();run("const old=voyDesign('venator'),one=voyRequireProfiles(['venator']);");
  run(failure==='reject'?"replies[0].reject(new Error('worker failed'))":"replies[0].resolve(ready('venator',1))");assert.equal(await run('one'),false);
  assert.equal(run("voyDesign('venator')===old"),true);assert.equal(run('voy.pending.size'),0);assert.equal(run('messages.length'),1);
  run("const retry=voyRequireProfiles(['venator']);replies[1].resolve(ready('venator'))");assert.equal(await run('retry'),true);assert.equal(run('requests.length'),2);
 }
});

test('actual fleet asset cache discards a rejected stale response and all aliases before a successful retry',async()=>{
 for(const cached of [false,true]){
  const {run}=setup(true);
  if(cached)run("const old={key:'venator',stats:{},p:{profileVersion:1},geometry:{revision:1}};for(const key of ['venator','alias']){fleet.assets.set(key,old);view.fleetCache.set(key,old.geometry);}");
  run("const first=voyRequireProfiles(['venator']);");
  if(!cached)run("replies[0].resolve({...ready('venator',1),profile:{name:'venator',len:101,profileVersion:1},geometry:{revision:1}})");
  assert.equal(await run('first'),false);assert.equal(run("voyDesign('venator').p.profileVersion"),undefined);
  for(const key of ['venator','alias']){assert.equal(run(`fleet.assets.has('${key}')`),false);assert.equal(run(`view.fleetCache.has('${key}')`),false);}
  run("const second=voyRequireProfiles(['venator']);");assert.equal(run('requests.length'),cached?1:2,'retry must request a new profile instead of reusing the rejected asset');
  run("replies.at(-1).resolve({...ready('venator'),profile:{name:'venator',len:101,profileVersion:2},geometry:{revision:2}})");assert.equal(await run('second'),true);
  assert.equal(run("voyDesign('venator').p.profileVersion"),2);assert.equal(run("fleet.assets.get('venator').p.profileVersion"),2);assert.equal(run("view.fleetCache.get('venator').revision"),2);
  run("const saved={p:{profileVersion:1}};fleet.assets.set('save:old',saved);const manual=fleetAsset('save:old')");assert.equal(await run('manual'),run('saved'));assert.equal(run('requests.length'),cached?1:2);
 }
});

test('custom battle waits for selected profiles and cannot enter a world after refresh failure',async()=>{
 for(const fail of [false,true]){
  const {run}=setup();run(`const sc={sides:[{fleet:{ctgs:[{tgs:[{id:'chosen',ships:[{key:'venator',carried:[{key:'dreadnaught'}]}]},{id:'omitted',ships:[{key:'unused'}]}]}]},sel:{omitted:false}}]};
   const voyScenarioOf=()=>sc,voyCraftPricesBlocked=()=>false,voyOnHit=()=>{},voyShow=()=>{},voyNote=()=>{},voyDraftSave=()=>{},voyCan3D=()=>false,voyWarm=()=>{},voyFormStore=()=>[];
   R.scenarioWorld=(s,designs)=>{worlds.push(designs);return{units:new Map(),ctgs:new Map(),sector:{name:'Test'}};};`);
  run(section('async function voyStartBattle()','// The 3D models of every design in the battle'));run('const launch=voyStartBattle()');assert.equal(run('worlds.length'),0);
  if(fail)run("replies[0].reject(new Error('failed'))");else{run("replies[0].resolve(ready('venator'))");await flush();run("replies[1].resolve(ready('dreadnaught'))");}
  await run('launch');assert.equal(run('worlds.length'),fail?0:1);assert.deepEqual(plain(run('requests')),fail?['venator']:['venator','dreadnaught']);
  if(!fail)assert.equal(run("worlds[0].find(d=>d.key==='venator').p.profileVersion"),2);
 }
});

test('current profiles enter the custom battle synchronously without a worker or loading overlay',async()=>{
 const {run}=setup();run(`voyDesign('venator').p.profileVersion=2;
  const sc={sides:[{fleet:{ctgs:[{tgs:[{id:'chosen',ships:[{key:'venator'},{key:'manual'}]}]}]},sel:{}}]};
  const voyScenarioOf=()=>sc,voyCraftPricesBlocked=()=>false,voyOnHit=()=>{},voyShow=()=>{},voyNote=()=>{},voyDraftSave=()=>{},voyCan3D=()=>false,voyWarm=()=>{},voyFormStore=()=>[];
  R.scenarioWorld=(s,designs)=>{worlds.push(designs);return{units:new Map(),ctgs:new Map(),sector:{name:'Test'}};};`);
 run(section('async function voyStartBattle()','// The 3D models of every design in the battle'));run('const launch=voyStartBattle()');
 assert.equal(run('worlds.length'),1,'a current/manual fleet must not pause on a resolved promise');assert.equal(run('requests.length'),0);assert.equal(run('busy'),0);await run('launch');
});

test('tutorial profile failure returns to the title before creating a battle',async()=>{
 const {run}=setup();run('const voyNewSetup=()=>({});R.createWorld=()=>worlds.push(1);');
 run(section('async function voyTutStart()','function vtutStop()'));run('const launch=voyTutStart()');assert.equal(run('worlds.length'),0);run("replies[0].reject(new Error('failed'))");await run('launch');assert.equal(run('worlds.length'),0);assert.equal(run('titles.at(-1)'),'voyage');
});

test('mission profile failure cannot advance campaign time, positions or create a world',async()=>{
 const {run}=setup();run(`const foe={id:'foe',sys:'battle',faction:'empire'},tg={id:'tg',ships:[{key:'venator'}]},enemy={ctgs:[{tgs:[{ships:[{key:'munificent'}]}]}]},MS={foes:[foe],ob:{ctgs:[{tgs:[tg]}]}},msUI={foe:'foe'};
 const msSortieTgs=()=>[tg],msReadyShips=t=>t.ships,msSortiePlan=()=>({next:'battle'}),msSortieEta=()=>10,msAt=()=> 'battle',msFoeOrbat=()=>enemy,voyObShips=ob=>ob.ctgs.flatMap(c=>c.tgs.flatMap(t=>t.ships));
 const msAdvance=()=>advanced++;R.createWorld=()=>worlds.push(1);`);
 run(section('async function msBattleGo()','// The fleet battle\'s result sheet'));run('const launch=msBattleGo()');assert.equal(run('advanced'),0);assert.equal(run('worlds.length'),0);
 run("replies[0].reject(new Error('failed'))");await run('launch');assert.equal(run('advanced'),0);assert.equal(run('worlds.length'),0);assert.deepEqual(plain(run('titles')),[]);
});
