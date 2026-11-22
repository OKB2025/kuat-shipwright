// debug only: a vm copy of core.js that records the hull material mass before and after the parts displace it
const fs=require('fs'),path=require('path'),zlib=require('zlib'),vm=require('vm');const root=process.cwd();
const ctx=vm.createContext({console,performance});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx);
let core=fs.readFileSync(path.join(root,'js/core.js'),'utf8');
const a='const hullBins=bins.slice(); bins.fill(0);';if(!core.includes(a))throw 'a';core=core.replace(a,a+'globalThis.__m={hull0:hullBins.reduce((x,y)=>x+y,0)};');
const b='  const M = bins.reduce((a, b) => a + b, 0);';if(!core.includes(b))throw 'b';core=core.replace(b,'globalThis.__m.hullAfter=hullBins.reduce((x,y)=>x+Math.max(0,y),0);globalThis.__m.framing=framingMass;globalThis.__m.total=bins.reduce((x,y)=>x+y,0);'+b);
{const c='for (let k = k0; k <= k1; k++) {bins[k]+=m/span;hullBins[k]-=V*newHull/Math.max(1,vs.length)*K.hullDens/span;}';if(!core.includes(c))throw 'c';core=core.replace(c,c+'(globalThis.__m.disp||(globalThis.__m.disp={}))[pt.id]=V*newHull/Math.max(1,vs.length)*K.hullDens;');}
vm.runInContext(core,ctx);const C=vm.runInContext('Core',ctx);
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/imperial/design.json.gz'))));const prep=s=>{C.syncCompartments(s);C.remount(s,{keepFitPose:true});C.syncCompartments(s);return s;};
const A=prep(C.deserialize(raw));C.computeStats(A);const ma=JSON.parse(JSON.stringify(vm.runInContext('__m',ctx)));
const B=C.deserialize(raw);C.syncCompartments(B);C.bakeAllCuts(B);prep(B);C.computeStats(B);const mb=vm.runInContext('__m',ctx);
const da=ma.disp||{},db=mb.disp||{};const dr=[];for(const id of new Set([...Object.keys(da),...Object.keys(db)])){const x=da[id]||0,y=db[id]||0;if(Math.abs(x-y)>1)dr.push([id,A.parts.find(q=>q.id==id)?.k,+x.toFixed(0),+y.toFixed(0)]);}dr.sort((a,b)=>Math.abs(b[3]-b[2])-Math.abs(a[3]-a[2]));console.log('disp diffs',dr.length,JSON.stringify(dr.slice(0,12)));delete ma.disp;delete mb.disp;
for(const k of Object.keys(ma))console.log(k.padEnd(10),ma[k].toExponential(6),mb[k].toExponential(6),((mb[k]/ma[k]-1)*100).toFixed(3)+'%');
const SA=C.computeStats(A),SB=C.computeStats(B);const rows=[];for(const id of Object.keys(SA.info)){const x=SA.info[id]?.inHull,y=SB.info[id]?.inHull;if(x!=null&&Math.abs(x-(y??0))>1e-9){const p=A.parts.find(q=>q.id==id);rows.push([id,p?.k,p?.label,+(x).toFixed(3),+(y??NaN).toFixed(3),+C.partVolume(p).toFixed(0)]);}}
rows.sort((a,b)=>Math.abs(b[3]-b[4])*b[5]-Math.abs(a[3]-a[4])*a[5]);console.log('inHull diffs',rows.length);for(const r of rows.slice(0,15))console.log(JSON.stringify(r));
