const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`),R=1e18,W=2e9;
function fixture(){const ship=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Shared engine snapshot');ship.armor={hull:.01,cit:0};ship.parts=[{id:1,k:'gen',c:[200,60,0],d:20},{id:3,k:'engineCore',c:[180,60,0],d:8,length:12,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:R,driveProfileId:'standard',machineryGradeId:'standard',legacyCoolingInputW:0},...[-30,30].map((z,i)=>({id:4+i,k:'engine',c:[5,60,z],d:10,nozzleLength:10,dir:[-1,0,0],machineryId:3,propulsionModelVersion:1,legacyCoolingInputW:0}))];ship.fits=[];ship.links=[{kind:'power',from:'p1',to:'p3',cap:R}];ship.nextId=6;return ship;}
function snapshot(ship=fixture()){const stats=C.computeStats(ship),profile=C.craftPowerProfile(ship,stats);return {ship,stats,profile,blueprint:plain(C.serialize(ship))};}
function actual(profile){return C.solveShipPropulsion(profile.propulsion,{sources:[{id:'p1',domain:'main',powerW:R}],links:profile.grid.powerPaths,throttle:1,mode:'balanced'});}
function integratedFixture(shape){const ship=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Integrated body snapshot'),factor=shape==='cylinder'?1:(.78*.78+.78+1)/3,volume=Math.PI*16*12*factor,input=.9*volume*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3;ship.armor={hull:.01,cit:0};ship.parts=[{id:1,k:'gen',c:[200,60,0],d:20},{id:2,k:'engine',c:[5,60,0],d:10,nozzleLength:10,dir:[-1,0,0],reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:input,driveProfileId:'standard',machineryGradeId:'standard',machineryLengthM:12,machineryRadiusM:4,machineryOffsetM:5,...(shape?{machineryShape:shape}:{}),legacyCoolingInputW:0}];ship.fits=[];ship.links=[{kind:'power',from:'p1',to:'p2',cap:input}];ship.nextId=3;return ship;}

test('explicit cylindrical integrated body ratings survive canonical and standalone snapshot cleaning',()=>{
 const {ship,profile,blueprint}=snapshot(integratedFixture('cylinder')),engine=ship.parts.find(p=>p.id===2),volume=Math.PI*16*12,frustumLimit=volume*(.78*.78+.78+1)/3*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3;assert.ok(engine.ratedInputW>frustumLimit,'the real cylinder earns input capacity unavailable to a same-size frustum');
 const run=p=>C.solveShipPropulsion(p.propulsion,{sources:[{id:'p1',domain:'main',powerW:engine.ratedInputW*2}],links:p.grid.powerPaths,throttle:1,mode:'balanced'});
 for(const model of [blueprint,null]){const clean=C.cleanCraftPowerProfile(plain(profile),model);assert.ok(clean);const owner=clean.propulsion.cores.find(c=>c.id===2),outlet=clean.propulsion.engines.find(e=>e.id===2);assert.equal(owner.valid,true);assert.equal(owner.machineryShape,'cylinder');assert.equal(outlet.machineryShape,'cylinder');near(owner.effectiveMachineryVolumeM3,volume);near(owner.maxInputW,volume*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3);near(owner.ratedInputW,engine.ratedInputW);near(run(clean).actualInputW,run(profile).actualInputW);near(run(clean).actualThrustN,run(profile).actualThrustN);}
});

test('a forged cylindrical descriptor cannot enlarge a canonical legacy frustum body',()=>{
 const {profile,blueprint}=snapshot(integratedFixture()),bad=plain(profile),volume=Math.PI*16*12,frustumVolume=volume*(.78*.78+.78+1)/3;for(const item of [...bad.propulsion.cores,...bad.propulsion.engines])Object.assign(item,{machineryShape:'cylinder',ratedInputW:.9*volume*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3,effectiveMachineryVolumeM3:volume,machineryVolumeM3:volume,maxInputW:1e32,pathCapacityW:1e32});
 const clean=C.cleanCraftPowerProfile(bad,blueprint);assert.ok(clean);const owner=clean.propulsion.cores.find(c=>c.id===2);assert.equal(owner.machineryShape,'frustum');assert.equal(clean.propulsion.engines.find(e=>e.id===2).machineryShape,'frustum');near(owner.effectiveMachineryVolumeM3,frustumVolume);near(owner.maxInputW,frustumVolume*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3);near(owner.ratedInputW,profile.propulsion.cores.find(c=>c.id===2).ratedInputW);near(actual(clean).actualThrustN,actual(profile).actualThrustN);
});

test('a canonical shared internal body snapshot retains the body, ownership, shaft modules and loss-bearing circuits',()=>{
 const {profile,blueprint}=snapshot(),clean=C.cleanCraftPowerProfile(plain(profile),blueprint);assert.ok(clean);assert.equal(clean.propulsion.architectureVersion,2);assert.equal(clean.propulsion.cores.length,1);const core=clean.propulsion.cores[0],original=profile.propulsion.cores[0];assert.equal(core.id,3);near(core.ratedInputW,R);near(core.effectiveMachineryVolumeM3,Math.PI*16*12);assert.equal(core.moduleIndex,original.moduleIndex);assert.equal(core.machineryModuleIndex,original.machineryModuleIndex);near(clean.propulsion.ratedThrustN,R/W);
 for(const e of clean.propulsion.engines){const before=profile.propulsion.engines.find(q=>q.id===e.id);assert.equal(e.machineryId,3);assert.equal(e.coreId,3);assert.equal(e.moduleIndex,before.moduleIndex);assert.equal(e.coreModuleIndex,before.coreModuleIndex);assert.deepEqual(plain(e.shaftModuleIndices),plain(before.shaftModuleIndices));near(e.shaftCapacityW,.95*R/2);assert.equal(e.shaftRouteId,before.shaftRouteId);}
 assert.deepEqual(plain(clean.grid.powerPaths),plain(profile.grid.powerPaths));near(actual(clean).actualInputW,actual(profile).actualInputW);near(actual(clean).actualThrustN,actual(profile).actualThrustN);near(actual(clean).power.feedLossW,actual(profile).power.feedLossW);
});

test('the canonical cylinder input limit accepts real internal capacity above the older frustum approximation',()=>{
 const ship=fixture(),core=ship.parts.find(p=>p.id===3),volume=Math.PI*16*12;core.ratedInputW=.9*volume*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3;const {profile,blueprint}=snapshot(ship),clean=C.cleanCraftPowerProfile(plain(profile),blueprint);assert.ok(clean);const body=clean.propulsion.cores[0];assert.equal(body.valid,true);near(body.effectiveMachineryVolumeM3,volume);near(body.maxInputW,volume*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3);near(body.ratedInputW,core.ratedInputW);near(clean.propulsion.ratedThrustN,core.ratedInputW/W);
});

test('snapshot-supplied ratings, volumes and shaft limits cannot inflate a canonical body',()=>{
 const {profile,blueprint}=snapshot(),bad=plain(profile);for(const e of [...bad.propulsion.cores,...bad.propulsion.engines]){e.ratedInputW*=1e6;e.ratedThrustN*=1e6;e.effectiveMachineryVolumeM3*=1e9;e.machineryVolumeM3*=1e9;e.maxInputW=1e32;e.maxRatedInputW=1e32;e.shaftCapacityW=1e32;e.pathCapacityW=1e32;}bad.propulsion.ratedThrustN=1e32;const clean=C.cleanCraftPowerProfile(bad,blueprint);if(!clean)return;
 assert.equal(clean.propulsion.cores.length,1);const core=clean.propulsion.cores[0];assert.ok(core.ratedInputW<=R);near(core.effectiveMachineryVolumeM3,Math.PI*16*12);assert.ok(clean.propulsion.ratedThrustN<=R/W);for(const e of clean.propulsion.engines)assert.ok(e.shaftCapacityW<=.95*R/2);assert.ok(actual(clean).actualThrustN<=R/W);
});

test('duplicate core or nozzle entries cannot multiply the saved hardware or its total input',()=>{
 const {profile,blueprint}=snapshot(),bad=plain(profile);bad.propulsion.cores.push(plain(bad.propulsion.cores[0]));bad.propulsion.engines.push(plain(bad.propulsion.engines[0]));bad.propulsion.ratedThrustN*=3;const clean=C.cleanCraftPowerProfile(bad,blueprint);if(!clean)return;assert.equal(new Set(clean.propulsion.cores.map(c=>c.id)).size,clean.propulsion.cores.length);assert.equal(new Set(clean.propulsion.engines.map(e=>e.id)).size,clean.propulsion.engines.length);assert.equal(clean.propulsion.cores.length,1);near(clean.propulsion.ratedThrustN,R/W);assert.ok(actual(clean).actualInputW<=R);assert.ok(actual(clean).actualThrustN<=R/W);
});

test('missing body descriptors and forged owner references cannot fall back to duplicated per-nozzle propulsion',()=>{
 const {profile,blueprint}=snapshot();for(const mode of ['missing-core','forged-owner']){const bad=plain(profile);if(mode==='missing-core')delete bad.propulsion.cores;else{bad.propulsion.engines[0].machineryId=999;bad.propulsion.engines[0].coreId=999;}const clean=C.cleanCraftPowerProfile(bad,blueprint);if(!clean)continue;assert.equal(clean.propulsion.architectureVersion,2);if(mode==='missing-core'){assert.equal(clean.propulsion.cores.length,0);near(actual(clean).actualInputW,0);near(actual(clean).actualThrustN,0);}else{assert.equal(clean.propulsion.cores.length,1);near(clean.propulsion.ratedThrustN,R/W);}for(const e of clean.propulsion.engines)if(e.valid!==false)assert.ok(clean.propulsion.cores.some(c=>c.id===e.machineryId));assert.ok(actual(clean).actualInputW<=R);assert.ok(actual(clean).actualThrustN<=R/W);}
});

test('a partially retained body snapshot validates against the actual clipped solid in its saved blueprint',()=>{
 const ship=fixture(),core=ship.parts.find(p=>p.id===3);core.c[0]=301;const {profile,blueprint}=snapshot(ship),retained=C.partVolume(core);assert.ok(retained>0&&retained<Math.PI*16*12);const clean=C.cleanCraftPowerProfile(plain(profile),blueprint);assert.ok(clean);const body=clean.propulsion.cores.find(c=>c.id===3);near(body.effectiveMachineryVolumeM3,retained,1e-7);near(body.maxInputW,retained*C.MACHINERY_GRADES.standard.allowedInputDensityWPerM3,1e-7);near(body.ratedInputW,R);
});

test('a forged snapshot cannot re-enable an exterior unit assigned to an internal engine',()=>{
 const ship=fixture();ship.parts.find(p=>p.id===4).equipmentId='exposedTurbine';const {profile,blueprint}=snapshot(ship),bad=plain(profile),outlet=bad.propulsion.engines.find(e=>e.id===4);Object.assign(outlet,{valid:true,available:true,connected:true,outletAvailable:true,shaftCapacityW:.95*R,ratedShaftCapacityW:.95*R});
 const clean=C.cleanCraftPowerProfile(bad,blueprint);if(!clean)return;
 const invalid=clean.propulsion.engines.find(e=>e.id===4);assert.ok(invalid.valid===false||invalid.available===false);const result=actual(clean);near(result.engines.find(e=>e.id===4).actualInputW,0);near(result.engines.find(e=>e.id===4).actualThrustN,0);assert.ok(result.actualInputW<=R);assert.ok(result.actualThrustN<=R/W);
});

test('canonical blueprints cannot lose physical electrical efficiency or conduit damage through a forged saved grid',()=>{
 const {profile,blueprint}=snapshot(),reference=actual(profile),cableIndex=profile.modules.findIndex(m=>m.k==='conduit');assert.ok(cableIndex>=0,'the reference circuit contains real damageable electrical hardware');
 const damaged=p=>{const unit=C.fleetUnit('snapshot-cable','snapshot-cable',p,0);C.heatInit(unit);const index=p.modules.findIndex(m=>m.part===profile.modules[cableIndex].part);assert.ok(index>=0);unit.mods[index]=0;C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},1,'balanced');return unit.propulsion;};
 near(damaged(profile).actualInputW,0);
 for(const mode of ['direct-lossless-feed','missing-cable-trunks']){
  const bad=plain(profile);if(mode==='direct-lossless-feed')bad.grid.powerPaths=[{kind:'power',from:'p1',to:'p3',cap:R,ok:true,efficiency:1}];else bad.grid.trunks=[];
  const clean=C.cleanCraftPowerProfile(bad,blueprint);if(!clean)continue;
  const result=actual(clean);near(result.actualInputW,reference.actualInputW);near(result.actualThrustN,reference.actualThrustN);near(result.power.draw,reference.power.draw);near(result.power.feedLossW,reference.power.feedLossW);assert.ok(clean.grid.powerPaths.some(l=>l.efficiency<1&&l.physical));near(damaged(clean).actualInputW,0);near(damaged(clean).wasteHeatW,0);
 }
});
