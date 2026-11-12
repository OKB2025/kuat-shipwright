// UI phase 1 (2026-11-12) item 3a: the combat power bar splits 冷却 (S.draw.dissipators, counted by Core inside
// S.draw.hotel) out of その他, keeps the display factor 0.35 × engines, keeps the old total, and a compact copy
// sits in the always-visible metrics. Display only: no physics value changes.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function extract(name){const m=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(m,name);for(let end=app.indexOf('}',m.index);end>=0;end=app.indexOf('}',end+1)){const s=app.slice(m.index,end+1);try{new vm.Script(s);return s;}catch{}}assert.fail(name);}
const shareLine=app.split('\n').find(l=>l.startsWith('const COMBAT_ENGINE_SHARE='));
function setup(){const cx=vm.createContext({});vm.runInContext(`const esc=String;${shareLine}${extract('combatPowerSegments')}${extract('combatPowerBarHTML')}`,cx);return code=>vm.runInContext(code,cx);}
const draw={weapons:40,shields:20,engines:100,hotel:30,dissipators:10,ray:5};

test('five segments: weapons, shields, 0.35 × engines, cooling, other — with the old four-segment total',()=>{
 const r=setup(),out=r(`combatPowerSegments({power:200,draw:${JSON.stringify(draw)}})`);
 assert.equal(shareLine,'const COMBAT_ENGINE_SHARE=0.35;','the display factor is unchanged');
 assert.deepEqual(JSON.parse(JSON.stringify(out.segs)),[['兵装',40,'w'],['シールド',20,'s'],['機関',35,'e'],['冷却設備',10,'c'],['その他',25,'o']]);
 const oldTotal=draw.weapons+draw.shields+.35*draw.engines+draw.hotel+draw.ray;assert.equal(out.total,oldTotal,'cooling + other = the old その他 (hotel + ray)');
 assert.equal(out.scale,200);assert.equal(out.over,false);
 const none=r(`combatPowerSegments({power:50,draw:{weapons:40,shields:20,engines:0,hotel:30,ray:0}})`);assert.equal(none.segs[3][1],0,'no dissipators: no cooling');assert.equal(none.segs[4][1],30);assert.equal(none.over,true);assert.equal(none.scale,90);
 const odd=r(`combatPowerSegments({power:100,draw:{hotel:5,dissipators:9}})`);assert.equal(odd.segs[3][1],5,'cooling never exceeds what hotel holds');assert.equal(odd.segs[4][1],0);
});

test('the bar markup has one segment per share, percentages of the reactor and the over-demand mark',()=>{
 const r=setup(),html=r(`combatPowerBarHTML({power:200,draw:${JSON.stringify(draw)}})`);
 assert.deepEqual([...html.matchAll(/data-power-segment="(\w)"/g)].map(m=>m[1]),['w','s','e','c','o']);
 assert.match(html,/title="冷却設備 5%"/);assert.match(html,/title="機関 18%"/);assert.match(html,/<span><i class="p-c"><\/i>冷却設備 5%<\/span>/);assert.doesNotMatch(html,/pmark/);
 assert.match(r(`combatPowerBarHTML({power:50,draw:{weapons:80}},{compact:true})`),/class="pbar pbar-sm"[^]*class="pmark" style="left:62\.50%"/);
});

test('the 性能 panel and the metrics both use the shared bar; the 性能 panel notes the display basis',()=>{
 const spec=extract('specHTML');assert.match(spec,/\$\{combatPowerBarHTML\(operating\)\}/);assert.doesNotMatch(spec,/\['その他', d\.hotel \+ d\.ray/);assert.match(spec,/機関は戦闘時の想定負荷（定格の35%）で表示します。冷却設備は排熱設備の定格消費電力です。/);
 const cx=vm.createContext({});const box={dataset:{},innerHTML:''};cx.box=box;
 vm.runInContext(`const esc=String,T=x=>x,fW=x=>x+' W',fLen=x=>x,fMass=x=>x,fG=x=>x,num=x=>x;const $=s=>s==='#designMetrics'?box:null;const designUIInfoPanel=()=>{},designUIPlacementStage=()=>({pending:[],failed:[]}),catalogStats=S=>({...S,accelG:1});const eng={ready:true,statsGen:1,gen:1};const C={heatReadoutRates:()=>null};
 let S={dims:[100],mass:5,power:200,draw:${JSON.stringify(draw)}};${shareLine}${extract('combatPowerSegments')}${extract('combatPowerBarHTML')}${extract('designUIMetrics')}designUIMetrics();`,cx);
 assert.match(box.innerHTML,/<div class="design-power" data-design-metric="power-bar"><dt>戦闘時の電力配分<\/dt><dd><div class="pbar pbar-sm"/);
 assert.equal([...box.innerHTML.matchAll(/data-power-segment=/g)].length,5);
 vm.runInContext('S=null;designUIMetrics()',cx);assert.match(box.innerHTML,/data-design-metric="power-bar"><dt>戦闘時の電力配分<\/dt><dd>—<\/dd>/);
});
