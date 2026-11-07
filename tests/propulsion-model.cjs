const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-11,`${a} != ${b}`);
function ship(){const s=C.newShip({L:40,W:24,H:20},'Propulsion fixture');s.parts=[{id:1,k:'gen',c:[30,10,0],d:4},{id:2,k:'engine',c:[-.5,10,0],d:1,nozzleLength:1,bodyLength:2,bodyRadius:.52,reactor:1,dir:[-1,0,0]}];s.nextId=3;return s;}
function spec(overrides={}){return {id:2,machineryId:2,valid:true,ratedInputW:1e18,effectiveMachineryVolumeM3:1e18/3.4e17,driveProfileId:'standard',wattsPerNewton:2e9,ratedThrustN:5e8,direction:[1,0,0],...overrides};}
function solve({h=1,u=1,power=1e18,damage=1,connected=true}={}){const requests=C.buildPropulsionRequests([spec()],{2:{thermalLimit:h,damageLimit:damage,connected}},u);return C.resolvePropulsion(requests,{2:power},1e6);}
test('fixed input/thrust/waste/acceleration examples share one pure calculation',()=>{
 for(const [state,P,F,Q,a]of [[{},1e18,5e8,5e16,500],[{h:.25},2.5e17,1.25e8,1.25e16,125],[{h:0},0,0,0,0],[{u:0},0,0,0,0],[{power:5e17},5e17,2.5e8,2.5e16,250]]){const r=solve(state);near(r.totalActualInputW,P);near(r.totalThrustN,F);near(r.wasteHeatW,Q);near(r.freeAccelerationMps2,a);}
 assert.equal(solve({h:.25}).outputRatio,.25);assert.equal(solve({connected:false}).totalThrustN,0);assert.equal(solve({damage:0}).totalThrustN,0);
});
test('a shared machinery input is divided across outlets and vectors use the opposite exhaust direction',()=>{
 const requests=C.buildPropulsionRequests([spec({id:2,direction:[1,0,0]}),spec({id:3,direction:[0,0,1]})]);
 near(requests.reduce((n,r)=>n+r.requestedInputW,0),1e18);const r=C.resolvePropulsion(requests,{2:1e18,3:1e18},1e6);near(r.totalActualInputW,1e18);near(r.totalThrustN,5e8);near(r.forceVector[0],2.5e8);near(r.forceVector[2],2.5e8);near(r.outputRatio,1);
 const blocked=C.buildPropulsionRequests([spec({id:2}),spec({id:3})],{3:{outletAvailable:false}});assert.equal(blocked[1].requestedInputW,0);near(blocked[0].requestedInputW,1e18);
 const s=ship();C.migrateLegacyPropulsion(s);assert.deepEqual(plain(C.resolveEngineSpec(s.parts[1],s).direction),[1,0,0]);
});
test('legacy generic/internal/exposed engines preserve isolated F0/P0 without compatibility cooling on repeated save/load',()=>{
 for(const family of [null,'internalTurbine','exposedTurbine']){const s=ship(),p=s.parts[1];if(family){Object.assign(p,C.equipmentOptions(family),{d:family==='internalTurbine'?56:18,dir:[-1,0,0],reactor:1});C.resizeEngine(p,p.d);}
  const before={F:C.nozzleThrust(p),P:C.nozzleDemand(p),segments:plain(C.enginePaths(s)[0].segments),shape:plain({c:p.c,d:p.d,nozzleLength:p.nozzleLength,bodyLength:p.bodyLength,bodyRadius:p.bodyRadius})};C.migrateLegacyPropulsion(s);near(C.nozzleThrust(p),before.F);near(C.nozzleDemand(p),before.P);assert.deepEqual(plain(C.enginePaths(s)[0].segments),before.segments);assert.deepEqual(plain({c:p.c,d:p.d,nozzleLength:p.nozzleLength,bodyLength:p.bodyLength,bodyRadius:p.bodyRadius}),before.shape);assert.equal(p.legacyCoolingInputW,0);assert.equal(C.resolveEngineSpec(p,s).legacyCoolingInputW,0);assert.equal(p.propulsionMigration.baselineInputW,before.P);
  const first=C.serialize(s),loaded=C.deserialize(first),second=C.serialize(loaded);assert.deepEqual(plain(second.parts),plain(first.parts));C.migrateLegacyPropulsion(loaded);near(loaded.parts[1].legacyCoolingInputW,0);assert.equal(loaded.parts.length,s.parts.length);
 }
});
test('integrated nozzle edits retain body dimensions and rating while keeping the body attached',()=>{
 const s=ship();C.migrateLegacyPropulsion(s);const p=s.parts[1],before=C.resolveEngineSpec(p,s),body=plain(C.enginePaths(s)[0].machinerySegment),volume=C.partVolume(C.enginePaths(s)[0]);p.d*=4;assert.ok(C.updateEngineSpec(p,{nozzleLength:3},s).ok);const after=C.resolveEngineSpec(p,s),current=plain(C.enginePaths(s)[0].machinerySegment),shift=C.mul(C.norm(p.dir),-(after.machineryOffsetM-before.machineryOffsetM));near(after.ratedInputW,before.ratedInputW);near(after.ratedThrustN,before.ratedThrustN);near(after.machineryVolumeM3,before.machineryVolumeM3);near(after.machineryOffsetM,p.nozzleLength/2);for(const end of ['a','b'])for(let i=0;i<3;i++)near(current[end][i],body[end][i]+shift[i]);assert.deepEqual({...current,a:body.a,b:body.b},body,'only the contact position changes with integrated nozzle length');assert.equal(after.valid,true);
 s.parts[0].c[0]+=100;near(C.resolveEngineSpec(p,s).maxInputW,before.maxInputW);near(C.partVolume(C.enginePaths(s)[0]),volume);assert.equal(C.engineTransmission(s).engines[p.id].connected,false,'a reactor moved outside the hull cannot earn a free outside transmission route');
});
test('valid higher input costs more and density overflow is rejected without mutating the part',()=>{
 const s=ship();C.migrateLegacyPropulsion(s);const p=s.parts[1];assert.ok(C.updateEngineSpec(p,{machineryGradeId:'dense',ratedInputW:1e18},s).ok);const cost=C.partBuildCost(p),cooling=p.legacyCoolingInputW,shape=[p.d,p.nozzleLength,p.machineryLengthM,p.machineryRadiusM];assert.ok(C.updateEngineSpec(p,{ratedInputW:2e18},s).ok);assert.ok(C.partBuildCost(p)>cost);assert.deepEqual([p.d,p.nozzleLength,p.machineryLengthM,p.machineryRadiusM],shape);assert.equal(p.legacyCoolingInputW,cooling);
 const previous=C.publicJSON(p),failed=C.updateEngineSpec(p,{ratedInputW:C.resolveEngineSpec(p,s).maxInputW*2},s);assert.equal(failed.ok,false);assert.ok(failed.issues.includes('machinery-density-exceeded'));assert.equal(C.publicJSON(p),previous);
});
test('invalid input, coefficients, mass and broken owner references fail safely',()=>{
 for(const patch of [{ratedInputW:NaN},{ratedInputW:Infinity},{ratedInputW:-1},{driveProfileId:'free-thrust'},{machineryRadiusM:0},{machineryLengthM:Infinity}]){const s=ship();C.migrateLegacyPropulsion(s);assert.equal(C.updateEngineSpec(s.parts[1],patch,s).ok,false);}
 for(const Cbad of [0,-1,Infinity,NaN]){const requests=C.buildPropulsionRequests([spec({wattsPerNewton:Cbad})]);assert.equal(C.resolvePropulsion(requests,{2:1e18},1e6).totalThrustN,0);}
 for(const mass of [0,-1,NaN,Infinity])assert.equal(C.resolvePropulsion(C.buildPropulsionRequests([spec()]),{2:1e18},mass).totalThrustN,0);
 const s=ship();C.migrateLegacyPropulsion(s);s.parts[1].machineryId=99;assert.equal(C.resolveEngineSpec(s.parts[1],s).valid,false);s.parts[1].machineryId=undefined;s.parts[1].propulsionModelVersion=9;assert.equal(C.resolveEngineSpec(s.parts[1],s).valid,false);assert.equal(C.resolveEngineSpec({}).valid,false);
});
test('new catalogue placement uses standard coefficient while resizing preserves rating and machinery',()=>{
 const s=ship();s.parts=s.parts.filter(p=>p.k!=='engine');const p=C.placePart(s,'engine',[-5,10,6],18,{...C.equipmentOptions('exposedTurbine'),d:18,reactor:1,allowOverlap:true},false);assert.equal(p.driveProfileId,'standard');assert.equal(C.resolveEngineSpec(p,s).wattsPerNewton,2e9);const before=plain([p.ratedInputW,p.machineryLengthM,p.machineryRadiusM,p.machineryOffsetM]);C.resizeEngine(p,36);C.enforceEquipment(p);assert.deepEqual(plain([p.ratedInputW,p.machineryLengthM,p.machineryRadiusM,p.machineryOffsetM]),before);
});
test('invalid fresh edits leave saved state untouched and declared volume cannot increase capacity',()=>{
 const s=ship(),p=s.parts[1],before=C.publicJSON(p);assert.equal(C.updateEngineSpec(p,{ratedInputW:Infinity},s).ok,false);assert.equal(C.publicJSON(p),before);
 C.migrateLegacyPropulsion(s);const cap=C.resolveEngineSpec(p,s).maxInputW;p.machineryVolumeM3=1e100;p.effectiveMachineryVolumeM3=1e100;assert.equal(C.resolveEngineSpec(p,s).maxInputW,cap);
});
test('owner self references retain rated machinery cost and sub-decimetre bodies stay physical',()=>{
 const s=ship();C.migrateLegacyPropulsion(s);const p=s.parts[1],cost=C.partBuildCost(p);p.machineryId=p.id;near(C.partBuildCost(p),cost);
 assert.ok(C.updateEngineSpec(p,{ratedInputW:1,machineryLengthM:.02},s).ok);const body=C.enginePaths(s).find(q=>q.nozzle===p.id);assert.ok(body);near(body.machinerySegment.l,.02);assert.ok(C.partVolume(body)>0);
});
test('invalid pure descriptors request no input and engine availability defaults are honored',()=>{
 for(const value of [0,-1,Infinity,NaN]){const requests=C.buildPropulsionRequests([spec({wattsPerNewton:value})]);assert.equal(requests[0].requestedInputW,0);}
 for(const ratedInputW of [Infinity,-Infinity,NaN])for(const throttle of [0,1]){const request=C.buildPropulsionRequests([spec({ratedInputW})],{},throttle)[0];assert.equal(request.requestedInputW,0);assert.ok(Number.isFinite(request.requestedInputW));}
 for(const state of [{available:false},{connected:false},{outletAvailable:false}])assert.equal(C.buildPropulsionRequests([spec(state)])[0].requestedInputW,0);
});
test('frozen nested saved templates migrate without mutating their immutable source',()=>{
 const original=ship();Object.freeze(original.parts[1]);Object.freeze(original.parts);Object.freeze(original);const data={templates:[original]},migrated=C.migrateLegacyPropulsion(data);assert.equal(migrated.templates[0].parts[1].propulsionModelVersion,1);assert.equal(original.parts[1].propulsionModelVersion,undefined);
});
test('ENG-T18 mirrors and composite copies preserve engine ratings, geometry and remapped network identities',()=>{
 const s=ship();C.migrateLegacyPropulsion(s);const owner=s.parts[1];owner.tw=6;owner.vt=7;s.parts[0].tw=4;s.parts[0].vt=5;const child={...plain(owner),id:3,c:[-.5,10,4],dir:[-1,.1,.2],machineryId:owner.id};delete child.tw;delete child.vt;s.parts.push(child);s.nextId=4;s.links=[{kind:'power',from:'p1',to:'p2',cap:1e18},{kind:'heat',from:'p2',to:'p3',cap:1e16}];
 const side=C.mirrorPart(child,s),vertical=C.vmirrorPart(child,s);assert.equal(side.reactor,4);assert.equal(side.machineryId,6);assert.equal(vertical.reactor,5);assert.equal(vertical.machineryId,7);near(side.ratedInputW,child.ratedInputW);near(vertical.machineryLengthM,child.machineryLengthM);near(side.dir[2],-child.dir[2]);near(vertical.dir[1],-child.dir[1]);
 const captured=C.assemblyCapture(s,{parts:[1,2,3],fits:[]},{name:'Shared propulsion'});assert.ok(captured.template);const tpl=C.normalizeAssemblyTemplate(captured.template),target=C.newShip({L:300,W:80,H:40},'Copy target'),placed=C.assemblyPlace(target,tpl,[100,20,20],{mirror:true,allowOverlap:true});assert.equal(placed.error,undefined);assert.equal(target.parts.length,6);assert.equal(new Set(target.parts.map(p=>p.id)).size,6);
 for(const p of target.parts.filter(p=>p.k==='engine')){near(p.ratedInputW,owner.ratedInputW);near(p.machineryLengthM,owner.machineryLengthM);assert.equal(p.driveProfileId,owner.driveProfileId);assert.ok(target.parts.some(r=>r.id===p.reactor&&r.k==='gen'));if(p.machineryId!=null)assert.ok(target.parts.some(o=>o.id===p.machineryId&&o.k==='engine'&&o.machineryId==null));}
 for(const link of target.links||[])for(const key of ['from','to'])assert.ok(target.parts.some(p=>'p'+p.id===link[key]));const roundTrip=C.deserialize(C.serialize(target));assert.deepEqual(plain(roundTrip.parts),plain(target.parts));assert.deepEqual(plain(roundTrip.links),plain(target.links));
});
