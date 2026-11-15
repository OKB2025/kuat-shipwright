// The firing loss of a superweapon is heat (user decision 2026-11-15「発射の熱も排熱」): of the energy a shot spends,
// HEAT.swShot (2%) stays in the ship as heat and the rest leaves as the beam. An AI ship holds a shot its heat store
// could not take; a pilot's shot and an explicit order to fire are not held.
// The synthetic ship is the one of tests/onager-fixed-axis-runtime.cjs: two 125 PT beams, no heat converters.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`),ctx={time:0,damage:1,rand:()=>.9,ev(){},sunk(){},out(){}};
function source(){
 const modules=[{k:'reactor',part:1,size:100,share:1,at:.5,domain:'main'},...['left','right'].map((name,i)=>({k:'superweapon',name,part:101+i,size:1,share:.5,at:.8,domain:'main',powerConnected:true}))],sw=[0,1].map(i=>({id:101+i,k:'sbeam',aim:'bow',axis:[1,0,0],mz:[10,0,i?5:-5],Emax:125000,d:38.2,chargeT:100,chargeW:1e22,efficiency:.88,initialCharge:1,r:1,rk:'gen',Pshare:1,mod:i+1}));
 const p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Firing heat source',hp:1e6,len:100,width:40,height:20,D:0,shieldBuffer:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:1000,accel:100,turnRate:.1,modules,sw,energyModel:{version:1,eta:.75},grid:{P:3.6e24,Pgen:3.6e24,fixed:0,cooling:0,De:0,Ds:0,Dw:0,domains:[{id:'main',P:3.6e24,modules:[0,1,2]}]}};
 const u=C.fleetUnit('source','source',p);u.pos=[0,0,0];u.team=0;u.yaw=0;return u;
}
function target(id,pos,team=1){const p={name:id,hp:1e12,len:1000,width:200,height:200,D:0,shieldBuffer:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:0,accel:0,turnRate:0,modules:[],grid:{P:0,fixed:0,De:0,Ds:0,Dw:0}};const u=C.fleetUnit(id,id,p);u.pos=pos.slice();u.team=team;return u;}
const step=(u,dt,all)=>C.superweaponStep(u,dt,{foes:all.filter(t=>t.team!==u.team),all,bolts:[],ctx,damage:1,inc:()=>C.combatIncoming()});
test('a beam step sends out 98% of the energy it spends and leaves 2% in the ship',()=>{
 assert.equal(C.HEAT.swShot,.02);const u=source(),t=target('on-axis',[10000,0,0]);assert.equal(C.superweaponCommand(u,{indexes:[0]}).queued,1);
 const shots=step(u,.25,[u,t]);assert.equal(shots.length,1);const spent=125000*.25/10;/* a quarter second of a ten-second, 125 PT beam, in TT */
 near(shots[0].energyTT,spent*.98);const l=u.weaponLedger;near(l.emittedJ,spent*.98*C.TT);near(l.initialJ+l.inputJ,l.storedJ+l.emittedJ+l.lossJ+l.releasedJ);
 near(l.initialJ-l.storedJ-l.emittedJ-l.releasedJ+l.inputJ,l.lossJ);assert.ok(l.lossJ>=spent*.02*C.TT*(1-1e-9),`the loss ${l.lossJ} holds at least the 2% of the shot`);
});
test('an AI ship with no room for the firing heat holds its shot; an explicit order fires',()=>{
 const u=source(),t=target('on-axis',[10000,0,0]);assert.equal(step(u,.25,[u,t]).length,0,'held: the heat store of this ship cannot take the loss');assert.ok(u.sw.every(x=>x.st==='ready'));
 C.superweaponCommand(u,{indexes:[0]});const shots=step(u,.25,[u,t]);assert.equal(shots.length,1);assert.equal(shots[0].i,0);assert.equal(u.sw[1].st,'ready','the other beam was not ordered');
});
test('with the hold switched off the same AI ship fires',()=>{
 const keep=C.HEAT.swInterlock;C.HEAT.swInterlock=false;try{const u=source(),t=target('on-axis',[10000,0,0]);assert.equal(step(u,.25,[u,t]).length,2);}finally{C.HEAT.swInterlock=keep;}
});
// Physics review 2026-11-15.
test('a whole ten-second beam sends out 98% of the weapon\'s charge and empties its store',()=>{
 const u=source(),t=target('on-axis',[10000,0,0]);C.superweaponCommand(u,{indexes:[0]});let out=0;for(let i=0;i<40;i++)for(const sh of step(u,.25,[u,t]))out+=sh.energyTT;
 near(out,125000*.98);near(u.sw[0].storedJ,0);assert.equal(u.sw[0].st,'cool');const l=u.weaponLedger;near(l.emittedJ,125000*.98*C.TT);near(l.initialJ+l.inputJ,l.storedJ+l.emittedJ+l.lossJ+l.releasedJ);
});
function station(){
 const E=C.SW_COMBAT.slaser.E,modules=[{k:'reactor',part:1,size:100,share:1,at:.5,domain:'main'},{k:'superweapon',name:'superlaser',part:101,size:1,share:.5,at:.8,domain:'main',powerConnected:true}];
 const sw=[{id:101,k:'slaser',aim:'bow',axis:[1,0,0],mz:[88000,0,0],Emax:E,d:C.SW_COMBAT.slaser.refD,chargeT:86400,chargeW:E*C.TT/(86400*.88),efficiency:.88,initialCharge:1,r:1,rk:'gen',Pshare:1,mod:1}];
 const p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Station',hp:1e12,len:160000,width:160000,height:160000,D:0,shieldBuffer:0,wCap:0,crewNeed:0,crewMax:0,maxSpeed:0,accel:0,turnRate:.01,modules,sw,energyModel:{version:1,eta:.75},grid:{P:1e31,Pgen:1e31,fixed:0,cooling:0,De:0,Ds:0,Dw:0,domains:[{id:'main',P:1e31,modules:[0,1]}]}};
 const u=C.fleetUnit('station','station',p);u.pos=[0,0,0];u.team=0;u.yaw=0;return u;
}
test('a superlaser\'s ship shot spends 2 of its 53 ZT, 98% of that as the beam, and keeps the rest of its charge through the cool-down',()=>{
 const u=station(),w=u.p.sw[0],x=u.sw[0],E=C.swEnergyTT(w),shot=C.swShipShotTT(w),t=target('ship',[400000,0,0]);near(shot,E*2/53);assert.equal(C.superweaponCommand(u,{indexes:[0]}).queued,1);
 let out=0,slices=[];for(let i=0;i<24&&x.st!=='cool';i++)for(const sh of step(u,.25,[u,t])){out+=sh.energyTT;slices.push(sh.energyTT);}
 assert.equal(x.st,'cool');near(out,shot*.98,1e-6);near(x.storedJ,(E-shot)*C.TT,1e-6);
 const even=shot*.98/24;assert.ok(Math.max(...slices)<=even*1.001,`no slice larger than the even share: ${Math.max(...slices)} against ${even}`);
 // through the cool-down the charge reads what the store holds, and charging never fills past the capacity
 C.swCoolDone(u,w,x);assert.equal(x.st,'charge');near(x.c,51/53,1e-6);
 const need=E*C.TT-x.storedJ,rated=w.chargeW*w.efficiency;near(need/rated,86400*2/53,1e-6);/* about 54 minutes at the rated charging power */
 x.storedJ=E*C.TT*.9999;x.c=.9999;C.superweaponCharge(u,0,1e6,null);assert.ok(x.storedJ<=E*C.TT*(1+1e-12),'the store is never above the capacity');
});
