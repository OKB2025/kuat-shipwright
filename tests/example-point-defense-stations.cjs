const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,eps=.02)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`),sourceSize=[C.FITS.pd.fm,C.FITS.pd.hm,C.FITS.pd.wm],ships=new Map();
function ship(key){if(!ships.has(key))ships.set(key,C.buildDesign(key));return ships.get(key);}
for(const [key,total,groupCount,partCount,shapeCount]of [['mc30c',10,{block:4,spine:4,bow:2},107,81],['munificent',38,{mast:14,wing:24},47,26]]){
 test(`${key} builds every full-size dual-purpose gun on the original native hull`,()=>{
  const s=ship(key),pd=s.fits.filter(f=>f.k==='pd');assert.equal(pd.length,total);assert.equal(s.parts.length,partCount);assert.equal(s.parts.filter(C.isShapePart).length,shapeCount,'station repairs must not add artificial gun platforms');
  for(const [prefix,count]of Object.entries(groupCount))assert.equal(pd.filter(f=>f.batteryZone?.startsWith(prefix+'-pd')).length,count);
  assert.deepEqual([C.FITS.pd.fm,C.FITS.pd.hm,C.FITS.pd.wm],sourceSize,'example placement must not shrink the common weapon');assert.ok(sourceSize[0]>9&&sourceSize[2]>5.7);
  for(const f of pd){assert.equal(f.float,false);near(f.ped||0,0,1e-12);near(f.base||0,0,1e-12);near(f.low||0,0,1e-12);assert.equal(C.fitSpec(f).asset,'pd_turret_small');}
  // The repaired dorsal/ventral stations must coincide with actual existing hull
  // surfaces, rather than merely carrying float=false or an invisible support.
  const repaired=key==='mc30c'?pd:pd.filter(f=>f.batteryZone.startsWith('wing-pd'));
  for(const f of repaired){const up=C.fitUp(f),hit=C.rayEnv(s,C.add(f.p,C.mul(up,1000)),C.mul(up,-1),{structOnly:true});assert.ok(hit,`${key} PD #${f.id} needs a physical native seat`);near(C.dot(C.sub(f.p,hit.p),up),0);}
 });
 test(`${key} reserves the complete requested PD banks without bypassing allocation`,()=>{
  const s=ship(key);C.syncCompartments(s);const status=C.chargingStatus(s,new Set());
  for(const f of s.fits.filter(f=>f.k==='pd')){const q=status[f.id];assert.ok(q,'every gun needs a real charging allocation');assert.equal(q.allocationPending,false);assert.equal(q.blocked,false);near(q.ratio,1,1e-9);near(q.volume,q.plannedVolume,1e-6);near(q.storedTT,C.weaponChargeSpec(f).volleyTT,1e-8);assert.ok(q.internalVolume>0&&q.housingUsed>0,'the exposed house and actual ship-internal bank share the reservation');}
 });
}
