const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){
 const cx=vm.createContext({console,structuredClone,setTimeout,clearTimeout});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});const run=code=>vm.runInContext(code,cx);
 run(`const C=Core,st={tab:'edit',sel:{list:'parts',id:1}},fleet={mode:'design'},eng={gen:1,geoGen:0,statsGen:0,sentGen:1,waiting:true,fitOnGeometry:false},live={active:false},meshStore={geos:{}},document={activeElement:null};let editorPartsRevision=0;const currentEditorGeometryContext=()=> 'fixture',hydrateEditorHull=()=>false;let ship=C.newShip({L:64,W:48,H:24,plan:'rect',sec:'rect'},'Worker armor reports'),S=null,prevS=null,view=null,dragSnap=null,bounds=[],renders=0,panelHTML='',localReports=0,draws=0;ship.parts=[{id:1,k:'struct',form:'box',c:[32,32,0],s:[40,30,20],taper:0}];ship.fits=[];ship.nextId=2;ship.armor={hull:.1,cit:0};const workerShip=JSON.parse(C.publicJSON(ship));C.setStructureFaceArmor(workerShip,1,'top',.7);const workerHull=C.hullGeo(workerShip),geometryReport=leanReport(C.surfaceReport(workerShip)),statsReport=leanReport(C.surfaceReport(workerShip));ship._client=true;const originalReport=C.surfaceReport;C.surfaceReport=(...args)=>{localReports++;return originalReport(...args)};
  const esc=String,num=(v,n=0)=>Number(v||0).toFixed(n),fMass=v=>num(v,2)+' t',fW=v=>num(v,2)+' W',$=()=>null,requestDraw=()=>draws++,refreshOverlay=()=>{},renderPanelInfo=()=>{},updateAviationUI=()=>{},updateGroundUI=()=>{},autosave=()=>{},titleVisible=()=>false,titleStatus=()=>{},titleShipView=()=>{},engineStatus=()=>{},kickEngine=()=>{},hideBusyOverlay=()=>{},selItem=()=>ship.parts.find(p=>p.id===st.sel.id),armMode=()=>false,selSingle=()=>true,renderStrip=()=>{},renderSpecTargets=()=>{},toastDiff=()=>{},toast=()=>{};
  function renderPanel(){renders++;panelHTML=structureFaceArmorControls(selItem());}
  function leanReport(report){return {...report,patches:report.patches.map(({triangles,polygon,cells,...row})=>row)};}
  function geometryMessage(gen=1){return {gen,state:C.publicJSON(workerShip),geos:{},surfaceReport:geometryReport,caches:{ship:{},items:{parts:{},fits:{},hatches:{}},geoProxy:{hull:workerHull,ref:null,surfaces:structuredClone(C.surfacePatches(workerShip).map(({_part,...p})=>p)),surfacePartitions:JSON.stringify(workerShip.surfaces?.partitions||null)}}};}
 `);
 const armorStart=app.indexOf('// ---------- structure face armor ----------'),armorEnd=app.indexOf('// ---------- multiple selection, copy and paste ----------',armorStart);assert.ok(armorStart>=0&&armorEnd>armorStart);run(app.slice(armorStart,armorEnd));
 for(const [start,end]of [['function applyGeometry(msg)','// While the engine rebuilds'],['function adoptEngineState(msg)','function onEngineError(msg)'],['function refreshDerivedPanel()','function engineHello(mode)']]){const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a);run(app.slice(a,b));}
 return{run};
}
function topValue(html){return Number(html.match(/data-structure-face-armor="top"[^>]*value="([^"]*)"/)?.[1]);}

test('real geometry and stats handlers adopt armor state and returned reports without rebuilding a client report',async()=>{
 const {run}=setup();run('renderPanel();localReports=0');await run('onEngineGeometry(geometryMessage())');assert.equal(run('localReports'),0);assert.equal(topValue(run('panelHTML')),.7);
 assert.deepEqual(JSON.parse(run('JSON.stringify(ship.surfaces)')),JSON.parse(run('JSON.stringify(workerShip.surfaces)')));assert.equal(run('ship.surfaces.armorOnly'),1);assert.equal(run('ship.parts.some(p=>p.surfacePatch)||ship.fits.some(f=>f.surfacePatch)'),false);
 run('onEngineStats({gen:1,stats:{surface:statsReport}})');assert.equal(run('S.surface===statsReport'),true);assert.equal(run('localReports'),0);assert.ok(run('renders')>=2);
});

test('a geometry snapshot for an outdated design generation is never adopted by the editor',()=>{
 const {run}=setup();run('eng.gen=2;onEngineGeometry(geometryMessage(1))');assert.equal(run('renders'),0);assert.equal(run('ship._geoProxy'),undefined);assert.equal(run('eng.adoptedGen'),undefined);assert.equal(run('localReports'),0);
});

test('a deferred snapshot completes the displayed geometry and armor controls without a client report or duplicate meshes',async()=>{
 const {run}=setup();run(`st.tab='hull';const full=geometryMessage(),first=geometryMessage();delete first.surfaceReport;delete first.caches.geoProxy.surfaces;delete first.caches.geoProxy.surfacePartitions;`);await run('onEngineGeometry(first)');run('const beforeMeshes=meshStore.geos');
 assert.equal(run('eng.geoGen'),1);assert.equal(run('eng.adoptedGen'),1);assert.equal(run('Array.isArray(ship._geoProxy.surfaces)'),false);
 run("st.tab='edit';localReports=0");await run('onEngineSurfaceGeometry(full)');assert.equal(run('Array.isArray(ship._geoProxy.surfaces)'),true);assert.equal(run('localReports'),0);assert.equal(run('meshStore.geos===beforeMeshes'),true);assert.equal(topValue(run('panelHTML')),.7);
});

test('late deferred surfaces cannot replace a newer design or interrupt a held edit',async()=>{
 const {run}=setup();run(`st.tab='hull';const full=geometryMessage();`);await run('onEngineGeometry(geometryMessage())');run("const readyProxy=ship._geoProxy;eng.gen=2;onEngineSurfaceGeometry({...full,state:'invalid if adopted'})");
 assert.equal(run('ship._geoProxy===readyProxy'),true);assert.equal(run('eng.adoptedGen'),1);
 run("eng.gen=1;dragSnap='held';onEngineSurfaceGeometry({...full,state:'invalid if adopted'})");assert.equal(run('ship._geoProxy===readyProxy'),true);assert.equal(run('renders'),0);assert.equal(run('meshStore.pendingSurfaceGeometry.state'),'invalid if adopted');
});

test('a deferred snapshot completes a current generation whose geometry packet reused previous meshes',async()=>{
 const {run}=setup();run("st.tab='hull'");await run('onEngineGeometry(geometryMessage())');run('eng.gen=2;onEngineGeometry({gen:2,geos:{},state:C.publicJSON(workerShip),caches:null,noop:true})');
 assert.equal(run('eng.geoGen'),2);assert.equal(run('eng.adoptedGen'),1);await run('onEngineSurfaceGeometry(geometryMessage(2))');assert.equal(run('eng.adoptedGen'),2);assert.equal(run('Array.isArray(ship._geoProxy.surfaces)'),true);
});

test('performance cards reuse the worker common profile without recalculating client modules',()=>{
 const {run}=setup();run(app.split('\n').find(s=>s.startsWith('function trialProfile(')));
 run(`let profileCalls=0;const commonProfile={name:'Worker armor reports',surface:{patches:[{id:'p1:top'}]},maxSpeed:12};C.fleetProfile=(...args)=>{profileCalls++;return {fallback:true,args:args.length}};onEngineStats({gen:1,stats:{surface:statsReport},profile:commonProfile});`);
 for(let i=0;i<5;i++)assert.equal(run('trialProfile()===commonProfile'),true);assert.equal(run('profileCalls'),0);
 run('onEngineStats({gen:0,stats:{surface:statsReport},profile:{stale:true}})');assert.equal(run('trialProfile()===commonProfile'),true);assert.equal(run('profileCalls'),0);
});

test('missing or invalidated worker profiles use the current source-design fallback contract',()=>{
 const {run}=setup();run(app.split('\n').find(s=>s.startsWith('function trialProfile(')));
 run(`let profileCalls=0;C.fleetProfile=(...args)=>{profileCalls++;return {fallback:true,args:args.length,source:args[2]===ship}};onEngineStats({gen:1,stats:{surface:statsReport},profile:{stale:true}});onEngineStats({gen:2,stats:{surface:statsReport}});`);
 assert.equal(run('eng.profile'),null);assert.equal(run('trialProfile().args'),3);assert.equal(run('trialProfile().source'),true);
 run('eng.profile={stale:true};eng.profileGen=1');assert.equal(run('trialProfile().fallback'),true);run('ship=null');assert.equal(run('trialProfile()'),null);assert.equal(run('profileCalls'),3);
});
