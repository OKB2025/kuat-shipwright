const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((x,i)=>near(x,b[i],e));
function fixture(size=[100,80,60]){const s=C.newShip({assembly:true,L:300,W:240,H:100},'Broadside physical fixture');s.parts=[];s.fits=[];const host=C.placePart(s,'struct',[100,40,0],size,{form:'box'},false);return {s,host};}
function place(s,host,caliber='40TT',guns=2,mirror=false){const p=C.worldStruct(host,[0,0,host.s[1]/2]),n=C.structFrame(host).rt;return C.placeFit(s,'broadsideBattery',p,n,0,mirror,{host:host.id,batteryCaliber:caliber,batteryGuns:guns});}

test('the catalog merges old duplicates and keeps 20GT per physical point-defense barrel',()=>{
 for(const [old,key]of Object.entries({mtl:'quad200',htl:'refVen',ltl:'pd',casemate40:'broadsideBattery',casemateMid:'broadsideBattery',casemateLight:'broadsideBattery',casemateIon:'broadsideBattery',casemateIonL:'broadsideBattery'})){
  assert.equal(C.canonicalWeaponKind(old),key);assert.equal(Object.keys(C.FITS).includes(old),false);
  const f={id:17,k:old,p:[2,3,4],a:4};const migrated=C.migrateWeaponFit(Object.freeze(f));assert.equal(migrated.id,17);assert.equal(migrated.k,key);vector(migrated.p,f.p);assert.equal(f.k,old);
  if(key==='broadsideBattery'){assert.equal(migrated.batteryGuns,2);assert.equal(migrated.batteryLegacyHull,true);assert.equal(C.fitHasPedestal(migrated),false);}
 }
 const pd=C.fitSpec({k:'ltl'});assert.equal(pd.barrels,2);near(pd.boltTT,.02);near(pd.tt,.04);near(pd.power,.04*C.TT/pd.cycle);assert.equal(pd.dualPurpose,true);assert.ok(C.FLEET_PROFILE_VERSION>=9);
 const tree={blueprint:{fits:[{id:21,k:'mtl',p:[4,5,6],a:2}]},craft:{fireArcs:[{k:'htl'}]}};const migrated=C.migrateWeaponDesign(Object.freeze(tree));assert.equal(migrated.blueprint.fits[0].k,'quad200');assert.equal(migrated.craft.fireArcs[0].k,'refVen');assert.equal(tree.blueprint.fits[0].k,'mtl');
});

test('count limits, per-gun output and power follow caliber on direct edits and malformed imports',()=>{
 const f={k:'broadsideBattery',batteryCaliber:'200GT',batteryGuns:999};
 for(const [caliber,max,bolt,cycle]of [['70TT',2,70,1],['40TT',2,40,1],['500GT',6,.5,.2],['200GT',6,.2,.2]]){
  const cfg=C.setBroadsideBattery(f,{caliber,guns:999});assert.equal(cfg.guns,max);assert.equal(cfg.maxGuns,max);
  const d=C.fitSpec(f);assert.equal(d.barrels,max);near(d.boltTT,bolt);near(d.tt,bolt*max);near(d.power,bolt*max*C.TT/cycle);assert.equal(d.ion,0);
 }
 C.setBroadsideBattery(f,{guns:-5});assert.equal(f.batteryGuns,1);C.setBroadsideBattery(f,{caliber:'unsupported',guns:NaN});assert.equal(f.batteryCaliber,'40TT');assert.ok(f.batteryGuns>=1&&f.batteryGuns<=2);
 const bad=C.migrateWeaponFit(Object.freeze({k:'broadsideBattery',batteryCaliber:'70TT',batteryGuns:7}));assert.equal(bad.batteryGuns,2);
});

test('new compartments require a real structure sidewall and mirror onto the correct host',()=>{
 const {s,host}=fixture();const before=s.nextId;
 assert.ok(C.placeFit(s,'broadsideBattery',[100,70,0],[0,1,0],0,false,{host:host.id}).err);assert.equal(s.nextId,before);assert.equal(s.fits.length,0);
 const hull=C.newShip({L:300,W:160,H:80,plan:'rect',sec:'rect'},'Hull-only');hull.parts=[];hull.fits=[];assert.ok(C.placeFit(hull,'broadsideBattery',[150,40,80],[0,0,1],0,false).err);
 const result=place(s,host,'200GT',6,true);assert.ok(result.fit,result.err);assert.equal(s.fits.length,2);
 for(const f of s.fits){assert.equal(f.host,host.id);assert.equal(f.batteryCaliber,'200GT');assert.equal(f.batteryGuns,6);assert.equal(f.float,false);assert.ok(f.local&&f.localNormal);}
 assert.equal(s.fits[0].tw,s.fits[1].id);assert.equal(s.fits[1].tw,s.fits[0].id);assert.ok(s.fits[0].local[2]*s.fits[1].local[2]<0,'each side has its own host-local wall coordinate');
 const {s:two}=fixture();two.parts=[];two.fits=[];const left=C.placePart(two,'struct',[100,40,70],[100,40,60],{form:'box'},true),right=two.parts.find(p=>p.id===left.tw);const mirrored=place(two,left,'500GT',6,true);assert.ok(mirrored.fit);assert.equal(two.fits.length,2);assert.equal(two.fits[0].host,left.id);assert.equal(two.fits[1].host,right.id);
});

test('the window keeps one exact frame and all gun mouths remain inside its black pane after save and host movement',()=>{
 const {s,host}=fixture();host.yaw=23;const result=place(s,host,'200GT',6);assert.ok(result.fit,result.err);const f=result.fit,g=C.broadsideBatteryGeometry(f);
 assert.equal(g.muzzles.length,6);assert.equal(g.barrels,6);assert.equal(g.fixed,false);vector(C.turretOrigin(f),g.mouth);assert.equal(C.fitHasPedestal(f),false);
 for(const p of g.muzzles){const q=C.sub(p,g.point);near(C.dot(q,g.normal),g.depth+g.lip);assert.ok(Math.abs(C.dot(q,g.u))<g.width*.35);near(C.dot(q,g.v),0);for(let k=0;k<3;k++)assert.ok(p[k]>=g.bounds[k]-1e-8&&p[k]<=g.bounds[k+3]+1e-8);}
 const restored=C.deserialize(C.serialize(s)),copy=restored.fits.find(q=>q.id===f.id);assert.equal(copy.batteryCaliber,'200GT');assert.equal(copy.batteryGuns,6);assert.equal(copy.host,host.id);C.broadsideBatteryMuzzles(copy).forEach((p,i)=>vector(p,g.muzzles[i],1e-6));
 host.c[0]+=17;host.yaw+=10;C.remount(s);assert.equal(f.float,false);assert.equal(f.host,host.id);assert.ok(C.len(C.sub(C.broadsideBatteryGeometry(f).mouth,g.mouth))>10);
});

test('a missing local wall never remounts a compartment onto the distant opposite wall',()=>{
 const {s,host}=fixture(),result=place(s,host,'200GT',6);assert.ok(result.fit,result.err);
 const f=result.fit,point=f.p.slice();f.local[2]=0;
 C.mountFit(s,f);assert.equal(f.float,true);vector(f.p,point);
});

test('each selected caliber allocates actual charging hardware behind the face and changing caliber invalidates its cache',()=>{
 const {s,host}=fixture(),r=place(s,host);assert.ok(r.fit);const f=r.fit;let previous;
 for(const [caliber,guns,total]of [['70TT',2,140],['40TT',2,80],['500GT',6,3],['200GT',6,1.2]]){
  C.setBroadsideBattery(f,{caliber,guns});C.syncCompartments(s);const plants=C.weaponCapacitors(s),p=plants.find(p=>p.weaponId===f.id),status=C.chargingStatus(s)[f.id];
  assert.ok(p,'the equipment is a real occupied capacitor compartment');assert.notEqual(p,previous);previous=p;
  assert.equal(p.k,'capacitor');assert.equal(p.barrels,guns);near(p.nominalTT,total);near(C.partVolume(p),total/C.CHARGE_TT_M3,1e-5);near(status.internalVolume,total/C.CHARGE_TT_M3,1e-5);near(status.storedTT,total,1e-7);near(status.ratio,1);assert.equal(status.housingUsed,0,'a painted window is not free equipment volume');
  assert.ok(C.dot(C.sub(p.c,f.p),C.fitUp(f))<0,'the real plant sits inside the selected wall');assert.ok(C.allOccupied(s).some(q=>q.id===p.id));
 }
});

test('insufficient physical space and explicitly blocked equipment reduce capacity instead of crediting nominal output',()=>{
 const {s,host}=fixture([12,12,12]),r=place(s,host,'70TT',2);assert.ok(r.fit,r.err);C.syncCompartments(s);const status=C.chargingStatus(s)[r.fit.id],plant=C.weaponCapacitors(s).find(p=>p.weaponId===r.fit.id);
 assert.ok(plant);assert.ok(C.partVolume(plant)<2800);assert.ok(status.capacityRatio<1);near(status.storedTT,status.volume*C.CHARGE_TT_M3);assert.equal(C.chargingStatus(s,new Set([plant.id]))[r.fit.id].ratio,0);
});

test('a physical reactor supplies recharging while the window itself supplies neither power nor free storage',()=>{
 const {s,host}=fixture(),r=place(s,host,'200GT',6);assert.ok(r.fit);
 C.syncCompartments(s);const unpowered=C.computeStats(s);assert.equal(unpowered.rc,0);
 near(unpowered.chargeInfo[r.fit.id].internalVolume,24,1e-5);
 C.placePart(s,'gen',[70,40,0],28,{label:'砲列の給電試験用反応炉'},false);
 C.syncCompartments(s);const powered=C.computeStats(s);assert.equal(powered.rc,1);
 near(powered.chargeInfo[r.fit.id].internalVolume,24,1e-5);
 assert.equal(powered.chargeInfo[r.fit.id].blocked,false);
 assert.ok(C.allOccupied(s).some(p=>p.k==='capacitor'&&p.weaponId===r.fit.id));
});

test('legacy hull-side inventory keeps IDs and its migration-only compatibility flag without permitting deck guns',()=>{
 const hull=C.newShip({L:300,W:160,H:80,plan:'rect',sec:'rect'},'Legacy casemates');hull.parts=[];hull.fits=[];const r=C.placeFit(hull,'casemateLight',[150,40,80],[0,0,1],0,false);assert.ok(r.fit,r.err);assert.equal(r.fit.k,'broadsideBattery');assert.equal(r.fit.batteryCaliber,'500GT');assert.equal(r.fit.batteryLegacyHull,true);
 const restored=C.deserialize(C.serialize(hull)),f=restored.fits.find(q=>q.id===r.fit.id);assert.ok(f);assert.equal(f.id,r.fit.id);assert.equal(f.batteryLegacyHull,true);C.remount(restored);assert.equal(f.float,false);assert.equal(f.batteryCaliber,'500GT');
 f.a=2;f.n=[0,1,0];f.tilt=[0,1,0];C.mountFit(restored,f);assert.equal(f.float,true,'compatibility never enables a deck-facing bay');
});

test('packed surface inventory retains clamped caliber/count and migrates old casemates without dropping their gun setting',()=>{
 const {s,host}=fixture(),patch=C.surfacePatches(s).find(p=>p._part?.id===host.id&&p.normal[2]>.9);assert.ok(patch);
 const row=[77,'broadsideBattery',...patch.center,4,0,0,1,...patch.center,9,7,12,0,0,0,0,1,'w0','200GT',600,false];
 const surfaces=C.normalizeSurfaces({version:4,mode:'strict',patches:[{id:patch.id,battery:{weapon:'broadsideBattery',count:1,caliber:'200GT',guns:600},aggregate:{version:1,cells:[],guns:[row]}}]});
 assert.equal(surfaces.patches[0].battery.guns,6);assert.equal(surfaces.patches[0].aggregate.guns[0][21],'200GT');assert.equal(surfaces.patches[0].aggregate.guns[0][22],6);
 const old=row.slice(0,21);old[1]='casemateLight';const migrated=C.normalizeSurfaces({version:4,patches:[{id:patch.id,battery:{weapon:'casemateLight',count:1},aggregate:{version:1,cells:[],guns:[old]}}]});assert.equal(migrated.patches[0].battery.weapon,'broadsideBattery');assert.equal(migrated.patches[0].battery.caliber,'500GT');assert.equal(migrated.patches[0].aggregate.guns[0][21],'500GT');assert.equal(migrated.patches[0].aggregate.guns[0][23],true);
 s.surfaces=surfaces;s._client=true;const f=C.surfaceDerivedFits(s).find(f=>f.id===77);assert.ok(f);assert.equal(f.batteryCaliber,'200GT');assert.equal(f.batteryGuns,6);assert.equal(C.fitSpec(f).barrels,6);
});

test('common engineering and fleet snapshots use dynamic output, actual capacity and every physical muzzle',()=>{
 const {s,host}=fixture(),r=place(s,host,'200GT',6);assert.ok(r.fit);C.enableSurfaceMode(s,true,{report:false});C.syncCompartments(s);C.remount(s);C.syncCompartments(s);const stats=C.computeStats(s),profile=C.fleetProfile(stats,s.name,s),mount=profile.surface.mounts.find(m=>m.id===r.fit.id);assert.ok(mount);
 assert.equal(profile.profileVersion,9);assert.equal(mount.broadsideBattery,true);assert.equal(mount.barrels,6);near(mount.volleyTT,1.2);near(mount.boltTT,.2);near(mount.power,C.fitSpec(r.fit).power*C.weaponInputFactor(profile),1e8);near(mount.capacity,1.2);assert.equal(mount.fixed,false);assert.equal(mount.muzzles.length,6);
 const offset=profile.surface.offset;mount.muzzles.forEach((p,i)=>vector(C.add(p,offset),C.broadsideBatteryMuzzles(r.fit)[i],1e-6));
});
