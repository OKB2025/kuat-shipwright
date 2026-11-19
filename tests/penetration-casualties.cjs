// User decision 2026-11-15: a turbolaser that penetrates a compartment kills there by the power it still carries as it
// enters: at 1 TT or more everyone left in the compartment is lost, below that in proportion. The loss that goes with
// the wrecked part of the compartment (0.7 of its crew per share wrecked) stays, taken from those still alive.
// User decision 2026-11-15「1発ごとに各区画で判断」: the rule is applied to each shot in each compartment it enters, not to
// a tick's fire added together. combatModuleDamage takes the number of shots the entering power is spread over; fleet fire
// carries the shooter's TT per shot (fleetShotTT, from each weapon module's bolt) through the incoming record. The cases
// above that pass no shot count are single shots and keep their values.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const near=(a,b,eps=1e-9)=>assert.ok(Math.abs(a-b)<=eps*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const ctx={ev(){},rand:()=>.5,time:0};
// 2026-11-19 expectation changed: what wrecks a module is worked out from its volume and density (modBreakTT,
// docs/damage-penetration.md:60), not from a stored m.hits. The fixture's hits:1e9 (a compartment the small hits cannot
// wreck) is now vol:1e30; case 3's hits=1 (one TT wrecks it) is a volume scaled so modBreakTT is 1.
function unit(){const mod={k:'quarters',name:'compartment',crew:1000,share:0,vol:1e30,w:1,at:.5,y:0,z:0};
 return {p:{crewNeed:1000,modules:[mod,{...mod,name:'other'}],hp:1e6},mods:[1,1],crew:2000,secOf:[0,0],sec:[{s:1e9,max:1e9}],fire:[0],secLost:[]};}
test('the constant: one teraton entering a compartment kills everyone left in it',()=>{assert.equal(C.COMBAT.penCrewTT,1);});
test('entering power kills in proportion up to 1 TT; a second hit takes from those left; other compartments are untouched',()=>{
 const u=unit();C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',.25);near(u.crew,2000-250,1e-6);near(u.crewIn[0],.75,1e-6);assert.equal(u.crewIn[1],1);
 C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',.25);near(u.crew,2000-250-187.5,1e-6);
 C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',5);near(u.crew,1000,1e-6);near(u.crewIn[0],0,1e-9);
 C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',5);near(u.crew,1000,1e-6);
});
test('fire and other damage without an entering shot kill only with the wrecked part, as before',()=>{
 const u=unit();u.p.modules[0].vol/=C.modBreakTT(u.p,u.p.modules[0]);C.combatModuleDamage(ctx,u,0,.5,1,'fire');near(u.crew,2000-1000*.5*.7,1e-9);near(u.crewIn[0],1-.35,1e-9);
});

test('per shot: each shot kills min(1, its TT) of those left; a fraction of a shot is the chance one arrives',()=>{
 near(C.penCrewSurvive(.5,1),.5);near(C.penCrewSurvive(.5,2),.75*.75);near(C.penCrewSurvive(2,2),0);
 near(C.penCrewSurvive(2,200),Math.pow(.99,200));near(C.penCrewSurvive(.25,.25),.75);near(C.penCrewSurvive(0,3),1);
 const u=unit();C.combatModuleDamage(ctx,u,0,1e-6,1,'shot',.5,2);near(u.crewIn[0],.5625,1e-9);near(u.crew,2000-437.5,1e-6);
});
test('fleet fire carries TT per shot: anti-ship energy weights it, point defence and old profiles fall back',()=>{
 const p={modules:[{k:"weapon",size:350.05,shotW:350,bolt:175},{k:"weapon",size:120.2,shotW:120,bolt:40},{k:"weapon",size:3,shotW:1e-6,bolt:1e-7}]};
 near(C.fleetShotTT({p}),(350+120+1e-6)/(2+3+10),1e-9);
 near(C.fleetShotTT({p:{modules:[{k:'weapon',size:350},{k:'weapon',size:120}]}}),470/2,1e-12);
 assert.equal(C.fleetShotTT({p:{modules:[{k:'bridge',size:1}]}}),0);
 assert.equal(C.fleetBoltTT({tt:120,barrels:3}),40);assert.equal(C.fleetBoltTT({tt:350,boltTT:175}),175);assert.equal(C.fleetBoltTT({tt:350,ion:350,barrels:2}),175);assert.equal(C.fleetBoltTT({tt:0,ion:350,barrels:2}),0);
 const inc=C.combatIncoming(),t={pos:[0,0,0],p:{}};C.combatAdd(inc,t,null,{hull:10,shot:5});C.combatAdd(inc,t,null,{hull:1,shot:.01});C.combatAdd(inc,t,null,{direct:4});
 near(C.combatShotTT(inc),11/(2+100),1e-12);assert.equal(C.combatShotTT(C.combatIncoming()),0);
});
test('a penetration judges each compartment by what one shot still carries into it',()=>{
 const mk=()=>{const u=unit();u.p.modules=[{k:'quarters',name:'a',crew:1000,share:0,vol:1e30,w:1,at:.5,y:0,z:0}];u.mods=[1];u.crew=1000;return u;};
 const one=mk(),many=mk(),r=()=>0;const c={ev(){},rand:r,time:0};
 C.combatPenetrate(c,one,0,0,2,null,1,0);const pm=C.combatPenetrate(c,many,0,0,2,null,1,.02);
 near(one.crewIn[0],0,1e-9);
 // 2026-11-19 expectation changed: the rebuilt combatPenetrate bores through the plating, the structure and the modules in
 // turn (docs/damage-penetration.md:61); the old fixed share the frames took (COMBAT.frame) is gone. What enters the
 // compartment is read from the penetration's own path (here all 2 TT: the fixture has no structure in front of it).
 const enter=pm.path[0].enter;near(many.crewIn[0],C.penCrewSurvive(enter,100),1e-9);assert.ok(many.crewIn[0]>.1&&many.crewIn[0]<.4,String(many.crewIn[0]));
});
// Physics review 2026-11-15 (5fe1d03): the paths that bring direct hits and merged fire carry their own shot size.
test('guns and direct hits in one record are counted at their own sizes; merged records keep their shot counts',()=>{
 const t={pos:[0,0,0],p:{}},inc=C.combatIncoming();
 C.combatAdd(inc,t,null,{hull:100,direct:10,shot:50,directShot:5});
 near(C.combatShotTT(inc),110/(100/50+10/5),1e-12);
 const o=C.combatIncoming(),x1=C.combatIncoming();C.combatAdd(x1,t,null,{hull:4,shot:2});
 C.combatMerge(o,t,x1);C.combatMerge(o,t,{direct:3,shot:.5});C.combatMerge(o,t,{direct:7});
 near(o.shotE,4+3,1e-12);near(o.shotN,2+6,1e-12);near(C.combatShotTT(o),7/8,1e-12);
});
