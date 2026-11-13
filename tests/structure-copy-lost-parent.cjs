// A copied structure keeps its connection (report 2026-11-13, a user design): structures duplicated or pasted
// with their parent outside the copy lost the parent for good. remapPlacementCopy never keeps an id from
// outside the copy, so the copy carried meta.unresolvedParentId with no parentStructureId; nothing joined it
// again, so it stayed refused (parent-missing) or red (parent-required, ungrounded) even when the user moved
// or resized it onto the hull. A mirrored copy of such a part also kept its source's anchors unreflected.
// Now a structure with a lost parent is joined to the body of this ship it really touches or overlaps (user
// decision 2026-11-12: overlap is connection), keeping its pose and current shape; without contact it stays
// unresolved. The same design had 142 'lost face' warnings from default surface records (authored:false) of
// deleted parts and of copies; those carry no setting and are dropped, while a record the user set still warns.
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const {designWorker}=require('./helpers/worker-harness.cjs');
const saved=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/copied-structure-lost-parent-2026-11-13.json.gz'))).toString('utf8'));
const LOST=[102,103,107],POSE=['c','s','yaw','pitch','roll'];
const pose=p=>JSON.parse(JSON.stringify(POSE.map(k=>p[k])));
const grounding=ship=>{const S={warnings:[]};C.groundingStats(ship,S);return S;};

function assertJoined(ship,source,label){
 const S=grounding(ship);
 for(const id of LOST){const p=ship.parts.find(q=>q.id===id),meta=p.placement,o=source.parts.find(q=>q.id===id);
  assert.equal(meta.parentStructureId,1,`${label} #${id}: joined to the hull`);
  assert.equal(meta.unresolvedParentId,undefined,label);
  assert.ok(!meta.validationFailed&&!meta.repairRequired&&!meta.pendingGeometry,`${label} #${id}: ${meta.repairReason}`);
  assert.equal(p._placementError,undefined,`${label} #${id}: ${p._placementError}`);
  // Pose and shape are the user's: nothing moves, and the stored request follows the current shape.
  assert.deepEqual(pose(p),pose(o),`${label} #${id}: pose kept`);
  assert.deepEqual(meta.requestedGeometry.c,p.c,`${label} #${id}: request is the current shape`);assert.deepEqual(meta.requestedGeometry.s,p.s,label);
  const d=S.placementDiagnostics.find(x=>x.partId===id);assert.equal(d.connected,true,label+' #'+id+' '+JSON.stringify(d));
  assert.ok(!S.ungrounded.parts.includes(id),label+': no red frame');}
 // The mirrored pair sits on opposite sides: each anchor is on its own side of the hull.
 const [a,b]=[102,103].map(id=>ship.parts.find(q=>q.id===id).placement);
 assert.ok(a.surfaceAnchor[2]<-10&&b.surfaceAnchor[2]>10,`${label}: anchors ${a.surfaceAnchor} / ${b.surfaceAnchor}`);
 assert.ok(a.contactNormal[2]<-.9&&b.contactNormal[2]>.9,label+': normals face out on each side');
 assert.ok(!S.warnings.some(w=>w.code==='ungrounded'),label+': '+JSON.stringify(S.warnings.map(w=>w.text)));
}

test('the reported design loads with its copied structures joined to the hull, unmoved',()=>{
 const source=saved();
 // The saved state: lost parents (two stored refusals, one red part).
 for(const id of LOST)assert.equal(source.parts.find(p=>p.id===id).placement.unresolvedParentId,1);
 const ship=C.deserialize(JSON.parse(JSON.stringify(source)));assertJoined(ship,source,'load');
 assert.equal(JSON.stringify(C.placementDraftStatus(ship).failed),'[]');
 // Save and load again: the same state.
 const again=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))));assertJoined(again,source,'reload');
});

test('the Worker joins the copies on its first update and returns the same poses',async()=>{
 const source=saved(),w=designWorker(root,C),{state}=await w.update(source,{reset:true});
 assertJoined(C.deserialize(JSON.parse(JSON.stringify(state))),source,'worker');
 for(const id of LOST)assert.deepEqual(pose(state.parts.find(p=>p.id===id)),pose(source.parts.find(p=>p.id===id)),'worker #'+id);
});

test('a duplicate of a hull-mounted structure (parent outside the copy) is joined where it touches',()=>{
 const ship=C.deserialize(saved()),src=ship.parts.find(p=>p.id===106),copy=JSON.parse(C.publicJSON(src));
 // The editor's duplicate: new id, moved forward, placement remapped with the hull outside the copy.
 copy.id=ship.nextId++;copy.c=[copy.c[0]+40,copy.c[1],copy.c[2]];C.remapPlacementCopy(copy,new Map([[106,copy.id]]),{detachRoots:true});
 assert.equal(copy.placement.parentStructureId,undefined,'precondition: the copy lost its parent');
 ship.parts.push(copy);C.refreshPlacementGeometry(ship);
 const p=ship.parts.find(q=>q.id===copy.id);assert.equal(p.placement.parentStructureId,1);assert.equal(p._placementError,undefined);
 assert.deepEqual(p.c,copy.c,'kept where it was put');
 assert.equal(grounding(ship).placementDiagnostics.find(d=>d.partId===p.id).connected,true);
});

test('a copy that touches nothing stays unresolved and is not measured again until something changes',()=>{
 const ship=C.deserialize(saved()),copy=JSON.parse(C.publicJSON(ship.parts.find(p=>p.id===106)));
 copy.id=ship.nextId++;copy.c=[copy.c[0],copy.c[1]+200,copy.c[2]];C.remapPlacementCopy(copy,new Map([[106,copy.id]]),{detachRoots:true});
 ship.parts.push(copy);C.refreshPlacementGeometry(ship);
 const p=ship.parts.find(q=>q.id===copy.id);assert.equal(p.placement.parentStructureId,undefined);assert.equal(p.placement.unresolvedParentId,1,'the parent left outside the copy');
 const tried=p._placementAdoptTried;assert.ok(tried,'one attempt recorded');
 C.refreshPlacementGeometry(ship);assert.equal(p._placementAdoptTried,tried,'no new attempt for the same state');
 // Moved onto the hull by the user: joined.
 p.c=[copy.c[0],copy.c[1]-200,copy.c[2]];C.refreshPlacementGeometry(ship);assert.equal(p.placement.parentStructureId,1);
});

test('default surface records of removed parts and copies are dropped; a record the user set still warns',()=>{
 const source=saved();assert.equal(source.surfaces.patches.length,159);
 const ship=C.deserialize(JSON.parse(JSON.stringify(source)));
 // 142 records: hosts p2, p52…p66, p108 are gone, and the copies' records were marked orphan; all authored:false.
 assert.equal(ship.surfaces.patches.length,17);assert.ok(ship.surfaces.patches.every(q=>q.id.startsWith('p1:')));
 assert.ok(!C.computeStats(ship).warnings.some(w=>w.code==='surface-orphan'));
 // A record the user set is kept and reported when its face is gone.
 const set=JSON.parse(JSON.stringify(source));const rec=set.surfaces.patches.find(q=>q.id.startsWith('p2:'));rec.authored=true;rec.armor={material:'standard',thickness:1.5};
 const kept=C.deserialize(set);assert.ok(kept.surfaces.patches.some(q=>q.id===rec.id));
 assert.equal(C.computeStats(kept).warnings.filter(w=>w.code==='surface-orphan').length,1);
});

// Review 2026-11-13: cases beyond the reported design.
function cigarWithBox(){
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'t');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts.find(p=>C.isShapePart(p));
 const raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},part={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+1.8,hit.p[2]],s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0};
 const d=C.preparePlacementDraft(ship,part,{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit,contactFit:'cut',position:part.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;assert.equal(C.refreshPlacementGeometry(ship).ok,true);return {ship,hull,box:ship.parts.at(-1)};
}
test('a cut-fit structure pasted from another ship (root and parent dropped) is joined where it overlaps, keeping its authored shape',()=>{
 const {ship,box}=cigarWithBox(),copy=JSON.parse(C.publicJSON(box)),authored=JSON.stringify(['c','s','yaw','pitch','roll','form'].map(k=>copy[k]));
 // A paste into another design: no id of the source ship survives; detachRoots as the editor passes it.
 const target=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'other');target.fits=[];C.ensurePrimaryHull(target);
 copy.id=target.nextId++;C.remapPlacementCopy(copy,new Map(),{detachRoots:true});assert.equal(copy.placement.parentStructureId,undefined);
 target.parts.push(copy);C.refreshPlacementGeometry(target);const p=target.parts.find(q=>q.id===copy.id);
 assert.equal(p.placement.parentStructureId,C.primaryHullPart(target).id);assert.equal(p._placementError,undefined);
 assert.equal(JSON.stringify(['c','s','yaw','pitch','roll','form'].map(k=>p[k])),authored,'the authored shape and pose, not a fitted shape');
 assert.equal(JSON.stringify(p.placement.requestedGeometry.s),JSON.stringify(copy.s));
});
test('the parent chosen among several touching bodies does not depend on part order (hull first)',()=>{
 const {ship,hull,box}=cigarWithBox();
 // A plate-like copy resting on both the hull and the box.
 const make=()=>{const q={id:0,k:'struct',form:'box',c:[box.c[0]+9,box.c[1],box.c[2]],s:[6,6,6],yaw:0,pitch:0,offsetX:0,offsetZ:0,placement:{modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'horizontal',unresolvedParentId:999,requestedGeometry:null}};return q;};
 const results=[];for(const order of ['after','before']){const s=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))));const q=make();q.id=s.nextId++;q.placement.requestedGeometry={...q,placement:undefined};
  if(order==='after')s.parts.push(q);else s.parts.splice(1,0,q);C.refreshPlacementGeometry(s);results.push(s.parts.find(p=>p.id===q.id).placement.parentStructureId);}
 assert.equal(results[0],hull.id);assert.equal(results[1],hull.id,'same choice in either order');
});
test('a surface record written before the authored flag existed is kept (treated as set by the user)',()=>{
 const source=saved();const legacy=source.surfaces.patches.find(q=>q.id.startsWith('p2:'));delete legacy.authored;
 const s=C.deserialize(source);assert.ok(s.surfaces.patches.some(q=>q.id===legacy.id),'kept');assert.equal(s.surfaces.patches.length,18);
});
test('Worker patches (an undo back to the lost-parent state, then a redo) give the same joined result each time',async()=>{
 const source=saved(),w=designWorker(root,C),first=(await w.update(source,{reset:true})).state;
 const edited=JSON.parse(JSON.stringify(first));edited.parts.find(p=>p.id===106).c[0]+=1;await w.update(edited);
 const undo=(await w.update(source)).state,redo=(await w.update(first)).state;
 for(const [label,state] of [['undo',undo],['redo',redo]])for(const id of LOST){const p=state.parts.find(q=>q.id===id),f=first.parts.find(q=>q.id===id);
  assert.equal(p.placement.parentStructureId,1,label+' #'+id);assert.deepEqual(pose(p),pose(f),label+' #'+id+': same pose');
  assert.equal(JSON.stringify(p.placement.surfaceAnchor.map(v=>+v.toFixed(9))),JSON.stringify(f.placement.surfaceAnchor.map(v=>+v.toFixed(9))),label+' #'+id+': same anchor');}
});
