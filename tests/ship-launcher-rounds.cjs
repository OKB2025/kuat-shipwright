// User decisions 2026-11-19「ミサイルはそれにして対空対艦両方できるように(射程も航空も合わせる)」「魚雷はミサイルのと載せ替えるようにする。航空機と同じ
// 速度で直線的に突入してくるので普通に点防御で撃破できる形に」: a ship's launcher fires the air missile (1 m by 4 m, 0.0471 TT) to
// the air missile's range (10 km, it was 60 km), at ships and at craft; its cells can be loaded with torpedoes instead (the air
// torpedo, 0.0895 TT), which fly as the missiles do and are fired at ships only.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx),near=(a,b,m)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)),`${m||''} ${a} != ${b}`);
const fit=o=>({id:9,k:'shipMsl',launcherCols:2,launcherRows:2,p:[0,0,0],n:[0,1,0],a:2,ped:0,base:0,...o});
test('a ship launcher fires the air missile to the air missile range; loaded with torpedoes it fires the air torpedo',()=>{
 const msl=C.missileLauncherSpec(fit()),torp=C.missileLauncherSpec(fit({round:'torp'}));
 assert.equal(msl.kind,'shipMsl');near(msl.tt,C.AIR_ROUNDS.missile.tt);assert.equal(msl.range,10000);assert.equal(msl.range,C.ORDNANCE.cmsl.range);assert.equal(msl.torp,undefined);near(msl.volleyTT,4*C.AIR_ROUNDS.missile.tt);
 assert.equal(torp.kind,'shipMsl','the same launcher and cells');near(torp.tt,C.AIR_ROUNDS.torpedo.tt);assert.equal(torp.range,10000);assert.equal(torp.torp,true);assert.equal(torp.ammo,msl.ammo,'as many rounds');
 assert.equal(C.missileRange('shipMsl'),10000);assert.equal(C.missileRange({missileKind:'shipMsl'}),10000);
 near(C.weaponPreviewStats(fit()).outputTT,C.AIR_ROUNDS.missile.tt);near(C.weaponPreviewStats(fit({round:'torp'})).outputTT,C.AIR_ROUNDS.torpedo.tt);assert.equal(C.weaponPreviewStats(fit({round:'torp'})).rangeM,10000);
});
// User decision 2026-11-19「航空機の魚雷の速度に艦魚雷も合わせて」: the torpedo load flies at the speed of a craft's torpedoes.
test('missiles fly at a craft\'s speed and the torpedo load at the speed of a craft\'s torpedoes',()=>{
 assert.equal(C.roundSpeed('shipMsl'),C.ROUND_SPEED.missile);assert.equal(C.roundSpeed({kind:'shipMsl'}),1500);
 assert.equal(C.roundSpeed({kind:'shipMsl',torp:true}),C.ROUND_SPEED.torpedo);assert.equal(C.ROUND_SPEED.torpedo,600);assert.equal(C.roundSpeed('ptorp'),600);
});
test('a design keeps the load through placement and its mirror, and the profile module carries it',()=>{
 const ship=C.newShip({L:300,W:80,H:40},'Torpedo ship'),h=C.rayEnv(ship,[150,100,10],[0,-1,0],{structOnly:true});
 const made=C.placeFit(ship,'shipMsl',h.p,h.n,0,true,{launcherCols:2,launcherRows:1,launchYaw:0,launcherEmbedded:false,round:'torp'});
 const fits=ship.fits.filter(f=>f.k==='shipMsl');assert.ok(fits.length>=1);assert.ok(fits.every(f=>f.round==='torp'),'every placed launcher, the mirror too');
 const S=C.computeStats(ship),p=C.craftPowerProfile(ship,S),mods=p.modules.filter(m=>m.k==='launcher');assert.ok(mods.length>=1);
 for(const m of mods){assert.equal(m.torp,true);near(m.tt,C.AIR_ROUNDS.torpedo.tt);assert.equal(C.missileRange(m),10000);}
});
