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
 const v=C.roundLaunchVelocity([100,-30,5],[0,0,2]);assert.deepEqual(v,[100,-30,205]);
 const {a,t,b}=duel();a.velocity=[150,0,0];const rd=C.roundDesignOfKind('cmsl');const m=C.shipMissileRelease(b,a,t,{n:1,tt:1,kind:'cmsl',range:10000,muzzle:[0,0,0],axis:[1,0,0],module:0});
 assert.ok(m.rd,'it carries its design');assert.ok(Math.abs(len([m.vel[0]-150,m.vel[1],m.vel[2]])-200)<1e-6,`${m.vel}`);assert.ok(Math.abs(m.s-len(m.vel))<1e-9);
 const T=C.shipMissileRelease(b,a,t,{n:1,tt:1,kind:'ptorp',torp:true,range:10000,muzzle:[0,0,0],axis:[1,0,0],module:0});assert.ok(Math.abs(len([T.vel[0]-150,T.vel[1],T.vel[2]])-200)<1e-6,'a torpedo too (was 1,200 m/s)');assert.equal(T.rd.use,'sustain');
});
test('accel: the missile preset speeds up by its 1,300 m/s and then coasts; it no longer has a fixed top speed',()=>{
 const {b}=duel(),rd=C.roundDesignOfKind('cmsl'),m=round(rd,{unguided:true});b.missiles=[m];for(let i=0;i<40;i++)C.fleetTick(b,.25,{});
 assert.ok(Math.abs(m.s-1500)<1e-6,`${m.s}`);assert.equal(m.rd.acc,0);
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
 assert.ok(Math.abs(turned-Math.min(rd.latAccel/m.s*.25,300/m.s))<.02,`turned ${turned}`);
 for(let i=0;i<40&&!m.ctlOut;i++)C.fleetTick(b,.25,{});assert.equal(m.ctlOut,true);assert.equal(m.unguided,true);assert.equal(m.rd.ctl,0);
 const dir=m.vel.map(x=>x/len(m.vel));C.fleetTick(b,.25,{});C.fleetTick(b,.25,{});const now=m.vel.map(x=>x/len(m.vel));assert.ok(Math.abs(dir[0]*now[0]+dir[1]*now[1]+dir[2]*now[2]-1)<1e-9,'it flies straight');
});
test('the lateral acceleration is the design\'s: 90 m/s² for the torpedo preset, so it turns 0.15 rad/s at 600 m/s',()=>{
 const T=C.roundDesignOfKind('ptorp');assert.equal(C.roundFlightState(T).lat,90);const m={s:600,rd:C.roundFlightState(T)};assert.ok(Math.abs(C.roundTurnMax(m,1)-.15)<1e-12);
});
