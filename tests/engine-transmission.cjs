const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(got,want,epsilon=1e-9)=>assert.ok(Number.isFinite(got)&&Math.abs(got-want)<=Math.max(1,Math.abs(want))*epsilon,`${got} != ${want}`);
function fixture(){
 const ship=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Physical engine transmission');ship.parts=[];ship.fits=[];ship.armor={hull:.01,cit:0};
 ship.parts=[{id:1,k:'gen',c:[200,60,0],d:20},{id:2,k:'battery',c:[100,60,0],d:8},
  {id:3,k:'engine',c:[5,60,0],d:10,nozzleLength:10,reactor:1,dir:[-1,0,0],propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard',ratedInputW:1e18,machineryLengthM:12,machineryRadiusM:3,machineryOffsetM:5,busFeed:true,legacyCoolingInputW:0}];
 ship.nextId=4;ship.links=[{kind:'power',from:'p1',to:'p2',cap:6e17},{kind:'power',from:'p2',to:'p3',cap:9e17}];return ship;
}
function drive(ship){const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship),unit=C.fleetUnit('transmission','transmission',profile,0);C.heatInit(unit);C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},1,'balanced');return {stats,profile,result:unit.propulsion};}
// Independent expected efficiency from the real path length, not the runtime efficiency helper.
const feedEfficiency=(ship,id=3)=>Math.exp(-1e-5*C.engineTransmission(ship).routes.filter(r=>r.ok&&r.engineIds.includes(id)).reduce((n,r)=>n+r.length,0));
const body=(ship,id=3)=>C.enginePaths(ship).find(p=>p.nozzle===id&&!p.transmission);
const route=(transmission,from,to)=>transmission.routes.find(r=>r.from===from&&r.to===to);
function checkPhysicalRoute(ship,r,obstacle,extraEnvelope){
 assert.equal(r.ok,true,r.reason);assert.ok(r.length>0&&r.segments.length>0);near(Math.PI*r.radius*r.radius,r.capacityW/C.engineTransmission(ship).flux);near(r.area,r.capacityW/C.engineTransmission(ship).flux);near(r.volume,r.area*r.length);
 let length=0;for(const segment of r.segments){near(segment.r0,r.radius);near(segment.r1,r.radius);length+=segment.l;
  for(let step=0;step<=16;step++)for(let spoke=0;spoke<12;spoke++){
   const angle=2*Math.PI*spoke/12,q=C.add(C.add(segment.a,C.mul(segment.u,segment.l*step/16)),C.add(C.mul(segment.v,r.radius*Math.cos(angle)),C.mul(segment.w,r.radius*Math.sin(angle))));
   assert.ok(q.every(Number.isFinite));assert.ok(C.insideOriginalEnvelope(ship,q)||extraEnvelope?.(q),'the full cable cross-section remains inside the real ship envelope');if(obstacle)assert.equal(C.inPart(obstacle,q),false,'the physical cable clears the obstacle');
  }
 }near(length,r.length);
}

test('source, hub and engine are joined by real capacity-sized hardware with an independent machinery body',()=>{
 const ship=fixture(),spec=C.resolveEngineSpec(ship.parts[2],ship),transmission=C.engineTransmission(ship);assert.equal(transmission.routes.length,2);assert.equal(transmission.parts.length,2);
 const trunk=route(transmission,'p1','p2'),branch=route(transmission,'p2','p3');assert.ok(trunk&&branch);near(trunk.capacityW,6e17);near(branch.capacityW,9e17);for(const r of transmission.routes)checkPhysicalRoute(ship,r);
 near(transmission.volume,transmission.routes.reduce((n,r)=>n+r.volume,0));near(transmission.volume,transmission.parts.reduce((n,p)=>n+C.partVolume(p),0));assert.ok(transmission.volume>0);
 const occupied=C.allOccupied(ship),ids=new Set();for(const p of transmission.parts){assert.equal(p.k,'machinery');assert.equal(p.transmission,true);assert.ok(p.id<0&&!ids.has(p.id));ids.add(p.id);assert.ok(occupied.some(q=>q.id===p.id&&q.transmission));}
 const machinery=body(ship);near(C.partVolume(machinery),spec.effectiveMachineryVolumeM3);near(machinery.machinerySegment.l,12);assert.deepEqual(plain(machinery.c),[16,60,0]);near(spec.ratedInputW,1e18);
 const actual=drive(ship);near(actual.result.actualInputW,6e17*feedEfficiency(ship));assert.ok(actual.profile.propulsion.engines[0].available);for(const p of transmission.parts)assert.equal(actual.stats.info[p.id].overlap,false,'terminal contacts do not disable the installed source or hub');
});

test('a source touching its distribution hub transfers finite power through the shared contact face',()=>{
 const ship=fixture(),source=ship.parts.find(p=>p.id===1),hub=ship.parts.find(p=>p.id===2);source.room=[20,20,20];hub.c[0]=186;
 const transmission=C.engineTransmission(ship),trunk=route(transmission,'p1','p2'),branch=route(transmission,'p2','p3');assert.equal(trunk.ok,true);near(trunk.length,0);near(trunk.volume,0);near(trunk.capacityW,6e17);assert.equal(branch.ok,true);near(transmission.volume,branch.volume);
 // Two real flat faces share the entire finite circular interface. A sphere
 // merely tangent to a plane shares one point and cannot use this exemption.
 for(let i=0;i<32;i++){const angle=i*Math.PI/16,q=[190,60+trunk.radius*Math.cos(angle),trunk.radius*Math.sin(angle)];assert.ok(C.inPart(source,q));assert.ok(C.inPart(hub,q));}
 const {stats,result}=drive(ship);near(result.actualInputW,6e17*feedEfficiency(ship));assert.equal(stats.info[1].overlap,false);assert.equal(stats.info[2].overlap,false);
});

test('a spherical source tangent to a flat hub installs a paid connector through a complete interior chord',()=>{
 const ship=fixture(),source=ship.parts.find(p=>p.id===1),hub=ship.parts.find(p=>p.id===2);hub.c[0]=186;
 const transmission=C.engineTransmission(ship),trunk=route(transmission,'p1','p2'),branch=route(transmission,'p2','p3'),minimumDepth=source.d/2-Math.sqrt((source.d/2)**2-trunk.radius**2);
 assert.equal(trunk.ok,true);near(trunk.capacityW,6e17);assert.ok(trunk.length>=minimumDepth&&trunk.length<minimumDepth+.01);assert.ok(trunk.volume>0);near(trunk.volume,trunk.area*trunk.length);near(trunk.efficiency,Math.exp(-1e-5*trunk.length));assert.ok(trunk.efficiency<1);
 const hardware=transmission.parts.find(p=>p.from==='p1'&&p.to==='p2');assert.ok(hardware);assert.ok(C.partBuildCost(hardware,trunk.volume)>0);near(transmission.volume,trunk.volume+branch.volume);
 for(const [segment,end,host] of [[trunk.segments[0],'a',source],[trunk.segments.at(-1),'b',hub]])for(let i=0;i<32;i++){const angle=i*Math.PI/16,q=C.add(segment[end],C.add(C.mul(segment.v,trunk.radius*Math.cos(angle)),C.mul(segment.w,trunk.radius*Math.sin(angle))));assert.ok(C.inPart(host,q),'the complete paid terminal circle is inside its actual host');}
 const {stats,result}=drive(ship);near(result.actualInputW,6e17*feedEfficiency(ship));assert.equal(stats.info[1].overlap,false);assert.equal(stats.info[2].overlap,false);
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

test('routes go around fixed equipment, and a full bulkhead cannot be bypassed through outside space',()=>{
 const ship=fixture(),straight=C.engineTransmission(ship),original=route(straight,'p1','p2');const obstacle={id:4,k:'cargo',c:[150,60,0],d:40,room:[20,40,40],corner:0,autoFit:false};ship.parts.push(obstacle);ship.nextId=5;
 const detour=C.engineTransmission(ship),routed=route(detour,'p1','p2');assert.notEqual(detour,straight);checkPhysicalRoute(ship,routed,obstacle);assert.ok(routed.length>original.length+1);assert.ok(routed.volume>original.volume);near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));
 obstacle.room=[20,160,120];const blocked=C.engineTransmission(ship);assert.notEqual(blocked,detour);const trunk=route(blocked,'p1','p2');assert.ok(trunk&&!trunk.ok,'the full-width obstruction leaves no physical route');assert.ok(trunk.reason);near(drive(ship).result.actualInputW,0);
});

test('a passage that is too narrow for rated cable cross-section reduces the actual transmission capacity',()=>{
 const ship=fixture();Object.assign(ship.parts[2],{ratedInputW:1e22,machineryGradeId:'advanced',machineryRadiusM:5});for(const link of ship.links)link.cap*=1e4;
 for(const sign of [-1,1])ship.parts.push({id:ship.nextId++,k:'cargo',c:[150,60,sign*40.25],d:80,room:[20,79.5,120],corner:0,autoFit:false});
 const transmission=C.engineTransmission(ship),trunk=route(transmission,'p1','p2');assert.equal(trunk.ok,true);assert.ok(trunk.capacityW>0&&trunk.capacityW<6e21);assert.ok(trunk.radius<.5,'the installed diameter fits the one-metre opening');assert.equal(trunk.limited,true);checkPhysicalRoute(ship,trunk);
 for(const obstacle of ship.parts.filter(p=>p.k==='cargo'))checkPhysicalRoute(ship,trunk,obstacle);near(drive(ship).result.actualInputW,trunk.capacityW*feedEfficiency(ship));
});

test('the occupied transmission hardware contributes real mass and cost to the same ship statistics',()=>{
 const ship=fixture();Object.assign(ship.parts[2],{ratedInputW:1e22,machineryGradeId:'advanced',machineryRadiusM:5});for(const link of ship.links)link.cap*=1e4;
 const before=drive(ship),physical=C.engineTransmission(ship),volume=physical.volume,cost=physical.parts.reduce((n,p)=>n+C.partBuildCost(p),0);assert.ok(cost>1000);assert.ok(volume>0);near(physical.cost,cost);near(before.stats.engineTransmissionMass,volume*C.PARTS.machinery.dens);near(before.stats.engineTransmissionVolume,volume);near(before.stats.engineTransmissionCost,cost);ship.links=[];
 const without=drive(ship);near(C.engineTransmission(ship).volume,0);near(without.result.actualInputW,0);const massAdded=before.stats.mass-without.stats.mass;assert.ok(massAdded>=volume*(C.PARTS.machinery.dens-C.K.hullDens)-1e-7);assert.ok(massAdded<=volume*C.PARTS.machinery.dens+1e-7,'cable hardware replaces hull material only where another installed body has not already occupied it');assert.ok(Math.abs(before.stats.cost-without.stats.cost-cost)<=1,'the displayed integer build cost includes the real cable cost within final rounding');
 near(C.partVolume(body(ship)),C.resolveEngineSpec(ship.parts[2],ship).effectiveMachineryVolumeM3);
});

test('an isolated exterior machinery body gets a real finite entry pipe with occupied volume, mass and picking',()=>{
 const ship=fixture();Object.assign(ship.parts[2],{c:[-20,60,0],ratedInputW:1e21,machineryGradeId:'advanced'});for(const link of ship.links)link.cap*=1000;
 const machinery=body(ship),before=C.resolveEngineSpec(ship.parts[2],ship),transmission=C.engineTransmission(ship),branch=route(transmission,'p2','p3');assert.equal(branch.ok,true,branch.reason);near(branch.capacityW,9e20);assert.ok(branch.entrySegments.length>0);const part=transmission.parts.find(p=>p.id===branch.partId),entry=branch.entrySegments[0],gap=[-1.5,60,0];
 assert.equal(C.insideOriginalEnvelope(ship,gap),false);assert.equal(C.inPart(machinery,gap),false);assert.equal(C.inPart(part,gap),true,'the cable occupies the real gap instead of granting invisible outside space');assert.ok(entry.housing&&entry.exteriorEntry);assert.ok(C.insideOriginalEnvelope(ship,entry.hullContact));checkPhysicalRoute(ship,branch,null,q=>C.inPart(machinery,q)||branch.entrySegments.some(s=>C.inRoute(s,q)));
 const housingVolume=branch.entrySegments.reduce((n,s)=>n+Math.PI*s.r0*s.r0*s.l,0);assert.ok(housingVolume>0);near(C.partVolume(part),branch.volume);assert.ok(branch.volume>=housingVolume);near(transmission.volume,transmission.parts.reduce((n,p)=>n+C.partVolume(p),0));
 const origin=C.add(gap,C.mul(entry.v,branch.radius*3)),hit=C.rayPart(origin,C.mul(entry.v,-1),part);assert.ok(hit);near(hit.t,branch.radius*2);const {stats,result}=drive(ship);near(result.actualInputW,6e20*feedEfficiency(ship));near(stats.engineTransmissionMass,transmission.volume*C.PARTS.machinery.dens);assert.ok(stats.info[part.id].exposed>0,'the declared outside pipe contributes an exposed physical surface');near(C.resolveEngineSpec(ship.parts[2],ship).effectiveMachineryVolumeM3,before.effectiveMachineryVolumeM3);near(C.partVolume(machinery),before.effectiveMachineryVolumeM3);
 const obstacle={id:ship.nextId++,k:'sensor',c:gap.slice(),d:2,autoFit:false};ship.parts.push(obstacle);const detour=C.engineTransmission(ship),rerouted=route(detour,'p2','p3');assert.equal(rerouted.ok,true,'a local obstruction still leaves space for a paid physical detour');near(rerouted.capacityW,branch.capacityW);assert.ok(rerouted.length>branch.length&&rerouted.volume>branch.volume);checkPhysicalRoute(ship,rerouted,obstacle,q=>C.inPart(machinery,q)||rerouted.entrySegments.some(s=>C.inRoute(s,q)));
 for(const segment of rerouted.segments)for(let step=0;step<=64;step++)for(let spoke=0;spoke<32;spoke++){const angle=2*Math.PI*spoke/32,q=C.add(C.add(segment.a,C.mul(segment.u,segment.l*step/64)),C.add(C.mul(segment.v,rerouted.radius*Math.cos(angle)),C.mul(segment.w,rerouted.radius*Math.sin(angle))));assert.equal(C.inPart(obstacle,q),false,'every sampled finite pipe ring clears the actual external sensor');assert.ok(Math.hypot(...q.map((v,i)=>v-obstacle.c[i]))>=obstacle.d/2-1e-8,'the ring also clears the sensor sphere independently');}near(drive(ship).result.actualInputW,6e20*feedEfficiency(ship));
 Object.assign(obstacle,{room:[1,160,120],corner:0});const blocked=C.engineTransmission(ship);assert.ok(C.partVolume(obstacle)>0,'the full thin equipment plate is real occupied hardware');assert.equal(route(blocked,'p2','p3').ok,false,'a full plate across the gap leaves no physical entry route');near(drive(ship).result.actualInputW,0);
});

test('saving stores the finite wiring and deterministically rebuilds paths instead of serializing generated machinery',()=>{
 const ship=fixture(),original=C.engineTransmission(ship),saved=plain(C.serialize(ship));assert.equal(saved.parts.some(p=>p.transmission),false);assert.equal(Object.keys(saved).some(k=>k.startsWith('_')),false);
 const loaded=C.deserialize(saved),rebuilt=C.engineTransmission(loaded),canonical=plain(C.serialize(loaded));assert.deepEqual(canonical.parts,saved.parts);assert.deepEqual(canonical.links,saved.links);assert.deepEqual(plain(C.serialize(C.deserialize(canonical))),canonical);assert.deepEqual(plain(rebuilt.routes),plain(original.routes));near(rebuilt.volume,original.volume);near(drive(loaded).result.actualInputW,6e17*feedEfficiency(loaded));
 const geometry=plain(body(loaded).machinerySegment),old=C.engineTransmission(loaded);loaded.parts.find(p=>p.id===1).c[0]=250;const moved=C.engineTransmission(loaded);assert.notEqual(moved,old);assert.ok(route(moved,'p1','p2').length>route(old,'p1','p2').length);assert.deepEqual(plain(body(loaded).machinerySegment),geometry);near(C.resolveEngineSpec(loaded.parts.find(p=>p.id===3),loaded).maxInputW,C.resolveEngineSpec(ship.parts.find(p=>p.id===3),ship).maxInputW);
});

test('disconnecting either bus edge leaves no alternate automatic source path',()=>{
 for(const edge of [0,1]){const ship=fixture();ship.links.splice(edge,1);const {stats,result}=drive(ship);near(result.actualInputW,0);near(result.actualThrustN,0);near(result.wasteHeatW,0);assert.equal(stats.heat.powerPaths.some(l=>l.to==='p3'&&l.auto&&l.ok),false);}
});

test('automatic physical routing cannot bridge an isolated electrical domain, while an explicit manual circuit can',()=>{
 const ship=fixture();ship.parts=ship.parts.filter(p=>p.id!==2);const engine=ship.parts.find(p=>p.id===3);delete engine.busFeed;engine.powerIsolation=true;ship.links=[];ship.parts.push({id:4,k:'gen',c:[30,20,50],d:.1,powerDomain:'isolated:3'});ship.nextId=5;
 assert.equal(C.engineTransmission(ship).routes.some(r=>r.from==='p1'&&r.to==='p3'&&r.automatic),false);const isolated=drive(ship);near(isolated.result.actualInputW,0);near(isolated.stats.heat.net.src.filter(s=>s.k==='engine').reduce((n,s)=>n+s.rated.combat,0),0);
 ship.links=[{kind:'power',from:'p1',to:'p3',cap:6e17}];const connected=C.engineTransmission(ship),manual=route(connected,'p1','p3');assert.ok(manual?.ok&&!manual.automatic);near(drive(ship).result.actualInputW,6e17*feedEfficiency(ship));
});
