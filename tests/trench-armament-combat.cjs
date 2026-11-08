const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const {C, R} = require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain = value => JSON.parse(JSON.stringify(value));
const near = (a, b) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Math.max(1e-10, Math.abs(b) * 1e-8), `${a} != ${b}`);

// Actual saved-shape geometry, real reactor/fuel, real conduits and shared
// charging volume. No profile power or weapon coefficient is invented here.
function design(counts = [{kind: 'monCal34', count: 100}]) {
  const ship = C.newShip({L: 8000, W: 2000, H: 1000, plan: 'rect', sec: 'rect', bowW: 1, bowH: 1, stern: 1}, 'Compact trench combat');
  ship.autoHabitation = false; ship.detail = 0;
  ship.parts = [{id: 1, k: 'gen', c: [4000, 500, 0], d: 1000}, {id: 2, k: 'fuel', c: [6000, 500, 0], d: 500}];
  ship.fits = []; ship.hatches = []; ship.nextId = 3;
  const configured = C.configureTrenchArmament(ship, {hostId: 'hull', newTrench: {side: 'both', from: .1, to: .9, level: .5, height: 80, depth: 100, mode: 'split'}, counts});
  assert.equal(configured.ok, true, configured.error);
  const stats = C.computeStats(ship), profile = C.fleetProfile(stats, ship.name, ship);
  return {ship, stats, profile};
}
let small, large, mixed;
function fixtures() {
  small ||= design(); large ||= design([{kind: 'monCal34', count: 10000}]);
  mixed ||= design([{kind: 'monCal34', count: 11}, {kind: 'pd', count: 1001}]);
  return {small, large, mixed};
}
function unit(profile, id = 'attacker', team = 0) {
  const u = C.fleetUnit(id, id, profile, team);
  u.pos = [0, 0, 0]; u.yaw = 0; u.crew = profile.crewNeed;
  u.order = {...u.order, type: 'hold', power: 'weapons', fire: true};
  return u;
}
function target(profile, z = 8000) {const t = unit(profile, 'target', 1); t.pos = [0, 0, z]; t.order.fire = false; return t;}

test('100 to 10000 mounts retain bounded groups, physical rows and runtime modules while totals scale exactly once', () => {
  const {small: a, large: b} = fixtures();
  for (const x of [a, b]) {
    assert.equal(x.ship.parts.length, 2); assert.equal(x.ship.fits.length, 2);
    assert.equal(C.weaponCapacitors(x.ship).filter(p => p.trenchChargeRow).length, 2);
    assert.equal(x.profile.surface.mounts.length, 2);
    assert.ok(x.profile.surface.mounts.every(m => m.muzzles.length <= 8 && m.trenchAggregate));
  }
  assert.equal(a.profile.modules.length, b.profile.modules.length);
  for (let i = 0; i < a.profile.surface.mounts.length; i++) {
    const m = a.profile.surface.mounts[i], n = b.profile.surface.mounts[i];
    for (const k of ['gun', 'power', 'capacity', 'barrels', 'aggregateCount']) near(n[k], m[k] * 100);
    near(n.boltTT, m.boltTT);
  }
  const f = b.ship.fits[0], base = C.fitSpec({k: f.k});
  near(C.fitSpec(f).tt, base.tt * f.aggregateCount);
  near(C.fitSpec(f).power, base.power * f.aggregateCount);
  assert.equal(b.profile.profileVersion, C.FLEET_PROFILE_VERSION);
});

test('odd mixed totals share one actual capacitor per side without duplicating its stored energy', () => {
  const {mixed: x} = fixtures(), caps = C.weaponCapacitors(x.ship).filter(p => p.trenchChargeRow);
  assert.equal(x.ship.fits.length, 4); assert.equal(caps.length, 2);
  for (const kind of ['monCal34', 'pd']) {
    const rows = x.ship.fits.filter(f => f.k === kind), wanted = kind === 'pd' ? 1001 : 11;
    assert.equal(rows.reduce((n, f) => n + f.aggregateCount, 0), wanted);
    assert.equal(rows[0].aggregateCount - rows[1].aggregateCount, 1);
  }
  near(x.profile.surface.mounts.reduce((n, m) => n + m.capacity, 0), caps.reduce((n, p) => n + C.partVolume(p), 0) * C.CHARGE_TT_M3);
  const capModules = x.profile.modules.filter(m => m.k === 'capacitor');
  assert.equal(capModules.length, 2);
  assert.ok(capModules.every(m => m.links.length === 2));
  assert.equal(new Set(capModules.flatMap(m => m.links)).size, 4);
});

test('port and starboard rows use the real opening, range and bounded per-muzzle obstruction rather than one center ray', () => {
  const {small: x} = fixtures(), u = unit(x.profile), mounts = x.profile.surface.mounts;
  const port = target(x.profile, -8000), stbd = target(x.profile, 8000), fore = target(x.profile); fore.pos = [12000, 0, 0];
  assert.ok(C.fleetFire(u, port, 8000).gun > 0); assert.ok(C.fleetFire(u, stbd, 8000).gun > 0);
  assert.equal(C.fleetFire(u, fore, 12000).gun, 0);
  assert.equal(C.fleetFire(u, target(x.profile, 100000), 100000).gun, 0);
  const mount = mounts.find(m => m.normal[2] > 0), probe = {...u, p: {...x.profile, surface: {...x.profile.surface, mounts: [mount]}}}, open = C.fleetFire(probe, stbd, 8000).gun;
  assert.ok(open > 0);
  // Four sample bins are moved inside the opposite wall. Their integer
  // populations differ because eight bins represent fifty actual mounts.
  const obstructed = {...mount, muzzles: mount.muzzles.map((p, i) => i % 2 ? [p[0], p[1], -1100] : p)};
  probe.p = {...probe.p, surface: {...probe.p.surface, mounts: [obstructed]}};
  const totalWeight = mount.muzzleWeights.reduce((n, weight) => n + weight, 0);
  const openWeight = mount.muzzleWeights.reduce((n, weight, i) => n + (i % 2 ? 0 : weight), 0);
  near(totalWeight, 1); near(mount.aggregateCount, 50); near(openWeight * mount.aggregateCount, 24);
  const reduced = C.fleetFire(probe, stbd, 8000); near(reduced.gun, open * openWeight / totalWeight);
  C.fleetPowerStep(probe, C.fleetSystems(probe), stbd, reduced.cost, .25);
  const fired = probe.surfaceLastFire.gun; assert.ok(fired > 0);
  for (let serial = 0; serial < 8; serial++) {
    probe.trenchShotSerial = serial;
    const packets = C.fleetWeaponPackets(probe, fired, 0, stbd);
    near(packets.reduce((n, p) => n + p.gun, 0), fired);
    assert.ok(packets.every(p => p.sourceMuzzle[2] > 0), 'blocked samples never become the actual emitted packet origin');
  }
});

test('actual reactor input charges empty shared banks and funds firing and weapon waste heat through one ledger', () => {
  const {small: x} = fixtures(), u = unit(x.profile), t = target(x.profile), dt = .25;
  u.energy = 0; u.surfaceBanks = Object.fromEntries(x.profile.surface.mounts.map(m => [m.id, 0]));
  const beforeFuel = C.shipFuelAvailableEnergyJ(u), F = C.fleetFire(u, t, 8000);
  assert.ok(F.gun > 0 && F.runtime); C.fleetPowerStep(u, C.fleetSystems(u), t, F.cost, dt);
  assert.ok(u.pw.wpn > 0); assert.ok(u.surfaceLastFire.spent > 0); assert.ok(u.surfaceLastFire.charged > 0);
  near(u.surfaceLastFire.charged * C.weaponInputFactor(x.profile) * C.TT / dt, u.pw.wpn);
  near(u.energy, u.surfaceLastFire.charged - u.surfaceLastFire.spent);
  near(u.ht.e.weapon, C.HEAT.waste.weapon * u.pw.wpn * dt);
  assert.ok(C.shipFuelAvailableEnergyJ(u) < beforeFuel);
  const depleted = unit(x.profile); depleted.energy = 0; depleted.surfaceBanks = Object.fromEntries(x.profile.surface.mounts.map(m => [m.id, 0]));
  for (const fuel of depleted.fuel?.sources || []) fuel.remainingJ = 0;
  // Physical source destruction must deny the existing power route even when
  // the compact count still advertises a nonzero rated weapon demand.
  x.profile.modules.forEach((m, i) => {if (m.k === 'reactor') depleted.mods[i] = 0;});
  C.fleetPowerStep(depleted, C.fleetSystems(depleted), t, F.cost, dt);
  assert.equal(depleted.surfaceLastFire.spent, 0); assert.equal(depleted.surfaceLastFire.charged, 0);
});

test('one shared-row hit reduces both weapon shares once, while weapon destruction remains local to that group', () => {
  const {mixed: x} = fixtures(), u = unit(x.profile), mounts = x.profile.surface.mounts;
  C.surfaceMountEnergy(u, mounts[0].id); const ci = x.profile.modules.findIndex(m => m.k === 'capacitor'), cap = x.profile.modules[ci];
  const affected = mounts.filter(m => cap.links.includes(m.module)), other = mounts.filter(m => !cap.links.includes(m.module));
  assert.equal(affected.length, 2); const lost = affected.reduce((n, m) => n + m.capacity / 2, 0);
  u.mods[ci] = .5; C.surfacePowerStep(u, null, null, 0, 0, 0);
  for (const m of affected) near(C.surfaceMountEnergy(u, m.id), m.capacity / 2);
  for (const m of other) near(C.surfaceMountEnergy(u, m.id), m.capacity);
  near(u.surfaceReleasedTT, lost); C.surfacePowerStep(u, null, null, 0, 0, 0); near(u.surfaceReleasedTT, lost);
  u.mods[ci] = 0; C.surfacePowerStep(u, null, null, 0, 0, 0);
  for (const m of affected) assert.equal(C.surfaceSpend(u, m.id, m.boltTT).ok, false);
  assert.ok(other.every(m => C.surfaceSpend(u, m.id, m.boltTT).ok));
  const damaged = other[0], intact = other[1]; u.mods[damaged.module] = 0;
  assert.equal(C.surfaceSpend(u, damaged.id, damaged.boltTT).ok, false); assert.ok(C.surfaceSpend(u, intact.id, intact.boltTT).ok);
});

test('actual trench patch hits damage its shared logical weapon module without a visible gun mesh', () => {
  const {mixed: x} = fixtures(), profile = plain(x.profile), u = unit(profile);
  for (const patch of profile.surface.patches) patch.armor.thickness = 0;
  const device = profile.surface.devices.find(d => d.embedded), untouched = profile.surface.mounts.find(m => m.module !== device.module && m.normal[2] * device.normal[2] < 0);
  assert.ok(device && untouched); const ctx = {time: 1, rand: () => 1, ev() {}, sunk() {}, out() {}};
  C.surfaceHit(ctx, u, device.wallPoint || device.center, profile.hp * .1);
  assert.ok(u.mods[device.module] < 1); assert.equal(u.mods[untouched.module], 1);
});

test('bounded actual trench-origin packets conserve gun and ion totals in direct damage routing and fleet combat', () => {
  const {small: x} = fixtures(), u = unit(x.profile), t = target(x.profile), F = C.fleetFire(u, t, 8000), dt = .25;
  C.fleetPowerStep(u, C.fleetSystems(u), t, F.cost, dt);
  const packets = C.fleetWeaponPackets(u, 17, 3);
  assert.ok(packets.length <= x.profile.surface.mounts.length + 1);
  near(packets.reduce((n, p) => n + p.gun, 0), 17); near(packets.reduce((n, p) => n + p.ion, 0), 3);
  const physical = packets.filter(p => p.trenchAggregate); assert.ok(physical.length > 0);
  for (const p of physical) {assert.ok(p.sourceMuzzle[2] > 0); assert.deepEqual(plain(p.point), plain(C.add(u.pos, p.sourceMuzzle)));}
  const inc = C.combatIncoming(), amount = {sf: 20 * dt, hull: 17 * dt, ion: 3 * dt, direct: 4};
  C.combatAddWeapons(inc, t, u, amount, 17, 3, dt, null);
  for (const k of ['sf', 'hull', 'ion', 'direct']) near(inc[k], amount[k]);
  assert.ok(inc.hits.length > 0 && inc.hits.length <= packets.length + 1);
  const a = unit(x.profile, 'A'), b = target(x.profile), battle = C.fleetBattle([a, b], true), before = b.hp;
  const shots = C.fleetTick(battle, dt, {collide: false}), outgoing = shots.filter(s => s.from === a.id && s.trenchAggregate);
  assert.ok(outgoing.length > 0 && outgoing.length <= x.profile.surface.mounts.length);
  assert.ok(outgoing.every(s => s.sourceMuzzle[2] > 0 && s.gun > 0 && typeof s.ion === 'boolean'));
  assert.ok(b.hp < before || b.surfaceLastHit, 'the actual target receives resolved damage');
  const ordinary = {p: {surface: {mounts: [{id: 1}]}}, surfaceLastFire: {cells: [{fit: 1, gun: 2}]}};
  assert.equal(C.fleetWeaponPackets(ordinary, 2, 0), null, 'ordinary weapons retain the existing center-origin route');
});

test('RTS battle uses the same compact firing and profile-local muzzle packets as fleet combat', () => {
  const {small: x} = fixtures(), designOf = key => ({key, p: x.profile, info: {mass: x.stats.mass, hyper: null, capital: true, sensor: 0}});
  const a = designOf('trench-a'), b = designOf('trench-b'), w = R.createWorld({mode: 'test', sensors: false, convoyMode: false, designs: [a, b], sides: [{faction: 'empire', ai: false}, {faction: 'rebel', ai: false}], fleets: [[{design: a.key}], [{design: b.key}]]});
  const u = [...w.units.values()].find(q => q.side === 0), t = [...w.units.values()].find(q => q.side === 1);
  t.sys = u.sys; w.groups.get(t.group).sys = u.sys; u.pos = [0, 0, 0]; t.pos = [0, 0, 8000]; u.yaw = 0;
  u.crew = x.profile.crewNeed; t.crew = x.profile.crewNeed;
  u.order = {...u.order, type: 'attack', target: t.id, power: 'weapons'}; t.order = {...t.order, type: 'hold', fire: false};
  R.battleTick(w, u.sys, .25);
  assert.ok(u.lastShot?.packets?.length > 0); assert.ok(u.lastShot.packets.length <= x.profile.surface.mounts.length + 1);
  assert.ok(u.lastShot.packets.filter(p => p.trenchAggregate).every(p => p.sourceMuzzle[2] > 0));
  near(u.lastShot.packets.reduce((n, p) => n + p.gun, 0), u.lastShot.gun);
});

test('actual strict Worker configuration and final cache packets preserve shared rows on the client without public fallback', async () => {
  const {mixed: x} = fixtures(), context = vm.createContext({Core: C, console, setTimeout, clearTimeout, structuredClone});
  vm.runInContext(fs.readFileSync(path.join(root, 'js/gfx.js'), 'utf8'), context);
  // Expose the unchanged production disk-cache restorer only to this test.
  const source = fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8').replace('return {listenWorker, connectInline, packCaches, disk: DISK};', 'return {listenWorker, connectInline, packCaches, restoreCaches, disk: DISK};');
  assert.ok(source.includes('packCaches, restoreCaches, disk: DISK'));
  vm.runInContext(source, context); const messages = [];
  context.scope = {postMessage(message) {messages.push(structuredClone(message));}};
  vm.runInContext('YardEngine.listenWorker(scope)', context);
  context.scope.onmessage({data: {type: 'update', gen: 1, designId: 'trench-cache', reset: true, what: ['all'], state: C.publicJSON(x.ship), statsDelay: 0}});
  for (let i = 0; i < 2000 && !messages.some(m => m.type === 'stats'); i++) await new Promise(resolve => setTimeout(resolve, 2));
  const error = messages.find(m => m.type === 'error'); assert.equal(error, undefined, error?.message);
  const geometry = messages.findLast(m => m.type === 'geometry' && m.caches), stats = messages.find(m => m.type === 'stats');
  assert.ok(geometry && stats); assert.ok(geometry.caches.ship._trenchRows);
  const client = JSON.parse(geometry.state); for (const f of client.fits) delete f.trenchCharge;
  context.client = client; context.packed = geometry.caches;
  assert.equal(vm.runInContext('YardEngine.restoreCaches(client, packed)', context), true);
  client._client = true;
  assert.equal(C.weaponCapacitors(client).filter(p => p.trenchChargeRow).length, 2);
  assert.equal(C.bulkTrenchGroups(client).filter(g => g.valid).length, 4);
  near(stats.profile.surface.mounts.reduce((n, m) => n + m.capacity, 0), x.profile.surface.mounts.reduce((n, m) => n + m.capacity, 0));
  const counts = [{kind: 'pd', count: 102}], before = C.publicJSON(x.ship);
  context.scope.onmessage({data: {type: 'trenchArmament', id: 9, gen: 1, designId: 'trench-cache', operationId: 'change', state: before, request: {hostId: 'hull', trenchId: x.ship.trenches[0].id, counts}}});
  for (let i = 0; i < 1000 && !messages.some(m => m.type === 'trenchArmament'); i++) await new Promise(resolve => setTimeout(resolve, 2));
  const strict = messages.find(m => m.type === 'trenchArmament'); assert.equal(strict?.result?.ok, true, strict?.result?.error);
  assert.equal(C.publicJSON(x.ship), before); assert.equal(JSON.parse(strict.state).fits.length, 2);
});
