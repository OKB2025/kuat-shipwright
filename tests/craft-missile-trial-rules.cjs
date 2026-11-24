// 2026-11-24 trial missile rules (user: 「ミサイルロックまでの時間を作る 発射後の再装填時間 乱戦下のFFリスク ミサイルの射程を伸ばしてその分
// 旋回を遅くしてヘッドオンで無駄撃ちするようにする」). Opt-in switches for the Node simulators (Core ROUND_TRIAL): KS_MISSILE_LOCK,
// KS_ROUND_PROFILE, KS_MSL_FF and the overrides KS_LOCK_S, KS_MSL_RELOAD, KS_MSL_TURN, KS_MSL_RANGE.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function core(flags={}){const cx=vm.createContext({console:{log(){},warn(){},error:console.error},...flags});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return {C:vm.runInContext('Core',cx),cx};}
const plain=x=>JSON.parse(JSON.stringify(x));
function craft(C,key){const s=C.buildDesign(key),S=C.computeStats(s);return plain(C.fleetProfile(S,s.name,s));}

test('the defaults: a 2.5 s lock, an 8 s reload, a 3,000 m reach and half the turn of a ship round',()=>{
 const {C}=core();assert.equal(C.ROUND_TRIAL.lockS,2.5);assert.equal(C.ROUND_TRIAL.reloadS,8);assert.equal(C.ROUND_TRIAL.mslRange,3000);assert.equal(C.ROUND_TRIAL.turn,.3);
 assert.equal(C.roundTrialRange('cmsl'),3000);assert.equal(C.roundTrialReloadS(),8);
 const o=core({KS_MSL_RANGE:1500,KS_MSL_RELOAD:4});assert.equal(o.C.roundTrialRange('cmsl'),1500);assert.equal(o.C.roundTrialReloadS(),4);
});

test('a lock is ready only after the target has been held in the sight for the lock time',()=>{
 for(const [flags,need] of [[{KS_MISSILE_LOCK:true},2.5],[{KS_MISSILE_LOCK:true,KS_LOCK_S:1},1]]){
  const {C}=core(flags),p=craft(C,'craft_xwing'),q=craft(C,'craft_tie_ln');
  const u=C.fleetUnit('u','craft_xwing',p,0),t=C.fleetUnit('t','craft_tie_ln',q,1);u.pos=[0,0,0];u.yaw=0;t.pos=[1000,0,0];const b=C.fleetBattle([u,t],true);
  let ready=null;for(let s=0;s<=4;s+=.25){b.time=s;if(C.craftLockStep(b,u,t,.25,3000)&&ready==null)ready=s;}
  assert.equal(ready,need,'ready at '+ready+' s');assert.ok(t.lockWarn,'the target is warned from the first moment');
 }
});

test('KS_MSL_FF: a missile bursts on a wingman that crosses its path before the target',()=>{
 const run=ff=>{const {C}=core({KS_ROUND_PROFILE:true,...(ff?{KS_MSL_FF:true}:{})}),p=craft(C,'craft_xwing'),q=craft(C,'craft_tie_ln');
  const a=C.fleetUnit('a','craft_xwing',p,0),w=C.fleetUnit('w','craft_xwing',plain(p),0),t=C.fleetUnit('t','craft_tie_ln',q,1);
  a.pos=[0,0,0];a.yaw=0;w.pos=[900,0,0];w.yaw=0;t.pos=[1800,0,0];t.yaw=0;for(const x of [a,w,t]){x.velocity=[0,0,0];x.order={...x.order,type:'hold',fire:false};}
  const b=C.fleetBattle([a,w,t],true);b.seed=1;C.fleetAirRelease(b,a,t,'cmsl',1,C.FLEET_AIR.kinds[1],null);
  for(let i=0;i<12&&b.missiles?.length;i++)C.fleetTick(b,.25,{});return b.missileLog||{};};
 const on=run(true),off=run(false);
 assert.equal(on.ff,1,'the wingman takes the round: '+JSON.stringify(on));assert.ok(!(off.ff>0),'without the switch the round passes it: '+JSON.stringify(off));
});

test('a trial missile turns at most ROUND_TRIAL.turn: fired head-on and passed, it cannot come back within its reach',()=>{
 const {C}=core({KS_ROUND_PROFILE:true}),p=craft(C,'craft_xwing'),q=craft(C,'craft_tie_ln');
 const a=C.fleetUnit('a','craft_xwing',p,0),t=C.fleetUnit('t','craft_tie_ln',q,1);a.pos=[0,0,0];a.yaw=0;t.pos=[2500,0,0];t.yaw=Math.PI;
 a.velocity=[0,0,0];t.velocity=[0,0,0];for(const x of [a,t])x.order={...x.order,type:'hold',fire:false};
 const b=C.fleetBattle([a,t],true);b.seed=1;C.fleetAirRelease(b,a,t,'cmsl',1,C.FLEET_AIR.kinds[1],null);const m=b.missiles[0];
 // the target is moved behind the round once it is on its way: the round must turn round
 C.fleetTick(b,.25,{});t.pos=[-2500,0,0];let prev=C.norm(m.vel),maxRate=0;
 for(let i=0;i<20&&b.missiles.includes(m)&&m.n>0;i++){C.fleetTick(b,.25,{});const v=C.norm(m.vel),ang=Math.acos(Math.max(-1,Math.min(1,C.dot(prev,v))));maxRate=Math.max(maxRate,ang/.25);prev=v;}
 assert.ok(maxRate<=C.ROUND_TRIAL.turn*1.001,'turn rate '+maxRate+' rad/s');assert.ok(!(b.missileLog?.hit>0),'it does not reach the target behind it');
});

test('KS_MSL_FF: a launcher holds fire while a wingman is in its line to the target',()=>{
 const {C}=core({KS_MSL_FF:true}),p=craft(C,'craft_xwing'),q=craft(C,'craft_tie_ln');
 const a=C.fleetUnit('a','craft_xwing',p,0),w=C.fleetUnit('w','craft_xwing',plain(p),0),t=C.fleetUnit('t','craft_tie_ln',q,1);a.pos=[0,0,0];t.pos=[2000,0,0];
 w.pos=[1000,30,0];assert.equal(C.craftLineClear([a,w,t],a,t),false,'30 m off the line, between');
 w.pos=[1000,120,0];assert.equal(C.craftLineClear([a,w,t],a,t),true,'120 m off the line');
 w.pos=[2500,0,0];assert.equal(C.craftLineClear([a,w,t],a,t),true,'beyond the target');
 const off=core().C;assert.equal(off.craftLineClear([a,{...w,pos:[1000,0,0]},t],a,t),true,'without the switch nothing is held');
});

// 2026-11-24 user decision「魚雷は対艦専門。近接も持たず、誘導は重く、戦闘機に追いつける速度を持たない」.
test('a torpedo is anti-ship: no proximity fuse against a craft, a quarter of a missile\'s turn, launched at its craft\'s speed',()=>{
 const {C}=core({KS_ROUND_PROFILE:true});assert.equal(C.TORPEDO_TURN,.15);assert.equal(C.ROUND_SPEED.torpedo,600);
 const p=craft(C,'craft_xwing'),q=craft(C,'craft_tie_ln');
 const fly=(off,turnTest)=>{const a=C.fleetUnit('a','craft_xwing',plain(p),0),t=C.fleetUnit('t','craft_tie_ln',plain(q),1);a.pos=[0,0,0];a.yaw=0;a.velocity=[1500,0,0];t.pos=[1500,0,0];t.velocity=[0,0,0];
  for(const x of [a,t])x.order={...x.order,type:'hold',fire:false};const b=C.fleetBattle([a,t],true);b.seed=1;C.fleetAirRelease(b,a,t,'ptorp',1,{...C.FLEET_AIR.kinds[1],range:2000},null);const m=b.missiles[0];
  /* 2026-11-24 expectation changed (user「基本的に発射機の慣性で進み（航空機は航空機の速度…）」): was "never faster than 600 m/s" */assert.ok(Math.abs(m.s-1500)<1e-6,'launch speed '+m.s+' = its craft\'s 1,500 m/s');assert.ok(m.inertial);if(!turnTest){m.unguided=true;m.launchDir=C.norm([1500,0,off]);m.vel=C.mul(m.launchDir,m.s);}
  else{C.fleetTick(b,.25,{});t.pos=[-1500,0,0];}let prev=C.norm(m.vel),rate=0;for(let i=0;i<24&&b.missiles.includes(m)&&m.n>0;i++){C.fleetTick(b,.25,{});if(b.missiles.includes(m)){const v=C.norm(m.vel);rate=Math.max(rate,Math.acos(Math.max(-1,Math.min(1,C.dot(prev,v))))/.25);prev=v;}}
  return {log:b.missileLog||{},rate};};
 const beside=fly(8);assert.ok(!(beside.log.hit>0),'passing 8 m beside a TIE it does not burst: '+JSON.stringify(beside.log));
 const onBody=fly(0);assert.ok(onBody.log.hit>=1,'on the body it strikes');
 const turn=fly(0,true);assert.ok(turn.rate<=C.TORPEDO_TURN*1.001,'turn '+turn.rate);
});
