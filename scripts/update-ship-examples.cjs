#!/usr/bin/env node
// Refresh the fleet catalogue from the editable examples, without building meshes.
// Examples:
//   node scripts/update-ship-examples.cjs --keys imperial,venator
//   node scripts/update-ship-examples.cjs --keys cr90,nebulonb --patch /tmp/fleet-small.json
//   node scripts/update-ship-examples.cjs --keys cr90 --patch /tmp/fleet.json --audit /tmp/physical.json
//   node scripts/update-ship-examples.cjs --merge /tmp/fleet-small.json
// Unselected entries retain their version and the voyage refreshes them lazily.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const SOURCE_FILES=['data/reference.js','data/imperial2.js','js/core.js'];
const plain=value=>JSON.parse(JSON.stringify(value));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
function sourceHashes(root){return Object.fromEntries(SOURCE_FILES.map(file=>[file,sha(fs.readFileSync(path.join(root,file)))]));}
function loadRuntime(root){
 const context=vm.createContext({console,performance});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 return vm.runInContext('({C:Core,R:Rts,data:YardFleetData})',context);
}
function exampleKeys(C,data){return Object.keys(data.designs).filter(key=>C.DESIGNS[key]&&!C.SHIP_EXAMPLES[key]?.craft&&!key.startsWith('craft_')).sort();}
// The catalogue describes choices; exact surface meshes stay in worker-built
// combat profiles. Keep every engineering figure and explicitly require that
// physical profile before this compact row can sail.
function compactCatalogProfile(profile){
 if(!profile||typeof profile!=='object')throw new Error('Invalid fleet profile metadata');
 const {surface,...metadata}=profile;return {...metadata,catalogOnly:true};
}
function compactCatalogEntry(entry){return {...entry,p:compactCatalogProfile(entry.p)};}
function compactPatch(patch){return {...patch,entries:Object.fromEntries(Object.entries(patch.entries||{}).map(([key,entry])=>[key,compactCatalogEntry(entry)]))};}
function generateEntry(C,R,key,previous,sources,options={}){
 if(!C.DESIGNS[key]||C.SHIP_EXAMPLES[key]?.craft||key.startsWith('craft_'))throw new Error('Not a selectable ship example: '+key);
 if(!previous)throw new Error('Missing fleet metadata: '+key);
 return generateEntryFromShip(C,R,key,C.buildDesign(key),previous,sources,options);
}
// Re-measure an actual saved design through the same engineering pipeline as
// factory generation. Callers must identify saved-layout provenance in their
// report; a replay does not claim that the current factory rebuilt the layout.
function generateEntryFromBlueprint(C,R,key,blueprint,previous,sources,options={}){
 if(!C.DESIGNS[key]||C.SHIP_EXAMPLES[key]?.craft||key.startsWith('craft_'))throw new Error('Not a selectable ship example: '+key);
 if(!previous)throw new Error('Missing fleet metadata: '+key);
 return generateEntryFromShip(C,R,key,C.deserialize(plain(blueprint)),previous,sources,options);
}
function generateEntryFromShip(C,R,key,ship,previous,sources,options={}){
 const measure=()=>generateMeasuredEntry(C,R,key,ship,previous,sources,options);return typeof C.withFrozenStructures==='function'?C.withFrozenStructures(measure):measure();
}
function generateMeasuredEntry(C,R,key,ship,previous,sources,options={}){
 C.syncCompartments(ship);C.remount(ship);C.syncCompartments(ship);
 const stats=C.computeStats(ship),profile=C.fleetProfile(stats,ship.name,ship),info=R.designInfo(stats,profile),blueprint=C.serialize(ship),complement=C.builtinComplement(key);
 if(profile.profileVersion!==C.FLEET_PROFILE_VERSION)throw new Error('Stale generated fleet profile: '+key);
 if(!(info.mass>0)||!Number.isFinite(info.mass)||!Number.isFinite(info.cost))throw new Error('Invalid generated engineering figures: '+key);
 const entry=plain({...previous,key,name:previous.name||C.DESIGNS[key].name||ship.name,cls:stats.cls?.name||previous.cls,p:compactCatalogProfile(profile),info,
  ...(ship.paint?{paint:ship.paint}:{}),...(complement?{air:complement.air||[],ground:complement.ground||[]}:{}),
  model:{profileVersion:C.FLEET_PROFILE_VERSION,costVersion:C.COST_MODEL.version,costSignature:C.costModelSignature(),blueprintSha256:sha(stable(blueprint)),sourceSha256:sources}});
 if(options.onBuilt)options.onBuilt({key,ship,stats,profile,entry,blueprint});
 return entry;
}
function createPatch(C,entries,sources,baselineSha){return {schemaVersion:1,baselineSha,sourceSha256:sources,profileVersion:C.FLEET_PROFILE_VERSION,costVersion:C.COST_MODEL.version,costSignature:C.costModelSignature(),entries:Object.fromEntries(Object.entries(entries).map(([key,entry])=>[key,compactCatalogEntry(entry)]))};}
function mergePatches(data,patches,C,sources,options={}){
 const additions=options.allowNewKeys??[];
 if(!Array.isArray(additions)||new Set(additions).size!==additions.length||additions.some(key=>typeof key!=='string'||data.designs[key]||!C.DESIGNS[key]||!Array.from(C.SHIP_SYSTEM_REFIT_KEYS||[]).includes(key)||C.SHIP_EXAMPLES[key]?.craft||key.startsWith('craft_')))throw new Error('Invalid explicitly approved catalogue additions');
 const allowed=new Set(additions),entries={};
 for(const patch of patches){
  if(patch.schemaVersion!==1||patch.profileVersion!==C.FLEET_PROFILE_VERSION||patch.costVersion!==C.COST_MODEL.version||patch.costSignature!==C.costModelSignature()||stable(patch.sourceSha256)!==stable(sources))throw new Error('Fleet patch was generated from different model sources');
  for(const [key,entry]of Object.entries(patch.entries||{})){
   if((!data.designs[key]&&!allowed.has(key))||!C.DESIGNS[key]||key.startsWith('craft_'))throw new Error('Unknown fleet patch entry: '+key);
   if(entry.key!==key||entry.p?.profileVersion!==C.FLEET_PROFILE_VERSION||entry.model?.profileVersion!==C.FLEET_PROFILE_VERSION||entry.model?.costVersion!==C.COST_MODEL.version||entry.model?.costSignature!==C.costModelSignature()||stable(entry.model?.sourceSha256)!==stable(sources))throw new Error('Inconsistent fleet patch entry: '+key);
   const compact=compactCatalogEntry(entry);if(entries[key]&&stable(entries[key])!==stable(compact))throw new Error('Conflicting fleet patch entries: '+key);
   entries[key]=compact;
  }
 }
 for(const key of additions)if(!entries[key])throw new Error('Approved catalogue addition has no generated entry: '+key);
 return {...plain(data),designs:{...plain(data.designs),...plain(entries)}};
}
function parseArgs(args){
 const options={keys:[],merges:[],check:false,output:null,patch:null,audit:null,list:false,blueprints:null};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(['--output','--patch','--keys','--merge','--audit','--blueprints'].includes(arg)){
   const value=args[++i];if(!value||value.startsWith('--'))throw new Error(arg+' requires a value');
   if(arg==='--keys')options.keys.push(...value.split(',').filter(Boolean));else if(arg==='--merge')options.merges.push(value);else options[arg.slice(2)]=value;
  }else if(arg==='--check')options.check=true;else if(arg==='--list')options.list=true;else if(arg.startsWith('-'))throw new Error('Unknown option: '+arg);else options.keys.push(arg);
 }
 if(options.patch&&(options.output||options.check||options.merges.length))throw new Error('--patch cannot be combined with --output, --check or --merge');
 if(options.merges.length&&options.keys.length)throw new Error('--merge cannot be combined with ship keys');
 if(options.output&&options.check)throw new Error('--output cannot be combined with --check');
 if(options.audit&&options.merges.length)throw new Error('--audit cannot be combined with --merge; audit the generation that builds the physical ships');
 if(options.blueprints&&options.merges.length)throw new Error('--blueprints requires physical generation');
 options.keys=[...new Set(options.keys)];return options;
}
function main(args=process.argv.slice(2)){
 const options=parseArgs(args),root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),sources=sourceHashes(root),{C,R,data}=loadRuntime(root),all=exampleKeys(C,data);
 if(options.list){console.log(all.join('\n'));return;}
 const keys=options.keys.length?options.keys:all;for(const key of keys)if(!all.includes(key))throw new Error('Unknown ship catalogue key: '+key);
 let baselineSha=null;try{baselineSha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}
 const auditTools=options.audit?require('./audit-ship-examples.cjs'):null,audit=options.audit?{source:'current',baselineCommit:baselineSha,sourceSha256:sources,generatedAt:new Date().toISOString(),modelVersion:C.PROPULSION_MODEL_VERSION,profileVersion:C.FLEET_PROFILE_VERSION,allKeys:keys,availableKeys:all,verification:auditTools.verification,sourceValidated:false,models:[]}:null;
 const checkpointAudit=()=>{if(!audit)return;const destination=path.resolve(options.audit),temporary=destination+'.tmp';fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(temporary,JSON.stringify(auditTools.summarize(audit),null,2)+'\n');fs.renameSync(temporary,destination);};
 checkpointAudit();
 let patch;
 if(options.merges.length){
  const patches=[];for(const file of options.merges)patches.push(compactPatch(JSON.parse(fs.readFileSync(path.resolve(file),'utf8'))));
  const merged=mergePatches(data,patches,C,sources);
  patch=createPatch(C,Object.fromEntries([...new Set(patches.flatMap(p=>Object.keys(p.entries)))].map(key=>[key,merged.designs[key]])),sources,baselineSha);
 }else{
  const entries={};for(const key of keys){const started=performance.now();entries[key]=generateEntry(C,R,key,data.designs[key],sources,{onBuilt:({ship,stats,profile,blueprint})=>{if(audit){audit.models.push(auditTools.auditBuilt(C,key,ship,stats,profile));checkpointAudit();}if(options.blueprints){const destination=path.resolve(options.blueprints,key+'.json');fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(blueprint)+'\n');}}});if(options.patch){const destination=path.resolve(options.patch);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination+'.tmp',JSON.stringify(createPatch(C,entries,sources,baselineSha))+'\n');fs.renameSync(destination+'.tmp',destination);}process.stderr.write(`Generated ${key} (${Math.round(performance.now()-started)} ms)\n`);}
  patch=createPatch(C,entries,sources,baselineSha);
 }
 if(stable(sources)!==stable(sourceHashes(root)))throw new Error('Model sources changed during generation; rerun after the implementation is stable');
 if(audit){audit.sourceValidated=true;checkpointAudit();}
 if(options.patch){const destination=path.resolve(options.patch);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(patch)+'\n');console.log(`Generated ${Object.keys(patch.entries).length} ship profiles at ${destination}`);return;}
 if(options.check){const stale=Object.keys(patch.entries).filter(key=>stable(data.designs[key])!==stable(patch.entries[key]));if(stale.length){console.error('Ship fleet catalogue is stale: '+stale.join(', '));process.exitCode=1;}else console.log(`Verified ${Object.keys(patch.entries).length} ship profiles (model ${C.FLEET_PROFILE_VERSION})`);return;}
 const result=mergePatches(data,[patch],C,sources);result.built=new Date().toISOString().slice(0,10);
 const destination=path.resolve(options.output||path.join(root,'data/fleet.js'));fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,'// Fleet profiles of the editable examples, generated by scripts/update-ship-examples.cjs.\nconst YardFleetData='+JSON.stringify(result)+';\n');
 console.log(`Updated ${Object.keys(patch.entries).length} ship profiles (model ${C.FLEET_PROFILE_VERSION}) at ${destination}`);
}
module.exports={SOURCE_FILES,sourceHashes,loadRuntime,exampleKeys,generateEntry,generateEntryFromShip,generateEntryFromBlueprint,createPatch,mergePatches,compactCatalogProfile,compactCatalogEntry,compactPatch,parseArgs,stable};
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
