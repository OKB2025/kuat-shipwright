const assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,plain,resolution}=require('./helpers/immediate-design-ui.cjs');

test('arming exterior placement waits for the actual canvas tap to choose its parent',()=>{
 const {run:r}=setup();r('designUI.armed=false;designUI.drawer=true;designUI.parentId=null;designUIArm()');assert.equal(r('designUI.armed'),true);assert.equal(r('designUI.drawer'),false);assert.equal(r('notices.length'),0);
});

test('the tapped structure replaces the former parent and immediately stores its current geometry revision',()=>{
 const {run:r}=setup();r('const parent=ship.parts[1];parent.placement={modelVersion:1,mode:"horizontal",root:true,geometryRevision:7,requestedGeometry:publicCopy(parent)};designUIRequest(hit(2,80))');
 assert.equal(r('designUI.parentId'),2);assert.equal(r('designUI.lastStamp.request.parentStructureId'),2);assert.equal(r('designUI.lastStamp.request.parentGeometryRevision'),7);assert.equal(r('ship.parts[2].placement.parentStructureId'),2);assert.equal(r('ship.parts[2].placement.parentGeometryRevision'),7);
});

test('successive taps immediately retain their own parent and stable face without cancelling earlier source records',()=>{
 const {run:r,requests}=setup();r('designUIRequest(hit(1,0));designUIRequest(hit(2,80))');
 assert.equal(requests.length,0);assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);
 assert.deepEqual(plain(r('ship.parts.slice(2).map(p=>p.placement.parentStructureId)')),[1,2]);
 assert.deepEqual(plain(r('ship.parts.slice(2).map(p=>p.placement.hostSurfaceId)')),plain(r('[faceIds.get(1),faceIds.get(2)]')));assert.equal(r('designUI.lastStamp.request.parentStructureId'),2);
});

test('surface mode preserves an isolated exact point, normal, tangent and stable face',()=>{
 const {run:r}=setup();r('designUI.mode="surface";const original=hit(2,80);original.n=[.6,.8,0];designUIRequest(original);original.p[0]=999;original.n[0]=-1;original.u[0]=9');
 const request=plain(r('designUI.lastStamp.request'));assert.equal(request.mode,'surface');assert.equal(request.hostSurfaceId,r('faceIds.get(2)'));assert.deepEqual(request.hit,{p:[80,5,0],n:[.6,.8,0],u:[1,0,0],kind:'part',face:'top'});assert.equal(r('ship.parts[2].placement.mode'),'surface');
});

test('a missing or invalid hit never falls back to the former parent or removes an earlier placement',()=>{
 for(const bad of ['null','{p:[0,0,0],n:[0,1,0],part:{id:90,k:"cargo"}}','{p:[0,0,0],n:[0,1,0],fit:{id:8}}','{p:[0,0,0],n:[0,1,0],parentStructureId:99}']){
  const {run:r}=setup();r('tap(0);designUIRequest('+bad+')');assert.equal(r('ship.parts.length'),3,bad);assert.equal(r('undoStack.length'),1,bad);assert.equal(r('designUI.pending.state'),'failed',bad);assert.equal(r('diagnostics.at(-1)'),null);assert.equal(r('hoverLines'),null);
 }
});

test('canvas picking uses the nearest visible structure instead of the former parent or old depth choice',()=>{
 const {run:r}=setup();r('designUI.depth=5;rayHits=[hit(2,80),hit(1)];const picked=pickRay([1,2,3],[0,-1,0],{parts:true,fits:false})');assert.equal(r('picked.parentStructureId'),2);assert.equal(r('rayCalls.length'),1);assert.equal(r('rayCalls[0].model===ship'),true);assert.equal(r('interiorCalls.length'),0);
 r('designUI.replaceId=2;pickRay([1,2,3],[0,-1,0],{parts:true,fits:false})');assert.equal(r('rayCalls.at(-1).options.excludePartId'),2);
});

test('an exterior ray without a visible parent cannot become a placement surface',()=>{
 const {run:r}=setup();assert.equal(r('pickRay([1,2,3],[0,-1,0],{parts:true,fits:false})'),null);assert.equal(r('rayCalls.length'),1);
});

test('interior depth selection keeps its explicit host rather than using exterior tap parenting',()=>{
 const {run:r}=setup();r('st.part="cargo";designUI.space="interior";designUI.mode="clip";designUI.hostId=1;designUI.depth=1;interiorHits=[hit(1),{...hit(1),hostSurfaceId:"interior-second"}];const picked=pickRay([1,2,3],[0,-1,0],{parts:true,fits:false})');assert.equal(r('picked.hostSurfaceId'),'interior-second');assert.equal(r('interiorCalls[0].parentId'),1);assert.equal(r('rayCalls.length'),0);
});

test('weapons immediately use the tapped parent and direct mode, then resolve their true support in the background',()=>{
 const t=setup(),r=t.run;r('currentTool="fit";st.part="pd";designUIRequest(hit(2,80))');
 const request=plain(r('designUI.lastStamp.request'));assert.equal(request.list,'fits');assert.equal(request.entityKind,'fit');assert.equal(request.mode,'direct');assert.equal(request.hostId,2);assert.deepEqual(request.hit.p,[80,5,0]);assert.equal(r('ship.fits.length'),1);assert.equal(r('ship.fits[0].host'),2);assert.equal(r('ship.fits[0].placement.pendingGeometry'),true);assert.equal(t.requests.length,0);
 t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);assert.equal(r('ship.fits.length'),1);assert.equal(r('ship.fits[0].placement.pendingGeometry'),undefined);assert.equal(r('ship.fits[0].float'),false);assert.equal(r('undoStack.length'),1);
});

test('an explicit placement start retains the selected part and face-placement mode',()=>{
 const {run:r}=setup();r('designUI.armed=false;st.surfaceMode="surface";designUIStartTap(hit(2,80))');assert.equal(r('designUI.armed'),true);assert.equal(r('designUI.drawer'),false);assert.equal(r('ship.parts.length'),3);assert.equal(r('ship.parts[2].placement.mode'),'surface');assert.equal(r('ship.parts[2].placement.parentStructureId'),2);
});
