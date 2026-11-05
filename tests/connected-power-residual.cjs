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
const C = vm.runInContext('Core', context);
const sum = values => values.reduce((a, b) => a + b, 0);
const tolerance = value => Math.max(1, Math.abs(value)) * 1e-11;
const near = (actual, expected) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance(expected),
  `${actual} != ${expected}`,
);
const loads = scale => [
  {id: 'left', port: 'left', domain: 'main', kind: 'engines', requestedInputW: 2 * scale},
  {id: 'right', port: 'right', domain: 'main', kind: 'engines', requestedInputW: .7 * scale},
];

function conserve(result, requested) {
  near(result.draw, sum(Object.values(result.granted)));
  near(result.draw, sum(result.sources.map(s => s.drawW)));
  for (const load of requested) {
    const grant = result.granted[load.id], funding = result.funding[load.id];
    assert.ok(grant >= 0 && grant <= load.requestedInputW + tolerance(load.requestedInputW));
    near(grant, sum(Object.values(funding)));
  }
  for (const source of result.sources) {
    const funded = sum(Object.values(result.funding).map(f => f[source.id] || 0));
    near(funded, source.drawW);
    assert.ok(funded >= 0 && funded <= source.availableW + tolerance(source.availableW));
  }
}

test('rounding residue in a spent source cannot hide another connected reactor', () => {
  // At fighter-scale wattages, the first proportional round can leave 128 W
  // in reactor a. That residue must not prevent using reactor b's 2e18 W.
  for (const scale of [1, 1e9, 1e18]) {
    const requested = loads(scale), result = C.allocateConnectedPower({
      sources: [{id: 'a', powerW: 1.9 * scale}, {id: 'b', powerW: 2 * scale}],
      loads: requested,
    });
    near(result.granted.left, 2 * scale);
    near(result.granted.right, .7 * scale);
    near(result.draw, 2.7 * scale);
    assert.ok(result.funding.left.b > 0 && result.funding.right.b > 0);
    conserve(result, requested);
  }
});

test('rounding residue in a saturated trunk cannot hide an alternate supply path', () => {
  const scale = 1e18, requested = loads(scale);
  const result = C.allocateConnectedPower({
    sources: [{id: 'a', powerW: 10 * scale}, {id: 'b', powerW: 2 * scale}],
    links: [
      {from: 'a', to: 'bus', cap: 1.9 * scale},
      {from: 'b', to: 'bus', cap: 2 * scale},
      {from: 'bus', to: 'left', cap: 3 * scale},
      {from: 'bus', to: 'right', cap: 3 * scale},
    ],
    loads: requested,
  });
  near(result.granted.left, 2 * scale);
  near(result.granted.right, .7 * scale);
  const firstTrunk = sum(Object.values(result.funding).map(f => f.a || 0));
  const secondTrunk = sum(Object.values(result.funding).map(f => f.b || 0));
  assert.ok(firstTrunk <= 1.9 * scale + tolerance(scale));
  assert.ok(secondTrunk <= 2 * scale + tolerance(scale));
  assert.ok(secondTrunk > 0);
  conserve(result, requested);
});

test('scarce parallel supply stays proportional and conserved under reordered loads and sources', () => {
  const scale = 1e18, requested = loads(scale);
  const sources = [{id: 'a', powerW: 1.9 * scale}, {id: 'b', powerW: .4 * scale}];
  for (const sourceOrder of [sources, sources.slice().reverse()]) {
    for (const loadOrder of [requested, requested.slice().reverse()]) {
      const result = C.allocateConnectedPower({sources: sourceOrder, loads: loadOrder});
      near(result.draw, 2.3 * scale);
      near(result.granted.left, 2 * scale * 2.3 / 2.7);
      near(result.granted.right, .7 * scale * 2.3 / 2.7);
      near(result.granted.left / (2 * scale), result.granted.right / (.7 * scale));
      conserve(result, loadOrder);
    }
  }
});
