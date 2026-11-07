const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),script=path.join(root,'scripts/browser-imperial-layouts.cjs'),text=fs.readFileSync(script,'utf8'),main=text.indexOf('\n(async()=>{');
assert.ok(main>0,'native browser entry point must remain separable from the source oracles');
const prefix=text.slice(0,main),sourceFile=path.join(root,'assets/source/imperial-ii-user-layout/imperial-ii-upload.json'),sourceBytes=fs.readFileSync(sourceFile),plain=x=>JSON.parse(JSON.stringify(x));

function setup(env={},key='imperial2'){
 const blueprintFile='/__ks_browser_oracle_blueprint__.json',effects={mkdir:[],writes:[],screenshots:[],launches:0};
 const fakeFs={...fs,readFileSync:(file,...args)=>String(file)===blueprintFile?Buffer.from(sourceBytes):fs.readFileSync(file,...args),mkdirSync:(...args)=>effects.mkdir.push(args),writeFileSync:(...args)=>effects.writes.push(args)};
 const cx=vm.createContext({Buffer,URL,console:{log(){}},__dirname:path.dirname(script),__filename:script,process:{argv:['node',script,key,blueprintFile],env:{KS_PROFILE_ROOT:root,...env}},require:id=>id==='node:fs'?fakeFs:id==='playwright'?{chromium:{launch(){effects.launches++;throw Error('No browser launch is allowed in this oracle test');}}}:require(id)}),run=code=>vm.runInContext(code,cx,{filename:script});
 run(prefix);
 run(`const originalSourceJSON=JSON.stringify(source),originalSourceBytes=sha(sourceBytes);
 function projection(corrected=false){const s=JSON.parse(JSON.stringify(source));if(corrected){const cut=s.parts.find(p=>p.id===178).hullData.solidCuts.find(c=>c.id===2);cut.c[1]=202.52;cut.s[2]=127.07;}
 const fits=s.fits.map(f=>({...f,k:key==='imperial'&&f.id>=107&&f.id<=114?(f.id<=108?'ion':'stl'):f.k}));
 return{structures:s.parts.filter(p=>p.k==='struct'),fits,...Object.fromEntries(['hull','cuts','trenches','solidCuts','subs','hatches','armor'].map(k=>[k,s[k]]))};}
 const fakePage={evaluate:async()=>{},screenshot:async({path})=>globalThis.capturedScreenshots.push(path)};`);
 cx.capturedScreenshots=effects.screenshots;
 return{run,effects};
}

test('the historical namespace keeps the uploaded source exact and refuses the new seam correction',()=>{
 for(const key of ['imperial','imperial2']){
  const {run,effects}=setup({},key),proof=plain(run('compareSource(projection())'));
  assert.equal(proof.sourceStructures,26);assert.equal(proof.sourceFittings,51);assert.equal(proof.allExplicitStructureFieldsPreserved,true);assert.deepEqual(proof.declaredStructureTransforms,[]);
  assert.throws(()=>run('compareSource(projection(true))'),/source structure #178/);
  assert.equal(run('JSON.stringify(source)'),run('originalSourceJSON'));assert.equal(run('sha(sourceBytes)'),run('originalSourceBytes'));assert.equal(effects.launches,0);assert.deepEqual(effects.writes,[]);
 }
});

test('only the approved 2300G namespace accepts and records the two declared engine-bay cut edits',()=>{
 for(const key of ['imperial','imperial2']){
  const {run}=setup({KS_PROFILE_NAMESPACE:'imperial-2300g'},key),proof=plain(run('compareSource(projection(true))'));
  assert.equal(proof.allExplicitStructureFieldsPreserved,false);assert.equal(proof.allExpectedStructureFieldsPreserved,true);assert.equal(proof.allAuthoredFitPosesPreserved,true);assert.equal(proof.declaredStructureTransforms.length,1);
  const change=proof.declaredStructureTransforms[0];assert.equal(change.partId,178);assert.equal(change.cutId,2);assert.equal(change.path,'parts[id=178].hullData.solidCuts[id=2]');assert.deepEqual(change.changedFields,['c[1]','s[2]']);
  assert.equal(change.before.c[1],202.53);assert.equal(change.before.s[2],127.05);assert.equal(change.after.c[1],202.52);assert.equal(change.after.s[2],127.07);assert.match(change.reason,/gap/);
  for(const i of [0,2])assert.equal(change.after.c[i],change.before.c[i]);for(const i of [0,1])assert.equal(change.after.s[i],change.before.s[i]);
  assert.ok(Math.abs(change.before.bounds.upperY-change.after.bounds.upperY)<1e-10,'the authored top is preserved');
  assert.ok(Math.abs(change.before.bounds.lowerY-change.lowerCutUpperY-.01)<1e-10,'the upload has the recorded one-centimetre gap');
  assert.ok(Math.abs(change.lowerCutUpperY-change.after.bounds.lowerY-.01)<1e-10,'the declared correction leaves one centimetre overlap');
  assert.throws(()=>run('compareSource(projection())'),/source structure #178/);
  assert.equal(run('JSON.stringify(source)'),run('originalSourceJSON'));assert.equal(run('sha(sourceBytes)'),run('originalSourceBytes'));
 }
 for(const namespace of ['other-review','imperial-2300g-copy','imperial-2300G']){
  const {run}=setup({KS_PROFILE_NAMESPACE:namespace});assert.doesNotThrow(()=>run('compareSource(projection())'));assert.throws(()=>run('compareSource(projection(true))'));
 }
});

test('the seam exception cannot hide other structure, nested cut, vertex, count or fit-pose changes',()=>{
 const mutations=[
  "p.structures.find(s=>s.id===178).c[0]+=.01",
  "p.structures.find(s=>s.id===178).hullData.solidCuts.find(c=>c.id===3).c[1]+=.01",
  "p.structures.find(s=>s.id===178).hullData.solidCuts.find(c=>c.id===2).c[0]+=.01",
  "p.structures.find(s=>s.id===178).hullData.solidCuts.find(c=>c.id===2).verts[0][0]+=.01",
  "p.structures.find(s=>s.id===178).hullData.solidCuts.find(c=>c.id===2).verts.push([0,0,0])",
  "p.structures.pop()",
  "p.structures.push(JSON.parse(JSON.stringify(p.structures[0])))",
  "p.fits.pop()",
  "p.fits[0].p[0]+=.01",
  "p.fits.find(f=>f.n).n[0]+=.01",
  "p.hull.W+=1"
 ];
 const {run}=setup({KS_PROFILE_NAMESPACE:'imperial-2300g'});
 for(const mutation of mutations){assert.throws(()=>run(`{const p=projection(true);${mutation};compareSource(p);}`),undefined,mutation);assert.equal(run('JSON.stringify(source)'),run('originalSourceJSON'),mutation);}
 assert.doesNotThrow(()=>run('compareSource(projection(true))'),'failed comparisons must not contaminate a later legitimate proof');assert.equal(run('sha(sourceBytes)'),run('originalSourceBytes'));
});

test('new report and screenshot defaults are separate from every historical output name',async()=>{
 const old=setup(),current=setup({KS_PROFILE_NAMESPACE:'imperial-2300g',KS_EXPECT_CATALOG_G:'2300',KS_EXPECT_ENGINE_DENSITY:'1'});
 assert.equal(path.basename(old.run('output')),'imperial-user-layout-imperial2-browser.json');assert.equal(path.basename(current.run('output')),'imperial-2300g-imperial2-browser.json');assert.notEqual(old.run('output'),current.run('output'));
 for(const fixture of [old,current]){await fixture.run("shot(fakePage,'machinery')");assert.equal(fixture.effects.launches,0);assert.equal(fixture.effects.screenshots.length,1);assert.equal(fixture.effects.writes.length,1);}
 assert.equal(path.basename(old.effects.screenshots[0]),'imperial-user-layout-imperial2-machinery.png');assert.equal(path.basename(current.effects.screenshots[0]),'imperial-2300g-imperial2-machinery.png');assert.notEqual(old.effects.screenshots[0],current.effects.screenshots[0]);
 assert.deepEqual(plain(current.run('result.expectations')),{catalogueAccelerationG:2300,catalogueAbsoluteToleranceG:.25,engineDensityFactor:1});assert.equal(current.run('result.artifactNamespace'),'imperial-2300g');
 assert.deepEqual(plain(old.run('result.expectations')),{catalogueAccelerationG:null,catalogueAbsoluteToleranceG:.25,engineDensityFactor:null});
});

test('proof options record explicit targets and reject unsafe paths or invalid numeric expectations',()=>{
 const {run}=setup({KS_PROFILE_NAMESPACE:'imperial-2300g',KS_EXPECT_CATALOG_G:'2300',KS_EXPECT_CATALOG_G_TOLERANCE:'.1',KS_EXPECT_ENGINE_DENSITY:'1'});
 assert.deepEqual(plain(run('result.expectations')),{catalogueAccelerationG:2300,catalogueAbsoluteToleranceG:.1,engineDensityFactor:1});
 for(const env of [{KS_PROFILE_NAMESPACE:'../old-report'},{KS_EXPECT_CATALOG_G:'NaN'},{KS_EXPECT_CATALOG_G:'-1'},{KS_EXPECT_CATALOG_G:'2300',KS_EXPECT_CATALOG_G_TOLERANCE:'-1'},{KS_EXPECT_ENGINE_DENSITY:'Infinity'},{KS_EXPECT_ENGINE_DENSITY:'0'}])assert.throws(()=>setup(env),undefined,JSON.stringify(env));
 assert.equal(fs.readFileSync(sourceFile).equals(sourceBytes),true,'oracle tests never edit the archived upload');
});

test('factory-generation provenance stays separate from the actual current browser sources',()=>{
 const file='docs/benchmarks/example-engine-acceleration-refit.json',report=JSON.parse(fs.readFileSync(path.join(root,file))),{run,effects}=setup({KS_GENERATION_REPORT:file});
 assert.equal(run('result.generationSource.report'),file);assert.equal(run('result.generationSource.coreSha256'),report.sourceSha256['js/core.js']);assert.equal(run('result.generationSource.reportSha256'),require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'));
 assert.equal(run('result.sourceSha256["js/core.js"]'),require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'js/core.js'))).digest('hex'));assert.equal(effects.launches,0);
});
