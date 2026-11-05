const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console, performance});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {C, G} = vm.runInContext('({C: Core, G: Gfx})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .001, `${actual} != ${expected}`);
function vector(actual, expected) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, i) => near(value, expected[i]));
}
function ship(hull = {}) {
  const s = C.newShip({L: 100, W: 40, H: 20, plan: 'rect', sec: 'rect', ...hull}, 'Design envelope fixture');
  s.detail = 0;
  s.armor = {hull: 0, cit: 0};
  return s;
}
function box(s, c, size, kind = 'struct', extra = {}) {
  const p = {id: s.nextId++, k: kind, c, s: size, form: 'box', ...extra};
  s.parts.push(p);
  return p;
}
function union(...bounds) {
  return [0, 1, 2].map(i => Math.min(...bounds.map(b => b[i])))
    .concat([3, 4, 5].map(i => Math.max(...bounds.map(b => b[i]))));
}

test('initial completed-ship dimensions keep placement ranges after hull edits and save/load', () => {
  const s = ship({L: 400, W: 120, H: 60});
  const envelope = plain(C.designEnvelope(s)), placement = plain(C.designPlacementBounds(s));
  const grid = Array.from(G.gridLines(s, [0, 0, 0, 400, 60, 120]).pos);
  assert.deepEqual(envelope, {L: 400, W: 120, H: 60});
  box(s, [350, 30, 45], [20, 10, 10]);
  const position = plain(s.parts[0].c);
  Object.assign(s.hull, {L: 80, W: 10, H: 5});
  assert.deepEqual(plain(C.designEnvelope(s)), envelope);
  assert.deepEqual(plain(C.designPlacementBounds(s)), placement);
  assert.deepEqual(Array.from(G.gridLines(s, [0, 0, 0, 80, 5, 10]).pos), grid);
  assert.deepEqual(plain(s.parts[0].c), position);
  const saved = plain(C.serialize(s)), loaded = C.deserialize(saved);
  assert.deepEqual(plain(C.designEnvelope(loaded)), envelope);
  assert.deepEqual(plain(C.designPlacementBounds(loaded)), placement);
  assert.deepEqual(plain(loaded.parts[0].c), position);
  assert.deepEqual(plain(C.serialize(C.deserialize(plain(C.serialize(loaded))))), plain(C.serialize(loaded)));
});

test('legacy blueprints infer their persistent envelope from the loaded hull', () => {
  const old = plain(C.serialize(ship({L: 320, W: 96, H: 48})));
  delete old.designEnvelope;
  const loaded = C.deserialize(old);
  assert.deepEqual(plain(C.designEnvelope(loaded)), {L: 320, W: 96, H: 48});
  const bounds = plain(C.designPlacementBounds(loaded));
  Object.assign(loaded.hull, {L: 60, W: 20, H: 10});
  assert.deepEqual(plain(C.designPlacementBounds(loaded)), bounds);
  const restored = C.deserialize(plain(C.serialize(loaded)));
  assert.deepEqual(plain(C.designEnvelope(restored)), {L: 320, W: 96, H: 48});
});

test('asymmetric extensions determine actual dimensions, classification length and fleet span', () => {
  const s = ship();
  box(s, [140, 10, 40], [20, 10, 10]);
  vector(C.shipBounds(s), [0, 0, -20, 150, 20, 45]);
  vector(C.shipDimensions(s), [150, 65, 20]);
  vector(C.shipSpan(s), [0, 150]);
  const S = C.computeStats(s), P = C.fleetProfile(S, s.name, s);
  vector(S.dims, [150, 65, 20]);
  near(S.hullLen, 150);
  near(P.len, 150);
  near(P.width, 65);
  near(P.height, 20);
  vector(G.shipBounds(s), C.shipBounds(s));
});

test('an assembly placeholder contributes no phantom physical extent', () => {
  const s = ship({assembly: true, L: 1000, W: 400, H: 200});
  box(s, [500, 100, 0], [100, 20, 10]);
  vector(C.shipBounds(s), [450, 95, -10, 550, 105, 10]);
  vector(C.shipDimensions(s), [100, 20, 10]);
  vector(C.shipSpan(s), [450, 550]);
  const S = C.computeStats(s);
  vector(S.dims, [100, 20, 10]);
  near(S.hullLen, 100);
  vector(G.shipBounds(s), C.shipBounds(s));
  near(G.fleetGeometry(s).length, 100);
});

test('fittings extend both ends of the actual ship and unplaced inventory does not', () => {
  const s = ship();
  const fore = {id: s.nextId++, k: 'claser', p: [155, 10, 0], a: 0, n: [1, 0, 0], ped: 0, base: 0, low: 0, float: false};
  const aft = {...fore, id: s.nextId++, p: [-30, 10, 0], a: 1, n: [-1, 0, 0]};
  s.fits.push(fore, aft);
  const expected = union([0, 0, -20, 100, 20, 20], C.fitAABB(fore), C.fitAABB(aft));
  vector(C.shipBounds(s), expected);
  near(C.computeStats(s).hullLen, expected[3] - expected[0]);
  s.parts.push({id: s.nextId++, k: 'sensor', c: [10000, 10000, 10000], d: 100, surfacePatch: 'missing:port', surfaceUnplaced: true});
  s.fits.push({...fore, id: s.nextId++, p: [-10000, 0, 0], surfacePatch: 'missing:fore', surfaceUnplaced: true});
  vector(C.shipBounds(s), expected);
});

test('engine bells and their occupied machinery fit inside the physical bounds', () => {
  const s = ship({assembly: true, L: 1000, W: 400, H: 200});
  const p = C.placePart(s, 'engine', [30, 20, 10], 12, {
    dir: [-1, 0, 0], nozzleLength: 6, machineryLengthM: 40,
    machineryRadiusM: 4, machineryOffsetM: 15, reactor: 0,
  });
  const b = C.shipBounds(s), machinery = C.enginePaths(s);
  assert.ok(machinery.length > 0);
  for (const a of [C.partAABB(p), C.engineSkinMesh(p).b, ...machinery.map(C.partAABB)]) {
    for (let i = 0; i < 3; i++) {
      assert.ok(b[i] <= a[i] + .001);
      assert.ok(b[i + 3] >= a[i + 3] - .001);
    }
  }
  vector(G.shipBounds(s), b);
  vector(C.computeStats(s).dims, C.shipDimensions(s));
});

test('actual structural length controls craft mechanics after a class boundary is crossed', () => {
  const s = ship({L: 12, W: 6, H: 4});
  s.shipClass = 'starfighter';
  assert.equal(C.isCraft(s), true);
  box(s, [110, 2, 0], [20, 4, 4]);
  assert.equal(C.isCraft(s), false);
  const S = C.computeStats(s);
  near(S.hullLen, 120);
  assert.equal(C.shipClassFor(S.hullLen, s.shipClass).id, 'corvette');
  near(C.fleetProfile(S, s.name, s).len, 120);
});

function meshBytes(g) {
  return Object.fromEntries(['pos', 'nor', 'uv', 'col', 'idx'].map(k => [k,
    Array.from(g[k].subarray(0, k === 'idx' ? g.ni : g.n * (k === 'col' ? 4 : k === 'uv' ? 2 : 3)))]));
}

test('per-face armor retains ordinary and reference structure skins, UVs, paint and selection', () => {
  for (const extra of [{skin: 'service', paint: '#425263', bands: [[.1, .2]], ribSpacing: 10},
    {form: 'reference', skinAsset: 'isdh_bridge', paint: '#425263'}]) {
    const s = ship({assembly: true});
    s.armor.hull = .5;
    s.detail = 1;
    const p = box(s, [100, 50, 0], [120, 80, 60], 'struct', extra);
    const before = G.meshParts(s, {coded: false}), original = plain(C.structTriangles(p));
    const outline = G.lineSet(); outline.part(p, [255, 255, 255, 255]);
    const selection = Array.from(outline.out().pos);
    assert.equal(C.setStructureFaceArmor(s, p.id, 'port', .2).ok, true);
    const after = G.meshParts(s, {coded: false});
    for (const name of ['struct', 'plate', 'refStruct']) assert.deepEqual(meshBytes(after.g[name]), meshBytes(before.g[name]), name + ' retains its original geometry and atlas');
    assert.equal(after.g.surfaceArmor.ni, 0, 'armor adds no replacement gray skin');
    assert.equal(after.g.surfaceDetail.ni, 0, 'armor creates no machinery relief');
    assert.deepEqual(plain(C.structTriangles(p)), original);
    const selected = G.lineSet(); selected.part(p, [255, 255, 255, 255]);
    assert.deepEqual(Array.from(selected.out().pos), selection);
    assert.ok(G.meshPreview(s, [p], [], {coded: false}).preview.ni + G.meshPreview(s, [p], [], {coded: false}).previewRef.ni > 0);
  }
});

test('new thin-armor light quads include zero and .3 m, exclude .31 m, and respect light settings deterministically', () => {
  const s = ship({assembly: true}); s.armor.hull = .5;
  const p = box(s, [100, 50, 0], [120, 80, 60]);
  assert.equal(C.setStructureFaceArmor(s, p.id, 'port', .3).ok, true);
  const first = plain(G.thinArmorLights(s));
  assert.ok(first.length > 0);
  assert.ok(first.every(q => q.host === p.id && q.patch.includes(':port:')));
  assert.deepEqual(plain(G.thinArmorLights(s)), first);
  for (const color of ['white', 'blue', 'warm']) {
    s.lights = color;
    assert.deepEqual(plain(G.thinArmorLights(s)), first, 'color changes retain placement');
    const mesh = G.meshParts(s, {coded: false}).g.surfaceDevices;
    assert.equal(mesh.ni, first.length * 6, 'production mesh contains the exact emissive quads');
    assert.ok(Array.from(mesh.col.subarray(3, mesh.n * 4)).filter((_, i) => i % 4 === 0).every(a => a === 253));
  }
  s.lights = 'off';
  assert.deepEqual(plain(G.thinArmorLights(s)), []);
  assert.equal(G.meshParts(s, {coded: false}).g.surfaceDevices.ni, 0);
  s.lights = 'white';
  C.setStructureFaceArmor(s, p.id, 'port', .31);
  assert.equal(G.thinArmorLights(s).length, 0);
  C.setStructureFaceArmor(s, p.id, 'port', 0);
  assert.ok(G.thinArmorLights(s).length > 0);
});

test('thin-armor point quads respect real occlusion and cutouts and remain globally bounded', () => {
  const s = ship({assembly: true}); s.armor.hull = .5;
  const p = C.placePart(s, 'struct', [100, 50, 0], [120, 80, 60], {form: 'box'});
  C.setStructureFaceArmor(s, p.id, 'port', .2);
  const visible = plain(G.thinArmorLights(s)); assert.ok(visible.length > 0);
  const cover = box(s, [100, 50, -40], [140, 20, 80]);
  assert.equal(G.thinArmorLights(s).filter(q => q.host === p.id && q.patch.includes(':port:')).length, 0, 'buried wall has no point lights');
  s.parts = s.parts.filter(q => q !== cover);
  assert.deepEqual(plain(G.thinArmorLights(s)), visible, 'separating the cover restores deterministic positions');
  const cut = C.normalizeSolidCut({id: s.nextId++, shape: 'box', c: [100, 50, 0], s: [40, 120, 20], rotation: [0, 0, 0], structures: true});
  s.solidCuts.push(cut);
  C.setStructureFaceArmor(s, p.id, 'port', .2);
  const opened = G.thinArmorLights(s); assert.ok(opened.length > 0);
  for (const q of opened) for (const point of q.points) assert.equal(C.solidCutContains(cut, point), false, 'a light quad cannot span the opening');
  const large = ship({assembly: true});
  for (let i = 0; i < 6; i++) box(large, [i * 3000, 500, 0], [1000, 1000, 1000]);
  const lamps = G.thinArmorLights(large), hosts = new Map(), faces = new Map();
  assert.ok(lamps.length > 0 && lamps.length <= 640);
  for (const q of lamps) { hosts.set(q.host, (hosts.get(q.host) || 0) + 1); faces.set(q.patch, (faces.get(q.patch) || 0) + 1); }
  assert.ok([...hosts.values()].every(n => n <= 128));
  assert.ok([...faces.values()].every(n => n <= 32));
  assert.equal(faces.size, 36, 'the bounded budget is shared across every exposed face');
});

test('renderer remains compatible with older Core stubs and thick-armor startup skips surface work', () => {
  const legacyContext = vm.createContext({console, performance, Core: {...C, shipBounds: undefined, designEnvelope: undefined, isStructuralPart: undefined}});
  vm.runInContext(fs.readFileSync(path.join(root, 'js/gfx.js'), 'utf8'), legacyContext, {filename: 'js/gfx.js'});
  const legacy = vm.runInContext('Gfx', legacyContext), s = ship();
  vector(legacy.shipBounds(s), [0, 0, -20, 100, 20, 20]);
  assert.ok(legacy.gridLines(s, [0, 0, -20, 100, 20, 20]).pos.length > 0);
  const p = box(s, [140, 10, 0], [20, 10, 10]);
  const rendered = legacy.meshParts(s, {coded: false});
  assert.ok(rendered.g.struct.ni > 0);
  assert.ok(rendered.ranges[p.id]?.some(([name, , count]) => name === 'struct' && count > 0));
  legacyContext.Core.surfacePatches = () => { throw Error('unexpected surface compilation'); };
  s.armor.hull = .5;
  assert.equal(legacy.thinArmorLights(s).length, 0);
  s.lights = 'off'; s.armor.hull = 0;
  assert.equal(legacy.thinArmorLights(s).length, 0);
});
