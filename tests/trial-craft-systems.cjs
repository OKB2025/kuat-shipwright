const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),c=vm.createContext({console,performance:{now:()=>0}}),run=code=>vm.runInContext(code,c),plain=code=>JSON.parse(JSON.stringify(run(code)));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,TT_J=C.TT,notices=[],undoStack=[];let autosaves=0,salvo=null,ship;
const trial={},toast=text=>notices.push(text),autosave=()=>autosaves++;
const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
const trialAim=()=>({point:[10000,0,0],lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialThreats=()=>[],trialLimits=()=>({lo:-Math.PI/2,hi:Math.PI/2,yaw:Math.PI}),trialBarrel=t=>t.fw.slice(),trialPowerStep=()=>{},trialSalvoPlan=()=>salvo,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],sndAt=()=>{},sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'';
function makeTurret(k='claser'){
 const d=C.FITS[k];return {k,power:d.power,cycle:.5,charge:1,barrels:1,rateRad:1,r:1,yaw:0,el:0,origin:[0,0,0],axis:[0,1,0],fw:[1,0,0],e2:[0,0,1],clear:true,clearDir:[1,0,0],reload:0,ion:k==='cion',pilot:!!d.craft};
}
function reset(overrides={}){
 notices.length=0;undoStack.length=0;autosaves=0;salvo=null;
 const spec={v:1,managed:true,crew:1,suitSeats:0,lifeSupportHours:1,laserUnits:2,laserGasSeconds:1,...overrides};
 ship=C.newShip({L:20,W:10,H:5});ship.parts.push({id:1,k:'laserGas',c:[0,0,0],d:1});
 Object.assign(trial,{on:true,craft:true,spectate:false,paused:false,p:{len:20},asset:{stats:{craftSystems:spec},geometry:{center:[0,0,0],targetRadius:5,paint:'republic'}},turrets:[makeTurret()],P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'home',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1e20,cap:1e20},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],rays:{busy:true,last:0}});
 trialCraftSystemsReset();
}
function fire(){for(const t of trial.turrets)t.reload=0;trialGunnery(.1);}
`);
section('const tv=', 'function trialRot(');
section('const trialCol=', 'const trialWrap=');
run(app.match(/const trialWrap=.*?;/)[0]);
section('function trialCraftSystemsSpec()', 'function trialReset()');
section('function trialGunnery(dt)', '// Missiles leave');
section('function trialDurText(', 'function trialHyperUpdate(');
section('function trialRateBase(', 'function trialMaxRates(');
run('reset();');
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('only actual qualifying laser shots consume their weighted reload-cycle share of gas',()=>{
 run('reset();');const gas=run('trial.systemsRuntime.gasSeconds');
 run('trial.turrets[0].clear=false;fire();');assert.equal(run('trial.systemsRuntime.gasSeconds'),gas);assert.equal(run('trial.gun.shots'),0);
 run('trial.turrets[0].clear=true;trial.energy.E=0;fire();');assert.equal(run('trial.systemsRuntime.gasSeconds'),gas);assert.equal(run('trial.gun.shots'),0);
 run('trial.energy.E=1e20;salvo=new Set();fire();');assert.equal(run('trial.systemsRuntime.gasSeconds'),gas);
 run('salvo=null;trial.turrets[0].reload=10;trialGunnery(.1);');assert.equal(run('trial.systemsRuntime.gasSeconds'),gas);
 run('fire();');near(run('trial.systemsRuntime.gasSeconds'),.75);assert.equal(run('trial.gun.shots'),1);
 run('trial.turrets[0].power=C.FITS.claser.power*2;fire();');near(run('trial.systemsRuntime.gasSeconds'),.25);
 run('reset({laserGasSeconds:.1});fire();');assert.equal(run('trial.systemsRuntime.gasSeconds'),0);assert.equal(run('trial.gun.shots'),1);run('fire();');assert.equal(run('trial.gun.shots'),1);
});

test('empty gas blocks craft lasers until reset while ion and ship batteries retain fire',()=>{
 run('reset();for(let i=0;i<4;i++)fire();');assert.equal(run('trial.systemsRuntime.gasSeconds'),0);assert.equal(run('trial.gun.shots'),4);
 run('trialCraftSystemsStep(100);fire();fire();');assert.equal(run('trial.systemsRuntime.gasSeconds'),0);assert.equal(run('trial.gun.shots'),4);
 assert.equal(run('notices.filter(s=>s.includes("レーザーガス")).length'),1);
 run('trial.turrets=[makeTurret("cion"),makeTurret("htl")];fire();');assert.equal(run('trial.gun.shots'),6);assert.equal(run('trial.systemsRuntime.gasSeconds'),0);
 run('trial.turrets=[makeTurret()];trialCraftSystemsReset();fire();');assert.equal(run('trial.gun.shots'),7);near(run('trial.systemsRuntime.gasSeconds'),.75);
});

test('zero-time frames cannot fire, consume life support, or spend gas',()=>{
 run('reset();');const runtime=plain('trial.systemsRuntime'),energy=run('trial.energy.E');
 run('trialCraftSystemsStep(0);trialCraftSystemsStep(-1);trialCraftSystemsStep(NaN);trialGunnery(0);trialGunnery(-1);');
 assert.deepEqual(plain('trial.systemsRuntime'),runtime);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.energy.E'),energy);assert.equal(run('notices.length'),0);
 assert.equal(run('trialCraftGasTake(trial.turrets[0],0)'),false);assert.deepEqual(plain('trial.systemsRuntime'),runtime);
});

test('life-support exhaustion stays exhausted and warns once until a fresh sortie refills it',()=>{
 run('reset({lifeSupportHours:1/3600});trialCraftSystemsStep(.4);');near(run('trial.systemsRuntime.lifeSeconds'),.6);
 run('trialCraftSystemsStep(.6);');assert.equal(run('trial.systemsRuntime.lifeSeconds'),0);assert.match(run('trialCraftSystemsWarning()'),/残時間なし/);
 run('trialCraftSystemsStep(100);trialCraftSystemsStep(100);');assert.equal(run('trial.systemsRuntime.lifeSeconds'),0);assert.equal(run('notices.filter(s=>s.includes("なくなりました")).length'),1);
 run('trialCraftSystemsReset();');assert.equal(run('trial.systemsRuntime.lifeSeconds'),1);assert.equal(run('trial.systemsRuntime.gasSeconds'),1);assert.equal(run('trialCraftSystemsWarning()'),'');
});

test('legacy, suit-supported, unmanned, and capital designs keep distinct endurance semantics',()=>{
 run('reset({managed:false,lifeSupportHours:0,laserGasSeconds:0});');assert.equal(run('trial.systemsRuntime'),null);run('fire();trialCraftSystemsStep(10000);');assert.equal(run('trial.gun.shots'),1);assert.equal(run('notices.length'),0);
 run('reset({crew:1,suitSeats:1,lifeSupportHours:4});trialCraftSystemsStep(1);');assert.equal(run('trial.systemsRuntime.lifeSeconds'),14399);assert.match(run('trialCraftSystemsHTML()'),/宇宙服の酸素/);
 run('reset({crew:0,suitSeats:0,lifeSupportHours:null});trialCraftSystemsStep(10000);');assert.equal(run('trial.systemsRuntime.lifeSeconds'),null);assert.doesNotMatch(run('trialCraftSystemsHTML()'),/生命維持|宇宙服/);
 run('reset({crew:1,suitSeats:0,lifeSupportHours:0});trialCraftSystemsStep(1);');assert.equal(run('trial.systemsRuntime.lifeSeconds'),0);assert.match(run('trialCraftSystemsWarning()'),/帰還/);
 run('reset();trial.craft=false;trialCraftSystemsReset();');assert.equal(run('trial.systemsRuntime'),null);assert.equal(run('trialCraftSystemsHTML()'),'');
});

test('runtime use and refill never alter design, published systems metadata, undo, or autosave',()=>{
 run('reset({lifeSupportHours:1/3600});');const design=run('C.publicJSON(ship)'),spec=run('JSON.stringify(trial.asset.stats.craftSystems)');
 run('fire();trialCraftSystemsStep(2);trialCraftSystemsReset();fire();');
 assert.equal(run('C.publicJSON(ship)'),design);assert.equal(run('JSON.stringify(trial.asset.stats.craftSystems)'),spec);assert.equal(run('undoStack.length'),0);assert.equal(run('autosaves'),0);
 run('trial.spectate=true;');const before=plain('trial.systemsRuntime');run('trialCraftSystemsStep(100);');assert.deepEqual(plain('trial.systemsRuntime'),before);assert.equal(run('trialCraftSystemsHTML()'),'');
});

test('RCS support scales manual craft pitch, yaw, and roll once after handling floors and caps',()=>{
 for(const accel of [0,1e8]){
  c.accel=accel;const base=plain('trialRateBase({len:12,accel,turnRate:.1},true)');
  c.turnK=.2;const supported=plain('trialRateBase({len:12,accel,turnRate:.1*turnK,systems:{managed:true,turnK}},true)');
  for(const axis of ['pitch','yaw','roll'])near(supported[axis],base[axis]*.2);
  near(supported.tau,base.tau);
 }
 const ship=plain('trialRateBase({len:1000,accel:0,turnRate:.04,systems:{managed:true,turnK:.2}},false)');
 near(ship.yaw,.04);near(ship.roll,.04*2.2);near(ship.pitch,.04*.75);
 const legacy=plain('trialRateBase({len:12,accel:0,turnRate:.1,systems:{managed:false,turnK:.2}},true)'),unmanaged=plain('trialRateBase({len:12,accel:0,turnRate:.1},true)');
 assert.deepEqual(legacy,unmanaged);
 const zero=plain('trialRateBase({len:12,accel:0,turnRate:0,systems:{managed:true,turnK:0}},true)');
 assert.equal(zero.roll,0);assert.equal(zero.yaw,0);assert.equal(zero.pitch,0);assert.ok(Number.isFinite(zero.tau));
});
