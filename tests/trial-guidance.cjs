// 2026-11-23 Trial guidance for the simulators (user: 「魚雷の誘導は単純追尾、ミサイルの誘導は比例誘導 n_c=N'·v_c·λ̇ … で試験環境に実装して」
// 「とりあえず数式を入れて動かせるようにして、試験は別のAIで空戦を回す形」). Off by default (the game never sets KS_GUIDANCE).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(extra={}){const cx=vm.createContext({console:{log(){},warn(){},error:console.error},...extra});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return vm.runInContext('Core',cx);}
const prof=C=>{const s=C.buildDesign('craft_tie_ln');return JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s)));};
// One round fired along +x at a target 3 km ahead and 1 km to the side, crossing at 200 m/s; returns the round after one step.
function step(C,kind){const P=prof(C),a=C.fleetUnit('a',P.key||'craft_tie_ln',P,0),t=C.fleetUnit('t',P.key||'craft_tie_ln',P,1);a.pos=[0,0,0];t.pos=[3000,0,1000];t.velocity=[0,0,-200];a.velocity=[0,0,0];t.velocity=[0,0,-200];
 const b=C.fleetBattle([a,t],true);const m={id:'m1',salvo:'s',team:0,from:'a',target:'t',n:1,tt:.05,kind,ion:false,range:20000,traveled:0,pos:[0,0,0],vel:[2600,0,0],s:2600,life:30,launchClearance:0,launchDir:[1,0,0]};
 b.missiles=[m];C.fleetTick(b,.05);return b.missiles.find(q=>q.id==='m1')||m;}
test('without the switch neither guidance runs (the game is unchanged)',()=>{const C=runtime();const m=step(C,'cmsl');assert.equal(m.guide,undefined);});
test('a torpedo flies pure pursuit and a missile proportional navigation with KS_GUIDANCE=pn',()=>{
 const C=runtime({KS_GUIDANCE:'pn'});const t=step(C,'itorp');assert.equal(t.guide,'pursuit');
 const m=step(C,'cmsl');assert.equal(m.guide,'pn');assert.ok(m.pnMaxG>0,'a commanded lateral acceleration');
 // n_c = N'·Vc·λ̇ at the first step: r = (3000,0,1000), v_r = (−2600,0,−200)
 const r=[3000,0,1000],vr=[-2600,0,-200],rl=Math.hypot(...r),w=Math.hypot(r[1]*vr[2]-r[2]*vr[1],r[2]*vr[0]-r[0]*vr[2],r[0]*vr[1]-r[1]*vr[0])/(rl*rl),vc=-(r[0]*vr[0]+r[2]*vr[2])/rl;
 const L=m.pnLast;assert.equal(L.N,3);assert.ok(Math.abs(L.accel-L.N*L.vc*L.losRate)<1e-9*L.accel,'n_c = N\'·Vc·λ̇');
 assert.ok(Math.abs(L.vc/vc-1)<.05&&Math.abs(L.losRate/w-1)<.05,`inputs Vc ${L.vc} (≈${vc}), λ̇ ${L.losRate} (≈${w}); the target turns in the same step`);
 const N5=step(runtime({KS_GUIDANCE:'pn',KS_PN_N:5}),'cmsl');assert.ok(Math.abs(N5.pnMaxG/m.pnMaxG-5/3)<1e-6,'N\' scales the command');
});

test('KS_TURN_MASS: a craft turns as its manoeuvring thrusters swing its mass (off by default)',()=>{
 const rate=(C,k)=>{const s=C.buildDesign(k);return C.fleetProfile(C.computeStats(s),s.name,s).turnRate;};
 const off=runtime();assert.equal(rate(off,'craft_tie_ln'),.24,'the present common cap');
 const on=runtime({KS_TURN_MASS:true}),ln=rate(on,'craft_tie_ln'),x=rate(on,'craft_xwing'),y=rate(on,'craft_btlb');
 assert.ok(ln>x&&x>y,`the light TIE turns faster than the X-wing, the Y-wing slower: ${ln} ${x} ${y}`);
 const s=on.buildDesign('craft_xwing'),S=on.computeStats(s),p=on.fleetProfile(S,s.name,s),r=S.craftSystems.maneuverSupport/S.mass;assert.ok(Math.abs(p.turnRate-.24*Math.sqrt(r)*Math.sqrt(12/p.len))<1e-12);
});

test('KS_TURN_VECTOR: a light craft reverses faster when its thrust is pointed off its way (off by default)',()=>{
 const reverse=flags=>{const C=runtime(flags),s=C.buildDesign('craft_tie_ln'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),u=C.fleetUnit('a','craft_tie_ln',p,0);u.pos=[0,0,0];u.yaw=0;u.velocity=[400,0,0];const B=C.fleetBattle([u],true);u.order={type:'move',point:[-20000,0,1],dash:true};
  let aoa=false;for(let t=0;t<30;t+=.25){C.fleetTick(B,.25);const x=B.units[0];if(x.aoa!=null)aoa=true;if(x.velocity[0]<0)return {t,aoa};}return {t:Infinity,aoa};};
 const mass=reverse({KS_TURN_MASS:true}),vec=reverse({KS_TURN_MASS:true,KS_TURN_VECTOR:true});
 assert.equal(mass.aoa,false,'the plain model has no angle of attack');assert.equal(vec.aoa,true);assert.ok(vec.t<mass.t,`reversed in ${vec.t} s against ${mass.t} s`);
});

test('KS_MISSILE_EVADE: a craft with a round closing on it turns onto the beam (off by default)',()=>{
 const setup=flags=>{const C=runtime(flags),s=C.buildDesign('craft_tie_ln'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),u=C.fleetUnit('a','craft_tie_ln',p,0),e=C.fleetUnit('e','craft_tie_ln',p,1);
  u.pos=[0,0,0];u.yaw=0;u.velocity=[300,0,0];e.pos=[20000,0,0];e.yaw=Math.PI;e.velocity=[0,0,0];const B=C.fleetBattle([u,e],true);u.order={type:'move',point:[20000,0,0],dash:true};
  B.missiles=[{id:'m1',salvo:'s',team:1,from:'e',target:'a',n:1,tt:.05,kind:'cmsl',ion:false,range:10000,traveled:0,pos:[-2500,0,0],vel:[2600,0,0],s:2600,life:10,launchClearance:0,launchDir:[1,0,0]}];
  C.fleetTick(B,.25);return B.units.find(x=>x.id==='a');};
 assert.ok(!setup({}).evading,'no evasion without the switch');
 const u=setup({KS_MISSILE_EVADE:true});assert.equal(u.evading,true);const f=u.att?.f||[Math.cos(u.yaw),0,Math.sin(u.yaw)];assert.ok(Math.abs(f[0])<.999,'the nose leaves the line of the round');
});

// 2026-11-23 KS_ROUND_PROFILE / KS_MISSILE_LOCK (user: 「ミサイルは当たるまで敵をカーソル内に…」「魚雷は…減速を続けて最大到達距離で停止、爆発」).
function flyOut(flags,kind,{launcherFaces=[1,0,0],target=[50000,0,30000]}={}){
 const C=runtime(flags),s=C.buildDesign('craft_tie_ln'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),a=C.fleetUnit('a','craft_tie_ln',p,0),t=C.fleetUnit('t','craft_tie_ln',p,1);
 a.pos=[0,0,0];a.yaw=Math.atan2(launcherFaces[2],launcherFaces[0]);a.velocity=[500,0,0];t.pos=target;t.velocity=[0,0,0];const B=C.fleetBattle([a,t],true);a.order={type:'hold',fire:false};t.order={type:'hold',fire:false};
 C.fleetAirRelease(B,a,t,kind,1,C.FLEET_AIR.kinds[1],null);const m=B.missiles[0],speeds=[];let last=m;
 for(let i=0;i<400&&B.missiles.length;i++){C.fleetTick(B,.05);const q=B.missiles.find(x=>x.id===m.id);if(!q)break;speeds.push(q.s);last=q;}
 return {C,m:last,speeds,gone:!B.missiles.some(x=>x.id===m.id)};}
// 2026-11-24 expectation changed (user decision「魚雷の誘導装置は艦艇クラスの重量にしか反応できない。基本的に発射機の慣性で進み…方向転換数、距離によって
// 減衰する」): was "a torpedo leaves 150 m/s faster than its craft and slows evenly to a stop at its 2,000 m reach" (the trial profile, now
// gone). A torpedo leaves at its craft's own speed, has no motor, loses TORPEDO_FLIGHT.perKm of its speed each kilometre, and flies
// straight at a craft (its seeker sees only a ship's mass).
test('a torpedo leaves at its craft\'s speed, only slows with distance, and flies straight at a craft',()=>{
 const r=flyOut({KS_ROUND_PROFILE:true},'ptorp');assert.ok(Math.abs(r.speeds[0]-500)<40,`launched at ${r.speeds[0]} m/s`);
 for(let i=1;i<r.speeds.length;i++)assert.ok(r.speeds[i]<=r.speeds[i-1]+1e-9,'it only slows');
 const km=r.m.traveled/1000,F=r.C.TORPEDO_FLIGHT;assert.ok(Math.abs(r.m.s/(500*Math.exp(-F.perKm*km))-1)<.03,`${r.m.s} m/s after ${km} km (e^(−perKm·km) of the launch speed)`);
 assert.equal(r.m.unguided,true,'no guidance at a craft');
});
test('KS_ROUND_PROFILE: a missile boosts, then slows, and bursts at its reach',()=>{
 const r=flyOut({KS_ROUND_PROFILE:true},'cmsl'),top=Math.max(...r.speeds),k=r.speeds.indexOf(top);assert.ok(k>0&&k<r.speeds.length-1,'it speeds up first and slows after');
 assert.ok(r.speeds.at(-1)<top*.6,`ends at ${r.speeds.at(-1)} of ${top} m/s`);assert.ok(r.gone&&r.m.lost==='spent'&&Math.abs(r.m.traveled-r.C.ROUND_TRIAL.mslRange)<1,`burst after ${r.m.traveled} m`);/* 2026-11-24 expectation changed: the reach is 3,000 m (was 1,500), user 「ミサイルの射程を伸ばして」 */
 const far=flyOut({KS_ROUND_PROFILE:true,KS_MSL_RANGE:2500},'cmsl');assert.ok(Math.abs(far.m.traveled-2500)<1,'KS_MSL_RANGE sets the reach');
});
test('KS_MISSILE_LOCK: a missile stays guided only while its launcher keeps the target in its sight',()=>{
 const inSight=flyOut({KS_MISSILE_LOCK:true,KS_GUIDANCE:'pn'},'cmsl',{target:[3000,0,0]}),away=flyOut({KS_MISSILE_LOCK:true,KS_GUIDANCE:'pn'},'cmsl',{launcherFaces:[-1,0,0],target:[3000,0,0]});
 assert.notEqual(inSight.m.unguided,true);assert.equal(away.m.unguided,true,'the launcher looks the other way');
 const off=flyOut({KS_GUIDANCE:'pn'},'cmsl',{launcherFaces:[-1,0,0],target:[3000,0,0]});assert.notEqual(off.m.unguided,true,'off by default');
});
test('KS_MISSILE_LOCK: the lock is held for a second before a missile may go, and the target is warned at once',()=>{
 /* 2026-11-24 the default lock is 2.5 s (user 「ミサイルロックまでの時間を作る」); this case pins the second with KS_LOCK_S */
 const C=runtime({KS_MISSILE_LOCK:true,KS_LOCK_S:1}),s=C.buildDesign('craft_tie_ln'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),a=C.fleetUnit('a','craft_tie_ln',p,0),t=C.fleetUnit('t','craft_tie_ln',p,1);
 a.pos=[0,0,0];a.yaw=0;t.pos=[1000,0,0];const B=C.fleetBattle([a,t],true);B.time=0;assert.equal(C.craftLockStep(B,a,t,.25,1500),false);assert.equal(t.lockWarn.from,'a');
 B.time=.5;assert.equal(C.craftLockStep(B,a,t,.25,1500),false);B.time=1;assert.equal(C.craftLockStep(B,a,t,.25,1500),true);
 t.pos=[0,0,1000];B.time=1.25;assert.equal(C.craftLockStep(B,a,t,.25,1500),false,'out of the sight the lock is gone');
});
test('KS_MISSILE_LOCK: a lock broken in between starts again (physics review 2026-11-23)',()=>{
 const C=runtime({KS_MISSILE_LOCK:true,KS_LOCK_S:1}),s=C.buildDesign('craft_tie_ln'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),a=C.fleetUnit('a','craft_tie_ln',p,0),t=C.fleetUnit('t','craft_tie_ln',p,1);
 a.pos=[0,0,0];a.yaw=0;t.pos=[1000,0,0];const B=C.fleetBattle([a,t],true);B.time=0;C.craftLockStep(B,a,t,.25,1500);
 t.pos=[0,0,1000];B.time=.5;C.craftLockStep(B,a,t,.25,1500);t.pos=[1000,0,0];B.time=5;assert.equal(C.craftLockStep(B,a,t,.25,1500),false,'held afresh from 5 s');B.time=6;assert.equal(C.craftLockStep(B,a,t,.25,1500),true);
});
test('KS_LOCK_REACT: a warned craft evades with no round in flight, and the trial profile leaves rounds at ships alone',()=>{
 const C=runtime({KS_MISSILE_EVADE:true,KS_LOCK_REACT:true,KS_ROUND_PROFILE:true}),s=C.buildDesign('craft_tie_ln'),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),u=C.fleetUnit('a','craft_tie_ln',p,0),e=C.fleetUnit('e','craft_tie_ln',p,1);
 u.pos=[0,0,0];u.yaw=0;u.velocity=[300,0,0];e.pos=[-1000,0,0];e.yaw=0;const B=C.fleetBattle([u,e],true);B.time=0;u.lockWarn={from:'e',at:0};
 const dest=C.craftMissileEvade(B,u);assert.ok(dest,'evades the locking craft');
 const sh=C.buildDesign('cr90'),sp=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(sh),sh.name,sh))),ship=C.fleetUnit('s','cr90',sp,1);ship.pos=[5000,0,0];B.units.push(ship);B.missiles=[];
 C.fleetAirRelease(B,u,ship,'itorp',1,C.FLEET_AIR.kinds[0],null);assert.equal(B.missiles[0].profile,undefined,'a round at a ship keeps its own reach');
});
