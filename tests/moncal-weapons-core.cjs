const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
// 2026-11-24 expectation changed (gun rules; docs/benchmarks/gun-rules-2026-11-24/expectation-changes.md): a laser's shot is that
// of its barrel's bore (laserShotKt; monCalPD 0.178 m = 133 kt, pd 0.40 m = 800 kt; was 100 kt) once a second a barrel (was 0.2 s);
// a turbolaser or ion gun's cycle is its charging time (gunRule.cycle; was 1 s, quad1Rapid 0.2 s) and its power the charging rate.
const laserBolt=k=>C.FITS[k].gunRule.perBarrel.reduce((t,b)=>t+C.laserShotKt(b.bore),0)/C.FITS[k].barrels*1e-9,ruleCycle=k=>C.FITS[k].gunRule.cycle;
const specs=[['monCalPD',3,laserBolt('monCalPD'),1,false],['monCal34',1,34,ruleCycle('monCal34'),false],['monCal80',1,80,ruleCycle('monCal80'),false],['monCal200',1,200,ruleCycle('monCal200'),false],['monCal200Triple',3,200,ruleCycle('monCal200Triple'),false],['monCal150Ion',1,150,ruleCycle('monCal150Ion'),true],['pd',2,laserBolt('pd'),1,false],['quad1Rapid',4,1,ruleCycle('quad1Rapid'),false]];
const chargedPerShot=(k,boltTT)=>{const r=C.FITS[k].gunRule;return r.kind==='laser'?boltTT:r.shotChargeTT;};
function fixture(k){const s=C.newShip({assembly:true,L:600,W:400,H:200},'Physical new weapon');s.parts=[];s.fits=[];s.hatches=[];s.armor={hull:0,cit:0};s.detail=0;const host=C.placePart(s,'struct',[300,-50,0],[600,400,100],{form:'box'},false),f={id:s.nextId++,k,p:[300,0,0],a:2,ped:0,base:0,low:0,float:false,localMount:true,host:host.id};C.mountFit(s,f);s.fits.push(f);return {s,f};}

test('new catalog ratings preserve per-barrel energy and use real native-sized gun models',()=>{
 for(const [k,barrels,boltTT,cycle,ion]of specs){const d=C.FITS[k],a=C.REFERENCE_ASSETS[d.asset];assert.equal(d.barrels,barrels,k);near(d.boltTT,boltTT);near(d.cycle,cycle);near(d.tt,ion?0:barrels*boltTT);near(d.ion||0,ion?barrels*boltTT:0);near(d.power,barrels*chargedPerShot(k,boltTT)*C.TT/cycle,Math.max(1,barrels*chargedPerShot(k,boltTT)*C.TT/cycle*1e-12));if(d.gunRule.kind!=='laser'){near(d.power,d.gunRule.chargeRateTT*C.TT,d.power*1e-12);near(d.gunRule.shotChargeTT,boltTT*(1+d.gunRule.barrelM/C.GUN_RULES.turbolaser.chargeLen),1e-9);}else assert.equal(d.cycle,1);assert.equal(C.weaponModelScale(k),1);assert.ok(a.faces<=5000);assert.equal(a.muzzlePoints.length,barrels);const {s,f}=fixture(k),g=C.authoredTurretGeometry(f);assert.ok(g,k+' has actual articulated joints');assert.equal(g.muzzles.length,barrels);assert.equal(G.meshReferenceFits(s).ni,drawAsset(k).faces*3);assert.equal(G.meshFits(s).ni,0,'the body is drawn once');}
 const quad=C.FITS.quad1Rapid,medium=C.FITS.quad500;assert.ok(quad.fm>=medium.fm&&quad.wm>=medium.wm&&quad.hm>=medium.hm,'CIS quad is at least the 500GT quad envelope');
});

test('all six diagram weapons are complete rotating spheres and save their placement pitch',()=>{
 for(const [k]of specs.slice(0,6)){const {s,f}=fixture(k),a=C.REFERENCE_ASSETS[C.FITS[k].asset];assert.equal(C.isBallTurret(f),true);assert.equal(C.fitCanRotate(f),true);assert.equal(a.gunhouseElevates,true);assert.equal(a.elevationIndexStart,0);assert.ok(a.sphereRadiusM>0);f.assetYaw=31;f.assetPitch=25;const g=C.authoredTurretGeometry(f),aim=C.aimAuthoredTurret(g,.3,.4);assert.equal(aim.muzzles.length,C.FITS[k].barrels);for(const p of aim.muzzles)assert.ok(p.every(Number.isFinite));const copy=C.deserialize(C.serialize(s)).fits.find(q=>q.id===f.id);assert.equal(copy.assetYaw,31);assert.equal(copy.assetPitch,25);assert.deepEqual(plain(C.authoredTurretGeometry(copy).muzzles),plain(g.muzzles));assert.deepEqual(plain(C.fitUp(copy)),[0,1,0]);}
});

test('charging is backed by closed physical rooms and any missing volume by internal capacitors',()=>{
 for(const k of ['monCal200Triple','monCal150Ion','quad1Rapid','pd']){const {s,f}=fixture(k),a=C.REFERENCE_ASSETS[C.FITS[k].asset];C.syncCompartments(s);const q=C.chargingStatus(s)[f.id];assert.ok(q,k);near(q.required,(C.fitSpec(f).tt||C.fitSpec(f).ion)/C.CHARGE_TT_M3);near(q.housingVolume,a.turretCompartment.volumeM3,Math.max(.001,a.turretCompartment.volumeM3*.002));assert.ok(q.housingVolume<a.size.reduce((n,v)=>n*v,1));assert.ok(q.volume<=q.plannedVolume+1e-5);near(q.storedTT,q.volume*C.CHARGE_TT_M3);near(q.ratio,1);assert.equal(q.allocationPending,false);if(q.internalRequired>1e-5)assert.ok(C.weaponCapacitors(s).some(p=>p.weaponId===f.id&&C.partVolume(p)>0));}
});

test('fleet profiles distinguish the 150TT ion gun from turbolaser damage and retain triple PD interception',()=>{
 for(const k of ['monCal150Ion','monCal200Triple','monCalPD','quad1Rapid']){const {s,f}=fixture(k);C.syncCompartments(s);const stats=C.computeStats(s),p=C.fleetProfile(stats,s.name,s);assert.equal(p.profileVersion,C.FLEET_PROFILE_VERSION);assert.ok(p.modules.some(m=>m.fit===f.id));if(k==='monCal150Ion'){near(stats.alphaTot,0);assert.ok(stats.ionTot>0);assert.ok(p.gunArcs.every(v=>v===0));assert.ok(p.ionArcs.some(v=>v>0));}else{assert.ok(stats.alphaTot>0);near(stats.ionTot,0);}if(k==='monCalPD'){assert.equal(C.weaponRoles(C.FITS[k]).pointDefense,true);assert.equal(C.weaponRoles(C.FITS[k]).dualPurpose,true);assert.ok(p.modules.some(m=>m.fit===f.id&&m.pd&&m.dualPurpose));}}
});

test('retained surface gun packing preserves whole-ball pitch, ownership and physical muzzle transforms',()=>{
 // Automatic surface allocation is retired. Exercise the actual retained-row
 // encoder/decoder with Core's production geometry and normalization helpers.
 const source=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),rowContext=vm.createContext({C,console});
 vm.runInContext('const {fitSpec,AXES,isBroadsideBattery,broadsideBatteryConfig,isBallTurret,ballTurretPitch,FITS,canonicalWeaponKind,setBroadsideBattery,isShapePart,dot,structFrame,normalizeFitMount}=C;',rowContext);
 for(const name of ['surfaceEncodeGun','surfaceDecodeGun']){const line=source.split('\n').find(line=>line.startsWith('function '+name+'('));assert.ok(line);vm.runInContext(line,rowContext);}
 for(const [k]of specs.slice(0,6)){const {f}=fixture(k);Object.assign(f,{surfacePatch:'p1:top:0:retained',surfacePoint:f.p.slice(),surfaceCell:'retained-7',assetPitch:-37.5,assetYaw:23.75,n:[0,1,0]});rowContext.fit=f;
  const row=vm.runInContext('surfaceEncodeGun(fit)',rowContext);assert.equal(row[24],-37.5);assert.equal(row[0],f.id);assert.equal(row[1],k);assert.equal(row[20],f.surfaceCell);rowContext.row=JSON.parse(JSON.stringify(row));
  const restored=vm.runInContext('surfaceDecodeGun(row,fit.surfacePatch,{id:fit.host})',rowContext);assert.equal(restored.assetPitch,-37.5);assert.equal(restored.assetYaw,23.75);assert.equal(restored.surfacePatch,f.surfacePatch);assert.equal(restored.host,f.host);assert.deepEqual(plain(C.fitUp(restored)),[0,1,0]);assert.equal(C.surfaceBatteryGeometry(restored),null);assert.deepEqual(plain(C.authoredTurretGeometry(restored).muzzles),plain(C.authoredTurretGeometry(f).muzzles));
 }
 const old=[7,'broadsideBattery',300,0,0,2,0,1,0,300,0,0,9,7,.2,0,23.75,0,0,1,'retained-7','70TT',2,true,18.5],out=C.migrateWeaponDesign({surfaces:{patches:[{id:'p1:top:0:retained',aggregate:{guns:[old]}}]}}).surfaces.patches[0].aggregate.guns[0];assert.equal(out[1],'monCal80');assert.equal(out[24],18.5,'clearing obsolete battery columns must not shift the retained pose column');
});
