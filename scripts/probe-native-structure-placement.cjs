#!/usr/bin/env node
// Read-only bounded diagnostic of the real Imperial178 contact-cut path.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const {fork} = require('node:child_process'), {performance} = require('node:perf_hooks');
const root = path.resolve(__dirname, '..'), fixturePath = 'assets/source/imperial-ii-user-layout/imperial-ii-upload.json';
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const names = ['fitPlacementContact', 'placementCompactPlanarSolid', 'placementSelectedContactFaces', 'placementExtendedContactSolid',
  'placementConformingSolid', 'placementDifference', 'placementContact', 'meshEditCheck', 'placementSurfacePatch', 'placementValidateSolid'];
if (process.argv[2] === '--child') {
  let active = false;
  const emit = message => process.send?.(message);
  const context = vm.createContext({console, performance, __placementProbe(name, phase, at, detail) {
    if (active) emit({event: {name, phase, elapsedMs: performance.now() - at, detail, memory: process.memoryUsage()}});
  }});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  let core = fs.readFileSync(path.join(root, 'js/core.js'), 'utf8');
  for (const name of names) {
    const marker = 'function ' + name + '(';
    if (!core.includes(marker)) continue;
    const wrap = `function ${name}(...args){const at=performance.now();globalThis.__placementProbe('${name}','enter',at,{triangles:args[0]?.length/9});try{const result=${name}ProbeRaw(...args);globalThis.__placementProbe('${name}','exit',at,{ok:result?.ok,code:result?.code,triangles:result?.tris?.length/9});return result;}catch(error){globalThis.__placementProbe('${name}','throw',at,{error:String(error)});throw error;}}\nfunction ${name}ProbeRaw(`;
    core = core.replace(marker, wrap);
  }
  vm.runInContext(core, context, {filename: 'instrumented-core.js'});
  const C = vm.runInContext('Core', context), raw = JSON.parse(fs.readFileSync(path.join(root, fixturePath))), ship = C.deserialize(raw, {deferPlacementGeometry: true});
  const keep = new Set([48, 55, 56, 57, 173, 174, 175, 178]); ship.parts = ship.parts.filter(p => keep.has(p.id));
  ship.fits = []; ship.hatches = []; ship.links = []; ship.groups = [];
  const parent = ship.parts.find(p => p.id === 178), generatedAt = performance.now(); parent._solidCutShip = ship;
  const T = C.structTriangles(parent), triangles = [];
  for (let i = 0; i < T.length; i += 9) {
    const a = Array.from(T.slice(i, i + 3)), b = Array.from(T.slice(i + 3, i + 6)), c = Array.from(T.slice(i + 6, i + 9));
    const rawNormal = C.cross(C.sub(b, a), C.sub(c, a)), n = C.norm(rawNormal), area = C.len(rawNormal);
    if (area >= 1 && n[1] > .5) triangles.push({p: C.mul(C.add(C.add(a, b), c), 1 / 3), n, area});
  }
  triangles.sort((a, b) => b.area - a.area);
  const selector = process.argv[3] || '0', rayTarget = selector.startsWith('x') ? C.rayTris(T, [Number(selector.slice(1)), 1e6, 0], [0, -1, 0]) : null;
  if (selector.startsWith('x') && !rayTarget) throw Error('Requested top ray misses the actual parent');
  const hit = rayTarget ? {p: rayTarget.p, n: rayTarget.n} : triangles[Number(selector) || 0], position = [hit.p[0], hit.p[1] + 15, hit.p[2]];
  const patch = C.surfacePatches(ship, true, false, new Set(['p178'])).find(p => C.rayTris(p.triangles, C.add(hit.p, C.mul(hit.n, .05)), C.mul(hit.n, -1), .1));
  const part = {id: -1, k: 'struct', form: 'box', c: position, s: [180, 110, 50], yaw: 0, pitch: 0, roll: 0, taper: 0};
  const request = {mode: 'horizontal', parentStructureId: 178, parentGeometryRevision: 0,
    hostSurfaceId: patch?.id, position, hit: {p: hit.p, n: hit.n}, geometryRevision: 1, placementModelVersion: C.PLACEMENT_MODEL_VERSION};
  emit({fixture: {targetSelector: selector, parts: ship.parts.length, fits: ship.fits.length, parentTriangles: T.length / 9,
    parentMeshGenerationMs: performance.now() - generatedAt, sourceSha256: hash('js/core.js'), part, request}});
  active = true; const started = performance.now(), result = C.solvePlacement(ship, part, request);
  emit({result: {ok: result.ok, code: result.code, error: result.error, elapsedMs: performance.now() - started,
    triangles: result.part?._placementGeometry?.local.length / 9, volume: result.part?._placementGeometry?.volume, memory: process.memoryUsage()}});
} else {
  const output = path.resolve(process.argv[2] || path.join(root, 'docs/benchmarks/native-structure-placement-probe.json'));
  const report = {status: 'RUNNING', date: new Date().toISOString(), coreSha256: hash('js/core.js'), fixture: {path: fixturePath, sha256: hash(fixturePath)},
    scope: 'Bounded instrumented actual Core diagnostic. Retains authenticated parent178 geometry and the same8 authored UI fixture parts. Horizontal180x110x50m box at an area-ranked real upward triangle centroid or a real top ray at the explicit x selector, using current UI15m centre offset. Does not claim that the browser camera chooses this exact target; actual browser request should be compared.',
    events: []};
  fs.mkdirSync(path.dirname(output), {recursive: true}); const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); save();
  const child = fork(__filename, ['--child', process.argv[3] || '0'], {cwd: root, stdio: ['ignore', 'ignore', 'pipe', 'ipc']});
  let stderr = ''; child.stderr.on('data', b => { stderr += b; });
  const timer = setTimeout(() => { clearInterval(memoryTimer); report.status = 'TIMEOUT'; report.timeoutMs = 20000; save(); child.kill(); console.log(JSON.stringify({status: report.status, output, lastEvent: report.events.at(-1)})); }, 20000);
  const memoryTimer = setInterval(() => {
    try {
      const match = fs.readFileSync('/proc/' + child.pid + '/status', 'utf8').match(/^VmRSS:\s+(\d+)/m), bytes = Number(match?.[1] || 0) * 1024;
      report.peakObservedRssBytes = Math.max(report.peakObservedRssBytes || 0, bytes);
      if (bytes > 1024 ** 3) { clearTimeout(timer); clearInterval(memoryTimer); report.status = 'MEMORY_LIMIT'; report.memoryLimitBytes = 1024 ** 3; save(); child.kill(); }
    } catch (_) {}
  }, 100);
  child.on('message', message => {
    if (message.event) report.events.push(message.event);
    if (message.fixture) report.actualFixture = message.fixture;
    if (message.result) { report.result = message.result; report.status = message.result.ok ? 'PASS' : 'REJECTED'; clearTimeout(timer); clearInterval(memoryTimer); save(); child.kill(); console.log(JSON.stringify({status: report.status, output, result: report.result})); }
    else save();
  });
  child.on('exit', code => { clearInterval(memoryTimer); if (report.status === 'RUNNING') { clearTimeout(timer); report.status = 'ERROR'; report.error = {code, stderr}; save(); console.log(JSON.stringify(report.error)); } });
}
