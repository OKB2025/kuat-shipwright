const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const {C} = require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const engine = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8');
const gfx = fs.readFileSync(path.join(root, 'js/gfx.js'), 'utf8');
const near = (a, b) => assert.ok(Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 1e-7, `${a} != ${b}`);

function fixture(size = [20, 10, 20]) {
  const ship = C.newShip({L: 100, W: 100, H: 100, assembly: true}, 'Worker integration');
  ship.parts = [{id: 1, k: 'struct', form: 'box', c: [0, 0, 0], s: size}];
  ship.fits = []; ship.hatches = []; ship.links = []; ship.groups = []; ship.nextId = 2;
  return ship;
}
function solve(ship, part, request) {
  const context = vm.createContext({Core: C, Gfx: {}, console, setTimeout, clearTimeout, structuredClone});
  vm.runInContext(engine, context);
  return new Promise((resolve, reject) => {
    const scope = {postMessage(message) {
      // A real worker copies its typed effective geometry and never shares
      // the Core solver's objects with the editor accepting the result.
      const copy = structuredClone(message);
      if (copy.type === 'error') reject(new Error(copy.message));
      else if (copy.type === 'placement') resolve(copy);
    }};
    context.scope = scope;
    vm.runInContext('YardEngine.listenWorker(scope)', context);
    scope.onmessage({data: {type: 'placement', id: 1, gen: 1, designId: 'ship-1', operationId: 'ghost-1',
      state: C.publicJSON(ship), request: {part, placementModelVersion: C.PLACEMENT_MODEL_VERSION, ...request}}});
  });
}

test('actual fitted exterior geometry crosses the Worker boundary and commits without a second solve', async () => {
  const ship = fixture(), before = C.publicJSON(ship), child = {id: 0, k: 'struct', form: 'box', c: [0, 0, 0], s: [6, 3, 6]};
  const reply = await solve(ship, child, {mode: 'horizontal', parentStructureId: 1, parentGeometryRevision: 0,
    geometryRevision: 1, hit: {p: [0, 10, 0], n: [0, 1, 0]}});
  assert.equal(reply.result.ok, true, reply.result.error);
  assert.equal(C.publicJSON(ship), before, 'verification has no authoring side effect');
  const geometry = reply.result.effectiveGeometry.placement;
  assert.equal(ArrayBuffer.isView(geometry.local), true);
  assert.ok(geometry.local.length > 0);
  assert.equal(reply.result.part._placementGeometry, undefined);
  const accepted = C.acceptPlacementResult(ship, reply.result);
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.part._placementGeometry, geometry, 'adoption reuses exact completed vertices');
  assert.equal(accepted.part.id, 2);
  near(C.partVolume(accepted.part), 108);
  assert.equal(C.placementContact(ship, accepted.part, ship.parts[0]).connected, true);
  const saved = C.serialize(ship);
  assert.equal(saved.v, 3);
  assert.equal(saved.parts[1]._placementGeometry, undefined, 'generated mesh remains derived');
  const restored = C.deserialize(saved), rebuilt = restored.parts.find(p => p.id === 2);
  assert.equal(rebuilt.placement.parentStructureId, 1);
  assert.equal(rebuilt.placement.mode, 'horizontal');
  near(C.partVolume(rebuilt), 108);
  assert.equal(C.placementContact(restored, rebuilt, restored.parts[0]).connected, true);
});

test('strict Worker interference follows legacy exterior shields after their catalogue moves to interior', async () => {
  let ship = fixture([30, 20, 10]);
  const shield = {id: 2, k: 'shield', c: [0, 5.5, 4], d: 1};
  shield.placement = {modelVersion: C.PLACEMENT_MODEL_VERSION, mode: 'direct', parentStructureId: 1,
    geometryRevision: 1, parentGeometryRevision: 0, parentLocalAnchor: [0, 5.5, 4], surfaceAnchor: [0, 5, 4],
    contactNormal: [0, 1, 0], contactLocalNormal: [0, 1, 0],
    rigidPose: {offset: [0, .5, 0], forward: [1, 0, 0], up: [0, 1, 0]}, requestedGeometry: {...shield}};
  ship.parts.push(shield); ship.nextId = 3; ship = C.deserialize(C.serialize(ship));
  ship.parts[0].c[0] = 5;
  assert.equal(C.placementCapability(ship.parts[1]).space, 'interior');
  assert.equal(ship.parts[1].c[0], 0, 'authoring snapshot is still waiting for child follow');
  const source = C.publicJSON(ship), reply = await solve(ship,
    {id: -1, k: 'struct', form: 'box', c: [5, 0, 4], s: [2, 2, 2]},
    {mode: 'horizontal', parentStructureId: 1, parentGeometryRevision: 0, hit: {p: [5, 5, 4], n: [0, 1, 0]}});
  assert.equal(reply.result.ok, false); assert.equal(reply.result.code, 'placement-interference');
  assert.equal(C.publicJSON(ship), source, 'failed strict placement does not commit the temporary follow');
});

test('an actual weapon fitting validates in the Worker and adopts the exact tapped host and pose', async () => {
  const ship = fixture([200, 160, 20]); ship.parts[0].c = [100, 10, 0];
  const before = C.publicJSON(ship), fit = {id: -1, k: 'pd', p: [0, 0, 0], n: [0, 1, 0], a: 2, ped: .3, assetYaw: 17, mountMode: 'auto'};
  const reply = await solve(ship, undefined, {fit, fitId: -1, entityKind: 'fit', list: 'fits', mode: 'direct', hostId: 1,
    hit: {p: [83, 20, 23], n: [0, 1, 0]}, geometryRevision: 1, parentGeometryRevision: 0});
  assert.equal(reply.result.ok, true, reply.result.error);
  assert.equal(reply.list, 'fits'); assert.equal(reply.entityKind, 'fit'); assert.equal(reply.result.part, undefined);
  assert.equal(C.publicJSON(ship), before);
  const accepted = C.acceptPlacementResult(ship, reply.result);
  assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.fit.host, 1); assert.deepEqual(Array.from(accepted.fit.p), [83, 20, 23]);
  assert.equal(accepted.fit.assetYaw, 17); assert.equal(accepted.fit.ped, .3);
  assert.equal(accepted.fit.placement.parentStructureId, undefined);
  const stored = C.serialize(ship), restored = C.deserialize(stored), f = restored.fits.find(f => f.id === accepted.fit.id);
  assert.equal(f.host, 1); assert.deepEqual(Array.from(f.p), [83, 20, 23]);
  assert.deepEqual(Array.from(f.local), Array.from(accepted.fit.local));
});

test('an early native pick acquires the exact stable face in the Worker without rebinding a lost explicit face', async () => {
  const ship = fixture([200, 160, 20]), parent = ship.parts[0];
  Object.assign(parent, {yaw: 21, pitch: 8, roll: -12});
  const top = C.surfacePatches(ship, true).find(p => p.host === 'p1' && p.face === 'top');
  assert.ok(top);
  const fit = {id: -1, k: 'pd', p: [0, 0, 0], n: Array.from(top.normal), tilt: Array.from(top.normal), a: 2, ped: 0};
  const request = {fit, fitId: -1, entityKind: 'fit', list: 'fits', mode: 'direct', hostId: 1,
    hit: {p: Array.from(top.center), n: Array.from(top.normal)}, geometryRevision: 1, parentGeometryRevision: 0};
  const source = C.publicJSON(ship), early = await solve(ship, undefined, request);
  assert.equal(early.result.ok, true, early.result.error);
  assert.equal(early.result.fit.placement.hostSurfaceId, top.id);
  assert.deepEqual(Array.from(early.result.fit.p), Array.from(top.center), 'face binding cannot shift the tapped position');
  const lost = await solve(ship, undefined, {...request, hostSurfaceId: 'p1:top:lost'});
  assert.equal(lost.result.ok, false); assert.equal(lost.result.code, 'surface-missing');
  const gap = await solve(ship, undefined, {...request, hit: {p: C.add(top.center, C.mul(top.normal, 1)), n: Array.from(top.normal)}});
  assert.equal(gap.result.ok, false); assert.equal(gap.result.code, 'surface-missing');
  assert.equal(C.publicJSON(ship), source, 'early face resolution never mutates the live design');
});

test('a new structure and its weapon fitting solve in dependency order and adopt without duplicate IDs', async () => {
  const ship = fixture([200, 160, 20]); ship.parts[0].c = [100, 10, 0];
  const rows = [
    {part: {id: 10, k: 'struct', form: 'box', c: [100, 20, 0], s: [100, 80, 10]}, request: {mode: 'horizontal', partId: 10,
      parentStructureId: 1, hit: {p: [100, 20, 0], n: [0, 1, 0]}, geometryRevision: 1, parentGeometryRevision: 0}},
    {fit: {id: -1, k: 'pd', p: [0, 0, 0], n: [0, 1, 0], a: 2, ped: .3, assetYaw: 17}, request: {list: 'fits', fitId: -1,
      mode: 'direct', hostId: 10, hit: {p: [83, 30, 23], n: [0, 1, 0]}, geometryRevision: 1, parentGeometryRevision: 1}}
  ];
  const before = C.publicJSON(ship), reply = await solve(ship, undefined, {parts: rows});
  assert.equal(reply.result.ok, true, reply.result.error);
  assert.equal(C.publicJSON(ship), before);
  const [structure, weapon] = reply.result.results;
  assert.equal(ArrayBuffer.isView(structure.effectiveGeometry.placement.local), true);
  assert.equal(structure.part.id, 2); assert.equal(weapon.fit.id, 3); assert.equal(weapon.fit.host, 2);
  for (const result of reply.result.results) { const accepted = C.acceptPlacementResult(ship, result); assert.equal(accepted.ok, true, accepted.error); }
  assert.deepEqual(ship.parts.map(p => p.id), [1, 2]); assert.equal(ship.fits[0].id, 3); assert.equal(ship.nextId, 4);
});

test('a late weapon Worker result cannot restore a deleted host or overwrite a newer source generation', async () => {
  const ship = fixture([200, 160, 20]); ship.parts[0].c = [100, 10, 0];
  const reply = await solve(ship, undefined, {fit: {id: -1, k: 'pd', p: [0, 0, 0], n: [0, 1, 0], a: 2, ped: .3}, list: 'fits',
    mode: 'direct', hostId: 1, hit: {p: [83, 20, 23], n: [0, 1, 0]}});
  assert.equal(reply.result.ok, true, reply.result.error);
  ship.parts = [];
  const before = C.publicJSON(ship), accepted = C.acceptPlacementResult(ship, reply.result);
  assert.equal(accepted.ok, false); assert.equal(C.publicJSON(ship), before); assert.equal(ship.fits.length, 0);
});

test('parts-only Worker updates follow and delete attached weapons in the returned authoring state and real Gfx buffers', async () => {
  const ship = fixture([200, 160, 20]); ship.parts[0].c = [100, 10, 0]; ship.autoHabitation = false; ship.detail = 0;
  const solved = C.solveFitPlacement(ship, {id: -1, k: 'pd', p: [0, 0, 0], n: [0, 1, 0], a: 2, ped: .3, assetYaw: 17},
    {mode: 'direct', hostId: 1, hit: {p: [83, 20, 23], n: [0, 1, 0]}});
  assert.equal(solved.ok, true, solved.error); assert.equal(C.acceptPlacementResult(ship, solved).ok, true);
  const context = vm.createContext({Core: C, console, setTimeout, clearTimeout, structuredClone});
  vm.runInContext(gfx, context); vm.runInContext(engine, context);
  const messages = [], scope = {postMessage(message) { messages.push(structuredClone(message)); }};
  context.scope = scope; vm.runInContext('YardEngine.listenWorker(scope)', context);
  async function update(gen, reset, what) {
    scope.onmessage({data: {type: 'update', gen, designId: 'fit-follow', state: C.publicJSON(ship), reset, what, stats: false, view: {deferSurfaces: true}}});
    for (let i = 0; i < 300; i++) {
      const error = messages.find(m => m.type === 'error'); if (error) assert.fail(error.message);
      const result = messages.find(m => m.type === 'geometry' && m.gen === gen); if (result) return result;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    assert.fail('Missing derived geometry generation ' + gen);
  }
  const original = await update(1, true, ['all']), before = JSON.parse(original.state).fits[0];
  ship.parts[0].c[0] += 11; ship.parts[0].yaw = 30;
  const changed = await update(2, false, ['parts']), after = JSON.parse(changed.state).fits[0], parent = ship.parts[0];
  const expected = C.worldStruct(parent, [before.local[0] * parent.s[0], before.local[1] * parent.s[2], before.local[2] * parent.s[1]]);
  after.p.forEach((v, i) => near(v, expected[i]));
  assert.equal(after.host, 1); assert.equal(after.id, before.id);
  const buffer = ['fits', 'refFits'].find(key => changed.geos[key]?.n > 0);
  assert.ok(buffer, 'parts dirty flags include fittings and their reference meshes');
  assert.equal(ArrayBuffer.isView(changed.geos[buffer].pos), true);
  assert.notDeepEqual(Array.from(changed.geos[buffer].pos), Array.from(original.geos[buffer].pos), 'the Gfx fitting buffer follows its parent pose');
  const removed = C.removeParts(ship, [1]);
  assert.deepEqual(Array.from(removed.removedFits), [2]);
  const deleted = await update(3, false, ['parts']), remaining = JSON.parse(deleted.state);
  assert.equal(remaining.parts.length, 0); assert.equal(remaining.fits.length, 0);
  assert.equal(deleted.geos.fits.n, 0); assert.equal(deleted.geos.refFits.n, 0);
});

test('ordinary exterior equipment uses the same Worker result and follows its parent after adoption', async () => {
  const ship = fixture(), source = {id: -1, k: 'sensor', c: [2, 11.84, 3], d: 4};
  const reply = await solve(ship, source, {mode: 'direct', parentStructureId: 1, geometryRevision: 1,
    parentGeometryRevision: 0, hit: {p: [2, 10, 3], n: [0, 1, 0]}});
  assert.equal(reply.result.ok, true, reply.result.error); assert.equal(reply.result.part.placement.mode, 'direct');
  const accepted = C.acceptPlacementResult(ship, reply.result); assert.equal(accepted.ok, true, accepted.error);
  assert.equal(accepted.part.placement.parentStructureId, 1); const before = Array.from(accepted.part.c);
  ship.parts[0].c[0] += 13; const refreshed = C.refreshPlacementGeometry(ship);
  assert.equal(refreshed.ok, true, JSON.stringify(refreshed)); near(accepted.part.c[0], before[0] + 13);
  near(accepted.part.c[1], before[1]); near(accepted.part.c[2], before[2]); assert.equal(accepted.part.d, 4);
});

test('actual clipped interior geometry transfers its effective volume and round-trips the original request', async () => {
  const ship = fixture([8, 10, 10]), child = {id: 0, k: 'cargo', c: [0, 0, 0], d: 10};
  const reply = await solve(ship, child, {mode: 'clip', hostId: 1, geometryRevision: 1});
  assert.equal(reply.result.ok, true, reply.result.error);
  near(reply.result.requestedVolume, 1000);
  near(reply.result.effectiveVolume, 800);
  assert.equal(ArrayBuffer.isView(reply.result.effectiveGeometry.clip.tris), true);
  const accepted = C.acceptPlacementResult(ship, reply.result);
  assert.equal(accepted.ok, true, accepted.error);
  near(C.partVolume(accepted.part), 800);
  assert.equal(C.inPart(accepted.part, [4.5, 0, 0]), false);
  const restored = C.deserialize(C.serialize(ship));
  C.syncCompartments(restored);
  const room = restored.parts.find(p => p.id === accepted.part.id);
  assert.equal(room.d, 10);
  assert.equal(room.placement.requestedGeometry.d, 10);
  near(C.partVolume(room), 800);
});

test('the real Core rejects a solved result after the source parent was moved or deleted', async () => {
  for (const remove of [false, true]) {
    const ship = fixture(), child = {id: 0, k: 'struct', form: 'box', c: [0, 0, 0], s: [6, 3, 6]};
    const reply = await solve(ship, child, {mode: 'horizontal', parentStructureId: 1, hit: {p: [0, 10, 0], n: [0, 1, 0]}});
    assert.equal(reply.result.ok, true, reply.result.error);
    if (remove) ship.parts = []; else ship.parts[0].c[0] += 2;
    const before = C.publicJSON(ship), accepted = C.acceptPlacementResult(ship, reply.result);
    assert.equal(accepted.ok, false);
    assert.equal(accepted.code, 'parent-stale');
    assert.equal(C.publicJSON(ship), before);
  }
});

test('real mirrored candidates sharing one palette ghost ID get distinct transactional IDs and accept together', async () => {
  const ship = fixture(), request = {mode: 'horizontal', parentStructureId: 1, parentGeometryRevision: 0,
    geometryRevision: 1, placementModelVersion: C.PLACEMENT_MODEL_VERSION, partId: -1};
  const rows = [-3, 3].map(z => ({part: {id: -1, k: 'struct', form: 'box', c: [0, 0, z], s: [4, 4, 4]},
    request: {...request, hit: {p: [0, 10, z], n: [0, 1, 0]}}}));
  const reply = await solve(ship, undefined, {parts: rows});
  assert.equal(reply.result.ok, true, reply.result.error);
  assert.deepEqual(reply.result.results.map(result => result.part.id), [2, 3]);
  assert.deepEqual(reply.result.results.map(result => result.existingId), [null, null]);
  for (const result of reply.result.results) {
    const accepted = C.acceptPlacementResult(ship, result);
    assert.equal(accepted.ok, true, accepted.error);
    near(C.partVolume(accepted.part), 64);
  }
  assert.deepEqual(ship.parts.map(part => part.id), [1, 2, 3]);
  assert.equal(ship.nextId, 4);
});

test('a batch cannot hide an interior collision by reusing the first candidate ghost ID', async () => {
  const ship = fixture([20, 20, 20]), before = C.publicJSON(ship), part = {id: -1, k: 'battery', c: [0, 0, 0], d: 4},
    request = {mode: 'direct', hostId: 1, partId: -1, placementModelVersion: C.PLACEMENT_MODEL_VERSION};
  const reply = await solve(ship, undefined, {parts: [{part, request}, {part: {...part}, request}]});
  assert.equal(reply.result.ok, false);
  assert.equal(reply.result.code, 'fixed-outside');
  assert.equal(reply.result.parts, undefined);
  assert.equal(C.publicJSON(ship), before, 'a failed pair leaves neither candidate committed');
});

test('saving while parent updates are pending keeps the child pose on cold restore in every exterior mode (children do not follow)', () => {
  for (const mode of ['horizontal', 'vertical', 'surface']) {
    const ship = fixture(), child = {id: -1, k: 'struct', form: 'box', c: [0, 0, 0], s: [4, 4, 4]},
      hit = mode === 'vertical' ? {p: [0, 0, 5], n: [0, 0, 1]} : {p: [0, 10, 0], n: [0, 1, 0]};
    const placed = C.commitPlacement(ship, child, {mode, parentStructureId: 1, hit});
    assert.equal(placed.ok, true, placed.error);
    const original = placed.part.c.slice();
    ship.parts[0].c[0] += 30;
    // This is the source state between the immediate edit and a Worker
    // adoption: the parent is new, while the old child remains visible.
    const saved = C.serialize(ship), deferred = C.deserialize(saved, {deferPlacementGeometry: true});
    const pending = deferred.parts.find(part => part.id === placed.part.id);
    assert.equal(pending._placementGeometry, undefined, 'UI parsing defers exact fitting to its Worker');
    near(pending.c[0], original[0]);
    // 2026-11-12 user decision: children do not follow their parent. The cold restore keeps the child where it
    // was saved; the parent moved 30 m away, so it is reported (no longer touching), never moved.
    const replay = C.refreshPlacementGeometry(deferred);
    assert.ok(replay.failed.some(row => row.partId === pending.id), JSON.stringify(replay.failed));
    near(pending.c[0], original[0]);
    near(pending.c[1], original[1]);
    near(pending.c[2], original[2]);
    const restored = C.deserialize(saved), rebuilt = restored.parts.find(part => part.id === placed.part.id);
    near(rebuilt.c[0], original[0]);
  }
});
