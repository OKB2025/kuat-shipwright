#!/usr/bin/env node
// v24 Generated example files, one directory per ship, split into its design and its combat data:
//
//   data/examples/<key>/design.json.gz  the finished blueprint (opening the ship, sending it to battle)
//   data/examples/<key>/combat.json     the fleet catalogue row (fleet profile, figures, price)
//   data/examples/manifest.json         per ship and per side: content SHA-256 and the model sources
//                                       (data/reference.js, data/imperial2.js, js/core.js) it was
//                                       verified against
//
// data/fleet.js, which the game loads, is assembled from these files (assemble()). A refresh
// (scripts/refresh-examples.cjs) rebuilds each ship, rewrites only the files whose content changed and
// only restamps the sources of the rest.
//
//   node scripts/example-files.cjs --assemble   rebuild data/fleet.js from data/examples
//   node scripts/example-files.cjs --check      verify data/fleet.js and the files agree
//   node scripts/example-files.cjs --migrate    split the current data/fleet.js and assets/prepared once
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib'),vm=require('node:vm');
const DIRECTORY='data/examples',MANIFEST=DIRECTORY+'/manifest.json',FLEET='data/fleet.js';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const stable=value=>JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
const designPath=key=>DIRECTORY+'/'+key+'/design.json.gz',combatPath=key=>DIRECTORY+'/'+key+'/combat.json';
// The combat file holds the row without its volatile stamps; the manifest holds those.
function combatRow(row){const {sourceSha256,preparedBlueprint,...model}=row.model||{};return {...row,model};}
function combatBytes(row){return JSON.stringify(combatRow(row))+'\n';}
// mtime 0 keeps the archive bytes stable for the same blueprint.
function designBytes(raw){return zlib.gzipSync(raw,{level:9,mtime:0});}
function readManifest(root){const file=path.join(root,MANIFEST);return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,built:null,ships:{}};}
function writeManifest(root,manifest){const ships=Object.fromEntries(Object.keys(manifest.ships).sort().map(k=>[k,manifest.ships[k]]));fs.mkdirSync(path.join(root,DIRECTORY),{recursive:true});fs.writeFileSync(path.join(root,MANIFEST),JSON.stringify({...manifest,ships},null,1)+'\n');}
function writeIfChanged(file,bytes){const old=fs.existsSync(file)?fs.readFileSync(file):null;if(old&&Buffer.compare(old,Buffer.from(bytes))===0)return false;fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return true;}
// Store one ship's freshly built results. Returns which sides changed. sources are the model hashes
// both results were built from; an unchanged side is only restamped.
function storeShip(root,manifest,key,{row,blueprintRaw,sources}){
 const result={design:null,combat:null},entry=manifest.ships[key]||(manifest.ships[key]={});
 if(row){const bytes=combatBytes(row);result.combat=writeIfChanged(path.join(root,combatPath(key)),bytes)?'updated':'unchanged';entry.combat={sha256:sha(bytes),sourceSha256:{...sources}};}
 if(blueprintRaw){const raw=Buffer.isBuffer(blueprintRaw)?blueprintRaw:Buffer.from(blueprintRaw),jsonSha256=sha(raw),file=path.join(root,designPath(key));
  // Compare the blueprint itself, so recompressing the same JSON never rewrites the file.
  let same=false;if(fs.existsSync(file)){try{same=sha(zlib.gunzipSync(fs.readFileSync(file)))===jsonSha256;}catch{}}
  if(!same){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,designBytes(raw));}result.design=same?'unchanged':'updated';
  const gz=fs.readFileSync(file);entry.design={sha256:sha(gz),jsonSha256,blueprintSha256:sha(stable(JSON.parse(raw.toString('utf8')))),sourceSha256:{...sources}};}
 return result;
}
function loadFleet(root){const cx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,FLEET),'utf8'),cx);return vm.runInContext('YardFleetData',cx);}
// data/fleet.js from the per-ship files: the combat row, its source stamp, and the design file it points to.
function assembled(root){
 const manifest=readManifest(root),designs={};
 for(const key of Object.keys(manifest.ships).sort()){
  const m=manifest.ships[key],row=JSON.parse(fs.readFileSync(path.join(root,combatPath(key)),'utf8'));
  if(sha(fs.readFileSync(path.join(root,combatPath(key))))!==m.combat?.sha256)throw Error('Combat file does not match the manifest: '+key);
  const model={...row.model,sourceSha256:{...m.combat.sourceSha256}};
  if(m.design){const gz=fs.readFileSync(path.join(root,designPath(key)));if(sha(gz)!==m.design.sha256)throw Error('Design file does not match the manifest: '+key);
   model.preparedBlueprint={url:designPath(key),sha256:m.design.sha256,jsonSha256:m.design.jsonSha256,coreSha256:m.design.sourceSha256['js/core.js'],sourceSha256:{...m.design.sourceSha256}};}
  designs[key]={...row,model};
 }
 return {version:1,designs,built:manifest.built};
}
function fleetSource(data){return '// Fleet profiles of the editable examples, assembled by scripts/example-files.cjs from data/examples.\nconst YardFleetData='+JSON.stringify(data)+';\n';}
function assemble(root){const data=assembled(root),bytes=fleetSource(data);return writeIfChanged(path.join(root,FLEET),bytes);}
function check(root){const data=assembled(root),current=fs.readFileSync(path.join(root,FLEET),'utf8');return current===fleetSource(data);}
// One-time split of the catalogue and the earlier assets/prepared/<key>.json.gz into data/examples.
function migrate(root){
 const data=loadFleet(root),manifest=readManifest(root);manifest.built=data.built||null;
 for(const [key,row]of Object.entries(data.designs)){
  const asset=row.model?.preparedBlueprint;let raw=null;
  if(asset?.url){const file=path.join(root,asset.url);if(fs.existsSync(file)){raw=zlib.gunzipSync(fs.readFileSync(file));if(sha(raw)!==asset.jsonSha256)raw=null;}}
  storeShip(root,manifest,key,{row,blueprintRaw:null,sources:row.model.sourceSha256});
  if(raw){storeShip(root,manifest,key,{row:null,blueprintRaw:raw,sources:{...row.model.sourceSha256,'js/core.js':asset.coreSha256}});}
 }
 writeManifest(root,manifest);return Object.keys(data.designs).length;
}
module.exports={DIRECTORY,MANIFEST,FLEET,sha,stable,designPath,combatPath,combatRow,readManifest,writeManifest,storeShip,assembled,assemble,check,migrate,loadFleet};
if(require.main===module){
 const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),arg=process.argv[2];
 try{
  if(arg==='--migrate'){console.log(`Split ${migrate(root)} ships into ${DIRECTORY}`);assemble(root);}
  else if(arg==='--assemble')console.log(assemble(root)?'Assembled '+FLEET:FLEET+' is current');
  else if(arg==='--check'){if(check(root))console.log(FLEET+' matches '+DIRECTORY);else{console.error(FLEET+' is stale; run node scripts/example-files.cjs --assemble');process.exitCode=1;}}
  else throw Error('usage: example-files.cjs --assemble | --check | --migrate');
 }catch(error){console.error(error.message);process.exitCode=1;}
}
