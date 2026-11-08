const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{test}=require('node:test');
const {setup,fn,resolution}=require('./helpers/immediate-design-ui.cjs');

test('the real designer state and ordinary placement default to one logical operation',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../js/app.js'),'utf8'),line=app.split('\n').find(line=>line.startsWith('const designUI=')),cx=vm.createContext({});assert.ok(line);vm.runInContext(line,cx);assert.equal(vm.runInContext('designUI.continuous',cx),false);
 const t=setup(),r=t.run;r('tap(-8);tap(8)');
 assert.equal(r('ship.parts.length'),3);assert.equal(r('ship.nextId'),4);assert.equal(r('undoStack.length'),1);assert.equal(r('designUI.armed'),false);assert.equal(r('st.tab'),'edit');assert.equal(r('designUIInspectMode()'),true);assert.equal(r('ship.parts[2].placement.pendingGeometry'),true);assert.equal(t.requests.length,0);
});

test('default single placement treats a symmetry batch as one operation before background calculation',()=>{
 const t=setup(),r=t.run;r('st.mirror=true;tap(0,8);tap(12,8)');
 assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),1);assert.equal(r('designUI.armed'),false);assert.equal(r('ship.parts[2].tw'),r('ship.parts[3].id'));assert.equal(r('C.placementDraftStatus(ship).pending.length'),2);assert.equal(t.requests.length,0);
 r('undo()');assert.equal(r('ship.parts.length'),2);r('redo()');assert.equal(r('ship.parts.length'),4);
});

test('a rejected basic input leaves the one-shot tool armed for a corrected position',()=>{
 const t=setup(),r=t.run;r('designUIRequest(null)');assert.equal(r('designUI.armed'),true);assert.equal(r('ship.parts.length'),2);assert.equal(r('undoStack.length'),0);
 r('tap(0)');assert.equal(r('ship.parts.length'),3);assert.equal(r('designUI.armed'),false);assert.equal(r('undoStack.length'),1);
});

test('ending single placement does not cancel a later valid result or add a second history operation',()=>{
 const t=setup(),r=t.run;r('tap(0)');assert.equal(r('designUI.armed'),false);t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);
 assert.equal(r('C.placementDraftStatus(ship).ready'),true);assert.equal(r('ship.parts[2].id'),3);assert.equal(r('undoStack.length'),1);assert.equal(r('eng.gen'),5);assert.equal(r('designUI.armed'),false);
});

test('a failed background result leaves the single placed input repairable without rearming the tool',()=>{
 const t=setup(),r=t.run;r('tap(1000)');t.context.packet=resolution(t);assert.equal(r('onEnginePlacementResolution(packet)'),true);
 assert.equal(r('ship.parts.length'),3);assert.equal(r('ship.parts[2].placement.validationFailed'),true);assert.equal(r('designUI.armed'),false);assert.equal(r('designUIInspectMode()'),true);assert.equal(r('undoStack.length'),1);
});

test('checking the actual new-placement control enables repeated independent taps, and unchecking restores one-shot placement',()=>{
 const t=setup(),r=t.run;r(`
 const handlers=new Map();
 const document={querySelector:s=>$('doc:'+s),addEventListener:(kind,handler)=>handlers.set('document:'+kind,handler)};
 for(const selector of ['#btnTrialQuick','#viewport','#dock','#designInspection','#inspBar','#panel','doc:.main']){const node=$(selector);node.insertAdjacentHTML=()=>{};node.append=()=>{};node.addEventListener=(kind,handler)=>handlers.set(selector+':'+kind,handler);}
 ${fn('bindDesignUI')}
 bindDesignUI();
 const change=handlers.get('#panel:change');change({target:{dataset:{designContinuous:''},checked:true}});
 tap(-8);tap(8);
 `);
 assert.equal(r('designUI.continuous'),true);assert.equal(r('designUI.armed'),true);assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);assert.equal(t.requests.length,0);
 r("change({target:{dataset:{designContinuous:''},checked:false}});tap(12);tap(-12)");
 assert.equal(r('designUI.continuous'),false);assert.equal(r('designUI.armed'),false);assert.equal(r('ship.parts.length'),5);assert.equal(r('undoStack.length'),3);
});

test('saved user-part assemblies obey the same one-shot checkbox after a successful logical placement',()=>{
 for(const continuous of [false,true]){
  const t=setup({continuous}),r=t.run;
  r(`
   currentTool='userpart';st.userPart='test-template';
   const captured=C.assemblyCapture(ship,{parts:[1],fits:[]},{name:'Test assembly',origin:'center',mount:'bottom'});if(captured.error)throw Error(captured.error);
   const template=C.normalizeAssemblyTemplate(JSON.parse(C.publicJSON(captured.template))),userPartFind=()=>template;
   ${fn('withPlacementSeedAnchor')}
   ${fn('placeUserPart')}
   placeUserPart({p:[150,30,0],n:[0,1,0]});
  `);
  assert.equal(r('ship.parts.length'),3);assert.equal(r('undoStack.length'),1);assert.equal(r('designUI.armed'),continuous);assert.equal(r('designUIInspectMode()'),!continuous);assert.equal(t.requests.length,0);
  if(continuous){r('placeUserPart({p:[220,30,0],n:[0,1,0]})');assert.equal(r('ship.parts.length'),4);assert.equal(r('undoStack.length'),2);}
 }
});
