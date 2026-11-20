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
// 2026-11-19 re-recorded after the examples were regenerated on the v30 damage model (sections instead of hull points, the
// shield that holds while up, rounds that fly, planet gravity, the ion power cut, the air rounds' yields): every tick differs
// from the earlier recording, as intended. The base commit is in the reference file. Run twice after recording: identical.
// Re-recorded on 2026-11-15 (PR #111, after PR #110's firing-heat work): the heat state gained one field per unit,
// ht.madeBaseW (the heat a ship makes apart from its superweapons, for the firing-heat hold). Ticks 3..95 changed hash
// through that field only: with KS_DETERMINISM_ALLOW_FLOAT=1 every digest number, shot, event count and random state
// of all 96 ticks equals the previous recording within 1e-12, and the full states dumped at ticks 3 and 50 on main
// (b1bc4a8) and on the branch differ in nothing but the four added ht.madeBaseW keys (no value differs).
// Re-recorded again on 2026-11-15 for the battle changes the user decided (PR #111), each found by running this test
// at every commit against the previous recording: a penetrating shot kills crew in the compartment it enters
// (first difference tick 4, unit 0 crew 183 against 186.96); the gun spread halved (tick 0, shield, more hits);
// point defence ON intercepts only and never fires on ships (tick 0, heading). The later commits (balanced heat
// running, rapid fire one barrel at a time, the superweapon fixes) change nothing further in this scenario.
// Re-recorded once more: balanced heat running leaves a ship with nothing to balance against (no rejection) to the
// store's own governor. From tick 64 (after a1's reactors are knocked out at tick 60) the hash changed through the
// unit's heat-running state only: with KS_DETERMINISM_ALLOW_FLOAT=1 all 96 ticks equal the previous recording within
// 1e-12 in every digest number, shot, event count and random state.
// Re-recorded after the physics review's heat-running fixes (the rise per second, the record cleared on full running,
// lost rejection held down): from tick 4 the hash changed through the heat-running state only; with
// KS_DETERMINISM_ALLOW_FLOAT=1 all 96 ticks equal the previous recording within 1e-12.
// Re-recorded on c473505 + regenerated examples (2026-11-14, user decisions: one kind of structure, empty bays, denser machinery,
// carried load added to the ship's mass in battle). The ships in this battle changed mass and plant, so every tick
// differs from the 734081a recording from tick 0. Two recordings in a row gave the same file
// (same sha256 both times). The earlier recording is not comparable tick by tick.
// Re-recorded again for the heat model (2026-11-14, PR #107: no hull-skin cooling, converters draw power for the heat
// they convert, wing coefficient curve, heat paths without a capacity limit, regenerated examples). Every tick differs
// from the earlier recording from tick 0; two recordings in a row gave the same file.
// Re-recorded on cb92b28 (2026-11-15, PR #111, user decisions「1発ごとに各区画で判断」「排熱は被弾とも釣り合う」「自動全力運転は外す」
// and their physics-review fixes; examples regenerated so each weapon module carries shotW/bolt). The hash differs from
// tick 0 through the new per-tick state (the heat state's hit-heat filter, the incoming records' shot counts); the first
// numeric difference with KS_DETERMINISM_ALLOW_FLOAT=1 is tick 4, unit 0 crew 183.64 against 183 (casualties judged per
// shot instead of the whole tick's penetration as one shot). Two recordings in a row gave the same file (sha256 88608d79…).
// Re-recorded on 174ca47 (2026-11-16, user decision「シールドの吸収熱は無くして、単にシールドを生成する時に作動熱のみで」): the
// shield's absorbed share no longer heats the ship. First numeric difference with KS_DETERMINISM_ALLOW_FLOAT=1: tick 0,
// unit 0 digest[28] (heat store ht.qJ) 0 against 3.49e19 J. Two recordings in a row gave the same file (sha256 b245c89d…).
// Re-recorded on the tree committed as 6e8314d (core.js of 6aeadbd, examples regenerated) (2026-11-18, user decisions「今のシステムのまま、射撃の損失を下げよう」
// 「電力の5%損失に直す、そして出力はトン数に合わせる」: ENERGY_MODEL.eta .75 → .95, HEAT.waste.weapon .25 → .05,
// docs/weapon-heat-share.md). Guns charge with less input and leave less heat aboard. First numeric difference against the
// 69dc4aa recording with KS_DETERMINISM_ALLOW_FLOAT=1: tick 0, unit 0 digest[12] (u.energy, the charge held) 5.7733 against
// 6.3306. Two recordings in a row gave the same file (sha256 84ee4a28…).
// Re-recorded again the same day with the Imperial I/II main turrets holding three salvos (imperial, imperial2 regenerated;
// more stored charge and 0.06-0.07% more mass). Two recordings in a row gave the same file (sha256 db45f75c…).
// Re-recorded on b338e68 (FLEET_PROFILE_VERSION 24 → 25): against the recording above every digest number is within 1e-12
// (KS_DETERMINISM_ALLOW_FLOAT=1, 96 of 96 ticks); only the hashed state carries the new version. Two recordings in a row
// gave the same file (sha256 d91987d9…).
// Re-recorded on fd2ea6e (2026-11-18, user decisions「ミサイル、魚雷は実際に届いた時にして」
// 「ミサイル、魚雷も小型機と同じ扱いで点防御で撃墜できるように」, docs/missiles-arrive.md): missiles strike when they arrive.
// First numeric difference against the previous recording with KS_DETERMINISM_ALLOW_FLOAT=1: tick 0, unit 0 digest[9] (hp)
// 1832.351 against 1833.717 (no missile damage in the launch step). The battle state now holds b.missiles (not in the
// per-unit digest). Two recordings in a row gave the same file (sha256 1e7cd0ba…).
// Re-recorded on a6aa802 (2026-11-20, user instructions「着陸設備ではなくリパルサーリフトと改めた上で艦の重量分搭載して」
// 「航空機による対艦攻撃ができるくらいまで引き伸ばす形に」: examples regenerated on example model version 5 with repulsorlifts for
// every ship's mass (more mass, power draw and rooms), SHIELD_MODEL.debit .5 → .25). The difference against the previous
// recording was not broken down by field. Two recordings in a row gave the same file (sha256 d2ed7fbd…).
// Re-recorded on bb6c788 (2026-11-20, user decisions「リフトは船体内で。むしろ他のシステム系は構造物内でもいい」「緊急遮断でも
// リパルサーリフトは給電を続ける形。ただ長いと落ちる」and the physics-review fixes: lift rooms placed in the hull proper, the support the
// lift rooms took made up, examples regenerated). Not broken down by field. Two recordings in a row gave the same file (sha256 2d40f015…).
// Every tick must match its full-state hash exactly. Only with
// KS_DETERMINISM_ALLOW_FLOAT=1 (for a reviewed change of floating-point
// summation order) may a mismatching tick pass instead with every digest
// number within 1e-12 relative; the count of inexact ticks is reported.
// Recorded with Node v22.23.5 (v22.23.4 until 2026-11-18); Math.* may differ on other V8s.
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
