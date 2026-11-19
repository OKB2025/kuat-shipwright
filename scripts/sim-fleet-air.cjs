// A fleet action with craft, AI against AI (user decision 2026-11-19「ISD×2 vs MC-75、MC-80、ネピュロンB×2、CR-90 あたりで航空機も含めた
// 艦隊戦を行ってみて」「制空、迎撃、直掩を各艦隊が判断して編隊を送り込む形」).
// usage: node scripts/sim-fleet-air.cjs [runs=3]
//   KS_WING=1     share of each ship's stored air wing that flies (0 = no craft: the ships alone, for a comparison)
//   KS_START=80000 distance between the fleets at the start, m
//   AXES=2 SPREAD=2.1  routes the bombers come in on about their target, and the angle the routes are spread over (as sim-strike.cjs)
//   TIE=run|zone  the interceptors' two ways (sim-strike.cjs): run = craft on an attack run first; zone = craft within HANDOFF m
//                 of an own ship are left to its point defence
//   KS_INTERCEPT=40000  how far from an own ship an enemy bomber is taken for an attack run and intercepted, m
//   KS_PRESS=0   the fleets never press for a decision (they fight from their stand-off, as before 2026-11-19)
//   KS_LIMIT=900  seconds
// What this is and is not:
// - The ships fight with the battle's own rules (fleetTick): each attacks the nearest effective enemy ship, as fleetAiOrders does.
// - The craft are the ships' stored air wings (data/fleet.js: fighters and bombers; shuttles and landing craft stay aboard),
//   each a full unit built from its example design. They START BESIDE THEIR SHIP, IN FLIGHT: the launch is not simulated.
// - Air control: a ship has only p.airCtl squadrons (of 12) in the air at once, its flagship lending its spare, as on the strategic map.
// - The allocation of fighters (intercept, close escort, air superiority), the bombers' routes and releases, and the loading from
//   the repulsorlift's spare lift are in THIS SCRIPT, not in the game. Nobody re-arms: a craft that has released returns to its ship's side.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x)),pc={},spare={};
const prof=k=>plain(pc[k]||(pc[k]=k.startsWith('craft_')?(()=>{const xs=C.buildDesign(k),S=C.computeStats(xs);spare[k]=Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass);return C.fleetProfile(S,xs.name,xs);})():F.designs[k].p));
const RUNS=+(process.argv[2]||3),WING=+(process.env.KS_WING??1),START=+(process.env.KS_START||80000),LIMIT=+(process.env.KS_LIMIT||900),STEP=.25,REASSIGN=3;
const AXES=Math.max(1,+(process.env.AXES||2)),SPREAD=+(process.env.SPREAD||2.1),RUNIN=15000,INTERCEPT=+(process.env.KS_INTERCEPT||40000)/* user decision 2026-11-19「迎撃をもっと遠くから」: was RUNIN (15 km); ★ 40 km, the reach of the ships' longest guns */,HANDOFF=3500,ENGAGE=3000,AIRSHOT=4000,AIRWAIT=4,TIEMODE=process.env.TIE==='zone'?'zone':'run';
const PRESSAI=process.env.KS_PRESS!=='0',SQUAD=12/* craft to a squadron */,ROUND=C.AIR_ROUND,INTERCEPT_PER=2/* fighters sent at each bomber on an attack run */,ESCORT_SHARE=.5/* of the fighters left after the intercept, at most, fly close escort: one to a bomber that still carries rounds */;
const FLEETS=[['mc75','mc80liberty','nebulonb','nebulonb','cr90'],['imperial','imperial']];
// Stored wing types that fly here, and what they do. Types without an example design (U-wing, shuttles, landing craft) stay aboard.
const ROLE={xwing:{key:'craft_xwing',job:'fighter'},awing:{key:'craft_awing',job:'fighter'},ywing:{key:'craft_btlb',job:'bomber'},tie_ln:{key:'craft_tie_ln',job:'fighter'},tie_in:{key:'craft_tie_in',job:'fighter'},tie_sa:{key:'craft_tie_sa',job:'bomber'}};
const KINDS=[{kind:'itorp',ion:true,release:4000,range:8000},{kind:'cmsl',ion:false,release:6000,range:10000},{kind:'bomb',ion:false,release:700,range:1500}],AIMS=['engine','bridge','weapon','sensor'];
const loadOf=(key,kinds)=>{const n=Math.max(0,Math.floor((spare[key]||0)/ROUND.mass)),out=[];for(let i=0;i<n;i++)out.push({...kinds[i%kinds.length]});return out;};
const dist=(a,b)=>C.len(C.sub(a.pos,b.pos)),up=u=>!u.dead,nearest=(u,list)=>{let best=null,bd=Infinity;for(const w of list){if(w.dead)continue;const d=dist(w,u);if(d<bd){bd=d;best=w;}}return best;};
function run(seed){
 const ships=[[],[]],fighters=[[],[]],bombers=[[],[]],rounds=[],all=[];let n=0;
 FLEETS.forEach((keys,team)=>keys.forEach((key,i)=>{const u=C.fleetUnit('s'+team+'_'+i,key,prof(key),team),side=team?1:-1;u.pos=[side*START/2,0,(i-(keys.length-1)/2)*2500];u.yaw=team?Math.PI:0;ships[team].push(u);all.push(u);
  // The ship's wing in squadrons of SQUAD craft, in the order it is stored. Which of them fly is the ship's air control's to say (below).
  u.squadrons=[];for(const w of F.designs[key].air||[]){const r=ROLE[w.type];if(!r)continue;const count=Math.round(w.count*WING);
   for(let k=0;k<count;k++){const c=C.fleetUnit('c'+(n++),r.key,prof(r.key),team);c.home=u.id;c.kind=w.type;c.bomber=r.job==='bomber';c.stores=loadOf(r.key,c.bomber?KINDS:[KINDS[1]]);c.stores0=c.stores.length;
    if(k%SQUAD===0)u.squadrons.push({type:w.type,members:[],out:false});u.squadrons[u.squadrons.length-1].members.push(c);}}}));
 // User question 2026-11-19「艦載機は管制数を反映してる？」: air control as on the strategic map (Rts airCtlCap / airCtlOf). A ship directs
 // p.airCtl squadrons in the air at once (half of that goes with its bridges still working; none when it is lost or out of action);
 // its fleet's flagship (the first ship) lends what it has spare; squadrons past both wait aboard and are sent up when one in the air
 // is gone (nobody lands here, so that is when a squadron is wiped out). None already out is recalled.
 let B=null;const byId=new Map(all.map(u=>[u.id,u])),slots=new Map();
 const ctlCap=u=>{if(u.dead||u.out)return 0;const ms=u.p.modules||[];let nb=0,a=0;for(let i=0;i<ms.length;i++)if(ms[i].k==='bridge'){nb++;if(u.mods[i]>0)a++;}return Math.max(1,Math.floor((u.p.airCtl??Math.max(1,Math.round((u.p.aaCh??4)/3)))*(nb?.5+.5*a/nb:1)+1e-6));};
 const ctlUsed=u=>u.squadrons.filter(q=>q.out&&q.members.some(up)).length;
 const sendUp=(u,q)=>{const side=u.team?1:-1;q.out=true;for(const c of q.members){const slot=slots.get(u.id)||0;slots.set(u.id,slot+1);const v=C.craftCruiseSpeed(c),row=Math.floor(slot/12)%6,col=slot%12;
   c.pos=[u.pos[0]-side*(row*150-300),u.pos[1]+200+(col%3)*120,u.pos[2]+(col<6?-1:1)*(u.p.len*.3+250+Math.floor(col%6/3)*150+row*40)];c.yaw=u.yaw;c.velocity=[Math.cos(c.yaw)*v,0,Math.sin(c.yaw)*v];
   if(c.bomber){c.aimAt=AIMS[bombers[u.team].length%AIMS.length];c.routeN=bombers[u.team].length%AXES;bombers[u.team].push(c);}else fighters[u.team].push(c);all.push(c);byId.set(c.id,c);}};
 const control=()=>{for(const team of [0,1]){const flag=ships[team][0];for(const u of ships[team]){if(u.dead)continue;for(const q of u.squadrons){if(q.out)continue;const own=ctlCap(u)-ctlUsed(u),lent=ships[team].filter(x=>x!==flag&&!x.dead).reduce((m,x)=>m+Math.max(0,ctlUsed(x)-ctlCap(x)),0),spare=u!==flag&&!flag.dead?ctlCap(flag)-ctlUsed(flag)-lent:0;if(own<1&&spare<1)break;sendUp(u,q);}}}};
 control();const flownAtStart=[0,1].map(t=>ships[t].reduce((m,u)=>m+u.squadrons.filter(q=>q.out).length,0)),squadsAll=[0,1].map(t=>ships[t].reduce((m,u)=>m+u.squadrons.length,0));
 B=C.fleetBattle(all,true);B.seed=seed;
 const st={released:[0,0],airFired:[0,0],roles:[],shipOut:{},firstGun:null,firstRelease:[null,null],press:[false,false],pressLog:[]},eff=u=>!u.dead&&!u.out&&C.fleetEffective(u);
 const centre=list=>{const xs=list.filter(up);return xs.length?xs.reduce((a,u)=>C.add(a,u.pos),[0,0,0]).map(v=>v/xs.length):[0,0,0];};
 const onRun=(u,own)=>u.stores.length&&own.some(s=>!s.dead&&dist(u,s)<=INTERCEPT&&C.dot(C.sub(s.pos,u.pos),u.velocity||[0,0,0])>0);
 function assign(team,t){
  const foe=1-team,own=ships[team],free=new Set(fighters[team].filter(up)),EB=bombers[foe].filter(u=>up(u)&&u.stores.length),EF=fighters[foe].filter(up),OB=bombers[team].filter(u=>up(u)&&u.stores.length),count={intercept:0,escort:0,sweep:0};
  const inZone=u=>own.some(s=>!s.dead&&dist(u,s)<=HANDOFF+s.p.len/2);
  const take=(obj,k,job)=>{const picks=[...free].sort((a,z)=>((z.job?.id===obj.id&&z.job.job===job)-(a.job?.id===obj.id&&a.job.job===job))||dist(a,obj)-dist(z,obj)).slice(0,k);for(const f of picks){free.delete(f);f.job={job,id:obj.id};count[job]++;}return picks;};
  // Intercept: the enemy's bombers on an attack run at this fleet, the one nearest a ship first.
  const threats=EB.filter(u=>onRun(u,own)&&!(TIEMODE==='zone'&&inZone(u))).sort((a,z)=>Math.min(...own.filter(up).map(s=>dist(a,s)))-Math.min(...own.filter(up).map(s=>dist(z,s))));
  for(const q of threats){if(!free.size)break;for(const f of take(q,INTERCEPT_PER,'intercept'))f.order={...f.order,type:'attack',target:q.id,fire:true,aim:'auto'};}
  // Close escort: one fighter to each own bomber that still carries rounds. It stays by it and takes what comes within ENGAGE m of it.
  let quota=Math.floor(free.size*ESCORT_SHARE);
  for(const w of OB){if(!(quota>0)||!free.size)break;quota--;const f=take(w,1,'escort')[0],threat=nearest(w,EF);f.order=threat&&dist(threat,w)<=ENGAGE?{...f.order,type:'attack',target:threat.id,fire:true,aim:'auto'}:{...f.order,type:'escort',target:w.id,fire:true};}
  // Air superiority: the rest go for the enemy's fighters (then its bombers); with none left they come back to their ship.
  for(const f of [...free]){const q=(TIEMODE==='zone'?nearest(f,EF.filter(u=>!inZone(u))):null)||nearest(f,EF)||nearest(f,EB)||nearest(f,bombers[foe]);count.sweep++;f.job={job:'sweep',id:q?.id};
   const home=byId.get(f.home);f.order=q?{...f.order,type:'attack',target:q.id,fire:true,aim:'auto'}:home&&!home.dead?{...f.order,type:'escort',target:home.id,fire:true}:{...f.order,type:'hold',fire:true};}
  if(Math.abs(t%30)<1e-9)st.roles.push({t,team,...count,bombers:OB.length});
 }
 function bomberOrders(team){
  const foe=1-team,targets=ships[foe].filter(eff),big=targets.filter(s=>s.p.len>=1000),pool=big.length?big:targets,c=centre(bombers[team]);
  for(const y of bombers[team]){if(y.dead)continue;const home=byId.get(y.home);
   if(!y.stores.length||!pool.length){y.order=home&&!home.dead?{...y.order,type:'escort',target:home.id,fire:false}:{...y.order,type:'hold',fire:false};continue;}
   let T=byId.get(y.tgt);if(!T||!eff(T)){T=pool.slice().sort((a,z)=>C.len(C.sub(a.pos,c))-C.len(C.sub(z.pos,c)))[0];y.tgt=T.id;y.phase='approach';const base=Math.atan2(c[2]-T.pos[2],c[0]-T.pos[0]);y.routeA=base+(AXES>1?(y.routeN-(AXES-1)/2)*SPREAD/(AXES-1):0);}
   // The route in: to a point RUNIN m from the target on this bomber's bearing, then the run at the target.
   const W=[T.pos[0]+Math.cos(y.routeA)*RUNIN,y.pos[1],T.pos[2]+Math.sin(y.routeA)*RUNIN];if(y.phase==='approach'&&(C.len(C.sub(W,y.pos))<2500||dist(y,T)<RUNIN*.8))y.phase='run';
   y.order=y.phase==='run'?{...y.order,type:'attack',target:T.id,fire:false}:{...y.order,type:'move',point:W,fire:false};}
 }
 const fire=(u,target,k,nRounds,r,aim,aimRange)=>{const dir=C.norm(C.sub(target.pos,u.pos)),s=Math.max(220,C.len(u.velocity)),m={id:'m'+(B.missileN=(B.missileN||0)+1),salvo:u.id+k+'@'+B.time,team:u.team,from:u.id,target:target.id,n:nRounds,tt:ROUND.tt,kind:k,ion:r.ion,...(aim?{aim,aimRange}:{}),range:r.range,traveled:0,pos:u.pos.slice(),vel:C.mul(dir,s),s,life:r.range/C.roundSpeed(k)*1.5+5,sent:nRounds};(B.missiles||(B.missiles=[])).push(m);rounds.push(m);};
 let t=0,lastAssign=-Infinity;
 for(;t<LIMIT;t+=STEP){
  // The ships: each attacks the nearest effective enemy ship (fleetAiOrders' rule, for both sides; craft are not ship targets).
  for(const team of [0,1])for(const s of ships[team]){if(s.dead||s.out)continue;const foes=ships[1-team].filter(up),live=foes.filter(eff),q=C.fleetTargetCandidates(s,live.length?live:foes,Infinity,null,false)[0]?.target;s.order={type:q?'attack':'hold',target:q?.id,fire:true,launch:false,power:'auto',aim:'auto',autoPointDefense:true,...(st.press[team]?{press:true}:{})};}
  if(t-lastAssign>=REASSIGN-1e-9){lastAssign=t;for(const team of [0,1]){const on=PRESSAI&&C.fleetPressJudge(ships[team],ships[1-team],st.press[team]);if(on!==st.press[team])st.pressLog.push(`${t}s ${NAMES[team]} ${on?'presses for a decision':'falls back to its stand-off'}`);st.press[team]=on;}control();assign(0,t);assign(1,t);}
  for(const team of [0,1]){bomberOrders(team);
   // Fighters fire a concussion missile at a craft before their bow inside AIRSHOT m, then wait AIRWAIT seconds.
   for(const x of fighters[team]){if(x.dead||!x.stores.length||x.order.type!=='attack'||(x.mslAt||0)>t)continue;const q=byId.get(x.order.target);if(!q||q.dead||!C.craftUnit(q)||dist(x,q)>AIRSHOT||!C.craftGunsBear(x,q))continue;fire(x,q,'cmsl',1,KINDS[1]);x.stores.pop();x.mslAt=t+AIRWAIT;st.airFired[team]++;}
   // Bombers release each kind they carry at its distance with their bow on the target (bombs over the hull).
   for(const y of bombers[team]){if(y.dead||!y.stores.length||y.phase!=='run')continue;const T=byId.get(y.tgt);if(!T||T.dead)continue;const d=dist(y,T)-T.p.len/2,brg=Math.atan2(T.pos[2]-y.pos[2],T.pos[0]-y.pos[0]),off=Math.abs(Math.atan2(Math.sin(brg-y.yaw),Math.cos(brg-y.yaw)));
    for(const k of [...new Set(y.stores.map(r=>r.kind))]){const r=y.stores.find(q=>q.kind===k);if(d>r.release||(k!=='bomb'&&off>.35))continue;const cnt=y.stores.filter(q=>q.kind===k).length;fire(y,T,k,cnt,r,y.aimAt,dist(y,T));st.released[team]+=cnt;st.firstRelease[team]??=t;y.stores=y.stores.filter(q=>q.kind!==k);}}}
  const shots=C.fleetTick(B,STEP);if(!st.firstGun)for(const q of shots){const a=byId.get(q.from),z=byId.get(q.to);if(a&&z&&!C.craftUnit(a)&&!C.craftUnit(z)&&q.gun>0){st.firstGun={t,d:dist(a,z)};break;}}
  for(const team of [0,1])for(const s of ships[team])if(!st.shipOut[s.id]&&(s.dead||s.out))st.shipOut[s.id]={t,why:s.dead?'lost':s.out};
  const left=[0,1].map(k=>ships[k].some(eff));if(!left[0]||!left[1])break;
 }
 const carried=[0,1].map(t=>[...fighters[t],...bombers[t]].reduce((s,u)=>s+(u.stores0||0),0)),waiting=[0,1].map(t=>ships[t].reduce((m,u)=>m+u.squadrons.filter(q=>!q.out).length,0));
 const craft=team=>{const by={};for(const u of [...fighters[team],...bombers[team]]){const r=by[u.kind]||(by[u.kind]={n:0,lost:0,ff:0});r.n++;if(u.dead)r.lost++;if(u.dead&&u.ffTaken>0)r.ff++;}return by;};
 const rd=team=>{const mine=rounds.filter(m=>m.team===team),sum=(f)=>mine.reduce((s,m)=>s+(f(m)||0),0),atShip=m=>!C.craftUnit(byId.get(m.target));
  return {carried:carried[team],atShips:st.released[team],atCraft:st.airFired[team],hitShips:sum(m=>atShip(m)?m.hit:0),hitCraft:sum(m=>atShip(m)?0:m.hit),downed:sum(m=>m.downed),lostWithCraft:[...fighters[team],...bombers[team]].filter(u=>u.dead).reduce((s,u)=>s+u.stores.length,0)};};
 const shipLine=s=>{const off=new Set((s.ionOff||[]).map(x=>x.i)),gone=k=>{const ms=s.p.modules.map((m,i)=>({m,i})).filter(q=>q.m.k===k&&!q.m.pd);return ms.filter(q=>!(s.mods[q.i]>0)).length+(ms.some(q=>off.has(q.i))?'(+'+ms.filter(q=>off.has(q.i)&&s.mods[q.i]>0).length+' shut down)':'')+'/'+ms.length;},o=st.shipOut[s.id];
  return `${s.key} ${s.dead?'LOST':s.out?'OUT ('+s.out+')':'in action'}${o?' at '+o.t+'s':''}; field ${s.shieldMax>0?Math.round(100*s.shield/s.shieldMax):0}% of what is left, sections lost ${s.secLost?.length||0}; out of action: engines ${gone('engine')}, bridge ${gone('bridge')}, guns ${gone('weapon')}, sensors ${gone('sensor')}`;};
 const left=[0,1].map(k=>ships[k].filter(eff).length);
 return {t,winner:left[0]&&left[1]?'undecided at the limit':left[0]?'Rebel fleet':left[1]?'Imperial fleet':'neither',left,firstGun:st.firstGun,craft:[craft(0),craft(1)],rounds:[rd(0),rd(1)],roles:st.roles,pressLog:st.pressLog,firstRelease:st.firstRelease,ctl:{flownAtStart,squadsAll,waiting},ships:[ships[0].map(shipLine),ships[1].map(shipLine)],units:all.length};
}
Object.values(ROLE).forEach(r=>prof(r.key));
const NAMES=['Rebel','Imperial'],wingOf=team=>{const by={};for(const key of FLEETS[team])for(const w of F.designs[key].air||[])if(ROLE[w.type])by[w.type]=(by[w.type]||0)+Math.round(w.count*WING);return Object.entries(by).map(([k,v])=>`${v} ${k} (${ROLE[k].job}, ${Math.floor((spare[ROLE[k].key]||0)/ROUND.mass)} rounds each)`).join(', ')||'no craft';};
console.log(`fleet action with craft: Rebel ${FLEETS[0].join(', ')} against Imperial ${FLEETS[1].join(', ')}; ${START/1000} km apart at the start; the ships attack the nearest effective enemy ship`);
console.log(`craft (the ships' stored wings x ${WING}, in flight beside their ship at the start; the launch is not simulated; nobody re-arms): Rebel ${wingOf(0)}; Imperial ${wingOf(1)}`);
console.log(`rounds of ${ROUND.tt.toFixed(4)} TT (${ROUND.mass.toFixed(2)} t), loaded to the repulsorlift's spare lift; bombers carry ion torpedoes, concussion missiles and proton bombs in turn and come in on ${AXES} route${AXES>1?'s spread over '+Math.round(SPREAD*57.3)+'°':''} against the nearest enemy ship of 1,000 m or more; fighters' concussion missiles are for craft`);
console.log(`fighters, decided by each fleet every ${REASSIGN} s: intercept = ${INTERCEPT_PER} to each enemy bomber on an attack run (carrying rounds, within ${INTERCEPT/1000} km of an own ship and closing${TIEMODE==='zone'?'; those within '+HANDOFF+' m of an own ship are left to its point defence':''}); close escort = one to each own bomber that carries rounds, at most ${ESCORT_SHARE*100}% of the fighters left; air superiority = the rest; ${RUNS} runs, limit ${LIMIT} s`);
for(let s=1;s<=RUNS;s++){const t0=Date.now(),r=run(s*7919);
 console.log(`\nrun ${s}: ended ${r.t}s (${r.units} units, ${Math.round((Date.now()-t0)/1000)} s to compute) | ${r.winner}; effective ships left: Rebel ${r.left[0]}/${FLEETS[0].length}, Imperial ${r.left[1]}/${FLEETS[1].length} | ships' guns first fired on a ship at ${r.firstGun?r.firstGun.t+'s, '+(r.firstGun.d/1000).toFixed(1)+' km':'never'}`);
 for(const team of [0,1]){const c=r.craft[team],q=r.rounds[team];
  console.log(` ${NAMES[team]} craft lost: ${Object.entries(c).map(([k,v])=>`${k} ${v.lost}/${v.n}${v.ff?' ('+v.ff+' of them struck by own point defence)':''}`).join(', ')||'none flown'} | rounds: carried ${q.carried}, released at ships ${q.atShips}${r.firstRelease[team]!=null?' (first at '+r.firstRelease[team]+'s)':''} (hit ${q.hitShips.toFixed(1)}), fired at craft ${q.atCraft} (hit ${q.hitCraft.toFixed(1)}), shot down ${q.downed.toFixed(1)}, lost with their craft ${q.lostWithCraft}`);
  for(const line of r.ships[team])console.log('   '+line);}
 console.log(' pressing for a decision (each fleet judges every '+REASSIGN+' s whether it can win at '+C.PRESS.range+' m; it then closes to that distance): '+(r.pressLog.join(' | ')||'neither fleet'));
 console.log(` air control (squadrons in the air at the start / in the wings; still waiting aboard at the end): Rebel ${r.ctl.flownAtStart[0]}/${r.ctl.squadsAll[0]}; ${r.ctl.waiting[0]} | Imperial ${r.ctl.flownAtStart[1]}/${r.ctl.squadsAll[1]}; ${r.ctl.waiting[1]}`);
 console.log(' fighters by task (intercept/escort/air superiority; own bombers still carrying rounds): '+r.roles.filter(x=>x.t%60===0).map(x=>`${x.t}s ${NAMES[x.team][0]} ${x.intercept}/${x.escort}/${x.sweep}; ${x.bombers}`).join(' | '));}
