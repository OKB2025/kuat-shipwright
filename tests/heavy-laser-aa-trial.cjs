const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}}),run=s=>vm.runInContext(s,cx),plain=x=>JSON.parse(JSON.stringify(x));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=run('Core'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,TT_J=C.TT,trial={};let aimPoint=[10000,0,0],downs=0;
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
for(const key of ['single6MT'])test(key+' keeps its 6 MT shot for manual fire and does not automatically intercept',()=>{
 const roles=plain(C.weaponRoles(C.FITS[key]));assert.equal(roles.pointDefense,false);assert.equal(roles.dualPurpose,false);assert.equal(roles.purePointDefense,false);
 for(const kind of ['missile','craft']){
  cx.key=key;cx.kind=kind;run('reset(key);trial.fire=false;threat(kind);var aaEnergyBefore=trial.energy.E;trialGunnery(.01)');
  assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.turrets[0].pd'),false);assert.equal(run('trial.turrets[0].pdTarget'),null);assert.equal(run('trial.gun.pd||0'),0);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.energy.E'),run('aaEnergyBefore'));
  run('trial.fire=true;trialGunnery(.01)');const t=plain(run('trial.turrets[0]')),shot=C.FITS[key].barrels*6e-6;
  assert.equal(run('trial.gun.shots'),C.FITS[key].barrels);assert.ok(Math.abs(run('trialShotEnergyTT(trial.turrets[0])')-shot)<1e-18);assert.ok(Math.abs(run('aaEnergyBefore-trial.energy.E')-shot*t.costK)<shot*1e-10);assert.ok(run('trial.bolts.every(b=>!b.pd&&Math.abs(b.tt-6e-6)<1e-18)'));
 }
});
test('the forward-fixed twin 6 MT laser cannot follow a fighter, so it stays a manual ship weapon',()=>{
 assert.equal(C.FITS.twin6MT.traverseDegS,0);assert.equal(C.FITS.twin6MT.aa,0);assert.equal(C.weaponRoles(C.FITS.twin6MT).dualPurpose,false);
 cx.key='twin6MT';run('reset(key);trial.fire=false;threat("craft");trialGunnery(.01)');assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.turrets[0].pdTarget'),null);
});
test('corvette light turbolasers preserve traverse and 500 MT barrels while requiring the manual trigger',()=>{
 for(const key of ['single500MT','twin500MT','quad500MT','sphyrnaTwin500MT']){
  cx.key=key;assert.ok(C.FITS[key].aa>0);assert.equal(C.weaponRoles(C.FITS[key]).dualPurpose,false);run('reset(key);trial.fire=false;threat("craft");trialGunnery(.01)');assert.equal(run('trial.turrets[0].pdCapable'),false);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);assert.equal(C.FITS[key].boltTT,.0005);
  run('trial.energy.E=trial.energy.cap=1;var manualEnergyBefore=trial.energy.E;trial.fire=true;trialGunnery(.01)');const shot=C.FITS[key].barrels*.0005,cost=shot*run('trial.turrets[0].costK');assert.equal(run('trial.gun.shots'),C.FITS[key].barrels);assert.ok(Math.abs(run('manualEnergyBefore-trial.energy.E')-cost)<cost*1e-10);assert.ok(run('trial.bolts.every(b=>!b.pd&&Math.abs(b.tt-.0005)<1e-18)'));
 }
});

test('dedicated twin and spherical PD packets retain 100 kt per physical barrel while intercepting',()=>{
 for(const key of ['pd','monCalPD']){cx.key=key;run('reset(key);trial.fire=false;threat("craft");trialGunnery(.01)');assert.equal(run('trial.gun.pd'),C.FITS[key].barrels);assert.equal(run('trial.bolts.length'),C.FITS[key].barrels);assert.ok(run('trial.bolts.every(b=>b.pd&&Math.abs(b.tt-1e-7)<1e-20)'));}
});
