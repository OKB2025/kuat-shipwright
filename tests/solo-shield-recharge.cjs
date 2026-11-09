const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,Math});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),TT=C.TT,run=s=>vm.runInContext(s,cx),near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${label}: ${a} != ${b}`);C.HEAT.qAllowJPerKg=1e25;
run('const C=Core,TT_J=C.TT,trial={},toast=()=>{};');
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
for(const name of ['trialSystemsUnit','trialPropulsionMotion','trialMainOutput','trialPowerStep']){const start=app.indexOf('function '+name+'('),end=app.indexOf('\n}',start)+2;assert.ok(start>=0&&end>start);run(app.slice(start,end));}
function fixture(battle=false){
 const module=(k,part)=>({k,part,port:'p'+part,domain:'main',size:1,share:1,at:.5,powerConnected:true}),modules=[module('reactor',1),module('engine',2),module('shield',3),module('other',4)],P=100*TT;
 const engine={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:P,wattsPerNewton:2e9,ratedThrustN:P/2e9,driveProfileId:'standard',effectiveMachineryVolumeM3:1,machineryVolumeM3:1,direction:[1,0,0],pathCapacityW:P,valid:true,available:true,connected:true,outletAvailable:true};
 const src=(k,id,m)=>({k,id,n:id,g:'high',sh:1,st:1e40,m,pc:[],sec:-1,sw:-1,gen:-1});
 const p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Actual solo shield regeneration',hp:1e12,len:100,width:40,height:20,D:20*C.K.deflect,shieldBuffer:200*C.K.deflect,reserve:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:1000,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,energyModel:{version:0},propulsion:{version:1,engines:[engine],massKg:1e9,ratedThrustN:engine.ratedThrustN,ratedAccelMps2:engine.ratedThrustN/1e9,accelerationLimitMps2:1e20},grid:{P,Pgen:P,fixed:5*TT,cooling:0,De:P,Ds:20*TT,Dw:0,domains:[{id:'main',P,sources:[{moduleIndex:0,P}],modules:[0,1,2,3]}],fixedLoads:[{id:'p4',port:'p4',domain:'main',weight:5*TT}],powerPaths:[{from:'p1',to:'p2',cap:P,ok:true},{from:'p1',to:'p3',cap:20*TT,ok:true},{from:'p1',to:'p4',cap:5*TT,ok:true}]},heat:{v:3,mode:'strict',src:[src('reactor','p1',[0]),src('engine','p2',[1]),src('shield','p3',[2]),src('hotel','p4',[3])],dis:[],ln:[]},fuel:{version:1,capacityKnown:true,capacityJ:1e40,specificEnergyJPerKg:C.fuelSpecificEnergyJPerKg()}};
 const u=C.fleetUnit('solo-shield-test','solo-shield',p);C.heatInit(u);cx.fixtureP=p;cx.fixtureUnit=u;cx.fixtureBattle=battle;
 run('Object.assign(trial,{p:fixtureP,battle:fixtureBattle?{me:fixtureUnit}:null,systemsUnit:fixtureBattle?null:fixtureUnit,energy:{E:0,cap:0},thrustWant:1,mainThrustShare:1,t:0});trial.systemsUnit&&(trial.systemsUnit._profile=fixtureP);');
 return u;
}
function tick(dt=.1){cx.step=dt;run('trialPowerStep(step,0);trial.t+=step;');}
const ctx={time:1,damage:1,rand:()=>1,ev(){},out(){},sunk(){},hit(){}};

test('an actual solo hit recharges from paid shield input then releases that power back to propulsion',()=>{
 const u=fixture();tick();near(u.pw.sh,0);near(u.propulsion.actualInputW/TT,95);const healthyInput=u.propulsion.actualInputW,reference=u.p.maxSpeed;
 C.shieldReceive(u,{energy:u.shieldMax*.3});near(u.shield/u.shieldMax,.7);const damaged=u.shield;let paidJ=0,sourceJ=0,steps=0;
 while(u.shield<u.shieldMax*(1-1e-11)&&steps++<200){tick();paidJ+=u.pw.sh*.1;sourceJ+=u.propulsion.power.draw*.1;assert.ok(u.propulsion.actualInputW<healthyInput);assert.ok(!u.out&&u.ht.online);}
 assert.ok(steps<200,'the actual stored field fills instead of remaining at70percent');near(u.shield,u.shieldMax);near(u.shield-damaged,paidJ/TT*C.K.deflect,'stored field follows actual granted joules');assert.ok(C.shipFuelState(u).generatedElectricalJ>=sourceJ);
 tick();near(u.pw.sh,0);near(u.pw.requestedShieldRechargeW,0);near(u.propulsion.actualInputW,healthyInput);near(u.p.maxSpeed,reference);assert.equal(u.pw.activeCombatPower,false);
});
test('solo shield storage does not add electrical, fuel or operating heat a second time',()=>{
 const u=fixture();C.shieldReceive(u,{energy:u.shieldMax*.3});const fuelBefore=C.shipFuelState(u).generatedElectricalJ;tick();near(u.pw.sh/TT,20);near(u.shield/u.shieldMax,.71);near(C.shipFuelState(u).generatedElectricalJ-fuelBefore,100*TT*.1,'one funded source generation per allocation');
 const generated=u.ht.actualGeneratedElectricalJ,heat=u.ht.operatingHeatJ+Object.values(u.ht.e).reduce((n,J)=>n+J,0)+u.ht.engineE.reduce((n,J)=>n+J,0)+u.ht.reactorE.reduce((n,J)=>n+J,0),bank=u.bank;
 C.shieldRechargeStep(u,C.fleetSystems(u),0);near(u.ht.actualGeneratedElectricalJ,generated);near(u.ht.operatingHeatJ+Object.values(u.ht.e).reduce((n,J)=>n+J,0)+u.ht.engineE.reduce((n,J)=>n+J,0)+u.ht.reactorE.reduce((n,J)=>n+J,0),heat);near(u.bank,bank);
});
test('a battle-owned pilot receives no duplicate solo recharge before its world combat update',()=>{
 const u=fixture(true);C.shieldReceive(u,{energy:u.shieldMax*.3});const before=u.shield;tick();near(u.shield,before,'trial allocation leaves world-owned field unchanged');const expected=before+u.pw.sh*.1/TT*C.K.deflect;
 C.combatResolve(ctx,u,C.combatIncoming(),.1,C.fleetSystems(u));near(u.shield,expected,'the shared combat helper advances storage once');
});
test('the shared update retains established under-fire generation, reserve spending and decay',()=>{
 const u=fixture(true);u.p.reserve=50;u.bank=20;u.shield=60;u.p.shieldBuffer=100;u.p.D=10;u.shF=.5;u.pw={policy:C.FLIGHT_POWER_POLICY.id,requestedShieldRechargeW:1};
 const dt=.25,incoming=5,gen0=10*.5*dt*C.COMBAT.fireGen,decay=.5*10*dt*.5,bd=Math.min(20,C.COMBAT.bankRate*10*dt,incoming+(100-60)+decay-gen0),expected=60+gen0+bd-decay;
 const q=C.shieldRechargeStep(u,{shield:1,battery:1},dt,{incomingShieldTT:incoming});near(q.generatedTT,gen0);near(q.reserveSpentTT,bd);near(q.decayedTT,decay);near(u.bank,20-bd);near(u.shield,expected);
});
test('an unfunded solo shield cannot refill stored energy or generate fictitious reactant use',()=>{
 const u=fixture();C.shieldReceive(u,{energy:u.shieldMax*.3});u.mods[0]=0;const before=u.shield,fuel=C.shipFuelState(u).generatedElectricalJ;tick();near(u.pw.sh,0);assert.ok(u.shield<=before);near(C.shipFuelState(u).generatedElectricalJ,fuel);assert.ok(u.out);
});

test('fully funded one-third headroom top-ups finish in one step at varying frame times',()=>{
 for(const dt of [.01,.03,.05,.1,.23,.75,1.7]){
  const u=fixture(),deficit=u.p.D*dt/3;C.shieldReceive(u,{energy:deficit});const before=u.shield;tick(dt);
  near(u.shF,1/3);near(u.pw.shieldHeadroomFraction,1/3);near(u.shield,u.shieldMax,'paid top-up cannot stall at the old one-third fixed point');near(u.shield-before,u.pw.sh*dt/TT*C.K.deflect);tick(dt);near(u.pw.sh,0);near(u.propulsion.actualInputW/TT,95);
 }
});
test('intentional headroom never hides real operating derating, finite feed shortage or offline field loss',()=>{
 const dt=.3,u=fixture(),s=C.fleetSystems(u),D=u.p.D;u.shield=u.shieldMax-D*dt/3;
 C.allocateShipPower(u,s,{throttle:0,shields:u.p.grid.Ds*.5},dt);
 near(u.pw.shieldHeadroomFraction,2/3);near(u.shF,1/3);const before=u.shield,q=C.shieldRechargeStep(u,s,dt);near(q.decayedTT,D*dt*.25,'the pre-existing half operating limit still decays');near(u.shield,before+D*dt/3-D*dt*.25);assert.ok(u.shield<u.shieldMax);
 const limited=fixture(),ls=C.fleetSystems(limited);limited.shield=limited.shieldMax-limited.p.D*dt/3;limited.p.grid.powerPaths.find(l=>l.to==='p3').cap=limited.p.grid.Ds/6;
 C.allocateShipPower(limited,ls,{throttle:0,shields:limited.p.grid.Ds*.5},dt);near(limited.pw.shieldHeadroomFraction,2/3);near(limited.shF,1/6);const loss=C.shieldRechargeStep(limited,ls,dt);near(loss.decayedTT,limited.p.D*dt*.375,'a finite path shortage is not exempted by a paid smaller request');
 const offline=fixture(),os=C.fleetSystems(offline);offline.out='電源喪失';offline.shF=0;offline.pw={policy:C.FLIGHT_POWER_POLICY.id,requestedShieldRechargeW:0,shieldHeadroomFraction:1/3};const field=offline.shield;const stopped=C.shieldRechargeStep(offline,os,dt);near(stopped.generatedTT,0);near(stopped.decayedTT,offline.p.D*dt*.5);near(offline.shield,field-stopped.decayedTT);
 const legacy=fixture(),legacyBefore=legacy.shield;legacy.shF=1/3;legacy.pw={requestedShieldRechargeW:legacy.p.grid.Ds/3,shieldHeadroomFraction:1/3};const old=C.shieldRechargeStep(legacy,C.fleetSystems(legacy),dt);near(old.decayedTT,legacy.p.D*dt/3,'old policy keeps its established nominal maintenance formula');near(legacy.shield,legacyBefore);
});
test('field and reserve both finish their variable-step refill before idle power returns to navigation',()=>{
 const u=fixture();u.p.reserve=10*C.K.deflect;u.bankMax=u.p.reserve;u.bank=0;C.shieldReceive(u,{energy:u.shieldMax*.03});const initial=u.shield+u.bank;let paidJ=0,n=0;
 while((u.shield<u.shieldMax*(1-1e-11)||u.bank<u.bankMax*(1-1e-11))&&n<200){const dt=[.07,.13,.4][n++%3];tick(dt);paidJ+=u.pw.sh*dt;}
 assert.ok(n<200);near(u.shield,u.shieldMax);near(u.bank,u.bankMax);near(u.shield+u.bank-initial,paidJ/TT*C.K.deflect);tick(.17);near(u.pw.sh,0);near(u.propulsion.actualInputW/TT,95);assert.equal(u.pw.activeCombatPower,false);
});
