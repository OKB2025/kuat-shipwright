#!/usr/bin/env node
// Three public production references, actual funded thrust and finite thermal/fuel operation.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),args=process.argv.slice(2);
const value=key=>{const at=args.indexOf(key);return at<0?null:args[at+1];};
const output=path.resolve(value('--output')||path.join(root,'docs/benchmarks/reference-acceleration-runtime.json'));
const scratch=path.resolve(value('--scratch-dir')||path.join(root,'../scratch/reference-acceleration-final'));
const prototype=args.includes('--prototype'),reuseFile=value('--reuse'),tieBaselineFile=value('--tie-baseline');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const stable=value=>JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
const near=(actual,expected,label,tolerance=1e-8)=>assert.ok(Number.isFinite(actual)&&Number.isFinite(expected)&&Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*tolerance,`${label}: ${actual} != ${expected}`);
const files=['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));
const started=Date.now(),report={status:'RUNNING',prototype,startedAt:new Date().toISOString(),command:['node',path.relative(root,__filename),...args],sourceSha256:hashes(),harnessSha256:sha(fs.readFileSync(__filename)),scope:'Actual public production TIE/ln, Venator and Imperial I hardware. One factory build per reference, or an explicitly identified production blueprint with exactly matching source hashes. TIE uses the canonical craftPowerProfile used by the craft runtime blueprint path; capital ships use fleetProfile. No table estimates, private uploads, artificial damage, changed heat/fuel constants or seeded velocities. The cold allocations are separate new units. The 120-second runs start at rest and use actual finite power, heat, fuel and motion processing; no geometry/statistics are rebuilt during those runs.',conditions:{mode:'propulsion priority; full forward throttle; weapons and shields request zero',durationSeconds:120,stepSeconds:.25,thermal:'Normal emission, real installed cooling and ordinary crew, cold start. Not a heat-equilibrium or endurance guarantee.',browser:'This Node evidence is separate from native Worker/WebGL/browser verification.'},stages:[],references:[],limitations:[]};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.mkdirSync(scratch,{recursive:true});
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
const stage=(name,details={})=>{const row={name,elapsedMs:Date.now()-started,...details};report.stages.push(row);save();console.log(JSON.stringify(row));};
const productionFixtures={references:{}};
const persist=(key,kind,value)=>{const file=path.join(scratch,key+'-'+kind+'.json');fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');return file;};
function geometryRecord(part){
 const keys=['id','k','c','s','d','length','form','outline','loft','surfaceNormal','pitch','roll','yaw','light','wing','panelBracing','panelFrame','panelRib','panelFold','panelKnee','panelSparX'];
 return Object.fromEntries(keys.filter(key=>Object.hasOwn(part,key)).map(key=>[key,part[key]]));
}
function enginesOf(profile){return profile.propulsion.cores||profile.propulsion.engines||[];}
function newUnit(C,key,profile,suffix){
 const unit=C.fleetUnit('reference-'+key+'-'+suffix,key,profile,0);
 unit.order={...unit.order,power:'propulsion'};unit.maneuver=1;
 return unit;
}
function sample(C,unit,time,commandedThrottle){
 const r=unit.propulsion||{},power=r.power||{},thermal=C.heatStatus(unit),fuel=C.shipFuelState(unit),velocity=(unit.velocity||[0,0,0]).slice(),acc=C.propulsionMotion(unit).acc,rate=C.massDragRate(unit);
 return {time,commandedThrottle,velocity,speedMps:Math.hypot(...velocity),position:(unit.pos||[0,0,0]).slice(),actualInputW:r.actualInputW||0,actualThrustN:r.actualThrustN||0,physicalAccelMps2:r.actualAccelMps2||0,physicalG:(r.actualAccelMps2||0)/C.G0,gameAccelMps2:acc,netGameAccelMps2:acc-rate*velocity[0],netEquivalentPhysicalG:(acc-rate*velocity[0])/C.FLEET_RULES.accelScale/C.G0,dragRatePerSecond:rate,equilibriumSpeedMps:rate>0?acc/rate:0,engineWasteHeatW:r.wasteHeatW||0,engineUsefulPowerW:r.usefulPropulsionW||0,outputRatio:r.outputRatio||0,sourcePowerW:power.P||0,sourceDrawW:unit.pw?.draw??power.draw??0,allocatedSourceDrawW:power.draw||0,actualCoolingSourceDrawW:unit.pw?.coolingSource||0,engineSourceSentW:(power.engineBudgets||[]).reduce((n,b)=>n+b.drawW,0),feedLossW:power.feedLossW||0,coolingGrantedW:power.cooling||0,fixedGrantedW:power.fixed||0,structuralInputLimited:!!r.structuralInputLimited,thermal:thermal?{online:thermal.online,damageLimit:thermal.damageLimit,outputFactor:thermal.outputFactor,qJ:thermal.qJ,capacityJ:thermal.capacityJ,fill:thermal.peak,peakJ:thermal.peakJ,actualGeneratedElectricalJ:thermal.actualGeneratedElectricalJ,reactorHeatJ:thermal.reactorHeatJ,operatingHeatJ:thermal.operatingHeatJ,rejectedHeatJ:thermal.rejectedHeatJ,pendingJ:Object.values(unit.ht?.e||{}).reduce((n,J)=>n+Math.max(0,J||0),0)+['engineE','reactorE','feedE','esw'].reduce((n,key)=>n+(unit.ht?.[key]||[]).reduce((m,J)=>m+Math.max(0,J||0),0),0),feedLossJ:thermal.feedLossJ,coolingInputJ:thermal.cooling?.inputJ||0,coolingSourceInputJ:thermal.cooling?.sourceInputJ||0,restartWork:thermal.restartWork}:null,fuel:fuel?{capacityKnown:fuel.capacityKnown,capacityJ:fuel.capacityJ,generatedElectricalJ:fuel.generatedElectricalJ,reactorConversionHeatJ:fuel.reactorConversionHeatJ,fuelEnergyJ:fuel.fuelEnergyJ,consumedKg:fuel.consumedKg,overdrawJ:fuel.overdrawJ}:null,out:unit.out??null,disabled:unit.disabled??null,powerLossDisabled:unit.powerLossDisabled??unit.disabledByPowerLoss??null,down:unit.down?plain(unit.down):null};
}
function checkAllocation(C,profile,result,label){
 const r=result.propulsion,power=r.power,owners=enginesOf(profile),byOwner=new Map(owners.map(spec=>[spec.id,spec]));
 near(r.wasteHeatW,r.actualInputW*.05,label+' five-percent engine heat');
 near(r.usefulPropulsionW,r.actualInputW*.95,label+' useful electrical input');
 assert.ok(power.draw<=power.P*(1+1e-8),label+' finite total source');
 for(const source of power.sources||[])assert.ok(source.drawW<=source.availableW*(1+1e-8),label+' finite individual source '+source.id);
 for(const outlet of r.engines||[]){
  const owner=byOwner.get(outlet.machineryId??outlet.id);assert.ok(owner,label+' real engine owner');
  near(outlet.actualThrustN,outlet.actualInputW/C.engineConversionCoefficient(owner),label+' paid force at common mass conversion');
 }
}
function coldAllocations(C,key,profile){
 return [1,.25,0].map(throttle=>{
  const unit=newUnit(C,key,profile,'cold-'+throttle),result=C.allocateShipPower(unit,C.fleetSystems(unit),{throttle,weapons:0,shields:0},.05,'propulsion');
  checkAllocation(C,unit.p,result,key+' cold '+throttle);
  const row=sample(C,unit,0,throttle);assert.equal(row.thermal?.online,true,key+' actual cold thermal profile is online');row.sources=plain(result.propulsion.power.sources);row.engineBudgets=plain(result.propulsion.power.engineBudgets);
  if(throttle===0){near(row.actualInputW,0,key+' idle input');near(row.actualThrustN,0,key+' idle thrust');}
  else assert.ok(row.actualInputW>0&&row.actualThrustN>0,key+' nonzero funded thrust');
  return row;
 });
}
function runFromRest(C,key,profile){
 const unit=newUnit(C,key,profile,'from-rest'),duration=report.conditions.durationSeconds,dt=report.conditions.stepSeconds,events=[];
 // Rest is the initial condition, not a velocity seeded later in the run.
 unit.velocity=[0,0,0];unit.pos=[0,0,0];
 const run={status:'RUNNING',durationSeconds:duration,stepSeconds:dt,initial:sample(C,unit,0,1),events,samples:[],maxSpeedMps:0,peakPhysicalG:0,peakNetEquivalentPhysicalG:0,peakActualInputW:0,peakStoredHeatJ:0,actualNonCoolingSourceInputJ:0,integratedEngineInputJ:0,integratedEngineWasteHeatJ:0,integratedEngineUsefulPowerJ:0,firstThermalShutdownSeconds:null,firstDisabledSeconds:null,secondsTo95PercentReferenceSpeed:null,secondsTo99PercentReferenceSpeed:null,sequence:'powerTick; allocateShipPower(deferHeat=true); heatAccrue once; heatTick; propulsionMotion; integratePropulsionMotion; position update. No geometry/stat rebuilds.'};
 let integralError=0;
 for(let step=0;step<Math.round(duration/dt);step++){
  const time=(step+1)*dt,context={time,ev:(u,text)=>events.push({time,text})};
  C.powerTick(unit,dt,context);
  const result=C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,weapons:0,shields:0,deferHeat:true},dt,'propulsion');
  checkAllocation(C,unit.p,result,key+' elapsed '+time);
  run.actualNonCoolingSourceInputJ+=(result.propulsion.power.consumers||[]).filter(load=>load.kind!=='cooling').reduce((n,load)=>n+Math.max(0,load.sourceInputW||0),0)*dt;run.integratedEngineInputJ+=result.propulsion.actualInputW*dt;run.integratedEngineWasteHeatJ+=result.propulsion.wasteHeatW*dt;run.integratedEngineUsefulPowerJ+=result.propulsion.usefulPropulsionW*dt;
  C.heatAccrue(unit,result.got,result.cooling.fixed,dt);
  C.heatTick(context,unit,dt);
  const acceleration=C.propulsionMotion(unit).acc,before=unit.velocity.slice(),motion=C.integratePropulsionMotion(unit,before,[acceleration,0,0],dt),rate=C.massDragRate(unit),decay=Math.exp(-rate*dt),expected=rate>0?before[0]*decay+acceleration/rate*(1-decay):before[0]+acceleration*dt;
  integralError=Math.max(integralError,Math.abs(motion.velocity[0]-expected));run.peakNetEquivalentPhysicalG=Math.max(run.peakNetEquivalentPhysicalG,(acceleration-rate*before[0])/C.FLEET_RULES.accelScale/C.G0);
  unit.velocity=motion.velocity;unit.pos=unit.pos.map((x,i)=>x+motion.displacement[i]);
  const current=sample(C,unit,time,1);
  run.maxSpeedMps=Math.max(run.maxSpeedMps,current.speedMps);run.peakPhysicalG=Math.max(run.peakPhysicalG,current.physicalG);run.peakActualInputW=Math.max(run.peakActualInputW,current.actualInputW);run.peakStoredHeatJ=Math.max(run.peakStoredHeatJ,current.thermal?.qJ||0);
  if(current.thermal?.online===false&&run.firstThermalShutdownSeconds===null)run.firstThermalShutdownSeconds=time;
  if(current.out&&run.firstDisabledSeconds===null)run.firstDisabledSeconds=time;
  if(current.speedMps>=profile.maxSpeed*.95&&run.secondsTo95PercentReferenceSpeed===null)run.secondsTo95PercentReferenceSpeed=time;
  if(current.speedMps>=profile.maxSpeed*.99&&run.secondsTo99PercentReferenceSpeed===null)run.secondsTo99PercentReferenceSpeed=time;
  if(step===0||step===Math.round(duration/dt)-1||time%10===0)run.samples.push(current);
 }
 run.end=sample(C,unit,duration,1);run.actualCoolingSourceInputJ=run.end.thermal?.coolingSourceInputJ||0;run.actualTotalSourceInputJ=run.actualNonCoolingSourceInputJ+run.actualCoolingSourceInputJ;run.maximumMotionIntegralErrorMps=integralError;assert.ok(run.end.thermal?.actualGeneratedElectricalJ>0,key+' actual reactor generation ledger');assert.ok(run.end.thermal?.operatingHeatJ>0,key+' actual operating heat ledger');assert.ok(run.end.thermal?.rejectedHeatJ>0,key+' actual installed heat rejection');
 near(run.integratedEngineInputJ,run.integratedEngineWasteHeatJ+run.integratedEngineUsefulPowerJ,key+' accumulated useful/heat energy balance');
 if(run.end.fuel?.capacityKnown){assert.ok((run.end.fuel.overdrawJ||0)<=Math.max(1,run.end.fuel.capacityJ)*1e-10,key+' no fuel overdraw');}
 assert.ok(integralError<1e-7,key+' actual motion integration');
 run.status=run.firstThermalShutdownSeconds!==null||run.firstDisabledSeconds!==null?'OPERATING_LIMIT_REACHED':'COMPLETED';
 return run;
}
function loadDesign(C,key,reuse){
 const buildKey=key==='tie_ln'?'craft_tie_ln':key,entry=reuse?.references?.[key];
 if(entry){
  assert.equal(entry.origin,'Core.buildDesign','reuse must identify an actual production build');assert.equal(stable(entry.sourceSha256),stable(report.sourceSha256),'reused blueprint has the exact final source generation');
  const file=path.resolve(path.dirname(reuseFile),entry.blueprint),bytes=fs.readFileSync(file);assert.equal(sha(bytes),entry.blueprintSha256,'reused production blueprint bytes');
  return {ship:C.deserialize(JSON.parse(bytes)),provenance:{kind:'matching-source production blueprint replay',productionBuildKey:buildKey,blueprintSha256:sha(bytes),sourceSha256:entry.sourceSha256,factoryInvocationsInThisRun:0}};
 }
 return {ship:C.buildDesign(buildKey),provenance:{kind:'fresh production factory',productionBuildKey:buildKey,sourceSha256:report.sourceSha256,factoryInvocationsInThisRun:1}};
}
try{
 save();stage('Loading the exact production Core');const context=vm.createContext({console,performance});for(const file of files)vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});const {C,R}=vm.runInContext('({C:Core,R:Rts})',context),reuse=reuseFile?JSON.parse(fs.readFileSync(path.resolve(reuseFile),'utf8')):null;
 report.models={propulsionVersion:C.PROPULSION_MODEL_VERSION,inputVersion:C.ENGINE_INPUT_MODEL_VERSION,conversionVersion:C.ENGINE_CONVERSION_MODEL_VERSION,motionVersion:C.MOTION_RESISTANCE_VERSION,conversion:plain(C.ENGINE_CONVERSION),motionResistance:plain(C.MOTION_RESISTANCE),gravityMps2:C.G0,tacticalAccelerationScale:C.FLEET_RULES.accelScale,metresPerSecondPerMGLT:C.MGLT.ms};
 assert.ok(C.ENGINE_CONVERSION.massExponent>0,'small vessels require less power per kg/G');
 for(const definition of [{key:'tie_ln',healthyG:4100,mglt:100},{key:'venator',healthyG:3000,mglt:50},{key:'imperial',healthyG:2300,mglt:60}]){
  const {key}=definition;stage('Preparing '+key+' actual production hardware');const {ship,provenance}=loadDesign(C,key,reuse);stage(key+' hardware ready; measuring actual Core engineering',{factoryInvocations:provenance.factoryInvocationsInThisRun,parts:ship.parts.length,fits:ship.fits.length,hatches:ship.hatches.length});
  const S=C.computeStats(ship),profile=key==='tie_ln'?C.craftPowerProfile(ship,S):C.fleetProfile(S,ship.name,ship),authored=C.publicJSON(ship),model=profile.propulsion,owners=enginesOf(profile),k=C.engineConversionCoefficient(model.massKg),plannedAcceleration=Math.min(model.ratedAccelMps2,model.accelerationLimitMps2),wings=ship.parts.filter(p=>p.k==='solarPanel').map(geometryRecord);
  const row={key,provenance,profilePath:key==='tie_ln'?'buildDesign → computeStats → craftPowerProfile (canonical craft runtime blueprint path)':'buildDesign → computeStats → fleetProfile',estimated:profile.estimated===true,targets:{healthyG:definition.healthyG,referenceMGLT:definition.mglt,referenceSpeedMps:definition.mglt*C.MGLT.ms},engineering:{name:ship.name,parts:ship.parts.length,fits:ship.fits.length,hatches:ship.hatches.length,authoredDesignSha256:sha(authored),massKg:model.massKg,hp:S.hp,cost:S.cost,armorMassTonnes:S.armorMass,framingMassTonnes:S.framingMass,sourcePowerW:profile.grid.P,nominalEngineInputW:profile.grid.De,healthyThrustN:model.ratedThrustN,healthyAccelMps2:plannedAcceleration,healthyG:plannedAcceleration/C.G0,structuralAccelerationLimitMps2:model.structuralAccelerationLimitMps2,inertialFactor:model.inertialFactor,commonConversionWattsPerNewton:k,powerWattsPerKgG:C.enginePowerPerKgG(model.massKg),profileVersion:profile.profileVersion,inputVersion:model.inputModelVersion,conversionVersion:model.conversionModelVersion,conversionMassKg:model.conversionMassKg,motionResistance:plain(profile.motionResistance),computedMGLT:profile.mglt,computedMaxSpeedMps:profile.maxSpeed,reactors:ship.parts.filter(C.isReactor).map(p=>({id:p.id,k:p.k,diameterM:p.d,room:p.room,powerW:C.reactorPower(p),volumeM3:C.partVolume(p)})),solarWingsSha256:sha(stable(wings)),solarWingCount:wings.length,warnings:(S.warnings||[]).map(w=>({code:w.code,level:w.lv,text:w.text}))},cores:owners.map(spec=>({id:spec.id,ratedInputW:spec.ratedInputW,availableInputW:spec.availableInputW,pathCapacityW:spec.pathCapacityW,profileWattsPerNewton:spec.profileWattsPerNewton,conversionMassKg:spec.conversionMassKg,conversionModelVersion:spec.conversionModelVersion,machineryVolumeM3:spec.effectiveMachineryVolumeM3,sourceIds:spec.sourceIds})),mechanicalConstraints:(C.engineDriveRoutes(ship).routes||[]).map(route=>({id:route.id,coreId:route.coreId,nozzleId:route.nozzleId,requestedCapacityW:route.requestedCapacityW,actualCapacityW:route.capacityW,radiusM:route.radius,limited:route.limited,reason:route.reason})),electricalConstraints:(C.engineTransmission(ship).routes||[]).map(route=>({id:route.id,from:route.from,to:route.to,requestedCapacityW:route.requestedCapacityW,actualCapacityW:route.capacityW,efficiency:route.efficiency,limited:route.limited,reason:route.reason}))};
  report.references.push(row);const blueprintPath=persist(key,'blueprint',C.serialize(ship));persist(key,'ship',JSON.parse(authored));persist(key,'stats',S);persist(key,'profile',profile);productionFixtures.references[key]={origin:'Core.buildDesign',sourceSha256:report.sourceSha256,blueprint:path.basename(blueprintPath),blueprintSha256:sha(fs.readFileSync(blueprintPath))};fs.writeFileSync(path.join(scratch,'production-fixtures.json'),JSON.stringify(productionFixtures,null,2)+'\n');
  const thermalProfile=C.heatProfile(profile);row.thermalTopology={sources:thermalProfile?.src?.length||0,rejectors:thermalProfile?.dis?.length||0,links:thermalProfile?.ln?.length||0};assert.ok(row.thermalTopology.sources>0&&row.thermalTopology.rejectors>0&&row.thermalTopology.links>0,key+' actual installed thermal network');assert.equal(row.estimated,false,key+' is an actual production blueprint');assert.equal(model.inputModelVersion,C.ENGINE_INPUT_MODEL_VERSION);assert.equal(model.conversionModelVersion,C.ENGINE_CONVERSION_MODEL_VERSION);near(model.conversionMassKg,model.massKg,key+' current conversion mass');
  for(const spec of owners){assert.equal(spec.conversionModelVersion,C.ENGINE_CONVERSION_MODEL_VERSION);near(spec.conversionMassKg,model.massKg,key+' owner conversion mass');near(spec.profileWattsPerNewton,k,key+' same common law for every engine');}
  if(key!=='imperial'){near(profile.mglt,definition.mglt,key+' funded reference MGLT',2e-5);near(profile.maxSpeed,definition.mglt*C.MGLT.ms,key+' funded reference velocity',2e-5);}row.publishedSpeedReference=profile.speedReference?plain(profile.speedReference):null;row.computedMotionSpeedMps=profile.maxSpeed;row.computedMotionMGLT=profile.mglt;
  row.cold=coldAllocations(C,key,profile);row.healthyTargetDeviationPercent=100*(row.engineering.healthyG/definition.healthyG-1);row.actualColdTargetDeviationPercent=100*(row.cold[0].physicalG/definition.healthyG-1);row.coldSpeedDeviationPercent=100*(row.cold[0].equilibriumSpeedMps/row.targets.referenceSpeedMps-1);
  if(key==='tie_ln'&&tieBaselineFile){const baseline=JSON.parse(fs.readFileSync(path.resolve(tieBaselineFile),'utf8')),beforeWings=(baseline.parts||[]).filter(p=>p.k==='solarPanel').map(geometryRecord);row.tieWingBaseline={blueprintSha256:sha(fs.readFileSync(path.resolve(tieBaselineFile))),wingsSha256:sha(stable(beforeWings)),unchanged:stable(beforeWings)===stable(wings),reactorsBefore:(baseline.parts||[]).filter(C.isReactor).map(p=>({id:p.id,k:p.k,diameterM:p.d,room:p.room}))};assert.equal(row.tieWingBaseline.unchanged,true,'TIE reactor calibration retains the new solar wing geometry');}
  stage(key+' cold allocations ready; starting actual full-throttle run from rest',{healthyG:row.engineering.healthyG,actualColdG:row.cold[0].physicalG,coldEquilibriumSpeedMps:row.cold[0].equilibriumSpeedMps});row.fromRest=runFromRest(C,key,profile);row.publicDesignUnchangedByRuntime=C.publicJSON(ship)===authored;assert.equal(row.publicDesignUnchangedByRuntime,true,key+' runtime retains authored hardware');
  if(key!=='imperial'&&!prototype){near(row.engineering.healthyG,definition.healthyG,key+' healthy acceleration anchor',1e-5);near(row.cold[0].equilibriumSpeedMps,row.targets.referenceSpeedMps,key+' cold funded force/speed anchor',2e-5);assert.equal(row.fromRest.status,'COMPLETED',key+' actual full-throttle run remains online');assert.ok(row.fromRest.end.speedMps>row.targets.referenceSpeedMps*.98,key+' accelerates from rest near its actual force equilibrium');}
  row.accelerationTargetStatus=key==='imperial'?'COMPARISON_ONLY_WITH_ACTUAL_PATHS':'REFERENCE_ANCHOR';
  if(key==='imperial')report.limitations.push('Imperial is an additional comparison, not a third hard calibration anchor: actual hardware supplies '+row.engineering.healthyG.toFixed(3)+' G under the common law, '+row.healthyTargetDeviationPercent.toFixed(3)+'% relative to the approximate 2300 G reference. Its actual computed speed and published historical 60 MGLT metadata are recorded separately. Finite mechanical/electrical constraints are retained and listed.');
  if(row.fromRest.status!=='COMPLETED')report.limitations.push(key+' reached an actual operating limit during its 120-second run.');
  stage(key+' actual runtime evidence complete',{healthyG:row.engineering.healthyG,actualColdG:row.cold[0].physicalG,endSpeedMps:row.fromRest.end.speedMps,fromRestStatus:row.fromRest.status,accelerationTargetStatus:row.accelerationTargetStatus});
 }
 report.sourceSha256After=hashes();report.sourceStable=stable(report.sourceSha256After)===stable(report.sourceSha256);report.harnessStable=report.harnessSha256===sha(fs.readFileSync(__filename));assert.equal(report.sourceStable,true,'production source remained frozen');assert.equal(report.harnessStable,true,'proof harness remained frozen');
 report.factoryInvocations=report.references.reduce((sum,row)=>sum+row.provenance.factoryInvocationsInThisRun,0);report.status=prototype?'MEASURED_PROTOTYPE':report.limitations.length?'PASS_WITH_REFERENCE_LIMITATIONS':'PASS';report.completedAt=new Date().toISOString();save();console.log(JSON.stringify({status:report.status,output,sourceStable:report.sourceStable,factoryInvocations:report.factoryInvocations,references:report.references.map(row=>({key:row.key,healthyG:row.engineering.healthyG,actualColdG:row.cold[0].physicalG,equilibriumSpeedMps:row.cold[0].equilibriumSpeedMps,endSpeedMps:row.fromRest.end.speedMps,runtimeStatus:row.fromRest.status,targetStatus:row.accelerationTargetStatus}))}));
}catch(error){report.status='FAIL';report.error=error.stack||String(error);report.sourceSha256After=hashes();report.sourceStable=stable(report.sourceSha256After)===stable(report.sourceSha256);report.completedAt=new Date().toISOString();save();console.error(error);process.exitCode=1;}
