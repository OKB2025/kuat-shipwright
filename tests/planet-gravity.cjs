// v30 The planet's gravity, repulsorlift and potential energy (user decision 2026-11-19「惑星自体に重力を発生させるようにして。艦は全て
// リパルサーリフトで釣り合ってる状態に。そして位置エネルギーを実装。電力を失う、撃破されるとリパルサーリフトの効果が無くなっていくので惑星に
// 墜落する」). Fleet battle (Core.fleetTick with opts.planet).
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
const P={center:[0,-(6.12e6+160000),0],radius:6.12e6},opts={gravity:true,planet:P},alt=u=>C.len(C.sub(u.pos,P.center))-P.radius;
function pair(key='imperial'){const a=C.fleetUnit('a',key,plain(F.designs[key].p),0),b=C.fleetUnit('b','cr90',plain(F.designs.cr90.p),1);b.pos=[60000,0,0];for(const u of [a,b])u.order={...u.order,type:'hold',fire:false};return {a,b,B:C.fleetBattle([a,b],true)};}
const run=(B,seconds,stop)=>{let t=0;for(;t<seconds-1e-9;t+=.25){C.fleetTick(B,.25,opts);if(stop&&stop())break;}return t;};

test('gravity points at the planet\'s centre and falls with the square of the distance; potential energy is -g0 R² m / r',()=>{
 const g0=C.len(C.planetGravity(P,[0,-160000,0])),g=C.planetGravity(P,[0,0,0]);assert.ok(Math.abs(g0-C.GRAVITY.g0)<1e-9,'at the surface: '+g0);assert.ok(g[1]<0&&Math.abs(g[0])<1e-12&&Math.abs(g[2])<1e-12);
 assert.ok(Math.abs(C.len(g)-C.GRAVITY.g0*(P.radius/(P.radius+160000))**2)<1e-9);const r=P.radius+160000;assert.ok(Math.abs(C.potentialEnergyJ(P,1000,[0,0,0])+C.GRAVITY.g0*P.radius**2*1000/r)<1e-3);
 assert.ok(C.potentialEnergyJ(P,1000,[0,10000,0])>C.potentialEnergyJ(P,1000,[0,0,0]),'higher is more');
});
test('a ship with power is held by its repulsorlift: it keeps its height',()=>{
 const {a,B}=pair();const h0=alt(a);run(B,30);assert.equal(a.lift,1);assert.ok(Math.abs(alt(a)-h0)<1e-6,'height '+alt(a));assert.equal(a.fall??null,null);
});
test('a ship that loses power loses its lift over GRAVITY.liftFade seconds, falls freely and strikes the planet; what it lost in potential energy is its speed',()=>{
 const {a,B}=pair();run(B,5);a.p.modules.forEach((m,i)=>{if(m.k==='reactor')a.mods[i]=0;});
 run(B,C.GRAVITY.liftFade/2);assert.equal(a.out,'電源喪失');assert.ok(a.lift>.3&&a.lift<.7,'half way: '+a.lift);assert.ok(alt(a)<160000);
 run(B,C.GRAVITY.liftFade);assert.equal(a.lift,0);const t=run(B,600,()=>!!a.crash);assert.ok(a.crash,'it struck the planet');assert.ok(t>120&&t<260,'after about three minutes: '+t);
 assert.equal(a.dead,true);assert.equal(a.fate,'fall');assert.ok(Math.abs(alt(a))<1,'on the surface');assert.ok(a.crash.speed>1500&&a.crash.speed<1900,'speed '+a.crash.speed);
 // free fall: kinetic energy at the surface = potential energy released, less the little the fading lift still held
 const k=a.crash.energyJ/(a.crash.releasedJ+a.crash.startJ);assert.ok(k>.99&&k<=1+1e-9,'energy kept: '+k);assert.ok(Math.abs(a.crash.energyJ-.5*a.crash.massKg*a.crash.speed**2)<1e-6*a.crash.energyJ);
 assert.ok(B.events.some(e=>e.id==='a'&&/惑星に墜落/.test(e.text)));
});
test('the wreck of a destroyed ship falls too, keeping the way it had',()=>{
 const {a,B}=pair('nebulonb');a.dead=true;a.velocity=[100,0,0];const x0=a.pos[0];run(B,600,()=>!!a.crash);assert.ok(a.crash);assert.ok(a.pos[0]-x0>10000,'it carried on sideways while it fell');
 const k=a.crash.energyJ/(a.crash.releasedJ+a.crash.startJ);assert.ok(k>.99&&k<=1+1e-9,'energy kept: '+k);assert.ok(B.events.some(e=>e.id==='a'&&/惑星に墜落/.test(e.text)));
});
test('lift comes back with the power, and a ship out of action for another reason keeps its lift',()=>{
 {const {a,B}=pair();a.lift=.3;run(B,25);assert.equal(a.lift,1);}
 {const {a,B}=pair();a.out='テスト';const h0=alt(a);run(B,60);assert.equal(a.lift,1);assert.ok(Math.abs(alt(a)-h0)<1e-6,'it does not fall: '+alt(a));}
});
test('without a planet the earlier rule stands (a disabled ship sinks at HULL_FALL.g)',()=>{
 const {a,B}=pair();a.out='テスト';for(let t=0;t<20;t+=.25)C.fleetTick(B,.25,{gravity:true});assert.ok(a.pos[1]<0&&a.pos[1]>-200,'sinking slowly: '+a.pos[1]);
});
