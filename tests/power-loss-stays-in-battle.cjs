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
 const B=C.fleetBattle([a,b],true);B.seed=3;
 for(let t=0;t<2;t+=.25)C.fleetTick(B,.25,{gravity:true});
 const mods=a.p.modules;for(let i=0;i<mods.length;i++)if(mods[i].k==='reactor'||mods[i].k==='gen')a.mods[i]=0;
 const y0=a.pos[1],sh0=a.shield;let hitsAfter=0;
 for(let t=0;t<20;t+=.25){const before=a.shield+(a.hp??0);C.fleetTick(B,.25,{gravity:true});if(b.order.target==='a')hitsAfter++;}
 assert.equal(a.out,'電源喪失');assert.equal(a.dead,false);assert.ok(C.fleetEffective(a),'still in the battle');
 assert.equal(C.shipElectricalAvailableW(a)||0,0,'no power');assert.ok(a.pos[1]<y0,'drawn down by gravity: '+(a.pos[1]-y0));assert.ok(a.shield<sh0,'the shield fades: '+sh0+' → '+a.shield);
 assert.ok(hitsAfter>0,'the enemy keeps it as its target');
});
// Physics review 2026-11-16 (FAIL): u.out keeps its first reason, so a ship that lost power and then its bridge stayed
// "in the fight". The other reasons are now judged afresh.
test('a ship without power that then loses its bridge is out of action',()=>{
 const u=C.fleetUnit('a','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),0),mods=u.p.modules;
 for(let i=0;i<mods.length;i++)if(mods[i].k==='reactor'||mods[i].k==='gen')u.mods[i]=0;C.syncPowerLossDisabled(u);
 assert.equal(u.out,'電源喪失');assert.equal(C.outOfAction(u),false);
 const br=mods.findIndex(m=>m.k==='bridge');assert.ok(br>=0,'the CR90 has a bridge module');u.mods[br]=0;
 assert.equal(u.out,'電源喪失','the recorded reason stays the first one');assert.equal(C.outOfAction(u),true);assert.equal(C.fleetEffective(u),false);
});
// Physics review 2026-11-16 (FAIL on edd5df3): the automation check reads the reactors, so a ship crewed 95% by automation
// (recusantDn) was out of action again from power loss alone. Judged as if the plant ran, it stays in the fight.
test('a highly automated ship that only lost power stays in the fight',()=>{
 const u=C.fleetUnit('r','recusantDn',JSON.parse(JSON.stringify(F.designs.recusantDn.p)),0),mods=u.p.modules;
 assert.ok(u.p.autoCrew/(u.p.autoCrew+u.p.crewNeed)>.9,'mostly automated');
 for(let i=0;i<mods.length;i++)if(mods[i].k==='reactor'||mods[i].k==='gen')u.mods[i]=0;C.syncPowerLossDisabled(u);
 assert.equal(u.out,'電源喪失');assert.equal(C.outOfAction(u),false);assert.equal(C.fleetEffective(u),true);
});
