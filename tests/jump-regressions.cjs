const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const {Rts: R, YardFleetData} = vm.runInContext('({Rts, YardFleetData})', context);

function scenario(keys = ['mc80home', 'cr90']) {
  const designs = [...new Set([...keys, 'imperial'])].map(k => JSON.parse(JSON.stringify(YardFleetData.designs[k])));
  const w = R.createWorld({
    mode: 'test', region: 'kuat', seed: 13, designs,
    sides: [{faction: 'rebel', ai: false}, {faction: 'empire', ai: false}],
    fleets: [keys.map((design, i) => ({design, tg: i + 1})), [{design: 'imperial'}]]
  });
  const groups = [...w.groups.values()].filter(g => g.side === 0);
  const ctg = [...w.ctgs.values()].find(c => c.side === 0);
  const from = groups[0].sys, edge = w.sector.edges[w.sector.systems[from].links[0]];
  return {w, groups, ctg, to: edge.a === from ? edge.b : edge.a};
}

function arrivals({w, groups, to}, limit = 500) {
  const times = new Map();
  while (w.time < limit && times.size < groups.length) {
    R.tick(w, R.TICK);
    for (const g of groups) if (g.sys === to && !times.has(g.id)) times.set(g.id, w.time);
  }
  assert.equal(times.size, groups.length, 'every group must complete its jump');
  return groups.map(g => times.get(g.id));
}

test('single-group ETA includes turning and matches the real preparation and arrival', () => {
  const s = scenario(['mc80home']), g = s.groups[0];
  const estimate = R.etaTo(s.w, g.id, s.to), ordered = R.orderJump(s.w, g.id, s.to);
  assert.equal(ordered.ok, true);
  assert.ok(g.spool.need > 8, 'this starting heading needs longer than the minimum preparation');
  assert.equal(estimate, ordered.eta);
  R.tick(s.w, R.TICK);
  assert.equal(R.etaTo(s.w, g.id, s.to), estimate - R.TICK, 'an active preparation reports its remaining time');
  const [actual] = arrivals(s);
  assert.ok(actual >= estimate && actual - estimate < 2 * R.TICK, `ETA ${estimate}, arrival ${actual}`);
});

test('natural mixed-speed task groups actually arrive together', () => {
  const s = scenario(), estimate = Math.max(...s.groups.map(g => R.etaTo(s.w, g.id, s.to)));
  const ordered = R.orderCtgJump(s.w, s.ctg.id, s.to, true);
  assert.equal(ordered.ok, true);
  assert.equal(ordered.n, 2);
  assert.equal(ordered.eta, estimate);
  const times = arrivals(s);
  assert.ok(Math.max(...times) - Math.min(...times) <= R.TICK, `arrivals: ${times}`);
  assert.ok(Math.max(...times) - estimate < 2 * R.TICK);
});

test('synchronization also waits for differences smaller than thirty seconds', () => {
  const s = scenario(['mc80home', 'mc80home']);
  const a = s.w.sector.systems[s.groups[0].sys].pos, b = s.w.sector.systems[s.to].pos;
  const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
  s.groups.forEach((g, i) => { s.w.units.get(g.flag).yaw = heading + i * 1.5; });
  const estimates = s.groups.map(g => R.etaTo(s.w, g.id, s.to));
  const gap = Math.abs(estimates[0] - estimates[1]);
  assert.ok(gap > R.TICK && gap < 30, `preparation difference: ${gap}`);
  assert.equal(R.orderCtgJump(s.w, s.ctg.id, s.to, true).ok, true);
  const times = arrivals(s);
  assert.ok(Math.abs(times[0] - times[1]) <= R.TICK, `arrivals: ${times}`);
});

test('independent jumps retain their individual arrival times', () => {
  const s = scenario(), estimates = s.groups.map(g => R.etaTo(s.w, g.id, s.to));
  assert.equal(R.orderCtgJump(s.w, s.ctg.id, s.to, false).ok, true);
  s.groups.forEach((g, i) => assert.equal(g.spool.need + g.spool.trip, estimates[i]));
  const times = arrivals(s);
  times.forEach((t, i) => assert.ok(t >= estimates[i] && t - estimates[i] < 2 * R.TICK));
  assert.ok(Math.abs(times[0] - times[1]) > 30);
});

test('ETA and orders share battle preparation and towing travel penalties', () => {
  const s = scenario(), [g, other] = s.groups;
  assert.equal(R.mergeGroups(s.w, g.id, other.id), true);
  const carrier = s.w.units.get(g.flag), tow = s.w.units.get(other.flag);
  tow.out = 'engine';tow.towedBy = carrier.id;
  carrier.tractor = {target: tow.id, mode: 'tow', lock: true};
  s.w.battles.set(g.sys, {sys: g.sys, t0: 0, log: [], sides: [0, 1]});
  const route = R.routePath(s.w.sector, g.sys, s.to);
  const estimate = R.etaTo(s.w, g.id, s.to), ordered = R.orderJump(s.w, g.id, s.to);
  assert.equal(ordered.ok, true);
  assert.equal(estimate, ordered.eta);
  assert.ok(g.spool.need >= R.RULES.withdrawSpool);
  assert.equal(g.spool.trip, R.pathSeconds(route, R.unitHyper(carrier)) * 1.25);
});

test('a ship left behind without a hyperdrive does not inflate the turning ETA', () => {
  const s = scenario(), [g, other] = s.groups;
  assert.equal(R.mergeGroups(s.w, g.id, other.id), true);
  const stranded = s.w.units.get(other.flag);
  stranded.info.hyper = null;stranded.p.turnRate = .005;stranded.yaw += Math.PI;
  const estimate = R.etaTo(s.w, g.id, s.to), ordered = R.orderJump(s.w, g.id, s.to);
  assert.equal(ordered.ok, true);
  assert.equal(estimate, ordered.eta);
  assert.notEqual(stranded.group, g.id);
});

test('an onward ETA in hyperspace uses the heading on arrival', () => {
  const s = scenario(['mc80home']), g = s.groups[0], from = g.sys;
  const next = s.w.sector.systems[s.to].links.map(i => s.w.sector.edges[i])
    .map(e => e.a === s.to ? e.b : e.a).find(id => id !== from);
  assert.notEqual(next, undefined);
  assert.equal(R.orderJump(s.w, g.id, s.to).ok, true);
  while (!g.transit && s.w.time < 100) R.tick(s.w, R.TICK);
  assert.ok(g.transit);
  const started = s.w.time, estimate = R.etaTo(s.w, g.id, next);
  while (g.transit && s.w.time < 500) R.tick(s.w, R.TICK);
  assert.equal(g.sys, s.to);
  const onward = R.orderJump(s.w, g.id, next);
  assert.equal(onward.ok, true);
  assert.ok(Math.abs(estimate - (s.w.time - started + onward.eta)) <= R.TICK);
});
