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
 leak.slice(0,6).forEach((x,i)=>near(x,0));near(leak[6],100);
});
test('only the absorbed share draws on the field',()=>{
 for(const f of [1,.8,.4]){const r=split(f);near(r.shieldDebitJ,r.absorbedJ);near(r.shieldAfterJ,1000*f-r.absorbedJ);near(r.deflectedJ+r.absorbedJ+r.beamLeakJ,100);}
});
test('a field whose transient buffer is full lets the shortfall through',()=>{
 const room=1.2,r=C.shieldPacketEnergyJ(100,0,1000,room,1000);near(r.absorbedJ,room/C.SHIELD_MODEL.beamStore);near(r.beamLeakJ,100-r.deflectedJ-r.absorbedJ);assert.ok(r.beamLeakJ>0);
});
test('missiles, bombs and craft strike the hull; ion ordnance works on the ship without the field',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 // 2026-11-19 expectation changed: v30 warheads wreck the section they strike (docs/damage-penetration.md), so the craft's
 // ordnance (ord) and the strategic map's arriving rounds go through combatBlastAdd instead of the direct channel. Missiles,
 // bombs and craft still strike the hull, ion ordnance still works without the field.
 assert.match(src,/\{sf:\(gun\+COMBAT\.ionShield\*ion\)\*hd,hull:\(gun\+COMBAT\.ionHull\*ion\)\*hd,direct:\(msl\+fd\)\*hd,ion:ion\*hd,ionDirect:\(imsl\+iord\)\*hd\}/);
 assert.match(src,/combatBlastAdd\(incoming\.get\(t\.id\),ord\*hd\/oShot/);
 assert.match(src,/amt = m\.ion \? \{ionDirect: tt\} : \{blastRounds: m\.n \* DMG/);
 assert.match(src,/if\(o\.ionDirect>0\)ionOverloadJ\(u,o\.ionDirect\*TT/);
 assert.match(app,/if\(kind==='bolt'&&trial\.craft\)kind='direct';/);assert.match(app,/m\.ion\?'iontorp':'missile'/);
 const inc=C.combatIncoming();assert.equal(inc.ionDirect,0);
});
