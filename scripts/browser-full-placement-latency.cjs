#!/usr/bin/env node
// Full authored Mandator proof. Exactly one existing fitting is removed to
// free a known valid native mounting point; every other part/fitting remains.
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..'), url = process.argv[2] || 'http://127.0.0.1:8000/';
const output = path.resolve(process.argv[3] || path.join(root, 'docs/benchmarks/full-mandator-placement-latency.json'));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const files = ['index.html', 'data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/gfx.js', 'js/engine.js', 'js/app.js', 'js/design-ui.css', 'js/i18n.js', 'js/lang-en.js'];
const hashes = () => Object.fromEntries(files.map(f => [f, sha(fs.readFileSync(path.join(root, f)))]));
const archive = 'assets/source/ship-example-blueprints/mandator2.json.gz', bytes = zlib.gunzipSync(fs.readFileSync(path.join(root, archive))), raw = JSON.parse(bytes);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/source/ship-example-blueprints/manifest.json')));
assert.equal(sha(bytes), manifest.models.mandator2.sha256);
const witness = raw.fits.find(f => f.id === 358), report = {status: 'RUNNING', date: new Date().toISOString(),
  sourceSha256: hashes(), harnessSha256: sha(fs.readFileSync(__filename)), fixture: {archive, unpackedSha256: sha(bytes),
    originalParts: raw.parts.length, originalFits: raw.fits.length, removedFitId: 358, parentId: 1154, semanticFace: 'p1154:top:2:12e2bm3'},
  scope: 'Full318-part Mandator with534 existing fittings. Native fullscreen catalog, early real Gfx parent-mesh pick, immediate stable-ID placement/render/Undo/Redo while the main Worker is busy, and separately bounded background-resolution observation. No parent-only extraction, custom face proxy, or geometry simplification.',
  conditions: {graphics: 'Chromium SwiftShader', viewport: [1440, 1000], safari: 'Not tested',
    concurrentActivity: 'Compact-design Chromium SwiftShader and Node functional regressions may run concurrently under root coordination; exact overlap with individual phases is not instrumented. This is functional timing and heap observation, not a controlled graphics/device comparison.',
    controlledDeviceBenchmark: false, memory: 'CDP main-page heap only. Normal placement must not start the optional strict-placement actor. Worker heaps, GPU, process RSS and device peak excluded.'}, stages: [], errors: [], httpObservationErrors: []};
fs.mkdirSync(path.dirname(output), {recursive: true});
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
const stage = name => { report.stage = name; report.stages.push({name, at: new Date().toISOString()}); save(); console.log(name); };
(async () => {
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}, locale: 'ja-JP'}), served = {}, captures = [];
  page.setDefaultTimeout(45000); page.on('pageerror', error => report.errors.push(String(error)));
  const cdp = await page.context().newCDPSession(page), browserCDP = await browser.newBrowserCDPSession();
  const sourceRequests=new Map();
  cdp.on('Network.responseReceived',({requestId,response})=>{const path=new URL(response.url).pathname.replace(/^\//,'')||'index.html',file=path.endsWith('.gz')?path.slice(0,-3):path;if(files.includes(file))sourceRequests.set(requestId,file);});
  cdp.on('Network.loadingFinished',({requestId})=>{const file=sourceRequests.get(requestId);if(!file)return;sourceRequests.delete(requestId);captures.push(cdp.send('Network.getResponseBody',{requestId}).then(({body,base64Encoded})=>{const bytes=Buffer.from(body,base64Encoded?'base64':'utf8'),decoded=bytes[0]===0x1f&&bytes[1]===0x8b?zlib.gunzipSync(bytes):bytes;served[file]=sha(decoded);}).catch(error=>report.httpObservationErrors.push({file,error:error.message})));});
  await cdp.send('Network.enable', {maxTotalBufferSize: 256 * 1024 * 1024, maxResourceBufferSize: 128 * 1024 * 1024});
  try {
    stage('boot'); await page.addInitScript(() => localStorage.setItem('yard.language', 'ja'));
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__yard?.eng.ready, null, {timeout: 90000});
    assert.equal(await page.evaluate(() => YardEngineClient.mode), 'worker');
    report.mainHeapBefore = await cdp.send('Runtime.getHeapUsage');
    report.seed = await page.evaluate(raw => {
      const Y = window.__yard, C = Y.C, s = C.deserialize(raw, {deferPlacementGeometry: true}), parent = s.parts.find(p => p.id === 1154);
      const shape = p => C.publicJSON([p.form, p.c, p.s, p.yaw, p.pitch, p.roll, p.hullProfile, p.hullData]);
      window.__fullParentShape = shape(parent); s.fits = s.fits.filter(f => f.id !== 358);
      window.__fullOriginalFitIds=s.fits.map(f=>f.id);
      Y.setShip(s); Y.title.hide(); Object.assign(Y.st, {tab: 'mod', group: 'weapons', fit: 'utl', fitTool: 'place',
        mirror: false, vmirror: false, alignment: 'none', sel: null, view: 'normal', weaponMount: 'auto'});
      Y.renderPanel(); Y.draw(); window.__fullPlacementTiming = {requests: [], preparations: [], workerPreparations: 0, uploads: [], pingComplete: false};
      const prepare=C.preparePlacementDraft.bind(C);C.preparePlacementDraft=(...args)=>{const at=performance.now(),result=prepare(...args);window.__fullPlacementTiming.preparations.push({elapsedMs:performance.now()-at,ok:result.ok,pending:result.pending});return result;};
      const prepareWorker=YardEngineClient.preparePlacement.bind(YardEngineClient);YardEngineClient.preparePlacement=(...args)=>{window.__fullPlacementTiming.workerPreparations++;return prepareWorker(...args);};
      const request = YardEngineClient.request.bind(YardEngineClient);
      YardEngineClient.request = (type, payload, transfer) => {
        const at = performance.now(),row=type==='placement'?{operationId:payload.operationId,phase:'sent'}:null;
        if(row)window.__fullPlacementTiming.requests.push(row);
        return request(type, payload, transfer).then(packet => {
          if(row)Object.assign(row,{phase:'settled',elapsedMs: performance.now() - at,
            ok: packet.result?.ok, code: packet.result?.code, stale: !!packet.stale, gen: packet.gen});
          return packet;
        });
      };
      return {parts: s.parts.length, fits: s.fits.length, gen: Y.eng.gen, parentId: parent.id};
    }, raw);
    assert.equal(report.seed.parts, 318); assert.equal(report.seed.fits, 534); stage('full-authored-ship-seeded');
    await page.waitForFunction(() => { const Y = window.__yard, parent = Y.ship.parts.find(p => p.id === 1154);
      return Y.ship._geoProxy?.placementBodies?.some(body => body.parentStructureId === 1154 && body.triangles?.length && body.sourceKey === Y.C.publicJSON(parent));
    }, null, {timeout: 90000});
    report.earlyGeometry = await page.evaluate(() => { const Y = window.__yard, body = Y.ship._geoProxy.placementBodies.find(b => b.parentStructureId === 1154);
      return {gen: Y.eng.gen, adoptedGen: Y.eng.adoptedGen, statsGen: Y.eng.statsGen, parentTriangles: body.triangles.length / 9,
        fullFaceSurveyReady: !!Y.ship._geoProxy?.surfaces?.some(p => p.id === 'p1154:top:2:12e2bm3')}; });
    assert.equal(report.earlyGeometry.fullFaceSurveyReady, false, 'the native tap must not wait for the whole-ship surface survey');
    stage('real-worker-authoring-body-ready-before-full-survey');
    const workersBeforeCatalog = new Set((await browserCDP.send('Target.getTargets')).targetInfos.filter(t => t.type === 'worker').map(t => t.targetId));
    await page.locator('[data-design-open="new"]').click();
    await page.locator('[data-design-category="weapon"]').click();
    await page.locator('[data-palpick="fit:utl"]').click();
    await page.locator('[data-design-action="arm"]').click();
    report.target = await page.evaluate(witness => {
      const Y = window.__yard, v = Y.view(); v.cam.ortho = true; v.cam.th = -Math.PI / 2; v.cam.ph = .0001; v.cam.r = 950;
      v.cam.target = Y.C.add(witness.p, v.off); Y.eng.fitOnGeometry = false; Y.draw();
      return {point: witness.p, gen: Y.eng.gen, statsGen: Y.eng.statsGen};
    }, witness);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    report.target = {...report.target, ...await page.evaluate(witness => {
      const Y = window.__yard, pixel = Y.view().project(witness.p).slice(0, 2), hit = Y.pick(...pixel, {parts: false, fits: true});
      YardEngineClient.request('ping').then(() => { window.__fullPlacementTiming.pingComplete = true; });
      window.__fullPlacementTiming.tapStarted = performance.now();
      const timing=window.__fullPlacementTiming,view=Y.view(),upload=view.upload,draw=view.draw,push=Y.ship.fits.push;
      view.canvas.addEventListener('pointerdown',()=>{timing.nativeTapStarted=performance.now();},{once:true,capture:true});
      Object.defineProperty(Y.ship.fits,'push',{configurable:true,value:function(...items){const result=push.apply(this,items);if(items.some(f=>!window.__fullOriginalFitIds.includes(f.id))){timing.stableIdAt=performance.now();timing.placedId=items.find(f=>!window.__fullOriginalFitIds.includes(f.id)).id;}return result;}});
      view.upload=function(key,g){const result=upload.apply(this,arguments);if(timing.stableIdAt&&['previewFits','previewRefFits'].includes(key)){let nonFinite=0;for(let i=0;i<g.n*3;i++)if(!Number.isFinite(g.pos[i]))nonFinite++;timing.uploads.push({key,vertices:g.n,indices:g.ni,nonFinite});}return result;};
      view.draw=function(){const result=draw.apply(this,arguments);if(timing.stableIdAt&&!timing.firstRenderedAt&&Y.ship.fits.length===535&&timing.uploads.some(g=>g.vertices>0&&g.nonFinite===0))timing.firstRenderedAt=performance.now();return result;};
      return {pixel, canvasTarget: document.elementFromPoint(...pixel) === Y.view().canvas,
        hit: hit ? {parentId: hit.parentStructureId, surfaceId: hit.hostSurfaceId, point: hit.p} : null};
    }, witness)};
    assert.equal(report.target.canvasTarget, true); assert.equal(report.target.hit?.parentId, 1154);
    assert.ok(report.target.hit?.surfaceId == null || report.target.hit.surfaceId === 'p1154:top:2:12e2bm3');
    stage('native-full-ship-tap'); await page.mouse.click(...report.target.pixel);
    await page.waitForFunction(() => window.__yard.ship.fits.length === 535&&window.__fullPlacementTiming.firstRenderedAt, null, {timeout: 45000});
    report.placed = await page.evaluate(() => {
      const Y = window.__yard, C = Y.C, parent = Y.ship.parts.find(p => p.id === 1154);
      const installed = Y.ship.fits.filter(f => !window.__fullOriginalFitIds.includes(f.id));
      const shape = C.publicJSON([parent.form, parent.c, parent.s, parent.yaw, parent.pitch, parent.roll, parent.hullProfile, parent.hullData]);
      return {parts: Y.ship.parts.length, fits: Y.ship.fits.length, gen: Y.eng.gen, statsGen: Y.eng.statsGen,
        tapToObservedCommitMs: performance.now() - window.__fullPlacementTiming.tapStarted,
        tapToStableIdMs:window.__fullPlacementTiming.stableIdAt-window.__fullPlacementTiming.nativeTapStarted,
        tapToFirstRenderMs:window.__fullPlacementTiming.firstRenderedAt-window.__fullPlacementTiming.nativeTapStarted,
        renderTimingScope:'First main Renderer.draw completion after stable-ID insertion; screenshot follows. This is not hardware display latency or an FPS measurement.',
        timing: window.__fullPlacementTiming, installed: installed.map(f => ({id: f.id, k: f.k, host: f.host, p: f.p, n: f.n, floating: f.float,
          face: f.placement.hostSurfaceId,pending:!!f.placement.pendingGeometry,failed:!!f.placement.validationFailed})), parentShapeUnchanged: shape === window.__fullParentShape,
        draftStatus:C.placementDraftStatus(Y.ship),
        confirmButtons: document.querySelectorAll('[data-design-action="confirm"]').length, glError: Y.view().gl.getError()};
    });
    assert.equal(report.placed.parts, 318); assert.equal(report.placed.fits, 535); assert.equal(report.placed.parentShapeUnchanged, true);
    assert.equal(report.placed.confirmButtons, 0); assert.equal(report.placed.glError, 0);
    assert.equal(report.placed.timing.requests.length, 0);assert.equal(report.placed.timing.workerPreparations,0);
    assert.equal(report.placed.timing.preparations.length,1);assert.equal(report.placed.timing.preparations[0].pending,true);
    assert.ok(report.placed.timing.uploads.some(g=>g.vertices>0));assert.ok(report.placed.timing.uploads.every(g=>g.nonFinite===0));
    assert.equal(report.placed.installed.length, 1); assert.equal(report.placed.installed[0].host, 1154); assert.equal(report.placed.installed[0].floating, false);
    assert.equal(report.placed.timing.pingComplete, false, 'basic native placement renders while the main statistics actor still cannot answer ping');
    report.mainHeapAfter = await cdp.send('Runtime.getHeapUsage');
    report.newWorkerCount=(await browserCDP.send('Target.getTargets')).targetInfos.filter(t=>t.type==='worker'&&!workersBeforeCatalog.has(t.targetId)).length;
    stage('full-native-immediate-placement-rendered');
    await page.screenshot({path: output.replace(/\.json$/, '.jpg'), type: 'jpeg', quality: 82});
    const placedId=report.placed.installed[0].id;
    await page.locator('#btnUndo').click();await page.waitForFunction(()=>window.__yard.ship.fits.length===534);
    report.undo=await page.evaluate(()=>({fits:window.__yard.ship.fits.length,gen:window.__yard.eng.gen,pingComplete:window.__fullPlacementTiming.pingComplete}));
    await page.locator('#btnRedo').click();await page.waitForFunction(()=>window.__yard.ship.fits.length===535);
    report.redo=await page.evaluate(id=>({stableIdPreserved:window.__yard.ship.fits.some(f=>f.id===id),gen:window.__yard.eng.gen,pingComplete:window.__fullPlacementTiming.pingComplete}),placedId);
    assert.equal(report.redo.stableIdPreserved,true);
    try{await page.waitForFunction(id=>{const f=window.__yard.ship.fits.find(f=>f.id===id);return !!f&&!f.placement?.pendingGeometry;},placedId,{timeout:10000});}catch(error){if(!String(error).includes('Timeout'))throw error;}
    report.background=await page.evaluate(id=>{const Y=window.__yard,f=Y.ship.fits.find(f=>f.id===id);return{observationWindowMs:10000,parts:Y.ship.parts.length,fits:Y.ship.fits.length,placedIdPresent:!!f,status:Y.C.placementDraftStatus(Y.ship),pending:!!f?.placement.pendingGeometry,failed:!!f?.placement.validationFailed,face:f?.placement.hostSurfaceId,gen:Y.eng.gen,statsGen:Y.eng.statsGen,profileReady:!!Y.eng.profile,error:Y.eng.error||null};},placedId);
    assert.equal(report.background.parts,318);assert.equal(report.background.fits,535);assert.equal(report.background.placedIdPresent,true);assert.equal(report.background.error,null);
    if(!report.background.status.ok)assert.equal(report.background.profileReady,false);
    stage('full-native-undo-redo-and-background-observed');
    await Promise.all(captures); report.servedSourceSha256 = served;
    // Japanese startup deliberately leaves the lazy English catalogue
    // unfetched. Its local hash is still covered by the stability check.
    report.servedSourcesMatch = files.filter(f => f !== 'js/lang-en.js').every(f => served[f] === report.sourceSha256[f]);
    report.optionalUnrequestedSources = files.filter(f => served[f] == null);
    report.sourceSha256After = hashes(); report.sourceStable = JSON.stringify(report.sourceSha256) === JSON.stringify(report.sourceSha256After);
    assert.equal(report.servedSourcesMatch, true); assert.equal(report.sourceStable, true); assert.deepEqual(report.errors, []);
    report.status = 'PASS'; report.completedAt = new Date().toISOString(); save(); console.log(JSON.stringify({status: report.status, output, timing: report.placed.timing}));
  } catch (error) {
    report.status = 'ERROR'; report.error = String(error.stack || error); report.sourceSha256After = hashes();
    report.lastEngineState = await page.evaluate(() => { const Y = window.__yard, parent = Y?.ship?.parts.find(p => p.id === 1154), body = Y?.ship?._geoProxy?.placementBodies?.find(b => b.parentStructureId === 1154);
      return Y ? {gen: Y.eng.gen, adoptedGen: Y.eng.adoptedGen, statsGen: Y.eng.statsGen, error: Y.eng.error,
        parts: Y.ship.parts.length, fits: Y.ship.fits.length, proxyKeys: Object.keys(Y.ship._geoProxy || {}),
        hasParentBody: !!body, parentBodyTriangles: (body?.triangles?.length || 0) / 9,
        sourceKeyMatches: !!body && body.sourceKey === Y.C.publicJSON(parent),
        parentContextMatches: parent?._editorGeometryContext === Y.ship._editorGeometryContext} : null;
    }).catch(e => ({observationError: e.message}));
    await Promise.allSettled(captures); report.servedSourceSha256 = served; save();
    await page.screenshot({path: output.replace(/\.json$/, '.failed.jpg'), type: 'jpeg', quality: 75, timeout: 10000}).catch(() => {});
    console.error(error); process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { report.status = 'ERROR'; report.error = String(error.stack || error); save(); console.error(error); process.exitCode = 1; });
