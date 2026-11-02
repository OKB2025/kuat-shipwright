const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const context=vm.createContext({console,performance:{now:()=>0}}),run=code=>vm.runInContext(code,context),plain=v=>JSON.parse(JSON.stringify(v));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,G=Gfx,TT_J=C.TT,trial={},notices=[],sounds=[];
Math.random=()=>.5;
let aimPoint=[10000,0,0],salvo=null;
const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
const toast=s=>notices.push(s),trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialThreats=()=>[],trialPowerStep=()=>{},trialSalvoPlan=()=>salvo,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],sndAt=(...a)=>sounds.push(a),sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'';
function makeFit(k='claser',extra={}){return {id:1,k,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,...extra};}
function stateFromFit(f){
 const ship=C.newShip({L:12,W:8,H:4,assembly:true});ship.parts=[];ship.fits=[f];
 const t=G.fleetGeometry(ship,{trial:true}).turrets.find(t=>t.id===f.id);if(!t)throw Error('No trial weapon '+f.k);
 const s=trialTurretState(t);s.clear=true;s.clearDir=s.fw.slice();s.charge=1;return s;
}
function reset(k='claser',extra={}){
 notices.length=0;sounds.length=0;aimPoint=[10000,0,0];salvo=null;
 Object.assign(trial,{on:true,craft:true,spectate:false,paused:false,p:{len:12},asset:{stats:{craftSystems:{v:1,managed:true,crew:1,suitSeats:0,lifeSupportHours:1,laserUnits:1,laserGasSeconds:100}},geometry:{center:[0,0,0],targetRadius:5,paint:'republic'}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1000,cap:1000},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],rays:{busy:true,last:0}});
 trial.turrets=[stateFromFit(makeFit(k,extra))];trialCraftSystemsReset();
}
function advance(duration,dt=.001){for(let i=0;i<Math.round(duration/dt);i++)trialGunnery(dt);}
`);
section('const tv=','function trialProfile(');
section('const TRIAL_PILOT_CYCLE=','// opts.design');
section('const trialBarrel=','function trialAim(');
section('function trialCraftSystemsSpec()','function trialReset()');
section('function trialGunnery(dt)','// Missiles leave');
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`),vector=(a,b)=>a.forEach((x,i)=>near(x,b[i]));

test('fixed pilot guns fire down the actual barrel even with the reticle to the side or behind',()=>{
 for(const point of [[0,0,10000],[-10000,0,0],[1000,2000,3000]]){
  run('reset()');context.point=point;run('aimPoint=point;trial.turrets[0].reload=0;trialGunnery(.016)');
  assert.equal(run('trial.gun.shots'),1);assert.equal(run('trial.turrets[0].yaw'),0);assert.equal(run('trial.turrets[0].el'),0);
  assert.ok(run('trial.bolts.length')>0);vector(plain(run('tv.norm(trial.bolts[0].vel)')),[1,0,0]);
 }
});

test('side-mounted and sloped fixed guns use the model frame instead of an assumed nose direction',()=>{
 for(const extra of [{a:0},{a:1},{a:2},{a:3},{a:4},{a:5},{a:2,tilt:[.3,.8,.5196152422706632]}]){
  context.extra=extra;run('reset("claser",extra);aimPoint=[-10000,-10000,-10000];trial.turrets[0].reload=0;trialGunnery(.016)');
  const expected=plain(run('C.fitFrameOf(makeFit("claser",extra)).fw'));
  vector(plain(run('trial.turrets[0].fw')),expected);vector(plain(run('tv.norm(trial.bolts[0].vel)')),expected);
  assert.equal(run('trial.gun.shots'),1);assert.equal(run('trial.turrets[0].barrels'),1);
 }
});

test('rapid pilot pulses conserve sustained energy and gas instead of multiplying weapon power',()=>{
 run('reset();const energy0=trial.energy.E;advance(6);const fast={shots:trial.gun.shots,energy:energy0-trial.energy.E,gas:100-trial.systemsRuntime.gasSeconds,cycle:trial.turrets[0].cycle,power:trial.turrets[0].power,costK:trial.turrets[0].costK}');
 const fast=plain(run('fast'));assert.ok(fast.cycle>=.08&&fast.cycle<=.18);assert.ok(fast.shots>=40,'rapid stream needs at least forty pulses in six seconds');
 near(fast.energy,fast.shots*fast.power*fast.cycle*fast.costK/Number(run('TT_J')),Math.max(1e-8,fast.energy*1e-10));near(fast.gas,fast.shots*fast.cycle,1e-8);
 run('reset();trial.turrets[0].cycle=.6;const slowEnergy0=trial.energy.E;advance(6);const slow={shots:trial.gun.shots,energy:slowEnergy0-trial.energy.E,gas:100-trial.systemsRuntime.gasSeconds}');
 const slow=plain(run('slow'));assert.ok(fast.shots>=slow.shots*4);assert.ok(Math.abs(fast.energy/slow.energy-1)<.08);assert.ok(Math.abs(fast.gas/slow.gas-1)<.08);
});

test('normal and coarse frame steps keep the pulse stream steady without saving up idle shots',()=>{
 const samples=[];
 for(const dt of [.016,.04,.1]){context.dt=dt;run('reset();advance(8,dt)');samples.push(plain(run('({shots:trial.gun.shots,energy:1000-trial.energy.E,gas:100-trial.systemsRuntime.gasSeconds})')));}
 for(const sample of samples){assert.ok(sample.shots>=60);assert.ok(Math.abs(sample.shots-samples[0].shots)<=1);assert.ok(Math.abs(sample.energy/samples[0].energy-1)<.03);assert.ok(Math.abs(sample.gas/samples[0].gas-1)<.03);}
 run('reset();advance(1,.04);trial.fire=false;advance(10,.1);const idleCount=trial.gun.shots;trial.fire=true;trialGunnery(.1)');assert.ok(run('trial.gun.shots-idleCount')<=1,'releasing the trigger must not accumulate firing debt');
 run('reset();trial.energy.E=0;advance(10,.1);trial.energy.E=1000;trialGunnery(.04)');assert.ok(run('trial.gun.shots')<=1,'power starvation must not accumulate a backlog of pulses');
});

test('several fixed guns stagger their pulses and the pilot trigger does not wait for a capital salvo',()=>{
 run('reset();trial.turrets=[1,2,3,4].map(id=>stateFromFit(makeFit("claser",{id})));trial.asset.stats.craftSystems.laserUnits=4;trialCraftSystemsReset();const emissionFrames=[];for(let i=0;i<12;i++){const before=trial.gun.shots;trialGunnery(.01);if(trial.gun.shots>before)emissionFrames.push(trial.gun.shots-before)}');
 assert.deepEqual(plain(run('emissionFrames')),[1,1,1,1]);
 run('reset();salvo=new Set();trial.turrets[0].reload=0;trialGunnery(.016)');assert.equal(run('trial.gun.shots'),1);
});

test('all pilot weapon types share short cycles while a rotating turret still tracks the reticle',()=>{
 for(const k of ['claser','claserH','cion']){context.key=k;run('reset(key)');assert.equal(run('trial.turrets[0].pilot'),true);assert.equal(run('trial.turrets[0].cycle'),run('C.CRAFT_FIRE.cycles[key]'));assert.ok(run('trial.turrets[0].cycle')<=.22);assert.deepEqual(plain(run('trialLimits(trial.turrets[0])')),{yaw:0,lo:0,hi:0});}
 run('reset("htl");trial.turrets[0].rateRad=20;aimPoint=[10000,0,10000];trialGunnery(.1)');assert.equal(run('trial.turrets[0].pilot'),false);assert.ok(Math.abs(run('trial.turrets[0].yaw'))>.5);
});

test('blocked barrels, empty gas, power shortage and zero-time paused steps do not emit pilot pulses',()=>{
 for(const block of ['trial.turrets[0].clear=false','trial.systemsRuntime.gasSeconds=0','trial.energy.E=0']){run('reset();trial.turrets[0].reload=0;'+block+';advance(1,.04)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);}
 run('reset();trial.paused=true;const before={energy:trial.energy.E,gas:trial.systemsRuntime.gasSeconds};trialGunnery(0);trialGunnery(-1);trialGunnery(NaN)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);assert.deepEqual(plain(run('({energy:trial.energy.E,gas:trial.systemsRuntime.gasSeconds})')),plain(run('before')));
});
