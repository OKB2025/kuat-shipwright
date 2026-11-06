const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
function setup(){
 const timers=new Map();let nextTimer=0;
 const cx=vm.createContext({console,performance,structuredClone,document:{activeElement:null},setTimeout:fn=>{timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)}),run=source=>vm.runInContext(source,cx);
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 run(`
 const C=Core,posts=[],undoStack=[],redoStack=[],notices=[],dirty={draw:false,overlay:false},fleet={mode:'design'};
 let ship=null,S=null,prevS=null,bounds=[],lastOp='',dragSnap=null,dragLabel='';
 const st={tab:'mod',group:'shape',coded:false,view:'normal',mirror:false,vmirror:false,multi:{parts:new Set(),fits:new Set()}};
 const classes=new Set(),busy={hidden:true,classList:{toggle:(key,on)=>on?classes.add(key):classes.delete(key)}},nodes=new Map([['#busy',busy],['#busyText',{}],['#btnUndo',{}],['#btnRedo',{}],['#shipName',{setAttribute(){}}]]);
 const $=selector=>nodes.get(selector)||null,view={uploads:[],meshes:{},cam:{fov:.7},upload(k,g){this.uploads.push({k,g});},setGlow(){},setLines(){},ray:(x,z)=>({o:[x,100,z],d:[0,-1,0]})};
 const YardEngineClient={post:msg=>posts.push(msg)},requestDraw=()=>dirty.draw=true,syncHullEditor=()=>{},titleVisible=()=>false;
 const resetSolidCutter=()=>{},reconcileSolidCutter=()=>{},hideInspect=()=>{},renderPanel=()=>{},renderPanelInfo=()=>{},refreshOverlay=()=>{},updateAviationUI=()=>{},autosave=()=>{},sndEdit=()=>{},sndUI=()=>{},toast=text=>notices.push(text),esc=String,T=x=>x,armMode=()=>false;
 `);
 const section=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));};
 section('// ---------- background engine ----------','// ---------- live preview ----------');
 section('// ---------- live preview ----------','// ---------- loading screen');
 section('function fitCamera(','const CAMS =');
 section('// ---------- ship lifecycle & history ----------','// ---------- selection ----------');
 section('// ---------- selection ----------','// ---------- tools ----------');
 section('function linkedItems(','// Vertical copies for parts');
 run(`
 const fixture=C.newShip({L:300,W:160,H:80,assembly:true},'Background edits');fixture.parts=[{id:1,k:'struct',form:'box',c:[50,10,-20],s:[20,20,20]},{id:2,k:'struct',form:'box',c:[120,10,20],s:[20,20,20]}];fixture.fits=[{id:3,k:'pd',p:[120,20,20],a:2,ped:0,base:0,low:0,float:false}];fixture.nextId=4;fixture.hatches=[];fixture.armor={hull:0,cit:0};
 eng.ready=true;setShip(fixture,{keepHistory:true});
 `);
 const flush=()=>{while(timers.size){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}};
 return {run,flush};
}

test('the first shape build displays a selectable draft and a nonblocking progress indicator',()=>{
 const {run,flush}=setup();flush();
 assert.equal(run('ship._geoProxy'),undefined);assert.equal(run('eng.waiting'),true);assert.equal(run('busy.hidden'),false);assert.equal(run("classes.has('background')"),true);
 run('flushLivePreview()');assert.ok(run('view.uploads.some(q=>q.k==="preview"&&q.g.ni>0)'));
 assert.equal(run('pick(50,-20,{parts:true,fits:false}).part===ship.parts[0]'),true,'picking uses authored geometry before the first worker reply');
 assert.ok(run('view.cam.r>0&&Number.isFinite(view.cam.r)'));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(html,/\.busy\.background\s*\{[^}]*pointer-events:\s*none/);
});

test('pending picking follows moved source parts instead of their old clipped geometry',()=>{
 const {run}=setup();
 run(`const part=ship.parts[0];part._packing={tris:C.structTriangles(part),boxes:[[40,0,-30,60,20,-10]]};part.c[0]=80;touch('parts');`);
 assert.equal(run('pick(80,-20,{parts:true,fits:false}).part===part'),true);
 assert.equal(run('pick(50,-20,{parts:true,fits:false})'),null);
 assert.equal(run('editorRayEnv([80,100,-20],[0,-1,0],{skipSet:new Set([part])})'),null,'support queries still skip the selected source object');
 assert.ok(run('part._packing.tris.length>0'),'lightweight picking does not modify worker caches');
});

test('delete, undo, redo and another move update immediately while an earlier request is running',()=>{
 const {run,flush}=setup();flush();run('flushLivePreview();const oldGen=eng.gen,oldState=posts[0].state;');
 run("removeWithPreview('delete','parts',ship.parts[0])");assert.equal(run('ship.parts.some(p=>p.id===1)'),false);assert.equal(run('live.hide.parts.has(1)'),true);assert.equal(run('eng.waiting'),true);
 run('undo()');assert.equal(run('ship.parts.some(p=>p.id===1)'),true);assert.equal(run('live.parts.some(p=>p.id===1)'),true,'Undo draws the restored part without a worker round trip');
 run('redo()');assert.equal(run('ship.parts.some(p=>p.id===1)'),false);assert.equal(run('live.parts.some(p=>p.id===1)'),false);
 run("mutate('move',()=>{const p=ship.parts.find(p=>p.id===2);p.c[0]=150;queuePreview('parts',[p]);},'parts');flushLivePreview()");
 assert.equal(run('ship.parts[0].c[0]'),150);assert.equal(run('undoStack.length'),2);
 flush();assert.equal(run('posts.length'),2,'send the latest edit even before the first geometry reply');assert.equal(run('JSON.parse(posts[1].state).parts[0].c[0]'),150);assert.equal(run('JSON.parse(posts[1].state).parts.length'),1);
 run('onEngineGeometry({gen:oldGen,state:oldState,geos:{struct:{ni:1}}});onEngineSurfaceGeometry({gen:oldGen,state:oldState});onEngineStats({gen:oldGen,stats:{mass:0}});');
 assert.equal(run('ship.parts.length'),1);assert.equal(run('ship.parts[0].c[0]'),150);assert.equal(run('S'),null,'obsolete replies cannot undo deletion or movement');
 run('undo()');assert.equal(run('ship.parts[0].c[0]'),120);assert.equal(run('live.parts.find(p=>p.id===2).c[0]'),120);
});

test('consecutive edits dispatch the latest source state and retain all changed geometry flags',()=>{
 const {run,flush}=setup();flush();run("ship.parts[0].c[0]=70;touch('parts');ship.fits[0].p[0]=130;touch('fits')");flush();
 assert.equal(run('posts.length'),2);assert.deepEqual(JSON.parse(run('JSON.stringify(posts[1].what)')),['parts','fits']);
 assert.equal(run('JSON.parse(posts[1].state).parts[0].c[0]'),70);assert.equal(run('JSON.parse(posts[1].state).fits[0].p[0]'),130);
});

test('Continue displays the deferred draft before any geometry response',()=>{
 const {run}=setup();run('setShip(C.deserialize(C.serialize(ship)),{keepHistory:true,deferPreparation:true});prepareDeferredDraft();');
 assert.equal(run('ship._geoProxy'),undefined);assert.equal(run('live.queued.parts.length'),2);assert.equal(run('live.queued.fits.length'),1);
 run('flushLivePreview()');assert.ok(run('view.uploads.some(q=>q.k==="preview"&&q.g.ni>0)'));
});

test('history property ordering alone cannot trigger a full preview rebuild',()=>{
 const {run}=setup();run(`clearPreview();view.uploads.length=0;const before=JSON.parse(C.publicJSON(ship));for(const kind of ['parts','fits'])before[kind]=before[kind].map(q=>Object.fromEntries(Object.entries(q).reverse()));previewHistory(before);`);
 assert.equal(run('view.uploads.length'),0);assert.equal(run('live.active'),false);
});

test('selection deletion hides fitted weapons immediately as well as structural parts',()=>{
 const {run}=setup();
 run(`const xfDrivers=()=>[{list:'fits',it:ship.fits[0],fol:[]}],edPrune=()=>{},selClear=()=>{},xfReset=()=>{};`);
 const start=app.indexOf('function editDelete()'),end=app.indexOf('// UI-007 Ctrl+G',start);run(app.slice(start,end));
 run('editDelete()');assert.equal(run('ship.fits.length'),0);assert.equal(run('live.hide.fits.has(3)'),true);
 run('undo()');assert.equal(run('ship.fits.length'),1);assert.equal(run('live.fits.some(f=>f.id===3)'),true);
});
