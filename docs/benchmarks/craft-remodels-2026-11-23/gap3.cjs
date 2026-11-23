const fs=require('fs'),path=require('path');const root='/home/user/kuat-shipwright';const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const k=process.argv[2];
for(const y of [1.99,1.98,1.9785,1.978,1.975,1.97]){const raw=JSON.parse(fs.readFileSync(k,'utf8'));raw.fits.find(f=>f.k==='cpylon').p[1]=y;const s=C.deserialize(raw);C.syncCompartments(s);C.remount(s,{keepFitPose:true});const f=s.fits.find(f=>f.k==='cpylon');console.log('y',y,'float',!!f.float,'host',f.host,'p',f.p.map(v=>+v.toFixed(4)));}
// what does the solver give
const raw=JSON.parse(fs.readFileSync(k,'utf8'));const s=C.deserialize(raw);C.syncCompartments(s);C.remount(s,{keepFitPose:true});const f=s.fits.find(f=>f.k==='cpylon');
try{const r=C.solveFitPlacement(s,f,{});console.log('solve',JSON.stringify(r,(kk,v)=>kk&&kk[0]==='_'?undefined:v).slice(0,600));}catch(e){console.log('solve err',e.message);}
try{const t=C.fitSpec(f);console.log('spec r',t&&t.r,'h',t&&t.h);}catch(e){}
