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
const plain = value => JSON.parse(JSON.stringify(value));

function legacySnapshot() {
  const ship = C.newShip({L: 600, W: 400, H: 120, plan: 'rect', sec: 'rect'}, 'Legacy gunboat');
  ship.parts = [];
  ship.fits = [];
  const blueprint = plain(C.serialize(ship));
  blueprint.fits = [{id: 1, k: 'refISDh', p: [300, 60, 0], a: 2, ped: 0, base: 0, low: 0, float: false}];
  blueprint.nextId = 2;
  return {ref: 'save:legacy-gunboat', name: 'Embarked gunboat', dims: [600, 400, 120], blueprint, craft: {
    role: 'fighter', speed: 1500, aa: 1.1, strike: 356, gun: 356, armor: 1.2, crew: 8,
    fireArcs: [{k: 'refISDh', fixed: false, dir: [1, 0, 0], up: [0, 1, 0], pos: [999, 999, 999], gun: 1, aa: 0, cycle: 2.5}]
  }};
}

function currentSnapshot(blueprint) {
  const ship = C.deserialize(blueprint);
  C.syncCompartments(ship);
  C.remount(ship);
  C.syncCompartments(ship);
  return C.designCraftSnapshot(ship, C.computeStats(ship), 'save:legacy-gunboat');
}

test('an embarked model refreshes cached combat output when its retired weapon changes', () => {
  const old = legacySnapshot(), before = plain(old), snapshot = C.cleanDesignCraft(old);
  assert.deepEqual(old, before, 'normalization leaves the saved source available');
  assert.equal(snapshot.blueprint.fits[0].k, 'oct40');
  assert.equal(snapshot.craft.gun, 326, 'six base points plus the current octuple 320 TT battery');
  assert.equal(snapshot.craft.strike, 326);
  assert.equal(snapshot.craft.fireArcs[0].k, 'oct40');
  assert.notDeepEqual(plain(snapshot.craft.fireArcs[0].pos), [999, 999, 999], 'muzzles rebuild with the current model');
  assert.equal(snapshot.ref, old.ref);
  assert.equal(snapshot.name, old.name);
  assert.equal(snapshot.weaponProfileVersion, 1);
  const key = R.registerDesignCraft(old), craft = R.CRAFT[key];
  assert.equal(craft.gun, 326, 'RTS registration uses the refreshed output');
  assert.equal(craft.strike, 326);
  assert.equal(craft.fireArcs[0].k, 'oct40');
  assert.deepEqual(plain(C.cleanDesignCraft(snapshot)), plain(snapshot), 'the refreshed immutable snapshot is stable');
});

test('engine transport retains a pending combat refresh after weapon ids become canonical', () => {
  const old = legacySnapshot();
  const transported = JSON.parse(C.publicJSON({design: old})).design;
  assert.equal(transported.blueprint.fits[0].k, 'oct40');
  assert.equal(transported.weaponProfileVersion, 0, 'transport must retain evidence that cached stats need rebuilding');
  assert.equal(transported.craft.fireArcs[0].k, 'oct40');
  const snapshot = C.cleanDesignCraft(transported);
  assert.equal(snapshot.craft.gun, 326);
  assert.equal(snapshot.weaponProfileVersion, 1);
  const saved = JSON.parse(C.publicJSON(snapshot));
  assert.equal(saved.weaponProfileVersion, 1);
  assert.deepEqual(plain(C.cleanDesignCraft(saved)), plain(snapshot));
});

test('performance-only legacy designs preserve numeric stats while canonicalizing weapon arc ids', () => {
  const old = legacySnapshot();
  delete old.blueprint;
  const snapshot = C.cleanDesignCraft(old), key = R.registerDesignCraft(old);
  assert.equal(snapshot.craft.gun, 356);
  assert.equal(snapshot.craft.strike, 356);
  assert.equal(snapshot.craft.aa, 1.1);
  assert.equal(snapshot.craft.fireArcs[0].k, 'oct40');
  assert.equal(snapshot.craft.fireArcs[0].cycle, 2.5);
  assert.equal(R.CRAFT[key].gun, 356);
  assert.equal(R.CRAFT[key].fireArcs[0].k, 'oct40');
});

test('old canonical heavy and multi-barrel snapshots refresh geometry to match the current model', () => {
  for (const kind of ['stl', 'oct40', 'ltl', 'mtl', 'triple40', 'quad200']) {
    const old = legacySnapshot();
    old.blueprint.fits[0].k = kind;
    old.craft.fireArcs[0].k = kind;
    const fresh = currentSnapshot(old.blueprint), snapshot = C.cleanDesignCraft(old);
    assert.equal(fresh.weaponProfileVersion, 1, 'freshly computed design snapshots carry the current revision');
    assert.equal(snapshot.weaponProfileVersion, 1, kind);
    assert.deepEqual(plain(snapshot.craft), plain(fresh.craft), `${kind} recomputes its ratings and muzzle geometry`);
    assert.notDeepEqual(plain(snapshot.craft.fireArcs[0].pos), [999, 999, 999], kind);
    assert.deepEqual(plain(C.cleanDesignCraft(JSON.parse(C.publicJSON(snapshot)))), plain(snapshot), `${kind} does not refresh again after transport`);
  }
});

test('surface battery and retained aggregate weapons also trigger the one-time geometry refresh', () => {
  for (const retained of [false, true]) {
    const old = legacySnapshot();
    old.blueprint.fits = [];
    const model = C.deserialize(old.blueprint), id = C.surfacePatches(model).find(p => p.face === 'top').id;
    assert.equal(C.setSurfaceConfig(model, id, {functionMode: 'legacy', battery: {weapon: 'oct40', count: 1}}).ok, true);
    const stats = C.computeStats(model), fit = C.surfaceDerivedFits(model)[0], port = C.surfaceBatteryGeometry(fit);
    assert.equal(stats.alphaTot, 320, 'the physical surface battery installs one 320 TT gun');
    old.blueprint = plain(C.serialize(model));
    if (!retained) for (const patch of old.blueprint.surfaces.patches) delete patch.aggregate;
    const snapshot = C.cleanDesignCraft(old), fresh = currentSnapshot(old.blueprint);
    assert.ok(snapshot);
    assert.equal(snapshot.weaponProfileVersion, 1);
    assert.equal(snapshot.craft.gun, 326, 'surface gun output includes the same six base points as a manual battery');
    assert.equal(snapshot.craft.strike, 326);
    assert.equal(snapshot.craft.fireArcs.length, 1);
    const arc = snapshot.craft.fireArcs[0];
    assert.equal(arc.k, 'oct40');
    const squad = {craft: R.registerDesignCraft(snapshot), pos: [0, 0, 0], h: [1, 0, 0]};
    assert.equal(R.squadFireArc(squad, C.mul(port.normal, 1000)), 1, 'the registered surface gun can fire through its outward mouth');
    assert.equal(R.squadFireArc(squad, C.mul(port.normal, -1000)), 0, 'the registered surface gun cannot fire inward through its hull');
    for (const [actual, expected] of [[arc.pos, port.mouth], [arc.dir, port.normal], [arc.up, port.normal]]) {
      assert.ok(C.len(C.sub(actual, expected)) < 1e-7, 'the snapshot keeps its port muzzle and outward mount normal');
    }
    assert.equal(snapshot.blueprint.fits.length, 0, 'derived surface guns stay outside the editable fit list');
    assert.deepEqual(plain(snapshot.craft), plain(fresh.craft));
    assert.deepEqual(plain(C.cleanDesignCraft(JSON.parse(C.publicJSON(snapshot)))), plain(snapshot), 'surface snapshots stay stable after transport');
  }
});

test('unaffected and already-current snapshots retain their cached performance', () => {
  for (const kind of ['refVen', 'ion', 'htl', 'claser']) {
    const current = legacySnapshot();
    current.blueprint.fits[0].k = kind;
    current.craft.fireArcs[0].k = kind;
    const snapshot = C.cleanDesignCraft(current);
    assert.equal(snapshot.craft.gun, 356, kind);
    assert.equal(snapshot.craft.strike, 356, kind);
    assert.deepEqual(plain(snapshot.craft.fireArcs[0].pos), [999, 999, 999], kind);
  }
  const current = legacySnapshot();
  current.blueprint.fits[0].k = 'oct40';
  current.craft.fireArcs[0].k = 'oct40';
  current.weaponProfileVersion = 1;
  assert.equal(C.cleanDesignCraft(current).craft.gun, 356, 'the current revision does not rebuild on each validation');
});
