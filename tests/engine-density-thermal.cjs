const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,`${label}: ${a} != ${b}`);
const NORMAL_INPUT_DENSITY=3.4e17,OLD_THRUST_DENSITY=1.7e8;

function fixture(factor=1,cooling='none'){
 const ship=C.newShip({L:40,W:24,H:20,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Engine density and real cooling');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;
 const core={id:2,k:'engineCore',c:[12,10,0],d:2,length:2,dir:[-1,0,0],reactor:1,propulsionModelVersion:C.PROPULSION_MODEL_VERSION,driveProfileId:'standard',machineryGradeId:'advanced',legacyCoolingInputW:0,busFeed:true};
 const volume=C.partVolume(core),rating=volume*NORMAL_INPUT_DENSITY*factor;core.ratedInputW=rating;core.feedCapacityW=rating*1.3;
 ship.parts=[{id:1,k:'gen',c:[30,10,0],d:6},core,{id:3,k:'engine',c:[-.5,10,0],d:1,nozzleLength:1,dir:[-1,0,0],reactor:1,machineryId:2,nozzleShare:1,busFeed:true,propulsionModelVersion:C.PROPULSION_MODEL_VERSION},{id:5,k:'hdis',c:[30,10,8],d:2,label:'Dedicated reactor cooler'}];ship.nextId=6;
 // The reactor has its own real cooler. This deliberately closed engine branch
 // cannot borrow that cooler when the engine's external wing is absent.
 ship.links=[{kind:'power',from:'p1',to:'p2',cap:rating*1.3},{kind:'power',from:'p1',to:'p5',cap:1e20},{kind:'heat',from:'p1',to:'p5',cap:1e20},{kind:'heat',from:'p2',to:'p5',cap:0}];
 let wing=null;
 if(cooling!=='none'){
  wing=C.placePart(ship,'wing',[12,10,22],[12,20,.2],{...C.wingPlanformPreset('straight'),wing:{thermal:cooling==='low'?'low':'high',feed:1,reinf:0}},false);
  ship.links.push({kind:'power',from:'p1',to:'p'+wing.id,cap:1e20},{kind:'heat',from:'p2',to:'p'+wing.id,cap:cooling==='cut'?0:1e20});
 }
 return {ship,core,wing,volume,rating};
}

test('ordinary engine volume retains the original volume-to-input and volume-to-thrust law',()=>{
 for(const diameter of [1,2,4]){
  const f=fixture(),p=f.core;p.d=diameter;p.ratedInputW=C.partVolume(p)*NORMAL_INPUT_DENSITY;
  const s=C.resolveEngineSpec(p,f.ship);assert.equal(s.valid,true);near(s.normalInputW,C.partVolume(p)*NORMAL_INPUT_DENSITY);near(s.densityFactor,1);
  near(s.ratedThrustN,C.partVolume(p)*OLD_THRUST_DENSITY,'original N per cubic metre');near(s.efficiency,.95);near(s.wasteFraction,.05);
  near(s.ratedShaftPowerW+s.ratedWasteHeatW,s.ratedInputW,'rated energy conservation');
 }
});

test('new basic bodies and integrated palette engines start at normal volume rating regardless of grade',()=>{
 for(const grade of ['standard','dense','advanced'])for(const kind of ['engineCore','engine','exposedTurbine']){
  const ship=C.newShip({L:1600,W:1200,H:800,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'New basic engine');ship.armor={hull:0,cit:0};
  const equipment=kind==='exposedTurbine'?C.equipmentOptions(kind):{},k=kind==='engineCore'?'engineCore':'engine',p=C.placePart(ship,k,[400,400,0],kind==='exposedTurbine'?equipment.d:2,{...equipment,dir:[-1,0,0],machineryGradeId:grade,...(k==='engineCore'?{length:3}:{})},false),spec=C.resolveEngineSpec(p,ship);
  assert.equal(spec.valid,true);near(spec.ratedInputW,spec.effectiveMachineryVolumeM3*NORMAL_INPUT_DENSITY,'fresh palette baseline');near(spec.densityFactor,1);
  const before=spec.ratedInputW,result=C.updateEngineSpec(p,{machineryGradeId:'advanced'},ship);assert.equal(result.ok,true);near(result.spec.ratedInputW,before,'grade alone cannot create configured input');near(result.spec.densityFactor,1);
 }
});

test('saved v1 engine bodies keep their explicit rating, shape, position and nozzle ownership on reload',()=>{
 const f=fixture(4),integrated={id:4,k:'engine',c:[8,10,5],dir:[-1,0,0],d:1,nozzleLength:.8,reactor:1,propulsionModelVersion:1,ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'advanced',machineryShape:'cylinder',machineryLengthM:1.5,machineryRadiusM:1,machineryOffsetM:.4,legacyCoolingInputW:0};f.ship.parts.push(integrated);f.ship.nextId=6;
 const keys=['k','c','dir','d','length','nozzleLength','machineryId','reactor','propulsionModelVersion','ratedInputW','driveProfileId','machineryGradeId','machineryShape','machineryLengthM','machineryRadiusM','machineryOffsetM'],plain=v=>JSON.parse(JSON.stringify(v)),stored=p=>plain(Object.fromEntries(keys.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))),blueprint=plain(C.serialize(f.ship)),restored=C.deserialize(blueprint);
 for(const before of f.ship.parts.filter(p=>['engine','engineCore'].includes(p.k))){
  const after=restored.parts.find(p=>p.id===before.id);assert.ok(after);assert.deepEqual(stored(after),stored(before));
  const a=C.resolveEngineSpec(after,restored),b=C.resolveEngineSpec(before,f.ship);near(a.ratedInputW,b.ratedInputW);near(a.normalInputW,b.normalInputW);near(a.wasteFraction,b.wasteFraction);
 }
 assert.equal(restored.parts.find(p=>p.id===3).machineryId,2);near(C.resolveEngineSpec(restored.parts.find(p=>p.id===2),restored).densityFactor,4);
});

test('higher density gives increasing but sublinear force and rising heat, without free grade efficiency',()=>{
 const rows=[1,2,4,10].map(factor=>{const f=fixture(factor);return C.resolveEngineSpec(f.core,f.ship);});
 for(let i=1;i<rows.length;i++){
  assert.ok(rows[i].ratedThrustN>rows[i-1].ratedThrustN);assert.ok(rows[i].wasteFraction>rows[i-1].wasteFraction);assert.ok(rows[i].ratedWasteHeatW>rows[i-1].ratedWasteHeatW);
  assert.ok(rows[i].ratedThrustN<rows[0].ratedThrustN*rows[i].densityFactor,'density never creates free useful output');
 }
 const f=fixture(4),dense=C.resolveEngineSpec({...f.core,machineryGradeId:'dense'},f.ship),advanced=C.resolveEngineSpec(f.core,f.ship);
 near(dense.wasteFraction,advanced.wasteFraction,'a density permission grade cannot remove conversion heat');near(dense.ratedThrustN,advanced.ratedThrustN);
 near(rows[1].wasteFraction,1-.95/1.05);near(rows[2].wasteFraction,1-.95/1.15);
});

test('physical shared-core allocation separates feed loss, useful shaft power and density conversion heat',()=>{
 for(const factor of [1,4]){
  const f=fixture(factor),S={mass:1e5,aStruct:1e20,inertialSupport:1e5},profile=C.propulsionProfile(f.ship,S),feed=C.engineTransmission(f.ship),result=C.solveShipPropulsion(profile,{throttle:1,sources:[{id:'p1',domain:profile.cores[0].domain,powerW:C.reactorPower(f.ship.parts[0])}],links:feed.powerLinks,mode:'balanced'});
  assert.equal(profile.cores.length,1);assert.equal(profile.engines.length,1);assert.ok(result.actualInputW>0);assert.ok(result.power.feedLossW>0,'the actual finite electrical cable loses power');
  const core=result.cores[0],shaft=result.engines[0];near(core.actualInputW,core.shaftPowerW+core.wasteHeatW,'core input split');near(shaft.shaftReceivedW,core.shaftPowerW,'one outlet receives the one owner output');
  near(result.power.draw,result.actualInputW+result.power.feedLossW,'reactor delivery and cable loss');near(result.actualThrustN,core.shaftPowerW/profile.cores[0].shaftWattsPerNewton,'useful shaft creates force');
  near(core.wasteHeatW,core.actualInputW*profile.cores[0].wasteFraction,'only received input creates local conversion heat');
 }
});

test('raising a rating cannot create additional engine thermal storage in unchanged physical volume',()=>{
 const values=[];
 for(const factor of [1,4]){
  const f=fixture(factor),spec=C.resolveEngineSpec(f.core,f.ship),S=C.computeStats(f.ship),source=S.heat.net.src.find(s=>s.id==='p2'&&s.k==='engine');assert.ok(source);
  near(spec.thermalStoreJ,C.HEAT.storeS*.05*f.volume*NORMAL_INPUT_DENSITY);near(source.store,spec.thermalStoreJ,'the real network uses the physical store');values.push(source.store);
 }
 near(values[0],values[1]);
});

test('a current profile missing its heat network retains volume-based engine storage in the strict fallback',()=>{
 const stores=[];
 for(const factor of [1,4]){
  const f=fixture(factor),S=C.computeStats(f.ship),profile=C.fleetProfile(S,f.ship.name,f.ship),fallback=C.heatProfile({...profile,heat:undefined}),sources=fallback.src.filter(s=>s.k==='engine');
  assert.equal(fallback.mode,'strict');assert.equal(sources.length,1,'one owner cannot become separate body and nozzle heat sources');
  near(sources[0].st,C.resolveEngineSpec(f.core,f.ship).thermalStoreJ,'a missing cached network cannot invent thermal storage');stores.push(sources[0].st);
 }
 near(stores[0],stores[1]);
});

function operatingUnit(cooling){
 const f=fixture(4,cooling),stats=C.computeStats(f.ship),profile=C.fleetProfile(stats,f.ship.name,f.ship),unit=C.fleetUnit('density-'+cooling,'density-'+cooling,profile,0);C.heatInit(unit);unit.ht.t=0;unit.ht.last=0;
 return {...f,stats,profile,unit};
}

test('a real powered wing and connected heat path improve a compact engine sustained output',()=>{
 const bare=operatingUnit('none'),cooled=operatingUnit('high'),cut=operatingUnit('cut');
 const wingDis=cooled.stats.heat.net.dis.find(d=>d.part===cooled.wing.id);assert.ok(wingDis&&wingDis.cap>0&&wingDis.power>0);near(wingDis.cap,C.wingCap(cooled.wing,cooled.stats),'actual wing surface determines cooling');
 for(const f of [bare,cooled,cut]){C.allocateShipPower(f.unit,{reactor:1},{throttle:1,weapons:0,shields:0},.25,'balanced');assert.ok(f.unit.propulsion.actualInputW>0);}
 near(bare.unit.propulsion.actualThrustN,cooled.unit.propulsion.actualThrustN,'cooling does not invent cold thrust');
 const outputs=new Map([[bare,0],[cooled,0],[cut,0]]),dt=.25;
 for(let i=1;i<=240;i++)for(const f of [bare,cooled,cut]){
  C.allocateShipPower(f.unit,{reactor:1},{throttle:1,weapons:0,shields:0},dt,'balanced');C.heatTick({time:i*dt,ev(){}},f.unit,dt);
  if(i>120)outputs.set(f,outputs.get(f)+f.unit.propulsion.actualThrustN*dt);
 }
 assert.ok(outputs.get(cooled)>outputs.get(bare)*1.1,'real cooling preserves useful sustained force');assert.ok(outputs.get(cooled)>outputs.get(cut)*1.1,'the mere presence of a wing cannot bypass a severed heat path');
 const engineIndex=f=>f.unit.p.heat.src.findIndex(s=>s.k==='engine'&&s.id==='p2');assert.ok(cooled.unit.ht.st[engineIndex(cooled)]<bare.unit.ht.st[engineIndex(bare)]);
 assert.ok(cooled.unit.ht.cooling.inputJ>0,'the radiator wing spends real electricity');
});
