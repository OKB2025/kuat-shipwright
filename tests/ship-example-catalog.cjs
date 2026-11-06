const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {loadRuntime,exampleKeys,sourceHashes,stable}=require('../scripts/update-ship-examples.cjs'),crypto=require('node:crypto');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),plain=value=>JSON.parse(JSON.stringify(value));
const fingerprint=value=>crypto.createHash('sha256').update(stable(value)).digest('hex'),scopedReport=()=>JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/shared-engine-core-refit.json'),'utf8'));
test('stock rows retain their declared generating sources and require a worker profile before sailing',()=>{
 const {C,data}=loadRuntime(root),keys=exampleKeys(C,data),sources=sourceHashes(root);
 const refreshed=scopedReport();assert.deepEqual(refreshed.sourceSha256,sources);assert.deepEqual(refreshed.allKeys,['imperial','onager']);assert.equal(refreshed.verificationScope.kind,'selected-stock-models');assert.equal(refreshed.verificationScope.unverifiedKeys.length,25);
 assert.deepEqual(keys,Array.from(C.SHIP_SYSTEM_REFIT_KEYS).sort());
 for(const key of keys){
  const entry=data.designs[key],p=entry.p,model=entry.model;
  assert.equal(p.profileVersion,C.FLEET_PROFILE_VERSION,key+' current fleet model');
  assert.equal(p.catalogOnly,true,key+' metadata must require a complete worker profile before sailing');
  assert.equal(p.surface,undefined,key+' large physical surface meshes stay out of the catalogue');
  assert.ok(JSON.stringify(p).length<8*1024*1024,key+' bounded catalogue engineering metadata');
  assert.equal(model?.costVersion,C.COST_MODEL.version,key+' current cost model');
  assert.equal(model?.costSignature,C.costModelSignature(),key+' current engineering price coefficients');
  if(['imperial','onager'].includes(key))assert.deepEqual(plain(model?.sourceSha256),sources,key+' exact fresh generating sources');
  else{const control=refreshed.controls.catalogue[key];assert.ok(control,key+' independently recorded unchanged row');assert.equal(fingerprint(entry),control.sha256,key+' entire unselected catalogue row is unchanged');assert.deepEqual(plain(model?.sourceSha256),control.sourceSha256,key+' original generating sources are retained');}
  assert.match(model.blueprintSha256,/^[a-f0-9]{64}$/);
  assert.ok(Number.isFinite(entry.info.mass)&&entry.info.mass>0,key+' finite physical mass');
  assert.ok(Math.abs(p.propulsion.massKg-entry.info.mass*1000)<=entry.info.mass*1e-5,key+' catalogue mass matches its propulsion ledger');
  assert.ok(p.crewNeed>0&&p.crewMax>=p.crewNeed,key+' room for the operating crew');
  assert.ok(Number.isFinite(p.maxSpeed)&&p.maxSpeed>0&&p.propulsion.ratedAccelMps2>0,key+' usable planned propulsion');
  assert.ok(p.propulsion.engines.length>0,key+' machinery installed');
  for(const e of p.propulsion.engines){
   assert.equal(e.valid,true,key+' engine '+e.id+' finite machinery');
   assert.equal(e.available,true,key+' engine '+e.id+' available outlet and body');
   assert.equal(e.driveProfileId,'standard',key+' engine '+e.id+' current input law');
   assert.notEqual(e.machineryGradeId,'legacy-refit',key+' engine '+e.id+' ordinary density');
   assert.equal(e.legacyCoolingInputW,0,key+' engine '+e.id+' physical cooling');
  }
 }
});

test('the ISD catalogue binds three main outlets to one body and each vertical auxiliary pair to its own body',()=>{
 const {data}=loadRuntime(root),p=data.designs.imperial.p,model=p.propulsion,cores=new Map((model.cores||[]).map(core=>[core.id,core])),main=model.engines.filter(outlet=>/主イオン機関/.test(p.modules[outlet.moduleIndex]?.name||'')),aux=model.engines.filter(outlet=>/補助イオン機関/.test(p.modules[outlet.moduleIndex]?.name||''));
 assert.equal(model.architectureVersion,2);assert.equal(main.length,3);assert.equal(aux.length,4);const owner=outlet=>outlet.coreId??outlet.machineryId;
 for(const outlet of [...main,...aux]){const core=cores.get(owner(outlet));assert.ok(core&&core.id>0,'each nozzle has its own explicit body reference');assert.equal(core.entityKind,'engineCore');assert.notEqual(core.id,outlet.id,'an internal nozzle cannot become its own implicit body');}
 assert.equal(new Set(main.map(owner)).size,1,'the three main nozzles share one real engine');const auxiliaryOwners=new Set(aux.map(owner));assert.equal(auxiliaryOwners.size,2,'each vertical auxiliary pair shares one real engine');assert.equal(cores.size,3);for(const id of auxiliaryOwners)assert.equal(aux.filter(outlet=>owner(outlet)===id).length,2);assert.ok(main.every(outlet=>!auxiliaryOwners.has(owner(outlet))),'main and auxiliary engines cannot share one physical body');
});

test('the two scoped fresh archives and figure digests match the complete physical audit',()=>{
 const report=scopedReport(),{data}=loadRuntime(root),figures=JSON.parse(fs.readFileSync(path.join(root,'tests/helpers/example-figures.json')));
 assert.equal(report.complete,true);assert.equal(report.physicalVerification.passed,true);assert.equal(report.portableVerification.verified,true);assert.equal(report.orchestration.constructorCalls,2);assert.equal(report.generationMethods.currentFactoryBuilds,2);assert.equal(report.generationMethods.savedBlueprintReplays,0);assert.equal(Object.keys(report.controls.catalogue).length,25);
 for(const key of ['imperial','onager']){
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/source/'+key+'-shared-core-factory-blueprints/manifest.json'))),proof=report.propulsionEvidence[key],row=report.models.find(row=>row.key===key),stage=report.orchestration.stages.find(stage=>stage.key===key);
  assert.deepEqual(Object.keys(manifest.models),[key]);assert.equal(manifest.factoryGeneration.method,'fresh-factory');assert.deepEqual(manifest.factorySourceSha256,report.sourceSha256);assert.equal(manifest.models[key].canonicalSha256,data.designs[key].model.blueprintSha256);assert.equal(report.figureDigestSha256[key],fingerprint(figures.ships[key]));assert.equal(stage.constructorCalls,1);for(const field of ['scriptSha256','auditorSha256','constructorBlueprintSha256','finalBlueprintSha256'])assert.match(stage[field],/^[a-f0-9]{64}$/);
  for(const field of ['expectedOwnerGroups','allShaftsAtRequestedCapacity','allOutletsFlow','sourcePayloadPreserved','referencePayloadValid','allAuxiliariesBetweenMainPaths'])assert.equal(proof[field],true,key+' '+field);assert.equal(proof.shafts.length,key==='imperial'?7:5);assert.ok(proof.shafts.every(row=>row.valid&&!row.limited&&row.capacitySatisfied));assert.ok(proof.outletFlows.every(row=>row.actualThrustN>0));assert.equal(row.plant.baselinePowerPreserved,true);assert.equal(row.plant.addedReactorCount,0);assert.equal(row.thermal.mode,'strict');assert.equal(row.engineBodies.explicitCoreCount,3);assert.deepEqual(row.engineBodies.bodyIntersections,[]);assert.deepEqual(row.engineBodies.deviceIntersections,[]);
 }
 for(const [key,hash]of Object.entries(report.controls.figures))assert.equal(fingerprint(figures.ships[key]),hash,key+' unselected figure digest is unchanged');
});

test('the Onager catalogue has one three-outlet main body and two independent auxiliary bodies',()=>{
 const {data}=loadRuntime(root),model=data.designs.onager.p.propulsion,owners=model.engines.map(p=>p.coreId??p.machineryId);assert.equal(model.cores.length,3);assert.equal(model.engines.length,5);assert.deepEqual(plain(model.cores.map(p=>owners.filter(id=>id===p.id).length).sort()),[1,1,3]);
});

test('the CR90 catalogue retains one positive internal engine body per nozzle',()=>{
 const {data}=loadRuntime(root),model=data.designs.cr90.p.propulsion,cores=new Map((model.cores||[]).map(core=>[core.id,core])),owners=model.engines.map(outlet=>outlet.coreId??outlet.machineryId);
 assert.equal(model.architectureVersion,2);assert.equal(model.engines.length,11);assert.equal(cores.size,11);assert.equal(new Set(owners).size,11,'widely separated CR90 nozzles cannot borrow one shared body');
 for(let i=0;i<owners.length;i++){const core=cores.get(owners[i]);assert.ok(core&&core.id>0);assert.equal(core.entityKind,'engineCore');assert.notEqual(core.id,model.engines[i].id);}
});

test('the retained hammerhead key displays the new Sphyrna corvette name in the builder and final catalogue',()=>{
 const {C,data}=loadRuntime(root);assert.equal(C.DESIGNS.hammerhead.name,'スフィルナ級コルベット');assert.equal(data.designs.hammerhead.name,'スフィルナ級コルベット');
});

test('generated stock aircraft snapshots contain no retired aircraft ion weapons',()=>{
 const {C}=loadRuntime(root),removed=v=>!!v&&typeof v==='object'&&(v.k==='cion'||v.weapon==='cion'||v.weaponKind==='cion'||v.fitKind==='cion'||Array.isArray(v)&&v[1]==='cion'||Object.values(v).some(removed));for(const [key,entry]of Object.entries(C.CRAFT_PRICE_CATALOG.entries)){assert.equal(removed(entry),false,key+' cached physical stock armament');assert.ok(Array.isArray(entry.fireArcs)&&entry.fireArcs.length>0,key+' modeled stock has precomputed actual firing arcs');for(const arc of entry.fireArcs){assert.ok(C.FITS[arc.k]&&!C.FITS[arc.k].retired,key+' canonical firing hardware');assert.equal(C.FITS[arc.k].boltTT,2e-9,key+' current aircraft barrel caliber');}}
});

test('the STL corvette rows match their published complete heat and power audit',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/ship-examples-after.json'),'utf8')),{data}=loadRuntime(root);assert.equal(report.sourceValidated,true);assert.equal(report.complete,true);for(const key of ['cr90','hammerhead']){assert.deepEqual(report.sourceSha256,plain(data.designs[key].model.sourceSha256),key+' audit matches the retained row generating sources');assert.equal(data.designs[key].p.catalogOnly,true,key+' an older row still requires a complete current worker profile');const row=report.models.find(model=>model.key===key);assert.ok(row,key+' complete stock audit');assert.equal(row.thermal.heatPaths.broken,0,key+' counts every authored heat route before invalid routes can be filtered from runtime');assert.equal(row.thermal.powerPaths.broken,0,key+' complete authored power connectivity');assert.deepEqual(row.overlapIds,[],key+' installed equipment does not overlap');}
});
