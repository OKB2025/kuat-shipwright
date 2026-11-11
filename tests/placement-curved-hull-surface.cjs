// Surface-mode structures on the curved sides of a cigar/ellipse hull (user
// report 2026-11-11). A thin trapezoid plate rolled about +-92 degrees on the
// hull side was red-framed with 接地していない部品があります: it overlapped the
// hull, but surface mode counted only coplanar face contact. The user's rule:
// a genuine overlap or touch with the parent is a contact (the shared volume
// is charged once by the structural union and its buried faces are hidden);
// a part really lifted off the hull is still refused.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);

const CIGAR={L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},ELLIPSE={L:1100,W:300,H:200,plan:'ellipse',sec:'ellipse'};
const ungrounded=(ship,id)=>{const st={warnings:[]};C.groundingStats(ship,st);return (st.ungrounded?.parts||[]).includes(id);};
const connected=(ship,id)=>C.placementDiagnostics(ship).find(q=>q.partId===id)?.connected===true;
function hullShip(spec){const ship=C.newShip(spec,'new');ship.fits=[];C.ensurePrimaryHull(ship);return {ship,hull:ship.parts.find(p=>C.isShapePart(p))};}
const SHAPES={
 plate:h=>({form:'box',s:[h.L*.2,h.W*.3,h.W*.05]}),
 fin:h=>({form:'trap',taper:.2,angles:[10,10,15,15],s:[h.L*.28,h.W*.29,h.W*.053],roll:92}),
 finMirror:h=>({form:'trap',taper:.2,angles:[10,10,15,15],s:[h.L*.28,h.W*.29,h.W*.053],roll:-92}),
 box:h=>({form:'box',s:[h.L*.08,h.W*.25,h.H*.2]}),
};
// The editor's surface tap: alignStructure pose -> draft -> Worker resolution.
function tap(spec,o,d,shape){
 const {ship,hull}=hullShip(spec),raw=C.rayPart(o,d,hull);assert.ok(raw,'the tap must hit the hull');const hit={p:raw.p,n:C.norm(raw.n)};
 const part=C.alignStructure({id:ship.nextId,k:'struct',c:[0,0,0],yaw:0,pitch:0,offsetX:0,offsetZ:0,...shape},hit,'surface');
 const draft=C.preparePlacementDraft(ship,part,{mode:'surface',parentStructureId:hull.id,hostId:hull.id,hit,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(draft.ok,true,draft.error);ship.parts.push(draft.part);ship.nextId++;C.refreshPlacementGeometry(ship);
 return {ship,hull,hit,part:ship.parts.at(-1)};
}
function assertGrounded(ship,part,label){
 assert.equal(part._placementError,undefined,label+': '+part._placementError);assert.ok(!part.placement.repairRequired&&!part.placement.validationFailed&&!part.placement.pendingGeometry,label+': '+JSON.stringify(part.placement.repairReason));
 assert.equal(connected(ship,part.id),true,label+' is connected');assert.equal(ungrounded(ship,part.id),false,label+' is grounded');
}
const near=(a,b,label,eps=1e-9)=>{for(let k=0;k<3;k++)assert.ok(Math.abs(a[k]-b[k])<=eps,`${label}: ${Array.from(a)} vs ${Array.from(b)}`);};
const reload=ship=>{const loaded=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))));C.refreshPlacementGeometry(loaded);return loaded;};

test("the user's saved design (mirrored trapezoid pair, contact-zero repair) recovers on load at its saved pose",()=>{
 const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/curved-hull-surface-plates.json'),'utf8'));
 for(const id of [36,37]){const p=raw.parts.find(q=>q.id===id);assert.equal(p.placement.mode,'surface');assert.equal(p.placement.repairRequired,true);assert.equal(p.placement.repairReason,'contact-zero');}
 const ship=C.deserialize(raw);C.refreshPlacementGeometry(ship);
 for(const id of [36,37]){const p=ship.parts.find(q=>q.id===id),saved=raw.parts.find(q=>q.id===id);assertGrounded(ship,p,'part '+id);
  near(p.c,saved.c,'the saved pose is kept');assert.equal(p.roll,saved.roll);
  // The overlap is genuine: about half of the plate lies inside the hull, and the ship grows only by the outside part.
  const contact=C.placementContact(ship,p,ship.parts.find(q=>q.id===1));assert.equal(contact.connected,true);assert.ok(contact.volume>C.partVolume(p)*.3&&contact.volume<C.partVolume(p)*.7,'overlap '+contact.volume);
  const without=C.computeStats({...ship,parts:ship.parts.filter(q=>q.id!==id),_cache:null}).volume,withPart=C.computeStats({...ship,_cache:null}).volume;
  assert.ok(Math.abs(withPart-without-(C.partVolume(p)-contact.volume))<=C.partVolume(p)*.02,`ship grows by ${withPart-without}, outside part ${C.partVolume(p)-contact.volume}`);}
 const st={warnings:[]};C.groundingStats(ship,st);assert.ok(!st.warnings.some(w=>w.code==='ungrounded'),JSON.stringify(st.warnings));
 // save -> reload is stable
 const again=reload(ship);for(const id of [36,37]){const a=ship.parts.find(q=>q.id===id),b=again.parts.find(q=>q.id===id);assertGrounded(again,b,'reloaded '+id);near(b.c,a.c,'reload keeps the pose');}
});

for(const [name,spec] of [['cigar',CIGAR],['ellipse',ELLIPSE]])test(`${name}: surface taps on the curved side (top-ish, mid, lower; both sides) are grounded for plates, rolled plates and boxes`,()=>{
 const h=C.newShip(spec,'new').hull;
 for(const [level,y] of [['top-ish',.82],['mid',.5],['lower',.22]])for(const [side,z,dz] of [['stbd',5,-1],['port',-5,1]])for(const [kind,shape] of Object.entries(SHAPES)){
  const r=tap(spec,[h.L*.45,h.H*y,h.W*z],[0,0,dz],shape(h));assertGrounded(r.ship,r.part,`${level} ${side} ${kind}`);}
});

test('a flat plate keeps the flush seat; a rolled plate lays its contact face into the skin without a gap',()=>{
 const h=C.newShip(CIGAR,'new').hull,flat=tap(CIGAR,[h.L*.45,h.H*.5,h.W*5],[0,0,-1],SHAPES.plate(h));
 const n=flat.hit.n,low=Math.min(...Array.from({length:C.structTriangles(flat.part).length/3},(_,i)=>C.dot(Array.from(C.structTriangles(flat.part).slice(i*3,i*3+3)),n)));
 assert.ok(Math.abs(low-C.dot(flat.hit.p,n))<1e-6,'an unrolled plate rests flush on the tangent plane');
 const fin=tap(CIGAR,[h.L*.45,h.H*.5,h.W*5],[0,0,-1],SHAPES.fin(h)),contact=C.placementContact(fin.ship,fin.part,fin.hull);
 assert.equal(contact.connected,true);assert.ok(contact.volume>0&&contact.volume<C.partVolume(fin.part)*.05,'only a sliver of the rolled plate conforms into the skin: '+contact.volume);
});

test('the mirrored copy of a rolled plate on the other side is grounded too',()=>{
 const h=C.newShip(CIGAR,'new').hull,r=tap(CIGAR,[h.L*.55,h.H*.5,h.W*5],[0,0,-1],SHAPES.fin(h));assertGrounded(r.ship,r.part,'source');
 const mirror=C.mirrorPart(r.part,r.ship);mirror.id=r.ship.nextId++;r.ship.parts.push(mirror);const again=C.refreshPlacementGeometry(r.ship);assert.equal(again.ok,true,JSON.stringify(again.failed));
 assert.ok(mirror.c[2]<0,'the copy is on the port side');assertGrounded(r.ship,mirror,'mirror');
});

test('a plate lifted off the hull, or buried wholly inside it, is still refused',()=>{
 const h=C.newShip(CIGAR,'new').hull;
 for(const kind of ['plate','fin','box']){const r=tap(CIGAR,[h.L*.45,h.H*.5,h.W*5],[0,0,-1],SHAPES[kind](h));assertGrounded(r.ship,r.part,kind);
  r.part.c=C.add(r.part.c,C.mul(r.hit.n,h.W*.02));const lifted=C.refreshPlacementGeometry(r.ship);assert.equal(lifted.ok,false,kind+' lifted');assert.equal(r.part._placementError,'contact-zero');assert.equal(ungrounded(r.ship,r.part.id),true,kind+' lifted is ungrounded');}
 const r=tap(CIGAR,[h.L*.45,h.H*.5,h.W*5],[0,0,-1],SHAPES.plate(h));r.part.c=C.sub(r.part.c,C.mul(r.hit.n,h.W*.2));C.refreshPlacementGeometry(r.ship);
 assert.equal(r.part._placementError,'contact-zero','a plate wholly inside the hull has no material of its own');assert.equal(ungrounded(r.ship,r.part.id),true);
 // A refused lifted plate stays refused after save/reload.
 const loaded=reload(r.ship),p=loaded.parts.find(q=>q.id===r.part.id);assert.ok(p._placementError);assert.equal(ungrounded(loaded,p.id),true);
});

test('a surface plate can be dragged along the side and sunk into the hull; save/reload keeps that pose grounded',()=>{
 const h=C.newShip(CIGAR,'new').hull;
 for(const kind of ['fin','finMirror','box']){const r=tap(CIGAR,[h.L*.45,h.H*.5,h.W*5],[0,0,-1],SHAPES[kind](h));assertGrounded(r.ship,r.part,kind);
  const along=C.add(r.part.c,[h.L*.05,0,0]);r.part.c=along.slice();let f=C.refreshPlacementGeometry(r.ship);assert.equal(f.ok,true,JSON.stringify(f.failed));near(r.part.c,along,'the drag is kept');assertGrounded(r.ship,r.part,kind+' dragged');
  const sunk=C.sub(r.part.c,C.mul(r.hit.n,h.W*.04));r.part.c=sunk.slice();f=C.refreshPlacementGeometry(r.ship);assert.equal(f.ok,true,JSON.stringify(f.failed));assertGrounded(r.ship,r.part,kind+' sunk');
  let ship=r.ship;for(let i=0;i<2;i++){ship=reload(ship);const p=ship.parts.find(q=>q.id===r.part.id);assertGrounded(ship,p,`${kind} reload ${i+1}`);near(p.c,sunk,`${kind} reload ${i+1} keeps the pose`);}}
});

// The same contact rule holds for structures on structures and in the other placement modes (user decision 2026-11-11).
test('structure on structure: a rolled surface plate and a vertical-mode block sunk into a rotated parent are joined by the overlap; lifted copies are refused',()=>{
 const ship=C.newShip({L:200,W:200,H:200,assembly:true});ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[80,60,40],roll:20,yaw:15}];ship.fits=[];ship.nextId=2;const parent=ship.parts[0];
 const raw=C.rayPart([0,200,0],[0,-1,0],parent),hit={p:raw.p,n:C.norm(raw.n)};
 const plate=C.alignStructure({id:2,k:'struct',form:'box',c:[0,0,0],s:[30,20,2],yaw:0,pitch:0,roll:6},hit,'surface');
 const r=C.solvePlacement(ship,plate,{mode:'surface',parentStructureId:1,hit});assert.equal(r.ok,true,r.code);assert.equal(r.contact.overlap,true);
 const lifted=C.solvePlacement(ship,{...r.part,c:C.add(r.part.c,C.mul(hit.n,3))},{mode:'surface',parentStructureId:1,keepTransform:true});assert.equal(lifted.ok,false);assert.equal(lifted.code,'contact-zero');
 const side=C.rayPart([200,0,0],[-1,0,0],parent),n=C.norm(side.n),out=C.norm([n[0],0,n[2]]),c=C.add(side.p,C.mul(out,4));
 const block=C.solvePlacement(ship,{id:3,k:'struct',form:'box',c,s:[10,10,10]},{mode:'vertical',parentStructureId:1,hit:{p:side.p,n},contactFit:'cut',position:c.slice()});
 assert.equal(block.ok,true,block.code);assert.equal(block.contact.connected,true);
 const away=C.add(side.p,C.mul(out,12)),far=C.solvePlacement(ship,{id:3,k:'struct',form:'box',c:away,s:[10,10,10]},{mode:'vertical',parentStructureId:1,hit:{p:side.p,n},contactFit:'cut',position:away});assert.equal(far.ok,false);
});
