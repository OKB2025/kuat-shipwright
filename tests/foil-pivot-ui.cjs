const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,navigator:{language:'en-US'}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),run=code=>vm.runInContext(code,context),plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
run(`
const C=Core,T=s=>s,esc=s=>String(s),num=s=>String(s),deg=s=>s+'°',fPct=s=>s+'%',S=null;
let ship,dragSnap=null,dragLabel='',lastOp='',renders=0,previews=[],adoptions=0;
const st={foilView:null},eng={gen:0,geoGen:0,sentGen:0,waiting:false,fitOnGeometry:false};
const undoStack=[],redoStack=[],listeners={},modeNode={textContent:''},diagramNode={outerHTML:''};
const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)};
const $=selector=>selector==='#panel'?panel:selector.includes('data-foilpivotmode')?modeNode:selector.includes('.sw-arc')?diagramNode:null;
const live={active:false,parts:[],fits:[],hide:{parts:new Set(),fits:new Set()}};
const view={upload:()=>{},meshes:{preview:{count:0},previewRef:{count:0},previewFits:{count:0},previewRefFits:{count:0}}},Gfx={meshPreview:(s,parts)=>{previews.push(parts);return {};}};
const snap=()=>JSON.stringify(ship),selItem=()=>ship.parts[0],editSel=fn=>fn(selItem());
const touch=()=>eng.gen++,scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},sndEdit=()=>{},sndUI=()=>{},toast=()=>{};
const renderPanel=()=>renders++,requestDraw=()=>{};
const applyGeometry=()=>{},adoptEngineState=()=>adoptions++,fitCamera=()=>{},hideBusyOverlay=()=>{},refreshOverlay=()=>{},renderPanelInfo=()=>{},updateAviationUI=()=>{},refreshDerivedPanel=()=>{},titleVisible=()=>false,kickEngine=()=>{},engineStatus=()=>{};
const publicCopy=q=>JSON.parse(JSON.stringify(q));
function reset(){
 ship={hull:{L:30,W:30,H:10,assembly:true},parts:[{id:1,k:'struct',form:'trap',c:[10,4,8],s:[6,10,1],wing:{foil:true,axis:'x',stow:0,open:15,T:1,feed:1,reinf:0}}],fits:[]};
 dragSnap=null;undoStack.length=0;redoStack.length=0;renders=0;previews=[];adoptions=0;st.foilView=null;eng.gen=0;eng.geoGen=0;eng.sentGen=0;
 clearPreview();modeNode.textContent='';diagramNode.outerHTML='';
}
function input(a,value){for(const fn of listeners.input)fn({target:{dataset:{foilpivotcoord:String(a)},value:String(value)}});}
function change(a){for(const fn of listeners.change)fn({target:{dataset:{foilpivotcoord:String(a)}}});}
function click(key,value){const button={dataset:{[key]:value}};for(const fn of listeners.click)fn({target:{closest:()=>button}});}
`);
section('function seg(', 'function silhouette(');
section('function mutate(', 'function undo(');
section('const FOIL_AXIS_ROWS=', 'function heatHTML(');
section('function onEngineGeometry(', 'function onEngineStats(');
section('function clearPreview()', '// Exterior view skips');
section('const r6=', 'function xfMirrorOut(');
run('bindWing();reset();');

test('S-foil panel exposes precise ship-coordinate inputs and both pivot presets',()=>{
 run('reset();');
 const html=run('wingControls(selItem())');
 for(let a=0;a<3;a++)assert.match(html,new RegExp('type="number"[^>]*step="any"[^>]*data-foilpivotcoord="'+a+'"'));
 assert.match(html,/data-foilpivot="center"/);assert.match(html,/data-foilpivot="auto"/);
 run('delete selItem().wing.foil;');assert.doesNotMatch(run('wingControls(selItem())'),/data-foilpivotcoord/);
});

test('first edited coordinate preserves the automatic pivot on the other axes; all axes accept fractions',()=>{
 for(let a=0;a<3;a++){
  run('reset();');const automatic=plain(run('C.foilFrame(ship,selItem()).pv'));
  context.axis=a;run('input(axis,-12.375);');
  const expected=automatic.slice();expected[a]=-12.375;
  assert.deepEqual(plain(run('selItem().wing.pivot')),expected);
  assert.equal(run('modeNode.textContent'),'任意の位置');
 }
});

test('coordinate edits reject empty/nonfinite input and clamp to design limits',()=>{
 run('reset();');
 for(const value of ['', ' ', 'NaN', 'Infinity', '-Infinity','invalid']){context.value=value;run('input(0,value);');assert.equal(run('selItem().wing.pivot'),undefined);}
 assert.equal(run('eng.gen'),0);assert.equal(run('dragSnap'),null);
 run('input(0,1e20);input(1,-1e20);');
 assert.equal(run('selItem().wing.pivot[0]'),run('C.DESIGN_LIMITS.coordinate'));
 assert.equal(run('selItem().wing.pivot[1]'),-run('C.DESIGN_LIMITS.coordinate'));
});

test('one coordinate edit is one undo entry, while presets each record their own change',()=>{
 run('reset();input(2,7);input(2,7.5);input(2,7.75);');assert.equal(run('undoStack.length'),0);
 run('change(2);');assert.equal(run('undoStack.length'),1);
 assert.equal(plain(JSON.parse(run('undoStack[0]'))).parts[0].wing.pivot,undefined);
 run('click("foilpivot","center");');assert.deepEqual(plain(run('selItem().wing.pivot')),plain(run('selItem().c')));
 assert.equal(run('undoStack.length'),2);
 run('click("foilpivot","auto");');assert.equal(run('selItem().wing.pivot'),undefined);assert.equal(run('modeNode.textContent'),'付け根（自動）');
 assert.equal(run('undoStack.length'),3);
});

test('changing the pivot refreshes the hinge diagram and live stowed geometry without altering design vertices',()=>{
 run('reset();click("foilview","stow");');
 const before=run('JSON.stringify(previews.at(-1))'),design=plain(run('selItem().c'));
 run('input(1,12);');
 assert.notEqual(run('JSON.stringify(previews.at(-1))'),before);
 assert.match(run('diagramNode.outerHTML'),/<circle[^>]*fill="#ffd27a"/);
 assert.doesNotMatch(run('diagramNode.outerHTML'),/NaN|Infinity/);
 assert.deepEqual(plain(run('selItem().c')),design);
 assert.equal(run('st.foilView'),'stow');
});

test('background geometry updates preserve and rebuild an active stowed preview',()=>{
 run('reset();click("foilview","stow");input(2,3);');const before=run('previews.length');
 run('onEngineGeometry({gen:eng.gen,state:{},totalMs:1});');
 assert.equal(run('st.foilView'),'stow');assert.equal(run('live.active'),true);assert.equal(run('adoptions'),1);assert.equal(run('previews.length'),before+1);
 run('click("foilview","open");');assert.equal(run('st.foilView'),null);assert.equal(run('live.active'),false);
});

test('move and rotate transforms carry a custom pivot with the structure',()=>{
 run('reset();selItem().wing.pivot=[1,2,3];');
 let out=plain(run('xfPartOut(selItem(),{pt:p=>C.add(p,[4,5,6]),R:null})'));
 assert.deepEqual(out.c,[14,9,14]);assert.deepEqual(out.wing.pivot,[5,7,9]);
 out=plain(run('xfPartOut(selItem(),{pt:xfRot(0,90),R:xfRot(0,90)})'));
 assert.deepEqual(out.c,[10,-8,4]);assert.deepEqual(out.wing.pivot,[1,-3,2]);
 assert.deepEqual(plain(run('selItem().wing.pivot')),[1,2,3]);
});


test('removing or converting the last S-foil clears its stowed preview when the engine catches up',()=>{
 for(const operation of ['ship.parts=[];touch();','click("wingkind","wing");']){
  run('reset();click("foilview","stow");view.meshes.preview.count=12;');
  assert.equal(run('live.active'),true);assert.equal(run('live.hide.parts.size'),1);
  run(operation+'onEngineGeometry({gen:eng.gen,state:{},totalMs:1});');
  assert.equal(run('st.foilView'),null);assert.equal(run('live.active'),false);
  assert.equal(run('live.parts.length'),0);assert.equal(run('live.fits.length'),0);
  assert.equal(run('live.hide.parts.size'),0);assert.equal(run('live.hide.fits.size'),0);
  assert.equal(run('view.meshes.preview.count'),0);
 }
});

test('pivot controls and accessible coordinate labels have complete English translations',()=>{
 run('reset();KSI18n.setLanguage("en");');
 const jp=/[\u3040-\u30ff\u3400-\u9fff]/;
 for(const setup of ['', 'selItem().wing.pivot=[1,2,3];']){
  run(setup);const html=run('foilPivotControls(selItem())');
  const labels=[...html.split(/<[^>]*>/).filter(t=>t.trim()),...Array.from(html.matchAll(/aria-label="([^"]*)"/g),m=>m[1])];
  for(const label of labels)assert.doesNotMatch(context.KSI18n.t(label),jp,label);
 }
 assert.equal(context.KSI18n.t('Sフォイルの回転起点'),'S-foil Rotation Pivot');
});
