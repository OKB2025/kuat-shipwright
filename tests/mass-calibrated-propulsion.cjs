const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),M=1e6,P=1e20;
const near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${label}: ${a} != ${b}`);
function snapshot(mass=M){
 const e={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',entityKind:'engine',integrated:true,driveProfileId:'standard',machineryShape:'frustum',machineryLengthM:2,machineryRadiusM:1,effectiveMachineryVolumeM3:Math.PI*2*(.78*.78+.78+1)/3,direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true,ratedInputW:P,ratedThrustN:P/2e9,wattsPerNewton:2e9,profileWattsPerNewton:2e9,shaftWattsPerNewton:1.9e9,pathCapacityW:2*P,availableInputW:P,inputModelVersion:C.ENGINE_INPUT_MODEL_VERSION,inputLimitModel:'reactor-supply'};
 return {profileVersion:C.FLEET_PROFILE_VERSION,name:'Finite mass-calibrated vessel',hp:1e10,len:20,width:10,height:10,maxSpeed:1000,modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1},{k:'engine',part:2,port:'p2',domain:'main',size:1}],grid:{P,Pgen:P,De:P,fixed:0,cooling:0,Ds:0,Dw:0},propulsion:{version:C.PROPULSION_MODEL_VERSION,inputModelVersion:C.ENGINE_INPUT_MODEL_VERSION,massKg:mass,ratedThrustN:P/2e9,ratedAccelMps2:P/2e9/mass,accelerationLimitMps2:P/2e9/mass,structuralAccelerationLimitMps2:1e15,inertialFactor:1,engines:[e]}};
}
function solve(p,throttle=1,extra={}){return C.solveShipPropulsion(p.propulsion,{sources:[{id:'p1',domain:'main',powerW:p.grid.P,maxPowerW:p.grid.P}],throttle,mode:'propulsion',...extra});}
test('one smooth positive mass law passes through fixed calibration points',()=>{
 const r=C.ENGINE_CONVERSION;assert.ok(r.massExponent>0);near(C.engineConversionCoefficient(r.referenceSmallMassKg),r.referenceSmallWattsPerNewton);near(C.engineConversionCoefficient(r.referenceLargeMassKg),r.referenceLargeWattsPerNewton);
 const masses=[1,10,1e3,1e6,1e10,1e14];for(let i=1;i<masses.length;i++)assert.ok(C.enginePowerPerKgG(masses[i])>C.enginePowerPerKgG(masses[i-1]));near(C.enginePowerPerKgG(M),C.engineConversionCoefficient(M)*C.G0);for(const bad of [0,-1,NaN,Infinity])assert.ok(Number.isFinite(C.engineConversionCoefficient(bad))&&C.engineConversionCoefficient(bad)>0);
});
test('every engine style uses the whole vessel mass while preserving watts, hardware and price',()=>{
 const s=C.newShip({L:100,W:50,H:50},'Common conversion');s.parts=[{id:1,k:'gen',c:[80,25,0],d:4},{id:2,k:'engine',c:[0,25,0],d:18,nozzleLength:1,reactor:1,dir:[-1,0,0],...C.equipmentOptions('exposedTurbine')}];s.nextId=3;C.migrateLegacyPropulsion(s);
 const before=C.publicJSON(s),cost=C.partBuildCost(s.parts[1]),a=C.resolveEngineSpec(s.parts[1],s,M),b=C.resolveEngineSpec(s.parts[1],s,2*M);near(a.wattsPerNewton,C.engineConversionCoefficient(M));near(b.wattsPerNewton,C.engineConversionCoefficient(2*M));assert.ok(b.wattsPerNewton>a.wattsPerNewton);near(a.ratedInputW,b.ratedInputW);near(a.effectiveMachineryVolumeM3,b.effectiveMachineryVolumeM3);near(C.partBuildCost(s.parts[1]),cost);assert.equal(C.publicJSON(s),before);
});
test('0, 25 and 100 percent throttle retain real input, five-percent heat and source conservation',()=>{
 const p=C.reactorSupplyProfile(snapshot()),k=C.engineConversionCoefficient(M);for(const throttle of [0,.25,1]){const a=solve(p,throttle);near(a.actualInputW,P*throttle);near(a.power.draw,P*throttle);near(a.usefulPropulsionW,.95*P*throttle);near(a.wasteHeatW,.05*P*throttle);near(a.actualThrustN,P*throttle/k);near(a.actualAccelMps2,P*throttle/k/M);}
});
test('current mass changes force conversion but never resizes the reactor or freezes acceleration at its anchor',()=>{
 const p=C.reactorSupplyProfile(snapshot()),a=solve(p),heavier={...p,propulsion:{...p.propulsion,massKg:2*M}},b=solve(heavier),stronger={...p,grid:{...p.grid,P:2*P}},c=solve(stronger);
 near(b.actualInputW,a.actualInputW);near(b.actualAccelMps2,a.actualAccelMps2*.5*C.engineConversionCoefficient(M)/C.engineConversionCoefficient(2*M));near(c.actualInputW,2*a.actualInputW);near(c.actualAccelMps2,2*a.actualAccelMps2);near(c.wasteHeatW,2*a.wasteHeatW);
});
test('stale positive force caches upgrade once without turning their old nominal acceleration into a real cap',()=>{
 const raw=snapshot();delete raw.propulsion.structuralAccelerationLimitMps2;delete raw.propulsion.inertialFactor;raw.propulsion.ratedAccelMps2=raw.propulsion.accelerationLimitMps2=1;raw.propulsion.ratedThrustN=M;Object.assign(raw.propulsion.engines[0],{ratedInputW:1e15,ratedThrustN:1e6,wattsPerNewton:1,profileWattsPerNewton:1,shaftWattsPerNewton:1});
 const before=JSON.stringify(raw),p=C.cleanCraftPowerProfile(raw);assert.ok(p);assert.equal(JSON.stringify(raw),before);near(solve(p).actualThrustN,P/C.engineConversionCoefficient(M));assert.equal(p.propulsion.conversionModelVersion,C.ENGINE_CONVERSION_MODEL_VERSION);near(p.propulsion.conversionMassKg,M);near(p.propulsion.engines[0].conversionMassKg,M);const clean=C.cleanCraftPowerProfile(plain(p));assert.ok(clean);assert.deepEqual(plain(clean),plain(p));
 near(C.engineOperatingPoint({...p.propulsion.engines[0],shaftWattsPerNewton:1,profileWattsPerNewton:1},P).actualThrustN,P/C.engineConversionCoefficient(M));
});
test('frozen reference resistance survives payload rebinding and quarter throttle decelerates from former full speed',()=>{
 const p=C.referenceSpeedProfile(snapshot(),'venator'),rate=C.massDragRate(p),reference=p.motionResistance,full=solve(p),quarter=solve(p,.25),a=full.actualAccelMps2*C.FLEET_RULES.accelScale,q=quarter.actualAccelMps2*C.FLEET_RULES.accelScale;
 near(a,rate*1000);near(C.propulsionTerminalSpeed(p,q),250);const move=C.integratePropulsionMotion(p,[1000,0,0],[q,0,0],1);assert.ok(move.velocity[0]<1000&&move.velocity[0]>250);
 const heavy=C.reactorSupplyProfile({...p,propulsion:{...p.propulsion,massKg:2*M}});assert.deepEqual(plain(heavy.motionResistance),plain(reference));near(C.massDragRate(heavy),2*rate);near(heavy.propulsion.engines[0].conversionMassKg,2*M);
});
test('structural, inertia, feed, damage and thermal restrictions still constrain the paid force',()=>{
 const p=C.reactorSupplyProfile(snapshot()),full=solve(p),cap=full.actualAccelMps2*.4,limited=solve({...p,propulsion:{...p.propulsion,structuralAccelerationLimitMps2:cap,inertialFactor:.5}});near(limited.actualAccelMps2,.5*cap);assert.equal(limited.structuralInputLimited,true);near(limited.wasteHeatW,.05*limited.actualInputW);
 for(const state of [{thermalLimit:0},{damageLimit:0},{connected:false},{available:false},{outletAvailable:false}])near(solve(p,1,{states:{2:state}}).actualInputW,0);
 const restricted=plain(p);restricted.propulsion.engines[0].pathCapacityW=.2*P;near(solve(restricted).actualInputW,.2*P);
});
