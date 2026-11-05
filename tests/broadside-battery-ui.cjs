const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const core=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),core,{filename:file});
const C=vm.runInContext('Core',core),plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const timers=[],cx=vm.createContext({console,C,setTimeout:fn=>{timers.push(fn);return timers.length;}}),run=source=>vm.runInContext(source,cx);
 const section=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));};
 section('const PART_KEYS =','const partOffered =');
 run(`
 let ship=C.newShip({assembly:true,L:200,W:160,H:80},'Broadside UI'),S=null,prevS=null,dragSnap=null,dragLabel='',lastOp='',hoverLines=null;
 ship.parts=[];ship.fits=[];ship.saveId='broadside-ui-save';
 const st={fit:'broadsideBattery',fitTool:'place',tab:'arm',weaponMount:'auto',batteryCaliber:'40TT',batteryGuns:2,fitPairEdit:true,sel:null,mirror:false,vmirror:false,ped:0,alignment:'none'},live={active:false},dirty={},undoStack=[],redoStack=[],posts=[],statRequests=[],listeners={},notices=[];
 const panel={addEventListener:(kind,fn)=>(listeners[kind]||=[]).push(fn)},$=id=>id==='#panel'?panel:null;
 const num=(v,n=0)=>Number(v).toFixed(n),fTT=v=>v<1?Number(v*1000).toFixed(0)+' GT':Number(v)+' TT',fPct=v=>Math.round(v*100)+'%',fW=v=>String(v),esc=String,fmtM=v=>v+' m',I18N=null;
 const YardEngineClient={post:msg=>posts.push(msg)},sndEdit=()=>{},sndUI=()=>{},toast=msg=>notices.push(msg),queuePreview=()=>{},renderPanel=()=>{},updateHint=()=>{},refreshOverlay=()=>{},hideInspect=()=>{},updateName=()=>{},updateUndo=()=>{},autosave=()=>{},engineStatus=()=>{},reconcileSolidCutter=()=>{},scheduleStats=delay=>statRequests.push(delay);
 const findSel=sel=>ship[sel.list].find(f=>f.id===sel.id),selItem=()=>st.sel?findSel(st.sel):null,curFit=()=>st.fit;
 function change(field,value,target='new'){const node={dataset:{[field]:true,batteryTarget:target},value:String(value)};for(const fn of listeners.change||[])fn({target:node});}
 function bay(id=1,extra={}){return {id,k:'broadsideBattery',p:[40,15,20],a:4,n:[0,0,1],ped:0,base:0,low:0,float:false,batteryCaliber:'200GT',batteryGuns:6,...extra};}
 `);
 section('const eng = {','function enginePending()');
 section('function snap()','function updateUndo()');
 section('function fitLinks(','const PED_SHAPES =');
 section('function broadsidePlacementFit()','function turretCompartmentHTML(');
 section('function bindReference(){','function packingInfoHTML(');
 run('eng.ready=true;bindReference()');
 const flush=()=>{while(timers.length)timers.shift()();};
 return{run,flush};
}

test('the ordinary weapon catalog contains each merged weapon once and exposes one side battery compartment',()=>{
 const {run}=setup(),keys=plain(run('weaponKeys()'));
 for(const key of ['broadsideBattery','quad200','refVen','pd'])assert.equal(keys.filter(k=>k===key).length,1,key);
 for(const key of ['mtl','htl','ltl','casemateMid','casemateLight','casemateIon','casemateIonL'])assert.equal(keys.includes(key),false,key);
 assert.equal(C.FITS.pd.barrels,2);assert.equal(C.FITS.pd.boltTT,.02);assert.equal(C.FITS.pd.tt,.04);
 run(app.split('\n').find(line=>line.startsWith('function surfaceWeaponChoices(')));assert.equal(run('surfaceWeaponChoices().some(([k])=>k==="broadsideBattery")'),false,'configurable structural bays are placed through their own controls');
});

test('new battery controls enforce the caliber-specific count without preparing or editing the ship',()=>{
 const {run,flush}=setup();run("st.template={keep:'old template'};change('batteryCaliber','200GT');change('batteryGuns','6')");
 assert.equal(run('st.batteryGuns'),6);assert.match(run('broadsideBatteryControls()'),/value="6" selected/);
 run("change('batteryCaliber','70TT')");assert.equal(run('st.batteryGuns'),2);assert.equal(run('st.batteryCaliber'),'70TT');
 const html=run('broadsideBatteryControls()');assert.match(html,/value="2" selected/);assert.doesNotMatch(html,/option value="[3-6]"/);assert.match(html,/140 TT/);assert.match(html,/構造物の側面/);assert.doesNotMatch(html,/NaN|undefined/);
 assert.equal(run('st.template'),null);assert.equal(run('ship.fits.length'),0);assert.equal(run('undoStack.length'),0);assert.equal(run('eng.gen'),0);flush();assert.equal(run('posts.length'),0);
});

test('actual change handlers clamp linked batteries, queue the worker and retain undo, redo, identities and positions',()=>{
 const {run,flush}=setup();run("ship.fits=[bay(1,{tw:2}),bay(2,{tw:1,p:[40,15,-20],a:5,n:[0,0,-1]})];st.sel={list:'fits',id:1};const before=ship.fits.map(f=>({id:f.id,p:f.p.slice()}));change('batteryCaliber','40TT','selected')");
 assert.deepEqual(plain(run('ship.fits.map(f=>[f.batteryCaliber,f.batteryGuns])')),[['40TT',2],['40TT',2]]);
 assert.deepEqual(plain(run('ship.fits.map(f=>({id:f.id,p:f.p}))')),plain(run('before')));assert.equal(run('ship.saveId'),'broadside-ui-save');assert.equal(run('undoStack.length'),1);assert.equal(run('eng.gen'),1);assert.equal(run('statRequests.length'),1);
 flush();assert.equal(run('posts.length'),1);assert.equal(run('posts[0].what.includes("fits")'),true);assert.equal(JSON.parse(run('posts[0].state')).fits[0].batteryGuns,2);
 run('undo()');assert.deepEqual(plain(run('ship.fits.map(f=>[f.batteryCaliber,f.batteryGuns])')),[['200GT',6],['200GT',6]]);assert.equal(run('ship.saveId'),'broadside-ui-save');
 run('redo()');assert.deepEqual(plain(run('ship.fits.map(f=>[f.batteryCaliber,f.batteryGuns])')),[['40TT',2],['40TT',2]]);assert.deepEqual(plain(run('ship.fits.map(f=>({id:f.id,p:f.p}))')),plain(run('before')));
});

test('invalid caliber controls cannot change selected inventory or a different weapon',()=>{
 const {run}=setup();run("ship.fits=[bay()];st.sel={list:'fits',id:1};const before=C.publicJSON(ship);change('batteryCaliber','1000TT','selected');change('batteryGuns','not-a-number','selected')");
 assert.equal(run('C.publicJSON(ship)'),run('before'));assert.equal(run('undoStack.length'),0);assert.equal(run('eng.gen'),0);
 run("ship.fits[0].k='pd';const other=C.publicJSON(ship);change('batteryCaliber','70TT','selected')");assert.equal(run('C.publicJSON(ship)'),run('other'));assert.equal(run('eng.gen'),0);
});

test('placement options preserve the real structural host and the selected count, and side picking includes structures',()=>{
 const {run}=setup();run("st.batteryCaliber='500GT';st.batteryGuns=6");
 assert.deepEqual(plain(run('broadsidePlacementOptions({part:{id:72}})')),{batteryCaliber:'500GT',batteryGuns:6,host:72,localMount:true});
 const a=app.indexOf('function tapWant(t)'),b=app.indexOf('function tapHit(',a);run(app.slice(a,b));assert.equal(run('tapWant("fit").parts'),true);
 run("st.fit='refVen'");assert.equal(run('tapWant("fit").parts'),false);
});

test('copying and placing a saved battery template retains its chosen gun inventory for both linked bays',()=>{
 const {run}=setup();
 run(app.split('\n').find(line=>line.startsWith('function copyFitSettings(')));
 run("const original=bay(1,{batteryCaliber:'500GT',batteryGuns:6}),copy=bay(2,{batteryCaliber:'40TT',batteryGuns:2});copyFitSettings(original,copy)");
 assert.equal(run('copy.batteryCaliber'),'500GT');assert.equal(run('copy.batteryGuns'),6);
 for(const [start,end]of [['const FIT_TEMPLATE_KEYS =','function templateFor('],['function activeTemplate(','function carryToPlace('],['function applyFitTemplate(','function applyPedDefaults(']]){const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a);run(app.slice(a,b));}
 run("const linkedItems=()=>ship.fits;ship.fits=[bay(1,{batteryCaliber:'40TT',batteryGuns:2}),bay(2,{batteryCaliber:'40TT',batteryGuns:2})];st.template={list:'fits',k:'broadsideBattery',data:{batteryCaliber:'200GT',batteryGuns:6}};applyFitTemplate(ship.fits[0])");
 assert.deepEqual(plain(run('ship.fits.map(f=>[f.batteryCaliber,f.batteryGuns])')),[['200GT',6],['200GT',6]]);
 assert.deepEqual(plain(run('JSON.parse(C.publicJSON(ship)).fits.map(f=>[f.batteryCaliber,f.batteryGuns])')),[['200GT',6],['200GT',6]]);
});

function installCombat(run){
 run(`const trial={P:[100,200,300],R:[0,0,1,0,1,0,-1,0,0],asset:{geometry:{center:[25,10,3]}},battle:{E:[1,0,0,0,1,0,0,0,1]}},fleet={assets:new Map()},tv={add:(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),sub:C.sub,norm:C.norm,cross:C.cross};
 const spaceRotU=(e,u)=>u.rot||e,spaceWorld=u=>u.pos,spaceHullPoint=()=>[-999,-999,-999],unitFoilDeployments=()=>({});
 const Gfx={foilTransform:()=>({point:p=>[p[0]+2,p[1]+3,p[2]-4],direction:v=>v})};
 const fixtureFit=bay(7,{p:[40,15,20]}),mouths=C.broadsideBatteryMuzzles(fixtureFit);
 `);
 run(app.split('\n').find(line=>line.startsWith('const trialApply=')));
 for(const [start,end]of [['function trialShotGeometry(','function trialGunnery('],['function spaceShotEmitter(','function spaceShots(']]){const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a);run(app.slice(a,b));}
}

test('manual fire uses all six exact window mouths through the ship and foil transforms without a phantom barrel arm',()=>{
 const {run}=setup();installCombat(run);
 run("const gun={broadsideBattery:true,muzzles:mouths,r:999,origin:[999,999,999]},shot=trialShotGeometry(gun,[1,0,0]);");
 assert.equal(run('shot.spread'),0);assert.equal(run('shot.muzzles.length'),6);assert.deepEqual(plain(run('shot.base')),plain(run('shot.muzzles[0]')));
 const points=plain(run('mouths')),center=[25,10,3],expected=points.map(p=>{const d=p.map((v,i)=>v-center[i]);return[100-d[2],200+d[1],300+d[0]];});
 assert.deepEqual(plain(run('shot.muzzles')),expected);
 run('gun._foilTransform=Gfx.foilTransform();const folded=trialShotGeometry(gun,[0,1,0])');
 const folded=points.map(p=>{const d=[p[0]+2-center[0],p[1]+3-center[1],p[2]-4-center[2]];return[100-d[2],200+d[1],300+d[0]];});
 assert.deepEqual(plain(run('folded.muzzles')),folded);
});

test('fleet fire emits from the same six window slots with or without a rendered mesh and follows its structural foil',()=>{
 const {run}=setup();installCombat(run);
 run(`const offset=[19,7,5],mount={id:7,module:0,cell:'native',broadsideBattery:true,fixed:false,barrelLength:999,center:[1,2,3],muzzles:mouths.map(p=>C.sub(p,offset))},source={id:'source',key:'native',pos:[1000,500,20],rot:[0,0,1,0,1,0,-1,0,0],p:{surface:{offset,mounts:[mount]}},surfaceLastFire:{cells:[{fit:7,energy:1,gun:1}]}},target={pos:[2000,1500,1200]};`);
 const mouths=plain(run('mouths')),offset=[19,7,5];
 for(let i=0;i<6;i++){const p=mouths[i].map((v,k)=>v-offset[k]),expected=[1000-p[2],500+p[1],20+p[0]],emitter=plain(run(`spaceShotEmitter(source,target,${i})`));assert.deepEqual(emitter.pos,expected);assert.equal(emitter.fit,7);assert.equal(emitter.fixed,false);}
 run(`const rest={id:7,broadsideBattery:true,muzzles:mouths,mesh:'window',foilId:71};fleet.assets.set('native',{geometry:{center:[25,10,3],turrets:[rest],foils:[{id:71}]}})`);
 for(let i=0;i<6;i++){const p=[mouths[i][0]+2-25,mouths[i][1]+3-10,mouths[i][2]-4-3],expected=[1000-p[2],500+p[1],20+p[0]];assert.deepEqual(plain(run(`spaceShotEmitter(source,target,${i}).pos`)),expected);}
 run('mount.muzzles=null;rest.muzzles=null');assert.equal(run('spaceShotEmitter(source,target,0)'),null,'missing physical slot data must not invent a generic gun arm');
});
