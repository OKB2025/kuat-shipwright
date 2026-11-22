// 2026-11-22 (user: 「点検と同様に性能表も畳めるようにして」): the design screen's metrics card folds to its heading, like the inspection bar.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),css=fs.readFileSync(path.join(root,'js/design-ui.css'),'utf8');
const extract=name=>{const a=app.indexOf(`function ${name}(`);assert.ok(a>=0,name);let i=app.indexOf('{',a),d=0;for(;i<app.length;i++){if(app[i]==='{')d++;else if(app[i]==='}'&&--d===0)break;}return app.slice(a,i+1);};
function setup(stored){const box={dataset:{},innerHTML:''},store=new Map(stored==null?[]:[['yard.designMetricsOpen',stored]]);const cx=vm.createContext({box,localStorage:{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))}});
 vm.runInContext(`const esc=String,T=x=>x,fW=x=>x+' W',fLen=x=>x,fMass=x=>x,fG=x=>x;const $=s=>s==='#designMetrics'?box:null;const designUIInfoPanel=()=>{},designUIPlacementStage=()=>({pending:[],failed:[]}),catalogStats=S=>({...S,accelG:1}),combatPowerBarHTML=()=>'<div>bar';const eng={ready:true,statsGen:1,gen:1};const C={heatReadoutRates:()=>null};const st={};let S={dims:[100],mass:5,power:200,draw:{}};
 ${extract('designMetricsOpen')}${extract('toggleDesignMetrics')}${extract('designUIMetrics')}`,cx);return {box,store,run:c=>vm.runInContext(c,cx)};}
test('open by default; the heading toggles; the choice is remembered',()=>{
 const {box,store,run}=setup();run('designUIMetrics()');
 assert.equal(box.dataset.open,'1');assert.match(box.innerHTML,/data-dmtoggle aria-expanded="true"/);assert.match(box.innerHTML,/最新確定/);assert.match(box.innerHTML,/<dt>全長<\/dt>/);
 run('toggleDesignMetrics()');assert.equal(box.dataset.open,'0');assert.match(box.innerHTML,/aria-expanded="false"/);assert.match(box.innerHTML,/最新確定/);assert.doesNotMatch(box.innerHTML,/<dt>/);assert.equal(store.get('yard.designMetricsOpen'),'0');
 run('toggleDesignMetrics()');assert.equal(box.dataset.open,'1');assert.match(box.innerHTML,/<dt>質量<\/dt>/);assert.equal(store.get('yard.designMetricsOpen'),'1');
});
test('a remembered fold is restored, and the status still shows while folded',()=>{
 const {box,run}=setup('0');run('designUIMetrics()');assert.equal(box.dataset.open,'0');assert.match(box.innerHTML,/<p role="status" class="dm-head">/);
 run('eng.statsGen=0;designUIMetrics()');assert.match(box.innerHTML,/計算中/);
});
test('the heading is clickable although the card ignores pointer events, and the click is wired',()=>{
 assert.match(css,/\.design-metrics \.dm-head button\{[^}]*pointer-events:auto/);
 assert.match(app,/\$\('#designMetrics'\)\?\.addEventListener\('click',e=>\{if\(e\.target\.closest\?\.\('\[data-dmtoggle\]'\)\)toggleDesignMetrics\(\);\}\)/);
});
