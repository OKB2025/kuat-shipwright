const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..');
function setup(){
 const cx=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
 const {C,E}=vm.runInContext('({C:Core,E:YardEngine})',cx),messages=[],waiters=[];
 const scope={postMessage(message){const packet=structuredClone(message);messages.push(packet);scope.inspect?.(packet);for(const waiter of waiters.slice())if(packet.type===waiter.type||packet.type==='error'){waiters.splice(waiters.indexOf(waiter),1);packet.type==='error'?waiter.reject(Object.assign(Error(packet.message),{code:packet.code})):waiter.resolve(packet);}}};E.listenWorker(scope);
 const wait=type=>new Promise((resolve,reject)=>{const packet=messages.find(m=>m.type===type||m.type==='error');if(packet)packet.type==='error'?reject(Error(packet.message)):resolve(packet);else waiters.push({type,resolve,reject});});
 const send=message=>scope.onmessage({data:structuredClone(message)}),ship=C.newShip({assembly:true,L:200,W:200,H:20},'Background draft');
 ship.parts=[{id:1,k:'struct',form:'box',c:[0,0,0],s:[200,200,20]}];ship.fits=[];ship.hatches=[];ship.links=[];ship.groups=[];ship.nextId=2;
 return{C,E,ship,scope,messages,wait,send};
}
test('a placed draft resolves before heavy geometry with the original source guard',async()=>{
 const f=setup(),{C,ship}=f,prepared=C.preparePlacementDraft(ship,{id:2,k:'struct',form:'box',c:[0,11,0],s:[4,4,4]},
  {mode:'horizontal',position:[0,11,0],parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]},geometryRevision:1});
 assert.equal(prepared.ok,true);ship.parts.push(prepared.part);ship.nextId=3;const state=C.publicJSON(ship),input=C.placementPendingInputKey(prepared.part);let resolved=false;
 f.scope.inspect=message=>{if(message.type==='placementResolution')resolved=true;};
 const sync=C.syncCompartments;C.syncCompartments=(...args)=>{assert.equal(resolved,true,'exact draft reply precedes whole-ship systems');return sync(...args);};
 f.send({type:'update',gen:1,designId:'draft-A',state,what:['all'],reset:true,stats:false,view:{deferSurfaces:true}});
 const packet=await f.wait('placementResolution'),row=packet.rows.find(row=>row.id===2);
 assert.equal(packet.gen,1);assert.equal(packet.designId,'draft-A');assert.equal(row.sourceKey,input);assert.equal(row.list,'parts');assert.equal(row.part.id,2);
 assert.equal(row.part.placement.pendingGeometry,undefined);assert.equal(row.part.placement.validationFailed,undefined);assert.ok(row.part.placement.hostSurfaceId);
 // 2026-11-13 user decision: no fitting. Until then the row carried the fitted solid (effectiveGeometry.placement, 48 m3);
 // the structure now keeps its requested 4x4x4 solid, and that solid travels with the row as the placement geometry.
 assert.ok(Math.abs(row.effectiveGeometry.placement.volume-64)<1e-6);assert.ok(Math.abs(C.partVolume(row.part)-64)<1e-6);assert.ok(row.geometryKeys.self);
 assert.equal(packet.placementDraftStatus.ok,true);assert.equal(C.publicJSON(ship),state,'background resolution never mutates the editor source');
 await f.wait('geometry');assert.ok(f.messages.findIndex(m=>m.type==='placementResolution')<f.messages.findIndex(m=>m.type==='geometry'));
});
test('failed placed fittings remain repairable and publish provisional figures without requesting a combat profile',async()=>{
 const f=setup(),{C,ship}=f,fit={id:2,k:'pd',p:[0,10,0],n:[0,1,0],a:2,ped:0};
 const first=C.commitPlacement(ship,fit,{entityKind:'fit',list:'fits',mode:'direct',hostId:1,hit:{p:fit.p,n:fit.n}});assert.equal(first.ok,true,first.error);
 const prepared=C.preparePlacementDraft(ship,{...fit,id:3},{list:'fits',entityKind:'fit',mode:'direct',hostId:1,hit:{p:fit.p,n:fit.n},geometryRevision:1});
 assert.equal(prepared.ok,true);ship.fits.push(prepared.fit);ship.nextId=4;const state=C.publicJSON(ship),key=C.placementPendingInputKey(prepared.fit);let profileCalls=0;
 C.fleetProfile=()=>{profileCalls++;throw Error('provisional figures must not request a completed profile');};
 f.send({type:'update',gen:1,designId:'draft-B',state,what:['all'],reset:true,statsDelay:0,view:{deferSurfaces:true}});
 const packet=await f.wait('placementResolution'),row=packet.rows.find(row=>row.id===3);
 assert.equal(row.sourceKey,key);assert.equal(row.list,'fits');assert.equal(row.fit.id,3);assert.equal(row.fit.placement.pendingGeometry,undefined);
 assert.equal(row.fit.placement.validationFailed,true);assert.equal(row.fit.placement.repairRequired,true);assert.equal(row.error,'placement-interference');assert.equal(packet.placementDraftStatus.ok,false);
 const stats=await f.wait('stats');assert.equal(stats.profile,null);assert.equal(stats.provisional,true);assert.equal(stats.stats.provisional,true);assert.equal(stats.placementDraftStatus.failed[0].id,3);assert.equal(profileCalls,0);
 assert.equal(C.publicJSON(ship),state);assert.equal(ship.fits.length,2,'failed strict work does not remove the placed source');
});
test('completed-ship requests cannot reuse provisional editor figures or complete pending source data',async()=>{
 const f=setup(),{C,ship}=f,prepared=C.preparePlacementDraft(ship,{id:2,k:'struct',form:'box',c:[0,11,0],s:[4,4,4]},
  {mode:'horizontal',position:[0,11,0],parentStructureId:1,hit:{p:[0,10,0],n:[0,1,0]}});
 ship.parts.push(prepared.part);ship.nextId=3;
 f.send({type:'fleet',id:9,design:C.serialize(ship),statsOnly:true});
 for(let i=0;i<40&&!f.messages.some(m=>m.id===9);i++)await new Promise(resolve=>setTimeout(resolve,0));
 const packet=f.messages.find(m=>m.id===9);assert.ok(packet);assert.equal(packet.type,'error');assert.equal(packet.code,'placement-unresolved');assert.equal(f.messages.some(m=>m.type==='fleet'),false);
});
