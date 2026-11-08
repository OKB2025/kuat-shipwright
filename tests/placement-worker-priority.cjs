const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../js/engine.js'), 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function actor() {
  const sent = [], C = {DESIGN_LIMITS: {parts: 100}, PLACEMENT_MODEL_VERSION: 1,
    solvePlacement(ship, part) { return {ok: true, part: {...part, checked: true}}; }};
  const context = vm.createContext({Core: C, Gfx: {}, console, setTimeout, clearTimeout, structuredClone});
  vm.runInContext(source, context);
  const worker = {sent, terminate() { this.terminated = true; }, postMessage(message) {
    sent.push(structuredClone(message)); setTimeout(() => scope.onmessage({data: structuredClone(message)}), 0);
  }};
  const scope = {postMessage(message) { setTimeout(() => worker.onmessage?.({data: structuredClone(message)}), 0); }};
  context.scope = scope; vm.runInContext('YardEngine.listenWorker(scope)', context);
  return worker;
}
async function setup({delayed = false, unavailable = false} = {}) {
  // The busy statistics actor intentionally does not service its messages.
  // Placement must finish through a separate real YardEngine receive/pump.
  const main = {sent: [], postMessage(m) { this.sent.push(m); }, terminate() {}}, placement = actor();
  let bootResolve, boots = 0;
  const boot = delayed ? new Promise(resolve => { bootResolve = resolve; }) : Promise.resolve(placement);
  const context = vm.createContext({Core: {}, Gfx: {}, console, setTimeout, clearTimeout, structuredClone,
    Worker: function() {}, Blob, KSBoot: {createBackgroundWorker() { boots++; return unavailable ? Promise.reject(new Error('unavailable')) : boot; }}});
  vm.runInContext(source, context); context.main = main;
  await vm.runInContext('YardEngineClient.start(null,{workerReady:Promise.resolve(main)})', context);
  const client = vm.runInContext('YardEngineClient', context);
  return {client, main, placement, resolve: () => bootResolve(placement), boots: () => boots};
}
const job = (operationId = 'stamp-1', gen = 1) => ({designId: 'ship-A', operationId, gen,
  state: JSON.stringify({parts: [{id: 1}], fits: []}), request: {part: {id: -1, k: 'struct'}, parentStructureId: 1}});

test('strict placement finishes independently while the statistics actor remains blocked', async () => {
  const t = await setup();
  t.client.post({type: 'update', designId: 'ship-A', gen: 1, stats: true});
  const reply = await t.client.request('placement', job());
  assert.equal(reply.result.ok, true); assert.equal(reply.result.part.checked, true);
  assert.equal(t.boots(), 1);
  assert.equal(t.main.sent.filter(m => m.type === 'placement').length, 0);
  assert.equal(t.placement.sent.filter(m => m.type === 'placement').length, 1);
  assert.equal(t.main.sent[0].type, 'update');
  await t.client.request('placement', job('stamp-2'));
  assert.equal(t.boots(), 1, 'subsequent stamps reuse the warm actor');
});

test('a newer design generation received during startup invalidates an older tap', async () => {
  const t = await setup({delayed: true}), pending = t.client.request('placement', job());
  await tick(); t.client.post({type: 'update', designId: 'ship-A', gen: 2}); t.resolve();
  const reply = await pending;
  assert.equal(reply.stale, true); assert.equal(reply.result, null);
  assert.equal(t.placement.sent[0].type, 'placementGeneration');
  assert.equal(t.placement.sent[0].gen, 2);
});

test('cancelling during actor startup settles the old tap and permits a new operation', async () => {
  const t = await setup({delayed: true}), pending = t.client.request('placement', job());
  await tick(); t.client.post({type: 'cancelPlacement', designId: 'ship-A', operationId: 'stamp-1'}); t.resolve();
  const reply = await pending;
  assert.equal(reply.cancelled, true); assert.equal(reply.stale, true);
  assert.equal(t.placement.sent.some(m => m.type === 'placement'), false);
  const next = await t.client.request('placement', job('stamp-2'));
  assert.equal(next.result.ok, true);
});

test('a dedicated actor failure rejects only its pending jobs and safely falls back', async () => {
  const t = await setup(); await t.client.preparePlacement();
  const stats = t.client.request('ping'), place = t.client.request('placement', job());
  await tick(); t.placement.onerror({message: 'placement actor failed', preventDefault() {}});
  await assert.rejects(place, /placement actor failed/);
  assert.equal(t.placement.terminated, true);
  const ping = t.main.sent.find(m => m.type === 'ping'); t.main.onmessage({data: {type: 'pong', id: ping.id}});
  assert.equal((await stats).type, 'pong');
  const fallback = t.client.request('placement', job('stamp-2')); await tick();
  const sent = t.main.sent.find(m => m.type === 'placement'); assert.ok(sent);
  t.main.onmessage({data: {type: 'placement', id: sent.id, result: {ok: true}}});
  assert.equal((await fallback).result.ok, true);
});

test('unavailable secondary workers preserve the existing main-worker placement path', async () => {
  const t = await setup({unavailable: true}), pending = t.client.request('placement', job());
  await tick(); const sent = t.main.sent.find(m => m.type === 'placement'); assert.ok(sent);
  t.main.onmessage({data: {type: 'placement', id: sent.id, result: {ok: true}}});
  assert.equal((await pending).result.ok, true);
});
