const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const source=app.slice(start.index,i+1);try{new vm.Script(source);return source;}catch{}}assert.fail('complete '+name);}
const runtime=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),runtime,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',runtime),blueprint=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/venator.json.gz'))));
function setup({metadataOnly=false}={}){
 const ship=C.deserialize(blueprint,{deferPlacementGeometry:true});ship.saveId='venator-hatch-regression';
 const uiCore={...C};if(metadataOnly)for(const key of ['openingBounds','hullStructureShip','hullStructureGeometry','hullGeo','aviationSurfaceContacts','computeStats'])uiCore[key]=()=>{throw Error('Cold hatch UI must not calculate '+key);};
 const cx=vm.createContext({C:uiCore,G,console,ship,structuredClone}),run=source=>vm.runInContext(source,cx);
 run(`const fleet={mode:'design'},trial={on:false},voy={open:false},eng={gen:1,statsGen:1},designUI={space:'exterior',drawer:false,armed:false,info:null};
 const st={tab:'edit',editTool:'select',sel:null,multi:{parts:new Set(),fits:new Set()}},nodes=new Map(),events=[],undoStack=[],redoStack=[],view=null;
 let S=null,prevS=null,lastOp='';const document={body:{classList:{toggle(){}}}},T=String,esc=String,num=String;
 const $=key=>{if(!nodes.has(key))nodes.set(key,{hidden:true,innerHTML:'',disabled:false});return nodes.get(key);},selN=()=>1,findSel=ref=>ship[ref.list]?.find(p=>p.id===ref.id);
 const selClear=()=>{st.sel=null;},selPick=(list,id)=>{st.sel={list,id};},hideInspect=()=>{},xfReset=()=>{},syncHud=()=>{},refreshOverlay=()=>{},requestDraw=()=>{},renderPanel=()=>{},scheduleStats=()=>{},autosave=()=>{},updateName=()=>{},reconcileSolidCutter=()=>{},newSaveId=()=> 'unexpected-new-id';
 const designUICancel=()=>{designUI.armed=false;},designUIEditSession=()=>null,designUIEditApply=()=>{throw Error('Selecting a hatch cannot open an editing transaction');},designUIPanel=()=>designUIInfoPanel(),designSpaceNotice=()=>events.push('wrong-space');
 const touch=what=>{eng.gen++;events.push({touch:what});},sndEdit=label=>events.push({edit:label}),sndUI=()=>{},toast=message=>events.push({toast:message});
 const designUISpace=space=>{designUI.space=space;designUI.info=null;},openLayoutTarget=target=>{if(!designEntityEditable(target.list,findSel(target)))throw Error('The bay editor must use the interior space');events.push({target,space:designUI.space});designUI.drawer=true;st.sel=target;};
 `);
 for(const name of ['designEntityEditable','editHitItem','designUIHatchesHTML','designUIHatchAction','designUIInfoPanel','designUIInspectTap','snap','mutate','restore','undo','redo','updateUndo'])run(fn(name));
 return {s:ship,run};
}
const selected=r=>r.run('designUIInspectTap({part:ship.parts.find(p=>p.id===363)});');
test('the authentic closed Venator hatch is reachable by tapping its exterior hull without entering edit mode',()=>{
 const r=setup(),before=C.publicJSON(r.s);assert.equal(r.s.hatches.length,5);assert.ok(r.s.hatches.every(h=>h.open===0&&C.aviationHatchActive(r.s,h)));
 selected(r);assert.equal(r.run('designUI.drawer'),false);assert.equal(r.run('designUI.info.id'),363);assert.equal(C.publicJSON(r.s),before,'selection must not force closed doors open');
 const html=r.run('$("#designInfoWindow").innerHTML');assert.match(html,/data-design-hatch-controls/);for(const id of [33,49,56,58,92])assert.match(html,new RegExp('data-design-hatch-id="'+id+'" data-design-hatch-action="open"'));
 assert.match(html,/航空区画を編集/);assert.ok(r.run('designUIHatchesHTML(ship.hatches)').length>0,'controls remain accessible from the hull when every door is fully open');
});
test('opening the owned top hatch is one reversible edit and keeps its bay and other hatches intact',()=>{
 const r=setup();selected(r);const bayBefore=C.publicJSON(r.s.parts.find(p=>p.id===55));
 r.run('designUIHatchAction(56,"open")');assert.equal(r.s.hatches.find(h=>h.id===56).open,1);assert.equal(r.s.parts.find(p=>p.id===363).hullData.hatches.find(h=>h.id===56).open,1);assert.equal(r.run('undoStack.length'),1);assert.equal(r.run('events.filter(e=>e.touch==="hatches").length'),1);
 assert.ok(r.s.hatches.filter(h=>h.id!==56).every(h=>h.open===0));assert.equal(C.publicJSON(r.s.parts.find(p=>p.id===55)),bayBefore);
 r.run('undo()');assert.equal(r.s.hatches.find(h=>h.id===56).open,0);assert.equal(r.s.parts.find(p=>p.id===363).hullData.hatches.find(h=>h.id===56).open,0);
 r.run('redo()');assert.equal(r.s.hatches.find(h=>h.id===56).open,1);assert.equal(r.s.parts.find(p=>p.id===363).hullData.hatches.find(h=>h.id===56).open,1);
 r.run('designUI.info={source:ship,list:"parts",id:363};designUIHatchAction(56,"close")');assert.equal(r.s.hatches.find(h=>h.id===56).open,0);assert.equal(r.run('undoStack.length'),2);
});
test('the actual Venator hatch opens in the renderer and retains its owner and state after save, reload and strict clipping',()=>{
 const r=setup();selected(r);const top=r.s.hatches.find(h=>h.id===56),bounds=Array.from(C.openingBounds(r.s,top)),closed=G.meshHatches({...r.s,hatches:[top]}).open.ni;
 r.run('designUIHatchAction(56,"open")');const opened=G.meshHatches({...r.s,hatches:[top]}).open.ni;assert.ok(closed>opened&&opened>0,'the real roof door is displaced to expose its opening');
 const copy=C.deserialize(C.serialize(r.s),{deferPlacementGeometry:true});C.syncCompartments(copy);const hatch=copy.hatches.find(h=>h.id===56),owner=copy.parts.find(p=>p.id===363);
 assert.equal(hatch.open,1);assert.equal(hatch.hullOwner,363);assert.equal(hatch.hullHatch,56);assert.equal(owner.hullData.hatches.find(h=>h.id===56).open,1);assert.equal(C.aviationHatchActive(copy,hatch),true);assert.deepEqual(Array.from(C.openingBounds(copy,hatch)),bounds);assert.ok(copy.parts.find(p=>p.id===55)._clip,'the regression includes the effective clipped aviation compartment');
 const bay=C.rayTris(C.hullStructureGeometry(copy,owner).tris,[700,200,20],[0,-1,0]);assert.ok(bay&&bay.p[1]<60,'opening the actual hatch reveals the deeper bay instead of the roof');
});
test('the hatch link opens the real aviation bay only after switching to the interior space',()=>{
 const r=setup();selected(r);r.run('designUIHatchAction(56,"edit")');assert.equal(r.run('designUI.space'),'interior');assert.equal(r.run('designUI.drawer'),true);assert.equal(r.run('st.sel.id'),55);assert.equal(r.run('events.some(e=>e.target?.id===55&&e.space==="interior")'),true);assert.equal(r.run('undoStack.length'),0);
});
test('stale, hidden, opposite-space and unrelated hatch controls cannot change a design',()=>{
 for(const update of ['designUI.info.source={}','designUI.info.id=999','designUI.info.id=55','designUI.space="interior"','designUI.drawer=true','designUI.armed=true','fleet.mode="review"','trial.on=true']){
  const r=setup();selected(r);r.run(update);const before=C.publicJSON(r.s);r.run('designUIHatchAction(56,"open")');assert.equal(C.publicJSON(r.s),before,update);assert.equal(r.run('undoStack.length'),0);
 }
 const r=setup();selected(r);const before=C.publicJSON(r.s);for(const id of [999,'invalid',null])r.run('designUIHatchAction('+JSON.stringify(id)+',"open")');r.run('designUIHatchAction(56,"invalid")');assert.equal(C.publicJSON(r.s),before);assert.equal(r.run('undoStack.length'),0);
});
test('the actual document click binding dispatches hatch controls before ordinary part editing',()=>{
 assert.match(fn('bindDesignUI'),/\[data-design-hatch-action\]/);assert.match(fn('bindDesignUI'),/if\(d\.designHatchAction\)\{designUIHatchAction\(d\.designHatchId,d\.designHatchAction\);return;\}/);
});


test('cold exterior hatch information and open requests use metadata without compiling geometry',()=>{
 const r=setup({metadataOnly:true}),owner=r.s.parts.find(p=>p.id===363);
 for(const key of ['_hullShip','_hullGeometry','_hullAviationGeometry'])delete owner[key];
 selected(r);assert.match(r.run('$("#designInfoWindow").innerHTML'),/data-design-hatch-controls/);
 r.run('designUIHatchAction(56,"open")');assert.equal(r.s.hatches.find(h=>h.id===56).open,1);assert.equal(owner.hullData.hatches.find(h=>h.id===56).open,1);
 assert.equal(r.run('undoStack.length'),1);assert.equal(r.run('events.filter(e=>e.touch==="hatches").length'),1,'the actual geometry is requested through the existing background update');
 for(const key of ['_hullShip','_hullGeometry','_hullAviationGeometry'])assert.equal(owner[key],undefined,'metadata access cannot construct '+key);
});
