#!/usr/bin/env node
// Strict selected-face placement through the actual engine, independently of
// graphics/FPS. The baseline is bounded so a slow whole-ship survey cannot
// stall the benchmark indefinitely; a timeout is reported as a lower bound.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const zlib = require('node:zlib'), crypto = require('node:crypto');
const {execFileSync, fork} = require('node:child_process');
const {performance} = require('node:perf_hooks');
const root = path.resolve(__dirname, '..'), archive = 'assets/source/ship-example-blueprints/mandator2.json.gz';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const baseline = 'a4d3251141ad7f42caaa6248a6e58c8691ed9f21';
const files = ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/engine.js'];
const source = (file, old) => old ? execFileSync('git', ['show', baseline + ':' + file], {cwd: root, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8'}) : fs.readFileSync(path.join(root, file), 'utf8');

async function runCase(old, full) {
  const memoryBeforeRuntime = process.memoryUsage(), sources = Object.fromEntries(files.map(f => [f, source(f, old)]));
  const context = vm.createContext({console, performance, setTimeout, clearTimeout, structuredClone, Gfx: {}});
  for (const file of files.slice(0, -1)) vm.runInContext(sources[file], context, {filename: file});
  vm.runInContext('globalThis.C=Core', context);
  vm.runInContext(sources['js/engine.js'], context, {filename: 'js/engine.js'});
  const memoryAfterRuntime = process.memoryUsage(), bytes = zlib.gunzipSync(fs.readFileSync(path.join(root, archive))), ship = JSON.parse(bytes);
  const witness = ship.fits.find(f => f.id === 358), part = ship.parts.find(p => p.id === 1154), original = {parts: ship.parts.length, fits: ship.fits.length};
  if (full) ship.fits = ship.fits.filter(f => f.id !== witness.id);
  else { ship.parts = [part]; ship.fits = []; ship.links = []; ship.groups = []; }
  const partKey = JSON.stringify(part), request = {fit: {...witness, id: -1}, fitId: -1, list: 'fits', entityKind: 'fit',
    mode: 'direct', hostId: 1154, hostSurfaceId: 'p1154:top:2:12e2bm3', parentGeometryRevision: 0,
    placementModelVersion: context.C.PLACEMENT_MODEL_VERSION, geometryRevision: 1, hit: {p: witness.p, n: witness.n}};
  const state = JSON.stringify(ship), times = [], results = [];
  let done;
  const scope = {postMessage(message) {
    if (message.type === 'error') done.reject(new Error(message.message));
    else if (message.type === 'placement') done.resolve(structuredClone(message));
  }};
  context.scope = scope; vm.runInContext('YardEngine.listenWorker(scope)', context);
  for (let i = 0; i < 4; i++) {
    const started = performance.now(), pending = new Promise((resolve, reject) => { done = {resolve, reject}; });
    scope.onmessage({data: structuredClone({type: 'placement', id: i + 1, designId: 'mandator-benchmark', operationId: 'stamp-' + i,
      gen: 1, state, request})});
    const reply = await pending; times.push(performance.now() - started);
    if (!reply.result?.ok) throw new Error(JSON.stringify(reply));
    if (process.send) process.send({progress: {completedSolve: i + 1, elapsedMs: times[times.length - 1]}});
    results.push({ok: reply.result.ok, host: reply.result.fit.host, point: reply.result.fit.p,
      semanticFace: reply.result.fit.placement.hostSurfaceId, floating: reply.result.fit.float});
  }
  if (JSON.stringify(part) !== partKey) throw new Error('Authored source geometry changed');
  return {status: 'PASS', variant: old ? 'main-before' : 'working-tree-after', fixture: full ? 'full-318-parts-534-fittings' : 'selected-parent-only',
    original, retained: {parts: ship.parts.length, fits: ship.fits.length}, sourceSha256: Object.fromEntries(files.map(f => [f, sha(sources[f])])),
    sourceParentUnchanged: true, strictResults: results, elapsedMs: times,
    nodeProcessMemory: {beforeRuntime: memoryBeforeRuntime, afterRuntime: memoryAfterRuntime, afterPlacement: process.memoryUsage()}};
}

if (process.argv[2] === '--case') {
  runCase(process.argv[3] === 'before', process.argv[4] === 'full').then(result => {
    if (process.send) process.send(result); else console.log(JSON.stringify(result));
  }).catch(error => { if (process.send) process.send({status: 'ERROR', error: String(error.stack || error)}); else throw error; });
} else {
  const output = path.resolve(process.argv[2] || path.join(root, 'docs/benchmarks/placement-validation-latency.json'));
  const beforeSources = Object.fromEntries(files.map(f => [f, sha(source(f, false))]));
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(root, archive))), manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/source/ship-example-blueprints/manifest.json')));
  if (sha(bytes) !== manifest.models.mandator2.sha256) throw new Error('Source fixture checksum mismatch');
  const report = {status: 'RUNNING', date: new Date().toISOString(), command: 'node scripts/benchmark-placement-validation.cjs',
    baseline, sourceSha256: beforeSources, node: process.version, platform: process.platform + '/' + process.arch,
    scope: 'Strict compatibility-API benchmark, not the current normal UI path, which places a basic draft without waiting for this API. Actual saved Mandator2 parent1154 and stable semantic face. Full case retains every318 authored part and534 other fittings, removing only witness358 to avoid intentional overlap. Four exact Worker engine solves of the same witness pose; no rendering or app auto-commit timing. No source geometry simplification.',
    limitations: ['Node VM engine actor; browser scheduling, FPS, Safari and mobile timing are not measured here.',
      'RSS/heap figures describe an isolated Node helper process, including loading the complete runtime; they are not a browser extra-Worker allocation or a device peak.',
      'Baseline timeout is a lower bound, not a measured completion time. Cases run sequentially; other independent development processes may be active.'],
    fixture: {archive, unpackedSha256: sha(bytes), witnessFitId: 358, parentId: 1154, surfaceId: 'p1154:top:2:12e2bm3'}, cases: []};
  fs.mkdirSync(path.dirname(output), {recursive: true});
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n'); save();
  const childCase = (old, full) => new Promise(resolve => {
    const timeoutMs = old ? 15000 : 30000, started = performance.now();
    const child = fork(__filename, ['--case', old ? 'before' : 'after', full ? 'full' : 'parent'], {cwd: root, stdio: ['ignore', 'ignore', 'pipe', 'ipc']});
    let stderr = '', settled = false; const progress = []; child.stderr.on('data', d => { stderr += d; });
    const finish = result => { if (settled) return; settled = true; clearTimeout(timer); child.kill(); resolve(result); };
    const timer = setTimeout(() => finish({status: 'TIMEOUT', variant: old ? 'main-before' : 'working-tree-after', fixture: full ? 'full-318-parts-534-fittings' : 'selected-parent-only',
      timeoutMs, observedWallMs: performance.now() - started, completedSolves: progress,
      scope: 'The four-solve case did not finish within this wall-time budget, including source evaluation. Any completed solves are listed; no missing solve completion time is claimed.'}), timeoutMs);
    child.on('message', result => { if (result.progress) progress.push(result.progress); else finish({variant: old ? 'main-before' : 'working-tree-after', fixture: full ? 'full-318-parts-534-fittings' : 'selected-parent-only', ...result}); }); child.on('exit', code => { if (!settled) finish({status: 'ERROR', variant: old ? 'main-before' : 'working-tree-after', fixture: full ? 'full-318-parts-534-fittings' : 'selected-parent-only', code, stderr}); });
  });
  (async () => {
    for (const full of [false, true]) for (const old of [true, false]) { report.cases.push(await childCase(old, full)); save(); }
    const after = Object.fromEntries(files.map(f => [f, sha(source(f, false))]));
    report.sourceStable = JSON.stringify(beforeSources) === JSON.stringify(after); report.sourceSha256After = after;
    report.status = report.sourceStable && report.cases.length === 4 && report.cases.every(c => c.status === 'PASS' || c.variant === 'main-before' && c.status === 'TIMEOUT') ? 'PASS' : 'ERROR';
    report.completedAt = new Date().toISOString(); save(); console.log(JSON.stringify({status: report.status, output, cases: report.cases.map(c => ({variant: c.variant, fixture: c.fixture, status: c.status, ms: c.elapsedMs}))}));
    if (report.status !== 'PASS') process.exitCode = 1;
  })().catch(error => { report.status = 'ERROR'; report.error = String(error.stack || error); save(); process.exitCode = 1; });
}
