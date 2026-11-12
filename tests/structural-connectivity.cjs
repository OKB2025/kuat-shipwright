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

// ---- Stage 1 regression review (ca2e00e) ----
const statsOf=s=>{const k=C.computeStats({...s,_cache:null});return {mass:k.mass,volume:k.volume,cost:k.cost};};
function placeOn(ship,parent,x,label,size=[16,8,6],lift=1.8){
 const raw=C.rayPart([x,500,0],[0,-1,0],parent),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+lift,hit.p[2]];
 const d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',label,c,s:size,yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:parent.id,hostId:parent.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));return ship.parts.find(q=>q.label===label);
}

test('a severed piece grounds nothing: parts that reach the root only through it are severed with it (cycle with no root)',()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'cut piece');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const A=placeOn(ship,hull,110,'A'),B=placeOn(ship,A,106,'B',[6,6,4],1.2),Cc=placeOn(ship,A,114,'C',[6,6,4],1.2);
 // B and C both stand on A and overlap each other (a cycle A-B-C); a cut takes the deck from under A.
 cut(ship,hull,[110,28,0],[40,16,40]);C.refreshPlacementGeometry(ship);
 const S=grounding(ship);for(const q of [A,B,Cc])assert.ok(!S.ungrounded.parts.includes(q.id),q.label+': not red');
 same([...S.severed].sort((a,b)=>a-b),[A.id,B.id,Cc.id].sort((a,b)=>a-b),'the whole cut-off piece is severed');
 const rows=Object.fromEntries(S.severedCuts.map(r=>[r.partId,r]));assert.ok(rows[A.id].cutIds.length>0,'A: the cut');assert.ok(rows[B.id].through.includes(A.id),'B: through A');
 for(const q of [A,B,Cc]){const d=S.placementDiagnostics.find(x=>x.partId===q.id);assert.equal(d.connected,false,q.label+' diagnostics');assert.equal(d.code,'severed',q.label);}
 assert.equal(S.warnings.find(w=>w.code==='severed').targets.length,3);
 const g=C.structuralConnectivity(ship);for(const q of [A,B,Cc])assert.ok(!g.connected.has(q.id),q.label+': not in the root component');
});

test('a part touching only a severed neighbour is not grounded by it',()=>{
 const {ship,hull,A,D}=design();
 // A lifts off the deck (no cut): it is not severed, and D still grounds it through the contact graph.
 // Then cut under both: D and A are severed; nothing is grounded by them.
 cut(ship,hull,[112,28,0],[20,16,40]);cut(ship,hull,[93,28,0],[18,16,40]);C.refreshPlacementGeometry(ship);
 const S=grounding(ship);assert.ok(S.severed.includes(A.id)&&S.severed.includes(D.id));
 for(const q of [A,D]){const d=S.placementDiagnostics.find(x=>x.partId===q.id);assert.equal(d.connected,false);assert.equal(d.code,'severed');}
});

test('a child kept whole after a contact-type fit failure stays stable over three refreshes; negatives are not kept',()=>{
 const make=()=>{const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'kept');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0],id=ship.nextId++;
  const recess=c=>{C.hullOwnSolidCut(ship,hull,{id,shape:'box',c,s:[20,6,20],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;};recess([110,30,0]);C.refreshPlacementGeometry(ship);
  const box=placeOn(ship,hull,110,'box',[6,4,4],2.5);recess([122,30,0]);return {ship,hull,box,recess};};
 {const {ship,box}=make();const masses=[];const updated=[];for(let i=0;i<3;i++){ship._cache=null;const r=C.refreshPlacementGeometry(ship);updated.push(r.updated.includes(box.id));masses.push(statsOf(ship).mass);}
  assert.ok(box._placementKeptWhole,'kept whole');assert.equal(box._placementError,undefined);same(updated.slice(1),[false,false],'not re-solved on every refresh');assert.ok(masses.every(m=>m===masses[0]),'no mass flicker: '+masses.join(','));}
 // Parent resized: the stored pose no longer describes the child.
 {const {ship,hull,box}=make();C.refreshPlacementGeometry(ship);hull.s=[hull.s[0],hull.s[1],hull.s[2]*1.01];ship._cache=null;C.refreshPlacementGeometry(ship);assert.ok(!box._placementKeptWhole||box.placement.parentPoseKey===C.placementPositionKey(hull),'resized parent: never kept on the old parent pose');}
 // Parent moved within the anchor tolerance: the persisted parent pose key still differs.
 {const {ship,hull,box}=make();C.refreshPlacementGeometry(ship);const kept=box._placementKeptWhole;hull.c=[hull.c[0]+1e-6,hull.c[1],hull.c[2]];ship._cache=null;C.refreshPlacementGeometry(ship);assert.notEqual(box._placementKeptWhole,kept,'a moved parent re-judges the child');}
 // A real gap (no contact at all) is never kept.
 {const {ship,box,recess}=make();recess([110,26,0]);C.refreshPlacementGeometry(ship);assert.equal(box._placementKeptWhole,undefined,'a hovering child is not kept whole');}
 // A user edit is never kept.
 {const {ship,box}=make();C.refreshPlacementGeometry(ship);box.c=[box.c[0],box.c[1]+3,box.c[2]];ship._cache=null;C.refreshPlacementGeometry(ship);assert.equal(box._placementKeptWhole,undefined,'an edited child is solved, not kept');}
 // Only contact-type codes.
 for(const code of ['minimum-thickness','geometry-open','geometry-volume','contact-shape','geometry-complex'])assert.equal(C.PLACEMENT_FIT_KEEP_CODES.has(code),false,code);
});

test('the pair cache re-measures only what changed; it is not saved; hull cuts are part of the hull shape',()=>{
 const {ship,hull,A,D}=design();let g=C.structuralConnectivity(ship);g=C.structuralConnectivity(ship);assert.equal(g.measured,0);
 cut(ship,hull,[20,28,0],[6,6,6]);g=C.structuralConnectivity(ship);assert.equal(g.measured,0,'a cut far from every pair re-measures nothing');
 cut(ship,hull,[106,31,0],[2,2,2]);g=C.structuralConnectivity(ship);assert.ok(g.measured>0,'a cut at A re-measures its pairs');
 D.c=[D.c[0],D.c[1],D.c[2]+.01];g=C.structuralConnectivity(ship);assert.ok(g.measured>0,'a pose change re-measures');
 hull.s=[hull.s[0]*1.001,hull.s[1],hull.s[2]];ship._cache=null;g=C.structuralConnectivity(ship);assert.ok(g.measured>0,'a parent edit re-measures');
 assert.equal(C.publicJSON(ship).includes('_structuralContactCache'),false);assert.equal(JSON.stringify(C.serialize(ship)).includes('_structuralContactCache'),false);
 assert.ok(JSON.parse(C.publicJSON(hull)).hullData.solidCuts.length===2,'the hull own solid cuts are in its public shape');
});

test('a child whose parent no longer touches it but which rests on a connected neighbour stays connected (no severed warning)',()=>{
 // D (x 80..96) and A (x 102..118) stand apart on the deck; B stands on A and reaches over D's top.
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'neighbour');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const D=placeOn(ship,hull,88,'D'),A=placeOn(ship,hull,110,'A'),B=placeOn(ship,A,104,'B',[20,8,4],1.2);
 assert.equal(C.placementContact(ship,B,D).connected,true,'B also rests on D');
 const top=C.partAABB(A)[4];ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[110,top-.5,0],s:[18,40,1],structures:true}));ship._cache=null;const r=C.refreshPlacementGeometry(ship);
 assert.equal(C.placementContact(ship,B,A).connected,false,'A was carved from under B');assert.equal(B._placementError,undefined);same(r.severed.filter(q=>q.partId===B.id),[]);
 const S=grounding(ship),d=S.placementDiagnostics.find(x=>x.partId===B.id);assert.ok(!S.ungrounded.parts.includes(B.id));assert.ok(!S.severed.includes(B.id));assert.equal(d.connected,true);assert.equal(d.via,'contact-graph');
 const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship)))),S2=grounding(L);assert.ok(!S2.ungrounded.parts.includes(B.id)&&!S2.severed.includes(B.id),'reload agrees');
});

// ---- Stage 1 high review (8642163) ----
test('a kept-whole child stays connected after a reload or deferred load followed by an unrelated hull cut',()=>{
 const make=()=>{const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'kept');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0],id=ship.nextId++;
  const recess=c=>{C.hullOwnSolidCut(ship,hull,{id,shape:'box',c,s:[20,6,20],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;};recess([110,30,0]);C.refreshPlacementGeometry(ship);
  placeOn(ship,hull,110,'box',[6,4,4],2.5);recess([122,30,0]);C.refreshPlacementGeometry(ship);return ship;};
 const farCut=s=>{C.hullOwnSolidCut(s,s.parts[0],{id:s.nextId++,shape:'box',c:[20,28,0],s:[4,4,4],rotation:[0,0,0],mirror:false,structures:false});s._cache=null;return C.refreshPlacementGeometry(s);};
 const ship=make();for(const [label,L] of [['reload',C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))))],['deferred',(()=>{const D=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),{deferPlacementGeometry:true});C.refreshPlacementGeometry(D);return D;})()]]){
  const b=L.parts.find(q=>q.label==='box');assert.equal(b.placement.parentPoseKey,C.placementPositionKey(L.parts[0]),label+': the parent key matches after a reload');
  const r=farCut(L),S=grounding(L);assert.equal(r.ok,true,label+' '+JSON.stringify(r.failed));assert.equal(b._placementError,undefined,label);assert.ok(!S.ungrounded.parts.includes(b.id),label+': not red');}
});

test('a mirrored hull-owned cut on a hull off the centreline: the pair cache and severingCuts see it',()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'mirror');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const h2=JSON.parse(C.publicJSON(hull));h2.id=ship.nextId++;h2.c=[hull.c[0],hull.c[1],hull.c[2]+20];delete h2.primaryHull;h2.label='H2';h2.hullData={...h2.hullData,solidCuts:[],subs:[]};ship.parts.push(h2);ship._cache=null;C.refreshPlacementGeometry(ship);
 const H2=ship.parts.find(q=>q.label==='H2'),raw=C.rayPart([110,500,25],[0,-1,0],H2),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+1.8,hit.p[2]];
 const d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',label:'S',c,s:[8,8,4],yaw:0,pitch:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:H2.id,hostId:H2.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;C.refreshPlacementGeometry(ship);
 const S=ship.parts.find(q=>q.label==='S');assert.ok(C.structuralConnectivity(ship).adj.get(S.id).has(H2.id));
 // Drawn on the other side of H2's own centreline (local z -5); its mirror (local z +5) is under S.
 const local=[110,31.2,-5],id=ship.nextId++;H2.hullData.solidCuts.push(C.normalizeSolidCut({id,shape:'box',c:local,s:[20,8,6],rotation:[0,0,0],mirror:true,structures:false}));ship._cache=null;C.refreshPlacementGeometry(ship);
 assert.equal(C.placementContact(ship,S,H2).connected,false,'the mirrored cut took the deck from under S');const g=C.structuralConnectivity(ship);assert.equal(g.adj.get(S.id).has(H2.id),false,'the cached pair was re-measured');
 const St=grounding(ship);assert.ok(St.severed.includes(S.id));assert.ok(St.severedCuts.find(r=>r.partId===S.id).cutIds.includes(id),'severingCuts lists the mirrored cut');
});

test('several edits in one refresh: the contact graph is rebuilt after each change, so the result equals later refreshes and a reload',()=>{
 const {ship,hull,A,D}=design();const X=placeOn(ship,hull,40,'X');
 // One refresh carries three cuts: under X, under D and under A.
 cut(ship,hull,[40,28,0],[20,16,40]);cut(ship,hull,[93,28,0],[18,16,40]);cut(ship,hull,[112,28,0],[20,16,40]);
 C.refreshPlacementGeometry(ship);const look=s=>{const S=grounding(s);return JSON.stringify([X,D,A].map(q=>{const r=s.parts.find(z=>z.id===q.id);return [S.severed.includes(q.id),S.ungrounded.parts.includes(q.id),!!r._placementError];}));};
 const first=look(ship);for(let i=0;i<2;i++){ship._cache=null;C.refreshPlacementGeometry(ship);}same(look(ship),first,'later refreshes');same(look(C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))))),first,'reload');
 const S=grounding(ship);assert.ok(S.severed.includes(A.id)&&S.severed.includes(D.id),'A is not grounded through the severed D');
});

test('parts in a failure or still being solved carry nothing in the contact graph',()=>{
 const {ship,hull,A,D}=design();cut(ship,hull,[112,28,0],[20,16,40]);C.refreshPlacementGeometry(ship);assert.ok(C.structuralConnectivity(ship).connected.has(A.id),'A rests on D');
 D._placementError='contact-zero';assert.equal(C.structuralConnectivity(ship).connected.has(A.id),false,'not through a failed D');delete D._placementError;
 D.placement.validationFailed=true;assert.equal(C.structuralConnectivity(ship).connected.has(A.id),false,'not through an unsolved D');
});

test('severingCuts lists a hull-owned notch',()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'notch');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0],A=placeOn(ship,hull,110,'A');
 const id=ship.nextId++;hull.hullData.subs.push({id,structures:false,b:[100,20,-20,120,40,20]});ship._cache=null;C.refreshPlacementGeometry(ship);
 const S=grounding(ship);assert.ok(S.severed.includes(A.id),'A is cut off by the notch');assert.ok(S.severedCuts.find(r=>r.partId===A.id).cutIds.includes(id),'the notch is named');
});

// Item 5 (decision 1) was withdrawn by the 2026-11-12 user decision: children do not follow their parent. The
// hull moves 40 m; the children stay where they were and, touching no connected body, are red (a neighbour that
// was left behind with them does not connect them). Reload agrees.
for(const withNeighbour of [true,false])
 test(`the hull moves 40 m under a fixed cut: the child stays where it was and is reported${withNeighbour?' (with a neighbour left behind too)':''} (live = reload)`,()=>{
  const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'carry');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
  const N=withNeighbour?placeOn(ship,hull,95,'N'):null,A=placeOn(ship,hull,110,'A');
  ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[112,26,40],s:[20,20,16],structures:true}));ship._cache=null;C.refreshPlacementGeometry(ship);
  const a0=A.c.slice();hull.c=[hull.c[0],hull.c[1],hull.c[2]+40];ship._cache=null;C.refreshPlacementGeometry(ship);
  same(A.c.map((v,i)=>+(v-a0[i]).toFixed(6)),[0,0,0],'not carried with the hull');assert.equal(C.placementContact(ship,A,hull).connected,false);
  const S=grounding(ship);assert.ok(S.ungrounded.parts.includes(A.id),'red');assert.ok(!S.severed.includes(A.id));
  if(withNeighbour)assert.ok(S.ungrounded.parts.includes(N.id),'the neighbour left behind is red too');
  const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship)))),S2=grounding(L),a=L.parts.find(q=>q.id===A.id);same(a.c.map(v=>+v.toFixed(6)),A.c.map(v=>+v.toFixed(6)),'reload keeps the pose');
  assert.ok(S2.ungrounded.parts.includes(A.id),'reload: red');
 });

