const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',core),plain=v=>JSON.parse(JSON.stringify(v)),family=['single40','quad40Ion','twin40Dome','twin40','triple40','oct40','refVen','triple70','quad70Side'];
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
function setup(){
 const cx=vm.createContext({console,C,Gfx:G}),run=code=>vm.runInContext(code,cx);
 run(`let ship=C.newShip({L:500,W:300,H:120,plan:'rect',sec:'rect'},'Weapon family UI'),S=null;ship.parts=[];ship.fits=[];ship.nextId=1;
 const st={tab:'arm',fit:'single40',fitTool:'place',weaponMount:'auto',gunYaw:0,launchPitch:0,ped:0,pedShape:'round',pedSize:1,mirror:false,vmirror:false,fitPairEdit:true,sel:null,template:null,alignment:'none',multi:{parts:new Set(),fits:new Set()}},notes=[],undoStack=[],redoStack=[],listeners={};
 let dragSnap=null,dragLabel='',lastOp='',hoverLines=null;
 const num=(v,d=0)=>Number(v).toFixed(d),esc=String,fmtM=v=>v+' m',deg=v=>v+'°',fTT=v=>v+' TT',fPct=v=>Math.round(v*100)+'%',I18N=null;
 const panel={addEventListener:(type,fn)=>(listeners[type]||=[]).push(fn)},$=s=>s==='#panel'?panel:null,view=null,tool=()=> 'fit',activeEquipment=()=>null,findSel=s=>ship[s.list]?.find(q=>q.id===s.id),selItem=()=>st.sel?findSel(st.sel):null,curFit=()=>st.fit,twinOfItem=(list,p)=>ship[list].find(q=>q.id===p.tw);
 const sndEdit=()=>{},sndUI=()=>{},touch=()=>{},kickEngine=()=>{},scheduleStats=()=>{},updateUndo=()=>{},autosave=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},updateHint=()=>{},queuePreview=()=>{},showPreview=()=>{},refreshOverlay=()=>{},hideInspect=()=>{},updateName=()=>{},reconcileSolidCutter=()=>{},requestDraw=()=>{},syncHud=()=>{};
 const toast=s=>notes.push(s),packingInfoHTML=()=>'',fitPositionSliders=()=>'',fitPairHTML=()=>'',engineEditTarget=()=>null,CMD_LABEL='指揮',userParts=()=>[],upCat=String;
 function hit(n){return C.rayEnv(ship,C.add([250,60,0],C.mul(n,1000)),C.mul(n,-1),{structOnly:true});}
 function install(k='single40',n=[0,1,0]){st.fit=k;st.sel=null;const h=hit(n);if(!h)throw Error('Missing mount face');tapHit('fit',{...h,kind:'hull'},false);return selItem();}
 `);
 for(const [start,end]of [
  ['function seg(','function silhouette('],['const PART_KEYS =','const partOffered ='],['function baseFitEditor()','function partList('],
  ['function weaponYawControls(','function turretHeadingLines('],['function turretHeadingLines(','function aviationNumbers('],
  ['function snap()','function updateUndo('],['function assignMirror(','const TEMPLATE_SKIP ='],['const TEMPLATE_SKIP =','function removeWithPreview('],
  ['function placeVerticalFits(','function bind()'],['function alignFitPoint(','function tapWant('],['function tapHit(','// ---------- inspect ----------'],['function ghostFor(','function refreshOverlay('],['function bindReference(){','function packingInfoHTML('],['function paletteItems()','const palIcon='],['function fitPickHit(','function pick('],['function weaponSourcesHTML()','function bindReference(){']
 ])run(section(start,end));
 run('bindReference()');
 return run;
}

test('all nine photo families appear once in order, with twenty-nine physical barrels and no retired catalog entries',()=>{
 const run=setup();assert.deepEqual(plain(run('weaponKeys().slice(0,9)')),family);assert.equal(new Set(plain(run('weaponKeys()'))).size,run('weaponKeys().length'));assert.equal(family.reduce((n,k)=>n+C.FITS[k].barrels,0),29);
 for(const k of [...family,'quad500','pd','cmsl'])assert.equal(run(`weaponKeys().includes(${JSON.stringify(k)})`),true,k);
 for(const k of ['refSide','xx9','nk7']){assert.equal(run(`weaponKeys().includes(${JSON.stringify(k)})`),false,k);assert.equal(run(`paletteItems().some(i=>i.type==='fit'&&i.key===${JSON.stringify(k)})`),false,k);}
});

test('the real weapon-source table renders all nine families and legacy saved aliases normalize without dropping fittings',()=>{
 const run=setup(),html=run('weaponSourcesHTML()');assert.match(html,/<table/);assert.doesNotMatch(html,/undefined|NaN/);for(const k of family)assert.ok(html.includes(C.FITS[k].short),k+' is represented in the actual source table');
 run("const data=C.serialize(ship);data.fits=['refSide','xx9','nk7'].map((k,i)=>({id:91+i,k,p:[100+i*100,120,0],a:2,n:[0,1,0],ped:0,base:0,low:0}));ship=C.deserialize(data)");assert.deepEqual(plain(run('ship.fits.map(f=>[f.id,f.k])')),[[91,'twin40'],[92,'twin40'],[93,'quad40Ion']]);for(const f of plain(run('ship.fits'))){assert.ok(C.FITS[f.k]);assert.equal(C.fitSpec(f).barrels,C.FITS[f.k].barrels);}
});

test('hidden legacy guns stay out of catalogs while an existing saved htl remains editable and pickable',()=>{
 const run=setup();assert.equal(C.FITS.htl.catalogHidden,true);assert.equal(run("weaponKeys().includes('htl')"),false);assert.equal(run("paletteItems().some(i=>i.type==='fit'&&i.key==='htl')"),false);assert.equal(run("weaponReplacementKeys({k:'single40'}).includes('htl')"),false);
 run("install('htl');globalThis.legacyId=selItem().id;ship=C.deserialize(C.serialize(ship));st.sel={list:'fits',id:legacyId}");assert.equal(run('selItem().k'),'htl');assert.equal(!!run('selItem().float'),false);assert.equal(run('weaponReplacementKeys(selItem())[0]'),'htl');assert.match(run('baseFitEditor()'),/data-sl="gunYaw"/);
 const models=[G.meshFits(run('ship')),G.meshReferenceFits(run('ship'))];assert.ok(models.some(g=>g.ni>0));let ray;
 for(const model of models)for(let i=0;i<model.ni&&!ray;i+=3){const points=Array.from(model.idx.slice(i,i+3),k=>Array.from(model.pos.slice(k*3,k*3+3))),normal=C.cross(C.sub(points[1],points[0]),C.sub(points[2],points[0]));if(C.len(normal)>1e-6){const dir=C.norm(normal),mid=points.reduce((sum,p)=>C.add(sum,C.mul(p,1/3)),[0,0,0]);ray={o:C.add(mid,C.mul(dir,2)),d:C.mul(dir,-1)};}}
 assert.ok(ray);const picked=run(`fitHit(${JSON.stringify(ray.o)},${JSON.stringify(ray.d)})`);assert.ok(picked?.fit);assert.equal(picked.fit.k,'htl');assert.equal(picked.fit.id,run('legacyId'));run(`tapHit('adjust',fitHit(${JSON.stringify(ray.o)},${JSON.stringify(ray.d)}),false)`);assert.equal(run('selItem().k'),'htl');
 run('ship.hull.L=10');assert.equal(run("weaponKeys().includes('htl')"),false,'compact craft catalogs honor the same hidden flag');
});

test('actual wall-only placement rejects deck and bow taps before creating an Undo transaction',()=>{
 const run=setup();assert.equal(typeof C.weaponMountAllowed,'function');
 for(const n of [[0,1,0],[0,-1,0],[1,0,0],[-1,0,0]]){run(`st.fit='quad70Side';tapHit('fit',{kind:'hull',p:[250,120,100],n:${JSON.stringify(n)}},false)`);assert.equal(run('ship.fits.length'),0);assert.equal(run('undoStack.length'),0);assert.equal(run('notes.at(-1)'),'この砲は左右の舷側面に配置してください');}
 for(const n of [[0,0,1],[0,0,-1]]){const fresh=setup();fresh(`install('quad70Side',${JSON.stringify(n)})`);assert.equal(fresh('ship.fits.length'),1);assert.equal(fresh('selItem().float'),false);assert.equal(fresh('undoStack.length'),1);}
 run("install('single40');undoStack.length=0;for(const fn of listeners.change||[])fn({target:{dataset:{refweapon:''},value:'quad70Side'}})");assert.equal(run('selItem().k'),'single40','replacing a deck turret with the wall-only model is rejected before changing the gun');assert.equal(run('undoStack.length'),0);
 run("ship.fits=[{id:77,k:'quad70Side',p:[250,120,100],a:2,ped:0,base:0,low:0,float:true}];st.sel={list:'fits',id:77}");assert.match(run('baseFitEditor()'),/data-weapon-mount-error>この砲は左右の舷側面に配置してください/);assert.equal(run('ship.fits[0].id'),77,'a loaded invalid fit remains available to relocate');
});

test('wall-only placement previews reject the same normal and mount controls retain the chosen side gun',()=>{
 const run=setup();run("st.fit='quad70Side';st.weaponMount='top'");assert.deepEqual(plain(run('weaponPlacementNormal(st.fit,[0,0,1])')),[0,0,1],'a stale top-mount preference cannot rotate the side gun onto a deck');
 const html=run('weaponMountControls()');assert.doesNotMatch(html,/data-weaponmount="(?:top|bottom)"/);assert.match(html,/左右の舷側面/);assert.doesNotMatch(html,/newGunYaw/);
 run("chooseWeaponMount('top')");assert.equal(run('st.fit'),'quad70Side');assert.equal(run('notes.at(-1)'),'この砲は左右の舷側面に配置してください');
 run("chooseWeaponMount('casemate')");assert.equal(run('st.fit'),'quad70Side','the mount selector must not replace this gun with an older casemate');
 const preview=run("ghostFor({kind:'hull',p:[250,120,100],n:[0,1,0]}).out()");assert.deepEqual(Array.from(preview.col.slice(0,4)),[236,106,92,255]);assert.ok(Array.from(preview.pos).every(Number.isFinite),'a rejected mount still produces a finite preview');
});

test('ordinary guns place flush without automatic riser geometry while missile pitch retains its explicit support',()=>{
 for(const k of family){const run=setup();run(`install(${JSON.stringify(k)},${JSON.stringify(k==='quad70Side'?[0,0,1]:[0,1,0])})`);for(const key of ['ped','base','low'])assert.equal(run(`selItem().${key}`),0,k+' '+key);assert.equal(run('Gfx.meshFits(ship).ni+Gfx.meshReferenceFits(ship).ni'),C.REFERENCE_ASSETS[C.FITS[k].asset].faces*3,k+' draws only its authored weapon mesh');}
 const run=setup();
 run("st.fit='cmsl';st.launchPitch=35");assert.match(run('fitPedestalControls()'),/発射角に合わせて自動生成/);assert.match(run('launcherPitchControls()'),/data-sl="newLaunchPitch"/);
});

function value(html,key){const match=html.match(new RegExp('data-turret-volume="'+key+'">([^<]+)'));assert.ok(match,key);return match[1];}
test('the selected-gun card separates exterior and embedded housing from pending additional allocation',()=>{
 const run=setup();assert.equal(typeof C.turretCompartment,'function');run("install('single40');selItem().chargeScale=4;selItem().chargeSalvos=20;globalThis.ledger=C.turretCompartment(ship,selItem())");
 const q=plain(run('ledger')),html=run('turretCompartmentHTML(selItem())');assert.ok(q.housingVolume>0);assert.ok(q.externalVolume>0);assert.ok(q.plannedVolume>q.required);assert.ok(q.internalRequired>0,'the requested reserve needs an additional internal bank');assert.equal(q.allocationPending,true);
 for(const key of ['required','plannedVolume','housingVolume','externalVolume','embeddedVolume','housingUsed','internalRequired'])assert.equal(value(html,key),q[key].toFixed(1)+' m³',key);
 for(const key of ['internalVolume','internalOccupiedVolume','volume'])assert.equal(value(html,key),'計算中…');assert.match(html,/0\.05 TT\/m³/);assert.doesNotMatch(html,/0\.08 TT\/m³/);
 assert.equal(value(run('turretCompartmentHTML(selItem())'),'internalVolume'),'計算中…','rendering the card again must not create an allocated charging bank');
});

test('the selected-gun card reports actual stats allocation and hides an unnecessary internal depth control',()=>{
 const run=setup();run("install('single40');S=C.computeStats(ship);globalThis.ledger=S.chargeInfo[selItem().id]");const q=plain(run('ledger')),html=run('turretCompartmentHTML(selItem())');
 for(const key of ['required','housingUsed','internalRequired','internalVolume','internalOccupiedVolume','volume'])assert.equal(value(html,key),q[key].toFixed(1)+' m³',key);
 assert.equal(/data-sl="chargeDepth"/.test(html),q.internalRequired>1e-6);assert.ok(Math.abs(q.volume-q.housingUsed-q.internalVolume)<1e-6,'displayed external and internal values reconcile to the functional total');
 assert.ok(Math.abs(q.internalOccupiedVolume-q.embeddedVolume-q.internalVolume)<1e-6,'the embedded room remains physically reserved in addition to the extra bank');
});
