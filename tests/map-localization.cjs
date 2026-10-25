const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const c = vm.createContext({console, navigator: {language: 'en-US'}});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/lang-en.js', 'js/i18n.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, {filename: file});
}
const {Galaxy: G, Rts: R} = vm.runInContext('({Galaxy, Rts})', c);
const jp = /[\u3040-\u30ff\u3400-\u9fff]/;
const translated = text => assert.doesNotMatch(c.KSI18n.t(text), jp, text);

test('all galaxy systems, regions, eras, theaters and their descriptions have English labels', () => {
  const before = JSON.stringify(G.SYSTEMS);
  for (const collection of [G.SYSTEMS, Object.values(G.REGIONS), G.ZONES, G.ROUTES, Object.values(G.ERAS), Object.values(G.POWERS), Object.values(G.BATTLES), G.THEATERS]) {
    for (const row of collection) for (const key of ['name', 'short', 'note', 'battle', 'era']) {
      if (row[key]) translated(row[key]);
    }
  }
  for (const def of Object.values(R.REGIONS)) {
    translated(def.name); translated(def.note);
    for (const route of def.routes) { translated(route.name); route.ends.forEach(translated); }
    const ends = def.routes[0]?.ends?.filter(Boolean) || [];
    translated(`${def.note}。主要幹線：${def.routes.map(r => r.name).join('／')}${ends.length ? '（' + ends.join('〜') + '）' : ''}。`);
  }
  assert.equal(JSON.stringify(G.SYSTEMS), before, 'localization must not change map data');
  c.KSI18n.setLanguage('ja');
  assert.equal(c.KSI18n.t(G.BY.coruscant.note), G.BY.coruscant.note);
  c.KSI18n.setLanguage('en');
});

test('mission cards and navigation translate composed labels', () => {
  for (const s of G.SYSTEMS) {
    const reg = G.REGIONS[s.region], bt = G.BATTLES[s.key];
    translated(`${reg.name} · グリッド ${G.grid(s.at)}${s.approx ? '（推定）' : ''}`);
    translated(`支線：${s.links.map(k => G.BY[k].name).join('・')}`);
    translated(`パトロール · ${s.name}から出発`);
    if (bt) {
      translated(`戦史：${bt.name}（${bt.era}）`);
      translated(`${bt.name}の陣営で始まります：自軍 ${R.FACTIONS[bt.own].name} · 敵軍 ${R.FACTIONS[bt.foe].name}（出撃準備で変えられます）。`);
    }
    const theaters = G.THEATERS.filter(t => G.theaterBox(t).keys.includes(s.key));
    if (theaters.length) translated('戦域：' + theaters.map(t => `${t.name}（${G.ERAS[t.era].short}）`).join('・'));
    translated(`離脱して${s.name}へジャンプ（12 秒）`);
  }
  for (const text of ['この宙域で出撃準備へ', '銀河内戦', 'クローン戦争の勢力', '全体']) translated(text);
});

const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
vm.runInContext('const T = s => KSI18n.t(s); const esc = s => String(s);\n' + app.slice(app.indexOf('const VOY_CIS_RENAME ='), app.indexOf('// ---------- the order of battle')), c);
test('all generated ship names and Roman-numeral suffixes translate without changing saved names', () => {
  for (const design of Object.values(vm.runInContext('YardFleetData.designs', c))) translated(design.name.split('｜')[0]);
  const names = vm.runInContext('Object.values(VOY_SHIPNAMES).flat()', c);
  for (const name of names) {
    c.nameRow = {name};
    translated(name); translated(name + ' III');
    assert.doesNotMatch(vm.runInContext('voyDisplayName(nameRow)', c), jp);
    assert.equal(c.nameRow.name, name);
  }
  c.nameRow = {name: 'ドーントレス'};
  assert.equal(vm.runInContext('voySetName(nameRow, "Dauntless")', c), false);
  assert.equal(c.nameRow.name, 'ドーントレス');
  assert.equal(vm.runInContext('voySetName(nameRow, "私の旗艦")', c), true);
  assert.equal(vm.runInContext('voyDisplayName(nameRow)', c), '私の旗艦');
  assert.equal(vm.runInContext('voySetName(nameRow, "リバティ")', c), true);
  assert.equal(vm.runInContext('voyDisplayName(nameRow)', c), 'リバティ', 'explicit custom names remain verbatim even if in the default pool');
  c.KSI18n.setLanguage('ja');
  assert.equal(vm.runInContext('voyDisplayName(nameRow)', c), 'リバティ');
  c.KSI18n.setLanguage('en');
});

test('loading an order of battle preserves explicit names and copying generates a localizable default', () => {
  vm.runInContext(app.slice(app.indexOf('function voyRenameCis(d)'), app.indexOf('function voyOrbatSave()')) + '\n' + app.slice(app.indexOf('const voyObShips ='), app.indexOf('// Designs can be example classes')), c);
  c.legacyNames = {factions: {cis: {ctgs: [{tgs: [{ships: [
    {name: '敵対的買収 III'}, {name: '敵対的買収', customName: true}
  ]}]}]}}};
  assert.equal(vm.runInContext('voyRenameCis(legacyNames)', c), true);
  assert.equal(c.legacyNames.factions.cis.ctgs[0].tgs[0].ships[0].name, 'ホスタイル・テイクオーバー III');
  assert.equal(c.legacyNames.factions.cis.ctgs[0].tgs[0].ships[1].name, '敵対的買収');
  const copy = vm.runInContext('voyCopyShip(legacyNames.factions.cis, legacyNames.factions.cis.ctgs[0].tgs[0].ships[1], "cis")', c);
  assert.equal(copy.customName, undefined);
  translated(copy.name);
});

test('military hierarchy uses TF / CTF, with consistent air and formation terminology', () => {
  assert.equal(c.KSI18n.t('第11任務群'), 'TF-11');
  assert.equal(c.KSI18n.t('第1合同任務群'), 'CTF-1');
  assert.equal(c.KSI18n.t('任務群'), 'Task Force');
  assert.equal(c.KSI18n.t('合同任務群'), 'Combined Task Force');
  assert.equal(c.KSI18n.t('第2飛行隊'), 'Air Wing 2');
  assert.equal(c.KSI18n.t('第3戦闘機中隊'), 'Fighter Squadron 3');
  assert.equal(c.KSI18n.t('直掩'), 'Combat Air Patrol');
  assert.equal(c.KSI18n.t('一斉射'), 'Full Salvo');
  assert.equal(c.KSI18n.t('一斉射 120・電力 80'), 'Full Salvo 120 · Power 80');
  assert.match(c.KSI18n.t('直掩する味方艦をタップ'), /combat air patrol/);
  assert.equal(c.KSI18n.t('3中隊（144名）'), 'Company 3 (144 personnel)');
  assert.equal(c.KSI18n.t('A中隊（歩兵）'), 'Company A (Infantry)');
  for (const [faction, template] of Object.entries(R.REGIMENT_TEMPLATES)) {
    translated(template.name);translated('第1' + template.name);
    for (const battalion of R.makeRegiment(faction, '第1' + template.name).battalions) {
      translated(battalion.name);
      for (const company of battalion.companies) translated(company.name);
    }
  }
  for (const vehicle of Object.values(R.VEHICLES)) translated(vehicle.name);
  assert.equal(c.KSI18n.t('単縦陣'), 'Line Ahead');
  assert.equal(c.KSI18n.t('横陣'), 'Line Abreast');
  for (const section of [c.KS_EN.terms, c.KS_EN.messages]) for (const value of Object.values(section)) assert.doesNotMatch(value, /\btask groups?\b/i);
  vm.runInContext(app.match(/const voyTgShort = .*?;/)[0], c);
  assert.equal(vm.runInContext('voyTgShort("第11任務群")', c), 'TF-11');
  assert.equal(vm.runInContext('voyTgShort("第1合同任務群")', c), 'CTF-1');
});
