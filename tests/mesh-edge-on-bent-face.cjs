// User report 2026-11-14: in vertex editing, adding an edge was refused on any face that was no longer flat ("平面の面に
// だけ辺を追加できます"), which is where a user most needs one (to choose the fold of a face whose vertices were moved).
// An edge can now be added across a bent face: the mesh stays closed and free of crossings; the outer shape may change.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const cube=()=>({v:[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,.5,.5],[-.5,.5,.5]],f:[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]});
test('a flat face still takes an edge and keeps the shape',()=>{
 const m=cube();assert.equal(C.meshEditCheck(m),'');const r=C.meshAddEdge(m,4,6);assert.ok(r.mesh,r.error);assert.equal(r.mesh.f.length,7);assert.ok(Math.abs(C.meshLocalVolume(r.mesh.v,r.mesh.f)-C.meshLocalVolume(m.v,m.f))<1e-12);
});
test('a bent face (one corner raised) takes an edge along either diagonal; the mesh stays closed and valid',()=>{
 for(const [a,b] of [[4,6],[7,5]]){const m=cube();m.v[6]=[.5,.8,.5];/* the top face 4-7-6-5 is no longer flat */assert.equal(C.meshFacePlanar?C.meshFacePlanar(m,m.f[1]):false,false);
  const r=C.meshAddEdge(m,a,b);assert.ok(r.mesh,`${a}-${b}: ${r.error}`);assert.equal(r.mesh.f.length,7);assert.equal(C.meshTopology(r.mesh.f).closed,true);assert.equal(C.meshEditCheck(r.mesh),'');assert.ok(C.meshLocalVolume(r.mesh.v,r.mesh.f)>0);}
 const m=cube();m.v[6]=[.5,.8,.5];const fold=C.meshLocalVolume(C.meshAddEdge(m,4,6).mesh.v,C.meshAddEdge(m,4,6).mesh.f),valley=C.meshLocalVolume(C.meshAddEdge(m,7,5).mesh.v,C.meshAddEdge(m,7,5).mesh.f);assert.ok(Math.abs(fold-valley)>1e-6,'the two diagonals are different shapes: the user chooses the fold');
});
test('refusals that protect the mesh stay: joined vertices, different faces',()=>{
 const m=cube();m.v[6]=[.5,.8,.5];assert.match(C.meshAddEdge(m,4,5).error,/すでに辺/);assert.match(C.meshAddEdge(m,0,6).error,/同じ面/);
});
