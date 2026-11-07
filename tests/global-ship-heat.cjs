const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..')),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
C.HEAT.qAllowJPerKg=1;
function unit(){return {id:'thermal-control',p:{hp:100,mass:.1,len:10,width:10,height:10,crewMax:100,modules:[],propulsion:{massKg:100},grid:{P:100,fixed:0},heat:{src:[{n:'Hull',k:'hotel',g:'low',sh:1,m:[]}],dis:[{n:'Hull',k:'skin',m:-1,sec:-1,cap:10,power:0}],ln:[{s:0,d:0,cap:10}]}},crew:100,mods:[],sec:[{s:100,max:100}],secLost:[],order:{emit:'normal'},pos:[0,0,0]};}
const ctx={time:0,ev(){}};
test('one ship reservoir uses kg and the specified persistent safety curve',()=>{
 const u=unit();near(C.shipHeatCapacity(u),100);for(const [f,r]of [[.69,1],[.7,1],[.8,1-.4/3],[.9,1-.8/3],[1,.6],[1.5,.6]])near(C.shipHeatThermalLimit(f),r);
 C.shipHeatAdd(u,80,ctx);near(u.ht.qJ,80);near(C.shipHeatOutputFactor(u),1-.4/3);C.heatTick(ctx,u,1,1);near(u.ht.qJ,76);near(C.shipHeatOutputFactor(u),1-.4/3);
 assert.equal(u.ht.st,undefined,'individual heat stores are retired');near(C.heatStatus(u).massKg,100);
});
test('only final external rejection reduces heat and passive hull paths survive blackout',()=>{
 const u=unit();u.p.heat.dis[0].cap=0;C.shipHeatAdd(u,80,ctx);C.heatTick(ctx,u,1,1);near(u.ht.qJ,80);near(u.ht.rejectedHeatJ,0);
 const v=unit();C.shipHeatAdd(v,100,ctx);assert.equal(v.ht.online,false);C.heatTick(ctx,v,1,1);near(v.ht.qJ,95);assert.ok(v.ht.rejectedHeatJ>0);assert.equal(v.ht.online,false);
});
test('blackout restoration requires both finite crew work and cooling; power damage persists',()=>{
 const u=unit();C.shipHeatAdd(u,100,ctx);assert.equal(C.shipHeatOutputFactor(u),0);C.shipHeatRecoveryTick(u,300,ctx);near(u.ht.restartWork,1);assert.equal(u.ht.online,false);
 for(let i=0;i<3;i++)C.heatTick(ctx,u,1,1);assert.ok(u.ht.qJ<90);C.shipHeatRecoveryTick(u,.1,ctx);assert.equal(u.ht.online,true);near(C.shipHeatOutputFactor(u),.6);
 for(let i=0;i<20;i++)C.heatTick(ctx,u,1,1);near(C.shipHeatOutputFactor(u),.6);C.shipHeatRepairComplete(u,ctx);near(C.shipHeatOutputFactor(u),1);
});
test('crew capacity is the denominator and changing crew integrates actual work',()=>{
 const u=unit();C.shipHeatAdd(u,100,ctx);u.ht.qJ=50;u.crew=50;C.shipHeatRecoveryTick(u,100,ctx);near(u.ht.restartWork,1/6);u.crew=100;C.shipHeatRecoveryTick(u,250,ctx);assert.equal(u.ht.online,true);
 const v=unit();C.shipHeatAdd(v,100,ctx);v.ht.qJ=50;v.crew=0;C.shipHeatRecoveryTick(v,10000,ctx);near(v.ht.restartWork,0);assert.equal(v.ht.online,false);v.p.crewMax=0;v.crew=100;C.shipHeatRecoveryTick(v,10000,ctx);near(v.ht.restartWork,0);
});
module.exports={unit};
