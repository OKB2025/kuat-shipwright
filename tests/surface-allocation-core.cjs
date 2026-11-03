const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v));
function ship(L=240){const s=C.newShip({L,W:L/2,H:L/4,plan:'rect',sec:'rect'},'Allocation fixture');s.parts=[];s.fits=[];s.nextId=1;return s;}
const face=s=>C.surfacePatches(s).find(p=>p.host==='hull'&&p.face==='top'&&p.id.split(':')[2]==='0');
function set(s,allocation,extra={}){return C.setSurfaceConfig(s,face(s).id,{functionMode:'equipment',allocation,battery:{weapon:'pd',spacing:2},equipment:{kind:'hdis',depth:3},...extra});}
const only=role=>Object.fromEntries(['weapons','cooling','sensors','habitation'].map(k=>[k,k===role?100:0]));

test('linked allocation preserves exact 100 and per-face batch edits retain other proportions',()=>{
 const a=C.surfaceAllocation({weapons:10,cooling:20,sensors:30,habitation:40},'weapons',50);assert.equal(Object.values(a).reduce((a,b)=>a+b),100);assert.ok(Math.abs(a.cooling/a.habitation-.5)<1e-12);
 const s=ship(),ids=C.surfacePatches(s).filter(p=>p.face==='top').slice(0,2).map(p=>p.id);C.setSurfaceConfig(s,ids[0],{functionMode:'equipment',allocation:{weapons:10,cooling:20,sensors:30,habitation:40}});C.setSurfaceConfig(s,ids[1],{functionMode:'equipment',allocation:{weapons:10,cooling:40,sensors:30,habitation:20}});C.setSurfaceConfig(s,ids,{allocationEdits:[{key:'weapons',value:50}]});const out=ids.map(id=>C.surfaceConfig(s,id).allocation);assert.equal(out[0].weapons,50);assert.equal(out[1].weapons,50);assert.ok(out[0].habitation>out[1].habitation);assert.ok(out[0].cooling<out[1].cooling);
});

test('four allocations create actual finite devices and zero shares create no capability',()=>{
 const s=ship();assert.equal(set(s,{weapons:25,cooling:25,sensors:25,habitation:25}).ok,true);const r=C.surfaceReport(s).patches.find(p=>p.id===face(s).id);assert.ok(r.cells.length>4&&r.cells.length<=C.SURFACE_LIMITS.devices);for(const role of ['weapons','cooling','sensors','habitation']){const cat=r.categories[role];assert.ok(cat.installed>0,role);assert.ok(cat.occupiedArea<=cat.budgetArea+1e-6,role);assert.ok(r.cells.some(c=>c.role===role&&c.id>0));}assert.ok(s.parts.some(p=>p.k==='habitat'));assert.ok(s.parts.some(p=>p.k==='sensor'));assert.ok(s.parts.some(p=>p.k==='hdis'));assert.ok(s.fits.every(f=>f.k==='pd'));
 assert.equal(set(s,only('sensors')).ok,true);assert.ok(s.parts.length>0&&s.parts.every(p=>p.k==='sensor'));assert.equal(s.fits.length,0);const q=C.surfaceReport(s).patches.find(p=>p.id===face(s).id);assert.equal(q.coolingCapacity,0);assert.equal(q.habitationCapacity,0);assert.equal(q.categories.weapons.installed,0);
});

test('density, seed and repeated saves leave allocation capacity, IDs and physical cost unchanged',()=>{
 const s=ship();set(s,{weapons:25,cooling:25,sensors:25,habitation:25});const before=C.computeStats(s),ids=plain([...s.parts,...s.fits].map(p=>p.id)),cost=before.cost;C.setSurfaceConfig(s,face(s).id,{style:{density:1,seed:9191}});const after=C.computeStats(s);assert.equal(after.cost,cost);assert.equal(after.mass,before.mass);assert.equal(after.sensorVolume,before.sensorVolume);assert.equal(after.explicitHabitationVolume,before.explicitHabitationVolume);assert.deepEqual(plain([...s.parts,...s.fits].map(p=>p.id)),ids);
 const saved=plain(C.serialize(s)),loaded=C.deserialize(saved);C.surfaceSync(loaded);C.surfaceSync(loaded);assert.equal(loaded.surfaces.version,2);assert.deepEqual(plain(C.serialize(loaded).surfaces),saved.surfaces);assert.deepEqual(plain([...loaded.parts,...loaded.fits].map(p=>p.id)),ids);
});

test('habitat reserves existing common living volume once, adds cost and uses localized quarters modules',()=>{
 const s=ship(),empty=C.habitationSpace(s).volume;set(s,only('habitation'));const h=C.habitationSpace(s),S=C.computeStats(s);assert.ok(h.explicitVolume>0);assert.ok(h.explicitVolume<=h.volume);assert.ok(h.volume<=empty+1e-6);assert.equal(h.freeVolume+h.explicitVolume,h.volume);assert.equal(S.explicitHabitationVolume,h.explicitVolume);assert.ok(S.cost>0);assert.ok(S.draw.systems>0);assert.ok(S.heat.net.src.some(n=>n.k==='hotel'&&n.part>0));const mods=C.fleetModules(s,S),quarters=mods.filter(m=>m.k==='quarters'),total=quarters.reduce((n,m)=>n+m.size,0);assert.ok(Math.abs(total-h.volume)<1e-6);assert.ok(quarters.some(m=>s.parts.some(p=>p.k==='habitat'&&p.id===m.part)));assert.equal(S.ground.troops.used,0);
});

test('large ships retain exact thin-room credit and bounded service counts',()=>{
 const s=ship(1600),before=C.habitationSpace(s).volume;set(s,only('habitation'),{equipment:{kind:'hdis',depth:.2}});const h=C.habitationSpace(s),r=C.surfaceReport(s).patches.find(p=>p.id===face(s).id);assert.ok(r.cells.length>0&&r.cells.length<=256);assert.ok(r.habitationVolume>0);assert.equal(r.habitationVolume,r.physicalHabitationVolume);assert.ok(h.volume<=before+1e-6);assert.ok(r.categories.habitation.requested>r.categories.habitation.installed);assert.ok(r.errors.length);
});

test('depth limits and incompatible merge preserve explicit settings',()=>{
 const s=ship();set(s,only('cooling'),{equipment:{kind:'hdis',depth:100}});assert.equal(s.parts.length,0);const r=C.surfaceReport(s).patches.find(p=>p.id===face(s).id);assert.ok(r.errors.length);C.setSurfaceConfig(s,face(s).id,{equipment:{depth:2}});const split=C.surfaceSplit(s,face(s).id);assert.equal(split.ok,true);C.setSurfaceConfig(s,split.ids[0],{allocation:only('sensors')});const before=plain(C.serialize(s));assert.equal(C.surfaceMerge(s,split.ids).ok,false);assert.deepEqual(plain(C.serialize(s)),before);
});

test('surface rooms on a thin airfoil fit the shared envelope without expensive partial clipping',()=>{
 const s=ship();s.parts=[{id:1,k:'wing',c:[100,120,0],s:[64,40,6],form:'airfoil',wing:{thermal:'high',foil:true}}];s.nextId=2;const p=C.surfacePatches(s).find(p=>p.host==='p1'&&p.face==='top');const r=C.setSurfaceConfig(s,p.id,{functionMode:'equipment',allocation:{weapons:0,cooling:34,sensors:33,habitation:33},equipment:{kind:'hdis',depth:1}});assert.equal(r.ok,true);const rooms=s.parts.filter(p=>p.surfacePatch);assert.ok(rooms.length>0);C.syncCompartments(s);assert.ok(rooms.every(p=>!p._clip));for(const p of rooms){const T=C.structTriangles(C.roomShape(p));for(let i=0;i<T.length;i+=3)assert.ok(C.insideOriginalEnvelope(s,Array.from(T.slice(i,i+3))));}const before=plain(rooms.map(p=>[p.id,p.c,p.room]));C.surfaceSync(s);assert.deepEqual(plain(s.parts.filter(p=>p.surfacePatch).map(p=>[p.id,p.c,p.room])),before);
});
