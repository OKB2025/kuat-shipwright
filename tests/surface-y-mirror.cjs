const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=v=>JSON.parse(JSON.stringify(v)),reflectVector=v=>[v[0],-v[1],v[2]];
function fixture(){const s=C.newShip({L:200,W:80,H:100,plan:'rect',sec:'rect'},'Y mirror');s.hull.assembly=true;s.parts=[{id:1,k:'struct',form:'box',c:[90,85,45],s:[60,30,20],yaw:21,pitch:17,roll:13,taper:0}];s.fits=[];s.nextId=2;C.enableSurfaceMode(s,true);return s;}
function mirrorHost(s,snapshot){const source=s.parts.find(p=>p.id===1),target=C.vmirrorPart(source,s);target.id=s.nextId++;delete target.tw;source.vt=target.id;target.vt=source.id;s.parts.push(target);const parts=vm.runInContext('new Map()',cx),fits=vm.runInContext('new Map()',cx);parts.set(source.id,target.id);C.surfacePasteConfig(s,snapshot,{parts,fits},'y');return {source,target};}

test('vertical reflection preserves actual surface normals and fixed barrel directions on a rotated host',()=>{
 const s=fixture(),patch=C.surfacePatches(s).find(p=>p.host==='p1'&&p.exposed&&p.face==='top');assert.ok(patch);assert.equal(C.setSurfaceConfig(s,[patch.id],{battery:{weapon:'claser',count:3,angle:37,spacing:1},style:{seed:123}}).ok,true);
 const sourceFits=s.fits.filter(f=>f.surfacePatch===patch.id),snapshot=C.surfaceCaptureConfig(s,{parts:[1]}),{target}=mirrorHost(s,snapshot);assert.equal(sourceFits.length,3);
 const descriptor=C.surfacePatches(s).find(p=>p.host==='p'+target.id&&C.surfaceConfig(s,p.id).battery.count===3);assert.ok(descriptor);assert.ok(C.dot(descriptor.normal,reflectVector(patch.normal))>.999999,'the measured world surface normal must reflect through the actual Y plane');
 const copies=s.fits.filter(f=>f.surfacePatch===descriptor.id);assert.equal(copies.length,sourceFits.length);
 for(const source of sourceFits){const copy=copies.find(f=>f.surfaceCell===source.surfaceCell);assert.ok(copy);assert.ok(C.dot(copy.n,reflectVector(source.n))>.999999);assert.ok(C.dot(C.fitFrameOf(copy).fw,reflectVector(C.fitFrameOf(source).fw))>.999999,'a mirrored fixed barrel must follow its actual world direction');assert.ok(C.len(C.sub(copy.surfacePoint,C.vmirrorPoint(s,source.surfacePoint)))<1e-4,'the generated firing location must reflect with the host');}
 const before=plain(s.fits.map(f=>({id:f.id,patch:f.surfacePatch,cell:f.surfaceCell,p:f.p,n:f.n,fw:C.fitFrameOf(f).fw})));C.surfaceSync(s);C.surfaceSync(s);assert.deepEqual(plain(s.fits.map(f=>({id:f.id,patch:f.surfacePatch,cell:f.surfaceCell,p:f.p,n:f.n,fw:C.fitFrameOf(f).fw}))),before);
});

test('vertical reflection retains split physical regions, requested counts and local seeds',()=>{
 const s=fixture(),patch=C.surfacePatches(s).find(p=>p.host==='p1'&&p.exposed&&p.face==='top');C.setSurfaceConfig(s,[patch.id],{battery:{weapon:'claser',count:3,angle:-28,spacing:1}});const split=C.surfaceSplit(s,patch.id,'v',.3);assert.equal(split.ok,true);C.setSurfaceConfig(s,[split.ids[0]],{style:{seed:101}});C.setSurfaceConfig(s,[split.ids[1]],{style:{seed:202}});
 const original=C.surfacePatches(s).filter(p=>split.ids.includes(p.id)),snapshot=C.surfaceCaptureConfig(s,{parts:[1]}),{target}=mirrorHost(s,snapshot),descriptors=C.surfacePatches(s).filter(p=>p.host==='p'+target.id);
 for(const source of original){const config=C.surfaceConfig(s,source.id),copy=descriptors.find(p=>C.surfaceConfig(s,p.id).style.seed===config.style.seed);assert.ok(copy);assert.ok(C.len(C.sub(copy.center,C.vmirrorPoint(s,source.center)))<1e-4,'the split region must remain over the reflected physical portion of the host');assert.ok(C.dot(copy.normal,reflectVector(source.normal))>.999999);assert.equal(C.surfaceConfig(s,copy.id).battery.count,config.battery.count);}
 assert.equal(descriptors.reduce((n,p)=>n+C.surfaceConfig(s,p.id).battery.count,0),3);assert.equal(s.fits.filter(f=>f.surfacePatch?.startsWith('p'+target.id+':')).length,3);const loaded=C.deserialize(C.serialize(s));assert.equal(loaded.fits.filter(f=>f.surfacePatch?.startsWith('p'+target.id+':')).length,3);
});

test('vertical reflection preserves real fixed and rotating barrel frames on every mounting side',()=>{
 for(const weapon of ['claser','pd'])for(const face of ['top','bottom','port','stbd','fore','aft']){
  const s=fixture(),patch=C.surfacePatches(s).find(p=>p.host==='p1'&&p.exposed&&p.face===face);C.setSurfaceConfig(s,[patch.id],{battery:{weapon,count:1,angle:37,spacing:1}});const source=s.fits.find(f=>f.surfacePatch===patch.id),snapshot=C.surfaceCaptureConfig(s,{parts:[1]}),{target}=mirrorHost(s,snapshot),copy=s.fits.find(f=>f.surfacePatch.startsWith('p'+target.id+':'));
  assert.ok(copy,weapon+'/'+face);assert.ok(C.dot(copy.n,reflectVector(source.n))>.999999,weapon+'/'+face+' normal');assert.ok(C.dot(C.fitFrameOf(copy).fw,reflectVector(C.fitFrameOf(source).fw))>.999999,weapon+'/'+face+' barrel');assert.ok(C.len(C.sub(copy.surfacePoint,C.vmirrorPoint(s,source.surfacePoint)))<1e-4,weapon+'/'+face+' cell position');
  const loaded=C.deserialize(C.serialize(s)),reloaded=loaded.fits.find(f=>f.id===copy.id);assert.ok(C.dot(C.fitFrameOf(reloaded).fw,C.fitFrameOf(copy).fw)>.999999,weapon+'/'+face+' saved frame');
 }
});

test('surface templates carry strict cooling provenance only when creating a new destination policy',()=>{
 const s=fixture();s.surfaces.compatAllowed=false;const snapshot=C.surfaceCaptureConfig(s,{parts:[1]});assert.equal(snapshot.compatAllowed,false);
 const destination=C.newShip({L:200,W:80,H:100,plan:'rect',sec:'rect'},'Destination');destination.hull.assembly=true;destination.parts=[{...JSON.parse(C.publicJSON(s.parts[0])),id:21,c:[90,15,45]}];destination.fits=[];destination.nextId=22;const parts=vm.runInContext('new Map()',cx);parts.set(1,21);C.surfacePasteConfig(destination,snapshot,{parts,fits:vm.runInContext('new Map()',cx)});
 assert.equal(destination.surfaces.compatAllowed,false);assert.equal(C.enableSurfaceMode(destination,false).ok,false);assert.equal(C.deserialize(C.serialize(destination)).surfaces.compatAllowed,false);
 const existing=fixture();assert.equal(existing.surfaces.compatAllowed,true);const id=existing.nextId++,host={...JSON.parse(C.publicJSON(s.parts[0])),id,c:[90,15,45]};existing.parts.push(host);const targetMap=vm.runInContext('new Map()',cx);targetMap.set(1,id);C.surfacePasteConfig(existing,snapshot,{parts:targetMap,fits:vm.runInContext('new Map()',cx)});assert.equal(existing.surfaces.compatAllowed,true,'an existing destination keeps its own compatibility policy');
});
