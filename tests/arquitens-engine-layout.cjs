const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const E=require('../scripts/arquitens-engine-evidence.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-9,label+': '+a+' != '+b);
const podFor=new Map([[78,49],[80,54],[82,59]]),oldFile=path.join(root,'assets/source/ship-example-blueprints/arquitens.json.gz');
function nozzlePose(ship){return plain(ship.parts.filter(p=>p.k==='engine').map(p=>{const a=C.engineAppearance(p);return {id:p.id,d:p.d,dir:p.dir,mouth:C.add(p.c,C.mul(C.norm(p.dir),C.partDims(p).l/2)),appearance:Object.fromEntries(['skinAsset','skinAnchor','skinDiameter','skinAxial','nozzleLength','bodyLength','engineLength'].filter(k=>a[k]!=null).map(k=>[k,a[k]]))};}));}
function cylinderSamples(core){
 const frame=C.frameAxis(core.dir),radius=core.d/2,out=[];
 for(const t of [0,.125,.25,.5,.75,.875,1]){
  const centre=C.add(core.c,C.mul(frame.u,core.length*(t-.5)));out.push(centre);
  for(const f of [.5,1])for(let i=0;i<64;i++)out.push(C.add(centre,C.add(C.mul(frame.v,Math.cos(i*Math.PI/32)*radius*f),C.mul(frame.w,Math.sin(i*Math.PI/32)*radius*f))));
 }
 return out;
}
function verifyBodies(ship){
 const nozzles=ship.parts.filter(p=>p.k==='engine'),cores=ship.parts.filter(p=>p.k==='engineCore');
 assert.equal(nozzles.length,3);assert.equal(cores.length,3,'each visible propulsion pod contains its own paid engine');
 assert.equal(new Set(nozzles.map(n=>n.machineryId)).size,3,'independent nacelles cannot share one hidden central body');
 for(const nozzle of nozzles){
  const core=C.engineOwner(nozzle,ship),pod=ship.parts.find(p=>p.id===podFor.get(nozzle.id)),spec=C.resolveEngineSpec(core,ship);
  assert.ok(core&&pod);assert.equal(nozzles.filter(n=>n.machineryId===core.id).length,1);
  assert.equal(spec.valid,true);assert.equal(spec.machineryGradeId,'standard');near(spec.densityFactor,1,'ordinary machinery density');near(spec.wasteFraction,.05,'ordinary conversion loss');
  near(core.ratedInputW,C.partVolume(core)*C.PROPULSION.referenceInputDensity,'rated acceptance follows actual engine volume');
  near(nozzle.nozzleShare,core.ratedInputW,'one nozzle receives its own complete body rating');
  for(const point of cylinderSamples(core))assert.equal(C.inStruct(pod,point),true,'the complete engine cylinder stays inside its own visible pod #'+pod.id);
  for(const other of ship.parts.filter(p=>p!==core&&!C.isShapePart(p)&&p.k!=='engine'))assert.equal(C.overlapParts(core,other),false,'pod machinery clears paid equipment #'+other.id);
 }
 return {cores,nozzles};
}

test('Arquitens places three independent ordinary bodies inside its three unchanged native pods',()=>{
 const ship=C.SHIP_EXAMPLES.arquitens.build({stage:'machinery'}),structures=C.publicJSON(ship.parts.filter(C.isShapePart)),pose=nozzlePose(ship),sources=C.publicJSON(ship.parts.filter(C.isReactor)),power=ship.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0);
 const result=C.refitShipPropulsion(ship,'arquitens'),{cores}=verifyBodies(ship);
 assert.equal(result.engines.length,3);assert.equal(C.publicJSON(ship.parts.filter(C.isShapePart)),structures,'actual exterior geometry stays intact');assert.deepEqual(nozzlePose(ship),pose,'each original bell keeps its visible size and mouth');assert.equal(C.publicJSON(ship.parts.filter(C.isReactor)),sources,'the recipe does not resize or move a source');near(ship.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),power,'installed reactor output is conserved');
 near(C.buildPropulsionRequests(ship.parts.filter(p=>p.k==='engine').map(p=>C.resolveEngineSpec(p,ship))).reduce((n,p)=>n+p.requestedInputW,0),cores.reduce((n,p)=>n+p.ratedInputW,0),'three outlets count each physical engine exactly once');
});

test('loading an existing Arquitens save keeps its authored shared machinery instead of running the new stock recipe',()=>{
 const old=JSON.parse(zlib.gunzipSync(fs.readFileSync(oldFile))),loaded=C.deserialize(plain(old)),fields=['id','k','c','d','dir','length','ratedInputW','machineryGradeId','reactor','machineryId','nozzleShare'];
 const hardware=ship=>plain(ship.parts.filter(p=>p.k==='engine'||p.k==='engineCore').map(p=>Object.fromEntries(fields.filter(k=>Object.hasOwn(p,k)).map(k=>[k,p[k]]))));
 assert.deepEqual(hardware(loaded),hardware(old),'saved body dimensions, ratings and ownership remain user data');
});

test('the authenticated source guard accepts equivalent saved defaults and rejects changed or truncated exterior geometry',()=>{
 const source=E.loadSource(root),base=C.deserialize(plain(source.blueprint));assert.equal(source.sourceSha256,'1ff756d92ae4f97b7d6c9353e596963b16cbe9b5dba3b311200aa66948c80834');assert.equal(E.layoutEvidence(C,base,source).passed,true);
 const mutate=fn=>{const ship=JSON.parse(C.publicJSON(base));fn(ship);return E.layoutEvidence(C,ship,source);};
 assert.equal(mutate(s=>s.parts.find(p=>p.id===49).loft[0].push(0)).structuralLayoutPreserved,false,'array length changes cannot pass prefix-only comparison');
 assert.equal(mutate(s=>s.fits[0].p.push(0)).allFittingPosesPreserved,false,'an extra pose coordinate is rejected');
 assert.equal(mutate(s=>s.fits[0].p[0]+=.01).allFittingPosesPreserved,false,'a real fitting move is rejected');
 assert.equal(mutate(s=>s.parts.find(p=>p.id===78).skinDiameter+=1).nozzleAppearancePreserved,false,'a changed visible bell is rejected');
 assert.equal(mutate(s=>s.parts.push(plain(s.parts.find(p=>p.id===49)))).structuralLayoutPreserved,false,'duplicate part IDs cannot hide a changed exterior');
 assert.equal(mutate(s=>s.fits[0].k='twin200').weaponKindsCorrect,false,'the source guard checks the actual installed weapon kinds');
});

test('the pod guard rejects a shared owner and bodies outside their own paid nacelles',()=>{
 const source=E.loadSource(root),ship=plain(source.blueprint);ship.parts=ship.parts.filter(p=>p.k!=='engineCore');
 for(const [i,[nozzleId]]of Array.from(podFor).entries()){
  const nozzle=ship.parts.find(p=>p.id===nozzleId),id=10000+i,volume=Math.PI*(29.5/2)**2*22.5;nozzle.machineryId=id;
  ship.parts.push({id,k:'engineCore',c:[26.5,21.8,nozzle.c[2]],d:29.5,length:22.5,dir:[-1,0,0],autoFit:false,propulsionModelVersion:1,ratedInputW:volume*3.4e17,machineryGradeId:'standard',driveProfileId:'standard'});
 }
 assert.equal(E.podEvidence(C,ship).passed,true);
 const shared=plain(ship);shared.parts.find(p=>p.id===80).machineryId=10000;assert.equal(E.podEvidence(C,shared).independentNozzleOwners,false);
 const elsewhere=plain(ship);elsewhere.parts.find(p=>p.id===10000).c=[175,22,0];assert.equal(E.podEvidence(C,elsewhere).allBodiesInsidePods,false,'coverage by the main hull cannot substitute for the matching nacelle');
 const oversized=plain(ship);oversized.parts.find(p=>p.id===10001).d=35;assert.equal(E.podEvidence(C,oversized).allBodiesInsidePods,false,'the finite cylinder circumference is checked');
});

const stage=process.env.KS_ARQUITENS_ENGINE_STAGE;
test('Arquitens public pose evidence rejects added forward orientation and ignores only private cyclic caches',()=>{
 const E=require('../scripts/arquitens-engine-evidence.cjs'),source=E.loadSource(root),ship=plain(source.blueprint);assert.equal(E.layoutEvidence(C,ship,source).passed,true);
 for(const [field,value]of [['frameFlip',true],['frameForward',[0,0,1]],['localForward',[0,0,1]]]){ship.fits[0][field]=value;assert.equal(E.layoutEvidence(C,ship,source).allFittingPosesPreserved,false,field+' cannot change a protected turret orientation');delete ship.fits[0][field];}
 ship.fits[0]._cycle=ship.fits[0];assert.equal(E.layoutEvidence(C,ship,source).passed,true,'private runtime memoization cannot change public physical poses');
});
test('live native Arquitens structures omit only unsaved undefined keys in their public source projection',()=>{
 const E=require('../scripts/arquitens-engine-evidence.cjs'),source=E.loadSource(root),ship=C.SHIP_EXAMPLES.arquitens.build({stage:'fitted'});C.serialize(ship);assert.equal(E.layoutEvidence(C,ship,source).structuralLayoutPreserved,true);
 const structure=ship.parts.find(part=>part.k==='struct');structure.unpersistedRuntimeField=undefined;structure._cycle=ship;assert.equal(E.layoutEvidence(C,ship,source).structuralLayoutPreserved,true);structure.unpersistedRuntimeField=null;assert.equal(E.layoutEvidence(C,ship,source).structuralLayoutPreserved,false,'a saved public value cannot be removed by the undefined-only correction');
});
test('the completed Arquitens reaches 1800 G through real ordinary volume and its measured finished mass',{skip:!stage},()=>{
 const blueprintFile=fs.existsSync(path.join(stage,'blueprints/arquitens.json'))?path.join(stage,'blueprints/arquitens.json'):path.join(stage,'blueprint.json'),massFile=fs.existsSync(path.join(stage,'metrics.json'))?path.join(stage,'metrics.json'):path.join(stage,'audit.json'),blueprint=JSON.parse(fs.readFileSync(blueprintFile)),metrics=JSON.parse(fs.readFileSync(massFile)),massT=metrics.massT??metrics.models?.find(row=>row.key==='arquitens')?.massT,{cores}=verifyBodies(blueprint),volume=cores.reduce((n,p)=>n+C.partVolume(p),0),g=volume*1.7e8/(massT*1000*9.80665);
 assert.ok(Math.abs(g-1800)<=.2,'physical machinery volume reaches the target against completed mass: '+g);
 const old=JSON.parse(zlib.gunzipSync(fs.readFileSync(oldFile)));near(blueprint.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),old.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),'the completed ship retains its original finite plant');
});
