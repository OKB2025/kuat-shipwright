const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(process.env.KS_TRIAL_APP_SOURCE||path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console,performance:{now:()=>0}}),run=code=>vm.runInContext(code,cx),plain=v=>JSON.parse(JSON.stringify(v));
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`const C=Core,G=Gfx,TT_J=C.TT,trial={};Math.random=()=>.5;
 let aimPoint=[10000,0,0],threat=null,deployments={};
 const TRIAL_GUN={boltSpeed:4500,range:40000,maxBolts:2400,hitsToKill:10};
 const toast=()=>{},trialAim=()=>({point:aimPoint,lock:null}),trialDronesStep=()=>{},trialGunTarget=()=>null,trialThreats=()=>threat?[threat]:[],trialPdPick=()=>threat,trialPowerStep=()=>{},trialSalvoPlan=()=>null,trialMissiles=()=>{},escortsFire=()=>{},trialPilotThreats=()=>[],trialCraftGasReady=()=>true,trialCraftGasTake=()=>true,sndAt=()=>{},sndGun=()=>'',sndFac=()=>'',sndPilotGun=()=>'',trialFoilDeployments=()=>deployments;
`);
section('const tv=','function trialProfile(');
section('const TRIAL_PILOT_CYCLE=','// opts.design');
for(const line of app.split('\n'))if(line.startsWith('const spaceAtt=new WeakMap(),m3Mul='))run(line);
section('function authoredTurretPose(','function trialAim(');
section('function trialFoilBase(','// These consumables');
section('function trialIntercept(','// The enemy a fixed battery');
for(const line of app.split('\n'))if(line.startsWith('const TRIAL_PD=')||line.startsWith('const trialPdColor='))run(line);
section('function trialPdBoltHit(','// Small craft and missiles a pilot');
section('function trialShotGeometry(','// Missiles leave');
run(`function setup(k='ball720',frame={a:2},pitch=42,foil=false,pd=false,yaw=.2,elevation=3*Math.PI/180){
 if(frame.tilt)frame={...frame,tilt:C.norm(frame.tilt)};
 const f={id:7,k,p:[100,40,15],a:2,assetYaw:31,assetPitch:pitch,float:false,...frame},ship=C.newShip({assembly:true,L:200,W:200,H:100},'Actual ball trial aiming');ship.parts=[];ship.fits=[f];ship.detail=0;
 const geometry=G.fleetGeometry(ship,{trial:true}),raw=geometry.turrets.find(t=>t.id===f.id);if(!raw?.authored)throw Error('No physical authored gun');
 Object.assign(trial,{craft:false,p:{len:200},asset:{geometry},P:[1000,2000,-3000],V:[0,0,0],R:[0,0,1,0,1,0,-1,0,0],gunMode:'free',fire:false,fireKey:false,fireTap:0,jump:null,battle:null,energy:{E:1e8,cap:1e8},gun:{shots:0,hits:0,kills:0},bolts:[],missiles:[],fx:[],targets:[],rays:{busy:true,last:0}});
 const t=trialTurretState(raw);t.rateRad=1e6;t.charge=1;trial.turrets=[t];threat=null;deployments={};
 if(foil){const wing={id:'pitch-wing',pivot:[30,12,5],axis:'x',open:0,stow:65,sg:1};geometry.foils=[wing];t.foilId=wing.id;deployments[wing.id]=.4;trialPoseFoilMounts();}
 const native=C.aimAuthoredTurret(raw.authored,yaw,elevation),desired=t._foilTransform?t._foilTransform.direction(native.fw):native.fw;
 const origin=trialApply(trial.R,tv.sub(t.origin,geometry.center));aimPoint=tv.add(origin,trialApply(trial.R,desired),100000);t.clear=true;t.clearDir=desired.slice();
 if(pd){t.pdCapable=true;t.dualPurpose=false;threat={kind:'missile',pos:tv.add(trial.P,aimPoint),vel:[0,0,0],alive:true};}
 return {fit:f,t,raw,geometry,desired,native};
}
`);
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((v,i)=>near(v,b[i],e));

test('the actual trial targeting loop subtracts placed ball pitch and aims physical barrels at the reticle on every mounting axis',()=>{
 const frames=[...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:[.2,.93,.3]}];
 for(const frame of frames){cx.frame=frame;run('globalThis.q=setup("ball720",frame);trialGunnery(.01)');
  const q=run('q'),t=plain(q.t);near(t.el,3*Math.PI/180);near(t.yaw,.2);vector(t.bd,q.desired,1e-6);assert.equal(t.aimed,true);assert.equal(t.laid,true);vector(t.authoredPose.fw,q.desired,1e-6);
 }
 for(const k of ['quad40Ion','single500','ball175TripleIon','ball175Quad','ball175QuadIon','ball720']){cx.kind=k;run('globalThis.q=setup(kind);trialGunnery(.01)');vector(plain(run('q.t.bd')),plain(run('q.desired')),1e-6);}
});

test('real trial aim and projectile mouths use the inverse S-foil frame without applying placement pitch twice',()=>{
 run('globalThis.q=setup("ball175Quad",{a:2},42,true);trial.fire=true;trialGunnery(.001)');
 const q=run('q'),t=plain(q.t),bolts=plain(run('trial.bolts'));near(t.el,3*Math.PI/180);near(t.yaw,.2);vector(t.bd,q.desired,1e-6);assert.equal(bolts.length,4);assert.equal(run('trial.gun.shots'),4);
 const physical=run('authoredTurretPose(q.raw.authored,q.t.yaw,q.t.el,q.t._foilTransform)');physical.muzzles.forEach((mouth,i)=>{const expected=run(`tv.add(trial.P,trialApply(trial.R,tv.sub(authoredTurretPose(q.raw.authored,q.t.yaw,q.t.el,q.t._foilTransform).muzzles[${i}],q.geometry.center)))`);vector(bolts[i].prev,expected,1e-6);});
 const direction=plain(run('trialApply(trial.R,q.desired)'));for(const b of bolts)vector(run('tv.norm('+JSON.stringify(b.vel)+')'),direction,1e-6);
 near(bolts.reduce((n,b)=>n+b.tt,0),700,1e-6);
});

test('trial PD targeting shares authored inversion and keeps all placed-ball muzzles aligned through a foil',()=>{
 run('globalThis.q=setup("ball175Quad",{a:2},42,true,true);trialGunnery(.001)');
 near(run('q.t.el'),3*Math.PI/180);near(run('q.t.yaw'),.2);vector(plain(run('q.t.bd')),plain(run('q.desired')),1e-6);assert.equal(run('q.t.pd'),true);assert.equal(run('q.t.arc'),true);assert.equal(run('q.t.aimed'),true);assert.equal(run('trial.bolts.length'),4);assert.ok(run('trial.bolts.every(b=>b.pd&&b.target===threat)'));
});

test('the real trial loop selects a reachable equivalent pose across a vertical pole and rejects targets outside the mechanical range',()=>{
 run('globalThis.q=setup("ball720",{a:2},30,false,false,.2,88*Math.PI/180);trialGunnery(.01)');
 assert.equal(run('q.t.arc'),true);vector(plain(run('q.t.bd')),plain(run('q.desired')),1e-6);assert.ok(run('q.t.el>=q.t.authored.limits.lo&&q.t.el<=q.t.authored.limits.hi'));
 run('globalThis.q=setup("ball720",{a:2},42);aimPoint=tv.add(trialApply(trial.R,tv.sub(q.t.origin,q.geometry.center)),trialApply(trial.R,C.mul(q.t.axis,-1)),100000);trial.fire=true;trialGunnery(.01)');
 assert.equal(run('q.t.arc'),false);assert.equal(run('trial.gun.shots'),0);assert.equal(run('trial.bolts.length'),0);
 run('globalThis.q=setup("ball720",{a:2},42);trial.gunMode="home";trialGunnery(.01)');near(run('q.t.yaw'),0);near(run('q.t.el'),0);vector(plain(run('q.t.bd')),plain(run('q.t.authored.fw')),1e-7);
});
