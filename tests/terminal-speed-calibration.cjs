const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,msg='')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,msg+': '+a+' != '+b);
const smallMass=C.ENGINE_CONVERSION.referenceSmallMassKg,largeMass=C.ENGINE_CONVERSION.referenceLargeMassKg;
const smallRate=3999.1037971899486*C.G0*C.FLEET_RULES.accelScale/2000,largeRate=2972.473437207956*C.G0*C.FLEET_RULES.accelScale/1000;
const dragExponent=Math.log(largeRate/smallRate)/Math.log(largeMass/smallMass),expectedRate=mass=>smallRate*Math.pow(mass/smallMass,dragExponent);
function profile(massKg=1e6,physicalAccel=500,legacySpeed=1200){
 const wattsPerNewton=C.engineConversionCoefficient(massKg),input=massKg*physicalAccel*wattsPerNewton,e={id:2,machineryId:2,moduleIndex:1,powerNode:'p2',heatNode:'p2',domain:'main',ratedInputW:input,ratedThrustN:massKg*physicalAccel,wattsPerNewton,effectiveMachineryVolumeM3:Math.PI*2,machineryLengthM:2,machineryRadiusM:1,machineryShape:'cylinder',driveProfileId:'standard',machineryGradeId:'standard',direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true,pathCapacityW:1e30};
 return{profileVersion:C.FLEET_PROFILE_VERSION,name:'Finite source and common resistance',hp:100,len:100,width:40,height:20,crewNeed:1,crewMax:1,D:0,wCap:0,maxSpeed:legacySpeed,turnRate:.1,
 modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},{k:'engine',part:2,port:'p2',domain:'main',share:1,size:1,powerConnected:true}],grid:{P:input,Pgen:input,fixed:0,cooling:0,De:input,Ds:0,Dw:0},
 propulsion:{version:C.PROPULSION_MODEL_VERSION,massKg,ratedThrustN:massKg*physicalAccel,ratedAccelMps2:physicalAccel,accelerationLimitMps2:physicalAccel,engines:[e]}};
}
const unit=(key='custom-equilibrium',p=profile())=>C.fleetUnit('balanced-speed',key,p);
const paid=(u,fraction)=>{C.allocateShipPower(u,C.fleetSystems(u),{throttle:fraction},0,'propulsion');return C.propulsionMotion(u).acc;};

test('one common drag law meets both cold reference points after finite mandatory loads',()=>{
 // These controlled ledgers independently exercise the two measured cold
 // anchor accelerations. Actual stock blueprints are verified separately.
 for(const[key,mass,nominalG,coldG,speed]of[['tie_ln',smallMass,4100,3999.1037971899486,2000],['venator',largeMass,3000,2972.473437207956,1000]]){
 const p=profile(mass,nominalG*C.G0);p.grid.fixed=p.grid.P*(1-coldG/nominalG);
 const before=JSON.stringify(p),u=unit(key,p),alias=unit('unrelated-name',p),a=coldG*C.G0*C.FLEET_RULES.accelScale,plan=C.healthyMotionPlan(u.p);
 assert.equal(u.p.motionResistance.version,C.MOTION_RESISTANCE_VERSION);assert.equal(u.p.motionResistance.model,'global-mass-power-law');near(C.massDragRate(u),a/speed);near(C.massDragRate(alias),a/speed);near(C.propulsionTerminalSpeed(u),speed);near(u.p.maxSpeed,speed);near(u.p.mglt,speed/C.MGLT.ms);near(C.integratePropulsionMotion(u,[speed,0,0],[a,0,0],10).velocity[0],speed);assert.equal(JSON.stringify(p),before);assert.equal(u.p.speedReference.status,'published');
 near(plan.accelerationMps2,coldG*C.G0);near(plan.engineInputW,p.grid.P-p.grid.fixed);near(plan.sourceDrawW,p.grid.P);assert.ok(Object.isFrozen(plan));assert.equal(C.healthyMotionPlan(u.p),plan,'unchanged profile reuses its compact immutable planning result');
 for(const field of['massKg','ratedAccelMps2','accelerationLimitMps2'])near(u.p.propulsion[field],p.propulsion[field]);for(const field of['driveProfileId','effectiveMachineryVolumeM3','machineryLengthM','machineryRadiusM'])assert.equal(u.p.propulsion.engines[0][field],p.propulsion.engines[0][field]);
 }
});
test('more finite source power at the same mass raises equilibrium instead of recalibrating resistance',()=>{
 const first=profile(),second=profile(1e6,1000),before=JSON.stringify([first,second]),a=unit('venator',first),b=unit('tie_ln',second);
 near(C.massDragRate(a),expectedRate(1e6));near(C.massDragRate(b),C.massDragRate(a));near(paid(b,1),2*paid(a,1));near(C.propulsionTerminalSpeed(b),2*C.propulsionTerminalSpeed(a));near(b.p.maxSpeed,2*a.p.maxSpeed);near(a.p.maxSpeed,C.FLEET_RULES.accelScale*500/expectedRate(1e6));assert.notEqual(a.p.maxSpeed,1000);assert.notEqual(b.p.maxSpeed,2000);assert.equal(JSON.stringify([first,second]),before);
 for(const field of['effectiveMachineryVolumeM3','machineryLengthM','machineryRadiusM'])assert.equal(a.p.propulsion.engines[0][field],b.p.propulsion.engines[0][field]);
});
test('healthy planning reuses stable results and invalidates actual source power and whole-mass changes',()=>{
 const p=profile(),before=JSON.stringify(p),first=C.healthyMotionPlan(p);assert.equal(C.healthyMotionPlan(p),first);near(first.accelerationMps2,500);near(first.engineInputW,p.grid.P);near(first.sourceDrawW,p.grid.P);assert.equal(JSON.stringify(p),before);
 p.grid.P*=.5;p.grid.Pgen=p.grid.P;const half=C.healthyMotionPlan(p);assert.notEqual(half,first);near(half.accelerationMps2,250);near(half.engineInputW,p.grid.P);near(C.propulsionTerminalSpeed(p),250*C.FLEET_RULES.accelScale/expectedRate(1e6));
 p.propulsion.massKg=2e6;const loaded=C.healthyMotionPlan(p);assert.notEqual(loaded,half);near(loaded.accelerationMps2,p.grid.P/C.engineConversionCoefficient(2e6)/2e6);assert.equal(C.healthyMotionPlan(p),loaded);near(C.propulsionTerminalSpeed(p),loaded.accelerationMps2*C.FLEET_RULES.accelScale/expectedRate(2e6));
});
test('reducing actual force to25percent decelerates from full equilibrium toward quarter equilibrium',()=>{
 const u=unit(),k=expectedRate(1e6),a=500*C.FLEET_RULES.accelScale,v=a/k,dt=10/k,full=C.integratePropulsionMotion(u,[0,0,0],[a,0,0],dt),quarter=C.integratePropulsionMotion(u,[v,0,0],[a*.25,0,0],dt,{maxSpeed:1200});
 near(full.velocity[0],v*(1-Math.exp(-10)));near(quarter.velocity[0],v*(.25+.75*Math.exp(-10)));assert.ok(quarter.velocity[0]<v*.251);near(C.propulsionTerminalSpeed(u,a*.25),v*.25);
});
test('obsolete speed options neither remove funded force nor clamp overspeed',()=>{
 const u=unit(),k=expectedRate(1e6),accel=500*C.FLEET_RULES.accelScale,v=accel/k,dt=10/k,a=C.integratePropulsionMotion(u,[v,0,0],[accel*2,0,0],dt,{maxSpeed:v*.1}),b=C.integratePropulsionMotion(u,[v,0,0],[accel*2,0,0],dt);
 near(a.velocity[0],v*(2-Math.exp(-10)));near(a.velocity[0],b.velocity[0]);near(a.thrustFraction,1);near(C.integratePropulsionMotion(u,[v*2,0,0],[0,0,0],1/k,{maxSpeed:v*.1}).velocity[0],v*2/Math.E);
});
test('actual mass controls the common drag rate and nearly proportional drag force',()=>{
 const u=unit(),k=C.massDragRate(u),input=u.p.grid.P;u.p.propulsion={...u.p.propulsion,massKg:2e6,ratedAccelMps2:250};near(C.massDragRate(u)/k,Math.pow(2,dragExponent));near(2e6*C.massDragRate(u)/(1e6*k),Math.pow(2,1+dragExponent));
 const a=paid(u,1),expected=input/C.engineConversionCoefficient(2e6)/2e6*C.FLEET_RULES.accelScale;near(a,expected);near(C.propulsionTerminalSpeed(u,a),expected/expectedRate(2e6));
});
test('throttle, damage and thermal shutdown do not change the common resistance law',()=>{
 const u=unit(),k=C.massDragRate(u),model=JSON.stringify(u.p.motionResistance);for(const throttle of[1,.25,0]){paid(u,throttle);near(C.massDragRate(u),k);}
 C.shipHeatBlackout(u);u.mods[1]=0;near(C.massDragRate(u),k);assert.equal(JSON.stringify(u.p.motionResistance),model);near(C.integratePropulsionMotion(u,[123,0,0],[0,0,0],1/k).velocity[0],123/Math.E);
});
test('paid input gives full and quarter terminal speeds through the shared solver',()=>{
 const u=unit(),k=expectedRate(1e6),fullA=500*C.FLEET_RULES.accelScale,fullV=fullA/k;
 for(const fraction of[1,.25,0]){const a=paid(u,fraction);near(u.propulsion.actualInputW,u.p.grid.P*fraction);near(a,fullA*fraction);near(C.propulsionTerminalSpeed(u,a),fullV*fraction);if(fraction<1)assert.ok(C.integratePropulsionMotion(u,[fullV,0,0],[a,0,0],10).velocity[0]<fullV);near(C.massDragRate(u),k);}
});
test('real structural limits reduce input and terminal speed without changing resistance',()=>{
 const p=profile();p.propulsion.accelerationLimitMps2=p.propulsion.structuralAccelerationLimitMps2=50;p.propulsion.inertialFactor=1;const u=unit('imperial',p),k=expectedRate(1e6),out=[];
 for(const throttle of[1,.25]){const a=paid(u,throttle);out.push({W:u.propulsion.actualInputW,a});assert.ok(u.propulsion.structuralInputLimited);near(C.massDragRate(u),k);}
 near(out[0].W,out[1].W);near(out[0].a,out[1].a);near(C.propulsionTerminalSpeed(u,out[1].a),50*C.FLEET_RULES.accelScale/k);near(u.p.maxSpeed,50*C.FLEET_RULES.accelScale/k);
});
test('saved profiles replace old design-specific drag data and rebind the actual mass coefficient',()=>{
 for(const version of[3,C.MOTION_RESISTANCE_VERSION]){const first=unit().p,copy=plain(first);copy.propulsion.massKg*=2;copy.propulsion.ratedAccelMps2/=2;copy.motionResistance={version,referenceMassKg:1,referenceAccelMps2:1e20,referenceSpeedMps:1,ratePerKg:1e20};
 const clean=C.cleanCraftPowerProfile(copy);assert.ok(clean);assert.equal(clean.motionResistance.version,C.MOTION_RESISTANCE_VERSION);assert.equal(clean.motionResistance.model,'global-mass-power-law');near(C.massDragRate(clean),expectedRate(2e6));
 for(const engine of clean.propulsion.cores||clean.propulsion.engines){near(engine.conversionMassKg,clean.propulsion.massKg);near(engine.profileWattsPerNewton,C.engineConversionCoefficient(clean.propulsion.massKg));}const normalized=C.referenceSpeedProfile(clean,'imperial');near(C.massDragRate(normalized),expectedRate(2e6));near(normalized.maxSpeed,C.propulsionTerminalSpeed(normalized));assert.equal(normalized.speedReference.status,'published');}
});
test('the exported calibration is read-only and never follows a design power or speed hint',()=>{
 const p=profile(),before=JSON.stringify(p),model=C.calibrateMotionResistance(p);assert.equal(JSON.stringify(p),before);assert.equal(model.model,'global-mass-power-law');near(C.massDragRate(p),expectedRate(1e6));p.grid.P*=2;p.grid.Pgen*=2;p.maxSpeed=9e9;near(C.massDragRate(p),expectedRate(1e6));p.propulsion.massKg*=2;near(C.massDragRate(p),expectedRate(2e6));assert.equal(p.motionResistance,undefined);
});
test('mass-only hulks still brake but invalid propulsion cannot invent a powered equilibrium',()=>{
 for(const p of[{maxSpeed:1200,mass:10},{maxSpeed:1200,propulsion:{version:1,massKg:1e6,ratedAccelMps2:NaN,accelerationLimitMps2:500}}]){near(C.massDragRate(p),expectedRate(p.mass?1e4:1e6));near(C.propulsionTerminalSpeed(p),0);}
 near(C.massDragRate({len:1e9}),0);near(C.propulsionTerminalSpeed({len:1e9}),0);const p=unit('custom-zero-speed-hint',profile(1e6,500,0)).p;near(p.maxSpeed,500*C.FLEET_RULES.accelScale/expectedRate(1e6));assert.ok(p.maxSpeed>0);
});
test('loaded squadron mass and expended stores follow the common law on the copied descriptor',()=>{
 const key='terminalCalibrationStores',p=profile(),s={id:key,craft:key,side:0,h:[1,0,0],pos:[0,0,0],vel:[10,0,0],ldg:[{mass:1000}],ammo:[1]};R.CRAFT[key]={name:'Finite stores and common drag',speed:1200,powerProfile:p};
 try{R.squadPropulsion(s,.25,0);const base=R.CRAFT[key].powerProfile,model=plain(base.motionResistance);near(s.drive.p.propulsion.massKg,2e6);near(C.massDragRate(s.drive),expectedRate(2e6));near(base.propulsion.massKg,1e6);s.ammo[0]=0;R.squadPropulsion(s,.25,0);near(s.drive.p.propulsion.massKg,1e6);near(C.massDragRate(s.drive),expectedRate(1e6));assert.deepEqual(plain(s.drive.p.motionResistance),model);assert.equal(R.CRAFT[key].powerProfile,base);s.ammo[0]=2;R.squadPropulsion(s,0,0);near(C.massDragRate(s.drive),expectedRate(3e6));}
 finally{delete R.CRAFT[key];}
});
test('old cached custom speed hints do not retune drag before adding store mass',()=>{
 for(const version of[1,C.MOTION_RESISTANCE_VERSION]){const key='oldTerminalCalibration'+version,p=plain(unit().p);delete p.maxSpeed;p.motionResistance={version,referenceMassKg:1,referenceAccelMps2:1e20,referenceSpeedMps:1,ratePerKg:1e20};R.CRAFT[key]={name:'Old finite snapshot',speed:1500,powerProfile:p};const s={id:key,craft:key,side:0,h:[1,0,0],pos:[0,0,0],vel:[0,0,0],ldg:[{mass:1000}],ammo:[1]};
 try{R.squadPropulsion(s,0,0);const base=R.CRAFT[key].powerProfile;near(base.maxSpeed,500*C.FLEET_RULES.accelScale/expectedRate(1e6));assert.notEqual(base.maxSpeed,1500);assert.equal(base.motionResistance.version,C.MOTION_RESISTANCE_VERSION);near(C.massDragRate(s.drive),expectedRate(2e6));}finally{delete R.CRAFT[key];}}
});
