#!/usr/bin/env node
// Check the examples' prepared combat rows against their saved designs, and stamp the rows' calculation-model key.
//
//   node scripts/check-example-profiles.cjs --out <dir> [--keys a,b] [--jobs 3]   recompute and compare (writes only <dir>)
//   node scripts/check-example-profiles.cjs --out <dir> --stamp                  also write model.modelKey into the rows that match
//
// The game uses an example's row as the ship's combat profile while row.model.modelKey is Core.profileModelKey()
// (js/engine.js, 2026-11-23: 「データそのものにどのバージョンで作ったかを表示するようにして、現行のバージョンでなければ再生成、現行
// のバージョンならそのまま」). Each example's saved design is loaded as the engine loads it (deserialize, syncCompartments,
// remount keeping the poses, syncCompartments) and its profile computed; a row is stamped only when the profile is the
// row's (numbers to a relative 1e-9; the surface meshes, which the row leaves out, are not compared). A row that differs is
// reported and left unstamped: the engine then computes that ship's figures, and the example needs regenerating. A model
// change made without its version bump shows here as rows that no longer match their designs.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function parse(a){const o={keys:[],jobs:3,out:null,stamp:false,worker:null};for(let i=0;i<a.length;i++){const x=a[i];if(x==='--keys')o.keys.push(...String(a[++i]||'').split(',').filter(Boolean));else if(x==='--jobs')o.jobs=Math.max(1,+a[++i]||1);else if(x==='--out')o.out=a[++i];else if(x==='--stamp')o.stamp=true;else if(x==='--worker')o.worker=a[++i];else throw Error('Unknown option: '+x);}return o;}
const combatKeys=()=>fs.readdirSync(path.join(root,'data/examples')).filter(k=>fs.existsSync(path.join(root,'data/examples',k,'combat.json'))).sort();
function diff(a,b,at='',out=[]){
 if(out.length>20)return out;
 if(typeof a==='number'&&typeof b==='number'){if(!(a===b||Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b))))out.push(at+' '+a+' → '+b);return out;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(k==='surface'||k==='catalogOnly')continue;diff(a[k],b[k],at+'.'+k,out);}return out;}
 if(JSON.stringify(a)!==JSON.stringify(b))out.push(at+' '+JSON.stringify(a)?.slice(0,80)+' → '+JSON.stringify(b)?.slice(0,80));return out;
}
function worker(key,out){
 const {C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root),t=Date.now();
 const row=JSON.parse(fs.readFileSync(path.join(root,'data/examples',key,'combat.json'),'utf8'));
 const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));
 C.syncCompartments(s);C.remount(s,{keepFitPose:true});C.syncCompartments(s);const S=C.computeStats(s),p=JSON.parse(JSON.stringify(C.fleetProfile(S,s.name,s)));
 const d=diff(row.p,p),result={key,ok:!d.length,surface:!!p.surface,modelKey:C.profileModelKey(),differences:d,ms:Date.now()-t};
 fs.writeFileSync(path.join(out,key+'.json'),JSON.stringify(result,null,1));
}
async function main(){
 const o=parse(process.argv.slice(2));if(!o.out)throw Error('--out <dir> is required (nothing is written to data/ but the stamped rows)');fs.mkdirSync(o.out,{recursive:true});
 if(o.worker)return worker(o.worker,o.out);
 const keys=o.keys.length?o.keys:combatKeys(),queue=keys.slice(),fail=[];
 await Promise.all(Array.from({length:Math.min(o.jobs,keys.length)},async()=>{for(let k;(k=queue.shift());){const code=await new Promise(r=>spawn(process.execPath,[__filename,'--worker',k,'--out',o.out],{stdio:['ignore','inherit','inherit']}).on('exit',r));if(code)fail.push(k);}}));
 let stamped=0;const results=keys.map(k=>{try{return JSON.parse(fs.readFileSync(path.join(o.out,k+'.json'),'utf8'));}catch{return {key:k,ok:false,differences:['did not finish']};}});
 for(const r of results){console.log(r.key.padEnd(14),r.ok?'same':'DIFFERS',r.surface?'(surface)':'',r.ms?Math.round(r.ms/1000)+' s':'',r.ok?'':r.differences.slice(0,4).join('; '));
  if(o.stamp&&r.ok&&r.modelKey){const file=path.join(root,'data/examples',r.key,'combat.json'),row=JSON.parse(fs.readFileSync(file,'utf8'));row.model={...row.model,modelKey:r.modelKey,surface:r.surface};fs.writeFileSync(file,JSON.stringify(row));stamped++;}}
 if(o.stamp)console.log('stamped',stamped,'of',results.length,'rows; next: node scripts/example-files.cjs --assemble, node scripts/update-asset-manifest.cjs');
 if(fail.length||results.some(r=>!r.ok))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exit(1);});
