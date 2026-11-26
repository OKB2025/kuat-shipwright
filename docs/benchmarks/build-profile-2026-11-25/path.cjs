// The game's own path for an example ship (js/engine.js fleet job, src 'built'): deserialize the saved design, derive its
// compartments, remount, derive again, statistics, fleet profile, model. Times each stage and counts calls of the large
// Core functions, with the time inside each (inclusive; nested calls of the same function are counted once).
// usage: node path.cjs <root> <key> [--prof]   (run under node --cpu-prof for a profile)
const fs=require('fs'),vm=require('vm'),path=require('path'),zlib=require('zlib'),{performance}=require('perf_hooks');
const root=process.argv[2],key=process.argv[3];
const cx=vm.createContext({console:{log(){},warn(){},error(){}},performance,setTimeout,clearTimeout,structuredClone,URL});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),G=vm.runInContext('Gfx',cx);
const NAMES=['syncCompartments','remount','computeStats','fleetProfile','surfacePatches','weaponCapacitors','allOccupied','hullGeo','structTriangles','turretCompartment','enginePaths','engineTransmission','engineDriveRoutes','commandCompartments','missileCells','fitSpec','partVolume','surfaceWorkingShip','fitInfo','computeHeat','trenchArmamentGroups','syncTrenchArmament','referenceHullGeometry','fitAABB','partAABB','surfaceConfig','powerNetwork','deserialize','serialize','publicJSON','turretRayContext','placementDraftStatus'];
const stat={};for(const n of NAMES){const f=C[n];if(typeof f!=='function')continue;const s=stat[n]={n:0,ms:0,depth:0};C[n]=function(...a){s.n++;if(s.depth++){try{return f.apply(this,a);}finally{s.depth--;}}const t=performance.now();try{return f.apply(this,a);}finally{s.ms+=performance.now()-t;s.depth--;}};}
const stages=[];const T=(name,fn)=>{const before=Object.fromEntries(Object.entries(stat).map(([k,v])=>[k,v.n])),t=performance.now(),r=fn(),ms=performance.now()-t;stages.push({name,ms,calls:Object.fromEntries(Object.entries(stat).map(([k,v])=>[k,v.n-before[k]]).filter(([k,v])=>v>0))});return r;};
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));
const d=T('deserialize',()=>C.deserialize(raw));
T('syncCompartments #1',()=>C.syncCompartments(d));
T('remount',()=>C.remount(d,{keepFitPose:true}));
T('syncCompartments #2',()=>C.syncCompartments(d));
T('publicJSON',()=>C.publicJSON(d));
T('serialize',()=>C.serialize(d));
const S=T('computeStats',()=>C.computeStats(d));
const p=T('fleetProfile',()=>C.fleetProfile(S,d.name,d));
T('computeStats again (same ship, nothing changed)',()=>C.computeStats(d));
T('fleetGeometry (model + trial)',()=>G.fleetGeometry(d,{variants:true,...(p?.surface?.offset?{center:p.surface.offset}:{})}));
T('turretRayContext',()=>C.turretRayContext&&C.turretRayContext(C.surfaceWorkingShip?C.surfaceWorkingShip(d):d));
console.log('# '+key+': parts '+d.parts.length+', fits '+d.fits.length+', hatches '+(d.hatches||[]).length);
console.log('\n| stage | s | calls of the counted functions inside it |\n| --- | --- | --- |');
for(const s of stages)console.log('| '+s.name+' | '+(s.ms/1000).toFixed(2)+' | '+Object.entries(s.calls).sort((a,b)=>b[1]-a[1]).slice(0,9).map(([k,v])=>k+' '+v).join(', ')+' |');
console.log('\n| function | calls | s inside (outermost calls) |\n| --- | --- | --- |');
for(const [k,v] of Object.entries(stat).sort((a,b)=>b[1].ms-a[1].ms))if(v.n)console.log('| '+k+' | '+v.n+' | '+(v.ms/1000).toFixed(2)+' |');
