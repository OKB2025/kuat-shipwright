const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const p of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),cx,{filename:p});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,message='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${message}: ${a} != ${b}`);
function profile(massKg=1e11){
 const input=massKg*500*C.engineConversionCoefficient(massKg);
 return {profileVersion:C.FLEET_PROFILE_VERSION,name:'Finite mass and paid drive',hp:100,len:100,width:40,height:20,mass:massKg/1000,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,maxSpeed:1000,turnRate:.2,
  gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1,at:.5},{k:'engine',part:2,port:'p2',domain:'main',share:1,size:1,at:.1,powerConnected:true},{k:'weapon',fit:3,port:'f3',domain:'main',share:1,size:1,at:.5,powerConnected:true}],
  grid:{P:input,Pgen:input,fixed:0,cooling:0,De:input,Ds:0,Dw:input,powerPaths:[{from:'p1',to:'p2',cap:input,ok:true},{from:'p1',to:'f3',cap:input,ok:true}]},
  propulsion:{version:C.PROPULSION_MODEL_VERSION,massKg,ratedThrustN:massKg*500,ratedAccelMps2:500,accelerationLimitMps2:500,engines:[{id:2,machineryId:2,version:C.PROPULSION_MODEL_VERSION,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:input,ratedThrustN:massKg*500,wattsPerNewton:C.engineConversionCoefficient(massKg),effectiveMachineryVolumeM3:input/3.4e17,driveProfileId:'standard',machineryGradeId:'standard',direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true,pathCapacityW:input}]}};
}
const unit=mass=>C.fleetUnit('mass-motion','mass-motion',profile(mass));
const smallMass=C.ENGINE_CONVERSION.referenceSmallMassKg,largeMass=C.ENGINE_CONVERSION.referenceLargeMassKg,smallRate=3999.1037971899486*C.G0*C.FLEET_RULES.accelScale/2000,largeRate=2972.473437207956*C.G0*C.FLEET_RULES.accelScale/1000,dragExponent=Math.log(largeRate/smallRate)/Math.log(largeMass/smallMass);
const expectedRate=mass=>smallRate*Math.pow(mass/smallMass,dragExponent);

test('resistance uses one measured-mass law with nearly proportional drag force and no class checks',()=>{
 const a=unit(1e11),b=unit(1e11);b.p.propulsion={...b.p.propulsion,massKg:2e11};near(C.massDragRate(b),Math.pow(2,dragExponent)*C.massDragRate(a));near(2e11*C.massDragRate(b)/(1e11*C.massDragRate(a)),Math.pow(2,1+dragExponent));near(C.massDragRate(a),expectedRate(1e11));
 a.p.len=1e8;a.p.shipClass='fighter';near(C.massDragRate(a),expectedRate(1e11));
 near(C.massDragRate({propulsion:{massKg:0},heat:{massKg:1e11}}),expectedRate(1e11));
 near(C.massDragRate({propulsion:{massKg:NaN},heat:{massKg:1e11}}),expectedRate(1e11));
 near(C.massDragRate({mass:1e8}),expectedRate(1e11));assert.equal(C.massDragRate({len:1e8,width:1e8,height:1e8}),0,'unknown mass does not create an assumed force');
});
test('mass-only hulks use the same drag law without inventing a drive or historical half-life',()=>{
 const u={propulsion:{massKg:1e11}},v=[1200,120,-300],out=C.integratePropulsionMotion(u,v,[0,0,0],60),k=expectedRate(1e11);
 const decay=Math.exp(-k*60);for(let i=0;i<3;i++){near(out.velocity[i],v[i]*decay);near(out.displacement[i],v[i]*(1-decay)/k);}
 assert.deepEqual(v,[1200,120,-300],'integration does not mutate the caller');
 const tiny=C.integratePropulsionMotion({propulsion:{massKg:1e4}},v,[0,0,0],60);assert.ok(tiny.velocity[0]>out.velocity[0],'a smaller known mass experiences the lower common drag rate');near(tiny.velocity[0],v[0]*Math.exp(-expectedRate(1e4)*60));
});
test('the unoriented thrust and drag model retains exact velocity and displacement under time subdivision',()=>{
 const u=unit(1e11),v=[1000,20,-15],a=[4,-.5,2],one=C.integratePropulsionMotion(u.p,v,a,12);let velocity=v.slice(),position=[0,0,0];
 for(let i=0;i<120;i++){const q=C.integratePropulsionMotion(u.p,velocity,a,.1);velocity=q.velocity;position=C.add(position,q.displacement);}
 for(let i=0;i<3;i++){near(velocity[i],one.velocity[i]);near(position[i],one.displacement[i]);}
 for(const dt of [0,-1,NaN,Infinity]){const q=C.integratePropulsionMotion(u.p,v,a,dt);assert.deepEqual(plain(q.velocity),v);assert.deepEqual(plain(q.displacement),[0,0,0]);}
 const slow=C.integratePropulsionMotion(u.p,[1,0,0],[0,0,0],1e7);assert.ok(slow.velocity.every(Number.isFinite));assert.ok(slow.velocity[0]>=0);assert.ok(slow.displacement.every(Number.isFinite));
});
test('funded acceleration has a finite mass-dependent equilibrium rather than a free constant-speed coast',()=>{
 const u=unit(1e11),k=expectedRate(1e11),full=C.integratePropulsionMotion(u,[0,0,0],[1,0,0],10/k),quarter=C.integratePropulsionMotion(u,[0,0,0],[.25,0,0],10/k);
 near(full.velocity[0],(1-Math.exp(-10))/k);near(quarter.velocity[0],full.velocity[0]/4);
 assert.ok(full.velocity[0]<1/k&&full.velocity[0]>.99/k);
});
test('holding velocity requests actual engine electricity and heat through the existing solver',()=>{
 const u=unit(1e11),v=[.25/expectedRate(1e11),0,0],dt=.25,required=C.propulsionTargetAcceleration(u,v,v,dt),rated=C.propulsionMotion(u).acc0;
 assert.ok(required[0]>0);C.allocateShipPower(u,C.fleetSystems(u),{throttle:C.len(required)/rated,shields:0,weapons:0},dt,'balanced');
 assert.ok(u.propulsion.actualInputW>0);assert.ok(u.propulsion.wasteHeatW>0);const a=C.propulsionMotion(u).acc,q=C.integratePropulsionMotion(u,v,[a,0,0],dt);near(q.velocity[0],v[0]);
});
test('100 percent weapon priority preserves paid shots but cannot preserve a large ship speed',()=>{
 const u=unit(1e11),v=[1000,0,0],dt=.25,R=u.p.grid.P;u.order={...u.order,power:'weapons'};u.maneuver=1;u.velocity=v.slice();
 C.fleetPowerStep(u,C.fleetSystems(u),null,R/C.TT,dt);
 near(u.pw.wpn,R);near(u.propulsion.actualInputW,0);assert.equal(C.propulsionMotion(u).acc,0);assert.ok(!u.out,'weapon priority retains live electrical power even when propulsion receives none');
 const q=C.integratePropulsionMotion(u,v,[0,0,0],dt);assert.ok(q.velocity[0]<v[0]);near(q.velocity[0],v[0]*Math.exp(-expectedRate(1e11)*dt));
});
test('thermal blackout and broken machinery remove thrust while the same passive mass resistance remains',()=>{
 for(const stop of ['thermal','engine','reactor']){const u=unit(1e11);C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},.1,'balanced');if(stop==='thermal')u.ht.online=false;else{u.mods[stop==='engine'?1:0]=0;C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},.1,'balanced');}
  assert.equal(C.propulsionMotion(u).acc,0,stop);const q=C.integratePropulsionMotion(u,[1000,0,0],[0,0,0],10);near(q.velocity[0],1000*Math.exp(-expectedRate(1e11)*10));
 }
});
test('historical speed options cannot clip funded force or pin a ship at the old maximum',()=>{
 const u={propulsion:{massKg:0}},q=C.integratePropulsionMotion(u,[900,0,0],[100,0,0],2,{maxSpeed:1000});near(q.velocity[0],1100);near(q.thrustFraction,1);near(q.displacement[0],2000);
 const drift=C.integratePropulsionMotion(unit(1e11),[2000,0,0],[0,0,0],2,{maxSpeed:1000});assert.ok(drift.velocity[0]>1000);near(drift.velocity[0],2000*Math.exp(-expectedRate(1e11)*2));
 const powered=C.integratePropulsionMotion(u,[2000,0,0],[100,0,0],2,{maxSpeed:1000});near(powered.velocity[0],2200);near(powered.displacement[0],4200);
});
test('both fleet clocks use disabled motion on total power loss with the existing gravity setting',()=>{
 for(const kind of ['tactical','peace']){const u=unit(1e11);u.velocity=[1000,20,-40];u.order={...u.order,type:'move',point:[10000,0,0]};u.p.grid.P=0;u.p.grid.Pgen=0;const start=u.pos.slice(),want=C.integratePropulsionMotion(u,u.velocity,kind==='peace'?[0,-C.HULL_FALL.g,0]:[0,0,0],.25);
  if(kind==='tactical')C.fleetTick(C.fleetBattle([u],false),.25,{collide:false});else{u.sys=0;u.side=0;u.info={mass:1e8};R.peaceTick({time:10,units:new Map([[u.id,u]]),groups:new Map(),ctgs:new Map(),battles:new Map(),sides:[],sensors:false},0,.25);}
  assert.equal(u.out,'電源喪失',kind);
  for(let i=0;i<3;i++){near(u.velocity[i],want.velocity[i],kind);near(u.pos[i],start[i]+want.displacement[i],kind);}
 }
});
test('a disabled vessel gravity integration uses the same drag once per tick',()=>{
 const u=unit(1e11);u.velocity=[1000,0,0];u.out='disabled';const before=u.pos.slice(),expected=C.integratePropulsionMotion(u,u.velocity,[0,-C.HULL_FALL.g,0],.25);
 C.hullFall(u,.25,()=>.5);for(let i=0;i<3;i++){near(u.velocity[i],expected.velocity[i]);near(u.pos[i],before[i]+expected.displacement[i]);}
});
test('releasing a powerless pilot into a quiet world uses the disabled drift clock once',()=>{
 const p=profile(1e11),w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[{key:'mass-motion',p,info:{mass:1e8,hyper:null,capital:true,sensor:0}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'mass-motion'}],[]]}),u=[...w.units.values()][0];
 u.manual=false;u.order={...u.order,type:'hold'};u.velocity=[1000,20,0];u.p.grid.P=0;u.p.grid.Pgen=0;w.stir=new Map();
 const before=u.pos.slice(),expected=C.integratePropulsionMotion(u,u.velocity,[0,-C.HULL_FALL.g,0],.25);R.tick(w,.25);
 assert.equal(u.out,'電源喪失');
 assert.equal(w.stir.has(u.sys),false,'disabled gravity continues without retaining an active maneuver registry entry');for(let i=0;i<3;i++){near(u.velocity[i],expected.velocity[i]);near(u.pos[i],before[i]+expected.displacement[i]);}
});
test('a disabled stirred world advances gravity and mass resistance once, not in both peace and drift passes',()=>{
 const p=profile(1e11),w=R.createWorld({mode:'test',region:'kuat',seed:13,sensors:false,designs:[{key:'mass-fall',p,info:{mass:1e8,hyper:null,capital:true,sensor:0}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'mass-fall'}],[]]}),u=[...w.units.values()][0];
 u.out='disabled';u.velocity=[1000,0,0];u.p.grid.P=0;u.p.grid.Pgen=0;w.stir=new Map([[u.sys,{t0:w.time,still:0}]]);
 const before=u.pos.slice(),expected=C.integratePropulsionMotion(u,u.velocity,[0,-C.HULL_FALL.g,0],.25);R.tick(w,.25);
 for(let i=0;i<3;i++){near(u.velocity[i],expected.velocity[i]);near(u.pos[i],before[i]+expected.displacement[i]);}
});
test('main nozzle intensity follows funded manual thrust rather than steering-only electrical draw',()=>{
 const u=unit(1e11);u.propulsion={outputRatio:.5};u.manual=true;u.mainThrustShare=.5;near(C.engineLevel(u),.25);u.mainThrustShare=0;near(C.engineLevel(u),0);u.manual=false;near(C.engineLevel(u),.5);C.heatInit(u);u.ht.online=false;near(C.engineLevel(u),0);
});
