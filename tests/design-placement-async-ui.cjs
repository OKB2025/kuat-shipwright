const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function fn(name) {
  const match = new RegExp('function ' + name + '\\s*\\(').exec(app);
  assert.ok(match, name);
  for (let i = app.indexOf('}', match.index); i >= 0; i = app.indexOf('}', i + 1)) {
    const code = app.slice(match.index, i + 1);
    try { new vm.Script(code); return code; } catch {}
  }
  assert.fail('complete function ' + name);
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup() {
  const context = vm.createContext({console, structuredClone});
  const run = source => vm.runInContext(source, context);
  run(`
    let ship={saveId:'ship-A',parts:[{id:1,k:'struct',c:[0,0,0]}],fits:[],nextId:2},hoverLines=null,editorPartsRevision=0;
    const eng={gen:3,what:new Set()},designUI={armed:true,parentId:1,mode:'horizontal',sequence:0,pending:null},st={tab:'mod',multi:{parts:new Set(),fits:new Set()}},meshStore={},live={},dirty={},fleet={mode:'design'};
    const calls=[],posts=[],requests=[],replies=[],diagnostics=[],notices=[];
    const C={PLACEMENT_MODEL_VERSION:1,publicJSON:v=>JSON.stringify(v,(k,x)=>k[0]==='_'?undefined:x),isStructuralPart:p=>p.k==='struct',
      acceptPlacementResult:(target,result)=>{calls.push('accept');const part={...result.part,id:target.nextId++};target.parts.push(part);return{ok:true,part};},
      solvePlacement:()=>{throw Error('Main-thread exact solve forbidden');},refreshPlacementGeometry:()=>{throw Error('Main-thread refresh forbidden');}};
    const YardEngineClient={post:m=>posts.push(m),request:(type,payload)=>{requests.push({type,payload});return new Promise((resolve,reject)=>replies.push({resolve,reject}));}};
    const view={setPlacementDiagnostics:(s,d)=>diagnostics.push(d)};
    const Gfx={lineSet:()=>({part:(p,color)=>calls.push('outline')})};
    const partPreview=hit=>({id:-1,k:'struct',c:hit.p.slice(),s:[4,4,4]}),publicCopy=v=>JSON.parse(JSON.stringify(v));
    const tool=()=> 'part',designParents=()=>ship.parts,designParent=id=>ship.parts.find(p=>p.id===id),designCapability=()=>({space:'exterior',kind:'structure',allowedModes:['horizontal']}),designUIRequests=(part,request)=>[{part,request,symmetry:''}];
    const designUIBar=()=>calls.push('bar'),requestDraw=()=>calls.push('draw'),refreshOverlay=()=>calls.push('overlay'),toast=m=>notices.push(m),syncHullEditor=()=>{},kickEngine=()=>{},engineStatus=()=>{};
    const mutate=(label,f)=>{calls.push('command');return f();},showPreview=()=>{},renderPanel=()=>{};
    function envelope(index=0,extra={}){const q=requests[index].payload,r=q.request;return{gen:q.gen,designId:q.designId,operationId:q.operationId,geometryRevision:r.geometryRevision,parentGeometryRevision:r.parentGeometryRevision,placementModelVersion:r.placementModelVersion,result:{ok:true,part:{...r.part,placement:{mode:r.mode,parentStructureId:r.parentStructureId}},contact:{connected:true}},...extra};}
  `);
  for (const name of ['designUIDiagnostics', 'designUIRejectTap', 'designUIInvalidatePending', 'designUICancel', 'designUIRequest', 'designUIConfirm', 'touch']) run(fn(name));
  const request = () => run('designUIRequest({parentStructureId:1,p:[0,10,0],n:[0,1,0]})');
  return {run, request};
}

test('new UI verifies without authoring changes, then accepts exact output in one edit command', async () => {
  const t = setup(); t.request();
  assert.equal(t.run('designUI.pending.state'), 'pending');
  assert.equal(t.run('ship.parts.length'), 1);
  assert.equal(t.run('diagnostics.at(-1).status'), 'pending');
  assert.equal(t.run('requests[0].payload.request.placementModelVersion'), 1);
  t.run('replies[0].resolve(envelope())'); await flush();
  assert.equal(t.run('designUI.pending.state'), 'ready');
  assert.equal(t.run('ship.parts.length'), 1);
  assert.equal(t.run('diagnostics.at(-1).status'), 'valid');
  t.run('designUIConfirm()');
  assert.equal(t.run('ship.parts.length'), 2);
  assert.equal(t.run("calls.filter(x=>x==='command').length"), 1);
  assert.equal(t.run('designUI.pending'), null);
});

test('cancel before a Worker reply cannot restore the ghost or add a part', async () => {
  const t = setup(); t.request(); t.run('designUICancel()');
  t.run('replies[0].resolve(envelope())'); await flush();
  assert.equal(t.run('designUI.pending'), null);
  assert.equal(t.run('ship.parts.length'), 1);
  assert.equal(t.run('hoverLines'), null);
  assert.equal(t.run('diagnostics.at(-1)'), null);
  assert.equal(t.run("posts.filter(p=>p.type==='cancelPlacement').length"), 1);
});

test('an actual editor touch cancels pending validation and a late reply cannot roll it back', async () => {
  const t = setup(); t.request(); t.run('ship.parts[0].c[0]=20;touch("parts")');
  assert.equal(t.run('designUI.pending.state'), 'failed');
  assert.equal(t.run('designUI.pending.invalidated'), true);
  t.run('replies[0].resolve(envelope())'); await flush();
  assert.equal(t.run('ship.parts[0].c[0]'), 20);
  assert.equal(t.run('ship.parts.length'), 1);
  assert.equal(t.run('designUI.pending.state'), 'failed');
  assert.equal(t.run('diagnostics.at(-1)'), null);
});

test('stale, cancelled or mismatched Worker envelopes leave a repairable failure instead of a pending spinner', async () => {
  for (const extra of [{stale:true},{cancelled:true},{gen:2},{designId:'other'},{operationId:'old'},{geometryRevision:99},{parentGeometryRevision:99},{placementModelVersion:99}]) {
    const t = setup(); t.request();
    t.run('replies[0].resolve(envelope(0,' + JSON.stringify(extra) + '))'); await flush();
    assert.equal(t.run('designUI.pending.state'), 'failed', JSON.stringify(extra));
    assert.equal(t.run('designUI.pending.invalidated'), true);
    assert.equal(t.run('ship.parts.length'), 1);
    assert.equal(t.run('diagnostics.at(-1)'), null);
  }
});

test('a new position supersedes the old request even when that old request returns last', async () => {
  const t = setup(); t.request();
  t.run('designUIRequest({parentStructureId:1,p:[20,10,0],n:[0,1,0]});replies[1].resolve(envelope(1))'); await flush();
  const operation = t.run('designUI.pending.operationId');
  t.run('replies[0].resolve(envelope(0))'); await flush();
  assert.equal(t.run('designUI.pending.operationId'), operation);
  assert.equal(t.run('designUI.pending.state'), 'ready');
  assert.equal(t.run('designUI.pending.result.part.c[0]'), 20);
});

test('failure and rejection replace an earlier green diagnostic with an invalid current candidate', async () => {
  for (const reject of [false, true]) {
    const t = setup(); t.request(); t.run('replies[0].resolve(envelope())'); await flush();
    assert.equal(t.run('diagnostics.at(-1).status'), 'valid');
    t.run('designUIRequest({parentStructureId:1,p:[20,10,0],n:[0,1,0]})');
    assert.equal(t.run('diagnostics.at(-1).status'), 'pending');
    t.run(reject ? 'replies[1].reject(Error("worker failed"))' : 'replies[1].resolve(envelope(1,{result:{ok:false,error:"no contact"}}))');
    await flush();
    assert.equal(t.run('designUI.pending.state'), 'failed');
    assert.equal(t.run('diagnostics.at(-1).status'), 'invalid');
    assert.equal(t.run('ship.parts.length'), 1);
  }
});

test('changing the source design without an editor touch still invalidates its pending result', async () => {
  const t = setup(); t.request(); t.run('ship={...ship,saveId:"ship-B"};replies[0].resolve(envelope())'); await flush();
  assert.equal(t.run('designUI.pending.state'), 'failed');
  assert.equal(t.run('ship.parts.length'), 1);
  assert.equal(t.run('diagnostics.at(-1)'), null);
});
