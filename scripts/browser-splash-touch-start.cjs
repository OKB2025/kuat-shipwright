#!/usr/bin/env node
// Native touch entry, cancellation and click-through against the production page.
// WEBKIT_PATH may select a locally installed WebKit wrapper. No physical iOS claim.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium, webkit, devices} = require('playwright');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const output = process.env.KS_SPLASH_OUTPUT && path.resolve(process.env.KS_SPLASH_OUTPUT);
const expectedMode = process.env.KS_EXPECT_ENGINE_MODE || 'worker';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'index.html'), 'utf8').match(/window\.KS_FILES=(\{[^\n]+\});/)[1]);
const files = [...new Set(['index.html', ...manifest.data, ...Object.values(manifest).filter(value => typeof value === 'string' && value.endsWith('.js')), 'js/i18n.js', 'js/lang-en.js'])];
const sources = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const before = sources();
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'application/octet-stream');
    response.end(data);
  });
});

async function contextFor(browser) {
  const context = await browser.newContext({...devices['iPhone 13'], viewport: {width: 844, height: 390}, locale: 'ja-JP'});
  // External telemetry is outside this local production-code test.
  await context.route('**/cloudflareinsights.com/**', route => route.fulfill({status: 204, headers: {'access-control-allow-origin': '*'}, body: ''}));
  await context.addInitScript(() => {
    localStorage.setItem('yard.language', 'ja');
    localStorage.setItem('ks.audio.v1', JSON.stringify({muted: true, master: 0, music: 0, sfx: 0, musicSource: 'classic'}));
    window.__splashTouch = {events: [], audio: [], menuClicks: []};
    for (const type of ['pointerdown', 'touchstart', 'pointerup', 'touchend', 'touchcancel', 'click']) document.addEventListener(type, event => {
      window.__splashTouch.events.push({type, trusted: event.isTrusted, target: event.target.tagName, locked: document.body.classList.contains('splash-on')});
      const button = event.type === 'click' && event.target.closest('[data-title-mode]');
      if (button) window.__splashTouch.menuClicks.push(button.dataset.titleMode);
    }, true);
    const Native = window.AudioContext || window.webkitAudioContext;
    if (Native) {
      class InterruptedAudioContext extends Native {
        constructor(...args) {
          window.__splashTouch.audio.push({locked: document.body.classList.contains('splash-on'), out: document.querySelector('#splash')?.classList.contains('out') === true});
          super(...args);
          Object.defineProperty(this, 'state', {get: () => 'interrupted'});
        }
        resume() { return new Promise(() => {}); }
      }
      window.AudioContext = InterruptedAudioContext;
      window.webkitAudioContext = InterruptedAudioContext;
    }
  });
  return context;
}

async function ready(page, url) {
  await page.goto(url, {waitUntil: 'domcontentloaded'});
  await page.locator('#splash.ready .splash-start').waitFor({timeout: 180000});
  await page.waitForFunction(() => window.__yard?.eng.ready, null, {timeout: 180000});
  assert.equal(await page.evaluate(() => window.__yard.eng.mode), expectedMode, 'verify the production worker path');
}

async function cancelledStart(url) {
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage']});
  const context = await contextFor(browser), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  let releaseApp, appRequested;
  const held = new Promise(resolve => { releaseApp = resolve; });
  const requested = new Promise(resolve => { appRequested = resolve; });
  await page.route('**/js/app.js', async route => { appRequested(); await held; await route.continue(); });
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await requested;
    const cdp = await context.newCDPSession(page);
    const early = await page.locator('#splash').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: early.x + early.width / 2, y: early.y + early.height / 2}]});
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
    assert.equal(await page.evaluate(() => document.body.classList.contains('splash-on') && !document.querySelector('#splash').classList.contains('out')), true, 'loading remains gated');
    releaseApp();
    await page.locator('#splash.ready .splash-start').waitFor({timeout: 180000});
    await page.waitForFunction(() => window.__yard?.eng.ready, null, {timeout: 180000});
    assert.equal(await page.evaluate(() => window.__yard.eng.mode), expectedMode);
    await page.evaluate(() => { window.__splashTouch.events.length = 0; window.__splashTouch.audio.length = 0; });
    const box = await page.locator('.splash-start').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: box.x + box.width / 2, y: box.y + box.height / 2}]});
    const firstStart = await page.evaluate(() => ({locked: document.body.classList.contains('splash-on'), out: document.querySelector('#splash').classList.contains('out'), ...window.__splashTouch}));
    assert.equal(firstStart.locked, false, 'entry must complete without any release or click');
    assert.equal(firstStart.out, true);
    assert.ok(firstStart.audio.length > 0, 'native audio initialization was exercised');
    assert.ok(firstStart.audio.every(call => call.out && !call.locked), 'dismissal precedes audio construction');
    assert.ok(firstStart.events.some(event => event.trusted && event.type === 'touchstart'));
    assert.ok(!firstStart.events.some(event => ['touchend', 'pointerup', 'click'].includes(event.type)));
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
    assert.equal(await page.locator('[data-tgroup="top"]').isVisible(), true);
    assert.deepEqual(errors, []);
    return {status: 'PASS', loadingGate: true, nativeCancelledStart: true, dismissalBeforeAudio: true, engineMode: expectedMode, firstStart, errors};
  } finally { releaseApp(); await context.close(); await browser.close(); }
}

async function completeWebKitTouch(url) {
  const executablePath = process.env.WEBKIT_PATH || webkit.executablePath();
  if (!fs.existsSync(executablePath)) return {status: 'SKIPPED', reason: 'WebKit executable unavailable; set WEBKIT_PATH to run this check'};
  const browser = await webkit.launch({headless: true, executablePath}), context = await contextFor(browser), page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  try {
    await ready(page, url);
    // Rotate while the start screen is open, then restore the reported landscape layout.
    await page.setViewportSize({width: 390, height: 844});
    await page.setViewportSize({width: 844, height: 390});
    const sandbox = page.locator('[data-title-mode="sandbox"]').first(), box = await sandbox.boundingBox();
    assert.ok(box && !await sandbox.isDisabled());
    // The same coordinates are a splash tap first and a deliberate menu tap second.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => !document.body.classList.contains('splash-on') && !document.querySelector('#splash'));
    const afterEntry = await page.evaluate(() => ({...window.__splashTouch, topVisible: !document.querySelector('[data-tgroup="top"]').hidden}));
    assert.equal(afterEntry.topVisible, true);
    assert.deepEqual(afterEntry.menuClicks, [], 'entry cannot click a menu button behind the splash');
    assert.ok(afterEntry.events.some(event => event.type === 'touchstart' && event.trusted));
    assert.ok(afterEntry.audio.length > 0 && afterEntry.audio.every(call => call.out && !call.locked));
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => !document.querySelector('[data-tgroup="sandbox"]').hidden);
    assert.deepEqual(await page.evaluate(() => window.__splashTouch.menuClicks), ['sandbox'], 'the next intentional menu tap still works');
    assert.deepEqual(errors, []);
    return {status: 'PASS', orientationChange: true, nativeTouch: true, noClickThrough: true, nextMenuTap: true, engineMode: expectedMode, afterEntry, errors};
  } finally { await context.close(); await browser.close(); }
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port + '/?splash';
  const chromiumResult = await cancelledStart(url), webkitResult = await completeWebKitTouch(url);
  const after = sources();
  assert.deepEqual(after, before, 'production sources changed during browser verification');
  const result = {status: 'PASS', scope: 'Local production page. Chromium native cancelled touch and WebKit native full touch; emulation is not physical iOS verification.', sourceSha256: before, chromium: chromiumResult, webkit: webkitResult, completedAt: new Date().toISOString()};
  if (output) { fs.mkdirSync(path.dirname(output), {recursive: true}); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n'); }
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
