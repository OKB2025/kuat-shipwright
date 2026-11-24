// 2026-11-24 user decisions for a ship's launchers: 「艦の発射機のミサイルは艦の至近まではレーダー誘導のみ（センサーと捕捉枠が必要）。近距離だと熱源
// 誘導が可能…熱源シーカーは10km、遠距離は50km」「センサー装置がある艦だけ」「ISD-72xのサイズ（容積）で4枠。通常のドームはサイズ可変なのでその容積
// により能力が変わる」「基本はレーダーで、航空対象などで外さないといけない時だけ熱源（ただ別の艦をロックしてしまう可能性やロックに失敗する可能性がある）」.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),G=C.SHIP_MSL_GUIDE;
function profile(dome=0,heavy=false){const launcher={k:'launcher',fit:2,port:'f2',domain:'main',name:'Launcher',size:1,share:1,at:.5,powerConnected:true,stock:6,missileKind:'shipMsl',missileRange:10000,salvo:1,cycle:1.2,tt:25,...(heavy?{heavy:true,ammoPerCell:1,stock:1,ammo0:1}:{}),launchPowerW:1e15,muzzle:[0,0,0],launchMuzzles:[[0,0,0]],launchDir:[1,0,0]};
 return {name:'Guide fixture',profileVersion:5,trackModel:1/* a profile made under the 2026-11-24 rule */,hp:1e6,D:0,shieldBuffer:0,reserve:0,wCap:0,crewNeed:1,crewMax:1,len:100,width:20,height:10,maxSpeed:0,turnRate:0,accel:0,acc:1,aa:0,gunArcs:[0,0,0,0,0,0],ionArcs:[0,0,0,0,0,0],gunBands:{long:[0,0,0,0,0,0],mid:[0,0,0,0,0,0],close:[0,0,0,0,0,0]},msl:25*20/1.2,imsl:0,
  modules:[{k:'reactor',part:1,port:'p1',domain:'main',size:1,share:1,at:.5},launcher,...(dome?[{k:'sensor',name:'dome',size:dome,trackVol:dome,share:1,at:.5,domain:'main'}]:[])],grid:{P:1e18,Pgen:1e18,Paux:0,fixed:1e15,cooling:0,De:0,Ds:0,Dw:0,fixedLoads:[{id:'f2',port:'f2',domain:'main',weight:1e15}]}};}
function target(craft=false){const p=profile();p.msl=0;p.modules=p.modules.slice(0,1);p.grid.fixed=0;p.grid.fixedLoads=[];if(craft){p.cls={name:'戦闘機',craft:true};p.len=12;}return p;}
function launch(dome,dist,craft=false,heavy=true){const u=C.fleetUnit('s','s',profile(dome,heavy),0),t=C.fleetUnit('t','t',target(craft),1);u.pos=[0,1000,0];t.pos=[dist,1000,0];u.order={...u.order,type:'attack',target:'t'};t.order={...t.order,fire:false};const b=C.fleetBattle([u,t],true);
 for(let i=0;i<20&&!(b.missiles||[]).length;i++)C.fleetTick(b,.1,{collide:false});return {b,u,m:(b.missiles||[])[0]};}

test('tracking slots (= anti-air channels, user「枠は対空交戦枠と同一」): 1 for each 5,000 m³ of working sensor volume outside the structure, rounded down; none without a dome (user「5000m3あたり1枠として」)',()=>{
 assert.equal(G.refVol,5000);assert.equal(C.shipTrackSlots({p:profile(30340)}),6,'an ISD-72x as mounted');assert.equal(C.shipTrackSlots({p:profile(9999)}),1);assert.equal(C.shipTrackSlots({p:profile(4999)}),0);assert.equal(C.shipTrackSlots({p:profile()}),0);
 const u=C.fleetUnit('s','s',profile(G.refVol),0);u.mods[2]=0;assert.equal(C.shipTrackSlots(u),0,'a destroyed dome gives none');
 const d=C.buildDesign('imperial'),P=C.fleetProfile(C.computeStats(d),d.name,d);assert.equal(P.aaCh,12,'the ISD\'s anti-air channels are its tracking slots');assert.equal(C.shipTrackSlots({p:P}),12,'the ISD: two ISD-72x domes; its tractor-beam control does not count (user「トラクタービーム管制装置は含まない」)');
});
test('beyond 10 km only a large missile goes, radar-guided out to 50 km with a slot; within 10 km heat-seeking without one',()=>{
 const far=launch(0,20000);assert.equal(far.m,undefined,'no dome: nothing at 20 km');
 const near=launch(0,8000);assert.equal(near.m?.shipGuide,'heat','no dome: heat-seeking at 8 km');
 // 2026-11-24 user「50kmのレーダー発射は大型ミサイルのみ」: a large missile goes radar-guided to 50 km at a ship or a craft; a cell launcher's
 // small missiles only within 10 km
 assert.equal(launch(G.refVol,20000,false,false).m,undefined,'small missiles: not at 20 km');assert.equal(launch(G.refVol,20000,true,false).m,undefined,'not at a craft 20 km off either');
 const radar=launch(G.refVol,20000);assert.equal(radar.m?.shipGuide,'radar','a large missile at a ship 20 km off');assert.ok(radar.m.range>=G.radarRange);assert.equal(launch(G.refVol,20000,true).m?.shipGuide,'radar','and at a craft');
 /* 2026-11-24 expectation changed (physics review; user「基本はレーダーで、航空対象などで外さないといけない時だけ熱源」): within 10 km a ship target with a slot free is engaged radar-guided, heat at a craft (was: heat within 10 km whatever the target) */assert.equal(launch(G.refVol,8000,false,false).m?.shipGuide,'radar','small missiles at a ship within 10 km, a slot free: radar');assert.equal(launch(G.refVol,8000,true,false).m?.shipGuide,'heat','at a craft: heat');
 assert.equal(C.missileMaxRange({p:profile(G.refVol,true)}),G.radarRange);assert.equal(C.missileMaxRange({p:profile(G.refVol)}),10000,'cell launchers keep 10 km');assert.equal(C.missileMaxRange({p:profile()}),10000);
});
test("a radar-guided round loses guidance with its ship's domes; at a craft it hands over to heat at 10 km",()=>{
 const r=launch(G.refVol,20000,true);r.u.mods[2]=0;C.fleetTick(r.b,.1,{collide:false});assert.equal(r.m.unguided,true,'the dome is gone');
 const m={pos:[0,0,0],vel:[1000,0,0],from:'s'},big={id:'big',pos:[5000,0,200],p:{propulsion:{massKg:1e9}}},small={id:'f',pos:[5000,0,-200],p:{propulsion:{massKg:1e4},cls:{craft:true}},yaw:0};
 let other=0;for(let i=0;i<200;i++){const pick=C.heatSeekerPick({seed:i+1},m,[big,small],small);if(pick===big)other++;}assert.ok(other>150,'beside a ship the heat seeker mostly takes the ship: '+other+'/200');
});

// 2026-11-24 physics review of the ship missile rules (FAIL items 1-4): a cell launcher throws its round up out of the hull, so
// the round's heading at launch is square to its target; the large missile's own 60 km is not its launch reach; the step's
// point-defence output is shared once over every salvo, close-in or tracked.
test('a cell round thrown up still finds its target: the heat seeker is cued at the target\'s bearing, a torpedo turns at it first',()=>{
 const t={id:'t',pos:[8000,0,0],p:{propulsion:{massKg:1e9}}},m={pos:[0,0,0],vel:[0,220,0],from:'s'};
 let got=0;for(let i=0;i<50;i++)if(C.heatSeekerPick({seed:i+1},m,[t],t)===t)got++;assert.equal(got,50,'a ship 90° off the round\'s heading');
 const ship=C.fleetUnit('a','a',profile(),0),foe=C.fleetUnit('t','t',target(),1);ship.pos=[0,0,0];foe.pos=[30000,0,0];foe.order={...foe.order,fire:false};const b=C.fleetBattle([ship,foe],true);
 const r={id:'r',salvo:'s',team:0,from:'a',target:'t',n:1,tt:1,kind:'ptorp',torp:true,inertial:true,torpLen:50,ion:false,range:400000,traveled:0,pos:[0,0,0],vel:[0,1200,0],s:1200,life:120,launchClearance:0,launchDir:[0,1,0]};b.missiles=[r];
 for(let i=0;i<200&&b.missiles.includes(r);i++)C.fleetTick(b,.25,{collide:false});
 assert.ok(!b.missiles.includes(r)||C.len(C.sub(foe.pos,r.pos))<5000,'it went at the ship (was: straight up, Vc = 0)');assert.ok(foe.hp<foe.p.hp||b.missileLog?.hit>0||C.len(C.sub(foe.pos,r.pos))<5000,'it reached it: '+JSON.stringify(b.missileLog));
});
test('the large missile launches radar-guided out to 50 km, not its round\'s 60 km; heat-seeking within 10 km',()=>{
 const p=profile(G.refVol,true);p.modules[1].missileRange=60000;assert.equal(C.missileMaxRange({p}),G.radarRange);
 const q=profile(0,true);q.modules[1].missileRange=60000;assert.equal(C.missileMaxRange({p:q}),G.heatRange,'no slot: the seeker\'s 10 km');
});
