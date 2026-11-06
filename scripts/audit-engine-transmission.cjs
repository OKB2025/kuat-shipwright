#!/usr/bin/env node
// Inspect the generated engine routes of saved layouts without a full stats pass.
// The final factory audit remains scripts/update-ship-examples.cjs --audit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {loadRuntime,sourceHashes,stable}=require('./update-ship-examples.cjs');
const {engineTransmissionEvidence}=require('./audit-ship-examples.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function main(args=process.argv.slice(2)){
 const options={};
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(!['--blueprints','--keys','--output'].includes(arg))throw new Error('Unknown option: '+arg);
  const value=args[++i];if(!value||value.startsWith('--'))throw new Error(arg+' requires a value');options[arg.slice(2)]=value;
 }
 if(!options.blueprints)throw new Error('--blueprints is required');
 const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),directory=path.resolve(options.blueprints),sources=sourceHashes(root),{C}=loadRuntime(root);
 if(typeof C.engineTransmission!=='function')throw new Error('Current model does not expose physical engine transmission');
 const keys=options.keys?options.keys.split(',').filter(Boolean):fs.readdirSync(directory).filter(file=>file.endsWith('.json')).map(file=>file.slice(0,-5)).sort();
 const out={scope:'Saved-layout routing probe, without stock reconstruction or full mass/power/heat statistics.',sourceSha256:sources,sourceValidated:false,generatedAt:new Date().toISOString(),allKeys:keys,models:[]};
 const checkpoint=()=>{if(!options.output)return;const file=path.resolve(options.output);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(out,null,2)+'\n');fs.renameSync(file+'.tmp',file);};
 for(const key of keys){
  process.stderr.write('Probing '+key+'\n');
  const started=performance.now(),text=fs.readFileSync(path.join(directory,key+'.json'),'utf8'),ship=C.deserialize(JSON.parse(text)),evidence=engineTransmissionEvidence(C,ship);
  out.models.push({key,name:ship.name,blueprintSha256:sha(text),elapsedSeconds:+((performance.now()-started)/1000).toFixed(3),transmission:evidence});checkpoint();
  process.stderr.write(JSON.stringify({key,elapsedSeconds:out.models.at(-1).elapsedSeconds,electricalRoutes:evidence.routeCount,invalidElectricalRoutes:evidence.invalidRouteCount,mechanicalRoutes:evidence.drivetrain?.routeCount||0,invalidMechanicalRoutes:evidence.drivetrain?.invalidRouteCount||0,unpoweredEngines:evidence.disconnectedEngineIds,conduitCrossings:evidence.combinedConduitSurvey?.crossings.length||0})+'\n');
 }
 if(stable(sources)!==stable(sourceHashes(root)))throw new Error('Model sources changed during routing probe');
 out.sourceValidated=true;const networkSummary=field=>{
  const rows=out.models.map(row=>({key:row.key,network:field?row.transmission[field]:row.transmission})).filter(row=>row.network);
  return {routeCount:rows.reduce((n,row)=>n+row.network.routeCount,0),partCount:rows.reduce((n,row)=>n+row.network.partCount,0),invalidRoutes:rows.flatMap(row=>row.network.routes.filter(route=>!route.valid).map(route=>({key:row.key,id:route.id,reason:route.reason}))),limitedRoutes:rows.flatMap(row=>row.network.routes.filter(route=>route.limited).map(route=>({key:row.key,id:route.id,capacityW:route.capacityW,requestedCapacityW:route.requestedCapacityW}))),disconnectedEngines:rows.flatMap(row=>row.network.disconnectedEngineIds.map(id=>({key:row.key,id}))),geometryFailures:rows.filter(row=>row.network.independentOutsideSamples||row.network.independentHardObstacleIds.length||row.network.externalEntryFailures.length||row.network.terminalContactFailures?.length).map(row=>({key:row.key,outsideSamples:row.network.independentOutsideSamples,hardObstacleIds:row.network.independentHardObstacleIds,externalEntries:row.network.externalEntryFailures,terminalContacts:row.network.terminalContactFailures||[]})),ledgerFailures:rows.filter(row=>!row.network.volumeConsistent||row.network.duplicateRouteIds.length||row.network.routes.some(route=>!route.capacityConsistent||!route.volumeConsistent||!route.efficiencyConsistent)).map(row=>row.key)};
 };
 out.summary={ships:out.models.length,electrical:networkSummary(null),mechanical:networkSummary('drivetrain'),conduitCrossings:out.models.flatMap(row=>(row.transmission.combinedConduitSurvey?.crossings||[]).map(crossing=>({key:row.key,...crossing})))};checkpoint();
 if(!options.output)process.stdout.write(JSON.stringify(out,null,2)+'\n');
 return out;
}
module.exports={main};
if(require.main===module){try{main();}catch(error){console.error(error.stack||error);process.exitCode=1;}}
