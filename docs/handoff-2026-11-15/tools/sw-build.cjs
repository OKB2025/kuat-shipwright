const path=require('path'),root=path.resolve(process.argv[2]),key=process.argv[3];const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const t0=Date.now();const s=C.buildDesign(key);const S=C.computeStats(s);console.log(key,'built in',((Date.now()-t0)/1000).toFixed(0),'s parts',s.parts.length);
const r=s._shipThermalRefit||{};console.log('refit requested',r.requestedCapacityW?.toExponential(3),'capacity',r.capacityW?.toExponential(3),'added',r.addedParts?.length,'vol',r.installedVolumeM3?.toFixed(0));
for(const p of s.parts.filter(p=>p.k==='hdis'))console.log(' hdis',p.id,JSON.stringify(p.c.map(v=>+v.toFixed(0))),'d',+p.d.toFixed(1),p.room?JSON.stringify(p.room.map(v=>+v.toFixed(0))):'',(p.label||'').slice(-10));
for(const [k,v] of Object.entries(S.heat.presets))console.log(k,'gen',v.gen.toExponential(3),'cap',v.cap.toExponential(3),'shortfall',(v.shortfallW||0).toExponential(2));
console.log('mass',S.mass.toExponential(4),'accelG',(S.accel/9.80665||0).toFixed(1),'cost',S.cost?.toExponential?.(3),'warnings',(S.warnings||[]).map(w=>w.text.slice(0,50)).join(' | '));
