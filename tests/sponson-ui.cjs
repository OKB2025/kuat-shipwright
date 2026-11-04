const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=v=>JSON.parse(JSON.stringify(v));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const cx=vm.createContext({console,C,window:{addEventListener:()=>{}}}),run=code=>vm.runInContext(code,cx);
 run(section('\nconst st = {','\nst.group='));
 run(`
 let ship=C.newShip({L:240,W:200,H:140,assembly:true},'Platforms'),S=null,prevS=null;ship.parts=[];ship.fits=[];ship.nextId=1;
 const host=C.placePart(ship,'struct',[120,50,0],[200,160,100],{form:'box'},false),hit={kind:'part',part:host,p:[120,60,80],n:[0,0,1]};
 Object.assign(st,{group:'weapons',vmirror:false,alignment:'grid10',weaponMount:'auto',structForm:'box',structAngles:[0,0,0,0],structYaw:0,structOffsetX:0,structOffsetZ:0,structPlate:false,structLight:false});
 const listeners={},outputs=new Map(),undoStack=[],redoStack=[],toasts=[];let dragSnap=null,dragLabel='',lastOp='',hoverLines=null,templateData=null;
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},sheet={addEventListener:()=>{}},$=q=>q==='#panel'?panel:q==='#sheet'?sheet:q.startsWith('#out-')?(outputs.has(q)||outputs.set(q,{}),outputs.get(q)):null;
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,fmtM=v=>v+' m',deg=v=>v+'°',I18N=null;
 const activeEquipment=()=>st.equipmentId?{id:st.equipmentId}:null,activeTemplate=()=>templateData,isAeroKind=k=>k==='wing'||k==='solarPanel';
 const findSel=s=>ship[s.list]?.find(q=>q.id===s.id),selItem=()=>st.sel?findSel(st.sel):null;
 const sndEdit=()=>{},sndUI=()=>{},touch=()=>{},kickEngine=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},updateHint=()=>{},showPreview=()=>{},refreshOverlay=()=>{},hideInspect=()=>{},updateName=()=>{},reconcileSolidCutter=()=>{},toast=s=>toasts.push(s),requestDraw=()=>{},applyPedDefaults=()=>{},applyFitTemplate=()=>{},copyFitSettings=()=>{},turretHeadingLines=()=>{},fitPlacementPed=()=>st.ped;
 const Gfx={lineSet:()=>({parts:[],boxes:[],part(p,c){this.parts.push(p);},box(b,c){this.boxes.push(b);},seg(){}})};
 function click(data){const button={dataset:data};for(const f of listeners.click||[])f({target:{closest:()=>button}});}
 function input(id,value,min=0,max=1000){for(const f of listeners.input||[])f({target:{dataset:{sl:id},value:String(value),min:String(min),max:String(max)}});}
 `);
 for(const [start,end]of [
 ['function seg(','function silhouette('],['function tool()','function updateHint('],
 ['function partPreview(','function notchBox('],['function ghostFor(','function refreshOverlay('],
 ['function isSponsonPlacement(','function baseRenderPanel('],['function snap()','function updateUndo('],
 ['function linkedItems(','function bind()'],['function alignFitPoint(','function tapWant('],
 ['function tapHit(','// ---------- inspect ----------'],['function bindEngineering(){','\nst.roomSize='],
 ['function weaponTiltMode(','function chooseWeaponMount(']
 ])run(section(start,end));
 run('bindEngineering()');return run;
}

test('weapon shortcuts select the wall-deck tool and return to point-defense placement without stale import or grid settings',()=>{
 const run=setup();run("st.importRaw={old:true};st.equipmentId='isdBridge';st.sel={list:'parts',id:host.id};st.template={old:true};click({sponsonCreate:''})");
 assert.equal(run('isSponsonPlacement()'),true);assert.equal(run('tool()'),'part');assert.equal(run('st.importRaw'),null);assert.equal(run('st.template'),null);assert.equal(run('st.alignment'),'none');assert.equal(run('st.equipmentId'),null);assert.match(run('hintText()'),/壁をタップ/);
 run("click({sponsonWeapon:''})");assert.equal(run('tool()'),'fit');assert.equal(run('st.fit'),'pd');assert.equal(run('st.group'),'weapons');assert.equal(run('st.weaponMount'),'auto');assert.equal(run('st.sel'),null);
});

test('platform size controls affect both preview and placement, while normal structures retain their own settings',()=>{
 const run=setup();run("chooseSponsonPlacement();input('sponsonLength',38);input('sponsonDepth',26);input('sponsonHeight',8)");
 assert.deepEqual(plain(run('partPreview(hit).s')),[38,26,8]);assert.deepEqual(plain(run('partPreview(hit).c')),[120,56,89]);assert.equal(run('undoStack.length'),0);
 assert.match(run('sponsonControls()'),/value="38"/);run("click({structplacement:'normal'})");assert.equal(run('isSponsonPlacement()'),false);assert.deepEqual(plain(run('partPreview(hit).s')),[180,110,60]);assert.equal(run('partPreview(hit).sponson'),undefined);
 run("click({structplacement:'sponson'});tapHit('part',hit,false)");assert.deepEqual(plain(run('selItem().s')),[38,26,8]);assert.equal(run('selItem().sponson'),true);
});

test('actual wall clicks create editable left-right and vertical pairs in one Undo transaction and survive Redo',()=>{
 const run=setup();run("chooseSponsonPlacement();st.mirror=true;st.vmirror=true;tapHit('part',hit,false)");
 assert.equal(run('ship.parts.filter(p=>p.sponson).length'),4);assert.equal(run('undoStack.length'),1);assert.equal(run('selItem().label'),'張出し砲座');assert.equal(run('ghostFor(hit).parts.length'),4);
 const before=plain(run('C.serialize(ship).parts'));run('undo()');assert.equal(run('ship.parts.length'),1);run('redo()');assert.deepEqual(plain(run('C.serialize(ship).parts')),before);assert.equal(run('ship.parts.filter(p=>p.sponson).length'),4);
});

test('horizontal faces and internal compartment hits cannot place a wall platform or consume Undo',()=>{
 const run=setup();run("chooseSponsonPlacement();const top={kind:'hull',p:[120,100,0],n:[0,1,0]},room={kind:'part',part:{k:'gen'},p:hit.p,n:hit.n};tapHit('part',top,false);tapHit('part',room,false)");
 assert.equal(run('ship.parts.length'),1);assert.equal(run('undoStack.length'),0);assert.equal(run('ghostFor(top)'),null);assert.equal(run('ghostFor(room)'),null);assert.match(run('toasts.at(-1)'),/側面/);
});

test('point-defense ghost and committed placement both use the clicked sponson deck below higher structures',()=>{
 const run=setup();run("chooseSponsonPlacement();st.mirror=false;tapHit('part',hit,false);const platform=selItem();C.placePart(ship,'struct',[120,100,91],[50,35,5],{form:'box'},false);click({sponsonWeapon:''});const deck=C.rayEnv(ship,[120,70,89],[0,-1,0],{structOnly:true});const ghost=ghostFor(deck)");
 assert.equal(run('deck.part.id'),run('platform.id'));assert.ok(run('ghost.boxes[0][4]')<90,'ghost belongs to the lower deck');run("tapHit('fit',deck,false)");assert.equal(run('selItem().localMount'),true);assert.equal(run('selItem().p[1]'),60);assert.equal(run('selItem().float'),false);run('undo()');assert.equal(run('ship.fits.length'),0);run('redo()');assert.equal(run('ship.fits[0].p[1]'),60);
});
