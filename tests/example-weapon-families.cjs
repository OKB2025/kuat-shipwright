const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/core.js'){
  // Expose the registered source recipe so family/seat checks run before the
  // separate common propulsion and thermal refit, without duplicating recipes.
  const hook='SHIP_EXAMPLES[d.key]={...example,build:';assert.equal(source.split(hook).length,2);
  source=source.replace(hook,'SHIP_EXAMPLES[d.key]={...example,_testBuild:d.build,build:');
 }
 vm.runInContext(source,cx,{filename:file});
}
const C=vm.runInContext('Core',cx),ships=new Map();
function ship(key){if(!ships.has(key))ships.set(key,C.SHIP_EXAMPLES[key]._testBuild(key.startsWith('recusant')?{}:{stage:'fitted'}));return ships.get(key);}
const plans={
 mc30c:{monCalPD:10,single500:16,cmsl:8,trc:2},
 mc75:{monCalPD:20,monCal34:12,monCal150Ion:16,cmsl:12,trc:6},
 munificent:{munBow:1,munTwin:18,pd:58},
 providence:{monCalPD:58,monCal200Triple:14,monCal150Ion:2,cmsl:34,trc:4},
 providenceDn:{monCalPD:24,monCal80:34,monCal200Triple:14,monCal150Ion:2,cmsl:34,trc:10},
 recusant:{recProw:1,recTwin:1,recKeel:1,refVen:4,pd:30,monCal34:26,monCalPD:10},
 recusantDn:{stl:9,refVen:21,pd:90,monCal34:24},
 lucrehulk:{monCalPD:4,monCal34:28,quad1Rapid:14,trc:6},
 subjugator:{monCalPD:400,monCal34:700,monCal80:20,monCal200Triple:20,cmsl:10,trc:2}
};
for(const [key,counts] of Object.entries(plans))test(`${key} preserves its curated weapon roster and native spherical seats`,()=>{
 const s=ship(key),weapons=s.fits.filter(f=>C.FITS[f.k]?.cat==='w');
 if(key==='mc30c'){assert.equal(s.fits.filter(f=>C.fitSpec(f).ion>0).length,0,'no oversized ion batteries');for(const f of s.fits.filter(f=>f.k==='single500')){assert.equal(C.fitSpec(f).boltTT,.5);assert.equal(C.fitSpec(f).barrels,1);assert.equal(C.fitSpec(f).cycle,C.FITS.single500.cycle);}}
 for(const [kind,total] of Object.entries(counts))assert.equal(s.fits.filter(f=>f.k===kind).length,total,kind);
 for(const f of weapons){
  assert.ok(Object.hasOwn(counts,f.k),'no obsolete or unrelated weapon '+f.k);assert.equal(f.float,false,'seated '+f.id);
  assert.ok(f.p.every(Number.isFinite),'finite mount '+f.id);
  if(f.k.startsWith('monCal')||f.k==='single500'){
   assert.equal(C.isBallTurret(f),true);assert.equal(C.fitSpec(f).barrels,['monCalPD','monCal200Triple'].includes(f.k)?3:1);
   // Probe only the local contact face, so a valid trench wall is not replaced
   // by a more distant outer surface during the assertion.
   const up=C.fitUp(f),h=C.rayEnv(s,C.add(f.p,C.mul(up,.1)),C.mul(up,-1),{maxT:.2,structOnly:true});
   assert.ok(h,'native contact '+f.k+' #'+f.id);assert.ok(C.len(C.sub(h.p,f.p))<.025,'flush spherical seat '+f.id);
  }
 }
});

test('curated CIS model-cut gun yields, cadences and native variant branches are retained',()=>{
 for(const [key,barrels,boltTT,cycle] of [['recProw',1,2000,15],['recTwin',2,360,15],['recKeel',2,360,15],['munBow',2,2500,1.6],['munTwin',2,.3,.2]]){
  const d=C.FITS[key];assert.equal(d.barrels,barrels,key);assert.equal(d.boltTT,boltTT,key);assert.equal(d.cycle,cycle,key);assert.equal(d.tt,barrels*boltTT,key);assert.equal(C.weaponModelScale({k:key}),1,key+' retains the source-model scale');
 }
 const rec=ship('recusant');assert.equal(rec.fits.filter(f=>f.k==='monCal34'&&f.batteryZone.startsWith('flank-ball')).length,16);assert.equal(rec.fits.filter(f=>f.k==='monCal34'&&/^(port|stbd)-side$/.test(f.batteryZone)).length,10);
 const dn=ship('recusantDn');assert.equal(dn.fits.filter(f=>['recProw','recTwin','recKeel'].includes(f.k)).length,0,'the existing dreadnought branch keeps its separate armament');
 assert.equal(ship('munificent').fits.filter(f=>C.fitSpec(f).ion>0).length,0,'the curated Munificent omits ion batteries');
});
test('Subjugator keeps both fixed hyper-ion cannons alongside its spherical battery refit',()=>{
 const s=ship('subjugator'),guns=s.parts.filter(p=>p.k==='hion');assert.equal(guns.length,2);
 for(const gun of guns){assert.equal(gun.d,310.8);assert.ok(s.parts.some(p=>p.id===gun.reactor&&p.k==='gen'));}
});
test('Lucrehulk rapid quads use the full CIS model and the LH-3210 freighter removes every gun',()=>{
 const s=ship('lucrehulk'),guns=s.fits.filter(f=>f.k==='quad1Rapid');assert.equal(guns.length,14);
 for(const f of guns){const d=C.fitSpec(f);assert.equal(d.barrels,4);assert.equal(d.tt,4);assert.ok(d.fm>=C.fitSpec({k:'quad500'}).fm);assert.equal(f.float,false);assert.ok(guns.some(g=>g!==f&&Math.abs(g.p[0]-f.p[0])<.01&&Math.abs(g.p[2]+f.p[2])<.01),'mirrored equatorial rapid battery');}
 const cargo=ship('lh3210');assert.equal(cargo.fits.filter(f=>C.FITS[f.k]?.cat==='w'&&f.k!=='trc').length,0);assert.equal(cargo.fits.filter(f=>f.k==='trc').length,6);
});
test('Corellian and Imperial Dreadnaught examples retain conventional guns and independent twin PD',()=>{
 const cr=ship('cr90');for(const [k,n] of Object.entries({single200:2,twin200:2,pd:4}))assert.equal(cr.fits.filter(f=>f.k===k).length,n,k);
 const dn=ship('dreadnaught');assert.equal(dn.fits.filter(f=>f.k==='twin200').length,10);assert.equal(dn.fits.filter(f=>f.k==='quad200').length,20);assert.equal(dn.fits.filter(f=>f.k==='pd').length,10);
 for(const s of [cr,dn]){assert.equal(s.fits.filter(f=>f.k.startsWith('monCal')||f.k.startsWith('casemate')).length,0);assert.equal(s.fits.filter(f=>f.float).length,0);}
});

test('GR-75 carries exactly two conventional laser turrets',()=>{
 const s=ship('gr75'),guns=s.fits.filter(f=>C.FITS[f.k]?.cat==='w');assert.equal(guns.length,2);assert.ok(guns.every(f=>f.k==='pd'&&!f.float));assert.ok(guns.some(f=>f.p[2]>0)&&guns.some(f=>f.p[2]<0));
});
