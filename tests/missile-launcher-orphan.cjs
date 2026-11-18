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

test('a full unrelated armor ledger cannot disable a manually seated legacy pod',()=>{
 let ship=atSurfaceLimit();
 for(let round=0;round<3;round++){
  const f=ship.fits.find(f=>f.id===10);assert.ok(f,'the launcher retains its original ID');
  assert.equal(f.k,'cmsl');assert.equal(ship.surfaces.patches.length,512);assert.ok(ship.surfaces.patches.every(p=>p.functionMode==='armor'));
  C.remount(ship);
  assert.equal(f.float,false,'the actual deck, rather than unrelated face-ledger capacity, determines whether this ordinary pod is seated');
  assert.equal(f.surfacePatch,undefined);assert.equal(C.isSurfaceVLS(f),false);assert.equal(C.missileCells(ship).length,0,'external pod ammunition does not require an automatic below-deck VLS cell');assert.equal(C.missileLauncherSpec(f).ammo,6);
  const stats=C.computeStats(ship),modules=C.fleetModules(ship,stats);
  assert.ok(stats.mslSalvo>0);const module=modules.find(m=>m.fit===10&&m.k==='launcher');assert.ok(module);assert.equal(module.stock,6);assert.equal(module.missileKind,'cmsl');assert.equal(module.tt,25);assert.ok(module.muzzle.every(Number.isFinite));for(const value of [stats.mass,stats.cost])assert.ok(Number.isFinite(value)&&value>0);
  const saved=plain(C.serialize(ship)),row=saved.fits.find(f=>f.id===10);assert.ok(row,'saving must retain the launcher');
  assert.equal(row.k,'cmsl');assert.equal(row.surfacePatch,undefined);assert.equal(C.fitSpec(row).mass,C.FITS.cmsl.mass);
  ship=C.deserialize(saved);C.remount(ship);assert.deepEqual(plain(C.serialize(ship)),saved,'an ordinary reload and remount does not duplicate or move the pod or armor ledger');
 }
});
