const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const c=vm.createContext({console,navigator:{language:'en-US'}});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
 const run=code=>vm.runInContext(code,c);run(`
 const C=Core,st={tab:'edit',part:'engine',partTool:'select',mirror:true,vmirror:false,engineDir:[-1,0,0],engineSizes:{},multi:{parts:new Set([1,2,3]),fits:new Set()},sel:{list:'parts',id:1}},undoStack=[],redoStack=[],messages=[],eng={gen:0,adoptedGen:0,statsGen:0};
 let ship=C.newShip({L:100,W:80,H:40,plan:'rect',sec:'rect'},'Engine UI'),S=null,dragSnap=null,dragLabel='',lastOp='',renders=0;
 ship.parts=[];ship.fits=[];ship.nextId=4;
 function engine(id,z){const p={id,k:'engine',c:[20,20,z],d:1,nozzleLength:.32,dir:[-1,0,0],reactor:0};const r=C.updateEngineSpec(p,{machineryDiameterM:2,machineryLengthM:2},ship);if(!r.ok)throw Error(r.issues);return p;}
 function core(id,z,reactor=0){return {id,k:'engineCore',c:[35,20,z],d:2,length:2,dir:[-1,0,0],reactor,propulsionModelVersion:1,driveProfileId:'standard',legacyCoolingInputW:0};}
 ship.parts=[engine(1,10),engine(2,-10),engine(3,25)];ship.parts[0].tw=2;ship.parts[1].tw=1;
 const selItem=()=>ship.parts.find(p=>p.id===st.sel?.id),multiItems=()=>({parts:ship.parts.filter(p=>st.multi.parts.has(p.id)),fits:[]}),activeEquipment=()=>st.equipmentId?C.EQUIPMENT[st.equipmentId]:null;
 const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),num=(v,d=0)=>Number(v).toFixed(d),sci=v=>String(v),fW=v=>v+' W',fCr=v=>v+' cr',fmtM=v=>v+' m',fLen=v=>v+' m',deg=v=>v+'°',slider=()=>'';
 let genericSize=1;const pSize=()=>genericSize,setPSize=(k,v)=>genericSize=v,enginePending=()=>false,queuePreview=()=>{},renderPanel=()=>renders++,updateHint=()=>{},touch=()=>eng.gen++,scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},sndEdit=()=>{},sndUI=()=>{},toast=s=>messages.push(s);
 const snap=()=>JSON.stringify(C.serialize(ship)),restore=json=>ship=C.deserialize(JSON.parse(json));
 function assignMirror(target,q){const id=target.id,tw=target.tw,vt=target.vt;Object.assign(target,q,{id});if(tw!=null)target.tw=tw;if(vt!=null)target.vt=vt;}
 // Prepare the same derived data that the real worker supplies, outside the
 // rendering call. Panels must read this generation instead of solving routes.
 function settleRoutes(){ship._editorSnapshot={transmission:C.engineTransmission(ship),drive:C.engineDriveRoutes(ship)};ship._editorSnapshotGen=eng.gen;eng.adoptedGen=eng.gen;eng.statsGen=eng.gen;}
 `);
 function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
 section('const requestedParts =','function editorRayEnv(');
 section('function editorSnapshotForUI()', 'function editorCommandCompartments(');
 section('function xfFollowers(', '// Shapes as requested');section('function mutate(', 'function updateUndo(');
 section('// Engine edits share the same action', 'function v3PartEditor(');section('function pendingEngine(', 'function equipmentInfo(');
 run(`let focused=null;const scopeRoot=()=>null,current=()=>focused,Event=class{constructor(type,options){this.type=type;this.bubbles=options?.bubbles;}};`);section('function adjustFocused(', 'function activateFocused(');
 return run;
}
test('engine editor keeps physical machinery and drive controls while source capacity replaces manual input limits',()=>{
 const run=setup(),html=run('engineSpecControls(selItem())');
 for(const field of ['driveProfileId','machineryDiameterM','machineryLengthM','machineryOffsetM','d','nozzleLength'])assert.match(html,new RegExp('data-engine-field="'+field+'"'));
 for(const field of ['ratedInputW','machineryGradeId','wattsPerNewton'])assert.doesNotMatch(html,new RegExp('data-engine-field="'+field+'"'));
 assert.match(html,/接続炉からの最大入力/);assert.match(html,/未判定（熱平衡未解決）/);assert.doesNotMatch(html,/容積・仕様による入力上限|通常定格に対する入力倍率|定格・高密度化の追加費用|NaN|Infinity/);
 assert.doesNotMatch(html,/<option value="legacy/);
});
test('nozzle-only edits preserve each physical machine through Undo and Redo',()=>{
 const run=setup(),before=plain(run('ship.parts.map(engineSpecSnapshot)'));
 assert.equal(run('engineSpecAction("d",3)'),true);assert.equal(run('engineSpecAction("nozzleLength",.75)'),true);
 assert.deepEqual(plain(run('ship.parts.map(engineSpecSnapshot)')),before);assert.deepEqual(plain(run('ship.parts.map(p=>p.d)')),[3,3,3]);assert.deepEqual(plain(run('ship.parts.map(p=>p.nozzleLength)')),[.75,.75,.75]);
 assert.equal(run('undoStack.length'),2);run('undo();undo()');assert.deepEqual(plain(run('ship.parts.map(p=>p.d)')),[1,1,1]);run('redo();redo()');assert.deepEqual(plain(run('ship.parts.map(engineSpecSnapshot)')),before);assert.deepEqual(plain(run('ship.parts.map(p=>p.nozzleLength)')),[.75,.75,.75]);
});
test('one batch machinery resize edits selected machines and symmetry followers in one Undo step',()=>{
 const run=setup(),before=plain(run('ship.parts.map(engineSpecSnapshot)'));run('st.multi.parts=new Set([1,3])');assert.equal(run('engineSpecAction("machineryLengthM",3)'),true);
 assert.deepEqual(plain(run('ship.parts.map(p=>C.resolveEngineSpec(p,ship).machineryLengthM)')),[3,3,3]);assert.equal(run('undoStack.length'),1);assert.equal(run('ship.parts[0].tw'),2);assert.equal(run('ship.parts[1].tw'),1);
 run('undo()');assert.deepEqual(plain(run('ship.parts.map(engineSpecSnapshot)')),before);run('redo()');assert.deepEqual(plain(run('ship.parts.map(p=>C.resolveEngineSpec(p,ship).machineryLengthM)')),[3,3,3]);
});
test('retired input-limit actions and invalid machinery dimensions never partially mutate a selected batch',()=>{
 const run=setup(),before=run('snap()');
 for(const expression of ['engineSpecAction("ratedInputW",1.1e18)','engineSpecAction("machineryGradeId","advanced")','engineSpecAction("machineryLengthM",-1)']){
  assert.equal(run(expression),false);assert.equal(run('snap()'),before);assert.equal(run('undoStack.length'),0);
 }
 assert.match(run('messages.at(-1)'),/形状|寸法|内部機関/);
});
test('appearance edits preserve unequal machinery and editing a real body updates its linked nozzle dimensions',()=>{
 const run=setup();run('ship.parts[1].machineryLengthM=3');const before=plain(run('ship.parts.map(engineSpecSnapshot)'));
 assert.equal(run('engineSpecAction("d",2)'),true);assert.deepEqual(plain(run('ship.parts.map(engineSpecSnapshot)')),before);
 run('ship.parts.push(core(4,25));ship.nextId=5;ship.parts[2].machineryId=4;st.multi.parts=new Set([4]);st.sel={list:"parts",id:4}');assert.equal(run('engineSpecAction("machineryLengthM",4)'),true);
 assert.equal(run('ship.parts.find(p=>p.id===4).length'),4);assert.equal(run('C.resolveEngineSpec(ship.parts[2],ship).machineryLengthM'),4);assert.equal(run('ship.parts[2].machineryLengthM'),2);assert.equal(run('ship.parts[0].machineryLengthM'),2);
});
test('a linked nozzle opens its real body editor and the body reactor selector uses the bound action and Undo',()=>{
 const run=setup();run(`ship.parts.push({id:4,k:'gen',c:[50,20,15],d:5},{id:5,k:'aux',c:[60,20,15],d:3},core(7,25,4));ship.nextId=8;ship.parts[2].machineryId=7;ship.parts[2].reactor=0;st.multi.parts=new Set([3]);st.sel={list:'parts',id:3};`);
 assert.match(run('engineControls(selItem(),true)'),/data-goto="7"/);assert.doesNotMatch(run('engineControls(selItem(),true)'),/data-engine-field="ratedInputW"/);assert.doesNotMatch(run('engineControls(selItem(),true)'),/data-reactor="selected"/);run(`st.multi.parts=new Set([7]);st.sel={list:'parts',id:7};`);assert.match(run('engineControls(selItem(),true)'),/<option value="4" selected>/);assert.doesNotMatch(run('engineControls(selItem(),true)'),/<option value="0" selected>/);
 const a=app.indexOf("  $('#panel').addEventListener('change',e=>{\n    const t=e.target;if(!t.dataset.reactor)return;"),b=app.indexOf("  $('#panel').addEventListener('input',e=>{",a);assert.ok(a>=0&&b>a);
 run(`let reactorRouteChange;(()=>{const $=()=>({addEventListener:(type,fn)=>reactorRouteChange=fn});${app.slice(a,b)}})();reactorRouteChange({target:{dataset:{reactor:'selected',engineRoute:'1'},value:'5'}});`);
 assert.equal(run('ship.parts.find(p=>p.id===7).reactor'),5);assert.equal(run('ship.parts[2].reactor'),0);assert.equal(run('C.resolveEngineSpec(selItem(),ship).reactorId'),5);assert.equal(run('undoStack.length'),1);
 assert.match(run('engineControls(selItem(),true)'),/<option value="5" selected>/);run('undo()');assert.equal(run('ship.parts.find(p=>p.id===7).reactor'),4);run('redo()');assert.equal(run('ship.parts.find(p=>p.id===7).reactor'),5);
 run(`reactorRouteChange({target:{dataset:{reactor:'selected',engineRoute:'1'},value:'auto'}})`);assert.equal(run('Object.hasOwn(ship.parts.find(p=>p.id===7),"reactor")'),false);assert.equal(run('ship.parts[2].reactor'),0);
});
test('shared outlet connection batches resolve mirrored owner and reactor IDs once and reject broken owners atomically',()=>{
 const run=setup();run(`ship.parts[2].machineryId=7;ship.parts[2].tw=6;const other=engine(6,-25);other.machineryId=8;other.tw=3;const left=core(7,10),right=core(8,-10);left.tw=8;right.tw=7;ship.parts.push(other,{id:4,k:'gen',c:[50,20,15],d:5,tw:5},{id:5,k:'gen',c:[50,20,-15],d:5,tw:4},left,right);ship.nextId=9;st.multi.parts=new Set([3,6]);st.sel={list:'parts',id:3};`);
 assert.equal(run('engineConnectionAction("4")'),true);assert.deepEqual(plain(run('ship.parts.filter(p=>p.id===7||p.id===8).map(p=>p.reactor)')),[4,5]);assert.deepEqual(plain(run('ship.parts.filter(p=>p.id===3||p.id===6).map(p=>p.reactor)')),[0,0]);assert.equal(run('undoStack.length'),1);
 run('undo();ship.parts.find(p=>p.id===6).machineryId=999');const before=run('snap()');assert.equal(run('engineConnectionAction("4")'),false);assert.equal(run('snap()'),before);assert.equal(run('undoStack.length'),0);assert.match(run('messages.at(-1)'),/共有機関/);
});
test('the bound selector connects a real body and disconnects its nozzle without creating another machine',()=>{
 const run=setup();run(`ship.parts.push(core(4,25));ship.nextId=5;st.mirror=false;st.multi.parts=new Set([3]);st.sel={list:'parts',id:3};`);const stored=plain(run('({...engineSpecSnapshot(selItem()),d:selItem().d,nozzleLength:selItem().nozzleLength,dir:selItem().dir,c:selItem().c})'));
 assert.match(run('engineMachineryControls(selItem())'),/<option value="self" selected>/);
 const binding=app.indexOf('function bindEngineering()'),a=app.indexOf("  $('#panel').addEventListener('change',e=>{",binding),b=app.indexOf('\n',a);assert.ok(binding>=0&&a>binding&&b>a);assert.match(app.slice(a,b),/'engineMachinery'in t.dataset/);
 run(`let machineryChange;(()=>{const $=()=>({addEventListener:(type,fn)=>machineryChange=fn}),trenchArmamentInput=()=>false;${app.slice(a,b)}})();machineryChange({target:{dataset:{engineMachinery:''},value:'4'}});`);
 assert.equal(run('selItem().machineryId'),4);assert.equal(run('C.resolveEngineSpec(selItem(),ship).availableInputW'),0,'the selected body is physically valid but explicitly disconnected');assert.equal(run('undoStack.length'),1);assert.match(run('engineMachineryControls(selItem())'),/<option value="4" selected>/);assert.doesNotMatch(run('engineMachineryControls(selItem())'),/<option value="self"/);assert.match(run('engineControls(selItem(),true)'),/data-goto="4"/);assert.doesNotMatch(run('engineControls(selItem(),true)'),/data-engine-field="ratedInputW"/);
 assert.deepEqual(plain(run('({...engineSpecSnapshot(selItem()),d:selItem().d,nozzleLength:selItem().nozzleLength,dir:selItem().dir,c:selItem().c})')),stored);
 run('undo()');assert.equal(run('selItem().machineryId'),undefined);run('redo()');assert.equal(run('selItem().machineryId'),4);run(`machineryChange({target:{dataset:{engineMachinery:''},value:'0'}})`);
 assert.equal(run('selItem().machineryId'),0);assert.equal(run('C.resolveEngineSpec(selItem(),ship).valid'),false);assert.equal(run('ship.parts.filter(p=>p.k==="engineCore").length'),1);assert.equal(run('C.resolveEngineSpec(ship.parts.find(p=>p.id===4),ship).availableInputW'),0);assert.deepEqual(plain(run('({...engineSpecSnapshot(selItem()),d:selItem().d,nozzleLength:selItem().nozzleLength,dir:selItem().dir,c:selItem().c})')),stored);run('undo()');assert.equal(run('selItem().machineryId'),4);assert.equal(run('C.resolveEngineSpec(selItem(),ship).valid'),true);
 for(const value of ['接続する内部機関','このノズル専用の内部機関','内部機関 #1'])assert.doesNotMatch(run('KSI18n.t('+JSON.stringify(value)+')'),/[\u3040-\u30ff\u3400-\u9fff]/);
});
test('machinery linking maps mirrored real bodies atomically and rejects nozzles or missing bodies as sources',()=>{
 const run=setup();run(`ship.parts[2].tw=6;const outlet=engine(6,-25);outlet.tw=3;const left=core(7,10),right=core(8,-10);left.tw=8;right.tw=7;ship.parts.push(outlet,left,right);ship.nextId=9;st.multi.parts=new Set([3,6]);st.sel={list:'parts',id:3};`);
 assert.equal(run('engineMachineryAction("7")'),true);assert.deepEqual(plain(run('ship.parts.filter(p=>p.id===3||p.id===6).map(p=>p.machineryId)')),[7,8]);assert.equal(run('undoStack.length'),1);assert.doesNotMatch(run('engineMachineryControls(selItem())'),/<option value="6"/);assert.doesNotMatch(run('engineMachineryControls(selItem())'),/<option value="1"/);assert.equal(run('engineConnectionOwner(ship.parts[2]).id'),7);
 let before=run('snap()');for(const id of [1,3,999]){assert.equal(run('engineMachineryAction('+id+')'),false);assert.equal(run('snap()'),before);}assert.equal(run('undoStack.length'),1);
 run('undo();ship.parts=ship.parts.filter(p=>p.id!==8)');before=run('snap()');assert.equal(run('engineMachineryAction("7")'),false);assert.equal(run('snap()'),before);assert.equal(run('undoStack.length'),0);
 for(const code of ['machinery-owner-in-use','machinery-connection-cycle'])assert.doesNotMatch(run('KSI18n.t(engineReasonText('+JSON.stringify(code)+'))'),/[\u3040-\u30ff\u3400-\u9fff]/);
});
test('pending generic and model engines preserve physical machinery across appearance edits and placement previews',()=>{
 const run=setup();run('st.multi.parts.clear();st.sel=null');assert.equal(run('engineSpecAction("d",2,true)'),true);const generic=plain(run('engineSpecSnapshot(pendingGenericEngine())'));
 assert.equal(run('pendingGenericEngine().d'),2);assert.equal(run('engineSpecAction("nozzleLength",.8,true)'),true);assert.deepEqual(plain(run('engineSpecSnapshot(pendingGenericEngine())')),generic);
 run('st.equipmentId="internalTurbine"');const model=plain(run('engineSpecSnapshot(pendingEngine(activeEquipment()))'));
 assert.equal(run('engineSpecAction("d",60,true)'),true);assert.deepEqual(plain(run('engineSpecSnapshot(pendingEngine(activeEquipment()))')),model);assert.equal(run('undoStack.length'),0);
});
test('new machinery derives available input from its real reactor rather than volume or a saved manual rating',()=>{
 const run=setup();run(`st.multi.parts.clear();st.sel=null;st.part='engineCore';const fresh=pendingEngineCore();`);
 assert.equal(run('Object.hasOwn(fresh,"ratedInputW")'),false);assert.equal(run('Object.hasOwn(fresh,"machineryGradeId")'),false);assert.equal(run('C.resolveEngineSpec(fresh,ship).availableInputW'),0);
 run(`ship.parts.push({id:4,k:'gen',c:[60,20,15],d:2},{id:5,k:'aux',c:[70,20,15],d:3});ship.nextId=6;fresh.reactor=4;`);
 const first=run('C.resolveEngineSpec(fresh,ship).availableInputW');assert.equal(first,run('C.reactorPower(ship.parts.find(p=>p.id===4))'));assert.ok(first>0);
 run('ship.parts.find(p=>p.id===4).d=2.5');assert.equal(run('C.resolveEngineSpec(fresh,ship).availableInputW'),run('C.reactorPower(ship.parts.find(p=>p.id===4))'),'the displayed source maximum follows a reactor resize without an engine rating edit');
 run('fresh.reactor=5');const second=run('C.resolveEngineSpec(fresh,ship).availableInputW');assert.equal(second,run('C.reactorPower(ship.parts.find(p=>p.id===5))'));assert.notEqual(second,first);
 run('fresh.ratedInputW=1;fresh.machineryGradeId="legacy-refit"');assert.equal(run('C.resolveEngineSpec(fresh,ship).availableInputW'),second,'an old manual limit cannot throttle the reactor-derived maximum');
 run('fresh.ratedInputW=1e30;fresh.d=.1;fresh.length=.1');assert.equal(run('C.resolveEngineSpec(fresh,ship).availableInputW'),second,'small valid machinery is not given an artificial volume input cap');
 const html=run('engineSpecControls(fresh,true)');assert.match(html,/接続炉からの最大入力/);assert.match(html,/放熱面・排熱設備/);assert.doesNotMatch(html,/data-engine-field="ratedInputW"|data-engine-field="machineryGradeId"|通常定格入力|通常定格に対する入力倍率|NaN|Infinity/);
});
test('an external integrated engine cannot be rebound to an independent core through a mixed selection',()=>{
 const run=setup();run(`ship.parts[0].equipmentId='exposedTurbine';ship.parts.push(core(4,25));ship.nextId=5;st.multi.parts=new Set([1,3]);st.sel={list:'parts',id:1};`);const before=run('snap()');
 assert.equal(run('engineMachineryAction("4")'),false);assert.equal(run('snap()'),before);assert.equal(run('undoStack.length'),0);assert.match(run('messages.at(-1)'),/外部機関.*一体/);
});
test('engine diagnostics and full editor strings translate to English',()=>{
 const run=setup();run('C.propulsionPreview=()=>{throw Error("UI cannot solve physical preview")};S={propulsion:{preset:"combat",engines:[{id:1,actualInputW:0,actualThrustN:0,wasteHeatW:0,reasons:["overheat","unconnected"]}]}}');
 const html=run('engineSpecControls(selItem())');const text=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]).filter(s=>s.trim());
 for(const value of text){const result=run('KSI18n.t('+JSON.stringify(value)+')');assert.doesNotMatch(result,/[\u3040-\u30ff\u3400-\u9fff]/,value);}
 assert.match(run('enginePerformance(selItem())'),/局所過熱/);assert.equal(run('KSI18n.t(engineReasonText("overheat"))'),'Local Overheating');
});
test('independent core, nozzle and electrical/shaft panels translate their user-facing text',()=>{
 const run=setup();run(`const fMass=v=>v+' t',ja=v=>String(v);ship.parts.push(core(4,25,5),{id:5,k:'gen',c:[70,20,25],d:4},{id:6,k:'powerBus',c:[55,20,25],d:2,room:[2,2,2]});ship.nextId=7;ship.links=[{kind:'power',from:'p5',to:'p6',cap:1e18},{kind:'power',from:'p6',to:'p4',cap:1e18}];ship.parts[2].machineryId=4;st.mirror=false;st.multi.parts=new Set([4]);st.sel={list:'parts',id:4};settleRoutes();C.engineTransmission=C.engineDriveRoutes=()=>{throw Error('UI cannot solve engineering routes')};`);
 assert.match(run('engineTransmissionSystemsHTML()'),/id="engine-transmission-editor"/);assert.match(run('engineDriveSystemsHTML()'),/id="engine-drive-editor"/);
 const untranslated=[];
 for(const expression of ['engineControls(ship.parts.find(p=>p.id===4),true)','engineControls(ship.parts.find(p=>p.id===3),true)','engineTransmissionSystemsHTML()','engineDriveSystemsHTML()']){
  const html=run(expression),text=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]).filter(s=>s.trim());
  for(const value of text)if(/[\u3040-\u30ff\u3400-\u9fff]/.test(run('KSI18n.t('+JSON.stringify(value)+')')))untranslated.push(value);
 }
 assert.deepEqual(untranslated,[]);
 for(const label of ['副推進機関 4','ノズル直結推進機関 1'])assert.doesNotMatch(run('KSI18n.t('+JSON.stringify(label)+')'),/[\u3040-\u30ff\u3400-\u9fff]/);
 assert.doesNotMatch(run('KSI18n.t(engineReasonText("external-engine-sharing"))'),/[\u3040-\u30ff\u3400-\u9fff]/);
});
test('external units keep their body at the nozzle throat while appearance changes preserve one integrated unit',()=>{
 const run=setup();run(`st.tab='mod';st.part='engine';st.equipmentId='exposedTurbine';st.mirror=false;st.multi.parts.clear();st.sel=null;`);
 assert.equal(run(`pendingEngine(C.EQUIPMENT.exposedTurbine).machineryOffsetM===pendingEngine(C.EQUIPMENT.exposedTurbine).nozzleLength/2`),true);
 const html=run(`engineSpecControls(pendingEngine(C.EQUIPMENT.exposedTurbine),true)`);assert.doesNotMatch(html,/data-engine-field="machineryOffsetM"/);assert.match(html,/data-engine-field="machineryLengthM"/);assert.match(html,/外部機関は機関本体とノズルが一体/);
 assert.equal(run(`engineSpecAction('nozzleLength',.8,true)`),true);assert.equal(run(`pendingEngine(C.EQUIPMENT.exposedTurbine).machineryOffsetM`),.4);
 run(`st.equipmentId=null;st.sel={list:'parts',id:3};st.multi.parts=new Set([3]);ship.parts[2].equipmentId='exposedTurbine';ship.parts[2].machineryOffsetM=ship.parts[2].nozzleLength/2;const before=ship.parts[2].c.slice();`);
 assert.equal(run(`engineSpecAction('nozzleLength',.8)`),true);assert.equal(run(`ship.parts[2].machineryOffsetM`),.4);assert.deepEqual(plain(run('ship.parts[2].c')),plain(run('before')));assert.equal(run(`C.resolveEngineSpec(ship.parts[2],ship).issues.includes('external-engine-detached')`),false);
 assert.doesNotMatch(run('KSI18n.t(engineReasonText("external-engine-detached"))'),/[\u3040-\u30ff\u3400-\u9fff]/);
});
test('an independent nozzle selection strip displays the connected body source capacity without duplicating thrust',()=>{
 const run=setup();run(`ship.parts.push(core(4,25,5),{id:5,k:'gen',c:[60,20,25],d:3});ship.nextId=6;ship.parts[2].machineryId=4;const precisePartSize=()=>false;`);
 const start=app.indexOf('function stripFacts('),end=app.indexOf('function renderSelStrip(',start);run(app.slice(start,end));
 const facts=run(`stripFacts({list:'parts',it:ship.parts[2]}).line`),capacity=run('C.reactorPower(ship.parts.find(p=>p.id===5))');
 assert.match(facts,/接続機関の最大入力/);assert.ok(facts.includes(capacity+' W'));assert.doesNotMatch(facts,/推力/);
});
test('an integrated nozzle selection strip obtains nonzero thrust from its actual connected reactor',()=>{
 const run=setup();run(`ship.parts.push({id:4,k:'gen',c:[70,20,0],d:4});ship.parts[0].reactor=4;const precisePartSize=()=>false;`);
 const start=app.indexOf('function stripFacts('),end=app.indexOf('function renderSelStrip(',start);run(app.slice(start,end));
 const thrust=run('C.resolveEngineSpec(ship.parts[0],ship).ratedThrustN');assert.ok(thrust>0,'the actual connected source supports positive thrust');
 const facts=run(`stripFacts({list:'parts',it:ship.parts[0]}).line`);assert.ok(facts.includes('推力 '+thrust+' N'),'the readout must resolve the nozzle in its ship context');assert.doesNotMatch(facts,/接続機関の最大入力/);
});
test('gamepad nudges unrestricted machinery dimensions through the same validated action and Undo',()=>{
 const run=setup();run(`const events=[];focused={tagName:'INPUT',type:'number',step:'any',min:'.01',max:'100',value:'2',dataset:{engineStep:'.01'},stepUp(){throw Error('step any');},dispatchEvent(e){events.push(e.type);if(e.type==='change')engineSpecAction('machineryLengthM',this.value);}};`);
 assert.equal(run('adjustFocused("right")'),true);assert.deepEqual(plain(run('events')),['input','change']);assert.deepEqual(plain(run('ship.parts.map(p=>p.machineryLengthM)')),[2.01,2.01,2.01]);assert.equal(run('undoStack.length'),1);run('undo()');assert.equal(run('ship.parts[0].machineryLengthM'),2);
});
test('worker statistics refresh shows performance without repeating the 系統 propulsion card',()=>{
 const run=setup();run(`C.propulsionPreview=(ship,stats)=>stats.propulsion;S={propulsion:{ratedInputW:3e18,ratedThrustN:1.5e9,actualInputW:1e18,actualThrustN:5e8,wasteHeatW:5e16,engines:[]}};st.tab='spec';const main={innerHTML:''},side={innerHTML:''},$=s=>s==='#specSide'?side:s==='#panel .spec-wrap'?main:null,fleet={mode:'design'},isWide=()=>true,trialCardHTML=()=>'',specHTML=(S,o={})=>'<p>Legacy performance'+(o.warnings===false?'':' with warnings')+'</p>',specExtrasHTML=()=>'<div class="spec-carry"></div>',compactSpec=()=>{};`);
 const a=app.indexOf('function renderSpecTargets()'),b=app.indexOf('const isWide =',a);run(app.slice(a,b));run('renderSpecTargets()');
 // The propulsion diagnosis lives in 系統 only; 性能 carries the summary, the carry section and (in the tab) the warnings.
 for(const html of [run('main.innerHTML'),run('side.innerHTML')]){assert.doesNotMatch(html,/propulsion-preview/);assert.match(html,/spec-carry/);}
 assert.match(run('main.innerHTML'),/with warnings/);assert.doesNotMatch(run('side.innerHTML'),/with warnings/,'the sidebar leaves the warnings to the 点検 bar');
});

test('external cylinder shape survives saved machinery snapshots and repeated palette edits',()=>{
 const run=setup();run(`st.equipmentId='exposedTurbine';st.multi.parts.clear();st.sel=null;const body=pendingEngine(activeEquipment());body.machineryShape='cylinder';body.machineryLengthM=20;body.machineryRadiusM=4;st.engineSizes.exposedTurbine={...engineSpecSnapshot(body),d:body.d,engineLength:body.engineLength,nozzleLength:body.nozzleLength};`);
 assert.equal(run('engineSpecSnapshot(pendingEngine(activeEquipment())).machineryShape'),'cylinder');const volume=run('C.resolveEngineSpec(pendingEngine(activeEquipment()),ship).effectiveMachineryVolumeM3');assert.equal(run('engineSpecAction("d",12,true)'),true);assert.equal(run('st.engineSizes.exposedTurbine.machineryShape'),'cylinder');assert.equal(run('C.resolveEngineSpec(pendingEngine(activeEquipment()),ship).effectiveMachineryVolumeM3'),volume);
});
