// User decision 2026-11-16「艦載機の挙動は艦載機として設定されるのではなく実際に設計された小型艦船として発艦して航行して射撃して着艦する
// 形に」(docs/craft-as-ships.md): a craft design's own profile flies in the fleet model as a unit. It attacks in passes, lands
// through a hangar mouth by the dock order, and is shot down by the craft-scale rules (a bolt that lands downs it with
// CRAFT_HIT.kill; a ship's point defence downs craft at the missiles' rate, a channel's share for each flight in reach).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
const profiles=new Map(),craftP=k=>{if(!profiles.has(k)){const s=C.buildDesign(k),S=C.computeStats(s);profiles.set(k,plain(C.fleetProfile(S,s.name,s)));}return plain(profiles.get(k));};
const craft=(id,key,team)=>C.fleetUnit(id,key,craftP(key),team),ship=(id,key,team)=>C.fleetUnit(id,key,plain(F.designs[key].p),team);
const dist=(a,b)=>C.len(C.sub(a.pos,b.pos)),tick=(B,s,opts={},each=null)=>{for(let t=0;t<s-1e-9;t+=.25){C.fleetTick(B,.25,opts);if(each&&each(t)===false)break;}};

test('a craft design\'s profile is marked as a craft and a ship\'s is not',()=>{
 assert.equal(C.craftUnit(craft('x','craft_xwing',0)),true);assert.equal(C.craftUnit(ship('s','cr90',0)),false);
 const x=craft('x','craft_xwing',0);assert.ok(C.craftPassSpeed(x)<=x.p.maxSpeed);assert.ok(Math.abs(C.craftPassSpeed(x)/x.p.turnRate-C.CRAFT_PASS.radius)<1e-6,'a 1.5 km turn at its turn rate');
});

test('a craft attacks in passes: it runs in, skims the hull, flies on, and comes round again without stopping',()=>{
 const x=craft('x','craft_xwing',0),f=ship('f','cr90',1);f.pos=[6000,0,0];f.yaw=Math.PI;f.order={...f.order,type:'hold',fire:false};x.order={...x.order,type:'attack',target:'f',fire:true};
 const B=C.fleetBattle([x,f],true);B.seed=3;let passes=0,last='in',nearest=Infinity,slowest=Infinity,far=0,inside=false;const vp=C.craftPassSpeed(x);
 tick(B,240,{},t=>{const d=dist(x,f);nearest=Math.min(nearest,d);if(t>20){slowest=Math.min(slowest,C.len(x.velocity));far=Math.max(far,d);}if(x.pass.phase!==last){last=x.pass.phase;if(last==='out')passes++;}
  const l=C.dockWorldToLocal(f,x.pos),h=[f.p.len/2,(f.p.height||f.p.len*.2)/2,(f.p.width||f.p.len*.35)/2];if(Math.abs(l[0])<h[0]&&Math.abs(l[1])<h[1]&&Math.abs(l[2])<h[2])inside=true;});
 assert.ok(passes>=5,'at least five passes in four minutes: '+passes);assert.ok(nearest<300,'it passes close: '+nearest);assert.equal(inside,false,'it does not fly through the hull box');
 assert.ok(slowest>=vp*C.CRAFT_PASS.slow*.9,'it never stops to shoot (a ship would stand off and hold): '+slowest);assert.ok(far<f.p.len/2+C.CRAFT_PASS.extend+C.CRAFT_PASS.radius*(C.CRAFT_PASS.turns+2.2),'it turns back within a few turn radii: '+far);
 assert.equal(x.dead,false);assert.equal(f.dead,false);
});

test('a ship ordered to attack still stands off (the passes are for craft)',()=>{
 const a=ship('a','cr90',0),f=ship('f','dreadnaught',1);f.pos=[30000,0,0];f.order={...f.order,type:'hold',fire:false};a.order={...a.order,type:'attack',target:'f',fire:false};
 const B=C.fleetBattle([a,f],true);B.seed=3;tick(B,400);assert.equal(a.pass,undefined);assert.ok(dist(a,f)>1000,'it holds off: '+dist(a,f));assert.ok(C.len(a.velocity)<30,'and comes to rest: '+C.len(a.velocity));
});

test('a craft lands in an unmodified Venator through a hangar mouth by the dock order, rides with it and is resupplied',()=>{
 const h=ship('h','venator',0),x=craft('x','craft_xwing',0);h.order={...h.order,type:'hold',fire:false,launch:false};x.pos=[9000,300,2500];x.yaw=Math.PI;x.energy=0;
 x.order={...x.order,type:'dock',target:'h',fire:false};const B=C.fleetBattle([h,x],false);B.seed=3;const hostAt=h.pos.slice();
 tick(B,300,{},()=>!x.docked);assert.ok(x.docked,'docked within five minutes (hull avoidance kept it out before v29)');assert.equal(x.docked.host,'h');assert.equal(C.dockState(h,x).inside,true);
 assert.ok(C.len(C.sub(h.pos,hostAt))<50,'the host did not steer away from it: '+C.len(C.sub(h.pos,hostAt)));
 tick(B,120);assert.ok(x.energy>=x.p.wCap*.8,'weapon energy refilled aboard');assert.ok(B.events.some(e=>/格納庫に入渠/.test(e.text)));
});

test('a bolt that lands on a craft downs it with CRAFT_HIT.kill; the same seed gives the same fight',()=>{
 assert.equal(C.CRAFT_HIT.kill,.5);
 const duel=seed=>{const x=craft('x','craft_xwing',0),f=craft('f','craft_tie_ln',1);f.pos=[6000,0,0];f.yaw=Math.PI;f.order={...f.order,type:'attack',target:'x',fire:true};x.order={...x.order,type:'attack',target:'f',fire:true};
  const B=C.fleetBattle([x,f],true);B.seed=seed;let at=null;tick(B,600,{},t=>{if(x.dead||f.dead){at=t;return false;}});return {at,x:x.dead,f:f.dead,events:B.events.map(e=>e.text)};};
 const a=duel(3),b=duel(3);assert.deepEqual(a,b,'deterministic');assert.ok(a.at!=null,'one of them went down within ten minutes');assert.ok(a.events.some(t=>/撃墜（被弾）/.test(t)),JSON.stringify(a.events));
 let decided=0,sum=0;for(let s=1;s<=20;s++){const r=duel(s*7919);if(r.at!=null){decided++;sum+=r.at;}}assert.ok(decided>=18,'nearly every duel is decided: '+decided);assert.ok(sum/decided>3&&sum/decided<240,'in seconds to minutes, not at once and not never: '+sum/decided);
});

test('without the rule a craft could not be shot down by craft guns (hull strength is floored at 1 TT a section)',()=>{
 const x=craft('x','craft_xwing',0);assert.ok(x.hp>=1,'hull '+x.hp+' TT');assert.ok(C.fleetShotTT(x)<1e-7,'a bolt is '+C.fleetShotTT(x)+' TT');
});

test('a ship\'s point defence downs craft in reach at a channel\'s share for each flight; craft out of reach or docked are safe',()=>{
 const P=plain(F.designs.dreadnaught.p),rate=C.MISSILE_FLIGHT.pdKill*P.aa/P.aaCh,T=10,expected=1-Math.exp(-rate*T);
 const run=(seed,place)=>{const s=C.fleetUnit('s','dreadnaught',plain(P),1),x=craft('x','craft_xwing',0);s.order={...s.order,type:'hold',fire:false,autoPointDefense:true};x.order={...x.order,type:'hold',fire:false};place(x,s);const B=C.fleetBattle([s,x],true);B.seed=seed;tick(B,T,{},()=>!x.dead);return x.dead;};
 let down=0;const N=200;for(let i=1;i<=N;i++)if(run(i*104729,x=>{x.pos=[3000,0,0];}))down++;
 assert.ok(Math.abs(down/N-expected)<.12,`downed ${down}/${N} in ${T} s, expected ${expected.toFixed(3)} (rate ${rate.toFixed(4)}/s)`);
 let far=0;for(let i=1;i<=40;i++)if(run(i*104729,x=>{x.pos=[C.MISSILE_FLIGHT.pdRange+P.len/2+500,0,0];}))far++;assert.equal(far,0,'out of reach');
 // four craft in reach share one channel
 const four=seed=>{const s=C.fleetUnit('s','dreadnaught',plain(P),1),xs=[0,1,2,3].map(i=>{const x=craft('x'+i,'craft_xwing',0);x.pos=[3000,0,i*200];x.order={...x.order,type:'hold',fire:false};return x;});s.order={...s.order,type:'hold',fire:false,autoPointDefense:true};const B=C.fleetBattle([s,...xs],true);B.seed=seed;tick(B,T);return xs.filter(x=>x.dead).length;};
 let lost=0;for(let i=1;i<=N;i++)lost+=four(i*15485863);// (the one channel keeps downing at its rate while any of the four is left: the losses are Poisson(rate·T), capped at four)
 let want=0,pk=Math.exp(-rate*T);for(let k=0;k<60;k++){want+=Math.min(4,k)*pk;pk*=rate*T/(k+1);}
 const mean=lost/N;assert.ok(Math.abs(mean-want)<.25,`four craft lose ${mean.toFixed(2)} in ${T} s, expected about ${want.toFixed(2)}`);assert.ok(mean<4*expected*.75,'far fewer than four lone craft would lose: '+mean);
 const off=(seed)=>{const s=C.fleetUnit('s','dreadnaught',plain(P),1),x=craft('x','craft_xwing',0);s.order={...s.order,type:'hold',fire:false,autoPointDefense:false};x.pos=[3000,0,0];x.order={...x.order,type:'hold',fire:false};const B=C.fleetBattle([s,x],true);B.seed=seed;tick(B,T);return x.dead;};
 let offDown=0;for(let i=1;i<=40;i++)if(off(i*104729))offDown++;assert.equal(offDown,0,'point defence switched off downs nothing');
});

test('the flown ship\'s bolts that strike a craft go through the same rule (opts.extra bolts)',()=>{
 const run=(seed,bolts)=>{const me=ship('me','cr90',0),x=craft('x','craft_tie_ln',1);me.manual=true;x.pos=[2000,0,0];x.order={...x.order,type:'hold',fire:false};const B=C.fleetBattle([me,x],true);B.seed=seed;
  C.fleetTick(B,.25,{extra:new Map(bolts?[['x',{sf:0,hull:0,direct:0,ion:0,ionDirect:0,aim:{},from:null,src:'me',bolts}]]:[])});return x.dead;};
 let one=0,none=0,eight=0;const N=400;for(let i=1;i<=N;i++){if(run(i*7919,1))one++;if(run(i*7919,0))none++;if(run(i*7919,8))eight++;}
 assert.equal(none,0);assert.ok(Math.abs(one/N-.5)<.08,'one bolt: '+one/N);assert.ok(eight/N>.98,'eight bolts: '+eight/N);
});

test('a battle with no craft units draws nothing from the battle\'s random sequence for these rules',()=>{
 const run=()=>{const a=ship('a','cr90',0),f=ship('f','nebulonb',1);f.pos=[8000,0,0];f.yaw=Math.PI;a.order={...a.order,type:'attack',target:'f',fire:true};f.order={...f.order,type:'attack',target:'a',fire:true};const B=C.fleetBattle([a,f],true);B.seed=11;tick(B,60);return B;};
 const B=run();assert.ok(!B.events.some(e=>/撃墜/.test(e.text)));
});

// Physics review 2026-11-18: the common model lands an expected number of bolts h (each shot hits with chance p, then downs with
// .kill), so a craft survives exp(-kill·h), not (1-kill)^h (that is 1.39 times as deadly); whole bolts the trial saw strike keep
// (1-kill)^n. The player's own craft is bolt-resolved (opts.boltGuns): enemy bolts reach the rule only through opts.extra.
test('expected hits from the common model down a craft at exp(-kill·h)',()=>{
 const shooter=()=>{const s=ship('s','nebulonb',1);s.pos=[4000,0,0];s.yaw=Math.PI;s.order={...s.order,type:'attack',target:'x',fire:true,autoPointDefense:false};return s;};
 // measure the expected bolts landed in one step with the craft kept alive (the rule's own bookkeeping, read through the shot record)
 const probe=shooter(),x0=craft('x','craft_xwing',0);x0.order={...x0.order,type:'hold',fire:false};const B0=C.fleetBattle([probe,x0],true);B0.seed=1;let landed=0;
 for(let i=0;i<8;i++){const shots=C.fleetTick(B0,.25,{});x0.dead=false;for(const q of shots)if(q.from==='s'&&q.to==='x'&&!q.screen&&!q.ff)landed+=(q.gun||0)/C.fleetShotTT(probe);}
 assert.ok(landed>0,'the frigate lands bolts on the craft: '+landed);const h=landed/8;
 let down=0;const N=600;for(let i=1;i<=N;i++){const s=shooter(),x=craft('x','craft_xwing',0);x.order={...x.order,type:'hold',fire:false};const B=C.fleetBattle([s,x],true);B.seed=i*7919;C.fleetTick(B,.25,{});if(x.dead)down++;}
 const want=1-Math.exp(-C.CRAFT_HIT.kill*h),old=1-Math.pow(1-C.CRAFT_HIT.kill,h);assert.ok(Math.abs(down/N-want)<.06,`downed ${down/N} in one step with ${h.toFixed(3)} expected bolts: want ${want.toFixed(3)} (the earlier formula gave ${old.toFixed(3)})`);
});

test('the flown craft is bolt-resolved: enemy bolts that reach it go through the rule by opts.extra',()=>{
 const run=(seed,bolts)=>{const me=craft('me','craft_xwing',0),f=craft('f','craft_tie_ln',1);me.manual=true;f.pos=[1500,0,0];f.yaw=Math.PI;f.order={...f.order,type:'attack',target:'me',fire:true};const B=C.fleetBattle([me,f],true);B.seed=seed;
  for(let i=0;i<40&&!me.dead;i++)C.fleetTick(B,.25,{boltGuns:new Set(['me']),extra:new Map(bolts&&i===0?[['me',{sf:0,hull:0,direct:0,ion:0,ionDirect:0,aim:{},from:null,src:'f',bolts}]]:[])});return me.dead;};
 let none=0,two=0;const N=200;for(let i=1;i<=N;i++){if(run(i*7919,0))none++;if(run(i*7919,2))two++;}
 assert.equal(none,0,'without bolts that reach it nothing is landed by the expected-hit model (ten seconds under fire)');assert.ok(Math.abs(two/N-.75)<.1,'two bolts: '+two/N);
});

test('a craft breaks off over a tall target too (the pass is judged on the point it runs in on)',()=>{
 const x=craft('x','craft_xwing',0),f=ship('f','cr90',1);f.p.height=900;f.p.width=900;f.pos=[6000,0,0];f.order={...f.order,type:'hold',fire:false};x.order={...x.order,type:'attack',target:'f',fire:false};
 const B=C.fleetBattle([x,f],true);B.seed=3;let out=0,last='in';tick(B,200,{},()=>{if(x.pass.phase!==last){last=x.pass.phase;if(last==='out')out++;}});assert.ok(out>=3,'passes over a 900 m tall target: '+out);
});
