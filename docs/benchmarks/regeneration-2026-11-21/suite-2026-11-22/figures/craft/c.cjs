const fs=require('fs'),path=require('path'),zlib=require('zlib');
const root=process.argv[2],key=process.argv[3];
const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const f=s=>{const S=C.computeStats(s);return {ratedAccel:+S.ratedAccelMps2.toFixed(1),MGLT:+S.MGLT.toFixed(2),Vgen:+S.Vgen.toFixed(4),mass:+S.mass.toFixed(3)};};
const st=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));
const b=C.buildDesign(key);C.syncCompartments(b);const b0=f(b);C.remount(b);C.syncCompartments(b);
console.log(key,JSON.stringify({stored:f(st),build:b0,buildRemount:f(b)}));
