// 2026-11-24 user decisions for a ship's launchers: 「艦の発射機のミサイルは艦の至近まではレーダー誘導のみ（センサーと捕捉枠が必要）。近距離だと熱源
// 誘導が可能…熱源シーカーは10km、遠距離は50km」「センサー装置がある艦だけ」「ISD-72xのサイズ（容積）で4枠。通常のドームはサイズ可変なのでその容積
// により能力が変わる」「基本はレーダーで、航空対象などで外さないといけない時だけ熱源（ただ別の艦をロックしてしまう可能性やロックに失敗する可能性がある）」.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),G=C.SHIP_MSL_GUIDE;
function profile(dome=0){const launcher={k:'launcher',fit:2,port:'f2',domain:'main',name:'Launcher',size:1,share:1,at:.5,powerConnected:true,stock:6,missileKind:'shipMsl',missileRange:10000,salvo:1,cycle:1.2,tt:25,launchPowerW:1e15,muzzle:[0,0,0],launchMuzzles:[[0,0,0]],launchDir:[1,0,0]};
 return {name:'Guide fixture',profileVersion:5,trackModel:1/* a profile made under the 2026-11-24 rule */,hp:1e6,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},msl:25*20/1.2,imsl:0,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher,...(dome?[{k:'sensor',name:'dome',size:dome,trackVol:dome,share:1,at:.5,domain:'main'}]:[])],grid:{P:1e18,Pgen:1e18,Paux:0,fixed:1e15,cooling:0,De:0,Ds:0,Dw:0,fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:1e15}]}};}
function target(){const p=profile();p.msl=0;p.modules=p.modules.slice(0,1);p.grid.fixed=0;p.grid.fixedLoads=[];return p;}
function launch(dome,dist){const u=C.fleetUnit('s','s',profile(dome),0),t=C.fleetUnit('t','t',target(),1);u.pos=[0,1000,0];t.pos=[dist,1000,0];u.order={...u.order,type:'attack',target:'t'};t.order={...t.order,fire:false};const b=C.fleetBattle([u,t],true);
 for(let i=0;i<20&&!(b.missiles||[]).length;i++)C.fleetTick(b,.1,{collide:false});return {b,u,m:(b.missiles||[])[0]};}

test('tracking slots (= anti-air channels, user「枠は対空交戦枠と同一」): 1 for each 5,000 m³ of working sensor volume outside the structure, rounded down; none without a dome (user「5000m3あたり1枠として」)',()=>{
 assert.equal(G.refVol,5000);assert.equal(C.shipTrackSlots({p:profile(30340)}),6,'an ISD-72x as mounted');assert.equal(C.shipTrackSlots({p:profile(9999)}),1);assert.equal(C.shipTrackSlots({p:profile(4999)}),0);assert.equal(C.shipTrackSlots({p:profile()}),0);
 const u=C.fleetUnit('s','s',profile(G.refVol),0);u.mods[2]=0;assert.equal(C.shipTrackSlots(u),0,'a destroyed dome gives none');
 const d=C.buildDesign('imperial'),P=C.fleetProfile(C.computeStats(d),d.name,d);assert.equal(P.aaCh,12,'the ISD\'s anti-air channels are its tracking slots');assert.equal(C.shipTrackSlots({p:P}),12,'the ISD: two ISD-72x domes; its tractor-beam control does not count (user「トラクタービーム管制装置は含まない」)');
});
test('beyond 10 km a ship launches only radar-guided, out to 50 km, with a slot; within 10 km heat-seeking without one',()=>{
 const far=launch(0,20000);assert.equal(far.m,undefined,'no dome: nothing at 20 km');
 const near=launch(0,8000);assert.equal(near.m?.shipGuide,'heat','no dome: heat-seeking at 8 km');
 const radar=launch(G.refVol,20000);assert.equal(radar.m?.shipGuide,'radar');assert.ok(radar.m.range>=G.radarRange);
 assert.equal(C.missileMaxRange({p:profile(G.refVol)}),G.radarRange);assert.equal(C.missileMaxRange({p:profile()}),10000);
});
test("a radar-guided round loses guidance with its ship's domes; at a craft it hands over to heat at 10 km",()=>{
 const r=launch(G.refVol,20000);r.u.mods[2]=0;C.fleetTick(r.b,.1,{collide:false});assert.equal(r.m.unguided,true,'the dome is gone');
 const m={pos:[0,0,0],vel:[1000,0,0],from:'s'},big={id:'big',pos:[5000,0,200],p:{propulsion:{massKg:1e9}}},small={id:'f',pos:[5000,0,-200],p:{propulsion:{massKg:1e4},cls:{craft:true}},yaw:0};
 let other=0;for(let i=0;i<200;i++){const pick=C.heatSeekerPick({seed:i+1},m,[big,small],small);if(pick===big)other++;}assert.ok(other>150,'beside a ship the heat seeker mostly takes the ship: '+other+'/200');
});
