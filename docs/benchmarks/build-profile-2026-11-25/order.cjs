// Does "remount, then derive the compartments once" give the same ship as "derive, remount, derive"? read-only.
// usage: node order.cjs <root> key,key,...
const fs=require('fs'),vm=require('vm'),path=require('path'),zlib=require('zlib'),{performance}=require('perf_hooks'),crypto=require('crypto');
const root=process.argv[2],keys=process.argv[3].split(',');
const cx=vm.createContext({console:{log(){},warn(){},error(){}},performance,setTimeout,clearTimeout,structuredClone,URL});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,12);
const num=(a,b,p,out)=>{if(out.length>12)return;if(typeof a==='number'&&typeof b==='number'){if(a!==b&&Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))out.push(p+' '+a+' '+b);return;}if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))num(a[k],b[k],p+'.'+k,out);return;}if(a!==b&&(a==null||b==null||typeof a!=='object'))out.push(p+' '+JSON.stringify(a)?.slice(0,40)+' '+JSON.stringify(b)?.slice(0,40));};
console.log('| example | old order s (derive, remount, derive) | new order s (remount, derive) | public state | serialized design | statistics (differences) |\n| --- | --- | --- | --- | --- | --- |');
for(const key of keys){const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));
 let t=performance.now();const a=C.deserialize(JSON.parse(JSON.stringify(raw)));C.syncCompartments(a);C.remount(a,{keepFitPose:true});C.syncCompartments(a);const ta=(performance.now()-t)/1000;
 t=performance.now();const b=C.deserialize(JSON.parse(JSON.stringify(raw)));let err='';try{C.remount(b,{keepFitPose:true});C.syncCompartments(b);}catch(e){err=String(e.message).slice(0,120);}const tb=(performance.now()-t)/1000;
 if(err){console.log('| '+key+' | '+ta.toFixed(1)+' | ERROR '+err+' | | | |');continue;}
 const pa=C.publicJSON(a),pb=C.publicJSON(b),sa=JSON.stringify(C.serialize(a)),sb=JSON.stringify(C.serialize(b));
 const SA=JSON.parse(JSON.stringify(C.computeStats(a),(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)),SB=JSON.parse(JSON.stringify(C.computeStats(b),(k,v)=>ArrayBuffer.isView(v)?Array.from(v):v)),out=[];num(SA,SB,'S',out);
 let firstDiff='';if(pa!==pb){const A=JSON.parse(pa),B=JSON.parse(pb),o=[];num(A,B,'state',o);firstDiff=' ('+o.slice(0,3).join('; ')+')';}
 console.log('| '+[key,ta.toFixed(1),tb.toFixed(1),pa===pb?'same':'DIFFERS'+firstDiff,sa===sb?'same':'DIFFERS',out.length?out.length+': '+out.slice(0,3).join('; '):'same'].join(' | ')+' |');}
