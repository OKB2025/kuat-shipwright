const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`);
function emptyShip(){const s=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Engineering fixture');s.parts=[];s.fits=[];s.armor={hull:.01,cit:0};return s;}
function busFixture(){
 const s=emptyShip();s.parts=[
  {id:1,k:'gen',c:[200,60,0],d:20},
  {id:2,k:'battery',c:[100,60,0],d:8},
  {id:3,k:'engine',c:[5,60,0],d:10,nozzleLength:10,reactor:1,dir:[-1,0,0],propulsionModelVersion:1,driveProfileId:'standard',machineryGradeId:'standard',ratedInputW:1e18,machineryLengthM:12,machineryRadiusM:3,machineryOffsetM:5,busFeed:true,legacyCoolingInputW:0}
 ];s.nextId=4;s.links=[{kind:'power',from:'p1',to:'p2',cap:6e17},{kind:'power',from:'p2',to:'p3',cap:9e17}];return s;
}
function coldPropulsion(ship){const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship),unit=C.fleetUnit('engineering','engineering',profile,0);C.heatInit(unit);C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons:0},1,'balanced');return {stats,profile,unit,result:unit.propulsion};}

test('rectangular auxiliary reactors and inertial rooms use their retained physical volume and survive save/load',()=>{
 const ship=emptyShip(),full=C.placePart(ship,'aux',[100,60,0],20,{room:[20,12,10],corner:0,autoFit:false}),clipped=C.placePart(ship,'aux',[299,60,0],20,{room:[20,12,10],corner:0,autoFit:false}),inertial=C.placePart(ship,'inertial',[180,60,40],10,{room:[10,8,6],corner:0,autoFit:false});C.syncCompartments(ship);
 near(C.partVolume(inertial),480);const support=C.computeStats(ship);near(support.inertialSupport,480*120*support.fieldGain);
 near(C.partVolume(full),2400);assert.ok(clipped._clip);const retained=C.partVolume(clipped);assert.ok(retained>0&&retained<2400);near(retained,C.meshVolume(clipped._clip.tris),1e-7);
 for(const reactor of [full,clipped]){assert.equal(C.isReactor(reactor),true);near(C.reactorPower(reactor),C.partVolume(reactor)*C.REACTOR_POWER_DENSITY);}
 assert.ok(C.reactorPower(clipped)<C.reactorPower(full),'the nominal room cannot earn output for its portion outside the hull');
 const loaded=C.deserialize(JSON.parse(JSON.stringify(C.serialize(ship))));C.syncCompartments(loaded);
 for(const p of [full,clipped]){const q=loaded.parts.find(q=>q.id===p.id);assert.deepEqual(plain(q.room),[20,12,10]);assert.equal(q.autoFit,false);near(C.partVolume(q),C.partVolume(p));near(C.reactorPower(q),C.reactorPower(p));}
 const loadedInertial=loaded.parts.find(p=>p.id===inertial.id);assert.deepEqual(plain(loadedInertial.room),[10,8,6]);near(C.partVolume(loadedInertial),480);const loadedSupport=C.computeStats(loaded);near(loadedSupport.inertialSupport,support.inertialSupport);
});
test('bus-fed engines receive only finite source-to-hub-to-engine power and preserve that wiring on load',()=>{
 const ship=busFixture(),{stats,profile,result}=coldPropulsion(ship);assert.equal(profile.propulsion.engines[0].available,true);near(result.actualInputW,6e17);near(result.actualThrustN,6e17/C.DRIVE_PROFILES.standard.wattsPerNewton);near(result.wasteHeatW,6e17*C.PROPULSION.wasteFraction);
 assert.ok(stats.heat.powerPaths.some(l=>l.from==='p1'&&l.to==='p2'&&l.cap===6e17&&!l.auto));assert.ok(stats.heat.powerPaths.some(l=>l.from==='p2'&&l.to==='p3'&&l.cap===9e17&&!l.auto));assert.equal(stats.heat.powerPaths.some(l=>l.to==='p3'&&l.auto&&l.ok),false,'no automatic direct reactor feed bypasses the bus');
 const loaded=C.deserialize(JSON.parse(JSON.stringify(C.serialize(ship))));assert.equal(loaded.parts.find(p=>p.id===3).busFeed,true);const originalSpec=C.resolveEngineSpec(ship.parts.find(p=>p.id===3),ship),loadedSpec=C.resolveEngineSpec(loaded.parts.find(p=>p.id===3),loaded);for(const key of ['ratedInputW','ratedThrustN','machineryVolumeM3','machineryLengthM','machineryRadiusM','machineryOffsetM'])near(loadedSpec[key],originalSpec[key]);assert.deepEqual(plain(loaded.links),plain(ship.links));near(coldPropulsion(loaded).result.actualInputW,6e17);
});
test('removing bus power paths or closing the source trunk stops actual watts, force and engine heat',()=>{
 for(const change of ['all','zero-capacity','source-trunk']){const ship=busFixture();if(change==='all')ship.links=[];else if(change==='zero-capacity')ship.links[0].cap=0;else ship.links=ship.links.filter(l=>l.from!=='p1');const {result}=coldPropulsion(ship);near(result.actualInputW,0);near(result.actualThrustN,0);near(result.wasteHeatW,0);}
});
test('bus-fed machinery occupies only the short body and its actual midpoint regardless of reactor distance',()=>{
 const ship=busFixture(),body=C.enginePaths(ship).find(p=>p.nozzle===3),spec=C.resolveEngineSpec(ship.parts[2],ship);assert.ok(body);assert.equal(body.connectionSegments.length,0);assert.equal(body.segments.length,1);near(body.machinerySegment.l,12);assert.deepEqual(plain(body.c),[16,60,0]);assert.deepEqual(plain(body.c),plain(C.mul(C.add(body.machinerySegment.a,body.machinerySegment.b),.5)));near(C.partVolume(body),spec.effectiveMachineryVolumeM3);near(C.partVolume(body),Math.PI*12*3*3*(.78*.78+.78+1)/3);
 const shape=plain({c:body.c,a:body.machinerySegment.a,b:body.machinerySegment.b}),volume=C.partVolume(body);ship.parts[0].c[0]=250;const moved=C.enginePaths(ship).find(p=>p.nozzle===3);assert.deepEqual(plain({c:moved.c,a:moved.machinerySegment.a,b:moved.machinerySegment.b}),shape);near(C.partVolume(moved),volume);near(C.resolveEngineSpec(ship.parts[2],ship).ratedInputW,1e18);
});

test('ordinary reactor-fed engines retain automatic power and their authored rating through save/load',()=>{
 const ship=busFixture();ship.parts=ship.parts.filter(p=>p.id!==2);delete ship.parts.find(p=>p.id===3).busFeed;ship.links=[];
 const before=C.resolveEngineSpec(ship.parts.find(p=>p.id===3),ship),run=coldPropulsion(ship);assert.ok(run.stats.heat.powerPaths.some(l=>l.from==='p1'&&l.to==='p3'&&l.auto&&l.ok));near(run.result.actualInputW,1e18);assert.equal(C.enginePaths(ship)[0].connectionSegments.length,1);
 const loaded=C.deserialize(JSON.parse(JSON.stringify(C.serialize(ship)))),after=C.resolveEngineSpec(loaded.parts.find(p=>p.id===3),loaded);for(const key of ['ratedInputW','ratedThrustN','machineryVolumeM3','maxInputW'])near(after[key],before[key]);assert.equal(loaded.parts.find(p=>p.id===3).busFeed,undefined);near(coldPropulsion(loaded).result.actualInputW,1e18);
});

test('a complete stock engineering refit preserves the original reactors and lets weapon demand compete for finite power',()=>{
 const ship=busFixture(),engine=ship.parts.find(p=>p.id===3);Object.assign(engine,{ratedInputW:8e21,machineryGradeId:'advanced',machineryLengthM:20,machineryRadiusM:4});
 C.placePart(ship,'aux',[240,60,50],8,{room:[8,6,4],corner:0,autoFit:false});
 C.placePart(ship,'inertial',[140,60,40],20,{room:[30,20,20],corner:0,autoFit:false});C.placePart(ship,'integrity',[140,60,-40],20,{room:[30,20,20],corner:0,autoFit:false});
 const gun={id:ship.nextId++,k:'single40',p:[160,120,0],a:2,mountMode:'top',ped:0,base:0,low:0,float:false};C.mountFit(ship,gun);ship.fits.push(gun);C.syncCompartments(ship);
 const reactors=()=>ship.parts.filter(C.isReactor).map(p=>({id:p.id,k:p.k,volume:C.partVolume(p),power:C.reactorPower(p),d:p.d,room:p.room?plain(p.room):undefined})),original=reactors(),gunBefore=plain(C.fitSpec(gun)),originalPower=original.reduce((n,p)=>n+p.power,0);
 assert.equal(C.refitShipSystems(ship,'engineering-fixture'),ship);const meta=ship.shipSystemRefit;assert.ok(meta&&meta.version===1);assert.deepEqual(reactors(),original);assert.deepEqual(plain(meta.addedReactors),[]);near(meta.baselinePowerW,originalPower);near(meta.installedPowerW,originalPower);
 const gunAfter=C.fitSpec(gun);for(const key of ['tt','ion','power','cycle','barrels','boltTT'])near(gunAfter[key]||0,gunBefore[key]||0);near(meta.fullWeaponInputW,gunBefore.power/C.ENERGY_MODEL.eta);const wiredWeaponInput=ship.links.filter(l=>l.kind==='power'&&l.to==='f'+gun.id).reduce((n,l)=>n+l.cap,0);near(meta.availableWeaponInputW,wiredWeaponInput);assert.ok(wiredWeaponInput>0&&wiredWeaponInput<=meta.weaponBusBudgetW*(1+1e-10),'the real charging branch fits the shared finite plant budget');assert.equal(gun.chargeScale,undefined);assert.equal(gun.chargeSalvos,undefined);
 const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship),run=weapons=>{const unit=C.fleetUnit('refit','refit',profile,0);C.heatInit(unit);C.allocateShipPower(unit,C.fleetSystems(unit),{throttle:1,shields:0,weapons},1,'weapons');return unit.propulsion;},idle=run(0),firing=run(profile.grid.Dw);
 assert.ok(idle.actualInputW>0,'the installed engine has connected finite power');assert.ok(firing.actualInputW<idle.actualInputW,'introducing weapon demand leaves fewer watts for the engine');for(const result of [idle,firing])assert.ok(result.power.draw<=originalPower*C.POWER_MODES.weapons.max*(1+1e-10));
 assert.ok(ship.links.every(l=>Number.isFinite(l.cap)&&l.cap>=0),'installed engineering paths have finite ratings');
 const saved=C.serialize(ship),snapshot=JSON.stringify(saved);C.refitShipSystems(ship,'engineering-fixture');assert.equal(JSON.stringify(C.serialize(ship)),snapshot,'a repeated constructor refit does not add machinery or alter ratings');
 const loaded=C.deserialize(JSON.parse(snapshot));assert.equal(loaded.parts.length,saved.parts.length);assert.equal(loaded.fits.length,saved.fits.length);assert.equal(loaded._shipSystemRefit,undefined,'loading an edited blueprint does not invoke the stock refit');
 for(const old of original){const p=loaded.parts.find(p=>p.id===old.id);near(C.partVolume(p),old.volume);near(C.reactorPower(p),old.power);}
 near(C.resolveEngineSpec(loaded.parts.find(p=>p.id===engine.id),loaded).ratedInputW,C.resolveEngineSpec(engine,ship).ratedInputW);assert.deepEqual(plain(loaded.links),plain(saved.links));
});

test('an auxiliary reactor beside an integral spherical turret room keeps its source and volume after physical repacking and save/load',()=>{
 const ship=busFixture(),aux=C.placePart(ship,'aux',[150,40,70],20),gun={id:ship.nextId++,k:'monCal34',p:[150,40,80],a:4,localMount:true,ped:0,base:0,low:0,float:false,chargeDepth:2};C.mountFit(ship,gun);ship.fits.push(gun);C.syncCompartments(ship);
 assert.equal(gun.float,false);const rooms=C.allOccupied(ship).filter(p=>p.turretRoom);assert.ok(rooms.some(p=>C.overlapParts(aux,p)),'the native sphere genuinely intersects the fixed integral gun room');
 const sourceIds=Array.from(ship.parts.filter(C.isReactor),p=>p.id).sort((a,b)=>a-b),volume=C.partVolume(aux),power=C.reactorPower(aux),plantPower=ship.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),sourceId=aux.id;
 C.refitShipSystems(ship,'integral-room-clearance');const converted=ship.parts.find(p=>p.id===sourceId),meta=ship.shipSystemRefit;assert.ok(converted&&converted.k==='aux');assert.ok(converted.room);assert.equal(converted.customEquipment,true);assert.equal(converted.equipmentId,undefined);assert.equal(converted.autoFit,true);near(C.partVolume(converted),volume,1e-7);near(C.reactorPower(converted),power,1e-7);assert.deepEqual(Array.from(ship.parts.filter(C.isReactor),p=>p.id).sort((a,b)=>a-b),sourceIds);assert.deepEqual(plain(meta.addedReactors),[]);near(meta.baselinePowerW,plantPower,1e-7);
 const change=meta.reconfiguredReactors.find(p=>p.id===sourceId);assert.ok(change);near(change.originalVolumeM3,volume,1e-7);near(change.installedVolumeM3,volume,1e-7);assert.ok(C.allOccupied(ship).filter(p=>p.turretRoom).every(p=>!C.overlapParts(converted,p)));
 const stats=C.computeStats(ship);assert.equal(stats.info[sourceId]?.overlap,false);assert.ok(C.fleetProfile(stats,ship.name,ship).propulsion.engines.every(e=>e.available),'the same source arrangement still powers available physical engines');
 const loaded=C.deserialize(JSON.parse(JSON.stringify(C.serialize(ship))));C.syncCompartments(loaded);const restored=loaded.parts.find(p=>p.id===sourceId);assert.ok(restored.room);assert.equal(restored.customEquipment,true);assert.equal(restored.equipmentId,undefined);near(C.partVolume(restored),volume,1e-7);near(C.reactorPower(restored),power,1e-7);assert.deepEqual(Array.from(loaded.parts.filter(C.isReactor),p=>p.id).sort((a,b)=>a-b),sourceIds);assert.ok(C.allOccupied(loaded).filter(p=>p.turretRoom).every(p=>!C.overlapParts(restored,p)));
 const restoredStats=C.computeStats(loaded);assert.equal(restoredStats.info[sourceId]?.overlap,false);assert.ok(C.fleetProfile(restoredStats,loaded.name,loaded).propulsion.engines.every(e=>e.available));
});
