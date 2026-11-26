const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
console.log('exp',Math.log(C.SHIELD_CURVE.refScale)/Math.log(C.SHIELD_CURVE.refGenV/C.SHIELD_CURVE.fullGenV),JSON.stringify(C.SHIELD_CURVE));
const rows=[];for(const [k,d] of Object.entries(F.designs)){const p=d.p;if(!p)continue;const V=C.shieldGeneratorVolume(p),sc=C.fieldScale(p),raw=p.shieldBuffer??0,D=p.D||0;
 rows.push({k,len:p.len,V,sc,raw,sh:raw*sc,D,regen:D*sc,alpha:p.alphaTot??p.alpha,gun:p.gunBest,hull:p.hp??p.hull});}
rows.sort((a,b)=>a.V-b.V);
console.log('key | len m | gen m3 | scale | raw buffer TT | shield TT | D TT/s | D*scale TT/s | keys');
for(const r of rows)console.log([r.k,r.len?.toFixed(0),r.V.toFixed(1),r.sc.toExponential(3),r.raw.toExponential(3),r.sh.toExponential(3),r.D.toExponential(3),r.regen.toExponential(3)].join(' | '));
console.log(Object.keys(F.designs.cr90.p).join(','));
