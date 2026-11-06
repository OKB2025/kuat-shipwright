const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

function setup(selected=[1,2,3,4]){
 const context=vm.createContext({console});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const run=code=>vm.runInContext(code,context);
 run(`
 const C=Core;
 let ship=C.newShip({L:400,W:100,H:60},'Copy shared propulsion');
 ship.parts=[{id:1,k:'gen',c:[100,30,0],d:8},{id:2,k:'engineCore',c:[70,30,0],d:2,length:2,dir:[-1,0,0],reactor:1,propulsionModelVersion:1,ratedInputW:1e18,driveProfileId:'standard',machineryGradeId:'standard'},...[-10,10].map((z,i)=>({id:3+i,k:'engine',c:[0,30,z],d:1,nozzleLength:1,dir:[-1,0,0],reactor:1,machineryId:2,propulsionModelVersion:1}))];
 ship.nextId=5;
 const selection=new Set(${JSON.stringify(selected)}),st={pasteMode:'same',xf:{step:10}},messages=[];
 const clip={...C.surfaceCopySelection(ship,{parts:[...selection],fits:[]}),from:{L:400,H:60,W:100}};
 const clipRead=()=>clip,toast=message=>messages.push(message),mutate=(label,action)=>action(),publicCopy=value=>JSON.parse(C.publicJSON(value));
 const xfDrivers=()=>ship.parts.filter(part=>selection.has(part.id)).map(it=>({list:'parts',it,fol:[]}));
 const xfBox=(list,part)=>C.partAABB(part),xfUnion=boxes=>[0,1,2].map(i=>Math.min(...boxes.map(b=>b[i]))).concat([3,4,5].map(i=>Math.max(...boxes.map(b=>b[i]))));
 const xfCheck=()=>new Map(),edGroups=()=>[],edParent=()=>null,fmtM=value=>String(value);
 `);
 const extract=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));};
 extract('function copyWingLinks(', 'function multiPaste(');
 extract('function multiPaste()', 'function multiMove(');
 extract('function editDuplicate()', 'function editDelete()');
 return run;
}

for(const action of ['multiPaste','editDuplicate'])test(`ENG-T18 ${action} remaps copied reactors and shared machinery without relying on originals`,()=>{
 const run=setup();run(action+'()');
 assert.deepEqual(plain(run('ship.parts.filter(p=>p.id>=5).map(p=>({id:p.id,k:p.k,reactor:p.reactor,machineryId:p.machineryId}))')),[
  {id:5,k:'gen'},
  {id:6,k:'engineCore',reactor:5},
  {id:7,k:'engine',reactor:5,machineryId:6},
  {id:8,k:'engine',reactor:5,machineryId:6}
 ]);
 run('ship.parts=ship.parts.filter(p=>p.id>=5)');
 for(const id of [7,8]){
  const spec=plain(run(`C.resolveEngineSpec(ship.parts.find(p=>p.id===${id}),ship)`));
  assert.equal(spec.valid,true,spec.issues.join(', '));assert.equal(spec.reactorId,5);assert.equal(spec.machineryId,6);assert.equal(spec.powerNode,'p6');assert.equal(spec.ratedInputW,1e18);
 }
 const saved=plain(run('C.deserialize(C.serialize(ship)).parts'));
 assert.equal(saved.find(p=>p.id===7).machineryId,6);assert.equal(saved.find(p=>p.id===8).machineryId,6);assert.equal(saved.find(p=>p.id===6).reactor,5);assert.equal(saved.find(p=>p.id===6).ratedInputW,1e18);
});

test('ENG-T18 copying an outlet alone preserves its intentionally external owner and reactor',()=>{
 for(const action of ['multiPaste','editDuplicate']){
  const run=setup([3]);run(action+'()');
  const copy=plain(run('ship.parts.find(p=>p.id===5)'));
  assert.equal(copy.machineryId,2,action);assert.equal(copy.reactor,1,action);
  run('ship.parts=ship.parts.filter(p=>p.id!==3)');
  const spec=plain(run('C.resolveEngineSpec(ship.parts.find(p=>p.id===5),ship)'));
  assert.equal(spec.valid,true,action);assert.equal(spec.machineryId,2);assert.equal(spec.reactorId,1);assert.equal(spec.powerNode,'p2');
 }
});

test('pasting a complete engine assembly selects the pasted parts for the next move',()=>{
 const run=setup();run('st.sel={list:"parts",id:1};multiPaste()');
 assert.deepEqual(plain(run('st.sel')),{list:'parts',id:5});assert.deepEqual(plain(run('[...st.multi.parts]')),[5,6,7,8]);
 assert.equal(run('st.multi.parts.has(1)'),false,'the source reactor is not selected by a paste');
});
