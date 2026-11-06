const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {loadRuntime,exampleKeys,sourceHashes}=require('../scripts/update-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),plain=value=>JSON.parse(JSON.stringify(value));
test('every stock ship catalogue row comes from current physical sources and can carry its operating crew',()=>{
 const {C,data}=loadRuntime(root),keys=exampleKeys(C,data),sources=sourceHashes(root);
 assert.deepEqual(keys,Array.from(C.SHIP_SYSTEM_REFIT_KEYS).sort());
 for(const key of keys){
  const entry=data.designs[key],p=entry.p,model=entry.model;
  assert.equal(p.profileVersion,C.FLEET_PROFILE_VERSION,key+' current fleet model');
  assert.equal(p.catalogOnly,true,key+' metadata must require a complete worker profile before sailing');
  assert.equal(p.surface,undefined,key+' large physical surface meshes stay out of the catalogue');
  assert.ok(JSON.stringify(p).length<8*1024*1024,key+' bounded catalogue engineering metadata');
  assert.equal(model?.costVersion,C.COST_MODEL.version,key+' current cost model');
  assert.equal(model?.costSignature,C.costModelSignature(),key+' current engineering price coefficients');
  assert.deepEqual(plain(model?.sourceSha256),sources,key+' exact generating sources');
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

test('the ISD catalogue binds its main and auxiliary nozzles to distinct positive internal engine bodies',()=>{
 const {data}=loadRuntime(root),p=data.designs.imperial.p,model=p.propulsion,cores=new Map((model.cores||[]).map(core=>[core.id,core])),main=model.engines.filter(outlet=>/主イオン機関/.test(p.modules[outlet.moduleIndex]?.name||'')),aux=model.engines.filter(outlet=>/補助イオン機関/.test(p.modules[outlet.moduleIndex]?.name||''));
 assert.equal(model.architectureVersion,2);assert.equal(main.length,3);assert.equal(aux.length,4);const owner=outlet=>outlet.coreId??outlet.machineryId;
 for(const outlet of [...main,...aux]){const core=cores.get(owner(outlet));assert.ok(core&&core.id>0,'each nozzle has its own explicit body reference');assert.equal(core.entityKind,'engineCore');assert.notEqual(core.id,outlet.id,'an internal nozzle cannot become its own implicit body');}
 assert.equal(new Set(main.map(owner)).size,3,'each main engine retains a separate physical body');const auxiliaryOwners=new Set(aux.map(owner));assert.equal(auxiliaryOwners.size,4,'each auxiliary engine has its own finite shaft port');assert.equal(cores.size,7);assert.ok(main.every(outlet=>!auxiliaryOwners.has(owner(outlet))),'main and auxiliary engines cannot share one physical body');
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

test('the new STL corvettes have no broken authored heat or power links in the matching full factory audit',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/ship-examples-after.json'),'utf8'));assert.equal(report.sourceValidated,true);assert.equal(report.complete,true);assert.deepEqual(report.sourceSha256,sourceHashes(root));for(const key of ['cr90','hammerhead']){const row=report.models.find(model=>model.key===key);assert.ok(row,key+' complete stock audit');assert.equal(row.thermal.heatPaths.broken,0,key+' counts every authored heat route before invalid routes can be filtered from runtime');assert.equal(row.thermal.powerPaths.broken,0,key+' complete authored power connectivity');assert.deepEqual(row.overlapIds,[],key+' installed equipment does not overlap');}
});
