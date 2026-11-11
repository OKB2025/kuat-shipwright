// Stage 1 (user decision 2026-11-11): connection is the contact graph. A placed structure is connected
// when it really touches any connected body, not only its own parent. docs/design-placement-v1.2.md
// "削りと接続" stage 1.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
function design(){
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'graph');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const place=(x,label)=>{const raw=C.rayPart([x,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+1.8,hit.p[2]];
  const d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',label,c,s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
  assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));return ship.parts.find(p=>p.label===label);};
 // D (x 87..103) and A (x 102..118) sit side by side on the deck and overlap by 1 m.
 const D=place(95,'D'),A=place(110,'A');return {ship,hull,A,D};
}
const cut=(ship,hull,c,s)=>{const id=ship.nextId++;C.hullOwnSolidCut(ship,hull,{id,shape:'box',c,s,rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;return id;};
const grounding=ship=>{const S={warnings:[]};C.groundingStats(ship,S);return S;};

test('a structure cut off from its parent but touching a connected neighbour stays connected (no red, no severed warning)',()=>{
 const {ship,hull,A,D}=design();cut(ship,hull,[112,28,0],[20,16,40]);C.refreshPlacementGeometry(ship);
 assert.equal(C.placementContact(ship,A,hull).connected,false,'A lost its parent contact');assert.equal(C.placementContact(ship,A,D).connected,true,'A still touches D');
 const check=(s,label)=>{const S=grounding(s),a=s.parts.find(p=>p.label==='A'),d=S.placementDiagnostics.find(x=>x.partId===a.id);
  assert.ok(!S.ungrounded.parts.includes(a.id),label+': no red frame');same(S.severed,[],label+': no severed warning');
  assert.equal(d.connected,true,label);assert.equal(d.via,'contact-graph',label);assert.equal(d.parentContact,false,label);assert.ok(d.neighbours.includes(s.parts.find(p=>p.label==='D').id),label);
  const g=C.structuralConnectivity(s);assert.ok(g.connected.has(a.id),label+': in the root component');};
 check(ship,'live');check(C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship)))),'reload');
});

test('when the neighbour is cut off too, both are severed and the responsible cuts are listed',()=>{
 const {ship,hull,A,D}=design(),first=cut(ship,hull,[112,28,0],[20,16,40]),second=cut(ship,hull,[93,28,0],[18,16,40]);C.refreshPlacementGeometry(ship);
 const S=grounding(ship);same([...S.severed].sort((a,b)=>a-b),[D.id,A.id].sort((a,b)=>a-b));assert.ok(!S.ungrounded.parts.includes(A.id)&&!S.ungrounded.parts.includes(D.id),'warnings, not red');
 const byPart=Object.fromEntries(S.severedCuts.map(r=>[r.partId,r.cutIds]));assert.ok(byPart[A.id].includes(first),'A: the cut under it');assert.ok(byPart[D.id].includes(second),'D: the cut under it');
 const d=S.placementDiagnostics.find(x=>x.partId===A.id);assert.equal(d.code,'severed');assert.ok(d.cutIds.includes(first));
});

test('a structure that touches nothing is still red; the pair cache re-measures only changed pairs',()=>{
 const {ship,hull,A}=design();let g=C.structuralConnectivity(ship);const first=g.measured+g.reused;g=C.structuralConnectivity(ship);assert.equal(g.measured,0,'unchanged pairs are reused');assert.equal(g.reused,first);
 // Lift A into empty space without a re-solve (a refresh would clamp the move to keep contact).
 A.c=[A.c[0],A.c[1]+20,A.c[2]];delete A._placementGeometry;delete A._placementPrecise;ship._cache=null;g=C.structuralConnectivity(ship);assert.ok(!g.connected.has(A.id));
 const S=grounding(ship);assert.ok(S.ungrounded.parts.includes(A.id),'a body touching nothing is red');
});

// Round-4 backlog (also on origin/main): a fitted recess moved so its wall crosses the child's footprint.
// The cut-fit cannot be rebuilt, but the child at its stored pose still touches: it stays connected with
// its whole requested body (no red repair state), live and after reload alike.
for(const [name,lift] of [['hovering box',2.5],['box on the floor',1.2]])
 test(`a fitted recess moved 12 m so its wall crosses the child (${name}): still touching, so connected (live = reload)`,()=>{
  const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'recess4');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0],id=ship.nextId++;
  const recess=c=>{C.hullOwnSolidCut(ship,hull,{id,shape:'box',c,s:[20,6,20],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;};
  recess([110,30,0]);C.refreshPlacementGeometry(ship);
  const raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},part={id:ship.nextId,k:'struct',form:'box',c:[110,hit.p[1]+lift,0],s:[6,4,4],yaw:0,pitch:0,offsetX:0,offsetZ:0};
  const d=C.preparePlacementDraft(ship,part,{mode:'horizontal',parentStructureId:1,hostId:1,hit,contactFit:'cut',position:part.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});ship.parts.push(d.part);ship.nextId++;assert.equal(C.refreshPlacementGeometry(ship).ok,true);
  const box=ship.parts.at(-1),c=box.c.slice();recess([122,30,0]);const r=C.refreshPlacementGeometry(ship);
  const look=(s,b)=>{const S=grounding(s);return {ok:!b._placementError,c:b.c.map(v=>+v.toFixed(6)),contact:C.placementContact(s,b,s.parts[0]).connected,red:S.ungrounded.parts.includes(b.id),severed:S.severed.includes(b.id),vol:+C.partVolume(b).toFixed(4),mass:+C.computeStats({...s,_cache:null}).mass.toFixed(3)};};
  assert.equal(r.ok,true,JSON.stringify(r.failed));const live=look(ship,box);assert.equal(live.ok,true);assert.equal(live.contact,true);assert.equal(live.red,false);assert.equal(live.severed,false);same(live.c,c.map(v=>+v.toFixed(6)),'not moved');
  const D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(D);same(look(D,D.parts.find(q=>q.id===box.id)),live,'reload');
 });
