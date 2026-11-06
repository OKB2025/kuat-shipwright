#!/usr/bin/env node
// Current example blueprints, worker assets, connected power and production WebGL.
// Optional: node scripts/browser-ship-examples.cjs URL OUTPUT --blueprints /tmp/prepared
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const positional=[];let blueprintRoot=null,resumePath=null;
for(let i=2;i<process.argv.length;i++){const arg=process.argv[i];if(arg==='--blueprints'||arg==='--resume'){if(!process.argv[i+1]||process.argv[i+1].startsWith('--'))throw Error(arg+' requires a path');const value=path.resolve(process.argv[++i]);if(arg==='--blueprints')blueprintRoot=value;else resumePath=value;}else if(arg.startsWith('--blueprints='))blueprintRoot=path.resolve(arg.slice('--blueprints='.length));else if(arg.startsWith('--resume='))resumePath=path.resolve(arg.slice('--resume='.length));else if(arg.startsWith('--'))throw Error('Unknown option: '+arg);else positional.push(arg);}
const url = positional[0] || 'http://127.0.0.1:8876';
const output = path.resolve(positional[1] || path.join(root, 'docs/benchmarks/ship-examples-browser.json'));
const imageRoot = path.join(root, 'docs/images');
const allKeys = ['imperial', 'venator', 'nebulonb', 'acclamator', 'mandator2', 'mc80home', 'mc80liberty', 'munificent', 'recusant', 'cr90'];
const keys = process.env.SHIP_REFRESH_KEYS ? process.env.SHIP_REFRESH_KEYS.split(',') : allKeys;
const complete = JSON.stringify(keys) === JSON.stringify(allKeys);
if (!complete && !positional[1]) throw Error('A partial run requires an explicit temporary output path');
const sourceFiles = ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/app.js', 'js/gfx.js', 'js/engine.js', 'js/lang-en.js', 'index.html'];
const sources = () => Object.fromEntries(sourceFiles.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex')]));
const close = (a, b, label) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1, Math.abs(b)) * 2e-6, label + ': ' + a + ' / ' + b);
const stable=value=>JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
const blueprintHash=value=>crypto.createHash('sha256').update(stable(value)).digest('hex');
const fileHash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function traceImages(trace){const files=trace.draws.flatMap(d=>['ship-refresh-'+trace.key+'-'+d.view+'.png','ship-refresh-'+trace.key+'-'+d.view+'-stations.png']);if(trace.nativeDetail)files.push('ship-refresh-'+trace.key+'-native-detail.png');return files;}
function validateDraws(trace){
 const expected=trace.key.startsWith('mc80')||['munificent','recusant'].includes(trace.key)?['dorsal','ventral']:['dorsal'];
 assert.deepEqual(trace.draws?.map(d=>d.view),expected,trace.key+' completed production views');
 for(const d of trace.draws){assert.equal(d.webglError,0,trace.key+' checkpoint WebGL');assert.ok(d.litPixels>10000,trace.key+' checkpoint visible geometry');const b=d.projectedBounds;assert.ok(b.left>5&&b.right<1595&&b.top>5&&b.bottom<995,trace.key+' checkpoint complete bounds');assert.ok(Number.isInteger(d.stationMarkers)&&d.stationMarkers>0,trace.key+' checkpoint station overlay');}
 if(['munificent','recusant'].includes(trace.key)){const d=trace.nativeDetail;assert.ok(d,trace.key+' completed native detail');assert.equal(d.webglError,0,trace.key+' checkpoint native detail WebGL');const b=d.projectedBounds;assert.ok(b.left>5&&b.right<1595&&b.top>5&&b.bottom<995,trace.key+' checkpoint native detail bounds');}
}
const exactRosters = {
  imperial: {stl: 6, ion: 2, quad70Side: 2, triple40: 9, pd: 20},
  venator: {refVen: 8, twin40: 2, single200: 10, pd: 28},
  nebulonb: {twin200: 3, pd: 5},
  acclamator: {quad200: 12, pd: 12},
  mandator2: {utl: 203, stl: 44, ion: 28, pd: 250},
  mc80home: {monCalPD: 56, monCal80: 12, monCal34: 28, monCal150Ion: 4},
  mc80liberty: {monCalPD: 88, monCal200Triple: 4, monCal200: 4, monCal150Ion: 4},
  munificent: {munBow: 1, munTwin: 18, pd: 58},
  recusant: {recProw: 1, recTwin: 1, recKeel: 1, refVen: 4, pd: 30, monCalPD: 10, monCal34: 26},
  cr90: {single200: 2, twin200: 2, pd: 4}
};

function validateTrace(trace,key,sourceSha256){
if(trace.input.savedReload){
  const r=trace.input.savedReload;
  for(const d of [r.massKg,r.ratedAccelMps2,...Object.values(r.grid||{})])assert.ok(Number.isFinite(d.relative)&&Math.abs(d.relative)<=1e-4,key+' saved engineering difference is small');
  assert.ok(r.partIdsPreserved&&r.fitIdsPreserved,key+' saved reload preserves every hardware ID');
  assert.equal(r.floatingFits,0,key+' saved reload seats every fitting');
  assert.deepEqual(r.ungroundedFits,[],key+' saved reload has no ungrounded fitting');
  assert.deepEqual(r.incompleteCapacitors,[],key+' saved reload keeps physical firing charge');
  assert.equal(r.weaponModules,trace.cache.weaponModules,key+' saved reload keeps weapon modules');
  assert.equal(r.engineCount,trace.cache.engineCount,key+' saved reload keeps engines');
  if(r.factoryFallback)process.stderr.write('Factory verification '+key+' after measured saved-load mass delta '+r.massKg.absolute+' kg ('+r.massKg.relative+' relative)\n');
}
for (const [kind, n] of Object.entries(exactRosters[key])) assert.equal(trace.weaponCounts[kind], n, key + ' ' + kind + ' count');
assert.equal(trace.floatingFits, 0, key + ' no floating fittings');
assert.deepEqual(trace.ungroundedFits, [], key + ' no ungrounded fittings');
assert.equal(trace.profile.catalogOnly,false,key+' actual full worker profile');
if(trace.profile.surfaceExpected)assert.ok(trace.profile.surfaceAvailable&&trace.profile.surfaceMountCount>=trace.weapons.length,key+' complete worker surface mounts');
for (const w of trace.weapons) {
  assert.ok(w.productionMesh && w.authoredMesh, key + ' gun #' + w.id + ' production articulated model');
  assert.ok(w.activeFleetMount, key + ' gun #' + w.id + ' active seated fleet mount');
  if(trace.profile.surfaceAvailable)assert.ok(w.fullSurfaceMount,key+' gun #'+w.id+' in full worker surface profile');
  assert.equal(w.muzzles.length, w.barrels, key + ' gun #' + w.id + ' muzzle count');
  if (w.charge) { assert.ok(w.charge.ratio > .999, key + ' gun #' + w.id + ' full capacitor'); assert.equal(w.charge.blocked, false, key + ' gun #' + w.id + ' clear capacitor'); }
}
assert.ok(trace.engines.length, key + ' physical engines');
assert.ok(trace.thermal,key+' explicit thermal network');assert.equal(trace.thermal.mode,'strict',key+' strict heat mode');assert.equal(trace.thermal.builtinCapacityW,0,key+' no integral cooling capacity');assert.equal(trace.thermal.legacyCapacityW,0,key+' no legacy cooling capacity');assert.deepEqual(trace.thermal.forbiddenDesignSinks,[],key+' no implicit design sinks');assert.deepEqual(trace.thermal.forbiddenFleetSinks,[],key+' no implicit fleet sinks');
assert.ok(Number.isFinite(trace.crew.habitationRatio)&&trace.crew.habitationRatio>=trace.crew.fleetMinimumRatio,key+' crew usable by fleet');close(trace.crew.profileNeed,trace.crew.need,key+' current profile crew requirement');close(trace.crew.profileMax,trace.crew.profileNeed,key+' full required crew can embark');
for (const e of trace.engines) assert.ok(e.valid && e.available && e.connected && e.outletAvailable && e.ratedInputW > 0 && e.grade!=='legacy-refit', key + ' available engine #' + e.id);
assert.ok(trace.power.scenarios[0].actualInputW>0&&trace.power.scenarios[0].actualThrustN>0,key+' cruise receives power');
for(const [name,ledger]of [['combatPreview',trace.power.previewLedger],...trace.power.scenarios.map(s=>[s.name,s.ledger])]){
  assert.ok(ledger.finite,key+' '+name+' finite nonnegative ledger');
  for(const field of ['sourceConservationRelativeError','consumerConservationRelativeError','engineConservationRelativeError','maximumSourceExcess'])assert.ok(ledger[field]<1e-8,key+' '+name+' '+field);
  for(const e of ledger.engines)for(const field of ['allocationRelativeError','thrustRelativeError','requestExcess'])assert.ok(e[field]<1e-8,key+' '+name+' engine #'+e.id+' '+field);
}
for(const field of ['minimumEngineOutputRatio','minimumWeaponsInputRatio','minimumShieldInputRatio','minimumThermalLimit'])assert.ok(Number.isFinite(trace.fullLoadRun[field])&&trace.fullLoadRun[field]>=0&&trace.fullLoadRun[field]<=1+1e-8,key+' finite saturation '+field);
assert.ok(trace.fullLoadRun.maximumConservationRelativeError<1e-8&&trace.fullLoadRun.maximumSourceExcess<1e-8,key+' 30-second demand conserves allocated power');
assert.ok(trace.cache.present, key + ' fleet example cache');
assert.equal(trace.cache.catalogOnly,true,key+' bounded catalog descriptor');
assert.ok(trace.cache.sourceSha256, key + ' generated cache source signatures');
for(const [file,hash]of Object.entries(trace.cache.sourceSha256))assert.equal(hash,sourceSha256[file],key+' current cached '+file);
assert.equal(trace.cache.profileVersion, trace.cache.expectedProfileVersion, key + ' current profile version');
for (const [a, b] of [['massKg', 'liveMassKg'], ['ratedAccelMps2', 'liveRatedAccelMps2']]) close(trace.cache[a], trace.cache[b], key + ' cached ' + a);
for (const field of ['P', 'Dw', 'Ds', 'De']) close(trace.cache.grid[field], trace.cache.liveGrid[field], key + ' cached grid ' + field);
assert.equal(trace.cache.weaponModules, trace.cache.liveWeaponModules, key + ' cached weapons');
assert.equal(trace.cache.engineCount, trace.cache.liveEngineCount, key + ' cached engines');close(trace.cache.crewNeed,trace.crew.profileNeed,key+' cached required crew');close(trace.cache.crewMax,trace.crew.profileMax,key+' cached full crew capacity');
if (['imperial', 'venator', 'nebulonb', 'acclamator', 'mandator2', 'cr90'].includes(key)) assert.equal(trace.weapons.filter(w => w.kind.startsWith('monCal')).length, 0, key + ' conventional family');
if (key === 'mandator2') {
  close(trace.specifications.powerW,7.7e26,'Mandator physical output');
  close(trace.specifications.shieldCapacityJ,7.7e27,'Mandator physical shield storage');
  close(trace.specifications.shieldDissipationW,184034,'Mandator literal W dissipation');
  close(trace.specifications.profileShieldDissipationW,184034,'Mandator runtime dissipation');
  close(trace.specifications.allGunVolleyTT,317520.00005,'Mandator 317520 TT main/ion salvo plus 100kt PD');
  close(trace.specifications.profileAllGunVolleyTT,317520.00005,'Mandator runtime nominal all-gun salvo');
  assert.equal(trace.weapons.length,525,'Mandator525 physical gun mounts');
}
if (key === 'munificent') {
  assert.ok(trace.weapons.every(w => ['munBow','munTwin','pd'].includes(w.kind)), 'Munificent curated native models');
  const bow=trace.weapons.find(w=>w.kind==='munBow');assert.ok(bow.fixedMount&&bow.normal[1]<0,'Munificent fixed bow gun mounted below the hull');assert.equal(bow.boltTT,2500,'Munificent bow output per barrel');assert.equal(bow.cycleSeconds,1.6,'Munificent native bow cadence');assert.equal(bow.modelScale,1,'Munificent native bow scale');assert.deepEqual(bow.fireArcs,[1,0,0,0,0,0],'Munificent fixed bow gun bears forward');
  for(const w of trace.weapons.filter(w=>w.kind==='munTwin')){assert.ok(w.normal[1]<0&&Math.abs(w.barrelDirection[2])>.99&&Math.sign(w.barrelDirection[2])===Math.sign(w.seat[2]),'Munificent ventral twins point outboard');assert.equal(w.boltTT,.3,'Munificent 300 GT per barrel');assert.equal(w.cycleSeconds,.2,'Munificent rapid-fire cadence');assert.equal(w.modelScale,1,'Munificent native twin scale');}
}
if (key === 'recusant') {
  assert.ok(trace.weapons.every(w=>Object.hasOwn(exactRosters.recusant,w.kind)),'Recusant native bow guns and retained flank batteries');
  for(const [kind,point,fixed]of [['recProw',[906.9,14.29,0],true],['recTwin',[1071.4,52.86,0],false],['recKeel',[1095.7,60.32,0],true]]){
    const w=trace.weapons.find(w=>w.kind===kind);assert.equal(w.cycleSeconds,15,kind+' native cadence');assert.equal(w.modelScale,1,kind+' native scale');assert.equal(w.fixedMount,fixed,kind+' mounting');assert.ok(w.normal[1]<0&&w.barrelDirection[0]>.99,kind+' ventral bow orientation');w.seat.forEach((v,i)=>assert.ok(Math.abs(v-point[i])<.02,kind+' measured seat '+i));if(fixed)assert.deepEqual(w.fireArcs,[1,0,0,0,0,0],kind+' fixed bow firing sector');
  }
  const ports=trace.weapons.filter(w=>w.kind==='monCal34'&&w.zone?.startsWith('flank-ball'));assert.equal(ports.length,16,'Recusant marked flank ball stations');
  assert.equal(ports.filter(w=>w.seat[2]>0).length,8,'Recusant eight marked balls starboard');assert.equal(ports.filter(w=>w.seat[2]<0).length,8,'Recusant eight marked balls port');
}
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
}

(async () => {
  const started = Date.now(), sourceSha256 = sources(), resume=resumePath?JSON.parse(fs.readFileSync(resumePath,'utf8')):null;
  if(resume){
    assert.equal(resume.schemaVersion,1,'checkpoint schema');assert.equal(resume.status,'CHECKPOINT','only completed asset checkpoints may resume');
    assert.deepEqual(resume.keys,keys,'checkpoint exact requested keys');assert.deepEqual(resume.sourceSha256,sourceSha256,'checkpoint current guarded sources');assert.deepEqual(resume.sourceSha256After,sourceSha256,'checkpoint sources stable through completed assets');assert.deepEqual(resume.errors,[],'checkpoint has no browser errors');
    assert.deepEqual(resume.ships.map(s=>s.key),keys.slice(0,resume.ships.length),'checkpoint completed asset prefix');
    const expectedImages=resume.ships.flatMap(traceImages);assert.deepEqual(resume.screenshots,expectedImages,'checkpoint exact completed image set');assert.deepEqual(Object.keys(resume.imageSha256).sort(),expectedImages.slice().sort(),'checkpoint exact image hash set');
    for(const trace of resume.ships){validateTrace(trace,trace.key,sourceSha256);validateDraws(trace);}
    for(const file of expectedImages){assert.equal(path.basename(file),file,'checkpoint image filename');assert.match(file,/^ship-refresh-.+\.png$/,'checkpoint image name');assert.equal(fileHash(path.join(imageRoot,file)),resume.imageSha256[file],'checkpoint unchanged image '+file);}
  }
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
  try {
    fs.mkdirSync(imageRoot, {recursive: true});
    const context = await browser.newContext({viewport: {width: 1600, height: 1000}, locale: 'ja-JP'});
    const page = await context.newPage(), errors = [], screenshots = [], ships = [];
    const resumedKeys=resume?.ships.map(s=>s.key)||[],resumeProvenance=resume?{checkpoint:resumePath,checkpointSha256:fileHash(resumePath),completedKeys:resumedKeys,imageSha256:resume.imageSha256}:null;
    const sessionRecord=status=>({startedAt:new Date(started).toISOString(),elapsedMs:Date.now()-started,status,completedKeys:ships.map(s=>s.key).filter(k=>!resumedKeys.includes(k)),sourceSha256,sourceSha256After:sources()});
    const checkpoint=()=>{const sourceSha256After=sources();assert.deepEqual(sourceSha256After,sourceSha256,'sources changed before completed-asset checkpoint');const q={schemaVersion:1,status:'CHECKPOINT',keys,sourceSha256,sourceSha256After,ships,screenshots,imageSha256:Object.fromEntries(screenshots.map(f=>[f,fileHash(path.join(imageRoot,f))])),errors,verificationSessions:[...(resume?.verificationSessions||[]),sessionRecord('CHECKPOINT')]};fs.writeFileSync(output+'.checkpoint.json',JSON.stringify(q,null,2)+'\n');};
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
      const prepared=blueprintRoot?JSON.parse(fs.readFileSync(path.join(blueprintRoot,key+'.json'),'utf8')):null,preparedSha256=prepared?blueprintHash(prepared):null;
      const expectedBlueprintSha256=await page.evaluate(key=>YardFleetData.designs[key]?.model?.blueprintSha256,key);
      if(prepared)assert.equal(preparedSha256,expectedBlueprintSha256,key+' prepared canonical blueprint matches current generated entry');
      const prior=resume?.ships.find(s=>s.key===key);
      if(prior){assert.equal(prior.input.canonicalBlueprintSha256,preparedSha256,key+' checkpoint input blueprint');assert.equal(prior.input.expectedBlueprintSha256,expectedBlueprintSha256,key+' checkpoint current catalogue blueprint');ships.push(prior);screenshots.push(...traceImages(prior));process.stderr.write('Resumed verified production asset '+key+' from unchanged-source checkpoint\n');continue;}
      const trace = await page.evaluate(async ({key,prepared,preparedSha256,expectedBlueprintSha256}) => {
        const Y = window.__yard, C = Y.C, start = performance.now();
        let reply = await YardEngineClient.request('fleet', prepared?{design:prepared,trial:true}:{key,trial:true});
        const descriptor=YardFleetData.designs[key]?.p,loaded=reply.profile,delta=(actual,expected)=>({actual,expected,absolute:actual-expected,relative:(actual-expected)/Math.max(1,Math.abs(expected))});
        const savedReload=prepared?{massKg:delta(loaded.propulsion.massKg,descriptor.propulsion.massKg),ratedAccelMps2:delta(loaded.propulsion.ratedAccelMps2,descriptor.propulsion.ratedAccelMps2),partCount:reply.design.parts.length,fitCount:reply.design.fits.length,partIdsPreserved:JSON.stringify(prepared.parts.map(p=>p.id).sort((a,b)=>a-b))===JSON.stringify(reply.design.parts.map(p=>p.id).sort((a,b)=>a-b)),fitIdsPreserved:JSON.stringify(prepared.fits.map(f=>f.id).sort((a,b)=>a-b))===JSON.stringify(reply.design.fits.map(f=>f.id).sort((a,b)=>a-b)),factoryFallback:false}:null;
        if(savedReload)Object.assign(savedReload,{grid:Object.fromEntries(['P','Dw','Ds','De'].map(k=>[k,delta(loaded.grid[k],descriptor.grid[k])])),floatingFits:reply.stats.floatFits,ungroundedFits:reply.stats.ungrounded?.fits||[],incompleteCapacitors:Object.entries(reply.stats.chargeInfo||{}).filter(([,c])=>c.blocked||c.ratio<=.999).map(([id])=>id),weaponModules:loaded.modules.filter(m=>m.k==='weapon').length,engineCount:loaded.propulsion.engines.length});
        const savedDifferences=savedReload?[savedReload.massKg,savedReload.ratedAccelMps2,...Object.values(savedReload.grid)]:[];
        if(savedDifferences.some(d=>!Number.isFinite(d.relative)||Math.abs(d.relative)>1e-4))throw Error(key+' saved engineering difference exceeds small derived-geometry bound');
        if(savedDifferences.some(d=>Math.abs(d.relative)>2e-6)){
          // Stock catalogue figures describe the factory build. A saved reload
          // has its own normalized geometry; retain its measured difference
          // and independently rebuild the factory before checking the cache.
          savedReload.factoryFallback=true;
          reply=await YardEngineClient.request('fleet',{key,trial:true});
        }
        const asset = {key, design: reply.design, stats: reply.stats, p: reply.profile, geometry: reply.geometry};
        const s = asset.design, S = asset.stats, p = asset.p, g = asset.geometry, A = window.__shipRefresh;
        const annotationById=new Map((prepared?.fits||[]).filter(f=>f.referencePlan).map(f=>[f.id,f.referencePlan]));
        // Inspect the worker's finished serialized state: no second build or statistics pass.
        A.asset = asset; A.ship = s; A.v.loadFleet(key, g); if (key === 'cr90') A.cr90design = asset.design;
        const weapons = s.fits.filter(f => {const d=C.fitSpec(f);return d.cat === 'w' && !d.msl && ((d.tt || 0) + (d.ion || 0) > 0);});
        const mounts = new Map((p.modules || []).filter(m => m.k === 'weapon').map(m => [m.fit, m]));
        const surfaceMounts=new Set((p.surface?.mounts||[]).map(m=>m.id));
        const cached = YardFleetData.designs[key]?.p;
        const count = rows => rows.reduce((o, f) => (o[f.k] = (o[f.k] || 0) + 1, o), {});
        const engines = (p.propulsion?.engines || []).map(e => ({id: e.id, machineryId: e.machineryId, reactorId: e.reactorId, valid: e.valid, available: e.available, connected: e.connected, outletAvailable: e.outletAvailable, grade: e.machineryGradeId, drive: e.driveProfileId,legacyCoolingInputW:e.legacyCoolingInputW||0, ratedInputW: e.ratedInputW, ratedThrustN: e.ratedThrustN, issues: e.issues}));
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
          key, name: s.name, elapsedMs: performance.now() - start,input:{mode:prepared?(savedReload.factoryFallback?'factory-build-after-measured-saved-reload':'prepared-saved-blueprint'):'factory-build',canonicalBlueprintSha256:preparedSha256,expectedBlueprintSha256,referenceAnnotationsRetained:annotationById.size,workerSource:reply.src,savedReload},
          profile:{catalogOnly:p.catalogOnly===true,surfaceExpected:s.surfaces?.version===C.SURFACE_VERSION,surfaceAvailable:!!p.surface,surfaceMountCount:surfaceMounts.size},
          massTonnes: S.mass, dimensionsM: S.dims, specifications:{powerW:S.power,shieldCapacityJ:S.shieldCapacity,shieldDissipationW:S.shieldDissipationW??null,allGunVolleyTT:S.allGunVolleyTT??null,profileAllGunVolleyTT:p.allGunVolleyTT??null,profileShieldDissipationW:p.shieldDissipationW??null}, weaponCounts: count(weapons), allFitCounts: count(s.fits),
          crew:{need:S.crew,aboard:S.crewAboard,capacity:S.crewCapacity,habitationRatio:S.habit,fleetMinimumRatio:C.FLEET_MIN_CREW,profileNeed:p.crewNeed,profileMax:p.crewMax},
          floatingFits: S.floatFits, ungroundedFits: S.ungrounded?.fits || [],
          weapons: weapons.map(f => {
            const d = C.fitSpec(f), t = g.turrets.find(t => t.id === f.id), authored = C.authoredTurretGeometry(f), m = mounts.get(f.id), charge = S.chargeInfo?.[f.id];
            return {id: f.id, kind: f.k, seat: f.p, origin: C.fitOrigin(f), normal: C.fitUp(f), mode: f.mountMode || null, zone: f.batteryZone || null, referencePlan: f.referencePlan || annotationById.get(f.id)||null, mirror: f.tw || null, oppositeFace: f.vt || null, supportRiseM: f.mountSupport?.top || 0, base: f.base || 0, assetYaw: f.assetYaw || 0, assetPitch: f.assetPitch || 0, fixedMount:!!d.fixedMount,fireArcs:S.fitInfo?.[f.id]||null,barrelDirection:authored?.fw||null,cycleSeconds:d.cycle,boltTT:d.boltTT,modelScale:C.weaponModelScale(f),barrels: d.barrels, muzzles: authored?.muzzles || [], productionMesh: !!t, authoredMesh: !!t?.authored, activeFleetMount: !!m,fullSurfaceMount:surfaceMounts.has(f.id),charge: charge ? {ratio: charge.ratio, blocked: !!charge.blocked, storedTT: charge.storedTT, requiredVolumeM3: charge.required, occupiedVolumeM3: charge.volume, requiredVolleyJ: ((d.tt || 0) + (d.ion || 0)) * C.TT} : null};
          }),
          engines, power: {availableW: S.power, draw: S.draw, actualCombatAccelG: S.accelG, ratedAccelG: p.propulsion.ratedAccelMps2 / C.G0, accelerationLimitG: p.propulsion.accelerationLimitMps2 / C.G0, preview: {actualInputW: preview.actualInputW, actualThrustN: preview.actualThrustN, wasteHeatW: preview.wasteHeatW, outputRatio: preview.outputRatio},previewLedger:ledger(preview),scenarios},
          fullLoadRun: {seconds: 30, dtSeconds: .5, mode:'balanced',throttle:1,requestedWeaponsW:p.grid.Dw,requestedShieldsW:p.grid.Ds,minimumEngineOutputRatio: minEngine, minimumWeaponsInputRatio: minWeapons, minimumShieldInputRatio: minShields, minimumThermalLimit: minThermal,maximumConservationRelativeError,maximumSourceExcess,lastActualG: last.actualAccelMps2 / C.G0, finalHeat: C.heatStatus(u)},
          thermal: h ? {mode: h.mode, explicitDissipatorCount: h.dis?.length, explicitDissipatorCapacityW: h.disCap, builtinCapacityW: h.builtin,legacyCapacityW:h.legacy,skinCapacityW: h.skin,forbiddenDesignSinks:(h.net?.dis||[]).filter(d=>['integral','legacy'].includes(d.k)||d.legacy),forbiddenFleetSinks:(p.heat?.dis||[]).filter(d=>['integral','legacy'].includes(d.k)||d.legacy),presets: h.presets} : null,
          cache: {present: !!cached,catalogOnly:cached?.catalogOnly===true,crewNeed:cached?.crewNeed,crewMax:cached?.crewMax,sourceSha256: YardFleetData.designs[key]?.model?.sourceSha256, profileVersion: cached?.profileVersion, expectedProfileVersion: C.FLEET_PROFILE_VERSION, massKg: cached?.propulsion?.massKg, liveMassKg: p.propulsion.massKg, ratedAccelMps2: cached?.propulsion?.ratedAccelMps2, liveRatedAccelMps2: p.propulsion.ratedAccelMps2, grid: cached?.grid ? {P: cached.grid.P, Dw: cached.grid.Dw, Ds: cached.grid.Ds, De: cached.grid.De} : null, liveGrid: {P: p.grid.P, Dw: p.grid.Dw, Ds: p.grid.Ds, De: p.grid.De}, weaponModules: cached?.modules?.filter(m => m.k === 'weapon').length, liveWeaponModules: p.modules.filter(m => m.k === 'weapon').length, engineCount: cached?.propulsion?.engines?.length, liveEngineCount: p.propulsion.engines.length},
          renderer: {bounds: g.bounds, center: g.center, turretCount: g.turrets.length, meshCount: Object.keys(g.meshes).length, workerMode: YardEngineClient.mode},
          warnings: S.warnings
        };
      }, {key,prepared,preparedSha256,expectedBlueprintSha256});
      fs.writeFileSync('/tmp/ship-examples-browser-progress.json',JSON.stringify({status:'IN_PROGRESS',sourceSha256,ships:[...ships,trace]},null,2)+'\n');
      validateTrace(trace,key,sourceSha256);
      trace.draws = [];
      const views = key.startsWith('mc80')||['munificent','recusant'].includes(key) ? ['dorsal', 'ventral'] : ['dorsal'];
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
          const A=window.__shipRefresh,g=A.asset.geometry,ventral=view==='ventral',colours=['#ff6d7d','#ffd16b','#74dce2','#d3a0ff','#9ce47a','#ffad71','#87baff','#e8eef5'],kinds=[...new Set(weapons.map(w=>w.kind))];
          let count=0;
          for(const w of weapons){if(ventral?w.normal[1]>.5:w.normal[1]<-.5)continue;const p=w.origin,q=A.v.project([p[0],ventral?2*g.center[1]-p[1]:p[1],ventral?2*g.center[2]-p[2]:p[2]]),e=document.createElement('span');e.dataset.mountMarker=w.id;e.title=w.kind+' #'+w.id;e.style.cssText='position:absolute;width:8px;height:8px;border:1.5px solid '+colours[kinds.indexOf(w.kind)%colours.length]+';border-radius:50%;transform:translate(-50%,-50%);pointer-events:none';e.style.left=q[0]+'px';e.style.top=q[1]+'px';A.stage.append(e);count++;}
          const legend=document.createElement('div');legend.dataset.mountMarker='legend';legend.style.cssText='position:absolute;left:20px;bottom:20px;padding:9px 12px;background:#101b2dee;font:16px system-ui';legend.innerHTML=kinds.map((k,i)=>'<span style="color:'+colours[i%colours.length]+';margin-right:18px">○ '+k+'</span>').join('');A.stage.append(legend);return count;
        },{view,weapons:trace.weapons});
        const stationFile='ship-refresh-'+key+'-'+view+'-stations.png';await page.locator('#ship-refresh-stage').screenshot({path:path.join(imageRoot,stationFile)});screenshots.push(stationFile);
      }
      if(['munificent','recusant'].includes(key)){
        trace.nativeDetail=await page.evaluate(key=>{
          const A=window.__shipRefresh,C=window.__yard.C,g=A.asset.geometry,v=A.v,s=A.ship,bow=s.fits.find(f=>f.k===(key==='munificent'?'munBow':'recProw'));
          const fits=key==='munificent'?[bow,...s.fits.filter(f=>f.k==='munTwin').sort((a,b)=>Math.abs(a.p[0]-bow.p[0])-Math.abs(b.p[0]-bow.p[0])).slice(0,4)]:s.fits.filter(f=>['recProw','recTwin','recKeel'].includes(f.k)),boxes=fits.map(C.fitAABB),bounds=[...Array(3)].map((_,i)=>Math.min(...boxes.map(b=>b[i]))).concat([...Array(3)].map((_,i)=>Math.max(...boxes.map(b=>b[i+3])))),flip=p=>[p[0],2*g.center[1]-p[1],2*g.center[2]-p[2]],middle=[0,1,2].map(i=>(bounds[i]+bounds[i+3])/2),diagonal=Math.hypot(...[0,1,2].map(i=>bounds[i+3]-bounds[i]));
          for(const e of A.stage.querySelectorAll('[data-mount-marker]'))e.remove();v.cam.target=flip(middle);v.cam.ortho=true;v.cam.th=-Math.PI/2;v.cam.ph=.6;v.cam.r=diagonal*1.3/(2*Math.tan(v.cam.fov/2));v.draw({fleet:[{key,pos:g.center,rot:[1,0,0,0,-1,0,0,0,-1],glow:0}],noStars:true,lod:false});A.stage.querySelector('#ship-refresh-caption').textContent=key+' · native bow guns · lit ventral detail\n'+fits.map(f=>{const d=C.fitSpec(f),bolt=d.boltTT>=1000?d.boltTT/1000+' PT':d.boltTT<1?d.boltTT*1000+' GT':d.boltTT+' TT';return f.k+' · '+d.barrels+' × '+bolt+' / '+d.cycle+' s';}).filter((s,i,a)=>a.indexOf(s)===i).join('   ');
          const points=[];for(const x of [bounds[0],bounds[3]])for(const y of [bounds[1],bounds[4]])for(const z of [bounds[2],bounds[5]])points.push(v.project(flip([x,y,z])));
          return{gunIds:fits.map(f=>f.id),bounds,webglError:v.gl.getError(),projectedBounds:{left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))}};
        },key);
        assert.equal(trace.nativeDetail.webglError,0,key+' native detail WebGL');const b=trace.nativeDetail.projectedBounds;assert.ok(b.left>5&&b.right<1595&&b.top>5&&b.bottom<995,key+' complete native guns in detail frame');const file='ship-refresh-'+key+'-native-detail.png';await page.locator('#ship-refresh-stage').screenshot({path:path.join(imageRoot,file)});screenshots.push(file);
      }
      ships.push(trace);
      validateDraws(trace);checkpoint();
      process.stderr.write('Verified '+key+' · '+trace.weapons.length+' guns · '+trace.engines.length+' engines · '+Math.round(trace.elapsedMs)+' ms\n');
      // Release each completed asset before uploading the next one.
      await page.evaluate(() => {
        const A = window.__shipRefresh;
        A.v.gl.getExtension('WEBGL_lose_context')?.loseContext();
        A.stage.querySelector('canvas').remove(); const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;display:block'; A.stage.prepend(canvas); A.v = new Gfx.Renderer(canvas);
        delete A.asset; delete A.ship;
      });
    }
    const editor = keys.includes('cr90') ? await (async () => {
      process.stderr.write('Native CR90 engine/performance panel\n');
      // A fresh context gives the native stock selector an empty example disk cache.
      await context.close();const nativeContext=await browser.newContext({viewport:{width:1600,height:1000},locale:'ja-JP'}),page=await nativeContext.newPage();page.setDefaultTimeout(300000);page.on('pageerror',e=>errors.push(String(e)));await page.addInitScript(()=>localStorage.setItem('yard.language','ja'));await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:180000});
      await page.evaluate(() => {const A=window.__shipRefreshNative={nativeRequest:YardEngineClient.request,nativeOpen:{path:'native stock example selector'}};YardEngineClient.request=(type,payload,...rest)=>A.nativeRequest(type,payload,...rest).then(reply=>{if(type==='build'&&payload?.key==='cr90')Object.assign(A.nativeOpen,{workerSource:reply.src,buildMs:reply.ms});return reply;});});
      await page.locator('.tbig[data-title-mode="sandbox"]').click();await page.locator('.tbig[data-title-mode="design"]').click();await page.locator('[data-title="load"]').click();const nativeOpenStart=Date.now();await page.locator('[data-title-example="cr90"]').click({noWaitAfter:true});
      await page.waitForFunction(() => { const Y = window.__yard; return Y.ship?.reference === 'cr90' && Y.stats && Y.eng.geoGen >= Y.eng.gen && Y.eng.statsGen >= Y.eng.gen && Y.eng.adoptedGen >= Y.eng.gen; }, null, {timeout: 300000});
      const nativeOpen=await page.evaluate(()=>{const A=window.__shipRefreshNative,Y=window.__yard;YardEngineClient.request=A.nativeRequest;delete A.nativeRequest;Y.st.tab='systems';Y.st.sel=null;Y.st.dockCollapsed=false;document.querySelector('#dock').classList.remove('collapsed');Y.renderPanel();return A.nativeOpen;});nativeOpen.elapsedMs=Date.now()-nativeOpenStart;assert.equal(nativeOpen.workerSource,'built','native CR90 stock selector independently executes the factory build');
      await page.locator('#propulsion-preview').waitFor({state: 'attached'});
      await page.locator('#propulsion-preview').evaluate(el => {for (let e=el;e;e=e.parentElement) if(e.tagName==='DETAILS') e.open=true;});
      const previewText = await page.locator('#propulsion-preview').innerText(); assert.doesNotMatch(previewText, /NaN|Infinity|undefined/);
      await page.evaluate(() => {const Y=window.__yard,v=Y.view();v.cam.ortho=true;v.cam.target=[0,0,0];v.cam.th=-1.08;v.cam.ph=.75;v.cam.r=240;Y.draw();});
      let file='ship-refresh-cr90-performance.png'; await page.screenshot({path:path.join(imageRoot,file)}); screenshots.push(file);
      const state=await page.evaluate(()=>{const Y=window.__yard,C=Y.C,e=Y.ship.parts.find(p=>p.k==='engine'),p=C.propulsionPreview(Y.ship,Y.stats,'combat');Y.st.tab='edit';Y.st.sel={list:'parts',id:e.id};Y.st.multi.parts.clear();Y.st.multi.parts.add(e.id);Y.renderPanel();return{engineId:e.id,spec:C.resolveEngineSpec(e,Y.ship),performance:{massTonnes:Y.stats.mass,actualCombatAccelG:Y.stats.accelG,powerW:Y.stats.power},preview:{actualInputW:p.actualInputW,actualThrustN:p.actualThrustN,wasteHeatW:p.wasteHeatW},generation:{design:Y.eng.gen,geometry:Y.eng.geoGen,statistics:Y.eng.statsGen},workerMode:YardEngineClient.mode};});
      const physical=page.locator('#engine-spec-editor');await physical.waitFor({state:'attached'});await physical.evaluate(el=>{for(let e=el;e;e=e.parentElement)if(e.tagName==='DETAILS')e.open=true;});await physical.scrollIntoViewIfNeeded();state.engineEditorText=await physical.innerText();assert.doesNotMatch(state.engineEditorText,/NaN|Infinity|undefined/);assert.ok(state.spec.valid&&state.spec.ratedInputW>0);
      file='ship-refresh-cr90-engine.png';await page.screenshot({path:path.join(imageRoot,file)});screenshots.push(file);state.previewText=previewText;state.nativeOpen=nativeOpen;
      const built=ships.find(s=>s.key==='cr90');close(state.performance.massTonnes,built.massTonnes,'native CR90 current mass');close(state.performance.actualCombatAccelG,built.power.actualCombatAccelG,'native CR90 current acceleration');for(const field of ['actualInputW','actualThrustN','wasteHeatW'])close(state.preview[field],built.power.preview[field],'native/worker CR90 '+field);await nativeContext.close();return state;
    })() : null;
    assert.deepEqual(errors, []);
    const sourceSha256After = sources(); assert.deepEqual(sourceSha256After, sourceSha256, 'sources changed during verification; rerun after the final source/cache freeze');
    const verificationSessions=[...(resume?.verificationSessions||[]),sessionRecord('COMPLETE')];
    const result = {schemaVersion:1,verificationSessions,resumeProvenance,totalVerificationElapsedMs:verificationSessions.reduce((n,s)=>n+s.elapsedMs,0),status:complete?'PASS':'PARTIAL',date:new Date().toISOString(),browser:'Chromium with software WebGL',url,inputMode:blueprintRoot?'prepared-saved-blueprints':'factory-builds',blueprintDirectory:blueprintRoot,elapsedMs:Date.now()-started,sourceSha256,sourceSha256After,ships,editor,errors,screenshots,scope:{verified:[...(resume?['verification spans source-stable sessions; completed traces, canonical input keys and image hashes were revalidated']:[]),...(blueprintRoot?['each saved input blueprint matches the catalog canonical SHA before worker deserialization']:[]),keys.length+' current examples with fresh worker statistics and production meshes','four requested exact armament rosters, Mandator physical specifications and family choice','every gun represented by an authored articulated mesh and active fleet mount','weapon positions, normals, muzzle coordinates and capacitor capacity','MC80 prior annotated 50 dorsal/50 ventral stations and links','native CR90 stock-selector factory build, physical engine editor and performance panel','crew usability and full required crew capacity in live and cached profiles','cruise and firing priority demand with source/consumer conservation and allocated watts-to-thrust parity','strict thermal networks with zero integral/legacy cooling','30 seconds of simultaneous rated demand from cold, recording electrical and thermal limits','strict current factory/cache engineering parity, with measured saved-reload mass/acceleration/grid differences and independent factory fallback where needed'],designPolicy:'Electrical saturation and thermal warnings are recorded; simultaneous unrestricted maximum engine/gun/shield output is not a design target',notVerified:['bit-identical capital-ship factory/save/reload engineering','physical mobile/GPU hardware','long combat balance','thermal behaviour beyond the recorded interval']}};
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
    process.stdout.write(JSON.stringify({status:result.status,elapsedMs:result.elapsedMs,ships:ships.map(s=>s.key),screenshots})+'\n');
    await context.close();
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
