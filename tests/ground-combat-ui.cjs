const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..')), context = vm.createContext({navigator: {language: 'en-US'}, console});
for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js', 'js/lang-en.js', 'js/i18n.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, {filename: file});
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), run = code => vm.runInContext(code, context), jp = /[぀-ヿ㐀-鿿]/;
function translated(source) { const out = context.KSI18n.t(source); assert.doesNotMatch(out, jp, source + ' => ' + out); return out; }
function translatedHTML(html) {
  for (const text of html.replace(/<[^>]*translate="no"[^>]*>[^<]*<\/[^>]*>/g, '').split(/<[^>]*>/)) if (text.trim()) translated(text.trim());
  for (const m of html.matchAll(/(?:label|title|aria-label)="([^"]*)"/g)) translated(m[1]);
}
run(`const C=Core,R=Rts,esc=s=>String(s),num=v=>String(v),fCr=v=>v+' cr',T=s=>KSI18n.t(s),I18N=KSI18n,toast=()=>{},window={},document={addEventListener(){},querySelector(){return null},head:{appendChild(){}}},$=()=>null,$$=()=>[],
 LS={get(){return null},set(){return true}},Store={init(){},db:null},voyDownload=()=>{},msOwners=()=>({kashyyyk:'cis'}),voyObTgs=ob=>ob.ctgs.flatMap(c=>c.tgs),msAt=(st,id)=>st.at[id],msReadyShips=t=>t.ships,msSysName=k=>k==='kashyyyk'?'キャッシーク':k;`);
const a = app.indexOf('// v26 PLAN-007 / PLAN-008 ground combat'), b = app.indexOf('// (tests) the ground screens from outside', a);
assert.ok(a >= 0 && b > a);run(app.slice(a, b));

test('the designer\'s panels and figures read in English', () => {
  for (const k of ['atat', 'aat', 'speeder']) { const s = run(`Ground.vehicleStats(Ground.exampleDesign('${k}'))`); context.S = s; translatedHTML(run('gdStatsHTML(S)')); translatedHTML(run('gdPreviewSVG(S)')); }
  run(`GV.saves=[Ground.normalizeVehicleDesign({id:'vd-1',name:'私の歩行機',platform:'walker'})]`);
  const saves = run('gdSavesHTML()');translatedHTML(saves);assert.match(saves, /私の歩行機/, 'the player\'s name is kept as written');
  translatedHTML(run(`gdPreviewSVG(Ground.vehicleStats({platform:'vehicle',drive:'tracks',weapons:[{k:'cturret'}]}))`));
});

test('the mission\'s landing offer and its reasons read in English', () => {
  const st = (sys, foes = [], troops = 144) => ({faction: 'republic', era: 'cw', held: {}, foes, at: {t1: sys}, ob: {ctgs: [{tgs: [{id: 't1', ships: [{id: 's1', ground: troops ? [{battalions: [{companies: [{troops, vehicles: {}}]}]}] : []}]}]}]}});
  context.ST = st('kashyyyk');const ok = run('msLandingHTML(ST,"kashyyyk")');assert.match(ok, /data-msn="land:kashyyyk"/);translatedHTML(ok);
  context.ST = st('kashyyyk', [{sys: 'kashyyyk'}]);const busy = run('msLandingHTML(ST,"kashyyyk")');assert.doesNotMatch(busy, /data-msn="land:/);translatedHTML(busy);
  context.ST = st('kashyyyk', [], 0);translatedHTML(run('msLandingHTML(ST,"kashyyyk")'));
  context.ST = {...st('kashyyyk'), held: {kashyyyk: 'republic'}};translatedHTML(run('msLandingHTML(ST,"kashyyyk")'));
  for (const k of Object.keys(run('GD_KINDS'))) translated(run(`GD_KINDS[${k}]`));
});
