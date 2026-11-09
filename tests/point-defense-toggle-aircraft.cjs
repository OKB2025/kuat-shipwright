const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),copy=value=>JSON.parse(JSON.stringify(value)),installed=new Map();
function installedProfile(kind='pd'){
 if(!installed.has(kind)){
  const ship=C.newShip({L:500,W:300,H:160,plan:'rect',sec:'rect'},'Controlled real point-defence carrier');ship.parts=[{id:1,k:'gen',d:100,c:[250,80,0]},{id:3,k:'fuel',d:40,c:[100,80,0]}];ship.fits=[{id:2,k:kind,p:[250,160,0],a:2,ped:0,base:0,low:0,float:false}];ship.nextId=4;const stats=C.computeStats(ship);installed.set(kind,C.fleetProfile(stats,ship.name,ship));
 }
 return copy(installed.get(kind));
}
function stationaryCraftProfile(){
 return {profileVersion:C.FLEET_PROFILE_VERSION,name:'Unarmed stationary test craft',hp:1,len:5,width:4,height:2,crewNeed:0,crewMax:0,crewCapacity:0,D:0,wCap:0,maxSpeed:0,modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1}],grid:{P:1e9,Pgen:1e9,fixed:0,cooling:0,De:0,Ds:0,Dw:0,domains:[{id:'main',P:1e9,sources:[{moduleIndex:0,P:1e9}],modules:[0]}]},propulsion:{version:C.PROPULSION_MODEL_VERSION,inputModelVersion:C.ENGINE_INPUT_MODEL_VERSION,conversionModelVersion:C.ENGINE_CONVERSION_MODEL_VERSION,massKg:1000,conversionMassKg:1000,engines:[],ratedThrustN:0,ratedAccelMps2:0,accelerationLimitMps2:0,structuralAccelerationLimitMps2:0,inertialFactor:1}};
}
function rtsFixture(enabled,kind='pd'){
 const p=installedProfile(kind),w=R.createWorld({region:'kuat',seed:13,sensors:false,designs:[{key:'test',name:'Controlled carrier',p,info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'test',air:[],ground:[],troops:0}],[{design:'test',air:[],ground:[],troops:0}]]}),[u,enemy]=[...w.units.values()],sys=u.sys;
 for(const group of w.groups.values()){group.sys=sys;group.inbound=null;group.order={type:'hold'};}
 for(const ship of [u,enemy])Object.assign(ship,{sys,pos:ship===u?[0,0,0]:[12000,0,0],yaw:ship===u?0:Math.PI,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:false,power:'balanced',aim:'auto',volley:'stream'}});enemy.manual=true;
 C.setAutomaticPointDefense(u,enabled);u.aaLeft=4;u.aaT=.25;
 const key='toggle-stationary-unarmed';R.CRAFT[key]={name:'Stationary unarmed target',short:'Target',role:'fighter',speed:0,aa:0,gun:0,strike:0,armor:1,size:1,crew:0,dims:[5,4,2],stations:[],load:[],powerProfile:stationaryCraftProfile()};
 const squad=R.addSquad(w,enemy,{craft:key,n:4,wingNo:1});Object.assign(squad,{state:'out',sys,pos:[1000,1000,0],vel:[0,0,0],h:[1,0,0],ops:null,t:0,launched:w.time});const wing=w.wings.get(squad.wing);wing.phase='on';assert.equal(R.orderWing(w,wing.id,{type:'cap',point:squad.pos.slice(),radius:500}),true);
 return {w,u,enemy,squad,wing,sys,key};
}
const damage=squad=>squad.n0-squad.n+(squad.hurt||0);

test('the real RTS aircraft clock obeys OFF and ON without borrowing ordinary gun tracking',()=>{
 for(const enabled of [false,true]){
  const f=rtsFixture(enabled),position=f.squad.pos.slice();R.tick(f.w,.25);assert.deepEqual(copy(f.squad.pos),position,'the finite zero-engine target remains stationary');assert.equal(f.squad.n0,4);
  if(enabled){assert.ok(damage(f.squad)>0,'actual automatic point defence damages the aircraft');assert.ok(f.u.aaLeft<4,'actual engagement consumes a fire-control channel');assert.equal(f.u.pdOn,f.squad.id);}
  else{assert.equal(damage(f.squad),0,'disabled defence leaves the aircraft undamaged');assert.equal(f.u.aaLeft,4,'disabled defence consumes no fire-control channel');assert.equal(f.u.pdOn??null,null);assert.equal(f.u.dualDefense,false);}
  assert.ok(f.u.energy>=0,'interception cannot overdraw the real weapon store');delete R.CRAFT[f.key];
 }
 const ordinary=rtsFixture(true,'triple40');R.tick(ordinary.w,.25);assert.equal(damage(ordinary.squad),0,'ordinary guns do not inherit automatic interception when the switch is on');assert.equal(ordinary.u.aaLeft,4);delete R.CRAFT[ordinary.key];
});

test('actual aircraft interception still requires electricity when automatic defence is enabled',()=>{
 const f=rtsFixture(true);f.u.energy=0;f.u.p.grid.P=0;for(const domain of f.u.p.grid.domains||[]){domain.P=0;for(const source of domain.sources||[])source.P=0;}for(let i=0;i<f.u.p.modules.length;i++)if(f.u.p.modules[i].k==='reactor')f.u.mods[i]=0;
 R.tick(f.w,.25);assert.equal(damage(f.squad),0);assert.equal(f.u.aaLeft,4);assert.equal(f.u.energy,0);delete R.CRAFT[f.key];
});

function tacticalProfile(){
 const zeros=()=>Array(6).fill(0),P=C.TT*1000,rate=Array(6).fill(25);
 return {profileVersion:C.FLEET_PROFILE_VERSION,name:'Finite aggregate point-defence battery',len:100,width:40,height:30,mass:1e9,hp:1e9,acc:1,D:0,shieldBuffer:0,reserve:0,crewNeed:0,crewMax:0,autoCrew:0,maxSpeed:0,turnRate:0,wCap:1000,aa:6,aaArcs:Array(6).fill(6),aaCh:4,gunArcs:rate.slice(),ionArcs:zeros(),gunBands:{long:zeros(),mid:rate.slice(),close:zeros()},msl:0,imsl:0,slots:0,launch:0,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'weapon',fit:2,port:'f2',domain:'main',size:1,share:1,pd:true,dualPurpose:true,weaponPowerW:25*C.TT,powerConnected:true}],grid:{P,Pgen:P,fixed:0,cooling:0,De:0,Ds:0,Dw:C.TT*100,domains:[{id:'main',P,sources:[{moduleIndex:0,P}],modules:[0,1]}],powerPaths:[{from:'p1',to:'f2',cap:P,ok:true}]},propulsion:{version:C.PROPULSION_MODEL_VERSION,inputModelVersion:C.ENGINE_INPUT_MODEL_VERSION,conversionModelVersion:C.ENGINE_CONVERSION_MODEL_VERSION,massKg:1e12,conversionMassKg:1e12,engines:[],ratedThrustN:0,ratedAccelMps2:0,accelerationLimitMps2:0,structuralAccelerationLimitMps2:0,inertialFactor:1},dualPurpose:{gunArcs:rate.slice(),gunBands:{long:zeros(),mid:rate.slice(),close:zeros()},aaArcs:Array(6).fill(6),aa:6}};
}
function tacticalFixture(enabled,mode){
 const p=tacticalProfile(),q=copy(p);delete q.dualPurpose;q.aa=0;q.aaArcs=Array(6).fill(0);q.gunArcs=Array(6).fill(0);q.gunBands.mid=Array(6).fill(0);
 const u=C.fleetUnit('defender','own',p,0),enemy=C.fleetUnit('attacker','enemy',q,1);u.pos=[0,0,0];enemy.pos=[12000,0,0];u.yaw=0;enemy.yaw=Math.PI;u.order.fire=false;C.setAutomaticPointDefense(u,enabled);
 if(mode==='air')enemy.air=8;
 else{
  enemy.p.msl=80;enemy.p.modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'launcher',fit:3,port:'f3',domain:'main',name:'Finite missile cell',size:1,share:1,powerConnected:true,stock:6,missileKind:'shipMsl',launcherCells:1,salvo:1,cycle:1.2,tt:25,range:60000,launchPowerW:1e15,muzzle:[10,2,0],launchDir:[1,0,0]}];enemy.mods=[1,1];enemy.ammo=[0,6];enemy.p.grid.fixed=1e15;enemy.p.grid.fixedLoads=[{id:'f3',port:'f3',domain:'main',weight:1e15}];enemy.p.grid.powerPaths=[{from:'p1',to:'f3',cap:enemy.p.grid.P,ok:true}];
 }
 return {u,enemy,battle:C.fleetBattle([u,enemy],true)};
}

test('the actual tactical fleet aircraft-loss path honors the automatic-defence policy',()=>{
 const off=tacticalFixture(false,'air'),on=tacticalFixture(true,'air');for(const f of [off,on])C.fleetTick(f.battle,.25,{collide:false});
 assert.equal(off.enemy.air,8);assert.equal(off.u.dualDefense,false);assert.ok(on.enemy.air<8,'enabled defence reduces the actual abstract attacking flight');assert.equal(on.u.dualDefense,true);assert.ok(on.u.energy>=0);
});

test('the actual tactical missile attenuation path honors OFF while preserving each finite launch',()=>{
 const result=[];for(const enabled of [false,true]){const f=tacticalFixture(enabled,'missile'),shots=C.fleetTick(f.battle,.25,{collide:false}),missile=shots.find(s=>s.from===f.enemy.id);assert.equal(f.enemy.ammo[1],5,'one real missile leaves its finite cell');assert.equal(missile?.launches?.length,1);assert.equal(missile.launches[0].n,1);assert.equal(missile.launches[0].tt,25);result.push({enabled,damage:missile.msl,reserved:f.u.dualDefense,energy:f.u.energy});}
 assert.equal(result[0].reserved,false);assert.equal(result[1].reserved,true);assert.ok(result[0].damage>result[1].damage,'OFF retains the unattenuated missile damage');assert.ok(result[1].damage>0,'point defence does not invent guaranteed destruction');assert.ok(result.every(r=>r.energy>=0));
});
