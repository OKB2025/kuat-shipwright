const assert=require('node:assert/strict'),vm=require('node:vm'),{test}=require('node:test');
const {C,fn,plain}=require('./helpers/immediate-design-ui.cjs');
const local=value=>JSON.parse(JSON.stringify(value));
function duplicateFixture({actual=true}={}){
 const events=[],context=vm.createContext({C,console,structuredClone,events}),run=code=>vm.runInContext(code,context);
 run(`
 const ship=C.newShip({L:200,W:100,H:100,assembly:true},'Information duplicate');
 ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[40,40,10]}];ship.fits=[];ship.hatches=[];ship.groups=[];ship.links=[];ship.nextId=2;
 const solved=C.commitPlacement(ship,{id:-1,k:'struct',form:'box',c:[0,7,0],s:[20,20,6]},{mode:'horizontal',contactFit:'cut',position:[0,7,0],parentStructureId:1,hit:{p:[0,5,0],n:[0,1,0]}});if(!solved.ok)throw Error(solved.error);
 const st={tab:'edit',editTool:'select',sel:{list:'parts',id:1},multi:{parts:new Set([1]),fits:new Set()},xf:{step:10}},designUI={space:'exterior',drawer:false,armed:false,info:{source:ship,list:'parts',id:1}},fleet={mode:'design'},trial={on:false},voy={open:false};
 const history=[],notices=[],nodes=new Map();let S=null;const eng={gen:1,statsGen:0};
 const $=selector=>{if(!nodes.has(selector))nodes.set(selector,{hidden:true,innerHTML:''});return nodes.get(selector);},document={body:{classList:{toggle(){}}}},T=String,esc=String,num=String,selN=()=>1;
 const designUICancel=()=>{events.push('cancel');designUI.armed=false;},xfReset=()=>events.push('reset'),designUIPanel=()=>events.push('panel'),syncHud=()=>events.push('hud'),refreshOverlay=()=>events.push('overlay'),requestDraw=()=>events.push('draw');
 const publicCopy=p=>JSON.parse(C.publicJSON(p)),toast=s=>notices.push(s),fmtM=String,sndUI=()=>{},copyWingLinks=()=>{},seatFit=()=>{throw Error('These copies retain their source hosts');},editorMountShip=()=>ship;
 const xfDrivers=()=>['parts','fits'].flatMap(list=>ship[list].filter(it=>st.multi[list].has(it.id)).map(it=>({list,it,fol:[]})));
 const xfBox=(list,p)=>list==='parts'?C.partAABB(p):C.fitAABB(p),xfUnion=boxes=>[0,1,2].map(a=>Math.min(...boxes.map(b=>b[a]))).concat([0,1,2].map(a=>Math.max(...boxes.map(b=>b[a+3])))),xfCheck=()=>new Map(),xfMessage=()=>'';
 const edGroups=()=>ship.groups,edParent=()=>null,edLeaves=()=>({parts:new Set(),fits:new Set()});
 const mutate=(label,change)=>{history.push(JSON.parse(C.publicJSON(ship)));change();events.push('mutation');return true;};
 `);
 for(const name of ['designEntityEditable','designUIInfoPanel','designUIInfoDuplicate'])run(fn(name));
 if(actual)run(fn('editDuplicate'));else run(`function editDuplicate(){events.push({duplicate:{list:st.sel.list,id:st.sel.id,parts:[...st.multi.parts],fits:[...st.multi.fits]}});}`);
 return{run,context,events};
}

test('information duplication uses the existing descendant copy operation, fresh IDs and one history entry',()=>{
 const {run:r}=duplicateFixture();r('const source=C.publicJSON(ship.parts);designUIInfoDuplicate()');
 assert.equal(r('history.length'),1);assert.equal(r('ship.parts.length'),4);assert.equal(r('ship.nextId'),5);
 assert.deepEqual(plain(r('ship.parts.slice(0,2)')),plain(r('JSON.parse(source)')),'the source graph remains unchanged');
 const copied=plain(r('ship.parts.slice(2)'));assert.deepEqual(copied.map(p=>p.id),[3,4]);assert.equal(copied[1].placement.parentStructureId,3);assert.equal(copied[1].placement.unresolvedParentId,undefined);
 assert.ok(copied[0].c[0]>40,'the existing duplicate offset is used');assert.equal(copied[1].c[0]-copied[0].c[0],0);
 assert.equal(r('designUI.info.source===ship'),true);assert.equal(r('designUI.info.id'),3);assert.deepEqual(plain(r('[...st.multi.parts]')),[3,4]);
 r('const restored=history[0]');assert.equal(r('restored.parts.length'),2,'one Undo snapshot restores the whole graph');
});

test('information duplication retains an existing multi-selection but excludes an unrelated old selection',()=>{
 const {run:r,events}=duplicateFixture({actual:false});
 r('ship.parts.push({id:3,k:"struct",form:"box",c:[100,0,0],s:[4,4,4]});st.multi.parts.add(3);designUIInfoDuplicate()');
 assert.deepEqual(local(events.find(e=>e.duplicate).duplicate),{list:'parts',id:1,parts:[1,3],fits:[]});
 events.length=0;r('st.multi={parts:new Set([3]),fits:new Set()};designUIInfoDuplicate()');
 assert.deepEqual(local(events.find(e=>e.duplicate).duplicate),{list:'parts',id:1,parts:[1],fits:[]});
});

test('stale, missing, unsupported and opposite-space information cannot mutate the design',()=>{
 for(const update of ['designUI.info.source={}','designUI.info.id=99','designUI.info.list="hatches"','ship.parts[0].k="cargo"']){
  const {run:r,events}=duplicateFixture({actual:false});r(update);const before=r('C.publicJSON(ship)');r('designUIInfoDuplicate()');assert.equal(r('C.publicJSON(ship)'),before);assert.deepEqual(events,[],update);
 }
});

test('the information window offers duplication only for equipment editable in the current space',()=>{
 const {run:r}=duplicateFixture();r('designUIInfoPanel()');assert.match(r('$("#designInfoWindow").innerHTML'),/data-design-info-duplicate/);
 r('ship.parts[0].k="cargo";designUIInfoPanel()');assert.doesNotMatch(r('$("#designInfoWindow").innerHTML'),/data-design-info-duplicate/);
 r('designUI.space="interior";designUIInfoPanel()');assert.match(r('$("#designInfoWindow").innerHTML'),/data-design-info-duplicate/);
});

function carouselFixture(){
 const calls=[],context=vm.createContext({calls}),run=source=>vm.runInContext(source,context);
 run(`
 const track={scrollLeft:0,clientWidth:300,scrollWidth:900,scrollBy(options){calls.push({...options});this.scrollLeft=Math.max(0,Math.min(this.scrollWidth-this.clientWidth,this.scrollLeft+options.left));}};
 const previous={dataset:{designCarouselStep:'-1'}},next={dataset:{designCarouselStep:'1'}};
 const box={querySelector:()=>track,querySelectorAll:()=>[previous,next]};previous.closest=next.closest=()=>box;
 const panel={querySelectorAll:()=>[box]},$=()=>panel,T=s=>'translated:'+s,esc=String;
 let reduced=false;function matchMedia(){return {matches:reduced};}
 `);
 for(const name of ['designCarouselHTML','designUISyncCarousels','designUICarouselStep'])run(fn(name));
 return{run,calls};
}

test('carousel markup preserves filter controls in a named track between accessible previous and next buttons',()=>{
 const {run:r}=carouselFixture(),html=r('designCarouselHTML("兵装の種類",\'<button data-filter="laser">Laser</button>\')');
 assert.match(html,/data-design-carousel-step="-1"/);assert.match(html,/data-design-carousel-step="1"/);assert.match(html,/data-design-carousel-track role="group" aria-label="translated:兵装の種類"/);assert.match(html,/aria-label="translated:前の項目"/);assert.match(html,/data-filter="laser"/);
});

test('carousel steps scroll the native track and update edge availability without changing selection or rerendering',()=>{
 const {run:r,calls}=carouselFixture();r('designUISyncCarousels()');assert.equal(r('previous.disabled'),true);assert.equal(r('next.disabled'),false);
 r('designUICarouselStep(next);designUISyncCarousels()');assert.deepEqual(local(calls[0]),{left:240,behavior:'smooth'});assert.equal(r('track.scrollLeft'),240);assert.equal(r('previous.disabled'),false);
 r('designUICarouselStep(next);designUICarouselStep(next);designUISyncCarousels()');assert.equal(r('track.scrollLeft'),600);assert.equal(r('next.disabled'),true);
 r('designUICarouselStep(previous);designUISyncCarousels()');assert.equal(r('track.scrollLeft'),360);assert.equal(r('next.disabled'),false);
});

test('carousel controls handle no overflow, fractional bounce, resizing and reduced motion',()=>{
 const {run:r,calls}=carouselFixture();r('track.scrollWidth=250;designUISyncCarousels()');assert.equal(r('previous.disabled'),true);assert.equal(r('next.disabled'),true);
 r('track.scrollWidth=900;track.scrollLeft=-.5;designUISyncCarousels()');assert.equal(r('previous.disabled'),true);assert.equal(r('next.disabled'),false);
 r('track.scrollLeft=599.5;designUISyncCarousels()');assert.equal(r('next.disabled'),true);
 r('track.clientWidth=200;designUISyncCarousels()');assert.equal(r('next.disabled'),false,'resizing can reveal more items');
 r('reduced=true;designUICarouselStep(previous)');assert.deepEqual(local(calls.at(-1)),{left:-160,behavior:'auto'});
 const count=calls.length;r('designUICarouselStep({dataset:{designCarouselStep:"0"},closest:()=>box});designUICarouselStep(null)');assert.equal(calls.length,count);
});
