const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v));
function ship(){const s=C.newShip({L:240,W:120,H:60,plan:'rect',sec:'rect'},'Surface fixture');s.parts=[];s.fits=[];s.nextId=1;return s;}
function top(s){return C.surfacePatches(s).find(p=>p.host==='hull'&&p.face==='top'&&p.id.split(':')[2]==='0');}
function stats(s){return C.computeStats(s);}

test('semantic surface identities survive dimensions and hidden compartments cannot acquire exterior functions',()=>{
 const s=ship(),p=top(s);assert.ok(p.area>0&&p.polygon.length>=3&&p.triangles.length>9);s.hull.L*=1.2;s.hull.W*=1.1;assert.equal(top(s).id,p.id);
 s.parts.push({id:s.nextId++,k:'service',c:[50,20,0],d:10,room:[20,20,10]});const hidden=C.surfacePatches(s).filter(p=>p.host==='p1');assert.ok(hidden.length);assert.ok(hidden.every(p=>!p.exposed));assert.equal(C.setSurfaceConfig(s,hidden[0].id,{battery:{weapon:'ltl',count:2}}).ok,false);
});

test('surface devices are actual shared-network parts with stable IDs and save/load is idempotent',()=>{
 const s=ship(),id=top(s).id;assert.equal(C.setSurfaceConfig(s,id,{equipment:{kind:'hdis',count:2,depth:2}}).ok,true);const ids=s.parts.map(p=>p.id);assert.equal(ids.length,2);assert.ok(s.parts.every(p=>p.k==='hdis'&&p.surfacePoint&&p.surfaceFootprint));
 let S=stats(s);assert.equal(S.heat.net.dis.filter(d=>ids.includes(d.part)).length,2);assert.equal(S.surface.totals.equipment,2);const first=C.serialize(s),r=C.deserialize(plain(first));C.surfaceSync(r);C.surfaceSync(r);assert.deepEqual(plain(r.parts.map(p=>p.id)),plain(ids));assert.deepEqual(plain(C.serialize(r).surfaces),plain(first.surfaces));assert.equal(new Set(r.parts.map(p=>p.id)).size,r.parts.length);
});

test('cosmetic density and seed do not change mounts, mass, power, crew or dissipation',()=>{
 const s=ship(),id=top(s).id;C.setSurfaceConfig(s,id,{battery:{weapon:'ltl',count:2},equipment:{kind:'hdis',count:1,depth:2}});const a=stats(s),ids=plain(s.fits.map(f=>f.id));C.setSurfaceConfig(s,id,{style:{density:1,seed:991,kind:'machinery'}});const b=stats(s);assert.deepEqual(plain(s.fits.map(f=>f.id)),ids);for(const k of ['mass','crew','power','alphaTot'])assert.equal(b[k],a[k],k);assert.equal(b.heat.net.dis.reduce((n,d)=>n+d.cap,0),a.heat.net.dis.reduce((n,d)=>n+d.cap,0));
});

test('battery packing uses real mount footprint and internal depth rather than area alone',()=>{
 const s=ship(),id=top(s).id;C.setSurfaceConfig(s,id,{battery:{weapon:'xx9',count:30,spacing:3}});const r=C.surfaceReport(s).patches.find(p=>p.id===id);assert.ok(r.installed>0&&r.installed<30);assert.equal(r.barrels,r.installed*C.FITS.xx9.barrels);assert.equal(s.fits.length,r.installed);assert.ok(r.errors.length);
 const wing={id:s.nextId++,k:'wing',c:[50,100,0],s:[100,50,.05],form:'airfoil',wing:{thermal:'high'}};s.parts.push(wing);const face=C.surfacePatches(s).find(p=>p.host==='p'+wing.id&&p.face==='top');assert.ok(face?.exposed);C.setSurfaceConfig(s,face.id,{battery:{weapon:'xx9',count:1}});assert.equal(C.surfaceReport(s).patches.find(p=>p.id===face.id).installed,0);
});

test('splitting and merging distributes requested devices and armour without multiplying them',()=>{
 const s=ship(),id=top(s).id;C.setSurfaceConfig(s,id,{armor:{thickness:1.2,material:'dense'},battery:{weapon:'ltl',count:4},equipment:{kind:'hdis',count:2,depth:1}});const before=C.surfaceReport(s).totals,split=C.surfaceSplit(s,id,'v',.5);assert.equal(split.ok,true);assert.equal(split.ids.length,2);assert.equal(split.report.totals.requested,before.requested);assert.equal(split.report.patches.filter(p=>p.active).reduce((n,p)=>n+p.requestedEquipment,0),2);assert.ok(split.report.patches.filter(p=>split.ids.includes(p.id)).every(p=>p.config.armor.thickness===1.2));
 const merged=C.surfaceMerge(s,split.ids);assert.equal(merged.ok,true);assert.equal(merged.report.totals.requested,4);assert.equal(merged.report.patches.filter(p=>p.active).reduce((n,p)=>n+p.requestedEquipment,0),2);assert.equal(new Set([...s.parts,...s.fits].map(p=>p.id)).size,s.parts.length+s.fits.length);
});

test('geometry topology changes leave explicit orphan settings and never inherit weapons onto new cut faces',()=>{
 const s=ship(),id=top(s).id;C.setSurfaceConfig(s,id,{battery:{weapon:'ltl',count:2},equipment:{kind:'hdis',count:1,depth:2}});const oldIds=[...s.parts,...s.fits].map(q=>q.id),r=C.surfaceCarve(s,id,2);assert.equal(r.ok,true);assert.ok(s.solidCuts.length);assert.ok(r.report.orphaned.some(q=>q.id===id));assert.ok(r.report.patches.every(p=>p.requested===0&&p.config.armor.thickness===0));assert.equal(s.fits.filter(f=>!f.surfaceUnplaced).length,0);assert.ok(oldIds.every(id=>[...s.parts,...s.fits].some(q=>q.id===id)));assert.ok(r.report.warnings.some(w=>w.code==='surface-orphan'));
});

test('surface armour replaces the selected legacy contribution instead of adding a second whole-ship armour layer',()=>{
 const a=ship(),base=stats(a),p=C.surfacePatches(a).find(p=>p.host==='hull'&&p.face==='port'&&p.id.split(':')[2]==='0'),t=a.armor.hull;C.setSurfaceConfig(a,p.id,{armor:{material:'standard',thickness:t+1}});const b=stats(a);assert.ok(Math.abs((b.armorMass-base.armorMass)-p.area*C.K.armorDens)<1e-4);assert.ok(b.mass>base.mass);const P=C.fleetProfile(b,a.name,a),port=P.surface.patches.find(q=>q.id===p.id);assert.equal(port.armor.thickness,t+1);assert.ok(Math.max(...P.zT.filter((_,i)=>i%6===3))>Math.max(...P.zT.filter((_,i)=>i%6===2)));
});

test('legacy saves keep compatibility mode and enabling surfaces preserves individual turrets',()=>{
 const s=ship(),id=top(s).id;C.setSurfaceConfig(s,id,{battery:{weapon:'ltl',count:1}});const generated=s.fits[0];delete generated.surfacePatch;delete generated.surfaceCell;delete s.surfaces;const save=C.serialize(s);assert.equal(save.surfaces,undefined);const loaded=C.deserialize(plain(save));assert.equal(loaded.surfaces,undefined);const ids=loaded.fits.map(f=>f.id);C.enableSurfaceMode(loaded,true);C.surfaceSync(loaded);assert.deepEqual(plain(loaded.fits.map(f=>f.id)),plain(ids));assert.equal(loaded.surfaces.mode,'strict');
});

test('a flush radiator uses the exposed functional port rather than its hidden internal equipment box',()=>{
 const s=ship();s.parts.push({id:s.nextId++,k:'gen',c:[100,20,0],d:20});const id=top(s).id;C.setSurfaceConfig(s,id,{equipment:{kind:'radiator',count:1,depth:1}});const part=s.parts.find(p=>p.surfacePatch===id),S=stats(s),node=S.heat.net.dis.find(d=>d.part===part.id);assert.ok(part.surfaceExposure>.99);assert.ok(S.info[part.id].exposed>.99);assert.ok(node?.cap>0);assert.ok(Math.abs(node.cap-C.dissipatorCap(part,S,1))<node.cap*1e-9);assert.ok(S.surface.patches.find(p=>p.id===id).equipmentPower>0);
});
