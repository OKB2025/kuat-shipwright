const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const {C,resolution} = require('./helpers/immediate-design-ui.cjs');
const plain = value => JSON.parse(JSON.stringify(value));
function fn(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\s*\\(').exec(app);
  assert.ok(match, name);
  for (let i = app.indexOf('}', match.index); i >= 0; i = app.indexOf('}', i + 1)) {
    const code = app.slice(match.index, i + 1);
    try { new vm.Script(code); return code; } catch {}
  }
  assert.fail('complete function ' + name);
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup() {
  const context = vm.createContext({console, C, structuredClone});
  const run = source => vm.runInContext(source, context);
  run(`
    let ship=C.newShip({L:100,W:100,H:100,assembly:true},'Session source');
    ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[20,10,20]},{id:2,k:'struct',form:'box',c:[30,0,0],s:[10,10,10]}];
    ship.nextId=3;ship.saveId='session-source';
    let S={cls:{role:'test',name:'test'},hullLen:100},prevS=null,view=null,lastOp='',dragSnap=null,dragLabel='',hoverLines=null,editorPartsRevision=0,saveT=0,savingCurrent=false;
    const undoStack=[],redoStack=[],st={tab:'edit',sel:{list:'parts',id:1},multi:{parts:new Set([1]),fits:new Set()}},eng={gen:4,what:new Set()},meshStore={},live={},dirty={},fleet={mode:'design'},trial={on:false};
    const editorContext={ship:null,gen:-1,revision:-1,key:''};
    const designUI={space:'exterior',drawer:true,details:false,armed:false,parentId:1,mode:'horizontal',sequence:0,pending:null},calls=[],notices=[],posts=[],requests=[],replies=[],records=[],timers=new Map(),drafts=new Map(),nodes=new Map(),events=new Map();
    let timerSequence=0,packCalls=0,hotSnapshot=null;
    const setTimeout=f=>{const id=++timerSequence;timers.set(id,f);return id;},clearTimeout=id=>timers.delete(id);
    function flushTimers(){const work=[...timers.values()];timers.clear();for(const f of work)f();}
    const LS={set:(key,value)=>drafts.set(key,value)},$=selector=>{if(!nodes.has(selector))nodes.set(selector,{disabled:false,value:'',textContent:'',focus(){},select(){}});return nodes.get(selector);};
    const window={claude:{hot:{snapshot:f=>hotSnapshot=f}},addEventListener:(name,f)=>events.set(name,f)};
    const T=x=>x,esc=String,toast=m=>notices.push(m),sndEdit=()=>{},sndUI=()=>{},reconcileSolidCutter=()=>{},syncHullEditor=()=>{},kickEngine=()=>{},engineStatus=()=>{},previewHistory=()=>{},hideInspect=()=>{},updateName=()=>{},scheduleStats=()=>{},requestDraw=()=>{},refreshOverlay=()=>{},renderSaves=()=>{},autosaveShipLength=()=>100;
    const selItem=()=>st.sel?ship[st.sel.list].find(p=>p.id===st.sel.id):null,findSel=sel=>ship[sel.list].some(p=>p.id===sel.id),renderPanel=()=>designUIEditSync();
    const onEngineSurfaceGeometry=()=>{},designUIBar=()=>{},designUIPanel=()=>{},designUIMetrics=()=>{},renderInspBar=()=>{},queuePreview=()=>{},showPreview=(...args)=>calls.push({preview:args}),publicCopy=v=>JSON.parse(C.publicJSON(v));
    const YardEngineClient={post:m=>posts.push(m),request:(type,payload)=>{requests.push({type,payload});return new Promise((resolve,reject)=>replies.push({resolve,reject}));}};
    const Gfx={lineSet:()=>({part(){}})},tool=()=> 'part',designParents=()=>ship.parts,designParent=id=>ship.parts.find(p=>p.id===id),designCapability=()=>({space:'exterior',kind:'structure',allowedModes:['horizontal']}),partPreview=hit=>({id:-1,k:'struct',form:'box',c:hit.p.slice(),s:[4,4,4]}),designUIRequests=(part,request)=>[{part,request,symmetry:''}];
    const pack=async value=>{packCalls++;return JSON.stringify(value);},Store={save:async rec=>{records.push(rec);return 'local';}};
    function envelope(){const q=requests.at(-1).payload,r=q.request;return{gen:q.gen,designId:q.designId,operationId:q.operationId,geometryRevision:r.geometryRevision,parentGeometryRevision:r.parentGeometryRevision,placementModelVersion:r.placementModelVersion,result:{ok:true,part:r.part}};}
  `);
  for (const name of ['snap', 'restore', 'mutate', 'beginDrag', 'endDrag', 'undo', 'redo', 'updateUndo', 'touch', 'autosave', 'saveCurrent', 'exportDesign',
    'editorPublicKey', 'editorGeometryContext', 'currentEditorGeometryContext', 'designEntityEditable', 'designUIEditSession', 'designUIEditDirty', 'designUISavedDesign', 'designUIEditBegin', 'designUIEditApply', 'designUIEditCancel', 'designUIEditSync', 'designUIEditStatus', 'designUIClose', 'designUIDiagnostics', 'designUIRejectTap', 'designUIInvalidatePending', 'designUICancel', 'designUIRequest', 'designUIPlaceDraft', 'onEnginePlacementResolution', 'designUIStampNext', 'removeWithPreview', 'editorRemovalIds', 'editorRemovedIds', 'editorRemoveParts', 'removeLinked']) run(fn(name));
  return {run,context};
}

test('opening the drawer captures an isolated source and legacy detail editing has no session', () => {
  const {run:r} = setup();
  r('designUIEditBegin()');
  assert.equal(r('designUIEditDirty()'), false);
  assert.equal(r('designUIEditSession().source===ship'), true);
  r("ship.parts[0].c[0]=9;const exported=designUISavedDesign();exported.parts[0].c[0]=88;");
  assert.equal(r('designUIEditSession().design.parts[0].c[0]'), 0);
  assert.equal(r('designUIEditDirty()'), true);
  r('designUIEditCancel();designUI.drawer=true;designUI.details=true;designUIEditBegin()');
  assert.equal(r('designUIEditSession()'), null);
});

test('multiple mutations and a drag become one applied Undo operation with working Redo', () => {
  const {run:r} = setup();
  r("mutate('prior name',()=>ship.name='Before session');const originalHistory=undoStack.slice();designUIEditBegin();mutate('move',()=>ship.parts[0].c[0]=4);mutate('resize',()=>ship.parts[0].s[0]=25);beginDrag('drag');ship.parts[0].c[2]=7;touch('parts');designUIEditApply();");
  assert.equal(r('undoStack.length'), 2);
  assert.equal(r('undoStack[0]===originalHistory[0]'), true);
  assert.equal(r('designUIEditSession()'), null);
  assert.equal(r('dragSnap'), null);
  r('undo()');
  assert.deepEqual(plain(r('ship.parts[0].c')), [0, 0, 0]);
  assert.equal(r('ship.parts[0].s[0]'), 20);
  assert.equal(r('ship.name'), 'Before session');
  r('redo()');
  assert.deepEqual(plain(r('ship.parts[0].c')), [4, 0, 7]);
  assert.equal(r('ship.parts[0].s[0]'), 25);
});

test('cancel restores the original authoring state, identity, selection and both history stacks', () => {
  const {run:r} = setup();
  r("designUI.drawer=false;mutate('prior',()=>ship.name='Prior');mutate('prior redo',()=>ship.name='Redo');undo();const priorUndo=undoStack.slice(),priorRedo=redoStack.slice(),before=snap(),source=ship;designUI.drawer=true;designUIEditBegin();mutate('move',()=>ship.parts[0].c[0]=22);beginDrag('drag');ship.parts[0].s[0]=35;touch('parts');designUIEditCancel();");
  assert.equal(r('snap()===before'), true);
  assert.equal(r('ship===source'), true, 'cancellation patches rather than replacing the source identity');
  assert.equal(r('ship.saveId'), 'session-source');
  assert.deepEqual(plain(r('undoStack')), plain(r('priorUndo')));
  assert.deepEqual(plain(r('redoStack')), plain(r('priorRedo')));
  assert.deepEqual(plain(r('st.sel')), {list: 'parts', id: 1});
  assert.equal(r('dragSnap'), null);
  assert.equal(r('designUIEditSession()'), null);
  r('redo()');
  assert.equal(r('ship.name'), 'Redo');
});

test('session Undo stops at its own boundary and a clean apply preserves preexisting Redo', () => {
  const {run:r} = setup();
  r("designUI.drawer=false;mutate('prior',()=>ship.name='Prior');mutate('redo source',()=>ship.name='Redo');undo();const redoBefore=redoStack.slice();designUI.drawer=true;designUIEditBegin();mutate('move',()=>ship.parts[0].c[0]=5);undo();const boundary=snap();undo();");
  assert.equal(r('snap()===boundary'), true);
  assert.equal(r('ship.name'), 'Prior');
  assert.equal(r('designUIEditDirty()'), false);
  r('designUIEditApply()');
  assert.deepEqual(plain(r('redoStack')), plain(r('redoBefore')));
  r('redo()');
  assert.equal(r('ship.name'), 'Redo');
});

test('draft, export, pagehide and hot snapshots exclude every unapplied edit', async () => {
  const {run:r} = setup();
  const pagehide = app.split('\n').find(line => line.includes("window.addEventListener('pagehide'"));
  const hot = app.split('\n').find(line => line.includes('window.claude.hot.snapshot('));
  assert.ok(pagehide); assert.ok(hot);
  r(pagehide); r(hot);
  r("designUIEditBegin();mutate('rename',()=>ship.name='Unapplied');mutate('delete',()=>ship.parts.splice(0,1));flushTimers();");
  assert.equal(r('JSON.parse(drafts.get("yard.draft3")).name'), 'Session source');
  assert.equal(r('JSON.parse(drafts.get("yard.draft3")).parts.length'), 2);
  assert.equal(r('JSON.parse(drafts.get("yard.draft3.meta")).name'), 'Session source');
  r('events.get("pagehide")()');
  assert.equal(r('JSON.parse(drafts.get("yard.draft3")).name'), 'Session source');
  assert.equal(r('hotSnapshot().design.parts.length'), 2);
  await r('exportDesign()');
  assert.equal(r('JSON.parse($("#ioText").value).name'), 'Session source');
  assert.equal(r('JSON.parse($("#ioText").value).parts.length'), 2);
  assert.equal(r('ship.name'), 'Unapplied');
});

test('explicit save defers a dirty session and writes the applied authoring state afterward', async () => {
  const {run:r} = setup();
  r("designUIEditBegin();mutate('rename',()=>ship.name='Applied name');");
  await r('saveCurrent()');
  assert.equal(r('records.length'), 0);
  assert.equal(r('packCalls'), 0);
  assert.equal(r('notices.at(-1)'), '編集画面を閉じるか、取消してから保存してください');
  r('designUIEditApply()'); await r('saveCurrent()');
  assert.equal(r('records.length'), 1);
  assert.equal(r('JSON.parse(records[0].data).name'), 'Applied name');
});

test('selecting another existing part keeps the prior edit and starts a clean transaction on the selected part', () => {
  const {run:r} = setup();
  r("designUIEditBegin();mutate('move',()=>ship.parts[0].c[0]=99);st.sel={list:'parts',id:2};designUIEditSync();");
  assert.equal(r('ship.parts[0].c[0]'), 99);
  assert.equal(r('undoStack.length'), 1);
  assert.equal(r('st.sel.id'), 2);
  assert.equal(r('designUIEditSession().initialSelected.id'), 2);
  assert.equal(r('designUIEditDirty()'), false);
});

test('a duplicated selection and deletion stay in the same operation and cancel restores all parts', () => {
  const {run:r} = setup();
  r("designUIEditBegin();const session=designUIEditSession();mutate('duplicate',()=>{ship.parts.push({...structuredClone(ship.parts[0]),id:ship.nextId++});st.sel={list:'parts',id:3};});designUIEditSync();");
  assert.equal(r('designUIEditSession()===session'), true);
  assert.equal(r('designUIEditSession().selected.id'), 3);
  r("mutate('delete duplicate',()=>{ship.parts=ship.parts.filter(p=>p.id!==3);st.sel=null;});designUIEditSync();");
  assert.equal(r('designUIEditSession()===session'), true);
  r('designUIEditCancel()');
  assert.deepEqual(plain(r('ship.parts.map(p=>p.id)')), [1, 2]);
  assert.equal(r('ship.nextId'), 3);
  assert.equal(r('st.sel.id'), 1);
});

test('leaving a reconnect keeps ordinary edits while an armed reconnect retains its current source session', () => {
  const {run:r} = setup();
  r("designUIEditBegin();const session=designUIEditSession();mutate('move',()=>ship.parts[0].c[0]=9);designUI.drawer=false;designUI.armed=true;designUI.replaceId=1;designUIEditSync();");
  assert.equal(r('designUIEditSession()===session'), true);
  r('designUI.armed=false;designUIEditSync()');
  assert.equal(r('designUIEditSession()'), null);
  assert.equal(r('ship.parts[0].c[0]'), 9);
  assert.equal(r('undoStack.length'), 1);
});

test('cancel restores a newer editor generation and a late background resolution cannot revive its immediate reconnect draft', () => {
  const t=setup(),r=t.run;
  r("designUIEditBegin();mutate('move',()=>ship.parts[0].c[0]=6);designUI.replaceId=1;designUI.armed=true;designUIRequest({parentStructureId:2,p:[0,10,0],n:[0,1,0]});const requestGeneration=eng.gen;");
  assert.equal(r('ship.parts[0].placement.pendingGeometry'),true);
  assert.equal(r('requests.length'),0,'reconnection records its source without a strict request wait');
  t.context.packet=resolution(t);r('designUIEditCancel()');
  assert.equal(r('eng.gen>requestGeneration'), true);
  assert.equal(r('designUI.pending'), null);
  assert.equal(r('onEnginePlacementResolution(packet)'),false);
  assert.equal(r('designUI.pending'), null);
  assert.equal(r('ship.parts[0].c[0]'), 0);
  assert.equal(r('ship.parts.length'), 2);
  assert.equal(r('hoverLines'), null);
});

test('conditional parent deletion hides structure and fitting descendants together and session cancel restores the whole graph', () => {
  const {run:r} = setup();
  r("const childResult=C.commitPlacement(ship,{id:-1,k:'struct',form:'box',c:[0,0,0],s:[20,20,10]},{mode:'horizontal',parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});if(!childResult.ok)throw Error(childResult.error);const child=childResult.part;const fitting=C.solveFitPlacement(ship,{id:-1,k:'pd',p:[0,0,0],n:[0,1,0],a:2,ped:.3},{mode:'direct',hostId:child.id,hit:{p:[0,20,0],n:[0,1,0]}});if(!fitting.ok)throw Error(fitting.error);C.acceptPlacementResult(ship,fitting);ship.groups=[{id:ship.nextId++,parts:[1,child.id],fits:[ship.fits[0].id]}];ship=C.deserialize(C.serialize(ship),{deferPlacementGeometry:true});ship.saveId='session-source';const before=C.serialize(ship);designUIEditBegin();removeWithPreview('remove parent','parts',ship.parts[0]);");
  assert.deepEqual(plain(r('ship.parts.map(p=>p.id)')), [2]); assert.equal(r('ship.fits.length'), 0);
  const hidden = plain(r('calls.find(c=>c.preview).preview[2]'));
  assert.deepEqual(hidden.parts, [1, 3]); assert.deepEqual(hidden.fits, [4]);
  assert.equal(r('undoStack.length'), 1);
  r('designUIEditCancel()');
  assert.deepEqual(plain(r('C.serialize(ship)')), plain(r('before'))); assert.equal(r('ship.fits[0].host'), 3);
  assert.deepEqual(plain(r('ship.groups[0].parts')), [1, 3]); assert.deepEqual(plain(r('ship.groups[0].fits')), [4]);
});

test('applying a parent graph deletion keeps its fitting removal in the same Undo and Redo command', () => {
  const {run:r} = setup();
  r("const fitted=C.solveFitPlacement(ship,{id:-1,k:'pd',p:[0,0,0],n:[0,1,0],a:2,ped:.3},{mode:'direct',hostId:1,hit:{p:[0,10,0],n:[0,1,0]}});if(!fitted.ok)throw Error(fitted.error);C.acceptPlacementResult(ship,fitted);designUIEditBegin();removeWithPreview('remove parent','parts',ship.parts[0]);designUIEditApply();");
  assert.equal(r('ship.fits.length'), 0); assert.equal(r('undoStack.length'), 1);
  r('undo()'); assert.deepEqual(plain(r('ship.parts.map(p=>p.id)')), [1, 2]); assert.equal(r('ship.fits[0].host'), 1);
  r('redo()'); assert.deepEqual(plain(r('ship.parts.map(p=>p.id)')), [2]); assert.equal(r('ship.fits.length'), 0);
});

function bindHeaderActions(t){
 t.run(`
  const document={querySelector:s=>$('doc:'+s),addEventListener:(kind,listener)=>events.set('document:'+kind,listener),body:{classList:{contains:()=>true}}};
  for(const selector of ['#btnTrialQuick','#viewport','#dock','#designInspection','#inspBar','#panel','doc:.main']){const node=$(selector);node.insertAdjacentHTML=()=>{};node.append=()=>{};node.addEventListener=(kind,listener)=>events.set(selector+':'+kind,listener);}
  ${fn('bindDesignUI')}
  bindDesignUI();
  function headerAction(action){events.get('document:click')({target:{closest:()=>({dataset:{designAction:action}})}});}
 `);
}

test('the real Close action keeps changed inputs and compacts them into one Undo without an Apply button',()=>{
 const t=setup(),r=t.run;bindHeaderActions(t);
 r("designUI.layout='edit';designUIEditBegin();mutate('move',()=>ship.parts[0].c[0]=4);mutate('height',()=>ship.parts[0].s[2]=35);eng.waiting=true;headerAction('close')");
 assert.equal(r('ship.parts[0].c[0]'),4);assert.equal(r('ship.parts[0].s[2]'),35);assert.equal(r('designUI.drawer'),false);assert.equal(r('designUIEditSession()'),null);assert.equal(r('undoStack.length'),1);assert.equal(r('requests.length'),0,'closing never waits for a strict solve');
 assert.equal(r('designUISavedDesign().parts[0].s[2]'),35);r('undo()');assert.equal(r('ship.parts[0].c[0]'),0);assert.equal(r('ship.parts[0].s[2]'),20);r('redo()');assert.equal(r('ship.parts[0].s[2]'),35);assert.equal(r('designUI.drawer'),false);
 const panel=fn('designUIPanel');assert.match(panel,/data-design-action="edit-cancel">取消</);assert.doesNotMatch(panel,/data-design-action="edit-apply"/);
});

test('the real Cancel action restores source and history instead of taking the Close path',()=>{
 const t=setup(),r=t.run;bindHeaderActions(t);
 r("ship=C.deserialize(C.serialize(ship),{deferPlacementGeometry:true});ship.saveId='session-source';const original=snap();designUI.layout='edit';designUIEditBegin();mutate('move',()=>ship.parts[0].c[0]=20);headerAction('edit-cancel')");
 assert.equal(r('snap()===original'),true);assert.equal(r('undoStack.length'),0);assert.equal(r('designUIEditSession()'),null);assert.equal(r('designUI.drawer'),false);assert.equal(r('notices.at(-1)'),'編集を取り消しました');
});

test('Close keeps a pending reconnect source and its later Worker result does not reopen editing or add Undo',()=>{
 const t=setup(),r=t.run;bindHeaderActions(t);
 r("designUI.layout='edit';designUIEditBegin();designUI.replaceId=1;designUI.armed=true;designUIRequest({parentStructureId:2,p:[30,5,0],n:[0,1,0]});const id=ship.parts[0].id;headerAction('close')");
 assert.equal(r('ship.parts[0].placement.pendingGeometry'),true);assert.equal(r('designUIEditSession()'),null);assert.equal(r('undoStack.length'),1);const generation=r('eng.gen');t.context.packet=resolution(t);
 assert.equal(r('onEnginePlacementResolution(packet)'),true);assert.equal(r('eng.gen'),generation);assert.equal(r('ship.parts[0].id'),r('id'));assert.equal(r('ship.parts[0].placement.pendingGeometry'),undefined);assert.equal(r('designUI.drawer'),false);assert.equal(r('designUIEditSession()'),null);assert.equal(r('undoStack.length'),1);
 r('undo()');assert.equal(r('ship.parts[0].placement'),undefined);r('redo()');assert.equal(r('ship.parts[0].placement.parentStructureId'),2);
});

test('a clean Close preserves existing Redo and a new-placement Cancel creates no source or history',()=>{
 const t=setup(),r=t.run;bindHeaderActions(t);
 r("designUI.drawer=false;mutate('name',()=>ship.name='Redo name');undo();const redoBefore=redoStack.slice();designUI.drawer=true;designUI.layout='edit';designUIEditBegin();headerAction('close')");
 assert.deepEqual(plain(r('redoStack')),plain(r('redoBefore')));assert.equal(r('undoStack.length'),0);
 r("designUI.drawer=true;designUI.layout='new';const original=snap();headerAction('close')");assert.equal(r('snap()===original'),true);assert.equal(r('undoStack.length'),0);assert.equal(r('designUI.drawer'),false);
});

function bindNavigation(t){
 t.run(`
  const selClear=()=>{st.sel=null;st.multi={parts:new Set(),fits:new Set()};},xfReset=()=>{},syncHud=()=>{},trenchArmamentCancel=()=>{};let itemDrag=null;
  $('#dock').classList={remove(){}};$('#app').classList={remove(){}};
  ${fn('designUIOpen')}
  ${fn('designUISpace')}
 `);
}

test('selecting a second part and then leaving its tab retains both edits as independent Undo operations',()=>{
 const {run:r}=setup();
 r("designUI.layout='edit';designUIEditBegin();mutate('first',()=>ship.parts[0].c[0]=4);st.sel={list:'parts',id:2};st.multi={parts:new Set([2]),fits:new Set()};designUIEditSync();mutate('second',()=>ship.parts[1].c[1]=8);designUI.layout='performance';st.tab='spec';designUIEditSync()");
 assert.equal(r('ship.parts[0].c[0]'),4);assert.equal(r('ship.parts[1].c[1]'),8);assert.equal(r('undoStack.length'),2);assert.equal(r('designUIEditSession()'),null);assert.equal(r('designUI.layout'),'performance');assert.equal(r('designUI.drawer'),true);
 r('undo()');assert.equal(r('ship.parts[0].c[0]'),4);assert.equal(r('ship.parts[1].c[1]'),0);r('undo()');assert.equal(r('ship.parts[0].c[0]'),0);r('redo();redo()');assert.equal(r('ship.parts[0].c[0]'),4);assert.equal(r('ship.parts[1].c[1]'),8);
});

test('opening another panel keeps the edit and preserves the requested navigation destination',()=>{
 for(const destination of ['list','performance','new']){
  const t=setup(),r=t.run;bindNavigation(t);
  r("designUI.layout='edit';designUIEditBegin();mutate('first',()=>ship.parts[0].c[0]=4);designUIOpen("+JSON.stringify(destination)+")");
  assert.equal(r('ship.parts[0].c[0]'),4,destination);assert.equal(r('undoStack.length'),1,destination);assert.equal(r('designUI.layout'),destination);assert.equal(r('designUI.drawer'),true);assert.equal(r('designUIEditSession()'),null);
  assert.equal(r('st.tab'),destination==='new'?'mod':destination==='performance'?'spec':'edit');assert.equal(r('ship.parts.length'),2,'opening new settings never places a part');
  r('undo()');assert.equal(r('ship.parts[0].c[0]'),0);r('redo()');assert.equal(r('ship.parts[0].c[0]'),4);
 }
});

test('switching exterior to interior keeps the prior edit while clearing the old selection and pending tool',()=>{
 const t=setup(),r=t.run;bindNavigation(t);
 r("designUI.layout='edit';designUIEditBegin();mutate('first',()=>ship.parts[0].c[0]=4);designUISpace('interior')");
 assert.equal(r('ship.parts[0].c[0]'),4);assert.equal(r('undoStack.length'),1);assert.equal(r('designUIEditSession()'),null);assert.equal(r('designUI.space'),'interior');assert.equal(r('designUI.layout'),'edit');assert.equal(r('designUI.drawer'),true);assert.equal(r('st.sel'),null);assert.equal(r('st.view'),'xray');assert.equal(r('designUI.armed'),false);
 r('undo()');assert.equal(r('ship.parts[0].c[0]'),0);r('redo()');assert.equal(r('ship.parts[0].c[0]'),4);
});
