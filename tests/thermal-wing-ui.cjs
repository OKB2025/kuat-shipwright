const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=x=>JSON.parse(JSON.stringify(x));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){const c=vm.createContext({console,C});vm.runInContext(`
 const ship=C.newShip({L:20,W:12,H:8},'Thermal wing UI'),st={part:'gen',sel:null},listeners={},history=[],redoStack=[];
 ship.parts=[];ship.nextId=1;let S=null,renders=0,lastOp='',dragSnap=null;
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,fPct=v=>Math.round(v*100)+'%',fW=v=>v+' W',fMass=v=>v+' t',deg=v=>v+'°';
 const activeEquipment=()=>null,craftDesign=()=>C.isCraft(ship),selItem=()=>ship.parts.find(p=>p.id===st.sel?.id),editSel=fn=>fn(selItem());
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=selector=>selector==='#panel'?panel:null;
 const snap=()=>JSON.stringify(C.serialize(ship)),undoStack=history,sndEdit=()=>{},sndUI=()=>{},toast=()=>{},touch=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},rememberPick=()=>{},renderPanel=()=>renders++,updateHint=()=>{},endDrag=()=>{},foilPivotControls=()=>'<div data-test-pivot></div>',foilDiagramSVG=()=>'<svg></svg>';
 const FOIL_AXIS_ROWS=[['x','前後軸'],['y','上下軸'],['z','左右軸']];
 const wingFigures=p=>S?.wings?.find(w=>w.id===p.id)||null;
 function click(key,value){const button={dataset:{[key]:value}};for(const fn of listeners.click)fn({target:{closest:s=>s==='button'?button:null}});}
 function installPreview(){const p=unalignedPartPreview({p:[10,4,8],n:[0,1,0],kind:'section'});const made=C.placePart(ship,p.k,p.c,p.s,p,false);st.sel={list:'parts',id:made.id};return made;}
 function refresh(){S=C.computeStats(ship);return S;}
 `,c);
 for(const [start,end]of [['function seg(','function silhouette('],['function wingPresetCard(','function fitBtn('],['function unalignedPartPreview(','function notchBox('],['function wingControls(','function sensorBandControls('],['function bindWing(){','function heatHTML('],['function mutate(','function beginDrag(']])vm.runInContext(section(start,end),c);
 vm.runInContext('bindWing()',c);return code=>vm.runInContext(code,c);
}
test('the palette preset places the radiating wing itself without a nested external device',()=>{
 const run=setup();assert.match(run('wingPresetCard()'),/data-wingpreset="high"/);run('click("wingpreset","high")');
 assert.equal(run('st.part'),'struct');assert.equal(run('st.structWing.thermal'),'high');assert.equal(run('ship.parts.length'),0);assert.match(run('wingPresetCard()'),/aria-pressed="true"/);
 const p=plain(run('installPreview();C.serialize(ship).parts[0]'));assert.equal(p.k,'struct');assert.equal(p.wing.thermal,'high');assert.equal(p.s[2],.08);assert.equal(run('ship.parts.length'),1);assert.equal(run('ship.parts.some(p=>p.k==="hdisx")'),false);
 assert.ok(run('refresh().wings[0].capOpen')>0);assert.equal(run('S.wings[0].parts.length'),0);assert.equal(run('S.heat.net.dis.filter(d=>d.part===selItem().id).length'),1);
});
test('preselecting low temperature cooling puts that function directly on the placed wing',()=>{
 const run=setup();run('click("wingpreset","high");click("newwingthermal","low");installPreview()');assert.equal(run('selItem().wing.thermal'),'low');assert.equal(run('history.length'),0);
 assert.equal(run('C.deserialize(C.serialize(ship)).parts[0].wing.thermal'),'low');assert.ok(run('refresh().wings[0].capOpen')>0);
});
test('an empty wing still displays cooling capacity and offers its high and low temperature controls',()=>{
 const run=setup();run('click("wingpreset","high");installPreview();refresh()');const html=run('wingControls(selItem())');
 assert.match(html,/data-wingthermal="high"/);assert.match(html,/data-wingthermal="low"/);assert.match(html,/最大散熱能力（展開）/);assert.match(html,/翼内の設備<\/dt><dd>0/);
 assert.doesNotMatch(html,/翼そのものには散逸能力はありません|散逸装置がないため|散逸能力は増えません|翼内の散逸装置/);
});
test('changing the wing cooling mode records a normal undo step and keeps the geometry',()=>{
 const run=setup();run('click("wingpreset","high");installPreview();refresh()');const before=plain(run('C.serialize(ship).parts[0]')),high=run('S.wings[0].capOpen');
 run('click("wingthermal","low");refresh()');assert.equal(run('history.length'),1);assert.equal(run('JSON.parse(history[0]).parts[0].wing.thermal'),'high');assert.equal(run('selItem().wing.thermal'),'low');assert.equal(run('lastOp'),'主翼の散熱方式');
 const after=plain(run('C.serialize(ship).parts[0]'));assert.deepEqual(after.c,before.c);assert.deepEqual(after.s,before.s);assert.equal(after.form,before.form);assert.ok(run('S.wings[0].capOpen')>0);assert.ok(run('S.wings[0].capOpen')<high);
 assert.equal(run('C.deserialize(JSON.parse(history[0])).parts[0].wing.thermal'),'high');
});
test('solar wings expose generation and cooling as one piece of equipment',()=>{
 const run=setup();run('click("wingpreset","high");installPreview();click("wingkind","solar");refresh()');const html=run('wingControls(selItem())');
 assert.equal(run('selItem().wing.solar'),true);assert.equal(run('ship.parts.length'),1);assert.ok(run('S.solarPower')>0);assert.ok(run('S.wings[0].capOpen')>0);
 assert.match(html,/集電出力/);assert.match(html,/放熱能力（両面）/);assert.doesNotMatch(html,/data-wingthermal=|外装型の散逸装置/);
});
test('S-foil conversion keeps the cooling mode and uses the existing movable wing controls',()=>{
 const run=setup();run('click("wingpreset","high");click("newwingthermal","low");installPreview();click("wingkind","foil");refresh()');const html=run('wingControls(selItem())');
 assert.equal(run('selItem().wing.thermal'),'low');assert.equal(run('selItem().wing.foil'),true);assert.match(html,/data-wingthermal="low" aria-pressed="true"/);assert.match(html,/最大散熱能力（収納）/);assert.match(html,/data-test-pivot/);assert.equal(run('ship.parts.length'),1);
});
