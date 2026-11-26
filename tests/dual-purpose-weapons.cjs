const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}}),run=s=>vm.runInContext(s,cx),plain=x=>JSON.parse(JSON.stringify(x));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,R,D}=run('({C:Core,R:Rts,D:YardFleetData.designs})'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,TT_J=C.TT,trial={};let aimPoint=[10000,0,0],downs=0;
// The isolated gunnery harness resolves the same live unit as the app.
const trialSystemsUnit=()=>trial.battle?.me||trial.systemsUnit||null;
Math.random=()=>.1;
const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
const trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialPowerStep=()=>{},trialSalvoPlan=()=>null,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],trialCraftGasReady=()=>true,trialCraftGasTake=()=>true,sndAt=()=>{},sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'',trialThreatDown=q=>{q.alive=false;downs++;};
C.FITS.testPurePd={...C.FITS.pd,dualPurpose:false,tt:2e-6,boltTT:1e-6,power:2e-6/.2*TT_J};
function reset(key='pd'){
 Object.assign(trial,{craft:false,systemsUnit:{p:{modules:[]}},p:{len:100},asset:{geometry:{center:[0,0,0],targetRadius:5}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1000,cap:1000},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],drones:[],foeCraft:[],foeMissiles:[],rays:{busy:true,last:0}});
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
section('function trialShotGeometry(','// Missiles leave');section('function trialTrackBolt(','// Fixed barrels never turn toward a target.');/* 2026-11-25 fixture changed (no expectation changed): trialGunnery now calls trialTrackBolt (the X-wing nozzle; user「Xウィング型のアンテナっぽいノズルをつけるとロックオン標的に対して数度動いて当てれるようになる」) and the pilot's guns take their order from trialPilotFiringOrder / gunFiringSequence (js/app.js), which lie outside the sections extracted above; this adds those three functions. */
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
// 2026-11-15, user decisions (rewritten with this record; the tests below stated the old rule, in which a
// dual-purpose gun fired at ships and switched to interception only while a threat was near):
//  - automatic interception ON: point defence, dual-purpose included, is kept for craft, missiles and torpedoes and
//    never joins the fire on ships, threat or no threat (fleetDefense reserves the shared battery while ON);
//  - automatic interception OFF: it fires on ships in its reach like any gun, and does not intercept by itself;
//  - rapid fire shoots one barrel at a time from the whole mount (a volley fires every barrel at once).
// Old expectations replaced: 3 (ship fire with ON and no threat), 4 (both barrels in one interception shot),
// 5, 6, 8, 10-14 (ship fire restored when the threat leaves while ON). Each case now checks ON and OFF.

test('only explicitly designated point defence automatically intercepts, independently of yield or tracking capability',()=>{
 assert.deepEqual(plain(C.weaponRoles({tt:5,aa:6,dualPurpose:true})),{pointDefense:false,dualPurpose:false,purePointDefense:false});
 assert.deepEqual(plain(C.weaponRoles({tt:2e-6,aa:6})),{pointDefense:false,dualPurpose:false,purePointDefense:false});
 assert.deepEqual(plain(C.weaponRoles({tt:5,aa:6,dualPurpose:true,pointDefense:true})),{pointDefense:true,dualPurpose:true,purePointDefense:false});
 assert.deepEqual(plain(C.weaponRoles({tt:2e-6,aa:6,pointDefense:true})),{pointDefense:true,dualPurpose:false,purePointDefense:true});
 for(const spec of [C.FITS.ion,{tt:5,aa:6,dualPurpose:true,ion:1},{tt:5,aa:6,dualPurpose:true,msl:1}])assert.equal(C.weaponRoles(spec).pointDefense,false);
 assert.equal(C.weaponRoles(C.FITS.quad200).dualPurpose,false);assert.ok(C.FITS.quad200.aa>C.FITS.stl.aa,'a normal gun retains its real tracking capability without becoming automatic point defence');
});

test('disabling automatic interception preserves deliberate fire for pure and dual-purpose PD mounts',()=>{
 for(const key of['pd','testPurePd']){cx.key=key;run("reset(key);trial.fire=false;threat('missile');C.setAutomaticPointDefense(trial.systemsUnit,false);var before=trial.energy.E;trialGunnery(.01)");assert.equal(run('trial.gun.pd||0'),0);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.turrets[0].pdTarget'),null);assert.equal(run('trial.energy.E'),run('before'));assert.equal(run('trial.turrets[0].pdCapable'),true);
 run('trial.fire=true;trialGunnery(.01)');assert.ok(run('trial.gun.shots')>0);assert.equal(run('trial.gun.pd||0'),0);assert.ok(run('trial.bolts.every(b=>!b.pd)'));assert.ok(run('trial.energy.E<before'));
 }
});

test('the real small dual-purpose gun intercepts missiles and craft while automatic interception is ON, and fires at ships only while it is OFF',()=>{
 assert.equal(C.FITS.pd.dualPurpose,true,'the installed PD fitting must declare its new role');
 for(const kind of ['missile','craft']){
  run('reset();trialGunnery(.01)');assert.equal(run('trial.gun.shots'),0,'ON, no threat: no fire on ships');assert.equal(run('trial.turrets[0].pd'),true);
  run('reset();C.setAutomaticPointDefense(trial.systemsUnit,false);trialGunnery(.01)');assert.ok(run('trial.gun.shots')>0,'OFF: fires on ships');assert.equal(run('trial.turrets[0].pd'),false);assert.ok(run('trial.bolts.every(b=>!b.pd&&b.tt>0)'));
  cx.kind=kind;run('reset();trial.fire=false;threat(kind);trialGunnery(.01)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.turrets[0].pd'),true);assert.ok(run('trial.gun.pd')>0);assert.ok(run('trial.bolts.every(b=>b.pd&&b.target.kind===kind)'));
  run('for(let i=0;i<30;i++)trialGunnery(.01)');assert.equal(run('downs'),1,'the actual interception bolt must destroy its target');
 }
});

test('a newly arrived missile takes priority over a farther craft without resetting the battery',()=>{
 run('reset();var craft=threat(\"craft\",[2000,0,0]);trialGunnery(.01);var cycleBefore=trial.turrets[0].reload;var missile=threat(\"missile\",[2000,0,0]);trialGunnery(.01)');
 assert.equal(run('trial.turrets[0].pdTarget===missile'),true);assert.ok(run('trial.turrets[0].reload<cycleBefore'));assert.equal(run('trial.gun.pd'),1,'rapid fire: one barrel a shot');
});

test('switching automatic interception ON shares one reload and one energy debit; switching it OFF returns the gun to ship fire',()=>{
 // 2026-11-24 expectation changed (gun rules; docs/benchmarks/gun-rules-2026-11-24/expectation-changes.md): the pd's cycle is 1 s
 // (one 800 kt shot a second a barrel; was 0.2 s), so the 22 steps of 0.01 s (one old cycle and two steps) are now one cycle and two steps.
 run('var STEPS=Math.ceil(C.FITS.pd.cycle/.01)+2');
 run('reset();C.setAutomaticPointDefense(trial.systemsUnit,false);trialGunnery(.01);var firstEnergy=trial.energy.E,firstShots=trial.gun.shots;C.setAutomaticPointDefense(trial.systemsUnit,true);threat();trialGunnery(.01)');
 assert.equal(run('trial.turrets[0].pd'),true);assert.equal(run('trial.gun.pd||0'),0,'switching modes cannot reset the barrel reload');near(run('trial.energy.E'),run('firstEnergy'));
 run('for(let i=0;i<STEPS;i++)trialGunnery(.01);var pdShots=trial.gun.pd||0,pdEnergy=trial.energy.E;trial.foeMissiles=[];trialGunnery(.01)');
 assert.ok(run('pdShots')>0);assert.equal(run('trial.turrets[0].pd'),true,'still ON: kept for interception with no threat');assert.equal(run('trial.gun.shots'),run('firstShots'));near(run('trial.energy.E'),run('pdEnergy'));
 run('C.setAutomaticPointDefense(trial.systemsUnit,false);for(let i=0;i<STEPS;i++)trialGunnery(.01)');assert.equal(run('trial.turrets[0].pd'),false);assert.ok(run('trial.gun.shots>firstShots'));
 const volleys=run('(trial.gun.shots+(trial.gun.pd||0))/trial.turrets[0].barrels'),cost=run('trial.turrets[0].power*trial.turrets[0].cycle*trial.turrets[0].costK/TT_J');near(1000-run('trial.energy.E'),volleys*cost);
});

test('pure point defence stays automatic-only; a dual-purpose gun is kept for interception while ON even with no reachable threat, and fires on ships while OFF',()=>{
 run('reset("testPurePd");trialGunnery(.01)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);assert.equal(run('trial.turrets[0].pd'),true);
 run('threat();trialGunnery(.01)');assert.ok(run('trial.gun.pd')>0);
 for(const pos of [[7000,0,0],[0,-1000,0]]){cx.pos=pos;run('reset();threat("missile",pos);trialGunnery(.01)');assert.equal(run('trial.turrets[0].pd'),true);assert.equal(run('trial.gun.shots'),0);
  run('reset();C.setAutomaticPointDefense(trial.systemsUnit,false);threat("missile",pos);trialGunnery(.01)');assert.equal(run('trial.turrets[0].pd'),false);assert.ok(run('trial.gun.shots')>0);}
});

test('generated fleet profiles retain the dual-purpose rating and current revision through empty-complement sanitizing',()=>{
 const ship=C.newShip({L:100,W:40,H:20});ship.parts=[];ship.fits=[{id:1,k:'pd',p:[50,20,0],a:2,ped:0,base:0,low:0,float:false}];
 const p=C.fleetProfile(C.computeStats(ship),'Dual-purpose test',ship);assert.equal(p.profileVersion,C.FLEET_PROFILE_VERSION);assert.ok(p.dualPurpose?.aa>0);assert.equal(C.fitBand(C.FITS.pd),'close','20 GT barrels belong to close-range fire');assert.ok(p.dualPurpose.gunBands.close.some(n=>n>0));assert.ok(p.modules.some(m=>m.fit===1&&m.pd&&m.dualPurpose));
 assert.equal(C.emptyDesignProfile({profileVersion:C.FLEET_PROFILE_VERSION,dualPurpose:{aa:6},slots:12}).profileVersion,C.FLEET_PROFILE_VERSION);
 assert.equal(C.emptyDesignProfile({profileVersion:2,dualPurpose:{aa:6}}).dualPurpose.aa,6);
});

function fleetProfile(){const p=plain(D.cr90.p);Object.assign(p,{profileVersion:C.FLEET_PROFILE_VERSION,len:100,width:40,height:30,hp:1e9,acc:1,accel:0,maxSpeed:0,turnRate:0,D:0,shieldBuffer:0,reserve:0,gunArcs:Array(6).fill(30),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(0),mid:Array(6).fill(30),close:Array(6).fill(0)},aa:6,aaArcs:Array(6).fill(6),aaCh:4,msl:0,imsl:0,slots:0,embarkedSlots:0,launch:0,crewNeed:0,crewMax:0,autoCrew:0,wCap:1000,modules:[],grid:{P:C.TT*1000,fixed:0,De:0,Ds:0,Dw:C.TT*100},dualPurpose:{gunArcs:Array(6).fill(25),gunBands:{long:Array(6).fill(0),mid:Array(6).fill(25),close:Array(6).fill(0)},aaArcs:Array(6).fill(6),aa:6}});for(const k of ['hf','outline','heat','sw','mouths','surface'])delete p[k];
 // 2026-11-25 fixture changed: the CR90's guns are now 200 GT turbolasers on short barrels (GUN_RULES.turbolaserShot), so its
 // profile carries their reach (gunBandRules.mid, about 2.9 km). The battery of this fixture is a synthetic 30 TT/s mid-range
 // one, not those guns, so it does not inherit their range rows: it fires at the band's nominal range as before.
 assert.ok(C.gunRulesReach(p.gunBandRules.mid,C.GUN_BANDS.mid.range)<3000,'the CR90\'s own mid guns do not reach the 3 km target of these cases');
 for(const k of ['gunBandRules','ionRules'])delete p[k];return p;}

test('fleet role reservation removes only the shared battery while preserving other ship guns',()=>{
 const p=fleetProfile(),u=C.fleetUnit('own','own',p,0),target={pos:[3000,0,0]},missile={side:1,n:8,pos:[1000,0,0]};u.pos=[0,0,0];u.yaw=0;u.side=0;
 near(C.fleetFire(u,target,3000).gun,30);near(R.pdToward(u,missile.pos,true),0);near(R.pdToward(u,missile.pos),6);assert.equal(C.fleetDefense(u,[missile]),true);near(C.fleetFire(u,target,3000).gun,5);near(R.pdToward(u,missile.pos,true),6);
 assert.equal(C.fleetDefense(u,[{...missile,side:0}]),false,'no hostile threat');near(C.fleetFire(u,target,3000).gun,5,'still reserved while ON');
 C.setAutomaticPointDefense(u,false);assert.equal(C.fleetDefense(u,[missile]),false);near(C.fleetFire(u,target,3000).gun,30,'OFF: the shared battery fires on ships');C.setAutomaticPointDefense(u,true);
 assert.equal(C.fleetDefense(u,[{...missile,pos:[7000,0,0]}]),false);assert.equal(C.fleetDefense(u,[{...missile,n:0}]),false);
 u.p.dualPurpose.aaArcs=[6,0,0,0,0,0];assert.equal(C.fleetDefense(u,[{...missile,pos:[-1000,0,0]}]),false);
});

test('surface runtime does not spend a reserved dual-purpose bank as ship fire',()=>{
 const p=fleetProfile();p.surface={patches:[],shell:[],devices:[],mounts:[{id:1,module:-1,arcs:Array(6).fill(1),gun:25,ion:0,capacity:100,power:25*C.TT,boltTT:2.5,barrels:2,crewNeed:0,cycle:.2,band:'mid',dualPurpose:true},{id:2,module:-1,arcs:Array(6).fill(1),gun:5,ion:0,capacity:100,power:5*C.TT,boltTT:1,barrels:1,crewNeed:0,cycle:.2,band:'mid'}]};
 const u=C.fleetUnit('surface','own',p,0),t={pos:[3000,0,0],p:{len:100,width:40,height:30},yaw:0};u.pos=[0,0,0];u.yaw=0;u.dualDefense=true;u.surfaceBanks={1:100,2:100};u.energy=200;
 near(C.surfaceFleetFire(u,t,3000).gun,5);C.surfacePowerStep(u,null,t,5,.2,0);near(u.surfaceBanks[1],100);near(u.surfaceBanks[2],99);near(u.surfaceLastFire.gun,5);
 u.dualDefense=false;near(C.surfaceFleetFire(u,t,3000).gun,30);
});

test('real RTS missile interception: the battery is reserved while ON and returns to ship fire when switched OFF',()=>{
 const p=fleetProfile(),w=R.createWorld({region:'kuat',seed:13,sensors:false,designs:[{key:'own',name:'Own',p,info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:plain(p),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]}),[u,e]=[...w.units.values()],sys=u.sys;
 for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}
 for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[12000,0,0],yaw:x===u?0:Math.PI,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});e.manual=true;
 // 2026-11-19 fixture changed: the target's sections are made a million times sturdier. With v30 sections (u.hp
 // retired, docs/damage-penetration.md:20,60) the profile's hp:1e9 no longer applies, so the 30 TT/s battery sank the
 // enemy in the first tick, the battle closed and the OFF step recorded no new shot. Same pattern as
 // tests/fleet-missiles-arrive.cjs and tests/power-loss-stays-in-battle.cjs.
 for(const x of e.sec){x.max*=1e6;x.s=x.max;}
 w.missiles.push({id:'incoming',sys,side:1,from:e.id,target:u.id,n:8,pos:[4500,0,0],vel:[-220,0,0],s:220,life:45});
 R.tick(w,.25);assert.equal(u.dualDefense,true);assert.ok(w.missiles[0].n<8,'aggregate AA still intercepts the missile');assert.ok(u.lastShot?.gun>0,'the independent ship battery remains active');const defended=u.lastShot.gun;
 // (ON with no threat is checked on the tactical clock below: in this RTS fixture the local battle closes once nobody
 // fires, so a step without a threat records no shot to compare.)
 C.setAutomaticPointDefense(u,false);R.tick(w,.25);assert.equal(u.dualDefense,false);assert.ok(u.lastShot?.gun>defended*4,`OFF: the shared gun joins the anti-ship fire (${u.lastShot?.gun} against ${defended})`);
});


function tacticalFixture(){
 const p=fleetProfile();p.gunArcs=Array(6).fill(25);p.gunBands.mid=Array(6).fill(25);
 // This synthetic 25 TT/s battery needs a finite capital-ship thermal mass;
 // inheriting the cached CR90 mass blacks it out after its first paid shot.
 p.mass=1e9;p.propulsion={...p.propulsion,massKg:1e12};
 const q=plain(p);delete q.dualPurpose;q.aa=0;q.aaArcs=Array(6).fill(0);q.gunArcs=Array(6).fill(0);q.gunBands.mid=Array(6).fill(0);
 const u=C.fleetUnit('a-defender','own',p,0),e=C.fleetUnit('z-attacker','enemy',q,1);u.pos=[0,0,0];e.pos=[12000,0,0];u.yaw=0;e.yaw=Math.PI;
 for(const x of [u,e])x.order={type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'};
 return {u,e,b:C.fleetBattle([u,e],true)};
}
const tacticalStep=f=>C.fleetTick(f.b,.25,{collide:false}),gunFrom=(shots,id)=>shots.filter(s=>s.from===id).reduce((n,s)=>n+(s.gun||0),0);

test('the real tactical fleet clock keeps the battery for missile defence while ON and gives it to ship fire when OFF',()=>{
 const f=tacticalFixture();f.e.pos=[9000,0,0];/* 2026-11-24 fixture changed: a ship's small cell missiles go at a ship only within 10 km (user「小型ミサイルは対小型艦の防空用途と近距離の対艦攻撃」), so the attacker closes to 9 km */f.e.p.msl=80;/* 2026-11-24 fixture changed: the attacker fires from 12 km, beyond the 10 km heat seeker, so it is given an ISD-72x-sized dome (a tracking slot; user「艦の発射機のミサイルは艦の至近まではレーダー誘導のみ（センサーと捕捉枠が必要）」) */f.e.p.modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},{k:'launcher',fit:2,port:'f2',domain:'main',name:'One finite ship missile cell',size:1,share:1,at:.5,powerConnected:true,stock:6,missileKind:'shipMsl',launcherCells:1,salvo:1,cycle:1.2,tt:25,range:60000,launchPowerW:1e15,muzzle:[10,2,0],launchDir:[1,0,0]},{k:'sensor',name:'ISD-72x-sized dome (test fixture)',size:31527,trackVol:30340,share:1,at:.5,domain:'main'}];f.e.mods=[1,1];f.e.ammo=[0,6];f.e.p.grid.fixed=1e15;f.e.p.grid.fixedLoads=[{id:'f2',port:'f2',domain:'main',weight:1e15}];
 const shots=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(shots,f.u.id),0,'interception cannot reuse these barrels for ship fire');
 const missile=shots.find(s=>s.from===f.e.id);assert.equal(f.e.ammo[1],5,'one real missile leaves the finite six-round cell');assert.equal(missile?.launches?.length,1);assert.equal(missile.launches[0].n,1);assert.equal(missile.launches[0].tt,25);/* v28 (2026-11-18, docs/missiles-arrive.md): the launch record carries what was launched; point defence shoots at the round in flight (tests/fleet-missiles-arrive.cjs, tests/point-defense-toggle-aircraft.cjs), no longer as a share at the launch. This line stated 0 < msl < 25. */assert.ok(Math.abs(missile.msl-25)<1e-9,'the launch record carries the whole 25 TT round');assert.equal(f.b.missiles.length,1);assert.equal(f.b.missiles[0].n,1,'nothing is taken at the launch');
 f.e.p.msl=0;f.e.ammo[1]=0;f.e.mods[1]=0;const after=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(after,f.u.id),0,'still ON with no threat');
 C.setAutomaticPointDefense(f.u,false);const resumed=tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(gunFrom(resumed,f.u.id)>0,'OFF: the battery fires on ships');
});

test('the real tactical fleet clock keeps the battery for aircraft defence while ON and gives it to ship fire when OFF',()=>{
 const f=tacticalFixture();f.e.air=8;
 const shots=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(shots,f.u.id),0);assert.ok(f.e.air<8,'reserved AA must cause actual aircraft attrition');
 f.e.air=0;const after=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(after,f.u.id),0);
 C.setAutomaticPointDefense(f.u,false);const resumed=tacticalStep(f);assert.equal(f.u.dualDefense,false);assert.ok(gunFrom(resumed,f.u.id)>0);
});

test('a ship-firing battery (OFF) never intercepts arriving aircraft; ON it is reserved from the first step and intercepts them',()=>{
 const off=tacticalFixture();C.setAutomaticPointDefense(off.u,false);off.e.queue=[[0,8]];
 for(let i=0;i<2;i++){const shots=tacticalStep(off);assert.equal(off.u.dualDefense,false);assert.ok(gunFrom(shots,off.u.id)>0);}assert.equal(off.u.ht.online,true);
 const f=tacticalFixture();f.e.queue=[[0,8]];
 const first=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(first,f.u.id),0);
 const defended=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(defended,f.u.id),0);assert.ok(f.e.air<8);
});

test('the shared battery is reserved while ON whatever the threat (independent AA still pays); OFF it fires on ships past ceased fire and empty magazines',()=>{
 const f=tacticalFixture();
 // Back the independent AA rating with an actual typed, connected PD output
 // and finite reactor/capacitor budget rather than adding a free AA statistic.
 const P=f.u.p.grid.P;
 f.u.p.modules=[{k:'reactor',part:90,port:'p90',domain:'main',size:1,share:1},{k:'weapon',fit:91,port:'f91',domain:'main',size:1,share:.5,pd:true,dualPurpose:true,weaponPowerW:25*C.TT,powerConnected:true},{k:'weapon',fit:92,port:'f92',domain:'main',size:1,share:.5,pd:true,dualPurpose:false,weaponPowerW:C.FITS.testPurePd.power,powerConnected:true}];f.u.mods=[1,1,1];
 f.u.p.grid.domains=[{id:'main',P,sources:[{moduleIndex:0,P}],modules:[0,1,2]}];f.u.p.grid.powerPaths=[{from:'p90',to:'f91',cap:P,ok:true},{from:'p90',to:'f92',cap:P,ok:true}];
 f.u.p.aa=8;f.u.p.aaArcs=Array(6).fill(8);f.e.queue=[[0,8]];
 tacticalStep(f);assert.equal(f.u.dualDefense,true,'ON: reserved');assert.ok(f.e.air<8,'the two independent AA points retain their existing role');assert.ok(f.u.pointDefenseLastFire?.spentTT>0,'independent interception pays from its real stored weapon energy');
 f.e.air=0;f.e.pos=[9000,0,0];/* 2026-11-24 fixture changed: a ship's small cell missiles go at a ship only within 10 km (user「小型ミサイルは対小型艦の防空用途と近距離の対艦攻撃」), so the attacker closes to 9 km */f.e.p.msl=80;/* 2026-11-24 fixture changed: the attacker fires from 12 km, beyond the 10 km heat seeker, so it is given an ISD-72x-sized dome (a tracking slot; user「艦の発射機のミサイルは艦の至近まではレーダー誘導のみ（センサーと捕捉枠が必要）」) */f.e.p.modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},{k:'launcher',fit:2,port:'f2',domain:'main',name:'Finite missile cell',size:1,share:1,at:.5,powerConnected:true,stock:6,missileKind:'shipMsl',launcherCells:1,salvo:1,cycle:1.2,tt:25,range:60000,launchPowerW:1e15,muzzle:[10,2,0],launchDir:[1,0,0]},{k:'sensor',name:'ISD-72x-sized dome (test fixture)',size:31527,trackVol:30340,share:1,at:.5,domain:'main'}];f.e.mods=[1,1];f.e.ammo=[0,0];f.e.p.grid.fixed=1e15;f.e.p.grid.fixedLoads=[{id:'f2',port:'f2',domain:'main',weight:1e15}];
 const reserved=tacticalStep(f);assert.equal(f.u.dualDefense,true);assert.equal(gunFrom(reserved,f.u.id),0,'ON with an empty enemy magazine: still no ship fire from the shared battery');
 // 2026-11-26 expectation changed (user「命中する砲弾のみを1発1発シミュレーションする」, C.fleetRounds): the fire is whole rounds, so one step may fire none (the part of
 // a round is carried over) or land none (they missed). The battery firing on ships is read as: within a few steps it fires rounds at the ship
 // (the shot record's `fired`). Was: gun landed > 0 in the very next step, at rate x chance.
 const firedFrom=(shots,id)=>shots.filter(s=>s.from===id&&!s.flak).reduce((n,s)=>n+(s.fired||0)+(s.gun||0),0),stepsFiring=()=>{let n=0;for(let i=0;i<40&&!(n>0);i++)n+=firedFrom(tacticalStep(f),f.u.id);return n;};
 C.setAutomaticPointDefense(f.u,false);const empty=stepsFiring();assert.equal(f.u.dualDefense,false);assert.ok(empty>0,'OFF: the shared battery fires rounds at the ship');
 f.e.ammo[1]=6;f.e.order.fire=false;const ceased=stepsFiring();assert.equal(f.u.dualDefense,false);assert.ok(ceased>0);
});
// Physics review 2026-11-15: rapid fire one barrel at a time keeps its rate whatever the frame time (the owed time is
// carried across frames) and kicks the aim by one barrel's share of a volley.
test('a twin gun in rapid fire keeps barrels ÷ cycle shots a second at 1/60, 1/30 and 1/20 s frames',()=>{
 for(const dt of [1/60,1/30,.05]){cx.dt=dt;run('reset();C.setAutomaticPointDefense(trial.systemsUnit,false);trial.energy.E=trial.energy.cap=1e12;for(let i=0;i<Math.round(10/dt);i++)trialGunnery(dt)');
  // 2026-11-25 expectation changed (user「点防御は1門0.1で約15秒間持続射撃でき、その後リチャージに30秒で」, docs/benchmarks/gun-rules-2026-11-24/followup-2026-11-25/README.md):
  // the point-defence gun fires every gunRule.fireS (0.1 s) a barrel while its 15 s cartridge lasts, so the first 10 s hold barrels ÷ fireS
  // shots a second (2 ÷ 0.1 × 10 = 200, less the jitter); FITS.pd.cycle (0.3 s) is now its mean period over fire and cartridge change. Was
  // barrels ÷ cycle × 10 (about 66).
  const d=run('C.FITS.pd');assert.equal(d.gunRule.fireS,.1);assert.ok(d.gunRule.burstS>10,'the 10 s lie inside one cartridge');const want=d.barrels/d.gunRule.fireS*10/1.008/* the harness fixes Math.random at 0.1: jitter 1+0.1×0.08 */,got=run('trial.gun.shots');assert.ok(Math.abs(got-want)<=want*.025,`dt ${dt}: ${got} shots in 10 s, about ${want.toFixed(0)} expected`);}
});
// High review 2026-11-15: time the gun could not fire (no energy) is not paid back as every barrel at once.
test('after a second without energy a rapid-fire gun resumes one barrel at a time',()=>{
 run('reset();C.setAutomaticPointDefense(trial.systemsUnit,false);trial.turrets[0].barrels=4;trial.energy.E=trial.energy.cap=1e12;for(let i=0;i<90;i++)trialGunnery(1/30);trial.energy.E=0;trial.energy.cap=0;for(let i=0;i<30;i++)trialGunnery(1/30);trial.energy.E=trial.energy.cap=1e12;var perFrame=[];for(let i=0;i<10;i++){const before=trial.gun.shots;trialGunnery(1/30);perFrame.push(trial.gun.shots-before);}');
 // 2026-11-25 expectation changed (user「点防御は1門0.1で約15秒間持続射撃でき、その後リチャージに30秒で」): four barrels at 0.1 s a barrel are a shot every
 // 0.025 s, which is 1.33 shots a 1/30 s frame in steady fire, so a frame holds one or two shots (was at most one: 0.3 s ÷ 4 = 0.075 s a
 // shot). What this case guards is unchanged: the second without energy is not paid back as all four barrels at once.
 const perFrame=plain(run('perFrame')),steady=Math.ceil(1/30/(run('C.FITS.pd.gunRule.fireS')/4));assert.equal(steady,2);assert.ok(perFrame.every(n=>n<=steady&&n<4),`shots a frame after the energy returns: ${perFrame}`);assert.ok(perFrame.reduce((a,b)=>a+b,0)<=Math.ceil(10/30/(.1/4)*1.01),'no more than the steady rate over the ten frames: '+perFrame);assert.ok(perFrame.reduce((a,b)=>a+b,0)>=2);
});
