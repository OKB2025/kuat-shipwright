// The Recusant's and the Munificent's model-cut guns (docs/recusant-munificent-guns.md): catalog outputs as the user
// set them, fixed mounts that bear along the bow, the example placements, and the crew still fitting aboard.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);

test('catalog outputs follow the user (2 PT prow gun, 360 TT twins, 2.5 PT x2 bow gun, 50 TT ventral twins)',()=>{
 for(const [k,barrels,bolt,fixed] of [['recProw',1,2000,true],['recTwin',2,360,false],['recKeel',2,360,true],['munBow',2,2500,true],['munTwin',2,50,false]]){
  const d=C.FITS[k],a=C.REFERENCE_ASSETS[d.asset];assert.ok(a,k+' asset registered');
  assert.equal(d.barrels,barrels,k);near(d.boltTT,bolt);near(d.tt,barrels*bolt);near(d.power*d.cycle/C.TT,barrels*bolt,1e-6);
  assert.equal(!!d.fixedMount,fixed,k);assert.equal(a.muzzlePoints.length,barrels,k+' a muzzle per barrel');
  assert.ok(a.faces<=5000,k+' triangle budget');assert.equal(C.weaponModelScale({k}),1,k+' native model size');assert.equal(C.needsCapacitor({k}),true,k+' charges like any gun');}
});

test('the Recusant carries the three bow guns at the model positions, the flank ball ports, and its crew fits',()=>{
 const s=C.buildDesign('recusant'),S=C.computeStats(s),at=k=>s.fits.filter(f=>f.k===k);
 for(const [k,p] of [['recProw',[906.9,14.29,0]],['recTwin',[1071.4,52.86,0]],['recKeel',[1095.7,60.32,0]]]){
  const [f]=at(k);assert.ok(f&&!f.float,k);f.p.forEach((v,i)=>near(v,p[i],.02));}
 assert.deepEqual(Array.from(S.fitInfo[at('recProw')[0].id]),[1,0,0,0,0,0],'the fixed prow gun bears along the bow');
 assert.equal(at('monCal34').filter(f=>/^flank-ball/.test(f.batteryZone)).length,16);assert.equal(at('monCalPD').length,10);
 assert.equal(at('stl').length,0,'the old prow twin is gone');
 assert.ok(S.habit>=1,'crew fits: '+S.habit);
});

test('the Munificent carries the bow gun and 18 ventral twins with barrels outboard, and its crew fits',()=>{
 const s=C.buildDesign('munificent'),S=C.computeStats(s),tw=s.fits.filter(f=>f.k==='munTwin');
 const [bow]=s.fits.filter(f=>f.k==='munBow');assert.ok(bow&&!bow.float);assert.deepEqual(Array.from(S.fitInfo[bow.id]),[1,0,0,0,0,0]);
 assert.equal(s.fits.filter(f=>['ion','monCal150Ion','stl'].includes(f.k)).length,0,'the ion cannons and the old prow twins are gone');
 assert.equal(tw.length,18);for(const f of tw){assert.equal(f.float,false);const g=C.authoredTurretGeometry(f);assert.ok(Math.sign(g.fw[2])===Math.sign(f.p[2])&&Math.abs(g.fw[2])>.99,'barrels point outboard');}
 assert.ok(S.habit>=1,'crew fits: '+S.habit);
});
