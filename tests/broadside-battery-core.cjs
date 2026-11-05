// Retired broadside saves remain importable, but now install spherical guns.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const oldFit=(k='broadsideBattery',extra={})=>({id:7,k,p:[100,50,80],a:4,n:[0,0,1],ped:0,base:0,low:0,float:false,localMount:true,...extra});

test('retired window and small-ion keys resolve to spherical weapons without duplicate catalog entries',()=>{
 const aliases={broadsideBattery:'monCal34',casemate40:'monCal34',casemateMid:'monCal34',casemateLight:'monCal34',casemateIon:'monCal150Ion',casemateIonL:'monCal150Ion',ionL:'monCal150Ion'};
 for(const [old,key]of Object.entries(aliases)){assert.equal(C.canonicalWeaponKind(old),key);assert.equal(Object.keys(C.FITS).includes(old),false);const source=Object.freeze(oldFit(old)),f=C.migrateWeaponFit(source);assert.equal(source.k,old);assert.equal(f.k,key);assert.equal(f.id,7);assert.deepEqual(plain(f.p),[100,50,80]);assert.ok(C.isBallTurret(f));assert.equal(C.isBroadsideBattery(f),false);assert.equal(C.fitCanRotate(f),true);}
 assert.equal(C.FITS.broadsideBattery,undefined);assert.equal(C.FITS.ionL,undefined);
});

test('old caliber selects the replacement while obsolete window settings and mesh poses cannot return',()=>{
 for(const [caliber,key]of [['70TT','monCal80'],['40TT','monCal34'],['500GT','monCal34'],['200GT','monCal34']]){
  const source=Object.freeze(oldFit('broadsideBattery',{batteryCaliber:caliber,batteryGuns:6,batteryLegacyHull:true,wallMountInvalid:true,skinAsset:'isd2_casemate',mountAxis:4,mountOffset:3,skinAnchor:[1,2,3],skinSize:[9,7,.35],tw:8,vt:9,assetYaw:27,chargeSalvos:3})),f=C.migrateWeaponFit(source);
  assert.equal(f.k,key);for(const key of ['batteryCaliber','batteryGuns','batteryLegacyHull','wallMountInvalid','skinAsset','mountAxis','mountOffset','skinAnchor','skinSize'])assert.equal(Object.hasOwn(f,key),false,key);
  for(const key of ['id','p','n','tw','vt','assetYaw','chargeSalvos'])assert.deepEqual(plain(f[key]),plain(source[key]),key);assert.deepEqual(plain(C.migrateWeaponFit(f)),plain(f),'migration stays idempotent');
 }
});

test('migrated fits retain wall mounting and can also mount on dorsal and ventral faces',()=>{
 const s=C.newShip({L:300,W:160,H:100,plan:'rect',sec:'rect'},'Retired battery import');s.parts=[];s.fits=[oldFit()];s.nextId=8;
 const loaded=C.deserialize(plain(C.serialize(s))),f=loaded.fits[0];assert.equal(f.k,'monCal34');assert.equal(f.id,7);assert.deepEqual(plain(f.p),[100,50,80]);
 for(const normal of [[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]])assert.equal(C.weaponMountAllowed(f,normal),true);
 const once=plain(C.serialize(loaded));assert.deepEqual(plain(C.serialize(C.deserialize(once))),once);
});

test('packed surface inventory migrates caliber and removes window-only columns without losing its identity',()=>{
 const s=C.newShip({L:300,W:160,H:100,plan:'rect',sec:'rect'},'Old surface bank');s.parts=[];s.fits=[];
 const patch=C.surfacePatches(s).find(p=>p.face==='top'),row=[77,'broadsideBattery',...patch.center,2,0,1,0,...patch.center,9,7,12,0,0,0,0,1,'w0','70TT',2,true];
 const raw={version:4,mode:'strict',patches:[{id:patch.id,battery:{weapon:'broadsideBattery',count:1,caliber:'70TT',guns:2,legacyHull:true},aggregate:{version:1,signature:'old-window',cells:[],guns:[row]}}]},before=plain(raw),out=C.migrateWeaponDesign({surfaces:raw}).surfaces;
 assert.deepEqual(raw,before);assert.equal(out.patches[0].battery.weapon,'monCal80');for(const key of ['caliber','guns','legacyHull'])assert.equal(Object.hasOwn(out.patches[0].battery,key),false,key);
 const next=out.patches[0].aggregate.guns[0];assert.equal(next[0],77);assert.equal(next[1],'monCal80');assert.deepEqual(plain(next.slice(2,21)),row.slice(2,21));assert.ok(next.length<=21||next.slice(21).every(v=>v==null));assert.notEqual(out.patches[0].aggregate.signature,'old-window');
});
