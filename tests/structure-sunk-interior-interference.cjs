// A structure sunk into the hull (減り込み配置) over interior equipment is not a clash (user rule
// 2026-11-12: a structure adds material to the hull body, the interior is the hull plus its attached
// structures). Report 2026-11-12: mirrored ellipsoid structures sunk into a cigar hull's sides were
// refused with placement-interference because six legacy repulsors without placement metadata were
// counted as fixed exterior equipment. Exterior equipment still clashes (design-placement-v1.2.md
// 「配置と保存の契約」: exterior propulsion, weapons and command inherit the interference rules).
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const saved=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/sunk-structure-interference-2026-11-12.json.gz'))).toString('utf8'));
const SUNK=[100,101],LEGACY=[90,91,92,93,94,95];
const statsOf=s=>{const k=C.computeStats({...s,_cache:null});return {mass:k.mass,volume:k.volume};};
// Same mass and volume up to floating-point noise of the mesh unions (a few kg in 1.3e5 t).
const closeStats=(a,b,label)=>{for(const k of ['mass','volume'])assert.ok(Math.abs(a[k]-b[k])<=1e-6*Math.abs(b[k]),`${label}: ${k} ${a[k]} vs ${b[k]}`);};
const grounding=ship=>{const S={warnings:[]};C.groundingStats(ship,S);return S;};
const reload=(ship,options)=>C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))),options);
function assertRecovered(ship,label){
 const S=grounding(ship);
 for(const id of SUNK){const p=ship.parts.find(q=>q.id===id),meta=p.placement;
  assert.equal(p._placementError,undefined,`${label} #${id}: ${p._placementError}`);
  // The authored tilt (左右の傾き) is kept: −8° on #100 and +8° on its mirror #101, as saved.
  assert.equal(p.roll,id===100?-8:8,`${label} #${id}: roll kept`);assert.equal(meta.requestedGeometry.roll,p.roll,label+': requested roll');
  assert.ok(!meta.validationFailed&&!meta.repairRequired&&!meta.pendingGeometry,`${label} #${id}: ${meta.repairReason}`);
  assert.equal(meta.repairReason,undefined,label);
  const d=S.placementDiagnostics.find(x=>x.partId===id);assert.equal(d.connected,true,label+' #'+id+' '+JSON.stringify(d));assert.equal(d.code,null,label);
  assert.ok(!S.ungrounded.parts.includes(id),label+': no red frame');
  assert.equal(C.placementContact(ship,p,ship.parts[0]).connected,true,label+': touches the hull');}
 assert.ok(!S.warnings.some(w=>/interference/.test(w.code||'')),label+': '+JSON.stringify(S.warnings));
 return S;
}
// Re-solve a structure at its saved pose against `ship` (the solve a reload runs for a stored repair).
function resolveAt(ship,source){
 const meta={...source.placement};for(const key of ['validationFailed','repairRequired','repairReason','validationSourceKey','pendingGeometry'])delete meta[key];
 const input={...JSON.parse(C.publicJSON(source)),placement:meta};delete input.tw;
 return C.solvePlacement(ship,input,{...meta,keepTransform:true,geometryRevision:meta.geometryRevision||0,parentGeometryRevision:0});
}
const without=(raw,ids)=>{const o=JSON.parse(JSON.stringify(raw));o.parts=o.parts.filter(p=>!ids.includes(p.id));for(const p of o.parts)if(ids.includes(p.tw))delete p.tw;return o;};

test('the reported design: the saved placement-interference refusal recovers on load (live, reload, deferred)',()=>{
 const raw=saved();for(const id of SUNK){const m=raw.parts.find(p=>p.id===id).placement;assert.equal(m.validationFailed,true);assert.equal(m.repairReason,'placement-interference');}
 const ship=C.deserialize(raw);assertRecovered(ship,'load');
 const again=reload(ship);assertRecovered(again,'save/reload');closeStats(statsOf(again),statsOf(ship),'load vs save/reload');
 for(const id of SUNK)assert.equal(JSON.stringify(again.parts.find(p=>p.id===id).c),JSON.stringify(ship.parts.find(p=>p.id===id).c),'same pose after save/reload');
 const deferred=reload(ship,{deferPlacementGeometry:true}),r=C.refreshPlacementGeometry(deferred);assert.equal(r.ok,true,JSON.stringify(r.failed));assertRecovered(deferred,'deferred reload');
 // The interior equipment around them stays valid.
 for(const p of ship.parts.filter(p=>!C.isShapePart(p)))assert.equal(p._placementError,undefined,`#${p.id} ${p.k}: ${p._placementError}`);
});

test('a sunk structure over legacy repulsors without placement metadata is not refused',()=>{
 const ship=C.deserialize(without(saved(),SUNK)),source=saved().parts.find(p=>p.id===100);
 for(const id of LEGACY)assert.equal(ship.parts.find(p=>p.id===id).placement,undefined,'legacy, no placement record');
 const r=resolveAt(ship,source);assert.equal(r.ok,true,r.code+' '+r.error);
 const hit=LEGACY.filter(id=>C.overlapParts(r.part,ship.parts.find(p=>p.id===id)));assert.ok(hit.length>=3,'the structure really overlaps the repulsors: '+hit);
 // Only the repulsors: the same structure over the legacy parts alone.
 const only=C.deserialize(without(saved(),[...SUNK,72,75,82,83,86,87,88,89]));const r2=resolveAt(only,source);assert.equal(r2.ok,true,r2.code+' '+r2.error);
 assert.ok(LEGACY.some(id=>C.overlapParts(r2.part,only.parts.find(p=>p.id===id))));
 // Other legacy interior kinds without metadata (a reactor) are interior equipment too.
 const raw=without(saved(),[...SUNK,72,75,82,83,86,87,88,89]);for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k:'gen',c:p.c,d:4};for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}
 const gens=C.deserialize(raw),r3=resolveAt(gens,source);assert.equal(r3.ok,true,'legacy gen: '+r3.code);assert.ok(LEGACY.some(id=>C.overlapParts(r3.part,gens.parts.find(p=>p.id===id))),'overlaps the legacy reactors');
});

test('a sunk structure over direct and clip interior equipment is not refused',()=>{
 const ship=C.deserialize(without(saved(),[...SUNK,...LEGACY])),source=saved().parts.find(p=>p.id===100);
 const r=resolveAt(ship,source);assert.equal(r.ok,true,r.code+' '+r.error);
 const over=ship.parts.filter(p=>!C.isShapePart(p)&&C.overlapParts(r.part,p)),modes=new Set(over.map(p=>p.placement?.mode));
 assert.ok(modes.has('direct')&&modes.has('clip'),'overlaps both direct and clip interior equipment: '+over.map(p=>p.id+':'+p.placement?.mode));
 C.acceptPlacementResult(ship,r);const done=C.refreshPlacementGeometry(ship);assert.equal(done.ok,true,JSON.stringify(done.failed));
 for(const p of over){const q=ship.parts.find(x=>x.id===p.id);assert.equal(q._placementError,undefined,`#${q.id} ${q.k} (${q.placement.mode}): ${q._placementError}`);}
});

test('exterior equipment under the structure still clashes (placement-interference)',()=>{
 const source=saved().parts.find(p=>p.id===100);
 // A legacy shield projector without placement metadata was mounted outside: still a clash.
 for(const k of ['sensor','engine','shield']){
  // Replace the legacy repulsors under the structure with exterior equipment at the same spot.
  const raw=without(saved(),SUNK);for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k,c:p.c,d:3};if(k==='engine')keep.dir=[-1,0,0];for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}
  const ship=C.deserialize(raw),r=resolveAt(ship,source);assert.equal(r.ok,false,k);assert.equal(r.code,'placement-interference',k+': '+r.code);
 }
 // A saved interference over exterior equipment is re-checked on load and refused again, as saved, with
 // the current reason and message (the inspection bar's placement-background-failed row).
 const raw=saved();for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k:'sensor',c:p.c,d:3};for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}
 const check=(ship,label)=>{for(const id of SUNK){const p=ship.parts.find(q=>q.id===id);assert.equal(p._placementError,'placement-interference',label+' #'+id);assert.equal(p.placement.validationFailed,true,label);assert.equal(p.placement.repairRequired,true,label);assert.equal(p.placement.repairReason,'placement-interference',label);
  assert.match(C.placementFailureRecord(p)?.error||'',/干渉/,label+': the current reason is shown');assert.ok(C.placementDraftStatus(ship).failed.some(f=>f.id===id),label+': listed as a failed placement');}};
 const ship=C.deserialize(raw);check(ship,'load');
 // Refreshing again in the same session does not re-solve the refusal (only a fresh copy is re-checked).
 const again=C.refreshPlacementGeometry(ship);assert.ok(!SUNK.some(id=>again.resolvedParts.includes(id)),'warm refusal is not re-solved');check(ship,'refresh');
 check(C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship)))),'save/reload');
});

test('a legacy interior part outside the hull and its structures still clashes with a structure over it',()=>{
 const source=saved().parts.find(p=>p.id===100);
 for(const k of ['repulsor','gen']){
  const raw=without(saved(),[...SUNK,91,92,93,94,95]),q=raw.parts.find(p=>p.id===90);for(const key of Object.keys(q))delete q[key];Object.assign(q,{id:90,k,c:[87.66,14.58,-19.5],d:3});
  const ship=C.deserialize(raw),legacy=ship.parts.find(p=>p.id===90);assert.equal(legacy.placement,undefined);assert.equal(C.inHull(ship,legacy.c),false,k+': centre outside the hull');
  const r=resolveAt(ship,source);assert.equal(r.ok,false,k);assert.equal(r.code,'placement-interference',k+': '+r.code);
  // The same part moved inside the hull is interior equipment and is not a clash.
  legacy.c=[87.66,14.58,-12.3];ship._cache=null;assert.equal(C.inHull(ship,legacy.c),true);const ok=resolveAt(ship,source);assert.equal(ok.ok,true,k+' inside: '+ok.code);assert.equal(C.overlapParts(ok.part,legacy),true,k+' inside overlaps');
 }
});

test('an in-session refusal kept through an Undo/Redo patch is not re-solved',()=>{
 // History restore patches the editor's objects (patchShip); the Worker ship is patched the same way.
 const raw=saved();for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k:'sensor',c:p.c,d:3};for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}
 const ship=C.deserialize(raw),record=ship.parts.find(p=>p.id===100)._placementFailure,state=JSON.parse(C.publicJSON(ship));
 C.patchShip(ship,state);const r=C.refreshPlacementGeometry(ship);assert.ok(!SUNK.some(id=>r.resolvedParts.includes(id)),'not re-solved after a patch');
 const p=ship.parts.find(q=>q.id===100);assert.equal(p._placementFailure,record,'the in-session failure record is kept');assert.equal(p.placement.validationFailed,true);
});

// 2026-11-13 user decision: no fitting. Volumes are compared to 7 significant digits (was 3 decimals): a structure's
// solid built before a structure-carving ship cut existed (live) and after it (reload) differ only by Float32 rounding of
// the world base (18511.721 vs 18511.720 m³, 5e-8 relative).
function look(ship){const S=grounding(ship);return SUNK.map(id=>{const p=ship.parts.find(q=>q.id===id),d=S.placementDiagnostics.find(x=>x.partId===id);return {id,error:p._placementError||null,failed:!!p.placement.validationFailed,connected:d.connected,code:d.code,red:S.ungrounded.parts.includes(id),severed:S.severed.includes(id),volume:C.partVolume(p)};});}
// Physics review 2026-11-13: the volume is compared with a relative tolerance, not by rounding. A solid built while a
// structure-carving cut exists is made from Float32 world triangles, one built without it from Float64 local ones, so
// the live and reloaded volumes may differ in the last digits (history dependent; ~|c|/size × 1.2e-7).
function sameLook(a,b,msg){assert.equal(a.length,b.length,msg);a.forEach((x,i)=>{const y=b[i];assert.ok(Math.abs(x.volume-y.volume)<=1e-6*Math.max(1,Math.abs(x.volume)),`${msg}: volume ${x.volume} vs ${y.volume}`);assert.deepEqual({...x,volume:0},{...y,volume:0},msg);});}
test('cuts through a recovered structure follow the cut rules, live = reload',()=>{
 // (a) a ship-level cut (all structures) through the middle of both structures: still touching, connected.
 {const ship=C.deserialize(saved());ship.solidCuts=[...(ship.solidCuts||[]),{id:ship.nextId++,shape:'box',c:[87.66,14.6,0],s:[10,40,60],rotation:[0,0,0],mirror:false,structures:true}];ship._cache=null;
  const r=C.refreshPlacementGeometry(ship);assert.equal(r.ok,true,JSON.stringify(r.failed));const live=look(ship);
  for(const row of live){assert.equal(row.error,null);assert.equal(row.connected,true,JSON.stringify(row));assert.equal(row.red,false);assert.equal(row.severed,false);}
  sameLook(look(reload(ship)),live,'ship-level cut: reload');closeStats(statsOf(reload(ship)),statsOf(ship),'ship-level cut');}
 // (b) a hull-only cut removing the hull except a 0.4 m slab at the centreline: the structures no longer touch
 // the cut hull. 2026-11-13 user decision (no parent relation, no severed category): they are judged by contact
 // alone, red, kept where they are (no re-solve), exactly like the never-refused structures 58/59 on the same hull.
 // Note: groundingStats then marks every one of these structures red (50/51/58/59 too), which is the same on
 // main b40b72d for 50/51/58/59; the recovered structures only have to behave like the others.
 {const ship=C.deserialize(saved()),hull=ship.parts[0],before=SUNK.map(id=>ship.parts.find(p=>p.id===id).c.slice());
  for(const z of [-25.2,25.2])C.hullOwnSolidCut(ship,hull,{id:ship.nextId++,shape:'box',c:[100,16,z],s:[260,60,50],rotation:[0,0,0],mirror:false,structures:false});ship._cache=null;
  const r=C.refreshPlacementGeometry(ship),failedIds=r.failed.map(x=>x.partId);
  for(const id of [...SUNK,58,59])assert.ok(failedIds.includes(id),'#'+id+' red by contact after the cut: '+JSON.stringify(r.failed));
  assert.ok(!(r.severed||[]).length,'no severed category');
  const live=look(ship),S=grounding(ship),ref=[58,59].map(id=>({red:S.ungrounded.parts.includes(id),severed:S.severed.includes(id)}));
  for(const row of live){assert.equal(row.failed,false);assert.equal(row.error,'contact-zero');assert.deepEqual({red:row.red,severed:row.severed},ref[0],'same as the never-refused structure 58: '+JSON.stringify(row));}
  SUNK.forEach((id,i)=>assert.deepEqual(ship.parts.find(p=>p.id===id).c,before[i],'not moved'));
  sameLook(look(reload(ship)),live,'hull cut: reload');}
});

test('a placed horizontal structure keeps an edited roll through save and two reloads (same mass)',()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'roll');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const raw=C.rayPart([95,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)},c=[hit.p[0],hit.p[1]+1.8,hit.p[2]];
 const d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',c,s:[16,8,6],yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 ship.parts.push(d.part);ship.nextId++;assert.equal(C.refreshPlacementGeometry(ship).ok,true);const box=ship.parts.at(-1);
 // The 左右の傾き control edits roll in place; the warm re-solve keeps it (keepTransform).
 box.roll=-8;ship._cache=null;assert.equal(C.refreshPlacementGeometry(ship).ok,true);assert.equal(box.roll,-8);const live=statsOf(ship),c0=box.c.slice();
 let s=ship;for(const label of ['reload','reload 2']){s=reload(s);const b=s.parts.find(p=>p.id===box.id);assert.equal(b.roll,-8,label+': roll kept (main b40b72d reset it to 0)');b.c.forEach((v,i)=>assert.ok(Math.abs(v-c0[i])<1e-9,label+': pose '+b.c));assert.equal(b._placementError,undefined);closeStats(statsOf(s),live,label);}
});

// A refused structure solved again because its parent (or shape) changed goes through the pending path, but it is
// not a new placement: it keeps its authored pose (independent check 2026-11-12: roll -8/+8 came back as 0).
// Both on load (stale parent key) and in a session (one update removes the sensors and widens the hull), with and
// without parentPoseKey (saves from before 2026-11-11).
const sensorsOf=o=>{for(const p of o.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k:'sensor',c:p.c,d:3};for(const k of Object.keys(p))delete p[k];Object.assign(p,keep);}return o;};
const poseOf=(s,id)=>{const p=s.parts.find(q=>q.id===id);return {c:p.c.slice(),roll:p.roll||0,pitch:p.pitch||0,yaw:p.yaw||0};};
for(const withPoseKey of [false,true])test(`a refused structure re-solved after its parent changed keeps its pose (parentPoseKey ${withPoseKey?'present':'absent'})`,()=>{
 const want=Object.fromEntries(SUNK.map(id=>[id,poseOf(saved(),id)])),check=(s,step)=>{for(const id of SUNK){const now=poseOf(s,id),w=want[id];
  assert.equal(s.parts.find(p=>p.id===id)._placementError,undefined,`${step} #${id} recovered`);
  for(let i=0;i<3;i++)assert.ok(Math.abs(now.c[i]-w.c[i])<=1e-6,`${step} #${id} position[${i}] ${now.c[i]} vs ${w.c[i]}`);
  for(const k of ['roll','pitch','yaw'])assert.ok(Math.abs(now[k]-w[k])<=1e-9,`${step} #${id} ${k} ${now[k]} vs ${w[k]}`);}};
 let o=saved();for(const p of o.parts)if(SUNK.includes(p.id)){p.placement.parentGeometryKey='stale';if(withPoseKey)p.placement.parentPoseKey='saved';else delete p.placement.parentPoseKey;}
 check(C.deserialize(o),'load with a stale parent key');
 o=sensorsOf(saved());for(const p of o.parts)if(SUNK.includes(p.id)){if(withPoseKey)p.placement.parentPoseKey='saved';else delete p.placement.parentPoseKey;}
 const s=C.deserialize(o);for(const id of SUNK)assert.equal(s.parts.find(p=>p.id===id).placement.validationFailed,true,'refused while the sensors clash');
 s.parts=s.parts.filter(p=>!LEGACY.includes(p.id));const hull=s.parts.find(p=>p.id===1);C.setHullStructureDimensions(s,hull,[hull.s[0],hull.s[1]+1,hull.s[2]]);s._cache=null;C.refreshPlacementGeometry(s);
 check(s,'sensors removed and hull widened in one update');
});

// Whether legacy equipment (no placement record) counts as interior depends on the other structures: a structure
// added around a legacy repulsor makes it interior equipment, and the structure refused over it recovers in the
// same ship, as on a reload (independent check 2026-11-12).
test('a structure refused over legacy equipment recovers in the same ship when a structure encloses that equipment',()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'enclosed legacy equipment');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const ray=C.rayPart([95,500,0],[0,-1,0],hull),hit={p:ray.p,n:C.norm(ray.n)},deck=hit.p[1];
 ship.parts.push({...JSON.parse(JSON.stringify(saved().parts.find(p=>p.id===90))),id:ship.nextId++,c:[95,deck+3,0]});
 const c=[95,deck+2,0],d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',c,s:[16,8,6],yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);const S=ship.nextId++;C.refreshPlacementGeometry(ship);
 const part=s=>s.parts.find(q=>q.id===S);assert.equal(part(ship)._placementError,'placement-interference','refused over the legacy repulsor outside the interior');
 ship.parts.push({id:ship.nextId++,k:'struct',form:'box',c:[95,deck+3,0],s:[30,10,30],yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0});ship._cache=null;C.refreshPlacementGeometry(ship);
 assert.equal(part(ship)._placementError,undefined,'same ship: recovered');assert.equal(part(reload(ship))._placementError,undefined,'reload agrees');
});

// A draft refused on its first solve has never been placed: when it is solved again (its shape or its parent
// changed, the clashing sensor removed) it is seated on the surface like any new placement (newPlacement), not
// kept at its preview pose (independent check 2026-11-12, round 3).
for(const variant of ['shape edited','parent resized'])test(`a draft refused on its first solve is seated when solved again (${variant})`,()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'refused draft');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const ray=C.rayPart([95,500,4],[0,-1,0],hull),hit={p:ray.p,n:C.norm(ray.n)};
 const lowest=p=>{const T=C.structTriangles(p);let low=Infinity;for(let i=0;i<T.length;i+=3)low=Math.min(low,(T[i]-hit.p[0])*hit.n[0]+(T[i+1]-hit.p[1])*hit.n[1]+(T[i+2]-hit.p[2])*hit.n[2]);return low;};
 const sensor={id:ship.nextId++,k:'sensor',c:hit.p.map((v,i)=>v+hit.n[i]*3),d:3};ship.parts.push(sensor);
 const c=[hit.p[0],hit.p[1]+2,hit.p[2]],d=C.preparePlacementDraft(ship,{id:ship.nextId++,k:'struct',form:'box',c,s:[16,8,6],yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0},{mode:'surface',parentStructureId:hull.id,hostId:hull.id,hit,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);assert.equal(d.part.placement.newPlacement,true,'a draft is marked as a new placement');ship.parts.push(d.part);C.refreshPlacementGeometry(ship);
 const part=()=>ship.parts.find(p=>p.id===d.part.id);assert.equal(part()._placementError,'placement-interference','refused on its first solve');
 ship.parts=ship.parts.filter(p=>p.id!==sensor.id);if(variant==='shape edited')part().s=[16,8,5];else C.setHullStructureDimensions(ship,hull,[200,36,32]);ship._cache=null;C.refreshPlacementGeometry(ship);
 assert.equal(part()._placementError,undefined,'placed once the sensor is gone');assert.equal(part().placement.newPlacement,undefined,'no longer a new placement');
 assert.ok(lowest(part())>-.2,`seated on the surface, not left 1 m deep (lowest point along the normal ${lowest(part())})`);
});

// A ship-level cut that carves structures (全体に適用: ship.solidCuts only) changes the parent's surface, so it is part
// of the refusal key: removing it re-checks the refused structure in the same ship, as a reload does (round 3).
test('removing a ship-level cut re-checks a structure it refused, in the same ship as on a reload',()=>{
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'ship-level cut');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts[0];
 const ray=C.rayPart([95,500,0],[0,-1,0],hull),hit={p:ray.p,n:C.norm(ray.n)},deck=hit.p[1];
 ship.parts.push({...JSON.parse(JSON.stringify(saved().parts.find(p=>p.id===90))),id:ship.nextId++,c:[95,deck-3,0]});
 ship.solidCuts=[C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[95,deck-3,0],s:[6,3,6],rotation:[0,0,0],mirror:false,structures:true})];ship._cache=null;
 const c=[95,deck-1,0],d=C.preparePlacementDraft(ship,{id:ship.nextId,k:'struct',form:'box',c,s:[16,8,6],yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0},{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit,contactFit:'cut',position:c,placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);const S=ship.nextId++,part=s=>s.parts.find(q=>q.id===S);C.refreshPlacementGeometry(ship);
 assert.ok(part(ship)._placementError,'refused while the cut is there');
 ship.solidCuts=[];ship._cache=null;C.refreshPlacementGeometry(ship);
 assert.equal(part(ship)._placementError,undefined,'same ship: recovered');assert.equal(part(reload(ship))._placementError,undefined,'reload agrees');
});
