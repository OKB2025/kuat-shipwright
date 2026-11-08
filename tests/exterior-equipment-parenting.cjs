const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} differs from ${b}`),vector=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
function fixture(){const s=C.newShip({L:100,W:100,H:100,assembly:true},'Exterior parents');s.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[20,20,20]}];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.nextId=2;return s;}
const equipment=(k='sensor')=>({id:-1,k,c:[2,11.84,3],d:4,...(k==='engine'?{dir:[-1,0,0],reactor:999,machineryId:888,ratedInputW:123456,shaftCapacityW:234567,nozzleShare:.6,propulsionModelVersion:1}:{}),...(k==='scanner'?{dir:[1,0,0]}:{})});
const request=(extra={})=>({mode:'direct',parentStructureId:1,hit:{p:[2,10,3],n:[0,1,0]},...extra});
function add(s,k='sensor'){const r=C.commitPlacement(s,equipment(k),request());assert.equal(r.ok,true,r.error);return r.part;}

test('ordinary exterior equipment requires an explicit structure and real surface contact',()=>{
 const s=fixture(),p=equipment();let r=C.solvePlacement(s,p,{mode:'direct'});assert.equal(r.code,'parent-required');r=C.solvePlacement(s,p,request({parentStructureId:77}));assert.equal(r.code,'parent-missing');r=C.solvePlacement(s,{...p,c:[2,100,3]},request());assert.equal(r.ok,false);assert.equal(r.code,'contact-zero');r=C.solvePlacement(s,p,request({hit:{p:[2,30,3],n:[0,1,0]}}));assert.equal(r.ok,false);assert.equal(r.code,'surface-missing');
});

test('all normal exterior kinds keep direct mode and reject the three structure modes',()=>{
 for(const k of ['engine','sensor','scanner','cockpit']){const s=fixture(),p=equipment(k),r=C.solvePlacement(s,p,request());assert.equal(r.ok,true,k+': '+r.error);assert.equal(r.part.placement.mode,'direct');assert.equal(r.part.placement.parentStructureId,1);for(const mode of ['horizontal','vertical','surface'])assert.equal(C.solvePlacement(s,p,request({mode})).code,'placement-mode');}
 for(const k of ['shield','localShield']){assert.equal(C.placementCapability({k}).space,'interior',k+' is now an interior generator');const s=fixture(),p={...equipment(k),c:[0,0,0]};assert.equal(C.solvePlacement(s,p,{mode:'direct',hostId:1}).ok,true);for(const mode of ['horizontal','vertical','surface'])assert.equal(C.solvePlacement(s,p,{mode,hostId:1}).code,'placement-mode');}
});

test('parent translation and rotation carry exterior sensors through a saved rigid pose',()=>{
 const s=fixture(),p=add(s),local=p.placement.parentLocalAnchor.slice();s.parts[0].c=[5,7,-4];let result=C.updatePlacementChildren(s,1);assert.equal(result.ok,true,JSON.stringify(result));vector(p.c,C.worldStruct(s.parts[0],local));
 s.parts[0].roll=38;s.parts[0].pitch=17;s.parts[0].yaw=29;result=C.updatePlacementChildren(s,1);assert.equal(result.ok,true,JSON.stringify(result));vector(p.c,C.worldStruct(s.parts[0],local));vector(C.worldStruct({...p,c:[0,0,0]},[0,1,0]),C.worldStruct({...s.parts[0],c:[0,0,0]},[0,1,0]));assert.equal(C.placementDiagnostics(s).find(q=>q.partId===p.id).connected,true);assert.equal(p.d,4);
});

test('nozzle direction follows the parent without changing its power ratings or ownership',()=>{
 const s=fixture(),p=add(s,'engine'),keys=['d','reactor','machineryId','ratedInputW','shaftCapacityW','nozzleShare','propulsionModelVersion'],saved=Object.fromEntries(keys.map(k=>[k,p[k]]));s.parts[0].yaw=63;s.parts[0].roll=12;const result=C.updatePlacementChildren(s,1);assert.equal(result.ok,true,JSON.stringify(result));vector(p.dir,C.worldStruct({...s.parts[0],c:[0,0,0]},[-1,0,0]));for(const key of keys)assert.equal(p[key],saved[key],key);
});

test('a missing parent preserves exterior hardware and its editable settings for reconnection',()=>{
 const s=fixture(),p=add(s,'scanner'),source=C.publicJSON(p.placement.requestedGeometry);s.parts=s.parts.filter(q=>q.id!==1);const result=C.updatePlacementChildren(s,1);assert.equal(result.ok,false);assert.equal(s.parts.length,1);assert.equal(p.d,4);assert.equal(C.publicJSON(p.placement.requestedGeometry),source);assert.equal(C.placementDiagnostics(s).find(q=>q.partId===p.id).connected,false);
 s.parts.unshift({id:9,k:'struct',form:'box',c:[0,0,0],s:[20,20,20]});const reconnected=C.commitPlacement(s,p,request({parentStructureId:9}),{replaceId:p.id});assert.equal(reconnected.ok,true,reconnected.error);assert.equal(reconnected.part.id,p.id);assert.equal(reconnected.part.placement.parentStructureId,9);
});

test('parent pose, local equipment basis and normal attachment survive save and readback',()=>{
 const s=fixture(),p=add(s);s.parts[0].roll=31;assert.equal(C.updatePlacementChildren(s,1).ok,true);const saved=plain(C.serialize(s)),loaded=C.deserialize(saved),q=loaded.parts.find(q=>q.id===p.id);assert.ok(q.placement.rigidPose);assert.equal(q.placement.parentStructureId,1);vector(q.c,p.c);assert.equal(C.updatePlacementChildren(loaded,1).ok,true);vector(q.c,p.c);assert.equal(C.placementDiagnostics(loaded).find(v=>v.partId===q.id).connected,true);
});

test('partial copying cannot keep an equipment parent from another design',()=>{
 const s=fixture(),p=add(s),copy=JSON.parse(C.publicJSON(p));copy.id=10;C.remapPlacementCopy(copy,new Map([[p.id,10]]));assert.equal(copy.placement.parentStructureId,undefined);assert.equal(copy.placement.unresolvedParentId,1);s.parts=[copy];const result=C.updatePlacementChildren(s,1);assert.equal(result.ok,false);assert.equal(s.parts.length,1);assert.equal(C.placementDiagnostics(s)[0].connected,false);
});

test('a late normal-equipment result cannot commit after its parent changes',()=>{
 const s=fixture(),r=C.solvePlacement(s,equipment(),request());assert.equal(r.ok,true,r.error);s.parts[0].c[0]+=1;const commit=C.acceptPlacementResult(s,r);assert.equal(commit.ok,false);assert.equal(commit.code,'parent-stale');assert.equal(s.parts.length,1);
});

test('a catalogue bridge body keeps its real reference dimensions through ordinary mounting and parent rotation',()=>{
 const s=fixture();s.parts[0].s=[2000,2000,1000];const hit={p:[0,500,0],n:[0,1,0]},source=C.alignStructure({id:-1,...C.equipmentOptions('isdBridge')},hit,'surface'),size=plain(source.s),r=C.commitPlacement(s,source,{mode:'direct',parentStructureId:1,hit});assert.equal(r.ok,true,r.error);const p=r.part;assert.equal(p.equipmentId,'isdBridge');assert.deepEqual(plain(p.s),size);assert.equal(p._placementGeometry,undefined);
 s.parts[0].roll=27;const updated=C.updatePlacementChildren(s,1);assert.equal(updated.ok,true,JSON.stringify(updated));assert.deepEqual(plain(p.s),size);assert.equal(p.placement.mode,'direct');assert.equal(C.placementDiagnostics(s).find(q=>q.partId===p.id).connected,true);
});

test('resizing the parent moves the mounting skin without scaling the equipment or its offset',()=>{
 const s=fixture(),p=add(s);s.parts[0].s[2]=30;const result=C.updatePlacementChildren(s,1);assert.equal(result.ok,true,JSON.stringify(result));near(p.c[1],16.84);assert.equal(p.d,4);near(p.placement.rigidPose.offset[1],1.84);assert.equal(C.placementDiagnostics(s).find(q=>q.partId===p.id).connected,true);
});

test('moving a single equipment along the skin updates its local anchor for later parent movement',()=>{
 const s=fixture(),p=add(s);p.c[0]+=3;let result=C.updatePlacementChildren(s,1);assert.equal(result.ok,true,JSON.stringify(result));near(p.placement.surfaceAnchor[0],5);s.parts[0].c[0]+=7;result=C.updatePlacementChildren(s,1);assert.equal(result.ok,true,JSON.stringify(result));near(p.c[0],12);
});

test('whole-parent copies remap equipment references and retain the copied local pose',()=>{
 const s=fixture(),p=add(s,'scanner'),parent=JSON.parse(C.publicJSON(s.parts[0])),copy=JSON.parse(C.publicJSON(p)),sourceParts=s.parts.slice();parent.id=10;parent.c[0]+=100;copy.id=11;copy.c[0]+=100;C.remapPlacementCopy(copy,new Map([[1,10],[p.id,11]]),{sourceParts,targetParts:[parent,copy],point:q=>[q[0]+100,q[1],q[2]]});s.parts=[parent,copy];assert.equal(copy.placement.parentStructureId,10);const result=C.updatePlacementChildren(s,10);assert.equal(result.ok,true,JSON.stringify(result));near(copy.c[0],102);assert.equal(C.placementDiagnostics(s).find(q=>q.partId===copy.id).connected,true);
});

test('mirrored equipment retains its mirrored rigid basis on cold regeneration',()=>{
 const s=fixture();s.parts[0].c[2]=30;const r=C.commitPlacement(s,{...equipment(),c:[2,10.92,33],yaw:27,skinSize:[4,2,1]},request({hit:{p:[2,10,33],n:[0,1,0]}}));assert.equal(r.ok,true,r.error);const parent=s.parts[0],mirroredParent=C.mirrorPart(parent,s);mirroredParent.id=s.nextId++;parent.tw=mirroredParent.id;mirroredParent.tw=parent.id;s.parts.push(mirroredParent);const mirrored=C.mirrorPart(r.part,s);mirrored.id=s.nextId++;s.parts.push(mirrored);const expected=C.worldStruct({...mirrored,c:[0,0,0]},[1,0,0]),result=C.updatePlacementChildren(s,parent.id);assert.equal(result.ok,true,JSON.stringify(result));vector(C.worldStruct({...mirrored,c:[0,0,0]},[1,0,0]),expected);assert.equal(mirrored.placement.parentStructureId,mirroredParent.id);assert.equal(C.placementDiagnostics(s).find(q=>q.partId===mirrored.id).connected,true);
});
