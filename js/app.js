/* ============================================================
   app.js — UI, tools, panels, persistence, exercises (v2).
   ============================================================ */
(() => {
'use strict';
const C = Core;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

// ---------- formatting ----------
const SUP = {'0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻'};
const num = (v, d) => v.toLocaleString('ja-JP', {maximumFractionDigits: d || 0, minimumFractionDigits: d || 0});
function ja(v, d) {
  const a = Math.abs(v);
  if (a >= 1e12) return (v / 1e12).toFixed(2) + '兆';
  if (a >= 1e8) return (v / 1e8).toFixed(a >= 1e10 ? 0 : a >= 1e9 ? 1 : 2) + '億';
  if (a >= 1e4) return num(Math.round(v / 1e4)) + '万';
  return num(v, d || 0);
}
function sci(v) {
  if (!v) return '0';
  const e = Math.floor(Math.log10(Math.abs(v))), m = v / Math.pow(10, e);
  return m.toFixed(1) + '×10' + String(e).split('').map(c => SUP[c]).join('');
}
const fLen = (m) => Math.abs(m) >= 10000 ? (m / 1000).toFixed(1) + ' km' : num(Math.round(m)) + ' m';
const fMass = (t) => ja(t) + ' t';
const fW = (w) => sci(w) + ' W';
const reactorOutputText = (p) => { const power = C.reactorPower(p); return `${fW(power)} · ${num(power / C.ISD_W, 6)} ISD`; };
const precisePartSize = (p) => C.isReactor(p) || ['engine','hyper','shield','localShield'].includes(p.k);
const fTT = (v) => v>0&&v<.001?(v*1e6).toLocaleString('ja-JP',{maximumFractionDigits:2})+' MT':v>0&&v<1?(v*1000).toLocaleString('ja-JP',{maximumFractionDigits:2})+' GT':fLargeTT(v);
const fLargeTT = (tt) => tt >= 1e5 ? (tt / 1000).toFixed(1) + ' PT' : tt > 0 && tt < 10 ? num(tt, 1) + ' TT' : num(Math.round(tt)) + ' TT';
const fG = (g) => num(Math.round(g)) + ' G';
const fCr = (c) => ja(c) + ' cr';
const fPct = (v) => Math.round(v * 100) + '%';
const fTime = (s) => s == null ? '—' : s < 60 ? Math.round(s) + '秒' : Math.floor(s / 60) + '分' + String(Math.round(s % 60)).padStart(2, '0') + '秒';
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

// ---------- state ----------
const PART_KEYS = Object.keys(C.PARTS).filter(k=>!['machinery','capacitor'].includes(k));
const WEAPONS = ['refVen','refISD','refIon','refSide','oct40','casemate40','casemateLight','triple40','quad200','pd', 'ltl', 'mtl', 'htl', 'stl', 'utl', 'ion', 'msl', 'trc'];
const BRIDGES = ['podBridge','podAir','podHangar','podCombat'];
const TABS = [['hull', '船体'], ['mod', '区画および艤装'], ['systems','系統'], ['launch', '航空隊'], ['ground', '地上部隊'], ['spec', '性能']];
// 削る・装甲 live inside 船体; their editors keep their own tab keys.
const HULL_SUB = [['hull', '船体の形'], ['carve', '削る'], ['armor', '装甲']];
const TAB_NAMES = {...Object.fromEntries(TABS), carve: '削る', armor: '装甲', bridge: '艦橋'};
// Weapons and the bridge live inside 区画および艤装 as groups of their own.
const armMode = () => st.tab === 'arm' || st.tab === 'mod' && st.group === 'weapons';
function layoutGroups() { const out = []; for (const e of Object.entries(C.GROUPS)) { out.push(e); if (e[0] === 'command') out.push(['bridge', '艦橋']); } return out; }
const BRIDGE_SUB = [['body', '艦橋本体'], ['windows', '艦橋ポッド']];
function bridgeSubHTML() { return `<div class="pgroup command-sub"><h4>艦橋</h4>${seg('cmdsub', BRIDGE_SUB, st.bridgeMode === 'windows' ? 'windows' : 'body')}</div>`; }
// The bridge editor lives inside 区画 → 指揮・生活; its state keeps the 'bridge' key.
const tabKey = () => st.tab === 'bridge' ? 'mod' : st.tab === 'carve' || st.tab === 'armor' ? 'hull' : st.tab;
function markTabs() { $$('#tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tabKey()))); }
const PLACE = [['inside', '内蔵'], ['partial', '一部露出'], ['outside', '外付け']];
const st = {
  tab: 'hull', part: 'gen', partTool: 'place',
  placeBy: {gen: 'inside', shield: 'partial', hyper: 'inside', engine: 'partial', hangar: 'inside'},
  size: {gen: 110, shield: 34, hyper: 50, engine: 60, hangar: 45},
  structSize: [180, 110, 60], structTaper: 0.2, fill: [0.3, 0.8],
  sel: null, hatchA: null,
  fit: 'htl', fitTool: 'place', bridge: 'podBridge', bridgeTool: 'place', ped: 2, pedShape: 'round', pedSize: 1,
  carveTool: 'solid', razee: {side: 'both', edge: 'top', inset: 60, slope: 50, from: 0.1, to: 1, prop: true}, notch: {l: 120, w: 80, d: 40}, notchStructures: false,
  mirror: true, view: 'normal', coded: false, cut: {x: 1, y: 1, z: 1},
  simOpp: 'destroyer', dockCollapsed: false,
};
st.group='power';st.structForm='trap';st.structAngles=[10,10,15,15];st.structYaw=0;st.structOffsetX=0;st.structOffsetZ=0;st.reactor=null;st.engineDir=[-1,0,0];st.trench={side:'both',depth:20,height:16,level:.5,from:0,to:1};
for(const k of PART_KEYS){if(st.size[k]==null)st.size[k]=C.PARTS[k].def||40;if(!st.placeBy[k])st.placeBy[k]='inside';}
let ship = null, S = null, prevS = null, view = null, bounds = [0, 0, 0, 1, 1, 1];
const undoStack = [], redoStack = [];
let lastOp = '', dragSnap = null, dragLabel = '';

// ---------- view / rendering ----------
const dirty = {draw: true};
let statsTimer = 0, hoverLines = null;
function requestDraw() { dirty.draw = true; }

// ---------- background engine ----------
// Geometry, compartment clipping, mounts and performance run in the engine
// (a worker when available). Edits only record what changed; the newest
// design is sent whenever the engine is free, so dragging never queues work.
const eng = {ready: false, gen: 0, sentGen: 0, geoGen: 0, adoptedGen: 0, statsGen: 0, waiting: false, scheduled: false, what: new Set(), reset: true, fitOnGeometry: true, quiet: false, label: '', labelGen: 0, mode: 'none', ms: null};
const meshStore = {geos: {}, glow: null, grid: null, ranges: null};
function touch(what) {   // geometry or design changed
  if (!ship) return;
  eng.gen++; eng.what.add(what || 'all');
  if (live.queued) { const q = live.queued; live.queued = null; showPreview(q.list, q.items); }
  else if (live.active) live.gen = eng.gen;
  kickEngine(); engineStatus(); refreshOverlay(); dirty.draw = true;
}
function kickEngine() {
  if (!eng.ready || eng.waiting || eng.scheduled) return;
  eng.scheduled = true;
  setTimeout(sendEngineUpdate, 0);
}
function sendEngineUpdate() {
  eng.scheduled = false;
  if (!eng.ready || eng.waiting || !ship || eng.sentGen === eng.gen) return;
  eng.waiting = true; eng.sentGen = eng.gen;
  const msg = {type: 'update', gen: eng.gen, reset: eng.reset, state: C.publicJSON(ship), what: [...eng.what], view: {coded: st.coded, habitation: !!st.showHabitation}};
  eng.what.clear(); eng.reset = false;
  YardEngineClient.post(msg);
}
function enginePending() { return eng.adoptedGen < eng.gen; }
function engineStatus() {
  const el = $('#engineStatus'); if (!el) return;
  const geo = eng.geoGen < eng.gen, stats = eng.statsGen < eng.gen;
  el.hidden = !(geo || stats) || fleet.mode !== 'design';
  el.textContent = !eng.ready ? '設計エンジンを起動中…' : geo ? '形状を計算中…' : '性能を計算中…';
  el.classList.toggle('geo', geo);
  $('#statstrip')?.classList.toggle('stale', stats);
  $('#specSide')?.classList.toggle('stale', stats);
}
function uploadStored() {
  if (!view) return;
  for (const [k, g] of Object.entries(meshStore.geos)) if (g) view.upload(k, g);
  if (meshStore.glow) view.setGlow(meshStore.glow);
  if (meshStore.grid) view.setLines('grid', meshStore.grid);
}
function applyGeometry(msg) {
  for (const [k, g] of Object.entries(msg.geos || {})) { if (!g) continue; meshStore.geos[k] = g; if (view) view.upload(k, g); }
  if (msg.glow) { meshStore.glow = msg.glow; view?.setGlow(msg.glow); }
  if (msg.grid) { meshStore.grid = msg.grid; view?.setLines('grid', msg.grid); }
  if (msg.ranges !== undefined && msg.geos && Object.keys(msg.geos).length) meshStore.ranges = msg.ranges;
  if (msg.fitRanges) meshStore.fitRanges = msg.fitRanges;
  if (msg.bounds) bounds = msg.bounds;
  if (msg.dims) meshStore.dims = msg.dims;
  requestDraw();
}
// While the engine rebuilds a resized hull, the old hull mesh is stretched to
// the new length, beam and depth so the change is visible at once.
const HULL_MESHES = ['hull', 'refHull', 'keel', 'hatchOpen', 'hatchRay', 'refHatches'];
function liveScale() {
  const d = meshStore.dims, hp = ship?.hull; if (!d || !hp) return null;
  const s = [hp.L / d[0], hp.H / d[2], hp.W / d[1]];
  if (s.every(v => Math.abs(v - 1) < 1e-6)) return null;
  const out = {}; for (const k of HULL_MESHES) out[k] = s; return out;
}
// Derived state from the engine (mounts, bay openings, clipped and merged rooms)
// is adopted only when the design has not changed since the request.
function adoptEngineState(msg) {
  const src = JSON.parse(msg.state);
  C.patchShip(ship, src, ['parts', 'fits', 'hatches']);
  if (Number.isFinite(src.nextId)) ship.nextId = Math.max(ship.nextId, src.nextId);
  const c = msg.caches; if (!c) return;
  const ids = {parts: new Map(ship.parts.map(p => [p.id, p])), fits: new Map(ship.fits.map(f => [f.id, f])), hatches: new Map(ship.hatches.map(h => [h.id, h]))};
  const seen = new Set();
  const ref = (v) => v.$r === 'ship' ? ship : (ids[v.$r]?.get(v.id) || null);
  const fix = (v) => {
    if (!v || typeof v !== 'object' || ArrayBuffer.isView(v) || seen.has(v)) return;
    seen.add(v);
    if (v instanceof Map) { for (const [k, x] of v) { if (x && x.$r) v.set(k, ref(x)); else fix(x); } return; }
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { const x = v[i]; if (x && x.$r) v[i] = ref(x); else fix(x); } return; }
    for (const k of Object.keys(v)) { const x = v[k]; if (x && typeof x === 'object' && x.$r) v[k] = ref(x); else fix(x); }
  };
  fix(c);
  for (const k of Object.keys(ship)) if (k[0] === '_' && !['_client'].includes(k)) delete ship[k];
  Object.assign(ship, c.ship);
  for (const l of ['parts', 'fits', 'hatches']) for (const it of ship[l]) {
    for (const k of Object.keys(it)) if (k[0] === '_') delete it[k];
    const x = c.items[l][it.id]; if (x) Object.assign(it, x);
  }
  ship._client = true; ship._geoProxy = c.geoProxy;
  if (ship._cache) ship._lockedCache = ship._cache;
  eng.adoptedGen = msg.gen;
}
function onEngineGeometry(msg) {
  eng.waiting = false;
  if (msg.gen >= eng.geoGen) { eng.geoGen = msg.gen; applyGeometry(msg); eng.ms = msg.totalMs; if (live.active && msg.gen >= live.gen) clearPreview(); }
  if (msg.gen === eng.gen && msg.state) {
    adoptEngineState(msg);
    if (eng.fitOnGeometry) { eng.fitOnGeometry = false; fitCamera(eng.keepCam); }
    hideBusyOverlay();
    refreshOverlay(); renderPanelInfo(); updateAviationUI(); refreshDerivedPanel(); autosave();
    if (titleVisible()) { titleStatus(); titleShipView(); }
  }
  if (eng.gen > eng.sentGen) kickEngine();
  engineStatus();
}
function onEngineStats(msg) {
  if (msg.geos && msg.gen >= eng.geoGen) applyGeometry(msg);
  if (msg.gen < eng.statsGen) return;
  eng.statsGen = msg.gen;
  prevS = S; S = msg.stats;
  renderStrip(); renderSpecTargets(); if (st.tab === 'systems' || armMode() && st.sel?.list === 'fits' && !dragSnap) renderPanel();
  if (st.tab !== 'spec' && st.tab !== 'sim') renderPanelInfo();
  updateAviationUI(); updateGroundUI();
  if (msg.gen === eng.gen) {
    if (prevS && eng.label && !eng.quiet && msg.gen >= eng.labelGen) toastDiff(eng.label, prevS, S);
    eng.label = ''; eng.quiet = false;
  }
  engineStatus();
}
function onEngineError(msg) {
  console.error('engine:', msg.message, msg.stack);
  if (msg.job === 'update') { eng.waiting = false; if (msg.gen === eng.gen) { eng.geoGen = eng.statsGen = eng.adoptedGen = msg.gen; hideBusyOverlay(); } engineStatus(); toast('計算できませんでした：' + esc(msg.message)); if (eng.gen > eng.sentGen) kickEngine(); }
}
// Panels that show derived values refresh after the engine reports, unless the
// person is in the middle of dragging a control.
function refreshDerivedPanel() {
  if (dragSnap || fleet.mode !== 'design') return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#panel') && a.matches('input, select, textarea')) return;
  const it = selItem();
  if (['systems', 'launch'].includes(st.tab) || (st.tab === 'mod' && it && (it.k === 'hangar' || it._packingGroup || C.isInternal(it))) || (armMode() && st.sel?.list === 'fits')) renderPanel();
}
function engineHello(mode) {
  eng.mode = mode; eng.ready = true;
  YardEngineClient.on('geometry', onEngineGeometry);
  YardEngineClient.on('stats', onEngineStats);
  YardEngineClient.on('error', onEngineError);
  kickEngine(); engineStatus();
}
// ---------- live preview ----------
// An edited part or fitting is drawn at once from its requested shape, and its
// stale copy in the engine's meshes is hidden, until the engine catches up.
const live = {parts: [], fits: [], hide: {parts: new Set(), fits: new Set()}, gen: 0, queued: null, active: false};
function queuePreview(list, items) { live.queued = {list, items: items.filter(Boolean)}; }
function showPreview(list, items, removedIds) {
  if (!view || !ship) return;
  const sel = items.filter(Boolean);
  if (!live.active) { live.parts = []; live.fits = []; live.hide.parts.clear(); live.hide.fits.clear(); }
  const add = (arr, xs) => { for (const x of xs) if (!arr.includes(x)) arr.push(x); };
  if (list === 'parts') add(live.parts, sel); else add(live.fits, sel);
  for (const it of sel) live.hide[list].add(it.id);
  for (const id of removedIds || []) live.hide[list].add(id);
  live.parts = live.parts.filter(p => ship.parts.includes(p)); live.fits = live.fits.filter(f => ship.fits.includes(f));
  live.active = true; live.gen = eng.gen;
  try {
    const g = Gfx.meshPreview(ship, live.parts, live.fits, {coded: st.coded});
    for (const k of ['preview', 'previewRef', 'previewFits', 'previewRefFits']) view.upload(k, g[k]);
  } catch (e) { console.error(e); }
  requestDraw();
}
function clearPreview() {
  if (!live.active) return;
  live.active = false; live.parts = []; live.fits = []; live.hide.parts.clear(); live.hide.fits.clear();
  if (view) for (const k of ['preview', 'previewRef', 'previewFits', 'previewRefFits']) if (view.meshes?.[k]) { if (view.kind === 'compat') delete view.meshes[k]; else view.meshes[k].count = 0; }
  requestDraw();
}
// Exterior view skips machinery the performance pass found fully enclosed by
// the hull and structures. Bays behind hatches, model skins and anything not
// yet re-measured after an edit are always drawn.
const CULL_MESHES = new Set(['gen', 'shield', 'hyper']);
const cull = {key: '', ids: []};
function enclosedParts() {
  if (st.view !== 'normal' || fleet.mode !== 'design' || !S || !S.info || eng.statsGen !== eng.geoGen || ship.solidCuts?.length) return [];
  const key = eng.statsGen + ':' + ship.parts.length;
  if (cull.key === key) return cull.ids;
  const bays = new Set(ship.hatches.map(h => h.bay));
  cull.key = key; cull.ids = ship.parts.filter(p => p.k !== 'struct' && p.k !== 'hangar' && p.k !== 'engine' && !p.skinAsset && !bays.has(p.id) && S.info[p.id] && S.info[p.id].exposed === 0 && !S.info[p.id].overlap).map(p => p.id);
  return cull.ids;
}
function liveHidden() {
  const enclosed = enclosedParts();
  if (!live.active && !enclosed.length) return null;
  const out = {}, put = (ranges, ids, only) => { if (!ranges) return; for (const id of ids) for (const [name, s0, n] of ranges[id] || []) if (!only || only.has(name)) (out[name] || (out[name] = [])).push([s0, n]); };
  if (live.active) { put(meshStore.ranges, live.hide.parts); put(meshStore.fitRanges, live.hide.fits); }
  put(meshStore.ranges, enclosed, CULL_MESHES);
  for (const k in out) out[k].sort((a, b) => a[0] - b[0]);
  return out;
}
let busyT = 0;
function showBusyOverlay(text) { const el = $('#busy'); if (!el || titleVisible()) return; $('#busyText').textContent = text || '設計を展開中…'; clearTimeout(busyT); busyT = setTimeout(() => { el.hidden = false; }, 120); }
function hideBusyOverlay() { clearTimeout(busyT); const el = $('#busy'); if (el) el.hidden = true; }

function loop(now=performance.now()) {
  if(document.hidden){requestAnimationFrame(loop);return;}
  if(trial.on){try{if(view&&!renderHealth.lost&&!renderRetryTimer)trialLoop(now);}catch(e){renderingFailed(e);}requestAnimationFrame(loop);return;}
  if(fleet.mode!=='design'){try{if(!renderHealth.lost&&!renderRetryTimer)fleetLoop(now);}catch(e){renderingFailed(e);}requestAnimationFrame(loop);return;}
  if (view && ship && !renderHealth.lost && !renderRetryTimer) {
    view.onTextureReady=requestDraw;
    try {
      if (titleCam.base) titleOrbit(now);
      if (dirty.draw || (renderHealth.mode==='webgl' && now-renderHealth.lastFrame>1500)) {
        const drawn=view.draw({mode: st.view, clip: null, paint:ship.paint,hullLength:ship.hull.L,reference:ship.reference, hidden: liveHidden(), meshScale: liveScale()});
        if(drawn!==false){dirty.draw=false;renderHealth.frames++;renderHealth.lastFrame=now;renderHealth.failures=0;}
      }
    } catch (e) { renderingFailed(e); }
  }
  requestAnimationFrame(loop);
}
function fitCamera(keepAngles) {
  if(fleet.mode!=='design'){fleetFit();return;}
  if(!view)return;
  if (!ship._geoProxy) { eng.fitOnGeometry = true; eng.keepCam = keepAngles; return; }
  const b = bounds, c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, 0];
  view.off = [-c[0], -c[1], -c[2]];
  const size = Math.max(b[3] - b[0], (b[5] - b[2]) * 1.2, (b[4] - b[1]) * 2) + 4;
  view.cam.target = [0, 0, 0];
  view.cam.r = size * 1.05 / Math.tan(view.cam.fov / 2) * 0.62;
  if (!keepAngles) { view.cam.ortho=false; view.cam.th = 0.85; view.cam.ph = 1.02; }
  requestDraw();
}
const CAMS = {iso: [0.85, 1.02], top: [Math.PI / 2, 0.0006], side: [Math.PI / 2, Math.PI / 2], front: [0, Math.PI / 2], back: [Math.PI, Math.PI / 2], bottom:[Math.PI/2,Math.PI-.0006]};

// ---------- ship lifecycle & history ----------
function setShip(s, opts) {
  if(fleet.mode!=='design')fleetSetMode('design');
  if(ship && !(opts&&opts.keepHistory)){undoStack.push(snap());if(undoStack.length>60)undoStack.shift();redoStack.length=0;}
  ship = s; s._client = true; S = null; prevS = null; st.sel = null; st.multi = {parts: new Set(), fits: new Set()}; st.hatchA = null; resetSolidCutter();
  // Loading another design remains undoable. The engine starts from scratch.
  eng.reset = true; eng.fitOnGeometry = true; eng.keepCam = !!(opts && opts.keepCam);
  meshStore.geos = {}; meshStore.ranges = null; if (view) { for (const k of Object.keys(view.meshes || {})) if (view.meshes[k]) view.meshes[k].count = 0; }
  showBusyOverlay(opts?.busyText);
  touch('all');
  hideInspect(); updateName(); renderPanel(); scheduleStats(0); updateUndo(); autosave();
}
function snap() { return JSON.stringify(C.serialize(ship)); }
function restore(json) {
  // Undo keeps the editor's objects (and their caches) and patches the design.
  const s = C.deserialize(JSON.parse(json)), src = JSON.parse(C.publicJSON(s));
  if (ship.saveId != null) src.saveId = ship.saveId;
  C.patchShip(ship, src); ship._client = true; reconcileSolidCutter();
  const sel = st.sel; st.sel = sel && findSel(sel) ? sel : null; st.hatchA = null;
  touch('all'); hideInspect(); renderPanel(); scheduleStats(60); updateUndo(); autosave();
}
function mutate(label, fn, what, opts) {
  const before = snap();
  let res;
  try { res = fn(); } catch (e) { console.error(e); toast(esc(e.message||'操作できませんでした')); return false; }
  if (snap() === before) { if (!(opts && opts.silent)) toast(typeof res === 'string' ? res : '変化はありません'); return false; }

  undoStack.push(before); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0;
  lastOp = label; touch(what || 'all'); scheduleStats(opts && opts.quiet ? -1 : 60); updateUndo(); autosave();
  return res == null ? true : res;
}
function beginDrag(label) { if (!dragSnap) { dragSnap = snap(); dragLabel = label; } }
function endDrag() {
  if (!dragSnap) return;
  if (snap() !== dragSnap) { undoStack.push(dragSnap); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; lastOp = dragLabel; scheduleStats(30); updateUndo(); autosave(); }
  dragSnap = null;
}
function undo() { if (!undoStack.length) return; redoStack.push(snap()); lastOp = '元に戻す'; restore(undoStack.pop()); }
function redo() { if (!redoStack.length) return; undoStack.push(snap()); lastOp = 'やり直し'; restore(redoStack.pop()); }
function updateUndo() { $('#btnUndo').disabled = !undoStack.length; $('#btnRedo').disabled = !redoStack.length; }
function updateName() { $('#shipName').textContent = ship.name; }
// Performance figures arrive from the engine after each edit settles.
function scheduleStats(delay) {
  eng.quiet = delay < 0;
  if (lastOp) { eng.label = lastOp; eng.labelGen = eng.gen; lastOp = ''; }
}

// ---------- selection ----------
function findSel(sel) { const l = ship[sel.list]; return l ? l.find(q => q.id === sel.id) : null; }
function selItem() { return st.sel ? findSel(st.sel) : null; }
function twinOfItem(list, it) { return it && it.tw ? ship[list].find(q => q.id === it.tw) : null; }

// ---------- picking ----------
function visibleAt(p, clip) { return !clip || (p[0] <= clip[0] + 0.01 && p[1] <= clip[1] + 0.01 && p[2] <= clip[2] + 0.01); }
function envHit(o, d, clip, opts) {
  let oo = o.slice(), acc = 0;
  for (let k = 0; k < 12; k++) {
    const h = C.rayEnv(ship, oo, d, opts);
    if (!h) return null;
    h.t += acc;
    if (visibleAt(h.p, clip)) return h;
    const step = (h.t - acc) + 0.05; acc += step; oo = C.add(oo, C.mul(d, step));
  }
  return null;
}
function sectionHit(o, d, clip) {
  if (!clip) return null;
  let t = 0, n = null;
  for (let a = 0; a < 3; a++) {
    if (o[a] > clip[a]) { if (d[a] >= 0) return null; const ta = (clip[a] - o[a]) / d[a]; if (ta > t) { t = ta; n = [0, 0, 0]; n[a] = 1; } }
  }
  if (!n) return null;
  const q = C.add(o, C.mul(d, t + 0.01));
  if (!visibleAt(q, clip) || !C.inEnv(ship, q)) return null;
  return {t, p: q, n, kind: 'section'};
}
function partHit(o, d, clip, filter) {
  let best = null;
  for (const pt of [...ship.parts,...C.commandCompartments(ship),...C.weaponCapacitors(ship)]) {
    if (filter && !filter(pt)) continue;
    const h = C.rayPart(o, d, pt);
    if (h && visibleAt(h.p, clip) && (!best || h.t < best.t)) { best = h; best.part = pt; best.kind = 'part'; }
  }
  return best;
}
function fitHit(o, d) {
  let best = null;
  for (const f of ship.fits) { const h = C.rayAABB(o, d, C.fitAABB(f)); if (h && (!best || h.t < best.t)) best = {t: h.t, fit: f, p: h.p}; }
  return best;
}
function pick(px, py, want) {
  if (!view || !ship || !ship._geoProxy) return null;
  const r = view.ray(px, py); if (!r) return null;
  return pickRay(r.o, r.d, want);
}
// The same hit test along a world ray (the tutorial taps through it).
function pickRay(o, d, want) {
  if (!ship || !ship._geoProxy) return null;
  let h = null;
  if (st.view === 'xray' && want.parts) h = partHit(o, d, null, (pt) => pt.k !== 'struct') || envHit(o, d, null, {structOnly: false});
  else h = envHit(o, d, null);
  if (want.fits) { const f = fitHit(o, d); if (f && (!h || f.t < h.t)) return {fit: f.fit, t: f.t, p: f.p}; }
  return h;
}

// ---------- tools ----------
function tool() {
  switch (st.tab) {
    case 'mod': return st.group==='weapons'?(st.fitTool==='place'?'fit':st.fitTool==='remove'?'unfit':st.fitTool==='multi'?'multi':'adjust'):st.partTool === 'select' ? 'select' : st.partTool === 'multi' ? 'multi' : 'part';
    case 'launch': return 'select';
    case 'arm': return st.fitTool === 'place' ? 'fit' : st.fitTool === 'remove' ? 'unfit' : st.fitTool === 'multi' ? 'multi' : 'adjust';
    case 'bridge': if(st.bridgeMode==='body')return st.partTool==='select'?'select':'part';return st.bridgeTool === 'place' ? 'fit' : st.bridgeTool === 'remove' ? 'unfit' : 'adjust';
    case 'carve': return st.carveTool === 'solid' ? 'solid' : st.carveTool === 'notch' ? 'notch' : 'inspect';
    default: return 'inspect';
  }
}
function curFit() { return st.tab === 'bridge' ? st.bridge : st.fit; }
function hintText() {
  const t = tool();
  switch (t) {
    case 'multi': return '区画・構造物・装備をタップして選択に追加／もう一度で解除';
    case 'part': {
      const spec=activeEquipment();if(spec)return `面をタップして${spec.name}を配置${spec.k==='engine'?'（寸法で推力が変化）':''}`;
      const k = st.part, nm = C.PARTS[k].name;
      if (k === 'struct') return `面をタップして構造物（${st.structSize.map(v => Math.round(v)).join('×')} m）を据える`;
      return `面をタップして${nm}（${st.size[k]} m・${PLACE.find(p => p[0] === st.placeBy[k])[1]}）を置く`;
    }
    case 'select': return st.tab==='launch'?'航空区画を選んで出口を設定。航空隊のサイズと機数は下の欄で編集できます':st.sel?.list === 'parts' ? '選択中の区画は枠ごとドラッグで移動・別の区画はタップで選択' : st.view === 'normal' ? '区画をタップで選択（内部は透視で）・選ぶとドラッグで移動' : '区画をタップで選択・選ぶとドラッグで移動';
    case 'fit': return C.FITS[curFit()].pod?`構造物・艦橋本体の壁をタップして${C.FITS[curFit()].name}を設置`:`面をタップして${C.FITS[curFit()].short}を設置（傾斜には支持台）`;
    case 'unfit': return '撤去する装備をタップ';
    case 'adjust': return st.sel?.list === 'fits' ? '選択中の装備はドラッグで面に沿って移動・別の装備はタップで選択' : '装備をタップして選択・選ぶとドラッグで移動';
    case 'notch': return `外面をタップして ${st.notch.l}×${st.notch.w}×深さ${st.notch.d} m を切り欠く`;
    case 'solid': return st.cutterAction === 'move' ? 'ドラッグでカッターを移動。重ね終えたら「重なりを切り取る」' : st.cutterAction === 'camera' ? 'ドラッグで視点を回転。半透明の立体が切り取る範囲です' : '船体をタップしてカッターを置く。寸法と位置を調整してから切り取る';
    default: return 'タップで詳細を表示';
  }
}
function updateHint() { const h = $('#hint'); if (h) h.textContent = hintText(); }
function extentAlong(k, size, n) {
  const sh = C.PARTS[k].shape;
  if (sh === 'sphere') return size / 2;
  if (sh === 'cube') return size / 2 * (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]));
  const l = size * C.PARTS[k].ratio; return Math.abs(n[0]) * l / 2 + Math.hypot(n[1], n[2]) * size / 2;
}
function partPreview(hit){let p=unalignedPartPreview(hit);const tpl=activeTemplate('parts',p.k);if(tpl){const own=Object.fromEntries(Object.entries(p).filter(([,v])=>v!==undefined));p=Object.assign(JSON.parse(JSON.stringify(tpl.data)),own,{id:-1});}p.c=C.alignedPosition(ship,p.c,st.alignment);return p;}
function unalignedPartPreview(hit) {
  const spec=activeEquipment();if(spec)return equipmentPreview(hit,spec);
  const k = st.part;
  if (k === 'struct') {
    const [l, w, hh] = st.structSize, n = hit.n, ax = Math.abs(n[1]) >= Math.abs(n[2]) && Math.abs(n[1]) >= Math.abs(n[0]) ? 1 : Math.abs(n[2]) >= Math.abs(n[0]) ? 2 : 0;
    const ext = [l / 2, hh / 2, w / 2][ax], c = hit.p.slice();
    if (hit.kind !== 'section') c[ax] += Math.sign(n[ax] || 1) * ext * 0.6;
    return C.alignStructure({id:-1,k,c,s:[l,w,hh],pitch:st.structPitch||0,roll:st.structRoll||0,taper:st.structTaper,form:st.structForm,skinAsset:st.structForm==='reference'?st.skinAsset:undefined,angles:st.structAngles.slice(),yaw:st.structYaw,offsetX:st.structOffsetX,offsetZ:st.structOffsetZ},hit,st.surfaceMode);
  }
  const size = st.size[k];
  let c;
  if (hit.kind === 'section') c = hit.p.slice();
  else {
    const e = C.PARTS[k].shape==='cube'?(Math.abs(hit.n[0])*st.roomSize[0]+Math.abs(hit.n[1])*st.roomSize[2]+Math.abs(hit.n[2])*st.roomSize[1])/2:extentAlong(k, size, hit.n), mode = st.placeBy[k];
    const off = mode === 'inside' ? -(e + 1) : mode === 'partial' ? -e * 0.4 : e * 0.92;
    c = C.add(hit.p, C.mul(hit.n, off));
  }
  return {id:-1,k,c,d:size,...(C.PARTS[k].shape==='cube'?{room:(st.roomSize||[120,60,24]).slice()}:{}),...(k==='engine'?{dir:st.engineDir.slice(),reactor:st.reactor}:{})};
}
function notchBox(hit) {
  const n = hit.n, a = Math.abs(n[0]) > Math.abs(n[1]) && Math.abs(n[0]) > Math.abs(n[2]) ? 0 : Math.abs(n[1]) >= Math.abs(n[2]) ? 1 : 2;
  const {l, w, d} = st.notch, big = Math.max(ship.hull.W, ship.hull.H, ship.hull.L) * 0.6, p = hit.p, s = Math.sign(n[a] || 1);
  const b = [0, 0, 0, 0, 0, 0], half = [0, 0, 0];
  if (a === 0) { half[1] = w / 2; half[2] = l / 2; } else if (a === 1) { half[0] = l / 2; half[2] = w / 2; } else { half[0] = l / 2; half[1] = w / 2; }
  for (let k = 0; k < 3; k++) {
    if (k === a) { const lo = s > 0 ? p[k] - d : p[k] - big, hi = s > 0 ? p[k] + big : p[k] + d; b[k] = lo; b[k + 3] = hi; }
    else { b[k] = p[k] - half[k]; b[k + 3] = p[k] + half[k]; }
  }
  return b;
}
function ghostFor(hit) {
  const t = tool(), ls = Gfx.lineSet(), ok = [95, 196, 138, 255], ng = [236, 106, 92, 255], cy = [105, 195, 220, 255];
  if (!hit) return null;
  if (t === 'part' && !hit.fit && hit.kind !== undefined) {
    const pt = partPreview(hit);
    ls.part(pt, pt.k!=='struct'&&C.hardConflicts(ship,pt).length?ng:ok);
    if (st.mirror && Math.abs(pt.c[2]) > 2) { const q = C.mirrorPart(pt,ship); ls.part(q, [95, 196, 138, 150]); }
    if (st.vmirror) { const v = C.vmirrorPart(pt, ship); ls.part(v, [95, 196, 138, 120]); if (st.mirror && Math.abs(pt.c[2]) > 2) ls.part(C.mirrorPart(v, ship), [95, 196, 138, 90]); }
  } else if (t === 'fit' && hit.p && !hit.fit && hit.kind !== 'section') {
    const k = curFit(), d = C.FITS[k],normal=weaponPlacementNormal(k,hit.n);
    let a = 2; if (d.cat !== 'b') { let bv = -2; for (let i = 0; i < 6; i++) { const v = C.dot(C.AXES[i], normal); if (v > bv) { bv = v; a = i; } } }
    const f = C.mountFit(ship, {id:-1,k,p:alignFitPoint(hit.p,hit.n).slice(),n:normal.slice(),a,ped:st.ped,...(['trench','casemate'].includes(st.weaponMount)&&d.cat==='w'?{localMount:true}:{})});
    const bad = f.float || (d.casemate&&Math.abs(normal[1])>.65) || (d.cat === 'b' && !d.window && hit.n[1] < 0.2) || C.fitClash(ship, f);
    ls.box(C.fitAABB(f), bad ? ng : ok);
  } else if ((t === 'unfit' || t === 'adjust' || t === 'inspect') && hit.fit) {
    ls.box(C.fitAABB(hit.fit), t === 'unfit' ? ng : cy);
  } else if (t === 'select' && hit.part) {
    ls.part(hit.part, cy);
  } else if (t === 'notch' && (hit.kind === 'hull' || st.notchStructures && hit.part?.k === 'struct')) {
    ls.box(notchBox(hit), ng);
  } else return null;
  return ls;
}
function refreshOverlay() {
  if (!view || !ship) return;
  refreshSolidCutterOverlay();
  const ls = Gfx.lineSet(), it = selItem(), cy = [105, 195, 220, 255];
  // While the engine recomputes, outline the part's requested shape, not its old merged cells.
  const shape = (p) => p && (enginePending() && p._packing ? {...p, _packing: undefined} : p);
  if (it && st.sel.list === 'parts' && (st.tab === 'mod'||st.tab==='launch'||st.tab==='bridge'&&st.bridgeMode==='body')) {
    ls.part(shape(it), cy); const tw = twinOfItem('parts', it); if (tw) ls.part(shape(tw), [105, 195, 220, 140]);
    const vt = it.vt != null ? ship.parts.find(q => q.id === it.vt) : null; if (vt) { ls.part(shape(vt), [105, 195, 220, 140]); const vtw = twinOfItem('parts', vt); if (vtw) ls.part(shape(vtw), [105, 195, 220, 100]); }
  }
  if (tool() === 'multi') { const am = [240, 170, 70, 255]; for (const p of ship.parts) if (st.multi.parts.has(p.id)) ls.part(shape(p), am); for (const f of ship.fits) if (st.multi.fits.has(f.id)) ls.box(C.fitAABB(f), am); }
  if (it && st.sel.list === 'fits' && (armMode() || st.tab === 'bridge')) { ls.box(C.fitAABB(it), cy);const room=C.commandCompartments(ship).find(p=>p.windowId===it.id);if(room)ls.part(room,[142,229,192,255]); }
  const base = ls.out();
  if (hoverLines) {
    const h = hoverLines.out(), pos = new Float32Array(base.pos.length + h.pos.length), col = new Uint8Array(base.col.length + h.col.length);
    pos.set(base.pos); pos.set(h.pos, base.pos.length); col.set(base.col); col.set(h.col, base.col.length);
    view.setLines('ghost', {pos, col});
  } else view.setLines('ghost', base);
  requestDraw();
}
function onHover(px, py) {
  if(fleet.mode!=='design'||trial.on)return;
  if (!ship || !view) return;
  const t = tool();
  if(t === 'solid') return;
  hoverLines = ghostFor(pick(px, py, {parts: t === 'select' || t === 'multi', fits: t === 'unfit' || t === 'adjust' || t === 'inspect' || t === 'fit' || t === 'multi'}));
  refreshOverlay();
}
function clearHover() { hoverLines = null; refreshOverlay(); }

function onTap(px, py) {
  if(trial.on)return;
  if(fleet.mode!=='design'){fleetTap(px,py);return;}
  if(!view)return;
  const t = tool();
  if(t === 'solid') { if(st.cutterAction === 'place') { const hit=pick(px,py,{parts:true,fits:false}); if(hit?.p)placeSolidCutter(hit);else toast('カッターを重ねる船体・構造物をタップしてください'); } return; }
  tapHit(t, pick(px, py, tapWant(t)));
}
// Alignment snaps the placement point, except along the face normal (that
// coordinate stays on the tapped face).
function alignFitPoint(p, n) { if (!st.alignment || st.alignment === 'none') return p; const q = C.alignedPosition(ship, p, st.alignment); for (let a = 0; a < 3; a++) if (Math.abs(n[a]) > .7) q[a] = p[a]; return q; }
function tapWant(t) { return {parts: t === 'select' || t === 'multi' || t === 'inspect' || (t === 'notch' && st.notchStructures), fits: t !== 'part' && t !== 'notch'}; }
function tapHit(t, hit) {
  hoverLines = null;
  switch (t) {
    case 'inspect': showInspect(hit); break;
    case 'select':
      if(hit?.part?.windowId||hit?.part?.weaponId){openLayoutTarget({list:'fits',id:hit.part.windowId||hit.part.weaponId});break;}
      if (hit && hit.part) { if(st.tab==='launch'&&hit.part.k!=='hangar'){toast('航空区画を選択してください');break;}st.sel = {list: 'parts', id: hit.part.id}; renderPanel(); }
      else { st.sel = null; renderPanel(); toast(st.view === 'normal' ? '内部の区画は「透視」で選べます' : '区画が見つかりません'); }
      break;
    case 'part': {
      if (!hit || hit.fit) { toast('船体か構造物の面をタップしてください'); break; }
      const pv = partPreview(hit), k = pv.k;
      let made = null;
      if (mutate(`${C.PARTS[k].name}を配置`, () => { made = C.placePart(ship, k, pv.c, k === 'struct' ? pv.s : pv.d, pv, st.mirror); try { placeVerticalParts(made); } catch (e) { removeLinked('parts', made); made = null; throw e; } }, 'parts') && made) {
        showPreview('parts', linkedItems('parts', made));
        st.sel = {list: 'parts', id: made.id}; renderPanel();
      }
      break;
    }
    case 'fit': {
      if (!hit || hit.kind === 'section') { toast('船体の外面をタップしてください'); break; }
      if (hit.fit) { toast('その場所には装備があります'); break; }
      const k = curFit(); let err = null, made = null;
      mutate(C.FITS[k].short + 'を設置', () => { const opts = {localMount:['trench','casemate'].includes(st.weaponMount)}, r = C.placeFit(ship, k, alignFitPoint(hit.p, hit.n), weaponPlacementNormal(k,hit.n), st.ped, st.mirror, opts); err = r.err; made = r.fit; if (made) { placeVerticalFits(made, k, st.ped, opts); applyPedDefaults(made); applyFitTemplate(made); } }, 'fits', {silent: true});
      if (err) toast(err); else if (made) { showPreview('fits', linkedItems('fits', made)); st.sel = {list: 'fits', id: made.id}; renderPanel(); }
      break;
    }
    case 'multi': multiToggle(hit); break;
    case 'unfit':
      if (hit && hit.fit) removeWithPreview('撤去', 'fits', hit.fit);
      else toast('撤去する装備をタップしてください');
      break;
    case 'adjust':
      if (hit && hit.fit) { st.sel = {list: 'fits', id: hit.fit.id}; showInspect(hit); renderPanel(); }
      else { st.sel = null; renderPanel(); }
      break;
    case 'notch':
      if (!hit || (hit.kind !== 'hull' && !(st.notchStructures && hit.part?.k === 'struct'))) { toast('船体・対象構造の外面をタップしてください'); break; }
      mutate('切り欠き', () => {
        const b = notchBox(hit); ship.subs.push({id: ship.nextId++, structures:st.notchStructures, b});
        if (st.mirror && b[2] > 1) ship.subs.push({id: ship.nextId++, structures:st.notchStructures, b: [b[0], b[1], -b[5], b[3], b[4], -b[2]]});
        else if (st.mirror && b[5] < -1) ship.subs.push({id: ship.nextId++, structures:st.notchStructures, b: [b[0], b[1], -b[5], b[3], b[4], -b[2]]});
      }, 'hull');
      renderPanel();
      break;
  }
  refreshOverlay(); updateHint();
}

// ---------- inspect ----------
function showInspect(hit) {
  const box = $('#inspect');
  if (!hit) { hideInspect(); return; }
  let html = '';
  if (hit.fit) {
    const f = hit.fit, d = C.FITS[f.k];
    html = `<b>${esc(d.name)}</b>`;
    const ped = f.base + f.ped;
    html += `<div class="ins-row">支持台 ${ped.toFixed(1)} m（自動 ${f.base.toFixed(1)}＋追加 ${f.ped.toFixed(1)}）・${esc(C.AXNAME[f.a])}</div>`;
    if (d.cat === 'w') {
      const arc = (S && S.fitInfo[f.id]) || C.fireArcs(ship, f);
      if (d.tt) html += `<div class="ins-row">一斉射 ${fTT(d.tt)}・電力 ${fW(d.power)}</div>`;
      if (Array.isArray(arc)) html += `<div class="arcs">${C.SECTORS.map((s, k) => `<span><i>${s.name}</i><em style="--w:${Math.round(arc[k] * 100)}%"></em><b>${Math.round(arc[k] * 100)}</b></span>`).join('')}</div><div class="ins-note">射界（%）：各方向へ撃てる割合</div>`;
    } else {
      const vw = S && S.fitInfo[f.id];
      html += `<div class="ins-row">視界 ${vw != null ? fPct(vw) : '—'}・乗員 ${d.crew}名</div>`;
    }
  } else if (hit.part) {
    html = partInfoHTML(hit.part);
  } else if (hit.p) {
    const x = hit.p[0], sb = C.sectionBase(ship.hull, Math.max(0, Math.min(ship.hull.L, x))), kb = C.keelAt(ship, x);
    html = `<b>船体</b><div class="ins-row">艦尾から ${fLen(x)}・この断面 幅 ${fLen(sb.hw * 2)} × 高さ ${fLen(sb.h)}</div>`;
    if (kb) html += `<div class="ins-row">竜骨 幅 ${fLen(kb.w)} × 高さ ${fLen(kb.h)}</div>`;
    html += `<div class="ins-row">外殻装甲 ${ship.armor.hull.toFixed(2)} m</div>`;
  }
  box.innerHTML = html + '<button type="button" class="ins-x" aria-label="閉じる">×</button>';
  box.hidden = false;
}
function hideInspect() { const b = $('#inspect'); if (b) b.hidden = true; }
function partInfoHTML(pt) {
  const d = C.PARTS[pt.k], V = C.partVolume(pt), inf = S && S.info[pt.id];
  let h = `<b>${esc(C.partLabel(pt))}</b><div class="ins-row">${pt.k === 'struct'||pt.room ? `${(pt.room||pt.s).map(v => Math.round(v)).join('×')} m` : `${pt.k === 'hangar' ? '一辺' : '直径'} ${precisePartSize(pt) ? num(pt.d, 2) + ' m' : fLen(pt.d)}`}・体積 ${ja(V)} m³</div>`;
  if (C.isReactor(pt)) h += `<div class="ins-row" data-reactor-output>発電出力（体積換算） ${reactorOutputText(pt)}</div>`;
  if (['shield','localShield'].includes(pt.k)) h += `<div class="ins-row" data-equipment-performance>シールド出力（体積換算） ${fW(V * C.K.shieldW)}<br>蓄積容量 ${sci(C.shieldLoad(pt))} J</div>`;
  if (pt.k === 'hyper') h += `<div class="ins-row" data-equipment-performance>有効容量 ${ja(C.hyperCapacity(pt))} m³・跳躍消費 ${fW(C.hyperCapacity(pt) * C.K.hyperW)}</div>${S ? `<div class="ins-row">艦全体の主機クラス ${S.hyperClass == null ? 'なし' : num(S.hyperClass, 1)}</div>` : ''}`;
  if (pt.k === 'engine') h += `<div class="ins-row" data-equipment-performance>推力（寸法換算） ${sci(C.nozzleThrust(pt))} N<br>消費電力（寸法換算） ${fW(C.nozzleDemand(pt))}</div>`;
  if (pt.k === 'hangar') h += `<div class="ins-row">${esc(C.AVIATION_ROLES[pt.airRole]||'格納・発着兼用')} · 容量 ${C.hangarCapacity(pt).toFixed(2)} サイズ${inf ? (inf.acc ? '・発着路接続' : '・発着路未接続') : ''}</div>`;
  if(pt.k==='engine'){const r=C.reactorFor(ship,pt),path=C.enginePaths(ship).find(q=>q.nozzle===pt.id);h+=`<div class="ins-row">${r?'接続炉 #'+r.id:'炉に未接続'}${path?'・自動機関 '+ja(C.partVolume(path))+' m³':''}</div>`;}
  if (pt.k === 'engine' && inf) h += `<div class="ins-row">${inf.vent ? '噴射口が開いています' : '噴射口が塞がり推力ゼロ'}</div>`;
  if (inf && pt.k !== 'struct') h += `<div class="ins-row">船体内 ${fPct(inf.inside)}・表面の露出 ${fPct(inf.exposed)}${inf.overlap ? '・<span class="neg">他の区画と重なっています</span>' : ''}</div>`;
  return h;
}

// ---------- toast ----------
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.innerHTML = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
function toastDiff(label, a, b) {
  const items = [];
  const pct = (x, y) => x > 0 ? (y - x) / x : 0;
  const add = (name, v, good) => { if (Math.abs(v) >= 0.005) items.push([Math.abs(v), `<span class="${(v > 0) === good ? 'up' : 'down'}">${name} ${v > 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%</span>`]); };
  add('質量', pct(a.mass, b.mass), false);
  add('加速', pct(a.accelG, b.accelG), true);
  add('表面積', pct(a.area, b.area), false);
  add('出力', pct(a.power, b.power), true);
  add('一斉射', pct(a.alphaTot, b.alphaTot), true);
  add('シールド', pct(a.shieldPct, b.shieldPct), true);
  add('搭載機', pct(a.slots, b.slots), true);
  items.sort((x, y) => y[0] - x[0]);
  toast(`<b>${esc(label)}</b>${items.slice(0, 3).map(x => x[1]).join('')}`);
}

// ---------- stat strip & spec ----------
function renderStrip() {
  if (!S) return;
  const warn = S.warnings.filter(w => w.lv !== 'info');
  const bad = warn.some(w => w.lv === 'bad');
  $('#statstrip').innerHTML = `
    <span class="ss"><i>全長</i><b>${fLen(S.hullLen)}</b></span>
    <span class="ss"><i>質量</i><b>${fMass(S.mass)}</b></span>
    <span class="ss"><i>出力</i><b>×${S.xISD >= 0.1 ? S.xISD.toFixed(2) : S.xISD.toFixed(3)}<small>ISD</small></b></span>
    <span class="ss"><i>加速</i><b>${fG(S.accelG)}</b></span>
    <span class="ss"><i>一斉射</i><b>${fTT(S.alphaTot)}</b></span>
    <span class="ss-flag ${bad ? 'bad' : warn.length ? 'warn' : 'ok'}" aria-label="警告 ${warn.length} 件">${warn.length ? warn.length : '✓'}</span>`;
}
function bar(frac, cls) { return `<span class="bar ${cls || ''}"><em style="width:${Math.max(0, Math.min(100, frac * 100)).toFixed(1)}%"></em></span>`; }
function radar(S) {
  const sc = scores(S), n = 6, R = 62, cx = 90, cy = 82;
  const pt = (k, r) => [cx + Math.sin(k / n * Math.PI * 2) * r, cy - Math.cos(k / n * Math.PI * 2) * r];
  let grid = '';
  for (const f of [0.33, 0.66, 1]) grid += `<polygon points="${sc.map((_, k) => pt(k, R * f).join(',')).join(' ')}" class="rg"/>`;
  const axes = sc.map((_, k) => { const p = pt(k, R); return `<line x1="${cx}" y1="${cy}" x2="${p[0]}" y2="${p[1]}" class="rg"/>`; }).join('');
  const poly = sc.map((s, k) => pt(k, R * Math.max(0.04, s.v / 100)).join(',')).join(' ');
  const labels = sc.map((s, k) => { const p = pt(k, R + 13); return `<text x="${p[0]}" y="${p[1] + 4}" text-anchor="middle" class="rl">${s.k}</text>`; }).join('');
  return `<svg class="radar" viewBox="0 0 180 168" role="img" aria-label="性能レーダー">${grid}${axes}<polygon points="${poly}" class="rp"/>${labels}</svg>`;
}
function scores(S) {
  const cl = (v) => Math.max(0, Math.min(100, v));
  const fpd = S.mass > 0 ? S.alphaBest / (S.mass / 1e6) : 0;
  return [
    {k: '火力', v: cl(100 * (1 - Math.exp(-fpd / 100)))},
    {k: '防御', v: cl(40 * Math.min(1, S.shieldPct / 1.5) + 35 * Math.min(1, S.armorHull / 1.5) + 25 * S.protectedFrac)},
    {k: '速力', v: cl(100 * Math.min(1, S.accelG / 4000))},
    {k: '航空', v: cl(100 * Math.min(1, (S.cls.hangarFrac || 0) / 0.3))},
    {k: '超空間', v: S.hyperClass ? cl(100 * (6 - S.hyperClass) / 5.5) : 0},
    {k: '耐久', v: cl(60 * Math.min(1, S.aStruct / Math.max(1e-9, S.aThrust || 1) / 1.5) + 40 * (1 - S.vuln))},
  ];
}
function specHTML(S) {
  if (!S) return '<p class="muted">計算中…</p>';
  const P = S.power || 1, d = S.draw, cmb = d.weapons + d.shields + 0.35 * d.engines + d.hotel + d.ray;
  const scale = Math.max(P, cmb);
  const segs = [['兵装', d.weapons, 'w'], ['シールド', d.shields, 's'], ['機関', 0.35 * d.engines, 'e'], ['その他', d.hotel + d.ray, 'o']];
  const maxSec = Math.max(1, ...S.alpha);
  const comp = [['gen', S.frac.gen], ['shield', S.frac.shield], ['hyper', S.frac.hyper], ['engine', S.frac.engine], ['hangar', S.frac.hangar]].filter(x => x[1] > 0);
  const rest = Math.max(0, 1 - comp.reduce((a, b) => a + b[1], 0));
  const warnHTML = S.warnings.length ? S.warnings.map(inspectionHTML).join('') : '<li class="w-ok">大きな問題はありません。</li>';
  return `
  <div class="spec-head">
    <div class="spec-cls"><span class="role">${esc(S.cls.role)}</span><span class="clsname">${esc(C.shipClassFor(S.hullLen, ship.shipClass).name)}</span><small class="firepower-class">火力区分 ${esc(S.cls.name)}</small></div>
    ${radar(S)}
  </div>
  <dl class="kv">
    <div><dt>全長×全幅×全高</dt><dd>${fLen(S.dims[0])} × ${fLen(S.dims[1])} × ${fLen(S.dims[2])}</dd></div>
    <div><dt>質量</dt><dd>${fMass(S.mass)}<small>装甲 ${fMass(S.armorMass)}</small></dd></div>
    <div><dt>主機出力</dt><dd>${fW(S.power)}<small>ISD比 ×${S.xISD.toFixed(2)}</small></dd></div>
    <div><dt>一斉射（全砲）</dt><dd>${fTT(S.alphaTot)}<small>主射界 ${fTT(S.alphaBest)}</small></dd></div>
    <div><dt>最大加速</dt><dd>${fG(S.accelG)}<small>MGLT ${S.MGLT}</small></dd></div>
    <div><dt>ハイパードライブ</dt><dd>${S.hyperClass ? 'クラス ' + S.hyperClass.toFixed(1) : 'なし'}<small>${S.hyperClass ? (S.jumpOK ? '跳躍電力 可' : '跳躍電力 不足') : ''}</small></dd></div>
    <div><dt>シールド強度</dt><dd>${fPct(S.shieldPct)}<small>${fW(S.shieldP)}</small></dd></div>
    <div><dt>装甲</dt><dd>外殻 ${S.armorHull.toFixed(2)} m<small>集中防御 ${S.armorCit.toFixed(1)} m</small></dd></div>
    <div><dt>搭載機</dt><dd>${num(Math.floor(S.slots))} 機<small>容量 ${(S.aviation?.capacity||0).toFixed(2)} サイズ · 発艦可能 ${num(S.deployableSlots??S.slots)} 機</small></dd></div>
    <div><dt>乗員</dt><dd>${num(S.crew)} 名<small>居住 ${S.habit >= 1 ? '充足' : fPct(S.habit)}</small></dd></div>
    <div><dt>建造費</dt><dd>${fCr(S.cost)}</dd></div>
    <div><dt>体積／表面積</dt><dd>${S.VS.toFixed(1)} m<small>${ja(S.volume)} m³ ／ ${ja(S.area)} m²</small></dd></div>
  </dl>
  <h4>電力配分（戦闘時）</h4>
  <div class="pbar" role="img" aria-label="戦闘時の電力配分">${segs.map(([n, v, c]) => `<em class="p-${c}" style="width:${(v / scale * 100).toFixed(2)}%" title="${n}"></em>`).join('')}${cmb > P ? `<i class="pmark" style="left:${(P / scale * 100).toFixed(2)}%"></i>` : ''}</div>
  <div class="plegend">${segs.map(([n, v, c]) => `<span><i class="p-${c}"></i>${n} ${S.power > 0 ? Math.round(v / P * 100) + '%' : '—'}</span>`).join('')}<span class="${S.rc === 0 ? 'neg' : ''}">兵装充電 ${fPct(S.rc)}</span></div>
  <h4>加速の上限</h4>
  <div class="lim"><span>推力</span>${bar(S.thrustG / Math.max(S.thrustG, S.structG, 1), 'b-e')}<b>${fG(S.thrustG)}</b></div>
  <div class="lim"><span>縦強度</span>${bar(S.structG / Math.max(S.thrustG, S.structG, 1), 'b-s')}<b>${fG(S.structG)}</b></div>
  ${S.weakAt != null ? `<p class="note">最弱断面：艦尾から ${fLen(S.weakAt)}。質量を削るか、構造物や竜骨を太くすると上がります。</p>` : ''}
  <h4>射界別の一斉射</h4>
  <div class="sect">${C.SECTORS.map((s, k) => `<div class="lim"><span>${s.name}</span>${bar(S.alpha[k] / maxSec, 'b-w')}<b>${fTT(S.alpha[k])}</b></div>`).join('')}</div>
  <p class="note">主射界効率 ${fPct(S.arcEff)}・点防御 ${S.aa.toFixed(0)}・ミサイル ${fTT(S.mslSalvo)}／20秒・命中補正 ${fPct(S.accuracy)}</p>
  <h4>船体容積の内訳</h4>
  <div class="cbar">${comp.map(([k, f]) => `<em style="width:${(f * 100).toFixed(2)}%;background:${rgb(C.PARTS[k].col)}" title="${C.PARTS[k].name}"></em>`).join('')}<em style="width:${(rest * 100).toFixed(2)}%;background:var(--line-2)" title="その他"></em></div>
  <div class="clegend">${comp.map(([k, f]) => `<span><i style="background:${rgb(C.PARTS[k].col)}"></i>${C.PARTS[k].name} ${(f * 100).toFixed(1)}%</span>`).join('')}<span><i style="background:var(--line-2)"></i>居住・倉庫ほか ${(rest * 100).toFixed(1)}%</span></div>
  <p class="note">重要区画の防護 ${fPct(S.protectedFrac)}・ジェネレーター露出 ${fPct(S.genExpFrac)}・開放容積（格納庫）${fPct(S.cls.hangarFrac || 0)}${S.frac.struct > 0 ? `・構造物 ${ja(S.frac.struct * S.hullVolume)} m³` : ''}</p>
  <h4>点検</h4>
  <ul class="warns">${warnHTML}</ul>`;
}
function renderSpecTargets() {
  if(fleet.mode!=='design'){fleetRender();return;}
  const side = $('#specSide');
  if (isWide()) side.innerHTML = `<div class="spec-title"><h3>性能諸元</h3></div>` + trialCardHTML(true) + specHTML(S);
  if (st.tab === 'spec') { const p = $('#panel .spec-wrap'); if (p) p.innerHTML = specHTML(S); }
}
const isWide = () => window.matchMedia('(min-width: 1000px)').matches;

// ---------- panels ----------
function seg(name, opts, cur) {
  return `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-${name}="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
}
function slider(id, label, v, min, max, step, out) {
  return `<label class="sl"><span class="sl-l">${label}</span><input type="range" id="sl-${id}" data-sl="${id}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label}"><input class="sl-num" type="number" data-sl="${id}" min="${min}" max="${max}" step="${step}" value="${v}" aria-label="${label} 数値"><output id="out-${id}">${out}</output></label>`;
}
function silhouette(hp) {
  const pts = [], n = 28;
  for (let k = 0; k <= n; k++) { const t = k / n, w = C.profileAt(hp,t)[1]; pts.push([4 + t * 92, 20 - w * 15]); }
  for (let k = n; k >= 0; k--) { const t = k / n, w = C.profileAt(hp,t)[1]; pts.push([4 + t * 92, 20 + w * 15]); }
  return `<svg viewBox="0 0 100 40" aria-hidden="true"><polygon points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}"/></svg>`;
}
function partCard(k, sel) {
  const d = C.PARTS[k];
  return `<button type="button" class="part${sel ? ' on' : ''}" data-part="${k}" aria-pressed="${sel}"><i class="sw sh-${d.shape}" style="background:${rgb(d.col)}"></i><span class="pn">${d.name}</span><span class="pd">${esc(d.desc)}</span></button>`;
}
function fitBtn(k, sel, data) {
  const d = C.FITS[k];
  const spec = d.tt ? fTT(d.tt) : d.ion ? `対シールド ${d.ion}TT` : d.msl ? `${d.msl}TT／20秒` : d.sensor ? `視界係数 ${d.sensor}` : '牽引';
  return `<button type="button" class="fitb${sel ? ' on' : ''}" data-${data}="${k}" aria-pressed="${sel}"><span class="fn">${esc(d.name)}</span><span class="fs">${spec}・${d.pod?`直径 ${Math.round(d.fm)} m・高さ ${d.wm} m`:`${Math.round(d.fm)}×${Math.round(d.wm)}×${Math.round(d.hm)} m`}</span><span class="fd">${esc(d.desc)}${d.cycle?' 連射間隔 '+d.cycle+'秒。':''}</span></button>`;
}
const fmtM = (v) => `${Math.round(v)} m`;
function basePartEditor() {
  const it = selItem(); if (!it || st.sel.list !== 'parts') return '';
  const d = C.PARTS[it.k], hp = ship.hull, tw = twinOfItem('parts', it);
  let h = `<div class="editor"><div class="ed-head"><b>${esc(C.partLabel(it))}</b>${tw ? '<span class="tag">左右対</span>' : ''}<button type="button" class="btn sm ghost" data-desel>選択解除</button><button type="button" class="btn sm danger" data-delsel>撤去</button></div>
    <p class="note tight">位置は艦尾・船底・中心線からの距離です。</p>
    <div class="sliders">
    ${slider('ex', '前後 X', Math.round(it.c[0]), Math.round(-hp.L * 0.1), Math.round(hp.L * 1.1), 1, fmtM(it.c[0]))}
    ${slider('ey', '高さ Y', Math.round(it.c[1]), Math.round(-hp.H * 0.8), Math.round(hp.H * 3.5), 1, fmtM(it.c[1]))}
    ${slider('ez', '左右 Z', Math.round(it.c[2]), Math.round(-hp.W * 0.75), Math.round(hp.W * 0.75), 1, fmtM(it.c[2]))}`;
  if (it.k === 'struct') {
    h += slider('el', '長さ', Math.round(it.s[0]), 10, Math.round(hp.L), 1, fmtM(it.s[0]))
      + slider('ew', '幅', Math.round(it.s[1]), 5, Math.round(hp.W * 1.2), 1, fmtM(it.s[1]))
      + slider('eh', '高さ', Math.round(it.s[2]), 5, Math.round(Math.max(60, hp.H * 1.5)), 1, fmtM(it.s[2]))
      + slider('et', '上すぼまり', Math.round((it.taper || 0) * 100), 0, 80, 1, Math.round((it.taper || 0) * 100) + '%');
  } else if (it.room) {
    h += it.room.map((v,i)=>slider('room'+i,['長さ','幅','高さ'][i],v,4,[hp.L,hp.W,hp.H][i],1,fmtM(v))).join('');
  } else if (it.k === 'hangar') {
    h += `</div><div class="pgroup chips">${C.PARTS.hangar.sizes.map(s => `<button type="button" class="chip" data-hsize="${s}" aria-pressed="${it.d === s}">${s} m</button>`).join('')}</div><div class="sliders">`;
  } else if (!C.parametricEngine(it)) {
    const precise = precisePartSize(it);
    h += slider('ed', '直径', precise ? it.d : Math.round(it.d), d.min, precise ? C.DESIGN_LIMITS.diameter : Math.max(it.d,Math.min(C.DESIGN_LIMITS.diameter,Math.max(d.max,hp.H*1.5))), precise ? .1 : 1, precise ? num(it.d, 2) + ' m' : fmtM(it.d));
  }
  h += `</div><div class="ed-info" id="edinfo">${partInfoHTML(it).replace(/^<b>[^<]*<\/b>/, '')}</div></div>`;
  return h;
}
function baseFitEditor() {
  const it = selItem(); if (!it || st.sel.list !== 'fits') return '';
  const d = C.fitSpec(it), tw = twinOfItem('fits', it);
  return `<div class="editor"><div class="ed-head"><b>${esc(d.name)}</b>${tw ? '<span class="tag">左右対</span>' : ''}<button type="button" class="btn sm ghost" data-desel>選択解除</button><button type="button" class="btn sm danger" data-delsel>撤去</button></div>
    ${fitPositionSliders(it)}
    <h4>支持台</h4>${seg('pedshapesel', PED_SHAPES, it.pedShape || 'round')}
    <div class="sliders">${slider('pedsel', '追加の高さ', it.ped.toFixed(1), 0, Math.max(60, Math.round(d.r * 4)), 0.5, `${it.ped.toFixed(1)} m`)}${slider('pedsizesel', '大きさ', Math.round((it.pedSize || 1) * 100), 40, 250, 5, Math.round((it.pedSize || 1) * 100) + '%')}</div>
    <p class="note" id="pedinfo">傾斜に合わせた自動の高さ ${it.base.toFixed(1)} m ＋ 追加 ${it.ped.toFixed(1)} m。高くすると射界が開けますが、標的にもなりやすくなります。</p></div>`;
}
function partList() {
  const items = ship.parts.filter(p => !(p.tw && p.id > p.tw));
  const nh = ship.parts.filter(p => p.k === 'hangar').length;
  if (!items.length && !nh) return '<p class="note">区画はまだありません。</p>';
  return `<div class="plist">${items.map(p => `<button type="button" class="chip${st.sel && st.sel.id === p.id ? ' on' : ''}" data-selpart="${p.id}"><i class="sw sh-${C.PARTS[p.k].shape}" style="background:${rgb(C.PARTS[p.k].col)}"></i>${esc(C.partLabel(p))}${p.k === 'struct' ? '' : ' ' + (p.room?p.room.map(Math.round).join('×'):Math.round(p.d)) + 'm'}${p.tw ? ' ×2' : ''}</button>`).join('')}${nh ? `<span class="chip ghost">航空区画 ${nh} 個</span>` : ''}</div>`;
}
function baseRenderPanel() {
  const p = $('#panel');
  if (!ship) return;
  if (st.sel && !findSel(st.sel)) st.sel = null;
  markTabs();
  let h = '';
  const hp = ship.hull;
  switch (st.tab) {
    case 'hull': {
      // The hull type is chosen when a design starts; editing keeps its outline controls.
      h = `<div class="pgroup sliders">
        ${slider('bowW', '艦首先端の絞り率（幅・厚み）', hp.bowW * 100, .5, 100, .1, `${num(hp.bowW * 100,1)}%`)}
        ${hp.plan === 'arrow' ? slider('stern', '艦尾幅', Math.round(hp.stern * 100), 20, 100, 1, `${Math.round(hp.stern * 100)}%`) : ''}
        ${hp.plan === 'arrow' && !hp.stations?.length ? slider('maxAt', '最大幅の位置（艦尾から）', Math.round((hp.maxAt ?? .3) * 100), 5, 90, 1, `${Math.round((hp.maxAt ?? .3) * 100)}% · ${fLen((hp.maxAt ?? .3) * hp.L)}`) : ''}
      </div>${hp.plan === 'arrow' && hp.stations?.length ? '<p class="note">断面を設計済みのため、最大幅の位置は下の表の「幅 %」で調整します。</p>' : ''}
      <div class="pgroup"><h4>断面</h4>${seg('sec', Object.entries(C.SECTIONS), hp.sec)}</div>
      <div class="pgroup"><h4>竜骨（主構造）</h4>${seg('keel', Object.entries(C.KEELS).map(([k, v]) => [k, v.name]), ship.keel || 'std')}<p class="note">竜骨は船底の中央を通る主構造で、縦強度の柱です。透視で見えます。区画が竜骨を断ち切ると、その断面は弱くなります。</p></div>

      <div class="pgroup row2"><button type="button" class="btn" id="btnClear">${confirmClear ? 'もう一度押すと区画と装備をすべて外します' : '区画と装備をすべて外す'}</button></div>`;
      break;
    }
    case 'mod': {
      const k = st.part;
      h = `<div class="pgroup">${seg('parttool', [['place', '配置'], ['select', '選択・調整'], ['multi', '複数選択']], st.partTool)}</div>`;
      if (st.partTool === 'place') {
        h += `<div class="parts">${PART_KEYS.filter(t=>C.PARTS[t].group===st.group).map(t => partCard(t, k === t&&!activeEquipment())).join('')}${Object.values(C.EQUIPMENT).filter(d=>d.group===st.group).map(d=>equipmentCard(d.id)).join('')}</div>`;
        if (k === 'struct') {
          h += `<div class="pgroup sliders"><h4>構造物の大きさ</h4>
            ${slider('sl', '長さ', st.structSize[0], 10, Math.round(hp.L), 1, fmtM(st.structSize[0]))}
            ${slider('sw', '幅', st.structSize[1], 5, Math.round(hp.W * 1.2), 1, fmtM(st.structSize[1]))}
            ${slider('sh', '高さ', st.structSize[2], 5, Math.round(Math.max(60, hp.H * 1.5)), 1, fmtM(st.structSize[2]))}
            ${slider('st', '上すぼまり', Math.round(st.structTaper * 100), 0, 80, 1, Math.round(st.structTaper * 100) + '%')}</div>
            <p class="note">構造物は面の上に3割ほど沈めて据えます。船台構造物で反応炉の張り出しを覆うと露出が減り、縦強度も上がります。</p>`;
        } else {
          if (k === 'hangar') h += `<div class="pgroup"><h4>自動充填のセルサイズ</h4><div class="chips">${C.PARTS.hangar.sizes.map(s => `<button type="button" class="chip" data-psize="${s}" aria-pressed="${st.size.hangar === s}">${s} m</button>`).join('')}</div></div>`;
          else if(!activeEquipment()&&C.PARTS[k].shape!=='cube') h += `<div class="pgroup sliders">${slider('psize', '直径', st.size[k], C.PARTS[k].min, precisePartSize({k}) ? C.DESIGN_LIMITS.diameter : Math.min(C.DESIGN_LIMITS.diameter,Math.max(C.PARTS[k].max,hp.H*1.5)), precisePartSize({k}) ? .1 : 1, sizeOut(k, st.size[k]))}</div>`;
          h += `<div class="pgroup"><h4>置き方</h4>${seg('place', PLACE, st.placeBy[k])}<p class="note">内蔵：面の内側に収める／一部露出：3割ほど外に出す／外付け：面の外に据える。船内の任意の位置には「座標を指定して配置」を使います。</p></div>`;
          if (k === 'hangar') h += `<div class="pgroup sliders"><h4>自動充填</h4>
            ${slider('ffrom', '範囲（艦尾側）', Math.round(st.fill[0] * 100), 0, 95, 1, Math.round(st.fill[0] * 100) + '%')}
            ${slider('fto', '範囲（艦首側）', Math.round(st.fill[1] * 100), 5, 100, 1, Math.round(st.fill[1] * 100) + '%')}
            <div class="row2"><button type="button" class="btn primary" id="btnFill">空きを ${st.size.hangar} m 格納庫で埋める</button><button type="button" class="btn ghost" id="btnUnfill">航空区画をすべて外す</button></div>
            <p class="note">ほかの区画と竜骨を避けて、船体の内側だけを埋めます。</p></div>`;
        }
      } else if (st.partTool === 'multi') {
        h += multiPanelHTML();
      } else {
        h += partEditor() || '<p class="note">区画をタップするか、下の一覧から選んでください。</p>';
      }
      h += `<div class="pgroup"><h4>配置済みの区画</h4>${partList()}</div><div class="pinfo" id="pinfo"></div>`;
      break;
    }
    case 'launch':
      h = aviationPanelHTML()+`<div class="pinfo" id="pinfo"></div>`;
      break;
    case 'arm':
      h = `<div class="pgroup">${seg('fittool', [['place', '設置'], ['adjust', '調整・射界'], ['remove', '撤去'], ['multi', '複数選択']], st.fitTool)}</div>
      ${st.fitTool === 'adjust' ? (fitEditor() || '<p class="note">装備をタップして選んでください。</p>') : ''}${st.fitTool === 'multi' ? multiPanelHTML() : ''}
      ${st.fitTool === 'place' ? `<div class="pgroup sliders"><h4>支持台（新設時）</h4>${seg('pedshape', PED_SHAPES, st.pedShape)}${slider('ped', '追加の高さ', st.ped, 0, 40, 0.5, `${st.ped} m`)}${slider('pedsize', '大きさ', Math.round(st.pedSize * 100), 40, 250, 5, Math.round(st.pedSize * 100) + '%')}</div>` : ''}
      <div class="fits">${WEAPONS.map(k => fitBtn(k, st.fit === k, 'fit')).join('')}</div>
      <p class="note">砲塔は実寸で、新しく置くと砲身は艦首を向きます。傾斜面では接地面の高低差だけ支持台が自動で伸び、砲は水平を保ちます。「調整」で1基ずつ支持台の形・高さ・大きさを変えられます。</p>
      <div class="pinfo" id="pinfo"></div>`;
      break;
    case 'bridge':
      h = `<div class="pgroup">${seg('bridgetool', [['place', '設置'], ['adjust', '調整'], ['remove', '撤去']], st.bridgeTool)}</div>
      ${st.bridgeTool === 'adjust' ? (fitEditor() || '<p class="note">艦橋をタップして選んでください。</p>') : ''}
      ${st.bridgeTool === 'place' ? `<div class="pgroup sliders">${slider('ped', '支持台の追加の高さ（新設時）', st.ped, 0, 40, 0.5, `${st.ped} m`)}</div>` : ''}
      <div class="fits">${BRIDGES.map(k => fitBtn(k, st.bridge === k, 'bridge')).join('')}</div>
      <p class="note">艦橋は上向きの面に置きます。周囲が開けているほど視界（命中補正）が上がります。</p>
      <div class="pinfo" id="pinfo"></div>`;
      break;
    case 'armor':
      h = `<div class="pgroup sliders">
        ${slider('arh', '外殻装甲の厚さ', ship.armor.hull, 0, C.ARMOR_MAX.hull, 0.05, `${ship.armor.hull.toFixed(2)} m`)}
        ${slider('arc', '集中防御（重要区画の囲い）', ship.armor.cit, 0, C.ARMOR_MAX.cit, 0.1, `${ship.armor.cit.toFixed(1)} m`)}
      </div>
      <p class="note">外殻装甲の質量は表面積に比例します。削って凹凸を増やすほど同じ厚さでも重くなります。集中防御はジェネレーター・シールド発生器・ハイパードライブの表面だけを囲み、露出した反応炉の弱点を補います。</p>
      <div class="pinfo" id="pinfo"></div>`;
      break;
    case 'carve': {
      const r = st.razee;
      h = `<div class="pgroup carve-tools">${seg('carvetool', [['solid', '立体で切る'], ['trench', 'トレンチ'], ['razee', '斜め削り'], ['notch', '面から切る'], ['plan', '平面の台形']], st.carveTool)}</div>`;
      if (st.carveTool === 'solid') h += solidCutPanelHTML();
      else if (st.carveTool === 'trench') h += trenchPanelHTML();
      else if (st.carveTool === 'plan') h += planCutControls();
      else if (st.carveTool === 'razee') {
        h += `<div class="pgroup razee">
          <p class="note">断面の角を斜めに削ぎ、台形にします。竜骨は残るので質量だけが減り、加速と縦強度の余裕が上がります。表面積は変わり、装甲とシールドの負担に響きます。</p>
          ${seg('rzside', [['both', '両舷'], ['port', '左舷'], ['stbd', '右舷']], r.side)}
          ${seg('rzedge', [['top', '上縁'], ['bottom', '下縁'], ['both', '上下']], r.edge)}
          <div class="sliders">
            ${slider('rzinset', '削り幅', r.inset, 2, Math.round(hp.W / 2), 1, fmtM(r.inset))}
            ${slider('rzslope', '傾斜の高さ', r.slope, 2, Math.round(hp.H), 1, fmtM(r.slope))}
            ${slider('rzfrom', '範囲（艦尾側）', Math.round(r.from * 100), 0, 95, 1, `${Math.round(r.from * 100)}%`)}
            ${slider('rzto', '範囲（艦首側）', Math.round(r.to * 100), 5, 100, 1, `${Math.round(r.to * 100)}%`)}
          </div>
          <label class="check"><input type="checkbox" id="rzprop" ${r.prop ? 'checked' : ''}> 船幅のすぼまりに合わせる</label>
          <button type="button" class="btn primary" id="btnRazee">ラザー化を加える</button>
        </div>`;
      } else {
        const n = st.notch;
        h += `<div class="pgroup sliders">
          ${slider('nl', '長さ', n.l, 5, Math.round(hp.L / 2), 1, fmtM(n.l))}
          ${slider('nw', '幅', n.w, 5, Math.round(hp.W), 1, fmtM(n.w))}
          ${slider('nd', '深さ', n.d, 2, Math.round(Math.max(hp.H, hp.W / 2)), 1, fmtM(n.d))}</div>
          ${seg('notchstructures', [['no','船体のみ'],['yes','船体と構造']], st.notchStructures?'yes':'no')}<p class="note">対象の外面をタップすると、その面から箱形に切り欠きます。格納庫の開口や砲座の段差に使えます。</p>`;
      }
      if(st.carveTool !== 'solid')h += `<details class="pgroup"><summary>ほかの加工の一覧</summary>${cutList()}</details>`;
      h += `<div class="pinfo" id="pinfo"></div>`;
      break;
    }
    case 'spec':
      h = `<div class="spec-wrap">${specHTML(S)}</div>`;
      break;
    case 'sim':
      h = simHTML();
      break;
  }
  p.innerHTML = h;
  renderPanelInfo();
  updateHint(); refreshOverlay();
  if (st.tab === 'sim') ensureOpponents();
}
function sizeOut(k, d) {
  const pt = {k, d, c: [0, 0, 0]}, V = C.partVolume(pt);
  if (C.isReactor(pt)) return `${num(d, 2)} m・${reactorOutputText(pt)}`;
  if (['shield','localShield'].includes(k)) return `${num(d, 2)} m・${fW(V * C.K.shieldW)}・蓄積 ${sci(C.shieldLoad(pt))} J`;
  if (k === 'hyper') return `${num(d, 2)} m・有効容量 ${ja(C.hyperCapacity(pt))} m³`;
  if (k === 'engine') return `${num(d, 2)} m・推力 ${sci(C.nozzleThrust(pt))} N`;
  return `${d} m`;
}
function cutList() {
  const rows = [];
  for (const c of ship.cuts) {if(c.type==='planTrapezoid'){rows.push(`<li><span><b>平面の台形切削</b>${{both:'両舷',port:'左舷',stbd:'右舷'}[c.side]} · ${Math.round(c.from*100)}〜${Math.round(c.to*100)}% · 中央幅 ${Math.round(ship.hull.W*c.remainingWidth)} m</span><button class="btn sm ghost" data-delcut="${c.id}">取り消す</button></li>`);continue;} rows.push(`<li><span><b>ラザー化</b>${{both: '両舷', port: '左舷', stbd: '右舷'}[c.side]}・${{top: '上縁', bottom: '下縁', both: '上下'}[c.edge]}・幅 ${Math.round(c.inset)} m・高さ ${Math.round(c.slope)} m・${Math.round(c.from * 100)}〜${Math.round(c.to * 100)}%</span><button type="button" class="btn sm ghost" data-delcut="${c.id}">取り消す</button></li>`);}
  for (const s of ship.subs) rows.push(`<li><span><b>切り欠き</b>${Math.round(s.b[3] - s.b[0])}×${Math.round(s.b[5] - s.b[2])}×${Math.round(Math.min(s.b[4] - s.b[1], 9999))} m・艦尾から ${Math.round((s.b[0] + s.b[3]) / 2)} m</span><button type="button" class="btn sm ghost" data-delsub="${s.id}">取り消す</button></li>`);
  return rows.length ? `<ul class="ilist">${rows.join('')}</ul>` : '<p class="note">まだ削っていません。</p>';
}
function renderPanelInfo() {
  const box = $('#pinfo'); if (!box || !S) return;
  let h = '';
  switch (armMode() ? 'arm' : st.tab) {
    case 'mod': h = `<div class="mini"><span>出力 ${fW(S.power)}（ISD比 ×${S.xISD.toFixed(2)}）</span><span>推力 ${fG(S.thrustG)}</span><span>シールド ${fPct(S.shieldPct)}</span><span>ハイパー ${S.hyperClass ? 'クラス' + S.hyperClass.toFixed(1) : 'なし'}</span><span>搭載機 ${num(Math.floor(S.slots))}</span><span>反応炉の露出 ${fPct(S.genExpFrac)}</span></div>`; break;
    case 'launch': { const a=S.aviation||C.aviationStatus(ship,S.info),closed=S.slidingHatches>0&&S.launch===0; h=`<div class="mini"><span>搭載 ${num(a.embarkedCount)} 機</span><span>${a.usedSize.toFixed(2)} / ${a.capacity.toFixed(2)} サイズ</span><span>発艦可能 ${num(a.deployableCount)} 機</span><span>${closed?'ハッチ閉鎖中':'発艦 '+S.launch.toFixed(2)+' 機/秒'}</span>${a.overflowSize>0?`<span class="neg">容量超過 ${a.overflowSize.toFixed(2)} サイズ</span>`:''}</div>`; break; }
    case 'arm': h = `<div class="mini"><span>一斉射 ${fTT(S.alphaTot)}</span><span>主射界 ${fTT(S.alphaBest)}（${fPct(S.arcEff)}）</span><span>兵装電力 ${Math.round(S.draw.weapons / Math.max(1, S.power) * 100)}%</span><span>兵装充電 ${fPct(S.rc)}</span></div>`; break;
    case 'bridge': h = `<div class="mini"><span>艦橋 ${S.bridges} 基</span><span>平均視界 ${fPct(S.view)}</span><span>命中補正 ${fPct(S.accuracy)}</span></div>`; break;
    case 'armor': h = `<div class="mini"><span>装甲質量 ${fMass(S.armorMass)}</span><span>表面積 ${ja(S.area)} m²</span><span>重要区画の防護 ${fPct(S.protectedFrac)}</span><span>脆弱性 ${fPct(S.vuln)}</span><span>加速 ${fG(S.accelG)}</span></div>`; break;
    case 'carve': h = `<div class="mini"><span>質量 ${fMass(S.mass)}</span><span>表面積 ${ja(S.area)} m²</span><span>体積／表面積 ${S.VS.toFixed(1)} m</span><span>加速 ${fG(S.accelG)}</span><span>縦強度 ${fG(S.structG)}</span></div>`; break;
  }
  box.innerHTML = h;
  const ei = $('#edinfo'), it = selItem();
  if (ei && it && st.sel.list === 'parts') ei.innerHTML = partInfoHTML(it).replace(/^<b>[^<]*<\/b>/, '');
}

// ---------- hull edits ----------
let confirmClear = false, confirmT = 0;
// Resizing the hull keeps internal compartments where they are by default.
// Items that sit on the outer surface (weapons, windows, structures, exposed
// machinery, notches) move with the surface so they stay attached.
st.hullFollow = 'surface';
const HULL_FOLLOW = [['surface', '外装だけ追従'], ['scale', 'すべて比率で追従'], ['keep', 'すべて位置を保持']];
function scaleContents(fx, fy, fz, mode = 'scale') {
  if (mode === 'keep') return;
  const sc = (p) => [p[0] * fx, p[1] * fy, p[2] * fz], outer = (p) => mode === 'scale' || p.k === 'struct' || !C.isInternal(p);
  const moved = new Set();
  for (const p of ship.parts) if (outer(p)) { p.c = sc(p.c); moved.add(p.id); }
  for (const h of ship.hatches) { if (h.bay && !moved.has(h.bay)) continue; h.a = sc(h.a); h.b = sc(h.b); if(h.portal&&!h.bay&&h.cut){h.cut=sc(h.cut.slice(0,3)).concat(sc(h.cut.slice(3)));} }
  for (const f of ship.fits) f.p = sc(f.p);
  for (const s of ship.subs) { const cx = (s.b[0] + s.b[3]) / 2, cy = (s.b[1] + s.b[4]) / 2, cz = (s.b[2] + s.b[5]) / 2, hx = (s.b[3] - s.b[0]) / 2, hy = (s.b[4] - s.b[1]) / 2, hz = (s.b[5] - s.b[2]) / 2; s.b = [cx * fx - hx, cy * fy - hy, cz * fz - hz, cx * fx + hx, cy * fy + hy, cz * fz + hz]; }
}
function setHullDims(L, W, H) {
  const hp = ship.hull, lim = C.DESIGN_LIMITS;
  L = C.clamp(L, 60, lim.length); W = C.clamp(W, 20, lim.width); H = C.clamp(H, 10, lim.height);
  const fx = L / hp.L, fy = H / hp.H, fz = W / hp.W;
  scaleContents(fx, fy, fz, st.hullFollow); hp.L = L; hp.W = W; hp.H = H;
}
// Length, beam and depth: class-aware range, 1 m steps, typed values and nudges.
function refitOnGeometry() { eng.fitOnGeometry = true; eng.keepCam = true; }
function syncHullInputs(except) {
  const hp = ship.hull;
  for (const k of ['L', 'W', 'H']) { for (const q of $$(`#panel [data-sl="${k}"]`)) if (q !== except) q.value = Math.round(hp[k]); const o = $('#out-' + k); if (o) o.textContent = fLen(hp[k]) + (k === 'L' ? '' : ` · 全長比 ${(hp[k] / hp.L * 100).toFixed(1)}%`); }
}
function hullDimsHTML() {
  const hp = ship.hull, cls = C.shipClassFor(hp.L, ship.shipClass), lim = C.DESIGN_LIMITS;
  const lo = Math.max(60, Math.min(cls.min, hp.L)), hi = Math.min(lim.length, Math.max(cls.max, hp.L));
  const wMax = Math.min(lim.width, Math.max(60, Math.round(hp.L * 1.2), hp.W)), hMax = Math.min(lim.height, Math.max(40, Math.round(hp.L * .6), hp.H));
  const nudge = (k) => `<div class="nudges" role="group" aria-label="${{L: '全長', W: '全幅', H: '全高'}[k]}の微調整">${[-10, -1, 1, 10].map(d => `<button type="button" class="chip" data-nudge="${k}" data-step="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)} m</button>`).join('')}</div>`;
  return `<div class="pgroup blueprint-card hull-dims"><h4>艦種と寸法</h4>
    <label class="field-label">艦種（全長の範囲）<select data-shipclass>${C.SHIP_CLASSES.map(c => `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${esc(c.name)} · ${fLen(c.min)}〜${fLen(c.max)}</option>`).join('')}</select></label>
    <p class="note">${esc(cls.note)}</p>
    <div class="sliders">${slider('L', '全長', Math.round(hp.L * 10) / 10, lo, hi, 1, fLen(hp.L))}${nudge('L')}${slider('W', '全幅', Math.round(hp.W * 10) / 10, 20, wMax, 1, fLen(hp.W) + ` · 全長比 ${(hp.W / hp.L * 100).toFixed(1)}%`)}${nudge('W')}${slider('H', '全高', Math.round(hp.H * 10) / 10, 10, hMax, 1, fLen(hp.H) + ` · 全長比 ${(hp.H / hp.L * 100).toFixed(1)}%`)}${nudge('H')}</div>
    <label class="check"><input type="checkbox" data-hullratio ${st.hullRatio ? 'checked' : ''}> 全長を変えるとき幅と高さも同じ比率で変える</label>
    <h4>寸法を変えたときの搭載物</h4>${seg('hullfollow', HULL_FOLLOW, st.hullFollow)}
    <p class="note">${st.hullFollow === 'surface' ? '格納庫・居住区などの内部区画は位置と寸法を保ちます。武装・艦橋ポッド・構造物・露出した機関は外板に合わせて移動します。' : st.hullFollow === 'scale' ? 'すべての区画と装備の位置を船体寸法の比率で移動します。区画の大きさは変わりません。' : '区画も装備も位置を保ちます。外板から離れた装備は浮いた扱いになります。'}</p></div>`;
}

// ---------- exercise ----------
const OPP = ['frigate', 'destroyer', 'carrier', 'heavy', 'bc'];
function simHTML(){return `<div class="pgroup"><h4>状況図で指揮する艦隊戦</h4><p>敵味方の位置・距離・射程を確認し、艦を選択して移動先や攻撃目標を指定します。命令を準備したら、両軍の行動を同時に実行。射撃なしの航行訓練も選べます。</p><button class="btn primary" data-mode="tactical">戦闘状況図を開く</button><button class="btn" data-mode="review">観閲式を開く</button></div>`;}
function ensureOpponents(){}
function runSim(){fleetSetMode('tactical');}

// ---------- engine-side operations ----------
// Building an example and auto-filling bays are long searches; they run in the
// engine while the interface stays responsive.
async function openExample(key) {
  showBusyOverlay('配置見本を準備中…');
  try {
    const r = await YardEngineClient.request('build', {key});
    const s = JSON.parse(r.state);
    st.coded = false; st.view = 'normal'; st.tab = 'hull'; syncHud();
    setShip(s, {busyText: '配置見本を展開中…'}); autosave();
    toast('配置見本を開きました。全区画を編集できます。');
    return s;
  } catch (e) { console.error(e); hideBusyOverlay(); toast('見本を開けませんでした：' + esc(e.message || '')); if (!ship) showTitle('load'); return null; }
}
async function fillHangarsRemote() {
  if (!ship) return;
  const before = snap(); showBusyOverlay('空き容積に航空区画を配置中…');
  try {
    const r = await YardEngineClient.request('op', {gen: eng.gen, state: C.publicJSON(ship), op: 'fillHangars', args: [st.size.hangar, st.fill[0], st.fill[1], st.mirror]});
    if (!r.result) { hideBusyOverlay(); toast('空きが見つかりませんでした'); return; }
    C.patchShip(ship, JSON.parse(r.state)); ship._client = true;
    undoStack.push(before); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0;
    lastOp = '格納庫を自動充填'; touch('parts'); scheduleStats(60); updateUndo(); autosave();
    toast(`格納庫を ${r.result} 個並べました`); renderPanel();
  } catch (e) { console.error(e); hideBusyOverlay(); toast('自動充填できませんでした：' + esc(e.message || '')); }
}

// ---------- persistence ----------
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};
let saveT = 0;
function autosave() { clearTimeout(saveT); saveT = setTimeout(() => { if (!ship) return; LS.set('yard.draft3', snap()); LS.set('yard.draft3.meta', JSON.stringify({name: ship.name, L: ship.hull.L, savedAt: Date.now()})); }, 1200); }
async function pack(obj) {
  const json = JSON.stringify(obj);
  if (typeof CompressionStream === 'function') {
    try {
      const cs = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
      const buf = new Uint8Array(await new Response(cs).arrayBuffer());
      let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      return 'z1:' + btoa(s);
    } catch (e) { /* fall through */ }
  }
  return 'j1:' + json;
}
async function unpack(str) {
  if (str.startsWith('j1:')) return JSON.parse(str.slice(3));
  if (str.startsWith('z1:')) {
    const b = atob(str.slice(3)), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    const ds = new Blob([u]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(ds).text());
  }
  return JSON.parse(str);
}
const Store = {
  db: null, uid: null, ready: false, p: null,
  init() { this.p = this.p || this._init(); return this.p; },
  async _init() {
    try {
      const cl = window.claude;
      if (cl && typeof cl.use === 'function') {
        const [db, user] = await Promise.all([cl.use('db'), cl.use('user')]);
        if (db && user) { const id = await user.id(); if (id) { this.db = db; this.uid = id; } }
      }
    } catch (e) { this.db = null; }
    this.ready = true; if (!$('#sheet').hidden) renderSaves();
  },
  col() { return this.db.collection('data/users/' + this.uid); },
  async list() {
    await this.init();
    if (this.db) {
      const snapq = await this.col().get();
      return snapq.docs.filter(d => d.exists).map(d => Object.assign({id: d.id}, d.data())).filter(d => d.kind === 'ship').sort((a, b) => b.savedAt - a.savedAt);
    }
    try { return JSON.parse(LS.get('yard.saves') || '[]'); } catch (e) { return []; }
  },
  async save(rec) {
    await this.init();
    if (this.db) { await this.col().doc(rec.id).set(rec); return 'cloud'; }
    const all = await this.list(); const i = all.findIndex(x => x.id === rec.id);
    if (i >= 0) all[i] = rec; else all.unshift(rec);
    if (!LS.set('yard.saves', JSON.stringify(all))) throw new Error('このブラウザでは保存できません。書き出しを使ってください。');
    return 'local';
  },
  async remove(id) {
    await this.init();
    if (this.db) { await this.col().doc(id).delete(); return; }
    const all = (await this.list()).filter(x => x.id !== id); LS.set('yard.saves', JSON.stringify(all));
  },
};
async function saveCurrent() {
  if (!S) return;
  const btn = $('#btnSave'); btn.disabled = true;
  try {
    const data = await pack(C.serialize(ship));
    if (data.length > 2000000) throw new Error('設計が大きすぎて保存できません。書き出しを使ってください。');
    const id = ship.saveId || ('ship-' + Date.now().toString(36));
    const where = await Store.save({id, kind: 'ship', name: ship.name, savedAt: Date.now(), cls: S.cls.role + '／' + S.cls.name, len: Math.round(S.hullLen), data});
    ship.saveId = id;
    toast(where === 'cloud' ? '保存しました（あなたのアカウント）' : '保存しました（この端末）');
    renderSaves();
  } catch (e) { toast(esc(e.message || '保存できませんでした')); }
  btn.disabled = false;
}
let delConfirm = null;
async function renderSaves() {
  const box = $('#saves'); if (!box) return;
  const where = Store.db ? 'アカウントに保存（どの端末からでも開けます）' : 'この端末のブラウザに保存';
  $('#saveWhere').textContent = Store.ready ? where : '保存先を確認中…';
  let list = [];
  try { list = await Store.list(); } catch (e) { box.innerHTML = '<li class="muted">一覧を読めませんでした。</li>'; return; }
  box.innerHTML = list.length ? list.map(r => `<li><div><b>${esc(r.name)}</b><span>${esc(r.cls || '')}・${fLen(r.len || 0)}・${new Date(r.savedAt).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span></div><button type="button" class="btn sm" data-load="${esc(r.id)}">開く</button><button type="button" class="btn sm ghost" data-del="${esc(r.id)}">${delConfirm === r.id ? '本当に削除' : '削除'}</button></li>`).join('') : '<li class="muted">保存した設計はまだありません。</li>';
}
async function loadSaved(id) {
  try {
    const rec = (await Store.list()).find(r => r.id === id); if (!rec) throw new Error('見つかりません');
    const s = C.deserialize(await unpack(rec.data)); s.saveId = rec.id;
    setShip(s); closeSheet(); toast(`「${esc(s.name)}」を開きました`);
  } catch (e) { toast('開けませんでした：' + esc(e.message || '')); }
}
async function exportDesign() {
  const json = JSON.stringify(C.serialize(ship));
  const fname = (ship.name || 'ship').replace(/[\\/:*?"<>|]/g, '_') + '.json';
  let dl = null;
  try { if (window.claude && window.claude.use) dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({filename: fname, data: json}); toast('書き出しました'); return; }
    catch (e) { if (e && e.code === 'declined') { toast('書き出しを取りやめました'); return; } }
  }
  // Inside the Claude viewer a page cannot start a download itself; fall through to the copyable text.
  if(!window.claude)try{const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=fname;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('設計図を書き出しました');return;}catch(e){}
  const ta = $('#ioText'); ta.value = json; $('#ioBox').hidden = false; ta.focus(); ta.select();
  toast('下の欄の文字列をコピーして保管してください');
}
function importText(txt) {
  try { const s = C.deserialize(JSON.parse(txt)); setShip(s); closeSheet(); toast(`「${esc(s.name)}」を読み込みました`); return true; }
  catch (e) { toast('読み込めませんでした：' + esc(e.message || '形式を確認してください')); return false; }
}
function openSheet() { $('#sheet').hidden = false; $('#sheetBg').hidden = false; $('#nameInput').value = ship.name; renderSaves(); }
function closeSheet() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; $('#ioBox').hidden = true; delConfirm = null; }

// ---------- pointer / camera controls ----------
// ---------- dragging the selected compartment, structure or fitting ----------
// Press on the selected item (its outline box) and drag. Compartments slide in
// the horizontal plane (a vertical plane when the view is nearly level);
// structures resting on a deck keep resting on it; fittings follow the surface.
let itemDrag = null, itemDragTouch = 0;
function dragItemStart(px, py) {
  itemDrag = null;
  if (fleet.mode !== 'design' || !view || !ship?._geoProxy || !st.sel) return false;
  const t = tool(); if (t !== 'select' && t !== 'adjust') return false;
  const it = selItem(), list = st.sel.list; if (!it || (list !== 'parts' && list !== 'fits')) return false;
  const r = view.ray(px, py); if (!r) return false;
  let best = null;
  for (const q of linkedItems(list, it)) {
    const b = (list === 'parts' ? C.partAABB(q) : C.fitAABB(q)).slice(), pad = Math.max(2, .06 * Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]));
    for (let k = 0; k < 3; k++) { b[k] -= pad; b[k + 3] += pad; }
    const h = C.rayAABB(r.o, r.d, b); if (h && (!best || h.t < best.t)) best = {t: h.t, q, p: h.p || C.add(r.o, C.mul(r.d, h.t))};
  }
  if (!best) return false;
  const q = best.q, level = Math.abs(r.d[1]) < .35, normal = level ? (Math.abs(r.d[0]) > Math.abs(r.d[2]) ? [1, 0, 0] : [0, 0, 1]) : [0, 1, 0];
  const D = {list, id: q.id, grab: best.p, normal, c0: list === 'parts' ? q.c.slice() : q.p.slice(), skip: new Set(linkedItems(list, q)), seat: null};
  if (list === 'parts' && q.k === 'struct' && !level) { const y = dragSupportY(q.c, D.skip); if (y != null && q.c[1] - y >= -1 && q.c[1] - y <= q.s[2] * 1.2 + 4) D.seat = q.c[1] - y; }
  itemDrag = D; return true;
}
function dragSupportY(c, skip) {
  const top = Math.max(ship.hull.H * 4, 2000), h = C.rayEnv(ship, [c[0], c[1] + top, c[2]], [0, -1, 0], {skipSet: skip});
  if (!h) return null;
  // Look under the item itself, not on something stacked above it.
  if (h.p[1] > c[1] + 1) { const below = C.rayEnv(ship, [c[0], c[1], c[2]], [0, -1, 0], {skipSet: skip}); return below ? below.p[1] : null; }
  return h.p[1];
}
function dragItemMove(px, py) {
  const D = itemDrag; if (!D || !ship) return;
  const r = view.ray(px, py); if (!r) return;
  if (!D.moving) { D.moving = true; beginDrag(D.list === 'parts' ? 'ドラッグで移動' : '装備をドラッグで移動'); st.sel = {list: D.list, id: D.id}; }
  if (D.list === 'parts') {
    const den = C.dot(r.d, D.normal); if (Math.abs(den) < 1e-6) return;
    const t = C.dot(C.sub(D.grab, r.o), D.normal) / den; if (t < 0) return;
    const c = C.add(D.c0, C.sub(C.add(r.o, C.mul(r.d, t)), D.grab));
    if (D.seat != null) { const y = dragSupportY(c, D.skip); if (y != null) c[1] = y + D.seat; }
    editSel(it => { it.c = c; });
  } else {
    const f = ship.fits.find(q => q.id === D.id); if (!f) return;
    const h = C.rayEnv(ship, r.o, r.d, {structOnly: true}); if (!h) return;
    moveFitTo(f, h.p, h.n);
  }
  const now = performance.now(); if (now - itemDragTouch > 90) { itemDragTouch = now; touch(D.list); scheduleStats(400); }
  requestDraw();
}
function moveFitTo(f, p, n0) {
  const d = C.FITS[f.k], n = d.cat === 'w' ? weaponPlacementNormal(f.k, n0) : n0;
  const set = (g, q, m) => { g.p = q.slice(); g.n = C.norm(m); if (g.mountAxis == null) g.a = C.AXES.reduce((i, x, j) => C.dot(x, g.n) > C.dot(C.AXES[i], g.n) ? j : i, 0); delete g.local; delete g.localNormal; delete g.host; try { C.mountFit(ship, g); } catch (e) { g.float = true; } };
  set(f, p, n);
  const find = id => id == null ? null : ship.fits.find(q => q.id === id), tw = st.mirror ? find(f.tw) : null, vt = st.vmirror ? find(f.vt) : null, vtw = vt && st.mirror ? find(vt.tw) : null;
  if (tw) set(tw, C.mirrorP(p), C.mirrorP(n));
  if (vt) { const vp = C.vmirrorPoint(ship, p), vn = [n[0], -n[1], n[2]]; set(vt, vp, vn); if (vtw) set(vtw, C.mirrorP(vp), C.mirrorP(vn)); }
  queuePreview('fits', [f, tw, vt, vtw]);
}
function dragItemEnd(cancel) {
  const D = itemDrag; itemDrag = null; if (!D?.moving) return;
  if (cancel && dragSnap) { const old = dragSnap; dragSnap = null; restore(old); return; }
  touch(D.list); endDrag(); scheduleStats(30);
  const it = D.list === 'fits' ? ship.fits.find(q => q.id === D.id) : null;
  if (it?.float) toast(C.FITS[it.k].window ? '艦橋ポッドは構造物の壁に移してください' : 'この位置には据え付けられません。面の上へ移してください');
  renderPanel(); requestDraw();
}
function attachControls(canvas) {
  const ptrs = new Map();
  let mode = null, start = null, last = null, pinch = null, moved = false;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (trial.on) {   // trial flights: drag only looks around, pinch only zooms
      if (ptrs.size === 1) { start = {x: e.clientX, y: e.clientY, t: performance.now()}; last = {x: e.clientX, y: e.clientY}; moved = false; mode = 'trialPending'; }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2}; mode = 'pinch'; }
      return;
    }
    if (ptrs.size === 1) {
      start = {x: e.clientX, y: e.clientY, t: performance.now()};
      last = {x: e.clientX, y: e.clientY}; moved = false;
      mode = (e.button === 2 || e.button === 1 || e.shiftKey) ? 'pan' : 'pending';
      if(mode === 'pending' && cutterDragStart(e.clientX,e.clientY)) mode='cutter';
      else if(mode === 'pending' && e.button === 0 && dragItemStart(e.clientX,e.clientY)) mode='itemPending';
      if (e.pointerType !== 'mouse') onHover(e.clientX, e.clientY);
    } else if (ptrs.size === 2) {
      cutterDragEnd(false);if(mode === 'item' || mode === 'itemPending')dragItemEnd(true);
      const [a, b] = [...ptrs.values()];
      pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2};
      mode = 'pinch'; clearHover();
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') onHover(e.clientX, e.clientY); return; }
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (mode === 'pinch' && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      view.cam.r = Math.max(20, Math.min(400000, view.cam.r * pinch.d / Math.max(1, d)));
      pan(mx - pinch.mx, my - pinch.my);
      pinch = {d, mx, my}; requestDraw(); return;
    }
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    if(mode === 'cutter'){cutterDragMove(e.clientX,e.clientY);last={x:e.clientX,y:e.clientY};moved=true;return;}
    if(mode === 'itemPending' && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 7){mode='item';moved=true;clearHover();}
    if(mode === 'item'){dragItemMove(e.clientX,e.clientY);last={x:e.clientX,y:e.clientY};return;}
    if ((mode === 'pending' || mode === 'trialPending') && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 7) { mode = 'rotate'; moved = true; clearHover(); }
    if (mode === 'rotate') {
      view.cam.th += dx * 0.009; view.cam.ph = Math.max(0.0006, Math.min(Math.PI - 0.02, view.cam.ph - dy * 0.009)); requestDraw();
    } else if (mode === 'pan') { pan(dx, dy); requestDraw(); moved = true; }
    last = {x: e.clientX, y: e.clientY};
  });
  const end = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if(mode === 'cutter')cutterDragEnd(false);
    if(mode === 'item')dragItemEnd(false);
    if(mode === 'itemPending'){itemDrag=null;if(ptrs.size === 0)onTap(e.clientX, e.clientY);}
    if (mode === 'pending' && ptrs.size === 0 && !moved && performance.now() - start.t < 900) onTap(e.clientX, e.clientY);
    if (mode === 'trialPending' && ptrs.size === 0 && performance.now() - start.t < 600) trialCommand('fireTap');
    if (ptrs.size === 0) { mode = null; pinch = null; if (e.pointerType !== 'mouse') clearHover(); }
    else if (ptrs.size === 1) { const p = [...ptrs.values()][0]; last = {x: p.x, y: p.y}; mode = 'rotate'; moved = true; }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); if(mode==='cutter')cutterDragEnd(true); if(mode==='item'||mode==='itemPending')dragItemEnd(true); if (!ptrs.size) mode = null; });
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !ptrs.size) clearHover(); });
  canvas.addEventListener('wheel', e => { e.preventDefault(); view.cam.r = Math.max(20, Math.min(400000, view.cam.r * (1 + Math.sign(e.deltaY) * Math.min(0.25, Math.abs(e.deltaY) * 0.0015)))); requestDraw(); }, {passive: false});
  function pan(dx, dy) {
    const m = view.matrices(), V = m.V, h = canvas.clientHeight || 1;
    const k = 2 * view.cam.r * Math.tan(view.cam.fov / 2) / h;
    const right = [V[0], V[4], V[8]], up = [V[1], V[5], V[9]];
    for (let a = 0; a < 3; a++) view.cam.target[a] += (-dx * right[a] + dy * up[a]) * k;
  }
}

// ---------- events ----------
// Copy a mirrored shape into an existing twin, keeping the twin's own links.
function assignMirror(target, q) {
  const id = target.id, tw = target.tw, vt = target.vt;
  for (const k of Object.keys(target)) if (!k.startsWith('_') && !Object.hasOwn(q, k)) delete target[k];
  Object.assign(target, q, {id}); delete target.tw; delete target.vt;
  if (tw != null) target.tw = tw; if (vt != null) target.vt = vt;
}
function copyFitSettings(from, to) { to.ped = from.ped; if (from.width) to.width = from.width; if (from.height) to.height = from.height; for (const k of ['commandDepth', 'commandHeight', 'commandEnabled', 'chargeSalvos', 'chargeDepth', 'chargeScale', 'scale']) if (from[k] != null) to[k] = from[k]; }
function editSel(fn) {   // live edit of the selected part/fit (and its mirrored twins)
  const it = selItem(); if (!it) return;
  const list = st.sel.list, find = (id) => id == null ? null : ship[list].find(q => q.id === id), tw = st.mirror ? twinOfItem(list, it) : null;
  fn(it);C.enforceEquipment(it);
  if (tw) {
    if(list==='parts')assignMirror(tw,C.mirrorPart(it,ship));
    else copyFitSettings(it, tw);
  } else if (it.tw && list === 'parts' && !st.mirror) { const t2 = twinOfItem(list, it); if (t2) { delete t2.tw; delete it.tw; } }
  const vt = find(it.vt); let vtw = null;
  if (vt && st.vmirror) {
    vtw = st.mirror ? find(vt.tw) : null;
    if (list === 'parts') { assignMirror(vt, C.vmirrorPart(it, ship)); if (vtw) assignMirror(vtw, C.mirrorPart(vt, ship)); }
    else { copyFitSettings(it, vt); if (vtw) copyFitSettings(it, vtw); }
  } else if (vt && !st.vmirror && list === 'parts') { delete vt.vt; delete it.vt; }
  queuePreview(list, [it, tw, vt && st.vmirror ? vt : null, vtw]);
}
const PED_SHAPES = [['round', '円形'], ['trap', '台形']];
// Switching from 編集 to 設置 keeps what was just being edited ready to place:
// the same kind, size and settings, apart from where it sits.
const TEMPLATE_SKIP = ['id', 'tw', 'vt', 'c', 'p', 'n', 'a', 'host', 'local', 'localNormal', 'base', 'low', 'slope', 'float', 'surfaceNormal', 'pitch', 'roll', 'mountAxis', 'mountOffset', 'localMount', 'batteryZone', 'assetYaw'];
const FIT_TEMPLATE_KEYS = ['width', 'height', 'scale', 'chargeSalvos', 'chargeDepth', 'chargeScale', 'commandDepth', 'commandHeight', 'commandEnabled', 'pedShape', 'pedSize', 'skinAsset'];
function templateFor(it, list) { const data = JSON.parse(JSON.stringify(it, (k, v) => k.startsWith('_') ? undefined : v)); for (const k of TEMPLATE_SKIP) delete data[k]; return {list, k: it.k, equipmentId: list === 'parts' ? (C.equipmentSpec(it)?.id || null) : null, data}; }
function activeTemplate(list, k) { const t = st.template; if (!t || t.list !== list || t.k !== k) return null; if (list === 'parts' && (t.equipmentId || null) !== (activeEquipment()?.id || null)) return null; return t; }
function carryToPlace() {
  const it = selItem(); if (!it || !st.sel) return; const list = st.sel.list;
  if (list === 'parts' && !ship.parts.includes(it)) return;
  st.template = templateFor(it, list);
  if (list === 'parts') {
    const spec = C.equipmentSpec(it);
    if (spec?.group === 'bridge') { st.tab = 'bridge'; st.bridgeMode = 'body'; st.bridgeEquipment = spec.id; }
    else if (spec) { st.group = spec.group; st.part = it.k; st.equipmentId = spec.id; if (it.k === 'engine') st.engineSizes[spec.id] = {d: it.d, engineLength: it.engineLength}; }
    else {
      st.equipmentId = null; st.part = it.k; if (st.tab === 'mod') st.group = C.PARTS[it.k].group;
      if (it.k === 'struct') { st.structSize = it.s.slice(); st.structForm = it.form || 'box'; st.structTaper = it.taper || 0; st.structAngles = (it.angles || [0, 0, 0, 0]).slice(); st.structYaw = it.yaw || 0; st.structOffsetX = it.offsetX || 0; st.structOffsetZ = it.offsetZ || 0; if (it.form === 'reference') st.skinAsset = it.skinAsset; }
      else if (it.room) st.roomSize = it.room.slice(); else if (it.d) st.size[it.k] = it.d;
      if (it.k === 'engine' && it.dir) st.engineDir = it.dir.slice();
    }
  } else {
    if (C.FITS[it.k].window) st.bridge = it.k; else st.fit = it.k;
    st.ped = it.ped || 0; st.pedShape = it.pedShape || 'round'; st.pedSize = it.pedSize || 1;
  }
  st.sel = null; toast(`${list === 'parts' ? C.partLabel(it) : C.FITS[it.k].name} を同じ設定で設置できます`);
}
function applyFitTemplate(f) {
  const t = activeTemplate('fits', f.k); if (!t) return;
  for (const q of linkedItems('fits', f)) for (const k of FIT_TEMPLATE_KEYS) if (t.data[k] != null) q[k] = JSON.parse(JSON.stringify(t.data[k]));
}
function applyPedDefaults(f) {
  if (C.FITS[f.k].window || C.FITS[f.k].cat === 'b') return;
  for (const q of linkedItems('fits', f)) { if (st.pedShape === 'trap') q.pedShape = 'trap'; if (Math.abs(st.pedSize - 1) > 1e-6) q.pedSize = st.pedSize; }
}
function linkedItems(list, it) {
  if (!it) return [];
  const find = (id) => id == null ? null : ship[list].find(q => q.id === id), v = find(it.vt);
  return [it, find(it.tw), v, v ? find(v.tw) : null].filter(Boolean);
}
function removeWithPreview(label, list, it) {
  const ids = linkedItems(list, it).map(q => q.id);
  if (mutate(label, () => removeLinked(list, it), list === 'parts' ? 'parts' : 'fits')) showPreview(list, [], ids);
}
// Removing an item also removes the copies its active symmetry created.
function removeLinked(list, it) {
  const find = (id) => id == null ? null : ship[list].find(q => q.id === id), ids = new Set([it.id]);
  if (st.mirror && it.tw) ids.add(it.tw);
  if (st.vmirror && it.vt) { ids.add(it.vt); const v = find(it.vt); if (st.mirror && v?.tw) ids.add(v.tw); }
  for (const id of ids) C.removeItem(ship, list, id, false);
  for (const q of ship[list]) { if (ids.has(q.tw)) delete q.tw; if (ids.has(q.vt)) delete q.vt; }
}
// Vertical copies for parts placed with 上下対称 on (and their left-right twins).
function placeVerticalParts(made) {
  if (!st.vmirror || !made) return [];
  const src = [made, made.tw != null ? ship.parts.find(q => q.id === made.tw) : null].filter(Boolean);
  if (src.some(p => p.skinAsset)) { toast('参照モデルの部品は上下対称に配置できません'); return []; }
  const pairs = [];
  try {
    for (const p of src) {
      const q = C.vmirrorPart(p, ship);
      if (Math.abs(q.c[1] - p.c[1]) < Math.max(1, C.partDims(p).r * .05)) continue;
      const v = C.placePart(ship, q.k, q.c, p.k === 'struct' ? q.s : q.d, q, false);
      for (const [k, val] of Object.entries(q)) if (!['id', 'tw', 'vt', 'c'].includes(k) && !k.startsWith('_') && v[k] === undefined) v[k] = JSON.parse(JSON.stringify(val));
      p.vt = v.id; v.vt = p.id; pairs.push(v);
    }
  } catch (e) {
    for (const v of pairs) C.removeItem(ship, 'parts', v.id, false);
    for (const p of src) delete p.vt;
    throw new Error('上下対称の位置で他の区画と干渉します。上下対称を切るか、位置を変えてください');
  }
  if (pairs.length === 2) { pairs[0].tw = pairs[1].id; pairs[1].tw = pairs[0].id; }
  return pairs;
}
function placeVerticalFits(f, k, ped, opts) {
  if (!st.vmirror || !f) return 0;
  const src = [f, f.tw != null ? ship.fits.find(q => q.id === f.tw) : null].filter(Boolean), made = [];
  for (const g of src) {
    const n = g.n || C.AXES[g.a], p = C.vmirrorPoint(ship, g.p), n2 = [n[0], -n[1], n[2]];
    if (Math.abs(n[1]) < .2 && Math.abs(p[1] - g.p[1]) < Math.max(1, C.FITS[k].r)) continue;
    const r = C.placeFit(ship, k, p, n2, ped, false, opts);
    if (r.err || !r.fit) continue;
    copyFitSettings(g, r.fit); g.vt = r.fit.id; r.fit.vt = g.id; made.push(r.fit);
  }
  if (made.length === 2) { made[0].tw = made[1].id; made[1].tw = made[0].id; }
  return made.length;
}
function bind() {
  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    if (tabKey() === b.dataset.tab && !st.dockCollapsed) { st.dockCollapsed = true; $('#dock').classList.add('collapsed'); return; }
    st.dockCollapsed = false; $('#dock').classList.remove('collapsed');
    st.tab = b.dataset.tab; st.hatchA = null; hideInspect(); renderPanel();
  });
  $('#statstrip').addEventListener('click', () => { st.tab = isWide() ? st.tab : 'spec'; st.dockCollapsed = false; $('#dock').classList.remove('collapsed'); renderPanel(); });
  $('#panel').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if(blockedHullControl(b))return;const d = b.dataset;
    if (d.hullsub) { st.tab = d.hullsub; st.sel = null; st.hatchA = null; hideInspect(); renderPanel(); syncHud(); requestDraw(); return; }
    if (d.notchstructures) { st.notchStructures=d.notchstructures==='yes';renderPanel(); }
    else if (d.parttool) { if (d.parttool === 'place' && st.partTool !== 'place') carryToPlace(); st.partTool = d.parttool; renderPanel(); }
    else if (d.part) { st.template=null;st.equipmentId=null;if(st.structForm==='reference'){st.structForm='trap';delete st.skinAsset;}st.part = d.part; st.partTool = 'place'; renderPanel(); }
    else if (d.place) { st.placeBy[st.part] = d.place; renderPanel(); }
    else if (d.psize) { st.size.hangar = +d.psize; renderPanel(); }
    else if (d.hsize) { mutate('格納庫の大きさ', () => editSel(it => { it.d = +d.hsize; }), 'parts'); renderPanel(); }
    else if (d.selpart) { st.sel = {list: 'parts', id: +d.selpart}; st.partTool = 'select'; renderPanel(); }
    else if ('desel' in d) { st.sel = null; renderPanel(); }
    else if ('delsel' in d) {
      const it = selItem(); if (!it) return;
      const list = st.sel.list;
      removeWithPreview('撤去', list, it);
      st.sel = null; renderPanel();
    }
    else if (d.fittool) { if (d.fittool === 'place' && st.fitTool !== 'place') carryToPlace(); st.fitTool = d.fittool; if (d.fittool !== 'adjust') st.sel = null; renderPanel(); }
    else if (d.pedshape) { st.pedShape = d.pedshape; renderPanel(); }
    else if (d.pedshapesel) { mutate('支持台の形', () => editSel(it => { if (d.pedshapesel === 'trap') it.pedShape = 'trap'; else delete it.pedShape; }), 'fits'); renderPanel(); }
    else if (d.fit) { st.template = null; st.fit = d.fit; st.fitTool = 'place'; st.sel = null; renderPanel(); }
    else if (d.bridgetool) { if (d.bridgetool === 'place' && st.bridgeTool !== 'place') carryToPlace(); st.bridgeTool = d.bridgetool; if (d.bridgetool !== 'adjust') st.sel = null; renderPanel(); }
    else if (d.bridge) { st.template = null; st.bridgeMode='windows';st.bridge = d.bridge; st.bridgeTool = 'place'; st.sel = null; renderPanel(); }
    else if (d.carvetool) { st.carveTool = d.carvetool; renderPanel(); }
    else if (d.hull) {
      const P = C.HULLS[d.hull], hp = ship.hull;
      mutate(`${P.name}船体`, () => { setHullDims(hp.L, Math.round(hp.L * P.W / P.L), Math.round(hp.L * P.H / P.L)); delete ship.hull.stations; Object.assign(ship.hull, {plan: P.plan, sec: P.sec, bowW: P.bowW, bowH: P.bowH, stern: P.stern, name: P.name}); C.normalizeBow(ship.hull); }, 'hull');
      refitOnGeometry(); renderPanel();
    }
    else if (d.hullfollow) { st.hullFollow = d.hullfollow; renderPanel(); }
    else if (d.nudge) {
      const k = d.nudge, step = +d.step, v = hp[k] + step;
      mutate({L: '全長', W: '全幅', H: '全高'}[k] + 'の微調整', () => setHullDims(k === 'L' ? v : hp.L, k === 'W' ? v : hp.W, k === 'H' ? v : hp.H), 'hull', {quiet: true});
      refitOnGeometry(); renderPanel();
    }
    else if (d.sec) { mutate('断面', () => { ship.hull.sec = d.sec; }, 'hull'); renderPanel(); }
    else if (d.keel) { mutate('竜骨', () => { ship.keel = d.keel; }, 'hull'); renderPanel(); }
    else if (d.rzside) { st.razee.side = d.rzside; renderPanel(); }
    else if (d.rzedge) { st.razee.edge = d.rzedge; renderPanel(); }
    else if (d.delcut) { mutate('ラザー化を取り消す', () => { ship.cuts = ship.cuts.filter(c => c.id !== +d.delcut); }, 'hull'); renderPanel(); }
    else if (d.delsub) { mutate('切り欠きを取り消す', () => { ship.subs = ship.subs.filter(c => c.id !== +d.delsub); }, 'hull'); renderPanel(); }
    else if (d.opp) { st.simOpp = d.opp; $$('#panel .opp').forEach(x => { x.classList.toggle('on', x.dataset.opp === d.opp); x.setAttribute('aria-pressed', String(x.dataset.opp === d.opp)); }); }
    else if (b.id === 'btnFill') fillHangarsRemote();
    else if (b.id === 'btnUnfill') { mutate('航空区画を外す', () => { ship.parts = ship.parts.filter(p => p.k !== 'hangar'); }, 'parts'); renderPanel(); }
    else if (b.id === 'btnRazee') { const r = st.razee; mutate('ラザー化', () => { ship.cuts.push({id: ship.nextId++, side: r.side, edge: r.edge, inset: r.inset, slope: r.slope, from: Math.min(r.from, r.to - 0.02), to: r.to, prop: r.prop}); }, 'hull'); renderPanel(); }
    else if (b.id === 'btnClear') {
      if (!confirmClear) { confirmClear = true; renderPanel(); clearTimeout(confirmT); confirmT = setTimeout(() => { confirmClear = false; if (st.tab === 'hull') renderPanel(); }, 4000); return; }
      confirmClear = false;
      mutate('区画と装備をすべて外す', () => { ship.parts = []; ship.fits = []; ship.hatches = []; }, 'all'); st.sel = null; renderPanel();
    }
    else if (b.id === 'btnSim') runSim();
  });
  $('#panel').addEventListener('input', e => {if(blockedHullControl(e.target))return;
    const t = e.target;
    if(t.dataset.sl&&t.value==='')return;
    if (t.id === 'rzprop') { st.razee.prop = t.checked; return; }
    const k = t.dataset.sl; if (!k) return;
    const v=Math.max(+t.min,Math.min(+t.max,Number(t.value)||0)),out=$('#out-'+k),hp=ship.hull;
    $$('[data-sl="'+k+'"]').forEach(q=>{if(q!==t)q.value=v;});
    const live = (label, what, fn, txt) => { beginDrag(label); fn(); touch(what); if (out) out.textContent = txt; scheduleStats(350); };
    switch (k) {
      case 'L': live('全長', 'hull', () => { const r = v / hp.L; setHullDims(v, st.hullRatio ? hp.W * r : hp.W, st.hullRatio ? hp.H * r : hp.H); }, fLen(v)); syncHullInputs(t); break;
      case 'W': live('全幅', 'hull', () => setHullDims(hp.L, v, hp.H), fLen(v) + ` · 全長比 ${(v / hp.L * 100).toFixed(1)}%`); break;
      case 'H': live('全高', 'hull', () => setHullDims(hp.L, hp.W, v), fLen(v) + ` · 全長比 ${(v / hp.L * 100).toFixed(1)}%`); break;
      case 'bowW': live('艦首の幅・厚み', 'hull', () => { hp.bowW = v / 100; if(hp.stations)hp.stations.at(-1)[1]=Math.max(.005,v/100); C.normalizeBow(hp); }, v + '%'); break;
      case 'maxAt': live('最大幅の位置', 'hull', () => { hp.maxAt = v / 100; }, `${v}% · ${fLen(v / 100 * hp.L)}`); break;
      case 'stern': live('艦尾幅', 'hull', () => { hp.stern = v / 100; if(hp.stations)hp.stations[0][1]=Math.max(.01,v/100); }, v + '%'); break;
      case 'ex': live('移動', 'parts', () => editSel(it => { it.c[0] = v; }), fmtM(v)); break;
      case 'ey': live('移動', 'parts', () => editSel(it => { it.c[1] = v; }), fmtM(v)); break;
      case 'ez': live('移動', 'parts', () => editSel(it => { it.c[2] = v; }), fmtM(v)); break;
      case 'ed': live('大きさ', 'parts', () => editSel(it => { it.d = v; }), precisePartSize(selItem() || {}) ? num(v, 2) + ' m' : fmtM(v)); break;
      case 'el': live('大きさ', 'parts', () => editSel(it => { it.s[0] = v; }), fmtM(v)); break;
      case 'ew': live('大きさ', 'parts', () => editSel(it => { it.s[1] = v; }), fmtM(v)); break;
      case 'eh': live('大きさ', 'parts', () => editSel(it => { it.s[2] = v; }), fmtM(v)); break;
      case 'et': live('すぼまり', 'parts', () => editSel(it => { it.taper = v / 100; }), v + '%'); break;
      case 'pedsel': live('支持台の高さ', 'fits', () => { editSel(it => { it.ped = v; }); }, `${v.toFixed(1)} m`); { const it = selItem(), pi = $('#pedinfo'); if (it && pi) pi.textContent = `傾斜に合わせた自動の高さ ${it.base.toFixed(1)} m ＋ 追加 ${it.ped.toFixed(1)} m。高くすると射界が開けますが、標的にもなりやすくなります。`; } break;
      case 'arh': live('外殻装甲', 'none', () => { ship.armor.hull = v; }, `${v.toFixed(2)} m`); break;
      case 'arc': live('集中防御', 'none', () => { ship.armor.cit = v; }, `${v.toFixed(1)} m`); break;
      case 'psize': st.size[st.part] = v; if (out) out.textContent = sizeOut(st.part, v); updateHint(); break;
      case 'sl': st.structSize[0] = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'sw': st.structSize[1] = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'sh': st.structSize[2] = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'st': st.structTaper = v / 100; if (out) out.textContent = v + '%'; break;
      case 'ffrom': st.fill[0] = v / 100; if (out) out.textContent = v + '%'; break;
      case 'fto': st.fill[1] = v / 100; if (out) out.textContent = v + '%'; break;
      case 'ped': st.ped = v; if (out) out.textContent = `${v} m`; break;
      case 'pedsize': st.pedSize = v / 100; if (out) out.textContent = v + '%'; break;
      case 'pedsizesel': live('支持台の大きさ', 'fits', () => editSel(it => { if (v === 100) delete it.pedSize; else it.pedSize = v / 100; }), v + '%'); break;
      case 'rzinset': st.razee.inset = v; if (out) out.textContent = fmtM(v); break;
      case 'rzslope': st.razee.slope = v; if (out) out.textContent = fmtM(v); break;
      case 'rzfrom': st.razee.from = v / 100; if (out) out.textContent = v + '%'; break;
      case 'rzto': st.razee.to = v / 100; if (out) out.textContent = v + '%'; break;
      case 'nl': st.notch.l = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'nw': st.notch.w = v; if (out) out.textContent = fmtM(v); updateHint(); break;
      case 'nd': st.notch.d = v; if (out) out.textContent = fmtM(v); updateHint(); break;
    }
  });
  $('#panel').addEventListener('change', e => {
    const k = e.target.dataset.sl; if (!k) return;
    if (dragSnap) { endDrag(); if (['L', 'W', 'H'].includes(k)) { refitOnGeometry(); renderPanel(); } else renderPanelInfo(); }
  });
  $('#panel').addEventListener('change', e => {
    const t = e.target;
    if ('hullratio' in t.dataset) { st.hullRatio = t.checked; return; }
    if ('shipclass' in t.dataset) {
      const c = C.SHIP_CLASSES.find(c => c.id === t.value), hp = ship.hull; if (!c) return;
      if (hp.L >= c.min && hp.L <= c.max) { mutate(`艦種を${c.name}に`, () => { ship.shipClass = c.id; }, 'view'); renderPanel(); return; }
      const L = c.def, r = L / hp.L;
      mutate(`${c.name}の全長`, () => { ship.shipClass = c.id; setHullDims(L, hp.W * r, hp.H * r); }, 'hull'); refitOnGeometry(); renderPanel();
    }
  });
  // HUD
  $('#chipMirror').addEventListener('click', () => { st.mirror = !st.mirror; syncHud(); });
  $('#viewSeg').addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (!b) return; st.view = b.dataset.view; syncHud(); requestDraw(); updateHint(); });
  $('#chipCode').addEventListener('click', () => { st.coded = !st.coded; syncHud(); touch('view'); requestDraw(); });
  $('#camSeg').addEventListener('click', e => { const b = e.target.closest('button[data-cam]'); if (!b) return; if(!view)return;const c = CAMS[b.dataset.cam]; view.cam.ortho=b.dataset.cam!=='iso'; view.cam.th = c[0]; view.cam.ph = c[1]; view.cam.target = [0, 0, 0]; requestDraw(); });
  $('#chipVMirror').addEventListener('click', () => { st.vmirror = !st.vmirror; syncHud(); updateHint(); });
  $('#btnFull').addEventListener('click', toggleFullscreen);
  $('#btnTitle').addEventListener('click', () => { closeSheet(); showTitle(); });
  $('#btnHome')?.addEventListener('click', () => { if (trial.on) trialStop(); closeSheet(); showTitle(); });
  $('#inspect').addEventListener('click', e => { if (e.target.closest('.ins-x')) hideInspect(); });
  $('#btnUndo').addEventListener('click', undo);
  $('#btnRedo').addEventListener('click', redo);
  $('#btnMenu').addEventListener('click', openSheet);
  $('#shipName').addEventListener('click', openSheet);
  $('#sheetBg').addEventListener('click', closeSheet);
  $('#sheet').addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'btnClose') closeSheet();
    else if (b.id === 'btnSave') saveCurrent();
    else if (b.id === 'btnExport') exportDesign();
    else if (b.id === 'btnCopy') { const ta = $('#ioText'); try { await navigator.clipboard.writeText(ta.value); toast('コピーしました'); } catch (err) { ta.focus(); ta.select(); toast('選択しました。コピーしてください'); } }
    else if (b.id === 'btnImportText') importText($('#ioText').value);
    else if (b.id === 'btnShowImport') { $('#ioText').value = ''; $('#ioBox').hidden = false; $('#ioText').focus(); }
    else if (b.id === 'btnSample') { closeSheet(); openExample('venator'); }
    else if (b.dataset.newhull) {
      const P = C.HULLS[b.dataset.newhull], s = C.newShip(Object.assign({}, P), '新設計艦');
      setShip(s); closeSheet(); st.tab = 'hull'; renderPanel(); toast(`${P.name}の白紙の船体を用意しました`);
    }
    else if (b.dataset.load) loadSaved(b.dataset.load);
    else if (b.dataset.del) {
      if (delConfirm !== b.dataset.del) { delConfirm = b.dataset.del; renderSaves(); return; }
      delConfirm = null; try { await Store.remove(b.dataset.del); toast('削除しました'); } catch (err) { toast('削除できませんでした'); } renderSaves();
    }
  });
  $('#nameInput').addEventListener('input', e => { ship.name = e.target.value.slice(0, 40) || '無名艦'; updateName(); autosave(); });
  $('#fileInput').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;if(f.size>2000000){toast('設計図は2MB以内にしてください');return;}
    const rd = new FileReader(); rd.onload = () => importText(String(rd.result)); rd.readAsText(f); e.target.value = '';
  });
  window.addEventListener('keydown', e => {
    if(fleet.mode!=='design'||trial.on)return;
    if (e.target.matches('input, textarea, select')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && tool() === 'multi' && ['c', 'x', 'v'].includes(e.key.toLowerCase())) { e.preventDefault(); const k = e.key.toLowerCase(); if (k === 'v') multiPaste(); else if (multiCopy()) { if (k === 'x') multiDelete('切り取り'); else toast('コピーしました'); } renderPanel(); refreshOverlay(); return; }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    else if (e.key === 'Escape') { if (!$('#sheet').hidden) closeSheet(); else { st.hatchA = null; st.sel = null; hideInspect(); renderPanel(); } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selItem()) { const it = selItem(), list = st.sel.list; removeWithPreview('撤去', list, it); st.sel = null; renderPanel(); }
  });
  window.addEventListener('resize', () => { requestDraw(); renderSpecTargets(); });
  const mq = window.matchMedia('(min-width: 1000px)');
  const onMq = () => { if (mq.matches && st.tab === 'spec') { st.tab = 'mod'; renderPanel(); } renderSpecTargets(); requestDraw(); };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq);
}
function syncHud() {
  $('#chipMirror').setAttribute('aria-pressed', String(st.mirror));
  $$('#viewSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === st.view)));
  $('#chipCode').setAttribute('aria-pressed', String(st.coded));
  $('#chipVMirror').setAttribute('aria-pressed', String(!!st.vmirror));
}

// ---------- boot ----------
function readDraft(hot) {
  let s = null;
  try { if (hot && hot.design) s = C.deserialize(hot.design); } catch (e) { s = null; }
  if (!s) { try { const d = LS.get('yard.draft3') || LS.get('yard.draft2'); if (d) s = C.deserialize(JSON.parse(d)); } catch (e) { s = null; } }
  return s;
}
function collectSources() {
  // Classic single-page layout (no boot loader): reuse this page's inline scripts.
  const scripts = Array.from(document.scripts).map(s => s.text || '');
  const pick = (needle) => scripts.find(t => t.includes(needle)) || '';
  const coreText = pick('const Core = (() =>'), gfx = pick('const Gfx = (() =>'), engine = pick('const YardEngine = (() =>');
  return coreText && gfx && engine ? [coreText, gfx, engine] : null;
}
function start(hot) {
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="false" class="tab-${k}">${l}</button>`).join('');
  $('#newHulls').innerHTML = Object.entries(C.HULLS).map(([k, v]) => `<button type="button" class="hullcard" data-newhull="${k}">${silhouette(v)}<span>${v.name}</span></button>`).join('');
  $('#refGrid').innerHTML = EXAMPLES.map(e => `<button class="btn" data-reference="${e.key}">${esc(e.name)}<small>${esc(e.side)}・${esc(e.note)}</small></button>`).join('');
  restoreRenderer(false,false);bindRendering();
  bind();bindEngineering();bindRealism();bindReference();bindAviation();bindFleet();bindSurface();bindPlanCuts();bindLayout();bindSolidCuts();bindTitle();bindTutorial();bindGround();bindTrial();bindMulti();bindDockToggle();
  if (hot && hot.ui) { for (const k of ['tab', 'part', 'partTool', 'mirror', 'view', 'coded', 'fit', 'bridge', 'bridgeMode', 'bridgeEquipment', 'equipmentId', 'group', 'ped']) if (hot.ui[k] != null) st[k] = hot.ui[k]; }
  if(!BRIDGES.includes(st.bridge))st.bridge='podBridge';
  if(!['body','windows'].includes(st.bridgeMode))st.bridgeMode='body';
  if(!Object.hasOwn(C.EQUIPMENT,st.bridgeEquipment)||C.EQUIPMENT[st.bridgeEquipment].group!=='bridge')st.bridgeEquipment='isdBridge';
  if(!Object.hasOwn(C.EQUIPMENT,st.equipmentId)||C.EQUIPMENT[st.equipmentId].group==='bridge')st.equipmentId=null;
  if (st.view === 'cut') st.view = 'xray';
  if (st.tab === 'bridge') st.tab = 'mod';
  if (st.tab === 'sim' || st.tab === 'arm') st.tab = st.tab === 'arm' ? 'mod' : 'spec';
  syncHud();
  requestAnimationFrame(loop);
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) {
    window.claude.hot.snapshot(() => ({design: ship ? C.serialize(ship) : null, ui: {tab: st.tab, part: st.part, partTool: st.partTool, mirror: st.mirror, view: st.view, coded: st.coded, fit: st.fit, bridge: st.bridge, bridgeMode:st.bridgeMode,bridgeEquipment:st.bridgeEquipment,equipmentId:st.equipmentId,group:st.group,ped: st.ped}}));
  }
  Store.init();
  window.__yard = {get ship() { return ship; }, get stats() { return S; }, st, draw: requestDraw, fleet, fleetSetMode, renderHealth, restoreRenderer, view: () => view, setShip, C, pick, onTap, touch, eng, openExample, title: titleApi, meshStore, trial, trialCommand, trialStep: dt => trialStep(dt), trialCamera: dt => trialCamera(dt)};
  const boot = window.KSBoot, draft = readDraft(hot);
  const engineStart = YardEngineClient.start(boot ? null : collectSources(), boot ? {workerReady: boot.workerReady} : {});
  engineStart.then(mode => { engineHello(mode); boot?.step('engine', 'done'); titleStatus(); }).catch(e => { console.error(e); toast('設計エンジンを起動できませんでした'); });
  boot?.step('view', 'done');
  // The draft is prepared behind the title screen so "途中から設計" opens at once.
  if (draft) { boot?.step('draft', 'run'); setShip(draft, {keepHistory: true}); }
  else boot?.step('draft', 'skip');
  if (boot || hot?.title) showTitle(); else if (!draft) openExample('venator');
}

// ---------- title screen ----------
const EXAMPLES = [
  {key: 'venator', name: 'ヴェネター級', note: '1,137 m・双塔・スライド式飛行甲板ハッチ', side: '銀河共和国'},
  {key: 'imperial', name: 'インペリアル級', note: '1,600 m・6連装重ターボレーザー・腹部格納口', side: '銀河帝国'},
  {key: 'executor', name: 'エグゼクター級', note: '19 km・13機関・50個飛行隊', side: '銀河帝国'},
];
const titleState = {panel: null, cls: 'destroyer', hull: 'wedge', L: 1600, W: 785, H: 262, name: '新設計艦'};
const titleApi = {show: () => showTitle(), hide: () => hideTitle(), get visible() { return !$('#title')?.hidden; }};
function titleVisible() { const t = $('#title'); return !!t && !t.hidden; }
// The title orbits the prepared design behind the menu.
const titleCam = {base: null, last: 0};
function titleShipView() {
  const on = titleVisible() && !!ship && !!ship._geoProxy && fleet.mode === 'design';
  document.body.classList.toggle('title-ship', on);
  if (on && view && !titleCam.base) { fitCamera(false); titleCam.base = view.cam.target.slice(); view.cam.ph = 1.18; view.cam.r *= 1.05; }
  requestDraw();
}
function titleOrbit(now) {
  if (!titleCam.base || !view || !document.body.classList.contains('title-ship')) return;
  const dt = titleCam.last ? Math.min(.1, (now - titleCam.last) / 1000) : 0; titleCam.last = now;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!reduce) view.cam.th += dt * .06;
  const m = view.matrices(), V = m.V, wide = window.innerWidth > 760, k = view.cam.r * Math.tan(view.cam.fov / 2) * (wide ? .42 : 0);
  const up = wide ? 0 : view.cam.r * Math.tan(view.cam.fov / 2) * .38;
  view.cam.target = [0, 1, 2].map(a => titleCam.base[a] - V[a * 4] * k + V[a * 4 + 1] * up);
  dirty.draw = true;
}
function showTitle(panel) {
  const t = $('#title'); if (!t) return;
  t.hidden = false; document.body.classList.add('title-open'); titleCam.base = null; titleCam.last = 0; titleShipView();
  hideBusyOverlay(); titleState.panel = panel || null; renderTitle();
  setTimeout(() => t.querySelector('.tmenu:not([disabled])')?.focus?.({preventScroll: true}), 30);
}
function hideTitle() {
  const t = $('#title'); if (!t) return;
  t.hidden = true; document.body.classList.remove('title-open', 'title-ship');
  if (titleCam.base && view) { titleCam.base = null; fitCamera(false); }
  if (ship && !ship._geoProxy) showBusyOverlay('設計を展開中…');
  requestDraw(); renderSpecTargets();
}
function draftMeta() { try { return JSON.parse(LS.get('yard.draft3.meta') || 'null'); } catch (e) { return null; } }
function titleStatus() {
  const s = $('#titleStatus'); if (!s) return;
  if (!eng.ready) { s.textContent = '設計エンジンを起動中…'; return; }
  const draftReady = ship && ship._geoProxy;
  if (ship && !draftReady) { s.textContent = '下書きを先読み中…（すぐに開始できます）'; return; }
  if (ship) window.KSBoot?.step('draft', 'done');
  s.textContent = `準備完了 · 計算は${eng.mode === 'worker' ? 'バックグラウンドのワーカー' : 'この画面'}で実行します`;
}
function renderTitle() {
  const menu = $('#titleMenu'); if (!menu) return;
  const meta = draftMeta();
  for (const b of $$('#titleMenu .tmenu')) b.disabled = false;
  const cont = $('#titleMenu [data-title="continue"]');
  if (cont) {
    cont.disabled = !ship;
    $('#titleDraft').textContent = ship ? `「${ship.name}」 · ${fLen(ship.hull.L)} · ${C.shipClassFor(ship.hull.L, ship.shipClass).name}${meta?.savedAt ? ' · ' + new Date(meta.savedAt).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : ''}` : '下書きはありません';
  }
  for (const b of $$('#titleMenu .tmenu')) b.setAttribute('aria-pressed', String(b.dataset.title === titleState.panel));
  const panel = $('#titlePanel');
  panel.hidden = !titleState.panel;
  if (titleState.panel === 'new') panel.innerHTML = titleNewHTML();
  else if (titleState.panel === 'load') { panel.innerHTML = titleLoadHTML(); renderTitleSaves(); }
  else if (titleState.panel === 'credits') panel.innerHTML = `<div class="tpanel-head"><h2>使用素材とライセンス</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>${$$('#sheet .src').map(e => `<p class="src">${e.innerHTML}</p>`).join('')}`;
  else panel.innerHTML = '';
  titleStatus();
}
function titleHullDims(P, L) { return {L, W: Math.round(L * P.W / P.L), H: Math.round(L * P.H / P.L)}; }
function titleNewHTML() {
  const t = titleState, cls = C.SHIP_CLASSES.find(c => c.id === t.cls) || C.SHIP_CLASSES.find(c => c.id === 'destroyer');
  return `<div class="tpanel-head"><h2>新規設計</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>
  <h3>1 · 艦種</h3><div class="tclass">${C.SHIP_CLASSES.map(c => `<button type="button" class="tcard" data-title-class="${c.id}" aria-pressed="${c.id === t.cls}"><b>${esc(c.name)}</b><span>${fLen(c.min)}〜${fLen(c.max)}</span><small>${esc(c.note)}</small></button>`).join('')}</div>
  <h3>2 · 船体の型</h3><div class="hulls">${Object.entries(C.HULLS).map(([k, v]) => `<button type="button" class="hullcard" data-title-hull="${k}" aria-pressed="${k === t.hull}">${silhouette(v)}<span>${v.name}</span></button>`).join('')}</div>
  <h3>3 · 寸法</h3><div class="sliders">${slider('tL', '全長', t.L, cls.min, cls.max, 1, fLen(t.L))}${slider('tW', '全幅', t.W, 20, Math.min(C.DESIGN_LIMITS.width, Math.max(60, Math.round(t.L * 1.2))), 1, fLen(t.W))}${slider('tH', '全高', t.H, 10, Math.min(C.DESIGN_LIMITS.height, Math.max(40, Math.round(t.L * .6))), 1, fLen(t.H))}</div>
  <p class="note">全長は艦種の範囲で1 m単位。全幅・全高は船体の型の比率から始まり、個別に調整できます。設計中も「船体」タブで変更できます。</p>
  <label class="field-label">艦名<input type="text" data-title-name value="${esc(t.name)}" maxlength="40"></label>
  <button type="button" class="btn primary tgo" data-title-start>この船体で設計を始める</button>`;
}
function titleLoadHTML() {
  const sides = [...new Set(EXAMPLES.map(e => e.side))];
  return `<div class="tpanel-head"><h2>設計図を読み込む</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>
  <h3>保存した設計</h3><ul class="saves" id="titleSaves"><li class="muted">一覧を確認中…</li></ul>
  <h3>ファイル・文字列</h3><div class="iorow"><label class="btn file-btn">設計図ファイル（.json）を選ぶ<input type="file" data-title-file accept=".json,application/json"></label></div>
  <details class="trench-editor"><summary>設計図の文字列を貼り付ける</summary><textarea data-title-text spellcheck="false" aria-label="設計図の文字列"></textarea><button type="button" class="btn sm primary" data-title-import>この文字列を読み込む</button></details>
  <h3>配置見本</h3>${sides.map(side => `<p class="eyebrow">${esc(side)}</p><div class="ref-grid">${EXAMPLES.filter(e => e.side === side).map(e => `<button type="button" class="btn" data-title-example="${e.key}">${esc(e.name)}<small>${esc(e.note)}</small></button>`).join('')}</div>`).join('')}
  <p class="note">見本は全区画を編集できます。大型艦は準備に時間がかかります。</p>`;
}
async function renderTitleSaves() {
  const box = $('#titleSaves'); if (!box) return;
  let list = [];
  try { list = await Store.list(); } catch (e) { box.innerHTML = '<li class="muted">一覧を読めませんでした。</li>'; return; }
  box.innerHTML = list.length ? list.map(r => `<li><div><b>${esc(r.name)}</b><span>${esc(r.cls || '')}・${fLen(r.len || 0)}・${new Date(r.savedAt).toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})}</span></div><button type="button" class="btn sm" data-title-saved="${esc(r.id)}">開く</button></li>`).join('') : '<li class="muted">保存した設計はまだありません。</li>';
}
function titleStartNew() {
  const t = titleState, P = C.HULLS[t.hull] || C.HULLS.wedge;
  const s = C.newShip(Object.assign({}, P, {L: t.L, W: t.W, H: t.H}), (t.name || '新設計艦').slice(0, 40));
  s.hullLocked = false; s.shipClass = t.cls;
  st.tab = 'hull'; st.sel = null;
  setShip(s, {keepHistory: true}); hideTitle(); renderPanel();
  toast(`${C.shipClassFor(t.L, t.cls).name}・${P.name}の船体を用意しました`);
}
function bindTitle() {
  const t = $('#title'); if (!t) return;
  t.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('titleFullscreen' in d) { toggleFullscreen(); return; }
    if ('titleCredits' in d) { titleState.panel = 'credits'; renderTitle(); return; }
    if ('titleBack' in d) { titleState.panel = null; renderTitle(); return; }
    if (d.title === 'continue') { if (ship) hideTitle(); return; }
    if (d.title === 'new' || d.title === 'load') { titleState.panel = titleState.panel === d.title ? null : d.title; renderTitle(); return; }
    if (d.titleClass) { const c = C.SHIP_CLASSES.find(c => c.id === d.titleClass); if (!c) return; titleState.cls = c.id; Object.assign(titleState, titleHullDims(C.HULLS[titleState.hull], c.def)); renderTitle(); return; }
    if (d.titleHull) { titleState.hull = d.titleHull; Object.assign(titleState, titleHullDims(C.HULLS[d.titleHull], titleState.L)); renderTitle(); return; }
    if ('titleStart' in d) { titleStartNew(); return; }
    if (d.titleExample) { hideTitle(); await openExample(d.titleExample); return; }
    if (d.titleSaved) { hideTitle(); loadSaved(d.titleSaved); return; }
    if ('titleImport' in d) { const txt = t.querySelector('[data-title-text]')?.value || ''; if (importText(txt)) hideTitle(); return; }
  });
  t.addEventListener('input', e => {
    const k = e.target.dataset.sl, x = e.target;
    if ('titleName' in x.dataset) { titleState.name = x.value; return; }
    if (!['tL', 'tW', 'tH'].includes(k) || x.value === '') return;
    const v = C.clamp(Math.round(Number(x.value) || 0), +x.min, +x.max);
    if (k === 'tL') { const r = titleState.L > 0 ? v / titleState.L : 1; titleState.L = v; titleState.W = Math.max(20, Math.round(titleState.W * r)); titleState.H = Math.max(10, Math.round(titleState.H * r)); }
    else titleState[k[1]] = v;
    for (const kk of ['tL', 'tW', 'tH']) { const val = titleState[kk[1]]; t.querySelectorAll(`[data-sl="${kk}"]`).forEach(q => { if (q !== x) q.value = val; }); const o = t.querySelector('#out-' + kk); if (o) o.textContent = fLen(val); }
  });
  t.addEventListener('change', e => {
    const x = e.target;
    if ('titleFile' in x.dataset) { const f = x.files && x.files[0]; if (!f) return; if (f.size > 2000000) { toast('設計図は2MB以内にしてください'); return; } const rd = new FileReader(); rd.onload = () => { if (importText(String(rd.result))) hideTitle(); }; rd.readAsText(f); x.value = ''; }
    if (['tL', 'tW', 'tH'].includes(x.dataset.sl)) renderTitle();
  });
  t.addEventListener('keydown', e => { if (e.key === 'Escape' && titleState.panel) { titleState.panel = null; renderTitle(); } });
}
// Full screen through the Fullscreen API; where the page may not take the whole
// screen (some embedded views), the editor hides its own chrome instead.
function fullscreenActive() { return !!(document.fullscreenElement || document.webkitFullscreenElement) || $('#app').classList.contains('immersive'); }
function toggleFullscreen() {
  const d = document, el = d.documentElement;
  if (d.fullscreenElement || d.webkitFullscreenElement) { (d.exitFullscreen || d.webkitExitFullscreen).call(d); return; }
  if ($('#app').classList.contains('immersive')) { $('#app').classList.remove('immersive'); syncFullscreen(); return; }
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  const fallback = () => { $('#app').classList.add('immersive'); syncFullscreen(); toast('全画面表示が使えないため、操作盤を最大化しました'); };
  if (!req) { fallback(); return; }
  try { const r = req.call(el, {navigationUI: 'hide'}); if (r && r.catch) r.catch(fallback); } catch (e) { fallback(); }
}
function syncFullscreen() {
  const on = fullscreenActive();
  for (const b of $$('[data-title-fullscreen], #btnFull')) { b.setAttribute('aria-pressed', String(on)); b.title = on ? '全画面を終了' : '全画面'; }
  requestDraw(); setTimeout(requestDraw, 120);
}
document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('webkitfullscreenchange', syncFullscreen);
const deg=v=>`${Math.round(v)}°`;
function structureControls(p,selected){
  const angles=p.angles||[0,0,0,0],prefix=selected?'e':'s',form=p.form||'trap';
  return `<div class="pgroup shape-options"><h4>構造物の形</h4>${surfaceControls(p,selected)}${seg(selected?'editform':'structform',Object.entries(C.STRUCT_SHAPES).filter(([k])=>k!=='reference'||p.skinAsset),form)}
    <div class="sliders">${slider(prefix+'yaw','回転',p.yaw||0,-180,180,1,deg(p.yaw||0))}
    ${['trap','cone','chamfer'].includes(form)?angles.map((v,i)=>slider(prefix+'angle'+i,['後面の傾斜','前面の傾斜','左壁の傾斜','右壁の傾斜'][i],v,-45,65,1,deg(v))).join(''):''}
    ${!['reference','outline','loft','roundloft','arc','ellipsoid'].includes(form)?slider(prefix+'offsetX','上面 前後',p.offsetX||0,-300,300,1,fmtM(p.offsetX||0))+slider(prefix+'offsetZ','上面 左右',p.offsetZ||0,-200,200,1,fmtM(p.offsetZ||0)):''}</div>
    <p class="note">${form==='outline'?'配置後、輪郭の頂点・前後の甲板傾斜・左右への下げ量を編集できます。':['loft','roundloft'].includes(form)?'配置後、前後断面の幅・天井・床と上端の左右絞りを編集できます。':'傾斜角は垂直からの角度。正の値で内側へ絞ります。各壁は独立して調整できます。'}</p></div>`;
}
function engineControls(p,selected){
  const source=p.reactor==null?'auto':String(p.reactor),dir=p.dir||[-1,0,0],yaw=Math.atan2(dir[2],-dir[0])*180/Math.PI,pitch=Math.asin(Math.max(-1,Math.min(1,dir[1])))*180/Math.PI;
  const r=C.reactorFor(ship,p),path=selected?C.enginePaths(ship).find(x=>x.nozzle===p.id):null;
  return `<div class="pgroup route-card"><h4>炉 → 自動推進機関 → ノズル</h4><label class="field-label">接続する炉<select data-reactor="${selected?'selected':'new'}"><option value="auto" ${source==='auto'?'selected':''}>最寄りの炉へ自動接続</option><option value="0" ${source==='0'?'selected':''}>接続しない</option>${ship.parts.filter(C.isReactor).map(q=>`<option value="${q.id}" ${source===String(q.id)?'selected':''}>${esc(C.PARTS[q.k].name)} #${q.id} · X ${Math.round(q.c[0])} m</option>`).join('')}</select></label>
    <div class="sliders">${slider(selected?'engineYaw':'newEngineYaw','左右の向き',Math.round(yaw),-70,70,1,deg(yaw))}${slider(selected?'enginePitch':'newEnginePitch','上下の向き',Math.round(pitch),-60,60,1,deg(pitch))}</div>
    <p class="note">${r?`接続先：${C.PARTS[r.k].name} #${r.id}`:'接続炉なし'}${path?` · 長さ ${fLen(path.seg.l)} · 占有 ${ja(C.partVolume(path))} m³`:''}<br>炉とノズルを動かすと機関も変形します。ノズルの追加で炉の出力は増えません。</p></div>`;
}
function v3PartEditor(){
  let h=basePartEditor(),p=selItem();if(!p||st.sel.list!=='parts')return h;
  let extra=p.k==='struct'?structureControls(p,true):p.k==='engine'?engineControls(p,true):'';
  if(C.PARTS[p.k].shape==='cyl')extra+=`<div class="pgroup"><h4>円筒の向き</h4>${seg('partaxis',[['x','前後'],['y','上下'],['z','左右']],Math.abs(p.dir?.[1]||0)>.9?'y':Math.abs(p.dir?.[2]||0)>.9?'z':'x')}</div>`;
  if(p.k==='struct')extra+=`<button class="btn sm" data-duplicate="${p.id}">構造物を複製</button>`;
  return h+extra;
}
// Position of a placed fitting. Pods move along their wall and up or down it;
// deck fittings move fore/aft and port/starboard and re-seat on the surface.
function fitPositionSliders(f){
  const hp=ship.hull;
  if(C.FITS[f.k].window){
    // Fore/aft walls slide port-starboard; side walls slide fore-aft.
    const host=ship.parts.find(q=>q.id===f.host),n=f.n||C.AXES[f.a],side=Math.abs(n[2])>Math.abs(n[0]),c=host?host.c:f.p,span=host?Math.max(...host.s)/2+10:60,y0=host?host.c[1]-host.s[2]/2-5:0,y1=host?host.c[1]+host.s[2]/2+5:hp.H*2;
    const axis=side?['fitX','前後 X',0]:['fitZ','左右 Z',2],v=f.p[axis[2]];
    return `<h4>位置</h4><div class="sliders">${slider(axis[0],axis[1],Math.round(v*10)/10,Math.floor(c[axis[2]]-span),Math.ceil(c[axis[2]]+span),.5,fmtM(v))}${slider('fitY','高さ Y',Math.round(f.p[1]*10)/10,Math.floor(y0),Math.ceil(y1),.5,fmtM(f.p[1]))}</div><p class="note">取り付けた壁に沿って動きます。3D画面でポッドをドラッグしても動かせます。</p>`;
  }
  return `<h4>位置</h4><div class="sliders">${slider('fitX','前後 X',Math.round(f.p[0]),Math.round(-hp.L*.1),Math.round(hp.L*1.1),1,fmtM(f.p[0]))}${slider('fitZ','左右 Z',Math.round(f.p[2]),Math.round(-hp.W*.75),Math.round(hp.W*.75),1,fmtM(f.p[2]))}</div><p class="note">面に沿って据え直します。3D画面で装備をドラッグしても動かせます。</p>`;
}
function fitEditor(){
  const p=selItem();if(!p||st.sel.list!=='fits'||!C.FITS[p.k].window)return baseFitEditor();
  return `<div class="editor"><div class="ed-head"><b>${esc(C.FITS[p.k].name)}</b><button class="btn sm ghost" data-desel>選択解除</button><button class="btn sm danger" data-delsel>撤去</button></div>${fitPositionSliders(p)}<div class="sliders">${slider('winWidth','ポッドの直径',p.width||16,6,60,.5,fmtM(p.width||16))}${slider('winHeight','ポッドの高さ',p.height||6.4,3,30,.5,fmtM(p.height||6.4))}</div><p class="note">構造物・艦橋本体の側面や前後の壁にのみ取り付けられます。甲板・船体には取り付けられません。背後に指揮区画を確保します。</p></div>`;
}
function v3RenderPanel(){
  if(!ship)return;
  if(st.tab==='systems'){
    markTabs();
    $('#panel').innerHTML=systemsHTML();updateHint();return;
  }
  baseRenderPanel();
  const panel=$('#panel');
  if(st.tab==='mod'&&st.partTool==='place'){
    const parts=panel.querySelector('.parts');if(parts)parts.insertAdjacentHTML('beforebegin',`<div class="pgroup">${seg('group',layoutGroups(),st.group)}</div>`);
    if(st.part==='struct')panel.insertAdjacentHTML('beforeend',structureControls({form:st.structForm,skinAsset:st.skinAsset,angles:st.structAngles,yaw:st.structYaw,offsetX:st.structOffsetX,offsetZ:st.structOffsetZ},false));
    if(st.part==='engine')panel.insertAdjacentHTML('beforeend',engineControls({k:'engine',c:[0,0,0],d:st.size.engine,dir:st.engineDir,reactor:st.reactor},false));
    panel.insertAdjacentHTML('beforeend',coordinateControls());
  }
  if(st.tab==='bridge'){
    panel.innerHTML=`<div class="pgroup">${seg('group',layoutGroups(),'bridge')}</div>`+bridgeSubHTML()+bridgePanel();
  }
  if(st.tab==='armor')panel.insertAdjacentHTML('beforeend',`<div class="pgroup sliders"><h4>シールドの目標強度</h4>${slider('shieldTarget','標準に対して',(ship.shieldTarget||1)*100,10,300,5,Math.round((ship.shieldTarget||1)*100)+'%')}<p class="note">目標強度 × 外表面積で必要電力が決まります。発生器の容量と給電が不足すると実効強度が下がります。</p></div>`);
}
function trenchPanelHTML(){
  const t=st.trench;
  return `<div class="pgroup trench-editor"><h3>上下を開いてトレンチを作る</h3><p class="note">上部と下部の船体を同じ量ずつ離します。指定した上下の間隔を艦尾から艦首まで保ち、元の甲板と船底の傾斜を残します。</p>
  ${seg('trside',[['both','左右両舷'],['port','左舷'],['stbd','右舷']],t.side)}
  <div class="sliders">${slider('trHeight','上下の間隔',t.height,2,Math.min(500,Math.max(50,Math.round(ship.hull.H))),1,fmtM(t.height))}${slider('trDepth','奥壁の後退量',t.depth,2,Math.min(800,Math.max(20,Math.round(ship.hull.W/3))),1,fmtM(t.depth))}</div>
  <details><summary>分割位置・前後の範囲</summary><div class="sliders">${slider('trLevel','船体を上下に分ける位置',t.level*100,10,90,1,Math.round(t.level*100)+'%')}${slider('trFrom','艦尾側の開始位置',t.from*100,0,95,1,Math.round(t.from*100)+'%')}${slider('trTo','艦首側の終了位置',t.to*100,5,100,1,Math.round(t.to*100)+'%')}</div><div class="row2"><button class="btn sm" data-trench-range="all">全長に適用</button><button class="btn sm" data-trench-range="middle">中央70%に適用</button></div><p class="note">船体の一部だけに作っても、上下の船体は全長にわたって同じ間隔だけ離れるので、端で段差はできません。溝は指定した範囲だけに入ります。削った面には溝を付けません。</p></details>
  <button class="btn primary" id="btnTrench">上下を開いて作成</button></div>
  <div class="pgroup"><h4>設置済みトレンチ</h4><ul class="ilist">${(ship.trenches||[]).map(q=>`<li><span><b>${q.mode==='split'?'一定間隔':'従来の切削'} · ${q.side==='both'?'両舷':q.side==='port'?'左舷':'右舷'}</b>上下 ${fmtM(q.height)} / 後退 ${fmtM(q.depth)}</span><div class="cutter-list-actions">${q.mode!=='split'?`<button class="btn sm" data-gap-trench="${q.id}">一定間隔に変更</button>`:''}<button class="btn sm ghost" data-deltrench="${q.id}">撤去</button></div></li>`).join('')||'<li>トレンチはまだありません。</li>'}</ul></div>`;
}
function hpWidth(){return ship.hull.W;}
function systemsHTML(){
  const rs=ship.parts.filter(C.isReactor),eng=ship.parts.filter(p=>p.k==='engine'),routes=C.enginePaths(ship),S0=S;
  return `<div class="flow-intro"><span class="eyebrow">ENGINEERING / 03</span><h3>炉とノズルで機関を組む</h3><p>接続された機関は自動生成され、航空区画の自動充填から除外されます。</p><button class="btn primary" data-internal>内部を透視する</button></div>
  <h4>動力の接続</h4>${rs.map(r=>`<div class="system-card"><button class="system-title" data-goto="${r.id}"><i style="background:${rgb(C.PARTS[r.k].col)}"></i>${C.PARTS[r.k].name} #${r.id}<span>${fW(C.reactorPower(r))}</span></button>${eng.filter(e=>C.reactorFor(ship,e)?.id===r.id).map(e=>{const path=routes.find(p=>p.nozzle===e.id);return `<button class="engine-row" data-goto="${e.id}"><span>↳ ノズル #${e.id} · ⌀${Math.round(e.d)} m</span><b>${path?fLen(path.seg.l):'接続不可'}</b></button>`;}).join('')||'<p class="note">接続されたノズルはありません。</p>'}</div>`).join('')||'<p class="note">先に主反応炉か補助反応炉を配置してください。</p>'}
  ${eng.filter(e=>!C.reactorFor(ship,e)).map(e=>`<button class="engine-row neg" data-goto="${e.id}">未接続ノズル #${e.id}</button>`).join('')}
  ${S0?`<h4>区画の能力</h4><dl class="engineering-stats">${[['自動機関の占有',ja(S0.engineVolume)+' m³'],['反応物貯蔵',ja(S0.fuelVolume)+' m³'],['巡航時持続',S0.fuelHours.toFixed(1)+' 時間'],['反応物供給能力',fPct(S0.supplyRatio)],['慣性制御 対応質量',fMass(S0.inertialSupport)],['構造維持 対応質量',fMass(S0.integritySupport)],['リパルサー 支持質量',fMass(S0.repulsorSupport)],['乗員収容',num(S0.crewCapacity)+' 名'],['揚陸兵員',num(S0.troopCapacity)+' 名'],['車両収容',num(S0.vehicleCapacity)+' 両相当'],['航空整備',num(S0.serviceCapacity)+' 機分'],['貨物容量',fMass(S0.cargoCapacity)]].map(([a,b])=>`<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`:''}
  `;
}
function bindEngineering(){
  $('#panel').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.group==='bridge'){st.equipmentId=null;st.tab='bridge';st.bridgeMode=st.bridgeMode==='windows'?'windows':'body';st.sel=null;st.partTool='place';renderPanel();return;}
    if(d.group){st.equipmentId=null;if(st.structForm==='reference'){st.structForm='trap';delete st.skinAsset;}st.tab='mod';st.group=d.group;if(st.group!=='weapons')st.part=PART_KEYS.find(k=>C.PARTS[k].group===st.group);st.partTool='place';renderPanel();}
    if(d.cmdsub){if(d.cmdsub==='rooms'){st.tab='mod';st.group='command';st.part=PART_KEYS.find(k=>C.PARTS[k].group==='command')||st.part;st.partTool='place';st.equipmentId=null;}else{st.tab='bridge';st.bridgeMode=d.cmdsub;st.sel=null;st.partTool='place';}renderPanel();return;}
    if(d.structform){st.structForm=d.structform;renderPanel();}
    if(d.editform){mutate('構造物の形状',()=>editSel(p=>{p.form=d.editform;if(d.editform!=='reference'){delete p.skinAsset;delete p.equipmentId;}}),'parts');renderPanel();}
    if(d.partaxis){mutate('円筒の向き',()=>editSel(p=>p.dir=d.partaxis==='y'?[0,1,0]:d.partaxis==='z'?[0,0,1]:[1,0,0]),'parts');renderPanel();}
    if(d.duplicate){const p=selItem();if(!p)return;let q;mutate('構造物を複製',()=>{q=C.placePart(ship,'struct',[p.c[0],p.c[1]+p.s[2],p.c[2]],p.s,p,false);},'parts');if(q)st.sel={list:'parts',id:q.id};renderPanel();}
    if(d.trside){st.trench.side=d.trside;st.showTrench=true;renderPanel();}
    if(b.id==='btnTrench'){if(st.trench.from>=st.trench.to){toast('艦尾側端を艦首側端より手前にしてください');return;}mutate('上下を開いてトレンチを作成',()=>{ship.trenches||=[];ship.trenches.push({...st.trench,id:ship.nextId++,mode:'split',taper:false});},'hull');st.showTrench=true;renderPanel();}
    if(d.gapTrench){mutate('トレンチを一定間隔に変更',()=>{const t=ship.trenches.find(t=>t.id===+d.gapTrench);if(t){t.mode='split';t.taper=false;}},'hull');renderPanel();}
    if(d.trenchRange){st.trench.from=d.trenchRange==='all'?0:.15;st.trench.to=d.trenchRange==='all'?1:.85;renderPanel();}
    if(d.deltrench){mutate('トレンチを撤去',()=>ship.trenches=ship.trenches.filter(t=>t.id!==+d.deltrench),'hull');renderPanel();}
    if(d.goto){st.sel={list:'parts',id:+d.goto};st.tab='mod';st.partTool='select';st.view='xray';syncHud();renderPanel();requestDraw();}
    if('internal'in d){st.view='xray';syncHud();requestDraw();}
    if('commandroom'in d){st.equipmentId=null;st.tab='mod';st.group='command';st.part='command';st.partTool='place';renderPanel();}
    if(b.id==='btnAtCoordinates'){const c=['X','Y','Z'].map(a=>Number($('#newP'+a).value));if(c.some(v=>!Number.isFinite(v)||Math.abs(v)>C.DESIGN_LIMITS.coordinate)){toast('座標を確認してください');return;}st.newPos=c;const p=partPreview({p:c,n:[0,1,0],kind:'section'});let made;mutate('座標に区画を配置',()=>{made=C.placePart(ship,p.k,p.c,p.k==='struct'?p.s:p.d,p,st.mirror);try{placeVerticalParts(made);}catch(e){removeLinked('parts',made);made=null;throw e;}},'parts');if(made){st.sel={list:'parts',id:made.id};st.partTool='select';renderPanel();}}
  });
  $('#panel').addEventListener('change',e=>{
    const t=e.target;if(!t.dataset.reactor)return;
    const val=t.value==='auto'?null:+t.value;
    if(t.dataset.reactor==='new')st.reactor=val;
    else mutate('接続する炉',()=>editSel(p=>{if(val==null)delete p.reactor;else p.reactor=val;}),'parts');
    renderPanel();
  });
  $('#panel').addEventListener('input',e=>{
    const k=e.target.dataset.sl;if(!k||e.target.value==='')return;const v=Math.max(+e.target.min,Math.min(+e.target.max,Number(e.target.value)||0)),out=$('#out-'+k);
    const live=(fn,what='parts')=>{beginDrag('設計を調整');fn();touch(what);scheduleStats(350);};
    if(/^([es])angle[0-3]$/.test(k)){const i=+k.at(-1);if(k[0]==='e')live(()=>editSel(p=>{p.angles||=[0,0,0,0];p.angles[i]=v;}));else st.structAngles[i]=v;if(out)out.textContent=deg(v);}
    if(['eyaw','syaw','eoffsetX','eoffsetZ','soffsetX','soffsetZ'].includes(k)){const prop=k.slice(1);if(k[0]==='e')live(()=>editSel(p=>p[prop]=v));else st['struct'+prop[0].toUpperCase()+prop.slice(1)]=v;if(out)out.textContent=prop==='yaw'?deg(v):fmtM(v);}
    if(k.startsWith('tr')){const map={trDepth:'depth',trHeight:'height',trLevel:'level',trFrom:'from',trTo:'to'};if(map[k]){st.trench[map[k]]=k==='trDepth'||k==='trHeight'?v:v/100;if(out)out.textContent=k==='trDepth'||k==='trHeight'?fmtM(v):v+'%';}}
    if(['engineYaw','enginePitch','newEngineYaw','newEnginePitch'].includes(k)){
      const make=dir=>{let y=Math.atan2(dir[2],-dir[0]),p=Math.asin(dir[1]);if(k.endsWith('Yaw'))y=v*Math.PI/180;else p=v*Math.PI/180;return [-Math.cos(y)*Math.cos(p),Math.sin(p),Math.sin(y)*Math.cos(p)];};
      if(k.startsWith('new'))st.engineDir=make(st.engineDir);else live(()=>editSel(p=>p.dir=make(p.dir||[-1,0,0])));if(out)out.textContent=deg(v);
    }
    if(['fitX','fitZ','fitY','fitAlong'].includes(k)){const f=selItem();if(f&&st.sel.list==='fits'){beginDrag('装備の位置');const p=f.p.slice();if(k==='fitX')p[0]=v;else if(k==='fitZ')p[2]=v;else if(k==='fitY')p[1]=v;else{const fr=C.windowFrame(f),host=ship.parts.find(q=>q.id===f.host),cur=C.dot(C.sub(f.p,host?host.c:[0,0,0]),fr.fw);for(let a=0;a<3;a++)p[a]+=fr.fw[a]*(v-cur);}moveFitTo(f,p,f.n||C.AXES[f.a]);touch('fits');scheduleStats(350);if(out)out.textContent=fmtM(v);}}
    if(k==='winWidth'||k==='winHeight'){live(()=>editSel(p=>p[k==='winWidth'?'width':'height']=v),'fits');if(out)out.textContent=fmtM(v);}
    if(k==='shieldTarget'){live(()=>ship.shieldTarget=v/100,'none');if(out)out.textContent=v+'%';}
  });
  $('#sheet').addEventListener('click',e=>{const b=e.target.closest('[data-reference]');if(!b)return;closeSheet();openExample(b.dataset.reference);});
  window.addEventListener('pagehide',()=>{if(ship)LS.set('yard.draft3',JSON.stringify(C.serialize(ship)));});
}

st.roomSize=[120,60,24];
function renderPanel(){
  if(fleet.mode!=='design'){fleetRender();return;}
  refreshSolidCutterOverlay();

  if(ship&&st.tab==='mod'&&st.group==='weapons'){compartmentWeaponsPanel();return;}
  if(ship&&st.tab==='ground'){markTabs();$('#panel').innerHTML=groundPanelHTML();updateHint();refreshOverlay();return;}
  v3RenderPanel();if(!ship)return;const panel=$('#panel');
  if(st.tab==='hull'){
    panel.insertAdjacentHTML('afterbegin',`<div class="pgroup"><label><input type="checkbox" data-assembly ${ship.hull.assembly?'checked':''}> 船体を独立した構造パーツで組み立てる</label><p class="note">有効時は一体船体を表示せず、配置した船殻だけを容積・質量・内部区画の境界に使います。環状船体や分離したポッドを作れます。長さ・幅・高さは設計範囲です。</p></div>`);
    const rows=ship.hull.stations||C.planStations(ship.hull).map(t=>C.profileAt(ship.hull,t)),deckOK=ship.hull.sec!=='ellipse';
    panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>船体断面・艦尾を設計</h4><p class="note">艦尾から艦首へ。肩の張り出し・舷側の切り込み・艦首の薄さを個別に作れます。幅・厚さ・上下位置は船体寸法に対する割合。甲板（上面）・船底（下面）の平らな幅は各断面の幅に対する割合です。艦首の末端2断面は幅・厚さが同率で連動し、船体の幅：高さを保ちます（表の下のチェックで解除できます）。断面と断面の間の「＋」で、その位置に断面を追加します。菱形は上下が頂点です。装甲楔形も甲板・船底幅を0%にすれば尖ります。</p><div class="station-scroll"><table class="station-table"><thead><tr><th>前後 %</th><th>幅 %</th><th>厚さ %</th><th>上下 %</th><th>甲板 %</th><th>船底 %</th><th></th></tr></thead><tbody>${rows.map((a,i)=>`<tr>${[a[0],a[1],a[2],a[3]??0,a[4]??ship.hull.deckWidth??.52,a[5]??ship.hull.keelWidth??0].map((v,j)=>`<td><input aria-label="断面${i+1} ${['前後位置','幅','厚さ','上下位置','甲板幅','船底幅'][j]}" type="number" inputmode="decimal" data-station="${i}" data-axis="${j}" value="${Math.round(v*1000)/10}" min="${[0,.5,.5,-50,0,0][j]}" max="${[100,150,150,80,98,98][j]}" step=".1" ${(j===0&&(i===0||i===rows.length-1))||(j===2&&C.bowStation({...ship.hull,stations:rows},i))||(j>=4&&!deckOK)?'disabled':''} ${j===2&&C.bowStation({...ship.hull,stations:rows},i)?'title="艦首は幅と厚さが連動しています。表の下のチェックを外すと個別に変更できます"':''}></td>`).join('')}<td>${i&&i<rows.length-1?`<button class="btn sm ghost" data-dropstation="${i}" aria-label="断面${i+1}を削除">×</button>`:''}</td></tr>${i<rows.length-1?`<tr class="station-gap"><td colspan="7"><button type="button" class="station-add" data-insertstation="${i}" ${rows.length>=32?'disabled':''} aria-label="断面${i+1}と断面${i+2}の間に断面を追加"><b aria-hidden="true">＋</b>${num((a[0]+rows[i+1][0])*50,1)}% に断面を追加</button></td></tr>`:''}`).join('')}</tbody></table></div><label class="check"><input type="checkbox" data-bowlink ${ship.hull.bowFree?'':'checked'}> 艦首の末端2断面は幅と厚さを連動する（船体の幅：高さの比を保つ）</label>${ship.hull.sec!=='warship'?`<p class="note">${deckOK?'甲板・船底の幅を変えると、断面は今の形に近い「装甲楔形」へ切り替わります。':'楕円断面では甲板・船底の幅は使いません。'}</p>`:''}<div class="sliders">${slider('deckWidth','上甲板の幅',Math.round((ship.hull.deckWidth??.52)*100),0,98,1,Math.round((ship.hull.deckWidth??.52)*100)+'%')}${slider('keelWidth','船底の平坦幅',Math.round((ship.hull.keelWidth??0)*100),0,95,1,Math.round((ship.hull.keelWidth??0)*100)+'%')}${slider('hullStart','本体船殻の艦尾位置',Math.round((ship.hull.start||0)*1000)/10,0,60,.1,Math.round((ship.hull.start||0)*ship.hull.L)+' m')}${slider('chineHeight','舷側帯の上下位置',Math.round((ship.hull.chineHeight??.5)*100),20,80,1,Math.round((ship.hull.chineHeight??.5)*100)+'%')}${slider('belt','舷側帯の厚さ',Math.round((ship.hull.belt??.13)*100),2,45,1,Math.round((ship.hull.belt??.13)*100)+'%')}</div></div>`);
    panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>外板スキン</h4>${seg('yardpaint',[['neutral','無塗装'],['republic','共和国の赤帯'],['dark','暗色']],ship.paint||'neutral')}<div class="sliders">${slider('yardDetail','トレンチ内の設備密度',ship.detail??1,0,2,.5,String(ship.detail??1))}</div><p class="note">スキンは塗装・装甲継ぎ目のみで、指揮能力は追加されません。指揮所は「艦橋」から艦橋本体やポッドを配置します。</p></div>`);
  }
  if(st.tab==='mod'&&st.partTool==='place'&&C.PARTS[st.part].shape==='cube')panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>区画の寸法</h4><div class="sliders">${st.roomSize.map((v,i)=>slider('newRoom'+i,['長さ','幅','高さ'][i],v,4,[ship.hull.L,ship.hull.W,ship.hull.H][i],1,fmtM(v))).join('')}</div><p class="note">立方体に限らず、飛行甲板・居住甲板のような薄く長い区画を配置できます。</p></div>`);
  if(st.tab==='mod')panel.insertAdjacentHTML('afterbegin','<div class="note compartment-rule">内部区画は外殻内に収容。箱形区画の干渉は必要容積を保って自動統合します。主炉・シールド・エンジンと外装機器は張出し可能。</div>');
  referencePanel(panel);layoutPanel(panel);
  if(st.tab==='hull')panel.insertAdjacentHTML('afterbegin',hullDimsHTML());
  if(st.tab==='bridge'&&st.bridgeMode==='body')panel.insertAdjacentHTML('beforeend',surfaceControls({},false));
  if(['hull','carve','armor'].includes(st.tab))panel.insertAdjacentHTML('afterbegin',`<div class="pgroup hull-sub">${seg('hullsub',HULL_SUB,st.tab)}</div>`);
  if(st.tab==='spec')panel.insertAdjacentHTML('afterbegin',trialCardHTML());
}
function partEditor(){
  let html=v3PartEditor(),p=selItem();if(!p||st.sel.list!=='parts')return html;
  html+=`<div class="pgroup"><label class="field-label">区画名<input type="text" data-partlabel value="${esc(p.label||C.PARTS[p.k].name)}" maxlength="80"></label></div>`;
  if((p.k==='struct'&&!['reference','outline','loft','roundloft','arc','ellipsoid','dome','cylinder','cone'].includes(p.form))||(p.room&&!p.outline)){html+=`<div class="pgroup"><h4>平面の輪郭</h4>${p.k==='struct'&&p.form!=='chamfer'?'<button class="btn sm" data-chamfer>切隅・平面台形にする</button>':''}<div class="sliders">${slider('aftWidth','艦尾側の幅',Math.round((p.aftWidth??1)*100),3,150,1,Math.round((p.aftWidth??1)*100)+'%')}${slider('foreWidth','艦首側の幅',Math.round((p.foreWidth??1)*100),3,150,1,Math.round((p.foreWidth??1)*100)+'%')}${slider('corner','隅を落とす',Math.round((p.corner??.12)*100),0,45,1,Math.round((p.corner??.12)*100)+'%')}</div><p class="note">甲板・艦橋の角や、船首へ細くなる区画を再現できます。</p></div>`;}
  if(C.PARTS[p.k].shape==='cube'&&!p.room)html+='<button class="btn" data-roomconvert>長さ・幅・高さを個別に編集</button>';
  if(p.room&&!p.outline)html+='<button class="btn" data-roomoutline>区画の輪郭を頂点で編集する</button>';
  if(p.room&&p.outline)html+='<p class="note">輪郭区画の発着には、矩形の飛行・ドッキング区画を隣接させて接続します。</p>';
  if(p.room)html+='<div class="pgroup"><button class="btn" data-fitroom>区画を外殻内に収める</button><p class="note">位置を保ち、前後・幅・高さを同じ比率で縮小します。実際の占有・容量にも反映されます。</p></div>';
  if(p.k==='struct')html+=`<div class="pgroup"><h4>構造物のスキン</h4>${seg('partskin',[['armor','装甲板'],['service','整備機器'],['plain','追加模様なし']],p.skin||'armor')}<p class="note">スキンは外板の模様です。指揮所が必要なら艦橋ポッドを壁に取り付けます。</p><label>構造物の塗色 <input type="color" data-partpaint value="${p.paint||'#ced2d6'}"></label></div>`;
  if(C.PARTS[p.k].shape==='cyl')html+=`<div class="sliders">${slider('cylLength','筒の長さ',p.length||C.partDims(p).l,4,p.k==='hyper'?C.DESIGN_LIMITS.partSize:Math.min(C.DESIGN_LIMITS.partSize,ship.hull.L),p.k==='hyper'?.1:1,p.k==='hyper'?num(p.length||C.partDims(p).l,2)+' m':fmtM(p.length||C.partDims(p).l))}</div>`;
  if(p.k==='engine'&&!C.parametricEngine(p))html+=`<div class="pgroup"><h4>ノズル前方の機関胴</h4><div class="sliders">${slider('bodyLength','機関胴の長さ',p.bodyLength||p.d*2.2,4,ship.hull.L*.6,1,fmtM(p.bodyLength||p.d*2.2))}${slider('bodyRadius','機関胴の径',Math.round((p.bodyRadius??.52)*200),60,160,1,Math.round((p.bodyRadius??.52)*200)+'%')}</div><p class="note">ノズルと平行な機関胴と、炉へつながる供給部を自動占有します。汎用ノズルの機関胴は炉との間隔の62%以内に収まります。</p></div>`;
  if(C.isInternal(p)&&C.PARTS[p.k].shape==='cube'&&!ship.hatches.some(h=>h.bay===p.id)&&!['flight','dock'].includes(p.airRole))html+=`<div class="pgroup blueprint-card"><label><input type="checkbox" data-autofit ${p.autoFit!==false?'checked':''}> 干渉時に容積を保って自動統合</label><p class="note">近くの区画と用途・必要容積を分けたまま統合し、空き空間に形を組み替えます。指定した位置・寸法は基準形状として保持します。</p></div>`;
  if(p._packingGroup)html+=packingInfoHTML(p);
  if(C.isInternal(p))html+=`<div class="pgroup blueprint-card"><h4>外殻内に自動切取り</h4><p>使用できる体積 <b>${Math.round((p._packing?.retained??p._clip?.retained??1)*100)}%</b></p><p class="note">船体・構造物の内側だけを容量と質量に算入します。指定寸法は保持。外へ広げるには先に構造物を追加してください。</p></div>`;
  if((p.k==='struct'&&p.form==='outline')||(p.room&&p.outline)){const rows=C.outlinePoints(p);html+=`<div class="pgroup"><h4>輪郭の頂点と甲板の傾斜</h4><p class="note">中心を0%、艦尾−50%・艦首50%、左舷−50%・右舷50%として輪郭を編集します。凹形の段差も作れます。</p><table class="station-table"><thead><tr><th>前後 %</th><th>左右 %</th><th>辺</th></tr></thead><tbody>${rows.map((a,i)=>`<tr>${a.map((v,j)=>`<td><input type="number" aria-label="輪郭${i+1} ${j?'左右':'前後'}" data-outline="${i}" data-axis="${j}" value="${Math.round(v*10000)/100}" min="-200" max="200" step=".5"></td>`).join('')}<td><button class="btn sm" data-addvertex="${i}">＋</button>${rows.length>3?`<button class="btn sm" data-dropvertex="${i}">×</button>`:''}</td></tr>`).join('')}</tbody></table><div class="sliders">${slider('deckSlope','艦首へ向かう甲板の傾斜',p.deckSlope||0,-45,45,.1,deg(p.deckSlope||0))}${slider('ridge','中心から舷側へ下げる量',p.ridge||0,-300,300,1,fmtM(p.ridge||0))}</div><p class="note">寸法・輪郭・傾斜は外観、船内容積、衝突判定すべてに反映します。</p></div>`;}
  if(p.k==='struct'&&['loft','roundloft'].includes(p.form)){const rows=p.loft||[[0,p.aftWidth??1,1,0],[1,p.foreWidth??1,1,0]];html+=`<div class="pgroup"><h4>構造物の前後断面</h4><p class="note">幅・天井・床を断面ごとに変え、傾斜甲板や長い艦橋外殻を作れます。舷側への下げ量を指定すると山形に、負の値で谷形に曲がります。</p><table class="station-table"><thead><tr><th>前後 %</th><th>幅 %</th><th>天井 %</th><th>床 %</th><th>左右 %</th><th></th></tr></thead><tbody>${rows.map((a,i)=>`<tr>${[...a.slice(0,4),a[4]||0].map((v,j)=>`<td><input type="number" aria-label="構造断面${i+1} ${['前後','幅','天井','床','左右移動'][j]}" data-loft="${i}" data-axis="${j}" value="${Math.round(v*1000)/10}" step=".1" ${(j===0&&(i===0||i===rows.length-1))||(j===2&&C.bowStation({...ship.hull,stations:rows},i))?'disabled':''}></td>`).join('')}<td>${i>0&&i<rows.length-1?`<button class="btn sm" data-droploft="${i}">×</button>`:''}</td></tr>`).join('')}</tbody></table><button class="btn sm" data-addloft>構造断面を追加</button><div class="sliders">${slider('ridge','中心から舷側へ下げる量',p.ridge||0,-300,300,1,fmtM(p.ridge||0))}${slider('corner','隅を落とす',Math.round((p.corner??.07)*100),0,45,1,Math.round((p.corner??.07)*100)+'%')}${slider('wallInset','上端の左右絞り',Math.round((p.wallInset??0)*100),0,80,1,Math.round((p.wallInset??0)*100)+'%')}</div></div>`;}
  if(p.k==='engine'&&!C.parametricEngine(p))html+=`<div class="pgroup"><h4>拡張ノズル</h4><div class="sliders">${slider('nozzleLength','ノズルの奥行き',p.nozzleLength||p.d*.32,2,300,1,fmtM(p.nozzleLength||p.d*.32))}${slider('throatRatio','奥の噴出口の径',Math.round((p.throatRatio??.34)*100),18,80,1,Math.round((p.throatRatio??.34)*100)+'%')}</div></div>`;
  if(p.k==='hangar')html+=aviationPartHTML(p);
  if(p.k==='struct'&&p.form==='arc')html+=`<div class="pgroup"><h4>環状船体の空洞と開き</h4>${[['arcInner','内径の比率',(p.arcInner??.65)*100,5,95],['arcStart','円弧の開始角',p.arcStart??30,-180,180],['arcSweep','円弧の角度',p.arcSweep??300,5,360]].map(([k,n,v,lo,hi])=>`<label>${n}<input type="number" data-arc="${k}" value="${v}" min="${lo}" max="${hi}" step="1"></label>`).join('')}<p class="note">360°で閉じた環。0°は艦首側です。内径を広げると船内容積と質量が減ります。</p></div>`;
  if(p.k==='struct')html+=`<div class="pgroup"><label><input type="checkbox" data-bands ${p.bands?.length?'checked':''}> 青色の識別帯</label><p class="note">構造物の塗装です。艦橋ポッドや指揮区画は追加しません。</p></div>`;
  return html;
}
function bindRealism(){
  $('#panel').addEventListener('change',e=>{if(blockedHullControl(e.target))return;const t=e.target;if('assembly'in t.dataset){mutate('船体の組立方式',()=>ship.hull.assembly=t.checked,'all');renderPanel();}if('bands'in t.dataset){mutate('識別塗装',()=>editSel(p=>p.bands=t.checked?[[.18,.205],[.235,.25],[.68,.71],[.73,.745]]:[]),'parts');renderPanel();}if('arc'in t.dataset){const k=t.dataset.arc,v=Number(t.value);if(!Number.isFinite(v))return;mutate('環状船体の形状',()=>editSel(p=>p[k]=k==='arcInner'?C.clamp(v/100,.05,.95):k==='arcSweep'?C.clamp(v,5,360):C.clamp(v,-180,180)),'parts');renderPanel();}});
  const ensureStations=()=>{ship.hull.stations||=C.planStations(ship.hull).map(t=>C.profileAt(ship.hull,t));return ship.hull.stations;};
  $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||blockedHullControl(b))return;const d=b.dataset;
    if(d.addvertex!=null||d.dropvertex!=null){mutate('輪郭の頂点を編集',()=>editSel(p=>{const a=C.outlinePoints(p).map(q=>q.slice());if(d.addvertex!=null&&a.length<96){const i=+d.addvertex,b=a[(i+1)%a.length];a.splice(i+1,0,a[i].map((v,j)=>(v+b[j])/2));}else if(d.dropvertex!=null&&a.length>3)a.splice(+d.dropvertex,1);if(C.validOutline(a))p.outline=a;else toast('輪郭の線が交差するため変更できません');}),'parts');renderPanel();}
    if('addloft'in d){mutate('構造断面を追加',()=>editSel(p=>{p.loft||=[[0,p.aftWidth??1,1,0],[1,p.foreWidth??1,1,0]];if(p.loft.length>=32)return;let i=0;for(let j=1;j<p.loft.length-1;j++)if(p.loft[j+1][0]-p.loft[j][0]>p.loft[i+1][0]-p.loft[i][0])i=j;const t=(p.loft[i][0]+p.loft[i+1][0])/2;p.loft.splice(i+1,0,C.loftProfile(p,t));}),'parts');renderPanel();}
    if(d.droploft){mutate('構造断面を削除',()=>editSel(p=>p.loft.splice(+d.droploft,1)),'parts');renderPanel();}
    if('addstation'in d){mutate('船体断面を追加',()=>{const a=ensureStations();if(a.length>=32)return;let i=0;for(let j=1;j<a.length-1;j++)if(a[j+1][0]-a[j][0]>a[i+1][0]-a[i][0])i=j;const t=(a[i][0]+a[i+1][0])/2;a.splice(i+1,0,C.profileAt(ship.hull,t));C.normalizeBow(ship.hull);},'hull');renderPanel();}
    if(d.insertstation!=null){const i=+d.insertstation;mutate('船体断面を追加',()=>{const a=ensureStations();if(a.length>=32||i<0||i>=a.length-1)return;const t=(a[i][0]+a[i+1][0])/2;a.splice(i+1,0,C.profileAt(ship.hull,t));C.normalizeBow(ship.hull);},'hull');renderPanel();return;}
    if(d.dropstation){mutate('船体断面を削除',()=>{ensureStations().splice(+d.dropstation,1);C.normalizeBow(ship.hull);},'hull');renderPanel();}
    if(d.partskin){mutate('構造物のスキン',()=>editSel(p=>p.skin=d.partskin),'parts');renderPanel();}
    if(d.yardpaint){mutate('船体の塗装',()=>ship.paint=d.yardpaint,'all');renderPanel();}
    if('roomoutline'in d){mutate('区画の輪郭を編集',()=>editSel(p=>{const a=p.aftWidth??1,b=p.foreWidth??1;p.outline=[[-.5,-a/2],[.5,-b/2],[.5,b/2],[-.5,a/2]];}),'parts');renderPanel();}
    if('roomconvert'in d){mutate('区画寸法を分離',()=>editSel(p=>C.setRoomSize(p,[p.d,p.d,p.d])),'parts');renderPanel();}
    if('fitroom'in d){mutate('区画を外殻内に調整',()=>editSel(p=>C.fitRoomToEnvelope(ship,p)),'parts');renderPanel();}
    if('chamfer'in d){mutate('平面輪郭を編集',()=>editSel(p=>p.form='chamfer'),'parts');renderPanel();}
  });
  $('#panel').addEventListener('change',e=>{if(blockedHullControl(e.target))return;const t=e.target;
    if(t.dataset.door){if(dragSnap)endDrag();renderPanelInfo();}
    if(t.dataset.outline!=null){const i=+t.dataset.outline,j=+t.dataset.axis,v=+t.value/100;if(!Number.isFinite(v))return;mutate('輪郭の頂点を移動',()=>editSel(p=>{const a=C.outlinePoints(p).map(q=>q.slice());a[i][j]=C.clamp(v,-2,2);if(C.validOutline(a))p.outline=a;else toast('輪郭の線が交差するため変更できません');}),'parts');renderPanel();}
    if(t.dataset.loft!=null){const i=+t.dataset.loft,j=+t.dataset.axis,v=+t.value/100;if(!Number.isFinite(v))return;mutate('構造断面を調整',()=>editSel(p=>{p.loft||=[[0,p.aftWidth??1,1,0],[1,p.foreWidth??1,1,0]];const a=p.loft;if(j===0)a[i][j]=C.clamp(v,a[i-1][0]+.003,a[i+1][0]-.003);else if(j===1)a[i][j]=C.clamp(v,.02,2);else if(j===2)a[i][j]=C.clamp(v,a[i][3]+.03,1.5);else if(j===3)a[i][j]=C.clamp(v,0,a[i][2]-.03);else a[i][j]=C.clamp(v,-2,2);}),'parts');renderPanel();}
    if('bowlink'in t.dataset){mutate('艦首の幅と厚さの連動',()=>{ensureStations();if(t.checked)delete ship.hull.bowFree;else ship.hull.bowFree=true;C.normalizeBow(ship.hull);},'hull');renderPanel();return;}
    if(t.dataset.station!=null){const i=+t.dataset.station,j=+t.dataset.axis,v=+t.value/100;if(!Number.isFinite(v)||j>5)return;let switched=false;mutate('船体断面を調整',()=>{const a=ensureStations();if(j>=4)switched=deckSection(a);for(const row of a){while(row.length<6)row.push(row.length===3?0:row.length===4?ship.hull.deckWidth??.52:ship.hull.keelWidth??0);}a[i][j]=j===0?C.clamp(v,a[i-1][0]+.002,a[i+1][0]-.002):C.clamp(v,[0,.005,.005,-.5,0,0][j],[1,1.5,1.5,.8,.98,.98][j]);C.normalizeBow(ship.hull);},'hull');if(switched)toast('甲板・船底の幅を使うため、断面を「装甲楔形」に切り替えました');renderPanel();}
    if('autofit'in t.dataset){mutate('区画の自動統合',()=>editSel(p=>p.autoFit=t.checked),'parts');renderPanel();}
    if('partlabel'in t.dataset){mutate('区画名',()=>editSel(p=>p.label=t.value.slice(0,80)),'none');renderPanel();}
    if('partpaint'in t.dataset){mutate('構造物の色',()=>editSel(p=>p.paint=t.value),'parts');}
  });
  $('#panel').addEventListener('input',e=>{if(blockedHullControl(e.target))return;const t=e.target,k=t.dataset.sl;if(t.value==='')return;const v=t.min!=null&&t.max!=null?C.clamp(+t.value,+t.min,+t.max):+t.value;if(!Number.isFinite(v))return;const out=$('#out-'+k);
    const live=(fn,what='parts')=>{beginDrag('形状・区画を調整');fn();touch(what);scheduleStats(350);};
    if(k?.startsWith('newRoom'))st.roomSize[+k.at(-1)]=v;
    if(/^room[0-2]$/.test(k||''))live(()=>editSel(p=>{const a=p.room.slice();a[+k.at(-1)]=v;C.setRoomSize(p,a);}));
    if(['aftWidth','foreWidth','corner'].includes(k))live(()=>editSel(p=>p[k]=v/100));
    if(['nozzleLength','throatRatio','wallInset','ridge'].includes(k))live(()=>editSel(p=>p[k]=['nozzleLength','ridge'].includes(k)?v:v/100));
    if(k==='bodyLength'||k==='bodyRadius')live(()=>editSel(p=>p[k]=k==='bodyRadius'?v/200:v));
    if(k==='deckSlope')live(()=>editSel(p=>p.deckSlope=v));
    if(k==='cylLength')live(()=>editSel(p=>p.length=v));
    if(['deckWidth','keelWidth','belt','chineHeight','hullStart'].includes(k))live(()=>{ship.hull[k==='hullStart'?'start':k]=v/100;if(k==='deckWidth')for(const row of ship.hull.stations||[])if(row.length>4)row[4]=v/100;if(k==='keelWidth')for(const row of ship.hull.stations||[])if(row.length>5)row[5]=v/100;},'hull');
    if(k==='yardDetail')live(()=>ship.detail=v,'parts');
    if(t.dataset.door){const h=ship.hatches.find(h=>h.id===+t.dataset.door);if(h&&C.isSlidingHatch(ship,h)&&C.openingBounds(ship,h)){live(()=>{h.open=v/100;},'hatches');if(t.nextElementSibling)t.nextElementSibling.textContent=v+'%';}}
    if(k==='deckSlope'&&out)out.textContent=deg(v);
    if(out&&(/^(newRoom|room)/.test(k||'')||['aftWidth','foreWidth','corner','bodyLength','bodyRadius','cylLength','deckWidth','keelWidth','belt','yardDetail','chineHeight','hullStart','nozzleLength','throatRatio','wallInset','ridge'].includes(k)))out.textContent=['aftWidth','foreWidth','corner','bodyRadius','deckWidth','keelWidth','belt','chineHeight','hullStart','throatRatio','wallInset'].includes(k)?v+'%':k==='yardDetail'?String(v):k==='cylLength'&&selItem()?.k==='hyper'?num(v,2)+' m':fmtM(v);
  });
}

function referenceAircraftSettingHTML(r){
 if(!ship.airWings?.length)return '';
 const a=aviationNumbers();return `<p class="note" data-aircraft-setting>現在の航空隊：<b>${num(a.wings.length)} 個飛行隊・指定 ${num(a.requestedCount)} 機</b>。使用 ${aviationSize(a.usedSize)} / 格納容量 ${aviationSize(a.capacity)} サイズ。</p>`;
}
function referencePanel(panel){
 if(C.DREADNOUGHT_EXAMPLES[ship.reference]&&['hull','systems'].includes(st.tab)){const r=C.DREADNOUGHT_EXAMPLES[ship.reference];panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>${esc(r.name)}の作例</h4><p><a href="${r.source}" target="_blank" rel="noopener">参照モデル · ${esc(r.author)}</a> / CC BY 4.0</p><p class="note">${r.note} 微細な外板・配管は近似です。</p></div>`);}

 if(st.tab==='systems')panel.insertAdjacentHTML('afterbegin',referenceStatsHTML());
 if(st.tab==='systems'&&S&&Object.hasOwn(C.HYPERDRIVE_REFERENCE,ship.reference))panel.insertAdjacentHTML('beforeend',`<div class="pgroup blueprint-card"><h4>ハイパードライブの主機クラス</h4><p>作例の基準 <b>${C.HYPERDRIVE_REFERENCE[ship.reference].class.toFixed(1)}</b> · 現在 <b>${S.hyperClass==null?'なし':S.hyperClass.toFixed(1)}</b></p><p class="note">数字が小さいほど高速です。装置の有効体積と艦の質量から計算し、装置を大きくするか艦を軽くすると小さくなります。</p></div>`);
 if(C.SEPARATIST_EXAMPLES[ship.reference]&&['hull','systems'].includes(st.tab)){const r=C.SEPARATIST_EXAMPLES[ship.reference];panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>${esc(r.name)}の作例</h4><p><a href="${r.source}" target="_blank" rel="noopener">参照モデル · ${esc(r.author)}</a> / ${r.license}</p><p class="note">添付モデルの外形・寸法比を参照し、独立した船殻・構造で再構成。全長 ${r.length} m を作例の基準にしています。内部配置・搭載数・兵装は作例としての設定です。微細な外板や配管は近似です。</p></div>`);}
 if(st.tab==='systems'&&S)panel.insertAdjacentHTML('beforeend',`<div class="pgroup blueprint-card"><h4>主砲ごとの充電装置</h4><p>${S.chargingCount} 基 · 船内占有 ${ja(S.chargingVolume)} m³</p><p class="note">砲塔の直下・内側に自動確保し、移動・拡縮に追従します。区画と干渉すると使用不能、外殻から切り取られると充電容量が減少します。兵装用電力 ${fW(S.weaponBudget)}。</p><button class="btn" data-internal>充電装置を透視する</button></div>`);
 if(st.tab==='mod'){
  const selectedSpec=activeEquipment();if(st.partTool==='place'&&selectedSpec)panel.insertAdjacentHTML('beforeend',equipmentInfo(selectedSpec));
  const p=selItem();if(p&&st.sel.list==='parts'&&C.parametricEngine(p))panel.insertAdjacentHTML('beforeend',equipmentInfo(C.equipmentSpec(p),p));
  if(p&&st.sel.list==='parts'&&p.skinAsset&&!C.parametricEngine(p))panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>外形の編集</h4><p class="note">寸法と位置を編集できます。基本形状に切り替えると、外形を構造・ノズルの形状設定で作れます。</p><button class="btn sm" data-removeskin>基本形状へ変更する</button></div>`);
  if((p&&st.sel?.list==='parts'&&C.isReactor(p))||(st.partTool==='place'&&!selectedSpec&&C.isReactor({k:st.part})))panel.insertAdjacentHTML('beforeend','<div class="pgroup blueprint-card"><h4>炉の大きさと発電出力</h4><p>出力は実際に使える炉の体積に比例します。主炉と補助炉は、同じ実体積なら同じ出力です。</p><p class="note">球全体を使える配置では、直径2倍で出力8倍。大きくするか炉を追加すると出力が増えます。補助炉は船体外の部分を除いて計算します。ほかの区画との干渉で停止した炉は発電しません。</p></div>');
  if(p&&st.sel.list==='parts'&&(['hyper','shield','localShield'].includes(p.k)||p.k==='engine'&&!C.parametricEngine(p)))panel.insertAdjacentHTML('beforeend',`<div class="pgroup blueprint-card"><h4>寸法と性能</h4><p class="note">${p.k==='hyper'?'有効容量は船内で使える装置の体積です。艦全体の容量と質量から主機クラスを計算します。装置を大きくするとクラスは小さくなり、艦が重くなると大きくなります。':p.k==='engine'?'推力と消費電力は機器の種類と寸法から計算します。給電・機関の干渉・噴射口の閉塞で実効推力が変わります。':'シールドの出力と蓄積容量は、使える発生器の体積から共通の係数で計算します。実効防御には艦の表面積と給電も関係します。'}</p></div>`);
 }
 if(st.tab==='hull'&&ship.hullSkin)panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>外板の表示</h4><label class="field-label"><input type="checkbox" data-refhull ${ship.hullSkin.enabled?'checked':''}>詳細な外板形状を表示</label><p class="note">船体の断面・トレンチ・切削に追従。外板形状と内部区画は独立しています。内部容量・構造強度は設計断面による近似です。</p></div>`);
 if(st.tab==='arm'){
  panel.insertAdjacentHTML('afterbegin',weaponMountControls());
  const selected=selItem();if(selected&&st.sel.list==='fits'&&C.needsCapacitor(selected)){const q=S?.chargeInfo?.[selected.id],depth=selected.chargeDepth??(6*(selected.scale||1)+4),d=C.fitSpec(selected),c=C.weaponChargeSpec(selected),cap=C.weaponCapacitors(ship).find(p=>p.weaponId===selected.id);panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>この砲の充電装置</h4><p>${fTT(c.boltTT)} × ${c.barrels} 門 × ${c.salvos} 斉射分 = ${fTT(c.volleyTT*c.salvos)}</p><p>必要容積 ${num(c.targetVolume,1)} m³${cap?' · 基準形状 '+cap.boxSize.map(v=>num(v,1)).join(' × ')+' m':''}</p><p>${q?num(q.volume,1):'—'} m³ / 必要 ${q?num(q.required,1):'—'} m³ · ${q?fPct(q.capacityRatio):'—'}</p><div class="sliders">${slider('chargeSalvos','蓄える斉射回数',c.salvos,1,20,1,c.salvos+' 回分')}${slider('chargeDepth','装備面から内側への深さ',depth,1,180,1,fmtM(depth))}${slider('chargeScale','充電区画の容積',(selected.chargeScale??1)*100,25,400,5,Math.round((selected.chargeScale??1)*100)+'%')}</div>${cap?packingInfoHTML(cap):''}<p class="note">周辺区画との干渉は容積を保って自動統合。1門の威力と連装数に比例して容積が変わります。容量密度 0.08 TT/m³。再充電の目安 ${S?.rc?((d.cycle||1)/S.rc).toFixed(2)+' 秒':'給電なし'}。砲塔の寸法を変えると必要容積も変わります。</p></div>`);}
  const f=selItem();if(f&&st.sel.list==='fits'&&!C.FITS[f.k].window){const d=C.fitSpec(f);panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>選択中の兵装</h4><label>砲塔を交換<select data-refweapon>${WEAPONS.map(k=>`<option value="${k}" ${f.k===k?'selected':''}>${esc(C.FITS[k].name)}</option>`).join('')}</select></label>${C.FITS[f.k].asset?`<div class="sliders">${slider('gunScale','砲塔の大きさ',(f.scale||1)*100,25,300,5,Math.round((f.scale||1)*100)+'%')}${d.casemate?'':slider('gunYaw','砲塔の向き',f.assetYaw||0,-180,180,1,deg(f.assetYaw||0))}</div><p class="note">拡縮すると威力・質量は大きさの3乗で増減します。</p>`:''}<p>${fTT(d.tt||d.ion||0)} / 一斉射 · ${fW(d.power)} / 連射時</p></div>`);}
  panel.insertAdjacentHTML('beforeend',weaponSourcesHTML());
 }
}
function referenceStatsHTML(){
 // Current design first; an example's table values sit beside it for comparison.
 if(!S)return '<div class="pgroup blueprint-card"><h4>艦の性能</h4><p class="note">計算中…</p></div>';
 const r=C.SHIP_REFERENCE[ship.reference];
 const rows=[['出力',fW(S.power),r?fW(r.power):null],['ISD比',S.xISD.toFixed(3),r?(r.power/C.ISD_W).toFixed(3):null],['最大加速度',fG(S.accelG),r?.accelG!=null?fG(r.accelG):null],['シールド蓄積量',sci(S.shieldCapacity)+' J',r?sci(r.shieldLoad)+' J':null],['全出力のエネルギー換算',num(S.power/C.TT,1)+' TT/秒',r?num(r.sustainedTT,1)+' TT/秒':null],...(S.heavyAlpha!=null?[['重兵装一斉射（イオン含む）',(S.heavyAlpha/1000).toFixed(3)+' PT',r?.alphaPT!=null?r.alphaPT.toFixed(3)+' PT':null]]:[])];
 return `<div class="pgroup blueprint-card"><h4>艦の性能</h4><table class="station-table"><thead><tr><th>項目</th><th>この設計</th>${r?`<th>${esc(r.name)}</th>`:''}</tr></thead><tbody>${rows.map(a=>`<tr><td>${a[0]}</td><td><b>${a[1]}</b></td>${r?`<td>${a[2]??'—'}</td>`:''}</tr>`).join('')}</tbody></table>${r?referenceAircraftSettingHTML(r):''}${r?.armament?`<p class="note">兵装：${r.armament}。</p>`:''}<details class="trench-editor"><summary>数値の出典</summary><p class="note">1 ISD = ${fW(C.ISD_W)}（標準インペリアル級の主炉・予備炉・補助炉の合計）。${r?`<a href="${C.STATS_SOURCE}#range=B${r.row}:T${r.row}" target="_blank" rel="noopener">指定表 Ships 行${r.row} · ${esc(r.name)}</a>`:`<a href="${C.STATS_SOURCE}" target="_blank" rel="noopener">指定スプレッドシート</a>`}（確認日 2026-10-19）。表のシールド容量は最大出力10秒分のエネルギーです。</p></details></div>`;
}
function weaponSourcesHTML(){return `<details class="trench-editor"><summary>武装の威力と出典</summary><p class="note">TT = テラトンTNT相当のエネルギー。1 TT = 4.184×10²¹ J。1 PT = 1000 TT。1発・1砲身、砲塔の一斉射、毎秒の出力を区別します。指定表とFractalspongeの設計上の数値を採用し、全作品共通の公式値とは扱いません。</p><table class="station-table"><thead><tr><th>砲身</th><th>1発</th><th>根拠</th></tr></thead><tbody>${['refVen','refISD','oct40','htl','refSide','triple40','quad200','stl','utl','ion','pd'].map(k=>{const d=C.FITS[k];return `<tr><td>${esc(d.short)}</td><td>${fTT(d.boltTT)}</td><td>${d.source?`<a href="${d.source}" target="_blank" rel="noopener">${esc(d.evidence)}</a>`:esc(d.evidence)}</td></tr>`;}).join('')}</tbody></table><p class="note">ISDの6連装砲は、従来の砲塔総威力350 TTを6門へ等分したゲーム用換算です。DBY-827は指定名称を採用し、従来の2門×70 TTを維持しています。</p><p class="note">175 TT、ヴェネターの舷側40 TT、アクラメイターの200 GTは指定表を参照。連射間隔（重砲1秒、中型砲0.2秒）、命中率・射程・損傷効果はゲーム用仮定です。給電が不足すると連続火力が低下します。</p><p class="note"><a href="${C.WEAPON_NOTES.design}" target="_blank" rel="noopener">設計ノート</a>：炉の体積、出力と質量、表面積と防御、兵装への給電を参照。</p></details>`;}
function bindReference(){
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl,v=+e.target.value;if(!['engineD','engineL'].includes(k)||e.target.value===''||!Number.isFinite(v))return;changeEngineSize(k==='engineD'?v:null,k==='engineL'?v:null);});
 $('#panel').addEventListener('change',e=>{const t=e.target;
  if(['engineD','engineL'].includes(t.dataset.sl)){if(dragSnap)endDrag();renderPanel();}
  if(['chargeDepth','chargeScale','chargeSalvos'].includes(t.dataset.sl)){if(dragSnap)endDrag();renderPanel();}

  if('refhull'in t.dataset){mutate('参照外板の表示',()=>ship.hullSkin.enabled=t.checked,'all');renderPanel();}
  if('refweapon'in t.dataset){mutate('砲塔を交換',()=>editSel(f=>{f.k=t.value;delete f.skinAsset;delete f.mountOffset;delete f.mountAxis;f.scale=1;f.assetYaw=0;}),'fits');renderPanel();}
 });
 $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if('enginebaseline'in d){const p=engineEditTarget(),spec=p?C.equipmentSpec(p):activeEquipment(),b=C.ENGINE_BASELINES[spec?.engineStyle]?.[+d.enginebaseline];if(b){changeEngineSize(b.d,b.length);if(dragSnap)endDrag();renderPanel();}return;}
  if(d.weaponmount){chooseWeaponMount(d.weaponmount);return;}
  if(d.equipment){chooseEquipment(d.equipment);return;}
  if(d.bridgemode){st.bridgeMode=d.bridgemode;st.sel=null;renderPanel();return;}
  if(d.bodyrole){mutate('艦橋の役割を変更',()=>editSel(p=>{if(C.bridgeBodyRole(p))p.commandRole=d.bodyrole;}),'parts');renderPanel();return;}
  if('custombridge'in d){st.tab='mod';st.group='shape';st.part='struct';st.equipmentId=null;st.partTool='place';st.structForm='trap';delete st.skinAsset;renderPanel();return;}
  if('removeskin'in d){mutate('基本形状へ変更',()=>editSel(p=>{delete p.equipmentId;delete p.customEquipment;delete p.skinAsset;delete p.skinSize;if(p.form==='reference')p.form='box';}),'parts');renderPanel();}
 });
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl,v=+e.target.value;if(!Number.isFinite(v)||!['gunScale','gunYaw'].includes(k))return;beginDrag('砲塔の形状');editSel(f=>{if(k==='gunScale')f.scale=C.clamp(v/100,.25,3);else f.assetYaw=C.clamp(v,-180,180);});touch('fits');scheduleStats(350);const out=$('#out-'+k);if(out)out.textContent=k==='gunScale'?v+'%':deg(v);});
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl,v=+e.target.value;if(!Number.isFinite(v)||!['chargeDepth','chargeScale','chargeSalvos'].includes(k))return;beginDrag('主砲充電装置を調整');editSel(f=>f[k]=k==='chargeDepth'?C.clamp(v,1,500):k==='chargeSalvos'?Math.round(C.clamp(v,1,20)):C.clamp(v/100,.25,4));touch('fits');scheduleStats(350);const o=$('#out-'+k);if(o)o.textContent=k==='chargeDepth'?fmtM(v):k==='chargeSalvos'?v+' 回分':v+'%';});
}

function packingInfoHTML(p){
 const group=p._packingGroup,a=p._packing;if(!group)return '';
 return `<div class="pgroup blueprint-card"><h4>容積を保って自動統合</h4><p>${group.ids.length} 区画 · 合計 ${num(group.volume,1)} / ${num(group.requestedVolume,1)} m³</p>${a?`<p>この区画 ${num(a.volume,1)} / ${num(a.requestedVolume,1)} m³ · ${fPct(a.retained)}</p><p>再配置範囲 ${[0,1,2].map(i=>num(a.bounds[i+3]-a.bounds[i],1)).join(' × ')} m</p>`:''}<p class="note">用途ごとの容積は別計上。炉・機関・発着口を避け、近傍の連続した空間に収めます。透視で実際の形状を確認できます。${a?.limited?'近傍の空間が不足しています。基準位置を調整するか、周囲を空けてください。':''}</p></div>`;
}

st.engineSizes={};st.equipmentId=null;st.bridgeMode='body';st.bridgeEquipment='isdBridge';
function activeEquipment(){
 const id=st.tab==='bridge'&&st.bridgeMode==='body'?st.bridgeEquipment:st.tab==='mod'?st.equipmentId:null;
 return Object.hasOwn(C.EQUIPMENT,id)?C.EQUIPMENT[id]:null;
}
function equipmentCard(id){
 const d=C.EQUIPMENT[id],on=activeEquipment()?.id===id;
 const spec=d.k==='engine'?d.engineStyle==='exposed'?'径・全長を変更 / 機関胴を外に露出':'ノズル径を変更 / タービンを船内へ':d.k==='struct'?d.s.map(v=>num(v,1)).join(' × ')+' m · 指揮所を内蔵':'センサー・通信設備';
 return `<button type="button" class="part${on?' on':''}" data-equipment="${id}" aria-pressed="${on}"><i class="sw sh-${C.PARTS[d.k].shape}" style="background:${rgb(C.PARTS[d.k].col)}"></i><span class="pn">${esc(d.name)}</span><span class="pd">${spec}</span></button>`;
}
function pendingEngine(d){const p={...C.equipmentOptions(d.id),...st.engineSizes[d.id]};C.enforceEquipment(p);return p;}
function enginePerformance(p){return `<p>推力（寸法換算） <b>${sci(C.nozzleThrust(p))} N</b><br>消費電力（寸法換算） ${fW(C.nozzleDemand(p))}<br>機関胴 ${fmtM(p.bodyLength)} · ノズル奥行き ${fmtM(p.nozzleLength)}</p>`;}
function equipmentInfo(d,p){
 if(d.k==='engine'){
  p=p||pendingEngine(d);const exposed=d.engineStyle==='exposed';
  return `<div class="pgroup blueprint-card"><h4>${esc(d.name)}</h4><div class="sliders">${slider('engineD','ノズル径',p.d,6,C.DESIGN_LIMITS.engineDiameter,.1,num(p.d,2)+' m')}${exposed?slider('engineL','全長（ノズル＋機関胴）',p.engineLength,p.nozzleLength*1.5,C.DESIGN_LIMITS.engineLength,.1,num(p.engineLength,2)+' m'):''}</div><div id="enginePerformance">${enginePerformance(p)}</div><details><summary>サイズを選ぶ</summary><div class="chips">${C.ENGINE_BASELINES[d.engineStyle].map((b,i)=>`<button class="chip" data-enginebaseline="${i}">径 ${b.d} m${exposed?' / 長さ '+num(b.length,1)+' m':''}</button>`).join('')}</div></details><p class="note">${exposed?'径と長さに応じて推力・消費電力・機関占有が変わります。':'ノズルを船外に、接続したタービンを船内に配置します。ノズル径に応じて機関の寸法・性能も変わります。'}炉までの供給区画は自動確保。給電・干渉・噴射口の閉塞で実効推力が変わります。</p></div>`;
 }
 return `<div class="pgroup blueprint-card"><h4>${esc(d.name)}</h4>${d.k==='struct'?'<p class="note">艦橋本体はそれだけで指揮所として働きます（どちらも前面の円筒ポッドから視界を測ります）。役割は選択後に変更でき、支持塔は構造パーツで組み立てます。配置後に位置・寸法・向きを調整できます。</p>':'<p class="note">通常のセンサー部品として配置します。位置・大きさは配置後にも調整できます。</p>'}</div>`;
}
function engineEditTarget(){const p=selItem();return st.partTool==='select'&&p&&C.parametricEngine(p)?p:null;}
function changeEngineSize(diam,length){
 const p=engineEditTarget(),d=p?C.equipmentSpec(p):activeEquipment();if(!d?.engineStyle)return;
 if(p){beginDrag('エンジンの寸法');editSel(q=>C.resizeEngine(q,diam??q.d,length??q.engineLength));touch('parts');scheduleStats(350);}
 else{const q=pendingEngine(d);C.resizeEngine(q,diam??q.d,length??q.engineLength);st.engineSizes[d.id]={d:q.d,engineLength:q.engineLength};}
 const q=p||pendingEngine(d),out=$('#enginePerformance');if(out)out.innerHTML=enginePerformance(q);
 for(const [k,n] of [['engineD',q.d],['engineL',q.engineLength]]){const o=$('#out-'+k);if(o)o.textContent=num(n,2)+' m';}
}
function chooseEquipment(id){
 const d=C.EQUIPMENT[id];if(!d)return;
 st.sel=null;st.partTool='place';st.template=null;
 if(d.group==='bridge'){st.tab='bridge';st.bridgeMode='body';st.bridgeEquipment=id;}
 else{st.tab='mod';st.group=d.group;st.part=d.k;st.equipmentId=id;st.placeBy[d.k]='partial';}
 renderPanel();
}
function equipmentPreview(hit,d){
 const p={id:-1,...(d.k==='engine'?pendingEngine(d):C.equipmentOptions(d.id))},normal=hit.n||[0,1,0];p.c=hit.p.slice();
 if(d.k==='engine'){p.dir=st.engineDir.slice();p.reactor=st.reactor;}
 if(d.k==='struct'){p.yaw=st.structYaw;p.pitch=st.structPitch||0;p.roll=st.structRoll||0;return C.alignStructure(p,hit,st.surfaceMode);}
 if(hit.kind!=='section'){
  const dot=d.k==='engine'?Math.abs(C.dot(normal,p.dir)):0,ext=d.k==='struct'?(Math.abs(normal[0])*p.s[0]+Math.abs(normal[1])*p.s[2]+Math.abs(normal[2])*p.s[1])/2:d.k==='sensor'?Math.hypot(...normal.map((v,i)=>v*p.skinSize[i]/2)):dot*p.nozzleLength/2+Math.sqrt(Math.max(0,1-dot*dot))*p.d/2;
  const mode=st.placeBy[d.k]||'partial',offset=d.k==='struct'?ext*.6:mode==='inside'?-(ext+1):mode==='outside'?ext*.92:-ext*.4;
  p.c=C.add(hit.p,C.mul(normal,d.engineStyle==='internal'&&C.dot(normal,p.dir)>.8?p.nozzleLength/2-2:offset));
 }
 return p;
}
function coordinateControls(){return `<details class="trench-editor"><summary>座標を指定して配置</summary><p class="note">X：艦尾から前方、Y：船底から上方、Z：中心線から左右。単位 m。</p><div class="coordinate-inputs">${['X','Y','Z'].map((a,i)=>`<label>${a}<input type="number" id="newP${a}" value="${Math.round(st.newPos?.[i]??[ship.hull.L*.5,ship.hull.H*.5,0][i])}" step="1" min="${-C.DESIGN_LIMITS.coordinate}" max="${C.DESIGN_LIMITS.coordinate}"></label>`).join('')}</div><button class="btn" id="btnAtCoordinates">この座標へ配置</button></details>`;}
const BODY_ROLES=[['bridge','航行・艦隊指揮'],['combat','戦闘指揮'],['air','航空指揮'],['hangar','格納庫管制']];
function bodyRoleHTML(p){const role=C.bridgeBodyRole(p);if(!role||st.sel?.list!=='parts')return '';const inf=S?.commandInfo?.[-300000-p.id];return `<div class="pgroup blueprint-card"><h4>艦橋本体の役割</h4>${seg('bodyrole',BODY_ROLES,role)}<label><input type="checkbox" data-bodycommand ${p.commandEnabled!==false?'checked':''}> この本体を指揮所として使う</label><p class="note">モデル由来の艦橋本体は、それ自体が${esc(C.COMMAND_ROLES[role])}の指揮所です。ポッドや窓を足す必要はありません。${inf?` 稼働 ${fPct(inf.ratio)}`:''}</p></div>`;}
function bridgePanel(){
 const body=st.bridgeMode==='body',selected=selItem(),bodies=ship.parts.filter(p=>C.equipmentSpec(p)?.group==='bridge'||C.REFERENCE_ASSETS[p.skinAsset]?.kind==='bridge');
 const head='';
 if(!body)return head+`<div class="pgroup">${seg('bridgetool',[['place','ポッドを設置'],['adjust','調整'],['remove','撤去']],st.bridgeTool)}</div>${st.bridgeTool==='adjust'?fitEditor():''}<div class="fits">${BRIDGES.map(k=>fitBtn(k,st.bridge===k,'bridge')).join('')}</div><p class="note">インペリアル級艦橋の円筒形ポッドです。構造物の側面や前後の壁に取り付けると、その役割の指揮所になります。甲板と船体には置けません。ポッドの背後には指揮区画が確保されます。インペリアル級・ヴェネター級の艦橋本体は、ポッドを足さなくても艦橋として機能します。</p><button class="btn" data-commandroom>無窓式指揮室を配置する</button>`;
 return head+`<div class="pgroup">${seg('parttool',[['place','本体を配置'],['select','選択・調整']],st.partTool)}</div><div class="parts">${Object.values(C.EQUIPMENT).filter(d=>d.group==='bridge').map(d=>equipmentCard(d.id)).join('')}</div>${st.partTool==='place'?equipmentInfo(C.EQUIPMENT[st.bridgeEquipment])+coordinateControls():(bodyRoleHTML(selected)+(partEditor()||'<p class="note">艦橋本体をタップするか下の一覧から選択してください。</p>'))}<div class="pgroup"><h4>配置済みの艦橋本体</h4><div class="plist">${bodies.map(p=>`<button class="chip${selected?.id===p.id?' on':''}" data-selpart="${p.id}">${esc(C.partLabel(p))}</button>`).join('')||'<p class="note">まだ配置されていません。</p>'}</div></div><button class="btn" data-custombridge>構造パーツから艦橋を組む</button>`;
}

// Placement direction is shared by the preview and the actual mount.
st.weaponMount='auto';
function weaponPlacementNormal(k,n){return C.FITS[k]?.cat==='w'&&!['auto','trench','casemate'].includes(st.weaponMount)?(st.weaponMount==='bottom'?[0,-1,0]:[0,1,0]):n;}
function weaponMountControls(){return `<div class="pgroup"><h4>武装の取付面</h4>${seg('weaponmount',[['auto','面に合わせる'],['top','上面に配置'],['bottom','下面に配置'],['trench','トレンチ内'],['casemate','側壁ケースメイト']],st.weaponMount)}<p class="note">下面を選ぶと船底へ視点を切り替えます。船体・構造物の下面をタップして搭載。砲塔は下向き、充電装置は取付面の船内側に配置されます。射界は取付面の外向き半球です。「トレンチ内」では溝の床・内壁に局所固定し、外甲板へ移しません。「側壁ケースメイト」は砲口を壁の外向きにして、背面の船内に充電装置を確保します。</p></div>`;}
function chooseWeaponMount(face){
 if(!['auto','top','bottom','trench','casemate'].includes(face))return;
 if(face==='casemate'&&C.FITS.casemate40)st.fit='casemate40';
 st.weaponMount=face;st.fitTool='place';st.sel=null;
 if(['top','bottom'].includes(face)){st.view='normal';if(view){const c=CAMS[face];view.cam.ortho=true;view.cam.th=c[0];view.cam.ph=c[1];view.cam.target=[0,0,0];}syncHud();requestDraw();}
 renderPanel();
}

function aviationNumbers(){return C.aviationStatus(ship,S?.info);}
function aviationSize(v){return num(Number.isFinite(v)?v:0,2);}
function aviationCapacityHTML(a){
 const excess=Math.max(0,a.usedSize-a.capacity),unloaded=Math.max(0,a.requestedCount-a.embarkedCount),stranded=Math.max(0,a.embarkedCount-a.deployableCount);
 return `<div class="aviation-budget"><span>格納容量</span><strong>${aviationSize(a.capacity)} <small>サイズ</small></strong><p>使用サイズ（指定） <b>${aviationSize(a.usedSize)}</b> / ${aviationSize(a.capacity)}</p><meter min="0" max="${Math.max(1,a.capacity)}" value="${Math.min(a.usedSize,Math.max(1,a.capacity))}" aria-label="格納庫の使用サイズ"></meter><p class="${excess?'neg':'ok'}">${excess?'容量超過 '+aviationSize(excess):'残り '+aviationSize(Math.max(0,a.capacity-a.usedSize))} サイズ</p></div><dl class="engineering-stats aviation-counts"><div><dt>指定した機数</dt><dd>${num(a.requestedCount)} 機</dd></div><div><dt>実際に搭載</dt><dd>${num(a.embarkedCount)} 機</dd></div><div><dt>発着路に接続</dt><dd>${num(a.deployableCount)} 機</dd></div><div><dt>1区画の容量によるサイズ上限</dt><dd>${aviationSize(a.maxAircraftSize)}</dd></div></dl>${unloaded?`<p class="note neg" role="status">${num(unloaded)} 機は搭載できません。各航空隊の表示から、容量超過か1機のサイズ超過を確認してください。指定機数は保持しています。</p>`:''}${stranded?`<p class="note neg" role="status">搭載機のうち ${num(stranded)} 機は発着路に接続していません。表面に接触した航空区画の開口設定と、区画間の接続を確認してください。</p>`:''}`;
}
function aviationWingStatusHTML(w){
 if(!w)return '';
 let h=`<p>使用 ${aviationSize(w.usedSize)} サイズ · 搭載 ${num(w.embarked)} / 指定 ${num(w.count)} 機</p>`;
 if(w.count>0&&w.tooLarge)h+='<p class="note neg">1機のサイズが、最大の格納区画に収まりません。格納庫を大きくするか、機体サイズを小さくしてください。サイズ1の機体は長さ12 m・幅10 m・高さ5 m の空間を使います。</p>';
 else if(w.unembarked>0)h+=`<p class="note neg">容量不足で ${num(w.unembarked)} 機が未搭載。上にある航空隊から順に収容します。</p>`;
 if(w.undeployable>0)h+=`<p class="note neg">搭載済みの ${num(w.undeployable)} 機が発着路に未接続です。${w.blocked?'この機体サイズを収容できる格納区画を発着路につないでください。':''}</p>`;
 return h;
}
function aviationWingHTML(w,i){
 const limits=C.AIR_WING_LIMITS,id=esc(w.id),expanded=st.aviationExpanded?.has(w.id)??i===0;
 return `<details class="airwing-row" data-airwing-card="${id}" ${expanded?'open':''}><summary><b data-airwing-title="${id}">${esc(w.name)}</b><span data-airwing-summary="${id}">サイズ ${aviationSize(w.size)} × ${num(w.count)} 機</span></summary><label class="field-label">航空隊名<input type="text" data-airwing="${id}" data-wingfield="name" value="${esc(w.name)}" maxlength="${limits.nameLength}" aria-label="航空隊 ${i+1} の名前"></label><div class="airwing-fields"><label>1機のサイズ<input type="number" data-airwing="${id}" data-wingfield="size" value="${w.size}" min="${limits.minSize}" max="${limits.maxSize}" step=".01" inputmode="decimal" aria-label="航空隊 ${i+1} の機体サイズ"></label><label>搭載する機数<input type="number" data-airwing="${id}" data-wingfield="count" value="${w.count}" min="0" max="${limits.maxCount}" step="1" inputmode="numeric" aria-label="航空隊 ${i+1} の機数"></label></div><div data-airwing-status="${id}" class="airwing-status" aria-live="polite">${aviationWingStatusHTML(w)}</div><div class="chips"><button type="button" class="btn sm" data-fillairwing="${id}">空き容量まで搭載</button><button type="button" class="btn sm ghost" data-moveairwing="${id}" data-direction="-1" ${i===0?'disabled':''} aria-label="${esc(w.name)}の収容優先順を上げる">上へ</button><button type="button" class="btn sm ghost" data-moveairwing="${id}" data-direction="1" ${i>=(ship.airWings?.length||0)-1?'disabled':''} aria-label="${esc(w.name)}の収容優先順を下げる">下へ</button><button type="button" class="btn sm ghost" data-delairwing="${id}">削除</button></div></details>`;
}
function aviationSurfacesHTML(p){
 const names={none:'ハッチ化しない',open:'開放型',ray:'シールド'},contacts=C.aviationSurfaceContacts(ship,p);
 return `<div class="aviation-surfaces"><h4>表面に接触した面の開口</h4><p class="note">航空区画を船体・外装の表面まで広げ、接触した面の方式を選びます。開口は区画の位置と大きさに追従します。</p>${contacts.map(q=>`<div class="aviation-surface ${q.contact?'':'inactive'}"><label>${esc(q.label)}<select data-aviation-surface="${q.face}" data-aviation-bay="${p.id}" ${q.contact?'':'disabled'} aria-label="${esc(C.partLabel(p))} ${esc(q.label)}の開口方式"><option value="none" ${q.kind==='none'?'selected':''}>ハッチ化しない</option><option value="open" ${q.kind==='open'?'selected':''}>開放型</option><option value="ray" ${q.kind==='ray'?'selected':''}>シールド</option></select></label>${q.contact&&q.kind!=='none'?`<label class="note"><input type="checkbox" data-aviation-door="${q.face}" data-aviation-bay="${p.id}" ${ship.hatches.some(h=>h.bay===p.id&&h.face===q.face&&C.isSlidingHatch(ship,h))?'checked':''}> 装甲スライド扉を併設</label>`:''}<p class="note">${q.contact?'接触面積 '+num(q.area,1)+' m²':q.kind!=='none'?'未接触 · '+names[q.kind]+'の設定を保持。表面に再び接触すると開口が戻ります。':'船体・外装の表面に接触していません。区画の位置・寸法を調整すると選択できます。'}</p></div>`).join('')}</div>`;
}
function aviationPartHTML(p){
 if(!p||p.k!=='hangar')return '';
 return `<div class="pgroup blueprint-card aviation-part"><h4>航空区画の用途と容量</h4><label class="field-label">用途<select data-airrole>${Object.entries(C.AVIATION_ROLES).map(([k,n])=>`<option value="${k}" ${(p.airRole||'mixed')===k?'selected':''}>${n}</option>`).join('')}</select></label><p>この区画の容量 <b data-aviation-capacity="${p.id}">${aviationSize(C.hangarCapacity(p))} サイズ</b></p><p class="note">外殻内で使える実容積から計算します。格納・兼用区画を大きくすると容量が増え、飛行・移送甲板とドッキング区画は格納容量に含みません。</p>${st.tab!=='launch'?'<button type="button" class="btn" data-editaviation>航空隊の機体サイズ・機数を編集</button>':''}${aviationSurfacesHTML(p)}</div>`;
}
function aviationDoorHTML(h){
 const p=ship.parts.find(p=>p.id===h.bay);if(!p)return '';const active=!!C.openingBounds(ship,h),face=C.aviationSurfaceContacts(ship,p).find(q=>q.face===h.face)?.label||h.face;
 return `<div class="bay-control"><b>${esc(C.partLabel(p))} · ${esc(face)}</b><label>スライド扉の開き <input type="range" data-door="${h.id}" min="0" max="100" value="${Math.round((h.open??0)*100)}" ${active?'':'disabled'} aria-label="${esc(C.partLabel(p))} ${esc(face)}の扉の開き"><output>${Math.round((h.open??0)*100)}%</output></label>${active?'':'<p class="note">表面に接触していないため、開口は無効です。</p>'}</div>`;
}
function aviationPanelHTML(){
 const a=aviationNumbers(),wings=a.wings,bays=ship.parts.filter(p=>p.k==='hangar'),selected=st.sel?.list==='parts'?selItem():null,slides=ship.hatches.filter(h=>h.bay&&C.isSlidingHatch(ship,h));
 return `<div class="pgroup blueprint-card aviation-editor"><h4>航空隊編集</h4><p class="note">航空隊ごとに「1機のサイズ × 機数」を入力し、合計が格納容量に収まるように組みます。小型戦闘機はサイズ1、大型の機体はサイズ2以上です。残り <b>${aviationSize(Math.max(0,a.capacity-a.usedSize))} サイズ</b>（サイズ1の機体で ${num(Math.floor(Math.max(0,a.capacity-a.usedSize)+1e-6))} 機分）。</p><div id="aviationSummary" aria-live="polite">${aviationCapacityHTML(a)}</div></div><div class="pgroup"><h4>搭載する航空隊</h4><p class="note">航空隊ごとに1機のサイズと搭載機数を入力します。使用サイズは「サイズ × 機数」の合計です。</p><div class="aviation-wings">${wings.map(aviationWingHTML).join('')||'<p class="note">航空隊がありません。追加して搭載数を指定してください。</p>'}</div><button type="button" class="btn primary" data-addairwing ${wings.length>=C.AIR_WING_LIMITS.rows?'disabled':''}>航空隊を追加</button></div>${selected?.k==='hangar'?`<div class="pgroup"><h4>選択中 · ${esc(C.partLabel(selected))}</h4>${aviationPartHTML(selected)}</div>`:''}<details class="trench-editor aviation-bays"><summary>航空区画と出入口 · ${num(bays.length)} 区画</summary><p class="note">区画を選んで、位置・寸法・用途・接触面の開口を編集できます。開放型は高速に発艦し、シールドは電力を使って開口を防護します。</p><ul class="ilist">${bays.map(p=>`<li><button type="button" class="btn sm ghost" data-layout-part="${p.id}">${esc(C.partLabel(p))}</button><span data-aviation-capacity="${p.id}">${aviationSize(C.hangarCapacity(p))} サイズ</span></li>`).join('')||'<li><span>「区画」から航空区画を配置してください。</span></li>'}</ul></details>${slides.length?`<details class="trench-editor"><summary>スライド扉の開閉を確認</summary><p class="note">上甲板・腹部の扉は左右へ、舷側の扉は上下へ移動します。観閲式と戦闘開始時は閉じ、発艦指示で4秒かけて開き、発艦完了・中止後に閉じます。</p>${slides.map(aviationDoorHTML).join('')}</details>`:''}`;
}
// ---------- ground forces ----------
function groundNumbers(){return S?.ground||C.groundStatus(ship,S);}
const groundNum=v=>num(Math.round(v*10)/10);
function groundBudgetHTML(used,cap,label,unit){return `<div class="aviation-budget"><span>${label}</span><strong>${groundNum(cap)} <small>${unit}</small></strong><p>編成 <b>${groundNum(used)}</b> / ${groundNum(cap)} ${unit}</p><meter min="0" max="${Math.max(1,cap)}" value="${Math.min(used,Math.max(1,cap))}" aria-label="${label}の使用量"></meter><p class="${used>cap+1e-6?'neg':'ok'}">${used>cap+1e-6?'容量超過 '+groundNum(used-cap):'残り '+groundNum(Math.max(0,cap-used))} ${unit}</p></div>`;}
function groundRowHTML(r,i,n){
 const id=esc(r.id),L=C.GROUND_LIMITS,open=st.groundOpen?st.groundOpen.has(r.id):i<3,unit=r.kind==='troops'?'名':'両';
 return `<details class="airwing-row" data-ground-card="${id}" ${open?'open':''}><summary><b>${esc(r.name)}</b><span data-ground-summary="${id}">${r.kind==='troops'?num(r.count)+' 名':'サイズ '+r.size+' × '+num(r.count)+' 両'}${r.unembarked>0?` · ${num(r.unembarked)} 未搭載`:''}</span></summary>
 <label class="field-label">部隊名<input type="text" data-ground="${id}" data-groundfield="name" value="${esc(r.name)}" maxlength="${L.nameLength}" aria-label="部隊 ${i+1} の名前"></label>
 <div class="airwing-fields"><label>種別<select data-ground="${id}" data-groundfield="kind" aria-label="部隊 ${i+1} の種別"><option value="troops" ${r.kind==='troops'?'selected':''}>歩兵</option><option value="vehicle" ${r.kind==='vehicle'?'selected':''}>車両</option></select></label>${r.kind==='vehicle'?`<label>1両のサイズ<input type="number" data-ground="${id}" data-groundfield="size" value="${r.size}" min="${L.minSize}" max="${L.maxSize}" step=".1" inputmode="decimal" aria-label="部隊 ${i+1} の1両のサイズ"></label>`:''}<label>${r.kind==='troops'?'人数':'両数'}<input type="number" data-ground="${id}" data-groundfield="count" value="${r.count}" min="0" max="${L.maxCount}" step="1" inputmode="numeric" aria-label="部隊 ${i+1} の${r.kind==='troops'?'人数':'両数'}"></label></div>
 <p class="note" data-ground-status="${id}">${r.unembarked>0?`<span class="neg">容量不足で ${num(r.unembarked)} ${unit}が未搭載。</span>`:''}搭載 ${num(r.embarked)} / ${num(r.count)} ${unit}</p>
 <div class="chips"><button type="button" class="btn sm" data-fillground="${id}">空きまで搭載</button><button type="button" class="btn sm ghost" data-moveground="${id}" data-direction="-1" ${i===0?'disabled':''}>上へ</button><button type="button" class="btn sm ghost" data-moveground="${id}" data-direction="1" ${i===n-1?'disabled':''}>下へ</button><button type="button" class="btn sm danger" data-delground="${id}">削除</button></div></details>`;
}
function groundPanelHTML(){
 const g=groundNumbers();
 return `<div class="pgroup blueprint-card ground-editor"><h4>地上部隊編成</h4><p class="note">歩兵は「兵員収容区画」の容積（1名あたり12 m³）、車両は「車両格納・整備区画」の容積（サイズ1あたり600 m³）で搭載数が決まります。容量が足りないときは上の部隊から順に収容します。</p><div class="ground-budgets" id="groundSummary">${groundBudgetHTML(g.troops.used,g.troops.capacity,'兵員','名')}${groundBudgetHTML(g.vehicles.used,g.vehicles.capacity,'車両','サイズ')}</div><div class="chips"><button type="button" class="btn sm" data-groundroom="troops">兵員収容区画を配置</button><button type="button" class="btn sm" data-groundroom="vehicle">車両格納・整備区画を配置</button></div></div>
 <div class="pgroup"><h4>搭載する部隊</h4>${g.rows.map((r,i)=>groundRowHTML(r,i,g.rows.length)).join('')||'<p class="note">まだ部隊がありません。下のボタンから追加します。</p>'}<h4>部隊を追加</h4><div class="chips ground-add">${C.GROUND_PRESETS.map((p,i)=>`<button type="button" class="btn sm" data-addground="${i}">＋ ${esc(p.name)}${p.kind==='vehicle'?`（サイズ${p.size}）`:''}</button>`).join('')}</div><p class="note">AT-ATはサイズ8、AT-STはサイズ1が目安です。サイズは1両の格納に要る空間で、自由に変えられます。</p></div>`;
}
function updateGroundUI(){
 if(!ship||fleet.mode!=='design'||st.tab!=='ground')return;
 const g=groundNumbers(),sum=$('#groundSummary');if(sum)sum.innerHTML=groundBudgetHTML(g.troops.used,g.troops.capacity,'兵員','名')+groundBudgetHTML(g.vehicles.used,g.vehicles.capacity,'車両','サイズ');
 for(const r of g.rows){const unit=r.kind==='troops'?'名':'両',a=document.querySelector(`[data-ground-status="${r.id}"]`),b=document.querySelector(`[data-ground-summary="${r.id}"]`);if(a)a.innerHTML=`${r.unembarked>0?`<span class="neg">容量不足で ${num(r.unembarked)} ${unit}が未搭載。</span>`:''}搭載 ${num(r.embarked)} / ${num(r.count)} ${unit}`;if(b)b.textContent=`${r.kind==='troops'?num(r.count)+' 名':'サイズ '+r.size+' × '+num(r.count)+' 両'}${r.unembarked>0?` · ${num(r.unembarked)} 未搭載`:''}`;}
}
function editGroundInput(t,finish=false){
 const id=t.dataset.ground,k=t.dataset.groundfield,row=ship.groundForces?.find(r=>r.id===id);if(!row||!['name','kind','size','count'].includes(k))return;
 const value=k==='name'||k==='kind'?t.value:Number(t.value);if(!['name','kind'].includes(k)&&(t.value===''||!Number.isFinite(value))){if(finish){if(dragSnap)endDrag();t.value=String(row[k]);}return;}
 const rows=C.normalizeGroundForces(ship.groundForces.map(r=>r.id===id?{...r,[k]:value}:r));
 if(JSON.stringify(rows)!==JSON.stringify(ship.groundForces)){beginDrag('地上部隊を編集');ship.groundForces=rows;touch('none');scheduleStats(180);}
 if(finish){if(dragSnap)endDrag();if(k==='kind')renderPanel();}
}
function bindGround(){
 const panel=$('#panel');
 panel.addEventListener('toggle',e=>{const id=e.target.dataset?.groundCard;if(!id)return;st.groundOpen||=new Set((ship.groundForces||[]).slice(0,3).map(r=>r.id));if(e.target.open)st.groundOpen.add(id);else st.groundOpen.delete(id);},true);
 panel.addEventListener('input',e=>{if(e.target.dataset.ground&&e.target.tagName!=='SELECT')editGroundInput(e.target);});
 panel.addEventListener('change',e=>{if(e.target.dataset.ground)editGroundInput(e.target,true);});
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!ship)return;const d=b.dataset,rows=ship.groundForces||[];
  if(d.addground!=null){const p=C.GROUND_PRESETS[+d.addground];if(!p||rows.length>=C.GROUND_LIMITS.rows)return;if(dragSnap)endDrag();const ids=new Set(rows.map(r=>r.id));let n=1;while(ids.has('ground-'+n))n++;const id='ground-'+n;mutate('地上部隊を追加',()=>ship.groundForces=C.normalizeGroundForces([...rows,{id,name:p.name,kind:p.kind,size:p.size,count:0}]),'none');st.groundOpen||=new Set();st.groundOpen.add(id);renderPanel();return;}
  if(d.fillground){const row=rows.find(r=>r.id===d.fillground),g=groundNumbers();if(!row)return;if(dragSnap)endDrag();const cap=row.kind==='troops'?g.troops.capacity:g.vehicles.capacity,other=rows.reduce((n,r)=>n+(r.id!==row.id&&r.kind===row.kind?r.size*r.count:0),0);mutate('空きまで搭載',()=>{row.count=Math.min(C.GROUND_LIMITS.maxCount,Math.max(0,Math.floor((cap-other+1e-6)/row.size)));},'none');renderPanel();return;}
  if(d.delground){if(dragSnap)endDrag();mutate('地上部隊を削除',()=>ship.groundForces=rows.filter(r=>r.id!==d.delground),'none');renderPanel();return;}
  if(d.moveground){const i=rows.findIndex(r=>r.id===d.moveground),j=i+Number(d.direction);if(i<0||j<0||j>=rows.length)return;if(dragSnap)endDrag();mutate('地上部隊の収容優先順',()=>{const r=rows.splice(i,1)[0];rows.splice(j,0,r);ship.groundForces=rows;},'none');renderPanel();return;}
  if(d.groundroom){st.tab='mod';st.group=d.groundroom==='troops'?'command':'air';st.part=d.groundroom;st.partTool='place';st.equipmentId=null;st.template=null;renderPanel();return;}
 });
}
// ---------- multiple selection, copy and paste ----------
// Parts and fittings can be gathered into one selection, copied to a clipboard
// kept in this browser (so it survives opening another design) and pasted.
st.multi={parts:new Set(),fits:new Set()};st.pasteMode='same';st.multiStep=10;
const CLIP_KEY='yard.clipboard1';
function clipRead(){try{const raw=LS.get(CLIP_KEY);if(raw){const c=JSON.parse(raw);if(c&&c.v===1&&Array.isArray(c.parts)&&Array.isArray(c.fits))return c;}}catch(e){}return st.clipMem||null;}
function clipWrite(c){st.clipMem=c;if(!LS.set(CLIP_KEY,JSON.stringify(c)))toast('この端末には保存できないため、クリップボードはこの画面を閉じるまで有効です');}
const publicCopy=o=>JSON.parse(JSON.stringify(o,(k,v)=>k&&k[0]==='_'?undefined:v));
function multiItems(){return {parts:ship.parts.filter(p=>st.multi.parts.has(p.id)),fits:ship.fits.filter(f=>st.multi.fits.has(f.id))};}
// Symmetry copies come along while 左右対称 / 上下対称 are on, as when removing.
function multiLinked(list,it){const find=id=>id==null?null:ship[list].find(q=>q.id===id),out=[it];if(st.mirror&&it.tw!=null){const t=find(it.tw);if(t)out.push(t);}if(st.vmirror&&it.vt!=null){const v=find(it.vt);if(v){out.push(v);if(st.mirror&&v.tw!=null){const w=find(v.tw);if(w)out.push(w);}}}return out;}
function multiToggle(hit){
 let list=null,it=null;
 if(hit?.part?.windowId||hit?.part?.weaponId){list='fits';it=ship.fits.find(f=>f.id===(hit.part.windowId||hit.part.weaponId));}
 else if(hit?.fit){list='fits';it=hit.fit;}else if(hit?.part&&hit.part.id>0){list='parts';it=ship.parts.find(p=>p.id===hit.part.id);}
 if(!it){toast(st.view==='normal'?'部品をタップしてください（内部の区画は「透視」で選べます）':'部品が見つかりません');return;}
 const set=st.multi[list],on=!set.has(it.id);for(const q of multiLinked(list,it))on?set.add(q.id):set.delete(q.id);
 renderPanel();refreshOverlay();
}
function multiCopy(){const m=multiItems();if(!m.parts.length&&!m.fits.length){toast('選択がありません');return false;}clipWrite({v:1,from:{name:ship.name,L:ship.hull.L,W:ship.hull.W,H:ship.hull.H},parts:m.parts.map(publicCopy),fits:m.fits.map(publicCopy),at:Date.now()});return true;}
function multiDelete(label){
 const ids={parts:new Set(st.multi.parts),fits:new Set(st.multi.fits)};if(!ids.parts.size&&!ids.fits.size)return;
 mutate(label||'まとめて撤去',()=>{for(const id of ids.fits)C.removeItem(ship,'fits',id,false);for(const id of ids.parts)C.removeItem(ship,'parts',id,false);for(const f of ship.fits)if(f.host!=null&&ids.parts.has(f.host))delete f.host;},'all');
 st.multi={parts:new Set(),fits:new Set()};if(st.sel&&ids[st.sel.list]?.has(st.sel.id))st.sel=null;
}
function multiPaste(){
 const c=clipRead();if(!c||!(c.parts.length||c.fits.length)){toast('クリップボードは空です');return;}
 const k=st.pasteMode==='scale'&&c.from?.L>0?[ship.hull.L/c.from.L,ship.hull.H/(c.from.H||ship.hull.H),ship.hull.W/(c.from.W||ship.hull.W)]:[1,1,1],sc=v=>v.map((x,i)=>x*k[i]);
 const L=C.DESIGN_LIMITS;if(ship.parts.length+c.parts.length>L.parts||ship.fits.length+c.fits.length>L.fits){toast(`部品数の上限（区画 ${L.parts}・装備 ${L.fits}）を超えるため貼り付けられません`);return;}
 const map={parts:new Map(),fits:new Map()},made={parts:[],fits:[]};
 const ok=mutate(`${c.parts.length+c.fits.length} 個を貼り付け`,()=>{
  for(const l of ['parts','fits'])for(const src of c[l]){const q=JSON.parse(JSON.stringify(src));map[l].set(src.id,ship.nextId);q.id=ship.nextId++;made[l].push(q);}
  for(const l of ['parts','fits'])for(const q of made[l]){for(const r of ['tw','vt']){if(q[r]==null)continue;const n=map[l].get(q[r]);if(n!=null)q[r]=n;else delete q[r];}
   if(l==='fits'){if(q.host!=null){const n=map.parts.get(q.host);if(n!=null)q.host=n;else delete q.host;}q.p=sc(q.p);delete q.float;}else q.c=sc(q.c);
   ship[l].push(q);}
 },'all');
 if(ok===false)return;st.multi={parts:new Set(made.parts.map(q=>q.id)),fits:new Set(made.fits.map(q=>q.id))};
 toast(`貼り付けました：区画・構造物 ${made.parts.length}・装備 ${made.fits.length}`);
}
function multiMove(axis,sign){
 const m=multiItems(),step=C.clamp(+st.multiStep||0,0,C.DESIGN_LIMITS?.coordinate||1e5);if(!(m.parts.length||m.fits.length)||!step)return;
 const d=[0,0,0];d[axis]=sign*step;const moved=new Set();
 mutate('まとめて移動',()=>{
  const apply=(l,q,v)=>{if(!q||moved.has(l+q.id))return;moved.add(l+q.id);if(l==='parts')q.c=q.c.map((x,i)=>x+v[i]);else q.p=q.p.map((x,i)=>x+v[i]);};
  for(const l of ['parts','fits']){const find=id=>ship[l].find(x=>x.id===id),inSel=id=>id!=null&&st.multi[l].has(id);
   for(const q of m[l]){if(moved.has(l+q.id))continue;apply(l,q,d);
    if(st.mirror&&inSel(q.tw))apply(l,find(q.tw),[d[0],d[1],-d[2]]);
    if(st.vmirror&&inSel(q.vt)){const v=find(q.vt);apply(l,v,[d[0],-d[1],d[2]]);if(st.mirror&&v&&inSel(v.tw))apply(l,find(v.tw),[d[0],-d[1],-d[2]]);}}}
 },'all');
}
function multiPanelHTML(){
 const m=multiItems(),np=m.parts.length,nf=m.fits.length,n=np+nf,c=clipRead(),cn=c?c.parts.length+c.fits.length:0;
 const kinds=[...m.parts.map(p=>C.PARTS[p.k]?.name),...m.fits.map(f=>C.FITS[f.k]?.short)].reduce((o,k)=>(o[k]=(o[k]||0)+1,o),{});
 return `<div class="pgroup blueprint-card multi-card"><h4>複数選択</h4><p class="note">区画・構造物・装備をタップして選択に加え、もう一度タップで外します。左右・上下対称がオンなら対の部品も一緒に選びます。内部の区画は「透視」で選べます。</p>
 <div class="multi-count"><span><b>${np}</b> 区画・構造物</span><span><b>${nf}</b> 装備</span></div>${n?`<p class="note multi-kinds">${Object.entries(kinds).map(([k,v])=>esc(k||'—')+' ×'+v).join('・')}</p>`:''}
 <div class="chips"><button type="button" class="chip" data-multi="allparts">区画・構造物をすべて</button><button type="button" class="chip" data-multi="allstruct">構造物だけ</button><button type="button" class="chip" data-multi="allfits">装備をすべて</button><button type="button" class="chip" data-multi="none" ${n?'':'disabled'}>選択解除</button></div>
 <div class="multi-actions"><button type="button" class="btn primary" data-multi="copy" ${n?'':'disabled'}>コピー</button><button type="button" class="btn" data-multi="cut" ${n?'':'disabled'}>切り取り</button><button type="button" class="btn sm danger" data-multi="delete" ${n?'':'disabled'}>撤去</button></div>
 <h4>まとめて移動</h4><label class="field-label multi-step">移動量（m）<input type="number" data-multistep min="0.1" step="any" value="${st.multiStep}"></label>
 <div class="multi-move">${[[0,1,'艦首へ'],[0,-1,'艦尾へ'],[1,1,'上へ'],[1,-1,'下へ'],[2,-1,'左舷へ'],[2,1,'右舷へ']].map(([a,sg,l])=>`<button type="button" class="btn sm" data-multimove="${a}" data-sign="${sg}" ${n?'':'disabled'}>${l}</button>`).join('')}</div>
 <p class="note">対称の相手も選んでいれば鏡写しに動きます。装備は移動後に近くの面へ据え直します。</p></div>
 <div class="pgroup blueprint-card multi-card"><h4>貼り付け</h4>${c?`<p class="multi-clip"><span>区画・構造物 <b>${c.parts.length}</b>　装備 <b>${c.fits.length}</b></span><small>「${esc(c.from?.name||'不明')}」全長 ${fLen(c.from?.L||0)} から</small></p>${seg('pastemode',[['same','同じ座標'],['scale','艦の寸法に合わせる']],st.pasteMode)}<div class="multi-actions"><button type="button" class="btn primary" data-multi="paste">${cn} 個を貼り付け</button></div><p class="note">貼り付けた部品はそのまま選択されるので、続けて「まとめて移動」で位置を整えられます。別の艦へは、設計図から艦を開いてこの画面で貼り付けます。クリップボードはこの端末のブラウザに残ります。</p>`:'<p class="note">まだコピーしていません。選択して「コピー」すると、この艦や別の艦に貼り付けられます。</p>'}</div>`;
}
function bindMulti(){
 const panel=$('#panel');
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||!ship)return;const d=b.dataset;
  if(d.pastemode){st.pasteMode=d.pastemode;renderPanel();return;}
  if(d.multimove!=null){multiMove(+d.multimove,+d.sign);renderPanel();refreshOverlay();return;}
  if(!d.multi)return;const a=d.multi;
  if(a==='allparts')st.multi.parts=new Set(ship.parts.map(p=>p.id));
  else if(a==='allstruct')st.multi.parts=new Set(ship.parts.filter(p=>p.k==='struct').map(p=>p.id));
  else if(a==='allfits')st.multi.fits=new Set(ship.fits.map(f=>f.id));
  else if(a==='none')st.multi={parts:new Set(),fits:new Set()};
  else if(a==='copy'){if(multiCopy())toast('コピーしました。別の艦を開いても貼り付けられます');}
  else if(a==='cut'){if(multiCopy())multiDelete('切り取り');}
  else if(a==='delete')multiDelete();
  else if(a==='paste')multiPaste();
  renderPanel();refreshOverlay();
 });
 panel.addEventListener('change',e=>{if(e.target.dataset.multistep==null)return;const v=+e.target.value;if(Number.isFinite(v)&&v>0)st.multiStep=v;else e.target.value=st.multiStep;});
}
// Phone landscape: the right-hand editor can be hidden to give the 3D view the whole screen.
function bindDockToggle(){
 const b=$('#btnDock');if(!b)return;
 const set=on=>{$('#app').classList.toggle('dock-off',on);b.setAttribute('aria-pressed',String(on));b.title=on?'操作パネルを表示':'操作パネルを隠す';b.setAttribute('aria-label',b.title);setTimeout(()=>requestDraw(),30);};
 b.addEventListener('click',()=>set(!$('#app').classList.contains('dock-off')));set(false);
}
// ---------- 公試: a free flight trial in low orbit over Coruscant ----------
// WoWS-style standing orders for speed and rudder, a stick for pitch and roll,
// and turrets that follow the view. The ship stays at the render origin; its
// position is kept in double precision relative to the planet centre.
const TRIAL_PLANET={radius:6.12e6,altitude:160000,floor:40000,sun:(()=>{const v=[.85,-.1,.5],l=Math.hypot(...v);return v.map(x=>x/l);})()};
const TRIAL_TELEGRAPH=[['後進',-.25],['停止',0],['1/4',.25],['1/2',.5],['3/4',.75],['全速',1]];
const TRIAL_RUDDER=['取舵一杯','取舵','舵中央','面舵','面舵一杯'];
// The orbit centre floats above the ship and the default view is nearly level,
// so the reticle (screen centre) looks at the horizon with the ship below it.
const TRIAL_CAM_PH=1.54,TRIAL_CAM_LIFT=.2;
const TRIAL_GUN={boltSpeed:4500,range:40000,aim:20000,maxBolts:2400,hitsToKill:10,targets:4};
const trial={on:false,busy:false,asset:null,p:null,P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],tele:1,rudder:0,level:false,t:0,last:0,hud:0,vf:0,thrust:0,camMode:'horizon',camF:null,rec:null,dust:null,warn:'',designCamera:null,
 stick:{x:0,y:0},keyStick:{x:0,y:0},keys:new Set(),fire:false,fireKey:false,fireTap:0,turrets:[],launchers:[],bolts:[],missiles:[],fx:[],targets:[],gun:null,rays:{busy:false,last:0},aim:null,lead:null,power:null,mslOrder:false};
const tv={dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len:a=>Math.hypot(a[0],a[1],a[2]),norm:a=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},add:(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k,a[2]+b[2]*k],scale:(a,k)=>[a[0]*k,a[1]*k,a[2]*k],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]]};
function trialRot(v,axis,ang){const c=Math.cos(ang),s=Math.sin(ang),d=tv.dot(axis,v),x=tv.cross(axis,v);return [v[0]*c+x[0]*s+axis[0]*d*(1-c),v[1]*c+x[1]*s+axis[1]*d*(1-c),v[2]*c+x[2]*s+axis[2]*d*(1-c)];}
// Column-major frame from forward and approximate up (Gram-Schmidt).
function trialFrame(f,u){f=tv.norm(f);u=tv.norm(tv.add(u,f,-tv.dot(u,f)));const r=tv.cross(f,u);return [f[0],f[1],f[2],u[0],u[1],u[2],r[0],r[1],r[2]];}
const trialCol=(M,i)=>[M[i*3],M[i*3+1],M[i*3+2]];
const trialApply=(M,v)=>[M[0]*v[0]+M[3]*v[1]+M[6]*v[2],M[1]*v[0]+M[4]*v[1]+M[7]*v[2],M[2]*v[0]+M[5]*v[1]+M[8]*v[2]];
const trialApplyT=(M,v)=>[M[0]*v[0]+M[1]*v[1]+M[2]*v[2],M[3]*v[0]+M[4]*v[1]+M[5]*v[2],M[6]*v[0]+M[7]*v[1]+M[8]*v[2]];
// Rotation about a unit axis, column-major.
function trialAxisMatrix(a,t,out){const c=Math.cos(t),s=Math.sin(t),k=1-c,[x,y,z]=a;out=out||new Array(9);out[0]=c+x*x*k;out[1]=y*x*k+z*s;out[2]=z*x*k-y*s;out[3]=x*y*k-z*s;out[4]=c+y*y*k;out[5]=z*y*k+x*s;out[6]=x*z*k+y*s;out[7]=y*z*k-x*s;out[8]=c+z*z*k;return out;}
const trialWrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
function trialProfile(){if(!ship||!S)return null;try{return C.fleetProfile(S,ship.name);}catch(e){return null;}}
function trialFigures(p){const v=p?.maxSpeed||0,ok=!!(p&&p.accel>0&&v>0&&p.turnRate>0);const rates=(ship?.fits||[]).filter(f=>{const d=C.FITS[f.k];return d.cat==='w'&&(d.tt||d.ion)&&!f.float&&!d.casemate;}).map(f=>C.turretRate(f));return {ok,v,kmh:v*3.6,accelTime:ok?v/p.accel:0,turn:ok?p.turnRate*180/Math.PI:0,circle:ok?2*v/p.turnRate:0,traverse:rates.length?[Math.min(...rates),Math.max(...rates)]:null};}
function trialCardHTML(side){
 if(!ship||!S)return '';const f=trialFigures(trialProfile()),tr=f.traverse;
 return `<div class="pgroup trial-card${side?' side':''}"><div class="trial-head"><h4>公試</h4><span>コルサント低軌道</span></div><p class="note">設計した艦を軌道上で操艦し、速力・加速・旋回と砲塔の射界を確かめます。</p>${f.ok?`<dl class="trial-kv"><dt>最大速力</dt><dd>${num(Math.round(f.v))} m/s</dd><dt>0→全速</dt><dd>${Math.round(f.accelTime)} 秒</dd><dt>全舵旋回率</dt><dd>${f.turn.toFixed(1)}°/秒</dd><dt>全速旋回径</dt><dd>${(f.circle/1000).toFixed(1)} km</dd>${tr?`<dt>砲塔旋回</dt><dd>${tr[0]===tr[1]?tr[0].toFixed(0):tr[0].toFixed(0)+'〜'+tr[1].toFixed(0)}°/秒</dd>`:''}</dl>`:`<p class="note neg">加速度が 0 G のため航行できません。推進・慣性補償・構造の上限を確認してください。</p>`}<button type="button" class="btn primary trial-go" data-trial="start" ${f.ok?'':'disabled'}>公試に出る</button></div>`;
}
const trialCamRange=r=>C.clamp(r,trial.p.len*.45+60,trial.p.len*10+4000);
function trialReset(){
 const R=TRIAL_PLANET.radius;Object.assign(trial,{P:[0,R+TRIAL_PLANET.altitude,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],tele:1,rudder:0,level:false,t:0,last:0,vf:0,thrust:0,camF:null,warn:'',bolts:[],missiles:[],fx:[],fireTap:0,aim:null,lead:null,mslOrder:false});
 trial.rec={top:0,accel:null,run:null,turn:null,turnSpeed:0};trial.gun={shots:0,hits:0,kills:0,missiles:0};for(const l of trial.launchers){l.reload=0;l.queue=0;l.next=0;}
 const L=trial.p.len,H=C.clamp(L*2,1400,30000),n=280,pos=new Float32Array(n*3);for(let i=0;i<pos.length;i++)pos[i]=(Math.random()*2-1)*H;
 trial.dust={H,pos,col:new Uint8Array(n*4).map((_,i)=>i%4===3?120:170+(i%4)*14),size:new Float32Array(n).fill(Math.max(2,L*.0035))};
 for(const t of trial.turrets){t.yaw=0;t.el=0;t.reload=Math.random()*t.cycle;t.clear=false;t.clearDir=null;t.aimed=false;t.arc=true;t.rot=trialAxisMatrix(t.axis,0,t.rot);}
 trial.targets=[];for(let i=0;i<TRIAL_GUN.targets;i++)trial.targets.push(trialSpawnTarget(i,true));
 if(view){const asp=(view.canvas.clientWidth||900)/(view.canvas.clientHeight||600);view.cam.th=Math.PI;view.cam.ph=TRIAL_CAM_PH;view.cam.r=trialCamRange((L*1.35+260)*Math.max(1,.95/asp));}
}
// Target buoys sit ahead of the ship in its local horizon, 8–28 km out.
function trialSpawnTarget(i,first){
 const up=tv.norm(trial.P),f=trialCol(trial.R,0);let fh=tv.add(f,up,-tv.dot(f,up));fh=tv.len(fh)>.2?tv.norm(fh):tv.norm(tv.cross(up,[0,0,1]));const rt=tv.cross(fh,up);
 const L=trial.p.len,bearing=first?[-.6,.25,-.15,.55][i%4]:(Math.random()*2-1)*1.2,dist=first?[9000,14000,20000,27000][i%4]+L*.6:8000+L*.6+Math.random()*20000,rise=(Math.random()*2-1)*1500;
 const off=tv.add(tv.add(tv.scale(fh,Math.cos(bearing)*dist),rt,Math.sin(bearing)*dist),up,rise);
 const hd=Math.random()*Math.PI*2,sp=40+Math.random()*140;
 return {id:i,pos:tv.add(trial.P,off),vel:tv.add(tv.scale(fh,Math.cos(hd)*sp),rt,Math.sin(hd)*sp),hits:0,alive:true,respawn:0,spin:Math.random()*6.28,rot:[1,0,0,0,1,0,0,0,1]};
}
function trialTurretState(t){const fw=tv.norm(t.fw),axis=tv.norm(t.axis);return {...t,fw,axis,e2:tv.cross(axis,fw),rateRad:t.rate*Math.PI/180,yaw:0,el:0,reload:0,clear:false,clearDir:null,aimed:false,arc:true,rot:trialAxisMatrix(axis,0)};}
async function trialStart(){
 if(trial.on||trial.busy||!ship||!view||fleet.mode!=='design')return;
 const f=trialFigures(trialProfile());if(!f.ok){toast('加速度が 0 G のため公試を行えません');return;}
 trial.busy=true;showBusyOverlay('公試の準備中…（砲塔の旋回軸と射界を計算）');
 let a=null;try{const data=C.serialize(ship),key='trial-'+fleetHash(JSON.stringify(data)),r=await YardEngineClient.request('fleet',{design:data,trial:true});a={key,design:r.design,stats:r.stats,p:r.profile,geometry:r.geometry};if(view)view.loadFleet(key,r.geometry);}
 catch(e){console.error(e);toast('公試を開始できません：'+esc(e.message||e));}finally{trial.busy=false;hideBusyOverlay();}
 if(!a||trial.on||fleet.mode!=='design')return;
 if(!(a.p.accel>0&&a.p.maxSpeed>0)){toast('加速度が 0 G のため公試を行えません');return;}
 trial.asset=a;trial.p=a.p;trial.turrets=(a.geometry.turrets||[]).map(trialTurretState);for(const t of trial.turrets)t.charge=t.cap?C.clamp(a.stats.chargeInfo?.[t.id]?.ratio??0,0,1):1;trial.launchers=(a.geometry.launchers||[]).map(l=>({...l,reload:0,queue:0,next:0}));trial.designCamera={cam:JSON.parse(JSON.stringify(view.cam)),off:[...view.off]};
 closeSheet();hideInspect();clearHover();if(dragSnap)endDrag();
 view.off=[0,0,0];view.cam={...view.cam,target:[0,0,0],ortho:false};trialReset();
 trial.on=true;document.body.classList.add('trial-on');const hud=$('#trialHud');hud.hidden=false;hud.innerHTML=trialHudHTML();trialBindHud(hud);trialHudUpdate(true);
 requestAnimationFrame(()=>{requestDraw();});
}
function trialStop(){
 if(!trial.on)return;trial.on=false;trial.fire=trial.fireKey=false;trial.keys.clear();trial.stick={x:0,y:0};trial.keyStick={x:0,y:0};
 document.body.classList.remove('trial-on');const hud=$('#trialHud');hud.hidden=true;hud.innerHTML='';
 if(view){if(trial.designCamera){view.cam=trial.designCamera.cam;view.off=trial.designCamera.off;}delete view.cam.frame;delete view.cam.far;}
 try{YardEngineClient.post({type:'trialEnd'});}catch(e){}
 trial.asset=null;trial.turrets=[];trial.launchers=[];trial.bolts=[];trial.missiles=[];trial.fx=[];trial.targets=[];fleetPrune();renderPanel();renderSpecTargets();syncHud();requestDraw();
}
function trialAttitude(){
 const R=trial.R,f=trialCol(R,0),u=trialCol(R,1),r=trialCol(R,2),up=tv.norm(trial.P),north=[0,0,-1];
 let nt=tv.add(north,up,-tv.dot(north,up));nt=tv.len(nt)>1e-6?tv.norm(nt):[1,0,0];const et=tv.cross(nt,up),fh=tv.add(f,up,-tv.dot(f,up));
 const heading=((Math.atan2(tv.dot(fh,et),tv.dot(fh,nt))*180/Math.PI)%360+360)%360;
 return {f,u,r,up,pitch:Math.asin(C.clamp(tv.dot(f,up),-1,1)),bank:Math.atan2(-tv.dot(r,up),tv.dot(u,up)),heading,alt:tv.len(trial.P)-TRIAL_PLANET.radius};
}
function trialMaxRates(){const p=trial.p,tr=p.turnRate||0,sf=.45+.55*Math.min(1,Math.abs(trial.vf)/Math.max(1,p.maxSpeed));return [tr*2.2,tr*sf,tr*.75*sf];}
// Touch stick and held keys: the larger deflection on each axis wins.
function trialStickInput(){const a=trial.stick,b=trial.keyStick,pick=(x,y)=>Math.abs(x)>=Math.abs(y)?x:y;return {x:C.clamp(pick(a.x,b.x),-1,1),y:C.clamp(pick(a.y,b.y),-1,1)};}
function trialStep(dt){
 const p=trial.p,a=trialAttitude(),max=trialMaxRates(),stick=trialStickInput();
 if(Math.abs(stick.x)>.05||Math.abs(stick.y)>.05)trial.level=false;
 const want=[stick.x*max[0],trial.rudder/2*max[1],stick.y*max[2]];
 if(trial.level){want[0]=C.clamp(-a.bank*.9,-max[0],max[0]);want[2]=C.clamp(-a.pitch*.9,-max[2]||-.01,max[2]||.01);if(Math.abs(a.bank)<.003&&Math.abs(a.pitch)<.003&&Math.abs(trial.w[0])<.003&&Math.abs(trial.w[2])<.003){trial.level=false;trial.w[0]=trial.w[2]=0;}}
 const k=1-Math.exp(-dt/C.clamp(1.3*Math.sqrt(p.len/1600),.5,5));for(let i=0;i<3;i++)trial.w[i]+=(want[i]-trial.w[i])*k;
 // roll about forward, yaw (positive = starboard) about -up, pitch about starboard
 const om=tv.add(tv.add(tv.scale(a.f,trial.w[0]),a.u,-trial.w[1]),a.r,trial.w[2]),mag=tv.len(om);
 if(mag>1e-9){const ax=tv.scale(om,1/mag),ang=mag*dt;trial.R=trialFrame(trialRot(a.f,ax,ang),trialRot(a.u,ax,ang));}
 const f=trialCol(trial.R,0),sp=TRIAL_TELEGRAPH[trial.tele][1]*p.maxSpeed,vf=tv.dot(trial.V,f),dv=C.clamp(sp-vf,-p.accel*dt,p.accel*dt);
 trial.thrust=p.accel>0&&dt>0?Math.abs(dv)/(p.accel*dt):0;
 const lat=tv.add(trial.V,f,-vf),damp=Math.exp(-dt/2.5);trial.V=tv.add(tv.scale(f,vf+dv),lat,damp);trial.vf=vf+dv;
 trial.P=tv.add(trial.P,trial.V,dt);trial.t+=dt;
 const up=tv.norm(trial.P),floor=TRIAL_PLANET.radius+TRIAL_PLANET.floor;trial.warn='';
 if(tv.len(trial.P)<floor){trial.P=tv.scale(up,floor);const vr=tv.dot(trial.V,up);if(vr<0)trial.V=tv.add(trial.V,up,-vr);trial.warn='大気圏上層：これ以上は降下できません';}
 else if(tv.len(trial.P)<floor+20000)trial.warn='大気圏に接近中';
 const d=trial.dust,H=d.H,mv=tv.scale(trial.V,dt);for(let i=0;i<d.pos.length;i+=3)for(let j=0;j<3;j++){let x=d.pos[i+j]-mv[j];if(x>H)x-=2*H*Math.ceil((x-H)/(2*H));else if(x<-H)x+=2*H*Math.ceil((-H-x)/(2*H));d.pos[i+j]=x;}
 const r=trial.rec,vmax=p.maxSpeed;r.top=Math.max(r.top,trial.vf);
 if(trial.tele===5&&!r.run&&trial.vf<.02*vmax)r.run={t0:trial.t};if(r.run&&trial.tele!==5)r.run=null;if(r.run&&trial.vf>=.98*vmax){r.accel=trial.t-r.run.t0;r.run=null;}
 if(Math.abs(trial.rudder)===2&&Math.abs(trial.vf)>.05*vmax&&Math.abs(Math.abs(trial.w[1])-max[1])<.03*max[1]){r.turn=2*Math.abs(trial.vf)/Math.abs(trial.w[1]);r.turnSpeed=trial.vf;}
 trialGunnery(dt);
}
// ---- gunnery ----
const trialBarrel=(t,yaw,el)=>{const c=Math.cos(el),h=tv.add(tv.scale(t.fw,Math.cos(yaw)),t.e2,Math.sin(yaw));return tv.norm(tv.add(tv.scale(h,c),t.axis,Math.sin(el)));};
const trialLimits=t=>t.casemate?{yaw:65*Math.PI/180,lo:-20*Math.PI/180,hi:20*Math.PI/180}:{yaw:null,lo:-10*Math.PI/180,hi:85*Math.PI/180};
function trialAim(){
 if(!view)return null;const eye=view.eye(),dir=tv.norm(tv.sub(view.cam.target,eye));let dist=Math.max(TRIAL_GUN.aim,trial.p.len*1.5),lock=null,best=Infinity;
 for(const t of trial.targets){if(!t.alive)continue;const v=tv.sub(tv.sub(t.pos,trial.P),eye),d=tv.len(v),ang=Math.acos(C.clamp(tv.dot(v,dir)/d,-1,1)),cone=Math.atan(trial.asset.geometry.targetRadius*1.6/d)+.006;if(ang<cone&&ang<best){best=ang;lock=t;dist=d;}}
 return {eye,dir,dist,lock,point:tv.add(eye,dir,dist)};
}
// Time for a bolt leaving o at speed s (plus the ship's own velocity) to meet a
// target at p moving at u relative to the ship. Null when it cannot catch up.
function trialIntercept(d,u,s){const a=tv.dot(u,u)-s*s,b=2*tv.dot(d,u),c=tv.dot(d,d);if(Math.abs(a)<1e-6)return b<0?-c/b:null;const disc=b*b-4*a*c;if(disc<0)return null;const r=Math.sqrt(disc),t1=(-b-r)/(2*a),t2=(-b+r)/(2*a),t=Math.min(t1,t2)>0?Math.min(t1,t2):Math.max(t1,t2);return t>0?t:null;}
// Reactor budget for the guns: output after shields, hotel load, ray shields and
// the engines (idle 20 %, full while accelerating or braking).
function trialPower(){const S0=trial.asset?.stats;if(!S0||!(S0.power>0))return {budget:0,engine:0,P:0};const d=S0.draw||{},engine=(d.engines||0)*(.2+.8*trial.thrust);return {P:S0.power,engine,budget:Math.max(0,S0.power-(d.shields||0)-(d.hotel||0)-(d.ray||0)-engine)};}
function trialGunnery(dt){
 const a=trial.aim=trialAim();if(!a)return;const R=trial.R,center=trial.asset.geometry.center,wantFire=trial.fire||trial.fireKey||trial.fireTap>0;trial.fireTap=Math.max(0,trial.fireTap-dt);
 const color=trial.asset.geometry.reference==='venator'||trial.asset.geometry.paint==='republic'?[120,175,255]:[95,255,120],lock=a.lock,spd=TRIAL_GUN.boltSpeed;
 const u=lock?tv.sub(lock.vel,trial.V):null,lockRel=lock?tv.sub(lock.pos,trial.P):null;
 // Lead for the ship's centre (HUD marker); each turret solves its own below.
 trial.lead=null;if(lock){const t=trialIntercept(lockRel,u,spd);if(t)trial.lead=tv.add(lockRel,u,t);}
 let demand=0;
 for(const t of trial.turrets){
  const oW=trialApply(R,tv.sub(t.origin,center));let aimW=a.point;
  if(lock){const tt=trialIntercept(tv.sub(lockRel,oW),u,spd);if(tt)aimW=tv.add(lockRel,u,tt);}
  const dl=trialApplyT(R,tv.norm(tv.sub(aimW,oW))),lim=trialLimits(t);
  let ty=Math.atan2(tv.dot(dl,t.e2),tv.dot(dl,t.fw)),te=Math.asin(C.clamp(tv.dot(dl,t.axis),-1,1));t.arc=true;
  if(lim.yaw!=null&&Math.abs(ty)>lim.yaw){ty=Math.sign(ty)*lim.yaw;t.arc=false;}if(te<lim.lo||te>lim.hi){te=C.clamp(te,lim.lo,lim.hi);t.arc=false;}
  const sy=t.rateRad*dt,dy=trialWrap(ty-t.yaw);t.yaw=trialWrap(t.yaw+C.clamp(dy,-sy,sy));const se=t.rateRad*1.5*dt;t.el+=C.clamp(te-t.el,-se,se);
  if(t.mesh)trialAxisMatrix(t.axis,t.yaw,t.rot);
  const err=Math.max(Math.abs(trialWrap(ty-t.yaw)),Math.abs(te-t.el));t.aimed=t.arc&&err<.018;t.laid=t.arc&&err<.005;
  const bd=trialBarrel(t,t.yaw,t.el),ok=t.clear&&t.clearDir&&tv.dot(bd,t.clearDir)>.9986;t.ready=t.aimed&&ok&&t.charge>0;
  t.firing=wantFire&&t.ready;if(t.firing||t.reload>0)demand+=t.power*t.charge;t.bd=bd;t.oW=oW;
 }
 // Recharge slows when the reactor cannot feed every gun that is cycling.
 const pw=trialPower();trial.power={...pw,demand,rate:demand>0?C.clamp(pw.budget/demand,0,1):1,full:trial.turrets.reduce((n,t)=>n+t.power*t.charge,0)};
 for(const t of trial.turrets){
  t.reload=Math.max(0,t.reload-dt*trial.power.rate*t.charge);
  if(t.firing&&t.laid&&t.reload<=0){
   t.reload=t.cycle*(1+Math.random()*.08);const bd=t.bd,n=Math.min(t.barrels,t.r>12?2:t.barrels>2?2:1),g=()=>(Math.random()+Math.random()+Math.random()-1.5)*.0012,bw=trialApply(R,tv.norm(tv.add(tv.add(bd,t.e2,g()),t.axis,g()))),side=trialApply(R,tv.norm(tv.cross(t.axis,bd))),base=tv.add(tv.add(trial.P,t.oW),bw,t.r*1.2),spread=t.r*.35;
   trial.gun.shots+=t.barrels;
   for(let i=0;i<n;i++){const off=n>1?(i/(n-1)-.5)*spread:0,pos=tv.add(base,side,off);trial.bolts.push({pos,prev:pos,vel:tv.add(tv.scale(bw,spd),trial.V),life:Math.max(TRIAL_GUN.range,trial.p.len*3)/spd,len:Math.max(70,t.r*9),size:Math.max(5,t.r*.9),col:t.ion?[170,215,255]:color,weight:t.barrels/n});}
   trial.fx.push({pos:base,vel:trial.V,life:.12,max:.12,size:Math.max(6,t.r*1.6),col:[255,240,210]});
  }
 }
 if(trial.bolts.length>TRIAL_GUN.maxBolts)trial.bolts.splice(0,trial.bolts.length-TRIAL_GUN.maxBolts);
 trialMissiles(dt,lock);
 const Rt=trial.asset.geometry.targetRadius,hitTarget=(t,q,w)=>{trial.gun.hits+=w;t.hits+=w;
   for(let k=0;k<6;k++)trial.fx.push({pos:q,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),40+Math.random()*120)),life:.5,max:.5,size:Rt*.18,col:[255,200,120]});
   if(t.hits>=TRIAL_GUN.hitsToKill){t.alive=false;t.respawn=4;trial.gun.kills++;for(let k=0;k<46;k++)trial.fx.push({pos:t.pos,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),Rt*(.6+Math.random()*2.2))),life:1.6,max:1.6,size:Rt*(.25+Math.random()*.4),col:[255,170+Math.random()*60|0,90]});trial.fx.push({pos:t.pos,vel:t.vel,life:.5,max:.5,size:Rt*4,col:[255,245,220]});}};
 const segHit=(t,a0,a1)=>{const seg=tv.sub(a1,a0),l2=tv.dot(seg,seg)||1,k=C.clamp(tv.dot(tv.sub(t.pos,a0),seg)/l2,0,1),q=tv.add(a0,seg,k);return tv.len(tv.sub(q,t.pos))<Rt?q:null;};
 for(const b of trial.bolts){b.prev=b.pos;b.pos=tv.add(b.pos,b.vel,dt);b.life-=dt;
  for(const t of trial.targets){if(!t.alive||b.life<=0)continue;const q=segHit(t,b.prev,b.pos);if(q){b.life=0;hitTarget(t,q,b.weight);}}}
 for(const m of trial.missiles)for(const t of trial.targets){if(!t.alive||m.life<=0)continue;const q=segHit(t,m.prev,m.pos);if(q){m.life=0;hitTarget(t,q,m.weight);for(let k=0;k<10;k++)trial.fx.push({pos:q,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),60+Math.random()*200)),life:.8,max:.8,size:Rt*.3,col:[255,150,70]});}}
 trial.bolts=trial.bolts.filter(b=>b.life>0);trial.missiles=trial.missiles.filter(m=>{if(m.life<=0&&!m.burst){m.burst=true;}return m.life>0;});
 for(const t of trial.targets){if(t.alive){t.pos=tv.add(t.pos,t.vel,dt);t.spin+=dt*.3;const up=tv.norm(t.pos);t.rot=trialAxisMatrix(up,t.spin,t.rot);t.rot=trialFrame(trialApply(t.rot,[1,0,0]),up);}else if((t.respawn-=dt)<=0)Object.assign(t,trialSpawnTarget(t.id,false));}
 for(const e of trial.fx){e.pos=tv.add(e.pos,e.vel,dt);e.life-=dt;}trial.fx=trial.fx.filter(e=>e.life>0);if(trial.fx.length>3000)trial.fx.splice(0,trial.fx.length-3000);
 const due=performance.now();if(!trial.rays.busy&&due-trial.rays.last>140&&trial.turrets.length)trialRays(due);
}
// Missiles leave their tubes along the mounting axis, then home on the locked
// target with a limited turn rate; without a lock they fly down the reticle.
const TRIAL_MSL={launch:220,speed:2600,accel:650,turn:40*Math.PI/180,life:30,ripple:.14};
function trialMissiles(dt,lock){
 const R=trial.R,center=trial.asset.geometry.center;
 if(trial.mslOrder){trial.mslOrder=false;let n=0;for(const l of trial.launchers)if(l.reload<=0){l.queue=l.salvo;l.reload=l.cycle;n++;}if(!n&&trial.launchers.length)toast('ミサイルは装填中です');}
 for(const l of trial.launchers){l.reload=Math.max(0,l.reload-dt);if(l.queue>0&&(l.next-=dt)<=0){l.queue--;l.next=TRIAL_MSL.ripple;
  const ax=trialApply(R,l.axis),pos=tv.add(trial.P,trialApply(R,tv.sub(l.origin,center))),jit=tv.norm(tv.add(ax,tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),.12));
  trial.missiles.push({pos,prev:pos,base:[...trial.V],h:jit,s:TRIAL_MSL.launch,life:TRIAL_MSL.life,target:lock||null,dir:trial.aim?trial.aim.dir:ax,weight:1,trail:0,boost:.6});
  trial.fx.push({pos,vel:trial.V,life:.25,max:.25,size:14,col:[255,210,150]});trial.gun.missiles=(trial.gun.missiles||0)+1;}}
 for(const m of trial.missiles){
  m.prev=m.pos;m.boost-=dt;
  let want=m.dir;if(m.target&&m.target.alive&&m.boost<=0){const t=m.target,rel=tv.sub(t.pos,m.pos),vrel=tv.sub(t.vel,m.base),tgo=tv.len(rel)/Math.max(300,m.s);want=tv.norm(tv.add(rel,vrel,tgo));}
  if(m.boost<=0){const c=C.clamp(tv.dot(m.h,want),-1,1),ang=Math.acos(c),maxA=TRIAL_MSL.turn*dt;if(ang>1e-5){const ax=tv.cross(m.h,want),l=tv.len(ax);if(l>1e-9)m.h=tv.norm(trialRot(m.h,tv.scale(ax,1/l),Math.min(ang,maxA)));}}
  m.s=Math.min(TRIAL_MSL.speed,m.s+TRIAL_MSL.accel*dt);m.pos=tv.add(m.pos,tv.add(m.base,m.h,m.s),dt);m.life-=dt;
  if((m.trail-=dt)<=0){m.trail=.05;trial.fx.push({pos:m.pos,vel:m.base,life:.9,max:.9,size:9,col:[150,160,175]});}
 }
 trial.missiles=trial.missiles.filter(m=>m.life>0);
}
// The engine tests each barrel direction against the hull, structures and
// other fittings; firing waits for a clear answer for the current direction.
function trialRays(now){
 const ts=trial.turrets,ids=new Int32Array(ts.length),dirs=new Float32Array(ts.length*3),sent=ts.map(t=>trialBarrel(t,t.yaw,t.el));
 ts.forEach((t,i)=>{ids[i]=t.id;dirs.set(sent[i],i*3);});trial.rays.busy=true;trial.rays.last=now;const asset=trial.asset;
 YardEngineClient.request('trialRays',{ids:Array.from(ids),dirs:Array.from(dirs)}).then(r=>{if(trial.asset!==asset)return;const c=r.clear||[];ts.forEach((t,i)=>{t.clear=!!c[i];t.clearDir=sent[i];});}).catch(()=>{}).finally(()=>{trial.rays.busy=false;});
}
function trialRenderSets(){
 const b=trial.bolts,P=trial.P,K=7,pos=new Float32Array(b.length*K*3),col=new Uint8Array(b.length*K*4),size=new Float32Array(b.length*K);
 b.forEach((q,i)=>{const d=tv.norm(q.vel);for(let k=0;k<K;k++){const j=i*K+k,s=k/(K-1),p=tv.add(tv.sub(q.pos,P),d,-q.len*s);pos.set(p,j*3);col.set([q.col[0],q.col[1],q.col[2],Math.round(235*(1-s*.7))],j*4);size[j]=q.size*(1-s*.55);}});
 view.setPoints('trialBolts',pos,col,size);
 const f=trial.fx,ms0=trial.missiles,nf=f.length+ms0.length*2,fp=new Float32Array(nf*3),fc=new Uint8Array(nf*4),fs=new Float32Array(nf);
 f.forEach((e,i)=>{const k=e.life/e.max;fp.set(tv.sub(e.pos,P),i*3);fc.set([e.col[0],e.col[1],e.col[2],Math.round(255*Math.min(1,k*1.4)*(e.col[0]===150?.45:1))],i*4);fs[i]=e.size*(e.max>1?1.4-k*.6:e.col[0]===150?1.6-k*.8:1);});
 ms0.forEach((m,j)=>{const i=f.length+j*2;fp.set(tv.sub(m.pos,P),i*3);fc.set([255,235,190,255],i*4);fs[i]=7;fp.set(tv.add(tv.sub(m.pos,P),m.h,-14),i*3+3);fc.set([255,140,60,220],i*4+4);fs[i+1]=12;});
 view.setPoints('trialFx',fp,fc,fs);
 const ts=trial.turrets,R=trial.R,c=trial.asset.geometry.center,mp=new Float32Array(ts.length*3),mc=new Uint8Array(ts.length*4),ms=new Float32Array(ts.length);
 ts.forEach((t,i)=>{const p=trialApply(R,tv.sub(tv.add(t.pivot,t.axis,t.hm+Math.max(3,t.r*.6)),c));mp.set(p,i*3);mc.set(t.ready?(t.reload>0?[255,196,80,170]:[90,255,140,190]):t.arc&&t.clearDir&&!t.clear?[255,80,70,170]:t.arc?[255,196,80,150]:[255,80,70,120],i*4);ms[i]=Math.max(1.5,t.r*.3);});
 view.setPoints('trialMarks',mp,mc,ms);
}
function trialCamera(dt){
 const a=trialAttitude();let F;
 if(trial.camMode==='ship')F=trial.R;
 else{let fh=tv.add(a.f,a.up,-tv.dot(a.f,a.up));if(tv.len(fh)<.25&&trial.camF){const old=trialCol(trial.camF,0);fh=tv.add(old,a.up,-tv.dot(old,a.up));}F=trialFrame(fh,a.up);}
 if(!trial.camF)trial.camF=[...F];else{const k=1-Math.exp(-dt*4),x=tv.add(trialCol(trial.camF,0),tv.add(trialCol(F,0),trialCol(trial.camF,0),-1),k),y=tv.add(trialCol(trial.camF,1),tv.add(trialCol(F,1),trialCol(trial.camF,1),-1),k);trial.camF=trialFrame(x,y);}
 const c=view.cam;c.frame=trial.camF;c.ortho=false;c.r=trialCamRange(c.r);c.ph=C.clamp(c.ph,.12,2.9);c.far=Math.max(90000,trial.p.len*30);const up=trialCol(trial.camF,1);c.target=tv.scale(up,c.r*TRIAL_CAM_LIFT);
}
function trialLoop(now){
 const dt=trial.last?Math.min(.05,(now-trial.last)/1000):0;trial.last=now;
 trialCamera(dt||.016);
 if(dt>0){const n=dt>.025?2:1;for(let i=0;i<n;i++)trialStep(dt/n);}
 const d=trial.dust;view.setPoints('trialDust',d.pos,d.col,d.size);trialRenderSets();
 const geo=trial.asset.geometry,unit={key:trial.asset.key,pos:[0,0,0],yaw:0,rot:trial.R,glow:.3+.7*Math.min(1,Math.max(Math.abs(TRIAL_TELEGRAPH[trial.tele][1]),trial.thrust)),hatchOpen:0,dead:false,
  turrets:trial.turrets.filter(t=>t.mesh).map(t=>({mesh:t.mesh,pivot:t.pivot,rot:t.rot})),targets:trial.targets.filter(t=>t.alive).map(t=>({pos:tv.sub(t.pos,trial.P),rot:t.rot}))};
 if(view.draw({fleet:[unit],mode:'trial',planet:{center:tv.scale(trial.P,-1),radius:TRIAL_PLANET.radius,sun:TRIAL_PLANET.sun}})!==false){renderHealth.frames++;renderHealth.lastFrame=now;renderHealth.failures=0;}
 trialMarkers();
 if(now-trial.hud>120){trial.hud=now;trialHudUpdate();}
}
// Brackets over the target buoys, as in a naval HUD; off-screen ones are hidden.
function trialMarkers(){
 const hud=$('#trialHud');if(!hud||!view)return;const rect=view.canvas.getBoundingClientRect(),hr=hud.getBoundingClientRect();
 for(const t of trial.targets){const el=hud.querySelector(`[data-tmark="${t.id}"]`);if(!el)continue;const rel=tv.sub(t.pos,trial.P),q=t.alive?view.project(rel):null,vis=q&&q[2]>-1&&q[2]<1&&q[0]>rect.left&&q[0]<rect.right&&q[1]>rect.top&&q[1]<rect.bottom;el.hidden=!vis;if(!vis)continue;
  el.style.transform=`translate(${(q[0]-hr.left).toFixed(1)}px,${(q[1]-hr.top).toFixed(1)}px)`;const lab=`標的 ${(tv.len(tv.sub(rel,view.eye()))/1000).toFixed(1)} km${t.hits?' · '+Math.round(t.hits/TRIAL_GUN.hitsToKill*100)+'%':''}`,b=el.querySelector('b');if(b.textContent!==lab)b.textContent=lab;el.classList.toggle('lock',trial.aim?.lock===t);}

}
// ---- HUD ----
function trialHudHTML(){
 return `<div class="th-top"><div class="th-card th-id"><span>公試 · コルサント低軌道</span><b>${esc(ship?.name||'設計艦')}</b><small data-th="clock">T+0:00</small></div>
 <dl class="th-card th-read"><div><dt>速力</dt><dd data-th="speed">0</dd></div><div><dt>方位</dt><dd data-th="head">090°</dd></div><div><dt>高度</dt><dd data-th="alt">160 km</dd></div><div><dt>仰角</dt><dd data-th="pitch">0.0°</dd></div><div><dt>傾斜</dt><dd data-th="bank">0.0°</dd></div></dl>
 <div class="th-actions"><button type="button" class="th-btn" data-trial-cmd="cam" data-th="cam">視点 水平</button><button type="button" class="th-btn" data-trial-cmd="level">水平復帰</button><button type="button" class="th-btn" data-trial-cmd="center">舵中央</button><button type="button" class="th-btn" data-trial-cmd="reset">再開始</button><button type="button" class="th-btn th-exit" data-trial-cmd="exit">公試終了</button></div></div>
 <p class="th-records" data-th="records"></p><p class="th-warn" data-th="warn" hidden></p>
 <div class="th-reticle" aria-hidden="true"><i class="h"></i><i class="v"></i><b data-th="range">20.0 km</b></div>
 <div class="th-guns" data-th="guns" aria-live="off"></div><div class="th-tmarks" aria-hidden="true">${Array.from({length:TRIAL_GUN.targets},(_,i)=>`<div class="th-tmark" data-tmark="${i}" hidden><i></i><b></b></div>`).join('')}</div>
 <div class="th-card th-pad"><div class="th-tele-ladder" aria-label="速力通信機">${TRIAL_TELEGRAPH.map((t,i)=>`<span data-tele="${i}">${t[0]}</span>`).reverse().join('')}</div><div class="th-tele-bar" aria-hidden="true"><i data-th="speedbar"></i></div>
  <div class="th-dpad"><button type="button" class="th-arrow up" data-trial-cmd="tele+" aria-label="増速">▲</button><button type="button" class="th-arrow left" data-trial-cmd="rudder-" aria-label="取舵">◀</button><b class="th-dmid" data-th="tele">停止</b><button type="button" class="th-arrow right" data-trial-cmd="rudder+" aria-label="面舵">▶</button><button type="button" class="th-arrow down" data-trial-cmd="tele-" aria-label="減速">▼</button></div>
  <div class="th-rudder"><div class="th-gauge" data-th-row="rudder" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><i class="ord"></i><i class="act"></i></div><b class="th-order" data-th="rudder">舵中央</b></div></div>
 <div class="th-stick" data-th-stick role="slider" aria-label="ピッチとロール" aria-valuetext="中立"><span class="lab up">上げ</span><span class="lab down">下げ</span><span class="lab left">左</span><span class="lab right">右</span><i class="knob"></i></div>
 <button type="button" class="th-fire" data-th-fire aria-label="射撃">射撃<small>Space</small></button>
 <button type="button" class="th-msl" data-trial-cmd="missile" data-th="msl" aria-label="ミサイル発射" ${trial.launchers.length?'':'disabled'}>ミサイル<small data-th="mslstate">${trial.launchers.length?trial.launchers.length*8+' 発':'発射管なし'}</small></button>
 <i class="th-lead" data-th="lead" hidden aria-hidden="true"></i>
 <p class="th-keys">W/S 速力 · A/D 舵 · R/F 上げ下げ · Q/E ロール · Space 射撃 · M ミサイル · Z 水平復帰 · X 舵中央 · V 視点 · ドラッグで照準 · ホイールで距離</p>`;
}
function trialBindHud(hud){
 const stick=hud.querySelector('[data-th-stick]'),knob=stick?.querySelector('.knob'),fire=hud.querySelector('[data-th-fire]');
 let sid=null;const move=e=>{const r=stick.getBoundingClientRect(),R=r.width/2,dx=(e.clientX-r.left-R)/R,dy=(e.clientY-r.top-R)/R,l=Math.hypot(dx,dy),k=l>1?1/l:1;trial.stick={x:dx*k,y:-dy*k};knob.style.transform=`translate(${(dx*k*R*.62).toFixed(1)}px,${(dy*k*R*.62).toFixed(1)}px)`;};
 const end=()=>{sid=null;trial.stick={x:0,y:0};knob.style.transform='';stick.classList.remove('on');};
 stick?.addEventListener('pointerdown',e=>{e.preventDefault();sid=e.pointerId;stick.setPointerCapture(e.pointerId);stick.classList.add('on');move(e);});
 stick?.addEventListener('pointermove',e=>{if(e.pointerId===sid)move(e);});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])stick?.addEventListener(ev,e=>{if(e.pointerId===sid)end();});
 fire?.addEventListener('pointerdown',e=>{e.preventDefault();fire.setPointerCapture(e.pointerId);trial.fire=true;fire.classList.add('on');});
 for(const ev of ['pointerup','pointercancel','lostpointercapture'])fire?.addEventListener(ev,()=>{trial.fire=false;fire.classList.remove('on');});
 fire?.addEventListener('contextmenu',e=>e.preventDefault());
}
function trialHudUpdate(full){
 const hud=$('#trialHud');if(!hud||!trial.on&&!full)return;const a=trialAttitude(),q=k=>hud.querySelector(`[data-th="${k}"]`),set=(k,v)=>{const e=q(k);if(e&&e.textContent!==v)e.textContent=v;};
 const v=trial.vf,p=trial.p,max=trialMaxRates(),deg=x=>x*180/Math.PI;
 set('speed',`${num(Math.round(v))} m/s`);set('head',String(Math.round(a.heading)%360).padStart(3,'0')+'°');set('alt',`${(a.alt/1000).toFixed(1)} km`);
 set('pitch',`${deg(a.pitch)>=0?'+':''}${deg(a.pitch).toFixed(1)}°`);const b=deg(a.bank);set('bank',Math.abs(b)<.05?'0.0°':`${b>0?'右':'左'} ${Math.abs(b).toFixed(1)}°`);
 const s=Math.floor(trial.t);set('clock',`T+${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`);set('cam',trial.camMode==='ship'?'視点 追従':'視点 水平');
 const r=trial.rec,g=trial.gun;set('records',`公試記録　最高速力 ${num(Math.round(r.top))} m/s · 0→全速 ${r.accel==null?(r.run?'計測中…':'—'):Math.round(r.accel)+' 秒'} · 全舵旋回径 ${r.turn==null?'—':(r.turn/1000).toFixed(1)+' km'} · 射撃 ${num(g.shots)} 発${g.missiles?` · ミサイル ${num(g.missiles)} 発`:''} / 命中 ${num(Math.round(g.hits))} / 撃破 ${g.kills}`);
 const w=q('warn');if(w){w.hidden=!trial.warn&&!trial.level;const txt=trial.warn||(trial.level?'姿勢を水平に戻しています…':'');if(w.textContent!==txt)w.textContent=txt;}
 const bar=q('speedbar');if(bar){const lo=-.25,frac=C.clamp((v/Math.max(1,p.maxSpeed)-lo)/(1-lo),0,1);bar.style.height=(frac*100).toFixed(1)+'%';}
 hud.querySelectorAll('[data-tele]').forEach(e=>e.classList.toggle('on',+e.dataset.tele===trial.tele));set('tele',TRIAL_TELEGRAPH[trial.tele][0]);
 const row=hud.querySelector('[data-th-row="rudder"]');if(row){row.querySelector('.ord').style.left=((trial.rudder+2)/4*100)+'%';row.querySelector('.act').style.left=(C.clamp(trial.w[1]/(max[1]||1),-1,1)*50+50).toFixed(1)+'%';}set('rudder',TRIAL_RUDDER[trial.rudder+2]);
 const aim=trial.aim;set('range',aim?(aim.lock?'標的 ':'')+(aim.dist/1000).toFixed(1)+' km':'—');hud.querySelector('.th-reticle')?.classList.toggle('lock',!!aim?.lock);
 const ts=trial.turrets,ready=ts.filter(t=>t.ready).length,loaded=ts.filter(t=>t.ready&&t.reload<=0).length,blocked=ts.filter(t=>t.arc&&t.clearDir&&!t.clear).length,out=ts.filter(t=>!t.arc).length,turning=ts.length-ready-blocked-out;
 const pw=trial.power,cap=pw&&pw.full>0?C.clamp(pw.budget/pw.full,0,1):1,rate=pw?.demand>0?pw.rate:cap,nochg=ts.filter(t=>t.charge<=0).length;
 const gn=q('guns');if(gn){const html=ts.length?`<span class="ok">● 射撃可 ${loaded}</span><span class="wait">● 装填・旋回 ${Math.max(0,ready-loaded+turning-nochg)}</span><span class="ng">● 遮蔽・射界外 ${blocked+out}</span>${nochg?`<span class="ng">● 充電装置なし ${nochg}</span>`:''}<span class="${rate<.999?(rate<.5?'ng':'wait'):'ok'}">⚡ 兵装電力 ${Math.round(rate*100)}%</span>`:'<span class="ng">砲塔なし</span>';if(gn.innerHTML!==html)gn.innerHTML=html;}
 const ml=q('msl');if(ml&&trial.launchers.length){const ready=trial.launchers.filter(l=>l.reload<=0).length,rl=Math.min(...trial.launchers.map(l=>l.reload)),f=1-rl/20;ml.style.setProperty('--fill',(ready?1:f).toFixed(3));set('mslstate',ready?`${ready*8} 発 装填済`:`装填 ${Math.ceil(rl)} 秒`);ml.classList.toggle('ready',ready>0);}
 const ld=q('lead');if(ld){const p=trial.lead&&view?view.project(trial.lead):null,hr=hud.getBoundingClientRect(),ok=p&&p[2]>-1&&p[2]<1;ld.hidden=!ok;if(ok)ld.style.transform=`translate(${(p[0]-hr.left).toFixed(1)}px,${(p[1]-hr.top).toFixed(1)}px) rotate(45deg)`;}
 const st=hud.querySelector('[data-th-stick]'),si=trialStickInput();if(st){const txt=Math.abs(si.x)<.05&&Math.abs(si.y)<.05?'中立':`${si.y>0?'上げ':'下げ'} ${Math.round(Math.abs(si.y)*100)}% · ${si.x>0?'右':'左'}ロール ${Math.round(Math.abs(si.x)*100)}%`;if(st.getAttribute('aria-valuetext')!==txt)st.setAttribute('aria-valuetext',txt);}
}
function trialCommand(cmd){
 if(!trial.on)return;
 if(cmd==='tele+')trial.tele=Math.min(5,trial.tele+1);else if(cmd==='tele-')trial.tele=Math.max(0,trial.tele-1);
 else if(cmd==='rudder+'||cmd==='rudder-')trial.rudder=C.clamp(trial.rudder+(cmd.endsWith('+')?1:-1),-2,2);
 else if(cmd==='level')trial.level=true;
 else if(cmd==='center'){trial.rudder=0;trial.level=false;}
 else if(cmd==='cam'){trial.camMode=trial.camMode==='ship'?'horizon':'ship';if(view){view.cam.th=Math.PI;view.cam.ph=TRIAL_CAM_PH;}}
 else if(cmd==='reset')trialReset();
 else if(cmd==='fireTap')trial.fireTap=.25;
 else if(cmd==='missile'){if(!trial.launchers.length){toast('ミサイル発射管がありません');return;}trial.mslOrder=true;}
 else if(cmd==='exit'){trialStop();return;}
 trialHudUpdate(true);
}
const TRIAL_KEYS={KeyM:'missile',KeyW:'tele+',ArrowUp:'tele+',KeyS:'tele-',ArrowDown:'tele-',KeyA:'rudder-',ArrowLeft:'rudder-',KeyD:'rudder+',ArrowRight:'rudder+',KeyZ:'level',KeyX:'center',KeyV:'cam',Escape:'exit'};
const TRIAL_HOLD={KeyR:['y',1],KeyF:['y',-1],KeyQ:['x',-1],KeyE:['x',1]};
function trialKeyStick(){const s={x:0,y:0};for(const k of trial.keys){const h=TRIAL_HOLD[k];if(h)s[h[0]]+=h[1];}trial.keyStick={x:C.clamp(s.x,-1,1),y:C.clamp(s.y,-1,1)};}
function bindTrial(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-trial],[data-trial-cmd]');if(!b||b.disabled)return;if(b.dataset.trial==='start'){e.preventDefault();trialStart();return;}if(b.dataset.trialCmd){e.preventDefault();trialCommand(b.dataset.trialCmd);}});
 window.addEventListener('keydown',e=>{if(!trial.on||e.ctrlKey||e.metaKey||e.altKey)return;
  if(TRIAL_HOLD[e.code]){e.preventDefault();e.stopImmediatePropagation();trial.keys.add(e.code);trialKeyStick();return;}
  if(e.code==='Space'){e.preventDefault();e.stopImmediatePropagation();trial.fireKey=true;return;}
  const cmd=TRIAL_KEYS[e.code];if(!cmd)return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)trialCommand(cmd);},true);
 window.addEventListener('keyup',e=>{if(!trial.on)return;if(TRIAL_HOLD[e.code]){trial.keys.delete(e.code);trialKeyStick();}if(e.code==='Space')trial.fireKey=false;},true);
 window.addEventListener('blur',()=>{trial.keys.clear();trialKeyStick();trial.fire=trial.fireKey=false;});
 document.addEventListener('visibilitychange',()=>{trial.last=0;});
}
function updateAviationUI(){
 if(!ship||fleet.mode!=='design'||!['launch','mod'].includes(st.tab))return;
 const a=aviationNumbers(),summary=$('#aviationSummary');if(summary)summary.innerHTML=aviationCapacityHTML(a);
 const byId=new Map(a.wings.map(w=>[w.id,w]));
 for(const node of document.querySelectorAll('[data-airwing-status]')){const w=byId.get(node.dataset.airwingStatus);if(w)node.innerHTML=aviationWingStatusHTML(w);}
 for(const node of document.querySelectorAll('[data-airwing-title]')){const w=byId.get(node.dataset.airwingTitle);if(w)node.textContent=w.name;}
 for(const node of document.querySelectorAll('[data-airwing-summary]')){const w=byId.get(node.dataset.airwingSummary);if(w)node.textContent=`サイズ ${aviationSize(w.size)} × ${num(w.count)} 機`;}
 for(const node of document.querySelectorAll('[data-aviation-capacity]')){const p=ship.parts.find(p=>p.id===+node.dataset.aviationCapacity);if(p)node.textContent=aviationSize(C.hangarCapacity(p))+' サイズ';}
}
function editAirWingInput(t,finish=false){
 const id=t.dataset.airwing,k=t.dataset.wingfield,row=ship.airWings?.find(w=>w.id===id);if(!row||!['name','size','count'].includes(k))return;
 const value=k==='name'?t.value:Number(t.value);if(k!=='name'&&(t.value===''||!Number.isFinite(value))){if(finish){if(dragSnap)endDrag();t.value=String(row[k]);updateAviationUI();}return;}
 const rows=C.normalizeAirWings(ship.airWings.map(w=>w.id===id?{...w,[k]:value}:w));
 if(JSON.stringify(rows)!==JSON.stringify(ship.airWings)){beginDrag('航空隊を編集');ship.airWings=rows;touch('none');scheduleStats(180);}
 if(finish){if(dragSnap)endDrag();t.value=String(ship.airWings.find(w=>w.id===id)?.[k]??'');}
 updateAviationUI();
}
function bindAviation(){
 const panel=$('#panel');
 panel.addEventListener('toggle',e=>{const id=e.target.dataset?.airwingCard;if(!id)return;st.aviationExpanded||=new Set();if(e.target.open)st.aviationExpanded.add(id);else st.aviationExpanded.delete(id);},true);
 panel.addEventListener('input',e=>{if(e.target.dataset.airwing)editAirWingInput(e.target);});
 panel.addEventListener('change',e=>{const t=e.target;
  if(t.dataset.airwing){editAirWingInput(t,true);return;}
  if('airrole'in t.dataset&&Object.hasOwn(C.AVIATION_ROLES,t.value)){mutate('航空区画の用途',()=>editSel(p=>{if(p.k==='hangar')p.airRole=t.value;}),'parts');renderPanel();return;}
  if(t.dataset.aviationDoor){const p=ship.parts.find(p=>p.id===+t.dataset.aviationBay);if(!p)return;const face=t.dataset.aviationDoor;mutate('スライド扉の有無',()=>{const targets=[{p,face}];const twin=st.mirror&&p.tw?ship.parts.find(q=>q.id===p.tw):null;if(twin)targets.push({p:twin,face:face==='port'?'stbd':face==='stbd'?'port':face});for(const q of targets){const h=ship.hatches.find(h=>h.bay===q.p.id&&h.face===q.face);if(h){h.motion=t.checked?'slide':'fixed';h.open=t.checked?0:1;}}},'all');renderPanel();return;}
  if(t.dataset.aviationSurface){const p=ship.parts.find(p=>p.id===+t.dataset.aviationBay),face=t.dataset.aviationSurface,mode=t.value;if(!p||!['none','open','ray'].includes(mode))return;const contact=C.aviationSurfaceContacts(ship,p).find(q=>q.face===face);if(!contact?.contact){toast('この面は船体・外装の表面に接触していません');return;}mutate('航空区画の開口方式',()=>{C.setAviationSurfaceMode(ship,p,face,mode);const twin=st.mirror&&p.tw?ship.parts.find(q=>q.id===p.tw):null;if(twin)C.setAviationSurfaceMode(ship,twin,face==='port'?'stbd':face==='stbd'?'port':face,mode);},'all');renderPanel();}
 });
 panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if('addairwing'in d){if((ship.airWings?.length||0)>=C.AIR_WING_LIMITS.rows)return;if(dragSnap)endDrag();const ids=new Set((ship.airWings||[]).map(w=>w.id));let n=1;while(ids.has('wing-'+n))n++;const id='wing-'+n;mutate('航空隊を追加',()=>ship.airWings=C.normalizeAirWings([...(ship.airWings||[]),{id,name:'航空隊 '+n,size:1,count:0}]),'none');st.aviationExpanded||=new Set();st.aviationExpanded.add(id);renderPanel();return;}
  if(d.fillairwing){const row=ship.airWings?.find(w=>w.id===d.fillairwing);if(!row)return;if(dragSnap)endDrag();const a=aviationNumbers(),other=(ship.airWings||[]).reduce((n,w)=>n+(w.id===row.id?0:w.size*w.count),0);mutate('空き容量まで搭載',()=>{row.count=Math.min(C.AIR_WING_LIMITS.maxCount,Math.max(0,Math.floor((a.capacity-other+1e-6)/row.size)));},'none');renderPanel();return;}
  if(d.delairwing){if(dragSnap)endDrag();mutate('航空隊を削除',()=>ship.airWings=(ship.airWings||[]).filter(w=>w.id!==d.delairwing),'none');st.aviationExpanded?.delete(d.delairwing);renderPanel();return;}
  if(d.moveairwing){const i=ship.airWings?.findIndex(w=>w.id===d.moveairwing),direction=Number(d.direction),j=i+direction;if(i<0||![1,-1].includes(direction)||j<0||j>=ship.airWings.length)return;if(dragSnap)endDrag();mutate('航空隊の収容優先順',()=>{const row=ship.airWings.splice(i,1)[0];ship.airWings.splice(j,0,row);},'none');renderPanel();return;}
  if('editaviation'in d){st.tab='launch';hideInspect();renderPanel();}
 });
}

// Tactical positions stay in metres. Icons, labels and touch targets stay in
// screen pixels, so even a 19 km ship remains selectable at fleet distances.
const fleetMap={center:[0,0],metresPerPixel:500,width:900,height:600,cursor:null,pointers:new Map(),drag:null,pinch:null,canvas:null,context:null};
function fleetMapSize(){const canvas=$('#fleetMap'),r=canvas?.getBoundingClientRect?.();fleetMap.width=Math.max(1,r?.width||canvas?.clientWidth||900);fleetMap.height=Math.max(1,r?.height||canvas?.clientHeight||600);return {width:fleetMap.width,height:fleetMap.height,left:r?.left||0,top:r?.top||0};}
function fleetMapProject(p){return [fleetMap.width/2+(p[0]-fleetMap.center[0])/fleetMap.metresPerPixel,fleetMap.height/2-(p[2]-fleetMap.center[1])/fleetMap.metresPerPixel];}
function fleetMapWorld(x,y,altitude=fleet.altitude){return [fleetMap.center[0]+(x-fleetMap.width/2)*fleetMap.metresPerPixel,altitude,fleetMap.center[1]-(y-fleetMap.height/2)*fleetMap.metresPerPixel];}
function fleetMapClamp(){const limit=C.FLEET_RULES.maxCoordinate;fleetMap.center=fleetMap.center.map(n=>C.clamp(n,-limit,limit));fleetMap.metresPerPixel=C.clamp(fleetMap.metresPerPixel,10,10000);}
function fleetMapZoom(factor,x=fleetMap.width/2,y=fleetMap.height/2){if(!Number.isFinite(factor)||factor<=0)return;const before=fleetMapWorld(x,y,0);fleetMap.metresPerPixel=C.clamp(fleetMap.metresPerPixel*factor,10,10000);const after=fleetMapWorld(x,y,0);fleetMap.center[0]+=before[0]-after[0];fleetMap.center[1]+=before[2]-after[2];fleetMapClamp();requestDraw();}
function fleetMapFit(){const us=fleetDisplay().filter(u=>!u.dead);fleetMapSize();if(!us.length){fleetMap.center=[0,0];fleetMap.metresPerPixel=500;requestDraw();return;}const lo=[Infinity,Infinity],hi=[-Infinity,-Infinity];for(const u of us){const r=Math.max(4000,u.p.len/2);for(const [j,k] of [[0,0],[1,2]]){lo[j]=Math.min(lo[j],u.pos[k]-r);hi[j]=Math.max(hi[j],u.pos[k]+r);}}fleetMap.center=lo.map((v,i)=>(v+hi[i])/2);fleetMap.metresPerPixel=Math.max(60,(hi[0]-lo[0]+30000)/Math.max(120,fleetMap.width-120),(hi[1]-lo[1]+25000)/Math.max(100,fleetMap.height-210));fleetMapClamp();requestDraw();}
function fleetMapFocus(){const u=fleetSelected();if(!u)return;fleetMap.center=[u.pos[0],u.pos[2]];fleetMap.metresPerPixel=Math.max(100,C.FLEET_RULES.range*1.2/Math.max(240,Math.min(fleetMap.width,fleetMap.height)));fleetMapClamp();requestDraw();}
function fleetMapPick(x,y){let best=null,distance=27;for(const u of fleetDisplay().filter(u=>!u.dead)){const p=fleetMapProject(u.pos),d=Math.hypot(x-p[0],y-p[1]);if(d<distance){best=u;distance=d;}}return best;}
function fleetMapTap(x,y){const hit=fleetMapPick(x,y),u=fleetSelected();if(hit){if(hit.team===1&&u?.team===0&&!u.dead&&fleetEditable()&&fleet.battle.combat&&fleet.command==='attack'){fleetSetOrder({type:'attack',target:hit.id,fire:true});return;}fleet.selected=hit.id;fleet.command='select';fleetRender();return;}if(!u||u.dead||u.team!==0||!fleetEditable())return;if(fleet.command==='attack'){toast('攻撃する敵艦の記号を選んでください');return;}fleetSetOrder({type:'move',point:fleetMapWorld(x,y)});}
function fleetMapTarget(u,us=fleetDisplay()){if(!u)return null;return us.find(t=>t.id===u.order.target&&!t.dead)||us.filter(t=>t.team!==u.team&&!t.dead).sort((a,b)=>C.len(C.sub(a.pos,u.pos))-C.len(C.sub(b.pos,u.pos)))[0]||null;}
function fleetHatchText(u){if(!(u?.p.slidingHatches>0))return '';const open=u.hatchOpen||0;if(open<=.001)return 'ハッチ閉鎖';if(open>=.999)return u.hatchTarget?'ハッチ全開・発艦中':'ハッチ全開・発艦完了';return `ハッチ${u.hatchTarget?'開放':'閉鎖'}中 ${Math.round(open*100)}%`;}
function fleetMapToolsHTML(){const u=fleetSelected(),editable=!!(u&&!u.dead&&u.team===0&&fleetEditable()),b=fleet.battle,t=fleetMapTarget(u),d=t?C.len(C.sub(t.pos,u.pos)):null;return `<div class="fleet-map-readout"><span class="fleet-map-key"><i></i>友軍 <i class="enemy"></i>敵軍</span><b>${u?esc(u.name):'艦の記号を選択'}</b><small>${u?(u.dead?'撃沈':`${u.team?'敵艦':'友軍'} · 船体 ${fPct(u.hp/u.p.hp)}${t?' · '+(u.order.target===t.id?'目標':'最寄敵')+' '+(d/1000).toFixed(1)+' km':''}${u.p.slidingHatches?' · '+fleetHatchText(u):''}`):'青い艦を選択 → 空白をタップして移動'}</small></div><div class="fleet-map-toolbar"><div class="fleet-map-commands"><button class="chip" data-fleet-action="move" aria-pressed="${fleet.command==='move'}" ${editable?'':'disabled'}>移動</button><button class="chip" data-fleet-action="attack" aria-pressed="${fleet.command==='attack'}" ${editable&&b?.combat?'':'disabled'}>攻撃</button><button class="chip" data-fleet-action="hold" ${editable?'':'disabled'}>停止</button><button class="chip" data-fleet-action="launch" aria-pressed="${u?.order.launch===true}" ${editable&&b?.combat&&u.p.slots>0?'':'disabled'}>${u?.order.launch===true?'発艦中止':'発艦'}</button></div><div class="fleet-map-zoom"><button class="chip" data-fleet-action="zoomOut" aria-label="状況図を縮小">−</button><button class="chip" data-fleet-action="zoomIn" aria-label="状況図を拡大">＋</button></div></div>`;}
function fleetMapRefreshTools(){const el=$('#fleetMapTools');if(el&&fleet.mode==='tactical')el.innerHTML=fleetMapToolsHTML();}
function fleetMapNiceStep(raw){const power=10**Math.floor(Math.log10(Math.max(.001,raw))),v=raw/power;return (v<=1?1:v<=2?2:v<=5?5:10)*power;}
function fleetMapDraw(us){
 const canvas=$('#fleetMap');if(!canvas)return;const fallback=$('#fleetMapFallback');fleetMapSize();let ctx=fleetMap.context;
 if(canvas!==fleetMap.canvas){fleetMap.canvas=canvas;try{ctx=canvas.getContext?.('2d')||null;}catch(e){ctx=null;}fleetMap.context=ctx;}
 if(!ctx){if(fallback)fallback.hidden=false;return;}if(fallback)fallback.hidden=true;
 const W=fleetMap.width,H=fleetMap.height,dpr=Math.min(2,window.devicePixelRatio||1),scale=fleetMap.metresPerPixel;
 if(canvas.width!==Math.round(W*dpr)||canvas.height!==Math.round(H*dpr)){canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);ctx.fillStyle='#08141e';ctx.fillRect(0,0,W,H);ctx.lineWidth=1;ctx.font='10px system-ui,sans-serif';ctx.textBaseline='middle';
 const grid=fleetMapNiceStep(scale*80),left=fleetMapWorld(0,H,0),right=fleetMapWorld(W,0,0);ctx.strokeStyle='#203b4b';ctx.fillStyle='#608092';
 for(let x=Math.ceil(left[0]/grid)*grid;x<=right[0]+grid*.001;x+=grid){const px=fleetMapProject([x,0,0])[0];ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,H);ctx.stroke();if(px>25&&px<W-45)ctx.fillText((x/1000).toFixed(grid<1000?1:0),px+4,Math.min(H-153,104));}
 for(let z=Math.ceil(left[2]/grid)*grid;z<=right[2]+grid*.001;z+=grid){const py=fleetMapProject([0,0,z])[1];ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(W,py);ctx.stroke();if(py>122&&py<H-145)ctx.fillText((z/1000).toFixed(grid<1000?1:0),7,py-7);}
 const selected=us.find(u=>u.id===fleet.selected),target=fleetMapTarget(selected,us);
 const line=(a,b,color,dash=[],width=1)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);ctx.lineWidth=1;};
 const marker=(p,color)=>{ctx.strokeStyle=color;ctx.beginPath();ctx.arc(p[0],p[1],6,0,Math.PI*2);ctx.moveTo(p[0]-10,p[1]);ctx.lineTo(p[0]+10,p[1]);ctx.moveTo(p[0],p[1]-10);ctx.lineTo(p[0],p[1]+10);ctx.stroke();};
 if(selected&&!selected.dead&&fleet.ranges!==false){const p=fleetMapProject(selected.pos),r=C.FLEET_RULES.range/scale;ctx.strokeStyle='#63cde766';ctx.fillStyle='#54c2df07';ctx.setLineDash([5,7]);ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#88d8e5';ctx.fillText('射程 '+C.FLEET_RULES.range/1000+' km',C.clamp(p[0]+r-100,12,W-112),C.clamp(p[1]-10,125,H-155));}
 for(const u of us.filter(u=>!u.dead&&u.team===0)){const p=fleetMapProject(u.pos),o=u.order,dest=o.type==='move'?o.point:o.type==='attack'?us.find(t=>t.id===o.target&&!t.dead)?.pos:null;if(!dest)continue;const q=fleetMapProject(dest),color=o.type==='attack'?'#ffb784':'#63d6ed';line(p,q,color,[7,6],u.id===fleet.selected?1.6:1);if(o.type==='move')marker(q,color);}
 if(selected&&!selected.dead&&target&&!target.dead){const a=fleetMapProject(selected.pos),b=fleetMapProject(target.pos);line(a,b,'#9dafbd70',[2,5]);const p=[(a[0]+b[0])/2,(a[1]+b[1])/2],distance=C.len(C.sub(selected.pos,target.pos)),text=(distance/1000).toFixed(1)+' km'+(distance>C.FLEET_RULES.range?' · 射程外':'');ctx.font='11px system-ui,sans-serif';const width=ctx.measureText(text).width+14;ctx.fillStyle='#102432ee';ctx.fillRect(p[0]-width/2,p[1]-13,width,22);ctx.fillStyle=distance>C.FLEET_RULES.range?'#dfb77b':'#d4e4ee';ctx.textAlign='center';ctx.fillText(text,p[0],p[1]-2);ctx.textAlign='left';}
 if(fleet.command==='move'&&selected&&!selected.dead&&fleetMap.cursor){const a=fleetMapProject(selected.pos),p=fleetMap.cursor;line(a,p,'#8ee5efaa',[3,5]);marker(p,'#8ee5ef');}
 for(const shot of fleet.frame?.shots||[]){const a=us.find(u=>u.id===shot.from),b=us.find(u=>u.id===shot.to);if(!a||!b||a.dead)continue;line(fleetMapProject(a.pos),fleetMapProject(b.pos),shot.ion?'#86bff87d':shot.team?'#ff806757':'#7be6ad70',[],1.5);}
 const labelBoxes=[],shortName=(name,max)=>name.length>max?name.slice(0,max-1)+'…':name;
 for(const u of [...us].sort((a,b)=>(b.id===fleet.selected)-(a.id===fleet.selected))){const p=fleetMapProject(u.pos),chosen=u.id===fleet.selected;if(p[0]<-30||p[0]>W+30||p[1]<-30||p[1]>H+30)continue;const color=u.dead?'#6b747e':u.team?'#ff9c8e':'#77dced';ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(-u.yaw);ctx.fillStyle=u.dead?'#202a33':u.team?'#5a302e':'#173f51';ctx.strokeStyle=color;ctx.lineWidth=chosen?2:1.4;ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-10,-10);ctx.lineTo(-5,0);ctx.lineTo(-10,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  if(u.dead){line([p[0]-10,p[1]-10],[p[0]+10,p[1]+10],color);line([p[0]-10,p[1]+10],[p[0]+10,p[1]-10],color);}else{ctx.strokeStyle=chosen?'#e9faff':color+'77';ctx.setLineDash(u.team?[3,3]:[]);ctx.beginPath();if(u.team){ctx.moveTo(p[0],p[1]-22);ctx.lineTo(p[0]+22,p[1]);ctx.lineTo(p[0],p[1]+22);ctx.lineTo(p[0]-22,p[1]);ctx.closePath();}else ctx.arc(p[0],p[1],chosen?23:19,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);const velocity=u.velocity||[0,0,0],v=fleetMapProject(C.add(u.pos,C.mul(velocity,20)));if(Math.hypot(v[0]-p[0],v[1]-p[1])>12)line(p,v,color+'77',[3,4]);}
  if(!fleet.labels&&!chosen)continue;ctx.font='11px system-ui,sans-serif';const label=shortName(u.name,W<480?12:20),heading=((90-u.yaw*180/Math.PI)%360+360)%360,info=u.dead?'撃沈':`${u.team?'敵':'友'} · ${Math.round(heading)}° · ${Math.round(u.hp/u.p.hp*100)}%`,maxWidth=Math.min(W-24,Math.max(102,ctx.measureText(label).width+16)),candidates=[[p[0]+28,p[1]-22],[p[0]-maxWidth-28,p[1]-22],[p[0]-maxWidth/2,p[1]+27],[p[0]-maxWidth/2,p[1]-69]];
  const fits=(r)=>r[0]>=7&&r[0]+maxWidth<W-7&&r[1]>=110&&r[1]+45<H-139&&!labelBoxes.some(b=>r[0]<b[0]+b[2]+5&&r[0]+maxWidth+5>b[0]&&r[1]<b[1]+b[3]+5&&r[1]+45+5>b[1]);let pos=candidates.find(fits);if(!pos){if(!chosen&&us.length>4)continue;pos=[C.clamp(p[0]-maxWidth/2,7,Math.max(7,W-maxWidth-7)),C.clamp(p[1]+28,108,Math.max(108,H-185))];}labelBoxes.push([...pos,maxWidth,45]);ctx.fillStyle=chosen?'#193442f2':'#0c202ced';ctx.fillRect(pos[0],pos[1],maxWidth,45);ctx.fillStyle=color;ctx.font='11px system-ui,sans-serif';ctx.fillText(label,pos[0]+7,pos[1]+11);ctx.font='10px system-ui,sans-serif';ctx.fillStyle='#a1bac9';ctx.fillText(info,pos[0]+7,pos[1]+26);ctx.fillStyle='#344858';ctx.fillRect(pos[0]+7,pos[1]+37,maxWidth-14,2);ctx.fillStyle=color;ctx.fillRect(pos[0]+7,pos[1]+37,(maxWidth-14)*C.clamp(u.hp/u.p.hp,0,1),2);ctx.fillStyle='#8c9bf1';ctx.fillRect(pos[0]+7,pos[1]+41,(maxWidth-14)*(u.shieldMax?C.clamp(u.shield/u.shieldMax,0,1):0),2);
 }
 const bar=fleetMapNiceStep(scale*Math.min(110,W*.27)),pixels=bar/scale,bottom=Math.max(135,H-146);line([18,bottom],[18+pixels,bottom],'#a3c2d3',[],2);line([18,bottom-4],[18,bottom+4],'#a3c2d3');line([18+pixels,bottom-4],[18+pixels,bottom+4],'#a3c2d3');ctx.font='10px system-ui,sans-serif';ctx.fillStyle='#93b5c8';ctx.fillText((bar/1000).toFixed(bar<1000?1:0)+' km',18,bottom-11);ctx.textAlign='right';ctx.fillText('格子 '+(grid/1000).toFixed(grid<1000?1:0)+' km · Z↑ X→',W-14,bottom-11);ctx.textAlign='left';
}
function bindFleetMap(){const canvas=$('#fleetMap');if(!canvas?.addEventListener)return;const point=e=>{const r=fleetMapSize();return [e.clientX-r.left,e.clientY-r.top];};
 canvas.addEventListener('wheel',e=>{if(fleet.mode!=='tactical')return;e.preventDefault();const p=point(e);fleetMapZoom(Math.exp(C.clamp(e.deltaY,-250,250)*.0016),...p);},{passive:false});
 canvas.addEventListener('pointerdown',e=>{if(fleet.mode!=='tactical'||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();canvas.setPointerCapture?.(e.pointerId);canvas.focus?.({preventScroll:true});const p=point(e);fleetMap.pointers.set(e.pointerId,p);if(fleetMap.pointers.size===1)fleetMap.drag={id:e.pointerId,start:p,last:p,moved:false};else{fleetMap.drag.moved=true;const a=[...fleetMap.pointers.values()];fleetMap.pinch={mid:[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],distance:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])};}});
 canvas.addEventListener('pointermove',e=>{if(fleet.mode!=='tactical')return;const p=point(e);fleetMap.cursor=p;if(!fleetMap.pointers.has(e.pointerId)){if(fleet.command==='move')requestDraw();return;}e.preventDefault();fleetMap.pointers.set(e.pointerId,p);if(fleetMap.pointers.size>1){const a=[...fleetMap.pointers.values()],mid=[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],distance=Math.max(1,Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1])),old=fleetMap.pinch;if(old){fleetMapZoom(Math.max(1,old.distance)/distance,...old.mid);fleetMap.center[0]-=(mid[0]-old.mid[0])*fleetMap.metresPerPixel;fleetMap.center[1]+=(mid[1]-old.mid[1])*fleetMap.metresPerPixel;}fleetMap.pinch={mid,distance};fleetMapClamp();requestDraw();return;}const drag=fleetMap.drag;if(!drag)return;if(Math.hypot(p[0]-drag.start[0],p[1]-drag.start[1])>6)drag.moved=true;if(drag.moved){fleetMap.center[0]-=(p[0]-drag.last[0])*fleetMap.metresPerPixel;fleetMap.center[1]+=(p[1]-drag.last[1])*fleetMap.metresPerPixel;fleetMapClamp();requestDraw();}drag.last=p;});
 const end=(e,cancel=false)=>{if(!fleetMap.pointers.has(e.pointerId))return;const p=point(e),drag=fleetMap.drag,tap=!cancel&&fleetMap.pointers.size===1&&drag&&!drag.moved&&drag.id===e.pointerId;fleetMap.pointers.delete(e.pointerId);if(!fleetMap.pointers.size){fleetMap.drag=null;fleetMap.pinch=null;}else{const [id,last]=[...fleetMap.pointers.entries()][0];fleetMap.drag={id,start:last,last,moved:true};fleetMap.pinch=null;}if(tap&&fleet.mode==='tactical')fleetMapTap(...p);};
 canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('lostpointercapture',e=>end(e,true));canvas.addEventListener('pointerleave',()=>{if(!fleetMap.pointers.size){fleetMap.cursor=null;requestDraw();}});
 canvas.addEventListener('keydown',e=>{if(fleet.mode!=='tactical')return;const moves={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(moves[e.key]){e.preventDefault();fleetMap.center=fleetMap.center.map((n,i)=>n+moves[e.key][i]*fleetMap.metresPerPixel*60);fleetMapClamp();requestDraw();}else if(e.key==='+'||e.key==='='){e.preventDefault();fleetMapZoom(.75);}else if(e.key==='-'){e.preventDefault();fleetMapZoom(1/.75);}else if(e.key==='0'){e.preventDefault();fleetMapFit();}});
}

const fleet={mode:'design',review:[],battle:null,assets:new Map(),saves:[],selected:null,next:1,busy:false,form:'line',gap:800,command:'select',altitude:0,moveX:0,moveZ:0,speed:2,elapsed:0,playing:false,replay:false,frame:null,lastClock:0,labels:true,ranges:true,orbit:false,clean:false,designCamera:null,sceneCamera:{},source:'current',team:0};
const fleetUnits=()=>fleet.mode==='review'?fleet.review:fleet.battle?.units||[];
const fleetDisplay=()=>{const us=fleetUnits();return fleet.frame?us.map(u=>({...u,...fleet.frame.units.find(f=>f.id===u.id)})):us;};
const fleetSelected=()=>fleetDisplay().find(u=>u.id===fleet.selected);
const fleetEditable=()=>fleet.mode==='review'||fleet.battle?.phase==='plan'&&!fleet.replay;
const fleetCanRefit=()=>fleet.mode==='review'||fleet.battle?.phase==='plan'&&fleet.battle.time===0;
function fleetHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(36);}
async function fleetAsset(source){
 let payload=null,key=source;if(source==='current'){const data=C.serialize(ship);key='draft-'+fleetHash(JSON.stringify(data));payload={design:data};}else if(source.startsWith('save:')){const rec=fleet.saves.find(r=>r.id===source.slice(5));if(!rec)throw new Error('保存艦が見つかりません');key=source+'-'+rec.savedAt;if(!fleet.assets.has(key))payload={design:await unpack(rec.data)};}else if(!fleet.assets.has(key))payload={key:source};
 if(fleet.assets.has(key))return fleet.assets.get(key);
 // Stats and meshes for fleet ships are prepared by the engine in the background.
 const r=await YardEngineClient.request('fleet',payload),asset={key,design:r.design,stats:r.stats,p:r.profile,geometry:r.geometry};if(view)view.loadFleet(key,r.geometry);fleet.assets.set(key,asset);return asset;
}
async function fleetAdd(source=fleet.source,team=fleet.team){
 if(fleet.busy||!fleetCanRefit())return;if(fleetUnits().length>=C.FLEET_RULES.maxShips){toast('一度に並べられるのは12隻までです');return;}
 fleet.busy=true;fleetRender();await new Promise(r=>setTimeout(r,25));
 try{const a=await fleetAsset(source),u=C.fleetUnit('fleet-'+fleet.next++,a.key,a.p,fleet.mode==='review'?0:team);fleetUnits().push(u);fleet.selected=u.id;fleetArrange();fleetFit();}catch(e){console.error(e);toast('艦を追加できません：'+esc(e.message));}finally{fleet.busy=false;fleetRender();requestDraw();}
}
async function fleetSetMode(mode){
 if(!['design','tactical','review'].includes(mode)||fleet.busy)return;const prior=fleet.mode;if(prior===mode)return;const token=fleet.modeToken=(fleet.modeToken||0)+1;
 fleet.playing=false;fleet.lastClock=0;fleet.orbit=false;fleet.command='select';fleetMap.pointers.clear();fleetMap.drag=null;fleetMap.pinch=null;fleetMap.cursor=null;hideInspect();clearHover();
 if(view){if(prior==='design')fleet.designCamera={cam:JSON.parse(JSON.stringify(view.cam)),off:[...view.off]};else fleet.sceneCamera[prior]=JSON.parse(JSON.stringify(view.cam));}
 fleet.mode=mode;fleet.frame=null;fleet.replay=false;$('#app').classList.toggle('fleet-active',mode!=='design');$('#app').classList.toggle('review-active',mode==='review');$('#app').classList.toggle('tactical-active',mode==='tactical');$('#app').classList.remove('fleet-clean');fleet.clean=false;$('#fleetHud').hidden=mode==='design';$('#fleetLabels').hidden=mode!=='review';$('#fleetMap').hidden=mode!=='tactical';$('#fleetMapTools').hidden=mode!=='tactical';$('#fleetMapFallback').hidden=true;
 $$('#modeSwitch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
 if(mode==='design'){if(view&&fleet.designCamera){view.cam=fleet.designCamera.cam;view.off=fleet.designCamera.off;}$('#fleetLabels').innerHTML='';renderPanel();renderSpecTargets();syncHud();updateUndo();requestDraw();return;}
 $('#dock').classList.remove('collapsed');$('#btnUndo').disabled=$('#btnRedo').disabled=true;
 if(!fleet.battle)fleet.battle=C.fleetBattle([]);fleet.selected=fleetUnits()[0]?.id||null;
 if(view){view.off=[0,0,0];if(fleet.sceneCamera[mode])view.cam=fleet.sceneCamera[mode];else{view.cam.target=[0,0,0];view.cam.th=.85;view.cam.ph=mode==='tactical'?.0006:1.04;view.cam.ortho=mode==='tactical';}}
 fleetRender();try{fleet.saves=await Store.list();}catch(e){fleet.saves=[];}if(token!==fleet.modeToken)return;
 if(!fleetUnits().length){await fleetAdd('current',0);if(fleetUnits().length){await fleetAdd(mode==='review'?'imperial':'current',mode==='review'?0:1);}fleet.selected=fleetUnits().find(u=>u.team===0)?.id||fleetUnits()[0]?.id||null;}if(mode==='tactical'&&fleet.battle.phase==='execute')fleet.frame=C.fleetSample(fleet.battle.last,fleet.elapsed);fleetRender();fleetFit();
}
function fleetArrange(){
 const units=fleetUnits();if(fleet.mode==='review'){C.fleetFormation(units,fleet.form,fleet.gap);return;}
 const fronts=[0,1].map(team=>Math.max(0,...units.filter(u=>u.team===team).map(u=>u.p.len/2))),distance=Math.max(C.FLEET_RULES.initialDistance,fronts[0]+fronts[1]+90000);
 for(const team of [0,1]){const us=units.filter(u=>u.team===team);C.fleetFormation(us,'line',C.FLEET_RULES.formationGap);for(const u of us){u.pos[0]+=team?distance/2:-distance/2;u.yaw=team?Math.PI:0;}}
}
function fleetFit(){if(fleet.mode==='tactical'){fleetMapFit();return;}if(!view)return;const us=fleetDisplay().filter(u=>!u.dead);if(!us.length)return;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const u of us){const a=fleet.assets.get(u.key),d=a?.stats.dims||[u.p.len,u.p.width||u.p.len*.5,u.p.height||100],r=Math.hypot(d[0],d[1])/2;for(let k=0;k<3;k++){const rr=k===1?d[2]/2:r;lo[k]=Math.min(lo[k],u.pos[k]-rr);hi[k]=Math.max(hi[k],u.pos[k]+rr);}}view.off=[0,0,0];view.cam.target=lo.map((x,i)=>(x+hi[i])/2);const aspect=(view.canvas.clientWidth||900)/(view.canvas.clientHeight||600),size=Math.max(hi[0]-lo[0],hi[2]-lo[2],(hi[1]-lo[1])*2);view.cam.r=Math.max(900,size*.7/Math.tan(view.cam.fov/2)*Math.max(1,1/aspect));requestDraw();}
function fleetFocus(){if(fleet.mode==='tactical'){fleetMapFocus();return;}const u=fleetSelected();if(u&&view){view.cam.target=[...u.pos];view.cam.r=Math.max(700,u.p.len*2.4);requestDraw();}}
function fleetOrderText(u){const o=u.order;if(o.type==='move')return `移動 → ${(o.point[0]/1000).toFixed(1)}, ${(o.point[2]/1000).toFixed(1)} km / 高度 ${(o.point[1]/1000).toFixed(1)} km`;if(o.type==='attack')return '攻撃 → '+(fleetUnits().find(t=>t.id===o.target)?.name||'目標消失');return '停止・位置保持';}
function fleetOptions(){return `<option value="current">現在の設計</option><optgroup label="作例">${Object.entries(C.DESIGNS).map(([k,d])=>`<option value="${k}" ${fleet.source===k?'selected':''}>${esc(d.name)}</option>`).join('')}</optgroup>${fleet.saves.length?`<optgroup label="保存艦">${fleet.saves.map(r=>`<option value="save:${esc(r.id)}" ${fleet.source==='save:'+r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</optgroup>`:''}`;}
function fleetRoster(){return `<div class="fleet-roster">${fleetDisplay().map(u=>`<button type="button" data-fleet-select="${u.id}" class="fleet-unit ${u.team?'enemy':''} ${fleet.selected===u.id?'selected':''} ${u.dead?'destroyed':''}" aria-pressed="${u.id===fleet.selected}"><span class="fleet-side">${fleet.mode==='review'?'◆':u.team?'敵':'友'}</span><span><b>${esc(u.name)}</b><small>${fleet.mode==='review'?fLen(u.p.len)+' / '+u.p.power.toFixed(3)+' ISD':u.dead?'撃沈':fleetOrderText(u)}</small><span class="fleet-bars"><i style="width:${Math.max(0,u.hp/u.p.hp*100)}%"></i></span></span>${fleet.mode!=='review'?`<em>${Math.round(u.hp/u.p.hp*100)}%</em>`:''}</button>`).join('')||'<p class="note">艦を追加してください。</p>'}</div>`;}
function fleetControlsHTML(){
 const review=fleet.mode==='review',b=fleet.battle,u=fleetSelected(),editable=fleetEditable()&&u&&!u.dead&&(review||u.team===0),lock=!fleetCanRefit(),busy=fleet.busy;
 let h=`<div class="fleet-heading"><span>${review?'FLEET REVIEW':'TACTICAL PLOT'}</span><h2>${review?'観閲式':'戦術状況図'}</h2><p>${review?'設計した艦を、同じ縮尺の宇宙に。':'遠距離の艦隊戦を、状況図で指揮する。'}</p></div>`;
 if(!review)h+=`<div class="fleet-phase"><b>${b.phase==='execute'?'実行中':b.phase==='finished'?'演習終了':'命令フェーズ'} · TURN ${b.turn}</b><span>経過 ${fTime(fleet.frame?.time??b.time)}</span></div><div class="fleet-field"><label>演習内容<select data-fleet-setting="combat" ${lock?'disabled':''}><option value="1" ${b.combat?'selected':''}>AI艦隊と戦闘</option><option value="0" ${!b.combat?'selected':''}>航行訓練（射撃なし）</option></select></label><label>1ターン<select data-fleet-setting="seconds" ${b.phase!=='plan'?'disabled':''}>${[5,10,20,30].map(n=>`<option ${b.seconds===n?'selected':''}>${n}</option>`).join('')}</select>秒</label></div>`;
 h+=`<details class="fleet-add" ${lock?'':'open'}><summary>艦隊編成 · ${fleetUnits().length} / 12 隻</summary><label>追加する設計<select id="fleetSource" ${lock||busy?'disabled':''}>${fleetOptions()}</select></label>${!review&&b.combat?`<div class="seg"><button type="button" data-fleet-team="0" aria-pressed="${fleet.team===0}">友軍</button><button type="button" data-fleet-team="1" aria-pressed="${fleet.team===1}">敵軍（AI）</button></div>`:''}<button class="btn" data-fleet-action="add" ${lock||busy?'disabled':''}>${busy?'艦を準備中…':'艦を追加'}</button>${lock?'<p class="note">編成を変えるときは「開始位置に戻す」を押してください。</p>':''}</details>`;
 h+=fleetRoster();
 if(review)h+=`<div class="pgroup"><h4>隊列</h4><div class="chips">${[['line','横列'],['column','縦列'],['wedge','楔形'],['grid','整列']].map(([k,l])=>`<button class="chip" data-fleet-form="${k}" aria-pressed="${fleet.form===k}">${l}</button>`).join('')}</div><label class="fleet-range">艦間隔 <b>${fLen(fleet.gap)}</b><input aria-label="隊列の艦間隔" type="range" min="0" max="5000" step="100" value="${fleet.gap}" data-fleet-setting="gap"></label><p class="note">間隔は最大艦の長さ・幅に加算します。隊列を選び直すと個別配置を整列します。</p></div>`;
 if(!review)h+=`<p class="note fleet-rules">初期距離は120 km以上、主砲射程は150 km。攻撃命令では約75 kmを維持します。速度は設計推力を基に最大2.4 km/sへ換算する演習ルールです。</p>`;
 if(u)h+=`<div class="pgroup fleet-orders"><h4>${esc(u.name)}</h4>${review?`<div class="fleet-coords">${[['0','前後 X',u.pos[0]],['1','上下 Y',u.pos[1]],['2','左右 Z',u.pos[2]],['yaw','方位 °',u.yaw*180/Math.PI]].map(([k,l,v])=>`<label>${l}<input type="number" data-fleet-pos="${k}" value="${Math.round(v)}" step="${k==='yaw'?5:100}" aria-label="${l}"></label>`).join('')}</div><button class="btn sm" data-fleet-action="position">画面上で配置する</button>`:`<p class="note">${u.dead?'この艦は撃沈されています。':u.team?'敵艦の命令はAIが決め、同時に実行します。':esc(fleetOrderText(u))}</p><div class="chips"><button class="chip" data-fleet-action="move" ${editable?'':'disabled'} aria-pressed="${fleet.command==='move'}">移動先を指定</button><button class="chip" data-fleet-action="attack" ${editable&&b.combat?'':'disabled'} aria-pressed="${fleet.command==='attack'}">攻撃目標を指定</button><button class="chip" data-fleet-action="hold" ${editable?'':'disabled'}>停止</button></div><label class="fleet-alt">移動先の高度（m）<input type="number" data-fleet-setting="altitude" value="${fleet.altitude}" min="-15000" max="15000" step="250" ${editable?'':'disabled'}></label><div class="fleet-checks"><label><input type="checkbox" data-fleet-order="fire" ${u.order.fire!==false?'checked':''} ${editable&&b.combat?'':'disabled'}>自動射撃</label><label><input type="checkbox" data-fleet-order="launch" ${u.order.launch!==false?'checked':''} ${editable&&b.combat?'':'disabled'}>航空隊発艦</label></div>${u.p.slidingHatches?`<p class="note">${fleetHatchText(u)}。発艦命令で開き、全開になると発艦します。</p>`:''}<details class="fleet-coordinate-order"><summary>座標で移動を指定</summary><div class="fleet-coords"><label>X（km）<input type="number" data-fleet-setting="moveX" value="${fleet.moveX}" step="1" ${editable?'':'disabled'}></label><label>Z（km）<input type="number" data-fleet-setting="moveZ" value="${fleet.moveZ}" step="1" ${editable?'':'disabled'}></label></div><button class="btn sm" data-fleet-action="moveCoords" ${editable?'':'disabled'}>この座標へ移動</button></details>`}<div class="chips"><button class="chip" data-fleet-action="focus">この艦を見る</button><button class="chip" data-fleet-action="remove" ${lock||busy?'disabled':''}>編成から外す</button></div></div>`;
 if(!review){const result=b.winner===null?'':b.winner===0?'友軍勝利':b.winner===1?'敵軍勝利':'相討ち';h+=`<div class="fleet-execute">${result?`<strong>${result}</strong>`:''}<button class="btn primary" data-fleet-action="execute" ${b.phase==='plan'&&!busy&&!fleet.replay&&fleetUnits().some(u=>u.team===0&&!u.dead)&&(b.combat?fleetUnits().some(u=>u.team===1&&!u.dead):true)?'':'disabled'}>${b.seconds}秒を同時実行</button><div class="chips"><button class="chip" data-fleet-action="pause" ${b.phase==='execute'||fleet.replay?'':'disabled'}>${fleet.playing?'一時停止':'再生'}</button><button class="chip" data-fleet-action="replay" ${b.last&&b.phase!=='execute'?'':'disabled'}>直前ターンを再生</button><label>速度<select data-fleet-setting="speed">${[1,2,4].map(n=>`<option value="${n}" ${fleet.speed===n?'selected':''}>${n}×</option>`).join('')}</select></label></div><progress id="fleetProgress" max="1" value="${b.last?fleet.elapsed/b.last.duration:0}" aria-label="ターン進行"></progress><button class="btn ghost sm" data-fleet-action="reset" ${busy?'disabled':''}>開始位置に戻す</button></div>`;}
 h+=`<div class="pgroup"><h4>表示</h4><div class="chips"><button class="chip" data-fleet-action="fit">艦隊全体</button>${review?'<button class="chip" data-fleet-action="top">真上</button><button class="chip" data-fleet-action="iso">斜め</button>':`<button class="chip" data-fleet-action="ranges" aria-pressed="${fleet.ranges}">射程円</button>`}<button class="chip" data-fleet-action="labels" aria-pressed="${fleet.labels}">艦名表示</button>${review?`<button class="chip" data-fleet-action="orbit" aria-pressed="${fleet.orbit}">自動周回</button><button class="chip" data-fleet-action="clean">鑑賞表示</button><button class="chip" data-fleet-action="saveReview">配置を保存</button><button class="chip" data-fleet-action="loadReview">保存配置を開く</button>`:''}</div></div><p class="note">${review?'ドラッグで回転、ホイール・2本指で拡大縮小。Shift＋ドラッグで平行移動。':'友軍を選択 → 空白をタップして移動、または「攻撃」→ 敵艦を選択 → 同時実行。1本指で図を移動、2本指・ホイール・＋/−で拡大縮小。記号は一定の画面サイズ、位置と射程は実距離です。高度・射界・給電・防御・航空戦を計算します。'}</p>`;return h;
}
function fleetDetailsHTML(){const u=fleetSelected(),s=u&&fleet.assets.get(u.key)?.stats;return `<div class="spec-title"><h3>${fleet.mode==='review'?'観閲艦の諸元':'戦術情報'}</h3></div>${u&&s?`<div class="fleet-readout"><h3>${esc(u.name)}</h3><dl><dt>全長</dt><dd>${fLen(u.p.len)}</dd><dt>主出力</dt><dd>${s.xISD.toFixed(3)} ISD</dd><dt>最大加速度（設計）</dt><dd>${fG(s.accelG)}</dd><dt>航空容量</dt><dd>${(s.aviation?.capacity||0).toFixed(2)} サイズ</dd><dt>搭載</dt><dd>${s.slots} 機</dd><dt>発艦可能</dt><dd>${s.deployableSlots??s.slots} 機</dd><dt>ハイパードライブ</dt><dd>${s.hyperClass==null?'なし':'クラス '+num(s.hyperClass,2)}</dd>${fleet.mode==='tactical'?`<dt>船体</dt><dd>${fPct(u.hp/u.p.hp)}</dd><dt>シールド</dt><dd>${u.shieldMax?fPct(u.shield/u.shieldMax):'なし'}</dd><dt>出撃中</dt><dd>${Math.floor(u.air)} 機</dd><dt>戦術速度</dt><dd>${(C.len(u.velocity||[0,0,0])/1000).toFixed(2)} km/s</dd><dt>方位</dt><dd>${Math.round(((90-u.yaw*180/Math.PI)%360+360)%360)}°</dd><dt>高度</dt><dd>${(u.pos[1]/1000).toFixed(1)} km</dd>${fleetMapTarget(u)?`<dt>最寄り／指定目標距離</dt><dd>${(C.len(C.sub(fleetMapTarget(u).pos,u.pos))/1000).toFixed(1)} km</dd>`:''}${u.p.slidingHatches?`<dt>発艦ハッチ</dt><dd>${fleetHatchText(u)}</dd>`:''}`:''}</dl></div>`:'<p class="note">艦を選択してください。</p>'}${fleet.mode==='tactical'?`<h4>経過記録</h4><ol class="fleet-log">${(fleet.battle?.events||[]).slice(-12).map(e=>`<li><time>${fTime(e.time)}</time>${esc(e.text)}</li>`).join('')||'<li>各艦に命令を設定できます。</li>'}</ol><p class="note">青は友軍、赤は敵軍。射撃と損害は同じ時刻の状態から集計します。実行中の命令変更はできません。次のターンで変更できます。</p>`:'<p class="note">艦体・艦橋・兵装は設計画面と共通の部品構成です。艦ごとの拡大率は変えず、実寸比で表示しています。</p>'}`;}
function fleetRender(){if(fleet.mode==='design')return;$('#panel').innerHTML=fleetControlsHTML();$('#specSide').innerHTML=fleetDetailsHTML();fleetHud();fleetMapRefreshTools();requestDraw();}
function fleetHud(){if(fleet.mode==='design')return;const b=fleet.battle,review=fleet.mode==='review';$('#fleetHud').innerHTML=`<div class="fleet-hud-title"><span>${review?'観閲式 / 実寸比':fleet.replay?'直前ターン再生':b.phase==='plan'?'状況図 / 命令を設定':b.phase==='finished'?'演習終了':fleet.playing?'両軍同時に行動中':'実行を一時停止'}</span><b>${review?fleetUnits().length+' 隻':`TURN ${b.turn} · T+${Math.floor(fleet.frame?.time??b.time)}s`}</b></div><div class="fleet-hud-actions">${review?`<button class="chip" data-fleet-action="clean">${fleet.clean?'操作を表示':'鑑賞表示'}</button>`:`<button class="chip" data-fleet-action="${b.phase==='execute'||fleet.replay?'pause':'execute'}" ${b.phase==='finished'||fleet.busy?'disabled':''}>${b.phase==='execute'||fleet.replay?(fleet.playing?'一時停止':'再生'):'同時実行'}</button>`}<button class="chip" data-fleet-action="fit">全体</button><button class="chip" data-mode="design">設計へ戻る</button></div><p>${fleet.command==='move'?'空白をタップして移動 / 高度 '+fleet.altitude+' m':fleet.command==='attack'?'攻撃する敵艦の記号をタップ':fleet.command==='position'?'配置先をクリック':review?'ドラッグで回転 · ホイールでズーム':'記号を選択 · 空白で移動 · ドラッグで図を移動'}</p>`;}
function fleetSetOrder(o){if(C.fleetOrder(fleet.battle,fleet.selected,o)){fleet.command='select';fleetRender();}}
function fleetReset(){const b=fleet.battle;fleet.playing=false;fleet.replay=false;fleet.frame=null;fleet.elapsed=0;fleet.battle=C.fleetBattle(b.units.filter(u=>b.combat||u.team===0).map(u=>C.fleetUnit(u.id,u.key,u.p,u.team)),b.combat);fleet.battle.seconds=b.seconds;fleet.selected=fleet.battle.units.find(u=>u.team===0)?.id||null;fleetArrange();fleetFit();fleetRender();}
function fleetExecute(){const b=fleet.battle;if(fleet.busy||fleet.replay||b.phase!=='plan')return;if(b.combat&&!b.units.some(u=>u.team===1&&!u.dead)){toast('敵艦を追加してください');return;}if(!C.fleetCommit(b))return;fleet.elapsed=0;fleet.frame=C.fleetSample(b.last,0);fleet.playing=true;fleet.lastClock=0;fleet.command='select';fleetRender();}
function fleetPick(px,py){if(!view)return null;let best=null,score=Infinity;for(const u of fleetDisplay().filter(u=>!u.dead)){const p=view.project(u.pos),q=view.project(C.add(u.pos,[u.p.len*.5,0,0])),r=Math.max(22,Math.min(90,Math.hypot(q[0]-p[0],q[1]-p[1]))),d=Math.hypot(px-p[0],py-p[1]);if(p[2]>=-1&&p[2]<=1&&d<r&&d<score){best=u;score=d;}}return best;}
function fleetTap(px,py){
 if(fleet.mode==='tactical'){const rect=fleetMapSize();fleetMapTap(px-rect.left,py-rect.top);return;}
 const u=fleetPick(px,py),selected=fleetSelected();if(fleet.mode==='tactical'&&u?.team===1&&selected?.team===0&&fleetEditable()){fleetSetOrder({type:'attack',target:u.id,fire:true});return;}
 if(fleet.command==='move'||fleet.command==='position'){if(!fleetEditable()||!selected)return;const r=view?.ray(px,py);if(!r||Math.abs(r.d[1])<.03){toast('真上か斜めの視点で指定してください');return;}const y=fleet.mode==='review'?selected.pos[1]:fleet.altitude,t=(y-r.o[1])/r.d[1];if(t<=0)return;const p=C.add(r.o,C.mul(r.d,t));if(fleet.mode==='review'){selected.pos=p;const real=fleet.review.find(x=>x.id===selected.id);real.pos=p;fleet.command='select';fleetRender();}else fleetSetOrder({type:'move',point:p});return;}
 if(u){fleet.selected=u.id;fleetRender();}
}
function fleetDrawLines(us){if(!view)return;const grid=Gfx.lineSet(),orders=Gfx.lineSet(),shots=Gfx.lineSet(),review=fleet.mode==='review';if(!review){const c=view.cam.target,R=Math.max(10000,view.cam.r),step=R>60000?10000:R>25000?5000:1000,cx=Math.round(c[0]/step)*step,cz=Math.round(c[2]/step)*step;for(let k=-12;k<=12;k++){grid.seg([cx+k*step,0,cz-12*step],[cx+k*step,0,cz+12*step],[65,108,135,65]);grid.seg([cx-12*step,0,cz+k*step],[cx+12*step,0,cz+k*step],[65,108,135,65]);}}
 for(const u of us){if(u.dead)continue;const col=u.team?[255,111,97,210]:[92,205,238,220];if(!fleet.clean&&(u.id===fleet.selected||!review)){orders.circle(u.pos,[1,0,0],[0,0,1],u.p.len*.57,[...col.slice(0,3),u.id===fleet.selected?230:80]);}if(!review&&u.team===0&&fleet.battle.phase==='plan'){const o=u.order,p=o.type==='move'?o.point:o.type==='attack'?us.find(t=>t.id===o.target)?.pos:null;if(p){orders.seg(u.pos,p,col);orders.cross(p,180,col);}}}
 if(!review&&fleet.frame?.shots&&Math.floor(fleet.elapsed*6)%3!==2){for(const s of fleet.frame.shots){const a=us.find(u=>u.id===s.from),b=us.find(u=>u.id===s.to);if(!a||!b||a.dead)continue;const d=C.sub(b.pos,a.pos),q=(fleet.elapsed*3)%1,head=C.add(a.pos,C.mul(d,q)),tail=C.add(a.pos,C.mul(d,Math.max(0,q-.18)));shots.seg(tail,head,s.ion?[100,180,255,255]:s.team?[255,80,65,255]:[103,255,155,255]);}}
 view.setLines('fleetGrid',grid.out());view.setLines('fleetOrders',orders.out());view.setLines('fleetShots',shots.out());
}
function fleetRenderLabels(us){const el=$('#fleetLabels');if(!view||!fleet.labels||fleet.clean){el.innerHTML='';return;}const rect=view.canvas.getBoundingClientRect();el.innerHTML=us.filter(u=>!u.dead).map(u=>{const p=view.project(C.add(u.pos,[0,-u.p.height*.5,0]));if(p[2]<-1||p[2]>1||p[0]<rect.left||p[0]>rect.right||p[1]<rect.top||p[1]>rect.bottom)return '';return `<span class="fleet-label ${u.team?'enemy':''}" style="left:${p[0]-rect.left}px;top:${p[1]-rect.top+15}px"><b>${esc(u.name)}</b>${fleet.mode==='review'?`<small>${fLen(u.p.len)}</small>`:`<small>船体 ${fPct(u.hp/u.p.hp)} · SH ${u.shieldMax?fPct(u.shield/u.shieldMax):'—'}</small>`}</span>`;}).join('');}
function fleetLoop(now){
 const dt=fleet.lastClock?Math.min(.1,(now-fleet.lastClock)/1000):0;fleet.lastClock=now;
 if(fleet.mode==='tactical'&&fleet.playing&&fleet.battle.last){fleet.elapsed=Math.min(fleet.battle.last.duration,fleet.elapsed+dt*fleet.speed);fleet.frame=C.fleetSample(fleet.battle.last,fleet.elapsed);dirty.draw=true;if(fleet.elapsed>=fleet.battle.last.duration){fleet.playing=false;if(!fleet.replay)C.fleetFinish(fleet.battle);fleet.replay=false;fleet.frame=null;fleetRender();}else if(Math.floor(now/250)!==fleet.lastHud){fleet.lastHud=Math.floor(now/250);const clock=$('#fleetHud .fleet-hud-title b');if(clock)clock.textContent='TURN '+fleet.battle.turn+' · T+'+Math.floor(fleet.frame.time)+'s';const p=$('#fleetProgress');if(p)p.value=fleet.elapsed/fleet.battle.last.duration;$('#specSide').innerHTML=fleetDetailsHTML();fleetMapRefreshTools();}}
 if(fleet.mode==='review'&&fleet.orbit&&view){view.cam.th+=dt*.10;dirty.draw=true;}
 if(dirty.draw||(fleet.mode==='review'&&renderHealth.mode==='webgl'&&now-renderHealth.lastFrame>1500)){const us=fleetDisplay();if(fleet.mode==='tactical'){fleetMapDraw(us);dirty.draw=false;}else{fleetDrawLines(us);if(view&&view.draw({fleet:us,mode:'review'})!==false){dirty.draw=false;renderHealth.frames++;renderHealth.lastFrame=now;renderHealth.failures=0;}fleetRenderLabels(us);}}
}
async function fleetSaveReview(){const data={version:1,form:fleet.form,gap:fleet.gap,assets:Object.fromEntries([...new Set(fleet.review.map(u=>u.key))].map(k=>[k,fleet.assets.get(k).design])),ships:fleet.review.map(u=>({key:u.key,name:u.name,pos:u.pos,yaw:u.yaw})),camera:view?.cam};if(LS.set('yard.review1',JSON.stringify(data)))toast('観閲式の配置を保存しました');else toast('配置を保存できませんでした。端末の空き容量を確認してください。');}
async function fleetLoadReview(){if(fleet.busy)return;const raw=LS.get('yard.review1');if(!raw){toast('保存した観閲式はまだありません');return;}fleet.busy=true;fleetRender();await new Promise(r=>setTimeout(r,25));try{const d=JSON.parse(raw);if(d.version!==1||!Array.isArray(d.ships)||d.ships.length>12)throw new Error('形式が違います');const next=[];for(const u of d.ships){if(!u.pos?.every(Number.isFinite)||u.pos.length!==3||!Number.isFinite(u.yaw))throw new Error('配置が不正です');const data=d.assets[u.key],key='review-'+fleetHash(JSON.stringify(data));let a=fleet.assets.get(key);if(!a){const r=await YardEngineClient.request('fleet',{design:data});a={key,design:r.design,stats:r.stats,p:r.profile,geometry:r.geometry};view?.loadFleet(key,r.geometry);fleet.assets.set(key,a);}next.push({...C.fleetUnit('fleet-'+fleet.next++,key,a.p),pos:[...u.pos],yaw:u.yaw});}fleet.review=next;fleet.form=d.form||'line';fleet.gap=C.clamp(Number(d.gap)||0,0,5000);fleet.selected=next[0]?.id||null;fleetPrune();fleetFit();toast('観閲式の配置を開きました');}catch(e){toast('配置を開けません：'+esc(e.message));}finally{fleet.busy=false;fleetRender();}}
function bindFleet(){
 bindFleetMap();
 const click=e=>{const t=e.target.closest('button');if(!t||t.disabled)return;const d=t.dataset;if(d.mode){fleetSetMode(d.mode);return;}if(fleet.mode==='design')return;
 if(d.fleetSelect){fleet.selected=d.fleetSelect;fleetRender();return;}if(d.fleetTeam!=null){if(fleetCanRefit()){fleet.team=+d.fleetTeam;fleetRender();}return;}if(d.fleetForm){fleet.form=d.fleetForm;fleetArrange();fleetFit();fleetRender();return;}
 const a=d.fleetAction,u=fleetSelected();if(!a)return;
 if(a==='add')return fleetAdd();if(a==='execute')return fleetExecute();if(a==='pause'){if(fleet.battle.phase==='execute'||fleet.replay){fleet.playing=!fleet.playing;fleet.lastClock=0;fleetRender();}return;}
 if(a==='replay'){if(fleet.battle.last&&fleet.battle.phase!=='execute'){fleet.replay=true;fleet.elapsed=0;fleet.frame=C.fleetSample(fleet.battle.last,0);fleet.playing=true;fleet.lastClock=0;fleetRender();}return;}
 if(a==='reset'){fleetReset();return;}if(a==='move'||a==='attack'||a==='position'){if(fleetEditable()){fleet.command=a;fleetRender();}return;}if(a==='hold'){fleetSetOrder({type:'hold',target:null});return;}
 if(a==='launch'&&u&&fleetEditable()&&!u.dead&&u.team===0){fleetSetOrder({type:u.order.type,launch:u.order.launch!==true});return;}
 if(a==='moveCoords'&&u&&fleetEditable()){fleetSetOrder({type:'move',point:[fleet.moveX*1000,fleet.altitude,fleet.moveZ*1000]});return;}
 if(a==='zoomIn')fleetMapZoom(.75);if(a==='zoomOut')fleetMapZoom(1/.75);if(a==='ranges')fleet.ranges=!fleet.ranges;
 if(a==='focus')fleetFocus();if(a==='fit')fleetFit();if(a==='top'&&view){view.cam.th=Math.PI/2;view.cam.ph=.0006;view.cam.ortho=true;}if(a==='iso'&&view){view.cam.th=.85;view.cam.ph=1.02;view.cam.ortho=false;}if(a==='labels')fleet.labels=!fleet.labels;if(a==='orbit')fleet.orbit=!fleet.orbit;if(a==='clean'){fleet.clean=!fleet.clean;$('#app').classList.toggle('fleet-clean',fleet.clean);setTimeout(()=>{requestDraw();},60);}
 if(a==='remove'&&u&&fleetCanRefit()){const us=fleetUnits(),i=us.findIndex(v=>v.id===u.id);us.splice(i,1);fleet.selected=us[0]?.id||null;fleetPrune();}
 if(a==='saveReview')return fleetSaveReview();if(a==='loadReview')return fleetLoadReview();fleetRender();
 };
 $('#modeSwitch').addEventListener('click',click);$('#panel').addEventListener('click',click);$('#fleetHud').addEventListener('click',click);$('#fleetMapTools').addEventListener('click',click);
 const change=e=>{const d=e.target.dataset,v=e.target.value,u=fleetSelected();if(e.target.id==='fleetSource'){fleet.source=v;return;}if(d.fleetSetting){const k=d.fleetSetting;if(k==='speed')fleet.speed=+v;if(k==='moveX'||k==='moveZ'){fleet[k]=C.clamp(+v||0,-C.FLEET_RULES.maxCoordinate/1000,C.FLEET_RULES.maxCoordinate/1000);return;}if(k==='seconds'&&fleet.battle.phase==='plan')fleet.battle.seconds=C.clamp(+v,5,30);if(k==='altitude')fleet.altitude=C.clamp(+v||0,-15000,15000);if(k==='combat'&&fleetCanRefit()){fleet.battle.combat=v==='1';fleet.team=0;fleetReset();}if(k==='gap'&&fleet.mode==='review'){fleet.gap=+v;fleetArrange();fleetFit();}fleetRender();}if(d.fleetPos!=null&&u&&fleet.mode==='review'&&v!==''&&Number.isFinite(+v)){const r=fleet.review.find(x=>x.id===u.id);if(d.fleetPos==='yaw')r.yaw=+v*Math.PI/180;else r.pos[+d.fleetPos]=C.clamp(+v,-150000,150000);requestDraw();}if(d.fleetOrder&&u&&fleetEditable())fleetSetOrder({type:u.order.type,[d.fleetOrder]:e.target.checked});};
 $('#panel').addEventListener('change',change);
 window.addEventListener('keydown',e=>{if(fleet.mode==='design'||e.target.matches('input,textarea,select'))return;if(e.code==='Space'){e.preventDefault();if(fleet.battle?.phase==='execute'||fleet.replay){fleet.playing=!fleet.playing;fleet.lastClock=0;fleetRender();}else if(fleet.mode==='tactical')fleetExecute();}if(e.key==='Escape'){fleet.command='select';fleet.clean=false;$('#app').classList.remove('fleet-clean');fleetRender();}});
}
function fleetPrune(){const keys=new Set([...fleet.review,...(fleet.battle?.units||[])].map(u=>u.key));for(const k of fleet.assets.keys())if(!keys.has(k))fleet.assets.delete(k);view?.pruneFleet(keys);}

st.surfaceMode='horizontal';st.structPitch=0;st.structRoll=0;
function surfaceControls(p,selected){const pitch=selected?p.pitch||0:st.structPitch,roll=selected?p.roll||0:st.structRoll;return `<div class="surface-controls"><h4>配置の向き</h4>${selected?`<p class="note">${p.surfaceNormal?'接触面に沿った座標系':'船体の水平座標系'}で回転します。</p><button class="chip" data-surface-reset>水平へ戻す</button>`:seg('surfacemode',[['horizontal','水平を保つ'],['surface','接触面に沿う']],st.surfaceMode)}<div class="sliders">${slider(selected?'surfacePitch':'newSurfacePitch','前後の傾き',pitch,-180,180,1,deg(pitch))}${slider(selected?'surfaceRoll':'newSurfaceRoll','左右の傾き',roll,-180,180,1,deg(roll))}</div>${!selected?'<p class="note">接触面の法線に構造物の上方向を揃え、底面を接地させます。斜面・舷側・下面に対応。回転は接触面上の方位、傾きはその面に対する追加角度です。</p>':''}</div>`;}
function bindSurface(){
 $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.surfacemode){st.surfaceMode=b.dataset.surfacemode;renderPanel();}if('surfaceReset'in b.dataset){const p=selItem();if(p?.k==='struct'){mutate('構造物を水平へ戻す',()=>editSel(q=>{delete q.surfaceNormal;q.pitch=0;q.roll=0;}),'parts');renderPanel();}}});
 $('#panel').addEventListener('input',e=>{const k=e.target.dataset.sl;if(!['surfacePitch','surfaceRoll','newSurfacePitch','newSurfaceRoll'].includes(k)||e.target.value===''||!Number.isFinite(+e.target.value))return;const v=C.clamp(+e.target.value,-180,180),pitch=k.endsWith('Pitch');if(k.startsWith('new')){st[pitch?'structPitch':'structRoll']=v;}else{const p=selItem();if(p?.k!=='struct')return;beginDrag('構造物の傾き');editSel(q=>q[pitch?'pitch':'roll']=v);touch('parts');scheduleStats(150);}const o=$('#out-'+k);if(o)o.textContent=deg(v);});
 $('#panel').addEventListener('change',e=>{if(['surfacePitch','surfaceRoll'].includes(e.target.dataset.sl)){endDrag();renderPanel();}});
}

st.planCut={from:.25,to:.52,innerFrom:.38,innerTo:.44,remainingWidth:.5,side:'both'};
function planCutControls(){const input=(c,id)=>`<div class="fleet-coords">${[['from','開始位置 %'],['innerFrom','奥辺の後端 %'],['innerTo','奥辺の前端 %'],['to','終了位置 %'],['remainingWidth','中央に残す幅 %']].map(([k,l])=>`<label>${l}<input type="number" data-plancut="${id}" data-cutprop="${k}" value="${Math.round(c[k]*1000)/10}" min="0" max="100" step=".1"></label>`).join('')}</div>`;return `<details class="trench-editor" open><summary>平面の台形切削</summary><p class="note">楔形の左右を台形に削ります。元の甲板と船底の傾斜を保ち、切り口に垂直の舷側壁を作ります。幅を絞る船体断面とは別の加工です。</p>${seg('plancutside',[['both','両舷'],['port','左舷'],['stbd','右舷']],st.planCut.side)}${input(st.planCut,'new')}<button class="btn primary" data-plan-add>台形に切り取る</button>${ship.cuts.filter(c=>c.type==='planTrapezoid').map(c=>`<details><summary>加工 #${c.id} · ${c.side==='both'?'両舷':c.side==='port'?'左舷':'右舷'}</summary>${input(c,c.id)}<button class="btn sm" data-delcut="${c.id}">切削を取り消す</button></details>`).join('')}</details>`;}
function bindPlanCuts(){
 $('#panel').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.plancutside){st.planCut.side=b.dataset.plancutside;renderPanel();}if('planAdd'in b.dataset){mutate('船体左右を台形に切削',()=>ship.cuts.push(C.normalizePlanCut({id:ship.nextId++,...st.planCut})),'hull');renderPanel();}});
 $('#panel').addEventListener('change',e=>{const t=e.target,id=t.dataset.plancut,k=t.dataset.cutprop;if(!id||!['from','to','innerFrom','innerTo','remainingWidth'].includes(k)||t.value===''||!Number.isFinite(+t.value))return;const v=+t.value/100;if(id==='new'){st.planCut[k]=v;C.normalizePlanCut(st.planCut);}else{const c=ship.cuts.find(c=>c.id===+id&&c.type==='planTrapezoid');if(c)mutate('台形切削の形を変更',()=>{c[k]=v;C.normalizePlanCut(c);},'hull');}renderPanel();});
}

st.alignment='none';st.showHabitation=false;
function alignmentControls(selected=false){return `<div class="pgroup"><h4>${selected?'中心線・中心面へ整列':'配置位置を揃える'}</h4>${seg(selected?'alignselected':'placementalign',Object.entries(C.ALIGNMENTS).filter(([k])=>!selected||k!=='none'),selected?'':st.alignment)}<p class="note">基準は基本船体の寸法。中心線は上下中心面と左右中心面の交線です。${selected?'左右対を中心線へ移すと1個にまとめます。':'選択した座標だけ固定し、残りはタップした位置に合わせます。'}</p></div>`;}
function replacementControls(p){const keys=C.replacementOptions(p);return keys.length?`<div class="pgroup"><h4>同じ形状の設備へ交換</h4><label>交換先<select data-replacement>${keys.map(k=>`<option value="${k}" ${k===p.k?'selected':''}>${esc(C.PARTS[k].name)}</option>`).join('')}</select></label><p class="note">位置・寸法・輪郭を維持して用途を交換します。${C.isReactor(p)?'主炉と補助炉は、同じ実体積なら同じ発電出力です。補助炉は船体外の部分を除いて計算します。':'性能は交換先の設備と寸法に従います。'}航空区画を別用途にすると、付随する開口も撤去します。元に戻す操作に対応。</p></div>`:'';}
function commandControls(f){const p=C.commandCompartments(ship).find(p=>p.windowId===f.id),inf=S?.commandInfo?.[f.id];return `<div class="pgroup blueprint-card" id="command-editor"><h4>${esc(C.COMMAND_ROLES[C.FITS[f.k].role])}区画</h4><label><input type="checkbox" data-command-enabled ${f.commandEnabled!==false?'checked':''}> ポッドの背後に指揮区画を確保</label><div class="sliders">${slider('commandDepth','壁から船内への奥行き',f.commandDepth??12,2,200,1,fmtM(f.commandDepth??12))}${slider('commandHeight','指揮室の高さ',f.commandHeight??Math.max(8,(f.height||4)+3),2,80,1,fmtM(f.commandHeight??Math.max(8,(f.height||4)+3)))}</div><p>占有 ${ja(p?C.partVolume(p):0)} m³ · 稼働 ${fPct(inf?.ratio||0)}</p><p class="note">幅はポッドの直径に連動。外殻内に切取り、機関・主砲充電装置との干渉も点検します。指揮能力はこの区画の有効容積に応じます。</p><button class="btn" data-command-view="${f.id}">指揮区画を透視</button>${f.host?`<button class="btn" data-layout-part="${f.host}">艦橋の構造を編集</button>`:''}</div>`;}
function derivedRoomsHTML(host){const commands=C.commandCompartments(ship).filter(p=>host==null||p.host===host);return `<div class="pgroup"><h4>艦橋に付随する指揮区画</h4>${commands.map(p=>`<button class="engine-row" data-command-view="${p.windowId}"><span>${esc(p.label)} #${p.windowId}</span><b>${ja(C.partVolume(p))} m³</b></button>`).join('')||'<p class="note">艦橋ポッド・航空指揮所窓を構造の壁面に配置すると、背後に指揮区画を確保します。無窓式指揮室は区画メニューから配置できます。</p>'}</div>`;}
function habitationHTML(){return `<div class="pgroup blueprint-card" id="habitation-editor"><h4>空き容積の居住区画</h4><label><input type="checkbox" data-auto-habitation ${ship.autoHabitation!==false?'checked':''}> 未割当の船内容積を居住区画にする</label><p>自動居住 ${ja(S?.autoHabitationVolume||0)} m³<br>収容 ${num(S?.autoCrewCapacity||0)} 名 ＋ 個別配置 ${num(S?.explicitCrewCapacity||0)} 名</p><p class="note">船体・構造の内側から機関、格納庫、指揮室、充電装置、竜骨、開口を除いた残りです。区画を追加すると自動で減り、撤去すると戻ります。24 m³／名（通路・生活設備込み）で概算します。質量・生命維持電力は船体内装の分に含めて計算します。</p><button class="btn" data-habitation-view>${st.showHabitation?'居住区画の表示を隠す':'自動居住区画を透視'}</button><p class="note">透視の緑色セルは容積計算の近似範囲です。</p></div>`;}
function compartmentWeaponsPanel(){
 const tab=st.tab;st.tab='arm';baseRenderPanel();referencePanel($('#panel'));st.tab=tab;
 $('#panel').insertAdjacentHTML('afterbegin',`<div class="pgroup">${seg('group',layoutGroups(),st.group)}</div>`);
 {const panel=$('#panel'),it=selItem();if(st.fitTool==='place'){const anchor=panel.querySelector('[data-group]')?.closest('.pgroup');if(anchor)anchor.insertAdjacentHTML('afterend',alignmentControls());}else if(it&&st.sel?.list==='fits')panel.insertAdjacentHTML('beforeend',alignmentControls(true));}
 $('#panel').insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>配置済みの武装</h4>${ship.fits.filter(f=>C.FITS[f.k].cat==='w').map(f=>`<button class="engine-row" data-layout-fit="${f.id}">${esc(C.FITS[f.k].name)} #${f.id}</button>`).join('')}</div>`);
 markTabs();updateHint();refreshOverlay();
}
function layoutPanel(panel){
 const p=selItem();
 if(((st.tab==='mod'&&st.group!=='weapons'||st.tab==='bridge'&&st.bridgeMode==='body')&&st.partTool==='place')||(st.tab==='bridge'&&st.bridgeMode==='windows'&&st.bridgeTool==='place')){const anchor=panel.querySelector('.command-sub')||panel.querySelector('[data-group]')?.closest('.pgroup');if(anchor)anchor.insertAdjacentHTML('afterend',alignmentControls());else panel.insertAdjacentHTML('afterbegin',alignmentControls());}
 if(p&&st.sel.list==='parts'&&['mod','bridge'].includes(st.tab))panel.insertAdjacentHTML('beforeend',alignmentControls(true)+replacementControls(p)+(p.k==='struct'?derivedRoomsHTML(p.id):''));
 if(p&&st.sel.list==='fits'&&C.FITS[p.k].window&&st.tab==='bridge')panel.insertAdjacentHTML('beforeend',alignmentControls(true)+commandControls(p));
 if(st.tab==='systems')panel.insertAdjacentHTML('afterbegin',habitationHTML()+derivedRoomsHTML());
 if(st.tab==='mod'&&st.group==='command')panel.insertAdjacentHTML('beforeend',derivedRoomsHTML()+`<button class="btn" data-habitation-menu>自動居住区画の設定</button>`);
}
function inspectionHTML(w){const links=w.targets?.length?w.targets:[{tab:'systems'}],button=t=>{const obj=t.list&&ship[t.list]?.find(p=>p.id===t.id),name=obj?t.list==='parts'?C.partLabel(obj):t.list==='fits'?C.FITS[obj.k].name:'ハッチ':t.part?C.PARTS[t.part].name:(t.tab==='arm'?'武装':TAB_NAMES[t.tab])||'編集';return `<button class="btn sm ghost" data-inspect-target="${esc(JSON.stringify(t))}">${esc(name)}${obj?' #'+obj.id:''}を編集 →</button>`;};return `<li class="w-${w.lv}"><span>${esc(w.text)}</span><div class="inspection-links">${links.slice(0,3).map(button).join('')}</div>${links.length>3?`<details><summary>ほか ${links.length-3} 件の対象</summary><div class="inspection-links">${links.slice(3).map(button).join('')}</div></details>`:''}</li>`;}

function openLayoutTarget(t){
 if(fleet.mode!=='design')fleetSetMode('design');
 st.dockCollapsed=false;$('#dock').classList.remove('collapsed');st.sel=null;st.equipmentId=null;st.hatchA=null;
 const p=t.list&&ship[t.list]?.find(p=>p.id===t.id);
 if(p&&t.list==='parts'){st.tab='mod';st.group=C.PARTS[p.k].group;st.partTool='select';st.sel={list:'parts',id:p.id};st.view='xray';}
 else if(p&&t.list==='fits'){
  st.sel={list:'fits',id:p.id};if(C.FITS[p.k].window){st.tab='bridge';st.bridgeMode='windows';st.bridgeTool='adjust';st.bridge=p.k;st.view='xray';}
  else{st.tab='mod';st.group='weapons';st.fitTool='adjust';st.fit=p.k;st.view='normal';}
 }else if(p&&t.list==='hatches'){st.tab='launch';st.view='normal';}
 else if(t.part){st.tab='mod';st.group=C.PARTS[t.part].group;st.part=t.part;st.partTool='place';}
 else{st.tab=t.tab||'systems';if(st.tab==='bridge'){st.bridgeMode='windows';st.bridgeTool='place';st.bridge=t.window||'podBridge';}if(st.tab==='arm'){st.tab='mod';st.group='weapons';st.fitTool='adjust';}}
 syncHud();renderPanel();
 if(p&&view){const c=p.c||p.p||C.mul(C.add(p.a,p.b),.5);view.cam.target=C.add(c,view.off);view.cam.r=Math.max(180,p.c?C.partDims(p).r*6:250);}
 if(t.list==='hatches'&&p){const el=$(`#panel [data-door="${p.id}"]`);el?.closest('.bay-control')?.scrollIntoView?.({block:'center'});el?.focus?.();}
 else if(t.section)$('#'+t.section+'-editor')?.scrollIntoView?.({block:'start'});
 refreshOverlay();requestDraw();
}
// Deck and bottom widths are part of the armoured-wedge section. Other polygon
// sections switch to it with widths that keep their present outline.
function deckSection(rows){
  const hp=ship.hull;if(hp.sec==='warship'||hp.sec==='ellipse')return false;
  const [deck,keel,chine,belt]={rect:[.98,.98,.5,.13],trap:[.6,.98,.5,.02],roof:[.02,.98,.55,.02],diamond:[.02,.02,.5,.02]}[hp.sec]||[.98,.98,.5,.13];
  hp.sec='warship';hp.deckWidth=deck;hp.keelWidth=keel;hp.chineHeight=chine;hp.belt=belt;
  for(const row of rows){while(row.length<4)row.push(0);row[4]=deck;row[5]=keel;}
  return true;
}
function blockedHullControl(t){return false;const d=t.dataset||{},sl=d.sl;return ['hull','sec','assembly','station','loftHull','addstation','dropstation'].some(k=>k in d)||['L','W','H','bowW','bowH','stern','deckWidth','keelWidth','belt','chineHeight','hullStart'].includes(sl);}
function bindLayout(){
 const click=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.inspectTarget){try{openLayoutTarget(JSON.parse(d.inspectTarget));}catch(err){toast('編集対象が見つかりません');}return;}
  if(d.layoutPart){openLayoutTarget({list:'parts',id:+d.layoutPart});return;}
  if(d.layoutFit||d.commandView){openLayoutTarget({list:'fits',id:+(d.layoutFit||d.commandView)});return;}
  if(d.layoutTab){openLayoutTarget({tab:d.layoutTab});return;}
  if('layoutShape'in d){openLayoutTarget({part:'struct'});return;}
  if('habitationMenu'in d){openLayoutTarget({tab:'systems',section:'habitation'});return;}
  if('lockHull'in d){mutate('基本船体を確定',()=>ship.hullLocked=true,'none');renderPanel();return;}
  if(d.placementalign){st.alignment=d.placementalign;renderPanel();return;}
  if(d.alignselected&&st.sel?.list==='fits'){const f=selItem();if(f){mutate('中心線・中心面へ整列',()=>{const q=C.alignedPosition(ship,f.p,d.alignselected),n=f.n||C.AXES[f.a];for(let a=0;a<3;a++)if(Math.abs(n[a])>.7)q[a]=f.p[a];moveFitTo(f,q,n);const tw=f.tw!=null?ship.fits.find(g=>g.id===f.tw):null;if(tw&&Math.abs(f.p[2])<=C.FITS[f.k].r){C.removeItem(ship,'fits',tw.id,false);delete f.tw;}},'fits');}renderPanel();return;}
  if(d.alignselected){const p=selItem();if(p&&st.sel.list==='parts')mutate('中心線・中心面へ整列',()=>C.alignPart(ship,p,d.alignselected,st.mirror),'all');renderPanel();return;}
  if('habitationView'in d){st.showHabitation=!st.showHabitation;st.view='xray';touch('view');syncHud();renderPanel();requestDraw();}
 };
 $('#panel').addEventListener('click',click);$('#specSide').addEventListener('click',click);
 $('#panel').addEventListener('change',e=>{const t=e.target;
  if('replacement'in t.dataset){const p=selItem();if(p&&st.sel.list==='parts'){mutate('同形状の区画に交換',()=>C.replacePart(ship,p,t.value,st.mirror),'all');st.group=C.PARTS[p.k].group;}renderPanel();}
  if('autoHabitation'in t.dataset){mutate('空き容積の居住用途',()=>ship.autoHabitation=t.checked,'none');touch('view');renderPanel();}
  if('commandEnabled'in t.dataset){mutate('指揮システムを切り替え',()=>editSel(f=>f.commandEnabled=t.checked),'fits');renderPanel();}
  if('bodycommand'in t.dataset){mutate('艦橋本体の指揮所を切り替え',()=>editSel(p=>{if(C.bridgeBodyRole(p)){if(t.checked)delete p.commandEnabled;else p.commandEnabled=false;}}),'parts');renderPanel();}
  if(['commandDepth','commandHeight'].includes(t.dataset.sl)){endDrag();renderPanel();}
  if(['fitX','fitZ','fitY','fitAlong'].includes(t.dataset.sl)){endDrag();const f=selItem();if(f?.float)toast(C.FITS[f.k].window?'艦橋ポッドが壁から外れています。位置を戻してください':'この位置には据え付けられません');renderPanel();}
 });
 $('#panel').addEventListener('input',e=>{const t=e.target;if(t.value===''||!Number.isFinite(+t.value))return;const k=t.dataset.sl;
  if(['commandDepth','commandHeight'].includes(k)){beginDrag('指揮区画の寸法');editSel(f=>f[k]=C.clamp(+t.value,2,k==='commandDepth'?200:80));touch('fits');scheduleStats(150);const out=$('#out-'+k);if(out)out.textContent=fmtM(+t.value);}
 });
}

// A cutter is a draft until Apply. Moving it never damages the current design.
st.solidCutter=null;st.solidCutEdit=null;st.cutterVisible=true;st.cutterAction='place';st.cutterPlane='screen';st.cutterStep=5;
let cutterOwner=null,cutterOverlayKey='',cutterDrag=null;
const CUTTER_NAMES={box:'直方体',wedge:'楔形',cylinder:'円柱',ellipsoid:'球・楕円体'};

function resetSolidCutter(){
  cutterOwner=ship;st.solidCutter=null;st.solidCutEdit=null;st.cutterVisible=true;st.cutterAction='place';cutterDrag=null;cutterOverlayKey='';
}
function ensureSolidCutter(){
  if(cutterOwner!==ship)resetSolidCutter();
  if(!st.solidCutter&&ship){
    const h=ship.hull,x=h.L*.55,b=C.sectionBase(h,x),z=b.hw*.65;
    const y=C.originalSurface(ship,x,1,z,1)??b.ytop;
    st.solidCutter=C.normalizeSolidCut({id:-1,shape:'box',c:[x,y,z],s:[Math.max(12,h.L*.12),Math.max(8,h.W*.15),Math.max(8,h.H*.45)],rotation:[0,0,0],mirror:st.mirror,structures:!!h.assembly});
  }
  return st.solidCutter;
}
function reconcileSolidCutter(){
  cutterOwner=ship;cutterDrag=null;cutterOverlayKey='';
  const q=ship.solidCuts?.find(q=>q.id===st.solidCutEdit);
  if(q)st.solidCutter=C.normalizeSolidCut(q);
  else{st.solidCutEdit=null;if(st.solidCutter)st.solidCutter=C.normalizeSolidCut({...st.solidCutter,id:-1});}
}
function cutterActive(){return !!ship&&st.tab==='carve'&&st.carveTool==='solid'&&fleet.mode==='design';}
function cutterNumber(v){return Math.round(v*100)/100;}
function cutterInputs(field,labels,unit){
  const q=ensureSolidCutter(),max=field==='s'?C.DESIGN_LIMITS.partSize:field==='rotation'?180:C.DESIGN_LIMITS.coordinate;
  const min=field==='s'?2:-max;
  return `<div class="cutter-coords">${labels.map((label,i)=>`<label>${label}<span><input type="number" inputmode="decimal" data-cutter-field="${field}" data-axis="${i}" min="${min}" max="${max}" step="${field==='rotation'?1:.1}" value="${cutterNumber(q[field][i])}" aria-label="カッターの${label}"><i>${unit}</i></span></label>`).join('')}</div>`;
}
function solidCutPanelHTML(){
  const q=ensureSolidCutter(),editing=st.solidCutEdit!=null;
  return `<div class="pgroup cutter-editor">
    <div class="cutter-heading"><h3>${editing?'切削 #'+st.solidCutEdit+' を調整':'立体を重ねて切り取る'}</h3>${editing?'<button class="btn sm ghost" data-cutter-new>新規</button>':''}</div>
    <p class="note">半透明の立体を船体に重ね、重なった部分を切り取ります。位置と大きさを決めてから実行できます。</p>
    <div class="cutter-shapes">${Object.entries(CUTTER_NAMES).map(([k,name])=>`<button type="button" class="btn" data-cutter-shape="${k}" aria-pressed="${q.shape===k}">${name}</button>`).join('')}</div>
    <h4>1 · 大きさを決める</h4>
    ${cutterInputs('s',['長さ','幅','高さ'],'m')}
    <div class="cutter-scale"><button class="btn sm" data-cutter-scale="0.8">ひと回り小さく</button><button class="btn sm" data-cutter-scale="1.25">ひと回り大きく</button></div>
    <h4>2 · 船体に重ねる</h4>
    <div class="seg cutter-actions">${[['place','面をタップ'],['move','ドラッグ移動'],['camera','視点を回す']].map(([k,l])=>`<button type="button" data-cutter-action="${k}" aria-pressed="${st.cutterAction===k}">${l}</button>`).join('')}</div>
    <p class="note" id="cutter-action-help">${st.cutterAction==='move'?'ドラッグでカッターを移動します。2本指で拡大・縮小できます。':st.cutterAction==='camera'?'ドラッグで視点を回して、船底側や側面の重なりも確認できます。':'船体・構造物をタップすると、その位置にカッターの中心を置きます。'}</p>
    ${cutterInputs('c',['前後 X','上下 Y','左右 Z'],'m')}
    <details class="cutter-fine"><summary>移動方向・細かな調整</summary>
      <label class="field-label">ドラッグする面<select data-cutter-plane><option value="screen" ${st.cutterPlane==='screen'?'selected':''}>画面に平行</option><option value="xz" ${st.cutterPlane==='xz'?'selected':''}>前後・左右（XZ）</option><option value="xy" ${st.cutterPlane==='xy'?'selected':''}>前後・上下（XY）</option><option value="yz" ${st.cutterPlane==='yz'?'selected':''}>上下・左右（YZ）</option></select></label>
      <label class="field-label">ボタンで動かす距離（m）<input type="number" inputmode="decimal" data-cutter-step min=".1" max="1000" step=".1" value="${st.cutterStep}"></label>
      <div class="cutter-nudge">${[['艦尾へ',0,-1],['艦首へ',0,1],['下へ',1,-1],['上へ',1,1],['左舷へ',2,-1],['右舷へ',2,1]].map(([l,a,v])=>`<button class="btn sm" data-cutter-nudge="${a}" data-direction="${v}">${l}</button>`).join('')}</div>
      <div class="row2"><button class="btn sm" data-cutter-center>左右中央へ</button><button class="btn sm" data-cutter-through>上下に貫通</button></div>
    </details>
    <details class="cutter-rotation"><summary>角度を変える</summary>${cutterInputs('rotation',['X軸回転','Y軸回転','Z軸回転'],'°')}<div class="cutter-nudge">${[0,1,2].map(a=>`<button class="btn sm" data-cutter-turn="${a}">${['X','Y','Z'][a]} +90°</button>`).join('')}</div><button class="btn sm ghost" data-cutter-zero>回転を戻す</button></details>
    <div class="cutter-options"><label class="check"><input type="checkbox" data-cutter-visible ${st.cutterVisible!==false?'checked':''}> カッターを表示</label><label class="check"><input type="checkbox" data-cutter-mirror ${q.mirror?'checked':''}> 左右対称に切る</label><label class="check"><input type="checkbox" data-cutter-structures ${q.structures?'checked':''}> 上部構造・船殻パーツも切る</label></div>
    <p class="note">${editing?'変更は実行するまで確定しません。':q.shape==='cylinder'?'円柱の軸は初期状態で上下方向です。':q.shape==='ellipsoid'?'長さ・幅・高さを同じ値にすると球になります。':'表示中の立体の内側が切り取られる範囲です。'}</p>
    <div class="cutter-apply"><button type="button" class="btn primary" data-cutter-apply>${editing?'この形で切削を更新':'重なりを切り取る'}</button>${editing?'<button class="btn ghost" data-cutter-cancel>調整をやめる</button>':''}</div>
  </div><div class="pgroup"><div class="cutter-heading"><h4>立体で切った箇所</h4><button class="btn sm ghost" data-cutter-new>新しいカッター</button></div>
  <ul class="ilist cutter-history">${(ship.solidCuts||[]).map(c=>`<li class="${st.solidCutEdit===c.id?'selected':''}"><span><b>${esc(CUTTER_NAMES[c.shape]||'立体')} #${c.id}${c.mirror?' · 左右対称':''}</b>${c.s.map(cutterNumber).join(' × ')} m</span><div class="cutter-list-actions"><button class="btn sm" data-cutter-select="${c.id}">選んで調整</button><button class="btn sm ghost" data-cutter-delete="${c.id}">取り消す</button></div></li>`).join('')||'<li><span>切り取った箇所をここから調整・取り消しできます。</span></li>'}</ul>
  <p class="note">元に戻す・やり直す操作にも対応します。</p></div>`;
}
function syncCutterFields(){
  const q=ensureSolidCutter();if(!q)return;
  for(const input of $$('#panel [data-cutter-field]')){const f=input.dataset.cutterField,a=+input.dataset.axis;if(q[f])input.value=cutterNumber(q[f][a]);}
}
function refreshSolidCutterOverlay(){
  if(!view)return;
  const q=cutterActive()&&st.cutterVisible!==false?ensureSolidCutter():null,key=q?JSON.stringify(q):'off';
  if(key===cutterOverlayKey)return;
  cutterOverlayKey=key;
  const g=Gfx.meshSolidCutter(q);
  view.upload('cutter',g.mesh);view.setLines('cutter',g.lines);requestDraw();
}
function updateCutterDraft(rerender=false){
  st.cutterVisible=true;st.solidCutter=C.normalizeSolidCut(st.solidCutter);cutterOverlayKey='';
  if(rerender)renderPanel();else{syncCutterFields();refreshSolidCutterOverlay();updateHint();requestDraw();}
}
function placeSolidCutter(hit){
  if(!hit?.p)return;const q=ensureSolidCutter();q.c=hit.p.slice();
  if(hit.part?.k==='struct')q.structures=true;
  updateCutterDraft(true);
}
function selectSolidCut(id){
  const q=ship.solidCuts?.find(q=>q.id===id);if(!q)return;
  cutterOwner=ship;st.cutterVisible=true;st.solidCutEdit=q.id;st.solidCutter=C.normalizeSolidCut(q);st.cutterAction='move';st.carveTool='solid';st.tab='carve';cutterOverlayKey='';renderPanel();
}
function applySolidCutter(){
  const draft=ensureSolidCutter(),editing=st.solidCutEdit!=null;
  if(!draft)return false;
  if(!editing&&(ship.solidCuts?.length||0)>=32){toast('立体切削は32箇所までです。一覧から既存の切削を調整してください');return false;}
  if(!editing&&C.solidCutIntersectsShip&&!C.solidCutIntersectsShip(ship,draft)){toast('船体との重なりがありません。位置や大きさを調整してください');return false;}
  let applied;
  const changed=mutate(editing?'立体切削を調整':'立体の重なりを切削',()=>{
    ship.solidCuts||=[];
    const i=editing?ship.solidCuts.findIndex(q=>q.id===st.solidCutEdit):-1;
    if(editing&&i<0)return '調整する切削が見つかりません';
    applied=C.normalizeSolidCut({...draft,id:editing?st.solidCutEdit:ship.nextId++});
    if(i>=0)ship.solidCuts[i]=applied;else ship.solidCuts.push(applied);
    if(ship.hullSkin?.enabled)ship.hullSkin.enabled=false;
  },'hull');
  if(changed&&applied){st.solidCutEdit=applied.id;st.solidCutter=C.normalizeSolidCut(applied);st.cutterAction='camera';st.cutterVisible=false;cutterOverlayKey='';}
  renderPanel();return !!changed;
}
function cutterPlanePoint(px,py,point,normal){
  const r=view?.ray(px,py);if(!r)return null;const den=C.dot(r.d,normal);if(Math.abs(den)<1e-6)return null;
  const t=C.dot(C.sub(point,r.o),normal)/den;if(!Number.isFinite(t)||t<0)return null;return C.add(r.o,C.mul(r.d,t));
}
function cutterDragStart(px,py){
  if(!cutterActive()||st.cutterAction!=='move'||!view)return false;
  const q=ensureSolidCutter(),m=view.matrices();
  const normal=st.cutterPlane==='xz'?[0,1,0]:st.cutterPlane==='xy'?[0,0,1]:st.cutterPlane==='yz'?[1,0,0]:C.norm([m.V[2],m.V[6],m.V[10]]);
  const anchor=cutterPlanePoint(px,py,q.c,normal);
  if(!anchor){toast('移動面を正面から見られる視点に変えてください');return false;}
  st.cutterVisible=true;cutterOverlayKey='';cutterDrag={c:q.c.slice(),normal,anchor};refreshSolidCutterOverlay();return true;
}
function cutterDragMove(px,py){
  if(!cutterDrag)return;
  const p=cutterPlanePoint(px,py,cutterDrag.c,cutterDrag.normal);if(!p)return;
  st.solidCutter.c=C.add(cutterDrag.c,C.sub(p,cutterDrag.anchor)).map(v=>C.clamp(v,-C.DESIGN_LIMITS.coordinate,C.DESIGN_LIMITS.coordinate));
  syncCutterFields();refreshSolidCutterOverlay();requestDraw();
}
function cutterDragEnd(cancel=false){
  if(!cutterDrag)return;if(cancel)st.solidCutter.c=cutterDrag.c.slice();cutterDrag=null;updateCutterDraft(false);
}
function bindSolidCuts(){
  $('#panel').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.cutterShape){ensureSolidCutter().shape=d.cutterShape;updateCutterDraft(true);}
    if(d.cutterAction){st.cutterAction=d.cutterAction;renderPanel();}
    if('cutterNew'in d){resetSolidCutter();st.carveTool='solid';renderPanel();}
    if('cutterCancel'in d){const c=ship.solidCuts?.find(c=>c.id===st.solidCutEdit);if(c)st.solidCutter=C.normalizeSolidCut(c);st.solidCutEdit=null;st.cutterAction='camera';updateCutterDraft(true);}
    if('cutterApply'in d)applySolidCutter();
    if(d.cutterSelect)selectSolidCut(+d.cutterSelect);
    if(d.cutterDelete){const id=+d.cutterDelete;mutate('立体切削を取り消す',()=>ship.solidCuts=(ship.solidCuts||[]).filter(c=>c.id!==id),'hull');if(st.solidCutEdit===id){st.solidCutEdit=null;st.cutterAction='place';}cutterOverlayKey='';renderPanel();}
    if(d.cutterScale){const q=ensureSolidCutter();q.s=q.s.map(v=>v*Number(d.cutterScale));updateCutterDraft(false);}
    if('cutterNudge'in d){const q=ensureSolidCutter(),a=+d.cutterNudge;q.c[a]+=st.cutterStep*(+d.direction);updateCutterDraft(false);}
    if('cutterTurn'in d){const q=ensureSolidCutter(),a=+d.cutterTurn;q.rotation[a]=((q.rotation[a]+270)%360)-180;updateCutterDraft(false);}
    if('cutterZero'in d){ensureSolidCutter().rotation=[0,0,0];updateCutterDraft(false);}
    if('cutterCenter'in d){ensureSolidCutter().c[2]=0;updateCutterDraft(false);}
    if('cutterThrough'in d){const q=ensureSolidCutter(),b=Gfx.shipBounds(ship);q.rotation=[0,0,0];q.c[1]=(b[1]+b[4])/2;q.s[2]=Math.max(2,b[4]-b[1]+Math.max(4,ship.hull.H*.1));updateCutterDraft(false);}
  });
  const onField=e=>{
    const t=e.target,f=t.dataset.cutterField,a=+t.dataset.axis;
    if(!['c','s','rotation'].includes(f)||![0,1,2].includes(a)||t.value===''||!Number.isFinite(+t.value))return;
    ensureSolidCutter()[f][a]=+t.value;updateCutterDraft(false);
  };
  $('#panel').addEventListener('input',onField);
  $('#panel').addEventListener('change',e=>{
    const t=e.target,d=t.dataset;onField(e);
    if('cutterVisible'in d){st.cutterVisible=t.checked;cutterOverlayKey='';refreshSolidCutterOverlay();}
    if('cutterMirror'in d){ensureSolidCutter().mirror=t.checked;updateCutterDraft(true);}
    if('cutterStructures'in d){ensureSolidCutter().structures=t.checked;updateCutterDraft(true);}
    if('cutterPlane'in d&&['screen','xz','xy','yz'].includes(t.value))st.cutterPlane=t.value;
    if('cutterStep'in d&&t.value!==''&&Number.isFinite(+t.value))st.cutterStep=C.clamp(+t.value,.1,1000);
  });
}

// Rendering owns no design data. Rebuilding GPU resources must never reset,
// resave, or replace a ship; selection, camera, undo history and drafts survive.
const renderHealth={mode:'starting',lost:false,error:null,frames:0,lastFrame:0,failures:0,recoveries:0,automaticRetries:0};
let renderRetryTimer=0;
function renderingMessage(message,error=false){
 const el=$('#renderStatus');if(el){el.textContent=message;el.hidden=!message;el.classList.toggle('render-error',error);}
}
function invalidateRendering(){
 uploadStored();dirty.draw=true;
}
function bindCanvasRendering(canvas){
 canvas.addEventListener?.('webglcontextlost',e=>{if(canvas!==$('#cv'))return;e.preventDefault();renderHealth.lost=true;renderingMessage('3D表示が中断しました。設計は保持されています。復旧待ち…',true);requestDraw();clearTimeout(renderRetryTimer);renderRetryTimer=setTimeout(()=>{renderRetryTimer=0;if(renderHealth.lost)restoreRenderer(true,false);},1000);});
 canvas.addEventListener?.('webglcontextrestored',()=>{if(canvas!==$('#cv'))return;restoreRenderer(false,false);});
}
function restoreRenderer(useCompat=false,fit=false){
 clearTimeout(renderRetryTimer);renderRetryTimer=0;
 const old=view,cam=old?.cam?JSON.parse(JSON.stringify(old.cam)):null,off=old?.off?.slice();
 let canvas=$('#cv');
 try{
  old?.dispose?.();
  // A canvas cannot switch between WebGL and 2D after a context is allocated.
  // Use a fresh element rather than retaining stale GPU buffers or controls.
  if(old||canvas.dataset?.contextAttempted){const next=canvas.cloneNode(false);next.width=300;next.height=150;canvas.replaceWith(next);canvas=next;}
  if(canvas.dataset)canvas.dataset.contextAttempted='1';
  try{view=useCompat?new Gfx.CompatRenderer(canvas):new Gfx.Renderer(canvas);}
  catch(e){
   if(useCompat)throw e;
   const next=canvas.cloneNode(false);next.width=300;next.height=150;canvas.replaceWith(next);canvas=next;
   view=new Gfx.CompatRenderer(canvas);renderHealth.error=String(e.message||e);
  }
  renderHealth.mode=view.kind==='compat'?'compat':'webgl';renderHealth.lost=false;renderHealth.failures=0;
  if(cam)view.cam=cam;if(off)view.off=off;
  bindCanvasRendering(canvas);attachControls(canvas);view.onTextureReady=requestDraw;
  if(fleet?.assets)for(const [key,a] of fleet.assets)if(fleet.mode==='review'&&a.geometry)view.loadFleet(key,a.geometry);
  if(trial.on&&trial.asset?.geometry)view.loadFleet(trial.asset.key,trial.asset.geometry);
  if(ship){invalidateRendering();refreshOverlay();if(fit||!cam)fitCamera();}
  const fail=$('#glfail');if(fail)fail.hidden=true;
  renderingMessage(renderHealth.mode==='compat'?'互換3D表示 · テクスチャ省略／形状と選択は同じ':'');
  renderHealth.recoveries++;return true;
 }catch(e){
  view=null;renderHealth.mode='failed';renderHealth.error=String(e.message||e);renderingMessage('表示を復旧できませんでした。「表示を復旧」を押してください。設計は保持しています。',true);
  console.error(e);return false;
 }
}
function renderingFailed(e){
 renderHealth.error=String(e?.message||e);renderHealth.failures++;dirty.draw=true;
 if(renderHealth.failures===1)console.error(e);
 renderingMessage('描画エラー：'+renderHealth.error+'（設計データは保持）',true);
 if(renderHealth.automaticRetries<2&&!renderRetryTimer){renderHealth.automaticRetries++;renderRetryTimer=setTimeout(()=>{renderRetryTimer=0;restoreRenderer(true,false);},400);}else if(renderHealth.automaticRetries>=2){renderHealth.lost=true;renderingMessage('描画を停止しました：'+renderHealth.error+'。設計は保持されています。「表示を復旧」で再試行できます。',true);}
}
function bindRendering(){
 $('#btnRestoreView')?.addEventListener('click',()=>{renderHealth.automaticRetries=0;restoreRenderer(false,true);});
 $('#btnCompatView')?.addEventListener('click',()=>{renderHealth.automaticRetries=0;restoreRenderer(true,false);});
 const wake=()=>{if(document.hidden)return;requestDraw();};
 document.addEventListener?.('visibilitychange',wake);window.addEventListener?.('pageshow',wake);window.addEventListener?.('focus',wake);
 window.addEventListener?.('resize',wake);window.visualViewport?.addEventListener('resize',wake);
 if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(wake);observer.observe($('#viewport'));}
}

// ---------- tutorial: a very simple Imperial-class star destroyer ----------
// Each step opens the right menu and waits for the player's own tap; 「おまかせ」
// taps along a world ray through the very same placement code.
const tut={on:false,i:0,min:false,timer:0};
const TUT_HULL={L:1600,W:1000,H:230};
const tutDeck=(x,z)=>[[x,6000,z],[0,-1,0]],tutStern=(y,z)=>[[-6000,y,z],[1,0,0]],tutBelly=(x,z)=>[[x,-6000,z],[0,1,0]];
const tutCount=f=>ship?ship.parts.filter(f).length:0;
const tutBridge=()=>ship?.parts.find(p=>p.skinAsset==='isd_bridge');
function tutCam(name){
 if(!view||!ship?._geoProxy)return;fitCamera(true);const c=CAMS[name];view.cam.ortho=name!=='iso';view.cam.th=c[0];view.cam.ph=c[1];view.cam.target=[0,0,0];
 // Keep the ship clear of the tutorial card on wide screens.
 const vp=$('#viewport'),w=vp?.clientWidth||0,h=vp?.clientHeight||1;
 if(w>700&&!tut.min){view.cam.r*=1.12;const V=view.matrices().V,k=view.cam.r*Math.tan(view.cam.fov/2)*(w/h)*.3;view.cam.target=[0,1,2].map(a=>-V[a*4]*k);}
 requestDraw();
}
const tutClosedHangar=()=>ship?.parts.find(p=>p.k==='hangar'&&!ship.hatches.some(h=>h.bay===p.id));
function tutOpenHangar(){
 const p=tutClosedHangar();if(!p)return false;let ok=false;
 mutate('格納庫の発着口を開ける',()=>{const b=C.sectionBase(ship.hull,C.clamp(p.c[0],0,ship.hull.L)),h=p.room?.[2]||40;if(p.c[1]-h/2-b.ybot<8)p.c[1]=b.ybot+h/2;if(C.aviationSurfaceContacts(ship,p).find(c=>c.face==='bottom')?.contact){C.setAviationSurfaceMode(ship,p,'bottom','ray');ok=true;}},'all');
 if(!ok)toast('格納庫が船底に接していません。「航空隊」タブで発着口の面を選べます');renderPanel();return ok;
}
function tutTap(o,d){const t=tool(),hit=pickRay(o,d,tapWant(t));if(!hit){toast('置く面が見つかりませんでした');return false;}tapHit(t,hit);return true;}
// One step can ask for several compartments; it selects the first one still missing.
function tutPartStep(o){
 const has=it=>tutCount(p=>p.k===it.k)>=(it.n||1),next=()=>o.items.find(it=>!has(it))||o.items[o.items.length-1];
 const pick=it=>{st.tab='mod';st.group=o.group;st.part=it.k;st.equipmentId=null;st.partTool='place';st.sel=null;st.placeBy[it.k]=it.placeBy||'inside';if(it.size)st.size[it.k]=it.size;if(it.room)st.roomSize=it.room.slice();st.mirror=it.mirror!==false;st.vmirror=false;};
 return {title:o.title,text:o.text,extra:o.extra,focus:[`[data-group="${o.group}"]`,()=>`[data-part="${next().k}"]`],phase:()=>next().k,
  select(){pick(next());syncHud();},setup(){pick(next());st.view=o.view||'xray';syncHud();tutCam(o.cam||'iso');},
  done:()=>o.items.every(has),
  auto(){for(const it of o.items)if(!has(it)){pick(it);tutTap(...it.at());}pick(next());syncHud();o.after?.();}};
}
const TUT_STEPS=[
 {title:'船体を用意する',text:'全長 1,600 m・全幅 1,000 m のくさび形船体（艦種：デストロイヤー）を用意しました。インペリアル級の要点は<b>平たい三角形の船体</b>・<b>艦尾寄りの艦橋</b>・<b>艦尾の大型エンジン</b>の3つです。寸法は「船体」タブでいつでも変えられます。',
  focus:['#tabs [data-tab="hull"]'],setup(){st.tab='hull';st.view='normal';tutCam('iso');},done:()=>true},
 {title:'艦橋本体を置く',text:'「区画および艤装 → 艦橋 → 艦橋本体」で<b>インペリアル級 艦橋本体</b>を選んであります。甲板の<b>艦尾寄り（後ろから約1/5）の中心線</b>をタップしてください。前面の円筒ポッドが指揮所なので、置くだけで艦橋として働きます。',
  focus:['#tabs [data-tab="mod"]','[data-group="bridge"]','[data-equipment="isdBridge"]'],
  setup(){st.tab='bridge';st.bridgeMode='body';st.bridgeEquipment='isdBridge';st.equipmentId=null;st.partTool='place';st.sel=null;st.view='normal';tutCam('iso');},
  done:()=>!!tutBridge(),auto:()=>tutTap(...tutDeck(TUT_HULL.L*.2,0))},
 tutPartStep({title:'主反応炉を積む',group:'power',text:'<b>主反応炉</b>（球）が艦のすべての電力をまかないます。艦橋の少し前、<b>甲板の中心線</b>をタップすると、面の内側に収まるよう置かれます。透視表示で船内が見えます。',
  items:[{k:'gen',size:130,mirror:false,at:()=>tutDeck(TUT_HULL.L*.3,0)}]}),
 tutPartStep({title:'反応物の貯蔵と供給',group:'power',text:'炉を動かし続けるには<b>反応物サイロ</b>（燃料）と<b>反応物供給設備</b>が要ります。炉の前の<b>甲板の中心線</b>にサイロ、炉の<b>横</b>に供給設備を順にタップしてください。1つ置くと次の区画に切り替わります。',
  items:[{k:'fuel',size:60,mirror:false,at:()=>tutDeck(TUT_HULL.L*.39,0)},{k:'pump',room:[60,40,24],mirror:false,at:()=>tutDeck(TUT_HULL.L*.3,110)}]}),
 {title:'艦尾にエンジンを付ける',text:'<b>タービン内蔵型エンジン</b>を選び、艦尾から見る視点にしました。<b>艦尾の面</b>をタップします。「左右対称」がオンなので、中心から離れた所をタップすると左右一対になります。中央にもう1基置けばインペリアル級らしい3基です。炉とノズルの間の機関は自動でつながります。',
  focus:['[data-equipment="internalTurbine"]','#chipMirror'],
  setup(){chooseEquipment('internalTurbine');st.mirror=true;st.vmirror=false;st.engineDir=[-1,0,0];st.view='normal';syncHud();tutCam('back');},
  done:()=>tutCount(p=>p.k==='engine')>=2,auto:()=>{tutTap(...tutStern(TUT_HULL.H*.5,150));tutTap(...tutStern(TUT_HULL.H*.5,0));}},
 tutPartStep({title:'ハイパードライブを積む',group:'power',text:'<b>ハイパードライブ</b>がないと超空間へ跳べません。反応物サイロより前の<b>甲板の中心線</b>をタップして船内に収めます。',
  items:[{k:'hyper',size:60,mirror:false,at:()=>tutDeck(TUT_HULL.L*.48,0)}]}),
 tutPartStep({title:'慣性制御と構造維持',group:'support',text:'<b>慣性制御装置</b>がないと乗員が加速に耐えられず、艦は動けません。<b>構造維持装置</b>は推力に船体が耐えられるよう補強します。<b>甲板の中心から少し外</b>を順にタップすると左右一対で置かれます。',
  items:[{k:'inertial',size:60,at:()=>tutDeck(TUT_HULL.L*.56,90)},{k:'integrity',room:[110,50,30],at:()=>tutDeck(TUT_HULL.L*.33,150)}]}),
 tutPartStep({title:'シールド発生器を据える',group:'support',view:'normal',text:'<b>広域シールド発生器</b>を「一部露出」で選んであります。<b>艦橋本体の上</b>を中心から少しずらしてタップすると、左右一対の球形ドームが据わります。インペリアル級の艦橋の上にある、あの2つの球です。',
  items:[{k:'shield',size:34,placeBy:'partial',at:()=>{const b=tutBridge();return tutDeck(b?b.c[0]-b.s[0]*.25:TUT_HULL.L*.2,b?b.s[1]*.28:80);}}]}),
 {title:'主砲を並べる',text:'「区画および艤装 → 武装」で<b>6連装重ターボレーザー</b>を選んであります。<b>甲板の左右の縁</b>を艦尾から艦首へ2〜3か所タップしてください。左右対称なので1回で両舷に付きます。',
  focus:['[data-group="weapons"]','[data-fit="refISD"]'],
  setup(){st.tab='mod';st.group='weapons';st.fit='refISD';st.fitTool='place';st.weaponMount='auto';st.mirror=true;st.sel=null;st.view='normal';syncHud();tutCam('iso');},
  done:()=>ship&&ship.fits.filter(f=>C.FITS[f.k].cat==='w').length>=4,auto:()=>{for(const [x,z] of [[.22,300],[.36,230],[.5,160]])tutTap(...tutDeck(TUT_HULL.L*x,z));}},
 tutPartStep({title:'格納庫を設ける',group:'air',cam:'bottom',text:'<b>航空区画</b>（格納庫）を選び、下から見る視点にしました。<b>船底の中央</b>をタップすると船内に収まります。続けて「腹面に発着口を開ける」を押すと、格納庫を船底まで下げてシールド式の発着口を開けます。航空隊の編成は「航空隊」タブで決めます。',
  items:[{k:'hangar',room:[240,120,40],mirror:false,at:()=>tutBelly(TUT_HULL.L*.42,0)}],extra:{label:'腹面に発着口を開ける',show:()=>!!tutClosedHangar(),run:()=>tutOpenHangar()},after:()=>tutOpenHangar()}),
 {title:'性能を確かめて完成',text:'ごく簡素なインペリアル級の完成です。「性能」タブと右の性能諸元で出力・加速・火力を確かめ、注意点は「系統」タブで点検します。「公試に出る」でコルサント上空を操艦し、標的ブイへの射撃で砲塔の射界も確かめられます。艦名を付けて「設計図」から保存しましょう。次は装甲・トレンチ・航空隊や地上部隊の編成に挑戦できます。',
  focus:['#tabs [data-tab="spec"]','#btnMenu'],setup(){st.tab='spec';st.view='normal';st.sel=null;tutCam('iso');},done:()=>true,summary:true}
];
function tutStart(){
 const s=C.newShip(Object.assign({},C.HULLS.wedge,TUT_HULL),'練習用インペリアル級');s.hullLocked=false;s.shipClass='destroyer';
 const had=!!ship;st.mirror=true;st.vmirror=false;st.sel=null;st.tab='hull';
 closeSheet();setShip(s);hideTitle();tut.on=true;tut.i=0;tut.min=false;document.body.classList.add('tut-on');
 if(had)toast('前の設計は「元に戻す」で戻せます');
 tutGo(0,true);
}
function tutStop(){tut.on=false;clearInterval(tut.timer);tut.timer=0;document.body.classList.remove('tut-on');$$('.tut-focus').forEach(e=>e.classList.remove('tut-focus'));const box=$('#tut');if(box)box.hidden=true;}
function tutGo(i,first){
 tut.i=C.clamp(i,0,TUT_STEPS.length-1);const s=TUT_STEPS[tut.i];tut.phase=s.phase?.()??null;tut.full=false;
 const run=()=>{try{s.setup?.();}catch(e){console.error(e);}syncHud();renderPanel();requestDraw();tutRender();};
 if(first&&!ship?._geoProxy){tutRender();const wait=setInterval(()=>{if(!tut.on){clearInterval(wait);return;}if(ship?._geoProxy){clearInterval(wait);run();}},300);}else run();
 clearInterval(tut.timer);tut.timer=setInterval(tutTick,600);
}
function tutSummary(){
 if(!S)return '<p class="tut-wait">性能を計算中…</p>';
 const warn=(S.warnings||[]).filter(w=>w.lv!=='info').length;
 return `<dl class="tut-sum"><div><dt>艦橋</dt><dd>${S.bridges} 基</dd></div><div><dt>最大加速</dt><dd>${fG(S.accelG)}</dd></div><div><dt>一斉射</dt><dd>${fTT(S.alphaTot)}</dd></div><div><dt>超空間</dt><dd>${S.hyperClass?'クラス '+S.hyperClass.toFixed(1):'なし'}</dd></div></dl><p class="tut-note">${warn?`注意点が ${warn} 件あります。「系統」タブで確認できます。`:'大きな問題はありません。'}</p>`;
}
function tutRender(){
 let box=$('#tut');
 if(!box){box=document.createElement('section');box.id='tut';box.className='tut';box.setAttribute('aria-label','チュートリアル');$('#viewport').appendChild(box);}
 if(!tut.on){box.hidden=true;return;}
 const s=TUT_STEPS[tut.i],done=!!s.done(),ready=!!ship?._geoProxy,last=tut.i===TUT_STEPS.length-1;
 box.hidden=false;box.classList.toggle('min',tut.min);box.classList.toggle('done',done&&!!s.auto);
 if(tut.min){box.innerHTML=`<button type="button" class="tut-pill" data-tut="max">チュートリアル ${tut.i+1}/${TUT_STEPS.length}・${esc(s.title)}${done&&s.auto?' ✓':''}</button>`;return;}
 box.innerHTML=`<div class="tut-head"><span class="tut-kicker">チュートリアル · 簡素なISDを作る</span><span class="tut-no">${tut.i+1}/${TUT_STEPS.length}</span><button type="button" class="tut-ic" data-tut="min" aria-label="小さくする">－</button><button type="button" class="tut-ic" data-tut="close" aria-label="チュートリアルを終える">×</button></div>
 <ol class="tut-dots" aria-hidden="true">${TUT_STEPS.map((q,j)=>`<li class="${j<tut.i?'past':j===tut.i?'now':''}"></li>`).join('')}</ol>
 <h3>${esc(s.title)}</h3><p class="tut-text${tut.full?' full':''}" data-tut="text" title="タップで全文を表示">${s.text}</p>${s.summary?tutSummary():''}
 ${s.auto?`<p class="tut-state ${done?'ok':''}">${done?'✓ できました。「次へ」で進みます。':ready?'画面をタップして置いてください。':'船体を準備中…'}</p>`:''}
 <div class="tut-actions"><button type="button" class="btn sm ghost" data-tut="prev" ${tut.i===0?'disabled':''}>戻る</button>${s.extra&&s.extra.show()?`<button type="button" class="btn sm" data-tut="extra">${esc(s.extra.label)}</button>`:''}${s.auto?`<button type="button" class="btn sm" data-tut="auto" ${ready?'':'disabled'}>おまかせで実行</button>`:''}<button type="button" class="btn sm primary" data-tut="${last?'close':'next'}">${last?'チュートリアルを終える':'次へ'}</button></div>`;
 tutDecorate();
}
function tutDecorate(){
 $$('.tut-focus').forEach(e=>e.classList.remove('tut-focus'));if(!tut.on||tut.min)return;
 for(const f of TUT_STEPS[tut.i].focus||[]){const sel=typeof f==='function'?f():f;for(const e of $$(sel))e.classList.add('tut-focus');}
}
let tutLast='';
function tutTick(){
 if(!tut.on){clearInterval(tut.timer);tut.timer=0;return;}
 const s=TUT_STEPS[tut.i];if(s.phase){const ph=s.phase();if(tut.phase!==ph){const was=tut.phase;tut.phase=ph;if(was!=null&&!s.done()){s.select();renderPanel();requestDraw();}}}
 const key=[tut.i,!!s.done(),!!ship?._geoProxy,tut.min,!!s.extra?.show(),s.summary?JSON.stringify([S?.bridges,S?.accelG,S?.alphaTot,S?.hyperClass,S?.warnings?.length]):''].join('|');
 if(key!==tutLast){tutLast=key;tutRender();}else tutDecorate();
}
function bindTutorial(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-tut]');if(!b)return;const a=b.dataset.tut;
  if(a==='start'){tutStart();return;}
  if(!tut.on)return;
  if(a==='next')tutGo(tut.i+1);else if(a==='prev')tutGo(tut.i-1);else if(a==='close')tutStop();
  else if(a==='extra'){try{TUT_STEPS[tut.i].extra?.run();}catch(err){console.error(err);toast(String(err.message||err));}tutRender();}
  else if(a==='text'){tut.full=!tut.full;b.classList.toggle('full',tut.full);}
  else if(a==='min'){tut.min=true;tutRender();}else if(a==='max'){tut.min=false;tutRender();}
  else if(a==='auto'){const s=TUT_STEPS[tut.i];if(!ship?._geoProxy){toast('船体の準備中です');return;}try{s.setup?.();renderPanel();s.auto?.();}catch(err){console.error(err);toast('おまかせ配置に失敗しました：'+(err.message||err));}tutRender();}
 });
}

window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
