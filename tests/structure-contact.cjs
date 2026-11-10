// v24 Structures touch only where their shapes do, not where their bounding boxes overlap (docs/structure-contact-v24.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
function fixture(){
 const ship=C.newShip({L:400,W:100,H:60,sec:'box',plan:'rect'},'contact fixture');
 const top=C.partAABB({k:'struct',c:[0,0,0],s:[1,1,1],form:'box'})&&ship.hull.H;
 const diamond=C.placePart(ship,'struct',[200,top+30,0],[80,60,60],{form:'box',roll:45,label:'diamond'});
 const A=C.partAABB(diamond);
 // A small block in the empty upper corner of the diamond's box: inside its bounding box, clear of its shape.
 const corner=C.placePart(ship,'struct',[200,A[4]-4,A[5]-4],[10,4,4],{form:'box',label:'corner'});
 return {ship,diamond,corner};
}
test('a block inside another structure\'s bounding box but clear of its shape is reported as not grounded',()=>{
 const {ship,diamond,corner}=fixture(),S=C.computeStats(ship);
 assert.ok(S.ungrounded.parts.includes(corner.id),'the corner block floats');assert.ok(!S.ungrounded.parts.includes(diamond.id),'the diamond stands on the hull');
});
