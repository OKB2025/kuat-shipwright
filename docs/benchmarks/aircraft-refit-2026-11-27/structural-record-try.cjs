const fs=require('fs'),path=require('path');const root=path.resolve(process.argv[2]),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const raw=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));const load=o=>{const s=C.deserialize(JSON.parse(JSON.stringify(o)));C.remount(s,{keepFitPose:true});C.syncCompartments(s);return s;};
const pick=S=>JSON.stringify([S.mass,S.cost,S.volume,S.crew,S.hp,S.accelG,S.structVolume,S.costBy]);
let t=Date.now();const a=load(raw.design||raw),A=C.computeStats(a);const ta=(Date.now()-t)/1000;const saved=JSON.parse(JSON.stringify(C.serialize(a)));
console.log('first calculation',ta.toFixed(1),'s; record in the save:',!!saved.structuralMaterial,saved.structuralMaterial&&saved.structuralMaterial.steps.length,'steps, key',saved.structuralMaterial?.key,'; bytes',JSON.stringify(saved.structuralMaterial||{}).length);
t=Date.now();const b=load(saved),B=C.computeStats(b);console.log('reloaded, first calculation',((Date.now()-t)/1000).toFixed(1),'s; same figures:',pick(A)===pick(B));
// a changed structure: the record is not used
const c=JSON.parse(JSON.stringify(saved));const st=c.parts.find(p=>p.k==='struct'&&Array.isArray(p.s));st.s=st.s.map(v=>v*1.01);t=Date.now();const d=load(c),D=C.computeStats(d);const fresh=load((()=>{const x=JSON.parse(JSON.stringify(c));delete x.structuralMaterial;return x;})()),F=C.computeStats(fresh);
console.log('one structure enlarged by 1%:',((Date.now()-t)/1000).toFixed(1),'s; same as a design without the record:',pick(D)===pick(F),'; mass',D.mass,'vs before',A.mass);
// a forged record with the right key length but wrong numbers is still only used if the key matches the geometry: a wrong key is ignored
const e=JSON.parse(JSON.stringify(saved));e.structuralMaterial.key='1:1:zzz';const E=C.computeStats(load(e));console.log('wrong key ignored:',pick(E)===pick(A));
