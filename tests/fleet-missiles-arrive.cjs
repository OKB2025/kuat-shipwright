// User decision 2026-11-17「ミサイル、魚雷は実際に届いた時にして。航空機と同じ扱い」(docs/missiles-arrive.md): in a fleet battle a
// launch puts a salvo into b.missiles; it flies, the target's point defence takes its share as it arrives, and only then is
// the hull struck. A salvo that runs out of range, or whose target is gone, delivers nothing. The trial's flown ship
// (opts.boltGuns) keeps the launch-time record the trial flies itself (v27, tests/gun-hit-in-space.cjs).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
// An MC75 (twelve shipMsl launchers, 72 rounds) with its guns removed, and a stationary Dreadnaught that holds its fire.
function duel(distance,{pd=false,target='dreadnaught'}={}){
 const pa=plain(F.designs.mc75.p);pa.gunArcs=pa.gunArcs.map(()=>0);pa.ionArcs=(pa.ionArcs||[]).map(()=>0);
 const a=C.fleetUnit('a','mc75',pa,0),b=C.fleetUnit('b',target,plain(F.designs[target].p),1);b.pos=[distance,0,0];b.yaw=Math.PI;
 a.order={...a.order,type:'hold',target:'b',fire:true};b.order={...b.order,type:'hold',fire:false,autoPointDefense:pd};
 const B=C.fleetBattle([a,b],true);B.seed=7;return {a,b,B,rounds:()=>a.ammo.reduce((n,v)=>n+(v||0),0)};
}
// hp is re-summed from the hull sections each step: untouched means equal within rounding
const same=(a,b,m)=>assert.ok(Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b)),`${m||''} ${a} != ${b}`);
const tick=(B,seconds,opts={})=>{const shots=[];for(let t=0;t<seconds-1e-9;t+=.25)shots.push(...C.fleetTick(B,.25,opts));return shots;};

test('a launch strikes nothing until the salvo has flown to its target',()=>{
 const f=duel(30000),hp=f.b.hp,rounds=f.rounds(),shots=tick(f.B,5);
 assert.ok(f.rounds()<rounds,'rounds left the magazines');assert.ok(f.B.missiles.length>0,'salvos are in flight');same(f.b.hp,hp,'no damage while they fly');
 assert.ok(shots.some(s=>s.from==='a'&&s.msl>0&&s.launches?.length),'the launch is on the shot record');
 for(const m of f.B.missiles){assert.equal(m.target,'b');assert.equal(m.from,'a');assert.ok(m.traveled>0&&m.traveled<30000);assert.ok(m.pos[0]>0&&m.pos[0]<30000,'on its way: '+m.pos[0]);}
 // 30 km at 220 m/s rising by 650 m/s² to 2600 m/s takes about 13 s
 tick(f.B,7);same(f.b.hp,hp,'still none at 12 s');tick(f.B,3);assert.ok(f.b.hp<hp-1,'the first salvo has struck by 15 s');
 tick(f.B,45);assert.equal(f.B.missiles.length,0);assert.equal(f.rounds(),0);
 assert.ok(Math.abs(f.B.missileLog.hit-rounds)<1e-9,'with no point defence every round arrived: '+JSON.stringify(f.B.missileLog));assert.equal(f.B.missileLog.downed,0);
});

test('a round that steps across the target\'s reach lands instead of circling it',()=>{
 // 2026-11-18: judged at the start of a 0.25 s step (650 m at full speed against a reach of 300 m) a third of these rounds
 // flew past the 600 m ship until their motors ran out.
 for(const distance of [29000,30000,30300,31000]){const f=duel(distance),rounds=f.rounds();tick(f.B,60);assert.ok(Math.abs(f.B.missileLog.hit-rounds)<1e-9,distance+' m: '+JSON.stringify(f.B.missileLog));}
});

test('a salvo that runs out of range delivers nothing',()=>{
 const f=duel(30000),hp=f.b.hp;tick(f.B,3);assert.ok(f.B.missiles.length>0);
 f.b.pos=[400000,0,0];f.a.order={...f.a.order,fire:false};tick(f.B,40);
 assert.equal(f.B.missiles.length,0,'spent');same(f.b.hp,hp);assert.equal(f.B.missileLog,undefined,'nothing arrived');
});

test('a salvo whose target is gone is lost with it',()=>{
 const f=duel(30000);tick(f.B,3);assert.ok(f.B.missiles.length>0);f.b.dead=true;tick(f.B,.25);assert.equal(f.B.missiles.length,0);
});

test('the target\'s point defence takes its share when the salvo arrives, not at the launch',()=>{
 const open=duel(20000,{target:'munificent'}),held=duel(20000,{target:'munificent',pd:true});
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

test('salvos in flight carry over a committed turn of the fleet battle screen',()=>{
 const f=duel(30000),hp=f.b.hp;f.B.seconds=5;
 const first=C.fleetCommit(f.B);assert.ok(first.missiles.length>0,'in flight at the end of the turn');assert.ok(first.frames.at(-1).missiles.length>0,'and in the frames for the replay');
 assert.equal((f.B.missiles||[]).length,0,'planning state untouched until the turn is finished');assert.ok(C.fleetFinish(f.B));assert.equal(f.B.missiles.length,first.missiles.length);same(f.B.units.find(u=>u.id==='b').hp,hp);
 f.B.seconds=20;C.fleetCommit(f.B);C.fleetFinish(f.B);assert.ok(f.B.units.find(u=>u.id==='b').hp<hp-1,'they struck in the next turn');
 const ids=new Set();f.B.seconds=5;for(const m of first.missiles){assert.ok(!ids.has(m.id));ids.add(m.id);}
});
