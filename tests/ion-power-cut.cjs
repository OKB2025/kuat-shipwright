// 2026-11-26 The rule this file was written for is gone: an ion round no longer turns a third of the delivered power to heat for
// 0.1 s (user decision 2026-11-19, replaced by the ion rule of 2026-11-25/26: ION_RULE, tests/ion-rule.cjs). Four tests went with it:
// the cut of the guns' and the shield's delivery and its heat; a cut shorter than a step; the cut called from the app for the flown
// ship; the fixed loads working a third less. The ordnance-table test below is unrelated to the cut and stays as it was.
// User decision 2026-11-19「系統に届く分は熱に変わる分減らして」: while an ion round's cut lasts, a third of the power the plant
// has just delivered to the guns, the shield and the engines turns to heat, and those systems get exactly that much less. The
// plant's draw stays, and the shield's store is not cut (before, the share was put on the systems' working shares: the guns got
// their full power and a third of the shield's store was wiped).
// User decision 2026-11-19「古い表も揃えて」: the old ordnance table carries the air rounds' yield; the size and mass by
// which a station's count and a loaded craft's mass are worked out are unchanged (a 4 m round fits none of the examples' tubes).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{test}=require('node:test');
const root=process.env.KS_TEST_ROOT||path.resolve(__dirname,'..'),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx);
test('the old ordnance table carries the air rounds; stations hold as many as before',()=>{
 for(const [k,o] of Object.entries(C.ORDNANCE)){const r=C.airRound(k);assert.equal(o.tt,r.tt,k);assert.equal(o.body.mass,r.mass,k);assert.deepEqual([...o.body.dims],[...r.dims],k);/* 2026-11-26 expectation changed (user「ミサイルを0.12×0.9 魚雷を0.18×1 爆弾は0.3の球」「弾の寸法は威力も変える」): the table's own size and mass are the round's now (was: the old station size, dims[0] <= 1.3 and mass < 0.2 t, apart from the air round) */assert.deepEqual([...o.dims],[...r.dims],k);assert.equal(o.mass,r.mass,k);}
 /* 2026-11-26 expectation changed (same decision): yields by the new bodies. torpedo 0.0895 -> 0.000725 TT (725 MT), missile 0.0471 -> 0.000153 TT (153 MT), bomb 0.1885 -> 0.000424 TT (424 MT) */assert.ok(Math.abs(C.ORDNANCE.ptorp.tt-7.252e-4)<1e-6);assert.ok(Math.abs(C.ORDNANCE.cmsl.tt-1.527e-4)<1e-6);assert.ok(Math.abs(C.ORDNANCE.bomb.tt-4.241e-4)<1e-6);
 assert.equal(C.ORDNANCE.itorp.ion,true);
 const n=k=>C.craftOrdnance(k).map(o=>o.kind+'x'+o.n).join(',');
 /* 2026-11-24 expectation changed: an aircraft's tube holds 2 torpedoes or 3 missiles (user「魚雷は発射機あたりに2発、ミサイルは発射機あたりに3発」): X-wing 6 → 4, Y-wing 8 → 4, TIE/sa 4 → 2, A-wing 12 → 6 */assert.equal(n('xwing'),'ptorpx4');assert.equal(n('ywing'),'ptorpx4');/* 2026-11-23 expectation changed: the TIE/sa's launch tube is back with its canon 4 rounds (user: 「発射管を復活」; v24 pylon: 3) */assert.equal(n('tie_sa'),'ptorpx2,bombx8');assert.equal(n('awing'),'cmslx6');
});
test('the power cut of 2026-11-19 is no longer in the code',()=>{for(const k of ['ION_ROUND','ionPowerLoss','ionPowerCut'])assert.equal(C[k],undefined,k);const app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');assert.ok(!/ionPowerCut/.test(app));});
