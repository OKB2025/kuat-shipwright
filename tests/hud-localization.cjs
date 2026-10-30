const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const c = vm.createContext({navigator: {language: 'en-US'}});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/lang-en.js', 'js/i18n.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, {filename: file});
}
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
function section(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  vm.runInContext(app.slice(a, b), c);
}
vm.runInContext(`const C=Core, T=s=>KSI18n.t(s), esc=s=>String(s), num=s=>String(s), LIGHT=299792458;
 const trial={p:{name:'インペリアルI級｜重砲戦艦'},launchers:[],powerMode:'balanced',camMode:'ship',gunMode:'free',gun:{},pat:{civ:[]},vf:20000000};
 const ship=null, JUMP={spool:5};
 const trialCamName=()=> '追従', trialSwKinds=()=>['sbeam','hion'];
 // This fixture exercises hull names and generic HUD labels; articulated controls are tested in trial-foils.cjs.
 const trialFoilButtonHTML=()=>'',trialHasFoils=()=>false;
 const trialSys=()=>trial.sys||({name:'コルサント',planet:{ring:false}});
 const window=globalThis;
`, c);
vm.runInContext(app.match(/const TRIAL_TELEGRAPH=.*?;/)[0],c);
section('const GUN_MODES=', 'const trial=');
section('function trialWhere()', '// Flagship status');
section('function trialHudHTML()', 'function trialBindHud(');
section('function trialHyperText(', 'function trialHyperUpdate(');
section('function statusFlagsHTML(', 'function trialSelfUpdate(');
section('function patrolMarks(', 'function patrolHud(');
section('function trialSwRecord()', 'window.__trialJump=');
const jp = /[\u3040-\u30ff\u3400-\u9fff]/;
function translated(source) {
  const result = c.KSI18n.t(source);
  assert.doesNotMatch(result, jp, source + ' => ' + result);
  return result;
}
// Inspect complete text nodes and accessible attributes, as the DOM localizer does.
function translatedHTML(html) {
  for (const text of html.split(/<[^>]*>/)) if (text.trim()) translated(text);
  for (const m of html.matchAll(/(?:title|aria-label|aria-valuetext)="([^"]*)"/g)) translated(m[1]);
}

test('piloting HUD translates complete design names, controls, power menus and keyboard help', () => {
  for (const design of Object.values(vm.runInContext('YardFleetData.designs', c))) {
    c.shipName = design.name;
    vm.runInContext('trial.p.name=shipName', c);
    translatedHTML(vm.runInContext('trialHudHTML()', c));
    assert.equal(vm.runInContext('trial.p.name', c), design.name, 'display translation must preserve design data');
  }
  assert.equal(c.KSI18n.t('取舵一杯'), 'Hard to Port');
  assert.equal(c.KSI18n.t('面舵一杯'), 'Hard to Starboard');
  assert.equal(c.KSI18n.t('舵中央'), 'Midships');
  assert.equal(c.KSI18n.t('方位'), 'Heading');
  assert.equal(c.KSI18n.t('ロール'), 'Roll');
  assert.equal(c.KSI18n.t('傾斜'), 'Slope', 'hull geometry must retain its own terminology');
});

test('civilian and disabled-ship brackets translate actual generated marker labels', () => {
  section('const PATROL_CIV =', '// The traffic of each era');
  vm.runInContext(app.match(/const PATROL_NAMES = \[[^;]+;/)[0], c);
  const labels = vm.runInContext(`(()=>{
    trial.pat.civ=[];
    for(const type of Object.values(PATROL_CIV))for(const name of PATROL_NAMES)for(const hits of [0,1])
      trial.pat.civ.push({kind:'civ',vis:true,tag:type.tag,name,hits});
    for(const ally of [true,false])trial.pat.civ.push({kind:'hulk',vis:true,ally,name:'ドーントレス'});
    const marks=[];patrolMarks(marks);return marks.map(m=>m.lab('24'));
  })()`, c);
  for (const label of labels) assert.match(translated(label), /24 km/);
  assert.equal(c.KSI18n.t('民間 ゴザンティ級「シルバー・アロー」 · 24 km'), 'Civilian Gozanti-class "Silver Arrow" · 24 km');
});

test('every hyperspace phase translates its composed destination, speed and countdown', () => {
  for (const phase of ['spool','accel','enter','tunnel','exit','brake','arrived']) {
    for (const dest of ['コルサント', 'オード・マンテル', '']) for (const left of [12, Infinity]) {
      c.jump = {phase,t:1};c.dest=dest;c.left=left;
      translated(vm.runInContext('trialHyperText(jump,dest,left)', c));
    }
  }
  assert.equal(c.KSI18n.t('ハイパースペース航行中 · コルサントまで 12 秒'), 'In Hyperspace · To Coruscant · 12 s');
});

test('orbit labels cover ring systems and all loading tips retain English military terminology', () => {
  for(const system of vm.runInContext('Galaxy.SYSTEMS',c)){
    c.system={name:system.name,planet:{ring:system.v.ring,ringName:system.v.ringName}};
    for(const mode of ['trial','battle'])for(const returnTo of [null,'title']){
      c.mode=mode;c.returnTo=returnTo;
      vm.runInContext('trial.sys=system;trial.mode=mode;trial.returnTo=returnTo',c);
      translated(vm.runInContext('trialWhere()',c));
    }
  }
  vm.runInContext(app.match(/const LOAD_TIPS=\[[\s\S]*?\];/)[0],c);
  for(const tip of vm.runInContext('LOAD_TIPS',c)) assert.doesNotMatch(translated('ヒント：'+tip),/task group/i);
  assert.equal(c.KSI18n.t('パトロール · クワット軌道 · 造船リング'),'Patrol · Kuat Orbit · Shipyard Ring');
  assert.equal(c.KSI18n.t('速力通信機'),'Engine Telegraph');
});

test('live damage flags, reactor modes and superweapon records are translated', () => {
  c.unit = {fire:[1,1,1,1,1],ionK:.5,shRate:20,shieldMax:1000,shield:10,bankUse:1,bankMax:10,bank:5};
  translatedHTML(vm.runInContext('statusFlagsHTML(unit)', c));
  c.unit.bank=0;translatedHTML(vm.runInContext('statusFlagsHTML(unit)', c));
  for (const object of ['Core.POWER_MODES','Core.MODULE_LABEL']) {
    for (const item of Object.values(vm.runInContext(object, c))) {
      for (const value of typeof item === 'string' ? [item] : [item.name,item.note]) translated(value);
    }
  }
  vm.runInContext('trial.gun={sw:3,swKills:2,swDown:1}',c);
  assert.equal(translated(vm.runInContext('trialSwRecord()',c)), ' · Superweapon Shots 3 / Destroyed 2 / Disabled 1');
  assert.equal(translated('戦況　敵 1/2 隻 · 撃沈 1 · 戦闘不能 0 · 射撃 34 発 / 命中 8 ｜ 前部区画で火災発生（反応炉）'),
    'Battle Log: Enemy Ships 1/2 · Destroyed 1 · Disabled 0 · Shots 34 / Hits 8 | Fire in Forward Compartments (Reactor)');
});

test('battle results translate composed gunnery totals and every outcome', () => {
  vm.runInContext(`const resultNode={innerHTML:'',hidden:true};
    const $=()=>({querySelector:()=>resultNode}), crewShare=()=>1, crewPct=()=>100;
    const SYSTEMS={coruscant:{name:'コルサント'}};
    trial.gun={shots:34,hits:8,pdKills:3};
    trial.battle={me:{crew:100,armor:.8},b:{units:[{team:1,dead:true},{team:1,out:'艦橋喪失'},{team:0,manual:false}]}};
  `,c);
  section('function spaceShowResult()', '// Fleet screen');
  for(const kind of ['win','withdrew','sunk','disabled'])for(const rts of [false,true]){
    c.kind=kind;c.rts=rts;
    vm.runInContext(`trial.battle.rts=rts;trial.battle.result={kind,dest:'coruscant',fate:'reactor',why:'艦橋喪失'};spaceShowResult()`,c);
    translatedHTML(vm.runInContext('resultNode.innerHTML',c));
  }
});

test('dynamic slider values localize and return to Japanese without changing numeric input', () => {
  const attrs=new Map([['aria-label','ピッチとロール'],['aria-valuetext','中立']]);
  const el={nodeType:1,tagName:'DIV',childNodes:[],closest:()=>null,getAttribute:n=>attrs.get(n)??null,setAttribute:(n,v)=>attrs.set(n,v)};
  c.KSI18n.localize(el);assert.equal(attrs.get('aria-valuetext'),'Neutral');
  attrs.set('aria-valuetext','上げ 70% · 右ロール 40%');c.KSI18n.localize(el);
  assert.equal(attrs.get('aria-valuetext'),'Pitch Up 70% · Roll Right 40%');
  c.KSI18n.setLanguage('ja');c.KSI18n.localize(el);
  assert.equal(attrs.get('aria-valuetext'),'上げ 70% · 右ロール 40%');
  c.KSI18n.setLanguage('en');c.KSI18n.localize(el);
  assert.equal(attrs.get('aria-valuetext'),'Pitch Up 70% · Roll Right 40%');
});
