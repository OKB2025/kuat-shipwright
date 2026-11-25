// ships-only fleet actions for arbitrary line-ups: node small.cjs <root> "a,b:c,d" [limit=1200] [start=40000]
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2],cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
const FLEETS=process.argv[3].split(':').map(s=>s.split(',')),LIMIT=+(process.argv[4]||1200),START=+(process.argv[5]||40000),STEP=.25,PRESSAI=process.env.KS_PRESS!=='0';
const ships=[[],[]],all=[];
FLEETS.forEach((keys,team)=>keys.forEach((key,i)=>{const ff=process.env.KS_FRESH&&fs.existsSync(path.join(process.env.KS_FRESH,'profile-'+key+'.json'))?JSON.parse(fs.readFileSync(path.join(process.env.KS_FRESH,'profile-'+key+'.json'),'utf8')):null,u=C.fleetUnit('s'+team+'_'+i,key,ff||plain(F.designs[key].p),team);u.pos=[(team?1:-1)*START/2,0,(i-(keys.length-1)/2)*2500];u.yaw=team?Math.PI:0;ships[team].push(u);all.push(u);}));
const B=C.fleetBattle(all,true);B.seed=7919;
const eff=u=>!u.dead&&!u.out&&C.fleetEffective(u),up=u=>!u.dead,press=[false,false],st={first:[null,null],fired:[0,0],minD:Infinity,out:{},sd:{}};let t=0,lastJ=-1e9;
const s0=new Map(all.map(u=>[u.id,{sh:u.shield,hp:u.hp}]));
for(;t<LIMIT;t+=STEP){
 if(t-lastJ>=5){lastJ=t;for(const k of [0,1])press[k]=PRESSAI&&C.fleetPressJudge(ships[k],ships[1-k],press[k]);}
 for(const k of [0,1])for(const s of ships[k]){if(s.dead||s.out||C.bridgeLost(s))continue;const foes=ships[1-k].filter(up),live=foes.filter(eff),q=C.fleetTargetCandidates(s,live.length?live:foes,Infinity,null,false)[0]?.target;s.order={type:q?'attack':'hold',target:q?.id,fire:true,launch:false,power:'auto',aim:'auto',autoPointDefense:true,...(press[k]?{press:true}:{})};if(q&&!st.sd[s.id])st.sd[s.id]=`${s.key}->${q.key} ${(C.fleetFightRange(s,q)/1000).toFixed(1)}km`;}
 const shots=C.fleetTick(B,STEP,{});
 for(const q of shots){const a=all.find(u=>u.id===q.from),z=all.find(u=>u.id===q.to);if(!a||!z)continue;const e=(q.gun||0)+(q.msl||0);if(e>0){st.fired[a.team]+=e;st.first[a.team]??={t,d:C.len(C.sub(a.pos,z.pos))};}}
 for(const a of ships[0])for(const z of ships[1])if(up(a)&&up(z))st.minD=Math.min(st.minD,C.len(C.sub(a.pos,z.pos)));
 for(const u of all)if(!st.out[u.id]&&(u.dead||u.out))st.out[u.id]={t,why:u.dead?(u.fate||'lost'):u.out};
 const left=[0,1].map(k=>ships[k].some(eff));if(!left[0]||!left[1])break;
}
const left=[0,1].map(k=>ships[k].filter(eff).length),res=left[0]&&left[1]?'UNDECIDED':left[0]?'A wins':left[1]?'B wins':'neither';
console.log(`${process.argv[3]} | ${res} at ${t}s | left ${left[0]}/${FLEETS[0].length} : ${left[1]}/${FLEETS[1].length} | first fire A ${st.first[0]?st.first[0].t+'s @'+(st.first[0].d/1000).toFixed(1)+'km':'never'}, B ${st.first[1]?st.first[1].t+'s @'+(st.first[1].d/1000).toFixed(1)+'km':'never'} | closest ${(st.minD/1000).toFixed(2)}km | press ${press}`);
console.log('  standoff: '+Object.values(st.sd).join('; '));
for(const u of all){const o=st.out[u.id],z=s0.get(u.id);console.log(`  ${'AB'[u.team]} ${u.key.padEnd(12)} shield ${(100*Math.max(0,u.shield)/Math.max(1e-30,z.sh)).toFixed(0)}% hull ${(100*Math.max(0,u.hull??u.hp)/Math.max(1e-30,z.hp)).toFixed(0)}% ${o?'OUT '+o.why+' at '+o.t+'s':'in action'}`);}
