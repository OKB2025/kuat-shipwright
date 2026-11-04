const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const retired={refSide:'twin40',xx9:'twin40',nk7:'quad40Ion'};
function rawDesign(fits){const s=C.newShip({L:600,W:400,H:120,plan:'rect',sec:'rect'},'Retired family inventory');s.parts=[];s.fits=[];const raw=plain(C.serialize(s));raw.fits=fits;raw.nextId=Math.max(1,...fits.map(f=>f.id+1));return plain(raw);}
const fitting=(k,id,extra={})=>({id,k,p:[60+id*40,120,id%2?30:-30],a:2,ped:0,base:0,low:0,float:false,...extra});

test('the spherical four-barrel40TT ion gun has one160TT ion salvo and no turbolaser output',()=>{
 const d=C.FITS.quad40Ion;
 assert.equal(d.name,'40TT 4連装イオン砲');assert.equal(d.asset,'family_quad40_ion');assert.equal(d.barrels,4);assert.equal(d.boltTT,40);assert.equal(d.tt,0);assert.equal(d.ion,160);assert.equal(d.cycle,1);assert.equal(d.power,160*C.TT);assert.equal(C.fitBand(d),'long');
 assert.equal(C.weaponModelScale({k:d.key}),1);assert.equal(C.fitCanRotate(d.key),true);
 const bank=C.weaponChargeSpec({k:d.key});assert.equal(bank.volleyTT,160);assert.equal(bank.boltTT,40);assert.equal(bank.targetVolume,3200);
 assert.equal(C.weaponRoles(d).pointDefense,false);assert.equal(C.weaponRoles(d).dualPurpose,false);
});

test('the actual engineering and fleet mount keep spherical ion damage separate from gun damage',()=>{
 const s=C.newShip({L:240,W:160,H:100,plan:'rect',sec:'rect'},'Four-barrel ion engineering');s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};
 C.placePart(s,'gen',[45,50,0],20,{},false);
 const h=C.rayEnv(s,[160,400,0],[0,-1,0],{structOnly:true});assert.ok(h);const result=C.placeFit(s,'quad40Ion',h.p,h.n,0,false);assert.ok(result.fit,result.err);const f=result.fit;f.chargeDepth=12;
 s.surfaces={version:4,mode:'compat',patches:[]};const S=C.computeStats(s),q=S.chargeInfo[f.id],p=C.fleetProfile(S,s.name,s),m=p.surface.mounts.find(m=>m.id===f.id);
 assert.ok(q);near(q.capacityRatio,1);near(q.storedTT,160);assert.equal(S.alphaTot,0);near(S.ionTot,160);assert.ok(S.ionRate.some(v=>v>0));assert.ok(S.alphaRate.every(v=>v===0));
 assert.ok(m);assert.equal(m.gun,0);near(m.ion,160);assert.equal(m.volleyTT,160);assert.equal(m.boltTT,40);assert.equal(m.barrels,4);assert.equal(m.cycle,1);near(m.capacity,160);assert.ok(p.gunArcs.every(v=>v===0));assert.ok(p.ionArcs.some(v=>v>0));
});

test('retired overlapping weapons migrate to current types while retaining saved fitting identity and settings',()=>{
 const old=plain(Object.entries(retired).map(([k],i)=>fitting(k,11+i,{tw:i===0?12:i===1?11:undefined,assetYaw:12.5,chargeSalvos:3,chargeDepth:18,chargeScale:1.25,batteryZone:'retained-row'}))),raw=rawDesign(old),before=plain(raw),s=C.deserialize(raw);
 assert.deepEqual(raw,before);assert.equal(s.fits.length,3);
 for(let i=0;i<old.length;i++){const from=old[i],to=s.fits[i];assert.equal(C.FITS[from.k],undefined,'retired names are migration inputs only');assert.equal(C.canonicalWeaponKind(from.k),retired[from.k]);assert.equal(to.k,retired[from.k]);for(const field of ['id','p','a','ped','tw','assetYaw','chargeSalvos','chargeDepth','chargeScale','batteryZone'])if(Object.hasOwn(from,field))assert.deepEqual(plain(to[field]),from[field],field);}
 const saved=plain(C.serialize(s));assert.deepEqual(plain(C.serialize(C.deserialize(saved))),saved);assert.deepEqual(saved.fits.map(f=>f.k),['twin40','twin40','quad40Ion']);
 for(const k of ['twin40','quad40Ion'])assert.equal(C.FITS[k].cycle,1,'migrated weapons use the canonical cadence');
});

test('retired Venator side skins cannot restore their old model or pose offsets after migration',()=>{
 for(const k of ['refSide','twin40'])for(const skinAsset of ['ven_side_gun','ven_side_port','ven_side_stbd']){
  const old=Object.freeze(fitting(k,41,{skinAsset,mountAxis:4,mountOffset:8,skinAnchor:[1,2,3],skinSize:[4,5,6],skinAxial:[0,0,1],skinDiameter:20,assetYaw:17,tw:42,chargeSalvos:2})),m=C.migrateWeaponFit(old);
  assert.equal(old.skinAsset,skinAsset);assert.equal(m.k,'twin40');assert.equal(m.id,41);assert.equal(m.a,4);assert.equal(m.tw,42);assert.equal(m.assetYaw,17);assert.equal(m.chargeSalvos,2);assert.deepEqual(plain(m.p),plain(old.p));for(const key of ['skinAsset','mountAxis','mountOffset','skinAnchor','skinSize','skinAxial','skinDiameter'])assert.equal(Object.hasOwn(m,key),false,key);assert.deepEqual(plain(C.migrateWeaponFit(m)),plain(m));
 }
 const custom=fitting('stl',1,{skinAsset:'ven_side_gun',mountAxis:4,mountOffset:5});assert.deepEqual(plain(C.migrateWeaponFit(custom)),plain(custom),'unrelated explicit custom skins remain design content');
});

test('surface aggregates and nested transport canonicalize all three retired families without mutating the source',()=>{
 const guns=Object.keys(retired).map((k,i)=>[51+i,k,100+i*40,120,0,2,0,1,0,100+i*40,120,0,8,8,4,0,0,0,0,1,'g'+i]),surfaces={version:4,mode:'strict',patches:[{id:'retained:top:0',battery:{weapon:'nk7',count:3},aggregate:{version:1,cells:[],guns,requested:3,requestedEquipment:0}}]},raw={blueprint:rawDesign([fitting('nk7',7)]),surfaces,fireArcs:[{k:'xx9',dir:[1,0,0]}]},before=plain(raw),out=C.migrateWeaponDesign(raw);
 assert.deepEqual(raw,before);assert.equal(out.blueprint.fits[0].k,'quad40Ion');assert.equal(out.fireArcs[0].k,'twin40');assert.equal(out.surfaces.patches[0].battery.weapon,'quad40Ion');assert.deepEqual(plain(out.surfaces.patches[0].aggregate.guns),guns.map(r=>[r[0],retired[r[1]],...r.slice(2)]));assert.equal(C.migrateWeaponDesign(out),out,'canonical transport is idempotent');
});
