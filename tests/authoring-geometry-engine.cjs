const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function fixture(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),messages=[],waiters=[];
 const scope={postMessage(message){const copy=structuredClone(message);messages.push(copy);scope.inspect?.(copy);for(const w of waiters.slice())if((copy.type===w.type||copy.type==='error')&&copy.gen===w.gen){waiters.splice(waiters.indexOf(w),1);copy.type==='error'?w.reject(Error(copy.message)):w.resolve(copy);}}};
 E.listenWorker(scope);
 const wait=(type,gen)=>new Promise((resolve,reject)=>{const hit=messages.find(m=>m.gen===gen&&(m.type===type||m.type==='error'));if(hit)hit.type==='error'?reject(Error(hit.message)):resolve(hit);else waiters.push({type,gen,resolve,reject});});
 const ship=C.newShip({L:80,W:60,H:40,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Early authored geometry');ship.parts=[];ship.fits=[];ship.detail=0;ship.armor={hull:0,cit:0};
 const hull=C.ensurePrimaryHull(ship,{newDesign:true});
 const send=(gen,state,what=['all'],reset=false)=>scope.onmessage({data:{type:'update',gen,state,what,reset,stats:false,view:{deferSurfaces:true}}});
 return {C,E,ship,hull,messages,scope,wait,send};
}
const plain=v=>JSON.parse(JSON.stringify(v));

test('the exact owned hull is delivered before engineering and surface surveys',async()=>{
 const f=fixture(),{C,ship,hull,send,wait,messages}=f;
 hull.yaw=17;hull.pitch=4;hull.hullData.solidCuts=[C.normalizeSolidCut({id:70,shape:'box',c:[40,35,0],s:[12,20,20]})];
 ship.solidCuts=[C.normalizeSolidCut({id:71,shape:'box',c:[25,35,0],s:[10,20,20],structures:true})];
 const state=C.publicJSON(ship);hull._solidCutShip=ship;const expected=Array.from(C.structTriangles(hull));let started=false;
 f.scope.inspect=msg=>{if(msg.type==='authoringGeometry')started=true;};
 for(const name of ['syncCompartments','remount','surfacePatches','computeStats']){const native=C[name];C[name]=(...args)=>{assert.equal(started,true,name+' must wait for the authored hull packet');return native(...args);};}
 send(1,state,['all'],true);const early=await wait('authoringGeometry',1);
 assert.equal(early.sourceState,state);assert.equal(early.caches.geoProxy.surfaces,undefined);assert.ok(early.caches.geoProxy.hull.bvh);
 const p=early.caches.items.parts[hull.id];assert.ok(p._hullShip);assert.equal(p._hullGeometry.base,p._hullShip._solidHull?.g||p._hullShip._portalGeo?.g||p._hullShip._cache.geo,'the transported local geometry and world transform must share their base');
 assert.deepEqual(Array.from(p._solidGeometry?.tris||p._hullGeometry.g.tris),expected);assert.deepEqual(plain(p._solidCutShip),{$r:'ship'});
 await wait('geometry',1);assert.equal(messages.some(m=>m.type==='error'),false);assert.equal(messages.findIndex(m=>m.type==='authoringGeometry')<messages.findIndex(m=>m.type==='geometry'),true);
});

test('a newer edit can use the early hull and skips obsolete engineering without losing hull dirtiness',async()=>{
 const f=fixture(),{C,ship,send,wait,messages}=f,state=C.publicJSON(ship);let engineering=0;
 const native=C.syncCompartments;C.syncCompartments=(...args)=>{engineering++;return native(...args);};
 f.scope.inspect=msg=>{if(msg.type==='authoringGeometry'&&msg.gen===1)send(2,state,['fits']);};
 send(1,state,['all'],true);const result=await wait('geometry',2);
 assert.ok(result.geos.hull,'skipping the initial job must preserve its hull rebuild');assert.ok(engineering>0);assert.equal(messages.some(m=>m.type==='geometry'&&m.gen===1),false);assert.equal(messages.filter(m=>m.type==='authoringGeometry').length,1);assert.equal(messages.some(m=>m.type==='error'),false);
});

test('plain gun changes reuse the authored hull; a moved hull gets a fresh packet',async()=>{
 const {C,ship,hull,send,wait,messages}=fixture();send(1,C.publicJSON(ship),['all'],true);const first=await wait('geometry',1),current=JSON.parse(first.state);
 current.fits.push({id:current.nextId++,k:'pd',p:[40,40,0],a:2,ped:0,base:0,low:0,float:false});
 send(2,C.publicJSON(current),['fits']);await wait('geometry',2);assert.equal(messages.filter(m=>m.type==='authoringGeometry').length,1,'plain gun edits cannot restart the cold hull pipeline');
 current.parts.find(p=>p.id===hull.id).c[0]+=5;send(3,C.publicJSON(current),['parts']);await wait('geometry',3);assert.equal(messages.filter(m=>m.type==='authoringGeometry').length,2);assert.equal(messages.some(m=>m.type==='error'),false);
});

test('authoring packets omit engineering, packed rooms and exposure caches',()=>{
 const {C,E,ship,hull}=fixture();C.hullGeo(ship);C.structTriangles(hull);ship._feed={large:'not pick geometry'};ship._engines={routes:[]};ship._surfaceSurvey={faces:[]};ship._cache.hf={simulation:'not pick geometry'};
 const room={id:ship.nextId++,k:'hangar',c:[40,20,0],room:[10,10,10],d:10,_packing:{expensive:true}};ship.parts.push(room);
 C.surfacePatches=()=>{throw Error('exposure survey during early delivery');};C.enginePaths=()=>{throw Error('routing during early delivery');};
 const packet=structuredClone(E.packCaches(ship,{authoring:true}));
 assert.equal(packet.ship._feed,undefined);assert.equal(packet.ship._engines,undefined);assert.equal(packet.ship._surfaceSurvey,undefined);assert.equal(packet.ship._cache.hf,null);assert.equal(packet.items.parts[room.id],undefined);assert.equal(packet.geoProxy.surfaces,undefined);assert.ok(packet.items.parts[hull.id]._hullGeometry);
});
