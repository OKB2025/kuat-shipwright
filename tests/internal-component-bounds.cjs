const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){const ship=C.newShip({L:20,W:10,H:8,plan:'rect',sec:'rect'},'Clipped internal plant');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};return ship;}
function near(a,b,epsilon=1e-4){assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);}
test('real clipped internal reactor volume does not enlarge the external ship dimensions',()=>{
 const ship=fixture(),before=C.shipBounds(ship),reactor=C.placePart(ship,'aux',[10,.4,0],4,{autoFit:false},false);C.syncCompartments(ship);
 assert.ok(reactor._clip?.tris.length);assert.ok(C.partVolume(reactor)>0);assert.ok(C.partVolume(reactor)<4*Math.PI*Math.pow(2,3)/3);assert.ok(C.partAABB(reactor)[1]<before[1]-1,'the nominal sphere extends below the keel');
 const bounds=C.shipBounds(ship);for(let axis=0;axis<6;axis++)near(bounds[axis],before[axis]);
 const stats=C.computeStats(ship);for(let axis=0;axis<3;axis++)near(stats.dims[axis],[20,10,8][axis]);
 const loaded=C.deserialize(C.serialize(ship));C.syncCompartments(loaded);for(let axis=0;axis<6;axis++)near(C.shipBounds(loaded)[axis],bounds[axis]);near(C.partVolume(loaded.parts.find(p=>p.k==='aux')),C.partVolume(reactor),1e-3);
});
test('actual external components still contribute their visible bounds beside a clipped internal plant',()=>{
 const ship=fixture();C.placePart(ship,'aux',[10,.4,0],4,{autoFit:false},false);const cockpit=C.placePart(ship,'cockpit',[10,8.5,0],2,{seats:1},false);C.syncCompartments(ship);
 assert.equal(C.isInternal(cockpit),false);const bounds=C.shipBounds(ship);near(bounds[1],0);near(bounds[4],9.5);assert.equal(plain(C.shipDimensions(ship))[0],20);
});
