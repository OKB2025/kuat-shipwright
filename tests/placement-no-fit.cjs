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
 const {part}=fixture();near(C.partVolume(part),SIZE[0]*SIZE[1]*SIZE[2],1e-6);assert.equal(part.placement.fittedGeometry,undefined);assert.equal(part._placementGeometry,undefined);
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
