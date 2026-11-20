const vm=require('vm'),fs=require('fs'),zlib=require('zlib'),crypto=require('crypto'),root='/home/user/kuat-shipwright',out=process.argv[2];
const cx=vm.createContext({console:{log(){},warn(){},error(){}}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(root+'/'+f,'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),r=v=>typeof v==='number'?+v.toPrecision(5):v;
const srcRaw=zlib.gunzipSync(fs.readFileSync(root+'/assets/source/mandator2-user-exterior/mandator2-user-exterior.json.gz')),src=JSON.parse(srcRaw);
const desRaw=zlib.gunzipSync(fs.readFileSync(root+'/data/examples/mandator2/design.json.gz')),des=JSON.parse(desRaw);
const R={sourceSha256:sha(srcRaw),designJsonSha256:sha(desRaw),coreSha256:sha(fs.readFileSync(root+'/js/core.js'))};
// 1. constant in core.js equals source file
const ext=vm.runInContext('typeof MAN2_EXTERIOR!=="undefined"?JSON.stringify(MAN2_EXTERIOR):null',cx);
R.constantAvailable=!!ext;
const norm=o=>JSON.stringify(o);
if(ext){const k=JSON.parse(ext);R.constantHullEqualsSource=norm(k.hull)===norm(src.hull);R.constantPartsEqualSource=norm(k.parts)===norm(src.parts);R.constantFitsEqualSource=norm(k.fits)===norm(src.fits);R.constantKeys=Object.keys(k);R.sourceKeys=Object.keys(src);}
// 2. stored design keeps every exterior part unchanged
const key=p=>norm(p);const srcStruct=src.parts.filter(p=>p.k==='struct'),desStruct=des.parts.filter(p=>p.k==='struct');
R.sourceParts=src.parts.length;R.sourceStruct=srcStruct.length;R.designStruct=desStruct.length;
const byId=new Map(des.parts.map(p=>[p.id,p]));let same=0,diff=[];for(const p of src.parts){const q=byId.get(p.id);if(q&&key(q)===key(p))same++;else diff.push({id:p.id,k:p.k,missing:!q,keys:q?Object.keys({...p,...q}).filter(a=>norm(p[a])!==norm(q[a])):null});}
R.sourcePartsIdenticalInDesign=same;R.sourcePartsDiffering=diff.length;R.diffSample=diff.slice(0,12);const dk={};for(const d of diff)for(const a of d.keys||['missing'])dk[a]=(dk[a]||0)+1;R.diffKeys=dk;
const srcIds=new Set(src.parts.map(p=>p.id));const added=des.parts.filter(p=>!srcIds.has(p.id)),ak={};for(const p of added)ak[p.k]=(ak[p.k]||0)+1;R.addedPartsByKind=ak;R.addedStruct=added.filter(p=>p.k==='struct').length;
R.hullEqual=norm(des.hull)===norm(src.hull);R.hullDiffKeys=Object.keys({...src.hull,...des.hull}).filter(a=>norm(src.hull[a])!==norm(des.hull[a]));
const fk={};for(const f of des.fits||[])fk[f.k]=(fk[f.k]||0)+1;R.fitsByKind=fk;R.sourceFits=(src.fits||[]).length;R.cuts=(des.cuts||[]).length;R.trenches=(des.trenches||[]).length;
fs.writeFileSync(out,JSON.stringify(R,null,1));
const t=Date.now();const ship=C.deserialize(des),st=C.computeStats(ship);
R.statsSeconds=(Date.now()-t)/1000;R.stats={mass:r(st.mass),accelG:r(st.accelG),ratedG:r(st.ratedAccelMps2/9.80665),power:r(st.power),volleyTT:r(st.allGunVolleyTT),floating:st.floating,floatFits:st.floatFits,clashFits:st.clashFits,overlap:st.overlap,unconnected:st.unconnected,deadHatch:st.deadHatch,lift:r(st.craftSystems?.landingSupport),managed:st.craftSystems?.managed,accuracy:r(st.accuracy),turn:r(st.turn),L:r(st.dims?.L),W:r(st.dims?.W),H:r(st.dims?.H)};
R.warnings=st.warnings.map(w=>({lv:w.lv,code:w.code||'',text:w.text}));R.heat={};for(const k of ['cruise','combat','max']){const p=st.heat.presets[k];R.heat[k]={name:p.name,gen:r(p.gen),out:r(p.out),shortfallW:r(p.shortfallW)};}
const eng=ship.parts.filter(p=>p.k==='engine'),cores=ship.parts.filter(p=>p.k==='engineCore');R.engines=eng.map(p=>({id:p.id,c:p.c.map(r)}));R.engineCores=cores.map(p=>({id:p.id,c:p.c.map(r),inHull:r(st.info[p.id]?.inHull)}));
fs.writeFileSync(out,JSON.stringify(R,null,1));console.log('done');
