// User decisions of 2026-11-12 (docs/heat-converters.md): the hull skin removes no heat; heat-energy
// converters (hdis inside the hull, wing discharge surfaces outside) take every heat grade; a wing's
// capacity scales with its exposed discharge area; converters draw electricity in proportion to the
// heat they actually convert, and that input is heat aboard counted once.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),context,{filename:f});
const C=vm.runInContext('Core',context),near=(a,b,k=1e-9,m='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-30,Math.abs(a),Math.abs(b))*k,`${m} ${a} != ${b}`);
function wingShip(){
 const s=C.newShip({L:8,W:4,H:2,assembly:true});
 const w=C.placePart(s,'struct',[4,1,3],[2,3,.06],{form:'box',wing:{thermal:'high',foil:true,axis:'x',open:15,stow:0,T:1}},false);
 C.placePart(s,'gen',[4,1,0],.5,{allowOverlap:true},false);C.placePart(s,'struct',[5.2,1,0],[.4,.4,.4],{form:'box'},false);C.placePart(s,'pump',[5.2,1,0],.15,{allowOverlap:true},false);
 return {s,w};
}
function boxShip(hdisD){
 const ship=C.newShip({L:40,W:24,H:20,plan:'rect',sec:'rect'},'Converter fixture');
 ship.parts=[{id:1,k:'gen',c:[30,10,0],d:2},{id:4,k:'pump',c:[30,10,3],d:.5},...(hdisD?[{id:2,k:'hdis',c:[20,10,0],d:hdisD}]:[])];ship.fits=[];ship.nextId=5;return ship;
}

test('the hull skin removes no heat and is not a sink in any network',()=>{
 assert.equal(C.HEAT.skinW,0);
 const S=C.computeStats(boxShip(0));assert.equal(S.heat.skin,0);assert.equal(S.heat.net.dis.length,0);
 const e=S.heat.presets.combat;assert.ok(e.gen>0);near(e.shortfallW,e.gen,1e-9,'all the heat is short');
});

test('hotel (low-grade) heat reaches an hdis converter, and every converter accepts every grade',()=>{
 const S=C.computeStats(boxShip(.6)),N=S.heat.net,j=N.dis.findIndex(d=>d.k==='hdis');
 assert.equal(N.dis[j].grade,'all');
 const hotel=N.src.map((s,i)=>[s,i]).filter(([s])=>s.k==='hotel').map(([,i])=>i);assert.ok(hotel.length);
 assert.ok(N.links.some(l=>hotel.includes(l.s)&&l.d===j),'a hotel source has a path to the converter');
 assert.equal(S.heat.presets.combat.shortfallW,0);
});

test('a heat shortfall names the converter volume and its electrical input',()=>{
 const S=C.computeStats(boxShip(.2)),e=S.heat.presets.combat,K=C.HEAT.disPowerK.hdis,density=C.REACTOR_POWER_DENSITY*C.HEAT.disK.hdis;
 assert.ok(e.shortfallW>0);const capW=e.shortfallW/(1-K*(1+C.HEAT.waste.reactor));
 near(e.addConverterCapW,capW);near(e.addConverterM3,capW/density);near(e.addConverterW,capW*K);
 const w=S.warnings.find(w=>w.code==='heat'&&/不足/.test(w.text));assert.ok(w,'the inspection reports the shortfall');assert.match(w.text,/熱エネルギー変換装置を約 .* m³ 追加/);assert.match(w.text,/消費電力/);
 const big=C.converterShortfall(1e20,{supplyW:1e18,drawW:1e18-1});assert.ok(big.powerShortW>0,'the added converters can exceed the plant spare output');
});

test('a wing converter capacity scales with its discharge area, not its volume',()=>{
 const {s,w}=wingShip(),S=C.computeStats(s),A=C.wingDischargeArea(w);
 near(C.wingCap(w,S,1),A*C.wingDischargeW(),1e-12,'rating per m²');
 near(C.wingDischargeW(),C.REACTOR_POWER_DENSITY*C.HEAT.disK.hdis*C.WING.dischargeDepthM,1e-12);
 const wide=JSON.parse(C.publicJSON(w));wide.s[1]*=2;near(C.wingCap(wide,S,1)/C.wingCap(w,S,1),C.wingDischargeArea(wide)/A,1e-12,'area ratio');
 const thick=JSON.parse(C.publicJSON(w));thick.s[2]*=4;assert.ok(C.partVolume(thick)>C.partVolume(w)*3);
 assert.ok(C.wingCap(thick,S,1)/C.wingCap(w,S,1)<C.partVolume(thick)/C.partVolume(w),'thickening the wing does not scale capacity with volume');
 near(C.wingCap(w,S,.5),C.wingCap(w,S,1)/2,1e-12,'exposed share');
});

test('an S-foil converts less with its foils closed than open',()=>{
 const {s,w}=wingShip(),S=C.computeStats(s),N=S.heat.net,d=N.dis.find(d=>d.part===w.id);
 assert.ok(d&&d.fo>=0&&d.cs<1);const row=S.wings.find(x=>x.id===w.id);assert.ok(row.capStow<row.capOpen);near(row.capStow,row.capOpen*C.WING.stowK.wing);
 for(const pr of ['cruise','combat','max'])if(S.heat.presets[pr].stow)assert.ok(S.heat.presets[pr].stow.cap<S.heat.presets[pr].cap);
});

test('converter input follows the heat actually converted and is itself heat aboard',()=>{
 const S=C.computeStats(boxShip(.6)),e=S.heat.presets.combat,K=C.HEAT.disPowerK.hdis,rated=S.dissipatorRatedPower;
 assert.ok(e.converterW>0&&e.converterW<rated*.99,'the input is below the rating when the converter is lightly loaded');
 assert.ok(Math.abs(e.converterW-K*e.out)<=K*K*e.out*1.5,'input = K × converted heat, within the one-pass error K² of the heat');near(S.dissipatorPower,e.converterW);
 assert.ok(['hdis','wing','radiator','solar'].every(k=>C.HEAT.disPowerK[k]===K),'one coefficient for every converter');
});

test('battle: the reservation follows this step\'s requested loads through the real paths, not the rating',()=>{
 const K=C.HEAT.disPowerK.hdis,hd=C.HEAT.coolingHeadroom;
 // a wing far from the guns and an hdis on the guns' own path (auto links): the hdis must not be starved
 const H={src:[{k:'weapon',sh:1},{k:'hotel',sh:1}],dis:[{k:'hdis',id:'p1',cap:100,power:100*K,m:0},{k:'wing',id:'p2',cap:1e6,power:1e6*K,m:1}],ln:[{s:0,d:0,cap:1e9},{s:1,d:1,cap:1e9}]};
 const u={p:{grid:{P:1000,fixed:10,cooling:0,De:0}},ht:{qJ:0}},d=Array.from(C.coolingDemandW(u,H,{weapons:200,shields:0,throttle:0}));
 const gun=200*C.HEAT.waste.weapon,reactor=C.HEAT.waste.reactor*210;
 near(d[0],gun*K*hd,1e-3,'the hdis on the gun path is funded for all the gun heat that reaches it');
 near(d[1],(10+reactor)*K*hd,1e-3,'the wing is funded for the hotel heat and the reactor loss');
 const small=Array.from(C.coolingDemandW(u,{...H,dis:[{...H.dis[0],cap:20,power:20*K},H.dis[1]]},{weapons:200,shields:0,throttle:0}));
 near(small[0],20*K,1e-12,'never above the rating');
 assert.ok(d[0]+d[1]<(H.dis[0].power+H.dis[1].power)*1e-3,'a large wing rating does not hold power away from propulsion');
 const idle=Array.from(C.coolingDemandW({p:{grid:{P:1000,fixed:0,De:0}},ht:{qJ:0}},H,{}));assert.deepEqual(idle,[0,0],'no heat, no reservation');
});

test('battle: the converters\' own input heat is removed by the next solve and leaves no 20 s store floor',()=>{
 // physics review of 8ee306e: the input was added to the store after the solve and only left through
 // qJ/drainS, so the store settled at drainS × input (gozanti 77% full). It is now offered again to the
 // converters' spare capacity on the next solve.
 const {unit,allocate,tick,P}=require('./helpers/global-energy-runtime.cjs'),u=unit({coolingW:.02*P});
 for(let i=0;i<120;i++){allocate(u,{throttle:1});tick(u);}
 const input=u.ht.cooling.lastDraw;assert.ok(input>0);
 assert.ok(u.ht.qJ<2*input*(1+C.HEAT.waste.reactor),`store ${u.ht.qJ} stays within one step of converter input ${input}, not ${C.HEAT.drainS}× it`);
});

test('a ship blacked out by a full store restarts only while a friendly ship tows it',()=>{
 const {unit,allocate,tick,P}=require('./helpers/global-energy-runtime.cjs'),ctx={time:0,ev(){}};
 const run=(towing)=>{const tower=unit({coolingW:.02*P}),towed=unit({coolingW:.02*P});tower.side=towed.side=0;towed.crew=towed.p.crewCapacity;
  C.shipHeatAdd(towed,towed.ht.capacityJ*1.01,ctx);assert.equal(towed.ht.online,false);let moved=0;
  for(let i=0;i<400;i++){allocate(tower,{throttle:0});tick(tower);if(towing)moved+=C.towHeatRelief(tower,towed,1);C.shipHeatRecoveryTick(towed,1,ctx);}
  return {tower,towed,moved};};
 const alone=run(false);assert.equal(alone.towed.ht.online,false,'on its own a ship at 100% stays dead');assert.ok(alone.towed.ht.qJ>=alone.towed.ht.capacityJ);
 const towed=run(true);assert.ok(towed.moved>0);assert.equal(towed.towed.ht.online,true,'towing lets the store fall to 90% and the crew restart it');
 assert.ok(towed.tower.ht.qJ<C.HEAT.governStart*towed.tower.ht.capacityJ*(1+1e-9),'the tower is never pushed into its own governor');
 const enemy=unit({coolingW:.02*P}),victim=unit({coolingW:.02*P});enemy.side=1;victim.side=0;C.shipHeatAdd(victim,victim.ht.capacityJ*1.01,ctx);allocate(enemy,{throttle:0});tick(enemy);
 assert.equal(C.towHeatRelief(enemy,victim,1),0,'only a friendly tower relieves heat');
});
