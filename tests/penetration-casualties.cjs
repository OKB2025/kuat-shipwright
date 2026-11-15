// User decision 2026-11-15: a turbolaser that penetrates a compartment kills there by the power it still carries as it
// enters: at 1 TT or more everyone left in the compartment is lost, below that in proportion. The loss that goes with
// the wrecked part of the compartment (0.7 of its crew per share wrecked) stays, taken from those still alive.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const ctx={ev(){},rand:()=>.5,time:0};
function unit(){const mod={k:'quarters',name:'compartment',crew:1000,share:0,hits:1e9,w:1,at:.5,y:0,z:0};
 return {p:{crewNeed:1000,modules:[mod,{...mod,name:'other'}],hp:1e6},mods:[1,1],crew:2000,secOf:[0,0],sec:[{s:1e9,max:1e9}],fire:[0],secLost:[]};}
test('the constant: one teraton entering a compartment kills everyone left in it',()=>{assert.equal(C.COMBAT.penCrewTT,1);});
test('entering power kills in proportion up to 1 TT; a second hit takes from those left; other compartments are untouched',()=>{
 const u=unit();C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',.25);near(u.crew,2000-250,1e-6);near(u.crewIn[0],.75,1e-6);assert.equal(u.crewIn[1],1);
 C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',.25);near(u.crew,2000-250-187.5,1e-6);
 C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',5);near(u.crew,1000,1e-6);near(u.crewIn[0],0,1e-9);
 C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',5);near(u.crew,1000,1e-6);
});
test('fire and other damage without an entering shot kill only with the wrecked part, as before',()=>{
 const u=unit();u.p.modules[0].hits=1;C.combatModuleDamage(ctx,u,0,.5,1,'fire');near(u.crew,2000-1000*.5*.7,1e-9);near(u.crewIn[0],1-.35,1e-9);
});
