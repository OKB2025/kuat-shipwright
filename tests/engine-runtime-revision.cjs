const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const H=require('./helpers/historical-engine-runtime.cjs');
const V=require('../scripts/verify-engine-runtime-revision.cjs'),root=path.resolve(__dirname,'..'),artifactPath=V.constants.ARTIFACT,record=JSON.parse(fs.readFileSync(path.join(root,artifactPath))),sha=v=>crypto.createHash('sha256').update(v).digest('hex'),copy=v=>JSON.parse(JSON.stringify(v)),generation=zlib.gunzipSync(fs.readFileSync(path.join(root,record.generation.coreSnapshot.path))).toString(),runtime=zlib.gunzipSync(fs.readFileSync(path.join(root,record.runtime.snapshot.path))).toString();
const fixture=run=>H.withHistoricalEngineRuntime(root,run);
function boundary(code,review=record.reviewedFunctions){return V.analyzeRuntimeBoundary(generation,code,review);}
test('the archived reviewed runtime verifies independently while all nine source hashes remain the authentic generation861',()=>fixture(dir=>{
 const proof=V.verifyRuntimeRevision(dir);assert.equal(proof.passed,true);assert.equal(proof.generationSources['js/core.js'],V.constants.GENERATION_CORE);assert.equal(proof.runtimeSources['js/core.js'],sha(runtime));assert.notEqual(proof.runtimeCoreSha256,proof.generationCoreSha256);assert.equal(proof.generationReportSha256,V.constants.GENERATION_REPORT);assert.deepEqual(proof.dependencies.runtimeReads,['designInfo']);assert.equal(proof.probes.initializationPreservesCore,true);assert.equal(proof.probes.lazyResolutionPreservesCore,true);assert.equal(proof.probes.lazyResolutionFactoryCalls,0);assert.equal(proof.probes.designInfoExternalCalls,0);
}));
test('the historical capsule does not substitute current runtime or catalogue bytes for its earlier sources',()=>{
 fixture(dir=>{fs.writeFileSync(path.join(dir,'js/core.js'),'throw Error("later source is not part of the old capsule");');fs.writeFileSync(path.join(dir,'data/fleet.js'),'throw Error("later catalogue is not part of the old capsule");');const proof=H.verifyHistoricalEngineRuntime(dir);assert.equal(proof.historical,true);assert.equal(proof.currentRuntimeClaimed,false);assert.equal(proof.capsule.catalogueSha256,H.constants.EXPECTED.catalogue);assert.equal(proof.runtimeCoreSha256,record.runtime.coreSha256);});
 fixture(dir=>{const file=path.join(dir,H.constants.FLEET_SNAPSHOT),fleet=zlib.gunzipSync(fs.readFileSync(file));fs.writeFileSync(file,zlib.gzipSync(Buffer.concat([fleet,Buffer.from('\n// altered history\n')])));assert.throws(()=>H.verifyHistoricalEngineRuntime(dir),/actual earlier catalogue bytes/);});
});
test('physical prefix, unchanged designInfo and its captured constant cannot be waived by a runtime hash',()=>{
 assert.throws(()=>boundary(runtime.replace('const MGLT={k:2.57','const MGLT={k:2.58')),/physical generation prefix/);
 assert.throws(()=>boundary(runtime.replace('capital: p.len >= CAPITAL_LENGTH','capital: p.len > CAPITAL_LENGTH')),/designInfo changed/);
 assert.throws(()=>boundary(runtime.replace('const CAPITAL_LENGTH = 900','const CAPITAL_LENGTH = 901')),/CAPITAL_LENGTH/);
});
test('BOM initialization and other runtime functions are outside the exact approved scope',()=>{
 assert.throws(()=>boundary(runtime.replace('dims[0]*dims[1]*dims[2]*.18','dims[0]*dims[1]*dims[2]*.19')),/estimatedCraftBOM/);
 assert.throws(()=>boundary(runtime.replace('Math.round(people * .4','Math.round(people * .41')),/unreviewed executable/);
 assert.throws(()=>boundary(runtime.replace('function craftPowerOf(c){','estimatedCraftRuntime(CRAFT.lambda);\nfunction craftPowerOf(c){')),/unreviewed executable/);
});
test('even a rehashed listed function cannot change the native-backed/priced protected branches',()=>{
 const code=runtime.replace('if(!c)return null;if(c.powerProfile)','if(!c)return undefined;if(c.powerProfile)');assert.notEqual(code,runtime);const changed=V.reviewedFunctionChanges(generation,code);assert.throws(()=>boundary(code,changed),/protected blueprint\/priced branch/);
});
test('unreviewed function bytes and a global suffix change are rejected',()=>{
 const code=runtime.replace('const margin=1.15','const margin=1.16');
 // The current helper declares margin alongside thermal; keep a precise
 // alternate anchor so this negative cannot pass by editing nothing.
 const actual=code===runtime?runtime.replace('margin=1.15,powerK=','margin=1.16,powerK='):code;assert.notEqual(actual,runtime);assert.throws(()=>boundary(actual),/exact reviewed bytes/);
 assert.throws(()=>boundary(runtime+'\nCore.runtimeMutation=true;\n'),/global suffix changed/);
});
test('a helper that mutates shared Core lazily is rejected beyond the static source boundary',()=>{
 const code=runtime.replace('function estimatedCraftRuntime(c){','function estimatedCraftRuntime(c){C.nozzleThrust=()=>0;');const review=V.reviewedFunctionChanges(generation,code);assert.equal(boundary(code,review).outsideReviewedFunctionsExecutableTokensIdentical,true,'the extra dynamic check has a distinct purpose');assert.throws(()=>V.dependencyProbes(root,generation,code),/lazy compatibility functions mutated shared Core/);
});
test('generation-script authority remains the original report even if a revision record tries to update it',()=>fixture(dir=>{
 const altered=copy(record);altered.generation.scripts['scripts/update-ship-examples.cjs']='0'.repeat(64);fs.writeFileSync(path.join(dir,artifactPath),JSON.stringify(altered));assert.throws(()=>V.verifyRuntimeRevision(dir),/script hashes were relabelled/);
}));
test('an unknown current source helper cannot use the recorded maintenance exception',()=>fixture(dir=>{
 const altered=copy(record);altered.runtime.supportScripts['scripts/arquitens-engine-evidence.cjs']='0'.repeat(64);fs.writeFileSync(path.join(dir,artifactPath),JSON.stringify(altered));assert.throws(()=>V.verifyRuntimeRevision(dir),/support script is not the original or explicitly recorded maintenance supplement/);
}));
test('report relabelling, source-archive tampering and whole-file mismatches fail closed',()=>{
 fixture(dir=>{const f=path.join(dir,record.generation.report.path),value=JSON.parse(fs.readFileSync(f));value.sourceSha256['js/core.js']=sha(runtime);fs.writeFileSync(f,JSON.stringify(value));assert.throws(()=>V.verifyRuntimeRevision(dir),/original generation report changed/);});
 fixture(dir=>{fs.appendFileSync(path.join(dir,record.generation.coreSnapshot.path),Buffer.from([0]));assert.throws(()=>V.verifyRuntimeRevision(dir),/generating Core archive changed/);});
 fixture(dir=>{fs.writeFileSync(path.join(dir,'js/core.js'),generation);assert.throws(()=>V.verifyRuntimeRevision(dir),/distinct revision/);});
});
