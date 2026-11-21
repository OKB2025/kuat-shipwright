// 2026-11-20 (user instruction「マンデイターIIはこれをベースに使って」; regression review of 4bf8745: no test looked at the new example —
// tests/mandator-battery-layout.cjs and mandator-layout-publication.cjs read the archived v23 blueprints). The Mandator II example
// stands on the user's exterior design, kept as it is: this checks the stored example against that file. It reads the stored
// design; it does not build (a fresh build of this ship takes more than an hour, tests/mandator-example-refit.cjs).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),read=f=>fs.readFileSync(path.join(root,f)),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const manifest=JSON.parse(read('assets/source/mandator2-user-exterior/manifest.json')).files['mandator2-user-exterior.json'],sourceRaw=zlib.gunzipSync(read(manifest.file)),source=JSON.parse(sourceRaw),design=JSON.parse(zlib.gunzipSync(read('data/examples/mandator2/design.json.gz')));
test('the source file is the one the user gave',()=>{assert.equal(sha(sourceRaw),manifest.source_sha256);assert.equal(sourceRaw.length,manifest.source_bytes);/* 2026-11-21: the user's second model (「マンデイターIIは新しくモデルを渡す」「先に完成したので今回のマージで」) has 372 structures; the first had 652 */assert.equal(source.parts.filter(p=>p.k==='struct').length,372);assert.equal(source.fits.length,0);});
test('the builder carries the user file as it is',()=>{
 const core=read('js/core.js').toString('utf8'),at=core.indexOf('MAN2_EXTERIOR=');assert.ok(at>0,'MAN2_EXTERIOR is in the core');let i=at+14,depth=0;const start=i;for(;;i++){if(core[i]==='{')depth++;else if(core[i]==='}'&&!--depth)break;}
 const constant=JSON.parse(core.slice(start,i+1));for(const k of Object.keys(source))assert.ok(same(constant[k],source[k]),'MAN2_EXTERIOR.'+k+' equals the file');assert.deepEqual(Object.keys(constant),Object.keys(source));
});
test('the stored example keeps the hull and every exterior part of the user file, and adds no structure',()=>{
 assert.ok(same(design.hull,source.hull),'the hull is the user hull');const byId=new Map(design.parts.map(p=>[p.id,p])),differing=[];
 for(const p of source.parts){const q=byId.get(p.id);assert.ok(q,'exterior part '+p.id+' is in the example');const keys=[...new Set([...Object.keys(p),...Object.keys(q)])].filter(k=>!same(p[k],q[k]));if(keys.length)differing.push([p.id,keys.join()]);}
 // 2026-11-21: no difference is left. Until this date the bridge body (651) was stored with the skin 'plain' instead of the user's
 // 'service' (the rule that gave every structure of this example the plain skin, PLAIN_SKIN_EXAMPLES; the example is no longer in it).
 assert.deepEqual(differing,[]);
 const ids=new Set(source.parts.map(p=>p.id)),added=design.parts.filter(p=>!ids.has(p.id));assert.equal(added.filter(p=>p.k==='struct').length,0,'no structure was added (no props, bridges or plates)');
 assert.equal(design.parts.filter(p=>p.k==='struct').length,372);assert.equal((design.cuts||[]).length,0);assert.equal((design.trenches||[]).length,0);
});
test('the stored example carries the battery on the user mounts and the fixed reactor output',()=>{
 const count=k=>design.fits.filter(f=>f.k===k).length;assert.deepEqual({utl:count('utl'),quad175:count('quad175'),ball175QuadIon:count('ball175QuadIon'),pd:count('pd'),shipMsl:count('shipMsl')},{utl:61,quad175:48,ball175QuadIon:16,pd:63,shipMsl:6});assert.equal(design.fits.length,194);
 const cx=vm.createContext({console:{log(){},warn(){},error(){}}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(read(f).toString('utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx),ref=C.SHIP_REFERENCE.mandator2;
 // User decision 2026-11-20:「7.7e26はファンダムで推定されてる数値なので絶対動かさない」.
 assert.equal(ref.power,7.7e26);const volley=design.fits.filter(f=>['utl','quad175','ball175QuadIon'].includes(f.k)).reduce((n,f)=>{const d=C.fitSpec(f);return n+(d.tt||0)+(d.ion||0);},0);assert.ok(Math.abs(volley-132640)<1e-6,'main and ion volley '+volley);
 assert.equal(design.parts.filter(p=>p.k==='engine').length,11);assert.equal(design.parts.filter(p=>p.k==='engineCore').length,11);
});
