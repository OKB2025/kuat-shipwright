#!/usr/bin/env node
// One actual fresh constructor, one engineering result, and an explicitly
// scoped publication. The early file is a layout preview, never an audit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const G=require('./update-ship-examples.cjs'),A=require('./audit-ship-examples.cjs'),F=require('./finalize-ship-example-audit.cjs');
const {figuresDigest,figuresDiff}=require('../tests/helpers/figures-digest.cjs');
const KEYS=['imperial','onager'],EXPECTED_GROUPS={imperial:[2,2,3],onager:[1,1,3]},REPORT='docs/benchmarks/shared-engine-core-refit.json';
const archiveFor=key=>'assets/source/'+key+'-shared-core-factory-blueprints';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),fingerprint=v=>sha(G.stable(v)),same=(a,b)=>G.stable(a)===G.stable(b),read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
function write(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(value,null,2)+'\n');fs.renameSync(file+'.tmp',file);}
function controls(data,figures,selected=['imperial']){return {catalogue:Object.fromEntries(Object.entries(data.designs).filter(([key])=>!selected.includes(key)).map(([key,row])=>[key,{sha256:fingerprint(row),sourceSha256:row.model?.sourceSha256||null}])),figures:Object.fromEntries(Object.entries(figures.ships).filter(([key])=>!selected.includes(key)).map(([key,row])=>[key,fingerprint(row)]))};}
function assertControls(expected,data,figures,selected=['imperial']){if(!same(expected,controls(data,figures,selected)))throw Error('An unselected catalogue or figure record changed; refusing to publish a scoped result');}
function auxiliaryBetweenEvidence(C,ship,network,key){
 const nozzles=ship.parts.filter(p=>p.k==='engine'),primary=nozzles.filter(p=>key==='imperial'?/主イオン/.test(p.label||''):/主機関/.test(p.label||'')),auxiliary=nozzles.filter(p=>/補助/.test(p.label||'')),auxIds=[...new Set(auxiliary.map(p=>p.machineryId))],cores=ship.parts.filter(p=>p.k==='engineCore'&&auxIds.includes(p.id)),central=primary.slice().sort((a,b)=>Math.abs(a.c[2])-Math.abs(b.c[2]))[0],rows=[];
 const pieces=route=>route?.segments||[],radius=(route,segment,t)=>Number.isFinite(segment.r0)&&Number.isFinite(segment.r1)?segment.r0+(segment.r1-segment.r0)*t:route.radius;
 function atX(route,x){return pieces(route).flatMap(segment=>{const dx=segment.b[0]-segment.a[0];if(Math.abs(dx)<1e-9||x<Math.min(segment.a[0],segment.b[0])-1e-6||x>Math.max(segment.a[0],segment.b[0])+1e-6)return [];const t=Math.max(0,Math.min(1,(x-segment.a[0])/dx)),z=segment.a[2]+(segment.b[2]-segment.a[2])*t,r=radius(route,segment,t);return [{z,halfWidthZ:r*Math.hypot(1,(segment.b[2]-segment.a[2])/dx)}];});}
 for(const core of cores){
  const sign=Math.sign(core.c[2]),outer=primary.slice().sort((a,b)=>sign*(b.c[2]-a.c[2]))[0],centerRoute=network.routes.find(r=>r.nozzleId===central?.id),outerRoute=network.routes.find(r=>r.nozzleId===outer?.id),dims=C.partDims(core),axis=core.dir||[-1,0,0],aligned=Math.abs(axis[0]/Math.hypot(...axis))>1-1e-8,lo=core.c[0]-dims.l/2,hi=core.c[0]+dims.l/2,xs=[lo,hi,...[centerRoute,outerRoute].flatMap(route=>pieces(route).flatMap(s=>[s.a[0],s.b[0]]))].filter(x=>x>=lo-1e-6&&x<=hi+1e-6).sort((a,b)=>a-b).filter((x,i,V)=>!i||x-V[i-1]>1e-6),stations=xs.map(x=>{const center=atX(centerRoute,x),outside=atX(outerRoute,x),centerEdge=center.length?Math.max(...center.map(p=>sign*p.z+p.halfWidthZ)):null,outerEdge=outside.length?Math.min(...outside.map(p=>sign*p.z-p.halfWidthZ)):null,centerClearanceM=centerEdge==null?null:sign*core.c[2]-dims.rad-centerEdge,outerClearanceM=outerEdge==null?null:outerEdge-sign*core.c[2]-dims.rad;return {xM:x,centralTubeEdgeSignedZM:centerEdge,outerTubeEdgeSignedZM:outerEdge,centralClearanceM:centerClearanceM,outerClearanceM,between:Number.isFinite(centerClearanceM)&&Number.isFinite(outerClearanceM)&&centerClearanceM>0&&outerClearanceM>0};});
  rows.push({coreId:core.id,side:sign,positionM:core.c,axialSlabM:[lo,hi],radiusM:dims.rad,centralNozzleId:central?.id,outerNozzleId:outer?.id,stations,between:aligned&&sign!==0&&primary.length===3&&outer?.id!==central?.id&&stations.length>=2&&stations.every(s=>s.between)});
 }
 return {scope:'Both auxiliary cylinders must fit between the actual central and same-side outer main shafts throughout their complete axial slab. Check both caps and all shaft bends inside that slab; cylindrical shaft radii include the oblique cross-section width in Z.',rows,allAuxiliariesBetweenMainPaths:cores.length===2&&rows.every(row=>row.between)};
}
function propulsionEvidence(C,ship,profile,key){
 const expected=EXPECTED_GROUPS[key];if(!expected)throw Error('The expected shared-core grouping has not been confirmed: '+key);
 const count=expected.reduce((a,b)=>a+b,0),network=C.engineDriveRoutes(ship),u=C.fleetUnit(key+'-layout-proof',key,profile,0);C.heatInit(u);
 const result=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:0,shields:0},.5,'balanced').propulsion;
 const nozzles=ship.parts.filter(p=>p.k==='engine'),cores=ship.parts.filter(p=>p.k==='engineCore'),rows=network.routes.map(route=>({id:route.id,nozzleId:route.nozzleId,valid:route.ok===true,limited:route.limited===true,requestedCapacityW:route.requestedCapacityW,capacityW:route.capacityW,capacitySatisfied:Number.isFinite(route.requestedCapacityW)&&route.capacityW>=route.requestedCapacityW*(1-1e-8)})),flows=(result.engines||[]).map(outlet=>({id:outlet.id,coreId:outlet.coreId??outlet.machineryId,actualInputW:outlet.actualInputW,shaftReceivedW:outlet.shaftReceivedW,actualThrustN:outlet.actualThrustN,positive:Number.isFinite(outlet.actualThrustN)&&outlet.actualThrustN>0}));
 return {scope:'Actual full-throttle drive-only allocation after factory construction. Finite electrical feed loss is retained; every outlet must receive positive physical shaft power.',coreCount:cores.length,nozzleCount:nozzles.length,expectedNozzleGroups:expected,groups:cores.map(core=>({id:core.id,positionM:core.c,ratedInputW:core.ratedInputW,nozzleIds:nozzles.filter(nozzle=>nozzle.machineryId===core.id).map(nozzle=>nozzle.id)})),shafts:rows,outletFlows:flows,allShaftsAtRequestedCapacity:rows.length===count&&rows.every(row=>row.valid&&!row.limited&&row.capacitySatisfied),allOutletsFlow:flows.length===count&&flows.every(row=>row.positive),auxiliaryBetween:auxiliaryBetweenEvidence(C,ship,network,key),allAuxiliariesBetweenMainPaths:auxiliaryBetweenEvidence(C,ship,network,key).allAuxiliariesBetweenMainPaths,expectedOwnerGroups:cores.length===expected.length&&cores.map(core=>nozzles.filter(nozzle=>nozzle.machineryId===core.id).length).sort((a,b)=>a-b).join(',')===expected.join(',')};
}
function sourcePayload(C,ship){return {reactorPowerW:ship.parts.filter(C.isReactor).reduce((n,p)=>n+C.reactorPower(p),0),shieldEnergyJ:ship.parts.filter(p=>p.k==='shield'||p.k==='localShield').reduce((n,p)=>n+C.shieldLoad(p),0),outlets:ship.parts.filter(p=>p.k==='engine').map(p=>({id:p.id,label:p.label,d:p.d,dir:p.dir,mouthM:C.add(p.c,C.mul(C.norm(p.dir||[-1,0,0]),C.partDims(p).l/2))})),superweapons:ship.parts.filter(C.isSuperweapon).map(p=>({id:p.id,k:p.k,energyTT:C.swEnergyTT(p),axis:C.superweaponAxis(p),beamSeconds:C.SW_COMBAT[p.k]?.beamT}))};}
function sourceRecipePayload(C,key){
 if(key==='onager')return sourcePayload(C,C.SHIP_EXAMPLES[key].build({stage:'machinery'}));
 // The reference-design builder is private. These public source dimensions are
 // independently asserted by tests/imperial-engine-layout.cjs; no saved hull is replayed.
 return {reactorPowerW:1e25,shieldEnergyJ:1e26,superweapons:[],outlets:[...[-233.6,0,233.6].map((z,i)=>({id:51+i,label:'主イオン機関・ベル型ノズル',d:112,dir:[-1,0,0],mouthM:[54,136.8,z]})),...[-116.6,116.6].flatMap((z,i)=>[92.9,180.6].map((y,j)=>({id:54+i*2+j,label:'上下二段の補助イオン機関',d:55.7,dir:[-1,0,0],mouthM:[79,y,z]})))]};
}
function sourcePayloadEvidence(C,ship,baseline,key){
 const current=sourcePayload(C,ship),near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-8,byId=new Map(baseline.outlets.map(p=>[p.id,p]));
 const sourcePayloadPreserved=near(current.reactorPowerW,baseline.reactorPowerW)&&near(current.shieldEnergyJ,baseline.shieldEnergyJ)&&same(current.superweapons,baseline.superweapons)&&current.outlets.length===baseline.outlets.length&&current.outlets.every(p=>{const old=byId.get(p.id);return old&&p.label===old.label&&near(p.d,old.d)&&same(p.dir,old.dir)&&p.mouthM.every((v,i)=>near(v,old.mouthM[i]));});
 const referencePowerW=key==='imperial'?1e25:3.6e24,referenceShieldJ=key==='imperial'?1e26:3.6e25,referencePayloadValid=near(current.reactorPowerW,referencePowerW)&&near(current.shieldEnergyJ,referenceShieldJ)&&(key!=='onager'||current.superweapons.length===2&&current.superweapons.every(p=>p.k==='sbeam'&&near(p.energyTT,125000)&&p.beamSeconds===10&&same(p.axis,[1,0,0])));
 return {scope:'Current source recipe dimensions (independent ISD layout fixture or Onager machinery stage) versus the same fresh factory result: original nozzle mouths, apertures, roles, source plant, shield capacity and superweapon energy/axis/duration.',sourcePayloadPreserved,referencePayloadValid,source:baseline,actual:current};
}
function generate(root,directory,key){
 if(!KEYS.includes(key)||!EXPECTED_GROUPS[key])throw Error('A confirmed stock key is required');
 const sources=G.sourceHashes(root),{C,R,data}=G.loadRuntime(root),figures=read(path.join(root,'tests/helpers/example-figures.json')),baselineCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),started=Date.now();
 if(fs.existsSync(path.join(directory,'journal.json')))throw Error('Use a new output directory; an earlier generation journal already exists');
 const sourceCode=fs.readFileSync(__filename),auditCode=fs.readFileSync(require.resolve('./audit-ship-examples.cjs'));
 const journal={schemaVersion:1,key,method:'fresh-factory',baselineCommit,sourceSha256:sources,orchestrationScriptSha256:sha(sourceCode),auditScriptSha256:sha(auditCode),controls:controls(data,figures,KEYS),constructorCalls:0,phase:'starting-factory',startedAt:new Date().toISOString()};
 fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'orchestration-source.cjs'),sourceCode);fs.writeFileSync(path.join(directory,'auditor-source.cjs'),auditCode);
 const checkpoint=phase=>{journal.phase=phase;journal.elapsedMs=Date.now()-started;write(path.join(directory,'journal.json'),journal);process.stderr.write(phase+' '+journal.elapsedMs+' ms\n');};checkpoint('starting-factory');
 const sourceRecipe=sourceRecipePayload(C,key),nativeBuild=C.buildDesign;
 C.buildDesign=function(requestedKey){
  if(requestedKey!==key||journal.constructorCalls++)throw Error('Scoped refresh must call the actual constructor exactly once');
  const ship=nativeBuild(key),blueprint=C.serialize(ship);F.publicBlueprint(blueprint);
  write(path.join(directory,'constructor-layout',key+'.json'),blueprint);
  journal.constructorBlueprintSha256=fingerprint(blueprint);journal.calibration=JSON.parse(JSON.stringify(ship.shipSystemRefit||null));
  checkpoint('constructor-returned-layout-ready-engineering-pending');return ship;
 };
 let captured,entry;
 try{entry=G.generateEntry(C,R,key,data.designs[key],sources,{onBuilt:result=>{
  captured=result;write(path.join(directory,'blueprints',key+'.json'),result.blueprint);write(path.join(directory,'figures.json'),figuresDigest(result.stats));checkpoint('engineering-complete-audit-pending');
  journal.propulsionEvidence={...propulsionEvidence(C,result.ship,result.profile,key),...sourcePayloadEvidence(C,result.ship,sourceRecipe,key)};
  const row=A.auditBuilt(C,key,result.ship,result.stats,result.profile),audit=A.summarize({source:'current-scoped-fresh-factory',baselineCommit,sourceSha256:sources,generatedAt:new Date().toISOString(),modelVersion:C.PROPULSION_MODEL_VERSION,profileVersion:C.FLEET_PROFILE_VERSION,allKeys:[key],availableKeys:G.exampleKeys(C,data),verification:A.verification,sourceValidated:false,models:[row]});
  write(path.join(directory,'audit.json'),audit);
 }});}finally{C.buildDesign=nativeBuild;}
 if(!captured||journal.constructorCalls!==1)throw Error('The fresh factory result was not captured');
 if(!same(sources,G.sourceHashes(root)))throw Error('Model sources changed during generation');
 const audit=read(path.join(directory,'audit.json'));audit.sourceValidated=true;write(path.join(directory,'audit.json'),audit);
 entry.model.provenance={method:'fresh-factory',scope:'Shared internal engine bodies and independent physical nozzle shafts',constructorCalls:1};
 write(path.join(directory,'patch.json'),G.createPatch(C,{[key]:entry},sources,baselineCommit));
 journal.finalBlueprintSha256=fingerprint(captured.blueprint);journal.figureDifferences=figuresDiff(figures.ships[key],figuresDigest(captured.stats));checkpoint('audited-ready-for-publication');return journal;
}
function publish(root,directories){
 const sources=G.sourceHashes(root),{C,data}=G.loadRuntime(root),figuresFile=path.join(root,'tests/helpers/example-figures.json'),figures=read(figuresFile),stages=directories.map(directory=>({directory,journal:read(path.join(directory,'journal.json'))}));
 if(!same(stages.map(s=>s.journal.key).sort(),KEYS))throw Error('Publication requires exactly the two independently built stock stages');
 for(const {journal}of stages){if(journal.phase!=='audited-ready-for-publication'||journal.constructorCalls!==1||journal.method!=='fresh-factory'||!same(journal.sourceSha256,sources))throw Error('A complete matching fresh-constructor journal is required');assertControls(journal.controls,data,figures,KEYS);}
 const groups=stages.map(({directory,journal})=>({key:journal.key,method:'fresh-factory',patch:path.join(directory,'patch.json'),audit:path.join(directory,'audit.json'),blueprints:path.join(directory,'blueprints'),archive:archiveFor(journal.key)}));
 for(const group of groups){
  F.archiveFresh(root,group,group.archive);const stage=stages.find(s=>s.journal.key===group.key),destination=path.join(root,group.archive),manifestFile=path.join(destination,'manifest.json'),manifest=read(manifestFile);
  const sourceFiles=[['orchestration-source.cjs','refresh-generation.cjs'],['auditor-source.cjs','refresh-auditor.cjs']];if(stage.journal.payloadVerifierRevision)sourceFiles.push(['payload-verifier-revision.json','payload-verifier-revision.json']);
  manifest.factoryGeneration.refreshOrchestration={script:'scripts/refresh-shared-propulsion.cjs',constructorCalls:stage.journal.constructorCalls,files:sourceFiles.map(([from,to])=>{const content=fs.readFileSync(path.join(stage.directory,from));fs.writeFileSync(path.join(destination,to),content);return {file:to,sha256:sha(content)};})};write(manifestFile,manifest);
 }
 const report=F.finalize(root,{keys:KEYS,groups,scope:'Only the Imperial and Onager stock constructors and catalogue rows are refreshed. The other 25 stock rows and historical archives retain their original generating sources.'});
 report.orchestration={script:'scripts/refresh-shared-propulsion.cjs',constructorCalls:stages.reduce((n,s)=>n+s.journal.constructorCalls,0),stages:stages.map(({journal:j})=>({key:j.key,constructorCalls:j.constructorCalls,scriptSha256:j.orchestrationScriptSha256,auditorSha256:j.auditScriptSha256,constructorBlueprintSha256:j.constructorBlueprintSha256,finalBlueprintSha256:j.finalBlueprintSha256,...(j.payloadVerifierRevision?{payloadVerifierRevision:j.payloadVerifierRevision}:{})}))};report.controls=stages[0].journal.controls;
 for(const field of ['calibration','figureDifferences','propulsionEvidence'])report[field]=Object.fromEntries(stages.map(s=>[s.journal.key,s.journal[field]]));report.figureDigestSha256=Object.fromEntries(stages.map(s=>[s.journal.key,fingerprint(read(path.join(s.directory,'figures.json')))]));
 for(const {journal}of stages)for(const field of ['expectedOwnerGroups','allShaftsAtRequestedCapacity','allOutletsFlow','sourcePayloadPreserved','referencePayloadValid','allAuxiliariesBetweenMainPaths'])if(journal.propulsionEvidence?.[field]!==true)report.physicalVerification.failures.push({scope:journal.key+'-shared-core-layout',field});report.physicalVerification.passed=report.physicalVerification.failures.length===0;
 if(!report.physicalVerification.passed){write(path.join(stages[0].directory,'failed-report.json'),report);throw Error('The scoped physical audit failed; catalogue and figures were not published');}
 const next=G.mergePatches(data,groups.map(group=>read(group.patch)),C,sources),nextFigures={...figures,ships:{...figures.ships,...Object.fromEntries(stages.map(s=>[s.journal.key,read(path.join(s.directory,'figures.json'))]))}};
 assertControls(report.controls,next,nextFigures,KEYS);if(!same(sources,G.sourceHashes(root)))throw Error('Model sources changed before publication');
 write(path.join(root,REPORT),report);
 fs.writeFileSync(path.join(root,'data/fleet.js'),'// Fleet profiles of the editable examples, generated by scripts/update-ship-examples.cjs.\nconst YardFleetData='+JSON.stringify(next)+';\n');
 fs.writeFileSync(figuresFile,JSON.stringify(nextFigures)+'\n');return report;
}
function recheckPayload(root,directory){
 const journalFile=path.join(directory,'journal.json'),current=read(journalFile),originalFile=path.join(directory,'original-payload-journal.json'),raw=fs.readFileSync(fs.existsSync(originalFile)?originalFile:journalFile),journal=JSON.parse(raw),sources=G.sourceHashes(root);if(journal.constructorCalls!==1||journal.phase!=='audited-ready-for-publication'||!same(journal.sourceSha256,sources))throw Error('Matching completed factory evidence is required');
 const {C}=G.loadRuntime(root),blueprintFile=path.join(directory,'blueprints',journal.key+'.json'),blueprint=read(blueprintFile),oldProof=journal.propulsionEvidence,proof=sourcePayloadEvidence(C,blueprint,sourceRecipePayload(C,journal.key),journal.key);
 const revision={method:'Payload verifier counts shield and localShield devices and reads beam duration from the combat specification; all constructor geometry, engineering statistics, fleet profile and complete physical audit remain unchanged.',originalJournalSha256:sha(raw),generationScriptSha256:sha(fs.readFileSync(path.join(directory,'orchestration-source.cjs'))),correctedVerifierScriptSha256:sha(fs.readFileSync(__filename)),blueprintSha256:sha(fs.readFileSync(blueprintFile)),profileSha256:fingerprint(read(path.join(directory,'patch.json')).entries[journal.key].p),figuresSha256:sha(fs.readFileSync(path.join(directory,'figures.json'))),completePhysicsAuditSha256:sha(fs.readFileSync(path.join(directory,'audit.json'))),payloadBeforeSha256:fingerprint({source:oldProof.source,actual:oldProof.actual,sourcePayloadPreserved:oldProof.sourcePayloadPreserved,referencePayloadValid:oldProof.referencePayloadValid}),payloadAfterSha256:fingerprint(proof),...(current.payloadVerifierRevision?{supersededVerifier:current.payloadVerifierRevision}:{})};
 if(!same(sources,G.sourceHashes(root)))throw Error('Model sources changed during payload verification');if(!fs.existsSync(originalFile))fs.writeFileSync(originalFile,raw);write(path.join(directory,'payload-verifier-revision.json'),revision);journal.propulsionEvidence={...oldProof,...proof};journal.payloadVerifierRevision=revision;write(journalFile,journal);return revision;
}
function recheckArchitecture(root,directory){
 const journal=read(path.join(directory,'journal.json')),sources=G.sourceHashes(root);if(journal.constructorCalls!==1||journal.phase!=='audited-ready-for-publication'||!same(journal.sourceSha256,sources))throw Error('Matching completed factory evidence is required');
 const originalFile=path.join(directory,'original-full-audit.json'),oldAuditor=path.join(directory,'original-auditor.cjs');if(!fs.existsSync(originalFile)||!fs.existsSync(oldAuditor))throw Error('Preserve the original full audit and generating verifier before revision');
 const audit=read(originalFile),blueprint=read(path.join(directory,'blueprints',journal.key+'.json')),profile=read(path.join(directory,'patch.json')).entries[journal.key].p,{C}=G.loadRuntime(root),ship=JSON.parse(JSON.stringify(blueprint)),before=fingerprint(audit.models[0].propulsionArchitecture);
 audit.models[0].propulsionArchitecture=A.propulsionArchitectureEvidence(C,ship,profile);
 audit.auditRevision={method:'architecture verifier updated; physics evidence reused from the same actual one-constructor run',originalFullAuditSha256:sha(fs.readFileSync(originalFile)),oldAuditorFileSha256:sha(fs.readFileSync(oldAuditor)),newAuditorFileSha256:sha(fs.readFileSync(require.resolve('./audit-ship-examples.cjs'))),finalBlueprintSha256:fingerprint(blueprint),profileSha256:fingerprint(profile),architectureBeforeSha256:before,architectureAfterSha256:fingerprint(audit.models[0].propulsionArchitecture),inputScope:'Exact unnormalized final public constructor output; no loader defaults or physical fields are changed.'};
 if(!same(sources,G.sourceHashes(root)))throw Error('Model sources changed during architecture verification');write(path.join(directory,'audit.json'),A.summarize(audit));return audit.auditRevision;
}
function main(args=process.argv.slice(2)){
 const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
 if(args[0]==='--publish-from'&&args.length===3)return publish(root,args.slice(1).map(file=>path.resolve(file)));
 if(args[0]==='--recheck-payload'&&args.length===2)return recheckPayload(root,path.resolve(args[1]));
 if(args[0]==='--recheck-architecture'&&args.length===2)return recheckArchitecture(root,path.resolve(args[1]));
 if(args.length===4&&args[0]==='--key'&&args[2]==='--out')return generate(root,path.resolve(args[3]),args[1]);
 throw Error('Usage: --key imperial|onager --out NEW_DIRECTORY | --publish-from IMPERIAL_DIRECTORY ONAGER_DIRECTORY | --recheck-architecture DIRECTORY | --recheck-payload DIRECTORY');
}
module.exports={controls,assertControls,auxiliaryBetweenEvidence,propulsionEvidence,sourcePayload,sourceRecipePayload,sourcePayloadEvidence,generate,publish,recheckArchitecture,recheckPayload};if(require.main===module)try{main();}catch(error){console.error(error.stack||error);process.exitCode=1;}
