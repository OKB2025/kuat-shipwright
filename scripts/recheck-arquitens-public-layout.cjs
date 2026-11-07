#!/usr/bin/env node
// Supplement a captured generation without rerunning or relabelling it.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),Module=require('node:module');
const G=require('./update-ship-examples.cjs'),P=require('./refresh-imperial-layouts.cjs'),F=require('./finalize-ship-example-audit.cjs');
const LEGACY_HELPER_SHA='17d019a0e71080c8d34a8348e02bd906df8085b6b4aa5de0e4ab6f491e8628ce',HELPER='scripts/arquitens-engine-evidence.cjs';
const SNAPSHOTS={'scripts/refresh-imperial-layouts.cjs':'refresh-generation.cjs','scripts/audit-ship-examples.cjs':'refresh-auditor.cjs','scripts/finalize-ship-example-audit.cjs':'refresh-finalizer.cjs','scripts/update-ship-examples.cjs':'refresh-catalogue.cjs',[HELPER]:'refresh-arquitens-source.cjs','scripts/stock-engine-source-evidence.cjs':'refresh-stock-source.cjs','scripts/replay-ship-examples.cjs':'refresh-blueprint-reader.cjs'};
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),same=(a,b)=>G.stable(a)===G.stable(b),read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function correctedHelperText(code){
 if(sha(code)!==LEGACY_HELPER_SHA)throw Error('The maintenance correction requires the exact original helper bytes');
 let text=code.toString('utf8');for(const [before,after]of [["Object.keys(value).filter(k=>!k.startsWith('_')).map(k=>[k,publicValue(value[k])])","Object.keys(value).filter(k=>!k.startsWith('_')&&value[k]!==undefined).map(k=>[k,publicValue(value[k])])"],["fields.filter(k=>Object.hasOwn(value,k))","fields.filter(k=>Object.hasOwn(value,k)&&value[k]!==undefined)"]]){if(text.split(before).length!==2)throw Error('The exact undefined-only projection patch no longer matches');text=text.replace(before,after);}return text;
}
function runtimeStable(value){if(Array.isArray(value))return '['+value.map(runtimeStable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).filter(key=>!key.startsWith('_')).sort().map(key=>JSON.stringify(key)+':'+runtimeStable(value[key])).join(',')+'}';return JSON.stringify(value);}
function normalizedStructure(part){const out=JSON.parse(JSON.stringify(part));if(out.form==='shell'&&out.shellFlip===false)delete out.shellFlip;return out;}
function assertCapturedScripts(journal,files){
 if(!same(Object.keys(journal.scriptSha256||{}).sort(),Object.keys(SNAPSHOTS).sort()))throw Error('The complete original script manifest is required');
 for(const file of Object.keys(SNAPSHOTS))if(!files[file]||sha(files[file])!==journal.scriptSha256[file])throw Error('Original captured script SHA mismatch: '+file);
 if(journal.orchestrationScriptSha256!==journal.scriptSha256['scripts/refresh-imperial-layouts.cjs']||journal.auditScriptSha256!==journal.scriptSha256['scripts/audit-ship-examples.cjs'])throw Error('The original generator or auditor stamp differs');
}
function assertOnlyProjectionFailures(journal,plan){
 if(journal.key!=='arquitens'||journal.method!=='fresh-factory'||journal.constructorCalls!==1||journal.phase!=='audited-ready-for-publication')throw Error('Only the one captured Arquitens factory result can receive this supplement');
 const actual=P.stageEvidenceFailures(journal,plan),expected=['initialLayoutEvidence','layoutEvidence'].map(phase=>({scope:'arquitens-source-layout',phase,field:'structuralLayoutPreserved'}));
 if(!same(actual,expected))throw Error('The only permitted original failures are the two Arquitens runtime structure projection flags');
}
function verifyEvidence(C,helper,source,bundle,plan=P.outputPlan('engine-targets')){
 const {journal,constructorBlueprint,finalBlueprint,reproduction}=bundle;assertOnlyProjectionFailures(journal,plan);
 if(journal.scriptSha256?.[HELPER]!==LEGACY_HELPER_SHA)throw Error('This correction is restricted to the recorded frozen Arquitens helper');
 const constructorSha256=sha(G.stable(constructorBlueprint)),finalSha256=sha(G.stable(finalBlueprint));
 if(constructorSha256!==journal.constructorBlueprintSha256||finalSha256!==journal.finalBlueprintSha256)throw Error('The actual captured public blueprint SHA differs');
 F.publicBlueprint(constructorBlueprint);F.publicBlueprint(finalBlueprint);
 if(!reproduction?.runtimePublicHashesAllReproduced||!reproduction.onlyUnsavedUndefinedExtras||!Array.isArray(reproduction.rows)||reproduction.rows.length!==75||new Set(reproduction.rows.map(row=>row.id)).size!==75)throw Error('The independent runtime projection reproduction is incomplete');
 const byId=new Map(reproduction.rows.map(row=>[row.id,row])),proofs={};
 for(const [phase,blueprint]of [['initialLayoutEvidence',constructorBlueprint],['layoutEvidence',finalBlueprint]]){
  const original=journal[phase],parts=new Map(blueprint.parts.map(part=>[part.id,part]));if(original.structures?.length!==75)throw Error('The original runtime structure inventory differs');
  const runtimeHashes=original.structures.map(row=>{const reproductionRow=byId.get(row.id),part=parts.get(row.id);if(!reproductionRow?.runtimeHashReproduced||!part||!Array.isArray(reproductionRow.extraPublicFields))throw Error('A runtime structure was not independently reproduced');const reconstructed=normalizedStructure(part),fields=new Set();
   for(const entry of reproductionRow.extraPublicFields){if(typeof entry.field!=='string'||entry.field.startsWith('_')||fields.has(entry.field)||entry.type!=='undefined'||entry.isUndefined!==true||Object.hasOwn(reconstructed,entry.field))throw Error('A non-undefined authored field cannot receive a projection exception');fields.add(entry.field);reconstructed[entry.field]=undefined;}
   const reconstructedSha256=sha(runtimeStable(reconstructed));if(reconstructedSha256!==row.actualSha256)throw Error('A runtime SHA cannot be explained solely by the recorded unsaved undefined keys: '+row.id);return {id:row.id,originalRuntimeSha256:row.actualSha256,reconstructedRuntimeSha256:reconstructedSha256,undefinedFields:[...fields]};});
  const publicEvidence=helper.layoutEvidence(C,blueprint,source);if(!publicEvidence.passed||!['structuralLayoutPreserved','allFittingPosesPreserved','weaponKindsCorrect','nozzleAppearancePreserved'].every(field=>publicEvidence[field]===true))throw Error('The actual public output has a real source geometry or fitting-pose difference');
  proofs[phase]={publicEvidence,originalRuntimeEvidence:original,runtimeHashes};
 }
 return {method:'read-only-public-representation-equivalence',scope:'Only unsaved undefined object keys are corrected. The original runtime false flags and original generation stamps remain intact; the same frozen helper independently verifies the exact constructor and final public outputs. Physical, pose, power, heat, capacity, target and speed failures are never waived.',originalHelperSha256:LEGACY_HELPER_SHA,sourceLayoutSha256:source.sourceSha256,constructorBlueprintSha256:constructorSha256,finalBlueprintSha256:finalSha256,runtimeStructureCount:75,runtimeHashesAllReproduced:true,additionalPublicKeysOnlyUndefined:true,additionalFullConstructorCalls:0,proofs,passed:true};
}
function frozenHelper(root,code){if(sha(code)!==LEGACY_HELPER_SHA)throw Error('Frozen helper bytes differ');const filename=path.join(root,HELPER),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));m._compile(code.toString('utf8'),filename);return m.exports;}
function recheck(root,directory){
 const journalBytes=fs.readFileSync(path.join(directory,'journal.json')),journal=JSON.parse(journalBytes),files=Object.fromEntries(Object.entries(SNAPSHOTS).map(([file,name])=>[file,fs.readFileSync(path.join(directory,name))]));assertCapturedScripts(journal,files);
 if(!same(journal.sourceSha256,G.sourceHashes(root)))throw Error('The physical model sources changed after generation');
 const {C}=G.loadRuntime(root),helper=frozenHelper(root,files[HELPER]),source=helper.loadSource(root);if(source.sourceSha256!==journal.sourceLayout?.sourceSha256||sha(fs.readFileSync(path.join(root,source.manifestPath)))!==journal.sourceLayout.manifestSha256)throw Error('The original authenticated source-layout identity differs');const bundle={journal,constructorBlueprint:read(path.join(directory,'constructor-layout/arquitens.json')),finalBlueprint:read(path.join(directory,'blueprints/arquitens.json')),reproduction:read(path.join(directory,'runtime-undefined-projection-reproduction.json'))},evidence=verifyEvidence(C,helper,source,bundle);
 evidence.originalJournalSha256=sha(journalBytes);evidence.supplementScript='scripts/recheck-arquitens-public-layout.cjs';evidence.supplementScriptSha256=sha(fs.readFileSync(__filename));evidence.modelSourceSha256=journal.sourceSha256;
 fs.writeFileSync(path.join(directory,'public-layout-supplement.json'),JSON.stringify(evidence,null,2)+'\n');return evidence;
}
module.exports={HELPER,LEGACY_HELPER_SHA,SNAPSHOTS,sha,correctedHelperText,assertCapturedScripts,assertOnlyProjectionFailures,verifyEvidence,recheck};
if(require.main===module){try{const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));if(process.argv.length!==3)throw Error('Usage: recheck-arquitens-public-layout.cjs STAGE_DIRECTORY');const result=recheck(root,path.resolve(process.argv[2]));console.log(JSON.stringify({passed:result.passed,runtimeStructureCount:result.runtimeStructureCount,additionalFullConstructorCalls:0,scriptSha256:result.supplementScriptSha256}));}catch(error){console.error(error.stack||error);process.exitCode=1;}}
