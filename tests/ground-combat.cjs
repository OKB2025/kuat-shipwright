const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
function runtime(lang = false) {
  const context = vm.createContext({console, navigator: {language: 'en-US'}});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', ...(lang ? ['js/lang-en.js', 'js/i18n.js'] : [])]) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
  return vm.runInContext('({C:Core,R:Rts,G:Ground,D:YardFleetData.designs,I:globalThis.KSI18n})', context);
}
const plain = v => JSON.parse(JSON.stringify(v));
const walker = {platform: 'walker', name: 'Test Walker', drive: 'legs2', body: {L: 6, W: 4, H: 3.5, form: 'box'}, legH: 5.5, armor: {front: 12, side: 8, rear: 6}, weapons: [{k: 'claserH', scale: .9, count: 1, mount: 'chin'}], crew: 2};

test('vehicle designs save and load unchanged, and bad input is cleaned', () => {
  const {G} = runtime(), d = G.normalizeVehicleDesign({...walker, id: 'vd-1'});
  assert.deepEqual(G.normalizeVehicleDesign(plain(d)), d, 'a saved design reads back identically');
  assert.equal(d.format, G.VD_FORMAT);assert.equal(d.version, G.VD_VERSION);
  assert.equal(G.normalizeVehicleDesign(null), null);assert.equal(G.normalizeVehicleDesign({format: 'other'}), null);
  const odd = G.normalizeVehicleDesign({platform: 'vehicle', drive: 'legs4', body: {L: 1e6, W: -3, H: 'x'}, armor: {front: 999}, weapons: [{k: 'nope'}, {k: 'cturret', count: 99, mount: 'x'}], crew: -4, junk: 1});
  assert.equal(odd.drive, 'tracks', 'a drive of the other platform falls back to the platform default');
  assert.equal(odd.body.L, G.VD_LIMITS.L[1]);assert.equal(odd.body.W, G.VD_LIMITS.W[0]);assert.equal(odd.armor.front, G.VD_LIMITS.armor[1]);
  assert.deepEqual(plain(odd.weapons), [{k: 'cturret', scale: 1, count: G.VD_LIMITS.count, mount: 'turret'}]);
  assert.equal(odd.crew, 0);assert.equal('junk' in odd, false);
  assert.equal(G.normalizeVehicleDesign({...walker, reactor: 'auto'}).reactor, null);
});

test('vehicle stats follow the design: armour, power, drive and weapon scale', () => {
  const {G, C} = runtime(), base = G.vehicleStats(walker);
  assert.ok(base.mass > 0 && base.speed > 0 && base.hp > 0 && base.cost.total > 0);
  assert.ok(base.cost.by.weapons > 0, 'weapons are priced with the shared cost model');
  const heavy = G.vehicleStats({...walker, armor: {front: 40, side: 30, rear: 20}});
  assert.ok(heavy.mass > base.mass && heavy.speed < base.speed, 'armour adds mass and costs speed');
  const weak = G.vehicleStats({...walker, reactor: .1});
  assert.ok(weak.power.ratio < 1 && weak.speed < base.speed && weak.warnings.some(w => w.lv === 'bad'));
  const big = G.groundWeapon('claserH', 2), small = G.groundWeapon('claserH', .5);
  assert.ok(big.pen > small.pen && big.range > small.range, 'the fittings scale through Core.fitSpec');
  assert.equal(G.groundWeapon('ctorp').ammo, C.FITS.ctorp.store.slots, 'launchers carry their magazine');
  for (const k of G.EXAMPLE_KEYS) {
    const e = G.exampleDesign(k), s = G.vehicleStats(e);
    assert.deepEqual(s.dims, C.VEHICLE_TYPES[k].dims.map(v => Math.round(v * 100) / 100), k + ' keeps the type dimensions');
    assert.equal(s.crew, C.VEHICLE_TYPES[k].crew || 0);
  }
  const atst = G.vehicleStats(G.exampleDesign('atst')), atat = G.vehicleStats(G.exampleDesign('atat'));
  assert.ok(atst.speed > atat.speed && atat.hp > atst.hp && atat.armor.front > atst.armor.front);
  assert.ok(Math.abs(atst.speed - 90) < 20 && Math.abs(atat.speed - 60) < 15, 'the canon walker speeds are roughly kept');
});

test('a designed vehicle registers as a vehicle type, rides in companies and survives a reload', () => {
  const a = runtime(), key = a.G.registerVehicleDesign(walker);
  assert.match(key, /^vd[0-9a-z]+$/);assert.equal(a.G.registerVehicleDesign(plain(walker)), key, 'the same design has one key');
  assert.notEqual(a.G.vehicleKey({...walker, legH: 7}), key, 'a changed design is a new type');
  assert.deepEqual(a.R.VEHICLES[key].dims, a.G.vehicleStats(walker).dims);
  const reg = a.R.makeRegiment('republic', 'R');reg.battalions[0].companies[0].vehicles = {[key]: 3};reg.battalions[0].companies[0].vdesigns = {[key]: a.R.VEHICLES[key].design};
  assert.equal(a.R.regimentTotals(reg).vehicles[key], 3);
  // A fresh page: the company's snapshot registers the type again.
  const b = runtime(), saved = plain(reg);assert.equal(b.R.VEHICLES[key], undefined);
  assert.equal(b.R.regimentTotals(saved).vehicles[key], 3);assert.ok(b.R.VEHICLES[key]);
  const st = b.R.shipStow(b.D.acclamator.info, [], [], [saved]);assert.ok(st.vehicles.some(v => v.type === key && v.embarked === 3), 'stowed by its box like the built-in types');
  const forces = b.G.forcesFromRegiments([saved], 'republic', 'ship');assert.ok(forces.some(f => f.kind === 'veh' && f.key === key && f.n === 3));
});

test('a ground battle replays exactly from its seed', () => {
  const {G} = runtime(), run = seed => { const b = G.createBattle(G.drillConfig({seed})); G.autoResolve(b); return JSON.stringify(G.summary(b)); };
  assert.equal(run(11), run(11));
  const {G: G2} = runtime();const b2 = G2.createBattle(G2.drillConfig({seed: 11}));G2.autoResolve(b2);assert.equal(JSON.stringify(G2.summary(b2)), run(11), 'and in another runtime');
  assert.notDeepEqual(Array.from(G.makeMap(11, 2).t), Array.from(G.makeMap(12, 2).t));
  const b = G.createBattle(G.drillConfig({seed: 11}));G.autoResolve(b);const r = b.result;
  assert.ok(r && [0, 1].includes(r.winner) && G.REASONS[r.reason] && r.time <= b.timeLimit + 1);
  for (const s of r.sides) assert.ok(s.troopsLost >= 0 && s.strength >= 0 && s.strength <= s.initial + 1e-9);
});

test('landing craft bring the attackers down in sorties; what does not fit stays aboard', () => {
  const {G, R} = runtime(), reg = R.makeRegiment('empire', 'R');reg.battalions = reg.battalions.slice(0, 1);
  const forces = G.forcesFromRegiments([reg], 'empire');
  const b = G.createBattle({seed: 3, sides: [{faction: 'empire', role: 'attack', forces, lift: {troops: 100, size: 50, boxes: [[1.5, 1.5, 3.3]]}}, {faction: 'rebel', role: 'defend', forces: G.garrison('rebel', 1)}]});
  assert.ok(b.sides[0].stranded.some(s => s.key === 'atat'), 'an AT-AT does not fit a speeder bike hold');
  G.start(b);G.step(b, 1);const landed = () => b.units.filter(u => u.side === 0).reduce((n, u) => n + (u.kind === 'inf' ? u.n : 0), 0);
  assert.equal(landed(), 100, 'one sortie: its troop lift');
  G.step(b, G.RULES.sortie);assert.equal(landed(), 200, 'the next sortie after RULES.sortie seconds');
  assert.ok(b.units.every(u => u.side !== 0 || !u.landed || u.pos[1] > G.MAP.H - G.LZ_ROWS * G.MAP.cell - 300), 'they land in the landing zone');
  assert.throws(() => G.createBattle({sides: [{faction: 'empire'}]}));
});

test('orders, air strikes and withdrawal', () => {
  const {G} = runtime(), b = G.createBattle(G.drillConfig({seed: 5}));
  G.deploy(b, 0, 600);assert.equal(b.sides[0].lz, 600);G.start(b);G.step(b, 2);
  const mine = b.units.filter(u => u.side === 0 && u.landed && u.n > 0), foe = b.units.find(u => u.side === 1);
  assert.ok(mine.length > 0);
  assert.equal(G.order(b, [mine[0].id], {type: 'move', to: [1500, 1000]}), 1);assert.equal(mine[0].order.type, 'move');
  assert.equal(G.order(b, [mine[0].id], {type: 'attack', target: foe.id}), 1);assert.equal(mine[0].order.target, foe.id);
  assert.equal(G.order(b, [mine[0].id], {type: 'capture', obj: 2}), 1);assert.equal(mine[0].order.obj, 2);
  assert.equal(G.order(b, [mine[0].id], {type: 'fly'}), 0, 'unknown orders are refused');
  assert.equal(G.order(b, [foe.id], {type: 'hold'}), 1, 'the API is side-blind; the screen only offers own units');
  assert.ok(G.airStrike(b, 0, [800, 500]));assert.equal(G.airStrike(b, 0, [800, 500]), false, 'one strike per cooldown');
  b.sides[0].air.ready = 0;assert.ok(G.airStrike(b, 0, [800, 500]));b.sides[0].air.ready = 0;assert.ok(G.airStrike(b, 0, [800, 500]));
  b.sides[0].air.ready = 0;assert.equal(G.airStrike(b, 0, [800, 500]), false, 'no sorties left');
  assert.ok(b.orders.move && b.orders.attack && b.orders.capture && b.orders.air && b.orders.deploy);
  G.step(b, 30);assert.ok(b.fx.length >= 0);
  assert.ok(G.withdraw(b, 0));assert.equal(b.result.winner, 1);assert.equal(b.result.reason, 'withdraw');assert.equal(G.withdraw(b, 0), false);
});

test('losses are written back to the regiments they came from', () => {
  const {G, R} = runtime(), reg = R.makeRegiment('republic', 'R'), other = R.makeRegiment('republic', 'S');reg.battalions = reg.battalions.slice(0, 1);
  const b = G.createBattle({seed: 9, sides: [{faction: 'republic', role: 'attack', forces: G.forcesFromRegiments([reg], 'republic', 'A'), lift: null}, {faction: 'cis', role: 'defend', forces: G.garrison('cis', 3)}]});
  G.autoResolve(b);const before = R.regimentTotals(plain(reg)), out = G.applyLosses(b, 0, [reg], 'A'), after = R.regimentTotals(reg);
  assert.equal(before.troops - after.troops, out.troops);assert.equal(out.troops, b.result.sides[0].troopsLost);
  for (const [k, n] of Object.entries(out.vehicles)) assert.equal(before.vehicles[k] - (after.vehicles[k] || 0), n);
  const o2 = plain(other);G.applyLosses(b, 0, [other], 'B');assert.deepEqual(plain(other), o2, 'units of another tag are left alone');
});

test('a fleet battle landing needs space superiority and takes the world when won', () => {
  const {G, R, D} = runtime(), acc = plain(D.acclamator), ven = plain(D.venator), reg = R.makeRegiment('republic', 'R');
  const w = R.createWorld({mode: 'test', sensors: false, region: 'kuat', seed: 13, designs: [acc, ven], sides: [{faction: 'republic', ai: false}, {faction: 'cis', ai: true}], fleets: [[{design: 'acclamator', ground: [reg], air: [{craft: 'laat', n: 12}, {craft: 'laatc', n: 4}]}], [{design: 'venator'}]]});
  const g = [...w.groups.values()].find(x => x.side === 0), foe = [...w.units.values()].find(u => u.side === 1);
  const sys = w.sector.systems.find(s => s.pop > 0 && s.planet?.kind !== 3 && !R.systemUnits(w, s.id).length);
  const put = (units, id) => { for (const u of units) u.sys = id; };
  g.sys = sys.id;put(g.units.map(id => w.units.get(id)), sys.id);for (const q of w.squads.values()) if (q.side === 0) q.sys = sys.id;
  const fsys = foe.sys;foe.sys = sys.id;assert.equal(G.landingCheck(w, g.id).why, 'enemy', 'no landing under enemy guns');foe.sys = fsys;
  const c = G.landingCheck(w, g.id);assert.ok(c.ok, JSON.stringify(c.why));assert.equal(c.troops, R.regimentTotals(reg).troops);assert.ok(c.lift.troops >= 30 * 12, 'the gunships carry the troops');
  const r = G.orderLanding(w, g.id);assert.ok(r.ok);assert.equal(G.landingCheck(w, g.id).why, 'busy');
  assert.ok(r.landing.b.sides[0].air.sorties > 0, 'the gunships fly air support');
  let n = 0;while (!r.landing.done && n++ < 5000) R.step(w, 10);
  assert.ok(r.landing.done, 'fought out on the fleet battle clock');
  assert.ok(w.events.some(e => e.landing && e.sys === sys.id));
  if (r.landing.b.result.winner === 0) { assert.equal(sys.held, 0); assert.equal(G.landingCheck(w, g.id).why, 'held'); }
  assert.ok(R.regimentTotals(reg).troops <= c.troops, 'the regiment carries its losses');
});

test('ground combat labels translate to English', () => {
  const {G, R, I} = runtime(true), jp = /[぀-ヿ㐀-鿿]/, ok = s => { const o = I.t(s); assert.doesNotMatch(o, jp, s + ' => ' + o); return o; };
  for (const x of [...Object.values(G.PLATFORMS).flatMap(p => [p.name, p.note]), ...Object.values(G.DRIVES).map(d => d.name), ...Object.values(G.BODY_FORMS).map(f => f.name), ...Object.values(G.MOUNTS).map(m => m.name),
    ...Object.values(G.ORDER_TYPES), ...Object.values(G.REASONS), ...Object.values(G.LANDING_WHY), ...G.DRILL_STEPS.map(s => s[1]), ...G.TERRAIN.map(t => t.name)]) ok(x);
  for (const k of G.EXAMPLE_KEYS) { const s = G.vehicleStats(G.exampleDesign(k)); ok(s.design.name); for (const w of s.warnings) ok(w.text); }
  ok(G.vehicleStats({...walker, reactor: .1}).warnings[0].text);
  const b = G.createBattle(G.drillConfig({seed: 2}));G.autoResolve(b);ok(G.resultText(b));for (const e of b.log) ok(e.text);
  assert.equal(I.t('{0}揚陸作戦'.replace('{0}', 'クワット')), 'Landing on Kuat');
  ok(`${R.FACTIONS.republic.name}：戦死・損失 12 名`);ok('目標 確保・未確保・確保');ok('144 名（未着 30）');
});
