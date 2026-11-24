const fs=require('fs'),path=require('path'),zlib=require('zlib');const root=process.argv[2];const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const k=process.argv[3];const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));C.syncCompartments(s);C.remount(s,{keepFitPose:true});
console.log(JSON.stringify(s.fits.filter(f=>C.FITS[f.k]?.cat==='w').map(f=>[f.id,f.k,+(f.base||0).toFixed(4),!!f.float,!!f.supportLift])));
