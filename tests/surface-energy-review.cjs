const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,D}=vm.runInContext('({C:Core,D:YardFleetData.designs})',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,message)=>assert.ok(Math.abs(a-b)<=Math.max(1e-9,Math.abs(b)*1e-9),`${message}: ${a} vs ${b}`);
// Use the real fleet clock with a measured baseline profile, replacing only its
// two mounts and electrical connections to isolate the energy being tested.
function battle(salvo=false){
 const p=plain(D.cr90.p);p.grid={P:100*C.TT,fixed:0,Dw:0,Ds:0,De:0,domains:[{id:'main',P:100*C.TT,modules:[0,1]}]};
 p.modules=[0,1].map((_,i)=>({k:'weapon',fit:101+i,domain:'main',powerConnected:true,name:i?'Ion':'Laser',share:.5,size:1,hits:1,w:1,at:.5,y:0,z:0}));
 Object.assign(p,{crewNeed:0,crewMax:0,autoCrew:0,acc:1,aa:0,aaArcs:[0,0,0,0,0,0],msl:0,imsl:0,slots:0,wCap:20,heat:{v:1,src:[],dis:[],ln:[]},energyModel:{version:1,eta:.75}});
 p.surface={patches:[],shell:[],devices:[],mounts:[0,1].map((_,i)=>({id:101+i,module:i,patch:null,arcs:[1,1,1,1,1,1],gun:i?0:1,ion:i?1:0,capacity:10,power:C.TT,barrels:1,crewNeed:0,cycle:1,band:'mid'}))};
 const a=C.fleetUnit('a','a',p,0),q=plain(p);delete q.surface;q.modules=[];q.gunArcs=q.ionArcs=[0,0,0,0,0,0];q.gunBands={long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]};q.shieldBuffer=1e9;q.hp=1e9;
 const z=C.fleetUnit('z','z',q,1);a.pos=[0,0,0];z.pos=[5000,0,0];a.order={type:'hold',fire:true,power:'balanced',volley:salvo?'salvo':'stream',aim:'auto'};z.order={type:'hold',fire:false,power:'balanced'};
 a.surfaceBanks={101:0,102:10};a.energy=10;return {a,z,b:C.fleetBattle([a,z],true)};
}

test('an empty laser bank cannot borrow ion energy or change the damage type in the real fleet clock',()=>{
 const f=battle(),shots=C.fleetTick(f.b,.25,{collide:false});assert.ok(shots.some(s=>s.from==='a'&&s.gun>0));
 assert.equal(f.a.surfaceBanks[101],0);near(10-f.a.surfaceBanks[102],f.a.surfaceLastFire.spent,'only the ion cell pays');
 const hit=f.z.lastShieldHit;assert.ok(hit?.incoming>0);near(hit.onboardHeat/hit.incoming,C.SHIELD_MODEL.ionHeat,'the shield must receive ion-only fire');
 assert.equal(shots.find(s=>s.from==='a').ion,true);
});

test('a strict salvo cannot emit more energy than its actual cell banks spent',()=>{
 const f=battle(true),before=f.a.energy,shots=C.fleetTick(f.b,.25,{collide:false}),spent=before-f.a.energy,emitted=shots.filter(s=>s.from==='a').reduce((n,s)=>n+s.gun,0);
 assert.ok(emitted>0,'the ready salvo must actually fire');assert.ok(emitted<=spent+1e-9,`emitted ${emitted} TT from ${spent} TT of cell charge`);
});

test('salvo cooldown retains its cell charge while no shot is emitted',()=>{
 const f=battle(true);C.fleetTick(f.b,.25,{collide:false});const before=f.a.energy,shots=C.fleetTick(f.b,.25,{collide:false});
 assert.equal(shots.filter(s=>s.from==='a').length,0);near(f.a.energy,before,'no firing and no charging cannot consume a bank');
});

function pulse(dt,reverse=false){
 const p=plain(D.cr90.p);Object.assign(p,{len:100,width:100,height:100,shieldBuffer:0,reserve:0,heat:{v:1,src:[],dis:[],ln:[]},energyModel:{version:1,eta:.75}});
 const units=[500,1500,3000,4500].map((x,i)=>{const t=C.fleetUnit('target-'+i,'target',p,1);t.pos=[x,0,0];return t;});
 const b={from:'source',o:[0,0,0],dir:[1,0,0],x:0,E:1e6,E0:1e6,d:310.8,hit:[],age:0},bolts=[b],ctx={ev:()=>{},rand:()=>.5};
 for(let i=0;i<Math.round(2/dt);i++)C.ionBoltsStep(bolts,reverse?units.slice().reverse():units,dt,ctx,new Map());
 const received=units.map(u=>u.shieldLedger?.incoming||0);return {received,left:b.E,hit:b.hit};
}
test('a widening pulse conserves one energy budget across four ships, coarse ticks and reversed unit order',()=>{
 const fine=pulse(.125),coarse=pulse(2),reversed=pulse(2,true);assert.equal(fine.hit.length,4);
 for(let i=0;i<4;i++){assert.ok(fine.received[i]>0);near(coarse.received[i],fine.received[i],'coarse pulse crossing '+i);near(reversed.received[i],fine.received[i],'unit list order '+i);}
 for(const r of [fine,coarse,reversed])near(r.left+r.received.reduce((a,b)=>a+b,0),1e6,'one pulse budget');
});

test('a hit on an electrically disconnected gun does not inject overload into its nominal main grid',()=>{
 const f=battle(),u=f.a;u.p.modules[0].powerConnected=false;const before=C.powerFactor(u,'reactor');
 C.ionOverload(u,1e8,{fitId:101},{ev:()=>{}});
 assert.equal(C.powerFactor(u,'reactor'),before);assert.ok(!(u.gridState?.domains?.main?.trip>0),'an unconnected gun cannot trip the main source');
});

test('calculating a tactical turn preview cannot consume live cell charge or advance its protection state',()=>{
 const f=battle();f.a.gridState={domains:{main:{load:1,trip:0}},local:{}};f.a.surfaceArmor={sample:{integrity:.8,load:2,at:0}};f.b.seconds=5;
 const before=plain({banks:f.a.surfaceBanks,grid:f.a.gridState,armor:f.a.surfaceArmor});
 assert.ok(C.fleetCommit(f.b));
 assert.deepEqual(plain({banks:f.a.surfaceBanks,grid:f.a.gridState,armor:f.a.surfaceArmor}),before,'preview must own separate mutable system state');
 const preview=f.b.last.units.find(u=>u.id===f.a.id);assert.notEqual(preview.surfaceBanks,f.a.surfaceBanks);assert.notEqual(preview.gridState,f.a.gridState);assert.notEqual(preview.surfaceArmor,f.a.surfaceArmor);
});

test('strict sensor, hyperdrive and electronic consumers obey an explicit disconnected power path',()=>{
 for(const kind of ['sensor','hyper','automation','bridge']){
  const u={p:{grid:{P:C.TT,domains:[{id:'main',P:C.TT,modules:[0]}]},energyModel:{version:1},modules:[{k:kind,domain:'main',powerConnected:false,size:1}]},mods:[1]};
  assert.equal(C.powerFactor(u,kind,0),0,kind+' indexed connection');assert.equal(C.powerFactor(u,kind),0,kind+' aggregate connection');
 }
});

test('an isolated surviving reactor cannot power or charge a gun whose own source was physically destroyed',()=>{
 const f=battle(),u=f.a;u.p.grid={P:100*C.TT,fixed:0,Dw:100*C.TT,Ds:0,De:0,domains:[{id:'main',P:90*C.TT,modules:[0,2]},{id:'emergency',P:10*C.TT,modules:[1,3]}]};
 u.p.modules=[{k:'reactor',part:1,domain:'main',size:90,share:.9},{k:'reactor',part:2,domain:'emergency',size:10,share:.1},{k:'weapon',fit:101,domain:'main',powerConnected:true,size:1,share:.5},{k:'weapon',fit:102,domain:'emergency',powerConnected:true,size:1,share:.5}];
 u.p.surface.mounts[0].module=2;u.p.surface.mounts[1].module=3;u.mods=[0,1,1,1];u.surfaceBanks={101:0,102:0};u.energy=0;
 assert.equal(C.powerFactor(u,'weapon',2),0,'the main gun has no surviving source');assert.ok(C.powerFactor(u,'weapon',3)>0,'emergency gun retains its independent source');
 C.surfaceManualCharge(u,10*C.TT,1);assert.equal(u.surfaceBanks[101],0);assert.ok(u.surfaceBanks[102]>0);
});

test('an in-flight ion pulse is isolated during preview and survives the committed tactical turn',()=>{
 const f=battle();f.a.order.fire=false;f.z.pos=[50000,0,0];f.b.seconds=5;
 f.b.ionBolts=[{id:'travelling',from:f.a.id,o:[0,0,0],dir:[1,0,0],x:0,E:1e9,E0:1e9,d:310.8,hit:[],age:0}];const original=plain(f.b.ionBolts),preview=C.fleetCommit(f.b);
 assert.deepEqual(plain(f.b.ionBolts),original,'calculating the turn must not advance the live pulse');
 assert.equal(preview.ionBolts?.length,1);assert.ok(preview.ionBolts[0].x>0);const x=preview.ionBolts[0].x;
 assert.equal(C.fleetFinish(f.b),true);assert.equal(f.b.ionBolts[0].x,x);
 const next=C.fleetCommit(f.b);assert.equal(f.b.ionBolts[0].x,x);assert.ok(next.ionBolts[0].x>x,'the next preview continues the same physical pulse');
});

test('destroying an internal charging bank preserves its intact native gunhouse and releases only excess storage once',()=>{
 const s=C.newShip({L:240,W:120,H:60,plan:'rect',sec:'rect'},'Native charging dependency');s.parts=[{id:1,k:'gen',c:[30,15,0],d:20},{id:2,k:'fuel',c:[60,15,0],d:4},{id:3,k:'pump',c:[30,15,14],d:4.2}];s.fits=[];s.nextId=4;C.enableSurfaceMode(s,true);
 const placed=C.placeFit(s,'twin40',[140,60,0],[0,1,0],0,false,{chargeSalvos:20});assert.ok(placed.fit,placed.err);const gun=placed.fit;gun.chargeSalvos=20;
 const stats=C.computeStats(s),p=C.fleetProfile(stats,s.name,s),u=C.fleetUnit('charged','charged',p),mount=p.surface.mounts.find(m=>m.id===gun.id),capacitor=p.modules.findIndex(m=>m.k==='capacitor'&&m.link===mount.module);
 assert.ok(mount&&capacitor>=0,'the actual native turret must own a real additional charging bank');assert.ok(mount.housingCapacity>=mount.boltTT,'the intact real gunhouse can store at least one shot');const opening=C.surfaceMountEnergy(u,mount.id);assert.ok(opening>mount.housingCapacity,'the extra internal bank holds actual additional stored energy');assert.equal(u.mods[mount.module],1);
 u.mods[capacitor]=0;C.surfaceManualCharge(u,0,.25);const remaining=C.surfaceMountEnergy(u,mount.id),released=opening-remaining;near(remaining,mount.housingCapacity,'the undamaged housing keeps its actual capacity');assert.equal(u.mods[mount.module],1,'the native gun survives destruction of its separate storage');near(u.surfaceReleasedTT,released,'only the lost storage energy is released');near(u.ht.e.weapon,released*C.TT,'the release enters the existing weapon heat store');const heat=u.ht.e.weapon;
 assert.ok(C.shipElectricalAvailableW(u)>0,'the powered gunhouse has installed reactor fuel');const fired=C.surfaceSpend(u,mount.id,mount.boltTT);assert.equal(fired.ok,true,'the intact gun remains operable using its paid gunhouse energy');near(C.surfaceMountEnergy(u,mount.id),remaining-mount.boltTT,'the surviving housing pays for the actual shot');near(opening,released+fired.spent+C.surfaceMountEnergy(u,mount.id),'no energy is created or discarded');
 C.surfaceManualCharge(u,0,.25);near(u.ht.e.weapon,heat,'the same destroyed bank must not release energy twice');near(u.surfaceReleasedTT,released,'one physical release');near(C.surfaceMountEnergy(u,mount.id),remaining-fired.spent,'there is no free recharge');
});
