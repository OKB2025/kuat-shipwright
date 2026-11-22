// In-memory host of fittings after load: stock MC30c vs a copy whose legacy host names a retired habitation compartment / a missing id.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),root=process.argv[2],{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const j=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/mc30c/design.json.gz'))));const ids=new Set(j.parts.map(p=>p.id));
const a=C.deserialize(JSON.parse(JSON.stringify(j)));const f108=a.fits.find(f=>f.id===108);
const k=JSON.parse(JSON.stringify(j));k.fits.find(f=>f.id===108).host=5555;const b=C.deserialize(k);
console.log(JSON.stringify({stockHost:f108.host??null,stockHostIsPart:ids.has(f108.host),missingIdHost:b.fits.find(f=>f.id===108).host??null,hostCounts:{stock:a.fits.filter(f=>f.host!=null).length,total:a.fits.length}}));
