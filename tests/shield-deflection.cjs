// v24 A field deflects and absorbs beams by its strength; missiles, craft and ion ordnance pass it (docs/shield-deflection-v24.md).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),near=(a,b,e=1e-9)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(b))*e,`${a} != ${b}`);
const split=f=>C.shieldPacketEnergyJ(100,0,1000*f,1e12,1000);

test('a full field deflects most of a beam and absorbs the rest, letting nothing through',()=>{
 const r=split(1);near(r.deflectedJ,100*C.SHIELD_MODEL.deflectMax);near(r.absorbedJ,100-r.deflectedJ);near(r.beamLeakJ,0);
});
test('the hull share grows slowly at first and takes everything once the field is gone',()=>{
 const leak=[1,.9,.7,.5,.3,.1,0].map(f=>split(f).beamLeakJ);for(let i=1;i<leak.length;i++)assert.ok(leak[i]>leak[i-1]);
 assert.ok(leak[1]<1,'a field at 90% lets well under 1% through');assert.ok(leak[3]>10&&leak[3]<20);near(leak[6],100);
});
test('only the absorbed share draws on the field',()=>{
 for(const f of [1,.8,.4]){const r=split(f);near(r.shieldDebitJ,r.absorbedJ);near(r.shieldAfterJ,1000*f-r.absorbedJ);near(r.deflectedJ+r.absorbedJ+r.beamLeakJ,100);}
});
test('a field whose transient buffer is full lets the shortfall through',()=>{
 const room=1.2,r=C.shieldPacketEnergyJ(100,0,1000,room,1000);near(r.absorbedJ,room/C.SHIELD_MODEL.beamStore);near(r.beamLeakJ,100-r.deflectedJ-r.absorbedJ);assert.ok(r.beamLeakJ>0);
});
test('missiles, bombs and craft strike the hull; ion ordnance works on the ship without the field',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
 assert.match(src,/amt=\{sf:\(gun\+COMBAT\.ionShield\*ion\)\*hd,hull:\(gun\+COMBAT\.ionHull\*ion\)\*hd,direct:\(msl\+ord\+fd\)\*hd,ion:ion\*hd,ionDirect:\(imsl\+iord\)\*hd\}/);
 assert.match(src,/amt = m\.ion \? \{ionDirect: tt\} : \{direct: tt\};/);
 assert.match(src,/if\(o\.ionDirect>0\)ionOverloadJ\(u,o\.ionDirect\*TT/);
 assert.match(app,/if\(kind==='bolt'&&trial\.craft\)kind='direct';/);assert.match(app,/m\.ion\?'iontorp':'missile'/);
 const inc=C.combatIncoming();assert.equal(inc.ionDirect,0);
});
