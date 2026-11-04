const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const c=vm.createContext({console,navigator:{language:'en-US'}});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
 const run=code=>vm.runInContext(code,c);run(`
 const C=Core,st={tab:'edit',part:'engine',partTool:'select',mirror:true,vmirror:false,engineDir:[-1,0,0],engineSizes:{},multi:{parts:new Set([1,2,3]),fits:new Set()},sel:{list:'parts',id:1}},undoStack=[],redoStack=[],messages=[],eng={gen:0};
 let ship=C.newShip({L:100,W:80,H:40,plan:'rect',sec:'rect'},'Engine UI'),S=null,dragSnap=null,dragLabel='',lastOp='',renders=0;
 ship.parts=[];ship.fits=[];ship.nextId=4;
 function engine(id,z){const p={id,k:'engine',c:[20,20,z],d:1,nozzleLength:.32,dir:[-1,0,0],reactor:0};const r=C.updateEngineSpec(p,{ratedInputW:1e18,machineryDiameterM:2,machineryLengthM:2});if(!r.ok)throw Error(r.issues);return p;}
 ship.parts=[engine(1,10),engine(2,-10),engine(3,25)];ship.parts[0].tw=2;ship.parts[1].tw=1;
 const selItem=()=>ship.parts.find(p=>p.id===st.sel?.id),multiItems=()=>({parts:ship.parts.filter(p=>st.multi.parts.has(p.id)),fits:[]}),activeEquipment=()=>st.equipmentId?C.EQUIPMENT[st.equipmentId]:null;
 const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),num=(v,d=0)=>Number(v).toFixed(d),sci=v=>String(v),fW=v=>v+' W',fCr=v=>v+' cr',fmtM=v=>v+' m',fLen=v=>v+' m',deg=v=>v+'°',slider=()=>'';
 let genericSize=1;const pSize=()=>genericSize,setPSize=(k,v)=>genericSize=v,enginePending=()=>false,queuePreview=()=>{},renderPanel=()=>renders++,updateHint=()=>{},touch=()=>eng.gen++,scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},sndEdit=()=>{},sndUI=()=>{},toast=s=>messages.push(s);
 const snap=()=>JSON.stringify(C.serialize(ship)),restore=json=>ship=C.deserialize(JSON.parse(json));
 function assignMirror(target,q){const id=target.id,tw=target.tw,vt=target.vt;Object.assign(target,q,{id});if(tw!=null)target.tw=tw;if(vt!=null)target.vt=vt;}
 `);
 function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
 section('function xfFollowers(', '// Shapes as requested');section('function mutate(', 'function updateUndo(');
 section('// Engine edits share the same action', 'function v3PartEditor(');section('function pendingEngine(', 'function equipmentInfo(');
 run(`let focused=null;const scopeRoot=()=>null,current=()=>focused,Event=class{constructor(type,options){this.type=type;this.bubbles=options?.bubbles;}};`);section('function adjustFocused(', 'function activateFocused(');
 return run;
}
test('engine editor exposes independent machinery and fixed profiles with honest unresolved endurance',()=>{
 const run=setup(),html=run('engineSpecControls(selItem())');
 for(const field of ['ratedInputW','driveProfileId','machineryGradeId','machineryDiameterM','machineryLengthM','machineryOffsetM','d','nozzleLength'])assert.match(html,new RegExp('data-engine-field="'+field+'"'));
 assert.doesNotMatch(html,/data-engine-field="wattsPerNewton"/);assert.match(html,/入力から推力への係数（固定）/);assert.match(html,/未判定（熱平衡未解決）/);
 assert.doesNotMatch(html,/<option value="legacy/);assert.match(html,/data-engine-field="ratedInputW"[^>]*max="/);
});
test('nozzle-only edits preserve each machine rating and geometry through Undo and Redo',()=>{
 const run=setup(),before=plain(run('ship.parts.map(engineSpecSnapshot)'));
 assert.equal(run('engineSpecAction("d",3)'),true);assert.equal(run('engineSpecAction("nozzleLength",.75)'),true);
 assert.deepEqual(plain(run('ship.parts.map(engineSpecSnapshot)')),before);assert.deepEqual(plain(run('ship.parts.map(p=>p.d)')),[3,3,3]);assert.deepEqual(plain(run('ship.parts.map(p=>p.nozzleLength)')),[.75,.75,.75]);
 assert.equal(run('undoStack.length'),2);run('undo();undo()');assert.deepEqual(plain(run('ship.parts.map(p=>p.d)')),[1,1,1]);run('redo();redo()');assert.deepEqual(plain(run('ship.parts.map(engineSpecSnapshot)')),before);assert.deepEqual(plain(run('ship.parts.map(p=>p.nozzleLength)')),[.75,.75,.75]);
});
test('one batch rating action edits selected machines and symmetry followers in one Undo step',()=>{
 const run=setup();run('st.multi.parts=new Set([1,3])');assert.equal(run('engineSpecAction("ratedInputW",1.1e18)'),true);
 assert.deepEqual(plain(run('ship.parts.map(p=>p.ratedInputW)')),[1.1e18,1.1e18,1.1e18]);assert.equal(run('undoStack.length'),1);assert.equal(run('ship.parts[0].tw'),2);assert.equal(run('ship.parts[1].tw'),1);
 run('undo()');assert.deepEqual(plain(run('ship.parts.map(p=>p.ratedInputW)')),[1e18,1e18,1e18]);run('redo()');assert.deepEqual(plain(run('ship.parts.map(p=>p.ratedInputW)')),[1.1e18,1.1e18,1.1e18]);
});
test('a density overflow rejects a complete batch before mutating any engine',()=>{
 const run=setup();run('ship.parts[2].ratedInputW=1e15;ship.parts[2].machineryLengthM=.1;ship.parts[2].machineryRadiusM=.1');const before=run('snap()');
 assert.equal(run('engineSpecAction("ratedInputW",1.1e18)'),false);assert.equal(run('snap()'),before);assert.equal(run('undoStack.length'),0);assert.match(run('messages.at(-1)'),/入力密度/);
});
test('appearance edits preserve unequal mirrored machinery and shared-nozzle specification edits reach its owner once',()=>{
 const run=setup();run('ship.parts[1].ratedInputW=8e17;ship.parts[1].machineryLengthM=3');const before=plain(run('ship.parts.map(engineSpecSnapshot)'));
 assert.equal(run('engineSpecAction("d",2)'),true);assert.deepEqual(plain(run('ship.parts.map(engineSpecSnapshot)')),before);
 run('ship.parts[2].machineryId=1;st.multi.parts=new Set([3]);st.sel={list:"parts",id:3}');assert.equal(run('engineSpecAction("ratedInputW",1.1e18)'),true);
 assert.equal(run('ship.parts[0].ratedInputW'),1.1e18);assert.equal(run('C.resolveEngineSpec(ship.parts[2],ship).ratedInputW'),1.1e18);assert.equal(run('ship.parts[2].ratedInputW'),1e18);
});
test('a shared outlet reactor selector displays and edits its machinery owner through the bound action and Undo',()=>{
 const run=setup();run(`ship.parts.push({id:4,k:'gen',c:[50,20,15],d:5},{id:5,k:'aux',c:[60,20,15],d:3});ship.nextId=6;ship.parts[0].reactor=4;ship.parts[2].machineryId=1;ship.parts[2].reactor=0;st.multi.parts=new Set([3]);st.sel={list:'parts',id:3};`);
 assert.match(run('engineControls(selItem(),true)'),/<option value="4" selected>/);assert.doesNotMatch(run('engineControls(selItem(),true)'),/<option value="0" selected>/);
 const a=app.indexOf("  $('#panel').addEventListener('change',e=>{\n    const t=e.target;if(!t.dataset.reactor)return;"),b=app.indexOf("  $('#panel').addEventListener('input',e=>{",a);assert.ok(a>=0&&b>a);
 run(`let reactorRouteChange;(()=>{const $=()=>({addEventListener:(type,fn)=>reactorRouteChange=fn});${app.slice(a,b)}})();reactorRouteChange({target:{dataset:{reactor:'selected',engineRoute:'1'},value:'5'}});`);
 assert.equal(run('ship.parts[0].reactor'),5);assert.equal(run('ship.parts[2].reactor'),0);assert.equal(run('C.resolveEngineSpec(selItem(),ship).reactorId'),5);assert.equal(run('undoStack.length'),1);
 assert.match(run('engineControls(selItem(),true)'),/<option value="5" selected>/);run('undo()');assert.equal(run('ship.parts[0].reactor'),4);run('redo()');assert.equal(run('ship.parts[0].reactor'),5);
 run(`reactorRouteChange({target:{dataset:{reactor:'selected',engineRoute:'1'},value:'auto'}})`);assert.equal(run('Object.hasOwn(ship.parts[0],"reactor")'),false);assert.equal(run('ship.parts[2].reactor'),0);
});
test('shared outlet connection batches resolve mirrored owner and reactor IDs once and reject broken owners atomically',()=>{
 const run=setup();run(`ship.parts[2].machineryId=1;ship.parts[2].tw=6;const other=engine(6,-25);other.machineryId=2;other.tw=3;ship.parts.push(other,{id:4,k:'gen',c:[50,20,15],d:5,tw:5},{id:5,k:'gen',c:[50,20,-15],d:5,tw:4});ship.nextId=7;st.multi.parts=new Set([3,6]);st.sel={list:'parts',id:3};`);
 assert.equal(run('engineConnectionAction("4")'),true);assert.deepEqual(plain(run('ship.parts.filter(p=>p.id===1||p.id===2).map(p=>p.reactor)')),[4,5]);assert.deepEqual(plain(run('ship.parts.filter(p=>p.id===3||p.id===6).map(p=>p.reactor)')),[0,0]);assert.equal(run('undoStack.length'),1);
 run('undo();ship.parts.find(p=>p.id===6).machineryId=999');const before=run('snap()');assert.equal(run('engineConnectionAction("4")'),false);assert.equal(run('snap()'),before);assert.equal(run('undoStack.length'),0);assert.match(run('messages.at(-1)'),/共有機関/);
});
test('the bound machinery selector links and restores dedicated machinery without losing saved specifications or duplicating input',()=>{
 const run=setup();run(`st.mirror=false;st.multi.parts=new Set([3]);st.sel={list:'parts',id:3};ship.parts[2].ratedInputW=8e17;`);const stored=plain(run('({...engineSpecSnapshot(selItem()),d:selItem().d,nozzleLength:selItem().nozzleLength,dir:selItem().dir,c:selItem().c})'));
 assert.match(run('engineMachineryControls(selItem())'),/<option value="self" selected>/);
 const a=app.indexOf("  $('#panel').addEventListener('change',e=>{const t=e.target;if('engineMachinery'in t.dataset)"),b=app.indexOf('\n',a);assert.ok(a>=0&&b>a);
 run(`let machineryChange;(()=>{const $=()=>({addEventListener:(type,fn)=>machineryChange=fn});${app.slice(a,b)}})();machineryChange({target:{dataset:{engineMachinery:''},value:'1'}});`);
 assert.equal(run('selItem().machineryId'),1);assert.equal(run('C.resolveEngineSpec(selItem(),ship).ratedInputW'),1e18);assert.equal(run('selItem().ratedInputW'),8e17);assert.equal(run('undoStack.length'),1);assert.match(run('engineMachineryControls(selItem())'),/<option value="1" selected>/);
 assert.deepEqual(plain(run('({...engineSpecSnapshot(selItem()),d:selItem().d,nozzleLength:selItem().nozzleLength,dir:selItem().dir,c:selItem().c})')),stored);
 run(`const requests=C.buildPropulsionRequests([C.resolveEngineSpec(ship.parts[0],ship),C.resolveEngineSpec(selItem(),ship)],{},1);const supplied=Object.fromEntries(requests.map(r=>[r.id,r.requestedInputW]));const shared=C.resolvePropulsion(requests,supplied,1e6);`);assert.equal(run('shared.totalActualInputW'),1e18);assert.equal(run('shared.totalThrustN'),5e8);
 run('undo()');assert.equal(run('selItem().machineryId'),undefined);run('redo()');assert.equal(run('selItem().machineryId'),1);run(`machineryChange({target:{dataset:{engineMachinery:''},value:'self'}})`);
 assert.equal(run('selItem().machineryId'),undefined);assert.equal(run('C.resolveEngineSpec(selItem(),ship).ratedInputW'),8e17);assert.deepEqual(plain(run('({...engineSpecSnapshot(selItem()),d:selItem().d,nozzleLength:selItem().nozzleLength,dir:selItem().dir,c:selItem().c})')),stored);
 for(const value of ['接続する内部機関','このノズル専用の内部機関','内部機関 #1'])assert.doesNotMatch(run('KSI18n.t('+JSON.stringify(value)+')'),/[\u3040-\u30ff\u3400-\u9fff]/);
});
test('machinery linking maps mirrored owners atomically and rejects chains, cycles and owners with unretargeted consumers',()=>{
 const run=setup();run(`ship.parts[2].tw=6;const outlet=engine(6,-25);outlet.tw=3;ship.parts.push(outlet);ship.nextId=7;st.multi.parts=new Set([3,6]);st.sel={list:'parts',id:3};`);
 assert.equal(run('engineMachineryAction("1")'),true);assert.deepEqual(plain(run('ship.parts.filter(p=>p.id===3||p.id===6).map(p=>p.machineryId)')),[1,2]);assert.equal(run('undoStack.length'),1);assert.doesNotMatch(run('engineMachineryControls(selItem())'),/<option value="6"/);
 run('st.mirror=false;st.multi.parts=new Set([1]);st.sel={list:"parts",id:1}');let before=run('snap()');assert.equal(run('engineMachineryAction("2")'),false);assert.equal(run('snap()'),before);assert.match(run('messages.at(-1)'),/先に接続し直して/);assert.equal(run('undoStack.length'),1);
 run('st.mirror=true;st.multi.parts=new Set([1,2]);st.sel={list:"parts",id:2}');before=run('snap()');assert.equal(run('engineMachineryAction("1")'),false);assert.equal(run('snap()'),before);assert.match(run('messages.at(-1)'),/循環接続/);
 run('st.mirror=false;st.multi.parts=new Set([1]);st.sel={list:"parts",id:1}');before=run('snap()');assert.equal(run('engineMachineryAction("3")'),false);assert.equal(run('engineMachineryAction("999")'),false);assert.equal(run('snap()'),before);
 run('st.multi.parts=new Set([1,3])');assert.equal(run('engineMachineryAction("2")'),true);assert.equal(run('ship.parts[0].machineryId'),2);assert.equal(run('ship.parts[2].machineryId'),2);assert.equal(run('engineConnectionOwner(ship.parts[2]).id'),2);
 for(const code of ['machinery-owner-in-use','machinery-connection-cycle'])assert.doesNotMatch(run('KSI18n.t(engineReasonText('+JSON.stringify(code)+'))'),/[\u3040-\u30ff\u3400-\u9fff]/);
});
test('pending generic and model engines preserve rated machinery across appearance edits and placement previews',()=>{
 const run=setup();run('st.multi.parts.clear();st.sel=null');assert.equal(run('engineSpecAction("d",2,true)'),true);const generic=plain(run('engineSpecSnapshot(pendingGenericEngine())'));
 assert.equal(run('pendingGenericEngine().d'),2);assert.equal(run('engineSpecAction("nozzleLength",.8,true)'),true);assert.deepEqual(plain(run('engineSpecSnapshot(pendingGenericEngine())')),generic);
 run('st.equipmentId="internalTurbine"');const model=plain(run('engineSpecSnapshot(pendingEngine(activeEquipment()))'));
 assert.equal(run('engineSpecAction("d",60,true)'),true);assert.deepEqual(plain(run('engineSpecSnapshot(pendingEngine(activeEquipment()))')),model);assert.equal(run('undoStack.length'),0);
});
test('engine diagnostics and full editor strings translate to English',()=>{
 const run=setup();run('C.propulsionPreview=(ship,stats)=>stats.propulsion;S={propulsion:{engines:[{id:1,actualInputW:0,actualThrustN:0,wasteHeatW:0,reasons:["overheat","unconnected"]}]}}');
 const html=run('engineSpecControls(selItem())');const text=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1]).filter(s=>s.trim());
 for(const value of text){const result=run('KSI18n.t('+JSON.stringify(value)+')');assert.doesNotMatch(result,/[\u3040-\u30ff\u3400-\u9fff]/,value);}
 assert.match(run('enginePerformance(selItem())'),/局所過熱/);assert.equal(run('KSI18n.t(engineReasonText("overheat"))'),'Local Overheating');
});
test('gamepad nudges unrestricted precision number fields through the same validated action and Undo',()=>{
 const run=setup();run(`const events=[];focused={tagName:'INPUT',type:'number',step:'any',min:'0',max:'1.5e18',value:'1e18',dataset:{engineStep:'1e16'},stepUp(){throw Error('step any');},dispatchEvent(e){events.push(e.type);if(e.type==='change')engineSpecAction('ratedInputW',this.value);}};`);
 assert.equal(run('adjustFocused("right")'),true);assert.deepEqual(plain(run('events')),['input','change']);assert.deepEqual(plain(run('ship.parts.map(p=>p.ratedInputW)')),[1.01e18,1.01e18,1.01e18]);assert.equal(run('undoStack.length'),1);run('undo()');assert.equal(run('ship.parts[0].ratedInputW'),1e18);
});
test('worker statistics refresh retains the propulsion card in the performance tab and desktop sidebar',()=>{
 const run=setup();run(`C.propulsionPreview=(ship,stats)=>stats.propulsion;S={propulsion:{ratedInputW:3e18,ratedThrustN:1.5e9,actualInputW:1e18,actualThrustN:5e8,wasteHeatW:5e16,engines:[]}};st.tab='spec';const main={innerHTML:''},side={innerHTML:''},$=s=>s==='#specSide'?side:s==='#panel .spec-wrap'?main:null,fleet={mode:'design'},isWide=()=>true,trialCardHTML=()=>'',specHTML=()=>'<p>Legacy performance</p>',compactSpec=()=>{};`);
 const a=app.indexOf('function renderSpecTargets()'),b=app.indexOf('const isWide =',a);run(app.slice(a,b));run('renderSpecTargets()');
 assert.match(run('main.innerHTML'),/id="propulsion-preview"/);assert.match(run('side.innerHTML'),/id="propulsion-preview-side"/);assert.doesNotMatch(run('side.innerHTML'),/data-heat-preset/);assert.match(run('main.innerHTML'),/熱平衡未解決/);
});
