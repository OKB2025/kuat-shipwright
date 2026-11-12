const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`);
function fixture(shares,{cooled=false}={}){
 const modules=[{k:'reactor',part:1,port:'p1',domain:'main',share:1,size:1},...shares.map((_,i)=>({k:'shield',part:i+2,port:'p'+(i+2),domain:'main',share:1,size:1,powerConnected:true})),{k:'dissipator',part:100,port:'p100',domain:'main',share:1,size:1,powerConnected:true}];
 const mi=modules.length-1,active=shares.findIndex(x=>x>0),src=shares.map((sh,i)=>({k:'shield',id:'p'+(i+2),n:i===active?'Operating shield':'Inactive shield',g:'high',...(sh===undefined?{}:{sh}),m:[i+1],sec:-1,sw:-1,gen:-1}));
 src.push({k:'reactor',id:'p1',n:'Physical reactor',g:'high',sh:1,m:[0],sec:-1,sw:-1,gen:-1});
 const p={profileVersion:C.FLEET_PROFILE_VERSION,name:'Zero-source share',hp:1e6,len:100,width:40,height:20,mass:1000,crewNeed:0,crewMax:0,D:0,wCap:0,modules,propulsion:{version:C.PROPULSION_MODEL_VERSION,engines:[],massKg:1e6,ratedThrustN:0,ratedAccelMps2:0,accelerationLimitMps2:0},grid:{P:1000,Pgen:1000,fixed:cooled?1.5:0,cooling:cooled?1.5:0,De:0,Ds:0,Dw:0,powerPaths:cooled?[{from:'p1',to:'p100',cap:1000,ok:true,efficiency:1}]:[]},heat:{v:5,mode:'strict',src,dis:cooled?[{k:'hdis',id:'p100',n:'Powered exterior rejector',g:'high',cap:100,power:1.5,m:mi,sec:-1,src:-1}]:[],ln:cooled?[{s:active,d:0,cap:100,sec:-1}]:[]}};
 const u=C.fleetUnit('zero-share','zero-share',p,0);C.heatInit(u);u.ht.t=0;return u;
}
function tick(u,J=80,cooled=false){
 if(cooled){// 2026-11-12: converter power is reserved for the heat that can reach it, including the ledger heat
  // already accrued since the last solve, so the funded shield waste is entered before the step is allocated.
  u.ht.e.shield=J;const allocation=C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0,deferHeat:true},1,'balanced');assert.ok(allocation.got.coolingGranted>0,'the real rejector needs an actual electrical reservation');}
 // This is the accumulated shared shield-waste ledger at a network tick,
 // equivalent to funded shield operations, not an invented local heat store.
 u.ht.e.shield=J;C.heatTick({time:1},u,1,1);return u.ht;
}
test('a zero-output shield source receives no share of operating shield waste',()=>{
 const u=fixture([0,1]),h=tick(u);
 assert.deepEqual(plain(h.sourceGenerationW.slice(0,2)),[0,80]);near(h.qJ,80);near(h.operatingHeatJ,80);near(h.rejectedHeatJ,0);
});
test('missing and null legacy source shares retain the equal-share default',()=>{
 const u=fixture([undefined,null,2]),h=tick(u);
 assert.deepEqual(plain(h.sourceGenerationW.slice(0,3)),[20,20,40]);near(h.qJ,80);
});
test('zero-share sources cannot dilute explicit positive weights',()=>{
 const u=fixture([0,2,6]),h=tick(u);
 assert.deepEqual(plain(h.sourceGenerationW.slice(0,3)),[0,20,60]);near(h.sourceGenerationW.reduce((n,x)=>n+x,0),80);near(h.qJ,80);
});
test('an entirely zero-share kind retains unassigned joules instead of losing them or inventing heat sources',()=>{
 const u=fixture([0,0]),h=tick(u);
 assert.deepEqual(plain(h.sourceGenerationW.slice(0,2)),[0,0]);near(h.qJ,80);near(h.operatingHeatJ,80);near(h.rejectedHeatJ,0);
});
test('an inactive disconnected source cannot steal heat from the operating shield and its paid cooling route',()=>{
 const u=fixture([0,1],{cooled:true}),h=tick(u,80,true);
 assert.deepEqual(plain(h.sourceGenerationW.slice(0,2)),[0,80]);near(h.sourceFlowW[0],0);near(h.sourceFlowW[1],80);near(h.rejectedHeatJ,80);
 assert.ok(h.cooling.inputJ>0&&h.cooling.inputJ<=1.5,'cooling consumes only its funded physical electricity');
 near(h.qJ,h.operatingHeatJ-h.rejectedHeatJ);near(h.qJ,h.cooling.heatJ+h.cooling.reactorWasteJ+h.cooling.feedLossJ);
 assert.ok(h.qJ<2,'only the finite cooler and reactor losses remain, rather than stranded shield heat');assert.equal(h.online,true);
});
test('reordering inactive and operating shield nodes leaves physical cooling and conservation unchanged',()=>{
 const a=fixture([0,1],{cooled:true}),b=fixture([1,0],{cooled:true}),A=tick(a,80,true),B=tick(b,80,true);
 near(A.qJ,B.qJ);near(A.rejectedHeatJ,B.rejectedHeatJ);near(A.cooling.inputJ,B.cooling.inputJ);
 near(A.sourceFlowW[1],80);near(B.sourceFlowW[0],80);near(A.sourceGenerationW[0],0);near(B.sourceGenerationW[1],0);
});
