// The structures' material by the accumulated union (as before) and by neighbours alone (structuralMaterialLocal): each structure's volume, the total, and the time. read-only.
// usage: node compare.cjs <root> <example key or path to a design .json> [...]
const fs=require('fs'),zlib=require('zlib'),path=require('path');const root=path.resolve(process.argv[2]),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const read=k=>{if(k.endsWith('.json'))return JSON.parse(fs.readFileSync(k,'utf8'));return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz'))));};
const load=k=>{const j=read(k),s=C.deserialize(j.design||j);C.remount(s,{keepFitPose:true});C.syncCompartments(s);return C.surfaceWorkingShip?C.surfaceWorkingShip(s):s;};
console.log('design | structures | path used | old s | new s | total old m3 | total new m3 | relative difference of the total | largest difference of one structure (m3; relative to its own volume) | structures over 1e-6 relative');
for(const k of process.argv.slice(3)){try{
 C.STRUCTURAL_LOCAL.enabled=false;const a=load(k);let t=Date.now();const A=C.structuralMaterial(a);const ta=(Date.now()-t)/1000;
 C.STRUCTURAL_LOCAL.enabled=true;const b=load(k);t=Date.now();const B=C.structuralMaterial(b);const tb=(Date.now()-t)/1000;
 let worst=0,worstRel=0,over=0;for(const [id,v] of A.envelopeVolumes){const w=B.envelopeVolumes.get(id),d=Math.abs(v-w),rel=d/Math.max(1e-9,Math.max(v,w));if(d>worst){worst=d;worstRel=rel;}if(rel>1e-6&&d>1e-9)over++;}
 console.log([path.basename(k),A.entries.length,B.local?'neighbours':'accumulated (unchanged)',ta.toFixed(1),tb.toFixed(1),A.extension.toPrecision(10),B.extension.toPrecision(10),(Math.abs(A.extension-B.extension)/Math.max(1e-12,A.extension)).toExponential(2),worst.toExponential(2)+'; '+worstRel.toExponential(2),over].join(' | '));
}catch(e){console.log(k+' | ERROR '+String(e.stack||e).slice(0,300));}}
