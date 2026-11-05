const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
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
