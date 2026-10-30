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
  return vm.runInContext('({C:Core,R:Rts,designs:YardFleetData.designs})', context);
}
const plain = value => JSON.parse(JSON.stringify(value));
function snapshot(C) {
  const ship = C.newShip({L: 35, W: 18, H: 8}, 'Custom Gunboat');
  ship.parts = [{id: 1, k: 'struct', form: 'box', c: [20, 5, 0], s: [10, 8, 4]}];
  ship.nextId = 2;
  return {ref: 'save:custom-gunboat', name: ship.name, dims: [35, 18, 8], blueprint: C.serialize(ship), craft: {
    role: 'fighter', speed: 1500, aa: 1.1, strike: 80, gun: 20, armor: 1.2, crew: 8, mass: 200, cost: 2000000, hyper: 2,
    stations: [{fit: 'ctorp', mount: 'tube', count: 1}], load: [{k: 'ptorp', n: 4}], heat: {up: .02, upS: .04, down: .01, T: 2},
  }};
}
function fleet(air, name = 'Carrier') {
  return {ctgs: [{id: 'c1', name: 'Task Force', tgs: [{id: 't1', name: 'Task Group', formation: 'abreast', ships: [{id: 'carrier', src: 'carrier', key: 'carrier', name, air}]}]}]};
}
function carrier(designs) {
  const d = designs.venator;
  return {key: 'carrier', name: 'Carrier', p: {...d.p, mouths: [{p: [0, -100, 0], n: [0, -1, 0], ax: [1, 0, 0], o: [100, 80], r: 100, in: [0, 0, 0], d: 10}], airCtl: 12, hf: null}, info: {...d.info, stow: null}};
}

test('complete design versions distinguish ordnance, heat, mass and blueprint changes', () => {
  const {C, R} = runtime(), base = snapshot(C), original = R.registerDesignCraft(base);
  assert.equal(R.registerDesignCraft(plain(base)), original, 'equivalent JSON has one key');
  const reordered = Object.fromEntries(Object.entries(base).reverse());
  assert.equal(R.registerDesignCraft(reordered), original, 'object property order is irrelevant');
  for (const change of [d => {d.craft.load[0].n = 2;}, d => {d.craft.gun = 25;}, d => {d.craft.mass = 250;}, d => {d.craft.cost += 1;}, d => {d.craft.heat.up = .03;}, d => {d.blueprint.parts[0].c[0] += 1;}]) {
    const changed = plain(base);change(changed);
    assert.notEqual(R.registerDesignCraft(changed), original, 'a changed model or performance must never reuse stale registered data');
  }
  assert.ok(R.CRAFT[original].blueprint);
  assert.deepEqual(plain(R.CRAFT[original].snapshot.blueprint), plain(C.cleanDesignCraft(base).blueprint));
  assert.equal(R.CRAFT[original].hyper, 2);
});

test('registration caches unchanged snapshots while noticing mutations of the same input object', () => {
  const {C, R} = runtime(), input = snapshot(C), clean = C.cleanDesignCraft;let calls = 0;
  C.cleanDesignCraft = d => {calls++;return clean(d);};
  const key = R.registerDesignCraft(input);assert.equal(R.registerDesignCraft(input), key);assert.equal(calls, 1);
  input.craft.heat.up += .01;assert.notEqual(R.registerDesignCraft(input), key);assert.equal(calls, 2);
  const kept = R.CRAFT[key].snapshot;R.registerDesignCraft(kept);R.registerDesignCraft(kept);
  assert.equal(calls, 2, 'normalized fleet rows share the already-validated snapshot');
  C.cleanDesignCraft = clean;
});

test('default complements keep snapshots and explicit flight-group hierarchy', () => {
  const {C, R} = runtime(), design = snapshot(C);
  const air = R.defaultAir({}, 'republic', [{id: 'custom', name: design.name, count: 24, dims: design.dims, design, groupNo: 4, wingNo: 2, groupName: 'Gunboat Group'}]);
  assert.equal(air.length, 2);assert.equal(air[0].design, air[1].design, 'one immutable snapshot is shared in memory');
  for (const q of air) {assert.equal(q.groupNo, 4);assert.equal(q.wingNo, 2);assert.equal(q.groupName, 'Gunboat Group');assert.ok(q.design.blueprint);}
  const automatic = R.defaultAir({}, 'republic', [{type: 'xwing', count: 84}]);
  assert.deepEqual(plain(automatic.map(q => q.wingNo)), [1,1,1,1,1,1,2]);
});

test('a saved fleet re-registers its exact custom model and performance in a fresh session', () => {
  const first = runtime(), design = snapshot(first.C), air = first.R.defaultAir({}, 'republic', [{count: 12, dims: design.dims, design, groupNo: 3, wingNo: 7}]);
  const saved = JSON.stringify(first.R.normalizeFleet(fleet(air))), second = runtime();
  assert.equal(second.R.CRAFT[air[0].craft], undefined, 'fresh session has no dynamic registrations');
  const loaded = second.R.normalizeFleet(JSON.parse(saved)), row = loaded.ctgs[0].tgs[0].ships[0].air[0], registered = second.R.CRAFT[row.craft];
  assert.ok(registered);assert.equal(row.craft, air[0].craft);assert.equal(row.groupNo, 3);assert.equal(row.wingNo, 7);
  assert.equal(registered.snapshot, row.design);assert.deepEqual(plain(registered.blueprint), plain(first.R.CRAFT[air[0].craft].blueprint));
  const d = carrier(second.designs), world = second.R.scenarioWorld({sides: [{faction: 'republic', fleet: loaded}, {faction: 'cis'}]}, [d]);
  assert.equal(world.squads.size, 1);assert.equal([...world.squads.values()][0].craft, row.craft);
});

test('flight groups separate equal wing numbers on each carrier and retain named compatibility labels', () => {
  const {C, R, designs} = runtime(), design = snapshot(C), key = R.registerDesignCraft(design);
  const air = [{craft: key, design, n: 2, groupNo: 1, wingNo: 1, groupName: 'Alpha Group'}, {craft: key, design, n: 2, groupNo: 2, wingNo: 1, groupName: 'Beta Group'}, {craft: key, design, n: 2, groupNo: 2, wingNo: 2}, {craft: key, design, n: 2, groupNo: 1, wingNo: 1}];
  const d = carrier(designs), world = R.createWorld({designs: [d], sides: [{faction: 'republic', ai: false}, {faction: 'cis', ai: false}], fleets: [[{design: d.key, air}, {design: d.key, air}], []]});
  assert.equal(world.squads.size, 8);assert.equal(world.wings.size, 6);assert.equal(world.airGroups.size, 4);
  for (const home of world.units.values()) {
    const wings = [...world.wings.values()].filter(w => w.home === home.id);
    assert.equal(wings.find(w => w.groupNo === 1).squads.length, 2);
    assert.equal(wings.find(w => w.groupNo === 2 && w.no === 1).group, 'Beta Group');
    assert.equal(wings.find(w => w.groupNo === 2 && w.no === 2).groupName, 'Beta Group');
    assert.equal([...world.airGroups.values()].find(g => g.home === home.id && g.no === 2).wings.length, 2);
  }
});

test('an unarmed user transport still forms a launchable wing after scenario round trip', () => {
  const {C, R, designs} = runtime(), design = snapshot(C);Object.assign(design.craft, {role: 'transport', strike: 0, gun: 0, stations: [], load: []});
  const air = R.defaultAir({}, 'republic', [{count: 2, dims: design.dims, design}]), loaded = R.normalizeFleet(plain(fleet(air))), d = carrier(designs);
  const world = R.scenarioWorld({sides: [{faction: 'republic', fleet: loaded}, {faction: 'cis'}]}, [d]), wing = [...world.wings.values()][0];
  assert.equal(R.CRAFT[air[0].craft].stay, false);assert.ok(wing, 'custom transports are not dropped from the battle roster');
  assert.equal(R.orderWing(world, wing.id, {type: 'cap', point: [0,0,0]}), true);
  const sys = [...world.units.values()][0].sys;world.battles.set(sys, {sys, t0: 0, log: [], sides: [0, 1]});
  for (let i = 0; i < 100 && [...world.squads.values()][0].state === 'docked'; i++) {world.time += .25;R.battleTick(world, sys, .25);}
  assert.equal([...world.squads.values()][0].state, 'out');
});

test('legacy short craft keys rehydrate from the carrier complement before stow and battle creation', () => {
  const first = runtime(), design = snapshot(first.C), key = first.R.registerDesignCraft(design), clean = first.R.CRAFT[key].snapshot, c = clean.craft;
  const sig = `${clean.ref}|${clean.name}|${[c.role,c.speed,c.aa,c.strike,c.armor,c.crew].join(',')}|${clean.dims.join(',')}|h${c.hyper}`;
  let hash = 0;for (const character of sig) hash = (Math.imul(hash,31)+character.charCodeAt(0))|0;
  const legacy = 'dsn'+(hash>>>0).toString(36), second = runtime(), d = {...carrier(second.designs), air: [{dims: design.dims, design}]};
  assert.equal(second.R.CRAFT[legacy], undefined);
  const raw = fleet([{craft: legacy, n: 12, wingNo: 1}]);
  const result = second.R.battleOrbat(raw, null, () => d), row = result.ctgs[0].tgs[0].ships[0].air[0];
  assert.ok(row.design?.blueprint);assert.equal(row.craft, key);assert.equal(Object.keys(second.R.CRAFT).includes(legacy), false, 'legacy aliases do not duplicate aircraft choices');
});
