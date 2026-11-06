const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const context=vm.createContext({console,C});vm.runInContext(`
 let ship=C.newShip({L:500,W:300,H:120,plan:'rect',sec:'rect'},'Turret orientation');ship.parts=[];ship.fits=[];ship.nextId=1;
 const st={tab:'arm',fit:'refVen',fitTool:'place',weaponMount:'auto',gunYaw:0,ped:0,pedShape:'round',pedSize:1,mirror:false,vmirror:false,fitPairEdit:true,sel:null,template:null,alignment:'none'},listeners={},undoStack=[],redoStack=[],outputs=new Map(),meshStore={};
 let dragSnap=null,dragLabel='',lastOp='',hoverLines=null,S=null,prevS=null,editorPartsRevision=0;const view=null,eng={gen:0,adoptedGen:0,geoGen:0,statsGen:0,ready:false};
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,fmtM=v=>v+' m',deg=v=>v+'°',I18N=null;
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=s=>s==='#panel'?panel:s.startsWith('#out-')?(outputs.has(s)||outputs.set(s,{}),outputs.get(s)):null;
 const activeEquipment=()=>null,findSel=s=>ship[s.list]?.find(q=>q.id===s.id),selItem=()=>st.sel?findSel(st.sel):null,twinOfItem=(list,p)=>ship[list].find(q=>q.id===p.tw);
 const sndEdit=()=>{},sndUI=()=>{},touch=()=>{},kickEngine=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},queuePreview=()=>{},showPreview=()=>{},refreshOverlay=()=>{},hideInspect=()=>{},updateName=()=>{},reconcileSolidCutter=()=>{},requestDraw=()=>{};
 const toast=()=>{},fitPositionSliders=()=>'',fitPairHTML=()=>'',engineEditTarget=()=>null;
 function input(id,value,finish=true){const t={dataset:{sl:id},value:String(value),min:'-180',max:'180'};for(const fn of listeners.input)fn({target:t});if(finish){endDrag();for(const fn of listeners.change)fn({target:t});}}
 function install(k=st.fit,z=60,x=250){st.fit=k;st.sel=null;const h=C.rayEnv(ship,[x,500,z],[0,-1,0],{structOnly:true});if(!h)throw Error('No surface');tapHit('fit',{...h,kind:'hull'},false);if(!selItem())throw Error('Placement failed '+k);return selItem();}
 `,context);
 for(const [start,end]of [
 ['function enginePending()','function engineStatus('],['const requestedParts =','function editorRayEnv('],['function previewHistory(','// Exterior view skips machinery'],
 ['function seg(','function silhouette('],['function baseFitEditor()','function partList('],
 ['function weaponYawControls(','function turretHeadingLines('],['function weaponTiltMode(','function chooseWeaponMount('],
 ['function bindReference(){','function packingInfoHTML('],['function snap(','function updateUndo('],
 ['function assignMirror(','const TEMPLATE_SKIP ='],['const TEMPLATE_SKIP =','function removeWithPreview('],
 ['function placeVerticalFits(','function bind()'],['function alignFitPoint(','function tapWant('],
 ['function tapHit(','// ---------- inspect ----------']
 ])vm.runInContext(section(start,end),context);
 vm.runInContext(app.split('\n').find(line=>line.startsWith('function curFit(')),context);
 vm.runInContext('bindReference()',context);return code=>vm.runInContext(code,context);
}

test('every rotatable procedural and reference turret exposes the same precise placement and selected controls',()=>{
 const run=setup(),keys=[...new Set(Object.keys(C.FITS).map(C.canonicalWeaponKind))].filter(k=>C.fitCanRotate(k));assert.ok(keys.includes('refVen')&&keys.includes('oct40')&&keys.includes('cturret'));
 for(const key of keys){run(`st.fit=${JSON.stringify(key)}`);const fresh=run('weaponYawControls()');assert.match(fresh,/data-sl="newGunYaw"/);assert.match(fresh,/step="any"/);assert.match(fresh,/min="-180" max="180"/);
  run(`ship.fits=[{id:1,k:${JSON.stringify(key)},p:[250,60,60],a:2,ped:0,base:0,assetYaw:32.125}];st.sel={list:'fits',id:1}`);const selected=run('baseFitEditor()');assert.match(selected,/data-sl="gunYaw"/);assert.match(selected,/value="32\.125"/);
 }
 for(const key of ['quad70Side','claser','ctorp','msl','cpylon','bridge'])if(C.FITS[key]){run(`st.fit=${JSON.stringify(key)}`);assert.equal(run('weaponYawControls()'),'');assert.equal(run(`weaponYawControls({k:${JSON.stringify(key)}})`),'');}
});

test('actual placement keeps the requested yaw for procedural, craft and reference turret families',()=>{
 const run=setup();for(const key of ['htl','stl','ion','pd','triple40','quad200','xx9','nk7','cturret','oct40','refVen','refSide']){
  run(`ship.fits=[];st.fit=${JSON.stringify(key)};input('newGunYaw',-42.125);install()`);assert.equal(run('selItem().assetYaw'),-42.125,key);assert.equal(run('selItem().float'),false,key);
  const p=plain(run('C.deserialize(C.serialize(ship)).fits[0]'));assert.equal(p.assetYaw,-42.125,key);assert.equal(p.k,C.canonicalWeaponKind(key));
 }
});

test('selected yaw drags use one Undo transaction and survive Redo and blueprint loading',()=>{
 const run=setup();run("install('htl');undoStack.length=0;const old=C.serialize(ship);input('gunYaw',30.125,false);input('gunYaw',91.375)");assert.equal(run('selItem().assetYaw'),91.375);assert.equal(run('undoStack.length'),1);
 run('undo()');assert.deepEqual(plain(run('C.serialize(ship).fits')),plain(run('C.serialize(C.deserialize(old)).fits')));run('redo()');assert.equal(run('selItem().assetYaw'),91.375);assert.equal(run('C.deserialize(C.serialize(ship)).fits[0].assetYaw'),91.375);
 run("input('gunYaw','')");assert.equal(run('selItem().assetYaw'),91.375,'clearing the numeric field must not reset a turret');
});

test('initial and edited left-right and vertical mirror turrets carry reflected yaw and can be edited individually',()=>{
 const run=setup();run("st.mirror=true;st.vmirror=true;input('newGunYaw',37.125);install('htl',70)");assert.equal(run('ship.fits.length'),4);const rows=plain(run('ship.fits.map(q=>({id:q.id,y:q.p[1],z:q.p[2],yaw:q.assetYaw}))'));
 for(const row of rows){const sign=(row.y<run('selItem().p[1]')?-1:1)*(row.z<0?-1:1);near(row.yaw,sign*37.125);}
 run("input('gunYaw',-54.375)");const selectedId=run('selItem().id');for(const row of plain(run('ship.fits.map(q=>({id:q.id,y:q.p[1],z:q.p[2],yaw:q.assetYaw}))'))){const sign=(row.y<run('selItem().p[1]')?-1:1)*(row.z<0?-1:1);near(row.yaw,sign*-54.375);}
 run("st.fitPairEdit=false;input('gunYaw',12.25)");for(const row of plain(run('ship.fits.map(q=>({id:q.id,yaw:q.assetYaw}))')))if(row.id===selectedId)near(row.yaw,12.25);else assert.notEqual(row.yaw,12.25);
});

test('copying a rotated turret into placement keeps its angle and permits a different new angle',()=>{
 const run=setup();run("install('htl',60,200);input('gunYaw',-61.125);carryToPlace()");assert.equal(run('st.gunYaw'),-61.125);assert.equal(run('st.fit'),'refVen');assert.match(run('weaponYawControls()'),/value="-61\.125"/);
 run("install('htl',60,350)");assert.equal(run('selItem().assetYaw'),-61.125);run("carryToPlace();input('newGunYaw',22.375);install('htl',-60,350)");assert.equal(run('selItem().assetYaw'),22.375);
 assert.deepEqual(plain(run('ship.fits.map(q=>q.assetYaw)')),[-61.125,-61.125,22.375]);
});

test('unsupported fixed weapons and wall mounts do not gain yaw edits through stale controls',()=>{
 const run=setup();for(const key of ['claser','quad70Side','msl']){run(`ship.fits=[{id:1,k:${JSON.stringify(key)},p:[250,60,60],a:2,ped:0,base:0}];st.sel={list:'fits',id:1};input('gunYaw',75)`);assert.equal(run('selItem().assetYaw'),undefined,key);}
});

test('the actual rotation controls and placement guidance translate fully in English',()=>{
 const run=setup(),context=vm.createContext({navigator:{language:'en-US'}});for(const file of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
 const translate=s=>{const out=context.KSI18n.t(s);assert.doesNotMatch(out,/[\u3040-\u30ff\u3400-\u9fff]/,s);return out;};
 for(const html of [run('weaponYawControls()'),run("weaponYawControls({k:'htl',assetYaw:-42.125})")]){for(const text of html.split(/<[^>]*>/))if(text.trim())translate(text);for(const m of html.matchAll(/aria-label="([^"]+)"/g))translate(m[1]);}
 const note=app.match(/<p class="note">(砲塔は実寸で、砲身の向きはゲージで調整できます。[^<]+)<\/p>/);assert.ok(note);assert.match(translate(note[1]),/slider/);
});
