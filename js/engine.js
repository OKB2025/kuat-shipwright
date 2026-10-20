/* ============================================================
   engine.js — background geometry & performance engine (v12).
   The same code runs inside a Web Worker or, when workers are not
   available, inline on the interface thread. The editor owns the
   design. The engine mirrors it from public state (fields without
   a leading underscore), keeps its own keyed caches, and returns
   meshes, performance figures and derived state: clipped and
   integrated compartments, weapon mounts and bay openings.
   ============================================================ */
const YardEngine = (() => {
'use strict';
const C = Core, G = Gfx;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let post = () => {};
let ship = null, hullKey = '', lastInfo = null, lastOverlap = '', view = {coded: false, habitation: false};
const queue = [];
let running = false;

// ---------- transfer helpers ----------
function geoOut(g, transfer) {
  if (!g) return null;
  const o = {n: g.n, ni: g.ni, pos: g.pos.slice(0, g.n * 3), nor: g.nor.slice(0, g.n * 3), uv: g.uv.slice(0, g.n * 2), col: g.col.slice(0, g.n * 4), idx: g.idx.slice(0, g.ni)};
  if (transfer) transfer.push(o.pos.buffer, o.nor.buffer, o.uv.buffer, o.col.buffer, o.idx.buffer);
  return o;
}
function linesOut(l, transfer) { if (!l) return null; const o = {pos: l.pos.slice(), col: l.col.slice()}; if (transfer) transfer.push(o.pos.buffer, o.col.buffer); return o; }
const overlapSig = (info) => info ? Object.keys(info).filter(k => info[k] && info[k].overlap).sort().join(',') : '';

// Caches travel to the editor with references to ship objects replaced by
// markers, so the editor can re-point them at its own objects.
const SHIP_SKIP = new Set(['_portalGeoFlat', '_lockedCache', '_building', '_aviationSyncing', '_clipEnvelope', '_geoProxy', '_client', '_armoredMaterial', '_armoredClosed']);
function packCaches(s) {
  const refs = new Map([[s, {$r: 'ship'}]]);
  for (const l of ['parts', 'fits', 'hatches']) for (const it of s[l]) refs.set(it, {$r: l, id: it.id});
  const memo = new Map();
  const conv = (v, key) => {
    if (key === 'geoFlat') return undefined;
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
    const r = refs.get(v); if (r) return r;
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v;
    let o = memo.get(v); if (o) return o;
    if (v instanceof Map) { o = new Map(); memo.set(v, o); if (key === 'sec') return o; for (const [k, x] of v) o.set(k, conv(x)); return o; }
    if (v instanceof Set) { o = new Set(); memo.set(v, o); for (const x of v) o.add(conv(x)); return o; }
    if (Array.isArray(v)) { o = new Array(v.length); memo.set(v, o); for (let i = 0; i < v.length; i++) o[i] = conv(v[i]); return o; }
    o = {}; memo.set(v, o);
    for (const k of Object.keys(v)) { const x = v[k]; if (typeof x === 'function') continue; o[k] = conv(x, k); }
    return o;
  };
  const out = {ship: {}, items: {parts: {}, fits: {}, hatches: {}}};
  for (const k of Object.keys(s)) if (k[0] === '_' && !SHIP_SKIP.has(k)) out.ship[k] = conv(s[k], k);
  for (const l of ['parts', 'fits', 'hatches']) for (const it of s[l]) {
    let o = null;
    for (const k of Object.keys(it)) if (k[0] === '_') { (o || (o = {}))[k] = conv(it[k], k); }
    if (o) out.items[l][it.id] = o;
  }
  // Pick geometry: the exact objects the editor's ray casts and section queries use.
  out.geoProxy = {hull: conv(C.hullGeo(s)), ref: conv(C.referenceHullGeometry(s))};
  return out;
}

// ---------- mesh pipeline (mirrors the editor's former render loop) ----------
function meshPartsRanged(s, opt) {
  const m = G.meshParts(s, opt);
  return m;
}
function geometryPass(job, flags) {
  const transfer = [], geos = {}, out = {type: 'geometry', gen: job.gen, geos, transfer};
  const t0 = now();
  if (flags.hull) {
    C.hullGeo(ship);
    const key = (ship._cache && ship._cache.key) + JSON.stringify([ship.hullSkin || null, ship.paint || null, ship.detail ?? 1]);
    if (key !== hullKey) { geos.hull = geoOut(G.meshHull(ship), transfer); geos.refHull = geoOut(G.meshReferenceHull(ship), transfer); hullKey = key; }
    geos.keel = geoOut(G.meshKeel(ship), transfer);
    out.dims = [ship.hull.L, ship.hull.W, ship.hull.H];
  }
  if (flags.parts) {
    const m = meshPartsRanged(ship, {coded: !!view.coded, info: lastInfo, habitation: !!view.habitation});
    for (const k of Object.keys(m.g)) geos[k] = geoOut(m.g[k], transfer);
    out.glow = m.glow; out.ranges = m.ranges || null;
    out.bounds = G.shipBounds(ship); out.grid = linesOut(G.gridLines(ship, out.bounds), transfer);
    lastOverlap = overlapSig(lastInfo);
  }
  if (flags.hatches) { const h = G.meshHatches(ship); geos.hatchOpen = geoOut(h.open, transfer); geos.hatchRay = geoOut(h.ray, transfer); geos.refHatches = geoOut(G.meshReferenceHatches(ship), transfer); }
  if (flags.fits) { const fr = {}; geos.fits = geoOut(G.meshFits(ship, null, fr), transfer); geos.refFits = geoOut(G.meshReferenceFits(ship, fr), transfer); out.fitRanges = fr; }
  out.meshMs = now() - t0;
  return out;
}

function applyState(job) {
  if (job.reset || !ship) {
    if (!(ship && C.publicJSON(ship) === job.state)) { ship = JSON.parse(job.state); hullKey = ''; lastInfo = null; lastOverlap = ''; }
  } else C.patchShip(ship, JSON.parse(job.state));
}
function deriveState(job) {
  const what = new Set(job.what || []);
  const any = (...k) => k.some(w => what.has(w));
  const flags = {hull: false, parts: false, hatches: false, fits: false};
  if (job.reset || any('hull', 'all', 'hatches')) flags.hull = flags.parts = flags.hatches = flags.fits = true;
  if (any('parts')) flags.parts = flags.hatches = flags.fits = true;
  if (any('fits')) flags.fits = flags.parts = true;
  if (any('view')) flags.parts = true;
  const sync = job.reset || any('hull', 'all', 'parts', 'fits', 'hatches');
  const mount = job.reset || any('hull', 'all', 'parts', 'hatches');
  const t0 = now();
  if (sync) C.syncCompartments(ship);
  if (mount) { C.remount(ship); C.syncCompartments(ship); }
  return {flags, syncMs: now() - t0, touched: sync || mount};
}
function finishGeometry(job, out) {
  // Build the ray-cast hierarchy here so the editor never has to.
  try { C.rayEnv(ship, [ship.hull.L / 2, 1e7, 0], [0, -1, 0]); } catch (e) { /* empty hull */ }
  const t0 = now();
  out.state = C.publicJSON(ship);
  out.caches = packCaches(ship);
  out.packMs = now() - t0;
}

async function handleUpdate(job) {
  const t0 = now();
  applyState(job);
  if (job.view) view = job.view;
  const d = deriveState(job);
  const any = Object.values(d.flags).some(Boolean);
  if (any || d.touched || job.reset) {
    const out = geometryPass(job, d.flags);
    finishGeometry(job, out);
    out.syncMs = d.syncMs; out.totalMs = now() - t0;
    const transfer = out.transfer; delete out.transfer;
    post(out, transfer);
  } else {
    post({type: 'geometry', gen: job.gen, geos: {}, state: C.publicJSON(ship), caches: null, totalMs: now() - t0, noop: true});
  }
  if (job.stats === false) return;
  // Stats wait for a short quiet period so continuous edits keep the
  // geometry responsive. A newer edit cancels this run.
  const delay = job.statsDelay == null ? 220 : job.statsDelay;
  if (delay > 0) await sleep(delay);
  if (queue.some(j => j.type === 'update')) return;
  const t1 = now();
  const S = C.computeStats(ship);
  lastInfo = S.info;
  const msg = {type: 'stats', gen: job.gen, stats: S, statsMs: now() - t1};
  const transfer = [];
  if (overlapSig(S.info) !== lastOverlap) {
    const m = meshPartsRanged(ship, {coded: !!view.coded, info: lastInfo, habitation: !!view.habitation});
    msg.geos = {}; for (const k of Object.keys(m.g)) msg.geos[k] = geoOut(m.g[k], transfer);
    msg.glow = m.glow; msg.ranges = m.ranges || null; lastOverlap = overlapSig(lastInfo);
  }
  post(msg, transfer);
}

function handleBuild(job) {
  const t0 = now();
  const b = C.buildDesign(job.key);
  ship = b; hullKey = ''; lastInfo = null; lastOverlap = '';
  C.syncCompartments(ship); C.remount(ship); C.syncCompartments(ship);
  post({type: 'built', id: job.id, key: job.key, state: C.publicJSON(ship), ms: now() - t0});
}

let trialHold = null;
function handleTrialRays(job) {
  const ids = job.ids || [], dirs = job.dirs || [], out = new Uint8Array(ids.length), t = trialHold;
  if (t) for (let i = 0; i < ids.length; i++) { const f = t.fits.get(ids[i]); out[i] = f && C.turretClear(t.ship, f, [dirs[i * 3], dirs[i * 3 + 1], dirs[i * 3 + 2]], t.ctx) ? 1 : 0; }
  post({type: 'trialRays', id: job.id, clear: out, ready: !!t});
}
function handleFleet(job) {
  const t0 = now();
  const d = job.key ? C.buildDesign(job.key) : C.deserialize(job.design);
  C.syncCompartments(d); C.remount(d); C.syncCompartments(d);
  const stats = C.computeStats(d), profile = C.fleetProfile(stats, d.name), transfer = [];
  const geometry = G.fleetGeometry(d, job.trial ? {trial: true} : null);
  for (const m of Object.values(geometry.meshes)) { m.geo = geoOut(m.geo, transfer); }
  // A trial keeps its ship here so turret rays can be tested against it.
  if (job.trial) trialHold = {ship: d, ctx: C.turretRayContext(d), fits: new Map(d.fits.map(f => [f.id, f]))};
  post({type: 'fleet', id: job.id, stats, profile, geometry, design: C.serialize(d), ms: now() - t0}, transfer);
}

function handleOp(job) {
  applyState(job);
  C.syncCompartments(ship);
  let result = null;
  switch (job.op) {
    case 'fillHangars': result = C.fillHangars(ship, ...job.args); break;
    default: throw new Error('unknown operation ' + job.op);
  }
  post({type: 'op', id: job.id, result, state: C.publicJSON(ship)});
}

async function pump() {
  if (running) return; running = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      try {
        if (job.type === 'update') await handleUpdate(job);
        else if (job.type === 'build') handleBuild(job);
        else if (job.type === 'fleet') handleFleet(job);
        else if (job.type === 'trialRays') handleTrialRays(job);
        else if (job.type === 'trialEnd') trialHold = null;
        else if (job.type === 'op') handleOp(job);
        else if (job.type === 'ping') post({type: 'pong', id: job.id});
      } catch (e) {
        post({type: 'error', job: job.type, id: job.id, gen: job.gen, message: String(e && e.message || e), stack: String(e && e.stack || '')});
      }
    }
  } finally { running = false; }
}
function receive(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === 'update') {
    // Only the newest design matters; merge the dirty flags of skipped edits.
    const old = queue.find(j => j.type === 'update');
    if (old) { old.what = Array.from(new Set([...(old.what || []), ...(msg.what || [])])); old.reset = old.reset || msg.reset; Object.assign(old, {gen: msg.gen, state: msg.state, view: msg.view || old.view, stats: msg.stats, statsDelay: msg.statsDelay}); }
    else queue.push(msg);
  } else queue.push(msg);
  pump();
}

// ---------- hosting ----------
function listenWorker(scope) {
  post = (msg, transfer) => scope.postMessage(msg, transfer || []);
  scope.onmessage = (e) => receive(e.data);
  post({type: 'ready'});
}
function connectInline(deliver) {
  // Same contract as a worker: every message is copied, never shared.
  const copy = (m) => (typeof structuredClone === 'function' ? structuredClone(m) : JSON.parse(JSON.stringify(m)));
  post = (msg) => { const m = copy(msg); setTimeout(() => deliver(m), 0); };
  return (msg) => { const m = copy(msg); setTimeout(() => receive(m), 0); };
}
return {listenWorker, connectInline, packCaches};
})();
if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof importScripts === 'function' && self.__ksWorker) YardEngine.listenWorker(self);

/* Interface-side connection to the engine: a worker built from this page's
   own sources, or the same engine inline when workers are unavailable. */
const YardEngineClient = (() => {
'use strict';
let send = null, mode = 'none', worker = null, nextId = 1, readyResolve, sources = null;
const handlers = {}, waiting = new Map();
const ready = new Promise(r => { readyResolve = r; });
function dispatch(msg) {
  if (!msg || !msg.type) return;
  if (msg.id != null && waiting.has(msg.id)) {
    const w = waiting.get(msg.id); waiting.delete(msg.id);
    if (msg.type === 'error') w.reject(Object.assign(new Error(msg.message), {stack: msg.stack})); else w.resolve(msg);
    return;
  }
  const h = handlers[msg.type]; if (h) h(msg);
}
function inline() {
  mode = 'inline'; worker = null; send = YardEngine.connectInline(dispatch);
}
function bootWorker(src, timeout) {
  const url = URL.createObjectURL(new Blob(['self.__ksWorker=true;\n', ...src.flatMap(s => [s, '\n'])], {type: 'text/javascript'}));
  let w;
  try { w = new Worker(url); } catch (e) { URL.revokeObjectURL(url); return Promise.reject(e); }
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('worker timeout')), timeout || 90000);
    w.onmessage = (e) => { if (e.data && e.data.type === 'ready') { clearTimeout(t); resolve(w); } };
    w.onerror = (e) => { clearTimeout(t); e.preventDefault?.(); reject(new Error(e.message || 'worker error')); };
  }).finally(() => URL.revokeObjectURL(url));
}
// opts.workerReady: a worker the page started earlier (resolves once it is ready).
async function start(src, opts = {}) {
  sources = src;
  if (opts.inline || typeof Worker === 'undefined' || typeof Blob === 'undefined' || (!src && !opts.workerReady)) { inline(); readyResolve(mode); return mode; }
  try {
    const w = await (opts.workerReady || bootWorker(src, opts.timeout));
    w.onmessage = (e) => dispatch(e.data);
    w.onerror = (e) => { e.preventDefault?.(); console.error('engine worker failed', e.message); fail(); };
    worker = w; mode = 'worker'; send = (m, tr) => w.postMessage(m, tr || []);
  } catch (e) {
    console.warn('engine worker unavailable, running inline:', e.message);
    inline();
  }
  readyResolve(mode);
  return mode;
}
function fail() {
  // A crashed worker hands over to the inline engine; pending requests fail.
  try { worker?.terminate(); } catch (e) {}
  inline();
  for (const [id, w] of waiting) w.reject(new Error('engine restarted'));
  waiting.clear();
  const h = handlers.restart; if (h) h();
}
function post(msg, transfer) { if (!send) throw new Error('engine not started'); send(msg, transfer); }
function request(type, payload = {}, transfer) {
  const id = nextId++;
  return ready.then(() => new Promise((resolve, reject) => { waiting.set(id, {resolve, reject}); post({...payload, type, id}, transfer); }));
}
return {start, post, request, ready, on(type, fn) { handlers[type] = fn; }, get mode() { return mode; }};
})();
