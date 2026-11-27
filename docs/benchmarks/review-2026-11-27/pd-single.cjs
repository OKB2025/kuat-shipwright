// usage: node pd-single.cjs <root> : fleet battle, the MC75 (guns off) firing single rounds at a tough Imperial with point defence on;
// per step size: rounds seen, disabled, destroyed, struck, and the steps from disabled to destroyed.
const fs=require('fs'),path=require('path'),vm=require('vm');const root=process.argv[2];const cx=vm.createContext({console:{log(){},warn(){},error:console.error},performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
for(const dt of [.25,.1]){
 const pa=plain(F.designs.mc75.p);pa.gunArcs=pa.gunArcs.map(()=>0);pa.ionArcs=(pa.ionArcs||[]).map(()=>0);
 pa.modules=[...pa.modules,{k:'sensor',name:'dome',size:31527,trackVol:30340,share:1,at:.5,domain:'main'}];
 const a=C.fleetUnit('a','mc75',pa,0),b=C.fleetUnit('b','imperial',plain(F.designs.imperial.p),1);b.pos=[9000,0,0];b.yaw=Math.PI;for(const x of b.sec){x.max*=1e6;x.s=x.max;}
 a.order={...a.order,type:'hold',target:'b',fire:true};b.order={...b.order,type:'hold',fire:false,autoPointDefense:true};
 const B=C.fleetBattle([a,b],true);B.seed=7;const seen=new Map();let step=0;
 for(let t=0;t<60;t+=dt){C.fleetTick(B,dt,{});step++;for(const m of B.missiles){let r=seen.get(m);if(!r)seen.set(m,r={single:m.n===1});if(m.pdDisabled&&r.dis==null)r.dis=step;}
  for(const [m,r] of seen){if(r.end==null&&!(m.n>0)){r.end=step;r.hit=!!m.hit;r.downed=!!m.downed;}}}
 const R=[...seen.values()].filter(r=>r.single),gap=R.filter(r=>r.dis!=null&&r.downed).map(r=>r.end-r.dis);
 console.log(JSON.stringify({dt,rounds:R.length,disabled:R.filter(r=>r.dis!=null).length,destroyed:R.filter(r=>r.downed).length,struck:R.filter(r=>r.hit).length,struckAfterDisabled:R.filter(r=>r.hit&&r.dis!=null).length,stepsDisabledToDestroyed:{min:Math.min(...gap),max:Math.max(...gap),mean:gap.length?+(gap.reduce((s,v)=>s+v,0)/gap.length).toFixed(2):null}}));}
