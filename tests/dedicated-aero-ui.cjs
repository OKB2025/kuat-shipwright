const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=v=>JSON.parse(JSON.stringify(v));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const context=vm.createContext({console,C});
 vm.runInContext(`
 let ship=C.newShip({L:20,W:12,H:8},'Aero UI');ship.parts=[];ship.nextId=1;
 const st={part:'gen',sel:null,surfaceMode:'horizontal',ve:{target:null}},listeners={},undoStack=[],redoStack=[];let dragSnap=null,dragLabel='',lastOp='';
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,rgb=v=>v.join(','),fmtM=v=>v+' m',fPct=v=>Math.round(v*100)+'%',fW=v=>v+' W',fMass=v=>v+' t',deg=v=>v+'°';
 const activeEquipment=()=>null,craftDesign=()=>C.isCraft(ship),selItem=()=>ship.parts.find(p=>p.id===st.sel?.id),editSel=fn=>fn(selItem());
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=s=>s==='#panel'?panel:null;
 const snap=()=>JSON.stringify(C.serialize(ship)),restore=s=>{ship=C.deserialize(JSON.parse(s));},sndEdit=()=>{},sndUI=()=>{},toast=()=>{},touch=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},rememberPick=()=>{},renderPanel=()=>{},updateHint=()=>{};
 const blockedHullControl=()=>false,editCockpitEquipment=()=>{},cockpitEquipmentHTML=()=>'';
 const veOpen=target=>{st.ve.target=target;};
 const surfaceControls=()=>'<div data-test-orientation></div>',foilPivotControls=()=>'<div data-test-pivot></div>',foilDiagramSVG=()=>'<svg></svg>',basePartEditor=()=>'',structureControls=()=>'<div data-test-structure-materials></div>',engineControls=()=>'',sensorBandControls=()=>'',superweaponControls=()=>'';
 const FOIL_AXIS_ROWS=[['x','前後軸']];
 const wingFigures=()=>({parts:[],area:7.25,capOpen:100000,capStow:35000,mass:.3,feedMass:.01,reinfMass:0,act:.02,jamAt:.5,solarP:50000,hits:[]});
 function click(data){const button={dataset:data};for(const fn of listeners.click)fn({target:{closest:s=>s==='button'?button:null}});}
 function input(key,value,min,max){const target={dataset:{sl:key},value:String(value),min:String(min),max:String(max)};for(const fn of listeners.input)fn({target});}
 function change(key){for(const fn of listeners.change)fn({target:{dataset:{sl:key}}});}
 function changeOutline(i,axis,value){for(const fn of listeners.change)fn({target:{dataset:{outline:String(i),axis:String(axis)},value:String(value)}});}
 function installPreview(){const p=unalignedPartPreview({p:[10,4,8],n:[0,1,0],kind:'section'}),made=C.placePart(ship,p.k,p.c,p.s,p,false);st.sel={list:'parts',id:made.id};return made;}
 `,context);
 for(const [start,end]of [
  ['function seg(','function silhouette('],
  ['function partCard(','function fitBtn('],
  ['function unalignedPartPreview(','function notchBox('],
  ['const TEMPLATE_SKIP =','function applyFitTemplate('],
  ['function wingControls(','function sensorBandControls('],
  ['function v3PartEditor(){','function fitPositionSliders('],
  ['function partEditor(){','function bindRealism(){'],
  ['function bindRealism(){','function referenceAircraftSettingHTML('],
  ['function bindWing(){','function heatHTML('],
  ['function bindVertexEdit(){','// ---------- USERPART-001'],
  ['function mutate(','function updateUndo(']
 ])vm.runInContext(section(start,end),context);
 vm.runInContext('bindWing();bindRealism();bindVertexEdit()',context);
 return code=>vm.runInContext(code,context);
}

test('the normal catalogue cards place two distinct aero kinds with fractional dimensions',()=>{
 const run=setup();
 for(const kind of ['wing','solarPanel']){
  assert.match(run(`partCard('${kind}',false)`),new RegExp(`data-part="${kind}"`));
  run(`selectAeroPart('${kind}');st.structSize=[.375,.625,.035];installPreview()`);
  const p=plain(run('C.serialize(ship).parts.at(-1)'));
  assert.equal(p.k,kind);assert.notEqual(p.k,'struct');assert.deepEqual(p.s,[.375,.625,.035]);
  assert.equal(p.form,kind==='wing'?'airfoil':'outline');assert.equal(!!p.wing.solar,kind==='solarPanel');
 }
 assert.equal(run('ship.parts.filter(p=>p.k==="struct").length'),0);
});

test('solar placement offers an actual six-corner face with editable ribs and fold',()=>{
 const run=setup();run("selectAeroPart('solarPanel')");
 assert.equal(run('st.structOutline.length'),6);assert.equal(run('st.structRoll'),90);
 run("click({newaerobracing:'spar'});input('newAeroPanelFrame',.012,0,.5);input('newAeroPanelRib',.007,0,.5);input('newAeroPanelFold',32,-80,80);input('newAeroPanelKnee',42,0,90);input('newAeroPanelSparX',-17,-50,50);installPreview()");
 const p=plain(run('C.serialize(ship).parts[0]'));
 assert.equal(p.panelFrame,.012);assert.equal(p.panelRib,.007);assert.equal(p.panelFold,32);assert.equal(p.panelKnee,.42);assert.equal(p.panelBracing,'spar');assert.equal(p.panelSparX,-.17);
 const restored=plain(run('C.serialize(C.deserialize(C.serialize(ship))).parts[0]'));
 for(const k of ['k','s','outline','panelFrame','panelRib','panelFold','panelKnee','panelBracing','panelSparX'])assert.deepEqual(restored[k],p[k],k);
});

test('wing planforms can change without losing the airfoil section or dedicated kind',()=>{
 const run=setup();run("selectAeroPart('wing');click({aeropreset:'straight',aeronew:'yes'});installPreview()");
 const before=plain(run('C.serialize(ship).parts[0]'));
 run("click({aeropreset:'swept',aeronew:'no'})");
 assert.equal(run('selItem().k'),'wing');assert.equal(run('selItem().form'),'airfoil');assert.equal(run('C.validOutline(selItem().outline)'),true);
 assert.notDeepEqual(plain(run('selItem().outline')),before.outline);assert.equal(run('undoStack.length'),1);
 run('undo()');assert.deepEqual(plain(run('selItem().outline')),before.outline);assert.equal(run('selItem().k'),'wing');
 run('redo()');assert.notDeepEqual(plain(run('selItem().outline')),before.outline);
});

test('the chordwise section diagram uses the physical six-vertex airfoil and labels its forward leading edge',()=>{
 const run=setup();run("selectAeroPart('wing');installPreview()");const html=run('aeroShapeControls(selItem(),true)');
 assert.match(html,/平面の翼形状（上から見た輪郭）/);assert.match(html,/翼断面（翼弦方向）/);
 assert.match(html,/前縁（艦首側）/);assert.match(html,/後縁/);
 const svg=html.match(/<svg class="aero-section"[^>]*>(.*?)<\/svg>/s);assert.ok(svg);
 const points=svg[1].match(/points="([^"]+)"/)[1].split(' ').map(p=>p.split(',').map(Number));assert.equal(points.length,6);
 const profile=plain(C.AERO_WING_SECTION);points.forEach(([x,y],i)=>{assert.ok(Math.abs((x-18)/224-profile[i][0])<1e-5);assert.ok(Math.abs((25-y)/26-profile[i][1])<1e-5);});
 assert.equal(points[0][1],points[3][1]);assert.ok(points[1][0]-points[0][0]<points[3][0]-points[1][0]);
 assert.equal(run('aeroPreset("wing","straight").outline.length'),4,'the section does not impose a hexagonal planform');
 run("selectAeroPart('solarPanel');installPreview()");const panel=run('aeroShapeControls(selItem(),true)');assert.doesNotMatch(panel,/翼断面（翼弦方向）/);assert.equal(run('selItem().outline.length'),6);
});

test('TIE panel presets provide concave interceptor and folded bomber shapes with undo',()=>{
 const run=setup();run("selectAeroPart('solarPanel');installPreview();click({aeropreset:'interceptor',aeronew:'no'})");
 assert.equal(run('selItem().k'),'solarPanel');assert.equal(run('C.validOutline(selItem().outline)'),true);assert.equal(run('selItem().outline.length'),22);
 const interceptor=plain(run('C.serialize(ship).parts[0]')),IN=plain(C.solarPanelPreset('interceptor')),SA=plain(C.solarPanelPreset('bomber'));
 assert.equal(interceptor.panelBracing,'spar');assert.ok(interceptor.panelSparX<0);assert.ok(interceptor.panelFold< -35);assert.equal(interceptor.s[1],interceptor.s[0]*IN.aspect);
 assert.equal(interceptor.panelFrame,interceptor.s[0]*IN.frameRatio);assert.equal(interceptor.panelRib,interceptor.s[0]*IN.ribRatio);
 run("click({aeropreset:'bomber',aeronew:'no'})");const bomber=plain(run('C.serialize(ship).parts[0]'));
 assert.equal(bomber.outline.length,12);assert.equal(bomber.s[0],interceptor.s[0]);assert.equal(bomber.s[2],interceptor.s[2]);assert.equal(bomber.s[1],bomber.s[0]*SA.aspect);
 assert.equal(bomber.panelFold,SA.panelFold);assert.ok(bomber.panelFold< -35);assert.ok(bomber.panelSparX>0);assert.equal(bomber.panelBracing,'spar');
 run('undo()');assert.deepEqual(plain(run('C.serialize(ship).parts[0]')),interceptor);
 const loaded=plain(run('C.serialize(C.deserialize(C.serialize(ship))).parts[0]'));assert.equal(loaded.k,'solarPanel');assert.deepEqual(loaded.outline,interceptor.outline);assert.equal(loaded.panelSparX,interceptor.panelSparX);
});

test('the signed main-spar gauge persists one drag transaction and frame widths can be zero',()=>{
 const run=setup();run("selectAeroPart('solarPanel');installPreview();click({aerobracing:'spar'})");const before=plain(run('C.serialize(ship).parts[0]')),steps=run('undoStack.length');
 run("input('aeroPanelSparX',-24,-50,50);input('aeroPanelSparX',-26,-50,50);change('aeroPanelSparX')");
 assert.equal(run('undoStack.length'),steps+1);assert.equal(run('selItem().panelSparX'),-.26);assert.equal(run('C.deserialize(C.serialize(ship)).parts[0].panelSparX'),-.26);
 run('undo()');assert.equal(run('selItem().panelSparX'),before.panelSparX);run('redo()');assert.equal(run('selItem().panelSparX'),-.26);
 run("input('aeroPanelFrame',0,0,.5);change('aeroPanelFrame');input('aeroPanelRib',0,0,.5);change('aeroPanelRib');click({aerobracing:'none'})");
 const p=plain(run('C.serialize(C.deserialize(C.serialize(ship))).parts[0]'));assert.equal(p.panelFrame,0);assert.equal(p.panelRib,0);assert.equal(p.panelBracing,'none');
 assert.equal(run('C.aeroPanelRibs(selItem()).length'),0);assert.match(run('aeroShapeControls(selItem(),true)'),/data-aerobracing="none" aria-pressed="true"/);
});

test('copying a panel into placement keeps its measured outline and chosen spar settings',()=>{
 const run=setup();run("selectAeroPart('solarPanel');click({aeropreset:'interceptor',aeronew:'yes'});installPreview();input('aeroPanelSparX',-31,-50,50);change('aeroPanelSparX')");
 const before=plain(run('C.serialize(ship).parts[0]'));run('carryToPlace();installPreview()');const copy=plain(run('C.serialize(ship).parts.at(-1)'));
 for(const k of ['k','s','outline','panelFold','panelKnee','panelBracing','panelSparX','panelFrame','panelRib'])assert.deepEqual(copy[k],before[k],k);
 assert.notEqual(copy.id,before.id);
});

test('solar rib and folding controls create one normal undo transaction and persist',()=>{
 const run=setup();run("selectAeroPart('solarPanel');installPreview()");const before=plain(run('C.serialize(ship).parts[0]'));
 run("input('aeroPanelFold',48,-80,80);input('aeroPanelFold',52,-80,80);change('aeroPanelFold')");
 assert.equal(run('undoStack.length'),1);assert.equal(run('selItem().panelFold'),52);assert.equal(run('selItem().k'),'solarPanel');
 assert.deepEqual(plain(run('selItem().s')),before.s);assert.deepEqual(plain(run('selItem().outline')),before.outline);
 assert.equal(run('C.deserialize(C.serialize(ship)).parts[0].panelFold'),52);
 run('undo()');assert.equal(run('selItem().panelFold'),before.panelFold);run('redo()');assert.equal(run('selItem().panelFold'),52);
});

test('dedicated editors expose aero geometry and operating controls without structural materials',()=>{
 const run=setup();
 for(const kind of ['wing','solarPanel']){
  run(`selectAeroPart('${kind}');installPreview()`);const html=run('v3PartEditor()');
  assert.match(html,/data-aeropreset=/);assert.match(html,/data-test-orientation/);assert.doesNotMatch(html,/data-test-structure-materials|data-editplate=|data-structform=|data-wingkind="none"|data-wingkind="solar"/);
  if(kind==='wing'){assert.match(html,/薄い六角/);assert.match(html,/data-wingkind="foil"/);}
  else{assert.match(html,/data-sl="aeroPanelFrame"/);assert.match(html,/data-sl="aeroPanelRib"/);assert.match(html,/data-sl="aeroPanelFold"/);assert.match(html,/集電出力/);}
 }
});

test('S-foil operation preserves the wing part while ordinary structures cannot gain that function',()=>{
 const run=setup();run("selectAeroPart('wing');installPreview();click({wingkind:'foil'})");
 assert.equal(run('selItem().k'),'wing');assert.equal(run('selItem().wing.foil'),true);assert.equal(run('selItem().form'),'airfoil');
 assert.equal(run('C.deserialize(C.serialize(ship)).parts[0].wing.foil'),true);
 run("click({wingkind:'wing'})");assert.equal(run('selItem().k'),'wing');assert.notEqual(run('selItem().wing.foil'),true);
 run("const structure=C.placePart(ship,'struct',[10,4,-8],[2,3,.1],{form:'box'},false);st.sel={list:'parts',id:structure.id};click({wingkind:'foil'})");
 assert.equal(run('selItem().k'),'struct');assert.equal(run('selItem().wing'),undefined);assert.equal(run('wingControls(selItem())'),'');
 assert.doesNotMatch(run('v3PartEditor()'),/data-aeropreset=|data-wingkind=/);
});


test('individual outline vertices can move, split and persist without changing the aero part kind',()=>{
 const run=setup();
 for(const kind of ['wing','solarPanel']){
  run(`selectAeroPart('${kind}');installPreview()`);const before=plain(run('selItem().outline'));
  assert.match(run('partEditor()'),/data-outline="0"/);
  const moved=(before[0][0]+.05)*100;run(`changeOutline(0,0,${moved})`);
  assert.equal(run('selItem().k'),kind);assert.notDeepEqual(plain(run('selItem().outline')),before);
  const count=run('selItem().outline.length');run("click({addvertex:'0'})");assert.equal(run('selItem().outline.length'),count+1);
  assert.equal(run('C.validOutline(selItem().outline)'),true);
  const p=plain(run('C.serialize(C.deserialize(C.serialize(ship))).parts.at(-1)'));
  assert.equal(p.k,kind);assert.equal(p.form,kind==='wing'?'airfoil':'outline');assert.equal(p.outline.length,count+1);
 }
});


test('baking a folded solar panel for free vertex editing preserves its kind and physical bounds',()=>{
 const run=setup();run("selectAeroPart('solarPanel');click({aeropreset:'bomber',aeronew:'yes'});installPreview()");
 const before=plain(run('C.serialize(ship).parts[0]')),bounds=plain(run('C.partAABB(selItem())'));
 assert.equal(before.panelFold,C.solarPanelPreset('bomber').panelFold);run("click({meshconvert:''})");
 assert.equal(run('selItem().k'),'solarPanel');assert.equal(run('selItem().form'),'mesh');assert.ok(run('selItem().mesh.v.length')>6);
 const baked=plain(run('C.partAABB(selItem())'));
 bounds.forEach((v,i)=>assert.ok(Math.abs(v-baked[i])<1e-4,`baked bound ${i}: ${baked[i]} != ${v}`));
 const loaded=plain(run('C.partAABB(C.deserialize(C.serialize(ship)).parts[0])'));
 baked.forEach((v,i)=>assert.ok(Math.abs(v-loaded[i])<1e-4,`loaded bound ${i}`));
 assert.equal(run('undoStack.length'),1);assert.equal(run('JSON.parse(undoStack[0]).parts[0].panelFold'),before.panelFold);
 run('undo()');assert.equal(run('selItem().form'),'outline');assert.equal(run('selItem().panelFold'),before.panelFold);
 run('redo()');assert.equal(run('selItem().form'),'mesh');assert.equal(run('selItem().k'),'solarPanel');
 assert.match(run('aeroShapeControls(selItem(),true)'),/data-sl="aeroPanelSparX"/);
 const ribs=plain(run('Array.from(C.aeroPanelRibs(selItem()))'));run("input('aeroPanelSparX',-10,-50,50);change('aeroPanelSparX')");
 assert.equal(run('selItem().panelSparX'),-.1);assert.notDeepEqual(plain(run('Array.from(C.aeroPanelRibs(selItem()))')),ribs);
 run('undo()');assert.equal(run('selItem().panelSparX'),before.panelSparX);
});
