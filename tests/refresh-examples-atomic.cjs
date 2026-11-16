// Audit 2026-11-16 (refresh-examples): a refresh in which one example fails writes nothing, so data/examples,
// the manifest and data/fleet.js never disagree. Runs on a temporary copy of the project.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),zlib=require('node:zlib'),{spawnSync}=require('node:child_process'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
test('one failed example leaves every stored example, the manifest and fleet.js untouched',{timeout:600000},()=>{
 const copy=fs.mkdtempSync(path.join(os.tmpdir(),'ks-atomic-'));
 try{
  for(const d of ['js','data','scripts','assets'])fs.cpSync(path.join(root,d),path.join(copy,d),{recursive:true});
  const files=['data/examples/craft_awing/design.json.gz','data/examples/craft_tie_ln/design.json.gz','data/examples/manifest.json','data/fleet.js'].filter(f=>fs.existsSync(path.join(copy,f)));
  // The stored A-wing design differs from what its rebuild gives, so a write of the successful build would show.
  fs.writeFileSync(path.join(copy,'data/examples/craft_awing/design.json.gz'),zlib.gzipSync(Buffer.from('{"stale":true}')));
  const before=Object.fromEntries(files.map(f=>[f,fs.readFileSync(path.join(copy,f)).toString('base64')]));
  const r=spawnSync(process.execPath,[path.join(copy,'scripts/refresh-examples.cjs'),'--keys','craft_awing,craft_tie_ln','--jobs','2'],{cwd:copy,env:{...process.env,KS_TEST_ROOT:copy,KS_REFRESH_FAIL_KEYS:'craft_tie_ln'},encoding:'utf8'});
  assert.notEqual(r.status,0,'the refresh reports the failure');
  for(const f of files)assert.equal(fs.readFileSync(path.join(copy,f)).toString('base64'),before[f],f+' unchanged');
  assert.match(r.stderr,/nothing was written/);
 }finally{fs.rmSync(copy,{recursive:true,force:true});}
});
