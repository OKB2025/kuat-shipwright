// User decision 2026-11-19「系統に届く分は熱に変わる分減らして」: while an ion round's cut lasts, a third of the power the plant
// has just delivered to the guns, the shield and the engines turns to heat, and those systems get exactly that much less. The
// plant's draw stays, and the shield's store is not cut (before, the share was put on the systems' working shares: the guns got
// their full power and a third of the shield's store was wiped).
// User decision 2026-11-19「古い表も揃えて」: the old ordnance table carries the air rounds' yield; the size and mass by
// which a station's count and a loaded craft's mass are worked out are unchanged (a 4 m round fits none of the examples' tubes).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
function duel(cut){
 const a=C.fleetUnit('a','mc80liberty',JSON.parse(JSON.stringify(F.designs.mc80liberty.p)),0),b=C.fleetUnit('b','mc75',JSON.parse(JSON.stringify(F.designs.mc75.p)),1);b.pos=[4000,0,0];b.yaw=Math.PI;
 a.order={...a.order,type:'attack',target:'b',fire:true};b.order={...b.order,type:'attack',target:'a',fire:true};
 const B=C.fleetBattle([a,b],true);B.seed=3;for(let t=0;t<20;t+=.25)C.fleetTick(B,.25,{});assert.ok(!a.dead&&!a.out,'the ship is in the fight');
 const shield0=a.shield;if(cut)a.ionCut=cut;C.fleetTick(B,.25,{});return {a,shield0,pw:{...a.pw}};
}
test('an ion cut takes a third of what the guns and the shield were delivered, and exactly that is the heat',()=>{
 const free=duel(0),hit=duel(.25),sum=x=>(x.wpn||0)+(x.sh||0)+(x.eng||0);
 assert.ok(sum(free.pw)>0,'the ship is drawing power for its guns and shield');
 assert.ok(Math.abs(hit.pw.wpn/free.pw.wpn-2/3)<1e-9,'guns: '+hit.pw.wpn/free.pw.wpn);assert.ok(Math.abs(hit.pw.sh/free.pw.sh-2/3)<1e-9,'shield: '+hit.pw.sh/free.pw.sh);
 assert.ok(Math.abs(hit.pw.draw/free.pw.draw-1)<1e-9,'the plant still made the power');
 const lostJ=(sum(free.pw)-sum(hit.pw))*.25;assert.ok(Math.abs(hit.a.ionPowerLossJ/lostJ-1)<1e-9,'the heat is what the systems did not get: '+hit.a.ionPowerLossJ+' / '+lostJ);
 assert.ok(hit.a.shield>hit.shield0*.95,'the shield keeps its store: '+hit.shield0+' → '+hit.a.shield);
 assert.equal(hit.a.ionCut,0,'the cut is used up in the step');
 // Physics review 2026-11-19: the plant made the whole of it, so the electricity made (which the fuel is taken by) is the same.
 const made=x=>x.a.ht?.actualGeneratedElectricalJ??x.a.heat?.actualGeneratedElectricalJ;if(made(free)>0)assert.ok(made(hit)/made(free)>1-1e-6&&made(hit)/made(free)<1.01,'electricity made is not less for the cut (the cooling plant draws a little more for the heat): '+made(hit)/made(free));
});
test('a cut shorter than the step takes its share of the step; no cut takes nothing',()=>{
 const free=duel(0),hit=duel(.1);assert.ok(Math.abs(hit.pw.wpn/free.pw.wpn-(1-.4/3))<1e-9,'0.1 s of a 0.25 s step: '+hit.pw.wpn/free.pw.wpn);
 assert.equal(free.a.ionPowerLossJ||0,0);assert.equal(free.a.ionKeep,1);
});
test('the old ordnance table carries the air rounds; stations hold as many as before',()=>{
 for(const [k,o] of Object.entries(C.ORDNANCE)){const r=C.airRound(k);assert.equal(o.tt,r.tt,k);assert.equal(o.body.mass,r.mass,k);assert.deepEqual([...o.body.dims],[...r.dims],k);assert.ok(o.dims[0]<=1.3&&o.mass<.2,k+': the size and mass its stations were measured for stay');}
 assert.ok(Math.abs(C.ORDNANCE.ptorp.tt-.0895)<1e-4);assert.ok(Math.abs(C.ORDNANCE.cmsl.tt-.0471)<1e-4);assert.ok(Math.abs(C.ORDNANCE.bomb.tt-.1885)<1e-4);
 assert.equal(C.ORDNANCE.itorp.ion,true);
 const n=k=>C.craftOrdnance(k).map(o=>o.kind+'x'+o.n).join(',');
 assert.equal(n('xwing'),'ptorpx6');assert.equal(n('ywing'),'ptorpx8');assert.equal(n('tie_sa'),'bombx8,ptorpx3');assert.equal(n('awing'),'cmslx12');
});
// Regression review 2026-11-19 (FAIL): the ship being flown gets its power in js/app.js (trialPowerStep), not in fleetPowerStep, so
// the cut and its heat never reached it and u.ionCut only grew. The app now calls C.ionPowerCut on what it was delivered.
test('the cut works on any delivery it is given (the flown ship calls it from the app) and uses the time up',()=>{
 const u=C.fleetUnit('me','mc80liberty',JSON.parse(JSON.stringify(F.designs.mc80liberty.p)),0);u.manual=true;u.ionCut=.3;u.pw={};
 const got={weapons:900,shields:300,engines:300,draw:1600},keep=C.ionPowerCut(u,got,.25);
 assert.ok(Math.abs(keep-2/3)<1e-12);assert.ok(Math.abs(got.weapons-600)<1e-9&&Math.abs(got.shields-200)<1e-9&&Math.abs(got.engines-200)<1e-9);assert.equal(got.draw,1600);
 assert.ok(Math.abs(u.ionPowerLossJ-500*.25)<1e-9);assert.ok(Math.abs(u.ionCut-.05)<1e-12,'0.05 s left for the next step');
 const next={weapons:900,shields:0,engines:0},k2=C.ionPowerCut(u,next,.25);assert.ok(Math.abs(k2-(1-.2/3))<1e-12);assert.equal(u.ionCut,0);
 assert.equal(C.ionPowerCut(u,{weapons:900},.25),1,'and nothing after');
 const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');assert.match(app,/C\.allocateShipPower\(me,s,demand,dt,mode\),got=solved\.got,P=solved\.P\|\|0;C\.ionPowerCut\(me,got,dt\)/,'the flown ship takes the cut right after its allocation');
});
