const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..');
function runtime(){const context=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});return vm.runInContext('({C:Core,G:Gfx,E:YardEngine})',context);}
function source(C){const ship=C.newShip({L:100,W:100,H:80,assembly:true},'Early exact pick');ship.parts=[{id:1,k:'struct',form:'box',c:[30,5,0],s:[20,20,10]},{id:2,k:'struct',form:'box',c:[30,-20,0],s:[20,20,10]}];ship.fits=[];ship.hatches=[];ship.nextId=3;return ship;}
function clientFromAuthoring({C,E},ship){
 C.hullGeo(ship);C.referenceHullGeometry(ship);for(const part of ship.parts)if(C.isShapePart(part)){part._solidCutShip=ship;C.structTriangles(part);}
 const state=C.publicJSON(ship),packet=structuredClone(E.packCaches(ship,{authoring:true,deferSurfaces:true})),client=JSON.parse(state);client._client=true;client._geoProxy=packet.geoProxy;client._editorGeometryContext='actual-authoring-packet';for(const part of client.parts)part._editorGeometryContext=client._editorGeometryContext;
 assert.ok(Array.isArray(client._geoProxy.placementBodies));assert.equal(client._geoProxy.surfaces,undefined,'this is the early packet, before the all-ship exposure survey');return client;
}
function forbidColdBuilds(C){for(const name of ['surfacePatches','structTriangles','hullGeo','referenceHullGeometry','computeStats','refreshPlacementGeometry'])C[name]=()=>{throw Error('Pointer must not run '+name);};}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,`${a} != ${b}`);

test('actual cloned authoring cache permits nearest real parent picks before semantic faces without any cold geometry work',()=>{
 const r=runtime(),s=clientFromAuthoring(r,source(r.C)),before=r.C.publicJSON(s);forbidColdBuilds(r.C);
 const hits=r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]);assert.equal(hits.length,2);assert.equal(hits[0].parentStructureId,1);near(hits[0].p[1],10);assert.equal(hits[0].host,'p1');assert.equal(hits[0].hostSurfaceId,undefined,'the Worker must resolve the stable semantic face, never a triangle index');assert.deepEqual(Array.from(hits[0].n),[0,1,0]);assert.equal(r.C.publicJSON(s),before);
 assert.equal(r.G.placementSurfaceCandidates(s,[100,100,0],[0,-1,0]).length,0);assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0],{maxDistance:89}).length,0);
 const chosen=r.G.structureSurfaceCandidates(s,[30,100,0],[0,-1,0],2);assert.equal(chosen.length,1);assert.equal(chosen[0].parentStructureId,2,'an explicit parent remains the only ray target');
});

test('stale body input, context, unavailable caches and supplied stale face never expose another parent behind them',()=>{
 const r=runtime(),s=clientFromAuthoring(r,source(r.C));forbidColdBuilds(r.C);
 s.parts[0].c[1]+=3;assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0);s.parts[0].c[1]-=3;
 s.parts[0]._editorGeometryContext='old';assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0);s.parts[0]._editorGeometryContext=s._editorGeometryContext;
 assert.equal(r.G.structureSurfaceCandidates(s,[30,100,0],[0,-1,0],1,{surfaceId:'p1:top:removed'}).length,0);
 const rows=s._geoProxy.placementBodies;delete s._geoProxy.placementBodies;assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0);s._geoProxy.placementBodies=rows;
 s._geoProxy.surfaces=[];assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0,'a completed empty survey is authoritative');
});

test('real analytic equipment and potentially closer cold weapon meshes block picking through to the hull',()=>{
 const r=runtime(),raw=source(r.C);raw.parts.push({id:3,k:'gen',c:[30,15,0],d:4});const s=clientFromAuthoring(r,raw);forbidColdBuilds(r.C);assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0,'the real sphere is in front of the parent');
 s.parts=s.parts.filter(p=>p.id!==3);const fit={id:7,k:'pd',p:[30,10,0],n:[0,1,0],a:2,ped:0,base:0,low:0};s.fits=[fit];assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0,'unknown closer visible weapon geometry is pending, never an AABB hit or an invisible pass-through');
 assert.ok(r.G.rayFit([30,100,0],[0,-1,0],fit));assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0,'the warmed real weapon also occludes the hull');
 let gap=false;for(let x=22;x<=38&&!gap;x+=2)for(let z=-8;z<=8&&!gap;z+=2){if(r.G.rayFit([x,100,z],[0,-1,0],fit))continue;const hits=r.G.placementSurfaceCandidates(s,[x,100,z],[0,-1,0]);if(hits[0]?.parentStructureId===1)gap=true;}assert.equal(gap,true,'once exact geometry is available, an empty part of its broad bounds does not falsely occlude the hull');
});

test('535 nonintersecting cold weapons never build their meshes while a clear exact parent is picked',()=>{
 const r=runtime(),raw=source(r.C);raw.fits=Array.from({length:535},(_,i)=>({id:10+i,k:'utl',p:[2000+i*100,10,0],n:[0,1,0],a:2,ped:0,base:0,low:0}));const s=clientFromAuthoring(r,raw);forbidColdBuilds(r.C);r.C.decodeReference=()=>{throw Error('Pointer cannot decode a cold weapon mesh');};const hits=r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]);assert.equal(hits[0]?.parentStructureId,1);
});

test('actual full Mandator authoring payload exposes its cleared native weapon face before the global survey',()=>{
 const r=runtime(),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/mandator2.json.gz')))),witness=raw.fits.find(f=>f.id===358);assert.equal(raw.parts.length,318);assert.equal(raw.fits.length,535);raw.fits=raw.fits.filter(f=>f.id!==358);const s=clientFromAuthoring(r,r.C.deserialize(raw,{deferPlacementGeometry:true}));forbidColdBuilds(r.C);
 const n=r.C.norm(witness.n),o=r.C.add(witness.p,r.C.mul(n,500)),d=r.C.mul(n,-1),hits=r.G.placementSurfaceCandidates(s,o,d);assert.equal(hits[0]?.parentStructureId,1154,'all318 original parts and534 other fittings remain in the real ray scene');assert.equal(hits[0].hostSurfaceId,undefined);for(let a=0;a<3;a++)near(hits[0].p[a],witness.p[a]);
});

function strictWorkerResult(r,ship,part,request){return new Promise((resolve,reject)=>{const scope={postMessage(message){if(message.type==='error')reject(Error(message.message));if(message.type==='placement')resolve(structuredClone(message.result));}};r.E.listenWorker(scope);scope.onmessage({data:{type:'placement',id:1,gen:1,designId:'accepted-early-scene',operationId:'stamp',state:r.C.publicJSON(ship),request:{...request,part,partId:part.id,placementModelVersion:r.C.PLACEMENT_MODEL_VERSION}}});});}
function completedClient(r,raw){for(const part of raw.parts){part._solidCutShip=raw;r.C.structTriangles(part);}const packet=structuredClone(r.E.packCaches(raw)),client=JSON.parse(r.C.publicJSON(raw));client._client=true;client._geoProxy=packet.geoProxy;client._editorGeometryContext='completed-worker-context';for(const part of client.parts)part._editorGeometryContext=client._editorGeometryContext;assert.ok(Array.isArray(client._geoProxy.surfaces));return client;}

test('a far stale branch never blocks an unchanged parent, while an unknown closer current body cannot be picked through',()=>{
 const r=runtime(),s=clientFromAuthoring(r,source(r.C));forbidColdBuilds(r.C);s.parts[1].c[0]=1000;assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0])[0]?.parentStructureId,1,'changed source far from the ray does not invalidate the untouched branch');s.parts[1].c=[30,30,0];assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0,'a nearer changed part whose mesh is pending hides the parent behind it');
 const model={...s,parts:s.parts.filter(p=>p.id!==2),_placementSource:s,_placementGeometryContext:s._editorGeometryContext};assert.equal(r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0]).length,0,'the original scene still includes an unready part omitted by editorMountShip');
});

test('actual strict Worker acceptance supplies a new parent before an old completed survey catches up, without a second main-thread solve',async()=>{
 const r=runtime(),s=completedClient(r,source(r.C)),part={id:-1,k:'struct',form:'box',c:[30,11.2,0],s:[6,4,4]},request={mode:'horizontal',contactFit:'cut',position:part.c,parentStructureId:1,parentGeometryRevision:0,geometryRevision:1,hit:{p:[30,10,0],n:[0,1,0],kind:'part'}};
 const result=await strictWorkerResult(r,s,part,request);assert.equal(result.ok,true,result.error);assert.ok(result.effectiveGeometry?.placement?.local?.length);const accepted=r.C.acceptPlacementResult(s,result);assert.equal(accepted.ok,true,accepted.error);const child=accepted.part;assert.equal(r.C.placementCachedGeometryCurrent(s,child),true);
 const model={...s,parts:s.parts.filter(p=>p.id!==child.id),_placementSource:s,_placementGeometryContext:s._editorGeometryContext};forbidColdBuilds(r.C);
 let hits=r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0]);assert.equal(hits[0]?.parentStructureId,child.id,'the new actual solid is selected, not the old surveyed parent below it');assert.equal(hits[0].semanticPending,true);assert.equal(hits[0].hostSurfaceId,undefined);near(hits[0].p[1],13.2);
 hits=r.G.placementSurfaceCandidates(model,[37,100,7],[0,-1,0]);assert.equal(hits[0]?.parentStructureId,1,'an unchanged branch remains immediately available for the next stamp');assert.equal(typeof hits[0].hostSurfaceId,'string');
 const revision=child.placement.geometryRevision;child.placement.geometryRevision++;assert.equal(r.C.placementCachedGeometryCurrent(s,child),false,'a request-only change invalidates the accepted cache even with an unchanged physical pose');assert.equal(r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0]).length,0);assert.equal(r.G.placementSurfaceCandidates(model,[37,100,7],[0,-1,0])[0]?.parentStructureId,1);child.placement.geometryRevision=revision;
 model._placementGeometryContext='new global cuts';assert.equal(r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0]).length,0,'old globals cannot validate a cached accepted shape');model._placementGeometryContext=s._editorGeometryContext;
 s.parts.find(p=>p.id===1).c[1]++;assert.equal(r.C.placementCachedGeometryCurrent(s,child),false,'a moved ancestor invalidates the child solid');assert.equal(r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0]).length,0);
});

function pendingParent(r,s){const parent=s.parts.find(part=>part.id===1),part={id:s.nextId++,k:'struct',form:'box',c:[30,11.2,0],s:[6,4,4]},result=r.C.preparePlacementDraft(s,part,{mode:'horizontal',contactFit:'cut',position:part.c,parentStructureId:parent.id,hit:{p:[30,10,0],n:[0,1,0],kind:'part'},geometryRevision:1});assert.equal(result.ok,true,result.error);s.parts.push(result.part);return result.part;}
function renderPending(r,s,part,options={}){return r.G.meshPreview(s,[part],[],{placementDraftPickable:true,incremental:true,requestedPart:p=>({...p,_solidCutShip:undefined,_placementGeometry:undefined,_clip:undefined,_packing:undefined,_apertures:undefined}),...options});}

test('a pending parent is pickable from its actual published main-preview mesh before any Worker resolution, so a child can be placed immediately',()=>{
 const r=runtime(),s=completedClient(r,source(r.C)),parent=pendingParent(r,s),model={...s,parts:s.parts.filter(part=>part.id!==parent.id),_placementSource:s,_placementGeometryContext:s._editorGeometryContext},meshes=renderPending(r,s,parent);assert.ok(meshes.preview.ni>0,'the requested body generated actual main-canvas buffers');
 forbidColdBuilds(r.C);r.C.solvePlacement=()=>{throw Error('Immediate parenting must not run a strict solve');};assert.equal(r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0]).length,0,'unpublished buffers are not a visible parent');assert.equal(r.G.publishPlacementDraftPreview(s,{}),false,'handmade geometry is not a published main-preview result');assert.equal(r.G.publishPlacementDraftPreview(s,meshes),true);
 const hit=r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0])[0];assert.equal(hit?.parentStructureId,parent.id);assert.equal(hit.provisional,true);assert.equal(hit.semanticPending,true);assert.equal(hit.hostSurfaceId,undefined);near(hit.p[1],13.2);
 const child={id:s.nextId++,k:'struct',form:'box',c:r.C.add(hit.p,[0,1.2,0]),s:[2,2,4]},result=r.C.preparePlacementDraft(s,child,{mode:'horizontal',contactFit:'cut',position:child.c,parentStructureId:hit.parentStructureId,hit:{p:hit.p,n:hit.n,kind:hit.kind},geometryRevision:1});assert.equal(result.ok,true,result.error);s.parts.push(result.part);assert.equal(result.part.placement.parentStructureId,parent.id);assert.equal(result.part.placement.pendingGeometry,true);assert.equal(parent.placement.pendingGeometry,true);assert.equal(r.C.placementDraftStatus(s).ready,false,'requested previews do not certify physics or battle profiles');
});

test('changed input, hidden main buffers and miniature-only geometry never serve as provisional parent hits',()=>{
 const r=runtime(),s=completedClient(r,source(r.C)),parent=pendingParent(r,s),meshes=renderPending(r,s,parent);assert.equal(r.G.publishPlacementDraftPreview(s,meshes),true);forbidColdBuilds(r.C);
 parent.c[0]++;assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0,'stale public input invalidates the rendered preview');parent.c[0]--;
 r.G.clearPreviewCache(s);assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0,'clearing the main preview also clears its provisional ray source');
});

test('a catalogue miniature never publishes a pending parent, and publishing an empty main view removes it',()=>{
 const r=runtime(),s=completedClient(r,source(r.C)),parent=pendingParent(r,s),miniature=renderPending(r,s,parent,{placementDraftPickable:false});assert.equal(r.G.publishPlacementDraftPreview(s,miniature),false);assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0);
 const actual=renderPending(r,s,parent);assert.equal(r.G.publishPlacementDraftPreview(s,actual),true);assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0])[0]?.parentStructureId,parent.id);
 const empty=r.G.meshPreview(s,[],[],{placementDraftPickable:true,incremental:true});assert.equal(r.G.publishPlacementDraftPreview(s,empty),true);assert.equal(r.G.placementSurfaceCandidates(s,[30,100,0],[0,-1,0]).length,0);
});

test('the first visible pending root is a real provisional parent even before the first authoring packet',()=>{
 const r=runtime(),s=r.C.newShip({L:100,W:100,H:80,assembly:true}),rootPart={id:1,k:'struct',form:'box',c:[30,5,0],s:[20,20,10]},prepared=r.C.preparePlacementDraft(s,rootPart,{mode:'horizontal',geometryRevision:1});assert.equal(prepared.ok,true,prepared.error);s.parts=[prepared.part];s.nextId=2;s._client=true;
 const model={...s,_placementSource:s,_placementGeometryContext:'initial-current-context'},meshes=renderPending(r,s,prepared.part);assert.ok(meshes.preview.ni>0);assert.equal(r.G.publishPlacementDraftPreview(s,meshes),true);forbidColdBuilds(r.C);
 const hit=r.G.placementSurfaceCandidates(model,[30,100,0],[0,-1,0])[0];assert.equal(hit?.parentStructureId,1);assert.equal(hit.provisional,true);assert.equal(hit.semanticPending,true);near(hit.p[1],10);
});

test('pending nozzle and internal requested previews draw without deriving machinery, power or hatch geometry',()=>{
 const r=runtime(),s=completedClient(r,source(r.C)),engine={id:3,k:'engine',c:[30,12,0],d:3,nozzleLength:2,dir:[-1,0,0],nozzleAppearance:'generic'},preparedEngine=r.C.preparePlacementDraft(s,engine,{mode:'direct',parentStructureId:1,hit:{p:[30,10,0],n:[0,1,0]},geometryRevision:1}),cargo={id:4,k:'cargo',c:[30,5,0],d:4,room:[4,4,4]},preparedCargo=r.C.preparePlacementDraft(s,cargo,{mode:'clip',hostId:1,geometryRevision:1});assert.equal(preparedEngine.ok,true,preparedEngine.error);assert.equal(preparedCargo.ok,true,preparedCargo.error);s.parts.push(preparedEngine.part,preparedCargo.part);
 for(const name of ['engineMachineryPaths','engineVented','reactorFor','inHull','surfacePatches','computeStats'])r.C[name]=()=>{throw Error('Pending preview cannot derive '+name);};
 const requestedPart=p=>({...p,_solidCutShip:undefined,_placementGeometry:undefined,_clip:undefined,_packing:undefined,_apertures:undefined}),meshes=r.G.meshPreview(s,[preparedEngine.part,preparedCargo.part],[],{requestedPart,placementDraftPickable:true,incremental:true});assert.ok(meshes.preview.ni>0);assert.equal(meshes.glow.length,0,'a pending nozzle does not claim validated electrical power or thrust');assert.equal(r.C.placementDraftStatus(s).ready,false);
});
