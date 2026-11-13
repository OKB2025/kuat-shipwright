// A new design from each hull preset can be saved and loaded (known bug, handoff 2026-11-12 §6: the cylinder
// (cigar) preset failed with 「船体構造物の船体形状が不正です」 because its bow tip has zero width). The new
// design sampled only the two end stations, so pointed plans got a zero section and every curved plan lost its
// shape (on e5527e1: arrow 28 %, block 70 %, cylinder 31 %, disc 0 % of the preset's volume). The stations now
// follow the preset's plan, tips keep the smallest accepted section (0.02), and a straight taper stays two stations.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
for(const key of Object.keys(C.HULLS))test(`new design from the ${key} preset: saves, loads and keeps the preset's volume`,()=>{
 const preset=C.computeStats(C.newShip(Object.assign({},C.HULLS[key]),'t')).volume;
 const s=C.newShip(Object.assign({},C.HULLS[key]),'t');C.ensurePrimaryHull(s,{newDesign:true});C.enableSurfaceMode(s,true,{report:false});
 const loaded=C.deserialize(JSON.parse(C.publicJSON(C.serialize(s))));
 const v=C.computeStats(loaded).volume;assert.ok(Math.abs(v/preset-1)<.015,`${key}: ${v} vs preset ${preset}`);
 const st=C.primaryHullPart(loaded).hullProfile.stations;assert.ok(st.every(r=>r[1]>=.02&&r[2]>=.02),key);
 if(['wedge','lance'].includes(key))assert.equal(st.length,2,key+': a straight taper stays two stations');
});
