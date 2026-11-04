const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup({stock=6,descriptorAmmo=6,salvo=1,pitch=30}={}){
 const cx=vm.createContext({console,C,Math:Object.assign(Object.create(Math),{random:()=>.5})}),run=code=>vm.runInContext(code,cx);
 run(`const trial={},notes=[],toast=s=>notes.push(s),sndAt=()=>{},tv={add:(a,b,k=1)=>a.map((n,i)=>n+b[i]*k),sub:C.sub,scale:C.mul,dot:C.dot,len:C.len,norm:C.norm,cross:C.cross};`);
 run(section('function trialRot(','// Column-major frame'));
 run(section('const trialCol=','const trialWrap='));
 run(section('function trialSystemsUnit()','function trialPropulsionMotion('));
 run(section('const TRIAL_MSL=','// The engine tests each barrel direction'));
 run(section('function spaceAmmo(','// The enemy\'s arrival'));
 run(section('function trialMissileHudState()','function trialHudHTML()'));
 run(`const profile={name:'Missile authority',hp:100,D:0,profileVersion:5,
 modules:[{k:'launcher',fit:7,port:'f7',missileKind:'cmsl',stock:6,salvo:1,cycle:1.2,tt:25,muzzle:[5,10,20],launchDir:[1,0,0],launchPowerW:1,powerConnected:true}],grid:{P:100,fixedLoads:[{id:'f7',port:'f7',weight:1}]}},
 unit=C.fleetUnit('manual','manual',profile,0);unit.pw={P:100};unit.propulsion={power:{granted:{'fixed:f7':1}}};unit.ammo[0]=${stock};
 const fitting={id:7,k:'cmsl',p:[5,10,20],a:2,ped:0,base:0,low:0,launchPitch:${pitch}},initial=C.missileLauncherSpec(fitting),launcher={...initial,ammo:${descriptorAmmo},ammo0:${descriptorAmmo},salvo:${salvo},reload:0,queue:0,next:0};
 Object.assign(trial,{p:profile,systemsUnit:unit,battle:{me:unit,modIndex:new Map([[7,0]])},asset:{geometry:{center:[0,0,0]}},launchers:[launcher],R:[1,0,0,0,1,0,0,0,1],P:[100,200,300],V:[5,0,0],missiles:[],fx:[],gun:{missiles:0},aim:{dir:[1,0,0]},mslOrder:false});
 function fire(dt=.01){trial.mslOrder=true;trialMissiles(dt,null);}
 `);
 assert.equal(run('C.missileLauncherPowered(unit,0)'),true,'fixture must have an actual supplied launcher electronics port');
 return {run,cx};
}

test('manual flight spends the authoritative unit ammunition once for each actual shot',()=>{
 const {run}=setup();assert.equal(run('spaceAmmo(launcher,false)'),true);assert.equal(run('unit.ammo[0]'),6,'eligibility must not consume the inventory');
 run('fire()');assert.equal(run('trial.gun.missiles'),1);assert.equal(run('unit.ammo[0]'),5);assert.equal(run('launcher.ammo'),5);
 run('trialMissiles(2,null)');assert.equal(run('unit.ammo[0]'),5,'a later ballistic update cannot spend the same shot again');
});

test('re-entering piloting cannot refill a six-round descriptor over a depleted battle module',()=>{
 const {run}=setup();run('unit.ammo[0]=2;fire()');assert.equal(run('unit.ammo[0]'),1);
 run('trial.launchers=[{...C.missileLauncherSpec(fitting),reload:0,queue:0,next:0}];fire()');assert.equal(run('unit.ammo[0]'),0);assert.equal(run('trial.launchers[0].ammo'),0);assert.equal(run('trial.gun.missiles'),2);
 run('trial.launchers=[{...C.missileLauncherSpec(fitting),reload:0,queue:0,next:0}];fire()');assert.equal(run('trial.gun.missiles'),2);assert.equal(run('unit.ammo[0]'),0);
});

test('a selected aircraft load of two or zero rounds is not replaced by the canonical six-round capacity',()=>{
 for(const load of [0,2]){
  const {run}=setup({stock:6,descriptorAmmo:load});
  for(let i=0;i<3;i++)run('launcher.reload=0;fire(.2)');
  assert.equal(run('trial.gun.missiles'),load);assert.equal(run('launcher.ammo'),0);
  assert.equal(run('unit.ammo[0]'),0,'only the selected physical load is retained in the authoritative module');
 }
});

test('the selected aircraft load is committed once to the powered unit and persists across pilot entries',()=>{
 const {run}=setup({stock:6,descriptorAmmo:2});assert.equal(run('spaceAmmo(launcher,false)'),true);assert.equal(run('unit.ammo[0]'),2);assert.equal(run("unit.missileLoadCaps['7']"),2);assert.equal(run('profile.modules[0].stock'),6,'shared blueprint capacity is immutable');
 run('fire()');assert.equal(run('unit.ammo[0]'),1);
 run('trial.launchers=[{...C.missileLauncherSpec(fitting),ammo:2,ammo0:2,reload:0,queue:0,next:0}];fire()');assert.equal(run('unit.ammo[0]'),0);assert.equal(run('trial.gun.missiles'),2);
 run('trial.launchers=[{...C.missileLauncherSpec(fitting),reload:0,queue:0,next:0}];fire()');assert.equal(run('unit.ammo[0]'),0);assert.equal(run('trial.gun.missiles'),2);
 run('unit.ammo[0]=6;trial.launchers[0].reload=0;fire(.2)');assert.equal(run('unit.ammo[0]'),1,'a fresh six-round descriptor still obeys the unit’s selected two-round load limit');
});

test('an unpowered descriptor cannot commit or spend a provisional aircraft load',()=>{
 const {run}=setup({stock:6,descriptorAmmo:2});run('unit.pw.P=0');assert.equal(run('spaceAmmo(launcher,true,1)'),false);assert.equal(run('unit.ammo[0]'),6);assert.equal(run('unit.missileLoadCaps'),undefined);
 run('unit.pw.P=100;fire()');assert.equal(run('unit.ammo[0]'),1);assert.equal(run("unit.missileLoadCaps['7']"),2);
});

test('a legitimate supply refill is visible through the authoritative unit without exceeding selected capacity',()=>{
 const {run}=setup({stock:1,descriptorAmmo:2});run('fire()');assert.equal(run('launcher.ammo'),0);assert.equal(run('unit.ammo[0]'),0);
 run('unit.ammo[0]=6;launcher.reload=0;fire(.2)');assert.equal(run('unit.ammo[0]'),1);assert.equal(run('launcher.ammo'),1,'the selected two-round magazine limits the refilled inventory');
});

test('zero generation and a lost electronics grant block new orders without spending ammunition',()=>{
 for(const stop of ['unit.pw.P=0',"unit.propulsion.power.granted['fixed:f7']=0"]){
  const {run}=setup();run(stop+';fire()');assert.equal(run('trial.gun.missiles'),0);assert.equal(run('launcher.queue'),0);assert.equal(run('unit.ammo[0]'),6);assert.match(run('notes.at(-1)'),/給電/);
 }
});

test('power lost during a ripple pauses pending shots and resumes without double consumption',()=>{
 const {run}=setup({salvo:3});run('fire()');assert.equal(run('trial.gun.missiles'),1);assert.equal(run('launcher.queue'),2);assert.equal(run('unit.ammo[0]'),5);
 run("unit.propulsion.power.granted['fixed:f7']=0;trialMissiles(10,null)");assert.equal(run('trial.gun.missiles'),1);assert.equal(run('launcher.queue'),2);assert.equal(run('unit.ammo[0]'),5);
 run("unit.propulsion.power.granted['fixed:f7']=1;trialMissiles(.15,null);trialMissiles(.15,null)");assert.equal(run('trial.gun.missiles'),3);assert.equal(run('launcher.queue'),0);assert.equal(run('unit.ammo[0]'),3);
});

test('the exact pitched tube axis survives ship rotation and the initial missile boost',()=>{
 const {run}=setup({pitch:45});run('trial.R=[0,0,1,0,1,0,-1,0,0];fire()');
 const expected=plain(run('trialApply(trial.R,initial.axis)')),actual=plain(run('trial.missiles[0].h'));for(let i=0;i<3;i++)near(actual[i],expected[i]);
 const mouth=plain(run('tv.add(trial.P,trialApply(trial.R,initial.origin))')),previous=plain(run('trial.missiles[0].prev'));for(let i=0;i<3;i++)near(previous[i],mouth[i]);
 run('trialMissiles(.2,null)');for(let i=0;i<3;i++)near(run(`trial.missiles[0].h[${i}]`),expected[i]);assert.ok(run('trial.missiles[0].boost>0'));
});

test('zero or invalid elapsed time cannot launch or consume inventory',()=>{
 const {run}=setup();for(const dt of ['0','-1','NaN','Infinity'])run(`trial.mslOrder=true;trialMissiles(${dt},null)`);
 assert.equal(run('trial.gun.missiles'),0);assert.equal(run('unit.ammo[0]'),6);assert.equal(run('launcher.queue'),0);
});

test('only a launcher without an authoritative module uses its local stores',()=>{
 const {run}=setup({descriptorAmmo:2});run('trial.battle=null;trial.p={};trial.systemsUnit=null;trial.swSolo=null');
 assert.equal(run('spaceAmmo(launcher)'),true);assert.equal(run('launcher.ammo'),1);assert.equal(run('unit.ammo[0]'),6);assert.equal(run('spaceAmmo(launcher)'),true);assert.equal(run('spaceAmmo(launcher)'),false);
});

test('manual HUD shows native salvo, actual cycle and finite ammunition instead of legacy constants',()=>{
 const {run}=setup();assert.equal(run('trialMissileHudState().text'),'1 発');assert.equal(run('trialMissileHudState().ready'),true);
 run('launcher.reload=.6');near(run('trialMissileHudState().fill'),.5);assert.equal(run('trialMissileHudState().text'),'1 秒');
 run("unit.propulsion.power.granted['fixed:f7']=0");assert.equal(run('trialMissileHudState().text'),'給電停止');assert.equal(run('trialMissileHudState().ready'),false);
 run("unit.propulsion.power.granted['fixed:f7']=1;unit.ammo[0]=0;launcher.reload=0");assert.equal(run('trialMissileHudState().text'),'残弾なし');assert.equal(run('trialMissileHudState().ready'),false);
 run('trial.launchers=[]');assert.equal(run('trialMissileHudState().text'),'発射管なし');
});

test('manual HUD retains a legacy launcher’s eight-round salvo and twenty-second cycle',()=>{
 const {run}=setup();run("trial.battle=null;trial.p={};trial.systemsUnit=null;trial.swSolo=null;trial.launchers=[{id:9,salvo:8,cycle:20,ammo:16,ammo0:16,reload:0}]");
 assert.equal(run('trialMissileHudState().text'),'8 発');run('trial.launchers[0].reload=10');near(run('trialMissileHudState().fill'),.5);
});
