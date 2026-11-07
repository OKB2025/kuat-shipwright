const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const frozen = require('./helpers/sublight-legacy-physical.json');
const plain = value => JSON.parse(JSON.stringify(value));
const sum = values => values.reduce((a, b) => a + b, 0);
function near(actual, expected, label) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected)
    && Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10,
  `${label}: ${actual} != ${expected}`);
}
function load(source) {
  const context = vm.createContext({console, performance});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  }
  vm.runInContext(source, context, {filename: 'js/core.js'});
  const api = vm.runInContext('({C:Core,R:Rts})', context);
  api.C.buildDesign = api.C.computeStats = () => {throw Error('Table aircraft resolution must not construct a model');};
  return api;
}
const {C, R} = load(fs.readFileSync(path.join(root, 'js/core.js'), 'utf8'));

// These are actual public runtime steps, including the canonical allocator,
// source heating, paid cooling, damage and propulsion state. Weapon-demand
// runs use half throttle so the allocator really funds the weapon heat.
function operate(key, {throttle = 1, firing = false, destroyCooler = false} = {}) {
  const squad = {id: 'thermal-' + key, craft: key, n: 1, state: 'out', side: 0,
    pos: [0, 0, 0], h: [1, 0, 0], vel: [0, 0, 0], weaponDemand: firing};
  R.squadStores(squad);
  let atTwoSeconds, weaponEnergyJ = 0;
  const dt = .25;
  for (let step = 0; step < 600 / dt; step++) {
    if (destroyCooler && squad.drive) {
      squad.drive.p.modules.forEach((module, i) => {
        if (module.k === 'dissipator') squad.drive.mods[i] = 0;
      });
    }
    R.squadPropulsion(squad, throttle, dt);
    const unit = squad.drive, power = unit.propulsion.power;
    near(power.draw, sum(Object.values(power.granted)) + power.feedLossW, key + ' source ledger');
    assert.ok(power.draw <= power.P * (1 + 1e-10), key + ' original plant limit');
    near(unit.propulsion.wasteHeatW, unit.propulsion.actualInputW * .05, key + ' ordinary engine waste');
    weaponEnergyJ += (power.weapons || 0) * dt;
    if (step === 2 / dt - 1) atTwoSeconds = {force: unit.propulsion.actualThrustN, health: Math.min(...unit.mods)};
  }
  return {squad, unit: squad.drive, atTwoSeconds, weaponEnergyJ};
}

for (const row of frozen.rows) {
  test(`${row.key}: paid ordinary machinery and cooling survive ten minutes without changing the original plant or nominal force`, () => {
    const craft = R.CRAFT[row.key], profile = R.craftPowerOf(craft), price = R.craftPrice(row.key);
    const bom = price.bom, engines = bom.parts.filter(part => part.k === 'engine');
    const volume = sum(engines.map(part => part.volume * (part.count ?? 1)));
    const cooler = bom.parts.find(part => part.k === 'hdis');
    const engine = profile.propulsion.engines[0], heat = C.heatProfile(profile);
    for (const flag of ['estimated', 'requiresBlueprint', 'legacyReadOnly']) assert.equal(profile[flag], true);
    for (const flag of ['estimated', 'requiresBlueprint', 'readOnly']) assert.equal(price[flag], true);
    for (const field of ['P', 'Pgen', 'Paux', 'De', 'Dw', 'Ds']) assert.equal(profile.grid[field], row.grid[field], field);
    for (const field of ['massKg', 'ratedThrustN', 'ratedAccelMps2', 'accelerationLimitMps2']) {
      assert.equal(profile.propulsion[field], row.propulsion[field], field);
    }
    assert.equal(craft.mass, row.mass);
    const originalPaidVolume = 2 * Math.max(.03, bom.hullVolume * .01);
    assert.ok(volume >= originalPaidVolume * (1 - 1e-12));
    assert.ok(volume >= row.grid.De / 3.4e17 * (1 - 1e-12));
    near(engine.effectiveMachineryVolumeM3, volume, 'paid engine volume');
    assert.equal(engine.machineryGradeId, 'standard');
    assert.ok(engine.densityFactor <= 1 + 1e-12);
    near(engine.efficiency, .95, 'ordinary efficiency');
    const source = heat.src.find(source => source.k === 'engine');
    near(source.st, volume * 3.4e17 * .05 * 60, 'volume-based thermal buffer');
    assert.ok(source.st > 1);
    assert.equal(heat.mode, 'strict');
    assert.equal(heat.dis.length, 1, 'no unpaid hull or compatibility sinks');
    const dissipator = heat.dis[0];
    assert.equal(dissipator.k, 'hdis');
    assert.ok(Number.isFinite(cooler.volume) && cooler.volume > 0);
    assert.equal(profile.modules[dissipator.m].k, 'dissipator');
    near(profile.modules[dissipator.m].size, cooler.volume, 'paid cooling volume');
    near(dissipator.cap, cooler.volume * C.REACTOR_POWER_DENSITY * C.HEAT.disK.hdis, 'finite cooling capacity');
    near(profile.grid.cooling, dissipator.cap * C.HEAT.disPowerK.hdis, 'finite cooling input');
    near(profile.grid.fixed - profile.grid.cooling, row.grid.fixed, 'hotel budget unchanged');
    assert.ok(C.partBuildCost({k: 'hdis'}, cooler.volume) > 0, 'cooler has a real hardware price before rounding');
    assert.equal(price.total, C.quoteCostBOM(bom).total);
    assert.ok(sum(bom.parts.map(part => part.volume * (part.count ?? 1))) < bom.hullVolume,
      'estimated hardware occupies the existing finite hull budget');

    for (const mode of [{}, {throttle: .5, firing: true}]) {
      const run = operate(row.key, mode), {unit} = run;
      assert.ok(run.atTwoSeconds.force > 0);
      near(run.atTwoSeconds.health, 1, 'healthy at two seconds');
      assert.ok(unit.propulsion.actualThrustN > 0);
      unit.mods.forEach(value => near(value, 1, 'healthy after ten minutes'));
      assert.ok(unit.ht.cooling.inputJ > 0);
      assert.ok(unit.ht.cooling.inputJ <= unit.ht.cooling.reservedJ * (1 + 1e-10));
      near(unit.ht.cooling.inputJ, unit.ht.cooling.handledJ * C.HEAT.disPowerK.hdis, 'cooler energy ledger');
      if (mode.firing && row.grid.Dw > 0) assert.ok(run.weaponEnergyJ > 0, 'actual weapon grants were heated');
    }
    const cut = operate(row.key, {destroyCooler: true});
    assert.equal(cut.unit.propulsion.actualThrustN, 0, 'destroyed paid cooling cannot sustain propulsion');
  });
}

test('the twelve native-backed profiles and prices remain exactly the authenticated pre-runtime revision values', () => {
  const source = zlib.gunzipSync(fs.readFileSync(path.join(root,
    'assets/source/engine-targets-final-craft-cache/core-before-generation.js.gz'))).toString();
  const before = load(source), keys = Object.keys(C.CRAFT_PRICE_CATALOG.entries), cache = plain(C.CRAFT_PRICE_CATALOG);
  assert.equal(keys.length, 12);
  for (const key of keys) {
    assert.deepEqual(plain(R.craftPowerOf(R.CRAFT[key])), plain(before.R.craftPowerOf(before.R.CRAFT[key])), key + ' physical profile');
    assert.deepEqual(plain(R.craftPrice(key)), plain(before.R.craftPrice(key)), key + ' price');
  }
  assert.deepEqual(plain(C.CRAFT_PRICE_CATALOG), cache, 'runtime resolution does not mutate generated cache data');
});
