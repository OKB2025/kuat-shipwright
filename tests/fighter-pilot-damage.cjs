const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){
 const context=vm.createContext({console,performance:{now:()=>0}}),run=s=>vm.runInContext(s,context);
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 run(`
 const C=Core,G=Gfx,TT_J=C.TT,trial={};let downs=0,randomValue=.5;
 Math.random=()=>randomValue;
 const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10},TRIAL_PILOT_HIT={radius:{craft:22,missile:12},pKill:{craft:.5,missile:.7},lock:40,range:10000};
 // 2026-11-19 fixture changed: trialGunnery now resolves the live unit with trialSystemsUnit() (js/app.js), which lies
 // outside the extracted sections; this stub resolves it as tests/dual-purpose-weapons.cjs does. No expectation changed.
 const trialSystemsUnit=()=>trial.battle?.me||trial.systemsUnit||null;
 const toast=()=>{},trialAim=()=>({point:[10000,0,0],lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialThreats=()=>[],trialPowerStep=()=>{},trialSalvoPlan=()=>null,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],sndAt=()=>{},sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'';
 const trialThreatDown=q=>{q.alive=false;downs++;};
 // 2026-11-24 gun rules: a craft laser fires once a second by default and its cadence is the fit's rateHz (was a 0.12-0.18 s
 // catalogue period, slowed in this fixture by overwriting the turret's cycle). The fixture now sets the fit's rateHz.
 function reset(key='claser',rateHz=null){
  Object.assign(trial,{systemsUnit:{p:{modules:[]}},on:true,craft:true,spectate:false,paused:false,p:{len:12},asset:{stats:{craftSystems:{v:1,managed:true,crew:1,suitSeats:0,lifeSupportHours:1,laserUnits:1,laserGasSeconds:100}},geometry:{center:[0,0,0],targetRadius:5,paint:'republic'}},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1e-5,cap:1e-5},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],rays:{busy:true,last:0}});
  const ship=C.newShip({L:12,W:8,H:4,assembly:true});ship.parts=[];ship.fits=[{id:1,k:key,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,...(rateHz?{rateHz}:{})}];
  const t=trialTurretState(G.fleetGeometry(ship,{trial:true}).turrets[0]);if(Math.abs(t.cycle-1/(rateHz||1))>1e-12)throw Error('cycle '+t.cycle+' is not 1/rateHz');t.clear=true;t.clearDir=t.fw.slice();t.charge=1;trial.turrets=[t];trialCraftSystemsReset();
 }
 function emitted(seconds){const seen=new Set(),out=[];for(let i=0;i<Math.round(seconds/.001);i++){trialGunnery(.001);for(const b of trial.bolts)if(!seen.has(b)){seen.add(b);out.push(b);}}return out;}
 function killsAt(b,p,kind='craft',k=1){downs=0;randomValue=p;trialPilotHit([0,0,0],[20,0,0],[{alive:true,kind,pos:[10,0,0],vel:[0,0,0]}],b.weight,k,b.hitScale);return downs>0;}
 function observedProbability(b,kind='craft'){let lo=0,hi=1;for(let i=0;i<30;i++){const m=(lo+hi)/2;if(killsAt(b,m,kind))lo=m;else hi=m;}return (lo+hi)/2;}
 `);
 function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
 section('const tv=','function trialProfile(');
 section('// Each gun keeps its range band:','// opts.design');
 section('const trialBarrel=','function trialAim(');
 section('function trialCraftSystemsSpec()','function trialReset()');
 section('function trialPilotHit(','function trialThreatDown(');
 section('function trialShotGeometry(','// Missiles leave');
 return run;
}
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);

test('actual catalogue pulses retain their per-shot fighter and missile hit probabilities at different cadences',()=>{
 const run=setup();
 // was: the default 0.12 / 0.18 s stream against a 0.5 / 0.7 s override. Now four shots a second (rateHz 4) against the default one a second.
 for(const [key,rate,seconds]of [['claser',4,6],['claserH',4,6.3]]){
  run(`reset('${key}',${rate});var fast=emitted(${seconds});var fastP=observedProbability(fast[0]),fastMissileP=observedProbability(fast[0],'missile')`);
  const count=run('fast.length');assert.ok(count>seconds*3,key+' should emit a stream');assert.ok(run(`fast.every(b=>b.hitScale===1&&Math.abs(b.tt-C.FITS['${key}'].boltTT)<1e-20)`),key+' pulses retain complete physical shot energy');
  run(`reset('${key}');var slow=emitted(${seconds});var slowP=observedProbability(slow[0]),slowMissileP=observedProbability(slow[0],'missile')`);assert.ok(run('slow.length')>=5&&run('slow.length')<=7,key+' fires once a second by default');assert.ok(run(`slow.every(b=>b.hitScale===1&&Math.abs(b.tt-C.FITS['${key}'].boltTT)<1e-20)`),key+' the shot is the same at either cadence');
  for(const suffix of ['P','MissileP']){near(run(`fast${suffix}`),run(`slow${suffix}`),1e-8);assert.ok(run(`fast.length*Math.log1p(-fast${suffix})<slow.length*Math.log1p(-slow${suffix})`),'more complete physical shots produce more chances to hit');}
 }
});

test('practice-target hit weight scales with the emitted pulse energy rather than the new bolt count',()=>{
 const run=setup();for(const [key,rate,seconds]of [['claser',4,6],['claserH',4,6.3]]){
  run(`reset('${key}',${rate});var fast=emitted(${seconds});var fastWeight=fast.reduce((n,b)=>n+b.weight,0);reset('${key}');var slow=emitted(${seconds});var slowWeight=slow.reduce((n,b)=>n+b.weight,0)`);
  near(run('fastWeight'),run('fast.length')*2);near(run('slowWeight'),run('slow.length')*2);near(run('fastWeight/slowWeight'),run('fast.length/slow.length'));assert.ok(run('fast.length>slow.length'));
 }
});

test('missile direct hits keep their existing guaranteed kill while laser misses still do no damage',()=>{
 const run=setup();run('reset();var pulse=emitted(1)[0]/* one shot a second: the first leaves within the first period */');
 assert.equal(run("killsAt(pulse,.999999,'craft',1.5)"),true);assert.equal(run("killsAt(pulse,.999999,'missile',1.5)"),true);
 run("downs=0;randomValue=0;trialPilotHit([0,100,0],[20,100,0],[{alive:true,kind:'craft',pos:[10,0,0],vel:[0,0,0]}],pulse.weight,1,pulse.hitScale)");assert.equal(run('downs'),0);
});
