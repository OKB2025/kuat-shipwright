const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),ships=new Map(),plain=v=>JSON.parse(JSON.stringify(v));
function ship(key){if(!ships.has(key))ships.set(key,C.SHIP_EXAMPLES[key].build({stage:'fitted'}));return ships.get(key);}
const plans=[
 ['mc80home',{monCalPD:56,monCal80:12,monCal34:28,monCal150Ion:4},303.12/320],
 ['mc80liberty',{monCalPD:88,monCal200Triple:4,monCal200:4,monCal150Ion:4},555.46/547]
];
for(const [key,counts,scale]of plans){
 test(`${key} replaces the old broadside batteries with all annotated spherical mounts on both faces`,()=>{
  const s=ship(key),guns=s.fits.filter(f=>f.referencePlan);assert.equal(guns.length,100);
  for(const [kind,total]of Object.entries(counts)){
   const rows=guns.filter(f=>f.k===kind);assert.equal(rows.length,total,kind);
   assert.equal(rows.filter(f=>f.a===2).length,total/2,kind+' dorsal');assert.equal(rows.filter(f=>f.a===3).length,total/2,kind+' ventral');
   for(const f of rows){assert.equal(C.isBallTurret(f),true,kind);assert.equal(C.fitSpec(f).barrels,kind==='monCalPD'||kind==='monCal200Triple'?3:1);const partner=guns.find(g=>g.id===f.vt);assert.ok(partner);assert.equal(partner.k,kind);assert.notEqual(partner.a,f.a);assert.equal(partner.vt,f.id);assert.deepEqual(plain(partner.referencePlan),plain(f.referencePlan));}
  }
  assert.equal(s.fits.filter(f=>f.k==='trc').length,6,'retain the separate tractor projectors');
  assert.equal(s.fits.filter(f=>C.FITS[f.k]?.cat==='w'&&!f.referencePlan&&f.k!=='trc').length,0,'no former casemates or PD screen remains');
 });
 test(`${key} seats every marked gun on the unchanged native ship surface near its plan position`,()=>{
  const s=ship(key);for(const f of s.fits.filter(f=>f.referencePlan)){
   assert.equal(f.float,false);assert.equal(f.ped,0);assert.equal(f.base,0);assert.equal(f.mountOffset,0);
   const up=C.fitUp(f),hit=C.rayEnv(s,C.add(f.p,C.mul(up,2000)),C.mul(up,-1),{structOnly:true});assert.ok(hit,'physical seat '+f.id);
   assert.ok(C.len(C.sub(f.p,hit.p))<.02,'native surface '+f.id);
   const [px,py]=f.referencePlan,x=s.hull.L*(1260-px)/1233,z=(293-py)*scale;
   assert.ok(Math.hypot(x-f.p[0],z-f.p[2])<=20.02,'marked column '+f.id);
   const geom=C.authoredTurretGeometry(f);assert.ok(geom);assert.equal(geom.muzzles.length,C.fitSpec(f).barrels);assert.ok(geom.muzzles.flat().every(Number.isFinite));
  }
 });
 test(`${key} allocates the full firing charge for every diagram gun`,()=>{
  const s=ship(key),stats=C.computeStats(s);for(const f of s.fits.filter(f=>f.referencePlan)){const charge=stats.chargeInfo[f.id],spec=C.fitSpec(f);assert.ok(charge);assert.ok(charge.ratio>1-1e-6,`${f.k} #${f.id} full charge`);assert.equal(charge.blocked,false);assert.ok(Math.abs(charge.storedTT-(spec.tt||spec.ion))<1e-5);
  }
 });
}
