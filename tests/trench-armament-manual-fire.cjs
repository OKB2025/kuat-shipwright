const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),cx=vm.createContext({console,performance:{now:()=>0}}),run=s=>vm.runInContext(s,cx),plain=x=>JSON.parse(JSON.stringify(x));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
 const C=Core,TT_J=C.TT,trial={};let aimPoint=[10000,0,0],downs=0;
 Math.random=()=>.1;
 const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
 const trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialPowerStep=()=>{},trialSalvoPlan=()=>null,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],trialCraftGasReady=()=>true,trialCraftGasTake=()=>true,sndAt=()=>{},sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'',trialThreatDown=q=>{q.alive=false;downs++;};
 function reset(kind='pd',count=100,charge=1){
  const s=C.newShip({L:8000,W:2000,H:1000,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Manual counted trench');s.parts=[];s.fits=[];s.hatches=[];s.detail=0;s.armor={hull:0,cit:0};
  const result=C.configureTrenchArmament(s,{hostId:'hull',newTrench:{mode:'split',from:.2,to:.8,level:.5,height:400,depth:100,side:'both',taper:false},counts:[{kind,count:count*2}]});if(!result.ok)throw Error(result.error);
  const sourceVolleyTT=C.weaponChargeSpec(s.fits[0]).volleyTT,geometry=Gfx.fleetGeometry(s,{trial:true});
  Object.assign(trial,{sourceVolleyTT,craft:false,systemsUnit:{p:{modules:[]}},p:{len:8000},asset:{geometry},P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],gunMode:'free',fire:true,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1e9,cap:1e9},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],drones:[],foeCraft:[],foeMissiles:[],rays:{busy:true,last:0}});
  const t=trialTurretState(geometry.turrets[0]);t.clear=true;t.clearDir=t.fw.slice();t.charge=charge;t.rateRad=1000;trial.turrets=[t];downs=0;aimPoint=tv.add(tv.sub(t.origin,geometry.center),t.fw,1000);return t;
 }
 function threat(kind='missile'){const q={kind,pos:aimPoint.slice(),vel:[0,0,0],alive:true};trial[kind==='missile'?'foeMissiles':'foeCraft'].push(q);return q;}
`);
section('const tv=','function trialProfile(');section('const TRIAL_PILOT_CYCLE=','// opts.design');section('const trialBarrel=','function trialAim(');section('function trialIntercept(','// The enemy a fixed battery');section('const TRIAL_PD=','// Small craft and missiles a pilot');section('function trialShotGeometry(','// Missiles leave');

test('real group descriptors fire at most eight manual packets while accounting for every actual barrel and one charged volley',()=>{
 const observed=[];
 for(const count of [100,10000]){cx.count=count;run('reset("monCal34",count,.25);var before=trial.energy.E;trialGunnery(.01)');const t=plain(run('trial.turrets[0]')),bolts=plain(run('trial.bolts')),shot=run('trialShotEnergyTT(trial.turrets[0])');assert.ok(bolts.length>0&&bolts.length<=8);assert.equal(run('trial.gun.shots'),count);assert.equal(bolts.reduce((n,b)=>n+b.weight,0),count);assert.ok(Math.abs(bolts.reduce((n,b)=>n+b.tt,0)-shot)<shot*1e-12);assert.ok(Math.abs(run('before-trial.energy.E')-shot*t.costK)<1e-6);assert.ok(bolts.every(b=>!b.pd));assert.ok(Math.abs(shot-run('trial.sourceVolleyTT*.25'))<shot*1e-12);observed.push({packets:bolts.length,shot,barrels:t.aggregateBarrels,weight:bolts.reduce((n,b)=>n+b.weight,0)});}
 assert.equal(observed[0].packets,observed[1].packets);assert.equal(observed[1].barrels,observed[0].barrels*100);assert.equal(observed[1].weight,observed[0].weight*100);assert.ok(Math.abs(observed[1].shot/observed[0].shot-100)<1e-12);
});

test('counted manual PD consumes TT once and combines charge-scaled independent shots in each bounded packet',()=>{
 const observed=[];
 for(const count of [100,10000]){cx.count=count;run('reset("pd",count,.1);trial.fire=false;threat("craft");var before=trial.energy.E;trialGunnery(.01)');const t=plain(run('trial.turrets[0]')),bolts=plain(run('trial.bolts')),shot=run('trialShotEnergyTT(trial.turrets[0])');assert.equal(t.pd,true);assert.ok(bolts.length>0&&bolts.length<=8);assert.equal(run('trial.gun.pd'),count*2);assert.equal(run('trial.gun.shots'),0);assert.ok(Math.abs(bolts.reduce((n,b)=>n+b.tt,0)-shot)<shot*1e-12);assert.ok(Math.abs(run('before-trial.energy.E')-shot*t.costK)<1e-6);assert.ok(bolts.every(b=>b.pd&&Math.abs(b.shotMultiplicity-count*2*.1/bolts.length)<1e-12));assert.ok(Math.abs(shot-run('trial.sourceVolleyTT*.1'))<shot*1e-12);observed.push({packets:bolts.length,multiplicity:bolts[0].shotMultiplicity});}
 assert.equal(observed[0].packets,observed[1].packets);assert.equal(observed[1].multiplicity,observed[0].multiplicity*100);
});

test('manual group PD count changes interception probability without expanding into per-gun projectiles',()=>{
 const result=[];
 for(const count of [100,10000]){cx.count=count;run('reset("pd",count,.1);trial.fire=false;var q=threat("craft");trialGunnery(.01);var b=trial.bolts[0];b.prev=tv.add(q.pos,[-1,0,0]);b.pos=tv.add(q.pos,[1,0,0]);Math.random=()=>.9;trialPdBoltHit(b);Math.random=()=>.1');result.push({alive:run('q.alive'),packets:run('trial.bolts.length')});}
 assert.equal(result[0].alive,true);assert.equal(result[1].alive,false);assert.equal(result[0].packets,result[1].packets);
});

test('normal PD retains its existing one-shot probability and missing multiplicity defaults to one',()=>{
 for(const [threshold,down]of [[.29,true],[.31,false]]){cx.threshold=threshold;run('reset("pd",100);var q=threat("craft"),b={target:q,prev:tv.add(q.pos,[-1,0,0]),pos:tv.add(q.pos,[1,0,0]),life:1};Math.random=()=>threshold;trialPdBoltHit(b);Math.random=()=>.1');assert.equal(run('q.alive'),!down);}
 run('reset("pd",100);var q=threat("craft"),b={target:q,prev:tv.add(q.pos,[-1,0,0]),pos:tv.add(q.pos,[1,0,0]),life:1,shotMultiplicity:0};trialPdBoltHit(b)');assert.equal(run('q.alive'),true);
});
