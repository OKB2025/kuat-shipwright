const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
// A minimal asynchronous IndexedDB: enough for open/upgrade, getAll, get, put and delete.
function fakeIndexedDB(){
 const dbs=new Map(),later=f=>setTimeout(f,0);
 return {dbs,open(name){
  const rq={};later(()=>{let db=dbs.get(name);const fresh=!db;if(fresh){const stores=new Map();db={stores,objectStoreNames:{contains:n=>stores.has(n)},createObjectStore(n,o){stores.set(n,{key:o.keyPath,rows:new Map()});},transaction(n){const s=stores.get(n);if(!s)throw new Error('no store '+n);const t={};const req=v=>{const r={};later(()=>{r.result=v;r.onsuccess?.();later(()=>t.oncomplete?.());});return r;};t.objectStore=()=>({getAll:()=>req([...s.rows.values()].map(v=>structuredClone(v))),get:k=>req(s.rows.has(k)?structuredClone(s.rows.get(k)):undefined),put:v=>{s.rows.set(v[s.key],structuredClone(v));return req(v[s.key]);},delete:k=>{s.rows.delete(k);return req(undefined);}});return t;}};dbs.set(name,db);}rq.result=db;if(fresh)rq.onupgradeneeded?.();rq.onsuccess?.();});return rq;
 }};
}
function setup({noIndexedDB=false,legacy=null}={}){
 const indexedDB=noIndexedDB?undefined:fakeIndexedDB();
 const storage=new Map(legacy?[['yard.saves',JSON.stringify(legacy)]]:[]);
 const localStorage={getItem:k=>storage.has(k)?storage.get(k):null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
 const ctx=vm.createContext({console,setTimeout,structuredClone,localStorage,window:{},storage,...(indexedDB?{indexedDB}:{})});
 const run=code=>vm.runInContext(code,ctx);
 run(`const $=()=>({hidden:true,textContent:''});const renderSaves=()=>{};const LS={get(k){try{return localStorage.getItem(k);}catch(e){return null;}},set(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}};`);
 const a=app.indexOf('const LocalDB = {'),b=app.indexOf('const LocalExamples = {',a);assert.ok(a>0&&b>a);run(app.slice(a,b));
 return {run,storage,indexedDB};
}
test('local saves live in IndexedDB and the localStorage array is migrated once',async()=>{
 const {run,storage}=setup({legacy:[{id:'a',kind:'ship',name:'A',savedAt:1,data:'j1:{}'},{id:'b',kind:'ship',name:'B',savedAt:3,data:'j1:{}'}]});
 assert.deepEqual(await run('Store.list().then(r=>JSON.stringify(r.map(x=>x.id)))').then(JSON.parse),['b','a']);
 assert.equal(run('Store.local'),'idb');assert.equal(storage.has('yard.saves'),false,'the migrated array frees localStorage');
 assert.equal(await run("Store.save({id:'c',kind:'ship',name:'C',savedAt:5,data:'j1:{}'})"),'local');
 assert.deepEqual(await run('Store.list().then(r=>JSON.stringify(r.map(x=>x.id)))').then(JSON.parse),['c','b','a']);
 await run("Store.remove('b')");assert.deepEqual(await run('Store.list().then(r=>JSON.stringify(r.map(x=>x.id)))').then(JSON.parse),['c','a']);
 assert.equal(storage.has('yard.saves'),false,'saves no longer rewrite the localStorage array');
});
test('records of other kinds stay out of the saved-design list',async()=>{
 const {run}=setup();await run("Store.save({id:'m',kind:'mission',savedAt:9})");await run("Store.save({id:'s',kind:'ship',name:'S',savedAt:2})");
 assert.deepEqual(await run('Store.list().then(r=>JSON.stringify(r.map(x=>x.id)))').then(JSON.parse),['s']);
});
test('without IndexedDB the localStorage array remains the store',async()=>{
 const {run,storage}=setup({noIndexedDB:true,legacy:[{id:'a',kind:'ship',name:'A',savedAt:1}]});
 assert.deepEqual(await run('Store.list().then(r=>JSON.stringify(r.map(x=>x.id)))').then(JSON.parse),['a']);assert.equal(run('Store.local'),'ls');
 await run("Store.save({id:'z',kind:'ship',name:'Z',savedAt:2})");assert.deepEqual(JSON.parse(storage.get('yard.saves')).map(x=>x.id),['z','a']);
});
test('a design saved before its statistics settle is finished and prepared later',async()=>{
 const requests=[],records=new Map();
 const ctx=vm.createContext({console,setTimeout,structuredClone,requests,records});const run=code=>vm.runInContext(code,ctx);
 run(`let ship={saveId:'d1',name:'D'},S=null;const eng={gen:4,statsGen:3,adoptedGen:3},st={};const C={placementDraftStatus:()=>({ready:true}),serialize:s=>({name:s.name,parts:[]})};
 const $=()=>({hidden:true,disabled:false});const toast=()=>{},renderSaves=()=>{},esc=String,autosaveShipLength=()=>12;
 async function pack(v){return 'j1:'+JSON.stringify(v);}
 const Store={async save(r){records.set(r.id,r);return 'local';}};
 const YardEngineClient={request(type,args){requests.push([type,args.trial,args.prepareOnly,args.design.name]);return Promise.resolve({});}};`);
 const a=app.indexOf('let savingCurrent = false;'),b=app.indexOf('let delConfirm =',a);run(app.slice(a,b));
 await run('saveCurrent()');
 assert.equal(run("records.get('d1').provisional"),true);assert.equal(requests.length,0,'nothing is prepared from unsettled statistics');
 run("S={cls:{role:'艦',name:'級'},hullLen:12.4};eng.statsGen=eng.adoptedGen=4;");
 assert.equal(await run('completePendingSave()'),true);
 assert.equal(run("records.get('d1').provisional"),undefined);assert.equal(run("records.get('d1').cls"),'艦／級');
 assert.deepEqual(JSON.parse(JSON.stringify(requests)),[['fleet',false,true,'D'],['fleet',true,true,'D']]);
 assert.equal(await run('completePendingSave()'),false,'the queue is emptied');
 run("eng.statsGen=eng.adoptedGen=3;eng.gen=4;S=null");await run('saveCurrent()');run("eng.gen=5;S={cls:{role:'a',name:'b'},hullLen:1};eng.statsGen=eng.adoptedGen=5");
 assert.equal(await run('completePendingSave()'),false,'an edited design does not finish the older save');assert.equal(requests.length,2);
});
test('a settled save builds the battle data at once',async()=>{
 const requests=[],records=new Map();
 const ctx=vm.createContext({console,setTimeout,structuredClone,requests,records});const run=code=>vm.runInContext(code,ctx);
 run(`let ship={saveId:'d2',name:'E'},S={cls:{role:'r',name:'n'},hullLen:30};const eng={gen:2,statsGen:2,adoptedGen:2},st={};const C={placementDraftStatus:()=>({ready:true}),serialize:s=>({name:s.name,parts:[]})};
 const $=()=>({hidden:true,disabled:false});const toast=()=>{},renderSaves=()=>{},esc=String;async function pack(v){return 'j1:'+JSON.stringify(v);}
 const Store={async save(r){records.set(r.id,r);return 'local';}};const YardEngineClient={request(type,args){requests.push([type,args.trial]);return Promise.resolve({});}};`);
 const a=app.indexOf('let savingCurrent = false;'),b=app.indexOf('let delConfirm =',a);run(app.slice(a,b));
 await run('saveCurrent()');assert.deepEqual(JSON.parse(JSON.stringify(requests)),[['fleet',false],['fleet',true]]);assert.equal(run('pendingSave'),null);
});
