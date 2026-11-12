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
const ALLOWED={
 // Phase B (structure parent link): the solve stores parent keys on the first refresh, and a resize of the
 // root re-seats the sunk child (the user's report 2026-11-12).
 'root resized across, sunk child elsewhere':{first:[['parts',2,'changed','placement']],edit:[['parts',2,'changed','c,placement']]},
 'unrelated structure moved':{first:[['parts',2,'changed','placement']],edit:[]},
 // Phase C (fit host-follow): the weapon follows its moved host.
 'weapon on a moved structure':{first:[],edit:[['fits',2,'changed','p,placement']]},
 // Phase B (equipment parent follow) and phase F (nozzle foundation regeneration).
 'engine support under a turned structure':{first:[['parts',2,'changed','c,engineMountSupport,placement,roll']],edit:[['parts',2,'changed','c,dir,engineMountSupport,placement']]},
};
const rows=list=>JSON.parse(JSON.stringify(list.map(d=>[d.list,d.id,d.kind,d.keys.join(',')])));
for(const s of scenarios(C))test(`authored drift: ${s.name}`,async()=>{
 const w=designWorker(root,C),start=JSON.parse(C.publicJSON(s.build())),first=await w.update(start,{reset:true});
 const sent=s.edit(JSON.parse(JSON.stringify(first.state))),next=await w.update(sent);
 assert.deepEqual({first:rows(C.authoredStateDrift(start,first.state)),edit:rows(C.authoredStateDrift(sent,next.state))},ALLOWED[s.name]);
});
test('authoredStateDrift ignores a solved draft, reports added/removed items and the id counter',()=>{
 const a={parts:[{id:1,k:'struct',c:[0,0,0]},{id:2,k:'struct',c:[1,0,0],placement:{pendingGeometry:true}},{id:3,k:'gen'}],fits:[],hatches:[],nextId:4};
 const b={parts:[{id:1,k:'struct',c:[0,0,0],_cache:1},{id:2,k:'struct',c:[5,0,0]},{id:4,k:'gen'}],fits:[],hatches:[],nextId:5};
 assert.deepEqual(rows(C.authoredStateDrift(a,b)),[['parts',3,'removed',''],['parts',4,'added',''],['nextId',null,'changed','']]);
 assert.equal(C.authoredStateDrift(a,a).length,0);
});
