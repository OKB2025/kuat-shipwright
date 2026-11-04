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

let post = () => {};
let shipGen = 0, lastStats = null; // v13 LOAD the editor's latest figures, for a trial flight of the same design
let ship = null, hullKey = '', lastInfo = null, lastOverlap = '', view = {coded: false, habitation: false};
const queue = [];
let running = false;
let wakeStats = null;
function waitForStats(ms) {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); if (wakeStats === done) wakeStats = null; resolve(); };
    const timer = setTimeout(done, ms);
    wakeStats = done;
  });
}

// ---------- transfer helpers ----------
function geoOut(g, transfer) {
  if (!g) return null;
  const o = {n: g.n, ni: g.ni, pos: g.pos.slice(0, g.n * 3), nor: g.nor.slice(0, g.n * 3), uv: g.uv.slice(0, g.n * 2), col: g.col.slice(0, g.n * 4), idx: g.idx.slice(0, g.ni)};
  if (transfer) transfer.push(o.pos.buffer, o.nor.buffer, o.uv.buffer, o.col.buffer, o.idx.buffer);
  return o;
}
function linesOut(l, transfer) { if (!l) return null; const o = {pos: l.pos.slice(), col: l.col.slice()}; if (transfer) transfer.push(o.pos.buffer, o.col.buffer); return o; }
// The editor's report needs totals and settings. Geometry and compiled
// reservations already travel in their own source/cache payloads.
function surfaceReportOut(report){
 if(!report)return null;
 return {...report,patches:(report.patches||[]).map(p=>{const {triangles,exposedTriangles,polygon,cells,...row}=p;if(row.config){const {aggregate,...config}=row.config;row.config=config;}return row;})};
}
const overlapSig = (info) => info ? Object.keys(info).filter(k => info[k] && info[k].overlap).sort().join(',') : '';

// Caches travel to the editor with references to ship objects replaced by
// markers, so the editor can re-point them at its own objects.
const SHIP_SKIP = new Set(['_portalGeoFlat', '_lockedCache', '_building', '_aviationSyncing', '_clipEnvelope', '_geoProxy', '_client', '_armoredMaterial', '_armoredClosed']);
function packCaches(s) {
  const refs = new Map([[s, {$r: 'ship'}]]);
  for (const l of ['parts', 'fits', 'hatches']) for (const it of s[l]) refs.set(it, {$r: l, id: it.id});
  const memo = new Map();
  const conv = (v, key) => {
    if (key === 'geoFlat' || key === 'exposedTriangles') return undefined;
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
    // Native compartment caches can refer back to the common simulation view.
    // On the editor side that reference must resolve to the source design.
    if (v._surfaceSource === s) return {$r: 'ship'};
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
  // Face picking and outlines use the same completed exposure survey as the
  // mesh. Keep it in the worker snapshot so pointer events never clip all the
  // ship's faces again. Configurations remain the editor's current settings.
  out.geoProxy.surfaces = C.surfacePatches(s).map(({config, exposedTriangles, ...p}) => ({...conv(p), exposedTriangles: conv(exposedTriangles)}));
  out.geoProxy.surfacePartitions = JSON.stringify(s.surfaces?.partitions || null);
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
    const hullSurfaces=(ship.surfaces?.patches||[]).filter(p=>p.id.startsWith('hull:')).map(p=>[p.id,p.functionMode]);
    const key = (ship._cache && ship._cache.key) + JSON.stringify([ship.hullSkin || null, ship.paint || null, ship.detail ?? 1,hullSurfaces,ship.surfaces?.partitions||null]);
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

// v13 LOAD The public state a build has just derived the ship to: when the editor sends that same state back to
// open it, the compartments and mounts are already settled and are not derived a second time (2–3 s for an ISD).
let settledState = null;
function applyState(job) {
  shipGen++;
  if (job.reset || !ship) {
    if (!(ship && C.publicJSON(ship) === job.state)) { ship = JSON.parse(job.state); hullKey = ''; lastInfo = null; lastOverlap = ''; settledState = null; }
  } else { C.patchShip(ship, JSON.parse(job.state)); settledState = null; }
}
function deriveState(job) {
  const what = new Set(job.what || []);
  const any = (...k) => k.some(w => what.has(w));
  const flags = {hull: false, parts: false, hatches: false, fits: false};
  if (job.reset || any('hull', 'all', 'hatches')) flags.hull = flags.parts = flags.hatches = flags.fits = true;
  if (any('parts')) flags.parts = flags.hatches = flags.fits = true;
  if (any('fits')) flags.fits = flags.parts = true;
  if (any('view')) flags.parts = true;
  // Moving exposed structures can reveal or cover a configured hull patch.
  // Its removed skin must be rebuilt together with the equipment, even when
  // the hull's physical collision geometry has not changed.
  if(any('parts','fits')&&(ship.surfaces?.patches||[]).some(p=>p.id.startsWith('hull:')&&p.functionMode==='equipment')){flags.hull=true;hullKey='';}
  const sync = job.reset || any('hull', 'all', 'parts', 'fits', 'hatches');
  const mount = job.reset || any('hull', 'all', 'parts', 'hatches');
  const t0 = now(), settled = settledState !== null && settledState === job.state; settledState = null;
  if (sync && !settled) C.syncCompartments(ship);
  if (mount && !settled) { C.remount(ship); C.syncCompartments(ship); }
  return {flags, syncMs: now() - t0, touched: sync || mount};
}
function finishGeometry(job, out) {
  // Build the ray-cast hierarchy here so the editor never has to.
  try { C.rayEnv(ship, [ship.hull.L / 2, 1e7, 0], [0, -1, 0]); } catch (e) { /* empty hull */ }
  const t0 = now();
  out.state = C.publicJSON(ship);
  if(ship.surfaces)out.surfaceReport=surfaceReportOut(C.surfaceReport(ship));
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
  if (queue.some(j => j.type === 'update')) return;
  if (delay > 0) await waitForStats(delay);
  if (queue.some(j => j.type === 'update')) return;
  const t1 = now();
  const S = C.computeStats(ship);
  lastInfo = S.info;
  const profile = C.fleetProfile(S, ship.name, ship);
  lastStats = {S, profile, gen: shipGen};
  const msg = {type: 'stats', gen: job.gen, stats: S.surface?{...S,surface:surfaceReportOut(S.surface)}:S, profile, statsMs: now() - t1};
  const transfer = [];
  if (overlapSig(S.info) !== lastOverlap) {
    const m = meshPartsRanged(ship, {coded: !!view.coded, info: lastInfo, habitation: !!view.habitation});
    msg.geos = {}; for (const k of Object.keys(m.g)) msg.geos[k] = geoOut(m.g[k], transfer);
    msg.glow = m.glow; msg.ranges = m.ranges || null; lastOverlap = overlapSig(lastInfo);
  }
  post(msg, transfer);
}

// ---------- v13 LOAD persistent cache of built designs ----------
// Building a large example takes 10–30 s and its performance figures up to 15 s more, on every visit. What a
// build produces (the design's public state, its stats, fleet profile and serialized form; 0.1–0.5 MB) is kept in
// IndexedDB, so a design built once loads again in seconds: only its compartments and meshes are re-derived.
// (Measured on the example ISD in a phone-sized browser: worker fleet build 7.5 s -> 0.07 s on a repeat visit.)
// Meshes are 2–30 MB a ship; they are stored only where making them took long on this device (a Venator's, with
// its sliding hangar doors, 12 s here), under a budget of their own. Records are keyed by the example key or a
// hash of the serialized design and stamped with a SHA-256 of the sources this engine runs (reference and model
// data, core, gfx, engine; read back from the HTTP cache once per session): any change of code or data drops the
// old records. Without IndexedDB, fetch or those files (a blob or file:// worker), or on any storage error, the
// cache is off and designs are built as before. Limits (provisional): builds 120 records / 60 MB,
// meshes 24 records / 200 MB (kept when they took 1.5 s or more); the least recently used go first.
let BUILD = null;
const DISK = {open: null, db: null, off: typeof indexedDB === 'undefined' || typeof fetch === 'undefined', MAX: 120, BYTES: 60e6, GEO_MAX: 24, GEO_BYTES: 200e6, GEO_MS: 1500, hits: 0, puts: 0};
// The files the engine was built from: next to the worker script, or as the page lists them for an inline engine.
function engineSources() {
  try {
    if (typeof importScripts === 'function' && self.location && /\/worker\.js(\?|$)/.test(self.location.href)) return ['../data/reference.js', '../data/imperial2.js', 'core.js', 'gfx.js', 'engine.js'].map(u => new URL(u, self.location.href).href);
    const F = typeof window !== 'undefined' && window.KS_FILES;
    if (F && F.engine && /^https?:/.test(location.protocol)) return [F.data[0], F.data[2], F.core, F.gfx, F.engine].map(u => new URL(u, document.baseURI).href);
  } catch (e) {}
  return null;
}
async function buildStamp() {
  const urls = engineSources(); if (!urls || !(typeof crypto !== 'undefined' && crypto.subtle)) return null;
  const parts = await Promise.all(urls.map(u => fetch(u, {cache: 'force-cache'}).then(r => { if (!r.ok) throw new Error(u); return r.arrayBuffer(); })));
  const sums = await Promise.all(parts.map(b => crypto.subtle.digest('SHA-256', b)));
  const all = new Uint8Array(sums.length * 32); sums.forEach((h, i) => all.set(new Uint8Array(h), i * 32));
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', all)).slice(0, 10), x => x.toString(16).padStart(2, '0')).join('');
}
function diskOpen() {
  if (DISK.off) return Promise.resolve(null);
  if (!DISK.open) DISK.open = buildStamp().catch(() => null).then((stamp) => new Promise((resolve) => {
    if (!stamp) { DISK.off = true; resolve(null); return; } BUILD = stamp;
    let done = false; const fin = (db) => { if (done) { if (db && db !== DISK.db) try { db.close(); } catch (e) {} return; } done = true; if (!db) DISK.off = true; DISK.db = db; resolve(db); };
    setTimeout(() => fin(null), 4000);
    try {
      const rq = indexedDB.open('ks-built', 1);
      rq.onupgradeneeded = () => { try { const db = rq.result; db.createObjectStore('rec', {keyPath: 'id'}); db.createObjectStore('meta', {keyPath: 'id'}); } catch (e) {} };
      rq.onsuccess = () => { const db = rq.result; db.onversionchange = () => { try { db.close(); } catch (e) {} DISK.off = true; DISK.db = null; }; fin(db); diskTrim(db); };
      rq.onerror = () => fin(null); rq.onblocked = () => fin(null);
    } catch (e) { fin(null); }
  }));
  return DISK.open;
}
const idbRun = (db, mode, fn) => new Promise((resolve) => {
  try { const tx = db.transaction(['rec', 'meta'], mode); let out = null; fn(tx.objectStore('rec'), tx.objectStore('meta'), (v) => { out = v; }); tx.oncomplete = () => resolve(out); tx.onerror = tx.onabort = (e) => { if (e && e.preventDefault) e.preventDefault(); resolve(null); }; } catch (e) { resolve(null); }
});
async function diskGet(id, depth = 0) {
  const db = await diskOpen(); if (!db) return null;
  const r = await idbRun(db, 'readwrite', (rec, meta, set) => { const q = rec.get(id); q.onsuccess = () => { const v = q.result; set(v || null); if (v && v.v === BUILD) meta.put({id, v: BUILD, at: Date.now(), size: v.size || 0, geo: !!v.geometry}); }; });
  if (!r || r.v !== BUILD) return null;
  if (r.alias) return depth ? null : diskGet(r.alias, 1);
  DISK.hits++; return r;
}
// The record is copied into the store at once (meshes are handed to the editor right after, which empties them).
function diskPut(r) {
  const db = DISK.db; if (!db || DISK.off) return;
  try {
    r.v = BUILD;
    if (!r.size) r.size = (r.state ? r.state.length : 0) + (r.serial || r.stats || r.profile ? JSON.stringify([r.serial || 0, r.stats || 0, r.profile || 0]).length : 0) + 100;
    const tx = db.transaction(['rec', 'meta'], 'readwrite');
    tx.objectStore('rec').put(r); tx.objectStore('meta').put({id: r.id, v: BUILD, at: Date.now(), size: r.size, geo: !!r.geometry});
    tx.oncomplete = () => { DISK.puts++; diskTrim(db); }; tx.onerror = tx.onabort = (e) => { if (e && e.preventDefault) e.preventDefault(); };
  } catch (e) { /* not cached */ }
}
// Meshes as the engine sends them; their size in bytes.
function geoBytes(g) { let n = 0; for (const m of Object.values(g.meshes)) { const x = m.geo; if (x) for (const k of ['pos', 'nor', 'uv', 'col', 'idx']) if (x[k]) n += x[k].byteLength; } return n; }
// Records of other builds go at once; then the oldest until each kind is within its limits.
let trimming = false;
async function diskTrim(db) {
  if (trimming) return; trimming = true;
  try {
    const all = await idbRun(db, 'readonly', (rec, meta, set) => { const q = meta.getAll(); q.onsuccess = () => set(q.result || []); });
    if (!all) return;
    const drop = all.filter(m => m.v !== BUILD).map(m => m.id), keep = all.filter(m => m.v === BUILD).sort((a, b) => b.at - a.at);
    const used = {r: [0, 0], g: [0, 0]};
    for (const m of keep) { const u = used[m.geo ? 'g' : 'r']; u[0]++; u[1] += m.size || 0; if (m.geo ? u[0] > DISK.GEO_MAX || u[1] > DISK.GEO_BYTES : u[0] > DISK.MAX || u[1] > DISK.BYTES) drop.push(m.id); }
    if (drop.length) await idbRun(db, 'readwrite', (rec, meta) => { for (const id of drop) { rec.delete(id); meta.delete(id); } });
  } finally { trimming = false; }
}

async function handleBuild(job) {
  const t0 = now();
  // v13 LOAD A design built on an earlier visit comes from the disk cache; its state is already mounted, so only its
  // compartments are re-derived (see rehydrate). The editor's reset with this same state then derives nothing again.
  let b = null, src = 'built';
  const disk = await diskGet('k:' + job.key);
  if (disk && disk.state) { try { b = JSON.parse(disk.state); C.syncCompartments(b); src = 'disk'; } catch (e) { b = null; } }
  if (!b) { b = C.buildDesign(job.key); C.syncCompartments(b); C.remount(b); C.syncCompartments(b); }
  ship = b; shipGen++; hullKey = ''; lastInfo = null; lastOverlap = '';
  const state = settledState = C.publicJSON(ship);
  post({type: 'built', id: job.id, key: job.key, state, ms: now() - t0, src});
  if (src === 'built') diskPut({id: 'k:' + job.key, state});
}

let trialHold = null;
// Clearance needs the physical host shells and the face's virtual gun ports.
// Internal aggregate resource adapters are already contained by those shells.
function trialSurfaceShip(source){
 const work=typeof C.surfaceWorkingShip==='function'?C.surfaceWorkingShip(source):source;
 return work===source?source:{...work,parts:source.parts};
}
// Clearance uses the same rigid S-foil pose as the visible trial ship. The worker owns the
// normalized source design; requests supply only deployment fractions for its existing roots.
function trialRayPose(t,requested){
 const roots=t.foils||(t.foils=t.ship.parts.filter(C.isFoil)),fractions=roots.map(w=>{const value=requested&&Object.hasOwn(requested,w.id)?requested[w.id]:1;return Number.isFinite(value)?C.clamp(value,0,1):1;});
 if(fractions.every(d=>d===1))return t;
 const key=fractions.join(','),poses=t.poses||(t.poses=new Map());if(poses.has(key)){const hit=poses.get(key);poses.delete(key);poses.set(key,hit);return hit;}
 const posed=trialSurfaceShip(JSON.parse(C.publicJSON(t.ship))),partIndex=new Map(posed.parts.map((p,i)=>[p.id,i])),fitIndex=new Map(posed.fits.map((f,i)=>[f.id,i])),sourceParts=new Map(t.ship.parts.map(p=>[p.id,p])),sourceFits=t.fits;
 const usedParts=new Set(),usedFits=new Set();
 for(let i=0;i<roots.length;i++){
  const wing=roots[i],members=C.wingMembers(t.ship,wing),ownedParts=new Set([wing,...members.structs,...members.parts].filter(p=>!usedParts.has(p.id)).map(p=>p.id)),ownedFits=new Set(members.fits.filter(f=>!usedFits.has(f.id)).map(f=>f.id));
  for(const id of ownedParts)usedParts.add(id);for(const id of ownedFits)usedFits.add(id);if(fractions[i]===1)continue;
  const angle=wing.wing.stow+(wing.wing.open-wing.wing.stow)*fractions[i],frame=C.foilFrame(t.ship,wing),rotate=v=>C.sub(C.foilAt(frame,wing,C.add(frame.pv,v),angle),frame.pv),pose=C.foilPose(t.ship,wing,angle);
  if(!pose)continue;
  for(const part of pose.parts)if(ownedParts.has(part.id)&&partIndex.has(part.id)){
   const copy=JSON.parse(C.publicJSON(part)),source=sourceParts.get(part.id);if(!C.isShapePart(source)){
    if(source.dir)copy.dir=C.norm(rotate(source.dir));
    if(source.room||C.PARTS[source.k]?.shape==='cube'){
     const original=C.structFrame(source),up=C.norm(rotate(original.up)),fw=rotate(original.fw);let base=C.sub([1,0,0],C.mul(up,up[0]));if(C.len(base)<.001)base=C.sub([0,0,1],C.mul(up,up[2]));base=C.norm(base);
     copy.surfaceNormal=up;copy.yaw=Math.atan2(C.dot(fw,C.cross(base,up)),C.dot(fw,base))*180/Math.PI;delete copy.pitch;delete copy.roll;
    }
   }
   posed.parts[partIndex.get(copy.id)]=copy;
  }
  for(const fit of pose.fits)if(ownedFits.has(fit.id)&&fitIndex.has(fit.id)){
   // fitUp reads tilt, not n. Rebuild it from the original mount frame, without inherited
   // bounds/spec caches or remounting the gun onto a different structure in the folded pose.
   const copy=JSON.parse(C.publicJSON(fit)),source=sourceFits.get(fit.id),original=C.fitFrameOf(source);copy.tilt=C.norm(rotate(C.fitUp(source)));copy.n=C.norm(rotate(source.n||C.fitUp(source)));
   const current=C.fitFrameOf(copy),fw=rotate(original.fw),yaw=Math.atan2(C.dot(fw,current.rt),C.dot(fw,current.fw))*180/Math.PI;if(Math.abs(yaw)>1e-8)copy.assetYaw=(source.assetYaw||0)+yaw;
   delete copy.local;delete copy.localNormal;posed.fits[fitIndex.get(copy.id)]=copy;
  }
 }
 for(const part of posed.parts)if(C.isShapePart(part))part._solidCutShip=posed;
 const result={ship:posed,ctx:C.turretRayContext(posed),fits:new Map(posed.fits.map(f=>[f.id,f]))};poses.set(key,result);while(poses.size>3)poses.delete(poses.keys().next().value);return result;
}
function handleTrialRays(job) {
 const valid=a=>Array.isArray(a)||ArrayBuffer.isView(a)&&Number.isInteger(a.length),ids=valid(job.ids)?Array.from(job.ids).slice(0,C.DESIGN_LIMITS.fits):[],dirs=valid(job.dirs)?job.dirs:[],out=new Uint8Array(ids.length),held=trialHold,t=held&&trialRayPose(held,job.foils);
 if(t)for(let i=0;i<ids.length;i++){
  const dir=[dirs[i*3],dirs[i*3+1],dirs[i*3+2]],f=Number.isSafeInteger(ids[i])&&t.fits.get(ids[i]);
  if(f&&dir.every(Number.isFinite)&&C.len(dir)>1e-8)out[i]=C.turretClear(t.ship,f,C.norm(dir),t.ctx,job.muzzles?.[i])?1:0;
 }
 post({type:'trialRays',id:job.id,clear:out,ready:!!t});
}
// Built fleet ships are kept for a while: a fleet battle asks for the same
// design again (its 3D model, then the turrets when it is flown), and building
// a large example takes tens of seconds. Very large designs are not kept.
const fleetBuilt = new Map(), FLEET_KEEP = 4;
const designHash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };
// A built design from its public state (what the editor holds): the same steps as opening it in the designer.
// A stored state is already mounted, so its compartments alone are re-derived. Checked against the build on the
// old tree: identical meshes and profile for gozanti, cr90 and venator; the ISD's profile within 1e-6 relative and
// meshes within float noise (hull 7 cm, a hangar face 2 m), as when a saved draft is reopened.
function rehydrate(state, paint) { const d = JSON.parse(state); if (paint) d.paint = paint; C.syncCompartments(d); if (paint) { C.remount(d); C.syncCompartments(d); } return d; }
const recShip = (rec) => rec.d || (rec.d = rehydrate(rec.state, rec.paint));
// job.lite: the caller has the fleet profile already (the precomputed examples of a fleet battle) and needs only the
// 3D model, so the performance figures (seconds for a large ship) are left until a request needs them; a design
// with configured surfaces still gets its profile (its model is centred by it). job.statsOnly: the figures of a
// design whose model the caller already has. A record holds the built ship (d) only once something needs it.
function handleCraftPrice(job){
 const d=C.deserialize(job.design);C.syncCompartments(d);C.remount(d);C.syncCompartments(d);
 const stats=C.computeStats(d);post({type:'craftPrice',id:job.id,price:{...C.designCost(stats),costBy:stats.costBy,crewCount:stats.crew,version:C.COST_MODEL.version}});
}
// (A plain function: the fleet job itself waits on the disk cache.)
function handleFleet(job) { return fleetJob(job); }
async function fleetJob(job) {
  const t0 = now();
  const djson = job.key ? '' : JSON.stringify(job.design), dkey = job.key ? 'k:' + job.key + (job.paint ? '#' + job.paint : '') : 'd:' + designHash(djson);
  let rec = fleetBuilt.get(dkey), src = rec ? 'memory' : '', save = false;
  if (rec) { fleetBuilt.delete(dkey); fleetBuilt.set(dkey, rec); }
  else {
    rec = null;
    // v13 LOAD The design on the drawing board (a trial flight): its figures are already computed here. A copy of
    // the editor's ship is flown, so later edits do not reach the cached one.
    if (djson && ship && lastStats && lastStats.gen === shipGen && JSON.stringify(C.serialize(ship)) === djson) {
      try { const state = C.publicJSON(ship); rec = {d: rehydrate(state), state, stats: lastStats.S, profile: lastStats.profile, serial: job.design}; src = 'editor'; save = true; } catch (e) { rec = null; }
    }
    // v13 LOAD the disk cache: the record of this design, or (a repainted example) the plain example's build.
    if (!rec) {
      const disk = (await diskGet(dkey)) || (job.key && job.paint ? await diskGet('k:' + job.key) : null);
      if (disk && disk.state) {
        const own = disk.id === dkey;
        rec = {d: null, state: disk.state, paint: own ? null : job.paint, stats: own && disk.profile ? disk.stats : null, profile: own ? disk.profile || null : null, serial: own ? disk.serial || null : null};
        src = 'disk'; save = !(own && rec.stats && rec.serial);
        if (!own) { try { recShip(rec); rec.state = C.publicJSON(rec.d); rec.paint = null; } catch (e) { rec = null; } }
      }
    }
    if (!rec) {
      const d = job.key ? C.buildDesign(job.key) : C.deserialize(job.design); if (job.paint) d.paint = job.paint;
      C.syncCompartments(d); C.remount(d); C.syncCompartments(d);
      rec = {d, state: C.publicJSON(d), stats: null, profile: null, serial: null}; src = 'built'; save = true;
    }
    if (!rec.serial) rec.serial = C.serialize(recShip(rec));
    rec.alias = 'd:' + designHash(JSON.stringify(rec.serial)); rec.surfaces = !!rec.serial.surfaces;
    const big = rec.d ? rec.d.parts.length + rec.d.fits.length >= 3000 : rec.state.length > 4e6;
    if (!big) { fleetBuilt.set(dkey, rec); fleetBuilt.set(rec.alias, rec); while (fleetBuilt.size > FLEET_KEEP * 2) fleetBuilt.delete(fleetBuilt.keys().next().value); }
  }
  const lite = !!job.lite && !rec.surfaces;
  if (!lite && !rec.stats) { const d = recShip(rec); rec.stats = C.computeStats(d); rec.profile = C.fleetProfile(rec.stats, d.name, d); save = true; }
  const {stats, profile, serial} = rec;
  if (job.statsOnly) post({type: 'fleet', id: job.id, stats, profile, design: serial, ms: now() - t0, src});
  else {
    // Meshes that took long to make come from the disk cache (see above); others are made again.
    const transfer = [], gid = 'g|' + dkey + (job.trial ? '|t' : '|m');
    const stored = DISK.db ? await diskGet(gid) : null;
    let geometry = stored && stored.geometry || null;
    if (geometry) { for (const m of Object.values(geometry.meshes)) if (m.geo) for (const k of ['pos', 'nor', 'uv', 'col', 'idx']) if (m.geo[k]) transfer.push(m.geo[k].buffer); }
    else {
      const tg = now(); geometry = G.fleetGeometry(recShip(rec), {trial: !!job.trial, ...(profile?.surface?.offset ? {center: profile.surface.offset} : {})});
      for (const m of Object.values(geometry.meshes)) { m.geo = geoOut(m.geo, transfer); }
      const gms = now() - tg;
      if (gms >= DISK.GEO_MS) { const size = geoBytes(geometry); if (size < DISK.GEO_BYTES / 4) diskPut({id: gid, geometry, size, ms: Math.round(gms)}); }
    }
    post({type: 'fleet', id: job.id, stats: lite ? null : stats, profile: lite ? null : profile, geometry, design: serial, ms: now() - t0, cached: src === 'memory', src, geoCached: !!stored}, transfer);
  }
  // After the reply, so the loading screen does not wait for them: the trial keeps its ship here so turret rays can
  // be tested against it (ray requests queue behind this and answer once it is ready), and the build goes to disk.
  if (job.trial && !job.statsOnly) { const rays = trialSurfaceShip(recShip(rec)); trialHold = {ship: rays, ctx: C.turretRayContext(rays), fits: new Map(rays.fits.map(f => [f.id, f]))}; }
  if (save) {
    diskPut({id: dkey, state: rec.state, stats: rec.stats, profile: rec.profile, serial});
    if (rec.alias !== dkey) diskPut({id: rec.alias, alias: dkey});
  }
}

function handleOp(job) {
  applyState(job);
  C.syncCompartments(ship);
  let result = null;
  switch (job.op) {
    case 'fillHangars': result = C.fillHangars(ship, ...job.args); break;
    case 'surfaceAuto': result = C.autoConfigureSurfaces(ship, job.args?.[0] || {}); break;
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
        else if (job.type === 'build') await handleBuild(job);
        else if (job.type === 'fleet') await handleFleet(job);
        else if (job.type === 'craftPrice') handleCraftPrice(job);
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
    // An edit should not wait for the previous generation's stats debounce.
    if (wakeStats) wakeStats();
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
return {listenWorker, connectInline, packCaches, disk: DISK};
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
