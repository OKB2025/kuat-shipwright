// A ship with no generator is told so once (「ジェネレーターがありません」). Its living and electronics load has
// no source, and that was also reported as a broken power line 「給電経路のない設備が 1 系統あります（断線）」,
// the same fact twice (seen on the user design of 2026-11-13). A real break with a generator is still reported.
const assert=require('node:assert/strict'),fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
test('no generator: one warning, not a second broken-line warning',()=>{
 const s=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'fixtures/copied-structure-lost-parent-2026-11-13.json.gz'))).toString('utf8')));
 const S=C.computeStats(s);assert.ok(S.warnings.some(w=>/ジェネレーターがありません/.test(w.text)));assert.ok(S.heat.power.broken>0,'the network still counts the sourceless load');
 assert.ok(!S.warnings.some(w=>/給電経路のない設備/.test(w.text)),JSON.stringify(S.warnings.map(w=>w.text)));
});
