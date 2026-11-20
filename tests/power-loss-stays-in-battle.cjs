// User decision 2026-11-16「電源喪失は戦闘不能扱いではないようにしよう。単に動けなくなり、シールドを失い、発電量がゼロになり、星の重力に
// 少しずつ引かれていく」(asked: stored weapon charge still cannot fire without power). A ship that loses power keeps the
// existing disabled state (no thrust, turning, firing or jumping; its shield fades; gravity draws it down) but is not out
// of action: it stays a target and keeps its side in the battle.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
test('power loss is not out of action; other disabling reasons still are',()=>{
 assert.equal(C.outOfAction({out:'電源喪失'}),false);assert.equal(C.outOfAction({out:'艦橋喪失'}),true);assert.equal(C.outOfAction({out:null}),false);
 assert.equal(C.fleetEffective({out:'電源喪失'}),true);assert.equal(C.fleetEffective({out:'艦橋喪失'}),false);assert.equal(C.fleetEffective({out:'電源喪失',dead:true}),false);
 assert.equal(C.fleetActs({out:'電源喪失'}),false,'it cannot act');assert.equal(C.fleetActs({out:null}),true);
});
test('a ship whose reactors are gone stops, loses its shield, makes no power and sinks, and is still fired on',()=>{
 const a=C.fleetUnit('a','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),0),b=C.fleetUnit('b','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),1);b.pos=[6000,0,0];b.yaw=Math.PI;
 a.order={...a.order,type:'attack',target:'b',fire:true};b.order={...b.order,type:'attack',target:'a',fire:true};
 // 2026-11-19 expectation changed: a's sections are made 1e6 times stronger. Under the v30 section damage the CR90, its shield
 // gone with its power, was sunk by the other CR90's fire about 8 s in (docs/damage-penetration.md:64,90). The enemy keeps
 // firing at it, so it is still fired on; it now stays afloat long enough to check that power loss alone is not out of action.
 for(const x of a.sec){x.max*=1e6;x.s=x.max;}
 const B=C.fleetBattle([a,b],true);B.seed=3;
 for(let t=0;t<2;t+=.25)C.fleetTick(B,.25,{gravity:true});
 const mods=a.p.modules;for(let i=0;i<mods.length;i++)if(mods[i].k==='reactor'||mods[i].k==='gen')a.mods[i]=0;
 const y0=a.pos[1],sh0=a.shield;let hitsAfter=0;
 // 2026-11-20 scenario changed (reviewed change, not a new rule): a's crew is kept at its complement while it is fired on.
 // The examples were regenerated with repulsorlift rooms for each ship's mass (user instruction 2026-11-19, EXAMPLE_PROFILE_VERSION 5:
 // the CR90 row has 155 modules, was 78; crew 27, was 26), and the same 20 s of fire on the unshielded hull now leaves 4.7 of 27
 // crew (17%, under FLEET_MIN_CREW .35), so the ship is out of action for 乗員不足 — a reason of its own, as the next case
 // checks for the bridge. On the PR base 1da778b it ended with 10.3 of 26 (40%), just over the limit. As with the sections above,
 // the other reason is held off so that the case still checks what it is for: power loss alone is not out of action.
 let crewLow=1;
 for(let t=0;t<20;t+=.25){const before=a.shield+(a.hp??0);C.fleetTick(B,.25,{gravity:true});if(b.order.target==='a')hitsAfter++;crewLow=Math.min(crewLow,a.crew/a.p.crewNeed);a.crew=a.p.crewNeed;}
 assert.ok(crewLow<1,'the fire still costs it crew each step: '+crewLow);
 assert.equal(a.out,'電源喪失');assert.equal(a.dead,false);assert.ok(C.fleetEffective(a),'still in the battle');
 assert.equal(C.shipElectricalAvailableW(a)||0,0,'no power');assert.ok(a.pos[1]<y0,'drawn down by gravity: '+(a.pos[1]-y0));assert.ok(a.shield<sh0,'the shield fades: '+sh0+' → '+a.shield);
 assert.ok(hitsAfter>0,'the enemy keeps it as its target');
});
// Physics review 2026-11-16 (FAIL): u.out keeps its first reason, so a ship that lost power and then its bridge stayed
// "in the fight". The other reasons are now judged afresh.
// 2026-11-19 user decision「艦橋で停止するのは統制射撃と判断能力で艦が行動不能になるのは自動化装置でほとんどを賄ってるタイプの艦のみ」:
// this case expected the CR90 (no automation) to be out of action once its bridge was gone as well. It now fights on without
// its bridge; the same loss still puts a ship run mostly by automation out of action.
test('a ship without power that then loses its bridge: out of action only if automation runs most of it',()=>{
 const u=C.fleetUnit('a','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),0),mods=u.p.modules;
 for(let i=0;i<mods.length;i++)if(mods[i].k==='reactor'||mods[i].k==='gen')u.mods[i]=0;C.syncPowerLossDisabled(u);
 assert.equal(u.out,'電源喪失');assert.equal(C.outOfAction(u),false);
 const br=mods.findIndex(m=>m.k==='bridge');assert.ok(br>=0,'the CR90 has a bridge module');u.mods[br]=0;
 assert.equal(u.out,'電源喪失','the recorded reason stays the first one');assert.equal(C.bridgeLost(u),true);assert.equal(C.outOfAction(u),false,'a crewed ship is not out of action for its bridge');
 u.p.autoCrew=(u.p.crewNeed||1)*3;assert.equal(C.bridgeRuns(u.p),true);assert.equal(C.outOfAction(u),true,'a ship run by automation is');assert.equal(C.fleetEffective(u),false);
});
// Physics review 2026-11-16 (FAIL on edd5df3): the automation check reads the reactors, so a ship crewed 95% by automation
// (recusantDn) was out of action again from power loss alone. Judged as if the plant ran, it stays in the fight.
test('a highly automated ship that only lost power stays in the fight',()=>{
 const u=C.fleetUnit('r','recusantDn',JSON.parse(JSON.stringify(F.designs.recusantDn.p)),0),mods=u.p.modules;
 assert.ok(u.p.autoCrew/(u.p.autoCrew+u.p.crewNeed)>.9,'mostly automated');
 for(let i=0;i<mods.length;i++)if(mods[i].k==='reactor'||mods[i].k==='gen')u.mods[i]=0;C.syncPowerLossDisabled(u);
 assert.equal(u.out,'電源喪失');assert.equal(C.outOfAction(u),false);assert.equal(C.fleetEffective(u),true);
});
