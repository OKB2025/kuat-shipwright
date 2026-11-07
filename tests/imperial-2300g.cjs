const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const G=require('../scripts/update-ship-examples.cjs'),{readBlueprint}=require('../scripts/replay-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C,data}=G.loadRuntime(root),plain=v=>JSON.parse(JSON.stringify(v));
const near=(a,b,message)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-8,message+': '+a+' != '+b);
function archive(key,suffix){const dir=path.join(root,'assets/source/'+key+'-'+suffix+'-factory-blueprints'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));return readBlueprint(dir,key,manifest).blueprint;}
function cylinderSamples(core){
 const frame=C.frameAxis(core.dir),out=[];
 for(const t of [0,.125,.25,.5,.75,.875,1]){const centre=C.add(core.c,C.mul(frame.u,core.length*(t-.5)));out.push(centre);for(const fraction of [.5,1])for(let j=0;j<96;j++)out.push(C.add(centre,C.add(C.mul(frame.v,core.d/2*fraction*Math.cos(j*Math.PI/48)),C.mul(frame.w,core.d/2*fraction*Math.sin(j*Math.PI/48)))));}
 return out;
}
function engineBayEnvelope(ship){
 // Cuts 2/3 form the open machinery bay, whose empty space may contain an
 // engine. Keep every other authored cut and use this clone only to test the
 // enclosing hull, never to add material, mass or support to the live design.
 const hull=JSON.parse(C.publicJSON(ship.parts.find(p=>p.id===178)));
 assert.ok([2,3].every(id=>hull.hullData.solidCuts.some(c=>c.id===id)));
 hull.hullData.solidCuts=hull.hullData.solidCuts.filter(c=>c.id!==2&&c.id!==3);
 return hull;
}

test('both 2300 G examples obtain their acceleration from enlarged ordinary engine volume and final physical mass',()=>{
 const report=JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/example-engine-acceleration-refit.json')));
 assert.equal(report.physicalVerification.passed,true);
 const revision=require('./helpers/historical-engine-runtime.cjs').verifyHistoricalEngineRuntime(root);
 assert.equal(revision.passed,true);assert.equal(revision.historical,true);assert.equal(revision.currentRuntimeClaimed,false);assert.deepEqual(revision.generationSources,report.sourceSha256);
 for(const key of ['imperial','imperial2']){
  const blueprint=archive(key,'2300g'),ship=C.deserialize(plain(blueprint)),bayEnvelope=engineBayEnvelope(ship),cores=ship.parts.filter(p=>p.k==='engineCore'),old=archive(key,'user-layout'),oldVolume=old.parts.filter(p=>p.k==='engineCore').reduce((n,p)=>n+C.partVolume(p),0),volume=cores.reduce((n,p)=>n+C.partVolume(p),0),row=report.models.find(r=>r.key===key),entry=data.designs[key];
  assert.equal(cores.length,3);assert.ok(volume>oldVolume*3,'the extra thrust has substantially larger physical machinery');
  const physicalThrust=volume*1.7e8,physicalG=physicalThrust/(row.massT*1000*9.80665);
  assert.ok(Math.abs(physicalG-2300)<=.25,key+' reaches 2300 G using the original volume law and its completed mass');
  near(entry.info.mass,row.massT,'published mass equals actual audited mass');near(entry.p.propulsion.ratedThrustN,physicalThrust,'catalogue force follows real machinery volume');
  assert.ok(Number.isFinite(entry.p.propulsion.accelerationLimitMps2),'the real structural and inertial acceleration limit is present');
  const catalogueG=Math.min(entry.p.propulsion.ratedAccelMps2,entry.p.propulsion.accelerationLimitMps2)/9.80665;
  assert.ok(Math.abs(catalogueG-2300)<=.25,key+' actual catalogue maximum is 2300 G');
  for(const core of cores){
   const spec=C.resolveEngineSpec(core,ship);assert.equal(spec.valid,true);assert.equal(spec.machineryGradeId,'standard');near(spec.densityFactor,1,'no density increase');near(spec.wasteFraction,.05,'ordinary conversion loss');near(spec.ratedInputW,C.partVolume(core)*3.4e17,'input rating follows physical volume');
   for(const p of cylinderSamples(core))assert.ok(C.insideOriginalEnvelope(ship,p)||C.inStruct(bayEnvelope,p),key+' enlarged body stays inside the enclosing hull or its declared machinery bay: '+p);
  }
  near(cores.reduce((n,p)=>n+C.resolveEngineSpec(p,ship).ratedThrustN,0),physicalThrust,'engine specs agree with independent old-law force');
 }
});

test('loading a pre-expansion Imperial save preserves its original machinery instead of applying the stock 2300 G recipe',()=>{
 const fields=['id','k','c','d','dir','length','ratedInputW','machineryGradeId','reactor','machineryId','nozzleShare'];
 const hardware=ship=>plain(ship.parts.filter(p=>p.k==='engineCore'||p.k==='engine').map(p=>Object.fromEntries(fields.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))));
 for(const key of ['imperial','imperial2']){const before=archive(key,'user-layout'),after=C.deserialize(plain(before));assert.deepEqual(hardware(after),hardware(before),key+' existing saved engine dimensions, rating and ownership stay unchanged');}
});
