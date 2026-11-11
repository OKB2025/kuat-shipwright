const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {loadRuntime}=require('../scripts/update-ship-examples.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C,R,data}=loadRuntime(root);
const KT=1e-9,near=(a,b,label='value')=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.abs(b)*1e-12,`${label}: ${a} != ${b}`);

// User decision 2026-11-11 (docs/dev-status-2026-11.md §1 4-2): aircraft lasers are rated by output per barrel per
// second; the shot is that output over one firing period.
const CLASSES=[['claserH','heavy',400],['claser','medium',50],['cturret','light',10]];

test('aircraft laser classes carry 400 / 50 / 10 kt per barrel per second',()=>{
 near(C.CRAFT_LASER_OUTPUT.heavy,400*KT,'heavy');near(C.CRAFT_LASER_OUTPUT.medium,50*KT,'medium');near(C.CRAFT_LASER_OUTPUT.light,10*KT,'light');
 for(const [k,cls,ktPerS]of CLASSES){const d=C.FITS[k];assert.equal(d.outputClass,cls,k);near(d.barrelTTs,ktPerS*KT,k+' per barrel per second');}
});

test('per-shot energy is the per-second output times the firing period, barrel by barrel',()=>{
 for(const [k,,ktPerS]of CLASSES){const d=C.FITS[k],rate=ktPerS*KT;
  assert.ok(d.cycle>0);assert.equal(d.cycle,C.CRAFT_FIRE.cycles[k],k+' firing period is the one combat uses');
  near(d.boltTT,rate*d.cycle,k+' per shot per barrel');near(d.tt,d.barrels*rate*d.cycle,k+' one complete volley');
  near(d.boltTT/d.cycle,rate,k+' per-second output per barrel');near(d.power,d.barrels*rate*C.TT,k+' electrical demand (W) is the per-second output of every barrel');
  const bank=C.weaponChargeSpec({k});near(bank.boltTT,d.boltTT,k+' charge bank shot');near(bank.volleyTT,d.tt,k+' charge bank volley');}
 // Barrel counts and periods are those of the existing definitions.
 assert.deepEqual(CLASSES.map(([k])=>[C.FITS[k].barrels,C.FITS[k].cycle]),[[1,.18],[1,.12],[2,.12]]);
 near(C.FITS.claserH.boltTT,72*KT,'heavy shot');near(C.FITS.claser.boltTT,6*KT,'medium shot');near(C.FITS.cturret.boltTT,1.2*KT,'light shot');near(C.FITS.cturret.tt,2.4*KT,'light twin volley');
});

test('a craft type sums every laser barrel of its fire-arc snapshot at its defined rate',()=>{
 const E=C.CRAFT_PRICE_CATALOG.entries;
 for(const [type,entry]of Object.entries(E)){if(!Array.isArray(entry.fireArcs))continue;
  const expected=entry.fireArcs.reduce((n,a)=>{const d=C.FITS[a.k];return n+(d?.craft&&d.tt>0&&!d.store?d.barrels*d.barrelTTs:0);},0);near(C.craftLaserRate(type),expected,type);}
 near(C.craftLaserRate('tie_ln'),2*50*KT,'TIE/ln: two medium lasers');near(C.craftLaserRate('xwing'),4*50*KT,'X-wing: four medium lasers');
 near(C.craftLaserRate('arc170'),2*400*KT+2*2*10*KT,'ARC-170: two heavy lasers and two light twin turrets');
 near(C.craftLaserRate('vwing'),2*2*10*KT,'V-wing: two light twin turrets');
 assert.equal(C.craftLaserRate('no-such-craft'),null);assert.equal(C.craftLaserRate(undefined),null);
 near(C.FLEET_AIR_GUN_DEFAULT,2*50*KT,'unknown types fly as a standard two-medium-laser fighter');
});

test('fleet profile per-craft air attack averages the deployable combat craft by their actual lasers',()=>{
 const wings=[{type:'tie_ln',deployable:24},{type:'arc170',deployable:6},{type:'lambda',deployable:2},{type:'tie_adv',deployable:2},{kind:'ship',type:'tie_ln',deployable:5},{type:'xwing',deployable:0}];
 const S={dims:[100,40,30],alphaRate:Array(6).fill(0),ionRate:Array(6).fill(0),aviation:{wings}},p=C.fleetProfile(S,'Carrier');
 // Shuttles, carried ships and craft that cannot launch do not join the attack; tie_adv has no snapshot and flies as the standard fighter.
 near(p.airGun,(24*2*50*KT+6*(2*400*KT+2*2*10*KT)+2*C.FLEET_AIR_GUN_DEFAULT)/32,'mixed wing average');
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
  e.air=10;const b=C.fleetBattle([u,e],true),before=u.hp+(u.shield||0);C.fleetTick(b,.25,{collide:false});return before-(u.hp+(u.shield||0));
 };
 assert.equal(damage(0),0,'no laser output, no craft damage');
 const one=damage(1),two=damage(2);assert.ok(one>0,'the craft aloft hit the target');assert.ok(Math.abs(two/one-2)<1e-4,`craft damage is proportional to airGun: ${two/one}`);
});

test('the fixed light laser claserL fires 10 kt/s per barrel like the light turret and is offered with the craft guns',()=>{
 const d=C.FITS.claserL;assert.equal(d.outputClass,'light');assert.equal(d.craft,true);assert.equal(d.fixed,true);assert.equal(d.barrels,1);
 near(d.barrelTTs,10*KT,'per barrel per second');near(d.boltTT,10*KT*d.cycle,'catalogue shot');assert.equal(d.cycle,C.CRAFT_FIRE.cycles.claserL);
 near(C.FITS.cturret.barrelTTs,d.barrelTTs,'same light class as the turret');assert.ok(d.cost>0&&d.mass>0);
});

test('a shot is the per-second output over the actual period of the arc, not the catalogue period',()=>{
 for(const [k,ktPerS]of [['claserL',10],['claser',50],['claserH',400],['cturret',10]])for(const cycle of [.06,.1,.12,.18,.3]){const d=C.FITS[k];
  near(C.craftShotTT(d,cycle),d.barrels*ktPerS*KT*cycle,`${k} at ${cycle} s`);near(C.craftShotTT(d,cycle)/cycle,d.barrels*ktPerS*KT,`${k} output per second does not depend on cadence`);}
 near(C.craftShotTT(C.FITS.claser,.1),5*KT,'claser at 0.1 s fires 5 kt shots');
 assert.equal(C.craftShotTT(C.FITS.htl,.25),C.FITS.htl.tt,'weapons without a per-second definition keep their catalogue volley');
});

test('fleet airGun per craft equals the RTS squadron energy per second for a custom 2 × claserH design, a table-only type and a modelled type',()=>{
 const arcs=[1,-1].map(z=>({k:'claserH',fixed:true,dir:[1,0,0],up:[0,1,0],pos:[2,0,z],gun:.5,aa:.5,cycle:.18})),craft={role:'fighter',speed:1500,aa:1,gun:10,strike:10,armor:1,crew:1,fireArcs:arcs};
 const S={dims:[100,40,30],alphaRate:Array(6).fill(0),ionRate:Array(6).fill(0)},one=row=>C.fleetProfile({...S,aviation:{wings:[{...row,deployable:6}]}},'Carrier').airGun;
 const rts=key=>R.squadLaserEnergy({craft:key,pos:[0,0,0],h:[1,0,0],laserGas:100},[1000,0,0],1);
 const key=R.registerDesignCraft({name:'Twin heavy',dims:[8,6,3],craft});assert.ok(key);
 near(one({dims:[8,6,3],design:{craft}}),rts(key),'custom design: same arcs, same rule');near(one({dims:[8,6,3],design:{craft}}),2*400*KT,'two heavy lasers');
 for(const type of ['eta2','xwing','arc170']){assert.ok(R.CRAFT[type],type);near(one({type}),rts(type),type);}
 near(one({type:'eta2'}),Math.max(1,Math.round(R.CRAFT.eta2.aa*2))*50*KT,'table-only eta2: round(aa × 2) medium lasers as the RTS estimates');
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
 near(rebuilt.craft.systems.laserUnits,forced.craft.systems.laserUnits,'laser units');near(rebuilt.craft.systems.laserUnits,2,'two medium lasers are two laser units');
 const weaponW=q=>(q.craft.powerProfile.modules||[]).reduce((n,m)=>n+(m.weaponPowerW||0),0);near(weaponW(rebuilt),2*C.FITS.claser.power,'weapon power is two medium lasers');
 assert.equal(C.cleanDesignCraft(fresh).weaponProfileVersion,C.WEAPON_PROFILE_VERSION);
});
