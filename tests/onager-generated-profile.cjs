// Runs after actual catalogue generation; it never rebuilds a stock design.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const G=require('../scripts/update-ship-examples.cjs'),P=require('../scripts/replay-ship-examples.cjs'),root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C,data}=G.loadRuntime(root),plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b,e=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`),context={time:0,damage:1,rand:()=>.9,ev(){},sunk(){},out(){}};
function charged(key){const profile=plain(data.designs[key].p);for(const weapon of profile.sw||[])weapon.initialCharge=1;const unit=C.fleetUnit(key,key,profile);unit.pos=[0,0,0];unit.yaw=0;return unit;}
function step(unit,dt){return C.superweaponStep(unit,dt,{foes:[],all:[unit],bolts:[],ctx:context,damage:1});}
function conserved(unit){const ledger=unit.weaponLedger;near(ledger.initialJ+ledger.inputJ,ledger.storedJ+ledger.emittedJ+ledger.lossJ+ledger.releasedJ);}

test('generated Onager has two actual125PT profiles, a finite Venator plant and its long physical charging time',()=>{
 const profile=plain(data.designs.onager.p),venator=plain(data.designs.venator.p);assert.equal(profile.profileVersion,C.FLEET_PROFILE_VERSION);assert.equal(profile.sw.length,2);
 // Both plants target 3.6e24 W; their independently integrated reactor solids
 // need not have identical rounding residuals (the retained Venator is <1 ppm).
 near(profile.grid.P,3.6e24,1e-7);
 // 2026-11-24 expectation changed: the Venator example is now the user's Venator_1137m_Lite design (「ヴェネターはこの作例を使って」),
 // whose plant is 3.5467e24 W and shield input 4.24e23 W. The Onager was rated against the stock Venator, so its comparison uses the
 // stock Venator figures of f00cc2a (grid.P 3.6e24, grid.Ds 2.1685e23); the current Venator plant need only be finite.
 const stockVenator={P:3.6e24,Ds:2.1684686261745473e23};assert.ok(Number.isFinite(venator.grid.P)&&venator.grid.P>0,'a finite Venator plant');
 for(const key of ['shieldBuffer'])assert.ok(profile[key]/venator[key]>.9&&profile[key]/venator[key]<1.1,key+' is approximately the Venator rating');assert.ok(profile.grid.Ds/stockVenator.Ds>.9&&profile.grid.Ds/stockVenator.Ds<1.1,'the physical shield input follows the Venator design');
 for(const weapon of profile.sw){assert.equal(weapon.k,'sbeam');assert.equal(weapon.Emax,125000);assert.equal(C.SW_COMBAT[weapon.k].beamT,10);assert.deepEqual(weapon.axis,[1,0,0]);assert.ok(weapon.chargeT>800&&weapon.chargeT<900,'the actual main-reactor feed needs approximately fourteen minutes to refill each125PT store');near(weapon.chargeT*weapon.chargeW*weapon.efficiency,weapon.Emax*C.TT);}
 assert.ok(profile.sw.reduce((sum,weapon)=>sum+weapon.chargeW,0)<=profile.grid.P*.60000001);assert.ok(profile.sw[0].mz[2]*profile.sw[1].mz[2]<0,'two separate central barrel mouths');
 const directory=path.join(root,'assets/source/onager-shared-core-factory-blueprints'),manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'))),{blueprint}=P.readBlueprint(directory,'onager',manifest);for(const weapon of profile.sw){const part=blueprint.parts.find(part=>part.id===weapon.id);assert.ok(part?.weaponBody&&part.weaponMuzzle,'the cached emitter refers to its actual separately modelled machinery and muzzle');}const counts={};for(const fit of blueprint.fits.filter(fit=>C.FITS[fit.k]?.cat==='w'))counts[fit.k]=(counts[fit.k]||0)+1;assert.deepEqual(counts,{triple40:8,quad200:16,pd:30});const report=JSON.parse(fs.readFileSync(path.join(root,'docs/benchmarks/shared-engine-core-refit.json'))),row=report.models.find(row=>row.key==='onager');assert.equal(row.superweapons.length,2);for(const weapon of row.superweapons){assert.equal(weapon.energyTT,125000);assert.equal(weapon.beamDurationS,10);assert.ok(weapon.machineryVolumeM3>4e6);assert.ok(weapon.chargingInputW>7e23&&weapon.chargingInputW<7.1e23);}
});

// 2026-11-15: expectations changed with the firing loss (HEAT.swShot, user decision「発射の熱も排熱」; physics review):
// of the charge a shot spends, 2% stays in the ship as heat. The Onager still stores 250 PT and spends all of it;
// 245 PT leaves as the two beams (was: "emits exactly 250 PT"). The Subjugator's cannon likewise emits 98% of its store.
const BEAM=1-C.HEAT.swShot;assert.equal(C.HEAT.swShot,.02);
test('the actual generated Onager stores 250 PT and emits 98% of it over ten seconds in coarse and fine steps',()=>{
 for(const dt of [1,.25]){const unit=charged('onager');assert.equal(C.superweaponCommand(unit,null).queued,2);let energy=0;for(let n=0;n<10/dt;n++){const shots=step(unit,dt);assert.equal(shots.length,2);for(const shot of shots){near(shot.dur,dt);energy+=shot.energyTT;assert.deepEqual(plain(shot.axis),[1,0,0]);assert.deepEqual(plain(shot.to),[]);}conserved(unit);}near(energy,250000*BEAM);near(unit.weaponLedger.emittedJ,250000*BEAM*C.TT);near(unit.weaponLedger.initialJ,250000*C.TT);near(unit.weaponLedger.storedJ,0);assert.ok(unit.sw.every(weapon=>weapon.st==='cool'));assert.equal(step(unit,dt).length,0);conserved(unit);}
});

test('the actual generated Subjugator can release one ion cannon without consuming its other charged store',()=>{
 const unit=charged('subjugator');assert.equal(unit.p.sw.length,2);assert.equal(C.superweaponDischarge(unit,0,0),0,'initialize the common stored-energy ledger without emitting energy');const other=unit.sw[1].storedJ;near(other,unit.p.sw[1].Emax*C.TT);assert.equal(C.superweaponCommand(unit,{ids:[unit.p.sw[0].id]},{free:true,dir:unit.p.sw[0].axis}).queued,1);const shots=step(unit,0);assert.equal(shots.length,1);assert.equal(shots[0].i,0);assert.equal(unit.sw[0].st,'cool');assert.equal(unit.sw[1].st,'ready');near(unit.sw[1].storedJ,other);near(unit.weaponLedger.emittedJ,unit.p.sw[0].Emax*BEAM*C.TT);conserved(unit);
});
