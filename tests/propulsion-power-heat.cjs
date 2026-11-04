const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
const near=(got,want,msg)=>assert.ok(Number.isFinite(got)&&Math.abs(got-want)<=Math.max(1,Math.abs(want))*1e-10,`${msg||'value'}: ${got} != ${want}`);
const source=(id,powerW,domain='main')=>({id,domain,powerW});
const load=(id,requestedInputW,kind='engines',domain='main',port=id)=>({id,kind,domain,port,requestedInputW});
const total=r=>Object.values(r.granted).reduce((n,x)=>n+x,0);

test('ENG-T05 shared reactor is spent once across propulsion and other equipment',()=>{
 const r=C.allocateConnectedPower({sources:[source('r',100)],loads:[load('e1',80),load('e2',80),load('hotel',10,'fixed'),load('shield',20,'shields'),load('weapons',30,'weapons'),load('cooling',10,'cooling')],mode:'balanced'});
 near(total(r),r.draw,'sum of grants');assert.ok(r.draw<=100+1e-8);assert.ok(r.granted.e1+r.granted.e2<160);assert.ok(r.granted.hotel>0);
 for(const [id,request]of Object.entries({e1:80,e2:80,hotel:10,shield:20,weapons:30,cooling:10}))assert.ok(r.granted[id]>=0&&r.granted[id]<=request+1e-8,id+' request bound');
});

test('ENG-T06 one shared trunk limits the sum of its downstream engines',()=>{
 const r=C.allocateConnectedPower({sources:[source('r',100)],links:[{from:'r',to:'bus',cap:40,ok:true},{from:'bus',to:'e1',cap:100,ok:true},{from:'bus',to:'e2',cap:100,ok:true}],loads:[load('e1',100),load('e2',100)],mode:'balanced'});
 near(r.draw,40,'trunk draw');near(r.granted.e1+r.granted.e2,40,'downstream total');
});

test('ENG-T07 disconnected reactor surplus and severed trunks cannot feed engines',()=>{
 const isolated=C.allocateConnectedPower({sources:[source('r1',30,'one'),source('r2',1000,'two')],loads:[load('e',100,'engines','one')],mode:'balanced'});
 near(isolated.granted.e,30,'same-domain supply');
 const cut=C.allocateConnectedPower({sources:[source('r',100)],links:[{from:'r',to:'e',cap:100,ok:false}],loads:[load('e',100)],mode:'balanced'});
 near(cut.granted.e||0,0,'broken supply link');
});

test('ENG-T08 local engine input reduction leaves another healthy engine available',()=>{
 const r=C.allocateConnectedPower({sources:[source('r',100)],loads:[load('hot',0),load('healthy',100)],mode:'balanced'});
 near(r.granted.hot||0,0);near(r.granted.healthy,100);
});

test('ENG-T10 competing equipment reduces actual propulsion allocation',()=>{
 const solve=other=>C.allocateConnectedPower({sources:[source('r',100)],loads:[load('engine',100),...other],mode:'weapons'});
 const empty=solve([]),busy=solve([load('weapons',70,'weapons'),load('shield',30,'shields')]);
 near(empty.granted.engine,100);assert.ok(busy.granted.engine<empty.granted.engine);assert.ok(total(busy)<=busy.sources.reduce((n,s)=>n+s.availableW,0)+1e-8);
});

test('ENG-T11 cooling uses the same finite source allocation',()=>{
 const r=C.allocateConnectedPower({sources:[source('r',100)],loads:[load('engine',100),load('cooling',25,'cooling')],mode:'balanced'});
 assert.ok(r.granted.cooling>0);assert.ok(r.granted.engine<100);near(total(r),100);
 const starved=C.allocateConnectedPower({sources:[source('r',0)],loads:[load('cooling',25,'cooling')],mode:'balanced'});
 near(starved.granted.cooling||0,0);
});

test('ENG-T20 allocator rejects nonfinite, negative and broken supply values safely',()=>{
 for(const n of [NaN,Infinity,-5]){
  const badSource=C.allocateConnectedPower({sources:[source('r',n)],loads:[load('e',100)],mode:'balanced'});
  near(badSource.granted.e||0,0);assert.ok(Number.isFinite(badSource.draw));
  const badLoad=C.allocateConnectedPower({sources:[source('r',100)],loads:[load('e',n)],mode:'balanced'});
  near(badLoad.granted.e||0,0);assert.ok(Number.isFinite(badLoad.draw));
 }
 const missing=C.allocateConnectedPower({sources:[source('r',100)],links:[{from:'absent',to:'e',cap:100}],loads:[load('e',100)],mode:'balanced'});
 near(missing.granted.e||0,0);
});

function thermalUnit({store=1e20,cooling=0,link=true}={}){
 const R=1e18,engine=(id,moduleIndex)=>({id,machineryId:id,moduleIndex,powerNode:'p'+id,domain:'main',valid:true,available:true,connected:true,outletAvailable:true,ratedInputW:R,ratedThrustN:R/2e9,wattsPerNewton:2e9,direction:[1,0,0],pathCapacityW:R});
 const modules=[{k:'engine',part:1,size:1,share:.5,at:.1,domain:'main',powerConnected:true},{k:'engine',part:2,size:1,share:.5,at:.1,domain:'main',powerConnected:true},{k:'reactor',part:3,size:1,share:1,at:.4,domain:'main',powerConnected:true}];
 const src=(k,m,sh=1)=>({k,n:k+' '+m[0],g:'high',sh,st:store,m,pc:[],sec:-1,sw:-1,gen:-1});
 const p={name:'Local propulsion heat',hp:1e10,len:100,width:40,height:20,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:0,maxSpeed:100,accel:1,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,propulsion:{version:1,engines:[engine(1,0),engine(2,1)],massKg:1e6,ratedThrustN:1e9,ratedAccelMps2:1000,accelerationLimitMps2:1000},grid:{P:4*R,fixed:0,De:2*R,Ds:0,Dw:0,domains:[{id:'main',P:4*R,sources:[{moduleIndex:2,P:4*R}],modules:[0,1,2]}],powerPaths:[{from:'p3',to:'p1',cap:R,ok:true},{from:'p3',to:'p2',cap:R,ok:true}]},heat:{v:1,src:[src('engine',[0],.5),src('engine',[1],.5),src('reactor',[2])],dis:cooling>0?[{n:'passive test sink',k:'integral',g:'high',cap:cooling,m:-1,sec:-1,src:0}]:[],ln:cooling>0?[{s:0,d:0,cap:link?cooling:0,sec:-1}]:[]}};
 const u=C.fleetUnit('local-propulsion','local-propulsion',p,0);u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);u.ht.t=0;u.ht.last=0;return u;
}

test('ENG-T02/03 higher rating requires actual extra connected supply to increase force and heat',()=>{
 const u=thermalUnit(),p=u.p.propulsion;
 const run=(rating,supply)=>{const engines=p.engines.map(e=>({...e,ratedInputW:rating,ratedThrustN:rating/2e9,pathCapacityW:rating})),profile={...p,engines,ratedThrustN:rating/1e9};return C.solveShipPropulsion(profile,{throttle:1,sources:[source('r',supply)],mode:'balanced'});};
 const original=run(1e18,5e17),uprated=run(2e18,5e17),fed=run(2e18,1e18);
 near(original.actualInputW,5e17);near(original.actualThrustN,uprated.actualThrustN,'starved rating upgrade');near(original.wasteHeatW,uprated.wasteHeatW,'unused rating creates no heat');near(fed.actualThrustN,2*original.actualThrustN);near(fed.wasteHeatW,2*original.wasteHeatW);
});

test('ENG-T04/08 local thermal limits reduce watts and newtons without averaging healthy engines',()=>{
 const u=thermalUnit();u.ht.lm[0]=.25;u.ht.lm[1]=1;u.ht.lim.engine=.625;
 C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);
 const rows=u.propulsion.engines;near(rows.find(e=>e.id===1).actualInputW,2.5e17);near(rows.find(e=>e.id===2).actualInputW,1e18);near(u.propulsion.actualThrustN,6.25e8);near(u.propulsion.wasteHeatW,6.25e16);near(u.engF,.625);
 C.heatTick({time:1,ev(){}},u,1);near(u.ht.st[0],1.25e16,'left local heat J');near(u.ht.st[1],5e16,'right local heat J');
});

test('ENG-T07 local protective ion shutdown stops the struck engine only',()=>{
 const u=thermalUnit();u.gridState={domains:{},local:{0:10}};
 C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);
 near(u.propulsion.engines.find(e=>e.id===1).actualInputW,0);near(u.propulsion.engines.find(e=>e.id===2).actualInputW,1e18);
});

test('ENG-T12 damaged heat transport causes limit and stop followed by cooling and restart',()=>{
 const u=thermalUnit({store:1e18,cooling:1e18,link:false});u.ht.st[0]=.9e18;
 C.heatTick({time:1,ev(){}},u,1);assert.ok(u.ht.lm[0]<1&&u.ht.lm[0]>0);near(u.ht.lm[1],1);
 u.ht.st[0]=1.1e18;C.heatTick({time:2,ev(){}},u,1);assert.equal(u.ht.md[0],2);
 C.heatTick({time:12,ev(){}},u,10);assert.equal(u.ht.md[0],3);near(u.ht.lm[0],0);
 u.p.heat.ln[0].cap=1e18;C.heatTick({time:72,ev(){}},u,60);assert.equal(u.ht.md[0],0);near(u.ht.lm[0],1);assert.ok(u.ht.st[0]>=0);
});

test('ENG-T11 additional heat removal preserves cold force and improves sustained powered output',()=>{
 const hot=thermalUnit({store:1e18}),cooled=thermalUnit({store:1e18,cooling:1e18});
 for(const u of [hot,cooled]){u.p.heat.src[2].st=1e30;C.fleetPowerStep(u,C.fleetSystems(u),null,0,.25);}
 near(hot.propulsion.actualThrustN,cooled.propulsion.actualThrustN,'cold instantaneous thrust');
 for(let i=1;i<=120;i++)for(const u of [hot,cooled]){C.fleetPowerStep(u,C.fleetSystems(u),null,0,.25);C.heatTick({time:i*.25,ev(){}},u,.25);}
 const left=u=>u.propulsion.engines.find(e=>e.id===1).actualInputW;
 assert.ok(left(cooled)>left(hot));assert.ok(cooled.ht.st[0]<hot.ht.st[0]);
});

test('ENG-T16 fixed simulation time conserves integrated input and engine heat across tick sizes',()=>{
 const run=dt=>{const u=thermalUnit(),steps=Math.round(4/dt);let inputJ=0;for(let i=0;i<steps;i++){C.fleetPowerStep(u,C.fleetSystems(u),null,0,dt);inputJ+=u.propulsion.actualInputW*dt;C.heatTick({time:(i+1)*dt,ev(){}},u,dt);}return {inputJ,engineHeatJ:u.ht.st[0]+u.ht.st[1]};};
 const fine=run(.125),coarse=run(.5);near(fine.inputJ,coarse.inputJ);near(fine.engineHeatJ,coarse.engineHeatJ);near(fine.engineHeatJ,.05*fine.inputJ);
});

test('ENG-T06/07 shared physical trunk damage and its protective trip limit downstream engines',()=>{
 const make=()=>{const u=thermalUnit();u.p.modules.push({k:'other',part:7,port:'p7',size:1,domain:'main',powerConnected:true});u.mods.push(1);u.p.grid.trunks=[{port:'p7',moduleIndex:3}];u.p.grid.powerPaths=[{from:'p3',to:'p7',cap:2e18,ok:true},{from:'p7',to:'p1',cap:1e18,ok:true},{from:'p7',to:'p2',cap:1e18,ok:true}];return u;};
 const intact=make();C.fleetPowerStep(intact,C.fleetSystems(intact),null,0,1);near(intact.propulsion.actualInputW,2e18);
 const damaged=make();damaged.mods[3]=.5;C.fleetPowerStep(damaged,C.fleetSystems(damaged),null,0,1);near(damaged.propulsion.actualInputW,1e18);
 const cut=make();cut.mods[3]=0;C.fleetPowerStep(cut,C.fleetSystems(cut),null,0,1);near(cut.propulsion.actualInputW,0);
 const tripped=make();tripped.gridState={domains:{},local:{3:10}};C.fleetPowerStep(tripped,C.fleetSystems(tripped),null,0,1);near(tripped.propulsion.actualInputW,0);
});

test('ENG-T08/14 physical machinery damage is applied once to its own engine',()=>{
 const u=thermalUnit();u.p.modules.push({k:'engine',part:-1,size:1,share:1,at:.1,domain:'main',powerConnected:true});u.mods.push(.5);u.p.propulsion.engines[0].machineryModuleIndex=3;
 C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);near(u.propulsion.engines.find(e=>e.id===1).actualInputW,5e17);near(u.propulsion.engines.find(e=>e.id===2).actualInputW,1e18);near(u.propulsion.actualThrustN,7.5e8);
});

test('ENG-T11 per-device cooling receives only its own connected electrical reservation',()=>{
 const u=thermalUnit();u.p.grid.cooling=20;u.p.grid.fixed=20;u.p.grid.coolingLoads=[{id:'p4',port:'p4',domain:'main',weight:10},{id:'p5',port:'p5',domain:'main',weight:10}];u.p.grid.powerPaths.push({from:'p3',to:'p4',cap:10,ok:true});
 u.p.heat.dis=[{id:'p4',n:'connected',k:'hdis',g:'high',cap:1e18,power:10,m:-1,sec:-1,src:-1},{id:'p5',n:'disconnected',k:'hdis',g:'high',cap:3e18,power:10,m:-1,sec:-1,src:-1}];u.p.heat.ln=[{s:0,d:0,cap:1e18,sec:-1},{s:0,d:1,cap:3e18,sec:-1}];u.ht.st[0]=2e19;
 C.fleetPowerStep(u,C.fleetSystems(u),null,0,1);near(u.pw.coolingReserved,10);near(u.ht.cooling.reserveByNodeJ.p4,10);near(u.ht.cooling.reserveByNodeJ.p5||0,0);
 C.heatTick({time:1,ev(){}},u,1);near(u.ht.cap,1e18,'only connected cooler capacity');assert.ok(u.ht.cooling.inputJ<=10);
});
