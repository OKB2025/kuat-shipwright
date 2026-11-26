// The same design's performance figures worked out three times in a row: the time of each, and whether the figures are the same. read-only.
// usage: node stats-repeat.cjs <root> <example key>
const fs=require('fs'),zlib=require('zlib'),path=require('path');const root=path.resolve(process.argv[2]),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const k=process.argv[3],j=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz'))));const s=C.deserialize(j.design||j);C.remount(s,{keepFitPose:true});C.syncCompartments(s);
const pick=S=>JSON.stringify([S.mass,S.cost,S.volume,S.power,S.crew,S.hp,S.accelG,S.structVolume,S.costBy]);let first=null;
for(let i=0;i<3;i++){const t=Date.now(),S=C.computeStats(s),p=pick(S);if(first==null)first=p;console.log(k,'run',i+1,((Date.now()-t)/1000).toFixed(1)+' s','mass',S.mass,'cost',S.cost,p===first?'same figures':'FIGURES DIFFER');}
