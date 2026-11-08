const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime({worker=false,guarded=false}={}){
 const context=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone,__clientGuard:false,__geometryCalls:[]});
 for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js',...(worker?['js/gfx.js','js/engine.js']:[])]){
  let source=fs.readFileSync(path.join(root,file),'utf8');if(guarded&&file==='js/core.js')for(const name of ['engineSkinMesh','engineCasingSections','embeddedEngineCasingSections','engineCasingEmbedded','insideOriginalEnvelope'])source=source.replace(new RegExp('function '+name+'\\(([^)]*)\\)\\{'),'function '+name+'($1){if(globalThis.__clientGuard){globalThis.__geometryCalls.push("'+name+'");throw Error("geometry on client: '+name+'");}');
  vm.runInContext(source,context,{filename:file});
 }
 return {context,...vm.runInContext('({C:Core,...(typeof Gfx!=="undefined"?{G:Gfx}:{}),...(typeof YardEngine!=="undefined"?{E:YardEngine}:{})})',context)};
}
const {C}=runtime(),plain=value=>JSON.parse(JSON.stringify(value)),near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-7,label+': '+a+' != '+b);
function fixture(core=C,{front=130,angle=0,z=0}={}){
 const source=core.equipmentOptions('exposedTurbine'),p={...source,id:2,k:'engine',c:[130,50,z],dir:[-Math.cos(angle),0,Math.sin(angle)],roll:13,exposedMachinery:true},s=core.newShip({assembly:true,L:600,W:300,H:200},'Embedded actual turbine');
 const axis=core.mul(p.dir,-1),host={id:1,k:'struct',form:'box',c:core.add(p.c,core.mul(axis,front-130+120)),s:[240,160,140],yaw:-angle*180/Math.PI};
 s.parts=[host,p];s.fits=[];s.hatches=[];s.links=[];s.groups=[];s.detail=0;s.autoHabitation=false;s.nextId=3;s.armor={hull:0,cit:0};
 const prepared=core.updateEngineSpec(p,{},s);assert.equal(prepared.ok,true,prepared.reasons?.join(','));return {s,p,host};
}
function actualShellContainsMachine(core,p,s){
 const skin=core.engineSkinMesh(p),body=core.engineMachineryPaths(s).find(q=>q.nozzle===p.id),seg=body.machinerySegment,axis=core.mul(seg.u,-1),frame=core.frameAxis(axis);
 // Independently ray the actual authored shell, taking its outermost crossing
 // rather than comparing only AABBs or calling the fitting implementation.
 for(const f of [0,.05,.15,.3,.5,.7,.9,.95,1])for(let j=0;j<16;j++){
  const centre=core.add(seg.b,core.mul(axis,seg.l*f)),radius=seg.r1+(seg.r0-seg.r1)*f,d=core.add(core.mul(frame.v,Math.cos(j*Math.PI/8)),core.mul(frame.w,Math.sin(j*Math.PI/8)));let point=centre,last=0;
  for(let n=0;n<32;n++){const hit=core.rayTris(skin.T,point,d);if(!hit)break;last=core.len(core.sub(hit.p,centre));point=core.add(hit.p,core.mul(d,1e-4));}
  assert.ok(last>=radius-1e-3,`the finite machine crosses its real casing at axial ${f}, radial ${j}: ${radius} > ${last}`);
 }
 return body;
}

test('a longer embedded turbine uses its buried casing without changing its skin, rating or finite body',()=>{
 const {s,p,host}=fixture(),before=C.resolveEngineSpec(p,s),skin=Array.from(C.engineSkinMesh(p).pos),parent=C.publicJSON(host),mouth=C.add(p.c,C.mul(p.dir,p.nozzleLength/2));
 const edit=C.updateEngineSpec(p,{machineryLengthM:200},s);assert.equal(edit.ok,true,edit.reasons?.join(','));assert.ok(p.machineryOffsetM<12&&p.machineryOffsetM>0,'the engine uses the buried forward casing instead of protruding through the root');assert.equal(C.engineCasingFit(p,s).passed,true);
 near(p.machineryLengthM,200,'requested machine length');near(p.machineryRadiusM,before.machineryRadiusM,'requested radius');near(p.ratedInputW,before.ratedInputW,'paid input rating');assert.deepEqual(Array.from(C.engineSkinMesh(p).pos),skin,'the real outer appearance is not grown to disguise the spill');assert.equal(C.publicJSON(host),parent);assert.deepEqual(plain(C.add(p.c,C.mul(p.dir,p.nozzleLength/2))),plain(mouth));
 const body=actualShellContainsMachine(C,p,s);near(C.partVolume(body),Math.PI*200*p.machineryRadiusM**2*(.78**2+.78+1)/3,'real machinery volume');assert.equal(C.engineVented(s,p),true,'the outward mouth remains independently unobstructed');
 const saved=C.serialize(s),loaded=C.deserialize(plain(saved)),copy=loaded.parts.find(q=>q.id===p.id);near(copy.machineryOffsetM,p.machineryOffsetM,'saved finite placement');near(copy.machineryLengthM,200,'saved requested length');near(copy.ratedInputW,p.ratedInputW,'saved rating');assert.equal(C.engineCasingFit(copy,loaded).passed,true);actualShellContainsMachine(C,copy,loaded);
});

test('an oversized embedded machine is rejected atomically instead of being shrunk, hidden or granted free capacity',()=>{
 const {s,p,host}=fixture(),before=C.publicJSON(p),parent=C.publicJSON(host),skin=Array.from(C.engineSkinMesh(p).pos),edit=C.updateEngineSpec(p,{machineryLengthM:220},s);assert.equal(edit.ok,false);assert.ok(edit.reasons.includes('engine-casing-fit'));assert.equal(C.publicJSON(p),before);assert.equal(C.publicJSON(host),parent);assert.deepEqual(Array.from(C.engineSkinMesh(p).pos),skin);assert.equal(C.engineCasingFit(p,s).passed,true);
});

test('an unburied forward casing cannot be used as new machinery space',()=>{
 const {s,p}=fixture(C,{front:145}),before=C.publicJSON(p),edit=C.updateEngineSpec(p,{machineryLengthM:200},s);assert.equal(edit.ok,false);assert.ok(edit.reasons.includes('engine-casing-fit'));assert.equal(C.publicJSON(p),before);assert.equal(C.engineVented(s,p),true);
});

test('rotated and mirrored embedded engines keep the same enclosing geometry contract',()=>{
 for(const angle of [.51,-.51]){const {s,p}=fixture(C,{angle,z:23}),rating=p.ratedInputW,edit=C.updateEngineSpec(p,{machineryLengthM:200},s);assert.equal(edit.ok,true,edit.reasons?.join(','));near(p.ratedInputW,rating,'rotated rating');assert.equal(C.engineCasingFit(p,s).passed,true);actualShellContainsMachine(C,p,s);
  const mirror=C.mirrorPart(p,s),host=C.mirrorPart(s.parts[0],s),other={...s,parts:[host,mirror]};assert.equal(C.engineCasingFit(mirror,other).passed,true);actualShellContainsMachine(C,mirror,other);
 }
});

test('client edits stay authoring-only and defer embedded fitting to the existing Worker',()=>{
 const {C:core,context}=runtime({guarded:true}),{s,p}=fixture(core);s._client=true;p.placement={modelVersion:core.PLACEMENT_MODEL_VERSION,mode:'direct',parentStructureId:1,geometryRevision:4,requestedGeometry:JSON.parse(core.publicJSON(p))};context.__clientGuard=true;
 try{const result=core.updateEngineSpec(p,{machineryLengthM:200},s);assert.equal(result.ok,true);assert.equal(p.machineryOffsetM,12,'no cold actual casing search occurs on an input frame');assert.equal(p.placement.pendingGeometry,true);assert.equal(p.placement.geometryRevision,5);assert.equal(p.placement.requestedGeometry.machineryLengthM,200);assert.equal(context.__geometryCalls.length,0);}finally{context.__clientGuard=false;}
});

test('legacy sources resolve their body before early meshes, retaining one source generation and actual rendered bounds',async()=>{
 const {C:core,G,E}=runtime({worker:true}),{s,p}=fixture(core);p.machineryLengthM=200;const original=core.publicJSON(s),signature=core.placementPendingInputKey(p),messages=[],waiters=[],scope={postMessage(packet){const row=structuredClone(packet);messages.push(row);for(const waiter of waiters.slice())if(row.type===waiter.type||row.type==='error'){waiters.splice(waiters.indexOf(waiter),1);row.type==='error'?waiter.reject(Error(row.message)):waiter.resolve(row);}}};E.listenWorker(scope);
 const wait=type=>new Promise((resolve,reject)=>{const seen=messages.find(row=>row.type===type||row.type==='error');if(seen)seen.type==='error'?reject(Error(seen.message)):resolve(seen);else waiters.push({type,resolve,reject});});
 scope.onmessage({data:{type:'update',gen:7,designId:'buried-turbine',state:original,what:['all'],reset:true,stats:false,view:{deferSurfaces:true}}});
 const resolution=await wait('placementResolution'),row=resolution.rows.find(row=>row.id===p.id);assert.ok(row);assert.equal(resolution.gen,7);assert.equal(row.sourceKey,signature);assert.equal(row.error,null);assert.ok(row.part.machineryOffsetM<12);assert.equal(row.part.machineryLengthM,200);assert.equal(row.part.ratedInputW,p.ratedInputW);
 const early=await wait('authoringGeometry');assert.equal(early.gen,7);assert.ok(messages.findIndex(row=>row.type==='placementResolution')<messages.findIndex(row=>row.type==='authoringGeometry'));
 const geometry=await wait('geometry'),resolved=JSON.parse(geometry.state),engine=resolved.parts.find(q=>q.id===p.id);assert.equal(engine.machineryOffsetM,row.part.machineryOffsetM);assert.equal(core.engineCasingFit(engine,resolved).passed,true);actualShellContainsMachine(core,engine,resolved);const mesh=G.meshParts(resolved,{}),body=core.engineMachineryPaths(resolved).find(q=>q.nozzle===engine.id);assert.ok(mesh.ranges[body.id].some(([layer])=>layer==='engine'),'the real finite machinery is still rendered');assert.equal(core.publicJSON(s),original,'the server never rewrites a newer editor source in place');
});

test('an unfittable old embedded body remains repairable but cannot produce valid propulsion',()=>{
 const {s,p}=fixture();p.machineryLengthM=220;const source=C.publicJSON(p),result=C.refreshPlacementGeometry(s);assert.equal(result.ok,false);assert.ok(result.failed.some(row=>row.partId===p.id&&row.code==='engine-casing-fit'));assert.ok(result.resolvedParts.includes(p.id));assert.equal(C.publicJSON(p),source,'the failed source dimensions and rating remain available to repair');assert.equal(C.resolveEngineSpec(p,s).valid,false);assert.ok(C.resolveEngineSpec(p,s).issues.includes('engine-casing-fit'));near(C.resolveEngineSpec(p,s).ratedThrustN,0,'invalid machinery cannot earn thrust');
});

test('nonembedded exposed machinery keeps its existing independent-edit compatibility',()=>{
 const {s,p}=fixture();s.parts=s.parts.filter(q=>q.id!==1);const skin=Array.from(C.engineSkinMesh(p).pos),edit=C.updateEngineSpec(p,{machineryLengthM:220},s);assert.equal(edit.ok,true);assert.equal(p.machineryOffsetM,12);assert.equal(p.machineryLengthM,220);assert.deepEqual(Array.from(C.engineSkinMesh(p).pos),skin);
});

test('embedded fit does not enable a buried nozzle or replace the existing electrical supply checks',()=>{
 const {s,p}=fixture(C,{front:100});assert.equal(C.updateEngineSpec(p,{machineryLengthM:200},s).ok,true);assert.equal(C.engineCasingFit(p,s).passed,true);assert.equal(C.engineVented(s,p),false,'the real muzzle is still blocked by the hull');
 let transmission=C.engineTransmission(s);assert.equal(transmission.engines[p.id].connected,false);near(C.getEngineInputLimit(C.resolveEngineSpec(p,s),{connected:false}).inputLimitW,0,'enclosing machinery does not generate electrical supply');
 s.parts.push({id:3,k:'gen',c:[260,50,0],d:20});p.reactor=3;transmission=C.engineTransmission(s);assert.equal(transmission.engines[p.id].connected,true);const limit=C.getEngineInputLimit(C.resolveEngineSpec(p,s),{connected:true,outletAvailable:C.engineVented(s,p),pathCapacityW:transmission.engines[p.id].capacityW});near(limit.inputLimitW,0,'a supplied but blocked nozzle remains inoperable');assert.ok(limit.reasons.includes('outlet-blocked'));
});

test('actual Worker errors and successful repair stay consistent in the real App packet handler',async()=>{
 const {C:core,E}=runtime({worker:true}),{setup}=require('./helpers/immediate-design-ui.cjs'),{s,p}=fixture(core),ui=setup({core}),run=ui.run;ui.context.embeddedSource=s;run('ship=embeddedSource;ship._client=true;ship.saveId="embedded-source";eng.gen=9;');p.machineryLengthM=220;
 const messages=[],waiters=[],scope={postMessage(packet){const row=structuredClone(packet);messages.push(row);for(const waiter of waiters.slice())if(row.gen===waiter.gen&&(row.type===waiter.type||row.type==='error')){waiters.splice(waiters.indexOf(waiter),1);row.type==='error'?waiter.reject(Error(row.message)):waiter.resolve(row);}}};E.listenWorker(scope);
 const wait=(type,gen)=>new Promise((resolve,reject)=>{const seen=messages.find(row=>row.gen===gen&&(row.type===type||row.type==='error'));if(seen)seen.type==='error'?reject(Error(seen.message)):resolve(seen);else waiters.push({type,gen,resolve,reject});});
 const send=gen=>scope.onmessage({data:{type:'update',gen,designId:s.saveId,state:core.publicJSON(s),what:['all'],reset:gen===9,stats:false,view:{deferSurfaces:true}}});
 send(9);const failed=await wait('placementResolution',9),failedRow=failed.rows.find(q=>q.id===p.id);assert.equal(failedRow.error,'engine-casing-fit');assert.equal(failedRow.cacheKeys._embeddedCasingError,'engine-casing-fit');ui.context.casingPacket=failed;assert.equal(run('onEnginePlacementResolution(casingPacket)'),true);assert.equal(core.resolveEngineSpec(p,s).valid,false,'the editor adopts the same failed machinery signature as its Worker');await wait('geometry',9);
 assert.equal(core.updateEngineSpec(p,{machineryLengthM:200},s).ok,true);run('eng.gen=10');send(10);const fixed=await wait('placementResolution',10);ui.context.casingPacket=fixed;assert.equal(run('onEnginePlacementResolution(casingPacket)'),true);assert.equal(p._embeddedCasingError,undefined);assert.equal(p._embeddedCasingErrorKey,undefined);assert.equal(p._placementError,undefined);assert.equal(core.resolveEngineSpec(p,s).valid,true);assert.ok(p.machineryOffsetM<12);assert.equal(core.engineCasingFit(p,{...s,_client:false}).passed,true);await wait('geometry',10);
});
