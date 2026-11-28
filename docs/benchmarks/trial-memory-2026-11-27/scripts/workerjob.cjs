// The worker's own 'fleet' job for an example (as the trial or the fleet battle asks for it), run in node: time, peak resident,
// what is posted, and whether the performance calculation ran. usage: node workerjob.cjs <root> <key> [trial=1]
const fs=require('fs'),path=require('path'),vm=require('vm'),{performance}=require('perf_hooks');const root=process.argv[2],key=process.argv[3],trial=process.argv[4]!=='0';
const cx=vm.createContext({console:{log(){},warn(){},error:console.error},setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,performance,URL,Blob,Response,TextDecoder,TextEncoder,DecompressionStream,crypto:globalThis.crypto,
 KS_READ_ASSET:u=>{const b=fs.readFileSync(path.join(root,u));return new Blob([b]);}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx);let computeCalls=0;
const msgs=[];const scope={postMessage(m){msgs.push(m);}};E.listenWorker(scope);
let peak=0;const tm=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss);},20);
(async()=>{const t0=performance.now();scope.onmessage({data:{type:'fleet',id:1,key,trial}});
 while(!msgs.some(m=>m.id===1&&(m.type==='fleet'||m.type==='error')))await new Promise(r=>setTimeout(r,200));
 const m=msgs.find(m=>m.id===1);const J=v=>{try{return JSON.stringify(v,(k,x)=>ArrayBuffer.isView(x)?{len:x.byteLength}:x).length;}catch(e){return -1;}};
 clearInterval(tm);peak=Math.max(peak,process.memoryUsage().rss);
 console.log(JSON.stringify({key,trial,type:m.type,error:m.message||null,seconds:+((performance.now()-t0)/1000).toFixed(1),peakRSS_MB:Math.round(peak/1048576),maxRSS_MB:Math.round(process.resourceUsage().maxRSS/1024),profileSrc:m.profileSrc,src:m.src,
  profileMB:+(J(m.profile)/1048576).toFixed(1),statsMB:+(J(m.stats)/1048576).toFixed(1),surfacePatches:m.profile?.surface?.patches?.length??null,hasStats:!!m.stats}));process.exit(0);})().catch(e=>{console.error(e);process.exit(1);});
