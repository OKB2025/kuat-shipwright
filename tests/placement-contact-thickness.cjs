const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
function fixture(roll=70){const ship=C.newShip({L:100,W:100,H:100,assembly:true});ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[60,60,20],roll}];ship.fits=[];ship.nextId=2;return ship;}
function solve(ship,size,mode='horizontal',o=[0,100,0],d=[0,-1,0]){return C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:[0,0,0],s:size},{mode,parentStructureId:1,hit:C.rayPart(o,d,ship.parts[0])});}

test('a parent ridge through the horizontal roof is rejected rather than silently deleting that roof',()=>{
 const ship=fixture(),before=C.publicJSON(ship),result=solve(ship,[20,20,1]);
 assert.equal(result.ok,false);assert.equal(result.code,'minimum-thickness');assert.ok(result.minimumThickness>0);
 assert.equal(C.publicJSON(ship),before,'a failed fit keeps the source and undo input intact');
});

test('vertical side fitting checks the whole projected contact region for minimum thickness',()=>{
 const ship=fixture(),before=C.publicJSON(ship),result=solve(ship,[20,1,20],'vertical',[0,0,100],[0,0,-1]);
 assert.equal(result.ok,false);assert.equal(result.code,'minimum-thickness');assert.equal(C.publicJSON(ship),before);
});

test('underside horizontal fitting applies the same thickness constraint after reflection',()=>{
 const ship=fixture(-70),result=solve(ship,[20,20,1],'horizontal',[0,-100,0],[0,1,0]);
 assert.equal(result.ok,false);assert.equal(result.code,'minimum-thickness');
});

test('a finite parent does not remove valid planar overhang or the unchanged opposite roof',()=>{
 const ship=fixture(0),result=solve(ship,[100,100,3]);assert.equal(result.ok,true,result.error);assert.equal(result.contact.connected,true);
 assert.ok(Math.abs(C.partVolume(result.part)-30000)<.01);const top=C.rayPart([45,100,45],[0,-1,0],result.part);assert.ok(top,'the corner outside the finite parent remains real geometry');assert.ok(Math.abs(top.p[1]-13)<1e-5);
});
