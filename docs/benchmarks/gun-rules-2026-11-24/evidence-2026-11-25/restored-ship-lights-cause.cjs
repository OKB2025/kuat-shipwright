const RC="function restoreCaches(s, packed) {\n  if (!packed?.ship || !packed.items || typeof structuredClone !== 'function') return false;\n  const c = structuredClone(packed), ids = Object.fromEntries(['parts', 'fits', 'hatches'].map(k => [k, new Map((s[k] || []).map(p => [p.id, p]))])), seen = new Set();\n  const fix = v => {\n    if (!v || typeof v !== 'object') return v;\n    if (v.$r) return v.$r === 'ship' ? s : ids[v.$r]?.get(v.id) || null;\n    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer || seen.has(v)) return v;\n    seen.add(v);\n    if (Array.isArray(v) && v.every(x => !x || typeof x !== 'object')) return v;\n    if (Object.prototype.toString.call(v) === '[object Map]') { const entries = [...v]; v.clear(); for (const [k, x] of entries) v.set(fix(k), fix(x)); }\n    else if (Object.prototype.toString.call(v) === '[object Set]') { const values = [...v].map(fix); v.clear(); for (const x of values) v.add(x); }\n    else for (const k of Object.keys(v)) v[k] = fix(v[k]);\n    return v;\n  };\n  fix(c); Object.assign(s, c.ship);\n  for (const k of ['parts', 'fits', 'hatches']) for (const p of s[k] || []) Object.assign(p, c.items[k]?.[p.id] || {});\n  return true;\n}\n";
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
const root = process.argv[2];
const read = f => fs.readFileSync(path.join(root, f), 'utf8'), plain = x => JSON.parse(JSON.stringify(x));
const SHIP = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(process.argv[3]||root, 'data/examples/hammerhead/design.json.gz'))));

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
  const {C, G, E} = vm.runInContext('({C:Core,G:Gfx,E:YardEngine})', cx); cx.__rc=vm.runInContext('('+RC+')',cx); const RCF=cx.__rc, pending = new Map(), calls = {};
  for (const [o, k] of [[C, 'syncCompartments'], [C, 'computeStats'], [C, 'fleetProfile'], [G, 'fleetGeometry']]) { const f = o[k]; o[k] = function (...a) { calls[k] = (calls[k] || 0) + 1; return f.apply(this, a); }; }
  let id = 0;
  const scope = {postMessage(message, buffers = []) {
    const msg = structuredClone(message, {transfer: buffers}), waiting = pending.get(msg.id); if (!waiting) return;
    pending.delete(msg.id); msg.type === 'error' ? waiting.reject(Error(msg.message)) : waiting.resolve(msg);
  }};
  E.listenWorker(scope);
  return {C, G, E, RCF, calls, records: () => E.fleetRecordSizes(), request(payload) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, {resolve, reject}); scope.onmessage({data: {...payload, id: next}}); }); }};
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



(async()=>{
  const IDS=["p1:port:30:gndw3c","p1:stbd:30:gndw3c","p1:bottom:29:gndw3c","p1:port:26:gndw3c"];
  const sig=T=>{let s=0;for(let i=0;i<T.length;i++)s+=T[i]*((i%7)+1);return T.length+":"+s.toFixed(3);};
  const show=(tag,C,x)=>{const m=new Map(C.surfacePatches(x).map(q=>[q.id,q]));console.log(tag.padEnd(16),IDS.map(id=>{const q=m.get(id);return q?q.exposedArea.toFixed(4)+"/"+q.exposedTriangles.length+" base "+sig(q.triangles)+" "+q.triangles.constructor.name:"-";}).join(" || "));};
  const e=engine(database());const {C,E,RCF}=e;
  const d=C.deserialize(structuredClone(SHIP));C.syncCompartments(d);C.remount(d,{keepFitPose:true});C.syncCompartments(d);show("A",C,d);
  const state=C.publicJSON(d);const caches=E.packCaches(d,{runtime:true});
  // restore, then drop one family of restored caches at a time and survey
  const kinds={none:()=>{},shipCache:b=>{delete b._cache;},partPacking:b=>{for(const p of b.parts){delete p._packing;}},partClip:b=>{for(const p of b.parts)delete p._clip;},partAll:b=>{for(const p of b.parts)for(const k of Object.keys(p))if(k[0]==="_")delete p[k];},fitAll:b=>{for(const p of b.fits)for(const k of Object.keys(p))if(k[0]==="_")delete p[k];}};
  for(const [name,f] of Object.entries(kinds)){const b=JSON.parse(state);RCF(b,caches);f(b);try{show("B -"+name,C,b);}catch(err){console.log("B -"+name,"error",err.message);}}
  const b=JSON.parse(state);RCF(b,caches);const types=new Map();for(const p of b.parts){for(const k of ["_packing","_clip"]){const A=d.parts.find(q=>q.id===p.id)[k]?.tris,B=p[k]?.tris;if(A||B)types.set(k+" "+(A?.constructor.name)+"->"+(B?.constructor.name),(types.get(k+" "+(A?.constructor.name)+"->"+(B?.constructor.name))||0)+1);}}console.log([...types]);
 process.exit(0);
})();