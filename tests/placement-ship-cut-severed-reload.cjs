// A structure whose support was removed by a ship-level solid cut is a 'severed' warning after a reload too, not
// a red failure (known bug, handoff 2026-11-12 §6). In the session the child was severed; a reload re-solves a
// cut-fit (horizontal) child, whose fit could not be rebuilt over the removed material (contact-shape), and that
// code was not judged at the stored pose, so the child turned red (ungrounded). The pose is kept either way.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const same=(a,b,m)=>assert.equal(JSON.stringify(a),JSON.stringify(b),m);
function build(mode){
 const ship=C.newShip({L:200,W:32,H:32,plan:'cigar',sec:'ellipse'},'new');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts.find(p=>C.isShapePart(p));
 const raw=C.rayPart([110,500,0],[0,-1,0],hull),hit={p:raw.p,n:C.norm(raw.n)};
 let part={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+1.8,hit.p[2]],s:[16,8,6],yaw:0,pitch:0,offsetX:0,offsetZ:0};if(mode==='surface')part=C.alignStructure(part,hit,'surface');
 const d=C.preparePlacementDraft(ship,part,{mode,parentStructureId:hull.id,hostId:hull.id,hit,...(mode==='surface'?{}:{contactFit:'cut',position:part.c.slice()}),placementModelVersion:C.PLACEMENT_MODEL_VERSION,geometryRevision:1});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;assert.equal(C.refreshPlacementGeometry(ship).ok,true);return {ship,box:ship.parts.at(-1)};
}
for(const mode of ['horizontal','surface'])test(`${mode}: a ship-level cut under the structure is severed in the session and after a reload, unmoved`,()=>{
 const {ship,box}=build(mode),pose=JSON.stringify(['c','s','yaw','pitch','roll'].map(k=>box[k]));
 ship.solidCuts=[{shape:'box',c:[110,30,0],s:[40,12,40],rotation:[0,0,0],mirror:false,structures:false,id:ship.nextId++}];ship._cache=null;C.refreshPlacementGeometry(ship);
 const check=(s,label)=>{const b=s.parts.find(p=>p.id===box.id),S={warnings:[]};C.groundingStats(s,S);
  assert.equal(b._placementError,undefined,label+': '+b._placementError);same(S.ungrounded.parts,[],label+': no red frame');same(S.severed,[box.id],label+': severed warning');
  assert.equal(JSON.stringify(['c','s','yaw','pitch','roll'].map(k=>b[k])),pose,label+': not moved');};
 check(ship,'session');
 const L=C.deserialize(JSON.parse(C.publicJSON(C.serialize(ship))));const r=C.refreshPlacementGeometry(L);assert.equal(r.ok,true,JSON.stringify(r.failed));check(L,'reload');
});
