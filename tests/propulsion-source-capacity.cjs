const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
function direct(){const s=C.newShip({L:40,W:24,H:24},'Finite factory feeds');s.reference='craft_tie_ln';s.parts=[{id:1,k:'gen',c:[30,12,0],d:2},{id:2,k:'engine',c:[1,12,0],d:1,nozzleLength:1,bodyLength:2,bodyRadius:.52,reactor:1,dir:[-1,0,0]}];s.nextId=3;C.migrateLegacyPropulsion(s);s.parts[1].ratedInputW=1e15;s.links=[{kind:'power',from:'p1',to:'p2',cap:1e15}];return s;}
test('proven old stock-craft nameplate feeds expand to finite connected source power',()=>{
 const s=direct(),P=C.reactorPower(s.parts[0]),before=plain(s.parts),a=C.engineTransmission(s);assert.ok(a.engines[2].capacityW>.99*P);assert.deepEqual(plain(s.parts),before);
 const saved=C.serialize(s),link=saved.links.find(l=>l.kind==='power');assert.equal(link.auto,true);assert.equal(link.capacityBasis,'reactor-supply');near(link.cap,link.capacityReferenceW);const loaded=C.deserialize(saved);assert.ok(C.engineTransmission(loaded).engines[2].capacityW>.99*P);
});
test('different manual electrical and mechanical restrictions remain authoritative',()=>{
 const s=direct();s.links[0].cap=2e15;const a=C.engineTransmission(s);assert.ok(a.engines[2].capacityW<=2e15);const saved=C.serialize(s);assert.equal(saved.links[0].auto,undefined);near(saved.links[0].cap,2e15);
 const automatic=C.deserialize(C.serialize(direct()));automatic.links[0].cap=3e15;assert.ok(C.engineTransmission(automatic).engines[2].capacityW<=3e15,'editing an automatically generated link makes the new finite cap authoritative');
});
test('proven stock-capital bus feeds discard only the old 1.3 nameplate copy',()=>{
 const s=direct();s.reference='imperial';s.parts[1].busFeed=true;s.parts[1].feedCapacityW=1.3e15;s.links[0].cap=1.3e15;
 const P=C.reactorPower(s.parts[0]);assert.ok(C.engineTransmission(s).engines[2].capacityW>.99*P);
 s.links[0].cap=1.2e15;delete s._engineTransmission;assert.ok(C.engineTransmission(s).engines[2].capacityW<=1.2e15,'an edited finite bus cap remains effective');
 s.links[0].cap=1.3e15;s.parts[1].feedCapacityW=1.2e15;delete s._engineTransmission;assert.ok(C.engineTransmission(s).engines[2].capacityW<=1.2e15,'an edited finite hardware acceptance remains effective');
});
test('mechanical route planning uses the finite connected source once and retains explicit shafts',()=>{
 const s=C.newShip({L:60,W:40,H:40},'Single finite shaft');s.parts=[{id:1,k:'gen',c:[45,20,0],d:2},{id:2,k:'engineCore',c:[15,20,0],d:4,length:10,dir:[-1,0,0],reactor:1,propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard'},{id:3,k:'engine',c:[2,20,0],d:1,nozzleLength:1,dir:[-1,0,0],reactor:1,machineryId:2,propulsionModelVersion:1}];s.links=[{kind:'power',from:'p1',to:'p2'}];s.nextId=4;
 const spec=C.resolveEngineSpec(s.parts[1],s),route=C.engineDriveRoutes(s).routes.find(r=>r.nozzleId===3);assert.ok(route);near(route.requestedCapacityW,spec.availableInputW*(1-C.PROPULSION.wasteFraction));assert.ok(route.capacityW<=route.requestedCapacityW);
 s.parts[2].shaftCapacityW=spec.availableInputW*.1;delete s._engineDriveRoutes;const limited=C.engineDriveRoutes(s).routes.find(r=>r.nozzleId===3);assert.ok(limited);near(limited.requestedCapacityW,spec.availableInputW*.1);assert.ok(limited.capacityW<=limited.requestedCapacityW);
});
test('limited mechanical routes recover the real cross-section between coarse half-radius fallbacks',()=>{
 const s=C.newShip({L:40,W:40,H:4},'Finite four-metre corridor');s.hull.assembly=true;
 s.parts=[{id:1,k:'struct',c:[20,0,0],s:[40,40,4],form:'box'},{id:2,k:'gen',c:[500,0,0],d:1,room:[100,100,4]},{id:3,k:'engineCore',c:[35,0,0],d:8,length:10,dir:[-1,0,0],reactor:2,propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard'},{id:4,k:'engine',c:[0,0,0],d:8,nozzleLength:1,dir:[-1,0,0],reactor:2,machineryId:3,propulsionModelVersion:1}];s.links=[{kind:'power',from:'p2',to:'p3'}];s.nextId=5;
 const before=C.publicJSON(s),network=C.engineDriveRoutes(s),route=network.routes.find(r=>r.nozzleId===4);assert.ok(route?.valid&&route.inside&&route.clear);assert.equal(C.publicJSON(s),before);
 // This measured corridor admits a radius just below two metres. The
 // requested radius is 2.8 m, so the old first-success 1.4 m pipe discarded
 // almost half the physically possible capacity.
 const requestedRadius=Math.sqrt(route.requestedCapacityW/(Math.PI*C.ENGINE_SHAFT_FLUX));near(requestedRadius,2.8);assert.ok(route.radius>1.99&&route.radius<=2);assert.ok(route.capacityW>route.requestedCapacityW*.5);near(route.capacityW,Math.PI*route.radius*route.radius*C.ENGINE_SHAFT_FLUX);assert.ok(network.parts.some(p=>p.id===route.partId&&p.volumeM3>0));
 s.parts[0].s[2]=2;delete s._engineDriveRoutes;const narrower=C.engineDriveRoutes(s).routes.find(r=>r.nozzleId===4);assert.ok(narrower?.valid&&narrower.inside&&narrower.clear);assert.ok(narrower.radius<=1&&narrower.capacityW<route.capacityW,'a real smaller corridor still restricts the shaft');
});
