const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const root = path.resolve(process.env.KS_TEST_ROOT || path.join(__dirname, '..'));
const source = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Application section ${start} exists`);
  return source.slice(a, b);
}
function context() {
  const c = vm.createContext({console, setTimeout, clearTimeout});
  for (const file of ['data/reference.js', 'data/imperial2.js', 'data/fleet.js', 'js/core.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), c, {filename: file});
  }
  vm.runInContext(`
const C=Core, nodes=new Map(), records=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,{setAttribute(){}});return nodes.get(id);};
const T=s=>s, esc=s=>String(s), st={}, eng={}, meshStore={}, fleet={mode:'design',assets:new Map(),saves:[]};
let ship=null,S=null,prevS=null,view=null,designHistory=null,lastOp='',dragSnap=null,dragLabel='';
const undoStack=[],redoStack=[];
function resetSolidCutter(){}function reconcileSolidCutter(){}function showBusyOverlay(){}
function touch(){}function hideInspect(){}function renderPanel(){}function scheduleStats(){}
function autosave(){}function toast(){}function sndEdit(){}function sndUI(){}
function findSel(){return null;}function renderSaves(){}
let releasePack=null,packGate=null;
async function pack(data){if(packGate)await packGate;return JSON.stringify(data);}
async function unpack(data){return JSON.parse(data);}
const Store={save:async rec=>{records.set(rec.id,rec);return 'local';},list:async()=>[...records.values()]};
function load(name,id){const s=C.newShip({},name);if(id)s.saveId=id;setShip(s);S={cls:{role:'test',name:'ship'},hullLen:s.hull.L};return s;}
function gatePack(){packGate=new Promise(r=>releasePack=r);}
${section('function setShip(', '// Performance figures arrive')}
${section('async function saveCurrent()', 'let delConfirm')}
`, c);
  return {c, run: code => vm.runInContext(code, c)};
}
test('undo and redo across saved designs preserve the correct save record and displayed name', async () => {
  const {run} = context();
  await run(`load('Design A','A');saveCurrent()`);
  await run(`load('Design B','B');saveCurrent()`);
  run('undo()');
  await run('saveCurrent()');
  assert.equal(run('ship.name'), 'Design A');
  assert.equal(run('ship.saveId'), 'A');
  assert.equal(run("records.get('B').name"), 'Design B');
  assert.equal(run("nodes.get('#shipName').textContent"), 'Design A');
  run('redo()');
  await run('saveCurrent()');
  assert.equal(run('ship.saveId'), 'B');
  assert.equal(run("nodes.get('#shipName').textContent"), 'Design B');
  assert.equal(run('records.size'), 2);
});
test('undo to an unsaved design never adopts the loaded design save identity', async () => {
  const {run} = context();
  run("load('Unsaved A');load('Saved B','B');undo()");
  assert.equal(run('ship.saveId'), undefined);
  await run('saveCurrent()');
  assert.notEqual(run('ship.saveId'), 'B');
  run('redo()');
  assert.equal(run('ship.saveId'), 'B');
});
test('ordinary edit and drag undo retain the first save identity', async () => {
  const {run} = context();
  run("load('Original');mutate('rename',()=>ship.name='Edited')");
  await run('saveCurrent()');
  const id = run('ship.saveId');
  run('undo()');
  assert.equal(run('ship.name'), 'Original');
  assert.equal(run('ship.saveId'), id);
  await run('saveCurrent()');
  run("redo();beginDrag('resize');ship.hull.L+=10;endDrag();undo()");
  assert.equal(run('ship.saveId'), id);
  assert.equal(run('ship.name'), 'Edited');
  assert.equal(run('records.size'), 1);
});
test('a save finishing after a design switch writes its captured design and identity', async () => {
  const {run} = context();
  run("load('Design A','A');gatePack()");
  const pending = run('saveCurrent()');
  run("load('Design B','B');releasePack()");
  await pending;
  assert.equal(run("records.get('A')?.name"), 'Design A');
  assert.equal(run("JSON.parse(records.get('A').data).name"), 'Design A');
  assert.equal(run('ship.saveId'), 'B');
  assert.equal(run("records.has('B')"), false);
});
function voyageContext() {
  const h=context();
  h.run(`
const voy={designs:new Map(),pending:new Map(),setup:{own:'empire'},saves:[]};
const R={designInfo:s=>({len:s.len})}, TG_MAX=8;
let ob={ctgs:[{id:'c',name:'CTF',tgs:[{id:'t',name:'TF',ships:[]}]}]};
const ORBAT_KEY='yard.orbat.v1';let orbatSaved=null;
const LS={set:(key,data)=>{orbatSaved=data;return true;}};
voy.orbat={version:1,factions:{empire:ob}};
let nextId=0,engineCalls=0,blockName=null,releaseEngine=null;
function voyOpen(){}function voyOb(){return ob;}function voyObTgs(o){return o.ctgs.flatMap(c=>c.tgs);}
function voyObShips(o){return voyObTgs(o).flatMap(t=>t.ships);}function voyUid(){return 's'+(++nextId);}
function voyNextName(){return 'Ship '+nextId;}function voyAutoLoad(){return {};}function voyObChanged(){}
function voyRenderSetup(){}function voyShipDesign(sh){return voy.designs.get(sh.key)||voy.designs.get(sh.src)||null;}
const YardEngineClient={request:async(type,payload)=>{
  engineCalls++;const data=payload.design;
  if(data.name===blockName)await new Promise(r=>releaseEngine=r);
  return {design:data,stats:{name:data.name,len:data.hull.L},profile:{name:data.name},geometry:{}};
}};
${section('function fleetHash(', 'async function fleetAdd(')}
${section('async function voyPrepare(', 'const voyShort')}
${source.includes('function voyAllShips(')?section('function voyAllShips(', 'const voyObTgs'):''}
${section('function voyOrbatSave()', 'function voyOb(')}
${section('async function voyEnsureDesigns(', '// People and materials')}
${section('async function voyOpenWithCurrent()', "window.addEventListener('ks-language-change'")}
function saved(id,name,t){const data=C.serialize(C.newShip({},name));return {id,name,savedAt:t,data:JSON.stringify(data)};}
`);
  return h;
}
test('adding an edited current design uses a new snapshot and preserves the prior fleet design', async () => {
  const {run}=voyageContext();
  await run("load('Design A');voyOpenWithCurrent()");
  const first=run('voyObShips(ob)[0].key');
  await run("load('Design B');ship.hull.L=2000;voyOpenWithCurrent()");
  assert.equal(run('voyObShips(ob).length'),2);
  const second=run('voyObShips(ob)[1].key');
  assert.notEqual(first,second);
  assert.equal(run(`voy.designs.get(${JSON.stringify(first)}).name`),'Design A');
  assert.equal(run(`voy.designs.get(${JSON.stringify(second)}).info.len`),2000);
  run('fleet.assets.clear()');
  const old=await run(`fleetAsset(${JSON.stringify(first)})`);
  assert.equal(old.design.name,'Design A');
  const current=await run("voyPrepare('current')");
  assert.equal(current.key,second);
});
test('out of order engine replies cannot restore a stale current design', async () => {
  const {run}=voyageContext();
  run("load('Design A');blockName='Design A'");
  const first=run("voyPrepare('current')");
  const second=run("load('Design B');voyPrepare('current')");
  await new Promise(setImmediate);
  run('releaseEngine()');
  await Promise.all([first,second]);
  const current=await run("voyPrepare('current')");
  assert.equal(current.name,'Design B');
  assert.equal(run('engineCalls'),2);
});
test('save references use the latest stored version despite stale fleet and voyage lists', async () => {
  const {run}=voyageContext();
  run("fleet.saves=[saved('custom','Old fleet cache',1)];voy.saves=[saved('custom','Old voyage cache',2)];records.set('custom',saved('custom','Stored version 3',3))");
  const first=await run("voyPrepare('save:custom')");
  assert.equal(first.name,'Stored version 3');
  run("records.set('custom',saved('custom','Stored version 4',4))");
  const next=await run("voyPrepare('save:custom')");
  assert.equal(next.name,'Stored version 4');
  assert.notEqual(first.key,next.key);
  run('fleet.assets.clear()');
  const previous=await run(`fleetAsset(${JSON.stringify(first.key)})`);
  assert.equal(previous.design.name,'Stored version 3');
  assert.equal(previous.key,first.key);
});
test('legacy persisted versioned references still reload using the current saved design', async () => {
  const {run}=voyageContext();
  run("records.set('custom',saved('custom','Latest',9));ob.ctgs[0].tgs[0].ships=[{src:'save:custom-1',key:'save:custom-1'}]");
  await run('voyEnsureDesigns(ob)');
  assert.equal(run('voyObShips(ob)[0].key'),'save:custom-9');
  assert.equal(run('voyShipDesign(voyObShips(ob)[0]).name'),'Latest');
  assert.equal(run('engineCalls'),1);
});
test('custom fleet reload preserves distinct draft snapshots and carried ships, deduplicated by key', async () => {
  const {run}=voyageContext();
  await run("load('Draft A');voyOpenWithCurrent()");
  await run("load('Draft B');voyOpenWithCurrent()");
  const before=Array.from(run('voyObShips(ob).map(sh=>sh.key)'));
  assert.equal(before.length,2);
  run("voyObShips(ob)[1].carried=[{...voyObShips(ob)[0]}];voyOrbatSave()");
  assert.equal(run('Object.keys(JSON.parse(orbatSaved).factions.empire.designs||{}).length'),2);
  run("ob=JSON.parse(orbatSaved).factions.empire;voy.designs.clear();fleet.assets.clear();load('Unrelated current draft')");
  await run('voyEnsureDesigns(ob)');
  assert.deepEqual(Array.from(run('voyObShips(ob).map(sh=>sh.key)')),before);
  assert.equal(run('voyShipDesign(voyObShips(ob)[0]).name'),'Draft A');
  assert.equal(run('voyShipDesign(voyObShips(ob)[1]).name'),'Draft B');
  assert.equal(run('voyShipDesign(voyObShips(ob)[1].carried[0]).name'),'Draft A');
});
test('mission saves retain referenced saved-design versions and restore them before source fallback', async () => {
  const {run}=voyageContext();
  run("records.set('custom',saved('custom','Version 1',1))");
  const first=await run("voyPrepare('save:custom')");
  run("records.set('custom',saved('custom','Version 2',2))");
  const second=await run("voyPrepare('save:custom')");
  run(`ob.ctgs[0].tgs[0].ships=[{src:'save:custom',key:${JSON.stringify(second.key)},carried:[{src:'save:custom',key:${JSON.stringify(first.key)}}]}]`);
  run(`
let MS={ob},msSaveT=0;function msNormalize(){}function msCloudPush(){}function msWrite(){}
${section('function msSave()', 'async function msWrite()')}
msSave();clearTimeout(msSaveT);
`);
  assert.equal(run('Object.keys(MS.ob.designs||{}).length'),2);
  run("MS=JSON.parse(JSON.stringify(MS));ob=MS.ob;voy.designs.clear();fleet.assets.clear();records.set('custom',saved('custom','Newer stored version',9))");
  await run('voyEnsureDesigns(ob)');
  assert.equal(run('voyShipDesign(voyObShips(ob)[0]).name'),'Version 2');
  assert.equal(run('voyShipDesign(voyObShips(ob)[0].carried[0]).name'),'Version 1');
  assert.equal(run('voyObShips(ob)[0].key'),second.key);
});
test('persisted snapshots supersede a previously cached legacy-version alias', async () => {
  const {run}=voyageContext();
  run("records.set('custom',saved('custom','Latest version',9))");
  const fallback=await run("fleetAsset('save:custom-1')");
  assert.equal(fallback.key,'save:custom-9');
  run("ob.ctgs[0].tgs[0].ships=[{src:'save:custom-1',key:'save:custom-1'}];ob.designs={'save:custom-1':C.serialize(C.newShip({},'Persisted version 1'))}");
  await run('voyEnsureDesigns(ob)');
  assert.equal(run('voyShipDesign(voyObShips(ob)[0]).name'),'Persisted version 1');
  assert.equal(run('voyObShips(ob)[0].key'),'save:custom-1');
  assert.equal(run("fleet.assets.get('save:custom-1').design.name"),'Persisted version 1');
});
