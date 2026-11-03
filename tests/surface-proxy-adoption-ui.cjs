const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){
 const cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});const run=code=>vm.runInContext(code,cx);
 run(`const C=Core,st={tab:'surface',surfaceIds:[],surfaceDraft:{},surfaceFilter:'all'},fleet={mode:'design'},eng={gen:1,geoGen:0,statsGen:0,sentGen:1,waiting:true,fitOnGeometry:false},live={active:false},meshStore={geos:{}},document={activeElement:null};let ship=C.newShip({L:80,W:60,H:40,plan:'rect',sec:'rect'},'Pending hull surfaces'),S=null,prevS=null,view=null,dragSnap=null,bounds=[],renders=0,panelHTML='';ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};const workerShip=JSON.parse(C.publicJSON(ship)),workerHull=C.hullGeo(workerShip);ship._client=true;
  const esc=String,num=(v,n=0)=>Number(v||0).toFixed(n),fMass=v=>num(v,2)+' t',fW=v=>num(v,2)+' W',$=()=>null,requestDraw=()=>{},refreshOverlay=()=>{},renderPanelInfo=()=>{},updateAviationUI=()=>{},updateGroundUI=()=>{},autosave=()=>{},titleVisible=()=>false,titleStatus=()=>{},titleShipView=()=>{},engineStatus=()=>{},kickEngine=()=>{},hideBusyOverlay=()=>{},selItem=()=>null,armMode=()=>false,selSingle=()=>false,renderStrip=()=>{},renderSpecTargets=()=>{},toastDiff=()=>{},toast=()=>{};
  function renderPanel(){renders++;panelHTML=surfaceEditorHTML();}
  function geometryMessage(){return {gen:1,state:C.publicJSON(workerShip),geos:{},caches:{ship:{},items:{parts:{},fits:{},hatches:{}},geoProxy:{hull:workerHull,ref:null}}};}
 `);
 const surfaceStart=app.indexOf('// ---------- surface patch editing ----------'),surfaceEnd=app.indexOf('// ---------- multiple selection, copy and paste ----------',surfaceStart);run(app.slice(surfaceStart,surfaceEnd));
 for(const [start,end]of [['function applyGeometry(msg)','// While the engine rebuilds'],['function adoptEngineState(msg)','function onEngineError(msg)'],['function refreshDerivedPanel()','function engineHello(mode)']]){const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a);run(app.slice(a,b));}
 return{run};
}
function expectEnabledTargets(run){
 assert.ok(run('C.surfacePatches(ship).length')>0);assert.ok(run('C.surfaceAutoCandidates(ship).length')>0);assert.match(run('panelHTML'),/data-surface-pick=/);assert.match(run('panelHTML'),/data-surface-action="auto-equipment" >対象を機材構造面に一括設定/);
}

test('actual geometry adoption rerenders the surface list and enables automatic targets after an empty client proxy',()=>{
 const {run}=setup();run('renderPanel()');assert.equal(run('C.surfacePatches(ship).length'),0);assert.match(run('panelHTML'),/data-surface-action="auto-equipment" disabled/);const renders=run('renders');
 run('onEngineGeometry(geometryMessage())');assert.equal(run('eng.adoptedGen'),1);assert.equal(run('eng.waiting'),false);assert.ok(run('renders')>renders);expectEnabledTargets(run);
});

test('when a focused panel input defers geometry redraw, the following real stats event refreshes the empty surface panel',()=>{
 const {run}=setup();run("renderPanel();document.activeElement={closest:selector=>selector==='#panel'?{}:null,matches:()=>true}");const renders=run('renders');run('onEngineGeometry(geometryMessage())');assert.equal(run('renders'),renders,'the shared input guard still protects the focused control');assert.match(run('panelHTML'),/data-surface-action="auto-equipment" disabled/);
 run('onEngineStats({gen:1,stats:{surface:C.surfaceReport(workerShip)}})');assert.ok(run('renders')>renders);expectEnabledTargets(run);
});
