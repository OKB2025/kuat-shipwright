const assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,fn,plain,resolution}=require('./helpers/immediate-design-ui.cjs');

function interior({kind='cargo',mode='clip',continuous=false}={}){
 const t=setup({continuous}),r=t.run;
 r(`Object.assign(st,{part:${JSON.stringify(kind)},roomSize:[4,4,4],engineDir:[1,0,0],engineCoreSpec:{length:8,ratedInputW:1e18},alignment:'none'});
 Object.assign(designUI,{space:'interior',hostId:null,mode:${JSON.stringify(mode)}});
 const activeEquipment=()=>null,activeTemplate=()=>null,isSponsonPlacement=()=>false,isAeroKind=()=>false,pSize=()=>4;
 ${fn('extentAlong')}
 ${fn('unalignedPartPreview')}
 ${fn('pendingEngineCore')}
 partPreview=${fn('partPreview').replace(/^function partPreview/,'function')};`);
 return t;
}

test('an internal part can leave the catalogue without a mandatory host dropdown selection',()=>{
 const {run:r}=interior();r('designUI.armed=false;designUI.drawer=true;designUIArm()');
 assert.equal(r('designUI.armed'),true);assert.equal(r('designUI.drawer'),false);assert.equal(r('designUI.hostId'),null);assert.equal(r('notices.length'),0);
});

test('automatic internal picking uses actual mother candidates and retains the requested depth choice',()=>{
 const {run:r}=interior();r('designUI.depth=1;rayHits=[hit(1),hit(2,80)];const picked=pickRay([1,20,0],[0,-1,0],{parts:false,fits:false})');
 assert.equal(r('picked.parentStructureId'),2);assert.equal(r('rayCalls.length'),1);assert.equal(r('rayCalls[0].options.includeOccluded'),true);assert.equal(r('interiorCalls.length'),0);
 r('designUI.replaceId=3;pickRay([1,20,0],[0,-1,0],{parts:false,fits:false})');assert.equal(r('rayCalls.at(-1).options.excludePartId'),3);
});

test('a selected internal mother stays locked and cannot silently switch to a different tapped structure',()=>{
 const {run:r}=interior();r('designUI.hostId=1;interiorHits=[hit(1)];rayHits=[hit(2,80)];const picked=pickRay([1,20,0],[0,-1,0],{parts:false,fits:false});designUIRequest(hit(2,80));');
 assert.equal(r('picked.parentStructureId'),1);assert.equal(r('interiorCalls[0].parentId'),1);assert.equal(r('rayCalls.length'),0);assert.equal(r('ship.parts.length'),2);assert.equal(r('undoStack.length'),0);assert.equal(r('designUI.armed'),true);assert.ok(r('designUI.pending.result.error.includes("指定した内装の母体")'));
 r('designUIRequest(hit(1))');assert.equal(r('ship.parts.length'),3);assert.equal(r('ship.parts[2].placement.hostId'),1);assert.equal(r('designUI.armed'),false);
});

test('a missing mother or root work-plane tap cannot place an internal room or consume its one-shot tool',()=>{
 for(const bad of ['null','{p:[0,5,0],n:[0,1,0],rootPlane:true}','{p:[0,5,0],n:[0,1,0],parentStructureId:99}','{p:[0,5,0],n:[0,1,0],part:{id:90,k:"cargo"}}']){
  const {run:r}=interior();r('designUIRequest('+bad+')');assert.equal(r('ship.parts.length'),2,bad);assert.equal(r('undoStack.length'),0,bad);assert.equal(r('designUI.armed'),true,bad);
 }
});

for(const [kind,mode]of [['cargo','clip'],['cargo','preserve-volume'],['hangar','clip'],['battery','direct'],['engineCore','direct']]){
 test(`${kind} ${mode} uses the tapped mother through the real preview, immediate authoring and Worker solver`,()=>{
  const t=interior({kind,mode}),r=t.run;r('designUIRequest(hit(1))');assert.equal(r('ship.parts.length'),3);assert.equal(r('undoStack.length'),1);assert.equal(r('designUI.armed'),false);assert.equal(r('designUI.hostId'),null,'automatic selection must not lock future taps');
  const source=plain(r('ship.parts[2]'));assert.equal(source.placement.hostId,1);assert.equal(source.placement.mode,mode);assert.equal(source.placement.pendingGeometry,true);assert.equal(source.c[1],2,'actual preview offsets inside the 5m top skin');assert.equal(t.requests.length,0,'ordinary interior placement must not await a strict actor');
  t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);assert.equal(r('C.placementDraftStatus(ship).ready'),true);assert.equal(r('ship.parts[2]._interiorPlacementError'),undefined);assert.equal(r('ship.parts[2].placement.hostId'),1);assert.equal(r('undoStack.length'),1);assert.equal(r('ship.parts[2].id'),source.id);
  const reloaded=t.C.deserialize(t.C.serialize(r('ship'))),part=reloaded.parts.find(p=>p.id===source.id);assert.equal(part.placement.hostId,1);assert.equal(part.placement.mode,mode);assert.ok(t.C.partVolume(part)>0);
 });
}

test('checked repeat placement may choose different mothers without creating a permanent dropdown lock',()=>{
 const t=interior({continuous:true}),r=t.run;r('designUIRequest(hit(1));designUIRequest(hit(2,80))');
 assert.equal(r('ship.parts.length'),4);assert.equal(r('designUI.armed'),true);assert.equal(r('designUI.hostId'),null);assert.deepEqual(plain(r('ship.parts.slice(2).map(p=>p.placement.hostId)')),[1,2]);assert.equal(r('undoStack.length'),2);
 t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);assert.equal(r('C.placementDraftStatus(ship).ready'),true);
});

test('an automatic interior placement can use the existing legacy hull without fabricating a structural parent',()=>{
 const t=interior(),r=t.run;r(`ship.hull={...C.newShip({L:160,W:100,H:100,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1}).hull,assembly:false};ship.parts=[];ship.nextId=1;designUIRequest({p:[80,100,0],n:[0,1,0],kind:'hull',parentStructureId:'hull'})`);
 assert.equal(r('ship.parts.length'),1);assert.equal(r('ship.parts[0].placement.hostId'),'hull');assert.equal(r('designUI.hostId'),null);
 t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);assert.equal(r('C.placementDraftStatus(ship).ready'),true);assert.equal(r('ship.parts.length'),1);
});

test('a previous interior selection cannot leak its mother into a new exterior root request',()=>{
 const {run:r}=setup({empty:true});r('designUI.hostId=99;designUIRequest({p:[0,0,0],n:[0,1,0],kind:"section",rootPlane:true})');
 assert.equal(r('ship.parts.length'),1);assert.equal(r('ship.parts[0].placement.root'),true);assert.equal(r('designUI.lastStamp.request.hostId'),undefined);assert.equal(r('ship.parts[0].placement.hostId'),undefined);
});
