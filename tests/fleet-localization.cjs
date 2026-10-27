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
const {Core: C, Rts: R, Galaxy: G, designs} = vm.runInContext('({Core,Rts,Galaxy,designs:YardFleetData.designs})', c);
const jp = /[\u3040-\u30ff\u3400-\u9fff]/;
function translated(source) {
  const result = c.KSI18n.t(source);
  assert.doesNotMatch(result, jp, source + ' => ' + result);
  return result;
}
function section(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  vm.runInContext(app.slice(a, b), c);
}

test('3D aircraft markers translate real generated squadrons with intact numbers and roles', () => {
  const marker = app.match(/lab:dist=>(`\$\{x\.team[^`]+`)/);
  assert.ok(marker, 'actual 3D marker template');
  const label = vm.runInContext('(x,s,dist)=>' + marker[1], c);
  let count = 0;
  for (const design of Object.values(designs)) {
    for (const sq of R.defaultAir(design.info, design.faction || 'empire', design.air)) {
      for (const team of [0, 1]) translated(label({team}, sq, '5.3'));
      count++;
    }
  }
  assert.ok(count > 100);
  for (const [role, english] of [['戦闘','Fighter'],['迎撃','Interceptor'],['爆撃','Bomber'],['輸送','Transport']]) {
    for (const number of [1, 32, 48, 128]) {
      const out = translated(label({team: 0}, {name: `第${number}${role}中隊`, n: 12}, '13'));
      assert.match(out, new RegExp(english + ' Squadron ' + number + '\\b'));
      assert.match(out, /12.*13 km/);
    }
  }
});

test('fleet spectator hyperspace messages translate every destination and countdown', () => {
  vm.runInContext('const voy={w:{time:12,sector:{systems:[]},groups:new Map()}};const trial={jump:null};const JUMP={spool:5};', c);
  section('function voyClock(', '// ---- tactical map:');
  section('function trialHyperText(', 'function trialHyperUpdate(');
  section('function voySpectateHyperText(', 'function voySpectateHudUpdate(');
  for (const system of G.SYSTEMS) {
    c.destination = system.name;
    for (const blocked of [false,true]) {
      c.blocked=blocked;
      const labels=vm.runInContext(`(()=>{
        voy.w.sector.systems=[{name:destination}];
        voy.w.groups.set('g',{transit:{t1:660},spool:{dest:0,need:15,t:3,blocked}});
        const f={side:0,group:'g',jump:true};
        trial.jump={follow:true,phase:'tunnel',dest:0};
        const a=voySpectateHyperText(f).text;trial.jump=null;
        return [a,voySpectateHyperText(f).text];
      })()`,c);
      labels.forEach(translated);
      assert.match(translated(labels[0]), /10:48/);
    }
  }
});

test('operations contacts, victory reports and task-force hyperdrive details fully translate', () => {
  for (const approximate of ['', '約']) for (const age of ['', ' · 5分前', ' · 120分前']) {
    for (const suffix of [' 隻', '']) translated(`敵 ${approximate}16${suffix}${age}`);
  }
  assert.equal(translated('敵 約16 隻 · 5分前'), 'Enemy ≈16 Ships · 5 min Ago');
  for (const system of G.SYSTEMS) for (const faction of Object.values(R.FACTIONS)) {
    translated(`${system.name}の戦闘終結：${faction.name}が宙域を確保`);
  }
  for (const status of ['クラス 2.1（任務群で最も遅い艦）','ジャンプ不能（航行不能艦あり）','ジャンプできる艦がありません']) {
    for (const tow of ['', ' · 牽引中 2 隻（同行）']) for (const stay of ['', ' · ハイパードライブを失った 3 隻は残置']) {
      translated('ハイパードライブ '+status+tow+stay);
    }
  }
});

test('built-in equipment names translate inside damage reports without changing design data', () => {
  const before=JSON.stringify(designs),names=new Set();
  function walk(x) {
    if (!x || typeof x!=='object') return;
    for (const [key,value] of Object.entries(x)) {
      if ((key==='name'||key==='label') && typeof value==='string' && jp.test(value)) names.add(value);
      else if (value && typeof value==='object') walk(value);
    }
  }
  walk(designs);
  assert.ok(names.size>500);
  for (const name of names) {
    translated(name);
    translated(`友 イントレピッド：前部区画で火災発生（${name}）`);
  }
  assert.equal(JSON.stringify(designs),before);
});

test('sortie options, examples, source notes and accessible controls retain English coverage', () => {
  section('const VOY_SCALES =', 'const VOY_SHIP_CAP =');
  for (const row of Object.values(vm.runInContext('VOY_SCALES',c))) translated(row.name);
  for (const example of Object.values(C.SHIP_EXAMPLES)) {
    for (const key of ['name','role','author','source','license','credit','note']) if (typeof example[key]==='string') translated(example[key]);
  }
  translated(C.ORDNANCE_EVIDENCE);
  for (const row of Object.values(C.CRAFT_LOADOUT)) {
    translated(row.src);
    for (const variant of row.alt || []) {translated(variant.name);translated(variant.src);}
  }
  translated(C.POWER_AUTO_NOTE);
  for (const speed of [1,4,16,64]) translated(`時間 ${speed} 倍`);
  for (const m of (app+fs.readFileSync(path.join(root,'index.html'),'utf8')).matchAll(/<optgroup label="([^"]*)"/g)) translated(m[1]);
  assert.equal(translated('第13任務群'),'TF-13');
  assert.equal(translated('第1合同任務群'),'CTF-1');
  assert.equal(c.KSI18n.t('私の手作り艦Ω'),'私の手作り艦Ω');
  c.KSI18n.setLanguage('ja');assert.equal(c.KSI18n.t('小規模'),'小規模');
  c.KSI18n.setLanguage('en');assert.equal(c.KSI18n.t('小規模'),'Small');
});
