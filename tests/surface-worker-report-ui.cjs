const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){
 const cx=vm.createContext({console,structuredClone});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});const run=code=>vm.runInContext(code,cx);
 run(`const C=Core,st={tab:'surface',surfaceIds:[],surfaceDraft:{},surfaceFilter:'all'},fleet={mode:'design'},eng={gen:1,geoGen:0,statsGen:0,sentGen:1,waiting:true,fitOnGeometry:false},live={active:false},meshStore={geos:{}},document={activeElement:null};let ship=C.newShip({L:64,W:48,H:24,plan:'rect',sec:'rect'},'Worker surface reports'),S=null,prevS=null,view=null,dragSnap=null,bounds=[],renders=0,panelHTML='',localReports=0,draws=0;ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};const workerShip=JSON.parse(C.publicJSON(ship));C.enableSurfaceMode(workerShip,true);const workerPatch=C.surfacePatches(workerShip).find(p=>p.face==='port');C.setSurfaceConfig(workerShip,workerPatch.id,{functionMode:'equipment',allocation:{cooling:50,sensors:30,habitation:20},battery:{weapon:'claser',count:2},equipment:{kind:'hdis',depth:1}});const workerHull=C.hullGeo(workerShip),geometryReport=leanReport(C.surfaceReport(workerShip)),statsReport=leanReport(C.surfaceReport(workerShip));ship._client=true;const originalReport=C.surfaceReport;C.surfaceReport=(...args)=>{localReports++;return originalReport(...args)};
  const esc=String,num=(v,n=0)=>Number(v||0).toFixed(n),fMass=v=>num(v,2)+' t',fW=v=>num(v,2)+' W',$=()=>null,requestDraw=()=>draws++,refreshOverlay=()=>{},renderPanelInfo=()=>{},updateAviationUI=()=>{},updateGroundUI=()=>{},autosave=()=>{},titleVisible=()=>false,titleStatus=()=>{},titleShipView=()=>{},engineStatus=()=>{},kickEngine=()=>{},hideBusyOverlay=()=>{},selItem=()=>null,armMode=()=>false,selSingle=()=>false,renderStrip=()=>{},renderSpecTargets=()=>{},toastDiff=()=>{},toast=()=>{};
  function renderPanel(){renders++;panelHTML=surfaceEditorHTML();}
  function leanReport(report){return {...report,patches:report.patches.map(({triangles,polygon,cells,...row})=>row)};}
  function geometryMessage(gen=1){return {gen,state:C.publicJSON(workerShip),geos:{},surfaceReport:geometryReport,caches:{ship:{},items:{parts:{},fits:{},hatches:{}},geoProxy:{hull:workerHull,ref:null,surfaces:structuredClone(C.surfacePatches(workerShip).map(({_part,...p})=>p)),surfacePartitions:JSON.stringify(workerShip.surfaces?.partitions||null)}}};}
 `);
 const surfaceStart=app.indexOf('// ---------- surface patch editing ----------'),surfaceEnd=app.indexOf('// ---------- multiple selection, copy and paste ----------',surfaceStart);run(app.slice(surfaceStart,surfaceEnd));
 for(const [start,end]of [['function applyGeometry(msg)','// While the engine rebuilds'],['function adoptEngineState(msg)','function onEngineError(msg)'],['function refreshDerivedPanel()','function engineHello(mode)']]){const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a);run(app.slice(a,b));}
 return{run};
}

test('real geometry and stats handlers reuse the returned reports without recomputing the surface report on the interface',()=>{
 const {run}=setup();run('renderPanel();localReports=0;onEngineGeometry(geometryMessage())');assert.equal(run('localReports'),0);assert.equal(run('surfaceReportForEditor()===geometryReport'),true);assert.match(run('panelHTML'),/data-surface-pick=/);assert.match(run('panelHTML'),/data-surface-action="auto-equipment" >対象を機材構造面に一括設定/);
 assert.equal(run('ship.surfaces?.version'),run('workerShip.surfaces.version'));assert.deepEqual(JSON.parse(run('JSON.stringify(ship.surfaces)')),JSON.parse(run('JSON.stringify(workerShip.surfaces)')),'the same current-generation adoption includes worker-compiled face data');assert.ok(run('ship.surfaces.patches.some(p=>p.aggregate)'));assert.equal(run('ship.parts.some(p=>p.surfacePatch)||ship.fits.some(f=>f.surfacePatch)'),false);
 run('onEngineStats({gen:1,stats:{surface:statsReport}})');assert.equal(run('surfaceReportForEditor()===statsReport'),true,'fresh common statistics take precedence over the earlier geometry report');assert.equal(run('localReports'),0);assert.ok(run('renders')>=2);
 run('eng.gen++;surfaceReportForEditor()');assert.equal(run('localReports'),1,'a new design generation invalidates both returned reports');
});

test('a geometry report for an outdated design generation is never adopted by the editor',()=>{
 const {run}=setup();run('eng.gen=2;onEngineGeometry(geometryMessage(1))');assert.equal(run('renders'),0);assert.equal(run('surfaceRemoteReport'),null);assert.equal(run('surfaceReportForEditor()===geometryReport'),false);assert.equal(run('localReports'),1);
});

test('a deferred surface snapshot fills the already displayed geometry without querying exposure on the interface',()=>{
 const {run}=setup();run(`st.tab='hull';const full=geometryMessage(),first=geometryMessage();delete first.surfaceReport;delete first.caches.geoProxy.surfaces;delete first.caches.geoProxy.surfacePartitions;onEngineGeometry(first);const beforeDraws=draws;`);
 assert.equal(run('surfaceEditorPending()'),true);assert.equal(run('eng.geoGen'),1);assert.equal(run('eng.adoptedGen'),1);assert.equal(run('Array.isArray(ship._geoProxy.surfaces)'),false);
 run("st.tab='surface';localReports=0;onEngineSurfaceGeometry(full)");
 assert.equal(run('surfaceEditorPending()'),false);assert.equal(run('Array.isArray(ship._geoProxy.surfaces)'),true);assert.equal(run('surfaceReportForEditor()===geometryReport'),true);assert.equal(run('localReports'),0);assert.equal(run('draws'),run('beforeDraws+1'));assert.match(run('panelHTML'),/data-surface-pick=/);
});

test('late deferred surfaces cannot replace a newer design or interrupt a held edit',()=>{
 const {run}=setup();run(`st.tab='hull';const full=geometryMessage();onEngineGeometry(geometryMessage());const readyProxy=ship._geoProxy;eng.gen=2;onEngineSurfaceGeometry({...full,state:'invalid if adopted'});`);
 assert.equal(run('ship._geoProxy===readyProxy'),true);assert.equal(run('eng.adoptedGen'),1);
 run("eng.gen=1;dragSnap='held';onEngineSurfaceGeometry({...full,state:'invalid if adopted'})");assert.equal(run('ship._geoProxy===readyProxy'),true);assert.equal(run('renders'),0);
});

test('a deferred snapshot completes a current generation whose geometry packet reused the previous meshes',()=>{
 const {run}=setup();run(`st.tab='hull';onEngineGeometry(geometryMessage());eng.gen=2;onEngineGeometry({gen:2,geos:{},state:C.publicJSON(workerShip),caches:null,noop:true});`);
 assert.equal(run('eng.geoGen'),2);assert.equal(run('eng.adoptedGen'),1);
 run('onEngineSurfaceGeometry(geometryMessage(2))');assert.equal(run('eng.adoptedGen'),2);assert.equal(run('surfaceEditorPending()'),false);
});

test('performance cards reuse the worker common profile without recalculating client habitation or surface modules',()=>{
 const {run}=setup();run(app.split('\n').find(s=>s.startsWith('function trialProfile(')));
 run(`let profileCalls=0;const commonProfile={name:'Worker surface reports',surface:{mounts:[{id:41}],devices:[{module:1}]},maxSpeed:12};C.fleetProfile=(...args)=>{profileCalls++;return {fallback:true,args:args.length}};onEngineStats({gen:1,stats:{surface:statsReport},profile:commonProfile});`);
 for(let i=0;i<5;i++)assert.equal(run('trialProfile()===commonProfile'),true);
 assert.equal(run('profileCalls'),0,'UI cards must not rebuild common module geometry on the interface thread');
 run('onEngineStats({gen:0,stats:{surface:statsReport},profile:{stale:true}})');assert.equal(run('trialProfile()===commonProfile'),true,'a late older message cannot replace the current generation profile');assert.equal(run('profileCalls'),0);
});

test('missing or invalidated worker profiles use only the cheap source-free summary fallback',()=>{
 const {run}=setup();run(app.split('\n').find(s=>s.startsWith('function trialProfile(')));
 run(`let profileCalls=0;C.fleetProfile=(...args)=>{profileCalls++;return {fallback:true,args:args.length}};onEngineStats({gen:1,stats:{surface:statsReport},profile:{stale:true}});onEngineStats({gen:2,stats:{surface:statsReport}});`);
 assert.equal(run('eng.profile'),null);assert.equal(run('trialProfile().args'),2,'the fallback must not receive the client ship and recompute habitation/occupancy');
 run('eng.profile={stale:true};eng.profileGen=1');assert.equal(run('trialProfile().fallback'),true);run('ship=null');assert.equal(run('trialProfile()'),null);assert.equal(run('profileCalls'),2);
});
