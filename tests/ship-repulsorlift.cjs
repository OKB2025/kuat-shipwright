// The repulsorlift is carried for the design's mass without a part.
// User instruction 2026-11-19「着陸設備ではなくリパルサーリフトと改めた上で艦の重量分搭載して」(every ship carries repulsorlifts for its own mass), and
// user decision 2026-11-26「艦船に確実に存在してるなら乗員区画同様省略してもいいのでは？／リパルサーリフトは質量分搭載されてるという想定でリパルサーリフト
// の部品自体を無くせない？」「自動で足す／機体も無くす／3はそのまま」: the part is gone (ships' `repulsor`, craft's `landingGear`); its mass, price
// and power are added to the design by its mass (C.REPULSORLIFT). The inertial compensators and the integrity field stay parts.
// Until 2026-11-26 this file checked the lift rooms of built examples (their number, place in the hull, overlap and round trip);
// those checks went with the rooms. Building is slow; KS_LIFT_KEYS picks other examples.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),R=C.REPULSORLIFT,liftKind=p=>p.k==='repulsor'||p.k==='landingGear',near=(a,b,rel,msg)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*rel+1e-12,msg+': '+a+' vs '+b);
function box(extra=[]){const s=C.newShip({L:30,W:20,H:10,assembly:true},'lift');s.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[30,20,10]},...extra];s.fits=[];s.nextId=50;return s;}

test('the rule: volume by mass, and from it mass, price, power and support',()=>{
 assert.equal(R.supportTperM3,300);assert.equal(R.margin,1.1);assert.equal(R.density,.35);assert.equal(R.costM3,1);assert.equal(R.install,3500);assert.equal(R.powerWm3,1e15);
 near(R.massShare,1.1*.35/300,1e-12,'share of the whole mass');
 const a=C.repulsorliftOf(3000);near(a.volume,11,1e-12,'3000 t x 1.1 / 300');near(a.mass,3.85,1e-12,'11 m3 x 0.35');near(a.cost,3511,1e-12,'11 x 1 + one installation');near(a.power,1.1e16,1e-12,'11 m3 x 1e15 W');near(a.support,3300,1e-12,'mass x margin');
 const z=C.repulsorliftOf(0);assert.equal(z.cost,0,'nothing to lift, nothing to pay');assert.equal(z.mass,0);
});

test('a design carries it without a part: mass, price and power are in the design\'s figures',()=>{
 const s=box(),S=C.computeStats(s),L=S.repulsorlift;
 assert.ok(L&&L.mass>0&&L.cost>R.install,'the figures are reported');
 near(L.total,S.mass,1e-9,'sized on the design\'s whole mass');near(L.mass,S.mass*R.massShare,1e-9,'its mass is its share of the whole');
 near(S.repulsorSupport,S.mass*R.margin,1e-9,'support = mass x margin');near(S.craftSystems.landingSupport,S.mass*R.margin,1e-9,'the same in the systems row');
 assert.equal(S.craftSystems.landingRatio,1);assert.equal(S.craftSystems.landingReady,true);
 assert.ok(!S.warnings.some(w=>/リパルサーリフトの支持質量が不足/.test(w.text||'')),'no shortage warning exists any more');
 assert.ok(S.costBy.systems>=L.cost-1,'its price is in the systems category (the breakdown is in whole credits): '+S.costBy.systems+' / '+L.cost);
 assert.ok(S.draw.hotel>=L.power,'its power is in the hotel demand');
 assert.equal(S.canLand,false,'landing by itself is as it was for every example (REPULSORLIFT.shipsLand)');
 // twice the structure, twice the lift
 const t=box([{id:2,k:'struct',form:'box',c:[0,10,0],s:[30,20,10]}]),T=C.computeStats(t);near(T.repulsorlift.mass/T.mass,R.massShare,1e-9,'the share holds for another mass');
});

test('saved lift parts are taken out on load, with their lines and group entries',()=>{
 const o=JSON.parse(JSON.stringify(C.serialize(box([{id:2,k:'gen',c:[0,0,0],d:2},{id:3,k:'inertial',c:[5,0,0],d:1},{id:4,k:'integrity',c:[-5,0,0],d:1}]))));
 o.parts.push({id:10,k:'repulsor',c:[8,0,0],d:1,landingEquipment:true,room:[1,1,1]},{id:11,k:'repulsor',c:[-8,0,0],d:1},{id:12,k:'landingGear',c:[0,0,4],d:1});
 o.links=[...(o.links||[]),{kind:'power',from:'p2',to:'p10'},{kind:'power',from:'p2',to:'p3'}];o.groups=[{id:40,name:'g',parts:[3,10,12],fits:[]}];o.nextId=60;
 const m=C.migrateRetiredRepulsorlift(o);assert.equal(m.parts.filter(liftKind).length,0);assert.ok(!m.links.some(l=>l.to==='p10'||l.from==='p10'),'the line to the lift part is gone');assert.ok(m.links.some(l=>l.to==='p3'),'other lines stay');assert.deepEqual(Array.from(m.groups[0].parts),[3]);
 assert.equal(o.parts.filter(liftKind).length,3,'the saved object itself is not altered');
 const s=C.deserialize(o);assert.equal(s.parts.filter(liftKind).length,0,'none after load');for(const k of ['gen','inertial','integrity'])assert.equal(s.parts.filter(p=>p.k===k).length,1,k+' stays (user: 「3はそのまま」)');
 const again=C.serialize(s);assert.equal(again.parts.filter(liftKind).length,0,'none written again');
 const S=C.computeStats(s);near(S.repulsorSupport,S.mass*R.margin,1e-9,'the loaded design is carried all the same');
});

test('a craft whose only systems part was its landing equipment stays a managed craft',()=>{
 const o=JSON.parse(JSON.stringify(C.serialize(box())));delete o.systemsVersion;o.parts.push({id:10,k:'cockpit',c:[0,0,0],d:1},{id:12,k:'landingGear',c:[0,0,4],d:1});o.nextId=60;
 assert.equal(C.migrateRetiredRepulsorlift(o).systemsVersion,1);
 const plainShip=JSON.parse(JSON.stringify(C.serialize(box())));delete plainShip.systemsVersion;plainShip.parts.push({id:10,k:'repulsor',c:[0,0,0],d:1,landingEquipment:true});assert.notEqual(C.migrateRetiredRepulsorlift(plainShip).systemsVersion,1,'a ship is not made one');
});

test('the parts are not offered and are not placed by the catalogue',()=>{
 for(const k of ['repulsor','landingGear']){assert.equal(C.PARTS[k].catalogHidden,true,k);assert.equal(C.PARTS[k].retired,true,k);}
 assert.ok(!C.CRAFT_SYSTEM_KEYS.includes('landingGear'));assert.equal(C.CRAFT_SYSTEMS.power.landingGear,undefined);
});

for(const key of (process.env.KS_LIFT_KEYS||'cr90,craft_xwing,executor').split(','))test(key+' is built with no lift part and is carried for its mass',()=>{
 const s=C.buildDesign(key),S=C.computeStats(s);
 assert.equal(s.parts.filter(liftKind).length,0,'no lift part in the built example');
 near(S.repulsorSupport,S.mass*R.margin,1e-9,'support = mass x margin');assert.equal(S.craftSystems.landingReady,true);
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))),S2=C.computeStats(back);assert.equal(back.parts.filter(liftKind).length,0);near(S2.mass,S.mass,1e-4,'the reloaded design has the same mass');
});
