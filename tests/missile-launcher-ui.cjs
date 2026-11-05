const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=value=>JSON.parse(JSON.stringify(value));
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const cx=vm.createContext({console,C}),run=code=>vm.runInContext(code,cx);
 run(`let ship=C.newShip({L:500,W:300,H:120,plan:'rect',sec:'rect'},'Compact launcher controls');ship.parts=[];ship.fits=[];ship.nextId=1;
 const meshStore={pendingSurfaceGeometry:null};
 const st={tab:'arm',fit:'cmsl',fitTool:'place',weaponMount:'auto',gunYaw:0,launchPitch:0,ped:0,pedShape:'round',pedSize:1,mirror:false,vmirror:false,fitPairEdit:true,sel:null,template:null,alignment:'none',multi:{parts:new Set(),fits:new Set()}},listeners={},undoStack=[],redoStack=[],outputs=new Map();
 let dragSnap=null,dragLabel='',lastOp='',hoverLines=null;
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,fmtM=v=>v+' m',deg=v=>v+'°',I18N=null;
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=s=>s==='#panel'?panel:s.startsWith('#out-')?(outputs.has(s)||outputs.set(s,{}),outputs.get(s)):null;
 const activeEquipment=()=>null,findSel=s=>ship[s.list]?.find(q=>q.id===s.id),selItem=()=>st.sel?findSel(st.sel):null,curFit=()=>st.fit,twinOfItem=(list,p)=>ship[list].find(q=>q.id===p.tw);
 const sndEdit=()=>{},sndUI=()=>{},touch=()=>{},kickEngine=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},queuePreview=()=>{},showPreview=()=>{},refreshOverlay=()=>{},hideInspect=()=>{},updateName=()=>{},reconcileSolidCutter=()=>{},requestDraw=()=>{};
 const toast=()=>{},fitPositionSliders=()=>'',fitPairHTML=()=>'',engineEditTarget=()=>null;
 function input(id,value,finish=true){const t={dataset:{sl:id},value:String(value),min:'-90',max:'90'};for(const fn of listeners.input||[])fn({target:t});if(finish){endDrag();for(const fn of listeners.change||[])fn({target:t});}}
 function install(k=st.fit,z=60,x=250){st.fit=k;st.sel=null;const h=C.rayEnv(ship,[x,500,z],[0,-1,0],{structOnly:true});if(!h)throw Error('No surface');tapHit('fit',{...h,kind:'hull'},false);if(!selItem())throw Error('Placement failed '+k);return selItem();}
 `);
 for(const [start,end]of [
 ['function seg(','function silhouette('],['function baseFitEditor()','function partList('],
 ['function weaponYawControls(','function turretHeadingLines('],['function weaponTiltMode(','function chooseWeaponMount('],
 ['function bindReference(){','function packingInfoHTML('],['function snap()','function updateUndo('],
 ['function assignMirror(','const TEMPLATE_SKIP ='],['const TEMPLATE_SKIP =','function removeWithPreview('],
 ['function placeVerticalFits(','function bind()'],['function alignFitPoint(','function tapWant('],
 ['function tapHit(','// ---------- inspect ----------'],['const PART_KEYS =','const partOffered =']
 ])run(section(start,end));
 run('bindReference()');run(section("  $('#panel').addEventListener('change', e => {\n    const k = e.target.dataset.sl;","  $('#panel').addEventListener('change', e => {\n    const t = e.target;"));return run;
}

test('ships and aircraft offer one compact concussion launcher, with native pitch controls',()=>{
 const run=setup();assert.equal(typeof C.launcherPitch,'function');assert.equal(run("weaponKeys().filter(k=>k==='cmsl').length"),1);assert.equal(run("weaponKeys().includes('msl')"),false);
 run('ship.hull.L=10');assert.equal(run('craftDesign()'),true);assert.equal(run("weaponKeys().filter(k=>k==='cmsl').length"),1);
 for(const html of [run('launcherPitchControls()'),run("launcherPitchControls({k:'cmsl',launchPitch:-17.5})")]){
  assert.match(html,/type="range"/);assert.match(html,/type="number"/);assert.match(html,/min="-90" max="90" step="0\.1"/);assert.match(html,/支持台を自動生成/);
 }
 assert.equal(run("launcherPitchControls({k:'cmsl',surfacePatch:'hull:top:1:a',launchPitch:45})"),'','surface VLS cells do not gain an articulated pod control');
 for(const kind of ['claser','htl','itl'])assert.equal(run(`launcherPitchControls({k:${JSON.stringify(kind)}})`),'');
});

test('placement and carried settings preserve launch pitch while a new placement can use another angle',()=>{
 const run=setup();run("input('newLaunchPitch',35.5);install()");assert.equal(run('selItem().launchPitch'),35.5);assert.equal(run('selItem().float'),false);
 run("carryToPlace();input('newLaunchPitch',-25.5);install('cmsl',-60,350)");assert.deepEqual(plain(run('ship.fits.map(f=>C.launcherPitch(f))')),[35.5,-25.5],'carried templates must not overwrite the new chosen angle');
 assert.deepEqual(plain(run('C.deserialize(C.serialize(ship)).fits.map(f=>C.launcherPitch(f))')),[35.5,-25.5]);
});

test('pitch editing follows linked mirrors and groups a drag into one Undo transaction',()=>{
 const run=setup();run("st.mirror=true;st.vmirror=true;input('newLaunchPitch',20.5);install('cmsl',70);undoStack.length=0");assert.equal(run('ship.fits.length'),4);assert.ok(run('ship.fits.every(f=>C.launcherPitch(f)===20.5)'));
 run("input('launchPitch',-14.5,false);input('launchPitch',-40.5)");assert.equal(run('undoStack.length'),1);assert.ok(run('ship.fits.every(f=>C.launcherPitch(f)===-40.5)'));
 run('undo()');assert.ok(run('ship.fits.every(f=>C.launcherPitch(f)===20.5)'));run('redo()');assert.ok(run('ship.fits.every(f=>C.launcherPitch(f)===-40.5)'));
 run("st.fitPairEdit=false;input('launchPitch',10.5)");assert.equal(run('ship.fits.filter(f=>C.launcherPitch(f)===10.5).length'),1);
});

test('bulk angle changes affect selected compact launchers and leave other fittings alone',()=>{
 const run=setup();run("install('cmsl',50,150);const a=selItem().id;install('cmsl',-50,150);const b=selItem().id;install('cmsl',50,350);const outside=selItem().id;install('htl',-50,350);st.multi.fits=new Set([a,b,selItem().id]);st.sel=null;undoStack.length=0");
 assert.match(run('launcherPitchControls(null,true)'),/data-sl="multiLaunchPitch"/);run("input('multiLaunchPitch',63.5)");assert.equal(run('undoStack.length'),1);assert.equal(run('ship.fits.filter(f=>C.launcherPitch(f)===63.5).length'),2);assert.equal(run('C.launcherPitch(ship.fits.find(f=>f.id===outside))'),0);assert.equal(run("ship.fits.find(f=>f.k===C.canonicalWeaponKind('htl')).launchPitch"),undefined);
 run('undo()');assert.ok(run("ship.fits.filter(f=>f.k==='cmsl').every(f=>C.launcherPitch(f)===0)"));run('redo()');assert.equal(run('ship.fits.filter(f=>C.launcherPitch(f)===63.5).length'),2);
});

test('invalid and stale angle inputs cannot alter unrelated or surface-only equipment',()=>{
 const run=setup();run("install('cmsl');input('launchPitch',30);undoStack.length=0;input('launchPitch','');input('launchPitch','not-a-number')");assert.equal(run('selItem().launchPitch'),30);assert.equal(run('undoStack.length'),0);
 run("input('launchPitch',200)");assert.equal(run('C.launcherPitch(selItem())'),90);run("input('launchPitch',-200)");assert.equal(run('C.launcherPitch(selItem())'),-90);
 for(const kind of ['claser','htl','itl']){run(`ship.fits=[{id:1,k:${JSON.stringify(kind)},p:[250,120,60],a:2,ped:0,base:0}];st.sel={list:'fits',id:1};undoStack.length=0;input('launchPitch',45)`);assert.equal(run('selItem().launchPitch'),undefined);assert.equal(run('undoStack.length'),0);}
 run("ship.fits=[{id:1,k:'cmsl',surfacePatch:'hull:top:1:a',p:[250,120,60],a:2,ped:0,base:0}];st.sel={list:'fits',id:1};input('launchPitch',45)");assert.equal(run('selItem().launchPitch'),undefined);
});

test('gamepad focus nudges the same native number field and completes the normal edit transaction',()=>{
 const run=setup();run("install('cmsl');input('launchPitch',10);undoStack.length=0");
 run(`class Event{constructor(type){this.type=type;}}const scopeRoot=()=>null,current=()=>focused,
 focused={tagName:'INPUT',type:'number',step:'0.1',min:'-90',max:'90',value:'10',dataset:{sl:'launchPitch'},
 stepUp(){this.value=String(Math.min(90,Number(this.value)+.1));},stepDown(){this.value=String(Math.max(-90,Number(this.value)-.1));},
 dispatchEvent(event){for(const handler of listeners[event.type]||[])handler({target:this});}};`);
 run(section('function adjustFocused(dir)','function activateFocused()'));
 assert.equal(run("adjustFocused('right')"),true);assert.ok(Math.abs(run('C.launcherPitch(selItem())')-10.1)<1e-10);assert.equal(run('undoStack.length'),1);
 run('undo()');assert.equal(run('C.launcherPitch(ship.fits[0])'),10);
});

test('all native angle-control text and the VLS choice translate to English',()=>{
 const run=setup(),lang=vm.createContext({navigator:{language:'en-US'}});for(const file of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),lang);
 const translated=text=>{const out=lang.KSI18n.t(text);assert.doesNotMatch(out,/[\u3040-\u30ff\u3400-\u9fff]/,text+' => '+out);return out;};
 run("install('cmsl');st.multi.fits.add(selItem().id)");for(const html of [run('launcherPitchControls()'),run('launcherPitchControls(selItem())'),run('launcherPitchControls(null,true)')]){for(const text of html.split(/<[^>]*>/))if(text.trim())translated(text);for(const m of html.matchAll(/aria-label="([^"]+)"/g))translated(m[1]);}
 assert.match(translated('震盪ミサイルVLS（器材面）'),/VLS/);translated('表面兵装（砲列・VLS）');translated('支持台は発射角に合わせて自動生成します。');
});

test('the compact launcher palette displays its real firing cycle and shared six-round store',()=>{
 const run=setup();run("const fTT=v=>v+' TT',storeCapText=s=>s.slots+' 発';");run(section('function fitBtn(','const fmtM ='));
 const html=run("fitBtn('cmsl',true,'fit')");assert.match(html,/25TT／1\.2秒/);assert.match(html,/6 発/);assert.doesNotMatch(html,/20秒/);
});
