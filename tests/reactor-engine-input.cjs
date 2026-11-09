const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx),P=1e18,wattsPerNewton=C.engineConversionCoefficient(1e6),healthyGameAcceleration=P/wattsPerNewton/1e6*C.FLEET_RULES.accelScale,near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
const dragSmallMass=C.ENGINE_CONVERSION.referenceSmallMassKg,dragLargeMass=C.ENGINE_CONVERSION.referenceLargeMassKg,dragSmallRate=3999.1037971899486*C.G0*C.FLEET_RULES.accelScale/2000,dragLargeRate=2972.473437207956*C.G0*C.FLEET_RULES.accelScale/1000,dragExponent=Math.log(dragLargeRate/dragSmallRate)/Math.log(dragLargeMass/dragSmallMass),expectedDragRate=dragSmallRate*Math.pow(1e6/dragSmallMass,dragExponent);
function fixture(n=2,architecture=1){
 const cores=Array.from({length:n},(_,i)=>({id:i+2,machineryId:i+2,moduleIndex:i+1,powerNode:'p'+(i+2),heatNode:'p'+(i+2),domain:'main',ratedInputW:1,ratedThrustN:5e-10,wattsPerNewton:2e9,driveProfileId:'standard',effectiveMachineryVolumeM3:1,machineryVolumeM3:1,direction:[1,0,0],pathCapacityW:2*P,valid:true,available:true,connected:true,outletAvailable:true,integrated:true}));
 const engines=architecture===2?cores.map(c=>({...c,shaftCapacityW:2*P,ratedShaftCapacityW:2*P,nozzleShaftCapacityW:2*P})):cores;
 return {profile:{version:1,massKg:1e6,ratedThrustN:5e-10*n,ratedAccelMps2:5e-16*n,structuralAccelerationLimitMps2:10000,inertialFactor:1,accelerationLimitMps2:10000,...(architecture===2?{architectureVersion:2,cores}:{}),engines},sources:[{id:'p1',domain:'main',powerW:P,maxPowerW:1.4*P}],links:cores.map(c=>({from:'p1',to:c.powerNode,cap:2*P,efficiency:1,ok:true})),cores};
}
for(const architecture of [1,2])test(`architecture${architecture}: four old tiny nameplates share25percent once and fullreactor output once`,()=>{
 const f=fixture(4,architecture);for(const throttle of [0,.25,1]){const a=C.solveShipPropulsion(f.profile,{sources:f.sources,links:f.links,throttle,mode:'propulsion'});near(a.actualInputW,P*throttle);near(a.power.draw,P*throttle);near(a.wasteHeatW,.05*P*throttle);near(a.actualThrustN,P*throttle/wattsPerNewton);near(a.power.engineBudgets[0].drawW,P*throttle);assert.ok(a.engines.every(e=>e.actualInputW<=P*throttle));}
});
test('full propulsion keeps required hotel and cooling power while quarter throttle leaves power for other consumers',()=>{
 const f=fixture(),otherLoads=[{id:'hotel',kind:'fixed',domain:'main',requestedInputW:.01*P},{id:'cooling',kind:'cooling',domain:'main',requestedInputW:.02*P},{id:'guns',kind:'weapons',domain:'main',requestedInputW:P}];
 for(const throttle of [1,.25]){const a=C.solveShipPropulsion(f.profile,{sources:f.sources,links:[],otherLoads,throttle,mode:'propulsion'});near(a.power.fixed,.01*P);near(a.power.cooling,.02*P);near(a.actualInputW,(throttle===1?.97:.25)*P);near(a.power.weapons,(throttle===1?0:.72)*P);near(a.power.draw,P);}
});
test('physical owner volume determines shared allocation and legacy ratings do not',()=>{
 const f=fixture();f.profile.engines[1].effectiveMachineryVolumeM3=f.profile.engines[1].machineryVolumeM3=3;f.profile.engines[0].ratedInputW=1e30;f.profile.engines[1].ratedInputW=0;
 const a=C.solveShipPropulsion(f.profile,{sources:f.sources,links:f.links,throttle:1,mode:'propulsion'});near(a.engines[0].actualInputW,P/4);near(a.engines[1].actualInputW,P*3/4);near(a.actualInputW,P);
});
test('a damaged or heat-disabled owner gives its unused budget to the healthy owner',()=>{
 for(const architecture of [1,2])for(const state of [{available:false},{thermalLimit:0},{damageLimit:0,coreDamageLimit:0}]){const f=fixture(2,architecture),a=C.solveShipPropulsion(f.profile,{sources:f.sources,links:f.links,states:{2:state},throttle:1,mode:'propulsion'});near(a.actualInputW,P);near(a.engines.find(e=>e.id===2).actualInputW,0);near(a.engines.find(e=>e.id===3).actualInputW,P);}
});
test('explicit physical feed and nozzle limits remain effective',()=>{
 const f=fixture(1,2);f.profile.engines[0].shaftCapacityW=.19*P;const a=C.solveShipPropulsion(f.profile,{sources:f.sources,links:f.links,throttle:1,mode:'propulsion'});near(a.actualInputW,.2*P);near(a.usefulPropulsionW,.19*P);
 f.profile.engines[0].shaftCapacityW=2*P;f.profile.cores[0].pathCapacityW=.1*P;const b=C.solveShipPropulsion(f.profile,{sources:f.sources,links:f.links,throttle:1,mode:'propulsion'});near(b.actualInputW,.1*P);
});
test('overload uses the finite allowed reactor generation without a new base-output cap',()=>{
 const f=fixture();const a=C.solveShipPropulsion(f.profile,{sources:f.sources,links:f.links,throttle:1,mode:'overload'});near(a.actualInputW,1.4*P);near(a.power.draw,1.4*P);near(a.power.engineBudgets[0].limitW,1.4*P);
});
test('feed loss is charged against the one shared source rather than silently refunded',()=>{
 const f=fixture();for(const l of f.links)l.efficiency=.8;for(const throttle of [.25,1]){const a=C.solveShipPropulsion(f.profile,{sources:f.sources,links:f.links,throttle,mode:'propulsion'});near(a.actualInputW,.8*P*throttle);near(a.power.draw,P*throttle);near(a.power.feedLossW,.2*P*throttle);near(a.wasteHeatW,.04*P*throttle);}
});
test('missing reactor power cannot be replaced by an obsolete positive engine rating',()=>{
 const f=fixture();for(const e of f.profile.engines)e.ratedInputW=P;const a=C.solveShipPropulsion(f.profile,{sources:[],links:f.links,throttle:1,mode:'propulsion'});near(a.actualInputW,0);near(a.actualThrustN,0);near(a.wasteHeatW,0);
});

test('normalizing an old snapshot rebinds source force while retaining the common mass drag law',()=>{
 const f=fixture(),p={profileVersion:C.FLEET_PROFILE_VERSION,maxSpeed:1000,modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1},...f.cores.map(e=>({k:'engine',part:e.id,port:e.powerNode,domain:'main',size:1,powerConnected:true}))],grid:{P,Pgen:P,De:2,fixed:0,cooling:0,Ds:0,Dw:0,powerPaths:f.links},propulsion:f.profile};
 const u=C.fleetUnit('new-source-reference','custom-reactor',p);assert.equal(u.p.propulsion.inputModelVersion,C.ENGINE_INPUT_MODEL_VERSION);near(u.p.propulsion.ratedThrustN,P/wattsPerNewton);assert.equal(u.p.motionResistance.model,'global-mass-power-law');near(u.p.maxSpeed,healthyGameAcceleration/expectedDragRate);assert.equal(u.p.motionResistance.version,C.MOTION_RESISTANCE_VERSION);const k=C.massDragRate(u);
 C.allocateShipPower(u,C.fleetSystems(u),{throttle:.25},.1,'propulsion');near(u.propulsion.actualInputW,.25*P);near(C.propulsionMotion(u).acc,.25*healthyGameAcceleration);near(C.propulsionTerminalSpeed(u,C.propulsionMotion(u).acc),.25*healthyGameAcceleration/expectedDragRate);near(C.massDragRate(u),k);
 const overloaded=C.solveShipPropulsion(u.p.propulsion,{sources:f.sources,links:f.links,throttle:1,mode:'overload'});near(overloaded.actualInputW,1.4*P);
});
