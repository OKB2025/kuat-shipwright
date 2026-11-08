const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const plain=x=>JSON.parse(C.publicJSON(x)),near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} != ${b}`);
function fixture(parent={id:1,k:'struct',form:'box',c:[0,0,0],s:[80,80,20]}){const s=C.newShip({L:500,W:500,H:100,assembly:true},'Placement');s.parts=parent?[parent]:[];s.fits=[];s.nextId=parent?2:1;return s;}
function box(s=[10,10,10]){return {id:-1,k:'struct',form:'box',c:[0,0,0],s};}
function add(s,parentId=1,mode='horizontal',origin=[0,100,0],direction=[0,-1,0],part=box()){
 const parent=s.parts.find(p=>p.id===parentId),hit=C.rayPart(origin,direction,parent),r=C.commitPlacement(s,part,{mode,parentStructureId:parentId,hit});assert.equal(r.ok,true,r.error);return r.part;
}

test('definitions publish capability metadata for late equipment and normal exterior fittings',()=>{
 for(const k of ['struct','cargo','gen','sbeam','hion'])assert.ok(C.PARTS[k].placement,k);
 assert.deepEqual(Array.from(C.placementCapability('struct').allowedModes),['horizontal','vertical','surface']);
 assert.deepEqual(Array.from(C.placementCapability(C.equipmentOptions('isdBridge')).allowedModes),['direct']);
 for(const k of Object.keys(C.FITS)){const cap=C.placementCapability({k,_fit:true});assert.equal(cap.space,'exterior',k);assert.deepEqual(Array.from(cap.allowedModes),['direct'],k);}
});

test('only the first structure can become a root and root diagnostics stay valid with descendants',()=>{
 const s=fixture(null),root=C.commitPlacement(s,box([80,80,20]),{mode:'horizontal'});assert.equal(root.ok,true,root.error);assert.equal(root.part.placement.root,true);
 add(s,root.part.id);assert.equal(C.placementDiagnostics(s).find(p=>p.partId===root.part.id).root,true);
 const second=C.solvePlacement(s,box(),{mode:'horizontal'});assert.equal(second.ok,false);assert.equal(second.code,'parent-required');
});

test('invalid capability combinations are refused by Core and both save paths',()=>{
 const s=fixture();assert.equal(C.solvePlacement(s,box(),{mode:'clip',hostId:1}).code,'placement-mode');
 assert.equal(C.solvePlacement(s,{id:-1,k:'gen',c:[0,0,0],d:2},{mode:'preserve-volume',hostId:1}).code,'placement-mode');
 const child=add(s);child.placement.mode='clip';assert.throws(()=>C.serialize(s),/配置方式/);child.placement.mode='horizontal';
 const saved=C.serialize(s),fitKind=Object.keys(C.FITS)[0];saved.fits=[{id:999,k:fitKind,p:[0,10,0],a:2,scale:1,placement:{modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'horizontal',geometryRevision:0,requestedGeometry:{id:999,k:fitKind,p:[0,10,0],a:2}}}];
 assert.throws(()=>C.deserialize(saved),/配置方式/);s.fits=plain(saved.fits);assert.throws(()=>C.serialize(s),/配置方式/);
});

test('a sloped wedge fits the lower skin while preserving the requested horizontal roof',()=>{
 const s=fixture({id:1,k:'struct',form:'wedge',c:[50,0,0],s:[100,80,20]}),child=add(s,1,'horizontal',[50,100,0],[0,-1,0],box([20,20,10]));
 assert.equal(child.roll,0);assert.equal(child.pitch,0);assert.equal(child.surfaceNormal,undefined);assert.ok(C.placementContact(s,child,s.parts[0]).connected);
 const a=C.rayPart([43,100,0],[0,-1,0],child),b=C.rayPart([57,100,0],[0,-1,0],child);assert.ok(a&&b);near(a.p[1],b.p[1]);near(C.partVolume(child),4000,1e-4);
});

test('vertical fitting honors each chosen local contact side while keeping the ship up direction',()=>{
 for(const contactSide of ['fore','aft','port','stbd']){const s=fixture({...box([80,80,20]),id:1,roll:15}),hit=C.rayPart([0,0,100],[0,0,-1],s.parts[0]);const r=C.solvePlacement(s,box([10,10,20]),{mode:'vertical',contactSide,parentStructureId:1,hit});assert.equal(r.ok,true,`${contactSide}: ${r.error}`);assert.equal(r.part.roll,0);assert.equal(r.part.pitch,0);assert.equal(r.part.placement.contactSide,contactSide);assert.equal(r.contact.connected,true);}
 const s=fixture(),r=C.solvePlacement(s,box(),{mode:'vertical',parentStructureId:1,hit:C.rayPart([0,100,0],[0,-1,0],s.parts[0])});assert.equal(r.code,'contact-side');
});

test('face fitting preserves shape and uses the selected surface normal without dedicated deformation',()=>{
 const s=fixture({...box([80,80,20]),id:1,roll:15}),hit=C.rayPart([0,100,0],[0,-1,0],s.parts[0]),r=C.solvePlacement(s,box([10,10,10]),{mode:'surface',parentStructureId:1,hit});
 assert.equal(r.ok,true,r.error);assert.equal(r.part._placementGeometry,undefined);near(C.partVolume(r.part),1000);near(r.part.surfaceNormal[0],hit.n[0]);near(r.part.surfaceNormal[1],hit.n[1]);
});

test('parent movement, rotation, and resized top update descendants and leave another branch alone',()=>{
 const s=fixture(),child=add(s),grand=add(s,child.id,'horizontal',[0,100,0],[0,-1,0],box([4,4,4]));s.parts.push({...box([20,20,10]),id:s.nextId++,c:[100,0,0]});const separate=add(s,s.parts.at(-1).id,'horizontal',[100,100,0],[0,-1,0],box([4,4,4])),otherKey=C.publicJSON(separate.placement),before=child.c.slice();
 s.parts[0].c[0]+=12;let update=C.updatePlacementChildren(s,1);assert.equal(update.ok,true,JSON.stringify(update));near(child.c[0],before[0]+12);near(grand.c[0],12);assert.equal(C.publicJSON(separate.placement),otherKey);
 s.parts[0].s[2]=30;update=C.updatePlacementChildren(s,1);assert.equal(update.ok,true,JSON.stringify(update));near(child.c[1],20);assert.equal(C.placementContact(s,child,s.parts[0]).connected,true);
 s.parts[0].roll=10;update=C.updatePlacementChildren(s,1);assert.equal(update.ok,true,JSON.stringify(update));assert.equal(child.roll,0);assert.equal(grand.roll,0);assert.equal(C.placementContact(s,child,s.parts[0]).connected,true);
});

test('surface-mode descendants follow a parent rotation through a saved local normal',()=>{
 const s=fixture(),child=add(s,1,'surface');s.parts[0].roll=15;const r=C.updatePlacementChildren(s,1);assert.equal(r.ok,true,JSON.stringify(r));const up=C.worldStruct({...s.parts[0],c:[0,0,0]},[0,1,0]);near(child.surfaceNormal[1],up[1]);near(child.surfaceNormal[2],up[2]);assert.equal(C.placementContact(s,child,s.parts[0]).connected,true);
});

test('a missing saved parent retains repairable children; cycles and lost faces cannot silently reconnect',()=>{
 const s=fixture(),child=add(s),grand=add(s,child.id,'horizontal',[0,100,0],[0,-1,0],box([4,4,4])),original=C.publicJSON(child.placement.requestedGeometry);s.parts=s.parts.filter(p=>p.id!==1);const result=C.updatePlacementChildren(s,1);assert.equal(result.ok,false);assert.equal(s.parts.length,2);assert.equal(C.publicJSON(child.placement.requestedGeometry),original);assert.equal(C.placementDiagnostics(s).find(p=>p.partId===child.id).connected,false);assert.equal(grand._placementError,'parent-unresolved');
 const t=fixture(),q=add(t);t.parts[0].placement={...plain(q.placement),parentStructureId:q.id,root:false};assert.equal(C.solvePlacement(t,q,{mode:'horizontal',parentStructureId:1}).code,'parent-cycle');
 const u=fixture();assert.equal(C.solvePlacement(u,box(),{mode:'horizontal',parentStructureId:1,hostSurfaceId:'p1:missing:0',hit:{p:[0,10,0],n:[0,1,0]}}).code,'surface-missing');
});

test('actual contact refuses a visible gap and point or edge contact, independent of parent IDs',()=>{
 const s=fixture(),child=add(s);child.c[1]+=.01;assert.equal(C.placementDiagnostics(s).find(p=>p.partId===child.id).connected,false);
 for(const c of [[45,15,0],[45,15,45]]){const p={...box([10,10,10]),id:9,c};assert.equal(C.placementContact(s,p,s.parts[0]).connected,false);}
});

test('new root and surface placement reject open or nonfinite solids without changing source',()=>{
 const s=fixture(null),open={...box(),form:'mesh',mesh:{v:[[0,0,0],[1,0,0],[0,1,0]],f:[[0,1,2]]}},r=C.solvePlacement(s,open,{mode:'horizontal'});assert.equal(r.ok,false);assert.ok(['geometry-open','minimum-thickness','geometry-invalid'].includes(r.code));
 const t=fixture(),bad=box();bad.s[0]=NaN;const fail=C.solvePlacement(t,bad,{mode:'surface',parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});assert.equal(fail.ok,false);assert.equal(t.parts.length,1);
});

test('full and partial array copies remap parent IDs and never attach to an omitted external parent',()=>{
 const s=fixture(),child=add(s),r=C.placeLinearCopies(s,{parts:[1,child.id],fits:[]},{count:2,start:[0,0,0],end:[100,0,0],anchor:[0,0,0]});assert.equal(r.ok,true,r.error);const row=r.copies[0],copied=s.parts.filter(p=>row.parts.includes(p.id)),copyChild=copied.find(p=>p.placement?.parentStructureId);assert.ok(copyChild);assert.ok(row.parts.includes(copyChild.placement.parentStructureId));assert.equal(C.placementContact(s,copyChild,s.parts.find(p=>p.id===copyChild.placement.parentStructureId)).connected,true);
 const t=fixture(),q=add(t),partial=C.placeLinearCopies(t,{parts:[q.id],fits:[]},{count:2,start:q.c,end:[100,q.c[1],0]});assert.equal(partial.ok,true,partial.error);const copiedPartial=t.parts.find(p=>p.id===partial.parts[0]);assert.equal(copiedPartial.placement.parentStructureId,undefined);assert.equal(copiedPartial.placement.unresolvedParentId,1);assert.equal(C.placementDiagnostics(t).find(p=>p.partId===copiedPartial.id).connected,false);
});

test('user-part capture and insertion preserve internal relationships through two ID remaps',()=>{
 const s=fixture(),child=add(s),tpl=C.assemblyCapture(s,{parts:[1,child.id],fits:[]},{name:'Parent and child'});assert.equal(tpl.error,undefined,tpl.error);const childTemplate=tpl.template.parts.find(p=>p.placement?.parentStructureId);assert.ok(tpl.template.parts.some(p=>p.id===childTemplate.placement.parentStructureId));const dest=fixture({...box([10,10,10]),id:30,c:[-100,0,0]});dest.nextId=100;const placed=C.assemblyPlace(dest,tpl.template,[100,0,0]);assert.equal(placed.error,undefined,placed.error);const inserted=placed.parts.find(p=>p.placement?.parentStructureId);assert.ok(placed.parts.some(p=>p.id===inserted.placement.parentStructureId));C.refreshPlacementGeometry(dest);assert.equal(C.placementContact(dest,inserted,dest.parts.find(p=>p.id===inserted.placement.parentStructureId)).connected,true);const restored=C.deserialize(C.serialize(dest));assert.equal(restored.parts.find(p=>p.id===inserted.id).placement.parentStructureId,inserted.placement.parentStructureId);
});

test('left-right and upper-lower symmetry map parents, anchors, normal and the contact side',()=>{
 for(const axis of ['tw','vt']){const parent={...box([80,80,20]),id:1,c:[0,0,20]},s=fixture(parent);const child=add(s,1,'horizontal',[0,100,20],[0,-1,0]);const mirroredParent=axis==='tw'?C.mirrorPart(parent,s):C.vmirrorPart(parent,s);mirroredParent.id=s.nextId++;parent[axis]=mirroredParent.id;mirroredParent[axis]=parent.id;s.parts.push(mirroredParent);const q=axis==='tw'?C.mirrorPart(child,s):C.vmirrorPart(child,s);q.id=-1;const r=C.solvePlacement(s,q,{mode:'horizontal',keepTransform:true});assert.equal(r.ok,true,`${axis}: ${r.error}`);assert.equal(r.part.placement.parentStructureId,mirroredParent.id);assert.equal(r.part.placement.contactSide,axis==='tw'?'bottom':'top');assert.equal(r.contact.connected,true);}
});

test('contact calibration covers small and large ships and translated coordinates without widening a real gap',()=>{
 for(const scale of [.01,1,100])for(const offset of [0,50000]){const parent={...box([20*scale,20*scale,20*scale]),id:1,c:[offset,offset,offset]},s=fixture(parent),touch={...box([10*scale,10*scale,10*scale]),id:2,c:[offset,offset+15*scale,offset]},contact=C.placementContact(s,touch,parent);assert.equal(contact.connected,true,`scale ${scale} at ${offset}`);touch.c[1]+=Math.max(.0001,scale*.0001);const gap=C.placementContact(s,touch,parent);assert.equal(gap.connected,false,`gap scale ${scale} at ${offset}: ${JSON.stringify(gap)}`);}
});

test('a failed free edit becomes the saved repair source and later parent motion cannot undo it',()=>{
 const s=fixture(),child=add(s);child.c[0]=90;const moved=Array.from(child.c),r=C.refreshPlacementGeometry(s);assert.equal(r.ok,false);assert.equal(child.placement.repairRequired,true);assert.deepEqual(Array.from(child.placement.requestedGeometry.c),moved);
 s.parts[0].c[0]+=12;C.refreshPlacementGeometry(s);near(child.c[0],moved[0]+12);assert.equal(child.placement.repairRequired,true);
 const restored=C.deserialize(C.serialize(s)),restoredChild=restored.parts.find(p=>p.id===child.id);near(restoredChild.c[0],moved[0]+12);assert.equal(C.placementDiagnostics(restored).find(p=>p.partId===child.id).connected,false);
 const solve=C.solvePlacement(restored,restoredChild,{mode:'horizontal',parentStructureId:1,hit:C.rayPart([12,100,0],[0,-1,0],restored.parts[0])});assert.equal(solve.ok,true,solve.error);const accepted=C.acceptPlacementResult(restored,solve);assert.equal(accepted.ok,true,accepted.error);assert.equal(accepted.part.id,child.id);assert.equal(accepted.part.placement.repairRequired,undefined);assert.equal(accepted.part.placement.parentStructureId,1);
});

test('actual contact diagnostics and grounding agree when the legacy padded boxes would accept a gap',()=>{
 const s=fixture(),child=add(s,1,'surface');child.c[1]+=.2;const S=C.computeStats(s);assert.equal(S.placementDiagnostics.find(p=>p.partId===child.id).connected,false);assert.ok(S.ungrounded.parts.includes(child.id));assert.ok(S.warnings.some(w=>w.code==='ungrounded'));
});

test('normal exterior installation preserves pose, validates finite physical size and rejects machinery clashes',()=>{
 const s=fixture(),sensor={id:-1,k:'sensor',c:[0,10.92,0],d:2,dir:[0,0,1],pitch:12},request={mode:'direct',parentStructureId:1,position:[3,10.92,0],hit:{p:[3,10,0],n:[0,1,0]}},r=C.solvePlacement(s,sensor,request);assert.equal(r.ok,true,r.error);assert.deepEqual(Array.from(r.part.dir),sensor.dir);assert.equal(r.part.pitch,12);assert.deepEqual(Array.from(r.part.c),[3,10.92,0]);
 s.parts.push({id:2,k:'gen',c:[3,10.92,0],d:4});assert.equal(C.solvePlacement(s,sensor,request).code,'placement-interference');assert.equal(C.solvePlacement(s,{...sensor,d:0},request).code,'geometry-dimensions');
});

test('an authored hull fitted as a child shares its effective skin, containment and hull material volume',()=>{
 const s=fixture({...box([80,80,20]),id:1,roll:10}),h={L:10,W:10,H:10,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},input={...box(),form:'hull',hullProfile:h,hullData:{cuts:[],trenches:[],solidCuts:[],subs:[],hatches:[]}},child=add(s,1,'horizontal',[0,100,0],[0,-1,0],input),T=C.structTriangles(child),volume=C.meshVolume(T);
 assert.equal(C.isHullStructure(child),true);assert.ok(child._placementGeometry);near(C.partVolume(child),volume);near(C.hullStructureGeometry(s,child).volume,volume);near(C.computeStats(s).info[child.id].materialVolume,volume);assert.equal(C.inPart(child,[0,child.c[1],0]),true);const restored=C.deserialize(C.serialize(s)),p=restored.parts.find(p=>p.id===child.id);near(C.partVolume(p),C.meshVolume(C.structTriangles(p)));
});

test('changing the saved placement mode invalidates the fitted cache and restores the unchanged surface shape',()=>{
 const s=fixture({...box([80,80,20]),id:1,roll:10}),child=add(s);assert.ok(child._placementGeometry);child.placement.mode='surface';child.placement.contactSide='surface';const r=C.refreshPlacementGeometry(s);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(child._placementGeometry,undefined);assert.ok(child.surfaceNormal);near(C.partVolume(child),1000);assert.equal(child.placement.mode,'surface');
});

test('horizontal wedge fitting keeps volume across ship scales and a translated coordinate origin',()=>{
 for(const scale of [.01,1,100])for(const offset of [0,50000]){const s=fixture({id:1,k:'struct',form:'wedge',c:[offset+50*scale,offset,offset],s:[100*scale,80*scale,20*scale]}),r=C.solvePlacement(s,box([20*scale,20*scale,10*scale]),{mode:'horizontal',parentStructureId:1,hit:{p:[offset+50*scale,offset,offset],n:[.196116135,.980580676,0]}});assert.equal(r.ok,true,`scale ${scale}, offset ${offset}: ${r.error}`);near(C.partVolume(r.part),4000*scale**3,1e-3);assert.equal(r.contact.connected,true);}
});

test('a partial child pasted into an empty design stays repairable instead of being promoted to a root',()=>{
 const s=fixture(),child=add(s),capture=C.assemblyCapture(s,{parts:[child.id],fits:[]},{name:'Detached child'});assert.equal(capture.error,undefined);const dest=fixture(null),placed=C.assemblyPlace(dest,capture.template,[0,0,0]);assert.equal(placed.error,undefined,placed.error);assert.equal(placed.parts[0].placement.parentStructureId,undefined);const result=C.refreshPlacementGeometry(dest);assert.equal(result.ok,false);assert.equal(placed.parts[0].placement.root,undefined);assert.equal(placed.parts[0]._placementError,'parent-required');const loaded=C.deserialize(C.serialize(dest));assert.equal(loaded.parts.length,1);assert.equal(C.placementDiagnostics(loaded)[0].connected,false);
});

test('new exterior engines use the same catalog dimensions and functional settings as conventional creation',()=>{
 const s=fixture(),options=C.equipmentOptions('exposedTurbine'),input={...options,id:-1,c:[0,10+options.d*.46,0]},before=C.publicJSON(s),r=C.solvePlacement(s,input,{mode:'direct',parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});assert.equal(r.ok,true,r.error);assert.equal(C.publicJSON(s),before);const legacy=JSON.parse(C.publicJSON(s)),normal=C.placePart(legacy,input.k,input.c,input.d,options,false);for(const key of ['d','equipmentId','skinAsset','engineLength','nozzleLength','propulsionModelVersion','driveProfileId','ratedInputW','machineryGradeId'])assert.equal(r.part[key],normal[key],key);assert.deepEqual(Array.from(r.part.dir||[-1,0,0]),Array.from(normal.dir||[-1,0,0]));
});

test('a previously verified root cannot commit after another structure has appeared',()=>{
 const s=fixture(null),r=C.solvePlacement(s,box(),{mode:'horizontal'});assert.equal(r.ok,true);s.parts.push({...box(),id:s.nextId++});const committed=C.acceptPlacementResult(s,r);assert.equal(committed.ok,false);assert.equal(committed.code,'parent-required');assert.equal(s.parts.length,1);
});

test('clipboard coordinate scaling remaps local anchors and keeps an unseated copy at its new input position',()=>{
 const s=fixture(),child=add(s,1,'surface'),copies=plain(s.parts),map=new Map([[1,100],[child.id,101]]),scale=p=>p.map(v=>v*2);for(const p of copies){p.id=map.get(p.id);p.c=scale(p.c);}for(const p of copies)C.remapPlacementCopy(p,map,{detachRoots:true,point:scale,sourceParts:s.parts,targetParts:copies});const dest=fixture(null);dest.parts=copies;dest.nextId=102;const q=dest.parts.find(p=>p.id===101),position=q.c.slice();assert.equal(q.placement.parentStructureId,100);const result=C.refreshPlacementGeometry(dest);assert.equal(result.ok,false);assert.deepEqual(Array.from(q.c),position);assert.equal(C.placementDiagnostics(dest).find(p=>p.partId===101).connected,false);assert.equal(q.placement.requestedGeometry.c[1],position[1]);
});

test('a parent vertex edit reprojects the anchor onto the same stable face and refits descendants',()=>{
 const parent={...box([80,80,20]),id:1};parent.mesh=C.structToMesh(parent);parent.form='mesh';const s=fixture(parent),face=C.surfacePatches(s,true).find(p=>p.host==='p1'&&p.normal[1]>.99),hit=C.rayPart([0,100,0],[0,-1,0],parent),result=C.commitPlacement(s,box(),{mode:'horizontal',parentStructureId:1,hostSurfaceId:face.id,hit});assert.equal(result.ok,true,result.error);const child=result.part,before=child.c[1];const selected=parent.mesh.v.map((v,i)=>v[1]>.49&&v[0]>.49?i:-1).filter(i=>i>=0),edited=C.meshMoveVertices(parent,selected,[0,2,0]);assert.equal(edited.error,undefined,edited.error);parent.mesh=edited.mesh;const r=C.refreshPlacementGeometry(s);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(child.placement.hostSurfaceId,face.id);assert.ok(child.c[1]>before+.9);assert.equal(child.roll,0);assert.equal(C.placementContact(s,child,parent).connected,true);
 // Losing the semantic face is a repair state even when another face exists.
 child.placement.hostSurfaceId='p1:removed-face:0';const lost=C.refreshPlacementGeometry(s);assert.equal(lost.ok,false);assert.equal(child._placementError,'surface-missing');assert.equal(child.placement.hostSurfaceId,'p1:removed-face:0');
});

test('surface placement records the tapped structure and exact face point through save and regeneration',()=>{
 const s=fixture();s.parts.push({...box([40,40,20]),id:2,c:[100,0,0]});s.nextId=3;
 const parent=s.parts[1],hit=C.rayPart([108,100,6],[0,-1,0],parent),face=C.surfacePatches(s,true).find(p=>p.host==='p2'&&p.normal[1]>.99),r=C.commitPlacement(s,box(),{mode:'surface',parentStructureId:parent.id,hostSurfaceId:face.id,hit});
 assert.equal(r.ok,true,r.error);assert.equal(r.part.placement.parentStructureId,2);assert.equal(r.part.placement.hostSurfaceId,face.id);
 const check=(ship,part)=>{const p=ship.parts.find(p=>p.id===part.placement.parentStructureId),anchor=C.worldStruct(p,part.placement.surfaceAnchor);for(let i=0;i<3;i++)near(anchor[i],hit.p[i],1e-8);near(part.c[0],hit.p[0]);near(part.c[2],hit.p[2]);assert.equal(part.placement.mode,'surface');assert.equal(C.placementContact(ship,part,p).connected,true);};
 check(s,r.part);const restored=C.deserialize(C.serialize(s)),child=restored.parts.find(p=>p.id===r.part.id);assert.equal(child.placement.parentStructureId,2);assert.equal(child.placement.hostSurfaceId,face.id);check(restored,child);
});
