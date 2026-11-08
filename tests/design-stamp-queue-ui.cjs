// The user changed placement from serialized strict commits to immediate
// authoring. Keep the rapid-tap and history regressions at that new boundary.
const assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,plain,resolution}=require('./helpers/immediate-design-ui.cjs');

test('rapid taps create independent stable source records and undo units before any Worker response',()=>{
 const t=setup({continuous:true}),r=t.run;r('tap(-12);tap(0);tap(12);st.size=[9,9,9]');
 assert.equal(t.requests.length,0,'taps never await a dedicated strict placement request');
 assert.equal(r('ship.parts.length'),5);assert.equal(r('undoStack.length'),3);assert.equal(r('ship.nextId'),6);
 assert.deepEqual(plain(r('ship.parts.slice(2).map(p=>p.id)')),[3,4,5]);
 assert.deepEqual(plain(r('ship.parts.slice(2).map(p=>p.placement.requestedGeometry.s)')),[[4,4,4],[4,4,4],[4,4,4]]);
 assert.equal(r('C.placementDraftStatus(ship).pending.length'),3);assert.equal(r('designUI.armed'),true);
 r('undo()');assert.equal(r('ship.parts.length'),4);r('undo()');assert.equal(r('ship.parts.length'),3);r('redo()');assert.equal(r('ship.parts.length'),4);
});

test('a later exact failure keeps only that placed part repairable and preserves successful neighbors and history',()=>{
 const t=setup({continuous:true}),r=t.run;r('tap(-12);tap(1000);tap(12)');
 assert.equal(r('ship.parts.length'),5);assert.equal(r('undoStack.length'),3);
 t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);
 assert.equal(r('ship.parts.length'),5);assert.equal(r('ship.nextId'),6);assert.equal(r('undoStack.length'),3);
 assert.equal(r('ship.parts.find(p=>p.id===4).placement.validationFailed'),true);
 assert.equal(r('ship.parts.find(p=>p.id===4).placement.repairRequired'),true);
 assert.equal(r('ship.parts.find(p=>p.id===4).placement.requestedGeometry.c[0]'),1000);
 assert.deepEqual(plain(r('C.placementDraftStatus(ship).failed.map(p=>p.id)')),[4]);
 for(const id of [3,5])assert.equal(r('ship.parts.find(p=>p.id==='+id+').placement.pendingGeometry'),undefined);
});

test('a bad basic tap cannot remove a source record already placed synchronously',()=>{
 const t=setup({continuous:true}),r=t.run;r('tap(-12);designUIRequest(null)');
 assert.equal(r('ship.parts.length'),3);assert.equal(r('undoStack.length'),1);assert.equal(r('ship.parts[2].id'),3);assert.equal(t.requests.length,0);
});

test('deleting a parent invalidates an older background packet without resurrecting either parent or pending child',()=>{
 const t=setup(),r=t.run;r('tap(-12)');t.context.packet=resolution(t);
 r("mutate('delete parent',()=>C.removeParts(ship,[1]),'parts')");
 assert.deepEqual(plain(r('ship.parts.map(p=>p.id)')),[2]);assert.equal(r('onEnginePlacementResolution(packet)'),false);
 assert.deepEqual(plain(r('ship.parts.map(p=>p.id)')),[2]);assert.equal(r('undoStack.length'),2);
});

test('ending and restarting placement preserves the source records already placed',()=>{
 const t=setup(),r=t.run;r('tap(-12);designUICancel()');
 assert.equal(r('ship.parts.length'),3);assert.equal(r('designUI.armed'),false);assert.equal(r('undoStack.length'),1);
 r('designUI.armed=true;tap(12)');assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);assert.equal(t.requests.length,0);
});

test('one mirrored tap creates both provisional children in one atomic undo operation',()=>{
 const t=setup(),r=t.run;r('st.mirror=true;tap(0,8)');
 assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),1);assert.equal(r('C.placementDraftStatus(ship).pending.length'),2);
 assert.equal(r('ship.parts[2].tw'),r('ship.parts[3].id'));assert.equal(r('ship.parts[3].tw'),r('ship.parts[2].id'));
 r('undo()');assert.equal(r('ship.parts.length'),2);r('redo()');assert.equal(r('ship.parts.length'),4);
});

test('closing placement returns to read-only inspection without retaining the placement tool',()=>{
 const {run:r}=setup();assert.equal(r('designUIInspectMode()'),false);r('designUICancel()');assert.equal(r('designUIInspectMode()'),true);r('designUI.drawer=true');assert.equal(r('designUIInspectMode()'),false);
});
