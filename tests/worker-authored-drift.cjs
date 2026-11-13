// Authored state is decided only when the user places or edits that item (user decision 2026-11-12,
// "必要のない処理は消すようにして"). The design engine must not rewrite it on its own. This test runs the real
// Worker update path on small designs, applies one user edit, and lists every authored field the Worker
// changed (Core.authoredStateDrift). The list must equal ALLOWED below: what is still known to drift, each
// entry labelled with the phase that removes it. A phase that removes a rewrite deletes its entries here; a
// new rewrite fails this test. The list is empty when the work is complete (phase A2).
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const {designWorker}=require('./helpers/worker-harness.cjs');
const {scenarios}=require('./helpers/authored-drift-scenarios.cjs');
const E={first:[],firstSurface:[],edit:[],editSurface:[]};
const ALLOWED={
 // Stage B (2026-11-13) removed the structure rewrites: a placed child is not re-fitted, re-anchored or re-keyed
 // when its parent changes (the fitted shape is stored, placement.fittedGeometry), and exterior equipment does
 // not follow its parent. These scenarios must stay empty.
 'root resized across, sunk child elsewhere':E,
 'unrelated structure moved':E,
 'ship-level cut, unrelated structure moved':E,
 'mirrored pair, one side resized':E,
 // The edited structure itself (id 58, moved by the edit) is re-fitted at its new place and its record follows
 // the user's move (user decision 2026-11-13: a move by the user fits anew). No other item changes.
 'user design with surfaces, one structure moved':{...E,edit:[['parts',58,'changed','placement','']],editSurface:[['parts',58,'changed','placement','']]},
 // Phase C (fit host-follow): the weapon follows its moved host.
 'weapon on a moved structure':{...E,edit:[['fits',2,'changed','p,placement','']],editSurface:[['fits',2,'changed','p,placement','']]},
 // Phase F (nozzle foundation regeneration). The engine itself no longer follows the turned structure (stage B).
 'engine support under a turned structure':{...E,edit:[['parts',2,'changed','engineMountSupport','']],editSurface:[['parts',2,'changed','engineMountSupport','']]},
 // Phase D (hatches have one owner and fixed values): the hangar's hatch is rewritten by an unrelated edit.
 'hangar hatch, unrelated structure moved':{...E,edit:[['hatches',4,'changed','a,b,w','']],editSurface:[['hatches',4,'changed','a,b,w','']]},
};
// One row per drifted item: [list, id, kind, keys beyond the noise tolerance, keys within it] (F4: values are
// compared exactly; differences within Core.AUTHORED_DRIFT_NOISE are listed apart, never dropped).
const rows=list=>JSON.parse(JSON.stringify(list.map(d=>[d.list,d.id,d.kind,d.keys.join(','),d.noiseKeys.join(',')])));
// F3: both Worker answers are checked, the geometry answer and the later surface answer ('surfaceGeometry'),
// each against the state the editor sent.
const observed=async s=>{
 const w=designWorker(root,C),start=JSON.parse(C.publicJSON(s.build())),first=await w.update(start,{reset:true});
 const sent=s.edit(JSON.parse(JSON.stringify(first.surfaceState||first.state))),next=await w.update(sent);
 return {first:rows(C.authoredStateDrift(start,first.state)),firstSurface:rows(C.authoredStateDrift(start,first.surfaceState)),edit:rows(C.authoredStateDrift(sent,next.state)),editSurface:rows(C.authoredStateDrift(sent,next.surfaceState))};
};
for(const s of scenarios(C))test(`authored drift: ${s.name}`,async()=>{
 const got=await observed(s);if(process.env.KS_DRIFT_PRINT)console.log(JSON.stringify(s.name)+':'+JSON.stringify(got)+',');
 assert.deepEqual(got,ALLOWED[s.name]);
});
test('authoredStateDrift ignores a solved draft, reports added/removed items and the id counter',()=>{
 const a={parts:[{id:1,k:'struct',c:[0,0,0]},{id:2,k:'struct',c:[1,0,0],placement:{pendingGeometry:true}},{id:3,k:'gen'}],fits:[],hatches:[],nextId:4};
 const b={parts:[{id:1,k:'struct',c:[0,0,0],_cache:1},{id:2,k:'struct',c:[5,0,0]},{id:4,k:'gen'}],fits:[],hatches:[],nextId:5};
 assert.deepEqual(rows(C.authoredStateDrift(a,b)),[['parts',3,'removed','',''],['parts',4,'added','',''],['nextId',null,'changed','','']]);
 assert.equal(C.authoredStateDrift(a,a).length,0);
});
