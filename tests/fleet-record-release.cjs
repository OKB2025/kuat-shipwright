// The fleet Worker releases a built ship's live graph and full statistics after
// each fleet job and keeps a bounded number of records (js/engine.js fleetKeep).
// A later request restores the ship from the packed caches (or, for an older
// record without caches, by deriving its compartments again). Whatever the
// order of requests, the restored ship must give the same display figures,
// trial model and turret-ray answers as the first build, without recomputing
// statistics or the profile. Also: one surface-design build serves both mesh
// variants, a non-surface design keeps its separate builds, the derived
// collision shell equals the array profiles used to store, and a battle never
// writes into a profile shared between the fleet screen and the trial.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib'), assert = require('node:assert/strict'), {test} = require('node:test'), {performance} = require('node:perf_hooks'), {createHash} = require('node:crypto');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8'), plain = x => JSON.parse(JSON.stringify(x));
const SHIP = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, 'data/examples/hammerhead/design.json.gz'))));

function database() {
  const stores = new Map(), later = f => setTimeout(f, 0);
  const getStore = name => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); };
  const db = {close() {}, transaction() {
    let aborted = false; const changes = [], tx = {abort() { aborted = true; tx.onabort?.({preventDefault() {}}); }, objectStore(name) {
      const store = getStore(name);
      return {
        put(value) { const copy = structuredClone(value); changes.push(() => store.set(value.id, copy)); return {}; },
        delete(id) { changes.push(() => store.delete(id)); return {}; },
        get(id) { const q = {}; later(() => { q.result = structuredClone(store.get(id)); q.onsuccess?.(); }); return q; },
        getAll() { const q = {}; later(() => { q.result = structuredClone([...store.values()]); q.onsuccess?.(); }); return q; },
      };
    }};
    later(() => later(() => { if (!aborted) { for (const change of changes) change(); tx.oncomplete?.(); } })); return tx;
  }};
  return {stores, open() { const q = {}; later(() => { if (!stores.size) { q.result = {createObjectStore: getStore}; q.onupgradeneeded?.(); } q.result = db; q.onsuccess?.(); }); return q; }};
}
// A Worker over a shared database. calls counts the expensive derivations.
function engine(idb) {
  const cx = vm.createContext({console, performance, setTimeout, clearTimeout, structuredClone, URL, crypto: globalThis.crypto, ...(idb ? {indexedDB: idb} : {}), importScripts() {}});
  const files = ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js'];
  cx.KS_SOURCE_STAMP = createHash('sha256').update(files.map(read).join('') + read('js/engine.js')).digest('hex').slice(0, 20);
  for (const f of files) vm.runInContext(read(f), cx, {filename: f});
  vm.runInContext(read('js/engine.js').split('/* Interface-side connection')[0], cx, {filename: 'js/engine.js'});
  const {C, G, E} = vm.runInContext('({C:Core,G:Gfx,E:YardEngine})', cx), pending = new Map(), calls = {};
  for (const [o, k] of [[C, 'syncCompartments'], [C, 'computeStats'], [C, 'fleetProfile'], [G, 'fleetGeometry']]) { const f = o[k]; o[k] = function (...a) { calls[k] = (calls[k] || 0) + 1; return f.apply(this, a); }; }
  let id = 0;
  const scope = {postMessage(message, buffers = []) {
    const msg = structuredClone(message, {transfer: buffers}), waiting = pending.get(msg.id); if (!waiting) return;
    pending.delete(msg.id); msg.type === 'error' ? waiting.reject(Error(msg.message)) : waiting.resolve(msg);
  }};
  E.listenWorker(scope);
  return {C, G, calls, request(payload) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, {resolve, reject}); scope.onmessage({data: {...payload, id: next}}); }); }};
}
function meshDigest(g) {
  const hash = createHash('sha256');
  for (const key of Object.keys(g.meshes).sort()) {
    hash.update(key); const mesh = g.meshes[key].geo;
    if (mesh) for (const field of ['pos', 'nor', 'uv', 'col', 'idx']) if (mesh[field]) hash.update(Buffer.from(mesh[field].buffer, mesh[field].byteOffset, mesh[field].byteLength));
  }
  hash.update(JSON.stringify(g, (k, v) => k === 'meshes' ? undefined : ArrayBuffer.isView(v) ? Array.from(v) : v));
  return hash.digest('hex');
}
// Turret-ray answers of the Worker's held trial ship, in every direction of a fixed set.
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [.6, .8, 0], [-.6, 0, .8]];
async function rays(e, turrets) {
  const ids = [], dirs = [];
  for (const t of turrets) for (const d of DIRS) { ids.push(t.id); dirs.push(...d); }
  const r = await e.request({type: 'trialRays', ids, dirs});
  assert.equal(r.ready, true); return Array.from(r.clear);
}
// Same design, three other designs in between: the bounded record list must
// evict it, so the next request comes from the database.
async function evict(e) {
  for (let i = 0; i < 3; i++) { const other = structuredClone(SHIP); other.name = 'filler ' + i; other.parts = other.parts.slice(0, 2); other.fits = []; delete other.surfaces; await e.request({type: 'fleet', design: other}); }
}

let reference = null;
async function first() {
  if (reference) return reference;
  const db = database(), e = engine(db), cold = await e.request({type: 'fleet', design: SHIP, trial: true});
  assert.equal(cold.src, 'built'); assert.ok(cold.profile?.surface && cold.stats && cold.geometry.turrets.length);
  reference = {db, e, cold, digest: meshDigest(cold.geometry), rays: await rays(e, cold.geometry.turrets), stats: plain(cold.stats), profile: plain(cold.profile)};
  return reference;
}

test('a released memory record restores the same figures, trial model and turret rays without recomputing', async () => {
  const ref = await first(), e = ref.e, before = {...e.calls};
  const again = await e.request({type: 'fleet', design: SHIP, trial: true});
  assert.equal(again.src, 'memory'); assert.equal(again.geoCached, true);
  assert.deepEqual(plain(again.stats), ref.stats); assert.deepEqual(plain(again.profile), ref.profile); assert.equal(meshDigest(again.geometry), ref.digest);
  assert.deepEqual(await rays(e, again.geometry.turrets), ref.rays);
  for (const k of ['computeStats', 'fleetProfile', 'fleetGeometry', 'syncCompartments']) assert.equal(e.calls[k] || 0, before[k] || 0, k + ' repeated on a memory hit');
});

test('an evicted record is read back from the database once and matches the first build', async () => {
  const ref = await first(), e = ref.e; await evict(e);
  const before = {...e.calls}, back = await e.request({type: 'fleet', design: SHIP, trial: true, profileKnown: true, statsKnown: true});
  assert.equal(back.src, 'disk'); assert.equal(back.geoCached, true); assert.equal(back.profile, null); assert.equal(back.stats, null);
  assert.equal(meshDigest(back.geometry), ref.digest); assert.deepEqual(await rays(e, back.geometry.turrets), ref.rays);
  for (const k of ['computeStats', 'fleetProfile', 'fleetGeometry', 'syncCompartments']) assert.equal(e.calls[k] || 0, before[k] || 0, k + ' repeated after eviction');
  const figures = await e.request({type: 'fleet', design: SHIP, statsOnly: true});
  assert.deepEqual(plain(figures.stats), ref.stats); assert.deepEqual(plain(figures.profile), ref.profile);
});

test('statsOnly then the trial model, in a fresh Worker, equals the first build', async () => {
  const ref = await first(), e = engine(database());
  const figures = await e.request({type: 'fleet', design: SHIP, statsOnly: true});
  assert.deepEqual(plain(figures.stats), ref.stats); assert.deepEqual(plain(figures.profile), ref.profile);
  const model = await e.request({type: 'fleet', design: SHIP, trial: true});
  assert.equal(model.src, 'memory'); assert.equal(meshDigest(model.geometry), ref.digest); assert.deepEqual(plain(model.stats), ref.stats);
  assert.deepEqual(await rays(e, model.geometry.turrets), ref.rays);
  assert.equal(e.calls.computeStats, 1); assert.equal(e.calls.fleetProfile, 1);
});

test('an older database record without packed caches derives its compartments again and gives the same answers', async () => {
  const ref = await first(), db = database();
  for (const [name, store] of ref.db.stores) db.stores.set(name, new Map([...store].map(([k, v]) => [k, structuredClone(v)])));
  const records = db.stores.get('rec');
  for (const [k, v] of [...records]) { if (k.startsWith('g|')) records.delete(k); else if (v.state) delete v.caches; }
  const e = engine(db), restored = await e.request({type: 'fleet', design: SHIP, trial: true});
  assert.equal(restored.src, 'disk'); assert.equal(restored.geoCached, false);
  assert.deepEqual(plain(restored.stats), ref.stats); assert.deepEqual(plain(restored.profile), ref.profile);
  assert.equal(meshDigest(restored.geometry), ref.digest); assert.deepEqual(await rays(e, restored.geometry.turrets), ref.rays);
  assert.ok(e.calls.syncCompartments >= 1, 'the legacy record derives its compartments'); assert.equal(e.calls.computeStats || 0, 0);
});

test('a non-surface design: lite then full, and its model and trial variants keep their own builds', async () => {
  const flat = structuredClone(SHIP); delete flat.surfaces; flat.name = 'Flat fixture';
  const full = engine(database()), expected = await full.request({type: 'fleet', design: flat});
  assert.equal(expected.profile.surface, undefined);
  const e = engine(database()), lite = await e.request({type: 'fleet', design: flat, lite: true});
  assert.equal(lite.profile, null); assert.equal(lite.stats, null); assert.equal(e.calls.computeStats || 0, 0);
  const later = await e.request({type: 'fleet', design: flat});
  assert.equal(later.src, 'memory'); assert.equal(later.geoCached, true);
  assert.deepEqual(plain(later.stats), plain(expected.stats)); assert.deepEqual(plain(later.profile), plain(expected.profile)); assert.equal(meshDigest(later.geometry), meshDigest(expected.geometry));
  const builds = e.calls.fleetGeometry, trial = await e.request({type: 'fleet', design: flat, trial: true});
  assert.equal(trial.geoCached, false, 'a non-surface trial model is not stored by the plain model build');
  assert.equal(e.calls.fleetGeometry, builds + 1); assert.notEqual(meshDigest(trial.geometry), meshDigest(later.geometry));
  const direct = engine(database()), separate = await direct.request({type: 'fleet', design: flat, trial: true});
  assert.equal(meshDigest(trial.geometry), meshDigest(separate.geometry));
});

test('a surface design stores both mesh variants from one build, equal to separate builds', async () => {
  const ref = await first(), e = engine(database()), model = await e.request({type: 'fleet', design: SHIP});
  const builds = e.calls.fleetGeometry, trial = await e.request({type: 'fleet', design: SHIP, trial: true});
  assert.equal(trial.geoCached, true); assert.equal(e.calls.fleetGeometry, builds); assert.equal(meshDigest(trial.geometry), ref.digest);
  const separate = engine(database()), {C, G} = separate, d = C.deserialize(structuredClone(SHIP));
  C.syncCompartments(d); C.remount(d); C.syncCompartments(d);
  const p = C.fleetProfile(C.computeStats(d), d.name, d), center = {center: p.surface.offset};
  const both = G.fleetGeometry(d, {variants: true, ...center}), alone = {model: G.fleetGeometry(d, center), trial: G.fleetGeometry(d, {trial: true, ...center})};
  const raw = g => JSON.stringify(g, (k, v) => ArrayBuffer.isView(v) ? Array.from(v) : v);
  assert.equal(raw(both.model), raw(alone.model)); assert.equal(raw(both.trial), raw(alone.trial));
  assert.equal(both.model.launchers, null); assert.equal(both.model.eyes, null); assert.equal(both.trial.meshes, both.model.meshes);
  assert.ok(model.geometry && Object.keys(model.geometry.meshes).length);
});

test('the derived collision shell is the stored shell and gives identical ray hits', async () => {
  const {cold} = await first(), e = engine(null), C = e.C, s = cold.profile.surface;
  const old = []; for (const q of s.patches) if (q.exposed) for (const v of q.triangles) old.push(v);
  const derived = C.surfaceShell(s);
  assert.equal(s.shell, undefined); assert.ok(old.length > 0); assert.equal(derived.length, old.length);
  for (let i = 0; i < old.length; i++) if (!Object.is(derived[i], old[i])) assert.fail('shell value ' + i);
  assert.equal(C.surfaceShell(s), derived, 'derived once per surface');
  let state = 7; const random = () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 2 ** 32), L = cold.profile.len;
  const stored = {p: {...cold.profile, surface: {...s, shell: old}}, pos: [0, 0, 0], yaw: 0}, current = {p: cold.profile, pos: [0, 0, 0], yaw: 0};
  for (let i = 0; i < 400; i++) {
    const from = [(random() - .5) * L * 3, (random() - .5) * L, (random() - .5) * L * 2], to = [(random() - .5) * L * .5, (random() - .5) * L * .2, (random() - .5) * L * .3];
    const d = C.norm(C.sub(to, from)), a = C.rayTris(old, from, d), b = C.rayTris(derived, from, d);
    assert.deepEqual(b, a); assert.deepEqual(C.surfaceRayHit(current, from, to), C.surfaceRayHit(stored, from, to));
  }
});

function deepFreeze(v, seen = new Set()) {
  if (!v || typeof v !== 'object' || seen.has(v) || ArrayBuffer.isView(v)) return v; seen.add(v);
  for (const k of Object.keys(v)) deepFreeze(v[k], seen); return Object.freeze(v);
}
test('a fleet battle and a renamed trial flagship never write into a shared profile', async () => {
  const {cold} = await first(), C = engine(null).C, shared = deepFreeze(structuredClone(cold.profile)), digest = JSON.stringify(shared);
  // trialStart gives the trial its own top-level copy; the fleet screen keeps the shared asset profile.
  const own = {...shared}; own.name = 'Renamed flagship';
  const units = [C.fleetUnit('me', 'hammerhead', own, 0), C.fleetUnit('a0', 'hammerhead', shared, 0), C.fleetUnit('e0', 'hammerhead', shared, 1), C.fleetUnit('e1', 'hammerhead', shared, 1)];
  units[0].pos = [0, 0, 0]; units[1].pos = [-600, 80, 700]; units[2].pos = [2600, 150, 800]; units[3].pos = [2800, -120, 1300]; units[2].yaw = units[3].yaw = -Math.PI * .85;
  const b = C.fleetBattle(units, true); b.seed = 20261111; C.fleetPrepareCollision(units);
  const rules = {range: 40000, engagementDistance: 12000, step: .25, damage: .7};
  let hits = 0;
  for (let i = 0; i < 160; i++) {
    if (i % 8 === 0) for (const u of units) { const foe = units.filter(t => t.team !== u.team && !t.dead).sort((a, z) => C.len(C.sub(a.pos, u.pos)) - C.len(C.sub(z.pos, u.pos)))[0]; u.order = {...u.order, type: foe ? 'attack' : 'hold', target: foe?.id, fire: true, launch: true}; }
    if (i === 40) units[2].mods.fill(0, 0, Math.ceil(units[2].mods.length / 2));
    C.fleetTick(b, rules.step, {rules, extra: new Map(), gravity: true, onHit: () => {}});
  }
  hits = units.reduce((n, u) => n + (u.hp < u.p.hp || Object.keys(u.surfaceArmor || {}).length ? 1 : 0), 0);
  assert.ok(hits > 0, 'the ships exchanged fire');
  assert.equal(JSON.stringify(shared), digest); assert.equal(shared.name, cold.profile.name);
  for (const k of ['surface', 'modules']) assert.ok(Object.isFrozen(shared[k]));
});
