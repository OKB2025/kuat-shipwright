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
 run("function slide(id,value){const t={dataset:{sl:id},value:String(value),min:'-100000',max:'100000'};for(const fn of listeners.input||[])fn({target:t});endDrag();}");
 run("function place(k,z,x){const h=C.rayEnv(ship,[x,500,z],[0,-1,0],{structOnly:true});if(!h)throw Error('No surface');const n=weaponPlacementNormal(k,h.n);const r=C.placeFit(ship,k,h.p,n,0,st.mirror,{tilt:weaponTiltMode(k)?C.fitTilt(n):null,mountMode:st.weaponMount});if(!r.fit)throw Error('Placement failed '+r.err);st.sel={list:'fits',id:r.fit.id};return r.fit;}");
 return run;
}

// User report 2026-11-11: the 前後 X / 左右 Z sliders of a placed gun on a sloped face moved it horizontally,
// off the face, and the editor refused the position. The panel move now slides along the mounting face.
function sloped(run,mount,mirror=true){
 run(`ship=C.newShip({L:600,W:400,H:160,assembly:true},'Slope slide');ship.parts=[];ship.fits=[];ship.nextId=1;C.placePart(ship,'struct',[300,0,110],[560,200,80],{form:'box',pitch:14,roll:9},true);st.weaponMount=${JSON.stringify(mount)};st.mirror=${mirror};st.vmirror=false;st.ped=0;place('stl',110,300)`);
}
const surface=(run,f)=>plain(run(`(()=>{const f=${f},u=C.norm(C.fitUp(f)),h=C.rayEnv(ship,C.add(f.p,C.mul(u,4)),C.mul(u,-1),{maxT:8,structOnly:true});return h?{d:C.len(C.sub(h.p,f.p)),host:h.part?.id,n:h.n}:null;})()`));
for(const mount of ['auto','top'])test(`fore/aft and port/starboard sliders keep a ${mount} gun and its twin seated on a sloped face`,()=>{
 const run=setup();sloped(run,mount);
 assert.equal(run('ship.fits.length'),2);run('st.sel={list:"fits",id:ship.fits[0].id};st.fitPairEdit=true');
 const host=surface(run,'selItem()').host,start=plain(run('selItem().p'));assert.ok(host!=null);
 assert.equal(run('selItem().float'),false);
 run(`slide('fitX',${start[0]+24})`);
 let f=plain(run('selItem()')),tw=plain(run('ship.fits.find(q=>q.id===selItem().tw)'));
 assert.equal(f.float,false,'moved fore/aft stays mountable');assert.ok(Math.abs(f.p[0]-(start[0]+24))<.5,'X follows the slider');
 assert.ok(Math.abs(f.p[1]-start[1])>2,'height follows the slope: '+(f.p[1]-start[1]));
 const s1=surface(run,'selItem()');assert.ok(s1&&s1.d<.05&&s1.host===host,'on the same face');
 assert.equal(tw.float,false);assert.ok(Math.abs(tw.p[0]-f.p[0])<.5&&Math.abs(tw.p[1]-f.p[1])<.5&&Math.abs(tw.p[2]+f.p[2])<.5,'twin mirrored');{const t=surface(run,'ship.fits.find(q=>q.id===selItem().tw)');assert.ok(t&&t.d<.05&&t.host!==host,'twin seated on the mirrored face');}
 const y1=f.p[1];run(`slide('fitZ',${f.p[2]+12})`);
 f=plain(run('selItem()'));tw=plain(run('ship.fits.find(q=>q.id===selItem().tw)'));
 assert.equal(f.float,false,'moved port/starboard stays mountable');assert.ok(Math.abs(f.p[2]-(start[2]+12))<.5);
 assert.ok(Math.abs(f.p[1]-y1)>.8,'roll changes the height across the face: '+(f.p[1]-y1));
 const s2=surface(run,'selItem()');assert.ok(s2&&s2.d<.05&&s2.host===host);
 assert.equal(tw.float,false);assert.ok(Math.abs(tw.p[2]+f.p[2])<.5&&Math.abs(tw.p[1]-f.p[1])<.5,'twin follows on the mirrored slope');{const t=surface(run,'ship.fits.find(q=>q.id===selItem().tw)');assert.ok(t&&t.d<.05,'twin seated');}
 // Leaving the face entirely is still refused.
 run(`slide('fitX',${start[0]+600})`);assert.equal(run('selItem().float'),true);
});
test('flat deck slider moves are unchanged and leaving the deck is still refused',()=>{
 const run=setup();run("st.weaponMount='auto';st.mirror=true;place('stl',60,250)");run('st.sel={list:"fits",id:ship.fits[0].id}');
 const start=plain(run('selItem().p'));run(`slide('fitX',${start[0]+30})`);
 const f=plain(run('selItem()'));assert.equal(f.float,false);assert.ok(Math.abs(f.p[0]-start[0]-30)<1e-6);assert.ok(Math.abs(f.p[1]-start[1])<1e-6);assert.ok(Math.abs(f.p[2]-start[2])<1e-6);
 run(`slide('fitZ',${start[2]+20})`);assert.ok(Math.abs(run('selItem().p[2]')-start[2]-20)<1e-6);assert.ok(Math.abs(run('selItem().p[1]')-start[1])<1e-6);
 run(`slide('fitX',${start[0]+5000})`);assert.equal(run('selItem().float'),true);
});
