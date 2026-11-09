const assert=require('node:assert/strict'),{test}=require('node:test');
const {C,R,P,near,plain,unit,allocate}=require('./helpers/global-energy-runtime.cjs');
C.HEAT.qAllowJPerKg=1e20;
function world(stirred=false){const p=unit().p,w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[{key:'electrical-loss',p,info:{mass:1000,hyper:1,capital:true,sensor:0}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'electrical-loss'}],[]]}),u=[...w.units.values()][0];u.order={...u.order,type:'hold'};w.stir=stirred?new Map([[u.sys,{t0:w.time,still:0}]]):new Map();return {w,u};}

test('throttle zero and actual weapon recharge remove thrust without disabling live generation',()=>{
 for(const kind of ['idle','weapons']){const u=unit({weaponW:P});u.p.wCap=1;u.energy=0;allocate(u,{throttle:kind==='idle'?0:1,weapons:kind==='weapons'?P:0},.1,kind==='weapons'?'weapons':'balanced');near(u.propulsion.actualInputW,0);near(C.shipElectricalAvailableW(u),P);assert.equal(u.out,null);assert.equal(u.powerLossDisabled,undefined);}
});
test('reserving the whole plant for superweapon charging is not electrical source loss',()=>{
 const u=unit();u.p.sw=[{k:'sbeam',r:1,rk:'gen',mod:5,chargeW:P,Pshare:1}];u.sw=[{st:'charge',c:0}];near(C.shipElectricalAvailableW(u),P);allocate(u,{},0);near(u.pw.P,0);near(u.propulsion.actualInputW,0);assert.equal(u.out,null);assert.equal(C.syncPowerLossDisabled(u),false);
});
test('known source failure creates the existing disabled state and preserves instantaneous velocity',()=>{
 for(const fail of ['reactor','empty-grid','fuel','shutdown','grid']){const u=unit();u.velocity=[100,3,-9];allocate(u,{},0);const velocity=plain(u.velocity);if(fail==='reactor')u.mods[0]=0;if(fail==='empty-grid')u.p.grid.P=0;if(fail==='fuel'){const f=C.shipFuelState(u);f.fuelEnergyJ=f.capacityJ;}if(fail==='shutdown')u.down={black:true,t:10};if(fail==='grid')u.gridState={domains:{main:{trip:10}},local:{}};assert.equal(C.syncPowerLossDisabled(u),true,fail);assert.equal(u.out,'電源喪失');assert.equal(u.powerLossDisabled,true);assert.equal(u.order.type,'hold');near(C.shipElectricalAvailableW(u),0);near(u.engF,0);near(u.propulsion.actualThrustN,0);assert.deepEqual(plain(u.propulsion.forceVector),[0,0,0]);assert.deepEqual(plain(u.velocity),velocity);assert.equal(C.combatClone(u).powerLossDisabled,true);}
});
test('live non-reactor generation survives reactor destruction and exhausted fuel',()=>{
 const u=unit({sourceKind:'dissipator'}),fuel=C.shipFuelState(u);fuel.fuelEnergyJ=fuel.capacityJ;near(C.shipElectricalAvailableW(u),P);C.syncPowerLossDisabled(u);assert.equal(u.out,null);allocate(u,{},.1);assert.ok(u.propulsion.actualInputW>0);
});
test('unknown legacy electrical budgets never acquire a new disabled state',()=>{
 for(const grid of [undefined,{}, {P:NaN}]){const u={p:{grid,modules:[]},out:null,velocity:[4,2,1]};assert.equal(C.shipElectricalAvailableW(u),null);assert.equal(C.syncPowerLossDisabled(u),false);assert.equal(u.out,null);assert.deepEqual(u.velocity,[4,2,1]);}
});
test('thermal blackout disables immediately and the existing crew restart can restore only its own reason',()=>{
 const u=unit();u.velocity=[90,2,7];u.order.type='attack';allocate(u,{},0);C.shipHeatAdd(u,C.shipHeatCapacity(u));assert.equal(u.out,'電源喪失');assert.equal(u.powerLossDisabled,true);assert.equal(u.ht.online,false);assert.deepEqual(plain(u.velocity),[90,2,7]);u.ht.qJ=.8*u.ht.capacityJ;C.powerTick(u,150);near(u.ht.restartWork,.5);assert.equal(u.out,'電源喪失');C.powerTick(u,150);assert.equal(u.ht.online,true);assert.equal(u.out,null);assert.equal(u.powerLossDisabled,undefined);assert.equal(u.order.type,'hold','restoration does not resume the old attack or jump');near(C.shipHeatOutputFactor(u),.6);
});
test('an unmanned thermal shutdown does not invent recovery workers',()=>{
 const u=unit();u.crew=0;C.shipHeatAdd(u,C.shipHeatCapacity(u));u.ht.qJ=0;C.powerTick(u,1000);near(u.ht.restartWork,0);assert.equal(u.ht.online,false);assert.equal(u.out,'電源喪失');
});
test('restored power preserves distinct disabled reasons, bridge or crew loss and death',()=>{
 for(const reason of ['艦橋喪失','乗員不足','回航要員不足']){const u=unit();u.out=reason;u.mods[0]=0;C.syncPowerLossDisabled(u);u.mods[0]=1;C.syncPowerLossDisabled(u);assert.equal(u.out,reason);assert.equal(u.powerLossDisabled,undefined);}
 for(const reason of ['crew','bridge','capture','dead']){const u=unit();u.down={black:true,t:10};C.syncPowerLossDisabled(u);u.down=null;if(reason==='crew')u.crew=0;if(reason==='bridge'){u.p.modules.push({k:'bridge',share:1,size:1});u.mods.push(0);}if(reason==='capture')u.out='回航要員不足';if(reason==='dead')u.dead=true;C.syncPowerLossDisabled(u);assert.equal(u.out,{crew:'乗員不足',bridge:'艦橋喪失',capture:'回航要員不足',dead:'電源喪失'}[reason]);}
});
test('fully automated unmanned ships restore electrical navigation without a false crew failure',()=>{
 const u=unit();u.p.crewNeed=0;u.p.crewMax=0;u.p.autoCrew=100;u.crew=0;u.p.modules.push({k:'automation',share:1,size:1,domain:'main'});u.mods.push(1);u.down={black:true,t:10};C.syncPowerLossDisabled(u);assert.equal(u.out,'電源喪失');u.down=null;C.syncPowerLossDisabled(u);assert.equal(u.out,null);assert.equal(u.powerLossDisabled,undefined);
});
test('quiet and stirred worlds apply the existing disabled fall exactly once per tick',()=>{
 for(const stirred of [false,true]){const {w,u}=world(stirred);u.mods[0]=0;u.velocity=[10,0,0];const position=plain(u.pos),expected=C.integratePropulsionMotion(u,u.velocity,[0,-C.HULL_FALL.g,0],R.TICK);R.tick(w,R.TICK);assert.equal(u.out,'電源喪失');assert.equal(u.powerLossDisabled,true);for(let i=0;i<3;i++){near(u.velocity[i],expected.velocity[i]);near(u.pos[i],position[i]+expected.displacement[i]);}assert.equal(u._fallTime,w.time);assert.equal(R.groupDisabled(w,w.groups.get(u.group)).length,1);assert.equal(R.groupHyper(w,w.groups.get(u.group)),null);}
});
test('a stopped ship in an otherwise quiet world starts falling after loss of power',()=>{
 const {w,u}=world();u.mods[0]=0;u.velocity=[0,0,0];const y=u.pos[1];R.tick(w,R.TICK);assert.equal(u.out,'電源喪失');assert.ok(u.velocity[1]<0);assert.ok(u.pos[1]<y);
});
test('aircraft keep their existing disabled drift, cannot shoot or release stores, and restore owned power loss',()=>{
 const profile=unit().p;profile.profileVersion=C.FLEET_PROFILE_VERSION;R.CRAFT.powerLossFixture={name:'Electrical craft',role:'fighter',mass:1000,speed:1000,powerProfile:profile};const s={id:'power-loss-craft',craft:'powerLossFixture',side:0,n:1,h:[1,0,0],pos:[0,0,0],vel:[40,2,1],ldg:[{kind:'ct1',n:2,salvo:1,mass:1,tt:1,bomb:false}],ammo:[2]};R.squadPropulsion(s,1,0);s.drive.mods[0]=0;const stopped=R.squadPropulsion(s,1,0);assert.equal(s.disabled,'電源喪失');assert.equal(s.powerLossDisabled,true);near(stopped.acc,0);near(stopped.turn,0);near(R.squadLaserK(s),0);near(C.squadFireK(s),0);assert.equal(R.squadArmed(s),false);const w={missiles:[],nextId:1};assert.deepEqual(plain(R.squadRelease(w,0,s,{id:'target',pos:[1,0,0]},false)),[]);assert.deepEqual(s.ammo,[2]);s.drive.mods[0]=1;R.squadPropulsion(s,1,0);assert.equal(s.disabled,undefined);assert.equal(s.powerLossDisabled,undefined);assert.equal(R.squadLaserK(s),1);assert.equal(R.squadArmed(s),true);delete R.CRAFT.powerLossFixture;
});


test('an uncommitted jump is cancelled by actual source loss and does not resume on restoration',()=>{
 const {w,u}=world(),S=w.sector,g=w.groups.get(u.group);S.edges=[{id:0,a:0,b:1,len:.1,kind:'branch'}];S.paths=new Map();S.routes=[];for(const system of S.systems)system.links=[];S.systems[0].links=[0];S.systems[1].links=[0];g.sys=0;u.sys=0;u.info.hyper=1;g.navigation=null;g.spool=null;g.transit=null;
 const result=R.orderJump(w,g.id,1);assert.equal(result.ok,true,result.why);assert.ok(g.spool);u.mods[0]=0;R.tick(w,R.TICK);assert.equal(u.out,'電源喪失');assert.equal(g.spool,null);assert.equal(u.jump,null);assert.equal(g.transit,null);u.mods[0]=1;R.tick(w,R.TICK);assert.equal(u.out,null);assert.equal(g.spool,null);assert.equal(g.sys,0);assert.equal(g.transit,null);
});

test('a powered launcher loses launch permission without consuming its retained ammunition',()=>{
 const u=unit();u.p.modules.push({k:'launcher',part:7,fit:7,port:'f7',domain:'main',powerConnected:true,share:1,size:1,stock:6,missileKind:'legacy'});u.mods.push(1);u.ammo.push(6);allocate(u,{},0);assert.equal(C.missileLauncherPowered(u,6),true);const fuel=C.shipFuelState(u);fuel.fuelEnergyJ=fuel.capacityJ;assert.equal(C.missileLauncherPowered(u,6),false);assert.equal(u.out,'電源喪失');assert.equal(u.ammo[6],6);
});

test('stored weapon charge cannot fire without electrical power and survives until supply returns',()=>{
 const u=unit({weaponW:P});u.p.surface={mounts:[{id:6,module:5,capacity:10,gun:1,ion:0,boltTT:1}]};u.surfaceBanks={6:10};u.energy=10;
 assert.equal(C.surfaceSpend(u,6,1).ok,true);near(C.surfaceMountEnergy(u,6),9);const fuel=C.shipFuelState(u);fuel.fuelEnergyJ=fuel.capacityJ;assert.equal(C.surfaceSpend(u,6,1).ok,false);assert.equal(u.out,'電源喪失');near(C.surfaceMountEnergy(u,6),9);near(u.energy,9);fuel.fuelEnergyJ=0;assert.equal(C.surfaceSpend(u,6,1).ok,true);assert.equal(u.out,null);near(C.surfaceMountEnergy(u,6),8);
});
