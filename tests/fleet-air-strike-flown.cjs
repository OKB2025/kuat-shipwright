// 2026-11-20 Two faults that kept the bombers from flying the strike a fleet had ordered (found in the trace of the fleet action,
// scripts/sim-fleet-air.cjs: 180 rounds carried, 7 released).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
test('a craft pointing straight down (out of a ventral hangar mouth) pulls out towards a point level with it',()=>{
 let s={pos:[0,0,0],yaw:0,att:{f:[0,-1,0],up:[0,1,0]}};const dest=[50000,0,0],dt=.25;
 for(let i=0;i<200;i++){const A=C.craftAttitudeStep({},s,dest,.5,dt);assert.ok(A.f.every(Number.isFinite)&&A.up.every(Number.isFinite));assert.ok(Math.abs(C.dot(A.f,A.up))<1e-6,'the lift vector stays square to the bow');s={...s,att:{f:A.f,up:A.up}};}
 assert.ok(s.att.f[0]>.99,'its bow is on the point after 50 s at 0.5 rad/s: '+s.att.f.map(x=>x.toFixed(2)));
});
test('straight up likewise, and a craft already level is left as it was',()=>{
 let s={pos:[0,0,0],yaw:1,att:{f:[0,1,0],up:[0,1,0]}};for(let i=0;i<200;i++){const A=C.craftAttitudeStep({},s,[0,0,50000],.5,.25);s={...s,att:{f:A.f,up:A.up}};}
 assert.ok(s.att.f[2]>.99);
 const A=C.craftAttitudeStep({},{pos:[0,0,0],yaw:0,att:{f:[1,0,0],up:[0,1,0]}},[50000,0,0],.5,.25);assert.deepEqual(plain(A.f),[1,0,0]);assert.deepEqual(plain(A.up),[0,1,0]);
});
test('a craft whose stored lift vector lies along its bow gets one square to it, whatever the bow',()=>{
 for(const f of [[1,0,0],[-1,0,0],[0,0,1],[0,1,0],[0,-1,0]])for(const yaw of [0,Math.PI,1]){const A=C.craftAttitudeStep({},{pos:[0,0,0],yaw,att:{f,up:f}},[300,400,500],.5,.25);assert.ok(Math.abs(C.len(A.up)-1)<1e-9,'unit lift vector for bow '+f+' yaw '+yaw);assert.ok(Math.abs(C.dot(A.f,A.up))<1e-9);}
});
test('a bomber that comes out after the strike\'s target was chosen is sent at it too',()=>{
 const profiles={};for(const k of ['craft_tie_ln','craft_xwing',C.FLEET_AIR.roles.ywing.key/* 2026-11-24 the ywing role flies craft_ywing (the BTL-A4 example), was craft_btlb */]){const xs=C.buildDesign(k),S=C.computeStats(xs);profiles[k]={p:C.fleetProfile(S,xs.name,xs),liftSpare:Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass)};}
 const isd=C.fleetUnit('isd','imperial',plain(F.designs.imperial.p),1),foe=C.fleetUnit('foe','mc75',plain(F.designs.mc75.p),0);isd.pos=[40000,0,0];isd.yaw=Math.PI;foe.pos=[-40000,0,0];
 for(const u of [isd,foe])u.order={...u.order,type:'hold',fire:false};
 const B=C.fleetBattle([foe,isd],true);B.seed=5;C.fleetAirSetup(B,[{home:'foe',type:'ywing',count:12},{home:'foe',type:'xwing',count:12},{home:'isd',type:'tie_ln',count:12}],profiles,{});B.air.posture[0].strike=true;
 // the MC75's one mouth passes its craft slowly: the target is chosen when the first bomber is out, the others follow for many seconds
 let first=null;for(let t=0;t<60;t+=.25){C.fleetTick(B,.25,{});const out=B.units.filter(u=>u.sortie?.bomber&&u.team===0);if(first==null&&out.length)first=B.time;if(first!=null&&B.time>first+1){for(const y of out.filter(u=>!u.sortie.clearAt||B.time>u.sortie.clearAt+1))assert.equal(y.sortie.tgt,'isd','a bomber out at '+B.time+' s has the target');}}
 const out=B.units.filter(u=>u.sortie?.bomber&&u.team===0);assert.ok(out.length>=6,'several bombers came out after the first: '+out.length);assert.ok(out.every(u=>u.sortie.tgt==='isd'&&u.sortie.phase));
});
