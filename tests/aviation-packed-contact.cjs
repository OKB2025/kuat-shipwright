// Physics review 2026-11-21 (finding 4): the packing-cell reach of aviationConnected is only for compartments whose bounding boxes
// meet (within 1.5 m; for a packed one, the box around its cells). Two compartments whose boxes are 3 m apart do not connect, however large their packing cells; the
// same pair 1 m apart does. (The Providence case, boxes overlapping and the cells 4.4 m apart above the other deck, is
// tests/providence-hangar-access.cjs on the stored example.)
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
const bay=(id,x)=>({id,k:'hangar',c:[x,0,0],d:20,room:[20,20,20]});
test('bounding boxes apart by more than 1.5 m never connect, whatever the packing cell',()=>{
 for(const cell of [undefined,[10,10,10]]){const a=bay(1,0),b=bay(2,23);if(cell){a._packing={cell,boxes:[[-10,-10,-10,10,10,10]],bounds:[-10,-10,-10,10,10,10]};b._packing={cell,boxes:[[13,-10,-10,33,10,10]],bounds:[13,-10,-10,33,10,10]};}
  assert.equal(C.aviationConnected(a,b),false,`3 m apart, cell ${cell}`);}
});
test('bounding boxes 1 m apart connect',()=>{assert.equal(C.aviationConnected(bay(1,0),bay(2,21)),true);});
test('placed shapes that meet: packed cells one cell short still connect, more than a cell short do not',()=>{
 const pair=cell=>{const a={id:1,k:'hangar',c:[0,0,0],d:20,room:[20,20,20],_packing:{cell,boxes:[[-10,-10,-10,10,10,10]],bounds:[-10,-10,-10,10,10,10]}},
  b={id:2,k:'hangar',c:[0,20,0],d:20,room:[20,20,20],_packing:{cell,boxes:[[-10,14,-10,10,30,10]],bounds:[-10,14,-10,10,30,10]}};return C.aviationConnected(a,b);};
 assert.equal(pair([5,5,5]),true,'4 m gap, 5 m cells');
 assert.equal(pair([3,3,3]),false,'4 m gap, 3 m cells');
});
