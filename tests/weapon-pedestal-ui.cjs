const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,Gfx}=vm.runInContext('({C:Core,Gfx})',context),plain=v=>JSON.parse(JSON.stringify(v));
function section(start,end,source=app){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function setup(){
 const box=vm.createContext({console,C,Gfx,performance:{now:()=>0}}),run=code=>vm.runInContext(code,box);
 run(section('\nconst st = {','\nst.group='));
 run(`
 let ship=C.newShip({L:500,W:300,H:120,plan:'rect',sec:'rect'},'Pedestal UI');ship.parts=[];ship.fits=[];ship.nextId=1;
 Object.assign(st,{tab:'arm',weaponMount:'auto',gunYaw:0,alignment:'none',vmirror:false,fitPairEdit:true,mirror:false,multi:{parts:new Set(),fits:new Set()}});
 const listeners={},undoStack=[],redoStack=[],outputs=new Map(),fleet={mode:'design'},meshStore={};let dragSnap=null,dragLabel='',lastOp='',hoverLines=null,previewRay=null;
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=s=>s==='#panel'?panel:s.startsWith('#out-')?(outputs.has(s)||outputs.set(s,{}),outputs.get(s)):null,$$=()=>[];
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,fmtM=v=>v+' m',deg=v=>v+'°',I18N=null;
 const activeEquipment=()=>null,findSel=s=>ship[s.list]?.find(q=>q.id===s.id),selItem=()=>st.sel?findSel(st.sel):null,twinOfItem=(list,p)=>ship[list].find(q=>q.id===p.tw);
 const sndEdit=()=>{},sndUI=()=>{},touch=()=>{},kickEngine=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},queuePreview=()=>{},showPreview=()=>{},refreshOverlay=()=>{},hideInspect=()=>{},updateName=()=>{},reconcileSolidCutter=()=>{},requestDraw=()=>{},toast=()=>{};
 const fitPositionSliders=()=>'',fitPairHTML=()=>'',blockedHullControl=()=>false,selSingle=()=>true,tool=()=> 'adjust',view={ray:()=>previewRay},clipRead=()=>st.clipMem;
 const publicCopy=o=>JSON.parse(JSON.stringify(o)),xfClean=q=>q,xfDrivers=()=>[{list:'fits',it:selItem(),fol:[]}],xfUnits=d=>d;
 const xfBox=(l,q)=>l==='parts'?C.partAABB(q):C.fitAABB(q);
 function input(id,value,finish=true){const t={dataset:{sl:id},value:String(value),min:'0',max:'100'};for(const fn of listeners.input||[])fn({target:t});if(finish){endDrag();for(const fn of listeners.change||[])fn({target:t});}}
 function click(data){const b={dataset:data};for(const fn of listeners.click||[])fn({target:{closest:()=>b}});}
 function install(k=st.fit,z=60,x=250){st.fit=k;st.sel=null;const h=C.rayEnv(ship,[x,500,z],[0,-1,0],{structOnly:true});if(!h)throw Error('No surface');tapHit('fit',{...h,kind:'hull'},false);if(!selItem())throw Error('Placement failed '+k);return selItem();}
 `);
 for(const [start,end]of [
 ['function seg(','function silhouette('],['function baseFitEditor()','function partList('],
 ['function weaponYawControls(','function turretHeadingLines('],['function weaponTiltMode(','function chooseWeaponMount('],
 ['function snap()','function updateUndo('],['function assignMirror(','const TEMPLATE_SKIP ='],
 ['const TEMPLATE_SKIP =','function removeWithPreview('],['function placeVerticalFits(','function bind()'],
 ['function alignFitPoint(','function tapWant('],['function tapHit(','// ---------- inspect ----------'],
 ['function copyWingLinks(','function multiMove('],['function fitPickHit(','function pick('],['let itemDrag =','function dragSupportY('],['function dragSelStart(','function dragSelMove(']
 ])run(section(start,end));
 run(app.split('\n').find(line=>line.startsWith('function curFit(')));
 const bind=app.slice(app.indexOf('function bind()'));
 run(section("  $('#panel').addEventListener('click', e => {",'  // HUD',bind));
 return run;
}
function noPedestal(f){assert.equal(f.ped,0);assert.equal(f.base,0);assert.equal(f.low,0);assert.equal(f.pedShape,undefined);assert.equal(f.pedSize,undefined);}

test('new weapon placement starts at zero lift, and fixed or missile mounts never expose lift controls',()=>{
 const run=setup();assert.equal(run('st.ped'),0,'read the actual default state, rather than a test-supplied default');
 assert.match(run('fitPedestalControls()'),/data-sl="ped"[^>]*value="0"/);
 for(const k of ['claser','claserH','ctorp','cmsl','msl']){
  assert.ok(C.FITS[k],k);
  run(`st.fit=${JSON.stringify(k)}`);assert.match(run('fitPedestalControls()'),/取付面に直接/);assert.doesNotMatch(run('fitPedestalControls()'),/data-(sl="ped|pedshape)/);
  run('st.ped=12;st.pedShape="trap";st.pedSize=2;install()');noPedestal(plain(run('selItem()')));
  assert.doesNotMatch(run('baseFitEditor()'),/data-(sl="ped|pedshapesel)/);assert.match(run('baseFitEditor()'),/支持台を使わず/);
  noPedestal(plain(run('C.deserialize(C.serialize(ship)).fits.at(-1)')));run('ship.fits=[]');
 }
 run("st.fit='htl';st.ped=0;install()");assert.equal(run('selItem().ped'),0);assert.match(run('baseFitEditor()'),/data-sl="pedsel"/);
});

test('stale controls cannot lift fixed and missile weapons or seed lifted placement settings',()=>{
 const run=setup();for(const k of ['claser','msl']){
  run(`ship.fits=[];st.fit=${JSON.stringify(k)};st.ped=0;install();undoStack.length=0`);
  run("input('pedsel',17);input('pedsizesel',220);click({pedshapesel:'trap'});input('ped',14);input('pedsize',200);click({pedshape:'trap'})");
  noPedestal(plain(run('selItem()')));assert.equal(run('undoStack.length'),0);assert.equal(run('st.ped'),0);
  run("selItem().ped=15;selItem().pedShape='trap';selItem().pedSize=2;carryToPlace()");assert.equal(run('st.ped'),0);assert.equal(run('st.pedShape'),'round');assert.equal(run('st.pedSize'),1);
  run('install(st.fit,-60,350)');noPedestal(plain(run('selItem()')));
 }
});

test('template and linked mirror edits strip unsupported supports while explicit articulated turret supports retain Undo',()=>{
 const run=setup();run("st.ped=13;st.pedShape='trap';st.pedSize=2;st.mirror=true;st.vmirror=true;install('claser',70)");assert.equal(run('ship.fits.length'),4);for(const f of plain(run('ship.fits')))noPedestal(f);
 run("editSel(f=>{f.ped=9;f.pedSize=2;f.pedShape='trap'})");for(const f of plain(run('ship.fits')))noPedestal(f);
 run("ship.fits=[];st.vmirror=false;st.mirror=false;st.ped=6;st.pedShape='trap';st.pedSize=1.5;install('htl');undoStack.length=0;input('pedsel',9)");
 assert.equal(run('selItem().ped'),9);assert.equal(run('selItem().pedShape'),'trap');assert.equal(run('selItem().pedSize'),1.5);assert.equal(run('undoStack.length'),1);run('undo()');assert.equal(run('ship.fits[0].ped'),6);run('redo()');assert.equal(run('ship.fits[0].ped'),9);
 const f=plain(run('C.deserialize(C.serialize(ship)).fits[0]'));assert.equal(f.ped,9);assert.equal(f.pedShape,'trap');assert.equal(f.pedSize,1.5);
 run("const pod={k:'podBridge',ped:4,pedShape:'trap'};C.normalizeFitMount(pod)");assert.equal(run('pod.ped'),4);assert.equal(run('pod.pedShape'),'trap');
});

test('bulk clipboard paste normalizes old fixed supports and preserves explicit articulated supports',()=>{
 const run=setup();run("install('claser');const fixed=publicCopy(selItem());ship.fits=[];install('htl');const turret=publicCopy(selItem());fixed.ped=22;fixed.base=9;fixed.low=-4;fixed.pedShape='trap';fixed.pedSize=2;turret.ped=7;turret.pedShape='trap';turret.pedSize=1.5;st.clipMem={v:1,parts:[],fits:[fixed,turret],from:{L:ship.hull.L}};ship.fits=[];st.sel=null;st.pasteMode='same';undoStack.length=0;multiPaste()");
 const fits=plain(run('ship.fits'));assert.equal(fits.length,2);noPedestal(fits.find(f=>f.k==='claser'));const turret=fits.find(f=>f.k===C.canonicalWeaponKind('htl'));assert.equal(turret.k,'refVen');assert.equal(turret.ped,7);assert.equal(turret.pedShape,'trap');assert.equal(turret.pedSize,1.5);assert.equal(run('st.multi.fits.size'),2);assert.equal(run('undoStack.length'),1);run('undo()');assert.equal(run('ship.fits.length'),0);
});

test('weapon picking and both drag gates require visible geometry rather than an empty region of a padded box',()=>{
 const run=setup();run("st.ped=0;install('htl');ship._geoProxy=true;selItem().assetYaw=45");
 const rays=run(`(()=>{const f=selItem(),b=C.fitAABB(f),d=[0,-1,0],found={};for(let x=1;x<20;x++)for(let z=1;z<20;z++){const o=[b[0]+(b[3]-b[0])*x/20,b[4]+10,b[2]+(b[5]-b[2])*z/20];if(!C.rayAABB(o,d,b))continue;const key=Gfx.rayFit(o,d,f)?'hit':'miss';found[key]||={o,d};}return found;})()`);
 assert.ok(rays.hit&&rays.miss,'a rotated real turret has both occupied and empty AABB regions');
 for(const [kind,ray]of Object.entries(plain(rays))){run(`previewRay=${JSON.stringify(ray)}`);assert.equal(!!run('fitHit(previewRay.o,previewRay.d)'),kind==='hit');assert.equal(run('dragItemStart(0,0)'),kind==='hit');assert.equal(!!run('dragSelStart(0,0,previewRay)'),kind==='hit');}
});

test('accurate native bounds contain an extremal visible muzzle while both drag gates accept its actual geometry',()=>{
 const run=setup();run("st.ped=0;install('htl');ship._geoProxy=true");
 const ray=run(`(()=>{const f=selItem(),meshes=[Gfx.meshFits({fits:[f]}),Gfx.meshReferenceFits({fits:[f]})],T=meshes.flatMap(g=>Array.from(g.idx.slice(0,g.ni)).flatMap(k=>Array.from(g.pos.slice(k*3,k*3+3)))),b=C.fitAABB(f),authored=C.authoredTurretGeometry(f),fw=authored.fw;let tip=null;for(let i=0;i<T.length;i+=9){const points=[0,3,6].map(j=>T.slice(i+j,i+j+3)),p=[0,1,2].map(a=>(points[0][a]+points[1][a]+points[2][a])/3),score=C.dot(p,fw);if(C.len(C.cross(C.sub(points[1],points[0]),C.sub(points[2],points[0])))>1e-8&&(!tip||score>tip.score))tip={p,score};}if(!tip)return null;return {o:C.add(tip.p,C.mul(fw,25)),d:C.mul(fw,-1),tip:tip.p,score:tip.score,muzzle:Math.max(...authored.muzzles.map(p=>C.dot(p,fw))),bounds:b,inside:T.every((v,i)=>v>=b[i%3]-.002&&v<=b[i%3+3]+.002)};})()`);
 assert.ok(ray,'use the foremost nondegenerate triangle of the actual emitted weapon');assert.equal(ray.inside,true,'native bounds include every authored vertex');assert.ok(Math.abs(ray.score-ray.muzzle)<.002,'the selected visible lip lies on the actual muzzle plane');run(`previewRay=${JSON.stringify(plain(ray))}`);
 assert.ok(run('C.rayAABB(previewRay.o,previewRay.d,C.fitAABB(selItem()))'),'the real muzzle is inside the corrected native bounds');
 assert.equal(run('fitHit(previewRay.o,previewRay.d).fit.id'),run('selItem().id'));assert.equal(run('dragItemStart(0,0)'),true);assert.ok(run('dragSelStart(0,0,previewRay)'));
});

test('flush mounting guidance translates without Japanese fragments',()=>{
 const run=setup(),lang=vm.createContext({navigator:{language:'en-US'}});for(const f of ['js/lang-en.js','js/i18n.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),lang);
 run("st.fit='claser'");for(const text of run('fitPedestalControls()').split(/<[^>]*>/))if(text.trim()){const t=lang.KSI18n.t(text);assert.doesNotMatch(t,/[\u3040-\u30ff\u3400-\u9fff]/);assert.match(t,/pedestal/);}
 assert.doesNotMatch(lang.KSI18n.t('支持台なし・上'),/[\u3040-\u30ff\u3400-\u9fff]/);assert.match(lang.KSI18n.t('支持台なし・上'),/No Pedestal/);
});

test('upright slope placements preserve their automatic bases through mirrored placement, dragging and reuse',()=>{
 const run=setup();run(section('function seatFit(','function dragItemEnd('));run("ship=C.newShip({L:600,W:400,H:160,assembly:true},'Sloped top UI');ship.parts=[];ship.fits=[];ship.nextId=1;C.placePart(ship,'struct',[300,0,0],[560,300,80],{form:'box',pitch:18,roll:11},false);st.weaponMount='top';st.mirror=true;st.vmirror=true;st.ped=0;install('pd',60,250)");
 assert.equal(run('ship.fits.length'),4);
 for(const f of plain(run('ship.fits'))){assert.equal(f.mountMode,f.a===3?'bottom':'top');assert.ok(f.mountSupport?.top>0);assert.ok(C.turretSupportGeometry(f)?.volume>0);assert.equal(f.ped,0);}
 run("const top=ship.fits.find(f=>f.mountMode==='top');st.sel={list:'fits',id:top.id};st.weaponMount='auto';const hit=C.rayEnv(ship,[350,500,60],[0,-1,0],{structOnly:true});moveFitTo(top,hit.p,hit.n)");
 assert.equal(run('selItem().mountMode'),'top');assert.equal(run('selItem().tilt'),undefined);assert.ok(run('selItem().mountSupport.top')>0);
 run('carryToPlace()');assert.equal(run('st.weaponMount'),'top');assert.equal(run('st.template.data.mountMode'),undefined);assert.equal(run('st.template.data.mountSupport'),undefined);
 const newX=run('ship.fits[0].p[0]')>300?180:450;run(`st.mirror=false;st.vmirror=false;install('pd',-60,${newX})`);assert.equal(run('selItem().mountMode'),'top');assert.ok(run('selItem().mountSupport.top')>0);
 const saved=plain(run('C.serialize(ship)')),loaded=C.deserialize(saved);for(const f of loaded.fits){assert.ok(f.mountSupport);assert.equal(f.mountMode,f.a===3?'bottom':'top');assert.ok(C.turretSupportGeometry(f).volume>0);}
});
