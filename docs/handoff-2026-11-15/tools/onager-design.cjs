const fs=require('fs'),zlib=require('zlib'),path=require('path');const root=path.resolve(process.argv[2]),key=process.argv[3]||'onager';
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))).toString('utf8'));const s=C.deserialize(raw.design||raw.ship||raw);const S=C.computeStats(s);
console.log('hull',JSON.stringify({L:s.hull.L,W:s.hull.W,H:s.hull.H}),'parts',s.parts.length,'fits',(s.fits||[]).length);
const kinds={};for(const p of s.parts)kinds[p.k]=(kinds[p.k]||0)+1;console.log('kinds',JSON.stringify(kinds));
for(const p of s.parts)if(/sw|super|beam|hdis|wing|dissip|conv/i.test(p.k))console.log(' part',p.id,p.k,p.form||'',JSON.stringify(p.c?.map(v=>+v.toFixed(1))),JSON.stringify(p.s?.map(v=>+v.toFixed(1))),p.d??'',(p.label||p.name||'').slice(0,30));
console.log('heat keys',Object.keys(S.heat||{}).join(','));
const H=S.heat||{};for(const k of Object.keys(H)){const v=H[k];if(v&&typeof v==='object'&&!Array.isArray(v))console.log(' ',k,JSON.stringify(v).slice(0,400));else if(typeof v!=='object')console.log(' ',k,v);}
console.log('S keys heat-ish',Object.keys(S).filter(k=>/heat|dissip|cool|sw|super/i.test(k)).map(k=>k+'='+JSON.stringify(S[k])?.slice(0,120)).join('\n '));
console.log('warnings',(S.warnings||[]).map(w=>w.text.slice(0,90)).join(' | '));
console.log('--- presets');for(const [k,v] of Object.entries(S.heat.presets))console.log(k,v.name,'gen',v.gen.toExponential(3),'cap',v.cap.toExponential(3),'used',v.used.toExponential(3),'shortfall',(v.shortfallW||0).toExponential(3),'limitS',v.limitSeconds,'stored',v.stored);
console.log('--- superweapons');for(const w of S.superweapons||[])console.log(JSON.stringify(w).slice(0,900));
console.log('--- sw source rows');for(const r of S.heat.net.src.filter(r=>r.k==='sw'))console.log(JSON.stringify(r).slice(0,400));
console.log('--- dis');for(const d of S.heat.net.dis)console.log(JSON.stringify(d).slice(0,260));
const sb=s.parts.filter(p=>p.k==='sbeam');for(const p of sb)console.log('sbeam part',JSON.stringify(p).slice(0,500));
console.log('PARTS.sbeam',JSON.stringify(C.PARTS.sbeam).slice(0,700));console.log('PARTS.hdis',JSON.stringify(C.PARTS.hdis).slice(0,500));
