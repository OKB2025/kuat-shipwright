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
let inlineHost = false;
let wakeStats = null;
// Placement previews are independent transactions. They never replace the
// worker's current design, and their results are valid only for the operation
// and source generation that requested them.
let placementSequence = 0;
const placementOperations = new Map(), placementDesignGenerations = new Map();
// This isolated source mirror keeps the selected parent's exact mesh warm
// between stamps. It is never the statistics engine's authoritative ship.
let placementSource = null;
function placementCandidate(job) {
  const candidate = typeof job.state === 'string' ? JSON.parse(job.state) : JSON.parse(JSON.stringify(job.state));
  if (!candidate || !Array.isArray(candidate.parts)) throw new Error('Invalid placement source design');
  const globals = JSON.stringify(candidate, (key, value) => key[0] === '_' || key === 'parts' || key === 'fits' || key === 'nextId' ? undefined : value);
  const previous = placementSource?.designId === job.designId && placementSource.globals === globals ? placementSource.parts : null, parts = new Map();
  candidate.parts = candidate.parts.map(part => {
    const signature = JSON.stringify(part), old = previous?.get(part.id);
    // Refresh may repair metadata on its temporary branch. Such public edits
    // cannot be carried into a later snapshot that never authored them.
    const unchanged = old?.signature === signature && JSON.stringify(old.part, (key, value) => key[0] === '_' ? undefined : value) === signature;
    const value = unchanged ? old.part : part;
    parts.set(part.id, {signature, part: value}); return value;
  });
  // Cached meshes belong to this snapshot's cut/occupancy context. Rebind
  // ship references rather than retaining older complete design graphs.
  for (const part of candidate.parts) { part._solidCutShip = candidate; if (part._envelope) part._envelope = candidate; }
  placementSource = {designId: job.designId, globals, parts};
  candidate.fits ||= [];
  return candidate;
}
const placementOperationKey = job => JSON.stringify([job.designId, job.operationId]);
const isPlacementJob = job => job.type === 'placement' || job.type === 'trenchArmament';
function placementGeneration(job) {
  if (job.designId == null || !Number.isSafeInteger(job.gen) || job.gen < 0) return;
  const prior = placementDesignGenerations.get(job.designId);
  if (prior == null || job.gen > prior) placementDesignGenerations.set(job.designId, job.gen);
  while (placementDesignGenerations.size > 128) placementDesignGenerations.delete(placementDesignGenerations.keys().next().value);
}
function placementCurrent(job) {
  const operation = placementOperations.get(placementOperationKey(job));
  return operation && !operation.cancelled && operation.sequence === job.placementSequence &&
    placementDesignGenerations.get(job.designId) === job.gen;
}
function resolvePlacementSurface(candidate, part, request, list, parentId) {
  // Early authoring meshes permit a real native pick before the expensive
  // ship-wide exposure survey. Bind that exact hit to a stable semantic face
  // here, on the selected parent only. An explicitly supplied lost face is
  // still rejected by Core; saved references are never silently reassigned.
  if (request.hostSurfaceId != null || !request.hit || parentId == null || typeof C.surfacePatches !== 'function' || typeof C.rayTris !== 'function') return {request};
  const capability = C.placementCapability(part), mode = request.mode || part.placement?.mode || capability.allowedModes[0];
  if (list !== 'fits' && capability.space !== 'exterior' || !capability.allowedModes.includes(mode)) return {request};
  const point = request.hit.p, normal = request.hit.n;
  if (![point, normal].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) || C.len(normal) < 1e-12) return {request};
  const parent = candidate.parts.find(p => p.id === parentId);
  if (!parent) return {request};
  const bounds = C.partAABB(parent), extent = Math.max(...[0, 1, 2].map(i => bounds[i + 3] - bounds[i]));
  const tolerance = C.PLACEMENT_TOLERANCES, reach = Math.max(tolerance.coordinate, extent * tolerance.relativeCoordinate) * 64;
  const n = C.norm(normal), origin = C.add(point, C.mul(n, reach)), patches = C.surfacePatches(candidate, true, false, new Set(['p' + parentId]));
  const matches = [];
  for (const patch of patches) {
    const hit = C.rayTris(patch.triangles, origin, C.mul(n, -1), reach * 2);
    if (hit && C.dot(hit.n, n) > .5) matches.push({patch, distance: C.len(C.sub(hit.p, point))});
  }
  matches.sort((a, b) => a.distance - b.distance || a.patch.id.localeCompare(b.patch.id));
  if (!matches.length) return {failure: {ok: false, code: 'surface-missing', error: '指定した追加元の実形状に取付面がありません。面を選び直してください'}};
  // Do not snap the point or relax Core's contact tolerance: the original
  // authored-mesh hit undergoes the same strict shape/contact checks below.
  return {request: {...request, hostSurfaceId: matches[0].patch.id}};
}
function placementEffectiveGeometry(part) {
  const fields = {
    placement: ['local', 'volume', 'area'],
    clip: ['tris', 'volume', 'area', 'bounds', 'requestedVolume', 'retained', 'explicitPlacement'],
    packing: ['tris', 'volume', 'area', 'boxes', 'bounds', 'requestedVolume', 'retained', 'cell', 'limited', 'searchLimited']
  }, out = {};
  for (const [kind, keys] of Object.entries(fields)) {
    const cache = part?.[kind === 'placement' ? '_placementGeometry' : '_' + kind];
    if (cache) out[kind] = Object.fromEntries(keys.filter(key => cache[key] !== undefined).map(key => [key, cache[key]]));
  }
  return out;
}
function placementReply(job, result, extra = {}) {
  const r = job.request || {};
  // Solver meshes are public authoring geometry; private caches can point at
  // the complete temporary ship. Do not send those graphs back with a ghost.
  const publicResult = result == null ? null : JSON.parse(JSON.stringify(result, (key, value) => key[0] === '_' ? undefined : value));
  if (result?.ok) {
    publicResult.effectiveGeometry = placementEffectiveGeometry(result.part);
    if (result.results) publicResult.results.forEach((row, i) => { row.effectiveGeometry = placementEffectiveGeometry(result.results[i].part); });
  }
  post({type: job.type === 'trenchArmament' ? 'trenchArmament' : 'placement', id: job.id, gen: job.gen, designId: job.designId, operationId: job.operationId,
    partId: r.partId ?? r.part?.id, fitId: r.fitId ?? r.fit?.id,
    entityKind: r.entityKind ?? (r.list === 'fits' || r.fit || r.part?._fit ? 'fit' : 'part'),
    list: r.list ?? (r.fit || r.part?._fit ? 'fits' : 'parts'), parentStructureId: r.parentStructureId, hostId: r.hostId,
    geometryRevision: r.geometryRevision, parentGeometryRevision: r.parentGeometryRevision,
    placementModelVersion: r.placementModelVersion, result: publicResult, ...extra});
}
function cancelPlacement(job) {
  const key = placementOperationKey(job), operation = placementOperations.get(key);
  if (operation) operation.cancelled = true;
  for (let i = queue.length - 1; i >= 0; i--) {
    const queued = queue[i];
    if (isPlacementJob(queued) && placementOperationKey(queued) === key) {
      queue.splice(i, 1); placementReply(queued, null, {cancelled: true, stale: true});
    }
  }
}
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
  const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(let i=0;i<o.n*3;i+=3)for(let a=0;a<3;a++){const v=o.pos[i+a];if(v<bounds[a])bounds[a]=v;if(v>bounds[a+3])bounds[a+3]=v;}
  o.bounds=o.n?bounds:null;o.boundsVertexCount=o.n;
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
// Display projections are prepared with the worker's current derived caches.
// The interface receives values, never another physics job in a render callback.
function catalogueAccelerationG(S){const rated=S?.propulsion?.ratedAccelMps2??S?.ratedAccelMps2,limit=S?.propulsion?.accelerationLimitMps2??S?.maximumAccelMps2,a=Number.isFinite(rated)&&Number.isFinite(limit)?Math.min(rated,limit):Number.isFinite(limit)?limit:rated;return Number.isFinite(a)?Math.max(0,a)/C.G0:Math.max(0,S?.accelG||0);}
function catalogueValues(stats,design){
 if(!stats)return stats;const work=design&&C.surfaceWorkingShip?C.surfaceWorkingShip(design):design,parts=work?.parts||[],fits=work?.fits||[],shields=parts.filter(p=>['shield','localShield'].includes(p.k)&&!p.surfaceUnplaced),weapons=fits.filter(f=>C.FITS[f.k]?.cat==='w'&&!f.float&&!f.surfaceUnplaced).map(f=>({fit:f,spec:C.fitSpec(f)})),power=Number.isFinite(stats.powerNominal)?stats.powerNominal:parts.length?parts.reduce((n,p)=>n+(C.isReactor(p)?C.reactorPower(p):0)+(C.solarPower?.(p)||0),0):stats.power||0,shieldP=parts.length?shields.reduce((n,p)=>n+C.partVolume(p)*C.K.shieldW,0):stats.shieldP||0,shieldCapacity=parts.length?shields.reduce((n,p)=>n+C.shieldLoad(p),0):stats.shieldCapacity||0,alpha=[0,0,0,0,0,0],bandRate=Object.fromEntries(Object.keys(C.GUN_BANDS).map(k=>[k,[0,0,0,0,0,0]]));
 let alphaTot=0,ionTot=0,heavyAlpha=0;for(const{fit,spec}of weapons){if(spec.msl)continue;const tt=spec.tt||0,ion=spec.ion||0,arc=stats.fitInfo?.[fit.id]||[0,0,0,0,0,0],band=bandRate[C.fitBand(spec)];alphaTot+=tt;ionTot+=ion;if(Math.max(tt,ion)>=10)heavyAlpha+=Math.max(tt,ion);for(let k=0;k<6;k++){alpha[k]+=tt*(arc[k]||0);if(band)band[k]+=tt*(arc[k]||0)/(spec.cycle||C.K.cycle);}}
 const mounted=Array.isArray(work?.fits),a=mounted?alpha:stats.alpha||alpha,total=mounted?alphaTot:stats.alphaTot||0,best=Math.max(...a),rated=stats.propulsion?.ratedAccelMps2??stats.ratedAccelMps2;
 return {power,xISD:power/C.ISD_W,accelG:catalogueAccelerationG(stats),aThrust:Number.isFinite(rated)?Math.max(0,rated):stats.aThrust,thrustG:Number.isFinite(rated)?Math.max(0,rated)/C.G0:stats.thrustG,shieldP,shieldPct:stats.area>0?shieldP/stats.area/C.K.shieldStd:0,shieldCapacity,alpha:a,alphaTot:total,alphaBest:best,alphaMean:a.reduce((n,v)=>n+v,0)/6,ionTot:mounted?ionTot:stats.ionTot||0,allGunVolleyTT:mounted?alphaTot+ionTot:stats.allGunVolleyTT??total+(stats.ionTot||0),heavyAlpha:mounted?heavyAlpha:stats.heavyAlpha,arcEff:total>0?best/total:0,bandRate:mounted?bandRate:stats.bandRate};
}
function statsOut(S,design){return {...S,...(S.surface?{surface:surfaceReportOut(S.surface)}:{}),catalogue:catalogueValues(S,design)};}

const overlapSig = (info) => info ? Object.keys(info).filter(k => info[k] && info[k].overlap).sort().join(',') : '';

// Caches travel to the editor with references to ship objects replaced by
// markers, so the editor can re-point them at its own objects.
const SHIP_SKIP = new Set(['_portalGeoFlat', '_lockedCache', '_building', '_aviationSyncing', '_clipEnvelope', '_geoProxy', '_client', '_armoredMaterial', '_armoredClosed']);
const AUTHORING_SHIP_CACHES = new Set(['_cache', '_portalGeo', '_solidHull', '_referenceHull']);
function packCaches(s, options) {
  const refs = new Map([[s, {$r: 'ship'}]]);
  for (const l of ['parts', 'fits', 'hatches']) for (const it of s[l]) refs.set(it, {$r: l, id: it.id});
  const memo = new Map();
  const conv = (v, key) => {
    if (key === 'geoFlat' || key === 'exposedTriangles') return undefined;
    if (options?.authoring && key === '_lockedCache') return undefined;
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? undefined : v;
    // Native compartment caches can refer back to the common simulation view.
    // On the editor side that reference must resolve to the source design.
    if (!options?.runtime && v._surfaceSource === s) return {$r: 'ship'};
    const r = refs.get(v); if (r) return r;
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return v;
    let o = memo.get(v); if (o) return o;
    if (options?.authoring && key === '_cache') {
      o = {key: v.key, sec: new Map(), geo: null, hf: null, hfKey: ''}; memo.set(v, o);
      o.geo = conv(v.geo);
      return o;
    }
    if (v instanceof Map) { o = new Map(); memo.set(v, o); if (key === 'sec') return o; for (const [k, x] of v) o.set(options?.runtime ? conv(k) : k, conv(x)); return o; }
    if (v instanceof Set) { o = new Set(); memo.set(v, o); for (const x of v) o.add(conv(x)); return o; }
    if (Array.isArray(v)) { o = new Array(v.length); memo.set(v, o); for (let i = 0; i < v.length; i++) o[i] = conv(v[i]); return o; }
    o = {}; memo.set(v, o);
    for (const k of Object.keys(v)) { const x = v[k]; if (typeof x === 'function') continue; o[k] = conv(x, k); }
    return o;
  };
  const out = {ship: {}, items: {parts: {}, fits: {}, hatches: {}}};
  for (const k of Object.keys(s)) if (k[0] === '_' && !SHIP_SKIP.has(k) && (!options?.authoring || AUTHORING_SHIP_CACHES.has(k))) out.ship[k] = conv(s[k], k);
  for (const l of ['parts', 'fits', 'hatches']) for (const it of s[l]) {
    if (options?.authoring && (l !== 'parts' || !C.isShapePart(it))) continue;
    let o = null;
    for (const k of Object.keys(it)) if (k[0] === '_') { (o || (o = {}))[k] = conv(it[k], k); }
    if (o) out.items[l][it.id] = o;
  }
  if (options?.runtime) return out;
  // Pick geometry: the exact objects the editor's ray casts and section queries use.
  out.geoProxy = {hull: conv(C.hullGeo(s)), ref: conv(C.referenceHullGeometry(s))};
  if (!options?.runtime) {
    out.geoProxy.placementBodies = s.parts.filter(p => C.isShapePart(p)).map(p => ({parentStructureId: p.id,
      sourceKey: C.publicJSON(p), triangles: conv(C.structTriangles(p))}));
    if (!s.hull.assembly) out.geoProxy.placementBodies.push({parentStructureId: 'hull',
      sourceKey: C.publicJSON([s.hull, s.cuts || [], s.subs || [], s.trenches || [], s.solidCuts || [], s.hatches || [], s.fits.filter(f => C.isShipLauncher(f) && C.shipLauncherConfig(f).embedded)]),
      triangles: out.geoProxy.ref?.tris || out.geoProxy.hull.tris});
  }
  // Face picking and outlines use the same completed exposure survey as the
  // mesh. Keep it in the worker snapshot so pointer events never clip all the
  // ship's faces again. Configurations remain the editor's current settings.
  if (!options?.authoring && !options?.deferSurfaces) {
    out.geoProxy.surfaces = C.surfacePatches(s).map(({config, exposedTriangles, ...p}) => ({...conv(p), exposedTriangles: conv(exposedTriangles)}));
    out.geoProxy.surfacePartitions = JSON.stringify(s.surfaces?.partitions || null);
  }
  if(!options?.authoring){
    out.editor=conv({engineParts:C.enginePaths(s),commands:C.commandCompartments(s),capacitors:C.weaponCapacitors(s),missileCells:C.missileCells(s),transmission:C.engineTransmission(s),drive:C.engineDriveRoutes(s)});
  }
  return out;
}

// IndexedDB preserves typed arrays and cyclic graphs. Reconnect the cached
// machinery/shape graph to this fresh design instead of surveying it again.
function restoreCaches(s, packed) {
  if (!packed?.ship || !packed.items || typeof structuredClone !== 'function') return false;
  const c = structuredClone(packed), ids = Object.fromEntries(['parts', 'fits', 'hatches'].map(k => [k, new Map((s[k] || []).map(p => [p.id, p]))])), seen = new Set();
  const fix = v => {
    if (!v || typeof v !== 'object') return v;
    if (v.$r) return v.$r === 'ship' ? s : ids[v.$r]?.get(v.id) || null;
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer || seen.has(v)) return v;
    seen.add(v);
    if (Array.isArray(v) && v.every(x => !x || typeof x !== 'object')) return v;
    if (Object.prototype.toString.call(v) === '[object Map]') { const entries = [...v]; v.clear(); for (const [k, x] of entries) v.set(fix(k), fix(x)); }
    else if (Object.prototype.toString.call(v) === '[object Set]') { const values = [...v].map(fix); v.clear(); for (const x of values) v.add(x); }
    else for (const k of Object.keys(v)) v[k] = fix(v[k]);
    return v;
  };
  fix(c); Object.assign(s, c.ship);
  for (const k of ['parts', 'fits', 'hatches']) for (const p of s[k] || []) Object.assign(p, c.items[k]?.[p.id] || {});
  return true;
}

// Exact authored pick geometry is useful before rooms, machinery routes and
// weapon mounts have been derived. In particular an owned hull's apertures
// can take seconds to compile: never leave that first compilation to a
// pointer event on the interface thread. Plain gun edits keep this geometry.
let authoringKey = null;
function authoringGeometryKey(s) {
  return JSON.stringify([s.hull, s.parts, s.cuts, s.subs, s.trenches, s.solidCuts, s.hatches,
    s.fits.filter(f => C.isShipLauncher(f) && C.shipLauncherConfig(f).embedded),
    s.hullSkin, s.hullBands, s.reference], (k, v) => k[0] === '_' ? undefined : v);
}
function authoringGeometry(job) {
  const key = authoringGeometryKey(ship);
  if (key === authoringKey) return false;
  const started = now();
  // Aviation contacts can query structure solids while the hull is compiled.
  // Give those queries the authored global cuts on the first update too.
  for (const p of ship.parts) if (C.isShapePart(p)) p._solidCutShip = ship;
  C.hullGeo(ship);
  C.referenceHullGeometry(ship);
  for (const p of ship.parts) if (C.isShapePart(p)) {
    C.structTriangles(p);
  }
  // This also builds the hull BVH, without surveying surfaces or routes.
  C.rayEnv(ship, [ship.hull.L / 2, 1e7, 0], [0, -1, 0], {structOnly: true});
  const caches = packCaches(ship, {authoring: true, deferSurfaces: true});
  authoringKey = key;
  post({type: 'authoringGeometry', gen: job.gen, sourceState: job.state, caches, prepareMs: now() - started});
  return true;
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
    if (!(ship && C.publicJSON(ship) === job.state)) { ship = JSON.parse(job.state); hullKey = ''; authoringKey = null; lastInfo = null; lastOverlap = ''; settledState = null; }
  } else { C.patchShip(ship, JSON.parse(job.state)); settledState = null; }
}
async function deriveState(job) {
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
  const settled = settledState !== null && settledState === job.state; settledState = null;
  let syncMs = 0;
  const timed = fn => { const t = now(); fn(); syncMs += now() - t; };
  if (sync && !settled) timed(() => C.syncCompartments(ship));
  // A newer edit can arrive between the compartments and the mounts: stop here for it.
  if (mount && !settled) {
    if (sync && !settled) { await phaseYield(); if (supersede(job)) return null; }
    timed(() => { C.remount(ship); C.syncCompartments(ship); });
  }
  return {flags, syncMs, touched: sync || mount};
}
function finishGeometry(job, out, options) {
  // Build the ray-cast hierarchy here so the editor never has to.
  try { C.rayEnv(ship, [ship.hull.L / 2, 1e7, 0], [0, -1, 0]); } catch (e) { /* empty hull */ }
  const t0 = now();
  out.state = C.publicJSON(ship);
  if(ship.surfaces&&!options?.deferSurfaces)out.surfaceReport=surfaceReportOut(C.surfaceReport(ship));
  out.caches = packCaches(ship, options);
  authoringKey = authoringGeometryKey(ship);
  out.packMs = now() - t0;
}

// 2026-11-12 One edit runs in phases (placement resolution, structures, compartments, mounts, meshes,
// surfaces, statistics). Between phases the engine yields so a newer edit can be received; a
// superseded edit stops at the next boundary, hands its dirty flags to the newer one and posts
// nothing more for its generation. `abandoned` records where (tests and diagnostics).
const abandoned = [];
function phaseYield() { return new Promise(resolve => setTimeout(resolve, 0)); }
function supersede(job, phase = 'derive') {
  const next = queue.find(j => j.type === 'update');
  if (!next) return false;
  next.what = Array.from(new Set([...(job.reset ? ['all'] : job.what || []), ...(next.what || [])]));
  abandoned.push({gen: job.gen, phase}); if (abandoned.length > 32) abandoned.shift();
  return true;
}
let lastStructureHullKey = null;
function structureHullKey(s) { return JSON.stringify([s.hull, s.cuts, s.subs, s.trenches, s.solidCuts, s.hullSkin, s.hullBands], (k, v) => k[0] === '_' ? undefined : v); }
function structurePass(job) {
  const t0 = now(), transfer = [], m = G.meshStructures(ship, {coded: !!view.coded, info: lastInfo, habitation: !!view.habitation}), geos = {};
  for (const k of Object.keys(m.g)) geos[k] = geoOut(m.g[k], transfer);
  post({type: 'structureGeometry', gen: job.gen, designId: job.designId, geos, ranges: m.ranges, groups: m.groups, meshMs: now() - t0}, transfer);
}
async function yieldGeometry() {
  await new Promise(resolve => setTimeout(resolve, 0));
  if (!inlineHost) return;
  // Inline delivery itself uses a timer. Let the view paint the first mesh,
  // and accept edits posted by that delivery, before surveying every face.
  if (typeof requestAnimationFrame === 'function' && typeof document !== 'undefined' && !document.hidden) {
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 50);
      requestAnimationFrame(() => { clearTimeout(timer); setTimeout(resolve, 0); });
    });
  } else await new Promise(resolve => setTimeout(resolve, 0));
}

function placementResolution(job, resolution) {
  const lists = [['parts', resolution?.resolvedParts || []], ['fits', resolution?.resolvedFits || []]];
  if (!lists.some(([, ids]) => ids.length)) return;
  const source = typeof job.state === 'string' ? JSON.parse(job.state) : job.state, rows = [];
  for (const [list, ids] of lists) for (const id of ids) {
    const original = source?.[list]?.find(p => p.id === id), item = ship[list].find(p => p.id === id);
    if (!original || !item) continue;
    const problem = item._placementError || item._fitPlacementError || item.placement?.repairReason || item._embeddedCasingError || null;
    rows.push({list, id, sourceKey: C.placementPendingInputKey(original),
      [list === 'parts' ? 'part' : 'fit']: JSON.parse(C.publicJSON(item)),
      effectiveGeometry: placementEffectiveGeometry(item), error: typeof problem === 'string' ? problem : problem?.code || null,
      ...(item._embeddedCasingError?{cacheKeys:{_embeddedCasingError:item._embeddedCasingError,_embeddedCasingErrorKey:item._embeddedCasingErrorKey}}:{}),
      // The code alone is a string; the message and the traced reason live on the failure record.
      // A failure record is used only for the failure it describes (a later code, e.g. parent-unresolved, keeps no stale text).
      ...((failure => ({...((problem?.error || failure?.error) ? {errorMessage: problem?.error || failure.error} : {}), ...(failure?.detail ? {errorDetail: failure.detail} : {})}))(C.placementFailureRecord?.(item) && C.placementFailureRecord(item).code === (typeof problem === 'string' ? problem : problem?.code) ? C.placementFailureRecord(item) : null)),
      geometryKeys: {self: item._placementSelfKey, request: item._placementRequestKey, parent: item._placementParentKey}});
  }
  if (rows.length) post({type: 'placementResolution', designId: job.designId, gen: job.gen, rows,
    placementDraftStatus: C.placementDraftStatus(ship)});
}

async function handleUpdate(job) {
  const t0 = now();
  applyState(job);
  // Fitted source/parent revisions are resolved before authoring meshes and
  // exact picking caches are published, including the early geometry packet.
  if (typeof C.refreshPlacementGeometry === 'function') placementResolution(job, C.refreshPlacementGeometry(ship));
  if (job.view) view = job.view;
  if (authoringGeometry(job)) {
    await yieldGeometry();
    // The early mesh may already be useful to a newer plain-gun edit. Keep
    // all dirty flags when skipping the expensive obsolete engineering pass.
    if (supersede(job)) return;
  }
  // 2026-11-12 Structures first: the moved structure and its resolved attachments are shown before
  // the compartments, mounts and equipment are derived (the full geometry packet follows).
  // A hull edit (or any change to the hull profile, cuts, trenches, subs or skin) re-meshes the hull
  // and can re-cut every structure: no early structure packet then, only the full geometry.
  // The reference is the hull of the last geometry packet actually posted: a superseded hull edit
  // posts none, so the next parts-only edit still sees the hull as changed.
  const hullSame = structureHullKey(ship) === lastStructureHullKey;
  if (job.view?.structureFirst && !job.reset && hullSame && !(job.what || []).includes('hull') && (job.what || []).some(w => w === 'parts' || w === 'all')) {
    structurePass(job);
    await phaseYield();
    if (supersede(job)) return;
  }
  const d = await deriveState(job);
  if (!d) return;
  const any = Object.values(d.flags).some(Boolean);
  const deferSurfaces = job.view?.deferSurfaces === true;
  if (any || d.touched || job.reset) {
    const out = geometryPass(job, d.flags);
    finishGeometry(job, out, {deferSurfaces});
    out.syncMs = d.syncMs; out.totalMs = now() - t0;
    const transfer = out.transfer; delete out.transfer;
    post(out, transfer);
    lastStructureHullKey = structureHullKey(ship);
  } else {
    post({type: 'geometry', gen: job.gen, geos: {}, state: C.publicJSON(ship), caches: null, totalMs: now() - t0, noop: true});
  }
  if (deferSurfaces) {
    await yieldGeometry();
    if (queue.some(j => j.type === 'update')) return;
    const started = now(), out = {type: 'surfaceGeometry', gen: job.gen};
    finishGeometry(job, out);
    out.surfaceMs = now() - started; out.totalMs = now() - t0;
    post(out);
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
  const statsMs = now() - t1;
  // An edit that arrived during the calculation makes these figures obsolete: never post them.
  await phaseYield();
  if (queue.some(j => j.type === 'update')) { abandoned.push({gen: job.gen, phase: 'stats'}); return; }
  lastInfo = S.info;
  const placementDraftStatus = typeof C.placementDraftStatus === 'function' ? C.placementDraftStatus(ship) : {ok: true, ready: true, pending: [], failed: []};
  const profile = placementDraftStatus.ok ? C.fleetProfile(S, ship.name, ship) : null;
  lastStats = {S, profile, gen: shipGen};
  const msg = {type: 'stats', gen: job.gen, stats: statsOut(S,ship), profile, provisional: !placementDraftStatus.ok, placementDraftStatus, statsMs};
  const transfer = [];
  if (overlapSig(S.info) !== lastOverlap) {
    const m = meshPartsRanged(ship, {coded: !!view.coded, info: lastInfo, habitation: !!view.habitation});
    msg.geos = {}; for (const k of Object.keys(m.g)) msg.geos[k] = geoOut(m.g[k], transfer);
    msg.glow = m.glow; msg.ranges = m.ranges || null; lastOverlap = overlapSig(lastInfo);
  }
  post(msg, transfer);
}

// ---------- v13 LOAD persistent cache of built designs ----------
// Persist the settled design, native machinery/shape caches, full statistics,
// display projections, combat profile and every completed mesh variant. Warm
// fleet loads need only IndexedDB reads and GPU upload, not compartment, stats
// or mesh regeneration. Canonical blueprint aliases share the original bundle.
// Source stamps come from the exact startup snapshot; changed physics/render
// code or data invalidates prior results. Missing/failed storage falls back to
// ordinary builds. LRU budgets: 120 build records / 256 MB; 64 meshes / 512 MB.
let BUILD = null;
const DISK = {open: null, db: null, off: typeof indexedDB === 'undefined', MAX: 240, BYTES: 512e6, GEO_MAX: 160, GEO_BYTES: 1024e6, hits: 0, puts: 0};
// The bootstrap computes this from the exact blobs executed on both threads.
// Never refetch unversioned source URLs here: force-cache can hash older bytes
// than the running code and incorrectly accept geometry from another release.
async function buildStamp() {
  const stamp = typeof globalThis !== 'undefined' && globalThis.KS_SOURCE_STAMP;
  return typeof stamp === 'string' && /^[a-f0-9]{20}$/.test(stamp) ? stamp : null;
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
function cacheBytes(value) {
  const seen = new Set(), stack = [value]; let bytes = 0;
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') { bytes += v.length * 2; continue; }
    if (typeof v === 'number') { bytes += 8; continue; }
    if (!v || typeof v !== 'object' || seen.has(v)) continue;
    seen.add(v);
    if (ArrayBuffer.isView(v)) { if (!seen.has(v.buffer)) { seen.add(v.buffer); bytes += v.buffer.byteLength; } }
    else if (v instanceof ArrayBuffer) bytes += v.byteLength;
    else if (Object.prototype.toString.call(v) === '[object Map]') for (const [k, x] of v) { stack.push(k, x); }
    else if (Object.prototype.toString.call(v) === '[object Set]') for (const x of v) stack.push(x);
    else for (const k of Object.keys(v)) { bytes += k.length * 2; stack.push(v[k]); }
  }
  return bytes + 100;
}
// Commit the profile, physics snapshot, aliases and completed meshes together
// before transferring their buffers or resolving the loading request.
async function diskPutMany(records) {
  const db = await diskOpen(); if (!db) return false;
  return new Promise(resolve => {
    let tx;
    try {
      tx = db.transaction(['rec', 'meta'], 'readwrite');
      for (const r of records) {
        r.v = BUILD; r.size = cacheBytes(r);
        tx.objectStore('rec').put(r); tx.objectStore('meta').put({id: r.id, v: BUILD, at: Date.now(), size: r.size, geo: !!r.geometry});
      }
      tx.oncomplete = () => { DISK.puts += records.length; diskTrim(db); resolve(true); };
      tx.onerror = tx.onabort = e => { e?.preventDefault?.(); resolve(false); };
    } catch (e) { try { tx?.abort(); } catch (_) {} resolve(false); }
  });
}
const diskPut = r => diskPutMany([r]);
// Records of other builds go at once; then the oldest until each kind is within its limits.
let trimming = false;
async function diskTrim(db) {
  if (trimming) return; trimming = true;
  try {
    const all = await idbRun(db, 'readonly', (rec, meta, set) => { const q = meta.getAll(); q.onsuccess = () => set(q.result || []); });
    if (!all) return;
    const drop = all.filter(m => m.v !== BUILD).map(m => m.id), keep = all.filter(m => m.v === BUILD).sort((a, b) => b.at - a.at);
    const used = {r: [0, 0], g: [0, 0]};
    // A title-screen download must not evict examples prepared earlier in
    // that same run. Current stock bundles stay until the release changes;
    // the browser's real quota still decides whether a transaction succeeds.
    for (const m of keep) {if(m.id.startsWith('k:')||m.id.startsWith('g|k:'))continue;const u = used[m.geo ? 'g' : 'r']; u[0]++; u[1] += m.size || 0; if (m.geo ? u[0] > DISK.GEO_MAX || u[1] > DISK.GEO_BYTES : u[0] > DISK.MAX || u[1] > DISK.BYTES) drop.push(m.id); }
    if (drop.length) await idbRun(db, 'readwrite', (rec, meta) => { for (const id of drop) { rec.delete(id); meta.delete(id); } });
  } finally { trimming = false; }
}

function handlePropulsionPreview(job){
 const valid=ship&&lastStats&&job.gen===shipGen&&job.gen===lastStats.gen&&['cruise','combat','max'].includes(job.preset);
 const preview=valid?(lastStats.S.propulsion?.preset===job.preset?lastStats.S.propulsion:C.propulsionPreview(ship,lastStats.S,job.preset)):null;
 post({type:'propulsionPreview',id:job.id,gen:job.gen,preset:job.preset,preview});
}

// Solve against a copy of the authored design. In particular, a preview must
// not call applyState: doing so could resurrect a deleted parent or overwrite
// the worker's newer statistics and geometry while a ghost is being moved.
async function handlePlacement(job) {
  if (!placementCurrent(job)) { placementReply(job, null, {stale: true}); return; }
  if (typeof C.solvePlacement !== 'function') throw new Error('Placement solver unavailable');
  const candidate = placementCandidate(job);
  const root = job.request || {}, rows = Array.isArray(root.parts) ? root.parts : [{part: root.part, fit: root.fit, request: root}];
  if (!rows.length || rows.length > C.DESIGN_LIMITS.parts + (C.DESIGN_LIMITS.fits || 0)) throw new Error('Invalid placement candidate count');
  // Rebuild only the selected host and its ancestors. Every other authored
  // part remains present for the same exact collision/interference checks.
  const dependencies = new Set();
  for (const row of rows) { const request = row.request || root, part = row.fit || row.part || request.fit || request.part;
    for (const id of [request.parentStructureId, request.hostId, part?.host, request.partId, request.fitId]) if (id != null && id !== 'hull') dependencies.add(id);
  }
  // Fitting supports, launcher clearance rays and internal usable regions
  // also inspect surrounding shells. A cold authored fitted shell must use
  // its effective mesh in those tests. Legacy shells need no re-fit, and
  // unchanged hydrated shells keep their keyed caches on subsequent stamps.
  const physicalScene = rows.some(row => { const request = row.request || root, part = row.fit || row.part || request.fit || request.part;
    return row.list === 'fits' || request.list === 'fits' || row.fit || request.fit || row.entityKind === 'fit' || request.entityKind === 'fit' ||
      part?._fit || typeof C.placementCapability === 'function' && C.placementCapability(part).space === 'interior';
  });
  if (typeof C.placementCapability === 'function') for (const part of candidate.parts) {
    if (!part.placement) continue;
    const capability = C.placementCapability(part);
    // Rigid exterior equipment can also have followed an edited ancestor;
    // its current pose is needed by fixed-equipment interference checks.
    if ((capability.space === 'exterior' || part.placement.parentStructureId != null) && (physicalScene || capability.kind !== 'structure')) dependencies.add(part.id);
  }
  if (typeof C.refreshPlacementGeometry === 'function') C.refreshPlacementGeometry(candidate, {ids: dependencies, includeFits: false});
  const solved = [], authoredIds = {parts: new Set(candidate.parts.map(p => p.id)), fits: new Set(candidate.fits.map(p => p.id))}, batchIds = new Map();
  if (Array.isArray(root.parts)) candidate.nextId = Math.max(candidate.nextId || 1, 1, ...candidate.parts.concat(candidate.fits).map(p => Number.isSafeInteger(p.id) ? p.id + 1 : 1));
  let result = null;
  for (const row of rows) {
    if (!placementCurrent(job)) { placementReply(job, null, {stale: true}); return; }
    let request = row.request || root;
    const list = row.list || request.list || (row.fit || request.fit || row.entityKind === 'fit' || request.entityKind === 'fit' || row.part?._fit || request.part?._fit ? 'fits' : 'parts');
    if (list !== 'parts' && list !== 'fits') { result = {ok: false, code: 'placement-list-mismatch'}; break; }
    let part = row.fit || row.part || request.fit || request.part || candidate[list].find(p => p.id === (request.fitId ?? request.partId));
    if (!part) throw new Error('Placement part missing');
    if (request.partId != null && request.partId !== part.id) { result = {ok: false, code: 'part-identity-mismatch'}; break; }
    if (request.fitId != null && request.fitId !== part.id) { result = {ok: false, code: 'fit-identity-mismatch'}; break; }
    if (list === 'fits') request = {...request, entityKind: 'fit', list: 'fits'};
    if (Array.isArray(root.parts) && !authoredIds[list].has(part.id)) {
      // Palette symmetry candidates share a negative ghost ID. Reserve real
      // IDs only in this temporary transaction, so no later candidate can be
      // mistaken for an edit of the first ghost. Acceptance uses the same
      // source nextId and dependency order after the generation is checked.
      const oldId = part.id, id = candidate.nextId++;
      part = {...part, id}; request = {...request, ...(list === 'fits' ? {fitId: id} : {partId: id})};
      if (request.partId != null) request.partId = id;
      if (list === 'parts' && Number.isSafeInteger(oldId) && oldId > 0) batchIds.set(oldId, id);
    }
    if (batchIds.has(request.parentStructureId)) request = {...request, parentStructureId: batchIds.get(request.parentStructureId)};
    if (batchIds.has(request.hostId)) request = {...request, hostId: batchIds.get(request.hostId)};
    if (request.placementModelVersion != null && request.placementModelVersion !== C.PLACEMENT_MODEL_VERSION) {
      result = {ok: false, code: 'placement-model-mismatch'}; break;
    }
    const parentId = request.parentStructureId ?? (list === 'fits' ? request.hostId ?? part.host : undefined);
    if (parentId != null && parentId !== 'hull' && request.parentGeometryRevision != null) {
      const parent = candidate.parts.find(p => p.id === parentId);
      if (!parent || (parent.placement?.geometryRevision ?? parent.geometryRevision ?? 0) !== request.parentGeometryRevision) {
        result = {ok: false, code: parent ? 'parent-updated' : 'parent-missing'}; break;
      }
    }
    const resolved = resolvePlacementSurface(candidate, part, request, list, parentId);
    if (resolved.failure) { result = resolved.failure; break; }
    request = resolved.request;
    result = list === 'fits' && typeof C.solveFitPlacement === 'function' ? C.solveFitPlacement(candidate, part, request, {isolatedSource: true}) : C.solvePlacement(candidate, part, request);
    if (!result?.ok) break;
    const entity = list === 'fits' ? result.fit : result.part;
    if (!entity || result.list != null && result.list !== list) { result = {ok: false, code: 'placement-result-kind-mismatch'}; break; }
    solved.push(result);
    // Later candidates can attach to an earlier, successfully solved parent.
    // Only this throwaway design changes; batch failure commits no members.
    const index = candidate[list].findIndex(p => p.id === entity.id);
    if (index < 0) candidate[list].push(entity); else candidate[list][index] = entity;
    if (Number.isSafeInteger(entity.id)) candidate.nextId = Math.max(candidate.nextId || 1, entity.id + 1);
    await yieldGeometry();
  }
  const current = placementCurrent(job);
  if (!current) { placementReply(job, null, {stale: true, cancelled: !!placementOperations.get(placementOperationKey(job))?.cancelled}); return; }
  if (Array.isArray(root.parts) && result?.ok) result = {...result, parts: solved.filter(r => r.part).map(r => r.part), fits: solved.filter(r => r.fit).map(r => r.fit), results: solved};
  placementReply(job, result);
}

// Trench configuration may create a real recess and its aggregate charging
// rooms together. Validate that complete edit on an isolated authoring copy;
// neither a rejected request nor a late result can partly change the design.
async function handleTrenchArmament(job) {
  if (!placementCurrent(job)) { placementReply(job, null, {stale: true}); return; }
  if (typeof C.configureTrenchArmament !== 'function') throw new Error('Trench armament solver unavailable');
  const candidate = typeof job.state === 'string' ? JSON.parse(job.state) : JSON.parse(JSON.stringify(job.state));
  if (!candidate || !Array.isArray(candidate.parts) || !Array.isArray(candidate.fits)) throw new Error('Invalid trench source design');
  const result = C.configureTrenchArmament(candidate, job.request || {});
  await yieldGeometry();
  if (!placementCurrent(job)) { placementReply(job, null, {stale: true, cancelled: !!placementOperations.get(placementOperationKey(job))?.cancelled}); return; }
  placementReply(job, result, result?.ok ? {state: C.publicJSON(candidate)} : {});
}

async function loadExample(key){
 const row=typeof YardFleetData==='undefined'?null:YardFleetData.designs?.[key],asset=row?.model?.preparedBlueprint,hash=globalThis.KS_SOURCE_SHA256?.['js/core.js'];
 // v24 The design file carries its own source stamp (data/examples/manifest.json); older rows use the row's.
 const stamp=asset?.sourceSha256||row?.model?.sourceSha256,matchingSources=['data/reference.js','data/imperial2.js','js/core.js'].every(file=>stamp?.[file]&&stamp[file]===globalThis.KS_SOURCE_SHA256?.[file]);
 if(asset&&hash&&matchingSources&&asset.coreSha256===hash&&typeof KSAssetCache!=='undefined'&&typeof DecompressionStream!=='undefined')try{
  const url=new URL(asset.url,globalThis.KS_ASSET_BASE).href,blob=await KSAssetCache.getBlob(url,asset.sha256),raw=await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',raw)),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==asset.jsonSha256)throw Error('Prepared blueprint checksum mismatch');
  return C.deserialize(JSON.parse(new TextDecoder().decode(raw)));
 }catch(error){console.warn('Prepared example unavailable',key,error?.message);}
 return C.buildDesign(key);
}

async function handleBuild(job) {
  const t0 = now();
  // Completed records restore native caches too. Older public-state-only
  // records derive compartments once; the editor reset reuses the settled state.
  let b = null, src = 'built';
  const disk = await diskGet('k:' + job.key);
  if (disk && disk.state) { try { b = JSON.parse(disk.state); if (!disk.caches || !restoreCaches(b, disk.caches)) C.syncCompartments(b); src = 'disk'; } catch (e) { b = null; } }
  if (!b) { b = await loadExample(job.key); C.syncCompartments(b); C.remount(b); C.syncCompartments(b); }
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
// Restore completed native caches when available. A public-state-only record
// retains the legacy compartment derivation; repainting derives a new variant.
function rehydrate(state, paint, caches) { const d = JSON.parse(state); if (paint) d.paint = paint; if (!caches || paint || !restoreCaches(d, caches)) C.syncCompartments(d); if (paint) { C.remount(d); C.syncCompartments(d); } return d; }
const recShip = (rec) => rec.d || (rec.d = rehydrate(rec.state, rec.paint, rec.caches));
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
  if (job.design && typeof C.placementDraftStatus === 'function' && !C.placementDraftStatus(job.design).ok) {
    // A refusal stored for interior equipment is re-checked when the design is loaded (the interior is the
    // primary hull plus its attached structures), so an old refusal must not block the fleet by itself.
    // Pending source data is still never completed here.
    const status = C.placementDraftStatus(job.design), byId = new Map((job.design.parts || []).map(p => [p.id, p]));
    const staleInterior = !status.pending.length && status.failed.length && status.failed.every(row => row.list === 'parts' && C.placementCapability?.(byId.get(row.id) || {}).space === 'interior');
    const checked = staleInterior ? C.deserialize(job.design) : null;
    if (!checked || !C.placementDraftStatus(checked).ok)
      throw Object.assign(new Error('配置の計算・修正が完了していない部品があります'), {code: 'placement-unresolved'});
    job.design = C.serialize(checked);
  }
  if (job.prepareOnly && !(await diskOpen())) { post({type: 'fleet', id: job.id, src: 'unavailable', cacheSaved: false, ms: now() - t0}); return; }
  const djson = job.key ? '' : JSON.stringify(job.design), dkey = job.key ? 'k:' + job.key + (job.paint ? '#' + job.paint : '') : 'd:' + designHash(djson);
  let rec = fleetBuilt.get(dkey), src = rec ? 'memory' : '', save = false;
  const matches = r => !djson || r.designJSON === djson || JSON.stringify(r.serial) === djson;
  if (rec && !matches(rec)) { rec = null; src = ''; }
  if (rec) { fleetBuilt.delete(dkey); fleetBuilt.set(dkey, rec); }
  else {
    rec = null;
    // v13 LOAD the disk cache: the record of this design, or (a repainted example) the plain example's build.
    if (!rec) {
      let disk = await diskGet(dkey), fallback = false;
      if (disk && !matches(disk)) disk = null;
      if (!disk && job.key && job.paint) { disk = await diskGet('k:' + job.key); fallback = !!disk; }
      if (disk && disk.state) {
        const own = !fallback;
        rec = {d: null, cacheId: own ? disk.id : dkey, state: disk.state, paint: own ? null : job.paint, caches: own ? disk.caches || null : null, stats: own && disk.profile ? disk.stats : null, displayStats: own ? disk.displayStats || null : null, profile: own ? disk.profile || null : null, serial: own ? disk.serial || null : null, designJSON: own ? disk.designJSON : djson};
        src = 'disk'; save = !(own && rec.stats && rec.serial);
        if (!own) { try { recShip(rec); rec.state = C.publicJSON(rec.d); rec.paint = null; } catch (e) { rec = null; } }
      }
    }
    // Prefer the completed disk bundle even when this design is open in the
    // editor: repacking its native graph/catalogue would repeat expensive work.
    if (!rec && djson && ship && lastStats?.profile && lastStats.gen === shipGen && JSON.stringify(C.serialize(ship)) === djson) {
      try { const state = C.publicJSON(ship), caches = packCaches(ship, {runtime: true}); rec = {d: rehydrate(state, null, caches), state, caches, stats: lastStats.S, profile: lastStats.profile, serial: job.design}; src = 'editor'; save = true; } catch (e) { rec = null; }
    }
    if (!rec) {
      const d = job.key ? await loadExample(job.key) : C.deserialize(job.design); if (job.paint) d.paint = job.paint;
      C.syncCompartments(d); C.remount(d); C.syncCompartments(d);
      rec = {d, state: C.publicJSON(d), stats: null, profile: null, serial: null}; src = 'built'; save = true;
    }
    if (!rec.serial) rec.serial = C.serialize(recShip(rec));
    if (typeof C.placementDraftStatus === 'function' && !C.placementDraftStatus(rec.serial).ok)
      throw Object.assign(new Error('配置の計算・修正が完了していない部品があります'), {code: 'placement-unresolved'});
    rec.cacheId ||= dkey; rec.designJSON ||= djson;
    rec.alias = 'd:' + designHash(JSON.stringify(rec.serial)); rec.surfaces = !!rec.serial.surfaces;
    const big = rec.d ? rec.d.parts.length + rec.d.fits.length >= 3000 : rec.state.length > 4e6;
    if (!big) { fleetBuilt.set(dkey, rec); fleetBuilt.set(rec.alias, rec); while (fleetBuilt.size > FLEET_KEEP * 2) fleetBuilt.delete(fleetBuilt.keys().next().value); }
  }
  const lite = !!job.lite && !rec.surfaces;
  if (!lite && (!rec.stats || !rec.profile)) { const d = recShip(rec); rec.stats ||= C.computeStats(d); rec.profile = C.fleetProfile(rec.stats, d.name, d); save = true; }
  const {stats, profile, serial} = rec;
  let displayStats = null, geometry = null, stored = null, gid = null;
  const transfer = [], records = [], identity = JSON.stringify(serial);
  if (!lite && stats) { if (!rec.displayStats) { rec.displayStats = statsOut(stats, recShip(rec)); save = true; } displayStats = rec.displayStats; }
  if (!job.statsOnly) {
    gid = 'g|' + rec.cacheId + (job.trial ? '|t' : '|m');
    stored = await diskGet(gid);
    if (stored?.identity !== identity) stored = null;
    geometry = stored && stored.geometry || null;
    if (geometry) { for (const m of Object.values(geometry.meshes)) if (m.geo) for (const k of ['pos', 'nor', 'uv', 'col', 'idx']) if (m.geo[k]) transfer.push(m.geo[k].buffer); }
    else {
      const tg = now(); geometry = G.fleetGeometry(recShip(rec), {trial: !!job.trial, ...(profile?.surface?.offset ? {center: profile.surface.offset} : {})});
      for (const m of Object.values(geometry.meshes)) { m.geo = geoOut(m.geo, transfer); }
      records.push({id: gid, geometry, identity, ms: Math.round(now() - tg)});
    }
  }
  if (!rec.caches) { rec.caches = packCaches(recShip(rec), {runtime: true}); save = true; }
  if (save) {
    records.push({id: rec.cacheId, state: rec.state, caches: rec.caches, stats: rec.stats, displayStats: rec.displayStats, profile: rec.profile, serial, designJSON: rec.designJSON});
    if (rec.alias !== rec.cacheId) records.push({id: rec.alias, alias: rec.cacheId});
  }
  const cacheSaved = records.length ? await diskPutMany(records) : !!stored || src === 'disk';
  if (job.prepareOnly && job.silent) post({type:'fleet',id:job.id,src,cacheSaved,geoCached:!!stored,ms:now()-t0});
  else if (job.statsOnly) post({type: 'fleet', id: job.id, stats: displayStats, profile, design: serial, ms: now() - t0, src, cacheSaved});
  else post({type: 'fleet', id: job.id, stats: displayStats, profile: lite ? null : profile, geometry, design: serial, ms: now() - t0, cached: src === 'memory', src, geoCached: !!stored, cacheSaved}, transfer);
  // A trial also reuses its cached machinery graph for its turret-ray context.
  if (job.trial && !job.statsOnly && !job.prepareOnly) { const rays = trialSurfaceShip(recShip(rec)); trialHold = {ship: rays, ctx: C.turretRayContext(rays), fits: new Map(rays.fits.map(f => [f.id, f]))}; }
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
        else if (job.type === 'propulsionPreview') handlePropulsionPreview(job);
        else if (job.type === 'placement') await handlePlacement(job);
        else if (job.type === 'trenchArmament') await handleTrenchArmament(job);
        else if (job.type === 'trialRays') handleTrialRays(job);
        else if (job.type === 'trialEnd') trialHold = null;
        else if (job.type === 'op') handleOp(job);
        else if (job.type === 'ping') post({type: 'pong', id: job.id});
      } catch (e) {
        post({type: 'error', job: job.type, id: job.id, gen: job.gen, message: String(e && e.message || e), stack: String(e && e.stack || ''), ...(e?.code ? {code: e.code} : {})});
      }
    }
  } finally { running = false; }
}
function receive(msg) {
  if (!msg || !msg.type) return;
  if (msg.type === 'cancelPlacement') { cancelPlacement(msg); return; }
  if (msg.type === 'placementGeneration') { placementGeneration(msg); return; }
  if (msg.type === 'update' || isPlacementJob(msg)) placementGeneration(msg);
  if (isPlacementJob(msg)) {
    if (msg.designId == null || msg.operationId == null || !Number.isSafeInteger(msg.gen) || msg.gen < 0) {
      placementReply(msg, {ok: false, code: 'invalid-placement-generation'}); return;
    }
    const key = placementOperationKey(msg), previous = placementOperations.get(key);
    if (previous && previous.gen > msg.gen) { placementReply(msg, null, {stale: true}); return; }
    msg.placementSequence = ++placementSequence;
    placementOperations.delete(key);
    placementOperations.set(key, {sequence: msg.placementSequence, gen: msg.gen, cancelled: false});
    while (placementOperations.size > 256) placementOperations.delete(placementOperations.keys().next().value);
    // Superseded previews need no exact geometry job, but their callers must
    // still settle so cancellation cannot leave a pending Promise forever.
    for (let i = queue.length - 1; i >= 0; i--) if (isPlacementJob(queue[i]) && placementOperationKey(queue[i]) === key) {
      const old = queue.splice(i, 1)[0]; placementReply(old, null, {stale: true});
    }
  }
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
  inlineHost = false;
  post = (msg, transfer) => scope.postMessage(msg, transfer || []);
  scope.onmessage = (e) => receive(e.data);
  post({type: 'ready'});
}
function connectInline(deliver) {
  inlineHost = true;
  // Same contract as a worker: every message is copied, never shared.
  const copy = (m) => (typeof structuredClone === 'function' ? structuredClone(m) : JSON.parse(JSON.stringify(m)));
  post = (msg) => { const m = copy(msg); setTimeout(() => deliver(m), 0); };
  return (msg) => { const m = copy(msg); setTimeout(() => receive(m), 0); };
}
return {listenWorker, connectInline, packCaches, disk: DISK, abandoned};
})();
if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof importScripts === 'function' && self.__ksWorker) YardEngine.listenWorker(self);

/* Interface-side connection to the engine: a worker built from this page's
   own sources, or the same engine inline when workers are unavailable. */
const YardEngineClient = (() => {
'use strict';
let send = null, mode = 'none', worker = null, nextId = 1, readyResolve, sources = null;
const handlers = {}, waiting = new Map();
let placementWorker = null, placementBoot = null, placementUnavailable = false;
const placementWaiting = new Set(), placementGenerations = new Map();
const placementCancellations = new Map();
const ready = new Promise(r => { readyResolve = r; });
function dispatch(msg) {
  if (!msg || !msg.type) return;
  if (msg.id != null && waiting.has(msg.id)) {
    const w = waiting.get(msg.id); waiting.delete(msg.id); placementWaiting.delete(msg.id);
    if (msg.type === 'error') w.reject(Object.assign(new Error(msg.message), {stack: msg.stack}, msg.code ? {code: msg.code} : {})); else w.resolve(msg);
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
  placementFail(new Error('engine restarted'));
  inline();
  for (const [id, w] of waiting) w.reject(new Error('engine restarted'));
  waiting.clear();
  const h = handlers.restart; if (h) h();
}
function placementFail(error) {
  try { placementWorker?.terminate(); } catch (_) {}
  placementWorker = null; placementUnavailable = true;
  for (const id of placementWaiting) { const pending = waiting.get(id); waiting.delete(id); pending?.reject(error || new Error('placement worker restarted')); }
  placementWaiting.clear();
}
// A long synchronous fleet/statistics calculation cannot service a new
// message. A second worker uses the same verified source snapshot and Core,
// but receives placement jobs only, so a tap never queues behind that work.
function preparePlacement() {
  if (placementWorker) return Promise.resolve(placementWorker);
  if (placementBoot) return placementBoot;
  if (mode !== 'worker' || placementUnavailable) return Promise.resolve(null);
  const factory = globalThis.KSBoot?.createBackgroundWorker;
  if (!factory && !sources) return Promise.resolve(null);
  placementBoot = Promise.resolve().then(() => factory ? factory.call(globalThis.KSBoot) : bootWorker(sources)).then(w => {
    if (mode !== 'worker') { w.terminate(); return null; }
    placementWorker = w;
    w.onmessage = e => dispatch(e.data);
    w.onerror = e => { e.preventDefault?.(); placementFail(new Error(e.message || 'placement worker failed')); };
    for (const [designId, gen] of placementGenerations) w.postMessage({type: 'placementGeneration', designId, gen});
    return w;
  }).catch(() => { placementUnavailable = true; return null; }).finally(() => { placementBoot = null; });
  return placementBoot;
}
function post(msg, transfer) {
  if (!send) throw new Error('engine not started');
  if (msg.type === 'update' && msg.designId != null && Number.isSafeInteger(msg.gen)) {
    const old = placementGenerations.get(msg.designId);
    if (old == null || msg.gen > old) placementGenerations.set(msg.designId, msg.gen);
    while (placementGenerations.size > 128) placementGenerations.delete(placementGenerations.keys().next().value);
    placementWorker?.postMessage({type: 'placementGeneration', designId: msg.designId, gen: msg.gen});
  }
  if (msg.type === 'cancelPlacement') {
    const key = JSON.stringify([msg.designId, msg.operationId]);
    placementCancellations.set(key, (placementCancellations.get(key) || 0) + 1);
    while (placementCancellations.size > 256) placementCancellations.delete(placementCancellations.keys().next().value);
    placementWorker?.postMessage(msg);
  }
  if(typeof window!=='undefined')window.dispatchEvent?.(new Event('ks-engine-foreground'));send(msg, transfer);
}
function request(type, payload = {}, transfer) {
  const id = nextId++;
  const operationKey = JSON.stringify([payload.designId, payload.operationId]), cancellation = placementCancellations.get(operationKey) || 0;
  return ready.then(async () => {
    const dedicated = type === 'placement' ? await preparePlacement() : null;
    if (type === 'placement' && cancellation !== (placementCancellations.get(operationKey) || 0)) return {type, id, ...payload, state: undefined, result: null, stale: true, cancelled: true};
    return new Promise((resolve, reject) => {
      waiting.set(id, {resolve, reject});
      try {
        if (dedicated) { placementWaiting.add(id); dedicated.postMessage({...payload, type, id}, transfer || []); }
        else post({...payload, type, id}, transfer);
      } catch (error) { waiting.delete(id); placementWaiting.delete(id); reject(error); }
    });
  });
}
return {start, post, request, preparePlacement, ready, on(type, fn) { handlers[type] = fn; }, get mode() { return mode; }};
})();
