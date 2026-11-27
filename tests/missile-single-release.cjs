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
// 2026-11-27 user「長距離迎撃に関してはその通りでいい。点防御は点防御で近い目標を勝手に処理する(枠に関係ない)ので撃ち漏らしはその担当になる」: in the
// strategic battle each round is its own target; within ANTI_AIR.close of the hull point defence takes it on its own, without a channel;
// farther out a round needs a channel; the defender's output for the tick is shared over what it engages.
const {R}=vm.runInContext('({R:Rts})',cx),copy=v=>JSON.parse(JSON.stringify(v));
const pdShip=(()=>{const ship=C.newShip({L:500,W:300,H:160,plan:'rect',sec:'rect'},'PD');ship.parts=[{id:1,k:'gen',d:100,c:[250,80,0]},{id:3,k:'fuel',d:40,c:[100,80,0]},{id:4,k:'pump',d:21,c:[250,80,-75]}];
 ship.fits=[{id:2,k:'pd',p:[250,160,0],a:2,ped:0,base:0,low:0,float:false}];ship.nextId=5;return C.fleetProfile(C.computeStats(ship),ship.name,ship);})();
function pdTick(rounds,{channels=4,seeds=12}={}){const per=[];for(let seed=1;seed<=seeds;seed++){
 const w=R.createWorld({region:'kuat',seed,sensors:false,designs:[{key:'own',name:'Own',p:copy(pdShip),info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:copy(pdShip),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]});
 const [u,e]=[...w.units.values()],sys=u.sys;for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}
 for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[9000,0,0],yaw:x===u?0:Math.PI,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'}});e.manual=true;u.p.aaCh=channels;
 const ms=rounds.map((q,k)=>({id:'m'+k,sys,side:1,from:e.id,target:u.id,vel:[-220,0,0],s:220,life:45,...q}));w.missiles.push(...ms);R.tick(w,.25);per.push(ms.map(m=>m.downed||0));}
 return per[0].map((_,k)=>per.reduce((n,row)=>n+row[k],0));}
const sum=a=>a.reduce((n,v)=>n+v,0),close=x=>({pos:[x,0,0]});
test('close in, point defence takes rounds on its own: with no channel at all it still engages a round at 1 km, not one at 4 km',()=>{
 const [near]=pdTick([{n:1,...close(1000)}],{channels:0}),[far]=pdTick([{n:1,...close(4000)}],{channels:0});assert.ok(near>0,'close round engaged without a channel');assert.equal(far,0,'a far round needs a channel');
});
test('farther out each round takes a channel: two channels engage the two nearest of four rounds',()=>{
 const d=pdTick([3000,3200,3400,3600].map(x=>({n:1,...close(x)})),{channels:2});assert.ok(d[0]>0&&d[1]>0,JSON.stringify(d));assert.equal(d[2],0);assert.equal(d[3],0);
});
test('the output is shared: eight single rounds close in lose about as much in all as one packet of eight there',()=>{
 const packet=sum(pdTick([{n:8,...close(1000)}])),single=sum(pdTick(Array.from({length:8},(_,k)=>({n:1,...close(1000+k*10)}))));
 assert.ok(packet>0);assert.ok(Math.abs(single/packet-1)<.2,`single ${single} vs packet ${packet}`);
});
