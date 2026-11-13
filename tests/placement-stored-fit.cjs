// Stage B of the no-recompute plan (2026-11-13, docs/handoff-2026-11-12.md §1 "親子関係は持たない" and "寸法の変更",
// docs/design-placement-v1.2.md "段階 B"): the fitted shape of a horizontal / vertical structure is stored with the
// part (placement.fittedGeometry) and made only by the user's own placement, drag or resize. A change of the body
// below (moved, turned, resized, cut), a reload, the Worker or a re-check keeps it and the authored placement record
// unchanged. Exterior equipment does not follow the body it was mounted on.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=v=>JSON.parse(C.publicJSON(v)),near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const tris=p=>Array.from(C.placementTriangles?C.placementTriangles(p):C.structTriangles(p));

// A sloped (pitched) parent so the cut base of the child is not a plane parallel to its own frame.
function fixture(){
 const ship=C.newShip({L:300,W:200,H:100,assembly:true},'Stored fit');
 Object.assign(ship,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,80,20],pitch:6}],fits:[],hatches:[],links:[],groups:[],nextId:3,autoHabitation:false,detail:0});
 const parent=ship.parts[0],hit=C.rayPart([20,200,30],[0,-1,0],parent);assert.ok(hit);
 const c=[20,hit.p[1]+8,30],r=C.solvePlacement(ship,{id:2,k:'struct',form:'box',c,s:[16,16,20],yaw:0},{mode:'horizontal',parentStructureId:1,position:c,hit:{p:Array.from(hit.p),n:Array.from(hit.n)},contactFit:'cut',contactSide:'bottom'});
 assert.equal(r.ok,true,r.error);ship.parts.push(r.part);assert.ok(C.refreshPlacementGeometry(ship).ok);
 return {ship,parent,part:ship.parts.find(p=>p.id===2)};
}
const record=p=>C.publicJSON(p.placement);

test('the fitted shape is stored with the part and a reload rebuilds the same solid',()=>{
 const {ship,part}=fixture(),g=part.placement.fittedGeometry;
 assert.ok(g&&Array.isArray(g.v)&&Array.isArray(g.f)&&g.f.length>=4,'stored mesh');
 const volume=C.partVolume(part);assert.ok(volume<16*16*20-1,'the base is cut to the sloped parent');
 const loaded=C.deserialize(C.serialize(ship)),copy=loaded.parts.find(p=>p.id===2);C.refreshPlacementGeometry(loaded);
 assert.equal(record(copy),record(part));assert.equal(C.partVolume(copy),volume);assert.deepEqual(tris(copy),tris(part));
});

for(const [name,edit] of [
 ['raised',p=>{p.c=[p.c[0],p.c[1]+3,p.c[2]];}],
 ['turned',p=>{p.pitch=-4;}],
 ['resized',p=>{p.s=[140,80,26];}],
])test(`the body below ${name}: the child keeps its stored shape, pose and placement record`,()=>{
 const {ship,parent,part}=fixture(),before={record:record(part),c:plain(part.c),volume:C.partVolume(part),tris:tris(part)};
 edit(parent,ship);C.refreshPlacementGeometry(ship);
 assert.equal(record(part),before.record);assert.deepEqual(plain(part.c),before.c);assert.equal(C.partVolume(part),before.volume);assert.deepEqual(tris(part),before.tris);
 // The same after a reload of the edited ship.
 const loaded=C.deserialize(C.serialize(ship)),copy=loaded.parts.find(p=>p.id===2);C.refreshPlacementGeometry(loaded);assert.equal(record(copy),before.record);assert.equal(C.partVolume(copy),before.volume);
});

test('a new cut through the child carves its stored shape and is not re-fitted; removing the cut restores it exactly',()=>{
 const {ship,part}=fixture(),before={record:record(part),volume:C.partVolume(part),tris:tris(part)};
 ship.solidCuts=[C.normalizeSolidCut({id:9,shape:'box',c:[20,10,30],s:[30,6,30],structures:true})];C.refreshPlacementGeometry(ship);
 assert.equal(record(part),before.record);assert.ok(C.partVolume(part)<before.volume-1,'the cut carves the child');
 ship.solidCuts=[];C.refreshPlacementGeometry(ship);assert.equal(record(part),before.record);assert.equal(C.partVolume(part),before.volume);assert.deepEqual(tris(part),before.tris);
});

test('a child the turned body no longer touches keeps its stored solid where it stands (judged there)',()=>{
 const {ship,parent,part}=fixture(),volume=C.partVolume(part);parent.pitch=-4;const r=C.refreshPlacementGeometry(ship);
 assert.equal(part._placementError,'contact-zero');assert.equal(C.partVolume(part),volume);
});

test('a save from before stage B is fitted once on load, keeping its pose, and then stored',()=>{
 const {ship,part}=fixture(),saved=(v=>typeof v==='string'?JSON.parse(v):structuredClone(v))(C.serialize(ship));
 const raw=saved.parts.find(p=>p.id===2);delete raw.placement.fittedGeometry;
 const loaded=C.deserialize(saved),copy=loaded.parts.find(p=>p.id===2);C.refreshPlacementGeometry(loaded);
 assert.deepEqual(plain(copy.c),plain(part.c));assert.ok(copy.placement.fittedGeometry,'stored after the first fit');near(C.partVolume(copy),C.partVolume(part),1e-6);
 const once=record(copy);C.refreshPlacementGeometry(loaded);assert.equal(record(copy),once);
});

test('a drag or a resize by the user fits anew; turning keeps the stored shape',()=>{
 const {ship,part}=fixture(),g=part.placement.fittedGeometry;
 const turned=C.solvePlacement(ship,{...part,yaw:25},{mode:'horizontal'});assert.equal(turned.ok,true,turned.error);assert.equal(turned.part.placement.fittedGeometry,g,'turning does not re-fit');
 const to=[-30,part.c[1],-20],dragged=C.solvePlacement(ship,part,{mode:'horizontal',position:to});assert.equal(dragged.ok,true,dragged.error);assert.notEqual(C.publicJSON(dragged.part.placement.fittedGeometry),C.publicJSON(g),'a drag fits at the new place');
 assert.equal(C.resizeStructureHeightAtContact(part,30),true);C.refreshPlacementGeometry(ship);assert.notEqual(C.publicJSON(part.placement.fittedGeometry),C.publicJSON(g),'a resize fits anew');assert.equal(part.placement.fittedGeometry.shape,C.placementFitShapeKey(part));
});

test('a mirror copy carries the reflected stored shape',()=>{
 const {ship,part}=fixture(),q=C.mirrorPart(part,ship);q.id=5;ship.parts.push(q);
 assert.ok(q.placement.fittedGeometry);C.placementRestoreFitted(q,q.placement.fittedGeometry);
 near(C.partVolume(q),C.partVolume(part),1e-6);
 const box=T=>[0,1,2].map(i=>Math.min(...T.filter((_,j)=>j%3===i))).concat([0,1,2].map(i=>Math.max(...T.filter((_,j)=>j%3===i)))),a=box(tris(part)),b=box(tris(q));
 // Reflected across z = 0: x and y bounds equal, z bounds swap sign.
 near(b[0],a[0]);near(b[3],a[3]);near(b[1],a[1]);near(b[4],a[4]);near(b[2],-a[5]);near(b[5],-a[2]);
});

test('exterior equipment does not follow the structure it was mounted on',()=>{
 const s=C.newShip({L:200,W:100,H:100,assembly:true},'Stored equipment pose');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[50,0,0],s:[100,80,80]}],fits:[],hatches:[],links:[],groups:[],nextId:2,autoHabitation:false,detail:0});
 const h=C.rayPart([-100,0,0],[1,0,0],s.parts[0]),r=C.solvePlacement(s,{id:-1,k:'engine',c:[-12,0,0],d:8,nozzleLength:4,dir:[-1,0,0]},{mode:'direct',parentStructureId:1,geometryRevision:1,parentGeometryRevision:0,placementModelVersion:C.PLACEMENT_MODEL_VERSION,hit:{p:Array.from(h.p),n:Array.from(h.n)}});
 assert.equal(r.ok,true,r.error);assert.equal(C.acceptPlacementResult(s,r).ok,true);
 const engine=s.parts.find(p=>p.k==='engine'),pose=plain({c:engine.c,dir:engine.dir,roll:engine.roll}),rec=C.publicJSON(engine.placement);
 // A reload or a Worker-style re-solve with nothing changed writes nothing.
 C.refreshPlacementGeometry(s);assert.equal(C.publicJSON(engine.placement),rec);
 const loaded=C.deserialize(structuredClone(C.serialize(s))),le=loaded.parts.find(p=>p.k==='engine');C.refreshPlacementGeometry(loaded);assert.equal(C.publicJSON(le.placement),rec);
 // The body moves: the engine stays; its parent-relative anchors are re-expressed for the same world pose (its
 // contact is judged from them), the revision is not bumped, and the next pass writes nothing more.
 s.parts[0].c=[50,4,0];C.refreshPlacementGeometry(s);
 assert.deepEqual(plain({c:engine.c,dir:engine.dir,roll:engine.roll}),pose);assert.equal(engine.placement.geometryRevision,JSON.parse(rec).geometryRevision);
 const after=C.publicJSON(engine.placement);C.refreshPlacementGeometry(s);assert.equal(C.publicJSON(engine.placement),after);
});

// Review 2026-11-13 (regression, finding 2): the stored fit is used only while its shape key matches, so the key
// must not change through a save/load or the real Worker for any structure form; otherwise a reload would re-fit.
const {designWorker}=require('./helpers/worker-harness.cjs');
const FORMS=[['box',{}],['trap',{taper:.75}],['chamfer',{angles:[24,0,0,0]}],['ellipsoid',{}],['cylinder',{}],['wedge',{}],['dome',{}],['mesh',null]];
function formFixture(form,extra){
 const ship=C.newShip({L:300,W:200,H:100,assembly:true},'Stored fit forms');
 Object.assign(ship,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,80,20],pitch:6}],fits:[],hatches:[],links:[],groups:[],nextId:3,autoHabitation:false,detail:0});
 const parent=ship.parts[0],hit=C.rayPart([20,200,30],[0,-1,0],parent),c=[20,hit.p[1]+8,30];let input={id:2,k:'struct',form,c,s:[16,16,20],yaw:0,...(extra||{})};
 if(form==='mesh'){const b={id:2,k:'struct',form:'box',c,s:[16,16,20],yaw:0};input={...b,form:'mesh',mesh:C.structToMesh(b)};}
 const r=C.solvePlacement(ship,input,{mode:'horizontal',parentStructureId:1,position:c,hit:{p:Array.from(hit.p),n:Array.from(hit.n)},contactFit:'cut',contactSide:'bottom'});
 if(!r.ok)return {skip:r.code};ship.parts.push(r.part);C.refreshPlacementGeometry(ship);return {ship,part:ship.parts.find(p=>p.id===2)};
}
for(const [form,extra] of FORMS)test(`the stored fit of a ${form} survives a save/load and the real Worker unchanged (no re-fit)`,async t=>{
 const f=formFixture(form,extra);if(f.skip){t.skip(`${form} cannot be placed horizontally here: ${f.skip}`);return;}
 const {ship,part}=f,record=record_(part);assert.ok(part.placement.fittedGeometry,'stored');assert.equal(part.placement.fittedGeometry.shape,C.placementFitShapeKey(part));
 const L=C.deserialize(structuredClone(C.serialize(ship))),q=L.parts.find(p=>p.id===2);assert.equal(C.placementFitShapeKey(q),part.placement.fittedGeometry.shape,'key stable through save/load');C.refreshPlacementGeometry(L);assert.equal(record_(q),record);
 const w=designWorker(root,C),start=JSON.parse(C.publicJSON(ship)),first=await w.update(start,{reset:true}),again=await w.update(JSON.parse(JSON.stringify(first.surfaceState||first.state)));
 for(const st of [first.state,first.surfaceState,again.state,again.surfaceState])assert.equal(JSON.stringify(st.parts.find(p=>p.id===2).placement),JSON.stringify(JSON.parse(record)),'the Worker writes nothing');
});
function record_(p){return C.publicJSON(p.placement);}

test('an appearance edit (paint, skin, label) does not re-fit a child whose parent has moved',()=>{
 const {ship,parent,part}=fixture(),g=C.publicJSON(part.placement.fittedGeometry);parent.c=[parent.c[0],parent.c[1]+2,parent.c[2]];C.refreshPlacementGeometry(ship);
 part.paint='#aa3300';part.label='Painted';part.skin='plates';C.refreshPlacementGeometry(ship);assert.equal(C.publicJSON(part.placement.fittedGeometry),g);
});

// Review 2026-11-13 (regression, finding 3): copies carry the stored shape; the copy's solid must be the same live and
// after a reload, and a reflected copy must be the reflection of the source.
const solidOf=p=>({volume:+C.partVolume(p).toFixed(9),box:(T=>[0,1,2].map(i=>Math.min(...T.filter((_,j)=>j%3===i))).concat([0,1,2].map(i=>Math.max(...T.filter((_,j)=>j%3===i)))).map(v=>+v.toFixed(6)))(tris(p))});
function liveEqualsReload(ship,ids){const L=C.deserialize(structuredClone(C.serialize(ship)));C.refreshPlacementGeometry(L);for(const id of ids){const a=ship.parts.find(p=>p.id===id),b=L.parts.find(p=>p.id===id);assert.deepEqual(solidOf(b),solidOf(a),'copy #'+id+' live = reload');assert.equal(C.publicJSON(b.placement),C.publicJSON(a.placement));}}
test('a vertical (up/down) mirror copy carries the reflected stored shape, live = reload',()=>{
 const {ship,part}=fixture(),q=C.vmirrorPart(part,ship);q.id=5;ship.parts.push(q);ship.nextId=6;assert.ok(q.placement.fittedGeometry);C.placementRestoreFitted(q,q.placement.fittedGeometry);
 near(C.partVolume(q),C.partVolume(part),1e-6);const a=solidOf(part).box,b=solidOf(q).box;near(b[0],a[0],1e-6);near(b[3],a[3],1e-6);near(b[2],a[2],1e-6);near(b[5],a[5],1e-6);near(b[4]-b[1],a[4]-a[1],1e-6);
});
test('a vertical-mode child mirrored across the centreline carries the reflected stored shape, live = reload',()=>{
 const ship=C.newShip({L:300,W:200,H:100,assembly:true},'Stored fit vertical');Object.assign(ship,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,40,60],yaw:8}],fits:[],hatches:[],links:[],groups:[],nextId:3,autoHabitation:false,detail:0});
 const parent=ship.parts[0],hit=C.rayPart([10,0,200],[0,0,-1],parent),c=[10,0,hit.p[2]+6],r=C.solvePlacement(ship,{id:2,k:'struct',form:'box',c,s:[10,14,16],yaw:0},{mode:'vertical',parentStructureId:1,position:c,hit:{p:Array.from(hit.p),n:Array.from(hit.n)},contactFit:'cut',contactSide:'port'});
 if(!r.ok){assert.fail('vertical placement: '+r.code);}ship.parts.push(r.part);C.refreshPlacementGeometry(ship);const part=ship.parts.find(p=>p.id===2);assert.ok(part.placement.fittedGeometry);
 const q=C.mirrorPart(part,ship);q.id=5;ship.parts.push(q);ship.nextId=6;C.refreshPlacementGeometry(ship);near(C.partVolume(q),C.partVolume(part),1e-6);const a=solidOf(part).box,b=solidOf(q).box;near(b[2],-a[5],1e-6);near(b[5],-a[2],1e-6);
 liveEqualsReload(ship,[2,5]);
});
test('rotated array copies keep a consistent stored shape, live = reload',()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'t');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts.find(p=>C.isShapePart(p));
 const raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},input={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+1.8,hit.p[2]],s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0};
 const d=C.preparePlacementDraft(ship,input,{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit,contactFit:'cut',position:input.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});ship.parts.push(d.part);ship.nextId++;C.refreshPlacementGeometry(ship);const box=ship.parts.at(-1);
 const res=C.placeRotationalCopies(ship,{parts:[box.id],fits:[]},{count:4,axis:0,center:[110,0,0]});assert.equal(res.ok,true,res.error);C.refreshPlacementGeometry(ship);
 for(const id of res.parts){const p=ship.parts.find(q=>q.id===id);assert.ok(p.placement.fittedGeometry,'copy #'+id+' stores its shape');assert.equal(p.placement.fittedGeometry.shape,C.placementFitShapeKey(p));}
 liveEqualsReload(ship,res.parts);
});
