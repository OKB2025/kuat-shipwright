const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
function fn(name){const start=new RegExp('function '+name+'\\s*\\(').exec(app);assert.ok(start,name);for(let i=app.indexOf('}',start.index);i>=0;i=app.indexOf('}',i+1)){const text=app.slice(start.index,i+1);try{new vm.Script(text);return text;}catch{}}assert.fail('complete '+name);}
function setup(){
 const ctx=vm.createContext({C,console}),run=source=>vm.runInContext(source,ctx);
 run(`const ship={parts:[{id:1,k:'struct',form:'box',c:[0,0,0],s:[30,20,10]},{id:2,k:'cargo',c:[0,0,0],d:1}],fits:[{id:3,k:'pd',p:[0,5,0],n:[0,1,0],a:2}],hatches:[]};
 const fleet={mode:'design'},trial={on:false},designUI={space:'exterior',drawer:false,layout:null,armed:true,info:{old:true}},st={tab:'edit',sel:null,multi:{parts:new Set(),fits:new Set()}};
 let S={warnings:[{lv:'warn',text:'Cargo needs attention',targets:[{list:'parts',id:2}]},{lv:'bad',text:'Structure and cargo need attention',targets:[{list:'parts',id:1},{list:'parts',id:2}]}]};
 const calls=[],notices=[],listeners={},classes=new Set(),bar={hidden:true,innerHTML:'',classList:{toggle(k,on){on?classes.add(k):classes.delete(k);}},addEventListener(name,cb){listeners[name]=cb;}};
 const $=selector=>selector==='#inspBar'?bar:{classList:{remove(){}}},setHTML=(node,html)=>{node.innerHTML=html;},T=x=>x,esc=String,selFind=(list,id)=>ship[list]?.find(p=>p.id===id),selItem=()=>st.sel&&selFind(st.sel.list,st.sel.id);
 const designUIEditCancel=()=>calls.push('edit-cancel'),designUICancel=()=>{calls.push('placement-cancel');designUI.armed=false;},syncHud=()=>calls.push('hud'),renderPanel=()=>calls.push({render:designUI.layout,visible:designUI.drawer}),edFocus=(list,id)=>calls.push({focus:list+':'+id}),refreshOverlay=()=>calls.push('overlay'),toast=text=>notices.push(text);
 function click(dataset){listeners.click({target:{closest(){return {dataset};}}});}
 `);
 for(const name of ['designEntityEditable','designSpaceNotice','openLayoutTarget','renderInspBar','bindInspBar'])run(fn(name));
 run('bindInspBar();renderInspBar();');return {run};
}
test('right-hand inspection links open the visible editor and select only active-space targets',()=>{
 for(const space of ['exterior','interior']){
  const {run:r}=setup();r('designUI.space='+JSON.stringify(space)+';click({ibpick:"0"})');
  assert.equal(r('designUI.drawer'),true);assert.equal(r('designUI.layout'),'edit');assert.equal(r('designUI.info'),null);assert.equal(r('designUI.armed'),false);
  assert.equal(r('st.sel.id'),space==='exterior'?1:2);assert.equal(r('st.multi.parts.size'),1);
  assert.equal(r('calls.some(x=>x.render==="edit"&&x.visible===true)'),true,'the click renders an open editor, not a hidden legacy pane');
 }
});
test('an opposite-space inspection target requests the space switch without starting an edit',()=>{
 const {run:r}=setup();r('click({ibpick:"1"})');
 assert.equal(r('designUI.drawer'),false);assert.equal(r('st.sel'),null);assert.equal(r('notices.length'),1);assert.match(r('notices[0]'),/内装/);
});
test('the original inspection list keeps its toggle and updates summary and actionable rows after new statistics',()=>{
 const {run:r}=setup();assert.match(r('bar.innerHTML'),/aria-expanded="false"/);assert.doesNotMatch(r('bar.innerHTML'),/id="ibList"/);
 r('click({ibtoggle:""})');assert.match(r('bar.innerHTML'),/aria-expanded="true"/);assert.match(r('bar.innerHTML'),/id="ibList"/);assert.equal(r('st.ibRows[0].lv'),'bad');
 r('S={warnings:[{lv:"info",text:"Updated worker information",targets:[{list:"fits",id:3}]}]};renderInspBar();');
 assert.match(r('bar.innerHTML'),/Updated worker information/);assert.match(r('bar.innerHTML'),/エラー 0/);assert.match(r('bar.innerHTML'),/aria-expanded="true"/);
 r('click({ibpick:"0"})');assert.equal(r('st.sel.list'),'fits');assert.equal(r('st.sel.id'),3);assert.equal(r('designUI.drawer'),true);
 r('click({ibtoggle:""})');assert.doesNotMatch(r('bar.innerHTML'),/id="ibList"/);assert.equal(r('classes.has("open")'),false);
});
test('right-hand inspection exposes pending and failed placed parts as repair targets before general statistics exist',()=>{
 const {setup:immediate,resolution}=require('./helpers/immediate-design-ui.cjs'),source=immediate();source.run('ship.nextId=4;tap(1000)');
 const pending=JSON.parse(source.run('C.publicJSON(ship.parts[2])')),packet=resolution(source),failed=packet.rows.find(row=>row.id===pending.id).part;
 const {run:r}=setup();r('S=null;st.inspOpen=true;ship.parts.push('+JSON.stringify(pending)+');renderInspBar()');
 assert.equal(r('st.ibRows.some(row=>row.code==="placement-background")'),true);assert.match(r('bar.innerHTML'),/形状・性能を計算/);
 r('click({ibpick:String(st.ibRows.findIndex(row=>row.code==="placement-background"))})');assert.equal(r('st.sel.id'),4);assert.equal(r('designUI.drawer'),true);
 r('ship.parts[2]='+JSON.stringify(failed)+';renderInspBar()');assert.equal(r('st.ibRows.some(row=>row.code==="placement-background-failed")'),true);assert.match(r('bar.innerHTML'),/エラー 1/);
 r('click({ibpick:String(st.ibRows.findIndex(row=>row.code==="placement-background-failed"))})');assert.equal(r('st.sel.id'),4);assert.equal(r('designUI.layout'),'edit');
});
test('a cold selected authored nozzle without structural dimensions gets a finite pending outline',()=>{
 const data=JSON.parse(fs.readFileSync(path.join(root,'assets/source/imperial-ii-user-layout/imperial-ii-upload.json'),'utf8')),engine=data.parts.find(p=>p.id===55);
 assert.equal(engine.k,'engine');assert.equal(engine.s,undefined);assert.equal(engine.room,undefined);
 const ctx=vm.createContext({C,console,engine}),run=source=>vm.runInContext(source,ctx);
 run(`const ship={parts:[engine],fits:[]},st={tab:'edit',sel:{list:'parts',id:55},multi:{parts:new Set([55]),fits:new Set()}},fleet={mode:'design'},S={ungrounded:{parts:[55],fits:[]}},designUI={drawer:false},live={active:false},hoverLines=null;
 const boxes=[],view={setLines(){}},Gfx={lineSet:()=>({part(){throw Error('Cold nozzle should use the pending box');},box(b){boxes.push(b);},out(){return {pos:new Float32Array(),col:new Uint8Array()};}})};
 const selItem=()=>engine,enginePending=()=>true,requestedPart=p=>p,editorCanMeshPart=()=>false,refreshSolidCutterOverlay=()=>{},refreshVertexOverlay=()=>{},xfPreviewLines=()=>{},tool=()=> 'edit',armMode=()=>false,requestDraw=()=>{};
 `);
 for(const name of ['editorHullBox','refreshOverlay'])run(fn(name));
 run('refreshOverlay()');assert.ok(run('boxes.length')>=2,'both warning and selection outlines are emitted');
 for(const bounds of run('boxes')){assert.equal(bounds.length,6);assert.ok(bounds.every(Number.isFinite));for(let axis=0;axis<3;axis++)assert.ok(bounds[axis+3]>=bounds[axis]);}
 assert.deepEqual(Array.from(run('boxes[0]')),Array.from(C.partAABB(engine)),'the fallback uses the actual nozzle bounds');
});
