const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=v=>JSON.parse(JSON.stringify(v));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function input(html,key,type='number'){const tag=(html.match(/<input\b[^>]*>/g)||[]).find(t=>t.includes(`data-sl="${key}"`)&&t.includes(`type="${type}"`));assert.ok(tag,`${key} ${type}`);return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));}
function setup(){
 const context=vm.createContext({console,C});vm.runInContext(`
 let ship=C.newShip({L:4,W:2,H:1,assembly:true},'Small hull and large wings');ship.parts=[];ship.nextId=1;
 const st={tab:'mod',part:'wing',group:'power',partTool:'place',sel:null,mirror:false,vmirror:false,surfaceMode:'horizontal',ve:{target:null},size:{},sizeCraft:{}},listeners={},undoStack=[],redoStack=[],controls=new Map(),outputs=new Map();
 let dragSnap=null,dragLabel='',lastOp='';
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,rgb=v=>v.join(','),fmtM=v=>v+' m',fPct=v=>Math.round(v*100)+'%',fW=v=>v+' W',fMass=v=>v+' t',deg=v=>v+'°';
 const activeEquipment=()=>null,craftDesign=()=>C.isCraft(ship),findSel=s=>ship[s.list]?.find(p=>p.id===s.id),selItem=()=>st.sel?findSel(st.sel):null,twinOfItem=(list,p)=>ship[list].find(q=>q.id===p.tw);
 const panel={innerHTML:'',addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=s=>s==='#panel'?panel:s.startsWith('#out-')?(outputs.has(s)||outputs.set(s,{}),outputs.get(s)):null,$$=s=>controls.get(s.match(/data-sl="([^"]+)"/)?.[1])||[];
 const sndEdit=()=>{},sndUI=()=>{},toast=()=>{},touch=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},rememberPick=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},reconcileSolidCutter=()=>{},hideInspect=()=>{},queuePreview=()=>{},refitOnGeometry=()=>{};
 const blockedHullControl=()=>false,editCockpitEquipment=()=>false,cockpitEquipmentHTML=()=>'',precisePartSize=()=>false;
 const surfaceControls=()=>'',foilPivotControls=()=>'',foilDiagramSVG=()=>'',v3PartEditor=()=>'',structureControls=()=>'',engineControls=()=>'',sensorBandControls=()=>'',superweaponControls=()=>'',partInfoHTML=()=>'',markTabs=()=>{},refreshOverlay=()=>{},partList=()=>'',paletteParts=()=>['wing','solarPanel'],equipmentCard=()=>'';
 const FOIL_AXIS_ROWS=[['x','前後軸']],wingFigures=()=>({parts:[],area:7,capOpen:1e5,capStow:3e4,mass:.3,feedMass:.01,reinfMass:0,act:.02,jamAt:.5,solarP:5e4,hits:[]});
 function click(data){const button={dataset:data};for(const fn of listeners.click)fn({target:{closest:s=>s==='button'?button:null}});}
 function mount(html){controls.clear();for(const tag of html.match(/<input\\b[^>]*>/g)||[]){const a=Object.fromEntries([...tag.matchAll(/([\\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));if(!a['data-sl'])continue;const t={...a,dataset:{sl:a['data-sl']}};if(!controls.has(t.dataset.sl))controls.set(t.dataset.sl,[]);controls.get(t.dataset.sl).push(t);}return html;}
 function edit(key,value,type='number',finish=true){const t=controls.get(key)?.find(q=>q.type===type);if(!t)throw Error('Missing mounted '+key+' '+type);t.value=String(value);for(const fn of listeners.input)fn({target:t});if(finish)for(const fn of listeners.change)fn({target:t});return {number:controls.get(key).find(q=>q.type==='number')?.value,range:controls.get(key).find(q=>q.type==='range')?.value,rangeMax:controls.get(key).find(q=>q.type==='range')?.max};}
 function selectedHTML(){return mount(basePartEditor()+aeroShapeControls(selItem(),true));}
 function placementHTML(){baseRenderPanel();return mount(panel.innerHTML+aeroShapeControls({k:st.part,form:st.structForm,s:st.structSize},false));}
 function installPreview(){const p=unalignedPartPreview({p:[2,1,8],n:[0,1,0],kind:'section'}),made=C.placePart(ship,p.k,p.c,p.s,p,st.mirror);st.sel={list:'parts',id:made.id};return made;}
 function rootEdge(p){const side=C.wingTipSide(p),z=(side===1?Math.min:Math.max)(...p.outline.map(q=>q[1]));return p.outline.filter(q=>Math.abs(q[1]-z)<1e-8).map(q=>q.slice());}
 `,context);
 for(const [start,end]of [
  ['function seg(','function silhouette('],['function partCard(','function fitBtn('],['function basePartEditor()','function baseFitEditor('],
  ['function baseRenderPanel()','function sizeOut('],['function unalignedPartPreview(','function notchBox('],['const TEMPLATE_SKIP =','function applyFitTemplate('],
  ['function wingControls(','function sensorBandControls('],['function bindWing(){','function heatHTML('],['function snap()','function updateUndo('],
  ['function assignMirror(','function copyFitSettings('],['function editSel(','const PED_SHAPES'],
  ["  $('#panel').addEventListener('input', e => {if(blockedHullControl", "  $('#panel').addEventListener('change', e => {\n    const t = e.target;"]
 ])vm.runInContext(section(start,end),context);
 vm.runInContext("bindWing();selectAeroPart('wing')",context);return code=>vm.runInContext(code,context);
}

test('new wings on a 4 m hull accept measured 12 m, 25 m and 120 m dimensions through the real numeric inputs',()=>{
 const run=setup(),html=run('placementHTML()');assert.equal(run('ship.hull.L'),4);
 for(const key of ['sl','sw','sh']){const field=input(html,key);assert.equal(+field.max,C.DESIGN_LIMITS.partSize);assert.equal(field.step,'any');}
 for(const key of ['sl','sw'])assert.ok(+input(html,key,'range').max>=40);
 run("edit('sl',12.375);edit('sw',25.125);edit('sh',.064)");assert.deepEqual(plain(run('st.structSize')),[12.375,25.125,.064]);
 const expanded=plain(run("edit('sl',120.375)"));assert.equal(+expanded.number,120.375);assert.equal(+expanded.range,120.375);assert.ok(+expanded.rangeMax>=120.375);
 run('installPreview()');const p=plain(run('C.serialize(C.deserialize(C.serialize(ship))).parts[0]'));assert.deepEqual(p.s,[120.375,25.125,.064]);assert.equal(p.k,'wing');assert.equal(p.form,'airfoil');
});

test('selected wing dimensions exceed the hull and retain fractional sizes through Undo, Redo, save and placement copy',()=>{
 const run=setup();run('installPreview();selectedHTML()');const initial=plain(run('selItem().s'));
 run("edit('el',12.375);edit('ew',25.125);edit('eh',.064);selectedHTML();edit('el',120.375)");assert.deepEqual(plain(run('selItem().s')),[120.375,25.125,.064]);
 assert.equal(run('undoStack.length'),4);run('undo();undo();undo();undo()');assert.deepEqual(plain(run('selItem().s')),initial);
 run('redo();redo();redo();redo()');const expected=plain(run('selItem().s'));assert.deepEqual(plain(run('C.deserialize(C.serialize(ship)).parts[0].s')),expected);
 run('carryToPlace();placementHTML();installPreview()');assert.deepEqual(plain(run('selItem().s')),expected);assert.equal(run('ship.parts.length'),2);
});

test('the new-wing tip gauge moves fore and aft while retaining the root, size and cooling area',()=>{
 const run=setup();run("click({aeropreset:'straight',aeronew:'yes'});st.structSize=[12.375,25.125,.064];placementHTML();const before=unalignedPartPreview({p:[2,1,8],n:[0,1,0],kind:'section'});const beforeRoot=rootEdge(before),beforeArea=C.aeroArea(before)");
 run("edit('newAeroWingTip',3.125);installPreview()");assert.ok(Math.abs(run('C.wingTipOffset(selItem())')-3.125)<1e-9);assert.deepEqual(plain(run('rootEdge(selItem())')),plain(run('beforeRoot')));assert.ok(Math.abs(run('C.aeroArea(selItem())-beforeArea'))<1e-8);
 run("carryToPlace();placementHTML();edit('newAeroWingTip',-4.0625);installPreview()");assert.ok(Math.abs(run('C.wingTipOffset(selItem())')+4.0625)<1e-9);assert.deepEqual(plain(run('rootEdge(selItem())')),plain(run('beforeRoot')));assert.deepEqual(plain(run('selItem().s')),[12.375,25.125,.064]);
});

test('a tip drag is one Undo transaction and mirrors geometry and its chosen tip side',()=>{
 const run=setup();run("st.mirror=true;click({aeropreset:'straight',aeronew:'yes'});st.structSize=[12.375,25.125,.064];installPreview();selectedHTML();const before=C.serialize(ship),rootBefore=rootEdge(selItem()),areaBefore=C.aeroArea(selItem())");
 run("edit('aeroWingTip',-2.25,'number',false);edit('aeroWingTip',-4.0625)");assert.equal(run('undoStack.length'),1);assert.ok(Math.abs(run('C.wingTipOffset(selItem())')+4.0625)<1e-9);assert.deepEqual(plain(run('rootEdge(selItem())')),plain(run('rootBefore')));assert.ok(Math.abs(run('C.aeroArea(selItem())-areaBefore'))<1e-8);
 assert.equal(run('C.wingTipSide(twinOfItem("parts",selItem()))'),-run('C.wingTipSide(selItem())'));assert.ok(Math.abs(run('C.wingTipOffset(twinOfItem("parts",selItem()))')+4.0625)<1e-9);
 assert.deepEqual(plain(run('twinOfItem("parts",selItem()).outline')),plain(run('C.mirrorPart(selItem(),ship).outline')));
 run('undo()');assert.deepEqual(plain(run('C.serialize(ship).parts')),plain(run('before.parts')));run('redo()');assert.ok(Math.abs(run('C.wingTipOffset(selItem())')+4.0625)<1e-9);
 const saved=plain(run('C.serialize(C.deserialize(C.serialize(ship))).parts'));assert.equal(saved[0].wingTipSide,-saved[1].wingTipSide);assert.deepEqual(saved[0].s,[12.375,25.125,.064]);
});

test('forward, swept, delta and double-delta presets work before and after placement as physical airfoil parts',()=>{
 const run=setup();
 for(const key of ['taper','straight','swept','forward','delta','doubleDelta']){
  run(`selectAeroPart('wing');click({aeropreset:'${key}',aeronew:'yes'});installPreview()`);const p=JSON.parse(run('C.publicJSON(selItem())'));assert.equal(p.k,'wing');assert.equal(p.form,'airfoil');assert.equal(C.validOutline(p.outline),true);
  if(key==='swept')assert.ok(C.wingTipOffset(p)<0);if(key==='forward')assert.ok(C.wingTipOffset(p)>0);
  if(key==='delta')assert.equal(p.outline.length,3);if(key==='doubleDelta'){assert.equal(p.outline.length,4);assert.equal(new Set(p.outline.map(q=>q[1])).size,3);}
  run("click({aeropreset:'straight',aeronew:'no'})");run(`click({aeropreset:'${key}',aeronew:'no'})`);assert.deepEqual(plain(run('selItem().outline')),p.outline);assert.equal(run('selItem().form'),'airfoil');
 }
});

test('choosing the opposite tip persists into presets, placement copies and mirrored wings without affecting solar panels',()=>{
 const run=setup();run("click({newwingtipside:'-1'});click({aeropreset:'doubleDelta',aeronew:'yes'});installPreview()");assert.equal(run('selItem().wingTipSide'),-1);assert.equal(run('C.wingTipSide(selItem())'),-1);
 run("click({wingtipside:'1'});selectedHTML();edit('aeroWingTip',2.125);carryToPlace();installPreview()");assert.equal(run('selItem().wingTipSide'),1);assert.ok(Math.abs(run('C.wingTipOffset(selItem())')-2.125)<1e-9);assert.equal(run('C.deserialize(C.serialize(ship)).parts.at(-1).wingTipSide'),1);
 run("selectAeroPart('solarPanel');click({aeropreset:'interceptor',aeronew:'yes'});installPreview();const solarBefore=C.publicJSON(selItem());click({wingtipside:'-1'})");assert.equal(run('C.publicJSON(selItem())'),run('solarBefore'));assert.doesNotMatch(run('aeroShapeControls(selItem(),true)'),/data-sl="aeroWingTip"|data-wingtipside=/);
 run("carryToPlace();const solarPlacement=JSON.stringify(st.structOutline);click({newwingtipside:'-1'})");assert.equal(run('JSON.stringify(st.structOutline)'),run('solarPlacement'));assert.doesNotMatch(run('aeroShapeControls({k:st.part,s:st.structSize},false)'),/data-sl="newAeroWingTip"|data-newwingtipside=/);
});
