#!/usr/bin/env node
// Combine independently generated shards without relabelling saved inputs as factory builds.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const G=require('./update-ship-examples.cjs'),A=require('./audit-ship-examples.cjs'),P=require('./replay-ship-examples.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),same=(a,b)=>G.stable(a)===G.stable(b),read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
function publicBlueprint(value,where='$'){
 const forbidden=new Set(['stats','profile','powerProfile','modules','surfaceMesh','propulsion','info','fleetProfile']);
 if(Array.isArray(value))value.forEach((item,i)=>publicBlueprint(item,where+'['+i+']'));
 else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)){if(key.startsWith('_')||forbidden.has(key))throw Error('Cached physics in public blueprint: '+where+'.'+key);publicBlueprint(item,where+'.'+key);}
}
function shard(root,group,sources){
 const audit=read(path.resolve(root,group.audit)),patch=read(path.resolve(root,group.patch));
 if(!audit.complete||!audit.sourceValidated||!same(audit.sourceSha256,sources)||!same(patch.sourceSha256,sources))throw Error('Incomplete or stale generation proof: '+group.audit);
 if(!same(audit.models.map(row=>row.key).sort(),Object.keys(patch.entries).sort()))throw Error('Patch/audit key mismatch: '+group.patch);
 return {audit,patch};
}
function archiveFresh(root,group,directory){
 const sources=G.sourceHashes(root),{audit,patch}=shard(root,group,sources),key=group.key;
 if(audit.models.length!==1||audit.models[0].key!==key||Object.keys(patch.entries).join(',')!==key)throw Error('Fresh archive must contain exactly its stated factory key');
 const row=audit.models[0],entry=patch.entries[key],raw=fs.readFileSync(path.resolve(root,group.blueprints,key+'.json')),blueprint=JSON.parse(raw),canonicalSha256=sha(G.stable(blueprint));
 if(canonicalSha256!==entry.model.blueprintSha256)throw Error('Actual factory output/catalogue blueprint mismatch');publicBlueprint(blueprint);
 const destination=path.resolve(root,directory),packed=zlib.gzipSync(raw,{level:9,mtime:0});if(packed.readUInt32LE(4)!==0||packed[3]!==0)throw Error('Nondeterministic gzip header');
 const manifest={schemaVersion:1,kind:'current-factory-serialized-ship-blueprint',runtimeLoaded:false,description:'Actual fresh constructor output on the recorded runtime. Historical ship snapshots and earlier independently generated factory outputs remain separate and unchanged. Only public geometry, equipment and circuits are stored; no cached physics.',factoryBaselineCommit:patch.baselineSha,factorySourceSha256:sources,compression:{format:'gzip',level:9,mtime:0,filename:''},factoryGeneration:{method:'fresh-factory',script:'scripts/update-ship-examples.cjs',key,auditSourceSha256:audit.sourceSha256,profileVersion:entry.model.profileVersion,costVersion:entry.model.costVersion,costSignature:entry.model.costSignature},models:{[key]:{file:key+'.json.gz',sha256:sha(raw),gzipSha256:sha(packed),canonicalSha256,uncompressedBytes:raw.length,compressedBytes:packed.length,partCount:blueprint.parts.length,fitCount:blueprint.fits.length,factoryEvidence:{baselinePowerW:row.plant.baselinePowerW,addedReactorCount:row.plant.addedReactorCount,originalEngineOutlets:row.engineOutlets.rows.map(item=>({id:item.id,p:item.originalPositionM}))}}}};
 if(!same(sources,G.sourceHashes(root)))throw Error('Runtime changed during archive preparation');
 // A new archive directory must never overwrite an older authenticated generation.
 if(fs.existsSync(destination)&&fs.readdirSync(destination).length)throw Error('Refusing to overwrite existing factory archive: '+directory);
 fs.mkdirSync(destination,{recursive:true});fs.writeFileSync(path.join(destination,key+'.json.gz'),packed);fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
function finalize(root,plan){
 const sources=G.sourceHashes(root),{C,data}=G.loadRuntime(root),models=new Map(),patches=[],failures=[],archiveChecks=[],manifests=new Map();
 const archive=directory=>{if(!manifests.has(directory))manifests.set(directory,read(path.resolve(root,directory,'manifest.json')));return manifests.get(directory);};
 for(const group of plan.groups){
  if(!['saved-blueprint-replay','fresh-factory'].includes(group.method))throw Error('Unknown generation method: '+group.method);
  const {audit,patch}=shard(root,group,sources),manifest=archive(group.archive);patches.push(patch);
  for(const original of audit.models){
   const row=JSON.parse(JSON.stringify(original)),key=row.key,entry=patch.entries[key],record=manifest.models[key];if(models.has(key))throw Error('Duplicate model: '+key);if(!record)throw Error('Missing archive record: '+key);
   const input=P.readBlueprint(path.resolve(root,group.archive),key,manifest),output=read(path.resolve(root,group.blueprints,key+'.json')),outputSha=sha(G.stable(output));publicBlueprint(input.blueprint);publicBlueprint(output);
   if(entry.model.blueprintSha256!==outputSha)throw Error('Actual output/catalogue identity mismatch: '+key);
   if(group.method==='saved-blueprint-replay'){
    const replay=row.replay;if(!replay||replay.inputCanonicalSha256!==record.canonicalSha256||replay.inputFileSha256!==record.sha256||replay.inputGzipSha256!==record.gzipSha256||!same(replay.inputFactorySourceSha256,manifest.factorySourceSha256)||replay.outputCanonicalSha256!==outputSha)throw Error('Saved input/output archive identity mismatch: '+key);
    const equivalence=P.compareBlueprintInputs(C,input.blueprint,output);if(!equivalence.physicalInputEquivalent)failures.push({scope:'saved-input-physical-equivalence',key,comparison:equivalence});row.replay.finalInputEquivalence=equivalence;
    row.generation={method:group.method,runtimeSourceSha256:sources,inputFactorySourceSha256:manifest.factorySourceSha256,inputArchive:group.archive+'/'+record.file,inputRawSha256:record.sha256,inputGzipSha256:record.gzipSha256,inputCanonicalSha256:record.canonicalSha256,outputCanonicalSha256:outputSha,scope:'This authenticated saved design was fully remeasured on the stated runtime; the current constructor was not used to rebuild its layout.'};
    archiveChecks.push({key,method:group.method,archive:row.generation.inputArchive,verified:true,physicalInputEquivalent:equivalence.physicalInputEquivalent});
   }else{
    if(row.replay||!same(manifest.factorySourceSha256,sources)||manifest.factoryGeneration?.method!=='fresh-factory'||manifest.factoryGeneration.key!==key||input.canonicalSha256!==outputSha||!same(manifest.factoryGeneration.auditSourceSha256,sources))throw Error('Fresh factory output/archive scope mismatch: '+key);
    row.generation={method:group.method,runtimeSourceSha256:sources,outputArchive:group.archive+'/'+record.file,outputRawSha256:record.sha256,outputGzipSha256:record.gzipSha256,outputCanonicalSha256:outputSha,scope:'The current constructor built this physical design; its actual ship, statistics and profile were audited and its public design output was separately archived.'};archiveChecks.push({key,method:group.method,archive:row.generation.outputArchive,verified:true});
   }
   models.set(key,row);
  }
 }
 const keys=Array.from(C.SHIP_SYSTEM_REFIT_KEYS).sort();if(!same([...models.keys()].sort(),keys))throw Error('Missing final stock models');G.mergePatches(data,patches,C,sources);
 const saved=[...models.values()].filter(row=>row.generation.method==='saved-blueprint-replay'),fresh=[...models.values()].filter(row=>row.generation.method==='fresh-factory');
 const report=A.summarize({source:'current-mixed-factory-and-saved-blueprint-verification',baselineCommit:patches[0].baselineSha,sourceSha256:sources,generatedAt:new Date().toISOString(),modelVersion:C.PROPULSION_MODEL_VERSION,profileVersion:C.FLEET_PROFILE_VERSION,allKeys:keys,availableKeys:keys,verification:A.verification,sourceValidated:true,generationMethods:{savedBlueprintReplays:saved.length,currentFactoryBuilds:fresh.length,freshFactoryKeys:fresh.map(row=>row.key),scope:plan.scope},models:keys.map(key=>models.get(key))});
 for(const key of ['buildFailures','unavailableEngines','understaffed','belowFleetMinCrew','zeroCrewUnusable','zeroCrewUsableDespiteRequirement','powerConservationFailures','changedOriginalPlants','incompleteCapacitors','nonStrictCooling','implicitCoolingSinks','invalidRealCoolerPower','strictThermalFailures','movedOriginalEngineOutlets','electricalFeedConservationFailures','sharedEngineInputFailures','runtimeElectricalHeatFailures','coreEnergyFailures','brokenThermalRoutes','engineBodyIntersections'])if(report.summary[key]?.length)failures.push({scope:key,failures:report.summary[key]});
 for(const network of ['engineTransmission','engineDrivetrain'])for(const key of ['invalidRoutes','disconnectedEngines','geometrySurveyFailures','conduitCrossings','combinedConduitCrossings','ledgerFailures','externalEntryFailures','terminalContactFailures','statsLedgerFailures','unboundPhysicalParts'])if(report.summary[network]?.[key]?.length)failures.push({scope:network+'.'+key,failures:report.summary[network][key]});
 if(report.summary.propulsionArchitecture?.failures?.length)failures.push({scope:'propulsionArchitecture',failures:report.summary.propulsionArchitecture.failures});
 report.summary.propulsionOperabilityFailures=report.models.filter(row=>!(row.ratedG>0&&row.allocationScenarios?.driveOnly?.actualEngineInputW>0&&row.allocationScenarios.driveOnly.actualG>0)).map(row=>({key:row.key,ratedG:row.ratedG,driveOnlyInputW:row.allocationScenarios?.driveOnly?.actualEngineInputW,driveOnlyActualG:row.allocationScenarios?.driveOnly?.actualG}));if(report.summary.propulsionOperabilityFailures.length)failures.push({scope:'propulsion-priority-operability',failures:report.summary.propulsionOperabilityFailures});
 report.summary.balancedZeroWithOperableDrive=report.models.filter(row=>row.defaultCombatActualG===0&&row.allocationScenarios.driveOnly.actualG>0).map(row=>row.key);
 report.portableVerification={manifests:[...manifests].map(([directory,manifest])=>({path:directory+'/manifest.json',sha256:sha(fs.readFileSync(path.resolve(root,directory,'manifest.json'))),factorySourceSha256:manifest.factorySourceSha256})),models:archiveChecks,verified:archiveChecks.length===keys.length&&archiveChecks.every(row=>row.verified&&row.physicalInputEquivalent!==false)};
 report.replayVerification={modelCount:saved.length,rawSerializedNonexact:saved.filter(row=>!row.replay.serializedInputUnchanged).map(row=>row.key),physicalInputEquivalenceFailures:saved.filter(row=>!row.replay.finalInputEquivalence.physicalInputEquivalent).map(row=>row.key),historicalNumericalComparisonAvailable:saved.filter(row=>row.replay.profileParity.available!==false).map(row=>row.key),changedPhysics:saved.filter(row=>row.replay.profileParity.available!==false&&(!row.replay.profileParity.withinTolerance||!row.replay.engineeringParity.withinTolerance||!row.replay.auditParity.withinTolerance)).map(row=>({key:row.key,profile:row.replay.profileParity,engineering:row.replay.engineeringParity,routing:row.replay.routingParity,audit:row.replay.auditParity})),scope:'Raw serialization differences and unavailable historical numerical comparisons remain explicit. Physical input equivalence is independently checked against each authenticated source archive.'};
 if(!same(sources,G.sourceHashes(root)))throw Error('Model source changed during final verification');report.physicalVerification={passed:failures.length===0,failures};return report;
}
function main(args=process.argv.slice(2)){
 const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));if(args.length!==2||!['--archive-fresh','--plan'].includes(args[0]))throw Error('Usage: --archive-fresh CONFIG.json | --plan CONFIG.json');const plan=read(path.resolve(args[1]));
 if(args[0]==='--archive-fresh'){const manifest=archiveFresh(root,plan.group,plan.directory);console.log(JSON.stringify({directory:plan.directory,keys:Object.keys(manifest.models),sourceSha256:manifest.factorySourceSha256}));return manifest;}
 const report=finalize(root,plan),destination=path.resolve(root,report.physicalVerification.passed?plan.report:plan.failedReport);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({destination,models:report.models.length,passed:report.physicalVerification.passed,generationMethods:report.generationMethods,failures:report.physicalVerification.failures}));if(!report.physicalVerification.passed)process.exitCode=1;return report;
}
module.exports={archiveFresh,finalize,publicBlueprint};if(require.main===module)try{main();}catch(error){console.error(error.stack||error);process.exitCode=1;}
