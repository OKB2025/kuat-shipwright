const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const C = vm.runInContext('Core', context);
const plain = value => JSON.parse(JSON.stringify(value));
function near(actual, expected, message) {
  assert.equal(actual.length, expected.length, message);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-8,
    `${message || 'vector'} [${i}]: ${value} != ${expected[i]}`));
}
function fixture(axis = 'x', pivot = [32.25, 75.5, 12.75]) {
  const ship = C.newShip({L: 100, W: 60, H: 100, assembly: true});
  const wing = {id: 1, k: 'struct', form: 'box', c: [40, 80, 30], s: [20, 30, 4],
    wing: C.normalizeWing({foil: true, axis, open: 30, stow: -45, T: 1, pivot})};
  ship.parts.push(wing);
  ship.nextId = 2;
  return {ship, wing};
}

test('arbitrary world pivots rotate points correctly around each S-foil axis', () => {
  const pivot = [13.25, 41.5, -19.75], offset = [2, 3, 5];
  const rotated = {x: [2, -5, 3], y: [5, 3, -2], z: [-3, 2, 5]};
  for (const axis of ['x', 'y', 'z']) {
    const {ship, wing} = fixture(axis, pivot), frame = C.foilFrame(ship, wing);
    const point = C.add(pivot, offset), angle = wing.wing.open + 90 / frame.sg;
    near(frame.pv, pivot, `${axis} pivot`);
    near(C.foilAt(frame, wing, pivot, angle), pivot, `${axis} hinge stays fixed`);
    near(C.foilAt(frame, wing, point, angle), C.add(pivot, rotated[axis]), `${axis} quarter turn`);
    near(C.foilAt(frame, wing, point, wing.wing.open), point, `${axis} design pose`);
  }
});

test('custom hinges move the preview wing, carried equipment and mounted fittings together', () => {
  const {ship, wing} = fixture();
  const device = {id: 2, k: 'hdis', c: [42, 80, 34], d: 1};
  const fit = {id: 3, k: 'laser', host: wing.id, p: [44, 82, 33], n: [0, 1, 0]};
  ship.parts.push(device);
  ship.fits.push(fit);
  const before = C.publicJSON(ship), frame = C.foilFrame(ship, wing);
  const pose = C.foilPose(ship, wing, wing.wing.stow);
  assert.ok(pose.parts.some(p => p._poseOf === wing.id));
  near(pose.parts.find(p => p._poseOf === device.id).c,
    C.foilAt(frame, wing, device.c, wing.wing.stow), 'equipment follows hinge');
  near(pose.fits.find(f => f._poseOf === fit.id).p,
    C.foilAt(frame, wing, fit.p, wing.wing.stow), 'fitting follows hinge');
  assert.equal(C.publicJSON(ship), before, 'preview must not change the design');
});

test('custom pivots survive design save/load, including fractional and negative coordinates', () => {
  const {ship, wing} = fixture('z', [-27.125, 0, 151.875]);
  const saved = C.serialize(ship), loaded = C.deserialize(JSON.parse(JSON.stringify(saved)));
  const restored = loaded.parts.find(p => p.id === wing.id);
  assert.deepEqual(plain(restored.wing), plain(wing.wing));
  near(C.wingPivot(loaded, restored), wing.wing.pivot);
});

test('pivot normalization rejects invalid vectors and clamps coordinates to design limits', () => {
  for (const pivot of [[0, 1], [0, 1, 2, 3], [0, NaN, 2], [0, Infinity, 2], ['0', 1, 2], null]) {
    assert.equal(C.normalizeWing({foil: true, pivot}).pivot, undefined);
  }
  const limit = C.DESIGN_LIMITS.coordinate, pivot = [-limit - 1, .125, limit + 1];
  const normalized = C.normalizeWing({foil: true, pivot});
  assert.deepEqual(plain(normalized.pivot), [-limit, .125, limit]);
  normalized.pivot[1] = 4;
  assert.equal(pivot[1], .125, 'normalization must copy the pivot');
  assert.equal(C.normalizeWing({foil: false, pivot: [1, 2, 3]}).pivot, undefined);
});

test('removing a custom pivot restores the automatic root and legacy save behavior', () => {
  const {ship, wing} = fixture();
  delete wing.wing.pivot;
  near(C.wingPivot(ship, wing), [40, 80, 15], 'automatic inboard root');
  const restored = C.deserialize(C.serialize(ship)).parts[0];
  assert.equal(Object.hasOwn(restored.wing, 'pivot'), false);
  near(C.wingPivot(ship, restored), [40, 80, 15]);
});

for (const direction of ['horizontal', 'vertical']) {
  test(`${direction} twins preserve custom and centre hinges throughout deployment`, () => {
    for (const axis of ['x', 'y', 'z']) {
      for (const pivot of [[32.25, 75.5, 12.75], [40, 80, 30]]) {
        const {ship, wing} = fixture(axis, pivot), before = C.publicJSON(wing);
        const reflect = direction === 'horizontal' ? p => C.mirrorP(p) : p => C.vmirrorPoint(ship, p);
        const twin = direction === 'horizontal' ? C.mirrorPart(wing, ship) : C.vmirrorPart(wing, ship);
        near(twin.wing.pivot, reflect(pivot), `${axis} reflected pivot`);
        const point = [43, 81, 37], sourceFrame = C.foilFrame(ship, wing), twinFrame = C.foilFrame(ship, twin);
        for (const t of [0, .25, .5, 1]) {
          const angle = wing.wing.stow + (wing.wing.open - wing.wing.stow) * t;
          const twinAngle = twin.wing.stow + (twin.wing.open - twin.wing.stow) * t;
          near(C.foilAt(twinFrame, twin, reflect(point), twinAngle),
            reflect(C.foilAt(sourceFrame, wing, point, angle)), `${axis} reflected pose at ${t}`);
        }
        assert.equal(C.publicJSON(wing), before, 'mirroring must not change the original');
      }
    }
  });
}
