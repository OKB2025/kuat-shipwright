const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));

function setup(selected=[1,2,3]){
 const context=vm.createContext({console});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const run=code=>vm.runInContext(code,context);
 run(`
 const C=Core;
 let ship=C.newShip({L:400,W:100,H:60},'Copy shared propulsion');
 ship.parts=[{id:1,k:'gen',c:[100,30,0],d:8},{id:2,k:'engine',c:[0,30,0],d:1,nozzleLength:1,bodyLength:2,bodyRadius:.52,dir:[-1,0,0],reactor:1}];
 C.migrateLegacyPropulsion(ship);
 ship.parts.push({...JSON.parse(C.publicJSON(ship.parts[1])),id:3,c:[0,30,10],machineryId:2});
 ship.nextId=4;
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
 assert.deepEqual(plain(run('ship.parts.filter(p=>p.id>=4).map(p=>({id:p.id,k:p.k,reactor:p.reactor,machineryId:p.machineryId}))')),[
  {id:4,k:'gen'},
  {id:5,k:'engine',reactor:4},
  {id:6,k:'engine',reactor:4,machineryId:5}
 ]);
 run('ship.parts=ship.parts.filter(p=>p.id>=4)');
 for(const id of [5,6]){
  const spec=plain(run(`C.resolveEngineSpec(ship.parts.find(p=>p.id===${id}),ship)`));
  assert.equal(spec.valid,true,spec.issues.join(', '));assert.equal(spec.reactorId,4);assert.equal(spec.machineryId,5);assert.equal(spec.powerNode,'p5');
 }
 const saved=plain(run('C.deserialize(C.serialize(ship)).parts'));
 assert.equal(saved.find(p=>p.id===6).machineryId,5);assert.equal(saved.find(p=>p.id===5).reactor,4);
});

test('ENG-T18 copying an outlet alone preserves its intentionally external owner and reactor',()=>{
 for(const action of ['multiPaste','editDuplicate']){
  const run=setup([3]);run(action+'()');
  const copy=plain(run('ship.parts.find(p=>p.id===4)'));
  assert.equal(copy.machineryId,2,action);assert.equal(copy.reactor,1,action);
  run('ship.parts=ship.parts.filter(p=>p.id!==3)');
  const spec=plain(run('C.resolveEngineSpec(ship.parts.find(p=>p.id===4),ship)'));
  assert.equal(spec.valid,true,action);assert.equal(spec.machineryId,2);assert.equal(spec.reactorId,1);assert.equal(spec.powerNode,'p2');
 }
});
