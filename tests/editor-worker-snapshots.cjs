const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return text.slice(a,b);}
// Compile candidates instead of duplicating production functions or depending
// on an external parser. The first complete declaration is the actual function.
function fn(text,name){const match=new RegExp('(?:async )?function '+name+'\\s*\\(').exec(text);assert.ok(match,name);for(let b=text.indexOf('}',match.index);b>=0;b=text.indexOf('}',b+1)){const code=text.slice(match.index,b+1);try{new vm.Script(code);return code;}catch{}}assert.fail('complete function '+name);}
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};

function uiSetup(){
 const cx=vm.createContext({console:{warn(){}}}),run=code=>vm.runInContext(code,cx);
 run(`const physicsCalls=[],rays=[],requests=[],replies=[],timers=[];let clockStep=0,clock=0;const performance={now:()=>clock+=clockStep},setTimeout=fn=>(timers.push(fn),timers.length);let panelRenders=0,specRenders=0,editorPartsRevision=0,enginePickCache=null,propulsionUICache=null,propulsionUIPending=null,dragSnap=null;
 let ship={_client:true,name:'Editor fixture',hull:{L:100},parts:[{id:1,k:'gen',t:10}],fits:[{id:10,k:'gun'}],hatches:[],nextId:20},S={propulsion:{preset:'combat',actualInputW:42}},prevS=null;
 const eng={ready:true,gen:1,adoptedGen:0,geoGen:1,statsGen:1,sentGen:1},st={heatPreset:'combat',tab:'hull'},fleet={mode:'design'},meshStore={geos:{}},live={active:false};
 const enginePending=()=>eng.adoptedGen<eng.gen,forbidden=name=>(...args)=>{physicsCalls.push(name);throw Error('Main-thread physics forbidden: '+name);};
 const C={publicJSON:value=>JSON.stringify(value,(key,v)=>key.startsWith('_')?undefined:v),patchShip:forbidden('patchShip'),isHullStructure:()=>false,rayPart:(o,d,p)=>{rays.push(p.id);return{t:p.t,p:[0,0,0]};},enginePaths:forbidden('enginePaths'),commandCompartments:forbidden('commandCompartments'),weaponCapacitors:forbidden('weaponCapacitors'),missileCells:forbidden('missileCells'),engineTransmission:forbidden('engineTransmission'),engineDriveRoutes:forbidden('engineDriveRoutes'),surfaceWorkingShip:forbidden('surfaceWorkingShip'),propulsionPreview:forbidden('propulsionPreview')};
 const Gfx={isHiddenEngineFeed:p=>!!p.transmission&&!p.drivetrain},currentEditorGeometryContext=()=> 'ctx',hydrateEditorHull=()=>false,editorCanMeshPart=()=>true,editorRayPartMayHit=()=>true,requestedPart=p=>p,visibleAt=()=>true;
 const refreshDerivedPanel=()=>panelRenders++,renderSpecTargets=()=>specRenders++;
 const YardEngineClient={request:(type,payload)=>{requests.push({type,payload});return new Promise((resolve,reject)=>replies.push({resolve,reject}));}};
 const requestDraw=()=>{},applyGeometry=()=>true,retainGeometry=()=>{},clearPreview=()=>{},foilPreview=()=>{},fitCamera=()=>{},hideBusyOverlay=()=>{},refreshOverlay=()=>{},renderPanelInfo=()=>{},updateAviationUI=()=>{},autosave=()=>{},titleVisible=()=>false,titleStatus=()=>{},titleShipView=()=>{},kickEngine=()=>{},engineStatus=()=>{};
 function packet(gen=1){return{gen,state:JSON.stringify({parts:ship.parts,fits:ship.fits,hatches:[],nextId:20}),caches:{ship:{},items:{parts:{},fits:{},hatches:{}},geoProxy:{hull:{}},editor:{engineParts:[{id:-1,k:'machinery',transmission:true,t:.5,owner:{$r:'ship'}},{id:-2,k:'machinery',drivetrain:true,t:2}],commands:[{id:-3,k:'command',t:6,source:{$r:'parts',id:1}}],capacitors:[{id:-4,k:'capacitor',weaponId:10,t:4},{id:-5,k:'capacitor',weaponId:999,t:1}],missileCells:[{id:-6,k:'missileCell',t:3}],transmission:{routes:[{id:'feed',capacityW:100,lossW:3}]},drive:{routes:[{id:'shaft',capacityW:97}]}}}};}
 `);
 for(const name of ['adoptEngineState','finishEngineAdoption','onEngineGeometry','onEngineSurfaceGeometry','editorSnapshotForUI','editorCommandCompartments','enginePickParts','partHit','transmissionForUI','driveForUI','propulsionPreviewForUI'])run(fn(app,name));
 return{run,async drain(){let count=0;while(run('timers.length')){assert.ok(++count<100,'cache adoption must finish in a bounded number of slices');run('timers.shift()()');await flush();}await flush();}};
}

test('a current worker snapshot is adopted with references and supplies picks and physical route figures without client physics',()=>{
 const {run}=uiSetup();run('const msg=packet();onEngineGeometry(msg);');
 assert.equal(run('ship._editorSnapshot===msg.caches.editor'),true);assert.equal(run('ship._editorSnapshotGen'),1);assert.equal(run('eng.adoptedGen'),1);
 assert.equal(run('editorSnapshotForUI().engineParts[0].owner===ship'),true);assert.equal(run('editorCommandCompartments()[0].source===ship.parts[0]'),true);
 assert.deepEqual(plain(run('enginePickParts().map(p=>p.id)')),[-2]);assert.equal(run('transmissionForUI().routes[0].lossW'),3);assert.equal(run('driveForUI().routes[0].capacityW'),97);
 assert.equal(run('partHit([0,0,0],[1,0,0],null).part.id'),-2);assert.equal(run('rays.includes(-1)'),false,'invisible electrical feeds must never intercept picks');assert.equal(run('rays.includes(-5)'),false,'orphan capacitor rows must not be pickable');assert.deepEqual(plain(run('physicsCalls')),[]);
});

test('pending or missing snapshots keep camera picking on authored objects without starting engineering',()=>{
 const {run}=uiSetup();run('onEngineGeometry(packet());eng.gen=2;');
 for(let i=0;i<30;i++){assert.equal(run('editorSnapshotForUI()'),null);assert.deepEqual(plain(run('enginePickParts()')),[]);assert.deepEqual(plain(run('editorCommandCompartments()')),[]);assert.equal(run('transmissionForUI()'),null);assert.equal(run('driveForUI()'),null);assert.equal(run('partHit([0,0,0],[1,0,0],null).part.id'),1);}
 assert.deepEqual(plain(run('physicsCalls')),[]);assert.equal(run('rays.every(id=>id===1)'),true);
 run('eng.adoptedGen=2');assert.equal(run('editorSnapshotForUI()'),null,'a matching adopted generation cannot promote an older snapshot');
 run('ship={_client:true,parts:[],fits:[],hatches:[]};');assert.equal(run('editorSnapshotForUI()'),null);assert.deepEqual(plain(run('enginePickParts()')),[]);
});

test('late geometry and surface packets cannot replace snapshot data for a newer edit',()=>{
 const {run}=uiSetup();run('onEngineGeometry(packet());const accepted=ship._editorSnapshot;eng.gen=2;onEngineGeometry({...packet(1),state:"invalid if parsed"});onEngineSurfaceGeometry({...packet(1),state:"invalid if parsed"});');
 assert.equal(run('ship._editorSnapshot===accepted'),true);assert.equal(run('ship._editorSnapshotGen'),1);assert.equal(run('eng.adoptedGen'),1);assert.equal(run('editorSnapshotForUI()'),null);
 run('onEngineGeometry(packet(2));const latest=ship._editorSnapshot;onEngineSurfaceGeometry({...packet(1),state:"invalid if parsed"});');assert.equal(run('editorSnapshotForUI()===latest'),true);assert.equal(run('ship._editorSnapshotGen'),2);assert.deepEqual(plain(run('physicsCalls')),[]);
});

function prepareLargePacket(run){
 run(`clockStep=7;
 function largePacket(gen=1,label='worker change'){
  const msg=packet(gen),state=JSON.parse(msg.state);state.parts[0].label=label;if(!state.parts.some(p=>p.id===2))state.parts.push({id:2,k:'sensor',t:12,label:'new part'});state.nextId=25;msg.state=JSON.stringify(state);
  const numbers=Object.freeze(Array.from({length:12000},(_,i)=>i/10)),typed=new Float32Array([1,2,3]),buffer=new ArrayBuffer(32),graph={label,numbers,typed,buffer,nodes:Array.from({length:1400},(_,i)=>({i,part:{$r:'parts',id:i%2?1:2},fit:{$r:'fits',id:10},owner:{$r:'ship'}}))};graph.self=graph;
  graph.index=new Map([['ship',{$r:'ship'}],['part',{$r:'parts',id:2}]]);msg.caches.ship._largeGraph=graph;return msg;
 }
 const originalPart=ship.parts[0],originalFit=ship.fits[0],originalParts=ship.parts;`);
}

test('large cache preparation yields without mutating live public objects, then commits identity and references once',async()=>{
 const {run,drain}=uiSetup();prepareLargePacket(run);run('const msg=largePacket(),graph=msg.caches.ship._largeGraph,pending=adoptEngineState(msg);');
 assert.equal(run('typeof pending.then'),'function');assert.ok(run('timers.length')>0);assert.equal(run('ship.parts===originalParts'),true);assert.equal(run('ship.parts[0]===originalPart'),true);assert.equal(run('ship.parts[0].label'),undefined);assert.equal(run('ship.parts.length'),1);assert.equal(run('ship._largeGraph'),undefined);assert.equal(run('eng.adoptedGen'),0);assert.equal(run('editorPartsRevision'),0);
 await drain();assert.equal(await run('pending'),true);assert.equal(run('ship.parts[0]===originalPart'),true);assert.equal(run('ship.fits[0]===originalFit'),true);assert.equal(run('ship.parts[0].label'),'worker change');assert.equal(run('ship.parts.length'),2);assert.equal(run('ship.nextId'),25);assert.equal(run('editorPartsRevision'),1);assert.equal(run('eng.adoptedGen'),1);
 assert.equal(run('ship._largeGraph===graph'),true);assert.equal(run('graph.self===graph'),true);assert.equal(run('graph.nodes.every(n=>n.owner===ship&&n.part===ship.parts[n.i%2?0:1]&&n.fit===originalFit)'),true);assert.equal(run('graph.index.get("part")===ship.parts[1]'),true);assert.equal(run('graph.index.get("ship")===ship'),true);
 assert.equal(run('ship._largeGraph.numbers===graph.numbers'),true);assert.equal(run('ship._largeGraph.typed===graph.typed'),true);assert.equal(run('ship._largeGraph.buffer===graph.buffer'),true);assert.deepEqual(plain(run('Array.from(graph.typed)')),[1,2,3]);assert.equal(run('graph.numbers.length'),12000);assert.equal(run('graph.numbers[11999]'),1199.9);
 assert.ok(run('eng.clientAdoptions[0].referenceSlices')>1);assert.ok(run('eng.clientAdoptions[0].largestReferenceSliceMs')>=6);assert.deepEqual(plain(run('physicsCalls')),[]);
});

test('an edit, held drag or replacement ship cancels a sliced adoption before any public change',async()=>{
 for(const change of ['eng.gen=2;originalPart.label="new user edit"','dragSnap="held"','ship={_client:true,name:"replacement",parts:[],fits:[],hatches:[],nextId:1}']){
  const {run,drain}=uiSetup();prepareLargePacket(run);run('const oldShip=ship,msg=largePacket(),pending=adoptEngineState(msg);');run(change);await drain();assert.equal(await run('pending'),false,change);
  assert.equal(run('oldShip.parts===originalParts'),true,change);assert.equal(run('oldShip.parts.length'),1,change);assert.equal(run('oldShip._largeGraph'),undefined,change);assert.equal(run('eng.adoptedGen'),0,change);assert.equal(run('editorPartsRevision'),0,change);assert.equal(run('eng.clientAdoptions'),undefined,change);
  assert.equal(run('originalPart.label'),change.startsWith('eng.gen')?'new user edit':undefined,change);assert.deepEqual(plain(run('physicsCalls')),[],change);
 }
});

test('a newer packet supersedes an unfinished adoption even within the same generation',async()=>{
 const {run,drain}=uiSetup();prepareLargePacket(run);run('const old=largePacket(1,"old packet"),latest=largePacket(1,"latest packet"),first=adoptEngineState(old),second=adoptEngineState(latest);');
 assert.equal(run('ship.parts[0].label'),undefined);assert.equal(run('ship._editorSnapshot'),undefined);assert.ok(run('timers.length')>=2);await drain();
 assert.equal(await run('first'),false);assert.equal(await run('second'),true);assert.equal(run('ship.parts[0]===originalPart'),true);assert.equal(run('ship.parts[0].label'),'latest packet');assert.equal(run('ship._largeGraph===latest.caches.ship._largeGraph'),true);assert.equal(run('ship._editorSnapshot===latest.caches.editor'),true);assert.equal(run('editorPartsRevision'),1);assert.equal(run('eng.clientAdoptions.length'),1);
});

test('geometry and surface handlers expose their sliced completion and refresh panels only after valid adoption',async()=>{
 const {run,drain}=uiSetup();prepareLargePacket(run);run('const geometry=onEngineGeometry(largePacket(1,"geometry complete"));');
 assert.equal(run('typeof geometry.then'),'function');assert.equal(run('panelRenders'),0);assert.equal(run('ship.parts[0].label'),undefined);await drain();await run('geometry');
 assert.equal(run('ship.parts[0].label'),'geometry complete');assert.equal(run('panelRenders'),1);assert.equal(run('eng.adoptedGen'),1);
 run('const surface=onEngineSurfaceGeometry(largePacket(1,"surface complete"));');assert.equal(run('typeof surface.then'),'function');assert.equal(run('panelRenders'),1);assert.equal(run('ship.parts[0].label'),'geometry complete');await drain();await run('surface');
 assert.equal(run('ship.parts[0].label'),'surface complete');assert.equal(run('panelRenders'),2);assert.equal(run('ship.parts[0]===originalPart'),true);
});

test('a superseded geometry-handler completion never refreshes the newer editor state',async()=>{
 const {run,drain}=uiSetup();prepareLargePacket(run);run('const completion=onEngineGeometry(largePacket());eng.gen=2;originalPart.label="new user edit";');
 await drain();await run('completion');assert.equal(run('eng.adoptedGen'),0);assert.equal(run('ship.parts[0].label'),'new user edit');assert.equal(run('ship._editorSnapshot'),undefined);assert.equal(run('panelRenders'),0);assert.equal(run('editorPartsRevision'),0);
});

test('worker cache packing produces plain editor data and reference markers only after full geometry',()=>{
 const cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);
 run(`const calls=[],part={id:1,k:'struct'},fit={id:10,k:'gun'},ship={hull:{L:100},parts:[part],fits:[fit],hatches:[]};
 const rows={engineParts:[{id:-1,drivetrain:true,owner:ship}],commands:[{id:-2,source:part}],capacitors:[{id:-3,source:fit}],missileCells:[{id:-4}],transmission:{routes:[{id:'feed',lossW:3}]},drive:{routes:[{id:'shaft',capacityW:97}]}};
 const get=(name,key)=>s=>{calls.push(name);if(s!==ship)throw Error('wrong source');return rows[key];};
 const C={isShapePart:p=>p.k==='struct',hullGeo:()=>({tris:new Float32Array(9)}),referenceHullGeometry:()=>null,surfacePatches:()=>[],enginePaths:get('enginePaths','engineParts'),commandCompartments:get('commandCompartments','commands'),weaponCapacitors:get('weaponCapacitors','capacitors'),missileCells:get('missileCells','missileCells'),engineTransmission:get('engineTransmission','transmission'),engineDriveRoutes:get('engineDriveRoutes','drive')};`);
 run(section(engine,'const SHIP_SKIP =','// Exact authored pick geometry'));
 run('const full=packCaches(ship,{deferSurfaces:true});');assert.deepEqual(plain(run('Object.keys(full.editor).sort()')),['capacitors','commands','drive','engineParts','missileCells','transmission']);
 assert.deepEqual(plain(run('full.editor.engineParts[0].owner')),{$r:'ship'});assert.deepEqual(plain(run('full.editor.commands[0].source')),{$r:'parts',id:1});assert.deepEqual(plain(run('full.editor.capacitors[0].source')),{$r:'fits',id:10});
 assert.equal(run('full.editor.transmission.routes[0].lossW'),3);assert.equal(run('full.editor.drive.routes[0].capacityW'),97);assert.equal(run('calls.length'),6);
 run('calls.length=0;const early=packCaches(ship,{authoring:true,deferSurfaces:true});');assert.equal(run('early.editor'),undefined);assert.deepEqual(plain(run('calls')),[],'early authoring messages must not start expensive engineering just to prepare a camera snapshot');
});

function catalogueSetup(){
 const cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);
 run(`const surfaceCalls=[];let forbid=false;const C={G0:10,ISD_W:100,K:{shieldW:10,shieldStd:2,cycle:5},GUN_BANDS:{heavy:{},light:{}},FITS:{gun:{cat:'w'},ion:{cat:'w'},missile:{cat:'w'}},surfaceWorkingShip:s=>{surfaceCalls.push(s);if(forbid)throw Error('Client surface compilation forbidden');return s;},fitSpec:f=>f.spec,fitBand:s=>s.band,isReactor:p=>p.k==='gen',reactorPower:p=>p.w,solarPower:p=>p.solar||0,partVolume:p=>p.volume,shieldLoad:p=>p.capacity};
 const ship={parts:[{id:1,k:'gen',w:120},{id:2,k:'shield',volume:3,capacity:500},{id:3,k:'shield',volume:999,capacity:999,surfaceUnplaced:true}],fits:[{id:10,k:'gun',spec:{tt:20,cycle:10,band:'heavy'}},{id:11,k:'ion',spec:{ion:5,cycle:4,band:'light'}},{id:12,k:'missile',spec:{tt:99,msl:1,band:'heavy'}},{id:13,k:'gun',float:true,spec:{tt:999,band:'heavy'}}]};
 const S={name:'Worker fixture',mass:24,area:100,power:1,accelG:0,propulsion:{ratedAccelMps2:100,accelerationLimitMps2:80},fitInfo:{10:[1,.5,0,0,0,0],11:[0,0,1,0,0,0]},surface:{totalArea:100,patches:[{id:'p1',triangles:[1],exposedTriangles:[2],polygon:[3],cells:[4],config:{aggregate:{old:'heavy'},armor:{thickness:.1}}}]}};`);
 for(const name of ['surfaceReportOut','catalogueAccelerationG','catalogueValues','statsOut'])run(fn(engine,name));
 for(const name of ['designAccelerationG','catalogStats'])run(fn(app,name));
 return{run};
}

test('worker catalogue snapshots match independent ratings and the legacy presentation, without changing operating stats',()=>{
 const {run}=catalogueSetup();run('const before=JSON.stringify(S),out=statsOut(S,ship),legacy=catalogStats(S,ship);');
 const expected={power:120,xISD:1.2,accelG:8,aThrust:100,thrustG:10,shieldP:30,shieldPct:.15,shieldCapacity:500,alpha:[20,10,0,0,0,0],alphaTot:20,alphaBest:20,alphaMean:5,ionTot:5,allGunVolleyTT:25,heavyAlpha:20,arcEff:1,bandRate:{heavy:[2,1,0,0,0,0],light:[0,0,0,0,0,0]}};
 assert.deepEqual(plain(run('out.catalogue')),expected);for(const [key,value]of Object.entries(expected))assert.deepEqual(plain(run('legacy['+JSON.stringify(key)+']')),value,key);
 assert.equal(run('JSON.stringify(S)===before'),true);assert.equal(run('out.accelG'),0,'actual operating starvation remains distinct from catalogue maximum');assert.equal(run('out.mass'),24);
 assert.deepEqual(plain(run('out.surface.patches[0]')),{id:'p1',config:{armor:{thickness:.1}}});assert.equal(run('out.surface.totalArea'),100);
});

test('repeated strip, panel and spec catalogue reads use worker values without any client surface work',()=>{
 const {run}=catalogueSetup();run('const out=statsOut(S,ship);surfaceCalls.length=0;forbid=true;');
 for(let i=0;i<30;i++){assert.equal(run('catalogStats(out,ship).accelG'),8);assert.equal(run('catalogStats(out,ship).allGunVolleyTT'),25);assert.equal(run('catalogStats(out,ship).mass'),24);}
 assert.equal(run('surfaceCalls.length'),0);assert.equal(run('out.accelG'),0);assert.equal(run('catalogStats(null,ship)'),null);
});

test('combat preview and repeated alternate-preset reads never solve propulsion on the interface',async()=>{
 const {run}=uiSetup();run('onEngineGeometry(packet());panelRenders=specRenders=0;');assert.equal(run('propulsionPreviewForUI()===S.propulsion'),true);assert.equal(run('requests.length'),0);
 run("st.heatPreset='max';const waiting=propulsionPreviewForUI();propulsionPreviewForUI();propulsionPreviewForUI();");assert.equal(run('waiting'),null);assert.deepEqual(plain(run('requests')),[{type:'propulsionPreview',payload:{gen:1,preset:'max'}}]);
 run("replies[0].resolve({gen:1,preset:'max',preview:{preset:'max',actualInputW:97}})");await flush();
 assert.equal(run('propulsionPreviewForUI().actualInputW'),97);assert.equal(run('requests.length'),1);assert.equal(run('panelRenders'),1);assert.equal(run('specRenders'),1);assert.deepEqual(plain(run('physicsCalls')),[]);
});

test('late alternate-preset results are rejected after edits, new stats, ship changes or another preset',async()=>{
 for(const change of ['eng.gen=2','S={propulsion:{preset:"combat"}}','ship={...ship,name:"Replacement"}','st.heatPreset="cruise"']){
  const {run}=uiSetup();run('onEngineGeometry(packet());panelRenders=specRenders=0;st.heatPreset="max";propulsionPreviewForUI();');run(change);run('replies[0].resolve({gen:1,preview:{preset:"max",stale:true}})');await flush();
  assert.equal(run('propulsionUICache'),null,change);assert.equal(run('panelRenders'),0,change);assert.equal(run('specRenders'),0,change);assert.deepEqual(plain(run('physicsCalls')),[],change);
 }
 const {run}=uiSetup();run('onEngineGeometry(packet());panelRenders=specRenders=0;st.heatPreset="max";propulsionPreviewForUI();replies[0].resolve({gen:0,preview:{preset:"max",stale:true}})');await flush();assert.equal(run('propulsionUICache'),null);assert.equal(run('panelRenders'),0);
});

test('a newer preset request wins even when an older request completes last',async()=>{
 const {run}=uiSetup();run('onEngineGeometry(packet());panelRenders=specRenders=0;st.heatPreset="max";propulsionPreviewForUI();st.heatPreset="cruise";propulsionPreviewForUI();replies[1].resolve({gen:1,preview:{preset:"cruise",actualInputW:20}})');await flush();
 run('replies[0].resolve({gen:1,preview:{preset:"max",actualInputW:97}})');await flush();assert.equal(run('propulsionPreviewForUI().preset'),'cruise');assert.equal(run('propulsionPreviewForUI().actualInputW'),20);assert.equal(run('panelRenders'),1);assert.equal(run('requests.length'),2);
});

test('pending geometry or stale statistics cannot launch even a worker preview request',()=>{
 for(const change of ['eng.gen=2','eng.statsGen=0','S=null']){
  const {run}=uiSetup();run('onEngineGeometry(packet());st.heatPreset="max";');run(change);assert.equal(run('propulsionPreviewForUI()'),null);assert.equal(run('requests.length'),0);assert.deepEqual(plain(run('physicsCalls')),[]);
 }
});

test('the worker preview handler uses only matching ship/stat generations and valid presets',()=>{
 const cx=vm.createContext({console}),run=code=>vm.runInContext(code,cx);
 run('const messages=[],solves=[],post=m=>messages.push(m);let ship={name:"worker"},shipGen=3,lastStats={gen:3,S:{propulsion:{preset:"combat",actualInputW:42}}};const C={propulsionPreview:(s,stats,preset)=>{solves.push({s,stats,preset});return{preset,actualInputW:preset==="max"?97:20};}};');run(fn(engine,'handlePropulsionPreview'));
 run('handlePropulsionPreview({id:1,gen:3,preset:"combat"});handlePropulsionPreview({id:2,gen:3,preset:"max"});handlePropulsionPreview({id:3,gen:3,preset:"cruise"});');
 assert.equal(run('messages[0].preview===lastStats.S.propulsion'),true);assert.deepEqual(plain(run('solves.map(x=>x.preset)')),['max','cruise']);assert.equal(run('solves.every(x=>x.s===ship&&x.stats===lastStats.S)'),true);
 run('handlePropulsionPreview({id:4,gen:2,preset:"max"});handlePropulsionPreview({id:5,gen:4,preset:"max"});handlePropulsionPreview({id:6,gen:3,preset:"unknown"});lastStats.gen=2;handlePropulsionPreview({id:7,gen:3,preset:"max"});lastStats=null;handlePropulsionPreview({id:8,gen:3,preset:"max"});');
 assert.equal(run('messages.slice(3).every(m=>m.preview===null)'),true);assert.equal(run('solves.length'),2);assert.equal(run('messages.every(m=>m.type==="propulsionPreview")'),true);assert.deepEqual(plain(run('messages.map(m=>m.id)')),[1,2,3,4,5,6,7,8]);
});

test('ordinary hull picks reuse the worker BVH while embedded ship launchers retain their recess geometry',()=>{
 const cx=vm.createContext({}),run=code=>vm.runInContext(code,cx);
 run(`let ship={fits:[]};const calls=[],st={view:'normal'},C={isShipLauncher:f=>f.k==='launcher'},envHit=(o,d,clip,options)=>{calls.push(options);return null;},partHit=()=>null,fitHit=()=>null;`);run(fn(app,'pickRay'));
 for(const [fits,expected]of [[[],false],[[{k:'gun'}],false],[[{k:'launcher',launcherEmbedded:false}],false],[[{k:'launcher'}],true],[[{k:'launcher',launcherEmbedded:true}],true]]){
  run('ship.fits='+JSON.stringify(fits)+';pickRay([0,0,0],[1,0,0],{parts:false,fits:false})');assert.equal(run('calls.at(-1).launcherCuts'),expected);
 }
});

test('hover ray work is coalesced and camera pointer or wheel input cancels it before it can block',()=>{
 const cx=vm.createContext({}),run=code=>vm.runInContext(code,cx);run(`const performance={now:()=>0},timers=new Map(),picks=[],listeners={};let nextTimer=0,queuedHover=null,hoverTimer=0,hoverLines=null,ship={fits:[]},dragSnap=null;const fleet={mode:'design'},trial={on:false},shot={on:false},eng={gen:1},live={pointerActive:false},view={cam:{r:1000}},tool=()=> 'fit',previewInput=()=>{},requestDraw=()=>{},ghostFor=x=>x,refreshOverlay=()=>{},pick=(x,y)=>{picks.push([x,y]);return{x,y};},setTimeout=fn=>(timers.set(++nextTimer,fn),nextTimer),clearTimeout=id=>timers.delete(id),canvas={addEventListener:(name,fn)=>listeners[name]=fn,setPointerCapture(){}};`);
 for(const name of ['cancelQueuedHover','onHover','attachControls'])run(fn(app,name));run('attachControls(canvas);onHover(10,20);onHover(30,40)');assert.equal(run('picks.length'),0);assert.equal(run('timers.size'),1);
 run('listeners.pointerdown({pointerId:1,clientX:30,clientY:40,button:2,pointerType:"mouse"})');assert.equal(run('timers.size'),0);assert.equal(run('picks.length'),0);
 run('onHover(50,60);listeners.wheel({deltaY:20,preventDefault(){}})');assert.equal(run('timers.size'),0);assert.equal(run('picks.length'),0);assert.ok(run('view.cam.r>1000'));
 run('onHover(70,80);timers.values().next().value()');assert.deepEqual(plain(run('picks')),[[70,80]]);
});

test('queued hover from a changed generation or active camera gesture cannot perform a stale pick',()=>{
 for(const change of ['eng.gen++','ship={fits:[]}','live.pointerActive=true','dragSnap={held:true}']){
  const cx=vm.createContext({}),run=code=>vm.runInContext(code,cx);run(`let timer,queuedHover=null,hoverTimer=0,hoverLines=null,ship={fits:[]},dragSnap=null,picks=0;const fleet={mode:'design'},trial={on:false},view={},eng={gen:1},live={pointerActive:false},tool=()=> 'fit',ghostFor=x=>x,refreshOverlay=()=>{},pick=()=>{picks++;},setTimeout=fn=>(timer=fn,1),clearTimeout=()=>{};`);run(fn(app,'onHover'));run('onHover(1,2)');run(change);run('timer()');assert.equal(run('picks'),0,change);
 }
});

test('editor shadows wait for idle current engineering and restore the previous rendering preference',()=>{
 const cx=vm.createContext({}),run=code=>vm.runInContext(code,cx);run('let view={noShadow:false},busy=false;const dirty={draw:false},eng={ready:true,gen:2,geoGen:1,statsGen:1},previewInputBusy=()=>busy;');run(fn(app,'syncEditorShadowBudget'));
 run('syncEditorShadowBudget()');assert.equal(run('view.noShadow'),true);assert.equal(run('dirty.draw'),true);run('eng.geoGen=eng.statsGen=2;busy=true;dirty.draw=false;syncEditorShadowBudget()');assert.equal(run('view.noShadow'),true);run('busy=false;syncEditorShadowBudget()');assert.equal(run('view.noShadow'),false);assert.equal(run('dirty.draw'),true);
 run('view={noShadow:true};eng.uploading=1;syncEditorShadowBudget();eng.uploading=0;syncEditorShadowBudget()');assert.equal(run('view.noShadow'),true,'an existing low-cost rendering preference must be retained');
});
