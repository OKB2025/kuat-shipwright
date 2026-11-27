#!/usr/bin/env node
// Example files, one directory per example: the saved design, and for catalogue ships their combat data.
//
//   data/examples/<key>/design.json.gz  the saved design (gzip JSON), opened like a user's save
//   data/examples/<key>/combat.json     catalogue ships only: the fleet catalogue row (profile, figures,
//                                       price) computed from that design under the calculation model
//                                       named in row.model (profileVersion, costVersion, costSignature,
//                                       exampleProfileVersion) and bound to it by row.model.blueprintSha256
//   data/examples/<key>/prepared.json.gz  catalogue ships with surface sections only (2026-11-27): the whole profile and the
//                                       display statistics, worked out by the worker's own steps, so the game's
//                                       worker need not run the performance calculation to fly or fight the example
//                                       (js/engine.js loadPreparedFigures; bound to the row's model key and design checksum)
//   data/examples/manifest.json         per example and per side: the SHA-256 of the file bytes (and of
//                                       the design JSON). No source-file hashes: an example does not depend
//                                       on the bytes of js/core.js, only on its own content.
//
// data/fleet.js, which the game loads, is assembled from these files (assemble()): the catalogue rows of
// the ships (designs) and the location and checksums of every example design (blueprints), craft and
// older sample designs included. scripts/refresh-examples.cjs regenerates the files with the authoring
// tool (Core.buildDesign) and rewrites only the files whose content changed.
//
//   node scripts/example-files.cjs --assemble   rebuild data/fleet.js from data/examples
//   node scripts/example-files.cjs --check      verify data/fleet.js and the files agree
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),vm=require('node:vm');
const DIRECTORY='data/examples',MANIFEST=DIRECTORY+'/manifest.json',FLEET='data/fleet.js';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
const designPath=key=>DIRECTORY+'/'+key+'/design.json.gz',combatPath=key=>DIRECTORY+'/'+key+'/combat.json',preparedPath=key=>DIRECTORY+'/'+key+'/prepared.json.gz';
// The combat file holds the row without the design's location (the manifest and the assembly add it).
// sourceSha256 is dropped as well: rows are not tied to source-file hashes.
function combatRow(row){const {sourceSha256,preparedBlueprint,...model}=row.model||{};return {...row,model};}
function combatBytes(row){return JSON.stringify(combatRow(row))+'\n';}
// mtime 0 keeps the archive bytes stable for the same design.
function designBytes(raw){return zlib.gzipSync(raw,{level:9,mtime:0});}
function readManifest(root){const file=path.join(root,MANIFEST);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:2,built:null,ships:{}};}
function writeManifest(root,manifest){const ships=Object.fromEntries(Object.keys(manifest.ships).sort().map(k=>[k,manifest.ships[k]]));fs.mkdirSync(path.join(root,DIRECTORY),{recursive:true});fs.writeFileSync(path.join(root,MANIFEST),JSON.stringify({...manifest,schemaVersion:2,ships},null,1)+'\n');}
function writeIfChanged(file,bytes){const old=fs.existsSync(file)?fs.readFileSync(file):null;if(old&&Buffer.compare(old,Buffer.from(bytes))===0)return false;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return true;}
// Store one example's freshly generated results. Returns which sides changed; an unchanged side is
// left exactly as it is (file and manifest entry).
function storeShip(root,manifest,key,{row,blueprintRaw,preparedRaw}){
 const result={design:null,combat:null,prepared:null},entry=manifest.ships[key]||(manifest.ships[key]={});
 if(row){const bytes=combatBytes(row);result.combat=writeIfChanged(path.join(root,combatPath(key)),bytes)?'updated':'unchanged';entry.combat={sha256:sha(bytes)};}
 if(blueprintRaw){const raw=Buffer.isBuffer(blueprintRaw)?blueprintRaw:Buffer.from(blueprintRaw),jsonSha256=sha(raw),file=path.join(root,designPath(key));
  // Compare the design itself, so recompressing the same JSON never rewrites the file.
  let same=false;if(fs.existsSync(file)){try{same=sha(zlib.gunzipSync(fs.readFileSync(file)))===jsonSha256;}catch{}}
  if(!same){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,designBytes(raw));}result.design=same?'unchanged':'updated';
  const gz=fs.readFileSync(file);entry.design={sha256:sha(gz),jsonSha256,blueprintSha256:sha(stable(JSON.parse(raw.toString('utf8'))))};}
 // The prepared figures: written when given, removed when the ship's row is rewritten without them (no surface sections).
 if(preparedRaw){const raw=Buffer.isBuffer(preparedRaw)?preparedRaw:Buffer.from(preparedRaw),jsonSha256=sha(raw),file=path.join(root,preparedPath(key));
  let same=false;if(fs.existsSync(file)){try{same=sha(zlib.gunzipSync(fs.readFileSync(file)))===jsonSha256;}catch{}}
  if(!same){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,designBytes(raw));}result.prepared=same?'unchanged':'updated';
  entry.prepared={sha256:sha(fs.readFileSync(file)),jsonSha256};}
 else if(row&&preparedRaw===null){const file=path.join(root,preparedPath(key));if(fs.existsSync(file)){fs.rmSync(file);result.prepared='removed';}delete entry.prepared;}
 return result;
}
function loadFleet(root){const cx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,FLEET),'utf8'),cx);return vm.runInContext('YardFleetData',cx);}
// data/fleet.js from the per-example files: the catalogue rows, and every design file with its checksums.
function assembled(root){
 const manifest=readManifest(root),designs={},blueprints={};
 for(const key of Object.keys(manifest.ships).sort()){
  const m=manifest.ships[key];let asset=null;
  if(m.design){const gz=fs.readFileSync(path.join(root,designPath(key)));if(sha(gz)!==m.design.sha256)throw Error('Design file does not match the manifest: '+key);
   asset={url:designPath(key),sha256:m.design.sha256,jsonSha256:m.design.jsonSha256,blueprintSha256:m.design.blueprintSha256};blueprints[key]=asset;}
  if(!m.combat)continue;
  const bytes=fs.readFileSync(path.join(root,combatPath(key))),row=JSON.parse(bytes);
  if(sha(bytes)!==m.combat.sha256)throw Error('Combat file does not match the manifest: '+key);
  let figures=null;if(m.prepared){const gz=fs.readFileSync(path.join(root,preparedPath(key)));if(sha(gz)!==m.prepared.sha256)throw Error('Prepared figures do not match the manifest: '+key);figures={url:preparedPath(key),sha256:m.prepared.sha256,jsonSha256:m.prepared.jsonSha256};}
  designs[key]={...row,model:{...row.model,...(asset?{preparedBlueprint:{...asset}}:{}),...(figures?{preparedFigures:figures}:{})}};
 }
 return {version:2,designs,blueprints,built:manifest.built};
}
function fleetSource(data){return '// Fleet profiles and saved designs of the examples, assembled by scripts/example-files.cjs from data/examples.\nconst YardFleetData='+JSON.stringify(data)+';\n';}
function assemble(root){const data=assembled(root),bytes=fleetSource(data);return writeIfChanged(path.join(root,FLEET),bytes);}
function check(root){const data=assembled(root),current=fs.readFileSync(path.join(root,FLEET),'utf8');return current===fleetSource(data);}
module.exports={DIRECTORY,MANIFEST,FLEET,sha,stable,designPath,combatPath,preparedPath,combatRow,readManifest,writeManifest,storeShip,assembled,assemble,check,loadFleet};
if(require.main===module){
 const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),arg=process.argv[2];
 try{
  if(arg==='--assemble')console.log(assemble(root)?'Assembled '+FLEET:FLEET+' is current');
  else if(arg==='--check'){if(check(root))console.log(FLEET+' matches '+DIRECTORY);else{console.error(FLEET+' is stale; run node scripts/example-files.cjs --assemble');process.exitCode=1;}}
  else throw Error('usage: example-files.cjs --assemble | --check');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
