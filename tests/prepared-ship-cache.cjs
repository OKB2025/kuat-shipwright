const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), {test} = require('node:test'), {performance} = require('node:perf_hooks'), {createHash} = require('node:crypto');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const read = f => fs.readFileSync(path.join(root, f), 'utf8'), plain = x => JSON.parse(JSON.stringify(x));

// Transactions clone on put, commit asynchronously, and discard staged writes
// on abort. The same database survives replacement engine/Worker instances.
function database({quota = false} = {}) {
  const stores = new Map(), later = f => setTimeout(f, 0);
  const getStore = name => { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); };
  const db = {close() {}, transaction() {
    let aborted = false; const changes = [], tx = {abort() { aborted = true; tx.onabort?.({preventDefault() {}}); }, objectStore(name) {
      const store = getStore(name);
      return {
        put(value) { if (quota) throw Error('QuotaExceededError'); changes.push(() => store.set(value.id, structuredClone(value))); return {}; },
        delete(id) { changes.push(() => store.delete(id)); return {}; },
        get(id) { const q = {}; later(() => { q.result = structuredClone(store.get(id)); q.onsuccess?.(); }); return q; },
        getAll() { const q = {}; later(() => { q.result = structuredClone([...store.values()]); q.onsuccess?.(); }); return q; },
      };
    }};
    later(() => later(() => { if (!aborted) { for (const change of changes) change(); tx.oncomplete?.(); } })); return tx;
  }};
  return {stores, open() { const q = {}; later(() => { if (!stores.size) { q.result = {createObjectStore: getStore}; q.onupgradeneeded?.(); } q.result = db; q.onsuccess?.(); }); return q; }};
}
function engine(idb, {changedSource = false, transfer = false} = {}) {
  const cx = vm.createContext({console, performance, setTimeout, clearTimeout, structuredClone, URL, crypto: globalThis.crypto, ...(idb ? {indexedDB: idb} : {}), importScripts() {}});
  const files = ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js'];
  cx.KS_SOURCE_STAMP = createHash('sha256').update(files.map(read).join('') + read('js/engine.js') + (changedSource ? 'changed' : '')).digest('hex').slice(0, 20);
  for (const f of files) vm.runInContext(read(f), cx, {filename: f});
  vm.runInContext(read('js/engine.js').split('/* Interface-side connection')[0], cx, {filename: 'js/engine.js'});
  const {C, G, E} = vm.runInContext('({C:Core,G:Gfx,E:YardEngine})', cx), pending = new Map(), messages = []; let id = 0;
  const scope = {postMessage(message, buffers = []) {
    const msg = transfer ? structuredClone(message, {transfer: buffers}) : message; messages.push(msg);
    const waiting = pending.get(msg.id); if (!waiting) return;
    pending.delete(msg.id); msg.type === 'error' ? waiting.reject(Error(msg.message)) : waiting.resolve(msg);
  }};
  E.listenWorker(scope);
  return {C, G, E, messages, request(payload) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, {resolve, reject}); scope.onmessage({data: {...payload, id: next}}); }); }};
}
function design(C) {
  const s = C.deserialize(C.serialize(C.newShip({L: 160, W: 100, H: 80, assembly: true}, 'Prepared cache fixture')));
  s.parts = []; s.fits = []; s.armor = {hull: 0, cit: 0}; s.detail = 0; s.nextId = 1;
  C.placePart(s, 'struct', [80, 40, 30], [80, 40, 24], {form: 'box'}, false);
  return C.serialize(s);
}
function meshDigest(g) {
  const hash = createHash('sha256');
  for (const key of Object.keys(g.meshes).sort()) {
    hash.update(key); const mesh = g.meshes[key].geo;
    if (mesh) for (const field of ['pos', 'nor', 'uv', 'col', 'idx']) if (mesh[field]) hash.update(Buffer.from(mesh[field].buffer, mesh[field].byteOffset, mesh[field].byteLength));
  }
  return hash.digest('hex');
}
function forbidRebuilds(e) {
  for (const key of ['syncCompartments', 'remount', 'computeStats', 'fleetProfile']) e.C[key] = () => assert.fail('warm cache called ' + key);
  e.G.fleetGeometry = () => assert.fail('warm cache rebuilt the 3D model');
}

test('completed figures and every mesh survive a new Worker without any physics or mesh rebuild', async () => {
  const db = database(), cold = engine(db, {transfer: true}), input = design(cold.C);
  const first = await cold.request({type: 'fleet', design: input});
  assert.equal(first.src, 'built'); assert.equal(first.cacheSaved, true); const digest = meshDigest(first.geometry);
  assert.ok([...db.stores.get('rec').values()].some(r => r.geometry), 'even a quickly generated mesh is committed before the response');
  const warm = engine(db, {transfer: true}); forbidRebuilds(warm);
  const second = await warm.request({type: 'fleet', design: input});
  assert.equal(second.src, 'disk'); assert.equal(second.geoCached, true); assert.equal(meshDigest(second.geometry), digest);
  assert.deepEqual(plain(second.stats), plain(first.stats)); assert.deepEqual(plain(second.profile), plain(first.profile));
  const third = await warm.request({type: 'fleet', design: input});
  assert.equal(third.src, 'memory'); assert.equal(third.geoCached, true); assert.equal(meshDigest(third.geometry), digest, 'transferred buffers must not detach the saved model');
  const figures = await warm.request({type: 'fleet', design: input, statsOnly: true});
  assert.deepEqual(plain(figures.profile), plain(first.profile)); assert.equal(figures.geometry, undefined);
});

test('canonical blueprint aliases reuse the original profile and geometry instead of rebuilding another copy', async () => {
  const db = database(), cold = engine(db), input = {...design(cold.C), ignoredLegacyField: true};
  const first = await cold.request({type: 'fleet', design: input});
  assert.notEqual(JSON.stringify(input), JSON.stringify(first.design));
  const warm = engine(db); forbidRebuilds(warm);
  const second = await warm.request({type: 'fleet', design: plain(first.design)});
  assert.equal(second.src, 'disk'); assert.equal(second.geoCached, true);
  assert.deepEqual(plain(second.profile), plain(first.profile)); assert.equal(meshDigest(second.geometry), meshDigest(first.geometry));
});

test('a warm trial restores machinery caches and is immediately ready for turret-ray requests', async () => {
  const db = database(), cold = engine(db), input = design(cold.C);
  const first = await cold.request({type: 'fleet', design: input, trial: true});
  const warm = engine(db); forbidRebuilds(warm);
  const second = await warm.request({type: 'fleet', design: input, trial: true});
  const rays = await warm.request({type: 'trialRays', ids: [], dirs: []});
  assert.equal(second.geoCached, true); assert.equal(meshDigest(second.geometry), meshDigest(first.geometry)); assert.equal(rays.ready, true);
  assert.equal(warm.messages.filter(m => m.type === 'error').length, 0);
});

test('design edits and engine-source changes cannot reuse an obsolete profile or model', async () => {
  const db = database(), cold = engine(db), input = design(cold.C);
  const first = await cold.request({type: 'fleet', design: input});
  const changed = structuredClone(input); changed.parts[0].s[0] += 20;
  const edited = await engine(db).request({type: 'fleet', design: changed});
  assert.equal(edited.src, 'built'); assert.equal(edited.geoCached, false); assert.notEqual(meshDigest(edited.geometry), meshDigest(first.geometry));
  const updated = await engine(db, {changedSource: true}).request({type: 'fleet', design: input});
  assert.equal(updated.src, 'built'); assert.equal(updated.geoCached, false);
  assert.deepEqual(plain(updated.profile), plain(first.profile));
});

test('a mismatched blueprint in a hash bucket is rejected rather than serving another ship', async () => {
  const db = database(), cold = engine(db), input = design(cold.C);
  const first = await cold.request({type: 'fleet', design: input});
  const record = [...db.stores.get('rec').values()].find(r => r.state && r.profile);
  record.designJSON = '{"anotherShip":true}'; record.serial = {name: 'Another ship'};
  const second = await engine(db).request({type: 'fleet', design: input});
  assert.equal(second.src, 'built'); assert.deepEqual(plain(second.profile), plain(first.profile));
});

test('unavailable storage and quota failures still return a usable completed ship', async () => {
  for (const db of [null, database({quota: true})]) {
    const e = engine(db), input = design(e.C), result = await e.request({type: 'fleet', design: input});
    assert.equal(result.cacheSaved, false); assert.ok(result.profile && result.stats); assert.ok(Object.keys(result.geometry.meshes).length);
  }
});

test('save preparation caches both model variants without replacing an active trial', async () => {
  const db = database(), cold = engine(db), input = design(cold.C);
  await cold.request({type: 'fleet', design: input, trial: true});
  cold.C.turretRayContext = () => assert.fail('background preparation replaced the active trial');
  const saved = {...input, name: 'Another saved design'};
  for (const trial of [false, true]) await cold.request({type: 'fleet', design: saved, trial, prepareOnly: true});
  assert.equal((await cold.request({type: 'trialRays', ids: [], dirs: []})).ready, true);
  const warm = engine(db); forbidRebuilds(warm);
  for (const trial of [false, true]) {
    const result = await warm.request({type: 'fleet', design: saved, trial, prepareOnly: true});
    assert.equal(result.src, trial ? 'memory' : 'disk'); assert.equal(result.geoCached, true);
  }
});

test('background preparation does not compute unusable caches when storage is unavailable', async () => {
  const e = engine(null), input = design(e.C); forbidRebuilds(e);
  const result = await e.request({type: 'fleet', design: input, trial: true, prepareOnly: true});
  assert.equal(result.cacheSaved, false); assert.equal(result.src, 'unavailable'); assert.equal(result.geometry, undefined);
});

test('a completed disk bundle takes precedence over repacking the current editor design', async () => {
  const db = database(), cold = engine(db), input = design(cold.C);
  await cold.request({type: 'fleet', design: input});
  const warm = engine(db), state = warm.C.publicJSON(warm.C.deserialize(input));
  warm.request({type: 'update', gen: 1, state, what: ['all'], reset: true, stats: true, statsDelay: 0});
  await warm.request({type: 'ping'}); forbidRebuilds(warm);
  warm.C.serialize = () => assert.fail('warm load serialized/repacked the open editor design');
  const result = await warm.request({type: 'fleet', design: input});
  assert.equal(result.src, 'disk'); assert.equal(result.geoCached, true);
});
test('preparing another example cannot evict a current stock model that exceeds the ordinary LRU budget',async()=>{const db=database(),cold=engine(db),input=design(cold.C),key='cache_retention_fixture';cold.C.registerShipExample({key,name:key,build:()=>cold.C.deserialize(input)});const first=await cold.request({type:'fleet',key,prepareOnly:true});assert.equal(first.cacheSaved,true);await new Promise(r=>setTimeout(r,20));const meta=db.stores.get('meta'),stock=[...meta.values()].find(m=>m.id==='g|k:'+key+'|m');assert.ok(stock);stock.size=1e12;meta.set('g|custom_fixture',{id:'g|custom_fixture',v:stock.v,at:Date.now(),geo:true,size:1e12});db.stores.get('rec').set('g|custom_fixture',{id:'g|custom_fixture',v:stock.v,geometry:{}});const warm=engine(db);forbidRebuilds(warm);const second=await warm.request({type:'fleet',key,prepareOnly:true});assert.equal(second.geoCached,true);await new Promise(r=>setTimeout(r,30));assert.ok(db.stores.get('rec').has('g|k:'+key+'|m'));assert.equal(db.stores.get('rec').has('g|custom_fixture'),false);});
