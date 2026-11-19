const fs=require('fs'),vm=require('vm'),zlib=require('zlib'),cp=require('child_process');
const cx=vm.createContext({console:{log(){},warn(){},error(){}}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync('/home/user/kuat-shipwright/'+f,'utf8'),cx);const C=vm.runInContext('Core',cx);
const find=o=>{if(o&&typeof o==='object'){if(o.fits&&o.parts)return o;for(const v of Object.values(o)){const r=find(v);if(r)return r;}}return null;};
const strip=p=>{const q={...p};delete q.id;delete q.host;return JSON.stringify(q,Object.keys(q).sort());};
const INNER=new Set(['landingGear','hdis','gen','reactor','engine']);
for(const k of ['craft_xwing','craft_btlb','craft_tie_sa']){
 const old=find(JSON.parse(zlib.gunzipSync(cp.execSync(`git -C /home/user/kuat-shipwright show 9bcbd02:data/examples/${k}/design.json.gz`,{maxBuffer:1e9})))),now=find(JSON.parse(zlib.gunzipSync(fs.readFileSync(`/home/user/kuat-shipwright/data/examples/${k}/design.json.gz`))));
 const shape=d=>d.parts.filter(p=>C.isShapePart?C.isShapePart(p):!INNER.has(p.k)).map(strip).sort(),kinds=d=>{const m={};for(const p of d.parts)m[p.k]=(m[p.k]||0)+1;return m;};
 const a=shape(old),b=shape(now),same=JSON.stringify(a)===JSON.stringify(b);
 console.log(`## ${k}`);console.log('shape parts (id and host ignored): before',a.length,'after',b.length,'identical:',same);
 if(!same){const A=new Set(a),B=new Set(b);for(const x of b)if(!A.has(x))console.log('  only after:',x.slice(0,300));for(const x of a)if(!B.has(x))console.log('  only before:',x.slice(0,300));}
 console.log('fits identical (ids ignored):',JSON.stringify(old.fits.map(strip).sort())===JSON.stringify(now.fits.map(strip).sort()),'| hatches',JSON.stringify(old.hatches||[])===JSON.stringify(now.hatches||[]),'| hull identical:',JSON.stringify(old.hull)===JSON.stringify(now.hull));
 console.log('part kinds before',JSON.stringify(kinds(old)));console.log('part kinds after ',JSON.stringify(kinds(now)));
 const lk=d=>{const m={};for(const l of d.links||[])m[l.kind]=(m[l.kind]||0)+1;return m;};console.log('links before',JSON.stringify(lk(old)),'after',JSON.stringify(lk(now)));
 const st=d=>{const s=C.deserialize?C.deserialize(JSON.stringify(d)):d,S=C.computeStats(s),b=C.shipBounds?C.shipBounds(s):null;return {mass:+S.mass.toFixed(3),dims:S.dims?.map(v=>+v.toFixed(3)),bounds:b&&b.map(v=>+v.toFixed(3)),g:S.G&&+S.G.toFixed(1),landingSupport:S.craftSystems?.landingSupport&&+S.craftSystems.landingSupport.toFixed(2),warnings:(S.info?.warnings||S.warnings||[]).length,errors:(S.info?.errors||S.errors||[]).length};};
 try{console.log('stats before',JSON.stringify(st(old)));console.log('stats after ',JSON.stringify(st(now)));}catch(e){console.log('stats failed:',e.message);}
 try{const rebuilt=C.buildDesign(k),r=JSON.parse(C.serialize(rebuilt));console.log('buildDesign gives the stored design (parts, ids included):',JSON.stringify(find(r).parts)===JSON.stringify(now.parts));}catch(e){console.log('rebuild compare failed:',e.message);}
}
