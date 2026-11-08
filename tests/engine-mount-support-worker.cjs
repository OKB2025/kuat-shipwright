const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.resolve(__dirname, '..'), {C, R} = require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const source = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8'), gfx = fs.readFileSync(path.join(root, 'js/gfx.js'), 'utf8');
const savedV20 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/nozzle-support-v20-snapshot.json'), 'utf8'));
const plain = x => JSON.parse(JSON.stringify(x));
const near = (a, b, relative = 1e-7) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= Math.max(1, Math.abs(b)) * relative, `${a} != ${b}`);
function fixture() {
  const s = C.newShip({L: 200, W: 100, H: 100, assembly: true}, 'Sloped nozzle support');
  s.parts = [{id: 1, k: 'struct', form: 'box', c: [50, 0, 0], s: [100, 80, 80], pitch: 20}];
  s.fits = []; s.hatches = []; s.links = []; s.groups = []; s.nextId = 2; s.autoHabitation = false; s.detail = 0;
  return s;
}
const nozzle = () => ({id: -1, k: 'engine', c: [-12, 0, 0], d: 8, nozzleLength: 4, dir: [-1, 0, 0]});
function request(s) {
  const h = C.rayPart([-100, 0, 0], [1, 0, 0], s.parts[0]); assert.ok(h);
  return {part: nozzle(), mode: 'direct', parentStructureId: 1, geometryRevision: 1, parentGeometryRevision: 0,
    placementModelVersion: C.PLACEMENT_MODEL_VERSION, hit: {p: Array.from(h.p), n: Array.from(h.n)}};
}
function worker() {
  const context = vm.createContext({Core: C, console, setTimeout, clearTimeout, structuredClone});
  vm.runInContext(gfx, context); vm.runInContext(source, context);
  const messages = [], scope = {postMessage(m) { messages.push(structuredClone(m)); }};
  context.scope = scope; vm.runInContext('YardEngine.listenWorker(scope)', context);
  async function wait(type, key, value) {
    for (let i = 0; i < 400; i++) {
      const failure = messages.find(m => m.type === 'error'); if (failure) assert.fail(failure.message);
      const reply = messages.find(m => m.type === type && m[key] === value); if (reply) return reply;
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    assert.fail('Worker reply ' + type + '/' + value);
  }
  function send(message) { scope.onmessage({data: structuredClone(message)}); }
  return {send, wait, context};
}
function add(s, result) { const accepted = C.acceptPlacementResult(s, result); assert.equal(accepted.ok, true, accepted.error); return accepted.part; }

test('strict Worker nozzle foundations transfer as additive support data and restore without a second solve', async () => {
  const s = fixture(), job = request(s), before = C.publicJSON(s), w = worker();
  w.send({type: 'placement', id: 1, gen: 1, designId: 'nozzle', operationId: 'tap', state: before, request: job});
  const reply = await w.wait('placement', 'id', 1); assert.equal(reply.result.ok, true, reply.result.error);
  const candidate = reply.result.part, support = candidate.engineMountSupport;
  assert.equal(C.publicJSON(s), before); assert.equal(support.version, 1); assert.equal(support.parentId, 1);
  assert.ok(support.polys.length > 0); assert.ok(support.volume > 0); assert.equal(candidate._engineMountSupportGeometry, undefined);
  assert.equal(candidate.placement.requestedGeometry.engineMountSupport, undefined, 'generated foundation is not the editable nozzle definition');
  const geometry = C.engineMountSupportGeometry(null, candidate); assert.ok(geometry.triangles.length > 0);
  const placed = add(s, reply.result), actual = C.engineMountSupportGeometry(null, placed);
  assert.deepEqual(Array.from(actual.triangles), Array.from(geometry.triangles));
  assert.deepEqual(Array.from(placed.c), [-12, 0, 0]); assert.deepEqual(Array.from(placed.dir), [-1, 0, 0]);
  const saved = C.serialize(s), loaded = C.deserialize(saved, {deferPlacementGeometry: true}), restored = loaded.parts.find(p => p.id === placed.id);
  assert.equal(saved.v, 3); assert.deepEqual(plain(restored.engineMountSupport), plain(placed.engineMountSupport));
  assert.deepEqual(Array.from(C.engineMountSupportGeometry(null, restored).triangles), Array.from(actual.triangles));
  delete restored.engineMountSupport; delete restored._engineMountSupportGeometry;
  C.syncEngineMountSupports(loaded);
  assert.ok(restored.engineMountSupport, 'parent and original nozzle settings regenerate the support after its cache is removed');
  near(C.engineMountSupportGeometry(null, restored).volume, actual.volume);
});

test('Worker parent updates refresh support geometry and cache data while an unrelated branch preserves the same foundation', async () => {
  const s = fixture(), result = C.solvePlacement(s, nozzle(), request(s)), p = add(s, result);
  s.parts.push({id: 50, k: 'struct', form: 'box', c: [300, 0, 0], s: [20, 20, 20]}); s.nextId = 51;
  const w = worker();
  async function update(gen, reset = false) {
    w.send({type: 'update', gen, designId: 'nozzle-updates', state: C.publicJSON(s), reset, what: ['parts'], stats: false, view: {deferSurfaces: true}});
    return w.wait('geometry', 'gen', gen);
  }
  const original = await update(1, true), first = JSON.parse(original.state).parts.find(q => q.id === p.id), before = C.engineMountSupportGeometry(null, first);
  assert.ok(original.caches.items.parts[p.id]._engineMountSupportGeometry, 'completed Worker caches retain exact foundation geometry');
  s.parts.find(q => q.id === 50).c[0] += 5;
  const other = await update(2), same = JSON.parse(other.state).parts.find(q => q.id === p.id);
  assert.equal(same.engineMountSupport.sourceKey, first.engineMountSupport.sourceKey);
  assert.deepEqual(Array.from(C.engineMountSupportGeometry(null, same).triangles), Array.from(before.triangles));
  const staleResult = C.solvePlacement(s, p, {...request(s), geometryRevision: 2}); assert.equal(staleResult.ok, true, staleResult.error);
  s.parts[0].pitch = 28;
  const changed = await update(3), next = JSON.parse(changed.state).parts.find(q => q.id === p.id);
  assert.notEqual(next.engineMountSupport.sourceKey, first.engineMountSupport.sourceKey);
  assert.notDeepEqual(Array.from(C.engineMountSupportGeometry(null, next).triangles), Array.from(before.triangles));
  assert.ok(changed.geos.struct.n > 0, 'the common structural buffer contains the updated foundation');
  const accepted = C.acceptPlacementResult(s, staleResult, {replaceId: p.id});
  assert.equal(accepted.ok, false); assert.equal(accepted.code, 'parent-stale');
});

test('pure support geometry caches follow the engine rigid transform without surveying parent surfaces', () => {
  const s = fixture(), p = add(s, C.solvePlacement(s, nozzle(), request(s))), support = p.engineMountSupport;
  const original = Array.from(C.engineMountSupportGeometry(null, p).triangles);
  p.c[0] += 17;
  const moved = C.engineMountSupportGeometry(null, p);
  for (let i = 0; i < original.length; i++) near(moved.triangles[i], original[i] + (i % 3 === 0 ? 17 : 0));
  p.roll = 23;
  assert.notDeepEqual(Array.from(C.engineMountSupportGeometry(null, p).triangles), Array.from(moved.triangles));
  assert.equal(p.engineMountSupport, support, 'drawing restores the saved local input without rebuilding or rewriting it');
});

test('a persisted profile-20 blueprint rebuilds foundation mass and thermal data in the current profile without retuning its engine', () => {
  const persisted = plain(savedV20.snapshot), before = JSON.stringify(persisted), updated = C.cleanDesignCraft(persisted);
  assert.equal(savedV20.sourceFleetProfileVersion, 20); assert.ok(C.FLEET_PROFILE_VERSION >= 21);
  assert.equal(JSON.stringify(persisted), before); assert.ok(updated.blueprint);
  assert.equal(updated.requiresBlueprint, undefined); assert.equal(updated.legacyReadOnly, undefined);
  assert.equal(updated.craft.powerProfile.profileVersion, C.FLEET_PROFILE_VERSION);
  const s = C.deserialize(persisted.blueprint); C.syncCompartments(s); C.remount(s); C.syncCompartments(s);
  const S = C.computeStats(s), profile = C.fleetProfile(S, s.name, s);
  assert.ok(S.engineSupportMass > 0); near(S.mass - savedV20.expected.mass, S.engineSupportMass);
  near(updated.craft.powerProfile.propulsion.massKg, S.mass * 1000);
  near(updated.craft.mass, Math.round(S.mass * 100) / 100);
  near(profile.propulsion.massKg, updated.craft.powerProfile.propulsion.massKg);
  near(profile.propulsion.ratedThrustN, savedV20.expected.ratedThrustN);
  near(updated.craft.powerProfile.propulsion.ratedThrustN, savedV20.expected.ratedThrustN);
  assert.deepEqual(plain(updated.craft.powerProfile.heat), plain(C.craftPowerProfile(s, S).heat));
});

test('a persisted old snapshot without a blueprint stays explicitly read-only and cannot power a craft', () => {
  const persisted = plain(savedV20.snapshot); delete persisted.blueprint;
  const legacy = C.cleanDesignCraft(JSON.parse(JSON.stringify(persisted)));
  assert.equal(legacy.requiresBlueprint, true); assert.equal(legacy.legacyReadOnly, true); assert.equal(legacy.sourceProfileVersion, 20);
  assert.equal(legacy.craft.powerProfile, undefined); assert.equal(legacy.craft.mass, persisted.craft.mass);
  const roundTrip = C.cleanDesignCraft(JSON.parse(JSON.stringify(legacy)));
  assert.equal(roundTrip.requiresBlueprint, true); assert.equal(roundTrip.sourceProfileVersion, 20);
  const key = R.registerDesignCraft(roundTrip), registered = R.CRAFT[key]; assert.ok(key);
  registered.powerProfile = plain(persisted.craft.powerProfile);
  assert.equal(R.craftPowerOf(registered), null, 'a historical power snapshot cannot bypass the missing-blueprint state');
  assert.equal(registered.powerProfile, undefined);
});

test('the existing squadron status row labels historical values in both languages', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), start = app.indexOf('function voySquadFitHTML(');
  const stop = app.indexOf('\nfunction voyBattleWingListHTML(', start); assert.ok(start >= 0 && stop > start);
  const context = vm.createContext({R: {CRAFT: {legacy: {snapshot: {requiresBlueprint: true}}}}, esc: String, num: String});
  vm.runInContext(fs.readFileSync(path.join(root, 'js/lang-en.js'), 'utf8'), context);
  vm.runInContext("let english=false;const T=s=>english?(KS_EN.terms[s]||s):s;" + app.slice(start, stop), context);
  const japanese = vm.runInContext("voySquadFitHTML({craft:'legacy'},null)", context);
  assert.match(japanese, /図面がないため再計算できません/); assert.match(japanese, /role="status"/);
  const english = vm.runInContext("english=true;voySquadFitHTML({craft:'legacy'},null)", context);
  assert.match(english, /cannot be recalculated without the blueprint/);
  assert.equal(vm.runInContext("voySquadFitHTML({craft:'fresh'},null)", context), '');
});
