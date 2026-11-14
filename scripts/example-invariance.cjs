#!/usr/bin/env node
// Example invariance check (no-parent / authored-state work, 2026-11-12).
//
// Loads every stored example design (data/examples/<key>/design.json.gz) as a save, runs it through the
// real Worker update path twice (a reset update, then a no-op round-trip with the Worker's own state), and
// records:
//   - a hash of the authored (public) state as stored, after deserialize, and after each Worker pass;
//   - every authored field the load or the Worker changed against the stored file (per item and key, with a
//     numeric tolerance), so a phase can show that it changes nothing it should not;
//   - the computeStats digest of the round-tripped design (mass, cost, propulsion, ... within tolerance).
//
// It never writes into the repository. Usage:
//   node scripts/example-invariance.cjs run <root> <out.json> [key ...]
//   node scripts/example-invariance.cjs compare <base.json> <head.json> [out.json]
// <root> is the checkout to measure (KS_TEST_ROOT style). Each key runs in its own child process.
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
// F4 (2026-11-13): the same tolerance policy as Core.authoredStateDrift: exact comparison, differences within the
// relative noise tolerance (Core.AUTHORED_DRIFT_NOISE, 1e-9) reported apart as noise, never dropped.
let TOL=1e-9;

function loadWorker(root){
 const {C,R}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
 const context=vm.createContext({Core:C,console:{log(){},warn(){},error:console.error,info(){}},setTimeout,clearTimeout,structuredClone,performance});
 vm.runInContext(fs.readFileSync(path.join(root,'js/gfx.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),context);
 const messages=[],scope={postMessage(m){messages.push(m);}};
 context.scope=scope;vm.runInContext('YardEngine.listenWorker(scope)',context);
 if(Number.isFinite(C.AUTHORED_DRIFT_NOISE))TOL=C.AUTHORED_DRIFT_NOISE;
 // F3 (2026-11-13): each update answers twice ('geometry', then 'surfaceGeometry' after the surface pass); both
 // carry the public state.
 async function wait(gen,type='geometry'){
  for(let i=0;i<600000;i++){
   const failure=messages.find(m=>m.type==='error');if(failure)throw new Error('Worker error: '+failure.message);
   const reply=messages.find(m=>m.type===type&&m.gen===gen);if(reply){messages.splice(messages.indexOf(reply),1);return reply;}
   await new Promise(r=>setTimeout(r,2));
  }
  throw new Error('Worker reply timeout '+gen);
 }
 const send=m=>scope.onmessage({data:structuredClone(m)});
 return {C,R,send,wait};
}
const authored=v=>JSON.parse(JSON.stringify(v,(k,x)=>k.startsWith('_')?undefined:x));
const fnv=t=>{let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);};
const LISTS=['parts','fits','hatches'];
// Field-level differences with a relative numeric tolerance. Returns [{path, before, after}].
function diff(a,b,p='',out=[],limit=4000){
 if(out.length>=limit)return out;
 if(typeof a==='number'&&typeof b==='number'){if(a!==b)out.push({path:p,before:a,after:b,...(Math.abs(a-b)<=TOL*Math.max(1,Math.abs(a),Math.abs(b))?{noise:true}:{})});return out;}
 if(a===b)return out;
 if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length){a.forEach((x,i)=>diff(x,b[i],p+'['+i+']',out,limit));return out;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],p?p+'.'+k:k,out,limit);return out;}
 const short=v=>{const s=JSON.stringify(v);return s&&s.length>200?s.slice(0,200)+'…':v;};
 out.push({path:p,before:short(a),after:short(b)});return out;
}
// Per-item diff keyed by id (so a reorder alone is reported once, not as every field).
function stateDiff(before,after){
 const out=[];
 for(const list of LISTS){
  const A=new Map((before[list]||[]).map(x=>[x.id,x])),B=new Map((after[list]||[]).map(x=>[x.id,x]));
  for(const [id,x] of A){if(!B.has(id)){out.push({path:`${list}#${id}`,before:'present',after:'removed'});continue;}diff(x,B.get(id),`${list}#${id}`,out);}
  for(const id of B.keys())if(!A.has(id))out.push({path:`${list}#${id}`,before:'absent',after:'added'});
  const order=x=>(x||[]).map(q=>q.id).join(',');if(order(before[list])!==order(after[list]))out.push({path:list+'.order',before:'stored',after:'changed'});
 }
 const rest=o=>{const q={...o};for(const l of LISTS)delete q[l];delete q.format;delete q.v;return q;};
 diff(rest(before),rest(after),'ship',out);return out;
}
async function runKey(root,key){
 const t0=Date.now(),{C,send,wait}=loadWorker(root),{figuresDigest}=require(path.join(root,'tests/helpers/figures-digest.cjs'));
 const stored=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));
 const ship=C.deserialize(JSON.parse(JSON.stringify(stored))),loaded=authored(JSON.parse(C.publicJSON(ship)));
 send({type:'update',gen:1,designId:'invariance-'+key,state:JSON.stringify(loaded),reset:true,what:['all'],stats:false,view:{deferSurfaces:true}});
 const w1=authored(JSON.parse((await wait(1)).state)),s1raw=(await wait(1,'surfaceGeometry')).state,s1=s1raw?authored(JSON.parse(s1raw)):w1;
 send({type:'update',gen:2,designId:'invariance-'+key,state:JSON.stringify(w1),reset:false,what:['parts','fits','hatches'],stats:false,view:{deferSurfaces:true}});
 const w2=authored(JSON.parse((await wait(2)).state)),s2raw=(await wait(2,'surfaceGeometry')).state,s2=s2raw?authored(JSON.parse(s2raw)):w2;
 const again=C.deserialize(JSON.parse(JSON.stringify({...stored,...w2,format:stored.format,v:stored.v}))),digest=figuresDigest(C.computeStats(again));
 const storedPlain=authored(stored);
 const h=v=>fnv(JSON.stringify(v));
 const real=list=>list.filter(d=>!d.noise);
 const all={load:stateDiff(storedPlain,loaded),worker:stateDiff(storedPlain,w2),roundTrip:stateDiff(w1,w2),workerSurface:stateDiff(storedPlain,s2),roundTripSurface:stateDiff(s1,s2)};
 // diffs: beyond the noise tolerance (as before F4); noise: the differences within it, listed apart.
 const diffs=Object.fromEntries(Object.entries(all).map(([k,v])=>[k,real(v)])),noise=Object.fromEntries(Object.entries(all).map(([k,v])=>[k,v.filter(d=>d.noise)]));
 const drift=typeof C.authoredStateDrift==='function'?{worker1:C.authoredStateDrift(loaded,w1),surface1:C.authoredStateDrift(loaded,s1),worker2:C.authoredStateDrift(w1,w2)}:null;
 return {key,ms:Date.now()-t0,hash:{stored:h(storedPlain),loaded:h(loaded),worker1:h(w1),worker2:h(w2)},
  counts:Object.fromEntries(LISTS.map(l=>[l,(w2[l]||[]).length])),diffCount:Object.fromEntries(Object.entries(diffs).map(([k,v])=>[k,v.length])),noiseCount:Object.fromEntries(Object.entries(noise).map(([k,v])=>[k,v.length])),diffs,noise:Object.fromEntries(Object.entries(noise).map(([k,v])=>[k,v.slice(0,200)])),drift,digest};
}
function keysOf(root){return fs.readdirSync(path.join(root,'data/examples')).filter(k=>fs.existsSync(path.join(root,'data/examples',k,'design.json.gz'))).sort();}
function compare(base,head){
 const {figuresDiff}=require(path.join(__dirname,'../tests/helpers/figures-digest.cjs'));
 const B=new Map(base.examples.map(e=>[e.key,e])),rows=[];
 for(const h of head.examples){const b=B.get(h.key);if(!b){rows.push({key:h.key,status:'missing-in-base'});continue;}
  if(b.error||h.error){rows.push({key:h.key,status:'error',base:b.error,head:h.error});continue;}
  const fig=figuresDiff(b.digest,h.digest,1e-9);
  // Authored state after the Worker, compared head vs base field by field.
  const workerChanged=JSON.stringify(b.diffs.worker)!==JSON.stringify(h.diffs.worker)||!!(b.diffs.workerSurface&&h.diffs.workerSurface&&JSON.stringify(b.diffs.workerSurface)!==JSON.stringify(h.diffs.workerSurface));
  rows.push({key:h.key,status:!fig.length&&!workerChanged&&b.hash.worker2===h.hash.worker2?'same':'changed',
   storedHashSame:b.hash.stored===h.hash.stored,worker2HashSame:b.hash.worker2===h.hash.worker2,figures:fig.slice(0,40),
   workerDiffBase:b.diffCount.worker,workerDiffHead:h.diffCount.worker,
   workerOnlyInBase:b.diffs.worker.filter(d=>!h.diffs.worker.some(e=>e.path===d.path)).slice(0,40),
   workerOnlyInHead:h.diffs.worker.filter(d=>!b.diffs.worker.some(e=>e.path===d.path)).slice(0,40)});}
 return {base:base.root,head:head.root,rows,summary:{same:rows.filter(r=>r.status==='same').length,changed:rows.filter(r=>r.status==='changed').map(r=>r.key),errors:rows.filter(r=>r.status==='error').map(r=>r.key)}};
}
async function main(){
 const [mode,...args]=process.argv.slice(2);
 if(mode==='one'){const [root,key]=args;let r;try{r=await runKey(path.resolve(root),key);}catch(e){r={key,error:String(e&&e.stack||e)};}process.stdout.write(JSON.stringify(r));return;}
 if(mode==='run'){
  const [rootArg,out,...keys]=args;if(!rootArg||!out)throw new Error('usage: run <root> <out.json> [key ...]');
  const root=path.resolve(rootArg),list=keys.length?keys:keysOf(root),examples=[];
  let commit=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
  for(const key of list){const raw=execFileSync(process.execPath,['--max-old-space-size=4096',__filename,'one',root,key],{encoding:'utf8',maxBuffer:1<<30});const r=JSON.parse(raw);examples.push(r);
   process.stderr.write(`${key}: ${r.error?'ERROR '+r.error.split('\n')[0]:`${r.ms} ms, diffs load ${r.diffCount.load} worker ${r.diffCount.worker} roundTrip ${r.diffCount.roundTrip} surface ${r.diffCount.workerSurface} surfaceRoundTrip ${r.diffCount.roundTripSurface} noise(worker) ${r.noiseCount.worker}`}\n`);
   fs.mkdirSync(path.dirname(path.resolve(out)),{recursive:true});fs.writeFileSync(path.resolve(out),JSON.stringify({root,commit,generatedAt:new Date().toISOString(),examples},null,1)+'\n');}
  return;}
 if(mode==='compare'){const [a,b,out]=args;const r=compare(JSON.parse(fs.readFileSync(a,'utf8')),JSON.parse(fs.readFileSync(b,'utf8')));const text=JSON.stringify(r,null,1)+'\n';if(out)fs.writeFileSync(out,text);console.log(JSON.stringify(r.summary));return;}
 throw new Error('usage: run <root> <out.json> [key ...] | compare <base.json> <head.json> [out.json]');
}
main().catch(e=>{console.error(e);process.exit(1);});
