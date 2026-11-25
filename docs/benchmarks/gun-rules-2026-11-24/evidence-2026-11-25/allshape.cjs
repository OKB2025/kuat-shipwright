// Every saved example against main's: the hull record, every structure by shape (ids ignored) and every gun seat, plus the
// count of interior parts by kind. usage: node allshape.cjs <mainRoot> <candidateRoot>
const fs=require('fs'),zlib=require('zlib'),path=require('path');const [A,B]=process.argv.slice(2),L=(r,k)=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(r,'data/examples',k,'design.json.gz'))));
const sig=p=>JSON.stringify([p.k,p.form,p.c,p.s,p.d,p.outline,p.taper,p.pitch,p.yaw,p.roll,p.corner,p.label,p.mesh,p.skinAsset,p.skinSize]),seat=f=>JSON.stringify([f.k,f.p,f.a,f.n,f.assetYaw||0,f.assetPitch||0,f.scale||1,f.base||0,f.ped||0,f.tilt]);
const canon=o=>JSON.stringify(o,(k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(x=>[x,v[x]])):v);
const multi=(x,y)=>{const m=new Map();for(const v of x)m.set(v,(m.get(v)||0)+1);for(const v of y)m.set(v,(m.get(v)||0)-1);let a=0,b=0;for(const n of m.values()){if(n>0)a+=n;else b-=n;}return [a,b];};
const kinds=j=>{const c={};for(const p of j.parts)if(p.k!=='struct')c[p.k]=(c[p.k]||0)+1;return c;};
let bad=0;const rows=[];
for(const k of fs.readdirSync(path.join(B,'data/examples')).filter(k=>fs.existsSync(path.join(B,'data/examples',k,'design.json.gz'))).sort()){
 if(!fs.existsSync(path.join(A,'data/examples',k,'design.json.gz'))){rows.push(k+' | not in main');continue;}
 const a=L(A,k),b=L(B,k),hull=canon(a.hull)===canon(b.hull),cuts=canon([a.cuts,a.subs,a.trenches,a.solidCuts])===canon([b.cuts,b.subs,b.trenches,b.solidCuts]),st=multi(a.parts.filter(p=>p.k==='struct').map(sig),b.parts.filter(p=>p.k==='struct').map(sig)),gu=multi(a.fits.map(seat),b.fits.map(seat));
 const ka=kinds(a),kb=kinds(b),dk=[...new Set([...Object.keys(ka),...Object.keys(kb)])].filter(x=>(ka[x]||0)!==(kb[x]||0)).map(x=>x+' '+(ka[x]||0)+'→'+(kb[x]||0)).join(', ');
 const same=hull&&cuts&&!st[0]&&!st[1]&&!gu[0]&&!gu[1];if(!same)bad++;
 rows.push([k,hull?'same':'DIFFERS',cuts?'same':'DIFFERS',a.parts.filter(p=>p.k==='struct').length,st[0]+'/'+st[1],a.fits.length,gu[0]+'/'+gu[1],dk||'—'].join(' | '));
}
console.log('example | hull record | cuts, subs, trenches, solid cuts | structures | structures only in main/candidate | guns | guns only in main/candidate | interior parts whose count changed');
console.log(rows.join('\n'));console.log(bad+' examples differ in hull, cuts, structures or gun seats');
