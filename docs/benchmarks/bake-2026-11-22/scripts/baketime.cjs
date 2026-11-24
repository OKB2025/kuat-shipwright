const fs=require('fs'),path=require('path'),zlib=require('zlib');const root=process.cwd();const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const k=process.argv[2]||'imperial';const b=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));
let t=Date.now();const lap=m=>{const n=Date.now();console.log(m,n-t,'ms');t=n;};
C.syncCompartments(b);lap('sync');const r=C.bakeAllCuts(b);lap('bake '+JSON.stringify({ok:r.ok,parts:r.parts,failed:r.failed}));
const p=b.parts.find(p=>p.bakedMesh);console.log('bakedMesh v',p?.bakedMesh.v.length,'f',p?.bakedMesh.f.length);
C.syncCompartments(b);lap('sync after');C.remount(b,{keepFitPose:true});lap('remount');C.syncCompartments(b);lap('sync2');const S=C.computeStats(b);lap('stats');console.log('mass',S.mass,'launch',S.launch,'warn',(S.warnings||[]).map(w=>w.text||w).filter(x=>/閉じ|多面体/.test(x)));
