const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),coreFile=process.env.KS_ENGINE_CANDIDATE||path.join(root,'js/core.js'),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const source=fs.readFileSync(coreFile,'utf8');vm.runInContext(source,cx,{filename:coreFile});const C=vm.runInContext('Core',cx),P0=3.4e17,k=1.9e9,near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,label+': '+a+' != '+b);
function spec(overrides={}){const R=P0*10;return {id:2,machineryId:2,valid:true,available:true,connected:true,outletAvailable:true,ratedInputW:R,effectiveMachineryVolumeM3:1,machineryVolumeM3:1,...C.engineDensityModel(R,1),driveProfileId:'standard',ratedThrustN:C.engineDensityModel(R,1).ratedShaftPowerW/k,powerNode:'p2',heatNode:'p2',domain:'main',pathCapacityW:R,direction:[1,0,0],...overrides};}
function profile(overrides={}){const core=spec();return {version:C.PROPULSION_MODEL_VERSION,architectureVersion:2,cores:[core],engines:[{...core,id:3,machineryId:2,shaftCapacityW:20*P0},{...core,id:4,machineryId:2,shaftCapacityW:20*P0}],massKg:1e6,ratedThrustN:core.ratedThrustN,ratedAccelMps2:core.ratedThrustN/1e6,structuralAccelerationLimitMps2:1e9,inertialFactor:1,accelerationLimitMps2:core.ratedThrustN/1e6,...overrides};}
function solve(p,options={}){return C.solveShipPropulsion(p,{throttle:1,sources:[{id:'p1',domain:'main',powerW:100*P0}],links:[{from:'p1',to:'p2',cap:100*P0,efficiency:1}],...options});}

test('a high acceptance rating does not penalize efficient operation below ordinary input',()=>{
 const s=spec(),point=C.engineOperatingPoint(s,P0*.4);assert.ok(s.efficiency<.7);near(point.efficiency,.95);near(point.usefulPropulsionW,.95*P0*.4);near(point.wasteHeatW,.05*P0*.4);near(point.actualThrustN,point.usefulPropulsionW/k);near(point.actualInputW,point.usefulPropulsionW+point.wasteHeatW);
 const max=C.engineOperatingPoint(s,s.ratedInputW);near(max.efficiency,s.efficiency);near(max.actualThrustN,s.ratedThrustN);near(C.engineOperatingPoint(s,s.ratedInputW*2).actualInputW,s.ratedInputW,'R remains the acceptance ceiling');
});
test('the mechanical capacity inverse solves the received-power efficiency curve on both branches',()=>{
 const s=spec();for(const cap of [.2*P0,.95*P0,1.5*P0,4*P0]){const input=C.engineInputForUsefulPower(s,cap),point=C.engineOperatingPoint(s,input);near(point.usefulPropulsionW,cap,'capacity boundary');assert.ok(C.engineOperatingPoint(s,input*(1+1e-6)).usefulPropulsionW>cap);}
 near(C.engineInputForUsefulPower(s,Infinity),s.ratedInputW);near(C.engineInputForUsefulPower(s,19*P0),s.ratedInputW);assert.equal(C.engineInputForUsefulPower(s,NaN),0);assert.equal(C.engineInputForUsefulPower(s,-1),0);
});
test('a shared body computes efficiency from its total received input, once before splitting outlets',()=>{
 const a=spec(),b=spec({id:3,direction:[0,0,1]}),requests=C.buildPropulsionRequests([a,b]),result=C.resolvePropulsion(requests,{2:.75*P0,3:.75*P0},1e6),point=C.engineOperatingPoint(a,1.5*P0);
 near(result.totalActualInputW,1.5*P0);near(result.usefulPropulsionW,point.usefulPropulsionW);near(result.wasteHeatW,point.wasteHeatW);assert.equal(result.cores.length,1);assert.ok(result.cores[0].efficiency<.95);near(result.forceVector[0],point.actualThrustN/2);near(result.forceVector[2],point.actualThrustN/2);
});
test('core allocation respects finite shaft capacity using the nonlinear inverse',()=>{
 const p=profile();p.engines.forEach(e=>e.shaftCapacityW=.75*P0);const result=solve(p),input=C.engineInputForUsefulPower(p.cores[0],1.5*P0);near(result.actualInputW,input);near(result.usefulPropulsionW,1.5*P0);near(result.cores[0].efficiency,C.engineOperatingPoint(p.cores[0],input).efficiency);for(const e of result.engines)assert.ok(e.shaftReceivedW<=.75*P0*(1+1e-9));near(result.actualInputW,result.usefulPropulsionW+result.wasteHeatW);
});
test('line loss and conversion loss both use actual power and conserve source energy',()=>{
 const p=profile(),efficiency=Math.exp(-1e-5*300),sent=.5*P0,result=solve(p,{sources:[{id:'p1',domain:'main',powerW:sent}],links:[{from:'p1',to:'p2',cap:100*P0,efficiency}]}),received=sent*efficiency;
 near(result.power.draw,sent);near(result.actualInputW,received);near(result.power.feedLossW,sent-received);near(result.wasteHeatW,.05*received);near(result.power.draw,result.usefulPropulsionW+result.wasteHeatW+result.power.feedLossW);near(result.actualThrustN,result.usefulPropulsionW/k);
});
test('structural and inertial bounds reduce requested input before power is allocated',()=>{
 const p=profile({structuralAccelerationLimitMps2:200,inertialFactor:.5,accelerationLimitMps2:100}),result=solve(p);assert.equal(result.structuralInputLimited,true);near(result.actualAccelMps2,100);near(result.actualThrustN,1e8);near(result.actualInputW,1e8*k/.95);near(result.power.draw,result.actualInputW);assert.ok(result.actualInputW<p.cores[0].ratedInputW/10);near(result.actualAccelMps2,result.actualThrustN/p.massKg,'no second inertial multiplier after accepted force');
 const low=solve(p,{throttle:.01});assert.equal(low.structuralInputLimited,false);near(low.actualAccelMps2,low.actualThrustN/p.massKg);assert.ok(low.actualAccelMps2<100);
});
test('the legacy architecture also caps electrical requests instead of discarding force afterward',()=>{
 const s=spec(),p={engines:[s],massKg:1e6,ratedThrustN:s.ratedThrustN,ratedAccelMps2:s.ratedThrustN/1e6,accelerationLimitMps2:100},result=solve(p);near(result.actualAccelMps2,100);near(result.power.draw,1e8*k/.95);assert.equal(result.structuralInputLimited,true);
});
test('unknown volume fails closed and known legacy input gains an explicit ordinary estimate',()=>{
 const s=spec();delete s.effectiveMachineryVolumeM3;delete s.machineryVolumeM3;delete s.normalInputW;assert.equal(C.engineOperatingPoint(s,P0).valid,false);assert.equal(C.buildPropulsionRequests([s])[0].requestedInputW,0);assert.equal(C.resolvePropulsion([{id:2,machineryId:2,spec:s,requestedInputW:P0}],{2:P0},1e6).totalThrustN,0);
 const legacy=C.legacyPropulsionProfile({grid:{De:P0},modules:[{k:'engine',part:2,size:1}],accel:1},100);assert.ok(legacy);near(legacy.engines[0].effectiveMachineryVolumeM3,1);assert.equal(legacy.engines[0].estimated,true);assert.equal(legacy.engines[0].machineryVolumeSource,'ordinary-input-estimate');
});
test('external drive emission is proportional to useful propulsion output, not electrical input',()=>{
 const start=source.indexOf('function unitSig('),end=source.indexOf('// A small deterministic jitter',start);assert.ok(start>=0&&end>start);const Csig={powerFactor:()=>1,EMIT:C.EMIT,BANDS:C.BANDS},ctx=vm.createContext({C:Csig,radarPower:()=>0,unitSens:()=>({rad:0})});vm.runInContext(source.slice(start,end),ctx);
 const s=spec(),point=C.engineOperatingPoint(s,4*P0);ctx.unit={p:{energyModel:{version:1}},ht:{band:{nu:0,ir:0,em:0}},pw:{eng:point.actualInputW},propulsion:{usefulPropulsionW:point.usefulPropulsionW}};const out=vm.runInContext('unitSig(unit)',ctx);near(out.ir,point.usefulPropulsionW*C.EMIT.engine[1]);near(out.em,point.usefulPropulsionW*C.EMIT.engine[2]);assert.ok(out.ir<point.actualInputW*C.EMIT.engine[1]);
});
