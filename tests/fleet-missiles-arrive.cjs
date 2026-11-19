// User decisions 2026-11-17「ミサイル、魚雷は実際に届いた時にして。航空機と同じ扱い」and 2026-11-18「ミサイル、魚雷も小型機と同じ扱いで
// 点防御で撃墜できるように」(docs/missiles-arrive.md): in a fleet battle a launch puts a salvo into b.missiles; it flies, point
// defence shoots at it while it is within reach, and only what arrives strikes the hull. A salvo that runs out of range, or whose target is gone, delivers nothing. The trial's flown ship
// (opts.boltGuns) keeps the launch-time record the trial flies itself (v27, tests/gun-hit-in-space.cjs).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
const hullOf=g=>g.sec.reduce((n,x)=>n+x.s,0);/* 2026-11-19 (PR #119, v30: the ship-wide u.hp is retired; regression review): the hull's state is the sum of its sections' structure (sec.s), which is what damage and repair now change. The comparisons and their margins are unchanged. */
// An MC75 (twelve shipMsl launchers, 72 rounds) with its guns removed, and a stationary Dreadnaught that holds its fire.
// 2026-11-19 expectation changed: `tough` multiplies the target's section structure by 1e6. Under the v30 section damage
// (docs/damage-penetration.md:60,90; the stored launchers still strike at 25 TT a round, handoff-2026-11-19/README.md:267)
// the first twelve rounds sink the Dreadnaught and the rest are lost with their target, so the cases that count every
// round arriving need a target that stays afloat. The flight and arrival rules they check are unchanged.
function duel(distance,{pd=false,target='dreadnaught',tough=false}={}){
 const pa=plain(F.designs.mc75.p);pa.gunArcs=pa.gunArcs.map(()=>0);pa.ionArcs=(pa.ionArcs||[]).map(()=>0);
 const a=C.fleetUnit('a','mc75',pa,0),b=C.fleetUnit('b',target,plain(F.designs[target].p),1);b.pos=[distance,0,0];b.yaw=Math.PI;if(tough)for(const x of b.sec){x.max*=1e6;x.s=x.max;}
 a.order={...a.order,type:'hold',target:'b',fire:true};b.order={...b.order,type:'hold',fire:false,autoPointDefense:pd};
 const B=C.fleetBattle([a,b],true);B.seed=7;return {a,b,B,rounds:()=>a.ammo.reduce((n,v)=>n+(v||0),0)};
}
// hp is re-summed from the hull sections each step: untouched means equal within rounding
const same=(a,b,m)=>assert.ok(Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b)),`${m||''} ${a} != ${b}`);
const tick=(B,seconds,opts={})=>{const shots=[];for(let t=0;t<seconds-1e-9;t+=.25)shots.push(...C.fleetTick(B,.25,opts));return shots;};

test('a launch strikes nothing until the salvo has flown to its target',()=>{
 const f=duel(30000,{tough:true}),hp=hullOf(f.b),rounds=f.rounds(),shots=tick(f.B,5);
 assert.ok(f.rounds()<rounds,'rounds left the magazines');assert.ok(f.B.missiles.length>0,'salvos are in flight');same(hullOf(f.b),hp,'no damage while they fly');
 assert.ok(shots.some(s=>s.from==='a'&&s.msl>0&&s.launches?.length),'the launch is on the shot record');
 for(const m of f.B.missiles){assert.equal(m.target,'b');assert.equal(m.from,'a');assert.ok(m.traveled>0&&m.traveled<30000);assert.ok(m.pos[0]>0&&m.pos[0]<30000,'on its way: '+m.pos[0]);}
 // 2026-11-19 expectation changed: a missile now tops out at 1500 m/s (ROUND_SPEED; user decision 2026-11-18
 // 「ミサイルの速度は航空機と同程度」, docs/damage-penetration.md:120,128; it was 2600 m/s), so 30 km at 220 m/s rising by
 // 650 m/s² takes about 20 s (was about 13 s). The hull is the sum of the sections' structure in TT (a Dreadnaught section
 // is about 1e-4 TT), so "struck" is a relative drop, not the old hp-1.
 tick(f.B,13);same(hullOf(f.b),hp,'still none at 18 s');tick(f.B,4);assert.ok(hullOf(f.b)<hp*(1-1e-9),'the first salvo has struck by 22 s');
 tick(f.B,45);assert.equal(f.B.missiles.length,0);assert.equal(f.rounds(),0);
 assert.ok(Math.abs(f.B.missileLog.hit-rounds)<1e-9,'with no point defence every round arrived: '+JSON.stringify(f.B.missileLog));assert.equal(f.B.missileLog.downed,0);
});

test('a round that steps across the target\'s reach lands instead of circling it',()=>{
 // 2026-11-18: judged at the start of a 0.25 s step (650 m at full speed against a reach of 300 m) a third of these rounds
 // flew past the 600 m ship until their motors ran out.
 for(const distance of [29000,30000,30300,31000]){const f=duel(distance,{tough:true}),rounds=f.rounds();tick(f.B,60);assert.ok(Math.abs(f.B.missileLog.hit-rounds)<1e-9,distance+' m: '+JSON.stringify(f.B.missileLog));}
});

test('a salvo that runs out of range delivers nothing',()=>{
 const f=duel(30000),hp=hullOf(f.b);tick(f.B,3);assert.ok(f.B.missiles.length>0);
 f.b.pos=[400000,0,0];f.a.order={...f.a.order,fire:false};tick(f.B,40);
 assert.equal(f.B.missiles.length,0,'spent');same(hullOf(f.b),hp);assert.equal(f.B.missileLog,undefined,'nothing arrived');
});

test('a salvo whose target is gone is lost with it',()=>{
 const f=duel(30000);tick(f.B,3);assert.ok(f.B.missiles.length>0);f.b.dead=true;tick(f.B,.25);assert.equal(f.B.missiles.length,0);
});

test('point defence shoots the salvo down in flight, not at the launch',()=>{
 // 2026-11-19 expectation changed: tough targets (see duel), so the unguarded Munificent is not sunk before its rounds are counted.
 const open=duel(20000,{target:'munificent',tough:true}),held=duel(20000,{target:'munificent',pd:true,tough:true});
 tick(open.B,3);tick(held.B,3);
 const sum=B=>B.missiles.reduce((n,m)=>n+m.n,0);assert.ok(sum(held.B)>0);assert.equal(sum(held.B),sum(open.B),'nothing is taken at the launch');
 tick(open.B,40);tick(held.B,40);
 assert.equal(open.B.missileLog.downed,0);assert.ok(held.B.missileLog.downed>0,'point defence shot some down: '+JSON.stringify(held.B.missileLog));
 assert.ok(held.B.missileLog.hit<open.B.missileLog.hit);assert.ok(Math.abs(held.B.missileLog.hit+held.B.missileLog.downed-open.B.missileLog.hit)<1e-9,'every round either arrived or was shot down');
});

test('missiles at the trial\'s flown ship keep the launch record the trial flies itself',()=>{
 const f=duel(30000);f.b.manual=true;const shots=tick(f.B,3,{boltGuns:new Set(['b'])});
 assert.equal((f.B.missiles||[]).length,0,'no salvo in the battle');assert.ok(shots.some(s=>s.from==='a'&&s.mdmg&&(s.mdmg.direct>0)),'the shot record carries the damage to deliver');
});

test('a salvo carries the part its ship aims at and the range it aimed from',()=>{
 // Physics review 2026-11-18: launch-time missile damage was aimed from the launching ship; the share held on an exposed
 // mark (aimHold) falls with that range. Judged from where the round comes in (a few hundred metres out) the whole strike
 // would go to the mark.
 const f=duel(30000);f.a.order={...f.a.order,aim:'bridge'};tick(f.B,3);assert.ok(f.B.missiles.length>0);for(const m of f.B.missiles){assert.equal(m.aim,'bridge');assert.ok(Math.abs(m.aimRange-30000)<1);}
 const g=duel(30000);tick(g.B,3);for(const m of g.B.missiles){assert.equal(m.aim,undefined,'no order, no aim');assert.equal(m.aimRange,undefined);}
 // the same strike from 500 m out, with and without the launch range, against the launch-time strike from 30 km
 const t=f.b,amt={direct:100,shot:25},far=C.combatIncoming(),near=C.combatIncoming(),kept=C.combatIncoming();
 C.combatAdd(far,t,[0,0,0],{...amt},'bridge','a');C.combatAdd(near,t,[t.pos[0]-500,0,0],{...amt},'bridge','a');C.combatAdd(kept,t,[t.pos[0]-500,0,0],{...amt,aimRange:30000},'bridge','a');
 const share=inc=>(inc.snipe?.bridge||0)/inc.aim.bridge;assert.ok(share(far)>0&&share(far)<1,'at 30 km part of the strike holds the mark: '+share(far));
 assert.ok(Math.abs(share(kept)-share(far))<1e-12,'the arriving salvo holds what the launch range gives');assert.ok(share(near)>share(far)*2,'without it the close-in point would hold far more: '+share(near));
 assert.ok(Math.abs(share(far)-C.aimHold(t,'bridge',30000))<1e-12);
});

test('the arriving salvo uses its launch range: without it the strike gathers on the bridge',()=>{
 // Physics review 2026-11-18: the two checks above test the salvo and combatAdd apart; this one goes through the arrival.
 // one volley of twelve rounds at an Imperial I, so the bridge is hurt but not gone
 const bridge=(tamper)=>{const f=duel(30000,{target:'imperial'});f.a.order={...f.a.order,aim:'bridge'};for(let t=0;t<40;t+=.25){C.fleetTick(f.B,.25,{});if(f.B.missiles.length)f.a.order={...f.a.order,fire:false};if(tamper)for(const m of f.B.missiles)delete m.aimRange;}
  const idx=f.b.p.modules.map((m,i)=>m.k==='bridge'?i:-1).filter(i=>i>=0);assert.ok(idx.length,'the target has a bridge module');assert.ok(f.B.missileLog.hit>0);return {left:idx.reduce((n,i)=>n+f.b.mods[i],0)/idx.length,hit:f.B.missileLog.hit};};
 const kept=bridge(false),lost=bridge(true);assert.equal(kept.hit,lost.hit);assert.ok(kept.left>0&&lost.left<kept.left-1e-6,`bridge left ${kept.left} with the launch range, ${lost.left} judged from where the ${kept.hit} rounds came in`);
});

test('an AI ship that aims at a large target\'s bridge sends its missiles there too',()=>{
 // fleetAim(u,t,true): a target 2.5 times the ship's size or more with its shields down to 92% or less
 const pa=plain(F.designs.arquitens.p);pa.gunArcs=pa.gunArcs.map(()=>0);pa.ionArcs=(pa.ionArcs||[]).map(()=>0);
 const a=C.fleetUnit('a','arquitens',pa,0),b=C.fleetUnit('b','imperial',plain(F.designs.imperial.p),1);b.pos=[30000,0,0];b.yaw=Math.PI;b.shield=b.shieldMax*.5;
 a.order={...a.order,type:'hold',target:'b',fire:true};b.order={...b.order,type:'hold',fire:false,autoPointDefense:false};const B=C.fleetBattle([a,b],true);B.seed=7;
 assert.equal(C.fleetAim(a,b,true),'bridge');tick(B,3);assert.ok(B.missiles.length>0);for(const m of B.missiles){assert.equal(m.aim,'bridge');assert.ok(m.aimRange>29000);}
});

test('salvos in flight carry over a committed turn of the fleet battle screen',()=>{
 // 2026-11-19 expectation changed: tough target (see duel); "struck" is a relative drop of the sections' TT, not hp-1.
 const f=duel(30000,{tough:true}),hp=hullOf(f.b);f.B.seconds=5;
 const first=C.fleetCommit(f.B);assert.ok(first.missiles.length>0,'in flight at the end of the turn');assert.ok(first.frames.at(-1).missiles.length>0,'and in the frames for the replay');
 assert.equal((f.B.missiles||[]).length,0,'planning state untouched until the turn is finished');assert.ok(C.fleetFinish(f.B));assert.equal(f.B.missiles.length,first.missiles.length);same(hullOf(f.B.units.find(u=>u.id==='b')),hp);
 f.B.seconds=20;C.fleetCommit(f.B);C.fleetFinish(f.B);assert.ok(hullOf(f.B.units.find(u=>u.id==='b'))<hp*(1-1e-9),'they struck in the next turn');
 const ids=new Set();f.B.seconds=5;for(const m of first.missiles){assert.ok(!ids.has(m.id));ids.add(m.id);}
});
