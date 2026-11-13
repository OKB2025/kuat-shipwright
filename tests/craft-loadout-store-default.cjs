// craftLoadout threw "Cannot read properties of undefined (reading '0')" for a design with a ship missile
// launcher (shipMsl): its store station had no entry in the default-load table (known bug, handoff 2026-11-12
// §6; seen as a page error in scripts/browser-edit-flows.cjs). A station without a table entry now takes its
// fitting's own ordnance, as many as its store holds.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
test('a ship launcher station gets its own ordnance as the default load',()=>{
 const L=C.craftLoadout({fits:[{id:1,k:'shipMsl',p:[0,0,0],a:0},{id:2,k:'cmsl',p:[1,0,0],a:0}]});
 assert.deepEqual(JSON.parse(JSON.stringify(L.stations.map(s=>s.fit))),['shipMsl','cmsl']);
 assert.deepEqual(JSON.parse(JSON.stringify(L.load)),[{k:'cmsl',n:6},{k:'cmsl',n:6}]);
 // The table entries are unchanged.
 const T=C.craftLoadout({fits:[{id:1,k:'ctorp',p:[0,0,0],a:0}]});assert.deepEqual(JSON.parse(JSON.stringify(T.load)),[{k:'ptorp',n:3}]);
});
test('a multi-cell ship launcher holds 6 rounds per cell, as fitSpec and the runtime count it (physics review 2026-11-13)',()=>{
 const big={id:1,k:'shipMsl',p:[0,0,0],a:0,launcherCols:2,launcherRows:2},one={id:2,k:'shipMsl',p:[1,0,0],a:0};
 assert.equal(C.fitSpec(big).store.slots,24);
 const L=C.craftLoadout({fits:[big,one]});
 assert.equal(JSON.stringify(L.stations.map(s=>[s.fit,s.count,s.store?.slots])),JSON.stringify([['shipMsl',1,24],['shipMsl',1,6]]),'one station per cell count');
 assert.equal(JSON.stringify(L.load),JSON.stringify([{k:'cmsl',n:24},{k:'cmsl',n:6}]));
 assert.equal(JSON.stringify(C.normalizeLoad(L.stations,[{k:'cmsl',n:99},{k:'cmsl',n:99}])),JSON.stringify([{k:'cmsl',n:24},{k:'cmsl',n:6}]),'held to the store');
});
