const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), {test} = require('node:test');
const app = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function fn(name) {
  const match = new RegExp('function ' + name + '\\s*\\(').exec(app); assert.ok(match, name);
  for (let i = app.indexOf('}', match.index); i >= 0; i = app.indexOf('}', i + 1)) {
    const code = app.slice(match.index, i + 1); try { new vm.Script(code); return code; } catch {}
  }
  assert.fail('complete function ' + name);
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function setup() {
  const context = vm.createContext({console, structuredClone});
  const run = source => vm.runInContext(source, context);
  run(`
    let ship={saveId:'tap-source',hull:{assembly:true},parts:[{id:1,k:'struct',geometryRevision:2},{id:2,k:'struct',geometryRevision:7},{id:3,k:'cargo'}],fits:[],nextId:4},hoverLines=null,currentTool='part';
    const eng={gen:5},designUI={drawer:true,armed:false,details:false,parentId:1,mode:'surface',depth:5,sequence:0,pending:null},fleet={mode:'design'},st={tab:'mod',view:'normal',surfaceMode:'surface'},STRUCTURE_ARMOR_FACES={starboard:'right'};
    let cap={space:'exterior',kind:'structure',allowedModes:['horizontal','vertical','surface']},rayHits=[],interiorHits=[];
    const requests=[],replies=[],posts=[],diagnostics=[],notices=[],rayCalls=[],interiorCalls=[],nodes=new Map();
    const $=key=>{if(!nodes.has(key))nodes.set(key,{dataset:{},hidden:false,innerHTML:''});return nodes.get(key);},T=x=>x,esc=String,toast=m=>notices.push(m),requestDraw=()=>{},refreshOverlay=()=>{},updateHint=()=>{},designUIPanel=()=>{};
    const C={PLACEMENT_MODEL_VERSION:1,isStructuralPart:p=>p?.k==='struct',publicJSON:JSON.stringify,partLabel:p=>'structure '+p.id};
    const tool=()=>currentTool,designCapability=()=>cap,designPartDefinition=()=>({id:-1,k:currentTool==='fit'?'pd':'struct'}),selItem=()=>null,carryToPlace=()=>{},selClear=()=>{};
    const designUIClose=keep=>{designUI.drawer=false;},publicCopy=v=>JSON.parse(JSON.stringify(v)),editorMountShip=()=>ship;
    const partPreview=hit=>({id:-1,k:'struct',c:hit.p.slice(),s:[4,4,4]}),designUIFitDraft=hit=>({id:-1,k:'pd',_fit:true,p:hit.p.slice(),n:hit.n.slice(),ped:.3}),designUIRequests=(part,request)=>[{part,request,symmetry:''}];
    const Gfx={lineSet:()=>({part(){},fit(){}}),placementSurfaceCandidates:(s,o,d,options)=>{rayCalls.push({s,o,d,options});return rayHits;},structureSurfaceCandidates:(s,o,d,host,options)=>{interiorCalls.push({host,options});return interiorHits;}};
    const view={setPlacementDiagnostics:(s,d)=>diagnostics.push(d)},envHit=()=>{throw Error('An exterior tap must not fall back to an unrelated surface');};
    const YardEngineClient={post:m=>posts.push(m),request:(type,payload)=>{requests.push({type,payload});return new Promise((resolve,reject)=>replies.push({resolve,reject}));}};
    function hit(id=2){return{parentStructureId:id,part:ship.parts.find(p=>p.id===id),p:[12,8,-4],n:[.6,.8,0],u:[0,0,1],kind:'structure',face:'starboard',hostSurfaceId:'p'+id+':stable-side:0'};}
    function envelope(index=0){const q=requests[index].payload,r=q.request,fit=r.list==='fits';return{gen:q.gen,designId:q.designId,operationId:q.operationId,geometryRevision:r.geometryRevision,parentGeometryRevision:r.parentGeometryRevision,placementModelVersion:r.placementModelVersion,result:{ok:true,...(fit?{list:'fits',entityKind:'fit',fit:{...r.part,host:r.hostId}}:{part:{...r.part,placement:{mode:r.mode,parentStructureId:r.parentStructureId}}}),contact:{connected:true}}};}
  `);
  for (const name of ['designParents', 'designParent', 'designUIRootEligible', 'designUIRootPlaneHit', 'designPlacementActive', 'designExternalPlacementTool', 'designUIStartTap', 'designUIDiagnostics', 'designUIRejectTap', 'designUIInvalidatePending', 'designUICancel', 'designUIArm', 'designUIRequest', 'designUIBar', 'pickRay']) run(fn(name));
  return {run};
}

test('arming exterior placement does not require a parent chosen before the canvas tap', () => {
  const {run:r} = setup(); r('designUI.parentId=null;designUIArm()');
  assert.equal(r('designUI.armed'), true); assert.equal(r('designUI.drawer'), false); assert.equal(r('notices.length'), 0);
});

test('the tapped structure replaces the previous parent and supplies its current geometry generation', () => {
  const {run:r} = setup(); r('designUIRequest(hit(2))');
  assert.equal(r('requests.length'), 1); assert.equal(r('designUI.parentId'), 2);
  assert.equal(r('requests[0].payload.request.parentStructureId'), 2);
  assert.equal(r('requests[0].payload.request.hostId'), 2);
  assert.equal(r('requests[0].payload.request.parentGeometryRevision'), 7);
  assert.equal(r('diagnostics.at(-1).parentStructureId'), 2);
});

test('a second canvas tap changes the parent and stable face while a later first reply is discarded', async () => {
  const {run:r} = setup(); r('designUIRequest(hit(1));const oldPending=designUI.pending;designUIRequest(hit(2));replies[1].resolve(envelope(1))'); await flush();
  assert.equal(r('designUI.pending.state'), 'ready');
  assert.equal(r('designUI.pending.request.parentStructureId'), 2);
  assert.equal(r('designUI.pending.request.hostSurfaceId'), 'p2:stable-side:0');
  r('replies[0].resolve(envelope(0))'); await flush();
  assert.equal(r('designUI.pending.state'), 'ready'); assert.equal(r('designUI.pending.result.part.placement.parentStructureId'), 2);
  assert.equal(r('diagnostics.at(-1).parentStructureId'), 2);
  assert.equal(r('posts.some(p=>p.type==="cancelPlacement"&&p.operationId===oldPending.operationId)'), true);
});

test('surface mode sends an isolated exact point, normal, tangent and stable face without snapping', () => {
  const {run:r} = setup(); r('const original=hit();designUIRequest(original);original.p[0]=999;original.n[0]=-1;original.u[0]=9;');
  const request = plain(r('requests[0].payload.request'));
  assert.equal(request.mode, 'surface'); assert.equal(request.hostSurfaceId, 'p2:stable-side:0');
  assert.deepEqual(request.hit, {p: [12, 8, -4], n: [.6, .8, 0], u: [0, 0, 1], kind: 'structure', face: 'starboard'});
});

test('a nonstructure or missing hit clears the previous confirmation and never falls back to the old parent', async () => {
  for (const bad of ['null', '{p:[0,0,0],n:[0,1,0],part:ship.parts[2]}', '{p:[0,0,0],n:[0,1,0],fit:{id:8}}', '{p:[0,0,0],n:[0,1,0],parentStructureId:99}']) {
    const {run:r} = setup(); r('designUI.armed=true;designUIRequest(hit(1));replies[0].resolve(envelope(0))'); await flush();
    assert.equal(r('designUI.pending.state'), 'ready'); r('designUIRequest(' + bad + ')');
    assert.equal(r('requests.length'), 1, bad); assert.equal(r('designUI.pending.state'), 'failed', bad);
    assert.equal(r('diagnostics.at(-1)'), null); assert.equal(r('hoverLines'), null);
    assert.equal(r('$("#designPlacementBar").innerHTML').includes('data-design-action="confirm"'), false);
  }
});

test('canvas picking takes the nearest visible structure and ignores the former parent and depth index', () => {
  const {run:r} = setup(); r('rayHits=[hit(2),hit(1)];const picked=pickRay([1,2,3],[0,-1,0],{parts:true,fits:false});');
  assert.equal(r('picked.parentStructureId'), 2); assert.equal(r('rayCalls.length'), 1);
  assert.equal(r('rayCalls[0].s===ship'), true); assert.equal(r('interiorCalls.length'), 0);
  r('designUI.replaceId=2;pickRay([1,2,3],[0,-1,0],{parts:true,fits:false})');
  assert.equal(r('rayCalls.at(-1).options.excludePartId'), 2);
});

test('an exterior ray with no visible parent returns no placement surface', () => {
  const {run:r} = setup(); assert.equal(r('pickRay([1,2,3],[0,-1,0],{parts:true,fits:false})'), null);
  assert.equal(r('rayCalls.length'), 1);
});

test('interior depth selection retains its explicit host and does not use exterior tap parenting', () => {
  const {run:r} = setup(); r("cap={space:'interior',kind:'compartment',allowedModes:['clip']};designUI.armed=true;designUI.hostId=1;designUI.depth=1;interiorHits=[hit(1),{...hit(1),hostSurfaceId:'interior-second'}];const picked=pickRay([1,2,3],[0,-1,0],{parts:true,fits:false});");
  assert.equal(r('picked.hostSurfaceId'), 'interior-second'); assert.equal(r('interiorCalls[0].host'), 1); assert.equal(r('rayCalls.length'), 0);
});

test('weapon placement uses the same tap parent and exact Worker request while retaining direct mode', async () => {
  const {run:r} = setup(); r("currentTool='fit';cap={space:'exterior',kind:'weapon',allowedModes:['direct']};designUIRequest(hit(2));");
  const request = plain(r('requests[0].payload.request'));
  assert.equal(request.list, 'fits'); assert.equal(request.entityKind, 'fit'); assert.equal(request.mode, 'direct');
  assert.equal(request.hostId, 2); assert.deepEqual(request.hit.p, [12, 8, -4]);
  r('replies[0].resolve(envelope(0))'); await flush();
  assert.equal(r('designUI.pending.state'), 'ready'); assert.equal(r('diagnostics.at(-1).list'), 'fits');
  assert.equal(r('diagnostics.at(-1).fit.host'), 2);
});

test('a canvas tap can start the selected exterior part directly and keeps the selected surface mode', () => {
  const {run:r} = setup(); r('designUI.armed=false;designUIStartTap(hit(2))');
  assert.equal(r('designUI.armed'), true); assert.equal(r('designUI.drawer'), false);
  assert.equal(r('requests.length'), 1); assert.equal(r('requests[0].payload.request.mode'), 'surface');
  assert.equal(r('requests[0].payload.request.parentStructureId'), 2);
});
