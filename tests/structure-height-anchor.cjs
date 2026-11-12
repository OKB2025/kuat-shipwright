const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root),plain=value=>JSON.parse(C.publicJSON(value));
const near=(actual,expected,epsilon=2e-5)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<=epsilon,`${actual} != ${expected}`);
const nearPoint=(actual,expected)=>actual.forEach((v,i)=>near(v,expected[i]));
function fixture({mode='horizontal',underside=false,form='box',tilted=false,pending=false}={}){
 const ship=C.newShip({L:200,W:200,H:100,assembly:true},'Height anchor regression'),parent={id:1,k:'struct',form:'box',c:[0,0,0],s:[100,100,20],...(tilted?{pitch:25}:{})};
 Object.assign(ship,{parts:[parent],fits:[],hatches:[],links:[],groups:[],nextId:3,autoHabitation:false});
 const ray=mode==='vertical'?[[200,0,0],[-1,0,0]]:underside?[[0,-200,0],[0,1,0]]:[[0,200,0],[0,-1,0]],hit=C.rayPart(...ray,parent);assert.ok(hit);
 const center=mode==='vertical'?[55,0,0]:C.add(hit.p,mode==='surface'?C.mul(hit.n,20):[0,underside?-10:10,0]),input={id:2,k:'struct',form,c:center,s:[20,20,40],taper:form==='trap'?.75:0,yaw:mode==='surface'?17:0},request={mode,parentStructureId:1,position:center,hit,...(mode==='surface'?{}:{contactFit:'cut',contactSide:mode==='vertical'?'aft':underside?'top':'bottom'})};
 const result=pending?C.preparePlacementDraft(ship,input,request):C.solvePlacement(ship,input,request);assert.equal(result.ok,true,result.error);ship.parts.push(result.part);return {ship,parent,part:result.part,hit,request};
}
function refresh(ship,part){const result=C.refreshPlacementGeometry(ship);assert.equal(result.ok,true,JSON.stringify(result.failed));assert.equal(part._placementError,undefined);assert.equal(C.placementCachedGeometryInputCurrent(part),true);}
function assertStableReload(ship,part){
 const center=plain(part.c),size=plain(part.s),volume=C.partVolume(part),bounds=C.partAABB(part),request=plain(part.placement.requestedGeometry),loaded=C.deserialize(C.serialize(ship)),copy=loaded.parts.find(p=>p.id===part.id);
 nearPoint(copy.c,center);nearPoint(copy.s,size);nearPoint(C.partAABB(copy),bounds);near(C.partVolume(copy),volume,.002);const restored=plain(copy.placement.requestedGeometry);for(const key of ['c','s','surfaceNormal'])if(request[key]){nearPoint(restored[key],request[key]);delete restored[key];delete request[key];}assert.deepEqual(restored,request);assert.equal(C.placementDiagnostics(loaded).find(p=>p.partId===copy.id).connected,true);
}

test('resizing a fitted child immediately replaces the old floating local solid with its new requested bounds',()=>{
 const {ship,parent,part}=fixture(),parentBefore=C.publicJSON(parent),original=part._placementGeometry;assert.ok(original);nearPoint(C.partAABB(part),[-10,10,-10,10,40,10]);
 assert.equal(C.resizeStructureHeightAtContact(part,100),true);nearPoint(part.c,[0,50,0]);assert.equal(part._placementGeometry,undefined,'the 40m effective solid cannot be translated to the new 100m center');nearPoint(C.partAABB(part),[-10,0,-10,10,100,10]);
 assert.equal(C.placementCachedGeometryInputCurrent(part),false);refresh(ship,part);nearPoint(part.c,[0,50,0]);nearPoint(C.partAABB(part),[-10,10,-10,10,100,10]);assert.notEqual(part._placementGeometry,original);assert.equal(C.publicJSON(parent),parentBefore);assertStableReload(ship,part);
});

test('successive height changes keep the authored base, taper and parent cut fixed through warm and cold solves',()=>{
 const {ship,parent,part}=fixture({form:'trap'}),parentBefore=C.publicJSON(parent),base=part.c[1]-part.s[2]/2,side=part.placement.contactSide,anchor=plain(part.placement.surfaceAnchor);let previousVolume=C.partVolume(part);
 for(const height of [100,60,120]){
  const previous=part.s[2];assert.equal(C.resizeStructureHeightAtContact(part,height),true);near(part.c[1]-height/2,base);assert.equal(part.form,'trap');near(part.taper,.75);nearPoint(part.placement.surfaceAnchor,anchor);assert.equal(part.placement.contactSide,side);nearPoint(part.placement.requestedGeometry.c,part.c);near(part.placement.requestedGeometry.s[2],height);refresh(ship,part);near(part.c[1]-height/2,base);near(C.partAABB(part)[1],10);near(C.partAABB(part)[4],base+height);assert.equal(Math.sign(C.partVolume(part)-previousVolume),Math.sign(height-previous));previousVolume=C.partVolume(part);assertStableReload(ship,part);
 }
 assert.equal(C.publicJSON(parent),parentBefore);
});

test('underside height changes grow downwards without moving the parent contact or retaining an old-height slab',()=>{
 const {ship,parent,part}=fixture({underside:true}),parentBefore=C.publicJSON(parent),base=part.c[1]+part.s[2]/2;
 assert.equal(C.resizeStructureHeightAtContact(part,100),true);near(part.c[1]+50,base);nearPoint(C.partAABB(part),[-10,-100,-10,10,0,10]);refresh(ship,part);nearPoint(C.partAABB(part),[-10,-100,-10,10,-10,10]);near(part.c[1]+50,base);assert.equal(C.publicJSON(parent),parentBefore);assertStableReload(ship,part);
});

test('upright side-mounted height changes retain the lower edge and the parent-facing side',()=>{
 const {ship,parent,part}=fixture({mode:'vertical'}),parentBefore=C.publicJSON(parent),base=part.c[1]-part.s[2]/2,x=part.c[0],yaw=part.yaw;
 assert.equal(C.resizeStructureHeightAtContact(part,100),true);near(part.c[1]-50,base);near(part.c[0],x);near(part.yaw,yaw);near(C.partAABB(part)[1],base);near(C.partAABB(part)[4],base+100);refresh(ship,part);near(part.c[1]-50,base);near(part.c[0],x);near(part.yaw,yaw);assert.equal(C.publicJSON(parent),parentBefore);assertStableReload(ship,part);
});

test('surface-mounted height uses its real local up vector without reseating after save or refresh',()=>{
 const {ship,parent,part}=fixture({mode:'surface',tilted:true}),parentBefore=C.publicJSON(parent),base=C.worldStruct(part,[0,-part.s[2]/2,0]),up=plain(C.structFrame(part).up);
 assert.equal(C.resizeStructureHeightAtContact(part,100),true);nearPoint(C.worldStruct(part,[0,-50,0]),base);nearPoint(C.structFrame(part).up,up);const pose=plain(part.c);const result=C.refreshPlacementGeometry(ship);assert.equal(result.ok,true,JSON.stringify(result.failed));nearPoint(part.c,pose);nearPoint(C.worldStruct(part,[0,-50,0]),base);nearPoint(C.structFrame(part).up,up);assert.equal(C.publicJSON(parent),parentBefore);assertStableReload(ship,part);
});

test('a new pending child resized before its first Worker solve keeps the latest height and mounting point',()=>{
 const {ship,parent,part}=fixture({pending:true}),parentBefore=C.publicJSON(parent),anchor=plain(part.placement.surfaceAnchor),base=part.c[1]-part.s[2]/2;
 for(const height of [60,80,100]){assert.equal(C.resizeStructureHeightAtContact(part,height),true);near(part.c[1]-height/2,base);assert.equal(part.placement.pendingGeometry,true);nearPoint(part.placement.surfaceAnchor,anchor);}
 refresh(ship,part);near(part.s[2],100);near(part.c[1]-50,base);nearPoint(C.partAABB(part),[-10,10,-10,10,100,10]);assert.equal(part.placement.pendingGeometry,undefined);assert.equal(C.publicJSON(parent),parentBefore);assertStableReload(ship,part);
});

test('unchanged or invalid height input preserves the accepted cache and source fields',()=>{
 const {ship,part}=fixture(),before=C.publicJSON(part),geometry=part._placementGeometry;assert.equal(C.placementCachedGeometryInputCurrent(part),true);assert.equal(C.placementCachedGeometryCurrent(ship,part),true);
 assert.equal(C.resizeStructureHeightAtContact(part,40),true);assert.equal(part._placementGeometry,geometry);assert.equal(C.publicJSON(part),before);
 for(const value of [0,-1,NaN,Infinity]){assert.equal(C.resizeStructureHeightAtContact(part,value),false);assert.equal(part._placementGeometry,geometry);assert.equal(C.publicJSON(part),before);}
 assert.equal(C.placementCachedGeometryInputCurrent({...part,s:[20,20,60]}),false,'an old fitted solid is invalid for a changed height even if retained by a shallow clone');
});

function legacyEmbedded(){
 const {ship:source,parent:rawParent}=fixture();source.parts=[rawParent,{id:2,k:'struct',form:'box',c:[0,0,0],s:[20,20,40]}];
 // The real editor starts from a deserialized diagram; normalize the legacy
 // source before placing it, retaining its canonical parent fingerprint.
 const ship=C.deserialize(C.serialize(source)),input=ship.parts.pop(),parent=ship.parts[0],result=C.solvePlacement(ship,input,{mode:'horizontal',parentStructureId:parent.id,hit:{p:[0,10,0],n:[0,1,0]}});assert.equal(result.ok,true,result.error);assert.equal(result.part.placement.contactFit,'legacy-fit');const part=result.part;ship.parts.push(part);part.c[1]-=5;refresh(ship,part);near(part.c[1],25);return {ship,parent,part};
}

test('an embedded legacy child keeps its installed base through height changes and cold restoration',()=>{
 const {ship,parent,part}=legacyEmbedded(),parentBefore=C.publicJSON(parent),base=part.c[1]-part.s[2]/2;
 for(const height of [100,60,120]){assert.equal(C.resizeStructureHeightAtContact(part,height),true);const intended=part.c.slice();refresh(ship,part);nearPoint(part.c,intended);near(part.c[1]-height/2,base);near(C.partAABB(part)[1],10);near(C.partAABB(part)[4],base+height);assert.equal(part.placement.contactFit,'legacy-fit');assertStableReload(ship,part);}
 assert.equal(C.publicJSON(parent),parentBefore);
 // Older version-one records omitted the fitting marker; retaining their
 // complete stored request must not opt them into a different placement mode.
 delete part.placement.contactFit;const loaded=C.deserialize(C.serialize(ship)),copy=loaded.parts.find(p=>p.id===part.id);nearPoint(copy.c,part.c);near(C.partVolume(copy),C.partVolume(part),.002);
});

test('new legacy catalogue requests and explicitly changed mounting points keep ordinary alignment',()=>{
 const {ship,part}=legacyEmbedded();C.resizeStructureHeightAtContact(part,100);refresh(ship,part);
 const fresh=C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:[0,0,0],s:[20,20,100]},{mode:'horizontal',parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});assert.equal(fresh.ok,true,fresh.error);nearPoint(fresh.part.c,[0,60,0]);
 const moved=C.solvePlacement(ship,part,{mode:'horizontal',hit:{p:[20,10,0],n:[0,1,0]}});assert.equal(moved.ok,true,moved.error);nearPoint(moved.part.c,[20,60,0]);
 const positioned=C.solvePlacement(ship,part,{mode:'horizontal',position:[0,55,0]});assert.equal(positioned.ok,true,positioned.error);nearPoint(positioned.part.c,[0,60,0]);
});

// 2026-11-12 user decision: a re-solve never re-seats a placed child (no flush legacy-fit re-seat) and children do
// not follow their parent. Raised 5 m, the parent now overlaps the child's base, which is a contact.
// The child's fitted shape is still re-fitted to the moved parent's skin (its base follows the parent's new
// top, 10 -> 15 m): that re-fit on a parent edit is main's existing behaviour (ATTACH-02) and is removed with
// the stored fitted shape in stage B of the no-recompute plan (docs/handoff-2026-11-12.md §4). This test
// checks what this branch changes: the pose (position, yaw, pitch, roll) and size are not touched.
test('a changed legacy parent leaves its child where it is (no re-seat, no follow)',()=>{
 const {ship,parent,part}=legacyEmbedded();C.resizeStructureHeightAtContact(part,100);refresh(ship,part);const before=part.c.slice(),size=part.s.slice(),angles=[part.yaw||0,part.pitch||0,part.roll||0];parent.c[1]+=5;refresh(ship,part);nearPoint(part.c,before);nearPoint(part.s,size);nearPoint([part.yaw||0,part.pitch||0,part.roll||0],angles);assertStableReload(ship,part);
});
