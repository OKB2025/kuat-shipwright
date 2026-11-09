const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${a} != ${b}`);
function profile(tractor=false){
 const modules=[{k:'reactor',part:1,port:'p1',name:'reactor',share:1,size:1,domain:'main',at:.5},{k:'engine',part:2,port:'p2',name:'engine',share:1,size:1,domain:'main',at:.1,powerConnected:true}];if(tractor)modules.push({k:'weapon',part:3,port:'p3',name:C.FITS.trc.short,share:1,size:1,domain:'main',at:.5,powerConnected:true});
 const e={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:1e18,wattsPerNewton:2e9,ratedThrustN:5e8,driveProfileId:'standard',machineryGradeId:'standard',effectiveMachineryVolumeM3:1e18/3.4e17,direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true};
 const src=(k,id,m)=>({k,id,n:id,g:'high',sh:1,st:1e30,m,pc:[],sec:-1,sw:-1,gen:-1});
 return {profileVersion:4,name:'boarding power',hp:1e9,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:0,crewMax:0,len:10,width:4,height:3,maxSpeed:1000,accel:999999,turnRate:.1,trac:tractor?1:0,acc:1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,grid:{P:1e18,Pgen:1e18,Paux:0,fixed:0,cooling:0,De:1e18,Ds:0,Dw:0,domains:[{id:'main',P:1e18,sources:[{moduleIndex:0,P:1e18}],modules:modules.map((_,i)=>i)}]},propulsion:{version:1,engines:[e],massKg:1e6,ratedThrustN:5e8,ratedAccelMps2:500,accelerationLimitMps2:500},heat:{v:1,src:[src('reactor','p1',[0]),src('engine','p2',[1]),src('hotel','hotel',[])],dis:[],ln:[]}};
}
function world(hostile=true,{fixed=false}={}){
 const p=profile(true);if(fixed){p.grid.fixed=1e17;p.grid.fixedLoads=[{id:'p3',port:'p3',domain:'main',weight:1}];p.grid.powerPaths=[{from:'p1',to:'p3',cap:1e17,ok:true},{from:'p1',to:'p2',cap:1e18,ok:true}];}
 const definitions=[{key:'captor',p,info:{mass:1000,hyper:null,capital:false,sensor:0}},{key:'target',p:profile(),info:{mass:1000,hyper:null,capital:false,sensor:0}}],w=R.createWorld({mode:'test',region:'kuat',seed:19,sensors:false,convoyMode:false,designs:definitions,sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:hostile?[[{design:'captor'}],[{design:'target'}]]:[[{design:'captor'},{design:'target'}],[]]});
 const a=[...w.units.values()].find(u=>u.design==='captor'),t=[...w.units.values()].find(u=>u.design==='target');t.sys=a.sys;w.groups.get(t.group).sys=a.sys;w.timers.det=w.timers.tac=w.timers.ai=1e9;w.stir=new Map();
 for(const u of [a,t]){u.pos=[u===a?0:3000,1000,0];u.velocity=[0,0,0];u.order={...u.order,type:'hold',fire:false,power:'balanced'};u.maneuver=0;C.heatInit(u);u.ht.t=0;}
 a.tractor={target:t.id,mode:hostile?'capture':'tow',lock:true,off:[0,0,8000],dyaw:0,phase:'fight',strain:0,t:0};t.towedBy=a.id;if(!hostile)t.out='disabled';return {w,a,t};
}
test('boarding uses the finite resultant actual force, with no planned acceleration or repeated engine damage',()=>{
 const a=C.fleetUnit('a','captor',profile(true)),t=C.fleetUnit('t','target',profile());t.info={mass:1000};t.mods[1]=.25;t.engF=.25;t.p.accel=1e30;t.propulsion={actualThrustN:1.25e8,forceVector:[1.25e8,0,0]};
 near(R.boardStrain(a,t),1.25e8*C.FLEET_RULES.accelScale/1000/R.BOARD.projHold);
 for(const vector of [[0,0,0],[Infinity,0,0],[NaN,0,0]]){t.propulsion={actualThrustN:1e30,forceVector:vector};near(R.boardStrain(a,t),0);}delete t.propulsion;near(R.boardStrain(a,t),0);
});
test('a physically wired projector uses its actual input once without repeating source damage',()=>{
 const p=profile(true);p.grid.fixed=1e17;p.grid.fixedLoads=[{id:'p3',port:'p3',domain:'main',weight:1}];p.grid.powerPaths=[{from:'p1',to:'p3',cap:1e17,ok:true}];const a=C.fleetUnit('a','captor',p),t=C.fleetUnit('t','target',profile());a.mods[0]=.05;C.allocateShipPower(a,C.fleetSystems(a),{throttle:0},0,'balanced');near(a.propulsion.power.granted['fixed:p3'],5e16);
 t.propulsion={forceVector:[1e8,0,0]};near(R.boardStrain(a,t),1e8*C.FLEET_RULES.accelScale/1000/(R.BOARD.projHold*.5));
});
for(const failure of ['domain','projector'])test(`${failure} protective blackout releases a capture lock before changing the target pose`,()=>{
 const {w,a,t}=world(),position=plain(t.pos),velocity=plain(t.velocity),yaw=t.yaw;a.gridState=failure==='domain'?{domains:{main:{trip:10}},local:{}}:{domains:{},local:{2:10}};
 R.tick(w,.25);assert.equal(a.tractor,null);assert.equal(t.towedBy,null);assert.deepEqual(plain(t.pos),position);assert.deepEqual(plain(t.velocity),velocity);near(t.yaw,yaw);
});
test('hostile capture resistance consumes real input and clears for a non-capture lock',()=>{
 const {w,a,t}=world();R.tick(w,.25);assert.equal(t._tractorResistance,1);near(t.propulsion.actualInputW,1e18);assert.ok(R.boardStrain(a,t)>0);assert.ok(t.propulsion.actualInputW<=t.pw.P);
 a.tractor.mode='tow';R.tick(w,.25);near(t._tractorResistance,0);near(t.propulsion.actualInputW,0);
});
test('an unstirred peaceful tow receives one current fixed-projector allocation before moving its target',()=>{
 const {w,a,t}=world(false,{fixed:true});assert.equal(w.stir.size,0);R.tick(w,.25);assert.ok(a.tractor?.lock);assert.equal(a._peacePowerTime,w.time);near(a.propulsion.power.granted['fixed:p3'],1e17);
 const h=a.ht,total=h.qJ+Object.values(h.e).reduce((n,v)=>n+v,0)+h.reactorE.reduce((n,v)=>n+v,0)+h.engineE.reduce((n,v)=>n+v,0);near(total,1.04*1e17*.25);near(t._tractorResistance,0);
});
test('a friendly tow also releases on local projector cutoff before applying its locked offset',()=>{
 const {w,a,t}=world(false);a.gridState={domains:{},local:{2:10}};const position=plain(t.pos);R.tick(w,.25);assert.equal(a.tractor,null);assert.equal(t.towedBy,null);assert.ok(Math.hypot(...t.pos.map((v,i)=>v-position[i]))<1,'the beam did not snap the target to its old offset');
});
