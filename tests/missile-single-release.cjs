// User request 2026-11-27「ミサイルは基本1発ずつ発射されるように」: every launcher releases its missiles one at a time. A cell launcher
// fires one round from its fullest cell every cycle/(loaded cells) seconds, and any other launcher one round every cycle/salvo seconds,
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
test('a four-cell launcher releases one round at a time, cycle/loaded cells apart, from alternating cells',()=>{
 const u=C.fleetUnit('a','a',profile('shipMsl',4),0),shots=run(u,.05,200);
 assert.equal(shots.length,24,'all 24 rounds');assert.ok(shots.every(q=>q.n===1));
 const times=[...new Set(shots.map(q=>q.t))];assert.equal(times.length,24,'never two rounds in one step');
 // each loaded cell once a cycle: 0.3 s while all four hold rounds, then 0.4 s and 0.6 s as the last three cells empty
 const want=[...Array(21).fill(.3),.4,.6];for(let k=1;k<times.length;k++)assert.ok(Math.abs(times[k]-times[k-1]-want[k-1])<.05+1e-9,`gap ${k}: ${times[k]-times[k-1]}`);
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
// Regression review 2026-11-27: the gap follows the loaded cells, so each loaded cell fires once a cycle as in the former volley of the
// loaded cells; a launcher with one loaded cell of four fires every 1.2 s, not every 0.3 s.
test('with one loaded cell of four the launcher fires once a cycle, not four times as fast',()=>{
 const u=C.fleetUnit('d','d',profile('shipMsl',4),0);power(u);C.missileCellAmmo(u,1);u.launcherCellAmmo[1]=[0,3,0,0];u.ammo[1]=3;
 const shots=run(u,.05,60),times=shots.map(q=>q.t);assert.equal(shots.length,3);assert.ok(shots.every(q=>q.cell===1));
 for(let k=1;k<times.length;k++)assert.ok(Math.abs(times[k]-times[k-1]-1.2)<.05+1e-9,`gap ${times[k]-times[k-1]}`);
});
// Physics review 2026-11-27: one launcher's volley of single rounds is one target for point defence, as the salvo it replaced was: in the
// strategic battle a defender engages the volley once a tick with channels for the whole volley, and the kill is shared by its rounds.
test('point defence takes as much of a volley of eight single rounds as of the salvo of eight it replaced',()=>{
 const {R}=vm.runInContext('({R:Rts})',cx),copy=v=>JSON.parse(JSON.stringify(v));
 const ship=C.newShip({L:500,W:300,H:160,plan:'rect',sec:'rect'},'PD');ship.parts=[{id:1,k:'gen',d:100,c:[250,80,0]},{id:3,k:'fuel',d:40,c:[100,80,0]},{id:4,k:'pump',d:21,c:[250,80,-75]}];
 ship.fits=[{id:2,k:'pd',p:[250,160,0],a:2,ped:0,base:0,low:0,float:false}];ship.nextId=5;const p=C.fleetProfile(C.computeStats(ship),ship.name,ship);
 const downed=rounds=>{let total=0;for(let seed=1;seed<=12;seed++){
  const w=R.createWorld({region:'kuat',seed,sensors:false,designs:[{key:'own',name:'Own',p:copy(p),info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:copy(p),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]});
  const [u,e]=[...w.units.values()],sys=u.sys;for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}
  for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[5000,0,0],yaw:x===u?0:Math.PI,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});e.manual=true;u.p.aaCh=4/* four fire-control channels, the default */;
  const ms=rounds(sys,u,e);w.missiles.push(...ms);R.tick(w,.25);total+=ms.reduce((n,m)=>n+(m.downed||0),0);}return total;};
 const m=(sys,u,e,o)=>({sys,side:1,from:e.id,target:u.id,pos:[4500,0,0],vel:[-220,0,0],s:220,life:45,...o});
 const salvo=downed((sys,u,e)=>[m(sys,u,e,{id:'s',n:8})]),volley=downed((sys,u,e)=>Array.from({length:8},(_,k)=>m(sys,u,e,{id:'v'+k,n:1,volley:e.id+'#1:1',pos:[4500+k*10,0,0]})));
 const loose=downed((sys,u,e)=>Array.from({length:8},(_,k)=>m(sys,u,e,{id:'l'+k,n:1,pos:[4500+k*10,0,0]})));
 assert.ok(salvo>0,'the salvo is engaged');assert.ok(Math.abs(volley/salvo-1)<.15,`volley ${volley} vs salvo ${salvo}`);
 assert.ok(loose>volley*1.15,`eight loose rounds, each its own target, are taken harder (${loose} vs ${volley}): the case the volley id prevents`);
});
