#!/usr/bin/env node
// Physical example audit. Pin --source to reproduce a before snapshot while builders change.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto');
const G=9.80665,round=n=>Number.isFinite(n)?+n.toPrecision(10):null,plain=x=>JSON.parse(JSON.stringify(x)),sum=a=>a.reduce((a,b)=>a+b,0);
const verification={seconds:30,dtSeconds:.5,mode:'balanced',engineThrottle:1,weapons:1,shields:1,simultaneousLoadScope:'A shared-power stress case. Input ratios below one are expected when the finite plant cannot supply every requested system at once.',allocationScope:'Balanced cases share the normal source budget; priority cases retain the model reactor-mode output factor and report their actual available watts.',thermalScope:'Thirty seconds from cold undamaged start; design presets additionally report sustained heat transport. Actual thrust always follows connected power.'};
function allocationComparison(C,key,p){
 const scenarios={driveOnly:{mode:'balanced',weapons:0,shields:0},balancedWeaponsAndDrive:{mode:'balanced',weapons:1,shields:0},balancedShieldsAndDrive:{mode:'balanced',weapons:0,shields:1},weaponsAndDrive:{mode:'weapons',weapons:1,shields:0},shieldsAndDrive:{mode:'shields',weapons:0,shields:1},allSystemsBalanced:{mode:'balanced',weapons:1,shields:1},allSystemsWeaponsPriority:{mode:'weapons',weapons:1,shields:1},allSystemsShieldsPriority:{mode:'shields',weapons:1,shields:1}},out={};
 for(const [name,scenario]of Object.entries(scenarios)){
  const u=C.fleetUnit('allocation:'+key+':'+name,key,p,0);u.order={...u.order,power:scenario.mode};C.heatInit(u);
  const want={throttle:1,weapons:p.grid.Dw*scenario.weapons,shields:p.grid.Ds*scenario.shields},r=C.allocateShipPower(u,C.fleetSystems(u),want,.5,scenario.mode),power=r.propulsion.power,sources=power.sources||[],available=sum(sources.map(s=>s.availableW||0)),draw=sum(sources.map(s=>s.drawW||0));
  out[name]={mode:scenario.mode,requestedWeaponsInputW:round(want.weapons),requestedShieldInputW:round(want.shields),actualEngineInputW:round(r.propulsion.actualInputW),actualWeaponInputW:round(r.got.weapons),actualShieldInputW:round(r.got.shields),actualFixedInputW:round(r.got.fixedGranted),actualCoolingGrantedW:round(r.got.coolingGranted),actualG:round(r.propulsion.actualAccelMps2/G),engineOutputRatio:round(r.propulsion.outputRatio),availableSourcePowerW:round(available),availableToNormalPlantRatio:p.grid.P>0?round(available/p.grid.P):null,sourceDrawW:round(draw),powerConserved:sources.every(s=>(s.drawW||0)<=(s.availableW||0)*(1+1e-10)+1e-6),maximumSourceOverdrawW:round(Math.max(0,...sources.map(s=>(s.drawW||0)-(s.availableW||0)))),sources:sources.map(s=>({id:s.id,availableW:round(s.availableW),drawW:round(s.drawW)}))};
 }
 return out;
}
// Reuse the generator's final ship, fresh design statistics and profile. This
// retains overlap/capacitor/heat evidence without another expensive stats pass.
function auditBuilt(C,key,ship,S,p=null,options={}){
 const start=Date.now();p=p||C.craftPowerProfile(ship,S);const u=C.fleetUnit(key,key,p,0),prop=p.propulsion;
  u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);if(u.ht){u.ht.t=0;u.ht.last=0;}if(u.fo){u.fo.d.fill(1);u.fo.want.fill(1);}
  let minEngine=1,minWeapons=1,minShields=1,minThermal=1,maxSourceDrawRatio=0,last;
  for(let i=0;i<60;i++){
   const r=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:p.grid.Dw,shields:p.grid.Ds},.5,'balanced');last=r.propulsion;
   minEngine=Math.min(minEngine,last.outputRatio);minWeapons=Math.min(minWeapons,p.grid.Dw>0?r.got.weapons/p.grid.Dw:1);minShields=Math.min(minShields,p.grid.Ds>0?r.got.shields/p.grid.Ds:1);
   for(const x of last.power.sources)if(x.availableW>0)maxSourceDrawRatio=Math.max(maxSourceDrawRatio,x.drawW/x.availableW);
   C.heatTick({time:(i+1)*.5,ev(){}},u,.5);if(u.ht?.lm?.length)minThermal=Math.min(minThermal,...u.ht.lm);
  }
  const capacitors=Object.entries(S.chargeInfo||{}).map(([id,c])=>({id:+id,kind:ship.fits.find(f=>f.id===+id)?.k,ratio:round(c.ratio),blocked:!!c.blocked,capacityRatio:round(c.capacityRatio),allocatedVolumeM3:round(c.volume),requiredVolumeM3:round(c.required)}));
  const h=S.heat,entry={key,name:ship.name,reference:ship.reference??null,referenceTarget:plain(C.SHIP_REFERENCE[ship.reference||key]||{}),timingSeconds:{...options.timingSeconds,profileAndRuntime:round((Date.now()-start)/1000)},massT:round(S.mass),dimensionsM:plain(S.dims),powerW:round(S.power),draw:plain(S.draw),defaultCombatActualG:round(S.accelG),ratedG:round(prop.ratedAccelMps2/G),structuralG:round(S.aStruct/G),inertialFactor:round(prop.inertialFactor),defaultCombatOutputRatio:round(S.propulsion.outputRatio),ratedEngineInputW:round(sum(prop.engines.filter((e,i,a)=>a.findIndex(x=>x.machineryId===e.machineryId)===i).map(e=>e.ratedInputW))),engines:prop.engines.map(e=>({id:e.id,machineryId:e.machineryId,reactorId:e.reactorId,valid:e.valid,available:e.available,connected:e.connected,outletAvailable:e.outletAvailable,grade:e.machineryGradeId,drive:e.driveProfileId,issues:e.issues,ratedInputW:round(e.ratedInputW),maxInputW:round(e.maxInputW),machineryLengthM:round(e.machineryLengthM),machineryRadiusM:round(e.machineryRadiusM),machineryVolumeM3:round(e.effectiveMachineryVolumeM3),legacyCoolingInputW:round(e.legacyCoolingInputW)})),overlapIds:Object.entries(S.info||{}).filter(([,v])=>v.overlap).map(([id])=>+id),partsByKind:ship.parts.reduce((a,p)=>(a[p.k]=(a[p.k]||0)+1,a),{}),weaponCounts:ship.fits.reduce((a,f)=>(a[f.k]=(a[f.k]||0)+1,a),{}),capacitors,thermal:h?{mode:h.mode,sources:h.sources,explicitDissipatorCount:h.dis.length,explicitDissipatorCapacityW:round(h.disCap),builtinCapacityW:round(h.builtin),skinCapacityW:round(h.skin),powerPaths:plain(h.power),heatPaths:plain(h.heat),presets:plain(h.presets)}:null,fullLoadRun:{minimumEngineOutputRatio:round(minEngine),minimumWeaponsInputRatio:round(minWeapons),minimumShieldInputRatio:round(minShields),minimumThermalLimit:round(minThermal),maximumSourceDrawRatio:round(maxSourceDrawRatio),lastActualG:round(last.actualAccelMps2/G)},warnings:(S.warnings||[]).map(w=>({level:w.lv,code:w.code,text:w.text}))};
  const baselinePower=ship.shipSystemRefit?.baselinePowerW,referencePower=C.SHIP_REFERENCE[ship.reference||key]?.power;
  entry.plant={baselinePowerW:round(baselinePower),installedPowerW:round(S.power),referencePowerW:round(referencePower),baselinePowerPreserved:Number.isFinite(baselinePower)?Math.abs(S.power-baselinePower)<=Math.max(1,baselinePower*1e-9):null,referencePowerRatio:referencePower>0?round(S.power/referencePower):null,addedReactorCount:ship.shipSystemRefit?.addedReactors?.length??null};
  entry.allocationScenarios=allocationComparison(C,key,p);entry.timingSeconds.profileAndRuntime=round((Date.now()-start)/1000);
  return entry;
}
function summarize(out){
 const good=out.models.filter(x=>!x.error);
 out.pending=out.allKeys.filter(k=>!out.models.some(m=>m.key===k));out.complete=out.pending.length===0;
 out.summary={attempted:out.models.length,successful:good.length,buildFailures:out.models.filter(x=>x.error).map(x=>x.key),zeroDefaultCombatG:good.filter(x=>x.defaultCombatActualG===0).map(x=>x.key),legacyMachineryGrades:good.filter(x=>x.engines.some(e=>e.grade==='legacy-refit')).map(x=>x.key),unavailableEngines:good.filter(x=>x.engines.some(e=>!e.available)).map(x=>x.key),simultaneousFullLoadLimited:good.filter(x=>['minimumEngineOutputRatio','minimumWeaponsInputRatio','minimumShieldInputRatio'].some(k=>x.fullLoadRun[k]<.999)).map(x=>x.key),powerConservationFailures:good.filter(x=>Object.values(x.allocationScenarios||{}).some(s=>!s.powerConserved)).map(x=>x.key),changedOriginalPlants:good.filter(x=>x.plant?.baselinePowerPreserved===false).map(x=>x.key),sustainedCombatHeatAccumulation:good.filter(x=>x.thermal?.presets.combat.overCount).map(x=>x.key),explicitDissipatorShips:good.filter(x=>x.thermal?.explicitDissipatorCount>0).map(x=>x.key),capacitorCount:good.reduce((n,m)=>n+m.capacitors.length,0),incompleteCapacitors:good.flatMap(m=>m.capacitors.filter(c=>c.ratio<.999||c.blocked).map(c=>({key:m.key,...c})))};
 return out;
}
function main(){
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2),option=(key,fallback)=>args.find(x=>x.startsWith('--'+key+'='))?.split('=').slice(1).join('=')??fallback;
const source=option('source','c805f05'),destination=path.resolve(root,option('output','docs/benchmarks/ship-examples-before.json'));
const sourceSha256={},cx=vm.createContext({console}),read=file=>{const code=source==='current'?fs.readFileSync(path.join(root,file),'utf8'):cp.execFileSync('git',['show',source+':'+file],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});sourceSha256[file]=crypto.createHash('sha256').update(code).digest('hex');return code;};
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(read(file),cx,{filename:file});
const C=vm.runInContext('Core',cx);
const all=['imperial','venator',...Object.keys(C.SHIP_EXAMPLES).filter(k=>!C.SHIP_EXAMPLES[k].craft),'executor'];
const keys=option('keys','').split(',').filter(Boolean),chosen=keys.length?keys:all;
const out={source,sourceSha256,generatedAt:new Date().toISOString(),modelVersion:C.PROPULSION_MODEL_VERSION,allKeys:all,verification,models:[]};
fs.mkdirSync(path.dirname(destination),{recursive:true});
for(const key of chosen){
 const start=Date.now();console.error('audit start '+key);
 try{
  const ship=C.buildDesign(key),built=Date.now(),S=C.computeStats(ship),computed=Date.now(),entry=auditBuilt(C,key,ship,S,null,{timingSeconds:{build:round((built-start)/1000),stats:round((computed-built)/1000)}});
  entry.timingSeconds.total=round((Date.now()-start)/1000);out.models.push(entry);
  console.error(JSON.stringify({key,totalSeconds:entry.timingSeconds.total,massT:entry.massT,G:entry.defaultCombatActualG,ratedG:entry.ratedG,engines:entry.engines.length,unavailable:entry.engines.filter(e=>!e.available).length,legacy:entry.engines.filter(e=>e.grade==='legacy-refit').length,overlaps:entry.overlapIds.length,capacitors:entry.capacitors.length,badCaps:entry.capacitors.filter(c=>c.ratio<.999||c.blocked).length,thermal:entry.thermal?.presets.combat.margin,runtime:entry.fullLoadRun}));
 }catch(error){out.models.push({key,error:String(error.stack||error),timingSeconds:{total:round((Date.now()-start)/1000)}});console.error(key+': '+error);}
 fs.writeFileSync(destination,JSON.stringify(summarize(out),null,2)+'\n');
}
console.log(destination);
}
module.exports={auditBuilt,allocationComparison,summarize,verification};
if(require.main===module)main();
