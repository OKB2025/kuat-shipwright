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
