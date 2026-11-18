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
 // user decision 2026-11-18: cruise speed always, top speed only when it must (chasing a target under way beyond its guns' reach, going home hurt)
 const x=craft('x','craft_xwing',0),f=ship('f','cr90',1);assert.ok(Math.abs(C.craftPassSpeed(x)-x.p.maxSpeed*.7)<1e-9,'cruise is 70% of top speed');
 x.order={...x.order,type:'attack',target:'f'};f.pos=[20000,0,0];assert.equal(C.craftWantSpeed(x,f),C.craftCruiseSpeed(x),'a target at rest: cruise');
 f.velocity=[x.p.maxSpeed*.5,0,0];assert.equal(C.craftWantSpeed(x,f),x.p.maxSpeed,'a target making way beyond its guns: top speed');f.pos=[3000,0,0];assert.equal(C.craftWantSpeed(x,f),C.craftCruiseSpeed(x),'within its guns: cruise');
 x.order={...x.order,type:'dock',target:'h'};assert.equal(C.craftWantSpeed(x,null),C.craftCruiseSpeed(x));for(const q of x.sec)q.s=q.max*.3;assert.equal(C.craftWantSpeed(x,null),x.p.maxSpeed,'going home hurt: top speed');
});

test('a craft attacks in passes: it runs in, skims the hull, flies on, and comes round again without stopping',()=>{
 const x=craft('x','craft_xwing',0),f=ship('f','cr90',1);f.pos=[6000,0,0];f.yaw=Math.PI;f.order={...f.order,type:'hold',fire:false};x.order={...x.order,type:'attack',target:'f',fire:true};
 const B=C.fleetBattle([x,f],true);B.seed=3;let passes=0,last='in',nearest=Infinity,slowest=Infinity,far=0,inside=false;const vp=C.craftPassSpeed(x);
 tick(B,240,{},t=>{const d=dist(x,f);nearest=Math.min(nearest,d);if(t>20){slowest=Math.min(slowest,C.len(x.velocity));far=Math.max(far,d);}if(x.pass.phase!==last){last=x.pass.phase;if(last==='out')passes++;}
  const l=C.dockWorldToLocal(f,x.pos),h=[f.p.len/2,(f.p.height||f.p.len*.2)/2,(f.p.width||f.p.len*.35)/2];if(Math.abs(l[0])<h[0]&&Math.abs(l[1])<h[1]&&Math.abs(l[2])<h[2])inside=true;});
 assert.ok(passes>=5,'at least five passes in four minutes: '+passes);assert.ok(nearest<300,'it passes close: '+nearest);assert.equal(inside,false,'it does not fly through the hull box');
 assert.ok(slowest>=vp*C.CRAFT_PASS.slow*.9,'it never stops to shoot (a ship would stand off and hold): '+slowest);const R=vp/x.p.turnRate;assert.ok(far<f.p.len/2+C.CRAFT_PASS.extend+R*(C.CRAFT_PASS.turns+2.2),'it turns back within a few turn radii: '+far);
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

test('a battle with no craft units draws nothing from the battle\'s random sequence for these rules',()=>{
 const run=()=>{const a=ship('a','cr90',0),f=ship('f','nebulonb',1);f.pos=[8000,0,0];f.yaw=Math.PI;a.order={...a.order,type:'attack',target:'f',fire:true};f.order={...f.order,type:'attack',target:'a',fire:true};const B=C.fleetBattle([a,f],true);B.seed=11;tick(B,60);return B;};
 const B=run();assert.ok(!B.events.some(e=>/撃墜/.test(e.text)));
});

test('a craft breaks off over a tall target too (the pass is judged on the point it runs in on)',()=>{
 const x=craft('x','craft_xwing',0),f=ship('f','cr90',1);f.p.height=900;f.p.width=900;f.pos=[6000,0,0];f.order={...f.order,type:'hold',fire:false};x.order={...x.order,type:'attack',target:'f',fire:false};
 const B=C.fleetBattle([x,f],true);B.seed=3;let out=0,last='in';tick(B,200,{},()=>{if(x.pass.phase!==last){last=x.pass.phase;if(last==='out')out++;}});assert.ok(out>=3,'passes over a 900 m tall target: '+out);
});

// v30 (docs/damage-penetration.md): no kill chance and no durability figure. A craft falls to gun fire as any hull does: the bolts
// bore its structure and modules by their density, and it is lost when what they destroy breaks it.
test('a craft without a field falls to another craft\'s lasers by the damage they do; the same seed gives the same fight',()=>{
 const duel=seed=>{const x=craft('x','craft_xwing',0),f=craft('f','craft_tie_ln',1);f.pos=[6000,0,0];f.yaw=Math.PI;f.order={...f.order,type:'hold',fire:false};x.order={...x.order,type:'attack',target:'f',fire:true};
  const B=C.fleetBattle([x,f],true);B.seed=seed;let at=null;tick(B,600,{},t=>{if(f.dead){at=t;return false;}});return {at,events:B.events.map(e=>e.text)};};
 const a=duel(5),b=duel(5);assert.deepEqual(a,b,'deterministic');assert.ok(a.at!=null&&a.at>1,'the TIE is destroyed within ten minutes, not at the first bolt: '+a.at);
 assert.ok(a.events.some(t=>/破壊|崩壊/.test(t))&&a.events.some(t=>/撃沈/.test(t)),JSON.stringify(a.events.slice(-4)));assert.ok(!a.events.some(t=>/撃墜（被弾）/.test(t)),'no kill-chance rule');
});
test('nothing carries a durability figure: what destroys a module or a section follows from its mass',()=>{
 const x=craft('x','craft_xwing',0),s=ship('s','imperial',0);assert.equal(x.hp,undefined);assert.equal(s.hp,undefined);assert.equal(C.CRAFT_HIT,undefined);
 for(const u of [x,s]){const H=C.hullStructure(u.p);u.sec.forEach((q,i)=>{assert.ok(Math.abs(q.max-C.PEN.eps*H.sec[i].mass*C.PEN.destroyed)<=1e-12*q.max,'section '+i);});
  for(const m of u.p.modules)if(m.k!=='hull')assert.ok(Math.abs(C.modBreakTT(u.p,m)-C.PEN.eps*C.modDens(m)*C.modVol(u.p,m)*C.PEN.destroyed)<1e-30);}
 // a denser layer stops a shot sooner; a hole wider than the layer bores only the layer
 const e=1e-6,A=C.holeArea(e),thin=C.boreLayer(e,1,A,.4,10,1e9),dense=C.boreLayer(e,1,A,7.8,10,1e9);assert.ok(dense.left<thin.left,'density decides how far it gets');assert.ok(C.holeArea(1)>C.holeArea(1e-6)*1e3,'a bigger shot bores a wider hole');
 const cap=C.boreLayer(1,1,C.holeArea(1),1,10,50);assert.ok(Math.abs(cap.volume-50)<1e-9&&cap.left>0,'the layer is the limit');
});
