// 2026-11-27 (the trial of an Imperial or Venator on an iPhone dropped back to the title) and 2026-11-28 (regression review): a crashed
// engine worker is replaced by a fresh worker, not by the inline engine. Requests in flight are refused, messages sent while the new
// worker starts reach it in order, the page is told (so it sends its whole design again), and only after ENGINE_RESTARTS restarts
// does the inline engine take over.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const engine=fs.readFileSync(path.join(__dirname,'../js/engine.js'),'utf8');const tick=()=>new Promise(r=>setTimeout(r,0));
class FakeWorker{constructor(n){this.n=n;this.sent=[];this.terminated=false;}postMessage(m){this.sent.push(m);}terminate(){this.terminated=true;}}
function setup({refuse}={}){
 const made=[],boots=[];
 const KSBoot={createBackgroundWorker(){if(refuse)return Promise.reject(new Error('source snapshot unavailable'));const w=new FakeWorker(made.length+1);made.push(w);return new Promise(r=>{boots.push(()=>r(w));});}};
 const cx=vm.createContext({Core:{},Gfx:{},console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,structuredClone,Worker:FakeWorker,Blob,URL,KSBoot});
 vm.runInContext(engine,cx);const client=vm.runInContext('YardEngineClient',cx);
 return {client,made,boots,first:new FakeWorker(0)};
}
const crash=w=>w.onerror({message:'out of memory',preventDefault(){}});
test('a crashed worker is replaced by a fresh worker: in-flight requests are refused, queued messages arrive in order, the page is told',async()=>{
 const {client,made,boots,first}=setup();let restarts=0;client.on('restart',()=>{restarts++;});
 assert.equal(await client.start(['src'],{workerReady:Promise.resolve(first)}),'worker');
 const p=client.request('fleet',{key:'imperial'});await tick();await tick();assert.equal(first.sent.length,1);
 crash(first);await assert.rejects(p,/engine restarted/);assert.ok(first.terminated);assert.equal(restarts,1,'the page is told');
 crash(first);assert.equal(made.length,1,'a second crash report while restarting starts no second worker');
 client.post({type:'update',gen:1});client.post({type:'update',gen:2});assert.equal(made[0].sent.length,0,'queued until the new worker is ready');
 await tick();boots[0]();await tick();await tick();assert.equal(client.mode,'worker');assert.deepEqual(made[0].sent.map(m=>m.gen),[1,2],'in order');
 client.post({type:'update',gen:3});assert.equal(made[0].sent.at(-1).gen,3,'later messages go straight to it');
 const q=client.request('fleet',{key:'venator'});await tick();await tick();const id=made[0].sent.at(-1).id;made[0].onmessage({data:{type:'fleet',id,ok:1}});assert.equal((await q).ok,1,'answers of the new worker are delivered');
});
test('after ENGINE_RESTARTS restarts the inline engine takes over',async()=>{
 const {client,made,boots,first}=setup();let restarts=0;client.on('restart',()=>{restarts++;});
 await client.start(['src'],{workerReady:Promise.resolve(first)});
 crash(first);await tick();boots[0]();await tick();await tick();assert.equal(client.mode,'worker');
 crash(made[0]);await tick();boots[1]();await tick();await tick();assert.equal(client.mode,'worker');assert.equal(made.length,2);
 crash(made[1]);await tick();assert.equal(made.length,2,'no third worker');assert.equal(client.mode,'inline');assert.equal(restarts,3);
});
test('a fresh worker that fails to start hands over to the inline engine',async()=>{
 const {client,first}=setup({refuse:true});let restarts=0;client.on('restart',()=>{restarts++;});
 await client.start(['src'],{workerReady:Promise.resolve(first)});
 crash(first);assert.equal(restarts,1);await tick();await tick();await tick();assert.equal(client.mode,'inline');
});
