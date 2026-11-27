// Peak heap during each stage of the worker's trial path: max "heap in use after a scavenge/mark" from --trace-gc lines is read by
// the caller; here each stage is bracketed by markers on stdout. usage: node --trace-gc peak.cjs <root> <key>
const fs=require('fs'),vm=require('vm'),path=require('path'),zlib=require('zlib'),{performance}=require('perf_hooks');
const root=process.argv[2],key=process.argv[3];const cx=vm.createContext({console:{log(){},warn(){},error(){}},performance,setTimeout,clearTimeout,structuredClone,URL});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),G=vm.runInContext('Gfx',cx);const T=(n,fn)=>{console.log('### BEGIN '+n);const t=performance.now(),r=fn();console.log('### END '+n+' '+((performance.now()-t)/1000).toFixed(1)+'s rss '+(process.memoryUsage().rss/1048576).toFixed(0));return r;};
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));
const d=T('deserialize',()=>C.deserialize(raw));T('remount',()=>C.remount(d,{keepFitPose:true}));T('syncCompartments',()=>C.syncCompartments(d));
const S=T('computeStats',()=>C.computeStats(d)),p=T('fleetProfile',()=>C.fleetProfile(S,d.name,d));T('fleetGeometry',()=>G.fleetGeometry(d,{variants:true,...(p?.surface?.offset?{center:p.surface.offset}:{})}));
console.log('### maxRSS '+(process.resourceUsage().maxRSS/1024).toFixed(0)+' MB');
