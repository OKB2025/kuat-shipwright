// 2026-11-27 Designed rounds in flight (docs/missile-design-spec-2026-11-27.md, stage 2): a round leaves at its launcher's velocity plus
// 200 m/s along the launcher; its main propellant speeds it up ('accel') or holds its speed ('sustain'); it turns at its lateral
// acceleration while its control propellant lasts, and flies straight from the moment it is spent. The fleet battle and the strategic
// battle use the same rules.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx).designs,copy=x=>JSON.parse(JSON.stringify(x));
const len=v=>Math.hypot(...v);
function duel(dist=60000){const a=C.fleetUnit('a','cr90',copy(F.cr90.p),0),t=C.fleetUnit('t','cr90',copy(F.cr90.p),1);for(const u of [a,t]){u.velocity=[0,0,0];u.order={...u.order,type:'hold',fire:false};}a.pos=[0,0,0];t.pos=[0,dist,0];
 for(const u of [a,t])C.setAutomaticPointDefense?.(u,false);const b=C.fleetBattle([a,t],true);b.seed=1;return {a,t,b};}
const round=(rd,extra={})=>({id:'m1',salvo:'s',team:0,from:'a',target:'t',n:1,tt:1,kind:'cmsl',ion:false,range:400000,traveled:0,pos:[100,0,0],vel:[200,0,0],s:200,life:300,launchClearance:0,launchDir:[1,0,0],rd:C.roundFlightState(rd),...extra});
test('the launch: the carrier\'s velocity plus 200 m/s along the launcher',()=>{
 const v=C.roundLaunchVelocity([100,-30,5],[0,0,2]);assert.deepEqual([...v],[100,-30,205]);
 const {a,t,b}=duel();a.velocity=[150,0,0];const rd=C.roundDesignOfKind('cmsl');const m=C.shipMissileRelease(b,a,t,{n:1,tt:1,kind:'cmsl',range:10000,muzzle:[0,0,0],axis:[1,0,0],module:0});
 assert.ok(m.rd,'it carries its design');assert.ok(Math.abs(len([m.vel[0]-150,m.vel[1],m.vel[2]])-200)<1e-6,`${m.vel}`);assert.ok(Math.abs(m.s-len(m.vel))<1e-9);
 const T=C.shipMissileRelease(b,a,t,{n:1,tt:1,kind:'ptorp',torp:true,range:10000,muzzle:[0,0,0],axis:[1,0,0],module:0});assert.ok(Math.abs(len([T.vel[0]-150,T.vel[1],T.vel[2]])-200)<1e-6,'a torpedo too (was 1,200 m/s)');assert.equal(T.rd.use,'sustain');
});
test('accel: the missile preset speeds up by its 1,300 m/s and then coasts; it no longer has a fixed top speed',()=>{
 const {b}=duel(),rd=C.roundDesignOfKind('cmsl'),m=round(rd,{unguided:true});b.missiles=[m];for(let i=0;i<40;i++)C.fleetTick(b,.25,{});
 assert.ok(Math.abs(m.s-200-rd.accelDv)<1e-6&&Math.abs(m.s-1500)<.1,`${m.s}`);assert.equal(m.rd.acc,0);
 const big=C.roundDesign(.12,.9,{warhead:.2,control:.05,accel:.75}),q=round(big,{unguided:true}),{b:b2}=duel();b2.missiles=[q];for(let i=0;i<40;i++)C.fleetTick(b2,.25,{});
 assert.ok(q.s>1500+1000,`more main propellant, more speed: ${q.s}`);assert.ok(Math.abs(q.s-200-big.accelDv)<1e-6);
});
test('sustain: a torpedo\'s main propellant makes good what flight takes until it is spent; without any it slows as before',()=>{
 const flight=rd=>{const {b}=duel(),m=round(rd,{kind:'ptorp',torp:true,inertial:true,torpLen:1.3,vel:[600,0,0],s:600,unguided:true});b.missiles=[m];for(let i=0;i<20;i++)C.fleetTick(b,.25,{});return m;};
 const none=flight(C.roundDesignOfKind('ptorp')),some=flight(C.roundDesign(.18,1,{warhead:.9,control:.05,accel:.05,use:'sustain'}));
 assert.ok(none.s<600,'the preset (no main propellant) slows');assert.ok(Math.abs(some.s-600)<1e-6,`held at 600 m/s: ${some.s}`);assert.ok(some.rd.acc>0&&some.rd.acc<C.roundDesign(.18,1,{warhead:.9,control:.05,accel:.05,use:'sustain'}).accelDv);
});
test('turning: full lateral acceleration while control propellant is left; straight on from the moment it is spent',()=>{
 const {b,t}=duel(20000),rd=C.roundDesignOfKind('cmsl'),m=round(rd);m.rd.ctl=300/* a little left */;t.pos=[0,20000,0];b.missiles=[m];
 const before=[...m.vel];C.fleetTick(b,.25,{});const turned=Math.acos(Math.max(-1,Math.min(1,(before[0]*m.vel[0]+before[1]*m.vel[1]+before[2]*m.vel[2])/(len(before)*len(m.vel)))));
 assert.ok(Math.abs(turned-Math.min(rd.latAccel/m.s*.25,300/m.s))<1e-6,`turned ${turned}`);assert.ok(Math.abs(m.rd.ctl-(300-m.s*turned))<1e-6,'the turn is paid for at v·θ');
 for(let i=0;i<40&&!m.ctlOut;i++)C.fleetTick(b,.25,{});assert.equal(m.ctlOut,true);assert.equal(m.unguided,true);assert.equal(m.rd.ctl,0);
 const dir=m.vel.map(x=>x/len(m.vel));C.fleetTick(b,.25,{});C.fleetTick(b,.25,{});const now=m.vel.map(x=>x/len(m.vel));assert.ok(Math.abs(dir[0]*now[0]+dir[1]*now[1]+dir[2]*now[2]-1)<1e-9,'it flies straight');
});
test('the lateral acceleration is the design\'s: 90 m/s² for the torpedo preset, so it turns 0.15 rad/s at 600 m/s',()=>{
 const T=C.roundDesignOfKind('ptorp');assert.equal(C.roundFlightState(T).lat,90);const m={s:600,rd:C.roundFlightState(T)};assert.ok(Math.abs(C.roundTurnMax(m,1)-.15)<1e-12);
});
// The strategic battle (Rts) flies designed rounds by the same rules (user「戦略画面は…同じ弾の性質と迎撃・被弾の決まりを使う」).
const {R}=vm.runInContext('({R:Rts})',cx);
const pdShip=(()=>{const ship=C.newShip({L:500,W:300,H:160,plan:'rect',sec:'rect'},'PD');ship.parts=[{id:1,k:'gen',d:100,c:[250,80,0]},{id:3,k:'fuel',d:40,c:[100,80,0]},{id:4,k:'pump',d:21,c:[250,80,-75]}];
 ship.fits=[{id:2,k:'pd',p:[250,160,0],a:2,ped:0,base:0,low:0,float:false}];ship.nextId=5;return C.fleetProfile(C.computeStats(ship),ship.name,ship);})();
function rtsRound(q){const w=R.createWorld({region:'kuat',seed:3,sensors:false,designs:[{key:'own',name:'Own',p:copy(pdShip),info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:copy(pdShip),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]});
 const [u,e]=[...w.units.values()],sys=u.sys;for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[200000,0,0],yaw:0,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:false,power:'balanced',aim:'auto',volley:'stream'}});e.manual=true;C.setAutomaticPointDefense(u,false);
 const m={id:'d',sys,side:1,from:e.id,target:u.id,n:1,tt:1,kind:'cmsl',pos:[150000,0,0],vel:[0,200,0],s:200,life:300,range:400000,traveled:0,...q};w.missiles.push(m);return {w,m};}
test('the strategic battle: the same thrust and the same turn limit (lateral acceleration while control propellant lasts)',()=>{
 const rd=C.roundDesignOfKind('cmsl'),{w,m}=rtsRound({rd:C.roundFlightState(rd)});
 const v0=[...m.vel];R.tick(w,.25);const turned=Math.acos((v0[0]*m.vel[0]+v0[1]*m.vel[1])/(len(v0)*len(m.vel)));
 assert.ok(Math.abs(turned-rd.latAccel/m.s*.25)<1e-6,`turned ${turned} at ${m.s} m/s (lateral ${rd.latAccel} m/s²)`);
 for(let i=0;i<40;i++)R.tick(w,.25);/* 2026-11-28 (physics review; user「弾体の向き・姿勢変更は無料」) the motor pushes along the body, which points at the target while the velocity still turns: the whole Δv is delivered, the speed is at most 200 m/s + Δv (was exactly 200 + Δv, the thrust along the velocity) */assert.equal(m.rd.acc,0,'all its main propellant burnt');assert.ok(m.s<=200+rd.accelDv+1e-6&&m.s>rd.accelDv-200,`${m.s}`);
 const {w:w2,m:q}=rtsRound({rd:{...C.roundFlightState(rd),ctl:50}});for(let i=0;i<6;i++)R.tick(w2,.25);assert.equal(q.ctlOut,true,'its control propellant spent, it flies straight');assert.equal(q.unguided,true);
});
test('physics review 2026-11-27: the main propellant burns in 1.74 s whatever the share (the acceleration grows as the round lightens)',()=>{
 for(const share of [.25,.75]){const rd=C.roundDesign(.12,.9,{warhead:.95-share,control:.05,accel:share}),{b}=duel(),m=round(rd,{unguided:true});b.missiles=[m];
  for(let i=0;i<6;i++)C.fleetTick(b,.25,{});assert.ok(m.s<200+rd.accelDv-1,`at 1.5 s still burning (${share}): ${m.s}`);C.fleetTick(b,.25,{});assert.ok(Math.abs(m.s-200-rd.accelDv)<1e-6,`burnt out by 1.75 s (${share}): ${m.s}`);}
});
// 2026-11-28 (physics review; user「弾体の向き・姿勢変更は無料」): was「clearing the tube keeps the launch velocity's way」(the thrust lay along the
// velocity). The motor pushes along the body, the launcher's axis while it clears its tube: the ship's velocity stays, the Δv goes along the launcher.
test('physics review 2026-11-28: while it clears its tube the motor pushes along the launcher, the ship\'s velocity kept (fleet and strategic battle)',()=>{
 const {a,t,b}=duel();a.velocity=[600,0,0];const m=C.shipMissileRelease(b,a,t,{n:1,tt:1,kind:'cmsl',range:10000,muzzle:[0,0,0],axis:[0,1,0],module:0});
 assert.ok(m.launchClearance>0,'a native launcher clears its tube');assert.deepEqual([...m.hd],[0,1,0]);m.unguided=true;const v0=[...m.vel];C.fleetTick(b,.25,{});
 assert.ok(Math.abs(m.vel[0]-v0[0])<1e-9&&Math.abs(m.vel[2]-v0[2])<1e-9,`the ship's velocity kept: ${m.vel}`);assert.ok(m.vel[1]>v0[1]+1,'the Δv along the launcher');
 const {w,m:q}=rtsRound({rd:C.roundFlightState(C.roundDesignOfKind('cmsl')),hd:[0,1,0],vel:[600,200,0],s:Math.hypot(600,200),launchDir:[0,1,0],launchClearance:.35,launchOrigin:[150000,0,0],unguided:true});R.tick(w,.25);
 assert.ok(Math.abs(q.vel[0]-600)<1e-9&&q.vel[1]>201,`strategic battle: ${q.vel}`);
});
// A rear launcher on a fast ship: the round still drives back along its launcher, toward the target behind.
test('physics review 2026-11-28: a rear launcher of a ship at 600 m/s: the motor drives the round back, against the ship\'s way',()=>{
 const {a,t,b}=duel();a.velocity=[600,0,0];const m=C.shipMissileRelease(b,a,t,{n:1,tt:1,kind:'cmsl',range:10000,muzzle:[0,0,0],axis:[-1,0,0],module:0});
 t.pos=[-20000,0,0];t.velocity=[0,0,0];assert.ok(m.vel[0]>0,'it leaves going forward at 400 m/s');for(let i=0;i<8;i++)C.fleetTick(b,.25,{});assert.ok(m.vel[0]<-500,`the motor turned it back: ${m.vel}`);
});

test('regression review 2026-11-27: in the strategic battle a torpedo that slows to its stop in the step its path meets the target still strikes',()=>{
 const {w,m}=rtsRound({kind:'ptorp',torp:true,inertial:true,torpLen:1.3,rd:C.roundFlightState(C.roundDesignOfKind('ptorp')),pos:[150,0,0],vel:[-100.05,0,0],s:100.05,range:400000,unguided:true});
 const u=[...w.units.values()][0];u.pos=[0,0,0];R.tick(w,.25);assert.ok(m.s<100,'it slowed past its stop this step');assert.ok(m.hit>0,'and still struck');
});
