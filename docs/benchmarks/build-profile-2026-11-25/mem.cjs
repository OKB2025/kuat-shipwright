// Memory through the game's path to a trial (the worker's fleet job with trial:true), stage by stage: heap in use after each
// stage (after a collection when run with --expose-gc), the peak resident size, and the size of what the worker posts back.
const fs=require('fs'),vm=require('vm'),path=require('path'),zlib=require('zlib'),{performance}=require('perf_hooks'),v8=require('v8');
const root=process.argv[2],key=process.argv[3];
const cx=vm.createContext({console:{log(){},warn(){},error(){}},performance,setTimeout,clearTimeout,structuredClone,URL});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),G=vm.runInContext('Gfx',cx),MB=n=>(n/1048576).toFixed(0);
let peak=0;const timer=setInterval(()=>{peak=Math.max(peak,process.memoryUsage().rss);},50);
const rows=[];const T=(name,fn)=>{const t=performance.now(),r=fn(),ms=performance.now()-t,m0=process.memoryUsage();peak=Math.max(peak,m0.rss);if(global.gc)global.gc();const m=process.memoryUsage();rows.push([name,(ms/1000).toFixed(1),MB(m0.heapUsed),MB(m.heapUsed),MB(m0.rss),MB(m.arrayBuffers)]);return r;};
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));
const d=T('deserialize',()=>C.deserialize(raw));
T('remount',()=>C.remount(d,{keepFitPose:true}));
T('syncCompartments',()=>C.syncCompartments(d));
const S=T('computeStats',()=>C.computeStats(d));
const p=T('fleetProfile',()=>C.fleetProfile(S,d.name,d));
const g=T('fleetGeometry (model + trial)',()=>G.fleetGeometry(d,{variants:true,...(p?.surface?.offset?{center:p.surface.offset}:{})}));
T('turretRayContext',()=>C.turretRayContext&&C.turretRayContext(C.surfaceWorkingShip?C.surfaceWorkingShip(d):d));
const bytes=o=>{let n=0;const seen=new Set();const w=v=>{if(!v||typeof v!=='object'||seen.has(v))return;seen.add(v);if(ArrayBuffer.isView(v)){n+=v.byteLength;return;}for(const k in v)w(v[k]);};w(o);return n;};
const tri=o=>{let n=0;for(const m of Object.values(o?.meshes||{})){const q=m.geo||m;if(q?.idx)n+=q.idx.length/3;}return n;};
clearInterval(timer);
console.log('# '+key+': parts '+d.parts.length+', fits '+d.fits.length);
console.log('| stage | s | heap in use MB (before / after collection) | resident MB | typed arrays MB |\n| --- | --- | --- | --- | --- |');
for(const r of rows)console.log('| '+r[0]+' | '+r[1]+' | '+r[2]+' / '+r[3]+' | '+r[4]+' | '+r[5]+' |');
console.log('\npeak resident '+MB(peak)+' MB; heap limit '+MB(v8.getHeapStatistics().heap_size_limit)+' MB');
for(const [n,o] of Object.entries(g||{}))if(o&&o.meshes)console.log('geometry '+n+': typed arrays '+MB(bytes(o))+' MB, triangles '+Math.round(tri(o)));
console.log('profile JSON '+MB(JSON.stringify(p).length)+' MB; stats JSON '+MB(JSON.stringify(S,(k,v)=>ArrayBuffer.isView(v)?undefined:v).length)+' MB; public state '+MB(C.publicJSON(d).length)+' MB');
