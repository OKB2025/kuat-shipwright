#!/usr/bin/env node
// v24 Refresh the generated example files (scripts/example-files.cjs) after a change to the model.
//
//   node scripts/refresh-examples.cjs [--keys a,b] [--jobs 3]
//
// Every selected ship is rebuilt in its own process, from the current data/reference.js,
// data/imperial2.js and js/core.js. For each ship its design (the blueprint) and its combat data (the
// catalogue row) are compared with the stored files: a side that changed is rewritten, a side that did
// not is only restamped with the current model sources in data/examples/manifest.json. data/fleet.js is
// then assembled from the files. A change that leaves a ship's results unchanged therefore touches no
// ship file, only the manifest and the assembled catalogue.
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
 const sources=G.sourceHashes(root),{C,R,data}=G.loadRuntime(root);let blueprint=null;
 const entry=G.compactCatalogEntry(G.generateEntry(C,R,key,data.designs[key],sources,{onBuilt:b=>{blueprint=b.blueprint;}}));
 if(G.stable(sources)!==G.stable(G.sourceHashes(root)))throw Error('Model sources changed while building '+key);
 fs.writeFileSync(path.join(out,key+'.blueprint.json'),JSON.stringify(blueprint));
 fs.writeFileSync(path.join(out,key+'.row.json'),JSON.stringify({entry,sources}));
}
function run(root,key,out){return new Promise(resolve=>{const started=Date.now(),child=spawn(process.execPath,['--max-old-space-size=4096',__filename,'--worker',key,'--out',out],{cwd:root,stdio:['ignore','ignore','pipe']});let err='';child.stderr.on('data',d=>{err+=d;});child.on('close',code=>resolve({key,code,err:err.trim().split('\n').slice(-3).join(' '),ms:Date.now()-started}));});}
async function main(){
 const o=parse(process.argv.slice(2)),root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
 if(o.worker){worker(root,o.worker,o.out);return;}
 const sources=G.sourceHashes(root),{C,data}=G.loadRuntime(root),all=G.exampleKeys(C,data),keys=o.keys.length?o.keys:all;
 for(const key of keys)if(!all.includes(key))throw Error('Unknown ship catalogue key: '+key);
 const order=[...keys].sort((a,b)=>(HEAVY.indexOf(a)<0?99:HEAVY.indexOf(a))-(HEAVY.indexOf(b)<0?99:HEAVY.indexOf(b))),out=fs.mkdtempSync(path.join(os.tmpdir(),'ks-refresh-')),manifest=F.readManifest(root),report=[],failed=[];
 let next=0;const lane=async()=>{while(next<order.length){const key=order[next++],r=await run(root,key,out);
  if(r.code!==0){failed.push(key+': '+r.err);console.error(`${key} failed: ${r.err}`);continue;}
  const {entry,sources:built}=JSON.parse(fs.readFileSync(path.join(out,key+'.row.json'),'utf8')),raw=fs.readFileSync(path.join(out,key+'.blueprint.json'));
  if(F.sha(F.stable(JSON.parse(raw.toString('utf8'))))!==entry.model.blueprintSha256)throw Error('Blueprint does not match its catalogue row: '+key);
  const changed=F.storeShip(root,manifest,key,{row:entry,blueprintRaw:raw,sources:built});
  report.push({key,...changed,seconds:Math.round(r.ms/1000)});console.log(`${key.padEnd(14)} design ${changed.design.padEnd(9)} combat ${changed.combat.padEnd(9)} ${Math.round(r.ms/1000)} s`);}};
 await Promise.all(Array.from({length:Math.min(o.jobs,order.length)},lane));
 fs.rmSync(out,{recursive:true,force:true});
 if(G.stable(sources)!==G.stable(G.sourceHashes(root)))throw Error('Model sources changed during the refresh; run it again once they are stable');
 if(failed.length){F.writeManifest(root,manifest);throw Error('Failed: '+failed.join(' | '));}
 manifest.built=new Date().toISOString().slice(0,10);F.writeManifest(root,manifest);F.assemble(root);
 const n=s=>report.filter(r=>r.design===s||r.combat===s).length;
 console.log(`Refreshed ${report.length} ships: ${report.filter(r=>r.design==='updated').length} design and ${report.filter(r=>r.combat==='updated').length} combat files rewritten; ${n('unchanged')} restamped only where unchanged`);
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={parse};
