const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {soloTrialDesign}=require('./helpers/solo-trial-design.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${label}: ${a} != ${b}`);
function snapshot({source=1e20,rating=1e15,core=false,current=false}={}){
 const e={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',valid:true,available:true,connected:true,outletAvailable:true,ratedInputW:rating,ratedThrustN:rating/2e9,wattsPerNewton:2e9,profileWattsPerNewton:2e9,driveProfileId:'standard',machineryGradeId:'standard',machineryShape:core?'cylinder':'frustum',machineryLengthM:2,machineryRadiusM:1,effectiveMachineryVolumeM3:Math.PI*2*(core?1:(.78*.78+.78+1)/3),direction:[1,0,0],pathCapacityW:rating,maxInputW:rating,sourceIds:['p1']};
 if(core){e.entityKind='engineCore';e.integrated=false;}
 const model={version:C.PROPULSION_MODEL_VERSION,massKg:1e6,ratedThrustN:rating/2e9,ratedAccelMps2:rating/2e15,accelerationLimitMps2:rating/2e15,engines:[e]};
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},{k:'engine',part:2,port:'p2',domain:'main',share:1,size:1}];
 if(core){model.architectureVersion=2;model.cores=[e];model.engines=[{...e,id:3,machineryId:2,coreId:2,moduleIndex:2,coreModuleIndex:1,integrated:false,shaftModuleIndices:[3],shaftRouteId:'shaft:2:3',shaftCapacityW:1e23,ratedShaftCapacityW:1e23}];modules.push({k:'engine',part:3,port:'p3',domain:'main',size:1,share:1},{k:'drivetrain',part:-8,coreId:2,nozzleId:3,capacityW:1e23,routeId:'shaft:2:3',size:1});}
 if(current){model.inputModelVersion=C.ENGINE_INPUT_MODEL_VERSION;for(const s of [...model.cores||[],...model.engines])Object.assign(s,{inputModelVersion:C.ENGINE_INPUT_MODEL_VERSION,inputLimitModel:'reactor-supply',availableInputW:source,sourceInputLimitW:source,allocationWeight:s.effectiveMachineryVolumeM3});}
 return {profileVersion:C.FLEET_PROFILE_VERSION,name:'Finite reactor snapshot',hp:1e20,len:20,width:10,height:10,maxSpeed:1200,D:0,wCap:0,crewNeed:0,crewMax:0,modules,propulsion:model,grid:{P:source,Pgen:source,fixed:0,cooling:0,De:rating,Ds:0,Dw:0}};
}
function input(p){const u=C.fleetUnit('reactor-clean','custom-reactor-clean',p);C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},0,'propulsion');return {u,W:u.propulsion.actualInputW};}
for(const rating of [1e15,1e30])test(`old authored input ${rating} does not restore a machinery-density or nameplate ceiling`,()=>{
 const raw=snapshot({rating}),before=JSON.stringify(raw),p=C.cleanCraftPowerProfile(raw);assert.ok(p);assert.equal(JSON.stringify(raw),before);assert.equal(p.propulsion.inputModelVersion,C.ENGINE_INPUT_MODEL_VERSION);assert.equal(p.propulsion.engines[0].valid,true);near(p.propulsion.engines[0].availableInputW,1e20);near(input(p).W,1e20);assert.deepEqual(plain(p.propulsion.engines[0].sourceIds),['p1']);
});
test('a profile with no finite reactor supply cannot manufacture force from its old input rating',()=>{
 const p=C.cleanCraftPowerProfile(snapshot({source:0,rating:1e30}));assert.ok(p);near(p.propulsion.engines[0].availableInputW,0);near(input(p).W,0);near(p.propulsion.ratedThrustN,0);
});
test('upgraded source and shape fields survive JSON save and cleaning without bringing back the old cap',()=>{
 const p=C.cleanCraftPowerProfile(snapshot());assert.ok(p);const saved=plain(p),copy=C.cleanCraftPowerProfile(saved);assert.ok(copy);const a=p.propulsion.engines[0],b=copy.propulsion.engines[0];for(const key of ['inputModelVersion','inputLimitModel','availableInputW','sourceInputLimitW','allocationWeight','effectiveMachineryVolumeM3'])assert.equal(b[key],a[key],key);assert.deepEqual(plain(b.sourceIds),plain(a.sourceIds));near(input(copy).W,input(p).W);near(input(copy).W,1e20);
});
test('source migration still rejects zero machinery volume and a substituted module identity',()=>{
 for(const field of ['shape','module','part']){const raw=snapshot();if(field==='shape')raw.propulsion.engines[0].machineryRadiusM=0;else if(field==='module')raw.propulsion.engines[0].moduleIndex=0;else raw.modules[1].part=99;const p=C.cleanCraftPowerProfile(raw);assert.ok(p);assert.equal(p.propulsion.engines[0].valid,false,field);near(input(p).W,0,field);}
});
test('current source-model path restrictions remain finite and are not mistaken for old generated ratings',()=>{
 const raw=snapshot({source:1e20,rating:1e20,current:true});raw.propulsion.engines[0].pathCapacityW=1e18;const p=C.cleanCraftPowerProfile(raw);assert.ok(p);near(p.propulsion.engines[0].pathCapacityW,1e18);near(input(p).W,1e18);
});
test('shared machinery outlets retain the owner source identity, physical volume and actual shaft restriction',()=>{
 const p=C.cleanCraftPowerProfile(snapshot({core:true}));assert.ok(p);const owner=p.propulsion.cores[0],outlet=p.propulsion.engines[0];assert.equal(owner.valid,true);assert.equal(outlet.valid,true);for(const key of ['inputModelVersion','inputLimitModel','availableInputW','sourceInputLimitW','allocationWeight'])assert.equal(outlet[key],owner[key],key);assert.deepEqual(plain(outlet.sourceIds),plain(owner.sourceIds));near(outlet.effectiveMachineryVolumeM3,owner.effectiveMachineryVolumeM3);assert.deepEqual(plain(outlet.shaftModuleIndices),[3]);near(outlet.shaftCapacityW,1e23);near(input(p).W,1e20);
});
test('a real saved blueprint replaces obsolete cached electrical and shaft caps with its physical source graph',()=>{
 const s=soloTrialDesign(C);C.syncCompartments(s);const stats=C.computeStats(s),fresh=C.craftPowerProfile(s,stats),raw=plain(fresh);delete raw.propulsion.inputModelVersion;delete raw.motionResistance;
 for(const e of [...raw.propulsion.cores||[],...raw.propulsion.engines]){delete e.inputModelVersion;delete e.inputLimitModel;e.ratedInputW=1e6;e.ratedThrustN=1e-3;e.pathCapacityW=1e6;e.shaftCapacityW=1e6;e.ratedShaftCapacityW=1e6;}
 const clean=C.cleanCraftPowerProfile(raw,C.serialize(s));assert.ok(clean);assert.equal(clean.propulsion.inputModelVersion,C.ENGINE_INPUT_MODEL_VERSION);assert.ok(input(fresh).W>1e6);near(input(clean).W,input(fresh).W,'blueprint-derived supply and shaft geometry');const round=C.cleanCraftPowerProfile(plain(clean));assert.ok(round);near(input(round).W,input(clean).W,'saved clean profile');
});
