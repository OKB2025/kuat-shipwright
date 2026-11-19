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
 assert.equal(d.fm,12,'the box behind the mouths is 12 m deep (user instruction 2026-11-19)');near(d.wm,2*12.1);near(d.hm,2*12.1);assert.ok(d.wm/2>=7,'a cell is wider than the 7 m round');assert.ok(d.mass>=4*C.SHIP_TORPEDO.mass,'and carry its mass');assert.ok(d.mass>small.mass*100);
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
