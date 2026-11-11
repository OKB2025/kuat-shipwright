const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..','..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),context=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,Gfx}=vm.runInContext('({C:Core,Gfx})',context),plain=v=>JSON.parse(JSON.stringify(v));
function section(start,end,source=app){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);}
function setup(){
 const box=vm.createContext({console,C,Gfx,performance}),run=code=>vm.runInContext(code,box);
 run(section('\nconst st = {','\nst.group='));
 run(`
 let ship=C.newShip({L:500,W:300,H:120,plan:'rect',sec:'rect'},'Pedestal UI');ship.parts=[];ship.fits=[];ship.nextId=1;
 Object.assign(st,{tab:'arm',weaponMount:'auto',gunYaw:0,alignment:'none',vmirror:false,fitPairEdit:true,mirror:false,multi:{parts:new Set(),fits:new Set()}});
 const listeners={},undoStack=[],redoStack=[],outputs=new Map(),fleet={mode:'design'},meshStore={};let dragSnap=null,dragLabel='',lastOp='',hoverLines=null,previewRay=null;
 let S=null,prevS=null,editorPartsRevision=0;const eng={gen:0,adoptedGen:0,geoGen:0,statsGen:0,ready:false};
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
 ['function enginePending()','function engineStatus('],['const requestedParts =','function editorRayEnv('],['function previewHistory(','// Exterior view skips machinery'],
 ['function seg(','function silhouette('],['function baseFitEditor()','function partList('],
 ['function weaponYawControls(','function turretHeadingLines('],['function weaponTiltMode(','function chooseWeaponMount('],
 ['function snap(','function updateUndo('],['function assignMirror(','const TEMPLATE_SKIP ='],
 ['const TEMPLATE_SKIP =','function removeWithPreview('],['function placeVerticalFits(','function bind()'],
 ['function alignFitPoint(','function tapWant('],['function tapHit(','// ---------- inspect ----------'],
 ['function copyWingLinks(','function multiMove('],['function fitPickHit(','function pick('],['let itemDrag =','function dragSupportY('],['function dragSelStart(','function dragSelMove(']
 ])run(section(start,end));
 run(app.split('\n').find(line=>line.startsWith('function curFit(')));
 const bind=app.slice(app.indexOf('function bind()'));
 run(section("  $('#panel').addEventListener('click', e => {",'  // HUD',bind));
 run('const trenchArmamentInput=()=>false,designPlacementActive=()=>false;');
 run(section("  $('#panel').addEventListener('input',e=>{\n    if(trenchArmamentInput(e.target))return;","  $('#sheet').addEventListener('click',e=>{const b=e.target.closest('[data-reference]')"));
 run(section('function editorPickShip(','const editorEngineBounds'));
 run(section('function seatFit(','function dragItemEnd('));
 // New guns are placed with the options tapHit passes (the shared tapHit harness above is currently broken
 // on main: designPlacementActive / n are undefined in its sandbox).
 run("function slide(id,value){const t={dataset:{sl:id},value:String(value),min:'-100000',max:'100000'};for(const fn of listeners.input||[])fn({target:t});endDrag();return t.value;}");
 run("function place(k,z,x,ped=0){const h=C.rayEnv(ship,[x,500,z],[0,-1,0],{structOnly:true});if(!h)throw Error('No surface');const n=weaponPlacementNormal(k,h.n);const opts={tilt:weaponTiltMode(k)?C.fitTilt(n):null,mountMode:st.weaponMount},r=C.placeFit(ship,k,h.p,n,ped,st.mirror,opts);if(!r.fit)throw Error('Placement failed '+r.err);placeVerticalFits(r.fit,k,ped,opts);st.sel={list:'fits',id:r.fit.id};return r.fit;}");
 return run;
}


function exampleDesign(key){return JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz'))));}
module.exports={C,Gfx,plain,setup,exampleDesign,root};
