const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {loadRuntime}=require('../scripts/update-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=loadRuntime(root),P=1e18;
const plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${a} != ${b}`),nearV=(a,b)=>a.forEach((x,i)=>near(x,b[i]));
function paidUnit(hyper=true){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'engine',part:2,port:'p2',domain:'main',size:1,share:1,powerConnected:true},...(hyper?[{k:'hyper',part:3,port:'p3',domain:'main',size:1,share:1,powerConnected:true}]:[])],massKg=1e6,e={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:P,ratedThrustN:P/2e9,wattsPerNewton:2e9,effectiveMachineryVolumeM3:2*Math.PI,machineryLengthM:2,machineryRadiusM:1,machineryShape:'cylinder',driveProfileId:'standard',machineryGradeId:'standard',direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true,pathCapacityW:P};
 const p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Entry transition fixture',hp:1e12,len:100,width:40,height:20,mass:1000,D:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,crewCapacity:1,turnRate:1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),aaArcs:Array(6).fill(0),modules,grid:{P,Pgen:P,fixed:0,cooling:0,De:P,Ds:0,Dw:0,domains:[{id:'main',P,sources:[{moduleIndex:0,P}],modules:modules.map((_,i)=>i)}],powerPaths:['p2','p3'].map(to=>({from:'p1',to,cap:P,ok:true}))},propulsion:{version:C.PROPULSION_MODEL_VERSION,massKg,ratedThrustN:e.ratedThrustN,ratedAccelMps2:e.ratedThrustN/massKg,accelerationLimitMps2:e.ratedThrustN/massKg,engines:[e]},fuel:{version:1,capacityKnown:true,capacityJ:1e32,specificEnergyJPerKg:C.fuelSpecificEnergyJPerKg()}};
 const u=C.fleetUnit('entry-transition','entry-transition',p);C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},.05,'balanced');return u;
}

test('entry acceleration starts at the actual velocity and reaches a finite 0.9c before completion',()=>{
 const u=paidUnit(),v0=[1000,20,-10],s=C.hyperspaceBurstStart(v0,[5,0,0]),duration=C.HYPERSPACE_BURST_SECONDS,target=.9*299792458;
 near(C.HYPERSPACE_BURST_SPEED_MPS,target);near(duration,1.25);near(s.t,0);nearV(s.startVelocity,v0);nearV(s.direction,[1,0,0]);
 const initial=C.hyperspaceBurstStep(u,s,0);nearV(initial.velocity,v0);nearV(initial.displacement,[0,0,0]);assert.equal(initial.complete,false);
 let last=initial.velocity,position=[0,0,0];for(let i=0;i<25;i++){
  const r=C.hyperspaceBurstStep(u,s,duration/25);assert.equal(r.blocked,false);assert.ok(r.velocity.every(Number.isFinite)&&r.displacement.every(Number.isFinite));assert.ok(r.velocity[0]>=last[0]&&r.velocity[0]<=target);assert.ok(Math.abs(r.velocity[1])<=Math.abs(last[1]));
  if(i<24)assert.equal(r.complete,false,'a partial acceleration cannot count as hyperspace entry');position=position.map((p,a)=>p+r.displacement[a]);last=r.velocity;
 }
 nearV(last,[target,0,0]);assert.equal(C.hyperspaceBurstStep(u,s,0).complete,true);near(s.t,duration);
 // Symmetry of the acceleration curve makes the full displacement equal to
 // the mean endpoint velocity over the duration, including initial side slip.
 nearV(position,v0.map((v,a)=>(v+(a===0?target:0))*duration/2));
});

test('actual entry displacement and velocity are independent of frame subdivision',()=>{
 const u=paidUnit(),v=[1200,-35,80],dir=[3,4,0],whole=C.hyperspaceBurstStart(v,dir),split=C.hyperspaceBurstStart(v,dir),dt=C.HYPERSPACE_BURST_SECONDS;
 const one=C.hyperspaceBurstStep(u,whole,dt),pieces=[.03,.11,.17,.04,.22,.31,.37];near(pieces.reduce((a,b)=>a+b,0),dt);
 let displacement=[0,0,0],last;for(const h of pieces){last=C.hyperspaceBurstStep(u,split,h);displacement=displacement.map((v,a)=>v+last.displacement[a]);}
 assert.equal(one.complete,true);assert.equal(last.complete,true);nearV(one.velocity,last.velocity);nearV(one.displacement,displacement);nearV(one.velocity,[.6,.8,0].map(v=>v*C.HYPERSPACE_BURST_SPEED_MPS));
});

test('entry acceleration owns copied initial state and ignores later helm direction changes',()=>{
 const u=paidUnit(),velocity=[1000,0,0],direction=[2,0,0],s=C.hyperspaceBurstStart(velocity,direction);velocity[0]=-1e9;direction[0]=0;direction[2]=1;
 nearV(s.startVelocity,[1000,0,0]);nearV(s.direction,[1,0,0]);u.yaw=Math.PI/2;
 const r=C.hyperspaceBurstStep(u,s,C.HYPERSPACE_BURST_SECONDS,{forwardDirection:[0,0,1]});assert.equal(r.blocked,false);assert.equal(r.complete,true);nearV(r.velocity,[C.HYPERSPACE_BURST_SPEED_MPS,0,0]);
});

test('oversized or invalid time steps cannot overshoot the finite entry target',()=>{
 const u=paidUnit(),s=C.hyperspaceBurstStart([900,0,0],[1,0,0]);for(const dt of [0,-1,NaN,Infinity,-Infinity]){const r=C.hyperspaceBurstStep(u,s,dt);near(s.t,0);nearV(r.velocity,[900,0,0]);nearV(r.displacement,[0,0,0]);assert.equal(r.complete,false);}
 const r=C.hyperspaceBurstStep(u,s,1000);near(s.t,C.HYPERSPACE_BURST_SECONDS);nearV(r.velocity,[C.HYPERSPACE_BURST_SPEED_MPS,0,0]);assert.equal(r.complete,true);near(r.displacement[0],(900+C.HYPERSPACE_BURST_SPEED_MPS)*C.HYPERSPACE_BURST_SECONDS/2);
 const stopped=C.hyperspaceBurstStep(u,s,1);nearV(stopped.displacement,[0,0,0]);nearV(stopped.velocity,r.velocity);assert.equal(stopped.complete,true);
});

for(const failure of ['reactor','hyperdrive','destroyed','disabled'])test(`${failure} loss during entry blocks advancement and cannot finish from its timer`,()=>{
 const u=paidUnit(),s=C.hyperspaceBurstStart([1200,0,0],[1,0,0]),first=C.hyperspaceBurstStep(u,s,.3),before=s.t;assert.equal(first.blocked,false);
 if(failure==='reactor')u.mods[0]=0;else if(failure==='hyperdrive')u.mods[2]=0;else if(failure==='destroyed')u.dead=true;else u.out='戦闘不能';
 const r=C.hyperspaceBurstStep(u,s,10);assert.equal(r.blocked,true);assert.equal(r.complete,false);assert.ok(r.reason);near(s.t,before);nearV(r.velocity,first.velocity);nearV(r.displacement,[0,0,0]);
});

test('a missing hyperdrive cannot acquire the entry acceleration just by creating a state',()=>{
 const u=paidUnit(false),s=C.hyperspaceBurstStart([1000,0,0],[1,0,0]),r=C.hyperspaceBurstStep(u,s,2);assert.equal(r.blocked,true);assert.equal(r.reason,'hyper-unavailable');assert.equal(r.complete,false);near(s.t,0);nearV(r.velocity,[1000,0,0]);nearV(r.displacement,[0,0,0]);
});

test('normal preparation remains cancellable but the near-light entry phase is committed',()=>{
 assert.equal(C.hyperspaceCommitted(null),false);for(const phase of ['spool','accel'])assert.equal(C.hyperspaceCommitted({phase}),false,phase);for(const phase of ['enter','tunnel','exit','brake','arrive'])assert.equal(C.hyperspaceCommitted({phase}),true,phase);
});
