const assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,plain,resolution}=require('./helpers/immediate-design-ui.cjs');

test('the new UI records a source immediately and later adopts exact derived geometry without a second edit',()=>{
 const t=setup(),r=t.run;r('tap(0);const placed=ship.parts[2],generation=eng.gen');
 assert.equal(r('ship.parts.length'),3);assert.equal(r('undoStack.length'),1);assert.equal(r('placed.placement.pendingGeometry'),true);assert.equal(t.requests.length,0);
 t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);
 assert.equal(r('ship.parts[2]===placed'),true);assert.equal(r('ship.parts.length'),3);assert.equal(r('eng.gen'),r('generation'));assert.equal(r('undoStack.length'),1);assert.equal(r('C.placementDraftStatus(ship).ready'),true);
});

test('ending placement before a background result keeps the authored part and still permits its matching resolution',()=>{
 const t=setup(),r=t.run;r('tap(0)');t.context.packet=resolution(t);r('designUICancel()');
 assert.equal(r('designUI.armed'),false);assert.equal(r('ship.parts.length'),3);assert.equal(r('onEnginePlacementResolution(packet)'),true);
 assert.equal(r('ship.parts.length'),3);assert.equal(r('undoStack.length'),1);assert.equal(r('C.placementDraftStatus(ship).ready'),true);
});

test('an actual editor touch makes an older background result stale without rolling the edit back',()=>{
 const t=setup(),r=t.run;r('tap(0)');t.context.packet=resolution(t);r("mutate('move parent',()=>{ship.parts[0].c[0]=20},'parts')");
 assert.equal(r('onEnginePlacementResolution(packet)'),false);assert.equal(r('ship.parts[0].c[0]'),20);assert.equal(r('ship.parts.length'),3);assert.equal(r('ship.parts[2].placement.pendingGeometry'),true);assert.equal(r('undoStack.length'),2);
});

test('wrong design or generation and malformed entity envelopes cannot replace the placed source',()=>{
 for(const change of ['packet.gen--','packet.designId="other"','packet.rows=null','packet.rows[0].list="hatches"','packet.rows[0].id=999','packet.rows[0].part.id=999','packet.rows[0].sourceKey="old-source"']){
  const t=setup(),r=t.run;r('tap(0)');t.context.packet=resolution(t);r(change);const before=r('C.publicJSON(ship)');
  assert.equal(r('onEnginePlacementResolution(packet)'),false,change);assert.equal(r('C.publicJSON(ship)'),before,change);assert.equal(r('undoStack.length'),1);
 }
});

test('rapid positions are all authored before a reply and the latest complete resolution adds no extra history',()=>{
 const t=setup(),r=t.run;r('tap(-8)');t.context.old=resolution(t);r('tap(8)');
 assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);assert.equal(r('onEnginePlacementResolution(old)'),false);
 t.context.latest=resolution(t);assert.equal(r('onEnginePlacementResolution(latest)'),true);assert.deepEqual(plain(r('ship.parts.slice(2).map(p=>p.placement.requestedGeometry.c[0])')),[-8,8]);
 assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);assert.equal(r('C.placementDraftStatus(ship).ready'),true);assert.equal(t.requests.length,0);
});

test('a failed exact resolution marks the placed entity for repair without removing its source or prior placements',()=>{
 const t=setup(),r=t.run;r('tap(-8);tap(1000)');t.context.packet=resolution(t);
 assert.equal(r('packet.rows.some(row=>row.error)'),true);assert.equal(r('onEnginePlacementResolution(packet)'),true);
 assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);const failed=plain(r('ship.parts.find(p=>p.id===4)'));
 assert.equal(failed.placement.validationFailed,true);assert.equal(failed.placement.repairRequired,true);assert.deepEqual(failed.placement.requestedGeometry.c,[1000,5,0]);assert.equal(r('C.placementDraftStatus(ship).failed.length'),1);
});

test('switching the source design rejects an older packet without replacing either design object',()=>{
 const t=setup(),r=t.run;r('tap(0)');t.context.packet=resolution(t);r('const oldShip=ship;ship={...ship,saveId:"ship-B"};const currentShip=ship,before=C.publicJSON(ship)');
 assert.equal(r('onEnginePlacementResolution(packet)'),false);assert.equal(r('ship===currentShip'),true);assert.equal(r('ship===oldShip'),false);assert.equal(r('C.publicJSON(ship)'),r('before'));assert.equal(r('undoStack.length'),1);
});
