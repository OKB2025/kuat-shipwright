// User decision 2026-11-16「エータ2はそもそもカタログからも外して、実装予定は無し」: the Eta-2 is out of the craft catalogue, the
// RTS craft table, the reference speeds and the Venator's standard complement; a saved complement naming it loads without it.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C,R}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
test('no table or complement offers the Eta-2',()=>{
 assert.ok(!Object.hasOwn(C.CRAFT_TYPES,'eta2'));assert.ok(!R.CRAFT.eta2);assert.equal(C.sublightReference('eta2').status,'assumed');
 const v=C.builtinComplement('venator');assert.ok(!JSON.stringify(v).includes('eta2'));assert.ok(v.air.some(r=>r.type==='vwing'));
});
test('a saved complement naming the Eta-2 loads without that row; other rows keep their place',()=>{
 const rows=C.normalizeAirWings([{id:'air-1',name:'Vウイング',type:'vwing',count:12},{id:'air-2',name:'イータ2 アクティス迎撃機隊',type:'eta2',count:192},{id:'air-3',name:'ARC-170',type:'arc170',count:4}]);
 assert.deepEqual(rows.map(r=>[r.id,r.type,r.count]),[['air-1','vwing',12],['air-3','arc170',4]]);
});
