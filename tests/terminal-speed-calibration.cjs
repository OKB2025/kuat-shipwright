const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,msg='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${msg}: ${a} != ${b}`);
function profile(massKg=1e6,physicalAccel=500,speed=1200){
 const input=massKg*physicalAccel*2e9,e={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:input,ratedThrustN:massKg*physicalAccel,wattsPerNewton:2e9,effectiveMachineryVolumeM3:input/3.4e17,machineryLengthM:2,machineryRadiusM:1,driveProfileId:'standard',machineryGradeId:'standard',direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true,pathCapacityW:input};
 return {profileVersion:C.FLEET_PROFILE_VERSION,name:'Healthy reference and actual paid drive',hp:100,len:100,width:40,height:20,crewNeed:1,crewMax:1,D:0,wCap:0,maxSpeed:speed,turnRate:.1,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},{k:'engine',part:2,port:'p2',domain:'main',share:1,size:1,powerConnected:true}],grid:{P:input,Pgen:input,fixed:0,cooling:0,De:input,Ds:0,Dw:0},
  propulsion:{version:C.PROPULSION_MODEL_VERSION,massKg,ratedThrustN:massKg*physicalAccel,ratedAccelMps2:physicalAccel,accelerationLimitMps2:physicalAccel,engines:[e]}};
}
function unit(key='imperial',p=profile()){return C.fleetUnit('balanced-speed',key,p);}

test('TIE/ln 100 MGLT and Venator 50 MGLT calibrate healthy force balance without altering machinery',()=>{
 for(const [key,mass,expected] of [['tie_ln',1e4,2000],['venator',1e11,1000]]){
  const p=profile(mass),before=JSON.stringify(p),u=unit(key,p),ref=u.p.motionResistance;
  assert.equal(ref.version,C.MOTION_RESISTANCE_VERSION);near(ref.referenceMassKg,mass);near(ref.referenceSpeedMps,expected);near(ref.referenceAccelMps2,1);near(C.massDragRate(u),1/expected);near(C.propulsionTerminalSpeed(u),expected);
  near(C.integratePropulsionMotion(u,[expected,0,0],[1,0,0],10).velocity[0],expected);assert.equal(JSON.stringify(p),before);assert.equal(u.p.propulsion.inputModelVersion,C.ENGINE_INPUT_MODEL_VERSION);for(const field of ['massKg','ratedAccelMps2','accelerationLimitMps2'])near(u.p.propulsion[field],p.propulsion[field]);for(const field of ['driveProfileId','effectiveMachineryVolumeM3','machineryLengthM','machineryRadiusM'])assert.equal(u.p.propulsion.engines[0][field],p.propulsion.engines[0][field]);
 }
});
test('reducing actual force to25percent at the old maximum causes deceleration toward a quarter-speed equilibrium',()=>{
 const u=unit(),k=1/1200,full=C.integratePropulsionMotion(u,[0,0,0],[1,0,0],12000),quarter=C.integratePropulsionMotion(u,[1200,0,0],[.25,0,0],12000,{maxSpeed:1200});
 near(full.velocity[0],1200*(1-Math.exp(-10)));near(quarter.velocity[0],300+900*Math.exp(-10));assert.ok(quarter.velocity[0]<301);near(C.propulsionTerminalSpeed(u,.25),300);
});
test('the obsolete maxSpeed option never removes funded acceleration or pins an overspeed vessel',()=>{
 const u=unit(),a=C.integratePropulsionMotion(u,[1200,0,0],[2,0,0],12000,{maxSpeed:1200}),b=C.integratePropulsionMotion(u,[1200,0,0],[2,0,0],12000);near(a.velocity[0],2400-1200*Math.exp(-10));near(a.velocity[0],b.velocity[0]);near(a.thrustFraction,1);
 const coast=C.integratePropulsionMotion(u,[2400,0,0],[0,0,0],1200,{maxSpeed:1200});near(coast.velocity[0],2400/Math.E);
});
test('actual mass changes increase resistance linearly while retaining the same calibrated reference',()=>{
 const u=unit(),ref=plain(u.p.motionResistance),k=C.massDragRate(u);u.p.propulsion={...u.p.propulsion,massKg:2e6,ratedAccelMps2:250};near(C.massDragRate(u),2*k);near(C.propulsionTerminalSpeed(u),300);assert.deepEqual(plain(u.p.motionResistance),ref);
});
test('power loss, damage and thermal shutdown never recalibrate resistance from current output',()=>{
 const u=unit(),k=C.massDragRate(u),ref=JSON.stringify(u.p.motionResistance);for(const throttle of [1,.25,0]){C.allocateShipPower(u,C.fleetSystems(u),{throttle},.25,'balanced');near(C.massDragRate(u),k);}
 C.heatInit(u);u.ht.online=false;u.mods[1]=0;u.propulsion={actualAccelMps2:0,outputRatio:0};near(C.massDragRate(u),k);assert.equal(JSON.stringify(u.p.motionResistance),ref);near(C.integratePropulsionMotion(u,[1200,0,0],[0,0,0],1200).velocity[0],1200/Math.E);
});
test('a paid unconstrained finite engine supplies the force used by full and quarter equilibrium',()=>{
 const u=unit(),k=C.massDragRate(u);for(const fraction of [1,.25,0]){
  C.allocateShipPower(u,C.fleetSystems(u),{throttle:fraction},.25,'balanced');const a=C.propulsionMotion(u).acc;near(u.propulsion.actualInputW,u.p.grid.P*fraction);near(a,fraction);near(C.propulsionTerminalSpeed(u,a),1200*fraction);if(fraction<1)assert.ok(C.integratePropulsionMotion(u,[1200,0,0],[a,0,0],10).velocity[0]<1200);near(C.massDragRate(u),k);
 }
});
test('structural input limits remain real: equal usable force gives equal equilibrium despite different lever commands',()=>{
 const p=profile();p.propulsion.accelerationLimitMps2=p.propulsion.structuralAccelerationLimitMps2=50;p.propulsion.inertialFactor=1;const u=unit('imperial',p),k=C.massDragRate(u),out=[];
 for(const throttle of [1,.25]){C.allocateShipPower(u,C.fleetSystems(u),{throttle},.25,'balanced');out.push({W:u.propulsion.actualInputW,a:C.propulsionMotion(u).acc});assert.ok(u.propulsion.structuralInputLimited);near(C.massDragRate(u),k);}
 near(out[0].W,out[1].W);near(out[0].a,out[1].a);near(C.propulsionTerminalSpeed(u,out[1].a),1200);
});
test('serialized profile calibration survives repeated normalizing and cleaning without following runtime mass',()=>{
 const first=unit().p,ref=plain(first.motionResistance),copy=JSON.parse(JSON.stringify(first));copy.propulsion.massKg*=2;copy.propulsion.ratedAccelMps2/=2;
 const clean=C.cleanCraftPowerProfile(copy);assert.ok(clean);assert.deepEqual(plain(clean.motionResistance),ref);near(C.massDragRate(clean),2*C.massDragRate(first));const normalized=C.referenceSpeedProfile(clean,'imperial');assert.deepEqual(plain(normalized.motionResistance),ref);
});
test('old finite profiles are cheaply upgraded once and the exported calibrator is read-only',()=>{
 const p=profile(),before=JSON.stringify(p),ref=C.calibrateMotionResistance(p);assert.equal(JSON.stringify(p),before);near(ref.ratePerKg,1/(1200*1e6));p.propulsion.massKg*=2;near(C.massDragRate(p),2/1200);assert.equal(p.motionResistance,undefined);near(C.calibrateMotionResistance(p).referenceMassKg,1e6);
});
test('a zero-speed or missing physical drive does not invent propulsion or an equilibrium',()=>{
 for(const p of [{maxSpeed:1200,mass:10},profile(),{maxSpeed:1200,propulsion:{version:1,massKg:1e6,ratedAccelMps2:NaN,accelerationLimitMps2:500}}]){
  if(p.propulsion?.ratedAccelMps2===500)p.maxSpeed=0;assert.equal(C.calibrateMotionResistance(p),null);near(C.propulsionTerminalSpeed(p,0),0);
 }
});

test('loaded squadron mass and expended stores retain the base profile calibration across the actual copied-descriptor path',()=>{
 const key='terminalCalibrationStores',p=profile(),s={id:key,craft:key,side:0,h:[1,0,0],pos:[0,0,0],vel:[1200,0,0],ldg:[{mass:1000}],ammo:[1]};
 R.CRAFT[key]={name:'Finite stores and reference',speed:1200,powerProfile:p};
 try{
  R.squadPropulsion(s,.25,0);const base=R.CRAFT[key].powerProfile,ref=plain(base.motionResistance),k=C.massDragRate(base);near(s.drive.p.propulsion.massKg,2e6);near(C.massDragRate(s.drive),2*k);assert.deepEqual(plain(s.drive.p.motionResistance),ref);near(ref.referenceMassKg,1e6);
  s.ammo[0]=0;R.squadPropulsion(s,.25,0);near(s.drive.p.propulsion.massKg,1e6);near(C.massDragRate(s.drive),k);assert.deepEqual(plain(s.drive.p.motionResistance),ref);assert.equal(R.CRAFT[key].powerProfile,base);near(base.propulsion.massKg,1e6);
  s.ammo[0]=2;R.squadPropulsion(s,0,0);near(C.massDragRate(s.drive),3*k);assert.deepEqual(plain(s.drive.p.motionResistance),ref);
 }finally{delete R.CRAFT[key];}
});

test('an old-version cached custom craft uses its nominal speed before adding store mass',()=>{
 const key='oldTerminalCalibration',p=profile();delete p.maxSpeed;p.motionResistance={version:1,referenceMassKg:1};R.CRAFT[key]={name:'Old finite snapshot',speed:1500,powerProfile:p};const s={id:key,craft:key,side:0,h:[1,0,0],pos:[0,0,0],vel:[0,0,0],ldg:[{mass:1000}],ammo:[1]};
 try{R.squadPropulsion(s,0,0);const base=R.CRAFT[key].powerProfile;near(base.motionResistance.referenceSpeedMps,1500);near(base.motionResistance.referenceMassKg,1e6);assert.equal(base.motionResistance.version,C.MOTION_RESISTANCE_VERSION);near(C.massDragRate(s.drive),2/1500);}
 finally{delete R.CRAFT[key];}
});
