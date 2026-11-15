// User report 2026-11-15 (「また縦強度のエラー」): engine nozzles that overhang the aft end of the structure lie in sections
// with no structure at all. That is not a break in the ship. It passed only while the overhang weighed under 1% of the
// ship; with the denser engines of 2026-11-14 the user's design was held to 0% acceleration and told its support
// section was missing. A section with no structure counts as cut only between structure on both sides.
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
test('the user design with engines overhanging the stern is not held to 0% acceleration',()=>{
 const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/engine-overhang-2026-11-15.json.gz'))).toString('utf8')));C.syncCompartments(s);const S=C.computeStats(s);
 assert.ok(!S.cutSection,'no missing support section');assert.ok(S.aStruct>0&&S.structG>100,'a finite structural limit: '+S.structG);
 assert.ok(!S.warnings.some(w=>/縦強度の断面評価で支持断面が不足|加速を 0% に抑えています/.test(w.text)),JSON.stringify(S.warnings.map(w=>w.text.slice(0,40))));
});
test('a real gap between two structures is still a missing section',()=>{
 const s=C.newShip({L:200,W:40,H:40,assembly:true},'gap');Object.assign(s,{parts:[{id:1,k:'struct',form:'box',c:[40,20,0],s:[80,20,20]},{id:2,k:'struct',form:'box',c:[170,20,0],s:[60,20,20]},{id:3,k:'gen',c:[40,20,0],d:8},{id:4,k:'gen',c:[170,20,0],d:8}],fits:[],hatches:[],links:[],groups:[],nextId:5,autoHabitation:false,detail:0});s.armor={hull:0,cit:0};
 const S=C.computeStats(s);assert.equal(!!S.cutSection,true,'structure aft and forward, nothing between');assert.ok(S.warnings.some(w=>/縦強度の断面評価で支持断面が不足/.test(w.text)));
});
