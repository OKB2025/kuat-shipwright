// User decision 2026-11-16「シールドの吸収熱は無くして、単にシールドを生成する時に作動熱のみで」: the absorbed beam no longer heats
// the ship. The beam case now expects no onboard heat and .88 of the absorbed share released outside (was .06 heat, .82 out).
const path=require('node:path'),assert=require('node:assert/strict'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..')),TT=4.184e21,near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1,Math.abs(b))*1e-10,`${a} != ${b}`),ctx={ev(){}};
C.HEAT.qAllowJPerKg=1;
function unit(shieldJ=100){return {id:'ion-control',p:{mass:.1,propulsion:{massKg:100},modules:[],crewMax:100,heat:{src:[],dis:[],ln:[]}},crew:100,mods:[],shield:shieldJ/TT,shieldMax:100/TT,shieldTransient:0};}
test('ion uses pre-hit shield energy and exactly the three specified SI examples',()=>{
 for(const [S,E,out,cost,heat]of [[100,80,76,4,0],[100,150,95,5,50],[0,100,0,0,100]]){const p=C.ionShieldEnergyJ(E,S),u=unit(S),r=C.shieldReceive(u,{energyJ:E,ionJ:E},ctx);near(p.externalJ,out);near(p.shieldDebitJ,cost);near(p.heatJ,heat);near(r.externalJ,out);near(u.shield*TT,S-cost);near(u.ht?.qJ||0,heat);near(u.shieldTransient,0);near(out+cost+heat,E);}
});
test('ion bypasses the normal transient store and does not double-deposit penetrating energy',()=>{
 const u=unit();u.shieldTransient=35/TT;const r=C.shieldReceive(u,{energyJ:150,ionJ:150},ctx);near(r.ionLeakJ,50);near(u.ht.qJ,50);near(u.shieldTransient*TT,35);near(u.ionLedger.heatJ,50);assert.equal(u.down,undefined);
});
// v24 A full field deflects 82% of a beam at no cost; the absorbed rest is split 88/12/0 (released / held for a moment / heat; docs/shield-deflection-v24.md).
test('ordinary fire: the deflected share leaves freely, the absorbed share is split 88/12 and no heat enters global Q',()=>{
 const u=unit(),r=C.shieldReceive(u,{energyJ:100,ionJ:0},ctx),a=100-100*C.SHIELD_MODEL.deflectMax;near(r.absorbedJ,a);near(r.externalJ,82+.88*a);near(r.storedDeltaJ,.12*a);near(r.onboardHeatJ,0);near(u.ht?.qJ||0,0);near(u.shieldTransient*TT,.12*a);/* 2026-11-20 expectation changed (was 100-a = 82, now 95.5): user instruction 2026-11-19「シールドの削り値を減らして」(「砲火がシールドを減らす量そのもの」) — the field loses SHIELD_MODEL.debit (.25) of what it absorbs, no longer all of it (js/core.js shieldPacketEnergyJ, commit 1a62163). The split of the absorbed share (88/12/0) checked above is unchanged. *//* 2026-11-20 again: user decision「小型機のシールドをさらに弱くなるような曲線にする」— the debit follows the field's capacity (C.shieldDebitK); this fixture's 100 J field is far below the small end, so it loses twice what it absorbs (64 left). A ship's field keeps .25. */near(u.shield*TT,100-a*C.shieldDebitK(100/TT));assert.equal(C.SHIELD_MODEL.debit,.25);assert.equal(C.shieldDebitK(100/TT),C.SHIELD_MODEL.debitSmall);assert.equal(C.shieldDebitK(5),.25);near(r.beamLeakJ,0);
});
test('subjugator pulse retains redirected and unhit energy across successive shields',()=>{
 const first=C.ionPulseInteractionJ(100,100,100),second=C.ionPulseInteractionJ(first.remainingPulseJ,first.remainingPulseJ,100);near(first.remainingPulseJ,95);near(first.shieldDebitJ,5);near(second.remainingPulseJ,90.25);
 const partial=C.ionPulseInteractionJ(100,40,100);near(partial.remainingPulseJ,98);near(partial.initialPulseJ,partial.remainingPulseJ+partial.pulseConsumedJ);
 const pierced=C.ionPulseInteractionJ(100,100,40);near(pierced.heatJ,60);near(pierced.remainingPulseJ,38);near(pierced.pulseConsumedJ,62);
});
test('unblocked ion reaching the global heat limit immediately trips the whole vessel',()=>{
 const u=unit(0);C.shieldReceive(u,{energyJ:100,ionJ:100},ctx);near(u.ht.qJ,100);assert.equal(u.ht.online,false);near(u.ht.damageLimit,.6);near(C.shipHeatOutputFactor(u),0);assert.equal(u.ionK,0);
});
