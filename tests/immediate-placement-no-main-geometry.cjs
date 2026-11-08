const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,fn}=require('./helpers/immediate-design-ui.cjs'),root=path.resolve(__dirname,'..');
function guardedRuntime(){
 const context=vm.createContext({console,performance,__mainGuard:false,__allowWeaponAdoption:false,__mainLightAdoptions:0,__mainBlocked:[]});
 const heavy=['adoptWeaponFits','surfaceSync','surfacePatches','surfaceWorkingShip','buildDesign','syncCompartments','placementContact','fitPlacementContact','computeStats','solvePlacement','solveFitPlacement','solveInteriorPlacement','buildEngineMountSupport','hardConflicts','hullGeo','referenceHullGeometry','enginePaths','partVolume','structTriangles'];
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
  let source=fs.readFileSync(path.join(root,file),'utf8');
  if(file==='js/core.js')for(const name of heavy){const marker='function '+name+'(';assert.ok(source.includes(marker),name);const allowed=name==='adoptWeaponFits'?'globalThis.__allowWeaponAdoption':'false';source=source.replace(marker,`function ${name}(...args){if(globalThis.__mainGuard){if(${allowed})globalThis.__mainLightAdoptions++;else{globalThis.__mainBlocked.push('${name}');throw Error('main-thread geometry forbidden: ${name}');}}return ${name}MainGuardRaw(...args);}\nfunction ${name}MainGuardRaw(`);}
  vm.runInContext(source,context,{filename:file});
 }
 return {C:vm.runInContext('Core',context),context};
}
test('actual source mutation, history and engine transport place synchronously without hidden whole-design Core work',()=>{
 const runtime=guardedRuntime(),t=setup({core:runtime.C,continuous:true}),r=t.run;
 r('ship.surfaces={version:4,mode:"strict",patches:[],partitions:[]}');
 runtime.context.__mainGuard=true;
 assert.throws(()=>runtime.C.publicJSON(r('ship')),/main-thread geometry forbidden: adoptWeaponFits/,'the guard detects the former hidden whole-design serialization work');
 runtime.context.__mainBlocked.length=0;
 try{
  r('tap(-8);tap(8);const history=snap(),engineState=engineShipState(ship),portable=designUISavedDesign()');
  assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);assert.equal(r('notices.length'),0);
  assert.equal(r('JSON.parse(history).parts.length'),4);assert.equal(r('JSON.parse(engineState).parts.length'),4);assert.equal(r('portable.parts.length'),4);
  assert.equal(r('portable.parts[2].placement.pendingGeometry'),true);assert.equal(r('portable.v'),3);assert.equal(r('portable.format'),'starship-yard');
  assert.equal(runtime.context.__mainBlocked.length,0,'no expensive Core call is hidden behind mutate, snap, touch or transport');
 }finally{runtime.context.__mainGuard=false;}
});
test('pending catalogue metrics read actual Worker statistics without synchronizing the surface model',()=>{
 const runtime=guardedRuntime(),t=setup({core:runtime.C}),r=t.run;
 const stats=runtime.C.computeStats(JSON.parse(r('engineShipState(ship)')));t.context.workerStats=stats;
 r(fn('designAccelerationG'));r(fn('catalogStats'));r('ship.surfaces={version:4,mode:"strict",patches:[],partitions:[]};tap(0);eng.statsGen=eng.gen');
 runtime.context.__mainGuard=true;
 try{r('const readout=catalogStats(workerStats)');assert.equal(r('readout.power'),stats.power);assert.equal(r('readout.mass'),stats.mass);assert.equal(runtime.context.__mainBlocked.length,0);}finally{runtime.context.__mainGuard=false;}
});
test('immediate Undo, Redo and raw pending saves keep the authored IDs without starting geometry or completed-profile work',async()=>{
 const runtime=guardedRuntime(),t=setup({core:runtime.C,continuous:true}),r=t.run;
 r(`ship.surfaces={version:4,mode:'strict',patches:[],partitions:[]};
 let savingCurrent=false;
 const savedRecords=[];
 async function pack(design){return JSON.stringify(design);}
 const Store={async save(record){savedRecords.push(record);return 'local';}};
 function renderSaves(){events.push('saves');}
 `);
 r(fn('saveCurrent'));
 runtime.context.__mainGuard=true;
 try{
  r('tap(-8);tap(8);const originalIds=ship.parts.map(part=>part.id),originalNextId=ship.nextId;');
  assert.equal(r('undoStack.length'),2);
  // The normal deferred loader and patcher still run their bounded fitting
  // metadata normalization. Every geometric function remains prohibited.
  runtime.context.__allowWeaponAdoption=true;
  try{r('undo();');assert.deepEqual(Array.from(r('ship.parts.map(part=>part.id)')),Array.from(r('originalIds.slice(0,-1)')));assert.equal(r('redoStack.length'),1);r('redo();');}
  finally{runtime.context.__allowWeaponAdoption=false;}
  assert.ok(runtime.context.__mainLightAdoptions>0,'Undo uses the existing deferred loader rather than inventing another saved format');
  assert.deepEqual(Array.from(r('ship.parts.map(part=>part.id)')),Array.from(r('originalIds')));
  assert.equal(r('ship.nextId'),r('originalNextId'));assert.equal(r('undoStack.length'),2);assert.equal(r('redoStack.length'),0);
  assert.equal(r('C.placementDraftStatus(ship).pending.length'),2);
  assert.equal(r('S'),null,'saving the editable source does not require performance statistics');
  await r('saveCurrent()');
  assert.equal(r('savedRecords.length'),1);assert.equal(r('savedRecords[0].id'),'immediate-source');
  assert.equal(r('savedRecords[0].provisional'),true);assert.equal(r('savedRecords[0].cls'),'計算中');
  const record=r('savedRecords[0]'),saved=JSON.parse(record.data);
  assert.deepEqual(saved.parts.map(part=>part.id),Array.from(r('originalIds')));assert.equal(saved.nextId,r('originalNextId'));
  for(const part of saved.parts.slice(2)){assert.equal(part.placement.pendingGeometry,true);assert.equal(part.placement.requestedGeometry.id,part.id);}
  assert.equal(saved.surfaces.legacyArmor,r('ship.armor.hull'),'the raw save preserves the legacy surface armor fallback without a survey');
  assert.equal(t.requests.length,0,'unresolved raw blueprints do not prepare a completed combat profile');
  assert.equal(runtime.context.__mainBlocked.length,0,'history restoration and pending save never enter a surface survey, mesh, contact, CSG or statistics solver');
 }finally{runtime.context.__mainGuard=false;runtime.context.__allowWeaponAdoption=false;}
});
