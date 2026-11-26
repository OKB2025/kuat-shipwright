// docs/handoff-2026-11-20/README.md:211「heatSolve に無限大の容量が入ると合計が合わない」: with a sink of no limit (Infinity) the shares were
// NaN (Infinity x 0). 2026-11-26: the heat goes to the unlimited sinks, in equal parts; what leaves the sources is what the sinks take.
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const sum=a=>Array.from(a).reduce((x,y)=>x+y,0);
test('finite sinks: as before (what moves is the lesser of the heat and the room, shared in proportion)',()=>{
 const r=C.heatSolve([6,4],[5,15],[]);assert.equal(sum(r.out),10);assert.equal(sum(r.used),10);assert.deepEqual(Array.from(r.used),[2.5,7.5]);
 const s=C.heatSolve([6,4],[2,3],[]);assert.equal(sum(s.out),5);assert.equal(sum(s.used),5);
});
test('an unlimited sink takes all of it, and the totals agree',()=>{
 const r=C.heatSolve([6,4],[5,Infinity],[]);assert.ok(Array.from(r.used).every(Number.isFinite),'no NaN: '+Array.from(r.used));assert.deepEqual(Array.from(r.out),[6,4]);assert.deepEqual(Array.from(r.used),[0,10]);
 const two=C.heatSolve([9],[Infinity,1,Infinity],[]);assert.deepEqual(Array.from(two.used),[4.5,0,4.5]);assert.equal(sum(two.out),sum(two.used));
});
