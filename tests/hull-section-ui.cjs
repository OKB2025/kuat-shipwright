const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end,from=0){const a=app.indexOf(start,from),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup({legacy=false}={}){
 const errors=[],cx=vm.createContext({C,console:{error:error=>errors.push(error.message)}}),run=code=>vm.runInContext(code,cx);
 run(`
 let ship=C.newShip({L:100,W:60,H:40,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1,bowFree:true},'Section selection');
 ship.parts=[];ship.fits=[];
 const st={tab:'edit',sel:null,multi:{parts:new Set(),fits:new Set()}},undoStack=[],redoStack=[],messages=[],touches=[];
 let lastOp='',renders=0,panelHTML='';
 const listeners=[],panel={addEventListener:(type,fn)=>{if(type==='click')listeners.push(fn);}},$=selector=>{assertPanel(selector);return panel;};
 function assertPanel(selector){if(selector!=='#panel')throw Error('Unexpected selector '+selector);}
 const blockedHullControl=()=>false,esc=String,sndEdit=()=>{},sndUI=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{};
 const toast=message=>messages.push(message),snap=()=>JSON.stringify(C.serialize(ship)),restore=json=>{ship=C.deserialize(JSON.parse(json));renderPanel();};
 const touch=what=>{touches.push(what);if(what==='hull')syncHullEditor(true);};
 const renderPanel=()=>{renders++;panelHTML=seg('sec',Object.entries(C.SECTIONS),hullEditorProfile().sec);};
 function clickSection(sec){const button={dataset:{sec}};for(const fn of listeners)fn({target:{closest:()=>button}});}
 `);
 for(const [start,end]of [
  ['function hullEditorPart()','// ---------- ship lifecycle & history ----------'],
  ['function seg(','function slider('],
  ['function mutate(','function updateUndo(']
 ])run(section(start,end));
 run(section("  $('#panel').addEventListener('click', e => {","  $('#panel').addEventListener('input', e => {",app.indexOf('function bind()')));
 if(!legacy)run('C.ensurePrimaryHull(ship,{newDesign:true});selectInitialHull();');
 return {run,errors};
}

test('new-design section buttons change the real hull, selected button and saved profile',()=>{
 const {run,errors}=setup(),before=plain(run('C.designEnvelope(ship)')),initialVolume=run('C.partVolume(hullEditorPart())');
 for(const sec of ['trap','roof','diamond','ellipse','warship','rect']){
  assert.ok(C.SECTIONS[sec],sec);
  run('clickSection('+JSON.stringify(sec)+')');
  assert.equal(run('hullEditorPart().hullProfile.sec'),sec);
  assert.equal(run('ship.hull.sec'),sec);
  assert.match(run('panelHTML'),new RegExp('data-sec="'+sec+'" aria-pressed="true"'));
  assert.equal(run('C.primaryHullPart(C.deserialize(C.serialize(ship))).hullProfile.sec'),sec);
  if(sec==='trap')assert.notEqual(run('C.partVolume(hullEditorPart())'),initialVolume,'the hull solid uses the chosen profile');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(plain(run('messages')),[]);
 assert.deepEqual(plain(run('touches')),Array(6).fill('hull'));
 assert.equal(run('undoStack.length'),6);assert.deepEqual(plain(run('C.designEnvelope(ship)')),before);
 run('undo()');assert.equal(run('hullEditorProfile().sec'),'warship');
 run('redo()');assert.equal(run('hullEditorProfile().sec'),'rect');
});

test('section clicks edit the selected secondary hull without changing the primary hull',()=>{
 const {run,errors}=setup();
 run(`const primary=hullEditorPart(),second=JSON.parse(JSON.stringify(C.serialize(ship).parts[0]));second.id=ship.nextId++;delete second.primaryHull;second.c[2]+=100;ship.parts.push(second);st.sel={list:'parts',id:second.id};`);
 const primaryBefore=plain(run('primary.hullProfile'));
 run("clickSection('diamond')");
 assert.equal(run('second.hullProfile.sec'),'diamond');assert.deepEqual(plain(run('primary.hullProfile')),primaryBefore);
 assert.equal(run('ship.hull.sec'),'rect');assert.equal(run('undoStack.length'),1);assert.deepEqual(errors,[]);
 const saved=plain(run('C.deserialize(C.serialize(ship)).parts.filter(C.isHullStructure).map(p=>p.hullProfile.sec)'));
 assert.deepEqual(saved,['rect','diamond']);
 run('undo()');assert.equal(run('hullEditorProfile().sec'),'rect');
 run('redo()');assert.equal(run('hullEditorProfile().sec'),'diamond');
});

test('legacy hull section clicks use the header profile when no hull structure exists',()=>{
 const {run,errors}=setup({legacy:true});
 assert.equal(run('hullEditorPart()'),null);run("clickSection('ellipse')");
 assert.equal(run('ship.hull.sec'),'ellipse');assert.equal(run('undoStack.length'),1);assert.deepEqual(errors,[]);
 run('undo()');assert.equal(run('ship.hull.sec'),'rect');
});
