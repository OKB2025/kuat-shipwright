const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=x=>JSON.parse(JSON.stringify(x));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function input(html,id,type='number'){
 const tags=html.match(/<input\b[^>]*>/g)||[],tag=tags.find(t=>t.includes(`data-sl="${id}"`)&&t.includes(`type="${type}"`));
 assert.ok(tag,`${id} ${type} control`);return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
}
function setup(){const context=vm.createContext({console,C});vm.runInContext(`
 const isAeroKind=k=>C.isAeroPart({k}),I18N=null,ship=C.newShip({L:20,W:12,H:8},'Fractional controls'),st={sel:{list:'parts',id:1},part:'sensor',structSize:[2,1,.064],hullFollow:'keep',size:{},sizeCraft:{}};
 ship.parts=[{id:1,k:'struct',form:'box',c:[5.125,2.375,-.0625],s:[2.35,1.125,.064],taper:0}];ship.nextId=2;
 const num=(n,d=0)=>Number(n).toFixed(d),esc=String,seg=()=>'',partInfoHTML=()=>'',twinOfItem=()=>null,selItem=()=>ship.parts.find(p=>p.id===st.sel.id),editSel=fn=>fn(selItem()),craftDesign=()=>C.isCraft(ship),blockedHullControl=()=>false;
 const precisePartSize=p=>C.isReactor(p)||['engine','hyper','shield','localShield'].includes(p.k),smallPartSize=k=>C.PARTS[k]?.group==='craft'||craftDesign()&&C.craftPart(k),pSize=k=>C.partLimits(ship,k).def,setPSize=(k,v)=>st.size[k]=v,sizeOut=(k,v)=>v+' m';
 const undoStack=[],redoStack=[],listeners={},controls=new Map(),outputs=new Map(),meshStore={pendingSurfaceGeometry:null},panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)};
 let dragSnap=null,dragLabel='',lastOp='';
 const $=selector=>selector==='#panel'?panel:selector.startsWith('#out-')?(outputs.has(selector)||outputs.set(selector,{}),outputs.get(selector)):null;
 const $$=selector=>controls.get(selector.match(/data-sl="([^"]+)"/)?.[1])||[];
 const touch=()=>{},kickEngine=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},refitOnGeometry=()=>{},scaleContents=()=>{};
 const cockpitEquipmentHTML=()=>'',v3PartEditor=()=>'';
 `,context);
 for(const [start,end]of [
 ['const fLen =','const fMass ='],['function slider(','function silhouette('],['const fmtM =','function baseFitEditor('],['function partSizeRange(','function paletteParts('],
 ['function setHullDims(','// Length, beam and depth:'],['function syncHullInputs(','function hullDimsHTML('],['function coordinateControls(','const BODY_ROLES='],
 ['function snap()','function restore('],['function beginDrag(','function undo('],['function partEditor()','function bindRealism('],
 ["  $('#panel').addEventListener('input', e => {if(blockedHullControl", "  $('#panel').addEventListener('change', e => {\n    const t = e.target;"]
 ])vm.runInContext(section(start,end),context);
 vm.runInContext(`function edit(id,value,min=-60000,max=60000){const t={dataset:{sl:id},value:String(value),min:String(min),max:String(max)},sibling={value:null};controls.set(id,[t,sibling]);for(const fn of listeners.input)fn({target:t});for(const fn of listeners.change)fn({target:t});return {sibling:sibling.value,out:outputs.get('#out-'+id)?.textContent};}`,context);
 return code=>vm.runInContext(code,context);
}
test('a measured thin structure retains fractional sizes and coordinates in editable controls',()=>{
 const run=setup(),html=run('basePartEditor()');
 for(const [id,value]of [['ex',5.125],['ey',2.375],['ez',-.0625],['eh',.064]]){
  const number=input(html,id),range=input(html,id,'range');assert.equal(+number.value,value);assert.equal(number.step,'any');assert.equal(+range.step,.01);
 }
 assert.equal(+input(html,'eh').min,.02);assert.match(html,/0\.064 m/);
});
test('fractional edits use the normal undo transaction and survive blueprint serialization',()=>{
 const run=setup();run("edit('eh',.125,.02,20)");assert.equal(run('selItem().s[2]'),.125);assert.equal(run('undoStack.length'),1);assert.equal(run('JSON.parse(undoStack[0]).parts[0].s[2]'),.064);
 run("edit('ex',5.0625,-2,22)");assert.equal(run('selItem().c[0]'),5.0625);assert.equal(run('undoStack.length'),2);
 const loaded=plain(run('C.serialize(C.deserialize(C.serialize(ship))).parts[0]'));assert.equal(loaded.s[2],.125);assert.equal(loaded.c[0],5.0625);
 assert.equal(run('edit("eh","",.02,20).sibling'),null);assert.equal(run('selItem().s[2]'),.125);
});
test('sub-metre generic equipment keeps the same value in its size input and saved design',()=>{
 const run=setup();run("ship.parts=[{id:1,k:'sensor',c:[4,2,0],d:.375}]");const html=run('basePartEditor()'),control=input(html,'ed');
 assert.ok(+control.min<=.375);assert.equal(+control.value,.375);assert.equal(control.step,'any');assert.equal(+input(html,'ed','range').step,.01);
 run("edit('ed',.625,.1,240)");assert.equal(run('C.deserialize(C.serialize(ship)).parts[0].d'),.625);
});
test('typed hull dimensions retain finer values when sibling controls are refreshed',()=>{
 const run=setup(),result=plain(run("edit('L',12.345,1.5,40)"));assert.equal(run('ship.hull.L'),12.345);assert.equal(+result.sibling,12.345);assert.match(result.out,/12\.345 m/);
 run("edit('W',.625,.5,24);edit('H',.375,.3,12)");assert.equal(run('ship.hull.W'),.625);assert.equal(run('ship.hull.H'),.375);
 const loaded=plain(run('C.deserialize(C.serialize(ship)).hull'));assert.equal(loaded.L,12.345);assert.equal(loaded.W,.625);assert.equal(loaded.H,.375);
});
test('coordinate placement preserves the exact signed decimal entries',()=>{
 const run=setup();run('st.newPos=[.125,-.0625,.375]');const html=run('coordinateControls()');
 for(const [axis,value]of [['X','.125'],['Y','-0.0625'],['Z','0.375']]){
  const tag=html.match(new RegExp(`<input[^>]*id="newP${axis}"[^>]*>`))?.[0];assert.ok(tag);assert.match(tag,/step="any"/);assert.equal(Number(tag.match(/value="([^"]*)"/)[1]),Number(value));
 }
});
test('generic cylinder lengths can be edited below one metre',()=>{
 const run=setup();run("ship.parts=[{id:1,k:'hyper',c:[4,2,0],d:.3,length:.45}]");const html=run('partEditor()'),control=input(html,'cylLength');
 assert.equal(+control.min,.1);assert.equal(+control.value,.45);assert.equal(control.step,'any');assert.equal(+input(html,'cylLength','range').step,.01);
});
