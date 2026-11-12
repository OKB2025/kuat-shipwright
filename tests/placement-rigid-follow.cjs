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
  if(keep){close(P.volume,look(stack(),'P').volume,'P keeps its fitted volume',1e-6);assert.equal(part(s,'P')._placementKeptWhole,undefined);}else{close(P.volume,16*8*6,'whole requested body');assert.ok(part(s,'P')._placementKeptWhole);}
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
 const sensor=C.commitPlacement(s,{id:-1,k:'sensor',c:[94,top+1.84,0],d:4},{mode:'direct',parentStructureId:P.id,geometryRevision:1,parentGeometryRevision:P.placement?.geometryRevision||0,hit:{p:[94,top,0],n:[0,1,0]}});assert.equal(sensor.ok,true,sensor.error);
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

// A reload solves P again with its equipment already on it. The sensor sinks slightly into P's deck by its
// own placement; that is not an interference for P (it was reported as one, P failed and the sensor became
// parent-unresolved: the same on main b40b72d).
test('equipment mounted on a structure does not make the structure fail its own re-solve on reload (sensor via commitPlacement); after a hull turn the reload agrees',()=>{
 const s=stack(),P=part(s,'P'),top=C.partAABB(P)[4];
 const r=C.commitPlacement(s,{id:-1,k:'sensor',c:[94,top+1.84,0],d:4},{mode:'direct',parentStructureId:P.id,geometryRevision:1,parentGeometryRevision:P.placement?.geometryRevision||0,hit:{p:[94,top,0],n:[0,1,0]}});assert.equal(r.ok,true,r.error);
 assert.equal(C.refreshPlacementGeometry(s).failed.length,0);const S=s.parts.find(q=>q.k==='sensor');assert.ok(C.overlapParts(P,S),'the sensor really sinks into P (the case that used to fail)');
 const check=ship=>{const L=reload(ship),lp=part(L,'P'),ls=L.parts.find(q=>q.k==='sensor');assert.equal(lp._placementError,undefined,'P');assert.equal(ls._placementError,undefined,'sensor');near(C.localStruct(lp,ls.c),C.localStruct(part(ship,'P'),ship.parts.find(q=>q.k==='sensor').c),'sensor on P');};
 check(s);const hull=s.parts[0];hull.yaw=20;s._cache=null;const rr=C.refreshPlacementGeometry(s);assert.equal(rr.failed.length,0,JSON.stringify(rr.failed));check(s);
 // A structure still clashes with equipment that is not mounted on it.
 const deck=C.rayPart([60,500,0],[0,-1,0],hull),dn=C.norm(deck.n),other=C.commitPlacement(s,{id:-1,k:'sensor',c:C.add(deck.p,C.mul(dn,1.84)),d:4},{mode:'direct',parentStructureId:hull.id,geometryRevision:1,parentGeometryRevision:hull.placement?.geometryRevision||0,hit:{p:deck.p,n:dn}});
 assert.equal(other.ok,true,other.error);{const raw=C.rayPart([60,500,0],[0,-1,0],hull),c=[raw.p[0],raw.p[1]+1.8,raw.p[2]];const q=C.solvePlacement(s,{id:-1,k:'struct',form:'box',c,s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit:{p:raw.p,n:C.norm(raw.n)},contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION});assert.equal(q.code,'placement-interference');}
 // An edit of P that grows it into its own sensor is a clash (only an unedited P held by its relation ignores it).
 const P2=part(s,'P');P2.s=[P2.s[0],P2.s[1],P2.s[2]+6];s._cache=null;const grown=C.refreshPlacementGeometry(s);assert.ok(grown.failed.some(q=>q.partId===P2.id&&q.code==='placement-interference'),JSON.stringify(grown.failed));
});

// ---- Stage 3 review round (regression + physics) ----
const fs=require('node:fs');
const resize=(ship,dims)=>{const h=ship.parts[0],cur={L:h.s[0],W:h.s[1],H:h.s[2],...dims};C.setHullStructureDimensions(ship,h,[cur.L,cur.W,cur.H]);ship._cache=null;};
const totals=(ship,label='P')=>{const st=C.computeStats({...ship,_cache:null}),p=part(ship,label);return {mass:st.mass,volume:st.volume,cost:st.cost,materialP:st.info[p.id].materialVolume};};
// Mass and cost carry a reload-to-reload noise of a few 1e-6 for a turned hull that is already on main
// b40b72d (two successive reloads of the same save differ by ~4e-6 there); volumes agree to 1e-6.
const sameTotals=(a,b,m)=>{for(const k of ['mass','cost'])close(a[k],b[k],m+' '+k,2e-5);for(const k of ['volume','materialP'])close(a[k],b[k],m+' '+k,1e-6);};
const workerCopy=(saved,edit)=>{const W=stack(),o=JSON.parse(JSON.stringify(saved));edit(o);C.patchShip(W,o);W._cache=null;const r=C.refreshPlacementGeometry(W);assert.equal(r.failed.length,0,JSON.stringify(r.failed));return W;};

test('a gap with no cut: the hull is shortened so P, carried with its scaled contact point and kept offset, ends up past the new nose -> red, at its follow target; reload agrees',()=>{
 const s=C.newShip(CIGAR,'red');s.fits=[];C.ensurePrimaryHull(s);const hull=s.parts[0];
 // P stands near the nose with its centre 22 m forward of its tap point.
 const raw=C.rayPart([30,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},top=C.rayPart([8,500,0],[0,-1,0],hull),c=[8,top.p[1]+1.8,0];
 const d=C.preparePlacementDraft(s,{id:s.nextId,k:'struct',form:'box',label:'P',c,s:[10,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});s.parts.push(d.part);s.nextId++;assert.equal(C.refreshPlacementGeometry(s).failed.length,0);
 const P=part(s,'P'),meta=JSON.parse(JSON.stringify(P.placement)),offset=C.sub(P.c,C.worldStruct(hull,meta.surfaceAnchor));assert.equal(s.solidCuts.length+hull.hullData.solidCuts.length+hull.hullData.subs.length,0,'no cuts anywhere');
 resize(s,{L:100});const r=C.refreshPlacementGeometry(s);
 const anchor=C.worldStruct(hull,meta.surfaceAnchor.map((v,i)=>v*[100,32,32][i]/meta.anchorDimensions[i]));near(P.c,C.add(anchor,offset),'carried to its follow target');
 assert.equal(P._placementError,'contact-zero');assert.ok(r.failed.some(q=>q.partId===P.id));assert.equal(!!P._placementSevered,false,'not severed: nothing was cut');
 const S={warnings:[]};C.groundingStats(s,S);assert.ok(S.ungrounded.parts.includes(P.id),'red frame');
 const L=reload(s),lp=part(L,'P');near(lp.c,P.c,'reload pose');assert.equal(lp._placementError,'contact-zero');
});

const fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',name+'.json'),'utf8'));
const relation=ship=>{const P=part(ship,'P');return C.placementRelationHolds(ship.parts[0],P,P.placement);};
test('round trips with main (b40b72d fixtures): a main save without the fields gets them rebuilt and follows; positions load unchanged',()=>{
 const saved=fixture('rigid-follow-main-placed');assert.equal(saved.parts.some(p=>p.placement?.rigidPose||p.placement?.parentPose),false,'main format');
 const s=C.deserialize(JSON.parse(JSON.stringify(saved)));for(const l of ['P','B']){near(part(s,l).c,saved.parts.find(q=>q.label===l).c,'loaded unchanged '+l);assert.ok(part(s,l).placement.rigidPose&&part(s,l).placement.parentPose,'relation rebuilt '+l);}
 assert.equal(relation(s),true);
 const P0=look(s,'P'),hull0=JSON.parse(C.publicJSON(s.parts[0]));s.parts[0].yaw=20;s._cache=null;assert.equal(C.refreshPlacementGeometry(s).failed.length,0);const want=image(P0,hull0,s.parts[0]);near(look(s,'P').c,want.c,'follows');same(look(reload(s),'P'),look(s,'P'),'reload');
});
test('round trips with main: a save where main moved P keeps the branch\'s old rigidPose/parentPose; they are dropped and rebuilt from P\'s pose, and P is not pulled back',()=>{
 const saved=fixture('rigid-follow-main-edited'),sp=saved.parts.find(q=>q.label==='P');assert.ok(sp.placement.rigidPose&&sp.placement.parentPose,'main kept the stale fields');
 const s=C.deserialize(JSON.parse(JSON.stringify(saved)));near(part(s,'P').c,sp.c,'P stays where main put it');assert.equal(relation(s),true,'relation rebuilt for that pose');
 assert.notDeepEqual(JSON.parse(JSON.stringify(part(s,'P').placement.rigidPose)),sp.placement.rigidPose,'the stale relation was replaced');
 const P0=look(s,'P'),hull0=JSON.parse(C.publicJSON(s.parts[0]));s.parts[0].c=[s.parts[0].c[0]+10,s.parts[0].c[1],s.parts[0].c[2]];s._cache=null;assert.equal(C.refreshPlacementGeometry(s).failed.length,0);
 near(look(s,'P').c,image(P0,hull0,s.parts[0]).c,'follows from main\'s pose');same(look(reload(s),'P'),look(s,'P'),'reload');
});
test('round trips with main: a branch save (hull turned, P and B followed) loaded and saved again by main loads unchanged here, relation valid',()=>{
 const saved=fixture('rigid-follow-main-resaved'),s=C.deserialize(JSON.parse(JSON.stringify(saved)));
 for(const l of ['P','B']){near(part(s,l).c,saved.parts.find(q=>q.label===l).c,'unchanged '+l);assert.equal(part(s,l)._placementError,undefined,l);}assert.equal(relation(s),true);
 same(look(reload(s),'P'),look(s,'P'),'reload');
});

test('Worker/editor race: the editor turns the hull, then the user resizes P at its contact before the Worker result is adopted; the Worker keeps the edit (no follow over it)',()=>{
 const s=stack(),saved=JSON.parse(C.publicJSON(C.serialize(s)));
 // The editor's copy: hull turned (P/B not yet adopted), then P resized at its contact (its request rewritten too).
 const editor=C.deserialize(JSON.parse(JSON.stringify(saved)),{deferPlacementGeometry:true});editor.parts[0].yaw=25;const ep=part(editor,'P');assert.equal(C.resizeStructureHeightAtContact(ep,8),true);const edited=ep.c.slice();
 const W=stack();C.patchShip(W,JSON.parse(C.publicJSON(C.serialize(editor))));W._cache=null;const r=C.refreshPlacementGeometry(W);
 // The edit stands where the user made it: P is not carried to the turned hull's follow target. There the
 // turned hull no longer meets it, so it is a failure the user sees (red), not a silent move.
 const P=part(W,'P');near(P.s,[16,8,8],'the edit stands');near(P.c,edited,'not moved to the follow target');
 const target=C.placementFollowTarget(W.parts[0],P,P.placement);assert.ok(C.len(C.sub(target.c,P.c))>1,'the follow target is elsewhere');
 assert.ok(r.failed.some(q=>q.partId===P.id),JSON.stringify(r.failed));
 const L=reload(W);near(part(L,'P').c,edited,'reload keeps the edit');near(part(L,'P').s,[16,8,8],'reload size');
});

test('resize with a hull recess under P (W 32 -> 40): P keeps its fitted volume (the recess scales with the hull and is scaled back for the fit)',()=>{
 const s=C.newShip(CIGAR,'recess resize');s.fits=[];C.ensurePrimaryHull(s);const hull=s.parts[0],id=s.nextId++;
 C.hullOwnSolidCut(s,hull,{id,shape:'box',c:[90,30,0],s:[20,6,20],rotation:[0,0,0],mirror:false,structures:false});s._cache=null;C.refreshPlacementGeometry(s);
 const P=placeOn(s,hull,90,'P',[12,8,6],1.8);const v0=look(s,'P').volume,saved=JSON.parse(C.publicJSON(C.serialize(s)));assert.ok(P.placement.fitRemovalIds.length,'fitted into the recess');
 resize(s,{W:40});const r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
 close(look(s,'P').volume,v0,'fitted volume kept',1e-9);same(look(reload(s),'P'),look(s,'P'),'reload');
 const E=C.deserialize((o=>{resize(o.__ship,{W:40});return JSON.parse(C.publicJSON(C.serialize(o.__ship)));})({__ship:C.deserialize(JSON.parse(JSON.stringify(saved)),{deferPlacementGeometry:true})}));same(look(E,'P'),look(s,'P'),'editor copy');
});

test('the temporary fit parent never touches the ship\'s hatches: a resize refresh leaves ship.hatches exactly as the resize set them, and a reload agrees',()=>{
 const s=C.newShip({L:100,W:60,H:40,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'hatch');s.parts=[{id:7,k:'hangar',c:[50,28,0],d:12,room:[30,18,16],autoFit:false}];s.fits=[];s.nextId=8;
 s.hatches=[{id:3,k:'open',bay:7,a:[35,40,0],b:[65,40,0],n:[0,1,0],w:12,portal:true,face:'top',motion:'fixed',open:.4,cut:[35,22,-6,65,45,6]}];const hull=C.ensurePrimaryHull(s);assert.ok(hull.hullData.hatches.length);
 s.nextId=Math.max(...[...s.parts,...s.hatches].map(q=>q.id))+1;s._cache=null;C.refreshPlacementGeometry(s);
 // (A pending placement's refresh drops and syncCompartments restores the hull's public hatches, on main too.)
 placeOn(s,hull,20,'P',[12,8,6],1.8);C.syncCompartments(s);const owned=(ship=s)=>JSON.stringify(ship.hatches.map(h=>[h.id,h.a,h.b,h.n,h.w,h.hullOwner??null,h.hullHatch??null]));assert.ok(s.hatches.length,'the ship has a hatch');
 resize(s,{W:70});const set=owned(),r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));assert.ok(part(s,'P').placement.fitDimensions,'P was fitted');
 assert.equal(owned(),set,'the follow refresh did not rewrite the hatches');
 assert.equal(owned(reload(s)),set,'reload agrees');
});

for(const [name,edit] of [['yaw 20°',h=>{h.yaw=20;}],['pitch 8°',h=>{h.pitch=8;}],['move',h=>{h.c=[h.c[0]+12,h.c[1]+3,h.c[2]-6];}],['wider',h=>({W:40})],['taller',h=>({H:40})],['longer',h=>({L:240})],['smaller',h=>({L:160,W:24,H:24})]])
 test(`ship totals after ${name}: mass, volume, cost and P's material volume agree live = reload = editor copy = Worker copy (and are reported against a fresh placement)`,t=>{
  const s=stack(),saved=JSON.parse(C.publicJSON(C.serialize(s))),apply=ship=>{const dims=edit(ship.parts[0]);if(dims)resize(ship,dims);ship._cache=null;};
  apply(s);assert.equal(C.refreshPlacementGeometry(s).failed.length,0);const live=totals(s);
  sameTotals(totals(reload(s)),live,'reload');
  const E=C.deserialize((()=>{const e=C.deserialize(JSON.parse(JSON.stringify(saved)),{deferPlacementGeometry:true});apply(e);return JSON.parse(C.publicJSON(C.serialize(e)));})());sameTotals(totals(E),live,'editor copy');
  const W=stack(),o=(()=>{const e=C.deserialize(JSON.parse(JSON.stringify(saved)),{deferPlacementGeometry:true});apply(e);return JSON.parse(C.publicJSON(C.serialize(e)));})();C.patchShip(W,o);W._cache=null;assert.equal(C.refreshPlacementGeometry(W).failed.length,0);sameTotals(totals(W),live,'Worker copy');
  // A fresh placement of P at the same pose (B removed so only P differs): reported, not asserted equal.
  const F=reload(s),fp=part(F,'P');F.parts=F.parts.filter(q=>q.label!=='B');const hit=C.worldStruct(F.parts[0],fp.placement.surfaceAnchor),q=JSON.parse(C.publicJSON(fp));delete q.placement;q.id=-1;
  const fresh=C.solvePlacement(F,q,{mode:'horizontal',parentStructureId:F.parts[0].id,hostId:F.parts[0].id,hit:{p:hit,n:C.norm(C.worldStruct({...F.parts[0],c:[0,0,0]},fp.placement.contactLocalNormal))},contactFit:'cut',position:fp.c.slice(),keepTransform:true,placementModelVersion:C.PLACEMENT_MODEL_VERSION});
  t.diagnostic(JSON.stringify({case:name,live,fresh:fresh.ok?{partVolume:C.partVolume(fresh.part),c:fresh.part.c}:{error:fresh.code},followedPartVolume:C.partVolume(part(s,'P'))}));
 });

test('a structure parent resized by the user: its child keeps its fitted shape, cut against the parent as a fresh fit would see it (P\'s own fitted shape) scaled back to the size it was fitted to',()=>{
 const s=stack(),P=part(s,'P'),B0=look(s,'B');P.s=[24,8,6];s._cache=null;const r=C.refreshPlacementGeometry(s);assert.equal(r.failed.length,0,JSON.stringify(r.failed));
 const B=look(s,'B');close(B.volume,B0.volume,'B keeps its fitted volume',1e-6);assert.ok(Math.abs(B.c[0]-B0.c[0])>.5,'B moved with the scaled contact point');
 same(look(reload(s),'B'),B,'reload');
});
