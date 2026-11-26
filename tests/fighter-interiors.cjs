const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,label,e=1e-9)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${label}: ${a} != ${b}`);
const fixtures=new Map();function fixture(key){if(!fixtures.has(key)){const ship=C.buildDesign(key),stats=C.computeStats(ship);fixtures.set(key,{ship,stats});}return fixtures.get(key);}
/* 2026-11-16 engine curve B (user decision: waste = clamp(0.05*sqrt(L),0,0.6), L = input / normal input). The waste of a run is no longer a flat
   5% of its input; each core's waste follows the curve at that core's own load. normalInputW comes from the installed engine, not from the result. */
const curveWaste=(propulsion,engines)=>{const normal=new Map(engines.map(e=>[e.machineryId??e.id,e.normalInputW]));return (propulsion.cores||[]).reduce((n,c)=>{const N=normal.get(c.id),L=N>0?c.actualInputW/N:c.loadFactor;return n+c.actualInputW*C.engineWasteFraction(L);},0);};
for(const [key,target] of Object.entries(C.CRAFT_INTERIOR_TARGETS))test(`${key}: finite physical plant, complete systems and powered flight survive a 30 second firing run`,()=>{
 const {ship,stats:S}=fixture(key),engines=C.propulsionProfile(ship,S).engines;
 assert.ok(engines.length);for(const e of engines){assert.equal(e.valid,true,JSON.stringify(e.issues));assert.equal(e.available,true,`engine ${e.id}`);assert.equal(e.connected,true);assert.equal(e.outletAvailable,true);assert.notEqual(e.machineryGradeId,'legacy-refit');assert.equal(e.legacyCoolingInputW,0);assert.ok(e.ratedInputW<=e.maxInputW);}
 assert.equal(Object.values(S.info).some(p=>p.overlap),false,'equipment and physical engine feeds must not overlap');
 /* 2026-11-16 engine curve B (user decision, this PR): the old check was near(ratedAccel/G0, target.g, 1e-4). CRAFT_REACTOR_SCALE was calibrated so each
    plant met target.g under the retired flat 5% engine waste; at rated input these engines run far above their normal input (L ~ 10-60), so curve B
    wastes 10-35% and the component-rated acceleration now falls below the construction target (e.g. ARC-170 3551 -> 2248 G). That fall is the intended
    physics, so the target is now an upper bound, and the rated figure must still be the installed plant's own curve-B thrust over the craft's mass. */
 /* 2026-11-24 expectation changed for the user's remodels (C.isCraftRemodel; user: 「リモデルで作例を揃える」): their plants are wired by
    the designer, not by the factory refit, and the rated figure is what the shared supply solve gives the engines. The ARC-170 and
    BTL-B remodels reach 81% and 73% of their engines' own curve-B thrust at rated input, so for a remodel the rated thrust is
    bounded by that sum instead of equal to it. Their designer-drawn heat links may carry no capacity (the runtime default,
    HEAT.linkK, applies), so for a remodel a saved heat link is finite or unset. Factory craft keep both checks as they were. */
 const remodel=C.isCraftRemodel(key);
 {let thrustN=0;for(const e of [...new Map(engines.map(e=>[e.machineryId??e.id,e])).values()])thrustN+=C.engineOperatingPoint(e,e.ratedInputW).actualThrustN;if(remodel)assert.ok(S.propulsion.ratedThrustN>0&&S.propulsion.ratedThrustN<=thrustN*(1+1e-4),'remodel: rated thrust within the curve-B thrust of the installed engines');else near(S.propulsion.ratedThrustN,thrustN,'rated thrust is the curve-B thrust of the installed engines',1e-4/* computeStats' figure sits ~1.7e-5 below the profile's per-engine sum; kept at the old 1e-4 (±0.1% allowed, docs/handoff-2026-11-12.md) */);near(S.propulsion.ratedAccelMps2,S.propulsion.ratedThrustN/(S.mass*1000),'component-rated acceleration after physical packing',1e-9);assert.ok(S.propulsion.ratedAccelMps2/C.G0<=target.g*(1+1e-3),`curve B cannot lift ${key} above its flat-5% construction target: ${S.propulsion.ratedAccelMps2/C.G0} > ${target.g}`);}
 /* 2026-11-16 curve B: the combat preset budgets engine INPUT (HEAT_PRESETS.combat.eng of the rated input). The old check bounded outputRatio (a thrust
    ratio) by .35, which only held while efficiency was load-independent; at part load curve B wastes less, so thrust ratio > input ratio. */
 assert.ok(Number.isFinite(S.propulsion.outputRatio)&&S.propulsion.outputRatio>=0&&S.propulsion.outputRatio<=1+1e-9,'default combat output ratio is finite');assert.ok(S.propulsion.actualInputW<=C.HEAT_PRESETS.combat.eng*S.propulsion.ratedInputW*(1+1e-9),'default combat output obeys the shared source budget');near(S.propulsion.wasteHeatW,curveWaste(S.propulsion,engines),'default combat engine waste (curve B)',1e-9);
 assert.equal(S.heat.mode,'strict');assert.equal(S.heat.builtin,0);assert.equal(S.heat.legacy,0);const high=S.heat.net.dis.filter(d=>d.part!=null);assert.ok(high.length,'real high-energy dissipators are installed');for(const d of high){const part=ship.parts.find(p=>p.id===d.part);assert.ok(part&&C.partVolume(part)>0,'every cooler belongs to actual paid hardware');assert.ok(C.DISSIPATORS[part.k]||C.isWing(part),'the source is an installed dissipator or cooling wing');assert.ok(Number.isFinite(d.cap)&&d.cap>0);near(d.cap,C.dissipatorCap(part,S),'physical cooling capacity');assert.ok(Number.isFinite(d.power)&&d.power>0,'each high-energy cooler requires finite electrical input');}assert.ok(S.dissipatorPower>0,'cooling uses finite electrical input');assert.ok(S.heat.net.dis.every(d=>d.k!=='integral'&&d.k!=='legacy'&&!d.legacy),'no implicit cooling nodes');
 assert.ok(ship.links.filter(l=>l.kind==='heat').every(l=>remodel&&l.cap==null||Number.isFinite(l.cap)&&l.cap>=0),'finite saved heat transports');
 assert.equal(S.craftSystems.fireK,1);assert.equal(S.craftSystems.turnK,1);assert.equal(S.craftSystems.navReady,true);
 /* 2026-11-24 expectation changed: the V-19 and Z-95 remodels lack landing support once their pylons are launch tubes again
    (17.7/18.7 t, 29.5/30.7 t) and the V-wing remodel as the user drew it (12.4/12.9 t); reported to the user, designs not altered.
    Every other craft example still lands. */
 /* 2026-11-25 expectation changed (user「航空機はこっちで作り直す」: the 16 craft examples are the user's refit designs of 2026-11-25,
    docs/handoff-2026-11-20/refs/aircraft-refit-16-specs-2026-11-25.csv; expectation-changes-2026-11-25.md): the refit V-19, V-wing and Z-95 have
    landing support (landingReady true), so every craft example lands. Was: landingReady false for craft_v19, craft_vwing and craft_z95. */
 assert.equal(S.craftSystems.landingReady,true,'landing support');
 const driveProfile=C.fleetProfile(S,ship.name,ship),drive=C.fleetUnit(key+'-drive',key,driveProfile,0);C.heatInit(drive);C.allocateShipPower(drive,C.fleetSystems(drive),{throttle:1,weapons:0,shields:0},.5,'balanced');assert.ok(drive.propulsion.actualInputW>0&&drive.propulsion.actualThrustN>0&&drive.propulsion.actualAccelMps2>0,'the installed plant powers drive-only flight');for(const source of drive.propulsion.power.sources)assert.ok(source.drawW>=0&&source.drawW<=source.availableW*(1+1e-12),'drive-only power is paid by the finite source');
 const p=C.fleetProfile(S,ship.name,ship),u=C.fleetUnit(key,key,p,0);u.order={...u.order,power:'balanced'};u.maneuver=1;C.heatInit(u);u.ht.t=0;u.ht.last=0;if(u.fo){u.fo.d.fill(1);u.fo.want.fill(1);}
 for(let i=0;i<60;i++){
  const {got,propulsion}=C.allocateShipPower(u,C.fleetSystems(u),{throttle:1,weapons:p.grid.Dw,shields:p.grid.Ds},.5,'balanced');
  assert.ok(propulsion.outputRatio>=0&&propulsion.outputRatio<=1+1e-9,'finite shared power bounds propulsion');assert.ok(got.weapons>=0&&got.weapons<=p.grid.Dw*(1+1e-9),'finite shared power bounds guns');assert.ok(got.shields>=0&&got.shields<=p.grid.Ds*(1+1e-9),'finite shared power bounds shields');near(propulsion.wasteHeatW,curveWaste(propulsion,engines),'engine waste (curve B, 2026-11-16: was a flat actualInputW*.05)');
  for(const source of propulsion.power.sources)assert.ok(source.drawW<=source.availableW*(1+1e-12),'one source cannot be spent twice');
  C.heatTick({time:(i+1)*.5,ev(){}},u,.5);
 }
 assert.equal(Math.min(...u.ht.lm),1,'no immediate thermal limiter during the checked run');
 const loaded=C.deserialize(C.serialize(ship)),L=C.computeStats(loaded);
 near(L.mass,S.mass,'saved physical mass');near(L.power,S.power,'saved reactor power');near(L.propulsion.ratedInputW,S.propulsion.ratedInputW,'saved engine rating');near(L.propulsion.actualInputW,S.propulsion.actualInputW,'saved actual input');
 assert.deepEqual(plain(L.dims),plain(S.dims));assert.deepEqual(plain(C.serialize(loaded).links),plain(C.serialize(ship).links),"saved power and heat links");
});

test('loading a modified fighter preserves its authored machinery and does not refit it again',()=>{
 const original=C.serialize(fixture('craft_awing').ship),engine=original.parts.find(p=>p.k==='engine');engine.ratedInputW*=.5;original.parts=original.parts.filter(p=>p.k!=='navComputer');
 const loaded=C.deserialize(original);near(loaded.parts.find(p=>p.id===engine.id).ratedInputW,engine.ratedInputW,'player engine rating');assert.equal(loaded.parts.some(p=>p.k==='navComputer'),false);assert.equal(loaded.parts.length,original.parts.length);
});

// A saved edit must expose a missing plant rather than creating compatibility cooling.
test('removing a saved fighter cooling bank leaves real thermal shortfall without automatic replacement',()=>{
 const original=C.serialize(fixture('craft_awing').ship),coolers=original.parts.filter(p=>p.k==='hdis');assert.ok(coolers.length);
 original.parts=original.parts.filter(p=>p.k!=='hdis');const loaded=C.deserialize(original),S=C.computeStats(loaded);
 assert.equal(loaded.parts.some(p=>p.k==='hdis'),false);assert.equal(S.heat.mode,'strict');assert.equal(S.heat.builtin,0);assert.equal(S.heat.legacy,0);assert.ok(S.heat.presets.combat.overCount>0);
 assert.ok(S.heat.net.dis.every(d=>d.k!=='integral'&&d.k!=='legacy'&&!d.legacy));
});
