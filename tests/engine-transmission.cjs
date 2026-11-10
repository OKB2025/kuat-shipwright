const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(got,want,epsilon=1e-9)=>assert.ok(Number.isFinite(got)&&Math.abs(got-want)<=Math.max(1,Math.abs(want))*epsilon,`${got} != ${want}`);
// v24 Reactors deliver only what feed equipment supplies (tests/helpers/reactant-feed.cjs).
const {addReactantFeed}=require('./helpers/reactant-feed.cjs'),fixture=(...args)=>{const ship=fixtureWithoutFeed(...args);addReactantFeed(C,ship);return ship;};
function fixtureWithoutFeed(){
 const ship=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Physical engine transmission');ship.parts=[];ship.fits=[];ship.armor={hull:.01,cit:0};
 ship.parts=[{id:1,k:'gen',c:[200,60,0],d:20},{id:2,k:'fuel',c:[100,60,0],d:8},
  {id:3,k:'engine',c:[5,60,0],d:10,nozzleLength:10,reactor:1,dir:[-1,0,0],propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard',ratedInputW:1e18,machineryLengthM:12,machineryRadiusM:3,machineryOffsetM:5,busFeed:true,legacyCoolingInputW:0}];
 ship.parts.push({id:9000,k:'fuel',c:[270,100,50],d:4});ship.nextId=4;ship.links=[{kind:'power',from:'p1',to:'p2',cap:6e17},{kind:'power',from:'p2',to:'p3',cap:9e17}];return ship;
}
function drive(ship){const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship);profile.propulsion={...profile.propulsion,structuralAccelerationLimitMps2:1e9,accelerationLimitMps2:1e9,inertialFactor:1};const unit=C.fleetUnit('transmission','transmission',profile,0);C.heatInit(unit);C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},1,'balanced');return {stats,profile,result:unit.propulsion};}
// Independent expected efficiency from the real path length, not the runtime efficiency helper.
const feedEfficiency=(ship,id=3)=>Math.exp(-1e-5*C.engineTransmission(ship).routes.filter(r=>r.ok&&r.engineIds.includes(id)).reduce((n,r)=>n+r.length,0));
const body=(ship,id=3)=>C.enginePaths(ship).find(p=>p.nozzle===id&&!p.transmission);
const route=(transmission,from,to)=>transmission.routes.find(r=>r.from===from&&r.to===to);
function checkNumericalRoute(ship,r){
 assert.equal(r.ok,true,r.reason);assert.equal(r.model,'source-distance');assert.equal(r.kind,'electrical');assert.ok(r.length>=0);near(r.efficiency,Math.exp(-1e-5*r.length));near(r.volume,0);assert.equal(r.partId,undefined);assert.equal(r.path,undefined);assert.equal(r.segments,undefined);assert.equal(r.radius,undefined);
}
test('source, shared hub and machinery use distance-only supply with no generated cable hardware',()=>{
 const ship=fixture(),net=C.engineTransmission(ship);assert.equal(net.routes.length,2);assert.equal(net.parts.length,0);for(const r of net.routes)checkNumericalRoute(ship,r);near(route(net,'p1','p2').length,100);near(route(net,'p2','p3').length,84);for(const k of ['volume','massTonnes','cost'])near(net[k],0);
 const actual=drive(ship);near(actual.result.actualInputW,6e17*Math.exp(-1e-5*184));assert.ok(actual.profile.propulsion.engines[0].available);assert.equal(actual.profile.modules.some(m=>m.k==='conduit'),false);near(actual.stats.engineTransmissionVolume,0);near(actual.stats.engineTransmissionMass,0);near(actual.stats.engineTransmissionCost,0);
 near(C.partVolume(body(ship)),C.resolveEngineSpec(ship.parts[2],ship).effectiveMachineryVolumeM3);
});
test('electrical ratings limit actual watts without creating area, volume, mass or installation cost',()=>{
 const ship=fixture(),spec=C.resolveEngineSpec(ship.parts[2],ship),geometry=plain(body(ship).machinerySegment);ship.links[0].cap=1.5e17;ship.links[1].cap=2e17;const first=C.engineTransmission(ship);near(drive(ship).result.actualInputW,1.5e17*feedEfficiency(ship));for(const l of ship.links)l.cap*=4;const second=C.engineTransmission(ship);assert.notEqual(second,first);for(const r of second.routes)checkNumericalRoute(ship,r);near(second.volume,0);near(second.cost,0);near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));near(C.resolveEngineSpec(ship.parts[2],ship).maxInputW,spec.maxInputW);assert.deepEqual(plain(body(ship).machinerySegment),geometry);
});
test('a shared supply trunk limits the combined input of separate engine bodies once',()=>{
 const ship=fixture(),first=ship.parts.find(p=>p.id===3);first.c[2]=-30;ship.parts.push({...plain(first),id:4,c:[5,60,30]});ship.links.push({kind:'power',from:'p2',to:'p4',cap:9e17});const net=C.engineTransmission(ship);assert.equal(net.routes.length,3);assert.equal(net.routes.filter(r=>r.from==='p1'&&r.to==='p2').length,1);near(route(net,'p1','p2').capacityW,6e17);const {result}=drive(ship);near(result.actualInputW,3e17*(feedEfficiency(ship,3)+feedEfficiency(ship,4)));near(result.power.draw,result.power.delivered+result.power.feedLossW);
});
test('the real shared hub retains downstream damage while no independent cable damage modules exist',()=>{
 const ship=fixture(),{profile}=drive(ship);assert.equal(profile.modules.some(m=>m.k==='conduit'),false);const unit=C.fleetUnit('hub','hub',profile,0),i=profile.modules.findIndex(m=>m.part===2);assert.ok(i>=0);C.heatInit(unit);unit.mods[i]=0;C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},1,'balanced');near(unit.propulsion.actualInputW,0);
});
test('obstacles and narrow hull passages do not start electrical routing or change the source distance',()=>{
 const ship=fixture(),before=plain(C.engineTransmission(ship));ship.parts.push({id:4,k:'cargo',c:[150,60,0],d:40,room:[20,160,120],autoFit:false});const net=C.engineTransmission(ship);assert.deepEqual(plain(net.routes),before.routes);near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));
});
test('moving the source changes loss and heat without changing machinery or adding cable mass',()=>{
 const ship=fixture(),first=drive(ship),geometry=plain(body(ship).machinerySegment),before=C.engineTransmission(ship);ship.parts[0].c[0]=250;const after=C.engineTransmission(ship),second=drive(ship);assert.ok(route(after,'p1','p2').length>route(before,'p1','p2').length);assert.ok(second.result.actualInputW<first.result.actualInputW);assert.ok(second.result.power.feedLossW>first.result.power.feedLossW);near(second.stats.mass,first.stats.mass);near(second.stats.cost,first.stats.cost);assert.deepEqual(plain(body(ship).machinerySegment),geometry);
});
test('saved endpoint connections rebuild deterministically without serializing any generated cable',()=>{
 const ship=fixture(),before=C.engineTransmission(ship),saved=plain(C.serialize(ship));assert.ok(saved.parts.every(p=>p.id>0));assert.equal(Object.keys(saved).some(k=>k.startsWith('_')),false);const loaded=C.deserialize(saved),rebuilt=C.engineTransmission(loaded);assert.deepEqual(plain(C.serialize(loaded).parts),saved.parts);assert.deepEqual(plain(C.serialize(loaded).links),saved.links);assert.deepEqual(plain(rebuilt.routes),plain(before.routes));assert.deepEqual(plain(rebuilt.parts),[]);near(drive(loaded).result.actualInputW,6e17*feedEfficiency(loaded));
});
test('removing the authored engine branch restores automatic direct connection',()=>{const ship=fixture();ship.links.splice(1,1);const direct=C.engineTransmission(ship).routes.find(r=>r.from==='p1'&&r.to==='p3');assert.ok(direct?.automatic&&direct.ok);assert.ok(drive(ship).result.actualInputW>0);});
test('isolated electrical domains remain isolated unless explicitly connected',()=>{
 const ship=fixture();ship.parts=ship.parts.filter(p=>p.id!==2);const engine=ship.parts.find(p=>p.id===3);delete engine.busFeed;engine.powerIsolation=true;ship.links=[];ship.parts.push({id:4,k:'gen',c:[30,20,50],d:.1,powerDomain:'isolated:3'});assert.equal(C.engineTransmission(ship).routes.some(r=>r.from==='p1'&&r.to==='p3'&&r.automatic),false);near(drive(ship).result.actualInputW,0);ship.links=[{kind:'power',from:'p1',to:'p3',cap:6e17}];const manual=route(C.engineTransmission(ship),'p1','p3');assert.ok(manual?.ok&&!manual.automatic);near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));
});
