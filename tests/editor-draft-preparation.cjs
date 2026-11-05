const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),plain=value=>JSON.parse(JSON.stringify(value));

function setup(){
 const timers=[],cx=vm.createContext({console,setTimeout:fn=>{timers.push(fn);return timers.length;}});
 const run=source=>vm.runInContext(source,cx);
 run(`
 const posts=[],statsRequests=[],busyRequests=[],bootSteps=[],dirty={draw:false,overlay:false};
 let ship=null,S=null,prevS=null,dragSnap=null,saveSerial=0,draws=0,bootReady=0,bootEngineReady=0;
 const st={surfaceIds:[],surfaceDraft:{},multi:{parts:new Set(),fits:new Set()}},live={active:false};
 const fleet={mode:'design'},undoStack=[],redoStack=[],view={meshes:{hull:{count:17}}};
 const C={publicJSON:s=>JSON.stringify(s,(key,value)=>key.startsWith('_')?undefined:value),shipClassFor:()=>({name:'駆逐艦'})};
 const YardEngineClient={post:message=>posts.push(message)};
 const clearPreview=()=>{},resetSolidCutter=()=>{},hideInspect=()=>{},updateName=()=>{},renderPanel=()=>{},updateUndo=()=>{},autosave=()=>{},engineStatus=()=>{};
 const requestDraw=()=>{draws++;dirty.draw=true;},scheduleStats=delay=>statsRequests.push(delay),showBusyOverlay=text=>busyRequests.push(text);
 const newSaveId=()=> 'save-'+(++saveSerial),snap=()=>C.publicJSON(ship),fleetSetMode=mode=>fleet.mode=mode,toast=()=>{};
 const nodes={status:{textContent:''},menu:{},panel:{},continue:{disabled:true},draft:{textContent:''}};
 const $=selector=>({'#titleStatus':nodes.status,'#titleMenu':nodes.menu,'#titlePanel':nodes.panel,'#titleMenu [data-title="continue"]':nodes.continue,'#titleDraft':nodes.draft}[selector]||null),$$=()=>[];
 const titleState={mode:'design',panel:null},draftMeta=()=>null,fLen=String,I18N=null;
 const missionMapRender=()=>{},msTitleRender=()=>{},campTitleRender=()=>{};
 const window={KSBoot:{engineReady:()=>bootEngineReady++,ready:()=>bootReady++,step:(...args)=>bootSteps.push(args)}};
 const authored=s=>JSON.stringify(Object.fromEntries(['name','hull','parts','fits','hatches','surfaces','armor','nextId'].map(key=>[key,s[key]])));
 const make=(name='Saved Venator')=>({name,hull:{L:1137,W:548,H:208},parts:[{id:1,k:'struct',c:[100,10,0],s:[30,20,10]}],fits:[{id:2,k:'pd',p:[100,20,0],a:2}],hatches:[],surfaces:{version:4,mode:'strict',compatAllowed:false,patches:[]},armor:{hull:.5,cit:0},nextId:3,saveId:'saved-design'});
 `);
 const section=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);run(app.slice(a,b));};
 section('const eng = {','function enginePending()');
 section('function setShip(s, opts)','function snap()');
 section('function titleStatus()','function renderTitle()');
 section('function renderTitle()','// New hulls use');
 section('async function voyPatrol(source)','function waitStats()');
 section('async function openExample(key)','async function fillHangarsRemote()');
 section('async function loadSaved(id)','async function exportDesign()');
 const flush=()=>{while(timers.length)timers.shift()();};
 return{run,flush};
}

test('an unselected startup draft keeps its authored design and Continue action without preparing it',()=>{
 const {run,flush}=setup();
 run("const draft=make(),before=authored(draft);setShip(draft,{keepHistory:true,deferPreparation:true});eng.ready=true;kickEngine();");
 flush();run('renderTitle()');
 assert.equal(run('ship===draft'),true);assert.equal(run('authored(ship)'),run('before'));assert.equal(run('ship.saveId'),'saved-design');
 assert.equal(run('ship._deferredPreparation'),true);assert.equal(run('eng.gen'),0);assert.equal(run('posts.length'),0);
 assert.equal(run('statsRequests.length'),0);assert.equal(run('busyRequests.length'),0);assert.equal(run('eng.what.size'),0);
 assert.equal(run('nodes.continue.disabled'),false);assert.match(run('nodes.draft.textContent'),/Saved Venator/);
 assert.equal(run('bootReady'),1,'the deferred draft must not hold the splash/menu for an unfinished survey');
 assert.deepEqual(plain(run('bootSteps')),[['draft','skip']]);assert.match(run('nodes.status.textContent'),/準備完了/);
});

test('explicit Continue starts the deferred draft once and dispatches the selected authored design',()=>{
 const {run,flush}=setup();
 run("const draft=make();setShip(draft,{keepHistory:true,deferPreparation:true});eng.ready=true;prepareDeferredDraft();prepareDeferredDraft();");
 flush();
 assert.equal(run('ship._deferredPreparation'),undefined);assert.equal(run('eng.gen'),1);assert.equal(run('posts.length'),1);
 assert.deepEqual(plain(run('statsRequests')),[0]);assert.deepEqual(plain(run('posts[0].what')),['all']);
 assert.equal(run('posts[0].reset'),true);assert.equal(run('posts[0].gen'),1);assert.equal(run('posts[0].view.deferSurfaces'),true);
 assert.equal(run('JSON.parse(posts[0].state).name'),'Saved Venator');assert.equal(run('JSON.parse(posts[0].state).fits[0].id'),2);
 assert.equal(run('JSON.parse(posts[0].state).saveId'),undefined);assert.equal(run('ship.saveId'),'saved-design');
 run('prepareDeferredDraft()');flush();assert.equal(run('posts.length'),1,'repeated Continue preparation must not queue another build');
});

test('a normal new design replaces an unselected draft even when the startup engine kick is queued',()=>{
 const {run,flush}=setup();
 run("setShip(make(),{keepHistory:true,deferPreparation:true});eng.ready=true;kickEngine();const fresh=make('New design');fresh.parts=[];fresh.fits=[];delete fresh.saveId;setShip(fresh,{keepHistory:true});");
 flush();
 assert.equal(run('posts.length'),1);assert.equal(run('JSON.parse(posts[0].state).name'),'New design');
 assert.deepEqual(plain(run('JSON.parse(posts[0].state).parts')),[]);assert.deepEqual(plain(run('JSON.parse(posts[0].state).fits')),[]);
 assert.equal(run('ship._deferredPreparation'),undefined);assert.equal(run('ship.saveId'),'save-1');
 assert.equal(run('statsRequests.length'),1);assert.equal(run('busyRequests.length'),1);assert.equal(run('undoStack.length'),0);
});

test('ordinary and direct hot-editor setShip calls still start preparation immediately',()=>{
 const {run,flush}=setup();run("eng.ready=true;const fresh=make('Direct editor');setShip(fresh);");flush();
 assert.equal(run('ship._deferredPreparation'),undefined);assert.equal(run('posts.length'),1);assert.equal(run('eng.gen'),1);
 assert.equal(run('JSON.parse(posts[0].state).name'),'Direct editor');assert.deepEqual(plain(run('statsRequests')),[0]);
 assert.equal(run('busyRequests.length'),1);assert.equal(run('view.meshes.hull.count'),0);
});

test('starting patrol with the current deferred draft prepares it before awaiting figures',async()=>{
 const {run,flush}=setup();
 run(`
 const patrolEvents=[],SYSTEMS={kuat:{}},patrolOpt={sys:'kuat',escorts:[]},PATROL_ESCORTS=4,trial={on:false};
 let resolveStats;
 const loadShow=()=>patrolEvents.push('load'),hideTitle=()=>patrolEvents.push('hide');
 const waitStats=()=>{patrolEvents.push(['wait',!!ship._deferredPreparation,eng.gen]);return new Promise(resolve=>{resolveStats=resolve;});};
 const trialStart=async opts=>{patrolEvents.push(['trial',opts.patrol,opts.returnTo]);trial.on=true;};
 const loadHide=()=>patrolEvents.push('failed'),esc=String,showTitle=()=>patrolEvents.push('title');
 setShip(make(),{keepHistory:true,deferPreparation:true});eng.ready=true;kickEngine();
 `);
 flush();assert.equal(run('posts.length'),0);assert.equal(run('statsRequests.length'),0);
 const starting=run("voyPatrol('current')");
 assert.deepEqual(plain(run('patrolEvents')),['load','hide',['wait',false,1]]);
 assert.deepEqual(plain(run('statsRequests')),[0]);assert.equal(run('trial.on'),false);
 flush();assert.equal(run('posts.length'),1);assert.equal(run('JSON.parse(posts[0].state).name'),'Saved Venator');
 run('resolveStats()');await starting;
 assert.deepEqual(plain(run('patrolEvents')),['load','hide',['wait',false,1],['trial',true,'title']]);
 assert.equal(run('trial.on'),true);
});

test('failed example and saved-design loads return to the menu and preserve the deferred draft',async()=>{
 const {run,flush}=setup();
 run(`
 const recovered=[],loadAttempts=[],loadErrors=[],esc=String;
 let hiddenBusy=0;
 const showTitle=panel=>recovered.push(panel),hideBusyOverlay=()=>hiddenBusy++;
 console={error:error=>loadErrors.push(error.message)};
 YardEngineClient.request=async(type,payload)=>{loadAttempts.push([type,payload.key]);throw new Error('example unavailable');};
 const Store={list:async()=>{loadAttempts.push(['saved']);throw new Error('storage unavailable');}};
 const draft=make(),before=authored(draft);
 setShip(draft,{keepHistory:true,deferPreparation:true});eng.ready=true;kickEngine();
 `);
 flush();
 assert.equal(await run("openExample('missing')"),null);
 for(const check of ['ship===draft','authored(ship)===before','ship._deferredPreparation'])assert.equal(run(check),true,check);
 assert.equal(run('ship.saveId'),'saved-design');assert.deepEqual(plain(run('recovered')),['load']);
 await run("loadSaved('missing')");flush();
 for(const check of ['ship===draft','authored(ship)===before','ship._deferredPreparation'])assert.equal(run(check),true,check);
 assert.equal(run('ship.saveId'),'saved-design');assert.deepEqual(plain(run('recovered')),['load','load']);
 assert.deepEqual(plain(run('loadAttempts')),[['build','missing'],['saved']]);
 assert.deepEqual(plain(run('loadErrors')),['example unavailable']);assert.equal(run('hiddenBusy'),1);
 assert.equal(run('posts.length'),0);assert.equal(run('statsRequests.length'),0);assert.equal(run('eng.gen'),0);
});
