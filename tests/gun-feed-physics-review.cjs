// Physics review 2026-11-25 (third review of the gun rules), the points it failed:
// 1. the gunhouse's share of a gun's charge is counted at the density its feed compartment holds its volleys at (it was the fixed
//    0.05 TT/m3, which made the gunhouse's share larger than the whole charge for a gun at the least volume or with feedK);
// 2. a mount carries its own input factor, and fills at its own rate (a laser beside turbolasers filled at 1/mean of its rate);
// 4. the least feed compartment is for each gun: a battery's record stands for aggregateCount of them.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
function built(key){const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));C.syncCompartments(s);C.remount(s);const S=C.computeStats(s);return {s,S,p:C.fleetProfile(S,s.name,s)};}
test('the least feed compartment is for each gun of a battery',()=>{
 const one=C.weaponChargeSpec({k:'single6MT',id:1}),forty=C.weaponChargeSpec({k:'single6MT',id:1,trenchAggregate:true,aggregateCount:40});
 near(one.targetVolume,C.GUN_RULES.feedMinM3);near(forty.targetVolume,40*C.GUN_RULES.feedMinM3);near(forty.ttPerM3,one.ttPerM3);near(forty.volleyTT,40*one.volleyTT);
 const big=C.weaponChargeSpec({k:'oct40',id:1}),bigTen=C.weaponChargeSpec({k:'oct40',id:1,trenchAggregate:true,aggregateCount:10});near(bigTen.targetVolume,10*big.targetVolume);assert.ok(big.targetVolume>C.GUN_RULES.feedMinM3);
});
test('a gunhouse holds its share of the charge at the compartment\'s own density, never more than the whole',()=>{
 for(const key of ['cr90','hammerhead']){const {s,S,p}=built(key);let fed=0;
  for(const m of p.surface.mounts){const f=s.fits.find(x=>x.id===m.id);if(!C.needsCapacitor(f)){assert.equal(m.housingCapacity,undefined);continue;}fed++;
   const q=S.chargeInfo[f.id],spec=C.weaponChargeSpec(f);near(m.housingCapacity,q.housingUsed*spec.ttPerM3);assert.ok(m.housingCapacity<=m.capacity*(1+1e-9),`${key} #${m.id}: gunhouse ${m.housingCapacity} of ${m.capacity}`);assert.ok(spec.ttPerM3<C.CHARGE_TT_M3,'these guns are at the least volume or carry feedK');}
  assert.ok(fed>0);}
});
test('a mount carries its own input factor: a laser\'s is the plant\'s efficiency alone, a turbolaser\'s its charge factor over it',()=>{
 const {s,p}=built('hammerhead'),eta=p.energyModel.eta;let lasers=0,turbo=0;
 for(const m of p.surface.mounts){const d=C.fitSpec(s.fits.find(x=>x.id===m.id));near(m.inputK,C.weaponChargeFactor(d)/eta);near(m.power,d.power/eta);
  // filling at m.power for one cycle delivers one volley: the mount fills as fast as it fires
  near(m.power*m.cycle/C.TT/m.inputK,m.volleyTT,1e-6);
  if(d.gunRule.kind==='laser'){lasers++;near(m.inputK,1/eta);}else{turbo++;assert.ok(m.inputK>1/eta);}}
 assert.ok(lasers>0&&turbo>0,'the Sphyrna carries both kinds');assert.ok(C.weaponInputFactor(p)>1/eta,'and its mean factor is above a laser\'s own');
});
