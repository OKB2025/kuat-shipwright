// User report 2026-11-15「反応炉を追加できない」: a 2 m craft whose hull stands inside an ellipsoid structure, saved and
// opened again. The editor asks Core whether a structure's carried solid is current before it lets a placement tap
// through it; the answer needed a parent key that is written only when a part is placed and is never stored, so
// for every structure of a loaded design it was "not current", the structure's shape counted as unknown and each
// tap whose line of sight met its bounds first was dropped (js/gfx.js placementAuthoringHits). A structure is not
// fitted to the body it was tapped on (no parent relation), so its carried solid is current whenever its own
// shape and request are.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const load=()=>{const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/craft-in-ellipsoid-no-reactor-2026-11-15.json.gz'))).toString('utf8')));C.syncCompartments(s);return s;};
test('a loaded structure carries a solid the editor can pick through, with no parent key',()=>{
 const s=load(),e=s.parts.find(p=>p.id===33);assert.equal(e.form,'ellipsoid');assert.ok(e._placementGeometry?.local?.length>0,'the carried solid is there after loading');
 assert.equal(e._placementParentKey,undefined,'the parent key is not stored');assert.equal(C.placementCachedGeometryCurrent(s,e),true);
});
test('a structure whose shape was changed since its solid was made is still not current',()=>{
 const s=load(),e=s.parts.find(p=>p.id===33);e.s=[1.6,2,2];assert.equal(C.placementCachedGeometryCurrent(s,e),false);
});
test('a small reactor goes into the loaded craft and a save and load keeps it',()=>{
 const s=load(),n=s.parts.length,made=C.placePart(s,'gen',[1.35,1,0],.3,{});assert.ok(made);assert.equal(s.parts.length,n+1);
 const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));assert.equal(back.parts.filter(p=>p.k==='gen').length,2);
});
// The editor's own hit test (js/gfx.js placementSurfaceCandidates) on the loaded design, as the designer holds it:
// the Worker's completed packet, and on each part the carried solid and the keys the Worker sends with it (self and
// request; the parent key is undefined after a load). The line of sight is the one of the user's view through the
// middle of the craft.
const vm=require('node:vm');
function runtime(){const context=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});return vm.runInContext('({C:Core,G:Gfx,E:YardEngine})',context);}
test('a placement tap through the loaded ellipsoid reaches the ellipsoid and the hull inside it',()=>{
 const r=runtime(),raw=r.C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/craft-in-ellipsoid-no-reactor-2026-11-15.json.gz'))).toString('utf8')));r.C.syncCompartments(raw);
 for(const part of raw.parts)if(r.C.isShapePart(part)){part._solidCutShip=raw;r.C.structTriangles(part);}
 const packet=structuredClone(r.E.packCaches(raw)),client=JSON.parse(r.C.publicJSON(raw));client._client=true;client._geoProxy=packet.geoProxy;client._editorGeometryContext='completed-worker-context';
 for(const part of client.parts){part._editorGeometryContext=client._editorGeometryContext;const src=raw.parts.find(p=>p.id===part.id);for(const key of ['_placementGeometry','_placementSelfKey','_placementRequestKey'])if(src[key]!=null)part[key]=src[key];}
 const e=client.parts.find(p=>p.id===33);assert.ok(e._placementGeometry,'the ellipsoid carries its solid');assert.equal(e._placementParentKey,undefined);assert.ok(Array.isArray(client._geoProxy.placementBodies)&&Array.isArray(client._geoProxy.surfaces));
 const hits=r.G.placementSurfaceCandidates(client,[8.82,7.98,8.54],[-0.563,-0.523,-0.64],{includeOccluded:true}),ids=hits.map(h=>h.parentStructureId);
 assert.ok(hits.length>=2,`hits ${JSON.stringify(ids)}`);assert.equal(ids[0],33,'the ellipsoid is met first');assert.ok(ids.includes(1),'the hull inside is offered too');
});
// High review 2026-11-15: before the surface survey arrives (the early authoring packet), a ship-level cut that also
// carves structures must be seen by the tap. The structure's carried solid is its shape before the cuts; the Worker's
// current body is the carved one and is used first.
test('before the survey, a tap from above lands on the carved face, not on the ellipsoid as it was before the cut',()=>{
 const r=runtime(),raw=r.C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/craft-in-ellipsoid-no-reactor-2026-11-15.json.gz'))).toString('utf8')));
 raw.solidCuts=[{id:raw.nextId++,shape:'box',c:[1.5,2,0],s:[3,1,3],structures:true}];r.C.syncCompartments(raw);
 r.C.hullGeo(raw);r.C.referenceHullGeometry(raw);for(const part of raw.parts)if(r.C.isShapePart(part)){part._solidCutShip=raw;r.C.structTriangles(part);}
 const packet=structuredClone(r.E.packCaches(raw,{authoring:true,deferSurfaces:true})),client=JSON.parse(r.C.publicJSON(raw));client._client=true;client._geoProxy=packet.geoProxy;client._editorGeometryContext='early-packet';
 for(const part of client.parts){part._editorGeometryContext=client._editorGeometryContext;const src=raw.parts.find(p=>p.id===part.id);for(const key of ['_placementGeometry','_placementSelfKey','_placementRequestKey'])if(src[key]!=null)part[key]=src[key];}
 assert.equal(client._geoProxy.surfaces,undefined,'the early packet, before the survey');
 const hits=r.G.placementSurfaceCandidates(client,[1.5,10,.05],[0,-1,0],{includeOccluded:true});assert.ok(hits.length>=1,'a hit');assert.ok(Math.abs(hits[0].p[1]-.5)<1e-3,`first hit at y ${hits[0].p[1]} (the cut's floor is 0.5; the uncut ellipsoid's top is about 2)`);
});
test('a superweapon keeps the charge it starts with through save and load',()=>{
 const s=C.newShip({...C.HULLS.sphere,L:160000,W:160000,H:160000},'station','station'),g=C.placePart(s,'gen',[80000,80000,0],16000,{}),w=C.placePart(s,'slaser',[110000,80000,0],C.SUPERWEAPONS.slaser.d,{reactor:g.id});
 assert.ok(w);w.initialCharge=1;const back=C.deserialize(JSON.parse(JSON.stringify(C.serialize(s))));assert.equal(back.parts.find(p=>p.k==='slaser').initialCharge,1);
});
