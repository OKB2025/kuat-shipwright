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
 assert.ok(lift.length>0,'it has repulsorlift rooms');
 assert.ok(S.craftSystems.landingSupport>=S.mass,`support ${Math.round(S.craftSystems.landingSupport)} t for ${Math.round(S.mass)} t`);
 assert.ok(S.craftSystems.landingSupport<=S.mass*1.25,'and not far more than the margin asks');
 assert.ok(lift.every(p=>!S.info?.[p.id]?.overlap),'none of its lift rooms overlaps other equipment');
 // 2026-11-20 the saved design carries the same lift: the rooms' sizes were not read back on load (a room kind check left the
 // repulsorlift out), so a reloaded ship's lift rooms overlapped one another and the stored combat rows gave almost no lift.
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s)))),S2=C.computeStats(back),lift2=back.parts.filter(p=>p.k==='repulsor'&&p.landingEquipment===true);
 assert.equal(lift2.length,lift.length);assert.ok(lift2.every(p=>!S2.info?.[p.id]?.overlap),'reloaded: no lift room overlaps');
 assert.ok(Math.abs(S2.craftSystems.landingSupport-S.craftSystems.landingSupport)<=S.craftSystems.landingSupport*1e-6,'reloaded: the same support');
});
