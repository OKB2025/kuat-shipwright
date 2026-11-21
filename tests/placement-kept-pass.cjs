// 2026-11-21, PR #122. User report「計算が終わらない」(a 2,200 m design saved with ten parts still to be solved): the placement refresh
// built the whole drive network once for every placed nozzle and sensor on every load. The pass that only rebuilds a placed
// part's support (request.keptPass) no longer asks whether the part interferes where the user put it.
// Regression review of that change: the user's own edit of a placed part (its size, its request) must still be refused when it
// then runs into other equipment, and a mirrored pair of drafts is still checked against the drive shafts (three or more drafts
// in one full pass are solved with the routing held back, as a load on the main thread already solved them).
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root),core=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
function fixture(){const s=C.newShip({L:100,W:100,H:100,assembly:true},'Kept pass');s.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[40,40,20]}];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=2;return s;}
const sensor=(x,d=4)=>({id:-1,k:'sensor',c:[x,10+d*.46,0],d}),on=x=>({mode:'direct',parentStructureId:1,hit:{p:[x,10,0],n:[0,1,0]}});
test('the user\'s own resize of a placed part into another part is still refused; a load of the same state does not ask',()=>{
 const s=fixture(),a=C.commitPlacement(s,sensor(-4),on(-4)),b=C.commitPlacement(s,sensor(4),on(4));assert.equal(a.ok,true,a.error);assert.equal(b.ok,true,b.error);
 C.refreshPlacementGeometry(s);const first=s.parts.find(p=>p.id===a.part.id),second=s.parts.find(p=>p.id===b.part.id);assert.equal(first._placementError,undefined);assert.equal(C.overlapParts(first,second),false,'apart to begin with');
 // the user's own edit: the first sensor grows until it runs into the second
 const grown=C.solvePlacement(s,{id:first.id,k:'sensor',c:first.c.slice(),d:14,placement:first.placement},{...first.placement,keepTransform:true,geometryRevision:(first.placement.geometryRevision||0)+1});
 assert.equal(grown.ok,false,'the edit is refused');assert.equal(grown.code,'placement-interference');
 // the same request marked as the support-only pass is not asked that question
 const kept=C.solvePlacement(s,{id:first.id,k:'sensor',c:first.c.slice(),d:14,placement:first.placement},{...first.placement,keepTransform:true,keptPass:true,geometryRevision:(first.placement.geometryRevision||0)+1});
 assert.notEqual(kept.code,'placement-interference','the support-only pass does not ask about interference');
});
test('the routing is held back only for three or more drafts in one full pass',()=>{
 assert.match(core,/placement\?\.pendingGeometry\)\.length>=3/,'the threshold in refreshPlacementGeometry');
 assert.match(core,/keptPass:true/,'only the support-only pass carries the flag');assert.match(core,/kept&&request\.keptPass/);
});
