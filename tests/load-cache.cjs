const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
// v13 LOAD loading paths: the engine's disk cache of built designs and lite fleet models.

// A minimal IndexedDB (one database, object stores keyed by 'id', asynchronous callbacks, structured clones),
// shared between engine instances as a browser profile shares it between visits.
function fakeIDB(){
 const stores=new Map(),later=f=>setTimeout(f,0);
 const store=name=>{if(!stores.has(name))stores.set(name,new Map());const m=stores.get(name);return {
  get(id){const q={};later(()=>{q.result=m.has(id)?structuredClone(m.get(id)):undefined;q.onsuccess?.();});return q;},
  put(v){m.set(v.id,structuredClone(v));return {};},delete(id){m.delete(id);return {};},
  getAll(){const q={};later(()=>{q.result=[...m.values()].map(v=>structuredClone(v));q.onsuccess?.();});return q;}};};
 const db={transaction(){const tx={objectStore:store};later(()=>later(()=>tx.oncomplete?.()));return tx;},close(){}};
 return {stores,open(){const rq={};later(()=>{if(!stores.size){rq.result={createObjectStore:store};rq.onupgradeneeded?.();}rq.result=db;rq.onsuccess?.();});return rq;}};
}
function engine(idb,files={},options={}){
 const sources=['data/reference.js','data/imperial2.js','js/core.js','js/gfx.js','js/engine.js'];
 const hash=b=>require('node:crypto').createHash('sha256').update(b).digest();
 const stamp=hash(Buffer.concat(sources.map(f=>hash(files[f]??read(f))))).toString('hex').slice(0,20);
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone,URL,crypto:globalThis.crypto,importScripts(){},
  ...(idb?{indexedDB:idb}:{}),KS_SOURCE_STAMP:options.noStamp?null:stamp,
  fetch:async()=>{throw new Error('disk identity must use loaded bytes, never refetch sources');},
  ...require('./helpers/example-reader.cjs')(root)});
 cx.self=cx;cx.self.location={href:'http://x/app/js/worker.js'};
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(files[f]??read(f),cx,{filename:f});
 const source=read('js/engine.js');vm.runInContext(source.slice(0,source.indexOf('/* Interface-side connection')),cx,{filename:'js/engine.js'});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),pending=[];
 const scope={postMessage(m){const i=pending.findIndex(p=>p.id===m.id);if(i<0)return;const p=pending.splice(i,1)[0];m.type==='error'?p.reject(Error(m.message)):p.resolve(m);}};
 E.listenWorker(scope);let id=1;const request=data=>new Promise((resolve,reject)=>{const job={...data,id:id++};pending.push({id:job.id,resolve,reject});scope.onmessage({data:job});});
 return {C,E,request};
}
const settle=()=>new Promise(r=>setTimeout(r,30));
const meshSig=g=>Object.keys(g.meshes).sort().map(k=>{const m=g.meshes[k].geo;return m?k+':'+m.n+':'+m.ni:k;}).join(',');
// A small design whose figures take moments (the examples' take minutes in a test run).
function tiny(C){const s=C.deserialize(C.serialize(C.newShip({L:160,W:100,H:80,assembly:true},'Load test')));s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.detail=0;s.nextId=1;C.placePart(s,'struct',[80,40,30],[80,40,24],{form:'box'},false);return C.serialize(s);}

test('an example built once is served from the disk cache on the next visit, with the same design and model',async()=>{
 const idb=fakeIDB(),a=engine(idb);
 const first=await a.request({type:'fleet',key:'gozanti',lite:true});assert.equal(first.src,'built');assert.equal(first.stats,null);await settle();
 assert.ok([...idb.stores.get('rec').keys()].includes('k:gozanti'),'the build is stored under the example key');
 const b=engine(idb),second=await b.request({type:'fleet',key:'gozanti',lite:true});
 assert.equal(second.src,'disk');assert.deepEqual(plain(second.design),plain(first.design));assert.equal(meshSig(second.geometry),meshSig(first.geometry));
 const built=await engine(idb).request({type:'build',key:'gozanti'});assert.equal(built.src,'disk');
});

test('records of other sources are not served: any change to the engine files starts afresh',async()=>{
 const idb=fakeIDB();await engine(idb).request({type:'fleet',key:'gozanti',lite:true});await settle();
 const r=await engine(idb,{'js/core.js':read('js/core.js')+'\n// changed\n'}).request({type:'fleet',key:'gozanti',lite:true});
 assert.equal(r.src,'built');
});

test('without IndexedDB everything is built as before',async()=>{
 const e=engine(null),a=await e.request({type:'fleet',key:'gozanti',lite:true}),b=await engine(null).request({type:'fleet',key:'gozanti',lite:true});
 assert.equal(a.src,'built');assert.equal(b.src,'built');assert.equal(e.E.disk.off,true);
});

test('lite models skip the figures; asking for them later gives the same profile as a full request, from disk too',async()=>{
 const idb=fakeIDB(),e=engine(idb),design=tiny(e.C);
 const lite=await e.request({type:'fleet',design,lite:true});assert.equal(lite.stats,null);assert.equal(lite.profile,null);assert.ok(Object.keys(lite.geometry.meshes).length);
 const figures=await e.request({type:'fleet',design,statsOnly:true});assert.ok(figures.stats);assert.equal(figures.geometry,undefined);await settle();
 const full=await engine(fakeIDB()).request({type:'fleet',design});assert.deepEqual(plain(figures.profile),plain(full.profile));
 const again=await engine(idb).request({type:'fleet',design,trial:true});assert.equal(again.src,'disk');assert.deepEqual(plain(again.profile),plain(full.profile));assert.ok(Array.isArray(again.geometry.turrets));
});

test('a trial of the design on the drawing board reuses the figures the editor already has',async()=>{
 const e=engine(fakeIDB()),{C}=e,ship=C.deserialize(tiny(C));
 // the editor's update (geometry, then figures) runs first: the engine takes jobs in order
 e.request({type:'update',gen:1,state:C.publicJSON(ship),what:['all'],reset:true,stats:true,statsDelay:0});
 const r=await e.request({type:'fleet',design:C.serialize(ship),trial:true});assert.equal(r.src,'editor');assert.ok(r.stats&&r.profile);
 const plainRun=await engine(fakeIDB()).request({type:'fleet',design:C.serialize(ship),trial:true});assert.equal(plainRun.src,'built');assert.deepEqual(plain(r.profile),plain(plainRun.profile));
});


test('without a verified startup snapshot no persistent records are read or overwritten',async()=>{
 const idb=fakeIDB();await engine(idb).request({type:'fleet',key:'gozanti',lite:true});await settle();
 const before=structuredClone([...idb.stores.get('rec')]);
 const e=engine(idb,{}, {noStamp:true}),r=await e.request({type:'fleet',key:'gozanti',lite:true});await settle();
 assert.equal(r.src,'built');assert.equal(e.E.disk.off,true);
 assert.deepEqual([...idb.stores.get('rec')],before);
});

test('a gfx-only source change invalidates prior persistent geometry identity',async()=>{
 const idb=fakeIDB();await engine(idb).request({type:'fleet',key:'gozanti',lite:true});await settle();
 const r=await engine(idb,{'js/gfx.js':read('js/gfx.js')+'\n// new renderer release\n'}).request({type:'fleet',key:'gozanti',lite:true});
 assert.equal(r.src,'built');
});
