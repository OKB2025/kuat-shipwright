const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=x=>JSON.parse(C.publicJSON(x)),state=x=>C.publicJSON(x),near=(a,b,t=3e-5)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`),vector=(a,b,t=3e-5)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],t));};
function fixture(){const s=C.newShip({L:300,W:200,H:100,assembly:true},'Strict fitting attachment');s.parts=[{id:1,k:'struct',form:'box',c:[100,10,0],s:[200,160,20]}];s.fits=[];s.links=[];s.armor={hull:0,cit:0};s.nextId=2;s.detail=0;return s;}
const tap=[83,20,23];
function input(extra={}){return {id:-1,k:'pd',p:[0,0,0],n:[0,1,0],a:2,ped:.3,assetYaw:17,mountMode:'auto',...extra};}
function request(extra={}){return {mode:'direct',hostId:1,hit:{p:tap.slice(),n:[0,1,0]},geometryRevision:0,parentGeometryRevision:0,...extra};}
function solve(s,extraRequest={},extraFit={}){return C.solveFitPlacement(s,input(extraFit),request(extraRequest));}
function place(s,extraRequest={},extraFit={}){const r=solve(s,extraRequest,extraFit);assert.equal(r.ok,true,r.error);const accepted=C.acceptFitPlacementResult(s,r);assert.equal(accepted.ok,true,accepted.error);return accepted.fit;}
function expectedAnchor(parent,fit){return C.worldStruct(parent,[fit.local[0]*parent.s[0],fit.local[1]*parent.s[2],fit.local[2]*parent.s[1]]);}
function expectedNormal(parent,fit){return C.norm(C.worldStruct({...parent,c:[0,0,0]},[fit.localNormal[0]/parent.s[0],fit.localNormal[1]/parent.s[2],fit.localNormal[2]/parent.s[1]]));}

test('direct fitting solving is nonmutating and commits the exact tap with one canonical host',()=>{
 const s=fixture(),f=input(),r=request(),before=state(s),beforeInput=state(f),result=C.solveFitPlacement(s,f,r);
 assert.equal(result.ok,true,result.error);assert.equal(result.entityKind,'fit');assert.equal(state(s),before);assert.equal(state(f),beforeInput);
 vector(result.fit.p,tap);assert.equal(result.fit.host,1);assert.equal(result.fit.float,false);assert.equal(result.fit.ped,.3);assert.equal(result.fit.assetYaw,17);
 assert.ok(result.fit.local?.every(Number.isFinite));assert.ok(result.fit.localNormal?.every(Number.isFinite));assert.ok(result.fit.localForward?.every(Number.isFinite));
 assert.equal(result.fit.placement.mode,'direct');assert.equal(result.fit.placement.modelVersion,C.PLACEMENT_MODEL_VERSION);
 assert.equal(result.fit.placement.hostId,undefined,'the existing fit.host remains the authoritative parent');assert.equal(result.fit.placement.parentStructureId,undefined);
 const committed=C.acceptFitPlacementResult(s,result);assert.equal(committed.ok,true,committed.error);assert.equal(s.parts.length,1);assert.equal(s.fits.length,1);assert.equal(committed.fit.id,2);assert.equal(s.nextId,3);vector(s.fits[0].p,tap);
});

test('an upper structure never silently replaces the explicitly tapped lower parent',()=>{
 const s=fixture();s.parts.push({id:2,k:'struct',form:'box',c:[83,25,23],s:[50,50,2]});s.nextId=3;const before=state(s),r=solve(s);
 assert.equal(state(s),before);assert.equal(s.fits.length,0);
 if(r.ok){assert.equal(r.fit.host,1);vector(r.fit.p,tap);}else assert.ok(r.error,'an obstructed target may be rejected with a repairable reason');
});

test('fittings reject structure or interior modes atomically through the calculation entry',()=>{
 for(const mode of ['horizontal','vertical','surface','clip','preserve-volume']){const s=fixture(),before=state(s),r=solve(s,{mode});assert.equal(r.ok,false,mode);assert.ok(r.error,mode);assert.equal(state(s),before,mode);}
});

test('invalid fitting modes cannot enter either blueprint save or load paths',()=>{
 const s=fixture(),f=place(s),saved=plain(C.serialize(s));f.placement.mode='clip';assert.throws(()=>C.serialize(s));saved.fits.find(q=>q.id===f.id).placement.mode='horizontal';assert.throws(()=>C.deserialize(saved));
});

test('missing parents and invalid exact surface hits cannot consume an ID or add a fitting',()=>{
 for(const change of [{hostId:999},{hostId:undefined},{hit:{p:[83,21,23],n:[0,1,0]}},{hit:{p:[83,20,23],n:[0,0,0]}},{hit:{p:[NaN,20,23],n:[0,1,0]}}]){
  const s=fixture(),before=state(s),r=solve(s,change);assert.equal(r.ok,false,JSON.stringify(change));assert.ok(r.error);assert.equal(state(s),before);
 }
});

test('the retained equipment interference check refuses a second fitting at the same tap',()=>{
 const s=fixture();place(s);const before=state(s),r=solve(s);assert.equal(r.ok,false);assert.ok(r.error);assert.equal(state(s),before);assert.equal(s.fits.length,1);
});

test('direct fitting keeps a selected sloped normal and existing authored heading',()=>{
 const s=fixture();s.parts[0].roll=15;const hit=C.rayPart([83,100,23],[0,-1,0],s.parts[0]);assert.ok(hit);assert.ok(Math.abs(hit.n[1])<.999);
 const r=solve(s,{hit},{tilt:hit.n.slice(),localMount:true});assert.equal(r.ok,true,r.error);vector(r.fit.p,hit.p);assert.ok(C.dot(C.fitUp(r.fit),hit.n)>.99999);assert.equal(r.fit.assetYaw,17);assert.equal(r.fit.host,1);
});

test('existing wall-only equipment rules still reject a deck mount in direct mode',()=>{
 const entry=Object.entries(C.FITS).find(([,d])=>d.wallOnly&&!d.craft);assert.ok(entry,'the real catalogue supplies a side-mounted fitting');const s=fixture(),before=state(s),r=solve(s,{}, {k:entry[0]});assert.equal(r.ok,false);assert.ok(r.error);assert.equal(state(s),before);
});

test('command pods retain normal wall mounting and cannot use a roof as a valid mount',()=>{
 const s=fixture(),before=state(s),roof=solve(s,{}, {k:'podBridge',assetYaw:undefined,ped:0});assert.equal(roof.ok,false);assert.equal(state(s),before);
 const p=[83,10,80],n=[0,0,1],side=solve(s,{hit:{p,n}},{k:'podBridge',assetYaw:undefined,ped:0,p,n,a:4});assert.equal(side.ok,true,side.error);assert.equal(side.fit.host,1);assert.equal(side.fit.float,false);vector(side.fit.p,p);vector(side.fit.n,n);assert.equal(side.fit.placement.mode,'direct');
});

// Stage C (2026-11-13, user decisions 2026-11-12/13): a fitting has no parent; it keeps its world pose when its host
// moves, turns or is resized, and is judged where it stands. Until stage C these tests checked that it followed.
test('parent translation and full rotation leave the fitting where it is, keeping its pose and saved anchors',()=>{
 const s=fixture(),fit=place(s),parent=s.parts[0],originalLocal=plain(fit.local),originalNormal=plain(fit.localNormal),originalForward=plain(fit.localForward),pose=plain({p:fit.p,n:fit.n,frame:C.fitFrameOf(fit)});
 parent.c=C.add(parent.c,[11,7,-13]);C.refreshFitPlacementAttachments(s);const moved=s.fits.find(f=>f.id===fit.id);vector(moved.p,tap);assert.equal(moved.host,1);assert.equal(moved.float,true,'the raised host left it floating');
 Object.assign(parent,{yaw:31,pitch:19,roll:-12});C.refreshFitPlacementAttachments(s);const rotated=s.fits.find(f=>f.id===fit.id);assert.deepEqual(plain({p:rotated.p,n:rotated.n,frame:C.fitFrameOf(rotated)}),pose);vector(rotated.local,originalLocal);vector(rotated.localNormal,originalNormal);vector(rotated.localForward,originalForward);assert.equal(rotated.assetYaw,17);
 Object.assign(parent,{c:[100,10,0],yaw:0,pitch:0,roll:0});C.refreshFitPlacementAttachments(s);assert.equal(rotated.float,false,'put back, the host supports it again');
});

test('fit host, semantic surface, transform and placement mode survive saving and loading',()=>{
 const s=fixture(),surface=C.surfacePatches(s,true).find(p=>p.host==='p1'&&p.normal[1]>.99);assert.ok(surface);const f=place(s,{hostSurfaceId:surface.id}),saved=C.serialize(s),stored=saved.fits.find(q=>q.id===f.id);
 assert.equal(stored.host,1);assert.equal(stored.placement.hostSurfaceId,surface.id);assert.equal(stored.placement.mode,'direct');assert.equal(stored.placement.hostId,undefined);assert.equal(stored.placement.parentStructureId,undefined);
 const copy=C.deserialize(plain(saved)),loaded=copy.fits.find(q=>q.id===f.id);assert.ok(loaded);assert.equal(loaded.host,1);assert.equal(loaded.placement.hostSurfaceId,surface.id);assert.equal(loaded.placement.mode,'direct');assert.equal(loaded.assetYaw,17);near(loaded.ped,.3);vector(loaded.p,tap);vector(loaded.local,f.local);vector(loaded.localNormal,f.localNormal);vector(loaded.localForward,f.localForward);
});

test('a newly picked missing face is rejected; a stored lost face id is only a hint for a fitting that still touches',()=>{
 const s=fixture(),missing='p1:removed-face:0',before=state(s),r=solve(s,{hostSurfaceId:missing});assert.equal(r.ok,false);assert.ok(r.error);assert.equal(state(s),before);
 // Reviewed spec change (user rule 2026-11-11, docs/design-placement-v1.2.md "削りと接続"): patch ids are
 // positional and a cut elsewhere renumbers them. A stored id that vanished no longer unseats the fitting
 // (before 2026-11-11 it became float with 'surface-missing'); it stays seated on the host's real shape
 // and keeps the reference.
 const f=place(s);f.placement.hostSurfaceId=missing;const anchor=plain(f.local);C.refreshFitPlacementAttachments(s);const kept=s.fits.find(q=>q.id===f.id);assert.equal(kept.float,false);assert.equal(kept._fitPlacementError,undefined);assert.equal(kept.host,1);assert.equal(kept.placement.hostSurfaceId,missing);vector(kept.local,anchor);
});

test('parent loss retains the original fitting for repair and cannot attach it to another structure',()=>{
 const s=fixture(),f=place(s),original={host:f.host,local:plain(f.local),normal:plain(f.localNormal),point:plain(f.p),placement:plain(f.placement)};s.parts=[{id:9,k:'struct',form:'box',c:[100,10,0],s:[200,160,20]}];s.nextId=10;C.refreshFitPlacementAttachments(s);
 const orphan=s.fits.find(q=>q.id===f.id);assert.ok(orphan);assert.equal(orphan.host,original.host);assert.equal(orphan.float,true);vector(orphan.local,original.local);vector(orphan.localNormal,original.normal);vector(orphan.p,original.point);assert.deepEqual(plain(orphan.placement),original.placement);assert.equal(s.fits.length,1);
});

test('late results cannot commit after the selected parent moves or is deleted',()=>{
 for(const edit of [s=>{s.parts[0].c[0]+=10;},s=>{s.parts=[];}]){const s=fixture(),r=solve(s);assert.equal(r.ok,true,r.error);edit(s);const before=state(s),commit=C.acceptFitPlacementResult(s,r);assert.equal(commit.ok,false);assert.ok(commit.error);assert.equal(state(s),before);assert.equal(s.fits.length,0);}
});

test('late edit results cannot restore a deleted fitting or overwrite a newer fitting edit',()=>{
 for(const edit of [(s,id)=>{s.fits=s.fits.filter(f=>f.id!==id);},(s,id)=>{s.fits.find(f=>f.id===id).assetYaw=39;}]){const s=fixture(),f=place(s),r=C.solveFitPlacement(s,f,request({geometryRevision:1}));assert.equal(r.ok,true,r.error);edit(s,f.id);const before=state(s),commit=C.acceptFitPlacementResult(s,r,{replaceId:f.id});assert.equal(commit.ok,false);assert.ok(commit.error);assert.equal(state(s),before);}
});

test('a changed parent geometry generation invalidates requests and late results even at the same coordinates',()=>{
 const s=fixture(),parent=s.parts[0];parent.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'surface',root:true,geometryRevision:4,requestedGeometry:plain(parent)};
 const before=state(s),wrong=solve(s,{parentGeometryRevision:3});assert.equal(wrong.ok,false);assert.equal(state(s),before);
 const r=solve(s,{parentGeometryRevision:4});assert.equal(r.ok,true,r.error);parent.placement.geometryRevision=5;const changed=state(s),commit=C.acceptFitPlacementResult(s,r);assert.equal(commit.ok,false);assert.ok(commit.error);assert.equal(state(s),changed);
});

test('strict attachment refresh preserves unconverted legacy fitting data',()=>{
 const s=fixture(),placed=C.placeFit(s,'pd',tap,[0,1,0],.3,false,{assetYaw:17});assert.ok(placed.fit,placed.err);assert.equal(placed.fit.placement,undefined);const before=state(s.fits);C.refreshFitPlacementAttachments(s);assert.equal(state(s.fits),before);assert.equal(s.fits[0].placement,undefined);
});

test('real model pivots and muzzles stay where they are when the parent moves and turns (stage C), and return with it',()=>{
 const s=fixture(),parent=s.parts[0];parent.roll=12;const hit=C.rayPart([83,100,23],[0,-1,0],parent);assert.ok(hit);
 const f=place(s,{hit},{k:'triple70',mountMode:'top',ped:2,n:[0,1,0]}),joint=C.authoredTurretGeometry(f);assert.ok(joint?.muzzles.length);assert.ok(f.mountSupport?.polys?.length,'the real gun has a foundation fitted to the sloped parent');
 const oldParent=plain(parent),before={yawPivot:plain(joint.yawPivot),elevationPivot:plain(joint.elevationPivot),muzzles:plain(joint.muzzles)},oldBase=f.base,oldSupport=C.turretSupportGeometry(f);assert.ok(oldSupport?.triangles.length);
 parent.c=C.add(parent.c,[23,7,-11]);parent.yaw=29;parent.pitch=-13;parent.roll=21;const point=p=>C.worldStruct(parent,C.localStruct(oldParent,p));
 const pose=plain({p:f.p,n:f.n});C.refreshFitPlacementAttachments(s);assert.deepEqual(plain({p:f.p,n:f.n}),pose);assert.equal(f.float,true);assert.equal(f.assetYaw,17);near(f.ped,2);
 Object.assign(parent,{yaw:0,pitch:0},oldParent);C.refreshFitPlacementAttachments(s);assert.equal(f.float,false);near(f.base,oldBase,.001);const after=C.authoredTurretGeometry(f);
 vector(after.yawPivot,before.yawPivot,.002);vector(after.elevationPivot,before.elevationPivot,.002);after.muzzles.forEach((p,i)=>vector(p,before.muzzles[i],.002));
});

test('alternate fitting support requires positive current footprint contact and never seats across a gap',()=>{
 const s=fixture(),f=place(s),neighbor={id:3,k:'struct',form:'box',c:[tap[0]+10.05,10,tap[2]],s:[20,20,20]};s.parts.push(neighbor);s.nextId=4;
 const pose=plain({p:f.p,n:f.n,tilt:f.tilt,frameForward:f.frameForward,assetYaw:f.assetYaw,ped:f.ped,base:f.base,low:f.low,slope:f.slope,mountSupport:f.mountSupport}),contact=C.placementFitContact(s,f,neighbor);
 assert.equal(contact.connected,true,'a real area at the edge of the existing foot is supported despite the centre being outside the neighbour');assert.ok(contact.area>0);
 neighbor.c[1]-=1;const before=state(f),gap=C.rehostFitPlacement(s,f,neighbor);assert.equal(gap.ok,false);assert.equal(state(f),before,'rejected support does not move or mutate the fitting');
 neighbor.c[1]+=1;const joined=C.rehostFitPlacement(s,f,neighbor);assert.equal(joined.ok,true,joined.error);assert.equal(f.host,3);assert.deepEqual(plain({p:f.p,n:f.n,tilt:f.tilt,frameForward:f.frameForward,assetYaw:f.assetYaw,ped:f.ped,base:f.base,low:f.low,slope:f.slope,mountSupport:f.mountSupport}),pose);
 s.parts=s.parts.filter(p=>p.id!==1);C.refreshFitPlacementAttachments(s);assert.equal(f.float,false);vector(f.p,tap);near(f.ped,.3);assert.equal(f.host,3);
});

test('cross-ship fitting copies remap the nested stable face and keep the copied host through reload and movement',()=>{
 const source=fixture(),face=C.surfacePatches(source).find(p=>p.host==='p1'&&p.normal[1]>.99),original=place(source,{hostSurfaceId:face.id}),target=fixture();target.parts=[];target.fits=[];
 const delta=[300,40,-70],parent=plain(source.parts[0]);parent.id=20;parent.c=C.add(parent.c,delta);target.parts.push(parent);const fit=plain(original);fit.id=21;fit.p=C.add(fit.p,delta);target.nextId=22;
 C.remapFitPlacementCopy(fit,new Map([[1,20]]),{sourceHostId:1,sourceParts:source.parts,targetParts:target.parts});target.fits.push(fit);
 assert.equal(fit.host,20);assert.match(fit.placement.hostSurfaceId,/^p20:/);assert.equal(fit.placement.hostId,undefined);assert.equal(fit.placement.parentStructureId,undefined);
 C.refreshFitPlacementAttachments(target);assert.equal(fit.float,false);vector(fit.p,C.add(tap,delta));
 const restored=C.deserialize(plain(C.serialize(target))),loaded=restored.fits.find(f=>f.id===21),copyParent=restored.parts.find(p=>p.id===20);C.refreshFitPlacementAttachments(restored);assert.equal(loaded.float,false);assert.equal(loaded.host,20);assert.match(loaded.placement.hostSurfaceId,/^p20:/);
 // Stage C: moving the copied host does not carry the fitting.
 copyParent.c=C.add(copyParent.c,[7,5,-3]);C.refreshFitPlacementAttachments(restored);assert.equal(loaded.float,true);vector(loaded.p,C.add(tap,delta));assert.equal(loaded.assetYaw,17);near(loaded.ped,.3);
});

test('default subtree templates include descendants and remap their hosted fitting and semantic face into an empty ship',()=>{
 const s=fixture(),add=(parentId,p,size)=>{const r=C.commitPlacement(s,{id:-1,k:'struct',form:'box',c:[0,0,0],s:size},{mode:'horizontal',parentStructureId:parentId,hit:{p,n:[0,1,0]}});assert.equal(r.ok,true,r.error);return r.part;},child=add(1,[80,20,20],[40,40,10]),grand=add(child.id,[80,30,20],[20,20,10]),face=C.surfacePatches(s).find(p=>p.host==='p'+grand.id&&p.normal[1]>.99),weapon=place(s,{hostId:grand.id,hit:{p:[80,40,20],n:[0,1,0]},hostSurfaceId:face.id});
 const selected=C.surfaceCopySelection(s,{parts:[1],fits:[]});assert.equal(selected.parts.length,3);assert.equal(selected.fits.length,1);assert.equal(selected.fits[0].id,weapon.id);
 const captured=C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Parent and every descendant'});assert.ok(captured.template,captured.error);const template=C.normalizeAssemblyTemplate(plain(captured.template)),target=fixture();target.parts=[];target.fits=[];target.nextId=50;
 const result=C.assemblyPlace(target,template,[500,80,120],{allowOverlap:true});assert.equal(result.error,undefined);assert.equal(target.parts.length,3);assert.equal(target.fits.length,1);const fit=target.fits[0];assert.ok(target.parts.some(p=>p.id===fit.host));assert.match(fit.placement.hostSurfaceId,new RegExp('^p'+fit.host+':'));assert.equal(new Set([...target.parts,...target.fits].map(p=>p.id)).size,4);
 const restored=C.deserialize(plain(C.serialize(target)));C.refreshPlacementGeometry(restored);const loaded=restored.fits[0];assert.equal(loaded.float,false);assert.match(loaded.placement.hostSurfaceId,new RegExp('^p'+loaded.host+':'));const parent=restored.parts.find(p=>p.id===loaded.host),old=loaded.p.slice();parent.c=C.add(parent.c,[5,0,0]);C.refreshFitPlacementAttachments(restored);assert.equal(loaded.float,false,'still on the moved top');vector(loaded.p,old,1e-9);
});

test('a parent refresh writes nothing in the fitting (stage C): no dependency generation, no pose, no authoring token change',()=>{
 const s=fixture(),f=place(s),key=C.fitPlacementShapeKey(f),ownRevision=f.placement.geometryRevision,parent=s.parts[0],oldParentKey=f.placement.parentGeometryKey,oldParentRevision=f.placement.parentGeometryRevision,record=C.publicJSON(f);parent.c=C.add(parent.c,[10,7,-2]);parent.yaw=18;parent.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'surface',root:true,geometryRevision:3,requestedGeometry:plain(parent)};
 C.refreshFitPlacementAttachments(s);assert.equal(f.float,true);assert.equal(f.placement.parentGeometryRevision,oldParentRevision);assert.equal(f.placement.parentGeometryKey,oldParentKey);assert.equal(f.placement.geometryRevision,ownRevision);assert.equal(C.fitPlacementShapeKey(f),key);
 const after=JSON.parse(C.publicJSON(f)),was=JSON.parse(record);delete after.float;delete was.float;assert.deepEqual(after,was,'only the derived support state changed');
 const saved=plain(C.serialize(s)),restored=C.deserialize(saved),fit=restored.fits[0];assert.equal(fit.placement.parentGeometryRevision,oldParentRevision);vector(fit.p,f.p);
 // Stage C high review M3: the fitting floats now (it did not follow the parent), so the user's new request seats it on
 // the moved parent's real surface; the solve must succeed for the late-result check to mean anything.
 const top=C.rayPart(C.add(f.p,[0,200,0]),[0,-1,0],parent),hit={p:Array.from(top.p),n:Array.from(C.norm(top.n))},r=C.solveFitPlacement(s,f,{mode:'direct',hostId:1,hit,parentGeometryRevision:3,geometryRevision:ownRevision+1});assert.equal(r.ok,true,r.error);f.placement.geometryRevision++;const before=state(s),late=C.acceptFitPlacementResult(s,r);assert.equal(late.ok,false,'a newer intrinsic fitting request still invalidates a late result');assert.equal(state(s),before);
});

test('Core exposed and clipped surface picks round-trip into strict fitting validation across scale and large world coordinates',()=>{
 for(const center of [[100,40,0],[4821.6,452.5167,290.2]])for(const scale of [1,.025])for(const rotation of [{yaw:0,pitch:0,roll:0},{yaw:31,pitch:17,roll:23}]){
  const s=fixture(),host={id:1,k:'struct',form:'box',c:center.slice(),s:[100,40,60].map(v=>v*scale),...rotation},cover={id:2,k:'struct',form:'box',c:C.worldStruct(host,[38.5*scale,0,-25*scale]),s:[23,20,60].map(v=>v*scale),...rotation};s.parts=[host,cover];s.fits=[];s.nextId=3;
  const patch=C.surfacePatches(s).find(p=>p.host==='p1'&&p.face==='port');assert.ok(patch.exposedArea>0&&patch.exposedArea<patch.area);assert.notEqual(patch.exposedTriangles,patch.triangles,'the fixture exercises the real clipped exposure path');
  const point=C.worldStruct(host,[-20*scale,0,-20*scale]),origin=C.add(point,C.mul(patch.normal,30*scale)),direction=C.mul(patch.normal,-1),picked=C.surfacePick(s,origin,direction);assert.ok(picked);assert.equal(picked.host,'p1');
  const native=C.rayTris(picked.exposedTriangles??picked.triangles,origin,direction);assert.ok(native);
  for(const normal of [picked.normal,native.n]){const before=state(s),result=C.solveFitPlacement(s,{id:-1,k:'pd',p:picked.point.slice(),n:normal.slice(),tilt:normal.slice(),ped:0,mountMode:'auto'},{mode:'direct',hostId:1,hostSurfaceId:picked.id,hit:{p:picked.point.slice(),n:normal.slice()}});assert.equal(result.ok,true,`${JSON.stringify({center,scale,rotation})}: ${result.error}`);vector(result.fit.p,picked.point);assert.equal(result.fit.host,1);assert.equal(state(s),before);}
 }
});
