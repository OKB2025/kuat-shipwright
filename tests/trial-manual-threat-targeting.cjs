const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const cx=vm.createContext({console,performance:{now:()=>0}}),run=source=>vm.runInContext(source,cx),plain=value=>JSON.parse(JSON.stringify(value));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
function fn(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let i=app.indexOf('}',m.index);i>=0;i=app.indexOf('}',i+1)){const s=app.slice(m.index,i+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
run(`const C=Core,TT_J=C.TT,trial={},view={eye:()=>[0,0,0],cam:{target:[1,0,0]}},demands=[],shipHits=[];Math.random=()=>.5;
const TRIAL_GUN={boltSpeed:4500,range:40000,aim:20000,maxBolts:2400,hitsToKill:10};
const trialDronesStep=()=>{},trialPowerStep=(_dt,demand)=>demands.push(demand),trialSalvoPlan=()=>null,trialMissiles=()=>{},escortsFire=()=>{},trialCraftGasReady=()=>true,trialCraftGasTake=()=>true,sndAt=()=>{},sndPick=(...a)=>a[0],sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'',toast=()=>{},spaceDamage=(...a)=>shipHits.push(a),spaceImpact=()=>{};
function reset(key='single40'){
 demands.length=0;shipHits.length=0;view.cam.target=[1,0,0];Math.random=()=>.5;
 Object.assign(trial,{craft:false,p:{len:100,acc:C.GUN_ACCURACY.reference.acc,fireControl:true},asset:{geometry:{center:[0,0,0],targetRadius:5}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',gunTarget:null,fire:false,fireKey:false,fireTap:0,jump:null,battle:null,systemsUnit:{p:{modules:[]}},energy:{E:1000,cap:1000},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],launchers:[],fx:[],targets:[],drones:[],foeCraft:[],foeMissiles:[],rays:{busy:true,last:0},escorts:[]});
 const d=C.FITS[key],t=trialTurretState({id:2,k:key,origin:[0,0,0],fw:[1,0,0],axis:[0,1,0],cycle:d.cycle||1,power:d.power,barrels:d.barrels||1,rate:1000,r:2,ion:!!d.ion});t.clear=true;t.clearDir=t.fw.slice();t.charge=1;trial.turrets=[t];
}
function threat(kind='craft',distance=15000,extra={}){const q={id:'hostile-'+kind,kind,pos:[distance,0,0],vel:[0,0,0],alive:true,downs:0,onDown(){this.downs++;},...extra};trial[kind==='missile'?'foeMissiles':'foeCraft'].push(q);return q;}
function finishFlight(seconds=4){trial.fire=false;Math.random=()=>0;for(let i=0;i<Math.ceil(seconds/.05);i++)trialGunnery(.05);}
function chargedUnit(key,energy){const d=C.FITS[key],output=d.barrels*d.boltTT,power=d.power,p={hp:1e6,len:100,width:40,height:20,D:0,shieldBuffer:0,reserve:0,wCap:output*3,crewNeed:0,crewMax:0,accel:0,maxSpeed:0,turnRate:0,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},{k:'weapon',fit:2,port:'f2',domain:'main',share:1,size:1,powerConnected:true}],grid:{P:power*2,Pgen:power*2,fixed:0,cooling:0,De:0,Ds:0,Dw:power,powerPaths:[{from:'p1',to:'f2',cap:power,ok:true}],domains:[{id:'main',P:power*2,sources:[{moduleIndex:0,P:power*2}],modules:[0,1]}]},surface:{mounts:[{id:2,module:1,power,capacity:output*3,gun:output/d.cycle,ion:0,boltTT:d.boltTT,volleyTT:output,barrels:d.barrels,cycle:d.cycle,band:C.fitBand(d),arcs:Array(6).fill(1),muzzle:[0,0,0]}],patches:[],devices:[]}};
 const u=C.fleetUnit('manual','manual',p,0);C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:power,shields:0},0,'balanced');u.surfaceBanks={2:energy};u.energy=energy;return u;}
`);
section('const tv=','function trialProfile(');
section('const TRIAL_PILOT_CYCLE=','// opts.design');
section('const trialBarrel=','function trialAim(');
for(const line of app.split('\n'))if(line.startsWith('const TRIAL_PD=')||line.startsWith('const TRIAL_PILOT_HIT=')||line.startsWith('const trialPdColor='))run(line);
for(const name of ['trialAim','trialGunTarget','trialIntercept','trialThreats','trialPdPick','trialPdBoltHit','trialPilotThreats','trialPilotHit','trialThreatDown','trialAllyOnLine','trialBoxOnLine'])run(fn(name));
section('function trialShotGeometry(','// Missiles leave');
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('a capital reticle can explicitly lock hostile aircraft and missiles beyond the pilot range',()=>{
 for(const kind of ['craft','missile']){cx.kind=kind;run('reset();var q=threat(kind,15000);var aim=trialAim()');assert.equal(run('aim.lock===q'),true,kind);assert.equal(run('aim.dist'),15000);assert.ok(run('trial.turrets[0].reach')>15000);assert.equal(run('trial.gun.shots'),0);}
 run('reset();threat("craft",15000,{ally:true});threat("missile",15000,{ally:true})');assert.equal(run('trialAim().lock'),null,'allied small craft must not become a firing lock');
 run('reset();trial.craft=true;threat("craft",15000)');assert.equal(run('trialAim().lock'),null,'the existing pilot acquisition range remains distinct');
});

test('a manually selected small target remains tracked through refreshed hostile state, without automatic small-target acquisition',()=>{
 run('reset();var q=threat();trialGunTarget(q);var next={...q,pos:[15001,0,0]};trial.foeCraft=[next]');assert.equal(run('trialGunTarget(null)===next'),true);
 run('next.alive=false');assert.equal(run('trialGunTarget(null)'),null);
 run('reset();threat();threat("missile")');assert.equal(run('trialGunTarget(null)'),null,'an unselected nearby threat does not divert the battery');
 run('reset();var q=threat();trialGunTarget(q);trial.foeCraft=[]');assert.equal(run('trialGunTarget(null)'),null,'removed targets are not retained by their old object');
});

test('ordinary traversing guns neither fire nor consume charge when the player has not pulled the trigger',()=>{
 for(const key of ['single40','single6MT','quad500MT','cturret']){cx.key=key;run('reset(key);threat("craft",1000);threat("missile",1500);var before=trial.energy.E;trialGunnery(.01)');assert.equal(run('trial.turrets[0].pdCapable'),false,key);assert.equal(run('trial.gun.shots'),0,key);assert.equal(run('trial.gun.pd||0'),0,key);assert.equal(run('trial.energy.E'),run('before'),key);assert.equal(run('demands.at(-1)'),0,key);}
});

for(const kind of ['craft','missile'])test('a manually aimed capital cannon emits a paid physical shot and hits the distant '+kind,()=>{
 cx.kind=kind;run('reset();var q=threat(kind,15000),before=trial.energy.E,shot=trialShotEnergyTT(trial.turrets[0]);trial.fire=true;trialGunnery(.001)');
 assert.equal(run('trial.aim.lock===q'),true);assert.equal(run('trial.gun.shots'),run('C.FITS.single40.barrels'));assert.equal(run('trial.bolts.length'),1);assert.equal(run('trial.bolts[0].pd'),undefined);assert.equal(run('trial.bolts[0].pilot'),false);near(run('trial.bolts[0].tt'),run('shot'));near(run('before-trial.energy.E'),run('shot*trial.turrets[0].costK'));near(run('demands.at(-1)'),run('shot*C.TT/trial.turrets[0].cycle*trial.turrets[0].costK'),1e10);
 run('finishFlight()');assert.equal(run('q.alive'),false);assert.equal(run('q.downs'),1,'the existing live-target callback receives the hit');assert.equal(run('trial.gun.kills'),1);assert.equal(run('trial.gun.shots'),run('C.FITS.single40.barrels'),'tracking alone cannot emit another shot');
});

test('own gun reach and projectile lifetime still prevent a manually fired short-range gun from hitting a distant target',()=>{
 run('reset("single6MT");var q=threat("craft",15000);trial.fire=true;trialGunnery(.001)');assert.equal(run('trial.turrets[0].reach'),9000);assert.equal(run('trial.aim.lock'),null);assert.ok(run('trial.gun.shots')>0,'free aim still permits normal blind firing');run('finishFlight()');assert.equal(run('q.alive'),true);assert.equal(run('q.downs'),0);assert.equal(run('trial.bolts.length'),0);
});

test('manual fire retains electrical, thermal, stored-energy, line-of-fire and traverse gates',()=>{
 for(const block of ['trial.systemsUnit.p.grid={P:0}','trial.systemsUnit.ht={online:false}','trial.energy.E=0','trial.turrets[0].clear=false','trial.turrets[0].dead=true','trial.turrets[0].rateRad=0;view.cam.target=[1,0,1];q.pos=[10000,0,10000]','view.cam.target=[0,-1,0];q.pos=[0,-1000,0]']){
  cx.block=block;run('reset();var q=threat("craft",1000);trial.fire=true;'+block+';var before=trial.energy.E;trialGunnery(.01)');assert.equal(run('trial.gun.shots'),0,block);assert.equal(run('trial.bolts.length'),0,block);assert.equal(run('trial.energy.E'),run('before'),block);
 }
});

test('manual capital fire spends the actual local surface bank and cannot borrow unfunded or disconnected energy',()=>{
 for(const fraction of [0,.99,1]){cx.fraction=fraction;run('reset();threat("craft",1000);var shot=trialShotEnergyTT(trial.turrets[0]),cost=shot*trial.turrets[0].costK;trial.systemsUnit=chargedUnit("single40",cost*fraction);trial.fire=true;trialGunnery(.001)');assert.equal(run('trial.gun.shots'),fraction===1?1:0,'funded fraction '+fraction);near(run('trial.systemsUnit.surfaceBanks[2]'),fraction===1?0:run('cost*fraction'));}
 run('reset();threat("craft",1000);trial.systemsUnit=chargedUnit("single40",100);trial.systemsUnit.p.modules[1].powerConnected=false;trial.fire=true;trialGunnery(.001)');assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.systemsUnit.surfaceBanks[2]'),100);
});

test('dedicated point defence still fires autonomously while main batteries need an explicit trigger',()=>{
 run('reset("pd");var q=threat("missile",1000),before=trial.energy.E;trialGunnery(.001)');assert.equal(run('trial.turrets[0].pdCapable'),true);assert.equal(run('trial.turrets[0].pdTarget===q'),true);assert.ok(run('trial.gun.pd')>0);assert.equal(run('trial.gun.shots'),0);assert.ok(run('trial.energy.E<before'));assert.ok(run('trial.bolts.every(b=>b.pd)'));
});

test('ordinary ship hits retain their existing bolt versus ion damage route',()=>{
 for(const key of ['single40','ion']){cx.key=key;run('reset(key);var target={alive:true,ship:true,pos:[100,0,0],vel:[0,0,0],semi:[20,20,20],radius:20,rot:[1,0,0,0,1,0,0,0,1],unit:{id:"enemy"},hits:0};trial.targets=[target];trial.fire=true;trialGunnery(.001);trial.fire=false;Math.random=()=>.5;for(let i=0;i<10;i++)trialGunnery(.01)');assert.equal(run('shipHits.length'),1,key);assert.equal(run('shipHits[0][2]'),key==='ion'?'ion':'bolt');assert.ok(run('shipHits[0][1]')>0);}
});

// Execute the actual far-target builders. Rendering/model-loading helpers are idle;
// live squadron slots, fleet aircraft counts and missile packets remain authoritative.
run(`const R=Rts,VOY_NEAR=26000,VOY_BOLT={},ORD_FLY={};
const voyCraftRate=()=>1,voySelSq=()=>null,voyCraftModel=()=>null,voyCraftWant=()=>{},voyCraftDraw=()=>{},voyCraftFire=()=>{},voySqCamera=()=>{},craftFx=()=>{},craftFly=()=>({}),spaceAirType=()=> 'tie_ln';
const voySqView=(_cf,s)=>({pos:s.pos,h:s.h,vel:s.vel}),craftShip=u=>({c:u.pos,R:[1,0,0,0,1,0,0,0,1]});
function farRtsFixture(){
 reset();const me=chargedUnit('single40',120),enemy=chargedUnit('single40',120);Object.assign(me,{id:'own',sys:0,side:0,team:0,pos:[0,0,0],yaw:0});Object.assign(enemy,{id:'enemy',sys:0,side:1,team:1,pos:[30000,0,0],yaw:0});
 const squad={id:'enemy-squad',name:'Enemy squadron',side:1,craft:'tie_ln',wing:'enemy-wing',home:'enemy',sys:0,n:2,n0:2,state:'out',pos:[30000,0,0],h:[1,0,0],vel:[0,0,0],slots:[7,8]},wing={id:'enemy-wing',name:'Enemy wing',side:1,squads:[squad.id],phase:'on',order:{type:'standby'}},packet={id:'incoming-packet',sys:0,side:1,from:'enemy',target:'own',n:3,pos:[30000,0,0],vel:[0,0,0],life:45};
 const w={time:10,acc:0,seed:1,rand:()=>.25,events:[],sides:[{id:0},{id:1}],units:new Map([[me.id,me],[enemy.id,enemy]]),squads:new Map([[squad.id,squad]]),wings:new Map([[wing.id,wing]]),battles:new Map([[0,{log:[]}]]),missiles:[packet]};
 trial.battle={rts:true,me,O:[0,0,0],E:[1,0,0,0,1,0,0,0,1],modIndex:new Map([[2,1]])};trial.systemsUnit=null;trial.rts={w,sys:0};trial.energy={E:120,cap:120};trial.p=me.p;return {w,me,enemy,squad,packet};
}
function farLegacyFixture(){
 reset();const me=chargedUnit('single40',120),enemy=chargedUnit('single40',120);Object.assign(me,{id:'own',sys:0,side:0,team:0,pos:[0,0,0],yaw:0,air:0,lost:0,order:{type:'hold'}});Object.assign(enemy,{id:'enemy',sys:0,side:1,team:1,pos:[30000,0,0],yaw:0,air:2,lost:0,order:{type:'hold'}});
 trial.battle={me,O:[0,0,0],E:[1,0,0,0,1,0,0,0,1],modIndex:new Map([[2,1]]),b:C.fleetBattle([me,enemy],true)};trial.systemsUnit=null;trial.energy={E:120,cap:120};trial.p=me.p;return {me,enemy};
}
`);
for(const name of ['voyCf','voyPilotThreats','spaceAirStep'])run(fn(name));

test('a distant RTS squadron proxy takes one real craft casualty from a paid manual hit and retains only its remaining craft',()=>{
 run('var live=farRtsFixture();voyPilotThreats();var target=trial.foeCraft[0];view.cam.target=target.pos.slice();trial.foeMissiles=[];trial.fire=true;trialGunnery(.001)');assert.equal(run('target.far'),true);assert.ok(run('target.pos[0]')>26000);assert.equal(run('trial.aim.lock===target'),true);assert.equal(run('trial.gun.shots'),1);run('finishFlight(7)');assert.equal(run('live.squad.n'),1);assert.deepEqual(plain(run('live.squad.slots')),[8]);assert.equal(run('live.squad.lostN'),1);assert.equal(run('live.me.craftKills'),1);assert.equal(run('live.squad.downs[0].id'),7);
 run('voyPilotThreats()');assert.equal(run('live.squad.n'),1);assert.equal(run('trial.foeCraft[0].alive'),true,'the renewed lead represents the one surviving craft');assert.equal(run('trial.foeCraft[0].far'),true);assert.equal(run('live.squad.lostN'),1,'rendering another frame cannot restore or lose a craft');
});

test('a distant RTS missile proxy removes one actual missile from the packet and preserves the rest',()=>{
 run('var live=farRtsFixture();live.w.squads.clear();live.w.wings.clear();voyPilotThreats();var target=trial.foeMissiles[0];view.cam.target=target.pos.slice();trial.fire=true;trialGunnery(.001)');assert.equal(run('target.far'),true);assert.equal(run('trial.aim.lock===target'),true);assert.equal(run('trial.gun.shots'),1);run('finishFlight(7)');assert.equal(run('live.packet.n'),2);assert.equal(run('live.packet.downed'),1);
 run('voyPilotThreats()');assert.equal(run('live.packet.n'),2);assert.equal(run('trial.foeMissiles[0].alive'),true);assert.equal(run('live.packet.downed'),1);
});

test('the legacy fleet far aircraft proxy updates real aircraft and loss counts one craft at a time',()=>{
 run('var live=farLegacyFixture();spaceAirStep(0);var target=trial.foeCraft[0];view.cam.target=target.pos.slice();trial.fire=true;trialGunnery(.001)');assert.equal(run('target.far'),true);assert.equal(run('trial.aim.lock===target'),true);assert.equal(run('trial.gun.shots'),1);run('finishFlight(7)');assert.equal(run('live.enemy.air'),1);assert.equal(run('live.enemy.lost'),1);
 run('spaceAirStep(0)');assert.equal(run('live.enemy.air'),1);assert.equal(run('trial.foeCraft[0].alive'),true);assert.equal(run('trial.foeCraft[0].far'),true);assert.equal(run('live.enemy.lost'),1);
});

test('a coarse frame cannot extend a short-range bolt to a manually locked target supported by another gun',()=>{
 run(`reset('single6MT');const d=C.FITS.single40,unfunded=trialTurretState({id:3,k:'single40',origin:[0,0,0],fw:[1,0,0],axis:[0,1,0],cycle:d.cycle||1,power:d.power,barrels:d.barrels,rate:1000,r:2});unfunded.charge=0;trial.turrets.push(unfunded);var q=threat('craft',15000);trial.fire=true;trialGunnery(.001)`);
 assert.equal(run('trial.aim.lock===q'),true);assert.equal(run('trial.gun.shots'),run('C.FITS.single6MT.barrels'));assert.ok(run('trial.bolts.every(b=>b.life<3)'));
 run('trial.fire=false;Math.random=()=>0;trialGunnery(4)');assert.equal(run('q.alive'),true);assert.equal(run('q.downs'),0);assert.equal(run('trial.bolts.length'),0);
});
