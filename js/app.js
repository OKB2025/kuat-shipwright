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
const WEAPONS = ['refVen','refISD','refIon','refSide','oct40','casemate40','casemateMid','casemateLight','triple40','quad200','pd', 'ltl', 'mtl', 'htl', 'stl', 'utl', 'ion', 'msl', 'trc'];
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
st.group='power';st.structPlate=false;st.structLight=false;st.structPlateT=1;st.structForm='trap';st.structAngles=[10,10,15,15];st.structYaw=0;st.structOffsetX=0;st.structOffsetZ=0;st.reactor=null;st.engineDir=[-1,0,0];st.trench={side:'both',depth:20,height:16,level:.5,from:0,to:1};
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
  if (JSON.stringify(S?.ungrounded || null) !== JSON.stringify(prevS?.ungrounded || null)) refreshOverlay();
  if (msg.gen === eng.gen) {
    if (prevS && eng.label && !eng.quiet && msg.gen >= eng.labelGen) toastDiff(eng.label, prevS, S);
    const ug = x => (x?.ungrounded?.parts.length || 0) + (x?.ungrounded?.fits.length || 0);
    if (prevS && ug(S) > ug(prevS)) toast(`接地していない部品があります（赤枠 ${ug(S)} 個）。船体か、船体につながる部品に接するよう動かしてください`);
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
  if(voy.open){try{voyLoop(now);}catch(e){console.error(e);}requestAnimationFrame(loop);return;}
  if(fleet.mode!=='design'){try{if(!renderHealth.lost&&!renderRetryTimer)fleetLoop(now);}catch(e){renderingFailed(e);}requestAnimationFrame(loop);return;}
  if (view && ship && !renderHealth.lost && !renderRetryTimer) {
    view.onTextureReady=requestDraw;
    try {
      if (titleCam.base) titleOrbit(now);
      if (dirty.draw || (renderHealth.mode==='webgl' && now-renderHealth.lastFrame>1500)) {
        const drawn=view.draw({mode: st.view, clip: null, paint:ship.paint,lights:ship.lights,hullLength:ship.hull.L,reference:ship.reference, hidden: liveHidden(), meshScale: liveScale()});
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
    case 'mod': return st.group==='weapons'?(st.fitTool==='place'?'fit':st.fitTool==='remove'?'unfit':st.fitTool==='multi'?'multi':'adjust'):st.partTool === 'select' ? 'select' : st.partTool === 'multi' ? 'multi' : st.partTool === 'remove' ? 'unpart' : 'part';
    case 'launch': return 'select';
    case 'arm': return st.fitTool === 'place' ? 'fit' : st.fitTool === 'remove' ? 'unfit' : st.fitTool === 'multi' ? 'multi' : 'adjust';
    case 'bridge': if(st.bridgeMode==='body')return st.partTool==='select'?'select':st.partTool==='multi'?'multi':st.partTool==='remove'?'unpart':'part';return st.bridgeTool === 'place' ? 'fit' : st.bridgeTool === 'remove' ? 'unfit' : 'adjust';
    case 'carve': return st.carveTool === 'solid' ? 'solid' : st.carveTool === 'notch' ? 'notch' : 'inspect';
    default: return 'inspect';
  }
}
function curFit() { return st.tab === 'bridge' ? st.bridge : st.fit; }
function hintText() {
  const t = tool();
  switch (t) {
    case 'multi': return '区画・構造物・装備をタップして選択に追加／もう一度で解除';
    case 'unpart': return '撤去する区画・構造物をタップ（対称の相手も外れます）';
    case 'part': {
      const spec=activeEquipment();if(spec)return `面をタップして${spec.name}を配置${spec.k==='engine'?'（寸法で推力が変化）':''}`;
      const k = st.part, nm = C.PARTS[k].name;
      if (k === 'struct') return `面をタップして${st.structPlate ? '装甲外板' : st.structLight ? '軽構造' : '構造物'}（${st.structSize.map(v => Math.round(v)).join('×')} m${st.structPlate ? `・装甲 ${num(st.structPlateT, 1)} m` : ''}）を据える`;
      return `面をタップして${nm}（${st.size[k]} m・${PLACE.find(p => p[0] === st.placeBy[k])[1]}）を置く`;
    }
    case 'select': return st.tab==='launch'?'航空区画を選んで出口を設定。航空隊のサイズと機数は下の欄で編集できます':st.sel?.list === 'parts' ? '選択中の区画は枠ごとドラッグで移動・別の区画はタップで選択' : st.view === 'normal' ? '区画をタップで選択（内部は透視で）・選ぶとドラッグで移動' : '区画をタップで選択・選ぶとドラッグで移動';
    case 'fit': return (C.FITS[curFit()].pod?`構造物・艦橋本体の壁をタップして${C.FITS[curFit()].name}を設置`:`面をタップして${C.FITS[curFit()].short}を設置（${weaponTiltMode(curFit())?'斜面では面に沿って傾ける':'傾斜には支持台'}）`)+(ship?.parts.some(p=>p.plate)?'・装甲外板には付けられません':'');
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
    return C.alignStructure({id:-1,k,c,s:[l,w,hh],pitch:st.structPitch||0,roll:st.structRoll||0,taper:st.structTaper,form:st.structForm,skinAsset:st.structForm==='reference'?st.skinAsset:undefined,angles:st.structAngles.slice(),yaw:st.structYaw,offsetX:st.structOffsetX,offsetZ:st.structOffsetZ,...(st.structPlate?{plate:true,plateT:st.structPlateT}:st.structLight?{light:true}:{})},hit,st.surfaceMode);
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
    const tilt=weaponTiltMode(k)?C.fitTilt(normal):null;
    const f = C.mountFit(ship, {id:-1,k,p:alignFitPoint(hit.p,hit.n).slice(),n:normal.slice(),a,ped:st.ped,...(['trench','casemate'].includes(st.weaponMount)&&d.cat==='w'?{localMount:true}:{}),...(tilt?{tilt}:{})});
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
  // Parts that touch neither the hull nor anything connected to it are outlined in red.
  if (S?.ungrounded && fleet.mode === 'design') { const red = [255, 86, 76, 255], gp = new Set(S.ungrounded.parts), gf = new Set(S.ungrounded.fits); for (const p of ship.parts) if (gp.has(p.id)) ls.part(shape(p), red); for (const f of ship.fits) if (gf.has(f.id)) ls.box(C.fitAABB(f), red); }
  if (tool() === 'multi') { const am = [240, 170, 70, 255]; for (const p of ship.parts) if (st.multi.parts.has(p.id)) ls.part(shape(p), am); for (const f of ship.fits) if (st.multi.fits.has(f.id)) ls.box(C.fitAABB(f), am); }
  if (it && st.sel.list === 'fits' && (armMode() || st.tab === 'bridge')) { ls.box(C.fitAABB(it), cy); for (const l of fitLinks(it)) ls.box(C.fitAABB(l.fit), [105, 195, 220, 130]);const room=C.commandCompartments(ship).find(p=>p.windowId===it.id);if(room)ls.part(room,[142,229,192,255]); }
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
  hoverLines = ghostFor(pick(px, py, {parts: t === 'select' || t === 'multi' || t === 'unpart', fits: t === 'unfit' || t === 'adjust' || t === 'inspect' || t === 'fit' || t === 'multi'}));
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
function tapWant(t) { return {parts: t === 'select' || t === 'multi' || t === 'unpart' || t === 'inspect' || (t === 'notch' && st.notchStructures), fits: t !== 'part' && t !== 'notch' && t !== 'unpart'}; }
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
      mutate(C.FITS[k].short + 'を設置', () => { const opts = {localMount:['trench','casemate'].includes(st.weaponMount),tilt:weaponTiltMode(k)}, r = C.placeFit(ship, k, alignFitPoint(hit.p, hit.n), weaponPlacementNormal(k,hit.n), st.ped, st.mirror, opts); err = r.err; made = r.fit; if (made) { placeVerticalFits(made, k, st.ped, opts); applyPedDefaults(made); applyFitTemplate(made); } }, 'fits', {silent: true});
      if (err) toast(err); else if (made) { showPreview('fits', linkedItems('fits', made)); st.sel = {list: 'fits', id: made.id}; renderPanel(); }
      break;
    }
    case 'multi': multiToggle(hit); break;
    case 'unpart':
      if (hit && hit.part && hit.part.id > 0 && ship.parts.some(p => p.id === hit.part.id)) { removeWithPreview('撤去', 'parts', ship.parts.find(p => p.id === hit.part.id)); if (st.sel?.list === 'parts' && !findSel(st.sel)) st.sel = null; renderPanel(); }
      else toast(st.view === 'normal' ? '撤去する区画・構造物をタップしてください（内部の区画は「透視」で選べます）' : '撤去する区画・構造物をタップしてください');
      break;
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
    html += `<div class="ins-row">支持台 ${ped.toFixed(1)} m（自動 ${f.base.toFixed(1)}＋追加 ${f.ped.toFixed(1)}）・${esc(C.AXNAME[f.a])}${f.tilt?` · 面に沿って ${Math.round(Math.acos(C.clamp(C.dot(f.tilt,C.AXES[f.a]),-1,1))*180/Math.PI)}° 傾斜`:''}</div>`;
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
  if (pt.k === 'struct' && pt.plate) h += `<div class="ins-row">装甲外板・厚さ ${num(C.plateThickness(pt), 1)} m${inf ? `・表面の露出 ${fPct(inf.exposed)}` : ''}<br>武装・艦橋ポッドは取り付けられません</div>`;
  else if (pt.k === 'struct' && pt.light) h += `<div class="ins-row">軽構造・質量と強度は通常の構造物の ¼</div>`;
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
    <div><dt>装甲</dt><dd>外殻 ${S.armorHull.toFixed(2)} m<small>集中防御 ${S.armorCit.toFixed(1)} m${S.plateArea>0?` · 装甲外板 ${S.armorPlate.toFixed(1)} m（表面の ${fPct(S.plateShare||0)}）`:''}</small></dd></div>
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
  ${bandRatesHTML(S)}${skinFacesHTML(S)}
  <h4>船体容積の内訳</h4>
  <div class="cbar">${comp.map(([k, f]) => `<em style="width:${(f * 100).toFixed(2)}%;background:${rgb(C.PARTS[k].col)}" title="${C.PARTS[k].name}"></em>`).join('')}<em style="width:${(rest * 100).toFixed(2)}%;background:var(--line-2)" title="その他"></em></div>
  <div class="clegend">${comp.map(([k, f]) => `<span><i style="background:${rgb(C.PARTS[k].col)}"></i>${C.PARTS[k].name} ${(f * 100).toFixed(1)}%</span>`).join('')}<span><i style="background:var(--line-2)"></i>居住・倉庫ほか ${(rest * 100).toFixed(1)}%</span></div>
  <p class="note">重要区画の防護 ${fPct(S.protectedFrac)}・ジェネレーター露出 ${fPct(S.genExpFrac)}・開放容積（格納庫）${fPct(S.cls.hangarFrac || 0)}${S.frac.struct > 0 ? `・構造物 ${ja(S.frac.struct * S.hullVolume)} m³` : ''}${S.plateArea > 0 ? `・装甲外板 ${ja(S.plateArea)} m²（装甲 ${fMass(S.plateMass || 0)}）` : ''}</p>
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
  const d = C.fitSpec(it);
  return `<div class="editor"><div class="ed-head"><b>${esc(d.name)}</b><button type="button" class="btn sm ghost" data-desel>選択解除</button><button type="button" class="btn sm danger" data-delsel>撤去</button></div>
    ${fitPairHTML(it)}${fitPositionSliders(it)}
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
      h = `<div class="pgroup">${seg('parttool', [['place', '配置'], ['select', '選択・調整'], ['multi', '複数選択'], ['remove', '撤去']], st.partTool)}</div>`;
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
      } else if (st.partTool === 'remove') {
        h += '<p class="note keep">撤去する区画・構造物を3D表示でタップします。左右・上下対称がオンなら対の部品も外れます。「元に戻す」で取り消せます。</p>';
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
function simHTML(){return `<div class="pgroup"><h4>艦隊戦</h4><p>この艦を含む艦隊を編成し、セクターの作戦図と戦術図で同規模の敵艦隊とリアルタイムで戦います。どの艦も3Dで操艦できます。</p><button class="btn primary" data-voyopen="fleet">艦隊戦を開く</button><button class="btn" data-mode="review">観閲式を開く</button></div>`;}
function ensureOpponents(){}
function runSim(){voyOpenWithCurrent();}

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
  const set = (g, q, m) => { g.p = q.slice(); g.n = C.norm(m); if (g.mountAxis == null) g.a = C.AXES.reduce((i, x, j) => C.dot(x, g.n) > C.dot(C.AXES[i], g.n) ? j : i, 0); const tl = g.mountAxis == null && !g.localMount && weaponTiltMode(g.k) ? C.fitTilt(g.n) : null; if (tl) g.tilt = tl; else delete g.tilt; delete g.local; delete g.localNormal; delete g.host; try { C.mountFit(ship, g); } catch (e) { g.float = true; } };
  const links = fitLinks(f);
  set(f, p, n);
  for (const l of links) { let q = p, m = n; if (l.y) { q = C.vmirrorPoint(ship, q); m = [m[0], -m[1], m[2]]; } if (l.z) { q = C.mirrorP(q); m = C.mirrorP(m); } set(l.fit, q, m); }
  queuePreview('fits', [f, ...links.map(l => l.fit)]);
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
    if (trial.on || shot.on) {   // trial flights and screenshots: drag only looks around, pinch only zooms
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
    if (mode === 'trialPending' && ptrs.size === 0 && performance.now() - start.t < 600 && !shot.on) trialCommand('fireTap');
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
// Fittings placed with 左右対称 / 上下対称 keep links to their counterparts
// (tw: across the centreline, vt: top/bottom). Edits follow those links unless
// 「対の武装も同時に編集」 is switched off; the symmetry toggles only decide
// how new fittings are placed.
st.fitPairEdit = true;
function fitLinks(f) {
  if (!f || st.fitPairEdit === false) return [];
  const find = id => id == null ? null : ship.fits.find(q => q.id === id), tw = find(f.tw), vt = find(f.vt), vtw = (vt && find(vt.tw)) || (tw && find(tw.vt));
  const out = []; if (tw) out.push({fit: tw, z: true, y: false}); if (vt) out.push({fit: vt, z: false, y: true}); if (vtw && vtw !== tw && vtw !== vt) out.push({fit: vtw, z: true, y: true});
  return out;
}
const FIT_SYNC_KEYS = ['ped', 'pedShape', 'pedSize', 'scale', 'width', 'height', 'commandDepth', 'commandHeight', 'commandEnabled', 'chargeSalvos', 'chargeDepth', 'chargeScale', 'localMount'];
function syncFitTwin(from, to, link) {
  if (to.k !== from.k) { to.k = from.k; for (const k of ['skinAsset', 'mountOffset', 'mountAxis']) if (from[k] === undefined) delete to[k]; }
  for (const k of FIT_SYNC_KEYS) { if (from[k] === undefined) delete to[k]; else to[k] = JSON.parse(JSON.stringify(from[k])); }
  // A mirror image turns the other way: one flip negates the train angle, two restore it.
  if (from.assetYaw != null || to.assetYaw != null) to.assetYaw = (from.assetYaw || 0) * ((link.z ? -1 : 1) * (link.y ? -1 : 1));
}
function editSel(fn) {   // live edit of the selected part/fit (and its mirrored twins)
  const it = selItem(); if (!it) return;
  if (st.sel.list === 'fits') { const links = fitLinks(it); fn(it); C.enforceEquipment(it); for (const l of links) syncFitTwin(it, l.fit, l); queuePreview('fits', [it, ...links.map(l => l.fit)]); return; }
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
const TEMPLATE_SKIP = ['id', 'tw', 'vt', 'c', 'p', 'n', 'a', 'tilt', 'host', 'local', 'localNormal', 'base', 'low', 'slope', 'float', 'surfaceNormal', 'pitch', 'roll', 'mountAxis', 'mountOffset', 'localMount', 'batteryZone', 'assetYaw'];
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
    else if ('fitpair' in d) { st.fitPairEdit = st.fitPairEdit === false; renderPanel(); refreshOverlay(); }
    else if ('delsel' in d) {
      const it = selItem(); if (!it) return;
      const list = st.sel.list;
      if (list === 'fits') {   // the editor removes the pair it edits
        const ids = new Set([it.id, ...fitLinks(it).map(l => l.fit.id)]);
        if (mutate('撤去', () => { for (const id of ids) C.removeItem(ship, 'fits', id, false); for (const q of ship.fits) { if (ids.has(q.tw)) delete q.tw; if (ids.has(q.vt)) delete q.vt; } }, 'fits')) showPreview('fits', [], [...ids]);
      } else removeWithPreview('撤去', list, it);
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
    if (shot.on && (e.key === 'Escape' || e.code === 'KeyH')) { e.preventDefault(); shotSet(false); return; }
    if (!mod && !e.altKey && e.code === 'KeyH' && !document.body.classList.contains('title-open')) { e.preventDefault(); shotSet(true); return; }
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
  renderRail();
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
  bind();bindEngineering();bindRealism();bindReference();bindAviation();bindFleet();bindSurface();bindPlanCuts();bindLayout();bindSolidCuts();bindTitle();bindTutorial();bindGround();bindTrial();bindMulti();bindDockToggle();bindShot();bindVoyage();bindRail();bindPalette();
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
  window.__yard = {get ship() { return ship; }, get stats() { return S; }, st, draw: requestDraw, fleet, fleetSetMode, renderHealth, restoreRenderer, view: () => view, setShip, C, pick, onTap, touch, eng, openExample, title: titleApi, meshStore, trial, trialCommand, trialStep: dt => trialStep(dt), trialCamera: dt => trialCamera(dt), trialStart: o => trialStart(o), trialJump: k => trialJump(k), spaceBattleLaunch: () => spaceBattleLaunch(), spaceStep: dt => spaceStep(dt), SYSTEMS, JUMP};
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
  // Ships measured from attached models (src/ships/*.js).
  ...Object.values(C.SHIP_EXAMPLES).map(d => ({key: d.key, name: d.name, note: d.note, side: d.side})),
];
const titleState = {mode: 'top', panel: null, cls: 'destroyer', hull: 'wedge', L: 1600, W: 785, H: 262, name: '新設計艦'};
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
  hideBusyOverlay(); if (panel === 'voyage' || panel === 'design') { titleState.mode = panel; titleState.panel = null; } else { titleState.panel = panel || null; if (panel) titleState.mode = 'design'; } renderTitle();
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
  const mission = $('#titleMenu [data-title="mission"]'); if (mission) mission.disabled = true;
  for (const g of $$('#titleMenu [data-tgroup]')) g.hidden = g.dataset.tgroup !== (titleState.mode || 'top');
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
  else if (titleState.panel === 'patrol') { panel.innerHTML = titlePatrolHTML(); renderTitlePatrolSaves(); }
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
// Patrol: one ship flown through a system — the design on the board, a saved
// design or one of the examples.
function titlePatrolHTML() {
  const ex = Object.values(YardFleetData?.designs || {}), sides = [...new Set(ex.map(d => d.side))];
  return `<div class="tpanel-head"><h2>パトロール</h2><button type="button" class="btn ghost sm" data-title-back>戻る</button></div>
  <p class="note">選んだ艦でクワット星系を航行します。操艦・砲術・点防御（標的機）を試せます。星図からコルサントへジャンプもできます。</p>
  ${ship ? `<h3>設計中の艦</h3><div class="ref-grid"><button type="button" class="btn" data-title-patrol="current">${esc(ship.name)}<small>${fLen(ship.hull.L)} · ${esc(C.shipClassFor(ship.hull.L, ship.shipClass).name)}</small></button></div>` : ''}
  <h3>保存した設計</h3><div class="ref-grid" id="titlePatrolSaves"><p class="muted">一覧を確認中…</p></div>
  <h3>作例</h3>${sides.map(side => `<p class="eyebrow">${esc(side)}</p><div class="ref-grid">${ex.filter(d => d.side === side).sort((a, b) => b.info.len - a.info.len).map(d => `<button type="button" class="btn" data-title-patrol="${esc(d.key)}">${esc(String(d.name).split('｜')[0])}<small>${fLen(d.info.len)} · 乗員 ${num(d.info.crew)}</small></button>`).join('')}</div>`).join('')}
  <p class="note">大型艦は準備に時間がかかります。</p>`;
}
async function renderTitlePatrolSaves() {
  const box = $('#titlePatrolSaves'); if (!box) return; let list = [];
  try { list = await Store.list(); } catch (e) { box.innerHTML = '<p class="muted">一覧を読めませんでした。</p>'; return; }
  box.innerHTML = list.length ? list.map(r => `<button type="button" class="btn" data-title-patrol="save:${esc(r.id)}">${esc(r.name)}<small>${fLen(r.len || 0)}</small></button>`).join('') : '<p class="muted">保存した設計はまだありません。</p>';
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
    if (d.titleMode) { titleState.mode = d.titleMode; titleState.panel = null; renderTitle(); setTimeout(() => t.querySelector(`[data-tgroup="${d.titleMode}"] .tmenu:not([disabled]):not(.tback)`)?.focus?.({preventScroll: true}), 20); return; }
    if (d.title === 'patrol') { titleState.panel = titleState.panel === 'patrol' ? null : 'patrol'; renderTitle(); return; }
    if (d.title === 'fleetbattle') { hideTitle(); voy.saves = await Store.list().catch(() => []); voyOpen('setup'); return; }
    if (d.titlePatrol) { voyPatrol(d.titlePatrol); return; }
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
  try { const r = req.call(el, {navigationUI: 'hide'}); if (r && r.then) r.then(lockLandscape, fallback); else lockLandscape(); } catch (e) { fallback(); }
}
// Phones are held sideways. Full screen lets some browsers lock the rotation;
// elsewhere a portrait gate asks for it (the player may still carry on upright).
function lockLandscape() { try { const o = screen.orientation; if (o?.lock && matchMedia('(pointer:coarse)').matches) o.lock('landscape').catch(() => {}); } catch (e) { /* not supported */ } }
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
    <p class="note">${form==='outline'?'配置後、輪郭の頂点・前後の甲板傾斜・左右への下げ量を編集できます。':['loft','roundloft'].includes(form)?'配置後、前後断面の幅・天井・床と上端の左右絞りを編集できます。':'傾斜角は垂直からの角度。正の値で内側へ絞ります。各壁は独立して調整できます。'}</p></div>${plateControls(p,selected)}`;
}
// Armoured plating: the structure's exposed skin becomes armour of the chosen
// thickness; weapons and pods cannot be mounted on it.
function plateControls(p,selected){
  const kind=selected?(p.plate?'plate':p.light?'light':'frame'):(st.structPlate?'plate':st.structLight?'light':'frame'),on=kind==='plate',t=selected?C.plateThickness(p):st.structPlateT;
  return `<div class="pgroup plate-options"><h4>構造の種類</h4>${seg(selected?'editplate':'structplate',[['frame','構造物'],['light','軽構造'],['plate','装甲外板']],kind)}
    ${on?`<div class="sliders">${slider(selected?'plateT':'newPlateT','装甲の厚さ',t,C.PLATE.min,C.PLATE.max,.1,num(t,1)+' m')}</div>${selected?'':'<button type="button" class="btn sm" data-plateflat>板状の寸法にする（120×60×4 m）</button>'}`:''}
    <p class="note">${kind==='plate'?'装甲外板は、露出した表面が指定の厚さの装甲板になる構造物です。内側は船内として区画を置けますが、外板の上には武装・艦橋ポッドなどの装備を取り付けられません。分離主義艦の曲面外殻のように、骨組みや船体を覆う外装に使います。':kind==='light'?'軽構造は、アンテナ・塔・骨組みのような細い構造物です。質量と強度が通常の構造物の ¼ になり、大きく張り出しても加速を損ないにくい代わりに、被弾で失われやすくなります。':'構造物は船体と同じ密度・強度の張り出しです。外側には武装や艦橋ポッドを取り付けられます。'}</p></div>`;
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
function fitPairHTML(f){
  const find=id=>id==null?null:ship.fits.find(q=>q.id===id),tw=find(f.tw),vt=find(f.vt),vtw=(vt&&find(vt.tw))||(tw&&find(tw.vt)),n=[tw,vt,vtw].filter(Boolean).length;if(!n)return '';
  return `<div class="pair-edit"><span class="pair-tags">${tw?'<span class="tag">左右対</span>':''}${vt?'<span class="tag">上下対</span>':''}${vtw?'<span class="tag">対角</span>':''}</span><button type="button" class="chip" data-fitpair aria-pressed="${st.fitPairEdit!==false}">${st.fitPairEdit!==false?`対の武装 ${n} 基も同時に編集`:'この武装だけ編集'}</button></div>`;
}
function fitEditor(){
  const p=selItem();if(!p||st.sel.list!=='fits'||!C.FITS[p.k].window)return baseFitEditor();
  return `<div class="editor"><div class="ed-head"><b>${esc(C.FITS[p.k].name)}</b><button class="btn sm ghost" data-desel>選択解除</button><button class="btn sm danger" data-delsel>撤去</button></div>${fitPairHTML(p)}${fitPositionSliders(p)}<div class="sliders">${slider('winWidth','ポッドの直径',p.width||16,6,60,.5,fmtM(p.width||16))}${slider('winHeight','ポッドの高さ',p.height||6.4,3,30,.5,fmtM(p.height||6.4))}</div><p class="note">構造物・艦橋本体の側面や前後の壁にのみ取り付けられます。甲板・船体には取り付けられません。背後に指揮区画を確保します。</p></div>`;
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
    if(d.structplate){st.structPlate=d.structplate==='plate';st.structLight=d.structplate==='light';renderPanel();updateHint();}
    if('plateflat'in d){st.structSize=[120,60,4];renderPanel();updateHint();}
    if(d.editplate){const lbl={plate:'装甲外板にする',light:'軽構造にする',frame:'通常の構造物にする'}[d.editplate]||'構造の種類';mutate(lbl,()=>editSel(p=>{if(p.k!=='struct')return;if(d.editplate==='plate'){p.plate=true;p.plateT=C.plateThickness(p);delete p.light;}else if(d.editplate==='light'){delete p.plate;delete p.plateT;p.light=true;}else{delete p.plate;delete p.plateT;delete p.light;}}),'parts');renderPanel();}
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

  if(ship&&st.tab==='mod'&&st.group==='weapons'){compartmentWeaponsPanel();organizePanel();return;}
  if(ship&&st.tab==='ground'){markTabs();$('#panel').innerHTML=groundPanelHTML();updateHint();refreshOverlay();return;}
  v3RenderPanel();if(!ship)return;const panel=$('#panel');
  if(st.tab==='hull'){
    panel.insertAdjacentHTML('afterbegin',`<div class="pgroup"><label><input type="checkbox" data-assembly ${ship.hull.assembly?'checked':''}> 船体を独立した構造パーツで組み立てる</label><p class="note">有効時は一体船体を表示せず、配置した船殻だけを容積・質量・内部区画の境界に使います。環状船体や分離したポッドを作れます。長さ・幅・高さは設計範囲です。</p><label><input type="checkbox" data-corehull ${ship.hull.core?'checked':''}> 船体をコア船体にする</label><p class="note">ルクレハルク級の中央球体（コアシップ）のように、小さな船体の周りを構造物で大きく組む艦に使います。全長・艦種・損傷区画・艦隊戦での大きさを、構造物を含めた全体で計算します。</p></div>`);
    const rows=ship.hull.stations||C.planStations(ship.hull).map(t=>C.profileAt(ship.hull,t)),deckOK=ship.hull.sec!=='ellipse';
    panel.insertAdjacentHTML('afterbegin',`<div class="pgroup blueprint-card"><h4>船体断面・艦尾を設計</h4><p class="note">艦尾から艦首へ。肩の張り出し・舷側の切り込み・艦首の薄さを個別に作れます。幅・厚さ・上下位置は船体寸法に対する割合。甲板（上面）・船底（下面）の平らな幅は各断面の幅に対する割合です。舷側帯・帯位置は装甲楔形の舷側にある垂直帯の厚さと高さ位置（各断面の厚さに対する割合）で、断面ごとに変えられます。艦首の末端2断面は幅・厚さが同率で連動し、船体の幅：高さを保ちます（表の下のチェックで解除できます）。断面と断面の間の「＋」で、その位置に断面を追加します。菱形は上下が頂点です。装甲楔形も甲板・船底幅を0%にすれば尖ります。</p><div class="station-scroll"><table class="station-table"><thead><tr><th>前後 %</th><th>幅 %</th><th>厚さ %</th><th>上下 %</th><th>甲板 %</th><th>船底 %</th><th>舷側帯 %</th><th>帯位置 %</th><th></th></tr></thead><tbody>${rows.map((a,i)=>`<tr>${[a[0],a[1],a[2],a[3]??0,a[4]??ship.hull.deckWidth??.52,a[5]??ship.hull.keelWidth??0,a[6]??ship.hull.belt??.13,a[7]??ship.hull.chineHeight??.5].map((v,j)=>`<td><input aria-label="断面${i+1} ${['前後位置','幅','厚さ','上下位置','甲板幅','船底幅','舷側帯の厚さ','舷側帯の上下位置'][j]}" type="number" inputmode="decimal" data-station="${i}" data-axis="${j}" value="${Math.round(v*1000)/10}" min="${[0,.5,.5,-50,0,0,2,20][j]}" max="${[100,150,150,80,98,98,98,80][j]}" step=".1" ${(j===0&&(i===0||i===rows.length-1))||(j===2&&C.bowStation({...ship.hull,stations:rows},i))||(j>=4&&!deckOK)?'disabled':''} ${j===2&&C.bowStation({...ship.hull,stations:rows},i)?'title="艦首は幅と厚さが連動しています。表の下のチェックを外すと個別に変更できます"':''}></td>`).join('')}<td>${i&&i<rows.length-1?`<button class="btn sm ghost" data-dropstation="${i}" aria-label="断面${i+1}を削除">×</button>`:''}</td></tr>${i<rows.length-1?`<tr class="station-gap"><td colspan="9"><button type="button" class="station-add" data-insertstation="${i}" ${rows.length>=32?'disabled':''} aria-label="断面${i+1}と断面${i+2}の間に断面を追加"><b aria-hidden="true">＋</b>${num((a[0]+rows[i+1][0])*50,1)}% に断面を追加</button></td></tr>`:''}`).join('')}</tbody></table></div><label class="check"><input type="checkbox" data-bowlink ${ship.hull.bowFree?'':'checked'}> 艦首の末端2断面は幅と厚さを連動する（船体の幅：高さの比を保つ）</label>${ship.hull.sec!=='warship'?`<p class="note">${deckOK?'甲板・船底の幅を変えると、断面は今の形に近い「装甲楔形」へ切り替わります。':'楕円断面では甲板・船底の幅は使いません。'}</p>`:''}<div class="sliders">${slider('deckWidth','上甲板の幅',Math.round((ship.hull.deckWidth??.52)*100),0,98,1,Math.round((ship.hull.deckWidth??.52)*100)+'%')}${slider('keelWidth','船底の平坦幅',Math.round((ship.hull.keelWidth??0)*100),0,95,1,Math.round((ship.hull.keelWidth??0)*100)+'%')}${slider('hullStart','本体船殻の艦尾位置',Math.round((ship.hull.start||0)*1000)/10,0,60,.1,Math.round((ship.hull.start||0)*ship.hull.L)+' m')}${slider('chineHeight','舷側帯の上下位置',Math.round((ship.hull.chineHeight??.5)*100),20,80,1,Math.round((ship.hull.chineHeight??.5)*100)+'%')}${slider('belt','舷側帯の厚さ',Math.round((ship.hull.belt??.13)*100),2,45,1,Math.round((ship.hull.belt??.13)*100)+'%')}</div></div>`);
    panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>外板スキン</h4>${seg('yardpaint',[['neutral','無塗装'],['republic','共和国の赤帯'],['dark','暗色'],['cis','分離主義の黄褐色']],ship.paint||'neutral')}<p class="field-label">窓明かり（トレンチ・構造物の壁）</p>${seg('yardlights',[['white','白'],['blue','青'],['warm','暖色'],['off','消灯']],ship.lights||'white')}<div class="sliders">${slider('yardDetail','トレンチ内の設備密度',ship.detail??1,0,2,.5,String(ship.detail??1))}</div><p class="note">スキンは塗装・装甲継ぎ目のみで、指揮能力は追加されません。指揮所は「艦橋」から艦橋本体やポッドを配置します。</p></div>`);
  }
  if(st.tab==='mod'&&st.partTool==='place'&&C.PARTS[st.part].shape==='cube')panel.insertAdjacentHTML('beforeend',`<div class="pgroup"><h4>区画の寸法</h4><div class="sliders">${st.roomSize.map((v,i)=>slider('newRoom'+i,['長さ','幅','高さ'][i],v,4,[ship.hull.L,ship.hull.W,ship.hull.H][i],1,fmtM(v))).join('')}</div><p class="note">立方体に限らず、飛行甲板・居住甲板のような薄く長い区画を配置できます。</p></div>`);
  if(st.tab==='mod')panel.insertAdjacentHTML('afterbegin','<div class="note compartment-rule">内部区画は外殻内に収容。箱形区画の干渉は必要容積を保って自動統合します。主炉・シールド・エンジンと外装機器は張出し可能。</div>');
  referencePanel(panel);layoutPanel(panel);
  if(st.tab==='hull')panel.insertAdjacentHTML('afterbegin',hullDimsHTML());
  if(st.tab==='bridge'&&st.bridgeMode==='body')panel.insertAdjacentHTML('beforeend',surfaceControls({},false));
  if(['hull','carve','armor'].includes(st.tab))panel.insertAdjacentHTML('afterbegin',`<div class="pgroup hull-sub">${seg('hullsub',HULL_SUB,st.tab)}</div>`);
  if(st.tab==='spec')panel.insertAdjacentHTML('afterbegin',trialCardHTML());
  organizePanel();
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
  $('#panel').addEventListener('change',e=>{if(blockedHullControl(e.target))return;const t=e.target;if('assembly'in t.dataset){mutate('船体の組立方式',()=>ship.hull.assembly=t.checked,'all');renderPanel();}if('corehull'in t.dataset){mutate('コア船体',()=>{if(t.checked)ship.hull.core=true;else delete ship.hull.core;},'all');renderPanel();}if('bands'in t.dataset){mutate('識別塗装',()=>editSel(p=>p.bands=t.checked?[[.18,.205],[.235,.25],[.68,.71],[.73,.745]]:[]),'parts');renderPanel();}if('arc'in t.dataset){const k=t.dataset.arc,v=Number(t.value);if(!Number.isFinite(v))return;mutate('環状船体の形状',()=>editSel(p=>p[k]=k==='arcInner'?C.clamp(v/100,.05,.95):k==='arcSweep'?C.clamp(v,5,360):C.clamp(v,-180,180)),'parts');renderPanel();}});
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
    if(d.yardlights&&C.SHIP_LIGHT_KINDS.includes(d.yardlights)){mutate('窓明かり',()=>ship.lights=d.yardlights,'view');renderPanel();requestDraw();}
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
    if(t.dataset.station!=null){const i=+t.dataset.station,j=+t.dataset.axis,v=+t.value/100;if(!Number.isFinite(v)||j>7)return;let switched=false;mutate('船体断面を調整',()=>{const a=ensureStations();if(j>=4)switched=deckSection(a);for(const row of a){while(row.length<Math.max(6,j+1))row.push(row.length===3?0:row.length===4?ship.hull.deckWidth??.52:row.length===5?ship.hull.keelWidth??0:row.length===6?ship.hull.belt??.13:ship.hull.chineHeight??.5);}a[i][j]=j===0?C.clamp(v,a[i-1][0]+.002,a[i+1][0]-.002):C.clamp(v,[0,.005,.005,-.5,0,0,.02,.2][j],[1,1.5,1.5,.8,.98,.98,.98,.8][j]);C.normalizeBow(ship.hull);},'hull');if(switched)toast('甲板・船底の幅を使うため、断面を「装甲楔形」に切り替えました');renderPanel();}
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
    if(k==='plateT')live(()=>editSel(p=>{if(p.plate)p.plateT=C.clamp(v,C.PLATE.min,C.PLATE.max);}));
    if(k==='newPlateT'){st.structPlateT=C.clamp(v,C.PLATE.min,C.PLATE.max);updateHint();}
    if((k==='plateT'||k==='newPlateT')&&out)out.textContent=num(v,1)+' m';
    if(['deckWidth','keelWidth','belt','chineHeight','hullStart'].includes(k))live(()=>{ship.hull[k==='hullStart'?'start':k]=v/100;if(k==='deckWidth')for(const row of ship.hull.stations||[])if(row.length>4)row[4]=v/100;if(k==='keelWidth')for(const row of ship.hull.stations||[])if(row.length>5)row[5]=v/100;if(k==='belt')for(const row of ship.hull.stations||[])if(row.length>6)row[6]=v/100;if(k==='chineHeight')for(const row of ship.hull.stations||[])if(row.length>7)row[7]=v/100;},'hull');
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
// Fire per second by range band (best arc), as the battles use it.
function bandRatesHTML(S){
 const B=S.bandRate;if(!B)return '';const best=a=>Math.max(...a),rows=Object.entries(C.GUN_BANDS).map(([k,b])=>[k,b,best(B[k])]),max=Math.max(1e-9,...rows.map(r=>r[2]));
 return `<h4>射程別の毎秒火力（主射界）</h4><div class="sect">${rows.map(([k,b,v])=>`<div class="lim"><span>${b.name} ${b.range/1000} km</span>${bar(v/max,'b-w')}<b>${fTT(v)}/秒</b></div>`).join('')}</div><p class="note">舷側砲（ケースメイト・舷側砲列）は射程が短いが、同じ電力で長射程砲の約${(1/C.COMBAT.bandCost.close).toFixed(1)}倍の砲火を出せる。射程内でも距離が開くほど命中率は下がる。</p>`;
}
// Armour over each face: the hull's own plus any plating, area-weighted.
function skinFacesHTML(S){
 const sk=S.skin;if(!sk)return '';const n=sk.n,A=[0,0,0,0,0,0],T=[0,0,0,0,0,0];for(let i=0;i<n;i++)for(let f=0;f<6;f++){A[f]+=sk.a[i*6+f];T[f]+=sk.t[i*6+f];}
 const th=A.map((a,f)=>a>0?(S.armorHull||0)+T[f]/a:null),max=Math.max(.05,...th.filter(v=>v!=null));
 return `<h4>面ごとの装甲</h4><div class="sect">${C.COMBAT_FACE.map((nm,f)=>th[f]==null?'':`<div class="lim"><span>${nm}</span>${bar(th[f]/max,'b-s')}<b>${th[f].toFixed(2)} m</b></div>`).join('')}</div><p class="note">シールドを抜けた砲火は面と区画ごとの装甲に負荷として溜まり、厚さに応じた限界を超えると貫通して奥のモジュールに当たる。負荷は時間とともに抜ける。</p>`;
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
 return head+`<div class="pgroup">${seg('parttool',[['place','本体を配置'],['select','選択・調整'],['multi','複数選択'],['remove','撤去']],st.partTool)}</div><div class="parts">${Object.values(C.EQUIPMENT).filter(d=>d.group==='bridge').map(d=>equipmentCard(d.id)).join('')}</div>${st.partTool==='place'?equipmentInfo(C.EQUIPMENT[st.bridgeEquipment])+coordinateControls():(bodyRoleHTML(selected)+(partEditor()||'<p class="note">艦橋本体をタップするか下の一覧から選択してください。</p>'))}<div class="pgroup"><h4>配置済みの艦橋本体</h4><div class="plist">${bodies.map(p=>`<button class="chip${selected?.id===p.id?' on':''}" data-selpart="${p.id}">${esc(C.partLabel(p))}</button>`).join('')||'<p class="note">まだ配置されていません。</p>'}</div></div><button class="btn" data-custombridge>構造パーツから艦橋を組む</button>`;
}

// Placement direction is shared by the preview and the actual mount.
st.weaponMount='auto';
// 「面に合わせる」 stands a weapon on the face's own normal, slopes included.
function weaponTiltMode(k){const d=C.FITS[k];return d?.cat==='w'&&!d.casemate&&st.weaponMount==='auto';}
function weaponPlacementNormal(k,n){return C.FITS[k]?.cat==='w'&&!['auto','trench','casemate'].includes(st.weaponMount)?(st.weaponMount==='bottom'?[0,-1,0]:[0,1,0]):n;}
function weaponMountControls(){return `<div class="pgroup"><h4>武装の取付面</h4>${seg('weaponmount',[['auto','面に合わせる'],['top','上面に配置'],['bottom','下面に配置'],['trench','トレンチ内'],['casemate','側壁ケースメイト']],st.weaponMount)}<p class="note">「面に合わせる」では斜めの面にも面の傾きに沿って傾けて据え付け、射界はその面の外向き半球になります。垂直に立てるときは「上面に配置」「下面に配置」。下面を選ぶと船底へ視点を切り替えます。船体・構造物の下面をタップして搭載。砲塔は下向き、充電装置は取付面の船内側に配置されます。射界は取付面の外向き半球です。「トレンチ内」では溝の床・内壁に局所固定し、外甲板へ移しません。「側壁ケースメイト」は砲口を壁の外向きにして、背面の船内に充電装置を確保します。</p></div>`;}
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
 const names={none:'ハッチ化しない',open:'開放型',ray:'シールド'},contacts=C.aviationSurfaceContacts(ship,p),kept=p._packing?.retained??p._clip?.retained??1;
 // A bay left entirely in a cut-away space has no volume to open from.
 const outside=!contacts.some(q=>q.contact)&&kept<.05?'<p class="note neg keep">この区画はほぼ全体が船体の外（切り取った空間など）にあり、使える容積がありません。区画の一部が切り取った面の奥（船体の内側）に入るよう、位置か寸法を調整してください。</p>':'';
 return `<div class="aviation-surfaces"><h4>表面に接触した面の開口</h4><p class="note">航空区画を船体・外装の表面まで広げ、接触した面の方式を選びます。切り取った凹みの天井や壁に接した面も開口できます。開口は区画の位置と大きさに追従します。</p>${outside}${contacts.map(q=>`<div class="aviation-surface ${q.contact?'':'inactive'}"><label>${esc(q.label)}<select data-aviation-surface="${q.face}" data-aviation-bay="${p.id}" ${q.contact?'':'disabled'} aria-label="${esc(C.partLabel(p))} ${esc(q.label)}の開口方式"><option value="none" ${q.kind==='none'?'selected':''}>ハッチ化しない</option><option value="open" ${q.kind==='open'?'selected':''}>開放型</option><option value="ray" ${q.kind==='ray'?'selected':''}>シールド</option></select></label>${q.contact&&q.kind!=='none'?`<label class="note"><input type="checkbox" data-aviation-door="${q.face}" data-aviation-bay="${p.id}" ${ship.hatches.some(h=>h.bay===p.id&&h.face===q.face&&C.isSlidingHatch(ship,h))?'checked':''}> 装甲スライド扉を併設</label>`:''}<p class="note">${q.contact?'接触面積 '+num(q.area,1)+' m²':q.kind!=='none'?'未接触 · '+names[q.kind]+'の設定を保持。表面に再び接触すると開口が戻ります。':'船体・外装の表面に接触していません。区画の位置・寸法を調整すると選択できます。'}</p></div>`).join('')}</div>`;
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
// ---------- tool rail on the 3D view ----------
// The place / select / multi / remove tools sit on the viewport so they are one
// tap away on every screen; the panel's own tool switches mirror them.
const RAIL_ICONS={place:'<path d="M12 5v14M5 12h14"/>',select:'<path d="M6 3l12 9-5.5 1.2L9.5 19z"/>',multi:'<rect x="3" y="8" width="11" height="11" rx="1.5"/><path d="M8 8V4.5h12.5V16H14"/>',remove:'<path d="M4 7h16M9.5 7V4h5v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5"/>'};
const RAIL_LABELS={place:'配置',select:'選択',multi:'複数',remove:'撤去'};
function railContext(){
 if(!ship||fleet.mode!=='design'||trial.on)return null;
 if(st.tab==='mod'&&st.group!=='weapons')return {kind:'parts',tools:['place','select','multi','remove'],cur:st.partTool||'place'};
 if(st.tab==='mod'&&st.group==='weapons'||st.tab==='arm')return {kind:'fits',tools:['place','select','multi','remove'],cur:st.fitTool==='adjust'?'select':st.fitTool||'place'};
 if(st.tab==='bridge')return st.bridgeMode==='body'?{kind:'parts',tools:['place','select','multi','remove'],cur:st.partTool||'place'}:{kind:'pods',tools:['place','select','remove'],cur:st.bridgeTool==='adjust'?'select':st.bridgeTool||'place'};
 return null;
}
function renderRail(){
 const box=$('#railTools');if(!box)return;const c=railContext();
 const html=c?c.tools.map(t=>`<button type="button" class="tr-btn" data-rail="${t}" aria-pressed="${c.cur===t}" title="${RAIL_LABELS[t]}"><svg viewBox="0 0 24 24" aria-hidden="true">${RAIL_ICONS[t]}</svg><span>${RAIL_LABELS[t]}</span></button>`).join('')+'<i class="tr-sep" aria-hidden="true"></i>':'';
 if(box.innerHTML!==html)box.innerHTML=html;
}
function railSet(v){
 const c=railContext();if(!c||!c.tools.includes(v))return;
 if(c.kind==='parts'){if(v==='place'&&st.partTool!=='place')carryToPlace();st.partTool=v;if(v!=='select'&&st.sel?.list==='fits')st.sel=null;}
 else{const t=v==='select'?'adjust':v,key=c.kind==='fits'?'fitTool':'bridgeTool';if(t==='place'&&st[key]!=='place')carryToPlace();st[key]=t;if(t!=='adjust')st.sel=null;}
 hideInspect();clearHover();renderPanel();refreshOverlay();updateHint();
 if(st.dockCollapsed){st.dockCollapsed=false;$('#dock').classList.remove('collapsed');}
}
function bindRail(){$('#toolRail')?.addEventListener('click',e=>{const b=e.target.closest('[data-rail]');if(b)railSet(b.dataset.rail);});}

// ---------- panel layout ----------
// After a panel is built: the palette moves to the top (with search and recent
// picks), the panel's tool switches hide behind the rail, long lists fold away
// and explanatory notes shrink to two lines (tap to read the rest).
function placeMode(){const t=tool();return t==='part'||t==='fit';}
function organizePanel(){
 const panel=$('#panel');if(!panel||!ship||fleet.mode!=='design')return;
 for(const sel of ['[data-parttool]','[data-fittool]','[data-bridgetool]']){const g=panel.querySelector(sel)?.closest('.pgroup');if(g)g.classList.add('rail-dup');}
 for(const n of panel.querySelectorAll('.note'))if(!n.classList.contains('keep')&&!n.closest('.trial-card,.ground-editor .aviation-budget'))n.classList.add('clamp');
 for(const h of panel.querySelectorAll('.pgroup > h4')){const t=h.textContent.trim();const g=h.parentElement;if(g.tagName==='DETAILS')continue;
  if(/^配置済みの/.test(t)){const n=g.querySelectorAll('button').length;foldGroup(g,h,`${t}（${n}）`,false);}
  else if(/^配置位置を揃える$/.test(t)){const cur=g.querySelector('[aria-pressed="true"]')?.textContent||'';foldGroup(g,h,`${t}：${cur}`,false);}}
 const pal=placeMode()?panel.querySelector('.parts, .fits'):null;
 if(pal){const anchor=panel.querySelector('[data-group]')?.closest('.pgroup')||panel.querySelector('.command-sub')||panel.querySelector('.rail-dup');
  const tools=document.createElement('div');tools.className='pgroup pal-head';tools.innerHTML=paletteHeadHTML();
  if(anchor){anchor.after(tools);tools.after(pal);}else{panel.prepend(pal);panel.prepend(tools);}
  pal.classList.add('palette');
  if(st.palQuery)paletteSearch(st.palQuery);}
 renderRail();
}
function foldGroup(g,h,label,open){const d=document.createElement('details');d.className=g.className+' fold';d.open=!!open;const sm=document.createElement('summary');sm.textContent=label;d.append(sm);h.remove();while(g.firstChild)d.append(g.firstChild);g.replaceWith(d);}

// ---------- palette search and recent picks ----------
st.recent=(()=>{try{const r=JSON.parse(LS.get('yard.recent1')||'[]');return Array.isArray(r)?r.slice(0,8):[];}catch(e){return [];}})();
function paletteItems(){
 const out=[];
 for(const k of PART_KEYS){const d=C.PARTS[k];out.push({type:'part',key:k,name:d.name,sub:d.desc||'',col:d.col,shape:d.shape,group:C.GROUPS[d.group]||''});}
 for(const d of Object.values(C.EQUIPMENT))out.push({type:'equipment',key:d.id,name:d.name,sub:d.group==='bridge'?'艦橋本体':C.GROUPS[d.group]||'',col:C.PARTS[d.k]?.col,shape:C.PARTS[d.k]?.shape,group:d.group==='bridge'?'艦橋':C.GROUPS[d.group]||''});
 for(const k of WEAPONS)if(C.FITS[k])out.push({type:'fit',key:k,name:C.FITS[k].name,sub:C.FITS[k].short||'',col:[214,120,90],shape:'fit',group:'武装'});
 for(const k of BRIDGES)if(C.FITS[k])out.push({type:'bridge',key:k,name:C.FITS[k].name,sub:'艦橋ポッド',col:[150,200,230],shape:'pod',group:'艦橋'});
 return out;
}
const palIcon=it=>`<i class="sw sh-${it.shape||'cube'}" style="background:${rgb(it.col||[160,170,180])}"></i>`;
function paletteHeadHTML(){
 const items=paletteItems(),find=r=>items.find(i=>i.type===r.type&&i.key===r.key),rec=st.recent.map(find).filter(Boolean).slice(0,6);
 return `<label class="pal-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input type="search" data-palsearch placeholder="部品を探す（反応炉・砲塔・格納庫…）" value="${esc(st.palQuery||'')}" aria-label="部品を検索"></label>${rec.length?`<div class="pal-recent" aria-label="最近使った部品"><span>最近</span>${rec.map(it=>`<button type="button" class="chip pal-chip" data-palpick="${it.type}:${esc(it.key)}">${palIcon(it)}${esc(it.name)}</button>`).join('')}</div>`:''}<div class="pal-results" data-palresults hidden></div>`;
}
function paletteSearch(q){
 const box=document.querySelector('[data-palresults]'),pal=document.querySelector('#panel .palette');if(!box)return;q=(q||'').trim();st.palQuery=q;
 if(!q){box.hidden=true;box.innerHTML='';if(pal)pal.hidden=false;return;}
 const terms=q.toLowerCase().split(/\s+/),hits=paletteItems().filter(it=>terms.every(t=>(it.name+' '+it.sub+' '+it.group+' '+it.key).toLowerCase().includes(t))).slice(0,24);
 box.hidden=false;if(pal)pal.hidden=true;
 box.innerHTML=hits.length?hits.map(it=>`<button type="button" class="part pal-hit" data-palpick="${it.type}:${esc(it.key)}">${palIcon(it)}<span class="pn">${esc(it.name)}</span><span class="pd">${esc(it.group)}${it.sub?' · '+esc(it.sub):''}</span></button>`).join(''):'<p class="note keep">見つかりません。別の言葉で探してください。</p>';
}
function rememberPick(type,key){st.recent=[{type,key},...st.recent.filter(r=>!(r.type===type&&r.key===key))].slice(0,8);LS.set('yard.recent1',JSON.stringify(st.recent));}
// Jump to the tab and group that own the item, then press its own card so the
// usual selection code runs.
function palettePick(type,key){
 st.palQuery='';
 if(type==='part'){st.tab='mod';st.group=C.PARTS[key].group;st.partTool='place';}
 else if(type==='equipment'){const d=C.EQUIPMENT[key];if(d.group==='bridge'){st.tab='bridge';st.bridgeMode='body';}else{st.tab='mod';st.group=d.group;}st.partTool='place';}
 else if(type==='fit'){st.tab='mod';st.group='weapons';st.fitTool='place';}
 else if(type==='bridge'){st.tab='bridge';st.bridgeMode='windows';st.bridgeTool='place';}
 st.sel=null;renderPanel();
 const sel={part:`[data-part="${key}"]`,equipment:`[data-equipment="${key}"]`,fit:`[data-fit="${key}"]`,bridge:`[data-bridge="${key}"]`}[type];
 const b=document.querySelector('#panel '+sel);if(b)b.click();
 if(st.dockCollapsed){st.dockCollapsed=false;$('#dock').classList.remove('collapsed');}
}
function bindPalette(){
 const panel=$('#panel');
 panel.addEventListener('input',e=>{if(e.target.dataset.palsearch!=null)paletteSearch(e.target.value);});
 panel.addEventListener('click',e=>{
  const pk=e.target.closest('[data-palpick]');if(pk){e.stopPropagation();const i=pk.dataset.palpick.indexOf(':');palettePick(pk.dataset.palpick.slice(0,i),pk.dataset.palpick.slice(i+1));return;}
  const card=e.target.closest('[data-part],[data-equipment],[data-fit],[data-bridge]');if(card&&card.closest('.palette, .parts, .fits')){const d=card.dataset;if(d.part)rememberPick('part',d.part);else if(d.equipment)rememberPick('equipment',d.equipment);else if(d.fit)rememberPick('fit',d.fit);else if(d.bridge)rememberPick('bridge',d.bridge);}
  const note=e.target.closest('.note.clamp');if(note&&!e.target.closest('a,button,input,select'))note.classList.toggle('full');
 },true);
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
// ---------- screenshot mode ----------
// Hides every control so only the 3D view is left, on the drawing board and in
// flight. A small bar (pause in flight, and the way back) shows while the
// pointer moves and fades after a moment so it stays out of the picture.
const shot={on:false,timer:0};
function shotSet(on){
 on=!!on;if(shot.on===on)return;shot.on=on;document.body.classList.toggle('shot-mode',on);const bar=$('#shotBar');
 if(on){hideInspect();clearHover();if(!trial.on){st.sel=null;st.hatchA=null;refreshOverlay();}if(bar)bar.hidden=false;shotBarRender();shotWake();toast('スクリーンショット表示：画面に触れると操作ボタンが出ます（H・Esc で戻る）');}
 else{if(bar){bar.hidden=true;bar.classList.remove('idle');}clearTimeout(shot.timer);if(trial.paused)trialPause(false);if(!trial.on)renderPanel();}
 const b=$('#btnShot');if(b)b.setAttribute('aria-pressed',String(on));setTimeout(()=>requestDraw(),30);
}
function shotWake(){const bar=$('#shotBar');if(!shot.on||!bar)return;bar.classList.remove('idle');clearTimeout(shot.timer);shot.timer=setTimeout(()=>bar.classList.add('idle'),2600);}
function shotBarRender(){const bar=$('#shotBar');if(!bar)return;bar.innerHTML=`${trial.on?`<button type="button" class="shot-btn" data-shot="pause" aria-pressed="${!!trial.paused}">${trial.paused?'▶ 再開':'❚❚ 一時停止'}</button>`:''}<button type="button" class="shot-btn" data-shot="exit">表示を戻す</button>`;}
function trialPause(on){trial.paused=on==null?!trial.paused:!!on;trial.fire=trial.fireKey=false;trial.last=0;shotBarRender();if(!shot.on)toast(trial.paused?'一時停止（K で再開）':'再開');}
function bindShot(){
 $('#btnShot')?.addEventListener('click',()=>shotSet(!shot.on));
 $('#shotBar')?.addEventListener('click',e=>{const b=e.target.closest('[data-shot]');if(!b)return;e.preventDefault();if(b.dataset.shot==='pause')trialPause();else shotSet(false);shotWake();});
 for(const ev of ['pointerdown','pointermove'])window.addEventListener(ev,()=>{if(shot.on)shotWake();},{passive:true});
}
// ---------- 公試: a free flight trial in low orbit over Coruscant ----------
// WoWS-style standing orders for speed and rudder, a stick for pitch and roll,
// and turrets that follow the view. The ship stays at the render origin; its
// position is kept in double precision relative to the planet centre.

const TRIAL_TELEGRAPH=[['後進',-.25],['停止',0],['1/4',.25],['1/2',.5],['3/4',.75],['全速',1]];
const TRIAL_RUDDER=['取舵一杯','取舵','舵中央','面舵','面舵一杯'];
// The orbit centre floats above the ship and the default view is nearly level,
// so the reticle (screen centre) looks at the horizon with the ship below it.
const TRIAL_CAM_PH=1.54,TRIAL_CAM_LIFT=.2;
const TRIAL_GUN={boltSpeed:4500,range:40000,aim:20000,maxBolts:2400,hitsToKill:10,targets:4};
// How the main batteries are laid: on the reticle, held on an enemy whatever
// the view, or trained fore-and-aft at their initial bearing.
const GUN_MODES={
 free:{name:'自由照準',short:'自由',note:'照準線の先、または照準に捉えた目標を狙います'},
 enemy:{name:'敵方固定',short:'敵固定',note:'視点を動かしても、捉えた目標（なければ最寄りの敵）を追い続けます'},
 home:{name:'初期位置固定',short:'初期位置',note:'砲塔を初期位置に戻して固定します。射撃は砲身の向きへ'}};
const trial={on:false,gunMode:'free',gunTarget:null,paused:false,busy:false,asset:null,p:null,P:[0,0,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],tele:1,rudder:0,level:false,t:0,last:0,hud:0,vf:0,thrust:0,camMode:'horizon',camF:null,rec:null,dust:null,warn:'',designCamera:null,
 stick:{x:0,y:0},keyStick:{x:0,y:0},keys:new Set(),fire:false,fireKey:false,fireTap:0,turrets:[],launchers:[],bolts:[],missiles:[],fx:[],targets:[],gun:null,rays:{busy:false,last:0},aim:null,lead:null,power:null,mslOrder:false,energy:null,powerMode:'balanced',engF:1,thrustWant:0,sysKey:'coruscant',mode:'trial',vbolts:[],jump:null,flash:0,hitFlash:0,battle:null,battlePlan:null};
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
// Watching a battle, the range follows the ship in view and reaches out to take in the fight.
const trialCamRange=r=>{const L=trial.spectate&&trial.camLen?trial.camLen:trial.p.len;return C.clamp(r,L*.45+60,trial.spectate?Math.max(L*12+6000,60000):L*10+4000);};
function trialReset(){
 if(trial.cine)spaceCineEnd();const sy=trialSys(),R=sy.planet.radius;Object.assign(trial,{P:[0,R+sy.altitude,0],V:[0,0,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],tele:1,rudder:0,level:false,t:0,last:0,vf:0,thrust:0,camF:null,warn:'',bolts:[],missiles:[],fx:[],vbolts:[],fireTap:0,aim:null,lead:null,mslOrder:false,jump:null,flash:0,hitFlash:0,camSave:null,drones:[],gunTarget:null,heldLock:null});
 trial.rec={top:0,accel:null,run:null,turn:null,turnSpeed:0};trial.gun={shots:0,hits:0,kills:0,missiles:0};for(const l of trial.launchers){l.reload=0;l.queue=0;l.next=0;}
 // The charging banks start full; their size is one volley per gun (more where a gun stores extra salvos).
 const bank=trial.p.wCap||trial.turrets.reduce((n,t)=>n+t.power*t.cycle*t.charge/TT_J,0);trial.energy={E:bank,cap:bank};trial.engF=1;trial.thrustWant=0;trial.power=null;
 const L=trial.p.len;trialDust();
 for(const t of trial.turrets){t.yaw=0;t.el=0;t.reload=Math.random()*t.cycle;t.clear=false;t.clearDir=null;t.aimed=false;t.arc=true;t.dead=false;t.rot=trialAxisMatrix(t.axis,0,t.rot);}for(const l of trial.launchers)l.dead=false;
 trial.targets=[];trial.battle=null;if(trial.rts)voyPilotInit();else if(trial.mode==='battle'&&trial.battlePlan)spaceBattleInit(trial.battlePlan);else for(let i=0;i<TRIAL_GUN.targets;i++)trial.targets.push(trialSpawnTarget(i,true));
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
// Each gun keeps its range band: how far its bolts carry and what its fire costs in stored energy.
function trialTurretState(t){const fw=tv.norm(t.fw),axis=tv.norm(t.axis),spec=C.FITS[t.k]||{},band=C.fitBand(spec);return {...t,band,reach:C.GUN_BANDS[band]?.range||TRIAL_GUN.range,costK:spec.ion?1:C.COMBAT.bandCost[band]??1,pd:(spec.aa||0)>0&&!((spec.tt||0)>.01)&&!spec.ion,fw,axis,e2:tv.cross(axis,fw),rateRad:t.rate*Math.PI/180,yaw:0,el:0,reload:0,clear:false,clearDir:null,aimed:false,arc:true,rot:trialAxisMatrix(axis,0)};}
// opts.design flies another design than the one on the drawing board;
// opts.battle starts a space battle with that plan; opts.system picks the system.
async function trialStart(opts={}){
 if(trial.on||trial.busy||!view||fleet.mode!=='design')return;if(!opts.design&&!ship)return;
 if(!opts.design){const f=trialFigures(trialProfile());if(!f.ok){toast('加速度が 0 G のため公試を行えません');return;}}
 trial.busy=true;showBusyOverlay(opts.battle?'艦隊戦の準備中…（旗艦の砲塔と射界を計算）':'公試の準備中…（砲塔の旋回軸と射界を計算）');
 let a=null;try{const data=opts.design||C.serialize(ship),key='trial-'+fleetHash(JSON.stringify(data)),r=await YardEngineClient.request('fleet',{design:data,trial:true});a={key,design:r.design,stats:r.stats,p:r.profile,geometry:r.geometry};if(view)view.loadFleet(key,r.geometry);}
 catch(e){console.error(e);toast('公試を開始できません：'+esc(e.message||e));}finally{trial.busy=false;hideBusyOverlay();}
 if(!a||trial.on||fleet.mode!=='design')return;
 if(!(a.p.accel>0&&a.p.maxSpeed>0)){toast('加速度が 0 G のため公試を行えません');return;}
 trial.paused=false;trial.rts=opts.rts||null;trial.spectate=!!opts.rts?.spectate;trial.specCam='chase';trial.frameMs=0;trial.scaleAt=0;if(view)view.renderScale=1;trial.mode=opts.battle||opts.rts?'battle':'trial';trial.battlePlan=opts.battle||null;trial.returnTo=opts.returnTo||null;if(opts.system&&SYSTEMS[opts.system])trial.sysKey=opts.system;trial.sysKey=trial.sysKey||'coruscant';
 if(trial.rts){const sy=trial.rts.w.sector.systems[trial.rts.sys];SYSTEMS.rts={key:'rts',name:sy.name,note:sy.note||'',short:sy.name,planet:{radius:sy.planet?.radius||6e6,kind:sy.planet?.kind===0?0:1,axis:sy.planet?.ring?[-Math.cos(20*Math.PI/180),Math.sin(20*Math.PI/180),0]:[0,0,1],ring:sy.planet?.ring||null},altitude:200000,floor:60000,sun:[-.42,.32,.85].map(v=>v/Math.hypot(.42,.32,.85)),map:[0,0]};trial.sysKey='rts';}
 trial.asset=a;trial.p=a.p;trial.turrets=(a.geometry.turrets||[]).map(trialTurretState);for(const t of trial.turrets)t.charge=t.cap?C.clamp(a.stats.chargeInfo?.[t.id]?.ratio??0,0,1):1;trial.launchers=(a.geometry.launchers||[]).map(l=>({...l,reload:0,queue:0,next:0}));trial.designCamera={cam:JSON.parse(JSON.stringify(view.cam)),off:[...view.off]};
 closeSheet();hideInspect();clearHover();if(dragSnap)endDrag();
 view.off=[0,0,0];view.cam={...view.cam,target:[0,0,0],ortho:false};trialReset();
 trial.on=true;document.body.classList.add('trial-on');const hud=$('#trialHud');hud.hidden=false;hud.classList.toggle('spectate',!!trial.spectate);if(trial.spectate){hud.innerHTML=voySpectateHudHTML();voySpectateHudUpdate(true);}else{hud.innerHTML=trialHudHTML();trialBindHud(hud);trialHudUpdate(true);}
 requestAnimationFrame(()=>{requestDraw();});
}
function trialStop(){
 if(!trial.on)return;if(shot.on)shotSet(false);trial.paused=false;trial.on=false;trial.hitcam=null;trial.fire=trial.fireKey=false;trial.keys.clear();trial.stick={x:0,y:0};trial.keyStick={x:0,y:0};
 document.body.classList.remove('trial-on');const hud=$('#trialHud');hud.hidden=true;hud.innerHTML='';hud.classList.remove('spectate');if(view)view.renderScale=1;
 if(view){if(trial.designCamera){view.cam=trial.designCamera.cam;view.off=trial.designCamera.off;}delete view.cam.frame;delete view.cam.far;}
 try{YardEngineClient.post({type:'trialEnd'});}catch(e){}
 trial.asset=null;trial.turrets=[];trial.launchers=[];trial.bolts=[];trial.missiles=[];trial.fx=[];trial.vbolts=[];trial.targets=[];trial.battle=null;trial.jump=null;trial.cine=null;
 const back=trial.returnTo,wasRts=!!trial.rts;trial.spectate=false;trial.returnTo=null;trial.battlePlan=null;trial.rts=null;trial.mode='trial';trial.foeCraft=[];trial.ownCraft=[];trial.foeMissiles=[];fleetPrune();renderPanel();renderSpecTargets();syncHud();requestDraw();if(back==='tactical')fleetSetMode('tactical');if(back==='voyage'||wasRts)voyPilotEnd();else if(back==='title')showTitle('voyage');
}
function trialAttitude(){
 const R=trial.R,f=trialCol(R,0),u=trialCol(R,1),r=trialCol(R,2),up=tv.norm(trial.P),north=[0,0,-1];
 let nt=tv.add(north,up,-tv.dot(north,up));nt=tv.len(nt)>1e-6?tv.norm(nt):[1,0,0];const et=tv.cross(nt,up),fh=tv.add(f,up,-tv.dot(f,up));
 const heading=((Math.atan2(tv.dot(fh,et),tv.dot(fh,nt))*180/Math.PI)%360+360)%360;
 return {f,u,r,up,pitch:Math.asin(C.clamp(tv.dot(f,up),-1,1)),bank:Math.atan2(-tv.dot(r,up),tv.dot(u,up)),heading,alt:tv.len(trial.P)-trialSys().planet.radius};
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
 // Engines push only as hard as the power distribution feeds them.
 const engines=trial.battle?C.fleetSystems(trial.battle.me).engine:1,f=trialCol(trial.R,0),sp=TRIAL_TELEGRAPH[trial.tele][1]*p.maxSpeed,vf=tv.dot(trial.V,f),acc=p.accel*engines*C.clamp(trial.engF??1,0,1),dv=C.clamp(sp-vf,-acc*dt,acc*dt);
 trial.thrustWant=p.accel>0&&dt>0?Math.min(1,Math.abs(sp-vf)/(p.accel*dt)):0;trial.thrust=p.accel>0&&dt>0?Math.abs(dv)/(p.accel*dt):0;
 const lat=tv.add(trial.V,f,-vf),damp=Math.exp(-dt/2.5);trial.V=tv.add(tv.scale(f,vf+dv),lat,damp);trial.vf=vf+dv;
 trial.P=tv.add(trial.P,trial.V,dt);trial.t+=dt;
 const up=tv.norm(trial.P),floor=trialSys().planet.radius+trialSys().floor;trial.warn='';
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
 for(const t of trial.targets){if(!t.alive)continue;const v=tv.sub(tv.sub(t.pos,trial.P),eye),d=tv.len(v),ang=Math.acos(C.clamp(tv.dot(v,dir)/d,-1,1)),cone=Math.atan((t.radius||trial.asset.geometry.targetRadius*1.6)/d)+.006;if(ang<cone&&ang<best){best=ang;lock=t;dist=d;}}
 return {eye,dir,dist,lock,point:tv.add(eye,dir,dist)};
}
// Time for a bolt leaving o at speed s (plus the ship's own velocity) to meet a
// target at p moving at u relative to the ship. Null when it cannot catch up.
function trialIntercept(d,u,s){const a=tv.dot(u,u)-s*s,b=2*tv.dot(d,u),c=tv.dot(d,d);if(Math.abs(a)<1e-6)return b<0?-c/b:null;const disc=b*b-4*a*c;if(disc<0)return null;const r=Math.sqrt(disc),t1=(-b-r)/(2*a),t2=(-b+r)/(2*a),t=Math.min(t1,t2)>0?Math.min(t1,t2):Math.max(t1,t2);return t>0?t:null;}
// The enemy a fixed battery stays on: the target under the reticle when there
// is one, else the last one held while it lives, else the nearest enemy.
function trialGunTarget(lk){
 if(lk)trial.gunTarget=lk;const g=trial.gunTarget;if(g&&g.alive&&trial.targets.includes(g))return g;
 let best=null,d=Infinity;for(const t of trial.targets){if(!t.alive)continue;const x=tv.len(tv.sub(t.pos,trial.P));if(x<d){d=x;best=t;}}
 trial.gunTarget=best;return best;
}
// ---- point defence ----
// Point-defence batteries leave ships to the main guns: each picks the nearest
// missile or small craft inside its range and arc (missiles first) and fires on
// its own. On a trial flight, target drones make passes at the ship.
const TRIAL_PD={range:6000,drones:4,speed:260,turn:1.15,pKill:{missile:.5,craft:.3},radius:{missile:30,craft:70}};
const trialPdColor=()=>trial.asset?.geometry?.paint==='republic'||trial.asset?.geometry?.reference==='venator'?[150,200,255]:[160,255,160];
// Only threats near enough to matter: a battle can put thousands of craft in the system.
function trialThreats(all){const out=[],P=trial.P,R=TRIAL_PD.range+(trial.p?.len||0),R2=all?Infinity:R*R;for(const l of [trial.drones,trial.foeCraft,trial.foeMissiles])for(const q of l||[]){if(!q.alive)continue;const x=q.pos[0]-P[0],y=q.pos[1]-P[1],z=q.pos[2]-P[2];if(x*x+y*y+z*z<R2)out.push(q);}return out;}
function trialPdPick(t,oW,threats){
 if(!threats.length||t.dead)return null;const lim=trialLimits(t),R=trial.R,base=tv.add(trial.P,oW);
 const reach=q=>{if(!q.alive)return -1;const rel=tv.sub(q.pos,base),d=tv.len(rel);if(d>TRIAL_PD.range)return -1;const dl=trialApplyT(R,tv.scale(rel,1/Math.max(1,d))),el=Math.asin(C.clamp(tv.dot(dl,t.axis),-1,1));if(el<lim.lo-.02||el>lim.hi+.02)return -1;if(lim.yaw!=null&&Math.abs(Math.atan2(tv.dot(dl,t.e2),tv.dot(dl,t.fw)))>lim.yaw)return -1;return d;};
 if(t.pdTarget&&reach(t.pdTarget)>=0)return t.pdTarget;
 let best=null,score=Infinity;for(const q of threats){const d=reach(q);if(d<0)continue;const s=d*(q.kind==='missile'?.5:1);if(s<score){score=s;best=q;}}
 return best;
}
function trialPdBoltHit(b){
 const q=b.target;if(!q||!q.alive||b.life<=0)return;const seg=tv.sub(b.pos,b.prev),l2=tv.dot(seg,seg)||1,k=C.clamp(tv.dot(tv.sub(q.pos,b.prev),seg)/l2,0,1),p=tv.add(b.prev,seg,k);
 if(tv.len(tv.sub(p,q.pos))>(TRIAL_PD.radius[q.kind]||40))return;b.life=0;
 if(Math.random()<(TRIAL_PD.pKill[q.kind]||.2))trialThreatDown(q,p);else trial.fx.push({pos:p,vel:q.vel,life:.15,max:.15,size:12,col:[255,220,160]});
}
function trialThreatDown(q,p){
 q.alive=false;q.respawn=6;trial.gun.pdKills=(trial.gun.pdKills||0)+1;if(q.onDown)q.onDown(q);const L=q.kind==='missile'?14:30;
 trial.fx.push({pos:p,vel:q.vel,life:.4,max:.4,size:L*2.4,col:[255,240,210]});
 for(let k=0;k<(q.kind==='missile'?6:14);k++)trial.fx.push({pos:p,vel:tv.add(q.vel,tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),40+Math.random()*120),life:.7,max:.7,size:L*.5,col:[255,170+(Math.random()*60|0),80]});
}
// Target drones alternate between a stand-off point 7–10 km out and a pass
// close down the ship's side; the points ride with the ship.
function trialDroneSpawn(i){
 const P=trial.P,up=tv.norm(P),f=trialCol(trial.R,0),r=tv.norm(tv.cross(f,up)),a=Math.random()*Math.PI*2,d=8000+Math.random()*3000;
 const pos=tv.add(tv.add(tv.add(P,f,Math.cos(a)*d),r,Math.sin(a)*d),up,(Math.random()-.5)*2400);
 return {id:'drone'+i,kind:'craft',pos,vel:[...trial.V],h:tv.norm(tv.sub(P,pos)),alive:true,run:false,way:null,wayT:0,respawn:0};
}
function trialDronesStep(dt){
 if(trial.mode!=='trial'||!trial.p){trial.drones=[];return;}const ds=trial.drones||(trial.drones=[]);
 while(ds.length<TRIAL_PD.drones)ds.push(trialDroneSpawn(ds.length));
 const P=trial.P,up=tv.norm(P),f=trialCol(trial.R,0),r=tv.norm(tv.cross(f,up)),L=trial.p.len,W=trial.p.width||L*.5,spd=Math.max(TRIAL_PD.speed,tv.len(trial.V)+220);
 for(let i=0;i<ds.length;i++){const d=ds[i];
  if(!d.alive){if((d.respawn-=dt)<=0)ds[i]=trialDroneSpawn(i);continue;}
  if(!d.way||(d.wayT-=dt)<=0||tv.len(tv.sub(tv.add(P,d.way),d.pos))<350){d.run=!d.run;
   if(d.run){const s=Math.random()<.5?-1:1;d.way=tv.add(tv.add(tv.scale(f,(Math.random()-.5)*L*1.2),r,s*(W*.5+400+Math.random()*700)),up,(Math.random()-.3)*L*.25);d.wayT=40;}
   else{const a=Math.random()*Math.PI*2,e=(Math.random()-.5)*.6;d.way=tv.add(tv.add(tv.scale(f,Math.cos(a)*8500),r,Math.sin(a)*8500),up,Math.sin(e)*4000);d.wayT=45;}}
  const want=tv.norm(tv.sub(tv.add(P,d.way),d.pos)),c=C.clamp(tv.dot(d.h,want),-1,1),ang=Math.acos(c);
  if(ang>1e-4){const ax=tv.cross(d.h,want),l=tv.len(ax);if(l>1e-9)d.h=tv.norm(trialRot(d.h,tv.scale(ax,1/l),Math.min(ang,TRIAL_PD.turn*dt)));}
  d.vel=tv.scale(d.h,spd);d.pos=tv.add(d.pos,d.vel,dt);
 }
}
// Weapons fire from stored energy (the turrets' charging banks); each volley
// draws its own charge. The reactor refills the store with whatever the power
// distribution leaves after the hotel load, shields and engines, so a ship at
// rest fires faster than one under full thrust. Weapon priority starves the
// engines instead; driving the reactor harder raises the core load.
function trialPowerStep(dt,want){
 const p=trial.p,g=p?.grid,en=trial.energy;if(!en)return;
 // A profile from before the power model keeps the old unlimited behaviour; a ship without a reactor never recharges.
 if(!g){en.E=en.cap;trial.engF=1;trial.power={load:0,engF:1,got:null,P:0};return;}if(!(g.P>0)){trial.engF=0;trial.power={load:0,engF:0,got:null,P:0};return;}
 const mode=trial.powerMode||'balanced',M=C.POWER_MODES[mode]||C.POWER_MODES.balanced;
 // In a battle the flagship's surviving reactors, generators, engines and guns set what can be fed.
 const me=trial.battle?.me,sx=me?C.fleetSystems(me):null,k=x=>sx?sx[x]:1,regen=!!me&&(me.shield<me.shieldMax*.999||me.underFire||(me.bank||0)<(me.bankMax||0)*.999),cap=en.cap*k('weapon');
 const Pr=g.P*k('reactor')*(1-C.COMBAT.ionReactor*(me?.ionK||0)),full=Math.min(Pr*C.COMBAT.engineCap,g.De*C.COMBAT.engineDraw)*k('engine');
 const demand={engines:full*(.06+.94*(trial.thrustWant||0)),shields:g.Ds*k('shield')*(regen?M.shields:1),weapons:Math.min(g.Dw*k('weapon')*M.weapons,want+Math.max(0,cap-en.E)*TT_J/Math.max(dt,1e-3))};
 if(me?.ionDrained){en.E=Math.max(0,en.E-me.ionDrained);me.ionDrained=0;}
 const P=Pr,got=C.powerSplit(P,g.fixed,demand,mode);en.E=Math.min(cap,en.E+got.weapons*dt/TT_J);
 if(me){me.load=P>0?got.load:0;const nom=g.Ds*k('shield');me.shF=nom>0?got.shields/nom:0;me.pw={P,eng:got.engines,sh:got.shields,wpn:got.weapons,wantEng:demand.engines,wantSh:demand.shields,wantWpn:demand.weapons};}
 trial.engF=demand.engines>0?C.clamp(got.engines/demand.engines,0,1):1;trial.power={load:got.load,engF:trial.engF,got,demand,P:g.P,mode};
}
const TT_J=4.184e21;
function trialGunnery(dt){
 const a=trial.aim=trialAim();if(!a)return;trialDronesStep(dt);const R=trial.R,center=trial.asset.geometry.center,me=trial.battle?.me,wantFire=(trial.fire||trial.fireKey||trial.fireTap>0)&&!trial.jump&&!me?.dead&&!me?.out;trial.fireTap=Math.max(0,trial.fireTap-dt);
 const color=trial.asset.geometry.reference==='venator'||trial.asset.geometry.paint==='republic'?[120,175,255]:[95,255,120],spd=TRIAL_GUN.boltSpeed;
 // Main batteries follow the gun mode; point defence keeps to its own threats.
 const mode=trial.gunMode||'free',home=mode==='home',lock=home?null:mode==='enemy'?trialGunTarget(a.lock):a.lock;trial.heldLock=mode==='enemy'?lock:null;
 const u=lock?tv.sub(lock.vel,trial.V):null,lockRel=lock?tv.sub(lock.pos,trial.P):null;
 // Lead for the ship's centre (HUD marker); each turret solves its own below.
 trial.lead=null;if(lock){const t=trialIntercept(lockRel,u,spd);if(t)trial.lead=tv.add(lockRel,u,t);}
 let demand=0;const threats=trialThreats();
 for(const t of trial.turrets){
  const oW=trialApply(R,tv.sub(t.origin,center)),lim=trialLimits(t);let ty=0,te=0;t.arc=true;t.pdTarget=null;
  if(t.pd){const q=trialPdPick(t,oW,threats);if(q){t.pdTarget=q;const rel=tv.sub(q.pos,trial.P),uv=tv.sub(q.vel,trial.V),tt=trialIntercept(tv.sub(rel,oW),uv,spd),aimW=tt?tv.add(rel,uv,tt):rel,dl=trialApplyT(R,tv.norm(tv.sub(aimW,oW)));ty=Math.atan2(tv.dot(dl,t.e2),tv.dot(dl,t.fw));te=Math.asin(C.clamp(tv.dot(dl,t.axis),-1,1));}}
  else if(!home){let aimW=a.point;
   if(lock){const tt=trialIntercept(tv.sub(lockRel,oW),u,spd);if(tt)aimW=tv.add(lockRel,u,tt);}
   const dl=trialApplyT(R,tv.norm(tv.sub(aimW,oW)));ty=Math.atan2(tv.dot(dl,t.e2),tv.dot(dl,t.fw));te=Math.asin(C.clamp(tv.dot(dl,t.axis),-1,1));}
  if(lim.yaw!=null&&Math.abs(ty)>lim.yaw){ty=Math.sign(ty)*lim.yaw;t.arc=false;}if(te<lim.lo||te>lim.hi){te=C.clamp(te,lim.lo,lim.hi);t.arc=false;}
  if(t.pd&&!t.pdTarget)t.arc=false;
  const sy=t.rateRad*dt,dy=trialWrap(ty-t.yaw);t.yaw=trialWrap(t.yaw+C.clamp(dy,-sy,sy));const se=t.rateRad*1.5*dt;t.el+=C.clamp(te-t.el,-se,se);
  if(t.mesh)trialAxisMatrix(t.axis,t.yaw,t.rot);
  const err=Math.max(Math.abs(trialWrap(ty-t.yaw)),Math.abs(te-t.el));t.aimed=t.arc&&err<.018;t.laid=t.arc&&err<.005;
  // Point defence slews fast after small targets, so it accepts an older line-of-fire check.
  const bd=trialBarrel(t,t.yaw,t.el),ok=t.clear&&t.clearDir&&tv.dot(bd,t.clearDir)>(t.pd?.995:.9986);t.ready=(t.pd?t.arc&&Math.max(Math.abs(trialWrap(ty-t.yaw)),Math.abs(te-t.el))<.03:t.aimed)&&ok&&t.charge>0&&!t.dead;
  // Point defence fires on its own at the threat it is tracking.
  t.firing=(t.pd?!!t.pdTarget&&!trial.jump&&!me?.dead&&!me?.out&&!(trial.battle?.result):wantFire)&&t.ready;if(t.firing)demand+=t.power*t.charge*(t.costK??1);t.bd=bd;t.oW=oW;
 }
 trialPowerStep(dt,demand);const en=trial.energy;
 for(const t of trial.turrets){
  t.reload=Math.max(0,t.reload-dt);t.starved=false;
  if(t.firing&&(t.laid||t.pd)&&t.reload<=0){
   const shotTT=t.power*t.cycle*t.charge/TT_J,cost=shotTT*(t.costK??1);if(en.E<cost){t.starved=true;continue;}en.E-=cost;
   t.reload=t.cycle*(1+Math.random()*.08);const bd=t.bd,n=Math.min(t.barrels,t.r>12?2:t.barrels>2?2:1),sc=t.pd?.009:.0012,g=()=>(Math.random()+Math.random()+Math.random()-1.5)*sc,bw=trialApply(R,tv.norm(tv.add(tv.add(bd,t.e2,g()),t.axis,g()))),side=trialApply(R,tv.norm(tv.cross(t.axis,bd))),base=tv.add(tv.add(trial.P,t.oW),bw,t.r*1.2),spread=t.r*.35;
   if(t.pd){trial.gun.pd=(trial.gun.pd||0)+t.barrels;for(let i=0;i<n;i++){const off=n>1?(i/(n-1)-.5)*spread:0,pos=tv.add(base,side,off);trial.bolts.push({pos,prev:pos,vel:tv.add(tv.scale(bw,spd),trial.V),life:TRIAL_PD.range*1.15/spd,len:Math.max(40,t.r*6),size:Math.max(3,t.r*.45),col:trialPdColor(),weight:0,tt:0,pd:true,target:t.pdTarget});}continue;}
   trial.gun.shots+=t.barrels;
   for(let i=0;i<n;i++){const off=n>1?(i/(n-1)-.5)*spread:0,pos=tv.add(base,side,off);trial.bolts.push({pos,prev:pos,vel:tv.add(tv.scale(bw,spd),trial.V),life:Math.max(t.reach||TRIAL_GUN.range,trial.p.len*(t.band==='close'?1.2:3))/spd,len:Math.max(70,t.r*9),size:Math.max(5,t.r*.9),col:t.ion?[170,215,255]:color,weight:t.barrels/n,tt:shotTT/n,ion:!!t.ion});}
   trial.fx.push({pos:base,vel:trial.V,life:.12,max:.12,size:Math.max(6,t.r*1.6),col:[255,240,210]});
  }
 }
 if(trial.bolts.length>TRIAL_GUN.maxBolts)trial.bolts.splice(0,trial.bolts.length-TRIAL_GUN.maxBolts);
 trialMissiles(dt,mode==='enemy'?lock:a.lock);
 const Rt=trial.asset.geometry.targetRadius,hitTarget=(t,q,w)=>{trial.gun.hits+=w;t.hits+=w;
   for(let k=0;k<6;k++)trial.fx.push({pos:q,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),40+Math.random()*120)),life:.5,max:.5,size:Rt*.18,col:[255,200,120]});
   if(t.hits>=TRIAL_GUN.hitsToKill){t.alive=false;t.respawn=4;trial.gun.kills++;for(let k=0;k<46;k++)trial.fx.push({pos:t.pos,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),Rt*(.6+Math.random()*2.2))),life:1.6,max:1.6,size:Rt*(.25+Math.random()*.4),col:[255,170+Math.random()*60|0,90]});trial.fx.push({pos:t.pos,vel:t.vel,life:.5,max:.5,size:Rt*4,col:[255,245,220]});}};
 const segHit=(t,a0,a1)=>{const seg=tv.sub(a1,a0),l2=tv.dot(seg,seg)||1,k=C.clamp(tv.dot(tv.sub(t.pos,a0),seg)/l2,0,1),q=tv.add(a0,seg,k);return tv.len(tv.sub(q,t.pos))<Rt?q:null;};
 // Ships are ellipsoids of their own length, height and width.
 const segShip=(t,a0,a1)=>{const s=t.semi,la=trialApplyT(t.rot,tv.sub(a0,t.pos)),lb=trialApplyT(t.rot,tv.sub(a1,t.pos)),pa=[la[0]/s[0],la[1]/s[1],la[2]/s[2]],pb=[lb[0]/s[0],lb[1]/s[1],lb[2]/s[2]],d=tv.sub(pb,pa),l2=tv.dot(d,d)||1,k=C.clamp(-tv.dot(pa,d)/l2,0,1);return tv.len(tv.add(pa,d,k))<1?tv.add(a0,tv.sub(a1,a0),k):null;};
 const shipHit=(t,q,tt,kind,w)=>{trial.gun.hits+=w;t.hits+=w;spaceDamage(t.unit,tt,kind,q,t);spaceImpact(q,t.vel,t.unit,Math.max(8,t.radius*.05));};
 for(const b of trial.bolts){b.prev=b.pos;b.pos=tv.add(b.pos,b.vel,dt);b.life-=dt;
  if(b.pd){trialPdBoltHit(b);continue;}
  for(const t of trial.targets){if(!t.alive||b.life<=0)continue;if(t.ship){const q=segShip(t,b.prev,b.pos);if(q){b.life=0;shipHit(t,q,b.tt||0,b.ion?'ion':'bolt',b.weight);}continue;}const q=segHit(t,b.prev,b.pos);if(q){b.life=0;hitTarget(t,q,b.weight);}}}
 for(const m of trial.missiles)for(const t of trial.targets){if(!t.alive||m.life<=0)continue;if(t.ship){const q=segShip(t,m.prev,m.pos);if(q){m.life=0;shipHit(t,q,10,'missile',m.weight);}continue;}const q=segHit(t,m.prev,m.pos);if(q){m.life=0;hitTarget(t,q,m.weight);for(let k=0;k<10;k++)trial.fx.push({pos:q,vel:tv.add(t.vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),60+Math.random()*200)),life:.8,max:.8,size:Rt*.3,col:[255,150,70]});}}
 trial.bolts=trial.bolts.filter(b=>b.life>0);trial.missiles=trial.missiles.filter(m=>{if(m.life<=0&&!m.burst){m.burst=true;}return m.life>0;});
 for(const t of trial.targets){if(t.ship)continue;if(t.alive){t.pos=tv.add(t.pos,t.vel,dt);t.spin+=dt*.3;const up=tv.norm(t.pos);t.rot=trialAxisMatrix(up,t.spin,t.rot);t.rot=trialFrame(trialApply(t.rot,[1,0,0]),up);}else if((t.respawn-=dt)<=0)Object.assign(t,trialSpawnTarget(t.id,false));}
 for(const e of trial.fx){e.pos=tv.add(e.pos,e.vel,dt);e.life-=dt;}trial.fx=trial.fx.filter(e=>e.life>0);if(trial.fx.length>3000)trial.fx.splice(0,trial.fx.length-3000);
 const due=performance.now();if(!trial.rays.busy&&due-trial.rays.last>140&&trial.turrets.length)trialRays(due);
}
// Missiles leave their tubes along the mounting axis, then home on the locked
// target with a limited turn rate; without a lock they fly down the reticle.
const TRIAL_MSL={launch:220,speed:2600,accel:650,turn:40*Math.PI/180,life:30,ripple:.14};
function trialMissiles(dt,lock){
 const R=trial.R,center=trial.asset.geometry.center;
 if(trial.mslOrder){trial.mslOrder=false;let n=0;for(const l of trial.launchers)if(l.reload<=0&&!l.dead&&spaceAmmo(l)){l.queue=l.salvo;l.reload=l.cycle;n++;}if(!n&&trial.launchers.length)toast(trial.launchers.every(l=>l.dead)?'ミサイル発射管はすべて破壊されています':'ミサイルは装填中か残弾がありません');}
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
 const b=trial.vbolts?.length?[...trial.bolts,...trial.vbolts.filter(x=>!(x.delay>0))]:trial.bolts,P=trial.P,K=7,pos=new Float32Array(b.length*K*3),col=new Uint8Array(b.length*K*4),size=new Float32Array(b.length*K);
 b.forEach((q,i)=>{const d=tv.norm(q.vel);for(let k=0;k<K;k++){const j=i*K+k,s=k/(K-1),p=tv.add(tv.sub(q.pos,P),d,-q.len*s);pos.set(p,j*3);col.set([q.col[0],q.col[1],q.col[2],Math.round(235*(1-s*.7))],j*4);size[j]=q.size*(1-s*.55);}});
 view.setPoints('trialBolts',pos,col,size);
 const f=trial.fx,ms0=trial.missiles,nf=f.length+ms0.length*2,fp=new Float32Array(nf*3),fc=new Uint8Array(nf*4),fs=new Float32Array(nf);
 f.forEach((e,i)=>{const k=e.life/e.max;fp.set(tv.sub(e.pos,P),i*3);fc.set([e.col[0],e.col[1],e.col[2],Math.round(255*Math.min(1,k*1.4)*(e.col[0]===150?.45:1))],i*4);fs[i]=e.size*(e.max>1?1.4-k*.6:e.col[0]===150?1.6-k*.8:1);});
 ms0.forEach((m,j)=>{const i=f.length+j*2;fp.set(tv.sub(m.pos,P),i*3);fc.set([255,235,190,255],i*4);fs[i]=7;fp.set(tv.add(tv.sub(m.pos,P),m.h,-14),i*3+3);fc.set([255,140,60,220],i*4+4);fs[i+1]=12;});
 view.setPoints('trialFx',fp,fc,fs);
 // Small craft and incoming missiles: a hull point and an engine glow behind it.
 const crafts=[...trialThreats(true),...(trial.ownCraft||[])],cp=new Float32Array(crafts.length*6),cc=new Uint8Array(crafts.length*8),cs=new Float32Array(crafts.length*2);
 crafts.forEach((q,i)=>{const h=q.h||tv.norm(q.vel),m=q.kind==='missile',body=tv.sub(q.pos,P);cp.set(body,i*6);cp.set(tv.add(body,h,m?-9:-7),i*6+3);cc.set(m?[255,225,190,255]:q.team===0?[205,230,255,255]:[225,228,232,255],i*8);cc.set(m?[255,120,60,230]:q.glow||[255,110,80,230],i*8+4);cs[i*2]=m?6:q.size||10;cs[i*2+1]=m?11:(q.size||10)*.8;});
 view.setPoints('trialCraft',cp,cc,cs);
}
// The turret status runs along the bottom edge between the throttle pad and the
// fire buttons. When it is too long for that band it switches to short labels,
// then wraps onto two lines; only where no band is wide enough (a phone held
// upright) does it go above the pad, and never into the middle of the screen,
// where it would cover the reticle: then it moves under the top bar instead.
let trialGunsLaidAt=0;
function trialGunsLayout(hud,gn,force){
 const now=performance.now();if(!force&&now-trialGunsLaidAt<400)return;trialGunsLaidAt=now;
 const hr=hud.getBoundingClientRect(),box=s=>{const e=hud.querySelector(s);if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return r.width?r:null;};
 const pad=box('.th-pad'),right=[box('.th-fire'),box('.th-msl')].filter(Boolean),keys=box('.th-keys'),top=box('.th-top');if(!pad||!hr.width)return;
 const lo=pad.right+10,hi=(right.length?Math.min(...right.map(r=>r.left)):hr.right)-10,gap=hi-lo;
 const fit=(compact,wrap)=>{gn.classList.toggle('compact',compact);Object.assign(gn.style,{width:wrap?Math.floor(wrap)+'px':'auto',maxWidth:'none',whiteSpace:wrap?'normal':'nowrap',flexWrap:wrap?'wrap':'nowrap'});return {w:gn.offsetWidth,h:gn.offsetHeight};};
 let m=fit(false,0),band=m.w<=gap;
 if(!band){m=fit(true,0);band=m.w<=gap;}
 if(!band&&gap>=170){m=fit(true,gap);band=m.h<=Math.max(44,pad.height*.6);}
 let x,bottom;const cy=hr.top+hr.height/2,clear=74;
 if(band){x=C.clamp(hr.left+hr.width/2,lo+m.w/2,hi-m.w/2);bottom=hr.bottom-pad.bottom+4;if(keys&&keys.left<x+m.w/2&&keys.right>x-m.w/2)bottom=hr.bottom-keys.top+6;}
 else{const wide=Math.min(hr.width-24,420);m=fit(true,wide);x=hr.left+hr.width/2;bottom=hr.bottom-pad.top+8;
  // Above the pad would reach the reticle: sit under the top bar instead.
  if(hr.bottom-bottom-m.h<cy+clear){const y=(top?top.bottom:hr.top+60)+6;bottom=hr.bottom-y-m.h;}}
 Object.assign(gn.style,{top:'auto',left:(x-hr.left).toFixed(0)+'px',bottom:bottom.toFixed(0)+'px'});
}
function trialCamera(dt){
 const a=trialAttitude();let F;
 if(trial.camMode==='ship')F=trial.R;
 else{let fh=tv.add(a.f,a.up,-tv.dot(a.f,a.up));if(tv.len(fh)<.25&&trial.camF){const old=trialCol(trial.camF,0);fh=tv.add(old,a.up,-tv.dot(old,a.up));}F=trialFrame(fh,a.up);}
 // While coasting out of the system and in the tunnel the camera keeps the frame it had.
 if(!trial.camF)trial.camF=[...F];else if(trialFast()||trial.jump?.phase==='tunnel'||(trial.spectate&&trial.specCam==='free')){}else{const k=1-Math.exp(-dt*4),x=tv.add(trialCol(trial.camF,0),tv.add(trialCol(F,0),trialCol(trial.camF,0),-1),k),y=tv.add(trialCol(trial.camF,1),tv.add(trialCol(F,1),trialCol(trial.camF,1),-1),k);trial.camF=trialFrame(x,y);}
 const c=view.cam;c.frame=trial.camF;c.ortho=false;
 // Joining a battle: the view turns once toward the nearest enemy.
 if(trial.lookAt){const t=trial.lookAt;trial.lookAt=null;const d=tv.norm(tv.sub(spaceWorld(t),trial.P)),loc=trialApplyT(trial.camF,d);c.ph=Math.acos(C.clamp(-loc[1],-1,1));c.th=Math.atan2(-loc[2],-loc[0]);}
 c.r=trialCamRange(c.r);c.ph=C.clamp(c.ph,.12,2.9);c.far=Math.max(90000,trial.p.len*30);const up=trialCol(trial.camF,1);c.target=tv.scale(up,c.r*TRIAL_CAM_LIFT);
 const k=trial.cine;if(k){const us=(trial.battle?.b.units||[]).filter(u=>k.ids.includes(u.id)&&!u.dead);if(!us.length)spaceCineEnd();else{const cw=us.reduce((a,u)=>tv.add(a,spaceWorld(u),1/us.length),[0,0,0]),loc=trialApplyT(trial.camF,k.dirW);c.target=tv.add(tv.sub(cw,trial.P),k.lead,-k.L*.6);c.r=k.r;c.ph=Math.acos(C.clamp(loc[1],-1,1));c.th=Math.atan2(loc[2],loc[0]);c.far=Math.max(c.far,k.r*14);}}
}
function trialLoop(now){
 // Paused, only the camera moves (for screenshots); the world and its clock stand still.
 const real=trial.last?Math.min(.05,(now-trial.last)/1000):0,dt=trial.paused?0:real;trial.last=now;
 if(trial.cine){trial.cine.t+=dt;if(trial.cine.t>=trial.cine.dur||trial.fire||trial.fireKey)spaceCineEnd();}
 trialCamera(real||.016);trialJumpStep(dt);
 // In hyperspace the ship holds still in the tunnel; everything else waits.
 const tunnel=trial.jump?.phase==='tunnel';
 if(dt>0&&!tunnel){if(trial.spectate)voySpectateStep(dt);else{if(trialCoasting())trialSublight(dt);else if(trial.jump?.phase==='exit')trialReversion();else{const n=dt>.025?2:1;for(let i=0;i<n;i++)trialStep(dt/n);}if(trial.rts)voyPilotStep(dt);else if(trial.battle)spaceStep(dt);}spaceBolts(dt);}
 trial.flash=Math.max(0,(trial.flash||0)-dt*3);trial.hitFlash=Math.max(0,(trial.hitFlash||0)-dt*1.6);
 const d=trial.dust,ds=trialDustStreaks();if(ds)view.setPoints('trialDust',new Float32Array(0),new Uint8Array(0),new Float32Array(0));else view.setPoints('trialDust',d.pos,d.col,d.size);trialRenderSets();
 const me=trial.battle?.me,unit={key:trial.asset.key,pos:[0,0,0],yaw:0,rot:trial.R,glow:me?.out?0:.3+.7*Math.min(1,Math.max(Math.abs(TRIAL_TELEGRAPH[trial.tele][1]),trial.thrust)),hatchOpen:0,dead:!!me?.dead,
  turrets:trial.turrets.filter(t=>t.mesh).map(t=>({mesh:t.mesh,pivot:t.pivot,rot:t.rot})),targets:trial.targets.filter(t=>t.alive&&!t.ship).map(t=>({pos:tv.sub(t.pos,trial.P),rot:t.rot}))};
 // Reverting to realspace: seen from the front quarter, the ship arrives as a streak.
 const j=trial.jump;
 const hyper=tunnel?{dir:trialCol(trial.R,0),time:j.t,k:Math.min(1,j.t*3,(j.tunnel-j.t)*3+.2)}:null,s=trialStreak(),streaks=(s>0||ds)&&trialStreakLines(s,j?.dir||trialCol(trial.R,0),ds);
 if(view.draw({fleet:trial.spectate?spaceDrawUnits():[unit,...spaceDrawUnits()],mode:'trial',lod:!!trial.battle,planet:hyper?null:trialPlanet(),hyper,streaks,noStars:s>.3})!==false){renderHealth.frames++;renderHealth.lastFrame=now;renderHealth.failures=0;}
 trialAdaptScale(real);
 const hud=$('#trialHud'),fl=hud?.querySelector('[data-th="flash"]'),hf=hud?.querySelector('[data-th="hit"]');if(fl)fl.style.opacity=trial.flash.toFixed(3);if(hf)hf.style.opacity=(trial.hitFlash*.8).toFixed(3);
 trialMarkers();if(trial.battle)hitcamStep(now);
 if(now-trial.hud>120){trial.hud=now;if(trial.spectate)voySpectateHudUpdate();else trialHudUpdate();}
}
// A busy battle that drops frames is drawn at a lower resolution, and the
// resolution comes back once the frame rate recovers.
function trialAdaptScale(real){
 if(!view||!(real>0))return;trial.frameMs=trial.frameMs?trial.frameMs*.92+real*1000*.08:real*1000;const now=performance.now();if(now-(trial.scaleAt||0)<1200)return;
 const rs=view.renderScale||1;if(trial.frameMs>40&&rs>.5){view.renderScale=Math.max(.5,rs-.15);trial.scaleAt=now;}else if(trial.frameMs<22&&rs<1){view.renderScale=Math.min(1,rs+.1);trial.scaleAt=now+1800;}
}
// Brackets over the target buoys and, in a battle, over every other ship (with
// its shield and hull bars), as in a naval HUD; off-screen ones are hidden.
const shipShort=n=>String(n||'').split('｜')[0];
function trialMarkers(){
 const hud=$('#trialHud'),box=hud?.querySelector('.th-tmarks');if(!box||!view)return;const rect=view.canvas.getBoundingClientRect(),hr=hud.getBoundingClientRect(),eye=view.eye(),B=trial.battle,items=[],seen=new Set();
 if(trial.jump?.phase!=='tunnel'){
  for(const t of trial.targets)if(t.alive&&!t.ship)items.push({id:'d'+t.id,pos:t.pos,cls:'',t});
  if(B&&!B.left)for(const u of B.b.units){if(u.manual||u.dead||u.absent||u.hidden)continue;items.push({id:'u'+u.id,pos:spaceWorld(u),cls:u.team?'foe':'ally',u,t:trial.targets.find(x=>x.unit===u)});}}
 // Every bracket is drawn; the names go to the nearest and the marked ones
 // first, each on the right or else the left of its bracket, and a name that
 // would lie over another is left out (its bracket stays).
 const vis=[],follow=B?.spectate?B.follow:null,small=rect.width<720||rect.height<480,fs=small?9.5:11,maxLab=small?8:16;
 for(const it of items){let el=box.querySelector(`[data-tmark="${it.id}"]`);if(!el){el=document.createElement('div');el.className='th-tmark';el.dataset.tmark=it.id;el.innerHTML='<i></i><b></b><s><em class="sh"></em><em class="hp"></em></s>';box.append(el);}
  seen.add(it.id);const rel=tv.sub(it.pos,trial.P),q=view.project(rel),on=q[2]>-1&&q[2]<1&&q[0]>rect.left&&q[0]<rect.right&&q[1]>rect.top&&q[1]<rect.bottom;el.hidden=!on;if(!on)continue;
  const x=q[0]-hr.left,y=q[1]-hr.top,d=tv.len(tv.sub(rel,eye)),u=it.u,km=d/1000,dist=km<10?km.toFixed(1):Math.round(km)+'',lock=!!(it.t&&(trial.aim?.lock===it.t||trial.heldLock===it.t));
  const lab=u?`${u.team?'敵':'友'} ${shipTag(u.name)} · ${dist} km${u.out?' · 戦闘不能':''}`:`標的 ${dist} km${it.t.hits?' · '+Math.round(it.t.hits/TRIAL_GUN.hitsToKill*100)+'%':''}`;
  vis.push({el,it,x,y,lab,lock,pri:lock||(u&&u.id===follow)?-1:d});}
 vis.sort((a,b)=>a.pri-b.pri);const placed=[],hit=r=>placed.some(p=>r[0]<p[2]&&r[2]>p[0]&&r[1]<p[3]&&r[3]>p[1]);let nLab=0;
 for(const v of vis){const {el,it,x,y,lab,lock}=v,u=it.u;el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  let side='';if(!lock){const w=Math.max(textWidthEst(lab,fs)+4,u?(small?48:64):0),top=y-7,bot=y+(u?12:7);const R=[x+15,top,x+15+w,bot],L=[x-15-w,top,x-15,bot];if(nLab>=maxLab)side=' nl';else if(!hit(R)){placed.push(R);nLab++;}else if(x-15-w>0&&!hit(L)){placed.push(L);nLab++;side=' lf';}else side=' nl';}
  placed.push([x-13,y-13,x+13,y+13]);
  const cls='th-tmark '+it.cls+(lock?' lock':'')+(u?.out?' out':'')+side;if(el.className!==cls)el.className=cls;
  const lb=el.querySelector('b');if(lb.textContent!==lab)lb.textContent=lab;
  if(u){const sh=el.querySelector('.sh'),hp=el.querySelector('.hp');sh.style.width=(u.shieldMax>0?C.clamp(u.shield/u.shieldMax,0,1)*100:0).toFixed(0)+'%';hp.style.width=(C.clamp(u.sec?Rts.unitStruct(u):u.hp/u.p.hp,0,1)*100).toFixed(0)+'%';}}
 for(const el of box.querySelectorAll('[data-tmark]'))if(!seen.has(el.dataset.tmark))el.hidden=true;
}
// A ship's name as a bracket label: the class without its type ("ドレッドノート級 8").
const shipTag=n=>shipShort(n).replace(/級[^\s\d]+(?=\s*\d)/,'級');
// Rough width of a line of HUD text (CJK a full em, the rest a little over half).
function textWidthEst(s,fs){let w=0;for(const ch of s){const c=ch.codePointAt(0);w+=c>0x2e80?fs:c===32?fs*.3:fs*.58;}return w;}
// ---- penetration replay: an X-ray of the struck ship (War Thunder style) ----
// A record from the combat model (C.combatResolve → u.hitLog) is replayed as a
// short animation: the shot comes in on the face it struck, meets the armour
// (its thickness, and whether it held), then runs through the modules behind
// it, each marked as it is damaged or wrecked; a fire or a detonation ends it.
const HITCAM_DUR=3.6,HITCAM_COL={reactor:'#ffb347',shield:'#6fe3ff',engine:'#7fb2ff',hyper:'#c49bff',hangar:'#8fd18a',battery:'#ffd966',fuel:'#ff8c5a',quarters:'#d8c8ab',bridge:'#ffffff',fire:'#f3e38a',capacitor:'#ffcf6b',weapon:'#b8c4cc',launcher:'#ff9f7a',other:'#8a96a0'};
const hitcamMasks=new WeakMap();
// The silhouette of a profile in one view as a small canvas (lit cells), or null.
function hitcamMask(p,view){
 let m=hitcamMasks.get(p);if(!m)hitcamMasks.set(p,m={});if(view in m)return m[view];
 const o=p.outline;if(!o){m[view]=null;return null;}const w=o.nx,h=view==='top'?o.nz:o.ny,bits=C.unpackBits(view==='top'?o.top:o.side,w*h);
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;const g=cv.getContext('2d'),img=g.createImageData(w,h);
 const on=(i,j)=>i>=0&&i<w&&j>=0&&j<h&&bits[j*w+i];
 for(let j=0;j<h;j++)for(let i=0;i<w;i++){if(!bits[j*w+i])continue;const row=view==='top'?j:h-1-j,k=(row*w+i)*4,edge=!on(i-1,j)||!on(i+1,j)||!on(i,j-1)||!on(i,j+1);img.data[k]=edge?170:96;img.data[k+1]=edge?220:160;img.data[k+2]=edge?255:205;img.data[k+3]=edge?235:120;}
 g.putImageData(img,0,0);m[view]={cv,w,h,bits};return m[view];
}
// The first lit cell met coming in from one side of the mask (cell units), for the entry point.
function hitcamEdge(mk,view,f,at,cross){
 const {w,h,bits}=mk,lit=(i,j)=>i>=0&&i<w&&j>=0&&j<h&&bits[j*w+i];
 if(f===0||f===1){const j=Math.round(((cross+1)/2)*(h-1));for(let s=0;s<w;s++){const i=f===0?w-1-s:s;if(lit(i,j))return [i+(f===0?1:0),j+.5];}return [f===0?w:0,j+.5];}
 const i=Math.round(at*(w-1));
 if(view==='top'){for(let s=0;s<h;s++){const j=f===2?h-1-s:s;if(lit(i,j))return [i+.5,j+(f===2?1:0)];}return [i+.5,f===2?h:0];}
 for(let s=0;s<h;s++){const j=f===4?h-1-s:s;if(lit(i,j))return [i+.5,h-(j+(f===4?1:0))];}return [i+.5,f===4?0:h];
}
const hitcamEase=x=>x<0?0:x>1?1:x*x*(3-2*x);
// Draws record rec on target profile p into a 2D context at progress k (0…1).
function hitcamDraw(g,W,H,p,rec,k,o={}){
 g.clearRect(0,0,W,H);g.fillStyle='rgba(6,11,16,.9)';g.fillRect(0,0,W,H);g.strokeStyle='rgba(120,190,230,.35)';g.lineWidth=1;g.strokeRect(.5,.5,W-1,H-1);
 const f=rec.face,view=f>=4?'side':'top',mk=hitcamMask(p,view),fz=Math.max(9,Math.min(12,W/32)),font=`600 ${fz}px `+(getComputedStyle(document.body).fontFamily||'sans-serif');
 g.font=font;g.textBaseline='top';g.fillStyle='#9fd6ff';g.fillText(o.title||'被弾リプレイ',8,6);
 if(o.sub){g.fillStyle='#c9d3da';g.textAlign='right';g.fillText(o.sub,W-8,6);g.textAlign='left';}
 const top=fz+12,bot=fz*2+16,bw=W-24,bh=H-top-bot,asp=mk?mk.w/mk.h:(view==='top'?2.4:4),box=bw/bh>asp?{w:bh*asp,h:bh}:{w:bw,h:bw/asp};box.x=(W-box.w)/2;box.y=top+(bh-box.h)/2;
 const cuts=p.sectionCuts||[.2,.4,.6,.8],si=rec.sec,a0=si>0?cuts[si-1]:0,a1=si<cuts.length?cuts[si]:1;
 // Hull silhouette, the struck section lit.
 g.save();g.imageSmoothingEnabled=true;if(mk){g.globalAlpha=.55;g.drawImage(mk.cv,box.x,box.y,box.w,box.h);g.globalAlpha=1;g.save();g.beginPath();g.rect(box.x+a0*box.w,box.y-2,(a1-a0)*box.w,box.h+4);g.clip();g.globalAlpha=.55;g.drawImage(mk.cv,box.x,box.y,box.w,box.h);g.restore();}
 else{g.fillStyle='rgba(110,176,220,.35)';g.beginPath();g.ellipse(box.x+box.w/2,box.y+box.h/2,box.w/2,box.h/2,0,0,Math.PI*2);g.fill();}g.restore();
 g.strokeStyle='rgba(150,200,230,.22)';g.setLineDash([3,4]);for(const c of cuts){const x=box.x+c*box.w;g.beginPath();g.moveTo(x,box.y-3);g.lineTo(x,box.y+box.h+3);g.stroke();}g.setLineDash([]);
 g.fillStyle='rgba(160,200,225,.6)';g.font=`600 ${fz*.85}px `+font.split('px ')[1];g.fillText('艦首 ▶',box.x+box.w-fz*3.3,box.y+box.h+3);g.font=font;
 const P=(at,y,z)=>[box.x+at*box.w,view==='top'?box.y+(z+1)/2*box.h:box.y+(1-(y+1)/2)*box.h];
 // Every module faintly; the struck section's brighter.
 const mods=p.modules||[],hitIdx=new Map(rec.path.map((s,n)=>[s.i,n]));
 for(let i=0;i<mods.length;i++){const m=mods[i];if(m.k==='hull'||hitIdx.has(i))continue;const [x,y]=P(m.at??.5,m.y??0,m.z??0),r=Math.max(1.2,Math.min(8,(m.r||.004)*box.w)),inSec=(m.at??.5)>=a0&&(m.at??.5)<=a1;g.globalAlpha=inSec?.55:.22;g.fillStyle=HITCAM_COL[m.k]||HITCAM_COL.other;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}
 g.globalAlpha=1;
 // The shot: from outside onto the face, then through the modules on its path.
 const first=rec.path[0],at0=first?.at??(a0+a1)/2,cross0=f===0||f===1?(view==='top'?first?.z??0:first?.y??0):0;
 const edge=mk?hitcamEdge(mk,view,f,at0,cross0):null,E=edge?[box.x+edge[0]/mk.w*box.w,box.y+edge[1]/mk.h*box.h]:P(at0,f===4?1:f===5?-1:0,f===2?1:f===3?-1:0);
 const dir=f===0?[-1,0]:f===1?[1,0]:f===2||f===5?[0,-1]:[0,1],from=[E[0]-dir[0]*Math.max(36,box.h*.5)+(f>=2?-dir[1]*14:0),E[1]-dir[1]*Math.max(36,box.h*.5)];
 const pts=[E,...rec.path.map(s=>P(s.at,s.y,s.z))],segs=[];let tot=0;for(let n=1;n<pts.length;n++){const l=Math.hypot(pts[n][0]-pts[n-1][0],pts[n][1]-pts[n-1][1]);segs.push(l);tot+=l;}
 const kIn=hitcamEase(k/.18),kRun=hitcamEase((k-.2)/.5),kEnd=(k-.72)/.28;
 g.lineCap='round';
 // incoming tracer
 const tip=[from[0]+(E[0]-from[0])*kIn,from[1]+(E[1]-from[1])*kIn];g.strokeStyle='rgba(255,140,90,.9)';g.lineWidth=2.4;g.beginPath();g.moveTo(from[0],from[1]);g.lineTo(tip[0],tip[1]);g.stroke();
 // armour at the impact: a plate drawn across the entry point
 if(k>=.18){const pen=rec.path.length>0,n=[dir[1],-dir[0]],L=Math.max(10,box.h*.16);g.strokeStyle=pen?'#ff6a4a':'#9fd6ff';g.lineWidth=3.2;g.beginPath();g.moveTo(E[0]+n[0]*L/2,E[1]+n[1]*L/2);g.lineTo(E[0]-n[0]*L/2,E[1]-n[1]*L/2);g.stroke();
  const fl=Math.max(0,1-(k-.18)/.12);if(fl>0){g.fillStyle=`rgba(255,230,180,${fl})`;g.beginPath();g.arc(E[0],E[1],6+10*(1-fl),0,Math.PI*2);g.fill();}}
 // the penetrator inside
 if(k>.2&&tot>0){let left=kRun*tot;g.strokeStyle='rgba(255,90,60,.95)';g.lineWidth=2;g.beginPath();g.moveTo(E[0],E[1]);for(let n=1;n<pts.length&&left>0;n++){const l=segs[n-1],q=Math.min(1,left/l);g.lineTo(pts[n-1][0]+(pts[n][0]-pts[n-1][0])*q,pts[n-1][1]+(pts[n][1]-pts[n-1][1])*q);left-=l;}g.stroke();}
 // modules on the path, coloured by what happened to them once reached
 const labels=[];let acc=0;
 rec.path.forEach((s,n)=>{acc+=segs[n]||0;const reached=tot>0?kRun*tot>=acc-1e-6:k>.4,m=mods[s.i]||{},[x,y]=P(s.at,s.y,s.z),r=Math.max(3,Math.min(12,(m.r||.006)*box.w)),wrecked=s.after<=0&&s.before>0;
  g.fillStyle=HITCAM_COL[s.k]||HITCAM_COL.other;g.globalAlpha=reached?1:.7;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.globalAlpha=1;
  if(reached){g.strokeStyle=wrecked?'#ff3b30':'#ffb347';g.lineWidth=2;g.beginPath();g.arc(x,y,r+2.5,0,Math.PI*2);g.stroke();if(wrecked){g.beginPath();g.moveTo(x-r,y-r);g.lineTo(x+r,y+r);g.moveTo(x+r,y-r);g.lineTo(x-r,y+r);g.stroke();}
   labels.push({x,y,r,text:`${s.name} ${wrecked?'破壊':s.before<=0?'（既に破壊）':Math.round(s.before*100)+'→'+Math.round(Math.max(0,s.after)*100)+'%'}`,bad:wrecked});}});
 // fire and detonation at the end
 if(kEnd>0){const last=pts[pts.length-1];if(rec.boom){const R=10+kEnd*Math.max(30,box.h*.45);g.strokeStyle=`rgba(255,200,120,${1-kEnd})`;g.lineWidth=3;g.beginPath();g.arc(last[0],last[1],R,0,Math.PI*2);g.stroke();}
  if(rec.fire||rec.boom){const t=performance.now()/120;for(let q=0;q<3;q++){const x=last[0]+(q-1)*7,h=9+4*Math.sin(t+q*2);g.fillStyle=q===1?'#ffd25a':'#ff7a2e';g.beginPath();g.moveTo(x-4,last[1]+4);g.quadraticCurveTo(x-5,last[1]-h*.4,x,last[1]-h);g.quadraticCurveTo(x+5,last[1]-h*.4,x+4,last[1]+4);g.closePath();g.fill();}}}
 // labels beside their modules, kept apart
 g.font=`600 ${fz*.92}px `+font.split('px ')[1];const used=[];
 for(const L of labels){const w=textWidthEst(L.text,fz*.92)+6;let lx=L.x+L.r+5,ly=L.y-fz*.5;if(lx+w>W-4)lx=L.x-L.r-5-w;for(const u of used)if(lx<u[2]&&lx+w>u[0]&&ly<u[3]&&ly+fz>u[1])ly=u[3]+1;used.push([lx,ly,lx+w,ly+fz]);g.fillStyle='rgba(6,11,16,.75)';g.fillRect(lx-2,ly-1,w,fz+2);g.fillStyle=L.bad?'#ff8a7a':'#ffd7a0';g.fillText(L.text,lx+1,ly);}
 // caption
 g.font=font;g.fillStyle='#dfe7ec';const pen=rec.path.length>0,face=C.COMBAT_FACE[f]||'',secN=C.SECTION_NAMES[si]||'';
 g.fillText(`${face} ${secN}　装甲 ${(+rec.thick||0).toFixed(2)} m${k>=.18?(pen?' → 貫通':' → 非貫通'):''}`,8,H-bot+4);
 if(kEnd>0||k>.6){const lost=rec.path.filter(s=>s.after<=0&&s.before>0).map(s=>s.name),tail=[lost.length?lost.slice(0,2).join('・')+' 破壊':rec.path.length?'損傷':'',rec.boom?{reactor:'炉心誘爆',fuel:'反応物誘爆',magazine:'弾薬庫誘爆'}[rec.boom]||'誘爆':'',rec.fire?'火災発生':''].filter(Boolean).join(' · ');g.fillStyle=rec.boom||lost.length?'#ff9f8a':'#c9d3da';g.fillText(tail||'区画構造に損傷',8,H-bot+4+fz+3);}
}
// Queue of replays for the 3D view: what the piloted (or followed) ship takes
// and deals. Notable hits (a module wrecked, a fire, a detonation) go first;
// the rest only when nothing has been shown for a while.
function hitcamNotable(rec){return !!(rec.boom||rec.fire||rec.path.some(s=>s.after<=0&&s.before>0));}
function hitcamOffer(u,rec,role){
 const H=trial.hitcam||(trial.hitcam={queue:[],cur:null,at:0,last:0});const now=performance.now(),notable=hitcamNotable(rec);
 if(!notable&&now-H.last<6000&&H.cur)return;
 H.queue.push({u,p:u.p,rec,role,at:now,notable});H.queue.sort((a,b)=>(b.notable-a.notable)||(b.at-a.at));if(H.queue.length>4)H.queue.length=4;
}
function hitcamStep(now){
 const hud=$('#trialHud'),el=hud?.querySelector('[data-th="hitcam"]'),H=trial.hitcam;if(!el)return;const show=on=>{if(el.hidden===on)el.hidden=!on;hud.classList.toggle('hc-on',on);};if(!H){show(false);return;}
 if(H.cur&&now-H.at>HITCAM_DUR*1000+500)H.cur=null;
 if(!H.cur){H.queue=H.queue.filter(q=>now-q.at<5000);const q=H.queue.shift();if(q){H.cur=q;H.at=now;H.last=now;}}
 if(!H.cur){show(false);return;}
 show(true);const cv=el.querySelector('canvas'),r=cv.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1),W=Math.max(1,Math.round(r.width*d)),Hh=Math.max(1,Math.round(r.height*d));if(cv.width!==W||cv.height!==Hh){cv.width=W;cv.height=Hh;}
 const g=cv.getContext('2d');g.setTransform(d,0,0,d,0,0);const q=H.cur,k=Math.min(1,(now-H.at)/(HITCAM_DUR*1000)),B=trial.battle,src=q.rec.src!=null?B?.b.units.find(x=>String(x.id)===String(q.rec.src)):null;
 const title=q.role==='taken'?`被弾 · ${shipTag(q.u.name)}`:`命中 · ${shipTag(q.u.name)}`,sub=src?`${src.team!==q.u.team&&src.team?'敵 ':''}${shipTag(src.name)} から`:'';
 hitcamDraw(g,r.width,r.height,q.p,q.rec,k,{title,sub});
}
// ---- HUD ----
function trialHudHTML(){
 return `<div class="th-top"><div class="th-card th-bar"><div class="th-id"><b>${esc(trial.p?.name||ship?.name||'設計艦')}</b><small><span data-th="where">${trialWhere()}</span> <span data-th="clock">T+0:00</span></small></div>
 <dl class="th-read"><div><dt>速力</dt><dd data-th="speed">0</dd></div><div><dt>方位</dt><dd data-th="head">090°</dd></div><div><dt>高度</dt><dd data-th="alt">160 km</dd></div><div class="th-att"><dt>仰角</dt><dd data-th="pitch">0.0°</dd></div><div class="th-att"><dt>傾斜</dt><dd data-th="bank">0.0°</dd></div></dl></div>
 <div class="th-actions">${trial.rts?'':'<button type="button" class="th-btn th-mapbtn" data-trial-cmd="map" aria-expanded="false" aria-controls="thMap" aria-label="星図とハイパードライブ">星図</button>'}<button type="button" class="th-btn th-pw" data-trial-cmd="power" data-th="pwbtn" aria-expanded="false" aria-controls="thPower" aria-label="出力配分">⚡ ${(C.POWER_MODES[trial.powerMode]||C.POWER_MODES.balanced).name}</button><button type="button" class="th-btn th-more" data-trial-cmd="menu" aria-expanded="false" aria-controls="thMenu" aria-label="その他の操作">⋯</button>
 <div class="th-card th-menu th-power" id="thPower" hidden><p class="th-power-head">出力配分 <kbd>P</kbd></p>${Object.entries(C.POWER_MODES).map(([k,m])=>`<button type="button" class="th-btn th-pmode" data-trial-cmd="pmode:${k}" aria-pressed="${(trial.powerMode||'balanced')===k}"><b>${m.name}</b><small>${esc(m.note)}</small></button>`).join('')}</div><button type="button" class="th-btn th-exit" data-trial-cmd="exit">${trial.rts?'戦術図へ':trial.mode==='battle'?'戦闘終了':trial.returnTo==='title'?'帰還':'公試終了'}</button>
 <div class="th-card th-menu th-map" id="thMap" hidden></div>
 <div class="th-card th-menu" id="thMenu" hidden><button type="button" class="th-btn" data-trial-cmd="cam" data-th="cam">視点 水平</button><button type="button" class="th-btn" data-trial-cmd="gunmode" data-th="gunmenu">主砲 ${GUN_MODES[trial.gunMode||'free'].name} <kbd>G</kbd></button><button type="button" class="th-btn" data-trial-cmd="shot">スクリーンショット <kbd>H</kbd></button><button type="button" class="th-btn" data-trial-cmd="level">水平復帰 <kbd>Z</kbd></button><button type="button" class="th-btn" data-trial-cmd="center">舵中央 <kbd>X</kbd></button><button type="button" class="th-btn" data-trial-cmd="records" data-th="recbtn">記録を表示</button><button type="button" class="th-btn" data-trial-cmd="reset">再開始</button></div></div></div>
 <div class="th-flash" data-th="flash" aria-hidden="true"></div>${trial.mode==='battle'?'<div class="th-cine" aria-hidden="true"><i class="bar top"></i><i class="bar bot"></i><b>敵艦隊　ハイパースペースより出現</b></div>':''}<div class="th-hit" data-th="hit" aria-hidden="true"></div>
 <p class="th-records" data-th="records"></p><p class="th-warn" data-th="warn" hidden></p><p class="th-hyper" data-th="hyper" hidden aria-live="polite"></p>
 ${trial.mode==='battle'?'<div class="th-card th-self" data-th="self"></div><div class="th-hitcam" data-th="hitcam" hidden><canvas></canvas></div>':''}<div class="th-result" data-th="result" hidden></div>
 <div class="th-reticle" aria-hidden="true"><i class="h"></i><i class="v"></i><b data-th="range">20.0 km</b></div>
 <div class="th-guns" data-th="guns" aria-live="off"><button type="button" class="th-gmode" data-trial-cmd="gunmode" data-th="gunmode" title="主砲の照準方式（G で切替）"><em class="l">主砲 ${GUN_MODES[trial.gunMode||'free'].name}</em><em class="s">${GUN_MODES[trial.gunMode||'free'].short}</em></button><span class="th-gstat" data-th="gunstat"></span></div><div class="th-tmarks" aria-hidden="true"></div>
 <div class="th-card th-pad"><div class="th-tele-ladder" aria-label="速力通信機">${TRIAL_TELEGRAPH.map((t,i)=>`<span data-tele="${i}">${t[0]}</span>`).reverse().join('')}</div><div class="th-tele-bar" aria-hidden="true"><i data-th="speedbar"></i></div>
  <div class="th-dpad"><button type="button" class="th-arrow up" data-trial-cmd="tele+" aria-label="増速">▲</button><button type="button" class="th-arrow left" data-trial-cmd="rudder-" aria-label="取舵">◀</button><b class="th-dmid" data-th="tele">停止</b><button type="button" class="th-arrow right" data-trial-cmd="rudder+" aria-label="面舵">▶</button><button type="button" class="th-arrow down" data-trial-cmd="tele-" aria-label="減速">▼</button></div>
  <div class="th-rudder"><div class="th-gauge" data-th-row="rudder" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><i class="ord"></i><i class="act"></i></div><b class="th-order" data-th="rudder">舵中央</b></div></div>
 <div class="th-stick" data-th-stick role="slider" aria-label="ピッチとロール" aria-valuetext="中立"><span class="lab up">上げ</span><span class="lab down">下げ</span><span class="lab left">左</span><span class="lab right">右</span><i class="knob"></i></div>
 <button type="button" class="th-btn th-level" data-trial-cmd="level">水平</button>
 <button type="button" class="th-fire" data-th-fire aria-label="射撃">射撃<small>Space</small></button>
 <button type="button" class="th-msl" data-trial-cmd="missile" data-th="msl" aria-label="ミサイル発射" ${trial.launchers.length?'':'disabled'}>ミサイル<small data-th="mslstate">${trial.launchers.length?trial.launchers.length*8+' 発':'発射管なし'}</small></button>
 <i class="th-lead" data-th="lead" hidden aria-hidden="true"></i>
 <p class="th-keys">W/S 速力 · A/D 舵 · R/F 上げ下げ · Q/E ロール · Space 射撃 · M ミサイル · G 主砲照準 · P 出力配分 · J 星図 · H スクリーンショット · Z 水平復帰 · X 舵中央 · V 視点 · ドラッグで照準 · ホイールで距離</p>`;
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
 set('speed',v>=1e5?`${num(Math.round(v/1000))} km/s`:`${num(Math.round(v))} m/s`);set('head',String(Math.round(a.heading)%360).padStart(3,'0')+'°');set('alt',`${(a.alt/1000).toFixed(1)} km`);
 set('pitch',`${deg(a.pitch)>=0?'+':''}${deg(a.pitch).toFixed(1)}°`);const b=deg(a.bank);set('bank',Math.abs(b)<.05?'0.0°':`${b>0?'右':'左'} ${Math.abs(b).toFixed(1)}°`);
 set('where',trialWhere());trialSelfUpdate(hud);trialHyperUpdate(hud);
 const s=Math.floor(trial.t);set('clock',`T+${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`);set('cam',trial.camMode==='ship'?'視点 追従':'視点 水平');
 const r=trial.rec,g=trial.gun;const B=trial.battle;if(B){const foes=B.b.units.filter(u=>u.team===1),up=foes.filter(u=>!u.dead&&!u.out&&!u.absent).length,last=B.ticker[B.ticker.length-1];set('records',`戦況　敵 ${up}/${foes.length} 隻 · 撃沈 ${foes.filter(u=>u.dead).length} · 戦闘不能 ${foes.filter(u=>!u.dead&&u.out).length} · 射撃 ${num(g.shots)} 発 / 命中 ${num(Math.round(g.hits))}${last?' ｜ '+last.text:''}`);}else set('records',`公試記録　最高速力 ${num(Math.round(r.top))} m/s · 0→全速 ${r.accel==null?(r.run?'計測中…':'—'):Math.round(r.accel)+' 秒'} · 全舵旋回径 ${r.turn==null?'—':(r.turn/1000).toFixed(1)+' km'} · 射撃 ${num(g.shots)} 発${g.missiles?` · ミサイル ${num(g.missiles)} 発`:''} / 命中 ${num(Math.round(g.hits))} / 撃破 ${g.kills}${g.pdKills?` · 点防御 撃墜 ${g.pdKills}`:''}`);
 const rp=q('records');if(rp)rp.hidden=!trialRecordsOn();set('recbtn',trialRecordsOn()?'記録を隠す':'記録を表示');
 const w=q('warn');if(w){const hint=trialArcHint(),txt=trial.warn||(trial.level?'姿勢を水平に戻しています…':'')||hint;w.hidden=!txt;if(w.textContent!==txt)w.textContent=txt;}
 const bar=q('speedbar');if(bar){const lo=-.25,frac=C.clamp((v/Math.max(1,p.maxSpeed)-lo)/(1-lo),0,1);bar.style.height=(frac*100).toFixed(1)+'%';}
 hud.querySelectorAll('[data-tele]').forEach(e=>e.classList.toggle('on',+e.dataset.tele===trial.tele));set('tele',TRIAL_TELEGRAPH[trial.tele][0]);
 const row=hud.querySelector('[data-th-row="rudder"]');if(row){row.querySelector('.ord').style.left=((trial.rudder+2)/4*100)+'%';row.querySelector('.act').style.left=(C.clamp(trial.w[1]/(max[1]||1),-1,1)*50+50).toFixed(1)+'%';}set('rudder',TRIAL_RUDDER[trial.rudder+2]);
 const aim=trial.aim,held=trial.heldLock;if(held&&held!==aim?.lock)set('range',`${GUN_MODES.enemy.name} · ${held.ship?'敵艦':'標的'} ${(tv.len(tv.sub(held.pos,trial.P))/1000).toFixed(1)} km`);else set('range',aim?(aim.lock?(aim.lock.ship?'敵艦 ':'標的 '):'')+(aim.dist/1000).toFixed(1)+' km':'—');hud.querySelector('.th-reticle')?.classList.toggle('lock',!!aim?.lock);
 const all=trial.turrets,ts=all.filter(t=>!t.pd),pdl=all.filter(t=>t.pd&&!t.dead),pdOn=pdl.filter(t=>t.pdTarget).length,pdFire=pdl.filter(t=>t.firing).length,ready=ts.filter(t=>t.ready).length,loaded=ts.filter(t=>t.ready&&t.reload<=0).length,blocked=ts.filter(t=>t.arc&&t.clearDir&&!t.clear).length,out=ts.filter(t=>!t.arc).length,turning=ts.length-ready-blocked-out;
 const pw=trial.power,en=trial.energy,ef=en&&en.cap>0?en.E/en.cap:0,load=pw?.load||0,nochg=ts.filter(t=>t.charge<=0).length,starved=ts.filter(t=>t.ready&&t.reload<=0&&en&&en.E<t.power*t.cycle*t.charge/TT_J).length,fireable=Math.max(0,loaded-starved),thrust=pw?.engF??1;
 const gn=q('guns'),gs=q('gunstat');if(gn&&gs){
  // Each figure carries a full and a short label; the layout picks which shows.
  const it=(cls,l,sh,v)=>`<span class="${cls}"><em class="l">${l}</em><em class="s">${sh}</em> ${v}</span>`,eCls=ef<.25?'ng':ef<.6?'wait':'ok',lCls=load>=1.15?'ng':load>=.95?'wait':'ok';
  const html=(ts.length?it('ok','● 射撃可','射撃可',fireable)+it('wait','● 装填・旋回','装填',Math.max(0,ready-loaded+turning-nochg))+(starved?it('wait','● 充電待ち','充電',starved):'')+it('ng','● 遮蔽・射界外','射界外',blocked+out)+(nochg?it('ng','● 充電装置なし','充電なし',nochg):''):'<span class="ng">主砲なし</span>')+(pdl.length?it(pdOn?'wait':'ok','● 点防御','点防御',pdOn?`射撃 ${pdFire}/${pdl.length}`:pdl.length):'')+it(eCls,'⚡ 兵装エネルギー','⚡',Math.round(ef*100)+'%')+it(lCls,'炉心','炉心',Math.round(load*100)+'%')+(thrust<.98?it('wait','推力','推力',Math.round(thrust*100)+'%'):'');
  const grew=gs.innerHTML.length!==html.length;if(gs.innerHTML!==html)gs.innerHTML=html;const gm=q('gunmode'),M=GUN_MODES[trial.gunMode||'free'],gl=`<em class="l">主砲 ${M.name}</em><em class="s">${M.short}</em>`;if(gm&&gm.innerHTML!==gl){gm.innerHTML=gl;}gm?.classList.toggle('on',(trial.gunMode||'free')!=='free');trialGunsLayout(hud,gn,grew);}
 const ml=q('msl');if(ml&&trial.launchers.length){const ready=trial.launchers.filter(l=>l.reload<=0).length,rl=Math.min(...trial.launchers.map(l=>l.reload)),f=1-rl/20;ml.style.setProperty('--fill',(ready?1:f).toFixed(3));set('mslstate',ready?`${ready*8} 発`:`${Math.ceil(rl)} 秒`);ml.classList.toggle('ready',ready>0);}
 const ld=q('lead');if(ld){const p=trial.lead&&view?view.project(trial.lead):null,hr=hud.getBoundingClientRect(),ok=p&&p[2]>-1&&p[2]<1;ld.hidden=!ok;if(ok)ld.style.transform=`translate(${(p[0]-hr.left).toFixed(1)}px,${(p[1]-hr.top).toFixed(1)}px) rotate(45deg)`;}
 const st=hud.querySelector('[data-th-stick]'),si=trialStickInput();if(st){const txt=Math.abs(si.x)<.05&&Math.abs(si.y)<.05?'中立':`${si.y>0?'上げ':'下げ'} ${Math.round(Math.abs(si.y)*100)}% · ${si.x>0?'右':'左'}ロール ${Math.round(Math.abs(si.x)*100)}%`;if(st.getAttribute('aria-valuetext')!==txt)st.setAttribute('aria-valuetext',txt);}
}
// In a battle, a locked enemy that most guns cannot reach gets a hint: the
// batteries bear when the target is above the deck, so pitch or roll toward it.
function trialArcHint(){const B=trial.battle,ts=trial.turrets,lk=trial.aim?.lock;if(!B||B.result||!lk?.ship||!ts.length||trial.jump)return '';const live=ts.filter(t=>!t.dead),bad=live.filter(t=>!t.arc||t.arc&&t.clearDir&&!t.clear).length;return live.length&&bad>=live.length*.7?'主砲の射界外 — 機首を下げるかロールして、甲板を敵艦に向けてください':'';}
function trialWhere(){const s=trialSys();if(trial.jump?.phase==='tunnel')return 'ハイパースペース';return (trial.mode==='battle'?'艦隊戦':trial.returnTo==='title'?'パトロール':'公試')+' · '+s.name+(s.planet.ring?'軌道 · 造船リング':trial.rts?'星系':'低軌道');}
// Flagship status in a battle: shield, hull and armour bars, crew and losses,
// and the last few lines of the battle log.
// Armour by face (bow, stern, starboard, port, dorsal, ventral): what is left
// of the plating, and the load on its most loaded zone (a full bar is about
// to break through).
function armourFaces(u){
 const N=u.sec?.length||C.HULL_SECTIONS,Z=C.combatZones(u.p,N);
 return [0,1,2,3,4,5].map(f=>{let a=0,i=0,l=0;for(let s=0;s<N;s++){const z=s*6+f,A=Z.A[z];if(!(A>0))continue;a+=A;const zi=u.zi?.[z]??1;i+=A*zi;l=Math.max(l,(u.zl?.[z]||0)/Math.max(1e-9,Z.cap[z]*zi));}return {i:a>0?i/a:1,l:C.clamp(l,0,1),a};});
}
function armourFacesHTML(u){
 const fs=armourFaces(u),names=['首','尾','右','左','上','下'];
 return `<div class="ts-row ts-arm"><span>装甲</span><span class="arm6">${fs.map((x,f)=>`<i class="${x.a>0?(x.i<.35?'bad':x.i<.75?'mid':''):'none'}" title="${C.COMBAT_FACE[f]} 残存 ${Math.round(x.i*100)}% · 負荷 ${Math.round(x.l*100)}%"><b>${names[f]}</b><em style="height:${Math.round(x.l*100)}%"></em></i>`).join('')}</span><small>${Math.round((u.armor??1)*100)}%</small></div>`;
}
// Where the reactor's output goes this moment.
function powerSplitHTML(u){
 const w=u.pw;if(!w||!(w.P>0))return '';const pc=x=>Math.round(C.clamp(x/w.P,0,1.5)*100);
 return `<div class="ts-row ts-pw"><span>出力</span><span class="pw3"><i class="e" style="width:${Math.min(100,pc(w.eng))}%" title="推進 ${pc(w.eng)}%"></i><i class="s" style="width:${Math.min(100,pc(w.sh))}%" title="シールド ${pc(w.sh)}%"></i><i class="w" style="width:${Math.min(100,pc(w.wpn))}%" title="兵装 ${pc(w.wpn)}%"></i></span><small title="推進 ${pc(w.eng)}% · シールド ${pc(w.sh)}% · 兵装 ${pc(w.wpn)}%">${pc(w.wpn)}%</small></div>`;
}
function statusFlagsHTML(u){
 const fires=(u.fire||[]).map((f,i)=>f>0?C.SECTION_NAMES[i]:null).filter(Boolean),out=[];
 if(fires.length)out.push(`<span class="fl fire">火災 ${esc(fires.join('・'))}</span>`);
 if((u.ionK||0)>.05)out.push(`<span class="fl ion">イオン障害 出力 −${Math.round(u.ionK*C.COMBAT.ionReactor*100)}%</span>`);
 if((u.shRate||0)>0&&u.shieldMax>0&&u.shield<u.shieldMax*.999){const r=u.shRate/u.shieldMax*100;out.push(`<span class="fl sh">シールド再生 +${r>=1?r.toFixed(1):r>=.1?r.toFixed(2):r.toFixed(3)}%/秒</span>`);}
 if((u.bankUse||0)>0&&u.bankMax>0)out.push(`<span class="fl bank">${u.bank>0?'パワーセルから給電':'パワーセル枯渇'}</span>`);
 return out.length?`<p class="ts-flags">${out.join('')}</p>`:'';
}
function trialSelfUpdate(hud){
 const el=hud.querySelector('[data-th="self"]'),B=trial.battle;if(!el)return;if(!B){if(el.innerHTML)el.innerHTML='';el.hidden=true;return;}el.hidden=false;
 const me=B.me,pc=x=>Math.round(C.clamp(x,0,1)*100),sh=me.shieldMax>0?me.shield/me.shieldMax:0,hp=Math.max(0,me.hp)/me.p.hp,bar=(lab,f,cls)=>`<div class="ts-row"><span>${lab}</span><i class="${cls}"><em style="width:${pc(f)}%"></em></i><small>${pc(f)}%</small></div>`;
 const lost=(me.mods||[]).map((h,i)=>h<=0?trial.p.modules?.[i]:null).filter(m=>m&&m.k!=='hull'),lostTxt=lost.length?'損傷 '+[...new Set(lost.map(m=>m.name))].slice(0,3).join('・')+(lost.length>3?` ほか`:''):'損傷なし';
 const allies=B.b.units.filter(u=>u.team===0&&!u.manual),log=B.ticker.slice(-3).reverse();
 const secs=me.sec?`<div class="ts-row"><span>船体区画</span><span class="vsec">${me.sec.map((q,i)=>{const f=C.clamp(q.s/q.max,0,1);return `<i class="${f<=0?'gone':f<.25?'bad':f<.6?'mid':''}" title="${C.SECTION_NAMES[i]} ${Math.round(f*100)}%"><em style="width:${Math.round(f*100)}%"></em></i>`;}).join('')}</span><small>${pc(Rts.unitStruct(me))}%</small></div>`:bar('船体',hp,'hp');
 const html=`<b class="ts-head">自艦${me.dead?' · 撃沈':me.out?' · 戦闘不能（'+esc(me.out)+'）':''}</b>${bar('シールド',sh,'sh')}${me.bankMax>0?bar('蓄電',me.bank/me.bankMax,'bank'):''}${secs}${armourFacesHTML(me)}${powerSplitHTML(me)}${statusFlagsHTML(me)}<p class="ts-line">乗員 ${num(Math.round(me.crew))} 名 · ${esc(lostTxt)}${allies.length?` · 僚艦 ${allies.filter(u=>!u.dead&&!u.out&&!u.hidden).length}/${allies.length}`:''}</p>${log.length?`<ul class="ts-log">${log.map(l=>`<li>${esc(l.text)}</li>`).join('')}</ul>`:''}`;
 if(el.innerHTML!==html)el.innerHTML=html;
}
function trialHyperUpdate(hud){
 const el=hud.querySelector('[data-th="hyper"]'),j=trial.jump;if(!el)return;el.hidden=!j;if(!j)return;const d=SYSTEMS[j.dest]?.name||'';
 const txt=j.phase==='spool'?`ハイパードライブ充填中 · ${d}へ ${Math.max(0,JUMP.spool-j.t).toFixed(1)} 秒`:j.phase==='accel'?`亜光速へ加速 · 光速の ${(trial.vf/LIGHT*100).toFixed(trial.vf<LIGHT*.01?2:1)}%`:j.phase==='enter'?'ハイパースペースへ突入':j.phase==='tunnel'?`ハイパースペース航行中 · ${d}まで ${Math.ceil(Math.max(0,j.tunnel-j.t))} 秒`:`リアルスペースへ復帰 · ${trialSys().name}`;
 if(el.textContent!==txt)el.textContent=txt;el.dataset.phase=j.phase;
}
// The record line is shown by default on wide screens and folded on phones.
const trialRecordsOn=()=>trial.showRecords??(window.innerWidth>=900);
function trialCommand(cmd){
 if(!trial.on)return;if(trial.cine)spaceCineEnd();
 if(cmd==='tele+')trial.tele=Math.min(5,trial.tele+1);else if(cmd==='tele-')trial.tele=Math.max(0,trial.tele-1);
 else if(cmd==='rudder+'||cmd==='rudder-')trial.rudder=C.clamp(trial.rudder+(cmd.endsWith('+')?1:-1),-2,2);
 else if(cmd==='level')trial.level=true;
 else if(cmd==='center'){trial.rudder=0;trial.level=false;}
 else if(cmd==='cam'){trial.camMode=trial.camMode==='ship'?'horizon':'ship';if(view){view.cam.th=Math.PI;view.cam.ph=TRIAL_CAM_PH;}}
 else if(cmd==='reset'){if(trial.rts){toast('艦隊戦の途中では再開始できません');return;}trialReset();}
 else if(cmd==='fireTap')trial.fireTap=.25;
 else if(cmd==='menu'){const m=$('#thMenu'),b=document.querySelector('[data-trial-cmd="menu"]');if(m){m.hidden=!m.hidden;b?.setAttribute('aria-expanded',String(!m.hidden));}return;}
 else if(cmd==='power'){const m=$('#thPower'),b=document.querySelector('[data-trial-cmd="power"]');if(m){m.hidden=!m.hidden;b?.setAttribute('aria-expanded',String(!m.hidden));}return;}
 else if(cmd==='pnext'){const ks=Object.keys(C.POWER_MODES);trialSetPower(ks[(ks.indexOf(trial.powerMode||'balanced')+1)%ks.length]);}
 else if(cmd.startsWith('pmode:')){trialSetPower(cmd.slice(6));const m=$('#thPower');if(m)m.hidden=true;document.querySelector('[data-trial-cmd="power"]')?.setAttribute('aria-expanded','false');}
 else if(cmd==='records'){trial.showRecords=!trialRecordsOn();}
 else if(cmd==='gunmode'||cmd.startsWith('gun:')){const ks=Object.keys(GUN_MODES),k=cmd==='gunmode'?ks[(ks.indexOf(trial.gunMode||'free')+1)%ks.length]:cmd.slice(4);if(!GUN_MODES[k])return;trial.gunMode=k;trial.gunTarget=null;const M=GUN_MODES[k];toast(`主砲：${M.name} — ${M.note}`);const mb=document.querySelector('[data-th="gunmenu"]');if(mb)mb.innerHTML=`主砲 ${M.name} <kbd>G</kbd>`;}
 else if(cmd==='shot'){shotSet(!shot.on);return;}
 else if(cmd==='pause'){trialPause();return;}
 else if(cmd==='missile'){if(!trial.launchers.length){toast('ミサイル発射管がありません');return;}trial.mslOrder=true;}
 else if(cmd==='map'){if(trial.rts){toast('ジャンプは戦術図の「離脱」「増援」で命じます');return;}trialMapShow();return;}
 else if(cmd.startsWith('jump:')){trialJump(cmd.slice(5));}
 else if(cmd==='retry'){if(trial.rts)return;const r=$('#trialHud [data-th="result"]');if(r)r.hidden=true;trialReset();}
 else if(cmd==='resultClose'){const r=$('#trialHud [data-th="result"]');if(r)r.hidden=true;return;}
 else if(cmd==='exit'){trialStop();return;}
 trialHudUpdate(true);
}
// ---------- star systems ----------
// Two Core Worlds systems to fly between. Each sets its planet (drawn per pixel
// in planet radii, with Kuat's shipyard ring in its equatorial plane) and the
// orbit a ship arrives in. A ship arrives at 20° latitude heading toward the
// equator, so the ring stands as an arch across the sky ahead, 8–18° up.
const SYSTEMS={
 coruscant:{key:'coruscant',name:'コルサント',note:'銀河の首都。全球を覆う都市惑星',short:'銀河の首都',planet:{radius:6.12e6,kind:0,axis:[0,0,1],ring:null},altitude:160000,floor:40000,sun:[.85,-.1,.5],map:[150,146]},
 kuat:{key:'kuat',name:'クワット',note:'クワット・ドライブ・ヤードの軌道造船リングが惑星を取り巻く造船星系',short:'KDY 造船所',planet:{radius:5.2e6,kind:1,axis:[-Math.cos(20*Math.PI/180),Math.sin(20*Math.PI/180),0],ring:[1.16,1.25]},altitude:180000,floor:60000,sun:[-.42,.32,.85],map:[262,86]}};
for(const s of Object.values(SYSTEMS)){const l=Math.hypot(...s.sun);s.sun=s.sun.map(x=>x/l);}
const trialSys=()=>SYSTEMS[trial.sysKey]||SYSTEMS.coruscant;
const trialPlanet=()=>{const s=trialSys();return {center:tv.scale(trial.P,-1),radius:s.planet.radius,sun:s.sun,kind:s.planet.kind,axis:s.planet.axis,ring:s.planet.ring};};
function trialDust(){const L=trial.p.len,H=C.clamp(L*2,1400,30000),n=280,pos=new Float32Array(n*3);for(let i=0;i<pos.length;i++)pos[i]=(Math.random()*2-1)*H;trial.dust={H,pos,col:new Uint8Array(n*4).map((_,i)=>i%4===3?120:170+(i%4)*14),size:new Float32Array(n).fill(Math.max(2,L*.0035))};}

// ---------- hyperspace ----------
// A jump runs: spool-up at full ahead, a sublight burst that sends the planet,
// ring and dust streaming past, the stars stretching into streaks, the tunnel,
// and reversion at the destination. Reversion is the burst in reverse: from
// sublight the ship stops dead within a fifth of a second. The flagship is
// watched from its usual chase view (the streaks collapse and the scenery
// rushes in and halts); another ship dropping out is seen from outside as a
// long streak that snaps back to the ship's true length.
const JUMP={spool:1.8,accel:1.4,enter:.8,exit:.9,arrive:.4},SUBLIGHT=3e7,LIGHT=2.998e8;
const jumpSeconds=hc=>C.clamp(3+2.2*hc,3.5,14);
const trialHyperClass=()=>trial.asset?.stats?.hyperClass??null;
// A ship dropping out covers D(t)=D0·e^(−kt) in its last instants; it is drawn
// stretched by that speed, bow in place, and washed blue-white.
// Reversion: 160 ship lengths out at sublight, brought to rest at e^(−22t).
const WARP={D0:160,k:22,cap:36};
function warpLook(t,L){const tt=Math.max(0,t),D=WARP.D0*L*Math.exp(-WARP.k*tt),stretch=1+Math.min(WARP.cap,D/Math.max(1,L)*.9);return {D,stretch,tint:C.clamp((stretch-1)/16,0,.45)};}
function trialJump(dest){
 if(!trial.on||trial.jump||!SYSTEMS[dest])return;if(dest===trial.sysKey){toast('すでにこの星系にいます');return;}
 const hc=trialHyperClass();if(hc==null){toast('この艦にはハイパードライブがありません');return;}
 if(trial.battle?.me?.out||trial.battle?.me?.dead){toast('戦闘不能のためジャンプできません');return;}
 spaceCineEnd();trial.jump={phase:'spool',t:0,dest,tunnel:jumpSeconds(hc),dir:trialCol(trial.R,0)};trial.tele=5;trial.fire=trial.fireKey=false;trial.fireTap=0;
 trialMapShow(false);toast(`ハイパードライブ起動 — ${SYSTEMS[dest].name}へ（超空間 ${Math.round(trial.jump.tunnel)} 秒）`);
 if(trial.battle&&!trial.battle.result)spaceDepartEscorts();
}
// Streak length (radians added to each star's angle from the bow) per phase.
// Reversion is watched from outside, so only the departure streaks the stars.
function trialStreak(){const j=trial.jump;if(!j)return 0;if(j.phase==='accel')return Math.max(0,(j.t-(JUMP.accel-.35))/.35)*.08;if(j.phase==='enter')return .08+(j.t/JUMP.enter)**2*1.72;if(j.phase==='exit')return 1.8*Math.max(0,1-j.t/.35)**2;return 0;}
// The sublight burst: speed climbs from the ship's own to 10% of light by the
// end of the burst and keeps climbing into the stretch. The ship flies straight
// on its heading, so the planet drops away behind and the ring sweeps overhead.
const trialCoasting=()=>{const p=trial.jump?.phase;return p==='accel'||p==='enter';};
function trialSublight(dt){
 const j=trial.jump;if(!trialCoasting())return;const T=j.phase==='accel'?j.t:JUMP.accel+j.t,tau=JUMP.accel/Math.log(SUBLIGHT/j.v0),v=Math.min(LIGHT*.6,j.v0*Math.exp(T/tau)),f=j.dir;
 trial.P=tv.add(trial.P,f,v*dt);trial.V=tv.scale(f,v);trial.vf=v;trial.w=[0,0,0];
 const d=trial.dust,H=d.H,mv=tv.scale(f,v*dt);for(let i=0;i<d.pos.length;i+=3)for(let k=0;k<3;k++){let x=d.pos[i+k]-mv[k];if(x>H)x-=2*H*Math.ceil((x-H)/(2*H));else if(x<-H)x+=2*H*Math.ceil((-H-x)/(2*H));d.pos[i+k]=x;}
}
// Reversion: the flagship comes in from sublight along its heading and stops
// dead at its arrival point; the chase camera rides along.
function trialReversion(){
 const j=trial.jump;if(j?.phase!=='exit'||!j.to)return;const L=trial.p.len,k=warpLook(j.t,L),f=j.dir,old=trial.P;
 trial.P=tv.add(j.to,f,-k.D);const v=k.D*WARP.k;trial.V=tv.scale(f,Math.max(v,j.v1));trial.vf=Math.max(v,j.v1);trial.w=[0,0,0];
 const d=trial.dust,H=d.H,mv=tv.sub(trial.P,old);for(let i=0;i<d.pos.length;i+=3)for(let q=0;q<3;q++){let x=d.pos[i+q]-mv[q];if(x>H)x-=2*H*Math.ceil((x-H)/(2*H));else if(x<-H)x+=2*H*Math.ceil((-H-x)/(2*H));d.pos[i+q]=x;}
}
const trialFast=()=>trialCoasting()||trial.jump?.phase==='exit';
// Dust drawn as speed lines while coasting.
function trialDustStreaks(){const v=trial.vf,d=trial.dust,f=trial.jump?.dir;if(!trialFast()||!f||v<2000)return null;const n=d.pos.length/3,L=Math.min(v*.035,d.H*1.7),pos=new Float32Array(n*6),col=new Uint8Array(n*8),b=Math.min(1,v/2e5);
 for(let i=0;i<n;i++){const p=[d.pos[i*3],d.pos[i*3+1],d.pos[i*3+2]];pos.set(p,i*6);pos.set(tv.add(p,f,-L),i*6+3);col.set([215*b,230*b,255*b,255],i*8);col.set([40*b,60*b,110*b,255],i*8+4);}return {pos,col};}
function trialJumpStep(dt){
 const j=trial.jump;if(!j)return;j.t+=dt;const next=p=>{j.phase=p;j.t=0;};
 if(j.phase==='spool'){j.dir=trialCol(trial.R,0);if(j.t>=JUMP.spool){j.v0=Math.max(300,trial.vf,trial.p.maxSpeed||0);next('accel');}}
 else if(j.phase==='accel'){if(j.t>=JUMP.accel)next('enter');}
 else if(j.phase==='enter'){if(j.t>=JUMP.enter){next('tunnel');trial.bolts=[];trial.missiles=[];trial.fx=[];trial.vbolts=[];if(trial.battle&&!trial.battle.result)spaceWithdraw();}}
 else if(j.phase==='tunnel'){if(j.t>=j.tunnel){trialArrive(j.dest);next('exit');trialReversion();}}
 else if(j.phase==='exit'){if(j.t>=JUMP.exit){trial.P=j.to.slice();trial.V=tv.scale(j.dir,j.v1);trial.vf=j.v1;next('arrive');}}
 else if(j.phase==='arrive'){if(j.t>=JUMP.arrive){trial.jump=null;if(trial.battle?.result)spaceShowResult();}}
}
function trialArrive(dest){
 trial.sysKey=dest;const s=trialSys(),R=s.planet.radius,L=trial.p.len;
 Object.assign(trial,{P:[0,R+s.altitude,0],R:[1,0,0,0,1,0,0,0,1],w:[0,0,0],V:[trial.p.maxSpeed*.3,0,0],tele:2,rudder:0,level:false,camF:null,warn:''});trial.vf=trial.V[0];trialDust();
 if(trial.mode==='trial'){trial.targets=[];for(let i=0;i<TRIAL_GUN.targets;i++)trial.targets.push(trialSpawnTarget(i,true));}else trial.targets=[];
 // The arrival point; reversion brings the ship in along its heading to it.
 if(trial.jump){trial.jump.dir=trialCol(trial.R,0);trial.jump.to=trial.P.slice();trial.jump.v1=trial.vf;}toast(`${s.name}に到着 — ${s.note}`);
}
function trialStreakLines(s,f,extra){
 const dirs=view?.starDirs,cols=view?.starCol;if(!dirs||s<=.001&&!extra)return false;
 const n=s>.001?dirs.length/3:0,eye=view.eye(),K=(view.cam.far||90000)*.45,ne=extra?extra.pos.length/6:0,pos=new Float32Array((n+ne)*6),col=new Uint8Array((n+ne)*8);let m=0;
 for(let i=0;i<n;i++){const d=[dirs[i*3],dirs[i*3+1],dirs[i*3+2]],c=tv.dot(d,f),r=tv.add(d,f,-c),rl=tv.len(r);if(rl<1e-4)continue;
  const rh=tv.scale(r,1/rl),phi=Math.atan2(rl,c),phi2=Math.min(Math.PI*.95,phi+s*(.18+phi*.9)),e=tv.add(tv.scale(f,Math.cos(phi2)),rh,Math.sin(phi2)),b=(cols?cols[i*4]/255:.8)*Math.min(1,.4+s);
  pos.set(tv.add(eye,d,K),m*6);pos.set(tv.add(eye,e,K),m*6+3);col.set([210*b,230*b,255*b,255],m*8);col.set([30*b,55*b,120*b,255],m*8+4);m++;}
 if(extra){pos.set(extra.pos,m*6);col.set(extra.col,m*8);m+=ne;}
 view.setLines('warpStreaks',{pos:pos.subarray(0,m*6),col:col.subarray(0,m*8)});return m>0;
}
// Star map of the Core Worlds: the current system, the other system and the
// hyperlane between them. Jumping from a battle withdraws from it.
function trialMapHTML(){
 const cur=trialSys(),hc=trialHyperClass(),inBattle=trial.battle&&!trial.battle.result,C0=SYSTEMS.coruscant.map,K0=SYSTEMS.kuat.map;
 const sys=Object.values(SYSTEMS),core=[64,196],mid=[(C0[0]+K0[0])/2+6,(C0[1]+K0[1])/2-14];
 const marks=sys.map(s=>{const here=s.key===cur.key,left=s.key==='coruscant',tx=left?s.map[0]-14:s.map[0]+14,anc=left?'end':'start';return `<g class="tm-sys ${here?'here':''}" ${here||hc==null?'':`data-trial-cmd="jump:${s.key}"`}>${here?`<circle class="tm-ring" cx="${s.map[0]}" cy="${s.map[1]}" r="12"/>`:''}<circle cx="${s.map[0]}" cy="${s.map[1]}" r="${here?6:5}"/><text x="${tx}" y="${s.map[1]-2}" text-anchor="${anc}">${esc(s.name)}</text><text class="tm-sub" x="${tx}" y="${s.map[1]+12}" text-anchor="${anc}">${here?'現在地 · ':''}${esc(s.short)}</text></g>`;}).join('');
 const dests=sys.filter(s=>s.key!==cur.key);
 return `<div class="th-map-head"><b>星図 · コア・ワールド</b><button type="button" class="th-btn" data-trial-cmd="map">閉じる</button></div>
 <svg class="tm-svg" viewBox="0 0 400 240" role="img" aria-label="コア・ワールドの星図。コルサントとクワットがハイパーレーンで結ばれている"><defs><radialGradient id="tmCore" cx="${core[0]/4}%" cy="${core[1]/2.4}%" r="62%"><stop offset="0" stop-color="#fff3cf" stop-opacity=".9"/><stop offset=".1" stop-color="#ffcd7d" stop-opacity=".5"/><stop offset=".34" stop-color="#5d72ad" stop-opacity=".2"/><stop offset="1" stop-color="#060a14" stop-opacity="0"/></radialGradient></defs>
 <rect width="400" height="240" fill="#060a14"/><rect width="400" height="240" fill="url(#tmCore)"/>
 ${[80,150,225,300].map(r=>`<circle class="tm-grid" cx="${core[0]}" cy="${core[1]}" r="${r}"/>`).join('')}
 <path class="tm-arm" d="M-10 64 C 90 20, 250 10, 410 60"/><path class="tm-arm" d="M120 250 C 200 200, 320 180, 410 196"/>
 <text class="tm-region" x="${core[0]-30}" y="${core[1]+26}">ディープ・コア</text><text class="tm-region" x="214" y="176">コア・ワールド</text>
 <path class="tm-lane" d="M${C0.join(' ')} Q ${mid.join(' ')} ${K0.join(' ')}"/><text class="tm-lanelab" x="${mid[0]}" y="${mid[1]+2}" text-anchor="middle">ハイパーレーン</text>${marks}</svg>
 <p class="th-map-note">${hc==null?'この艦にはハイパードライブがありません。':`ハイパードライブ クラス ${num(hc,1)} · 超空間 約 ${Math.round(jumpSeconds(hc))} 秒（演習時間）。全速で加速し、星が流れ始めたらハイパースペースへ。ジャンプ中は射撃できません。${inBattle?'戦闘中にジャンプすると戦域から離脱し、僚艦も続きます。':''}`}</p>
 <div class="th-map-go">${dests.map(s=>`<button type="button" class="th-btn th-jumpbtn" data-trial-cmd="jump:${s.key}" ${hc==null?'disabled':''}>${inBattle?'離脱して':''}${esc(s.name)}へジャンプ</button>`).join('')}</div>`;
}
function trialMapShow(on){const m=$('#thMap');if(!m)return;if(on==null)on=m.hidden;if(on)m.innerHTML=trialMapHTML();m.hidden=!on;document.querySelector('[data-trial-cmd="map"].th-mapbtn')?.setAttribute('aria-expanded',String(on));}

// ---------- space battle ----------
// The flagship is flown with the trial controls; escorts and the enemy fight on
// the fleet model in a frame anchored where the battle began (x ahead, y up).
// Enemy ships drop out of hyperspace a few seconds in. The player's bolts and
// missiles land as damage on the model; enemy fire lands on the flagship's
// shields, armour and modules, which switch off its turrets, power and engines.
// The fleet model's damage and shield recharge are both scaled down, which
// slows the whole exchange about 2.5× without changing who wins: a flagship
// under the guns of two ships lasts a couple of minutes rather than forty seconds.
const SPACE_RULES={range:TRIAL_GUN.range,engagementDistance:12000,step:.25,damage:.7};
function spaceBattleInit(plan){
 const O=[...trial.P],E=trialFrame(trialCol(trial.R,0),tv.norm(trial.P)),me=C.fleetUnit('me',trial.asset.key,trial.p,0);
 me.manual=true;me.name=trial.p.name;me.order={...me.order,power:trial.powerMode};const units=[me],L0=trial.p.len,W0=trial.p.width||L0*.5;
 plan.escorts.forEach((x,i)=>{const u=C.fleetUnit('a'+i,x.key,x.p,0),row=Math.floor(i/2)+1,side=i%2?1:-1;u.name=x.name;u.order={...u.order,power:x.order?.power||'auto',aim:x.order?.aim||'auto'};u.pos=[-row*Math.max(x.p.len,L0)*1.4,0,side*(Math.max(x.p.width||x.p.len*.5,W0)*1.3+row*600)];units.push(u);});
 // The enemy drops out ahead and to starboard on a slant toward the flagship, so
 // the streaks are seen side-on, in an echelon one ship after another. They
 // arrive a little above the flagship's plane, where dorsal batteries bear.
 const n=plan.foes.length;plan.foes.forEach((x,i)=>{const u=C.fleetUnit('e'+i,x.key,x.p,1),gap=Math.max(2600,x.p.len*2.2);u.name=x.name;u.pos=[17000+i*gap*.55,500+(i%3)*450,5000+i*gap*.8];u.yaw=-Math.PI*.8;u.absent=true;u.warp={at:3+i*.6,t:0};units.push(u);});
 const b=C.fleetBattle(units,true);b.seed=(Math.random()*2**31)|0;
 trial.battle={b,O,E,acc:0,extra:new Map(),seen:0,result:null,orderT:0,me,plan,ticker:[],modIndex:new Map((trial.p.modules||[]).map((m,i)=>[m.fit,i]).filter(([f])=>f!=null)),kills:0,disabled:0};
 trial.targets=[];trial.vbolts=[];spaceRefresh(0);
}
const spaceRot=(E,yaw)=>{const c=Math.cos(yaw),s=Math.sin(yaw),a=trialApply(E,[c,0,s]),b=trialApply(E,[0,1,0]),d=trialApply(E,[-s,0,c]);return [...a,...b,...d];};
// World position of a unit, carried forward by its velocity between model steps.
function spaceWorld(u,lead=0){const B=trial.battle;if(u.manual)return trial.P;return tv.add(B.O,trialApply(B.E,tv.add(u.pos,u.velocity||[0,0,0],B.acc+lead)));}
function spaceVel(u){return u.manual?trial.V:trialApply(trial.battle.E,u.velocity||[0,0,0]);}
function spaceHullPoint(u,k){const L=u.p.len,W=u.p.width||L*.5,H=u.p.height||L*.2,R=u.manual?trial.R:spaceRot(trial.battle.E,u.yaw),c=u.manual?tv.sub(trial.P,[0,0,0]):spaceWorld(u);return tv.add(c,trialApply(R,[(Math.random()-.5)*L*k*2,(Math.random()-.3)*H*.5,(Math.random()-.5)*W*.6]));}
// Enemy ships become gunnery targets: an ellipsoid of the ship's own size.
function spaceRefresh(){
 const B=trial.battle;if(!B)return;const live=new Map(trial.targets.map(t=>[t.id,t]));trial.targets=[];
 for(const u of B.b.units){if(u.team!==1||u.dead||u.absent)continue;const t=live.get(u.id)||{id:u.id,ship:true,unit:u,hits:0};
  Object.assign(t,{alive:true,pos:spaceWorld(u),vel:spaceVel(u),rot:spaceRot(B.E,u.yaw),radius:u.p.len*.5,semi:[u.p.len*.5,(u.p.height||u.p.len*.2)*.5,(u.p.width||u.p.len*.5)*.5]});trial.targets.push(t);}
}
function spaceSync(){const B=trial.battle,me=B.me,loc=w=>trialApplyT(B.E,w);me.pos=loc(tv.sub(trial.P,B.O));me.velocity=loc(trial.V);const f=loc(trialCol(trial.R,0));me.yaw=Math.atan2(f[2],f[0]);me.order={...me.order,power:trial.powerMode};}
function spaceOrders(b){for(const u of b.units){if(u.manual||u.dead||u.out||u.absent)continue;const foes=b.units.filter(t=>t.team!==u.team&&!t.dead&&!t.absent).sort((a,z)=>(!!a.out-!!z.out)||C.len(C.sub(a.pos,u.pos))-C.len(C.sub(z.pos,u.pos)));u.order={...u.order,type:foes.length?'attack':'hold',target:foes[0]?.id,fire:true,launch:true};}}
// A bolt of the piloted ship lands on the zone (section and face) it struck.
function spaceDamage(u,tt,kind,q,t){const B=trial.battle;if(!B||B.result)return;tt*=SPACE_RULES.damage;const x=B.extra.get(u.id)||{sf:0,hull:0,direct:0,ion:0,aim:{},from:null,src:B.me?.id};
 // h: what this hit brings to the armour (hull share plus the part that bypasses shields).
 let h;if(kind==='ion'){x.sf+=C.COMBAT.ionShield*tt;x.hull+=C.COMBAT.ionHull*tt;x.ion+=tt;h=C.COMBAT.ionHull*tt;}else if(kind==='missile'){x.sf+=.5*tt;x.hull+=.5*tt;x.direct+=.5*tt;h=tt;}else{x.sf+=tt;x.hull+=tt;h=tt;}
 x.aim.auto=(x.aim.auto||0)+h+.1*tt;if(B.me)x.from=[...B.me.pos];
 if(q&&t?.rot&&t.semi){const z=C.combatZoneAt(u.p,trialApplyT(t.rot,tv.sub(q,t.pos)),t.semi);x.zw=x.zw||new Array(30).fill(0);x.zw[z]+=h;}
 B.extra.set(u.id,x);}
function spaceImpact(pos,vel,u,size){const sh=u&&u.shield>0;for(let k=0;k<(sh?5:7);k++)trial.fx.push({pos,vel:tv.add(vel,tv.scale(tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),30+Math.random()*90)),life:sh?.35:.6,max:sh?.35:.6,size:size*(sh?1.3:.9),col:sh?[120,190,255]:[255,170+(Math.random()*50|0),90]});}
function trialExplosion(pos,vel,L,big){
 trial.fx.push({pos,vel,life:big?1.1:.7,max:big?1.1:.7,size:L*(big?3.2:1.6),col:[255,250,235]});
 for(let k=0;k<(big?160:90);k++){const d=tv.norm([Math.random()-.5,Math.random()-.5,Math.random()-.5]),sp=L*(.3+Math.random()*(big?2.6:1.4));trial.fx.push({pos,vel:tv.add(vel,d,sp),life:1.4+Math.random()*1.4,max:2.8,size:L*(.06+Math.random()*.14),col:k%5===0?[150,155,165]:[255,150+(Math.random()*90|0),70]});}
 if(big)for(let k=0;k<72;k++){const a=k/72*Math.PI*2,d=[Math.cos(a),(Math.random()-.5)*.08,Math.sin(a)];trial.fx.push({pos,vel:tv.add(vel,d,L*3.5),life:1.2,max:1.2,size:L*.12,col:[190,220,255]});}
}
function spaceShots(shots){
 const B=trial.battle,byId=new Map(B.b.units.map(u=>[u.id,u]));
 for(const s of shots){const a=byId.get(s.from),t=byId.get(s.to);if(!a||!t||a.manual)continue;const n=C.clamp(Math.round((s.gun||0)/30),s.gun>0?1:0,6);
  for(let i=0;i<n;i++){const from=spaceHullPoint(a,.4),tw=spaceWorld(t),tof=C.len(C.sub(tw,from))/TRIAL_GUN.boltSpeed,to=tv.add(spaceHullPoint(t,.3),spaceVel(t),tof),d=tv.sub(to,from),dist=tv.len(d);if(dist<1)continue;
   trial.vbolts.push({pos:from,vel:tv.scale(d,TRIAL_GUN.boltSpeed/dist),life:dist/TRIAL_GUN.boltSpeed,delay:Math.random()*SPACE_RULES.step,len:Math.max(80,a.p.len*.06),size:Math.max(6,a.p.len*.007),col:s.ion?[170,215,255]:a.team?[255,95,70]:[110,255,140],target:t});}
  if(s.msl>0&&Math.random()<.5)for(let k=0;k<2;k++){const from=spaceHullPoint(a,.3);trial.fx.push({pos:from,vel:tv.add(spaceVel(a),tv.norm(tv.sub(spaceWorld(t),from)),2600),life:2.5,max:2.5,size:9,col:[255,210,150]});}}
 if(trial.vbolts.length>1600)trial.vbolts.splice(0,trial.vbolts.length-1600);
}
function spaceBolts(dt){
 trial.vbolts=trial.vbolts.filter(b=>{if(b.delay>0){b.delay-=dt;return true;}b.pos=tv.add(b.pos,b.vel,dt);b.life-=dt;if(b.life<=0){const t=b.target;spaceImpact(b.pos,t?spaceVel(t):[0,0,0],t,Math.max(8,(t?.p.len||300)*.02));if(t?.manual){trial.hitFlash=Math.min(1,(trial.hitFlash||0)+(t.shield>0?.12:.35));}return false;}return true;});
}
// In a battle each tube draws its salvo from its own magazine.
function spaceAmmo(l){const B=trial.battle;if(!B)return true;const i=B.modIndex.get(l.id);if(i==null)return true;if((B.me.ammo[i]||0)<l.salvo)return false;B.me.ammo[i]-=l.salvo;return true;}
// The enemy's arrival is shown as a short cut-away: the camera stands off the
// bow quarter of the arriving formation, so the ships come out of hyperspace
// toward it one after another, stretched, then snap to their true length.
function spaceCineStart(){
 const B=trial.battle;if(!B||trial.cine||trial.jump||!view)return;const foes=B.b.units.filter(u=>u.team===1&&u.warp);if(!foes.length)return;
 const f=trialCol(spaceRot(B.E,foes[0].yaw),0),up=tv.norm(trial.P),s0=tv.norm(tv.cross(up,f)),side=tv.dot(s0,tv.sub(trial.P,spaceWorld(foes[0])))>0?s0:tv.scale(s0,-1);
 const pts=foes.map(u=>spaceWorld(u)),c=pts.reduce((a,p)=>tv.add(a,p,1/pts.length),[0,0,0]),span=Math.max(0,...pts.map(p=>tv.len(tv.sub(p,c)))),L=Math.max(...foes.map(u=>u.p.len));
 const asp=(view.canvas.clientWidth||16)/(view.canvas.clientHeight||9);
 trial.cine={t:0,dur:Math.max(...foes.map(u=>u.warp.at-u.warp.t))+1.9,dirW:tv.norm(tv.add(tv.add(tv.scale(f,.8),side,.52),up,.2)),r:(span*1.4+L*4.2)*C.clamp(1.2/asp,1,2.2),lead:f,L,ids:foes.map(u=>u.id),save:{th:view.cam.th,ph:view.cam.ph,r:view.cam.r}};
 $('#trialHud')?.classList.add('cine');
}
function spaceCineEnd(){const k=trial.cine;if(!k)return;trial.cine=null;if(view)Object.assign(view.cam,k.save);$('#trialHud')?.classList.remove('cine');}
function spaceDepartEscorts(){const B=trial.battle;for(const u of B.b.units)if(u.team===0&&!u.manual&&!u.dead&&!u.absent)u.depart={t:0};}
function spaceWithdraw(){const B=trial.battle;B.result={kind:'withdrew',dest:trial.jump?.dest};B.left=true;trial.targets=[];}
function spaceEnd(kind){const B=trial.battle;if(B.result)return;B.result={kind,fate:B.me.fate,why:B.me.out};trial.fire=trial.fireKey=false;if(!trial.jump)setTimeout(spaceShowResult,kind==='win'?1500:2600);}
function spaceLog(text,u){const B=trial.battle;if(!B)return;const who=!u?'':u.manual?'自艦：':(u.team?'敵 ':'友 ')+shipShort(u.name)+'：';B.ticker.push({t:B.b.time,text:who+text});if(B.ticker.length>40)B.ticker.shift();}
function spaceStep(dt){
 const B=trial.battle;if(!B||B.left)return;const b=B.b;
 if(!B.cined&&b.units.some(u=>u.warp&&u.warp.t+dt>=u.warp.at-.5)){B.cined=true;spaceCineStart();}
 for(const u of b.units){if(u.warp){u.warp.t+=dt;const tt=u.warp.t-u.warp.at;if(tt>=.9){u.absent=false;delete u.warp;spaceLog('ハイパースペースから出現',u);if(b.units.filter(x=>x.team===1).every(x=>!x.warp))toast('敵艦隊がハイパースペースから出現');}}
  if(u.depart){u.depart.t+=dt;if(u.depart.t>=.8){u.absent=true;u.hidden=true;delete u.depart;}}}
 if(B.result){for(const u of b.units)if(!u.manual&&!u.dead)u.pos=tv.add(u.pos,u.velocity||[0,0,0],dt);spaceRefresh();return;}
 B.acc+=dt;B.orderT-=dt;
 while(B.acc>=SPACE_RULES.step){B.acc-=SPACE_RULES.step;if(B.orderT<=0){spaceOrders(b);B.orderT=2;}spaceSync();
  const before=new Map(b.units.map(u=>[u.id,{dead:u.dead,out:u.out}]));
  const shots=C.fleetTick(b,SPACE_RULES.step,{rules:SPACE_RULES,extra:B.extra,onHit:(u,rec)=>{if(u.manual)hitcamOffer(u,rec,'taken');else if(B.me&&String(rec.src)===String(B.me.id))hitcamOffer(u,rec,'dealt');}});B.extra=new Map();spaceShots(shots);
  for(const u of b.units){const was=before.get(u.id);if(u.dead&&!was.dead){trialExplosion(spaceWorld(u),spaceVel(u),u.p.len,u.fate==='reactor'||u.fate==='fuel'||u.fate==='magazine');if(u.team===1)B.kills++;}else if(u.out&&!was.out&&u.team===1)B.disabled++;}
  for(const t of trial.turrets){const i=B.modIndex.get(t.id);t.dead=i!=null&&B.me.mods[i]<=0;}
  for(const l of trial.launchers){const i=B.modIndex.get(l.id);l.dead=i!=null&&B.me.mods[i]<=0;}
  for(;B.seen<b.events.length;B.seen++){const e=b.events[B.seen],u=b.units.find(x=>x.id===e.id),text=e.text.replace(/^[^：]*：/,'');spaceLog(text,u);if(u?.manual&&/破壊|停止|誘爆|消失|喪失|戦闘不能|撃沈/.test(text))toast('自艦：'+text);}
  if(B.me.dead||B.me.out){spaceEnd(B.me.dead?'sunk':'out');break;}
  if(b.units.filter(u=>u.team===1).every(u=>u.dead||u.out)&&!b.units.some(u=>u.team===1&&u.warp)){spaceEnd('win');break;}}
 spaceRefresh();
}
// Units other than the flagship, as the renderer wants them (relative to the flagship).
function spaceDrawUnits(){
 const B=trial.battle;if(!B||B.left)return [];const out=[];
 for(const u of B.b.units){if(u.manual||u.dead||u.hidden)continue;let w=spaceWorld(u),stretch=1,flash=0;const R=spaceRot(B.E,u.yaw),f=trialCol(R,0);
  if(u.warp){const tt=u.warp.at!=null?u.warp.t-u.warp.at:u.warp.t;if(tt<0)continue;const k=warpLook(tt,u.p.len);w=tv.add(w,f,-k.D);stretch=k.stretch;flash=k.tint;}
  else if(u.absent&&!u.depart)continue;
  if(u.depart){const t=u.depart.t;w=tv.add(w,f,u.p.len*40*(t/.8)**3);stretch=1+25*t*t;flash=C.clamp((stretch-1)/16,0,.45);}
  out.push({key:u.key,pos:tv.sub(w,trial.P),rot:R,glow:u.out?0:.55,hatchOpen:0,dead:false,stretch,flash});}
 return out;
}
function spaceShowResult(){
 const B=trial.battle,el=$('#trialHud')?.querySelector('[data-th="result"]');if(!B||!el||!B.result)return;const r=B.result,me=B.me,fate={reactor:'炉心誘爆',fuel:'反応物誘爆',magazine:'弾薬庫誘爆',hull:'船体破断'};
 const title=r.kind==='win'?'勝利':r.kind==='withdrew'?'離脱':'敗北',sub=r.kind==='win'?'敵艦隊を無力化しました':r.kind==='withdrew'?`${SYSTEMS[r.dest]?.name||''}へ戦域を離脱しました`:r.kind==='sunk'?`旗艦撃沈（${fate[r.fate]||'船体破断'}）`:`旗艦戦闘不能（${r.why||''}）`;
 const foes=B.b.units.filter(u=>u.team===1),allies=B.b.units.filter(u=>u.team===0&&!u.manual);
 const rts=!!B.rts,hull=rts?Math.round(Rts.unitStruct(me)*100):Math.round(Math.max(0,me.hp)/me.p.hp*100),sub2=rts&&r.kind==='win'?'この星系の戦闘は終わりました':rts&&r.kind==='withdrew'?'敵はこの星系から退きました':sub;
 el.innerHTML=`<div class="th-card th-result-card"><b class="${r.kind==='win'?'win':r.kind==='withdrew'?'':'lose'}">${rts&&r.kind==='withdrew'?'敵が撤退':title}</b><p>${esc(sub2)}</p><dl><dt>敵艦</dt><dd>撃沈 ${foes.filter(u=>u.dead).length} · 戦闘不能 ${foes.filter(u=>!u.dead&&u.out).length} / ${foes.length} 隻</dd><dt>僚艦</dt><dd>${allies.length?`健在 ${allies.filter(u=>!u.dead&&!u.out).length} / ${allies.length} 隻`:'なし'}</dd><dt>${rts?'自艦':'旗艦'}</dt><dd>${rts?'船体区画':'船体'} ${hull}% · 装甲 ${Math.round(me.armor*100)}% · 乗員 ${num(Math.round(me.crew))} 名</dd><dt>射撃</dt><dd>${num(trial.gun.shots)} 発 · 命中 ${num(Math.round(trial.gun.hits))}${trial.gun.pdKills?` · 点防御 撃墜 ${trial.gun.pdKills}`:''}</dd></dl><div class="th-result-go"><button type="button" class="th-btn" data-trial-cmd="exit">${rts?'戦術図へ戻る':'艦隊画面へ戻る'}</button>${rts?'':'<button type="button" class="th-btn" data-trial-cmd="retry">もう一度</button>'}<button type="button" class="th-btn" data-trial-cmd="resultClose">このまま航行</button></div></div>`;el.hidden=false;
}
// Fleet screen → space: the chosen flagship is flown, the rest of the fleet
// and the enemy fight on the model.
async function spaceBattleLaunch(){
 const b=fleet.battle;if(!b||fleet.busy)return;const friends=b.units.filter(u=>u.team===0),foes=b.units.filter(u=>u.team===1);
 if(!friends.length||!foes.length){toast(!friends.length?'友軍の艦を追加してください':'敵艦を追加してください');return;}
 const flag=fleetFlag()||friends[0],asset=fleet.assets.get(flag.key);if(!asset?.design){toast('旗艦の設計を準備できません');return;}
 const plan={flag:{key:flag.key,name:flag.name},escorts:friends.filter(u=>u!==flag).map(u=>({key:u.key,p:u.p,name:u.name,order:u.order})),foes:foes.map(u=>({key:u.key,p:u.p,name:u.name}))};
 await fleetSetMode('design');await trialStart({design:asset.design,battle:plan,system:fleet.system||'coruscant',returnTo:'tactical'});
}
function trialSetPower(k){if(!Object.hasOwn(C.POWER_MODES,k))return;trial.powerMode=k;const b=document.querySelector('[data-th="pwbtn"]');if(b)b.textContent='⚡ '+C.POWER_MODES[k].name;document.querySelectorAll('#thPower [data-trial-cmd^="pmode:"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.trialCmd==='pmode:'+k)));toast('出力配分：'+C.POWER_MODES[k].name+' — '+C.POWER_MODES[k].note);}
const TRIAL_KEYS={KeyG:'gunmode',KeyH:'shot',KeyK:'pause',KeyP:'pnext',KeyM:'missile',KeyW:'tele+',ArrowUp:'tele+',KeyS:'tele-',ArrowDown:'tele-',KeyA:'rudder-',ArrowLeft:'rudder-',KeyD:'rudder+',ArrowRight:'rudder+',KeyZ:'level',KeyX:'center',KeyV:'cam',KeyJ:'map',Escape:'exit'};
const TRIAL_HOLD={KeyR:['y',1],KeyF:['y',-1],KeyQ:['x',-1],KeyE:['x',1]};
function trialKeyStick(){const s={x:0,y:0};for(const k of trial.keys){const h=TRIAL_HOLD[k];if(h)s[h[0]]+=h[1];}trial.keyStick={x:C.clamp(s.x,-1,1),y:C.clamp(s.y,-1,1)};}
function bindTrial(){
 document.addEventListener('click',e=>{const b=e.target.closest('[data-trial],[data-trial-cmd]');const m=$('#thMenu');if(m&&!m.hidden&&!e.target.closest('#thMenu,[data-trial-cmd="menu"]')){m.hidden=true;document.querySelector('[data-trial-cmd="menu"]')?.setAttribute('aria-expanded','false');}const pm=$('#thPower');if(pm&&!pm.hidden&&!e.target.closest('#thPower,[data-trial-cmd="power"]')){pm.hidden=true;document.querySelector('[data-trial-cmd="power"]')?.setAttribute('aria-expanded','false');}const mp=$('#thMap');if(mp&&!mp.hidden&&!e.target.closest('#thMap,[data-trial-cmd="map"]'))trialMapShow(false);if(!b||b.disabled)return;if(b.dataset.trial==='start'){e.preventDefault();trialStart();return;}if(b.dataset.trialCmd){e.preventDefault();const inMenu=!!b.closest('#thMenu');trialCommand(b.dataset.trialCmd);if(inMenu&&m){m.hidden=true;document.querySelector('[data-trial-cmd="menu"]')?.setAttribute('aria-expanded','false');}}});
 window.addEventListener('keydown',e=>{if(!trial.on||e.ctrlKey||e.metaKey||e.altKey)return;
  if(shot.on&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();shotSet(false);return;}
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
function fleetMapToolsHTML(){const u=fleetSelected(),editable=!!(u&&!u.dead&&u.team===0&&fleetEditable()),b=fleet.battle,t=fleetMapTarget(u),d=t?C.len(C.sub(t.pos,u.pos)):null;return `<div class="fleet-map-readout"><span class="fleet-map-key"><i></i>友軍 <i class="enemy"></i>敵軍</span><b>${u?esc(u.name):'艦の記号を選択'}</b><small>${u?(u.dead?'撃沈':`${u.team?'敵艦':'友軍'} · 構造 ${fPct(u.hp/u.p.hp)}${t?' · '+(u.order.target===t.id?'目標':'最寄敵')+' '+(d/1000).toFixed(1)+' km':''}${u.p.slidingHatches?' · '+fleetHatchText(u):''}`):'艦の記号を選択して旗艦・僚艦を確認'}</small></div><div class="fleet-map-toolbar"><div class="fleet-map-commands">${u&&u.team===0&&!u.dead&&u!==fleetFlag()?'<button class="chip" data-fleet-action="flagship">旗艦にする</button>':''}<button class="chip primary" data-fleet-action="space" ${fleetFlag()&&fleetUnits().some(x=>x.team===1)&&!fleet.busy?'':'disabled'}>旗艦で出撃</button></div><div class="fleet-map-zoom"><button class="chip" data-fleet-action="zoomOut" aria-label="状況図を縮小">−</button><button class="chip" data-fleet-action="zoomIn" aria-label="状況図を拡大">＋</button></div></div>`;}
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
 for(const u of [...us].sort((a,b)=>(b.id===fleet.selected)-(a.id===fleet.selected))){const p=fleetMapProject(u.pos),chosen=u.id===fleet.selected;if(p[0]<-30||p[0]>W+30||p[1]<-30||p[1]>H+30)continue;const color=u.dead?'#6b747e':u.out?'#c9b07c':u.team?'#ff9c8e':'#77dced';ctx.save();ctx.translate(p[0],p[1]);ctx.rotate(-u.yaw);ctx.fillStyle=u.dead?'#202a33':u.out?'#3a3324':u.team?'#5a302e':'#173f51';ctx.strokeStyle=color;ctx.lineWidth=chosen?2:1.4;ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-10,-10);ctx.lineTo(-5,0);ctx.lineTo(-10,10);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  if(u.dead){line([p[0]-10,p[1]-10],[p[0]+10,p[1]+10],color);line([p[0]-10,p[1]+10],[p[0]+10,p[1]-10],color);}else{ctx.strokeStyle=chosen?'#e9faff':color+'77';ctx.setLineDash(u.team?[3,3]:[]);ctx.beginPath();if(u.team){ctx.moveTo(p[0],p[1]-22);ctx.lineTo(p[0]+22,p[1]);ctx.lineTo(p[0],p[1]+22);ctx.lineTo(p[0]-22,p[1]);ctx.closePath();}else ctx.arc(p[0],p[1],chosen?23:19,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);const velocity=u.velocity||[0,0,0],v=fleetMapProject(C.add(u.pos,C.mul(velocity,20)));if(Math.hypot(v[0]-p[0],v[1]-p[1])>12)line(p,v,color+'77',[3,4]);}
  if(!fleet.labels&&!chosen)continue;ctx.font='11px system-ui,sans-serif';const label=shortName(u.name,W<480?12:20),heading=((90-u.yaw*180/Math.PI)%360+360)%360,info=u.dead?fleetStatusText(u):u.out?`${u.team?'敵':'友'} · ${fleetStatusText(u)}`:`${u.team?'敵':u===fleetFlag()?'旗艦':'友'} · ${Math.round(heading)}° · ${Math.round(u.hp/u.p.hp*100)}%`,maxWidth=Math.min(W-24,Math.max(102,ctx.measureText(label).width+16)),candidates=[[p[0]+28,p[1]-22],[p[0]-maxWidth-28,p[1]-22],[p[0]-maxWidth/2,p[1]+27],[p[0]-maxWidth/2,p[1]-69]];
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

const fleet={mode:'design',review:[],battle:null,assets:new Map(),saves:[],selected:null,next:1,busy:false,form:'line',gap:800,command:'select',altitude:0,moveX:0,moveZ:0,speed:2,elapsed:0,playing:false,replay:false,frame:null,lastClock:0,labels:true,ranges:true,orbit:false,clean:false,designCamera:null,sceneCamera:{},source:'current',team:0,flagship:null,system:'coruscant'};
// The friendly ship the player flies in a space battle (the first one unless chosen).
function fleetFlag(){const fr=(fleet.battle?.units||[]).filter(u=>u.team===0);return fr.find(u=>u.id===fleet.flagship)||fr[0]||null;}
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
function fleetPowerName(u){const o=u.order||{},now=C.POWER_MODES[u.mode]?.name;return o.power&&o.power!=='auto'&&C.POWER_MODES[o.power]?C.POWER_MODES[o.power].name:'自動'+(now?`（${now}）`:'');}
function fleetOrderText(u){const o=u.order,pw=' · 出力 '+fleetPowerName(u);if(o.type==='move')return `移動 → ${(o.point[0]/1000).toFixed(1)}, ${(o.point[2]/1000).toFixed(1)} km / 高度 ${(o.point[1]/1000).toFixed(1)} km`+pw;if(o.type==='attack')return '攻撃 → '+(fleetUnits().find(t=>t.id===o.target)?.name||'目標消失')+(o.aim&&o.aim!=='auto'?`（${C.AIM_KINDS[o.aim]}を照準）`:'')+pw;return '停止・位置保持'+pw;}
// Combat state for the readouts: sunk, out of the fight, or fighting, and why.
const FLEET_FATE={reactor:'炉心誘爆',fuel:'反応物誘爆',magazine:'弾薬庫誘爆',hull:'船体破断'};
function fleetStatusText(u){return u.dead?`撃沈（${FLEET_FATE[u.fate]||'船体破断'}）`:u.out?`戦闘不能（${u.out}）`:'戦闘可能';}
function fleetDamageList(u){const mods=u.p.modules||[];if(!mods.length||!u.mods)return '';const g={};mods.forEach((m,i)=>{if(m.k==='hull')return;const x=g[m.k]||(g[m.k]={n:0,lost:0,hit:0});x.n++;const v=u.mods[i]??1;if(v<=0)x.lost++;else if(v<1)x.hit++;});
 return Object.entries(g).filter(([,x])=>x.lost||x.hit).map(([k,x])=>`${C.MODULE_LABEL[k]} ${[x.lost?`${x.lost}/${x.n} 破壊`:'',x.hit?`${x.hit} 損傷`:''].filter(Boolean).join('・')}`).join('、');}
function fleetPowerHTML(u,editable){const o=u.order,cur=o.power||'auto',m=C.POWER_MODES[cur],combat=fleet.battle.combat;
 return `<div class="fleet-power"><h5>出力配分</h5><div class="chips">${[['auto','自動'],...Object.entries(C.POWER_MODES).map(([k,x])=>[k,x.name])].map(([k,n])=>`<button type="button" class="chip" data-fleet-power="${k}" aria-pressed="${cur===k}" ${editable?'':'disabled'}>${n}</button>`).join('')}</div><p class="note keep">${m?`${esc(m.note)}炉の上限 ${Math.round(m.max*100)}%、その負荷で炉に被弾したときの誘爆率 ${fPct(C.coreDetonation(m.max))}（1発あたり）。`:esc(C.POWER_AUTO_NOTE)}</p>
 <label class="fleet-aim">照準<select data-fleet-aim ${editable&&combat?'':'disabled'} aria-label="攻撃で狙う部位">${Object.entries(C.AIM_KINDS).map(([k,n])=>`<option value="${k}" ${(o.aim||'auto')===k?'selected':''}>${n}</option>`).join('')}</select></label><p class="note">部位を狙うと命中率が2割落ち、シールドを抜いた弾がその部位に当たりやすくなります。炉の誘爆は相手の炉心負荷しだいです。</p></div>`;}
function fleetOptions(){return `<option value="current">現在の設計</option><optgroup label="作例">${Object.entries(C.DESIGNS).map(([k,d])=>`<option value="${k}" ${fleet.source===k?'selected':''}>${esc(d.name)}</option>`).join('')}</optgroup>${fleet.saves.length?`<optgroup label="保存艦">${fleet.saves.map(r=>`<option value="save:${esc(r.id)}" ${fleet.source==='save:'+r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</optgroup>`:''}`;}
function fleetRoster(){return `<div class="fleet-roster">${fleetDisplay().map(u=>`<button type="button" data-fleet-select="${u.id}" class="fleet-unit ${u.team?'enemy':''} ${fleet.selected===u.id?'selected':''} ${u.dead?'destroyed':''} ${u.out?'disabled':''}" aria-pressed="${u.id===fleet.selected}"><span class="fleet-side">${fleet.mode==='review'?'◆':u.team?'敵':u===fleetFlag()?'旗':'友'}</span><span><b>${esc(u.name)}</b><small>${fleet.mode==='review'?fLen(u.p.len)+' / '+u.p.power.toFixed(3)+' ISD':u.dead||u.out?fleetStatusText(u):u.team?'敵艦 · AI指揮':u===fleetFlag()?'旗艦 · 自ら操艦':'僚艦 · 出力 '+fleetPowerName(u)}</small><span class="fleet-bars"><i style="width:${Math.max(0,u.hp/u.p.hp*100)}%"></i></span></span>${fleet.mode!=='review'?`<em>${Math.round(u.hp/u.p.hp*100)}%</em>`:''}</button>`).join('')||'<p class="note">艦を追加してください。</p>'}</div>`;}
function fleetControlsHTML(){
 const review=fleet.mode==='review',b=fleet.battle,u=fleetSelected(),editable=fleetEditable()&&u&&!u.dead&&!u.out&&(review||u.team===0),lock=!fleetCanRefit(),busy=fleet.busy;
 let h=`<div class="fleet-heading"><span>${review?'FLEET REVIEW':'FLEET ACTION'}</span><h2>${review?'観閲式':'艦隊戦'}</h2><p>${review?'設計した艦を、同じ縮尺の宇宙に。':'旗艦を自ら操艦し、僚艦と敵艦隊は実空間で戦う。'}</p></div>`;
 if(!review){const flag=fleetFlag(),foes=fleetUnits().filter(x=>x.team===1).length,ready=!!flag&&foes>0&&!busy;h+=`<div class="fleet-space"><label>戦場<select data-fleet-setting="system">${Object.values(SYSTEMS).map(x=>`<option value="${x.key}" ${fleet.system===x.key?'selected':''}>${esc(x.name)}${x.planet.ring?' · 造船リング':' · 低軌道'}</option>`).join('')}</select></label><p class="fleet-flag"><span>旗艦</span><b>${flag?esc(flag.name):'友軍の艦を追加してください'}</b></p><button class="btn primary" data-fleet-action="space" ${ready?'':'disabled'}>旗艦で出撃</button><p class="note keep">${!flag?'友軍の艦を追加すると出撃できます。':!foes?'敵艦を1隻以上追加してください。':`旗艦を公試と同じ操作で操艦します。僚艦 ${fleetUnits().filter(x=>x.team===0).length-1} 隻と敵 ${foes} 隻はAIが戦い、敵は数秒後にハイパースペースから出現します。`}</p></div>`;}
 h+=`<details class="fleet-add" ${lock?'':'open'}><summary>艦隊編成 · ${fleetUnits().length} / 12 隻</summary><label>追加する設計<select id="fleetSource" ${lock||busy?'disabled':''}>${fleetOptions()}</select></label>${!review?`<div class="seg"><button type="button" data-fleet-team="0" aria-pressed="${fleet.team===0}">友軍</button><button type="button" data-fleet-team="1" aria-pressed="${fleet.team===1}">敵軍（AI）</button></div>`:''}<button class="btn" data-fleet-action="add" ${lock||busy?'disabled':''}>${busy?'艦を準備中…':'艦を追加'}</button>${lock?'<p class="note">編成を変えるときは「開始位置に戻す」を押してください。</p>':''}</details>`;
 h+=fleetRoster();
 if(review)h+=`<div class="pgroup"><h4>隊列</h4><div class="chips">${[['line','横列'],['column','縦列'],['wedge','楔形'],['grid','整列']].map(([k,l])=>`<button class="chip" data-fleet-form="${k}" aria-pressed="${fleet.form===k}">${l}</button>`).join('')}</div><label class="fleet-range">艦間隔 <b>${fLen(fleet.gap)}</b><input aria-label="隊列の艦間隔" type="range" min="0" max="5000" step="100" value="${fleet.gap}" data-fleet-setting="gap"></label><p class="note">間隔は最大艦の長さ・幅に加算します。隊列を選び直すと個別配置を整列します。</p></div>`;
 if(!review)h+=`<p class="note fleet-rules">敵艦隊は約22 km前方に出現します。砲の射程は長射程 40 km・中射程 22 km・舷側砲 9 km。シールドは炉からの給電で再生し、パワーセルの蓄電が不足分を肩代わりします。シールドを抜けた砲火は装甲に負荷として溜まり、耐えきれなくなると貫通してモジュールを壊し、火災や誘爆を起こします。全力で機動すると推進が炉の出力を奪い、ほとんど撃てません。戦闘中にハイパードライブで別の星系へ離脱できます。</p>`;
 if(u)h+=`<div class="pgroup fleet-orders"><h4>${esc(u.name)}</h4>${review?`<div class="fleet-coords">${[['0','前後 X',u.pos[0]],['1','上下 Y',u.pos[1]],['2','左右 Z',u.pos[2]],['yaw','方位 °',u.yaw*180/Math.PI]].map(([k,l,v])=>`<label>${l}<input type="number" data-fleet-pos="${k}" value="${Math.round(v)}" step="${k==='yaw'?5:100}" aria-label="${l}"></label>`).join('')}</div><button class="btn sm" data-fleet-action="position">画面上で配置する</button>`:`<p class="note">${u.team?'敵艦はAIが指揮します。戦闘開始の数秒後にハイパースペースから出現します。':u===fleetFlag()?'旗艦 — 出撃するとこの艦を操艦します。出力配分は戦闘中に ⚡ ボタンまたは P キーで切り替えます。':'僚艦 — AIが最寄りの敵を攻撃します。出力配分と照準をここで指定できます。'}</p>${u.team===0&&u!==fleetFlag()?`<div class="chips"><button class="chip" data-fleet-action="flagship">旗艦にする</button></div>${fleetPowerHTML(u,editable)}`:''}`}<div class="chips"><button class="chip" data-fleet-action="focus">この艦を見る</button><button class="chip" data-fleet-action="remove" ${lock||busy?'disabled':''}>編成から外す</button></div></div>`;
 h+=`<div class="pgroup"><h4>表示</h4><div class="chips"><button class="chip" data-fleet-action="fit">艦隊全体</button>${review?'<button class="chip" data-fleet-action="top">真上</button><button class="chip" data-fleet-action="iso">斜め</button>':`<button class="chip" data-fleet-action="ranges" aria-pressed="${fleet.ranges}">射程円</button>`}<button class="chip" data-fleet-action="labels" aria-pressed="${fleet.labels}">艦名表示</button>${review?`<button class="chip" data-fleet-action="orbit" aria-pressed="${fleet.orbit}">自動周回</button><button class="chip" data-fleet-action="clean">鑑賞表示</button><button class="chip" data-fleet-action="saveReview">配置を保存</button><button class="chip" data-fleet-action="loadReview">保存配置を開く</button>`:''}</div></div><p class="note">${review?'ドラッグで回転、ホイール・2本指で拡大縮小。Shift＋ドラッグで平行移動。':'友軍と敵の艦を追加し、旗艦を選んで「旗艦で出撃」。図は編成の確認用で、1本指で移動、2本指・ホイール・＋/−で拡大縮小。戦闘は出撃後の実空間で行います。'}</p>`;return h;
}
function fleetDetailsHTML(){const u=fleetSelected(),s=u&&fleet.assets.get(u.key)?.stats;return `<div class="spec-title"><h3>${fleet.mode==='review'?'観閲艦の諸元':'戦術情報'}</h3></div>${u&&s?`<div class="fleet-readout"><h3>${esc(u.name)}</h3><dl><dt>全長</dt><dd>${fLen(u.p.len)}</dd><dt>主出力</dt><dd>${s.xISD.toFixed(3)} ISD</dd><dt>最大加速度（設計）</dt><dd>${fG(s.accelG)}</dd><dt>航空容量</dt><dd>${(s.aviation?.capacity||0).toFixed(2)} サイズ</dd><dt>搭載</dt><dd>${s.slots} 機</dd><dt>発艦可能</dt><dd>${s.deployableSlots??s.slots} 機</dd><dt>ハイパードライブ</dt><dd>${s.hyperClass==null?'なし':'クラス '+num(s.hyperClass,2)}</dd>${fleet.mode==='tactical'?`<dt>構造</dt><dd>${fPct(u.hp/u.p.hp)}</dd><dt>シールド</dt><dd>${u.shieldMax?fPct(u.shield/u.shieldMax):'なし'}</dd><dt>パワーセル蓄電</dt><dd>${u.bankMax?fPct((u.bank??0)/u.bankMax):'なし'}</dd><dt>状態</dt><dd class="${u.dead||u.out?'fleet-bad':''}">${fleetStatusText(u)}</dd><dt>装甲</dt><dd>${fPct(u.armor??1)}</dd><dt>兵装エネルギー</dt><dd>${u.p.wCap?fPct((u.energy??0)/u.p.wCap):'—'}</dd><dt>炉心負荷</dt><dd>${fPct(u.load||0)}（誘爆 ${fPct(C.coreDetonation(u.load||0))}）</dd><dt>出力配分</dt><dd>${fleetPowerName(u)}</dd><dt>乗員</dt><dd>${num(Math.round(u.crew??0))} / ${num(u.p.crewNeed||0)} 名</dd>${u.ammo?.some(n=>n>0)||(u.p.modules||[]).some(m=>m.k==='launcher')?`<dt>ミサイル残弾</dt><dd>${num(Math.round((u.ammo||[]).reduce((n,x)=>n+x,0)))} 発</dd>`:''}<dt>出撃中</dt><dd>${Math.floor(u.air)} 機</dd><dt>戦術速度</dt><dd>${(C.len(u.velocity||[0,0,0])/1000).toFixed(2)} km/s</dd><dt>方位</dt><dd>${Math.round(((90-u.yaw*180/Math.PI)%360+360)%360)}°</dd><dt>高度</dt><dd>${(u.pos[1]/1000).toFixed(1)} km</dd>${fleetMapTarget(u)?`<dt>最寄り／指定目標距離</dt><dd>${(C.len(C.sub(fleetMapTarget(u).pos,u.pos))/1000).toFixed(1)} km</dd>`:''}${u.p.slidingHatches?`<dt>発艦ハッチ</dt><dd>${fleetHatchText(u)}</dd>`:''}`:''}</dl>${fleet.mode==='tactical'&&u.p.modules?`<p class="note keep fleet-damage"><b>損傷</b> ${esc(fleetDamageList(u)||'なし')}</p>`:''}</div>`:'<p class="note">艦を選択してください。</p>'}${fleet.mode==='tactical'?`<h4>経過記録</h4><ol class="fleet-log">${fleetLogEvents().slice(-12).map(e=>`<li class="${/撃沈|戦闘不能|誘爆/.test(e.text)?'bad':''}"><time>${fTime(e.time)}</time>${fleetLogSide(e)}${esc(e.text)}</li>`).join('')||'<li>各艦に命令を設定できます。</li>'}</ol><p class="note">青は友軍、赤は敵軍。射撃と損害は同じ時刻の状態から集計します。実行中の命令変更はできません。次のターンで変更できます。</p>`:'<p class="note">艦体・艦橋・兵装は設計画面と共通の部品構成です。艦ごとの拡大率は変えず、実寸比で表示しています。</p>'}`;}
// The log shows finished turns plus the current turn up to the frame on screen.
function fleetLogEvents(){const b=fleet.battle;if(!b)return [];const now=fleet.frame?.time;return [...b.events,...(b.phase==='execute'&&b.last&&now!=null?b.last.events.filter(e=>e.time<=now):[])];}
function fleetLogSide(e){const u=fleetUnits().find(x=>x.id===e.id);return u?`<span class="fleet-log-side ${u.team?'enemy':''}">${u.team?'敵':'友'}</span>`:'';}
function fleetRender(){if(fleet.mode==='design')return;$('#panel').innerHTML=fleetControlsHTML();$('#specSide').innerHTML=fleetDetailsHTML();fleetHud();fleetMapRefreshTools();requestDraw();}
function fleetHud(){if(fleet.mode==='design')return;const b=fleet.battle,review=fleet.mode==='review';$('#fleetHud').innerHTML=`<div class="fleet-hud-title"><span>${review?'観閲式 / 実寸比':'艦隊編成 / 旗艦を選んで出撃'}</span><b>${review?fleetUnits().length+' 隻':`友 ${fleetUnits().filter(u=>u.team===0).length} · 敵 ${fleetUnits().filter(u=>u.team===1).length} 隻`}</b></div><div class="fleet-hud-actions">${review?`<button class="chip" data-fleet-action="clean">${fleet.clean?'操作を表示':'鑑賞表示'}</button>`:`<button class="chip primary" data-fleet-action="space" ${fleetFlag()&&fleetUnits().some(u=>u.team===1)&&!fleet.busy?'':'disabled'}>旗艦で出撃</button>`}<button class="chip" data-fleet-action="fit">全体</button><button class="chip" data-mode="design">設計へ戻る</button></div><p>${fleet.command==='move'?'空白をタップして移動 / 高度 '+fleet.altitude+' m':fleet.command==='attack'?'攻撃する敵艦の記号をタップ':fleet.command==='position'?'配置先をクリック':review?'ドラッグで回転 · ホイールでズーム':'記号を選択 · 友軍の艦を「旗艦にする」で操艦する艦を指定'}</p>`;}
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
function fleetRenderLabels(us){const el=$('#fleetLabels');if(!view||!fleet.labels||fleet.clean){el.innerHTML='';return;}const rect=view.canvas.getBoundingClientRect();el.innerHTML=us.filter(u=>!u.dead).map(u=>{const p=view.project(C.add(u.pos,[0,-u.p.height*.5,0]));if(p[2]<-1||p[2]>1||p[0]<rect.left||p[0]>rect.right||p[1]<rect.top||p[1]>rect.bottom)return '';return `<span class="fleet-label ${u.team?'enemy':''}" style="left:${p[0]-rect.left}px;top:${p[1]-rect.top+15}px"><b>${esc(u.name)}</b>${fleet.mode==='review'?`<small>${fLen(u.p.len)}</small>`:`<small>構造 ${fPct(u.hp/u.p.hp)} · SH ${u.shieldMax?fPct(u.shield/u.shieldMax):'—'}</small>`}</span>`;}).join('');}
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
 if(d.fleetSelect){fleet.selected=d.fleetSelect;fleetRender();return;}if(d.fleetPower){const u=fleetSelected();if(u&&fleetEditable())fleetSetOrder({type:u.order.type,power:d.fleetPower});return;}if(d.fleetTeam!=null){if(fleetCanRefit()){fleet.team=+d.fleetTeam;fleetRender();}return;}if(d.fleetForm){fleet.form=d.fleetForm;fleetArrange();fleetFit();fleetRender();return;}
 const a=d.fleetAction,u=fleetSelected();if(!a)return;
 if(a==='add')return fleetAdd();if(a==='space')return spaceBattleLaunch();if(a==='flagship'){if(u&&u.team===0){fleet.flagship=u.id;toast(u.name+'を旗艦に指定しました');}fleetRender();return;}if(a==='execute')return fleetExecute();if(a==='pause'){if(fleet.battle.phase==='execute'||fleet.replay){fleet.playing=!fleet.playing;fleet.lastClock=0;fleetRender();}return;}
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
 const change=e=>{const d=e.target.dataset,v=e.target.value,u=fleetSelected();if(e.target.id==='fleetSource'){fleet.source=v;return;}if(d.fleetSetting){const k=d.fleetSetting;if(k==='speed')fleet.speed=+v;if(k==='system'&&SYSTEMS[v])fleet.system=v;if(k==='moveX'||k==='moveZ'){fleet[k]=C.clamp(+v||0,-C.FLEET_RULES.maxCoordinate/1000,C.FLEET_RULES.maxCoordinate/1000);return;}if(k==='seconds'&&fleet.battle.phase==='plan')fleet.battle.seconds=C.clamp(+v,5,30);if(k==='altitude')fleet.altitude=C.clamp(+v||0,-15000,15000);if(k==='combat'&&fleetCanRefit()){fleet.battle.combat=v==='1';fleet.team=0;fleetReset();}if(k==='gap'&&fleet.mode==='review'){fleet.gap=+v;fleetArrange();fleetFit();}fleetRender();}if(d.fleetPos!=null&&u&&fleet.mode==='review'&&v!==''&&Number.isFinite(+v)){const r=fleet.review.find(x=>x.id===u.id);if(d.fleetPos==='yaw')r.yaw=+v*Math.PI/180;else r.pos[+d.fleetPos]=C.clamp(+v,-150000,150000);requestDraw();}if(d.fleetOrder&&u&&fleetEditable())fleetSetOrder({type:u.order.type,[d.fleetOrder]:e.target.checked});if(d.fleetAim!=null&&u&&fleetEditable())fleetSetOrder({type:u.order.type,aim:v});};
 $('#panel').addEventListener('change',change);
 window.addEventListener('keydown',e=>{if(fleet.mode==='design'||e.target.matches('input,textarea,select'))return;if(e.code==='Space'){e.preventDefault();if(fleet.battle?.phase==='execute'||fleet.replay){fleet.playing=!fleet.playing;fleet.lastClock=0;fleetRender();}}if(e.key==='Escape'){fleet.command='select';fleet.clean=false;$('#app').classList.remove('fleet-clean');fleetRender();}});
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
  for(const row of rows){while(row.length<4)row.push(0);row[4]=deck;row[5]=keel;if(row.length>6)row[6]=belt;if(row.length>7)row[7]=chine;}
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
 document.body.classList.toggle('render-trouble',!!message||renderHealth.mode==='compat');
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
  if(fleet?.assets)for(const [key,a] of fleet.assets)if((fleet.mode==='review'||trial.battle)&&a.geometry)view.loadFleet(key,a.geometry);
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
 $('#sheet')?.addEventListener('click',e=>{const b=e.target.closest('[data-viewfix]');if(!b)return;closeSheet();renderHealth.automaticRetries=0;if(b.dataset.viewfix==='compat')restoreRenderer(true,false);else restoreRenderer(false,true);});
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

// ---- src/55_voyage.js ----
// ============================================================
// 航行 (voyage): patrol, fleet battle and — in a later version —
// missions. Fleet setup with the order of battle, the operational
// map of the sector, the tactical map of each battle, and the way
// into flying any ship of a battle in 3D. The rules live in Rts.
// ============================================================
const R = Rts;
// Fleet allowances. The enemy is given the same allowance.
const VOY_SCALES = {
 small: {name: '小規模', people: 220000, supply: 260000, capital: 8, ships: 24},
 standard: {name: '標準', people: 700000, supply: 780000, capital: 24, ships: 48},
 large: {name: '大規模', people: 1600000, supply: 1800000, capital: 24, ships: 72},
 // A fleet built round a super star destroyer: the Executor's own crew is in the millions.
 decisive: {name: '決戦（超大型艦を含む）', people: 9000000, supply: 9000000, capital: 24, ships: 72, dread: true}
};
const VOY_SPEEDS = [0, 1, 4, 16, 64];
const voy = {open: false, screen: null, setup: null, w: null, speed: 1, last: 0, designs: new Map(), pending: new Map(), sel: {group: null, sys: null, units: [], wing: null, foe: null}, cmd: null, tab: 'ships', side: true,
 ops: {c: [2500, 2500], k: 0, fitted: false}, tac: {sys: null, c: [0, 0], mpp: 300, fitted: false}, flash: [], seenEv: 0, notes: [], pilot: null, log: []};

// ---------- designs ----------
// Examples come with precomputed profiles; saved and current designs are
// prepared by the engine (the same request also builds their 3D models).
function voyExampleDesigns() {
 const out = [];
 for (const d of Object.values(YardFleetData?.designs || {})) out.push({key: d.key, name: d.name, faction: d.faction || R.SIDE_OF[d.side] || 'empire', side: d.side, cls: d.cls, p: d.p, info: d.info, air: d.air, ground: d.ground, src: 'example'});
 return out.sort((a, b) => (a.faction > b.faction) - (a.faction < b.faction) || b.info.len - a.info.len);
}
function voyDesign(key) { return voy.designs.get(key) || null; }
function voyRegister(d) { voy.designs.set(d.key, d); return d; }
async function voyPrepare(source) {
 // source: 'current' | 'save:<id>' | example key
 if (voy.designs.has(source)) return voy.designs.get(source);
 if (voy.pending.has(source)) return voy.pending.get(source);
 const job = (async () => {
  const a = await fleetAsset(source), S = a.stats, p = a.p;
  const d = {key: a.key, name: p.name || S.name || '設計艦', faction: voy.setup?.own || 'empire', side: '自作艦', cls: S.cls?.name || '', p, info: R.designInfo(S, p), air: a.design?.airWings || [], ground: a.design?.groundForces || [], src: source.startsWith('save:') ? 'save' : source === 'current' ? 'current' : 'example'};
  voy.designs.set(source, d);voy.designs.set(a.key, d);return d;
 })();
 voy.pending.set(source, job);try { return await job; } finally { voy.pending.delete(source); }
}
const voyShort = n => String(n || '').split('｜')[0];

// ---------- fleet setup ----------
function voyNewSetup() {
 const s = {own: 'empire', foe: 'rebel', scale: 'standard', entries: [], next: 1, editing: null, tab: 'air', seed: (Math.random() * 1e6) | 0};
 return s;
}
// The opponent first offered is the navy whose standard fleet comes closest
// to ours in strength.
function voyBestFoe(s) {
 const a = voyStrength(s.entries);if (!(a > 0)) return s.foe;
 const fs = Object.keys(R.FACTIONS).filter(f => f !== s.own && voyExampleDesigns().some(d => d.faction === f));
 let best = s.foe, gap = Infinity;for (const f of fs) { const b = voyStrength(voyAutoFleet(f, s.scale)), g = b > 0 ? Math.abs(Math.log(b / a)) : Infinity; if (g < gap - 1e-9) { gap = g; best = f; } }
 return best;
}
function voyEntryDemand(e) {
 const d = voyDesign(e.key);if (!d) return {people: 0, supply: 0, capital: 0, ships: 0};
 const air = R.airTotals(e.air), troops = (e.ground || []).reduce((n, r) => n + R.regimentTotals(r).troops, 0), one = R.unitDemand(d.info, air.crew, troops);
 return {people: one.people * e.count, supply: one.supply * e.count, capital: d.info.capital ? e.count : 0, ships: e.count};
}
function voyStrength(entries) {
 let n = 0;for (const e of entries) { const d = voyDesign(e.key); if (!d) continue; const u = C.fleetUnit('x', d.key, d.p, 0); n += R.unitStrength(u) * e.count + R.airTotals(e.air).n * 4; }
 return n;
}
function voyTotals(entries) { const t = {people: 0, supply: 0, capital: 0, ships: 0}; for (const e of entries) { const x = voyEntryDemand(e); for (const k in t) t[k] += x[k]; } return t; }
function voyAddEntry(key, count = 1, tg = 1) {
 const s = voy.setup, d = voyDesign(key);if (!s || !d) return null;
 const ex = s.entries.find(e => e.key === key && e.tg === tg);if (ex) { ex.count += count; return ex; }
 // Ground forces ride only when the player embarks them: the fleet battle does not land troops.
 const e = {id: 'e' + (s.next++), key, count, tg, air: R.defaultAir(d.info, s.own), ground: []};
 s.entries.push(e);return e;
}
// A balanced fleet for a faction: capital ships first, then escorts, within the allowance.
// Classes that served more than one navy (the Dreadnaught: the old Republic,
// the Empire and the Alliance).
const VOY_SHARED = {dreadnaught: ['empire', 'rebel', 'republic']};
const voyServes = (d, faction) => d.faction === faction || !!VOY_SHARED[d.key]?.includes(faction);
function voyAutoFleet(faction, scale, avoid = []) {
 const cap = VOY_SCALES[scale] || VOY_SCALES.standard, pool = voyExampleDesigns(), mine = pool.filter(d => voyServes(d, faction)), use = (mine.length ? mine : pool).filter(d => !avoid.includes(d.key) && (cap.dread || d.info.len < 5000));
 // Escorts that would add nothing next to the faction's best ship (unarmed tenders) stay home.
 const str = d => { const u = C.fleetUnit('x', d.key, d.p, 0); return R.unitStrength(u); }, best = Math.max(0, ...use.filter(d => d.info.len < 5000).map(str));
 const capitals = use.filter(d => d.info.capital).sort((a, b) => b.info.len - a.info.len), escorts0 = use.filter(d => !d.info.capital).sort((a, b) => b.info.len - a.info.len), escorts = escorts0.filter(d => str(d) >= best * .01).length ? escorts0.filter(d => str(d) >= best * .01) : escorts0;
 const entries = [], tmp = {setup: {own: faction}};let next = 1;
 const add = (d, tg) => { let e = entries.find(x => x.key === d.key && x.tg === tg); if (!e) { e = {id: 'a' + next++, key: d.key, count: 0, tg, air: R.defaultAir(d.info, faction), ground: []}; entries.push(e); } e.count++; return e; };
 const fits = () => { const t = voyTotals(entries); return t.people <= cap.people && t.supply <= cap.supply && t.capital <= cap.capital && t.ships <= cap.ships; };
 // Classes are added in turn; one that no longer fits drops out and the rest go on.
 // Star destroyers keep a fifth of the crew allowance free for the escorts.
 const fill = (list, keep) => { const rot = list.slice(); for (let k = 0; rot.length && k < 800; k++) { const d = rot[k % rot.length], e = add(d, 1 + (k % 3)); if (!fits() || keep && voyTotals(entries).people > cap.people * .78) { e.count--; if (!e.count) entries.splice(entries.indexOf(e), 1); rot.splice(rot.indexOf(d), 1); } } };
 fill(capitals, true);fill(escorts, false);
 // A faction without star destroyers still fills its allowance with its largest ships.
 if (!entries.length && use.length) add(use[0], 1);
 return entries;
}
// The toast lives with whichever layer is showing.
function voyToast(on) { const t = $('#toast'), hb = $('.hudbottom'); if (!t) return; if (on) $('#voyage').appendChild(t); else if (hb) hb.insertBefore(t, hb.firstChild); }
function voyOpen(screen = 'setup') {
 voy.open = true;$('#voyage').hidden = false;document.body.classList.add('voy-on');voyToast(true);
 if (!voy.designs.size) for (const d of voyExampleDesigns()) voyRegister(d);
 if (!voy.setup) { voy.setup = voyNewSetup(); for (const e of voyAutoFleet(voy.setup.own, voy.setup.scale)) voy.setup.entries.push({...e, id: 'e' + (voy.setup.next++), ground: []}); voy.setup.foe = voyBestFoe(voy.setup); }
 voyShow(screen);
}
function voyClose() {
 voy.open = false;voy.screen = null;$('#voyage').hidden = true;document.body.classList.remove('voy-on');voyToast(false);requestDraw();
}
function voyShow(screen) {
 voy.screen = screen;for (const id of ['voySetup', 'voyMapScreen']) $('#' + id).hidden = true;$('#voySheet').hidden = true;
 if (screen === 'setup') { $('#voySetup').hidden = false; voyRenderSetup(); }
 else { $('#voyMapScreen').hidden = false; $('#voyMapScreen').dataset.mode = screen; voyMapResize(); voyRenderSide(); voyRenderHud(); }
}
const pct = (a, b) => b > 0 ? Math.min(999, Math.round(a / b * 100)) : 0;
function voyBar(label, v, max, fmt = x => num(Math.round(x))) {
 const over = v > max, f = max > 0 ? Math.min(1, v / max) : 0;
 return `<div class="vbar${over ? ' over' : ''}"><span>${label}</span><i><em style="width:${(f * 100).toFixed(1)}%"></em></i><b>${fmt(v)} / ${fmt(max)}</b></div>`;
}
function voyFactionOptions(cur) { return Object.entries(R.FACTIONS).map(([k, f]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(f.name)}</option>`).join(''); }
function voyDesignOptions() {
 const ex = voyExampleDesigns(), by = {};for (const d of ex) (by[d.faction] || (by[d.faction] = [])).push(d);
 const groups = Object.entries(by).map(([f, list]) => `<optgroup label="${esc(R.FACTIONS[f]?.name || f)}">${list.map(d => `<option value="${esc(d.key)}">${esc(voyShort(d.name))}（${fLen(d.info.len)}）</option>`).join('')}</optgroup>`).join('');
 const saves = (voy.saves || []).map(r => `<option value="save:${esc(r.id)}">${esc(r.name)}（${fLen(r.len || 0)}）</option>`).join('');
 return `${ship ? `<optgroup label="設計中の艦"><option value="current">${esc(ship.name)}（${fLen(ship.hull.L)}）</option></optgroup>` : ''}${saves ? `<optgroup label="保存した設計">${saves}</optgroup>` : ''}${groups}`;
}
function voyRenderSetup() {
 const s = voy.setup, cap = VOY_SCALES[s.scale], t = voyTotals(s.entries), ok = s.entries.length && t.people <= cap.people && t.supply <= cap.supply && t.capital <= cap.capital && t.ships <= cap.ships;
 const tgs = [1, 2, 3, 4];
 $('#voySetup').innerHTML = `<header class="voy-head"><div><span class="eyebrow">航行 · 艦隊戦</span><h2>艦隊編成</h2></div><div class="voy-head-go"><button type="button" class="btn ghost" data-voy="back">タイトルへ</button><button type="button" class="btn primary" data-voy="start" ${ok ? '' : 'disabled'}>出撃</button></div></header>
 <div class="voy-setup">
  <section class="voy-card"><h3>陣営と規模</h3>
   <div class="voy-row"><label>自軍<select data-voyset="own">${voyFactionOptions(s.own)}</select></label><label>敵軍<select data-voyset="foe">${voyFactionOptions(s.foe)}</select></label><label>規模<select data-voyset="scale">${Object.entries(VOY_SCALES).map(([k, v]) => `<option value="${k}" ${k === s.scale ? 'selected' : ''}>${v.name}</option>`).join('')}</select></label></div>
   <p class="note">セクター「${esc(R.SECTOR_DEFS['M-10'].name)}（グリッド M-10・一辺 5,000 光年）」で、同じ枠で編成された敵艦隊（AI）と戦います。作戦図で部隊を星系へジャンプさせて敵を探し、交戦は戦術図でリアルタイムに指揮します。どの艦も3Dで操艦できます。</p>
  </section>
  <section class="voy-card"><h3>編成枠</h3>${voyBalanceHTML()}
   ${voyBar('総乗員数', t.people, cap.people)}${voyBar('物資', t.supply, cap.supply, x => num(Math.round(x)) + ' t')}${voyBar('スター・デストロイヤー級（全長900 m以上）', t.capital, cap.capital, x => x + ' 隻')}${voyBar('艦艇数', t.ships, cap.ships, x => x + ' 隻')}
   <p class="note">乗員数は艦の乗組員・搭乗員（艦載機の操縦士）・乗艦した陸戦隊の合計。物資は乗員の糧食と艦の質量に応じた補給品です。艦隊戦では陸戦隊は上陸しないため、乗艦させると枠だけを使います。</p>
  </section>
  <section class="voy-card voy-roster"><div class="voy-card-head"><h3>艦隊</h3><button type="button" class="btn sm ghost" data-voy="auto">標準艦隊で編成し直す</button></div>
   <div class="voy-add"><select data-voyadd aria-label="追加する艦">${voyDesignOptions()}</select><label>隻数<input type="number" data-voyaddn value="1" min="1" max="24"></label><label>部隊<select data-voyaddtg>${tgs.map(g => `<option value="${g}">第${g}任務部隊</option>`).join('')}</select></label><button type="button" class="btn sm" data-voy="add">追加</button></div>
   <div class="voy-entries">${s.entries.length ? s.entries.map(e => voyEntryHTML(e)).join('') : '<p class="muted">艦がありません。上から追加してください。</p>'}</div>
  </section>
  <section class="voy-card"><h3>飛行団と陸戦隊</h3>${voyOrbatSummary()}</section>
 </div>`;
}
function voyEntryHTML(e) {
 const d = voyDesign(e.key);if (!d) return `<div class="voy-entry"><b>準備中…</b></div>`;
 const air = R.airTotals(e.air), gr = (e.ground || []).map(r => R.regimentTotals(r)), troops = gr.reduce((n, x) => n + x.troops, 0), veh = gr.reduce((n, x) => n + x.size, 0), dem = voyEntryDemand(e);
 const airOver = air.size > (d.info.slotCap || 0) + 1e-6, trOver = troops > (d.info.troopCap || 0), vOver = veh > (d.info.vehicleCap || 0) + 1e-6;
 return `<div class="voy-entry" data-entry="${e.id}"><div class="ve-name"><b>${esc(voyShort(d.name))}</b><small>${esc(R.FACTIONS[d.faction]?.short || '')} · ${fLen(d.info.len)} · 乗員 ${num(d.info.crew)} · ハイパードライブ ${d.info.hyper == null ? 'なし' : 'クラス ' + d.info.hyper.toFixed(1)}</small></div>
 <div class="ve-count"><button type="button" class="btn sm ghost" data-ve="minus" aria-label="1隻減らす">−</button><b>${e.count}</b><span>隻</span><button type="button" class="btn sm ghost" data-ve="plus" aria-label="1隻増やす">＋</button></div>
 <label class="ve-tg">部隊<select data-ve="tg">${[1, 2, 3, 4].map(g => `<option value="${g}" ${g === e.tg ? 'selected' : ''}>第${g}</option>`).join('')}</select></label>
 <button type="button" class="ve-orbat${airOver ? ' bad' : ''}" data-ve="air"><span>航空</span><b>${air.n ? `${num(air.n)} 機 · ${e.air.length} 中隊` : d.info.slotCap ? '未搭載' : '格納庫なし'}</b></button>
 <button type="button" class="ve-orbat${trOver || vOver ? ' bad' : ''}" data-ve="ground"><span>陸戦</span><b>${troops ? `${num(troops)} 名 · ${e.ground.length} 個連隊` : d.info.troopCap ? '未乗艦' : '兵員区画なし'}</b></button>
 <small class="ve-dem">1隻あたり 乗員 ${num(Math.round(dem.people / e.count))} · 物資 ${num(Math.round(dem.supply / e.count))} t</small>
 <button type="button" class="btn sm ghost ve-x" data-ve="remove" aria-label="この行を削除">×</button></div>`;
}
// The enemy is built from its own faction's designs within the same allowance;
// the readout shows how evenly the two fleets are matched.
function voyBalanceHTML() {
 const s = voy.setup, foe = voyAutoFleet(s.foe, s.scale), a = voyStrength(s.entries), b = voyStrength(foe), r = a > 0 ? b / a : 0, n = foe.reduce((k, e) => k + e.count, 0);
 const word = !a ? '' : r > 1.4 ? '敵が優勢' : r > 1.15 ? '敵がやや優勢' : r < .7 ? '自軍が優勢' : r < .87 ? '自軍がやや優勢' : 'ほぼ互角';
 return `<div class="vbal"><span>推定戦力比</span><b>自軍 1 : 敵 ${a ? (r > 0 && r < .01 ? '0.01未満' : r.toFixed(2)) : '—'}</b><small>${esc(word)}（敵は${esc(R.FACTIONS[s.foe].name)}の艦 ${n} 隻で編成）</small></div>${r && (r > 1.6 || r < .6) ? '<p class="note">陣営によって作例の艦の大きさが大きく違います。互角に戦うには陣営や規模を変えてください。</p>' : ''}`;
}
// The order of battle as it will fly: one air group per task group, a wing
// per six squadrons of each carrier; the ground forces regiment by regiment.
function voyOrbatSummary() {
 const s = voy.setup, rows = [];
 for (const tg of [1, 2, 3, 4]) {
  const es = s.entries.filter(e => e.tg === tg);if (!es.length) continue;let wings = 0, squads = 0, craft = 0, regs = 0, troops = 0;const veh = {};
  for (const e of es) { const per = new Set(e.air.map(q => q.wingNo || 1)).size; wings += per * e.count; squads += e.air.length * e.count; craft += R.airTotals(e.air).n * e.count; for (const r of e.ground || []) { const t = R.regimentTotals(r); regs += e.count; troops += t.troops * e.count; for (const [k, n] of Object.entries(t.vehicles)) veh[k] = (veh[k] || 0) + n * e.count; } }
  rows.push(`<div class="voy-orbat-row"><b>第${tg}任務部隊</b><span>第${tg}飛行団：飛行隊 ${wings} · 中隊 ${squads} · ${num(craft)} 機</span><span>陸戦隊：${regs} 個連隊 · ${num(troops)} 名${Object.keys(veh).length ? ' · ' + Object.entries(veh).map(([k, n]) => `${R.VEHICLES[k]?.name || k} ${n}`).join('・') : ''}</span></div>`);
 }
 return rows.join('') + '<p class="note">各艦の「航空」「陸戦」で、中隊（12機）を飛行隊（6個中隊）に、中隊（144名）を大隊・連隊に組みます。戦術図では飛行隊ごとに攻撃（進入方向）・制空・直掩を命じます。陸戦隊は次の版の任務戦で使います。</p>';
}
// ---- the order of battle of one entry (applies to every ship of the row) ----
function voyOrbatSheet() {
 const s = voy.setup, e = s.entries.find(x => x.id === s.editing);if (!e) { $('#voySheet').hidden = true; return; }
 const d = voyDesign(e.key), tab = s.tab, el = $('#voySheet');el.hidden = false;
 let body = '';
 if (tab === 'air') {
  const air = R.airTotals(e.air), cap = d.info.slotCap || 0, wings = [...new Set(e.air.map(q => q.wingNo || 1))].sort((a, b) => a - b);
  body = `${voyBar('格納庫（機体の大きさの合計）', air.size, cap, x => num(x, 1))}
  ${wings.map(wn => `<div class="vo-wing"><h4>第${wn}飛行隊</h4>${e.air.map((q, i) => (q.wingNo || 1) !== wn ? '' : `<div class="vo-sq"><select data-sq="${i}" data-sqk="craft">${Object.entries(R.CRAFT).map(([k, c]) => `<option value="${k}" ${k === q.craft ? 'selected' : ''}>${esc(c.name)}（${R.ROLE_NAME[c.role]}）</option>`).join('')}</select><label>機数<input type="number" data-sq="${i}" data-sqk="n" value="${q.n}" min="1" max="${R.RULES.maxSquadSize}"></label><label>飛行隊<input type="number" data-sq="${i}" data-sqk="wingNo" value="${q.wingNo || 1}" min="1" max="99"></label><button type="button" class="btn sm ghost" data-sqdel="${i}" aria-label="中隊を外す">×</button></div>`).join('')}</div>`).join('') || '<p class="muted">中隊がありません。</p>'}
  <div class="voy-row"><button type="button" class="btn sm" data-vo="sqadd">中隊を追加</button><button type="button" class="btn sm ghost" data-vo="airdefault">標準の搭載に戻す</button><button type="button" class="btn sm ghost" data-vo="airclear">すべて降ろす</button></div>
  <p class="note">中隊は同じ機種12機が基本（大型空母は最大${R.RULES.maxSquadSize}機）。飛行隊の番号で中隊をまとめ、戦術図では飛行隊ごとに命令します。</p>`;
 } else {
  const gs = (e.ground || []).map(r => R.regimentTotals(r)), troops = gs.reduce((n, x) => n + x.troops, 0), veh = gs.reduce((n, x) => n + x.size, 0);
  body = `${voyBar('兵員区画', troops, d.info.troopCap || 0, x => num(Math.round(x)) + ' 名')}${voyBar('車両（車両区画・貨物区画）', veh, d.info.vehicleCap || 0, x => num(x, 1))}
  ${(e.ground || []).map((r, ri) => { const t = R.regimentTotals(r); return `<details class="vo-reg"><summary><b>${esc(r.name)}</b><span>${num(t.troops)} 名${Object.keys(t.vehicles).length ? ' · ' + Object.entries(t.vehicles).map(([k, n]) => `${R.VEHICLES[k]?.name || k} ${n}`).join('・') : ''}</span><button type="button" class="btn sm ghost" data-regdel="${ri}" aria-label="連隊を外す">×</button></summary>
   ${r.battalions.map((b, bi) => `<div class="vo-bat"><h5>${esc(b.name)}</h5>${b.companies.map((c, ci) => `<div class="vo-co"><span>${esc(c.name)}</span><label>兵員<input type="number" data-co="${ri}.${bi}.${ci}" data-cok="troops" value="${c.troops}" min="0" max="600"></label>${voyVehicleSelect(ri, bi, ci, c, voy.setup.own)}</div>`).join('')}</div>`).join('')}</details>`; }).join('') || '<p class="muted">連隊がありません。</p>'}
  <div class="voy-row"><button type="button" class="btn sm" data-vo="regadd">連隊を追加（${esc(R.REGIMENT_TEMPLATES[voy.setup.own]?.name || '連隊')}）</button><button type="button" class="btn sm ghost" data-vo="grclear">すべて降ろす</button></div>
  <p class="note">連隊は4個大隊、大隊は4個中隊（144名）。中隊ごとに AT-AT などの歩行機・車両を配備します。陸戦隊は次の版の任務戦（惑星攻略）で上陸させます。</p>`;
 }
 el.innerHTML = `<div class="voy-sheet-card" role="dialog" aria-label="編成の詳細"><div class="voy-sheet-head"><div><span class="eyebrow">${esc(voyShort(d.name))} · ${e.count} 隻（各艦の搭載）</span><h3>${tab === 'air' ? '航空隊' : '陸戦隊'}の編成</h3></div><div class="seg" role="group"><button type="button" data-vo="tab:air" aria-pressed="${tab === 'air'}">航空隊</button><button type="button" data-vo="tab:ground" aria-pressed="${tab === 'ground'}">陸戦隊</button></div><button type="button" class="btn sm" data-vo="close">閉じる</button></div><div class="voy-sheet-body">${body}</div></div>`;
}
function voyVehicleSelect(ri, bi, ci, c, faction) {
 const ks = Object.entries(R.VEHICLES).filter(([, v]) => v.side === 'any' || v.side === faction || faction === 'empire' && v.side === 'empire').map(([k]) => k);
 return `<span class="vo-veh">${ks.map(k => `<label title="${esc(R.VEHICLES[k].note)}">${esc(R.VEHICLES[k].name)}<input type="number" data-co="${ri}.${bi}.${ci}" data-cov="${k}" value="${c.vehicles?.[k] || 0}" min="0" max="40"></label>`).join('')}</span>`;
}
function voyBindSetup() {
 const root = $('#voyage');
 root.addEventListener('change', e => {
  const t = e.target, s = voy.setup;if (!s) return;
  if (t.dataset.voyset) { const k = t.dataset.voyset; s[k] = t.value; if (k === 'own') { for (const x of s.entries) { const d = voyDesign(x.key); if (d) { x.air = R.defaultAir(d.info, s.own); x.ground = []; } } } voyRenderSetup(); return; }
  const row = t.closest('[data-entry]');if (row && t.dataset.ve === 'tg') { const x = s.entries.find(q => q.id === row.dataset.entry); if (x) x.tg = +t.value; voyRenderSetup(); return; }
  if (t.dataset.sq != null) { const x = s.entries.find(q => q.id === s.editing); const q = x?.air[+t.dataset.sq]; if (!q) return; const k = t.dataset.sqk; if (k === 'craft') q.craft = t.value; else q[k] = C.clamp(Math.round(+t.value || 1), 1, k === 'n' ? R.RULES.maxSquadSize : 99); if (k === 'craft') { const c = R.CRAFT[q.craft]; q.name = `${R.ROLE_NAME[c.role]}中隊`; } voyOrbatSheet(); voyRenderSetup(); return; }
  if (t.dataset.co) { const x = s.entries.find(q => q.id === s.editing), [ri, bi, ci] = t.dataset.co.split('.').map(Number), c = x?.ground?.[ri]?.battalions?.[bi]?.companies?.[ci]; if (!c) return; if (t.dataset.cok) c.troops = C.clamp(Math.round(+t.value || 0), 0, 600); else { c.vehicles = c.vehicles || {}; c.vehicles[t.dataset.cov] = C.clamp(Math.round(+t.value || 0), 0, 40); } voyOrbatSheet(); voyRenderSetup(); return; }
 });
 root.addEventListener('click', async e => {
  const b = e.target.closest('button');if (!b || b.disabled) return;const s = voy.setup, d = b.dataset;
  if (d.voy === 'back') { voyClose(); showTitle('voyage'); return; }
  if (d.voy === 'auto') { s.entries = []; for (const x of voyAutoFleet(s.own, s.scale)) s.entries.push({...x, id: 'e' + (s.next++), ground: []}); voyRenderSetup(); return; }
  if (d.voy === 'add') { const key = $('[data-voyadd]').value, n = C.clamp(+$('[data-voyaddn]').value || 1, 1, 24), tg = +$('[data-voyaddtg]').value || 1; if (!key) return; b.disabled = true; b.textContent = '準備中…'; try { const des = await voyPrepare(key); voyAddEntry(des.key, n, tg); } catch (err) { console.error(err); toast('艦を準備できません：' + esc(err.message || err)); } voyRenderSetup(); return; }
  if (d.voy === 'start') { voyStartBattle(); return; }
  const row = b.closest('[data-entry]');
  if (row && d.ve) { const x = s.entries.find(q => q.id === row.dataset.entry); if (!x) return;
   if (d.ve === 'plus') x.count = Math.min(99, x.count + 1); else if (d.ve === 'minus') { x.count--; if (x.count <= 0) s.entries.splice(s.entries.indexOf(x), 1); } else if (d.ve === 'remove') s.entries.splice(s.entries.indexOf(x), 1); else if (d.ve === 'air' || d.ve === 'ground') { s.editing = x.id; s.tab = d.ve; voyOrbatSheet(); return; }
   voyRenderSetup(); return; }
  if (d.vo) { const x = s.entries.find(q => q.id === s.editing), des = x && voyDesign(x.key);
   if (d.vo === 'close') { s.editing = null; $('#voySheet').hidden = true; voyRenderSetup(); return; }
   if (d.vo.startsWith('tab:')) { s.tab = d.vo.slice(4); voyOrbatSheet(); return; }
   if (!x || !des) return;
   if (d.vo === 'sqadd') { const mix = R.CRAFT_MIX[s.own] || R.CRAFT_MIX.empire, last = x.air[x.air.length - 1], wn = last ? (x.air.filter(q => (q.wingNo || 1) === (last.wingNo || 1)).length >= 6 ? (last.wingNo || 1) + 1 : last.wingNo || 1) : 1, craft = mix[x.air.length % mix.length]; x.air.push({craft, n: 12, name: `${R.ROLE_NAME[R.CRAFT[craft].role]}中隊`, wingNo: wn}); }
   if (d.vo === 'airdefault') x.air = R.defaultAir(des.info, s.own);
   if (d.vo === 'airclear') x.air = [];
   if (d.vo === 'regadd') { const tpl = R.REGIMENT_TEMPLATES[s.own] || R.REGIMENT_TEMPLATES.empire; x.ground = x.ground || []; x.ground.push(R.makeRegiment(s.own, `第${x.ground.length + 1}${tpl.name}`)); }
   if (d.vo === 'grclear') x.ground = [];
   voyOrbatSheet(); voyRenderSetup(); return; }
  if (d.sqdel != null) { const x = s.entries.find(q => q.id === s.editing); if (x) x.air.splice(+d.sqdel, 1); voyOrbatSheet(); voyRenderSetup(); return; }
  if (d.regdel != null) { e.preventDefault(); const x = s.entries.find(q => q.id === s.editing); if (x) x.ground.splice(+d.regdel, 1); voyOrbatSheet(); voyRenderSetup(); return; }
 });
}

// ---------- starting a battle ----------
function voyExpand(entries, faction) {
 const out = [], n = {};
 for (const e of entries) { const d = voyDesign(e.key); if (!d) continue; for (let i = 0; i < e.count; i++) { const k = (n[e.key] = (n[e.key] || 0) + 1); out.push({design: e.key, name: `${voyShort(d.name)} ${k}`, tg: e.tg, air: (e.air || []).map(q => ({...q, groupName: `第${e.tg}飛行団`})), ground: e.ground || null, troops: (e.ground || []).reduce((t, r) => t + R.regimentTotals(r).troops, 0)}); } }
 return out;
}
function voyStartBattle() {
 const s = voy.setup, foe = voyAutoFleet(s.foe, s.scale);
 const keys = [...new Set([...s.entries, ...foe].map(e => e.key))], designs = keys.map(voyDesign).filter(Boolean).map(d => ({key: d.key, name: d.name, p: d.p, info: d.info}));
 voy.w = R.createWorld({seed: s.seed, designs, sides: [{faction: s.own, ai: false}, {faction: s.foe, ai: true}], fleets: [voyExpand(s.entries, s.own), voyExpand(foe, s.foe)]});voy.w.onHit = voyOnHit;
 voy.speed = 4;voy.seenEv = 0;voy.notes = [];voy.sel = {group: null, sys: null, units: [], wing: null, foe: null};voy.cmd = null;voy.ops.fitted = false;voy.tac = {sys: null, c: [0, 0], mpp: 300, fitted: false};voy.result = null;
 const first = [...voy.w.groups.values()].find(g => g.side === 0);if (first) voy.sel.group = first.id;
 voyShow('ops');voyNote(`作戦開始：${voy.w.sector.name}。敵艦隊（${R.FACTIONS[s.foe].name}）の位置は不明です。部隊を星系へジャンプさせて探してください。`);
 voyWarm(keys);
}
// The 3D models of every design in the battle are built in the background, so
// that flying a ship later does not wait for them.
async function voyWarm(keys) { for (const k of keys) { if (!voy.w) return; try { await fleetAsset(k); } catch (e) { console.warn('model not ready', k, e.message); } } }
function voyNote(text, sys) { const t = voy.w?.time || 0; if (voy.notes.some(n => n.text === text && t - n.t < 30)) return; voy.notes.unshift({t, text, sys}); voy.notes = voy.notes.slice(0, 6); voyRenderLog(); }

// ---------- the clock and the main loop ----------
function voyLoop(now) {
 const w = voy.w;if (!w || !voy.open || voy.screen === 'setup') { voy.last = now; return; }
 const real = voy.last ? Math.min(.1, (now - voy.last) / 1000) : 0;voy.last = now;
 const ours = [...w.battles.keys()].some(sys => R.systemUnits(w, sys).some(u => u.side === 0));if (ours && voy.speed > 16) { voy.speed = 16; voyRenderHud(); }
 voySim(w, real, voy.speed);
 voyEvents();
 voyDraw();
 if (now - (voy.hudAt || 0) > 250) { voy.hudAt = now; voyRenderHud(); voyRenderSide(true); }
 if (w.result && !voy.result) voyShowResult();
}
// The world advances by as many ticks as fit in the frame's budget; when a big
// battle makes ticks dear, the clock runs slower than asked (shown in the HUD).
const VOY_SIM_MS = 14;
function voySim(w, real, speed) {
 if (!(speed > 0) || w.result || !(real > 0)) { voy.eff = speed; return; }
 const t0 = performance.now(), g0 = w.time, n = R.step(w, real * speed, voy.tickCap || 8), ms = performance.now() - t0;
 if (n > 0) voy.tickMs = voy.tickMs ? voy.tickMs * .9 + ms / n * .1 : ms / n;
 voy.tickCap = C.clamp(Math.floor(VOY_SIM_MS / Math.max(.02, voy.tickMs || 1)), 1, 600);
 voy.eff = (voy.eff ?? speed) * .96 + (w.time - g0) / real * .04;
}
// Events the player should hear about: contacts, battles, losses. A battle
// involving our ships slows the clock to real time.
function voyEvents() {
 const w = voy.w, ev = w.events;let i = ev.length;while (i > 0 && ev[i - 1].n > voy.seenEv) i--;
 for (; i < ev.length; i++) {
  // The battle's own blow-by-blow stays on the tactical map; losses come as world events.
  const e = ev[i];voy.seenEv = e.n;if (e.combat) continue;if (e.side != null && e.side !== 0 && !e.battle && !e.result && !e.sunk) continue;
  if (e.battle && !e.end && R.systemUnits(w, e.sys).some(u => u.side === 0)) { if (voy.speed > 1) voy.speed = 1; toast(`${esc(e.text)} — 戦術図で指揮できます`); voy.battleAlert = e.sys; }
  voyNote((e.sunk && e.side != null && e.side !== 0 ? '敵 ' : '') + e.text, e.sys);
 }
}

// ---------- maps ----------
function voyMapResize() { const c = $('#voyMap'); if (!c) return; const r = c.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1); c.width = Math.max(1, Math.round(r.width * d)); c.height = Math.max(1, Math.round(r.height * d)); c._d = d; }
function voyDraw() {
 const c = $('#voyMap');if (!c || !voy.w) return;const r = c.getBoundingClientRect();if (Math.abs(r.width * (c._d || 1) - c.width) > 2 || Math.abs(r.height * (c._d || 1) - c.height) > 2) voyMapResize();
 const ctx = c.getContext('2d'), d = c._d || 1, W = c.width / d, H = c.height / d;ctx.setTransform(d, 0, 0, d, 0, 0);
 // Map lettering shrinks on short screens (phones held sideways).
 voy.fz = C.clamp(Math.min(H / 640, W / 900), .7, 1);
 if (voy.screen === 'tac') voyDrawTac(ctx, W, H); else voyDrawOps(ctx, W, H);
}
const VC = {own: '#7fd3ff', ownDim: '#4d8fae', foe: '#ff8a70', foeDim: '#a85a4a', sys: '#9aa8b4', major: '#e9eef2', grid: 'rgba(120,170,200,.10)', grid2: 'rgba(120,170,200,.22)', bg: '#05080c', battle: '#ffb85a', ink: '#dbe5e8', dim: '#7d8b95'};
const KIND_COLOR = {capital: '#ffe3a8', shipyard: '#bfe3ff', habitable: '#a6e3b0', industrial: '#d9c79b', outpost: '#c3c9cf', mining: '#c9b8a3', barren: '#6f7a83', gas: '#d8a978', ice: '#a9d3e8', nebula: '#b69bd6'};
// The part of the canvas not covered by the top bar and the side panel.
function voyFree(W, H) { const side = $('#voySide'), hud = $('#voyHud'), c = $('#voyMap').getBoundingClientRect(); let r = W, b = H, t = 0; if (side && !side.hidden) { const q = side.getBoundingClientRect(); if (q.width && q.height) { if (q.height > H * .6) r = Math.min(r, q.left - c.left - 8); else b = Math.min(b, q.top - c.top - 8 - 56); } } if (hud) t = hud.getBoundingClientRect().bottom - c.top; if (H < 500 && r < W) b = Math.min(b, H - 30); return {x0: 0, x1: Math.max(W * .35, r), y0: Math.max(0, t), y1: Math.max(H * .35, b)}; }
function voyOpsFit(W, H) { const o = voy.ops, S = voy.w.sector, f = voyFree(W, H), fw = f.x1 - f.x0, fh = f.y1 - f.y0;o.auto = true;o.y0 = f.y0;o.y1 = f.y1; o.k = Math.min(fw, fh) * .92 / S.size; o.c = [S.size / 2 - ((f.x0 + f.x1) / 2 - W / 2) / o.k, S.size / 2 - ((f.y0 + f.y1) / 2 - H / 2) / o.k]; o.fitted = true; }
// A map the player has not moved is fitted again when the bars around it change size
// (the top bar gains a row when a battle starts, the side panel grows or shrinks).
function voyFitStale(m, W, H) { if (!m.auto) return false; const f = voyFree(W, H); return Math.abs(f.y0 - m.y0) > 6 || Math.abs(f.y1 - m.y1) > 6; }
const opsP = (p, W, H) => { const o = voy.ops; return [W / 2 + (p[0] - o.c[0]) * o.k, H / 2 + (p[1] - o.c[1]) * o.k]; };
function voyGroupPos(g) {
 const S = voy.w.sector;if (g.sys != null) return S.systems[g.sys].pos;
 if (g.transit) { const a = S.systems[g.transit.from].pos, b = S.systems[g.transit.to].pos, f = C.clamp((voy.w.time - g.transit.t0) / Math.max(1, g.transit.t1 - g.transit.t0), 0, 1); return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]; }
 return [0, 0];
}
function voyDrawOps(ctx, W, H) {
 const w = voy.w, S = w.sector, me = w.sides[0];if (!voy.ops.fitted || voyFitStale(voy.ops, W, H)) voyOpsFit(W, H);
 const P = p => opsP(p, W, H), k = voy.ops.k, now = performance.now() / 1000, font = getComputedStyle(document.body).fontFamily, label = voyLabeler(ctx, W), names = [];
 ctx.fillStyle = VC.bg;ctx.fillRect(0, 0, W, H);
 // Grid: the 5,000-ly square of the galaxy map and 500-ly lines inside it.
 const a = P([0, 0]), b = P([S.size, S.size]);ctx.lineWidth = 1;
 for (let i = 0; i <= 10; i++) { const x = a[0] + (b[0] - a[0]) * i / 10, y = a[1] + (b[1] - a[1]) * i / 10; ctx.strokeStyle = i % 10 ? VC.grid : VC.grid2; ctx.beginPath(); ctx.moveTo(x, a[1]); ctx.lineTo(x, b[1]); ctx.moveTo(a[0], y); ctx.lineTo(b[0], y); ctx.stroke(); }
 ctx.fillStyle = 'rgba(160,200,220,.45)';ctx.font = `600 ${(11 * voy.fz).toFixed(1)}px ` + getComputedStyle(document.body).fontFamily;if (a[1] - 6 > (voyFree(W, H).y0 + 10)) ctx.fillText(`グリッド ${S.grid} · ${S.name}　1目盛 500 光年`, a[0] + 6, a[1] - 6);
 // Neighbouring squares, named as on the galaxy map.
 ctx.fillStyle = 'rgba(160,200,220,.22)';for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const col = R.GRID_COLS[S.col + dx], row = S.row + dy; if (!col || row < 1) continue; const q = P([S.size * (.5 + dx * .62), S.size * (.5 + dy * .62)]); ctx.fillText(`${col}-${row}`, C.clamp(q[0] - 14, 4, W - 40), C.clamp(q[1], 14, H - 4)); }
 // Jump preview for the selected group.
 const g = voy.sel.group && w.groups.get(voy.sel.group);
 if (g && voy.sel.dest != null && g.sys != null) { const p = P(S.systems[g.sys].pos), q = P(S.systems[voy.sel.dest].pos); ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(127,211,255,.7)'; ctx.beginPath(); ctx.moveTo(...p); ctx.lineTo(...q); ctx.stroke(); ctx.setLineDash([]); }
 // Systems.
 for (const s of S.systems) {
  const [x, y] = P(s.pos), r = s.major ? 6 : s.inhabited ? 4.2 : 2.6, seen = me.seen.has(s.id);
  ctx.globalAlpha = seen || s.inhabited ? 1 : .7;ctx.fillStyle = KIND_COLOR[s.kind] || VC.sys;ctx.beginPath();ctx.arc(x, y, r, 0, Math.PI * 2);ctx.fill();
  if (s.major) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.stroke(); }
  if (voy.sel.sys === s.id || voy.sel.dest === s.id) { ctx.strokeStyle = VC.own; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
  if (s.major || s.inhabited || k > .22 || w.battles.has(s.id) || [...w.groups.values()].some(h => h.side === 0 && h.sys === s.id)) names.push({s, x, y, r});
  label.block(x - r - 1, y - r - 1, x + r + 1, y + r + 1);
  ctx.globalAlpha = 1;
  if (w.battles.has(s.id)) { const pr = r + 9 + 4 * Math.sin(now * 5); ctx.strokeStyle = VC.battle; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, pr, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
 }
 // Our groups stack above their system, enemy contacts below it, the name to its side.
 // Enemy contacts: a diamond where last seen, faded with age (the contacts at one
 // system shown together, as fresh as the latest); a dashed ring while in hyperspace.
 const bySys = new Map();
 for (const c of me.contacts.values()) {
  if (c.transit) { const p = P(S.systems[c.sys].pos); ctx.globalAlpha = C.clamp(1 - (w.time - c.time) / R.RULES.contactTTL, .25, 1); ctx.strokeStyle = VC.foe; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(p[0], p[1], 12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; continue; }
  const m = bySys.get(c.sys);if (!m) bySys.set(c.sys, {ships: c.ships, exact: !!c.exact, time: c.time, fresh: w.time - c.time < 120 ? c.ships : 0});else { m.ships += c.ships; m.exact = m.exact && !!c.exact; m.time = Math.max(m.time, c.time); if (w.time - c.time < 120) m.fresh += c.ships; }
 }
 for (const [sys, c] of bySys) {
  const age = w.time - c.time, p = P(S.systems[sys].pos), q = [p[0] + 4, p[1] + 17 * voy.fz];ctx.globalAlpha = C.clamp(1 - age / R.RULES.contactTTL, .25, 1);ctx.fillStyle = VC.foe;
  ctx.beginPath();ctx.moveTo(q[0], q[1] - 6);ctx.lineTo(q[0] + 6, q[1]);ctx.lineTo(q[0], q[1] + 6);ctx.lineTo(q[0] - 6, q[1]);ctx.closePath();ctx.fill();label.block(q[0] - 6, q[1] - 6, q[0] + 6, q[1] + 6);
  label(`敵 ${c.exact ? c.ships : '約' + c.ships} 隻${age > 120 ? ` · ${Math.round(age / 60)}分前` : ''}`, wd => [[q[0] + 9, q[1] + 4], [q[0] - 9 - wd, q[1] + 4], [q[0] - wd / 2, q[1] + 18]], VC.foe, '700 10.5px ' + font, true);
  ctx.globalAlpha = 1;
 }
 // Our groups: chevrons at their systems (stacked), or on their way through hyperspace.
 const stack = new Map();
 for (const h of w.groups.values()) {
  if (h.side !== 0 || !h.units.some(id => R.alive(w.units.get(id)))) continue;const pos = voyGroupPos(h);let [x, y] = P(pos);
  if (h.sys != null) { const n = stack.get(h.sys) || 0; stack.set(h.sys, n + 1); y -= (14 + n * 15) * voy.fz; x -= 2; }
  if (h.transit) { const q = P(S.systems[h.transit.to].pos); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(127,211,255,.45)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(...q); ctx.stroke(); ctx.setLineDash([]); }
  const sel = voy.sel.group === h.id;ctx.fillStyle = sel ? '#ffffff' : VC.own;ctx.strokeStyle = '#06222e';ctx.beginPath();ctx.moveTo(x - 7, y + 5);ctx.lineTo(x, y - 6);ctx.lineTo(x + 7, y + 5);ctx.lineTo(x, y + 1);ctx.closePath();ctx.fill();ctx.stroke();label.block(x - 7, y - 6, x + 7, y + 5);
  const ships = h.units.filter(id => R.alive(w.units.get(id))).length;
  label(`${h.name.replace('任務部隊', 'TF')} ${ships}隻${h.transit ? ` · ${voyClock(h.transit.t1 - w.time)}` : h.spool ? ' · 発進準備' : ''}`, wd => [[x + 10, y + 4], [x - 10 - wd, y + 4], [x + 10, y - 9]], sel ? '#ffffff' : '#bfe9ff', '700 10.5px ' + font, true);
 }
 // System names last, where they fit: the major systems first.
 // Systems with a battle, with our forces or selected are always named, then the major ones.
 const ours = new Set([...w.groups.values()].filter(h => h.side === 0 && h.sys != null).map(h => h.sys)), must = s => w.battles.has(s.id) || ours.has(s.id) || voy.sel.sys === s.id || voy.sel.dest === s.id;
 names.sort((a, b) => (must(b.s) - must(a.s)) || (b.s.major - a.s.major) || (b.s.inhabited - a.s.inhabited));
 for (const {s, x, y, r} of names) { ctx.globalAlpha = me.seen.has(s.id) || s.inhabited ? 1 : .7; label(s.name, wd => [[x + r + 4, y + 4], [x - r - 4 - wd, y + 4], [x - wd / 2, y + r + 14], [x - wd / 2, y - r - 5]], s.major ? VC.major : s.inhabited ? '#c9d6dc' : '#7d8b95', (s.major || must(s) ? '700 12px ' : '500 10.5px ') + font, s.major || must(s)); ctx.globalAlpha = 1; }
}
function voyClock(s) { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`; }
// ---- tactical map: one system's battle, seen from above in kilometres ----
function voyTacFit(W, H) {
 const us = R.systemUnits(voy.w, voy.tac.sys);if (!us.length) { voy.tac.c = [0, 0]; voy.tac.mpp = 300; return; }
 let lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];for (const u of us) { lo = [Math.min(lo[0], u.pos[0]), Math.min(lo[1], u.pos[2])]; hi = [Math.max(hi[0], u.pos[0]), Math.max(hi[1], u.pos[2])]; }
 const f = voyFree(W, H), fw = f.x1 - f.x0, fh = f.y1 - f.y0;voy.tac.auto = true;voy.tac.y0 = f.y0;voy.tac.y1 = f.y1;voy.tac.mpp = Math.max(40, Math.max((hi[0] - lo[0] + 30000) / fw, (hi[1] - lo[1] + 30000) / fh) * 1.05);
 voy.tac.c = [(lo[0] + hi[0]) / 2 - ((f.x0 + f.x1) / 2 - W / 2) * voy.tac.mpp, (lo[1] + hi[1]) / 2 - ((f.y0 + f.y1) / 2 - H / 2) * voy.tac.mpp];voy.tac.fitted = true;
}
const tacP = (p, W, H) => { const t = voy.tac; return [W / 2 + (p[0] - t.c[0]) / t.mpp, H / 2 + (p[2] - t.c[1]) / t.mpp]; };
// Labels that keep off each other: each tries its places in turn (a point,
// a list of points, or a function of the text width giving the list) and is
// left out where all are taken, unless forced. Marks can be blocked out too.
function voyLabeler(ctx, W = Infinity) {
 const boxes = [], taken = b => boxes.some(q => b[0] < q[2] && b[2] > q[0] && b[1] < q[3] && b[3] > q[1]);
 // label(text, x, y, color, font, force) or label(text, places, color, font, force)
 const label = (text, x, y, color, font, force) => {
  if (typeof x === 'function' || Array.isArray(x)) { force = font; font = color; color = y; }
  const fz = voy.fz || 1;ctx.font = fz < 1 ? font.replace(/([\d.]+)px/, (m, n) => (n * fz).toFixed(1) + 'px') : font;const wdt = ctx.measureText(text).width, list = typeof x === 'function' ? x(wdt) : Array.isArray(x) ? x : [[x, y]], inside = q => q[0] >= 2 && q[0] + wdt <= W - 2;
  let at = null;for (const q of list) { const b = [q[0] - 1, q[1] - 11 * fz, q[0] + wdt + 1, q[1] + 3 * fz]; if (inside(q) && !taken(b)) { at = q; break; } }
  if (!at) { if (!force) return false; at = list.find(inside) || [C.clamp(list[0][0], 2, Math.max(2, W - 2 - wdt)), list[0][1]]; }
  boxes.push([at[0] - 1, at[1] - 11 * fz, at[0] + wdt + 1, at[1] + 3 * fz]);ctx.fillStyle = color;ctx.fillText(text, at[0], at[1]);return true;
 };
 label.block = (x0, y0, x1, y1) => boxes.push([x0, y0, x1, y1]);
 return label;
}
function voyDrawTac(ctx, W, H) {
 const w = voy.w, sys = voy.tac.sys, t = voy.tac;if (sys == null) return;if (!t.fitted || voyFitStale(t, W, H)) voyTacFit(W, H);const label = voyLabeler(ctx, W);
 const P = p => tacP(p, W, H), font = getComputedStyle(document.body).fontFamily, sel = new Set(voy.sel.units);
 ctx.fillStyle = VC.bg;ctx.fillRect(0, 0, W, H);
 // 10 km grid with a scale bar.
 const step = t.mpp * 90 > 20000 ? 50000 : t.mpp * 90 > 8000 ? 10000 : 5000, x0 = Math.floor((t.c[0] - W / 2 * t.mpp) / step) * step, z0 = Math.floor((t.c[1] - H / 2 * t.mpp) / step) * step;
 ctx.strokeStyle = VC.grid;ctx.lineWidth = 1;ctx.beginPath();for (let x = x0; x < t.c[0] + W / 2 * t.mpp; x += step) { const p = P([x, 0, 0]); ctx.moveTo(p[0], 0); ctx.lineTo(p[0], H); } for (let z = z0; z < t.c[1] + H / 2 * t.mpp; z += step) { const p = P([0, 0, z]); ctx.moveTo(0, p[1]); ctx.lineTo(W, p[1]); } ctx.stroke();
 // The scale sits at the top of the free area, clear of the log at the bottom.
 const fr = voyFree(W, H), sc = `1目盛 ${step / 1000} km`;ctx.fillStyle = 'rgba(160,200,220,.55)';ctx.font = `600 ${(11 * voy.fz).toFixed(1)}px ` + font;ctx.fillText(sc, 10, fr.y0 + 16 * voy.fz);label.block(8, fr.y0 + 2, 14 + ctx.measureText(sc).width, fr.y0 + 20 * voy.fz);
 const us = R.systemUnits(w, sys), byId = new Map(us.map(u => [u.id, u]));
 // Fire: thin lines from each ship to the one it is engaging.
 ctx.lineWidth = 1;for (const u of us) { const f = byId.get(u.firingAt); if (!f || u.out) continue; const a = P(u.pos), b = P(f.pos); ctx.strokeStyle = u.side === 0 ? 'rgba(127,255,170,.28)' : 'rgba(255,120,100,.3)'; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
 // Selected ships: weapon and point-defence ranges, standing orders.
 for (const u of us) { if (!sel.has(u.id)) continue; const a = P(u.pos); ctx.strokeStyle = 'rgba(127,211,255,.35)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.arc(a[0], a[1], R.RULES.range / t.mpp, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = 'rgba(160,255,160,.28)'; ctx.beginPath(); ctx.arc(a[0], a[1], R.RULES.pdRange / t.mpp, 0, Math.PI * 2); ctx.stroke();
  const o = u.order; if (o.type === 'move' && o.point) { const q = P(o.point); ctx.strokeStyle = 'rgba(127,211,255,.8)'; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...q); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, Math.PI * 2); ctx.stroke(); } if (o.type === 'attack' && byId.get(o.target)) { const q = P(byId.get(o.target).pos); ctx.strokeStyle = 'rgba(255,190,110,.85)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...q); ctx.stroke(); ctx.setLineDash([]); } }
 // Missiles.
 for (const m of w.missiles) { if (m.sys !== sys || m.n <= 0) continue; const p = P(m.pos); ctx.fillStyle = m.side === 0 ? '#bdf3ff' : '#ffd2a8'; ctx.beginPath(); ctx.arc(p[0], p[1], 1.6 + Math.min(2, m.n / 6), 0, Math.PI * 2); ctx.fill(); }
 // Squadrons: small arrowheads; zoomed out, one larger arrowhead per wing at its
 // centre, so a carrier's swarm does not hide the ships (drawn over them). Each
 // wing is labelled once.
 const wings = new Map(), arrow = (x, y, hx, hz, z, col, al) => { const ang = Math.atan2(hz, hx), c = Math.cos(ang), sn = Math.sin(ang); ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x + c * z, y + sn * z); ctx.lineTo(x - c * z * .7 - sn * z * .7, y - sn * z * .7 + c * z * .7); ctx.lineTo(x - c * z * .7 + sn * z * .7, y - sn * z * .7 - c * z * .7); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; };
 const merged = t.mpp > 25;
 for (const s of w.squads.values()) {
  if (s.sys !== sys || s.state !== 'out' || s.n <= 0) continue;const [x, y] = P(s.pos), own = s.side === 0, hot = voy.sel.wing === s.wing;
  if (!merged) arrow(x, y, s.h[0], s.h[2], t.mpp < 60 ? 6 : 4.5, hot ? '#ffffff' : own ? '#a8f0ff' : '#ffc29a', hot || t.mpp < 90 ? 1 : .75);
  let g = wings.get(s.wing);if (!g) wings.set(s.wing, g = {x: 0, y: 0, n: 0, k: 0, hx: 0, hz: 0, own, hot});g.x += x;g.y += y;g.n += s.n;g.k++;g.hx += s.h[0];g.hz += s.h[2];
 }
 if (merged) for (const g of wings.values()) arrow(g.x / g.k, g.y / g.k, g.hx || 1, g.hz, C.clamp(3 + Math.sqrt(g.n) * .5, 5, 11), g.hot ? '#ffffff' : g.own ? '#a8f0ff' : '#ffc29a', .9);
 // Ships: a wedge along the heading, sized by length (never smaller than a mark).
 for (const u of us) {
  const [x, y] = P(u.pos), L = Math.max(9, u.p.len / t.mpp), Wd = Math.max(5, (u.p.width || u.p.len * .5) / t.mpp * .9), c = Math.cos(u.yaw), s = Math.sin(u.yaw), own = u.side === 0, col = u.out ? '#8d969c' : own ? VC.own : VC.foe;
  const pt = (f, r) => [x + c * f - s * r, y + s * f + c * r];
  ctx.fillStyle = col;ctx.globalAlpha = u.warp ? .5 : 1;ctx.beginPath();ctx.moveTo(...pt(L * .55, 0));ctx.lineTo(...pt(-L * .45, Wd * .5));ctx.lineTo(...pt(-L * .3, 0));ctx.lineTo(...pt(-L * .45, -Wd * .5));ctx.closePath();ctx.fill();ctx.globalAlpha = 1;
  if (u.shieldMax > 0 && u.shield > 0) { ctx.strokeStyle = `rgba(120,190,255,${(.15 + .55 * u.shield / u.shieldMax).toFixed(2)})`; ctx.beginPath(); ctx.arc(x, y, L * .62 + 3, 0, Math.PI * 2); ctx.stroke(); }
  if (sel.has(u.id) || voy.sel.foe === u.id) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, L * .62 + 7, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1; }
  // A ship on fire flickers orange.
  const burn = (u.fire || []).reduce((a, b) => a + b, 0);if (burn > 0 && !u.dead) { const fl = .6 + .4 * Math.sin(performance.now() / 90 + x); ctx.fillStyle = `rgba(255,${120 + (fl * 80 | 0)},40,${(.5 + .5 * Math.min(1, burn)) * fl})`; ctx.beginPath(); ctx.arc(x + L * .25, y - L * .25, 2.5 + 2 * Math.min(1, burn), 0, Math.PI * 2); ctx.fill(); }
  // Hull sections under the mark, stern to bow.
  const bw = Math.max(22, L * .9), sx = x - bw / 2, sy = y + L * .62 + 6;u.sec.forEach((q, i) => { const f = C.clamp(q.s / q.max, 0, 1); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(sx + i * bw / u.sec.length, sy, bw / u.sec.length - 1, 3); ctx.fillStyle = f > .5 ? '#9be7a6' : f > .2 ? '#ffd27a' : f > 0 ? '#ff8a70' : '#5a2a24'; ctx.fillRect(sx + i * bw / u.sec.length, sy, (bw / u.sec.length - 1) * (f > 0 ? Math.max(.15, f) : 1), 3); });
  u._lab = [x + L * .62 + 6, y - 4, x - L * .62 - 6];
 }
 // Names keep off the ship marks (theirs and their neighbours').
 for (const u of us) { const [x, y] = P(u.pos), r = Math.max(9, u.p.len / t.mpp) * .62 + 3; label.block(x - r, y - r, x + r, y + r + 7); }
 // Labels: selected first, then our ships, then enemies, then wings; none on top of another.
 const order = us.slice().sort((a, b) => (sel.has(b.id) - sel.has(a.id)) || ((a.side === 0) ? -1 : 1) - ((b.side === 0) ? -1 : 1) || b.p.len - a.p.len);
 for (const u of order) if (u._lab) label(shipTag(u.name) + (u.out ? '（戦闘不能）' : u.jump ? '（離脱準備）' : u.manual ? '（操艦中）' : ''), wd => [u._lab, [u._lab[2] - wd, u._lab[1]]], u.side === 0 ? '#cfefff' : '#ffd0c4', '600 10.5px ' + font, sel.has(u.id));
 for (const [id, g] of wings) { const wing = w.wings.get(id); if (!wing) continue; label(`${g.own ? '' : '敵 '}${wing.name.replace(/^.*?\s(第\d+飛行隊)$/, '$1')} ${Math.round(g.n)}機`, g.x / g.k + 8, g.y / g.k - 6, g.hot ? '#ffffff' : g.own ? '#a8f0ff' : '#ffc29a', '600 9.5px ' + font, g.hot); }
}

// ---------- the top bar ----------
function voyRenderHud() {
 const w = voy.w, el = $('#voyHud');if (!el || !w) return;const tac = voy.screen === 'tac', S = w.sector;
 const own = w.sides[0], foe = w.sides[1], ownNow = own.now ?? own.initial, foeKnown = [...own.contacts.values()].reduce((n, c) => n + c.strength, 0);
 const battle = tac ? w.battles.get(voy.tac.sys) : null, alert = voy.battleAlert != null && w.battles.has(voy.battleAlert) && !tac;
 const html = `<div class="vh-l"><b>${tac ? esc(S.systems[voy.tac.sys]?.name || '') + ' 戦術図' : '作戦図'}</b><span>${tac ? (battle ? '交戦 ' + voyClock(w.time - battle.t0) : '交戦なし') : esc(S.name) + ' · ' + S.grid}</span></div>
 <div class="vh-clock"><span>経過</span><b>${voyClock(w.time)}</b>${voy.speed > 1 && voy.eff < voy.speed * .75 ? `<small class="vh-lag" title="艦載機や艦が多く計算が追いつかないため、時間の進みを抑えています">実効 ${voy.eff < 10 ? voy.eff.toFixed(1) : Math.round(voy.eff)}×</small>` : ''}</div>
 <div class="vh-speed seg" role="group" aria-label="時間の速さ">${VOY_SPEEDS.map(v => `<button type="button" data-vspeed="${v}" aria-pressed="${voy.speed === v}">${v ? v + '×' : '❚❚'}</button>`).join('')}</div>
 <div class="vh-str"><span>戦力</span><i><em style="width:${pct(ownNow, own.initial)}%"></em></i><small>自軍 ${pct(ownNow, own.initial)}%</small><small class="foe">敵（推定） ${foeKnown ? Math.round(foeKnown) : '不明'}</small></div>
 <div class="vh-r">${alert ? `<button type="button" class="btn sm warn" data-vgo="tac:${voy.battleAlert}">交戦中：${esc(S.systems[voy.battleAlert].name)}</button>` : ''}${tac ? '<button type="button" class="btn sm" data-vgo="ops">作戦図</button>' : ''}<button type="button" class="btn sm ghost" data-vgo="side" aria-pressed="${voy.side}">一覧</button><button type="button" class="btn sm ghost" data-vgo="quit">終了</button></div>`;
 if (el.innerHTML !== html) el.innerHTML = html;
}
function voyRenderLog() { const el = $('#voyLog'); if (!el) return; const html = voy.notes.slice(0, 4).map(n => `<p><span>${voyClock(n.t)}</span>${esc(n.text)}</p>`).join(''); if (el.innerHTML !== html) el.innerHTML = html; }

// ---------- side panels ----------
const VOY_POWER = [['auto', '自動'], ['cruise', '巡航'], ['balanced', '均衡'], ['weapons', '兵装'], ['shields', '防御'], ['overload', '全力']];
const VOY_AIM = [['auto', '艦全体'], ['reactor', '反応炉'], ['bridge', '艦橋'], ['weapon', '砲塔'], ['engine', '推進'], ['shield', 'シールド']];
const VOY_ORDER = {auto: '自動交戦', hold: '待機', move: '移動', attack: '攻撃'};
function voySecHTML(u) { return `<span class="vsec" aria-label="船体区画">${u.sec.map((q, i) => { const f = C.clamp(q.s / q.max, 0, 1); return `<i class="${f <= 0 ? 'gone' : f < .25 ? 'bad' : f < .6 ? 'mid' : ''}" title="${C.SECTION_NAMES[i]} ${Math.round(f * 100)}%"><em style="width:${Math.round(f * 100)}%"></em></i>`; }).join('')}</span>`; }
function voyUnitState(u) { return u.dead ? '撃沈' : u.out ? '戦闘不能（' + u.out + '）' : u.jump ? '離脱準備' : u.warp ? 'ハイパースペースから出現' : u.sys == null ? 'ハイパースペース' : VOY_ORDER[u.order.type] || ''; }
function voyRenderSide(tick) {
 const el = $('#voySide'), w = voy.w;if (!el || !w) return;el.hidden = !voy.side;if (!voy.side) return;
 if (tick && voy.sidePause) return;
 const html = voy.screen === 'tac' ? voyTacSide() : voyOpsSide();
 if (el.dataset.html !== html) { const t = document.createElement('div'); t.innerHTML = html; voyMorph(el, t); el.dataset.html = html; }
}
// Brings a's children in line with b's, keeping every node that is still the
// same kind of thing: a button whose label or figures changed stays the same
// button, so a tap on it lands even while the battle updates the panel.
function voyMorph(a, b) {
 const an = a.childNodes, bn = [...b.childNodes];
 for (let i = 0; i < bn.length; i++) {
  const x = an[i], y = bn[i];
  if (!x) { a.appendChild(y); continue; }
  if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName) { a.replaceChild(y, x); continue; }
  if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
  for (const at of [...x.attributes]) if (!y.hasAttribute(at.name) && !(at.name === 'open' && x.nodeName === 'DETAILS')) x.removeAttribute(at.name);
  for (const at of y.attributes) if (x.getAttribute(at.name) !== at.value) { x.setAttribute(at.name, at.value); if (at.name === 'value' && 'value' in x && x !== document.activeElement) x.value = at.value; }
  if (x === document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(x.nodeName)) continue;
  voyMorph(x, y);
 }
 while (an.length > bn.length) a.removeChild(a.lastChild);
}
function voyOpsSide() {
 const w = voy.w, S = w.sector, g = voy.sel.group && w.groups.get(voy.sel.group), parts = [];
 if (voy.cmd?.type === 'jump' && g) parts.push(`<p class="vs-hint">ジャンプ先の星系を地図でタップしてください。</p>`);
 if (g && g.side === 0) {
  const us = g.units.map(id => w.units.get(id)).filter(R.alive), hc = R.groupHyper(w, g), where = g.transit ? `ハイパースペース航行中 → ${S.systems[g.transit.to].name}（到着まで ${voyClock(g.transit.t1 - w.time)}）` : g.spool ? `発進準備中（あと ${Math.ceil(g.spool.need - g.spool.t)} 秒）→ ${S.systems[g.spool.dest].name}` : `${S.systems[g.sys].name}${w.battles.has(g.sys) ? ' · 交戦中' : ' · 待機中'}`;
  const dest = voy.sel.dest != null && voy.sel.dest !== g.sys ? voy.sel.dest : null, eta = dest != null ? R.etaTo(w, g.id, dest) : null;
  parts.push(`<div class="vs-card"><div class="vs-head"><h3>${esc(g.name)}</h3><span>${us.length} 隻</span></div><p class="vs-where">${esc(where)}</p>
  <p class="vs-sub">ハイパードライブ ${hc == null ? '使用不能の艦あり' : 'クラス ' + hc.toFixed(1) + '（部隊で最も遅い艦）'}</p>
  <ul class="vs-ships">${us.map(u => `<li><label>${voy.split ? `<input type="checkbox" data-vsplit="${u.id}" ${voy.splitSel?.has(u.id) ? 'checked' : ''}>` : ''}<b>${esc(u.name)}</b></label>${voySecHTML(u)}<small>${esc(voyUnitState(u))}</small></li>`).join('')}</ul>
  ${dest != null ? `<div class="vs-jump"><p>→ <b>${esc(S.systems[dest].name)}</b>（${Math.round(R.sysDistance(S, g.sys ?? g.transit?.to, dest))} 光年）到着まで <b>${eta == null ? '—' : voyClock(eta)}</b></p><div class="vs-acts"><button type="button" class="btn sm primary" data-vact="jump" ${eta == null || g.transit ? 'disabled' : ''}>ジャンプ</button><button type="button" class="btn sm ghost" data-vact="nodest">取消</button></div></div>` : ''}
  <div class="vs-acts">${!g.transit && !g.spool ? `<button type="button" class="btn sm" data-vact="pickdest" aria-pressed="${voy.cmd?.type === 'jump'}">ジャンプ先を選ぶ</button>` : ''}${g.spool ? '<button type="button" class="btn sm ghost" data-vact="cancel">発進を取り消す</button>' : ''}${!g.transit && !g.spool && us.length > 1 ? `<button type="button" class="btn sm ghost" data-vact="split" aria-pressed="${!!voy.split}">${voy.split ? '分割を確定' : '部隊を分割'}</button>` : ''}${voyMergeButtons(g)}${g.sys != null && w.battles.has(g.sys) ? `<button type="button" class="btn sm warn" data-vgo="tac:${g.sys}">戦術図</button>` : ''}</div></div>`);
 } else if (voy.sel.sys != null) {
  const s = S.systems[voy.sel.sys], mine = [...w.groups.values()].filter(h => h.side === 0 && h.sys === s.id), c = [...w.sides[0].contacts.values()].filter(x => x.sys === s.id && !x.transit), seen = w.sides[0].seen.get(s.id);
  parts.push(`<div class="vs-card"><div class="vs-head"><h3>${esc(s.name)}</h3><span>${esc(R.KIND_NAME[s.kind] || '')}</span></div>${s.note ? `<p class="vs-sub">${esc(s.note)}</p>` : ''}<p class="vs-sub">${esc(s.star)}${s.pop ? ' · 人口規模 ' + '●'.repeat(s.pop) : ' · 無人'}${seen != null ? ' · 最終確認 ' + voyClock(w.time - seen) + ' 前' : ' · 未確認'}</p>
  ${mine.length ? `<p>自軍：${mine.map(h => esc(h.name)).join('・')}</p>` : ''}${c.length ? `<p class="foe">敵：${c.map(x => `${x.exact ? x.ships : '約' + x.ships} 隻（${voyClock(w.time - x.time)} 前）`).join('・')}</p>` : ''}
  <p class="vs-sub">ここへ送る部隊</p><ul class="vs-send">${[...w.groups.values()].filter(h => h.side === 0 && h.sys !== s.id && h.units.some(id => R.alive(w.units.get(id)))).map(h => { const eta = R.etaTo(w, h.id, s.id); return `<li><b>${esc(h.name)}</b><small>${eta == null ? 'ジャンプ不能' : '到着まで ' + voyClock(eta)}</small><button type="button" class="btn sm" data-vsend="${h.id}" ${eta == null || h.transit ? 'disabled' : ''}>送る</button></li>`; }).join('') || '<li class="muted">送れる部隊がありません</li>'}</ul>
  ${w.battles.has(s.id) ? `<button type="button" class="btn sm warn" data-vgo="tac:${s.id}">戦術図</button>` : ''}</div>`);
 }
 // All task groups at a glance.
 parts.push(`<div class="vs-card vs-list"><h3>部隊一覧</h3><ul>${[...w.groups.values()].filter(h => h.side === 0 && h.units.some(id => R.alive(w.units.get(id)))).map(h => { const us = h.units.map(id => w.units.get(id)).filter(R.alive), str = us.reduce((n, u) => n + R.unitStruct(u), 0) / Math.max(1, us.length); return `<li class="${voy.sel.group === h.id ? 'on' : ''}"><button type="button" data-vgroup="${h.id}"><b>${esc(h.name)}</b><small>${h.transit ? '→ ' + esc(S.systems[h.transit.to].name) + ' ' + voyClock(h.transit.t1 - w.time) : esc(S.systems[h.sys]?.name || '')}${h.sys != null && w.battles.has(h.sys) ? ' · 交戦中' : ''}</small><span>${us.length} 隻 · 構造 ${Math.round(str * 100)}%</span></button></li>`; }).join('')}</ul></div>`);
 return parts.join('');
}
function voyMergeButtons(g) { if (g.sys == null || g.transit || g.spool) return ''; const w = voy.w; return [...w.groups.values()].filter(h => h !== g && h.side === 0 && h.sys === g.sys && !h.transit && !h.spool && h.units.some(id => R.alive(w.units.get(id)))).map(h => `<button type="button" class="btn sm ghost" data-vmerge="${h.id}">${esc(h.name)}と合流</button>`).join(''); }
function voyTacSide() {
 const w = voy.w, sys = voy.tac.sys, us = R.systemUnits(w, sys), mine = us.filter(u => u.side === 0), foes = us.filter(u => u.side !== 0), tab = voy.tab, sel = voy.sel.units.map(id => w.units.get(id)).filter(u => u && R.alive(u) && u.side === 0 && u.sys === sys);
 const tabs = `<div class="seg vs-tabs" role="tablist">${[['ships', '艦艇'], ['wings', '飛行隊'], ['help', '増援'], ['log', '記録']].map(([k, n]) => `<button type="button" role="tab" data-vtab="${k}" aria-pressed="${tab === k}">${n}</button>`).join('')}</div>`;
 let body = '';
 if (voy.cmd) body += `<p class="vs-hint">${esc({move: '移動先を地図でタップ', attack: '攻撃する敵艦をタップ', strike: '攻撃する敵艦をタップ', cap: '制空する地点をタップ', escort: '直掩する味方艦をタップ'}[voy.cmd.type] || '')}<button type="button" class="btn sm ghost" data-vact="nocmd">取消</button></p>`;
 if (tab === 'ships') {
  body += `<div class="vs-acts vs-watch"><button type="button" class="btn sm" data-vspectate="${sys}">この戦闘を3Dで観戦</button></div>`;
  const fs = voy.sel.foe && w.units.get(voy.sel.foe);
  if (fs && R.alive(fs) && fs.sys === sys && !sel.length) body += `<div class="vs-card foe"><div class="vs-head"><h3>敵 ${esc(fs.name)}</h3><span>${esc(voyUnitState(fs))}</span></div>${voySecHTML(fs)}<p class="vs-sub">シールド ${Math.round(fs.shield / Math.max(1, fs.shieldMax) * 100)}%${fs.bankMax > 0 ? ` · 蓄電 ${Math.round(fs.bank / fs.bankMax * 100)}%` : ''} · 装甲 ${Math.round(fs.armor * 100)}%</p><div class="vs-status">${armourFacesHTML(fs)}${statusFlagsHTML(fs)}</div>${voyHitLogHTML(fs)}<button type="button" class="btn sm ghost vs-pilot" data-vspectate="${sys}" data-vfollow="${fs.id}">この艦を追って観戦</button></div>`;
  if (sel.length) {
   const u = sel[0], one = sel.length === 1, sx = C.fleetSystems(u), lost = (u.p.modules || []).map((m, i) => u.mods[i] <= 0 && m.k !== 'hull' ? m.name : null).filter(Boolean);
   body += `<div class="vs-card"><div class="vs-head"><h3>${one ? esc(u.name) : `${sel.length} 隻を選択`}</h3><span>${esc(voyUnitState(u))}</span></div>
   ${one ? `${voySecHTML(u)}<p class="vs-sub">シールド ${Math.round(u.shield / Math.max(1, u.shieldMax) * 100)}%${u.bankMax > 0 ? ` · 蓄電 ${Math.round(u.bank / u.bankMax * 100)}%` : ''} · 装甲 ${Math.round(u.armor * 100)}% · 乗員 ${num(Math.round(u.crew))} 名 · 炉 ${Math.round(sx.reactor * 100)}% · 推進 ${Math.round(sx.engine * 100)}% · 兵装 ${Math.round(sx.weapon * 100)}%</p><div class="vs-status">${armourFacesHTML(u)}${powerSplitHTML(u)}${statusFlagsHTML(u)}</div>${lost.length ? `<p class="vs-sub bad">損傷：${esc([...new Set(lost)].slice(0, 6).join('・'))}${lost.length > 6 ? ' ほか' : ''}</p>` : ''}${voyHitLogHTML(u)}` : ''}
   <p class="vs-sub">命令</p><div class="vs-acts">${['auto', 'hold'].map(k => `<button type="button" class="btn sm${u.order.type === k ? ' on' : ''}" data-vord="${k}">${VOY_ORDER[k]}</button>`).join('')}<button type="button" class="btn sm${voy.cmd?.type === 'move' ? ' on' : ''}" data-vact="cmd:move">移動</button><button type="button" class="btn sm${voy.cmd?.type === 'attack' ? ' on' : ''}" data-vact="cmd:attack">攻撃</button><button type="button" class="btn sm ghost" data-vact="withdraw">離脱</button></div>
   <p class="vs-sub">出力配分</p><div class="vs-acts">${VOY_POWER.map(([k, n]) => `<button type="button" class="btn sm${(u.order.power || 'auto') === k ? ' on' : ''}" data-vpow="${k}">${n}</button>`).join('')}</div>
   <p class="vs-sub">照準部位</p><div class="vs-acts">${VOY_AIM.map(([k, n]) => `<button type="button" class="btn sm${(u.order.aim || 'auto') === k ? ' on' : ''}" data-vaim="${k}">${n}</button>`).join('')}</div>
   ${one && !u.out ? `<button type="button" class="btn primary vs-pilot" data-vpilot="${u.id}">この艦を3Dで操艦</button>` : ''}${one ? `<button type="button" class="btn sm ghost vs-pilot" data-vspectate="${sys}" data-vfollow="${u.id}">この艦を追って観戦</button>` : ''}</div>`;
  }
  body += `<div class="vs-card vs-list"><div class="vs-head"><h3>自軍</h3><button type="button" class="btn sm ghost" data-vact="selall">全艦を選択</button></div><ul>${mine.map(u => `<li class="${voy.sel.units.includes(u.id) ? 'on' : ''}"><button type="button" data-vunit="${u.id}"><b>${esc(u.name)}</b>${voySecHTML(u)}<small>${esc(voyUnitState(u))}</small></button></li>`).join('') || '<li class="muted">この星系に自軍の艦はいません</li>'}</ul></div>
  <div class="vs-card vs-list"><h3>敵艦</h3><ul>${foes.map(u => `<li class="foe"><button type="button" data-vfoe="${u.id}"><b>${esc(u.name)}</b>${voySecHTML(u)}<small>${esc(voyUnitState(u))}</small></button></li>`).join('') || '<li class="muted">敵艦はいません</li>'}</ul></div>`;
 } else if (tab === 'wings') {
  const wings = [...w.wings.values()].filter(x => x.side === 0 && w.units.get(x.home)?.sys === sys && R.alive(w.units.get(x.home)));
  const wsel = voy.sel.wing && w.wings.get(voy.sel.wing);
  if (wsel) { const o = wsel.order, t = o.target && w.units.get(o.target);
   body += `<div class="vs-card"><div class="vs-head"><h3>${esc(wsel.name)}</h3><span>${esc(voyWingOrderText(wsel))}</span></div><div class="vs-acts">${[['auto', '自動'], ['standby', '待機・帰還']].map(([k, n]) => `<button type="button" class="btn sm${o.type === k ? ' on' : ''}" data-vwing="${k}">${n}</button>`).join('')}<button type="button" class="btn sm${voy.cmd?.type === 'strike' ? ' on' : ''}" data-vact="cmd:strike">攻撃</button><button type="button" class="btn sm${voy.cmd?.type === 'cap' ? ' on' : ''}" data-vact="cmd:cap">制空</button><button type="button" class="btn sm${voy.cmd?.type === 'escort' ? ' on' : ''}" data-vact="cmd:escort">直掩</button></div>
   ${o.type === 'strike' && t ? `<p class="vs-sub">進入方向（${esc(t.name)} から見て）</p><div class="vs-acts">${Object.entries(R.APPROACH_NAME).map(([k, n]) => `<button type="button" class="btn sm${o.approach === k ? ' on' : ''}" data-vappr="${k}">${n}</button>`).join('')}</div><p class="note">対空火力が最も弱いのは「${esc(R.APPROACH_NAME[voyWeakArc(t)])}」方向です。</p>` : ''}</div>`; }
  body += `<div class="vs-card vs-list"><h3>飛行隊</h3><ul>${wings.map(x => { const sq = x.squads.map(id => w.squads.get(id)).filter(Boolean), n = sq.reduce((a, s) => a + s.n, 0), n0 = sq.reduce((a, s) => a + s.n0, 0), out = sq.filter(s => s.state === 'out').length; return `<li class="${voy.sel.wing === x.id ? 'on' : ''}"><button type="button" data-vwsel="${x.id}"><b>${esc(x.name)}</b><small>${esc(voyWingOrderText(x))}</small><span>${Math.round(n)} / ${n0} 機 · 発艦 ${out}/${sq.length} 中隊</span></button></li>`; }).join('') || '<li class="muted">この星系に飛行隊はいません</li>'}</ul></div>`;
 } else if (tab === 'help') {
  body += `<div class="vs-card vs-list"><h3>増援を呼ぶ</h3><ul>${[...w.groups.values()].filter(h => h.side === 0 && h.sys !== sys && h.units.some(id => R.alive(w.units.get(id)))).map(h => { const eta = R.etaTo(w, h.id, sys); return `<li><div><b>${esc(h.name)}</b><small>${h.transit ? '航行中' : esc(w.sector.systems[h.sys]?.name || '')} · ${h.units.filter(id => R.alive(w.units.get(id))).length} 隻 · ${eta == null ? 'ジャンプ不能' : '到着まで ' + voyClock(eta)}</small></div><button type="button" class="btn sm" data-vsend="${h.id}" ${eta == null || h.transit ? 'disabled' : ''}>呼び寄せる</button></li>`; }).join('') || '<li class="muted">ほかの部隊はありません</li>'}</ul><p class="note">到着時間は部隊で最も遅いハイパードライブで決まります。交戦中の部隊は離脱の準備に ${R.RULES.withdrawSpool} 秒かかります。</p></div>`;
 } else {
  const b = w.battles.get(sys);body += `<div class="vs-card vs-list vs-log"><h3>戦闘記録</h3><ul>${(b?.log || []).slice(-40).reverse().map(e => `<li class="${e.side === 0 ? 'own' : e.side === 1 ? 'foe' : ''}"><span>${voyClock(e.t - (b?.t0 || 0))}</span>${esc(e.text)}</li>`).join('') || '<li class="muted">記録はまだありません</li>'}</ul></div>`;
 }
 return tabs + body;
}
function voyWeakArc(t) { return Object.keys(R.APPROACH).sort((a, b) => R.pdToward(t, C.add(t.pos, voyShipVec(t, R.APPROACH[a]))) - R.pdToward(t, C.add(t.pos, voyShipVec(t, R.APPROACH[b]))))[0]; }
const voyShipVec = (u, v) => { const c = Math.cos(u.yaw), s = Math.sin(u.yaw); return [(v[0] * c - v[2] * s) * 9000, v[1] * 9000, (v[0] * s + v[2] * c) * 9000]; };
function voyWingOrderText(x) { const w = voy.w, o = x.order; if (o.type === 'auto') return '自動（母艦を直掩）'; if (o.type === 'standby') return '待機・帰還'; if (o.type === 'strike') return `攻撃：${w.units.get(o.target)?.name || '—'}（${R.APPROACH_NAME[o.approach] || '艦首'}方向から）`; if (o.type === 'cap') return '制空'; if (o.type === 'escort') return `直掩：${w.units.get(o.target)?.name || '—'}`; return ''; }

// ---------- input ----------
function voyGo(where) {
 if (where === 'ops') { voy.cmd = null; voyShow('ops'); return; }
 if (where === 'side') { voy.side = !voy.side; voyRenderSide(); voyRenderHud(); setTimeout(voyMapResize, 30); return; }
 if (where === 'quit') { voyConfirmQuit(); return; }
 if (where.startsWith('tac:')) { const sys = +where.slice(4); voy.tac = {sys, c: [0, 0], mpp: 300, fitted: false}; voy.cmd = null; voy.tab = 'ships'; voy.sel.units = R.systemUnits(voy.w, sys).filter(u => u.side === 0).map(u => u.id).slice(0, 1); voy.battleAlert = null; voyShow('tac'); }
}
function voyConfirmQuit() {
 const el = $('#voySheet');el.hidden = false;
 el.innerHTML = `<div class="voy-sheet-card small" role="dialog" aria-label="艦隊戦を終える"><h3>艦隊戦を終えますか？</h3><p class="note">戦況は保存されません。</p><div class="vs-acts"><button type="button" class="btn" data-vq="setup">編成画面へ</button><button type="button" class="btn" data-vq="title">タイトルへ</button><button type="button" class="btn ghost" data-vq="no">続ける</button></div></div>`;
}
function voyCmdUnits() { const w = voy.w; return voy.sel.units.map(id => w.units.get(id)).filter(u => u && R.alive(u) && u.side === 0); }
function voySidebarClick(e) {
 const b = e.target.closest('button,input[type=checkbox]');if (!b) return;const d = b.dataset, w = voy.w;if (!w) return;
 if (d.vspeed != null) { voy.speed = +d.vspeed; voyRenderHud(); return; }
 if (d.vgo) { voyGo(d.vgo); return; }
 if (d.vq) { $('#voySheet').hidden = true; if (d.vq === 'setup') { voy.w = null; voyShow('setup'); } else if (d.vq === 'title') { voy.w = null; voyClose(); showTitle('voyage'); } return; }
 if (d.vresult) { $('#voySheet').hidden = true; if (d.vresult === 'setup') { voy.w = null; voy.result = null; voyShow('setup'); } else if (d.vresult === 'title') { voy.w = null; voy.result = null; voyClose(); showTitle('voyage'); } else voy.resultDismissed = true; return; }
 if (d.vgroup) { voy.sel.group = d.vgroup; voy.sel.sys = null; voy.sel.dest = null; voy.split = false; voy.cmd = null; const g = w.groups.get(d.vgroup); if (g) voyCenterOps(voyGroupPos(g)); voyRenderSide(); return; }
 if (d.vsplit) { voy.splitSel = voy.splitSel || new Set(); if (b.checked) voy.splitSel.add(d.vsplit); else voy.splitSel.delete(d.vsplit); return; }
 if (d.vmerge) { if (R.mergeGroups(w, voy.sel.group, d.vmerge)) toast('部隊を合流しました'); voyRenderSide(); return; }
 if (d.vsend) { const sys = voy.screen === 'tac' ? voy.tac.sys : voy.sel.sys, r = R.orderJump(w, d.vsend, sys); toast(r.ok ? `${esc(w.groups.get(d.vsend)?.name || '')} を ${esc(w.sector.systems[sys].name)} へ（到着まで ${voyClock(r.eta)}）` : esc(r.why)); voyRenderSide(); return; }
 if (d.vact) {
  const g = voy.sel.group && w.groups.get(voy.sel.group);
  if (d.vact === 'pickdest') { voy.cmd = voy.cmd?.type === 'jump' ? null : {type: 'jump'}; voyRenderSide(); return; }
  if (d.vact === 'nodest') { voy.sel.dest = null; voy.cmd = null; voyRenderSide(); return; }
  if (d.vact === 'jump' && g) { const r = R.orderJump(w, g.id, voy.sel.dest); toast(r.ok ? `${esc(g.name)}：${esc(w.sector.systems[voy.sel.dest].name)}へジャンプ（到着まで ${voyClock(r.eta)}）` : esc(r.why)); voy.sel.dest = null; voy.cmd = null; voyRenderSide(); return; }
  if (d.vact === 'cancel' && g) { R.cancelJump(w, g.id); voyRenderSide(); return; }
  if (d.vact === 'split' && g) { if (!voy.split) { voy.split = true; voy.splitSel = new Set(); } else { const h = R.splitGroup(w, g.id, [...voy.splitSel], g.name.replace(/部隊.*$/, '部隊') + '分遣隊'); voy.split = false; if (h) { voy.sel.group = h.id; toast(`${esc(h.name)}を編成しました`); } else toast('分ける艦を選んでください（全艦は選べません）'); } voyRenderSide(); return; }
  if (d.vact === 'nocmd') { voy.cmd = null; voyRenderSide(); return; }
  if (d.vact.startsWith('cmd:')) { const t = d.vact.slice(4); voy.cmd = voy.cmd?.type === t ? null : {type: t}; voyRenderSide(); return; }
  if (d.vact === 'selall') { voy.sel.units = R.systemUnits(w, voy.tac.sys).filter(u => u.side === 0).map(u => u.id); voyRenderSide(); return; }
  if (d.vact === 'withdraw') { voyWithdraw(); return; }
 }
 if (d.vtab) { voy.tab = d.vtab; voy.cmd = null; voyRenderSide(); return; }
 if (d.vunit) { const id = d.vunit;voy.sel.foe = null; if (e.shiftKey || voy.multi) { const i = voy.sel.units.indexOf(id); if (i >= 0) voy.sel.units.splice(i, 1); else voy.sel.units.push(id); } else voy.sel.units = [id]; const u = w.units.get(id); if (u) voyCenterTac(u.pos, false); voyRenderSide(); return; }
 if (d.vfoe) { const u = w.units.get(d.vfoe); if (u) voyCenterTac(u.pos, false); if (voy.cmd?.type === 'attack' || voy.cmd?.type === 'strike') voyTapUnit(u); else { voy.sel.foe = d.vfoe; voy.sel.units = []; voyRenderSide(); } return; }
 if (d.vord) { for (const u of voyCmdUnits()) R.orderUnit(w, u.id, {type: d.vord}); voy.cmd = null; voyRenderSide(); return; }
 if (d.vpow) { for (const u of voyCmdUnits()) R.orderUnit(w, u.id, {power: d.vpow}); voyRenderSide(); return; }
 if (d.vaim) { for (const u of voyCmdUnits()) R.orderUnit(w, u.id, {aim: d.vaim}); voyRenderSide(); return; }
 if (d.vpilot) { voyPilot(d.vpilot); return; }
 if (d.vspectate != null) { voySpectate(+d.vspectate, d.vfollow || null); return; }
 if (d.vwsel) { voy.sel.wing = voy.sel.wing === d.vwsel ? null : d.vwsel; voy.cmd = null; voyRenderSide(); return; }
 if (d.vwing) { R.orderWing(w, voy.sel.wing, {type: d.vwing}); voy.cmd = null; voyRenderSide(); return; }
 if (d.vappr) { const wing = w.wings.get(voy.sel.wing); if (wing?.order.type === 'strike') R.orderWing(w, wing.id, {...wing.order, approach: d.vappr}); voyRenderSide(); return; }
}
// Withdrawal: the selected ships leave as a group of their own for the safest
// system nearby (the AI's rule: home first, away from known enemies).
function voyWithdraw() {
 const w = voy.w, us = voyCmdUnits();if (!us.length) return;const g = w.groups.get(us[0].group);
 const all = g && us.length === g.units.filter(id => R.alive(w.units.get(id))).length;let h = all ? g : R.splitGroup(w, g.id, us.map(u => u.id), g.name + '離脱隊');if (!h) return;
 const S = w.sector, danger = new Set([...w.sides[0].contacts.values()].map(c => c.sys)), from = h.sys, dest = S.systems.filter(s => s.id !== from && !danger.has(s.id)).sort((a, b) => R.sysDistance(S, from, a.id) - R.sysDistance(S, from, b.id))[0];
 if (!dest) return;const r = R.orderJump(w, h.id, dest.id);toast(r.ok ? `${esc(h.name)}：${esc(dest.name)}へ離脱（準備 ${R.RULES.withdrawSpool} 秒）` : esc(r.why));voyRenderSide();
}
function voyCenterOps(p) { voy.ops.c = [p[0], p[1]]; voy.ops.auto = false; }
function voyCenterTac(p, force) { const c = $('#voyMap'), r = c.getBoundingClientRect(), q = tacP(p, r.width, r.height); if (force || q[0] < 40 || q[1] < 40 || q[0] > r.width - 40 || q[1] > r.height - 40) { voy.tac.c = [p[0], p[2]]; voy.tac.auto = false; } }
function voyTapUnit(u) {
 const w = voy.w, cmd = voy.cmd;if (!u) return;
 if (cmd?.type === 'attack' && u.side !== 0) { for (const x of voyCmdUnits()) R.orderUnit(w, x.id, {type: 'attack', target: u.id}); voy.cmd = null; toast(`${esc(u.name)}を攻撃`); voyRenderSide(); return true; }
 if (cmd?.type === 'strike' && u.side !== 0 && voy.sel.wing) { R.orderWing(w, voy.sel.wing, {type: 'strike', target: u.id, approach: voyWeakArc(u)}); voy.cmd = null; voy.tab = 'wings'; toast(`${esc(w.wings.get(voy.sel.wing).name)}：${esc(u.name)}を攻撃（進入方向は飛行隊の一覧で変えられます）`); voyRenderSide(); return true; }
 if (cmd?.type === 'escort' && u.side === 0 && voy.sel.wing) { R.orderWing(w, voy.sel.wing, {type: 'escort', target: u.id}); voy.cmd = null; voyRenderSide(); return true; }
 if (u.side === 0) { if (voy.multi) { const i = voy.sel.units.indexOf(u.id); if (i >= 0) voy.sel.units.splice(i, 1); else voy.sel.units.push(u.id); } else voy.sel.units = [u.id]; voy.tab = 'ships'; voyRenderSide(); return true; }
 return false;
}
function voyMapTap(x, y) {
 const w = voy.w, c = $('#voyMap'), r = c.getBoundingClientRect(), W = r.width, H = r.height;
 if (voy.screen === 'ops') {
  const S = w.sector;let best = null, bd = 16;
  for (const g of w.groups.values()) { if (g.side !== 0 || !g.units.some(id => R.alive(w.units.get(id)))) continue; const p = opsP(voyGroupPos(g), W, H); const dd = Math.hypot(p[0] - x, p[1] - y + (g.sys != null ? 14 : 0)); if (dd < bd && voy.cmd?.type !== 'jump') { bd = dd; best = {g}; } }
  let sb = null, sd = 18;for (const s of S.systems) { const p = opsP(s.pos, W, H), dd = Math.hypot(p[0] - x, p[1] - y); if (dd < sd) { sd = dd; sb = s; } }
  if (best && (!sb || bd < sd)) { voy.sel.group = best.g.id; voy.sel.sys = null; voy.sel.dest = null; voy.split = false; voyRenderSide(); return; }
  if (sb) { const g = voy.sel.group && w.groups.get(voy.sel.group); if (g && g.side === 0 && !g.transit && (voy.cmd?.type === 'jump' || g.sys !== sb.id && voy.cmd?.type !== 'none')) { if (g.sys === sb.id) { voy.sel.dest = null; } else voy.sel.dest = sb.id; voy.cmd = null; } else { voy.sel.sys = sb.id; voy.sel.group = null; voy.sel.dest = null; } voyRenderSide(); return; }
  voy.sel.group = null;voy.sel.sys = null;voy.sel.dest = null;voy.cmd = null;voyRenderSide();return;
 }
 // tactical
 const us = R.systemUnits(w, voy.tac.sys);let hit = null, hd = 22;
 for (const u of us) { const p = tacP(u.pos, W, H), L = Math.max(9, u.p.len / voy.tac.mpp), dd = Math.hypot(p[0] - x, p[1] - y) - L * .5; if (dd < hd) { hd = dd; hit = u; } }
 if (hit && voyTapUnit(hit)) return;
 const pt = [voy.tac.c[0] + (x - W / 2) * voy.tac.mpp, 0, voy.tac.c[1] + (y - H / 2) * voy.tac.mpp];
 if (voy.cmd?.type === 'move') { const us2 = voyCmdUnits(); us2.forEach((u, i) => { const off = (i - (us2.length - 1) / 2) * Math.max(2500, u.p.len * 1.6); R.orderUnit(w, u.id, {type: 'move', point: [pt[0], u.pos[1], pt[2] + off]}); }); voy.cmd = null; voyRenderSide(); return; }
 if (voy.cmd?.type === 'cap' && voy.sel.wing) { R.orderWing(w, voy.sel.wing, {type: 'cap', point: pt, radius: 15000}); voy.cmd = null; voyRenderSide(); return; }
 if (hit) return;voy.sel.units = [];voyRenderSide();
}
function voyBindMap() {
 const c = $('#voyMap');if (!c) return;const ptrs = new Map();let start = null, moved = false, pinch = null;
 const pan = (dx, dy) => { (voy.screen === 'tac' ? voy.tac : voy.ops).auto = false; if (voy.screen === 'tac') { voy.tac.c = [voy.tac.c[0] - dx * voy.tac.mpp, voy.tac.c[1] - dy * voy.tac.mpp]; } else { voy.ops.c = [voy.ops.c[0] - dx / voy.ops.k, voy.ops.c[1] - dy / voy.ops.k]; } };
 const zoom = (f, x, y) => { const r = c.getBoundingClientRect(), W = r.width, H = r.height; (voy.screen === 'tac' ? voy.tac : voy.ops).auto = false; if (voy.screen === 'tac') { const t = voy.tac, wx = t.c[0] + (x - W / 2) * t.mpp, wz = t.c[1] + (y - H / 2) * t.mpp; t.mpp = C.clamp(t.mpp / f, 15, 3000); t.c = [wx - (x - W / 2) * t.mpp, wz - (y - H / 2) * t.mpp]; } else { const o = voy.ops, wx = o.c[0] + (x - W / 2) / o.k, wy = o.c[1] + (y - H / 2) / o.k; o.k = C.clamp(o.k * f, .03, 3); o.c = [wx - (x - W / 2) / o.k, wy - (y - H / 2) / o.k]; } };
 c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (ptrs.size === 1) { start = {x: e.clientX, y: e.clientY, t: performance.now()}; moved = false; } else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y)}; moved = true; } });
 c.addEventListener('pointermove', e => { const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY}); if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = c.getBoundingClientRect(); zoom(d / Math.max(1, pinch.d), (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); pinch.d = d; return; } if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) moved = true; if (moved) pan(dx, dy); });
 const end = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size && !moved && start && performance.now() - start.t < 700) { const r = c.getBoundingClientRect(); voyMapTap(e.clientX - r.left, e.clientY - r.top); } };
 c.addEventListener('pointerup', end);c.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = null; });
 c.addEventListener('wheel', e => { e.preventDefault(); const r = c.getBoundingClientRect(); zoom(Math.exp(-Math.sign(e.deltaY) * Math.min(.3, Math.abs(e.deltaY) * .002)), e.clientX - r.left, e.clientY - r.top); }, {passive: false});
 window.addEventListener('resize', () => { if (voy.open) voyMapResize(); });
 const side = $('#voySide');side.addEventListener('click', voySidebarClick);side.addEventListener('pointerenter', () => { voy.sidePause = true; });side.addEventListener('pointerleave', () => { voy.sidePause = false; });
 $('#voyHud').addEventListener('click', voySidebarClick);$('#voySheet').addEventListener('click', e => { if (voy.screen !== 'setup') voySidebarClick(e); });
 window.addEventListener('keydown', e => { if (!voy.open || voy.screen === 'setup' || trial.on || e.target.matches('input,textarea,select')) return; if (e.code === 'Space') { e.preventDefault(); voy.speed = voy.speed ? 0 : 1; voyRenderHud(); } else if (e.key === 'Escape') { if (voy.cmd) { voy.cmd = null; voyRenderSide(); } else if (voy.screen === 'tac') voyGo('ops'); } else if (/^Digit[1-5]$/.test(e.code)) { voy.speed = VOY_SPEEDS[+e.code.slice(5) - 1]; voyRenderHud(); } else if (e.key === 'Shift') voy.multi = true; });
 window.addEventListener('keyup', e => { if (e.key === 'Shift') voy.multi = false; });
}

// ---------- result ----------
function voyShowResult() {
 const w = voy.w, r = w.result;voy.result = r;if (voy.resultDismissed) return;const win = r.winner === 0, el = $('#voySheet');el.hidden = false;
 const side = i => { const us = [...w.units.values()].filter(u => u.side === i), sq = [...w.squads.values()].filter(s => s.side === i); return `<dt>${esc(w.sides[i].name)}</dt><dd>${us.length} 隻中 撃沈 ${us.filter(u => u.dead).length} · 戦闘不能 ${us.filter(u => !u.dead && u.out).length} · 艦載機 ${Math.round(sq.reduce((n, s) => n + s.n, 0))} / ${sq.reduce((n, s) => n + s.n0, 0)} 機</dd>`; };
 el.innerHTML = `<div class="voy-sheet-card small" role="dialog" aria-label="艦隊戦の結果"><b class="vr-big ${win ? 'win' : 'lose'}">${r.winner < 0 ? '痛み分け' : win ? '勝利' : '敗北'}</b><p class="note">${win ? '敵艦隊の戦闘力の4分の3以上を失わせました。' : r.winner < 0 ? '両軍とも戦闘力を失いました。' : '自軍が戦闘力の4分の3以上を失いました。'} 経過 ${voyClock(r.time)}</p><dl class="vr-dl">${side(0)}${side(1)}</dl><div class="vs-acts"><button type="button" class="btn primary" data-vresult="setup">編成画面へ</button><button type="button" class="btn" data-vresult="title">タイトルへ</button><button type="button" class="btn ghost" data-vresult="stay">戦場を見る</button></div></div>`;
}

// ---------- flying a ship of a battle ----------
// The piloted ship becomes a manual unit of the battle: the flight model moves
// it, its bolts land as damage on the battle's units, and the battle's fire,
// missiles and squadrons come back at it. The rest of the world keeps running
// on the same clock, at real speed while flying.
async function voyPilot(id) {
 const w = voy.w, u = w.units.get(id);if (!u || !R.alive(u) || u.out || u.sys == null) { toast('この艦は操艦できません'); return; }
 voyPilotBusy(true, `${esc(u.name)}の3Dモデルと砲塔を準備中…`);
 try {
  const keys = [...new Set(R.systemUnits(w, u.sys).map(x => x.design))];
  for (const k of keys) await fleetAsset(k);
  const a = await fleetAsset(u.design);if (!a?.design) throw new Error('設計を準備できません');
  voyPilotBusy(false);voy.pilot = {uid: id, sys: u.sys};$('#voyage').hidden = true;voyToast(false);
  await trialStart({design: a.design, rts: {w, sys: u.sys, uid: id}, returnTo: 'voyage'});
  if (!trial.on) throw new Error('操艦を開始できませんでした');
 } catch (e) { console.error(e); voyPilotBusy(false); $('#voyage').hidden = false; voyToast(true); voy.pilot = null; toast('操艦を開始できません：' + esc(e.message || e)); }
}
function voyPilotBusy(on, text) { const el = $('#voyBusy'); if (!el) return; el.hidden = !on; if (on) el.querySelector('span').innerHTML = text || '準備中…'; }
function voyPilotInit() {
 if (trial.rts?.spectate) { voySpectateInit(); return; }
 const {w, sys, uid} = trial.rts, me = w.units.get(uid);me.manual = true;me.order = {...me.order, power: trial.powerMode};
 // The battle's frame (x east, y up, z south) is laid into the flight's world so
 // the ship keeps its position and heading: forward = its bearing in the battle.
 const up = tv.norm(trial.P), f0 = trialCol(trial.R, 0), E = trialFrame(f0, up), fw = trialApply(E, [Math.cos(me.yaw), 0, Math.sin(me.yaw)]);
 trial.R = trialFrame(fw, up);const O = tv.sub(trial.P, trialApply(E, me.pos));
 trial.V = trialApply(E, me.velocity || [0, 0, 0]);trial.vf = tv.dot(trial.V, fw);
 const B = {rts: true, O, E, acc: 0, extra: new Map(), seen: w.battles.get(sys)?.log.at(-1)?.n || 0, result: null, orderT: 0, me, plan: null, ticker: [], kills: 0, disabled: 0, cined: true,
  modIndex: new Map((me.p.modules || []).map((m, i) => [m.fit, i]).filter(([f]) => f != null)), b: {get units() { return R.systemUnits(w, sys); }, get time() { return w.time; }}};
 trial.battle = B;trial.targets = [];trial.vbolts = [];trial.foeCraft = [];trial.foeMissiles = [];trial.ownCraft = [];spaceRefresh();
 let near = null, nd = Infinity;for (const u of R.systemUnits(w, sys)) { if (u.side === me.side || !R.fighting(u)) continue; const d = Math.hypot(u.pos[0] - me.pos[0], u.pos[1] - me.pos[1], u.pos[2] - me.pos[2]); if (d < nd) { nd = d; near = u; } }
 trial.lookAt = near;
}
// Craft and missiles in 3D: one point per craft around its squadron, one per
// missile of a salvo. Point defence shooting one down takes it off the battle.
const voyCraftOff = (i, n) => { const a = i * 2.399963, r = 40 + 26 * Math.sqrt(i); return [Math.cos(a) * r, ((i * 37) % 11 - 5) * 9, Math.sin(a) * r]; };
// Far from the camera a squadron or a salvo is one larger point (a battle may
// carry thousands of craft); near, every craft is its own point and target.
const VOY_NEAR = 26000;
function voyPilotThreats() {
 const B = trial.battle, {w, sys} = trial.rts, me = B.me || w.units.get(B.follow), world = p => tv.add(B.O, trialApply(B.E, p)), foe = [], own = [], mis = [], P = trial.P;if (!me) return;
 // Watching, the colours are the sides' own (ours blue); flying, they are the pilot's.
 const mine = B.spectate ? 0 : me.side;
 for (const s of w.squads.values()) {
  if (s.sys !== sys || s.state !== 'out' || s.n <= 0) continue;const n = Math.ceil(s.n), c = R.CRAFT[s.craft], h = trialApply(B.E, s.h), v = trialApply(B.E, s.vel), c0 = world(s.pos);
  if (tv.len(tv.sub(c0, P)) > VOY_NEAR) { (s.side === mine ? own : foe).push({id: s.id, kind: 'craft', pos: c0, vel: v, h, alive: true, team: s.side === mine ? 0 : 1, size: Math.min(46, 12 + Math.sqrt(n) * 3.2), glow: s.side === mine ? [120, 200, 255, 230] : [255, 110, 80, 230], far: true}); continue; }
  for (let i = 0; i < n; i++) { const pos = world(tv.add(s.pos, voyCraftOff(i, n))), q = {id: s.id + ':' + i, kind: 'craft', pos, vel: v, h, alive: true, team: s.side === mine ? 0 : 1, size: c.role === 'bomber' ? 12 : 10, glow: s.side === mine ? [120, 200, 255, 230] : [255, 110, 80, 230], onDown: () => { s.n = Math.max(0, s.n - 1); s.lostN = (s.lostN || 0) + 1; if (s.n < .5) s.state = 'lost'; }}; (s.side === mine ? own : foe).push(q); }
 }
 for (const m of w.missiles) {
  if (m.sys !== sys || m.n <= 0 || (!B.spectate && m.side === me.side)) continue;const n = Math.ceil(m.n), v = trialApply(B.E, m.vel), h = tv.norm(v), c0 = world(m.pos);
  if (tv.len(tv.sub(c0, P)) > VOY_NEAR) { mis.push({id: m.id, kind: 'missile', pos: c0, vel: v, h, alive: true, far: true}); continue; }
  for (let i = 0; i < n; i++) mis.push({id: m.id + ':' + i, kind: 'missile', pos: world(tv.add(m.pos, [((i * 7) % 5 - 2) * 14, ((i * 3) % 4 - 1.5) * 12, ((i * 11) % 5 - 2) * 14])), vel: v, h, alive: true, onDown: () => { m.n = Math.max(0, m.n - 1); m.downed = (m.downed || 0) + 1; }});
 }
 trial.foeCraft = foe;trial.ownCraft = own;trial.foeMissiles = mis;
}
function voyPilotStep(dt) {
 const B = trial.battle;if (!B?.rts || B.left) return;const {w, sys} = trial.rts, me = B.me;
 if (B.result) { R.step(w, dt); B.acc = w.acc; spaceRefresh(); voyPilotThreats(); return; }
 spaceSync();
 for (const [id, x] of B.extra) { const u = w.units.get(id); if (!u) continue; C.combatMerge(u.extra || (u.extra = C.combatIncoming()), u, x); }
 B.extra = new Map();
 const before = new Map(R.systemUnits(w, sys).map(u => [u.id, {dead: u.dead, out: u.out}])), t0 = w.time;
 R.step(w, dt);B.acc = w.acc;
 // Bolts from the other ships, one burst per battle step in which they fired.
 if (w.time > t0) { const shots = []; for (const u of R.systemUnits(w, sys)) if (!u.manual && u.lastShot) shots.push({from: u.id, to: u.lastShot.to, gun: u.lastShot.gun, ion: u.lastShot.ion}); spaceShots(shots); }
 for (const [id, was] of before) { const u = w.units.get(id); if (!u) continue; if (u.dead && !was.dead) { trialExplosion(spaceWorld(u), spaceVel(u), u.p.len, u.fate === 'reactor' || u.fate === 'fuel' || u.fate === 'magazine'); if (u.side !== me.side) B.kills++; } else if (u.out && !was.out && u.side !== me.side) B.disabled++; }
 for (const t of trial.turrets) { const i = B.modIndex.get(t.id); t.dead = i != null && me.mods[i] <= 0; }
 for (const l of trial.launchers) { const i = B.modIndex.get(l.id); l.dead = i != null && me.mods[i] <= 0; }
 const log = w.battles.get(sys)?.log || [];let li = log.length;while (li > 0 && log[li - 1].n > B.seen) li--;for (; li < log.length; li++) { const e = log[li];B.seen = e.n;const u = w.units.get(e.id), text = e.text.replace(/^[^：]*：/, ''); spaceLog(text, u ? {...u, team: u.side === me.side ? 0 : 1, manual: u === me} : null); if (u === me && /破壊|停止|誘爆|消失|喪失|戦闘不能|撃沈|崩壊/.test(text)) toast('自艦：' + esc(text)); }
 voyPilotThreats();
 if (me.dead || me.out) { spaceEnd(me.dead ? 'sunk' : 'out'); return; }
 if (!w.battles.has(sys)) { const foes = R.systemUnits(w, sys).filter(u => u.side !== me.side); spaceEnd(foes.some(R.fighting) ? 'withdrew' : 'win'); }
 spaceRefresh();
}
// Back from the flight to the tactical map: the ship returns to the battle's AI.
function voyPilotEnd() {
 const p = voy.pilot;voy.pilot = null;if (voy.w && p) { const u = voy.w.units.get(p.uid); if (u) { u.manual = false; u.extra = null; } }
 trial.foeCraft = [];trial.ownCraft = [];trial.foeMissiles = [];
  if (voy.w) { $('#voyage').hidden = false; voyToast(true); voyGo(voy.w.battles.has(p?.sys) || R.systemUnits(voy.w, p?.sys).length ? 'tac:' + p.sys : 'ops'); voy.speed = 1; }
}

// ---------- watching a battle in 3D ----------
// Every ship fights under its commander's orders; the camera follows any ship
// of either side (tap a bracket, or step through them), or stays free.
async function voySpectate(sys, followId) {
 const w = voy.w;if (!w || sys == null) return;const us = R.systemUnits(w, sys).filter(u => R.alive(u));
 if (!us.length) { toast('この星系に艦がいません'); return; }
 const first = (followId != null && us.find(u => u.id === followId)) || us.find(u => u.side === 0 && !u.out) || us[0];
 voyPilotBusy(true, '3D観戦の準備中…（この星系の艦の3Dモデル）');
 try {
  for (const k of [...new Set(R.systemUnits(w, sys).map(x => x.design))]) await fleetAsset(k);
  const a = await fleetAsset(first.design);if (!a?.design) throw new Error('設計を準備できません');
  voyPilotBusy(false);voy.pilot = {uid: null, sys, spectate: true};$('#voyage').hidden = true;voyToast(false);
  await trialStart({design: a.design, rts: {w, sys, uid: first.id, spectate: true}, returnTo: 'voyage'});
  if (!trial.on) throw new Error('観戦を開始できませんでした');
 } catch (e) { console.error(e); voyPilotBusy(false); $('#voyage').hidden = false; voyToast(true); voy.pilot = null; toast('観戦を開始できません：' + esc(e.message || e)); }
}
function voySpectateInit() {
 const {w, sys, uid} = trial.rts, f = w.units.get(uid) || R.systemUnits(w, sys).find(R.alive);
 const up = tv.norm(trial.P), E = trialFrame(trialCol(trial.R, 0), up), O = tv.sub(trial.P, trialApply(E, f.pos));
 const B = {rts: true, spectate: true, hadBattle: w.battles.has(sys), O, E, acc: 0, extra: new Map(), seen: w.battles.get(sys)?.log.at(-1)?.n || 0, result: null, me: null, follow: f.id, ticker: [], kills: 0, disabled: 0, cined: true, modIndex: new Map(), b: {get units() { return R.systemUnits(w, sys); }, get time() { return w.time; }}};
 trial.battle = B;trial.targets = [];trial.vbolts = [];trial.foeCraft = [];trial.ownCraft = [];trial.foeMissiles = [];
 voySpectateFollow(f, true);spaceRefresh();
}
// The camera sits on the followed ship: its position, motion and heading.
function voySpectateFollow(u, snap) {
 const B = trial.battle;B.follow = u.id;trial.camLen = u.p.len;
 const P = spaceWorld(u), up = tv.norm(P), fw = trialApply(B.E, [Math.cos(u.yaw), 0, Math.sin(u.yaw)]);
 trial.P = P;trial.V = spaceVel(u);trial.vf = tv.len(trial.V);trial.R = trialFrame(fw, up);
 if (snap && view) { view.cam.r = trialCamRange(u.p.len * 1.7 + 320); view.cam.ph = TRIAL_CAM_PH; trial.camF = null; }
}
function voySpectateNext(dir) {
 const {w, sys} = trial.rts, B = trial.battle, side = voy.specSide || 'all';
 const us = R.systemUnits(w, sys).filter(u => R.alive(u) && !u.warp && (side === 'all' || (side === 'own') === (u.side === 0))).sort((a, b) => a.side - b.side || b.p.len - a.p.len || (a.id > b.id ? 1 : -1));
 if (!us.length) return null;const i = us.findIndex(u => u.id === B.follow);return us[(((i < 0 ? 0 : i + dir) % us.length) + us.length) % us.length];
}
function voySpectateStep(dt) {
 const B = trial.battle;if (!B?.spectate) return;const {w, sys} = trial.rts, before = new Map(R.systemUnits(w, sys).map(u => [u.id, {dead: u.dead}])), t0 = w.time;
 voySim(w, dt, voy.specSpeed || 1);B.acc = w.acc;
 if (w.time > t0) { const shots = []; for (const u of R.systemUnits(w, sys)) if (u.lastShot) shots.push({from: u.id, to: u.lastShot.to, gun: u.lastShot.gun, ion: u.lastShot.ion}); spaceShots(shots); }
 for (const [id, was] of before) { const u = w.units.get(id); if (u?.dead && !was.dead) trialExplosion(spaceWorld(u), spaceVel(u), u.p.len, u.fate === 'reactor' || u.fate === 'fuel' || u.fate === 'magazine'); }
 const log = w.battles.get(sys)?.log || [];let li = log.length;while (li > 0 && log[li - 1].n > B.seen) li--;
 for (; li < log.length; li++) { const e = log[li], u = w.units.get(e.id);B.seen = e.n;spaceLog(e.text.replace(/^[^：]*：/, ''), u ? {...u, manual: false} : null); }
 let f = w.units.get(B.follow);
 if (!f || f.dead || f.sys !== sys) { const next = voySpectateNext(1); if (next && next !== f) { if (f) toast(`${esc(f.name)}${f.dead ? 'は撃沈されました' : 'は星系を離れました'} — ${esc(next.name)}を追います`); f = next; voySpectateFollow(f, true); } }
 if (f && !f.dead) voySpectateFollow(f, false);
 voyPilotThreats();spaceRefresh();
 if (w.battles.has(sys)) B.hadBattle = true;
 else if (B.hadBattle && !B.over) { B.over = true; toast('この星系の戦闘は終わりました'); }
}
function voySpectateCmd(c) {
 const B = trial.battle;if (!B?.spectate) return;const {w} = trial.rts;
 if (c === 'next' || c === 'prev') { const u = voySpectateNext(c === 'next' ? 1 : -1); if (u) voySpectateFollow(u, true); }
 else if (c === 'side') { voy.specSide = {all: 'own', own: 'foe', foe: 'all'}[voy.specSide || 'all']; const u = voySpectateNext(0); if (u && (voy.specSide === 'all' || (voy.specSide === 'own') === (u.side === 0))) voySpectateFollow(u, true); }
 else if (c === 'cam') { trial.specCam = trial.specCam === 'free' ? 'chase' : 'free'; }
 else if (c.startsWith('speed:')) voy.specSpeed = +c.slice(6) || 1;
 else if (c.startsWith('follow:')) { const u = w.units.get(c.slice(7)); if (u && R.alive(u)) voySpectateFollow(u, true); }
 voySpectateHudUpdate(true);
}
function voySpectateHudHTML() {
 return `<div class="th-top"><div class="th-card th-bar spec-bar"><div class="th-id"><span>3D観戦</span><b data-sp="name">—</b><small data-sp="where"></small></div>
  <div class="spec-follow" role="group" aria-label="追尾する艦"><button type="button" class="th-btn" data-spec="prev" aria-label="前の艦">◀</button><button type="button" class="th-btn" data-spec="side" data-sp="side">全艦</button><button type="button" class="th-btn" data-spec="next" aria-label="次の艦">▶</button></div></div>
  <div class="th-actions"><div class="spec-speed" role="group" aria-label="時間の速さ">${[1, 2, 4, 8].map(k => `<button type="button" class="th-btn" data-spec="speed:${k}" aria-pressed="false">${k}×</button>`).join('')}</div><button type="button" class="th-btn" data-spec="cam" data-sp="cam">視点 追尾</button><button type="button" class="th-btn" data-trial-cmd="shot">撮影</button><button type="button" class="th-btn th-exit" data-trial-cmd="exit">戦術図へ</button></div></div>
 <p class="th-records" data-sp="records"></p>
 <div class="th-tmarks" aria-hidden="true"></div><div class="th-hitcam" data-th="hitcam" hidden><canvas></canvas></div>
 <ol class="spec-log" data-sp="log"></ol>`;
}
function voySpectateHudUpdate(full) {
 const hud = $('#trialHud'), B = trial.battle;if (!hud || !B?.spectate) return;const {w, sys} = trial.rts, q = k => hud.querySelector(`[data-sp="${k}"]`), set = (k, v) => { const e = q(k); if (e && e.textContent !== v) e.textContent = v; };
 const f = w.units.get(B.follow), us = R.systemUnits(w, sys), own = us.filter(u => u.side === 0), foe = us.filter(u => u.side !== 0), up = l => l.filter(R.fighting).length, bt = w.battles.get(sys);
 if (f) { set('name', `${f.side === 0 ? '' : '敵 '}${f.name}`); set('where', `${R.FACTIONS[w.sides[f.side].faction]?.short || ''} · ${voyUnitState(f)} · シールド ${Math.round(f.shield / Math.max(1, f.shieldMax) * 100)}% · 構造 ${Math.round(R.unitStruct(f) * 100)}%`); }
 set('records', `${w.sector.systems[sys].name}　自軍 ${up(own)}/${own.length} 隻 · 敵 ${up(foe)}/${foe.length} 隻${bt ? ` · 交戦 ${voyClock(w.time - bt.t0)}` : B.hadBattle ? ' · 戦闘終了' : ' · 交戦なし'}`);
 set('side', {all: '全艦', own: '自軍', foe: '敵艦'}[voy.specSide || 'all']);set('cam', trial.specCam === 'free' ? '視点 自由' : '視点 追尾');
 for (const b of hud.querySelectorAll('[data-spec^="speed:"]')) b.setAttribute('aria-pressed', String(+b.dataset.spec.slice(6) === (voy.specSpeed || 1)));
 const lg = q('log');if (lg) { const html = B.ticker.slice(-4).reverse().map(t => `<li><span>${voyClock(t.t)}</span>${esc(t.text)}</li>`).join(''); if (full || lg.innerHTML !== html) lg.innerHTML = html; }
}

// ---------- penetration records and their replay ----------
// The 3D view replays what the piloted or followed ship takes and deals; the
// tactical map lists each ship's last penetrations, any of which plays in a sheet.
function voyOnHit(u, rec, sys) {
 if (!trial.on || !trial.rts || trial.rts.sys !== sys) return;const B = trial.battle;if (!B) return;
 const id = B.me ? B.me.id : B.follow;if (id == null) return;
 if (u.id === id) hitcamOffer(u, rec, 'taken'); else if (String(rec.src) === String(id)) hitcamOffer(u, rec, 'dealt');
}
function voyHitText(rec) { const lost = rec.path.filter(s => s.after <= 0 && s.before > 0).map(s => s.name); return `${C.COMBAT_FACE[rec.face] || ''} ${C.SECTION_NAMES[rec.sec] || ''} · ${rec.path.length ? '貫通' : '非貫通'}${lost.length ? ' → ' + lost.slice(0, 2).join('・') + ' 破壊' : rec.path.length ? ' → ' + rec.path[0].name : ''}${rec.boom ? ' · 誘爆' : ''}${rec.fire ? ' · 火災' : ''}`; }
function voyHitLogHTML(u) {
 const L = u.hitLog || [];if (!L.length) return '';const n = L.length;
 return `<p class="vs-sub">被弾記録（貫通）</p><ul class="vs-hits">${L.slice(-6).reverse().map((r, i) => `<li><button type="button" data-vhit="${u.id}:${n - 1 - i}"><span>${voyClock(r.t)}</span>${esc(voyHitText(r))}<b aria-hidden="true">▶</b></button></li>`).join('')}</ul>`;
}
function voyHitReplay(uid, idx) {
 const w = voy.w, u = w?.units.get(uid), rec = u?.hitLog?.[idx];if (!rec) return;const el = $('#voySheet'), src = rec.src != null ? w.units.get(String(rec.src)) : null;
 el.hidden = false;el.innerHTML = `<div class="voy-sheet-card hitcam-card" role="dialog" aria-label="被弾リプレイ"><canvas class="hitcam-cv"></canvas><div class="vs-acts"><button type="button" class="btn sm" data-vhitplay>もう一度</button><button type="button" class="btn sm ghost" data-vhitclose>閉じる</button></div></div>`;
 voy.replay = {cv: el.querySelector('canvas'), u, rec, t0: performance.now(), title: `${u.side === 0 ? '' : '敵 '}${shipTag(u.name)} · 被弾 ${voyClock(rec.t)}`, sub: src ? `${src.side !== 0 ? '敵 ' : ''}${shipTag(src.name)} から` : ''};
 const loop = now => { const q = voy.replay; if (!q || el.hidden || !q.cv.isConnected) { voy.replay = null; return; } const r = q.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1), W = Math.max(1, Math.round(r.width * d)), H = Math.max(1, Math.round(r.height * d)); if (q.cv.width !== W || q.cv.height !== H) { q.cv.width = W; q.cv.height = H; } const g = q.cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); hitcamDraw(g, r.width, r.height, q.u.p, q.rec, Math.min(1, (now - q.t0) / (HITCAM_DUR * 1000)), {title: q.title, sub: q.sub}); requestAnimationFrame(loop); };
 requestAnimationFrame(loop);
}

// ---------- patrol (one ship, the trial flight) ----------
async function voyPatrol(source) {
 hideTitle();
 if (source === 'current') { if (!ship) { showTitle('voyage'); return; } await trialStart({returnTo: 'title', system: 'kuat'}); return; }
 if (source.startsWith('save:')) { const ok = await loadSaved(source.slice(5)); if (!ship) { showTitle('voyage'); return; } await waitStats(); await trialStart({returnTo: 'title', system: 'kuat'}); return; }
 showBusyOverlay('艦を準備中…（大型艦は時間がかかります）');
 try { const a = await fleetAsset(source); hideBusyOverlay(); await trialStart({design: a.design, returnTo: 'title', system: 'kuat'}); }
 catch (e) { console.error(e); hideBusyOverlay(); toast('艦を準備できません：' + esc(e.message || e)); showTitle('voyage'); }
}
function waitStats() { return new Promise(res => { const t0 = performance.now(), f = () => { if (ship?._geoProxy && S || performance.now() - t0 > 120000) res(); else setTimeout(f, 200); }; f(); }); }

// From the drawing board: the fleet battle with the design on the board added.
async function voyOpenWithCurrent() {
 voy.saves = await Store.list().catch(() => []);voyOpen('setup');if (!ship) return;
 try { const d = await voyPrepare('current'); if (!voy.setup.entries.some(e => e.key === d.key)) voyAddEntry(d.key, 1, 1); voyRenderSetup(); } catch (e) { console.error(e); toast('設計中の艦を準備できません：' + esc(e.message || e)); }
}
function bindVoyage() { voyBindSetup(); voyBindMap(); document.addEventListener('click', e => { const hb = e.target.closest('[data-vhit],[data-vhitplay],[data-vhitclose]'); if (hb) { if (hb.dataset.vhit) { const [id, i] = hb.dataset.vhit.split(':'); voyHitReplay(id, +i); } else if ('vhitplay' in hb.dataset && voy.replay) voy.replay.t0 = performance.now(); else { $('#voySheet').hidden = true; voy.replay = null; } return; } if (trial.spectate) { const sb = e.target.closest('[data-spec]'); if (sb) { voySpectateCmd(sb.dataset.spec); return; } const mk = e.target.closest('.th-tmark'); if (mk?.dataset.tmark?.startsWith('u')) { voySpectateCmd('follow:' + mk.dataset.tmark.slice(1)); return; } } const b = e.target.closest('[data-voyopen]'); if (b) { e.preventDefault(); voyOpenWithCurrent(); } }); window.__voy = {voy, R, open: voyOpen, pilot: voyPilot, go: voyGo, spectate: voySpectate}; }

window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
