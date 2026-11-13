const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5*Math.max(1,Math.abs(b)),`${a} != ${b}`),plain=p=>JSON.parse(C.publicJSON(p));
function box(id,c=[0,0,0],s=[40,40,20]){return {id,k:'struct',form:'box',c,s};}
function ship(){const s=C.newShip({L:300,W:300,H:100,assembly:true},'Deletion graph');s.parts=[box(1)];s.fits=[];s.nextId=2;return s;}
function child(s,at=[0,100,0],size=[10,10,10],parentId=1){const parent=s.parts.find(p=>p.id===parentId),r=C.commitPlacement(s,box(-1,[0,0,0],size),{mode:'horizontal',parentStructureId:parentId,hit:C.rayPart(at,[0,-1,0],parent)});assert.equal(r.ok,true,r.error);return r.part;}
function cycles(s){for(const p of s.parts){const seen=new Set([p.id]);let id=p.placement?.parentStructureId;while(id!=null){assert.ok(!seen.has(id),'no cyclic editing parents');seen.add(id);const next=s.parts.find(p=>p.id===id);assert.ok(next,'no deleted parent');id=next.placement?.parentStructureId;}}}

// 2026-11-13 user decision (stage B, no parent relation): a delete removes only the selected parts; what stood on them
// drops along its axis onto a body below or stays where it is (red); nothing is re-parented, promoted to a root or deleted.
test('a single child on a deleted body stays where it is (red), while a missing saved body stays reported',()=>{
 const s=ship(),p=child(s),c0=Array.from(p.c),saved=C.serialize(s),result=C.removeParts(s,[1]);assert.equal(result.ok,true);assert.deepEqual(Array.from(result.removed),[1]);assert.equal(s.parts.length,1);assert.deepEqual(Array.from(p.c),c0);
 const r=C.refreshPlacementGeometry(s);assert.ok(r.failed.some(f=>f.partId===p.id),'red');
 const corrupt=plain(saved);corrupt.parts=corrupt.parts.filter(p=>p.id!==1);const loaded=C.deserialize(corrupt);assert.equal(loaded.parts.length,1);assert.equal(C.placementDiagnostics(loaded)[0].connected,false);
});

test('touching siblings on a deleted body both stay; no root is promoted and no parent cycle is reported',()=>{
 const s=ship(),a=child(s,[-5,100,0]),b=child(s,[5,100,0]),ids=[a.id,b.id].sort(),r=C.removeParts(s,[1]);assert.equal(r.ok,true);assert.deepEqual(s.parts.map(p=>p.id).sort(),ids);assert.equal(s.parts.filter(p=>p.placement.root).length,0);
 const f=C.refreshPlacementGeometry(s);assert.ok(!f.failed.some(q=>q.code==='parent-cycle'),JSON.stringify(f.failed));const restored=C.deserialize(C.serialize(s));assert.deepEqual(Array.from(restored.parts,p=>p.id).sort(),ids);
});

test('a child and grandchild on a deleted body both stay where they are',()=>{
 const s=ship(),a=child(s),b=child(s,[0,100,0],[6,6,6],a.id),b0=Array.from(b.c),r=C.removeParts(s,[1]);assert.equal(r.ok,true);assert.equal(s.parts.length,2);assert.deepEqual(Array.from(b.c),b0);assert.equal(s.parts.filter(p=>p.placement.root).length,0);
});

test('a secondary surviving support keeps a child connected; deleting both supports leaves it in place (red)',()=>{
 const s=ship();s.parts.push(box(s.nextId++,[8,0,0]));const p=child(s,[5,100,0]),support=s.parts[1],r=C.removeParts(s,[1]);assert.equal(r.ok,true);assert.equal(p.placement.parentStructureId,support.id,'its tapped body points at the body it still touches');assert.equal(p.placement.root,undefined);
 const t=ship();t.parts.push(box(t.nextId++,[8,0,0]));const q=child(t,[5,100,0]);const batch=C.removeParts(t,[1,t.parts[1].id]);assert.equal(batch.ok,true);assert.equal(t.parts.length,1);assert.ok(!batch.removed.includes(q.id));assert.ok(C.refreshPlacementGeometry(t).failed.some(f=>f.partId===q.id));
});

test('wedge siblings keep their exact solids and volumes through deletion, save and undo restore',()=>{
 const s=ship();s.parts[0]={...box(1,[50,0,0],[100,80,20]),form:'wedge'};const a=child(s,[45,100,0],[10,10,10]),b=child(s,[55,100,0],[10,10,10]),saved=C.serialize(s),volumes=new Map(s.parts.filter(p=>p.id!==1).map(p=>[p.id,C.partVolume(p)]));C.removeParts(s,[1]);assert.equal(s.parts.length,2);for(const p of s.parts)near(C.partVolume(p),volumes.get(p.id));const restored=C.deserialize(C.serialize(s));for(const p of restored.parts)near(C.partVolume(p),volumes.get(p.id));const undo=C.deserialize(saved);assert.ok(undo.parts.some(p=>p.id===1));assert.equal(undo.parts.find(p=>p.id===a.id).placement.parentStructureId,1);near(C.partVolume(undo.parts.find(p=>p.id===b.id)),volumes.get(b.id));
});

test('the copy closure takes the selected parts only (weapons hosted on them still follow their host)',()=>{
 const s=ship(),a=child(s),b=child(s,[0,100,0],[6,6,6],a.id);s.fits.push({id:s.nextId++,k:'turbo',p:[0,26,0],a:2,host:b.id});const closure=C.placementCopyClosure(s,{parts:[1],fits:[]});assert.deepEqual(Array.from(closure.parts),[1]);assert.deepEqual(Array.from(closure.fits),[]);
 const withB=C.placementCopyClosure(s,{parts:[b.id],fits:[]});assert.deepEqual(Array.from(withB.fits),[s.fits[0].id]);const copy=C.surfaceCopySelection(s,{parts:[1],fits:[]});assert.equal(copy.parts.length,1);assert.equal(copy.fits.length,0);
});

function sensor(s,parentId=1,p=[0,10,0]){const r=C.commitPlacement(s,{id:-1,k:'sensor',c:[p[0],p[1]+1,p[2]],d:2},{mode:'direct',parentStructureId:parentId,hit:{p,n:[0,1,0]}});assert.equal(r.ok,true,r.error);return r.part;}
function gun(s,parentId=1,p=[0,10,0]){const r=C.solveFitPlacement(s,{id:-1,k:'pd',p:[0,0,0],a:2,n:[0,1,0],ped:0},{mode:'direct',hostId:parentId,hit:{p,n:[0,1,0]}});assert.equal(r.ok,true,r.error);const fit=C.acceptFitPlacementResult(s,r);assert.equal(fit.ok,true,fit.error);return fit.fit;}

test('equipment on a deleted only support stays where it is (red); a weapon hosted on it is removed (stage C owns weapons)',()=>{
 const s=ship(),equipment=sensor(s,1,[-8,10,0]),weapon=gun(s,1,[8,10,0]),saved=C.serialize(s),r=C.removeParts(s,[1]);assert.ok(!r.removed.includes(equipment.id));assert.ok(r.removedFits.includes(weapon.id));assert.equal(s.parts.length,1);assert.equal(s.fits.length,0);assert.ok(C.refreshPlacementGeometry(s).failed.some(f=>f.partId===equipment.id));const undo=C.deserialize(saved);assert.equal(undo.parts.find(p=>p.id===equipment.id).placement.parentStructureId,1);assert.equal(undo.fits.find(f=>f.id===weapon.id).host,1);
});

test('equipment and weapons reparent to real alternate support without changing IDs, world pose or settings',()=>{
 const s=ship();s.parts.push(box(s.nextId++,[8,0,0]));const alternate=s.parts[1],equipment=sensor(s,1,[2,10,0]),weapon=gun(s,1,[12,10,0]),equipmentId=equipment.id,weaponId=weapon.id,position=Array.from(equipment.c),mount=Array.from(weapon.p),r=C.removeParts(s,[1]);assert.equal(r.ok,true);assert.ok(s.parts.some(p=>p.id===equipmentId));assert.ok(s.fits.some(f=>f.id===weaponId));assert.equal(equipment.placement.parentStructureId,alternate.id);assert.equal(weapon.host,alternate.id);assert.deepEqual(Array.from(equipment.c),position);assert.deepEqual(Array.from(weapon.p),mount);assert.equal(weapon.k,'pd');assert.equal(C.placementFitContact(s,weapon,alternate).connected,true);const restored=C.deserialize(C.serialize(s));assert.equal(restored.fits.find(f=>f.id===weaponId).host,alternate.id);assert.equal(restored.parts.find(p=>p.id===equipmentId).placement.parentStructureId,alternate.id);
});

test('weapons on a surviving sibling are retained; copying the deleted body alone does not take them',()=>{
 const s=ship(),a=child(s,[-5,100,0]),b=child(s,[5,100,0]),weapon=gun(s,a.id,[-5,20,0]),closure=C.surfaceCopySelection(s,{parts:[1],fits:[]});assert.equal(closure.parts.length,1);assert.equal(closure.fits.length,0);C.removeParts(s,[1]);assert.equal(s.fits.length,1);assert.equal(s.fits[0].id,weapon.id);assert.equal(s.fits[0].host,a.id);const restored=C.deserialize(C.serialize(s));assert.equal(restored.fits[0].host,a.id);assert.ok(restored.parts.some(p=>p.id===b.id));
});

test('a deleted fitted native hull retains its surviving hull class and framing when another child touches it',()=>{
 const s=ship(),profile={L:10,W:10,H:10,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},r=C.commitPlacement(s,{...box(-1,[0,0,0],[10,10,10]),form:'hull',hullProfile:profile,hullData:{cuts:[],trenches:[],solidCuts:[],subs:[],hatches:[]}},{mode:'horizontal',parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});assert.equal(r.ok,true,r.error);const a=r.part,b=child(s,[10,100,0],[10,10,10]),before=C.computeStats(s).framingMass,volume=C.partVolume(a);C.removeParts(s,[1]);assert.ok(C.isHullStructure(a));near(C.partVolume(a),volume);near(C.computeStats(s).framingMass,before);const restored=C.deserialize(C.serialize(s)),hull=restored.parts.find(p=>p.id===a.id);assert.ok(C.isHullStructure(hull));near(C.partVolume(hull),volume);near(C.computeStats(restored).framingMass,before);assert.ok(restored.parts.some(p=>p.id===b.id));
});
