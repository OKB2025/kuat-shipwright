const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/placement-physics-preserved.json'),'utf8'));
const near=(actual,expected,label)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=Math.max(1,Math.abs(expected))*1e-9,`${label}: ${actual} != ${expected}`);
function check(actual,expected,prefix){for(const [k,v]of Object.entries(expected)){if(typeof v==='number')near(actual[k],v,prefix+'.'+k);else assert.equal(actual[k],v,prefix+'.'+k);}}
function measure(ship){const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship),unit=C.fleetUnit('physics-retained','physics-retained',profile,0);unit.order={...unit.order,power:'balanced'};unit.maneuver=1;C.fleetPowerStep(unit,C.fleetSystems(unit),null,0,.25);return {stats,profile,unit};}

for(const row of fixture.cases)test(`saved ${row.expected.owned?'owned hull':'legacy hull'} retains framing, strength, propulsion and thermal budgets from main`,()=>{
 const ship=C.deserialize(plain(row.design)),result=measure(ship),expected=row.expected;
 check(result.stats,expected.stats,'stats');near(result.stats.heat.capacityJ,expected.heatCapacityJ,'heat.capacityJ');
 check(result.profile.propulsion,expected.propulsion,'profile.propulsion');check(result.unit.propulsion,expected.runtime,'runtime');
 const restored=measure(C.deserialize(C.serialize(ship)));
 check(restored.stats,expected.stats,'round trip stats');near(restored.stats.heat.capacityJ,expected.heatCapacityJ,'round trip heat.capacityJ');
 check(restored.profile.propulsion,expected.propulsion,'round trip profile');check(restored.unit.propulsion,expected.runtime,'round trip runtime');
});

test('retained structural acceleration and inertia constrain the actual input and propulsion heat',()=>{
 const ship=C.deserialize(plain(fixture.cases[0].design)),{stats,profile}=measure(ship),limited=C.propulsionProfile(ship,{...stats,aStruct:100,inertialSupport:stats.mass/2});
 near(limited.structuralAccelerationLimitMps2,100,'structural limit');near(limited.inertialFactor,.5,'inertial factor');near(limited.accelerationLimitMps2,50,'combined limit');
 profile.propulsion=limited;const unit=C.fleetUnit('limited-input','limited-input',profile,0);unit.order={...unit.order,power:'balanced'};unit.maneuver=1;
 C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},.25,'balanced');
 assert.equal(unit.propulsion.structuralInputLimited,true);
 assert.ok(unit.propulsion.actualInputW>0,'the structurally limited engine still receives a physical power allocation');
 assert.ok(unit.propulsion.actualAccelMps2<=50*(1+1e-9),'structure and inertia remain effective in live propulsion');
 const thrustLimit=limited.massKg*limited.accelerationLimitMps2;
 assert.ok(unit.propulsion.actualThrustN<=thrustLimit*(1+1e-9));
 near(unit.propulsion.wasteHeatW,unit.propulsion.actualInputW*.05,'heat uses the limited received input');
});

test('a real attachment diagnosis does not replace the retained framing and longitudinal calculations',()=>{
 const row=fixture.cases.find(r=>r.expected.owned),ship=C.deserialize(plain(row.design)),parent=C.primaryHullPart(ship),child=ship.parts.find(p=>p.id===8);
 child.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'horizontal',parentStructureId:parent.id,geometryRevision:0,parentGeometryRevision:0,contactSide:'bottom',contactNormal:[0,1,0],parentLocalAnchor:C.localStruct(parent,child.c),surfaceAnchor:C.localStruct(parent,[50,30,0]),requestedGeometry:JSON.parse(C.publicJSON(child))};
 const diagnosis=C.placementDiagnostics(ship).find(r=>r.partId===child.id);assert.equal(diagnosis.connected,true);near(diagnosis.area,100,'real contact area');
 const attached=measure(ship);check(attached.stats,row.expected.stats,'attached stats');near(attached.stats.heat.capacityJ,row.expected.heatCapacityJ,'attached heat capacity');check(attached.profile.propulsion,row.expected.propulsion,'attached profile');check(attached.unit.propulsion,row.expected.runtime,'attached runtime');
 child.placement.parentStructureId=999999;assert.equal(C.placementDiagnostics(ship).find(r=>r.partId===child.id).connected,false,'missing attachment references are diagnosed');
 const repair=measure(ship);check(repair.stats,row.expected.stats,'repairable stats');check(repair.unit.propulsion,row.expected.runtime,'repairable runtime');
});

test('longitudinal section failure remains a strength diagnosis rather than an attachment result',()=>{
 const ship=C.newShip({assembly:true,L:100,W:40,H:30},'Separated strength sections');ship.parts=[{id:1,k:'struct',form:'box',c:[10,15,0],s:[10,10,10]},{id:2,k:'struct',form:'box',c:[90,15,0],s:[10,10,10]}];ship.nextId=3;ship.armor={hull:0,cit:0};
 const stats=C.computeStats(ship);assert.equal(stats.cutSection,true);near(stats.aStruct,0,'missing supporting section');
 const warning=stats.warnings.find(w=>JSON.stringify(w).includes('縦強度の断面評価'));
 assert.ok(warning,'the retained warning explicitly identifies the longitudinal section evaluation');
});
