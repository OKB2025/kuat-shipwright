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
  const {C, G, E} = vm.runInContext('({C:Core,G:Gfx,E:YardEngine})', cx), pending = new Map(), calls = {};
  for (const [o, k] of [[C, 'syncCompartments'], [C, 'computeStats'], [C, 'fleetProfile'], [G, 'fleetGeometry']]) { const f = o[k]; o[k] = function (...a) { calls[k] = (calls[k] || 0) + 1; return f.apply(this, a); }; }
  let id = 0;
  const scope = {postMessage(message, buffers = []) {
    const msg = structuredClone(message, {transfer: buffers}), waiting = pending.get(msg.id); if (!waiting) return;
    pending.delete(msg.id); msg.type === 'error' ? waiting.reject(Error(msg.message)) : waiting.resolve(msg);
  }};
  E.listenWorker(scope);
  return {C, G, calls, records: () => E.fleetRecordSizes(), request(payload) { return new Promise((resolve, reject) => { const next = ++id; pending.set(next, {resolve, reject}); scope.onmessage({data: {...payload, id: next}}); }); }};
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
 const ref=await first(),e=engine(database());
 await e.request({type:'fleet',design:SHIP,statsOnly:true});
 const model=await e.request({type:'fleet',design:SHIP,trial:true});
 const A=ref.cold.geometry,B=model.geometry;
 console.log('digest',meshDigest(A)===meshDigest(B),model.src);
 for(const key of new Set([...Object.keys(A.meshes),...Object.keys(B.meshes)])){const a=A.meshes[key]?.geo,b=B.meshes[key]?.geo;if(!a||!b){console.log('mesh only in',a?'A':'B',key);continue;}for(const f of ['pos','nor','uv','col','idx']){const x=a[f],y=b[f];if(!x&&!y)continue;if(!x||!y||x.length!==y.length){console.log(key,f,'len',x?.length,y?.length);continue;}let n=0,first=-1,mx=0;for(let i=0;i<x.length;i++)if(x[i]!==y[i]){n++;if(first<0)first=i;mx=Math.max(mx,Math.abs(x[i]-y[i]));}if(n)console.log(key,f,'differs',n,'of',x.length,'first',first,x[first],y[first],'max',mx);}}
 console.log(Object.keys(A.meshes.surfaceDevices),JSON.stringify(A.meshes.surfaceDevices,(k,v)=>k==='geo'?undefined:ArrayBuffer.isView(v)?'[typed '+v.length+']':v).slice(0,600));
 // A third build straight from Core/Gfx in the first Worker's realm, with and without the figures computed first.
 const {C,G}=ref.e;const lamp=g=>{const p=g.meshes.surfaceDevices.geo?.pos||g.meshes.surfaceDevices.pos;return Array.from(p.slice(312*3,316*3)).map(v=>+v.toFixed(5)).join(' ');};
 console.log('A   ',lamp(A));console.log('B   ',lamp(B));
 for(const mode of ['plain','stats-first','json-roundtrip','no-remount']){const d=C.deserialize(structuredClone(SHIP));C.syncCompartments(d);if(mode!=='no-remount'){C.remount(d,{keepFitPose:true});C.syncCompartments(d);}let ship=d;if(mode==='stats-first'){const S=C.computeStats(d);C.fleetProfile(S,d.name,d);}if(mode==='json-roundtrip'){ship=C.deserialize(C.serialize(d));C.syncCompartments(ship);}
  const center=ref.cold.profile?.surface?.offset?{center:ref.cold.profile.surface.offset}:{};const g=G.fleetGeometry(ship,{variants:true,...center}).trial;console.log(mode.padEnd(15),lamp(g));}
 process.exit(0);
})();
