// Stage B of the no-recompute plan, as decided 2026-11-13: structures are not fitted (no contact-face cut). A
// structure keeps the solid it was given; overlapping the body below is its connection, counted once by the structural
// union. The user's own seat (a tap, a drag, a new draft) moves a horizontal or vertical structure along its contact
// axis until its whole base reaches the body below. Any other re-solve (reload, Worker, re-check, another part edited)
// keeps its pose and writes nothing authored. Exterior equipment does not follow the body it was mounted on.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=v=>JSON.parse(C.publicJSON(v)),near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),record=p=>C.publicJSON(p.placement);
const SIZE=[16,16,20];
function fixture(pitch=6){
 const ship=C.newShip({L:300,W:200,H:100,assembly:true},'No fit');
 Object.assign(ship,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,80,20],pitch}],fits:[],hatches:[],links:[],groups:[],nextId:3,autoHabitation:false,detail:0});
 const parent=ship.parts[0],hit=C.rayPart([20,200,30],[0,-1,0],parent),c=[20,hit.p[1]+SIZE[2]/2,30];
 const r=C.solvePlacement(ship,{id:2,k:'struct',form:'box',c,s:SIZE,yaw:0},{mode:'horizontal',parentStructureId:1,position:c,hit:{p:Array.from(hit.p),n:Array.from(hit.n)},contactFit:'cut',contactSide:'bottom'});
 assert.equal(r.ok,true,r.error);ship.parts.push(r.part);assert.ok(C.refreshPlacementGeometry(ship).ok);return {ship,parent,part:ship.parts.find(p=>p.id===2),hit};
}
// Height of the parent's top surface under a footprint point (x,z), and of the child's base there.
const surfaceY=(ship,x,z)=>C.rayPart([x,500,z],[0,-1,0],ship.parts[0]).p[1];

test('a structure keeps its requested solid: no cut, no stored shape',()=>{
 const {part}=fixture();near(C.partVolume(part),SIZE[0]*SIZE[1]*SIZE[2],1e-6);assert.equal(part.placement.fittedGeometry,undefined);
 // The solve carries the requested solid itself as the placement geometry (transport, early pick): same volume and bounds.
 assert.ok(part._placementGeometry);near(part._placementGeometry.volume,SIZE[0]*SIZE[1]*SIZE[2],1e-6*SIZE[0]*SIZE[1]*SIZE[2]);
});

test('the seat sinks the base until the whole footprint reaches the sloped body, and it is connected by overlap',()=>{
 const {ship,part}=fixture(),b=C.partAABB(part);let lowest=Infinity;for(const x of [b[0]+1e-3,b[3]-1e-3])for(const z of [b[2]+1e-3,b[5]-1e-3])lowest=Math.min(lowest,surfaceY(ship,x,z));
 near(b[1],lowest,1e-3);const contact=C.placementContact(ship,part,ship.parts[0]);assert.equal(contact.connected,true);assert.ok(contact.overlap,'joined by overlap');
 // On a flat body the seat is flush.
 const flat=fixture(0);near(C.partAABB(flat.part)[1],surfaceY(flat.ship,20,30),1e-6);
});

for(const [name,edit] of [['raised',p=>{p.c=[p.c[0],p.c[1]+3,p.c[2]];}],['turned',p=>{p.pitch=-4;}],['resized',p=>{p.s=[140,80,26];}]])
 test(`the body below ${name}: the child keeps its pose, solid and placement record, also after a reload`,()=>{
  const {ship,parent,part}=fixture(),before={record:record(part),c:plain(part.c),volume:C.partVolume(part)};edit(parent);C.refreshPlacementGeometry(ship);
  assert.equal(record(part),before.record);assert.deepEqual(plain(part.c),before.c);assert.equal(C.partVolume(part),before.volume);
  const L=C.deserialize(structuredClone(C.serialize(ship))),q=L.parts.find(p=>p.id===2);C.refreshPlacementGeometry(L);assert.equal(record(q),before.record);assert.deepEqual(plain(q.c),before.c);
 });

test('a reload and repeated refreshes write nothing',()=>{
 const {ship,part}=fixture(),r0=record(part),c0=plain(part.c);for(let i=0;i<3;i++)C.refreshPlacementGeometry(ship);assert.equal(record(part),r0);
 const L=C.deserialize(structuredClone(C.serialize(ship)));C.refreshPlacementGeometry(L);const q=L.parts.find(p=>p.id===2);assert.equal(record(q),r0);assert.deepEqual(plain(q.c),c0);
});

test('a drag by the user seats the structure again at the new place; turning in place does not move it',()=>{
 const {ship,part}=fixture(),to=[-30,part.c[1]+5,-20],dragged=C.solvePlacement(ship,part,{mode:'horizontal',position:to});assert.equal(dragged.ok,true,dragged.error);
 const b=C.partAABB(dragged.part);assert.ok(b[1]<=surfaceY(ship,-30,-20)+1e-6,'reaches the body at the new place');
 const turned=C.solvePlacement(ship,{...part,yaw:25},{mode:'horizontal'});assert.equal(turned.ok,true,turned.error);assert.deepEqual(plain(turned.part.c),plain(part.c));
});

test('a field stored by an unreleased stored-fit build is ignored on load',()=>{
 const {ship,part}=fixture(),saved=structuredClone(C.serialize(ship));saved.parts.find(p=>p.id===2).placement.fittedGeometry={shape:'x',c:[0,0,0],whole:true};
 const L=C.deserialize(saved),q=L.parts.find(p=>p.id===2);assert.equal(q.placement.fittedGeometry,undefined);near(C.partVolume(q),C.partVolume(part));
});

test('a removal recorded at the placement and edited later severs the structure (a warning), without moving it',()=>{
 const CIGAR={L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},ship=C.newShip(CIGAR,'recess');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0],id=ship.nextId++;
 C.hullOwnSolidCut(ship,hull,{id,shape:'box',c:[110,30,0],s:[20,6,20],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;C.refreshPlacementGeometry(ship);
 const raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},part={id:ship.nextId,k:'struct',form:'box',c:[110,hit.p[1]+2,0],s:[6,4,4],yaw:0,pitch:0,offsetX:0,offsetZ:0};
 const d=C.preparePlacementDraft(ship,part,{mode:'horizontal',parentStructureId:1,hostId:1,hit,contactFit:'cut',position:part.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});ship.parts.push(d.part);ship.nextId++;assert.equal(C.refreshPlacementGeometry(ship).ok,true);
 const box=ship.parts.at(-1),c=plain(box.c);assert.ok(box.placement.fitRemovalHashes,'the recess content is recorded');
 C.hullOwnSolidCut(ship,hull,{id,shape:'box',c:[110,29,0],s:[20,6,24],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;const r=C.refreshPlacementGeometry(ship);
 assert.deepEqual(plain(box.c),c);assert.equal(box._placementError,undefined);assert.ok(r.severed.some(q=>q.partId===box.id),'severed by the edited recess');
});

test('exterior equipment does not follow the structure it was mounted on',()=>{
 const s=C.newShip({L:200,W:100,H:100,assembly:true},'Stored equipment pose');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[50,0,0],s:[100,80,80]}],fits:[],hatches:[],links:[],groups:[],nextId:2,autoHabitation:false,detail:0});
 const h=C.rayPart([-100,0,0],[1,0,0],s.parts[0]),r=C.solvePlacement(s,{id:-1,k:'engine',c:[-12,0,0],d:8,nozzleLength:4,dir:[-1,0,0]},{mode:'direct',parentStructureId:1,geometryRevision:1,parentGeometryRevision:0,placementModelVersion:C.PLACEMENT_MODEL_VERSION,hit:{p:Array.from(h.p),n:Array.from(h.n)}});
 assert.equal(r.ok,true,r.error);assert.equal(C.acceptPlacementResult(s,r).ok,true);
 const engine=s.parts.find(p=>p.k==='engine'),pose=plain({c:engine.c,dir:engine.dir,roll:engine.roll}),rec=C.publicJSON(engine.placement);
 C.refreshPlacementGeometry(s);assert.equal(C.publicJSON(engine.placement),rec);
 const loaded=C.deserialize(structuredClone(C.serialize(s))),le=loaded.parts.find(p=>p.k==='engine');C.refreshPlacementGeometry(loaded);assert.equal(C.publicJSON(le.placement),rec);
 s.parts[0].c=[50,4,0];C.refreshPlacementGeometry(s);assert.deepEqual(plain({c:engine.c,dir:engine.dir,roll:engine.roll}),pose);assert.equal(engine.placement.geometryRevision,JSON.parse(rec).geometryRevision);
 const after=C.publicJSON(engine.placement);C.refreshPlacementGeometry(s);assert.equal(C.publicJSON(engine.placement),after);
});

// Stage B regression review (2026-11-13): a structure refused after another edit (here: a gap opened under it) and
// re-solved after a further edit of its body keeps its pose. Only the user's own draft sinks; the refused structure
// stays where it was, red, until the user moves it.
test('a stored refused structure is not sunk by a reload or by a later body edit (pose kept, still refused)',()=>{
 const {ship,parent,part}=fixture(0);part.c=[part.c[0],part.c[1]+0.5,part.c[2]];Object.assign(part.placement,{validationFailed:true,repairRequired:true,repairReason:'contact-zero'});
 const c0=plain(part.c),L=C.deserialize(structuredClone(C.serialize(ship))),q=()=>L.parts.find(p=>p.id===2);C.refreshPlacementGeometry(L);
 assert.deepEqual(plain(q().c),c0,'reload keeps the refused pose');assert.equal(q().placement.validationFailed,true);
 L.parts[0].s=[130,80,20];C.refreshPlacementGeometry(L);
 assert.deepEqual(plain(q().c),c0,'a body edit does not sink it');assert.equal(q().placement.validationFailed,true,'still refused');
});

test('placementSameShape ignores key order, defaults and empty arrays (one definition only)',()=>{
 const a={k:'struct',form:'box',s:[16,16,20],yaw:0},b={yaw:0,s:[16,16,20],form:'box',k:'struct',taper:0,mirror:false};
 assert.equal(C.placementSameShape(a,b),true);assert.equal(C.placementSameShape(a,{...a,s:[16,16,21]}),false);
 // A reload may add empty lists and nested defaults; the shape is still the same (the replaced top-level-only version did not see this).
 assert.equal(C.placementSameShape({...a,outline:[[0,0],[1,0],[0,1]]},{...a,outline:[[0,0],[1,0],[0,1]],holes:[],label:''}),true,'empty list and empty string are defaults');
 assert.equal(C.placementSameShape({...a,outline:[[0,0],[1,0],[0,1]]},{...a,outline:[[0,0],[1,0],[0,2]]}),false,'a nested change is seen');
});

// Physics review 2026-11-13: without fitting, a wing / solar panel / plate seated horizontally on its parent would count
// its buried root twice (the parent's material and its own). It counts only its increment in the structural union, so
// its material volume equals what it adds to the ship's volume.
for(const [name,extra] of [['wing',{k:'wing',form:'trap',s:[20,12,2],wing:{foil:true,axis:'x',stow:0,open:15,T:1,feed:1,reinf:0}}],['plate',{k:'struct',form:'box',plate:true,s:[16,10,1.5]}]])
 test(`a ${name} seated on a curved hull counts its buried root once (material volume = added ship volume)`,()=>{
  const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'once');ship.fits=[];C.ensurePrimaryHull(ship);C.refreshPlacementGeometry(ship);
  const stats=s=>{const L=C.deserialize(structuredClone(C.serialize(s)));C.refreshPlacementGeometry(L);return C.computeStats(L);},v0=stats(ship).volume;
  const raw=C.rayPart([100,500,0],[0,-1,0],ship.parts[0]),hit={p:Array.from(raw.p),n:Array.from(C.norm(raw.n))},id=ship.nextId++,part={id,c:[100,raw.p[1]+extra.s[2]/2-0.5,0],yaw:0,pitch:0,...extra};
  const r=C.solvePlacement(ship,part,{mode:'horizontal',parentStructureId:1,position:part.c.slice(),hit,contactFit:'cut',contactSide:'bottom'});assert.equal(r.ok,true,r.error);ship.parts.push(r.part);C.refreshPlacementGeometry(ship);
  const st=stats(ship),mv=st.info[id].materialVolume;assert.ok(mv<C.partVolume(r.part)-1e-6,'the buried root is not counted again');near(mv,st.volume-v0,1e-6*Math.max(1,st.volume));
 });

// ---- Stage B Opus/high review (2026-11-13) ----
// H1: the overlap with the body a part was placed on is counted once and does not depend on ids or the parent's mode.
{
 const WING={k:'wing',form:'trap',s:[20,12,2],wing:{foil:true,axis:'x',stow:0,open:15,T:1,feed:1,reinf:0}},PLATE={k:'struct',form:'box',plate:true,s:[30,20,1.5]},BOX={k:'struct',form:'box',s:[16,10,4]};
 const stats=s=>{const L=C.deserialize(structuredClone(C.serialize(s)));C.refreshPlacementGeometry(L);return C.computeStats(L);};
 const put=(ship,spec,id,parentId,mode,sinkBy)=>{const parent=ship.parts.find(p=>p.id===parentId),raw=C.rayPart([0,500,0],[0,-1,0],parent),hit={p:Array.from(raw.p),n:Array.from(C.norm(raw.n))},part={id,c:[0,raw.p[1]+spec.s[2]/2-sinkBy,0],yaw:0,pitch:0,...structuredClone(spec)};
  const req=mode==='surface'?{mode,parentStructureId:parentId,hit,position:part.c.slice()}:{mode,parentStructureId:parentId,position:part.c.slice(),hit,contactFit:'cut',contactSide:'bottom'};const r=C.solvePlacement(ship,part,req);assert.equal(r.ok,true,r.error);ship.parts.push(r.part);C.refreshPlacementGeometry(ship);};
 const run=(pSpec,pId,pMode,cSpec,cId)=>{const ship=C.newShip({L:300,W:200,H:100,assembly:true},'order');Object.assign(ship,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,80,20]}],fits:[],hatches:[],links:[],groups:[],nextId:40,autoHabitation:false,detail:0});C.refreshPlacementGeometry(ship);
  put(ship,pSpec,pId,1,pMode,0);const s0=stats(ship);put(ship,cSpec,cId,pId,'horizontal',0.5);const s1=stats(ship);return {child:s1.info[cId].materialVolume,parentDelta:s1.info[pId].materialVolume-s0.info[pId].materialVolume,ship:s1.volume-s0.volume,mass:s1.mass-s0.mass};};
 for(const [name,args] of [['a box on a surface plate',[PLATE,10,'surface',BOX,31]],['a box on a horizontal plate',[PLATE,10,'horizontal',BOX,31]],['a wing on a surface wing',[WING,10,'surface',WING,31]]])
  test(`H1: ${name} counts the overlap once (child material = added ship volume; parent unchanged)`,()=>{const r=run(...args);near(r.parentDelta,0,1e-6);near(r.child,r.ship,1e-6*Math.max(1,r.ship));});
 test('H1: the result does not depend on whether the child id is smaller than the parent id',()=>{const a=run(WING,10,'surface',WING,5),b=run(WING,10,'surface',WING,31);near(a.child,b.child,1e-6);near(a.mass,b.mass,1e-6*Math.max(1,b.mass));});
}
// H2: the drag clamp works after the body changed and on a copy (the saved parent key is the last user seat, or absent).
{
 const fx=()=>{const ship=C.newShip({L:300,W:200,H:100,assembly:true},'clamp');Object.assign(ship,{parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[120,80,20]}],fits:[],hatches:[],links:[],groups:[],nextId:3,autoHabitation:false,detail:0});
  const parent=ship.parts[0],hit=C.rayPart([20,200,30],[0,-1,0],parent),c=[20,hit.p[1]+8,30],r=C.solvePlacement(ship,{id:2,k:'struct',form:'box',c,s:[16,16,16],yaw:0},{mode:'horizontal',parentStructureId:1,position:c,hit:{p:Array.from(hit.p),n:Array.from(hit.n)},contactFit:'cut',contactSide:'bottom'});assert.equal(r.ok,true,r.error);ship.parts.push(r.part);C.refreshPlacementGeometry(ship);return ship;};
 const drag=(ship,id,dx)=>{const p=ship.parts.find(q=>q.id===id);p.c=[p.c[0]+dx,p.c[1],p.c[2]];ship._cache=null;const r=C.refreshPlacementGeometry(ship);return {x:p.c[0],failed:r.failed.length,err:p._placementError||null};};
 test('H2: after the body was resized, dragging past its edge stops at the edge (still connected)',()=>{const s=fx();s.parts[0].s=[124,80,20];s._cache=null;C.refreshPlacementGeometry(s);const r=drag(s,2,100);assert.equal(r.err,null);assert.ok(r.x<75,`stopped at ${r.x}`);});
 test('H2: a copy dragged past the edge stops at the edge',()=>{const s=fx(),o=JSON.parse(C.publicJSON(s.parts[1]));o.id=5;o.c=[o.c[0]-40,o.c[1],o.c[2]];C.remapPlacementCopy(o,new Map(),{keepExternal:true});s.parts.push(o);s.nextId=6;s._cache=null;C.refreshPlacementGeometry(s);const r=drag(s,5,-100);assert.equal(r.err,null);assert.ok(r.x>-75,`stopped at ${r.x}`);});
}
// H3 and the 2026-11-13 decision on floating exterior equipment.
{
 const fx=()=>{const s=C.newShip({L:200,W:100,H:100,assembly:true},'eq');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[50,0,0],s:[100,80,80]}],fits:[],hatches:[],links:[],groups:[],nextId:2,autoHabitation:false,detail:0});
  const h=C.rayPart([-100,0,0],[1,0,0],s.parts[0]),r=C.solvePlacement(s,{id:-1,k:'engine',c:[-12,0,0],d:8,nozzleLength:4,dir:[-1,0,0]},{mode:'direct',parentStructureId:1,geometryRevision:1,parentGeometryRevision:0,placementModelVersion:C.PLACEMENT_MODEL_VERSION,hit:{p:Array.from(h.p),n:Array.from(h.n)}});assert.equal(C.acceptPlacementResult(s,r).ok,true);return s;};
 test('H3: an engine still touching its body after the body turned (yaw 180, face in the same plane) is accepted, live and reloaded',()=>{
  const s=fx(),e=s.parts.find(p=>p.k==='engine'),c0=plain(e.c);s.parts[0].yaw=180;C.refreshPlacementGeometry(s);assert.equal(e._placementError??null,null);assert.deepEqual(plain(e.c),c0);
  const L=C.deserialize(structuredClone(C.serialize(s)));C.refreshPlacementGeometry(L);assert.equal(L.parts.find(p=>p.k==='engine')._placementError??null,null);});
 test('an engine left behind by its body (refused) is a warning and is not in the performance figures',()=>{
  const s=fx(),e=s.parts.find(p=>p.k==='engine');s.parts[0].c=[80,0,0];C.refreshPlacementGeometry(s);assert.ok(e._placementError,'refused where it stands');
  const st=C.computeStats(s);assert.notEqual(st.info[e.id]?.vent,true,'no thrust from a refused engine');});
}
test('refused placed engines on a powered example (cr90) give no rated thrust; unplaced example engines are unchanged',()=>{
 const zlib=require('node:zlib'),fs=require('node:fs'),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/cr90/design.json.gz')))),mk=()=>C.deserialize(structuredClone(raw.design||raw.ship||raw));
 const base=C.computeStats(mk());assert.ok(base.ratedThrustN>0);const s=mk();for(const e of s.parts.filter(p=>p.k==='engine')){e.placement={modelVersion:1,mode:'direct'};e._placementError={code:'surface-missing'};}
 assert.equal(C.computeStats(s).ratedThrustN,0);
});

// User report 2026-11-13 (screenshot, design 建造中): a mirrored copy that visibly overlaps its deck was red ("接地して
// いない部品"). The deck under the original is one-sided and its mirrored counterpart is a separate part without a twin
// link, so the mirror kept the original's deck as parent, which is not under the copy. Overlap with any structure is
// the connection (no parent relation): the copy is accepted, live and after a reload.
test('a mirrored copy over a separately built mirrored deck (no twin link) is connected, live and reloaded',()=>{
 const s=C.newShip({L:600,W:200,H:80,plan:'wedge',sec:'rect'},'mirror deck');s.fits=[];C.ensurePrimaryHull(s);C.refreshPlacementGeometry(s);
 const top=C.rayPart([250,500,0],[0,-1,0],s.parts[0]).p[1];s.parts.push({id:2,k:'struct',form:'box',c:[250,top+8,-30],s:[80,20,30],label:'deck port'},{id:3,k:'struct',form:'box',c:[250,top+8,30],s:[80,20,30],label:'deck stbd'});s.nextId=10;C.refreshPlacementGeometry(s);
 const deck=s.parts.find(p=>p.id===2),hit=C.rayPart([250,500,-30],[0,-1,0],deck),c=[250,hit.p[1]+4,-30],r=C.solvePlacement(s,{id:10,k:'struct',form:'box',c,s:[30,20,10],yaw:0},{mode:'horizontal',parentStructureId:2,position:c,hit:{p:Array.from(hit.p),n:Array.from(hit.n)},contactFit:'cut',contactSide:'bottom'});
 assert.equal(r.ok,true,r.error);s.parts.push(r.part);const twin=C.mirrorPart(r.part,s);twin.id=11;r.part.tw=11;twin.tw=10;s.parts.push(twin);s.nextId=12;
 assert.equal(twin.placement.parentStructureId,2,'the mirror keeps the one-sided deck as parent (no twin link)');
 const res=C.refreshPlacementGeometry(s),S={warnings:[]};C.groundingStats(s,S);assert.deepEqual(Array.from(res.failed,f=>f.code),[]);assert.equal(s.parts.find(p=>p.id===11)._placementError??null,null);assert.deepEqual(Array.from(S.ungrounded?.parts||[]),[]);
 const L=C.deserialize(structuredClone(C.serialize(s)));C.refreshPlacementGeometry(L);const S2={warnings:[]};C.groundingStats(L,S2);assert.equal(L.parts.find(p=>p.id===11)._placementError??null,null);assert.deepEqual(Array.from(S2.ungrounded?.parts||[]),[]);
});
