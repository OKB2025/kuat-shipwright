const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
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

test('the retained 350 TT twin preserves its original housing, texture data and normalized mounting frame', () => {
  const asset=C.REFERENCE_ASSETS.isd_heavy_twin,mesh=C.decodeReference('isd_heavy_twin');
  assert.equal(asset.derivedFrom,'isd_turret');assert.equal(asset.barrels,2);assert.ok(asset.housingVertices>0&&asset.housingFaces>0);
  assert.deepEqual(plain(asset.mount),[0,0,0]);assert.deepEqual(plain(asset.forward),[1,0,0]);assert.deepEqual(plain(asset.up),[0,1,0]);
  assert.equal(mesh.pos.length,asset.n*3);assert.equal(mesh.idx.length,asset.faces*3);
  assert.equal(components(mesh,0,asset.housingVertices,0,asset.housingFaces*3).length,asset.housingComponents);
  const box=bounds(asset,mesh,Array.from({length:asset.n},(_,i)=>i));near(box[1],0);near((box[0]+box[3])/2,0);near((box[2]+box[5])/2,0);
  assert.equal(C.FITS.stl.tt,350);assert.equal(C.FITS.stl.boltTT,175);
});

test('the retained thick twin and size-corrected original octuple contain their actual two and eight full barrels', () => {
  const twin=C.REFERENCE_ASSETS.isd_heavy_twin,mesh=C.decodeReference('isd_heavy_twin');
  const barrels=components(mesh,twin.housingVertices,twin.n,twin.housingFaces*3,mesh.idx.length);assert.equal(barrels.length,2);
  const sizes=barrels.map(vertices=>{const box=bounds(twin,mesh,vertices),size=[0,1,2].map(k=>box[k+3]-box[k]);assert.ok(size[0]>7*size[1]);assert.ok(box[3]>Math.abs(box[0]));return size;});
  sizes[0].forEach((n,k)=>near(n,sizes[1][k],.002));
  const oct=C.REFERENCE_ASSETS.isd_heavy_octuple,om=C.decodeReference('isd_heavy_octuple');assert.equal(oct.barrels,8);assert.equal(C.FITS.oct40.tt,320);near(oct.size[0],40,.05);near(oct.size[2],40*29.679456059608558/29.679587322727336,.005);
  assert.notDeepEqual(plain(oct.size),plain(twin.size),'the native40m octuple retains its explicit size anchor');
  for(const row of oct.barrelCenters){const group=components(om,row.firstVertex,row.firstVertex+row.vertices,row.firstIndex,row.firstIndex+row.indices);assert.equal(group.length,1,'each advertised octuple tube is a full connected physical barrel');}
  for(const side of [-1,1]){const rows=oct.muzzlePoints.filter(p=>p[2]*side>0);assert.equal(rows.length,4);assert.equal(new Set(rows.map(p=>p[1].toFixed(3))).size,1);assert.equal(new Set(rows.map(p=>p[2].toFixed(3))).size,4);}
});

test('heavy models use the standardized physical pivot in editor, preview and trial turret geometry', () => {
  for (const k of kinds) {
    const asset = C.REFERENCE_ASSETS[C.FITS[k].asset];
    assert.ok(asset, `${k} uses its registered physical model`);
    for (const a of [0, 1, 2, 3, 4, 5]) {
      const f = {id: 1, k, p: [30, -7, 19], a, ped: 2, base: 1, low: -.5, assetYaw: 37.125};
      const pivot = asset.c.map((value, axis) => ((asset.mount?.[axis]||0)-value)/asset.size[axis]);
      C.referenceFitPoint(f, pivot).forEach((value, axis) => near(value, C.fitOrigin(f)[axis], 1e-6));
    }
    const f = {id: 1, k, p: [30, -7, 19], a: 2, ped: 0, base: 0, low: 0, float: false, assetYaw: 37.125};
    const ship = C.newShip({L: 200, W: 100, H: 50, assembly: true}, 'Heavy turret');
    ship.parts = []; ship.fits = [f];
    const preview = G.meshPreview(ship, [], [f]);
    assert.equal(preview.previewRefFits.ni+preview.previewFits.ni, drawAsset(k).faces*3);
    const fleet = G.fleetGeometry(ship, {trial: true}), turret = fleet.turrets.find(t => t.id === f.id);
    assert.ok(turret);
    assert.equal(turret.barrels, C.FITS[k].barrels);
    assert.equal(fleet.meshes[turret.mesh].geo.ni+(turret.bodyMesh?fleet.meshes[turret.bodyMesh].geo.ni:0),drawAsset(k).faces*3);
    const joint=C.authoredTurretGeometry(f),expected=joint?.elevationPivot||C.fitOrigin(f);
    turret.pivot.forEach((value,axis)=>near(value,expected[axis],1e-6));
  }
});
