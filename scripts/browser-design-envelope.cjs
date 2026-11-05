#!/usr/bin/env node
// Fresh native editor workflow; __yard is used only for read-only diagnostics.
// Planned envelope, actual span, and ordinary per-face armor/light editing.
// node scripts/browser-design-envelope.cjs --expect-sources /tmp/design-envelope-frozen.json
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const args = process.argv.slice(2), arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const url = arg('--url', 'http://127.0.0.1:8876');
const output = path.resolve(arg('--output', path.join(root, 'docs/benchmarks/design-envelope-browser.json')));
const expectedPath = arg('--expect-sources', null), imageRoot = path.join(root, 'docs/images');
const sourceFiles = ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/app.js', 'js/gfx.js', 'js/lang-en.js', 'js/engine.js', 'index.html'];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sources = () => Object.fromEntries(sourceFiles.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
const sourceSha256 = sources();
if (expectedPath) assert.deepEqual(sourceSha256, JSON.parse(fs.readFileSync(expectedPath)), 'Frozen runtime inputs differ');
const near = (actual, expected, label = '') => assert.ok(Math.abs(actual - expected) < .002, `${label}: ${actual} != ${expected}`);
const vector = (actual, expected, label = '') => { assert.equal(actual.length, expected.length); actual.forEach((n, i) => near(n, expected[i], label)); };
const progress = stage => console.log(JSON.stringify({stage, time: new Date().toISOString()}));

async function serverIfNeeded() {
  try { const response = await fetch(url); if (response.ok) return null; } catch {}
  const address = new URL(url);
  assert.ok(['127.0.0.1', 'localhost'].includes(address.hostname), 'Only a local static server can be started automatically');
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, url).pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404); response.end(); return; }
      response.setHeader('Content-Type', ({'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');
      response.end(data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(address.port), address.hostname, resolve); });
  return server;
}

async function visible(page, selector) {
  let control = page.locator(selector).first();
  await control.waitFor({state: 'attached'});
  // Open the existing native details controls from the outside inward.
  for (let attempt = 0; attempt < 8 && !await control.isVisible(); attempt++) {
    const inner = page.locator(selector.replace(/^#panel\s+/, ''));
    const folds = page.locator('#panel details:not([open])').filter({has: inner});
    if (!await folds.count()) break;
    await folds.first().locator(':scope > summary').click();
    control = page.locator(selector).first();
  }
  await control.waitFor({state: 'visible'});
  await control.scrollIntoViewIfNeeded();
  return control;
}

async function number(page, name, value, parent = '#panel') {
  const control = await visible(page, `${parent} input[type="number"][data-sl="${name}"]`);
  await control.fill(String(value));
  await control.dispatchEvent('change');
}

async function latest(page) {
  await page.waitForFunction(() => {
    const Y = window.__yard;
    return Y?.ship && Y.stats && Y.eng.geoGen >= Y.eng.gen && Y.eng.statsGen >= Y.eng.gen && Y.eng.adoptedGen >= Y.eng.gen && document.querySelector('#engineStatus')?.hidden;
  }, null, {timeout: 120000});
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function screenshot(page, name) {
  await page.waitForFunction(() => document.querySelector('#toast')?.hidden, null, {timeout: 10000});
  await page.mouse.move(12, 100);
  const relative = `docs/images/design-envelope-${name}.png`;
  await page.screenshot({path: path.join(root, relative)});
  return {path: relative, sha256: sha(fs.readFileSync(path.join(root, relative)))};
}

async function snapshot(page) {
  return page.evaluate(() => {
    const Y = window.__yard, C = Y.C, s = Y.ship;
    const bounds = C.shipBounds(s), parts = s.parts.filter(p => !p.surfacePatch).map(p => ({id: p.id, kind: p.k, center: p.c, size: p.s || null, bounds: C.partAABB(p), skinBounds: p.k === 'engine' ? C.engineSkinMesh(p)?.b : null}));
    const fits = s.fits.filter(f => !f.surfacePatch).map(f => ({id: f.id, kind: f.k, position: f.p, normal: C.fitUp(f), bounds: C.fitAABB(f), floating: f.float}));
    const engineMachinery = C.enginePaths(s).map(p => ({kind: p.k, bounds: C.partAABB(p)}));
    return {hull: {L: s.hull.L, W: s.hull.W, H: s.hull.H}, planned: C.designEnvelope(s), placementBounds: C.designPlacementBounds(s), actualBounds: bounds, actualDimensions: C.shipDimensions(s), statsDimensions: Y.stats.dims, statsLength: Y.stats.hullLen, proxyBounds: s._geoProxy?.bounds || null, classification: C.shipClassOf(s).id, parts, fits, engineMachinery, costModelVersion: C.COST_MODEL?.version || null, runtimeStamp: window.KS_SOURCE_STAMP || null, generations: {requested: Y.eng.gen, geometry: Y.eng.geoGen, statistics: Y.eng.statsGen, adopted: Y.eng.adoptedGen}, renderer: {type: Y.view().constructor.name, renderedFrames: Y.renderHealth.frames, failures: Y.renderHealth.failures}};
  });
}

async function boundsDiagnostic(page) {
  return page.evaluate(() => {
    const Y = window.__yard, C = Y.C, s = Y.ship, publicValue = v => JSON.parse(JSON.stringify(v, (key, value) => key.startsWith('_') ? undefined : value));
    const triangles = C.hullGeo(s).tris, hullBounds = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let i = 0; i < triangles.length; i += 3) for (let axis = 0; axis < 3; axis++) { hullBounds[axis] = Math.min(hullBounds[axis], triangles[i + axis]); hullBounds[axis + 3] = Math.max(hullBounds[axis + 3], triangles[i + axis]); }
    return {ship: publicValue(s), statsBounds: Y.stats.bounds || null, statsDimensions: Y.stats.dims, actualBounds: C.shipBounds(s), hullBounds,
      parts: s.parts.map(p => ({public: publicValue(p), bounds: C.partAABB(p), engineSkinBounds: p.k === 'engine' ? C.engineSkinMesh(p)?.b : null, referenceBounds: C.refPartBounds(p)})),
      enginePaths: C.enginePaths(s).map(p => ({public: publicValue(p), bounds: C.partAABB(p)})),
      fits: s.fits.map(f => ({public: publicValue(f), bounds: C.fitAABB(f), spec: publicValue(C.fitSpec(f))}))};
  });
}

function physicalBoundsCheck(state) {
  fs.writeFileSync('/tmp/design-envelope-last-bounds.json', JSON.stringify(state, null, 2) + '\n');
  vector(state.actualDimensions, [state.actualBounds[3] - state.actualBounds[0], state.actualBounds[5] - state.actualBounds[2], state.actualBounds[4] - state.actualBounds[1]], 'Actual asymmetric span');
  vector(state.statsDimensions, state.actualDimensions, 'Engineering dimensions');
  near(state.statsLength, state.actualDimensions[0], 'Engineering length');
  for (const box of [...state.parts.flatMap(p => [p.bounds, p.skinBounds].filter(Boolean)), ...state.fits.map(f => f.bounds), ...state.engineMachinery.map(p => p.bounds)]) {
    for (let i = 0; i < 3; i++) {
      assert.ok(state.actualBounds[i] <= box[i] + .002, 'Installed geometry lower bound included');
      assert.ok(state.actualBounds[i + 3] >= box[i + 3] - .002, 'Installed geometry upper bound included');
    }
  }
}

async function selectPart(page, id) {
  await tab(page, 'edit');
  if (await page.locator('#panel [data-editsub="edit"]').count()) await (await visible(page, '#panel [data-editsub="edit"]')).click();
  await (await visible(page, `#panel [data-edpick="parts:${id}"]`)).click();
  await page.waitForFunction(id => window.__yard.st.sel?.list === 'parts' && window.__yard.st.sel.id === id, id);
}

async function positionRanges(page) {
  for (const key of ['ex', 'ey', 'ez']) await visible(page, `#panel input[type="number"][data-sl="${key}"]`);
  return page.evaluate(() => Object.fromEntries(['ex', 'ey', 'ez'].map(key => {
    const el = document.querySelector(`#panel input[type="number"][data-sl="${key}"]`);
    return [key, {min: Number(el.min), max: Number(el.max), value: Number(el.value)}];
  })));
}

async function tab(page, key) {
  const state = await page.evaluate(() => ({tab: window.__yard.st.tab, collapsed: window.__yard.st.dockCollapsed}));
  if (state.tab !== key || state.collapsed) await page.locator(`#tabs [data-tab="${key}"]`).click();
}

async function coordinatePart(page, kind, center, size) {
  await tab(page, 'mod');
  await (await visible(page, `#panel [data-group="${kind === 'engine' ? 'power' : 'shape'}"]`)).click();
  await (await visible(page, `#panel [data-part="${kind}"]`)).click();
  if (size) {
    await (await visible(page, '#panel [data-structform="box"]')).click();
    for (const [i, name] of ['sl', 'sw', 'sh'].entries()) await number(page, name, size[i]);
  } else {
    for (const [field, value] of Object.entries({ratedInputW: 0, d: 12, nozzleLength: 6, machineryDiameterM: 8, machineryLengthM: 40, machineryOffsetM: 15})) {
      const control = await visible(page, `#panel input[data-engine-field="${field}"][data-engine-new="1"]`);
      await control.fill(String(value)); await control.dispatchEvent('change');
    }
    await (await visible(page, '#panel [data-engine-route="1"][data-reactor="new"]')).selectOption('0');
  }
  for (const [i, axis] of ['X', 'Y', 'Z'].entries()) await (await visible(page, `#newP${axis}`)).fill(String(center[i]));
  const before = await page.evaluate(() => window.__yard.ship.parts.map(p => p.id));
  await (await visible(page, '#btnAtCoordinates')).click();
  await latest(page);
  const placed = await page.evaluate(before => window.__yard.ship.parts.filter(p => !before.includes(p.id) && !p.surfacePatch).map(p => ({id: p.id, kind: p.k, center: p.c, size: p.s || null})), before);
  assert.equal(placed.length, 1, 'One native part placement without mirrored duplicates');
  assert.equal(placed[0].kind, kind); vector(placed[0].center, center);
  if (size) vector(placed[0].size, size);
  return {...placed[0], nativeCoordinateButton: true};
}

async function armorControls(page, id) {
  const controls = [];
  for (const face of ['fore', 'aft', 'top', 'bottom', 'port', 'stbd']) {
    const input = await visible(page, `#panel input[type="number"][data-structure-face-armor="${face}"][data-structure-armor-host="${id}"]`);
    controls.push({face, value: Number(await input.inputValue()), min: Number(await input.getAttribute('min')), max: Number(await input.getAttribute('max'))});
  }
  return controls;
}

async function setArmor(page, id, face, value) {
  const input = await visible(page, `#panel input[type="number"][data-structure-face-armor="${face}"][data-structure-armor-host="${id}"]`);
  await input.fill(String(value)); await input.dispatchEvent('change'); await latest(page);
}

async function armorDiagnostic(page, id) {
  const result = await page.evaluate(id => {
    const Y = window.__yard, C = Y.C, p = Y.ship.parts.find(p => p.id === id), glow = Gfx.thinArmorLights(Y.ship);
    const g = Y.meshStore.geos.surfaceDevices;
    let luminousVertices = 0;
    if (g?.col) for (let i = 0; i < g.n; i++) if (g.col[i * 4 + 3] === 253) luminousVertices++;
    return {partId: id, kind: p.k, form: p.form, skin: p.skin || 'armor', skinAsset: p.skinAsset || null, paint: p.paint || null,
      triangles: Array.from(C.structTriangles(p)),
      faces: C.surfacePatches(Y.ship).filter(q => q.host === 'p' + id).map(q => ({id: q.id, face: q.face, thickness: C.surfaceConfig(Y.ship, q.id).armor.thickness, mode: C.surfaceConfig(Y.ship, q.id).functionMode, exposed: q.exposed})),
      lights: glow.filter(row => row.host === id || row.host === 'p' + id), allLightRows: glow.length, uploadedLightVertices: luminousVertices,
      uploadedStructureRanges: (Y.meshStore.ranges?.[id] || []).filter(row => row[0] === 'struct'),
      surfaceGeometry: Object.fromEntries(['surfaceArmor', 'surfaceDevices', 'surfaceDetail'].map(name => [name, Y.meshStore.geos[name]?.ni || 0]))};
  }, id);
  result.structureGeometrySha256 = sha(JSON.stringify(result.triangles)); delete result.triangles;
  return result;
}

async function run(page) {
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__yard?.eng.ready, null, {timeout: 180000});
  for (const selector of ['#title [data-title-mode="sandbox"]', '#title [data-title-mode="design"]', '#title [data-title="new"]']) await page.locator(selector + ':visible').click();
  await page.locator('#title [data-title-class="frigate"]').click();
  await page.locator('#title [data-title-hull="block"]').click();
  for (const [key, value] of Object.entries({tL: 300, tW: 160, tH: 100})) await number(page, key, value, '#title');
  await page.locator('#title [data-title-name]').fill('予定寸法と構造物装甲の検証艦');
  assert.match(await page.locator('#titlePanel').innerText(), /完成艦の予定寸法/);
  await page.locator('#title [data-title-start]').click(); await latest(page);
  for (const selector of ['#chipMirror', '#chipVMirror']) if (await page.locator(selector).getAttribute('aria-pressed') === 'true') await page.locator(selector).click();
  const initial = await snapshot(page); assert.deepEqual(initial.planned, {L: 300, W: 160, H: 100});
  progress('native-new-design');

  await tab(page, 'mod');
  await (await visible(page, '#panel [data-group="shape"]')).click();
  const palette = await page.evaluate(() => ({ordinaryCards: document.querySelectorAll('#panel [data-part="struct"]').length, separateFaceStructureCards: document.querySelectorAll('#panel [data-part="surfaceStruct"]').length}));
  assert.equal(palette.ordinaryCards, 1); assert.equal(palette.separateFaceStructureCards, 0);
  const ordinary = await coordinatePart(page, 'struct', [275, 70, 45], [80, 50, 40]);
  const rangesBefore = await positionRanges(page), initialArmorControls = await armorControls(page, ordinary.id);
  assert.equal(initialArmorControls.length, 6);
  assert.equal(await page.locator('#panel [data-surface-host], #panel [data-surface-field]').count(), 0, 'Ordinary armor edits have no general machinery allocation editor');
  const engine = await coordinatePart(page, 'engine', [-10, 20, 15], null);
  progress('native-structure-and-engine');

  await tab(page, 'mod');
  await (await visible(page, '#panel [data-group="weapons"]')).click();
  await (await visible(page, '#panel [data-fit="pd"]')).click();
  await page.locator('#camSeg [data-cam="front"]').click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const mount = await page.evaluate(id => {
    const Y = window.__yard, p = Y.ship.parts.find(p => p.id === id), point = [p.c[0] + p.s[0] / 2, p.c[1], p.c[2]], pixel = Y.view().project(point).slice(0, 2), hit = Y.pick(...pixel, {parts: true, fits: false});
    return {point, pixel, host: hit?.part?.id, normal: hit?.n};
  }, ordinary.id);
  assert.equal(mount.host, ordinary.id, 'Native canvas fitting targets the ordinary structure');
  const oldFits = await page.evaluate(() => window.__yard.ship.fits.filter(f => !f.surfacePatch).map(f => f.id));
  await page.mouse.click(...mount.pixel); await latest(page);
  const fitting = await page.evaluate(oldFits => window.__yard.ship.fits.filter(f => !f.surfacePatch && !oldFits.includes(f.id)).map(f => ({id: f.id, kind: f.k, position: f.p, normal: window.__yard.C.fitUp(f), floating: f.float})), oldFits);
  assert.equal(fitting.length, 1); assert.equal(fitting[0].kind, 'pd'); assert.equal(fitting[0].floating, false);
  vector(fitting[0].normal, [1, 0, 0]);
  const beforeResize = await snapshot(page);
  fs.writeFileSync('/tmp/design-envelope-bounds-discrepancy.json', JSON.stringify(await boundsDiagnostic(page), null, 2) + '\n');
  physicalBoundsCheck(beforeResize);
  assert.ok(beforeResize.engineMachinery.length > 0, 'Native engine has occupied internal machinery');
  assert.ok(beforeResize.parts.find(p => p.id === engine.id)?.skinBounds, 'Actual engine bell geometry is measured');

  await tab(page, 'hull');
  await (await visible(page, '#panel [data-hullfollow="keep"]')).click();
  const ratio = await visible(page, '#panel [data-hullratio]'); if (await ratio.isChecked()) await ratio.uncheck();
  for (const [key, value] of Object.entries({L: 100, W: 60, H: 40})) { await number(page, key, value); await latest(page); }
  const shrunk = await snapshot(page); physicalBoundsCheck(shrunk);
  assert.deepEqual(shrunk.hull, {L: 100, W: 60, H: 40});
  assert.deepEqual(shrunk.planned, initial.planned); assert.deepEqual(shrunk.placementBounds, initial.placementBounds);
  assert.deepEqual(shrunk.parts.map(p => ({id: p.id, center: p.center, size: p.size})), beforeResize.parts.map(p => ({id: p.id, center: p.center, size: p.size})));
  assert.deepEqual(shrunk.fits.map(f => ({id: f.id, position: f.position})), beforeResize.fits.map(f => ({id: f.id, position: f.position})));
  assert.ok(shrunk.actualBounds[0] < 0 && shrunk.actualBounds[3] > 315, 'Aft engine and fore fitting both extend actual length');
  assert.ok(shrunk.actualDimensions[1] > 60 && shrunk.actualDimensions[2] > 40, 'Structure extends actual width and height');
  assert.ok(Math.abs(shrunk.actualDimensions[1] - 2 * Math.max(Math.abs(shrunk.actualBounds[2]), Math.abs(shrunk.actualBounds[5]))) > 1, 'Asymmetric width uses max minus min');
  const dimensionLabels = {planned: await page.locator('[data-design-envelope]').innerText(), actual: await page.locator('[data-actual-dimensions]').innerText()};
  await page.locator('#camSeg [data-cam="iso"]').click();
  await (await visible(page, '#panel [data-design-envelope]')).scrollIntoViewIfNeeded();
  const images = [await screenshot(page, 'planned-and-actual')];
  for (let i = 0; i < 3; i++) { await page.locator('#btnUndo').click(); await latest(page); }
  const undone = await snapshot(page); assert.deepEqual(undone.hull, beforeResize.hull); assert.deepEqual(undone.planned, initial.planned);
  assert.deepEqual(undone.parts, beforeResize.parts); assert.deepEqual(undone.fits, beforeResize.fits);
  for (let i = 0; i < 3; i++) { await page.locator('#btnRedo').click(); await latest(page); }
  const redone = await snapshot(page); vector(redone.actualDimensions, shrunk.actualDimensions); assert.deepEqual(redone.hull, shrunk.hull);
  await selectPart(page, ordinary.id); const rangesAfter = await positionRanges(page); assert.deepEqual(rangesAfter, rangesBefore);
  progress('native-hull-resize-undo-and-ranges');

  const originalSkin = await armorDiagnostic(page, ordinary.id);
  for (const face of ['fore', 'aft', 'top', 'bottom', 'port', 'stbd']) await setArmor(page, ordinary.id, face, .5);
  const thick = await armorDiagnostic(page, ordinary.id);
  assert.equal(thick.lights.length, 0, 'Half metre armor has no thin-armor lights');
  for (const face of thick.faces) { near(face.thickness, .5); assert.equal(face.mode, 'armor'); }
  await page.locator(`#panel [data-edpick="parts:${ordinary.id}"]`).dblclick();
  await (await visible(page, '#panel [data-structure-face-armor-editor]')).scrollIntoViewIfNeeded();
  images.push(await screenshot(page, 'armor-thick-face'));
  await setArmor(page, ordinary.id, 'top', .2);
  const thin = await armorDiagnostic(page, ordinary.id), repeat = await armorDiagnostic(page, ordinary.id);
  assert.ok(thin.lights.length > 0, 'Thin top armor has deterministic native light points');
  assert.deepEqual(thin.lights, repeat.lights, 'Repeated production light survey is deterministic');
  assert.ok(thin.uploadedLightVertices > thick.uploadedLightVertices, 'Real worker geometry uploads luminous alpha253 quads');
  assert.equal(thin.surfaceGeometry.surfaceDevices, thin.allLightRows * 6, 'Production light mesh contains one two-triangle quad per surveyed point');
  assert.ok(thin.uploadedStructureRanges.some(row => row[2] > 0), 'Original structure remains in real uploaded geometry');
  for (const state of [thick, thin]) {
    assert.equal(state.structureGeometrySha256, originalSkin.structureGeometrySha256, 'Armor changes preserve the original structure mesh');
    for (const key of ['kind', 'form', 'skin', 'skinAsset', 'paint']) assert.deepEqual(state[key], originalSkin[key]);
  }
  for (const face of thin.faces) { near(face.thickness, face.face === 'top' ? .2 : .5); assert.equal(face.mode, 'armor'); }
  const editedArmorControls = await armorControls(page, ordinary.id);
  await (await visible(page, '#panel [data-structure-face-armor-editor]')).scrollIntoViewIfNeeded();
  images.push(await screenshot(page, 'armor-thin-face'));
  const beforeSave = await snapshot(page); physicalBoundsCheck(beforeSave);
  progress('native-six-face-armor-and-lights');

  await page.locator('#btnMenu').click(); await page.locator('#btnSave').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('yard.saves') || '[]').some(r => r.name === '予定寸法と構造物装甲の検証艦'));
  const saved = await page.evaluate(async () => {
    const row = JSON.parse(localStorage.getItem('yard.saves') || '[]').find(r => r.name === '予定寸法と構造物装甲の検証艦');
    let data = row.data;
    if (data.startsWith('z1:')) { const bytes = Uint8Array.from(atob(data.slice(3)), c => c.charCodeAt(0)); data = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text(); }
    else if (data.startsWith('j1:')) data = data.slice(3);
    const design = JSON.parse(data); return {id: row.id, planned: design.designEnvelope, hull: {L: design.hull.L, W: design.hull.W, H: design.hull.H}, partKinds: design.parts.filter(p => !p.surfacePatch).map(p => p.k)};
  });
  assert.deepEqual(saved.planned, initial.planned); assert.deepEqual(saved.hull, shrunk.hull);
  const generation = await page.evaluate(() => window.__yard.eng.gen);
  await page.locator(`#saves [data-load="${saved.id}"]`).click();
  await page.waitForFunction(old => window.__yard.eng.gen > old, generation); await latest(page);
  const reopened = await snapshot(page); assert.deepEqual(reopened.planned, initial.planned); assert.deepEqual(reopened.placementBounds, initial.placementBounds);
  assert.deepEqual(reopened.parts, beforeSave.parts); assert.deepEqual(reopened.fits, beforeSave.fits); vector(reopened.actualDimensions, beforeSave.actualDimensions);
  await selectPart(page, ordinary.id); const reopenedControls = await armorControls(page, ordinary.id); assert.deepEqual(reopenedControls, editedArmorControls);
  const reopenedArmor = await armorDiagnostic(page, ordinary.id); assert.deepEqual(reopenedArmor.lights, thin.lights); assert.equal(reopenedArmor.structureGeometrySha256, thin.structureGeometrySha256);
  assert.ok(reopened.renderer.renderedFrames > 0); assert.equal(reopened.renderer.failures, 0);
  progress('native-save-reopen');
  return {newDesign: {nativeTitleMenu: true, plannedInputM: initial.planned, labelsContainCompletedShipPlan: true}, palette, placements: {ordinary, engine, fitting: {...fitting[0], nativeCanvasClick: true, ...mount}}, initial, beforeResize, shrunk, dimensionLabels, undo: {nativeThreeStepUndo: true, hull: undone.hull, partsAndFittingsRestored: true}, redo: {nativeThreeStepRedo: true, hull: redone.hull}, positionControls: {before: rangesBefore, after: rangesAfter}, armorEditor: {nativeSixFaceInputs: true, generalMachineryEditorAbsent: true, initialControls: initialArmorControls, editedControls: editedArmorControls, original: originalSkin, thick, thin, reopened: reopenedArmor}, saveReopen: {nativeMenu: true, saved, reopened}, images};
}

(async () => {
  const started = Date.now(), server = await serverIfNeeded();
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  let page;
  try {
    fs.mkdirSync(imageRoot, {recursive: true});
    const context = await browser.newContext({viewport: {width: 1660, height: 1120}, locale: 'ja-JP'}), errors = [];
    page = await context.newPage(); page.setDefaultTimeout(45000); page.on('pageerror', error => errors.push(String(error)));
    await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('yard.language', 'ja'); });
    const result = await run(page); assert.deepEqual(errors, []); assert.deepEqual(sources(), sourceSha256, 'Runtime inputs changed during browser verification');
    const report = {schemaVersion: 1, status: 'PASS', date: new Date().toISOString(), browser: 'Chromium headless with software WebGL', url, totalElapsedMs: Date.now() - started, sourceSha256, sourceGuard: {unchanged: true, expectedMatched: !!expectedPath, runtimeFiles: 9}, calibration: null, coreEpoch: {profileVersion: 12, costModelVersion: result.initial.costModelVersion, sourceSha256: sourceSha256['js/core.js'], runtimeStamp: result.initial.runtimeStamp}, scope: {verified: ['Native title-menu planned whole-craft dimensions', 'Single ordinary structure palette and native six-face armor thickness inputs', 'Native coordinate placement and canvas-mounted fitting using production geometry', 'Original structure mesh and skin retained under per-face armor edits', 'Deterministic light points for 0.2m top armor and none for 0.5m armor', 'Unscaled hull shrink preserves planned placement ranges and installed positions', 'Actual asymmetric bounds include structures, fitting, engine bell and machinery', 'Native hull Undo/Redo and native saved reopen', 'Native six-face armor edit and light positions persist after reopen'],notVerified: ['Physical mobile devices', 'Powered combat or sustained performance']}, ...result, errors};
    fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({status: report.status, output, elapsedMs: report.totalElapsedMs, planned: result.initial.planned, hull: result.shrunk.hull, actualDimensions: result.shrunk.actualDimensions, images: result.images.map(i => i.path)}, null, 2));
  } catch (error) {
    if (page) { await page.screenshot({path: '/tmp/design-envelope-browser-failure.png'}).catch(() => {}); fs.writeFileSync('/tmp/design-envelope-browser-failure.html', await page.content().catch(() => '')); }
    throw error;
  } finally { await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
