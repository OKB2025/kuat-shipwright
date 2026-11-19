// User decisions 2026-11-19 on the ships' launchers:
//「ミサイルはそれにして対空対艦両方できるように(射程も航空も合わせる)」: the cell launcher fires the air missile (1 m by 4 m, 0.0471 TT)
//   to the air missile's range (10 km, it was 60 km), at ships and at craft.
//「魚雷はミサイルのと載せ替えるようにする」「航空機の魚雷の速度に艦魚雷も合わせて」「ミサイルへの載せ替えは大型ミサイルとして、魚雷と同じサイズのミサイル」
//   (asked which size: 7 m by 50 m): a heavy launcher has cells for the anti-ship torpedo (7 m by 50 m, 95% warhead, 54.84 TT,
//   600 m/s, ships only), which can be loaded with large missiles of the same size instead (50% warhead, 28.86 TT, 1500 m/s).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),near=(a,b,m)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${m||''} ${a} != ${b}`);
const fit=o=>({id:9,k:'shipMsl',launcherCols:2,launcherRows:2,p:[0,0,0],n:[0,1,0],a:2,ped:0,base:0,...o});
test('the cell launcher fires the air missile to the air missile range, whatever load is asked of small cells',()=>{
 for(const f of [fit(),fit({round:'torp'}),fit({round:'msl'})]){const s=C.missileLauncherSpec(f);
  assert.equal(s.kind,'shipMsl');near(s.tt,C.AIR_ROUNDS.missile.tt);assert.equal(s.range,10000);assert.equal(s.torp,undefined);assert.equal(s.heavy,undefined);assert.equal(s.ammoPerCell,6);assert.equal(s.ammo,24);near(s.volleyTT,4*C.AIR_ROUNDS.missile.tt);}
 assert.equal(C.missileRange('shipMsl'),10000);assert.equal(C.weaponPreviewStats(fit()).rangeM,10000);near(C.weaponPreviewStats(fit()).outputTT,C.AIR_ROUNDS.missile.tt);
});
test('heavy cells hold one 7 m by 50 m round each: the anti-ship torpedo, or the large missile instead',()=>{
 const torp=C.missileLauncherSpec(fit({launcherHeavy:true})),msl=C.missileLauncherSpec(fit({launcherHeavy:true,round:'msl'})),d=C.fitSpec(fit({launcherHeavy:true})),small=C.fitSpec(fit());
 near(C.SHIP_TORPEDO.tt,Math.PI/4*49*50*.95*.03);near(C.SHIP_MISSILE.tt,Math.PI/4*49*50*.5*.03);assert.deepEqual([...C.SHIP_MISSILE.dims],[...C.SHIP_TORPEDO.dims],'the same size');
 near(torp.tt,C.SHIP_TORPEDO.tt);assert.equal(torp.torp,true);assert.equal(torp.heavy,true);assert.equal(torp.ammoPerCell,1);assert.equal(torp.ammo,4,'one round a cell');assert.equal(torp.range,C.HEAVY_LAUNCHER.range);
 near(msl.tt,C.SHIP_MISSILE.tt);assert.equal(msl.torp,undefined);assert.equal(msl.heavy,true);assert.equal(msl.ammo,4);
 assert.equal(d.fm,50,'the box behind the mouths is 50 m deep, the length of the round (user decision 2026-11-19)');near(d.wm,2*12.1);near(d.hm,2*12.1);assert.ok(d.wm/2>=7,'a cell is wider than the 7 m round');assert.ok(d.mass>=4*C.SHIP_TORPEDO.mass,'and carry its mass');assert.ok(d.mass>small.mass*100);
 near(C.weaponPreviewStats(fit({launcherHeavy:true})).outputTT,C.SHIP_TORPEDO.tt);assert.equal(C.weaponPreviewStats(fit({launcherHeavy:true})).rangeM,C.HEAVY_LAUNCHER.range);
});
test('the torpedo flies at the speed of a craft\'s torpedoes, the missiles at a craft\'s speed',()=>{
 assert.equal(C.ROUND_SPEED.torpedo,600);assert.equal(C.ROUND_SPEED.missile,1500);
 assert.equal(C.roundSpeed({kind:'shipMsl',torp:true}),600);assert.equal(C.roundSpeed({kind:'shipMsl'}),1500);assert.equal(C.roundSpeed('shipMsl'),1500);assert.equal(C.roundSpeed('ptorp'),600);
});
test('a design keeps the cell size and the load through placement and its mirror, and the profile module carries them',()=>{
 for(const [round,tt,torp] of [[undefined,C.SHIP_TORPEDO.tt,true],['msl',C.SHIP_MISSILE.tt,undefined]]){
  const ship=C.newShip({L:900,W:300,H:150},'Heavy launcher ship'),h=C.rayEnv(ship,[450,400,60],[0,-1,0],{structOnly:true});
  C.placeFit(ship,'shipMsl',h.p,h.n,0,true,{launcherCols:1,launcherRows:1,launchYaw:0,launcherEmbedded:false,launcherHeavy:true,...(round?{round}:{})});
  const fits=ship.fits.filter(f=>f.k==='shipMsl');assert.ok(fits.length>=1);assert.ok(fits.every(f=>f.launcherHeavy===true&&f.round===round),'every placed launcher, the mirror too');
  const S=C.computeStats(ship),p=C.craftPowerProfile(ship,S),mods=p.modules.filter(m=>m.k==='launcher');assert.ok(mods.length>=1);
  for(const m of mods){assert.equal(m.heavy,true);assert.equal(m.torp,torp);near(m.tt,tt);assert.equal(m.ammoPerCell,1);assert.equal(m.stock,1);assert.equal(C.missileRange(m),C.HEAVY_LAUNCHER.range);}
 }
});
test('a heavy launcher fires one round from each cell and is then empty',()=>{
 const m={k:'launcher',fit:2,port:'f2',domain:'main',name:'Heavy',size:1,share:1,at:.5,powerConnected:true,stock:2,missileKind:'shipMsl',heavy:true,torp:true,ammoPerCell:1,launcherCells:2,missileRange:60000,salvo:2,cycle:1.2,tt:C.SHIP_TORPEDO.tt,launchPowerW:1e15,muzzle:[0,0,0],launchMuzzles:[[0,0,0],[0,0,8]],launchDir:[1,0,0]};
 assert.equal(C.missileRange(m),60000);
 const row=C.missileCellAmmo?C.missileCellAmmo({p:{modules:[m]},ammo:[2],launcherCellAmmo:[]},0):null;if(row)assert.deepEqual([...row],[1,1],'one round a cell, not six');
});
// Regression review 2026-11-19 (FAIL): the loader copied a launcher's grid but not its cell size or load, so heavy cells came
// back as small cells after Undo, autosave and a reload.
test('saving and loading keeps heavy cells and their load; small cells keep no load; an old save stays small',()=>{
 const make=o=>{const ship=C.newShip({L:900,W:300,H:150},'Launcher save'),h=C.rayEnv(ship,[450,400,60],[0,-1,0],{structOnly:true});C.placeFit(ship,'shipMsl',h.p,h.n,0,false,{launcherCols:2,launcherRows:1,launchYaw:0,launcherEmbedded:false,...o});return ship;};
 const back=ship=>C.deserialize(C.serialize(ship)).fits.find(f=>f.k==='shipMsl');
 let f=back(make({launcherHeavy:true}));assert.equal(f.launcherHeavy,true);assert.equal(f.round,undefined);assert.equal(C.missileLauncherSpec(f).torp,true);near(C.missileLauncherSpec(f).tt,C.SHIP_TORPEDO.tt);
 f=back(make({launcherHeavy:true,round:'msl'}));assert.equal(f.launcherHeavy,true);assert.equal(f.round,'msl');near(C.missileLauncherSpec(f).tt,C.SHIP_MISSILE.tt);
 const small=make({});small.fits.find(q=>q.k==='shipMsl').round='torp';f=back(small);assert.equal(f.launcherHeavy,undefined);assert.equal(f.round,undefined,'a load left on small cells by an earlier version is dropped');near(C.missileLauncherSpec(f).tt,C.AIR_ROUNDS.missile.tt);
 f=back(make({}));assert.equal(f.launcherHeavy,undefined);assert.equal(C.missileLauncherSpec(f).ammoPerCell,6);
 const a={id:1,k:'shipMsl',p:[0,0,0],a:2,launcherCols:1,launcherRows:1},b={...a,launcherHeavy:true},c={...b,round:'msl'};
 if(C.launcherStateKey){assert.notDeepEqual(C.launcherStateKey(a),C.launcherStateKey(b),'the recess cache sees the cell size');assert.notDeepEqual(C.launcherStateKey(b),C.launcherStateKey(c));}
});
// Physics review 2026-11-19 (FAIL): with no ship target of its own (cease fire, or every target masked) a ship near enemy craft
// stepped its launchers and spent their rounds while no round was launched. Missiles go to craft only from a ship that is firing
// at a ship beyond the missiles' reach.
test('in a fleet battle: no rounds are spent without a launch; missiles go to a craft when the ship fired at is out of their reach',()=>{
 const F=vm.runInContext('YardFleetData',cx),xs=C.buildDesign('craft_tie_ln'),craftP=C.fleetProfile(C.computeStats(xs),xs.name,xs);
 const setup=fire=>{const a=C.fleetUnit('a','mc75',JSON.parse(JSON.stringify(F.designs.mc75.p)),0),far=C.fleetUnit('far','cr90',JSON.parse(JSON.stringify(F.designs.cr90.p)),1),tie=C.fleetUnit('tie','craft_tie_ln',JSON.parse(JSON.stringify(craftP)),1);
  far.pos=[30000,0,0];far.yaw=Math.PI;tie.pos=[4000,300,0];tie.yaw=Math.PI;for(const x of far.sec){x.max*=1e6;x.s=x.max;}
  a.order={...a.order,type:'hold',fire,...(fire?{target:'far'}:{})};far.order={...far.order,type:'hold',fire:false};tie.order={...tie.order,type:'hold',fire:false};
  const B=C.fleetBattle([a,far,tie],true);B.seed=11;return {a,far,tie,B};};
 const sum=u=>u.ammo.reduce((n,x)=>n+(x||0),0);
 assert.ok(F.designs.mc75.p.modules.some(m=>m.k==='launcher'&&m.missileKind==='shipMsl'&&m.missileRange===10000),'the stored MC75 carries the small-cell launchers');
 let s=setup(false);const before=sum(s.a);for(let t=0;t<6;t+=.25)C.fleetTick(s.B,.25,{});
 assert.equal(sum(s.a),before,'cease fire: no round leaves its cell');assert.equal((s.B.missiles||[]).length,0);
 s=setup(true);const full=sum(s.a);for(let t=0;t<6;t+=.25)C.fleetTick(s.B,.25,{});const flown=(s.B.missileN||0);
 assert.ok(flown>0,'rounds were launched');assert.ok(sum(s.a)<full,'and left their cells');
 const log=JSON.stringify(s.B.missiles||[]);assert.ok(!/"target":"far"/.test(log),'none at the ship 30 km away, beyond the 10 km of the missiles');
});
