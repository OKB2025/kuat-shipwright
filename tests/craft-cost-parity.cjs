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
const {C, R} = vm.runInContext('({C:Core,R:Rts})', context);
const plain = value => JSON.parse(JSON.stringify(value));
const sum = object => Object.values(object).reduce((a, b) => a+b, 0);

test('equipment installation fees remain when a unit is small and apply to every design origin', () => {
  for (const key of ['gen', 'engine', 'hyper', 'lifeSupport', 'navComputer', 'maneuver']) {
    const unit = {k: key, d: 1};
    assert.equal(C.partBuildCost(unit, .01), C.COST_INSTALL[key]+.01*C.PARTS[key].cost);
    assert.equal(C.partBuildCost({...unit, reference: 'craft_xwing'}, .01), C.partBuildCost(unit, .01));
    assert.equal(C.partBuildCost(unit, 0), 0);
    assert.ok(C.partBuildCost(unit, 1) > C.partBuildCost(unit, .01));
  }
  assert.equal(C.fitBuildCost({k: 'claser'}), C.FITS.claser.cost+C.COST_MOUNT_INSTALL.claser);
});

test('engineering and equipment-list quotes have integer categories that sum exactly to their total', () => {
  for (const value of [0, .49, .5, 1.99, 999.8]) {
    const price = C.designCost({cost: value, costBy: {hull: value*.22, power: value*.33, weapons: value*.45}, crew: 1});
    assert.equal(price.build, Math.round(value));assert.equal(price.crew, 1000);assert.equal(sum(price.by), price.total);
    for (const v of Object.values(price.by)) assert.equal(Number.isInteger(v), true);
  }
  const bom = {hullVolume: 20, armorVolume: .2, parts: [{k: 'gen', volume: .1}, {k: 'engine', volume: .1, count: 2}], fits: [{k: 'claser', count: 2}], crew: 1};
  const quote = C.quoteCostBOM(bom);
  const expectedBuild = Math.round(20*C.COST_MODEL.hull+.2*C.COST_MODEL.armor+C.partBuildCost({k: 'gen'}, .1)+2*C.partBuildCost({k: 'engine'}, .1)+2*C.fitBuildCost({k: 'claser'}));
  assert.equal(quote.build, expectedBuild);assert.equal(sum(quote.by), quote.total);
  const more = C.quoteCostBOM({...bom, parts: [...bom.parts, {k: 'navComputer', volume: .01}]});
  assert.ok(more.total > quote.total, 'additional hardware is priced by the same model');
});

test('all menu aircraft quotes avoid synchronous model construction or engineering computation', () => {
  const compute = C.computeStats, build = C.buildDesign;
  C.computeStats = C.buildDesign = () => {throw new Error('Main-thread aircraft pricing built a model');};
  try {
    for (const key of Object.keys(R.CRAFT)) {
      const price = R.craftPrice(key);
      assert.ok(Number.isInteger(price.total) && price.total >= 0, key);
      assert.equal(R.craftCost(key), price.total);
      assert.equal(sum(price.by), price.total, key+' category total');
    }
  } finally {C.computeStats = compute;C.buildDesign = build;}
});

test('generated prices declare their physical blueprint and model signature', () => {
  assert.equal(C.CRAFT_PRICE_CATALOG.modelVersion, C.COST_MODEL.version);
  assert.equal(C.CRAFT_PRICE_CATALOG.modelSignature, C.costModelSignature());
  for (const [type, entry] of Object.entries(C.CRAFT_PRICE_CATALOG.entries)) {
    const price = R.craftPrice(type);
    assert.equal(price.source, 'blueprint');assert.equal(price.reference, entry.reference);assert.ok(entry.signature);
    assert.equal(entry.total, entry.build+entry.crew);assert.equal(sum(entry.by), entry.total);
  }
});

for (const reference of Object.keys(C.SHIP_EXAMPLES).filter(k => k.startsWith('craft_') && R.CRAFT[C.craftTypeOf(k)]).sort()) {
  const type = C.craftTypeOf(reference);
  test(`${type}: standard, designed and renamed copy all pay for the same installed hardware`, () => {
    const ship = C.buildDesign(reference), stats = C.computeStats(ship), price = C.designCost(stats);
    const snapshot = C.designCraftSnapshot(ship, stats, reference), registered = R.registerDesignCraft(snapshot);
    assert.equal(R.craftCost(type), price.total, 'standard catalog uses the editor price');
    assert.equal(R.craftCost(registered), price.total, 'embarking the actual design has the same price');
    const copy = C.deserialize(C.serialize(ship));copy.name = 'My copy';delete copy.reference;
    const copiedStats = C.computeStats(copy), copied = R.registerDesignCraft(C.designCraftSnapshot(copy, copiedStats, 'save:my-copy'));
    assert.equal(C.designCost(copiedStats).total, price.total);assert.equal(R.craftCost(copied), price.total);
    assert.equal(sum(stats.costBy), stats.cost);assert.deepEqual(plain(R.craftPrice(registered).by), plain(price.by));
    const systems = plain(C.cleanCraftSystems(stats.craftSystems));
    assert.deepEqual(plain(R.CRAFT[type].systems), systems, 'standard systems come from the same measured blueprint');
    assert.deepEqual(plain(R.CRAFT[registered].systems), systems, 'registering the model does not change its systems');
    assert.equal(R.CRAFT[type].systemsSource, 'blueprint');
    const stock = {id: 'stock', craft: type, n: 1, state: 'out', ldg: []}, custom = {id: 'custom', craft: registered, n: 1, state: 'out', ldg: []};
    for (const squad of [stock, custom]) {R.rearmSquad(squad);squad.dogfight = 10;}
    assert.equal(stock.laserGas, custom.laserGas);assert.equal(stock.lifeSupport, custom.lifeSupport);
    if (systems.laserUnits > 0) assert.ok(Number.isFinite(stock.laserGas) && stock.laserGas > 0, 'stock laser gas is finite');
    if (systems.crew > 0) assert.ok(Number.isFinite(stock.lifeSupport) && stock.lifeSupport > 0, 'stock life support is finite');
    const gas = stock.laserGas, life = stock.lifeSupport;
    R.squadSystemsTick({time: 10, squads: new Map([[stock.id, stock], [custom.id, custom]]), wings: new Map()}, .5);
    assert.equal(stock.laserGas, custom.laserGas);assert.equal(stock.lifeSupport, custom.lifeSupport);
    if (Number.isFinite(gas)) assert.equal(stock.laserGas, gas-.5);
    if (Number.isFinite(life)) assert.equal(stock.lifeSupport, life-.5);
  });
}

test('legacy types without a blueprint expose an estimated equipment list using the same price service', () => {
  R.CRAFT.estimateFixture = {...R.CRAFT.xwing, design: true};delete R.CRAFT.estimateFixture.cost;delete R.CRAFT.estimateFixture.snapshot;
  try {
    const price = R.craftPrice('estimateFixture');assert.equal(price.source, 'estimate');assert.equal(price.estimated, true);
    assert.ok(price.bom.parts.length > 0);assert.equal(price.total, C.quoteCostBOM(price.bom).total);
    assert.equal(sum(price.by), price.total);
  } finally {delete R.CRAFT.estimateFixture;}
});

test('table-only U-wing systems come from its estimated equipment list and have finite consumables', () => {
  const craft = R.CRAFT.uwing, systems = craft.systems;
  assert.equal(craft.systemsSource, 'estimate');assert.equal(R.craftPrice('uwing').source, 'estimate');
  assert.ok(systems.managed);assert.ok(systems.lifeSupportHours > 0 && Number.isFinite(systems.lifeSupportHours));
  assert.ok(systems.laserGasSeconds > 0 && Number.isFinite(systems.laserGasSeconds));
  const squad = {id: 'uwing', craft: 'uwing', n: 2, state: 'out', ldg: []};R.rearmSquad(squad);squad.dogfight = 10;
  const gas = squad.laserGas, life = squad.lifeSupport;
  R.squadSystemsTick({time: 10, squads: new Map([[squad.id, squad]]), wings: new Map()}, 1);
  assert.equal(squad.laserGas, gas-1);assert.equal(squad.lifeSupport, life-1);
});

test('every table-only stock aircraft declares estimated systems instead of gaining unlimited armed sorties', () => {
  for (const [type, craft] of Object.entries(R.CRAFT)) {
    if (craft.design || R.craftPrice(type).source !== 'estimate') continue;
    assert.equal(craft.systemsSource, 'estimate', type);assert.ok(craft.systems?.managed, type);
    if (craft.crew > 0) assert.ok(Number.isFinite(craft.systems.lifeSupportHours) && craft.systems.lifeSupportHours > 0, type+' life support');
    if ((craft.aa||0) > 0 || (craft.gun??craft.strike??0) > 0) assert.ok(Number.isFinite(craft.systems.laserGasSeconds) && craft.systems.laserGasSeconds > 0, type+' laser gas');
  }
});

test('explicit zero-price snapshots do not turn into estimated aircraft prices', () => {
  R.CRAFT.zeroFixture = {design: true, snapshot: {craft: {cost: 0, crew: 0, priceVersion: C.COST_MODEL.version}}};
  R.CRAFT.missingFixture = {...R.CRAFT.xwing, design: true, snapshot: {craft: {crew: 0}}};delete R.CRAFT.missingFixture.cost;
  try {
    assert.equal(R.craftCost('zeroFixture'), 0);assert.equal(R.craftPrice('zeroFixture').source, 'snapshot');
    assert.equal(R.craftPrice('missingFixture').source, 'estimate');assert.ok(R.craftCost('missingFixture') > 0);
  } finally {delete R.CRAFT.zeroFixture;delete R.CRAFT.missingFixture;}
});

test('scenario aircraft costs sum the shared price for standard and designed squadrons', () => {
  const ship = C.buildDesign('craft_xwing'), stats = C.computeStats(ship), key = R.registerDesignCraft(C.designCraftSnapshot(ship, stats, 'save:my-xwing'));
  const row = {key: 'carrier', air: [{craft: 'xwing', n: 12}, {craft: key, n: 12}], carried: []};
  const price = R.shipCost(row, () => ({info: {cost: 1000, crewNeed: 2}}));
  assert.equal(price.air, R.craftCost('xwing')*24);assert.equal(price.total, price.ship+price.air);
});
