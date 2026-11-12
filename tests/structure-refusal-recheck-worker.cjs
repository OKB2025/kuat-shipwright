// A refused structure is re-checked whenever it has not been solved for its current public state
// (placementRefusalKey, docs/design-placement-v1.2.md 「拒否された構造物の再検査」). The Worker recovers the
// reported sunk structures (2026-11-12) right after load; if the editor discards that reply (generation or
// sourceKey mismatch) and patches its still-refused copy back, the Worker must re-check and recover again,
// not keep computing mass, grounding and warnings for the refused state. A structure that really fails is
// re-solved at most once per distinct public state, not on every update.
const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..');
const SUNK=[100,101],LEGACY=[90,91,92,93,94,95];
const saved=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/sunk-structure-interference-2026-11-12.json.gz'))).toString('utf8'));
const sensors=raw=>{for(const p of raw.parts)if(LEGACY.includes(p.id)){const keep={id:p.id,k:'sensor',c:p.c,d:3};for(const key of Object.keys(p))delete p[key];Object.assign(p,keep);}return raw;};
function worker(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),messages=[],waiters=[];
 const scope={postMessage(message){const packet=structuredClone(message);messages.push(packet);for(const w of waiters.slice())if((packet.type===w.type&&packet.gen===w.gen)||packet.type==='error'){waiters.splice(waiters.indexOf(w),1);packet.type==='error'?w.reject(Error(packet.message)):w.resolve(packet);}}};E.listenWorker(scope);
 const wait=(type,gen)=>new Promise((resolve,reject)=>{const packet=messages.find(m=>m.type===type&&m.gen===gen||m.type==='error');if(packet)packet.type==='error'?reject(Error(packet.message)):resolve(packet);else waiters.push({type,gen,resolve,reject});});
 const send=message=>scope.onmessage({data:structuredClone(message)});
 // Rows the Worker resolved (re-checked) for the sunk structures, per generation.
 const rows=gen=>messages.filter(m=>m.type==='placementResolution'&&m.gen===gen).flatMap(m=>m.rows).filter(r=>r.list==='parts'&&SUNK.includes(r.id));
 return {C,send,wait,rows};
}
const update=(f,gen,state,reset=false)=>{f.send({type:'update',gen,designId:'sunk',state,what:reset?['all']:['parts'],reset,statsDelay:0,view:{deferSurfaces:true}});return f.wait('stats',gen);};
const near=(a,b,label)=>assert.ok(Math.abs(a-b)<=1e-6*Math.abs(b),`${label}: ${a} vs ${b}`);

test('a Worker recovery discarded by the editor is re-checked when the still-refused copy is patched back',async()=>{
 const f=worker(),{C}=f,refused=JSON.stringify(saved());
 const cold=C.deserialize(JSON.parse(refused)),coldMass=C.computeStats({...cold,_cache:null}).mass;
 for(const id of SUNK)assert.equal(cold.parts.find(p=>p.id===id)._placementError,undefined,'cold load recovers');
 const first=await update(f,1,refused,true);
 assert.deepEqual(f.rows(1).map(r=>[r.id,r.error,!!r.part.placement.validationFailed]),SUNK.map(id=>[id,null,false]),'recovered after load');
 near(first.stats.mass,coldMass,'Worker mass after load = cold-load mass');assert.equal(first.provisional,false);
 const coldVolume=C.computeStats({...cold,_cache:null}).volume;near(first.stats.volume,coldVolume,'Worker volume after load = cold-load volume');
 assert.deepEqual(f.rows(1).map(r=>r.part.roll),[-8,8],'Worker keeps the saved roll (−8/+8)');assert.deepEqual(SUNK.map(id=>cold.parts.find(p=>p.id===id).roll),[-8,8],'cold load keeps the saved roll');
 // The editor dropped the reply (stale generation / sourceKey): its copy, still refused, is patched back.
 const second=await update(f,2,refused);
 assert.deepEqual(f.rows(2).map(r=>[r.id,r.error,!!r.part.placement.validationFailed]),SUNK.map(id=>[id,null,false]),'re-checked and recovered again');
 near(second.stats.mass,coldMass,'Worker mass after the patch = cold-load mass');near(second.stats.volume,coldVolume,'Worker volume after the patch');assert.deepEqual(f.rows(2).map(r=>r.part.roll),[-8,8]);assert.equal(second.provisional,false,'not counted as a failed placement');
 assert.deepEqual(second.stats.ungrounded.parts,[],'no red frame');
 // The editor now holds the recovered state: nothing to re-check.
 const recovered=JSON.parse(refused);for(const r of f.rows(2))recovered.parts[recovered.parts.findIndex(p=>p.id===r.id)]=r.part;
 await update(f,3,JSON.stringify(recovered));assert.deepEqual(f.rows(3),[],'a recovered structure is not re-solved');
});

test('a structure that still fails is re-solved once per distinct refused state, not on every update',async()=>{
 const f=worker(),refused=JSON.stringify(sensors(saved()));
 const first=await update(f,1,refused,true);
 assert.deepEqual(f.rows(1).map(r=>[r.id,r.error,!!r.part.placement.validationFailed]),SUNK.map(id=>[id,'placement-interference',true]),'refused again on a fresh Worker ship, solved once each');
 assert.equal(first.provisional,true);
 // The editor adopts the Worker's refused rows: the same public state is not solved again, however often it is sent.
 const adopted=JSON.parse(refused);for(const r of f.rows(1))adopted.parts[adopted.parts.findIndex(p=>p.id===r.id)]=r.part;
 for(const gen of [2,3,4]){await update(f,gen,JSON.stringify(adopted));assert.deepEqual(f.rows(gen),[],'gen '+gen+': not re-solved');}
 // The editor's original copy (the state the Worker re-checked from) is not solved again either, however often
 // it is sent (an editor that keeps discarding the reply does not cost a solve per update).
 for(const gen of [5,6]){await update(f,gen,refused);assert.deepEqual(f.rows(gen),[],'gen '+gen+': the original refused copy is not re-solved');}
 // A new public state of a refused structure (here a new geometry revision of #101, its shape unchanged) is
 // solved once, then left alone.
 const bumped=JSON.parse(JSON.stringify(adopted)),q=bumped.parts.find(p=>p.id===101);q.placement.geometryRevision=(q.placement.geometryRevision||0)+1;
 await update(f,7,JSON.stringify(bumped));assert.deepEqual(f.rows(7).map(r=>[r.id,r.error]),[[101,'placement-interference']],'one re-check for the new state');
 await update(f,8,JSON.stringify(bumped));assert.deepEqual(f.rows(8),[],'and not again');
});
