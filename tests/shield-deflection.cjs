// v24 A field deflects and absorbs beams by its strength; missiles, craft and ion ordnance pass it (docs/shield-deflection-v24.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`);
const split=f=>C.shieldPacketEnergyJ(100,0,1000*f,1e12,1000);

test('a full field deflects most of a beam and absorbs the rest, letting nothing through',()=>{
 const r=split(1);near(r.deflectedJ,100*C.SHIELD_MODEL.deflectMax);near(r.absorbedJ,100-r.deflectedJ);near(r.beamLeakJ,0);
});
// 2026-11-19 expectation changed: a standing field lets nothing by (SHIELD_MODEL.holdWhileUp, docs/damage-penetration.md:64);
// before, the hull share grew with the field's loss (a field at 50% let 10 to 20% through). It still takes everything once
// the field is gone.
test('the hull share grows slowly at first and takes everything once the field is gone',()=>{
 const leak=[1,.9,.7,.5,.3,.1,0].map(f=>split(f).beamLeakJ);
 // 2026-11-20 expectation changed with the user decision「小型機のシールドをさらに弱くなるような曲線にする」: this fixture's field (1,000 J) is a
 // small one and loses twice what it absorbs (C.shieldDebitK), so at 10% (100 J left) it can no longer take the whole 100 J packet
 // and the rest goes by (41.8 J). Down to 30% nothing goes by, as before. A ship-sized field (5 TT, debit .25) still lets nothing
 // by at 10%.
 leak.slice(0,5).forEach((x,i)=>near(x,0));assert.ok(leak[5]>0&&leak[5]<100,'a small field at 10% is overrun: '+leak[5]);near(leak[6],100);
 {const TT=4.184e21,cap=5*TT,big=C.shieldPacketEnergyJ(cap*.1,0,cap*.1,1e40,cap);near(big.beamLeakJ/cap,0);}
});
test('only the absorbed share draws on the field',()=>{
 for(const f of [1,.8,.4]){const r=split(f);/* 2026-11-19 expectation changed with the user instruction「シールドの削り値を減らして」(「砲火がシールドを減らす量そのもの」): the field loses SHIELD_MODEL.debit of what it absorbs, no longer all of it *//* 2026-11-20 user decision「小型機のシールドをさらに弱くなるような曲線にする」: the share follows the field's capacity (C.shieldDebitK); this fixture's field is 1,000 J, far below the small end */{const K=C.shieldDebitK(1000/4.184e21);assert.equal(K,C.SHIELD_MODEL.debitSmall);near(r.shieldDebitJ,r.absorbedJ*K);near(r.shieldAfterJ,1000*f-r.absorbedJ*K);}near(r.deflectedJ+r.absorbedJ+r.beamLeakJ,100);}
});
test('a field whose transient buffer is full lets the shortfall through',()=>{
 const room=1.2,r=C.shieldPacketEnergyJ(100,0,1000,room,1000);near(r.absorbedJ,room/C.SHIELD_MODEL.beamStore);near(r.beamLeakJ,100-r.deflectedJ-r.absorbedJ);assert.ok(r.beamLeakJ>0);
});
test('missiles and bombs strike the hull, craft lasers meet the field unless fired from inside it; ion ordnance works on the ship without the field',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 // 2026-11-19 expectation changed: v30 warheads wreck the section they strike (docs/damage-penetration.md), so the craft's
 // ordnance (ord) and the strategic map's arriving rounds go through combatBlastAdd instead of the direct channel. Missiles,
 // bombs and craft still strike the hull, ion ordnance still works without the field.
 // 2026-11-24 expectation changed (user「シールドに当たる場合はシールドに防がれる。スレスレを飛行してシールドの内側に入ると直接ダメージ」): the embarked
 // craft's lasers (fd) meet the field like the guns, as their own bolts (the `air` amount, FLEET_AIR_GUN_BOLT); only fire from inside the
 // field strikes the ship itself. Missiles still take the direct channel. Was: direct:(msl+fd)*hd from outside the field too.
 assert.match(src,/\{sf:\(gun\+COMBAT\.ionShield\*ion\)\*hd,hull:\(gun\+COMBAT\.ionHull\*ion\)\*hd,air:fd\*hd(?:\/\*[^]*?\*\/)?,direct:msl\*hd,ion:ion\*hd,ionDirect:\(imsl\+iord\)\*hd\}/);
 assert.match(src,/amt=inside\?\{sf:0,hull:0,direct:\(gun\+msl\+fd\)\*hd,ion:0,ionDirect:\(ion\+imsl\+iord\)\*hd\}:/,'from inside the field every kind of fire, the craft lasers too, strikes the ship itself');
 assert.match(src,/if\(amount\.air>0\)combatAdd\(incoming,target,u\.pos,\{sf:amount\.air,hull:amount\.air,shot:FLEET_AIR_GUN_BOLT\},aim,u\.id\)/,'the craft lasers reach the field as shield fire (sf), not as a direct strike');
 assert.match(src,/combatBlastAdd\(incoming\.get\(t\.id\),ord\*hd\/oShot/);
 assert.match(src,/amt = m\.ion \? \{ionDirect: tt\} : \{blastRounds: m\.n \* DMG/);
 assert.match(src,/if\(o\.ionDirect>0\)ionOverloadJ\(u,o\.ionDirect\*TT/);
 assert.match(app,/if\(kind==='bolt'&&trial\.craft\)kind='direct';/);assert.match(app,/m\.ion\?'iontorp':'missile'/);
 const inc=C.combatIncoming();assert.equal(inc.ionDirect,0);
});
