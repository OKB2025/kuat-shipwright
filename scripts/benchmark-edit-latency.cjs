#!/usr/bin/env node
// Structure-move latency through the real engine (js/engine.js) in Node.
// Usage: node scripts/benchmark-edit-latency.cjs OUTPUT_JSON [--designs imperial,user] [--moves N] [--profile]
// Times from posting an `update` for a moved structure to (a) the first
// geometry packet of that generation (the moved structure settled and shown)
// and (b) the stats packet. The stats debounce is the editor's default (220 ms)
// unless --stats-delay is given. Writes only to OUTPUT_JSON (required).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const args=process.argv.slice(2),output=args.find(a=>!a.startsWith('--')&&!/^\d+$/.test(a));
if(!output){console.error('usage: benchmark-edit-latency.cjs OUTPUT_JSON [--designs a,b] [--moves N] [--stats-delay ms]');process.exit(2);}
const opt=(name,def)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:def;};
const designs=opt('designs','imperial,user').split(','),moves=+opt('moves',4),statsDelay=opt('stats-delay',null),profileDir=opt('profile',null);
const inspector=profileDir?new (require('node:inspector').Session)():null;if(inspector)inspector.connect();
const ins=(m,p={})=>new Promise((res,rej)=>inspector.post(m,p,(e,r)=>e?rej(e):res(r)));
// Self time and inclusive time per function (name:line) from a CPU profile.
function summarize(profile){const byId=new Map(profile.nodes.map(n=>[n.id,n])),self=new Map(),dt=profile.timeDeltas,samples=profile.samples;const parent=new Map();for(const n of profile.nodes)for(const c of n.children||[])parent.set(c,n.id);const incl=new Map();for(let i=0;i<samples.length;i++){const d=(dt[i+1]??0)/1000;let n=byId.get(samples[i]);const k=n.callFrame.functionName+':'+n.callFrame.lineNumber;self.set(k,(self.get(k)||0)+d);const seen=new Set();for(let id=samples[i];id!=null;id=parent.get(id)){const m=byId.get(id),kk=m.callFrame.functionName+':'+m.callFrame.lineNumber;if(seen.has(kk))continue;seen.add(kk);incl.set(kk,(incl.get(kk)||0)+d);}}const top=m=>[...m].sort((a,b)=>b[1]-a[1]).slice(0,40).map(([k,v])=>[k,+v.toFixed(1)]);return {self:top(self),inclusive:top(incl)};}
const {userFixture}=require('../tests/helpers/edit-latency-fixtures.cjs');

function setup(){
 const timings={};
 const cx=vm.createContext({console,setTimeout,clearTimeout,structuredClone,performance});
 for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
 const {C,G,E}=vm.runInContext('({C:Core,G:Gfx,E:YardEngine})',cx);
 // Wrap the Core/Gfx entry points the engine calls, to break the time down.
 const wrap=(obj,name,label)=>{const f=obj[name];if(typeof f!=='function')return;obj[name]=function(...a){const t=performance.now();try{return f.apply(this,a);}finally{const d=performance.now()-t;(timings[label]||(timings[label]={ms:0,n:0})).ms+=d;timings[label].n++;}};};
 for(const n of ['syncCompartments','remount','computeStats','refreshPlacementGeometry','rayEnv','surfaceReport','fleetProfile','placementDraftStatus','hullGeo','publicJSON'])wrap(C,n,'C.'+n);
 for(const n of ['meshParts','meshFits','meshHull','meshHatches','shipBounds'])wrap(G,n,'G.'+n);
 wrap(E,'packCaches','E.packCaches');
 const messages=[],waiting=[];
 const scope={postMessage(msg){const at=performance.now();const copy=structuredClone(msg);copy._at=at;messages.push(copy);for(const w of waiting.slice())if(w.test(copy)){waiting.splice(waiting.indexOf(w),1);w.resolve(copy);}}};
 E.listenWorker(scope);
 const wait=test=>new Promise(resolve=>{const hit=messages.find(test);if(hit)resolve(hit);else waiting.push({test,resolve});});
 return {C,G,E,timings,messages,wait,send:data=>scope.onmessage({data:structuredClone(data)})};
}
function loadDesign(C,name){
 if(name==='user')return userFixture(C);
 const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',name,'design.json.gz'))));
 return C.deserialize(raw);
}
const state=(C,s)=>JSON.stringify(s,(k,v)=>k.startsWith('_')?undefined:v);
async function run(name){
 const {C,timings,messages,wait,send}=setup(),ship=loadDesign(C,name);
 const structs=ship.parts.filter(p=>C.isShapePart(p)&&!C.isHullStructure?.(p)&&p.form!=='hull');
 const interior=ship.parts.filter(p=>C.isInternal(p));
 const target=structs.find(p=>p.placement)||structs[Math.floor(structs.length/2)];
 const t0=performance.now();
 send({type:'update',gen:1,designId:'bench',state:state(C,ship),what:['all'],reset:true,view:{deferSurfaces:true},statsDelay:0});
 await wait(m=>m.type==='stats'&&m.gen===1);
 const load={ms:performance.now()-t0};
 const rows=[];let gen=1;
 for(let i=0;i<moves;i++){
  for(const k of Object.keys(timings))delete timings[k];
  gen++;const dx=(i%2?-1:1)*Math.max(.5,ship.hull.L*.004);
  target.c=[target.c[0]+dx,target.c[1],target.c[2]];
  if(target.placement?.requestedGeometry?.c)target.placement.requestedGeometry.c=target.c.slice();
  if(inspector&&i===0){await ins('Profiler.enable');await ins('Profiler.setSamplingInterval',{interval:1000});await ins('Profiler.start');}
  const sent=performance.now();
  send({type:'update',gen,designId:'bench',state:state(C,ship),what:['parts'],view:{deferSurfaces:true,structureFirst:true},...(statsDelay!=null?{statsDelay:+statsDelay}:{})});
  const types=['structureGeometry','placementResolution','authoringGeometry','geometry','surfaceGeometry','stats'],got={};
  const stats=await wait(m=>(m.type==='stats'||m.type==='error')&&m.gen===gen);
  if(stats.type==='error')throw new Error(stats.message);
  for(const m of messages)if(m.gen===gen&&types.includes(m.type)&&got[m.type]==null)got[m.type]=+(m._at-sent).toFixed(1);
  const geo=messages.find(m=>m.type==='geometry'&&m.gen===gen);
  let profile=null;if(inspector&&i===0){const {profile:p}=await ins('Profiler.stop');fs.mkdirSync(profileDir,{recursive:true});fs.writeFileSync(path.join(profileDir,name+'-move1.cpuprofile'),JSON.stringify(p));profile=summarize(p);}
  rows.push({move:i+1,dx,firstPacketMs:Math.min(...Object.values(got)),settledMs:got.structureGeometry??got.geometry,geometryMs:got.geometry,statsMs:got.stats,packets:got,
   engine:{syncMs:geo?.syncMs,meshMs:geo?.meshMs,packMs:geo?.packMs,statsCompute:stats.statsMs},
   ...(profile?{profile}:{}),breakdown:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,{ms:+v.ms.toFixed(1),n:v.n}]).sort((a,b)=>b[1].ms-a[1].ms))});
  // The editor adopts the engine state: mirror it so the next move starts from the derived state.
  const s=messages.filter(m=>m.gen===gen&&m.state).at(-1);if(s){const pub=JSON.parse(s.state);for(const p of ship.parts){const q=pub.parts.find(x=>x.id===p.id);if(q)Object.assign(p,q);}}
 }
 const med=k=>{const v=rows.map(r=>r[k]).filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[v.length>>1]:null;};
 return {design:name,parts:ship.parts.length,structures:structs.length,interior:interior.length,fits:ship.fits.length,movedPart:target.id,placed:!!target.placement,load,
  median:{settledMs:med('settledMs'),geometryMs:med('geometryMs'),statsMs:med('statsMs')},rows};
}
(async()=>{
 const report={date:new Date().toISOString(),node:process.version,root,statsDelay:statsDelay??'editor default (220 ms)',moves,results:[]};
 for(const d of designs){console.log('design',d);const r=await run(d);report.results.push(r);console.log(JSON.stringify({design:d,median:r.median,load:r.load}));}
 fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,1)+'\n');
 process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
