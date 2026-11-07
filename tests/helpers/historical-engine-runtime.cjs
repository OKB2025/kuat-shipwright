// Verify the earlier nine-ship runtime revision as an immutable historical
// capsule. Later factory changes must not relabel its real Core or catalogue.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const V=require('../../scripts/verify-engine-runtime-revision.cjs');
const ARTIFACT=V.constants.ARTIFACT,FLEET_SNAPSHOT='assets/source/engine-runtime-revisions/table-craft-thermal-fleet.js.gz';
const EXPECTED=Object.freeze({record:'cb92f50d5b9c1030e38e698985e91a7b2040e5ef18eff15dd4fceecbd97bcc7e',verifier:'f214314bf4100cfe7d9959cc70aa46ab348c4d3de3ed687c809d010ec47aa52e',catalogue:'62bb8b28f13410844ac992fa322d4d89cb1563adffb3854685de47b870e835da'});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function capsule(root){
 const read=relative=>fs.readFileSync(path.join(root,relative)),recordBytes=read(ARTIFACT),record=JSON.parse(recordBytes);
 assert.equal(sha(recordBytes),EXPECTED.record,'the historical revision record cannot be relabelled');
 assert.equal(sha(read('scripts/verify-engine-runtime-revision.cjs')),EXPECTED.verifier,'the original fail-closed verifier is retained');
 const packedFleet=read(FLEET_SNAPSHOT),fleet=zlib.gunzipSync(packedFleet);
 assert.equal(sha(fleet),EXPECTED.catalogue,'the capsule requires the actual earlier catalogue bytes');
 assert.equal(sha(fleet),record.generation.catalogueSha256,'archived catalogue matches the original revision record');
 return {record,recordBytes,fleet,packedFleet,runtime:zlib.gunzipSync(read(record.runtime.snapshot.path))};
}
function withHistoricalEngineRuntime(root,run){
 const saved=capsule(root),directory=fs.mkdtempSync(path.join(os.tmpdir(),'kuat-historical-engine-runtime-'));
 try{
  const write=(relative,bytes)=>{const destination=path.join(directory,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);};
  fs.symlinkSync(path.join(root,'scripts'),path.join(directory,'scripts'),'dir');
  const record=saved.record,files=['data/reference.js','data/imperial2.js',ARTIFACT,record.generation.report.path,record.generation.coreSnapshot.path,record.runtime.snapshot.path,...Object.values(record.generation.scriptSnapshots)];
  for(const relative of new Set(files))write(relative,fs.readFileSync(path.join(root,relative)));
  write('data/fleet.js',saved.fleet);write('js/core.js',saved.runtime);write(FLEET_SNAPSHOT,saved.packedFleet);
  return run(directory);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}
function verifyHistoricalEngineRuntime(root){
 const proof=withHistoricalEngineRuntime(root,directory=>V.verifyRuntimeRevision(directory));
 return {...proof,historical:true,currentRuntimeClaimed:false,capsule:{recordSha256:EXPECTED.record,verifierSha256:EXPECTED.verifier,catalogueSha256:EXPECTED.catalogue,fleetSnapshot:FLEET_SNAPSHOT},scope:'The exact archived Core861 generation and Core29 runtime revision are verified in isolation. This proves their history, not the current runtime or a fresh construction on later source.'};
}
module.exports={verifyHistoricalEngineRuntime,withHistoricalEngineRuntime,constants:Object.freeze({ARTIFACT,FLEET_SNAPSHOT,EXPECTED})};
