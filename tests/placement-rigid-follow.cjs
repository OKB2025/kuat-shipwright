// Rigid follow (user decision 1, 2026-11-11, docs/design-placement-v1.2.md "削りと接続", stage 3): when a
// parent structure or the hull is moved, turned or resized, the structures attached to it follow as a rigid
// group and keep their own shape; their children follow in turn, and so do equipment and fittings on them.
// The pose is derived from the parent and the saved relation, so the live result, a reload and the editor's
// own copy (which the engine never updates: the Worker is handed the old child pose with the new parent)
// all agree. After following, connection is judged by contact: touching -> connected, cut away -> severed
// (warning), otherwise a failure; a child is never left behind.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const CIGAR={L:200,W:32,H:32,plan:'cigar',sec:'ellipse'};
const near=(a,b,m,t=1e-6)=>{assert.equal(a.length,b.length,m);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<=t*Math.max(1,Math.abs(b[i])),`${m}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`));};
const close=(a,b,m,t=1e-6)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${m}: ${a} vs ${b}`);
const vol=T=>{let v=0;for(let i=0;i<T.length;i+=9)v+=(T[i]*(T[i+4]*T[i+8]-T[i+5]*T[i+7])-T[i+1]*(T[i+3]*T[i+8]-T[i+5]*T[i+6])+T[i+2]*(T[i+3]*T[i+7]-T[i+4]*T[i+6]))/6;return v;};
function placeOn(ship,parent,x,label,size=[16,8,6],lift=1.8,z=0){
 const raw=C.rayPart([x,500,z],[0,-1,0],parent),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+lift,hit.p[2]];
 const d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',label,c,s:size,yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:parent.id,hostId:parent.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));return ship.parts.find(q=>q.label===label);
}
// P on the hull, B on P (a grandchild of the hull).
function stack(){const s=C.newShip(CIGAR,'rigid follow');s.fits=[];C.ensurePrimaryHull(s);const hull=s.parts[0];placeOn(s,hull,90,'P');placeOn(s,s.parts.find(q=>q.label==='P'),88,'B',[6,6,4],1.2);return s;}
const part=(s,label)=>s.parts.find(q=>q.label===label);
function look(s,label){const p=part(s,label);p._solidCutShip=s;const f=C.structFrame(p);return {c:p.c.slice(),fw:f.fw,up:f.up,s:p.s.slice(),volume:vol(C.structTriangles(p)),error:p._placementError||null,severed:!!p._placementSevered};}
// The rigid image of a child under the parent's motion from frame A to frame B.
function image(before,parentBefore,parentAfter){const a=C.structFrame(parentBefore),b=C.structFrame(parentAfter),map=v=>{const l=[C.dot(v,a.fw),C.dot(v,a.up),C.dot(v,a.rt)];return C.add(C.add(C.mul(b.fw,l[0]),C.mul(b.up,l[1])),C.mul(b.rt,l[2]));};
 return {c:C.add(parentAfter.c,map(C.sub(before.c,parentBefore.c))),fw:map(before.fw),up:map(before.up)};}
const reload=s=>C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));
// The editor's copy: the saved design before the edit with only the edited parent changed (the engine never
// writes the followed poses back to the editor), loaded as the Worker or a reload of that save would.
function editorCopy(saved,edit){const o=JSON.parse(JSON.stringify(saved));edit(o.parts[0]);return C.deserialize(o);}
function same(a,b,m){near(a.c,b.c,m+' c');near(a.fw,b.fw,m+' fw');near(a.up,b.up,m+' up');close(a.volume,b.volume,m+' volume');assert.equal(a.error,b.error,m+' error');assert.equal(a.severed,b.severed,m+' severed');}

for(const [name,edit] of [['yaw 25°',h=>{h.yaw=25;}],['pitch 10°',h=>{h.pitch=10;}],['roll 8° and yaw 15°',h=>{h.roll=8;h.yaw=15;}],['move',h=>{h.c=[h.c[0]+15,h.c[1]+5,h.c[2]-7];}]])
 test(`hull ${name}: the child and the grandchild follow as a rigid group, keep their fitted shape, and live = reload = editor copy`,()=>{
  const s=stack(),hull=s.parts[0],hull0=JSON.parse(C.publicJSON(hull)),P0=look(s,'P'),B0=look(s,'B'),saved=JSON.parse(C.publicJSON(C.serialize(s)));
  edit(hull);s._cache=null;const r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
  const P=look(s,'P'),B=look(s,'B'),want=image(P0,hull0,hull),wantB=image(B0,hull0,hull);
  near(P.c,want.c,'P c');near(P.fw,want.fw,'P fw');near(P.up,want.up,'P up');near(B.c,wantB.c,'B c');near(B.fw,wantB.fw,'B fw');near(B.up,wantB.up,'B up');
  close(P.volume,P0.volume,'P keeps its fitted shape',1e-6);close(B.volume,B0.volume,'B keeps its fitted shape',1e-6);near(P.s,P0.s,'P size');assert.equal(P.error,null);assert.equal(B.error,null);
  const L=reload(s),E=editorCopy(saved,edit);
  for(const label of ['P','B']){same(look(L,label),look(s,label),name+' reload '+label);same(look(E,label),look(s,label),name+' editor copy '+label);}
 });

test('turning P itself (an edit of P) carries B with it; P is re-solved as edited, B follows',()=>{
 const s=stack(),P=part(s,'P'),P0=JSON.parse(C.publicJSON(P)),B0=look(s,'B');P.yaw=30;s._cache=null;const r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
 const want=image(B0,P0,P),B=look(s,'B');near(B.c,want.c,'B c');near(B.fw,want.fw,'B fw');close(B.volume,B0.volume,'B shape');same(look(reload(s),'B'),B,'reload');
});

// keep: the cut-fit carve made for the old hull still touches the resized one and is kept (P's fitted volume is
// unchanged). On the taller hull the old carve meets the flatter deck only along a line (no contact area), so
// the existing rule keeps P connected with its whole requested body instead (overlap is contact).
for(const [name,dims,keep] of [['wider',{W:40},true],['taller',{H:40},false],['longer',{L:240},true],['smaller',{L:160,W:24,H:24},true]])
 test(`hull resize (${name}): the contact point moves with the scaled surface; the child keeps its size, its offset along the contact normal${keep?' and its fitted shape':''}; live = reload = editor copy = Worker copy`,()=>{
  const s=stack(),hull=s.parts[0],P0=part(s,'P'),meta0=JSON.parse(JSON.stringify(P0.placement)),c0=P0.c.slice(),B0=look(s,'B'),saved=JSON.parse(C.publicJSON(C.serialize(s)));
  const apply=h=>{Object.assign(h.hullProfile,dims);h.s=[h.hullProfile.L,h.hullProfile.W,h.hullProfile.H];};
  const oldDims=meta0.anchorDimensions;apply(hull);s._cache=null;const r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
  const P=look(s,'P'),dimsNow=[hull.s[0],hull.s[2],hull.s[1]],anchor=C.worldStruct(hull,meta0.surfaceAnchor.map((v,i)=>v*dimsNow[i]/oldDims[i]));
  // The child's offset from its contact point is unchanged (the hull is not turned, so it is the same vector).
  const offset0=C.sub(c0,C.worldStruct(saved.parts[0],meta0.surfaceAnchor));near(C.sub(P.c,anchor),offset0,'offset along the normal kept');near(P.s,[16,8,6],'size kept');
  const B=look(s,'B');near(C.sub(B.c,P.c),C.sub(B0.c,c0),'B rides on P');close(B.volume,B0.volume,'B shape');assert.equal(P.error,null);
  if(keep){close(P.volume,look(stack(),'P').volume,'P keeps its fitted volume',1e-9);assert.equal(part(s,'P')._placementKeptWhole,undefined);}else{close(P.volume,16*8*6,'whole requested body');assert.ok(part(s,'P')._placementKeptWhole);}
  // Worker copy: the warm Worker ship patched with the editor's state (old child poses, resized hull).
  const W=stack(),edited=JSON.parse(JSON.stringify(saved));apply(edited.parts[0]);C.patchShip(W,edited);W._cache=null;const rw=C.refreshPlacementGeometry(W);assert.equal(rw.failed.length,0,JSON.stringify(rw.failed));
  const E=editorCopy(saved,apply);for(const label of ['P','B']){same(look(reload(s),label),look(s,label),name+' reload '+label);same(look(E,label),look(s,label),name+' editor copy '+label);same(look(W,label),look(s,label),name+' Worker copy '+label);}
 });

test('a mirrored pair of structures moved and turned as mirror images: their children follow as mirror images',()=>{
 const s=C.newShip(CIGAR,'mirror pair');s.fits=[];C.ensurePrimaryHull(s);const hull=s.parts[0];
 const P=placeOn(s,hull,90,'P',[16,8,6],1.8,4),Q=placeOn(s,hull,90,'Q',[16,8,6],1.8,-4);placeOn(s,P,86,'BP',[6,6,4],1.2,4);placeOn(s,Q,86,'BQ',[6,6,4],1.2,-4);
 P.c=[P.c[0]+6,P.c[1],P.c[2]+1];Q.c=[Q.c[0]+6,Q.c[1],Q.c[2]-1];P.yaw=15;Q.yaw=-15;s._cache=null;const r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
 const bp=look(s,'BP'),bq=look(s,'BQ');near(bq.c,[bp.c[0],bp.c[1],-bp.c[2]],'BQ mirrors BP');near(bq.fw,[bp.fw[0],bp.fw[1],-bp.fw[2]],'BQ heading mirrors BP');close(bq.volume,bp.volume,'same shape');
  for(const label of ['BP','BQ'])same(look(reload(s),label),look(s,label),'reload '+label);
});

test('equipment and a fitting on P follow P when the hull turns and moves (live)',()=>{
 const s=stack(),P=part(s,'P'),top=C.partAABB(P)[4];
 const sensor=C.commitPlacement(s,{id:-1,k:'sensor',c:[86,top+1.84,0],d:4},{mode:'direct',parentStructureId:P.id,geometryRevision:1,parentGeometryRevision:P.placement?.geometryRevision||0,hit:{p:[86,top,0],n:[0,1,0]}});assert.equal(sensor.ok,true,sensor.error);
 const fit=C.commitPlacement(s,{id:-1,k:'pd',p:[94,top,0],n:[0,1,0],a:2,ped:0},{entityKind:'fit',list:'fits',mode:'direct',hostId:P.id,hit:{p:[94,top,0],n:[0,1,0]}});assert.equal(fit.ok,true,fit.error);C.refreshPlacementGeometry(s);
 const S=s.parts.find(q=>q.k==='sensor'),F=s.fits.find(f=>f.k==='pd'),sl=C.localStruct(P,S.c),fl=C.localStruct(P,F.p),fn=C.placementLocalNormal?.(P,F.n)||null;
 const hull=s.parts[0];hull.yaw=30;hull.pitch=6;hull.c=[hull.c[0]+10,hull.c[1],hull.c[2]+3];s._cache=null;const r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
 near(C.localStruct(P,S.c),sl,'the sensor keeps its place on P');near(C.localStruct(P,F.p),fl,'the fitting keeps its place on P');assert.equal(S._placementError,undefined);assert.equal(F._fitPlacementError,undefined);
 near(C.structFrame(P).up,C.norm(F.n),'the fitting stands on P\'s turned deck');
});

test('a child that ends up separated: the hull moves and turns its child under a fixed ship-level cut -> severed (a warning), carried, never left behind; reload agrees',()=>{
 const s=stack(),hull=s.parts[0],P0=look(s,'P'),hull0=JSON.parse(C.publicJSON(hull)),edit=h=>{h.c=[h.c[0],h.c[1],h.c[2]+40];h.yaw=10;};
 // A cut carving structures where P's deck will be once the hull has moved: nothing is there yet.
 edit(hull);s._cache=null;C.refreshPlacementGeometry(s);const at=look(s,'P');Object.assign(hull,{c:hull0.c.slice(),yaw:0});s._cache=null;C.refreshPlacementGeometry(s);near(look(s,'P').c,P0.c,'back');
 s.solidCuts.push(C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[at.c[0],26,at.c[2]],s:[22,22,16],structures:true}));s._cache=null;C.refreshPlacementGeometry(s);assert.equal(look(s,'P').severed,false,'nothing is cut yet');
 edit(hull);s._cache=null;const r=C.refreshPlacementGeometry(s);
 const P=look(s,'P'),want=image(P0,hull0,hull);near(P.c,want.c,'P carried to the moved pose');near(P.fw,want.fw,'and turned');assert.equal(P.error,null);assert.equal(P.severed,true,'severed by the cut');assert.ok(r.severed.some(q=>q.partId===part(s,'P').id));
 const S={warnings:[]};C.groundingStats(s,S);assert.ok(!S.ungrounded.parts.includes(part(s,'P').id),'no red frame');assert.ok(S.severed.includes(part(s,'P').id));
 same(look(reload(s),'P'),P,'reload');
});

// The editor never runs the placement refresh: it sends its own public state, the Worker patches its warm
// copy with it (engine.js applyState: patchShip) and refreshes. Undo and redo send earlier and later editor
// snapshots the same way.
test('Worker vs editor, undo and redo: a parent edit is one editor snapshot; the Worker follows it, returns exactly on undo, and follows again on redo',()=>{
 const s=stack(),editor=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))),{deferPlacementGeometry:true}),worker=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));
 const history=[],snap=()=>C.publicJSON(C.serialize(editor)),send=state=>{C.patchShip(worker,JSON.parse(state));worker._cache=null;return C.refreshPlacementGeometry(worker);};
 const pose=w=>['P','B'].map(l=>{const p=part(w,l),f=C.structFrame(p);return [p.c,f.fw,f.up].flat().map(v=>+v.toFixed(9));});
 const start=pose(worker);
 // One editor operation: the hull turns and moves (the editor changes only the hull).
 history.push(snap());const h=editor.parts[0];h.yaw=20;h.pitch=5;h.c=[h.c[0]+8,h.c[1],h.c[2]-3];const after=snap();assert.equal(history.length,1,'one undo step');
 let r=send(after);assert.equal(r.failed.length,0,JSON.stringify(r.failed));const followed=pose(worker);assert.notDeepEqual(followed,start);
 // The same edit applied to a full Core ship (live) gives the same poses.
 const live=stack(),lh=live.parts[0];lh.yaw=20;lh.pitch=5;lh.c=[lh.c[0]+8,lh.c[1],lh.c[2]-3];live._cache=null;C.refreshPlacementGeometry(live);assert.deepEqual(pose(live),followed,'Worker = live');
 // An unrelated editor edit re-sends the stale child poses: the Worker keeps the followed ones.
 editor.name='renamed';r=send(snap());assert.equal(r.failed.length,0);assert.deepEqual(pose(worker),followed,'unchanged by a later unrelated update');
 // Undo: the snapshot before the edit. Redo: the snapshot after it.
 r=send(history[0]);assert.equal(r.failed.length,0);assert.deepEqual(pose(worker),start,'undo returns exactly');
 r=send(after);assert.equal(r.failed.length,0);assert.deepEqual(pose(worker),followed,'redo follows again');
 // A reload of the editor's save (old child poses, new hull) gives the same.
 assert.deepEqual(pose(C.deserialize(JSON.parse(after))),followed,'reload of the editor save');
});
