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

 test(`${mode}: a cut that removes everything under the box reports it as severed, a warning, without moving it`,()=>{
  const {ship,hull,box}=build(mode),c=box.c.slice(),before=C.publicJSON(box.placement.requestedGeometry);
  hullCut(ship,hull,[110,30,0],[40,12,40]);ship._cache=null;
  const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,'a severed child is not a failed placement');same(r.severed,[{partId:box.id,code:'severed'}]);
  const check=(s,b,label)=>{
   assert.equal(b._placementError,undefined,label+': not a red repair state');assert.equal(b.placement.repairRequired,undefined,label);assert.equal(b.placement.severed,undefined,label+': nothing is written into the design');
   for(let i=0;i<3;i++)assert.ok(Math.abs(b.c[i]-c[i])<1e-6,`${label}: not moved ${b.c} vs ${c}`);
   const h=s.parts.find(p=>p.id===b.placement.parentStructureId);assert.equal(C.placementContact(s,b,h).connected,false,label+': really separated');
   const diag=C.placementDiagnostics(s).find(q=>q.partId===b.id);assert.equal(diag.code,'severed',label);assert.equal(diag.severed,true,label);
   const S=grounding(s);assert.ok(!S.ungrounded.parts.includes(b.id),label+': no red frame');same(S.severed,[b.id],label);
   const w=S.warnings.find(x=>x.code==='severed');assert.ok(w,label+': 点検 warning');assert.equal(w.lv,'warn');same(w.targets,[{list:'parts',id:b.id}],label+': select link');
   assert.ok(!S.warnings.some(x=>x.code==='ungrounded'),label+': no ungrounded warning');
   const en=require('node:fs').readFileSync(path.join(__dirname,'..','js/lang-en.js'),'utf8');assert.ok(en.includes(JSON.stringify(w.text.replace(/\d+ 個/,'{0} 個'))),label+': the warning has an English translation');
  };
  check(ship,box,'live');assert.equal(C.publicJSON(box.placement.requestedGeometry),before,'the request is unchanged');
  const {L,r:r2}=reload(ship);assert.equal(r2.ok,true,JSON.stringify(r2.failed));check(L,L.parts.find(p=>p.id===box.id),'reload');
  // The editor's load path defers placement geometry and the Worker then refreshes the cold design:
  // the severed judgement is recomputed from the design alone (no stored flag), with the same result.
  const D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),{deferPlacementGeometry:true}),r3=C.refreshPlacementGeometry(D);
  assert.equal(r3.ok,true,JSON.stringify(r3.failed));same(r3.severed,[{partId:box.id,code:'severed'}]);check(D,D.parts.find(p=>p.id===box.id),'deferred load');
  const again=C.deserialize(JSON.parse(C.publicJSON(C.serialize(D))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(again);check(again,again.parts.find(p=>p.id===box.id),'second save and load');
 });

 test(`${mode}: narrowing a cut keeps the box as it is, connected, and its overlap is counted once`,()=>{
  // Reviewed behaviour (docs/design-placement-v1.2.md "削りと接続"): a child kept on a material-only
  // change keeps the shape it was fitted with. When a cut is narrowed, the material that comes back
  // overlaps it; an overlap is a contact and the structural union counts the shared volume once.
  const {ship,hull,box}=build(mode),c=box.c.slice(),id=ship.nextId++;
  C.hullOwnSolidCut(ship,hull,{id,shape:'box',c:[110,31,0],s:[10,4,40],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;assert.equal(C.refreshPlacementGeometry(ship).ok,true);
  const {L}=reload(ship),b=L.parts.find(p=>p.id===box.id),h=L.parts.find(p=>p.id===hull.id),shape=b._placementGeometry?.volume??null;
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
  hullCut(ship,hull,[110,30,0],[40,12,40]);ship._cache=null;r=C.refreshPlacementGeometry(ship);same(r.severed,[{partId:box.id,code:'severed'}]);const severing=JSON.parse(C.publicJSON(ship));
  C.patchShip(ship,structuredClone(uncut));ship._cache=null;r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));same(r.severed,[]);assertSeated(ship,box,c,'undo severing cut');
  C.patchShip(ship,structuredClone(severing));ship._cache=null;r=C.refreshPlacementGeometry(ship);same(r.severed,[{partId:box.id,code:'severed'}],'redo severs again');assert.equal(box._placementError,undefined);
  // A history snapshot can carry placement metadata that differs from the live part (a rebound face
  // id): that is not an edit of the box, so it is still severed, not a red repair state.
  C.patchShip(ship,structuredClone(uncut));ship._cache=null;C.refreshPlacementGeometry(ship);
  const drift=structuredClone(severing);drift.parts.find(p=>p.id===box.id).placement.hostSurfaceId='p1:top:999:drift';
  C.patchShip(ship,drift);ship._cache=null;r=C.refreshPlacementGeometry(ship);same(r.severed,[{partId:box.id,code:'severed'}],'redo with drifted metadata');assert.equal(box._placementError,undefined);
  for(let i=0;i<3;i++)assert.ok(Math.abs(box.c[i]-c[i])<1e-6,'not moved');
 });
}

function placeFit(ship,hull,x){
 const raw=C.rayPart([x,500,0],[0,-1,0],hull),n=C.norm(raw.n),q=Math.floor(x/200*4),patch=C.surfacePatches(ship,true,false,new Set(['p'+hull.id])).find(p=>p.id.includes(`:top:${q}:`));
 const r=C.solveFitPlacement(ship,{id:-1,k:'pd',p:[0,0,0],n,a:2,ped:0},{mode:'direct',hostId:hull.id,hostSurfaceId:patch.id,hit:{p:raw.p,n},geometryRevision:0,parentGeometryRevision:0});
 assert.equal(r.ok,true,r.error);const fit=C.acceptFitPlacementResult(ship,r).fit;assert.equal(fit.placement.hostSurfaceId,patch.id);return fit;
}

test('a fitting 30 m from a hull cut stays seated, and one whose support was cut away is reported floating',()=>{
 const ship=C.newShip(CIGAR,'new');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const near=placeFit(ship,hull,110),gone=placeFit(ship,hull,60);C.refreshPlacementGeometry(ship);assert.equal(near.float,false);assert.equal(gone.float,false);
 hullCut(ship,hull,[140,28,0],[10,10,10]);hullCut(ship,hull,[60,30,0],[30,12,30]);ship._cache=null;
 const r=C.refreshPlacementGeometry(ship),S=grounding(ship);
 assert.equal(near.float,false,'the fitting 30 m from the cut keeps its seat');assert.equal(near._fitPlacementError,undefined);
 assert.ok(!S.ungrounded.floatingFits.includes(near.id));assert.ok(!r.failed.some(q=>q.fitId===near.id));
 assert.equal(gone.float,true,'a fitting with nothing left under it floats');assert.ok(r.failed.some(q=>q.fitId===gone.id));
 assert.ok(S.ungrounded.floatingFits.includes(gone.id),'and is reported in floatingFits, not skipped');assert.ok(S.warnings.some(w=>w.code==='ungrounded'&&/浮いている/.test(w.text)));
 const {L}=reload(ship),S2=grounding(L);assert.equal(L.fits.find(f=>f.id===near.id).float,false,'reload keeps the near fitting seated');assert.ok(S2.ungrounded.floatingFits.includes(gone.id));
});
