// 2026-11-22 Gun batteries on a wall, with or without a trench (user: 「トレンチの有無に関わらず砲列を配置できるようにして焼き込み
// を行う」). A battery is a row's centre line on a wall (ship.batteries); its guns are packed and checked as a trench battery's
// are. The armed trenches of a hull become batteries before the hull is baked (bakeTrenchBatteries): the Executor's 44
// groups keep their counts, validity and charge rooms.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const load=k=>{const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',k,'design.json.gz')))));C.syncCompartments(s);return s;};
const plain=o=>JSON.parse(JSON.stringify(o));

test('a wall battery is created, saved, loaded, changed and removed without a trench',()=>{
 const s=load('cr90'),L=s.hull.L,hits=[.42,.46].map(f=>C.rayEnv(s,[f*L,16,-5000],[0,0,1],{structOnly:true}));assert.ok(hits.every(h=>h?.part&&Math.abs(h.p[2]-hits[0].p[2])<.05),'a flat stretch of the port wall');
 const r=C.configureTrenchArmament(s,{battery:{op:'set',host:hits[0].part.id,world:{pts:hits.map(h=>h.p),n:[0,0,-1]},height:3,depth:6,counts:[{kind:'single6MT',count:1}]}});assert.equal(r.ok,true,r.error);
 const groups=()=>C.bulkTrenchGroups(s).filter(f=>f.trenchRef.hostId==='battery');let g=groups();assert.equal(g.length,1);assert.equal(g[0].aggregateCount,1);assert.equal(g[0].valid,true,g[0].reason);
 assert.ok(g[0].muzzles.every(p=>p[2]<hits[0].p[2]+.2),'the muzzle stands on the port wall');
 const saved=plain(C.serialize(s));assert.equal(saved.batteries.length,1);assert.equal(saved.batteries[0].host,hits[0].part.id);assert.equal(saved.batteries[0].pts.length,2);
 const again=C.deserialize(saved);C.syncCompartments(again);assert.deepEqual(C.bulkTrenchGroups(again).map(f=>[f.k,f.aggregateCount,f.valid]),[['single6MT',1,true]]);
 const too=C.configureTrenchArmament(s,{battery:{op:'set',id:r.batteryId,counts:[{kind:'single6MT',count:40}]}});assert.equal(too.ok,false,'40 guns do not fit a 6 m by 3 m band');assert.match(too.error,/砲列の帯|射線|壁/);
 assert.equal(groups()[0].aggregateCount,1,'a refused change leaves the design as it was');
 const del=C.configureTrenchArmament(s,{battery:{op:'delete',id:r.batteryId}});assert.equal(del.ok,true);assert.equal(groups().length,0);assert.equal(s.batteries,undefined);
});

test('a battery line off any wall is refused with the reason',()=>{
 const s=load('cr90'),r=C.configureTrenchArmament(s,{battery:{op:'set',world:{pts:[[60,16,-200],[70,16,-200]],n:[0,0,-1]},height:3,depth:6,counts:[{kind:'single6MT',count:1}]}});
 assert.equal(r.ok,false);assert.match(r.error,/壁/);assert.equal(s.batteries,undefined);
});

test('broken battery data is refused on load',()=>{
 const raw=plain(C.serialize(load('cr90'))),one={id:5,pts:[[0,0,0],[1,0,0]],n:[0,0,1],height:2,depth:2};
 for(const bad of [[{...one,pts:[[0,0,0]]}],[{...one,n:[0,0,0]}],[{...one,height:0}],[one,{...one}],[{...one,armament:{version:1,counts:[{kind:'nope',count:1}]}}]])assert.throws(()=>C.deserialize({...raw,batteries:bad}));
 assert.deepEqual(plain(C.deserialize({...raw,batteries:[one]}).batteries),[one]);
});

test('the Executor trench batteries become wall batteries with the same groups',{timeout:3600000},()=>{
 const s=load('executor'),sum=()=>C.bulkTrenchGroups(s).map(f=>({k:f.k,n:f.aggregateCount,side:Math.sign(f.p[2]),valid:f.valid,charge:f.chargeVolume||0}));
 const before=sum();assert.ok(before.length>=40);const muzzles=()=>new Map(C.bulkTrenchGroups(s).map(f=>[f.k+':'+f.aggregateCount+':'+Math.sign(f.p[2]),f.trenchMuzzles.map(m=>m.p.map(v=>+v.toFixed(3)))]));const muzzlesBefore=muzzles();
 /* 2026-11-23: the regenerated example already has the trenches of its baked hulls as batteries (2 of 16); the rest are converted here */
 const armed=s.parts.filter(p=>C.isHullStructure(p)).reduce((n,p)=>n+(p.hullData?.trenches||[]).filter(t=>t.armament).reduce((m,t)=>m+(t.side==='both'?2:1),0),0);let made=[];for(const hull of s.parts.filter(p=>C.isHullStructure(p)&&(p.hullData?.trenches||[]).some(t=>t.armament)))made=made.concat(C.bakeTrenchBatteries(s,hull));
 assert.ok(armed>0);assert.equal(made.length,armed);assert.ok(made.every(q=>q.along==='x'),'a converted battery is measured on the hull length axis, as its trench was');assert.ok(s.parts.every(p=>!(p.hullData?.trenches||[]).some(t=>t.armament)),'the trench armament moved to the batteries');
 C.syncCompartments(s);const after=sum(),key=f=>f.k+':'+f.n+':'+f.side,rest=after.slice();
 for(const f of before){const i=rest.findIndex(g=>key(g)===key(f));assert.ok(i>=0,key(f));const g=rest.splice(i,1)[0];assert.equal(g.valid,f.valid,key(f));assert.ok(Math.abs(g.charge-f.charge)<=1e-6*Math.max(1,f.charge),key(f)+' charge');}
 assert.equal(rest.length,0);assert.equal(after.reduce((n,f)=>n+f.n,0),before.reduce((n,f)=>n+f.n,0));
 /* 2026-11-23 the guns stand where the trench packed them (before: the band was measured along the slanted wall and its up
    flipped on the port side, so the rows moved up to 1 km and the Executor's forward firepower fell by 20%) */
 const muzzlesAfter=muzzles();for(const [key,list] of muzzlesBefore){const got=muzzlesAfter.get(key);assert.ok(got,key);for(let i=0;i<list.length;i++)assert.ok(Math.hypot(...list[i].map((v,j)=>v-got[i][j]))<.05,key+' muzzle '+i+': '+list[i]+' → '+got[i]);}
});
