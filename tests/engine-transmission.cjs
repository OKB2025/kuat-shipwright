const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(got,want,epsilon=1e-9)=>assert.ok(Number.isFinite(got)&&Math.abs(got-want)<=Math.max(1,Math.abs(want))*epsilon,`${got} != ${want}`);
function fixture(){
 const ship=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Physical engine transmission');ship.parts=[];ship.fits=[];ship.armor={hull:.01,cit:0};
 ship.parts=[{id:1,k:'gen',c:[200,60,0],d:20},{id:2,k:'battery',c:[100,60,0],d:8},
  {id:3,k:'engine',c:[5,60,0],d:10,nozzleLength:10,reactor:1,dir:[-1,0,0],propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard',ratedInputW:1e18,machineryLengthM:12,machineryRadiusM:3,machineryOffsetM:5,busFeed:true,legacyCoolingInputW:0}];
 ship.parts.push({id:9000,k:'fuel',c:[270,100,50],d:4});ship.nextId=4;ship.links=[{kind:'power',from:'p1',to:'p2',cap:6e17},{kind:'power',from:'p2',to:'p3',cap:9e17}];return ship;
}
function drive(ship){const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship);profile.propulsion={...profile.propulsion,structuralAccelerationLimitMps2:1e9,accelerationLimitMps2:1e9,inertialFactor:1};const unit=C.fleetUnit('transmission','transmission',profile,0);C.heatInit(unit);C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},1,'balanced');return {stats,profile,result:unit.propulsion};}
// Independent expected efficiency from the real path length, not the runtime efficiency helper.
const feedEfficiency=(ship,id=3)=>Math.exp(-1e-5*C.engineTransmission(ship).routes.filter(r=>r.ok&&r.engineIds.includes(id)).reduce((n,r)=>n+r.length,0));
const body=(ship,id=3)=>C.enginePaths(ship).find(p=>p.nozzle===id&&!p.transmission);
const route=(transmission,from,to)=>transmission.routes.find(r=>r.from===from&&r.to===to);
function checkPhysicalRoute(ship,r){
 assert.equal(r.ok,true,r.reason);assert.equal(r.distributedWiring,true);assert.equal(r.model,'automatic-internal-distribution');assert.equal(r.inside,null);assert.equal(r.clear,null);assert.ok(r.length>0&&r.segments.length>0);
 near(Math.PI*r.radius*r.radius,r.capacityW/C.engineTransmission(ship).flux);near(r.area,r.capacityW/C.engineTransmission(ship).flux);near(r.volume,r.area*r.length);near(r.efficiency,Math.exp(-1e-5*r.length));near(r.segments.reduce((n,s)=>n+s.l,0),r.length);
}

test('source, hub and engine use finite internal wiring and one independent machinery body',()=>{
 const ship=fixture(),spec=C.resolveEngineSpec(ship.parts[2],ship),transmission=C.engineTransmission(ship);assert.equal(transmission.routes.length,2);assert.equal(transmission.parts.length,2);
 const trunk=route(transmission,'p1','p2'),branch=route(transmission,'p2','p3');assert.ok(trunk&&branch);near(trunk.capacityW,6e17);near(branch.capacityW,9e17);for(const r of transmission.routes)checkPhysicalRoute(ship,r);
 near(transmission.volume,transmission.routes.reduce((n,r)=>n+r.volume,0));near(transmission.volume,transmission.parts.reduce((n,p)=>n+C.partVolume(p),0));assert.ok(transmission.volume>0);
 const occupied=C.allOccupied(ship),ids=new Set();for(const p of transmission.parts){assert.equal(p.k,'machinery');assert.equal(p.transmission,true);assert.ok(p.id<0&&!ids.has(p.id));ids.add(p.id);assert.ok(!occupied.some(q=>q.id===p.id&&q.transmission));}
 const machinery=body(ship);near(C.partVolume(machinery),spec.effectiveMachineryVolumeM3);near(machinery.machinerySegment.l,12);assert.deepEqual(plain(machinery.c),[16,60,0]);near(spec.ratedInputW,1e18);
 const actual=drive(ship);near(actual.result.actualInputW,6e17*feedEfficiency(ship));assert.ok(actual.profile.propulsion.engines[0].available);for(const p of transmission.parts)assert.equal(actual.stats.info[p.id].overlap,false,'terminal contacts do not disable the installed source or hub');
});

test('touching source and storage retain centre-to-centre wiring loss without requiring a separate connector solid',()=>{
 const ship=fixture(),source=ship.parts.find(p=>p.id===1),hub=ship.parts.find(p=>p.id===2);source.room=[20,20,20];hub.c[0]=186;
 const transmission=C.engineTransmission(ship),trunk=route(transmission,'p1','p2');checkPhysicalRoute(ship,trunk);near(trunk.length,14);near(trunk.capacityW,6e17);assert.ok(trunk.volume>0);
 const {stats,result}=drive(ship);near(result.actualInputW,6e17*feedEfficiency(ship));assert.equal(stats.info[1].overlap,false);assert.equal(stats.info[2].overlap,false);
});

test('a spherical source uses paid equivalent wiring without a spherical terminal packing requirement',()=>{
 const ship=fixture(),hub=ship.parts.find(p=>p.id===2);hub.c[0]=186;const net=C.engineTransmission(ship),trunk=route(net,'p1','p2');checkPhysicalRoute(ship,trunk);near(trunk.length,14);near(trunk.capacityW,6e17);
 const hardware=net.parts.find(p=>p.id===trunk.partId);assert.ok(C.partBuildCost(hardware,trunk.volume)>0);assert.equal(C.allOccupied(ship).some(p=>p.id===hardware.id),false);near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));
});

test('a machinery body crossing the hull skin accepts a finite cable through its actual interior',()=>{
 const ship=fixture();ship.parts.find(p=>p.id===3).c[1]=121;const machinery=body(ship),transmission=C.engineTransmission(ship),branch=route(transmission,'p2','p3');assert.equal(branch.ok,true,branch.reason);near(branch.capacityW,9e17);checkPhysicalRoute(ship,branch,null,q=>C.inPart(machinery,q));near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));
});

test('changing a finite electrical rating changes physical cable size and actual watts without changing engine acceptance',()=>{
 const ship=fixture();ship.links[0].cap=1.5e17;ship.links[1].cap=2e17;const first=C.engineTransmission(ship),spec=C.resolveEngineSpec(ship.parts[2],ship),geometry=plain(body(ship).machinerySegment);assert.equal(C.engineTransmission(ship),first);near(drive(ship).result.actualInputW,1.5e17*feedEfficiency(ship));
 for(const link of ship.links)link.cap*=4;const second=C.engineTransmission(ship);assert.notEqual(second,first);assert.equal(C.engineTransmission(ship),second);
 for(const original of first.routes){const next=route(second,original.from,original.to);near(next.capacityW,original.capacityW*4);near(next.radius,original.radius*2);near(next.area,original.area*4);checkPhysicalRoute(ship,next);}assert.ok(second.volume>first.volume*3.9);
 near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));near(C.resolveEngineSpec(ship.parts[2],ship).ratedInputW,spec.ratedInputW);near(C.resolveEngineSpec(ship.parts[2],ship).maxInputW,spec.maxInputW);assert.deepEqual(plain(body(ship).machinerySegment),geometry);
});

test('a common source trunk is installed once and limits the combined input of separate engines',()=>{
 const ship=fixture(),first=ship.parts.find(p=>p.id===3);first.c[2]=-30;ship.parts.push({...plain(first),id:4,c:[5,60,30]});ship.nextId=5;ship.links.push({kind:'power',from:'p2',to:'p4',cap:9e17});
 const transmission=C.engineTransmission(ship);assert.equal(transmission.routes.length,3);assert.equal(transmission.routes.filter(r=>r.from==='p1'&&r.to==='p2').length,1);near(route(transmission,'p1','p2').capacityW,6e17);near(transmission.volume,transmission.parts.reduce((n,p)=>n+C.partVolume(p),0));
 const {result}=drive(ship),received=3e17*(feedEfficiency(ship,3)+feedEfficiency(ship,4));near(result.actualInputW,received);near(result.engines.reduce((n,e)=>n+e.actualInputW,0),received);assert.ok(result.engines.every(e=>e.actualInputW>0&&e.actualInputW<=9e17));
});

test('propulsion and other consumers share the original finite hub trunk across allocation priority groups',()=>{
 const ship=fixture();ship.parts.push({id:4,k:'cargo',c:[250,60,40],d:10,autoFit:false});ship.nextId=5;ship.links.push({kind:'power',from:'p2',to:'p4',cap:6e17});const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship);
 const run=(engineKind,otherKind,mode)=>C.allocateConnectedPower({sources:[{id:'p1',domain:'main',powerW:1e22}],links:profile.grid.powerPaths,loads:[{id:'engine',kind:engineKind,port:'p3',domain:'main',requestedInputW:6e17},{id:'other',kind:otherKind,port:'p4',domain:'main',requestedInputW:6e17}],mode});
 const peers=run('engines','engines','balanced');near(peers.draw,6e17);near(peers.granted.engine+peers.granted.other+peers.feedLossW,6e17);assert.ok(peers.granted.engine>0&&peers.granted.other>0);
 for(const mode of ['balanced','weapons']){const allocated=run('engines','weapons',mode);near(allocated.draw,6e17);near(allocated.granted.engine+allocated.granted.other+allocated.feedLossW,6e17);near(allocated.granted[mode==='weapons'?'other':'engine'],6e17*(mode==='weapons'?1:feedEfficiency(ship)));near(allocated.granted[mode==='weapons'?'engine':'other'],0);}
});

test('damage to real generated trunk and branch modules cuts only the equipment downstream of that cable',()=>{
 const ship=fixture(),first=ship.parts.find(p=>p.id===3);first.c[2]=-30;ship.parts.push({...plain(first),id:4,c:[5,60,30]});ship.nextId=5;ship.links.push({kind:'power',from:'p2',to:'p4',cap:9e17});
 const transmission=C.engineTransmission(ship),{profile}=drive(ship),trunk=route(transmission,'p1','p2'),branch=route(transmission,'p2','p3');
 const run=damage=>{const unit=C.fleetUnit('cable-damage','cable-damage',profile,0);C.heatInit(unit);for(const [part,fraction]of damage){const index=profile.modules.findIndex(m=>m.part===part);assert.ok(index>=0,'the generated cable has a real combat module');unit.mods[index]=fraction;}C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},1,'balanced');return unit.propulsion;};
 near(run([[trunk.partId,0]]).actualInputW,0);const half=run([[trunk.partId,.5]]);near(half.actualInputW,1.5e17*(feedEfficiency(ship,3)+feedEfficiency(ship,4)));const cut=run([[branch.partId,0]]);near(cut.engines.find(e=>e.id===3).actualInputW,0);near(cut.engines.find(e=>e.id===4).actualInputW,6e17*feedEfficiency(ship,4));near(cut.actualInputW,6e17*feedEfficiency(ship,4));
});

test('internal electrical feeds do not block editable compartments or require a geometric detour',()=>{
 const ship=fixture(),straight=C.engineTransmission(ship),original=route(straight,'p1','p2'),obstacle={id:4,k:'cargo',c:[150,60,0],d:40,room:[20,40,40],corner:0,autoFit:false};ship.parts.push(obstacle);ship.nextId=5;
 for(const room of [[20,40,40],[20,160,120]]){obstacle.room=room;const net=C.engineTransmission(ship),r=route(net,'p1','p2');checkPhysicalRoute(ship,r);near(r.length,original.length);near(r.capacityW,original.capacityW);assert.ok(drive(ship).result.actualInputW>0);}
});

test('a narrow geometric passage leaves the authored internal electrical capacity unchanged',()=>{
 const ship=fixture();Object.assign(ship.parts[2],{ratedInputW:1e22,machineryGradeId:'advanced',machineryRadiusM:5});for(const link of ship.links)link.cap*=1e4;
 for(const sign of [-1,1])ship.parts.push({id:ship.nextId++,k:'cargo',c:[150,60,sign*40.25],d:80,room:[20,79.5,120],corner:0,autoFit:false});
 const net=C.engineTransmission(ship),trunk=route(net,'p1','p2');checkPhysicalRoute(ship,trunk);near(trunk.capacityW,6e21);assert.equal(trunk.limited,false);near(drive(ship).result.actualInputW,trunk.capacityW*feedEfficiency(ship));
});

test('the occupied transmission hardware contributes real mass and cost to the same ship statistics',()=>{
 const ship=fixture();Object.assign(ship.parts[2],{ratedInputW:1e22,machineryGradeId:'advanced',machineryRadiusM:5});for(const link of ship.links)link.cap*=1e4;
 const before=drive(ship),physical=C.engineTransmission(ship),volume=physical.volume,cost=physical.parts.reduce((n,p)=>n+C.partBuildCost(p),0);assert.ok(cost>1000);assert.ok(volume>0);near(physical.cost,cost);near(before.stats.engineTransmissionMass,volume*C.PARTS.machinery.dens);near(before.stats.engineTransmissionVolume,volume);near(before.stats.engineTransmissionCost,cost);ship.links=[];ship.parts.find(p=>p.id===3).reactor=0;
 const without=drive(ship);near(C.engineTransmission(ship).volume,0);near(without.result.actualInputW,0);const massAdded=before.stats.mass-without.stats.mass;assert.ok(massAdded>=volume*(C.PARTS.machinery.dens-C.K.hullDens)-1e-7);assert.ok(massAdded<=volume*C.PARTS.machinery.dens+1e-7,'cable hardware replaces hull material only where another installed body has not already occupied it');assert.ok(Math.abs(before.stats.cost-without.stats.cost-cost)<=1,'the displayed integer build cost includes the real cable cost within final rounding');
 near(C.partVolume(body(ship)),C.resolveEngineSpec(ship.parts[2],ship).effectiveMachineryVolumeM3);
});

test('an exterior engine retains finite internal feed loss, paid wiring mass and its independent visible body',()=>{
 const ship=fixture();Object.assign(ship.parts[2],{c:[-20,60,0],ratedInputW:1e21,machineryGradeId:'advanced'});for(const link of ship.links)link.cap*=1000;
 const before=C.resolveEngineSpec(ship.parts[2],ship),net=C.engineTransmission(ship),branch=route(net,'p2','p3');checkPhysicalRoute(ship,branch);near(branch.capacityW,9e20);assert.equal(branch.entrySegments.length,0);const part=net.parts.find(p=>p.id===branch.partId);assert.equal(C.allOccupied(ship).some(p=>p.id===part.id),false);
 const {stats,result,profile}=drive(ship);near(result.actualInputW,6e20*feedEfficiency(ship));near(stats.engineTransmissionMass,net.volume*C.PARTS.machinery.dens);assert.equal(stats.info[part.id].exposed,0);assert.ok(profile.modules.some(m=>m.part===part.id),'hidden wiring still has finite damage and loss accounting');near(C.resolveEngineSpec(ship.parts[2],ship).effectiveMachineryVolumeM3,before.effectiveMachineryVolumeM3);near(C.partVolume(body(ship)),before.effectiveMachineryVolumeM3);
});

test('saving stores the finite wiring and deterministically rebuilds paths instead of serializing generated machinery',()=>{
 const ship=fixture(),original=C.engineTransmission(ship),saved=plain(C.serialize(ship));assert.equal(saved.parts.some(p=>p.transmission),false);assert.equal(Object.keys(saved).some(k=>k.startsWith('_')),false);
 const loaded=C.deserialize(saved),rebuilt=C.engineTransmission(loaded),canonical=plain(C.serialize(loaded));assert.deepEqual(canonical.parts,saved.parts);assert.deepEqual(canonical.links,saved.links);assert.deepEqual(plain(C.serialize(C.deserialize(canonical))),canonical);assert.deepEqual(plain(rebuilt.routes),plain(original.routes));near(rebuilt.volume,original.volume);near(drive(loaded).result.actualInputW,6e17*feedEfficiency(loaded));
 const geometry=plain(body(loaded).machinerySegment),old=C.engineTransmission(loaded);loaded.parts.find(p=>p.id===1).c[0]=250;const moved=C.engineTransmission(loaded);assert.notEqual(moved,old);assert.ok(route(moved,'p1','p2').length>route(old,'p1','p2').length);assert.deepEqual(plain(body(loaded).machinerySegment),geometry);near(C.resolveEngineSpec(loaded.parts.find(p=>p.id===3),loaded).maxInputW,C.resolveEngineSpec(ship.parts.find(p=>p.id===3),ship).maxInputW);
});

test('removing the authored engine branch restores automatic direct connection',()=>{const ship=fixture();ship.links.splice(1,1);const net=C.engineTransmission(ship),direct=net.routes.find(r=>r.from==='p1'&&r.to==='p3');assert.ok(direct?.automatic&&direct.ok);assert.ok(drive(ship).result.actualInputW>0);});

test('automatic physical routing cannot bridge an isolated electrical domain, while an explicit manual circuit can',()=>{
 const ship=fixture();ship.parts=ship.parts.filter(p=>p.id!==2);const engine=ship.parts.find(p=>p.id===3);delete engine.busFeed;engine.powerIsolation=true;ship.links=[];ship.parts.push({id:4,k:'gen',c:[30,20,50],d:.1,powerDomain:'isolated:3'});ship.nextId=5;
 assert.equal(C.engineTransmission(ship).routes.some(r=>r.from==='p1'&&r.to==='p3'&&r.automatic),false);const isolated=drive(ship);near(isolated.result.actualInputW,0);near(isolated.stats.heat.net.src.filter(s=>s.k==='engine').reduce((n,s)=>n+s.rated.combat,0),0);
 ship.links=[{kind:'power',from:'p1',to:'p3',cap:6e17}];const connected=C.engineTransmission(ship),manual=route(connected,'p1','p3');assert.ok(manual?.ok&&!manual.automatic);near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));
});
