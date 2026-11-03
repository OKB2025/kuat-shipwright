const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v));
function ship(L=240){const s=C.newShip({L,W:L/2,H:L/4,plan:'rect',sec:'rect'},'Allocation fixture');s.parts=[];s.fits=[];s.nextId=1;return C.deserialize(C.serialize(s));}
const face=s=>C.surfacePatches(s).find(p=>p.host==='hull'&&p.face==='top'&&p.id.split(':')[2]==='0');
function set(s,allocation,extra={}){return C.setSurfaceConfig(s,face(s).id,{functionMode:'equipment',allocation,battery:{weapon:'pd',count:0,spacing:2},equipment:{kind:'hdis',depth:3},...extra});}

// Decode bounded geometric reservations to verify physical containment.
// Runtime occupancy and saved designs continue to use bounded face adapters.
const logicalParts=s=>C.surfaceWorkingShip(s).parts.filter(p=>p._surfaceAdapter).flatMap(p=>p._surfaceAdapter.cells.map(r=>({id:r[0],k:p.k,c:r.slice(4,7),room:r.slice(7,10),d:Math.cbrt(r[7]*r[8]*r[9]),surfaceNormal:r.slice(10,13),yaw:r[13],surfacePoint:r.slice(14,17),surfaceFootprint:r.slice(17,19),surfaceDepth:r[19],surfaceExposure:r[20],surfaceUnplaced:!!r[3],surfacePatch:p.surfacePatch,surfaceRole:p.surfaceRole,surfaceCell:r[26]})));
const generatedFits=s=>C.surfaceDerivedFits(s),roleParts=s=>C.surfaceWorkingShip(s).parts.filter(p=>p._surfaceAdapter);
const only=role=>Object.fromEntries(['cooling','sensors','habitation'].map(k=>[k,k===role?100:0]));

test('linked allocation preserves exact 100 and per-face batch edits retain other proportions',()=>{
 const a=C.surfaceAllocation({cooling:10,sensors:30,habitation:60},'cooling',50);assert.equal(Object.values(a).reduce((a,b)=>a+b),100);assert.ok(Math.abs(a.sensors/a.habitation-.5)<1e-12);assert.equal(a.weapons,undefined);
 const s=ship(),ids=C.surfacePatches(s).filter(p=>p.face==='top').slice(0,2).map(p=>p.id);C.setSurfaceConfig(s,ids[0],{functionMode:'equipment',allocation:{cooling:10,sensors:30,habitation:60}});C.setSurfaceConfig(s,ids[1],{functionMode:'equipment',allocation:{cooling:10,sensors:60,habitation:30}});C.setSurfaceConfig(s,ids,{allocationEdits:[{key:'cooling',value:50}]});const out=ids.map(id=>C.surfaceConfig(s,id).allocation);assert.equal(out[0].cooling,50);assert.equal(out[1].cooling,50);assert.ok(out[0].habitation>out[1].habitation);assert.ok(out[0].sensors<out[1].sensors);
});

test('three equipment allocations and an explicit gun count create bounded common face adapters',()=>{
 const s=ship();assert.equal(set(s,{cooling:34,sensors:33,habitation:33},{battery:{weapon:'pd',count:2,spacing:2}}).ok,true);const r=C.surfaceReport(s).patches.find(p=>p.id===face(s).id),logical=logicalParts(s);assert.ok(logical.length>=3&&logical.length<=C.SURFACE_LIMITS.devices);assert.ok(roleParts(s).length<=3,'physical area must use bounded role adapters rather than one object per installed unit');for(const role of ['cooling','sensors','habitation']){const cat=r.categories[role];assert.ok(cat.installed>0,role);assert.ok(cat.occupiedArea<=cat.budgetArea+1e-6,role);assert.ok(roleParts(s).some(p=>p.surfaceRole===role&&p.id>0));}assert.equal(r.categories.weapons.requested,2);assert.equal(r.categories.weapons.installed,2);assert.equal(r.cells.filter(c=>c.role==='weapons').length,2);assert.ok(roleParts(s).some(p=>p.k==='habitat'));assert.ok(roleParts(s).some(p=>p.k==='sensor'));assert.ok(roleParts(s).some(p=>p.k==='hdis'));assert.ok(generatedFits(s).every(f=>f.k==='pd'));assert.equal(s.parts.length,0);assert.equal(s.fits.length,0);
 assert.equal(set(s,only('sensors')).ok,true);assert.ok(roleParts(s).length>0&&roleParts(s).every(p=>p.k==='sensor'));assert.equal(generatedFits(s).length,0);const q=C.surfaceReport(s).patches.find(p=>p.id===face(s).id);assert.equal(q.coolingCapacity,0);assert.equal(q.habitationCapacity,0);assert.equal(q.categories.weapons.installed,0);
});

test('density, seed and repeated saves leave allocation capacity, IDs and physical cost unchanged',()=>{
 const s=ship();set(s,{cooling:34,sensors:33,habitation:33},{battery:{weapon:'pd',count:2,spacing:2}});const before=C.computeStats(s),ids=plain([...logicalParts(s),...generatedFits(s)].map(p=>p.id)),cost=before.cost;C.setSurfaceConfig(s,face(s).id,{style:{density:1,seed:9191}});const after=C.computeStats(s);assert.equal(after.cost,cost);assert.equal(after.mass,before.mass);assert.equal(after.sensorVolume,before.sensorVolume);assert.equal(after.explicitHabitationVolume,before.explicitHabitationVolume);assert.deepEqual(plain([...logicalParts(s),...generatedFits(s)].map(p=>p.id)),ids);
 const saved=plain(C.serialize(s)),loaded=C.deserialize(saved);C.surfaceSync(loaded);C.surfaceSync(loaded);assert.equal(loaded.surfaces.version,C.SURFACE_VERSION);assert.deepEqual(plain(C.serialize(loaded).surfaces),saved.surfaces);assert.deepEqual(plain([...logicalParts(loaded),...generatedFits(loaded)].map(p=>p.id)),ids);
});

test('habitat reserves existing common living volume once, adds cost and uses localized quarters modules',()=>{
 const s=ship(),empty=C.habitationSpace(s).volume;set(s,only('habitation'));const h=C.habitationSpace(s),S=C.computeStats(s);assert.ok(h.explicitVolume>0);assert.ok(h.explicitVolume<=h.volume);assert.ok(h.volume<=empty+1e-6);assert.equal(h.freeVolume+h.explicitVolume,h.volume);assert.equal(S.explicitHabitationVolume,h.explicitVolume);assert.ok(S.cost>0);assert.ok(S.draw.systems>0);assert.ok(S.heat.net.src.some(n=>n.k==='hotel'&&n.part>0));const mods=C.fleetModules(s,S),quarters=mods.filter(m=>m.k==='quarters'),total=quarters.reduce((n,m)=>n+m.size,0);assert.ok(Math.abs(total-h.volume)<1e-6);assert.ok(quarters.some(m=>roleParts(s).some(p=>p.k==='habitat'&&p.id===m.part)));assert.equal(S.ground.troops.used,0);
});

test('large ships retain exact thin-room credit and bounded service counts',()=>{
 const s=ship(1600),before=C.habitationSpace(s).volume;set(s,only('habitation'),{equipment:{kind:'hdis',depth:.2}});const h=C.habitationSpace(s),r=C.surfaceReport(s).patches.find(p=>p.id===face(s).id),cells=logicalParts(s);assert.ok(cells.length>0&&cells.length<=256);assert.ok(roleParts(s).length<=3);assert.ok(r.habitationVolume>0);assert.equal(r.habitationVolume,r.physicalHabitationVolume);assert.ok(h.volume<=before+1e-6);assert.ok(r.physicalHabitationVolume>256*64*.2,'large physical faces must exceed the obsolete256-tile ceiling');assert.ok(Math.abs(r.physicalHabitationVolume-r.categories.habitation.occupiedArea*.2)<1e-6);assert.ok(r.categories.habitation.occupiedArea<=r.categories.habitation.budgetArea+1e-6);
});

test('depth limits and incompatible merge preserve explicit settings',()=>{
 const s=ship();set(s,only('cooling'),{equipment:{kind:'hdis',depth:100}});assert.equal(s.parts.length,0);const r=C.surfaceReport(s).patches.find(p=>p.id===face(s).id);assert.ok(r.errors.length);C.setSurfaceConfig(s,face(s).id,{equipment:{depth:2}});const split=C.surfaceSplit(s,face(s).id);assert.equal(split.ok,true);C.setSurfaceConfig(s,split.ids[0],{allocation:only('sensors')});const before=plain(C.serialize(s));assert.equal(C.surfaceMerge(s,split.ids).ok,false);assert.deepEqual(plain(C.serialize(s)),before);
});

test('surface rooms on a thin airfoil fit the shared envelope without expensive partial clipping',()=>{
 const s=ship();s.parts=[{id:1,k:'wing',c:[100,120,0],s:[64,40,6],form:'airfoil',wing:{thermal:'high',foil:true}}];s.nextId=2;const p=C.surfacePatches(s).find(p=>p.host==='p1'&&p.face==='top');const r=C.setSurfaceConfig(s,p.id,{functionMode:'equipment',allocation:{weapons:0,cooling:34,sensors:33,habitation:33},equipment:{kind:'hdis',depth:1}});assert.equal(r.ok,true);const rooms=logicalParts(s).filter(p=>p.surfacePatch);assert.ok(rooms.length>0);C.syncCompartments(s);assert.ok(roleParts(s).every(p=>!p._clip));for(const p of rooms){const T=C.structTriangles(C.roomShape(p));for(let i=0;i<T.length;i+=3)assert.ok(C.insideOriginalEnvelope(s,Array.from(T.slice(i,i+3))));}const before=plain(rooms.map(p=>[p.id,p.c,p.room]));C.surfaceSync(s);assert.deepEqual(plain(logicalParts(s).filter(p=>p.surfacePatch).map(p=>[p.id,p.c,p.room])),before);
});
