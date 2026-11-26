const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {loadRuntime}=require('../scripts/update-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C,R,data}=loadRuntime(root);
const KT=1e-9,near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.abs(b)*1e-12,`${label}: ${a} != ${b}`);

// User decision 2026-11-11 (docs/dev-status-2026-11.md §1 4-2): aircraft lasers are rated by output per barrel per
// second; the shot is that output over one firing period.
// 2026-11-24 expectation changed (gun rules, docs/handoff-2026-11-20/gun-energy-model-2026-11-24.md; recorded in
// docs/benchmarks/gun-rules-2026-11-24/expectation-changes.md): an aircraft laser fires one shot a second a barrel, the shot
// from its bore by the laser rule (laserShotKt; heavy 0.30 m, medium 0.17 m, light 0.12 m = CRAFT_LASER_GEOMETRY). The old
// 400 / 50 / 10 kt/s classes are retired; the per-second output is now shot × rate.
// 2026-11-25 expectation changed (user「では0.3を800kt、0.05を50ktと扱い0.02まで口径を指定できるように」「面積比例で」「800ktで上限をつけるとは言ってない」;
// recorded in docs/benchmarks/gun-rules-2026-11-24/followup-2026-11-25/expectation-changes-2026-11-25.md): an aircraft laser's
// shot is C.craftLaserKt(bore) = 50 + 750 × (bore² − 0.05²) ÷ (0.30² − 0.05²) kt (was C.laserShotKt(bore) = 20 + 780 × (bore² − 0.10²)
// ÷ (0.40² − 0.10²), the ship laser's rule, which is unchanged). The bores are the same, so heavy 436 → 800 kt, medium 118.28 →
// 276.29 kt, light 42.88 → 152 kt.
const craftKt=bore=>50+750*(bore*bore-.05**2)/(.30**2-.05**2),shotTT=k=>C.craftLaserKt(C.CRAFT_LASER_GEOMETRY[k].bore)*KT,perSecond=k=>shotTT(k)/C.CRAFT_FIRE.cycles[k];
const CLASSES=[['claserH','heavy'],['claser','medium'],['cturret','light']];

test('aircraft laser classes carry the shot of their bore once a second per barrel',()=>{
 // 2026-11-25 expectation changed (aircraft laser yield, user as above): the classes follow C.craftLaserKt (was C.laserShotKt:
 // heavy 436 kt, medium 118.28 kt, light 42.88 kt).
 /* 2026-11-25, later the same day (user「同じ威力と置き換え」): the types' own bores and the example craft's were replaced by the bores that give the same shot under the new rule (C.craftLaserBoreOf20261124), so the shots are 118.28 / 42.88 / 436 kt again; the figures of 276.29 / 152 / 800 kt in the notes around here held only between the two decisions */near(C.CRAFT_LASER_OUTPUT.heavy,C.craftLaserKt(C.CRAFT_LASER_GEOMETRY.claserH.bore)*KT,'heavy');near(C.CRAFT_LASER_OUTPUT.medium,C.craftLaserKt(C.CRAFT_LASER_GEOMETRY.claser.bore)*KT,'medium');near(C.CRAFT_LASER_OUTPUT.light,C.craftLaserKt(C.CRAFT_LASER_GEOMETRY.claserL.bore)*KT,'light');near(C.CRAFT_LASER_OUTPUT_KT.heavy,436,'heavy keeps 436 kt');near(C.CRAFT_LASER_OUTPUT_KT.medium,118.28,'medium keeps 118.28 kt');near(C.CRAFT_LASER_OUTPUT_KT.light,42.88,'light keeps 42.88 kt');for(const [old,now]of [[.17,C.CRAFT_LASER_GEOMETRY.claser.bore],[.12,C.CRAFT_LASER_GEOMETRY.claserL.bore],[.30,C.CRAFT_LASER_GEOMETRY.claserH.bore]]){near(C.craftLaserBoreOf20261124(old),now,'bore of the same shot');near(C.craftLaserKt(now),C.laserShotKt(old),'same shot as the 2026-11-24 rule gave at '+old+' m');}near(C.craftLaserBoreOf20261124(.10),.02,'20 kt is below the new rule: the least bore');
 for(const bore of [.02,.05,.12,.17,.30,.40])near(C.craftLaserKt(bore),craftKt(bore),`craftLaserKt(${bore}) is the user's rule`);
 near(C.craftLaserKt(.05),50,'0.05 m = 50 kt');near(C.craftLaserKt(.30),800,'0.30 m = 800 kt');near(C.craftLaserKt(.40),1400,'0.40 m = 1,400 kt: no cap at 800 kt');near(C.craftLaserKt(.01),C.craftLaserKt(.02),'bores stop at 0.02 m');
 near(craftKt(.30),800,'a 0.30 m bore is 800 kt');near(craftKt(.17),276.2857142857143,'a 0.17 m bore would be 276.29 kt');near(craftKt(.12),152,'a 0.12 m bore would be 152 kt');assert.equal(C.CRAFT_LASER_OUTPUT_KT.medium.toFixed(2),'118.28');
 near(C.laserShotKt(.17),118.28,'the ship laser rule is unchanged');
 for(const [k,cls]of CLASSES){const d=C.FITS[k];assert.equal(d.outputClass,cls,k);assert.equal(C.CRAFT_FIRE.cycles[k],1,k+' one shot a second');near(d.barrelTTs,perSecond(k),k+' per barrel per second');}
});

test('per-shot energy is the per-second output times the firing period, barrel by barrel',()=>{
 for(const [k]of CLASSES){const d=C.FITS[k],rate=perSecond(k);
  assert.ok(d.cycle>0);assert.equal(d.cycle,C.CRAFT_FIRE.cycles[k],k+' firing period is the one combat uses');
  near(d.boltTT,rate*d.cycle,k+' per shot per barrel');near(d.tt,d.barrels*rate*d.cycle,k+' one complete volley');
  near(d.boltTT/d.cycle,rate,k+' per-second output per barrel');near(d.power,d.barrels*rate*C.TT,k+' electrical demand (W) is the per-second output of every barrel');
  const bank=C.weaponChargeSpec({k});near(bank.boltTT,d.boltTT,k+' charge bank shot');near(bank.volleyTT,d.tt,k+' charge bank volley');}
 // Barrel counts and periods are those of the existing definitions.
 // 2026-11-24 expectation changed: every period is 1 s (was .18 / .12 / .12) and the shots come from the bores (were 72 / 6 / 1.2 kt).
 assert.deepEqual(CLASSES.map(([k])=>[C.FITS[k].barrels,C.FITS[k].cycle]),[[1,1],[1,1],[2,1]]);
 near(C.FITS.claserH.boltTT,shotTT('claserH'),'heavy shot');near(C.FITS.claser.boltTT,shotTT('claser'),'medium shot');near(C.FITS.cturret.boltTT,shotTT('cturret'),'light shot');near(C.FITS.cturret.tt,2*shotTT('cturret'),'light twin volley');
});

test('a craft type sums every laser barrel of its fire-arc snapshot at its defined rate',()=>{
 const E=C.CRAFT_PRICE_CATALOG.entries,MEASURED={xwing:{claser:.18},arc170:{claser:.20},z95:{claser:.10}};
 // 2026-11-25 expectation changed in this test, the rule only (the craft named below and their bores / gun counts / rates are NOT
 // re-confirmed: they read the stored price catalogue, which is being rebuilt for the user's 16 refits):
 //  - yield: C.craftLaserKt(bore) where it was C.laserShotKt(bore) (user「では0.3を800kt、0.05を50ktと扱い…」「面積比例で」);
 //  - what lands: a plain nozzle firing faster than once a second hits 1/√(shots a second) of its output (user「ノズルそのままは
 //    発射速度を上げられるが上げるほど命中率は下がるしガスも使う」; C.craftLaserRule(f).hitK, C.craftLaserHitK), so a gun 0.25 s apart
 //    lands 4 × 0.5 = 2 × its shot a second (was 4 ×).
 const hitK=hz=>hz>1?1/Math.sqrt(hz):1;near(C.craftLaserHitK(4),.5,'four shots a second land half');near(C.craftLaserHitK(1),1);near(C.craftLaserHitK(4,'track'),1);
 // 2026-11-24 (gun rules) the X-wing, ARC-170 and Z-95 examples carry their measured barrels (CRAFT_LASER_EXAMPLES: X-wing 0.18 m
 // × 3.5 m, ARC-170 0.20 m × 2.04 m, Z-95 0.10 m × 1.04 m; user table), which craftLaserRate maps onto the type's snapshot.
 near(C.craftLaserRate('xwing'),4*C.craftLaserKt(C.craftLaserBoreOf20261124(.18))*KT,'X-wing: four medium lasers of its measured 0.18 m bore');
 near(C.craftLaserRate('z95'),2*C.craftLaserKt(C.craftLaserBoreOf20261124(.10))*KT/* 32 kt at the least bore 0.02 m (the old 20 kt cannot be had) */,'Z-95: two lasers of its measured 0.10 m bore, one shot a second (the user\'s refit of 2026-11-25 keeps its guns at 1.00 s)');
 for(const [type,entry]of Object.entries(E)){if(!Array.isArray(entry.fireArcs))continue;
  // 2026-11-24 expectation changed (gun rules): an example with measured barrels (MEASURED, the user's table) fires the shot of its bore.
  const expected=entry.fireArcs.reduce((n,a)=>{const d=C.FITS[a.k],bore=MEASURED[type]?.[a.k];return n+(d?.craft&&d.tt>0&&!d.store?d.barrels*(bore||a.boreM>0?C.craftLaserKt(a.boreM>0?a.boreM:bore)*KT:d.barrelTTs)*(hz=>hz*hitK(hz))(a.nozzle==='track'&&d.fixed?Math.min(1,a.rateHz>0?a.rateHz:1):a.rateHz>0?a.rateHz:1)/* 2026-11-25 expectation changed (user: the example craft fire every 0.25 s, the A-wing 0.1 s, wing-tip guns of the X-wing, TIE/in and TIE/D 1 s): each arc at its own rate */:0);},0);near(C.craftLaserRate(type),expected,type);}
 // 2026-11-24 expectation changed: medium / light per second are now shotTT('claser') / shotTT('claserL') (were 50 / 10 kt/s).
 // 2026-11-25 expectation changed (user「TIE/in、TIE/d、Xウィングの翼端以外は基本1門0.25で」): four shots a second a gun (was one), so 4 × the old figures below.
 near(C.craftLaserRate('tie_ln'),2*perSecond('claser')*C.CRAFT_LASER_RATE.hz*hitK(C.CRAFT_LASER_RATE.hz),'TIE/ln: two medium lasers, 0.25 s apart, half of them landing (2026-11-25: 946 → 1105 kt/s)');
 // 2026-11-24 expectation changed: the ARC-170 example is the user's remodel, armed with two medium and two light fixed lasers
 // (claser #39/#40, claserL #41/#42) where the old example had two heavy lasers and two light twin turrets (2*400+2*2*10).
 // 2026-11-24 (gun rules) its medium pair has the measured 0.20 m bore; the light lasers keep 0.12 m.
 near(C.craftLaserRate('arc170'),(2*C.craftLaserKt(C.craftLaserBoreOf20261124(.20))*KT+2*perSecond('claserL'))*C.CRAFT_LASER_RATE.hz*hitK(C.CRAFT_LASER_RATE.hz),'ARC-170: two measured 0.20 m medium and two light fixed lasers, 0.25 s apart');
 near(C.craftLaserRate('vwing'),2*2*perSecond('cturret')*C.CRAFT_LASER_RATE.hz*hitK(C.CRAFT_LASER_RATE.hz),'V-wing: two light twin turrets, 0.25 s apart');
 assert.equal(C.craftLaserRate('no-such-craft'),null);assert.equal(C.craftLaserRate(undefined),null);
 near(C.FLEET_AIR_GUN_DEFAULT,2*perSecond('claser'),'unknown types fly as a standard two-medium-laser fighter');
});

test('fleet profile per-craft air attack averages the deployable combat craft by their actual lasers',()=>{
 const wings=[{type:'tie_ln',deployable:24},{type:'arc170',deployable:6},{type:'lambda',deployable:2},{type:'tie_adv',deployable:2},{kind:'ship',type:'tie_ln',deployable:5},{type:'xwing',deployable:0}];
 const S={dims:[100,40,30],alphaRate:Array(6).fill(0),ionRate:Array(6).fill(0),aviation:{wings}},p=C.fleetProfile(S,'Carrier');
 // Shuttles, carried ships and craft that cannot launch do not join the attack; tie_adv has no snapshot and flies as the standard fighter.
 // 2026-11-24 ARC-170 as above; 2026-11-24 expectation changed (gun rules): the craft rates are those of craftLaserRate (was 50 / 10 kt/s classes).
 near(p.airGun,(24*C.craftLaserRate('tie_ln')+6*C.craftLaserRate('arc170')+2*C.FLEET_AIR_GUN_DEFAULT)/32,'mixed wing average');
 // 2026-11-25 expectation changed (user「ノズルそのままは発射速度を上げられるが上げるほど命中率は下がるしガスも使う」and the yield rule): two 276.29 kt
 // lasers 0.25 s apart land 2 × 4 × 0.5 × 276.29 = 1105 kt/s (was 2 × 4 × 118.28 = 946 kt/s). Reads the stored price catalogue (being rebuilt).
 near(C.craftLaserRate('tie_ln'),2*perSecond('claser')*C.CRAFT_LASER_RATE.hz*C.craftLaserHitK(C.CRAFT_LASER_RATE.hz),'TIE/ln two medium lasers, 0.25 s apart (2026-11-25 expectation changed: was one shot a second)');
 assert.equal(C.fleetProfile({...S,aviation:{wings:[]}},'Empty').airGun,undefined,'no combat craft, no airGun');
});

test('fleet profiles store airGun from the embarked wings and old profiles fall back to the standard fighter',()=>{
 near(C.fleetAirGun({airGun:8.4e-7}),8.4e-7);assert.equal(C.fleetAirGun({airGun:0}),0,'an unarmed wing does no laser damage');
 near(C.fleetAirGun({}),C.FLEET_AIR_GUN_DEFAULT,'a profile from before airGun');near(C.fleetAirGun({airGun:NaN}),C.FLEET_AIR_GUN_DEFAULT);
 // Was u.air × 0.6 TT/s: a TIE/ln wing now attacks at 100 kt/s per craft.
 assert.ok(C.FLEET_AIR_GUN_DEFAULT<1e-6,'the aggregate is physical TT/s, not the former 0.6 TT/s per craft');
});

test('fleet battle craft attack scales with the per-craft laser output and is zero for unarmed craft',()=>{
 const base=JSON.parse(JSON.stringify(data.designs.cr90.p));
 const damage=airGun=>{
  const p={...JSON.parse(JSON.stringify(base)),profileVersion:C.FLEET_PROFILE_VERSION,hp:1e9,acc:1,accel:0,maxSpeed:0,turnRate:0,D:0,shieldBuffer:0,reserve:0,gunArcs:Array(6).fill(0),ionArcs:Array(6).fill(0),gunBands:{long:Array(6).fill(0),mid:Array(6).fill(0),close:Array(6).fill(0)},aa:0,aaArcs:Array(6).fill(0),msl:0,imsl:0,slots:0,mass:1e9};
  delete p.dualPurpose;
  const a={...JSON.parse(JSON.stringify(p)),airGun};if(airGun==null)delete a.airGun;
  const u=C.fleetUnit('a-target','own',p,0),e=C.fleetUnit('z-carrier','enemy',a,1);u.pos=[0,0,0];e.pos=[12000,0,0];u.yaw=0;e.yaw=Math.PI;
  for(const x of [u,e])x.order={type:'hold',fire:true,power:'balanced',aim:'auto',volley:'stream'};
  e.air=10;const b=C.fleetBattle([u,e],true),hullOf=g=>g.sec.reduce((n,x)=>n+x.s,0)/* 2026-11-19 (PR #119, v30: u.hp is retired): the hull's state is the sum of its sections' structure */,before=hullOf(u)+(u.shield||0);C.fleetTick(b,.25,{collide:false});return before-(hullOf(u)+(u.shield||0));
 };
 assert.equal(damage(0),0,'no laser output, no craft damage');
 // 2026-11-19 expectation changed: airGun 1 and 2 TT/s became 2e-8 and 4e-8 TT/s. With v30 sections (u.hp retired,
 // docs/damage-penetration.md:20,60; docs/handoff-2026-11-19/README.md:45) the ignored hp:1e9 no longer keeps the CR90
 // alive, so 1 TT/s per craft sank it in the first tick and both values did the same damage. In 1e-8..2e-7 TT/s the
 // loss is still exactly proportional; below ~1e-9 whole shots quantise it.
 // 2026-11-24 expectation changed (gun rules): a craft bolt is now 118 kt (FLEET_AIR_GUN_BOLT, was 6 kt), so 2e-8 and 4e-8 TT/s
 // (10 craft × 0.25 s = 0.4 and 0.8 of one bolt) each land one whole shot and do the same damage. The pair is now one and two
 // bolts a second per craft; the loss of 118 kt bolts through the CR90's sections is no longer exactly linear (two / one = 1.992),
 // so the tolerance is 1% (was 1e-4).
 const bolt=C.CRAFT_LASER_OUTPUT.medium*C.CRAFT_FIRE.defaultCycle/* FLEET_AIR_GUN_BOLT */,one=damage(bolt),two=damage(2*bolt);assert.ok(one>0,'the craft aloft hit the target');assert.ok(Math.abs(two/one-2)<1e-2,`craft damage is proportional to airGun: ${two/one}`);
});

// 2026-11-24 expectation changed (gun rules): the light class is the 0.12 m shot once a second (was 10 kt/s).
test('the fixed light laser claserL fires the light-class shot per barrel like the light turret and is offered with the craft guns',()=>{
 const d=C.FITS.claserL;assert.equal(d.outputClass,'light');assert.equal(d.craft,true);assert.equal(d.fixed,true);assert.equal(d.barrels,1);
 near(d.barrelTTs,perSecond('claserL'),'per barrel per second');near(d.boltTT,perSecond('claserL')*d.cycle,'catalogue shot');assert.equal(d.cycle,C.CRAFT_FIRE.cycles.claserL);
 near(C.FITS.cturret.barrelTTs,d.barrelTTs,'same light class as the turret');assert.ok(d.cost>0&&d.mass>0);
});

test('a shot is the per-second output over the actual period of the arc, not the catalogue period',()=>{
 // 2026-11-24 expectation changed (gun rules): the per-second output is the bore's shot × 1/s (was 10 / 50 / 400 / 10 kt/s).
 for(const k of ['claserL','claser','claserH','cturret'])for(const cycle of [.06,.1,.12,.18,.3,1]){const d=C.FITS[k];
  near(C.craftShotTT(d,cycle),d.barrels*perSecond(k)*cycle,`${k} at ${cycle} s`);near(C.craftShotTT(d,cycle)/cycle,d.barrels*perSecond(k),`${k} output per second does not depend on cadence`);}
 near(C.craftShotTT(C.FITS.claser,.1),.1*shotTT('claser'),'claser at 0.1 s fires a tenth of its 276 kt per second (2026-11-25: was 118 kt)');near(C.craftShotTT(C.FITS.claser,1),shotTT('claser'),'claser at its 1 s period fires its whole shot');
 assert.equal(C.craftShotTT(C.FITS.htl,.25),C.FITS.htl.tt,'weapons without a per-second definition keep their catalogue volley');
});

test('fleet airGun per craft equals the RTS squadron energy per second for a custom 2 × claserH design, a table-only type and a modelled type',()=>{
 const arcs=[1,-1].map(z=>({k:'claserH',fixed:true,dir:[1,0,0],up:[0,1,0],pos:[2,0,z],gun:.5,aa:.5,cycle:.18})),craft={role:'fighter',speed:1500,aa:1,gun:10,strike:10,armor:1,crew:1,fireArcs:arcs};
 const S={dims:[100,40,30],alphaRate:Array(6).fill(0),ionRate:Array(6).fill(0)},one=row=>C.fleetProfile({...S,aviation:{wings:[{...row,deployable:6}]}},'Carrier').airGun;
 const rts=key=>R.squadLaserEnergy({craft:key,pos:[0,0,0],h:[1,0,0],laserGas:100},[1000,0,0],1);
 const key=R.registerDesignCraft({name:'Twin heavy',dims:[8,6,3],craft});assert.ok(key);
 near(one({dims:[8,6,3],design:{craft}}),rts(key),'custom design: same arcs, same rule');near(one({dims:[8,6,3],design:{craft}}),2*perSecond('claserH'),'two heavy lasers');// 2026-11-24 expectation changed (gun rules): was 2 × 400 kt/s
 for(const type of ['ywing','xwing']){assert.ok(R.CRAFT[type],type);near(one({type}),rts(type),type);}
 // 2026-11-24 expectation changed: the ARC-170 remodel's two light lasers are fixed tail guns (claserL #41/#42, dir [-1,0,0]), so a
 // target ahead meets only the nose pair. The fleet figure sums every barrel; it equals the RTS energy ahead plus astern.
 assert.ok(R.CRAFT.arc170);near(one({type:'arc170'}),rts('arc170')+R.squadLaserEnergy({craft:'arc170',pos:[0,0,0],h:[1,0,0],laserGas:100},[-1000,0,0],1),'arc170 ahead and astern');
 // 2026-11-24 expectation changed: the BTL-A4 Y-wing is now a modelled example (craft_ywing, its own fire-arc snapshot), so the
 // table-only estimate is checked on the B-wing, which still has no example.
 /* 2026-11-26 expectation changed: the B-wing is a modelled example now (the user's design, craft_bwing), so the table-only estimate is checked on the U-wing, which has none; the B-wing is checked as the modelled types are *//* the types left without an example are transports, which take no part in a fleet battle (no airGun), so the estimate is checked on the RTS side alone */near(rts('uwing'),Math.max(1,Math.round(R.CRAFT.uwing.aa*2))*perSecond('claser')/* 2026-11-24 gun rules: was 50 kt/s */,'table-only uwing: round(aa × 2) medium lasers as the RTS estimates');assert.ok(R.CRAFT.bwing);near(one({type:'bwing'}),rts('bwing'),'bwing');/* was eta2, taken out of the catalogue 2026-11-16 */
 near(one({type:'tie_adv'}),C.FLEET_AIR_GUN_DEFAULT,'a type neither table knows is a standard fighter');
});

test('a version-1 design craft snapshot with aircraft lasers is rebuilt once with the per-second laser model',()=>{
 const ship=C.buildDesign('craft_tie_ln'),S=C.computeStats(ship),fresh=C.designCraftSnapshot(ship,S,'save:tie');assert.ok(fresh);
 assert.equal(fresh.weaponProfileVersion,C.WEAPON_PROFILE_VERSION);assert.equal(C.WEAPON_PROFILE_VERSION,2);
 const old=JSON.parse(JSON.stringify(fresh));old.weaponProfileVersion=1;old.craft.systems={...old.craft.systems,laserUnits:old.craft.systems.laserUnits*3};
 for(const m of old.craft.powerProfile.modules||[])if(m.weaponPowerW)m.weaponPowerW/=3;
 // A forced refresh (weaponProfileVersion 0) rebuilds from the saved blueprint; a version-1 laser snapshot must do the same.
 const rebuilt=C.cleanDesignCraft(old),forced=C.cleanDesignCraft({...JSON.parse(JSON.stringify(fresh)),weaponProfileVersion:0});
 assert.equal(rebuilt.weaponProfileVersion,C.WEAPON_PROFILE_VERSION,'the 2 kt-era snapshot is recalculated');
 assert.deepEqual(JSON.parse(JSON.stringify(rebuilt.craft.powerProfile)),JSON.parse(JSON.stringify(forced.craft.powerProfile)),'power profile follows the current lasers');
 near(rebuilt.craft.systems.laserUnits,forced.craft.systems.laserUnits,'laser units');// 2026-11-25 expectation changed (aircraft laser yield and the kept gas unit; user「では0.3を800kt、0.05を50ktと扱い…」, the gas unit stays the
 // 118.28 kt/s of the standard laser before the rule changed = C.CRAFT_LASER_UNIT_KT): laser units = output ÷ 118.28 kt/s, so two
 // 276.29 kt lasers at four shots a second are 2 × 4 × 276.29 ÷ 118.28 = 18.69 units (was 8 = 2 × 4, when a 0.17 m laser was one unit).
 near(rebuilt.craft.systems.laserUnits,2*C.CRAFT_LASER_RATE.hz*C.craftLaserKt(C.CRAFT_LASER_GEOMETRY.claser.bore)/C.CRAFT_LASER_UNIT_KT,'two medium lasers firing every 0.25 s are 8 laser units of 118.28 kt/s (18.69 between the two decisions of 2026-11-25)');assert.equal(C.CRAFT_LASER_UNIT_KT,118.28);near(C.CRAFT_LASER_UNIT_W,118.28*KT*C.TT,'the unit in watts');
 const weaponW=q=>(q.craft.powerProfile.modules||[]).reduce((n,m)=>n+(m.weaponPowerW||0),0);// 2026-11-23 expectation changed: the TIE/ln example is the user's remodel, which also carries a torpedo tube (its 1e15 W draw).
 near(weaponW(rebuilt),2*C.FITS.claser.power*C.CRAFT_LASER_RATE.hz+C.FITS.ctorp.pw,'weapon power is two medium lasers at four shots a second and the torpedo tube (2026-11-25 expectation changed: was one shot a second)');
 assert.equal(C.cleanDesignCraft(fresh).weaponProfileVersion,C.WEAPON_PROFILE_VERSION);
});
