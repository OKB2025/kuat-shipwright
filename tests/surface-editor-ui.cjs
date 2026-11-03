const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){
 const cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const run=code=>vm.runInContext(code,cx);run(`const C=Core,st={tab:'surface',surfaceIds:[],surfaceDraft:{},surfaceFilter:'all'},fleet={mode:'design'},messages=[],history=[];let ship=C.newShip({L:160,W:80,H:40,plan:'rect',sec:'rect'},'Surface UI'),S=null,draws=0,renders=0,lastSelection=null,form=null;
  ship.parts=[];ship.fits=[];ship.armor={hull:.2,cit:0};
  const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),num=(v,n=0)=>Number(v||0).toFixed(n),fMass=v=>num(v,2)+' t',fW=v=>num(v,2)+' W';
  const $=()=>form,toast=s=>messages.push(s),requestDraw=()=>draws++,renderPanel=()=>renders++,view={setSurfaceSelection:(s,ids)=>lastSelection={ship:s,ids:[...ids]}};
  function mutate(label,fn){const before=JSON.stringify(C.serialize(ship));fn();if(before===JSON.stringify(C.serialize(ship)))return false;history.push(before);return true;}
  function fixture(){st.surfaceIds=[];st.surfaceDraft={};st.surfaceLast=null;st.surfacePage=0;st.surfaceFilter='all';st.surfaceAdd=false;st.surfaceRange=false;ship=C.newShip({L:160,W:80,H:40,plan:'rect',sec:'rect'},'Surface UI');ship.parts=[];ship.fits=[];ship.armor={hull:.2,cit:0};S=null;history.length=0;messages.length=0;form=null;return C.surfacePatches(ship);}
 `);
 const a=app.indexOf('// ---------- surface patch editing ----------'),b=app.indexOf('// ---------- multiple selection, copy and paste ----------',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));return {run,cx};
}
const plain=x=>JSON.parse(JSON.stringify(x));
// A narrow DOM contract for the real section converters. Unlike a raw-HTML
// assertion, moving children through these nodes changes closest()/selectors.
class FoldElement{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.attrs=new Map();this._text='';this.dataset=new Proxy({},{get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,key,value)=>(this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value),true)});}
 get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
 get className(){return this.getAttribute('class')||'';}set className(value){this.setAttribute('class',value);}
 get firstChild(){return this.children[0]||null;}get firstElementChild(){return this.firstChild;}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(v){this._text=String(v);}
 getAttribute(name){return this.attrs.has(name)?this.attrs.get(name):null;}setAttribute(name,value){this.attrs.set(name,String(value));}
 append(node){node.remove();node.parentElement=this;this.children.push(node);}
 remove(){if(this.parentElement){const p=this.parentElement;p.children.splice(p.children.indexOf(this),1);this.parentElement=null;}}
 replaceWith(node){const p=this.parentElement,i=p.children.indexOf(this);node.remove();p.children[i]=node;node.parentElement=p;this.parentElement=null;}
 matches(selector){if(selector.startsWith('.'))return this.className.split(/\s+/).includes(selector.slice(1));const m=/^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(selector);return m?this.attrs.has(m[1])&&(m[2]===undefined||this.getAttribute(m[1])===m[2]):this.tagName===selector.toUpperCase();}
 closest(selector){for(let p=this;p;p=p.parentElement)if(p.matches(selector))return p;return null;}
 querySelectorAll(selector){const out=[];for(const child of this.children){if(child.matches(selector))out.push(child);out.push(...child.querySelectorAll(selector));}return out;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}

test('the real main tab and tool expose surface editing, and the list excludes interior faces',()=>{
 const {run}=setup();run('fixture();ship.parts.push({id:7,k:"command",c:[80,20,0],room:[8,8,8],d:8})');
 const html=run('surfaceEditorHTML()');assert.match(app,/\['surface', '表面'\]/);assert.match(html,/data-surface-editor/);assert.match(html,/data-surface-action="strict"/);assert.match(html,/data-surface-action="compat"/);
 const interior=run('C.surfacePatches(ship).filter(p=>p.host==="p7")');assert.ok(interior.length>0);for(const p of interior){assert.equal(p.exposed,false);assert.ok(!html.includes('data-surface-pick="'+p.id+'"'));}
 for(const p of run('C.surfacePatches(ship).filter(p=>p.exposed)'))assert.ok(html.includes('data-surface-pick="'+p.id+'"'));
 const a=app.indexOf('function tool()'),b=app.indexOf('function curFit()',a);run(app.slice(a,b));assert.equal(run('tool()'),'surface');
});

test('range and additive selection use semantic IDs and do not modify the design',()=>{
 const {run}=setup();run('fixture()');const before=run('JSON.stringify(C.serialize(ship))'),ids=plain(run('surfaceFilteredRows().map(p=>p.id)'));
 assert.ok(ids.length>=4);run(`surfaceSelectPatch(${JSON.stringify(ids[0])});surfaceSelectPatch(${JSON.stringify(ids[3])},false,true)`);
 assert.deepEqual(plain(run('st.surfaceIds')),ids.slice(0,4));run(`surfaceSelectPatch(${JSON.stringify(ids[1])},true,false)`);assert.deepEqual(plain(run('st.surfaceIds')),[ids[0],ids[2],ids[3]]);
 assert.equal(run('surfaceSelectPatch("missing",true,true)'),false);assert.equal(run('JSON.stringify(C.serialize(ship))'),before);assert.equal(run('history.length'),0);assert.deepEqual(plain(run('lastSelection.ids')),plain(run('st.surfaceIds')));
});

test('a multi-face layer edit preserves different armor and stable physical equipment IDs',()=>{
 const {run}=setup();run(`fixture();const ps=surfaceFilteredRows().slice(0,2);C.setSurfaceConfig(ship,[ps[0].id],{armor:{thickness:.3},battery:{weapon:'pd',count:2}});C.setSurfaceConfig(ship,[ps[1].id],{armor:{thickness:.7},equipment:{kind:'hdis',count:1,depth:1}});st.surfaceIds=ps.map(p=>p.id);`);
 const before=plain(run('C.surfaceDerivedFits(ship).map(f=>f.id)'));assert.equal(before.length,2);run("st.surfaceDraft={'style.density':.9};surfaceApplyDraft()");
 assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[0]).armor.thickness'),.3);assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[1]).armor.thickness'),.7);
 assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[0]).style.density'),.9);assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[1]).equipment.count'),1);assert.deepEqual(plain(run('C.surfaceDerivedFits(ship).map(f=>f.id)')),before);assert.equal(run('ship.fits.length'),0);assert.equal(run('history.length'),1);
 const html=run('surfaceEditorHTML()');assert.match(html,/data-surface-field="armor.thickness" value=""/);assert.match(html,/placeholder="複数の値"/);assert.match(html,/data-surface-report/);assert.match(html,/砲座の設置数／要求数/);
});

test('the actual surface form stages typed changes and validates input before applying them',()=>{
 const {run}=setup();run('fixture();st.surfaceIds=[surfaceFilteredRows()[0].id]');const before=run('JSON.stringify(C.serialize(ship))');
 run(`const button={disabled:true},note={textContent:''},peer={dataset:{surfaceField:'armor.thickness'},value:'0.2'},el={dataset:{surfaceField:'armor.thickness'},value:'0.4',closest:()=>({querySelectorAll:()=>[el,peer],querySelector:s=>s.includes('apply')?button:note})};surfaceUpdateDraft(el);`);
 assert.equal(run('JSON.stringify(C.serialize(ship))'),before);assert.equal(run('st.surfaceDraft["armor.thickness"]'),.4);assert.equal(run('peer.value'),'0.4');assert.equal(run('button.disabled'),false);
 run('form={querySelectorAll:()=>[{checkValidity:()=>false,reportValidity:()=>messages.push("invalid")}]};surfaceApplyDraft()');assert.equal(run('JSON.stringify(C.serialize(ship))'),before);assert.equal(run('history.length'),0);
 run('form=null;surfaceApplyDraft()');assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[0]).armor.thickness'),.4);assert.equal(run('history.length'),1);
});

test('the actual accordion conversions preserve surface form selectors and let Apply commit a staged edit',()=>{
 for(const convert of ['foldGroup','foldSection']){
  const {run,cx}=setup();run('fixture();st.surfaceIds=[surfaceFilteredRows()[0].id];const sourceText=e=>e.textContent,foldKey=String,foldValue=()=>"";');
  const parent=new FoldElement('main'),group=new FoldElement('div'),heading=new FoldElement('h4'),field=new FoldElement('input'),peer=new FoldElement('input'),button=new FoldElement('button'),note=new FoldElement('p');
  group.className='pgroup';for(const [key,value]of [['id','surface-fields'],['data-surface-form',''],['data-surface-editor',''],['data-surface-report',''],['aria-label','Surface layers']])group.setAttribute(key,value);
  heading.textContent='Surface layers';field.setAttribute('data-surface-field','armor.thickness');field.value='.45';peer.setAttribute('data-surface-field','armor.thickness');peer.value='.2';button.setAttribute('data-surface-action','apply');button.disabled=true;note.setAttribute('data-surface-pending','');
  for(const child of [heading,field,peer,button,note])group.append(child);parent.append(group);cx.document={createElement:tag=>new FoldElement(tag)};Object.assign(cx,{foldGroupNode:group,foldHeading:heading,foldField:field});
  const a=app.indexOf('function '+convert+'('),b=app.indexOf(convert==='foldGroup'?'// ---------- compact panel ----------':'function foldValue(',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));
  run(convert==='foldGroup'?'foldGroup(foldGroupNode,foldHeading,"Surface layers",true)':'foldSection(foldGroupNode)');const folded=parent.children[0];assert.equal(folded.tagName,'DETAILS',convert);assert.equal(folded.getAttribute('id'),'surface-fields',convert);assert.equal(folded.getAttribute('aria-label'),'Surface layers',convert);assert.equal(field.closest('[data-surface-form]'),folded,convert);
  const before=run('JSON.stringify(C.serialize(ship))');run('surfaceUpdateDraft(foldField)');assert.equal(button.disabled,false,convert);assert.equal(peer.value,'.45',convert);assert.equal(run('JSON.stringify(C.serialize(ship))'),before,convert);run('surfaceApplyDraft()');assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[0]).armor.thickness'),.45,convert);assert.equal(run('history.length'),1,convert);
 }
});

test('copy and paste use the same mutation history and preserve individually placed weapons',()=>{
 const {run}=setup();run(`fixture();const ids=surfaceFilteredRows().slice(0,2).map(p=>p.id);ship.fits.push({id:900,k:'pd',p:[40,45,0],a:4,n:[0,1,0],base:0,ped:0,host:null});C.setSurfaceConfig(ship,[ids[0]],{armor:{thickness:.6},style:{kind:'slab',density:.7,seed:123}});st.surfaceIds=[ids[0]];surfaceAction('copy');st.surfaceIds=[ids[1]];surfaceAction('paste');`);
 assert.equal(run('C.surfaceConfig(ship,ids[1]).armor.thickness'),.6);assert.equal(run('C.surfaceConfig(ship,ids[1]).style.seed'),123);assert.ok(run('ship.fits.some(f=>f.id===900&&!f.surfacePatch)'));assert.equal(run('history.length'),1);
 run('ship=C.deserialize(JSON.parse(history.pop()))');assert.equal(run('C.surfaceConfig(ship,ids[1]).armor.thickness'),.2);assert.ok(run('ship.fits.some(f=>f.id===900&&!f.surfacePatch)'));
});

test('split and merge controls retain total requested mounts while selecting the resulting patches',()=>{
 const {run}=setup();run(`fixture();const id=surfaceFilteredRows().find(p=>p.face==='top').id;C.setSurfaceConfig(ship,[id],{battery:{weapon:'pd',count:6},equipment:{kind:'hdis',count:3,depth:1}});st.surfaceIds=[id];surfaceTopology('split-u');`);
 assert.equal(run('st.surfaceIds.length'),2);assert.equal(run('st.surfaceIds.reduce((n,id)=>n+C.surfaceConfig(ship,id).battery.count,0)'),6);assert.equal(run('st.surfaceIds.reduce((n,id)=>n+C.surfaceConfig(ship,id).equipment.count,0)'),3);
 run("surfaceTopology('merge')");assert.equal(run('st.surfaceIds.length'),1);assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[0]).battery.count'),6);assert.equal(run('C.surfaceConfig(ship,st.surfaceIds[0]).equipment.count'),3);assert.equal(run('history.length'),2);
});

test('starting a real new design selects strict equipment accounting while a legacy constructor stays compatible',()=>{
 const {run}=setup();run("fixture();const legacy=C.newShip({L:160,W:80,H:40,plan:'rect',sec:'rect'},'Legacy');const titleState={hull:'wedge',L:16,W:8,H:4,cls:C.SHIP_CLASSES.find(c=>c.craft).id,name:'New Fighter'};const hideTitle=()=>{};function setShip(s){ship=s;}");
 const a=app.indexOf('function titleStartNew()'),b=app.indexOf('// On a phone',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));run('titleStartNew()');
 assert.equal(run('legacy.surfaces?.mode??"compat"'),'compat');assert.equal(run('ship.surfaces.mode'),'strict');assert.equal(run('ship.surfaces.legacyArmor'),.01);assert.equal(run('ship.armor.hull'),.01);assert.equal(run('ship.name'),'New Fighter');assert.equal(run('ship.surfaces.compatAllowed'),false);
 assert.equal(run('C.enableSurfaceMode(ship,false).ok'),false);assert.equal(run('ship.surfaces.mode'),'strict');assert.equal(run('C.deserialize(C.serialize(ship)).surfaces.compatAllowed'),false);assert.match(run('surfaceEditorHTML()'),/data-surface-action="compat" disabled/);
});

test('physical cutting keeps orphaned settings visible and the actual move control transfers them once',()=>{
 const {run}=setup();run(`fixture();const oldId=surfaceFilteredRows().find(p=>p.face==='top').id;C.setSurfaceConfig(ship,[oldId],{armor:{thickness:.4},battery:{weapon:'pd',count:2}});st.surfaceIds=[oldId];st.surfaceCarveDepth=1;surfaceAction('carve');`);
 assert.equal(run('ship.solidCuts.length'),1);assert.ok(run('C.surfaceReport(ship).orphaned.some(q=>q.id===oldId)'));assert.equal(run('st.surfaceIds.length'),0);
 run(`const orphanCount=C.surfaceReport(ship).orphaned.length,newId=surfaceFilteredRows().find(p=>p.face==='top').id;st.surfaceIds=[newId];`);const html=run('surfaceEditorHTML()');assert.match(html,/未配置の面設定/);assert.match(html,/data-surface-orphan=/);assert.match(html,/data-surface-cutdepth/);
 run(`const listeners={};form={addEventListener:(k,f)=>listeners[k]=f};bindSurfaceEditor();listeners.click({target:{closest:s=>s==='[data-surface-orphan]'?{dataset:{surfaceOrphan:oldId}}:null},stopImmediatePropagation(){}});`);
 assert.equal(run('C.surfaceReport(ship).orphaned.length'),run('orphanCount-1'));assert.equal(run('C.surfaceReport(ship).orphaned.some(q=>q.id===oldId)'),false);assert.equal(run('C.surfaceConfig(ship,newId).armor.thickness'),.4);assert.equal(run('C.surfaceConfig(ship,newId).battery.count'),2);assert.equal(run('ship.surfaces.patches.filter(q=>q.id===oldId).length'),0);assert.equal(run('C.surfaceDerivedFits(ship).filter(f=>f.surfacePatch===newId).length'),2);assert.equal(run('ship.fits.length'),0);
});

test('the design panel displays the common backend charge, heat and sustained-fire results',()=>{
 const {run}=setup();run(`fixture();const selectedId=surfaceFilteredRows().find(p=>p.face==='top').id;C.setSurfaceConfig(ship,[selectedId],{battery:{weapon:'claser',count:2,spacing:1},equipment:{kind:'hdis',count:1,depth:1}});st.surfaceIds=[selectedId];S=C.computeStats(ship);`);
 const row=plain(run('S.surface.patches.find(p=>p.id===selectedId)'));for(const key of ['maximumTT','sustainedTT','chargeRequested','chargeSupplied','heatGenerated','heatExported','maxEnergy'])assert.ok(Number.isFinite(row[key]),key);
 const before=run('JSON.stringify(C.serialize(ship))'),html=run('surfaceReportHTML(C.surfaceReport(ship))');assert.match(html,/最大／持続射撃（ゲーム換算）/);assert.ok(html.includes(row.maximumTT.toFixed(3)+' / '+row.sustainedTT.toFixed(3)+' TT/s'));assert.ok(html.includes(row.chargeRequested.toFixed(2)+' W / '+row.chargeSupplied.toFixed(2)+' W'));assert.equal(run('JSON.stringify(C.serialize(ship))'),before);
});

test('actual engine-stat adoption refreshes the surface panel without requiring another player click',()=>{
 const {run}=setup();run(`fixture();const eng={gen:1,statsGen:0,geoGen:1};let prevS=null,dragSnap=null;const renderStrip=()=>{},renderSpecTargets=()=>{},renderPanelInfo=()=>{},updateAviationUI=()=>{},updateGroundUI=()=>{},refreshOverlay=()=>{},engineStatus=()=>{},toastDiff=()=>{},armMode=()=>false,selSingle=()=>false;`);
 const a=app.indexOf('function onEngineStats(msg)'),b=app.indexOf('function onEngineError(msg)',a);assert.ok(a>=0&&b>a);run(app.slice(a,b));
 run('onEngineStats({gen:1,stats:{surface:{patches:[]}}})');assert.equal(run('eng.statsGen'),1);assert.equal(run('renders'),1);assert.ok(run('S.surface'));
});
