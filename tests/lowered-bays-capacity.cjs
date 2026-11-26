// 2026-11-22 (user decision 「高さを足して機数を戻す」): bays lowered onto the bottom skin (seatBayOnSkin) keep their ceiling, so
// they hold at least what they held before lowering (version 6: Dreadnaught 12 = its TIE squadron, Onager 14) and still open
// where they meet the skin.
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
/* 2026-11-26 test changed: the design is loaded as the game loads it (guns seated, then the rooms derived: engine.js). Read without that, the point-defence twins' new firing-gas rooms (2026-11-25) stand where the unseated guns are, inside the Onager's lowered bays, and the bays count as overlapped (capacity 0; 18 loaded as the game does). */const load=k=>{const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,`data/examples/${k}/design.json.gz`)))));C.remount(s,{keepFitPose:true});C.syncCompartments(s);return s;};
for(const [k,min] of [['dreadnaught',12],['onager',14]])test(`${k}: the lowered bay holds at least ${min} craft and opens at the skin`,()=>{
 const s=load(k),S=C.computeStats(s);assert.ok(S.storageCapacity>=min,`storage ${S.storageCapacity}`);
 const bottom=s.hatches.filter(h=>h.face==='bottom');assert.ok(bottom.length>=1);for(const h of bottom)assert.ok(C.hatchGrid(s,h).area>1000,`hatch ${h.id} ${C.hatchGrid(s,h).area} m²`);
});
