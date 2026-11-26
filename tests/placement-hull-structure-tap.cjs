// User report 2026-11-26「船体の曲面にタップしても配置できない」(the user's own design, a 150 m cigar hull built as a hull
// structure): while placing a part, a tap on the hull structure's own skin was dropped with 取付先の構造物と取付位置を
// タップしてください. The primary hull structure has no placement record (it was never placed on anything), so its
// carried solid could not count as an accepted placement, the editor took its shape as unknown, and every tap whose
// line of sight met its bounds first returned nothing (js/gfx.js placementAuthoringHits). The Worker's body with the
// same source key is its current shape. Core accepted the placement all along; only the editor's pick refused it.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),vm=require('node:vm'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..');
function runtime(){const context=vm.createContext({console,performance,setTimeout,clearTimeout,structuredClone});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js','js/engine.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});return vm.runInContext('({C:Core,G:Gfx,E:YardEngine})',context);}
// The design as the designer holds it after the Worker's completed packet (as tests/placement-loaded-structure-pick.cjs).
function client(r){const raw=r.C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/hull-structure-placement-tap-2026-11-26.json.gz'))).toString('utf8')));r.C.syncCompartments(raw);
 for(const part of raw.parts)if(r.C.isShapePart(part)){part._solidCutShip=raw;r.C.structTriangles(part);}
 const packet=structuredClone(r.E.packCaches(raw)),c=JSON.parse(r.C.publicJSON(raw));c._client=true;c._geoProxy=packet.geoProxy;c._editorGeometryContext='completed-worker-context';
 for(const part of c.parts){part._editorGeometryContext=c._editorGeometryContext;const src=raw.parts.find(p=>p.id===part.id);for(const key of ['_placementGeometry','_placementSelfKey','_placementRequestKey'])if(src[key]!=null)part[key]=src[key];}
 return {raw,c};}
test('the primary hull structure has no placement record and still carries a solid',()=>{
 const r=runtime(),{c}=client(r),hull=c.parts.find(p=>p.primaryHull);assert.ok(hull,'the hull structure');assert.equal(hull.placement,undefined,'it was never placed on anything');assert.ok(hull._placementGeometry,'it carries a solid');
 assert.ok(c._geoProxy.placementBodies.some(b=>b.parentStructureId===hull.id&&b.sourceKey===r.C.publicJSON(hull)),'the Worker body is the one of this part');
});
test('a placement tap on the hull structure\'s curved skin reaches it, all round the section',()=>{
 const r=runtime(),{raw,c}=client(r),hull=c.parts.find(p=>p.primaryHull),shapes=raw.parts.filter(p=>r.C.isShapePart(p));let own=0;
 // every line of sight, round the section and along the length, on which the hull structure is the first thing met
 for(const x of [20,50,80,110,135,142])for(const deg of [0,45,90,135,180,225,270,315]){const a=deg*Math.PI/180,o=[x,12.5+60*Math.cos(a),60*Math.sin(a)],d=[0,-Math.cos(a),-Math.sin(a)];let near=null;for(const p of shapes){const h=r.C.rayPart(o,d,p);if(h&&(!near||h.t<near.t))near={t:h.t,id:p.id};}
  if(near?.id!==hull.id)continue;own++;const hits=r.G.placementSurfaceCandidates(c,o,d,{});assert.ok(hits.length>=1,`x ${x}, ${deg} degrees: the tap is not dropped`);assert.equal(hits[0].parentStructureId,hull.id,`x ${x}, ${deg} degrees: the hull structure`);assert.ok(hits[0].p&&hits[0].n,'with a point and a normal');assert.ok(Math.abs(hits[0].t-near.t)<.5,`at the skin (${hits[0].t} against ${near.t})`);}
 assert.ok(own>=8,'lines of sight that meet the hull structure first: '+own);
});
test('a tap on a structure that stands on the hull still reaches that structure first',()=>{
 const r=runtime(),{c}=client(r),hits=r.G.placementSurfaceCandidates(c,[75,60,0],[0,-1,0],{});assert.ok(hits.length>=1);assert.equal(hits[0].parentStructureId,16,'the structure on top of the hull at mid length');
});
