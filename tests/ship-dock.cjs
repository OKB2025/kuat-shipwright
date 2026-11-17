// User decisions 2026-11-17: the Death Star's equatorial trench is a ship dock where ships really enter and are resupplied
// (「赤道トレンチは艦船ドックで実際に船が入って補給が受けられるように」; supply「戦略マップの補給と同じ＋燃料・充電」). A host's ring docks are in
// its profile; a friendly ship ordered to dock makes for the berth, docks when inside and slow, rides with the host, is
// resupplied as at its home port, and leaves when its order changes.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=v=>JSON.parse(JSON.stringify(v));
const RING={id:1,kind:'ring',label:'試験ドック',c:[0,0,0],axis:[0,1,0],r0:3000,r1:5000,width:2000};
function host(){const p=plain(F.designs.venator.p);p.docks=[plain(RING)];const h=C.fleetUnit('h','venator',p,0);h.order={...h.order,type:'hold',fire:false};return h;}
function guest(){const g=C.fleetUnit('g','cr90',plain(F.designs.cr90.p),0);g.order={...g.order,type:'hold',fire:false};return g;}
test('a ring dock: inside between its radii and within its width; a ship taller than the width does not fit',()=>{
 const h=host(),g=guest();g.pos=[4000,0,0];let s=C.dockState(h,g);assert.equal(s.inside,true);assert.equal(s.fits,true);assert.ok(Math.abs(s.radial-4000)<1e-6);
 assert.equal(s.berth.map(v=>Math.round(v)).join(','),'4000,0,0','the berth is mid-depth on the ship side');
 g.pos=[2000,0,0];assert.equal(C.dockState(h,g).inside,false,'inside the inner radius');g.pos=[4000,1500,0];assert.equal(C.dockState(h,g).inside,false,'beyond the width');
 h.yaw=Math.PI/2;g.pos=[0,0,4000];s=C.dockState(h,g);assert.equal(s.inside,true,'the dock turns with its host');
 const tall=guest();tall.p.height=3000;tall.pos=[4000,0,0];assert.equal(C.dockState(h,tall).fits,false);
});
test('a ship ordered to dock comes to the berth, docks, rides with its host, is resupplied, and leaves on a new order',()=>{
 const h=host(),g=guest();g.pos=[9000,0,600];g.yaw=Math.PI;
 // damage and depletion
 g.energy=0;g.crew=Math.round((g.p.crewMax||g.crew)*.5);for(const x of g.sec)x.s=x.max*.4;g.hp=g.sec.reduce((n,x)=>n+x.s,0);g.mods=g.mods.map((v,i)=>g.p.modules[i].k==='hull'?v:.5);
 const f=C.shipFuelState(g);const fuelCap=f.capacityKnown;if(fuelCap){f.fuelEnergyJ=f.capacityJ*.6;f.remainingKg=(f.capacityJ-f.fuelEnergyJ)/f.specificEnergyJPerKg;}
 g.order={...g.order,type:'dock',target:'h'};const B=C.fleetBattle([h,g],false);B.seed=3;let dockedAt=null;
 for(let t=0;t<600&&!g.docked;t+=.25){C.fleetTick(B,.25,{});if(g.docked)dockedAt=t;}
 assert.ok(g.docked,'docked within ten minutes');assert.equal(g.docked.host,'h');assert.ok(B.events.some(e=>/入渠/.test(e.text)));
 const hp0=g.hp,e0=g.energy;for(let t=0;t<240;t+=.25)C.fleetTick(B,.25,{});
 assert.ok(g.energy>e0&&g.energy>=g.p.wCap*.8,'weapon energy refilled (its stores grow back with the weapon modules being repaired): '+g.energy/g.p.wCap);assert.ok(g.hp>hp0,'hull repaired');
 assert.ok(g.mods.every((v,i)=>g.p.modules[i].k==='hull'||v>1-.5*Math.exp(-240/C.DOCK.repairS)-.01),'modules repaired at the dock repair rate');assert.ok(g.crew>=(g.p.crewMax??g.p.crewNeed)*.9,'crew made up');
 if(fuelCap)assert.ok(C.shipFuelState(g).fuelEnergyJ<f.capacityJ*.1,'fuel refilled');
 // the host moves: the docked ship moves with it
 h.order={...h.order,type:'move',point:[h.pos[0]-50000,0,0]};for(let t=0;t<20;t+=.25)C.fleetTick(B,.25,{});
 const local=C.dockWorldToLocal(h,g.pos);assert.ok(Math.hypot(...local.map((v,i)=>v-g.docked.local[i]))<1e-6,'it holds its place in the dock');assert.ok(Math.hypot(...g.velocity.map((v,i)=>v-h.velocity[i]))<1e-9,'at the host velocity');
 g.order={...g.order,type:'hold'};C.fleetTick(B,.25,{});assert.equal(g.docked,undefined,'a new order takes it out of the dock');assert.ok(B.events.some(e=>/ドックを出る/.test(e.text)));
});
test('docks are kept when a design is saved and loaded, and reach the fleet profile relative to the ship centre',()=>{
 const s=C.newShip({L:400,W:200,H:100},'dock test');s.docks=[{kind:'ring',c:[200,50,0],axis:[0,1,0],r0:60,r1:90,width:30},{kind:'unknown'}];
 const r=C.deserialize(plain(C.serialize(s)));assert.equal(r.docks.length,1);assert.equal(r.docks[0].c.join(','),'200,50,0');
 const S=C.computeStats(r),p=C.fleetProfile(S,r.name,r);assert.equal(p.docks.length,1);assert.ok(p.docks[0].c.every(Number.isFinite));
 const plainShip=C.deserialize(plain(C.serialize(C.newShip({L:400,W:200,H:100},'no dock'))));assert.equal(plainShip.docks,undefined);
});
