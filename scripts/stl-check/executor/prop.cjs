const path=require('path'),fs=require('fs'),root=process.argv[2],out=process.argv[3];const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const s=C.buildDesign('executor');C.syncCompartments(s);C.remount(s);C.syncCompartments(s);const S=C.computeStats(s);
const eng=s.parts.filter(p=>p.k==='engine').map(p=>{const sp=C.resolveEngineSpec(p,s);return {c:p.c.map(Math.round),d:Math.round(p.d),in:sp.ratedInputW,avail:sp.availableInputW,src:sp.sourceIds,WpN:sp.wattsPerNewton,T:sp.ratedThrustN,eff:Math.round(sp.effectiveMachineryVolumeM3)};});
const src=s.parts.filter(p=>['gen','aux'].includes(p.k)).map(p=>({k:p.k,label:p.label,c:p.c.map(Math.round),vol:Math.round(C.partVolume(p)),d:p.d,room:p.room}));
fs.writeFileSync(out,JSON.stringify({mass:S.mass,power:S.power,rated:S.ratedAccelMps2,thrust:S.propulsion?.ratedThrustN,Vgen:S.Vgen,eng,src},null,1));console.log('ok');
