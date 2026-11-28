// Ship-launched rounds, base vs candidate: two ships attack each other; every round is followed to its end.
// usage: node shipduel.cjs <root> [seeds=5]
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');const root=process.argv[2],SEEDS=+(process.argv[3]||5),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx).designs,copy=x=>JSON.parse(JSON.stringify(x));
const CASES=[['mc75','imperial',9000],['mandator2','imperial',40000],['mandator2-torp','imperial',40000],['providence','venator',9000],['arquitens','cr90',9000]];
for(const [ak,tk,dist] of CASES){const tot={launched:0,hit:0,downed:0,spent:0,target:0,other:0,tHit:0,speedHit:0};
 for(let seed=1;seed<=SEEDS;seed++){const pa=copy(F[ak.replace('-torp','')].p);if(ak.endsWith('-torp'))for(const m of pa.modules)if(m.k==='launcher'){m.torp=true;}
  const a=C.fleetUnit('a',ak,pa,0),t=C.fleetUnit('t',tk,copy(F[tk].p),1);a.pos=[0,0,0];t.pos=[dist,0,(seed-3)*500];a.yaw=0;t.yaw=Math.PI;a.velocity=[0,0,0];t.velocity=[0,0,0];
  a.order={...a.order,type:'attack',target:'t',fire:true};t.order={...t.order,type:'attack',target:'a',fire:true};
  const b=C.fleetBattle([a,t],true);b.seed=seed;const seen=new Map();
  for(let s=0;s<360/0.25;s++){C.fleetTick(b,.25,{});for(const m of b.missiles||[])if(m.from==='a'&&!seen.has(m.id))seen.set(m.id,{m,t0:b.time,s0:m.s});for(const [id,q] of seen)if(!q.done&&(!(q.m.n>0)||!(b.missiles||[]).includes(q.m))){q.done=true;q.t1=b.time;}if((a.dead||t.dead)&&!(b.missiles||[]).some(m=>m.from==="a"&&m.n>0))break;}
  for(const q of seen.values()){tot.launched++;const m=q.m;if(m.hit>0){tot.hit++;tot.tHit+=(q.t1||b.time)-q.t0;tot.speedHit+=m.s;}else if(m.lost==='spent')tot.spent++;else if(m.lost==='target')tot.target++;else if(q.done)tot.downed++;else tot.other++;}}
 const n=tot.launched;console.log(`${ak} vs ${tk} at ${dist/1000} km, ${SEEDS} seeds: launched ${n}, hit ${tot.hit} (${(100*tot.hit/Math.max(1,n)).toFixed(1)}%), downed ${tot.downed}, spent ${tot.spent}, target gone ${tot.target}, in flight at end ${tot.other}; mean time to hit ${(tot.tHit/Math.max(1,tot.hit)).toFixed(1)} s, mean speed at hit ${(tot.speedHit/Math.max(1,tot.hit)).toFixed(0)} m/s`);}
