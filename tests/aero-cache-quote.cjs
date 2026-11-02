const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),c=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),c,{filename:f});
const C=vm.runInContext('Core',c);
test('equipment-list quotes support both dedicated parts with measured or volume-only shapes',()=>{
 for(const k of ['wing','solarPanel']){
  const estimated=C.quoteCostBOM({parts:[{k,volume:1}]});assert.ok(Number.isFinite(estimated.total)&&estimated.total>0);
  const s=C.newShip({L:12,W:8,H:4,assembly:true}),p=C.placePart(s,k,[5,2,0],[4,8,.08]),volume=C.partVolume(p);
  const detailed=C.quoteCostBOM({parts:[{...p,volume}]});assert.equal(detailed.build,Math.round(C.partBuildCost(p,volume)));
 }
});
test('cached fire-arc occupancy follows panel folds without requiring a reload',()=>{
 const s=C.newShip({L:12,W:8,H:4,assembly:true}),p=C.placePart(s,'solarPanel',[5,2,0],[4,8,.08]);
 let flat;for(let i=0;i<3;i++)flat=C.heightfield(s);
 p.panelFold=60;const folded=C.heightfield(s),fresh=C.heightfield(C.deserialize(C.serialize(s)));
 assert.notEqual(folded,flat);assert.ok(Math.max(...folded.top)>Math.max(...flat.top)+1);
 assert.deepEqual(Array.from(folded.top),Array.from(fresh.top));
});
