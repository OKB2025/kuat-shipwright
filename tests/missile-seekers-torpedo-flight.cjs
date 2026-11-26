// 2026-11-24 user decisions: 「ミサイルは熱源および対レーダーの2種類を選べ。熱源の場合は構造物本体、エンジン、武装。レーダーの場合は探知ドーム系と
// 点防御」 (rounds cmsl / rmsl; against craft「熱源はエンジン、対レーダーはセンサー」) and「魚雷の誘導装置は艦艇クラスの重量にしか反応できない…
// 艦船は発射機で航空機の速度に加速させる…方向転換数、距離によって減衰する。なので魚雷も比例誘導に」.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx).designs,plain=x=>JSON.parse(JSON.stringify(x));
const prof=k=>{const s=C.buildDesign(k),S=C.computeStats(s);return plain(C.fleetProfile(S,s.name,s));};
const unit=(id,key,p,team)=>{const u=C.fleetUnit(id,key,plain(p),team);u.velocity=[0,0,0];u.order={...u.order,type:'hold',fire:false};return u;};

test('two missiles to choose from: heat (cmsl) and anti-radiation (rmsl), the same body, both fit a missile tube',()=>{
 assert.equal(C.ORDNANCE.cmsl.seeker,'heat');assert.equal(C.ORDNANCE.rmsl.seeker,'radar');assert.deepEqual(plain(C.ORDNANCE.rmsl.dims),plain(C.ORDNANCE.cmsl.dims));
 const tube={mount:'tube',bore:.45,len:1.2,slots:6};assert.equal(C.storeCapacity(tube,'rmsl'),C.storeCapacity(tube,'cmsl'));
});

test('seeker aims: heat goes for structure, an engine or a weapon of a ship and an engine of a craft; radar for a sensor or a point-defence mount',()=>{
 const isd={p:plain(F.imperial.p)},xw={p:prof('craft_xwing')},tie={p:prof('craft_tie_d')},bare={p:prof('craft_tie_ln')};/* 2026-11-24 expectation changed: the user's Rev2 TIE/ln and TIE/in carry no sensor (「むしろTIE/lnとinのセンサーを外した」) and a radar lock or passive shot needs one; the sensor craft here is the TIE/D */const b={seed:7};
 const heat=new Set(),radar=new Set();for(let i=0;i<60;i++){heat.add(String(C.missileSeekerAim(b,'cmsl',isd).aim));radar.add(String(C.missileSeekerAim(b,'rmsl',isd).aim));}
 assert.deepEqual([...heat].sort(),['engine','null','weapon']);assert.deepEqual([...radar].sort(),['sensor'])/* 2026-11-24 passive at a ship: the sensor that tracks the launcher (was sensor or point defence) */;
 assert.equal(C.missileSeekerAim(b,'cmsl',xw).aim,'engine');assert.equal(C.missileSeekerAim(b,'rmsl',tie).aim,'sensor');
 const blind=C.missileSeekerAim(b,'rmsl',bare);assert.equal(blind.blind,true,'the TIE/ln has no sensor: the anti-radiation round cannot guide');
 assert.equal(C.missileSeekerAim(b,'ptorp',isd),null,'a torpedo has no such seeker');
});

test('a heat missile that bursts on a TIE takes the section of one of its engines; a blind anti-radiation round flies straight',()=>{
 const a=unit('a','craft_xwing',prof('craft_xwing'),0),t=unit('t','craft_tie_ln',prof('craft_tie_ln'),1);a.pos=[0,0,0];t.pos=[2000,0,0];
 const b=C.fleetBattle([a,t],true);b.seed=3;C.fleetAirRelease(b,a,t,'cmsl',1,C.FLEET_AIR.kinds[1],null);assert.equal(b.missiles[0].aim,'engine');
 const eng=new Set(t.p.modules.map((m,i)=>m.k==='engine'?t.secOf[i]:null).filter(x=>x!=null));for(let i=0;i<20&&b.missiles.length;i++)C.fleetTick(b,.25,{});
 assert.ok(t.dead||t.secLost.some(si=>eng.has(si)),'an engine section was taken: '+JSON.stringify(t.secLost));
 const x=unit('x','craft_tie_in',prof('craft_tie_in'),1)/* no sensor (Rev2) */,c=unit('c','craft_tie_d',prof('craft_tie_d'),0);c.pos=[0,0,0];x.pos=[2000,0,0];const b2=C.fleetBattle([c,x],true);C.fleetAirRelease(b2,c,x,'rmsl',1,C.FLEET_AIR.kinds[1],null);
 assert.equal(b2.missiles[0].unguided,true);
});

test('a ship\'s torpedo leaves at a craft\'s speed, slows with distance and turning, steers by proportional navigation at a ship and flies straight at a craft',()=>{
 assert.equal(C.TORPEDO_FLIGHT.shipLaunch,1200);
 const fly=(target,kind='ptorp',len=50)=>{const a=unit('a','cr90',F.cr90.p,0);a.pos=[0,0,0];const b=C.fleetBattle([a,target],true);b.seed=1;
  const m={id:'m1',salvo:'s',team:0,from:'a',target:target.id,n:1,tt:1,kind,torp:true,inertial:true,torpLen:len,ion:false,range:400000,traveled:0,pos:[0,0,0],vel:[1200,0,0],s:1200,life:60,launchClearance:0,launchDir:[1,0,0]};
  b.missiles=[m];const sp=[];for(let i=0;i<40&&b.missiles.includes(m);i++){C.fleetTick(b,.25,{});sp.push(m.s);}return {m,sp,b};};
 const ship=unit('t','cr90',F.cr90.p,1);ship.pos=[30000,0,6000];const r=fly(ship);assert.equal(r.m.guide,'pn','proportional navigation at a ship');
 for(let i=1;i<r.sp.length;i++)assert.ok(r.sp[i]<=r.sp[i-1]+1e-9,'no motor: it only slows');
 const small=fly(unit('t2','cr90',F.cr90.p,1),'ptorp',1.3);small.b.units.find(u=>u.id==='t2').pos=[30000,0,6000];
 const big=fly(Object.assign(unit('t3','cr90',F.cr90.p,1),{pos:[60000,0,0]})),little=fly(Object.assign(unit('t4','cr90',F.cr90.p,1),{pos:[60000,0,0]}),'ptorp',1.3);
 assert.ok(big.m.s>little.m.s,'the ship\'s 50 m torpedo keeps its speed longer than a craft\'s 1.3 m one: '+big.m.s+' / '+little.m.s);
 const fighter=unit('f','craft_xwing',prof('craft_xwing'),1);fighter.pos=[8000,0,3000];const f=fly(fighter);assert.equal(f.m.unguided,true,'its seeker does not see a craft');
});

// 2026-11-24 user decision「レーダーロック発射、機首から30°で長距離発射する時。ロックした機体、艦に対して誘導で構造物に向かう。パッシブは自機にロック
// してる機体センサーに向かう。熱源は背面を取った方が当たりやすい」.
test('craftMissileChoice: passive at whatever tracks us (any direction), heat within 60° of the nose, radar fixed to the nose for a craft with a sensor',()=>{
 // 2026-11-24 user「熱源は自分の中心から60°範囲で視認方向のカーソルに合わせてロック。レーダーは機首固定（センサーを持つ機体のみ）。対レーダーは360°」
 /* 2026-11-24 expectation changed: the user's Rev2 TIE/ln and TIE/in carry no sensor (「むしろTIE/lnとinのセンサーを外した」) and a radar lock or passive shot needs one; the sensor craft here is the TIE/D */const p=prof('craft_tie_d'),me=unit('me','craft_tie_d',p,0),foe=unit('foe','craft_tie_ln',prof('craft_tie_ln'),1),locker=unit('lk','craft_tie_ln',prof('craft_tie_ln'),1);
 me.pos=[0,0,0];me.yaw=0;foe.pos=[2500,0,0];locker.pos=[-2000,0,-1500]/* behind us */;const b=C.fleetBattle([me,foe,locker],true);b.time=10;
 const at=(x,z)=>{foe.pos=[x,0,z];};const pick=k=>C.craftMissileChoice(b,b.units,me,foe,k,3000);
 at(2500,0);assert.equal(pick(['cmsl','rmsl']).mode,'heat');
 at(1500,2000);/* 53° off */assert.equal(pick(['cmsl']).mode,'heat','the heat cursor reaches 60°');assert.equal(pick(['rmsl']),null,'the radar does not (30°)');
 at(2500,1000);/* 22° */assert.equal(pick(['rmsl']).mode,'radar');
 at(500,2000);/* 76° */assert.equal(pick(['cmsl','rmsl']),null);
 const xw=unit('xw','craft_tie_ln',prof('craft_tie_ln'),0);xw.pos=[0,0,0];xw.yaw=0;b.units.push(xw);at(2500,0);
 assert.equal(C.craftMissileChoice(b,b.units,xw,foe,['rmsl'],3000),null,'a TIE/ln has no sensor: no radar lock');xw.lockWarn={from:'lk',at:9};assert.equal(C.craftMissileChoice(b,b.units,xw,foe,['rmsl'],3000),null,'nor a passive shot (「レーダーパッシブにもセンサーが必要」)');
 me.lockWarn={from:'lk',at:9};const ps=pick(['cmsl','rmsl']);assert.equal(ps.mode,'passive');assert.equal(ps.target.id,'lk','at what tracks us, even astern');
 assert.equal(pick(['cmsl']).mode,'heat','no anti-radiation round, no passive shot');
});
test('a ship engaging a craft tracks it with its sensors: the craft may fire a passive round at that ship\'s sensor',()=>{
 const isd=C.fleetUnit('isd','imperial',plain(F.imperial.p),1),tie=unit('t','craft_tie_d',prof('craft_tie_d'),0);/* 2026-11-24 expectation changed: the user's Rev2 TIE/ln and TIE/in carry no sensor (「むしろTIE/lnとinのセンサーを外した」) and a radar lock or passive shot needs one; the sensor craft here is the TIE/D */isd.pos=[0,0,0];tie.pos=[2500,0,0];isd.order={...isd.order,type:'attack',target:'t',fire:true};
 const b=C.fleetBattle([isd,tie],true);for(let i=0;i<4&&!tie.lockWarn;i++)C.fleetTick(b,.25,{});assert.equal(tie.lockWarn?.from,'isd','tracked by the ISD');
 const ps=C.craftMissileChoice(b,b.units,tie,null,['rmsl'],5000);assert.equal(ps?.mode,'passive');assert.equal(C.missileSeekerAim(b,'rmsl',isd,'passive').aim,'sensor');
});
test('a passive round is guided only while the track on its launcher stands',()=>{
 const p=prof('craft_tie_ln'),a=unit('a','craft_tie_ln',p,0),L=unit('L','craft_tie_d',prof('craft_tie_d'),1)/* the locker has a sensor to home on (Rev2: the TIE/ln none) */;a.pos=[0,0,0];L.pos=[2500,0,0];const b=C.fleetBattle([a,L],true);
 a.lockWarn={from:'L',at:0};C.fleetAirRelease(b,a,L,'rmsl',1,{...C.FLEET_AIR.kinds[1],seekMode:'passive'},null);const m=b.missiles[0];
 C.fleetTick(b,.25,{});assert.ok(!m.unguided,'guided while tracked');b.time+=C.MISSILE_SEEK.warnS+1;delete a.lockWarn;C.fleetTick(b,.25,{});assert.equal(m.unguided,true,'the track is cut, so is the guidance');
});
test('a radar-locked round is guided while the launcher keeps the target in its 30° cone and bursts on the structure; a passive one homes on the locker\'s sensor',()=>{
 const p=prof('craft_tie_d'),a=unit('a','craft_tie_d',p,0),t=unit('t','craft_tie_d',p,1)/* sensor craft (Rev2: the TIE/ln has none) */;a.pos=[0,0,0];a.yaw=0;t.pos=[2500,0,0];const b=C.fleetBattle([a,t],true);
 C.fleetAirRelease(b,a,t,'rmsl',1,{...C.FLEET_AIR.kinds[1],seekMode:'radar'},null);const m=b.missiles[0];assert.equal(m.seekMode,'radar');assert.equal(m.semiActive,true);assert.ok(m.aim==null,'no part: the structure');
 C.fleetAirRelease(b,a,t,'rmsl',1,{...C.FLEET_AIR.kinds[1],seekMode:'passive'},null);const q=b.missiles[1];assert.equal(q.aim,'sensor');assert.ok(!q.semiActive);
 const ship={p:plain(F.imperial.p)};assert.equal(C.missileSeekerAim({seed:1},'rmsl',ship,'radar').aim,null,'radar-locked at a ship: its structure');
});
test('a heat round holds to its target with 1 from dead astern and MISSILE_SEEK.heatBase head-on',()=>{
 const p=prof('craft_tie_ln'),heat=(tYaw)=>{const a=unit('a','craft_tie_ln',p,0),t=unit('t','craft_tie_ln',p,1);a.pos=[0,0,0];a.yaw=0;t.pos=[2000,0,0];t.yaw=tYaw;const b=C.fleetBattle([a,t],true);C.fleetAirRelease(b,a,t,'cmsl',1,C.FLEET_AIR.kinds[1],null);return b.missiles[0].heatP;};
 assert.ok(Math.abs(heat(0)-1)<1e-9,'astern');assert.ok(Math.abs(heat(Math.PI)-C.MISSILE_SEEK.heatBase)<1e-9,'head-on');assert.ok(Math.abs(heat(Math.PI/2)-(C.MISSILE_SEEK.heatBase+(1-C.MISSILE_SEEK.heatBase)/2))<1e-9,'beam');
});

// 2026-11-24 user decisions「発艦前に付与された任務によって搭載が変わる」「レーダーと対レーダーは同じミサイルで誘導方式を選べる」.
test('the load follows the mission: air superiority missiles (radar-guided first on a craft with a sensor), sensor suppression radar-guided, strike torpedoes and bombs',()=>{
 const load=(k,m)=>plain(C.craftOrdnance(C.buildDesign(k),C.missionLoad(C.buildDesign(k),m)).map(o=>o.kind+'x'+o.n));
 assert.deepEqual(load('craft_xwing','air'),['rmslx6'],'the Rev2 X-wing has a forward targeting sensor');assert.deepEqual(load('craft_xwing','sead'),['rmslx6']);assert.deepEqual(load('craft_xwing','strike'),['ptorpx4']);
 assert.deepEqual(load('craft_tie_ln','air'),['cmslx3'],'the Rev2 TIE/ln has no sensor');/* 2026-11-24 expectation changed (physics review): a craft without a sensor carries no radar-guided missile it could not fire (was: stations alternate cmsl, rmsl) */assert.deepEqual(load('craft_hyena','air'),['cmslx6','cmslx6'],'no sensor: heat-seeking throughout');assert.deepEqual(load('craft_hyena','sead'),['cmslx6','cmslx6'],'nor sensor suppression');
 /* 2026-11-26 expectation changed (user「爆弾は0.3の球」「爆弾倉の数は増える／爆弾倉のサイズによる」): the same bay holds 64 of the 0.3 m bombs (was 16 of the old body) */assert.deepEqual(load('craft_ywing','strike'),['ptorpx4','bombx64']);assert.ok(/レーダー誘導/.test(C.ORDNANCE.rmsl.name),'one missile, radar-guided or passive');
});
test('a strike carries one torpedo and one self-defence missile a tube (user「対艦攻撃も自衛用のミサイルを搭載して魚雷と混載」)',()=>{
 const ord=k=>plain(C.missionOrdnance(C.buildDesign(k),'strike').map(o=>o.kind+'x'+o.n));
 assert.deepEqual(ord('craft_xwing'),['ptorpx2','cmslx2'],'two tubes; the self-defence missile is heat-seeking (「自衛用のミサイルは基本熱源」)');assert.deepEqual(ord('craft_tie_ln'),['ptorpx1','cmslx1'],'one tube; no sensor: heat');
 /* 2026-11-26 expectation changed (same decision as above): 16 -> 64 bombs */assert.deepEqual(ord('craft_ywing'),['ptorpx2','cmslx2','bombx64'],'bombs stay in the bay');
 assert.ok(1/C.LAUNCHER_ROUNDS.torpedo+1/C.LAUNCHER_ROUNDS.missile<=1+1e-9,'a torpedo and a missile fit one tube');
});
