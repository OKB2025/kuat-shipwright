const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}}),run=s=>vm.runInContext(s,cx),plain=x=>JSON.parse(JSON.stringify(x));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=run('Core'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,TT_J=C.TT,trial={};let aimPoint=[10000,0,0],downs=0;
// The isolated gunnery harness resolves the same live unit as the app.
const trialSystemsUnit=()=>trial.battle?.me||trial.systemsUnit||null;
Math.random=()=>.1;
const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
const trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialPowerStep=()=>{},trialSalvoPlan=()=>null,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],trialCraftGasReady=()=>true,trialCraftGasTake=()=>true,sndAt=()=>{},sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'',trialThreatDown=q=>{q.alive=false;downs++;};
function reset(key='pd'){
 Object.assign(trial,{craft:false,systemsUnit:{p:{modules:[]}},p:{len:100},asset:{geometry:{center:[0,0,0],targetRadius:5}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:.001,cap:.001},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],drones:[],foeCraft:[],foeMissiles:[],rays:{busy:true,last:0}});
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


// Traverse ratings remain available for aimed fire, but only designated PD fires autonomously.
// 2026-11-24 gun rules: these guns are lasers and a laser's shot is its bore's: 20 + 780 x (bore^2 - 0.01) / 0.15 kt (C.laserShotKt). Was 6 MT,
// 500 MT and 100 kt a barrel by the table.
const laserBolt=key=>{const r=C.FITS[key].gunRule;assert.equal(r.kind,'laser',key);const kt=r.perBarrel.map(b=>{assert.ok(Math.abs(b.kt-C.laserShotKt(b.bore))<=1e-9*b.kt,key);return b.kt;});const mean=kt.reduce((a,b)=>a+b,0)/kt.length;assert.ok(kt.every(v=>Math.abs(v-mean)<=1e-4*mean),key+' barrels alike (the measured bores of one mount differ in the sixth figure)');assert.ok(Math.abs(C.FITS[key].boltTT-mean/C.KT_PER_TT)<=1e-12*C.FITS[key].boltTT,key);return C.FITS[key].boltTT;};
for(const key of ['single6MT'])test(key+' fires the laser shot of its bore (117 kt) on the manual trigger and does not automatically intercept',()=>{
 const roles=plain(C.weaponRoles(C.FITS[key]));assert.equal(roles.pointDefense,false);assert.equal(roles.dualPurpose,false);assert.equal(roles.purePointDefense,false);
 for(const kind of ['missile','craft']){
  cx.key=key;cx.kind=kind;run('reset(key);trial.fire=false;threat(kind);var aaEnergyBefore=trial.energy.E;trialGunnery(.01)');
  assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.turrets[0].pd'),false);assert.equal(run('trial.turrets[0].pdTarget'),null);assert.equal(run('trial.gun.pd||0'),0);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.energy.E'),run('aaEnergyBefore'));
  run('trial.fire=true;trialGunnery(.01)');const t=plain(run('trial.turrets[0]')),bolt=laserBolt(key),shot=C.FITS[key].barrels*bolt;assert.equal(Math.round(bolt*C.KT_PER_TT),117);cx.bolt=bolt;
  assert.equal(run('trial.gun.shots'),C.FITS[key].barrels);assert.ok(Math.abs(run('trialShotEnergyTT(trial.turrets[0])')-shot)<1e-18);assert.ok(Math.abs(run('aaEnergyBefore-trial.energy.E')-shot*t.costK)<shot*1e-10);assert.ok(run('trial.bolts.every(b=>!b.pd&&Math.abs(b.tt-bolt)<1e-18)'));
 }
});
test('the forward-fixed twin 6 MT laser cannot follow a fighter, so it stays a manual ship weapon',()=>{
 assert.equal(C.FITS.twin6MT.traverseDegS,0);assert.equal(C.FITS.twin6MT.aa,0);assert.equal(C.weaponRoles(C.FITS.twin6MT).dualPurpose,false);
 cx.key='twin6MT';run('reset(key);trial.fire=false;threat("craft");trialGunnery(.01)');assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.turrets[0].pdTarget'),null);
});
// 2026-11-15, user decision「連射は全門含め1発ずつ射撃する形に(各門ではなく)」: in rapid fire a mount fires one barrel a
// shot (its energy the volley's over the barrels, the next cycle ÷ barrels later). These cases stated every barrel in
// one shot; each barrel's packet (500 MT, 100 kt) is unchanged.
test('the corvette guns once rated 500 MT preserve traverse, fire the laser shot of their bores and require the manual trigger',()=>{
 for(const key of ['single500MT','twin500MT','quad500MT','sphyrnaTwin500MT']){
  cx.key=key;assert.ok(C.FITS[key].aa>0);assert.equal(C.weaponRoles(C.FITS[key]).dualPurpose,false);run('reset(key);trial.fire=false;threat("craft");trialGunnery(.01)');assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);const shot=laserBolt(key);cx.bolt=shot;assert.equal(Math.round(shot*C.KT_PER_TT),{single500MT:613,twin500MT:285,quad500MT:279,sphyrnaTwin500MT:261}[key],key);
  /* the store is 1e-5 TT (was 1 TT): a 0.3-0.6 MT shot taken from 1 TT is lost in the rounding of the difference (1e-16 against the unchanged 1e-10 relative tolerance) */run('trial.energy.E=trial.energy.cap=1e-5;var manualEnergyBefore=trial.energy.E;trial.fire=true;trialGunnery(.01)');const cost=shot*run('trial.turrets[0].costK');assert.equal(run('trial.gun.shots'),1,'one barrel a shot');assert.ok(Math.abs(run('manualEnergyBefore-trial.energy.E')-cost)<cost*1e-10);assert.ok(run('trial.bolts.every(b=>!b.pd&&Math.abs(b.tt-bolt)<1e-18)'));
 }
});

test('dedicated twin and spherical PD packets carry the laser shot of their bores (800 kt, 133 kt) per physical barrel while intercepting',()=>{
 for(const key of ['pd','monCalPD']){cx.key=key;run('reset(key);trial.fire=false;threat("craft");trialGunnery(.01)');assert.equal(run('trial.gun.pd'),1,'one barrel a shot');assert.equal(run('trial.bolts.length'),1);cx.bolt=laserBolt(key);assert.equal(Math.round(cx.bolt*C.KT_PER_TT),{pd:800,monCalPD:133}[key],key);assert.ok(run('trial.bolts.every(b=>b.pd&&Math.abs(b.tt-bolt)<1e-20)'));}
});
