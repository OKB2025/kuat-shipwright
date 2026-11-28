// 2026-11-28 (user「試験ブランチの報告書を確認してシールド設定を変えて」「艦も含めて 1 本の曲線」): the field's capacity follows a curve whose
// X-wing point is 7.5 times the old one, joined to the same Venator point (test/air-4v4-20261128, x-shield and capacity-curve); the
// recharge and the reserve keep the old curve. Craft and ships share the capacity curve.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const cx=vm.createContext({console:{log(){},warn(){},error:console.error}});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),F=vm.runInContext('YardFleetData',cx).designs,S=C.SHIELD_CURVE;
test('the capacity curve: 7.5 times at the X-wing\'s generator, the whole field from the Venator\'s',()=>{
 const x={modules:[{k:'shield',size:S.refGenV}]},v={modules:[{k:'shield',size:S.fullGenV}]};
 assert.ok(Math.abs(C.shieldBufferScale(x)/C.fieldScale(x)-7.5)<1e-9);assert.equal(C.shieldBufferScale(v),1);assert.equal(C.fieldScale(v),1);
 assert.ok(Math.abs(C.SHIELD_BUFFER_EXP-0.8231732453)<1e-9,'the exponent of the trial report');
});
test('the report\'s capacities: X-wing 2,149.81 kt, A-wing 248.28, TIE/D 2,437.86, TIE Avenger 1,351.23',()=>{
 for(const [k,kt] of [['craft_xwing',2149.81],['craft_awing',248.28],['craft_tie_d',2437.86],['craft_tie_avenger',1351.23]]){const s=C.buildDesign(k),p=JSON.parse(JSON.stringify(C.fleetProfile(C.computeStats(s),s.name,s))),u=C.fleetUnit('a',k,p,0);
  assert.ok(Math.abs(u.shieldMax*1e9-kt)<0.05,`${k}: ${u.shieldMax*1e9} kt`);}
});
test('ships share the curve: a CR90\'s field holds more, the recharge and the reserve are as before; a Venator is unchanged',()=>{
 const p=JSON.parse(JSON.stringify(F.cr90.p)),u=C.fleetUnit('c','cr90',p,0),k=C.shieldBufferScale(p)/C.fieldScale(p);
 assert.ok(k>2&&k<2.6,`CR90 ×${k}`);assert.ok(Math.abs(u.shieldMax-(p.shieldBuffer??0)*C.shieldBufferScale(p))<=1e-12*Math.max(1,u.shieldMax));
 const ven=JSON.parse(JSON.stringify(F.venator.p));assert.equal(C.shieldBufferScale(ven),C.fieldScale(ven));
});
