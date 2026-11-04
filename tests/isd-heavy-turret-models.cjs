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
const near = (actual, expected, epsilon = 1e-3) => assert.ok(Math.abs(actual-expected) <= epsilon, `${actual} != ${expected}`);
const kinds = ['stl', 'oct40'];

function components(mesh, startVertex, endVertex, firstIndex, endIndex) {
  const parent = Array.from({length: endVertex}, (_, i) => i);
  const find = i => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  const join = (a, b) => { parent[find(a)] = find(b); };
  // Imported UV seams split vertices. Weld exact packed positions before
  // counting connected pieces so every whole barrel is counted once.
  const welded = new Map();
  for (let i = startVertex; i < endVertex; i++) {
    const key = Array.from(mesh.pos.slice(i*3, i*3+3)).join(',');
    if (welded.has(key)) join(i, welded.get(key)); else welded.set(key, i);
  }
  for (let i = firstIndex; i < endIndex; i += 3) {
    const tri = Array.from(mesh.idx.slice(i, i+3));
    assert.ok(tri.every(v => v >= startVertex && v < endVertex), 'components stay inside their geometry partition');
    join(tri[0], tri[1]); join(tri[0], tri[2]);
  }
  const groups = new Map();
  for (let i = startVertex; i < endVertex; i++) {
    const group = find(i);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(i);
  }
  return [...groups.values()];
}
function bounds(asset, mesh, vertices) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const vertex of vertices) for (let axis = 0; axis < 3; axis++) {
    const value = mesh.pos[vertex*3+axis]*asset.size[axis]+asset.c[axis];
    assert.ok(Number.isFinite(value));
    box[axis] = Math.min(box[axis], value);
    box[axis+3] = Math.max(box[axis+3], value);
  }
  return box;
}

test('the canonical twin and octuple preserve the same original housing, textures and normalized mounting frame', () => {
  const twin = C.REFERENCE_ASSETS.isd_heavy_twin, octuple = C.REFERENCE_ASSETS.isd_heavy_octuple;
  const a = C.decodeReference('isd_heavy_twin'), b = C.decodeReference('isd_heavy_octuple');
  assert.deepEqual(plain(twin.size), plain(octuple.size));
  assert.deepEqual(plain(twin.c), plain(octuple.c));
  assert.equal(twin.housingVertices, octuple.housingVertices);
  assert.equal(twin.housingFaces, octuple.housingFaces);
  assert.ok(twin.housingVertices > 0 && twin.housingFaces > 0);
  assert.deepEqual(Array.from(a.pos.slice(0, twin.housingVertices*3)), Array.from(b.pos.slice(0, octuple.housingVertices*3)));
  assert.deepEqual(Array.from(a.uv.slice(0, twin.housingVertices*2)), Array.from(b.uv.slice(0, octuple.housingVertices*2)));
  assert.deepEqual(Array.from(a.idx.slice(0, twin.housingFaces*3)), Array.from(b.idx.slice(0, octuple.housingFaces*3)));
  for (const asset of [twin, octuple]) {
    assert.equal(asset.derivedFrom, 'isd_turret');
    assert.deepEqual(plain(asset.mount), [0, 0, 0]);
    assert.deepEqual(plain(asset.forward), [1, 0, 0]);
    assert.deepEqual(plain(asset.up), [0, 1, 0]);
    const mesh = C.decodeReference(asset === twin ? 'isd_heavy_twin' : 'isd_heavy_octuple');
    assert.equal(mesh.pos.length, asset.n*3);
    assert.equal(mesh.idx.length, asset.faces*3);
    assert.equal(components(mesh, 0, asset.housingVertices, 0, asset.housingFaces*3).length, asset.housingComponents);
    const box = bounds(asset, mesh, Array.from({length: asset.n}, (_, i) => i));
    near(box[1], 0);
    near((box[0]+box[3])/2, 0);
    near((box[2]+box[5])/2, 0);
  }
});

test('packed geometry contains two thick or eight thin connected barrels of the same length pointing along +X', () => {
  const dimensions = [];
  for (const [key, count] of [['isd_heavy_twin', 2], ['isd_heavy_octuple', 8]]) {
    const asset = C.REFERENCE_ASSETS[key], mesh = C.decodeReference(key);
    const barrels = components(mesh, asset.housingVertices, asset.n, asset.housingFaces*3, mesh.idx.length);
    assert.equal(asset.barrels, count);
    assert.equal(barrels.length, count, `${key} must contain the advertised physical barrels`);
    const sizes = barrels.map(vertices => {
      const box = bounds(asset, mesh, vertices), size = [0, 1, 2].map(axis => box[axis+3]-box[axis]);
      assert.ok(size[0] > 10*size[1] || count === 2 && size[0] > 7*size[1], 'barrels run along the forward axis');
      assert.ok(box[3] > Math.abs(box[0]), 'the muzzle projects in +X from its breech');
      return size;
    });
    for (const size of sizes) for (let axis = 0; axis < 3; axis++) near(size[axis], sizes[0][axis], .002);
    dimensions.push(sizes[0]);
  }
  near(dimensions[0][0], dimensions[1][0], 1e-6);
  for (const axis of [1, 2]) near(dimensions[1][axis]/dimensions[0][axis], Math.cbrt(40/175), .001);
});

test('heavy models use the standardized physical pivot in editor, preview and trial turret geometry', () => {
  for (const k of kinds) {
    const asset = C.REFERENCE_ASSETS[C.FITS[k].asset];
    assert.ok(asset, `${k} uses the shared-housing imported model`);
    for (const a of [0, 1, 2, 3, 4, 5]) {
      const f = {id: 1, k, p: [30, -7, 19], a, ped: 2, base: 1, low: -.5, assetYaw: 37.125};
      const pivot = asset.c.map((value, axis) => -value/asset.size[axis]);
      C.referenceFitPoint(f, pivot).forEach((value, axis) => near(value, C.fitOrigin(f)[axis], 1e-6));
    }
    const f = {id: 1, k, p: [30, -7, 19], a: 2, ped: 0, base: 0, low: 0, float: false, assetYaw: 37.125};
    const ship = C.newShip({L: 200, W: 100, H: 50, assembly: true}, 'Heavy turret');
    ship.parts = []; ship.fits = [f];
    const preview = G.meshPreview(ship, [], [f]);
    assert.equal(preview.previewRefFits.ni+preview.previewFits.ni, asset.faces*3);
    const fleet = G.fleetGeometry(ship, {trial: true}), turret = fleet.turrets.find(t => t.id === f.id);
    assert.ok(turret);
    assert.equal(turret.barrels, C.FITS[k].barrels);
    assert.equal(fleet.meshes[turret.mesh].geo.ni, asset.faces*3);
    turret.pivot.forEach((value, axis) => near(value, C.fitOrigin(f)[axis], 1e-6));
  }
});
