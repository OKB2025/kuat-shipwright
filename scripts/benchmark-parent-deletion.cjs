#!/usr/bin/env node
// Single observations, not a frame-rate target or a statistical speedup claim.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const root=path.resolve(__dirname,'..'),{C}=require('./update-ship-examples.cjs').loadRuntime(root),output=path.resolve(process.argv[2]||path.join(root,'docs/benchmarks/parent-deletion.json')),results=[];
for(const count of [20,100])for(const connected of [false,true]){
 const began=performance.now(),step=connected?10:15,L=(count-1)*step+20,s=C.newShip({assembly:true,L,W:40,H:40},'Parent deletion measurement');s.parts=[{id:1,k:'struct',form:'box',c:[(count-1)*step/2,0,0],s:[L,40,20]}];s.fits=[];s.nextId=2;
 for(let i=0;i<count;i++){const r=C.commitPlacement(s,{id:-1,k:'struct',form:'box',c:[0,0,0],s:[10,10,10]},{mode:'horizontal',parentStructureId:1,hit:{p:[i*step,10,0],n:[0,1,0]}});assert.equal(r.ok,true,r.error);}
 const started=performance.now(),r=C.removeParts(s,[1]),ended=performance.now();assert.equal(r.ok,true);assert.equal(s.parts.length,connected?count:0);results.push({count,connected,setupMs:started-began,deleteMs:ended-started,removedParts:r.removed.length,remainingParts:s.parts.length});
}
const sourceSha256=Object.fromEntries(['js/core.js','scripts/benchmark-parent-deletion.cjs'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({date:new Date().toISOString(),node:process.version,sourceSha256,scope:'Single in-process synchronous graph-deletion observations after real Core placement setup. Setup is excluded from deleteMs. CPU/GC/cache history are not controlled; this is not browser input latency or a measured speedup.',results},null,2)+'\n');console.log(JSON.stringify({output,results}));
