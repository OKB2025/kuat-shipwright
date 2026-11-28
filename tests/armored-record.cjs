// 2026-11-28 (user: the duplicate in the performance calculation removed, 「重複の除去も後続に入れて1回の再生成にまとめて」): the closed-door
// armoured area is kept with the design (armoredMaterial) with a key of its closed-door state; a design whose closed-door state has that
// key takes the area from the record (the closed-door copy is not built again), and a record of another key, or a malformed one, is not used.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=x=>JSON.parse(JSON.stringify(x)),load=o=>{const s=C.deserialize(plain(o));C.syncCompartments(s);return s;};
const raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/imperial/design.json.gz'))));delete raw.armoredMaterial;
test('the Imperial class (a hangar door open): the area is worked out once, saved with its key, and a reload takes it from the record',()=>{
 const s=load(raw);assert.ok(s.hatches.some(h=>C.isSlidingHatch(s,h)&&(h.open??0)!==0),'a sliding door is open');
 const area=C.armoredMaterialArea(s,0);assert.ok(area>0);const o=plain(C.serialize(s)),r=o.armoredMaterial;
 assert.ok(r&&r.v===C.ARMORED_RECORD_VERSION&&typeof r.key==='string'&&r.area===area,'saved with the design');
 // a record whose key is the present closed-door state's is used as it stands: a marked area comes back, so nothing was rebuilt
 const marked=plain(o);marked.armoredMaterial.area=12345;assert.equal(C.armoredMaterialArea(load(marked),0),12345,'taken from the record');
 assert.equal(C.serialize(load(o)).armoredMaterial.key,r.key,'saved again as it was');
 // another key: worked out again, the true area
 const wrong=plain(o);wrong.armoredMaterial.key='1:1:zzzzzzzzzzzzzz';wrong.armoredMaterial.area=12345;assert.equal(C.armoredMaterialArea(load(wrong),0),area,'a record of another key is not used');
});
test('a changed design has another key; a door shut needs no record; malformed records are refused',()=>{
 const a=JSON.stringify({x:1}),b=JSON.stringify({x:2});assert.notEqual(C.armoredRecordKey(a),C.armoredRecordKey(b));assert.equal(C.armoredRecordKey(a),C.armoredRecordKey(a));
 for(const bad of [{v:99,key:'x',area:1},{v:C.ARMORED_RECORD_VERSION,key:'x',area:-1},{v:C.ARMORED_RECORD_VERSION,key:5,area:1},{v:C.ARMORED_RECORD_VERSION,key:'x',area:'1'},null])assert.equal(C.cleanArmoredRecord(bad),null);
 const shut=plain(raw);for(const h of shut.hatches||[])h.open=0;const s=load(shut);assert.equal(C.armoredMaterialArea(s,777),777,'every door shut: the surveyed surface is the closed-door one');
});
