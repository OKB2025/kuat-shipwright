const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){const hook='SHIP_EXAMPLES[d.key]={...example,build:';assert.equal(source.split(hook).length,2);source=source.replace(hook,'SHIP_EXAMPLES[d.key]={...example,_testBuild:d.build,build:');}vm.runInContext(source,cx,{filename:file});}
const C=vm.runInContext('Core',cx),near=(a,b,eps=.02)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`),sourceSizes=new Map(['monCalPD','pd'].map(k=>[k,[C.FITS[k].fm,C.FITS[k].hm,C.FITS[k].wm]])),ships=new Map();
function ship(key){if(!ships.has(key))ships.set(key,C.SHIP_EXAMPLES[key]._testBuild());return ships.get(key);}
for(const [key,kind,total,groupCount,partCount,shapeCount]of [['mc30c','monCalPD',10,{block:4,spine:4,bow:2},107,81],['munificent','pd',38,{mast:14,wing:24},65,44]]){
 const sourceSize=sourceSizes.get(kind);
 test(`${key} retains its curated full-size PD family on the native hull`,()=>{
  const s=ship(key),pd=s.fits.filter(f=>f.k===kind&&/^(?:block|spine|bow|mast|wing)-pd/.test(f.batteryZone||''));assert.equal(pd.length,total);assert.equal(s.parts.length,partCount);assert.equal(s.parts.filter(C.isShapePart).length,shapeCount,'station repairs must not add artificial gun platforms');
  for(const [prefix,count]of Object.entries(groupCount))assert.equal(pd.filter(f=>f.batteryZone?.startsWith(prefix+'-pd')).length,count);
  assert.deepEqual([C.FITS[kind].fm,C.FITS[kind].hm,C.FITS[kind].wm],sourceSize,'example placement must not shrink the common weapon');if(kind==='monCalPD'){assert.equal(sourceSize[1],3.6);assert.equal(sourceSize[2],3.6);}else assert.equal(sourceSize[0],9);
  for(const f of pd){assert.equal(f.float,false);near(f.ped||0,0,1e-12);if(f.mountSupport){assert.ok(C.turretSupportGeometry(f).volume>0);near(f.base,f.mountSupport.top,1e-9);}near(f.mountOffset||0,0,1e-12);assert.equal(C.fitSpec(f).asset,kind==='monCalPD'?'moncal_pd_triple':'pd_twin_side_laser');assert.equal(C.fitSpec(f).barrels,kind==='monCalPD'?3:2);}
  // Every station retains its native surface contact. Any generated slope
  // support is separate, finite geometry above that contact point.
  const repaired=key==='mc30c'?pd:pd.filter(f=>f.batteryZone.startsWith('wing-pd'));
  for(const f of repaired){const up=C.fitUp(f),hit=C.rayEnv(s,C.add(f.p,C.mul(up,1000)),C.mul(up,-1),{structOnly:true});assert.ok(hit,`${key} PD #${f.id} needs a physical native seat`);near(C.dot(C.sub(f.p,hit.p),up),0);}
 });
 test(`${key} reserves the complete requested PD banks without bypassing allocation`,()=>{
  const s=ship(key);C.syncCompartments(s);const status=C.chargingStatus(s,new Set());
  for(const f of s.fits.filter(f=>f.k===kind&&/^(?:block|spine|bow|mast|wing)-pd/.test(f.batteryZone||''))){const q=status[f.id];assert.ok(q,'every gun needs a real charging allocation');assert.equal(q.allocationPending,false);assert.equal(q.blocked,false);near(q.ratio,1,1e-9);near(q.volume,q.plannedVolume,1e-6);near(q.storedTT,C.weaponChargeSpec(f).volleyTT,1e-8);// Both authored models contain real closed charging cells; any remainder
  // is allocated inside the ship by the same ordinary bank allocator.
  assert.ok(q.housingUsed>0,'the authored gunhouse provides real charging volume');near(q.volume,q.housingUsed+q.internalVolume,1e-6);}
 });
}
