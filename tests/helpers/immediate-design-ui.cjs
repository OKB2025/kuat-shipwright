const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const {C}=require('../../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=value=>JSON.parse(C.publicJSON(value));
function extract(text,name){const match=new RegExp('(?:async )?function '+name+'\\s*\\(').exec(text);assert.ok(match,name);for(let end=text.indexOf('}',match.index);end>=0;end=text.indexOf('}',end+1)){const source=text.slice(match.index,end+1);try{new vm.Script(source);return source;}catch{}}assert.fail('complete '+name);}
const fn=name=>extract(app,name);
function setup({empty=false,core=C,continuous=false}={}){
 const events=[],requests=[],posts=[],nodes=new Map(),diagnostics=[];
 const uiCore={...core};for(const name of ['solvePlacement','solveFitPlacement','refreshPlacementGeometry','computeStats'])uiCore[name]=()=>{throw Error('Immediate authoring must not run '+name+' on the UI thread');};
 const context=vm.createContext({C:uiCore,console,structuredClone,events,requests,posts,nodes,diagnostics});
 const run=source=>vm.runInContext(source,context);
 run(`
 let ship=C.newShip({L:160,W:100,H:100,assembly:true},'Immediate placements');
 ship.parts=${empty?'[]':"[{id:1,k:'struct',form:'box',c:[0,0,0],s:[40,40,10]},{id:2,k:'struct',form:'box',c:[80,0,0],s:[40,40,10]}]"};ship.fits=[];ship.nextId=${empty?1:3};ship.saveId='immediate-source';ship._client=true;
 const st={tab:'mod',part:'struct',partTool:'place',size:[4,4,4],mirror:false,vmirror:false,multi:{parts:new Set(),fits:new Set()},sel:null,view:'normal',surfaceMode:'horizontal'};
 const designUI={space:'exterior',mode:'horizontal',armed:true,continuous:${!!continuous},drawer:false,details:false,parentId:${empty?'null':'1'},sequence:0,pending:null};
 const eng={gen:4,what:new Set(),adoptedGen:3,geoGen:3,statsGen:3,designGen:0,ready:true},fleet={mode:'design'},trial={on:false},undoStack=[],redoStack=[],meshStore={},live={},dirty={},notices=[],previews=[];
 const editorContext={ship:null,gen:-1,revision:-1,key:''};
 let S=null,prevS=null,lastOp='',hoverLines=null,editorPartsRevision=0,dragSnap=null,currentTool='part',rayHits=[],interiorHits=[],templateDraft=null,editSession=null;
 const rayCalls=[],interiorCalls=[];
 const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{disabled:false,dataset:{},hidden:false,innerHTML:'',classList:{remove(){},add(){},toggle(){}},setAttribute(){}});return nodes.get(selector);};
 const tool=()=>currentTool,designPartDefinition=()=>({k:st.part}),designUIFitDraft=hit=>({id:-1,k:'pd',_fit:true,p:hit.p.slice(),n:hit.n.slice(),a:2,ped:0});
 let partPreview=hit=>({...templateDraft?structuredClone(templateDraft):{id:-1,k:st.part,form:'box',s:st.size.slice()},c:hit.p.slice()});
 const publicCopy=value=>JSON.parse(C.publicJSON(value)),editorMountShip=()=>ship;
 const designUIEditSession=()=>editSession,designUIInfoPanel=()=>{},designUIBar=()=>events.push('bar'),designUIMetrics=()=>events.push('metrics'),designUIPanel=()=>events.push('panel'),designUIEditStatus=()=>{},renderInspBar=()=>events.push('inspection'),queuePreview=(list,items)=>events.push({preview:list,ids:items.map(item=>item.id)}),requestDraw=()=>events.push('draw'),renderPanel=()=>events.push('render'),refreshOverlay=()=>events.push('overlay');
 const toast=message=>notices.push(message),esc=String,T=x=>x,sndUI=()=>{},sndEdit=()=>{},syncHullEditor=()=>{},kickEngine=()=>events.push('kick'),engineStatus=()=>{},scheduleStats=()=>{},autosave=()=>events.push('autosave');
 const showPreview=(...args)=>previews.push(args),reconcileSolidCutter=()=>{},hideInspect=()=>{},updateName=()=>{},previewHistory=()=>{},syncHud=()=>{};
 const view={setPlacementDiagnostics:(source,value)=>diagnostics.push(value),setLines(){},off:[0,0,0]},findSel=sel=>ship[sel.list]?.find(p=>p.id===sel.id),selItem=()=>st.sel?findSel(st.sel):null,carryToPlace=()=>{},selClear=()=>{st.sel=null;};
 const designUIClose=()=>{designUI.drawer=false;},updateHint=()=>{};
 const Gfx={lineSet:()=>({part(){},fit(){},box(){},out(){return {pos:new Float32Array(),col:new Uint8Array()};}}),
  structureSurfaceCandidates:(model,o,d,parentId,options)=>{interiorCalls.push({parentId,options});if(designUI.space==='interior')return interiorHits;return [{p:C.add(o,C.mul(d,.1)),n:C.norm(C.mul(d,-1)),face:d[1]<0?'top':'bottom',parentStructureId:parentId,hostSurfaceId:faceIds.get(parentId)}];},
  placementSurfaceCandidates:(model,o,d,options)=>{rayCalls.push({model,o,d,options});return rayHits;}};
 const envHit=()=>{throw Error('An exterior tap cannot retarget an invisible parent');};
 const YardEngineClient={post:msg=>posts.push(msg),request:(type,payload)=>{requests.push({type,payload});throw Error('Immediate placement cannot wait for a dedicated strict request');}};
 function hit(id=1,x=0,z=0){const parent=ship.parts.find(p=>p.id===id);return {parentStructureId:id,part:parent,p:[x,5,z],n:[0,1,0],u:[1,0,0],kind:'part',face:'top',hostSurfaceId:faceIds.get(id)};}
 function tap(x,z=0,id=1){designUIRequest(hit(id,x,z));}
 `);
 const ship=run('ship'),faceIds=new Map();for(const p of ship.parts){const face=core.surfacePatches(ship,true).find(patch=>patch.host==='p'+p.id&&patch.face==='top');if(face)faceIds.set(p.id,face.id);}context.faceIds=faceIds;
 for(const name of ['snap','restore','mutate','undo','redo','updateUndo','touch','engineShipState','editorPublicKey','editorGeometryContext','currentEditorGeometryContext','designCapability','designParents','designParent','designUIRootEligible','designUIRootPlaneHit','designPlacementActive','designExternalPlacementTool','designUIStartTap','designUIInspectMode','designUISavedDesign','designUIDiagnostics','designUIRejectTap','designUIInvalidatePending','designUICancel','designUIArm','designUIRequest','designUIRequests','designUIFinishPlacement','designUIPlaceDraft','onEnginePlacementResolution','pickRay'])run(fn(name));
 return {run,context,C:core,events,requests,posts,diagnostics,faceIds};
}
function resolution(t){
 const state=C.publicJSON(t.run('ship')),source=JSON.parse(state),worker=JSON.parse(state),resolved=C.refreshPlacementGeometry(worker),messages=[];
 const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),ctx=vm.createContext({C,ship:worker,post:msg=>messages.push(structuredClone(msg)),job:{state,gen:t.run('eng.gen'),designId:source.saveId},resolved});
 for(const name of ['placementEffectiveGeometry','placementResolution'])vm.runInContext(extract(engine,name),ctx);
 vm.runInContext('placementResolution(job,resolved)',ctx);
 assert.equal(messages.length,1,'the actual engine emitter publishes the resolved pending entities');
 return messages[0];
}
module.exports={setup,C,fn,plain,resolution};
