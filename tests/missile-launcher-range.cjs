const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',context),plain=q=>JSON.parse(JSON.stringify(q)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function profile(kind='cmsl',cells=1){
 const native=kind==='cmsl'||kind==='shipMsl',range=kind==='shipMsl'?60000:10000;
 const launcher={k:'launcher',fit:2,port:'f2',domain:'main',name:'Launcher',size:1,share:1,at:.5,powerConnected:true,stock:6*cells,missileKind:kind,missileRange:range,salvo:cells,cycle:1.2,tt:25,launchPowerW:1e15,muzzle:[0,0,0],launchMuzzles:Array.from({length:cells},(_,i)=>[0,0,i]),launchDir:[1,0,0]};
 return {name:'Range fixture',profileVersion:5,hp:1e6,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,
 gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},msl:native?25*cells*20/1.2:0,imsl:0,
 modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher],grid:{P:1e18,Pgen:1e18,Paux:0,fixed:1e15,cooling:0,De:0,Ds:0,Dw:0,fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:1e15}]}};
}
function targetProfile(){const p=profile();p.msl=0;p.modules=p.modules.slice(0,1);p.grid.fixed=0;p.grid.fixedLoads=[];return p;}
function unit(kind='cmsl',cells=1){return C.fleetUnit('launcher','launcher',profile(kind,cells),0);}
function power(u){C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},0,'balanced');}
function world(kind='cmsl',distance=20000){
 const a={key:'range-a',p:profile(kind),info:{mass:1000,hyper:null,capital:false,sensor:0}},z={key:'range-z',p:targetProfile(),info:{mass:1000,hyper:null,capital:false,sensor:0}},w=R.createWorld({mode:'test',sensors:false,convoyMode:false,designs:[a,z],sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:a.key}],[{design:z.key}]]});
 const u=[...w.units.values()].find(q=>q.side===0),t=[...w.units.values()].find(q=>q.side===1);t.sys=u.sys;w.groups.get(t.group).sys=u.sys;u.pos=[0,1000,0];u.yaw=0;t.pos=[distance,1000,0];u.order={...u.order,type:'attack',target:t.id};t.order={...t.order,type:'hold',fire:false};return {w,u,t};
}

test('each native launcher range is checked before its ammunition is spent',()=>{
 const u=unit();const ship={...profile('shipMsl').modules[1],fit:3,port:'f3'};u.p.modules.push(ship);u.mods.push(1);u.ammo.push(6);u.p.grid.fixed+=1e15;u.p.grid.fixedLoads.push({id:'f3',port:'f3',domain:'main',weight:1e15});power(u);
 const shots=C.fleetMissileStep(u,.1,true,{distance:20000});assert.deepEqual(plain(shots.map(q=>q.kind)),['shipMsl']);assert.equal(u.ammo[1],6);assert.equal(u.ammo[2],5);assert.equal(shots[0].range,60000);
 assert.equal(C.missileRange(u.p.modules[1]),10000);assert.equal(C.missileMaxRange(u),60000);
 const far=unit('shipMsl');power(far);assert.equal(C.fleetMissileStep(far,.1,true,{distance:60000.001}).length,0);assert.equal(far.ammo[1],6);
 for(const [kind,distance] of [['cmsl',10000],['shipMsl',60000]]){const edge=unit(kind);power(edge);assert.equal(C.fleetMissileStep(edge,.1,true,{distance}).reduce((n,q)=>n+q.n,0),1);}
});

test('ship cell salvos use their own physical muzzles and preserve six salvos and the 25 TT warhead',()=>{
 const u=unit('shipMsl',3);let shots=[];for(let i=0;i<80;i++){power(u);shots.push(...C.fleetMissileStep(u,.1,true,{distance:20000}));}
 assert.equal(shots.length,18);assert.ok(shots.every(q=>q.kind==='shipMsl'&&q.n===1&&q.tt===25&&q.range===60000));assert.equal(u.ammo[1],0);
 assert.deepEqual(plain(shots.slice(0,3).map(q=>q.muzzle)),[[0,0,0],[0,0,1],[0,0,2]]);
 u.pos=[10,20,30];u.yaw=Math.PI/2;const launch=C.missileLaunchWorld(u,shots[2]);assert.deepEqual(plain(launch.origin),[8,20,30]);assert.ok(launch.physical);near(launch.axis[2],1);
});


test('ship launchers keep per-cell ammunition and fire a partial final volley from loaded cells only',()=>{
 const u=unit('shipMsl',3);power(u);const first=C.fleetMissileStep(u,.1,true,{distance:20000});assert.equal(first.length,3);assert.deepEqual(plain(u.launcherCellAmmo[1]),[5,5,5]);
 u.launcherCellAmmo[1]=[0,2,1];u.ammo[1]=3;let rest=[];for(let i=0;i<40;i++){power(u);rest.push(...C.fleetMissileStep(u,.1,true,{distance:20000}));}
 assert.equal(rest.length,3);assert.deepEqual(plain(rest.map(q=>q.muzzle[2]).sort()),[1,1,2]);assert.deepEqual(plain(u.launcherCellAmmo[1]),[0,0,0]);assert.equal(u.ammo[1],0);
});

test('combat state clones own independent per-cell missile inventory',()=>{
 const u=unit('shipMsl',3);power(u);C.fleetMissileStep(u,.1,true,{distance:20000});const copy=C.combatClone(u);assert.deepEqual(plain(copy.launcherCellAmmo),plain(u.launcherCellAmmo));copy.launcherCellAmmo[1][0]=0;assert.equal(u.launcherCellAmmo[1][0],5);
});

test('tactical fleet combat cannot use aircraft tubes at the former 60 km range',()=>{
 for(const kind of ['cmsl','shipMsl']){const u=unit(kind),t=C.fleetUnit('target','target',targetProfile(),1);u.pos=[0,1000,0];t.pos=[20000,1000,0];u.order={...u.order,type:'attack',target:t.id};t.order={...t.order,fire:false};const b=C.fleetBattle([u,t],true);let damage=0;
 for(let i=0;i<20;i++)damage+=C.fleetTick(b,.1,{collide:false}).filter(q=>q.from===u.id).reduce((n,q)=>n+(q.msl||0),0);
 if(kind==='cmsl'){assert.equal(damage,0);assert.equal(u.ammo[1],6);}else{assert.ok(damage>0);assert.ok(u.ammo[1]<6);}}
});


test('missile-only AI chooses a standoff within the ranges of its actual launchers',()=>{
 const t=C.fleetUnit('target','target',targetProfile(),1),air=C.fleetStandoff(unit('cmsl'),t),ship=C.fleetStandoff(unit('shipMsl'),t);
 assert.ok(air>0&&air<=10000,`aircraft tube standoff ${air}`);assert.ok(ship>10000&&ship<=60000,`ship missile standoff ${ship}`);
});

test('aircraft squadron release checks its own round range before spending stores',()=>{
 const s={id:'range-squad',craft:'awing',n:1,side:0,home:'carrier',pos:[0,0,0]},w={nextId:1,missiles:[]},t={id:'target',pos:[10000.01,0,0]};R.squadStores(s);const before=plain(s.ammo);
 assert.equal(R.squadRelease(w,0,s,t,false,null).length,0);assert.deepEqual(plain(s.ammo),before);assert.equal(w.missiles.length,0);
 t.pos=[10000,0,0];assert.ok(R.squadRelease(w,0,s,t,false,null).length>0);assert.ok(w.missiles.length>0);assert.ok(w.missiles.every(m=>m.kind==='cmsl'&&m.range===10000&&m.traveled===0&&m.tt===C.ORDNANCE.cmsl.tt&&m.life<=m.range/m.s+1e-9));
});

test('RTS targeting launches ship missiles through 60 km and preserves aircraft ammunition',()=>{
 for(const distance of [20000,60000])for(const kind of ['cmsl','shipMsl']){const {w,u}=world(kind,distance);R.battleTick(w,u.sys,.25);const shots=w.missiles.filter(q=>q.from===u.id);
 if(kind==='cmsl'){assert.equal(shots.length,0);assert.equal(u.ammo[1],6);}else{assert.equal(shots.length,1);assert.equal(shots[0].kind,'shipMsl');assert.equal(shots[0].range,60000);assert.ok(shots[0].traveled>0);assert.equal(u.ammo[1],5);}}
});

test('RTS flight caps its final segment at the exact range and cannot damage after expiry',()=>{
 const {w,u,t}=world('cmsl',9000);R.battleTick(w,u.sys,.25);const m=w.missiles.find(q=>q.from===u.id);assert.ok(m);u.order.fire=false;
 m.pos=[10000,1000,0];m.vel=[2600,0,0];m.s=2600;m.range=10000;m.traveled=9999;m.life=45;m.launchClearance=0;t.pos=[20000,1000,0];const hp=t.hp;
 R.battleTick(w,u.sys,.25);near(m.pos[0],10001);near(m.traveled,10000);assert.ok(m.life<=0||m.n<=0);assert.equal(t.hp,hp);assert.equal(w.missiles.includes(m),false);
 // Even a target entering the spent missile's location cannot make it hit on a later tick.
 t.pos=[10001,1000,0];R.battleTick(w,u.sys,.25);assert.equal(t.hp,hp);
});

test('an already spent guided round cannot score an impact inside its final-step hit radius',()=>{
 const {w,u,t}=world('cmsl',9000);R.battleTick(w,u.sys,.25);const m=w.missiles.find(q=>q.from===u.id);assert.ok(m);u.order.fire=false;
 m.pos=[10000,1000,0];m.range=10000;m.traveled=10000;m.life=45;m.launchClearance=0;t.pos=[10001,1000,0];const hp=t.hp;R.battleTick(w,u.sys,.25);assert.equal(t.hp,hp);assert.equal(w.missiles.includes(m),false);
});

test('aircraft store descriptors propagate the round range without changing their warhead',()=>{
 const missiles=C.craftOrdnance('awing').filter(q=>q.kind==='cmsl');assert.ok(missiles.length);assert.ok(missiles.every(q=>q.range===10000&&q.tt===C.ORDNANCE.cmsl.tt));assert.equal(missiles.reduce((n,q)=>n+q.n,0),12);
 const torpedoes=C.craftOrdnance('xwing').filter(q=>q.kind==='ptorp');assert.ok(torpedoes.length);assert.ok(torpedoes.every(q=>q.tt===C.ORDNANCE.ptorp.tt&&q.tt!==25));
});

const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function trialSetup(kind='cmsl',cells=1){
 const cx=vm.createContext({console,C,Math:Object.assign(Object.create(Math),{random:()=>.5})}),run=s=>vm.runInContext(s,cx);
 run(`const trial={},notes=[],toast=s=>notes.push(s),sndAt=()=>{},tv={add:(a,b,k=1)=>a.map((n,i)=>n+b[i]*k),sub:C.sub,scale:C.mul,dot:C.dot,len:C.len,norm:C.norm,cross:C.cross};`);
 run(section('function trialRot(','// Column-major frame'));run(section('const trialCol=','const trialWrap='));run(section('function trialSystemsUnit()','function trialPropulsionMotion('));run(section('const TRIAL_MSL=','// The engine tests each barrel direction'));run(section('function spaceAmmo(','// The enemy\'s arrival'));
 cx.profile=profile(kind,cells);run(`const unit=C.fleetUnit('manual','manual',profile,0);unit.pw={P:1e18};unit.propulsion={power:{granted:{'fixed:f2':1e15}}};const launcher={id:2,kind:profile.modules[1].missileKind,range:profile.modules[1].missileRange,origin:[0,0,0],muzzles:profile.modules[1].launchMuzzles,axis:[1,0,0],salvo:profile.modules[1].salvo,cycle:1.2,tt:25,ammo:profile.modules[1].stock,ammo0:profile.modules[1].stock,reload:0,queue:0,next:0};Object.assign(trial,{p:profile,systemsUnit:unit,battle:{me:unit,modIndex:new Map([[2,1]])},asset:{geometry:{center:[0,0,0]}},launchers:[launcher],R:[1,0,0,0,1,0,0,0,1],P:[0,1000,0],V:[0,0,0],missiles:[],fx:[],gun:{missiles:0},aim:{dir:[1,0,0]},mslOrder:false});const target={alive:true,pos:[20000,1000,0],vel:[0,0,0]};function fire(lock=null,dt=.01){trial.mslOrder=true;trialMissiles(dt,lock);}`);
 return {run,cx};
}

test('manual trial range checks its locked target before committing a round',()=>{
 for(const distance of [20000,60000])for(const kind of ['cmsl','shipMsl']){const {run}=trialSetup(kind);run(`target.pos=[${distance},1000,0];fire(target)`);if(kind==='cmsl'){assert.equal(run('trial.gun.missiles'),0);assert.equal(run('unit.ammo[1]'),6);assert.equal(run('launcher.queue'),0);}else{assert.equal(run('trial.gun.missiles'),1);assert.equal(run('unit.ammo[1]'),5);assert.equal(run('trial.missiles[0].range'),60000);}}
});

test('manual trial exact range expiry counts the actual path including inherited ship velocity',()=>{
 const {run}=trialSetup();run('trial.V=[1000,0,0];fire();const m=trial.missiles[0];m.pos=[9000,1000,0];m.prev=m.pos;m.traveled=9999;m.range=10000;m.life=30;m.boost=0;m.h=[1,0,0];m.dir=[1,0,0];m.s=2600;trialMissiles(1,null)');
 near(run('m.pos[0]'),9001);near(run('m.traveled'),10000);assert.ok(run('m.life<=0'));assert.equal(run('trial.missiles.length'),0);
});


test('manual ship salvos spend the corresponding cells and retain partial final volleys',()=>{
 const {run}=trialSetup('shipMsl',3);run('fire();for(let i=0;i<8;i++)trialMissiles(.15,null)');assert.equal(run('trial.gun.missiles'),3);assert.deepEqual(plain(run('unit.launcherCellAmmo[1]')),[5,5,5]);
 run('unit.launcherCellAmmo[1]=[0,2,1];unit.ammo[1]=3;for(let volley=0;volley<3;volley++){launcher.reload=0;fire();for(let i=0;i<8;i++)trialMissiles(.15,null)}');assert.equal(run('trial.gun.missiles'),6);assert.deepEqual(plain(run('unit.launcherCellAmmo[1]')),[0,0,0]);assert.equal(run('unit.ammo[1]'),0);
});
