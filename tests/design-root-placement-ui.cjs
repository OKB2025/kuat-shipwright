const assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,plain,resolution}=require('./helpers/immediate-design-ui.cjs');

test('the first tap immediately records a real root on the explicit Y=0 workspace and drops old template parents',()=>{
 const t=setup({empty:true}),r=t.run;
 r('designUI.drawer=true;designUI.armed=false;designUI.parentId=999;designUI.hostId=777;templateDraft={id:-1,k:"struct",form:"box",s:[10,8,4],placement:{modelVersion:1,mode:"surface",parentStructureId:99,hostId:77,geometryRevision:4}};designUIArm();const tapHit=pickRay([20,30,40],[0,-1,0],{parts:false,fits:false})');
 assert.deepEqual(plain(r('tapHit')),{p:[20,0,40],n:[0,1,0],t:30,distance:30,kind:'section',rootPlane:true});assert.equal(r('designUI.parentId'),null);
 r('designUIRequest(tapHit)');assert.equal(r('ship.parts.length'),1,'the root exists before any Worker response');assert.equal(r('undoStack.length'),1);assert.equal(r('ship.nextId'),2);
 const part=plain(r('ship.parts[0]'));assert.equal(part.id,1);assert.equal(part.placement.root,true);assert.equal(part.placement.pendingGeometry,true);assert.equal(part.placement.parentStructureId,undefined);assert.equal(part.placement.hostId,undefined);assert.deepEqual(part.c,[20,0,40]);assert.equal(t.requests.length,0);assert.equal(r('designUI.armed'),true);
 t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);assert.equal(r('ship.parts.length'),1);assert.equal(r('undoStack.length'),1);assert.equal(r('ship.parts[0].placement.root'),true);
});

test('empty space cannot act as a parent for exterior equipment or weapons, even with an armed tool',()=>{
 for(const kind of ['sensor','engine','pd']){
  const {run:r}=setup({empty:true});r('st.part='+JSON.stringify(kind)+(kind==='pd'?';currentTool="fit"':''));
  assert.equal(r('pickRay([20,30,40],[0,-1,0],{parts:false,fits:false})'),null,kind);
  r('designUIRequest({p:[20,0,40],n:[0,1,0],kind:"section",rootPlane:true})');assert.equal(r('ship.parts.length'),0,kind);assert.equal(r('ship.fits.length'),0,kind);assert.equal(r('undoStack.length'),0,kind);
 }
});

test('workspace fallback refuses existing parts, fittings, reconnection and invalid plane rays',()=>{
 for(const preparation of ['ship.parts.push({id:1,k:"struct",form:"box",c:[0,0,0],s:[2,2,2]})','ship.fits.push({id:1,k:"pd",p:[0,0,0]})','designUI.replaceId=1','ship.hull.assembly=false']){
  const {run:r}=setup({empty:true});r(preparation);assert.equal(r('designUIRootPlaneHit([20,30,40],[0,-1,0])'),null,preparation);
 }
 const {run:r}=setup({empty:true});for(const ray of ['[[0,1,0],[1,0,0]]','[[0,1,0],[0,1,0]]','[[NaN,1,0],[0,-1,0]]','[[1e20,1,0],[0,-1,0]]'])assert.equal(r('designUIRootPlaneHit(...'+ray+')'),null,ray);
});
