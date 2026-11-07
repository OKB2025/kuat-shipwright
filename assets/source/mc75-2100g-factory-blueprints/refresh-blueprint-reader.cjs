#!/usr/bin/env node
// Re-measure persisted factory designs without claiming a fresh factory build.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const G=require('./update-ship-examples.cjs'),A=require('./audit-ship-examples.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function compare(a,b,tolerance=1e-9){
 const out={exact:G.stable(a)===G.stable(b),relativeTolerance:tolerance,numericDifferences:0,nonNumericDifferences:0,maximumRelativeDifference:0,examples:[]};
 const walk=(x,y,where)=>{
  if(Object.is(x,y))return;
  if(typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)){
   const relative=Math.abs(x-y)/Math.max(1,Math.abs(x),Math.abs(y));out.numericDifferences++;out.maximumRelativeDifference=Math.max(out.maximumRelativeDifference,relative);if(relative>tolerance&&out.examples.length<12)out.examples.push({path:where,before:x,after:y,relativeDifference:relative});return;
  }
  if(x&&y&&typeof x==='object'&&typeof y==='object'&&Array.isArray(x)===Array.isArray(y)){
   for(const key of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[key],y[key],where+(Array.isArray(x)?'['+key+']':'.'+key));return;
  }
  out.nonNumericDifferences++;if(out.examples.length<12)out.examples.push({path:where,before:x,after:y});
 };walk(a,b,'$');out.withinTolerance=out.nonNumericDifferences===0&&out.maximumRelativeDifference<=tolerance;return out;
}
function priorNetworkSchema(network){
 if(!network)return network;const out=JSON.parse(JSON.stringify(network));delete out.terminalContactFailures;
 for(const route of out.routes||[]){delete route.terminalContact;for(const entry of route.externalEntries||[])delete entry.contactScope;}
 if(out.drivetrain)out.drivetrain=priorNetworkSchema(out.drivetrain);return out;
}
function priorAuditSchema(audit){const out=JSON.parse(JSON.stringify(audit));delete out.timingSeconds;out.engineTransmission=priorNetworkSchema(out.engineTransmission);return out;}
function compareBlueprintInputs(C,input,output){
 const before=JSON.parse(JSON.stringify(input)),after=JSON.parse(JSON.stringify(output)),normalizations=[],same=(a,b)=>G.stable(a)===G.stable(b),own=(o,k)=>Object.hasOwn(o,k),copy=v=>JSON.parse(JSON.stringify(v)),f32=values=>{const typed=Float32Array.from(values);return sha(Buffer.from(typed.buffer));};
 const roomEvidence=source=>{const p=copy(source);return {dims:C.partDims(p),bounds:C.partAABB(p),volumeM3:C.partVolume(p),areaM2:C.partArea(p),reactorPowerW:C.isReactor(p)?C.reactorPower(p):null,hangarCapacity:C.hangarCapacity(p),triangleFloat32Sha256:f32(C.structTriangles(C.roomShape(p)))};};
 const numericDelta=(a,b)=>{let maximum=0,invalid=false;const walk=(x,y)=>{if(Object.is(x,y))return;if(typeof x==='number'&&typeof y==='number'&&Number.isFinite(x)&&Number.isFinite(y)){maximum=Math.max(maximum,Math.abs(x-y));return;}if(x&&y&&typeof x==='object'&&typeof y==='object'&&Array.isArray(x)===Array.isArray(y)){for(const key of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[key],y[key]);}else invalid=true;};walk(a,b);return {maximum,invalid};};
 for(const fit of after.fits||[]){
  const original=(before.fits||[]).find(f=>f.id===fit.id);if(!original||original.k!==fit.k)continue;
  if(C.FITS[fit.k]?.window)for(const [field,value]of [['slope',0],['commandEnabled',true]])if(!own(original,field)&&own(fit,field)&&fit[field]===value){normalizations.push({type:'explicit-window-default',fitId:fit.id,kind:fit.k,field,value});delete fit[field];}
  if(!own(original,'n')&&Array.isArray(original.tilt)&&original.tilt.length===3&&original.tilt.every(Number.isFinite)&&C.len(original.tilt)>.5&&same(fit.n,original.tilt)){
   const alias=copy(original);alias.n=fit.n.slice();const oldFrame=C.fitFrameOf(copy(original)),newFrame=C.fitFrameOf(copy(alias)),oldBounds=C.fitAABB(copy(original)),newBounds=C.fitAABB(copy(alias));if(same(oldFrame,newFrame)&&same(oldBounds,newBounds)){normalizations.push({type:'normal-from-existing-tilt',fitId:fit.id,kind:fit.k,normal:fit.n.slice(),exactFrame:oldFrame,exactBounds:oldBounds});delete fit.n;}
  }
  if(original.mountSupport&&fit.mountSupport){
   const fields=['base','low','slope','mountSupport'],oldFields=Object.fromEntries(fields.map(k=>[k,original[k]])),newFields=Object.fromEntries(fields.map(k=>[k,fit[k]]));
   if(!compare(oldFields,newFields,1e-12).withinTolerance){const delta=numericDelta(oldFields,newFields),worldScale=Math.max(1,...original.p.map(Math.abs)),worldUlp=2**(Math.floor(Math.log2(worldScale))-52),oldGeometry=C.turretSupportGeometry(copy(original)),newGeometry=C.turretSupportGeometry(copy(fit));
    const anchorComparison=compare(original.p,fit.p,1e-12),sameTopology=original.mountSupport.version===fit.mountSupport.version&&same(original.mountSupport.polys.map(p=>p.length),fit.mountSupport.polys.map(p=>p.length)),f64=values=>{const typed=Float64Array.from(values);return sha(Buffer.from(typed.buffer));};
    const exactWorldRebase=!delta.invalid&&anchorComparison.withinTolerance&&sameTopology&&oldGeometry&&newGeometry&&f64(oldGeometry.triangles)===f64(newGeometry.triangles)&&f32(oldGeometry.triangles)===f32(newGeometry.triangles)&&oldGeometry.volume===newGeometry.volume&&same(oldGeometry.bounds,newGeometry.bounds)&&same(C.fitFrameOf(copy(original)),C.fitFrameOf(copy(fit)))&&same(C.fitAABB(copy(original)),C.fitAABB(copy(fit)));
    const boundedRoundoff=!delta.invalid&&delta.maximum<=4*worldUlp&&anchorComparison.withinTolerance&&oldGeometry&&newGeometry&&f32(oldGeometry.triangles)===f32(newGeometry.triangles)&&Math.abs(oldGeometry.volume-newGeometry.volume)<=Math.max(1,Math.abs(oldGeometry.volume))*1e-12;
    if(exactWorldRebase||boundedRoundoff){normalizations.push({type:exactWorldRebase?'exact-world-support-rebase':'derived-support-roundoff',fitId:fit.id,kind:fit.k,maximumAbsoluteDifferenceM:delta.maximum,worldCoordinateUlpM:worldUlp,maximumWorldUlps:delta.maximum/worldUlp,anchorBeforeM:original.p.slice(),anchorAfterM:fit.p.slice(),anchorComparison,...(exactWorldRebase?{supportTopology:{version:original.mountSupport.version,verticesPerPolygon:original.mountSupport.polys.map(p=>p.length)},worldDoubleSha256:f64(oldGeometry.triangles),exactWorldBounds:oldGeometry.bounds}:{}),worldFloat32Sha256:f32(oldGeometry.triangles),supportVolumeBeforeM3:oldGeometry.volume,supportVolumeAfterM3:newGeometry.volume});for(const field of fields)if(own(original,field))fit[field]=copy(original[field]);else delete fit[field];}
   }
  }
 }
 for(const part of after.parts||[]){
  const original=(before.parts||[]).find(p=>p.id===part.id);if(!original||original.k!==part.k)continue;
  if(original.form==='shell'&&part.form==='shell'&&original.shellFlip===false&&!own(part,'shellFlip')){normalizations.push({type:'false-shell-default',partId:part.id,field:'shellFlip',before:false,after:'absent'});part.shellFlip=false;}
  const roomKind=C.PARTS[part.k]?.shape==='cube'||['aux','inertial'].includes(part.k);
  if(roomKind&&Array.isArray(original.room)&&original.room.length===3&&original.room.every(v=>Number.isFinite(v)&&v>0)&&same(original.room,part.room)&&same(original.outline,part.outline)&&same(original.c,part.c)&&original.d!==part.d&&part.d===Math.cbrt(part.room.reduce((n,v)=>n*v,1))){const oldGeometry=roomEvidence(original),newGeometry=roomEvidence(part);if(same(oldGeometry,newGeometry)){normalizations.push({type:'room-derived-display-diameter',partId:part.id,kind:part.k,before:original.d,after:part.d,exactRoomDimensions:original.room.slice(),exactGeometryAndCapacity:oldGeometry});part.d=original.d;}}
 }
 const assemblyGuide=before.hull?.assembly===true&&after.hull?.assembly===true&&![...(before.parts||[]),...(after.parts||[])].some(p=>p.form==='hull');
 if(assemblyGuide){for(const [field,value]of [['deckWidth',.52],['belt',.13]])if(!own(before.hull,field)&&after.hull[field]===value){normalizations.push({type:'unused-assembly-guide-default',field,value});delete after.hull[field];}if(before.hull.name==='楔形'&&!own(after.hull,'name')){normalizations.push({type:'unused-assembly-guide-preset-label',before:'楔形',after:'absent'});after.hull.name=before.hull.name;}}
 if(!own(before,'shieldTarget')&&after.shieldTarget===1){normalizations.push({type:'explicit-shield-target-default',value:1});delete after.shieldTarget;}
 const rawComparison=compare(input,output,1e-12),remainingComparison=compare(before,after,1e-12);return {rawComparison,acceptedEquivalentNormalizations:normalizations,remainingComparison,physicalInputEquivalent:remainingComparison.withinTolerance,scope:'The raw serialized comparison stays visible. A second comparison at the same 1e-12 tolerance excludes only individually proven control defaults, geometry-neutral room diameter, an unused assembly guide label/default, an existing tilt alias, bounded Float32-identical support roundoff, or an exact-world support coordinate rebase. No authored hardware, pose, room, source or rating changes are accepted.'};
}
function readBlueprint(directory,key,manifest){
 const record=manifest?.models?.[key],candidate=record?path.resolve(directory,record.file):[key+'.json',key+'.json.gz'].map(file=>path.resolve(directory,file)).find(file=>fs.existsSync(file));if(!candidate)throw Error('Missing saved blueprint: '+key);
 const fileBytes=fs.readFileSync(candidate),raw=candidate.endsWith('.gz')?zlib.gunzipSync(fileBytes):fileBytes,blueprint=JSON.parse(raw),canonicalSha256=sha(G.stable(blueprint));
 if(record&&(record.sha256!==sha(raw)||record.gzipSha256!==sha(fileBytes)||record.canonicalSha256!==canonicalSha256))throw Error('Source blueprint checksum mismatch: '+key);
 return {inputFile:candidate,fileBytes,raw,blueprint,canonicalSha256,record};
}
function main(args=process.argv.slice(2)){
 const options={};for(let i=0;i<args.length;i++){const arg=args[i];if(!['--keys','--input-blueprints','--baseline-prefix','--patch','--audit','--blueprints'].includes(arg))throw Error('Unknown option: '+arg);const value=args[++i];if(!value||value.startsWith('--'))throw Error(arg+' requires a value');options[arg.slice(2)]=value;}
 for(const key of ['keys','patch','audit'])if(!options[key])throw Error('--'+key+' is required');
 const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),sources=G.sourceHashes(root),{C,R,data}=G.loadRuntime(root),keys=options.keys.split(',').filter(Boolean),inputDirectory=path.resolve(options['input-blueprints']||path.join(root,'assets/source/ship-example-blueprints')),manifestFile=path.join(inputDirectory,'manifest.json'),manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile)):null,oldEntries=new Map(),oldModels=new Map(),baselineFiles=[];let baselineSources=manifest?.factorySourceSha256||null,baselineSha=manifest?.factoryBaselineCommit||null;
 if(!manifest&&!options['baseline-prefix'])throw Error('An input manifest or --baseline-prefix is required to authenticate saved blueprints');
 for(const group of options['baseline-prefix']?['executor','subjugator','b1','b3','a','b2']:[]){
  const patchFile=options['baseline-prefix']+'-'+group+'.json',auditFile=options['baseline-prefix']+'-audit-'+group+'.json',patch=JSON.parse(fs.readFileSync(patchFile)),audit=JSON.parse(fs.readFileSync(auditFile));
  if(!audit.sourceValidated||!audit.complete||G.stable(patch.sourceSha256)!==G.stable(audit.sourceSha256))throw Error('Unvalidated factory baseline: '+group);
  if(baselineSources&&G.stable(baselineSources)!==G.stable(audit.sourceSha256))throw Error('Mixed factory source revisions');baselineSources=audit.sourceSha256;baselineSha=patch.baselineSha;
  baselineFiles.push({patch:path.resolve(patchFile),patchSha256:sha(fs.readFileSync(patchFile)),audit:path.resolve(auditFile),auditSha256:sha(fs.readFileSync(auditFile))});
  for(const [key,entry]of Object.entries(patch.entries))oldEntries.set(key,entry);for(const model of audit.models)oldModels.set(model.key,model);
 }
 const out={source:'current-saved-blueprint-replay',baselineCommit:baselineSha,sourceSha256:sources,generatedAt:new Date().toISOString(),modelVersion:C.PROPULSION_MODEL_VERSION,profileVersion:C.FLEET_PROFILE_VERSION,allKeys:keys,availableKeys:keys,verification:A.verification,sourceValidated:false,factoryBaseline:{method:'Previously completed fresh factory generation; the current run replays those saved physical designs.',sourceSha256:baselineSources,...(manifest?{manifest:path.relative(root,manifestFile),manifestSha256:sha(fs.readFileSync(manifestFile))}:{}),files:baselineFiles},models:[]},entries={};
 const write=(file,value)=>{const dest=path.resolve(file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest+'.tmp',JSON.stringify(value,null,2)+'\n');fs.renameSync(dest+'.tmp',dest);};
 const checkpoint=()=>write(options.audit,A.summarize(out));
 for(const key of keys){
  const started=performance.now(),{inputFile,fileBytes,raw,blueprint:input,canonicalSha256:inputCanonicalSha,record}=readBlueprint(inputDirectory,key,manifest),before=oldEntries.get(key),oldAudit=oldModels.get(key);if(options['baseline-prefix']&&(!before||!oldAudit))throw Error('Missing factory baseline: '+key);
  if(before&&inputCanonicalSha!==before.model.blueprintSha256)throw Error('Saved input differs from factory baseline: '+key);
  entries[key]=G.generateEntryFromBlueprint(C,R,key,input,data.designs[key],sources,{onBuilt:({ship,stats,profile,blueprint,entry})=>{
   const factoryProvenance=oldAudit?{baselinePowerW:oldAudit.plant.baselinePowerW,addedReactorCount:oldAudit.plant.addedReactorCount,originalEngineOutlets:oldAudit.engineOutlets.rows.map(row=>({id:row.id,p:row.originalPositionM}))}:record.factoryEvidence,row=A.auditBuilt(C,key,ship,stats,profile,{factoryProvenance}),unavailable={available:false,reason:'No historical engineering result tables were supplied; this run independently recomputes current physics from the authenticated source blueprint.'};
   row.replay={method:'deserialize-sync-remount-computeStats-fleetProfile-fullAudit',inputFile:path.relative(root,inputFile),inputFileSha256:sha(raw),...(inputFile.endsWith('.gz')?{inputGzipSha256:sha(fileBytes)}:{}),inputCanonicalSha256:inputCanonicalSha,inputFactorySourceSha256:baselineSources,outputCanonicalSha256:sha(G.stable(blueprint)),serializedInputUnchanged:G.stable(blueprint)===G.stable(input),serializedInputParity:compare(input,blueprint,1e-12),inputEquivalence:compareBlueprintInputs(C,input,blueprint),profileParity:before?compare(before.p,entry.p):unavailable,engineeringParity:before?compare(before.info,entry.info):unavailable,routingParity:oldAudit?compare(priorNetworkSchema(oldAudit.engineTransmission),priorNetworkSchema(row.engineTransmission)):unavailable,capacitorParity:oldAudit?compare(oldAudit.capacitors,row.capacitors):unavailable,outletParity:oldAudit?compare(oldAudit.engineOutlets,row.engineOutlets):unavailable,auditParity:oldAudit?compare(priorAuditSchema(oldAudit),priorAuditSchema(row)):unavailable,paritySchemaScope:'Prior published physical audit fields. Wall-clock timings, explanatory contactScope text and newly added terminalContact/terminalContactFailures diagnostics are excluded from parity only; the complete new contact evidence remains independently audited above.'};
   entry.model.provenance={method:'saved-blueprint-replay',factorySourceSha256:baselineSources,inputBlueprintSha256:inputCanonicalSha};out.models.push(row);checkpoint();
   if(options.blueprints)write(path.join(options.blueprints,key+'.json'),blueprint);
  }});write(options.patch,G.createPatch(C,entries,sources,baselineSha));process.stderr.write('Replayed '+key+' ('+Math.round(performance.now()-started)+' ms)\n');
 }
 if(G.stable(sources)!==G.stable(G.sourceHashes(root)))throw Error('Model sources changed during saved-layout replay');out.sourceValidated=true;checkpoint();
 process.stdout.write(JSON.stringify({models:out.models.length,sourceValidated:out.sourceValidated,sourceSha256:sources,serializedInputsChanged:out.models.filter(m=>!m.replay.serializedInputUnchanged).map(m=>m.key),historicalParityAvailable:!!options['baseline-prefix'],numericParityChanged:out.models.filter(m=>m.replay.profileParity.available!==false&&(!m.replay.profileParity.withinTolerance||!m.replay.engineeringParity.withinTolerance||!m.replay.auditParity.withinTolerance)).map(m=>({key:m.key,profile:m.replay.profileParity,engineering:m.replay.engineeringParity,audit:m.replay.auditParity}))})+'\n');return out;
}
module.exports={main,compare,compareBlueprintInputs,readBlueprint};if(require.main===module){try{main();}catch(error){console.error(error.stack||error);process.exitCode=1;}}
