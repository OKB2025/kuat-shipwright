// User report 2026-11-27「接触バグが再発生」(tests/fixtures/hull-sections-contact-2026-11-27.json.gz, the user's design): three hull-form
// structures (6 432 and 12 864 triangles) set into a box hull were refused with geometry-complex at every placement — the exact solid check takes
// 4 000 faces — and the refusal stayed on load (it is dropped only when that check passes), so they were shown not grounded while they overlap
// the hull. A hull-form structure's solid is made by the hull builder and closed by construction; it is not refused for its face count alone.
const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const saved=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/hull-sections-contact-2026-11-27.json.gz'))).toString('utf8'));
const ungrounded=S=>S.warnings.some(w=>w.code==='ungrounded');
test('the design as saved, with the refusals the earlier placement wrote, loads with every structure grounded',()=>{
 const raw=saved();assert.deepEqual(raw.parts.filter(p=>p.placement?.repairReason==='geometry-complex').map(p=>p.id),[2,5,6],'fixture: the refusals are in the file');
 const s=C.deserialize(raw),S=C.computeStats(s);assert.deepEqual(s.parts.map(p=>p._placementError||null),[null,null,null,null]);assert.ok(!ungrounded(S),S.warnings.map(w=>w.text).join(' / '));
 assert.ok(s.parts.every(p=>!p.placement?.repairRequired),'the saved refusal is dropped');
});
test('placing a hull-form structure of more faces than the exact check takes succeeds',()=>{
 const raw=saved();for(const p of raw.parts)if(p.placement){delete p.placement.repairRequired;delete p.placement.repairReason;}const s=C.deserialize(raw);
 for(const id of [2,5]){const p=s.parts.find(q=>q.id===id);assert.ok(C.structTriangles(p).length/9>4000,'fixture: over the check');const r=C.solvePlacement(s,{...JSON.parse(C.publicJSON(p)),placement:p.placement},{...p.placement});assert.equal(r.ok,true,id+': '+(r.code||'')+' '+(r.error||''));}
});
// Reference-fidelity review 2026-11-27: not refusing a hull-form structure for its face count does not make a floating one grounded.
test('the same hull-form structure moved clear of the hull is still shown floating',()=>{
 const raw=saved();for(const p of raw.parts)if(p.placement){delete p.placement.repairRequired;delete p.placement.repairReason;}
 const q=raw.parts.find(p=>p.id===2);q.c=[q.c[0],-600,q.c[2]];if(q.placement?.requestedGeometry)q.placement.requestedGeometry.c=q.c.slice();
 const s=C.deserialize(raw),S=C.computeStats(s);assert.ok(S.warnings.some(w=>w.code==='ungrounded'),'floating structure reported: '+S.warnings.map(w=>w.text).join(' / '));
});
