#!/usr/bin/env node
// One actual Mandator factory capture and a one-row, independently audited
// publication. Earlier catalogues and reports retain their authentic sources.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
const G=require('./update-ship-examples.cjs'),A=require('./audit-ship-examples.cjs'),F=require('./finalize-ship-example-audit.cjs'),{figuresDigest}=require('../tests/helpers/figures-digest.cjs');
const KEY='mandator2',REPORT='docs/benchmarks/mandator-battery-layout-refit.json',ARCHIVE='assets/source/mandator-battery-layout-factory-blueprints';
const SCRIPT_FILES=['scripts/refresh-mandator-layout.cjs','scripts/update-ship-examples.cjs','scripts/audit-ship-examples.cjs','scripts/finalize-ship-example-audit.cjs','scripts/mandator-layout-evidence.cjs','tests/helpers/figures-digest.cjs'];
const BATTERY_COUNTS=Object.freeze({utl:163,ball720:80,quad175:16,ball175Quad:6,ball175QuadIon:14,pd:160,monCalPD:60});
const PRESERVED_FITS=Object.freeze({msl:2,trc:6,podCombat:1,podAir:1});
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),same=(a,b)=>G.stable(a)===G.stable(b),fingerprint=value=>sha(G.stable(value)),read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
function controls(data,figures){return {catalogue:Object.fromEntries(Object.entries(data.designs).filter(([key])=>key!==KEY).map(([key,row])=>[key,{sha256:fingerprint(row),sourceSha256:row.model?.sourceSha256}])),figures:Object.fromEntries(Object.entries(figures.ships).filter(([key])=>key!==KEY).map(([key,row])=>[key,fingerprint(row)]))};}
function assertControls(expected,data,figures){if(!same(expected,controls(data,figures)))throw Error('An unselected catalogue row or engineering figure changed');}
function scriptHashes(root){return Object.fromEntries(SCRIPT_FILES.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));}
function batteryEvidence(C,ship){
 const counts=Object.fromEntries(Object.keys(BATTERY_COUNTS).map(key=>[key,0])),preservedFits={},unexpected=[];let mainIonVolleyTT=0,pointDefenseVolleyTT=0;
 for(const fit of ship.fits){const d=C.FITS[fit.k],spec=C.fitSpec(fit),volley=(spec.tt||0)+(spec.ion||0);if(Object.hasOwn(counts,fit.k)){counts[fit.k]++;if(fit.float)unexpected.push({id:fit.id,kind:fit.k,reason:'floating'});if(fit.k==='pd'||fit.k==='monCalPD')pointDefenseVolleyTT+=volley;else mainIonVolleyTT+=volley;}else{preservedFits[fit.k]=(preservedFits[fit.k]||0)+1;if(d?.cat==='w'&&!d.msl&&volley>0)unexpected.push({id:fit.id,kind:fit.k,reason:'unrequested-gun'});}}
 const passed=same(counts,BATTERY_COUNTS)&&same(preservedFits,PRESERVED_FITS)&&!unexpected.length&&Math.abs(mainIonVolleyTT-317520)<1e-6&&Math.abs(pointDefenseVolleyTT-.00005)<1e-12;
 if(!passed)throw Error('The complete requested Mandator battery differs: '+JSON.stringify({counts,preservedFits,unexpected,mainIonVolleyTT,pointDefenseVolleyTT}));return {passed,counts,preservedFits,unexpected,mainIonVolleyTT,pointDefenseVolleyTT,allGunVolleyTT:mainIonVolleyTT+pointDefenseVolleyTT};
}
function physicalGateFailures(row){
 const failures=[];if(!row||row.error)failures.push({scope:'physical-audit',error:row?.error||'missing'});
 if(row?.overlapIds?.length)failures.push({scope:'installed-equipment-overlap',ids:row.overlapIds});
 const blocked=(row?.capacitors||[]).filter(c=>c.ratio<.999||c.blocked);if(blocked.length)failures.push({scope:'incomplete-single-volley-storage',guns:blocked});return failures;
}
function evidence(root,C,ship,stats,destination){const proof=require(path.join(root,'scripts/mandator-layout-evidence.cjs')).layoutEvidence(C,ship,stats);if(destination)write(destination,proof);if(proof?.passed!==true)throw Error('Mandator layout evidence failed: '+JSON.stringify({failures:proof?.failures,checks:proof?.checks,evidenceFile:destination}));return proof;}
function generate(root,directory){
 if(fs.existsSync(path.join(directory,'journal.json')))throw Error('A new stage directory is required; an earlier generation cannot be overwritten');
 const sources=G.sourceHashes(root),scripts=scriptHashes(root),{C,R,data}=G.loadRuntime(root),figures=read(path.join(root,'tests/helpers/example-figures.json')),baselineCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),started=Date.now();
 const journal={schemaVersion:1,key:KEY,method:'fresh-factory',scope:'Only the current Mandator constructor, its actual geometry and engineering output are captured. Other ship rows are retained as their recorded historical generations.',baselineCommit,sourceSha256:sources,scriptSha256:scripts,constructorCalls:0,controls:controls(data,figures),startedAt:new Date().toISOString(),phase:'starting'};
 const checkpoint=phase=>{journal.phase=phase;journal.elapsedMs=Date.now()-started;write(path.join(directory,'journal.json'),journal);process.stderr.write(phase+' '+journal.elapsedMs+' ms\n');};
 fs.mkdirSync(directory,{recursive:true});for(const file of SCRIPT_FILES){const destination=path.join(directory,'scripts',file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(root,file),destination);}checkpoint('starting-factory');
 const native=C.buildDesign;let captured,entry;
 C.buildDesign=function(key){if(key!==KEY||journal.constructorCalls++)throw Error('Exactly one actual Mandator factory call is permitted');checkpoint('actual-factory-invoked');const ship=native(key),blueprint=C.serialize(ship);F.publicBlueprint(blueprint);journal.constructorBlueprintSha256=fingerprint(blueprint);journal.batteryEvidence=batteryEvidence(C,ship);write(path.join(directory,'constructor-layout',KEY+'.json'),blueprint);journal.initialLayoutEvidence=evidence(root,C,ship,undefined,path.join(directory,'initial-layout-evidence.json'));checkpoint('constructor-returned-engineering-pending');return ship;};
 try{
  entry=G.generateEntry(C,R,KEY,data.designs[KEY],sources,{onBuilt:result=>{
   captured=result;F.publicBlueprint(result.blueprint);write(path.join(directory,'blueprints',KEY+'.json'),result.blueprint);write(path.join(directory,'figures.json'),figuresDigest(result.stats));journal.finalLayoutEvidence=evidence(root,C,result.ship,result.stats,path.join(directory,'final-layout-evidence.json'));checkpoint('engineering-complete-audit-pending');
   const row=A.auditBuilt(C,KEY,result.ship,result.stats,result.profile),audit=A.summarize({source:'current-scoped-fresh-factory',baselineCommit,sourceSha256:sources,generatedAt:new Date().toISOString(),modelVersion:C.PROPULSION_MODEL_VERSION,profileVersion:C.FLEET_PROFILE_VERSION,allKeys:[KEY],availableKeys:G.exampleKeys(C,data),verification:A.verification,sourceValidated:false,models:[row]});
   write(path.join(directory,'audit.json'),audit);
  }});
 }catch(error){journal.error=String(error.stack||error);checkpoint('failed');throw error;}finally{C.buildDesign=native;}
 if(!captured||journal.constructorCalls!==1)throw Error('The actual factory output was not captured exactly once');
 if(!same(sources,G.sourceHashes(root))||!same(scripts,scriptHashes(root)))throw Error('Physical sources or audit scripts changed during the factory capture');
 const audit=read(path.join(directory,'audit.json'));audit.sourceValidated=true;write(path.join(directory,'audit.json'),audit);
 entry.model.provenance={method:'fresh-factory',scope:journal.scope,constructorCalls:1,inputSource:'Built-in MAN_DESIGN hull/structures plus explicitly requested all-surface battery layout',layoutEvidencePassed:true};
 write(path.join(directory,'patch.json'),G.createPatch(C,{[KEY]:entry},sources,baselineCommit));journal.finalBlueprintSha256=fingerprint(captured.blueprint);journal.figureDigestSha256=fingerprint(read(path.join(directory,'figures.json')));checkpoint('audited-ready-for-publication');return journal;
}
function publish(root,directory){
 const journal=read(path.join(directory,'journal.json')),sources=G.sourceHashes(root),scripts=scriptHashes(root),{C,data}=G.loadRuntime(root),figuresFile=path.join(root,'tests/helpers/example-figures.json'),figures=read(figuresFile);
 if(journal.key!==KEY||journal.method!=='fresh-factory'||journal.constructorCalls!==1||journal.phase!=='audited-ready-for-publication'||!same(journal.sourceSha256,sources)||!same(journal.scriptSha256,scripts))throw Error('A complete capture on the exact current physical and audit sources is required');
 assertControls(journal.controls,data,figures);
 for(const [file,digest]of Object.entries(scripts))if(sha(fs.readFileSync(path.join(directory,'scripts',file)))!==digest)throw Error('Captured audit script differs: '+file);
 const blueprint=read(path.join(directory,'blueprints',KEY+'.json')),loaded=C.deserialize(blueprint),layout=evidence(root,C,loaded,undefined,path.join(directory,'archived-layout-evidence.json')),battery=batteryEvidence(C,loaded),preflight=physicalGateFailures(read(path.join(directory,'audit.json')).models[0]);if(preflight.length)throw Error('The installed physical equipment failed before publication: '+JSON.stringify(preflight));if(fingerprint(blueprint)!==journal.finalBlueprintSha256)throw Error('The captured final blueprint changed');
 const group={key:KEY,method:'fresh-factory',patch:path.join(directory,'patch.json'),audit:path.join(directory,'audit.json'),blueprints:path.join(directory,'blueprints'),archive:ARCHIVE};
 const manifest=F.archiveFresh(root,group,ARCHIVE),destination=path.join(root,ARCHIVE),manifestFile=path.join(destination,'manifest.json');
 manifest.factoryGeneration.refreshOrchestration={script:'scripts/refresh-mandator-layout.cjs',constructorCalls:1,scriptSha256:scripts};
 manifest.factoryGeneration.capturedScripts=Object.entries(scripts).map(([file,digest])=>{const name=file.replaceAll('/','__'),bytes=fs.readFileSync(path.join(directory,'scripts',file));fs.writeFileSync(path.join(destination,name),bytes);return {path:name,source:file,sha256:digest};});
 fs.copyFileSync(path.join(directory,'journal.json'),path.join(destination,'generation-journal.json'));const constructorBytes=fs.readFileSync(path.join(directory,'constructor-layout',KEY+'.json')),constructorPacked=zlib.gzipSync(constructorBytes,{level:9,mtime:0});fs.writeFileSync(path.join(destination,'constructor-output.json.gz'),constructorPacked);manifest.factoryGeneration.constructorOutput={file:'constructor-output.json.gz',sha256:sha(constructorBytes),gzipSha256:sha(constructorPacked),canonicalSha256:journal.constructorBlueprintSha256};write(manifestFile,manifest);
 const report=F.finalize(root,{keys:[KEY],groups:[group],scope:journal.scope});
 report.controls=journal.controls;report.batteryEvidence=battery;report.layoutEvidence={initial:journal.initialLayoutEvidence,final:journal.finalLayoutEvidence,archived:layout};report.orchestration={script:'scripts/refresh-mandator-layout.cjs',constructorCalls:1,scriptSha256:scripts,constructorBlueprintSha256:journal.constructorBlueprintSha256,finalBlueprintSha256:journal.finalBlueprintSha256};report.figureDigestSha256={[KEY]:journal.figureDigestSha256};report.physicalVerification.failures.push(...physicalGateFailures(report.models[0]));
 for(const [phase,proof]of Object.entries(report.layoutEvidence))if(proof?.passed!==true)report.physicalVerification.failures.push({scope:'layout-'+phase,proof});
 report.physicalVerification.passed=report.physicalVerification.failures.length===0;
 if(!report.physicalVerification.passed){write(path.join(directory,'failed-publication-report.json'),report);throw Error('The full physical/layout audit failed; no catalogue entry was published');}
 const next=G.mergePatches(data,[read(group.patch)],C,sources),nextFigures={...figures,ships:{...figures.ships,[KEY]:read(path.join(directory,'figures.json'))}};assertControls(journal.controls,next,nextFigures);
 if(!same(sources,G.sourceHashes(root))||!same(scripts,scriptHashes(root)))throw Error('Sources changed during publication');
 write(path.join(root,REPORT),report);fs.writeFileSync(path.join(root,'data/fleet.js'),'// Fleet profiles of the editable examples, generated by scripts/update-ship-examples.cjs.\nconst YardFleetData='+JSON.stringify(next)+';\n');fs.writeFileSync(figuresFile,JSON.stringify(nextFigures)+'\n');return report;
}
module.exports={generate,publish,controls,assertControls,scriptHashes,batteryEvidence,physicalGateFailures,constants:Object.freeze({KEY,REPORT,ARCHIVE,SCRIPT_FILES,BATTERY_COUNTS,PRESERVED_FITS})};
if(require.main===module){try{const [action,directory]=process.argv.slice(2),root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));if(!['--generate','--publish'].includes(action)||!directory||process.argv.length!==4)throw Error('Usage: --generate NEW_STAGE_DIRECTORY | --publish COMPLETED_STAGE_DIRECTORY');const result=(action==='--generate'?generate:publish)(root,path.resolve(directory));console.log(JSON.stringify({action,keys:result.allKeys||[result.key],passed:result.physicalVerification?.passed,constructorCalls:result.orchestration?.constructorCalls??result.constructorCalls}));}catch(error){console.error(error.stack||error);process.exitCode=1;}}
