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
 // 2026-11-25 (user decision, expectation-changes.md): a laser is its barrels alone and has no feed compartment. Both PD families
 // here are lasers (gunRule.kind), so the case that stated a full charging bank for every PD gun (ratio 1, storedTT = the volley,
 // gunhouse cells used) now states that none of them has a compartment, a charging entry or a charging part.
 // 2026-11-25 expectation changed (user「0.1秒で15秒間射撃できる量の発射ガス区画を作って」「点防御は1門0.1で約15秒間持続射撃でき、その後リチャージに30秒で」;
 // docs/benchmarks/gun-rules-2026-11-24/followup-2026-11-25/expectation-changes-2026-11-25.md): later the same day a point-defence laser was given
 // a firing-gas compartment for its 150 volleys (C.weaponChargeSpec: pd 0.676 m³, monCalPD 0.169 m³ at C.LASER_GAS_TT_M3), so each PD gun now
 // needs a compartment (C.needsCapacitor true, was false) and has a charging allocation and entry (were undefined). The gas fits inside the
 // gunhouse, so still no charging part is made. The title was '… PD lasers carry no feed compartment, charging entry or charging part'.
 test(`${key} PD lasers carry a firing-gas compartment inside the gunhouse with a charging entry, and no charging part`,()=>{
  const s=ship(key);C.syncCompartments(s);const status=C.chargingStatus(s,new Set()),info=C.computeStats(s).chargeInfo||{},banks=C.weaponCapacitors(s);
  assert.equal(C.FITS[kind].gunRule.kind,'laser');
  for(const f of s.fits.filter(f=>f.k===kind&&/^(?:block|spine|bow|mast|wing)-pd/.test(f.batteryZone||''))){assert.equal(C.needsCapacitor(f),true);const w=C.weaponChargeSpec(f),r=C.FITS[kind].gunRule;assert.equal(w.gas,true);assert.equal(r.burstVolleys,150);near(w.targetVolume,C.FITS[kind].tt*150/C.LASER_GAS_TT_M3,1e-9);assert.equal(w.targetVolume.toFixed(3),kind==='pd'?'0.676':'0.169');assert.ok(status[f.id],'a point-defence laser has a charging allocation');near(status[f.id].required,w.targetVolume,1e-6);assert.ok(status[f.id].housingVolume>=w.targetVolume,'the gas fits inside the gunhouse');assert.ok(info[f.id],'and a charging entry');assert.ok(!banks.some(p=>p.weaponId===f.id||p.weaponIds?.includes(f.id)),'no charging part is made for a laser');}
  // The ship's other guns keep theirs: every gun that needs a compartment has an entry, and only those.
  const need=s.fits.filter(f=>C.needsCapacitor(f)&&!f.float);assert.ok(need.length>0);assert.equal(Object.keys(status).map(Number).sort((a,b)=>a-b).join(),need.map(f=>f.id).sort((a,b)=>a-b).join());for(const f of need){const r=C.fitSpec(f).gunRule;assert.ok(r?.kind!=='laser'||r.burstVolleys>1,f.k+': the only lasers with a compartment are the point defence');}/* 2026-11-25: was assert.notEqual(kind,'laser') for every gun with a compartment */
 });
}
