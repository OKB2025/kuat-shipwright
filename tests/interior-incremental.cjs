// Interior compartments and engine foundations are recomputed only where an edited structure reaches
// (user request 2026-11-12: a structure move re-clips the rooms that its old or new bounds touch, not
// every room on the ship). The result must equal a full recompute: after each edit in a series, the
// incrementally updated design is compared with the same public design loaded fresh, the way the
// Worker loads a reset (refreshPlacementGeometry, syncCompartments, remount, syncCompartments).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const {userFixture}=require('./helpers/edit-latency-fixtures.cjs');

function derive(s){C.refreshPlacementGeometry(s);C.syncCompartments(s);C.remount(s);C.syncCompartments(s);return s;}
function fresh(s){return derive(JSON.parse(C.publicJSON(s)));}
const digest=t=>{if(!t)return null;let h=0;for(let i=0;i<t.length;i++)h=(h*31+Math.round(t[i]*1e6))%2147483647;return [t.length,h];};
function snapshot(s,shapeVolume=true){
 return s.parts.map(p=>({id:p.id,k:p.k,volume:shapeVolume||!C.isShapePart(p)?C.partVolume(p):null,clip:p._clip?[p._clip.volume,p._clip.retained,digest(p._clip.tris)]:null,
  packing:p._packing?[p._packing.volume,JSON.stringify(p._packing.boxes)]:null,interiorError:p._interiorPlacementError?.code||null,
  seatOutside:p._seatOutside??null,group:p._packingGroup?p._packingGroup.ids.join(','):null,
  support:p.engineMountSupport?C.publicJSON(p.engineMountSupport):null,supportError:p._engineMountSupportError||null,
  placementError:p._placementError||null}));
}
const statsJSON=s=>JSON.stringify(C.computeStats(s),(k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v);
// A cold load re-solves placed structures from their requests; that solve can differ from the stored
// pose in the last bit of a contact normal (also on main, without any incremental cache). Public
// state is compared to 1e-9; derived interiors and statistics exactly.
function close(a,b,where){
 if(typeof a==='number'&&typeof b==='number'){assert.ok(a===b||Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)),where+': '+a+' != '+b);return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),where);for(const k of Object.keys(a))close(a[k],b[k],where+'.'+k);return;}
 assert.equal(a,b,where);
}
function same(live,label,{stats=true,shapeVolume=true,publicState=true}={}){
 const cold=fresh(live);
 if(publicState)close(JSON.parse(C.publicJSON(live)),JSON.parse(C.publicJSON(cold)),label+': public state');
 assert.deepEqual(snapshot(live,shapeVolume),snapshot(cold,shapeVolume),label+': derived interior and foundations');
 if(stats)assert.equal(statsJSON(live),statsJSON(cold),label+': statistics equal a fresh load');
}

// The user-style design plus probes the edits reach: rooms straddling the deck (legacy and explicit
// clip), a movable box structure on the deck, and two engines without a foundation.
function design(){
 const s=userFixture(C,{interior:16,structures:2});
 const add=p=>{p.id=s.nextId++;s.parts.push(p);return p;};
 const mover=add({k:'struct',form:'box',c:[215,66,0],s:[24,10,16],taper:0,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0});
 const legacyNear=add({k:'cargo',c:[250,70,0],d:8}),legacyFar=add({k:'cargo',c:[120,70,-6],d:6});
 // The explicit room stays valid throughout (partly inside the hull): a refused re-solve keeps its last
 // valid clipped body by rule (tests/clipped-hangar-hatch.cjs), which a fresh load cannot reproduce.
 const explicit=add({k:'fuel',c:[238,62,10],d:6});explicit.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'clip',geometryRevision:1,hostId:1,requestedGeometry:JSON.parse(C.publicJSON(explicit))};
 for(const [y,z] of [[74,30],[80,-30]])add({k:'engine',c:[260,y,z],d:6,dir:[-1,0,0]});
 return {s:derive(s),mover:mover.id,legacyNear:legacyNear.id,legacyFar:legacyFar.id,explicit:explicit.id};
}

test('a series of structure edits gives the same interior, foundations and statistics as a full recompute',()=>{
 const {s,mover,legacyNear,legacyFar,explicit}=design(),part=id=>s.parts.find(p=>p.id===id);
 same(s,'initial');
 const far=part(legacyFar),farClip=far._clip,clipped=s.parts.filter(p=>p._clip&&p.id!==legacyNear&&p.id!==explicit);
 assert.ok(farClip,'precondition: the far room is clipped by the hull');
 // 1. A move that stays clear of every probe room.
 const solvedKeys=new Map(s.parts.filter(p=>p._explicitInteriorKey&&p.id!==explicit).map(p=>[p.id,p._explicitInteriorKey]));assert.ok(solvedKeys.size>=10);
 part(mover).c=[222,66,0];derive(s);same(s,'move clear');
 assert.equal(far._clip,farClip,'a room the structure never reaches is not re-clipped');
 for(const p of clipped)assert.equal(p._clipKey!=null,true);
 for(const [id,key] of solvedKeys)assert.equal(part(id)._explicitInteriorKey,key,'explicit room #'+id+' is not re-solved');
 // 2. Into the straddling rooms: the new bounds reach them.
 const nearBefore=part(legacyNear)._clip;
 const explicitKey=part(explicit)._explicitInteriorKey;
 part(mover).c=[244,66,4];derive(s);same(s,'move onto rooms');
 assert.notEqual(part(explicit)._explicitInteriorKey,explicitKey,'an explicit room the new bounds touch is re-solved');
 assert.equal(part(explicit)._interiorPlacementError,undefined,'the explicit probe stays valid');
 assert.notEqual(part(legacyNear)._clip,nearBefore,'a room the new bounds touch is re-clipped');
 // 3. Away again: the old bounds release them.
 const nearInside=part(legacyNear)._clip;
 part(mover).c=[280,66,0];derive(s);same(s,'move away');
 assert.equal(part(explicit)._explicitInteriorKey,explicitKey,'released by the old bounds, the explicit room is re-solved to its first key');
 assert.equal(part(explicit)._interiorPlacementError,undefined);
 assert.notEqual(part(legacyNear)._clip,nearInside,'a room the old bounds touched is re-clipped');
 assert.equal(far._clip,farClip);
 // 4. Resize, 5. a new structure over the far room, 6. delete it, 7. a ship-level cut (global).
 part(mover).s=[30,12,18];derive(s);same(s,'resize');
 s.parts.push({id:s.nextId++,k:'struct',form:'box',c:[120,72,-6],s:[12,8,12],taper:0,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0});derive(s);same(s,'add structure');
 assert.notEqual(far._clip,farClip,'a structure added over a room re-clips it');
 s.parts.pop();derive(s);same(s,'delete structure');
 // A ship-level cut changes every key. After any solid cut a deck structure's own volume differs by
 // 2e-4 m³ between the live design and a reload (1760.00000000006 against 1759.9998 on main b40b72d
 // too, without this change), so this step compares the interior, not structure volumes or totals.
 s.solidCuts.push(C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[60,72,0],s:[6,6,6],structures:true}));delete s._cache;derive(s);same(s,'ship cut',{stats:false,shapeVolume:false});
});

test('an Imperial-style example keeps its engine foundations and rooms equal to a full recompute after moves',()=>{
 const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/acclamator/design.json.gz'))));
 const s=derive(C.deserialize(raw)),structs=s.parts.filter(p=>C.isShapePart(p)&&!C.isHullStructure(p));
 const supported=s.parts.filter(p=>p.k==='engine'&&p.engineMountSupport);assert.ok(supported.length,'precondition: foundations exist');
 const kept=new Map(supported.map(p=>[p.id,p.engineMountSupport]));
 // The structure farthest from every engine moves: no foundation is recast.
 const engines=s.parts.filter(p=>p.k==='engine'),distance=q=>Math.min(...engines.map(e=>Math.hypot(...[0,1,2].map(i=>q.c[i]-e.c[i]))));
 const target=structs.slice().sort((a,b)=>distance(b)-distance(a))[0];
 target.c=[target.c[0]+3,target.c[1],target.c[2]];derive(s);same(s,'far structure move',{stats:false});
 for(const p of supported)assert.equal(p.engineMountSupport,kept.get(p.id),'foundation #'+p.id+' is kept');
 // The structure carrying a foundation moves: that foundation is rebuilt.
 const carrier=s.parts.find(q=>q.id===supported[0].engineMountSupport.parentId);
 if(carrier&&!C.isHullStructure(carrier)){carrier.c=[carrier.c[0],carrier.c[1]-.5,carrier.c[2]];derive(s);same(s,'carrier move',{stats:false});}
});

// The parent-move case follows the user decision (2026-11-12, PR #97): a child structure does not follow its
// parent, so moving the parent leaves the child where it is; the child is then moved by the user edit itself.
// Review 2026-11-12: key coverage. Rotated and mirrored structures, a carried child that alone reaches a
// room, a hatched hangar and a structure touching it, a sub added and removed, and a shape change that
// changes a structure's bounds, each compared with a fresh load.
test('rotated, mirrored, carried-child, hatch, sub and shape edits equal a full recompute',()=>{
 const s=userFixture(C,{interior:8,structures:1});const add=p=>{p.id=s.nextId++;s.parts.push(p);return p;},part=id=>s.parts.find(p=>p.id===id);
 const box=(c,size,extra={})=>({k:'struct',form:'box',c,s:size,taper:0,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0,...extra});
 // Rooms straddling the deck for each probe.
 const rRot=add({k:'cargo',c:[200,66,0],d:6}),rMir=add({k:'cargo',c:[170,66,10],d:5}),rMir2=add({k:'cargo',c:[170,66,-10],d:5});
 const rotated=add(box([214,66,0],[16,8,10],{yaw:30}));
 const [mirA,mirB]=[add(box([160,66,10],[12,6,10])),add(box([160,66,-10],[12,6,10]))];
 // A parent with a child placed on its top; only the child reaches room rChild.
 const parent=add(box([130,72,0],[10,10,8]));derive(s);
 const top=C.rayPart([130,500,0],[0,-1,0],parent),draft=C.preparePlacementDraft(s,box([130,top.p[1]+3,0],[6,6,6],{id:s.nextId}),{mode:'horizontal',parentStructureId:parent.id,hostId:parent.id,hit:{p:top.p,n:C.norm(top.n)},contactFit:'cut',position:[130,top.p[1]+3,0],placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(draft.ok,true,draft.error);s.parts.push(draft.part);s.nextId++;const child=draft.part;
 // The room sits 5 cm beside the child: within the key's 10 cm margin, without overlapping it (an
 // overlap would be a placement interference of the child, not an interior question).
 const cb=C.partAABB(child),rChild=add({k:'cargo',c:[cb[3]+.05+1.5,(cb[1]+cb[4])/2,0],d:3});
 // A second room 15 cm beside the child, outside the margin: the child's move must not recompute it.
 const rOut=add({k:'cargo',c:[(cb[0]+cb[3])/2,(cb[1]+cb[4])/2,cb[2]-.15-1.5],d:3});
 derive(s);same(s,'probes');
 const childClip=()=>part(rChild.id)._clip,parentBox=C.partAABB(parent),roomBox=C.partAABB(part(rChild.id));
 assert.ok(roomBox[1]>parentBox[4]+.1,'precondition: the room is clear of the parent bounds');
 // Rotated structure moves onto, then off, its room.
 part(rotated.id).c=[204,66,2];derive(s);same(s,'rotated onto');part(rotated.id).yaw=60;derive(s);same(s,'rotated turn');part(rotated.id).c=[240,66,0];derive(s);same(s,'rotated away');
 // Mirrored pair moves together, as the editor moves a mirrored pair.
 for(const dx of [8,-14]){part(mirA.id).c=[part(mirA.id).c[0]+dx,66,10];part(mirB.id).c=[part(mirB.id).c[0]+dx,66,-10];derive(s);same(s,'mirrored pair '+dx);}
 // The parent moves and its child stays (no parent follow); then the child is moved and alone leaves the room.
 const beforeChild=childClip(),childKey=part(rChild.id)._clipKey,outKey=part(rOut.id)._clipKey,outBox=C.partAABB(part(rOut.id)),childBox=C.partAABB(part(child.id));
 assert.ok(childBox[2]-outBox[5]>.1+1e-9&&outBox[1]>parentBox[4]+.1,'precondition: the second room is outside the 10 cm margin of the child and the parent');
 const childC=part(child.id).c.slice();
 part(parent.id).c=[124,72,0];derive(s);same(s,'parent move');
 assert.deepEqual(part(child.id).c,childC,'the child stays where it was placed when its parent moves');
 part(child.id).c=[childC[0]-6,childC[1],childC[2]];derive(s);same(s,'child move');
 assert.ok(part(child.id).c[0]<128,'the child moved');
 assert.notEqual(part(rChild.id)._clipKey,childKey,'the room only the child reached is re-clipped');void beforeChild;
 assert.equal(part(rOut.id)._clipKey,outKey,'the room 15 cm away (outside the margin) is not recomputed');
 // A sub (legacy box cut) added and removed changes every key. A cut renumbers semantic face ids, so
 // the child's stored hostSurfaceId (a hint, docs/design-placement-v1.2.md) differs from a reload's while
 // the sub exists. The same single difference (.parts[18].placement.hostSurfaceId) comes from main's full
 // recompute (checked 2026-11-12 on e5527e1 by diffing the public states at this step with KS_TEST_ROOT set
 // to a main checkout); after its removal all is compared;
 // with the cut's known structure-volume difference, only the interior is compared here.
 const sub={b:[60,60,-6,70,80,6]};s.subs.push(sub);delete s._cache;derive(s);same(s,'sub added',{stats:false,shapeVolume:false,publicState:false});
 s.subs.splice(s.subs.indexOf(sub),1);delete s._cache;derive(s);same(s,'sub removed');
 // A shape change that changes the bounds.
 Object.assign(part(rotated.id),{c:[204,66,0],form:'trap',taper:.4,s:[22,8,14]});derive(s);same(s,'shape change');
});

test('a hatched hangar keeps the whole-envelope key and a structure touching it equals a full recompute',()=>{
 const s=userFixture(C,{interior:6,structures:1});const add=p=>{p.id=s.nextId++;s.parts.push(p);return p;},part=id=>s.parts.find(p=>p.id===id);
 const solved=C.solvePlacement(s,{id:s.nextId,k:'hangar',c:[200,58,0],d:Math.cbrt(2000),room:[16,10,12]},{mode:'clip',hostId:1});
 assert.equal(solved.ok,true,solved.error);s.parts.push(solved.part);s.nextId++;const bay=solved.part;
 const hatch=C.setAviationSurfaceMode(s,bay,'top','open');derive(s);
 assert.ok(s.hatches.some(h=>h.bay===bay.id),'precondition: the bay has a hatch '+!!hatch);same(s,'hatched bay');
 const key=bay._explicitInteriorKey;
 const toucher=add({k:'struct',form:'box',c:[250,66,0],s:[10,6,8],taper:0,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0});derive(s);same(s,'structure far from the bay');
 assert.notEqual(part(bay.id)._explicitInteriorKey,key,'a hatched bay keeps the whole-envelope key (any structure edit re-solves it)');
 part(toucher.id).c=[205,66,0];derive(s);same(s,'structure touching the bay');
 part(toucher.id).c=[250,66,0];derive(s);same(s,'structure leaves the bay');
});

// An explicit room p behind a legacy room q reads q's fitted shape (q._clip is subtracted from p's solve).
// A structure S moved next to q, but more than the 10 cm margin away from p's bounds, re-clips q; p must
// then be re-solved too, or it differs from a full recompute (independent check 2026-11-12; main re-solves
// every room on any structure move and agreed).
test('an explicit room is re-solved when a room it is solved against is re-clipped by a structure outside its bounds',()=>{
 const row=p=>({id:p.id,k:p.k,vol:C.partVolume(p),clip:p._clip?[p._clip.volume,digest(p._clip.tris)]:null,packing:p._packing?[p._packing.volume,JSON.stringify(p._packing.boxes).length]:null,err:p._interiorPlacementError?.code||null});
 for(const sc of [[238,69.3,10],[238,68,16.2],[236,69.3,10]]){
  const s=userFixture(C,{interior:4,structures:1}),add=p=>{p.id=s.nextId++;s.parts.push(p);return p;},part=id=>s.parts.find(p=>p.id===id);
  const q=add({k:'cargo',c:[238,68,10],d:8}),p=add({k:'fuel',c:[238,62,10],d:6});
  p.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'clip',geometryRevision:1,hostId:1,requestedGeometry:JSON.parse(C.publicJSON(p))};
  const S=add({k:'struct',form:'box',c:[300,68,10],s:[8,6,8],taper:0,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0});derive(s);
  const qClip=part(q.id)._clip;part(S.id).c=sc;derive(s);
  assert.notEqual(part(q.id)._clip,qClip,`S at [${sc}] re-clips the room it touches`);
  const cold=fresh(s);
  assert.deepEqual([row(part(p.id)),row(part(q.id))],[row(cold.parts.find(x=>x.id===p.id)),row(cold.parts.find(x=>x.id===q.id))],`S at [${sc}]: the explicit room equals a full recompute`);
 }
});
