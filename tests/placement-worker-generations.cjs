const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function setup() {
  const messages = [], calls = [];
  let scope;
  const C = {
    DESIGN_LIMITS: {parts: 100}, PLACEMENT_MODEL_VERSION: 1,
    solvePlacement(ship, part, request) {
      calls.push(JSON.parse(JSON.stringify({ship, part, request}, (key, value) => key[0] === '_' ? undefined : value)));
      if (request.fail) return {ok: false, code: 'interference'};
      return {ok: true, part: {...part, checked: true, _solidCutShip: ship,
        _placementGeometry: {local: Float64Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0), volume: 1, area: 2, bvh: {doNotSend: true}},
        placement: {geometryRevision: request.geometryRevision || 0}}};
    },
    solveFitPlacement(ship, fit, request) {
      calls.push(JSON.parse(JSON.stringify({ship, fit, request}, (key, value) => key[0] === '_' ? undefined : value)));
      if (request.fail) return {ok: false, code: 'fit-interference'};
      return {ok: true, entityKind: 'fit', list: 'fits', fit: {...fit, host: request.hostId,
        checked: true, _solidCutShip: ship, local: [.1, .5, .2], localNormal: [0, 1, 0],
        placement: {modelVersion: 1, mode: 'direct', geometryRevision: request.geometryRevision || 0}}};
    },
    configureTrenchArmament(ship, request) {
      calls.push({trench: true, count: request.count});
      ship.trenches = [{id: 8, from: .1, to: .8}]; ship.parts.push({id: 9, k: 'capacitor'});
      if (request.fail) return {ok: false, code: 'trench-space'};
      ship._trenchConfigured = true;
      return {ok: true, count: request.count, groups: 2};
    },
    // A preview may not enter the authoritative design/statistics pipeline.
    publicJSON(ship) { if (ship._trenchConfigured) return JSON.stringify(ship, (key, value) => key[0] === '_' ? undefined : value); throw new Error('Preview changed worker design'); },
    patchShip() { throw new Error('Preview patched worker design'); }
  };
  const context = vm.createContext({Core: C, Gfx: {}, console, setTimeout, clearTimeout, structuredClone});
  vm.runInContext(source, context);
  scope = {postMessage: message => messages.push(plain(message))};
  context.scope = scope;
  vm.runInContext('YardEngine.listenWorker(scope)', context);
  const send = message => scope.onmessage({data: structuredClone(message)});
  const job = (overrides = {}) => ({
    type: 'placement', id: 1, gen: 10, designId: 'design-A', operationId: 'ghost-1',
    state: JSON.stringify({parts: [{id: 1, placement: {geometryRevision: 3}}], fits: [], hatches: []}),
    request: {part: {id: 2, p: [0, 1, 0]}, geometryRevision: 4, parentStructureId: 1, parentGeometryRevision: 3, placementModelVersion: 1},
    ...overrides
  });
  async function reply(id) {
    for (let i = 0; i < 80; i++) {
      const found = messages.find(message => message.id === id);
      if (found) return found;
      await tick();
    }
    assert.fail(`Missing worker reply ${id}`);
  }
  return {send, job, reply, messages, calls, context};
}

test('placement jobs return exact solver output and source/parent generations without changing the worker design', async () => {
  const t = setup(), job = t.job();
  t.send(job);
  const reply = await t.reply(1);
  assert.equal(reply.result.ok, true);
  assert.equal(reply.result.part.checked, true);
  assert.equal(reply.designId, 'design-A');
  assert.equal(reply.operationId, 'ghost-1');
  assert.equal(reply.gen, 10);
  assert.equal(reply.geometryRevision, 4);
  assert.equal(reply.parentGeometryRevision, 3);
  assert.equal(reply.placementModelVersion, 1);
  assert.equal(reply.result.part._solidCutShip, undefined, 'worker-owned caches are not part of the commit candidate');
  assert.equal(reply.result.effectiveGeometry.placement.volume, 1);
  assert.equal(reply.result.effectiveGeometry.placement.bvh, undefined, 'only effective shape data crosses the placement boundary');
  assert.deepEqual(t.calls[0].part, job.request.part);
  assert.equal(JSON.parse(job.state).parts.length, 1, 'authoring source stays untouched');
});

test('repeated stamps reuse derived host caches but never carry uncommitted public repairs into a later snapshot', async () => {
  const t = setup(), seen = [];
  t.context.Core.refreshPlacementGeometry = (ship, options) => {
    const parent = ship.parts[0]; seen.push({cached: !!parent._exactMesh, repaired: parent.repaired, ids: [...options.ids], fits: options.includeFits});
    parent._exactMesh = {triangles: 'private'};
  };
  t.send(t.job()); await t.reply(1);
  t.send(t.job({id: 2, operationId: 'stamp-2'})); await t.reply(2);
  assert.deepEqual(seen.map(s => s.cached), [false, true]);
  assert.deepEqual(seen[0].ids, [1]); assert.equal(seen[0].fits, false);
  t.context.Core.refreshPlacementGeometry = ship => { seen.push({repaired: ship.parts[0].repaired}); ship.parts[0].repaired = true; };
  t.send(t.job({id: 3, operationId: 'stamp-3'})); await t.reply(3);
  t.send(t.job({id: 4, operationId: 'stamp-4'})); await t.reply(4);
  assert.equal(seen[2].repaired, undefined); assert.equal(seen[3].repaired, undefined);
  assert.equal(JSON.parse(t.job().state).parts[0].repaired, undefined);
});

test('a changed global cut context invalidates the isolated source mesh cache', async () => {
  const t = setup(), seen = [];
  t.context.Core.refreshPlacementGeometry = ship => { seen.push(!!ship.parts[0]._exactMesh); ship.parts[0]._exactMesh = {}; };
  t.send(t.job()); await t.reply(1);
  const state = JSON.parse(t.job().state); state.solidCuts = [{id: 11, c: [0, 0, 0], s: [1, 1, 1]}];
  t.send(t.job({id: 2, operationId: 'stamp-2', state: JSON.stringify(state)})); await t.reply(2);
  assert.deepEqual(seen, [false, false]);
});

test('fittings cross the same generation boundary with their entity tag and canonical host', async () => {
  const t = setup(), fit = {id: -1, k: 'pd', p: [4, 5, 6]}, request = {fit, fitId: -1, entityKind: 'fit', list: 'fits',
    mode: 'direct', hostId: 1, geometryRevision: 2, parentGeometryRevision: 3, placementModelVersion: 1};
  t.send(t.job({request})); const reply = await t.reply(1);
  assert.equal(reply.result.ok, true);
  assert.equal(reply.entityKind, 'fit'); assert.equal(reply.list, 'fits'); assert.equal(reply.fitId, -1);
  assert.equal(reply.result.part, undefined); assert.equal(reply.result.fit.host, 1);
  assert.equal(reply.result.fit._solidCutShip, undefined);
  assert.deepEqual(reply.result.fit.localNormal, [0, 1, 0]);
  assert.equal(t.calls[0].request.list, 'fits');
});

test('trench configuration returns one detached complete authoring edit and exposes no partial failed state', async () => {
  const t = setup(), job = t.job({type: 'trenchArmament', request: {count: 10000}}), before = job.state;
  t.send(job); const reply = await t.reply(1);
  assert.equal(reply.type, 'trenchArmament'); assert.equal(reply.result.ok, true);
  assert.equal(reply.result.count, 10000); assert.equal(JSON.parse(reply.state).parts.length, 2);
  assert.equal(JSON.parse(reply.state).trenches.length, 1); assert.equal(job.state, before);
  t.send(t.job({type: 'trenchArmament', id: 2, gen: 11, request: {count: 10000, fail: true}}));
  const failed = await t.reply(2); assert.equal(failed.result.ok, false); assert.equal(failed.state, undefined);
  assert.equal(job.state, before);
});

test('trench configuration shares cancellation and latest-source guards with strict placement jobs', async () => {
  const t = setup(); t.send(t.job({type: 'trenchArmament', request: {count: 100}}));
  t.send({type: 'cancelPlacement', designId: 'design-A', operationId: 'ghost-1'});
  const cancelled = await t.reply(1); assert.equal(cancelled.type, 'trenchArmament'); assert.equal(cancelled.cancelled, true); assert.equal(cancelled.state, undefined);
  t.send(t.job({type: 'trenchArmament', id: 2, gen: 11, request: {count: 200}}));
  t.send(t.job({type: 'trenchArmament', id: 3, gen: 12, request: {count: 300}}));
  assert.equal((await t.reply(2)).stale, true);
  const latest = await t.reply(3); assert.equal(latest.result.count, 300); assert.ok(latest.state);
});

test('a mixed structure/fitting batch reserves shared stable IDs and remaps the fitting parent', async () => {
  const t = setup(), source = {nextId: 4, parts: [{id: 1}], fits: [{id: 3, k: 'pd'}]}, rows = [
    {part: {id: 10, k: 'struct'}, request: {partId: 10, geometryRevision: 1}},
    {fit: {id: -1, k: 'pd'}, request: {fitId: -1, list: 'fits', hostId: 10, geometryRevision: 1, parentGeometryRevision: 1}}
  ];
  t.send(t.job({state: JSON.stringify(source), request: {parts: rows}}));
  const reply = await t.reply(1);
  assert.equal(reply.result.ok, true);
  assert.equal(reply.result.parts.length, 1); assert.equal(reply.result.fits.length, 1);
  assert.equal(reply.result.results[0].part.id, 4); assert.equal(reply.result.results[1].fit.id, 5);
  assert.equal(reply.result.results[1].fit.host, 4);
  assert.equal(t.calls[1].ship.parts.find(p => p.id === 4).checked, true);
  assert.equal(t.calls[1].ship.fits.length, 1, 'new fit enters only the temporary candidate after validation');
  assert.deepEqual(source.fits, [{id: 3, k: 'pd'}]);
});

test('an active solve cannot revive a cancelled placement and queued callers settle', async () => {
  const t = setup();
  t.send(t.job());
  t.send(t.job({id: 2}));
  t.send({type: 'cancelPlacement', designId: 'design-A', operationId: 'ghost-1'});
  for (const id of [1, 2]) {
    const reply = await t.reply(id);
    assert.equal(reply.result, null);
    assert.equal(reply.stale, true);
    assert.equal(reply.cancelled, true);
  }
  assert.equal(t.calls.length, 1, 'cancelled queued geometry never starts');
});

test('only the newest request of an operation is returned as a valid result', async () => {
  const t = setup();
  t.send(t.job());
  t.send(t.job({id: 2, request: {...t.job().request, geometryRevision: 5}}));
  t.send(t.job({id: 3, request: {...t.job().request, geometryRevision: 6}}));
  assert.equal((await t.reply(1)).stale, true);
  assert.equal((await t.reply(2)).stale, true);
  const newest = await t.reply(3);
  assert.equal(newest.result.ok, true);
  assert.equal(newest.result.part.placement.geometryRevision, 6);
  assert.equal(t.calls.length, 2, 'intermediate requests are coalesced');
});

test('newer source generation invalidates every operation of that design, while another design remains independent', async () => {
  const t = setup();
  t.send(t.job());
  t.send(t.job({id: 2, gen: 11, operationId: 'new-ghost'}));
  t.send(t.job({id: 3, gen: 2, designId: 'design-B', operationId: 'other-design'}));
  t.send(t.job({id: 4, gen: 9, operationId: 'late-old-ghost'}));
  assert.equal((await t.reply(1)).stale, true);
  assert.equal((await t.reply(2)).result.ok, true);
  assert.equal((await t.reply(3)).result.ok, true);
  assert.equal((await t.reply(4)).stale, true);
});

test('missing, changed and incompatible parents/models fail before an exact solve', async () => {
  for (const [change, code] of [
    [{parentStructureId: 99}, 'parent-missing'],
    [{parentGeometryRevision: 2}, 'parent-updated'],
    [{placementModelVersion: 99}, 'placement-model-mismatch'],
    [{partId: 10}, 'part-identity-mismatch']
  ]) {
    const t = setup();
    t.send(t.job({request: {...t.job().request, ...change}}));
    assert.equal((await t.reply(1)).result.code, code);
    assert.equal(t.calls.length, 0);
  }
});

test('batch candidates use dependency order and a failure exposes no successful partial batch', async () => {
  const t = setup(), parent = {part: {id: 2}, request: {geometryRevision: 8}},
    child = {part: {id: 3}, request: {geometryRevision: 1, parentStructureId: 2, parentGeometryRevision: 8}};
  t.send(t.job({request: {parts: [parent, child]}}));
  const reply = await t.reply(1);
  assert.deepEqual(reply.result.parts.map(part => part.id), [2, 3]);
  assert.equal(t.calls[1].ship.parts.find(part => part.id === 2).checked, true);
  const failed = setup();
  failed.send(failed.job({request: {parts: [parent, {...child, request: {...child.request, fail: true}}]}}));
  const failure = await failed.reply(1);
  assert.equal(failure.result.ok, false);
  assert.equal(failure.result.code, 'interference');
  assert.equal(failure.result.parts, undefined);
});

test('the inline fallback uses copied placement messages and the same latest-only contract', async () => {
  const t = setup();
  vm.runInContext('globalThis.inlineReplies=[];globalThis.inlineSend=YardEngine.connectInline(message=>inlineReplies.push(message))', t.context);
  t.context.input = t.job();
  vm.runInContext('inlineSend(input);input.request.part.p[0]=999', t.context);
  for (let i = 0; i < 80 && !vm.runInContext('inlineReplies.length', t.context); i++) await tick();
  const replies = plain(vm.runInContext('inlineReplies', t.context));
  assert.equal(replies[0].result.part.p[0], 0, 'caller mutation cannot change a queued preview');
  assert.equal(replies[0].result.ok, true);
  const local = vm.runInContext('inlineReplies[0].result.effectiveGeometry.placement.local', t.context);
  assert.equal(ArrayBuffer.isView(local), true, 'effective mesh vertices retain their typed-array representation');
  assert.equal(local.length, 9);
});
