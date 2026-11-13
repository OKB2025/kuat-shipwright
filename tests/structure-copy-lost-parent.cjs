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
// High review 2026-11-13: a copy that faces another way than its source must not be re-seated by the join.
test('rotational-array copies of a hull-mounted box stay where the array put them and can be moved',()=>{
 const {ship,box}=cigarWithBox(),res=C.placeRotationalCopies(ship,{parts:[box.id],fits:[]},{count:4,axis:0,center:[110,16,0]});assert.equal(res.ok,true,res.error);
 // Turned 90°, 180° and 270° about the x axis through [110,16,0] (the array's own placement), not re-seated by the join.
 const [x,y,z]=box.c,ry=y-16,expect=[[x,16-z,ry],[x,16-ry,-z],[x,16+z,-ry]].map(v=>JSON.stringify(v.map(n=>+n.toFixed(6))));
 const placed=new Map(res.parts.map((id,i)=>[id,expect[i]]));C.refreshPlacementGeometry(ship);const S={warnings:[]};C.groundingStats(ship,S);
 for(const id of res.parts){const p=ship.parts.find(q=>q.id===id);assert.equal(JSON.stringify(p.c.map(n=>+n.toFixed(6))),placed.get(id),'#'+id+' not moved');assert.equal(p.placement.parentStructureId,1);assert.ok(!S.ungrounded.parts.includes(id),'#'+id+' not red');
  const want=[p.c[0]-5,p.c[1],p.c[2]];p.c=want.slice();C.refreshPlacementGeometry(ship);assert.equal(JSON.stringify(p.c),JSON.stringify(want),'#'+id+' a move is kept');}
});
test('rotational-array copies are placed the same way as their source: same fit, same trimmed shape, turn kept on a drag (user request 2026-11-13)',()=>{
 for(const count of [3,4,6]){
  const {ship,box}=cigarWithBox(),vol=box._placementGeometry.volume,res=C.placeRotationalCopies(ship,{parts:[box.id],fits:[]},{count,axis:0,center:[110,16,0]});assert.equal(res.ok,true,res.error);C.refreshPlacementGeometry(ship);
  for(const id of res.parts){const p=ship.parts.find(q=>q.id===id),m=p.placement,label=`${count} copies #${id}`;
   assert.equal(p.surfaceNormal,undefined,label+': the turn is yaw/pitch/roll');assert.ok(['horizontal','vertical'].includes(m.mode),label+' '+m.mode);assert.equal(m.contactFit,'cut',label+': the source fit');
   assert.ok(Math.abs(p._placementGeometry.volume-vol)<1e-6*vol,`${label}: trimmed like the source ${p._placementGeometry.volume} vs ${vol}`);
   const turn=JSON.stringify([p.yaw||0,p.pitch||0,p.roll||0]),want=[p.c[0]-5,p.c[1],p.c[2]],input=JSON.parse(C.publicJSON(p));input.c=want.slice();
   const r=C.solvePlacement(ship,input,{...m,position:want.slice()});assert.equal(r.ok,true,label+': '+r.error);assert.equal(JSON.stringify([r.part.yaw||0,r.part.pitch||0,r.part.roll||0]),turn,label+': a drag keeps the turn');
   const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship)))),q=L.parts.find(x=>x.id===id);assert.equal(JSON.stringify([q.c,q.yaw||0,q.pitch||0,q.roll||0]),JSON.stringify([p.c,p.yaw||0,p.pitch||0,p.roll||0]),label+': reload');assert.ok(Math.abs(q._placementGeometry.volume-vol)<1e-6*vol,label+': reload trimmed');}
 }
});
test('a top-mounted box pasted under the hull is joined on the underside, like a fresh placement there, and moves are kept',()=>{
 const {ship,box}=cigarWithBox(),q=JSON.parse(C.publicJSON(box));q.id=ship.nextId++;q.c=[80,-1.8,0];C.remapPlacementCopy(q,new Map(),{detachRoots:true});ship.parts.push(q);C.refreshPlacementGeometry(ship);
 const p=ship.parts.find(x=>x.id===q.id),m=p.placement,hull=ship.parts[0];
 assert.equal(m.parentStructureId,1);assert.equal(m.contactSide,'top','its top face meets the hull');assert.ok(m.contactNormal[1]<-.9,'anchored on the underside');
 assert.ok(C.worldStruct(hull,m.surfaceAnchor)[1]<1,'the anchor is under the hull, not on its far side');
 const want=[75,-1.8,3];p.c=want.slice();C.refreshPlacementGeometry(ship);assert.equal(JSON.stringify(p.c),JSON.stringify(want),'the move is kept');
});
// Review 2026-11-13 (fitAxis): copies whose parent is inside the selection, mirror, save round trip.
test('an array of a box and the child on it: child copies keep the turned fit through a parent edit and a reload',()=>{
 const {ship,box}=cigarWithBox(),top=C.rayPart([box.c[0],500,box.c[2]],[0,-1,0],box),hit={p:top.p,n:C.norm(top.n)};
 const child={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+1.5,hit.p[2]],s:[6,4,4],yaw:0,pitch:0,offsetX:0,offsetZ:0};
 const d=C.preparePlacementDraft(ship,child,{mode:'horizontal',parentStructureId:box.id,hostId:box.id,hit,contactFit:'cut',position:child.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;assert.equal(C.refreshPlacementGeometry(ship).ok,true);const src=ship.parts.at(-1),vol=src._placementGeometry.volume;
 const res=C.placeRotationalCopies(ship,{parts:[box.id,src.id],fits:[]},{count:4,axis:0,center:[110,16,0]});assert.equal(res.ok,true,res.error);C.refreshPlacementGeometry(ship);
 const kids=res.parts.map(id=>ship.parts.find(p=>p.id===id)).filter(p=>p.s[0]===6);assert.equal(kids.length,3);
 const state=p=>JSON.stringify([p.c.map(n=>+n.toFixed(6)),p.yaw||0,p.pitch||0,p.roll||0]);
 for(const p of kids){const label='#'+p.id;assert.equal(p.surfaceNormal,undefined,label);assert.ok(Array.isArray(p.placement.fitAxis),label+': turned fit axis');assert.ok(Math.abs(p._placementGeometry.volume-vol)<1e-6*vol,`${label}: ${p._placementGeometry.volume} vs ${vol}`);
  // The parent copy is resized (its geometry key changes): the child is not re-seated upright.
  const before=state(p),parent=ship.parts.find(q=>q.id===p.placement.parentStructureId);parent.s=[parent.s[0]+2,parent.s[1],parent.s[2]];C.refreshPlacementGeometry(ship);
  assert.equal(state(p),before,label+': pose kept after the parent edit');assert.ok(Math.abs(p.roll||0)>1||Math.abs(p.pitch||0)>1||p.roll===180,label+': still turned');}
 const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))));
 for(const p of kids){const q=L.parts.find(x=>x.id===p.id);assert.equal(state(q),state(p),'reload #'+p.id);assert.equal(JSON.stringify(q.placement.fitAxis),JSON.stringify(p.placement.fitAxis),'fitAxis saved');}
});
test('mirroring a turned array copy reflects its fit axis with the pose',()=>{
 const {ship,box}=cigarWithBox(),res=C.placeRotationalCopies(ship,{parts:[box.id],fits:[]},{count:4,axis:0,center:[110,16,0]});C.refreshPlacementGeometry(ship);
 // fitAxis is kept in the part's own frame: compare the world axes (left-right and vertical mirror).
 const W=q=>C.norm(C.worldStruct({...q,c:[0,0,0]},q.placement.fitAxis)).map(n=>+n.toFixed(9)),p=ship.parts.find(q=>q.id===res.parts[0]);assert.ok(Array.isArray(p.placement.fitAxis));const w=W(p);
 assert.equal(JSON.stringify(W(C.mirrorPart(p,ship))),JSON.stringify([w[0],w[1],-w[2]].map(n=>+n.toFixed(9))),'left-right mirror');
 assert.equal(JSON.stringify(W(C.vmirrorPart(p,ship))),JSON.stringify([w[0],-w[1],w[2]].map(n=>+n.toFixed(9))),'vertical mirror');
});
// High review 2026-11-13 (D2, D3): the turned fit axis follows the part's own frame and yields when it no longer faces out.
test('a 45° array copy set level again is cut like a part tapped level there, and a rotate-tool turn survives a reload (high review D2, D3)',()=>{
 const {ship,box}=cigarWithBox(),res=C.placeRotationalCopies(ship,{parts:[box.id],fits:[]},{count:8,axis:0,center:[110,16,0]});assert.equal(res.ok,true,res.error);C.refreshPlacementGeometry(ship);
 const p=ship.parts.find(q=>q.id===res.parts[0]);assert.equal(p.roll,45);
 // A tap re-seat at the same place gives the level reference.
 const tap=C.solvePlacement(ship,JSON.parse(C.publicJSON(p)),{...p.placement,hit:{p:C.worldStruct(ship.parts[0],p.placement.surfaceAnchor),n:p.placement.contactNormal}});assert.equal(tap.ok,true,tap.error);
 // 「水平へ戻す」: pitch and roll 0 → cut like the tapped part.
 p.pitch=0;p.roll=0;C.refreshPlacementGeometry(ship);assert.ok(Math.abs(p._placementGeometry.volume-tap.part._placementGeometry.volume)<1e-3,`${p._placementGeometry.volume} vs tap ${tap.part._placementGeometry.volume}`);
 // The rotate tool turns the 90° copy 10° more about x and writes surfaceNormal + yaw: the pose and the cut survive a reload.
 const q=ship.parts.find(x=>x.id===res.parts[1]),f0=C.structFrame(q),a=10*Math.PI/180,R=v=>[v[0],v[1]*Math.cos(a)-v[2]*Math.sin(a),v[1]*Math.sin(a)+v[2]*Math.cos(a)],fw=R(f0.fw),up=C.norm(R(f0.up));
 let b=C.sub([1,0,0],C.mul(up,up[0]));if(C.len(b)<.001)b=C.sub([0,0,1],C.mul(up,up[2]));b=C.norm(b);const rt=C.norm(C.cross(b,up));q.surfaceNormal=up;q.yaw=Math.atan2(C.dot(fw,rt),C.dot(fw,b))*180/Math.PI;delete q.pitch;delete q.roll;
 C.refreshPlacementGeometry(ship);const before=[C.structFrame(q).fw,C.structFrame(q).up].map(v=>v.map(n=>+n.toFixed(6))),vol=q._placementGeometry.volume;
 const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship)))),u=L.parts.find(x=>x.id===q.id),fu=C.structFrame(u);
 assert.equal(JSON.stringify([fu.fw,fu.up].map(v=>v.map(n=>+n.toFixed(6)))),JSON.stringify(before),'same pose after a reload');assert.ok(Math.abs(u._placementGeometry.volume-vol)<1e-6*vol,`same cut ${u._placementGeometry.volume} vs ${vol}`);
});
