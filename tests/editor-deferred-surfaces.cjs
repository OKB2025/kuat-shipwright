const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test'),{performance}=require('node:perf_hooks');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const sources=['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'].map(file=>[file,fs.readFileSync(path.join(root,file),'utf8')]);
const plain=value=>JSON.parse(JSON.stringify(value));
function fixture({configured=false,inline=false}={}){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const[file,source]of sources)vm.runInContext(source,cx,{filename:file});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),messages=[],waiting=[],calls=[];
 const ship=C.newShip({L:100,W:80,H:50,assembly:true},'Deferred exposure');ship.parts=[];ship.fits=[];ship.hatches=[];ship.nextId=1;ship.armor={hull:0,cit:0};ship.detail=0;
 const host=C.placePart(ship,'struct',[50,20,0],[60,40,20],{form:'box'},false);
 if(configured){
  const face=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face==='top'&&p.exposed);
  assert.ok(face);assert.equal(C.setSurfaceConfig(ship,face.id,{functionMode:'equipment',allocation:{cooling:50,sensors:25,habitation:25},equipment:{depth:2,limit:3},battery:{weapon:'pd',count:1}}).ok,true);
 }
 const state=C.publicJSON(ship),surfacePatches=C.surfacePatches,surfaceReport=C.surfaceReport;
 C.surfacePatches=(s,...args)=>{calls.push({kind:'faces',name:s.name});return surfacePatches(s,...args);};
 C.surfaceReport=(s,...args)=>{calls.push({kind:'report',name:s.name});return surfaceReport(s,...args);};
 let hook=()=>{},send;
 const deliver=msg=>{
  if(msg.type==='ready')return;
  const packet=structuredClone(msg);messages.push(packet);calls.push({kind:'packet',type:packet.type,gen:packet.gen});hook(packet);
  for(const waiter of waiting.slice())if(packet.type==='error'||packet.type===waiter.type&&packet.gen===waiter.gen){
   waiting.splice(waiting.indexOf(waiter),1);clearTimeout(waiter.timer);packet.type==='error'?waiter.reject(Error(packet.message)):waiter.resolve(packet);
  }
 };
 if(inline)send=E.connectInline(deliver);
 else{const scope={postMessage:deliver};E.listenWorker(scope);send=data=>scope.onmessage({data});}
 const wait=(type,gen)=>new Promise((resolve,reject)=>{
  const found=messages.find(m=>m.type===type&&m.gen===gen);if(found){resolve(found);return;}
  const waiter={type,gen,resolve,reject,timer:setTimeout(()=>reject(Error(`No ${type} for generation ${gen}`)),10000)};waiting.push(waiter);
 });
 const update=(gen,extra={})=>send({type:'update',gen,state,what:['all'],reset:true,statsDelay:0,...extra});
 return{C,E,ship,state,host,messages,calls,send,update,wait,setHook:fn=>hook=fn};
}

test('the opt-in first geometry arrives before face exposure and the second packet contains full pick data and host references',async()=>{
 const f=fixture();f.update(1,{view:{deferSurfaces:true},stats:false});
 const first=await f.wait('geometry',1);
 assert.equal(f.calls.some(c=>c.kind==='faces'||c.kind==='report'),false,'the first usable mesh must not wait for a surface survey');
 assert.ok(first.geos.struct.ni>0);assert.ok(first.caches.geoProxy.hull);
 assert.equal(first.surfaceReport,undefined);assert.equal(first.caches.geoProxy.surfaces,undefined);assert.equal(first.caches.geoProxy.surfacePartitions,undefined);
 const complete=await f.wait('surfaceGeometry',1);
 assert.equal(complete.geos,undefined,'the second phase must not upload duplicate render meshes');
 assert.ok(complete.caches.geoProxy.surfaces.length>0);assert.equal(complete.surfaceReport,undefined,'a bare design retains the legacy optional-report contract');
 const face=complete.caches.geoProxy.surfaces.find(p=>p.host==='p'+f.host.id&&p.exposedArea>0);
 assert.ok(face);assert.deepEqual(face._part,{$r:'parts',id:f.host.id});assert.ok(face.exposedTriangles.length>0);
 assert.equal(complete.caches.geoProxy.surfacePartitions,JSON.stringify(f.ship.surfaces?.partitions||null));
 assert.ok(Number.isFinite(complete.surfaceMs));assert.equal(f.messages.some(m=>m.type==='stats'),false);
});

test('updates without the opt-in preserve the original geometry and statistics packet contract',async()=>{
 const f=fixture();f.update(1);const first=await f.wait('geometry',1);await f.wait('stats',1);
 assert.ok(first.caches.geoProxy.surfaces.length>0);assert.equal(first.surfaceReport,undefined);
 assert.deepEqual(f.messages.map(m=>m.type),['geometry','stats']);
 assert.ok(f.calls.findIndex(c=>c.kind==='faces')<f.calls.findIndex(c=>c.kind==='packet'&&c.type==='geometry'));
});

test('a configured equipment face retains identical public design, surface ledger, statistics and profile after deferred completion',async()=>{
 const normal=fixture({configured:true}),deferred=fixture({configured:true});
 normal.update(1);deferred.update(1,{view:{deferSurfaces:true}});
 const [a,b,faces]=await Promise.all([normal.wait('stats',1),deferred.wait('stats',1),deferred.wait('surfaceGeometry',1)]);
 const original=await normal.wait('geometry',1);
 assert.deepEqual(JSON.parse(faces.state),JSON.parse(original.state));
 assert.deepEqual(plain(faces.surfaceReport),plain(original.surfaceReport));
 assert.deepEqual(plain(faces.caches.geoProxy.surfaces),plain(original.caches.geoProxy.surfaces));
 assert.deepEqual(plain(b.stats),plain(a.stats));assert.deepEqual(plain(b.profile),plain(a.profile));
 assert.ok(b.stats.surface.patches.some(p=>p.config?.functionMode==='equipment'));
 assert.equal(JSON.parse(faces.state).parts.length,1,'surface adapters remain private to the simulation');
});

test('an edit queued after the first geometry skips the obsolete surface survey and statistics',async()=>{
 const f=fixture(),next=JSON.parse(f.state);next.name='Current generation';next.parts[0].c[0]+=5;
 f.setHook(msg=>{if(msg.type==='geometry'&&msg.gen===1)f.update(2,{state:JSON.stringify(next),view:{deferSurfaces:true}});});
 f.update(1,{view:{deferSurfaces:true}});const complete=await f.wait('surfaceGeometry',2);await f.wait('stats',2);
 assert.equal(f.messages.some(m=>m.gen===1&&['surfaceGeometry','stats'].includes(m.type)),false);
 assert.ok(f.calls.filter(c=>c.kind==='faces'||c.kind==='report').every(c=>c.name==='Current generation'));
 assert.equal(JSON.parse(complete.state).name,'Current generation');
});

test('inline delivery yields its first mesh and accepts a following edit before surveying obsolete faces',async()=>{
 const f=fixture({inline:true}),next=JSON.parse(f.state);next.name='Inline edit';
 f.setHook(msg=>{if(msg.type==='geometry'&&msg.gen===1){assert.equal(f.calls.some(c=>c.kind==='faces'||c.kind==='report'),false);f.update(2,{state:JSON.stringify(next),view:{deferSurfaces:true},stats:false});}});
 f.update(1,{view:{deferSurfaces:true},stats:false});const complete=await f.wait('surfaceGeometry',2);
 assert.equal(f.messages.some(m=>m.type==='surfaceGeometry'&&m.gen===1),false);
 assert.ok(f.calls.filter(c=>c.kind==='faces'||c.kind==='report').every(c=>c.name==='Inline edit'));
 assert.equal(JSON.parse(complete.state).name,'Inline edit');
});
