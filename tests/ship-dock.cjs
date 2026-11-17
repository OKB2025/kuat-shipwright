// User decisions 2026-11-17: ships really enter the Death Star's docks and are resupplied there (「赤道トレンチは艦船ドックで実際に船が
// 入って補給が受けられるように」, supply「戦略マップの補給と同じ＋燃料・充電」), and a dock is a hangar like any carrier's (「ドックを別パーツにする
// のではなく、航空機の格納庫と同じ扱い」). A ship docks through a host's hangar mouth (p.mouths) it fits: it approaches outside the mouth,
// flies into the bay, docks when inside and slow, rides with the host, is resupplied as at its home port, and leaves when its order
// changes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=v=>JSON.parse(JSON.stringify(v));
// A hangar 2.5 km deep behind a mouth on the host's bow face, its opening 1.5 km by 0.8 km.
const MOUTH={hatchId:99,p:[3000,0,0],n:[1,0,0],ax:[0,0,1],o:[1500,800],r:1,in:[1750,0,0],d:1250,sl:0,bs:[2500,1000,1600]};
function host(mouth=MOUTH){const p=plain(F.designs.venator.p);p.mouths=[plain(mouth)];const h=C.fleetUnit('h','venator',p,0);h.order={...h.order,type:'hold',fire:false};return h;}
function guest(){const g=C.fleetUnit('g','cr90',plain(F.designs.cr90.p),0);g.order={...g.order,type:'hold',fire:false};return g;}
test('a ship docks through a hangar mouth it fits; the mouth and bay turn with the host',()=>{
 const h=host(),g=guest();g.pos=[1750,0,0];let s=C.dockState(h,g);assert.equal(s.inside,true,'inside the bay');assert.equal(s.berth.join(','),'1750,0,0');
 g.pos=[3000+1000,0,0];s=C.dockState(h,g);assert.equal(s.inside,false);assert.equal(s.corridor,true,'in front of the mouth: the entry corridor');
 g.pos=[0,0,9000];s=C.dockState(h,g);assert.equal(s.inside,false);assert.equal(s.corridor,false);
 h.yaw=Math.PI/2;g.pos=[0,0,1750];assert.equal(C.dockState(h,g).inside,true,'the hangar turns with its host');
 const narrow=host({...MOUTH,o:[12,6]}),big=guest();big.pos=[1750,0,0];assert.equal(C.dockState(narrow,big),null,'a ship wider than the opening does not fit');
 const short=host({...MOUTH,bs:[80,60,60]});assert.equal(C.dockState(short,big),null,'a ship longer than the bay does not fit');
});
test('a ship ordered to dock flies in through the mouth, docks, rides with its host, is resupplied, and leaves on a new order',()=>{
 const h=host(),g=guest();g.pos=[9000,0,1500];g.yaw=Math.PI;
 g.energy=0;g.crew=Math.round((g.p.crewMax||g.crew)*.5);for(const x of g.sec)x.s=x.max*.4;g.hp=g.sec.reduce((n,x)=>n+x.s,0);g.mods=g.mods.map((v,i)=>g.p.modules[i].k==='hull'?v:.5);
 const f=C.shipFuelState(g),fuelCap=f.capacityKnown;if(fuelCap){f.fuelEnergyJ=f.capacityJ*.6;f.remainingKg=(f.capacityJ-f.fuelEnergyJ)/f.specificEnergyJPerKg;}
 assert.ok(C.dockNeed(g)>=C.DOCK.want,'a worn ship wants a dock: '+C.dockNeed(g));
 g.order={...g.order,type:'dock',target:'h'};const B=C.fleetBattle([h,g],false);B.seed=3;
 for(let t=0;t<900&&!g.docked;t+=.25)C.fleetTick(B,.25,{});
 assert.ok(g.docked,'docked within fifteen minutes');assert.equal(g.docked.host,'h');assert.equal(g.docked.hatch,99);assert.ok(B.events.some(e=>/格納庫に入渠/.test(e.text)));
 assert.equal(C.dockState(h,g).inside,true,'it is inside the bay');
 const hp0=g.hp,e0=g.energy;for(let t=0;t<240;t+=.25)C.fleetTick(B,.25,{});
 assert.ok(g.energy>e0&&g.energy>=g.p.wCap*.8,'weapon energy refilled (its stores grow back with the weapon modules being repaired): '+g.energy/g.p.wCap);assert.ok(g.hp>hp0,'hull repaired');
 assert.ok(g.mods.every((v,i)=>g.p.modules[i].k==='hull'||v>1-.5*Math.exp(-240/C.DOCK.repairS)-.01),'modules repaired at the dock repair rate');assert.ok(g.crew>=(g.p.crewMax??g.p.crewNeed)*.9,'crew made up');
 if(fuelCap)assert.ok(C.shipFuelState(g).fuelEnergyJ<f.capacityJ*.1,'fuel refilled');
 assert.ok(C.dockNeed(g)<C.DOCK.want,'no longer wants a dock');
 h.order={...h.order,type:'move',point:[h.pos[0]-50000,0,0]};for(let t=0;t<20;t+=.25)C.fleetTick(B,.25,{});
 const local=C.dockWorldToLocal(h,g.pos);assert.ok(Math.hypot(...local.map((v,i)=>v-g.docked.local[i]))<1e-6,'it holds its place in the hangar');assert.ok(Math.hypot(...g.velocity.map((v,i)=>v-h.velocity[i]))<1e-9,'at the host velocity');
 g.order={...g.order,type:'hold'};C.fleetTick(B,.25,{});assert.equal(g.docked,undefined,'a new order takes it out of the dock');assert.ok(B.events.some(e=>/ドックを出る/.test(e.text)));
});
test('a hangar mouth in the fleet profile carries its bay size',()=>{
 const s=C.newShip({L:400,W:200,H:100},'hangar test'),top=C.computeStats(s).ybox[1];const bay=C.placePart(s,'hangar',[200,top-25,0],60,{room:[120,40,80]},false);C.openBay(s,bay,'top','open');
 const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s);assert.ok(p.mouths.length>=1,'a mouth');const m=p.mouths[0];assert.equal(m.bs?.length,3);assert.ok(Math.max(...m.bs)>=79,'the bay size: '+m.bs);
});
