const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',context),plain=q=>JSON.parse(JSON.stringify(q));
function profile(native=true){
 const launcher={k:'launcher',fit:2,port:'f2',domain:'main',name:'Launcher',size:1,share:1,at:.5,powerConnected:true,stock:native?6:120,
  ...(native?{missileKind:'cmsl',salvo:1,cycle:1.2,tt:25,launchPowerW:1e15,muzzle:[10,2,3],launchDir:[Math.SQRT1_2,Math.SQRT1_2,0]}:{ion:1})};
 return {name:'Launcher fixture',hp:1e6,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,
  gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},
  msl:native?25*20/1.2:0,imsl:native?0:80,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher],
  grid:{P:1e18,Pgen:1e18,Paux:0,fixed:native?1e15:0,cooling:0,De:0,Ds:0,Dw:0,
   ...(native?{fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:1e15}]}:{})}};
}
function unit(native=true){return C.fleetUnit('launcher','launcher',profile(native));}
function power(u){return C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},0,'balanced');}
function advance(u,dt,n,active=true){let shots=[];for(let i=0;i<n;i++){power(u);shots.push(...C.fleetMissileStep(u,dt,active));}return shots;}

test('compact launchers fire six integer 25 TT rounds then exhaust their magazine',()=>{
 const u=unit(),shots=advance(u,.1,100);
 assert.equal(shots.reduce((n,q)=>n+q.n,0),6);assert.ok(shots.every(q=>q.tt===25&&Number.isInteger(q.n)));
 assert.equal(u.ammo[1],0);assert.equal(advance(u,.1,100).length,0);
});

test('old ammunition counts cannot exceed the common tube or its selected load',()=>{
 const u=unit();u.ammo[1]=60;assert.equal(advance(u,.1,100).reduce((n,q)=>n+q.n,0),6);
 const selected=unit();selected.ammo[1]=60;selected.missileLoadCaps={2:2};assert.equal(advance(selected,.1,100).reduce((n,q)=>n+q.n,0),2);assert.equal(selected.ammo[1],0);
});

test('combat state copies keep independent selected missile load limits',()=>{
 const u=unit();u.missileLoadCaps={2:2};const cloned=C.combatClone(u);assert.deepEqual(plain(cloned.missileLoadCaps),{2:2});cloned.missileLoadCaps[2]=1;assert.equal(u.missileLoadCaps[2],2);
});

test('launcher reload timers are independent and idle time does not bank extra salvos',()=>{
 const u=unit();u.p.modules.push({...u.p.modules[1],fit:3,port:'f3'});u.mods.push(1);u.ammo.push(6);
 u.p.grid.fixed+=1e15;u.p.grid.fixedLoads.push({id:'f3',port:'f3',domain:'main',weight:1e15});u.launcherT=[0,0,.6];
 power(u);const first=C.fleetMissileStep(u,.1,true);assert.deepEqual(plain(first.map(q=>q.module)),[1]);
 advance(u,.1,600,false);const next=advance(u,.1,1);assert.equal(next.reduce((n,q)=>n+q.n,0),2);
});

test('equal simulated time preserves native launch counts across step sizes',()=>{
 assert.equal(advance(unit(),.25,16).reduce((n,q)=>n+q.n,0),advance(unit(),.1,40).reduce((n,q)=>n+q.n,0));
});

test('legacy ion tubes retain eight rounds per twenty seconds at 10 TT',()=>{
 const u=unit(false),first=advance(u,.25,1);assert.equal(first.length,1);assert.equal(first[0].n,8);assert.equal(first[0].tt,10);assert.equal(first[0].ion,true);
 assert.equal(u.ammo[1],112);assert.equal(advance(u,.25,75).length,0);
});

test('native concussion and legacy ion tubes retain independent cadence and warheads',()=>{
 const u=unit();u.p.modules.push({...profile(false).modules[1],fit:3,port:'f3'});u.mods.push(1);u.ammo.push(120);
 const first=advance(u,.25,1);assert.equal(first.find(q=>q.kind==='cmsl').n,1);assert.equal(first.find(q=>q.ion).n,8);assert.equal(first.find(q=>q.ion).tt,10);
 const next=advance(u,.25,5);assert.equal(next.filter(q=>q.ion).length,0);assert.equal(next.filter(q=>q.kind==='cmsl').reduce((n,q)=>n+q.n,0),1);
});

test('launchers require their own actual electronics grant and intact connected hardware',()=>{
 for(const cut of [u=>{u.mods[1]=0;},u=>{u.p.modules[1].powerConnected=false;},u=>{u.p.grid.P=0;u.p.grid.Pgen=0;},u=>{u.gridState={domains:{main:{trip:0}},local:{1:10}};},u=>{u.p.grid.powerPaths=[{from:'p1',to:'f2',cap:0}];}]){
  const u=unit();cut(u);assert.equal(advance(u,.1,1).length,0);assert.equal(u.ammo[1],6);
 }
 const u=unit();u.p.grid.P=1;u.p.grid.Pgen=1;power(u);
 // An explicitly known zero grant cannot be rescued by an unrelated live reactor.
 u.propulsion.power.granted['fixed:f2']=0;assert.equal(C.fleetMissileStep(u,.1,true).length,0);
 const trunk=unit();trunk.p.modules.push({k:'other',part:3,port:'trunk',domain:'main',size:1,share:1});trunk.mods.push(0);trunk.ammo.push(0);
 trunk.p.grid.powerPaths=[{from:'p1',to:'trunk',cap:1e18},{from:'trunk',to:'f2',cap:1e18}];trunk.p.grid.trunks=[{port:'trunk',moduleIndex:2}];
 assert.equal(advance(trunk,.1,1).length,0);assert.equal(trunk.ammo[1],6);
});

test('the fleet model consumes physical native rounds instead of its compatibility aggregate',()=>{
 const u=unit(),p=profile();p.msl=0;p.modules=p.modules.slice(0,1);p.grid.fixed=0;p.grid.fixedLoads=[];
 const t=C.fleetUnit('target','target',p,1);u.pos=[0,1000,0];t.pos=[10000,1000,0];u.order={...u.order,type:'attack',target:t.id};t.order={...t.order,fire:false};
 const b=C.fleetBattle([u,t],true);let tt=0;
 for(let i=0;i<80;i++){const shots=C.fleetTick(b,.1,{collide:false});tt+=shots.filter(s=>s.from===u.id).reduce((n,s)=>n+(s.msl||0),0);}
 assert.equal(u.ammo[1],0);assert.ok(Math.abs(tt-150)<1e-8);
});

test('physical launcher muzzles and pitched axes rotate with the ship',()=>{
 const u=unit();u.pos=[100,200,300];u.yaw=Math.PI/2;
 const p={kind:'cmsl',muzzle:[10,2,3],axis:[Math.SQRT1_2,Math.SQRT1_2,0]},v=C.missileLaunchWorld(u,p,{pos:[1000,200,300]});
 assert.deepEqual(plain(v.origin),[97,202,310]);assert.ok(Math.abs(v.axis[0])<1e-12);assert.ok(v.axis[1]>.7&&v.axis[2]>.7);
});

test('the RTS launches from its actual pitched muzzle before homing toward the target',()=>{
 const a={key:'missile-a',p:profile(),info:{mass:1000,hyper:null,capital:false,sensor:0}},p=profile();p.msl=0;p.modules=p.modules.slice(0,1);p.grid.fixed=0;p.grid.fixedLoads=[];
 const z={key:'missile-z',p,info:{mass:1000,hyper:null,capital:false,sensor:0}},w=R.createWorld({mode:'test',sensors:false,convoyMode:false,designs:[a,z],sides:[{faction:'empire',ai:false},{faction:'rebel',ai:false}],fleets:[[{design:a.key}],[{design:z.key}]]});
 const u=[...w.units.values()].find(q=>q.side===0),t=[...w.units.values()].find(q=>q.side===1);t.sys=u.sys;w.groups.get(t.group).sys=u.sys;
 u.pos=[0,1000,0];u.yaw=Math.PI/2;t.pos=[0,1000,9000];u.order={...u.order,type:'attack',target:t.id};t.order={...t.order,type:'hold',fire:false};
 R.battleTick(w,u.sys,.25);const m=w.missiles.find(q=>q.from===u.id);
 assert.ok(m);assert.equal(m.n,1);assert.equal(m.tt,25);assert.equal(u.ammo[1],5);
 assert.ok(m.launchOrigin.every((v,i)=>Math.abs(v-[-3,1002,10][i])<1e-10));assert.ok(m.vel[1]>0&&m.vel[2]>0);
 assert.ok(Math.abs(m.pos[0]+3)<1e-8,'first step retains the rotated launcher axis');
});

test('aircraft keep their existing six stored missiles without native aggregate fire',()=>{
 const ship=C.newShip({L:15,W:8,H:4},'Missile craft');ship.shipClass='starfighter';
 const h=C.rayEnv(ship,[8,100,0],[0,-1,0],{structOnly:true});C.placeFit(ship,'cmsl',h.p,h.n,0,false);
 const S=C.computeStats(ship),c=C.craftCombat(ship,S);assert.equal(S.mslSalvo,0);
 assert.equal(c.ord.filter(q=>q.kind==='cmsl').reduce((n,q)=>n+q.n,0),6);assert.ok(c.ord.every(q=>q.tt===25));
});

test('legacy ion launchers retain their aggregate even on a small craft',()=>{
 const ship=C.newShip({L:20,W:16,H:10},'Ion craft');ship.shipClass='starfighter';
 const h=C.rayEnv(ship,[10,100,0],[0,-1,0],{structOnly:true}),f=C.placeFit(ship,'itl',h.p,h.n,0,false).fit;f.mount='ext';
 const S=C.computeStats(ship);assert.equal(S.imslSalvo,80);assert.equal(S.mslSalvo,0);
});

test('capital fitting profiles own their finite magazine, physical muzzle and one fixed electronics load',()=>{
 const ship=C.newShip({L:100,W:60,H:40},'Capital missile');
 const h=C.rayEnv(ship,[60,100,0],[0,-1,0],{structOnly:true}),f=C.placeFit(ship,'cmsl',h.p,h.n,0,false).fit;f.launchPitch=-30;
 const S=C.computeStats(ship),p=C.craftPowerProfile(ship,S),m=p.modules.find(q=>q.fit===f.id),spec=C.missileLauncherSpec(f),span=C.shipSpan(ship),center=[(span[0]+span[1])/2,(S.ybox[0]+S.ybox[1])/2,0];
 assert.equal(m.k,'launcher');assert.equal(m.stock,6);assert.equal(m.salvo,1);assert.equal(m.cycle,1.2);assert.equal(m.tt,25);
 m.muzzle.forEach((v,i)=>assert.ok(Math.abs(v+center[i]-spec.origin[i])<1e-9));assert.deepEqual(plain(m.launchDir),plain(spec.axis));
 assert.equal(S.mslSalvo,25*20/1.2);assert.equal(S.draw.weapons,0);
 const load=p.grid.fixedLoads.find(q=>q.port==='f'+f.id);assert.ok(load&&load.weight>0);assert.equal(load.weight,m.launchPowerW);
 assert.ok(Math.abs(p.grid.fixedLoads.reduce((n,q)=>n+q.weight,0)-(p.grid.fixed-p.grid.cooling))<1e-9*p.grid.fixed);
});

test('surface VLS produces the same six-round functional launcher module',()=>{
 const ship=C.newShip({L:100,W:60,H:50,assembly:true},'VLS');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};
 const body=C.placePart(ship,'struct',[50,20,0],[80,40,30],{form:'box'},false),panel=C.surfacePatches(ship).find(q=>q.host==='p'+body.id&&q.face==='top');
 // This is an authored legacy surface launcher, not the retired automatic equipment generator.
 const f=C.placeFit(ship,'cmsl',[50,35,0],[0,1,0],0,false).fit;
 Object.assign(f,{surfacePatch:panel.id,surfaceCell:'manual-vls',surfaceRole:'weapons',surfacePoint:f.p.slice(),surfaceFootprint:[1.2,.45],surfaceDepth:1.2,n:[0,1,0],tilt:[0,1,0],localMount:true});
 const loaded=C.deserialize(C.serialize(ship));C.remount(loaded);
 const S=C.computeStats(loaded),p=C.craftPowerProfile(loaded,S),m=p.modules.find(q=>q.missileKind==='cmsl');
 assert.ok(m);assert.equal(m.mount,'vls');assert.equal(m.stock,6);assert.equal(m.tt,25);assert.ok(m.launchDir[1]>.99);assert.ok(p.grid.fixedLoads.some(q=>q.port===m.port&&q.weight>0));
 const partial={...S,vlsInfo:{...S.vlsInfo,[m.fit]:{...S.vlsInfo[m.fit],ratio:.5}}},half=C.fleetModules(loaded,partial).find(q=>q.fit===m.fit);assert.equal(half.stock,3,'a half-retained VLS cannot carry a full six-round magazine');
});
