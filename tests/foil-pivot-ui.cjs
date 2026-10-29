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
 dragSnap=null;undoStack.length=0;redoStack.length=0;renders=0;previews=[];adoptions=0;st.foilView=null;st.foilPick=null;st.foilPickMode='vertex';st.foilPickView='iso';eng.gen=0;eng.geoGen=0;eng.sentGen=0;
 clearPreview();modeNode.textContent='';diagramNode.outerHTML='';
}
function input(a,value){for(const fn of listeners.input)fn({target:{dataset:{foilpivotcoord:String(a)},value:String(value)}});}
function change(a){for(const fn of listeners.change)fn({target:{dataset:{foilpivotcoord:String(a)}}});}
function click(key,value){const button={dataset:{[key]:value}};for(const fn of listeners.click)fn({target:{closest:selector=>selector==='button'?button:null}});}
function handle(kind,index,key){
 const node={dataset:{[kind==='vertex'?'foilvertex':'foiledge']:String(index)}};
 const target={closest:selector=>selector==='[data-foilvertex],[data-foiledge]'?node:null};
 let prevented=false;
 if(key){for(const fn of listeners.keydown)fn({target,key,preventDefault:()=>prevented=true});}
 else{for(const fn of listeners.click)fn({target,detail:0});}
 return prevented;
}
function gauge(k,value,min=-100,max=100){for(const fn of listeners.input)fn({target:{dataset:{sl:k},value:String(value),min:String(min),max:String(max)}});}
// bindPanel's shared slider change handler ends all range drags before bindWing's handler.
function gaugeChange(k){endDrag();for(const fn of listeners.change)fn({target:{dataset:{sl:k}}});}

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
 for(const setup of ['', 'selItem().wing.pivot=[1,2,3];', 'handle("vertex",0);', 'handle("edge",0);', 'click("foilpivot","center");', 'input(0,60000);']){
  run(setup);const html=run('foilPivotControls(selItem())');
  const labels=[...html.split(/<[^>]*>/).filter(t=>t.trim()),...Array.from(html.matchAll(/aria-label="([^"]*)"/g),m=>m[1])];
  for(const label of labels)assert.doesNotMatch(context.KSI18n.t(label),jp,label);
 }
 assert.equal(context.KSI18n.t('Sフォイルの回転起点'),'S-foil Rotation Pivot');
});

function nearVector(actual,expected){
 assert.equal(actual.length,expected.length);
 actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-7,`axis ${i}: ${v} != ${expected[i]}`));
}

test('picking a corner sets the exact world vertex without converting or reshaping the wing',()=>{
 run('reset();selItem().yaw=23;selItem().roll=-15;');
 const before=plain(run('({form:selItem().form,c:selItem().c,s:selItem().s,mesh:selItem().mesh})'));
 const points=plain(run('C.foilHandles(selItem()).points'));
 assert.ok(points.length>=8);
 for(const index of [0,points.length-1]){
  context.index=index;run('handle("vertex",index);');
  nearVector(plain(run('selItem().wing.pivot')),points[index]);
  assert.equal(run('foilPickState(selItem()).kind'),'vertex');
 }
 assert.deepEqual(plain(run('({form:selItem().form,c:selItem().c,s:selItem().s,mesh:selItem().mesh})')),before);
 assert.equal(run('undoStack.length'),2);
 assert.match(run('foilPickerSVG(selItem())'),/foil-pick-vertex selected/);
});

test('picking an edge and moving its percentage gauge reaches both endpoints and preserves independent offsets',()=>{
 run('reset();handle("edge",0);');
 const endpoints=plain(run('C.foilHandles(selItem()).edges[0].map(i=>C.foilHandles(selItem()).points[i])'));
 for(const percent of [0,50,100]){
  context.percent=percent;run('gauge("foilAlong",percent,0,100);');
  nearVector(plain(run('selItem().wing.pivot')),endpoints[0].map((v,a)=>v+(endpoints[1][a]-v)*percent/100));
 }
 run('gauge("foilShift0",1.25);gauge("foilShift1",-2.5);gauge("foilShift2",3.75);gauge("foilAlong",25,0,100);');
 const offset=[1.25,-2.5,3.75];
 nearVector(plain(run('selItem().wing.pivot')),endpoints[0].map((v,a)=>v+(endpoints[1][a]-v)*.25+offset[a]));
 nearVector(plain(run('C.sub(C.wingPivot(ship,selItem()),foilPickAnchor(selItem()))')),offset);
 run('click("foilpivot","anchor");');
 nearVector(plain(run('selItem().wing.pivot')),endpoints[0].map((v,a)=>v+(endpoints[1][a]-v)*.25));
 assert.equal(run('foilPickState(selItem()).kind'),'edge');
});

test('visual gauges validate their values, clamp at endpoints and honor design coordinate limits',()=>{
 run('reset();handle("vertex",0);');
 const before=plain(run('selItem().wing.pivot'));
 for(const value of ['', 'NaN', 'Infinity', '-Infinity']){
  context.value=value;run('gauge("foilShift0",value);');
  assert.deepEqual(plain(run('selItem().wing.pivot')),before);
 }
 run('gauge("foilShift0",1000,-2,2);');
 assert.equal(run('C.sub(selItem().wing.pivot,foilPickAnchor(selItem()))[0]'),2);
 run('handle("edge",0);gauge("foilAlong",-500,0,100);');assert.equal(run('foilPickState(selItem()).t'),0);
 run('gauge("foilAlong",500,0,100);');assert.equal(run('foilPickState(selItem()).t'),1);
 run('gauge("foilShift1",1e20,-1e20,1e20);');
 assert.equal(run('selItem().wing.pivot[1]'),run('C.DESIGN_LIMITS.coordinate'));
 run('foilWritePivot([-1e20,0,1e20]);');
 assert.deepEqual(plain(run('selItem().wing.pivot')),[-run('C.DESIGN_LIMITS.coordinate'),0,run('C.DESIGN_LIMITS.coordinate')]);
});

test('one gauge drag adds one undo entry and keeps the panel intact while sliding',()=>{
 run('reset();handle("vertex",0);');
 const entries=run('undoStack.length'),renders=run('renders'),initial=plain(run('selItem().wing.pivot'));
 run('gauge("foilShift2",1);gauge("foilShift2",2);gauge("foilShift2",3);');
 assert.equal(run('undoStack.length'),entries);assert.equal(run('renders'),renders);
 run('gaugeChange("foilShift2");');assert.equal(run('undoStack.length'),entries+1);
 const snapshot=plain(JSON.parse(run('undoStack.at(-1)')));
 nearVector(snapshot.parts[0].wing.pivot,initial);
});

test('anchor selections are invalidated by history, shape changes or switching designs',()=>{
 for(const action of [
  'ship=JSON.parse(undoStack[0]);',
  'selItem().s[1]+=2;',
  'ship={...ship,parts:ship.parts.slice()};',
  'selItem().wing.pivot=selItem().wing.pivot.map(v=>v+1);',
 ]){
  run('reset();handle("vertex",0);');assert.ok(run('foilPickState(selItem())'));
  run(action);assert.equal(run('foilPickState(selItem())'),null,action);
 }
});

test('view and selection-mode changes leave design and history unchanged',()=>{
 run('reset();handle("edge",0);');const before=run('snap()'),entries=run('undoStack.length'),gen=run('eng.gen');
 for(const view of ['iso','x','y','z']){
  context.nextView=view;run('click("foilpickview",nextView);');
  const svg=run('foilPickerSVG(selItem())');assert.match(svg,/<svg/);assert.doesNotMatch(svg,/NaN|Infinity/);
 }
 run('click("foilpickmode","vertex");click("foilpickmode","edge");');
 assert.equal(run('snap()'),before);assert.equal(run('undoStack.length'),entries);assert.equal(run('eng.gen'),gen);
});

test('corners and edges provide focusable SVG buttons and Enter/Space activation',()=>{
 run('reset();');let svg=run('foilPickerSVG(selItem())');
 assert.match(svg,/role="button" tabindex="0" data-foilvertex=/);
 assert.match(svg,/aria-label="角 1 を回転起点にする"/);
 assert.equal(run('handle("vertex",1,"Enter")'),true);
 nearVector(plain(run('selItem().wing.pivot')),plain(run('C.foilHandles(selItem()).points[1]')));
 run('click("foilpickmode","edge");');svg=run('foilPickerSVG(selItem())');
 assert.match(svg,/role="button" tabindex="0" data-foiledge=/);
 assert.equal(run('handle("edge",0," ")'),true);assert.equal(run('foilPickState(selItem()).t'),.5);
 assert.equal(run('handle("edge",0,"Escape")'),false);
});

test('an edge tap projects to its line in SVG coordinates, independent of hit-area width',()=>{
 run(`
 const tapNode={dataset:{pa:'20,30',pb:'100,70'},closest:()=>({getScreenCTM:()=>({inverse:()=>({})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(){return {x:this.x,y:this.y};}})})};
 `);
 assert.equal(run('foilEdgeFraction({detail:1,clientX:40,clientY:40},tapNode)'),.25);
 assert.equal(run('foilEdgeFraction({detail:1,clientX:-100,clientY:-100},tapNode)'),0);
 assert.equal(run('foilEdgeFraction({detail:1,clientX:200,clientY:200},tapNode)'),1);
 assert.equal(run('foilEdgeFraction({detail:0},tapNode)'),.5);
});

test('equivalent worker geometry-cache replacement keeps the selected edge and its gauge usable',()=>{
 run('reset();foilSelectHandle("edge",0,.35);gauge("foilShift0",1.25);gaugeChange("foilShift0");');
 const before=plain(run('selItem().wing.pivot'));
 context.previousHandles=run('st.foilPick.geometry');
 run('selItem()._geom={...selItem()._geom,tris:selItem()._geom.tris.slice()};');
 assert.notEqual(run('C.foilHandles(selItem())'),context.previousHandles,'worker arrays must actually have new identity');
 assert.equal(run('foilPickState(selItem()).kind'),'edge');
 assert.equal(run('foilPickState(selItem()).t'),.35);
 assert.equal(run('st.foilPick.geometry'),run('C.foilHandles(selItem())'));
 nearVector(plain(run('selItem().wing.pivot')),before);
 run('gauge("foilAlong",75,0,100);');
 const expected=plain(run('C.add(foilPickAnchor(selItem()),[1.25,0,0])'));
 nearVector(plain(run('selItem().wing.pivot')),expected);
 assert.equal(run('foilPickState(selItem()).t'),.75);
 run('selItem().s[1]+=2;');
 assert.equal(run('foilPickState(selItem())'),null,'a genuinely changed shape still invalidates its edge index');
});

test('direct coordinate edits retain the selected edge and later percentage moves preserve the numeric offset',()=>{
 run('reset();foilSelectHandle("edge",0,.25);input(1,42.125);change(1);');
 assert.equal(run('foilPickState(selItem()).kind'),'edge');
 assert.equal(run('foilPickState(selItem()).t'),.25);
 assert.equal(run('selItem().wing.pivot[1]'),42.125);
 const delta=plain(run('C.sub(selItem().wing.pivot,foilPickAnchor(selItem()))'));
 run('gauge("foilAlong",80,0,100);gaugeChange("foilAlong");');
 assert.equal(run('foilPickState(selItem()).t'),.8);
 nearVector(plain(run('C.sub(selItem().wing.pivot,foilPickAnchor(selItem()))')),delta);
 assert.match(run('foilPivotControls(selItem())'),/data-sl="foilAlong"/);
});
