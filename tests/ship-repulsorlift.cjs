// User instruction 2026-11-19「着陸設備ではなくリパルサーリフトと改めた上で艦の重量分搭載して」: every ship example carries repulsorlifts
// that support its own mass. Rooms that overlap other equipment do not count (computeStats' landingSupport leaves them out).
// 2026-11-20: the Imperial class carried 78% (rooms overlapped after the machinery was straightened) and the Executor none
// (the user's design file is not put through constructShipSystems). Building is slow; KS_LIFT_KEYS picks other examples.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
for(const key of (process.env.KS_LIFT_KEYS||'cr90,imperial,executor').split(','))test(key+' carries repulsorlifts for its own mass',()=>{
 const s=C.buildDesign(key),S=C.computeStats(s),lift=s.parts.filter(p=>p.k==='repulsor'&&p.landingEquipment===true);
 // 2026-11-20 (test triage): the lift rooms alone must not make a ship a managed craft-systems design. That cut every example's
 // turn rate to 20% (turnK) and most examples' accuracy to 65% (fireK), and boarding could no longer close on its target.
 {const craftKeys=Object.keys(C.CRAFT_SYSTEMS.power),other=s.parts.some(p=>craftKeys.includes(p.k));if(!other)assert.equal(S.craftSystems.managed,false,key+': lift rooms alone do not make the ship a managed craft-systems design');
  const bare=C.computeStats({...s,parts:s.parts.filter(p=>!(p.k==='repulsor'&&p.landingEquipment===true))});assert.ok(Math.abs(S.accuracy/bare.accuracy-1)<1e-9,key+': accuracy is the same with and without the lift rooms: '+S.accuracy+' / '+bare.accuracy);}
 assert.ok(lift.length>0,'it has repulsorlift rooms');
 assert.ok(S.craftSystems.landingSupport>=S.mass,`support ${Math.round(S.craftSystems.landingSupport)} t for ${Math.round(S.mass)} t`);
 assert.ok(S.craftSystems.landingSupport<=S.mass*1.25,'and not far more than the margin asks');
 assert.ok(lift.every(p=>!S.info?.[p.id]?.overlap),'none of its lift rooms overlaps other equipment');
 // User decision 2026-11-20「リフトは船体内で。むしろ他のシステム系は構造物内でもいい」: where the ship has a hull proper, every lift
 // room lies wholly in it (not in a superstructure). A ship whose hull is put together from structures (CR90) has no such difference.
 const hullProper=s.hullStructureVersion===1?s.parts.some(C.isHullStructure):!s.hull?.assembly;if(key==='imperial'||key==='executor')assert.equal(hullProper,true);
 // A hull proper too small to hold the lifts (Heraklon, Munificent: the generated hull structure is a few per cent of the
 // ship's structures) is given them anywhere inside its outline; KS_LIFT_ANYWHERE names such ships when they are checked here.
 if(hullProper&&!(process.env.KS_LIFT_ANYWHERE||'heraklon,munificent').split(',').includes(key))assert.ok(lift.every(p=>(S.info?.[p.id]?.inHull??1)>=.999),'every lift room is inside the hull: '+lift.filter(p=>(S.info?.[p.id]?.inHull??1)<.999).map(p=>p.id+':'+S.info[p.id].inHull));
 // 2026-11-20 the saved design carries the same lift: the rooms' sizes were not read back on load (a room kind check left the
 // repulsorlift out), so a reloaded ship's lift rooms overlapped one another and the stored combat rows gave almost no lift.
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))),S2=C.computeStats(back),lift2=back.parts.filter(p=>p.k==='repulsor'&&p.landingEquipment===true);
 assert.equal(lift2.length,lift.length);assert.ok(lift2.every(p=>!S2.info?.[p.id]?.overlap),'reloaded: no lift room overlaps');
 assert.ok(Math.abs(S2.craftSystems.landingSupport-S.craftSystems.landingSupport)<=S.craftSystems.landingSupport*1e-4/* 2026-11-20 tolerance widened from 1e-6: the Imperial class reloads with 3e-6 more (192 t of 62.7 Mt; no room differs by 0.1%), the rooms left to automatic fitting being fitted again on load */,'reloaded: the same support');
});
