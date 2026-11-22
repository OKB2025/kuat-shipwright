const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} differs from ${b}`);
function fixture(explicit=false){
 const s=C.newShip({L:100,W:100,H:100,assembly:true},'Pre-clipping hatch source');Object.assign(s,{parts:[{id:1,k:'struct',form:explicit?'box':'ellipsoid',c:[0,0,0],s:explicit?[16,20,10]:[20,20,20]}],fits:[],hatches:[],links:[],groups:[],nextId:3,detail:0,autoHabitation:false});
 let p=explicit?{id:2,k:'hangar',c:[0,0,0],d:Math.cbrt(4000),room:[20,20,10]}:{id:2,k:'hangar',c:[-7,-6,0],d:18,room:[22,14,18]};
 if(explicit){const r=C.solvePlacement(s,p,{mode:'clip',hostId:1});assert.equal(r.ok,true,r.error);p=r.part;}s.parts.push(p);C.syncCompartments(s);assert.ok(p._clip?.tris.length);return {s,p};
}
function source(p){return {...p,_clip:null,_packing:null,_envelope:null};}
function rendering(s,p){const g=G.meshParts({...s,_client:true},{}).g,mesh=s.hatches.some(h=>h.bay===p.id)?g.hangar:g.interior,points=[];for(let i=0;i<mesh.ni;i++)points.push(...mesh.pos.slice(mesh.idx[i]*3,mesh.idx[i]*3+3));return points;}
function confirmShape(s,p,volume,requested){
 near(C.partVolume(p),volume);near(C.hangarCapacity(p),volume/C.AVIATION_SIZE_VOLUME);const authored=source(p);delete authored.aviationSurfaces;assert.equal(C.publicJSON(authored),requested);assert.ok(p._clip?.tris.length);assert.equal(p._interiorPlacementError,undefined);
 const outside=p.placement?[-9,0,0]:[-17,-6,0];assert.equal(C.inPart(p,outside),false,'the original request must not replace the clipped solid');assert.equal(C.inPart(source(p),outside),true);
 const render=rendering(s,p);assert.ok(render.length>0);for(let i=0;i<render.length;i+=3)assert.ok(render[i]>=-10.00001&&render[i]<=10.00001,'renderer uses the real clipped bay');
}

test('a clipped curved bay keeps the hatch candidates of its pre-clipping source, including the missing forward opening',()=>{
 const {s,p}=fixture(),clip=p._clip,volume=C.partVolume(p),before=C.publicJSON(s),expected=C.aviationSurfaceContacts(s,source(p)),actual=C.aviationSurfaceContacts(s,p);
 /* 2026-11-21 (user decision「ハッチ化するなら重なることを条件にする。図るのは無くして。貫通してないのに装甲が無くされるのはおかしい話だ」): the bay's forward face stops short of the curved shell in front of it (the shell is 1 to 6 m ahead of the face where a ray along x meets it); until this date that skin was measured and opened anyway. Now there is no forward candidate; the faces whose skin the bay does pierce (aft, bottom, port, starboard) are candidates. *//* 2026-11-21, later (user decision「何も考えずに普通に区画と外壁が重なってる部分がハッチになる」): the opening is the skin inside the bay that faces the hatch's side; the curved shell inside this bay faces forward in part, so the forward face has an opening too (it had none under the earlier rule of the same day). */assert.equal(expected.find(q=>q.face==='fore').contact,true,'the forward-facing part of the shell inside the bay opens');assert.ok(expected.find(q=>q.face==='aft').contact,'the bay pierces the aft shell');assert.deepEqual(plain(actual),plain(expected),'effective mesh sampling must not remove or reshape original candidate faces');
 assert.equal(p._clip,clip);near(C.partVolume(p),volume);assert.equal(C.publicJSON(s),before,'candidate generation is read-only');
});

for(const explicit of [false,true])test(`${explicit?'explicit':'legacy'} clipping survives hatch creation, opening edits, removal and regeneration`,()=>{
 const {s,p}=fixture(explicit),volume=C.partVolume(p),requested=C.publicJSON(source(p)),face=explicit?'top':'aft'/* 2026-11-21: 'fore' before; that face no longer reaches the skin (see the first test) */;
 for(const kind of ['open','ray','none','open']){
  const h=C.setAviationSurfaceMode(s,p,face,kind);C.hullGeo(s);C.syncCompartments(s);
  // Hatch metadata is independent of the original room's geometry.
  const geom=source(p);delete geom.aviationSurfaces;const original=JSON.parse(requested);delete original.aviationSurfaces;
  confirmShape(s,p,volume,JSON.stringify(original));assert.deepEqual(JSON.parse(C.publicJSON(geom)),original);
  if(h){assert.ok(C.aviationHatchActive(s,h));assert.ok(C.hatchOpenArea(s,h)>0);h.motion='slide';for(const open of [0,1,.4]){h.open=open;C.syncCompartments(s);near(C.partVolume(p),volume);assert.ok(C.aviationHatchActive(s,h));}assert.equal(C.hatchOpenArea(s,h,0),0);}
 }
});

test('the original candidate and effective clipped body both survive saving and reloading',()=>{
 for(const explicit of [false,true]){
  const {s,p}=fixture(explicit),volume=C.partVolume(p),face=explicit?'top':'aft'/* 2026-11-21: 'fore' before (see the first test) */,geometry=plain({c:p.c,room:p.room,placement:p.placement});C.setAviationSurfaceMode(s,p,face,'ray');C.syncCompartments(s);
  const loaded=C.deserialize(C.serialize(s)),bay=loaded.parts.find(q=>q.id===p.id);C.syncCompartments(loaded);assert.deepEqual(plain({c:bay.c,room:bay.room,placement:bay.placement}),geometry);near(C.partVolume(bay),volume);assert.equal(bay._interiorPlacementError,undefined);
  assert.deepEqual(plain(C.aviationSurfaceContacts(loaded,bay)),plain(C.aviationSurfaceContacts(loaded,source(bay))));const h=loaded.hatches.find(h=>h.bay===p.id&&h.face===face);assert.ok(h&&C.aviationHatchActive(loaded,h));
 }
});

test('pre-clipping candidates still require the actual shell and do not open a remote roof',()=>{
 const {s,p}=fixture(true);p.c=[0,-30,0];assert.ok(C.aviationSurfaceContacts(s,p).every(q=>!q.contact),'an obsolete clip cache cannot attach the moved source to its old shell');
 p.c=[0,0,0];s.parts[0].c=[0,30,0];assert.ok(C.aviationSurfaceContacts(s,p).every(q=>!q.contact),'the original room does not drill into a separate remote structure');
});
