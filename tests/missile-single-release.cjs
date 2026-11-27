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
 const ms=rounds.map((q,k)=>({id:'m'+k,sys,side:1,from:e.id,target:u.id,vel:[-220,0,0],s:220,life:45,...q}));w.missiles.push(...ms);
 // the interception each round is given this tick: a single round's expected hits (recorded where the RTS draws them), a packet's rounds downed
 const given=new Map(),draw=C.pointDefenseRoundHits;C.pointDefenseRoundHits=(m,e,rand)=>{given.set(m,(given.get(m)||0)+e);return draw(m,e,rand);};try{R.tick(w,.25);}finally{C.pointDefenseRoundHits=draw;}
 per.push(ms.map(m=>m.n===1||given.has(m)?given.get(m)||0:m.downed||0));}
 return per[0].map((_,k)=>per.reduce((n,row)=>n+row[k],0));}
const sum=a=>a.reduce((n,v)=>n+v,0),close=x=>({pos:[x,0,0]});
test('close in, point defence takes rounds on its own: with no channel at all it still engages a round at 1 km, not one at 4 km',()=>{
 const [near]=pdTick([{n:1,...close(1000)}],{channels:0}),[far]=pdTick([{n:1,...close(4000)}],{channels:0});assert.ok(near>0,'close round engaged without a channel');assert.equal(far,0,'a far round needs a channel');
});
test('farther out each round takes a channel: two channels engage the two nearest of four rounds',()=>{
 const d=pdTick([3000,3200,3400,3600].map(x=>({n:1,...close(x)})),{channels:2});assert.ok(d[0]>0&&d[1]>0,JSON.stringify(d));assert.equal(d[2],0);assert.equal(d[3],0);
});
// 2026-11-27 user「被弾したらその場で爆発して誘導が切れた状態で慣性で突っ込んでくる。2発目が当たると消滅」: a single round takes whole hits; the first
// disables it (no guidance, it flies straight on), the second destroys it. A packet of several rounds keeps the fraction model.
test('a single round: the first hit disables it, the second destroys it',()=>{
 const m={n:1},one=()=>0;assert.equal(C.pointDefenseRoundHits(m,1,one),0);assert.equal(m.pdDisabled,true);assert.equal(m.unguided,true);assert.equal(m.n,1,'still flying');
 assert.equal(C.pointDefenseRoundHits(m,1,one),1);assert.equal(m.n,0,'the second hit destroys it');
 const q={n:1};assert.equal(C.pointDefenseRoundHits(q,2,one),1,'two hits at once');assert.equal(q.n,0);
 const r={n:1};assert.equal(C.pointDefenseRoundHits(r,.3,()=>.5),0);assert.equal(r.pdDisabled,undefined,'0.3 of a hit with a draw of 0.5: no hit');assert.equal(C.pointDefenseRoundHits(r,.3,()=>.2),0);assert.equal(r.pdDisabled,true,'a draw under 0.3: a hit');
});
test('the output is shared: eight single rounds close in are given about as many hits in all as one packet of eight loses rounds',()=>{
 const packet=sum(pdTick([{n:8,...close(1000)}],{seeds:24})),single=sum(pdTick(Array.from({length:8},(_,k)=>({n:1,...close(1000+k*10)})),{seeds:24}));
 assert.ok(packet>0);assert.ok(Math.abs(single/packet-1)<.2,`single ${single} expected hits vs packet ${packet} rounds`);
});
test('in the strategic battle a disabled round flies straight on: off its target\'s line it misses, on it it still strikes',()=>{
 const strike=(pos,vel)=>{const w=R.createWorld({region:'kuat',seed:3,sensors:false,designs:[{key:'own',name:'Own',p:copy(pdShip),info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:copy(pdShip),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]});
  const [u,e]=[...w.units.values()],sys=u.sys;for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[20000,0,0],yaw:0,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:false,power:'balanced',aim:'auto',volley:'stream'}});e.manual=true;C.setAutomaticPointDefense(u,false);
  const m={id:'d',sys,side:1,from:e.id,target:u.id,n:1,tt:1,pdDisabled:true,unguided:true,pos,vel,s:2600,top:2600,life:20,range:60000,traveled:0};w.missiles.push(m);const hp=u.hp;for(let i=0;i<40&&m.n>0&&m.life>0;i++)R.tick(w,.25);return {hit:u.hp<hp||!!m.hit,m};};
 assert.equal(strike([5000,3000,0],[-1,0,0]).hit,false,'flying past 3 km off its line, it does not turn');assert.equal(strike([5000,0,0],[-1,0,0]).hit,true,'on its line it still strikes');
});
// 2026-11-27 user「推進剤が爆発して弾頭だけ飛んでくる」: point defence's first hit blows the round's propellant; the warhead keeps the speed it
// had and coasts straight on (no thrust: it no longer speeds up), the 3D fleet battle and the strategic battle alike.
test('a disabled round coasts: it keeps its speed and no longer speeds up (the fleet battle and the strategic battle)',()=>{
 const F=vm.runInContext('YardFleetData',cx).designs;
 const fleet=disabled=>{const a=C.fleetUnit('a','cr90',copy(F.cr90.p),0),t=C.fleetUnit('t','cr90',copy(F.cr90.p),1);for(const u of [a,t]){u.velocity=[0,0,0];u.order={...u.order,type:'hold',fire:false};}a.pos=[0,0,0];t.pos=[0,60000,0];
  const b=C.fleetBattle([a,t],true);b.seed=1;const m={id:'m1',salvo:'s',team:0,from:'a',target:'t',n:1,tt:1,kind:'cmsl',ion:false,range:400000,traveled:0,pos:[100,0,0],vel:[220,0,0],s:220,life:60,launchClearance:0,launchDir:[1,0,0],unguided:true,...(disabled?{pdDisabled:true}:{})};
  b.missiles=[m];for(let i=0;i<8;i++)C.fleetTick(b,.25,{});return m.s;};
 assert.equal(fleet(true),220,'fleet battle: the disabled round keeps 220 m/s');assert.ok(fleet(false)>220,'an unguided round with its motor still speeds up');
 const rts=disabled=>{const w=R.createWorld({region:'kuat',seed:3,sensors:false,designs:[{key:'own',name:'Own',p:copy(pdShip),info:{capital:false,sensor:1}},{key:'enemy',name:'Enemy',p:copy(pdShip),info:{capital:false,sensor:1}}],sides:[{faction:'rebel',ai:false},{faction:'empire',ai:false}],fleets:[[{design:'own',air:[],ground:[],troops:0}],[{design:'enemy',air:[],ground:[],troops:0}]]});
  const [u,e]=[...w.units.values()],sys=u.sys;for(const g of w.groups.values()){g.sys=sys;g.inbound=null;g.order={type:'hold'};}for(const x of [u,e])Object.assign(x,{sys,pos:x===u?[0,0,0]:[20000,0,0],yaw:0,velocity:[0,0,0],warp:null,jump:null,order:{type:'hold',fire:false,power:'balanced',aim:'auto',volley:'stream'}});e.manual=true;C.setAutomaticPointDefense(u,false);
  const m={id:'d',sys,side:1,from:e.id,target:u.id,n:1,tt:1,kind:'cmsl',unguided:true,...(disabled?{pdDisabled:true}:{}),pos:[15000,8000,0],vel:[-1,0,0],s:220,life:20,range:60000,traveled:0};w.missiles.push(m);for(let i=0;i<4;i++)R.tick(w,.25);return m.s;};
 assert.equal(rts(true),220,'strategic battle: the disabled round keeps 220 m/s');assert.ok(rts(false)>220,'an unguided round with its motor still speeds up');
});
// 2026-11-27 physics review: a torpedo's slowing stands for its propellant, so a disabled torpedo coasts too; and the round's life,
// reckoned for powered flight, is stretched to the end of its reach so that coasting slower it is not lost short of it.
test('a disabled torpedo no longer slows, and a disabled round\'s life reaches the end of its range',()=>{
 const F=vm.runInContext('YardFleetData',cx).designs;
 const torp=disabled=>{const a=C.fleetUnit('a','cr90',copy(F.cr90.p),0),t=C.fleetUnit('t','cr90',copy(F.cr90.p),1);for(const u of [a,t]){u.velocity=[0,0,0];u.order={...u.order,type:'hold',fire:false};}a.pos=[0,0,0];t.pos=[0,80000,0];
  const b=C.fleetBattle([a,t],true);b.seed=1;const m={id:'m1',salvo:'s',team:0,from:'a',target:'t',n:1,tt:1,kind:'ptorp',torp:true,inertial:true,torpLen:50,ion:false,range:400000,traveled:0,pos:[100,0,0],vel:[1200,0,0],s:1200,life:60,launchClearance:0,launchDir:[1,0,0],unguided:true,...(disabled?{pdDisabled:true}:{})};
  b.missiles=[m];for(let i=0;i<8;i++)C.fleetTick(b,.25,{});return m.s;};
 assert.equal(torp(true),1200,'the disabled torpedo keeps 1,200 m/s');assert.ok(torp(false)<1200,'a torpedo whose propellant is whole still slows');
 const m={n:1,s:400,range:30000,traveled:5000,life:3};C.pointDefenseRoundHits(m,1,()=>0);assert.equal(m.pdDisabled,true);assert.equal(m.life,25000/400,'life to the end of its reach at 400 m/s');
 const q={n:1,s:2600,range:30000,traveled:0,life:20};C.pointDefenseRoundHits(q,1,()=>0);assert.equal(q.life,20,'never shortened');
});
