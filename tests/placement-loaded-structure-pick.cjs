// User report 2026-11-15「反応炉を追加できない」: a 2 m craft whose hull stands inside an ellipsoid structure, saved and
// opened again. The editor asks Core whether a structure's carried solid is current before it lets a placement tap
// through it; the answer needed a parent key that is written only when a part is placed and is never stored, so
// for every structure of a loaded design it was "not current", the structure's shape counted as unknown and each
// tap whose line of sight met its bounds first was dropped (js/gfx.js placementAuthoringHits). A structure is not
// fitted to the body it was tapped on (no parent relation), so its carried solid is current whenever its own
// shape and request are.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const load=()=>{const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/craft-in-ellipsoid-no-reactor-2026-11-15.json.gz'))).toString('utf8')));C.syncCompartments(s);return s;};
test('a loaded structure carries a solid the editor can pick through, with no parent key',()=>{
 const s=load(),e=s.parts.find(p=>p.id===33);assert.equal(e.form,'ellipsoid');assert.ok(e._placementGeometry?.local?.length>0,'the carried solid is there after loading');
 assert.equal(e._placementParentKey,undefined,'the parent key is not stored');assert.equal(C.placementCachedGeometryCurrent(s,e),true);
});
test('a structure whose shape was changed since its solid was made is still not current',()=>{
 const s=load(),e=s.parts.find(p=>p.id===33);e.s=[1.6,2,2];assert.equal(C.placementCachedGeometryCurrent(s,e),false);
});
test('a small reactor goes into the loaded craft and a save and load keeps it',()=>{
 const s=load(),n=s.parts.length,made=C.placePart(s,'gen',[1.35,1,0],.3,{});assert.ok(made);assert.equal(s.parts.length,n+1);
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));assert.equal(back.parts.filter(p=>p.k==='gen').length,2);
});
