const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
function runtime() {
  const context = vm.createContext({console});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  }
  return vm.runInContext('({C:Core,R:Rts})', context);
}
const plain = value => JSON.parse(JSON.stringify(value));
function systems(overrides = {}) {
  return {v: 1, managed: true, power: 1e12, crew: 2, suitSeats: 0,
    lifeSupportCapacity: 2, lifeSupportHours: 1, ejectionSeats: 2,
    ejectionCoverage: 1, ejectionSurvival: 1, navCapacity: 1, navReady: true,
    targetDemand: 2, targetCapacity: 2, targetRatio: 1, fireK: 1,
    maneuverSupport: 100, maneuverRatio: 1, turnK: 1,
    laserUnits: 2, laserGasSeconds: 10, laserGunShare: 1, laserAaShare: 1,
    landingSupport: 100, landingRatio: 1, landingReady: true, ...overrides};
}
function fixture(R, system = systems(), options = {}) {
  const key = 'runtime-systems-test';
  R.CRAFT[key] = {name: 'Test fighter', short: 'Test', crew: system?.crew ?? 2,
    role: 'fighter', speed: 1000, aa: 1, gun: 20, strike: 20, armor: 1,
    size: 1, stations: [], load: [], ...(system ? {systems: system} : {})};
  const s = {id: 'sq', side: 0, name: 'Test squadron', craft: key, wing: 'wing',
    home: 'home', n: 12, n0: 12, state: 'out', sys: 0, pos: [10000, 0, 0],
    h: [1, 0, 0], vel: [0, 0, 0], slots: Array.from({length: 12}, (_, i) => i),
    ldg: [{n: 3}], ammo: [0], heat: .8, fired: true, ...options};
  const wing = {id: 'wing', side: 0, name: 'Test wing', home: 'home',
    squads: [s.id], phase: 'on', order: {type: 'escort', target: 'home'}};
  const w = {time: 10, rand: () => .25, events: [], sides: [{id: 0}, {id: 1}],
    squads: new Map([[s.id, s]]), wings: new Map([[wing.id, wing]]),
    units: new Map(), battles: new Map([[0, {log: []}]])};
  R.rearmSquad(s);
  return {w, s, wing, craft: R.CRAFT[key]};
}

test('custom registration preserves normalized systems through saved JSON', () => {
  const first = runtime(), design = {name: 'Systems fighter', dims: [10, 8, 3], craft: {
    role: 'fighter', speed: 1800, aa: 1, gun: 20, strike: 20, armor: 1,
    crew: 2, mass: 20, cost: 50000, stations: [], load: [], systems: systems(),
  }};
  const key = first.R.registerDesignCraft(design), craft = first.R.CRAFT[key];
  assert.ok(craft?.systems?.managed);
  assert.deepEqual(plain(craft.systems), plain(craft.snapshot.craft.systems));
  assert.equal(craft.systems.laserGasSeconds, 10);
  const second = runtime(), restored = second.R.CRAFT[second.R.registerDesignCraft(plain(craft.snapshot))];
  assert.deepEqual(plain(restored.systems), plain(craft.systems));
});

test('rearming restores sortie consumables and keeps accumulated crew casualties', () => {
  const {R} = runtime(), {s} = fixture(R);
  assert.equal(s.laserGas, 10);assert.equal(s.lifeSupport, 3600);
  s.laserGas = 0;s.lifeSupport = 0;s.pilotSurvived = 3;s.crewLost = 4;
  s.returnReason = 'laser-gas';s.heat = 1;s.fired = true;s.ammo = [0];
  R.rearmSquad(s);
  assert.equal(s.laserGas, 10);assert.equal(s.lifeSupport, 3600);
  assert.equal(s.pilotSurvived, 3);assert.equal(s.crewLost, 4);
  assert.equal(s.heat, 0);assert.equal(s.fired, false);assert.deepEqual(plain(s.ammo), [3]);
  assert.ok(!s.returnReason);
});

test('legacy craft remain unlimited and do not acquire new survival randomness', () => {
  const {R} = runtime();
  for (const system of [null, systems({managed: false, laserGasSeconds: 0, lifeSupportHours: 0})]) {
    const {w, s} = fixture(R, system);let draws = 0;w.rand = () => {draws++;return .25;};
    s.dogfight = w.time;R.squadSystemsTick(w, 50000);
    assert.equal(s.laserGas, null);assert.equal(s.lifeSupport, null);assert.equal(s.state, 'out');
    assert.equal(R.squadLaserK(s, 'gun'), 1);assert.equal(R.squadLaserK(s, 'aa'), 1);
    R.craftDown(w, 0, s, 0, 'air', null);
    assert.equal(draws, 0, 'an explicitly picked legacy loss must not perturb battle RNG');
  }
});

test('laser gas follows trigger time once per squadron and remains still off the trigger', () => {
  const {R} = runtime(), {w, s} = fixture(R);
  s.heat = .5;
  R.squadSystemsTick(w, 2);assert.equal(s.laserGas, 10);assert.equal(s.lifeSupport, 3598);
  w.time += 2;s.dogfight = w.time;s.strafeT = w.time + 3;
  R.squadSystemsTick(w, 2);
  assert.equal(s.laserGas, 8, 'dogfight plus strafe is one trigger, independent of twelve craft');
  assert.equal(s.lifeSupport, 3596);
  assert.equal(s.heat, .5, 'consumables must not advance the existing heat simulation a second time');
  w.time += 5;R.squadSystemsTick(w, 1);assert.equal(s.laserGas, 8);
  s.strafeT = w.time + 1;R.squadSystemsTick(w, 1);assert.equal(s.laserGas, 7);
});

test('the world clock advances airborne life support exactly once and a paused world does not', () => {
  const {R} = runtime(), {s, wing} = fixture(R, systems({lifeSupportHours: 1}));
  const w = R.createWorld({mode: 'test', sides: [{faction: 'rebel', ai: false}, {faction: 'empire', ai: false}], fleets: []});
  s.state = 'raid';s.sys = null;w.squads.set(s.id, s);w.wings.set(wing.id, wing);
  assert.equal(R.step(w, 0), 0);assert.equal(s.lifeSupport, 3600);
  assert.equal(R.step(w, R.TICK), 1);assert.equal(s.lifeSupport, 3600 - R.TICK);
  assert.equal(s.laserGas, 10);
});

test('empty gas recalls a squadron while preserving non-laser gun and air strength', () => {
  const {R} = runtime(), {w, s} = fixture(R, systems({laserGasSeconds: .5, laserGunShare: .75, laserAaShare: .6}));
  s.dogfight = w.time;R.squadSystemsTick(w, 1);
  assert.equal(s.laserGas, 0);assert.equal(s.state, 'return');assert.equal(s.returnReason, 'laser-gas');
  assert.equal(R.squadLaserK(s, 'gun'), .25);assert.equal(R.squadLaserK(s, 'aa'), .4);
  R.rearmSquad(s);assert.equal(R.squadLaserK(s, 'gun'), 1);
});

test('returning and hyperspace craft do not keep firing from stale combat markers', () => {
  const {R} = runtime(), {w, s} = fixture(R);
  for (const state of ['return', 'raid']) {
    s.state = state;s.dogfight = w.time;s.strafeT = w.time + 20;
    R.squadSystemsTick(w, 1);assert.equal(s.laserGas, 10);
  }
  assert.equal(s.lifeSupport, 3598);
});

test('life support runs in flight and hyperspace, but docked craft and a paused step consume nothing', () => {
  const {R} = runtime(), {w, s} = fixture(R, systems({lifeSupportHours: 1 / 3600}));
  s.state = 'docked';R.squadSystemsTick(w, 10);assert.equal(s.lifeSupport, 1);
  s.state = 'raid';s.sys = null;R.squadSystemsTick(w, 0);assert.equal(s.lifeSupport, 1);
  R.squadSystemsTick(w, .5);assert.equal(s.lifeSupport, .5);
  s.state = 'out';s.sys = 0;R.squadSystemsTick(w, .5);
  assert.equal(s.lifeSupport, 0);assert.equal(s.state, 'return');assert.equal(s.returnReason, 'life-support');
});

test('zero consumables are enforced, while unmanned and no-laser null capacities stay unlimited', () => {
  const {R} = runtime(), zero = fixture(R, systems({laserGasSeconds: 0, lifeSupportHours: 1}));
  R.squadSystemsTick(zero.w, .25);
  assert.equal(zero.s.laserGas, 0);assert.equal(zero.s.state, 'return');
  const drone = fixture(R, systems({crew: 0, laserUnits: 0, laserGasSeconds: null, lifeSupportHours: null}));
  drone.s.dogfight = drone.w.time;R.squadSystemsTick(drone.w, 50000);
  assert.equal(drone.s.laserGas, null);assert.equal(drone.s.lifeSupport, null);assert.equal(drone.s.state, 'out');
  assert.equal(R.squadLaserK(drone.s, 'gun'), 1);
});

test('consumable exhaustion recalls a remote raid and clears its attack order', () => {
  const {R} = runtime(), {w, s, wing} = fixture(R, systems({lifeSupportHours: 0}));
  wing.raid = {phase: 'strike', from: 1, to: 0, squads: [s.id], order: {type: 'strike', target: 'enemy'}};
  s.raid = wing.id;R.squadSystemsTick(w, .25);
  assert.equal(s.state, 'return');assert.equal(wing.raid.recall, true);
});

test('ejection seats save crew and each downed craft credits its attacker exactly once', () => {
  const {R} = runtime(), {w, s} = fixture(R, systems({crew: 3, ejectionSurvival: 1}));
  const foe = {id: 'foe', side: 1, kills: 0};w.squads.set(foe.id, foe);
  assert.equal(R.craftDown(w, 0, s, 0, 'air', foe.id), true);
  assert.equal(s.n, 11);assert.equal(s.lostN, 1);assert.equal(foe.kills, 1);
  assert.equal(s.pilotSurvived, 3);assert.equal(s.crewLost || 0, 0);
  assert.equal(w.sides[0].pilotSurvived, 3);assert.equal(w.sides[0].crewLost || 0, 0);
  assert.equal(R.craftDown(w, 0, s, 0, 'air', foe.id), false, 'a repeated rendered kill must not lose another craft');
  assert.equal(s.n, 11);assert.equal(foe.kills, 1);assert.equal(s.pilotSurvived, 3);
  const pd = {id: 'pd', craftKills: 0};w.units.set(pd.id, pd);
  R.craftDown(w, 0, s, 1, 'pd', pd.id);
  assert.equal(s.n, 10);assert.equal(s.lostN, 2);assert.equal(pd.craftKills, 1);assert.equal(foe.kills, 1);
  assert.equal(s.pilotSurvived, 6);assert.equal(w.sides[0].pilotSurvived, 6);
});

test('partial ejection survival is reproducible without changing combat randomness', () => {
  const {R} = runtime(), outcomes = [];
  for (let i = 0; i < 2; i++) {
    const {w, s} = fixture(R, systems({crew: 3, ejectionSurvival: .5}));let draws = 0;
    w.seed = 27;w.rand = () => {draws++;return .2;};
    R.craftDown(w, 0, s, 0, 'air', null);
    assert.equal(draws, 0);
    assert.equal((s.pilotSurvived || 0) + (s.crewLost || 0), 3);
    outcomes.push([s.pilotSurvived || 0, s.crewLost || 0]);
  }
  assert.deepEqual(outcomes[0], outcomes[1]);
});

test('crew without ejection survival are lost, while unmanned losses have no crew casualties', () => {
  const {R} = runtime(), crewed = fixture(R, systems({crew: 2, ejectionSeats: 0, ejectionCoverage: 0, ejectionSurvival: 0}));
  R.craftDown(crewed.w, 0, crewed.s, 0, 'air', null);
  assert.equal(crewed.s.crewLost, 2);assert.equal(crewed.w.sides[0].crewLost, 2);
  assert.equal(crewed.s.pilotSurvived || 0, 0);
  const drone = fixture(R, systems({crew: 0, lifeSupportHours: null}));
  R.craftDown(drone.w, 0, drone.s, 0, 'air', null);
  assert.equal(drone.s.crewLost || 0, 0);assert.equal(drone.s.pilotSurvived || 0, 0);
  assert.equal(drone.w.sides[0].crewLost || 0, 0);assert.equal(drone.w.sides[0].pilotSurvived || 0, 0);
});
