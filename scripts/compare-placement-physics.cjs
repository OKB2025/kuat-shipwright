#!/usr/bin/env node
// node scripts/compare-placement-physics.cjs IMMUTABLE_MAIN_ROOT [OUTPUT_JSON]
// Default: build each reference in immutable main, serialize it, and feed the
// same blueprint to both Core versions. No diagram or source is modified.
// Optional fast recheck: KS_PHYSICS_BASELINE_REPORT + KS_PHYSICS_BLUEPRINT_DIR
// reuse prior measured baseline values only after checking every source/input
// checksum. The report identifies this mode; timings are not speed comparisons.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {performance} = require('node:perf_hooks');

const baselineRoot = process.argv[2] && path.resolve(process.argv[2]);
if (!baselineRoot) throw Error('Usage: node scripts/compare-placement-physics.cjs IMMUTABLE_MAIN_ROOT [OUTPUT_JSON]');
const currentRoot = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[3] || '/tmp/kuat-placement-physics-comparison.json');
const files = ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js'];
const keys = ['imperial', 'imperial2', 'venator', 'cr90'];
const statsKeys = ['mass', 'framingMass', 'hp', 'armorMass', 'cost', 'power', 'thrust', 'aThrust',
  'aStruct', 'bareStructAccel', 'aEff', 'accelG', 'structG', 'cutSection', 'structLimited',
  'inertialSupport', 'integritySupport'];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const plain = value => JSON.parse(JSON.stringify(value));
const hashes = root => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(path.join(root, file)))]));
function revision(root) { try { return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(); } catch { return null; } }
function load(root) {
  const context = vm.createContext({console, performance}), sourceSha256 = {};
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(root, file));
    sourceSha256[file] = sha(bytes);
    vm.runInContext(bytes.toString('utf8'), context, {filename: file});
  }
  return {C: vm.runInContext('Core', context), sourceSha256};
}
function constants(C) {
  return {framing: C.K.framing, framingStiff: C.K.framingStiff, framingDens: C.K.framingDens,
    hullDens: C.K.hullDens, structuralSigma: C.K.sigma,
    heatCapacityJPerKg: C.HEAT.qAllowJPerKg, battleAccelerationScale: C.FLEET_RULES.accelScale};
}
function measure(C, blueprint, key) {
  const started = performance.now(), ship = C.deserialize(plain(blueprint));
  const S = C.computeStats(ship), profile = C.fleetProfile(S, ship.name, ship);
  const unit = C.fleetUnit('comparison-' + key, key, profile, 0);
  unit.order = {...unit.order, power: 'balanced'};
  unit.maneuver = 1;
  C.fleetPowerStep(unit, C.fleetSystems(unit), null, 0, .25);
  return {
    stats: Object.fromEntries(statsKeys.map(field => [field, S[field]])),
    heatCapacityJ: S.heat.capacityJ,
    profile: Object.fromEntries(['version', 'architectureVersion', 'ratedThrustN', 'ratedAccelMps2',
      'structuralAccelerationLimitMps2', 'inertialFactor', 'accelerationLimitMps2'].map(field => [field, profile.propulsion[field]])),
    runtime: Object.fromEntries(['actualInputW', 'actualThrustN', 'wasteHeatW', 'actualAccelMps2'].map(field => [field, unit.propulsion[field]])),
    elapsedMs: performance.now() - started
  };
}
function differences(before, after, prefix = '', result = []) {
  for (const [field, value] of Object.entries(before)) {
    if (field === 'elapsedMs') continue;
    const name = prefix ? prefix + '.' + field : field, actual = after?.[field];
    if (value && typeof value === 'object') differences(value, actual, name, result);
    else if (typeof value === 'number') {
      if (!Number.isFinite(actual) || Math.abs(actual - value) > Math.max(1, Math.abs(value)) * 1e-9)
        result.push({field: name, before: value, after: actual});
    } else if (actual !== value) result.push({field: name, before: value, after: actual});
  }
  return result;
}
function exact(before, after) {
  return Object.entries(before).every(([field, value]) => field === 'elapsedMs' ||
    (value && typeof value === 'object' ? exact(value, after[field]) : value === after[field]));
}

const baseline = load(baselineRoot), current = load(currentRoot);
const reuseFile = process.env.KS_PHYSICS_BASELINE_REPORT;
const blueprintDirectory = process.env.KS_PHYSICS_BLUEPRINT_DIR;
if (!!reuseFile !== !!blueprintDirectory) throw Error('Fast recheck requires both KS_PHYSICS_BASELINE_REPORT and KS_PHYSICS_BLUEPRINT_DIR');
const prior = reuseFile && JSON.parse(fs.readFileSync(reuseFile, 'utf8'));
if (prior && JSON.stringify(prior.beforeSourceSha256) !== JSON.stringify(baseline.sourceSha256))
  throw Error('The immutable baseline source does not match the reused measurement');
const report = {
  schemaVersion: 2, status: 'RUNNING', date: new Date().toISOString(), node: process.version,
  baselineRoot, currentRoot, baselineRevision: revision(baselineRoot), currentRevision: revision(currentRoot),
  beforeSourceSha256: baseline.sourceSha256, afterSourceSha256: current.sourceSha256,
  reproducer: {path: 'scripts/compare-placement-physics.cjs', sha256: sha(fs.readFileSync(__filename)),
    command: 'node scripts/compare-placement-physics.cjs IMMUTABLE_MAIN_ROOT OUTPUT_JSON'},
  scope: {
    inputs: prior ? 'Previously serialized main blueprints; all baseline source and blueprint checksums verified.' :
      'Build each ship in immutable main, serialize once, and deserialize identical copies in both Core versions.',
    baselineMeasurements: prior ? 'Reused from ' + path.resolve(reuseFile) : 'Computed during this run.',
    runtime: 'Cold healthy initial state, balanced allocation, full maneuver, .25 s power step; no thermal-equilibrium claim.',
    timings: 'Core build/compute wall times only. Historical reused baseline durations are not a controlled speed comparison.',
    browser: 'No browser, Safari, input-latency, FPS or GPU-memory measurement.', relativeTolerance: 1e-9,
    revisions: 'HEAD identifies each checkout; source hashes identify the tested bytes, including uncommitted changes.',
    massUnit: 'tonnes', otherPhysicalUnits: 'SI'
  },
  constantsBefore: constants(baseline.C), constantsAfter: constants(current.C), cases: []
};
fs.mkdirSync(path.dirname(output), {recursive: true});
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
try {
  for (const key of keys) {
    process.stderr.write(key + ' physics comparison start\n');
    const reference = prior?.cases.find(row => row.key === key);
    const blueprint = prior ? JSON.parse(fs.readFileSync(path.join(blueprintDirectory, 'placement-physics-' + key + '-blueprint.json'), 'utf8')) :
      baseline.C.serialize(baseline.C.buildDesign(key));
    const inputSha256 = sha(JSON.stringify(blueprint));
    if (prior && (!reference?.passed || inputSha256 !== reference.inputSha256)) throw Error('Reused blueprint checksum/result mismatch: ' + key);
    const before = prior ? reference.before : measure(baseline.C, blueprint, key), after = measure(current.C, blueprint, key);
    const delta = differences(before, after);
    report.cases.push({key, inputSha256, before, after, differences: delta, passed: !delta.length,
      exactPhysicalValuesEqual: exact(before, after)});
    save();
    process.stderr.write(key + ' ' + (delta.length ? 'FAIL' : 'PASS') + '\n');
  }
  report.baselineSourceSha256AtCompletion = hashes(baselineRoot);
  report.currentSourceSha256AtCompletion = hashes(currentRoot);
  report.sourceStable = JSON.stringify(report.baselineSourceSha256AtCompletion) === JSON.stringify(report.beforeSourceSha256) &&
    JSON.stringify(report.currentSourceSha256AtCompletion) === JSON.stringify(report.afterSourceSha256);
  report.constantDifferences = differences(report.constantsBefore, report.constantsAfter);
  report.status = !report.sourceStable ? 'INVALIDATED' : report.cases.every(row => row.passed) && !report.constantDifferences.length ? 'PASS' : 'FAIL';
  save();
  console.log(JSON.stringify({status: report.status, output, cases: report.cases.map(row =>
    ({key: row.key, passed: row.passed, exact: row.exactPhysicalValuesEqual}))}, null, 2));
  process.exitCode = report.status === 'PASS' ? 0 : 1;
} catch (error) {
  report.status = 'ERROR';report.error = String(error.stack || error);save();throw error;
}
