const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,Math});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=code=>vm.runInContext(code,cx),plain=value=>JSON.parse(JSON.stringify(value));
const near=(a,b,label='value',epsilon=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*epsilon,`${label}: ${a} != ${b}`);
const engineHeatJ=u=>(u.ht?.e?.engine||0)+(u.ht?.engineE||[]).reduce((n,J)=>n+Math.max(0,J||0),0);
const accountedHeatJ=u=>(u.ht?.operatingHeatJ||0)+Object.values(u.ht?.e||{}).reduce((n,J)=>n+Math.max(0,J||0),0)+['engineE','reactorE','feedE','esw'].reduce((n,key)=>n+(u.ht?.[key]||[]).reduce((a,J)=>a+Math.max(0,J||0),0),0);
run(`
const C=Core,TT_J=C.TT,trial={},tv={add:(a,b,k=1)=>a.map((n,i)=>n+b[i]*k),sub:C.sub,scale:C.mul,dot:C.dot,len:C.len,norm:C.norm,cross:C.cross};
let testFloor=0;
const trialRateBase=()=>({tau:1}),trialMaxRates=()=>[1,1,1],trialStickInput=()=>({x:trial.stickX||0,y:0}),trialAttitude=()=>({bank:0,pitch:0,f:[1,0,0],u:[0,1,0],r:[0,0,1]});
const trialCol=(r,i)=>r.slice(i*3,i*3+3),trialFrame=(f,u)=>[...f,...u,...C.norm(C.cross(f,u))],trialApply=(r,v)=>[0,1,2].map(i=>r[i]*v[0]+r[i+3]*v[1]+r[i+6]*v[2]),trialSys=()=>({planet:{radius:0},floor:testFloor}),toast=()=>{};
const trialRot=(v,a,t)=>C.add(C.add(C.mul(v,Math.cos(t)),C.mul(C.cross(a,v),Math.sin(t))),C.mul(a,C.dot(a,v)*(1-Math.cos(t))));
function trialGunnery(dt){trialPowerStep(dt,0);}
`);
const telegraph=app.split('\n').find(line=>line.startsWith('const TRIAL_TELEGRAPH='));assert.ok(telegraph);run(telegraph);
const begin=app.indexOf('function trialSystemsUnit(){'),end=app.indexOf('// ---- gunnery ----',begin);assert.ok(begin>=0&&end>begin);run(app.slice(begin,end));
const power=app.indexOf('function trialPowerStep(dt,want){'),powerEnd=app.indexOf('\nconst TT_J=C.TT;',power);assert.ok(power>=0&&powerEnd>power);run(app.slice(power,powerEnd));
run(`
const performance={now:()=>1000},glowEase=new Map(),renderHealth={frames:0,failures:0},view={setPoints(){},draw(frame){drawnFrame=frame;return true;}};
let drawnFrame=null;
const $=()=>null,trialFoilStep=()=>{},trialCraftSystemsStep=()=>{},trialCamera=()=>{},trialJumpStep=()=>{},trialPoseFoilMounts=()=>{},trialRenderSets=()=>{},trialFoilDeployments=()=>[],trialTurretDrawParts=()=>[],escortsDraw=()=>[],spaceDrawUnits=()=>[],patrolDraw=()=>[],trialTunnelK=()=>0,trialStreak=()=>0,trialPlanet=()=>null,trialFast=()=>false,trialAdaptScale=()=>{},trialMarkers=()=>{},trialCockpitHud=()=>{},spaceAttStep=()=>{},spaceDeaths=()=>{},trialSwBeamCheck=()=>{},hitcamStep=()=>{},trialHudUpdate=()=>{};
`);
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const source=app.slice(start.index,i+1);try{new vm.Script(source);return source;}catch{}}assert.fail(name);}
run(fn('glowOf'));run(fn('trialLoop'));

function setup({supply=1e18,massKg=1e6,velocity=[0,0,0],tele=5,thermal=true,mode='balanced',weaponCharging=false}={}){
 const rating=1e18,thrust=5e8,modules=[{k:'engine',part:1,port:'p1',size:1,share:1,at:.1,domain:'main',powerConnected:true},{k:'reactor',part:3,port:'p3',size:1,share:1,at:.4,domain:'main',powerConnected:true}];
 if(weaponCharging)modules.push({k:'weapon',fit:4,port:'f4',size:1,share:1,at:.5,domain:'main',powerConnected:true});
 const profile={name:'Finite throttle and mass reference',profileVersion:C.FLEET_PROFILE_VERSION,hp:1e12,len:100,width:40,height:20,mass:massKg/1000,D:0,shieldBuffer:0,reserve:0,wCap:weaponCharging?10*rating/C.TT:0,crewNeed:0,crewMax:0,maxSpeed:1000,accel:999999,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,
  propulsion:{version:C.PROPULSION_MODEL_VERSION,engines:[{id:1,machineryId:1,moduleIndex:0,powerNode:'p1',heatNode:'p1',domain:'main',valid:true,available:true,connected:true,outletAvailable:true,ratedInputW:rating,effectiveMachineryVolumeM3:rating/3.4e17,driveProfileId:'standard',ratedThrustN:thrust,wattsPerNewton:rating/thrust,direction:[1,0,0],pathCapacityW:rating}],massKg,ratedThrustN:thrust,ratedAccelMps2:thrust/massKg,accelerationLimitMps2:thrust/massKg},
  grid:{P:supply,fixed:0,De:rating,Ds:0,Dw:weaponCharging?rating:0,domains:[{id:'main',P:supply,sources:[{moduleIndex:1,P:supply}],modules:modules.map((_,i)=>i)}],powerPaths:[{from:'p3',to:'p1',cap:rating,ok:true},...(weaponCharging?[{from:'p3',to:'f4',cap:rating,ok:true}]:[])]},
  heat:{v:1,src:[{id:'p1',k:'engine',n:'engine',g:'high',sh:1,m:[0],pc:[],sec:-1,sw:-1,gen:-1},{id:'p3',k:'reactor',n:'reactor',g:'high',sh:1,m:[1],pc:[],sec:-1,sw:-1,gen:-1},...(weaponCharging?[{id:'f4',k:'weapon',n:'weapon',g:'high',sh:1,m:[2],pc:[],sec:-1,sw:-1,gen:-1}]:[])],dis:[],ln:[]}};
 const unit=C.fleetUnit('throttle-reference','throttle-reference',profile,0);unit.order={...unit.order,power:mode};unit._profile=profile;C.heatInit(unit);unit.ht.online=thermal;
 cx.unit=unit;cx.profile=profile;cx.velocity=velocity;cx.telegraph=tele;cx.powerMode=mode;
 run(`Object.assign(trial,{p:profile,battle:{me:unit},systemsUnit:null,energy:{E:0,cap:profile.wCap},powerMode,P:[10000,10000,0],V:velocity.slice(),R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],stickX:0,rudder:0,level:false,tele:telegraph,craft:false,t:0,vf:velocity[0],dust:{H:100,pos:new Float32Array(0)},rec:{top:0},engF:0,thrust:0,thrustWant:0});testFloor=0;`);
 return unit;
}

test('quarter throttle requests quarter engine input independently of current speed',()=>{
 for(const speed of [0,500]){const u=setup({tele:2,velocity:[speed,0,0]});run('trialStep(.1)');near(u.propulsion.actualInputW,2.5e17,'quarter power');near(u.propulsion.actualThrustN,1.25e8,'quarter thrust');near(run('trialMainOutput()'),.25,'quarter plume');assert.ok(run('trial.V[0]')>speed,'quarter output accelerates forward rather than targeting a quarter-speed setting');}
});

test('full throttle keeps requesting real power at the old nominal maximum speed',()=>{
 const u=setup({velocity:[1000,0,0]});run('trialStep(.1)');near(u.propulsion.actualInputW,1e18);near(u.propulsion.actualThrustN,5e8);near(run('trialMainOutput()'),1);near(engineHeatJ(u),u.propulsion.wasteHeatW*.1,'maintaining engine output accrues its source-attributed heat');
});

test('idle does not command a powered brake or a main-engine plume',()=>{
 const u=setup({tele:1,velocity:[100,20,-5]});run('trialStep(.1)');near(u.propulsion.actualInputW,0);near(u.propulsion.actualThrustN,0);near(run('trialMainOutput()'),0);near(run('trial.thrust'),0);assert.ok(run('trial.V[0]')<100&&run('trial.V[0]')>99.99,'the small mass has only its passive resistance, not full reverse thrust');assert.ok(run('trial.P[0]')>10000);
});

test('a large unpowered vessel loses speed in all axes while a small craft nearly keeps its drift',()=>{
 const start=[100,20,-5];setup({supply:0,massKg:1e11,tele:1,velocity:start});run('trialStep(10)');const heavy=plain(run('trial.V')),position=plain(run('trial.P'));
 for(let i=0;i<3;i++){assert.ok(Math.abs(heavy[i])<Math.abs(start[i])*.95);assert.equal(Math.sign(heavy[i]),Math.sign(start[i]),'resistance cannot reverse velocity');}assert.ok(position[0]>10000&&position[1]>10000&&position[2]<0);
 setup({supply:0,massKg:1e4,tele:1,velocity:start});run('trialStep(10)');for(let i=0;i<3;i++)near(run(`trial.V[${i}]`),start[i],'small-craft drift',1e-7);
});

test('weapon priority cannot preserve a heavy vessel speed using an unfunded throttle command',()=>{
 const u=setup({massKg:1e11,velocity:[1000,0,0],weaponCharging:true,mode:'weapons'});run('trialStep(.5)');assert.ok(run('trial.power.got.weapons')>0);near(u.propulsion.actualInputW,0,'no engine allocation');near(run('trialMainOutput()'),0,'no commanded-only plume');assert.ok(run('trial.V[0]')<1000,'weapon-funded coasting now slows');
});

test('thermal blackout suppresses engine output and steering while mass resistance remains active',()=>{
 const u=setup({massKg:1e11,velocity:[100,10,0],thermal:false});run('trial.stickX=1;trialStep(.5)');near(u.propulsion.actualInputW,0);near(run('trialMainOutput()'),0);assert.deepEqual(plain(run('trial.w')),[0,0,0]);assert.ok(run('trial.V[0]')<100&&run('trial.V[1]')<10);
});

test('steering-only power is not rendered as forward main-engine thrust',()=>{
 const u=setup({tele:1});run('trial.stickX=1;trialStep(.1)');assert.ok(u.propulsion.actualInputW>0,'a real propulsion allocation funds steering');assert.ok(run('Math.abs(trial.w[0])')>0);near(run('trialMainOutput()'),0);near(run('trial.thrust'),0);assert.deepEqual(plain(run('trial.V')),[0,0,0]);
});

test('partial electrical supply limits both actual thrust and exhaust below the requested full output',()=>{
 const u=setup({supply:2.5e17});run('trialStep(.1)');near(u.propulsion.actualInputW,2.5e17);near(u.propulsion.actualThrustN,1.25e8);near(run('trialMainOutput()'),.25);near(run('trial.thrust'),.25);
});

test('actual draw payload receives funded main-engine output instead of speed or steering allocation',()=>{
 for(const row of [{tele:2,expected:.25},{tele:5,expected:1},{tele:1,expected:0},{tele:1,steer:true,expected:0},{tele:5,supply:0,expected:0}]){
  setup({tele:row.tele,supply:row.supply??1e18,velocity:[500,0,0]});run(`trial.stickX=${row.steer?1:0};trialStep(.1);Object.assign(trial,{on:true,paused:true,last:1000,hud:1000,asset:{key:'actual-engine-draw'},camMode:'chase',targets:[],turrets:[],jump:null});glowEase.clear();trialLoop(1001)`);
  near(run('drawnFrame.fleet[0].glow'),row.expected,'actual renderer input');assert.ok(run('renderHealth.frames')>0);
 }
});

test('reverse output uses paid propulsion and changes the acceleration direction',()=>{
 const u=setup({tele:0});run('trialStep(.1)');near(u.propulsion.actualInputW,2.5e17);assert.ok(run('trial.V[0]')<0);near(run('trialMainOutput()'),.25);near(engineHeatJ(u),u.propulsion.wasteHeatW*.1,'reverse propulsion heat');
});

test('position and velocity agree across frame partitions under constant output and resistance',()=>{
 setup({velocity:[500,10,-2],tele:3});run('trialStep(1)');const a=plain(run('({P:trial.P,V:trial.V})'));
 setup({velocity:[500,10,-2],tele:3});run('for(let i=0;i<100;i++)trialStep(.01)');const b=plain(run('({P:trial.P,V:trial.V})'));
 for(const k of ['P','V'])for(let i=0;i<3;i++)near(a[k][i],b[k][i],`${k}${i} partition`);
});

test('the HUD velocity is recomputed after the planetary floor removes inward motion',()=>{
 setup({tele:1,velocity:[-1,0,0]});run('testFloor=10;trial.P=[10,0,0];trial.R=[-1,0,0,0,1,0,0,0,-1];trialStep(.1)');assert.deepEqual(plain(run('trial.P')),[10,0,0]);assert.deepEqual(plain(run('trial.V')),[0,0,0]);near(run('trial.vf'),0);
});

test('direct output drives actual automatically wired hardware and retains its fuel and heat ledgers',()=>{
 const {soloTrialDesign}=require('./helpers/solo-trial-design.cjs'),design=soloTrialDesign(C);C.syncCompartments(design);C.remount(design);C.syncCompartments(design);const stats=C.computeStats(design),profile=C.fleetProfile(stats,design.name,design);
 setup();cx.hardwareProfile=profile;run('trial.p=hardwareProfile;trial.battle=null;trial.systemsUnit=null;trial.tele=5;trial.V=[0,0,0];trialStep(.1)');const unit=run('trial.systemsUnit');assert.ok(unit.propulsion.actualInputW>0);assert.ok(unit.propulsion.actualThrustN>0);assert.ok(run('trialMainOutput()')>0);assert.ok(C.shipFuelState(unit).consumedKg>0);assert.ok(accountedHeatJ(unit)>0,'source-attributed or already-solved heat is retained before and after the thermal interval');
 const fuel=C.shipFuelState(unit).consumedKg;run('trial.tele=1;trialStep(.1);trial.tele=2;trialStep(.1)');assert.equal(run('trial.systemsUnit'),unit);assert.ok(C.shipFuelState(unit).consumedKg>fuel);assert.ok(run('trialMainOutput()')>0&&run('trialMainOutput()')<=.25+1e-8);
});
