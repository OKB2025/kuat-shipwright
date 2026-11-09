// v24 Generated example files: one directory per ship, split into design and combat, with a manifest.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),F=require(path.join(root,'scripts/example-files.cjs'));
test('data/fleet.js is exactly the assembly of the per-ship files',()=>{assert.equal(F.check(root),true);});
test('every catalogue ship has its own design and combat file, matching the manifest and each other',()=>{
 const m=F.readManifest(root),fleet=F.loadFleet(root);assert.deepEqual(Object.keys(m.ships).sort(),Object.keys(fleet.designs).sort());
 for(const [key,e]of Object.entries(m.ships)){
  const combat=fs.readFileSync(path.join(root,F.combatPath(key))),gz=fs.readFileSync(path.join(root,F.designPath(key))),raw=zlib.gunzipSync(gz),row=JSON.parse(combat);
  assert.equal(F.sha(combat),e.combat.sha256,key);assert.equal(F.sha(gz),e.design.sha256,key);assert.equal(F.sha(raw),e.design.jsonSha256,key);
  assert.equal(row.model.sourceSha256,undefined,'stamps live in the manifest, not in the combat file');assert.equal(row.model.blueprintSha256,e.design.blueprintSha256,key+' design and combat come from the same build');
  const asset=fleet.designs[key].model.preparedBlueprint;assert.equal(asset.url,F.designPath(key));assert.deepEqual(JSON.parse(JSON.stringify(asset.sourceSha256)),e.design.sourceSha256);assert.deepEqual(JSON.parse(JSON.stringify(fleet.designs[key].model.sourceSha256)),e.combat.sourceSha256);
 }
});
test('storing an unchanged result rewrites no ship file and only restamps the sources',()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ks-examples-'));try{
  const key=Object.keys(F.readManifest(root).ships)[0];fs.mkdirSync(path.join(tmp,'data/examples',key),{recursive:true});
  for(const f of [F.combatPath(key),F.designPath(key),F.MANIFEST])fs.copyFileSync(path.join(root,f),path.join(tmp,f));
  const m=F.readManifest(tmp),row=F.loadFleet(root).designs[key],raw=zlib.gunzipSync(fs.readFileSync(path.join(tmp,F.designPath(key)))),before=[F.combatPath(key),F.designPath(key)].map(f=>fs.statSync(path.join(tmp,f)).mtimeMs);
  const stamp={'data/reference.js':'r','data/imperial2.js':'i','js/core.js':'c'},r=F.storeShip(tmp,m,key,{row,blueprintRaw:raw,sources:stamp});
  assert.deepEqual(r,{design:'unchanged',combat:'unchanged'});assert.deepEqual([F.combatPath(key),F.designPath(key)].map(f=>fs.statSync(path.join(tmp,f)).mtimeMs),before);
  assert.deepEqual(m.ships[key].design.sourceSha256,stamp);assert.deepEqual(m.ships[key].combat.sourceSha256,stamp);
  const changed=F.storeShip(tmp,m,key,{row:{...row,info:{...row.info,crew:row.info.crew+1}},blueprintRaw:null,sources:stamp});assert.equal(changed.combat,'updated');assert.equal(changed.design,null);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('the worker trusts a design only with its own source stamp',()=>{const src=fs.readFileSync(path.join(root,'js/engine.js'),'utf8');assert.match(src,/const stamp=asset\?\.sourceSha256\|\|row\?\.model\?\.sourceSha256/);});
