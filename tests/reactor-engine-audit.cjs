const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),A=require('../scripts/audit-ship-examples.cjs'),P=1e18,copy=value=>JSON.parse(JSON.stringify(value)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
function fixture(){
 const cores=[2,3].map((id,index)=>({id,machineryId:id,moduleIndex:index+1,machineryModuleIndex:index+1,powerNode:'p'+id,heatNode:'p'+id,domain:'main',ratedInputW:1,ratedThrustN:5e-10,wattsPerNewton:2e9,driveProfileId:'standard',effectiveMachineryVolumeM3:1,machineryVolumeM3:1,direction:[1,0,0],pathCapacityW:2*P,valid:true,available:true,connected:true,outletAvailable:true,integrated:true})),links=cores.map(core=>({from:'p1',to:core.powerNode,cap:2*P,efficiency:1,ok:true})),raw={profileVersion:C.FLEET_PROFILE_VERSION,hp:100,len:100,width:40,height:20,crewNeed:0,crewMax:1,D:0,wCap:0,maxSpeed:1200,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1},...cores.map(core=>({k:'engine',part:core.id,port:core.powerNode,domain:'main',size:1,powerConnected:true}))],grid:{P,Pgen:P,De:2,fixed:0,cooling:0,Ds:0,Dw:0,powerPaths:links},
  propulsion:{version:C.PROPULSION_MODEL_VERSION,architectureVersion:2,cores,engines:cores.map(core=>({...core,shaftCapacityW:2*P,ratedShaftCapacityW:2*P,nozzleShaftCapacityW:2*P})),massKg:1e6,ratedThrustN:1e-9,ratedAccelMps2:1e-15,structuralAccelerationLimitMps2:10000,inertialFactor:1,accelerationLimitMps2:10000}};
 const unit=C.fleetUnit('audit-redistribution','custom-audit',raw),sources=[{id:'p1',domain:'main',powerW:P,maxPowerW:P}],result=C.solveShipPropulsion(unit.p.propulsion,{sources,links,states:{2:{available:false}},throttle:1,mode:'propulsion'});
 return {raw,profile:unit.p,result};
}
function prove(f){return A.coreAllocationEvidence(C,f.profile,f.result);}
function verifyConservation(proof){for(const field of ['inputCountedOnce','sourceBudgetsConserved','conversionConserved','shaftConserved','forceConsistent','electricalConserved','totalsConsistent'])assert.equal(proof[field],true,field);}

test('the auditor accepts real two-owner redistribution above a healthy owner nominal share without duplicating its one reactor',()=>{
 const f=fixture(),healthy=f.profile.propulsion.cores.find(core=>core.id===3),flow=f.result.cores.find(core=>core.id===3);assert.equal(f.profile.propulsion.inputModelVersion,C.ENGINE_INPUT_MODEL_VERSION);near(healthy.ratedInputW,P/2);near(flow.actualInputW,P);assert.ok(flow.actualInputW>healthy.ratedInputW);near(f.result.power.draw,P);verifyConservation(prove(f));
});

test('catalogue audit scenarios use the actual normalized source model without mutating their old input snapshot',()=>{
 const f=fixture(),before=JSON.stringify(f.raw),scenarios=A.allocationComparison(C,'custom-audit',f.raw);assert.equal(JSON.stringify(f.raw),before);assert.ok(Object.keys(scenarios).length>1);
 for(const scenario of Object.values(scenarios)){assert.equal(scenario.powerConserved,true);assert.equal(scenario.sourceBudget.required,true);assert.equal(scenario.sourceBudget.passed,true);assert.equal(scenario.sharedInputCountedOnce,true);verifyConservation(scenario.coreEnergy);}
});

test('unmarked historical audit profiles retain their authored acceptance ceiling',()=>{
 const f=fixture();delete f.profile.propulsion.inputModelVersion;for(const spec of [...f.profile.propulsion.cores,...f.profile.propulsion.engines])delete spec.inputLimitModel;
 const proof=prove(f);assert.equal(proof.sourceBudget.required,false);assert.equal(proof.inputCountedOnce,false,'the new reactor model cannot silently weaken historical rating proofs');assert.equal(proof.conversionConserved,true);
});

test('source overdraw, duplicated funding and exceeding the one source throttle budget fail the modern audit',()=>{
 for(const kind of ['source-overdraw','duplicate-funding','engine-budget']){
  const f=fixture();if(kind==='source-overdraw')f.result.power.sources[0].drawW=P*1.1;
  else if(kind==='duplicate-funding')f.result.power.sourceFunding['another-consumer']={p1:P};
  else f.result.power.engineBudgets[0].limitW=P/4;
  const proof=prove(f);assert.equal(proof.sourceBudgetsConserved,false,kind);assert.equal(proof.inputCountedOnce,false,kind);assert.equal(proof.conversionConserved,true,'valid per-owner conversion alone cannot hide a shared-source violation');assert.ok(proof.sourceBudget.violations.length>0);
 }
});

test('real finite feed and shaft limits remain audit bounds after the input rating is retired',()=>{
 for(const kind of ['feed','shaft']){
  const f=fixture();if(kind==='feed')f.profile.propulsion.cores.find(core=>core.id===3).pathCapacityW=P/4;
  else f.profile.propulsion.engines.find(outlet=>outlet.machineryId===3).shaftCapacityW=.095*P;
  const proof=prove(f);assert.equal(proof.sourceBudgetsConserved,true);assert.equal(proof.inputCountedOnce,false,kind);assert.equal(proof.conversionConserved,true);
 }
});

test('an unknown source binding or nonfinite modern input potential cannot pass as verified reactor capacity',()=>{
 for(const kind of ['unbound','unbounded']){
  const f=fixture(),owner=f.profile.propulsion.cores.find(core=>core.id===3);if(kind==='unbound')owner.sourceIds=['absent-source'];else owner.availableInputW=Infinity;
  const proof=prove(f);assert.equal(proof.sourceBudgetsConserved,true);assert.equal(proof.inputCountedOnce,false,kind);
 }
});
