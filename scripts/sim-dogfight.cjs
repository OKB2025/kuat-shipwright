// AI against AI dogfights: head-on from 8 km, and side by side (same heading) 2 km apart. usage: node dogfight.cjs [a] [b] [seeds]
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.env.KS_TEST_ROOT||require('node:path').resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),pc={},prof=k=>plain(pc[k]||(pc[k]=(()=>{const xs=C.buildDesign(k),S=C.computeStats(xs);return C.fleetProfile(S,xs.name,xs);})()));
const A=process.argv[2]||'craft_xwing',Bk=process.argv[3]||'craft_tie_ln',N=+(process.argv[4]||10),ang=x=>Math.atan2(Math.sin(x),Math.cos(x));
function run(kind,seed){const a=C.fleetUnit('a',A,prof(A),0),b=C.fleetUnit('b',Bk,prof(Bk),1);
 if(kind==='head-on'){b.pos=[8000,0,0];b.yaw=Math.PI;a.velocity=[C.craftCruiseSpeed(a),0,0];b.velocity=[-C.craftCruiseSpeed(b),0,0];}else{b.pos=[0,0,2000];b.yaw=0;a.velocity=[C.craftCruiseSpeed(a),0,0];b.velocity=[C.craftCruiseSpeed(b),0,0];}
 a.order={...a.order,type:'attack',target:'b',fire:true};b.order={...b.order,type:'attack',target:'a',fire:true};const B=C.fleetBattle([a,b],true);B.seed=seed;
 const st={tail:{a:0,b:0},bear:{a:0,b:0},shots:{a:0,b:0},dmin:1e9,first:null};let t=0;const trace=[];
 for(;t<300&&!a.dead&&!b.dead;t+=.25){const sh=C.fleetTick(B,.25);for(const q of sh)if(q.gun>0){st.shots[q.from]+=1;st.first=st.first??{t,by:q.from};}
  const d=C.len(C.sub(a.pos,b.pos));st.dmin=Math.min(st.dmin,d);for(const [u,v,k] of [[a,b,'a'],[b,a,'b']]){const brg=Math.atan2(v.pos[2]-u.pos[2],v.pos[0]-u.pos[0]);if(C.craftGunsBear(u,v))st.bear[k]+=.25;if(d<1500&&Math.abs(ang(brg-u.yaw))<Math.PI/3&&Math.abs(ang(brg-v.yaw))<Math.PI/3)st.tail[k]+=.25;}
  if(seed===1&&t%5===0&&t<=60)trace.push(`${t}s d=${Math.round(d)} A(${a.pos.map(Math.round)} hdg ${Math.round(ang(a.yaw)*57.3)}° ${Math.round(C.len(a.velocity))}m/s) B(${b.pos.map(Math.round)} hdg ${Math.round(ang(b.yaw)*57.3)}° ${Math.round(C.len(b.velocity))}m/s)`);}
 return {t,win:a.dead&&b.dead?'both':a.dead?'B':b.dead?'A':'none',st,trace,ev:B.events.slice(-2).map(e=>e.text)};}
for(const kind of ['head-on','parallel']){const R=[];for(let s=1;s<=N;s++)R.push(run(kind,s));const w=k=>R.filter(r=>r.win===k).length,avg=f=>(R.reduce((n,r)=>n+f(r),0)/R.length).toFixed(1),done=R.filter(r=>r.win!=='none');
 console.log(`== ${kind}: ${A} (A) vs ${Bk} (B), ${N} runs: A wins ${w('A')}, B wins ${w('B')}, both lost ${w('both')}, undecided in 300 s ${w('none')}; mean time to decision ${done.length?(done.reduce((n,r)=>n+r.t,0)/done.length).toFixed(1):'-'} s; nearest ${avg(r=>r.st.dmin)} m; seconds on the other's tail A ${avg(r=>r.st.tail.a)} B ${avg(r=>r.st.tail.b)}; seconds guns bearing A ${avg(r=>r.st.bear.a)} B ${avg(r=>r.st.bear.b)}; first shot at ${avg(r=>r.st.first?.t??300)} s`);
 console.log(R[0].trace.join('\n'));console.log('   run 1:',R[0].win,R[0].t,'s',R[0].ev.join(' | '));}
