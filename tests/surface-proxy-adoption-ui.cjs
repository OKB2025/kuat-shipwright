const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){
 const cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});const run=code=>vm.runInContext(code,cx);
 run(`const C=Core,st={tab:'edit',sel:{list:'parts',id:1}},fleet={mode:'design'},eng={gen:1,geoGen:0,statsGen:0,sentGen:1,waiting:true,fitOnGeometry:false},live={active:false},meshStore={geos:{}},document={activeElement:null};let ship=C.newShip({L:80,W:60,H:40,plan:'rect',sec:'rect'},'Pending structure armor'),S=null,prevS=null,view=null,dragSnap=null,bounds=[],renders=0,panelHTML='';ship.parts=[{id:1,k:'struct',form:'box',c:[40,50,0],s:[40,30,20],taper:0}];ship.fits=[];ship.nextId=2;ship.armor={hull:.1,cit:0};const workerShip=JSON.parse(C.publicJSON(ship));C.setStructureFaceArmor(workerShip,1,'top',.7);const workerHull=C.hullGeo(workerShip);ship._client=true;
  const esc=String,num=(v,n=0)=>Number(v||0).toFixed(n),fMass=v=>num(v,2)+' t',fW=v=>num(v,2)+' W',$=()=>null,requestDraw=()=>{},refreshOverlay=()=>{},renderPanelInfo=()=>{},updateAviationUI=()=>{},updateGroundUI=()=>{},autosave=()=>{},titleVisible=()=>false,titleStatus=()=>{},titleShipView=()=>{},engineStatus=()=>{},kickEngine=()=>{},hideBusyOverlay=()=>{},selItem=()=>ship.parts.find(p=>p.id===st.sel.id),armMode=()=>false,selSingle=()=>true,renderStrip=()=>{},renderSpecTargets=()=>{},toastDiff=()=>{},toast=()=>{};
  function renderPanel(){renders++;panelHTML=structureFaceArmorControls(selItem());}
  function geometryMessage(){return {gen:1,state:C.publicJSON(workerShip),geos:{},caches:{ship:{},items:{parts:{},fits:{},hatches:{}},geoProxy:{hull:workerHull,ref:null,surfaces:C.surfacePatches(workerShip).map(({_part,...p})=>p)}}};}
 `);
 const armorStart=app.indexOf('// ---------- structure face armor ----------'),armorEnd=app.indexOf('// ---------- multiple selection, copy and paste ----------',armorStart);assert.ok(armorStart>=0&&armorEnd>armorStart);run(app.slice(armorStart,armorEnd));
 for(const [start,end]of [['function applyGeometry(msg)','// While the engine rebuilds'],['function adoptEngineState(msg)','function onEngineError(msg)'],['function refreshDerivedPanel()','function engineHello(mode)']]){const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a);run(app.slice(a,b));}
 return{run};
}
function topValue(html){return Number(html.match(/data-structure-face-armor="top"[^>]*value="([^"]*)"/)?.[1]);}

test('actual geometry adoption refreshes the selected structure armor and completes its client proxy',()=>{
 const {run}=setup();run('renderPanel()');assert.equal(run('ship._geoProxy'),undefined);assert.equal(topValue(run('panelHTML')),.1);const renders=run('renders');
 run('onEngineGeometry(geometryMessage())');assert.equal(run('eng.adoptedGen'),1);assert.equal(run('eng.waiting'),false);assert.ok(run('renders')>renders);assert.ok(run('ship._geoProxy.surfaces.length')>0);assert.equal(topValue(run('panelHTML')),.7);
});

test('a focused armor input defers proxy redraw until focus leaves while worker state stays current',()=>{
 const {run}=setup();run("renderPanel();document.activeElement={closest:selector=>selector==='#panel'?{}:null,matches:()=>true}");const renders=run('renders');run('onEngineGeometry(geometryMessage())');assert.equal(run('renders'),renders,'the shared input guard protects the focused control');assert.equal(topValue(run('panelHTML')),.1);assert.equal(run('C.structureArmorFaces(ship,1).find(p=>p.face===\"top\").thickness'),.7);
 run('onEngineStats({gen:1,stats:{surface:C.surfaceReport(workerShip)}})');assert.equal(run('renders'),renders);run('document.activeElement=null;refreshDerivedPanel()');assert.ok(run('renders')>renders);assert.equal(topValue(run('panelHTML')),.7);
});
