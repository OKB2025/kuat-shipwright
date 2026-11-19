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
 const {B,isd}=setup();C.fleetTick(B,.25,{});const before=out(B,1,q=>!q.bomber);
 const xw=B.units.filter(u=>u.sortie&&u.team===0);assert.ok(xw.length>0,'the enemy strike is up');assert.ok(xw.some(u=>u.sortie.bomber),'bombers lead it');
 for(let t=0;t<C.FLEET_AIR.every+.5;t+=.25)C.fleetTick(B,.25,{});
 assert.equal(out(B,1,q=>!q.bomber),before,'none while the enemy craft are far ('+Math.round(Math.min(...xw.map(u=>C.len(C.sub(u.pos,isd.pos)))))+' m)');
 xw.forEach((u,i)=>{u.pos=[isd.pos[0]-C.FLEET_AIR.intercept*.6,500,(i-6)*150];u.velocity=[300,0,0];});
 for(let t=0;t<C.FLEET_AIR.every+.5;t+=.25)C.fleetTick(B,.25,{});
 const after=out(B,1,q=>!q.bomber),need=Math.ceil(xw.filter(u=>!u.dead).length*C.FLEET_AIR.interceptPer/C.FLEET_AIR.squad);
 assert.ok(after>before,'fighters go up as they come: '+before+' -> '+after);assert.ok(after>=Math.min(need,before+B.air.squadrons.filter(q=>q.team===1&&!q.bomber).length-before),'interceptPer fighters for each craft that comes');
 assert.ok(B.air.squadrons.some(q=>q.team===1&&q.scramble!=null),'launched as a scramble');
});
