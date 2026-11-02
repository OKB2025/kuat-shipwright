const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,R}=vm.runInContext('({C:Core,R:Rts})',cx),plain=x=>JSON.parse(JSON.stringify(x)),TT=4.184e21,close=(a,b,k=1e-9)=>assert.ok(Math.abs(a-b)<=k*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`),ctx={time:0,damage:1,rand:()=>.9,ev(){},sunk(){},out(){}};
function unit(independent=false){
 const modules=[{k:'reactor',part:1,size:90,share:.9,at:.3,domain:'main'},{k:'reactor',part:2,size:10,share:.1,at:.7,domain:independent?'emergency':'main'},{k:'weapon',fit:3,size:1,share:.5,at:.2,domain:'main',powerConnected:true},{k:'weapon',fit:4,size:1,share:.5,at:.8,domain:independent?'emergency':'main',powerConnected:true},{k:'engine',part:5,size:1,share:1,at:.1,domain:'main',powerConnected:true},{k:'shield',part:6,size:1,share:1,at:.4,domain:'main',powerConnected:true}];
 const p={name:'Grid test',hp:100000,len:100,width:40,height:20,armorHull:0,D:0,shieldBuffer:1000,reserve:50,wCap:100,crewNeed:0,maxSpeed:1000,accel:100,turnRate:.1,gunArcs:[10,10,10,10,10,10],ionArcs:[0,0,0,0,0,0],modules,energyModel:{version:1,eta:.75},grid:{P:TT*100,Paux:TT*90,fixed:TT,De:TT*10,Ds:TT*10,Dw:TT*10,domains:independent?[{id:'main',P:TT*90,modules:[0,2,4,5]},{id:'emergency',P:TT*10,modules:[1,3]}]:[{id:'main',P:TT*100,modules:modules.map((_,i)=>i)}]}};
 const u=C.fleetUnit('u','grid',p);u.pos=[0,0,0];return u;
}

test('explicit energy conversion conserves input, output and losses while effect indices stay unconverted',()=>{
 const e=C.weaponEnergy({efficiency:.8},3,8);close(e.inputJ,e.outputJ+e.lossJ);close(e.outputJ,24*TT);close(e.inputJ,30*TT);assert.equal(e.unit,'energy');
 const old=C.weaponEnergy({energyUnit:'effect'},60);assert.equal(old.outputJ,null);assert.equal(old.inputJ,null);assert.equal(old.outputEffect,60);
});

test('a shield blocks ion with low onboard heat, finite defence and a conserved transient ledger',()=>{
 const ion=unit(),beam=unit(),i=C.shieldReceive(ion,{energy:100,ion:100}),b=C.shieldReceive(beam,{energy:100,ion:0});
 assert.equal(i.leaked,0);assert.ok(i.onboardHeat<b.onboardHeat/10);close(i.incoming,i.external+i.storedDelta+i.onboardHeat+i.leaked);
 assert.equal(ion.shield,900);assert.equal(C.powerStatus(ion).local.length,0);
 for(let n=0;n<30;n++){ion.shield=1000;C.shieldReceive(ion,{energy:1000,ion:1000});}
 assert.ok(ion.lastShieldHit.leaked>0,'finite transient acceptance eventually leaks even if defence is externally replenished');
 const before=ion.shieldTransient;C.powerTick(ion,2,ctx);assert.ok(ion.shieldTransient<before);const l=ion.shieldLedger;close(l.incoming,l.external+l.heat+l.leaked+l.stored);
});

test('ordinary leaked ion trips only its struck connected device and restarts without repairing physical damage',()=>{
 const u=unit(),health=plain(u.mods),r=C.ionOverload(u,2,{moduleIndex:2},ctx);assert.equal(r.scope,'local');assert.equal(C.powerFactor(u,'weapon',2),0);assert.equal(C.powerFactor(u,'weapon',3),1);assert.equal(C.powerFactor(u,'reactor'),1);assert.equal(u.down,null);assert.deepEqual(plain(u.mods),health);
 C.powerTick(u,30,ctx);assert.equal(C.powerFactor(u,'weapon',2),1);assert.deepEqual(plain(u.mods),health);const l=u.ionLedger;close(l.incoming,l.external+l.heat+l.stored);
});

test('large common-grid overload stops connected auxiliary reactors regardless of their capacity share',()=>{
 const u=unit();u.p.grid.Paux=u.p.grid.P*.99;C.ionOverload(u,1000,{moduleIndex:2},ctx);assert.equal(C.powerStatus(u).blackout,true);assert.equal(C.powerFactor(u,'reactor',0),0);assert.equal(C.powerFactor(u,'reactor',1),0);assert.equal(u.down.black,true);assert.equal(u.dead,false);assert.equal(u.out,null);
 const health=plain(u.mods),s=C.fleetSystems(u),f=C.fleetPowerStep(u,s,null,10,.25);assert.equal(f,0);assert.equal(u.engF,0);assert.equal(u.shF,0);assert.equal(u.pw.P,0);assert.deepEqual(plain(u.mods),health);
 C.powerTick(u,181,ctx);assert.equal(C.powerStatus(u).blackout,false);assert.equal(C.powerFactor(u,'engine'),1);assert.deepEqual(plain(u.mods),health);
});

test('an isolated emergency domain survives another grid trip and an empty domain cannot borrow its power',()=>{
 const u=unit(true);C.ionOverload(u,1000,{moduleIndex:2},ctx);assert.equal(C.powerFactor(u,'weapon',2),0);assert.equal(C.powerFactor(u,'weapon',3),1);close(C.powerFactor(u,'reactor'),.1);assert.equal(C.powerStatus(u).blackout,false);
 u.p.grid.domains[1].P=0;assert.equal(C.powerFactor(u,'weapon',3),0);
});

test('a blackout stops new steering and firing while a real fleet ship retains its inertial velocity',()=>{
 const u=unit(),enemy=unit();enemy.id='foe';enemy.team=1;enemy.pos=[20000,0,0];u.velocity=[100,0,20];u.order={type:'move',point:[0,0,30000],fire:true,power:'auto'};const v=plain(u.velocity),yaw=u.yaw;
 C.ionOverload(u,1000,{moduleIndex:2},ctx);const b=C.fleetBattle([u,enemy]);C.fleetTick(b,.25);assert.deepEqual(plain(u.velocity),v);assert.equal(u.yaw,yaw);close(u.pos[0],25);close(u.pos[2],5);assert.equal(u.firingAt,enemy.id);assert.equal(u.energy,100);
});

test('strict superweapon charging is bounded by actual input, efficiency and the intact connected reactor',()=>{
 const u=unit();u.p.sw=[{k:'hion',Emax:100,chargeT:10,chargeW:10*TT,efficiency:.8,r:1,mod:2}];u.sw=[{c:0,st:'charge'}];const out=C.superweaponCharge(u,0,2);close(out,16*TT);close(u.sw[0].c,.16);close(u.weaponLedger.inputJ,u.weaponLedger.lossJ+u.weaponLedger.storedJ);
 C.ionOverload(u,1000,{moduleIndex:2},ctx);const c=u.sw[0].c;assert.equal(C.superweaponCharge(u,0,2),0);assert.equal(u.sw[0].c,c);
});

test('a real partially charged ion shot spends only its stored output even with a gameplay damage multiplier',()=>{
 const u=unit();u.manual=true;u.p.sw=[{k:'hion',aim:'bow',mz:[0,0,0],Emax:1000,d:100,chargeT:100,chargeW:10*TT,efficiency:.8,r:1,mod:2}];u.sw=[{c:.2,st:'charge',fireNow:{free:true},mode:'beam'}];const bolts=[],shots=C.superweaponStep(u,0,{foes:[],all:[],bolts,ctx,damage:10,sys:C.fleetSystems(u),inc:()=>null});
 assert.equal(shots.length,1);assert.equal(bolts.length,1);close(bolts[0].E,200);close(u.weaponLedger.emittedJ,200*TT);close(u.weaponLedger.initialJ+u.weaponLedger.inputJ,u.weaponLedger.storedJ+u.weaponLedger.emittedJ+u.weaponLedger.lossJ+u.weaponLedger.releasedJ);
});

test('a charged ready superweapon cannot fire through a protective blackout and does not erase its charge',()=>{
 const u=unit();u.manual=true;u.p.sw=[{k:'hion',aim:'bow',Emax:1000,chargeT:100,r:1,mod:2}];u.sw=[{c:1,st:'ready',fireNow:{free:true}}];C.ionOverload(u,1000,{moduleIndex:2},ctx);const bolts=[],shots=C.superweaponStep(u,.25,{foes:[],all:[],bolts,ctx,damage:1,sys:C.fleetSystems(u),inc:()=>null});
 assert.equal(shots.length,0);assert.equal(bolts.length,0);assert.equal(u.sw[0].c,1);close(u.weaponLedger.storedJ,1000*TT);assert.equal(u.weaponLedger.emittedJ,0);
});

test('an isolated surviving source contributes its actual share without applying physical damage twice',()=>{
 const u=unit(true);u.mods[0]=0;const s=C.fleetSystems(u);C.fleetPowerStep(u,s,null,0,.25);close(s.reactor,.1);close(C.powerFactor(u,'reactor'),1);close(u.pw.P,u.p.grid.P*.1);
});

test('strict cooling uses real powered devices and exposes electronic and hyperdrive connections',()=>{
 const ship=C.newShip({L:100,W:80,H:40,plan:'rect',sec:'rect'},'Strict heat');ship.parts=[{id:1,k:'gen',d:8,c:[20,20,0]},{id:2,k:'hdis',d:3,c:[65,20,0]},{id:3,k:'sensor',d:2,c:[45,20,0]},{id:4,k:'hyper',d:2,c:[80,20,0]}];ship.fits=[];ship.nextId=5;ship.surfaces={version:1,mode:'strict',patches:[]};
 const S=C.computeStats(ship),p=C.fleetProfile(S,ship.name,ship),u=C.fleetUnit('heat','heat',p);assert.equal(S.heat.builtin,0);assert.equal(S.heat.legacy,0);assert.ok(S.draw.dissipators>0);
 for(const id of [2,3,4])assert.ok(S.heat.powerPaths.some(l=>l.to==='p'+id&&l.ok),'actual device power path '+id);
 const sensor=p.modules.findIndex(m=>m.part===3),hyper=p.modules.findIndex(m=>m.part===4);assert.equal(p.modules[sensor].k,'sensor');assert.equal(C.powerFactor(u,'sensor',sensor),1);assert.equal(C.powerFactor(u,'hyper',hyper),1);
 p.modules[sensor].powerConnected=false;p.modules[hyper].powerConnected=false;assert.equal(C.powerFactor(u,'sensor'),0);assert.equal(C.powerFactor(u,'hyper'),0);
 ship.parts.find(q=>q.id===2).powerDomain='isolated-empty';const isolated=C.computeStats(ship);assert.equal(isolated.heat.dis.find(d=>d.id===2).cap,0,'an unconnected cooler cannot use the main generator');
});

test('pulse traversal is ordered by distance and never duplicates a finite shot across targets',()=>{
 const units=[1,2,3].map(n=>{const t=unit();t.id='t'+n;t.pos=[n*3000,0,0];return t;}),make=()=>({id:'pulse',from:'source',o:[0,0,0],dir:[1,0,0],x:0,E:1000000,E0:1000000,d:100,hit:[]}),a=make(),b=make();
 C.ionBoltsStep([a],units.slice().reverse(),4,ctx);C.ionBoltsStep([b],units,4,ctx);assert.deepEqual(plain(a.log),plain(b.log));assert.deepEqual(plain(a.log.map(h=>h.id)),['t1','t2','t3']);assert.ok(a.log.reduce((n,h)=>n+h.E,0)<=a.E0);close(a.E0,a.E+a.log.reduce((n,h)=>n+h.E,0));
});

function coolingFixture(stored=0){
 const u=unit();u.p.grid={P:1000,fixed:10,cooling:10,De:0,Ds:0,Dw:0,domains:[{id:'main',P:1000,sources:[{moduleIndex:0,P:1000}],modules:[0]}]};u.p.wCap=0;u.energy=0;
 const source=(k,m)=>({k,n:k,g:k==='hotel'?'low':'high',sh:1,st:1000,m,pc:[],sec:-1,sw:-1,gen:-1});
 u.p.heat={v:1,src:[source('hotel',[]),source('reactor',[0])],dis:[{n:'Powered cooler',k:'hdis',g:'high',cap:1000,power:10,m:-1,sec:-1,src:-1}],ln:[{s:0,d:0,cap:1000,sec:-1},{s:1,d:0,cap:1000,sec:-1}]};
 C.heatInit(u);u.ht.t=0;u.ht.last=0;u.ht.st[0]=stored;return u;
}

test('an idle installed cooler reserves finite startup power without drawing it or creating heat and emission',()=>{
 const u=coolingFixture();C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);assert.equal(u.pw.coolingReserved,10);assert.equal(u.pw.drawNonCooling,0);assert.equal(u.ht.e.hotel,0);C.heatTick({...ctx,time:1},u,1);
 assert.equal(u.ht.emit,0);assert.equal(u.ht.cooling.inputJ,0);assert.equal(u.ht.cooling.lastDraw,0);assert.ok(u.ht.st.every(v=>v===0));
});

test('a cold cooler starts from reserved power and conserves processed heat, actual operation input and reactor loss',()=>{
 const u=coolingFixture(100);C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);C.heatTick({...ctx,time:1},u,1);const c=u.ht.cooling;
 assert.ok(u.ht.emit>0,'zero previous electric draw must not deadlock startup');assert.ok(c.inputJ>0&&c.inputJ<c.reservedJ);close(c.inputJ,c.heatJ);close(100+c.heatJ+c.reactorWasteJ,u.ht.st.reduce((a,v)=>a+v,0)+c.handledJ);close(c.lastDraw,c.inputJ);close(u.pw.cooling,c.inputJ);
 const off=coolingFixture(100);off.p.grid.P=0;C.fleetPowerStep(off,C.fleetSystems(off),null,0,1);C.heatTick({...ctx,time:1},off,1);assert.equal(off.ht.emit,0);assert.equal(off.ht.cooling.inputJ,0);close(off.ht.st[0],100);
});
