const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v));

function atSurfaceLimit(){
 const ship=C.newShip({L:180,W:100,H:80,assembly:true},'Full surface ledger');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};
 C.placePart(ship,'struct',[90,30,0],[150,80,40],{form:'box'},false);
 const raw=plain(C.serialize(ship));
 raw.surfaces={version:4,patches:Array.from({length:512},(_,i)=>({id:'hull:top:'+i+':retained',functionMode:'armor',armor:{material:'standard',thickness:0},battery:{weapon:'none',count:0},equipment:{kind:'none',count:0,depth:1}}))};
 raw.fits=[{id:10,k:'msl',p:[70,50,15],a:2,ped:0,base:0,low:0,mount:'vls',float:false}];raw.nextId=11;
 return C.deserialize(raw);
}

test('a legacy VLS at the surface limit stays saved inactive inventory through remounting and repeated reloads',()=>{
 let ship=atSurfaceLimit();
 for(let round=0;round<3;round++){
  const f=ship.fits.find(f=>f.id===10);assert.ok(f,'the disabled launcher must retain its original ID');
  assert.equal(f.k,'cmsl');assert.equal(f.legacyMissileMount,'vls-orphan');assert.equal(ship.surfaces.patches.length,512);
  C.remount(ship);
  assert.equal(f.float,true,'remounting a valid old deck cannot reactivate a VLS that has no equipment surface');
  assert.equal(f.surfaceUnplaced,true);assert.equal(C.missileCells(ship).length,0,'inactive inventory has no working magazine');
  const stats=C.computeStats(ship),modules=C.fleetModules(ship,stats);
  assert.equal(stats.mslSalvo,0,'an orphan contributes no concussion missile output');
  assert.ok(!modules.some(m=>m.fit===10&&m.k==='launcher'&&m.stock>0),'a fleet profile cannot give the orphan ammunition');
  const saved=plain(C.serialize(ship)),row=saved.fits.find(f=>f.id===10);assert.ok(row,'saving must retain the launcher');
  assert.equal(row.float,true);assert.equal(row.surfaceUnplaced,true);assert.equal(row.legacyMissileMount,'vls-orphan');
  assert.equal(C.fitSpec(row).mass,C.FITS.cmsl.mass,'inactive inventory retains its fitting mass');
  const removed=plain(saved);removed.fits=removed.fits.filter(f=>f.id!==10);
  assert.ok(Math.abs(stats.mass-C.computeStats(C.deserialize(removed)).mass-C.FITS.cmsl.mass)<1e-6,'the saved orphan still contributes its installed mass');
  ship=C.deserialize(saved);
 }
});
