const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${label}: ${a} != ${b}`);
function unit(){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'one',share:.5,size:1},{k:'reactor',part:2,port:'p2',domain:'two',share:.5,size:1},{k:'engine',part:3,port:'p3',domain:'one',share:1,size:1,powerConnected:true}];
 const e={id:3,machineryId:3,moduleIndex:2,powerNode:'p3',heatNode:'p3',domain:'one',ratedInputW:100,wattsPerNewton:2,ratedThrustN:50,direction:[1,0,0],valid:true,available:true,connected:true,outletAvailable:true};
 const src=(k,id,m,sh=1)=>({k,id,n:id,g:'high',sh,st:1e30,m,pc:[],sec:-1,sw:-1,gen:-1});
 const p={hp:100,len:100,width:40,height:20,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:0,maxSpeed:100,accel:1,turnRate:.1,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),modules,propulsion:{version:1,engines:[e],massKg:1e6,ratedThrustN:50,ratedAccelMps2:50/1e6,accelerationLimitMps2:1},grid:{P:200,fixed:0,cooling:0,De:100,Ds:0,Dw:0,domains:[{id:'one',P:100,sources:[{moduleIndex:0,P:100}],modules:[0,2]},{id:'two',P:100,sources:[{moduleIndex:1,P:100}],modules:[1]}],powerPaths:[{from:'p1',to:'p3',cap:100,ok:true}]},heat:{v:1,src:[src('reactor','p1',[0],.5),src('reactor','p2',[1],.5),src('engine','p3',[2]),src('hotel','hotel',[])],dis:[],ln:[]}};
 const u=C.fleetUnit('source-heat','source-heat',p,0);u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);u.ht.t=0;return u;
}
test('only the reactor that supplied propulsion receives its four-percent conversion waste',()=>{
 const u=unit();C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},1,'balanced');C.heatTick({time:1},u,1);
 near(u.ht.st[0],4,'working reactor J');near(u.ht.st[1],0,'idle isolated reactor J');near(u.ht.st[2],5,'engine actual-input waste J');
});
test('legacy engine sources omitted from an old heat grouping still conserve their actual waste',()=>{
 const u=unit();u.p.heat.src[2].m=[];delete u.p.heat.src[2].id;C.heatInit(u);u.ht.t=0;
 C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},1,'balanced');C.heatTick({time:1},u,1);
 near(u.ht.st[2],5,'unmatched legacy engine waste');
});
test('a partial legacy heat grouping conserves unmatched input even when its old mapped module is destroyed',()=>{
 const u=unit();u.p.modules.push({k:'engine',part:9,port:'p9',domain:'one',share:.1,size:1,powerConnected:true});u.mods.push(0);u.p.heat.src[2].m=[3];delete u.p.heat.src[2].id;C.heatInit(u);u.ht.t=0;
 C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},1,'balanced');C.heatTick({time:1},u,1);near(u.ht.st[2],5);
});
test('matched and unmatched legacy engines together retain exactly five percent of their total actual input',()=>{
 const u=unit(),first=u.p.propulsion.engines[0];first.ratedInputW=50;first.ratedThrustN=25;u.p.modules.push({k:'engine',part:9,port:'p9',domain:'one',share:.5,size:1,powerConnected:true});u.mods.push(1);u.p.propulsion.engines.push({...first,id:9,machineryId:9,moduleIndex:3,powerNode:'p9',heatNode:'p9'});u.p.grid.powerPaths.push({from:'p1',to:'p9',cap:50,ok:true});
 C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},1,'balanced');near(u.propulsion.actualInputW,100);C.heatTick({time:1},u,1);near(u.ht.st[2],5);
});
test('solar electrical input does not create reactor conversion waste in an idle isolated reactor',()=>{
 const u=unit();u.p.modules[0].k='dissipator';u.p.heat.src[0].k='other';C.heatInit(u);u.ht.t=0;C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},1,'balanced');C.heatTick({time:1},u,1);
 near(u.ht.st[0],0);near(u.ht.st[1],0);near(u.ht.st[2],5);
});
function cooler(connected=true){
 const u=unit();u.p.modules.push({k:'dissipator',part:4,port:'p4',domain:'one',share:1,size:1,powerConnected:true});u.mods.push(1);u.p.grid.fixed=20;u.p.grid.cooling=20;u.p.grid.coolingLoads=[{id:'p4',port:'p4',domain:'one',weight:20}];if(connected)u.p.grid.powerPaths.push({from:'p1',to:'p4',cap:20,ok:true});
 u.p.heat.dis=[{id:'p4',n:'powered cooler',k:'hdis',g:'high',cap:100,power:20,m:3,sec:-1,src:-1}];u.p.heat.ln=[{s:2,d:0,cap:100,sec:-1}];C.heatInit(u);u.ht.t=0;u.ht.st[2]=100;return u;
}
test('actual cooling electricity heats its funding reactor while an isolated idle source stays cold',()=>{
 const u=cooler();C.allocateShipPower(u,C.fleetSystems(u),{throttle:0},1,'balanced');C.heatTick({time:1},u,1);
 const input=u.ht.cooling.inputJ;assert.ok(input>0&&input<20);near(u.ht.st[0],.04*input);near(u.ht.st[1],0);near(u.ht.cooling.reactorWasteJ,.04*input);
});
test('a reserved but disconnected cooler creates no actual cooling electricity or reactor waste',()=>{
 const u=cooler(false);C.allocateShipPower(u,C.fleetSystems(u),{throttle:0},1,'balanced');C.heatTick({time:1},u,1);
 near(u.ht.cooling.inputJ,0);near(u.ht.cooling.reactorWasteJ,0);near(u.ht.st[0],0);near(u.ht.st[1],0);near(u.ht.st[2],100);
});
test('legacy cooling without physical node metadata retains its actual source attribution',()=>{
 const u=cooler();u.p.grid.domains[0].id='main';for(const m of u.p.modules)if(m.domain==='one')m.domain='main';u.p.propulsion.engines[0].domain='main';u.p.grid.powerPaths=[];delete u.p.grid.coolingLoads;delete u.p.heat.dis[0].id;
 C.allocateShipPower(u,C.fleetSystems(u),{throttle:0},1,'balanced');C.heatTick({time:1},u,1);assert.ok(u.ht.cooling.inputJ>0);near(u.ht.st[0],.04*u.ht.cooling.inputJ);near(u.ht.st[1],0);
});
test('source-local conversion heat integrates the same joules across thermal substeps',()=>{
 const run=dt=>{const u=unit(),steps=4/dt;for(let i=0;i<steps;i++){C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},dt,'balanced');C.heatTick({time:(i+1)*dt},u,dt);}return u.ht.st;};
 const fine=run(.25),coarse=run(2);near(fine[0],16);near(fine[1],0);near(fine[2],20);for(let i=0;i<fine.length;i++)near(coarse[i],fine[i]);
});
test('a vented shared outlet retains one machinery heat source when its owner nozzle is blocked',()=>{
 const s=C.newShip({L:40,W:24,H:20,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Shared source heat');s.parts=[{id:1,k:'gen',c:[30,10,0],d:4},{id:2,k:'engine',c:[10,10,0],d:1,nozzleLength:1,bodyLength:2,bodyRadius:.52,reactor:1,dir:[-1,0,0]},{id:3,k:'engine',c:[-.5,10,6],d:1,nozzleLength:1,bodyLength:2,bodyRadius:.52,reactor:0,machineryId:2,dir:[-1,0,0]}];s.nextId=4;C.migrateLegacyPropulsion(s);const rating=s.parts[1].ratedInputW;s.links=[{kind:'power',from:'p1',to:'p2',cap:rating}];
 const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),u=C.fleetUnit('shared-source','shared-source',p,0);C.heatInit(u);u.ht.t=0;
 const engineSources=p.heat.src.filter(s=>s.k==='engine');assert.equal(engineSources.length,1);assert.equal(engineSources[0].id,'p2');assert.equal(S.info[2].vent,false);assert.equal(S.info[3].vent,true);C.allocateShipPower(u,C.fleetSystems(u),{throttle:1},1,'balanced');assert.ok(u.propulsion.actualInputW>0);
 const input=u.propulsion.actualInputW,accrued=u.ht.engineE.reduce((a,b)=>a+b,0)+u.ht.e.engine;near(accrued,.05*input);
 const preview=C.propulsionPreview(s,S,'evade');near(preview.actualInputW,input,'shared owner preview/runtime input');near(preview.actualThrustN,u.propulsion.actualThrustN,'shared owner preview/runtime force');
});

test('inertial support scales the current force after thermal input reduction exactly once',()=>{
 const s=C.newShip({L:40,W:24,H:20,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Inertial force');s.parts=[{id:1,k:'gen',c:[30,10,0],d:4},{id:2,k:'engine',c:[-.5,10,0],d:1,nozzleLength:1,bodyLength:2,bodyRadius:.52,reactor:1,dir:[-1,0,0]}];s.nextId=3;
 assert.ok(C.updateEngineSpec(s.parts[1],{ratedInputW:1e18,machineryGradeId:'dense'},s).ok);const p=C.propulsionProfile(s,{mass:1000,aStruct:1000,inertialSupport:500}),states={2:{thermalLimit:.25}};
 const actual=C.solveShipPropulsion(p,{throttle:1,states,sources:[{id:'supply',domain:p.engines[0].domain,powerW:1e18}]});
 near(p.ratedAccelMps2,500);near(p.accelerationLimitMps2,250);near(actual.freeAccelerationMps2,125);near(actual.actualAccelMps2,62.5);
});
