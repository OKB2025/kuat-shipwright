// Horizontal placement onto a new design's own hull (the primary hull structure) at deck positions where
// the contact cells meet a hull seam. A boundary segment there carries interior seam pairs (same height,
// opposite direction) next to the real boundary; each pair is now removed on its own instead of refusing the
// whole segment as 'contact-ambiguous', which left a correctly seated structure ungrounded.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')));
const vol=T=>{let v=0;for(let i=0;i<T.length;i+=9)v+=(T[i]*(T[i+4]*T[i+8]-T[i+5]*T[i+7])-T[i+1]*(T[i+3]*T[i+8]-T[i+5]*T[i+6])+T[i+2]*(T[i+3]*T[i+7]-T[i+4]*T[i+6]))/6;return v;};
function seat(x,z,size=[20,16,8]){
 const ship=C.newShip({L:300,W:60,H:40},'hull seam');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts.find(p=>C.isShapePart(p));
 const hit=C.rayPart([x,500,z],[0,-1,0],hull);assert.ok(hit,'the deck is tapped');const n=C.norm(hit.n);
 const pv={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+size[2]*.3,hit.p[2]],s:size.slice()};
 const d=C.preparePlacementDraft(ship,pv,{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit:{p:hit.p,n},contactFit:'cut',position:pv.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION});
 assert.equal(d.ok,true,d.error);ship.parts.push(d.part);ship.nextId++;C.refreshPlacementGeometry(ship);
 return {ship,part:ship.parts.at(-1)};
}
for(const [x,z] of [[60,0],[60,10],[150,10],[250,0]])test(`a structure seated on the hull deck at x ${x}, z ${z} is placed and grounded`,()=>{
 const {ship,part}=seat(x,z);assert.equal(part._placementError||null,null);assert.ok(!part.placement.validationFailed);
 const st={warnings:[]};C.groundingStats(ship,st);assert.deepEqual(Array.from(st.ungrounded?.parts||[]),[]);
 const v=vol(C.structTriangles(part));assert.ok(v>0&&v<=20*16*8+1e-6,`volume ${v} stays within the authored box`);
});
test('the mirrored seam positions give the same fitted volume',()=>{
 const a=vol(C.structTriangles(seat(150,10).part)),b=vol(C.structTriangles(seat(150,-10).part));assert.ok(Math.abs(a-b)<1e-6*Math.max(1,a),`${a} != ${b}`);
});
// 2026-11-13 user decision: no fitting; the user's own seat brings a horizontal structure down until its whole base
// reaches the body. A draft lifted 26 m off the deck is therefore seated (until then it was refused). A real gap is
// still refused when it arises without a user seat: the deck moved away afterwards.
test('a lifted draft is seated on the deck; a gap made afterwards (the deck lowered) is refused in place',()=>{
 const ship=C.newShip({L:300,W:60,H:40},'gap');ship.fits=[];C.ensurePrimaryHull(ship);const hull=ship.parts.find(p=>C.isShapePart(p)),hit=C.rayPart([60,500,0],[0,-1,0],hull);
 const pv={id:ship.nextId,k:'struct',form:'box',c:[hit.p[0],hit.p[1]+30,hit.p[2]],s:[20,16,8]};
 const d=C.preparePlacementDraft(ship,pv,{mode:'horizontal',parentStructureId:hull.id,hostId:hull.id,hit:{p:hit.p,n:C.norm(hit.n)},contactFit:'cut',position:pv.c.slice(),placementModelVersion:C.PLACEMENT_MODEL_VERSION});
 ship.parts.push(d.part);ship.nextId++;C.refreshPlacementGeometry(ship);const part=ship.parts.at(-1);let st={warnings:[]};C.groundingStats(ship,st);
 assert.equal(part._placementError,undefined);assert.ok(!(st.ungrounded?.parts||[]).includes(part.id),'seated on the deck');assert.ok(C.partAABB(part)[1]<=hit.p[1]+1e-6,'its base reaches the deck');
 const c=Array.from(part.c);hull.c=[hull.c[0],hull.c[1]-20,hull.c[2]];C.refreshPlacementGeometry(ship);st={warnings:[]};C.groundingStats(ship,st);
 assert.deepEqual(Array.from(part.c),c,'not moved');assert.ok(part._placementError||(st.ungrounded?.parts||[]).includes(part.id),'the 20 m gap made afterwards is not accepted as contact');
});
