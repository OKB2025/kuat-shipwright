const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx);C.HEAT.qAllowJPerKg=1e20; // Observe allocation without an unrelated one-second thermal shutdown.
const TT=C.TT,near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${label}: ${a} != ${b}`);
function unit({efficiency=1,cap=100*TT,surface=false}={}){
 const module=(k,part)=>({k,part,port:'p'+part,domain:'main',size:1,share:1,at:.5,powerConnected:true});
 const modules=[module('reactor',1),module('engine',2),module('shield',3),module('weapon',4),module('other',5),module('dissipator',6)];
 const powerPaths=[{from:'p1',to:'bus',cap,efficiency,ok:true},...modules.slice(1).map(m=>({from:'bus',to:m.port,cap:100*TT,ok:true}))];
 const engine={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:100*TT,wattsPerNewton:2e9,ratedThrustN:100*TT/2e9,driveProfileId:'standard',effectiveMachineryVolumeM3:1,machineryVolumeM3:1,direction:[1,0,0],pathCapacityW:200*TT,valid:true,available:true,connected:true,outletAvailable:true,integrated:true};
 const src=(k,id,m)=>({k,id,n:id,g:'high',sh:1,st:1e30,m,pc:[],sec:-1,sw:-1,gen:-1});
 const p={name:'Fixed combat electrical priority',hp:1e9,len:100,width:40,height:20,D:30*C.K.deflect,shieldBuffer:300*C.K.deflect,reserve:100*C.K.deflect,wCap:1000,crewNeed:0,maxSpeed:100,accel:1,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,energyModel:{version:0},propulsion:{version:1,engines:[engine],massKg:1e9,ratedThrustN:engine.ratedThrustN,ratedAccelMps2:engine.ratedThrustN/1e9,accelerationLimitMps2:1e20},grid:{P:100*TT,fixed:15*TT,cooling:5*TT,De:100*TT,Ds:30*TT,Dw:40*TT,domains:[{id:'main',P:100*TT,sources:[{moduleIndex:0,P:100*TT}],modules:modules.map((_,i)=>i)}],trunks:[],fixedLoads:[{id:'p5',port:'p5',domain:'main',weight:10*TT}],coolingLoads:[{id:'p6',port:'p6',domain:'main',weight:5*TT}],powerPaths},heat:{v:1,src:[src('engine','p2',[1]),src('shield','p3',[2]),src('weapon','p4',[3]),src('reactor','p1',[0]),src('hotel','p5',[4])],dis:[{id:'p6',n:'powered cooler',k:'hdis',g:'high',cap:100*TT,power:5*TT,m:5,sec:-1}],ln:[]}};
 if(surface)p.surface={mounts:[{id:4,module:3,power:40*TT,capacity:1000,gun:10,ion:0,boltTT:1,band:'mid',arcs:Array(6).fill(1),muzzle:[0,0,0]}],patches:[],devices:[]};
 const u=C.fleetUnit('priority-test','priority-test',p);u.maneuver=1;u.energy=1000;u.shield=u.shieldMax;u.bank=u.bankMax;C.heatInit(u);if(surface)u.surfaceBanks={4:1000};return u;
}
function allocate(u,want={},mode='propulsion'){
 return C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,shields:30*TT,weapons:40*TT,deferHeat:true,...want},1,mode);
}
function ledger(result){const p=result.propulsion.power;near(p.draw,p.delivered+p.feedLossW,'finite source conservation');assert.ok(p.draw<=p.P+Math.max(1,p.P)*1e-12);near(p.draw,p.sources.reduce((n,s)=>n+s.drawW,0));}

test('all live stored modes use services, real shield recharge, weapons, then navigation at finite reactor output',()=>{
 for(const mode of Object.keys(C.POWER_MODES)){
  const u=unit();u.shield=0;u.energy=0;const r=allocate(u,{},mode);
  near(r.propulsion.power.fixed/TT,10);near(r.propulsion.power.cooling/TT,5);near(r.got.shields/TT,30);near(r.got.weapons/TT,40);near(r.got.engines/TT,15);near(r.propulsion.power.draw/TT,100);
  assert.equal(u.mode,C.FLIGHT_POWER_POLICY.id);assert.equal(u.pw.activeCombatPower,true);near(u.pw.requestedShieldRechargeW/TT,30);near(u.pw.requestedWeaponChargeW/TT,40);ledger(r);
 }
});
test('full idle shields and weapon stores reserve no power and preserve the uncontested healthy terminal reference',()=>{
 const u=unit(),reference=u.p.maxSpeed,drag=C.massDragRate(u),r=allocate(u);
 near(r.got.shields,0);near(r.got.weapons,0);near(r.got.engines/TT,85);assert.equal(u.pw.activeCombatPower,false);near(u.pw.requestedShieldRechargeW,0);near(u.pw.requestedWeaponChargeW,0);near(u.p.maxSpeed,reference);near(C.massDragRate(u),drag);
 const initial=u.shield;u.shF=0;C.combatResolve({time:1,damage:1,rand:()=>1,ev(){},out(){},sunk(){},hit(){}},u,C.combatIncoming(),1,C.fleetSystems(u));near(u.shield,initial,'idle field retains its actual stored energy');ledger(r);
});
test('shield depletion and actual firing reduce navigation acceleration and equilibrium without retuning reference resistance',()=>{
 const u=unit(),idle=allocate(u),reference=u.p.maxSpeed,drag=C.massDragRate(u),idleAccel=idle.propulsion.actualAccelMps2;
 u.shield=0;const shield=allocate(u,{weapons:0});near(shield.got.engines/TT,55);
 u.shield=u.shieldMax;const firing=allocate(u,{weaponFireW:40*TT});near(firing.got.engines/TT,45);assert.equal(u.pw.activeWeaponFire,true);near(u.pw.requestedWeaponFireW/TT,40);
 assert.ok(firing.propulsion.actualAccelMps2<idleAccel);near(C.propulsionTerminalSpeed(u,C.propulsionMotion(u).acc)/C.propulsionTerminalSpeed(u,idleAccel*C.FLEET_RULES.accelScale),45/85);
 near(u.p.maxSpeed,reference);near(C.massDragRate(u),drag);const recovered=allocate(u);near(recovered.got.engines,idle.got.engines);assert.equal(u.pw.activeCombatPower,false);ledger(shield);ledger(firing);
});
test('only the missing shield and capacitor joules are requested near full, including a depleted shield reserve',()=>{
 const u=unit();u.shield-=3*C.K.deflect;u.energy-=2;let r=allocate(u);near(r.got.shields/TT,3);near(r.got.weapons/TT,2);near(r.got.engines/TT,80);
 u.shield=u.shieldMax;u.energy=1000;u.bank-=2*C.K.deflect;r=allocate(u);near(r.got.shields/TT,2);near(r.got.engines/TT,83);ledger(r);
});
test('throttle cannot displace combat consumers and disabling thrust leaves their finite grants unchanged',()=>{
 for(const throttle of [0,.25,1]){const u=unit();u.shield=0;u.energy=0;const r=allocate(u,{throttle});near(r.got.shields/TT,30);near(r.got.weapons/TT,40);near(r.got.engines/TT,throttle===0?0:15);ledger(r);}
});
test('shared finite path losses fund services and shields before guns and leave no fictitious propulsion grant',()=>{
 const u=unit({efficiency:.8,cap:100*TT});u.shield=0;u.energy=0;const r=allocate(u);near(r.propulsion.power.fixed/TT,10);near(r.propulsion.power.cooling/TT,5);near(r.got.shields/TT,30);near(r.got.weapons/TT,35);near(r.got.engines,0);near(r.propulsion.power.feedLossW/TT,20);ledger(r);
});
test('zero grants retain current combat demand for readiness while idle requests do not',()=>{
 const u=unit({cap:15*TT});u.shield=0;u.energy=0;const r=allocate(u,{weaponFireW:40*TT});near(r.got.shields,0);near(r.got.weapons,0);assert.equal(u.pw.activeCombatPower,true);assert.equal(u.pw.activeWeaponFire,true);near(u.pw.requestedShieldRechargeW/TT,30);near(u.pw.requestedWeaponChargeW/TT,40);ledger(r);
});
test('surface bank room is allocated before navigation and a full surface bank has no standby weapon draw',()=>{
 const u=unit({surface:true});let r=allocate(u);near(r.got.weapons,0);near(r.got.engines/TT,85);
 u.surfaceBanks[4]=999;u.energy=999;r=allocate(u);near(r.got.weapons/TT,1);near(r.got.engines/TT,84);near(C.surfaceManualCharge(u,r.got.weapons,1),1);near(u.surfaceBanks[4],1000);ledger(r);
});
test('accepted combat source draw produces actual heat and fuel use, without creating electrical energy',()=>{
 const u=unit();u.maneuver=0;u.energy=0;u.shield=0;const r=allocate(u,{throttle:0});C.heatAccrue(u,r.got,r.cooling.fixed,1);near(u.ht.actualGeneratedElectricalJ/TT,80);near(u.ht.reactorHeatJ/TT,.04*80);assert.ok(u.ht.e.shield>0);assert.ok(u.ht.e.weapon>0);const fuel=C.shipFuelState(u);assert.ok(fuel.generatedElectricalJ>0);ledger(r);
});

test('the actual fleet clock pays the same recharge and firing demand as direct control',()=>{
 const u=unit();C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);near(u.pw.sh,0);near(u.pw.wpn,0);near(u.propulsion.actualInputW/TT,85);
 u.shield=0;u.energy=0;C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);near(u.pw.sh/TT,30);near(u.pw.wpn/TT,40);near(u.propulsion.actualInputW/TT,15);near(u.energy,40);
 C.combatResolve({time:1,damage:1,rand:()=>1,ev(){},out(){},sunk(){},hit(){}},u,C.combatIncoming(),1,C.fleetSystems(u));assert.ok(u.shield>0);assert.ok(u.shield<=30*C.K.deflect+100*C.K.deflect,'only paid generation and real cell reserve can refill the field');
 u.shield=u.shieldMax;u.bank=u.bankMax;u.energy=1000;C.fleetPowerStep(u,C.fleetSystems(u),null,10,1);near(u.pw.wpn/TT,10);near(u.propulsion.actualInputW/TT,75);assert.equal(u.pw.activeWeaponFire,true);near(u.energy,1000);
 C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);near(u.propulsion.actualInputW/TT,85);assert.equal(u.pw.activeCombatPower,false);
});

test('an actual fleet shot from a full bank remains active even when its charger has no input request',()=>{
 const u=unit({surface:true}),target={p:{len:10,width:10},pos:[100,0,0],yaw:0};u.p.grid.Dw=0;
 C.fleetPowerStep(u,C.fleetSystems(u),target,10,1);assert.ok(u.surfaceLastFire.spent>0);near(u.pw.requestedWeaponChargeW,0);near(u.pw.requestedWeaponFireW,u.surfaceLastFire.spent*TT);assert.equal(u.pw.activeWeaponFire,true);assert.equal(u.pw.activeCombatPower,true);
 C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);assert.equal(u.pw.activeWeaponFire,false);assert.equal(u.pw.activeCombatPower,false);
});
