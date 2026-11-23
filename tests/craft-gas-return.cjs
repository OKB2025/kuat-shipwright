// 2026-11-23 (user: 「レーザーガスの容量をもっとシビアにして」「母艦に戻るように」): a craft spends its laser gas while its guns fire, a fighter
// whose gas is spent makes for its carrier and docks, the carrier fills its tanks, and it then takes a task again.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),plain=x=>JSON.parse(JSON.stringify(x));
test('a fighter out of laser gas docks with its carrier, is refilled and leaves again',()=>{
 const profiles={};for(const r of [C.FLEET_AIR.roles.tie_ln,C.FLEET_AIR.roles.ywing]){const xs=C.buildDesign(r.key),S=C.computeStats(xs);profiles[r.key]={p:C.fleetProfile(S,xs.name,xs),liftSpare:Math.max(0,(S.craftSystems?.landingSupport||0)-S.mass)};}const key=C.FLEET_AIR.roles.tie_ln.key;
 const gas=profiles[key].p.systems.laserGasSeconds;assert.ok(gas>0&&gas<600,'minutes of gas, not tens of minutes: '+gas);
 const home=C.fleetUnit('isd','imperial',plain(F.designs.imperial.p),0),foe=C.fleetUnit('mc','mc80liberty',plain(F.designs.mc80liberty.p),1);home.pos=[0,0,0];home.yaw=0;foe.pos=[40000,0,0];foe.yaw=Math.PI;
 for(const u of [home,foe]){u.order={type:'hold',fire:false};}
 const B=C.fleetBattle([home,foe],true);B.seed=3;C.fleetAirSetup(B,[{home:'isd',type:'tie_ln',count:12},{home:'mc',type:'ywing',count:12}],profiles,{first:[false,true]});
 let craft=null;for(let i=0;i<4*300&&!craft;i++){C.fleetTick(B,.25);craft=B.units.find(u=>u.sortie&&!u.dead&&u.team===0);}assert.ok(craft,'a craft is out');
 craft.laserGas=0;craft.sortie.stores=[];const squad=B.air.squadrons.find(q=>q.members.includes(craft.id));let landed=false,again=null;
 for(let i=0;i<4*900&&!again;i++){C.fleetTick(B,.25);if(!B.units.some(u=>u.id===craft.id))landed=true;if(landed)again=B.units.find(u=>u.sortie&&!u.dead&&u.team===0&&u.id!==craft.id&&squad&&squad.members.includes(u.id));}
 const text=B.events.map(e=>e.text).join('\n');
 assert.match(text,/レーザーガス切れのため/);assert.ok(landed,'it came aboard its carrier');assert.ok(again,'its squadron went up again');assert.ok(again.laserGas==null||again.laserGas>=gas*.999,'with its tanks full: '+again.laserGas);
});
