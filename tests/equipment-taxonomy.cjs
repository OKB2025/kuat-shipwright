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

// 2026-11-26 (user: 「リパルサーリフトは質量分搭載されてるという想定でリパルサーリフトの部品自体を無くせない？」「自動で足す／機体も無くす」): the saved kinds
// `repulsor` and `landingGear` are taken out on load and the lift is carried for the mass (C.REPULSORLIFT; tests/ship-repulsorlift.cjs).
// Three tests stood here until then: an unmarked landing gear gave 300 t of landing support a cubic metre and 70 t of lift; an unmarked
// repulsor gave 70 t of lift a cubic metre and no landing support; a repulsor marked landingEquipment gave both and drew 1e15 W a cubic
// metre. Those figures belonged to the parts and went with them.
test('saved repulsors and landing gear are taken out on load and the design is carried for its mass',()=>{
 for(const part of [{k:'landingGear'},{k:'repulsor'},{k:'repulsor',landingEquipment:true}]){
  const ship=restored(model(part)),stats=C.computeStats(ship),bare=C.computeStats(restored(model({k:'inertial'})));
  assert.equal(ship.parts.filter(p=>p.k==='repulsor'||p.k==='landingGear').length,0,part.k+' is gone after load');
  near(stats.repulsorSupport,stats.mass*C.REPULSORLIFT.margin,'support by mass');near(stats.craftSystems.landingSupport,stats.mass*C.REPULSORLIFT.margin,'the systems row says the same');assert.equal(stats.craftSystems.landingReady,true);
  assert.ok(stats.mass<bare.mass,'and the part\'s own mass is not in the design');
 }
});

// v24 Cockpits are fixed crew seats (one person each); an old cockpit's look becomes a canopy structure.
test('legacy cockpit spheres become a canopy structure and one fixed seat per crew member',()=>{
 const ship=restored(model({k:'cockpit',seats:2,suit:true})),seats=ship.parts.filter(p=>p.k==='cockpit'),canopy=ship.parts.find(p=>p.label==='キャノピー');
 assert.equal(seats.length,2);for(const p of seats){assert.deepEqual(plain(p.room),plain(C.COCKPIT_SEAT.room));assert.equal(p.seats,1);assert.equal(p.suit,true);}
 assert.ok(canopy&&C.isShapePart(canopy),'the old sphere keeps its look as a structure');near(C.structVolume?C.structVolume(canopy):Math.PI/6,Math.PI/6,'canopy volume',.05);
 const stats=C.computeStats(ship);assert.equal(stats.crew,2);assert.equal(stats.craftSystems.suitSeats,2);
 const again=restored(ship);assert.equal(again.parts.filter(p=>p.k==='cockpit').length,2,'converted once');assert.equal(again.parts.filter(p=>p.label==='キャノピー').length,1);
});

test('an old shaped canopy keeps its shape as a structure and its crew as seats',()=>{
 const ship=model({k:'cockpit',seats:2,suit:true}),cockpit=ship.parts[1];
 C.setCanopyShape(cockpit,{form:'box',size:[4,2,1],taper:0});
 const copy=restored(ship),canopy=copy.parts.find(p=>p.label==='キャノピー');
 assert.equal(canopy.form,'box');assert.deepEqual(plain(canopy.s),[4,2,1]);assert.equal(copy.parts.filter(p=>p.k==='cockpit').length,2);
 assert.equal(copy.parts.some(p=>p.k==='cockpit'&&p.canopy),false);
});

test('crew seats keep one fixed size whatever size is asked for',()=>{
 const ship=C.newShip({L:30,W:20,H:10,assembly:true},'Seat size');const p=C.placePart(ship,'cockpit',[0,0,0],3,{room:[4,4,4]});
 assert.deepEqual(plain(p.room),plain(C.COCKPIT_SEAT.room));assert.equal(C.PARTS.cockpit.min,C.PARTS.cockpit.max);
});

test('new shield placement keeps its fixed dimensions and validates actual interior containment',()=>{
 const ship=model({k:'shield'}),shield=ship.parts.pop();shield.id=-1;ship.nextId=2;
 const inside=C.solvePlacement(ship,shield,{mode:'direct',hostId:1});assert.equal(inside.ok,true,inside.error);assert.equal(inside.part.d,1);
 const outside=C.solvePlacement(ship,{...shield,c:[100,0,0]},{mode:'direct',hostId:1});assert.equal(outside.ok,false);assert.equal(shield.d,1);assert.deepEqual(shield.c,[0,0,0]);
});


test('equipment replacement offers the unified catalogue while retaining an existing hidden legacy kind',()=>{
 const modern={k:'command',c:[0,0,0],d:1},options=Array.from(C.replacementOptions(modern));
 assert.ok(options.includes('firecontrol'),'combined fire control remains available');
 // 2026-11-26: landingGear is hidden again (the repulsorlift is no part any more). Was (2026-11-24): offered as リパルサーリフト.
 for(const kind of ['landingGear','repulsor','targetComputer','vls'])assert.ok(!options.includes(kind),kind+' is not offered as a new replacement');
 for(const kind of ['landingGear','targetComputer']){
  const legacy={k:kind,c:[0,0,0],d:1},before=C.publicJSON(legacy),choices=Array.from(C.replacementOptions(legacy));
  assert.ok(choices.includes(kind),'existing '+kind+' remains editable without conversion');
  for(const hidden of ['targetComputer','vls'])if(hidden!==kind)assert.ok(!choices.includes(hidden),'a different hidden kind ('+hidden+') is not introduced');
  assert.equal(C.publicJSON(legacy),before,'opening replacement choices is non-destructive');
 }
});
