// Interior compartments and engine foundations are recomputed only where an edited structure reaches
// (user request 2026-11-12: a structure move re-clips the rooms that its old or new bounds touch, not
// every room on the ship). The result must equal a full recompute: after each edit in a series, the
// incrementally updated design is compared with the same public design loaded fresh, the way the
// Worker loads a reset (refreshPlacementGeometry, syncCompartments, remount, syncCompartments).
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const {userFixture}=require('./helpers/edit-latency-fixtures.cjs');

function derive(s){C.refreshPlacementGeometry(s);C.syncCompartments(s);C.remount(s);C.syncCompartments(s);return s;}
function fresh(s){return derive(JSON.parse(C.publicJSON(s)));}
const digest=t=>{if(!t)return null;let h=0;for(let i=0;i<t.length;i++)h=(h*31+Math.round(t[i]*1e6))%2147483647;return [t.length,h];};
function snapshot(s,shapeVolume=true){
 return s.parts.map(p=>({id:p.id,k:p.k,volume:shapeVolume||!C.isShapePart(p)?C.partVolume(p):null,clip:p._clip?[p._clip.volume,p._clip.retained,digest(p._clip.tris)]:null,
  packing:p._packing?[p._packing.volume,JSON.stringify(p._packing.boxes)]:null,interiorError:p._interiorPlacementError?.code||null,
  seatOutside:p._seatOutside??null,group:p._packingGroup?p._packingGroup.ids.join(','):null,
  support:p.engineMountSupport?C.publicJSON(p.engineMountSupport):null,supportError:p._engineMountSupportError||null,
  placementError:p._placementError||null}));
}
const statsJSON=s=>JSON.stringify(C.computeStats(s),(k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v);
// A cold load re-solves placed structures from their requests; that solve can differ from the stored
// pose in the last bit of a contact normal (also on main, without any incremental cache). Public
// state is compared to 1e-9; derived interiors and statistics exactly.
function close(a,b,where){
 if(typeof a==='number'&&typeof b==='number'){assert.ok(a===b||Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)),where+': '+a+' != '+b);return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort(),where);for(const k of Object.keys(a))close(a[k],b[k],where+'.'+k);return;}
 assert.equal(a,b,where);
}
function same(live,label,{stats=true,shapeVolume=true}={}){
 const cold=fresh(live);
 close(JSON.parse(C.publicJSON(live)),JSON.parse(C.publicJSON(cold)),label+': public state');
 assert.deepEqual(snapshot(live,shapeVolume),snapshot(cold,shapeVolume),label+': derived interior and foundations');
 if(stats)assert.equal(statsJSON(live),statsJSON(cold),label+': statistics equal a fresh load');
}

// The user-style design plus probes the edits reach: rooms straddling the deck (legacy and explicit
// clip), a movable box structure on the deck, and two engines without a foundation.
function design(){
 const s=userFixture(C,{interior:16,structures:2});
 const add=p=>{p.id=s.nextId++;s.parts.push(p);return p;};
 const mover=add({k:'struct',form:'box',c:[215,66,0],s:[24,10,16],taper:0,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0});
 const legacyNear=add({k:'cargo',c:[250,70,0],d:8}),legacyFar=add({k:'cargo',c:[120,70,-6],d:6});
 // The explicit room stays valid throughout (partly inside the hull): a refused re-solve keeps its last
 // valid clipped body by rule (tests/clipped-hangar-hatch.cjs), which a fresh load cannot reproduce.
 const explicit=add({k:'fuel',c:[238,62,10],d:6});explicit.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'clip',geometryRevision:1,hostId:1,requestedGeometry:JSON.parse(C.publicJSON(explicit))};
 for(const [y,z] of [[74,30],[80,-30]])add({k:'engine',c:[260,y,z],d:6,dir:[-1,0,0]});
 return {s:derive(s),mover:mover.id,legacyNear:legacyNear.id,legacyFar:legacyFar.id,explicit:explicit.id};
}

test('a series of structure edits gives the same interior, foundations and statistics as a full recompute',()=>{
 const {s,mover,legacyNear,legacyFar,explicit}=design(),part=id=>s.parts.find(p=>p.id===id);
 same(s,'initial');
 const far=part(legacyFar),farClip=far._clip,clipped=s.parts.filter(p=>p._clip&&p.id!==legacyNear&&p.id!==explicit);
 assert.ok(farClip,'precondition: the far room is clipped by the hull');
 // 1. A move that stays clear of every probe room.
 const solvedKeys=new Map(s.parts.filter(p=>p._explicitInteriorKey&&p.id!==explicit).map(p=>[p.id,p._explicitInteriorKey]));assert.ok(solvedKeys.size>=10);
 part(mover).c=[222,66,0];derive(s);same(s,'move clear');
 assert.equal(far._clip,farClip,'a room the structure never reaches is not re-clipped');
 for(const p of clipped)assert.equal(p._clipKey!=null,true);
 for(const [id,key] of solvedKeys)assert.equal(part(id)._explicitInteriorKey,key,'explicit room #'+id+' is not re-solved');
 // 2. Into the straddling rooms: the new bounds reach them.
 const nearBefore=part(legacyNear)._clip;
 const explicitKey=part(explicit)._explicitInteriorKey;
 part(mover).c=[244,66,4];derive(s);same(s,'move onto rooms');
 assert.notEqual(part(explicit)._explicitInteriorKey,explicitKey,'an explicit room the new bounds touch is re-solved');
 assert.equal(part(explicit)._interiorPlacementError,undefined,'the explicit probe stays valid');
 assert.notEqual(part(legacyNear)._clip,nearBefore,'a room the new bounds touch is re-clipped');
 // 3. Away again: the old bounds release them.
 const nearInside=part(legacyNear)._clip;
 part(mover).c=[280,66,0];derive(s);same(s,'move away');
 assert.equal(part(explicit)._explicitInteriorKey,explicitKey,'released by the old bounds, the explicit room is re-solved to its first key');
 assert.equal(part(explicit)._interiorPlacementError,undefined);
 assert.notEqual(part(legacyNear)._clip,nearInside,'a room the old bounds touched is re-clipped');
 assert.equal(far._clip,farClip);
 // 4. Resize, 5. a new structure over the far room, 6. delete it, 7. a ship-level cut (global).
 part(mover).s=[30,12,18];derive(s);same(s,'resize');
 s.parts.push({id:s.nextId++,k:'struct',form:'box',c:[120,72,-6],s:[12,8,12],taper:0,yaw:0,pitch:0,roll:0,offsetX:0,offsetZ:0});derive(s);same(s,'add structure');
 assert.notEqual(far._clip,farClip,'a structure added over a room re-clips it');
 s.parts.pop();derive(s);same(s,'delete structure');
 // A ship-level cut changes every key. After any solid cut a deck structure's own volume differs by
 // 2e-4 m³ between the live design and a reload (1760.00000000006 against 1759.9998 on main b40b72d
 // too, without this change), so this step compares the interior, not structure volumes or totals.
 s.solidCuts.push(C.normalizeSolidCut({id:s.nextId++,shape:'box',c:[60,72,0],s:[6,6,6],structures:true}));delete s._cache;derive(s);same(s,'ship cut',{stats:false,shapeVolume:false});
});

test('an Imperial-style example keeps its engine foundations and rooms equal to a full recompute after moves',()=>{
 const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/acclamator/design.json.gz'))));
 const s=derive(C.deserialize(raw)),structs=s.parts.filter(p=>C.isShapePart(p)&&!C.isHullStructure(p));
 const supported=s.parts.filter(p=>p.k==='engine'&&p.engineMountSupport);assert.ok(supported.length,'precondition: foundations exist');
 const kept=new Map(supported.map(p=>[p.id,p.engineMountSupport]));
 // The structure farthest from every engine moves: no foundation is recast.
 const engines=s.parts.filter(p=>p.k==='engine'),distance=q=>Math.min(...engines.map(e=>Math.hypot(...[0,1,2].map(i=>q.c[i]-e.c[i]))));
 const target=structs.slice().sort((a,b)=>distance(b)-distance(a))[0];
 target.c=[target.c[0]+3,target.c[1],target.c[2]];derive(s);same(s,'far structure move',{stats:false});
 for(const p of supported)assert.equal(p.engineMountSupport,kept.get(p.id),'foundation #'+p.id+' is kept');
 // The structure carrying a foundation moves: that foundation is rebuilt.
 const carrier=s.parts.find(q=>q.id===supported[0].engineMountSupport.parentId);
 if(carrier&&!C.isHullStructure(carrier)){carrier.c=[carrier.c[0],carrier.c[1]-.5,carrier.c[2]];derive(s);same(s,'carrier move',{stats:false});}
});
