const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,`${label}: ${a} != ${b}`);
const NORMAL_INPUT_DENSITY=3.4e17,POWER_PATH_W=1e20;

function fixture(factor=1,cooling='none'){
 const ship=C.newShip({L:40,W:24,H:20,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Reactor-fed machinery and real cooling');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;
 const core={id:2,k:'engineCore',c:[12,10,0],d:2,length:2,dir:[-1,0,0],reactor:1,propulsionModelVersion:C.PROPULSION_MODEL_VERSION,driveProfileId:'standard',machineryGradeId:'advanced',legacyCoolingInputW:0,busFeed:true};
 const volume=C.partVolume(core),rating=volume*NORMAL_INPUT_DENSITY*factor;core.ratedInputW=rating;core.feedCapacityW=POWER_PATH_W;
 ship.parts=[{id:1,k:'gen',c:[30,10,0],d:6},core,{id:3,k:'engine',c:[-.5,10,0],d:1,nozzleLength:1,dir:[-1,0,0],reactor:1,machineryId:2,nozzleShare:1,busFeed:true,propulsionModelVersion:C.PROPULSION_MODEL_VERSION},{id:5,k:'hdis',c:[30,10,8],d:2,label:'Dedicated reactor cooler'}];ship.nextId=6;
 // The historical authored rating is deliberately independent of these real
 // finite paths. The engine branch cannot borrow the reactor's own cooler.
 ship.links=[{kind:'power',from:'p1',to:'p2',cap:POWER_PATH_W},{kind:'power',from:'p1',to:'p5',cap:POWER_PATH_W},{kind:'heat',from:'p1',to:'p5',cap:POWER_PATH_W},{kind:'heat',from:'p2',to:'p5',cap:0}];
 let wing=null;
 if(cooling!=='none'){
  wing=C.placePart(ship,'wing',[12,10,22],[12,20,.2],{...C.wingPlanformPreset('straight'),wing:{thermal:cooling==='low'?'low':'high',feed:1,reinf:0}},false);
  ship.links.push({kind:'power',from:'p1',to:'p'+wing.id,cap:POWER_PATH_W},{kind:'heat',from:'p2',to:'p'+wing.id,cap:cooling==='cut'?0:POWER_PATH_W});
 }
 return {ship,core,wing,volume,rating};
}

function conversion(point,input,coefficient=C.DRIVE_PROFILES.standard.wattsPerNewton){
 assert.equal(point.valid,true);near(point.actualInputW,input,'received input');near(point.efficiency,.95,'existing profile efficiency');near(point.usefulPropulsionW,.95*input,'useful shaft power');near(point.wasteHeatW,.05*input,'conversion heat');near(point.usefulPropulsionW+point.wasteHeatW,input,'energy conservation');near(point.actualThrustN,input/coefficient,'force from supplied watts');
}

test('connected reactor output sets available input without an authored or volume-density acceptance limit',()=>{
 const available=[];
 for(const diameter of [1,2,4]){
  const f=fixture(),p=f.core;p.d=diameter;p.ratedInputW=C.partVolume(p)*NORMAL_INPUT_DENSITY;
  const spec=C.resolveEngineSpec(p,f.ship),before=C.publicJSON(p);assert.equal(spec.valid,true);near(spec.availableInputW,C.reactorPower(f.ship.parts[0]),'one connected reactor potential');near(spec.sourceInputLimitW,spec.availableInputW);available.push(spec.availableInputW);
  delete p.ratedInputW;const noRating=C.resolveEngineSpec(p,f.ship);assert.equal(noRating.valid,true);near(noRating.availableInputW,spec.availableInputW,'removing the historical rating does not remove supply');
  const actual=Math.min(POWER_PATH_W,spec.availableInputW);assert.ok(actual>JSON.parse(before).ratedInputW,'the real source can supply more than the old machinery rating');conversion(C.engineOperatingPoint(noRating,actual),actual);
 }
 near(available[0],available[1]);near(available[1],available[2]);
});

test('fresh machinery needs a reactor for power and old grades cannot create efficiency or input permissions',()=>{
 for(const grade of ['standard','dense','advanced'])for(const kind of ['engineCore','engine','exposedTurbine']){
  const ship=C.newShip({L:1600,W:1200,H:800,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Fresh physical engine');ship.armor={hull:0,cit:0};
  const equipment=kind==='exposedTurbine'?C.equipmentOptions(kind):{},k=kind==='engineCore'?'engineCore':'engine',p=C.placePart(ship,k,[400,400,0],kind==='exposedTurbine'?equipment.d:2,{...equipment,dir:[-1,0,0],machineryGradeId:grade,...(k==='engineCore'?{length:3}:{})},false);
  delete p.ratedInputW;const empty=C.resolveEngineSpec(p,ship);assert.equal(empty.valid,true);near(empty.availableInputW,0,'machinery volume is not a generator');near(empty.ratedThrustN,0);
  ship.parts.push({id:ship.nextId++,k:'gen',c:[700,400,0],d:6});p.reactor=ship.parts.at(-1).id;
  const fed=C.resolveEngineSpec(p,ship);assert.equal(fed.valid,true);assert.ok(fed.availableInputW>0);near(fed.efficiency,.95);near(fed.wasteFraction,.05);near(fed.ratedThrustN,fed.availableInputW/C.DRIVE_PROFILES[fed.driveProfileId].wattsPerNewton);near(fed.cost,empty.cost,'connecting reactor power does not reprice unchanged physical machinery');
 }
});

test('saved engine bodies retain historical price provenance, shape, position and nozzle ownership without retaining an input cap',()=>{
 const f=fixture(4),integrated={id:4,k:'engine',c:[8,10,5],dir:[-1,0,0],d:1,nozzleLength:.8,reactor:1,propulsionModelVersion:1,ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'advanced',machineryShape:'cylinder',machineryLengthM:1.5,machineryRadiusM:1,machineryOffsetM:.4,legacyCoolingInputW:0};f.ship.parts.push(integrated);f.ship.nextId=6;
 const keys=['k','c','dir','d','length','nozzleLength','machineryId','reactor','propulsionModelVersion','ratedInputW','driveProfileId','machineryGradeId','machineryShape','machineryLengthM','machineryRadiusM','machineryOffsetM'],stored=p=>plain(Object.fromEntries(keys.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))),restored=C.deserialize(plain(C.serialize(f.ship)));
 for(const before of f.ship.parts.filter(p=>['engine','engineCore'].includes(p.k))){
  const after=restored.parts.find(p=>p.id===before.id);assert.ok(after);assert.deepEqual(stored(after),stored(before));const a=C.resolveEngineSpec(after,restored),b=C.resolveEngineSpec(before,f.ship);near(a.availableInputW,b.availableInputW);near(a.cost,b.cost);near(a.efficiency,.95);near(a.wasteFraction,.05);
 }
 assert.equal(restored.parts.find(p=>p.id===3).machineryId,2);
 const before=C.resolveEngineSpec(f.core,f.ship),factor=4,expected=(C.PROPULSION.ratingCost*f.rating/C.PROPULSION.referencePower+C.PROPULSION.densityCost*f.volume*(factor-1)**2)*C.MACHINERY_GRADES.advanced.costMultiplier;near(before.cost,expected,'existing explicit-rating purchase cost is historical provenance only');
 const other=C.resolveEngineSpec({...f.core,ratedInputW:1},f.ship);near(other.availableInputW,before.availableInputW);near(other.ratedThrustN,before.ratedThrustN,'historical purchase fields cannot limit current force');
});

test('supplied watts keep fixed-profile conversion, useful-power inversion and one-owner heat conservation above the old rating',()=>{
 for(const factor of [1,2,4,10]){
  const f=fixture(factor),spec=C.resolveEngineSpec(f.core,f.ship),input=Math.min(POWER_PATH_W,spec.availableInputW);assert.ok(input>f.rating);conversion(C.engineOperatingPoint(spec,input),input);
  near(C.engineInputForUsefulPower(spec,input*.95/2),input/2,'finite shaft capacity inverse');const heat=C.engineHeatForInput([spec,{...spec,id:3}],input);assert.equal(heat.points.length,1,'a body and its nozzle share one conversion');near(heat.actualInputW,input);near(heat.usefulPropulsionW,.95*input);near(heat.wasteHeatW,.05*input);
 }
});

test('physical shared-core allocation separates source loss, useful shaft power and fixed conversion heat',()=>{
 for(const factor of [1,4]){
  const f=fixture(factor),S={mass:1e5,aStruct:1e20,inertialSupport:1e5},profile=C.propulsionProfile(f.ship,S),feed=C.engineTransmission(f.ship),result=C.solveShipPropulsion(profile,{throttle:1,sources:[{id:'p1',domain:profile.cores[0].domain,powerW:C.reactorPower(f.ship.parts[0])}],links:feed.powerLinks,mode:'propulsion'});
  assert.equal(profile.cores.length,1);assert.equal(profile.engines.length,1);assert.ok(result.actualInputW>0);assert.ok(result.power.feedLossW>0,'the finite source-distance link loses real power');
  const core=result.cores[0],shaft=result.engines[0];near(core.actualInputW,core.shaftPowerW+core.wasteHeatW,'core input split');near(shaft.shaftReceivedW,core.shaftPowerW,'one outlet receives the one owner output');
  near(result.power.draw,result.actualInputW+result.power.feedLossW,'source delivery and electrical loss');near(result.actualThrustN,core.shaftPowerW/profile.cores[0].shaftWattsPerNewton,'useful shaft creates force');near(core.wasteHeatW,.05*core.actualInputW,'conversion follows received watts');
 }
});

test('historical input ratings do not create local thermal storage or change whole-vessel mass capacity',()=>{
 const values=[];
 for(const factor of [1,4]){
  const f=fixture(factor),spec=C.resolveEngineSpec(f.core,f.ship),S=C.computeStats(f.ship),source=S.heat.net.src.find(s=>s.id==='p2'&&s.k==='engine');assert.ok(source);near(spec.thermalStoreJ,0);assert.equal(source.store,undefined,'source-local capacities are retired');values.push(C.shipHeatCapacity({p:{propulsion:{massKg:S.mass*1000}}})/(S.mass*1000));
 }
 near(values[0],values[1]);
});

test('a missing cached heat network uses strict physical paths and whole-vessel mass capacity',()=>{
 const stores=[];
 for(const factor of [1,4]){
  const f=fixture(factor),S=C.computeStats(f.ship),profile=C.fleetProfile(S,f.ship.name,f.ship),fallback=C.heatProfile({...profile,heat:undefined}),sources=fallback.src.filter(s=>s.k==='engine');assert.equal(fallback.mode,'strict');assert.equal(sources.length,1,'one owner cannot become separate body and nozzle heat sources');assert.equal(sources[0].st,undefined);stores.push(C.shipHeatCapacity({p:profile})/(S.mass*1000));
 }
 near(stores[0],stores[1]);
});

function operatingUnit(cooling){
 const f=fixture(4,cooling),stats=C.computeStats(f.ship),profile=C.fleetProfile(stats,f.ship.name,f.ship),unit=C.fleetUnit('reactor-cooling-'+cooling,'reactor-cooling-'+cooling,profile,0);profile.fuel={capacityKnown:false};profile.propulsion={...profile.propulsion,structuralAccelerationLimitMps2:1e9,accelerationLimitMps2:1e9,inertialFactor:1};unit.p=profile;C.heatInit(unit);unit.ht.t=0;unit.ht.last=0;
 return {...f,stats,profile,unit};
}

test('a powered wing adds real finite heat rejection and consumes actual cooling electricity',()=>{
 const bare=operatingUnit('none'),cooled=operatingUnit('high'),wingDis=cooled.stats.heat.net.dis.find(d=>d.part===cooled.wing.id);assert.ok(wingDis&&wingDis.cap>0&&wingDis.power>0);near(wingDis.cap,C.wingCap(cooled.wing,cooled.stats));
 for(const f of [bare,cooled]){C.allocateShipPower(f.unit,{reactor:1},{throttle:1,weapons:0,shields:0},.25,'propulsion');assert.ok(f.unit.propulsion.actualInputW>0);}
 near(bare.unit.propulsion.actualThrustN,cooled.unit.propulsion.actualThrustN);
 for(let i=1;i<=240;i++)for(const f of [bare,cooled]){C.allocateShipPower(f.unit,{reactor:1},{throttle:1,weapons:0,shields:0},.25,'propulsion');C.heatTick({time:i*.25,ev(){}},f.unit,.25);}
 assert.ok(cooled.unit.ht.rejectedHeatJ>bare.unit.ht.rejectedHeatJ);assert.ok(cooled.unit.ht.cooling.inputJ>0);assert.equal(cooled.unit.ht.st,undefined);
});
