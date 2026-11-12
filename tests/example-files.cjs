// Example files: one directory per example (its saved design, and a combat row for catalogue ships), with a manifest
// of file checksums. Examples are saved designs: nothing in these files depends on the hashes of the source files.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),F=require(path.join(root,'scripts/example-files.cjs'));
test('data/fleet.js is exactly the assembly of the per-ship files',()=>{assert.equal(F.check(root),true);});
test('every catalogue ship has its own design and combat file, matching the manifest and each other',()=>{
 const m=F.readManifest(root),fleet=F.loadFleet(root),ships=Object.keys(m.ships).filter(k=>m.ships[k].combat);assert.deepEqual(ships.sort(),Object.keys(fleet.designs).sort());
 for(const key of ships){const e=m.ships[key];
  const combat=fs.readFileSync(path.join(root,F.combatPath(key))),gz=fs.readFileSync(path.join(root,F.designPath(key))),raw=zlib.gunzipSync(gz),row=JSON.parse(combat);
  assert.equal(F.sha(combat),e.combat.sha256,key);assert.equal(F.sha(gz),e.design.sha256,key);assert.equal(F.sha(raw),e.design.jsonSha256,key);
  assert.equal(row.model.sourceSha256,undefined,'no source stamp in the combat file');assert.equal(row.model.blueprintSha256,e.design.blueprintSha256,key+' design and combat come from the same build');
  assert.equal(F.sha(F.stable(JSON.parse(raw))),e.design.blueprintSha256,key+' recorded content hash of the design');
  const asset=fleet.designs[key].model.preparedBlueprint;assert.deepEqual(JSON.parse(JSON.stringify(asset)),{url:F.designPath(key),sha256:e.design.sha256,jsonSha256:e.design.jsonSha256,blueprintSha256:e.design.blueprintSha256});
  assert.deepEqual(JSON.parse(JSON.stringify(fleet.blueprints[key])),JSON.parse(JSON.stringify(asset)));
 }
});
test('no example file, manifest entry or catalogue row carries source-file hashes',()=>{
 const text=fs.readFileSync(path.join(root,F.MANIFEST),'utf8')+fs.readFileSync(path.join(root,F.FLEET),'utf8');
 for(const word of ['sourceSha256','coreSha256','js/core.js'])assert.equal(text.includes(word),false,word);
});
test('every design the game offers as an example is a saved design file listed in the catalogue',()=>{
 const vm=require('node:vm'),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx);
 const C=vm.runInContext('Core',cx),fleet=F.loadFleet(root),m=F.readManifest(root);
 for(const key of Object.keys(C.DESIGNS)){const a=fleet.blueprints[key];assert.ok(a,key+' has a saved design');assert.equal(a.url,F.designPath(key));assert.equal(F.sha(fs.readFileSync(path.join(root,a.url))),a.sha256,key);assert.ok(m.ships[key]?.design,key);}
});
test('storing an unchanged result rewrites no ship file and leaves its manifest entry as it was',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ks-examples-'));try{
  const key=Object.keys(F.readManifest(root).ships)[0];fs.mkdirSync(path.join(tmp,'data/examples',key),{recursive:true});
  for(const f of [F.combatPath(key),F.designPath(key),F.MANIFEST])fs.copyFileSync(path.join(root,f),path.join(tmp,f));
  const m=F.readManifest(tmp),row=F.loadFleet(root).designs[key],raw=zlib.gunzipSync(fs.readFileSync(path.join(tmp,F.designPath(key)))),before=[F.combatPath(key),F.designPath(key)].map(f=>fs.statSync(path.join(tmp,f)).mtimeMs);
  const entry=JSON.stringify(m.ships[key]),r=F.storeShip(tmp,m,key,{row,blueprintRaw:raw});
  assert.deepEqual(r,{design:'unchanged',combat:'unchanged'});assert.deepEqual([F.combatPath(key),F.designPath(key)].map(f=>fs.statSync(path.join(tmp,f)).mtimeMs),before);
  assert.equal(JSON.stringify(m.ships[key]),entry,'an unchanged example changes nothing in the manifest');
  const changed=F.storeShip(tmp,m,key,{row:{...row,info:{...row.info,crew:row.info.crew+1}},blueprintRaw:null});assert.equal(changed.combat,'updated');assert.equal(changed.design,null);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('the worker opens an example from its saved design only, without a source stamp or a rebuild',()=>{
 const src=fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),body=src.slice(src.indexOf('async function loadExample('),src.indexOf('async function handleBuild('));
 assert.match(body,/C\.deserialize\(/);for(const word of ['buildDesign','KS_SOURCE_SHA256','sourceSha256','coreSha256'])assert.equal(body.includes(word),false,word);
});
