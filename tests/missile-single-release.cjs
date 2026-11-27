// User request 2026-11-27「ミサイルは基本1発ずつ発射されるように」: every launcher releases its missiles one at a time. A cell launcher
// fires one round from its fullest cell every cycle/cells seconds, and any other launcher one round every cycle/salvo seconds,
// so the rounds per second stay those of the former salvo (all cells, or `salvo` rounds, every cycle).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
function profile(kind,cells,{ion=false,stock}={}){
 const native=kind==='cmsl'||kind==='shipMsl';
 const launcher={k:'launcher',fit:2,port:'f2',domain:'main',name:'Launcher',size:1,share:1,at:.5,powerConnected:true,stock:stock??6*cells,missileKind:native?kind:undefined,missileRange:native?10000:60000,salvo:cells,cycle:native?1.2:20,tt:native?25:10,ion,launchPowerW:1e15,muzzle:[0,0,0],launchMuzzles:Array.from({length:cells},(_,i)=>[0,0,i]),launchDir:[1,0,0],...(native?{}:{msl:true})};
 return {name:'Single release fixture',profileVersion:5,hp:1e6,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,
  gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},msl:0,imsl:0,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher],
  grid:{P:1e18,Pgen:1e18,Paux:0,fixed:native?1e15:0,cooling:0,De:0,Ds:0,Dw:0,...(native?{fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:1e15}]}:{})}};
}
const power=u=>C.allocateShipPower(u,C.fleetSystems(u),{throttle:0,weapons:0,shields:0},0,'balanced');
function run(u,dt,steps){const out=[];for(let s=0;s<steps;s++){power(u);for(const q of C.fleetMissileStep(u,dt,true,{distance:5000}))out.push({...q,t:+(s*dt).toFixed(6)});}return out;}
test('a four-cell launcher releases one round at a time, cycle/4 apart, from alternating cells',()=>{
 const u=C.fleetUnit('a','a',profile('shipMsl',4),0),shots=run(u,.05,200);
 assert.equal(shots.length,24,'all 24 rounds');assert.ok(shots.every(q=>q.n===1));
 const times=[...new Set(shots.map(q=>q.t))];assert.equal(times.length,24,'never two rounds in one step');
 for(let k=1;k<times.length;k++)assert.ok(Math.abs(times[k]-times[k-1]-.3)<.05+1e-9,`gap ${times[k]-times[k-1]}`);
 assert.deepEqual(shots.slice(0,4).map(q=>q.cell),[0,1,2,3],'the fullest cell first, so the cells empty evenly');
 assert.deepEqual([...u.launcherCellAmmo[1]],[0,0,0,0]);
});
test('rounds per second are unchanged: four rounds per 1.2 s cycle, and one in a single coarse step',()=>{
 const a=C.fleetUnit('a','a',profile('shipMsl',4),0);assert.equal(run(a,.1,11).length,4,'four rounds before the second cycle starts at 1.2 s');
 const b=C.fleetUnit('b','b',profile('shipMsl',4),0);power(b);assert.equal(C.fleetMissileStep(b,.1,true,{distance:5000}).length,1,'one round in the first step (was all four)');
});
test('a non-native tube releases one round every cycle/salvo seconds (was 8 rounds in one packet every 20 s)',()=>{
 const u=C.fleetUnit('c','c',profile('legacy',8,{ion:true,stock:120}),0);power(u);
 const first=C.fleetMissileStep(u,.25,true,{distance:5000});assert.equal(first.length,1);assert.equal(first[0].n,1);assert.equal(first[0].ion,true);
 const rest=run(u,.25,78);assert.equal(rest.length,7,'eight rounds before the next cycle starts at 20 s');assert.ok(rest.every(q=>q.n===1));
});
