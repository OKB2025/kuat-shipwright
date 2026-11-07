const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const E=require('../scripts/stock-engine-source-evidence.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,label+': '+a+' != '+b);
const targets={cr90:{nozzles:11,g:2100},hammerhead:{nozzles:3,g:2500}};
function hardware(ship){const fields=['id','k','c','d','dir','length','ratedInputW','machineryGradeId','reactor','machineryId','nozzleShare'];return plain(ship.parts.filter(p=>p.k==='engine'||p.k==='engineCore').map(p=>Object.fromEntries(fields.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))));}
function nozzlePose(ship){return plain(ship.parts.filter(p=>p.k==='engine').map(p=>{const a=C.engineAppearance(p);return {id:p.id,d:p.d,dir:p.dir,mouth:C.add(p.c,C.mul(C.norm(p.dir),C.partDims(p).l/2)),appearance:Object.fromEntries(['skinAsset','skinAnchor','skinDiameter','skinAxial','bodyLength','bodyRadius','engineLength','roll'].filter(k=>a[k]!=null).map(k=>[k,a[k]]))};}));}
function cylinderSamples(core){const frame=C.frameAxis(core.dir),out=[];for(const t of [0,.125,.25,.375,.5,.625,.75,.875,1]){const c=C.add(core.c,C.mul(frame.u,core.length*(t-.5)));out.push(c);for(const r of [.25,.5,.75,1])for(let i=0;i<64;i++)out.push(C.add(c,C.add(C.mul(frame.v,Math.cos(i*Math.PI/32)*core.d/2*r),C.mul(frame.w,Math.sin(i*Math.PI/32)*core.d/2*r))));}return out;}
function verifyBodies(ship,key){
 const nozzles=ship.parts.filter(p=>p.k==='engine'),cores=ship.parts.filter(p=>p.k==='engineCore'),hull=ship.parts.find(p=>p.k==='struct'&&p.form==='reference'),expected=targets[key].nozzles;
 assert.ok(hull,'the supplied STL remains the physical containing structure');assert.equal(nozzles.length,expected);assert.equal(cores.length,expected,'each visible nacelle has one separately paid engine');assert.equal(new Set(nozzles.map(p=>p.machineryId)).size,expected,'connected pods cannot share a floating central engine');
 for(const nozzle of nozzles){
  const core=C.engineOwner(nozzle,ship),spec=C.resolveEngineSpec(core,ship),axis=C.norm(nozzle.dir),aft=C.add(core.c,C.mul(axis,core.length/2)),throat=C.sub(nozzle.c,C.mul(axis,C.partDims(nozzle).l/2)),delta=C.sub(throat,aft),gap=C.dot(delta,axis),lateral=C.sub(delta,C.mul(axis,gap));
  assert.equal(core.k,'engineCore');assert.equal(nozzles.filter(p=>p.machineryId===core.id).length,1);assert.ok(gap>=-.000001&&gap<=2,'the engine aft end is immediately inboard of its own nozzle: '+gap+' m');near(C.len(lateral),0,'the local engine and its nozzle have one straight shaft axis');assert.equal(spec.valid,true);assert.equal(spec.machineryGradeId,'standard');near(spec.densityFactor,1,'ordinary engine input density');near(spec.wasteFraction,.05,'ordinary engine conversion loss');near(core.ratedInputW,C.partVolume(core)*3.4e17,'input rating belongs to real body volume');near(nozzle.nozzleShare,core.ratedInputW,'one nozzle receives its own independent body rating');
  for(const point of cylinderSamples(core))assert.equal(C.inStruct(hull,point),true,key+' full finite body remains in its own source nacelle or its connected inboard hull');
  for(const other of ship.parts.filter(p=>p!==core&&!C.isShapePart(p)&&p.k!=='engine'&&!C.flexibleCompartment(ship,p)))assert.equal(C.overlapParts(core,other),false,key+' engine clears paid hard equipment #'+other.id);
 }
 return {cores,nozzles};
}

test('a thin imported surface cannot change the solid-side parity of an interior CR90 engine point',()=>{
 const ship=C.SHIP_EXAMPLES.cr90.build({stage:'machinery'}),hull=ship.parts.find(C.isShapePart);
 // The old fixed 1 mm step skipped a second source-surface crossing only
 // 0.13 mm after the first. These interior points then appeared outside.
 const inside=[[8.85,23.849876988676897,-18.899922904338904],[14.05,21.966180640223552,-14.724174589020073],[17.95,22.064617214029347,-8.07235797597065],[7.55,23.727563113002507,5.733243662402944],[8.85,6.905304700397009,18.713156202111925]];
 for(const point of inside)assert.equal(C.inStruct(hull,point),true,'a real interior point stays inside across thin external source detail');
 for(const point of [[-1,24,-18],[151,24,-18],[8.85,100,-18],[8.85,24,-100]])assert.equal(C.inStruct(hull,point),false,'the same test still rejects real exterior points');
});

for(const key of Object.keys(targets)){
 test(key+' installs enlarged independent ordinary engines immediately inside every original nozzle',()=>{
  // Sphyrna's raw builder still expresses a whole nacelle as its legacy
  // nozzle. Compare its visible bell with the authenticated existing stock
  // result, after the unchanged long-nozzle normalization.
  const ship=C.SHIP_EXAMPLES[key].build({stage:'machinery'}),structures=C.publicJSON(ship.parts.filter(C.isShapePart)),pose=nozzlePose(key==='hammerhead'?E.loadSource(root,key).blueprint:ship),sources=ship.parts.filter(C.isReactor).map(p=>({id:p.id,power:C.reactorPower(p),volume:C.partVolume(p)})),result=C.refitShipPropulsion(ship,key),{cores}=verifyBodies(ship,key);
  assert.equal(result.engines.length,targets[key].nozzles);assert.equal(C.publicJSON(ship.parts.filter(C.isShapePart)),structures,'the source STL envelope is unchanged');assert.deepEqual(nozzlePose(ship),pose,'each authored bell retains its visible size, mouth and appearance');
  for(const before of sources){const after=ship.parts.find(p=>p.id===before.id);assert.ok(after&&C.isReactor(after));near(C.reactorPower(after),before.power,'local machinery relocation preserves source output');near(C.partVolume(after),before.volume,'a relocated reactor retains its physical volume');}
  near(C.buildPropulsionRequests(ship.parts.filter(p=>p.k==='engine').map(p=>C.resolveEngineSpec(p,ship))).reduce((n,p)=>n+p.requestedInputW,0),cores.reduce((n,p)=>n+p.ratedInputW,0),'independent engines are counted once upstream');
 });
 test(key+' existing saved machinery remains authored hardware when the stock recipe changes',()=>{
  const source=E.loadSource(root,key),loaded=C.deserialize(plain(source.blueprint));assert.deepEqual(hardware(loaded),hardware(source.blueprint),'loading an old save does not apply an example-only performance upgrade');assert.equal(E.layoutEvidence(C,loaded,source,key).passed,true,'historical STL exterior, all guns and all nozzle appearances remain intact');
 });
}

const stage=process.env.KS_LIGHT_ENGINE_STAGE,stagePrefix=process.env.KS_LIGHT_ENGINE_STAGE_PREFIX;
for(const key of Object.keys(targets))test(key+' completed physical engine volume reaches its requested catalogue acceleration',{skip:!stage&&!stagePrefix},()=>{
 const directory=stagePrefix?stagePrefix+'-'+key:stage,published=fs.existsSync(path.join(directory,'blueprints',key+'.json')),ship=JSON.parse(fs.readFileSync(published?path.join(directory,'blueprints',key+'.json'):path.join(directory,key,'blueprint.json'))),metrics=JSON.parse(fs.readFileSync(published?path.join(directory,'audit.json'):path.join(directory,key,'summary.json'))),row=metrics.models?metrics.models.find(p=>p.key===key):metrics,{cores}=verifyBodies(ship,key),g=cores.reduce((n,p)=>n+C.partVolume(p),0)*1.7e8/(row.massT*1000*9.80665);
 assert.ok(Math.abs(g-targets[key].g)<=.2,'ordinary installed volume and completed mass deliver '+targets[key].g+' G: '+g);
 const source=E.loadSource(root,key);assert.equal(E.layoutEvidence(C,ship,source,key).passed,true,'factory completion retains authenticated source exterior and weapon layout');
 near(ship.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),source.blueprint.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),'the completed example preserves its finite reactor output');
});
