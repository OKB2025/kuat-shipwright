// Horizontal placement on the curved or steep sides of a NEW design's hull
// (user report 2026-11-11). The horizontal cut is built in vertical columns;
// on a steep wall (no upward skin at the tap) or where the curved hull rises
// through the roof, the same cut is taken across the wall instead. The real
// overlap with the hull is the contact (user decision 2026-11-11): the
// overlapping part is removed and the structure is grounded. A structure
// that is really clear of the hull is still refused.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));

const CIGAR={L:1100,W:300,H:300,plan:'cigar',sec:'ellipse'},ELLIPSE={L:1100,W:300,H:200,plan:'ellipse',sec:'ellipse'};
function hullShip(spec){const ship=C.newShip(spec,'new');ship.fits=[];C.ensurePrimaryHull(ship);return {ship,hull:ship.parts.find(p=>C.isShapePart(p))};}
// The editor's pose (designStructureCutPreview): upright box, centre 0.3 h
// above (or below, for an underside contact) the tapped point.
function place(spec,o,d,{lift=null,normalOffset=false}={}){
 const {ship,hull}=hullShip(spec),hit=C.rayPart(o,d,hull);assert.ok(hit,'the tap must hit the hull');
 const n=C.norm(hit.n),size=[ship.hull.L*.08,ship.hull.W*.25,ship.hull.H*.2],side=n[1]<0?'top':'bottom';
 let c=normalOffset?C.add(hit.p,C.mul(n,size[2]*.3)):C.add(hit.p,[0,(side==='top'?-1:1)*size[2]*.3,0]);if(lift)c=C.add(c,lift);
 const part={id:ship.nextId,k:'struct',form:'box',c,s:size};
 const draft=C.preparePlacementDraft(ship,part,{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit:{p:hit.p,n},contactFit:'cut',position:c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION});
 assert.equal(draft.ok,true,draft.error);ship.parts.push(draft.part);ship.nextId++;C.refreshPlacementGeometry(ship);
 const placed=ship.parts.at(-1),stats={warnings:[]};C.groundingStats(ship,stats);
 return {ship,hull,hit:{...hit,n},part:placed,ungrounded:(stats.ungrounded?.parts||[]).includes(placed.id)};
}
// 2026-11-13 user decision: no fitting (no contact-face cut). Until then these structures were cut to the hull (the
// overlap removed, no material inside the hull). Now the requested body is kept whole and joined to the hull by the
// overlap, which the structural union counts once.
function assertGroundedWhole(r,label){
 assert.equal(r.part._placementError,undefined,label+': '+r.part._placementError);assert.equal(r.ungrounded,false,label+' is grounded');
 assert.equal(C.placementDiagnostics(r.ship).find(q=>q.partId===r.part.id).connected,true,label+' is connected');
 const requested=C.partVolume(r.part.placement.requestedGeometry),effective=C.partVolume(r.part);
 assert.ok(Math.abs(effective-requested)<=requested*1e-6,`${label}: kept whole (${effective} of ${requested})`);
 assert.ok(C.placementContact(r.ship,r.part,r.hull).overlap,label+': joined by its overlap with the hull');
}

for(const [name,spec,taps] of [
 ['cigar/ellipse',CIGAR,[['steep top x.7 z+.45',[.7,5,.45],[0,-1,0]],['steep top x.7 z-.45 (mirror)',[.7,5,-.45],[0,-1,0]],['side x.4 mid-height',[.4,.5,5],[0,0,-1]],['side x.6 mid-height (port mirror)',[.6,.5,-5],[0,0,1]]]],
 ['ellipse/ellipse',ELLIPSE,[['steep top x.3 z+.45',[.3,5,.45],[0,-1,0]],['steep top x.7 z+.45',[.7,5,.45],[0,-1,0]],['steep top x.7 z-.45 (mirror)',[.7,5,-.45],[0,-1,0]],['side x.6 y.5',[.6,.5,5],[0,0,-1]],['side x.4 y.5 (port mirror)',[.4,.5,-5],[0,0,1]],['side x.4 y.7',[.4,.7,5],[0,0,-1]],['side x.6 y.7',[.6,.7,5],[0,0,-1]]]],
 ['default wedge/rect',undefined,[['side x.4 mid-height',[.4,.5,5],[0,0,-1]],['side x.4 mid-height (port mirror)',[.4,.5,-5],[0,0,1]]]],
])test(`${name}: horizontal structures tapped on the curved/steep hull side are kept whole and grounded by the overlap`,()=>{
 const h=C.newShip(spec,'new').hull;
 for(const [label,o,d] of taps){const origin=[h.L*o[0],h.H*o[1],h.W*o[2]],r=place(spec,origin,d);assertGroundedWhole(r,label);}
});

test('the reported along-normal pose (repro script) is also grounded on the steep elliptic shoulder',()=>{
 const h=C.newShip(CIGAR,'new').hull,r=place(CIGAR,[h.L*.7,h.H*5,h.W*.45],[0,-1,0],{normalOffset:true});assertGroundedWhole(r,'cigar x.7 z.45 along normal');
});

test('the requested body keeps its outward faces and upright pose; the ship grows by less than its volume (overlap counted once)',()=>{
 const h=C.newShip(CIGAR,'new').hull,r=place(CIGAR,[h.L*.4,h.H*.5,h.W*5],[0,0,-1]),req=r.part.placement.requestedGeometry;
 const without=C.computeStats({...r.ship,parts:r.ship.parts.filter(p=>p.id!==r.part.id),_cache:null}).volume,withPart=C.computeStats(r.ship).volume,whole=C.partVolume(r.part);
 assert.ok(withPart-without>0&&withPart-without<whole*(1-1e-6),`ship volume grows by ${withPart-without}, body ${whole}`);
 assert.deepEqual(Array.from(r.part.c),Array.from(req.c),'the requested position is kept');assert.equal(r.part.pitch||0,0);assert.equal(r.part.roll||0,0);
 const outer=req.c[2]+req.s[1]/2,face=C.rayPart([req.c[0],req.c[1],h.W*5],[0,0,-1],r.part);assert.ok(face);assert.ok(Math.abs(face.p[2]-outer)<1e-4,'outer side face unchanged');
});

// 2026-11-13 user decision: no fitting; the user's own seat (a draft) brings the whole base down to the body along its
// contact axis. A horizontal draft beside the steep wall has a vertical contact axis and a lateral gap: no column under
// its footprint meets the hull, so the seat cannot close it and it is still refused, not moved (as before). A draft
// lifted above the top is brought down by the seat and joined (until then it was refused with a placement error).
test('a lateral gap from the steep hull side is still refused (not grounded, not moved); a gap above the top is closed by the seat',()=>{
 for(const spec of [CIGAR,ELLIPSE,undefined]){const h=C.newShip(spec,'new').hull,size=h.W*.25,r=place(spec,[h.L*.4,h.H*.5,h.W*5],[0,0,-1],{lift:[0,0,size*.5+h.W*.05]});
  assert.ok(r.part._placementError,'a floating structure keeps a placement error');assert.equal(r.ungrounded,true,'and is reported ungrounded');}
 const h=C.newShip(CIGAR,'new').hull,r=place(CIGAR,[h.L*.7,h.H*5,h.W*.45],[0,-1,0],{lift:[0,h.H*.6,0]});
 assert.equal(r.part._placementError,undefined,'the seat closes the gap above the top');assert.equal(r.ungrounded,false);assert.equal(C.placementContact(r.ship,r.part,r.hull).connected,true);
 // The same gap made afterwards (the hull moved down) is refused where the structure stands.
 const c=JSON.stringify(r.part.c);r.hull.c=C.add(r.hull.c,[0,-h.H,0]);r.ship._cache=null;C.refreshPlacementGeometry(r.ship);assert.equal(JSON.stringify(r.part.c),c,'not moved');assert.ok(r.part._placementError,'a gap made afterwards is refused in place');
});

// Changed 2026-11-11 (user decision: buried structures, wholly buried ones included,
// are grounded; the inspection list warns about them). Previously this asserted
// refusal with minimum-thickness/geometry-volume/contact-zero.
test('a structure wholly inside the hull is grounded whole and listed by the buried warning',()=>{
 const {ship,hull}=hullShip(CIGAR),h=ship.hull,hit=C.rayPart([h.L*.5,h.H*5,0],[0,-1,0],hull),size=[h.L*.04,h.W*.1,h.H*.05],c=C.sub(hit.p,[0,h.H*.3,0]);
 const r=C.solvePlacement(ship,{id:ship.nextId,k:'struct',form:'box',c,s:size},{mode:'horizontal',parentStructureId:hull.id,hit:{p:hit.p,n:C.norm(hit.n)},contactFit:'cut',position:c.slice()});
 assert.equal(r.ok,true,r.code);assert.equal(r.contact.whollyInside,true);assert.ok(Math.abs(C.partVolume(r.part)-size[0]*size[1]*size[2])<=size[0]*size[1]*size[2]*1e-6,'kept whole');
 const accepted=C.acceptPlacementResult(ship,r);assert.equal(accepted.ok,true);const st={warnings:[]};C.groundingStats(ship,st);assert.deepEqual(Array.from(st.buried),[accepted.part.id]);assert.ok(!(st.ungrounded?.parts||[]).includes(accepted.part.id));
});

// Known residual (follow-up, not widened here): at a few exact mid-height taps
// the lateral column cut leaves a ~3e-4 m sliver hole (2D cell weld in
// placementExtendedContactSolid ~1e-4 m, 3D weld in placementConformingSolid
// ~2.1e-4 m; the gap exceeds both, so matching them does not close it).
// The open cut is never accepted: placementConformingSolid refuses it.
// Changed 2026-11-11 (user decision: any genuine overlap is a contact, in every
// placement mode): these bodies really overlap the hull, so instead of being
// refused they are now accepted whole and closed (no cut, no open sliver); the
// structural union charges the shared volume once. Previously this test
// asserted ok:false with minimum-thickness/surface-missing.
const RESIDUAL=[[ELLIPSE,[.4,.5,5],[0,0,-1],false],[ELLIPSE,[.6,.5,5],[0,0,-1],true],[ELLIPSE,[.4,.5,-5],[0,0,1],true],[CIGAR,[.6,.5,-5],[0,0,1],true]];
test('residual mid-height taps are never accepted with an open cut: they join the hull whole by their real overlap',()=>{
 for(const [spec,o,d,normalOffset] of RESIDUAL){const {ship,hull}=hullShip(spec),h=ship.hull,hit=C.rayPart([h.L*o[0],h.H*o[1],h.W*o[2]],d,hull),n=C.norm(hit.n),size=[h.L*.08,h.W*.25,h.H*.2],c=normalOffset?C.add(hit.p,C.mul(n,size[2]*.3)):C.add(hit.p,[0,(n[1]<0?-1:1)*size[2]*.3,0]);
  const input={id:ship.nextId,k:'struct',form:'box',c,s:size},r=C.solvePlacement(ship,input,{mode:'horizontal',parentStructureId:hull.id,hit:{p:hit.p,n},contactFit:'cut',position:c.slice()});
  assert.equal(r.ok,true,JSON.stringify(o)+': '+r.code);assert.ok(Math.abs(C.partVolume(r.part)-size[0]*size[1]*size[2])<=size[0]*size[1]*size[2]*1e-6,'the whole closed body is kept, not an open cut');
  assert.equal(r.contact.overlap,true,'connected by its real overlap with the hull');assert.ok(r.contact.volume>0&&r.contact.volume<C.partVolume(r.part));}
});
// 2026-11-13 user decision: no fitting, so there is no lateral cut and no sliver; the todo became an ordinary check.
test('residual mid-height taps are grounded whole through the editor path',()=>{
 for(const [spec,o,d,normalOffset] of RESIDUAL){const h=C.newShip(spec,'new').hull;assertGroundedWhole(place(spec,[h.L*o[0],h.H*o[1],h.W*o[2]],d,{normalOffset}),JSON.stringify(o));}
});

test('a structure on the hull wall can be dragged along it and stays grounded',()=>{
 for(const [spec,o,d] of [[CIGAR,[.4,.5,5],[0,0,-1]],[CIGAR,[.7,5,.45],[0,-1,0]]]){
  const h=C.newShip(spec,'new').hull,r=place(spec,[h.L*o[0],h.H*o[1],h.W*o[2]],d);assertGroundedWhole(r,'before drag');
  const start=Array.from(r.part.c),target=C.add(start,[h.L*.02,0,0]);r.part.c=target.slice();const refreshed=C.refreshPlacementGeometry(r.ship);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));
  assert.ok(Math.abs(r.part.c[0]-target[0])<1e-6,`the drag is not clamped back: ${r.part.c[0]} vs ${target[0]} (start ${start[0]})`);
  assertGroundedWhole({...r,ungrounded:(()=>{const st={warnings:[]};C.groundingStats(r.ship,st);return (st.ungrounded?.parts||[]).includes(r.part.id);})()},'after drag');}
});

// 2026-11-13 user decision: no fitting. Until then the lateral cut left no material inside the hull; now the requested
// body overlaps the hull (the union counts the shared volume once).
test('the requested body overlaps the hull instead of being cut back to its skin',()=>{
 const h=C.newShip(CIGAR,'new').hull,r=place(CIGAR,[h.L*.4,h.H*.5,h.W*5],[0,0,-1]),req=r.part.placement.requestedGeometry,N=7;let inside=0,both=0;
 for(let i=0;i<N;i++)for(let j=0;j<N;j++)for(let k=0;k<N;k++){const q=[0,1,2].map((a,m)=>req.c[a]+req.s[[0,2,1][a]]*(([i,j,k][m]+.5+.0371*m)/N-.5));if(C.inPart(r.part,q)){inside++;if(C.inPart(r.hull,q))both++;}}
 assert.equal(inside,N*N*N,'every sample of the requested body is part of it');assert.ok(both>0,'some of the body lies inside the hull');
});

test('save/load and a mirrored copy re-solve the lateral cut to the same grounded volume',()=>{
 const h=C.newShip(CIGAR,'new').hull,r=place(CIGAR,[h.L*.4,h.H*.5,h.W*5],[0,0,-1]),volume=C.partVolume(r.part),id=r.part.id;
 const loaded=C.deserialize(JSON.parse(C.publicJSON(C.serialize(r.ship))));const refreshed=C.refreshPlacementGeometry(loaded);assert.equal(refreshed.ok,true,JSON.stringify(refreshed.failed));const saved=loaded.parts.find(p=>p.id===id);
 assert.ok(Math.abs(C.partVolume(saved)-volume)<=volume*1e-9+1e-6,`reloaded volume ${C.partVolume(saved)} vs ${volume}`);assert.equal(C.placementDiagnostics(loaded).find(q=>q.partId===id).connected,true);
 const st={warnings:[]};C.groundingStats(loaded,st);assert.equal((st.ungrounded?.parts||[]).includes(id),false);
 const mirror=C.mirrorPart(r.part,r.ship);mirror.id=r.ship.nextId++;r.ship.parts.push(mirror);const again=C.refreshPlacementGeometry(r.ship);assert.equal(again.ok,true,JSON.stringify(again.failed));
 assert.ok(mirror.c[2]<0,'the copy is on the port side');assert.equal(mirror._placementError,undefined,mirror._placementError);assert.ok(Math.abs(C.partVolume(mirror)-volume)<=volume*1e-3,`mirrored volume ${C.partVolume(mirror)} vs ${volume}`);
 const ms={warnings:[]};C.groundingStats(r.ship,ms);assert.equal((ms.ungrounded?.parts||[]).includes(mirror.id),false,'the mirrored copy is grounded');
});

// Changed 2026-11-11 (user decision: any genuine overlap is a contact). A parent
// piercing a thin plate is still never cut sideways (the authored plate is kept
// whole), but the plate now joins the parent by that real overlap instead of
// being refused with minimum-thickness.
test('a near-flat roof is never cut sideways: a parent piercing a thin plate keeps the whole plate, joined by the overlap',()=>{
 const ship=C.newShip({L:100,W:100,H:100,assembly:true});ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[60,60,20],roll:10}];ship.fits=[];ship.nextId=2;
 const hit=C.rayPart([0,100,0],[0,-1,0],ship.parts[0]),n=C.norm(hit.n);assert.ok(Math.hypot(n[0],n[2])<.3&&Math.hypot(n[0],n[2])>.1,'a gentle slope with a real horizontal component');
 const r=C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:hit.p.slice(),s:[20,20,1]},{mode:'horizontal',contactFit:'cut',position:hit.p.slice(),parentStructureId:1,hit:{p:hit.p,n}});
 assert.equal(r.ok,true,r.code);assert.ok(Math.abs(C.partVolume(r.part)-400)<400*1e-6,'the plate is not cut: '+C.partVolume(r.part));assert.equal(r.contact.overlap,true);
 // 2026-11-13 user decision: the user's seat (here a drag position) sinks the plate until its whole base reaches the
 // roof, so the same plate dragged 15 m above the roof is seated on it and joined (until then it was refused).
 const lifted=C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:C.add(hit.p,[0,15,0]),s:[20,20,1]},{mode:'horizontal',contactFit:'cut',position:C.add(hit.p,[0,15,0]),parentStructureId:1,hit:{p:hit.p,n}});assert.equal(lifted.ok,true,lifted.code);assert.ok(C.partAABB(lifted.part)[1]<hit.p[1],'seated down onto the roof');
});
