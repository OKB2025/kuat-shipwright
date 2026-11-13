// Fixed-seed fleet battle regression for combat-performance work. Four ships
// built from the prepared examples (surface patches, surface batteries,
// launchers) fight for 96 ticks; at fixed ticks reactors and dissipators are
// knocked out so power loss and heat limits run. After every tick the whole
// unit state (everything but the immutable profile p) and the battle state are
// hashed, and a compact numeric digest is kept. The expected values were
// recorded from 910ef75 (origin/main 3e82bf1 + the heat-governor HUD fix) and
// re-recorded on b40b72d (and again on 734081a, when surface remnants that reach
// no module stopped being recorded) when surface-armour penetrations began to
// be written to u.hitLog (X-ray replay): ticks 4..95 changed hash only through hitLog; with
// hitLog left out of the hash, and in every digest number, shot, event count and
// random state, all 96 ticks are identical to the 910ef75 recording.
// Every tick must match its full-state hash exactly. Only with
// KS_DETERMINISM_ALLOW_FLOAT=1 (for a reviewed change of floating-point
// summation order) may a mismatching tick pass instead with every digest
// number within 1e-12 relative; the count of inexact ticks is reported.
// Recorded with Node v22.23.4; Math.* may differ on other V8s.
//   KS_DETERMINISM_WRITE=1 KS_DETERMINISM_BASE=<commit> KS_TEST_ROOT=<base checkout> node --test tests/fleet-battle-determinism.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),GOLDEN=path.join(__dirname,'helpers/fleet-battle-determinism.json'),REL=1e-12,STEPS=96;
function load(){const cx=vm.createContext({console:{log(){},warn(){},error:console.error}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});return vm.runInContext('Core',cx);}
function profile(C,key){const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));return C.fleetProfile(C.computeStats(d),d.name,d);}
function canon(x,stack=new Set()){
 if(x===null)return null;if(x===undefined)return {$u:1};
 if(typeof x==='number')return Object.is(x,-0)?{$n:'-0'}:Number.isFinite(x)?x:{$n:String(x)};
 if(typeof x!=='object')return typeof x==='function'?{$f:1}:x;
 if(stack.has(x))return {$cycle:1};stack.add(x);let r;
 if(ArrayBuffer.isView(x))r={$ta:x.constructor.name,v:Array.from(x,v=>canon(v,stack))};
 else if(x instanceof Map)r={$map:[...x].map(([k,v])=>[canon(k,stack),canon(v,stack)])};
 else if(x instanceof Set)r={$set:[...x].map(v=>canon(v,stack))};
 else if(Array.isArray(x))r=x.map(v=>canon(v,stack));
 else{r={};for(const k of Object.keys(x).sort()){if(k==='p'&&x.mods&&x.team!==undefined)continue;if(typeof x[k]!=='function')r[k]=canon(x[k],stack);}}
 stack.delete(x);return r;
}
const sum=a=>(a||[]).reduce((n,v)=>n+(+v||0),0);
function digest(u){const h=u.ht||{},sa=Object.values(u.surfaceArmor||{}),pw=u.pw||{};
 return [u.dead?1:0,u.out?1:0,...u.pos,...u.velocity,u.yaw,u.hp,u.crew,u.shield,u.energy,u.armor,u.armorLoad||0,u.hot?1:0,sum(u.mods),u.mods.filter(v=>v<=0).length,sum((u.sec||[]).map(s=>s.s)),sum(u.zi),sum(u.zl),sa.length,sum(sa.map(s=>s.integrity)),sum(sa.map(s=>s.load)),sum(u.ammo),u.launched||0,sum(u.launcherT),sum(Object.values(u.surfaceBanks||{})),h.qJ||0,h.online===false?0:1,h.damageLimit??1,h.emit||0,pw.P||0,pw.draw||0,pw.wpn||0,u.engF||0,u.load||0,sum(u.fire)];}
function run(C,P){
 const spec=[['a0','arquitens',0,[0,0,0],0],['a1','cr90',0,[-600,80,700],0],['e0','arquitens',1,[5200,150,1600],-Math.PI*.85],['e1','hammerhead',1,[5600,-120,2600],-Math.PI*.85]];
 const units=spec.map(([id,k,team,pos,yaw])=>{const u=C.fleetUnit(id,k,P[k],team);u.name=id;u.pos=pos.slice();u.yaw=yaw;return u;}),b=C.fleetBattle(units,true);b.seed=20261111;
 const rules={range:40000,engagementDistance:12000,step:.25,damage:.7},ticks=[];let orderT=0;
 const orders=()=>{for(const u of b.units){if(u.dead||u.out||u.absent)continue;const foes=b.units.filter(t=>t.team!==u.team&&!t.dead&&!t.absent).sort((a,z)=>(!!a.out-!!z.out)||C.len(C.sub(a.pos,u.pos))-C.len(C.sub(z.pos,u.pos))||a.id.localeCompare(z.id));u.order={...u.order,type:foes.length?'attack':'hold',target:foes[0]?.id,fire:true,launch:true};}};
 const knock=(id,kinds,share)=>{const u=b.units.find(u=>u.id===id),idx=u.p.modules.map((m,j)=>kinds.includes(m.k)?j:-1).filter(j=>j>=0);idx.slice(0,Math.ceil(idx.length*share)).forEach(j=>u.mods[j]=0);};
 for(let i=0;i<STEPS;i++){
  if(orderT<=0){orders();orderT=2;}orderT-=.25;
  if(i===30)knock('e0',['reactor'],.5);if(i===45)knock('a0',['dissipator'],.67);if(i===60)knock('a1',['reactor'],1);
  const shots=C.fleetTick(b,rules.step,{rules,extra:new Map(),gravity:true,onHit:()=>{}}),{units:US,...rest}=b;
  const full=JSON.stringify({shots:canon(shots),battle:canon(rest),units:US.map(u=>canon(u))});
  ticks.push({hash:crypto.createHash('sha256').update(full).digest('hex').slice(0,24),shots:shots?.length??0,events:b.events.length,seed:b.seed,units:US.map(digest)});
 }
 return ticks;
}
const close=(a,b)=>a===b||Math.abs(a-b)<=REL*Math.max(Math.abs(a),Math.abs(b));

test('a fixed-seed fleet battle with hits, missiles, power loss and heat limits keeps its recorded state every tick',()=>{
 const C=load(),P={};for(const k of ['arquitens','cr90','hammerhead'])P[k]=profile(C,k);
 const ticks=run(C,P);
 // The scenario must actually exercise the paths it guards.
 const last=ticks.at(-1).units,first=ticks[0].units;
 assert.ok(ticks.some(t=>t.units.some(d=>d[21]>0)),'surface armour was hit');
 assert.ok(ticks.at(-1).units.some((d,i)=>d[24]<first[i][24]),'missiles were launched');
 assert.ok(ticks.some(t=>t.units.some(d=>d[1]===1)),'a ship was disabled');
 assert.ok(last.some((d,i)=>d[28]!==first[i][28]),'stored heat changed');
 if(process.env.KS_DETERMINISM_WRITE==='1'){fs.writeFileSync(GOLDEN,JSON.stringify({base:process.env.KS_DETERMINISM_BASE||null,node:process.version,steps:STEPS,ticks}));return;}
 const want=JSON.parse(fs.readFileSync(GOLDEN,'utf8')).ticks;assert.equal(ticks.length,want.length);
 const allowFloat=process.env.KS_DETERMINISM_ALLOW_FLOAT==='1',inexact=[];let exact=0;
 for(let i=0;i<ticks.length;i++){const a=ticks[i],w=want[i];if(a.hash===w.hash){exact++;continue;}inexact.push(i);
  if(!allowFloat)continue;
  assert.equal(a.shots,w.shots,`tick ${i} shots`);assert.equal(a.events,w.events,`tick ${i} events`);assert.equal(a.seed,w.seed,`tick ${i} random state`);
  a.units.forEach((d,u)=>d.forEach((v,k)=>assert.ok(close(v,w.units[u][k]),`tick ${i} unit ${u} digest[${k}] ${v} vs ${w.units[u][k]}`)));}
 console.log(`fleet-battle-determinism: exact ${exact}/${ticks.length}`+(inexact.length?`; ${inexact.length} inexact tick(s) from ${inexact[0]}`+(allowFloat?`, all within ${REL} relative (KS_DETERMINISM_ALLOW_FLOAT=1)`:''):''));
 if(!allowFloat)assert.equal(inexact.length,0,`full-state hash differs at ${inexact.length} tick(s), first ${inexact[0]} (set KS_DETERMINISM_ALLOW_FLOAT=1 only for a reviewed floating-order change)`);
});
