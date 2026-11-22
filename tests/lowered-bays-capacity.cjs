// 2026-11-22 (user decision 「高さを足して機数を戻す」): bays lowered onto the bottom skin (seatBayOnSkin) keep their ceiling, so
// they hold at least what they held before lowering (version 6: Dreadnaught 12 = its TIE squadron, Onager 14) and still open
// where they meet the skin.
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const load=k=>C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,`data/examples/${k}/design.json.gz`)))));
for(const [k,min] of [['dreadnaught',12],['onager',14]])test(`${k}: the lowered bay holds at least ${min} craft and opens at the skin`,()=>{
 const s=load(k),S=C.computeStats(s);assert.ok(S.storageCapacity>=min,`storage ${S.storageCapacity}`);
 const bottom=s.hatches.filter(h=>h.face==='bottom');assert.ok(bottom.length>=1);for(const h of bottom)assert.ok(C.hatchGrid(s,h).area>1000,`hatch ${h.id} ${C.hatchGrid(s,h).area} m²`);
});
