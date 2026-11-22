// HEAD code on base-design file vs base code on same file (publicJSON path like stats-diff)
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const [root,file,key]=process.argv.slice(2);const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const w=JSON.parse(C.publicJSON(C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(file))))));const S=C.computeStats(w);
const rv=w.parts.filter(p=>/reactor|gen/i.test(p.k)).map(p=>p.k+':'+(S.info?.[p.id]?.vol??S.info?.[p.id]?.V??'?'));
console.log(key,JSON.stringify({ratedAccel:+S.ratedAccelMps2.toFixed(1),Vgen:+S.Vgen.toFixed(4),kinds:[...new Set(w.parts.map(p=>p.k))].join(',')}));
