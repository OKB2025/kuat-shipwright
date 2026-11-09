const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {C, R} = vm.runInContext('({C:Core,R:Rts})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const dragSmallMass=C.ENGINE_CONVERSION.referenceSmallMassKg,dragLargeMass=C.ENGINE_CONVERSION.referenceLargeMassKg,dragSmallRate=3999.1037971899486*C.G0*C.FLEET_RULES.accelScale/2000,dragLargeRate=2972.473437207956*C.G0*C.FLEET_RULES.accelScale/1000,dragExponent=Math.log(dragLargeRate/dragSmallRate)/Math.log(dragLargeMass/dragSmallMass),expectedDragRate=mass=>dragSmallRate*Math.pow(mass/dragSmallMass,dragExponent);
const driveWattsPerNewton=C.engineConversionCoefficient(1e6),fullThrustN=1e18/driveWattsPerNewton,fullAcceleration=fullThrustN/1e6,fullGameAcceleration=fullAcceleration*C.FLEET_RULES.accelScale;
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
const nearVector=(a,b)=>b.forEach((v,i)=>near(a[i],v));
function analyticMotion(u,v,a,dt){const k=expectedDragRate(u.p.propulsion.massKg),x=k*dt,e=Math.exp(-x),g=-Math.expm1(-x)/k,h=x<1e-3?dt*dt*(.5-x/6+x*x/24-x*x*x/120):(dt-g)/k;return {v:v.map((n,i)=>n*e+a[i]*g),dp:v.map((n,i)=>n*g+a[i]*h),gain:g};}
function profile() {
  const engine = {id: 2, machineryId: 2, ratedInputW: 1e18,
    wattsPerNewton: driveWattsPerNewton, ratedThrustN: fullThrustN, driveProfileId: 'standard',
    machineryGradeId: 'standard', machineryLengthM: 2, machineryRadiusM: 1,
    effectiveMachineryVolumeM3: 2 * Math.PI * (.78 * .78 + .78 + 1) / 3,
    moduleIndex: 1, powerNode: 'p2', heatNode: 'p2', domain: 'main',
    direction: [1, 0, 0], valid: true, available: true, connected: true,
    outletAvailable: true, pathCapacityW: 1e18};
  return {profileVersion:C.FLEET_PROFILE_VERSION,name: 'Motion fixture', hp: 100, D: 0, shieldBuffer: 0, reserve: 0,
    wCap: 0, crewNeed: 1, crewMax: 1, len: 10, width: 4, height: 3,
    maxSpeed: 1000, turnRate: .2, accel: 999999, acc: 1,
    gunArcs: [0, 0, 0, 0, 0, 0], ionArcs: [0, 0, 0, 0, 0, 0],
    modules: [{k: 'reactor', part: 1, port: 'p1', name: 'Reactor', share: 1,
      size: 1, domain: 'main', at: .5},
    {k: 'engine', part: 2, port: 'p2', name: 'Engine', share: 1,
      size: 1, domain: 'main', at: .1}],
    grid: {P: 1e18, Pgen: 1e18, Paux: 0, fixed: 0, cooling: 0,
      De: 1e18, Ds: 0, Dw: 0},
    propulsion: {version: 1, engines: [engine], massKg: 1e6,
      ratedThrustN: fullThrustN, ratedAccelMps2: fullAcceleration, accelerationLimitMps2: fullAcceleration}};
}
function unit() { return C.fleetUnit('motion-test', 'motion', profile()); }

test('motion uses the actual physical result and the tactical scale exactly once', () => {
  const u = unit();C.allocateShipPower(u, C.fleetSystems(u), {throttle: 0}, 0);
  u.mods[1] = .25;u.ht.lim.engine = .25;
  u.propulsion = {actualAccelMps2: fullAcceleration * .25, outputRatio: .25};
  assert.equal(C.propulsionMotion(u).acc0, fullGameAcceleration);
  near(C.propulsionMotion(u).acc, fullGameAcceleration * .25);
  near(C.propulsionMotion(u).turn, .25);
  near(C.propulsionMotion(u, .5).acc, fullGameAcceleration * .125);
  u.propulsion.actualAccelMps2 = 0;
  assert.equal(C.propulsionMotion(u).acc, 0);
  assert.equal(C.propulsionMotion(u).turn, 0);
  delete u.propulsion;
  assert.equal(C.propulsionMotion(u).acc, 0);
});

test('fleet movement receives this tick\'s allocation and never rotates drifting velocity', () => {
  const u = unit();u.velocity = [40, 2, 3];u.yaw = .2;
  u.order = {...u.order, type: 'move', point: [0, 0, 10000]};
  u.p.grid.P = 0;u.p.grid.Pgen = 0;
  const b = C.fleetBattle([u], false);
  C.fleetTick(b, .25, {collide: false});
  const expected=analyticMotion(u,[40,2,3],[0,0,0],.25);nearVector(u.velocity,expected.v);nearVector(u.pos,expected.dp);
  assert.equal(u.out,'電源喪失');
  assert.equal(u.yaw, .2);
  assert.equal(u.engF, 0);
});

test('fleet acceleration is bounded by supplied force rather than legacy p.accel', () => {
  const u = unit();u.order = {...u.order, type: 'move', point: [10000, 0, 0]};
  const b = C.fleetBattle([u], false);
  C.fleetTick(b, .25, {collide: false});
  near(u.velocity[0],analyticMotion(u,[0,0,0],[fullGameAcceleration,0,0],.25).v[0]);
  assert.equal(u.propulsion.actualInputW, 1e18);
  near(u.propulsion.actualAccelMps2, fullAcceleration);
});

test('peaceful movement shares current power and uses disabled gravity after a blackout', () => {
  const u = unit();u.sys = 0;u.side = 0;u.info = {mass: 1000};
  u.order = {...u.order, type: 'move', point: [10000, 0, 0]};
  const w = {time: 10, rand:()=>.5, units: new Map([[u.id, u]]), groups: new Map(),
    ctgs: new Map(), battles: new Map(), sides: [], sensors: false};
  R.peaceTick(w, 0, .25);
  near(u.velocity[0],analyticMotion(u,[0,0,0],[fullGameAcceleration,0,0],.25).v[0]);
  assert.equal(u.propulsion.actualInputW, 1e18);
  u.p.grid.P = 0;u.p.grid.Pgen = 0;u.velocity = [40, 2, 3];
  const position = u.pos.slice(), heading = u.yaw;w.time += .25;
  R.peaceTick(w, 0, .25);
  const expected=analyticMotion(u,[40,2,3],[0,-C.HULL_FALL.g,0],.25);nearVector(u.velocity,expected.v);nearVector(u.pos,position.map((v,i)=>v+expected.dp[i]));
  assert.equal(u.out,'電源喪失');
  assert.equal(u.yaw, heading);
  assert.equal(u.propulsion.actualInputW, 0);
});

test('an aircraft without an engine descriptor drifts instead of acquiring a speed fallback', () => {
  R.CRAFT.motionNoEngine = {name: 'No engine', role: 'fighter', speed: 1000};
  const s = {id: 'no-engine', craft: 'motionNoEngine', side: 0,
    h: [1, 0, 0], pos: [0, 0, 0], vel: [40, 2, 3]};
  R.steer(s, [0, 0, 1000], 1000, .25);
  assert.deepEqual(plain(s.vel), [40, 2, 3]);
  assert.deepEqual(plain(s.pos), [10, .5, .75]);
  assert.deepEqual(plain(s.h), [1, 0, 0]);
});

test('zero aircraft throttle follows the live nose without added speed while paid steering keeps its force bound', () => {
  R.CRAFT.motionPowered = {name: 'Powered', role: 'fighter', speed: 1000,
    powerProfile: profile()};
  const s = {id: 'powered', craft: 'motionPowered', side: 0,
    h: [1, 0, 0], pos: [0, 0, 0], vel: [40, 2, 3], throttle: 0};
  R.steer(s, [0, 0, 1000], 1000, .25);
  const mass=s.drive.p.propulsion.massKg,maximumRate=8,smallRate=Math.LN2/.3,largeRate=Math.LN2/90,
    exponent=Math.log((maximumRate/largeRate-1)/(maximumRate/smallRate-1))/Math.log(dragLargeMass/dragSmallMass),
    pivot=dragSmallMass/Math.pow(maximumRate/smallRate-1,1/exponent),alignment=maximumRate/(1+Math.pow(mass/pivot,exponent)),
    initial=[40,2,3],speed=Math.hypot(...initial),side=Math.hypot(initial[1],initial[2]),theta0=Math.atan2(side,initial[0]),
    expectedAt=t=>{const theta=theta0*Math.exp(-alignment*t),magnitude=speed*Math.exp(-expectedDragRate(mass)*t);return [magnitude*Math.cos(theta),magnitude*Math.sin(theta)*initial[1]/side,magnitude*Math.sin(theta)*initial[2]/side];};
  nearVector(s.vel,expectedAt(.25));near(Math.hypot(...s.vel),speed*Math.exp(-expectedDragRate(mass)*.25));
  // Independently integrate the continuously curving coast, including its
  // displacement, rather than projecting the whole frame onto its final nose.
  const N=2048,h=.25/N,position=[0,0,0];for(let n=0;n<=N;n++){const v=expectedAt(n*h),weight=n===0||n===N?1:n%2?4:2;for(let i=0;i<3;i++)position[i]+=v[i]*weight*h/3;}nearVector(s.pos,position);
  assert.deepEqual(plain(s.h), [1, 0, 0]);
  assert.equal(s.propulsion.actualInputW, 0);
  assert.ok(!s.drive.out,'zero throttle does not disable an electrically live craft');
  s.throttle = 1;const before = s.vel.slice();
  R.steer(s, [0, 0, 1000], 1000, .25);
  const coast=analyticMotion(s.drive,before,[0,0,0],.25),fundedChange=fullGameAcceleration*coast.gain,
    coastSpeed=Math.hypot(...coast.v),actualSpeed=Math.hypot(...s.vel);
  assert.ok(actualSpeed>0&&actualSpeed<=coastSpeed+fundedChange+1e-10,'nose following cannot add speed beyond the funded thrust and passive drag');
  assert.ok(actualSpeed>=Math.max(0,coastSpeed-fundedChange)-1e-10,'directional control cannot discard an unfunded magnitude change');
  assert.equal(s.propulsion.actualInputW, 1e18);
  s.drive.mods[1] = 0;const drift = s.vel.slice(), heading = s.h.slice();
  R.steer(s, s.pos.slice(), 1000, .25);
  nearVector(s.vel,analyticMotion(s.drive,drift,[0,0,0],.25).v);
  assert.deepEqual(plain(s.h), plain(heading));
  assert.equal(s.propulsion.actualInputW, 0);
});

test('equal simulation time gives equal velocity change and propulsion input energy', () => {
  function advance(dt, count) {
    const u = unit();u.order = {...u.order, type: 'move', point: [10000, 0, 0]};
    const b = C.fleetBattle([u], false);let inputJ = 0;
    for (let i = 0; i < count; i++) {
      C.fleetTick(b, dt, {collide: false});inputJ += u.propulsion.actualInputW * dt;
    }
    return {velocity: u.velocity, inputJ};
  }
  const coarse = advance(.25, 4), fine = advance(.125, 8);
  assert.ok(Math.abs(coarse.velocity[0] - fine.velocity[0]) < 1e-10);
  assert.equal(coarse.inputJ, fine.inputJ);
});

test('saved craft retain the validated engine profile and mass-bound conversion coefficient', () => {
  const p = profile();p.propulsion.engines[0].wattsPerNewton = 1;
  const d = C.cleanDesignCraft({name: 'Saved drive', dims: [10, 4, 3], craft: {
    role: 'fighter', speed: 1000, mass: 1000, crew: 1, aa: 1,
    gun: 0, strike: 0, armor: 1, powerProfile: p,
  }});
  assert.equal(d.craft.powerProfile.propulsion.engines[0].wattsPerNewton, driveWattsPerNewton);
  const key = R.registerDesignCraft(d);
  near(R.CRAFT[key].powerProfile.propulsion.ratedAccelMps2, fullAcceleration);
  assert.deepEqual(plain(C.cleanDesignCraft(plain(d)).craft.powerProfile),
    plain(d.craft.powerProfile));
  const invalid = plain(p);invalid.propulsion.engines[0].driveProfileId = 'unbounded';
  const cleaned = C.cleanCraftPowerProfile(invalid);
  assert.equal(cleaned.propulsion.ratedThrustN, 0);
  assert.equal(cleaned.propulsion.engines[0].valid, false);
});

test('nozzle appearance cannot change the game speed coefficient', () => {
  const ship = {parts: [{k: 'engine', d: 2, nozzleLength: 8}]};
  const first = C.engineDepthRatio(ship);ship.parts[0].d = 20;
  ship.parts[0].nozzleLength = 80;
  assert.equal(C.engineDepthRatio(ship), first);
});

test('legacy combat profiles require independent finite mass and preserve their electrical rating', () => {
  const p = profile();delete p.propulsion;
  for (const mass of [undefined, 0, -1, Infinity, NaN]) {
    assert.equal(C.legacyPropulsionProfile(p, mass), null);
  }
  assert.equal(C.fleetUnit('no-mass','legacy',p).p.propulsion, undefined);
  const model = C.legacyPropulsionProfile(p, 1000);
  assert.equal(model.massKg, 1e6);
  near(model.ratedAccelMps2, fullAcceleration);
  assert.equal(model.engines[0].wattsPerNewton, driveWattsPerNewton);
  assert.equal(model.legacyReadOnly, true);
  p.modules.push({...p.modules[1], share:1, size:1});
  const split = C.legacyPropulsionProfile(p,1000);
  assert.notEqual(split.engines[0].id,split.engines[1].id);
  assert.equal(split.engines.reduce((n,e)=>n+e.ratedInputW,0),p.grid.De);
  p.mass=1000;assert.equal(C.fleetUnit('mass','legacy',p).p.propulsion.massKg,1e6);
  p.grid.De=0;assert.equal(C.legacyPropulsionProfile(p,1000),null);
});

test('a stale result cannot move a unit without a finite valid descriptor', () => {
  const u=unit();u.propulsion={actualAccelMps2:500};
  for(const mass of [0,Infinity,NaN]){u.p.propulsion.massKg=mass;assert.equal(C.propulsionMotion(u).acc,0);}
  delete u.p.propulsion;assert.equal(C.propulsionMotion(u).acc,0);
});

test('a legacy combined acceleration remains only an upper bound on real powered movement',()=>{
 const p=profile();delete p.propulsion;p.mass=1000;p.accel=.2;
 const model=C.legacyPropulsionProfile(p,1000);assert.equal(model.legacyMovementCapSource,'profile.accel');near(model.ratedAccelMps2,fullAcceleration);assert.equal(model.legacyUpperMovementCapMps2,.2/C.FLEET_RULES.accelScale);
 const u=C.fleetUnit('legacy-cap','legacy',p);for(const throttle of [1,.5]){C.allocateShipPower(u,C.fleetSystems(u),{throttle},0,'balanced');const wattsPerNewton=C.engineConversionCoefficient(u.p.propulsion.engines[0]),input=Math.min(1e18*throttle,1e6*(.2/C.FLEET_RULES.accelScale)*wattsPerNewton);near(u.propulsion.actualInputW,input);near(C.propulsionMotion(u).acc,input/wattsPerNewton/1e6*C.FLEET_RULES.accelScale);}
 u.mods[0]=0;C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},0,'balanced');assert.equal(u.propulsion.actualInputW,0);assert.equal(C.propulsionMotion(u).acc,0);
 delete p.accel;near(C.legacyPropulsionProfile(p,1000).accelerationLimitMps2,fullAcceleration);for(const invalid of [NaN,Infinity,-1]){p.accel=invalid;assert.equal(C.legacyPropulsionProfile(p,1000),null);}
});

test('stationary turning keeps requesting engine power until the heading is reached', () => {
  const u=unit();u.yaw=1;u.order={...u.order,type:'move',point:[0,0,0]};
  const b=C.fleetBattle([u],false);let yaw=u.yaw;
  for(let i=0;i<4;i++){C.fleetTick(b,.25,{collide:false});assert.ok(u.yaw<yaw);assert.ok(u.propulsion.actualInputW>0);yaw=u.yaw;}
  assert.deepEqual(plain(u.velocity),[0,0,0]);
  const r=unit();r.yaw=1;r.sys=0;r.side=0;r.info={mass:1000};r.order={...r.order,type:'move',point:[0,0,0]};
  const w={time:10,units:new Map([[r.id,r]]),groups:new Map(),ctgs:new Map(),battles:new Map(),sides:[],sensors:false};
  yaw=r.yaw;for(let i=0;i<4;i++){R.peaceTick(w,0,.25);assert.ok(r.yaw<yaw);yaw=r.yaw;w.time+=.25;}
});

test('a disabled peaceful unit integrates mass resistance and planetary gravity once', () => {
  const u=unit();u.sys=0;u.side=0;u.info={mass:1000};u.out='電源喪失';
  u.velocity=[.001,0,.002];u.yaw=.7;u.mods[0]=0;
  const w={time:10,rand:()=>.5,units:new Map([[u.id,u]]),groups:new Map(),ctgs:new Map(),battles:new Map(),sides:[],sensors:false};
  for(let i=0;i<4;i++){R.peaceTick(w,0,.25);w.time+=.25;}
  const expected=analyticMotion(u,[.001,0,.002],[0,-C.HULL_FALL.g,0],1);nearVector(u.pos,expected.dp);nearVector(u.velocity,expected.v);assert.equal(u.yaw,.7);
});

test('the real peaceful registry preserves disabled falling motion after its original start time', () => {
  const design={key:'slow-drift',p:profile(),info:{mass:1000,hyper:null,capital:false,sensor:0}};
  const w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[design],
    sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:design.key}],[]]});
  const u=[...w.units.values()][0];u.order={...u.order,type:'hold'};
  u.p.grid.P=0;u.p.grid.Pgen=0;u.velocity=[.001,0,.002];
  const position=u.pos.slice();w.time=2000;w.stir=new Map([[u.sys,{t0:0,still:0}]]);
  for(let i=0;i<40;i++)R.tick(w,.25);
  assert.ok(w.stir.has(u.sys),'slow inertial flight stays registered');
  const expected=analyticMotion(u,[.001,0,.002],[0,-C.HULL_FALL.g,0],10);nearVector(u.pos,position.map((v,i)=>v+expected.dp[i]));nearVector(u.velocity,expected.v);
  assert.equal(u.out,'電源喪失');
  nearVector(u.velocity,expected.v);
});

test('saved power profiles retain verified physical volume without a retired density power ceiling', () => {
  const p=profile();p.propulsion.engines[0].machineryLengthM=.01;
  p.propulsion.engines[0].effectiveMachineryVolumeM3=1e20;
  p.propulsion.engines[0].maxInputW=1e32;
  const clean=C.cleanCraftPowerProfile(p);
  near(clean.propulsion.ratedThrustN,fullThrustN);
  const engine=clean.propulsion.engines[0];assert.equal(engine.valid,true);assert.ok(engine.effectiveMachineryVolumeM3<1,'cached claimed volume cannot enlarge the real machinery');assert.equal(engine.availableInputW,1e18);const point=C.engineOperatingPoint(engine,1e18);assert.ok(point.loadFactor>1);near(point.wasteHeatW,5e16);
});

test('a blueprint owns the physical machinery and connected reactor supply instead of cached input ratings', () => {
  const ship=C.newShip({L:35,W:18,H:8},'Cached engine');
  ship.parts=[{id:2,k:'engine',c:[0,0,0],dir:[-1,0,0],d:1,
    propulsionModelVersion:1,ratedInputW:1e18,driveProfileId:'standard',
    machineryGradeId:'standard',machineryLengthM:2,machineryRadiusM:1,
    machineryOffsetM:0,nozzleLength:1}];ship.nextId=3;
  const p=profile(),e=p.propulsion.engines[0];e.ratedInputW=1e25;
  e.machineryLengthM=1e5;e.machineryRadiusM=1e5;
  const clean=C.cleanCraftPowerProfile(p,C.serialize(ship)),engine=clean.propulsion.engines[0];
  assert.equal(engine.ratedInputW,0);assert.equal(engine.availableInputW,0);
  assert.equal(engine.machineryLengthM,2);assert.equal(engine.machineryRadiusM,1);
  const actualMassKg=C.computeStats(C.deserialize(plain(C.serialize(ship)))).mass*1000;
  assert.equal(clean.propulsion.massKg,Math.max(p.propulsion.massKg,actualMassKg));
  assert.equal(clean.propulsion.ratedAccelMps2,0);
  assert.equal(engine.available,false,'an old cached source cannot power a blueprint without its reactor');
  const offline=C.fleetUnit('cached-offline','cached-offline',clean);
  C.allocateShipPower(offline,C.fleetSystems(offline),{throttle:1},.25);
  assert.equal(offline.propulsion.actualInputW,0);
  ship.parts[0].feedCapacityW=2e17;
  assert.equal(C.cleanCraftPowerProfile(p,C.serialize(ship)).propulsion.engines[0].pathCapacityW,0,'a saved limit cannot create a circuit without its reactor');
  Object.assign(ship.hull,{sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1});
  Object.assign(ship.parts[0],{c:[.5,4,0],reactor:1,busFeed:true});
  ship.parts.push({id:1,k:'gen',c:[25,4,0],d:2});
  ship.links=[{kind:'power',from:'p1',to:'p2',cap:1e18}];
  const limited=C.cleanCraftPowerProfile(p,C.serialize(ship));
  const route=C.engineTransmission(ship).routes.find(r=>r.to==='p2'),receivedLimit=2e17*Math.exp(-1e-5*route.length);
  assert.ok(Math.abs(limited.propulsion.engines[0].pathCapacityW-receivedLimit)<=receivedLimit*1e-12,'the saved blueprint owns its finite received feed limit after actual conductor loss');
});

test('aircraft shields and guns share the current finite plant with propulsion', () => {
  const p=profile();p.grid.Ds=2e17;p.grid.Dw=1e18;p.D=p.grid.Ds/C.TT*C.K.deflect;p.shieldBuffer=100;
  p.modules.push({k:'shield',part:3,port:'p3',name:'Shield',share:1,size:1,domain:'main',powerConnected:true},
    {k:'weapon',fit:4,port:'f4',name:'Gun',share:1,size:1,domain:'main',powerConnected:true,weaponPowerW:1e18});
  R.CRAFT.motionBudget={name:'Budget',role:'fighter',speed:1000,shield:true,powerProfile:p};
  const s={id:'budget',craft:'motionBudget',side:0,h:[1,0,0],pos:[0,0,0],vel:[0,0,0],weaponDemand:true};
  R.squadPropulsion(s,.5,0);s.drive.shield=0;
  R.squadPropulsion(s,.5,0);
  near(s.drive.pw.sh,2e17);near(s.drive.pw.wpn,8e17);near(s.propulsion.actualInputW,0);near(s.weaponPowerK,.8);
  near(s.drive.pw.eng+s.drive.pw.wpn+s.drive.pw.sh,1e18);
  // With genuinely more connected source power, the same higher-priority
  // demands leave their actual remainder for navigation at half throttle.
  s.drive.p.grid.P=s.drive.p.grid.Pgen=2e18;
  for(const domain of s.drive.p.grid.domains||[]){domain.P=2e18;for(const source of domain.sources||[])source.P=2e18;}
  R.squadPropulsion(s,.5,0);
  near(s.drive.pw.sh,2e17);near(s.drive.pw.wpn,1e18);near(s.weaponPowerK,1);near(s.propulsion.actualInputW,8e17);
  near(s.drive.pw.eng+s.drive.pw.wpn+s.drive.pw.sh,2e18);assert.ok(s.drive.propulsion.power.draw<=s.drive.pw.P*(1+1e-12));
  const d=C.cleanDesignCraft({name:'Shielded',dims:[10,4,3],craft:{role:'fighter',speed:1000,aa:1,armor:1,crew:1,shield:true,powerProfile:profile()}});
  assert.equal(R.CRAFT[R.registerDesignCraft(d)].shield,true);
});

test('aircraft foil deployment controls the connected local cooling capacity', () => {
  const p=profile();p.foils=[{id:1,n:'foil',T:1,sec:-1,jam:0}];
  // Strict cooling needs a real, powered device even when its exposure follows a foil.
  const coolingW=1e17*C.HEAT.disPowerK.hdis;p.modules.push({k:'dissipator',part:3,port:'p3',name:'Foil cooler',share:1,size:1,domain:'main',powerConnected:true});
  p.grid.fixed=p.grid.cooling=coolingW;p.grid.powerPaths=[{from:'p1',to:'p2',cap:1e18,ok:true},{from:'p1',to:'p3',cap:coolingW,ok:true}];
  const H=plain(C.heatProfile(p));H.dis=[{id:'p3',n:'foil',k:'hdis',g:'high',cap:1e17,power:coolingW,m:2,sec:-1,src:-1,fo:0,cs:.1}];
  H.ln=H.src.map((_,s)=>({s,d:0,cap:1e17,sec:-1}));p.heat=H;
  for(const foil of [0,1]){
    const key='motionFoil'+foil;R.CRAFT[key]={name:key,role:'fighter',speed:1000,powerProfile:plain(p)};
    const s={id:key,craft:key,side:0,h:[1,0,0],pos:[0,0,0],vel:[0,0,0],foil};
    R.squadPropulsion(s,1,0);C.allocateShipPower(s.drive,C.fleetSystems(s.drive),{throttle:1,shields:0,weapons:0},.25,'balanced');C.heatTick(null,s.drive,.25,.25);
    assert.equal(s.drive.fo.d[0],foil);assert.equal(s.drive.ht.cap,foil?1e17:1e16);
  }
  assert.equal(C.cleanCraftPowerProfile(p).foils.length,1);
});

test('boarding resistance uses this tick\'s actual force without legacy capability multipliers', () => {
  const attacker=unit(),target=unit();attacker.p.trac=1;target.info={mass:1000};
  target.mods[1]=.25;target.engF=.25;
  target.propulsion={actualInputW:2.5e17,actualThrustN:1.25e8,forceVector:[1.25e8,0,0],actualAccelMps2:125};
  const strain=1.25e8*C.FLEET_RULES.accelScale/1000/R.BOARD.projHold;
  assert.ok(Math.abs(R.boardStrain(attacker,target)-strain)<1e-12);
  target.p.accel=1e12;assert.ok(Math.abs(R.boardStrain(attacker,target)-strain)<1e-12);
  target.propulsion={actualInputW:0,actualThrustN:0,forceVector:[0,0,0],actualAccelMps2:0};
  assert.equal(R.boardStrain(attacker,target),0);
  delete target.propulsion;assert.equal(R.boardStrain(attacker,target),0);
});

test('a healthy hostile tractor target requests real resistance power while its motion is constrained', () => {
  const a={key:'resistance-attacker',p:{...profile(),trac:1},info:{mass:1000,hyper:null,capital:false,sensor:0}},
    b={key:'resistance-target',p:profile(),info:{mass:1000,hyper:null,capital:false,sensor:0}};
  const w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,convoyMode:false,designs:[a,b],
    sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:a.key}],[{design:b.key}]]});
  const attacker=[...w.units.values()].find(u=>u.side===0),target=[...w.units.values()].find(u=>u.side===1);
  target.sys=attacker.sys;w.groups.get(target.group).sys=attacker.sys;
  attacker.order={...attacker.order,type:'hold',fire:false};target.order={...target.order,type:'hold',fire:false};
  attacker.pos=[0,0,0];target.pos=[0,0,8000];attacker.velocity=target.velocity=[0,0,0];target.maneuver=0;
  attacker.tractor={target:target.id,mode:'capture',lock:true,off:[0,0,8000],dyaw:0,phase:'fight',strain:0,t:0};target.towedBy=attacker.id;
  R.tick(w,.25);
  assert.ok(target.propulsion.actualInputW>0,'resistance consumes allocated electrical input');
  assert.ok(R.boardStrain(attacker,target)>0);
  target.mods[0]=0;R.tick(w,.25);
  assert.equal(target.propulsion.actualInputW,0);assert.equal(R.boardStrain(attacker,target),0);
});

test('the LH-3210 convoy freighter receives finite propulsion without an aircraft catalog entry', () => {
  const design=vm.runInContext('YardFleetData.designs.lh3210',context);
  assert.ok(design);assert.equal(R.CRAFT.lh3210,undefined);
  const w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,convoyMode:false,designs:[design],
    sides:[{faction:'cis',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:design.key}],[]]});
  const u=[...w.units.values()][0];u.order={...u.order,type:'move',point:C.add(u.pos,[50000,0,0])};
  const before=u.velocity.slice();R.peaceTick(w,u.sys,.25);
  assert.ok(u.p.propulsion.massKg>0&&Number.isFinite(u.p.propulsion.massKg));
  assert.ok(u.propulsion.actualInputW>0&&u.propulsion.actualInputW<=u.p.grid.P*(1+1e-12));
  const dv=Math.hypot(...u.velocity.map((v,i)=>v-before[i]));
  assert.ok(dv>0&&dv<=C.propulsionMotion(u).acc*.25+1e-8);
});
