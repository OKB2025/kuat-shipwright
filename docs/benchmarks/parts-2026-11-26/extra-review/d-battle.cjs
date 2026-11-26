const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2]||'/home/user/kuat-shipwright',cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
function plan(){
 const a=C.fleetUnit('a','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),0),b=C.fleetUnit('b','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),1);b.pos=[2500,0,0];b.yaw=Math.PI;
 a.order={...a.order,type:'hold',target:'b',fire:true};b.order={...b.order,type:'hold',target:'a',fire:true};
 const B=C.fleetBattle([a,b]);B.seed=7;return B;
}
const ionView=us=>JSON.stringify(us.map(u=>[u.id,u.roundAcc||null,u.ionSt||null,u.ionOff||null,u.mods,u.ionLedger||null]));
const state=us=>JSON.stringify(us.map(u=>[u.id,u.pos,u.sec,u.mods,u.ionSt||null,u.roundAcc||null,u.ionOff||null,u.shield,u.energy,u.dead]));
const r={};
const B=plan();
for(let i=0;i<3;i++){C.fleetCommit(B);C.fleetFinish(B);}
r.time=B.time;r.phase=B.phase;r.roundAccExists=B.units.map(u=>u.roundAcc?Object.keys(u.roundAcc).length:null);r.roundAcc=B.units.map(u=>u.roundAcc);r.alive=B.units.map(u=>!u.dead&&!u.out);
// (1) commit does not change roundAcc / ionSt of the plan
let before=ionView(B.units);let one=C.fleetCommit(B);B.phase='plan';r.planUntouched1=ionView(B.units)===before;
r.copyRoundAccDiffers=JSON.stringify(one.units.map(u=>u.roundAcc))!==JSON.stringify(B.units.map(u=>u.roundAcc));
r.copyRoundAccShared=one.units.map((u,i)=>u.roundAcc===B.units[i].roundAcc);
// (2) ion hit on a plan unit
const u=B.units[1];const evs=[];
const res=C.ionOverloadJ(u,5000*C.ION_KT,{},{time:B.time,rand:()=>.5,ev(...a){evs.push(a[0]);}});
r.ionResult=res&&{keys:Object.keys(res),stopped:res.stopped?.length,stored:res.storedJ,heat:res.heatJ};r.ionStAfterHit=u.ionSt&&{nJ:u.ionSt.J.filter(x=>x>0).length,q:u.ionSt.q};r.ionOffAfterHit=u.ionOff?.length;
before=ionView(B.units);const beforeFull=state(B.units);
one=C.fleetCommit(B);const first=state(one.units);B.phase='plan';
r.planUntouchedAfterIon=ionView(B.units)===before;r.planFullUntouched=state(B.units)===beforeFull;
r.copyIonStShared=one.units.map((x,i)=>x.ionSt&&x.ionSt===B.units[i].ionSt);r.copyIonStJShared=one.units.map((x,i)=>x.ionSt&&B.units[i].ionSt&&x.ionSt.J===B.units[i].ionSt.J);
r.copyIonChanged=JSON.stringify(one.units[1].ionSt)!==JSON.stringify(B.units[1].ionSt);
const two=C.fleetCommit(B);const second=state(two.units);B.phase='plan';
r.twoCommitsSame=first===second;r.planUntouchedAfter2=state(B.units)===beforeFull;
if(first!==second){const a=JSON.parse(first),b=JSON.parse(second);a.forEach((x,i)=>x.forEach((v,j)=>{if(JSON.stringify(v)!==JSON.stringify(b[i][j]))console.log('differ unit',i,'field',j,JSON.stringify(v).slice(0,200),JSON.stringify(b[i][j]).slice(0,200));}));}
// mods of the plan after ion hit unchanged by commits
console.log(JSON.stringify(r,null,1));
