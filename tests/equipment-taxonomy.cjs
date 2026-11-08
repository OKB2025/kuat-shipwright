const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const plain=value=>JSON.parse(JSON.stringify(value));
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-9,message+': '+actual+' vs '+expected);
function model(part){const ship=C.newShip({L:30,W:20,H:10,assembly:true},'Equipment compatibility');ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[30,20,10]},{id:2,c:[0,0,0],d:1,...part}];ship.fits=[];ship.nextId=3;return ship;}
const restored=ship=>C.deserialize(C.serialize(ship));

test('catalogue consolidation preserves the saved legacy equipment kinds',()=>{
 for(const kind of ['shield','localShield','repulsor','landingGear','navComputer','targetComputer','firecontrol','cockpit','vls'])assert.ok(C.PARTS[kind],kind);
 assert.equal(C.placementCapability({k:'shield'}).space,'interior');
});

test('unmarked landing gear retains mechanical support without acquiring repulsor support',()=>{
 for(const ship of [model({k:'landingGear'}),restored(model({k:'landingGear'}))]){
  const part=ship.parts.find(p=>p.k==='landingGear'),stats=C.computeStats(ship);
  near(C.partVolume(part),1,'legacy gear volume');near(stats.craftSystems.landingSupport,300,'legacy mechanical support');near(stats.repulsorSupport,0,'no invented lift support');
  assert.equal(part.landingEquipment,undefined);
 }
});

test('unmarked repulsors retain their original lift support without acquiring mechanical landing support',()=>{
 for(const ship of [model({k:'repulsor'}),restored(model({k:'repulsor'}))]){
  const part=ship.parts.find(p=>p.k==='repulsor'),volume=C.partVolume(part),stats=C.computeStats(ship);
  near(volume,Math.PI*.375,'legacy repulsor volume');near(stats.repulsorSupport,volume*70,'legacy lift support');near(stats.craftSystems.landingSupport,0,'no implicit mechanical upgrade');
  assert.equal(part.landingEquipment,undefined);
 }
});

test('opted-in landing equipment combines the existing functions and existing power demand once',()=>{
 const legacy=model({k:'repulsor'}),combined=model({k:'repulsor',landingEquipment:true});
 const base=C.computeStats(legacy),stats=C.computeStats(combined),volume=C.partVolume(combined.parts[1]);
 near(stats.repulsorSupport,volume*70,'existing repulsor coefficient');near(stats.craftSystems.landingSupport,volume*300,'existing landing-gear coefficient');
 near(C.craftSystemsPower(combined)-C.craftSystemsPower(legacy),volume*1e15,'added existing landing-gear power');
 near(stats.draw.systems-base.draw.systems,volume*1e15,'power enters the shared systems demand');near(stats.draw.hotel-base.draw.hotel,volume*1e15,'power enters the shared hotel demand');
 near(stats.mass,base.mass,'catalogue integration does not alter legacy density');
 const copy=restored(combined),after=C.computeStats(copy);
 assert.equal(copy.parts.find(p=>p.k==='repulsor').landingEquipment,true);
 near(after.repulsorSupport,stats.repulsorSupport,'saved lift support');near(after.craftSystems.landingSupport,stats.craftSystems.landingSupport,'saved landing support');
});

test('legacy cockpit spheres and their crew and suit settings survive without an implicit canopy conversion',()=>{
 for(const ship of [model({k:'cockpit',seats:2,suit:true}),restored(model({k:'cockpit',seats:2,suit:true}))]){
  const cockpit=ship.parts.find(p=>p.k==='cockpit'),stats=C.computeStats(ship);
  near(C.partVolume(cockpit),Math.PI/6,'legacy sphere volume');assert.equal(stats.crew,2);assert.equal(stats.craftSystems.suitSeats,2);
  assert.equal(C.canopyTriangles(cockpit),null);const before=C.publicJSON(cockpit);C.canopyShape(cockpit);
  assert.equal(cockpit.canopy,undefined,'reading shape defaults never opts legacy data into conversion');
  assert.equal(C.publicJSON(cockpit),before,'reading defaults preserves the authoring state');
 }
});

test('an explicitly shaped cockpit uses real canopy geometry and preserves the cockpit identity and functions after reload',()=>{
 const ship=model({k:'cockpit',seats:2,suit:true}),cockpit=ship.parts[1];
 C.setCanopyShape(cockpit,{form:'box',size:[4,2,1],taper:0});
 assert.equal(cockpit.k,'cockpit');assert.equal(cockpit.id,2);
 const shape=C.canopyShape(cockpit),triangles=C.canopyTriangles(cockpit);
 assert.deepEqual(plain(shape.size),[4,2,1]);assert.ok(triangles.length>=36);assert.ok(Array.from(triangles).every(Number.isFinite));
 near(C.partVolume(cockpit),8,'explicit box canopy volume');
 const stats=C.computeStats(ship),copy=restored(ship),saved=copy.parts.find(p=>p.id===2),after=C.computeStats(copy);
 assert.equal(stats.crew,2);assert.equal(stats.craftSystems.suitSeats,2);assert.equal(after.crew,2);assert.equal(after.craftSystems.suitSeats,2);
 assert.equal(saved.k,'cockpit');assert.equal(saved.seats,2);assert.equal(saved.suit,true);assert.deepEqual(plain(C.canopyShape(saved)),plain(shape));
 near(C.partVolume(saved),C.partVolume(cockpit),'reloaded canopy volume');near(after.mass,stats.mass,'reloaded physical mass');
});

test('strict canopy attachment accepts actual contact for each shape and rejects a visible gap',()=>{
 for(const form of ['box','trap','ellipsoid']){
  const ship=model({k:'cockpit',seats:2,suit:true,c:[0,5.5,4]}),cockpit=ship.parts.pop();cockpit.id=-1;ship.nextId=2;
  C.setCanopyShape(cockpit,{form,size:[4,2,1],taper:.15});
  const request={mode:'direct',parentStructureId:1,hit:{p:[0,5,4],n:[0,1,0]},geometryRevision:1};
  const result=C.solvePlacement(ship,cockpit,request);assert.equal(result.ok,true,form+': '+result.error);assert.equal(result.contact.connected,true);
  assert.equal(C.acceptPlacementResult(ship,result).ok,true);const source=ship.parts[1];
  const opposite=C.mirrorPart(source,ship);opposite.id=-1;
  const reflected=C.solvePlacement(ship,opposite,{...request,hit:{p:[0,5,-4],n:[0,1,0]}});
  assert.equal(reflected.ok,true,form+' mirrored contact: '+reflected.error);assert.equal(C.acceptPlacementResult(ship,reflected).ok,true);
  const copy=restored(ship),diagnostics=C.placementDiagnostics(copy);assert.equal(diagnostics.filter(item=>item.connected).length,2,form+' attachment reload');
  assert.deepEqual(plain(copy.parts.filter(p=>p.k==='cockpit').map(p=>p.c[2])),[4,-4]);
  const floating={...cockpit,c:[0,5.75,4]};const rejected=C.solvePlacement(ship,floating,request);assert.equal(rejected.ok,false,form+' rejects a real gap');
 }
});

test('new shield placement keeps its fixed dimensions and validates actual interior containment',()=>{
 const ship=model({k:'shield'}),shield=ship.parts.pop();shield.id=-1;ship.nextId=2;
 const inside=C.solvePlacement(ship,shield,{mode:'direct',hostId:1});assert.equal(inside.ok,true,inside.error);assert.equal(inside.part.d,1);
 const outside=C.solvePlacement(ship,{...shield,c:[100,0,0]},{mode:'direct',hostId:1});assert.equal(outside.ok,false);assert.equal(shield.d,1);assert.deepEqual(shield.c,[0,0,0]);
});

test('changing a mounted canopy height keeps its real base on the parent and follows later parent rotation',()=>{
 const ship=model({k:'cockpit',seats:2,suit:true}),cockpit=ship.parts.pop(),parent=ship.parts[0];cockpit.id=-1;ship.nextId=2;
 C.setCanopyShape(cockpit,{form:'box',size:[4,2,1],taper:0});cockpit.c=C.canopyMountPosition(cockpit,[0,5,0],[0,1,0]);
 const result=C.commitPlacement(ship,cockpit,{mode:'direct',parentStructureId:1,hit:{p:[0,5,0],n:[0,1,0]},geometryRevision:1});assert.equal(result.ok,true,result.error);const placed=result.part;
 near(placed.c[1],5.5,'initial canopy centre');C.setCanopyShape(placed,{form:'box',size:[4,2,2],taper:0},parent);
 near(placed.c[1],6,'new centre follows the actual half height');near(C.partAABB(placed)[1],5,'base remains on the original mounting skin');
 assert.equal(C.refreshPlacementGeometry(ship).ok,true);assert.deepEqual(plain(placed.placement.requestedGeometry.canopy.size),[4,2,2]);
 parent.roll=23;parent.pitch=11;assert.equal(C.refreshPlacementGeometry(ship).ok,true);assert.equal(C.placementDiagnostics(ship).find(item=>item.partId===placed.id).connected,true);
 const copy=restored(ship),saved=copy.parts.find(item=>item.id===placed.id);assert.equal(C.placementDiagnostics(copy).find(item=>item.partId===placed.id).connected,true);assert.deepEqual(plain(C.canopyShape(saved).size),[4,2,2]);
});

test('equipment replacement offers the unified catalogue while retaining an existing hidden legacy kind',()=>{
 const modern={k:'command',c:[0,0,0],d:1},options=Array.from(C.replacementOptions(modern));
 assert.ok(options.includes('firecontrol'),'combined fire control remains available');
 for(const kind of ['landingGear','targetComputer','vls'])assert.ok(!options.includes(kind),kind+' is not offered as a new replacement');
 for(const kind of ['landingGear','targetComputer']){
  const legacy={k:kind,c:[0,0,0],d:1},before=C.publicJSON(legacy),choices=Array.from(C.replacementOptions(legacy));
  assert.ok(choices.includes(kind),'existing '+kind+' remains editable without conversion');
  assert.ok(!choices.includes(kind==='landingGear'?'targetComputer':'landingGear'),'a different hidden kind is not introduced');
  assert.equal(C.publicJSON(legacy),before,'opening replacement choices is non-destructive');
 }
});
