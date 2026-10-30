const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const c=vm.createContext({console});
 vm.runInContext(`
 const blueprint={format:'starship-yard',name:'User geometry',hull:{L:80,W:20,H:12},parts:[{id:1,k:'struct',s:[4,6,1]}]};
 const Rts={CRAFT:{dsnSaved:{blueprint,ref:'save:deleted-source'},legacy:{ref:'craft_xwing'},xwing:{}}},R=Rts;
 const C={clamp:(n,a,b)=>Math.max(a,Math.min(b,n))};
 const fleet={assets:new Map()},voy={},requests=[],loaded=[];
 const geometry={center:[0,0,0],meshes:{user:{geo:{n:3}}},foils:[{id:17},{id:23}]};
 const YardEngineClient={request:async(kind,payload)=>{requests.push({kind,payload});return {design:payload.design,stats:{},profile:{},geometry};}};
 const view={loadFleet:(key,geo)=>loaded.push({key,geo})};
 const Store={list:async()=>{throw new Error('The original source must not be needed');}};
 const findSave=(list,source)=>(list||[]).find(r=>source==='save:'+r.id||source==='save:'+r.id+'-'+r.savedAt);
 const unpack=async data=>JSON.parse(data);
 const VOY_CRAFT_MODEL={xwing:'craft_xwing'};
 const trial={P:[0,0,0],rts:{w:{squads:new Map([['sq-1',{foil:.35}]])}}};
 const tv={sub:(a,b)=>a.map((v,i)=>v-b[i])},trialFrame=()=>[1,0,0,0,1,0,0,0,1];
 const voyCraftLoad=()=>{},voyCraftBudget=()=>({sel:1,lead:1,near:1});
 `,c);
 vm.runInContext(section('async function fleetAsset(', 'async function fleetAdd('),c);
 vm.runInContext(section('const voyCraftModel =', '// v22 How many craft'),c);
 vm.runInContext(section('function voyCraftDraw(', '// The camera on the squadron'),c);
 return {run:code=>vm.runInContext(code,c)};
}
test('an embarked design loads its own geometry after the source save is removed',async()=>{
 const {run}=setup();await run('fleetAsset(voyCraftModel("dsnSaved"))');
 assert.equal(run('requests.length'),1);
 assert.equal(run('requests[0].kind'),'fleet');
 assert.equal(run('requests[0].payload.design===blueprint'),true);
 assert.equal(run('loaded[0].key'),'dsnSaved');
 await run('fleetAsset("dsnSaved")');assert.equal(run('requests.length'),1,'the snapshot model is cached');
 assert.equal(run('fleet.assets.get("dsnSaved").design.name'),'User geometry');
});
test('standard types and old performance-only snapshots retain their example models',()=>{
 const {run}=setup();assert.equal(run('voyCraftModel("xwing")'),'craft_xwing');
 assert.equal(run('voyCraftModel("legacy")'),'craft_xwing');assert.equal(run('voyCraftModel(null)'),null);
});
test('an old saved-design reference is available under the key used by the craft renderer',async()=>{
 const {run}=setup();run('fleet.saves=[{id:"old",savedAt:10,data:JSON.stringify(blueprint)}];');
 await run('fleetAsset("save:old")');
 assert.equal(run('fleet.assets.get("save:old")===fleet.assets.get("save:old-10")'),true);
 assert.equal(run('loaded.some(x=>x.key==="save:old")'),true);
});
test('the squadron model uses the runtime deployment of all foils in the saved design',async()=>{
 const {run}=setup();await run('fleetAsset("dsnSaved")');
 run('const B={};voyCraftDraw(B,[{q:{sq:"sq-1",pos:[10,20,30],h:[1,0,0]},mk:"dsnSaved",pri:0,px:20}]);');
 assert.deepEqual(JSON.parse(run('JSON.stringify(B.cfDraw[0].foils)')),{'17':.35,'23':.35});
 assert.equal(run('B.cfDraw[0].key'),'dsnSaved');assert.equal(run('B.cfN'),1);
});
