// What makes the profile and the statistics large: JSON size of each top-level key (and of profile.surface's keys). read-only.
const fs=require('fs'),vm=require('vm'),path=require('path'),zlib=require('zlib'),{performance}=require('perf_hooks');
const root=process.argv[2],key=process.argv[3];
const cx=vm.createContext({console:{log(){},warn(){},error(){}},performance,setTimeout,clearTimeout,structuredClone,URL});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),J=v=>{try{return (JSON.stringify(v,(k,x)=>ArrayBuffer.isView(x)?Array.from(x):x)||'').length;}catch(e){return -1;}};
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));
const d=C.deserialize(raw);C.remount(d,{keepFitPose:true});C.syncCompartments(d);const S=C.computeStats(d),p=C.fleetProfile(S,d.name,d);
const top=(o,name)=>{console.log('\n## '+name+' total '+(J(o)/1048576).toFixed(1)+' MB');for(const [k,n] of Object.keys(o).map(k=>[k,J(o[k])]).sort((a,b)=>b[1]-a[1]).slice(0,10))console.log('  '+(n/1048576).toFixed(2)+' MB  '+k+(Array.isArray(o[k])?' ['+o[k].length+']':''));};
top(p,'profile');if(p.surface)top(p.surface,'profile.surface');if(p.surface?.patches?.[0])top(p.surface.patches[0],'profile.surface.patches[0] (one of '+p.surface.patches.length+')');top(S,'statistics');if(S.surface)top(S.surface,'statistics.surface');
