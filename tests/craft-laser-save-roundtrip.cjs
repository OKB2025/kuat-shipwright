// 2026-11-26 (regression review of PR #127): the save format changed with the one fixed aircraft laser. A save made
// before it (light and heavy lasers as kinds of their own, no mark) must open as the one laser with its own bores,
// lengths, sinks and pair relations kept, carry the rule's mark from then on, and come back unchanged through a save
// and a load. The nozzle is saved too. The fixture is the user's design of 2026-11-25 (two medium, two heavy and
// sixteen light lasers, in mirrored pairs), as it was handed over.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),{C}=require(path.join(root,'scripts/update-ship-examples.cjs')).loadRuntime(root);
const raw=()=>JSON.parse(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs/tie-avenger-prototype-2026-11-25.json'),'utf8'));
const LASER=new Set(['claser','claserL','claserH']),lasers=o=>o.fits.filter(f=>LASER.has(f.k)),row=f=>({id:f.id,k:f.k,boreM:f.boreM,barrelM:f.barrelM,rateHz:f.rateHz,sink:f.sink??0,tw:f.tw??null,nozzle:f.nozzle??null,p:f.p.map(v=>+v.toFixed(9))});
test('an older save opens with every light and heavy laser as the one laser, its own figures kept',()=>{
 const o=raw(),before=lasers(o);assert.equal(o.craftLaserRule,undefined,'the hand-over file has no mark');assert.deepEqual([...new Set(before.map(f=>f.k))].sort(),['claser','claserH','claserL']);
 const s=C.deserialize(raw()),after=s.fits.filter(f=>LASER.has(f.k));assert.equal(after.length,before.length);assert.ok(after.every(f=>f.k==='claser'),'one kind');assert.equal(s.craftLaserRule,C.serialize(s).craftLaserRule);
 for(const b of before){const a=after.find(f=>f.id===b.id);assert.ok(a,'#'+b.id);for(const key of ['boreM','barrelM','rateHz'])assert.equal(a[key],b[key],'#'+b.id+' '+key);assert.equal(a.sink??0,b.sink??0,'#'+b.id+' sink');assert.equal(a.tw??null,b.tw??null,'#'+b.id+' pair');assert.deepEqual(a.p.map(v=>+v.toFixed(9)),b.p.map(v=>+v.toFixed(9)),'#'+b.id+' seat');}
});
test('a light or heavy laser saved without a bore or a length takes the ones its type stood for',()=>{
 const o=raw(),L=o.fits.find(f=>f.k==='claserL'),H=o.fits.find(f=>f.k==='claserH');for(const f of [L,H]){delete f.boreM;delete f.barrelM;}
 const s=C.deserialize(o),l=s.fits.find(f=>f.id===L.id),h=s.fits.find(f=>f.id===H.id);assert.equal(l.k,'claser');assert.equal(h.k,'claser');
 assert.ok(Math.abs(l.boreM-C.craftLaserBoreOf20261124(.12))<1e-12);assert.equal(l.barrelM,1);assert.ok(Math.abs(h.boreM-C.craftLaserBoreOf20261124(.30))<1e-12);assert.equal(h.barrelM,1.44);
 assert.ok(Math.abs(C.fitSpec(l).gunRule.shotKt-42.88)<.01,'the light laser\'s shot');assert.ok(Math.abs(C.fitSpec(h).gunRule.shotKt-436)<.01,'the heavy laser\'s shot');
});
test('a save and a load leave the lasers as they are, with the mark and the nozzle',()=>{
 const s=C.deserialize(raw()),one=s.fits.find(f=>f.k==='claser'&&f.rateHz===1);assert.ok(one,'a gun at one shot a second');one.nozzle='track';
 const saved=JSON.parse(JSON.stringify(C.serialize(s)));assert.equal(saved.craftLaserRule,2,'the mark');assert.ok(saved.fits.every(f=>f.k!=='claserL'&&f.k!=='claserH'),'no retired kind is written');
 const back=C.deserialize(saved);assert.deepEqual(back.fits.filter(f=>f.k==='claser').map(row),s.fits.filter(f=>f.k==='claser').map(row));assert.equal(back.fits.find(f=>f.id===one.id).nozzle,'track');assert.equal(C.fitSpec(back.fits.find(f=>f.id===one.id)).gunRule.nozzle,'track');
 const again=JSON.parse(JSON.stringify(C.serialize(back)));assert.deepEqual(again.fits,saved.fits,'a second save writes the same fittings');
});
test('the mark tells a design saved under the present rule from an older one',()=>{
 const old=C.deserialize(raw());assert.equal(old._craftLaserRuleSaved,undefined,'an older save: not marked as saved under the rule');
 const now=C.deserialize(JSON.parse(JSON.stringify(C.serialize(old))));assert.equal(now._craftLaserRuleSaved,2,'saved again: marked');assert.equal(JSON.parse(C.publicJSON(now)).craftLaserRule,2,'and the copy the worker gets says so');
});
