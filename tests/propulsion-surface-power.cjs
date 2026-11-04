const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),TT=4.184e21;
const near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${label}: ${a} != ${b}`);

function unit(trunkW=100*TT){
 const mod=(k,part,domain,size=1)=>({k,part,port:'p'+part,domain,size,share:k==='weapon'?.5:1,at:.5,powerConnected:true});
 const modules=[mod('reactor',1,'one'),mod('reactor',2,'two'),mod('engine',3,'one'),mod('weapon',4,'one'),mod('weapon',5,'two'),mod('dissipator',6,'one'),mod('other',7,'one')];
 const engine={id:3,machineryId:3,moduleIndex:2,powerNode:'p3',heatNode:'p3',domain:'one',ratedInputW:70*TT,wattsPerNewton:2e9,ratedThrustN:70*TT/2e9,direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true};
 const src=(k,id,m,sh=1)=>({k,id,n:id,g:'high',sh,st:1e30,m,pc:[],sec:-1,sw:-1,gen:-1});
 const mount=(id,module)=>({id,module,power:100*TT,capacity:1000,gun:1,ion:0,boltTT:1,band:'mid',arcs:Array(6).fill(1),muzzle:[0,0,0]});
 const p={name:'Isolated surface budgets',hp:1e9,len:100,width:40,height:20,D:0,shieldBuffer:0,reserve:0,wCap:2000,crewNeed:0,maxSpeed:100,accel:1,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,energyModel:{version:0},propulsion:{version:1,engines:[engine],massKg:1e9,ratedThrustN:engine.ratedThrustN,ratedAccelMps2:engine.ratedThrustN/1e9,accelerationLimitMps2:1e20},grid:{P:200*TT,fixed:20*TT,cooling:20*TT,De:70*TT,Ds:0,Dw:200*TT,domains:[{id:'one',P:100*TT,sources:[{moduleIndex:0,P:100*TT}],modules:[0,2,3,5,6]},{id:'two',P:100*TT,sources:[{moduleIndex:1,P:100*TT}],modules:[1,4]}],trunks:[{port:'p7',moduleIndex:6}],coolingLoads:[{id:'p6',port:'p6',domain:'one',weight:20*TT}],powerPaths:[{from:'p1',to:'p7',cap:trunkW,ok:true},{from:'p7',to:'p3',cap:70*TT,ok:true},{from:'p7',to:'p4',cap:100*TT,ok:true},{from:'p7',to:'p6',cap:20*TT,ok:true},{from:'p2',to:'p5',cap:100*TT,ok:true}]},surface:{mounts:[mount(4,3),mount(5,4)],patches:[],devices:[]},heat:{v:1,src:[src('engine','p3',[2]),src('weapon','p4',[3],.5),src('weapon','p5',[4],.5),src('reactor','p1',[0],.5),src('reactor','p2',[1],.5),src('hotel','hotel',[])],dis:[{id:'p6',n:'powered cooler',k:'hdis',g:'high',cap:1000*TT,power:20*TT,m:5,sec:-1,src:-1}],ln:[{s:0,d:0,cap:1000*TT,sec:-1}]}};
 const u=C.fleetUnit('surface-budget','surface-budget',p,0);u.order={...u.order,power:'balanced'};u.maneuver=1;u.surfaceBanks={4:0,5:999};u.energy=999;C.heatInit(u);return u;
}

for(const trunkTT of [100,90])test(`fleet charging respects each isolated source and a ${trunkTT} TT/s shared engine/cooling trunk`,()=>{
 const u=unit(trunkTT*TT);C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);
 const chargedA=u.surfaceBanks[4],chargedB=u.surfaceBanks[5]-999,engineA=u.propulsion.actualInputW/TT,coolingA=u.pw.coolingReserved/TT;
 near(chargedA,trunkTT-90,'first domain accepted charge');near(chargedB,1,'second domain bank room');
 assert.ok(engineA+coolingA+chargedA<=trunkTT+1e-8,'the trunk cannot be spent again by the surface banks');
 assert.ok(engineA+coolingA+chargedA<=100+1e-8,'the first reactor cannot supply the second domain grant');
 assert.ok(chargedB<=100+1e-8);near(u.pw.wpn/TT,chargedA+chargedB,'accepted weapon input');
});

test('direct surface charging uses the same per-module grants and does not borrow unused charge',()=>{
 const u=unit(),allocation=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:200*TT,shields:0,deferHeat:true},1,'balanced');
 near(allocation.got.weapons/TT,110,'total electrical weapon grant');
 const accepted=C.surfaceManualCharge(u,allocation.got.weapons,1);
 near(u.surfaceBanks[4],10,'first domain charge');near(u.surfaceBanks[5],1000,'second domain charge');near(accepted,11,'unused power stays unused');
});

test('an explicit zero module grant remains zero when another domain has unused weapon power',()=>{
 const u=unit();u.pw={weaponInputs:{3:0,4:100*TT}};const accepted=C.surfaceManualCharge(u,100*TT,1);
 near(u.surfaceBanks[4],0);near(u.surfaceBanks[5],1000);near(accepted,1);
});

test('repeated charging cannot spend one allocated module input a second time',()=>{
 const u=unit();u.surfaceBanks[5]=0;u.energy=0;
 const {got}=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:200*TT,shields:0,deferHeat:true},1,'balanced');
 near(C.surfaceManualCharge(u,got.weapons,1),110);near(C.surfaceManualCharge(u,got.weapons,1),0);
 near(u.surfaceBanks[4],10);near(u.surfaceBanks[5],100);
});

test('accepted surface charge heats only its actual funding reactors, including cooling consumption',()=>{
 const u=unit();C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);C.heatTick({time:1},u,1);
 const coolingInput=u.ht.cooling.inputJ;
 near(u.ht.st[3],.04*(80*TT+coolingInput),'first source actual engine, weapon and cooler input');
 near(u.ht.st[4],.04*TT,'second source accepted weapon input');
});

test('a connected consumer can use more than sixteen independent finite supply paths',()=>{
 const sources=Array.from({length:24},(_,i)=>({id:'r'+i,domain:'main',powerW:1})),links=sources.map(s=>({from:s.id,to:'engine',cap:1,ok:true}));
 const result=C.allocateConnectedPower({sources,links,loads:[{id:'engine',kind:'engines',port:'engine',domain:'main',requestedInputW:24}],mode:'balanced'});
 near(result.granted.engine,24);near(result.draw,24);near(result.sources.reduce((n,s)=>n+s.drawW,0),24);
});

test('a design preview throttle cannot redefine its game speed or planning acceleration',()=>{
 const stats={hp:1,armorHull:0,vuln:0,shieldP:0,alphaBest:0,alphaMean:0,ionBest:0,ionMean:0,mslSalvo:0,aa:0,rc:1,accuracy:1,tractors:0,slots:0,launch:0,hullLen:100,dims:[100,40,20],alphaRate:Array(6).fill(0),ionRate:Array(6).fill(0),draw:{},propulsion:{ratedAccelMps2:500,accelerationLimitMps2:400},ratedAccelMps2:500,maximumAccelMps2:400};
 const full=C.fleetProfile({...stats,accelG:400/9.80665},'planning'),stopped=C.fleetProfile({...stats,accelG:0},'planning');
 assert.ok(full.maxSpeed>0);near(stopped.accel,full.accel);near(stopped.maxSpeed,full.maxSpeed);near(stopped.turnRate,full.turnRate);
});
