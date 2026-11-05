const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console, performance: {now: () => 0}});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const C = vm.runInContext('Core', context);
const plain = value => JSON.parse(JSON.stringify(value));
const aliases = {refISD: 'stl', refISDh: 'oct40', refIon: 'ion', refIonH: 'ion', casemate40: 'monCal34', refSide:'twin40', xx9:'twin40', nk7:'quad40Ion', ltl:'pd', mtl:'quad200', htl:'refVen', casemateMid:'monCal34', casemateLight:'monCal34', casemateIon:'monCal150Ion', casemateIonL:'monCal150Ion'};
const migratedGunRow = row => {
  const copy = [row[0], aliases[row[1]], ...row.slice(2)];
  return copy;
};
const fit = (k, id = 1, extra = {}) => ({id, k, p: [30+id*50, 60, 20], a: 2, ped: 0, base: 0, low: 0, float: false, ...extra});
function blueprint(fits) {
  const ship = C.newShip({L: 600, W: 400, H: 120, plan: 'rect', sec: 'rect'}, 'Legacy weapons');
  ship.parts = [];
  ship.fits = [];
  const raw = plain(C.serialize(ship));
  raw.fits = fits;
  raw.nextId = Math.max(1, ...fits.map(f => f.id+1));
  return plain(raw);
}

test('one canonical catalog describes the heavy twin, octuple and generic ion gun', () => {
  for (const [k, barrels, boltTT, tt, asset] of [
    ['stl', 2, 175, 350, 'capital_twin175'],
    ['oct40', 8, 40, 320, 'isd_heavy_octuple']
  ]) {
    const d = C.FITS[k];
    assert.equal(d.barrels, barrels, k);
    assert.equal(d.boltTT, boltTT, k);
    assert.equal(d.tt, tt, k);
    assert.equal(d.asset, asset, k);
    assert.equal(d.power, tt*C.TT/d.cycle, k);
    assert.equal(!!d.casemate, false, k);
    assert.equal(C.fitCanRotate(k), true, k);
  }
  assert.equal(C.FITS.ion.barrels, 2);
  assert.equal(C.FITS.ion.boltTT, 175);
  assert.equal(C.FITS.ion.ion, 350);
  assert.equal(C.FITS.ion.asset, 'capital_twin175_ion', 'the heavy ion twin uses its photographed capital gunhouse');
  assert.equal(C.FITS.htl.barrels, 2);
  assert.equal(C.FITS.htl.tt, 140);
  assert.equal(C.FITS.refVen.tt, 140);
  assert.equal(C.FITS.refVen.asset, 'ven_turret70_native');
  assert.equal(C.FITS.htl.asset,C.FITS.refVen.asset,'legacy140TT inventory adopts the same native DBY appearance');
  assert.equal(C.FITS.refSide,undefined);assert.equal(C.FITS[C.canonicalWeaponKind('refSide')].tt,80);
  for (const legacy of Object.keys(aliases)) assert.equal(Object.keys(C.FITS).includes(legacy), false, `${legacy} is migration input only`);
  assert.ok(C.FLEET_PROFILE_VERSION>=9,'cached profiles from before weapon consolidation and 20 GT point defense must rebuild');
});

test('canonical kind lookup and standard fitting migrate every retired id without disturbing mount state', () => {
  const state = {
    p: [113, -47, 89], a: 5, ped: 2.5, base: 3, low: -.5, slope: .75,
    pedShape: 'square', pedSize: 1.4, n: [0, 0, -1], tilt: [0, 0, -1], assetYaw: 37.125,
    host: 50, local: [.2, .3, -.4], localNormal: [0, 0, -1], localMount: true,
    tw: 3, vt: 4, chargeSalvos: 3, chargeDepth: 12, chargeScale: 1.25,
    surfacePatch: 'p50:port:0:abc', surfaceCell: 'g0', surfacePoint: [113, -47, 89]
  };
  for (const [legacy, canonical] of Object.entries(aliases)) {
    assert.equal(C.canonicalWeaponKind(legacy), canonical);
    const source = fit(legacy, 2, plain(state));
    assert.equal(C.migrateWeaponFit(source), source, 'mutable fittings keep their identity');
    assert.deepEqual(plain(source), {...fit(canonical, 2), ...state});
    const ordinary = plain(state);
    for (const field of ['surfacePatch', 'surfaceCell', 'surfacePoint']) delete ordinary[field];
    const standard = C.standardFit(fit(legacy, 2, ordinary));
    assert.equal(standard.k, canonical, `${legacy} is canonical before its dimensions are resolved`);
    for(const field of Object.keys(ordinary)){
      const cleared=['base','low','slope'].includes(field);
      assert.deepEqual(plain(standard[field]),cleared?0:ordinary[field],`${legacy} retains explicit settings and clears automatic rise ${field}`);
    }
  }
  for (const k of ['stl', 'oct40', 'ion', 'pd', 'quad200', 'refVen', 'quad40Ion', 'monCal34', 'monCal150Ion', 'unknown']) assert.equal(C.canonicalWeaponKind(k), k);
  const frozen = Object.freeze(fit('refISD'));
  const migrated = C.migrateWeaponFit(frozen);
  assert.equal(frozen.k, 'refISD');
  assert.equal(migrated.k, 'stl');
});

test('retired model skins and pose overrides cannot restore obsolete weapon geometry', () => {
  for (const [k, skinAsset] of [['refISD', 'isd_turret'], ['refISDh', 'isdh_turret'], ['casemate40', 'isd2_casemate'], ['stl', 'isd_turret_3'], ['oct40', 'isd2_octuple'], ['ion', 'isdh_turret']]) {
    const source = fit(k, 2, {a: 2, mountAxis: 4, mountOffset: 8, skinAsset, skinAnchor: [1, 2, 3], skinSize: [4, 5, 6], skinAxial: [1, 1, 1], skinDiameter: 9, assetYaw: -17.5});
    const migrated = C.migrateWeaponFit(source);
    assert.equal(migrated.k, aliases[k] || k);
    assert.equal(migrated.a, 4, 'effective side mounting normal survives the legacy model pose');
    assert.equal(migrated.assetYaw, -17.5);
    assert.deepEqual(plain(migrated.p), [130, 60, 20]);
    for (const field of ['skinAsset', 'skinAnchor', 'skinSize', 'skinAxial', 'skinDiameter', 'mountAxis', 'mountOffset']) assert.equal(Object.hasOwn(migrated, field), false, `${k} clears ${field}`);
    assert.deepEqual(plain(C.migrateWeaponFit(migrated)), plain(migrated), 'migration is idempotent');
  }
  const custom = fit('stl', 1, {skinAsset: 'ven_turret', mountAxis: 4, mountOffset: 3});
  assert.deepEqual(plain(C.migrateWeaponFit(custom)), plain(custom), 'an unrelated authored skin remains explicit design content');
});

test('photo-family remapping cannot resurrect old DBY source skins or support offsets',()=>{
  for(const [kind,skinAsset]of [['refVen','ven_turret_3'],['htl','ven_turret'],['twin40','dby_twin40_raised']]){
    const original=Object.freeze(fit(kind,73,{skinAsset,mountAxis:4,mountOffset:8,assetYaw:17,tw:74,chargeSalvos:2})),migrated=C.migrateWeaponFit(original);
    assert.equal(original.skinAsset,skinAsset);assert.equal(migrated.k,C.canonicalWeaponKind(kind));assert.equal(migrated.id,73);assert.equal(migrated.tw,74);assert.equal(migrated.chargeSalvos,2);assert.deepEqual(plain(migrated.p),plain(original.p));
    assert.equal(migrated.skinAsset,undefined,'new family uses its native case instead of an old source mesh');assert.equal(migrated.mountOffset,undefined,'old support offsets cannot raise the replacement case');
    assert.deepEqual(plain(C.migrateWeaponFit(migrated)),plain(migrated));
  }
});

test('blueprint loading migrates before filtering and repeated saves retain all placements and mirror links', () => {
  const raw = blueprint(Object.keys(aliases).map((k, index) => fit(k, index+1, {assetYaw: 17+index/8, batteryZone: 'legacy-bank', tw: index === 0 ? 2 : index === 1 ? 1 : undefined})));
  const before = plain(raw), ship = C.deserialize(raw);
  assert.deepEqual(raw, before, 'loading never rewrites the imported file');
  assert.equal(ship.fits.length, Object.keys(aliases).length, 'retired ids survive the unknown-fitting filter');
  for (let index = 0; index < ship.fits.length; index++) {
    const f = ship.fits[index], old = raw.fits[index];
    assert.equal(f.k, aliases[old.k]);
    for (const field of ['id', 'p', 'a', 'ped', 'base', 'low', 'assetYaw', 'batteryZone', 'tw']) if (Object.hasOwn(old, field)) {
      assert.deepEqual(plain(f[field]), old[field], field);
    }
  }
  const saved = plain(C.serialize(ship));
  const loaded = C.deserialize(saved);
  assert.deepEqual(plain(C.serialize(loaded)), saved, 'a second save cannot accumulate model offsets or resurrect old ids');
  const direct = blueprint(Object.keys(aliases).map((k, i) => fit(k, i+1)));
  assert.deepEqual(plain(C.serialize(direct)).fits.map(f => f.k), Object.values(aliases), 'saving a live legacy state also canonicalizes ids');
});

test('surface battery settings and packed retained gun rows migrate without losing their ids', () => {
  const raw = blueprint([]);
  const id = C.surfacePatches(C.deserialize(raw)).find(p => p.face === 'top').id;
  const guns = Object.keys(aliases).map((k, index) => [100+index, k, 40+index*60, 60, 0, 2, 0, 1, 0, 40+index*60, 60, 0, 0, 1, 0, 1, 1, 0, 0, 0, 'g'+index]);
  raw.surfaces = {version: 4, mode: 'strict', patches: [{id, battery: {weapon: 'casemate40', count: 5, spacing: 3, angle: 31.25, reversed: true}, aggregate: {version: 1, cells: [], guns, requested: 5, requestedEquipment: 0}}]};
  const migrated = C.migrateWeaponDesign(raw).surfaces.patches[0];
  assert.deepEqual(plain(migrated.battery), {weapon: 'monCal34', count: 5, spacing: 3, angle: 31.25, reversed: true});
  assert.deepEqual(plain(migrated.aggregate.guns), guns.map(migratedGunRow));
  const loaded = C.deserialize(raw);
  assert.equal(loaded.surfaces.patches[0].battery.weapon, 'none','blueprint loading retains the existing retirement of automatic surface inventory');
  assert.equal(loaded.surfaces.patches[0].aggregate,undefined);
});

test('nested fleet transport, user assemblies and immutable craft blueprints use the same migration', () => {
  const raw = blueprint([fit('refISD', 1), fit('refIonH', 2)]);
  const nested = {ctgs: [{tgs: [{ships: [{carried: [{design: {blueprint: raw}}]}]}]}], template: {format: 'starship-yard-part', v: 1, parts: [], fits: [fit('refISDh')]}};
  const before = plain(nested), migrated = C.migrateWeaponDesign(nested);
  assert.deepEqual(nested, before, 'transport migration leaves the source tree available to callers');
  assert.deepEqual(plain(migrated.ctgs[0].tgs[0].ships[0].carried[0].design.blueprint.fits.map(f => f.k)), ['stl', 'ion']);
  assert.equal(migrated.template.fits[0].k, 'oct40');
  const craft = C.cleanDesignCraft({name: 'Legacy custom craft', dims: [600, 400, 120], craft: {role: 'fighter'}, blueprint: raw});
  assert.ok(craft.blueprint);
  assert.deepEqual(plain(craft.blueprint.fits.map(f => f.k)), ['stl', 'ion']);
  assert.ok(Object.isFrozen(craft.blueprint), 'the canonical stored model is still immutable');
  const template = C.normalizeAssemblyTemplate(nested.template);
  assert.equal(template.fits[0].k, 'oct40');
  assert.deepEqual(plain(C.normalizeAssemblyTemplate(template).fits), plain(template.fits));
});

test('public engine transport canonicalizes legacy fits while patching existing cached fit objects', () => {
  assert.equal(JSON.parse(C.publicJSON(blueprint([fit('refISD')]))).fits[0].k, 'stl');
  const raw = blueprint([fit('refISD')]);
  const ship = C.deserialize(blueprint([fit('stl')])), existing = ship.fits[0];
  existing._cachedMarker = 1;
  C.patchShip(ship, raw, ['fits']);
  assert.equal(ship.fits[0], existing);
  assert.equal(existing.k, 'stl');
  assert.equal(existing._cachedMarker, 1, 'worker updates retain private keyed caches');
  assert.equal(raw.fits[0].k, 'refISD', 'the worker message remains immutable input');
  existing.k = 'refISD';
  C.patchShip(ship, blueprint([fit('stl')]), ['fits']);
  assert.equal(ship.fits[0], existing);
  assert.equal(existing.k, 'stl', 'an equal canonical worker fit also updates a live legacy fit');
  assert.equal(existing._cachedMarker, 1);
});
