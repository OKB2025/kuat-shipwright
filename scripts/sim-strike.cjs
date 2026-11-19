// A strike on a capital ship, AI against AI: escorts and torpedo bombers against the ship, its point defence and its interceptors.
// usage: node scripts/sim-strike.cjs [runs=3] [target=imperial] [escorts=12] [bombers=12] [interceptors=12]
// Bombers (craft_btlb) carry ion torpedoes (ORD.itorp, two each: the Scarif load) and release them at RELEASE m with their bow on the ship.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x)),pc={},prof=k=>plain(pc[k]||(pc[k]=k.startsWith('craft_')?(()=>{const xs=C.buildDesign(k),S=C.computeStats(xs);return C.fleetProfile(S,xs.name,xs);})():F.designs[k].p));
const RUNS=+(process.argv[2]||3),TGT=process.argv[3]||'imperial',NX=+(process.argv[4]??12),NY=+(process.argv[5]??12),NT=+(process.argv[6]??12),RELEASE=4000,TORP={tt:40,n:2,range:8000},START=30000,LIMIT=600;
const dist=(a,b)=>C.len(C.sub(a.pos,b.pos)),near=(u,list)=>list.filter(w=>!w.dead).sort((x,y)=>dist(x,u)-dist(y,u))[0]||null;
function run(seed){
 const ship=C.fleetUnit('s',TGT,prof(TGT),1);ship.order={...ship.order,type:'hold',fire:true,launch:false,autoPointDefense:true};
 const mk=(id,key,team,pos,yaw)=>{const u=C.fleetUnit(id,key,prof(key),team);u.pos=pos;u.yaw=yaw;u.velocity=[Math.cos(yaw)*C.craftCruiseSpeed(u),0,Math.sin(yaw)*C.craftCruiseSpeed(u)];return u;};
 const xs=[],ys=[],ts=[];for(let i=0;i<NY;i++)ys.push(mk('y'+i,'craft_btlb',0,[-START,(i%3-1)*200,(i-NY/2)*250],0));for(let i=0;i<NX;i++)xs.push(mk('x'+i,'craft_xwing',0,[-START+2500,300+(i%3-1)*200,(i-NX/2)*250],0));
 for(let i=0;i<NT;i++)ts.push(mk('t'+i,'craft_tie_ln',1,[-ship.p.len*.6-300,(i%3-1)*150,(i-NT/2)*200],Math.PI));
 for(const y of ys){y.torps=TORP.n;y.order={...y.order,type:'attack',target:'s',fire:false};}
 const B=C.fleetBattle([ship,...xs,...ys,...ts],true);B.seed=seed;const st={released:0,carriedLost:0,firstRelease:null,shipOut:null,heat:0};let t=0;
 for(;t<LIMIT;t+=.25){
  for(const x of xs)if(!x.dead){const q=near(x,ts);x.order=q?{...x.order,type:'attack',target:q.id,fire:true}:{...x.order,type:'escort',target:(near(x,ys)||x).id,fire:true};}
  for(const w of ts)if(!w.dead){const q=near(w,[...ys.filter(y=>y.torps>0),...xs])||near(w,[...xs,...ys]);w.order=q?{...w.order,type:'attack',target:q.id,fire:true}:{...w.order,type:'hold'};}
  for(const y of ys){if(y.dead)continue;if(y.torps>0){const d=dist(y,ship),brg=Math.atan2(ship.pos[2]-y.pos[2],ship.pos[0]-y.pos[0]),off=Math.abs(Math.atan2(Math.sin(brg-y.yaw),Math.cos(brg-y.yaw)));
    if(d<=RELEASE+ship.p.len/2&&off<.35){const dir=C.norm(C.sub(ship.pos,y.pos));(B.missiles||(B.missiles=[])).push({id:'m'+(B.missileN=(B.missileN||0)+1),salvo:y.id+'@'+B.time,team:0,from:y.id,target:'s',n:y.torps,tt:TORP.tt,kind:'itorp',ion:true,range:TORP.range,traveled:0,pos:y.pos.slice(),vel:C.mul(dir,220),s:220,life:TORP.range/C.roundSpeed('itorp')*1.5});st.released+=y.torps;y.torps=0;st.firstRelease=st.firstRelease??t;y.order={...y.order,type:'move',point:[-START,y.pos[1],y.pos[2]*3],fire:false};}}}
  C.fleetTick(B,.25);if(st.shipOut==null&&(ship.out||ship.dead))st.shipOut={t,why:ship.dead?'lost':ship.out};
  if(ship.dead||(!ys.some(y=>!y.dead&&y.torps>0)&&!(B.missiles||[]).length&&t>(st.firstRelease??LIMIT)+30))break;}
 for(const y of ys)if(y.dead&&y.torps>0)st.carriedLost+=y.torps;const log=B.missileLog||{hit:0,downed:0};
 return {t,x:xs.filter(u=>u.dead).length,y:ys.filter(u=>u.dead).length,tie:ts.filter(u=>u.dead).length,released:st.released,carriedLost:st.carriedLost,hit:log.hit,downed:log.downed,firstRelease:st.firstRelease,ship:ship.dead?'lost':ship.out||'in action',shipOut:st.shipOut,field:ship.shieldMax>0?ship.shield/ship.shieldMax:0,events:B.events.filter(e=>e.id==='s').slice(-4).map(e=>Math.round(e.time)+'s '+e.text)};}
console.log(`strike on ${TGT}: ${NX} X-wings (escort), ${NY} Y-wings (BTL-B) with ${TORP.n} ion torpedoes each (${TORP.tt} TT, released at ${RELEASE} m), ${NT} TIE/ln interceptors; from ${START/1000} km; ${RUNS} runs`);
for(let s=1;s<=RUNS;s++){const r=run(s*7919);console.log(`run ${s}: ended ${r.t}s | lost: X-wings ${r.x}/${NX}, Y-wings ${r.y}/${NY}, TIEs ${r.tie}/${NT} | torpedoes: released ${r.released} (first at ${r.firstRelease}s), lost with their bombers ${r.carriedLost}, shot down ${(+r.downed).toFixed(1)}, hit ${(+r.hit).toFixed(1)} | ship: ${r.ship}${r.shipOut?` at ${r.shipOut.t}s`:''} | ${r.events.join(' / ')}`);}
