#!/usr/bin/env node
// Ship each example's finished blueprint with the game, so opening it or sending it
// into a fleet battle restores the built design instead of running its constructor.
//
//   node scripts/update-ship-examples.cjs --patch /tmp/fleet.json --blueprints /tmp/bp
//   node scripts/pack-prepared-examples.cjs --patch /tmp/fleet.json --blueprints /tmp/bp
//   node scripts/update-ship-examples.cjs --merge /tmp/fleet.json
//
// The worker uses a prepared blueprint only while data/reference.js,
// data/imperial2.js and js/core.js match the hashes recorded with it
// (engine.js loadExample); any later change to those files falls back to the
// constructor until the examples are packed again.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),zlib=require('node:zlib');
const G=require('./update-ship-examples.cjs');
const DIRECTORY='assets/prepared';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
function parse(args){
 const o={patch:null,blueprints:null};
 for(let i=0;i<args.length;i++){const a=args[i];if(a==='--patch'||a==='--blueprints'){const v=args[++i];if(!v||v.startsWith('--'))throw Error(a+' requires a value');o[a.slice(2)]=v;}else throw Error('Unknown option: '+a);}
 if(!o.patch||!o.blueprints)throw Error('--patch and --blueprints are required');return o;
}
function pack(root,patch,blueprints){
 const sources=G.sourceHashes(root);
 if(G.stable(patch.sourceSha256)!==G.stable(sources))throw Error('The patch was generated from different model sources');
 fs.mkdirSync(path.join(root,DIRECTORY),{recursive:true});const packed=[];
 for(const [key,entry]of Object.entries(patch.entries||{})){
  const file=path.join(blueprints,key+'.json');if(!fs.existsSync(file))throw Error('Missing blueprint: '+key);
  const raw=fs.readFileSync(file),blueprint=JSON.parse(raw);
  if(sha(G.stable(blueprint))!==entry.model?.blueprintSha256)throw Error('Blueprint does not match its catalogue entry: '+key);
  // mtime 0 keeps the archive bytes stable for the same blueprint.
  const gz=zlib.gzipSync(raw,{level:9,mtime:0}),name=key+'.json.gz';fs.writeFileSync(path.join(root,DIRECTORY,name),gz);
  entry.model.preparedBlueprint={url:DIRECTORY+'/'+name,sha256:sha(gz),jsonSha256:sha(raw),coreSha256:sources['js/core.js']};
  packed.push([key,raw.length,gz.length]);
 }
 return packed;
}
function main(){
 const o=parse(process.argv.slice(2)),root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),file=path.resolve(o.patch),patch=JSON.parse(fs.readFileSync(file,'utf8'));
 const packed=pack(root,patch,path.resolve(o.blueprints));fs.writeFileSync(file,JSON.stringify(patch)+'\n');
 for(const [key,raw,gz]of packed)console.log(key.padEnd(14),String(raw).padStart(9),'→',String(gz).padStart(8),'bytes');
 console.log(`Packed ${packed.length} prepared blueprints into ${DIRECTORY}`);
}
module.exports={DIRECTORY,pack};
if(require.main===module){try{main();}catch(error){console.error(error.message);process.exitCode=1;}}
