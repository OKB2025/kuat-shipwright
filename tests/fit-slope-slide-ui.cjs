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
 run("function slide(id,value){const t={dataset:{sl:id},value:String(value),min:'-100000',max:'100000'};for(const fn of listeners.input||[])fn({target:t});endDrag();return t.value;}");
 run("function place(k,z,x,ped=0){const h=C.rayEnv(ship,[x,500,z],[0,-1,0],{structOnly:true});if(!h)throw Error('No surface');const n=weaponPlacementNormal(k,h.n);const opts={tilt:weaponTiltMode(k)?C.fitTilt(n):null,mountMode:st.weaponMount},r=C.placeFit(ship,k,h.p,n,ped,st.mirror,opts);if(!r.fit)throw Error('Placement failed '+r.err);placeVerticalFits(r.fit,k,ped,opts);st.sel={list:'fits',id:r.fit.id};return r.fit;}");
 return run;
}

// User report 2026-11-11: the 前後 X / 左右 Z sliders of a placed gun on a sloped face moved it horizontally,
// off the face, and the editor refused the position. The panel move now slides along the mounting face.
function sloped(run,mount,mirror=true,vmirror=false,ped=0){
 run(`ship=C.newShip({L:600,W:400,H:160,assembly:true},'Slope slide');ship.parts=[];ship.fits=[];ship.nextId=1;C.placePart(ship,'struct',[300,0,110],[560,200,80],{form:'box',pitch:14,roll:9},true);st.weaponMount=${JSON.stringify(mount)};st.mirror=${mirror};st.vmirror=${vmirror};st.ped=${ped};place('stl',110,300,${ped})`);
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
 // Leaving every surface is refused. CHANGED 2026-11-11 (fit move rework): the gun used to be moved off and
 // left floating (取り付け面を失った); a move with no surface under it now keeps the gun where it was.
 {const kept=plain(run('selItem().p'));run(`slide('fitX',${start[0]+600})`);assert.equal(run('selItem().float'),false);assert.deepEqual(plain(run('selItem().p')),kept);}
});
test('flat deck slider moves are unchanged and leaving the deck is refused without floating',()=>{
 const run=setup();run("st.weaponMount='auto';st.mirror=true;place('stl',60,250)");run('st.sel={list:"fits",id:ship.fits[0].id}');
 const start=plain(run('selItem().p'));run(`slide('fitX',${start[0]+30})`);
 const f=plain(run('selItem()'));assert.equal(f.float,false);assert.ok(Math.abs(f.p[0]-start[0]-30)<1e-6);assert.ok(Math.abs(f.p[1]-start[1])<1e-6);assert.ok(Math.abs(f.p[2]-start[2])<1e-6);
 run(`slide('fitZ',${start[2]+20})`);assert.ok(Math.abs(run('selItem().p[2]')-start[2]-20)<1e-6);assert.ok(Math.abs(run('selItem().p[1]')-start[1])<1e-6);
 // CHANGED 2026-11-11: refused moves keep the gun seated where it was instead of floating it.
 const kept=plain(run('selItem().p'));run(`slide('fitX',${start[0]+5000})`);assert.equal(run('selItem().float'),false);assert.deepEqual(plain(run('selItem().p')),kept);
});
const keep=f=>({id:f.id,p:f.p,n:f.n,host:f.host??null,hostSurfaceId:f.hostSurfaceId??null,tilt:f.tilt??null,float:!!f.float});
test('the slider shows the position the fitting actually reached',()=>{
 const run=setup();sloped(run,'auto');run('st.sel={list:"fits",id:ship.fits[0].id}');
 const start=plain(run('selItem().p')),shown=run(`slide('fitX',${start[0]+17.37})`);
 assert.ok(Math.abs(Number(shown)-run('selItem().p[0]'))<1e-3,'slider shows the reached X: '+shown);
});
// CHANGED 2026-11-11 (user requirement: no parent link, hull + structures are one surface set): the slide used to
// stop at another structure or a face turned by more than 10 degrees. It now crosses onto the ridge and seats on its top.
test('sliding onto a neighbouring higher structure or ridge re-seats the gun on it',()=>{
 const run=setup();sloped(run,'auto',false);run('st.sel={list:"fits",id:ship.fits[0].id}');
 const host=surface(run,'selItem()').host,start=plain(run('selItem().p'));
 run("C.placePart(ship,'struct',[395,0,110],[30,200,200],{form:'box'},false)");const ridge=run('ship.parts.at(-1).id');
 run(`slide('fitX',${start[0]+12})`);assert.equal(run('selItem().float'),false,'still on its own face before the ridge');
 assert.equal(surface(run,'selItem()').host,host);
 const shown=run(`slide('fitX',395)`),f=plain(run('selItem()'));
 assert.equal(f.float,false,'seated on the ridge');assert.ok(Math.abs(f.p[0]-395)<.5,'reached the ridge: '+f.p[0]);assert.ok(Math.abs(Number(shown)-f.p[0])<1e-3);
 const s=surface(run,'selItem()');assert.ok(s&&s.host===ridge&&s.d<.05,'on the ridge face');
 assert.ok(!f.tilt,'stands upright on the flat ridge top');
});
test('a vertical (bottom) twin follows a slope slide on the mirrored underside',()=>{
 const run=setup();sloped(run,'auto',false,true);assert.equal(run('ship.fits.length'),2);run('st.sel={list:"fits",id:ship.fits[0].id}');
 const vt0=plain(run('ship.fits.find(q=>q.id===selItem().vt)'));assert.ok(vt0&&!vt0.float);
 const start=plain(run('selItem().p'));run(`slide('fitX',${start[0]+20})`);
 const f=plain(run('selItem()')),vt=plain(run('ship.fits.find(q=>q.id===selItem().vt)'));
 assert.equal(f.float,false);assert.equal(vt.float,false,'vertical twin stays mounted');// The underside twin is re-probed along its tilted normal (existing pair logic), so it shifts by about the same X.
 assert.ok(Math.abs(vt.p[0]-vt0.p[0]-20)<5,'vertical twin follows fore/aft: '+(vt.p[0]-vt0.p[0]));
 assert.ok(Math.abs(vt.p[1]-vt0.p[1])>2,'vertical twin moved with its slope');const t=surface(run,'ship.fits.find(q=>q.id===selItem().vt)');assert.ok(t&&t.d<.05,'vertical twin seated');
});
test('a wall-mounted fitting slides along its wall at the same height',()=>{
 const run=setup();run("ship=C.newShip({L:600,W:400,H:160,assembly:true},'Wall');ship.parts=[];ship.fits=[];ship.nextId=1;C.placePart(ship,'struct',[300,0,0],[560,300,80],{form:'box'},false);st.weaponMount='auto';st.mirror=false;st.vmirror=false");
 const placed=run("(()=>{const b=C.partAABB(ship.parts[0]),y=(b[1]+b[4])/2,h=C.rayEnv(ship,[300,y,500],[0,0,-1],{structOnly:true});if(!h)return 'no wall';const n=weaponPlacementNormal('stl',h.n),r=C.placeFit(ship,'stl',h.p,n,0,false,{tilt:weaponTiltMode('stl')?C.fitTilt(n):null,mountMode:'auto'});if(!r.fit)return r.err;st.sel={list:'fits',id:r.fit.id};return 'ok';})()");
 assert.equal(placed,'ok');const start=plain(run('selItem().p'));assert.equal(run('selItem().float'),false);
 // CHANGED 2026-11-11: fitSurfaceSlideTarget was folded into the shared seat step (seatFitMove); a wall move still
 // keeps its height and depth.
 run(`slide('fitX',${start[0]+15})`);const f=plain(run('selItem()'));assert.equal(f.float,false);
 assert.ok(Math.abs(f.p[0]-start[0]-15)<1e-6&&Math.abs(f.p[1]-start[1])<1e-6&&Math.abs(f.p[2]-start[2])<1e-6);
});
test('one slider move is a single Undo step that restores both fits and Redo reproduces it',()=>{
 const run=setup();sloped(run,'auto');run('st.sel={list:"fits",id:ship.fits[0].id};undoStack.length=0;redoStack.length=0');
 const before=plain(run('ship.fits')).map(keep),start=before[0].p;
 run(`slide('fitX',${start[0]+18})`);const after=plain(run('ship.fits')).map(keep);
 assert.equal(run('undoStack.length'),1);assert.notDeepEqual(after,before);
 run('undo()');assert.deepEqual(plain(run('ship.fits')).map(keep),before);
 run('redo()');assert.deepEqual(plain(run('ship.fits')).map(keep),after);
});
test('a fitting on a pedestal slides along the slope and keeps its pedestal',()=>{
 const run=setup();sloped(run,'auto',true,false,6);run('st.sel={list:"fits",id:ship.fits[0].id}');
 const f0=plain(run('selItem()'));assert.equal(f0.float,false);
 run(`slide('fitX',${f0.p[0]+20})`);const f=plain(run('selItem()'));
 assert.equal(f.float,false);assert.equal(f.ped,f0.ped);assert.ok(Math.abs(f.p[0]-f0.p[0]-20)<.5);assert.ok(Math.abs(f.p[1]-f0.p[1])>2);
 const s=surface(run,'selItem()');assert.ok(s&&s.d<.05);
});
