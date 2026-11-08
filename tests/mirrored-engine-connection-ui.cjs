const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root),plain=q=>JSON.parse(JSON.stringify(q));
function fn(name){
 const found=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(found,name+' is an actual App function');
 for(let end=app.indexOf('}',found.index);end>=0;end=app.indexOf('}',end+1)){const source=app.slice(found.index,end+1);try{new vm.Script(source);return source;}catch{}}
 assert.fail('Cannot extract '+name);
}
function setup(){
 const cx=vm.createContext({C,console});const run=s=>vm.runInContext(s,cx);
 run(`
  let ship=C.newShip({L:240,W:160,H:100,assembly:true},'Symmetric engine connections');
  ship.parts=[];ship.fits=[];ship.nextId=56;
  const st={tab:'mod',group:'propulsion',part:'engine',engineDir:[-1,0,0],engineSizes:{},nozzleAppearance:'bell',mirror:true,vmirror:false,reactor:null};
  const ENGINE_SPEC_FIELDS=['propulsionModelVersion','ratedInputW','driveProfileId','machineryGradeId','machineryShape','machineryLengthM','machineryRadiusM','machineryOffsetM','machineryFeedRadiusM'];
  const engineSpecSnapshot=p=>Object.fromEntries(ENGINE_SPEC_FIELDS.filter(k=>p[k]!=null).map(k=>[k,p[k]]));
  function core(id,y,z,extra={}){return {id,k:'engineCore',c:[120,y,z],dir:[-1,0,0],d:10,length:20,propulsionModelVersion:C.PROPULSION_MODEL_VERSION,ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'standard',...extra};}
  const engineDefinition=C.EQUIPMENT.internalTurbine;
  const point=(y,z)=>[5,y,z];
 `);
 for(const name of ['engineConnectionOwner','engineCoreCandidates','rememberEngineCore','pendingEngineOwner','bindPendingEngineOwner','pendingEngine','equipmentPreview'])run(fn(name));
 return {run,cx};
}

test('an unselected nozzle automatically binds a unique declared core without duplicating its rated input',()=>{
 const {run:r}=setup();r('ship.parts=[core(2,50,20)];let p=pendingEngine(engineDefinition);p.id=56;bindPendingEngineOwner(p,point(50,20));let q=C.mirrorPart(p,ship);q.id=57;');
 assert.equal(r('p.machineryId'),2);assert.equal(r('q.machineryId'),2);assert.equal(r('p._pendingEngineOwnerReason'),undefined);
 assert.equal(r('C.resolveEngineSpec(p,ship).valid'),true);assert.equal(r('C.resolveEngineSpec(q,ship).valid'),true);
 const requests=r('C.buildPropulsionRequests([C.resolveEngineSpec(p,ship),C.resolveEngineSpec(q,ship)],{},1)');
 assert.equal(requests.length,2);assert.ok(Math.abs(requests.reduce((sum,p)=>sum+p.requestedInputW,0)-1e18)<1e6,'two outlets share one core rating');
});

test('actual nozzle previews select the corresponding core from one reciprocal left-right pair at the tapped side',()=>{
 const {run:r}=setup();r('ship.parts=[core(2,50,20,{tw:3}),core(3,50,-20,{tw:2})];let preview=pendingEngine(engineDefinition);');
 assert.equal(r('preview.machineryId'),0,'a miniature has no side until a real point is supplied');assert.ok(r('preview._pendingEngineOwnerReason'));
 for(const [z,id]of [[20,2],[-20,3]]){
  r(`let p${id}=equipmentPreview({p:point(50,${z}),n:[-1,0,0],kind:'part'},engineDefinition);p${id}.id=${id+54};`);
  assert.equal(r(`p${id}.machineryId`),id);assert.equal(r(`p${id}._pendingEngineOwnerReason`),undefined);assert.equal(r(`C.resolveEngineSpec(p${id},ship).valid`),true);
 }
 r('let reflected=C.mirrorPart(p2,ship);reflected.id=58;');assert.equal(r('reflected.machineryId'),3);assert.equal(r('C.resolveEngineSpec(reflected,ship).valid'),true);
});

test('automatic reference selection follows reciprocal vertical and combined symmetry around the ship mid-plane',()=>{
 const {run:r}=setup();r('ship.parts=[core(2,75,20,{tw:3,vt:4}),core(3,75,-20,{tw:2,vt:5}),core(4,25,20,{tw:5,vt:2}),core(5,25,-20,{tw:4,vt:3})];');
 for(const [y,z,id]of [[75,20,2],[75,-20,3],[25,20,4],[25,-20,5]]){
  r(`let p${id}=pendingEngine(engineDefinition);bindPendingEngineOwner(p${id},point(${y},${z}));`);assert.equal(r(`p${id}.machineryId`),id);
 }
 r('let down=C.vmirrorPart(p2,ship);down.id=60;let diagonal=C.mirrorPart(down,ship);diagonal.id=61;');assert.equal(r('down.machineryId'),4);assert.equal(r('diagonal.machineryId'),5);
});

test('explicit core selection and deliberate disconnected selection are not silently replaced by automatic matching',()=>{
 const {run:r}=setup();r('ship.parts=[core(2,50,20,{tw:3}),core(3,50,-20,{tw:2})];st.newEngineCoreId=2;let p=pendingEngine(engineDefinition);bindPendingEngineOwner(p,point(50,-20));');
 assert.equal(r('p.machineryId'),2);assert.equal(r('p._pendingEngineOwnerReason'),undefined);
 r('st.newEngineCoreId=0;let disconnected=pendingEngine(engineDefinition);bindPendingEngineOwner(disconnected,point(50,20));');
 assert.equal(r('disconnected.machineryId'),0);assert.equal(r('disconnected._pendingEngineOwnerReason'),undefined,'an intentional disconnected state is not an ambiguous automatic selection');
});

test('remembering a newly placed core limits automatic matching to its related group, including pending declaration',()=>{
 const {run:r}=setup();r('ship.parts=[core(2,50,20,{tw:3}),core(3,50,-20,{tw:2}),core(4,50,50)];ship.parts[0].placement={pendingGeometry:true};');
 assert.equal(r('rememberEngineCore(ship.parts[0])'),true);r('let p=pendingEngine(engineDefinition);bindPendingEngineOwner(p,point(50,-20));');
 assert.equal(r('p.machineryId'),3);assert.equal(r('p._pendingEngineOwnerReason'),undefined);
 assert.equal(r('rememberEngineCore({id:99,k:"cargo"})'),false);
});

test('unrelated groups and absent machinery remain unresolved instead of choosing an arbitrary nearest core',()=>{
 for(const data of ['[]','[core(2,50,20),core(3,50,-20)]','[core(2,50,20,{tw:3}),core(3,50,-20,{tw:2}),core(4,50,60)]']){
  const {run:r}=setup();r(`ship.parts=${data};let p=pendingEngine(engineDefinition);bindPendingEngineOwner(p,point(50,20));`);
  assert.equal(r('p.machineryId'),0,data);assert.ok(r('p._pendingEngineOwnerReason'),data);
 }
});

test('a remembered group never survives a switch to another ship with colliding stable IDs',()=>{
 const {run:r}=setup();r('ship.parts=[core(2,50,20,{tw:3}),core(3,50,-20,{tw:2})];rememberEngineCore(ship.parts[0]);ship={...ship,parts:[core(2,50,20),core(4,50,60)]};let p=pendingEngine(engineDefinition);bindPendingEngineOwner(p,point(50,20));');
 assert.equal(r('p.machineryId'),0);assert.ok(r('p._pendingEngineOwnerReason'));
});

test('invalid core declarations are not accepted as automatic engine owners',()=>{
 const {run:r}=setup();r('ship.parts=[core(2,50,20,{driveProfileId:"missing"})];let p=pendingEngine(engineDefinition);bindPendingEngineOwner(p,point(50,20));');
 assert.equal(r('p.machineryId'),0);assert.ok(r('p._pendingEngineOwnerReason'));
});

function authoringSetup({linked=true}={}){
 const t=require('./helpers/immediate-design-ui.cjs').setup(),r=t.run;
 r(`
  const ENGINE_SPEC_FIELDS=['propulsionModelVersion','ratedInputW','driveProfileId','machineryGradeId','machineryShape','machineryLengthM','machineryRadiusM','machineryOffsetM','machineryFeedRadiusM'];
  const engineSpecSnapshot=p=>Object.fromEntries(ENGINE_SPEC_FIELDS.filter(k=>p[k]!=null).map(k=>[k,p[k]]));
  Object.assign(st,{engineDir:[-1,0,0],engineSizes:{},nozzleAppearance:'bell',part:'engine',mirror:true,vmirror:false});
  const owner=(id,z,tw)=>({id,k:'engineCore',c:[0,0,z],dir:[-1,0,0],d:10,length:20,propulsionModelVersion:C.PROPULSION_MODEL_VERSION,ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'standard',...(tw?{tw}:{})});
  ship.parts.push(owner(3,12,${linked?4:'null'}),owner(4,-12,${linked?3:'null'}));ship.nextId=5;
 `);
 for(const name of ['engineConnectionOwner','engineCoreCandidates','rememberEngineCore','pendingEngineOwner','bindPendingEngineOwner','pendingEngine','equipmentPreview'])r(fn(name));
 r('partPreview=hit=>equipmentPreview(hit,C.EQUIPMENT.internalTurbine)');
 return t;
}

test('the actual immediate placement command binds both symmetric nozzles before assigning their stable IDs',()=>{
 const t=authoringSetup(),r=t.run;r('designUIRequest(hit(1,0,12))');
 assert.equal(r('ship.parts.length'),6);assert.deepEqual(plain(r('ship.parts.slice(4).map(p=>p.id)')),[5,6]);
 assert.deepEqual(plain(r('ship.parts.slice(4).map(p=>p.machineryId)')),[3,4]);
 assert.deepEqual(plain(r('ship.parts.slice(4).map(p=>C.resolveEngineSpec(p,ship).valid)')),[true,true]);
 assert.equal(r('undoStack.length'),1);assert.equal(r('designUI.armed'),false);assert.equal(t.requests.length,0);
});

test('an ambiguous automatic machinery selection never commits disconnected nozzles or consumes IDs',()=>{
 const t=authoringSetup({linked:false}),r=t.run;r('designUIRequest(hit(1,0,12))');
 assert.equal(r('ship.parts.length'),4);assert.equal(r('ship.nextId'),5);assert.equal(r('undoStack.length'),0);assert.equal(r('designUI.armed'),true);assert.equal(t.requests.length,0);
 assert.ok(r('notices.length>0||designUI.pending?.state==="failed"'),'the actual request reports the missing selection');
});

test('a stale symmetry link cannot create a nozzle pointing to a missing or invalid opposite core',()=>{
 for(const breakLink of ['ship.parts[2].tw=99','ship.parts[3]={id:4,k:"cargo",c:[0,0,-12],d:2}','ship.parts[3].driveProfileId="missing"']){
  const t=authoringSetup(),r=t.run;r(breakLink+';st.newEngineCoreId=3;designUIRequest(hit(1,0,12))');
  assert.equal(r('ship.parts.length'),4,breakLink);assert.equal(r('ship.nextId'),5,breakLink);assert.equal(r('undoStack.length'),0,breakLink);assert.equal(r('designUI.armed'),true,breakLink);assert.equal(t.requests.length,0);
  assert.ok(r('notices.length>0||designUI.pending?.state==="failed"'),breakLink);
 }
});
