const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v));
const keys=new Set(['lifeSupport','ejectSeat','navComputer','targetComputer','maneuver','laserGas','landingGear']),fixtures=new Map();
function fixture(key){if(!fixtures.has(key)){const ship=C.buildDesign(key),stats=C.computeStats(ship);fixtures.set(key,{ship,stats});}return fixtures.get(key);}
const examples=Object.keys(C.CRAFT_SYSTEM_RECIPES);
for(const key of examples)test(`${key} carries complete ordinary systems without overlaps or flight penalties`,()=>{
 const {ship,stats:S}=fixture(key),sys=S.craftSystems,recipe=C.CRAFT_SYSTEM_RECIPES[key];
 assert.equal(ship.systemsVersion,1);assert.equal(sys.managed,true);assert.equal(sys.navReady,true);
 assert.equal(sys.targetRatio,1);assert.equal(sys.fireK,1);assert.equal(sys.maneuverRatio,1);assert.equal(sys.turnK,1);assert.equal(sys.landingReady,true);
 assert.ok(sys.laserGasSeconds>=600,'ten minutes of laser supply');
 assert.equal(sys.ejectionSeats,sys.crew,'one ejection mechanism for each human seat');
 if(sys.crew){assert.ok(sys.ejectionCoverage>=1);if(recipe.suit){assert.equal(sys.lifeSupportCapacity,0);assert.equal(sys.suitSeats,sys.crew);assert.equal(sys.lifeSupportHours,4);}else{assert.ok(sys.lifeSupportCapacity>=sys.crew);assert.ok(sys.lifeSupportHours>=12);}}
 else{assert.equal(ship.parts.some(p=>p.k==='lifeSupport'||p.k==='ejectSeat'),false);assert.equal(sys.lifeSupportHours,null);}
 for(const p of ship.parts.filter(p=>keys.has(p.k))){assert.equal(p.autoFit,false);assert.equal(!!S.info[p.id]?.overlap,false,`${p.label} must not overlap existing machinery`);assert.ok(C.partVolume(p)>0);}
 assert.equal(S.warnings.some(w=>w.code==='craft-systems'&&w.lv!=='info'),false);
 assert.ok(S.accelG>0);const craft=C.craftCombat(ship,S);assert.ok(craft.speed>0);assert.equal(craft.systems.fireK,1);assert.equal(craft.systems.turnK,1);
 const loaded=C.deserialize(C.serialize(ship));assert.equal(loaded.systemsVersion,1);
 assert.deepEqual(plain(loaded.parts.filter(p=>keys.has(p.k)).map(p=>[p.id,p.k,p.c,p.d,p.label,p.autoFit])),plain(ship.parts.filter(p=>keys.has(p.k)).map(p=>[p.id,p.k,p.c,p.d,p.label,p.autoFit])));
});

test('new support systems preserve every example hull, visible structure, gun, and existing wing mechanism',()=>{
 for(const key of examples){
  const {ship}=fixture(key),before=C.serialize(C.SHIP_EXAMPLES[key].build()),after=C.serialize(ship);
  assert.deepEqual(plain(after.hull),plain(before.hull),key+' hull');
  assert.deepEqual(plain(after.parts.filter(p=>p.k==='struct')),plain(before.parts.filter(p=>p.k==='struct')),key+' structures and wings');
  assert.deepEqual(plain(after.fits),plain(before.fits),key+' guns and mounts');
  for(const kind of ['gen','engine','hyper','shield','battery','fuel','astromech','droidbrain','radiator','hdis','hdisx'])assert.equal(after.parts.filter(p=>p.k===kind).length,before.parts.filter(p=>p.k===kind).length,key+' '+kind);
 }
 assert.equal(fixture('craft_xwing').ship.parts.filter(C.isFoil).length,4);
 for(const key of ['craft_tie_ln','craft_tie_in','craft_tie_sa']){
  const ship=fixture(key).ship;assert.equal(ship.parts.some(p=>['lifeSupport','hyper','shield'].includes(p.k)),false);
  assert.equal(ship.parts.filter(p=>p.k==='cockpit').every(p=>p.suit===true),true);
  const loaded=C.deserialize(C.serialize(ship));assert.equal(loaded.parts.filter(p=>p.k==='cockpit').every(p=>p.suit===true),true);
 }
});

test('loading an older example or removing a new system never silently reinstalls systems',()=>{
 const original=C.serialize(fixture('craft_awing').ship),old=plain(original);old.parts=old.parts.filter(p=>!keys.has(p.k));delete old.systemsVersion;
 const legacy=C.deserialize(old);assert.equal(legacy.parts.some(p=>keys.has(p.k)),false);assert.notEqual(legacy.systemsVersion,1);
 const edited=plain(original);edited.parts=edited.parts.filter(p=>p.k!=='navComputer');
 const loaded=C.deserialize(edited);assert.equal(loaded.parts.some(p=>p.k==='navComputer'),false);assert.equal(loaded.systemsVersion,1);
 const S=C.computeStats(loaded);assert.equal(S.craftSystems.navReady,false);assert.equal(S.jumpOK,false);
});

test('the same opt-in installer supports a user copy without a reference flag and is idempotent',()=>{
 const raw=plain(C.serialize(fixture('craft_awing').ship));raw.parts=raw.parts.filter(p=>!keys.has(p.k));delete raw.reference;delete raw.systemsVersion;raw.name='User interceptor';
 const user=C.deserialize(raw);C.installCraftSystems(user,C.CRAFT_SYSTEM_RECIPES.craft_awing);
 const before=JSON.stringify(C.serialize(user));C.installCraftSystems(user,C.CRAFT_SYSTEM_RECIPES.craft_awing);assert.equal(JSON.stringify(C.serialize(user)),before);
 const S=C.computeStats(user);assert.equal(S.craftSystems.navReady,true);assert.equal(S.craftSystems.fireK,1);assert.equal(S.craftSystems.turnK,1);assert.equal(S.craftSystems.landingReady,true);
 assert.ok(S.craftSystems.lifeSupportHours>=12);assert.ok(S.craftSystems.laserGasSeconds>=600);
});
