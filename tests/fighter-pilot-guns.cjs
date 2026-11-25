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
// 2026-11-19 fixture changed: trialGunnery now resolves the live unit with trialSystemsUnit() (js/app.js), which lies
// outside the extracted sections; this stub resolves it as tests/dual-purpose-weapons.cjs does.
const trialSystemsUnit=()=>trial.battle?.me||trial.systemsUnit||null;
const toast=s=>notices.push(s),trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialPowerStep=()=>{},trialSalvoPlan=()=>salvo,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],sndAt=(...a)=>sounds.push(a),sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'';
function makeFit(k='claser',extra={}){return {id:1,k,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,...extra};}
function stateFromFit(f){
 const ship=C.newShip({L:12,W:8,H:4,assembly:true});ship.parts=[];ship.fits=[f];
 const t=G.fleetGeometry(ship,{trial:true}).turrets.find(t=>t.id===f.id);if(!t)throw Error('No trial weapon '+f.k);
 const s=trialTurretState(t);s.clear=true;s.clearDir=s.fw.slice();s.charge=1;return s;
}
function reset(k='claser',extra={}){
 notices.length=0;sounds.length=0;aimPoint=[10000,0,0];salvo=null;
 Object.assign(trial,{systemsUnit:{p:{modules:[]}},on:true,craft:true,spectate:false,paused:false,p:{len:12},asset:{stats:{craftSystems:{v:1,managed:true,crew:1,suitSeats:0,lifeSupportHours:1,laserUnits:1,laserGasSeconds:100}},geometry:{center:[0,0,0],targetRadius:5,paint:'republic'}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1000,cap:1000},gun:{shots:0,hits:0,kills:0},bolts:[],emitted:[],seenBolts:new WeakSet(),missiles:[],fx:[],targets:[],rays:{busy:true,last:0}});
 trial.turrets=[stateFromFit(makeFit(k,extra))];trialCraftSystemsReset();
}
function advance(duration,dt=.001){for(let i=0;i<Math.round(duration/dt);i++){trialGunnery(dt);for(const b of trial.bolts)if(!trial.seenBolts.has(b)){trial.seenBolts.add(b);trial.emitted.push(b);}}}
`);
section('const tv=','function trialProfile(');
section('const TRIAL_PILOT_CYCLE=','// opts.design');
section('function authoredTurretPose(','function trialAim(');
section('const TRIAL_PD=','// Small craft and missiles a pilot');
section('function trialCraftSystemsSpec()','function trialReset()');
section('function trialShotGeometry(','// Missiles leave');
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

// 2026-11-24 gun rules (user「航空レーザーは円柱部品でユーザーが口径と長さと連射速度を決める形に」「毎秒1発くらいで」「定格入力で自由に連射速度を決められる形
// （ガスは発射するほど減るし電力量も加熱量も上がる）」): a craft laser's shot is its bore's (C.craftLaserRule), whatever its cadence; the cadence is
// the fit's rateHz (1 a second by default), and energy and gas go by the shots fired. Was: a 0.12 s catalogue period, and a shot that
// carried the per-second output over the period (C.craftShotTT), so a slower gun fired bigger shots.
test('each pilot pulse is the shot of its bore, and energy and gas follow the shots fired when the rate of fire changes',()=>{
 const sample=extra=>{context.extra=extra;run('reset("claser",extra);trial.energy.E=1e-5;globalThis.energy0=trial.energy.E;advance(6)');return plain(run('({shots:trial.gun.shots,energy:energy0-trial.energy.E,gas:100-trial.systemsRuntime.gasSeconds,cycle:trial.turrets[0].cycle,rate:trial.turrets[0].rule.rateHz,costK:trial.turrets[0].costK,boltEnergy:trial.emitted.reduce((n,b)=>n+b.tt,0),bolts:trial.emitted.map(b=>b.tt),hitScales:trial.emitted.map(b=>b.hitScale)})'));};
 const base=sample({}),bolt=Number(run('C.FITS.claser.boltTT'));near(bolt,Number(run('C.laserShotKt(C.CRAFT_LASER_GEOMETRY.claser.bore)/C.KT_PER_TT')),bolt*1e-12);
 assert.equal(base.rate,1);assert.equal(base.cycle,1);assert.equal(base.cycle,run('C.CRAFT_FIRE.cycles.claser'));assert.ok(base.shots>=5&&base.shots<=6,'one shot a second for six seconds: '+base.shots);
 near(base.energy,base.shots*bolt*base.costK,base.energy*1e-9);near(base.boltEnergy,base.shots*bolt,base.boltEnergy*1e-10);assert.ok(base.hitScales.every(k=>k===1),'physical shots are not diluted by a former reference cycle');near(base.gas,base.shots*Number(run('C.FITS.claser.cycle')),1e-8);
 const rapid=sample({rateHz:4});assert.equal(rapid.rate,4);near(rapid.cycle,.25,1e-12);assert.ok(rapid.shots>=base.shots*3.5&&rapid.shots<=24,'four shots a second: '+rapid.shots);
 for(const tt of rapid.bolts)near(tt,bolt,bolt*1e-12);near(rapid.energy,rapid.shots*bolt*rapid.costK,rapid.energy*1e-9);near(rapid.boltEnergy,rapid.shots*bolt,rapid.boltEnergy*1e-10);
 near(rapid.gas,rapid.shots*Number(run('C.FITS.claser.cycle')),1e-8);near(rapid.energy/base.energy,rapid.shots/base.shots,1e-7);near(rapid.gas/base.gas,rapid.shots/base.shots,1e-7);
});

test('normal and coarse frame steps keep the pulse stream steady without saving up idle shots',()=>{
 const samples=[];
 // 2026-11-24: the default cadence is one shot a second; the rapid stream this case steps coarsely is a laser set to ten a second (rateHz, the most a fit allows).
 for(const dt of [.016,.04,.1]){context.dt=dt;run('reset("claser",{rateHz:10});trial.energy.E=1e-5;advance(8,dt)');samples.push(plain(run('({shots:trial.gun.shots,energy:1e-5-trial.energy.E,gas:100-trial.systemsRuntime.gasSeconds})')));}
 for(const sample of samples){assert.ok(sample.shots>=60);assert.ok(Math.abs(sample.shots-samples[0].shots)<=1);assert.ok(Math.abs(sample.energy/samples[0].energy-1)<.03);assert.ok(Math.abs(sample.gas/samples[0].gas-1)<.03);}
 run('reset();advance(1,.04);trial.fire=false;advance(10,.1);const idleCount=trial.gun.shots;trial.fire=true;trialGunnery(.1)');assert.ok(run('trial.gun.shots-idleCount')<=1,'releasing the trigger must not accumulate firing debt');
 run('reset();trial.energy.E=0;advance(10,.1);trial.energy.E=1000;trialGunnery(.04)');assert.ok(run('trial.gun.shots')<=1,'power starvation must not accumulate a backlog of pulses');
});

test('several fixed guns stagger their pulses and the pilot trigger does not wait for a capital salvo',()=>{
 run('reset();trial.turrets=[1,2,3,4].map(id=>stateFromFit(makeFit("claser",{id})));trial.asset.stats.craftSystems.laserUnits=4;trialCraftSystemsReset();const emissionFrames=[];/* 2026-11-24: one period is now 1 s (was 0.12 s) */for(let i=0;i<100;i++){const before=trial.gun.shots;trialGunnery(.01);if(trial.gun.shots>before)emissionFrames.push(trial.gun.shots-before)}');
 assert.deepEqual(plain(run('emissionFrames')),[1,1,1,1]);
 run('reset();salvo=new Set();trial.turrets[0].reload=0;trialGunnery(.016)');assert.equal(run('trial.gun.shots'),1);
});

test('pilot lasers fire once a second by default and at the fit\'s rate of fire, while a rotating turret still tracks the reticle',()=>{
 for(const k of ['claser','claserH']){context.key=k;run('reset(key)');assert.equal(run('trial.turrets[0].pilot'),true);assert.equal(run('trial.turrets[0].cycle'),run('C.CRAFT_FIRE.cycles[key]'));/* 2026-11-24: one shot a second a barrel (was a 0.12-0.18 s period); the cadence is the fit's rateHz */assert.equal(run('trial.turrets[0].cycle'),1);run('reset(key,{rateHz:5})');assert.equal(run('trial.turrets[0].pilot'),true);assert.ok(Math.abs(run('trial.turrets[0].cycle')-.2)<1e-12);assert.deepEqual(plain(run('trialLimits(trial.turrets[0])')),{yaw:0,lo:0,hi:0});}
 run('reset("htl");trial.turrets[0].rateRad=20;aimPoint=[10000,0,10000];trialGunnery(.1)');assert.equal(run('trial.turrets[0].pilot'),false);assert.ok(Math.abs(run('trial.turrets[0].yaw'))>.5);
});

test('actual aircraft model barrels and tiny affordability limits preserve complete physical shots',()=>{
 for(const [k,n]of [['claser',1],['claserH',1],['cturret',2]]){context.key=k;run('reset(key)');assert.equal(run('trial.turrets[0].barrels'),n);near(run('trialShotEnergyTT(trial.turrets[0])'),n*Number(run('C.FITS[key].boltTT')),1e-20);}
 run('reset();trial.turrets[0].reload=0;trial.energy.E=C.FITS[trial.turrets[0].k].boltTT*trial.turrets[0].costK*.99;const insufficient=trial.energy.E;trialGunnery(.016)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.energy.E'),run('insufficient'));
 run('reset();trial.turrets[0].reload=0;trial.energy.E=C.FITS[trial.turrets[0].k].boltTT*trial.turrets[0].costK;trialGunnery(.016)');assert.equal(run('trial.gun.shots'),1);near(run('trial.bolts[0].tt'),Number(run('C.FITS[trial.turrets[0].k].boltTT')),1e-20);assert.equal(run('trial.bolts[0].hitScale'),1);near(run('trial.energy.E'),0,1e-20);
 // 2026-11-19 expectation changed: rapid fire is one shot at a time from the whole mount, barrel after barrel
 // (user decision 2026-11-15, docs/handoff-2026-11-15/README.md:122,135; js/app.js trialGunnery comment). The twin
 // turret's first step fires one barrel and the other follows within a period (was: both barrels in the same step).
 // Bolts move forward within the step, so the two barrels' spacing is compared across the mount (z), not as a distance.
 run('reset("cturret");trial.energy.E=1e-5;trial.turrets[0].reload=0;trialGunnery(.016)');assert.equal(run('trial.gun.shots'),1);assert.equal(run('trial.bolts.length'),1);/* 2026-11-24: the light laser's bolt is gone at its 860 m range (0.19 s of flight), before the other barrel's turn half a second later, so the two bolts are taken as they are emitted (advance) instead of read from trial.bolts after one long step */run('trial.emitted=trial.bolts.slice();for(const b of trial.emitted)trial.seenBolts.add(b);advance(trial.turrets[0].cycle*.6,.016)');assert.equal(run('trial.gun.shots'),2);assert.equal(run('trial.emitted.length'),2);for(const bolt of plain(run('trial.emitted')))near(bolt.tt,Number(run('C.FITS.cturret.boltTT')),1e-20);near(run('Math.abs(trial.emitted[0].pos[2]-trial.emitted[1].pos[2])'),Number(run('C.FITS.cturret.wm'))*.28,1e-6);
});

test('a physical laser pulse requires its complete gas budget and preserves an insufficient remainder',()=>{
 for(const k of ['claser','claserH'])for(const fraction of [0,.99,1]){context.key=k;context.fraction=fraction;run('reset(key);trial.turrets[0].reload=0;trial.fixtureGasNeed=trialCraftGasNeed(trial.turrets[0]);trial.systemsRuntime.gasSeconds=trial.fixtureGasNeed*fraction;trial.fixtureGasBefore=trial.systemsRuntime.gasSeconds;trialGunnery(.016)');assert.ok(run('trial.fixtureGasNeed')>0);assert.equal(run('trial.gun.shots'),fraction===1?1:0,`${k}: gas fraction ${fraction}`);near(run('trial.systemsRuntime.gasSeconds'),fraction===1?0:run('trial.fixtureGasBefore'),1e-12);}
});

test('blocked barrels, empty gas, power shortage and zero-time paused steps do not emit pilot pulses',()=>{
 for(const block of ['trial.turrets[0].clear=false','trial.systemsRuntime.gasSeconds=0','trial.energy.E=0']){run('reset();trial.turrets[0].reload=0;'+block+';advance(1,.04)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);}
 run('reset();trial.paused=true;const before={energy:trial.energy.E,gas:trial.systemsRuntime.gasSeconds};trialGunnery(0);trialGunnery(-1);trialGunnery(NaN)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);assert.deepEqual(plain(run('({energy:trial.energy.E,gas:trial.systemsRuntime.gasSeconds})')),plain(run('before')));
});
