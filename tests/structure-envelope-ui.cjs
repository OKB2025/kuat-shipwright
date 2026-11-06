const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console,navigator:{language:'en-US'}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=value=>JSON.parse(JSON.stringify(value,(key,value)=>key[0]==='_'?undefined:value));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function input(html,id,type='range'){
 const tag=(html.match(/<input\b[^>]*>/g)||[]).find(tag=>tag.includes(`data-sl="${id}"`)&&tag.includes(`type="${type}"`));
 assert.ok(tag,`${id} ${type} control`);return Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
}
function setup(){
 const cx=vm.createContext({console,C});const run=code=>vm.runInContext(code,cx);
 run(`
 let ship=C.newShip({L:1600,W:800,H:300,plan:'rect',sec:'rect'},'Planned envelope UI'),S=null;
 ship.parts=[{id:1,k:'struct',c:[800,150,0],s:[100,120,80],form:'box',taper:0}];ship.fits=[];ship.nextId=2;
 const st={sel:{list:'parts',id:1},part:'struct',partTool:'select',group:'shape',structSize:[100,120,80],structForm:'box',structAngles:[0,0,0,0],structTaper:0,structPlate:false,structLight:false,structPlateT:1,structYaw:0,structOffsetX:0,structOffsetZ:0,structPitch:0,structRoll:0,surfaceMode:'horizontal',hullFollow:'keep',hullRatio:false,ve:{target:null},surfaceIds:[],surfaceDraft:{},surfaceFilter:'all',mirror:false,vmirror:false},I18N=null,fleet={mode:'design'},eng={gen:1,statsGen:1},listeners={},nodes=new Map(),messages=[],history=[];
 const esc=String,num=(value,digits=0)=>Number(value).toFixed(digits),rgb=value=>value.join(','),fLen=value=>value+' m',fMass=value=>value+' t',fW=value=>value+' W',fPct=value=>Math.round(value*100)+'%',deg=value=>value+'°';
 const isAeroKind=k=>k==='wing'||k==='solarPanel',craftDesign=()=>C.isCraft(ship),activeEquipment=()=>null,selItem=()=>ship.parts.find(p=>p.id===st.sel?.id),twinOfItem=()=>null,partInfoHTML=()=>'',surfaceControls=()=>'<div data-orientation-controls></div>',sensorBandControls=()=>'',cockpitEquipmentHTML=()=>'',shipClassList=()=>C.SHIP_CLASSES,titleState={cls:'destroyer',hull:'wedge',L:1600,W:800,H:300,name:'Planned UI'},silhouette=()=>'';
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=selector=>selector==='#panel'?panel:nodes.get(selector)||null;
 let renders=0,draws=0;const renderPanel=()=>renders++,requestDraw=()=>draws++,toast=message=>messages.push(message),syncHud=()=>{},refreshOverlay=()=>{},updateHint=()=>{},refitOnGeometry=()=>{};
 const view={setSurfaceSelection:()=>{},pickSurface:()=>null};
 function mutate(label,fn){const before=JSON.stringify(C.serialize(ship));fn();history.push({label,before});return true;}
 `);
 for(const [start,end]of [
  ['function hullEditorPart()', '// ---------- ship lifecycle & history ----------'],
  ['function seg(','function silhouette('],['const fmtM =','function baseFitEditor('],
  ['const HULL_FOLLOW =','// Length, beam and depth:'],['function hullDimsHTML(','// v22.3 The hull\'s sections:'],
  ['function partCard(','function isAeroKind('],['function unalignedPartPreview(','function notchBox('],
  ['function structureControls(','// v21 A superweapon\'s controls:'],['function v3PartEditor(){','function fitPositionSliders('],
  ['function fitPositionSliders(','function fitPairHTML('],['function partEditor(){','function bindRealism(){'],
  ['function titleNewHTML()','function titleLoadHTML()'],
  ['// ---------- structure face armor ----------','// ---------- multiple selection, copy and paste ----------']
 ])run(section(start,end));
 const handler=section("  $('#panel').addEventListener('change', e => {\n    const t = e.target;\n    if ('yardenginecolor'",'  // HUD');run(handler);
 run(`bindStructureFaceArmor();function changeClass(value){for(const fn of listeners.change)fn({target:{dataset:{shipclass:''},value}});}function changeArmor(face,value){for(const fn of listeners.change)fn({target:{dataset:{structureFaceArmor:face,structureArmorHost:'1'},value:String(value),reportValidity:()=>messages.push('invalid')}});}`);
 return {run,cx};
}

test('shrinking a hull preserves planned placement and shape ranges and every existing outlier',()=>{
 const {run}=setup(),before=run('basePartEditor()'),partBefore=plain(run('ship.parts[0]')),plan=plain(run('C.designEnvelope(ship)'));
 run('setHullDims(160,80,30)');const after=run('basePartEditor()');
 assert.deepEqual(plain(run('C.designEnvelope(ship)')),plan);assert.deepEqual(plain(run('ship.parts[0]')),partBefore);
 for(const id of ['ex','ey','ez','el','ew','eh'])for(const key of ['min','max'])assert.equal(input(after,id)[key],input(before,id)[key],`${id} ${key}`);
 run('ship.parts[0].c=[2200,-600,900];ship.parts[0].s=[2000,1500,1000]');const outliers=run('basePartEditor()');
 for(const [id,value]of [['ex',2200],['ey',-600],['ez',900],['el',2000],['ew',1500],['eh',1000]]){
  const control=input(outliers,id);assert.equal(+control.value,value);assert.ok(+control.min<=value&&+control.max>=value,id);
 }
});

test('room and fitting controls keep their intended working range after the hull is reduced',()=>{
 const {run}=setup();run("ship.parts=[{id:1,k:'command',c:[800,150,0],room:[120,80,40],d:40}];ship.fits=[{id:2,k:'pd',p:[800,300,0],a:2}]");
 const roomBefore=run('basePartEditor()'),fitBefore=run('fitPositionSliders(ship.fits[0])');run('setHullDims(160,80,30)');
 const roomAfter=run('basePartEditor()'),fitAfter=run('fitPositionSliders(ship.fits[0])');
 for(const id of ['room0','room1','room2'])assert.equal(input(roomAfter,id).max,input(roomBefore,id).max,id);
 for(const id of ['fitX','fitZ'])for(const key of ['min','max'])assert.equal(input(fitAfter,id)[key],input(fitBefore,id)[key],`${id} ${key}`);
});

test('hull dimensions can shrink below their class and grow beyond the initial plan without changing it',()=>{
 const {run}=setup();run("ship.shipClass='destroyer'");const originalPlan=plain(run('C.designEnvelope(ship)'));
 let html=run('hullDimsHTML()');assert.equal(+input(html,'L').min,60);assert.match(html,/船体長/);assert.match(html,/船体幅/);assert.match(html,/船体高/);
 run('setHullDims(160,80,30)');assert.equal(run('ship.hull.L'),160);html=run('hullDimsHTML()');assert.equal(+input(html,'L').min,60);
 assert.equal(html.match(/data-design-envelope[\s\S]*?<dd>([^<]+)<\/dd>/)?.[1],'1600 m × 800 m × 300 m');
 assert.equal(html.match(/data-actual-dimensions[\s\S]*?<dd>([^<]+)<\/dd>/)?.[1],run('C.shipDimensions(ship).map(fLen).join(" × ")'));
 assert.notDeepEqual(plain(run('C.shipDimensions(ship)')),plain(run('[ship.hull.L,ship.hull.W,ship.hull.H]')),'an outlying structure contributes to the displayed assembled size');
 run('setHullDims(1700,850,350)');assert.equal(run('ship.hull.L'),1700);assert.equal(run('ship.hull.W'),850);assert.equal(run('ship.hull.H'),350);assert.deepEqual(plain(run('C.designEnvelope(ship)')),originalPlan);
 const geometry=plain(run('ship.hull'));run("changeClass('cruiser')");assert.equal(run('ship.shipClass'),'cruiser');assert.deepEqual(plain(run('ship.hull')),geometry);assert.deepEqual(plain(run('C.designEnvelope(ship)')),originalPlan);
});

test('the new-design screen explains that its initial dimensions describe the planned finished craft',()=>{
 const {run}=setup(),html=run('titleNewHTML()');assert.match(html,/完成艦の予定寸法/);
 for(const [id,value]of [['tL',1600],['tW',800],['tH',300]])assert.equal(+input(html,id,'number').value,value);
});

test('fresh assembled-size statistics bypass geometry work and stale statistics use the geometry fallback',()=>{
 const {run}=setup(),result=plain(run(`(()=>{const original=C.shipDimensions;C.shipDimensions=()=>{throw Error('geometry queried')};S={dims:[1700,900,400]};try{const cached=actualShipDimensions(),html=hullDimsHTML();eng.gen++;let staleFallback=false;try{actualShipDimensions()}catch(error){staleFallback=error.message==='geometry queried'}return {cached,html,staleFallback};}finally{C.shipDimensions=original}})()`));
 assert.deepEqual(result.cached,[1700,900,400]);assert.match(result.html,/data-actual-dimensions[\s\S]*?1700 m × 900 m × 400 m/);assert.equal(result.staleFallback,true);
});

test('planned dimensions and ordinary structure armor controls translate fully into English',()=>{
 const {run}=setup();
 for(const html of [run('titleNewHTML()'),run('hullDimsHTML()'),run('partEditor()')])for(const value of html.split(/<[^>]*>/))if(value.trim()){
  const translated=vm.runInContext('KSI18n.t('+JSON.stringify(value)+')',core);assert.doesNotMatch(translated,/[\u3040-\u30ff\u3400-\u9fff]/,value);
 }
});

test('ordinary structures retain their skin and shape controls and expose only six armor-thickness values',()=>{
 const {run}=setup(),before=plain(run('ship.parts[0]')),html=run('partEditor()');
 assert.match(html,/data-editform=/);assert.match(html,/data-editplate="frame"/);assert.match(html,/data-partskin=/);assert.match(html,/data-bands/);assert.match(html,/data-meshconvert/);
 assert.match(html,/data-structure-face-armor-editor/);assert.match(html,/0.3 m以下/);
 const inputs=html.match(/<input\b[^>]*data-structure-face-armor="[^"]+"[^>]*>/g)||[];assert.equal(inputs.length,6);
 const faces=inputs.map(tag=>tag.match(/data-structure-face-armor="([^"]+)"/)[1]);assert.deepEqual(faces,['top','bottom','fore','aft','port','stbd']);
 assert.doesNotMatch(html,/data-surface-action=|data-surface-field=|data-surface-host=|data-surface-pick=|機材構造面|配分|砲座/);
 assert.equal(run('C.PARTS.surfaceStruct'),undefined);assert.doesNotMatch(app,/function surfaceEditorHTML|function surfaceOpenHost|function bindSurfaceEditor|case 'surface':|data-surface-action=/);
 run("changeArmor('top',.2)");assert.equal(run('history.length'),1);assert.equal(run('C.structureArmorFaces(ship,1).find(p=>p.face==="top").thickness'),.2);assert.deepEqual(plain(run('ship.parts[0]')),before);
 const loaded=plain(run('C.structureArmorFaces(C.deserialize(C.serialize(ship)),1).filter(p=>p.face==="top").map(p=>p.thickness)'));assert.ok(loaded.length);assert.ok(loaded.every(t=>t===.2));
 run("changeArmor('top',-1);changeArmor('top','');changeArmor('top','bad');changeArmor('top',101)");assert.equal(run('history.length'),1);assert.equal(run('messages.length'),4);
 run('ship=C.deserialize(JSON.parse(history[0].before))');assert.notEqual(run('C.structureArmorFaces(ship,1).find(p=>p.face==="top").thickness'),.2);
});

test('legacy equipment faces appear as zero armor without machinery editing or persistent equipment',()=>{
 const {run}=setup();run(`const old=C.serialize(ship),face=C.surfacePatches(ship).find(p=>p.host==='p1'&&p.face==='port');old.surfaces={version:4,mode:'strict',patches:[{id:face.id,authored:true,functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',count:10,depth:3},battery:{weapon:'pd',count:2},style:{kind:'machinery',depth:5}}]};ship=C.deserialize(old);`);
 const rows=plain(run('C.structureArmorFaces(ship,1).filter(p=>p.face==="port")'));assert.ok(rows.length);assert.ok(rows.every(row=>row.thickness===0));
 const html=run('partEditor()'),port=(html.match(/<input\b[^>]*>/g)||[]).find(tag=>tag.includes('data-structure-face-armor="port"'));assert.ok(port);assert.match(port,/value="0"/);assert.doesNotMatch(html,/data-surface-field=|data-surface-action=|data-surface-host=|機材構造面/);
 assert.equal(run('ship.surfaces.patches.some(p=>p.functionMode==="equipment")'),false);assert.equal(run('ship.parts.some(p=>p.surfacePatch)'),false);assert.equal(run('ship.fits.some(p=>p.surfacePatch)'),false);
});
