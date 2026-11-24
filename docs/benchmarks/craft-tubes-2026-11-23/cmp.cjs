const fs=require('fs'),path=require('path'),zlib=require('zlib');const root=process.argv[2];const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const out={};for(const k of process.argv.slice(3)){const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));C.syncCompartments(s);C.remount(s,{keepFitPose:true});C.syncCompartments(s);const S=C.computeStats(s);
out[k]={mass:+S.mass.toFixed(3),accelG:+S.accelG.toFixed(1),cost:Math.round(S.cost||S.price||0),stations:C.craftStations(s,S).map(x=>x.fit+'x'+x.count).join('+'),load:C.craftOrdnance(s).map(x=>x.kind+x.n).join('+'),warn:(S.warnings||[]).length};}
console.log(JSON.stringify(out));
