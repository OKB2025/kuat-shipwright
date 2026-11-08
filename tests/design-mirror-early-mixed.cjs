const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const text=app.slice(start.index,i+1);try{new vm.Script(text);return text;}catch{}}assert.fail('complete '+name);}
test('a known semantic source can mirror onto a newly accepted real parent whose semantic face is still pending',async()=>{
 const context=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
 const {C,G,E}=vm.runInContext('({C:Core,G:Gfx,E:YardEngine})',context),raw=C.newShip({L:100,W:100,H:80,assembly:true},'Mixed semantic mirror');
 raw.parts=[{id:1,k:'struct',form:'box',c:[30,5,10],s:[20,20,10],tw:5},{id:4,k:'struct',form:'box',c:[30,2,0],s:[80,80,10]}];raw.fits=[];raw.hatches=[];raw.nextId=5;
 for(const part of raw.parts){part._solidCutShip=raw;C.structTriangles(part);}
 const caches=structuredClone(E.packCaches(raw)),ship=JSON.parse(C.publicJSON(raw));ship._client=true;ship._geoProxy=caches.geoProxy;ship._editorGeometryContext='completed-real-scene';for(const part of ship.parts)part._editorGeometryContext=ship._editorGeometryContext;
 const child={id:-1,k:'struct',form:'box',c:[30,8,-10],s:[10,10,4]},request={mode:'horizontal',contactFit:'cut',position:child.c,parentStructureId:4,parentGeometryRevision:0,geometryRevision:1,hit:{p:[30,7,-10],n:[0,1,0],kind:'part'}};
 const result=await new Promise((resolve,reject)=>{const scope={postMessage(msg){if(msg.type==='error')reject(Error(msg.message));if(msg.type==='placement')resolve(structuredClone(msg.result));}};E.listenWorker(scope);scope.onmessage({data:{type:'placement',id:1,gen:1,designId:'mixed-scene',operationId:'accepted-parent',state:C.publicJSON(ship),request:{...request,part:child,partId:-1,placementModelVersion:C.PLACEMENT_MODEL_VERSION}}});});
 assert.equal(result.ok,true,result.error);const accepted=C.acceptPlacementResult(ship,result);assert.equal(accepted.ok,true);accepted.part.tw=1;
 assert.equal(accepted.part.id,5);assert.equal(C.placementCachedGeometryCurrent(ship,accepted.part),true);
 const known=G.structureSurfaceCandidates(ship,[30,20,10],[0,-1,0],1)[0];assert.equal(known.face,'top');assert.equal(typeof known.hostSurfaceId,'string');
 const pending=G.structureSurfaceCandidates(ship,[30,10.1,-10],[0,-1,0],5,{maxDistance:.2})[0];assert.equal(pending.semanticPending,true);assert.equal(pending.hostSurfaceId,undefined);assert.equal(pending.face,undefined,'the raw exact mesh hit has no semantic face descriptor yet');
 const part={id:-1,k:'pd',_fit:true,p:known.p.slice(),n:[0,1,0],a:2,ped:0,base:0,low:0},input={part,list:'fits',entityKind:'fit',mode:'direct',parentStructureId:1,hostId:1,hostSurfaceId:known.hostSurfaceId,hit:{p:known.p.slice(),n:known.n.slice(),face:known.face,kind:known.kind}};
 Object.assign(context,{ship,part,request:input,Gfx:G});vm.runInContext(`const C=Core,st={mirror:true,vmirror:false},designUI={replaceId:null},designParent=id=>ship.parts.find(p=>p.id===id),designCapability=p=>C.placementCapability(p),publicCopy=x=>JSON.parse(C.publicJSON(x)),editorMountShip=()=>ship;`,context);vm.runInContext(fn('designUIRequests'),context);
 const rows=vm.runInContext('designUIRequests(part,request)',context);assert.equal(rows.length,2);assert.equal(rows[1].request.parentStructureId,5);assert.equal(rows[1].request.hostSurfaceId,undefined);
 assert.ok(Math.abs(rows[1].request.hit.p[1]-10)<1e-5);assert.ok(Math.abs(rows[1].request.hit.p[2]+10)<1e-5);
 const fitted=await new Promise((resolve,reject)=>{const scope={postMessage(msg){if(msg.type==='error')reject(Error(msg.message));if(msg.type==='placement')resolve(structuredClone(msg.result));}};E.listenWorker(scope);scope.onmessage({data:{type:'placement',id:2,gen:2,designId:'mixed-scene',operationId:'mirror-fit',state:C.publicJSON(ship),request:{...rows[1].request,geometryRevision:1,placementModelVersion:C.PLACEMENT_MODEL_VERSION}}});});
 assert.equal(fitted.ok,true,fitted.error);assert.match(fitted.fit.placement.hostSurfaceId,/^p5:/,'the Worker binds a real stable face before the fit can be committed');
 assert.equal(C.acceptPlacementResult(ship,fitted).ok,true);
});
