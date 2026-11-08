const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const context=vm.createContext({console,performance:{now:()=>0}}),run=code=>vm.runInContext(code,context),plain=v=>JSON.parse(JSON.stringify(v));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,G=Gfx,TT_J=C.TT,trial={},notices=[],sounds=[],powerDemands=[];
Math.random=()=>.5;
let aimPoint=[10000,0,0],salvo=null;
const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
const toast=s=>notices.push(s),trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialPowerStep=(_dt,demand)=>powerDemands.push(demand),trialSalvoPlan=()=>salvo,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],sndAt=(...a)=>sounds.push(a),sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'';
function makeFit(k='claser',extra={}){return {id:1,k,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,...extra};}
function stateFromFit(f){
 const ship=C.newShip({L:12,W:8,H:4,assembly:true});ship.parts=[];ship.fits=[f];
 const t=G.fleetGeometry(ship,{trial:true}).turrets.find(t=>t.id===f.id);if(!t)throw Error('No trial weapon '+f.k);
 const s=trialTurretState(t);s.clear=true;s.clearDir=s.fw.slice();s.charge=1;return s;
}
function reset(k='claser',extra={}){
 notices.length=0;sounds.length=0;powerDemands.length=0;aimPoint=[10000,0,0];salvo=null;
 Object.assign(trial,{on:true,craft:true,spectate:false,paused:false,p:{len:12,energyModel:{version:1}},asset:{stats:{craftSystems:{v:1,managed:true,crew:1,suitSeats:0,lifeSupportHours:1,laserUnits:1,laserGasSeconds:100}},geometry:{center:[0,0,0],targetRadius:5,paint:'republic'}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1000,cap:1000},gun:{shots:0,hits:0,kills:0},bolts:[],emitted:[],seenBolts:new WeakSet(),missiles:[],fx:[],targets:[],rays:{busy:true,last:0}});
 trial.turrets=[stateFromFit(makeFit(k,extra))];trialCraftSystemsReset();
}
function advance(duration,dt=.001){for(let i=0;i<Math.round(duration/dt);i++){trialGunnery(dt);for(const b of trial.bolts)if(!trial.seenBolts.has(b)){trial.seenBolts.add(b);trial.emitted.push(b);}}}
`);
section('const tv=','function trialProfile(');
section('const TRIAL_PILOT_CYCLE=','// opts.design');
section('function authoredTurretPose(','function trialAim(');
section('const TRIAL_PD=','// Small craft and missiles a pilot');
section('function trialCraftSystemsSpec()','function trialReset()');
section('function trialShotGeometry(','// Missiles leave');
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`),vector=(a,b)=>a.forEach((x,i)=>near(x,b[i]));


section('function trialIntercept(','// The enemy a fixed battery');

run(`const trialThreatDown=q=>{q.alive=false;};function aaReset(){reset('cturret');trial.fire=true;trial.energy.E=4e-9*3;trial.asset.stats.craftSystems.laserUnits=2;trialCraftSystemsReset();trial.drones=[];trial.foeMissiles=[];trial.foeCraft=[{kind:'craft',pos:[1000,0,0],vel:[0,0,0],alive:true}];trial.turrets[0].reload=0;trial.systemsUnit=chargedUnit('cturret',trial.energy.E).u;trial.turrets[0].id=2;trial.systemsUnit.p.modules[1].fit=2;}`);
test('the rear twin aircraft turret stays idle without a trigger and manually fires two actual 2 kt muzzle packets with one power and gas debit',()=>{
 run('aaReset();trial.fire=false;var idleGas=trial.systemsRuntime.gasSeconds,idleEnergy=trial.energy.E;trialGunnery(.01)');
 assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.turrets[0].pd'),false);assert.equal(run('trial.turrets[0].pdTarget'),null);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);assert.equal(run('trial.energy.E'),run('idleEnergy'));assert.equal(run('trial.systemsRuntime.gasSeconds'),run('idleGas'));

 run('aaReset();var gasBefore=trial.systemsRuntime.gasSeconds,energyBefore=trial.energy.E,need=trialCraftGasNeed(trial.turrets[0]);trialGunnery(.01)');
 assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.turrets[0].pd'),false);assert.equal(run('trial.turrets[0].pdTarget'),null);assert.equal(run('trial.gun.shots'),2);assert.equal(run('trial.bolts.length'),2);
 for(const b of plain(run('trial.bolts'))){near(b.tt,2e-9,1e-20);assert.notEqual(b.pd,true);}
 const p=plain(run('trial.bolts.map(b=>b.prev)'));near(Math.abs(p[0][2]-p[1][2]),Cvalue('wm')*.28,1e-10);near(p[0][0],Cvalue('fm')*.68,1e-10);near(p[0][1],Cvalue('hm')*.55,1e-10);
 near(run('energyBefore-trial.energy.E'),4e-9,1e-16);near(run('gasBefore-trial.systemsRuntime.gasSeconds'),run('need'),1e-10);near(run('powerDemands.at(-1)'),4e-9*Number(run('C.TT'))/Number(run('C.FITS.cturret.cycle')),1);
 run('var remaining=trial.energy.E,gasRemaining=trial.systemsRuntime.gasSeconds;trialGunnery(.01)');assert.equal(run('trial.gun.shots'),2);assert.equal(run('trial.energy.E'),run('remaining'));assert.equal(run('trial.systemsRuntime.gasSeconds'),run('gasRemaining'));
});
function Cvalue(key){return Number(run('C.FITS.cturret.'+key));}
test('changing manual turret cadence changes requested power while every pulse keeps its 4 kt volley and gas cost',()=>{
 for(const cycle of [.06,.24]){context.cycle=cycle;run('aaReset();trial.turrets[0].cycle=cycle;var before=trial.energy.E,gasBefore=trial.systemsRuntime.gasSeconds,need=trialCraftGasNeed(trial.turrets[0]);trialGunnery(.01)');near(run('before-trial.energy.E'),4e-9,1e-16);near(run('gasBefore-trial.systemsRuntime.gasSeconds'),run('need'),1e-10);near(run('powerDemands.at(-1)'),4e-9*Number(run('C.TT'))/cycle,1);assert.equal(run('trial.bolts.length'),2);}
});
test('zero and partial electricity or gas cannot fund a manually triggered twin pulse; exact budgets fund only one',()=>{
 for(const resource of ['electricity','gas'])for(const fraction of [0,.99,1]){context.resource=resource;context.fraction=fraction;run('aaReset();var need=trialCraftGasNeed(trial.turrets[0]);if(resource==="electricity"){trial.energy.E=4e-9*fraction;trial.systemsUnit.energy=trial.energy.E;trial.systemsUnit.surfaceBanks[2]=trial.energy.E;}else trial.systemsRuntime.gasSeconds=need*fraction;var before=trial.energy.E,gasBefore=trial.systemsRuntime.gasSeconds;trialGunnery(.01)');assert.equal(run('trial.gun.shots||0'),fraction===1?2:0,resource+' '+fraction);if(fraction<1){assert.equal(run('trial.energy.E'),run('before'));assert.equal(run('trial.systemsRuntime.gasSeconds'),run('gasBefore'));}else{run('trial.turrets[0].reload=0;trialGunnery(.01)');assert.equal(run('trial.gun.shots'),2,'one exact budget cannot fund another pulse');}}
});

run("function chargedUnit(k,energy){\n const d=C.FITS[k],output=d.barrels*d.boltTT,power=d.power,p={hp:1e6,len:20,width:10,height:10,D:0,shieldBuffer:0,reserve:0,wCap:output*3,crewNeed:0,crewMax:0,accel:0,maxSpeed:0,turnRate:0,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules:[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},{k:'weapon',part:2,port:'p2',domain:'main',share:1,size:1,powerConnected:true}],grid:{P:power*2,Pgen:power*2,fixed:0,cooling:0,De:0,Ds:0,Dw:power,powerPaths:[{from:'p1',to:'p2',cap:power,ok:true}],domains:[{id:'main',P:power*2,sources:[{moduleIndex:0,P:power*2}],modules:[0,1]}]},surface:{mounts:[{id:2,module:1,power,capacity:output*3,gun:output/d.cycle,ion:0,boltTT:d.boltTT,volleyTT:output,barrels:d.barrels,cycle:d.cycle,band:'close',arcs:Array(6).fill(1),muzzle:[0,0,0]}],patches:[],devices:[]}};\n const u=C.fleetUnit('tiny-shot','tiny-shot',p);C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:power,shields:0},0,'balanced');u.surfaceBanks={2:energy};u.energy=energy;return {u,output};\n}\n");
test('a funded shared bank cannot lend an empty or partial aircraft surface cell a free manually triggered shot',()=>{
 for(const fraction of [0,.99,1]){context.fraction=fraction;run('aaReset();var funded=chargedUnit("cturret",4e-9*fraction);trial.systemsUnit=funded.u;trial.turrets[0].id=2;trial.systemsUnit.p.modules[1].fit=2;var cellBefore=trial.systemsUnit.energy;trialGunnery(.01)');assert.equal(run('trial.gun.shots||0'),fraction===1?2:0,'cell fraction '+fraction);if(fraction<1)assert.equal(run('trial.systemsUnit.energy'),run('cellBefore'));else near(run('trial.systemsUnit.energy'),0,1e-20);}
});
