const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}}),run=s=>vm.runInContext(s,cx),plain=x=>JSON.parse(JSON.stringify(x));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R,D}=run('({C:Core,R:Rts,D:YardFleetData.designs})'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,TT_J=C.TT,trial={};let aimPoint=[10000,0,0],downs=0;
Math.random=()=>.1;
const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
const trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialPowerStep=()=>{},trialSalvoPlan=()=>null,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],trialCraftGasReady=()=>true,trialCraftGasTake=()=>true,sndAt=()=>{},sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'',trialThreatDown=q=>{q.alive=false;downs++;};
C.FITS.testPurePd={...C.FITS.pd,dualPurpose:false,tt:2e-6,boltTT:1e-6,power:2e-6/.2*TT_J};
function reset(key='pd'){
 Object.assign(trial,{craft:false,p:{len:100},asset:{geometry:{center:[0,0,0],targetRadius:5}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1000,cap:1000},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],drones:[],foeCraft:[],foeMissiles:[],rays:{busy:true,last:0}});
 const d=C.FITS[key],t=trialTurretState({id:1,k:key,origin:[0,0,0],fw:[1,0,0],axis:[0,1,0],cycle:d.cycle||.2,power:d.power,barrels:d.barrels||2,rate:1000,r:2});
 t.clear=true;t.clearDir=t.fw.slice();t.charge=1;trial.turrets=[t];downs=0;aimPoint=[10000,0,0];
}
function threat(kind='missile',pos=[1000,0,0]){const q={kind,pos,vel:[0,0,0],alive:true};trial[kind==='missile'?'foeMissiles':'foeCraft'].push(q);return q;}
`);
section('const tv=','function trialProfile(');
section('const TRIAL_PILOT_CYCLE=','// opts.design');
section('const trialBarrel=','function trialAim(');
section('function trialIntercept(','// The enemy a fixed battery');
section('const TRIAL_PD=','// Small craft and missiles a pilot');
section('function trialShotGeometry(','// Missiles leave');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('weapon roles keep explicit dual-purpose guns, pure defence and existing craft/ion roles distinct',()=>{
 assert.deepEqual(plain(C.weaponRoles({tt:5,aa:6,dualPurpose:true})),{pointDefense:true,dualPurpose:true,purePointDefense:false});
 assert.deepEqual(plain(C.weaponRoles({tt:2e-6,aa:6})),{pointDefense:true,dualPurpose:false,purePointDefense:true});
 for(const spec of [C.FITS.quad200,C.FITS.ion,{tt:5,aa:6,dualPurpose:true,ion:1},{tt:5,aa:6,dualPurpose:true,msl:1}])assert.equal(C.weaponRoles(spec).pointDefense,false);
});

test('the real small dual-purpose gun fires at ships and switches to automatic missile/craft interception',()=>{
 assert.equal(C.FITS.pd.dualPurpose,true,'the installed PD fitting must declare its new role');
 for(const kind of ['missile','craft']){
  run('reset();trialGunnery(.01)');assert.ok(run('trial.gun.shots')>0);assert.equal(run('trial.turrets[0].pd'),false);assert.ok(run('trial.bolts.every(b=>!b.pd&&b.tt>0)'));
  cx.kind=kind;run('reset();trial.fire=false;threat(kind);trialGunnery(.01)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.turrets[0].pd'),true);assert.ok(run('trial.gun.pd')>0);assert.ok(run('trial.bolts.every(b=>b.pd&&b.target.kind===kind)'));
  run('for(let i=0;i<30;i++)trialGunnery(.01)');assert.equal(run('downs'),1,'the actual interception bolt must destroy its target');
 }
});

test('a newly arrived missile takes priority over a farther craft without resetting the battery',()=>{
 run('reset();var craft=threat(\"craft\",[2000,0,0]);trialGunnery(.01);var cycleBefore=trial.turrets[0].reload;var missile=threat(\"missile\",[2000,0,0]);trialGunnery(.01)');
 assert.equal(run('trial.turrets[0].pdTarget===missile'),true);assert.ok(run('trial.turrets[0].reload<cycleBefore'));assert.equal(run('trial.gun.pd'),run('trial.turrets[0].barrels'));
});

test('switching target roles shares one reload and one energy debit, then returns to ship fire',()=>{
 run('reset();trialGunnery(.01);var firstEnergy=trial.energy.E,firstShots=trial.gun.shots;threat();trialGunnery(.01)');
 assert.equal(run('trial.turrets[0].pd'),true);assert.equal(run('trial.gun.pd||0'),0,'switching modes cannot reset the barrel reload');near(run('trial.energy.E'),run('firstEnergy'));
 run('for(let i=0;i<22;i++)trialGunnery(.01);var pdShots=trial.gun.pd||0,pdEnergy=trial.energy.E;trial.foeMissiles=[];trialGunnery(.01)');
 assert.ok(run('pdShots')>0);assert.equal(run('trial.turrets[0].pd'),false);assert.equal(run('trial.gun.shots'),run('firstShots'));near(run('trial.energy.E'),run('pdEnergy'));
 run('for(let i=0;i<22;i++)trialGunnery(.01)');assert.ok(run('trial.gun.shots>firstShots'));
 const volleys=run('(trial.gun.shots+(trial.gun.pd||0))/trial.turrets[0].barrels'),cost=run('trial.turrets[0].power*trial.turrets[0].cycle*trial.turrets[0].costK/TT_J');near(1000-run('trial.energy.E'),volleys*cost);
});

test('pure point defence stays automatic-only and unreachable threats do not divert dual-purpose guns',()=>{
 run('reset("testPurePd");trialGunnery(.01)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);assert.equal(run('trial.turrets[0].pd'),true);
 run('threat();trialGunnery(.01)');assert.ok(run('trial.gun.pd')>0);
 for(const pos of [[7000,0,0],[0,-1000,0]]){cx.pos=pos;run('reset();threat("missile",pos);trialGunnery(.01)');assert.equal(run('trial.turrets[0].pd'),false);assert.ok(run('trial.gun.shots')>0);}
});

test('generated fleet profiles retain the dual-purpose rating and current revision through empty-complement sanitizing',()=>{
 const ship=C.newShip({L:100,W:40,H:20});ship.parts=[];ship.fits=[{id:1,k:'pd',p:[50,20,0],a:2,ped:0,base:0,low:0,float:false}];
 const p=C.fleetProfile(C.computeStats(ship),'Dual-purpose test',ship);assert.equal(p.profileVersion,C.FLEET_PROFILE_VERSION);assert.ok(p.dualPurpose?.aa>0);assert.equal(C.fitBand(C.FITS.pd),'close','20 GT barrels belong to close-range fire');assert.ok(p.dualPurpose.gunBands.close.some(n=>n>0));assert.ok(p.modules.some(m=>m.fit===1&&m.pd&&m.dualPurpose));
 assert.equal(C.emptyDesignProfile({profileVersion:C.FLEET_PROFILE_VERSION,dualPurpose:{aa:6},slots:12}).profileVersion,C.FLEET_PROFILE_VERSION);
 assert.equal(C.emptyDesignProfile({profileVersion:2,dualPurpose:{aa:6}}).dualPurpose.aa,6);
});

function fleetProfile(){const p=plain(D.cr90.p);Object.assign(p,{len:100,width:40,height:30,hp:1e9,acc:1,accel:0,maxSpeed:0,turnRate:0,D:0,shieldBuffer:0,reserve:0,gunArcs:Array(6).fill(30),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(0),mid:Array(6).fill(30),close:Array(6).fill(0)},aa:6,aaArcs:Array(6).fill(6),aaCh:4,msl:0,imsl:0,slots:0,embarkedSlots:0,launch:0,crewNeed:0,crewMax:0,autoCrew:0,wCap:1000,modules:[],grid:{P:C.TT*1000,fixed:0,De:0,Ds:0,Dw:C.TT*100},dualPurpose:{gunArcs:Array(6).fill(25),gunBands:{long:Array(6).fill(0),mid:Array(6).fill(25),close:Array(6).fill(0)},aaArcs:Array(6).fill(6),aa:6}});for(const k of ['hf','outline','heat','sw','mouths','surface'])delete p[k];return p;}

test('fleet role reservation removes only the shared battery while preserving other ship guns',()=>{
 const p=fleetProfile(),u=C.fleetUnit('own','own',p,0),target={pos:[3000,0,0]},missile={side:1,n:8,pos:[1000,0,0]};u.pos=[0,0,0];u.yaw=0;u.side=0;
 near(C.fleetFire(u,target,3000).gun,30);near(R.pdToward(u,missile.pos,true),0);near(R.pdToward(u,missile.pos),6);assert.equal(C.fleetDefense(u,[missile]),true);near(C.fleetFire(u,target,3000).gun,5);near(R.pdToward(u,missile.pos,true),6);
 assert.equal(C.fleetDefense(u,[{...missile,side:0}]),false);near(C.fleetFire(u,target,3000).gun,30);
 assert.equal(C.fleetDefense(u,[{...missile,pos:[7000,0,0]}]),false);assert.equal(C.fleetDefense(u,[{...missile,n:0}]),false);
 u.p.dualPurpose.aaArcs=[6,0,0,0,0,0];assert.equal(C.fleetDefense(u,[{...missile,pos:[-1000,0,0]}]),false);
});

test('surface runtime does not spend a reserved dual-purpose bank as ship fire',()=>{
 const p=fleetProfile();p.surface={patches:[],shell:[],devices:[],mounts:[{id:1,module:-1,arcs:Array(6).fill(1),gun:25,ion:0,capacity:100,power:25*C.TT,boltTT:2.5,barrels:2,crewNeed:0,cycle:.2,band:'mid',dualPurpose:true},{id:2,module:-1,arcs:Array(6).fill(1),gun:5,ion:0,capacity:100,power:5*C.TT,boltTT:1,barrels:1,crewNeed:0,cycle:.2,band:'mid'}]};
 const u=C.fleetUnit('surface','own',p,0),t={pos:[3000,0,0],p:{len:100,width:40,height:30},yaw:0};u.pos=[0,0,0];u.yaw=0;u.dualDefense=true;u.surfaceBanks={1:100,2:100};u.energy=200;
 near(C.surfaceFleetFire(u,t,3000).gun,5);C.surfacePowerStep(u,null,t,5,.2,0);near(u.surfaceBanks[1],100);near(u.surfaceBanks[2],99);near(u.surfaceLastFire.gun,5);
 u.dualDefense=false;near(C.surfaceFleetFire(u,t,3000).gun,30);
});

test('real RTS missile interception reserves the battery for the step and ship fire resumes afterward',()=>{
 const p=fleetProfile(),w=R.createWorld({region:'kuat',seed:13,sensors:false,designs:[{key:'own',name:'Own',p,info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:plain(p),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]}),[u,e]=[...w.units.values()],sys=u.sys;
 for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}
 for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[12000,0,0],yaw:x===u?0:Math.PI,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});e.manual=true;
 w.missiles.push({id:'incoming',sys,side:1,from:e.id,target:u.id,n:8,pos:[4500,0,0],vel:[-220,0,0],s:220,life:45});
 R.tick(w,.25);assert.equal(u.dualDefense,true);assert.ok(w.missiles[0].n<8,'aggregate AA still intercepts the missile');assert.ok(u.lastShot?.gun>0,'the independent ship battery remains active');const defended=u.lastShot.gun;
 w.missiles=[];R.tick(w,.25);assert.equal(u.dualDefense,false);assert.ok(u.lastShot?.gun>defended*4,'the shared gun resumes its anti-ship output');
});


function tacticalFixture(){
 const p=fleetProfile();p.gunArcs=Array(6).fill(25);p.gunBands.mid=Array(6).fill(25);
 const q=plain(p);delete q.dualPurpose;q.aa=0;q.aaArcs=Array(6).fill(0);q.gunArcs=Array(6).fill(0);q.gunBands.mid=Array(6).fill(0);
 const u=C.fleetUnit('a-defender','own',p,0),e=C.fleetUnit('z-attacker','enemy',q,1);u.pos=[0,0,0];e.pos=[12000,0,0];u.yaw=0;e.yaw=Math.PI;
 for(const x of [u,e])x.order={type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'};
 return {u,e,b:C.fleetBattle([u,e],true)};
}
const tacticalStep=f=>C.fleetTick(f.b,.25,{collide:false}),gunFrom=(shots,id)=>shots.filter(s=>s.from===id).reduce((n,s)=>n+(s.gun||0),0);

test('the real tactical fleet clock assigns the battery to missile defence and restores ship fire afterward',()=>{
 const f=tacticalFixture();f.e.p.msl=80;f.e.p.modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},{k:'launcher',fit:2,port:'f2',domain:'main',name:'One finite ship missile cell',size:1,share:1,at:.5,powerConnected:true,stock:6,missileKind:'shipMsl',launcherCells:1,salvo:1,cycle:1.2,tt:25,range:60000,launchPowerW:1e15,muzzle:[10,2,0],launchDir:[1,0,0]}];f.e.mods=[1,1];f.e.ammo=[0,6];f.e.p.grid.fixed=1e15;f.e.p.grid.fixedLoads=[{id:'f2',port:'f2',domain:'main',weight:1e15}];
 const shots=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(shots,f.u.id),0,'interception cannot reuse these barrels for ship fire');
 const missile=shots.find(s=>s.from===f.e.id);assert.equal(f.e.ammo[1],5,'one real missile leaves the finite six-round cell');assert.equal(missile?.launches?.length,1);assert.equal(missile.launches[0].n,1);assert.equal(missile.launches[0].tt,25);assert.ok(missile.msl>0&&missile.msl<25,'reserved AA reduces the one-shot 25 TT physical missile energy');
 f.e.p.msl=0;f.e.ammo[1]=0;f.e.mods[1]=0;const resumed=tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(gunFrom(resumed,f.u.id)>0,'the battery returns to anti-ship fire without a threat');
});

test('the real tactical fleet clock assigns the battery to aircraft defence and restores ship fire afterward',()=>{
 const f=tacticalFixture();f.e.air=8;
 const shots=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(shots,f.u.id),0);assert.ok(f.e.air<8,'reserved AA must cause actual aircraft attrition');
 f.e.air=0;const resumed=tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(gunFrom(resumed,f.u.id)>0);
});

test('aircraft arriving after tactical role selection cannot reuse a ship-firing battery for AA in that step',()=>{
 const f=tacticalFixture();f.e.queue=[[0,8]];
 const shots=tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(gunFrom(shots,f.u.id)>0);near(f.e.air,8);
 const defended=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(defended,f.u.id),0);assert.ok(f.e.air<8);
});

test('tactical reservation ignores ceased fire and empty magazines while independent AA remains active',()=>{
 const f=tacticalFixture();f.u.p.aa=8;f.u.p.aaArcs=Array(6).fill(8);f.e.queue=[[0,8]];
 tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(f.e.air<8,'the two independent AA points retain their existing role');
 f.e.air=0;f.e.p.msl=80;f.e.p.modules=[{k:'launcher',stock:0,size:1,share:1}];f.e.mods=[1];f.e.ammo=[0];
 const empty=tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(gunFrom(empty,f.u.id)>0);
 f.e.ammo=[8];f.e.order.fire=false;const ceased=tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(gunFrom(ceased,f.u.id)>0);
});
