const assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,C,fn,plain,resolution}=require('./helpers/immediate-design-ui.cjs');

test('a basic-invalid symmetry batch makes no partial edit and consumes no IDs',()=>{
 const t=setup(),r=t.run;r('const item={id:-1,k:"struct",form:"box",c:[0,5,0],s:[4,4,4]};const options={mode:"horizontal",contactFit:"cut",position:item.c,parentStructureId:1,hit:{p:[0,5,0],n:[0,1,0]}};const before=C.publicJSON(ship);designUIPlaceDraft([{part:item,request:options,symmetry:""},{part:{...item,s:[NaN,4,4]},request:options,symmetry:"z"}],options,"parts")');
 assert.equal(r('C.publicJSON(ship)'),r('before'));assert.equal(r('ship.nextId'),3);assert.equal(r('undoStack.length'),0);assert.equal(t.requests.length,0);
});

test('pending raw source saves and reloads before geometry finishes, including stable IDs and attachment metadata',()=>{
 const t=setup(),r=t.run;r('tap(0);const saved=C.serialize(ship)');
 const stored=plain(r('saved.parts.find(p=>p.id===3)'));assert.equal(stored.placement.pendingGeometry,true);assert.equal(stored.placement.parentStructureId,1);assert.equal(stored.placement.requestedGeometry.id,3);
 const loaded=C.deserialize(plain(r('saved')),{deferPlacementGeometry:true}),part=loaded.parts.find(p=>p.id===3);
 assert.equal(part.placement.pendingGeometry,true);assert.deepEqual(plain(part.placement.requestedGeometry),stored.placement.requestedGeometry);assert.equal(C.placementDraftStatus(loaded).ready,false);
});

test('derived adoption keeps the live ship and item identity, generation and one user history unit',()=>{
 const t=setup(),r=t.run;r('tap(0);const identity=ship,partIdentity=ship.parts[2],beforeGen=eng.gen');t.context.packet=resolution(t);
 assert.equal(r('onEnginePlacementResolution(packet)'),true);
 assert.equal(r('ship===identity'),true);assert.equal(r('ship.parts[2]===partIdentity'),true);assert.equal(r('eng.gen'),r('beforeGen'));assert.equal(r('undoStack.length'),1);assert.equal(r('redoStack.length'),0);
 assert.equal(r('C.placementDraftStatus(ship).ready'),true);assert.equal(r('ship.parts[2].placement.pendingGeometry'),undefined);
 assert.equal(r('C.placementCachedGeometryCurrent(ship,ship.parts[2])'),true,'the real engine geometry keys reach the canonical cache guards');
 r('undo()');assert.equal(r('ship.parts.length'),2);
});

test('a background packet never overwrites an edited or deleted source, even when its generation number is reused',()=>{
 for(const change of ['ship.parts[2].c[0]=7','ship.parts.splice(2,1)']){
  const t=setup(),r=t.run;r('tap(0)');t.context.packet=resolution(t);r(change);const before=r('C.publicJSON(ship)');
  assert.equal(r('onEnginePlacementResolution(packet)'),false);assert.equal(r('C.publicJSON(ship)'),before);assert.equal(r('undoStack.length'),1);
 }
});

test('Undo rejects a late derived packet and Redo restores editable pending source without an extra operation',()=>{
 const t=setup(),r=t.run;r('tap(0)');t.context.packet=resolution(t);r('undo()');assert.equal(r('onEnginePlacementResolution(packet)'),false);assert.equal(r('ship.parts.length'),2);assert.equal(r('undoStack.length'),0);
 r('redo()');assert.equal(r('ship.parts.length'),3);assert.equal(r('ship.parts[2].placement.pendingGeometry'),true);assert.equal(r('undoStack.length'),1);
});

test('matching background resolution updates an open clean editor baseline without manufacturing a dirty edit',()=>{
 const t=setup(),r=t.run;r('tap(0);const baselineDesign=C.serialize(ship);editSession={source:ship,before:snap(),design:baselineDesign,undo:undoStack.slice(),redo:redoStack.slice()};const initialUndo=undoStack.length');t.context.packet=resolution(t);
 assert.equal(r('onEnginePlacementResolution(packet)'),true);assert.equal(r('snap()===editSession.before'),true,'derived normalization is not an unapplied user edit');
 assert.equal(r('editSession.design.parts.find(p=>p.id===3).placement.pendingGeometry'),undefined);assert.equal(r('undoStack.length'),r('initialUndo'));
});

test('a resolution received during a drag waits for release without taking another history snapshot',()=>{
 const t=setup(),r=t.run;r('tap(0)');t.context.packet=resolution(t);r('dragSnap="active-drag"');assert.equal(r('onEnginePlacementResolution(packet)'),false);
 assert.equal(r('ship.parts[2].placement.pendingGeometry'),true);assert.equal(r('meshStore.pendingPlacementResolution===packet'),true);assert.equal(r('undoStack.length'),1);
 r('dragSnap=null');assert.equal(r('onEnginePlacementResolution(meshStore.pendingPlacementResolution)'),true);assert.equal(r('C.placementDraftStatus(ship).ready'),true);assert.equal(r('undoStack.length'),1);
});

test('the visible metrics remain provisional while a part is pending and report a later exact failure',()=>{
 const t=setup(),r=t.run;r(fn('designUIPlacementStage'));r(fn('designUIMetrics').replace('function designUIMetrics(', 'function actualDesignUIMetrics('));
 r('tap(1000);eng.statsGen=eng.gen;actualDesignUIMetrics()');assert.equal(r('$("#designMetrics").dataset.state'),'pending');assert.match(r('$("#designMetrics").innerHTML'),/計算中/);
 t.context.packet=resolution(t);r('onEnginePlacementResolution(packet);actualDesignUIMetrics()');assert.equal(r('$("#designMetrics").dataset.state'),'failed');assert.match(r('$("#designMetrics").innerHTML'),/計算失敗/);
});
