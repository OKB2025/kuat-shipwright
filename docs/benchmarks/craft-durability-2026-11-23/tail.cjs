// An attacker directly behind a target that flies straight on: when the target's shield breaks and when it is lost.
// usage: node tail.cjs  (current game values; no trial switches)
const {C}=require('/home/user/kuat-shipwright/scripts/update-ship-examples.cjs').loadRuntime('/home/user/kuat-shipwright');
const prof={};const P=k=>prof[k]||(prof[k]=(()=>{const s=C.buildDesign(k),S=C.computeStats(s);return JSON.parse(JSON.stringify(C.fleetProfile(S,s.name,s)));})());
function run(ak,tk,dist,seed){const a=C.fleetUnit('a',ak,P(ak),0),t=C.fleetUnit('t',tk,P(tk),1);const v=300;
 t.pos=[dist,0,0];t.yaw=0;t.velocity=[v,0,0];a.pos=[0,0,0];a.yaw=0;a.velocity=[v,0,0];
 const B=C.fleetBattle([a,t],true);B.seed=seed;a.order={type:'attack',target:'t',fire:true};t.order={type:'move',point:[1e7,0,0],fire:false};
 let tb=null,tk2=null;const sh0=t.shieldMax||0;for(let i=0;i<240;i++){C.fleetTick(B,.25);const T=B.units.find(u=>u.id==='t');if(tb==null&&sh0>0&&T.shield<=sh0*1e-6)tb=B.time;if(T.dead){tk2=B.time;break;}}
 return {tb,tk:tk2};}
const pairs=[['craft_tie_ln','craft_xwing'],['craft_tie_in','craft_xwing'],['craft_tie_d','craft_xwing'],['craft_xwing','craft_tie_ln'],['craft_xwing','craft_tie_in'],['craft_xwing','craft_tie_d'],['craft_tie_ln','craft_awing'],['craft_awing','craft_tie_ln'],['craft_tie_ln','craft_tie_ln'],['craft_tie_ln','craft_btlb']];
for(const [a,t] of pairs)for(const d of [150,300,600]){const r=[1,2,3].map(s=>run(a,t,d,s));const f=x=>x==null?'—':x.toFixed(1);console.log(`${a} → ${t} ${d} m: shield breaks ${r.map(x=>f(x.tb)).join('/')} s, lost ${r.map(x=>f(x.tk)).join('/')} s`);}
