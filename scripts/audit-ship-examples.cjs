#!/usr/bin/env node
// Physical example audit. Pin --source to reproduce a before snapshot while builders change.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),crypto=require('node:crypto');
const G=9.80665,round=n=>Number.isFinite(n)?+n.toPrecision(10):null,plain=x=>JSON.parse(JSON.stringify(x)),sum=a=>a.reduce((a,b)=>a+b,0);
const verification={seconds:30,dtSeconds:.5,mode:'balanced',engineThrottle:1,weapons:1,shields:1,strictThermalRequired:true,simultaneousLoadScope:'A shared-power stress case. Input ratios below one are expected when the finite plant cannot supply every requested system at once.',allocationScope:'Balanced cases share the normal source budget; priority cases retain the model reactor-mode output factor and report their actual available watts.',thermalScope:'Thirty seconds from cold undamaged start; design presets additionally report sustained heat transport. Current factory examples require strict cooling, zero integral or legacy sinks, and finite power for installed cooling equipment. Actual thrust always follows connected power.'};
function strictThermalEvidence(C,S,p){
 const h=S.heat,runtimeProfile=C.heatProfile(p),design=h?.net?.dis||[],runtime=runtimeProfile?.dis||[],kinds=rows=>rows.reduce((out,d)=>(out[d.k]=(out[d.k]||0)+1,out),{}),integral=rows=>rows.filter(d=>d.k==='integral').length,legacy=rows=>rows.filter(d=>d.k==='legacy'||d.legacy===true).length;
 const installed=design.filter(d=>d.part!=null),powers=installed.map(d=>d.power??0),networkPower=powers.reduce((n,w)=>n+w,0),statsPower=S.dissipatorPower??h?.dissipatorPower,profilePower=p.grid?.cooling,near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.max(Math.abs(a),Math.abs(b))*1e-7);
 const evidence={mode:h?.mode??null,runtimeMode:runtimeProfile?.mode??null,runtimeHeatVersion:runtimeProfile?.v??null,builtinCapacityW:round(h?.builtin),legacyAutomaticSinkCount:h?.legacy??null,designSinkKinds:kinds(design),runtimeSinkKinds:kinds(runtime),integralSinkCount:integral(design),legacySinkCount:legacy(design),runtimeIntegralSinkCount:integral(runtime),runtimeLegacySinkCount:legacy(runtime),realCoolerCount:installed.length,realCoolerPowerW:round(statsPower),networkCoolerPowerW:round(networkPower),profileCoolerPowerW:round(profilePower),realCoolerPowerFinite:installed.length>0&&powers.every(w=>Number.isFinite(w)&&w>=0)&&Number.isFinite(statsPower)&&statsPower>0&&Number.isFinite(profilePower)&&profilePower>0&&Number.isFinite(networkPower)&&networkPower>0,coolerPowerConsistent:near(statsPower,networkPower)&&near(statsPower,profilePower)};
 const violations=[];if(evidence.mode!=='strict')violations.push('mode-not-strict');if(evidence.runtimeMode!=='strict')violations.push('runtime-mode-not-strict');if(h?.builtin!==0)violations.push('builtin-cooling-present');if(evidence.integralSinkCount||evidence.runtimeIntegralSinkCount)violations.push('integral-sinks-present');if(evidence.legacySinkCount||evidence.runtimeLegacySinkCount||evidence.legacyAutomaticSinkCount!==0)violations.push('legacy-sinks-present');if(!evidence.realCoolerPowerFinite)violations.push('real-cooler-power-not-positive-finite');if(!evidence.coolerPowerConsistent)violations.push('real-cooler-power-inconsistent');evidence.strictCoolingViolations=violations;evidence.strictCoolingVerified=violations.length===0;return evidence;
}
function assertStrictThermal(key,thermal){
 if(!thermal?.strictCoolingVerified)throw new Error(key+': strict thermal audit failed: '+(thermal?.strictCoolingViolations||['missing-thermal-evidence']).join(', '));
 return thermal;
}
function allocationComparison(C,key,p){
 const scenarios={driveOnly:{mode:'balanced',weapons:0,shields:0},balancedWeaponsAndDrive:{mode:'balanced',weapons:1,shields:0},balancedShieldsAndDrive:{mode:'balanced',weapons:0,shields:1},weaponsAndDrive:{mode:'weapons',weapons:1,shields:0},shieldsAndDrive:{mode:'shields',weapons:0,shields:1},allSystemsBalanced:{mode:'balanced',weapons:1,shields:1},allSystemsWeaponsPriority:{mode:'weapons',weapons:1,shields:1},allSystemsShieldsPriority:{mode:'shields',weapons:1,shields:1}},out={};
 for(const [name,scenario]of Object.entries(scenarios)){
  const u=C.fleetUnit('allocation:'+key+':'+name,key,p,0);u.order={...u.order,power:scenario.mode};C.heatInit(u);
  const want={throttle:1,weapons:p.grid.Dw*scenario.weapons,shields:p.grid.Ds*scenario.shields},r=C.allocateShipPower(u,C.fleetSystems(u),want,.5,scenario.mode),power=r.propulsion.power,sources=power.sources||[],available=sum(sources.map(s=>s.availableW||0)),draw=sum(sources.map(s=>s.drawW||0));
  out[name]={mode:scenario.mode,requestedWeaponsInputW:round(want.weapons),requestedShieldInputW:round(want.shields),actualEngineInputW:round(r.propulsion.actualInputW),actualWeaponInputW:round(r.got.weapons),actualShieldInputW:round(r.got.shields),actualFixedInputW:round(r.got.fixedGranted),actualCoolingGrantedW:round(r.got.coolingGranted),actualG:round(r.propulsion.actualAccelMps2/G),engineOutputRatio:round(r.propulsion.outputRatio),availableSourcePowerW:round(available),availableToNormalPlantRatio:p.grid.P>0?round(available/p.grid.P):null,sourceDrawW:round(draw),powerConserved:sources.every(s=>(s.drawW||0)<=(s.availableW||0)*(1+1e-10)+1e-6),maximumSourceOverdrawW:round(Math.max(0,...sources.map(s=>(s.drawW||0)-(s.availableW||0)))),sources:sources.map(s=>({id:s.id,availableW:round(s.availableW),drawW:round(s.drawW)}))};
 }
 return out;
}
function crewReadiness(C,key,S,p){
 const required=Math.max(0,S.crew||0),capacity=Math.max(0,S.crewCapacity??0),aboard=Math.max(0,S.crewAboard??Math.min(required,capacity)),autoCrew=Math.max(0,S.autoCrew??p.autoCrew??0),minimum=C.FLEET_MIN_CREW??.35;
 // The small power-only profile omits automation's crew credit. Restore it
 // for the same cold fleet readiness check used by a full fleet profile.
 const crewProfile={...p,autoCrew},u=C.fleetUnit('crew:'+key,key,crewProfile,0),systems=C.fleetSystems(u),ratio=C.fleetCrewRatio(u,systems),reason=C.fleetOutReason(u,systems);
 return {required:round(required),capacity:round(capacity),aboard:round(aboard),habit:round(S.habit),autoCrew:round(autoCrew),fleetCrewRatio:round(ratio),fleetMinCrew:minimum,fleetMinimumSatisfied:ratio>=minimum,understaffed:aboard<required,zeroCrewDespiteRequirement:required>0&&aboard===0,coldFleetCrew:round(u.crew),coldOutReason:reason,usable:reason===null,freeHabitableVolumeM3:round(S.habitableVolume),unassignedVolumeM3:round(S.unassignedVolume),weaponFeedVolumeM3:round(S.feedVolume),weaponFeedBranchVolumeM3:round(S.feedBranchVolume),weaponFeedChargeVolumeM3:round(S.feedChargeVolume),weaponFeedInputW:round(S.feedDemand),volumePerPersonM3:round(S.personVolume)};
}
// Reuse the generator's final ship, fresh design statistics and profile. This
// retains overlap/capacitor/heat evidence without another expensive stats pass.
function auditBuilt(C,key,ship,S,p=null,options={}){
 const start=Date.now();p=p||C.craftPowerProfile(ship,S);const u=C.fleetUnit(key,key,p,0),prop=p.propulsion;
  u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);if(u.ht){u.ht.t=0;u.ht.last=0;}if(u.fo){u.fo.d.fill(1);u.fo.want.fill(1);}
  let minEngine=1,minWeapons=1,minShields=1,minThermal=1,maxSourceDrawRatio=0,maxCoolerInputW=0,coolerInputAlwaysFinite=true,last;
  for(let i=0;i<60;i++){
   const r=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:p.grid.Dw,shields:p.grid.Ds},.5,'balanced');last=r.propulsion;
   minEngine=Math.min(minEngine,last.outputRatio);minWeapons=Math.min(minWeapons,p.grid.Dw>0?r.got.weapons/p.grid.Dw:1);minShields=Math.min(minShields,p.grid.Ds>0?r.got.shields/p.grid.Ds:1);
   for(const x of last.power.sources)if(x.availableW>0)maxSourceDrawRatio=Math.max(maxSourceDrawRatio,x.drawW/x.availableW);
   C.heatTick({time:(i+1)*.5,ev(){}},u,.5);if(u.ht?.lm?.length)minThermal=Math.min(minThermal,...u.ht.lm);
   const coolerInput=u.ht?.cooling?.lastDraw??0;coolerInputAlwaysFinite&&=Number.isFinite(coolerInput)&&coolerInput>=0;if(Number.isFinite(coolerInput))maxCoolerInputW=Math.max(maxCoolerInputW,coolerInput);
  }
  const capacitors=Object.entries(S.chargeInfo||{}).map(([id,c])=>({id:+id,kind:ship.fits.find(f=>f.id===+id)?.k,ratio:round(c.ratio),blocked:!!c.blocked,capacityRatio:round(c.capacityRatio),allocatedVolumeM3:round(c.volume),requiredVolumeM3:round(c.required)}));
  const h=S.heat,entry={key,name:ship.name,reference:ship.reference??null,referenceTarget:plain(C.SHIP_REFERENCE[ship.reference||key]||{}),timingSeconds:{...options.timingSeconds,profileAndRuntime:round((Date.now()-start)/1000)},massT:round(S.mass),dimensionsM:plain(S.dims),powerW:round(S.power),draw:plain(S.draw),defaultCombatActualG:round(S.accelG),ratedG:round(prop.ratedAccelMps2/G),structuralG:round(S.aStruct/G),inertialFactor:round(prop.inertialFactor),defaultCombatOutputRatio:round(S.propulsion.outputRatio),ratedEngineInputW:round(sum(prop.engines.filter((e,i,a)=>a.findIndex(x=>x.machineryId===e.machineryId)===i).map(e=>e.ratedInputW))),engines:prop.engines.map(e=>({id:e.id,machineryId:e.machineryId,reactorId:e.reactorId,valid:e.valid,available:e.available,connected:e.connected,outletAvailable:e.outletAvailable,grade:e.machineryGradeId,drive:e.driveProfileId,issues:e.issues,ratedInputW:round(e.ratedInputW),maxInputW:round(e.maxInputW),machineryLengthM:round(e.machineryLengthM),machineryRadiusM:round(e.machineryRadiusM),machineryVolumeM3:round(e.effectiveMachineryVolumeM3),legacyCoolingInputW:round(e.legacyCoolingInputW)})),overlapIds:Object.entries(S.info||{}).filter(([,v])=>v.overlap).map(([id])=>+id),partsByKind:ship.parts.reduce((a,p)=>(a[p.k]=(a[p.k]||0)+1,a),{}),weaponCounts:ship.fits.reduce((a,f)=>(a[f.k]=(a[f.k]||0)+1,a),{}),capacitors,thermal:h?{mode:h.mode,sources:h.sources,explicitDissipatorCount:h.dis.length,explicitDissipatorCapacityW:round(h.disCap),builtinCapacityW:round(h.builtin),skinCapacityW:round(h.skin),powerPaths:plain(h.power),heatPaths:plain(h.heat),presets:plain(h.presets)}:null,fullLoadRun:{minimumEngineOutputRatio:round(minEngine),minimumWeaponsInputRatio:round(minWeapons),minimumShieldInputRatio:round(minShields),minimumThermalLimit:round(minThermal),maximumSourceDrawRatio:round(maxSourceDrawRatio),lastActualG:round(last.actualAccelMps2/G)},warnings:(S.warnings||[]).map(w=>({level:w.lv,code:w.code,text:w.text}))};
  const baselinePower=ship.shipSystemRefit?.baselinePowerW,referencePower=C.SHIP_REFERENCE[ship.reference||key]?.power;
  entry.plant={baselinePowerW:round(baselinePower),installedPowerW:round(S.power),referencePowerW:round(referencePower),baselinePowerPreserved:Number.isFinite(baselinePower)?Math.abs(S.power-baselinePower)<=Math.max(1,baselinePower*1e-7):null,referencePowerRatio:referencePower>0?round(S.power/referencePower):null,addedReactorCount:ship.shipSystemRefit?.addedReactors?.length??null};
  entry.shield={capacityJ:round(S.shieldCapacity),designAbsorptionW:round(S.shieldP),maintenanceInputW:round(S.draw?.shields),dissipationW:round(S.shieldDissipationW)};
  entry.allGunVolleyTT=round(S.allGunVolleyTT);
  const target=C.SHIP_REFERENCE[ship.reference||key];
  if(target?.volleyTT!=null&&options.requireStrictThermal!==false){for(const [label,actual,wanted]of [['power',S.power,target.power],['shield capacity',S.shieldCapacity,target.shieldLoad],['shield dissipation',S.shieldDissipationW,target.shieldDissipationW],['all-gun salvo',S.allGunVolleyTT,target.volleyTT]])if(!Number.isFinite(actual)||Math.abs(actual-wanted)>Math.max(1,Math.abs(wanted))*1e-7)throw new Error(key+': requested '+label+' differs from the installed hardware');}
  entry.thermal={...entry.thermal,...strictThermalEvidence(C,S,p)};
  entry.fullLoadRun.maximumRealCoolerInputW=round(maxCoolerInputW);entry.fullLoadRun.coolerInputAlwaysFinite=coolerInputAlwaysFinite;
  entry.crew=crewReadiness(C,key,S,p);
  entry.allocationScenarios=allocationComparison(C,key,p);entry.timingSeconds.profileAndRuntime=round((Date.now()-start)/1000);
  if(options.requireStrictThermal!==false)assertStrictThermal(key,entry.thermal);
  return entry;
}
function summarize(out){
 const good=out.models.filter(x=>!x.error);
 out.pending=out.allKeys.filter(k=>!out.models.some(m=>m.key===k));out.complete=out.pending.length===0;
 out.summary={attempted:out.models.length,successful:good.length,buildFailures:out.models.filter(x=>x.error).map(x=>x.key),zeroDefaultCombatG:good.filter(x=>x.defaultCombatActualG===0).map(x=>x.key),legacyMachineryGrades:good.filter(x=>x.engines.some(e=>e.grade==='legacy-refit')).map(x=>x.key),unavailableEngines:good.filter(x=>x.engines.some(e=>!e.available)).map(x=>x.key),understaffed:good.filter(x=>x.crew?.understaffed).map(x=>x.key),belowFleetMinCrew:good.filter(x=>x.crew?.fleetMinimumSatisfied===false).map(x=>x.key),zeroCrewUnusable:good.filter(x=>x.crew?.aboard===0&&x.crew.usable===false).map(x=>x.key),zeroCrewUsableDespiteRequirement:good.filter(x=>x.crew?.zeroCrewDespiteRequirement&&x.crew.usable).map(x=>x.key),noHabitableVolume:good.filter(x=>x.crew?.required>0&&x.crew.freeHabitableVolumeM3===0).map(x=>x.key),simultaneousFullLoadLimited:good.filter(x=>['minimumEngineOutputRatio','minimumWeaponsInputRatio','minimumShieldInputRatio'].some(k=>x.fullLoadRun[k]<.999)).map(x=>x.key),powerConservationFailures:good.filter(x=>Object.values(x.allocationScenarios||{}).some(s=>!s.powerConserved)).map(x=>x.key),changedOriginalPlants:good.filter(x=>x.plant?.baselinePowerPreserved===false).map(x=>x.key),sustainedCombatHeatAccumulation:good.filter(x=>x.thermal?.presets.combat.overCount).map(x=>x.key),explicitDissipatorShips:good.filter(x=>x.thermal?.explicitDissipatorCount>0).map(x=>x.key),capacitorCount:good.reduce((n,m)=>n+m.capacitors.length,0),incompleteCapacitors:good.flatMap(m=>m.capacitors.filter(c=>c.ratio<.999||c.blocked).map(c=>({key:m.key,...c})))};
 out.summary.nonStrictCooling=good.filter(x=>x.thermal?.mode!=='strict').map(x=>x.key);out.summary.implicitCoolingSinks=good.filter(x=>x.thermal?.integralSinkCount||x.thermal?.legacySinkCount||x.thermal?.runtimeIntegralSinkCount||x.thermal?.runtimeLegacySinkCount||x.thermal?.builtinCapacityW!==0).map(x=>x.key);out.summary.invalidRealCoolerPower=good.filter(x=>x.thermal?.realCoolerPowerFinite!==true||x.thermal?.coolerPowerConsistent!==true||x.fullLoadRun.coolerInputAlwaysFinite===false).map(x=>x.key);out.summary.strictThermalFailures=good.filter(x=>x.thermal?.strictCoolingVerified!==true).map(x=>x.key);
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
const out={source,sourceSha256,generatedAt:new Date().toISOString(),modelVersion:C.PROPULSION_MODEL_VERSION,allKeys:all,verification:{...verification,strictThermalRequired:source==='current'},models:[]};
fs.mkdirSync(path.dirname(destination),{recursive:true});
for(const key of chosen){
 const start=Date.now();console.error('audit start '+key);
 try{
  const ship=C.buildDesign(key),built=Date.now(),S=C.computeStats(ship),computed=Date.now(),entry=auditBuilt(C,key,ship,S,null,{requireStrictThermal:source==='current',timingSeconds:{build:round((built-start)/1000),stats:round((computed-built)/1000)}});
  entry.timingSeconds.total=round((Date.now()-start)/1000);out.models.push(entry);
  console.error(JSON.stringify({key,totalSeconds:entry.timingSeconds.total,massT:entry.massT,G:entry.defaultCombatActualG,ratedG:entry.ratedG,engines:entry.engines.length,unavailable:entry.engines.filter(e=>!e.available).length,legacy:entry.engines.filter(e=>e.grade==='legacy-refit').length,overlaps:entry.overlapIds.length,capacitors:entry.capacitors.length,badCaps:entry.capacitors.filter(c=>c.ratio<.999||c.blocked).length,thermal:entry.thermal?.presets.combat.margin,runtime:entry.fullLoadRun}));
 }catch(error){out.models.push({key,error:String(error.stack||error),timingSeconds:{total:round((Date.now()-start)/1000)}});console.error(key+': '+error);}
 fs.writeFileSync(destination,JSON.stringify(summarize(out),null,2)+'\n');
}
console.log(destination);
}
module.exports={auditBuilt,allocationComparison,crewReadiness,strictThermalEvidence,assertStrictThermal,summarize,verification};
if(require.main===module)main();
