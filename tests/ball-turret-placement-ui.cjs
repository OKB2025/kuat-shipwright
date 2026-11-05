const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),balls=['quad40Ion','single500','ball175TripleIon','ball175Quad','ball175QuadIon','ball720'],plain=v=>JSON.parse(JSON.stringify(v));
function near(a,b,eps=2e-6){if(Array.isArray(a)){assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],eps));}else assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);}
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const context=vm.createContext({console,RawCore:C});vm.runInContext(`
 let previewFit=null,previewPose=null;const C={...RawCore,mountFit(...args){const f=RawCore.mountFit(...args);previewFit=f;return f;}};
 let ship=C.newShip({L:600,W:400,H:160,plan:'rect',sec:'rect'},'Ball turret placement');ship.parts=[];ship.fits=[];ship.nextId=1;
 const st={tab:'arm',fit:'ball720',fitTool:'place',weaponMount:'auto',gunYaw:0,gunPitch:0,ped:0,pedShape:'round',pedSize:1,mirror:false,vmirror:false,fitPairEdit:true,sel:null,template:null,alignment:'none'},listeners={},undoStack=[],redoStack=[],outputs=new Map(),meshStore={},previews=[];
 let dragSnap=null,dragLabel='',lastOp='',hoverLines=null,draws=0;
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,fmtM=v=>v+' m',deg=v=>v+'°',I18N=null;
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=s=>s==='#panel'?panel:s.startsWith('#out-')?(outputs.has(s)||outputs.set(s,{}),outputs.get(s)):null;
 const activeEquipment=()=>null,findSel=s=>ship[s.list]?.find(q=>q.id===s.id),selItem=()=>st.sel?findSel(st.sel):null,twinOfItem=(list,p)=>ship[list].find(q=>q.id===p.tw);
 const sndEdit=()=>{},sndUI=()=>{},touch=()=>{},kickEngine=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},queuePreview=(list,rows)=>previews.push(rows.map(f=>f.id)),showPreview=()=>{},refreshOverlay=()=>{},hideInspect=()=>{},updateName=()=>{},reconcileSolidCutter=()=>{},requestDraw=()=>draws++;
 const toast=()=>{},fitPositionSliders=()=>'',fitPairHTML=()=>'',engineEditTarget=()=>null,tool=()=>'fit';
 const Gfx={lineSet:()=>({boxes:[],segments:[],box(b,c){this.boxes.push(b);},seg(a,b,c){this.segments.push([a,b]);}})};
 const publicCopy=o=>JSON.parse(JSON.stringify(o,(k,v)=>k&&k[0]==='_'?undefined:v));
 function input(id,value,finish=true){const t={dataset:{sl:id},value:String(value),min:id.includes('Pitch')?'-90':'-180',max:id.includes('Pitch')?'90':'180'};for(const fn of listeners.input)fn({target:t});if(finish)for(const fn of listeners.change)fn({target:t});}
 function change(dataset,value){for(const fn of listeners.change)fn({target:{dataset,value}});}
 function install(k=st.fit,z=75,x=300,preview=false){st.fit=k;st.sel=null;const h=C.rayEnv(ship,[x,500,z],[0,-1,0],{structOnly:true});if(!h)throw Error('No surface');const hit={...h,kind:'hull'};if(preview){ghostFor(hit);previewPose=publicCopy(previewFit);}tapHit('fit',hit,false);if(!selItem())throw Error('Placement failed '+k);return selItem();}
 `,context);
 for(const [start,end]of [
 ['function seg(','function silhouette('],['function baseFitEditor()','function partList('],
 ['function weaponYawControls(','function turretHeadingLines('],['function turretHeadingLines(','function chooseWeaponMount('],
 ['function bindReference(){','function packingInfoHTML('],['function snap()','function updateUndo('],
 ['function assignMirror(','const TEMPLATE_SKIP ='],['const TEMPLATE_SKIP =','function removeWithPreview('],
 ['function placeVerticalFits(','function bind()'],['function alignFitPoint(','function tapWant('],
 ['function tapHit(','// ---------- inspect ----------'],['function ghostFor(','function refreshOverlay('],
 ['function seatFit(','function moveFitTo('],['const r6=','function xfPartOut('],['function xfFitForward(','// UI-002/003/004']
 ])vm.runInContext(section(start,end),context);
 vm.runInContext(app.split('\n').find(line=>line.startsWith('function curFit(')),context);
 vm.runInContext('bindReference()',context);return code=>vm.runInContext(code,context);
}

test('native placement and selected controls expose horizontal and vertical ball angles only for full balls',()=>{
 const run=setup();for(const k of balls){run(`st.fit=${JSON.stringify(k)}`);const fresh=run('weaponYawControls()');assert.match(fresh,/data-ball-turret-pitch/);assert.match(fresh,/data-sl="newGunYaw"/);assert.match(fresh,/data-sl="newGunPitch" min="-90" max="90" step="0\.1"/);
  run(`ship.fits=[{id:1,k:${JSON.stringify(k)},p:[300,80,75],a:2,ped:0,base:0,assetYaw:32.125,assetPitch:-42.5}];st.sel={list:'fits',id:1}`);assert.match(run('baseFitEditor()'),/data-sl="gunPitch"[^>]*value="-42\.5"/);
 }
 for(const k of ['stl','ion','utl','triple70','twin40','oct40','quad200','cmsl']){run(`st.fit=${JSON.stringify(k)}`);assert.doesNotMatch(run('weaponYawControls()'),/GunPitch|gunPitch|data-ball-turret-pitch/);}
 assert.doesNotMatch(run("weaponYawControls({k:'ball720',surfacePatch:'patch-1'})"),/gunPitch|data-ball-turret-pitch/);
});

test('real preview and placement handlers use identical clamped angles, muzzles and unchanged mount normals',()=>{
 const run=setup();for(const k of balls){run(`ship.fits=[];st.template=null;st.fit=${JSON.stringify(k)};input('newGunYaw',-42.125);input('newGunPitch',35.75);install(st.fit,75,300,true)`);
  assert.equal(run('selItem().assetYaw'),-42.125,k);assert.equal(run('selItem().assetPitch'),35.75,k);assert.equal(run('selItem().float'),false,k);
  near(plain(run('C.authoredTurretGeometry(previewPose).muzzles')),plain(run('C.authoredTurretGeometry(selItem()).muzzles')));near(plain(run('C.authoredTurretGeometry(previewPose).fw')),plain(run('C.authoredTurretGeometry(selItem()).fw')));near(plain(run('C.fitUp(selItem())')),[0,1,0]);near(plain(run('selItem().n||C.AXES[selItem().a]')),[0,1,0]);
 }
 run("st.fit='ball720';input('newGunPitch',500)");assert.equal(run('st.gunPitch'),90);run("input('newGunPitch',-500)");assert.equal(run('st.gunPitch'),-90);run("input('newGunPitch','');input('newGunPitch','NaN')");assert.equal(run('st.gunPitch'),-90);assert.ok(run('draws')>0);
});

test('a native pitch drag produces one Undo and retains pose through Redo and blueprint loading',()=>{
 const run=setup();run("install();undoStack.length=0;input('gunPitch',15.5,false);input('gunPitch',67.75)");assert.equal(run('selItem().assetPitch'),67.75);assert.equal(run('undoStack.length'),1);assert.equal(run('dragSnap'),null);assert.ok(run('previews.length')>=2);
 run('undo()');assert.equal(run('C.ballTurretPitch(selItem())'),0);run('redo()');assert.equal(run('selItem().assetPitch'),67.75);assert.equal(run('C.deserialize(C.serialize(ship)).fits[0].assetPitch'),67.75);
 run("input('gunPitch',135)");assert.equal(run('selItem().assetPitch'),90);run("input('gunPitch',-135)");assert.equal(run('selItem().assetPitch'),-90);run("input('gunPitch','');input('gunPitch','NaN')");assert.equal(run('selItem().assetPitch'),-90);
});

test('left-right and top-bottom copies retain relative pitch and reflect yaw in placement and live editing',()=>{
 const run=setup();run("st.mirror=true;st.vmirror=true;input('newGunYaw',37.125);input('newGunPitch',28.5);install('ball720',100)");assert.equal(run('ship.fits.length'),4);
 for(const row of plain(run('ship.fits.map(q=>({id:q.id,y:q.p[1],z:q.p[2],yaw:q.assetYaw,pitch:q.assetPitch}))'))){near(row.pitch,28.5);const sign=(row.y<run('selItem().p[1]')?-1:1)*(row.z<0?-1:1);near(row.yaw,sign*37.125);}
 run("input('gunPitch',-51.25);input('gunYaw',-54.375)");for(const row of plain(run('ship.fits.map(q=>({id:q.id,y:q.p[1],z:q.p[2],yaw:q.assetYaw,pitch:q.assetPitch}))'))){near(row.pitch,-51.25);const sign=(row.y<run('selItem().p[1]')?-1:1)*(row.z<0?-1:1);near(row.yaw,sign*-54.375);}
 run("st.fitPairEdit=false;input('gunPitch',12.25)");const id=run('selItem().id');for(const row of plain(run('ship.fits.map(q=>({id:q.id,pitch:q.assetPitch}))')))near(row.pitch,row.id===id?12.25:-51.25);
});

test('copy into placement preserves pitch while templates cannot override a later chosen angle',()=>{
 const run=setup();run("install('ball175Quad',75,200);input('gunYaw',-61.125);input('gunPitch',32.25);carryToPlace()");assert.equal(run('st.gunYaw'),-61.125);assert.equal(run('st.gunPitch'),32.25);assert.equal(run('st.template.data.assetPitch'),undefined);assert.match(run('weaponYawControls()'),/data-sl="newGunPitch"[^>]*value="32\.25"/);
 run("install(st.fit,75,350);carryToPlace();input('newGunPitch',-22.5);install(st.fit,-75,350)");near(plain(run('ship.fits.map(q=>C.ballTurretPitch(q))')),[32.25,32.25,-22.5]);
 run("const noPitch={...selItem()};delete noPitch.assetPitch;copyFitSettings(noPitch,selItem())");assert.equal(run('C.ballTurretPitch(selItem())'),0);
});

test('stale pitch controls cannot rotate nonballs or surface ports and weapon replacement clears the ball pose',()=>{
 const run=setup();for(const f of [{k:'stl'},{k:'twin40'},{k:'quad200'},{k:'ball720',surfacePatch:'patch-1'}]){run(`ship.fits=[{id:1,p:[300,80,75],n:[0,1,0],a:2,ped:0,base:0,...${JSON.stringify(f)}}];st.sel={list:'fits',id:1};input('gunPitch',75)`);assert.equal(run('selItem().assetPitch'),undefined);}
 run("ship.fits=[];install('ball720');input('gunPitch',42.5);change({refweapon:''},'triple70')");assert.equal(run('selItem().k'),'triple70');assert.equal(run('selItem().assetPitch'),undefined);
 for(const k of ['triple70','oct40','cmsl']){run(`st.fit=${JSON.stringify(k)};st.gunPitch=0;input('newGunPitch',45)`);assert.equal(run('st.gunPitch'),0);}
});

test('rigid group rotations preserve aimed ball directions including pitch, mirrored followers and the fixed mounting normal',()=>{
 const run=setup();for(const k of balls)for(const pitch of [-90,-36.25,0,54.5,90])for(const axis of [0,1,2]){
  run(`(()=>{ship.fits=[];st.mirror=false;st.vmirror=false;st.gunYaw=23.5;st.gunPitch=${pitch};install(${JSON.stringify(k)});const f=selItem(),R=xfRot(${axis},41),d={list:'fits',it:f,fol:[]};globalThis.before=publicCopy(f);globalThis.expectedFw=R(C.authoredTurretGeometry(f).fw);globalThis.expectedUp=R(C.fitUp(f));globalThis.out=xfRows([d],[{drivers:[d]}],()=>({pt:p=>p.slice(),R})).rows[0].out;})()`);
  near(plain(run('C.authoredTurretGeometry(out).fw')),plain(run('expectedFw')));near(plain(run('C.fitUp(out)')),plain(run('expectedUp')));assert.deepEqual(plain(run('selItem()')),plain(run('before')),'rotation preview leaves the source untouched');
 }
 run("ship.fits=[];st.mirror=true;st.vmirror=true;st.gunPitch=31.5;st.gunYaw=-27.25;install('ball175Quad',100);const driver=selItem(),links=fitLinks(driver),R=xfRot(2,34),d={list:'fits',it:driver,fol:links.map(l=>({it:l.fit,y:l.y,z:l.z}))};globalThis.rows=xfRows([d],[{drivers:[d]}],()=>({pt:p=>p.slice(),R})).rows;globalThis.aim=R(C.authoredTurretGeometry(driver).fw)");
 for(let i=0;i<4;i++){const link=i?plain(run(`links[${i-1}]`)):null;let expected=plain(run('aim'));if(link?.y)expected=[expected[0],-expected[1],expected[2]];if(link?.z)expected=[expected[0],expected[1],-expected[2]];near(plain(run(`C.authoredTurretGeometry(rows[${i}].out).fw`)),expected);}
});
