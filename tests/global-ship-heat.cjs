const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..')),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
C.HEAT.qAllowJPerKg=1;
// 2026-11-12 user decision: the hull skin removes no heat. The fixture's only sink is one physical
// heat-energy converter (cap 10 W) that draws disPowerK.hdis per W it converts; fund() supplies that input.
const K=C.HEAT.disPowerK.hdis,RW=C.HEAT.waste.reactor;
function unit(){return {id:'thermal-control',p:{hp:100,mass:.1,len:10,width:10,height:10,crewMax:100,modules:[{k:'dissipator',part:1,port:'p1',domain:'main',size:1,share:1,powerConnected:true}],propulsion:{massKg:100},grid:{P:100,fixed:0},heat:{src:[{n:'Hull',k:'hotel',g:'low',sh:1,m:[]}],dis:[{n:'Converter',id:'p1',k:'hdis',m:0,sec:-1,cap:10}],ln:[{s:0,d:0,cap:10}]}},crew:100,mods:[1],sec:[{s:100,max:100}],secLost:[],order:{emit:'normal'},pos:[0,0,0]};}
function fund(u){const h=C.heatOf(u);h.cooling={reserveJ:1,reserveByNodeJ:{p1:1},reserveByNodeSourceJ:{},reserveByNodeFeedJ:{},reservedJ:0,inputJ:0,sourceInputJ:0,heatJ:0,feedLossJ:0,reactorWasteJ:0,handledJ:0};}
const ctx={time:0,ev(){}};
test('one ship reservoir uses kg and the specified persistent safety curve',()=>{
 const u=unit();near(C.shipHeatCapacity(u),100);for(const [f,r]of [[.69,1],[.7,1],[.8,1-.4/3],[.9,1-.8/3],[1,.6],[1.5,.6]])near(C.shipHeatThermalLimit(f),r);
 C.shipHeatAdd(u,80,ctx);near(u.ht.qJ,80);near(C.shipHeatOutputFactor(u),1-.4/3);fund(u);C.heatTick(ctx,u,1,1);
 // One step: the 4 J drained leave and the converter's own input (4·K, with the reactor's loss) enters the
 // store after the solve. It is offered again on the next solve (h.coolingSelfW, heat-converters.cjs), so
 // this is the instantaneous ledger, not a steady floor.
 near(u.ht.qJ,76+4*K*(1+RW));near(u.ht.cooling.inputJ,4*K);near(u.ht.coolingSelfW,4*K*(1+RW));near(C.shipHeatOutputFactor(u),1-.4/3);
 assert.equal(u.ht.st,undefined,'individual heat stores are retired');near(C.heatStatus(u).massKg,100);
});
test('only converted heat leaves; there is no passive hull path, before or during a blackout',()=>{
 const u=unit();u.p.heat.dis[0].cap=0;C.shipHeatAdd(u,80,ctx);fund(u);C.heatTick(ctx,u,1,1);near(u.ht.qJ,80);near(u.ht.rejectedHeatJ,0);
 const w=unit();C.shipHeatAdd(w,80,ctx);C.heatTick(ctx,w,1,1);near(w.ht.qJ,80);near(w.ht.rejectedHeatJ,0,'an unfunded converter converts nothing');
 const v=unit();C.shipHeatAdd(v,100,ctx);assert.equal(v.ht.online,false);fund(v);C.heatTick(ctx,v,1,1);near(v.ht.qJ,100);near(v.ht.rejectedHeatJ,0);assert.equal(v.ht.online,false);
 const cached={...unit().p,heat:{src:[{n:'Hull',k:'hotel',g:'low',sh:1,m:[]}],dis:[{n:'Hull',k:'skin',m:-1,sec:-1,cap:10,power:0}],ln:[{s:0,d:0,cap:10}]}};
 assert.equal(C.heatProfile(cached).dis.length,0,'a cached hull-skin sink from an older profile is dropped on load');assert.equal(C.heatProfile(cached).ln.length,0);
});
test('blackout restoration requires both finite crew work and a store at or below 90%; power damage persists',()=>{
 const u=unit();C.shipHeatAdd(u,100,ctx);assert.equal(C.shipHeatOutputFactor(u),0);C.shipHeatRecoveryTick(u,300,ctx);near(u.ht.restartWork,1);assert.equal(u.ht.online,false);
 // Open question (2026-11-12): with no passive hull path an unpowered ship cannot cool itself below 90%.
 for(let i=0;i<3;i++){fund(u);C.heatTick(ctx,u,1,1);}near(u.ht.qJ,100);C.shipHeatRecoveryTick(u,.1,ctx);assert.equal(u.ht.online,false);
 u.ht.qJ=89;C.shipHeatRecoveryTick(u,.1,ctx);assert.equal(u.ht.online,true);near(C.shipHeatOutputFactor(u),.6);
 for(let i=0;i<20;i++){fund(u);C.heatTick(ctx,u,1,1);}near(C.shipHeatOutputFactor(u),.6);C.shipHeatRepairComplete(u,ctx);near(C.shipHeatOutputFactor(u),1);
});
test('crew capacity is the denominator and changing crew integrates actual work',()=>{
 const u=unit();C.shipHeatAdd(u,100,ctx);u.ht.qJ=50;u.crew=50;C.shipHeatRecoveryTick(u,100,ctx);near(u.ht.restartWork,1/6);u.crew=100;C.shipHeatRecoveryTick(u,250,ctx);assert.equal(u.ht.online,true);
 const v=unit();C.shipHeatAdd(v,100,ctx);v.ht.qJ=50;v.crew=0;C.shipHeatRecoveryTick(v,10000,ctx);near(v.ht.restartWork,0);assert.equal(v.ht.online,false);v.p.crewMax=0;v.crew=100;C.shipHeatRecoveryTick(v,10000,ctx);near(v.ht.restartWork,0);
});
module.exports={unit};
