#!/usr/bin/env node
// Current example blueprints, worker assets, connected power and production WebGL.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const url = process.argv[2] || 'http://127.0.0.1:8876';
const output = path.resolve(process.argv[3] || path.join(root, 'docs/benchmarks/ship-examples-browser.json'));
const imageRoot = path.join(root, 'docs/images');
const allKeys = ['imperial', 'venator', 'nebulonb', 'acclamator', 'mc80home', 'mc80liberty', 'munificent', 'cr90'];
const keys = process.env.SHIP_REFRESH_KEYS ? process.env.SHIP_REFRESH_KEYS.split(',') : allKeys;
const complete = JSON.stringify(keys) === JSON.stringify(allKeys);
if (!complete && !process.argv[3]) throw Error('A partial run requires an explicit temporary output path');
const sourceFiles = ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/app.js', 'js/gfx.js', 'js/engine.js', 'js/lang-en.js', 'index.html'];
const sources = () => Object.fromEntries(sourceFiles.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')]));
const close = (a, b, label) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 2e-6, label + ': ' + a + ' / ' + b);
const exactRosters = {
  imperial: {stl: 6, ion: 2, quad70Side: 2, triple40: 9, pd: 20},
  venator: {refVen: 8, twin40: 2, single200: 10, pd: 28},
  nebulonb: {twin200: 3, pd: 5},
  acclamator: {quad200: 12, pd: 12},
  mc80home: {monCalPD: 56, monCal80: 12, monCal34: 28, monCal150Ion: 4},
  mc80liberty: {monCalPD: 88, monCal200Triple: 4, monCal200: 4, monCal150Ion: 4},
  munificent: {monCal200Triple: 2, monCal150Ion: 2, monCal34: 26, monCalPD: 58},
  cr90: {single200: 2, twin200: 2, pd: 4}
};

(async () => {
  const started = Date.now(), sourceSha256 = sources();
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  try {
    fs.mkdirSync(imageRoot, {recursive: true});
    const context = await browser.newContext({viewport: {width: 1600, height: 1000}, locale: 'ja-JP'});
    const page = await context.newPage(), errors = [], screenshots = [], ships = [];
    page.on('pageerror', e => { errors.push(String(e)); process.stderr.write('Page error: ' + e + '\n'); });
    page.setDefaultTimeout(300000);
    await page.addInitScript(() => localStorage.setItem('yard.language', 'ja'));
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    await page.waitForFunction(() => window.__yard?.eng.ready, null, {timeout: 180000});
    await page.evaluate(() => {
      const Y = window.__yard;
      Y.title.hide();
      const stage = document.createElement('section');
      stage.id = 'ship-refresh-stage';
      stage.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#080d14;color:#eef4f7';
      stage.innerHTML = '<canvas style="width:100%;height:100%;display:block"></canvas><div id="ship-refresh-caption" style="position:absolute;left:20px;top:16px;padding:9px 12px;background:#101b2dee;font:18px system-ui;max-width:95%;line-height:1.6;white-space:pre-line"></div>';
      document.body.append(stage);
      window.__shipRefresh = {stage, v: new Gfx.Renderer(stage.querySelector('canvas'))};
    });
    for (const key of keys) {
      process.stderr.write('Production asset ' + key + '\n');
      const trace = await page.evaluate(async key => {
        const Y = window.__yard, C = Y.C, start = performance.now(), reply = await YardEngineClient.request('fleet', {key, trial: true});
        const asset = {key, design: reply.design, stats: reply.stats, p: reply.profile, geometry: reply.geometry};
        const s = asset.design, S = asset.stats, p = asset.p, g = asset.geometry, A = window.__shipRefresh;
        // Inspect the worker's finished serialized state: no second build or statistics pass.
        A.asset = asset; A.ship = s; A.v.loadFleet(key, g); if (key === 'cr90') A.cr90design = asset.design;
        const weapons = s.fits.filter(f => {const d=C.fitSpec(f);return d.cat === 'w' && !d.msl && ((d.tt || 0) + (d.ion || 0) > 0);});
        const mounts = new Map((p.modules || []).filter(m => m.k === 'weapon').map(m => [m.fit, m]));
        const cached = YardFleetData.designs[key]?.p;
        const count = rows => rows.reduce((o, f) => (o[f.k] = (o[f.k] || 0) + 1, o), {});
        const engines = (p.propulsion?.engines || []).map(e => ({id: e.id, machineryId: e.machineryId, reactorId: e.reactorId, valid: e.valid, available: e.available, connected: e.connected, outletAvailable: e.outletAvailable, grade: e.machineryGradeId, drive: e.driveProfileId, ratedInputW: e.ratedInputW, ratedThrustN: e.ratedThrustN, issues: e.issues}));
        const u = C.fleetUnit('ship-refresh-' + key, key, p, 0);
        u.order = {...u.order, power: 'balanced'}; u.maneuver = 1; C.heatInit(u);
        if (u.ht) { u.ht.t = 0; u.ht.last = 0; }
        if (u.fo) { u.fo.d.fill(1); u.fo.want.fill(1); }
        const ledger=prop=>{
          const q=prop.power,sum=rows=>rows.reduce((n,v)=>n+v,0),relative=(a,b)=>Math.abs(a-b)/Math.max(1,Math.abs(a),Math.abs(b)),engines=prop.engines.map(e=>{const spec=p.propulsion.engines.find(s=>s.id===e.id),allocatedW=q.granted['engine:'+e.id]||0;return{id:e.id,requestedInputW:e.requestedInputW,allocatedW,actualInputW:e.actualInputW,actualThrustN:e.actualThrustN,wattsPerNewton:spec.wattsPerNewton,allocationRelativeError:relative(e.actualInputW,allocatedW),thrustRelativeError:relative(e.actualThrustN*spec.wattsPerNewton,e.actualInputW),requestExcess:Math.max(0,e.actualInputW-e.requestedInputW)/Math.max(1,e.requestedInputW)};});
          const sourceDrawW=sum(q.sources.map(s=>s.drawW)),consumerDrawW=sum(q.consumers.map(c=>c.grantedInputW)),engineDrawW=sum(engines.map(e=>e.actualInputW));
          return{finite:[q.draw,sourceDrawW,consumerDrawW,prop.actualInputW,prop.actualThrustN,...q.sources.flatMap(s=>[s.availableW,s.drawW]),...q.consumers.map(c=>c.grantedInputW)].every(v=>Number.isFinite(v)&&v>=0),sourceDrawW,consumerDrawW,engineDrawW,drawW:q.draw,sourceConservationRelativeError:relative(sourceDrawW,q.draw),consumerConservationRelativeError:relative(consumerDrawW,q.draw),engineConservationRelativeError:relative(engineDrawW,q.engines),maximumSourceExcess:Math.max(0,...q.sources.map(s=>(s.drawW-s.availableW)/Math.max(1,s.availableW))),sources:q.sources,engines};
        };
        const scenarios=[{name:'cruise',mode:'cruise',throttle:.6,weapons:0,shields:p.grid.Ds},{name:'balancedFiring',mode:'balanced',throttle:.6,weapons:p.grid.Dw,shields:p.grid.Ds},{name:'weaponsFiring',mode:'weapons',throttle:.6,weapons:p.grid.Dw*C.POWER_MODES.weapons.weapons,shields:p.grid.Ds}].map(spec=>{
          const unit=C.fleetUnit('pressure-'+key+'-'+spec.name,key,p,0);unit.order={...unit.order,power:spec.mode};const r=C.allocateShipPower(unit,C.fleetSystems(unit),spec,0,spec.mode),prop=r.propulsion;
          return{...spec,priority:C.POWER_MODES[spec.mode].order,sourceLimitFactor:C.POWER_MODES[spec.mode].max,actualInputW:prop.actualInputW,actualThrustN:prop.actualThrustN,actualG:prop.actualAccelMps2/C.G0,engineOutputRatio:prop.outputRatio,weaponsGrantedW:r.got.weapons,shieldsGrantedW:r.got.shields,weaponsInputRatio:spec.weapons>0?r.got.weapons/spec.weapons:1,shieldInputRatio:spec.shields>0?r.got.shields/spec.shields:1,ledger:ledger(prop)};
        });
        let minEngine = 1, minWeapons = 1, minShields = 1, minThermal = 1, last,maximumConservationRelativeError=0,maximumSourceExcess=0;
        for (let i = 0; i < 60; i++) {
          const r = C.allocateShipPower(u, C.fleetSystems(u), {throttle: 1, weapons: p.grid.Dw, shields: p.grid.Ds}, .5, 'balanced');
          last = r.propulsion;
          minEngine = Math.min(minEngine, last.outputRatio);
          minWeapons = Math.min(minWeapons, p.grid.Dw > 0 ? r.got.weapons / p.grid.Dw : 1);
          minShields = Math.min(minShields, p.grid.Ds > 0 ? r.got.shields / p.grid.Ds : 1);
          const q=ledger(last);maximumConservationRelativeError=Math.max(maximumConservationRelativeError,q.sourceConservationRelativeError,q.consumerConservationRelativeError,q.engineConservationRelativeError,...q.engines.flatMap(e=>[e.allocationRelativeError,e.thrustRelativeError,e.requestExcess]));maximumSourceExcess=Math.max(maximumSourceExcess,q.maximumSourceExcess);
          C.heatTick({time: (i + 1) * .5, ev() {}}, u, .5);
          if (u.ht?.lm?.length) minThermal = Math.min(minThermal, ...u.ht.lm);
        }
        const preview = S.propulsion;
        const h = S.heat;
        return {
          key, name: s.name, elapsedMs: performance.now() - start,
          massTonnes: S.mass, dimensionsM: S.dims, weaponCounts: count(weapons), allFitCounts: count(s.fits),
          floatingFits: S.floatFits, ungroundedFits: S.ungrounded?.fits || [],
          weapons: weapons.map(f => {
            const d = C.fitSpec(f), t = g.turrets.find(t => t.id === f.id), authored = C.authoredTurretGeometry(f), m = mounts.get(f.id), charge = S.chargeInfo?.[f.id];
            return {id: f.id, kind: f.k, seat: f.p, origin: C.fitOrigin(f), normal: C.fitUp(f), mode: f.mountMode || null, zone: f.batteryZone || null, referencePlan: f.referencePlan || null, mirror: f.tw || null, oppositeFace: f.vt || null, supportRiseM: f.mountSupport?.top || 0, base: f.base || 0, assetYaw: f.assetYaw || 0, assetPitch: f.assetPitch || 0, barrels: d.barrels, muzzles: authored?.muzzles || [], productionMesh: !!t, authoredMesh: !!t?.authored, activeFleetMount: !!m, charge: charge ? {ratio: charge.ratio, blocked: !!charge.blocked, storedTT: charge.storedTT, requiredVolumeM3: charge.required, occupiedVolumeM3: charge.volume, requiredVolleyJ: ((d.tt || 0) + (d.ion || 0)) * C.TT} : null};
          }),
          engines, power: {availableW: S.power, draw: S.draw, actualCombatAccelG: S.accelG, ratedAccelG: p.propulsion.ratedAccelMps2 / C.G0, accelerationLimitG: p.propulsion.accelerationLimitMps2 / C.G0, preview: {actualInputW: preview.actualInputW, actualThrustN: preview.actualThrustN, wasteHeatW: preview.wasteHeatW, outputRatio: preview.outputRatio},previewLedger:ledger(preview),scenarios},
          fullLoadRun: {seconds: 30, dtSeconds: .5, mode:'balanced',throttle:1,requestedWeaponsW:p.grid.Dw,requestedShieldsW:p.grid.Ds,minimumEngineOutputRatio: minEngine, minimumWeaponsInputRatio: minWeapons, minimumShieldInputRatio: minShields, minimumThermalLimit: minThermal,maximumConservationRelativeError,maximumSourceExcess,lastActualG: last.actualAccelMps2 / C.G0, finalHeat: C.heatStatus(u)},
          thermal: h ? {mode: h.mode, explicitDissipatorCount: h.dis?.length, explicitDissipatorCapacityW: h.disCap, builtinCapacityW: h.builtin, skinCapacityW: h.skin, presets: h.presets} : null,
          cache: {present: !!cached, sourceSha256: YardFleetData.designs[key]?.model?.sourceSha256, profileVersion: cached?.profileVersion, expectedProfileVersion: C.FLEET_PROFILE_VERSION, massKg: cached?.propulsion?.massKg, liveMassKg: p.propulsion.massKg, ratedAccelMps2: cached?.propulsion?.ratedAccelMps2, liveRatedAccelMps2: p.propulsion.ratedAccelMps2, grid: cached?.grid ? {P: cached.grid.P, Dw: cached.grid.Dw, Ds: cached.grid.Ds, De: cached.grid.De} : null, liveGrid: {P: p.grid.P, Dw: p.grid.Dw, Ds: p.grid.Ds, De: p.grid.De}, weaponModules: cached?.modules?.filter(m => m.k === 'weapon').length, liveWeaponModules: p.modules.filter(m => m.k === 'weapon').length, engineCount: cached?.propulsion?.engines?.length, liveEngineCount: p.propulsion.engines.length},
          renderer: {bounds: g.bounds, center: g.center, turretCount: g.turrets.length, meshCount: Object.keys(g.meshes).length, workerMode: YardEngineClient.mode},
          warnings: S.warnings
        };
      }, key);
      for (const [kind, n] of Object.entries(exactRosters[key])) assert.equal(trace.weaponCounts[kind], n, key + ' ' + kind + ' count');
      assert.equal(trace.floatingFits, 0, key + ' no floating fittings');
      assert.deepEqual(trace.ungroundedFits, [], key + ' no ungrounded fittings');
      for (const w of trace.weapons) {
        assert.ok(w.productionMesh && w.authoredMesh, key + ' gun #' + w.id + ' production articulated model');
        assert.ok(w.activeFleetMount, key + ' gun #' + w.id + ' active seated fleet mount');
        assert.equal(w.muzzles.length, w.barrels, key + ' gun #' + w.id + ' muzzle count');
        if (w.charge) { assert.ok(w.charge.ratio > .999, key + ' gun #' + w.id + ' full capacitor'); assert.equal(w.charge.blocked, false, key + ' gun #' + w.id + ' clear capacitor'); }
      }
      assert.ok(trace.engines.length, key + ' physical engines');
      for (const e of trace.engines) assert.ok(e.valid && e.available && e.connected && e.outletAvailable && e.ratedInputW > 0, key + ' available engine #' + e.id);
      assert.ok(trace.power.scenarios[0].actualInputW>0&&trace.power.scenarios[0].actualThrustN>0,key+' cruise receives power');
      for(const [name,ledger]of [['combatPreview',trace.power.previewLedger],...trace.power.scenarios.map(s=>[s.name,s.ledger])]){
        assert.ok(ledger.finite,key+' '+name+' finite nonnegative ledger');
        for(const field of ['sourceConservationRelativeError','consumerConservationRelativeError','engineConservationRelativeError','maximumSourceExcess'])assert.ok(ledger[field]<1e-8,key+' '+name+' '+field);
        for(const e of ledger.engines)for(const field of ['allocationRelativeError','thrustRelativeError','requestExcess'])assert.ok(e[field]<1e-8,key+' '+name+' engine #'+e.id+' '+field);
      }
      for(const field of ['minimumEngineOutputRatio','minimumWeaponsInputRatio','minimumShieldInputRatio','minimumThermalLimit'])assert.ok(Number.isFinite(trace.fullLoadRun[field])&&trace.fullLoadRun[field]>=0&&trace.fullLoadRun[field]<=1+1e-8,key+' finite saturation '+field);
      assert.ok(trace.fullLoadRun.maximumConservationRelativeError<1e-8&&trace.fullLoadRun.maximumSourceExcess<1e-8,key+' 30-second demand conserves allocated power');
      assert.ok(trace.cache.present, key + ' fleet example cache');
      assert.ok(trace.cache.sourceSha256, key + ' generated cache source signatures');
      for(const [file,hash]of Object.entries(trace.cache.sourceSha256))assert.equal(hash,sourceSha256[file],key+' current cached '+file);
      assert.equal(trace.cache.profileVersion, trace.cache.expectedProfileVersion, key + ' current profile version');
      for (const [a, b] of [['massKg', 'liveMassKg'], ['ratedAccelMps2', 'liveRatedAccelMps2']]) close(trace.cache[a], trace.cache[b], key + ' cached ' + a);
      for (const field of ['P', 'Dw', 'Ds', 'De']) close(trace.cache.grid[field], trace.cache.liveGrid[field], key + ' cached grid ' + field);
      assert.equal(trace.cache.weaponModules, trace.cache.liveWeaponModules, key + ' cached weapons');
      assert.equal(trace.cache.engineCount, trace.cache.liveEngineCount, key + ' cached engines');
      if (['imperial', 'venator', 'nebulonb', 'acclamator', 'cr90'].includes(key)) assert.equal(trace.weapons.filter(w => w.kind.startsWith('monCal')).length, 0, key + ' conventional family');
      if (key === 'munificent') assert.ok(trace.weapons.every(w => w.kind.startsWith('monCal')), 'CIS spherical family');
      if (key === 'imperial') assert.deepEqual(trace.weapons.filter(w => w.kind === 'quad70Side').map(w => Math.sign(w.seat[2])).sort(), [-1, 1], 'ISD one quad70Side each side');
      if (key === 'venator') {
        const trench = trace.weapons.filter(w => w.kind === 'single200');
        assert.ok(trench.every(w => /trench/.test(w.zone)), 'Venator singles inside trench banks');
        assert.equal(trench.filter(w => w.seat[2] > 0).length, 5, 'Venator five singles starboard');
        assert.equal(trench.filter(w => w.seat[2] < 0).length, 5, 'Venator five singles port');
      }
      if (key.startsWith('mc80')) {
        const balls = trace.weapons.filter(w => w.kind.startsWith('monCal'));
        assert.equal(balls.length, 100, key + ' annotated 100 ball turrets');
        assert.equal(balls.filter(w => w.normal[1] > 0).length, 50, key + ' 50 dorsal');
        assert.equal(balls.filter(w => w.normal[1] < 0).length, 50, key + ' 50 ventral');
        assert.ok(balls.every(w => w.referencePlan?.length === 2 && w.oppositeFace), key + ' prior annotated stations and opposite-face links');
      }
      trace.draws = [];
      const views = key.startsWith('mc80') ? ['dorsal', 'ventral'] : ['dorsal'];
      for (const view of views) {
        const draw = await page.evaluate(({key, view, counts, pressure}) => {
          const A = window.__shipRefresh, C = window.__yard.C, v = A.v, g = A.asset.geometry, ventral = view === 'ventral';
          for (const e of A.stage.querySelectorAll('[data-mount-marker]')) e.remove();
          v.cam.ortho = true; v.cam.th = -Math.PI / 2; v.cam.ph = .28; v.cam.target = g.center.slice();
          v.cam.r = (g.bounds[3] - g.bounds[0]) * 1.13 / (2 * Math.tan(v.cam.fov / 2) * (1600 / 1000));
          v.draw({fleet: [{key, pos: g.center, rot: ventral ? [1,0,0,0,-1,0,0,0,-1] : [1,0,0,0,1,0,0,0,1], glow: 0}], noStars: true, lod: false});
          const cruise=pressure.find(s=>s.name==='cruise'),firing=pressure.find(s=>s.name==='weaponsFiring'),pct=n=>(n*100).toFixed(1)+'%';
          A.stage.querySelector('#ship-refresh-caption').textContent = key + ' · ' + view + ' · production meshes\n' + Object.entries(counts).map(([k,n]) => k + ' × ' + n).join('   ')+'\nCruise: '+cruise.actualG.toFixed(1)+' G · firing / weapon priority: '+firing.actualG.toFixed(1)+' G · gun input '+pct(firing.weaponsInputRatio)+' · shields '+pct(firing.shieldInputRatio);
          const pixels = new Uint8Array(v.canvas.width * v.canvas.height * 4);
          v.gl.readPixels(0, 0, v.canvas.width, v.canvas.height, v.gl.RGBA, v.gl.UNSIGNED_BYTE, pixels);
          let litPixels = 0; for (let i = 0; i < pixels.length; i += 4) if (Math.max(pixels[i], pixels[i+1], pixels[i+2]) > 70) litPixels++;
          const points = []; for (const x of [g.bounds[0],g.bounds[3]]) for (const y of [g.bounds[1],g.bounds[4]]) for (const z of [g.bounds[2],g.bounds[5]]) points.push(v.project([x, ventral ? 2*g.center[1]-y : y, ventral ? 2*g.center[2]-z : z]));
          return {view, webglError: v.gl.getError(), litPixels, totalPixels: v.canvas.width * v.canvas.height, projectedBounds: {left: Math.min(...points.map(p=>p[0])), right: Math.max(...points.map(p=>p[0])), top: Math.min(...points.map(p=>p[1])), bottom: Math.max(...points.map(p=>p[1]))}};
        }, {key, view, counts: trace.weaponCounts, pressure:trace.power.scenarios});
        assert.equal(draw.webglError, 0, key + ' WebGL');
        assert.ok(draw.litPixels > 10000, key + ' visible geometry');
        assert.ok(draw.projectedBounds.left > 5 && draw.projectedBounds.right < 1595 && draw.projectedBounds.top > 5 && draw.projectedBounds.bottom < 995, key + ' complete bounds in frame');
        const file = 'ship-refresh-' + key + '-' + view + '.png';
        await page.locator('#ship-refresh-stage').screenshot({path: path.join(imageRoot, file)});
        screenshots.push(file); trace.draws.push(draw);
        draw.stationMarkers = await page.evaluate(({view, weapons}) => {
          const A=window.__shipRefresh,g=A.asset.geometry,ventral=view==='ventral',colours=['#ff6d7d','#ffd16b','#74dce2','#d3a0ff','#9ce47a','#ffad71'],kinds=[...new Set(weapons.map(w=>w.kind))];
          let count=0;
          for(const w of weapons){if(ventral?w.normal[1]>.5:w.normal[1]<-.5)continue;const p=w.origin,q=A.v.project([p[0],ventral?2*g.center[1]-p[1]:p[1],ventral?2*g.center[2]-p[2]:p[2]]),e=document.createElement('span');e.dataset.mountMarker=w.id;e.title=w.kind+' #'+w.id;e.style.cssText='position:absolute;width:8px;height:8px;border:1.5px solid '+colours[kinds.indexOf(w.kind)%colours.length]+';border-radius:50%;transform:translate(-50%,-50%);pointer-events:none';e.style.left=q[0]+'px';e.style.top=q[1]+'px';A.stage.append(e);count++;}
          const legend=document.createElement('div');legend.dataset.mountMarker='legend';legend.style.cssText='position:absolute;left:20px;bottom:20px;padding:9px 12px;background:#101b2dee;font:16px system-ui';legend.innerHTML=kinds.map((k,i)=>'<span style="color:'+colours[i%colours.length]+';margin-right:18px">○ '+k+'</span>').join('');A.stage.append(legend);return count;
        },{view,weapons:trace.weapons});
        const stationFile='ship-refresh-'+key+'-'+view+'-stations.png';await page.locator('#ship-refresh-stage').screenshot({path:path.join(imageRoot,stationFile)});screenshots.push(stationFile);
      }
      ships.push(trace);
      process.stderr.write('Verified '+key+' · '+trace.weapons.length+' guns · '+trace.engines.length+' engines · '+Math.round(trace.elapsedMs)+' ms\n');
      // Do not keep eight heavy assets uploaded to two renderers at once.
      await page.evaluate(() => {
        const A = window.__shipRefresh;
        A.v.gl.getExtension('WEBGL_lose_context')?.loseContext();
        A.stage.querySelector('canvas').remove(); const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;display:block'; A.stage.prepend(canvas); A.v = new Gfx.Renderer(canvas);
        delete A.asset; delete A.ship;
      });
    }
    const editor = keys.includes('cr90') ? await (async () => {
      process.stderr.write('Native CR90 engine/performance panel\n');
      await page.evaluate(() => {const Y = window.__yard, A = window.__shipRefresh; A.v.gl.getExtension('WEBGL_lose_context')?.loseContext(); A.stage.remove(); Y.setShip(Y.C.deserialize(A.cr90design)); Y.st.tab = 'systems'; Y.st.sel = null; Y.st.dockCollapsed = false; document.querySelector('#dock').classList.remove('collapsed'); Y.renderPanel();});
      await page.waitForFunction(() => { const Y = window.__yard; return Y.ship.reference === 'cr90' && Y.stats && Y.eng.geoGen >= Y.eng.gen && Y.eng.statsGen >= Y.eng.gen && Y.eng.adoptedGen >= Y.eng.gen; }, null, {timeout: 300000});
      await page.locator('#propulsion-preview').waitFor({state: 'attached'});
      await page.locator('#propulsion-preview').evaluate(el => {for (let e=el;e;e=e.parentElement) if(e.tagName==='DETAILS') e.open=true;});
      const previewText = await page.locator('#propulsion-preview').innerText(); assert.doesNotMatch(previewText, /NaN|Infinity|undefined/);
      await page.evaluate(() => {const Y=window.__yard,v=Y.view();v.cam.ortho=true;v.cam.target=[0,0,0];v.cam.th=-1.08;v.cam.ph=.75;v.cam.r=240;Y.draw();});
      let file='ship-refresh-cr90-performance.png'; await page.screenshot({path:path.join(imageRoot,file)}); screenshots.push(file);
      const state=await page.evaluate(()=>{const Y=window.__yard,C=Y.C,e=Y.ship.parts.find(p=>p.k==='engine'),p=C.propulsionPreview(Y.ship,Y.stats,'combat');Y.st.tab='edit';Y.st.sel={list:'parts',id:e.id};Y.st.multi.parts.clear();Y.st.multi.parts.add(e.id);Y.renderPanel();return{engineId:e.id,spec:C.resolveEngineSpec(e,Y.ship),performance:{massTonnes:Y.stats.mass,actualCombatAccelG:Y.stats.accelG,powerW:Y.stats.power},preview:{actualInputW:p.actualInputW,actualThrustN:p.actualThrustN,wasteHeatW:p.wasteHeatW},generation:{design:Y.eng.gen,geometry:Y.eng.geoGen,statistics:Y.eng.statsGen},workerMode:YardEngineClient.mode};});
      const physical=page.locator('#engine-spec-editor');await physical.waitFor({state:'attached'});await physical.evaluate(el=>{for(let e=el;e;e=e.parentElement)if(e.tagName==='DETAILS')e.open=true;});await physical.scrollIntoViewIfNeeded();state.engineEditorText=await physical.innerText();assert.doesNotMatch(state.engineEditorText,/NaN|Infinity|undefined/);assert.ok(state.spec.valid&&state.spec.ratedInputW>0);
      file='ship-refresh-cr90-engine.png';await page.screenshot({path:path.join(imageRoot,file)});screenshots.push(file);state.previewText=previewText;
      const built=ships.find(s=>s.key==='cr90');close(state.performance.massTonnes,built.massTonnes,'native CR90 current mass');close(state.performance.actualCombatAccelG,built.power.actualCombatAccelG,'native CR90 current acceleration');for(const field of ['actualInputW','actualThrustN','wasteHeatW'])close(state.preview[field],built.power.preview[field],'native/worker CR90 '+field);return state;
    })() : null;
    assert.deepEqual(errors, []);
    const sourceSha256After = sources(); assert.deepEqual(sourceSha256After, sourceSha256, 'sources changed during verification; rerun after the final source/cache freeze');
    const result = {schemaVersion:1,status:complete?'PASS':'PARTIAL',date:new Date().toISOString(),browser:'Chromium with software WebGL',url,elapsedMs:Date.now()-started,sourceSha256,sourceSha256After,ships,editor,errors,screenshots,scope:{verified:['eight current worker-built examples with production meshes','four requested exact armament rosters and family choice','every gun represented by an authored articulated mesh and active fleet mount','weapon positions, normals, muzzle coordinates and capacitor capacity','MC80 prior annotated 50 dorsal/50 ventral stations and links','selected physical engine editor and native performance panel','cruise and firing priority demand with source/consumer conservation and allocated watts-to-thrust parity','30 seconds of simultaneous rated demand from cold, recording electrical and thermal limits','current cached fleet mass, engine ratings, grid demand and module counts'],designPolicy:'Electrical saturation and thermal warnings are recorded; simultaneous unrestricted maximum engine/gun/shield output is not a design target',notVerified:['physical mobile/GPU hardware','long combat balance','thermal behaviour beyond the recorded interval']}};
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    process.stdout.write(JSON.stringify({status:result.status,elapsedMs:result.elapsedMs,ships:ships.map(s=>s.key),screenshots})+'\n');
    await context.close();
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
