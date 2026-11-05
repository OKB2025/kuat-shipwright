const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({console: {...console, warn() {}}, performance: {now: () => 0}});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
const C = vm.runInContext('Core', context), app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');

test('the designer tabs: 表面 is a sub-menu of 編集, 搭載 and 地上部隊 are gone', () => {
  const tabs = app.match(/const TABS = (\[.*\]);/)[1];
  assert.doesNotMatch(tabs, /'surface'|'launch'|'ground'/);
  assert.match(app, /const EDIT_SUB = \[\['edit', '部品'\], \['surface', '表面'\]\];/);
});

test('spacecraft have no keel; the framing carries the strength and its mass', () => {
  assert.equal(C.KEELS, undefined); assert.equal(C.keelAt, undefined);
  const ship = C.buildDesign('sample'), S = C.computeStats(ship);
  assert.equal('keel' in ship, false, 'new designs carry no keel field');
  assert.ok(S.framingMass > 0 && S.framingMass < S.mass * 0.2, 'the stiffening frames add a share of the mass');
  assert.ok(S.structG > 0 && !S.cutSection, 'the framing gives every section strength');
  const saved = C.serialize(ship), loaded = C.deserialize({...(typeof saved === 'string' ? JSON.parse(saved) : saved), keel: 'heavy'});
  assert.equal('keel' in loaded, false, 'an old saved keel is ignored');
});

test('inspection links never send the player to 系統', () => {
  for (const k of ['sample', 'frigate', 'craft_xwing']) {
    const S = C.computeStats(C.buildDesign(k));
    for (const w of S.warnings) for (const t of w.targets || []) assert.notEqual(t.tab, 'systems', `${k}: ${w.text}`);
    for (const w of S.warnings) for (const t of w.targets || []) assert.ok(!('partId' in t), 'targets name parts as {list, id}');
  }
});
