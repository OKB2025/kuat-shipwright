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
