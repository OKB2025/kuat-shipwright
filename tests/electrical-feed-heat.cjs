const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${a} != ${b}`),P=1e18;
function unit(){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},{k:'conduit',part:-6000000,port:'p-6000000',domain:'main',share:1,size:1,powerConnected:true},{k:'engine',part:3,port:'p3',domain:'main',share:1,size:1,powerConnected:true},{k:'engine',part:4,port:'p4',domain:'main',share:1,size:1,powerConnected:true}],engine={id:4,machineryId:3,moduleIndex:3,machineryModuleIndex:2,powerNode:'p4',heatNode:'p3',domain:'main',ratedInputW:P,wattsPerNewton:2e9,ratedThrustN:P/2e9,direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true,pathCapacityW:P},source=(k,id,m,extra={})=>({k,id,n:id,g:'high',sh:1,st:1e30,m,pc:[],sec:-1,sw:-1,gen:-1,...extra});
 const profile={hp:1e15,len:100,width:40,height:20,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:0,maxSpeed:100,accel:1,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,propulsion:{version:1,engines:[engine],massKg:1e6,ratedThrustN:P/2e9,ratedAccelMps2:P/2e9/1e6,accelerationLimitMps2:1e9},grid:{P,fixed:0,cooling:0,De:P,Ds:0,Dw:0,domains:[{id:'main',P,sources:[{moduleIndex:0,P}],modules:[0,1,2,3]}],trunks:[{port:'p-6000000',moduleIndex:1}],powerPaths:[{from:'p1',to:'p-6000000',cap:P,efficiency:.9,routeId:'feed-first',ok:true},{from:'p-6000000',to:'p3',cap:P,ok:true},{from:'p3',to:'p4',cap:P,ok:true}]},heat:{v:3,mode:'strict',src:[source('reactor','p1',[0]),source('feed','p-6000000',[1],{routeId:'feed-first'}),source('engine','p3',[2]),source('hotel','hotel',[])],dis:[],ln:[]}};
 const u=C.fleetUnit('feed-heat','feed-heat',profile,0);u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);u.ht.t=0;return u;
}
const allocate=(u,dt=1)=>C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,shields:0,weapons:0},dt,'balanced');

test('actual sent power heats its reactor, the physical feed, and the receiving machinery once each',()=>{
 const u=unit();allocate(u);near(u.propulsion.power.draw,P);near(u.propulsion.actualInputW,.9*P);near(u.propulsion.power.feedLossW,.1*P);near(u.propulsion.wasteHeatW,.045*P);near(u.ht.reactorE[0],.04*P);near(u.ht.feedE[1],.1*P);near(u.ht.engineE[2],.045*P);near(u.ht.e.engine,0);
 C.heatTick({time:1},u,1);near(u.ht.st[0],.04*P);near(u.ht.st[1],.1*P);near(u.ht.st[2],.045*P);near(u.ht.st[3],0);near(u.ht.st.reduce((a,b)=>a+b,0),.185*P);near(u.ht.emit,0);near(u.ht.feedLossJ,.1*P);assert.ok(u.ht.feedE.every(J=>J===0));
});

test('local feed and machinery heat integrate the same joules across different thermal step sizes',()=>{
 const run=dt=>{const u=unit();for(let i=0;i<4/dt;i++){allocate(u,dt);C.heatTick({time:(i+1)*dt},u,dt);}return u;},fine=run(.25),coarse=run(2);near(fine.ht.st[0],.16*P);near(fine.ht.st[1],.4*P);near(fine.ht.st[2],.18*P);near(fine.ht.feedLossJ,.4*P);for(let i=0;i<fine.ht.st.length;i++)near(coarse.ht.st[i],fine.ht.st[i]);near(coarse.ht.feedLossJ,fine.ht.feedLossJ);
});

test('a feed local thermal limit restricts actual watts and shutdown stops further line and machinery heat',()=>{
 const limited=unit();limited.ht.lm[1]=.5;allocate(limited);near(limited.propulsion.actualInputW,.45*P);near(limited.propulsion.power.draw,.5*P);near(limited.propulsion.power.feedLossW,.05*P);near(limited.ht.engineE[2],.0225*P);
 const damaged=unit();damaged.mods[1]=.5;allocate(damaged);near(damaged.propulsion.actualInputW,.45*P);near(damaged.propulsion.power.draw,.5*P);near(damaged.propulsion.power.feedLossW,.05*P);
 const stopped=unit();stopped.ht.lm[1]=0;allocate(stopped);near(stopped.propulsion.actualInputW,0);near(stopped.propulsion.actualThrustN,0);near(stopped.propulsion.power.draw,0);near(stopped.propulsion.power.feedLossW,0);near(stopped.ht.feedLossJ||0,0);near(stopped.ht.engineE[2],0);near(stopped.ht.reactorE[0],0);
 stopped.ht.lm[1]=1;allocate(stopped);near(stopped.propulsion.actualInputW,.9*P);near(stopped.ht.feedE[1],.1*P);
});

test('two physical electrical stages keep distinct local heat stores and use the full source draw for reactor heat',()=>{
 const u=unit();u.p.modules.push({k:'conduit',part:-6000001,port:'p-6000001',domain:'main',share:1,size:1,powerConnected:true});u.mods.push(1);u.p.heat.src.push({...u.p.heat.src[1],id:'p-6000001',n:'second electrical feed',routeId:'feed-second',m:[4]});u.p.grid.trunks.push({port:'p-6000001',moduleIndex:4});u.p.grid.powerPaths=[{from:'p1',to:'p-6000000',cap:P,efficiency:.9,routeId:'feed-first',ok:true},{from:'p-6000000',to:'p-6000001',cap:P,efficiency:.8,routeId:'feed-second',ok:true},{from:'p-6000001',to:'p3',cap:P,ok:true},{from:'p3',to:'p4',cap:P,ok:true}];C.heatInit(u);u.ht.t=0;
 allocate(u);near(u.propulsion.actualInputW,.72*P);near(u.ht.feedE[1],.1*P);near(u.ht.feedE[4],.18*P);near(u.ht.engineE[2],.036*P);near(u.ht.reactorE[0],.04*P);near(u.ht.feedLossJ,.28*P);C.heatTick({time:1},u,1);near(u.ht.st[1],.1*P);near(u.ht.st[4],.18*P);near(u.ht.st[2],.036*P);near(u.ht.st[0],.04*P);near(u.ht.st.reduce((a,b)=>a+b,0),.356*P);
});
