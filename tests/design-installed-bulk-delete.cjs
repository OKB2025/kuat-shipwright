const assert=require('node:assert/strict'),{test}=require('node:test');
const {setup,C,fn,plain}=require('./helpers/immediate-design-ui.cjs');
function fixture(){
 const r=setup();r.context.StrictCore=C;r.run(`
 const voy={open:false};let xfCache=null;st.xf={preview:null,d:[0,0,0]};
 Object.assign(designUI,{layout:'list',drawer:true,armed:false,space:'interior'});
 ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[100,100,100]},
  {id:2,k:'cargo',c:[-20,0,0],room:[4,4,4],d:4,tw:3},
  {id:3,k:'cargo',c:[20,0,0],room:[4,4,4],d:4,tw:2},
  {id:4,k:'battery',c:[0,0,0],d:2}];
 ship.fits=[];ship.hatches=[];ship.nextId=10;ship.groups=[{id:8,name:'Mixed group',parts:[2,4],fits:[],groups:[]}];
 ship.links=[{kind:'power',from:'p2',to:'p4'},{kind:'power',from:'p1',to:'p4'}];
 st.sel={list:'parts',id:2};st.multi={parts:new Set([2,4]),fits:new Set()};st.mirror=false;st.vmirror=false;
 function editListHTML(){return '<button data-edpick="parts:4">Keep existing rows</button>';}
 `);
 for(const name of ['designEntityEditable','designUIRemoveTypes','designUIBulkRemoveHTML','designUIRemoveType','designUIReadPanel','editorRemovalIds','editorRemovedIds','editorRemoveParts','edPrune','selN','selFind','multiLinked','selExpand','selSync','xfReset'])r.run(fn(name));
 return r;
}
const key=(list,k,equipment=null)=>encodeURIComponent(JSON.stringify([list,k,equipment]));
function remove(r,list,k,equipment=null){r.run('designUIBulkRemoveHTML()');r.run(`designUIRemoveType(${JSON.stringify(key(list,k,equipment))},designUI.bulkRemoveToken)`);}

test('installed list groups exact definitions and counts hidden mirror copies and mixed manual-group members',()=>{
 const r=fixture();r.run('st.mirror=true;designUIReadPanel()');const types=plain(r.run('designUIRemoveTypes()'));
 assert.equal(types.length,2);const cargo=types.find(type=>type.key===key('parts','cargo'));
 assert.deepEqual(cargo.ids,[2,3]);assert.equal(cargo.count,2);
 const html=r.run('$("#panel").innerHTML');assert.match(html,/data-design-bulk-remove/);assert.match(html,/種類ごとにまとめて削除/);assert.match(html,/data-design-remove-type=/);assert.match(html,/data-design-list-pick="parts:4"/);
 assert.doesNotMatch(html,new RegExp(key('parts','struct').replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'exterior structures are excluded from the interior delete menu');
});

test('one exact-type operation removes both cargo copies, retains unrelated grouped equipment and is one Undo/Redo',()=>{
 const r=fixture(),before=r.run('C.publicJSON(ship)');remove(r,'parts','cargo');
 assert.deepEqual(plain(r.run('ship.parts.map(p=>p.id)')),[1,4]);assert.deepEqual(plain(r.run('ship.groups[0].parts')),[4]);
 assert.deepEqual(plain(r.run('ship.links')),[{kind:'power',from:'p1',to:'p4'}]);assert.equal(r.run('undoStack.length'),1);assert.equal(r.run('eng.gen'),5);
 assert.equal(r.run('st.sel.id'),4,'an unrelated surviving selection remains usable');
 assert.deepEqual(plain(r.run('previews.at(-1)[2]')),{parts:[2,3],fits:[]});
 r.run('undo()');assert.equal(r.run('undoStack.length'),0);assert.equal(r.run('redoStack.length'),1);
 assert.deepEqual(plain(r.run('ship.parts.map(p=>p.id)')),[1,2,3,4]);assert.equal(r.run('ship.parts.find(p=>p.id===2).tw'),3);assert.equal(r.run('ship.parts.find(p=>p.id===3).tw'),2);
 assert.deepEqual(plain(r.run('ship.groups[0].parts')),[2,4]);assert.equal(r.run('ship.links.length'),2);
 assert.equal(r.run('ship.saveId'),'immediate-source');r.run('redo()');assert.deepEqual(plain(r.run('ship.parts.map(p=>p.id)')),[1,4]);assert.equal(r.run('undoStack.length'),1);
 assert.ok(before.includes('Mixed group'));
});

test('separate equipment definitions with the same core kind remain separate delete types',()=>{
 const r=fixture(),definitions=Object.values(C.EQUIPMENT).filter(d=>d.k==='engine').slice(0,2);assert.equal(definitions.length,2);
 for(let i=0;i<definitions.length;i++)r.run(`ship.parts.push({id:${20+i},c:[0,0,0],...C.equipmentOptions(${JSON.stringify(definitions[i].id)})})`);
 r.run('designUI.space="exterior"');const types=plain(r.run('designUIRemoveTypes()')).filter(t=>t.list==='parts'&&t.ids.some(id=>id>=20));
 assert.equal(types.length,2);assert.deepEqual(types.map(t=>t.ids),[[20],[21]]);
 remove(r,'parts','engine',definitions[0].id);assert.equal(r.run('ship.parts.some(p=>p.id===20)'),false);assert.equal(r.run('ship.parts.some(p=>p.id===21)'),true);
});

test('stale ship, space, token, closed or non-list views and malformed types cannot mutate a design',()=>{
 for(const update of ['designUI.bulkRemoveSource={}','designUI.space="exterior"','designUI.bulkRemoveToken++','designUI.drawer=false','designUI.layout="edit"','designUI.armed=true','fleet.mode="review"','trial.on=true','voy.open=true']){
  const r=fixture();r.run('designUIBulkRemoveHTML();const oldToken=designUI.bulkRemoveToken');r.run(update);const before=r.run('C.publicJSON(ship)');
  r.run(`designUIRemoveType(${JSON.stringify(key('parts','cargo'))},oldToken)`);assert.equal(r.run('C.publicJSON(ship)'),before,update);assert.equal(r.run('undoStack.length'),0,update);
 }
 const r=fixture();r.run('designUIBulkRemoveHTML()');for(const bad of ['',null,'parts:cargo','%broken',key('parts','missing'),key('fits','cargo'),key('parts','struct')]){
  const before=r.run('C.publicJSON(ship)');r.run(`designUIRemoveType(${JSON.stringify(bad)},designUI.bulkRemoveToken)`);assert.equal(r.run('C.publicJSON(ship)'),before);assert.equal(r.run('undoStack.length'),0);
 }
 r.run('const oldToken=designUI.bulkRemoveToken;designUIBulkRemoveHTML()');r.run(`designUIRemoveType(${JSON.stringify(key('parts','cargo'))},oldToken)`);assert.equal(r.run('ship.parts.length'),4,'an obsolete list rendering cannot delete newly listed items');
});

test('a structural batch uses existing dependent deletion and excludes every explicitly removed support',()=>{
 const r=fixture();r.run(`
 ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[40,40,20]},{id:2,k:'struct',form:'box',c:[8,0,0],s:[40,40,20]}];ship.fits=[];ship.groups=[];ship.links=[];ship.nextId=3;
 const child=C.commitPlacement(ship,{id:-1,k:'sensor',c:[2,11,0],d:2},{mode:'direct',parentStructureId:1,hit:{p:[2,10,0],n:[0,1,0]}});if(!child.ok)throw Error(child.error);
 const gun=StrictCore.solveFitPlacement(ship,{id:-1,k:'pd',p:[0,0,0],a:2,n:[0,1,0],ped:0},{mode:'direct',hostId:1,hit:{p:[12,10,0],n:[0,1,0]}});if(!gun.ok)throw Error(gun.error);C.acceptFitPlacementResult(ship,gun);
 Object.assign(designUI,{space:'exterior'});st.sel=null;st.multi={parts:new Set(),fits:new Set()};
 `);
 const childId=r.run('child.part.id'),gunId=r.run('ship.fits[0].id');remove(r,'parts','struct');
 assert.equal(r.run('ship.parts.length'),0,'a support also scheduled for deletion is never retained as a reparenting destination');
 // Stage C (user decision 2026-11-13): a weapon whose support is deleted with nothing below stays where it is, floating (a warning).
 assert.equal(r.run('ship.fits.length'),1);assert.equal(r.run('ship.fits[0].host'),1);assert.equal(r.run('undoStack.length'),1);
 assert.deepEqual(plain(r.run('previews.at(-1)[2]')),{parts:[1,2,childId],fits:[]});
 r.run('undo()');assert.equal(r.run(`ship.parts.find(p=>p.id===${childId}).placement.parentStructureId`),1);assert.equal(r.run(`ship.fits.find(f=>f.id===${gunId}).host`),1);
});

test('deleting an aviation compartment type removes its owned hatches and one Undo restores both',()=>{
 const r=fixture();r.run(`ship.parts.push({id:5,k:'hangar',c:[30,0,0],d:10},{id:6,k:'hangar',c:[-30,0,0],d:10});ship.hatches=[{id:7,bay:5,face:'top',portal:true,open:0},{id:9,bay:6,face:'bottom',portal:true,open:1}];st.sel=null;st.multi={parts:new Set(),fits:new Set()};`);
 remove(r,'parts','hangar');assert.equal(r.run('ship.parts.filter(p=>p.k==="hangar").length'),0);assert.equal(r.run('ship.hatches.length'),0);assert.equal(r.run('undoStack.length'),1);
 r.run('undo()');assert.deepEqual(plain(r.run('ship.hatches.map(h=>[h.id,h.bay,h.open])')),[[7,5,0],[9,6,1]]);assert.deepEqual(plain(r.run('ship.parts.filter(p=>p.k==="hangar").map(p=>p.id)')),[5,6]);
});

test('compact trench battery deletion updates its source and never resurrects after background reconciliation',()=>{
 const r=fixture();r.run(`
 ship=C.newShip({plan:'rect',sec:'rect',L:8000,W:2000,H:1000,bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'Trench deletion');ship.saveId='immediate-source';ship.parts=[];ship.fits=[];
 const configured=C.configureTrenchArmament(ship,{newTrench:{mode:'split',from:.2,to:.8,level:.5,height:80,depth:100,side:'both',taper:false},counts:[{kind:'pd',count:1000},{kind:'monCal34',count:11}]});if(!configured.ok)throw Error(configured.error);
 ship._client=true;designUI.space='exterior';st.sel=null;st.multi={parts:new Set(),fits:new Set()};
 `);
 const before=plain(r.run('designUIRemoveTypes()')),pd=before.find(t=>t.key===key('fits','pd'));assert.equal(pd.count,1000);assert.equal(pd.ids.length,2);
 remove(r,'fits','pd');assert.equal(r.run('ship.fits.filter(f=>f.k==="pd").length'),0);assert.equal(r.run('ship.fits.filter(f=>f.k==="monCal34").length'),2);assert.equal(r.run('ship.trenches[0].armament.counts.length'),1);
 r.run('C.syncTrenchArmament(ship)');assert.equal(r.run('ship.fits.filter(f=>f.k==="pd").length'),0);assert.equal(r.run('undoStack.length'),1);r.run('undo()');assert.equal(r.run('ship.fits.filter(f=>f.k==="pd").length'),2);assert.equal(r.run('ship.trenches[0].armament.counts.length'),2);
});

test('list aggregation never computes geometry and a delayed pre-deletion packet cannot restore removed IDs',()=>{
 const r=fixture();r.run('designUIReadPanel();const stale={gen:eng.gen,designId:ship.saveId,rows:[{list:"parts",id:2,part:{id:2,k:"cargo",c:[0,0,0],d:4}}]}');
 remove(r,'parts','cargo');assert.equal(r.run('onEnginePlacementResolution(stale)'),false);assert.equal(r.run('ship.parts.some(p=>p.id===2)'),false);
 assert.match(fn('bindDesignUI'),/\[data-design-remove-type\]/);assert.match(fn('bindDesignUI'),/if\(d\.designRemoveType\)\{designUIRemoveType\(d\.designRemoveType,d\.designRemoveToken\);return;\}/);
});
