const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {C, R} = vm.runInContext('({C:Core,R:Rts})', context);
const near = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10,
  `${actual} != ${expected}`,
);

const planningMassKg = 1e6, planningInputW = planningMassKg * 500 * C.engineConversionCoefficient(planningMassKg);
function powerProfile() {
  const engine = {
    id: 2, machineryId: 2, ratedInputW: planningInputW, effectiveMachineryVolumeM3:planningInputW/3.4e17, ratedThrustN: 5e8,
    wattsPerNewton: C.engineConversionCoefficient(planningMassKg), driveProfileId: 'standard', machineryGradeId: 'standard',
    machineryLengthM: 2, machineryRadiusM: 1, moduleIndex: 1,
    powerNode: 'p2', heatNode: 'p2', domain: 'main', direction: [1, 0, 0],
    valid: true, available: true, connected: true, outletAvailable: true,
    pathCapacityW: planningInputW,
  };
  return {
    profileVersion: C.FLEET_PROFILE_VERSION, name: 'Planning regression fixture',
    hp: 100, D: 0, shieldBuffer: 0, wCap: 0, crewNeed: 1, crewMax: 1,
    len: 10, width: 4, height: 3,
    modules: [
      {k: 'reactor', part: 1, port: 'p1', domain: 'main', size: 1, share: 1},
      {k: 'engine', part: 2, port: 'p2', domain: 'main', size: 1, share: 1},
    ],
    grid: {P: planningInputW, Pgen: planningInputW, Paux: 0, fixed: 0, cooling: 0, De: planningInputW, Ds: 0, Dw: 0},
    propulsion: {
      version: C.PROPULSION_MODEL_VERSION, engines: [engine], massKg: 1e6,
      ratedThrustN: 5e8, ratedAccelMps2: 500,
      structuralAccelerationLimitMps2: 300, inertialFactor: .5,
      accelerationLimitMps2: 150,
    },
  };
}

test('live propulsion retains its planning limits across throttle and power changes', () => {
  const p = powerProfile().propulsion;
  for (const [throttle, powerW, expected] of [
    [1, planningInputW, 150], [.25, planningInputW, 125], [0, planningInputW, 0], [1, 0, 0],
  ]) {
    const result = C.solveShipPropulsion(p, {
      throttle, sources: [{id: 'p1', domain: 'main', powerW}],
    });
    assert.equal(result.ratedAccelMps2, 500);
    assert.equal(result.structuralAccelerationLimitMps2, 300);
    assert.equal(result.inertialFactor, .5);
    assert.equal(result.accelerationLimitMps2, 150);
    near(result.actualAccelMps2, expected);
  }
});

test('a real architecture-two engine and paid feed retain planning limits while actual watts, force and heat follow the allocation', () => {
  const rated = 1e18;
  const ship = C.newShip({L: 300, W: 160, H: 120, sec: 'rect', plan: 'rect', bowW: 1, bowH: 1, stern: 1}, 'Independent planning limits');
  ship.parts = [
    {id: 1, k: 'gen', c: [200, 60, 0], d: 20},
    {id: 2, k: 'engineCore', c: [180, 60, 0], d: 8, length: 12, dir: [-1, 0, 0], reactor: 1, busFeed: true,
      propulsionModelVersion: 1, ratedInputW: rated, driveProfileId: 'standard', machineryGradeId: 'standard', legacyCoolingInputW: 0},
    ...[-30, 30].map((z, i) => ({id: 3 + i, k: 'engine', c: [5, 60, z], d: 10, nozzleLength: 10, dir: [-1, 0, 0], machineryId: 2, propulsionModelVersion: 1})),
  ];
  ship.nextId = 5;
  ship.links = [{kind: 'power', from: 'p1', to: 'p2', cap: rated}];
  const stats = C.computeStats(ship), descriptor = C.propulsionProfile(ship, stats), fleet = C.fleetProfile(stats, ship.name, ship);
  const wattsPerNewton = C.engineConversionCoefficient(stats.mass * 1000);
  const feed = C.engineTransmission(ship).routes.find(r => r.from === 'p1' && r.to === 'p2');
  assert.equal(descriptor.architectureVersion, 2);
  assert.equal(descriptor.cores.length, 1);
  assert.equal(descriptor.engines.length, 2);
  assert.ok(descriptor.cores[0].valid && descriptor.cores[0].connected && feed.ok);
  assert.ok(C.reactorPower(ship.parts[0]) >= rated);
  assert.ok(C.engineDriveRoutes(ship).routes.every(r => r.ok));
  assert.equal(C.engineTransmission(ship).volume, 0, 'numerical electrical distribution adds no fictitious cable solid');
  assert.equal(C.engineTransmission(ship).parts.length, 0);
  assert.equal(feed.model, 'source-distance');
  assert.ok(feed.length > 0 && feed.efficiency > 0 && feed.efficiency < 1, 'the real source distance causes paid electrical loss');
  near(feed.capacityW, rated);assert.equal(feed.automatic, false, 'the explicitly authored finite feed remains a real electrical limit');
  const authored = C.publicJSON(ship), massTonnes = stats.mass;
  near(descriptor.massKg, massTonnes * 1000);near(descriptor.cores[0].machineryLengthM, 12);near(descriptor.cores[0].machineryRadiusM, 4);
  const efficiency = Math.exp(-1e-5 * feed.length), structural = descriptor.ratedAccelMps2 * .6;
  const profile = {...descriptor, structuralAccelerationLimitMps2: structural, inertialFactor: .5, accelerationLimitMps2: structural * .5};
  const original = JSON.stringify(profile);
  for (const [throttle, available] of [[1, rated], [.25, rated], [0, rated], [1, 0], [1, rated * .25]]) {
    const result = C.solveShipPropulsion(profile, {throttle, sources: [{id: 'p1', domain: 'main', powerW: available}], links: fleet.grid.powerPaths});
    const input = Math.min(throttle * available * efficiency, rated * efficiency, structural*.5*descriptor.massKg*wattsPerNewton), thrust = input / wattsPerNewton;
    assert.equal(result.version, 2);
    near(result.ratedAccelMps2, descriptor.ratedAccelMps2);
    near(result.accelerationLimitMps2, structural * .5);
    near(result.structuralAccelerationLimitMps2, structural);
    near(result.inertialFactor, .5);
    near(result.actualInputW, input);
    near(result.actualThrustN, thrust);
    near(result.wasteHeatW, input * .05);
    near(result.actualAccelMps2, Math.min(thrust / descriptor.massKg, structural*.5));
    near(result.power.draw, input / efficiency);
    near(result.power.feedLossW, result.power.draw - input);
    near(result.power.sources.reduce((sum, source) => sum + source.drawW, 0), result.power.draw);
    near(result.power.engineBudgets[0].drawW, result.power.draw);
    assert.ok(result.power.engineBudgets[0].drawW <= throttle * available * (1 + 1e-12), 'the source-funded throttle budget is spent once upstream of the lossy feed');
    assert.ok(result.power.draw <= available * (1 + 1e-12));
  }
  assert.equal(JSON.stringify(profile), original, 'live operation never rewrites the design planning limits');
  assert.equal(C.publicJSON(ship), authored, 'allocating real source power does not resize the authored machinery or change the saved design');
  near(stats.mass, massTonnes);
});

test('stock fighter summaries and fleet profiles use the same planned acceleration', () => {
  for (const key of Object.keys(C.CRAFT_SYSTEM_RECIPES)) {
    const ship = C.buildDesign(key), stats = C.computeStats(ship);
    const descriptor = C.propulsionProfile(ship, stats);
    const plannedG = descriptor.accelerationLimitMps2 / C.G0;
    assert.ok(plannedG > 0, `${key} must retain a nonzero structural and inertial acceleration limit`);
    near(stats.propulsion.accelerationLimitMps2, descriptor.accelerationLimitMps2);
    near(stats.propulsion.structuralAccelerationLimitMps2, descriptor.structuralAccelerationLimitMps2);
    near(stats.propulsion.inertialFactor, descriptor.inertialFactor);
    const craft = C.craftCombat(ship, stats, {summaryOnly: true});
    assert.equal(craft.accelG, Math.round(plannedG), key);
    assert.equal(craft.speed, C.fleetProfile(stats, ship.name, ship).maxSpeed, key);

    // Stopping or losing the current allocation must not rewrite the design's
    // performance rating. Movement still uses the separate live result below.
    const stopped = {...stats, accelG: 0, actualAccelMps2: 0,
      propulsion: {...stats.propulsion, actualAccelMps2: 0, outputRatio: 0}};
    const stoppedCraft = C.craftCombat(ship, stopped, {summaryOnly: true});
    assert.equal(stoppedCraft.speed, craft.speed, key);
    assert.equal(stoppedCraft.accelG, craft.accelG, key);
    assert.equal(stoppedCraft.aa, craft.aa, key);
  }
});

test('fighter flight loses acceleration and turning when stopped or unpowered', () => {
  const p = powerProfile(), key = 'planningRegressionFixture';
  R.CRAFT[key] = {name: p.name, role: 'fighter', speed: 2000, powerProfile: p};
  const squad = {id: key, craft: key, side: 0, h: [1, 0, 0], pos: [0, 0, 0], vel: [40, 2, 3]};
  try {
    const powered = R.squadPropulsion(squad, 1, 0);
    near(powered.acc0, .3);
    near(powered.acc, .3);
    const quarter = R.squadPropulsion(squad, .25, 0);
    near(quarter.acc0, powered.acc0);
    near(quarter.acc, .25);
    assert.ok(quarter.turn > 0 && quarter.turn < powered.turn);
    const stopped = R.squadPropulsion(squad, 0, 0);
    near(stopped.acc0, powered.acc0);
    assert.equal(stopped.acc, 0);
    assert.equal(stopped.turn, 0);
    const reactor = squad.drive.p.modules.findIndex(m => m.k === 'reactor');
    assert.ok(reactor >= 0, 'the live craft has a real reactor to disable');
    squad.drive.mods[reactor] = 0;
    const blackout = R.squadPropulsion(squad, 1, 0);
    near(blackout.acc0, powered.acc0);
    assert.equal(blackout.acc, 0);
    assert.equal(blackout.turn, 0);
    assert.equal(squad.propulsion.actualInputW, 0);
  } finally {
    delete R.CRAFT[key];
  }
});

test('a fighter design without propulsion stays at zero speed when saved and normalized', () => {
  const ship = C.newShip({L: 10, W: 4, H: 3}, 'Unpowered fighter');
  ship.shipClass = 'starfighter';
  const stats = C.computeStats(ship), craft = C.craftCombat(ship, stats);
  assert.equal(stats.craft, true);
  assert.equal(stats.actualAccelMps2, 0);
  assert.equal(craft.accelG, 0);
  assert.equal(craft.speed, 0);
  assert.equal(craft.speedLoaded, 0);
  assert.equal(C.fleetProfile(stats, ship.name, ship).maxSpeed, 0);
  const snapshot = C.designCraftSnapshot(ship, stats, 'test:unpowered');
  assert.ok(snapshot);
  assert.equal(snapshot.craft.speed, 0);
  assert.equal(C.cleanDesignCraft(snapshot).craft.speed, 0);

  // Explicit zero acceleration overrides an obsolete speed floor even in
  // older snapshots without a blueprint. Records with neither acceleration
  // nor a reconstructed propulsion profile keep their legacy speed.
  const saved = {name: ship.name, dims: craft.dims,
    craft: {...craft, speed: 500, speedLoaded: 500}};
  assert.equal(C.cleanDesignCraft(saved).craft.speed, 0);
  delete saved.craft.accelG;
  saved.craft.speed = 1800;
  assert.equal(C.cleanDesignCraft(saved).craft.speed, 0,
    'a retained physical profile still proves the aircraft has no propulsion');
  delete saved.craft.powerProfile;
  assert.equal(C.cleanDesignCraft(saved).craft.speed, 1800);
});

test('ordnance electronics do not take a laser battery share of continuous weapon power', () => {
  const p = powerProfile();p.propulsion={...p.propulsion,structuralAccelerationLimitMps2:1e9,accelerationLimitMps2:1e9,inertialFactor:1};
  p.modules.push(
    {k: 'weapon', fit: 3, port: 'f3', domain: 'main', size: 1, share: 1},
    {k: 'weapon', fit: 4, port: 'f4', domain: 'main', size: 0, share: 0,
      missileKind: 'cmsl', launchPowerW: 1e15},
  );
  Object.assign(p.grid, {
    P: 3e18, Pgen: 3e18, fixed: 1e15, Dw: 1e18,
    fixedLoads: [{id: 'launcher-electronics', port: 'f4', domain: 'main', weight: 1e15}],
    powerPaths: [
      {from: 'p1', to: 'p2', cap: 1e18},
      {from: 'p1', to: 'f3', cap: 1e18},
      {from: 'p1', to: 'f4', cap: 1e15},
    ],
  });
  const unit = C.fleetUnit('weapon-share-test', 'weapon-share-test', p);
  const allocation = C.allocateShipPower(unit, C.fleetSystems(unit),
    {throttle: 1, weapons: p.grid.Dw}, 0);
  near(allocation.got.fixedGranted, 1e15);
  near(allocation.got.engines, 1e18);
  near(allocation.got.weapons, 1e18);
  near(unit.pw.weaponInputs[2], 1e18);
  near(unit.pw.weaponInputs[3], 0);
});

test('weapon input ratings take precedence over damage shares, including an explicit zero', () => {
  for (const secondPower of [0, 1e15, 2e18]) {
    const p = powerProfile();p.propulsion={...p.propulsion,structuralAccelerationLimitMps2:1e9,accelerationLimitMps2:1e9,inertialFactor:1};
    p.modules.push(
      {k: 'weapon', fit: 3, port: 'f3', domain: 'main', size: 1,
        share: .75, weaponPowerW: 1e18},
      {k: 'weapon', fit: 4, port: 'f4', domain: 'main', size: 1,
        share: .25, weaponPowerW: secondPower},
    );
    Object.assign(p.grid, {
      P: 5e18, Pgen: 5e18, Dw: 1e18 + secondPower,
      powerPaths: [
        {from: 'p1', to: 'p2', cap: 1e18},
        {from: 'p1', to: 'f3', cap: 1e18},
        {from: 'p1', to: 'f4', cap: Math.max(1e15, secondPower)},
      ],
    });
    const unit = C.fleetUnit('weapon-input-test', 'weapon-input-test', p);
    const allocation = C.allocateShipPower(unit, C.fleetSystems(unit),
      {throttle: 1, weapons: p.grid.Dw}, 0);
    near(allocation.got.engines, 1e18);
    near(allocation.got.weapons, p.grid.Dw);
    near(unit.pw.weaponInputs[2], 1e18);
    near(unit.pw.weaponInputs[3], secondPower);
    assert.equal(p.modules[2].share, .75);
    assert.equal(p.modules[3].share, .25);
  }
});
