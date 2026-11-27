// The structures' material kept with the design (user 2026-11-27「JSONに構造物の計算結果の数字を入れれないか」): the volume each structure adds is
// saved with a key of the geometry it was worked out from; a design whose geometry has that key takes the volumes from the record (the
// figures are the same), any change of a structure, the hull or the order works them out again, and a record with another key is ignored.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const plain=x=>JSON.parse(JSON.stringify(x)),pick=S=>JSON.stringify([S.mass,S.cost,S.volume,S.crew,S.hp,S.structVolume,S.costBy]);
function design(){const s=C.newShip({L:30,W:12,H:8,assembly:true},'record');s.parts=[];s.fits=[];s.nextId=1;C.placePart(s,'struct',[0,4,0],[20,8,8],{form:'box'},false);C.placePart(s,'struct',[8,6,0],[10,6,6],{form:'box'},false);C.placePart(s,'struct',[-8,3,3],[8,5,5],{form:'box'},false);return s;}
const load=o=>{const s=C.deserialize(plain(o));C.syncCompartments(s);return s;};
test('a computed design carries the record into its save, and a reload uses it with the same figures',()=>{
 const s=design(),S=C.computeStats(s),o=plain(C.serialize(s)),r=o.structuralMaterial;
 assert.ok(r&&r.v===C.STRUCTURAL_RECORD_VERSION&&typeof r.key==='string','saved');assert.equal(r.steps.length,3,'one volume a structure');assert.ok(r.steps.every(v=>v>=0));
 assert.ok(S.structuralRecord&&S.structuralRecord.key===r.key,'the stats carry it (the Worker sends it to the editor)');
 const b=load(o),B=C.computeStats(b);assert.equal(pick(B),pick(S),'same figures');assert.equal(C.structuralMaterial(C.surfaceWorkingShip?C.surfaceWorkingShip(b):b).fromRecord,true,'taken from the record');
 assert.equal(JSON.stringify(C.serialize(b).structuralMaterial),JSON.stringify(r),'saved again as it was');
});
test('any change of the geometry works the material out again; a record with another key, or a malformed one, is not used',()=>{
 const s=design();C.computeStats(s);const o=plain(C.serialize(s));
 const moved=plain(o);moved.parts.find(p=>p.k==='struct').c[0]+=1;const fresh=plain(moved);delete fresh.structuralMaterial;
 const M=C.computeStats(load(moved)),F=C.computeStats(load(fresh));assert.equal(pick(M),pick(F),'a moved structure: as if there were no record');
 const wrong=plain(o);wrong.structuralMaterial.steps=wrong.structuralMaterial.steps.map(v=>v*2);wrong.structuralMaterial.key='1:3:zzzz';assert.equal(pick(C.computeStats(load(wrong))),pick(C.computeStats(load(fresh.parts?o:o))),'another key: ignored');
 for(const bad of [{v:99,key:'x',steps:[1,2,3]},{v:1,key:'x',steps:[1,-2,3]},{v:1,key:'x',steps:'no'},null])assert.equal(C.cleanStructuralRecord(bad),null);
 assert.equal(C.cleanStructuralRecord({v:C.STRUCTURAL_RECORD_VERSION,key:'k',steps:[1,2]}).steps.length,2);
});
test('the key follows the triangles, the ids and the order',()=>{
 const T=[0,0,0,1,0,0,0,1,0],e=(id,t,bulk=true)=>({p:{id},T:t,bulk});const k=C.structuralRecordKey([],[e(1,T),e(2,T)]);
 assert.equal(C.structuralRecordKey([],[e(1,T.slice()),e(2,T.slice())]),k,'the same contents give the same key');assert.notEqual(C.structuralRecordKey([],[e(2,T),e(1,T)]),k,'order');assert.notEqual(C.structuralRecordKey([],[e(1,T),e(2,[...T.slice(0,8),1e-9])]),k,'a coordinate');assert.notEqual(C.structuralRecordKey(T,[e(1,T),e(2,T)]),k,'the hull');assert.notEqual(C.structuralRecordKey([],[e(1,T),e(2,T,false)]),k,'kind');
});
// Regression review 2026-11-27: the record goes to the Worker beside the ship state (msg.structuralRecord), not in it, so the state
// compared as public JSON (the Worker's reset check, settledState, the editor's diffs) never carries it, and the Worker's ship keeps it private.
test('the Worker takes the record beside the state, uses it, and keeps it out of the public state it sends back',async()=>{
 const fs=require('node:fs'),vm=require('node:vm'),root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error},performance,setTimeout,clearTimeout,structuredClone});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const {W,E}=vm.runInContext('({W:Core,E:YardEngine})',cx),messages=[],waiters=[];
 const scope={postMessage(m){const q=structuredClone(m);messages.push(q);for(const w of waiters.slice())if(q.type===w.type&&q.gen===w.gen||q.type==='error'){waiters.splice(waiters.indexOf(w),1);q.type==='error'?w.reject(Error(q.message)):w.resolve(q);}}};E.listenWorker(scope);
 const wait=(type,gen)=>new Promise((resolve,reject)=>{const q=messages.find(m=>m.type===type&&m.gen===gen||m.type==='error');if(q)q.type==='error'?reject(Error(q.message)):resolve(q);else waiters.push({type,gen,resolve,reject});});
 const s=design();C.computeStats(s);const o=plain(C.serialize(s)),record=o.structuralMaterial,b=W.deserialize(plain(o));W.syncCompartments(b);
 assert.ok(b._structuralRecord&&!('structuralMaterial' in b),'a load keeps the record private');
 const state=JSON.stringify(b,(k,v)=>k.startsWith('_')?undefined:v);assert.ok(!state.includes('structuralMaterial'),'the public state carries no record');
 const marked={...record,steps:record.steps.map(v=>v*2)}/* the same key, other volumes: only a Worker that takes the record returns these */;
 scope.onmessage({data:structuredClone({type:'update',gen:1,designId:'record',state,structuralRecord:marked,what:['all'],reset:true,statsDelay:0,view:{deferSurfaces:true}})});
 const stats=(await wait('stats',1)).stats;assert.equal(stats.structuralRecord?.key,record.key);assert.deepEqual(plain(stats.structuralRecord.steps),marked.steps,'the Worker used the record sent beside the state');
 for(const m of messages)assert.ok(!JSON.stringify(m.state??m.ship??m.sourceState??'').includes('structuralMaterial'),'no public state sent back carries it ('+m.type+')');
});
