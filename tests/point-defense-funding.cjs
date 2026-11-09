const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),copy=x=>JSON.parse(JSON.stringify(x)),TT=C.TT;
const near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${label}: ${a} != ${b}`);
function unit({surface=true,dual=true}={}){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'engine',part:2,port:'p2',domain:'main',size:1,share:1,powerConnected:true},{k:'weapon',fit:3,port:'f3',domain:'main',size:1,share:1,powerConnected:true,pd:true,dualPurpose:dual,weaponPowerW:10*TT}];
 const engine={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:100*TT,wattsPerNewton:2e9,ratedThrustN:100*TT/2e9,driveProfileId:'standard',effectiveMachineryVolumeM3:1,machineryVolumeM3:1,direction:[1,0,0],pathCapacityW:100*TT,valid:true,available:true,connected:true,outletAvailable:true,integrated:true};
 const zeros=()=>Array(6).fill(0),arcs=Array(6).fill(10),p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Paid automatic defence',hp:1e9,len:100,width:40,height:20,D:0,reserve:0,wCap:100,crewNeed:0,maxSpeed:100,accel:1,turnRate:.1,aa:6,aaArcs:Array(6).fill(6),gunArcs:arcs.slice(),ionArcs:zeros(),gunBands:{long:zeros(),mid:arcs.slice(),close:zeros()},modules,energyModel:{version:1,eta:.5},propulsion:{version:1,engines:[engine],massKg:1e9,ratedThrustN:engine.ratedThrustN,ratedAccelMps2:engine.ratedThrustN/1e9,accelerationLimitMps2:1e20},grid:{P:100*TT,fixed:0,cooling:0,De:100*TT,Ds:0,Dw:20*TT,domains:[{id:'main',P:100*TT,sources:[{moduleIndex:0,P:100*TT}],modules:[0,1,2]}],powerPaths:[{from:'p1',to:'p2',cap:100*TT,ok:true},{from:'p1',to:'f3',cap:100*TT,ok:true}]},heat:{v:1,src:[{k:'engine',id:'p2',n:'p2',g:'high',sh:1,st:1e30,m:[1],pc:[],sec:-1,sw:-1,gen:-1},{k:'weapon',id:'f3',n:'f3',g:'high',sh:1,st:1e30,m:[2],pc:[],sec:-1,sw:-1,gen:-1},{k:'reactor',id:'p1',n:'p1',g:'high',sh:1,st:1e30,m:[0],pc:[],sec:-1,sw:-1,gen:-1}],dis:[],ln:[]}};
 if(dual)p.dualPurpose={gunArcs:arcs.slice(),gunBands:{long:zeros(),mid:arcs.slice(),close:zeros()},aaArcs:Array(6).fill(6),aa:6};
 if(surface)p.surface={mounts:[{id:3,module:2,power:20*TT,capacity:100,gun:10,ion:0,boltTT:1,band:'mid',arcs:Array(6).fill(1),muzzle:[0,0,0],pd:true,dualPurpose:dual}],patches:[],devices:[]};
 const u=C.fleetUnit('defender','Paid automatic defence',p,0);u.pos=[0,0,0];u.yaw=0;u.side=0;u.maneuver=1;u.energy=100;u.order.fire=false;if(surface)u.surfaceBanks={3:100};C.heatInit(u);C.powerStatus(u);C.fleetDefense(u,[{side:1,n:8,pos:[1000,0,0]}]);return u;
}
const fire=(u,step={},dt=1)=>C.fundAutomaticPointDefense(u,[1000,0,0],dt,step);
const allocate=u=>C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:20*TT,deferHeat:true},1);

test('actual automatic discharge conserves the mounted bank and marks only its paid output without duplicate heat',()=>{
 const u=unit(),heat=copy(u.ht),offensive={spent:7,cells:[{fit:99,energy:7}]};u.surfaceLastFire=offensive;const before=u.energy;
 near(fire(u),1);near(before-u.energy,10);near(u.surfaceBanks[3],90);near(u.pointDefenseLastFire.spentTT,10);near(u.pointDefenseLastFire.outputJ,10*TT);near(u.pointDefenseLastFire.inputEquivalentJ,20*TT);
 assert.equal(u.surfaceLastFire,offensive,'automatic defence preserves the ordinary shot ledger');assert.deepEqual(copy(u.ht),heat,'charging already owns conversion heat');assert.equal(u.pw.activeWeaponFire,true);assert.equal(u.pw.activeCombatPower,true);near(u.pw.requestedWeaponFireW,20*TT);
});
test('one shared step prevents missiles, aircraft and toggles from reusing the same battery rate',()=>{
 const u=unit(),step={};near(fire(u,step),1);near(fire(u,step),0);near(u.energy,90);
 C.setAutomaticPointDefense(u,false);near(fire(u,step),0);C.setAutomaticPointDefense(u,true);C.fleetDefense(u,[{side:1,n:8,pos:[1000,0,0]}]);near(fire(u,step),0);near(u.energy,90);
 near(fire(u,{}),1);near(u.energy,80,'a new simulation step can fire again using its remaining real store');
});
test('automatic firing creates real next-step recharge demand and reduces funded engine output until replenished',()=>{
 const u=unit(),idle=allocate(u);near(idle.got.weapons,0);near(idle.got.engines,100*TT);assert.equal(u.pw.activeWeaponFire,false);
 near(fire(u),1);assert.equal(u.pw.activeWeaponFire,true);const charging=allocate(u);near(charging.got.weapons,20*TT);near(charging.got.engines,80*TT);near(u.pw.requestedWeaponChargeW,20*TT);assert.equal(u.pw.activeCombatPower,true);
 near(C.surfaceManualCharge(u,charging.got.weapons,1),10);near(u.energy,100);C.heatAccrue(u,charging.got,charging.cooling.fixed,1);assert.ok(u.ht.actualGeneratedElectricalJ>0);assert.ok(u.ht.reactorHeatJ>0);assert.ok(u.ht.e.weapon>0,'only actual recharging produces weapon conversion heat');
 const recovered=allocate(u);near(recovered.got.weapons,0);near(recovered.got.engines,idle.got.engines);assert.equal(u.pw.activeCombatPower,false);
});
test('empty, sub-bolt, disconnected, destroyed and overheated mounts cannot fund interception',()=>{
 for(const condition of ['empty','sub-bolt','disconnected','destroyed','overheated','off']){
  const u=unit();if(condition==='empty')u.surfaceBanks[3]=u.energy=0;if(condition==='sub-bolt')u.surfaceBanks[3]=u.energy=.5;if(condition==='disconnected')u.p.modules[2].powerConnected=false;if(condition==='destroyed')u.mods[2]=0;if(condition==='overheated')u.ht.online=false;if(condition==='off')C.setAutomaticPointDefense(u,false);
  const energy=u.energy,heat=copy(u.ht);near(fire(u),0,condition);near(u.energy,energy,condition+' preserves stores');assert.ok(!u.pw?.activeWeaponFire,condition+' has no firing activity');assert.deepEqual(copy(u.ht),heat,condition+' adds no heat');
 }
});
test('a finite depleted bank yields only its paid fraction and never becomes negative',()=>{
 const u=unit();u.surfaceBanks[3]=u.energy=2;near(fire(u),.2);near(u.energy,0);near(u.pointDefenseLastFire.spentTT,2);near(fire(u),0);near(u.energy,0);
});
test('aggregate PD uses its own known output watts and pooled finite stores, leaving unrelated heavy-gun demand out',()=>{
 const u=unit({surface:false,dual:false});u.p.grid.Dw=1e20*TT;near(fire(u),1);near(u.energy,90);near(u.pointDefenseLastFire.inputEquivalentJ,20*TT,'10 output TT needs 20 input TT at actual efficiency');
 const unknown=unit({surface:false,dual:false});delete unknown.p.modules[2].weaponPowerW;near(fire(unknown),0);near(unknown.energy,100,'unmeasured AA rating alone cannot create free shots');
});
test('destroyed or disconnected aggregate shared PD cannot borrow a healthy ordinary battery and its stored power',()=>{
 for(const condition of ['destroyed','disconnected']){
  const u=unit({surface:false});u.p.modules.push({k:'weapon',fit:4,size:1000,share:1,powerConnected:true,weaponPowerW:1e9*TT});u.mods.push(1);
  if(condition==='destroyed')u.mods[2]=0;else u.p.modules[2].powerConnected=false;
  near(fire(u),0,condition);near(u.energy,100);assert.ok(!u.pw?.activeWeaponFire);
 }
});
test('a combat preview clone pays from its own bank without mutating the live firing or heat ledgers',()=>{
 const live=unit();fire(live);const before=copy({energy:live.energy,banks:live.surfaceBanks,heat:live.ht,ledger:live.pointDefenseLastFire,power:live.pw}),preview={...live,...C.combatClone(live),order:{...live.order}};
 near(fire(preview),1);near(preview.energy,80);assert.deepEqual(copy({energy:live.energy,banks:live.surfaceBanks,heat:live.ht,ledger:live.pointDefenseLastFire,power:live.pw}),before);
});
