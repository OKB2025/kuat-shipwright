const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {loadRuntime}=require('../scripts/update-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=loadRuntime(root),P=1e18;
const plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${a} != ${b}`),nearV=(a,b)=>a.forEach((x,i)=>near(x,b[i])),
 rel=(a,b,tol=1e-9)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol*Math.max(Math.abs(a),Math.abs(b)),`${a} != ${b} (relative ${tol})`),len=v=>Math.hypot(...v),deg=Math.PI/180,MASS=1e6;
function paidUnit(hyper=true){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'engine',part:2,port:'p2',domain:'main',size:1,share:1,powerConnected:true},...(hyper?[{k:'hyper',part:3,port:'p3',domain:'main',size:1,share:1,powerConnected:true}]:[])],massKg=1e6,e={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:P,ratedThrustN:P/2e9,wattsPerNewton:2e9,effectiveMachineryVolumeM3:2*Math.PI,machineryLengthM:2,machineryRadiusM:1,machineryShape:'cylinder',driveProfileId:'standard',machineryGradeId:'standard',direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true,pathCapacityW:P};
 const p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Entry transition fixture',hp:1e12,len:100,width:40,height:20,mass:1000,D:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,crewCapacity:1,turnRate:1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),aaArcs:Array(6).fill(0),modules,grid:{P,Pgen:P,fixed:0,cooling:0,De:P,Ds:0,Dw:0,domains:[{id:'main',P,sources:[{moduleIndex:0,P}],modules:modules.map((_,i)=>i)}],powerPaths:['p2','p3'].map(to=>({from:'p1',to,cap:P,ok:true}))},propulsion:{version:C.PROPULSION_MODEL_VERSION,massKg,ratedThrustN:e.ratedThrustN,ratedAccelMps2:e.ratedThrustN/massKg,accelerationLimitMps2:e.ratedThrustN/massKg,engines:[e]},fuel:{version:1,capacityKnown:true,capacityJ:1e32,specificEnergyJPerKg:C.fuelSpecificEnergyJPerKg()}};
 const u=C.fleetUnit('entry-transition','entry-transition',p);C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},.05,'balanced');
 // v27 the burst pays its kinetic energy from the hyperdrive store, so the fixture starts charged to need.
 u.hyperE=C.hyperChargeNeedJ(u.p);return u;
}

test('entry acceleration starts at the actual velocity and reaches a finite 0.5c before completion',()=>{
 const u=paidUnit(),v0=[1000,20,-10],s=C.hyperspaceBurstStart(v0,[5,0,0]),duration=C.HYPERSPACE_BURST_SECONDS,target=.5*299792458,storeBefore=u.hyperE;
 near(C.HYPERSPACE_BURST_SPEED_MPS,target);near(duration,1.25);near(s.t,0);nearV(s.startVelocity,v0);nearV(s.direction,[1,0,0]);
 const initial=C.hyperspaceBurstStep(u,s,0);nearV(initial.velocity,v0);nearV(initial.displacement,[0,0,0]);assert.equal(initial.complete,false);
 let last=initial.velocity,position=[0,0,0];for(let i=0;i<25;i++){
  const r=C.hyperspaceBurstStep(u,s,duration/25);assert.equal(r.blocked,false);assert.ok(r.velocity.every(Number.isFinite)&&r.displacement.every(Number.isFinite));assert.ok(r.velocity[0]>=last[0]&&r.velocity[0]<=target);assert.ok(Math.abs(r.velocity[1])<=Math.abs(last[1]));
  assert.ok(u.hyperE>=0&&u.hyperE<=storeBefore,'the store only falls during the burst');
  if(i<24)assert.equal(r.complete,false,'a partial acceleration cannot count as hyperspace entry');position=position.map((p,a)=>p+r.displacement[a]);last=r.velocity;
 }
 nearV(last,[target,0,0]);assert.equal(C.hyperspaceBurstStep(u,s,0).complete,true);near(s.t,duration);
 // Symmetry of the acceleration curve makes the full displacement equal to
 // the mean endpoint velocity over the duration, including initial side slip.
 nearV(position,v0.map((v,a)=>(v+(a===0?target:0))*duration/2));
 // The drive paid exactly the kinetic energy it added: KE(0.5c)-KE(|v0|), relativistic.
 near(storeBefore-u.hyperE,C.hyperKineticJ(MASS,target)-C.hyperKineticJ(MASS,len(v0)));
});

test('actual entry displacement and velocity are independent of frame subdivision',()=>{
 // Each burst draws its own unit's store, so the whole and the split burst fly separate, equally charged units.
 const u=paidUnit(),w=paidUnit(),v=[1200,-35,80],dir=[3,4,0],whole=C.hyperspaceBurstStart(v,dir),split=C.hyperspaceBurstStart(v,dir),dt=C.HYPERSPACE_BURST_SECONDS,need=C.hyperUnitNeedJ(u);
 const one=C.hyperspaceBurstStep(u,whole,dt),pieces=[.03,.11,.17,.04,.22,.31,.37];near(pieces.reduce((a,b)=>a+b,0),dt);
 let displacement=[0,0,0],last;for(const h of pieces){last=C.hyperspaceBurstStep(w,split,h);displacement=displacement.map((v,a)=>v+last.displacement[a]);}
 assert.equal(one.complete,true);assert.equal(last.complete,true);nearV(one.velocity,last.velocity);nearV(one.displacement,displacement);nearV(one.velocity,[.6,.8,0].map(v=>v*C.HYPERSPACE_BURST_SPEED_MPS));
 near(need-u.hyperE,need-w.hyperE);rel(need-u.hyperE,C.hyperKineticJ(MASS,C.HYPERSPACE_BURST_SPEED_MPS)-C.hyperKineticJ(MASS,len(v)));
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

for(const failure of ['reactor','hyperdrive','destroyed','disabled','stored charge'])test(`${failure} loss during entry blocks advancement and cannot finish from its timer`,()=>{
 const u=paidUnit(),s=C.hyperspaceBurstStart([1200,0,0],[1,0,0]),first=C.hyperspaceBurstStep(u,s,.3),before=s.t;assert.equal(first.blocked,false);
 if(failure==='reactor')u.mods[0]=0;else if(failure==='hyperdrive')u.mods[2]=0;else if(failure==='destroyed')u.dead=true;else if(failure==='stored charge')u.hyperE=0;else u.out='戦闘不能';
 const r=C.hyperspaceBurstStep(u,s,10);assert.equal(r.blocked,true);assert.equal(r.complete,false);assert.ok(r.reason);near(s.t,before);nearV(r.velocity,first.velocity);nearV(r.displacement,[0,0,0]);
 if(failure==='stored charge'){
  // An empty store holds the burst where it is (not an abort): nothing is drawn, and a recharge lets it finish from the same point.
  assert.equal(r.reason,'hyper-charging');assert.equal(u.hyperE,0);u.hyperE=C.hyperUnitNeedJ(u);
  const resumed=C.hyperspaceBurstStep(u,s,10);assert.equal(resumed.blocked,false);assert.equal(resumed.complete,true);nearV(resumed.velocity,[C.HYPERSPACE_BURST_SPEED_MPS,0,0]);
 }
});

test('a missing hyperdrive cannot acquire the entry acceleration just by creating a state',()=>{
 const u=paidUnit(false),s=C.hyperspaceBurstStart([1000,0,0],[1,0,0]),r=C.hyperspaceBurstStep(u,s,2);assert.equal(r.blocked,true);assert.equal(r.reason,'hyper-unavailable');assert.equal(r.complete,false);near(s.t,0);nearV(r.velocity,[1000,0,0]);nearV(r.displacement,[0,0,0]);
});

test('normal preparation remains cancellable but the near-light entry phase is committed',()=>{
 assert.equal(C.hyperspaceCommitted(null),false);for(const phase of ['spool','accel'])assert.equal(C.hyperspaceCommitted({phase}),false,phase);for(const phase of ['enter','tunnel','exit','brake','arrive'])assert.equal(C.hyperspaceCommitted({phase}),true,phase);
});

// v27 (user decision 2026-11-17「充電をさらに大きくして最高速度70%ルールは無くして自動的に光速の50%まで加速してから突入」):
// the charge holds the burst's kinetic energy, the drive pays it as the speed rises, and there is no sublight speed gate.
test('the entry burst pays its relativistic kinetic energy from the hyperdrive store as the speed rises',()=>{
 const c=C.SPEED_OF_LIGHT_MPS,vb=C.HYPERSPACE_BURST_SPEED_MPS;near(c,299792458);near(vb,.5*c);
 // (gamma-1)c^2 per kilogram at 0.5c, from the textbook formula rather than the engine's expm1 form.
 rel(C.HYPER_ENTRY_KE_PER_KG,(1/Math.sqrt(1-.25)-1)*c*c,1e-12);rel(C.hyperKineticJ(1,vb),C.HYPER_ENTRY_KE_PER_KG,1e-12);
 rel(C.hyperKineticJ(MASS,1000),.5*MASS*1000*1000,1e-9);assert.equal(C.hyperKineticJ(MASS,0),0);
 const u=paidUnit(),need=C.hyperUnitNeedJ(u);rel(need,C.HYPER_ENTRY_KE_PER_KG*MASS,1e-12);near(u.hyperE,need);
 // A unit charged to need bursts from rest; half a second in it has paid exactly the kinetic energy it then has.
 const s=C.hyperspaceBurstStart([0,0,0],[1,0,0]),half=C.hyperspaceBurstStep(u,s,.5);assert.equal(half.blocked,false);assert.equal(half.complete,false);
 assert.ok(len(half.velocity)>0&&len(half.velocity)<vb);rel(need-u.hyperE,C.hyperKineticJ(MASS,len(half.velocity)));rel(s.spentJ,need-u.hyperE);
 const rest=C.hyperspaceBurstStep(u,s,10);assert.equal(rest.blocked,false);assert.equal(rest.complete,true);nearV(rest.velocity,[vb,0,0]);
 rel(need-u.hyperE,C.hyperKineticJ(MASS,vb));assert.ok(u.hyperE>=0&&u.hyperE<=need*1e-9,`a store charged to need is spent by the burst from rest (left ${u.hyperE})`);
 // The jump field part of the charge (HYPER_CHARGE.seconds of Dj) is not touched by the burst: it is left for tunnel entry.
 const f=paidUnit(),Dj=1e19;f.p.grid.Dj=Dj;const fieldJ=C.HYPER_CHARGE.seconds*Dj;rel(C.hyperUnitNeedJ(f),fieldJ+C.HYPER_ENTRY_KE_PER_KG*MASS,1e-12);f.hyperE=C.hyperUnitNeedJ(f);
 assert.equal(C.hyperspaceBurstStep(f,C.hyperspaceBurstStart([0,0,0],[1,0,0]),10).complete,true);rel(f.hyperE,fieldJ);
 // A towed hull rides the burst too: a start state with the combined mass draws for both, and so does the unit's own tow mass.
 const tow=5e5,total=MASS+tow,towNeed=C.hyperChargeNeedJ(paidUnit().p,tow);rel(towNeed,C.HYPER_ENTRY_KE_PER_KG*total,1e-12);
 const a=paidUnit();a.hyperE=towNeed;const sa=C.hyperspaceBurstStart([0,0,0],[1,0,0],total);assert.equal(sa.massKg,total);assert.equal(C.hyperspaceBurstStep(a,sa,10).complete,true);rel(towNeed-a.hyperE,C.hyperKineticJ(total,vb));
 const b=paidUnit();b.hyperTowKg=tow;rel(C.hyperUnitNeedJ(b),towNeed,1e-12);b.hyperE=C.hyperUnitNeedJ(b);const sb=C.hyperspaceBurstStart([0,0,0],[1,0,0]);assert.equal(sb.massKg,null);
 assert.equal(C.hyperspaceBurstStep(b,sb,10).complete,true);rel(towNeed-b.hyperE,C.hyperKineticJ(total,vb));
 // A store charged for its own hull only cannot carry the tow: the burst holds at its start, with nothing drawn.
 const o=paidUnit(),own=o.hyperE,so=C.hyperspaceBurstStart([0,0,0],[1,0,0],total),held=C.hyperspaceBurstStep(o,so,10);
 assert.equal(held.blocked,true);assert.equal(held.reason,'hyper-charging');assert.equal(held.complete,false);assert.equal(so.t,0);assert.equal(o.hyperE,own);assert.equal(so.spentJ,0);nearV(held.velocity,[0,0,0]);
});

test('an empty or short store holds the burst without drawing, and the drive pays a step only in full',()=>{
 const e=paidUnit();e.hyperE=0;const s=C.hyperspaceBurstStart([100,0,0],[1,0,0]),r=C.hyperspaceBurstStep(e,s,.4);
 assert.equal(r.blocked,true);assert.equal(r.reason,'hyper-charging');assert.equal(r.complete,false);assert.equal(s.t,0);nearV(r.velocity,[100,0,0]);nearV(r.displacement,[0,0,0]);assert.equal(e.hyperE,0);assert.equal(s.spentJ,0);
 // The cost of that 0.4 s step, measured on a fully charged twin.
 const twin=paidUnit(),ts=C.hyperspaceBurstStart([100,0,0],[1,0,0]),tr=C.hyperspaceBurstStep(twin,ts,.4),costJ=C.hyperUnitNeedJ(twin)-twin.hyperE;assert.equal(tr.blocked,false);
 rel(costJ,C.hyperKineticJ(MASS,len(tr.velocity))-C.hyperKineticJ(MASS,100));
 e.hyperE=costJ*.5;const short=C.hyperspaceBurstStep(e,s,.4);assert.equal(short.blocked,true);assert.equal(short.reason,'hyper-charging');assert.equal(s.t,0);assert.equal(e.hyperE,costJ*.5,'a short store is not drained by a refused step');
 e.hyperE=costJ;const paid=C.hyperspaceBurstStep(e,s,.4);assert.equal(paid.blocked,false);near(s.t,.4);nearV(paid.velocity,tr.velocity);assert.ok(e.hyperE>=0&&e.hyperE<=costJ*1e-9);rel(s.spentJ,costJ);
 // A zero-length step costs nothing and is never held.
 const z=paidUnit();z.hyperE=0;const zs=C.hyperspaceBurstStart([0,0,0],[1,0,0]),zr=C.hyperspaceBurstStep(z,zs,0);assert.equal(zr.blocked,false);assert.equal(z.hyperE,0);
});

test('an aborted burst refunds what it drew, capped at the need, and only once',()=>{
 const u=paidUnit(),need=C.hyperUnitNeedJ(u),s=C.hyperspaceBurstStart([0,0,0],[1,0,0]);C.hyperspaceBurstStep(u,s,.5);C.hyperspaceBurstStep(u,s,.3);
 const drawn=need-u.hyperE;assert.ok(drawn>0);rel(s.spentJ,drawn);C.hyperspaceBurstRefund(u,s);near(u.hyperE,need);assert.ok(u.hyperE<=need);assert.equal(s.spentJ,0);
 C.hyperspaceBurstRefund(u,s);near(u.hyperE,need);
 // Charged meanwhile: the refund tops the store up to need and no further.
 const v=paidUnit(),vs=C.hyperspaceBurstStart([0,0,0],[1,0,0]);C.hyperspaceBurstStep(v,vs,.7);const vd=need-v.hyperE;v.hyperE=need-vd/2;C.hyperspaceBurstRefund(v,vs);assert.equal(v.hyperE,need);
 // Tolerant of nothing to refund.
 assert.doesNotThrow(()=>{C.hyperspaceBurstRefund(null,vs);C.hyperspaceBurstRefund(v,null);});assert.equal(v.hyperE,need);
});

test('hyperspace readiness has no sublight speed term',()=>{
 const u=paidUnit(),max=C.propulsionTerminalSpeed(u);assert.ok(Number.isFinite(max)&&max>0);
 const removed=['speedReady','requiredForwardSpeedMps','healthyMaximumSpeedMps','forwardSpeedMps','speedFraction'];
 // At rest, flying backwards at full speed, sliding sideways, just under the old 70% gate, or pointed the other way: once powered and charged, ready.
 for(const v of [[0,0,0],[-max,0,0],[0,0,max],[0,0,-1e6],[.69*max,0,0],[-1e7,0,0],[1e-9,0,0]])for(const yaw of [0,Math.PI/2,Math.PI]){
  u.yaw=yaw;for(const options of [{},{requireCharge:true},{requireCharge:true,load:0},{load:0}]){
   const r=C.hyperspaceReadiness(u,v,null,options),label=JSON.stringify({v,yaw,options});
   assert.equal(r.ready,true,label);assert.equal(r.reason,null,label);assert.equal(r.powerReady,true,label);assert.equal(r.chargeReady,true,label);assert.equal(r.headingReady,true,label);
   for(const k of removed)assert.equal(k in r,false,`${k} is gone (${label})`);near(r.chargeNeedJ,C.hyperUnitNeedJ(u));
  }
  const jump=C.hyperspaceReadiness(u,v,[1,0,0],{requireCharge:true});assert.equal(jump.ready,true,`along +x at yaw ${yaw} (no alignment option)`);
 }
 // No input combination yields the old 'accelerating' refusal; the reasons follow
 // disabled > hyper-unavailable > hyper-unpowered > hyper-charging > aligning.
 const allowed=new Set(['disabled','hyper-unavailable','hyper-unpowered','hyper-charging','aligning',null]);let checked=0;
 for(const failure of ['none','reactor','hyperdrive','destroyed','disabled','missing'])for(const charge of [0,.5,1])for(const options of [{},{requireCharge:true},{alignWithinRad:C.HYPERSPACE_ALIGN_RAD},{requireCharge:true,alignWithinRad:C.HYPERSPACE_ALIGN_RAD},{requireCharge:true,load:0}]){
  const w=paidUnit(failure!=='missing');w.hyperE=C.hyperUnitNeedJ(w)*charge;
  if(failure==='reactor')w.mods[0]=0;else if(failure==='hyperdrive')w.mods[2]=0;else if(failure==='destroyed')w.dead=true;else if(failure==='disabled')w.out='戦闘不能';
  for(const v of [[0,0,0],[-max,0,0],[0,0,max],[1e8,0,0]])for(const yaw of [0,Math.PI/2,Math.PI]){
   w.yaw=yaw;const r=C.hyperspaceReadiness(w,v,[1,0,0],options),label=JSON.stringify({failure,charge,options,v,yaw}),misaligned=yaw!==0;
   assert.ok(allowed.has(r.reason),`${r.reason} (${label})`);assert.notEqual(r.reason,'accelerating',label);assert.equal(r.ready,r.reason===null,label);
   const expected=['reactor','destroyed','disabled'].includes(failure)?'disabled':failure==='missing'?'hyper-unavailable':failure==='hyperdrive'?'hyper-unpowered':options.requireCharge&&charge<1?'hyper-charging':Number.isFinite(options.alignWithinRad)&&misaligned?'aligning':null;
   assert.equal(r.reason,expected,label);checked++;
  }
 }
 assert.equal(checked,6*3*5*4*3);
});

test('a strategic-map jump waits to come about within the alignment limit; the trial jumps along its nose',()=>{
 near(C.HYPERSPACE_ALIGN_RAD,5*deg);
 const u=paidUnit(),dir=[1,0,0],at=a=>[Math.cos(a*deg),0,Math.sin(a*deg)],fleet={requireCharge:true,alignWithinRad:C.HYPERSPACE_ALIGN_RAD};
 for(const a of [30,6,90,180,-30]){const r=C.hyperspaceReadiness(u,[0,0,0],dir,{...fleet,forwardDirection:at(a)});
  assert.equal(r.ready,false,`${a} deg`);assert.equal(r.reason,'aligning',`${a} deg`);assert.equal(r.headingReady,false,`${a} deg`);assert.equal(r.powerReady,true);assert.equal(r.chargeReady,true);near(r.alignment,Math.cos(a*deg));}
 for(const a of [0,4,-4]){const r=C.hyperspaceReadiness(u,[0,0,0],dir,{...fleet,forwardDirection:at(a)});assert.equal(r.ready,true,`${a} deg`);assert.equal(r.reason,null);assert.equal(r.headingReady,true);near(r.alignment,Math.cos(a*deg));}
 // The forward direction falls back to the unit's yaw.
 u.yaw=30*deg;assert.equal(C.hyperspaceReadiness(u,[0,0,0],dir,fleet).reason,'aligning');u.yaw=4*deg;assert.equal(C.hyperspaceReadiness(u,[0,0,0],dir,fleet).ready,true);u.yaw=0;
 // Misaligned and uncharged: the charge is reported first.
 const low=paidUnit();low.hyperE=C.hyperUnitNeedJ(low)/3;assert.equal(C.hyperspaceReadiness(low,[0,0,0],dir,{...fleet,forwardDirection:at(30)}).reason,'hyper-charging');
 // Without alignWithinRad (the trial passes requireCharge only) the heading does not matter.
 for(const a of [30,90,180]){const r=C.hyperspaceReadiness(u,[0,0,0],dir,{requireCharge:true,forwardDirection:at(a)});assert.equal(r.ready,true,`${a} deg`);assert.equal(r.headingReady,true);near(r.alignment,Math.cos(a*deg));}
});
