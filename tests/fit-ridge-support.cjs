// v24 A fitting set upright on a ridge or apex stands on a support filled down to the slopes (docs/fit-ridge-support-v24.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
function ridge(){
 const ship=C.newShip({L:400,W:100,H:60,sec:'warship',plan:'wedge'},'ridge fixture');C.ensurePrimaryHull(ship);
 const box=C.placePart(ship,'struct',[150,140,0],[80,40,40],{form:'box',roll:45,label:'ridge'});
 const top=C.partAABB(box)[4];return {ship,box,top};
}
test('a turret set upright on the crest of a ridge is accepted, stands upright and gets a support down to the slopes',()=>{
 const {ship,box,top}=ridge(),r=C.solveFitPlacement(ship,{id:9999,k:'htl'},{hostId:box.id,hit:{p:[150,top,0],n:[0,1,0]}});
 assert.equal(r.ok,true,r.error);const f=r.fit;assert.ok(Math.abs(f.n[1]-1)<1e-9,'the fitting stands along the requested direction');
 assert.equal(f.float,false);assert.ok(f.mountSupport&&f.slope>0,'a support fills down to the slopes');assert.ok(f.low<0);
});
test('a point that is not on the host is still rejected',()=>{
 const {ship,box,top}=ridge(),r=C.solveFitPlacement(ship,{id:9999,k:'htl'},{hostId:box.id,hit:{p:[150,top+30,0],n:[0,1,0]}});
 assert.equal(r.ok,false);
});
