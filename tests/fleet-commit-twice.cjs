// Extra review 2026-11-19 (FAIL): fleetCommit copies the plan and runs one turn on the copy, but the track history the guns aim
// by (u._track) was shared with the plan, so committing the same plan a second time saw the first run's track. Two commits of
// one untouched plan must give the same turn, and the plan itself must not change.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
function plan(){
 const a=C.fleetUnit('a','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),0),b=C.fleetUnit('b','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),1);b.pos=[2500,0,0];b.yaw=Math.PI;
 // 2026-11-25 the set-up changed, the subject did not: with the CR-90's guns turbolasers again (200 GT a shot, a volley of 0.4 TT
 // against a field of 0.30 TT) two corvettes ordered to attack from 5 km ran in bow to bow and sank each other with their guns at
 // 76 m in 11.5 s (no hull contact: the pass kept 36-38 m between them), so the action was over before the second commit. They
 // now hold 2.5 km apart and fire: inside the guns' 2.9 km, both alive through the turns, the track history still in use.
 a.order={...a.order,type:'hold',target:'b',fire:true};b.order={...b.order,type:'hold',target:'a',fire:true};
 const B=C.fleetBattle([a,b]);B.seed=7;return B;
}
const state=us=>JSON.stringify(us.map(u=>[u.id,u.pos,u.velocity,u.shield,u.energy,u.sec,u.mods,u.dead,u.out]));
test('committing one plan twice gives the same turn and leaves the plan as it was',()=>{
 const B=plan();C.fleetCommit(B);C.fleetFinish(B);/* one played turn, so the units carry a track history */
 const before=state(B.units),track=JSON.stringify(B.units.map(u=>u._track||null));
 const one=C.fleetCommit(B),first=state(one.units),frames1=JSON.stringify(one.frames.at(-1));B.phase='plan';/* the same plan again, as when a turn is replayed */
 assert.equal(state(B.units),before,'the plan is untouched by a commit');assert.equal(JSON.stringify(B.units.map(u=>u._track||null)),track,'and so is its track history');
 const two=C.fleetCommit(B),second=state(two.units),frames2=JSON.stringify(two.frames.at(-1));
 assert.equal(second,first,'the second commit plays the same turn');assert.equal(frames2,frames1,'with the same last frame');
});

// Regression review 2026-11-25: with the corvettes holding (above), the attack movement left this check. Two further plans keep it
// in: an attack run that nobody is sunk in, and a pair of which one judges it should ram (its state u.ram, like the pass, must be
// the copy's own: it was shared with the plan, so a commit changed the plan and the second commit began in the middle of the first).
function attackPlan(keys,gap){
 const us=keys.map((k,i)=>{const u=C.fleetUnit('ab'[i],k,JSON.parse(JSON.stringify(F.designs[k].p)),i);u.pos=[i*gap,0,0];u.yaw=i?Math.PI:0;return u;});
 us[0].order={...us[0].order,type:'attack',target:'b',fire:true};us[1].order={...us[1].order,type:'attack',target:'a',fire:true};const B=C.fleetBattle(us);B.seed=7;return B;
}
const full=us=>JSON.stringify(us.map(u=>[u.id,u.pos,u.velocity,u.yaw,u.shield,u.energy,u.sec,u.mods,u.dead,u.out,u.pass||null,u.ram||null]));
for(const [name,keys,gap,ram] of [['an attack run from far apart',['cr90','cr90'],30000,false],['a ship that rams',['hammerhead','gr75'],6000,true]])test('committing twice, '+name+': the same turn, the plan untouched',()=>{
 const B=attackPlan(keys,gap);C.fleetCommit(B);C.fleetFinish(B);if(ram)assert.equal(C.fleetRamJudge(B.units[0],B.units[1]),true,'the fixture rams');
 const before=full(B.units),one=C.fleetCommit(B),first=full(one.units);B.phase='plan';assert.equal(full(B.units),before,'the plan is untouched by a commit');
 if(ram)assert.ok(one.units[0].ram,'the ship was ramming in the turn');assert.ok(one.units.every(u=>!u.dead&&!u.out),'nobody is sunk in the turn');
 const two=C.fleetCommit(B);assert.equal(full(two.units),first,'the second commit plays the same turn');assert.equal(full(B.units),before);
});
// The copy a commit works on owns its ramming state (fleetRamStep changes the phase and the run-out direction in place).
test('a unit\'s copy owns its ramming state, as it owns its pass',()=>{
 const B=attackPlan(['hammerhead','gr75'],6000),u=B.units[0];u.ram={target:'b',phase:'out',dir:[1,0,0]};u.pass={target:'b',phase:'in',side:1};
 const c=C.combatClone(u);assert.notEqual(c.ram,u.ram);assert.notEqual(c.ram.dir,u.ram.dir);assert.equal(JSON.stringify(c.ram),JSON.stringify(u.ram));assert.notEqual(c.pass,u.pass);
 c.ram.phase='in';c.ram.dir[0]=-1;assert.equal(u.ram.phase,'out');assert.equal(u.ram.dir[0],1);
});
