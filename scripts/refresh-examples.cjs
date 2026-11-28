#!/usr/bin/env node
// Regenerate the example files (scripts/example-files.cjs) with the authoring tool.
//
//   node scripts/refresh-examples.cjs [--keys a,b] [--jobs 3]
//
// The examples are saved designs: the game opens data/examples/<key>/design.json.gz like a user's
// save and never rebuilds them. This script is how an author changes them on purpose (a new or
// corrected example, a new calculation-model version): every selected example is rebuilt by
// Core.buildDesign in its own process. Catalogue ships get their design and their combat row (computed
// from that design); craft and the older sample designs get their design only. A side whose content
// changed is rewritten; an unchanged side is left as it is. data/fleet.js is then assembled from the
// files. Nothing is written unless every selected example builds (a failed run leaves the repository as it was). Nothing here depends on the hashes of the source files.
//
// A model change that alters computed figures needs a version bump (Core.EXAMPLE_PROFILE_VERSION, see
// docs/prepared-examples.md) and then this refresh, so the stored rows carry the new model.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const F=require('./example-files.cjs'),G=require('./update-ship-examples.cjs');
// The largest ships first, so the long builds overlap the short ones.
const HEAVY=['subjugator','executor','mandator2','lucrehulk','lh3210','mc80liberty','recusant','recusantDn','providenceDn','providence','munificent'];
function parse(args){
 const o={keys:[],jobs:3,worker:null,out:null};
 for(let i=0;i<args.length;i++){const a=args[i];
  if(a==='--keys')o.keys.push(...String(args[++i]||'').split(',').filter(Boolean));
  else if(a==='--jobs')o.jobs=Math.max(1,Math.floor(Number(args[++i])||1));
  else if(a==='--worker')o.worker=args[++i];else if(a==='--out')o.out=args[++i];
  else throw Error('Unknown option: '+a);}
 return o;
}
// Build one ship and leave its row and blueprint in out/<key>.row.json and out/<key>.blueprint.json.
function worker(root,key,out){
 // Test hook (tests/refresh-examples-atomic.cjs): the listed examples fail on purpose.
 if(String(process.env.KS_REFRESH_FAIL_KEYS||'').split(',').includes(key))throw Error('forced failure for '+key);
 const sources=G.sourceHashes(root),{C,R,data,E}=G.loadRuntime(root,{engine:true});let blueprint=null,entry=null,prepared=null;
 // The saved design is made by the authoring tool; a catalogue ship's row is then computed from that saved design
 // loaded back (deserialize and the ordinary load steps), the path the game takes, so the stored figures equal
 // what the game computes for the design it opens (2026-11-12: the in-memory build differed by up to 5e-4 on
 // six ships). The row names the saved design by the stable hash of the file written here.
 // The design is serialized after the authoring build's own statistics run, as before (generateBlueprint alone
 // gives a different venator design), so the stored designs do not change; the row is then computed again from it.
 // 2026-11-27 a ship with surface sections also gets its prepared figures (example-files.cjs prepared.json.gz): the surface part of
 // the profile and the display statistics, from the same measurement as its row, so the game's worker can fly or fight it without the
 // performance calculation (user「公試だけでなく艦隊戦も読み込めるように」).
 if(G.exampleKeys(C,data).includes(key)){G.generateEntry(C,R,key,data.designs[key],sources,{onBuilt:b=>{blueprint=b.blueprint;}});
  entry=G.compactCatalogEntry(G.generateEntryFromBlueprint(C,R,key,JSON.parse(JSON.stringify(blueprint)),data.designs[key],sources));entry.model={...entry.model,blueprintSha256:F.sha(F.stable(blueprint))};
  // The prepared figures are worked out by the game worker's own steps for an example (js/engine.js handleFleet: deserialize the
  // saved design, remount keeping the fit pose, derive the compartments, then computeStats, fleetProfile and statsOut). The row's
  // steps (generateMeasuredEntry) derive the compartments twice and gave an Imperial-class a different exposed share in one
  // module (0.081 against 0.071), so the whole profile is stored from the worker's steps and stands for the computation.
  if(entry.model.surface){const d=C.deserialize(JSON.parse(JSON.stringify(blueprint)));C.remount(d,{keepFitPose:true});C.syncCompartments(d);const S=C.computeStats(d),p=C.fleetProfile(S,d.name,d);
   prepared={format:'ks-example-prepared',v:2,key,modelKey:C.profileModelKey(),displayKey:E.displayProjectionHash(),blueprintSha256:entry.model.blueprintSha256,profile:p,displayStats:E.statsOut(S,d)};}}
 else blueprint=G.generateBlueprint(C,key);
 if(G.stable(sources)!==G.stable(G.sourceHashes(root)))throw Error('Model sources changed while building '+key);
 fs.writeFileSync(path.join(out,key+'.blueprint.json'),JSON.stringify(blueprint));
 fs.writeFileSync(path.join(out,key+'.row.json'),JSON.stringify({entry,sources}));
 if(prepared)fs.writeFileSync(path.join(out,key+'.prepared.json'),JSON.stringify(prepared,E.preparedReplacer));
}
function run(root,key,out){return new Promise(resolve=>{const started=Date.now(),child=spawn(process.execPath,['--max-old-space-size=4096',__filename,'--worker',key,'--out',out],{cwd:root,stdio:['ignore','ignore','pipe']});let err='';child.stderr.on('data',d=>{err+=d;});child.on('close',code=>resolve({key,code,err:err.trim().split('\n').slice(-3).join(' '),ms:Date.now()-started}));});}
async function main(){
 const o=parse(process.argv.slice(2)),root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
 if(o.worker){worker(root,o.worker,o.out);return;}
 const sources=G.sourceHashes(root),{C,data}=G.loadRuntime(root),all=[...G.exampleKeys(C,data),...G.designOnlyKeys(C,data)],keys=o.keys.length?o.keys:all;
 for(const key of keys)if(!all.includes(key))throw Error('Unknown example key: '+key);
 const order=[...keys].sort((a,b)=>(HEAVY.indexOf(a)<0?99:HEAVY.indexOf(a))-(HEAVY.indexOf(b)<0?99:HEAVY.indexOf(b))),out=fs.mkdtempSync(path.join(os.tmpdir(),'ks-refresh-')),manifest=F.readManifest(root),report=[],failed=[];
 let next=0;const lane=async()=>{while(next<order.length){const key=order[next++],r=await run(root,key,out);
  if(r.code!==0){failed.push(key+': '+r.err);console.error(`${key} failed: ${r.err}`);continue;}
  const {entry}=JSON.parse(fs.readFileSync(path.join(out,key+'.row.json'),'utf8')),raw=fs.readFileSync(path.join(out,key+'.blueprint.json'));
  if(entry&&F.sha(F.stable(JSON.parse(raw.toString('utf8'))))!==entry.model.blueprintSha256){failed.push(key+': Blueprint does not match its catalogue row');console.error(`${key} failed: blueprint does not match its row`);continue;}
  const pf=path.join(out,key+'.prepared.json'),preparedRaw=fs.existsSync(pf)?fs.readFileSync(pf):entry?null:undefined;
  built.push({key,entry,raw,preparedRaw,ms:r.ms});console.log(`${key.padEnd(14)} built ${Math.round(r.ms/1000)} s`);}};
 // Audit 2026-11-16: nothing is written until every selected example has built and the model sources are unchanged.
 // Writing each example as it finished left data/examples rewritten without data/fleet.js and the manifest when a
 // later example failed (the stored files and their hashes then disagreed). On a failure the repository is untouched.
 const built=[];
 try{await Promise.all(Array.from({length:Math.min(o.jobs,order.length)},lane));}finally{fs.rmSync(out,{recursive:true,force:true});}
 if(G.stable(sources)!==G.stable(G.sourceHashes(root)))throw Error('Model sources changed during the refresh; nothing was written. Run it again once they are stable');
 if(failed.length)throw Error('Failed (nothing was written): '+failed.join(' | '));
 for(const {key,entry,raw,preparedRaw,ms} of built.sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key))){const changed=F.storeShip(root,manifest,key,{row:entry,blueprintRaw:raw,preparedRaw});
  report.push({key,...changed,seconds:Math.round(ms/1000)});console.log(`${key.padEnd(14)} design ${changed.design.padEnd(9)} combat ${String(changed.combat||'-').padEnd(9)} prepared ${String(changed.prepared||'-')}`);}
 manifest.built=new Date().toISOString().slice(0,10);F.writeManifest(root,manifest);F.assemble(root);
 console.log(`Refreshed ${report.length} examples: ${report.filter(r=>r.design==='updated').length} design and ${report.filter(r=>r.combat==='updated').length} combat files rewritten, the rest unchanged`);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={parse};
