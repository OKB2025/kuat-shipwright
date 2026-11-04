const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console, performance: {now: () => 0}});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {C, G} = vm.runInContext('({C: Core, G: Gfx})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected, label, relative = 2e-6) => assert.ok(
  Math.abs(actual-expected) <= Math.max(2e-5, Math.abs(expected)*relative),
  `${label}: ${actual} != ${expected}`
);
const volume = size => size.reduce((product, value) => product*value, 1);
const fitting = (k, extra = {}) => ({id: 1, k, p: [0, 0, 0], a: 2, ped: 0, base: 0, low: 0, ...extra});
const dimensions = d => [d.fm, d.hm, d.wm];

function meshBounds(geo) {
  const result = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  assert.ok(geo.ni > 0, 'the renderer emitted indexed geometry');
  for (let i = 0; i < geo.ni; i++) {
    const offset = geo.idx[i]*3;
    for (let axis = 0; axis < 3; axis++) {
      const value = geo.pos[offset+axis];
      assert.ok(Number.isFinite(value), 'rendered positions are finite');
      result[axis] = Math.min(result[axis], value);
      result[axis+3] = Math.max(result[axis+3], value);
    }
  }
  return result;
}
function referenceBounds(f) {
  const asset = C.REFERENCE_ASSETS[C.FITS[f.k].asset];
  return meshBounds(asset?.plainMetal ? G.meshFits({fits: [f]}) : G.meshReferenceFits({fits: [f]}));
}
const span = bounds => [0, 1, 2].map(axis => bounds[axis+3]-bounds[axis]);

test('DBY-827 and the canonical eight-barrel turret retain their authored size as independent anchors', () => {
  for (const [k, barrels, volleyTT] of [['refVen', 2, 140], ['oct40', 8, 320]]) {
    const f = fitting(k), sizing = C.weaponSizing(f), rendered = span(referenceBounds(f));
    near(C.weaponModelScale(f), 1, `${k} anchor scale`);
    near(sizing.factor, 1, `${k} sizing scale`);
    assert.equal(sizing.barrels, barrels);
    near(sizing.volleyTT, volleyTT, `${k} anchor energy`);
    for (let axis = 0; axis < 3; axis++) near(sizing.sourceSize[axis], rendered[axis], `${k} source axis ${axis}`);
    near(sizing.sourceVolume, volume(rendered), `${k} source envelope volume`);
    near(sizing.targetVolume, sizing.sourceVolume, `${k} anchor target`);
  }
});

test('weapon volume follows salvo energy and interpolates the two anchor volume densities by barrel count', () => {
  const twinDensity = volume(span(referenceBounds(fitting('refVen'))))/140;
  const octupleDensity = volume(span(referenceBounds(fitting('oct40'))))/320;
  for (const k of ['pd', 'ltl', 'mtl', 'htl', 'stl', 'utl', 'ion', 'ionL', 'triple40', 'quad200', 'oct40', 'xx9', 'nk7']) {
    const f = fitting(k), d = C.FITS[k], sizing = C.weaponSizing(f);
    const blend = Math.min(1, Math.max(0, (d.barrels-2)/6));
    const salvo = Math.max(d.tt || 0, d.ion || 0);
    const target = salvo*(twinDensity*(1-blend)+octupleDensity*blend);
    near(sizing.anchorBlend, blend, `${k} barrel interpolation`);
    near(sizing.volleyTT, salvo, `${k} salvo energy`);
    near(sizing.sourceVolume, volume(Array.from(sizing.sourceSize)), `${k} source volume`);
    near(sizing.targetVolume, target, `${k} target volume`);
    near(C.weaponModelScale(f), Math.cbrt(target/sizing.sourceVolume), `${k} cube-root scale`);
    near(volume(dimensions(d)), target, `${k} canonical envelope volume`);
    for (let axis = 0; axis < 3; axis++) near(dimensions(d)[axis], sizing.sourceSize[axis]*sizing.factor, `${k} preserved aspect axis ${axis}`);
  }
});

test('point defense is the uploaded twin small dual-purpose turbolaser with explicit higher output', () => {
  const d = C.FITS.pd, sizing = C.weaponSizing(fitting('pd'));
  assert.ok(d.asset && C.REFERENCE_ASSETS[d.asset], 'point defense uses a registered imported model');
  assert.equal(d.barrels, 2);
  assert.equal(d.boltTT, 2.5);
  assert.equal(d.tt, 5);
  assert.equal(d.cycle, .2);
  assert.equal(d.aa, 6);
  assert.equal(d.dualPurpose, true);
  near(d.power, d.tt*C.TT/d.cycle, 'PD continuous electrical demand');
  near(sizing.sourceSize[0], 9, 'uploaded model length');
  near(sizing.sourceSize[1], 3.1493375257895857, 'uploaded model height');
  near(sizing.sourceSize[2], 5.729853188053728, 'uploaded model width');
  assert.ok(d.fm > 8 && d.fm < 11, 'the explicit output produces a roughly nine-metre model');
});

test('resizing conventional weapons does not alter their energy, cycle, crew or price', () => {
  for (const [k, salvo, cycle, mass, crew, cost] of [
    ['ltl', .08, .5, 900, 6, 80e3], ['mtl', .6, .2, 2400, 10, 200e3],
    ['htl', 140, 1, 6000, 18, 500e3], ['xx9', 80, 4, 2400, 10, 400e3],
    ['nk7', 40, 4, 1500, 8, 350e3]
  ]) {
    const d = C.FITS[k];
    near(Math.max(d.tt || 0, d.ion || 0), salvo, `${k} unchanged salvo`);
    assert.equal(d.cycle, cycle, `${k} unchanged cycle`);
    assert.equal(d.mass, mass, `${k} unchanged mass`);
    assert.equal(d.crew, crew, `${k} unchanged crew`);
    assert.equal(d.cost, cost, `${k} unchanged cost`);
  }
  near(C.FITS.oct40.tt, 320, 'the canonical octuple keeps its 320 TT rating');
  near(C.FITS.stl.tt, 350, 'the canonical heavy twin keeps its 350 TT rating');
});

test('aircraft weapons, fixed launchers, missiles, tractors and bridge equipment keep their existing dimensions', () => {
  const excluded = {
    claser: [2.6, .32, .32], claserH: [3.6, .5, .5], cion: [1.8, .55, .55],
    cturret: [1.3, .7, 1.3], ctorp: [1.4, .5, .5], cmsl: [1.2, .45, .45],
    cbomb: [2.4, .7, 1.2], cpylon: [1.2, .2, .16], msl: [1.2, .45, .45],
    itl: [12, 3, 12], trc: [16, 8, 16], brS: [34, 22, 26]
  };
  for (const [k, expected] of Object.entries(excluded)) {
    near(C.weaponModelScale(fitting(k)), 1, `${k} excluded scale`);
    assert.deepEqual(plain(dimensions(C.FITS[k])), expected, `${k} unchanged dimensions`);
  }
});

test('imported gun rendering, selection and collision use the same scaled geometry for every mount frame', () => {
  for (const k of ['pd', 'refVen', 'oct40', 'stl']) {
    for (const a of [0, 1, 2, 3, 4, 5]) {
      for (const tilt of [null, C.norm([.2, .9, -.3])]) {
        const f = fitting(k, {a, p: [31, -7, 9], assetYaw: 37, ...(tilt ? {tilt} : {})});
        const rendered = referenceBounds(f), collision = C.fitAABB(f);
        assert.ok(collision.every(Number.isFinite), `${k} finite selection bounds`);
        for (let axis = 0; axis < 3; axis++) {
          assert.ok(rendered[axis] >= collision[axis]-1e-4, `${k} lower bound axis ${axis}, mount ${a}`);
          assert.ok(rendered[axis+3] <= collision[axis+3]+1e-4, `${k} upper bound axis ${axis}, mount ${a}`);
        }
      }
    }
  }
});

test('model calibration preserves authored pose and mount origin while scaling the whole imported model', () => {
  for (const k of ['pd', 'oct40', 'stl']) {
    const f = fitting(k), sizing = C.weaponSizing(f), rendered = span(referenceBounds(f));
    for (let axis = 0; axis < 3; axis++) near(rendered[axis], sizing.sourceSize[axis]*sizing.factor, `${k} complete mesh axis ${axis}`);
    const shift = [41, -5, 3], moved = {...f, p: shift};
    const origin = C.fitOrigin(f), movedOrigin = C.fitOrigin(moved);
    const before = C.referenceFitPoint(f, [.23, -.17, .39]);
    const after = C.referenceFitPoint(moved, [.23, -.17, .39]);
    for (let axis = 0; axis < 3; axis++) {
      near(movedOrigin[axis]-origin[axis], shift[axis], `${k} mount translation`);
      near(after[axis]-before[axis], shift[axis], `${k} mesh follows mounting origin`);
    }
  }
});

test('small procedural guns scale every body vertex uniformly while explicit pedestal height stays fixed', () => {
  // Render the real authored meshes with only the one-time sizing pass disabled.
  // This compares whole shapes rather than reproducing the renderer's dimensions.
  const baseline = vm.createContext({console, performance: {now: () => 0}});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js']) {
    let source = fs.readFileSync(path.join(root, file), 'utf8');
    if (file === 'js/core.js') {
      const initialization = '\ninitializeWeaponSizing();\n';
      assert.equal(source.split(initialization).length, 2, 'the baseline disables exactly one sizing initialization');
      source = source.replace(initialization, '\n/* Test baseline: keep authored weapon dimensions. */\n');
    }
    vm.runInContext(source, baseline, {filename: file});
  }
  const {C: originalCore, G: originalGfx} = vm.runInContext('({C: Core, G: Gfx})', baseline);
  for (const k of ['ltl', 'casemateLight', 'utl']) {
    for (const frame of [{a: 2}, {a: 4, tilt: C.norm([.2, .9, -.3])}]) {
      const f = fitting(k, {p: [13, -7, 11], assetYaw: 31, ...frame});
      const factor = C.weaponModelScale(f), origin = C.fitOrigin(f);
      const before = originalGfx.meshFits({fits: [f]}), after = G.meshFits({fits: [f]});
      assert.equal(after.n, before.n, `${k} keeps body topology`);
      assert.deepEqual(Array.from(after.idx.slice(0, after.ni)), Array.from(before.idx.slice(0, before.ni)), `${k} keeps triangle connectivity`);
      for (let vertex = 0; vertex < before.n; vertex++) {
        for (let axis = 0; axis < 3; axis++) {
          near(after.pos[vertex*3+axis], origin[axis]+(before.pos[vertex*3+axis]-origin[axis])*factor, `${k} uniformly scaled body vertex ${vertex}, axis ${axis}`);
        }
      }

      const lifted = {...f, base: 2, ped: 3, low: -1};
      const oldLiftedOrigin = originalCore.fitOrigin(lifted), liftedOrigin = C.fitOrigin(lifted);
      assert.deepEqual(plain(liftedOrigin), plain(oldLiftedOrigin), `${k} explicit mounting height is unchanged`);
      const oldLifted = originalGfx.meshFits({fits: [lifted]}), newLifted = G.meshFits({fits: [lifted]});
      const supportVertices = newLifted.n-after.n;
      assert.ok(supportVertices > 0, `${k} renders the requested support`);
      assert.equal(oldLifted.n-before.n, supportVertices, `${k} keeps support topology`);
      const up = C.fitUp(lifted);
      let lower = Infinity, upper = -Infinity;
      for (let vertex = 0; vertex < supportVertices; vertex++) {
        const oldPoint = Array.from(oldLifted.pos.slice(vertex*3, vertex*3+3));
        const newPoint = Array.from(newLifted.pos.slice(vertex*3, vertex*3+3));
        const delta = C.sub(oldPoint, oldLiftedOrigin), height = C.dot(delta, up);
        const radial = C.sub(delta, C.mul(up, height));
        const expected = C.add(liftedOrigin, C.add(C.mul(radial, factor), C.mul(up, height)));
        for (let axis = 0; axis < 3; axis++) near(newPoint[axis], expected[axis], `${k} support radius scales without moving height`);
        const newHeight = C.dot(C.sub(newPoint, liftedOrigin), up);
        lower = Math.min(lower, newHeight); upper = Math.max(upper, newHeight);
      }
      near(lower, -6, `${k} support still fills six metres down from the mount`);
      near(upper, 0, `${k} support still meets the mounting origin`);
      for (let vertex = 0; vertex < after.n; vertex++) {
        for (let axis = 0; axis < 3; axis++) {
          near(newLifted.pos[(vertex+supportVertices)*3+axis]-after.pos[vertex*3+axis], liftedOrigin[axis]-origin[axis], `${k} body follows explicit support height`);
        }
      }
    }
  }
});

test('standard-size normalization and save reload retain calibration without a manual fitting scale', () => {
  const ship = C.newShip({L: 240, W: 200, H: 140, assembly: true}, 'Calibrated weapon sizes');
  ship.parts = [];
  ship.fits = ['pd', 'ltl', 'refVen', 'oct40', 'stl'].map((k, index) => fitting(k, {id: index+1, p: [40+index*40, 60, 0], float: true, scale: 3}));
  const loaded = C.deserialize(C.serialize(ship));
  for (const f of loaded.fits) {
    assert.equal(Object.hasOwn(f, 'scale'), false, `${f.k} obsolete manual scale is normalized`);
    near(C.weaponModelScale(f), C.weaponModelScale(fitting(f.k)), `${f.k} canonical model size survives reload`);
    assert.deepEqual(plain(dimensions(C.fitSpec(f))), plain(dimensions(C.FITS[f.k])));
  }
  const again = C.deserialize(C.serialize(loaded));
  assert.deepEqual(plain(again.fits), plain(loaded.fits), 'repeated save/reload does not accumulate a visual scale');
});
