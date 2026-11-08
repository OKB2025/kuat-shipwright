const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx=vm.createContext({console,C,setTimeout,structuredClone});
 const run=code=>vm.runInContext(code,ctx);
 run(`
 let ship=null,S=null,prevS=null,view=null,lastOp='',dragSnap=null,dragLabel='';
 const undoStack=[],redoStack=[],st={},fleet={mode:'design'},eng={},meshStore={},nodes=new Map(),records=new Map(),notices=[],designUI={};
 const $=id=>{if(!nodes.has(id))nodes.set(id,{disabled:false,textContent:'',setAttribute(){}});return nodes.get(id);};
 const T=x=>x,esc=String,toast=x=>notices.push(x),resetSolidCutter=()=>{},clearPreview=()=>{},reconcileSolidCutter=()=>{},showBusyOverlay=()=>{},touch=()=>{},kickEngine=()=>{},hideInspect=()=>{},renderPanel=()=>{},scheduleStats=()=>{},autosave=()=>{},sndEdit=()=>{},sndUI=()=>{},findSel=()=>null,renderSaves=()=>{};
 let releasePack=null,releaseStore=null,delayPack=false,delayStore=false,failStore=false,packCalls=0;
 async function pack(value){packCalls++;const data=JSON.stringify(value);if(delayPack)await new Promise(resolve=>releasePack=resolve);return data;}
 const Store={async save(rec){if(delayStore)await new Promise(resolve=>releaseStore=resolve);if(failStore)throw new Error('write failed');records.set(rec.id,rec);return 'local';}};
 function load(name,id,opts){const s=C.newShip({L:20,W:8,H:4},name);if(id)s.saveId=id;setShip(s,opts);stats(name);}
 function stats(name=ship.name){S={cls:{role:name+' role',name:name+' class'},hullLen:ship.hull.L};}
 `);
 function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));}
 section('// ---------- ship lifecycle & history ----------', '// Performance figures arrive');
 section('function designUIEditSession()', 'function designUIEditBegin(');
 section(app.includes('let savingCurrent =')?'let savingCurrent =':'async function saveCurrent()', 'let delConfirm =');
 return run;
}
test('switch A to B, undo and save writes A only; redo saves B',async()=>{
 const r=setup();r("load('A','id-A');load('B','id-B');undo();stats();");
 assert.equal(r('ship.saveId'),'id-A');assert.equal(r("$('#shipName').textContent"),'A');
 await r('saveCurrent()');assert.equal(r("records.get('id-A').name"),'A');assert.equal(r("records.has('id-B')"),false);
 r('redo();stats();');await r('saveCurrent()');assert.equal(r("records.get('id-B').name"),'B');assert.equal(r('ship.saveId'),'id-B');
});
test('first save and undo keep one identity for an initially unsaved design',async()=>{
 const r=setup();r("load('New');const originalId=ship.saveId;mutate('rename',()=>ship.name='Edited');stats();");await r('saveCurrent()');
 r('undo();stats();');await r('saveCurrent()');assert.equal(r('ship.saveId===originalId'),true);assert.equal(r('records.size'),1);assert.equal(r('records.get(originalId).name'),'New');
});
test('new designs and keepHistory start cannot inherit another design destination',async()=>{
 const r=setup();r("load('A','id-A');mutate('rename',()=>ship.name='A edited');load('New',null,{keepHistory:true});const freshId=ship.saveId;");
 assert.notEqual(r('freshId'),'id-A');await r('saveCurrent()');r('undo();stats();');await r('saveCurrent()');
 assert.equal(r('ship.saveId'),'id-A');assert.equal(r('records.get(freshId).name'),'New');assert.equal(r("records.get('id-A').name"),'A');
});
test('compression delay captures original data, identity and scalar metadata',async()=>{
 const r=setup();r("load('A','id-A');delayPack=true;const pending=saveCurrent();S.cls.role='mutated';load('B','id-B');");
 assert.equal(r('S.cls.role'),'B role');r('releasePack();');await r('pending');
 const rec=plain(r("records.get('id-A')"));assert.equal(rec.name,'A');assert.equal(rec.cls,'A role／A class');assert.equal(JSON.parse(rec.data).name,'A');assert.equal(r('ship.saveId'),'id-B');assert.equal(r('records.size'),1);
});
test('pending storage does not overwrite identity after in-place undo',async()=>{
 const r=setup();r("load('A','id-A');load('B','id-B');delayStore=true;const pending=saveCurrent();");await Promise.resolve();
 r('undo();stats();');assert.equal(r('ship.name'),'A');r('releaseStore();');await r('pending');
 assert.equal(r('ship.saveId'),'id-A');assert.equal(r("records.get('id-B').name"),'B');
});
test('new design delayed first save remains associated after switch and undo',async()=>{
 const r=setup();r("load('New');const freshId=ship.saveId;delayPack=true;const pending=saveCurrent();load('B','id-B');undo();stats();releasePack();");await r('pending');
 assert.equal(r('ship.saveId===freshId'),true);r('delayPack=false;');await r('saveCurrent()');assert.equal(r('records.size'),1);assert.equal(r('records.get(freshId).name'),'New');
});
test('duplicate save attempts are ignored and errors unlock saving',async()=>{
 const r=setup();r("load('A','id-A');delayPack=true;const pending=saveCurrent();");await r('saveCurrent()');assert.equal(r('packCalls'),1);r('releasePack();');await r('pending');
 r('delayPack=false;failStore=true;');await r('saveCurrent()');assert.equal(r('savingCurrent'),false);assert.equal(r("$('#btnSave').disabled"),false);
 r('failStore=false;');await r('saveCurrent()');assert.equal(r('packCalls'),3);
});
test('history identity is private and imports do not acquire a save destination',()=>{
 const r=setup();r("load('A','id-A');");assert.equal(r('JSON.parse(snap())._historySaveId'),'id-A');
 assert.equal(r('C.serialize(ship)._historySaveId'),undefined);assert.equal(r('C.serialize(ship).saveId'),undefined);
 assert.equal(r('C.deserialize(JSON.parse(snap())).saveId'),undefined);
});
test('switching designs cancels a drag snapshot from the prior design',()=>{
 const r=setup();r("load('A','id-A');beginDrag('move');load('B','id-B');endDrag();");assert.equal(r('dragSnap'),null);r('undo();');assert.equal(r('ship.saveId'),'id-A');
});

test('cross-design undo can save the raw blueprint while marking its statistics provisional',async()=>{
 const r=setup();r("load('A','id-A');load('B','id-B');undo();");assert.equal(r('S'),null);await r('saveCurrent()');assert.equal(r('records.size'),1);
 assert.equal(r("records.get('id-A').cls"),'計算中');assert.equal(r("records.get('id-A').provisional"),true);assert.equal(r("JSON.parse(records.get('id-A').data).name"),'A');assert.equal(r("records.has('id-B')"),false,'saving does not borrow the previous design or its statistics');
 r('stats();');await r('saveCurrent()');assert.equal(r("records.get('id-A').cls"),'A role／A class');assert.equal(r("records.get('id-A').provisional"),undefined);
});
test('imported identity metadata is discarded before entering the editor',()=>{
 const r=setup();r("load('A','id-A');const imported=C.deserialize({...C.serialize(ship),saveId:'id-A',_historySaveId:'id-A'});setShip(imported);");
 assert.notEqual(r('ship.saveId'),'id-A');assert.equal(typeof r('ship.saveId'),'string');
});

test('saving prepares both mesh variants for the captured design after an editor switch',async()=>{
 const r=setup();r("const prepared=[];const YardEngineClient={request:(type,payload)=>{prepared.push({type,payload});return Promise.resolve({});}};load('A','id-A');delayPack=true;const pending=saveCurrent();load('B','id-B');releasePack();");await r('pending');
 const prepared=plain(r('prepared'));assert.equal(prepared.length,2);assert.deepEqual(prepared.map(x=>x.payload.trial),[false,true]);
 for(const x of prepared){assert.equal(x.type,'fleet');assert.equal(x.payload.design.name,'A');assert.equal(x.payload.prepareOnly,true);}assert.equal(r('ship.name'),'B');
});

test('failed cache preparation does not turn a successful blueprint save into an error',async()=>{
 const r=setup();r("const YardEngineClient={request:()=>Promise.reject(Error('cache unavailable'))};load('A','id-A');");await r('saveCurrent()');await Promise.resolve();
 assert.equal(r("records.get('id-A').name"),'A');assert.equal(r('savingCurrent'),false);assert.ok(r('notices').some(s=>s.includes('保存しました')));
});
