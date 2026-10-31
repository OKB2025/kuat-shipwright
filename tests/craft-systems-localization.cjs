const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');

const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const context = vm.createContext({navigator: {language: 'en-US'}});
const run = code => vm.runInContext(code, context);
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/lang-en.js', 'js/i18n.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
}
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
function section(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  run(app.slice(a, b));
}
const jp = /[\u3040-\u30ff\u3400-\u9fff]/;
function translated(source) {
  const output = context.KSI18n.t(source);
  assert.doesNotMatch(output, jp, source + ' => ' + output);
  return output;
}
function translatedHTML(html) {
  for (const text of html.split(/<[^>]*>/)) if (text.trim()) translated(text);
  for (const match of html.matchAll(/(?:title|aria-label|aria-valuetext)="([^"]*)"/g)) translated(match[1]);
}
run(`const C=Core,R=Rts,esc=s=>String(s),num=s=>String(s),fCr=s=>s+' cr',fW=s=>s+' W',fPct=s=>Math.round(s*100)+'%';
  const trial={},notices=[],toast=s=>notices.push(s);
  let ship;
  function fixture(suit=false){
    ship=C.newShip({L:20,W:10,H:5});
    ship.parts.push({id:1,k:'cockpit',d:.8,c:[10,2,0],seats:3,suit},{id:2,k:'hyper',d:.1,c:[4,2,0]});
    ship.fits.push({id:3,k:'claser',scale:1,p:[18,4,0],a:2,base:0,ped:0});
    return C.computeStats(ship);
  }
`);
section('const CRAFT_SYSTEM_KEYS=', 'function editCockpitEquipment(');
section('function voyCraftPriceHTML(', 'function voySquadronsHTML(');
section('function trialCraftSystemsSpec()', 'function trialReset()');
section('function trialDurText(', 'function trialHyperUpdate(');
section('function voyCraftTally(', '// ---------- the 3D view:');

test('new system parts and actual installed equipment labels translate in English', () => {
  for (const key of run('CRAFT_SYSTEM_KEYS')) {
    const part = run(`C.PARTS[${JSON.stringify(key)}]`);
    translated(part.name);translated(part.desc);
  }
  const labels = run(`(()=>{
    fixture();C.installCraftSystems(ship,{mass:20,anchors:[[10,2,0]],landing:3});
    return ship.parts.filter(p=>CRAFT_SYSTEM_KEYS.includes(p.k)).map(p=>p.label);
  })()`);
  assert.ok(labels.length >= 12);
  for (const label of labels) translated(label);
  assert.equal(translated('姿勢制御スラスター 4'), 'Maneuvering Thruster 4');
  for (const label of ['歩行脚支持機構 4', '翼端着陸支持機構 2']) translated(label);
});

test('actual systems panel and cockpit editor translate every state and preserve stored values', () => {
  run('const stats=fixture();');
  translatedHTML(run('craftSystemsHTML(stats)'));
  translatedHTML(run(`craftSystemsHTML({...stats,hyperClass:null,craftSystems:{...stats.craftSystems,
    managed:false,lifeSupportHours:null,laserGasSeconds:null,navReady:true,landingReady:true}})`));
  translatedHTML(run('craftSystemsHTML({...stats,hyperClass:1,craftSystems:{...stats.craftSystems,navReady:true}})'));
  for (const suit of [false, true]) {
    context.suit = suit;
    const before = run('C.publicJSON(ship)');
    translatedHTML(run('cockpitEquipmentHTML({...ship.parts[0],suit})'));
    assert.equal(run('C.publicJSON(ship)'), before);
  }
  assert.equal(translated('3 名分 · 12.5 時間'), 'Capacity for 3 people · 12.5 h');
  assert.equal(translated('2 / 3 名'), '2 / 3 Crew');
  assert.equal(translated('600 秒の連続射撃'), '600 s of continuous fire');
  const survivalRow = run('craftSystemsHTML({...stats,craftSystems:{...stats.craftSystems,ejectionSurvival:.9}})')
    .match(/<dt>撃墜時の生還率<\/dt><dd>([^<]+)<\/dd>/);
  assert.ok(survivalRow);
  assert.equal(translated('撃墜時の生還率'), 'Survival Rate When Shot Down');
  assert.equal(translated(survivalRow[1]), '90%');
});

test('crew survival and loss totals translate actual tallies with their dynamic counts', () => {
  for (const [survived, crewLost] of [[0, 7], [12, 0], [124, 36]]) {
    context.survived = survived;context.crewLost = crewLost;
    const crew = `(Crew: Survived ${survived} · Lost ${crewLost})`;
    assert.equal(translated(run('voyCraftTally(null,0,[],[{pilotSurvived:survived,crewLost}])')), crew);
    assert.equal(translated(run('voyCraftTally(null,0,[{craftKills:3}],[{kills:5,lostN:4,pilotSurvived:survived,crewLost}])')),
      `(Kills 8 · Losses 4) ${crew}`);
  }
});

test('computed system warnings translate complete sentences and retain engineering figures', () => {
  const warnings = run('fixture().warnings.filter(w=>w.code==="craft-systems").map(w=>w.text)');
  assert.equal(warnings.length, 7, 'exercise each shortage warning from the engineering model');
  for (const source of warnings) {
    const output = translated(source);
    assert.deepEqual(output.match(/\d+(?:\.\d+)?/g), source.match(/\d+(?:\.\d+)?/g), source);
  }
  const suitWarnings = run('fixture(true).warnings.filter(w=>w.code==="craft-systems").map(w=>w.text)');
  const suit = suitWarnings.find(source => source.startsWith('宇宙服'));
  assert.ok(suit);
  assert.equal(translated(suit), '3 crew rely on spacesuits for life support (4 h without resupply).');
});

test('cost details translate blueprint, saved-design and estimated prices', () => {
  run(`R.CRAFT['i18n-snapshot']={snapshot:{craft:{cost:50000,crew:2,costBy:{power:50000}}},design:true};
    R.CRAFT['i18n-estimate']={dims:[10,8,3],size:1,aa:1,crew:1};
    R.CRAFT['i18n-total']={cost:0,design:true};`);
  try {
    for (const key of ['xwing', 'i18n-snapshot', 'i18n-estimate', 'i18n-total']) {
      context.craftKey = key;
      translatedHTML(run('voyCraftPriceHTML({craft:craftKey})'));
    }
  } finally {
    run(`for(const key of ['i18n-snapshot','i18n-estimate','i18n-total'])delete R.CRAFT[key];`);
  }
  for (const source of app.matchAll(/toast\('(機体の価格[^']+)'\)/g)) translated(source[1]);
});

test('actual sortie consumable displays, low-life warnings and empty-gas notices translate', () => {
  for (const suit of [false, true]) {
    context.suit = suit;
    run(`trial.craft=true;trial.spectate=false;notices.length=0;
      trial.p={systems:{managed:true,crew:1,suitSeats:suit?1:0,lifeSupportHours:1,laserUnits:1,laserGasSeconds:2}};
      trialCraftSystemsReset();`);
    const before = run('JSON.stringify(trial.p.systems)');
    translatedHTML(run('trialCraftSystemsHTML()'));
    run('trialCraftSystemsStep(3500);');
    translated(run('trialCraftSystemsWarning()'));
    translatedHTML(run('trialCraftSystemsHTML()'));
    run('trialCraftSystemsStep(100);trialCraftGasTake({k:"claser",power:C.FITS.claser.power,cycle:2},1);');
    translated(run('trialCraftSystemsWarning()'));
    translatedHTML(run('trialCraftSystemsHTML()'));
    assert.equal(run('notices.length'), 3);
    for (const source of run('notices')) translated(source);
    assert.equal(run('JSON.stringify(trial.p.systems)'), before);
    run('trial.systemsRuntime.lifeSeconds=null;trial.systemsRuntime.gasSeconds=null;');
    translatedHTML(run('trialCraftSystemsHTML()'));
  }
});
