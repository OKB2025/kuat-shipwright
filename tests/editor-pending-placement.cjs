const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),source=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),core=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),core,{filename:f});
const C=vm.runInContext('Core',core),blueprint=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/mandator2.json.gz')))),plain=x=>JSON.parse(JSON.stringify(x));
function cut(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return source.slice(i,j);}
function fixture(){
 const ship=C.deserialize(plain(blueprint));ship._client=true;
 const eng={gen:1,adoptedGen:0,geoGen:0,statsGen:0,designGen:1,ready:true},stored=new Map(),cx=vm.createContext({console,C,ship,eng,S:null,view:{},meshStore:{dims:null},dirty:{overlay:false},requestDraw(){},editorPartsRevision:0,saveT:0,LS:{set:(k,v)=>stored.set(k,v)},clearTimeout(){},setTimeout(fn){cx.savedCallback=fn;return 1;},snap:()=>JSON.stringify(C.serialize(ship)),draftMeta:()=>null});
 vm.runInContext('function enginePending(){return eng.adoptedGen<eng.gen;}',cx);
 vm.runInContext(cut('const requestedParts =','function enginePickParts('),cx);
 vm.runInContext(cut('function actualShipDimensions()','function shapeDimensionSlider('),cx);
 vm.runInContext(source.match(/^function autosave\(\).*$/m)[0],cx);
 return {ship,eng,cx,stored,run:code=>vm.runInContext(code,cx)};
}
function authoringPacket(s,gen){
 const sourceState=C.publicJSON(s),worker=JSON.parse(sourceState),items={};C.hullGeo(worker);C.referenceHullGeometry(worker);
 for(const p of worker.parts)if(C.isShapePart(p)){C.structTriangles(p);const cache={};for(const[k,v]of Object.entries(p))if(k[0]==='_'&&k!=='_solidCutShip')cache[k]=v;cache._solidCutShip={$r:'ship'};items[p.id]=cache;}
 C.rayEnv(worker,[worker.hull.L/2,1e7,0],[0,-1,0],{structOnly:true});
 return structuredClone({type:'authoringGeometry',gen,sourceState,caches:{ship:{},items:{parts:items,fits:{},hatches:{}},geoProxy:{hull:C.hullGeo(worker),ref:C.referenceHullGeometry(worker)}}});
}

test('a deferred real Mandator draft and autosave metadata never start geometry or propulsion',()=>{
 const f=fixture();f.ship._deferredPreparation=true;f.eng.ready=false;f.eng.gen=f.eng.adoptedGen=0;f.cx.view=null;f.cx.draftMeta=()=>({name:f.ship.name,L:8123});
 const guarded={...C,shipDimensions(){throw Error('full physical dimensions on UI');},shipBounds(){throw Error('cold bounds on startup/save');},enginePaths(){throw Error('physical routes on UI');}};f.cx.C=guarded;
 assert.equal(f.run('actualShipDimensions()[0]'),8123);assert.equal(f.run('autosaveShipLength()'),8123);
 f.run('autosave()');f.cx.savedCallback();assert.equal(JSON.parse(f.stored.get('yard.draft3.meta')).L,8123);assert.ok(f.stored.get('yard.draft3'));
 delete f.ship._deferredPreparation;f.cx.draftMeta=()=>null;assert.equal(f.run('actualShipDimensions()[0]'),8000);assert.equal(f.run('autosaveShipLength()'),8000);
});

test('requested owned-hull geometry stays warm through fit edits and equivalent worker object replacement',()=>{
 const f=fixture(),p=f.ship.parts.find(C.isHullStructure);f.cx.p=p;const q=f.run('requestedPart(p)'),T=C.structTriangles(q),local=q._hullShip,hp=q.hullProfile,data=q.hullData;
 assert.notEqual(q.hullProfile,p.hullProfile,'the proxy owns its authored snapshot');assert.equal(typeof Object.getOwnPropertyDescriptor(local,'cuts').get,'function');
 for(let i=0;i<3;i++){f.eng.gen++;assert.equal(f.run('editorMountShip().parts.find(x=>x.id===p.id)'),q);assert.equal(C.structTriangles(q),T);}
 p.hullProfile=plain(p.hullProfile);p.hullData=plain(p.hullData);f.eng.adoptedGen++;f.run('editorPartsRevision++');
 assert.equal(f.run('requestedPart(p)'),q);assert.equal(q.hullProfile,hp);assert.equal(q.hullData,data);assert.equal(q._hullShip,local);assert.equal(C.structTriangles(q),T,'public-equal worker replies keep local geometry and getters');
 const oldX=C.partAABB(q)[0];p.c[0]+=10;assert.equal(f.run('requestedPart(p)'),q);assert.equal(q.c[0],p.c[0]);assert.notEqual(q.c,p.c);assert.ok(Math.abs(C.partAABB(q)[0]-oldX-10)<1e-3);assert.equal(q._hullShip,local,'translation keeps the same local hull');
 p.hullProfile.stations[0][1]+=.01;f.run('editorPartsRevision++');assert.equal(f.run('requestedPart(p)'),q);assert.notEqual(q.hullProfile,hp,'in-place profile editing replaces the authored definition');assert.notEqual(C.hullStructureShip(null,q),local,'a changed hull receives fresh local geometry');
});

test('cold authored dimensions are cached and saving never asks for physical bounds',()=>{
 const f=fixture();let calls=0;f.cx.C={...C,shipDimensions(){throw Error('full dimensions');},shipBounds(model,options){assert.equal(options.simple,true);calls++;return C.shipBounds(model,options);}};
 const dimensions=plain(f.run('actualShipDimensions()'));assert.ok(dimensions[0]>=8000);assert.equal(calls,0);assert.deepEqual(plain(f.run('actualShipDimensions()')),dimensions);assert.equal(calls,0);assert.equal(f.run('autosaveShipLength()'),dimensions[0]);assert.equal(calls,0);
 f.eng.gen++;assert.equal(f.run('autosaveShipLength()'),8000);assert.equal(calls,0,'autosave does not warm a new generation');
 f.cx.S={dims:[8100,3000,1100]};f.eng.statsGen=f.eng.gen;assert.deepEqual(plain(f.run('actualShipDimensions()')),[8100,3000,1100]);
});

test('cold Mandator bounds and picking stay coarse until exact worker caches hydrate without rebuilding the hull',()=>{
 const f=fixture(),p=f.ship.parts.find(C.isHullStructure);f.cx.p=p;assert.equal(f.run('editorOwnedHullReady(p)'),false);const b=plain(f.run('editorDirectBounds()'));assert.ok(b[3]-b[0]>=8000);assert.equal(f.run('requestedPart(p)._hullShip'),undefined,'bounds must not compile a local hull');assert.equal(f.run('editorMountShip().parts.some(x=>x.id===p.id)'),false,'a cold hull cannot invent a pick surface');
 const sourceState=C.publicJSON(f.ship),worker=JSON.parse(sourceState);C.hullGeo(worker);const wp=worker.parts.find(x=>x.id===p.id),T=C.structTriangles(wp),packet={type:'authoringGeometry',gen:1,sourceState,caches:{ship:{},items:{parts:{[p.id]:{_hullShip:wp._hullShip,_hullGeometry:wp._hullGeometry,_solidGeometry:wp._solidGeometry,_apertures:wp._apertures,_solidCutShip:{$r:'ship'}}},fits:{},hatches:{}},geoProxy:{hull:C.hullGeo(worker)}}};
 f.eng.gen++;f.ship.fits.push({id:f.ship.nextId++,k:'pd',p:[30,500,500],a:2,ped:0});const before=C.publicJSON(f.ship);f.cx.packet=structuredClone(packet);assert.equal(f.run('onEngineAuthoringGeometry(packet)'),true,'a newer plain gun does not invalidate physical hull geometry');assert.equal(C.publicJSON(f.ship),before,'only derived cache fields are accepted');assert.equal(f.run('editorOwnedHullReady(p)'),true);const q=f.run('requestedPart(p)'),local=q._hullShip,world=q._hullGeometry,cache=local._cache;assert.equal(typeof Object.getOwnPropertyDescriptor(local,'cuts').get,'function');assert.notEqual(local,p._hullShip,'native engine queries and authored preview each own their local getter bindings');assert.equal(C.structTriangles(q),world.g.tris);assert.equal(q._hullShip,local);assert.equal(local._cache,cache);assert.equal(q._hullGeometry,world);assert.deepEqual(Array.from(C.structTriangles(q)),Array.from(T));assert.equal(typeof Object.getOwnPropertyDescriptor(p._hullShip,'cuts').get,'function');assert.equal(f.run('editorMountShip().parts.find(x=>x.id===p.id)'),q);
 const changes=[
  {name:'host position',whole:false,apply:s=>{s.parts.find(C.isHullStructure).c[0]+=2;}},
  {name:'profile vertex',whole:false,apply:s=>{s.parts.find(C.isHullStructure).hullProfile.stations[0][1]+=.01;}},
  {name:'solid cut',whole:true,apply:s=>s.solidCuts.push(C.normalizeSolidCut({id:999999,c:[100,10,0],s:[10,10,10],structures:true}))},
  {name:'hatch',whole:true,apply:s=>s.hatches.push({id:999999,portal:true,cut:[1,1,1,2,2,2],open:1})},
  {name:'reference skin',whole:true,apply:s=>{s.hullSkin={asset:'different-hull'};}}
 ];
 for(const change of changes){const g=fixture();g.cx.packet=structuredClone(packet);change.apply(g.ship);g.run('editorPartsRevision++');assert.equal(g.run('onEngineAuthoringGeometry(packet)'),!change.whole,change.name+' changes reject stale geometry');assert.equal(g.run('ship.parts.filter(C.isHullStructure).some(editorOwnedHullReady)'),false,change.name+' cannot prepare the changed hull');}
});

test('ordinary and mirrored placement use the same authored parts and commit the shared fit IDs',()=>{
 const f=fixture();f.ship.fits=[];const p=f.ship.parts.find(C.isHullStructure);f.cx.p=p;C.structTriangles(f.run('requestedPart(p)'));f.run('editorMountShip()');let model;
 f.cx.C={...C,placeFit(context,k,pos,n,ped,mirror){model=context;assert.notEqual(context,f.ship);assert.equal(context.fits,f.ship.fits);assert.equal(context.parts.find(x=>x.id===p.id),f.run('requestedPart(p)'));const one={id:context.nextId++,k,p:pos};context.fits.push(one);if(mirror)context.fits.push({id:context.nextId++,k,p:[pos[0],pos[1],-pos[2]]});return {fit:one};}};
 const before=f.ship.nextId,result=f.run("placeEditorFit('utl',[2000,300,600],[0,1,0],0,true,{})");assert.equal(result.fit.id,before);assert.equal(f.ship.fits.length,2);assert.equal(f.ship.nextId,before+2);assert.equal(model.parts.find(x=>x.id===p.id).hullProfile.L,p.hullProfile.L);
 f.cx.C.placeFit=context=>{context.nextId++;throw Error('failed after reserving an id');};assert.throws(()=>f.run("placeEditorFit('utl',[0,0,0],[0,1,0],0,false,{})"),/reserving/);assert.equal(f.ship.nextId,before+3);
});

test('ready mounting preserves authored cuts and early hatch packets keep open and closed roofs exact',()=>{
 const f=fixture(),s=C.newShip({L:100,W:60,H:40,assembly:true},'Cut and hatch'),box={id:1,k:'struct',form:'box',c:[50,10,0],s:[100,40,20]};s.parts=[box];s.fits=[];s.nextId=10;s.solidCuts=[C.normalizeSolidCut({id:2,c:[50,10,0],s:[20,20,40],rotation:[0,0,0],structures:true})];C.hullGeo(s);C.structTriangles(box);s._client=true;f.cx.ship=s;f.cx.o=[50,25,0];f.cx.d=[0,-1,0];f.eng.gen=f.eng.adoptedGen=1;
 assert.equal(f.run('editorMountShip()'),s);assert.equal(f.run('C.rayEnv(editorMountShip(),o,d,{structOnly:true,maxT:10})'),null);assert.equal(f.run("C.mountFit(editorMountShip(),{id:9,k:'pd',p:[50,20,0],a:2,ped:0,mountMode:'top'}).float"),true);f.eng.gen++;assert.equal(f.run('C.rayEnv(editorMountShip(),o,d,{structOnly:true,maxT:10})'),null,'a fit-only pending generation retains the finished cut');
 const bayShip=C.newShip({L:100,W:60,H:40,assembly:true},'Bay aperture'),skin={id:1,k:'struct',form:'box',c:[50,10,0],s:[100,40,20]},bay={id:10,k:'hangar',c:[50,16,0],room:[20,20,8],d:10,autoFit:false};bayShip.parts=[skin,bay];bayShip.fits=[];bayShip.nextId=11;C.openBay(bayShip,bay,'top','open');const opened=authoringPacket(bayShip,2);bayShip._client=true;f.cx.ship=bayShip;f.eng.gen=2;f.eng.adoptedGen=1;f.run('editorPartsRevision++');assert.equal(f.run('editorCanMeshPart(ship.parts[0])'),false,'the unprepared hatch host has no phantom roof');
 f.cx.packet=opened;assert.equal(f.run('onEngineAuthoringGeometry(packet)'),true);assert.equal(f.run('C.rayEnv(editorMountShip(),o,d,{structOnly:true,maxT:10}).p[1]'),16,'the pre-engineering packet sees the open bay floor');f.eng.adoptedGen=f.eng.gen;assert.equal(f.run('editorMountShip()'),bayShip);assert.equal(f.run('C.rayEnv(editorMountShip(),o,d,{structOnly:true,maxT:10}).p[1]'),16);
 bayShip.hatches[0].open=0;f.eng.gen++;f.run('editorPartsRevision++');assert.equal(f.run('editorCanMeshPart(ship.parts[0])'),false,'opening state invalidates a public-equal structural host');f.cx.packet=opened;assert.equal(f.run('onEngineAuthoringGeometry(packet)'),false,'an earlier open hatch cannot replace the closed hatch');f.cx.packet=authoringPacket(bayShip,3);assert.equal(f.run('onEngineAuthoringGeometry(packet)'),true);assert.equal(f.run('C.rayEnv(editorMountShip(),o,d,{structOnly:true,maxT:10}).p[1]'),20,'the closed roof replaces the old aperture');
});

test('selecting an unprepared owned hull displays pending volume without compiling it',()=>{
 const f=fixture(),p=f.ship.parts.find(C.isHullStructure);f.cx.p=p;f.cx.esc=String;f.cx.num=String;f.cx.C={...C,partVolume(){throw Error('cold selected hull volume');}};vm.runInContext(cut('function stripFacts(t)','function renderSelStrip('),f.cx);vm.runInContext(cut('function partInfoHTML(pt)','// ---------- toast ----------'),f.cx);assert.match(f.run("stripFacts({list:'parts',it:p}).line"),/計算中/);assert.match(f.run('partInfoHTML(p)'),/計算中/);assert.equal(f.run('requestedPart(p)._hullShip'),undefined);
});

test('engine hover broadphase skips remote skins and encloses rotated exact engine vertices',()=>{
 const f=fixture(),engines=f.ship.parts.filter(p=>p.k==='engine'),p=engines[0];assert.ok(engines.length>1);f.eng.adoptedGen=f.eng.gen;f.cx.p=p;let transformed=0,rays=0;
 f.cx.C={...C,referenceEnginePoint(...args){transformed++;return C.referenceEnginePoint(...args);},engineSkinMesh(){throw Error('cold engine skin outside ray');},rayEnv(model){rays++;assert.equal(model.parts.some(p=>p.k==='engine'),false,'every remote engine must be rejected before Core.rayEnv');return null;}};
 assert.equal(f.run('editorRayEnv([1e7,1e7,1e7],[1,0,0])'),null);assert.equal(rays,1);assert.ok(transformed>=engines.length*8&&transformed<=engines.length*12);const first=transformed;f.run('editorRayEnv([1e7,1e7,1e7],[1,0,0])');assert.equal(transformed,first,'a repeated ray reuses metadata bounds');
 for(const pose of [{dir:p.dir,roll:p.roll||0},{dir:[-.36,.48,.8],roll:37}]){Object.assign(p,pose);f.run('editorRayPartMayHit(p,[1e7,1e7,1e7],[1,0,0])');const b=f.run('editorEngineBounds.get(p).bounds'),mesh=C.engineSkinMesh(p);for(let i=0;i<mesh.pos.length;i++)assert.ok(mesh.pos[i]>=b[i%3]-1e-3&&mesh.pos[i]<=b[i%3+3]+1e-3,'the broadphase contains exact source vertices');f.cx.b=b;assert.equal(f.run('editorRayPartMayHit(p,[0,1,2].map(i=>(b[i]+b[i+3])/2),[1,0,0])'),true,'inside origins always reach the exact skin query');assert.equal(f.run('editorRayPartMayHit(p,[b[0]-100,(b[1]+b[4])/2,(b[2]+b[5])/2],[1,0,0],10)'),false);}
});

test('fitting picking passes the nearest exact obstruction and fitting distance before building another gun',()=>{
 const f=fixture(),limits=[];f.ship.fits=[{id:1,k:'pd'},{id:2,k:'pd'},{id:3,k:'pd'}];f.cx.Gfx={rayFit(o,d,fit,maxT){limits.push(maxT);return fit.id===1?{t:60,p:[0,0,0]}:fit.id===2?{t:40,p:[0,0,0]}:{t:45,p:[0,0,0]};}};vm.runInContext(cut('function fitPickHit(','function pick('),f.cx);assert.equal(f.run('fitHit([0,0,0],[1,0,0],50).fit.id'),2);assert.deepEqual(limits,[50,50,40],'an occluded candidate cannot enlarge the precise query range');
});

test('palette classification reuses exact hull evidence and small-craft extent changes match Core',()=>{
 const f=fixture(),p=f.ship.parts.find(C.isHullStructure);f.cx.p=p;C.structTriangles(f.run('requestedPart(p)'));let surveys=0;f.cx.C={...C,isCraft(){throw Error('repeated full UI classification');},shipBounds(){surveys++;throw Error('capital palette must not survey all fittings');}};
 for(let i=0;i<4;i++){f.eng.gen++;assert.equal(f.run('editorCraftDesign()'),false);}assert.equal(surveys,0,'a prepared 8 km hull is already exact evidence that the whole design exceeds craft length');
 const small=C.newShip({L:12,W:8,H:4,assembly:true},'Small craft');small.parts=[{id:1,k:'struct',form:'box',c:[6,2,0],s:[12,8,4]}];small.fits=[];small.shipClass='starfighter';small._client=true;f.cx.ship=small;f.cx.C=C;f.run('editorPartsRevision++');assert.equal(f.run('editorCraftDesign()'),C.isCraft(small));small.parts[0].s[0]=120;f.eng.gen++;f.run('editorPartsRevision++');assert.equal(f.run('editorCraftDesign()'),C.isCraft(small));assert.equal(f.run('editorCraftDesign()'),false,'an extended structure can move a craft into the ship catalogue order');small.parts[0].s[0]=12;f.eng.gen++;f.run('editorPartsRevision++');assert.equal(f.run('editorCraftDesign()'),true);
});

test('early exact geometry replaces the cached coarse dimensions and catalogue class without another edit',()=>{
 const f=fixture(),s=C.newShip({L:120,W:30,H:20,plan:'rect',sec:'rect',start:.9,bowW:1,bowH:1,stern:1},'Cropped hull');C.ensurePrimaryHull(s,{newDesign:true});s.shipClass='smallcraft';const packet=authoringPacket(s,1);s._client=true;f.cx.ship=s;f.cx.packet=packet;assert.equal(f.run('editorCraftDesign()'),false,'the temporary full authored extent exceeds craft size');const pending=f.run('actualShipDimensions()[0]');assert.ok(pending>=120);assert.equal(f.run('onEngineAuthoringGeometry(packet)'),true);assert.ok(f.run('actualShipDimensions()[0]')<30,'the measured cropped hull replaces the coarse extent in the same generation');assert.equal(f.run('editorCraftDesign()'),C.isCraft(s));assert.equal(f.run('editorCraftDesign()'),true);
});

test('fast history keeps portable restoration parity for the archive, surfaces, groups and embedded launchers',()=>{
 const f=fixture(),p=f.ship.parts.find(C.isHullStructure),launcher={id:f.ship.nextId++,k:'shipMsl',p:[4000,500,200],a:2,n:[0,1,0],ped:0,base:0,low:0,launcherCols:3,launcherRows:2,launchPitch:27,launchYaw:-31,launcherEmbedded:true};f.ship.fits.push(launcher);f.ship.groups=[{id:f.ship.nextId++,name:'Hull and launcher',parts:[p.id],fits:[launcher.id],groups:[]}];f.ship.surfaces={version:4,mode:'strict',armorOnly:1,patches:[{id:'p'+p.id+':top:bounds',functionMode:'armor',armor:{material:'standard',thickness:.7},style:{seed:8}}]};p.hullData.paint='cis';
 f.cx.newSaveId=()=> 'history-parity';vm.runInContext(cut('function snap(','function newSaveId('),f.cx);let portableCalls=0,publicCalls=0;f.cx.C={...C,serialize(s){portableCalls++;return C.serialize(s);},publicJSON(s){publicCalls++;return C.publicJSON(s);}};
 const fast=f.run('snap()');assert.equal(portableCalls,0);assert.equal(publicCalls,1,'history uses one existing public-state transport pass');const portable=f.run('snap(true)');assert.equal(portableCalls,1);assert.equal(JSON.parse(fast)._historySaveId,JSON.parse(portable)._historySaveId);const canonical=s=>C.publicJSON(C.serialize(C.deserialize(JSON.parse(s))));assert.equal(canonical(fast),canonical(portable),'the normal loader restores identical authored geometry, ownership, links, surfaces, groups and launcher settings');f.run('autosave()');f.cx.savedCallback();assert.equal(portableCalls,2,'autosave keeps the portable serializer');assert.equal(canonical(f.stored.get('yard.draft3')),canonical(portable));
 f.cx.C=C;f.cx.fast=fast;f.cx.portable=portable;Object.assign(f.cx,{view:null,st:{sel:null},prevS:null,lastOp:'',dragSnap:null,dragLabel:'',undoStack:[fast],redoStack:[],reconcileSolidCutter(){},hideInspect(){},renderPanel(){},scheduleStats(){},autosave(){},updateName(){},findSel(){return null;},$:()=>({}),touch(){f.eng.gen++;}});vm.runInContext(cut('function restore(json)','function updateName()'),f.cx);
 f.ship.fits[0].chargeSalvos=(f.ship.fits[0].chargeSalvos||1)+1;const modified=f.run('snap()');f.run('undo()');assert.equal(C.publicJSON(C.serialize(f.ship)),canonical(portable));f.run('redo()');assert.equal(C.publicJSON(C.serialize(f.ship)),canonical(modified));
});

test('pending turret information uses static requirements and never solves clipping, capacitors or firing arcs',()=>{
 const f=fixture(),gun=f.ship.fits.find(x=>x.k==='utl');f.cx.gun=gun;
 Object.assign(f.cx,{num:n=>String(n),fTT:n=>String(n),fW:n=>String(n),fPct:n=>String(n),fmtM:n=>String(n),esc:x=>String(x),fitPedestalAllowed:()=>false,slider:()=>'',packingInfoHTML:()=>'',feedSrc:()=>'',ja:n=>String(n)});
 f.cx.C={...C,turretCompartment(){throw Error('synchronous clipping');},weaponCapacitors(){throw Error('all turret allocation');},fireArcs(){throw Error('synchronous firing arcs');}};
 vm.runInContext(cut('function turretCompartmentHTML(','function weaponMountControls('),f.cx);vm.runInContext(cut('function fitDetailHTML(','function hullDetailHTML('),f.cx);
 let html=f.run('turretCompartmentHTML(gun)');assert.match(html,/計算中/);assert.match(html,/required/);assert.match(f.run('fitDetailHTML(gun)'),/射界を計算中/);
 f.cx.S={chargeInfo:{[gun.id]:{...C.weaponChargeSpec(gun),required:28800,plannedVolume:28800,housingVolume:100,externalVolume:80,embeddedVolume:20,housingUsed:100,internalRequired:28700,internalVolume:28700,volume:28800,capacityRatio:1,allocationPending:false}},fitInfo:{[gun.id]:[1,0,0,0,0,0]},feedInfo:{}};f.eng.statsGen=f.eng.gen;
 html=f.run('turretCompartmentHTML(gun)');assert.doesNotMatch(html,/充電容量 計算中/);assert.match(f.run('fitDetailHTML(gun)'),/射界（%）/);
});

test('pending generic hover and route inspection never start engineering and mark mirrored drafts pending',()=>{
 const f=fixture(),out=[];let checks=0;
 Object.assign(f.cx,{st:{mirror:true,vmirror:true},tool:()=> 'part',partPreview:()=>({id:-1,k:'shield',c:[400,0,25],d:10}),Gfx:{lineSet:()=>({part:(p,color)=>out.push({p,color})})}});
 f.cx.C={...C,hardConflicts(){checks++;throw Error('full occupancy on pending hover');},enginePaths(){throw Error('route calculation on pending inspection');}};
 vm.runInContext('let enginePickCache=null;',f.cx);vm.runInContext(cut('function ghostFor(','function refreshOverlay('),f.cx);vm.runInContext(cut('function enginePickParts(','function partHit('),f.cx);
 f.run("ghostFor({kind:'part',p:[0,0,0],n:[0,1,0]})");assert.equal(checks,0);assert.equal(out.length,4);assert.ok(out.every(x=>x.color[0]===105&&x.color[1]===195&&x.color[2]===220));assert.equal(f.run('enginePickParts().length'),0);
 f.eng.gen=f.eng.adoptedGen=0;f.eng.ready=false;f.ship._deferredPreparation=true;out.length=0;f.run("ghostFor({kind:'part',p:[0,0,0],n:[0,1,0]})");assert.equal(out.length,4);assert.equal(checks,0,'the generation-zero restored draft also stays pending');
});

test('progressive draft filling yields to input while urgent edits keep the newest geometry',()=>{
 let clock=100,cleared=0;const calls=[],cx=vm.createContext({console,performance:{now:()=>clock},calls});
 vm.runInContext(`let ship={parts:[{id:1}],fits:[{id:2}]},dragSnap=null;const eng={gen:1},st={coded:false,foilView:null},requestedPart=p=>p,editorCanMeshPart=()=>true,requestDraw=()=>{},view={upload(){},meshes:{}};`,cx);
 cx.Gfx={meshPreview:(ship,parts,fits,opts)=>{calls.push({parts:parts.map(x=>x.id),fits:fits.map(x=>x.id),opts});return {pending:calls.length<4};},clearPreviewCache:()=>cleared++};
 vm.runInContext(cut('// ---------- live preview ----------','function previewDraft()'),cx);const run=code=>vm.runInContext(code,cx);
 run("queuePreview('parts',ship.parts);queuePreview('fits',ship.fits);flushLivePreview()");assert.equal(calls.length,1);assert.equal(calls[0].opts.progressive,true);assert.equal(calls[0].opts.incremental,true);assert.equal(calls[0].opts.budgetMs,6);assert.equal(calls[0].opts.revision,1);
 run('previewInput(true);flushLivePreview()');assert.equal(calls.length,1,'orbiting pauses background chunks');
 run("ship.fits.push({id:3});eng.gen++;queuePreview('fits',[ship.fits[1]]);flushLivePreview()");assert.equal(calls.length,2);assert.deepEqual(plain(calls[1].fits),[2,3]);assert.deepEqual(plain(calls[1].opts.priorityFits.map(x=>x.id)),[3]);assert.equal(calls[1].opts.deferBackground,true);assert.equal(calls[1].opts.revision,2);
 run('previewInput(false);flushLivePreview()');assert.equal(calls.length,2);clock+=121;run('flushLivePreview()');assert.equal(calls.length,3);assert.equal(calls[2].opts.deferBackground,false);assert.equal(calls[2].opts.priorityFits.length,0);
 run('dragSnap="moving";flushLivePreview()');assert.equal(calls.length,3);run('dragSnap=null;flushLivePreview();flushLivePreview()');assert.equal(calls.length,4,'finished chunks do not schedule another preview');run('clearPreview();flushLivePreview()');assert.equal(cleared,1);assert.equal(run('live.pending'),false);assert.equal(calls.length,4);
});
