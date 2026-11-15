// User report 2026-11-15 (「反応炉が『給電系統のない設備』と表示されるエラー」): with a reactor aboard whose output is 0
// (reactant supply 0%), the inspection said 「給電経路のない設備が N 系統あります（断線）」 and counted the reactor itself
// among the equipment without a power path. Nothing is broken there: the reactor has no output, which its own warning says.
const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'));
const ship=parts=>{const s=C.newShip({L:40,W:24,H:20,plan:'rect',sec:'rect'},'Reactor without output');s.parts=parts;s.fits=[];s.nextId=10;return s;};
test('a reactor with no reactant supply: its zero output is reported, not a broken power line, and the reactor is no consumer',()=>{
 const s=ship([{id:1,k:'gen',c:[30,10,0],d:2},{id:2,k:'hdis',c:[20,10,0],d:.6}]),S=C.computeStats(s),texts=S.warnings.map(w=>w.text);
 assert.equal(S.power,0);assert.ok(texts.some(t=>/反応物供給能力 0%/.test(t)),JSON.stringify(texts));assert.ok(!texts.some(t=>/給電経路のない設備/.test(t)),JSON.stringify(texts));
 assert.ok(!S.heat.net.links.some(l=>l.kind==='power'&&l.to==='p1'),'the reactor is not listed as equipment that needs a power path');
});
test('with reactant supply the plant works and a real break is still reported',()=>{
 const ok=C.computeStats(ship([{id:1,k:'gen',c:[30,10,0],d:2},{id:4,k:'pump',c:[30,10,3],d:.5},{id:2,k:'hdis',c:[20,10,0],d:.6}]));assert.ok(ok.power>0);assert.ok(!ok.warnings.some(w=>/給電経路のない設備/.test(w.text)),JSON.stringify(ok.warnings.map(w=>w.text)));
 const s=ship([{id:1,k:'gen',c:[30,10,0],d:2},{id:4,k:'pump',c:[30,10,3],d:.5},{id:2,k:'hdis',c:[20,10,0],d:.6}]);s.links=[{kind:'power',from:'p99',to:'p2',cap:1e30}];const broken=C.computeStats(s);
 assert.ok(broken.power>0);assert.ok(broken.warnings.some(w=>/給電経路のない設備/.test(w.text)),'a manual line from a missing source is a real break: '+JSON.stringify(broken.warnings.map(w=>w.text)));
});
