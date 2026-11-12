const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),P=1e18,eta=.9,receivedRated=eta*P,capacity=receivedRated/C.HEAT.disPowerK.hdis,near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${a} != ${b}`);
C.HEAT.qAllowJPerKg=1e20;
function cooler(storedHeat=0){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1},{k:'conduit',part:-6000000,port:'p-6000000',domain:'main',size:1,share:1,powerConnected:true},{k:'dissipator',part:3,port:'p3',domain:'main',size:1,share:1,powerConnected:true},{k:'weapon',fit:4,port:'f4',domain:'main',size:1,share:1,powerConnected:true}],source=(k,id,m,extra={})=>({k,id,n:id,g:k==='hotel'?'low':'high',sh:1,st:1e30,m,pc:[],sec:-1,sw:-1,gen:-1,...extra});
 const profile={name:'Lossy physical cooler',hp:1e15,len:100,width:40,height:20,D:0,shieldBuffer:0,wCap:0,crewNeed:0,maxSpeed:0,accel:0,turnRate:0,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,propulsion:{version:1,engines:[],massKg:1e6,ratedThrustN:0,ratedAccelMps2:0,accelerationLimitMps2:0},grid:{P,fixed:receivedRated,cooling:receivedRated,De:0,Ds:0,Dw:0,domains:[{id:'main',P,sources:[{moduleIndex:0,P}],modules:[0,1,2,3]}],trunks:[{port:'p-6000000',moduleIndex:1}],powerPaths:[{from:'p1',to:'p-6000000',cap:P,efficiency:eta,routeId:'cooler-feed',ok:true},{from:'p-6000000',to:'p3',cap:P,ok:true}]},heat:{v:3,mode:'strict',src:[source('reactor','p1',[0]),source('feed','p-6000000',[1],{routeId:'cooler-feed'}),source('weapon','f4',[3]),source('hotel','hotel',[])],dis:[{k:'hdis',id:'p3',n:'Physical powered cooler',g:'high',cap:capacity,power:receivedRated,m:2,src:-1,sec:-1}],ln:[0,1,2,3].map(s=>({s,d:0,cap:capacity,sec:-1}))}};
 const unit=C.fleetUnit('lossy-cooler','lossy-cooler',profile,0);unit.order={...unit.order,power:'balanced'};C.heatInit(unit);unit.ht.t=0;unit.ht.qJ=storedHeat;return unit;
}
const allocate=(u,dt=1)=>C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,shields:0,weapons:0},dt,'balanced'),tick=(u,dt=1,time=dt)=>C.heatTick({time},u,dt,dt),sum=a=>a.reduce((n,v)=>n+v,0);

test('a fully used lossy cooler pays sent watts and creates source, line and device heat exactly once',()=>{
 const initial=capacity*40,u=cooler(initial);allocate(u);near(u.ht.feedLossJ||0,0);near(sum(u.ht.reactorE),0);near(sum(u.ht.feedE),0);tick(u);
 const c=u.ht.cooling;near(c.inputJ,receivedRated);near(c.heatJ,receivedRated);near(c.sourceInputJ,P);near(c.feedLossJ,.1*P);near(c.reactorWasteJ,.04*P);near(c.lastDraw,receivedRated);near(c.lastSourceDraw,P);near(u.pw.draw,P);near(u.ht.feedLossJ,.1*P);near(u.ht.qJ+u.ht.emit,initial+1.04*P);
});

test('an unused cooling reservation creates no actual electrical, feed or reactor heat',()=>{
 // 2026-11-12: with no heat to convert nothing is reserved at all, so the cooling ledger may not exist yet.
 const u=cooler();allocate(u);tick(u);const c=u.ht.cooling||{inputJ:0,heatJ:0,sourceInputJ:0,feedLossJ:0,reactorWasteJ:0};near(c.inputJ,0);near(c.heatJ,0);near(c.sourceInputJ,0);near(c.feedLossJ,0);near(c.reactorWasteJ,0);near(u.ht.feedLossJ||0,0);near(u.ht.qJ,0);near(u.ht.emit,0);near(u.pw.draw,0);
});

test('partially used cooling scales the sent electrical cost and route loss by received use',()=>{
 const initial=capacity*10,u=cooler(initial);allocate(u);tick(u);const c=u.ht.cooling;near(c.inputJ,.45*P);near(c.sourceInputJ,.5*P);near(c.feedLossJ,.05*P);near(c.reactorWasteJ,.02*P);near(c.lastDraw,.45*P);near(c.lastSourceDraw,.5*P);near(u.pw.draw,.5*P);near(u.ht.feedLossJ,.05*P);near(u.ht.qJ+u.ht.emit,initial+.52*P);
});

test('thermal step splitting preserves integrated received cooling, sent power and deferred line loss',()=>{
 const initial=capacity*100,run=dt=>{const u=cooler(initial);let emitted=0;for(let i=0;i<4/dt;i++){allocate(u,dt);tick(u,dt,(i+1)*dt);emitted+=u.ht.emit*dt;}return {u,emitted};},fine=run(.25),coarse=run(2);
 for(const name of ['inputJ','sourceInputJ','feedLossJ','heatJ','reactorWasteJ'])near(fine.u.ht.cooling[name],coarse.u.ht.cooling[name]);near(fine.u.ht.cooling.sourceInputJ,4*P);near(fine.u.ht.cooling.inputJ,3.6*P);near(fine.u.ht.cooling.feedLossJ,.4*P);near(coarse.u.ht.feedLossJ,.4*P);near(fine.u.ht.qJ+fine.emitted,initial+4.16*P);near(coarse.u.ht.qJ+coarse.emitted,initial+4.16*P);
});

test('ordinary and partially used cooling loads on one lossy feed each accrue only their own actual loss',()=>{
 const u=cooler(),p=u.p,coolingRated=.45*P,localCapacity=coolingRated/C.HEAT.disPowerK.hdis,initial=localCapacity*10;p.grid.fixed=p.grid.cooling=coolingRated;p.grid.Dw=.45*P;p.heat.dis[0].power=coolingRated;p.heat.dis[0].cap=localCapacity;p.grid.powerPaths.push({from:'p-6000000',to:'f4',cap:P,ok:true});p.modules.push({k:'other',part:5,port:'p5',domain:'main',size:1,share:1,powerConnected:true});u.mods.push(1);p.heat.src.push({k:'engine',id:'p5',n:'Stored heat reservoir',g:'high',sh:1,st:1e30,m:[4],pc:[],sec:-1,sw:-1,gen:-1});p.heat.ln=[{s:4,d:0,cap:localCapacity,sec:-1}];C.heatInit(u);u.ht.t=0;u.ht.qJ=initial;
 C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,shields:0,weapons:.45*P},1,'balanced');near(u.propulsion.power.draw,P);near(u.propulsion.power.weapons,.45*P);near(u.propulsion.power.cooling,.45*P);near(u.ht.feedLossJ,.05*P);near(u.ht.feedE[1],.05*P);near(u.ht.reactorE[0],.02*P);
 tick(u);near(u.ht.cooling.inputJ,.225*P);near(u.ht.cooling.sourceInputJ,.25*P);near(u.ht.cooling.feedLossJ,.025*P);near(u.ht.cooling.reactorWasteJ,.01*P);near(u.ht.feedLossJ,.075*P);near(u.pw.draw,.75*P);near(u.ht.qJ+u.ht.emit,initial+(.33+.45*C.HEAT.waste.weapon)*P);
});
