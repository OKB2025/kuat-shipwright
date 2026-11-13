const assert = require('node:assert/strict');
const path = require('node:path');
const {test} = require('node:test');
const {C} = require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname, '..'));

function fixture() {
  const ship = C.newShip({L: 300, W: 100, H: 100, assembly: true}, 'Scoped placement');
  ship.parts = [{id: 1, k: 'struct', form: 'box', c: [0, 0, 0], s: [20, 20, 10]},
    {id: 3, k: 'struct', form: 'box', c: [100, 0, 0], s: [20, 20, 10]}];
  ship.fits = []; ship.hatches = []; ship.links = []; ship.groups = []; ship.nextId = 5;
  return ship;
}
const descriptors = patches => patches.map(p => ({id: p.id, host: p.host, face: p.face,
  triangles: Array.from(p.triangles), center: Array.from(p.center), normal: Array.from(p.normal),
  polygon: p.polygon.map(p => Array.from(p)), range: Array.from(p.range)}));

test('selected-host physical faces preserve the full survey stable IDs and real cut triangles', () => {
  const ship = fixture(); ship.parts[0].form = 'wedge'; ship.parts[0].yaw = 17;
  ship.solidCuts = [{id: 9, type: 'box', c: [0, 4, 0], s: [3, 6, 3], structures: true}];
  const full = C.surfacePatches(ship, true).filter(p => p.host === 'p1');
  const scoped = C.surfacePatches(ship, true, false, new Set(['p1']));
  assert.ok(scoped.length); assert.deepEqual(descriptors(scoped), descriptors(full));
  const first = scoped.find(p => p.face === 'top') || scoped[0];
  ship.surfaces = {version: 4, patches: [], partitions: [{baseId: first.baseId,
    leaves: [{id: first.baseId + '/left', range: [0, 0, .5, 1]}, {id: first.baseId + '/right', range: [.5, 0, 1, 1]}]}]};
  const splitFull = C.surfacePatches(ship, true).filter(p => p.host === 'p1');
  assert.deepEqual(descriptors(C.surfacePatches(ship, true, false, new Set(['p1']))), descriptors(splitFull));
});

test('one selected-host face lookup does not construct an unrelated hull mesh', () => {
  const ship = fixture();
  const hull = C.newShip({L: 500, W: 100, H: 50});
  const unrelated = {id: 99, k: 'struct', form: 'hull', c: [1000, 0, 0], s: [500, 100, 50],
    hullProfile: {...hull.hull, assembly: false}, hullData: {hatches: [], cuts: [], trenches: [], solidCuts: [], subs: []}};
  ship.parts.push(unrelated);
  assert.ok(C.surfacePatches(ship, true, false, new Set(['p1'])).length);
  assert.equal(unrelated._hullShip, undefined);
  assert.equal(unrelated._hullGeometry, undefined);
  assert.equal(ship.parts.includes(unrelated), true, 'unrelated equipment stays available for interference');
});

test('targeted refresh rebuilds the requested dependency branch while preserving unrelated authored parts', () => {
  const ship = fixture();
  for (const [id, parentId, x] of [[2, 1, 0], [4, 3, 100]]) {
    const result = C.solvePlacement(ship, {id, k: 'struct', form: 'box', c: [x, 0, 0], s: [6, 6, 4]},
      {mode: 'horizontal', parentStructureId: parentId, hit: {p: [x, 5, 0], n: [0, 1, 0]}});
    assert.equal(result.ok, true, result.error); ship.parts.push(result.part);
  }
  const cold = JSON.parse(C.publicJSON(ship)), source = JSON.stringify(cold.parts.find(p => p.id === 4));
  const result = C.refreshPlacementGeometry(cold, {ids: [2], includeFits: false});
  assert.equal(result.ok, true); assert.deepEqual(Array.from(result.updated), [2]);
  // 2026-11-13 user decision: no fitting. The rebuilt branch was recognised by its fitted solid (_placementGeometry);
  // it is now recognised by the solve's private keys, which only the requested branch receives.
  assert.equal(typeof cold.parts.find(p => p.id === 2)._placementSelfKey, 'string');
  assert.equal(cold.parts.find(p => p.id === 4)._placementSelfKey, undefined);
  assert.equal(JSON.stringify(cold.parts.find(p => p.id === 4)), source);
  assert.equal(cold.parts.length, 4);
});
