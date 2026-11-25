// The GR-75 example against main's: every structure and gun by shape, ids ignored. usage: node gr75-vs-main.cjs <mainRoot> <candidateRoot>
const fs=require('fs'),zlib=require('zlib'),path=require('path');const [A,B]=process.argv.slice(2),L=r=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(r,'data/examples/gr75/design.json.gz'))));
const a=L(A),b=L(B),sig=p=>JSON.stringify([p.k,p.form,p.c,p.s,p.d,p.outline,p.taper,p.pitch,p.yaw,p.roll,p.corner,p.label]),seat=f=>JSON.stringify([f.k,f.p,f.a,f.n,f.assetYaw||0,f.base||0,f.ped||0,f.tilt]);
const cmp=(x,y,name)=>{const X=x.map(v=>v).sort(),Y=y.map(v=>v).sort(),onlyX=X.filter(v=>!Y.includes(v)),onlyY=Y.filter(v=>!X.includes(v));console.log(name+': main '+X.length+', candidate '+Y.length+', only in main '+onlyX.length+', only in candidate '+onlyY.length);};
const canon=o=>JSON.stringify(Object.keys(o).sort().map(k=>[k,o[k]]));console.log('hull record identical (key order ignored): '+(canon(a.hull)===canon(b.hull)));
cmp(a.parts.filter(p=>p.k==='struct').map(sig),b.parts.filter(p=>p.k==='struct').map(sig),'structures (kind, form, centre, size, outline, taper, angles, corner, label)');
cmp(a.fits.map(seat),b.fits.map(seat),'guns (kind, position, axis, normal, yaw, base, pedestal, tilt)');
const kinds=j=>{const c={};for(const p of j.parts)if(p.k!=='struct')c[p.k]=(c[p.k]||0)+1;return JSON.stringify(c);};console.log('interior parts main: '+kinds(a));console.log('interior parts candidate: '+kinds(b));
