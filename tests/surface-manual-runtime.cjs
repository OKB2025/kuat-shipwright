const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const run=s=>vm.runInContext(s,cx),plain=x=>JSON.parse(JSON.stringify(x)),close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
run(`const C=Core,TT_J=C.TT,notices=[],hits=[],trial={};
const tv={add:(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),sub:(a,b)=>a.map((v,i)=>v-b[i]),scale:(a,k)=>a.map(v=>v*k),dot:(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),len:a=>Math.hypot(...a),norm:a=>{const n=Math.hypot(...a)||1;return a.map(v=>v/n);}},toast=s=>notices.push(s);
const trialCol=(r,i)=>r.slice(i*3,i*3+3),trialAttitude=()=>({f:[1,0,0],u:[0,1,0],r:[0,0,1],bank:0,pitch:0}),trialMaxRates=()=>[1,1,1],trialStickInput=()=>({x:0,y:0}),trialRateBase=()=>({tau:1}),trialGunnery=()=>{},trialSys=()=>({planet:{radius:1000},floor:0}),TRIAL_TELEGRAPH=[[0,0],[0,0],[0,0],[0,0],[0,0],[0,1]];
const SYSTEMS={a:{name:'A'},b:{name:'B'}},trialHyperClass=()=>1,JUMP={spool:10},trialSwPowerK=()=>1,trialSwStrike=o=>hits.push(o.ref.name);
function fixture(surface=false){
 const modules=[{k:'reactor',part:1,size:100,share:1,at:.3,domain:'main'},{k:'weapon',fit:3,size:1,share:.5,at:.2,domain:'main',powerConnected:true},{k:'weapon',fit:4,size:1,share:.5,at:.8,domain:'main',powerConnected:true},{k:'engine',part:5,size:1,share:1,at:.1,domain:'main',powerConnected:true},{k:'shield',part:6,size:1,share:1,at:.4,domain:'main',powerConnected:true}];
 const p={name:'Manual runtime',hp:100000,len:100,width:40,height:20,armorHull:0,D:0,shieldBuffer:1000,reserve:50,wCap:100,crewNeed:0,maxSpeed:1000,accel:100,turnRate:.1,gunArcs:[10,10,10,10,10,10],ionArcs:[0,0,0,0,0,0],modules,energyModel:{version:1,eta:.75},grid:{P:TT_J*100,fixed:TT_J,De:TT_J*10,Ds:TT_J*10,Dw:TT_J*10,domains:[{id:'main',P:TT_J*100,modules:[0,1,2,3,4]}]}};
 if(surface)p.surface={patches:[{id:'patch',face:'top'}],mounts:[3,4].map((id,i)=>({id,module:i+1,patch:'patch',capacity:50,power:10*TT_J,gun:1,ion:0,arcs:[1,1,1,1,1,1],barrels:1,crewNeed:0,cycle:1,band:'mid',center:[i*10,10,0]}))};
 const u=C.fleetUnit('me','fixture',p);Object.assign(trial,{p,battle:{me:u,modIndex:new Map([[3,1],[4,2]])},systemsUnit:null,swSolo:null,powerMode:'weapons',energy:{E:50,cap:100},engF:1,thrustWant:1,t:0,on:true,jump:null,sysKey:'a',P:[0,2000,0],V:[100,5,20],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],tele:5,rudder:0,level:false,vf:100,dust:{H:1,pos:[]},rec:{top:0},craft:false});notices.length=0;hits.length=0;return u;
}
`);
function extract(name){const a=app.indexOf('function '+name+'('),b=app.indexOf('\n}',a)+2;assert.ok(a>=0&&b>a,name);run(app.slice(a,b));}
for(const line of app.split('\n'))if(line.startsWith('function trialSetThrottle(')||line.startsWith('function trialJumpCommitted('))run(line);
for(const name of ['trialSystemsUnit','trialPowerFactor','trialPropulsionMotion','trialThrottleCommand','trialMainOutput','trialPowerStep','trialStep','trialJump','trialCancelJump','trialJumpStep','trialIonPracticeStep'])extract(name);
for(const line of app.split('\n'))if(line.startsWith('function trialSwSoloEnergy(')||line.startsWith('function trialSwSoloBeamEnergy('))run(line);

test('manual charging uses the same input/output/loss boundary as common combat',()=>{
 const r=run(`(()=>{const u=fixture(),before=trial.energy.E;trialPowerStep(.25,0);return {stored:(trial.energy.E-before)*TT_J,input:u.pw.wpn*.25,heat:u.ht.e.weapon};})()`);
 assert.ok(r.stored>0);close(r.input,r.stored+r.heat);close(r.stored/r.input,.75);
});

test('full manual cell banks draw no fictitious charge power or weapon heat',()=>{
 const r=run(`(()=>{const u=fixture(true);trial.energy.E=100;u.energy=100;trialPowerStep(.25,TT_J);return {energy:u.energy,input:u.pw.wpn,heat:u.ht.e.weapon};})()`);
 assert.equal(r.energy,100);assert.equal(r.input,0);assert.equal(r.heat,0);
});

test('a direct pilot cannot recharge or thrust during a common-grid trip',()=>{
 const r=run(`(()=>{const u=fixture(),before=trial.energy.E;C.ionOverload(u,1000,{moduleIndex:1});trialPowerStep(.25,TT_J);return {before,after:trial.energy.E,eng:trial.engF,P:trial.power.P,shield:trial.power.got.shields,black:C.powerStatus(u).blackout};})()`);
 assert.equal(r.black,true);assert.equal(r.after,r.before);assert.equal(r.eng,0);assert.equal(r.P,0);assert.equal(r.shield,0);
});

test('manual blackout retains instantaneous inertia then follows disabled gravity and passive drag',()=>{
 const r=run(`(()=>{const u=fixture(),v=trial.V.slice(),p=trial.P.slice();C.ionOverload(u,1000,{moduleIndex:1});const instant=trial.V.slice(),drag=C.massDragRate(u);trialStep(.25);return {before:v,instant,position:p,after:trial.V,finalPosition:trial.P,drag,thrust:trial.thrust,out:u.out};})()`);
 assert.deepEqual(plain(r.instant),plain(r.before));assert.equal(r.out,'電源喪失');let position=plain(r.position),velocity=plain(r.before);const dt=.05,decay=Math.exp(-r.drag*dt),gain=r.drag>0?-Math.expm1(-r.drag*dt)/r.drag:dt,distance=r.drag>0?(dt-gain)/r.drag:dt*dt/2;
 for(let step=0;step<5;step++){const radius=Math.hypot(...position),acceleration=position.map(x=>-run('C.HULL_FALL.g')*x/radius),next=velocity.map((v,i)=>v*decay+acceleration[i]*gain);position=position.map((p,i)=>p+velocity[i]*gain+acceleration[i]*distance);velocity=next;}
 for(let i=0;i<3;i++){close(r.after[i],velocity[i]);close(r.finalPosition[i],position[i]);}assert.equal(r.thrust,0);
});

test('source loss rejects a jump start and cancels a pending manual spool without resuming it',()=>{
 const r=run(`(()=>{const u=fixture();C.ionOverload(u,1000,{moduleIndex:1});trialJump('b');const blocked=trial.jump===null,before=trial.V.slice();trial.jump={phase:'spool',t:2,age:2,priorThrottle:.25};trialJumpStep(1);const cancelled=trial.jump===null,after=trial.V.slice(),command=trial.throttle;u.p.crewCapacity=1;u.crew=1;u.ht.qJ=.8*u.ht.capacityJ;C.powerTick(u,300);trialJumpStep(1);return {blocked,cancelled,restored:u.out===null,stillCancelled:trial.jump===null,before,after,command,message:notices[0]};})()`);
 assert.equal(r.blocked,true);assert.equal(r.cancelled,true);assert.equal(r.restored,true);assert.equal(r.stillCancelled,true);assert.deepEqual(plain(r.after),plain(r.before));assert.equal(r.command,.25);assert.match(r.message,/給電停止/);
});

test('practice ion pulses share finite geometric energy in distance order across several targets',()=>{
 const r=run(`(()=>{fixture();const objects=[1,2,3,4].map(i=>({ref:{name:'target'+i,pos:[i*1000,0,0],alive:true},reach:30})),make=()=>({o:[0,0,0],dir:[1,0,0],x:0,d:100,E:1000,E0:1000,hit:new Set()}),a=make(),b=make();trialIonPracticeStep(a,objects.slice().reverse(),2);const order=hits.slice();hits.length=0;for(let i=0;i<8;i++)trialIonPracticeStep(b,objects,.25);return {a:{left:a.E,received:a.received},b:{left:b.E,received:b.received},order,small:hits};})()`);
 close(r.a.left+r.a.received,1000);close(r.b.left+r.b.received,1000);close(r.a.left,r.b.left);assert.deepEqual(plain(r.order),plain(r.small));assert.equal(r.order.length,4);
});

test('a partially charged practice pulse consumes the common superweapon store exactly once',()=>{
 const r=run(`(()=>{const u=fixture();u.p.sw=[{k:'hion',Emax:1000}];u.sw=[{c:.2,st:'charge'}];C.superweaponDischarge(u,0,0);u.sw[0].c=0;const first=trialSwSoloEnergy(u,0,200),second=trialSwSoloEnergy(u,0,200);return {first,second,ledger:u.weaponLedger};})()`);
 close(r.first,200);close(r.second,0);close(r.ledger.initialJ,r.ledger.storedJ+r.ledger.emittedJ+r.ledger.releasedJ);close(r.ledger.emittedJ,200*run('TT_J'));
});

test('a practice beam records emitted energy separately from safely released unused charge',()=>{
 const r=run(`(()=>{const u=fixture();u.p.sw=[{k:'sbeam'}];u.sw=[{c:.1,st:'beam',t:10}];C.superweaponDischarge(u,0,0);const x=u.sw[0],amount=u.weaponLedger.initialJ/TT_J;x.c=0;x.practiceLeft=amount;x.practiceRate=amount/10;trialSwSoloBeamEnergy(u,0,x,2);x.t=8;trialSwSoloBeamEnergy(u,0,x,1,true);return u.weaponLedger;})()`);
 close(r.initialJ,r.emittedJ+r.releasedJ+r.storedJ);close(r.emittedJ,r.initialJ*.2);close(r.releasedJ,r.initialJ*.8);close(r.storedJ/r.initialJ,0);
});
