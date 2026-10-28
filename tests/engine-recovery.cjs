const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {setTimeout: delay} = require('node:timers/promises');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));

async function setup() {
  const messages = [];
  const worker = {postMessage: m => messages.push(m), terminate() { this.terminated = true; }};
  const c = vm.createContext({setTimeout, clearTimeout, structuredClone, performance, Blob,
    Worker: function() {}, console: {...console, error() {}}, document: {activeElement: null}});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js', 'js/engine.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, {filename: file});
  }
  vm.runInContext(`
    const C = Core, $ = () => null;
    const st = {tab:'hull'}, fleet = {mode:'design'}, dirty = {}, live = {};
    let ship = C.newShip({L:100,W:40,H:15}, 'Recovery test'), S = null, prevS = null, dragSnap = null;
    let view = null, bounds = null;
    let geometryCount = 0;
    const refreshOverlay = () => {}, requestDraw = () => {}, fitCamera = () => {};
    const hideBusyOverlay = () => { geometryCount++; }, renderPanelInfo = () => {};
    const updateAviationUI = () => {}, autosave = () => {}, titleVisible = () => false;
    const selItem = () => null, armMode = () => false, renderStrip = () => {}, renderSpecTargets = () => {};
    const updateGroundUI = () => {}, toast = () => {}, esc = String;
  `, c);
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const start = app.indexOf('const eng = {'), end = app.indexOf('// ---------- live preview ----------', start);
  assert.ok(start >= 0 && end > start);
  vm.runInContext(app.slice(start, end), c, {filename: 'app-background-engine.js'});
  c.testWorker = worker;
  await vm.runInContext('YardEngineClient.start(null, {workerReady:Promise.resolve(testWorker)}).then(engineHello)', c);
  return {c, worker, messages, run: code => vm.runInContext(code, c)};
}

async function until(fn) {
  const deadline = Date.now() + 5000;
  while (!fn()) {
    assert.ok(Date.now() < deadline, 'engine did not finish rebuilding after worker failure');
    await delay(10);
  }
}

test('a worker failing during an update rebuilds the latest design inline and accepts further edits', async () => {
  const {run, worker, messages} = await setup();
  run("touch('hull')");
  await until(() => messages.length === 1);
  assert.equal(run('eng.waiting'), true);
  // An edit queued behind the interrupted calculation must survive recovery.
  run("ship.hull.L = 140; touch('hull')");
  worker.onerror({message: 'simulated worker failure', preventDefault() {}});
  assert.equal(worker.terminated, true);
  await until(() => run('S !== null && eng.statsGen === eng.gen && !eng.waiting'));
  assert.equal(run('YardEngineClient.mode'), 'inline');
  assert.equal(run('eng.mode'), 'inline');
  assert.equal(run('S.hullLen'), 140);
  assert.ok(run('geometryCount > 0 && !!ship._geoProxy'));
  run("ship.hull.L = 175; touch('hull')");
  await until(() => run('S.hullLen === 175 && eng.statsGen === eng.gen && !eng.waiting'));
  assert.equal(messages.length, 1, 'updates after recovery must use the inline engine');
});

test('a worker failing while idle does not strand the next edit', async () => {
  const {run, worker} = await setup();
  worker.onerror({message: 'simulated idle failure', preventDefault() {}});
  await until(() => run('S !== null && eng.statsGen === eng.gen && !eng.waiting'));
  run("ship.hull.L = 160; touch('hull')");
  await until(() => run('S.hullLen === 160 && eng.statsGen === eng.gen && !eng.waiting'));
});
