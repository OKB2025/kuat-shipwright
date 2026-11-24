// Dogfight measurement with the proposed laser powers and craft that cannot be shot down (study; the game is not changed).
// usage: node sim.cjs <repo> <a> <b> <runs> <nA> <nB> <seconds>
// The craft fly the game's own dogfight AI (Core.fleetTick). Whenever a craft's guns bear on its target (a shot record this step) and
// the target is within the proposed laser's range, its barrels fire at 1 shot a second each; a shot hits with Core.gunHitChance at
// that distance (range = the laser's). Energy on target = shot × exp(−d/λ), λ = range ÷ ln(shot ÷ 1 kt).
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const [root,A='craft_tie_in',Bk='craft_xwing',N='10',NA='1',NB='1',T='120']=process.argv.slice(2);
const cx=vm.createContext({console:{log(){},warn(){},error:console.error}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),pc={},prof=k=>plain(pc[k]||(pc[k]=(()=>{const s=C.buildDesign(k),S=C.computeStats(s);return C.fleetProfile(S,s.name,s);})()));
// proposed lasers: [barrels, shot kt, range m]
const LAS={craft_tie_in:[6,118,861],craft_tie_ln:[2,118,861],craft_xwing:[4,136,2390],craft_arc170:[2,176,1530],craft_z95:[2,20,880],craft_tie_d:[8,118,861]};
const PLANET={center:[0,-(6.12e6+160000),0],radius:6.12e6};
function run(seed){const mk=(id,k,team)=>{const u=C.fleetUnit(id,k,prof(k),team);for(const x of u.sec||[]){x.max*=1e9;x.s=x.max;}u.hp=1e12;return u;};
 const as=[],bs=[];for(let i=0;i<+NA;i++)as.push(mk('a'+i,A,0));for(let i=0;i<+NB;i++)bs.push(mk('b'+i,Bk,1));
 const a=as[0],b=bs[0];b.pos=[8000,0,0];b.yaw=Math.PI;a.velocity=[C.craftCruiseSpeed(a),0,0];b.velocity=[-C.craftCruiseSpeed(b),0,0];
 bs.forEach((w,i)=>{if(i){w.pos=[b.pos[0]+300*i,0,b.pos[2]+300*i];w.yaw=b.yaw;w.velocity=b.velocity.slice();}w.order={...w.order,type:'attack',target:'a0',fire:true};});
 as.forEach((w,i)=>{if(i){w.pos=[-300*i,0,-300*i];w.yaw=a.yaw;w.velocity=a.velocity.slice();}w.order={...w.order,type:'attack',target:'b0',fire:true};});
 const all=[...as,...bs],B=C.fleetBattle(all,true);B.seed=seed;const byId=new Map(all.map(u=>[u.id,u])),near=(u,L)=>L.slice().sort((x,y)=>C.len(C.sub(x.pos,u.pos))-C.len(C.sub(y.pos,u.pos)))[0];
 const st={};for(const k of [A,Bk])st[k]={bearS:0,inS:0,shots:0,hits:0,kt:0,dShot:0,dHit:0,hist:{},dead:0,minD:1e9,sep:0,sepN:0};
 for(let t=0;t<+T;t+=.25){for(const w of as){const q=near(w,bs);w.order={...w.order,target:q.id};}for(const w of bs){const q=near(w,as);w.order={...w.order,target:q.id};}
  const sh=C.fleetTick(B,.25,{planet:PLANET});for(const u of all){if(u.dead){u.dead=false;st[u.key].dead++;}for(const x of u.sec||[])x.s=x.max;if(u.shieldMax>0)u.shield=u.shieldMax;u.out=false;}
  const d0=C.len(C.sub(a.pos,near(a,bs).pos));for(const k of [A,Bk]){st[k].sep+=d0;st[k].sepN++;st[k].minD=Math.min(st[k].minD,d0);}
  for(const q of sh){if(!(q.gun>0)||typeof q.to!=='string')continue;const u=byId.get(q.from),v=byId.get(q.to),L=LAS[u.key];if(!u||!v||!L)continue;const [n,E,R]=L,d=C.len(C.sub(v.pos,u.pos)),S=st[u.key];S.bearS+=.25;if(d>R)continue;S.inS+=.25;
   const p=C.gunHitChance(u,v,d,R,C.fleetSystems(u).fire),shots=n*.25,hits=shots*p,lam=R/Math.log(E);S.shots+=shots;S.hits+=hits;S.kt+=hits*E*Math.exp(-d/lam);S.dShot+=shots*d;S.dHit+=hits*d;const bin=Math.floor(d/100)*100;S.hist[bin]=(S.hist[bin]||0)+hits;}}
 return st;}
const tot={};for(let s=1;s<=+N;s++){const r=run(s);for(const k in r){const T0=tot[k]||(tot[k]={bearS:0,inS:0,shots:0,hits:0,kt:0,dShot:0,dHit:0,hist:{},dead:0,minD:0,sep:0,sepN:0});for(const f of ['bearS','inS','shots','hits','kt','dShot','dHit','dead','sep','sepN'])T0[f]+=r[k][f];T0.minD+=r[k].minD;for(const b in r[k].hist)T0.hist[b]=(T0.hist[b]||0)+r[k].hist[b];}}
console.log(`== ${NA} x ${A} vs ${NB} x ${Bk}, ${N} runs of ${T} s (craft cannot be lost)`);
for(const k in tot){const S=tot[k],n=+N*(k===A?+NA:+NB),L=LAS[k];console.log(`${k} [${L[0]} barrels, ${L[1]} kt, ${L[2]} m]: mean separation ${(S.sep/S.sepN).toFixed(0)} m, nearest ${(S.minD/+N).toFixed(0)} m; per craft per run: guns bearing ${(S.bearS/n).toFixed(1)} s, within range ${(S.inS/n).toFixed(1)} s, shots ${(S.shots/n).toFixed(1)}, hits ${(S.hits/n).toFixed(1)} (${(100*S.hits/Math.max(1e-9,S.shots)).toFixed(0)}%), mean shot distance ${(S.dShot/Math.max(1e-9,S.shots)).toFixed(0)} m, mean hit distance ${(S.dHit/Math.max(1e-9,S.hits)).toFixed(0)} m, energy on target ${(S.kt/n).toFixed(0)} kt (${(S.kt/Math.max(1e-9,S.hits)).toFixed(1)} kt a hit), game kills that would have happened ${(S.dead/n).toFixed(1)}`);
 console.log('   hits by distance (m): '+Object.keys(S.hist).map(Number).sort((x,y)=>x-y).map(b=>b+'-'+(b+100)+': '+(S.hist[b]/n).toFixed(1)).join(', '));}
