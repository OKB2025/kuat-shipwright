// Examples are ordinary saved designs (user decision 2026-11-12): the game opens
// data/examples/<key>/design.json.gz like a user's save, never rebuilds an example procedurally
// (Core.buildDesign is an authoring tool), and keeps derived figures by design content plus the
// calculation-model key, never by source-file hashes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks'),{createHash}=require('node:crypto');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),plain=x=>JSON.parse(JSON.stringify(x)),reader=require('./helpers/example-reader.cjs');

// IndexedDB with separate named databases (ks-built, ks-derived) that survive engine instances.
function fakeIDB(){
 const dbs=new Map(),later=f=>setTimeout(f,0);
 const database=name=>{
  if(!dbs.has(name))dbs.set(name,new Map());const stores=dbs.get(name);
  const store=n=>{if(!stores.has(n))stores.set(n,new Map());const m=stores.get(n);return {
   get(id){const q={};later(()=>{q.result=m.has(id)?structuredClone(m.get(id)):undefined;q.onsuccess?.();});return q;},
   put(v){m.set(v.id,structuredClone(v));return {};},delete(id){m.delete(id);return {};},
   getAll(){const q={};later(()=>{q.result=[...m.values()].map(v=>structuredClone(v));q.onsuccess?.();});return q;}};};
  return {stores,db:{transaction(){const tx={objectStore:store};later(()=>later(()=>tx.oncomplete?.()));return tx;},close(){}},store};
 };
 return {dbs,store:(name,n)=>{database(name);return dbs.get(name).get(n)||new Map();},open(name){const rq={},d=database(name);later(()=>{if(!d.stores.size){rq.result={createObjectStore:d.store};rq.onupgradeneeded?.();}rq.result=d.db;rq.onsuccess?.();});return rq;}};
}
// The real engine in a vm context. stamp: the release's source stamp (any change to a source file
// changes it); readAsset: replaces the bytes of an example file.
function engine({idb=null,stamp='0123456789abcdef0123',reads=[],readAsset=null}={}){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone,importScripts(){},...(idb?{indexedDB:idb}:{}),KS_SOURCE_STAMP:stamp,...reader(root,{reads,read:readAsset})});
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(read(f),cx,{filename:f});
 const source=read('js/engine.js');vm.runInContext(source.slice(0,source.indexOf('/* Interface-side connection')),cx,{filename:'js/engine.js'});
 const {C,E,D}=vm.runInContext('({C:Core,E:YardEngine,D:YardFleetData})',cx),pending=[],calls={build:0,stats:0};
 const computeStats=C.computeStats;C.buildDesign=()=>{calls.build++;throw Error('buildDesign is an authoring tool');};C.computeStats=(...a)=>{calls.stats++;return computeStats(...a);};
 const scope={postMessage(m){const i=pending.findIndex(p=>p.id===m.id);if(i<0)return;const p=pending.splice(i,1)[0];m.type==='error'?p.reject(Object.assign(Error(m.message),{code:m.code})):p.resolve(m);}};
 E.listenWorker(scope);let id=1;const request=data=>new Promise((resolve,reject)=>{const job={...data,id:id++};pending.push({id:job.id,resolve,reject});scope.onmessage({data:job});});
 return {C,E,D,calls,reads,request};
}
const settle=()=>new Promise(r=>setTimeout(r,30));
function tiny(C){const s=C.deserialize(C.serialize(C.newShip({L:160,W:100,H:80,assembly:true},'Derived cache fixture')));s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.detail=0;s.nextId=1;C.placePart(s,'struct',[80,40,30],[80,40,24],{form:'box'},false);return C.serialize(s);}
const KEY='craft_tie_ln';

test('no runtime file calls the authoring tool that builds examples procedurally',()=>{
 for(const f of ['js/app.js','js/engine.js','js/gfx.js','js/worker.js','js/asset-cache.js','index.html'])assert.doesNotMatch(read(f),/\bbuildDesign\s*\(|\bbuildCraft\s*\(|SHIP_EXAMPLES\[[^\]]+\]\.build\s*\(/,f);
 const core=read('js/core.js'),calls=[...core.matchAll(/\bbuildDesign\s*\(/g)].map(m=>core.slice(Math.max(0,m.index-9),m.index+12));
 assert.deepEqual(calls,['function buildDesign('],'Core defines buildDesign and never calls it at runtime');
});

test('an example opens from its saved design, exactly like a user save',async()=>{
 const e=engine(),built=await e.request({type:'build',key:KEY}),asset=e.D.blueprints[KEY];
 assert.equal(e.calls.build,0);assert.deepEqual(e.reads,[asset.url]);assert.equal(built.src,'built');
 const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,asset.url)))),d=e.C.deserialize(saved);e.C.syncCompartments(d);e.C.remount(d);e.C.syncCompartments(d);
 assert.equal(built.state,e.C.publicJSON(d),'same result as the user-save load steps on the stored design');
});

test('a missing or damaged example file is an error, never a procedural rebuild',async()=>{
 const missing=engine({readAsset:()=>{throw Error('404');}});
 await assert.rejects(missing.request({type:'build',key:KEY}),e=>e.code==='example-unreadable'&&/作例の設計ファイルを読み込めません/.test(e.message));
 const damaged=engine({readAsset:url=>{const b=fs.readFileSync(path.join(root,url));b[b.length>>1]^=1;return b;}});
 await assert.rejects(damaged.request({type:'fleet',key:KEY,lite:true}),e=>e.code==='example-unreadable'&&/checksum/.test(e.message));
 const other=engine({readAsset:()=>zlib.gzipSync(Buffer.from('{"name":"other"}'))});
 await assert.rejects(other.request({type:'build',key:KEY}),/checksum/);
 const unknown=engine();await assert.rejects(unknown.request({type:'build',key:'no_such_example'}),e=>e.code==='example-missing');
 for(const e of [missing,damaged,other,unknown])assert.equal(e.calls.build,0);
});

test('derived figures are reused across releases by design content and model key, not by source hashes',async()=>{
 const idb=fakeIDB(),a=engine({idb}),design=tiny(a.C);
 const first=await a.request({type:'fleet',design,statsOnly:true});await settle();
 assert.equal(first.profileSrc,'computed');assert.equal(a.calls.stats,1);
 const model='m'+a.C.profileModelKey()+'|',ids=[...idb.store('ks-derived','rec').keys()];
 assert.equal(ids.length,1);assert.ok(ids[0].startsWith(model+'d:'),ids[0]);
 assert.equal(ids[0],model+'d:'+createHash('sha256').update(JSON.stringify(design)).digest('hex'));
 // Another release (a one-line comment in js/core.js changes the stamp): meshes and native caches are
 // rebuilt, the figures are not.
 const b=engine({idb,stamp:'fedcba9876543210fedc'}),second=await b.request({type:'fleet',design,statsOnly:true});
 assert.equal(second.src,'built');assert.equal(second.profileSrc,'derived');assert.equal(b.calls.stats,0);
 assert.deepEqual(plain(second.profile),plain(first.profile));assert.deepEqual(plain(second.stats),plain(first.stats));
 // Another calculation model: the stored figures are never read.
 // (A new model comes with new code, so with another release stamp too.)
 const c=engine({idb,stamp:'1111111111aaaaaaaaaa'});c.C.profileModelKey=()=>'next';
 const third=await c.request({type:'fleet',design:JSON.parse(JSON.stringify(design)),statsOnly:true});
 assert.equal(third.profileSrc,'computed');assert.equal(c.calls.stats,1);
 // A different design is a different entry.
 const changed=JSON.parse(JSON.stringify(design));changed.name='Renamed fixture';
 const fourth=await engine({idb}).request({type:'fleet',design:changed,statsOnly:true});assert.equal(fourth.profileSrc,'computed');
});

test('an example key is cached by its verified design checksum, so a changed design file is never served old figures',async()=>{
 const idb=fakeIDB(),a=engine({idb}),asset=a.D.blueprints[KEY];
 const first=await a.request({type:'fleet',key:KEY,statsOnly:true});await settle();assert.equal(first.profileSrc,'computed');
 assert.deepEqual([...idb.store('ks-derived','rec').keys()],['m'+a.C.profileModelKey()+'|k:'+asset.jsonSha256]);
 const b=engine({idb,stamp:'fedcba9876543210fedc'}),second=await b.request({type:'fleet',key:KEY,statsOnly:true});
 assert.equal(second.profileSrc,'derived');assert.equal(b.calls.stats,0);assert.deepEqual(plain(second.profile),plain(first.profile));
 // The same key with another (verified) design file: a new content key, figures computed afresh.
 const raw=Buffer.from(JSON.stringify(tiny(a.C))),gz=zlib.gzipSync(raw),sha=x=>createHash('sha256').update(x).digest('hex');
 // (data/fleet.js records the checksums, so a new design file also comes with another release stamp.)
 const c=engine({idb,stamp:'1111111111aaaaaaaaaa',readAsset:()=>gz});Object.assign(c.D.blueprints[KEY],{sha256:sha(gz),jsonSha256:sha(raw)});
 const third=await c.request({type:'fleet',key:KEY,statsOnly:true});assert.equal(third.profileSrc,'computed');assert.equal(third.profile.name,'Derived cache fixture');
 assert.equal(a.calls.build+b.calls.build+c.calls.build,0);
});

test('records written by an earlier release (main) are never served',async()=>{
 const idb=fakeIDB(),stamp='0123456789abcdef0123',design=tiny(engine().C);
 // main stored 'ks-built' records under the bare stamp; a current record carries the 'b2:' schema.
 const a=engine({idb,stamp});await a.request({type:'fleet',design,statsOnly:true});await settle();
 const recs=idb.store('ks-built','rec');assert.ok(recs.size>0);for(const r of recs.values())assert.equal(r.v,'b2:'+stamp);
 for(const r of [...recs.values()])recs.set(r.id,{...r,v:stamp,profile:{...r.profile,name:'stale profile from main'}});
 const derived=idb.store('ks-derived','rec');derived.clear();
 const b=engine({idb,stamp}),r=await b.request({type:'fleet',design,statsOnly:true});
 assert.equal(r.src,'built');assert.notEqual(r.profile.name,'stale profile from main');assert.equal(r.profileSrc,'computed');
});
