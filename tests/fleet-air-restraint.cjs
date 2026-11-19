// User decision 2026-11-19「航空投入を少し抑制的にする。迎撃、直掩用の機体は待機させるのではなく来たら発艦させる。なのでその分の管制枠を残す
// 動きになる」: a fleet keeps part of its air control free. The strike and its escort go up within the rest; the fighters kept
// aboard are launched when enemy craft come within FLEET_AIR.intercept of an own ship.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
const profiles={};for(const k of ['craft_tie_ln','craft_tie_sa','craft_xwing','craft_btlb']){const xs=C.buildDesign(k),S=C.computeStats(xs);profiles[k]={p:C.fleetProfile(S,xs.name,xs),liftSpare:Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass)};}
function setup(){
 const isd=C.fleetUnit('isd','imperial',plain(F.designs.imperial.p),1),foe=C.fleetUnit('foe','mc75',plain(F.designs.mc75.p),0);isd.pos=[40000,0,0];isd.yaw=Math.PI;foe.pos=[-40000,0,0];
 for(const u of [isd,foe])u.order={...u.order,type:'hold',fire:false};
 const B=C.fleetBattle([foe,isd],true);B.seed=5;C.fleetAirSetup(B,[{home:'isd',type:'tie_sa',count:24},{home:'isd',type:'tie_ln',count:48},{home:'foe',type:'ywing',count:12},{home:'foe',type:'xwing',count:12}],profiles,{});return {B,isd,foe};
}
const run=(B,s)=>{for(let x=0;x<s;x+=.25)C.fleetTick(B,.25,{});};
const out=(B,team,f=()=>true)=>B.air.squadrons.filter(q=>q.team===team&&q.out&&f(q)).length;
test('the fleet keeps control free: the strike and its escort go up, the other fighters stay aboard',()=>{
 const {B,isd}=setup(),control=C.fleetAirControl(isd);assert.ok(control>=4,'the ISD directs several squadrons: '+control);
 C.fleetTick(B,.25,{});
 const up=out(B,1),bombers=out(B,1,q=>q.bomber),fighters=out(B,1,q=>!q.bomber),aboard=B.air.squadrons.filter(q=>q.team===1&&!q.out&&!q.bomber).length;
 assert.equal(bombers,2,'both bomber squadrons go');assert.equal(fighters,Math.ceil(bombers*C.FLEET_AIR.escortShare),'with their escort');
 assert.ok(aboard>=1,'fighters are kept aboard');assert.ok(up<=control-Math.max(1,Math.min(aboard+fighters,Math.round(control*C.FLEET_AIR.reserveShare)))+fighters,'within the control not kept back: '+up+' of '+control);
 assert.ok(B.air.squadrons.filter(q=>q.team===1&&!q.bomber&&!q.out).every(q=>q.members.length===0),'craft kept aboard are not in the battle');
});
test('fighters kept aboard are launched when enemy craft come within the intercept range',()=>{
 const {B,isd}=setup();run(B,45);/* the MC75 passes a craft every 2.6 s through its one hangar mouth */const before=out(B,1,q=>!q.bomber);
 const xw=B.units.filter(u=>u.sortie&&u.team===0);assert.ok(xw.length>0,'the enemy strike is up');assert.ok(xw.some(u=>u.sortie.bomber),'bombers lead it');
 assert.equal(out(B,1,q=>!q.bomber),before,'none while the enemy craft are far ('+Math.round(Math.min(...xw.map(u=>C.len(C.sub(u.pos,isd.pos)))))+' m)');
 xw.forEach((u,i)=>{u.pos=[isd.pos[0]-C.FLEET_AIR.intercept*.6,500,(i-6)*150];u.velocity=[300,0,0];});
 for(let t=0;t<C.FLEET_AIR.every+.5;t+=.25)C.fleetTick(B,.25,{});
 const after=out(B,1,q=>!q.bomber),need=Math.ceil(xw.filter(u=>!u.dead).length*C.FLEET_AIR.interceptPer/C.FLEET_AIR.squad);
 assert.ok(after>before,'fighters go up as they come: '+before+' -> '+after);assert.ok(after>=Math.min(need,before+B.air.squadrons.filter(q=>q.team===1&&!q.bomber).length-before),'interceptPer fighters for each craft that comes');
 assert.ok(B.air.squadrons.some(q=>q.team===1&&q.scramble!=null),'launched as a scramble');
});
// User decision 2026-11-19「使う時に出す、使わない時は着艦させるを徹底させる」: a craft with no use in the air goes back to its ship and comes
// aboard, which frees its squadron's place in the air control.
test('craft with no use in the air land: bombers without stores, fighters with no strike to escort and no enemy craft near',()=>{
 const {B,isd}=setup();run(B,40);/* 36 craft through the ISD's hatches at 1.25 a second */
 const mine=()=>B.units.filter(u=>u.sortie&&u.team===1),sq=B.air.squadrons.filter(q=>q.team===1&&q.out),n0=mine().length,alive=new Map(sq.map(q=>[q,q.members.filter(id=>mine().some(u=>u.id===id)).length]));assert.ok(n0>=24,'the strike and its escort are up: '+n0);
 for(const u of B.units.filter(u=>u.sortie&&u.team===0))u.dead=true;/* no enemy craft near */
 for(const u of mine()){if(u.sortie.bomber)u.sortie.stores=[];u.pos=[isd.pos[0]+200,300,(Math.random()-.5)*200];u.velocity=[0,0,0];}
 for(let t=0;t<1;t+=.25)C.fleetTick(B,.25,{});
 assert.equal(mine().length,0,'all of them are aboard');assert.equal((B.air.log.landed||[])[1],n0);
 for(const q of sq){assert.equal(q.out,false);assert.equal(q.members.length,0);assert.equal(q.size,alive.get(q),'the squadron keeps its survivors');assert.ok(q.readyAt>B.time,'it is being re-armed');}
 assert.equal(B.air.squadrons.filter(q=>q.team===1&&q.out).length,0,'no place in the air control is held');
});
test('craft in use stay up: bombers with stores and a ship to strike',()=>{
 const {B,isd}=setup();run(B,25);const bombers=B.units.filter(u=>u.sortie?.bomber&&u.team===1);assert.ok(bombers.length&&bombers.every(u=>u.sortie.stores.length>0));
 for(const u of bombers){u.pos=[isd.pos[0]+200,300,0];}
 for(let t=0;t<1;t+=.25)C.fleetTick(B,.25,{});
 assert.equal(B.units.filter(u=>u.sortie?.bomber&&u.team===1).length,bombers.length,'they do not land with their rounds aboard');assert.ok(bombers.every(u=>!u.sortie.rtb));
});
// User decision 2026-11-19「航空機の発艦はちゃんとハッチから出して。ハッチのサイズで発艦速度が決まる」: craft leave by the hangar mouths, each
// mouth at the rate its opening gives (the profile's mouths[].r craft a second).
test('craft come out of the hangar mouths at the rate the mouths give, and appear just outside a mouth',()=>{
 const {B,isd,foe}=setup(),rate=isd.p.mouths.reduce((n,m)=>n+m.r,0);assert.ok(Math.abs(rate-isd.p.launch)<1e-2,'the mouths add up to the ship\'s launch rate');
 C.fleetTick(B,.25,{});assert.equal(B.units.filter(u=>u.sortie&&u.team===1).length,0,'nobody is out after a quarter of a second');
 run(B,10);const n=B.units.filter(u=>u.sortie&&u.team===1).length,T=B.time-.25/* the order is given on the first step */;
 assert.ok(n>=Math.floor(rate*T)-isd.p.mouths.length&&n<=Math.ceil(rate*T)+1,`about ${rate.toFixed(2)} a second: ${n} craft in ${T} s`);
 const slow=B.units.filter(u=>u.sortie&&u.team===0).length,r0=foe.p.mouths.reduce((x,m)=>x+m.r,0);assert.ok(slow<=Math.ceil(r0*T)+1&&slow<n,`the MC75's one mouth passes fewer (${slow} at ${r0.toFixed(2)} a second)`);
 const fresh=C.fleetUnit('isd2','imperial',plain(F.designs.imperial.p),1);fresh.pos=[0,0,0];fresh.yaw=0;const B2=C.fleetBattle([fresh,C.fleetUnit('t','cr90',plain(F.designs.cr90.p),0)],true);B2.units[1].pos=[90000,0,0];
 C.fleetAirSetup(B2,[{home:'isd2',type:'tie_sa',count:12}],profiles,{});run(B2,1.25);const c=B2.units.find(u=>u.sortie);assert.ok(c,'the first craft is out');
 const d=Math.min(...fresh.p.mouths.map(m=>C.len(C.sub(c.pos,C.dockLocalToWorld(fresh,m.p)))));assert.ok(d<60,'it appears at a mouth, not beside the ship: '+d.toFixed(1)+' m from the nearest mouth');
});
test('a ship with no mouth the craft fits does not launch them',()=>{
 const {B,isd}=setup();isd.p.mouths=isd.p.mouths.map(m=>({...m,o:[1,1]}));run(B,6);
 assert.equal(B.units.filter(u=>u.sortie&&u.team===1).length,0);assert.equal(out(B,1),0,'and its squadrons hold no air control');
});
test('a squadron that has landed is re-armed and can go up again, bombers too',()=>{
 const {B,isd}=setup();run(B,25);const q=B.air.squadrons.find(x=>x.team===1&&x.bomber);
 for(const u of B.units.filter(u=>u.sortie?.bomber&&u.team===1)){u.sortie.stores=[];u.pos=[isd.pos[0]+200,300,0];u.velocity=[0,0,0];}
 B.air.squadrons.filter(x=>x.team===1&&x.bomber).forEach(x=>{x.pending=0;});run(B,1);
 assert.equal(q.out,false);assert.ok(q.readyAt>B.time);const n=q.size;assert.ok(n>0);
 run(B,C.FLEET_AIR.rearm+C.FLEET_AIR.every+8);
 assert.equal(q.out,true,'it goes up again after '+C.FLEET_AIR.rearm+' s');const again=B.units.filter(u=>q.members.includes(u.id));assert.ok(again.length>0&&again.every(u=>u.sortie.stores.length>0),'with its rounds');
});
