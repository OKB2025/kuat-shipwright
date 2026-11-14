// Cutting (削る) the hull must not disconnect a structure that still touches it
// (user report and rule 2026-11-11: the hull is the base body, structures add
// material to it, cuts carve the combined body). docs/design-placement-v1.2.md
// "削りと接続".
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const CIGAR={L:200,W:32,H:32,plan:'cigar',sec:'ellipse'};
// Core runs in its own vm realm: compare its arrays and objects by value.
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);

function build(mode,x=110){
 const ship=C.newShip(CIGAR,'new');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts.find(p=>C.isShapePart(p));
 const raw=C.rayPart([x,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)};
 let part={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+6*.3,hit.p[2]],s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0};
 if(mode==='surface')part=C.alignStructure(part,hit,'surface');
 const d=C.preparePlacementDraft(ship,part,{mode,parentStructureId:hull.id,hostId:hull.id,hit,...(mode==='surface'?{}:{contactFit:'cut',position:part.c.slice()}),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));
 const box=ship.parts.at(-1);assert.ok(box.placement.hostSurfaceId,'the box records the tapped face');assert.equal(C.placementContact(ship,box,hull).connected,true);
 return {ship,hull,box};
}
const hullCut=(ship,hull,c,s)=>C.hullOwnSolidCut(ship,hull,{id:ship.nextId++,shape:'box',c,s,rotation:[0,0,0],mirror:false,structures:false});
function grounding(ship){const S={warnings:[]};C.groundingStats(ship,S);return S;}
function assertSeated(ship,box,c,label){
 assert.equal(box._placementError,undefined,label+': no placement error');assert.equal(box.placement.repairRequired,undefined,label+': no repair state');
 assert.equal(box._placementSevered,undefined,label+': not severed');
 for(let i=0;i<3;i++)assert.ok(Math.abs(box.c[i]-c[i])<1e-6,`${label}: pose kept ${box.c} vs ${c}`);
 const hull=ship.parts.find(p=>p.id===box.placement.parentStructureId),diag=C.placementDiagnostics(ship).find(q=>q.partId===box.id);
 assert.equal(C.placementContact(ship,box,hull).connected,true,label+': real contact');assert.equal(diag.connected,true,label+': diagnostics');
 const S=grounding(ship);assert.ok(!S.ungrounded.parts.includes(box.id),label+': no red frame');assert.ok(!S.severed.includes(box.id),label+': no severed warning');
}
function reload(ship){const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))));const r=C.refreshPlacementGeometry(L);return {L,r};}
function patchIds(ship,hull){return C.surfacePatches(ship,true,false,new Set(['p'+hull.id])).map(p=>p.id);}

for(const mode of ['horizontal','surface']){
 test(`${mode}: a hull-owned cut 30 m away in the same hull quarter keeps the box connected without re-solving it`,()=>{
  const {ship,hull,box}=build(mode),c=box.c.slice(),revision=box.placement.geometryRevision,sid=box.placement.hostSurfaceId;
  hullCut(ship,hull,[140,28,0],[10,10,10]);ship._cache=null;
  assert.ok(!patchIds(ship,hull).includes(sid),'precondition: the cut renumbers the stored face id away');
  const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));same(r.severed,[]);
  assert.ok(!r.updated.includes(box.id),'the child is not re-solved by a cut elsewhere');assert.equal(box.placement.geometryRevision,revision);
  assertSeated(ship,box,c,'live');
  const {L,r:r2}=reload(ship);assert.equal(r2.ok,true,JSON.stringify(r2.failed));assertSeated(L,L.parts.find(p=>p.id===box.id),c,'reload');
 });

 test(`${mode}: a cut in hull quarter 0 that duplicates a face id keeps the box connected`,()=>{
  const {ship,hull,box}=build(mode),c=box.c.slice();
  hullCut(ship,hull,[30,28,0],[10,10,10]);ship._cache=null;
  const ids=patchIds(ship,hull);assert.ok(ids.some((v,i)=>ids.indexOf(v)!==i),'precondition: duplicate patch ids exist');
  const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));assertSeated(ship,box,c,'live');
  // A face id shared by two patches is ambiguous: a cold re-solve keeps the stored pose.
  const {L,r:r2}=reload(ship);assert.equal(r2.ok,true,JSON.stringify(r2.failed));assertSeated(L,L.parts.find(p=>p.id===box.id),c,'reload');
 });

 test(`${mode}: a ship-level cut far away keeps the box connected through save and reload`,()=>{
  const {ship,box}=build(mode),c=box.c.slice();
  ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[30,28,0],s:[10,10,10],structures:true}));ship._cache=null;
  const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));assertSeated(ship,box,c,'live');
  const {L,r:r2}=reload(ship);assert.equal(r2.ok,true,JSON.stringify(r2.failed));assertSeated(L,L.parts.find(p=>p.id===box.id),c,'reload');
 });

// 2026-11-13 user decision (stage B, no parent relation, no severed category; cuts will be baked into the parts): a
 // structure a cut leaves touching nothing is red by contact alone; nothing records the removals at placement.
 test(`${mode}: a cut that removes everything under the box makes it red by contact, without moving it`,()=>{
  const {ship,hull,box}=build(mode),c=box.c.slice(),before=C.publicJSON(box.placement.requestedGeometry);
  hullCut(ship,hull,[110,30,0],[40,12,40]);ship._cache=null;
  const r=C.refreshPlacementGeometry(ship);assert.ok(r.failed.some(f=>f.partId===box.id),'red');same(r.severed,[]);
  const check=(s,b,label)=>{
   assert.equal(b.placement.repairRequired,undefined,label);assert.equal(b.placement.severed,undefined,label+': nothing is written into the design');
   for(let i=0;i<3;i++)assert.ok(Math.abs(b.c[i]-c[i])<1e-6,`${label}: not moved ${b.c} vs ${c}`);
   const diag=C.placementDiagnostics(s).find(q=>q.partId===b.id);assert.equal(diag.connected,false,label);
   const S=grounding(s);assert.ok(S.ungrounded.parts.includes(b.id),label+': red');same(S.severed,[],label+': no severed category');
  };
  check(ship,box,'live');assert.equal(C.publicJSON(box.placement.requestedGeometry),before,'the request is unchanged');
  const {L}=reload(ship);check(L,L.parts.find(p=>p.id===box.id),'reload');
  const D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(D);check(D,D.parts.find(p=>p.id===box.id),'deferred load');
 });

 test(`${mode}: narrowing a cut keeps the box as it is, connected, and its overlap is counted once`,()=>{
  // Reviewed behaviour (docs/design-placement-v1.2.md "削りと接続"): the fitted shape is built against
  // the parent without its cuts, so a child kept on a material-only change has exactly the shape a fresh
  // solve gives. The material a narrowed cut gives back overlaps nothing new; mass, volume and cost
  // equal a fresh re-solve with no reload in between (history-independent).
  const {ship,hull,box}=build(mode),c=box.c.slice(),id=ship.nextId++;
  C.hullOwnSolidCut(ship,hull,{id,shape:'box',c:[110,31,0],s:[10,4,40],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;assert.equal(C.refreshPlacementGeometry(ship).ok,true);
  const L=ship,b=box,h=hull,shape=b._placementGeometry?.volume??null;
  C.hullOwnSolidCut(L,h,{id,shape:'box',c:[110,31,0],s:[4,4,40],rotation:[0,0,0],mirror:false,structures:false});L._cache=null;
  const r=C.refreshPlacementGeometry(L);assert.equal(r.ok,true,JSON.stringify(r.failed));same(r.severed,[]);assert.ok(!r.updated.includes(b.id),'not re-fitted');
  assertSeated(L,b,c,'narrowed');assert.equal(b._placementGeometry?.volume??null,shape,'the fitted shape is kept');
  const kept=C.computeStats({...L,_cache:null}),F=C.deserialize(JSON.parse(C.publicJSON(C.serialize(L)))),fresh=C.computeStats({...F,_cache:null});
  for(const k of ['mass','volume','cost'])assert.ok(Math.abs(kept[k]-fresh[k])<=1e-6*Math.max(1,Math.abs(fresh[k])),`${k}: kept ${kept[k]} vs re-solved ${fresh[k]}`);
 });

 test(`${mode}: undo and redo of a cut restore and re-report the connection`,()=>{
  const {ship,hull,box}=build(mode),c=box.c.slice(),uncut=JSON.parse(C.publicJSON(ship));
  // A far cut, then its undo/redo as the editor applies history snapshots (patchShip keeps object identity
  // and adopts the snapshot's objects, so each snapshot is applied as a fresh copy).
  hullCut(ship,hull,[140,28,0],[10,10,10]);ship._cache=null;let r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true);const farCut=JSON.parse(C.publicJSON(ship));
  C.patchShip(ship,structuredClone(uncut));ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));assertSeated(ship,box,c,'undo far cut');
  C.patchShip(ship,structuredClone(farCut));ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));assertSeated(ship,box,c,'redo far cut');
  // A severing cut, then undo: the box is connected again and the severed mark is cleared.
  C.patchShip(ship,structuredClone(uncut));ship._cache=null;C.refreshPlacementGeometry(ship);
  hullCut(ship,hull,[110,30,0],[40,12,40]);ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.ok(r.failed.some(f=>f.partId===box.id),'red by contact (2026-11-13)');const severing=JSON.parse(C.publicJSON(ship));
  C.patchShip(ship,structuredClone(uncut));ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));same(r.severed,[]);assertSeated(ship,box,c,'undo severing cut');
  C.patchShip(ship,structuredClone(severing));ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.ok(r.failed.some(f=>f.partId===box.id),'redo: red again');
  // A history snapshot can carry placement metadata that differs from the live part (a rebound face
  // id): that is not an edit of the box, so it is still severed, not a red repair state.
  C.patchShip(ship,structuredClone(uncut));ship._cache=null;C.refreshPlacementGeometry(ship);
  const drift=structuredClone(severing);drift.parts.find(p=>p.id===box.id).placement.hostSurfaceId='p1:top:999:drift';
  C.patchShip(ship,drift);ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.ok(r.failed.some(f=>f.partId===box.id),'redo with drifted metadata: red, not re-solved');
  for(let i=0;i<3;i++)assert.ok(Math.abs(box.c[i]-c[i])<1e-6,'not moved');
 });
}

function placeFit(ship,hull,x){
 const raw=C.rayPart([x,500,0],[0,-1,0],hull),n=C.norm(raw.n),q=Math.floor(x/200*4),patch=C.surfacePatches(ship,true,false,new Set(['p'+hull.id])).find(p=>p.id.includes(`:top:${q}:`));
 const r=C.solveFitPlacement(ship,{id:-1,k:'pd',p:[0,0,0],n,a:2,ped:0},{mode:'direct',hostId:hull.id,hostSurfaceId:patch.id,hit:{p:raw.p,n},geometryRevision:0,parentGeometryRevision:0});
 assert.equal(r.ok,true,r.error);const fit=C.acceptFitPlacementResult(ship,r).fit;assert.equal(fit.placement.hostSurfaceId,patch.id);return fit;
}

test('a fitting 30 m from a hull cut stays seated, and one whose support was cut away is a severed warning',()=>{
 const ship=C.newShip(CIGAR,'new');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const near=placeFit(ship,hull,110),gone=placeFit(ship,hull,60);C.refreshPlacementGeometry(ship);assert.equal(near.float,false);assert.equal(gone.float,false);
 hullCut(ship,hull,[140,28,0],[10,10,10]);hullCut(ship,hull,[60,30,0],[30,12,30]);ship._cache=null;
 const r=C.refreshPlacementGeometry(ship),S=grounding(ship);
 assert.equal(near.float,false,'the fitting 30 m from the cut keeps its seat');assert.equal(near._fitPlacementError,undefined);
 assert.ok(!S.ungrounded.floatingFits.includes(near.id));assert.ok(!r.failed.some(q=>q.fitId===near.id));
 assert.equal(gone.float,true,'a fitting with nothing left under it is unseated');assert.ok(!r.failed.some(q=>q.fitId===gone.id),'not a failure');same(r.severed.filter(q=>q.fitId!=null),[{fitId:gone.id,code:'severed'}]);
 // User decision 2026-11-11: cut away is a warning with a select link, not a 'bad' floating fitting.
 assert.ok(!S.ungrounded.floatingFits.includes(gone.id));same(S.severedFits,[gone.id]);const w=S.warnings.find(x=>x.code==='severed');assert.equal(w?.lv,'warn');assert.ok(w.targets.some(t=>t.list==='fits'&&t.id===gone.id),'select link');
 assert.ok(!S.warnings.some(x=>x.code==='ungrounded'&&/浮いている/.test(x.text)));
 const {L}=reload(ship),S2=grounding(L);assert.equal(L.fits.find(f=>f.id===near.id).float,false,'reload keeps the near fitting seated');same(S2.severedFits,[gone.id]);assert.ok(!S2.ungrounded.floatingFits.includes(gone.id));
});

// High-effort review 2026-11-11 (9668a2f): the same design gives the same result live, after reload,
// and after a deferred load, and nothing stale survives a failure.
const statsOf=s=>{const k=C.computeStats({...s,_cache:null});return {mass:k.mass,volume:k.volume,cost:k.cost};};
const closeTo=(a,b,m)=>assert.ok(Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b)),`${m}: ${a} vs ${b}`);
for(const [name,cc,cs] of [['half-under',[118,30,0],[12,8,10]],['edge-sliver',[117.5,30,0],[3,8,10]],['pocket-shallow-mid',[110,31.5,0],[6,1,4]],['full-shallow-floor31',[110,31.5,0],[20,1,10]],['full-deep-floor24',[110,30,0],[40,12,40]]])
 test(`horizontal ${name}: the fitted shape and mass do not depend on history (live = reload = deferred load)`,()=>{
  const {ship,hull,box}=build('horizontal');hullCut(ship,hull,cc,cs);ship._cache=null;C.refreshPlacementGeometry(ship);
  const pick=(s,b)=>({c:b.c.map(v=>+v.toFixed(6)),err:b._placementError||null,sev:!!b._placementSevered,vol:+(b._placementGeometry?.volume??C.partVolume(b)).toFixed(6),...statsOf(s)});
  const live=pick(ship,box),{L}=reload(ship),D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(D);
  for(const [label,s] of [['reload',L],['deferred',D]]){const other=pick(s,s.parts.find(p=>p.id===box.id));same(other.c,live.c,label+' pose');assert.equal(other.err,live.err,label);assert.equal(other.sev,live.sev,label);closeTo(other.vol,live.vol,label+' fitted volume');for(const k of ['mass','volume','cost'])closeTo(other[k],live[k],label+' '+k);}
 });

// 2026-11-12 user decision (replaces decision 1): children do not follow their parent. A severed child whose
// parent then moves away stays where it is; touching neither the cut nor the uncut parent, it is a red failure,
// stable refresh after refresh and after reload.
for(const mode of ['horizontal','surface'])
 test(`${mode}: a severed child whose parent then moves away stays where it is and is reported, refresh after refresh and after reload`,()=>{
  const {ship,hull,box}=build(mode);hullCut(ship,hull,[110,30,0],[40,12,40]);ship._cache=null;C.refreshPlacementGeometry(ship);/* 2026-11-13: no severed mark */
  const c0=box.c.map(v=>+v.toFixed(6));hull.c=[hull.c[0],hull.c[1],hull.c[2]+40];ship._cache=null;
  const states=[];for(let i=0;i<2;i++){ship._cache=null;const r=C.refreshPlacementGeometry(ship);states.push({failed:r.failed.map(q=>q.partId),severed:r.severed.map(q=>q.partId),err:!!box._placementError,c:box.c.map(v=>+v.toFixed(6))});}
  same(states[0],states[1],'a second refresh with no change agrees');same(states[0].c,c0,'not carried with the parent');assert.ok(states[0].err,'reported');same(states[0].severed,[]);
  const S=grounding(ship);assert.ok(S.ungrounded.parts.includes(box.id),'red');
  const {L}=reload(ship),b=L.parts.find(p=>p.id===box.id);assert.ok(b._placementError,'reload agrees: reported');same(b.c.map(v=>+v.toFixed(6)),c0,'reload agrees: not moved');
 });

test('a child that lost contact for any other reason is a failure, not severed, even after a cut elsewhere (no stale mark)',()=>{
 // Severed, then the user moves the box up into empty space: red, and a later no-op refresh keeps it red.
 const {ship,hull,box}=build('horizontal');hullCut(ship,hull,[110,30,0],[40,12,40]);ship._cache=null;C.refreshPlacementGeometry(ship);/* 2026-11-13: no severed mark */
 box.c=[box.c[0]+60,box.c[1]+10,box.c[2]];ship._cache=null;let r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,false);assert.equal(box._placementSevered,undefined);assert.ok(box._placementError);
 ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,false,'still failed');assert.ok(box._placementError);assert.equal(box._placementSevered,undefined);
 const S=grounding(ship);assert.ok(S.ungrounded.parts.includes(box.id));assert.ok(!S.severed.includes(box.id));
 const {L,r:r2}=reload(ship);assert.equal(r2.ok,false,'reload agrees');assert.ok(L.parts.find(p=>p.id===box.id)._placementError);
});

test('a lost face id with a real gap and no cuts is red, not severed',()=>{
 const {ship,hull,box}=build('horizontal'),saved=JSON.parse(C.publicJSON(C.serialize(ship))),b=saved.parts.find(p=>p.id===box.id),m=b.placement;
 // A saved child 2 m above the deck (pose, request and anchor all consistent) whose face id is gone.
 b.c=[b.c[0],b.c[1]+2,b.c[2]];m.requestedGeometry.c=b.c.slice();m.parentLocalAnchor=C.localStruct(hull,b.c);if(m.contactOffset)m.contactOffset=[m.contactOffset[0],m.contactOffset[1]+2,m.contactOffset[2]];m.hostSurfaceId='p1:top:missing:0';
 const L=C.deserialize(saved,{deferPlacementGeometry:true}),r=C.refreshPlacementGeometry(L),q=L.parts.find(p=>p.id===box.id);
 assert.equal(r.ok,false);assert.ok(q._placementError,'red repair state');assert.equal(q._placementSevered,undefined);same(r.severed,[]);
 const S=grounding(L);assert.ok(S.ungrounded.parts.includes(box.id));assert.ok(!S.severed.includes(box.id));
});

test('exterior equipment on a structure whose face a ship-level cut removes: warm, diagnostics, grounding and reload agree it is red',()=>{/* 2026-11-13: no severed category */
 const s=C.newShip({L:100,W:100,H:100,assembly:true},'Exterior parents');s.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[20,20,20]}];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=2;
 const r0=C.commitPlacement(s,{id:-1,k:'sensor',c:[2,11.84,3],d:4},{mode:'direct',parentStructureId:1,hit:{p:[2,10,3],n:[0,1,0]}});assert.equal(r0.ok,true,r0.error);const p=r0.part;C.refreshPlacementGeometry(s);
 s.solidCuts.push(C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[2,8,3],s:[12,6,12],structures:true}));s._cache=null;
 const check=(ship,label)=>{const q=ship.parts.find(x=>x.id===p.id),S=grounding(ship),d=C.placementDiagnostics(ship).find(x=>x.partId===p.id);
  assert.equal(d.connected,false,label);assert.ok(S.ungrounded.parts.includes(p.id),label+': red');same(S.severed,[],label);};
 const r=C.refreshPlacementGeometry(s);assert.ok(r.failed.some(f=>f.partId===p.id));same(r.severed,[]);check(s,'warm');
 const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));check(L,'reload');
 const D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(D);check(D,'deferred');
});

test('horizontal: a ship-level cut through the box itself re-fits it, and removing the cut leaves no hole (live = reload)',()=>{
 const {ship,box}=build('horizontal'),start=statsOf(ship),startVol=box._placementGeometry.volume;
 const pick=(s,b)=>({vol:b._placementGeometry?.volume??C.partVolume(b),...statsOf(s)});
 ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[110,33,0],s:[2,10,40],structures:true}));ship._cache=null;let r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));
 const live=pick(ship,box),{L}=reload(ship),again=pick(L,L.parts.find(p=>p.id===box.id));for(const k of ['vol','mass','volume','cost'])closeTo(again[k],live[k],'cut: '+k);
 ship.solidCuts=[];ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));
 const back=pick(ship,box);for(const k of ['mass','volume','cost'])closeTo(back[k],start[k],'cut removed: '+k);closeTo(back.vol,startVol,'fitted volume back to the uncut shape');
});

// Round-2 review (ec97fe3): removals that existed when a child was placed are part of the parent it is
// fitted to (placement.fitRemovalIds); only removals made later are ignored. Expected values are those of
// origin/main 3e82bf1 for the same placements.
function placeInto(cutC,cutS,{mode='horizontal',hitX=110,cx=110,size=[6,4,4],lift=1.2}={}){
 const ship=C.newShip(CIGAR,'recess');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 C.hullOwnSolidCut(ship,hull,{id:ship.nextId++,shape:'box',c:cutC,s:cutS,rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;C.refreshPlacementGeometry(ship);
 const raw=C.rayPart([hitX,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)};let part={id:ship.nextId,k:'struct',form:'box',c:[cx,hit.p[1]+lift,hit.p[2]],s:size,yaw:0,pitch:0,offsetX:0,offsetZ:0};if(mode==='surface')part=C.alignStructure(part,hit,'surface');
 const d=C.preparePlacementDraft(ship,part,{mode,parentStructureId:hull.id,hostId:hull.id,hit,...(mode==='surface'?{}:{contactFit:'cut',position:part.c.slice()}),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));return {ship,hull,box:ship.parts.at(-1)};
}
const shapeOf=(s,b,h)=>({c:b.c.map(v=>+v.toFixed(2)),vol:+(b._placementGeometry?.volume??C.partVolume(b)).toFixed(2),contact:C.placementContact(s,b,h).connected,mass:+C.computeStats({...s,_cache:null}).mass.toFixed(2)});
// 2026-11-13 user decision: no fitting. The box keeps its requested solid; the seat brings its whole base down to the
// lowest surface under its footprint (here the recess or hole floor). Until then these expected origin/main's fitted
// values (main: on the floor c 21.2 vol 76.8 mass 106193.05; hovering c 22.5 vol 108 mass 106306.93; tall c 25.2
// vol 403.2 mass 106016.41; over a hole c 33.8 vol 655.13 mass 105283.93; beside c 33.18 vol 78.03 mass 106201.32).
// Now: the requested volume, the seated centre, connected; mass is checked as live = reload = deferred (shapeOf).
for(const [name,cc,cs,opts,expected] of [
 ['on a recess floor',[110,30,0],[20,6,20],{},{c:[110,21.2,0],vol:96,contact:true}],
 ['hovering 0.5 m above a recess floor (seated on the floor)',[110,30,0],[20,6,20],{lift:2.5},{c:[110,22,0],vol:96,contact:true}],
 ['tall in a narrow recess',[110,30,0],[20,6,20],{size:[6,12,4],lift:5.2},{c:[110,22,0],vol:288,contact:true}],
 ['over a small existing hole (seated to the hole floor)',[110,31,0],[4,4,4],{hitX:104,size:[16,8,6],lift:1.8},{c:[110,32,0],vol:768,contact:true}],
 ['beside a recess',[110,30,0],[20,6,20],{hitX:123.5,cx:123.5},{c:[123.5,33.18,0],vol:96,contact:true}],
])
 test(`placement into an existing recess: ${name}; live = reload = deferred`,()=>{
  const {ship,hull,box}=placeInto(cc,cs,opts),live=shapeOf(ship,box,hull);same({c:live.c,vol:live.vol,contact:live.contact},expected,'seated, requested solid');
  const {L}=reload(ship),D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(D);
  same(shapeOf(L,L.parts.find(p=>p.id===box.id),L.parts[0]),live,'reload');same(shapeOf(D,D.parts.find(p=>p.id===box.id),D.parts[0]),live,'deferred');
  assert.equal(box.placement.fitRemovalIds,undefined,'no removal bookkeeping (2026-11-13)');
 });

// 2026-11-13 user decision: no fitting; old saves migrate keeping their pose (handoff-2026-11-12 §4 stage B). This box
// was saved by main hovering 0.5 m over the recess floor, which main fitted down to the floor (c [110,22.5,0], fitted
// 108 m³, connected). It now loads where it was saved, keeps its requested solid, and is reported severed by the
// recess (a warning, never red, never moved); the same after a reload.
// 2026-11-13 (no severed category): it hovers 0.5 m over the recess floor, touching nothing, so it is red by contact.
test('a design saved by origin/main with a box placed over an existing recess loads where it was saved, red by contact',()=>{
 const saved=require('./fixtures/recess-hover-saved-by-main-3e82bf1.json');assert.equal(JSON.stringify(saved).includes('fitRemovalIds'),false,'an old save without the record');
 const raw=JSON.parse(JSON.stringify(saved)).parts.find(q=>q.id===3),L=C.deserialize(JSON.parse(JSON.stringify(saved)),{deferPlacementGeometry:true}),r=C.refreshPlacementGeometry(L),p=L.parts.find(q=>q.id===3);
 same(p.c.map(v=>+v.toFixed(4)),raw.c.map(v=>+v.toFixed(4)));assert.ok(r.failed.some(q=>q.partId===3),'red by contact');same(r.severed,[]);
 const again=C.deserialize(JSON.parse(C.publicJSON(C.serialize(L))),{deferPlacementGeometry:true}),r2=C.refreshPlacementGeometry(again);assert.ok(r2.failed.some(q=>q.partId===3));same(again.parts.find(q=>q.id===3).c,p.c);
});

test('a cut made after placing into a recess still does not re-fit the child (live = reload)',()=>{
 const {ship,hull,box}=placeInto([110,30,0],[20,6,20],{lift:2.5}),vol=box._placementGeometry.volume,c=box.c.slice();
 C.hullOwnSolidCut(ship,hull,{id:ship.nextId++,shape:'box',c:[110,22,0],s:[4,4,4],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;
 const r=C.refreshPlacementGeometry(ship);assert.ok(!r.updated.includes(box.id),'not re-solved');assert.equal(box._placementGeometry.volume,vol,'shape kept');same(box.c,c);
 const {L}=reload(ship),b=L.parts.find(p=>p.id===box.id);closeTo(b._placementGeometry.volume,vol,'reload fits to the removals recorded at placement');same(b.c.map(v=>+v.toFixed(6)),c.map(v=>+v.toFixed(6)));
 for(const k of ['mass','volume','cost'])closeTo(statsOf(L)[k],statsOf(ship)[k],k);
});

// Round-3 review (c785801): editing a removal the child was fitted into (same id) re-solves the child; expected
// values were main 3e82bf1's for the same steps. 2026-11-12 user decision: a re-solve never moves a placed
// child (main moved the hovering box down onto the deepened floor, and lifted the box on the floor out of the
// raised floor, i.e. un-sank it). Now the child keeps its position in all three cases and is re-fitted where it
// is; the widened recess (position unchanged on main too) keeps main's full values.
for(const [name,lift,newC,newS,expected,severed=false] of [
 // Stage B (2026-11-13): the stored fitted shape is not re-fitted to the deepened floor; the box keeps its base
 // and, no longer touching, is severed by the edited cut (a warning, not a failure).
 // 2026-11-13 user decision: no fitting; the hovering draft is seated on the recess floor (c 22, was 22.5 with the fit
 // reaching down), and the widened case keeps the requested 96 m3 (main fitted 108 m3, mass 107075.22).
 ['deepen the recess by 2 m (hovering box)',2.5,[110,29,0],[20,6,22],{c:[110,22,0],contact:false},true],
 ['raise the recess floor by 1 m (box on the floor)',1.2,[110,30.5,0],[20,6,19],{c:[110,21.2,0],contact:true}],
 ['widen the recess (hovering box)',2.5,[110,30,0],[30,6,20],{c:[110,22,0],vol:96,contact:true}],
])
 test(`editing the recess a child was fitted into: ${name} — live = reload = main`,()=>{
  const ship=C.newShip(CIGAR,'recess edit');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0],id=ship.nextId++;
  C.hullOwnSolidCut(ship,hull,{id,shape:'box',c:[110,30,0],s:[20,6,20],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;C.refreshPlacementGeometry(ship);
  const raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},part={id:ship.nextId,k:'struct',form:'box',c:[110,hit.p[1]+lift,0],s:[6,4,4],yaw:0,pitch:0,offsetX:0,offsetZ:0};
  const d=C.preparePlacementDraft(ship,part,{mode:'horizontal',parentStructureId:1,hostId:1,hit,contactFit:'cut',position:part.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});ship.parts.push(d.part);ship.nextId++;assert.equal(C.refreshPlacementGeometry(ship).ok,true);
  const box=ship.parts.at(-1);assert.equal(box.placement.fitRemovalIds,undefined,'no removal bookkeeping (2026-11-13)');
  C.hullOwnSolidCut(ship,hull,{id,shape:'box',c:newC,s:newS,rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;const r=C.refreshPlacementGeometry(ship);/* 2026-11-13: a box the edited cut leaves touching nothing is red by contact (no severed category) */assert.equal(r.failed.some(q=>q.partId===box.id),severed,'red after the edited cut');same(r.severed,[]);
  const live=shapeOf(ship,box,hull);same(expected.vol==null?{c:live.c,contact:live.contact}:{c:live.c,vol:live.vol,contact:live.contact},expected,'position kept, requested solid');assert.equal(!!box._placementError,severed);
  const D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(D);same(shapeOf(D,D.parts.find(q=>q.id===box.id),D.parts[0]),live,'reload');
 });

// 2026-11-13 user decision (stage B, no parent relation): removals are not recorded with the placement; editing or
// deleting a removal solves nothing, keeps the box where it is, and contact alone judges it.
test('id-less removals: deleting an earlier one or editing the one under the box keeps the box where it is, judged by contact',()=>{
 const ship=C.newShip(CIGAR,'idless');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 hull.hullData.subs=[{structures:false,b:[20,24,-3,30,40,3]},{structures:false,b:[100,20,-3,120,40,3]}];ship._cache=null;C.refreshPlacementGeometry(ship);
 const raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},part={id:ship.nextId,k:'struct',form:'box',c:[110,hit.p[1]+2.5,0],s:[6,4,4],yaw:0,pitch:0,offsetX:0,offsetZ:0};
 const d=C.preparePlacementDraft(ship,part,{mode:'horizontal',parentStructureId:1,hostId:1,hit,contactFit:'cut',position:part.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});ship.parts.push(d.part);ship.nextId++;C.refreshPlacementGeometry(ship);const box=ship.parts.at(-1);
 assert.equal(box.placement.fitRemovalIds,undefined,'no removal bookkeeping');
 const look=()=>({c:box.c.map(v=>+v.toFixed(4)),vol:+(box._placementGeometry?.volume??C.partVolume(box)).toFixed(4),err:box._placementError||null,contact:C.placementContact(ship,box,hull).connected});
 const stable=label=>{const a=statsOf(ship);C.refreshPlacementGeometry(ship);const b=statsOf(ship);same([a.mass,a.volume,a.cost],[b.mass,b.volume,b.cost],label+': figures stable');};
 same(look(),{c:[110,22,0],vol:96,err:null,contact:true},'placed');stable('placed');
 hull.hullData.subs=hull.hullData.subs.slice(1);ship._cache=null;let r=C.refreshPlacementGeometry(ship);assert.ok(!r.updated.includes(box.id),'not re-solved');
 same(look(),{c:[110,22,0],vol:96,err:null,contact:true},'earlier one deleted');stable('earlier one deleted');
 hull.hullData.subs=[{structures:false,b:[100,21,-3,120,40,3]}];ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.ok(!r.updated.includes(box.id),'not re-solved after the edit');
 same(look(),{c:[110,22,0],vol:96,err:null,contact:true},'the one under it edited (position kept, overlapping the raised floor)');stable('edited');
});
function placementIds(b){return b.placement.fitRemovalIds||[];}
