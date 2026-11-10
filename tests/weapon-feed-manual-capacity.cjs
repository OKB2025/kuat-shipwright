const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-9,`${a} != ${b}`);
function fixture(){
 const ship=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Finite weapon wiring');ship.armor={hull:.01,cit:0};ship.surfaces=C.normalizeSurfaces({mode:'strict',compatAllowed:false,legacyArmor:.01});ship.parts=[];ship.fits=[];
 const source=C.placePart(ship,'gen',[60,60,0],20),hub=C.placePart(ship,'battery',[100,60,0],6);C.placePart(ship,'pump',[60,60,14],4.2,{autoFit:false});
 for(const z of [-35,35]){const f={id:ship.nextId++,k:'single40',p:[180,120,z],a:2,mountMode:'top',ped:0,base:0,low:0,float:false};C.mountFit(ship,f);ship.fits.push(f);}
 C.syncCompartments(ship);
 // The production worker also routes a compiled ship. Keeping this same
 // object lets the cache test isolate a capacity edit from geometry changes.
 const work=C.surfaceWorkingShip(ship);return {ship:work,source,hub,guns:work.fits.slice()};
}
function finiteFixture(left=3e20,right=5e20){const f=fixture();f.ship.links=[{kind:'power',from:'p'+f.source.id,to:'p'+f.hub.id,cap:1e21},...f.guns.map((g,i)=>({kind:'power',from:'p'+f.hub.id,to:'f'+g.id,cap:i?right:left}))];return f;}
const nameplate=gun=>C.fitSpec(gun).power/C.ENERGY_MODEL.eta;
const signature=gun=>{const s=C.fitSpec(gun);return {power:s.power,tt:s.tt,ion:s.ion,barrels:s.barrels,boltTT:s.boltTT,cycle:s.cycle,p:plain(gun.p),a:gun.a};};

test('manual branches retain their real wattage without reserving cable volume or changing either gun',()=>{
 const {ship,guns}=fixture(),before=guns.map(signature),automatic=C.feedConduits(ship);near(automatic.demand,guns.reduce((n,g)=>n+nameplate(g),0));near(automatic.volume,0);assert.equal(automatic.routed,false);assert.equal(automatic.h,undefined);
 ship.links=guns.map((g,i)=>({kind:'power',from:'p2',to:'f'+g.id,cap:i?5e20:3e20}));const limited=C.feedConduits(ship);near(limited.demand,8e20);near(limited.volume,0);near(limited.rows.find(w=>w.id===guns[0].id).P,3e20);near(limited.rows.find(w=>w.id===guns[1].id).P,5e20);assert.deepEqual(guns.map(signature),before);
 const stats=C.computeStats(ship);near(stats.feedDemand,8e20);near(stats.feedVolume,limited.volume);assert.ok(stats.habitableVolume>0);for(const g of guns){assert.equal(g.float,false);assert.ok(stats.chargeInfo[g.id].ratio>1-1e-6,'the real gun retains its full physical firing charge');}
});
test('editing a branch capacity invalidates the numerical cache without building a hull grid',()=>{
 const {ship}=finiteFixture(),first=C.feedConduits(ship);assert.equal(C.feedConduits(ship),first);ship.links[1].cap=1e20;const second=C.feedConduits(ship);assert.notEqual(second,first);assert.equal(second.h,undefined);near(second.demand,6e20);near(second.volume,0);assert.equal(C.feedConduits(ship),second);
});
test('all finite incoming routes add their capacities and never exceed the gun nameplate',()=>{
 const {ship,source,guns}=finiteFixture();ship.links.push({kind:'power',from:'p'+source.id,to:'f'+guns[0].id,cap:2e20});let feed=C.feedConduits(ship);near(feed.rows.find(w=>w.id===guns[0].id).P,5e20);near(feed.demand,1e21);
 ship.links[1].cap=nameplate(guns[0])*2;feed=C.feedConduits(ship);near(feed.rows.find(w=>w.id===guns[0].id).P,nameplate(guns[0]));
});
test('automatic and uncapped manual feeds retain full strict-mode nameplate wiring',()=>{
 const {ship,guns,hub}=fixture(),automatic=C.feedConduits(ship),expected=guns.reduce((n,g)=>n+nameplate(g),0);near(automatic.demand,expected);
 ship.links=guns.map(g=>({kind:'power',from:'p'+hub.id,to:'f'+g.id}));const uncapped=C.feedConduits(ship);near(uncapped.demand,expected);near(uncapped.volume,automatic.volume);
 ship.links.push({kind:'power',from:'p1',to:'f'+guns[0].id,cap:1});const mixed=C.feedConduits(ship);near(mixed.rows.find(w=>w.id===guns[0].id).P,nameplate(guns[0]));near(mixed.demand,expected);
});
test('zero-capacity manual gun feeds reserve no wire demand or conduit volume',()=>{
 const {ship,guns}=finiteFixture(0,0),before=guns.map(signature),feed=C.feedConduits(ship);near(feed.demand,0);near(feed.volume,0);near(feed.branchVolume,0);near(feed.chargeVolume,0);assert.equal(feed.rows.length,0);assert.deepEqual(guns.map(signature),before);
});
test('the real finite branch graph retains fixed-load priority and cannot create power for the guns',()=>{
 const {ship,source,hub,guns}=finiteFixture(),feed=C.feedConduits(ship),stats=C.computeStats(ship),loads=[{id:'fixed',kind:'fixed',port:'p'+hub.id,requestedInputW:4e20},...guns.map(g=>({id:'weapon:'+g.id,kind:'weapons',port:'f'+g.id,requestedInputW:nameplate(g)}))],result=C.allocateConnectedPower({sources:[{id:'p'+source.id,powerW:C.reactorPower(source)}],links:stats.heat.powerPaths,loads,mode:'weapons'});
 near(result.granted.fixed,4e20);const trunk=stats.heat.powerPaths.find(l=>l.from==='p'+source.id&&l.to==='p'+hub.id),branches=guns.map(g=>stats.heat.powerPaths.find(l=>l.to==='f'+g.id&&!l.auto));const eta=branches[0].efficiency;assert.ok(eta<1);near(branches[1].efficiency,eta);near(result.weapons,(1e21*trunk.efficiency-4e20)*eta);near(result.draw,result.delivered+result.feedLossW);near(result.draw,1e21);assert.ok(result.weapons<=feed.demand);for(let i=0;i<guns.length;i++){const amount=result.granted['weapon:'+guns[i].id];assert.ok(amount>0&&amount<=(i?5e20:3e20)*(1+1e-9));}assert.ok(result.draw<C.reactorPower(source));assert.ok(stats.heat.powerPaths.filter(l=>!l.auto&&l.to.startsWith('f')).every(l=>Number.isFinite(l.cap)));
});
