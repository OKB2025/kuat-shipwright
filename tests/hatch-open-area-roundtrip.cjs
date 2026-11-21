// 2026-11-21 (regression review): a hull-structure opening adopted from a hangar keeps the skin area measured then
// (hullData.hatches[].openArea, aviationSkinOverlap). Loading a design dropped it, so a loaded Providence opened a
// different area from the one its stored figures were computed with. A resize scales it with the opening.
const path=require('node:path'),fs=require('node:fs'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const raw=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/providence/design.json.gz'))));
const areas=d=>d.parts.flatMap(p=>(p.hullData?.hatches||[]).filter(h=>h.openArea!=null).map(h=>[p.id,h.id,h.openArea]));

test('the measured opening area survives loading and saving again',()=>{
 const r=raw(),saved=areas(r);assert.ok(saved.length>=4,'the Providence stores measured openings');
 const s=C.deserialize(r);assert.deepEqual(areas(s),saved);assert.deepEqual(areas(JSON.parse(C.publicJSON(s))),saved);
});
test('an invalid stored area is refused',()=>{
 for(const bad of [-1,'12',Infinity]){const r=raw(),h=r.parts.flatMap(p=>p.hullData?.hatches||[]).find(h=>h.openArea!=null);h.openArea=bad;assert.throws(()=>C.deserialize(r),/開口/);}
});
test('resizing the hull structure scales the area with the opening',()=>{
 const s=C.deserialize(raw()),p=s.parts.find(p=>areas({parts:[p]}).length),before=new Map(p.hullData.hatches.filter(h=>h.openArea!=null).map(h=>[h.id,h.openArea]));
 C.setHullStructureDimensions(s,p,p.s.map(v=>v*2));for(const h of p.hullData.hatches.filter(h=>before.has(h.id)))assert.ok(Math.abs(h.openArea/before.get(h.id)-4)<1e-9,`hatch ${h.id}: ${h.openArea}`);
});
