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
function near(actual, expected, message = 'coordinate', tolerance = .00015) {
  assert.ok(Math.abs(actual-expected) <= tolerance, `${message}: ${actual} != ${expected}`);
}
function vector(actual, expected, message) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => near(value, expected[i], `${message || 'vector'} [${i}]`));
}
function fixture(...parts) {
  const ship = C.newShip({assembly: true, L: 600, W: 300, H: 200}, 'Engine bell appearance');
  ship.parts = parts;
  ship.fits = [];
  ship.detail = 0;
  ship.armor = {hull: 0, cit: 0};
  ship.nextId = 20;
  return ship;
}
function generic(overrides = {}) {
  return {id: 1, k: 'engine', c: [80, 90, 15], d: 60, dir: [-1, 0, 0], nozzleLength: 23, bodyLength: 84, bodyRadius: .46, ...overrides};
}
function equipment(asset, overrides = {}) {
  const source = C.sourceEngine({skinAsset: asset}), style = asset.startsWith('ven_') ? 'exposed' : 'internal';
  const part = {
    ...C.equipmentOptions(style === 'exposed' ? 'exposedTurbine' : 'internalTurbine'),
    id: 1, c: [80, 90, 15], dir: [-1, 0, 0], d: source.d,
    skinAsset: asset, skinAnchor: source.anchor.slice(), skinDiameter: source.d,
  };
  C.resizeEngine(part, source.d, C.engineBaseline(style, source.d, 'length'));
  return Object.assign(part, overrides);
}
function indexedTriangles(mesh) {
  const result = [];
  for (let i = 0; i < mesh.ni; i += 3) {
    result.push([0, 1, 2].map(j => {
      const k = mesh.idx[i+j];
      return Array.from(mesh.pos.subarray(k*3, k*3+3), value => value.toFixed(4)).join(',');
    }).join(';'));
  }
  return result.sort();
}
function geometry(mesh) {
  return plain({
    n: mesh.n, ni: mesh.ni,
    pos: Array.from(mesh.pos.subarray(0, mesh.n*3)),
    nor: Array.from(mesh.nor.subarray(0, mesh.n*3)),
    uv: Array.from(mesh.uv.subarray(0, mesh.n*2)),
    col: Array.from(mesh.col.subarray(0, mesh.n*4)),
    idx: Array.from(mesh.idx.subarray(0, mesh.ni)),
  });
}
function physics(ship) {
  return plain({
    engines: ship.parts.filter(p => p.k === 'engine').map(p => ({
      id: p.id, volume: C.partVolume(p), bounds: C.partAABB(p), referenceBounds: C.refPartBounds(p),
      thrust: C.nozzleThrust(p), power: C.nozzleDemand(p),
    })),
    paths: C.enginePaths(ship),
  });
}

test('ordinary and saved turbine engines resolve to ISD bells without changing saved geometry or performance', () => {
  const parts = [generic(), generic({id: 2, d: 112, nozzleLength: 41})];
  for (let i = 0; i < 7; i++) parts.push(equipment('isd_engine_'+i, {id: i+3, reactor: 15}));
  parts.push({id: 15, k: 'gen', c: [450, 90, 0], d: 60});
  const ship = fixture(...parts), saved = C.publicJSON(ship), physical = physics(ship);
  for (const p of parts.filter(p => p.k === 'engine')) {
    const expected = p.d > 70 ? 'isdh_engine_main' : 'isdh_engine_aux';
    assert.equal(C.engineAppearance(p).skinAsset, expected);
    assert.equal(C.engineSkinMesh(p).skinAsset, expected);
  }
  G.meshParts(ship, {coded: false});
  G.meshPreview(ship, parts.filter(p => p.k === 'engine'), [], {coded: false});
  assert.equal(C.publicJSON(ship), saved, 'drawing must not migrate authored dimensions, assets or equipment IDs');
  assert.deepEqual(physics(ship), physical, 'appearance cannot change occupied machinery, power demand or thrust');
  const loaded = JSON.parse(saved);
  for (const p of loaded.parts.filter(p => p.k === 'engine')) {
    assert.equal(C.engineSkinMesh(p).skinAsset, p.d > 70 ? 'isdh_engine_main' : 'isdh_engine_aux');
  }
  assert.deepEqual(plain(loaded.parts.map(p => p.skinAsset)), plain(parts.map(p => p.skinAsset)), 'old asset IDs survive a saved-state round trip');
});

test('catalog thrust and power laws stay independent of the replacement appearance', () => {
  for (const [asset, thrust, power] of [
    ['isd_engine_0', 374447550285105.6, 8.727272727272728e23],
    ['isd_engine_3', 40955200812433.42, 9.545454545454544e22],
    ['isdh_engine_main', 219893589268224, 5.125073786866799e23],
    ['isdh_engine_aux', 32152014142128.51, 7.49369026278409e22],
  ]) {
    const p = equipment(asset);
    assert.ok(Math.abs(C.nozzleThrust(p)/thrust-1) < 1e-12, asset+' thrust law');
    assert.ok(Math.abs(C.nozzleDemand(p)/power-1) < 1e-12, asset+' power law');
  }
  const p = generic();
  near(C.partVolume(p), Math.PI*(p.d/2)**2*p.nozzleLength, 'generic physical nozzle volume');
  assert.equal(C.refPartBounds(p), null, 'a virtual skin does not acquire a physical reference envelope');
  const old = equipment('isd_engine_0'), physical = plain(C.refPartBounds(old));
  assert.notDeepEqual(physical, plain(C.engineSkinMesh(old).b), 'saved turbine dimensions remain independent of their new bell appearance');
  assert.deepEqual(plain(C.refPartBounds(old)), physical);
});

test('generic bells fit the requested nozzle depth and stop at the collar in every direction and diameter', () => {
  for (const d of [6, 51.66, 70, 70.01, 94.8, 112]) {
    const p = generic({d, dir: C.norm([-.7, .3, .6]), nozzleLength: 17.5, bodyLength: 340});
    const appearance = C.engineAppearance(p), mesh = C.engineSkinMesh(p), source = C.sourceEngine(appearance), asset = C.REFERENCE_ASSETS[mesh.skinAsset];
    assert.ok(mesh.idx.length > 0 && mesh.uv.length === mesh.pos.length/3*2);
    const forward = C.mul(C.norm(p.dir), -1);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < mesh.pos.length; i += 3) {
      const axial = C.dot(C.sub(Array.from(mesh.pos.subarray(i, i+3)), p.c), forward);
      min = Math.min(min, axial); max = Math.max(max, axial);
    }
    near(max, p.nozzleLength/2, 'the bell ends at the physical front collar');
    assert.ok(min < -p.nozzleLength/2, 'the source rim overhang must survive scaling');
    assert.ok(max-min < p.nozzleLength*1.15, 'a generic nozzle must not acquire the source turbine body');
    // The nominal mouth is an authored point, not the furthest lip of the source mesh.
    const mouth = source.anchor.map((value, i) => (value-asset.c[i])/asset.size[i]);
    mouth[0] -= source.nozzleLength/2/asset.size[0];
    vector(C.referenceEnginePoint(appearance, mouth, asset), C.add(p.c, C.mul(C.norm(p.dir), p.nozzleLength/2)), 'nozzle mouth stays at the requested pivot');
  }
  const narrow = generic({d: 40, nozzleLength: 21}), wide = generic({d: 60, nozzleLength: 21});
  const a = C.engineSkinMesh(narrow), b = C.engineSkinMesh(wide);
  near(a.t0, b.t0, 'diameter cannot lengthen a fixed-depth bell');
  near(a.t1, b.t1, 'diameter cannot move its mouth');
  near(b.rad/a.rad, 1.5, 'diameter changes the radial scale');
});

test('authored Heataker ISD and exposed Venator engines retain their original source triangles', () => {
  for (const assetId of ['isdh_engine_main', 'isdh_engine_aux', 'ven_inner_port', 'ven_aux_stbd']) {
    const p = equipment(assetId, {c: [215, 127, -68], dir: C.norm([-.45, .76, .21])});
    const source = C.sourceEngine(p), asset = C.REFERENCE_ASSETS[assetId], decoded = C.decodeReference(assetId), mesh = C.engineSkinMesh(p);
    assert.equal(C.engineAppearance(p), p, 'authored source geometry needs no substitute appearance');
    assert.equal(mesh.skinAsset, assetId);
    assert.deepEqual(Array.from(mesh.idx), Array.from(decoded.idx));
    const forward = C.mul(C.norm(p.dir), -1), right = C.norm(C.cross(forward, [0, 1, 0])), up = C.norm(C.cross(right, forward));
    for (let i = 0; i < decoded.pos.length; i += 3) {
      const q = [0, 1, 2].map(k => decoded.pos[i+k]*asset.size[k]+asset.c[k]-source.anchor[k]);
      const expected = C.add(p.c, C.add(C.mul(forward, q[0]), C.add(C.mul(up, q[1]), C.mul(right, q[2]))));
      vector(Array.from(mesh.pos.subarray(i, i+3)), expected, assetId+' original vertex');
    }
  }
  const unskinned = equipment('ven_inner_port');
  delete unskinned.skinAsset;
  const saved = JSON.stringify(unskinned);
  assert.equal(C.engineAppearance(unskinned), unskinned, 'an unskinned exposed turbine keeps its authored appearance choice');
  assert.equal(C.engineSkinMesh(unskinned), null, 'an exposed turbine must not acquire an ISD bell automatically');
  assert.equal(JSON.stringify(unskinned), saved);
});

test('moving, rotating and resizing a bell refreshes its cached mesh, visible picking and selection outline', () => {
  const p = generic({d: 94.8, nozzleLength: 35}), first = C.engineSkinMesh(p);
  assert.equal(C.engineSkinMesh(p), first, 'unchanged geometry reuses the completed mesh');
  const delta = [31, -18, 27];
  p.c = C.add(p.c, delta);
  const moved = C.engineSkinMesh(p);
  assert.notEqual(moved, first);
  vector(moved.b.slice(0, 3), C.add(first.b.slice(0, 3), delta), 'translated bounds');
  p.dir = C.norm([-.61, .48, -.35]);
  const rotated = C.engineSkinMesh(p);
  assert.notEqual(rotated, moved);
  near(rotated.rad, moved.rad, 'rotation preserves radius');
  near(rotated.t0, moved.t0, 'rotation preserves axial depth');
  p.d *= 1.2;
  const resized = C.engineSkinMesh(p);
  assert.notEqual(resized, rotated);
  near(resized.rad/rotated.rad, 1.2, 'resized radius');
  near(resized.t1, rotated.t1, 'a diameter edit keeps the nominal mouth fixed');
  p.nozzleLength *= 1.4;
  const deeper = C.engineSkinMesh(p);
  assert.notEqual(deeper, resized);
  near(deeper.t0/resized.t0, 1.4, 'edited front collar');
  near(deeper.t1/resized.t1, 1.4, 'edited nozzle depth');
  near(deeper.rad, resized.rad, 'depth cannot widen the bell');

  const outline = G.lineSet(); outline.part(p, [255, 255, 255, 255]);
  const positions = outline.out().pos, axial = [];
  for (let i = 0; i < positions.length; i += 3) axial.push(C.dot(C.sub(Array.from(positions.subarray(i, i+3)), p.c), deeper.u));
  near(Math.min(...axial), deeper.t0, 'selection encloses the actual front');
  near(Math.max(...axial), deeper.t1, 'selection encloses the actual rim');

  // Aim at a visible lip outside the old physical cylinder. This would be
  // unselectable if the generic engine still used only cylinder picking.
  let ray;
  for (let i = 0; i < deeper.T.length && !ray; i += 9) {
    const tri = [0, 3, 6].map(j => Array.from(deeper.T.subarray(i+j, i+j+3))), center = C.mul(tri.reduce((sum, point) => C.add(sum, point), [0, 0, 0]), 1/3);
    const relative = C.sub(center, p.c), radial = C.sub(relative, C.mul(deeper.u, C.dot(relative, deeper.u)));
    if (C.len(radial) <= p.d/2+.02) continue;
    const normal = C.norm(radial), origin = C.add(center, C.mul(normal, p.d)), direction = C.mul(normal, -1), hit = C.rayTris(deeper.T, origin, direction);
    if (hit) ray = {origin, direction, hit};
  }
  assert.ok(ray, 'the source lip must include visible geometry outside the nominal cylinder');
  const picked = C.rayPart(ray.origin, ray.direction, p);
  assert.ok(picked, 'the visible bell lip must be selectable');
  near(picked.t, ray.hit.t, 'selection uses the drawn skin');
});

test('editor, live preview and fleet render the same reference geometry and retain per-engine ranges', () => {
  for (const part of [generic(), equipment('isd_engine_0'), equipment('isdh_engine_aux'), equipment('ven_inner_stbd')]) {
    const ship = fixture(part), saved = C.publicJSON(ship), full = G.meshParts(ship, {coded: false});
    const preview = G.meshPreview(ship, [part], [], {coded: false}), fleet = G.fleetGeometry(ship);
    assert.ok(full.g.refEngine.ni > 0, 'every supported bell must use the shared reference material batch');
    assert.deepEqual(geometry(preview.previewRef), geometry(full.g.refEngine), 'preview keeps source geometry, UVs, normals and material factors');
    assert.deepEqual(geometry(fleet.meshes.refEngine.geo), geometry(full.g.refEngine), 'fleet uses the same bell appearance');
    assert.ok(full.ranges[part.id].some(([name,, count]) => name === 'refEngine' && count === full.g.refEngine.ni), 'an edited bell must remain individually hideable');
    assert.equal(C.publicJSON(ship), saved);
    assert.deepEqual(indexedTriangles(full.g.refEngine), indexedTriangles({ni: C.engineSkinMesh(part).idx.length, ...C.engineSkinMesh(part)}));
  }
});

test('bell emission still requires a connected reactor and an unobstructed exhaust', () => {
  const engine = generic({reactor: 2}), reactor = {id: 2, k: 'gen', c: [400, 90, 15], d: 50}, ship = fixture(engine, reactor);
  const active = G.meshParts(ship, {coded: false});
  assert.ok(active.g.nozzle.ni > 0);
  assert.equal(active.glow.length, 4);
  ship.parts = [engine];
  const unpowered = G.meshParts(ship, {coded: false});
  assert.equal(unpowered.g.nozzle.ni, 0);
  assert.equal(unpowered.glow.length, 0, 'a visual skin cannot supply its own power');
  const exhaust = C.add(engine.c, C.mul(C.norm(engine.dir), engine.nozzleLength/2+Math.max(1, engine.d*.1)));
  ship.parts = [engine, reactor, {id: 3, k: 'shield', c: exhaust, d: 12}];
  const blocked = G.meshParts(ship, {coded: false});
  assert.equal(blocked.g.nozzle.ni, 0);
  assert.equal(blocked.glow.length, 0, 'blocked exhaust must not glow');
});
