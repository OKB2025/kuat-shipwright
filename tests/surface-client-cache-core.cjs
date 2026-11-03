const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(){const source=C.deserialize(C.serialize(C.newShip({L:80,W:60,H:40,plan:'rect',sec:'rect'},'Client surface cache')));source.parts=[];source.fits=[];source.armor={hull:0,cit:0};const ship=C.deserialize(C.serialize(source));ship._client=true;return {source,ship};}

test('pending client hull surveys refresh when the worker supplies geometry without changing saved design data',()=>{
 const {source,ship}=fixture(),before=C.publicJSON(ship);assert.equal(C.surfacePatches(ship).length,0);assert.equal(C.surfaceAutoCandidates(ship).length,0);ship._geoProxy={hull:C.hullGeo(source)};const patches=C.surfacePatches(ship);assert.ok(patches.length>0);assert.ok(C.surfaceAutoCandidates(ship).length>0);assert.equal(C.publicJSON(ship),before,'private proxy readiness must not add fields or mutate public settings');const ids=plain(patches.map(p=>p.id));ship._client=false;assert.deepEqual(plain(C.surfacePatches(ship).map(p=>p.id)),ids,'local and client surveys retain the same semantic face identifiers');
});

test('a same-size replacement worker buffer refreshes face centers and adopts the matching compiled gun anchors',()=>{
 const {source,ship}=fixture(),initial=C.hullGeo(source);ship._geoProxy={hull:initial};const face=C.surfacePatches(source).find(p=>p.face==='port');assert.ok(C.setSurfaceConfig(source,face.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{limit:0},battery:{weapon:'pd',count:1,spacing:1}}).ok);C.patchShip(ship,JSON.parse(C.publicJSON(source)),['surfaces','parts','fits','nextId']);const id=face.id,fitId=C.surfaceDerivedFits(ship)[0].id,oldPoint=C.surfaceDerivedFits(ship)[0].surfacePoint.slice();source.hull.W=90;ship.hull.W=90;
 const stale=C.surfacePatches(ship).find(p=>p.id===id);assert.ok(Math.abs(stale.center[2]+30)<1e-7,'the interface still surveys the previous complete buffer while waiting');C.surfaceSync(ship);assert.equal(C.surfaceDerivedFits(ship)[0].surfacePoint[2],oldPoint[2],'the interface cannot repack physical resources before the engine responds');const next=C.hullGeo(source);assert.equal(next.tris.length,initial.tris.length);assert.notEqual(next,initial);const before=C.publicJSON(ship);ship._geoProxy={hull:next};const ready=C.surfacePatches(ship).find(p=>p.id===id);assert.ok(Math.abs(ready.center[2]+45)<1e-7);assert.equal(C.publicJSON(ship),before,'surveying the new proxy does not mutate saved ownership');C.surfaceSync(source);C.patchShip(ship,JSON.parse(C.publicJSON(source)),['surfaces','parts','fits','nextId']);const gun=C.surfaceDerivedFits(ship)[0];assert.equal(ship.fits.length,0);assert.equal(gun.id,fitId);assert.equal(gun.surfacePatch,id);assert.equal(gun.surfacePoint[2],-45,'adopting the engine ledger refreshes anchors even when the triangle count is unchanged');assert.equal(C.surfaceConfig(ship,id).battery.count,1);
});

test('client surface queries keep the worker survey while native structures move and adopt replacement surveys',()=>{
 const {source,ship}=fixture();source.parts=[{id:1,k:'struct',form:'box',c:[40,70,0],s:[20,20,20]}];source.nextId=2;
 C.patchShip(ship,JSON.parse(C.publicJSON(source)));const survey=C.surfacePatches(source).map(({config,...p})=>p);ship._geoProxy={hull:C.hullGeo(source),surfaces:survey};
 const initial=C.surfacePatches(ship),top=initial.find(p=>p.host==='p1'&&p.face==='top');assert.ok(top);assert.equal(top._part,ship.parts[0]);assert.equal(top.triangles,survey.find(p=>p.id===top.id).triangles,'querying a proxy reuses its completed geometry');
 ship.parts[0].c=[40,90,0];ship.hull.W=90;
 const originalLength=ship.hull.L;Object.defineProperty(ship.hull,'L',{configurable:true,get(){throw new Error('client query attempted a local geometry survey')}});
 const pending=C.surfacePatches(ship).find(p=>p.id===top.id);assert.deepEqual(plain(pending.center),plain(top.center),'the last complete survey remains selectable while work is pending');assert.ok(C.surfacePatches(ship,true).some(p=>p.id===top.id));
 Object.defineProperty(ship.hull,'L',{configurable:true,writable:true,value:originalLength});
 C.patchShip(source,JSON.parse(C.publicJSON(ship)));ship._geoProxy={hull:C.hullGeo(source),surfaces:C.surfacePatches(source).map(({config,...p})=>p)};
 const current=C.surfacePatches(ship).find(p=>p.id===top.id);assert.ok(Math.abs(current.center[1]-top.center[1]-20)<1e-6);assert.equal(current._part,ship.parts[0]);
 ship.parts=[];assert.ok(!C.surfacePatches(ship).some(p=>p.host==='p1'),'deleted native hosts cannot stay selectable while the replacement worker survey is pending');
});

test('client surface settings remain current without recompiling or hashing native geometry',()=>{
 const {source,ship}=fixture(),survey=C.surfacePatches(source).map(({config,...p})=>p),id=survey.find(p=>p.face==='port').id;
 ship._geoProxy={hull:C.hullGeo(source),surfaces:survey};ship.surfaces={version:4,mode:'strict',patches:[{id,functionMode:'armor',armor:{material:'standard',thickness:.7},style:{seed:8}}]};
 Object.defineProperty(ship.hull,'L',{configurable:true,get(){throw new Error('client sync attempted to hash native geometry')}});
 C.surfaceSync(ship);const patch=C.surfacePatches(ship).find(p=>p.id===id);assert.equal(patch.config.armor.thickness,.7);ship.surfaces.patches[0].armor.thickness=.9;assert.equal(C.surfacePatches(ship).find(p=>p.id===id).config.armor.thickness,.9);
 assert.equal(survey.find(p=>p.id===id).config,undefined,'live settings never mutate the worker snapshot');
});

test('explicit client split and merge refresh face identities and bound areas before the worker responds',()=>{
 const {source,ship}=fixture(),face=C.surfacePatches(source).find(p=>p.face==='port');
 assert.equal(C.setSurfaceConfig(source,face.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:1,capacityModel:'area-v1',limit:0},battery:{count:0}}).ok,true);
 C.patchShip(ship,JSON.parse(C.publicJSON(source)));ship._geoProxy={hull:C.hullGeo(source),surfaces:C.surfacePatches(source).map(({config,...p})=>p),surfacePartitions:JSON.stringify(source.surfaces?.partitions||null)};
 const volume=s=>s.surfaces.patches.flatMap(p=>p.aggregate?.cells||[]).reduce((n,r)=>n+r[21],0),cost=s=>s.surfaces.patches.flatMap(p=>p.aggregate?.cells||[]).reduce((n,r)=>n+r[22],0),before={volume:volume(ship),cost:cost(ship)};
 assert.ok(before.volume>0);const split=C.surfaceSplit(ship,face.id,'u',.5);assert.equal(split.ok,true);const leaves=C.surfacePatches(ship).filter(p=>split.ids.includes(p.id));assert.equal(leaves.length,2,'new children are available for immediate UI selection');
 for(const p of leaves){assert.ok(Math.abs(p.area-face.area/2)<1e-6);assert.equal(C.surfaceConfig(ship,p.id).boundArea,p.area,'surfaceStampPartition must measure each new leaf');}
 assert.ok(Math.abs(volume(ship)-before.volume)<1e-6);assert.ok(Math.abs(cost(ship)-before.cost)<Math.max(1,before.cost*1e-12));
 // Match the real lifecycle: a completed split survey becomes the snapshot,
 // then the next explicit topology command must bypass that old layout too.
 const splitWorker=JSON.parse(C.publicJSON(ship));ship._geoProxy={hull:C.hullGeo(source),surfaces:C.surfacePatches(splitWorker).map(({config,...p})=>p),surfacePartitions:JSON.stringify(splitWorker.surfaces.partitions)};
 const merged=C.surfaceMerge(ship,split.ids);assert.equal(merged.ok,true,merged.why);const combined=C.surfacePatches(ship).find(p=>p.id===merged.ids[0]);assert.ok(combined);assert.ok(Math.abs(combined.area-face.area)<1e-6);assert.equal(C.surfaceConfig(ship,combined.id).boundArea,face.area);assert.ok(!C.surfacePatches(ship).some(p=>split.ids.includes(p.id)));assert.ok(Math.abs(volume(ship)-before.volume)<1e-6);assert.ok(Math.abs(cost(ship)-before.cost)<Math.max(1,before.cost*1e-12));
});
