const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const cx=vm.createContext({console,Math});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${a} != ${b}`);
vm.runInContext(`
const C=Core,TT_J=C.TT,trial={},tv={add:(a,b,k=1)=>a.map((n,i)=>n+b[i]*k),sub:C.sub,scale:C.mul,dot:C.dot,len:C.len,norm:C.norm,cross:C.cross};
const TRIAL_TELEGRAPH=[[0,0],[0,0],[0,.25],[0,.5],[0,.75],[0,1]];
const trialRateBase=()=>({tau:1}),trialMaxRates=()=>[1,1,1],trialStickInput=()=>({x:trial.stickX||0,y:0}),trialAttitude=()=>({bank:0,pitch:0,f:[1,0,0],u:[0,1,0],r:[0,0,1]});
const trialCol=(r,i)=>r.slice(i*3,i*3+3),trialFrame=(f,u)=>[...f,...u,...C.norm(C.cross(f,u))],trialApply=(r,v)=>[0,1,2].map(i=>r[i]*v[0]+r[i+3]*v[1]+r[i+6]*v[2]),trialSys=()=>({planet:{radius:0},floor:0}),toast=()=>{};
const trialRot=(v,a,t)=>C.add(C.add(C.mul(v,Math.cos(t)),C.mul(C.cross(a,v),Math.sin(t))),C.mul(a,C.dot(a,v)*(1-Math.cos(t))));
function trialGunnery(dt){trialPowerStep(dt,0);}
`,cx);
vm.runInContext(app.slice(app.indexOf('function trialSystemsUnit(){'),app.indexOf('// ---- gunnery ----')),cx);
vm.runInContext(app.slice(app.indexOf('function trialPowerStep(dt,want){'),app.indexOf('\nconst TT_J=C.TT;',app.indexOf('function trialPowerStep(dt,want){'))),cx);
vm.runInContext('const JUMP={spool:1,accel:1,enter:1},ESC_JUMP={gap:()=>0},escOrder=es=>es;',cx);
vm.runInContext(app.slice(app.indexOf('function escortSystemsUnit(e){'),app.indexOf('// v21.2 In the tunnel',app.indexOf('function escortSystemsUnit(e){'))),cx);
const run=code=>vm.runInContext(code,cx);
function setup({supply=1e18,thermal=1,velocity=[0,0,0],tele=5}={}){
 const R=1e18,p={name:'Trial power reference',hp:1e12,len:100,width:40,height:20,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:0,maxSpeed:1000,accel:999999,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules:[{k:'engine',part:1,size:1,share:1,at:.1,domain:'main',powerConnected:true},{k:'reactor',part:3,size:1,share:1,at:.4,domain:'main',powerConnected:true}],propulsion:{version:1,engines:[{id:1,machineryId:1,moduleIndex:0,powerNode:'p1',heatNode:'p1',domain:'main',valid:true,available:true,connected:true,outletAvailable:true,ratedInputW:R,effectiveMachineryVolumeM3:R/3.4e17,driveProfileId:'standard',ratedThrustN:5e8,wattsPerNewton:2e9,direction:[1,0,0],pathCapacityW:R}],massKg:1e6,ratedThrustN:5e8,ratedAccelMps2:500,accelerationLimitMps2:500},grid:{P:supply,fixed:0,De:R,Ds:0,Dw:0,domains:[{id:'main',P:supply,sources:[{moduleIndex:1,P:supply}],modules:[0,1]}],powerPaths:[{from:'p3',to:'p1',cap:R,ok:true}]},heat:{v:1,src:[{id:'p1',k:'engine',n:'engine',g:'high',sh:1,st:1e30,m:[0],pc:[],sec:-1,sw:-1,gen:-1},{id:'p3',k:'reactor',n:'reactor',g:'high',sh:1,st:1e30,m:[1],pc:[],sec:-1,sw:-1,gen:-1}],dis:[],ln:[]}};
 const unit=C.fleetUnit('trial-test','trial-test',p,0);unit.order={...unit.order,power:'balanced'};unit._profile=p;C.heatInit(unit);unit.ht.online=thermal>0;unit.ht.damageLimit=Math.max(.6,thermal);
 cx.unit=unit;cx.profile=p;cx.velocity=velocity;cx.telegraph=tele;
 run(`Object.assign(trial,{p:profile,battle:{me:unit},energy:{E:0,cap:0},powerMode:'balanced',P:[10000,10000,0],V:velocity.slice(),R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],stickX:0,rudder:0,level:false,tele:telegraph,craft:false,t:0,vf:0,dust:{H:100,pos:new Float32Array(0)},rec:{top:0},engF:0});`);
 return unit;
}
test('ENG-T04/15 direct controls use the same actual watts/newtons and one battle acceleration scale',()=>{
 for(const thermal of [1,.6,0]){
  const u=setup({thermal});run('trialStep(.1)');
  near(u.propulsion.actualInputW,1e18*thermal);near(u.propulsion.actualThrustN,5e8*thermal);near(u.propulsion.wasteHeatW,5e16*thermal);
  near(run('trial.V[0]'),500*C.FLEET_RULES.accelScale*.1*thermal);near(run('trial.engF'),thermal);
  const other=setup({thermal});C.allocateShipPower(other,C.fleetSystems(other),{throttle:1,shields:0,weapons:0},.1,'balanced');
  near(other.propulsion.actualInputW,u.propulsion.actualInputW);near(other.propulsion.actualThrustN,u.propulsion.actualThrustN);
 }
});
test('a half-powered direct-control engine delivers half the actual acceleration',()=>{
 const u=setup({supply:5e17});run('trialStep(.1)');near(u.propulsion.actualThrustN,2.5e8);near(run('trial.V[0]'),.05);near(run('trial.engF'),.5);
});
test('ENG-T13 direct blackout preserves drift direction and applies only passive mass braking',()=>{
 const u=setup({supply:0,velocity:[5,3,2],tele:1});run('trial.stickX=1;trialStep(.1)');
 const k=u.p.propulsion.massKg*Math.LN2/(1e11*60),decay=Math.exp(-k*.1),distance=-Math.expm1(-k*.1)/k;
 near(u.propulsion.actualInputW,0);for(const [i,v]of [5,3,2].entries())near(run(`trial.V[${i}]`),v*decay);assert.deepEqual(Array.from(run('trial.w')),[0,0,0]);
 for(const [i,v]of [5,3,2].entries())near(run(`trial.P[${i}]`),[10000,10000,0][i]+v*distance);
});
test('ENG-T04 zero throttle creates no propulsion heat and no waiting thrust',()=>{
 const u=setup({tele:1});run('trialStep(.1)');near(u.propulsion.actualInputW,0);near(u.propulsion.actualThrustN,0);near(u.propulsion.wasteHeatW,0);near(run('trial.engF'),0);assert.deepEqual(Array.from(run('trial.V')),[0,0,0]);
});
test('ENG-T16 direct physics integrates the same input and velocity at different frame steps',()=>{
 const a=setup();for(let i=0;i<10;i++)run('trialStep(.1)');const v=Array.from(run('trial.V')),energy=a.ht.e.engine;
 const b=setup();for(let i=0;i<20;i++)run('trialStep(.05)');for(let i=0;i<3;i++)near(run(`trial.V[${i}]`),v[i]);near(b.ht.e.engine,energy);
});
test('ENG-T13/15 a powerless escort coasts instead of being pulled into its formation slot',()=>{
 const u=setup({supply:0,velocity:[0,0,0],tele:1});
 run(`trial.jump=null;trial.escorts=[{key:'escort',p:profile,powerUnit:unit,slot:[0,0,2000],pos:[10000,10000,1000],V:[5,3,2],R:[1,0,0,0,1,0,0,0,1],f:[1,0,0]}];escortsStep(.1);`);
 const k=u.p.propulsion.massKg*Math.LN2/(1e11*60),decay=Math.exp(-k*.1),distance=-Math.expm1(-k*.1)/k;
 near(u.propulsion.actualInputW,0);for(const [i,v]of [5,3,2].entries())near(run(`trial.escorts[0].V[${i}]`),v*decay);
 assert.deepEqual(Array.from(run('trial.escorts[0].R')),[1,0,0,0,1,0,0,0,1]);
 for(const [i,v]of [5,3,2].entries())near(run(`trial.escorts[0].pos[${i}]`),[10000,10000,1000][i]+v*distance);
 near(run('trial.escorts[0].lvl'),0);
});
test('a powered escort bounds all formation corrections by the shared actual acceleration',()=>{
 const u=setup({thermal:.6});
 run(`trial.jump=null;trial.escorts=[{key:'escort',p:profile,powerUnit:unit,slot:[0,0,2000],pos:[10000,10000,1000],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],f:[1,0,0]}];escortsStep(.1);`);
 near(u.propulsion.actualThrustN,3e8);near(run('tv.len(trial.escorts[0].V)'),300*C.FLEET_RULES.accelScale*.1);
});

test('solo player controls start and restart real automatically wired machinery even with an old bus flag',()=>{
 const {soloTrialDesign}=require('./helpers/solo-trial-design.cjs'),design=soloTrialDesign(C);C.syncCompartments(design);C.remount(design);C.syncCompartments(design);const stats=C.computeStats(design),profile=C.fleetProfile(stats,design.name,design);assert.ok(stats.maximumAccelMps2>0);assert.equal(design.links.some(l=>l.kind==='power'),false,'no player-placed distribution circuit is required');
 setup();cx.soloProfile=profile;run('trial.p=soloProfile;trial.battle=null;trial.systemsUnit=null;trial.swSolo=null;trial.tele=5;trial.V=[0,0,0];trialStep(.1)');
 const unit=run('trial.systemsUnit');assert.ok(unit);assert.ok(unit.propulsion.actualInputW>0);assert.ok(unit.propulsion.actualThrustN>0);assert.ok(run('trial.V[0]')>0,'a solo player actually moves after selecting ahead');assert.equal(run('trialSystemsUnit()'),unit,'the live vessel survives successive control frames');const consumed=C.shipFuelState(unit).consumedKg;
 run('trial.tele=1;trialStep(.1);trial.tele=5;trialStep(.1)');assert.equal(run('trial.systemsUnit'),unit);assert.ok(unit.propulsion.actualThrustN>0,'ahead resumes after selecting stop');assert.ok(run('trial.V[0]')>0);assert.ok(C.shipFuelState(unit).consumedKg>consumed,'control updates do not replace the unit and reset its fuel/heat state');run('trialStep(1)');assert.ok(C.heatStatus(unit).operatingHeatJ>0);
});

test('escort control frames retain one live power unit and its thermal state',()=>{
 setup();run("trial.escorts=[{key:'escort-live',p:profile,powerUnit:null}];escortPowerStep(trial.escorts[0],.1,1)");const unit=run('trial.escorts[0].powerUnit'),heat=unit.ht;assert.ok(unit.propulsion.actualThrustN>0);
 run('escortPowerStep(trial.escorts[0],.1,0);escortPowerStep(trial.escorts[0],.1,1)');assert.equal(run('trial.escorts[0].powerUnit'),unit);assert.equal(unit.ht,heat);assert.ok(unit.propulsion.actualThrustN>0);
});
