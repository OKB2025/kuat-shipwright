// 2026-11-14 user decision: hangars and cargo holds count empty in the design; what a ship actually carries into a
// battle is added to its mass there: embarked squadrons, docked ships, its stores and a supply ship's cargo.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C,R,data}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,rel=1e-9)=>assert.ok(Math.abs(a-b)<=Math.max(1e-9,Math.abs(b)*rel),`${a} != ${b}`);
const world=air=>{const design=plain(data.designs.mc80home);return R.createWorld({mode:'test',region:'kuat',seed:17,designs:[design],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:design.key,air}],[]]});};
const first=w=>[...w.units.values()][0];

test('a loaded profile moves the same engines with the larger mass',()=>{
 const p=C.emptyDesignProfile(plain(data.designs.mc80home.p)),m=C.motionMassKg(p),q=C.loadedShipProfile(p,m/1000*.25);
 near(q.propulsion.massKg,m*1.25);assert.equal(q.loadTonnes,m/1000*.25);assert.ok(q.propulsion.ratedAccelMps2<p.propulsion.ratedAccelMps2*.85&&q.propulsion.ratedAccelMps2>p.propulsion.ratedAccelMps2*.7,'acceleration falls about with the mass');
 assert.equal(C.loadedShipProfile(p,0),p,'no load: the same profile');assert.equal(p.propulsion.massKg,m,'the design profile itself is not changed');
});
test('a ship deployed without craft carries only its stores',()=>{
 const u=first(world([])),info=data.designs.mc80home.info;near(u.loadTonnes,Math.round((info.crew||0)*.4+(info.mass||0)*.0005));near(C.motionMassKg(u.p),C.motionMassKg(C.emptyDesignProfile(plain(data.designs.mc80home.p)))+u.loadTonnes*1000);
});
test('embarked squadrons add their craft mass to the carrier; it accelerates less',()=>{
 const empty=first(world([])),loaded=first(world([{craft:'xwing',n:12,wingNo:1},{craft:'xwing',n:12,wingNo:2}])),craft=R.CRAFT.xwing.mass;assert.ok(craft>0);
 const stores=(info=>Math.round(((info.crew||0)+24)*.4+(info.mass||0)*.0005))(data.designs.mc80home.info);near(loaded.loadTonnes,24*craft+stores);
 assert.ok(C.motionMassKg(loaded.p)>C.motionMassKg(empty.p));assert.ok(loaded.p.propulsion.ratedAccelMps2<empty.p.propulsion.ratedAccelMps2);
});
