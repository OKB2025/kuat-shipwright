// User decision 2026-11-24「シールド性能の補正値は機体の長さではなくシールド発生器そのもののサイズから計算して」: the craft shield curve
// (js/core.js CRAFT_SHIELD, fieldScale) is read at the size of the unit's shield generators, not at its hull length.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
// 2026-11-24, later the same day (user「シールドはヴェネターとXウイングをつなぐ曲線で決まるはずだ」「実際の被弾距離で」): ships and craft share one
// curve by generator volume (C.SHIELD_CURVE): the X-wing generator (0.333 m3) gives 6.158e-6, the Venator's (61,561 m3) gives 1.
// CRAFT_SHIELD (refScale 3e-6, by length) is left only for a unit that lists no generator.
const C=vm.runInContext('Core',cx),S=C.CRAFT_SHIELD,SC=C.SHIELD_CURVE,EXP=Math.log(SC.refScale)/Math.log(SC.refGenV/SC.fullGenV),curve=v=>Math.min(1,(v/SC.fullGenV)**EXP),near=(a,b,m)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*1e-9,`${m}: ${a} != ${b}`);
const gen=(v,k='shield')=>({k,size:v}),cls={name:'戦闘機',craft:true};

test('a generator of the X-wing remodel size gives the X-wing field whatever the hull length',()=>{
 assert.equal(SC.refGenV,S.refGenV);near(SC.refScale,6.158e-6,'the X-wing point of the curve');
 for(const len of [6,13.4,18])near(C.fieldScale({cls,len,modules:[gen(SC.refGenV)]}),SC.refScale,'len '+len);
 near(C.shieldGeneratorLength({modules:[gen(S.refGenV/2),gen(S.refGenV/2)]}),S.refLen,'two halves are one generator of the sum');
});

test('a generator twice as wide stands for a craft twice as long, a smaller one for a shorter craft',()=>{
 near(C.shieldGeneratorLength({modules:[gen(S.refGenV*8)]}),2*S.refLen,'eight times the volume');
 near(C.fieldScale({cls,len:13.4,modules:[gen(SC.refGenV*8)]}),SC.refScale*8**EXP,'the generator-volume curve at eight times the volume');near(C.fieldScale({cls,len:13.4,modules:[gen(SC.refGenV*8)]}),curve(SC.refGenV*8),'the same curve from the Venator point');
 assert.ok(C.fieldScale({cls,len:13.4,modules:[gen(S.refGenV/8)]})<S.refScale,'a smaller generator gives less');
 assert.ok(C.fieldScale({cls,len:13.4,modules:[gen(S.refGenV,'localShield')]})>0,'local shield generators count (the module kind is shield in practice)');
});

test('without generator modules the hull length is used; with generators, ships and craft of any length read the one generator-volume curve',()=>{
 near(C.fieldScale({len:13.4}),S.refScale,'no modules: length');near(C.fieldScale({len:13.4}),C.lengthFieldScale({len:13.4}),'no modules: the length rule');
 // was: long craft hulls and ships kept their length curve (艦は元のまま). One curve for ships too since 2026-11-24.
 for(const len of [S.blendLen,150,300,999])near(C.fieldScale({cls,len,modules:[gen(1)]}),curve(1),'long hull '+len);
 for(const len of [25,60,63.8,90])near(C.fieldScale({cls:{name:'コルベット'},len,modules:[gen(.01)]}),curve(.01),'ship '+len+' reads its generator');
 assert.ok(curve(1)<1&&curve(.01)<curve(1));
 assert.equal(C.fieldScale({len:S.fullLen}),1);assert.equal(C.fieldScale({cls:{name:'コルベット'},len:1137,modules:[gen(SC.fullGenV)]}),1,'the Venator generator: no reduction');assert.equal(C.fieldScale({cls:{name:'コルベット'},len:1137,modules:[gen(SC.fullGenV*4)]}),1,'never above 1');
});

test('the examples: A-wing above, Z-95 below their length rule, X-wing at the X-wing point of the curve',()=>{
 const p=k=>{const s=C.buildDesign(k);return {...C.craftCombat(s,C.computeStats(s)).powerProfile,cls};};
 const x=p('craft_xwing');assert.ok(Math.abs(C.fieldScale(x)/SC.refScale-1)<.01,'X-wing within 1% of the curve point (its generator is the reference; was the length figure 3e-6)');
 const a=p('craft_awing');assert.ok(C.fieldScale(a)>C.fieldScale({len:a.len}),'A-wing two 0.46 m generators on a 6.9 m hull');
 const z=p('craft_z95');assert.ok(C.fieldScale(z)<C.fieldScale({len:z.len}),'Z-95 one 0.51 m generator on a 16.8 m hull');
 for(const q of [x,a,z])near(C.fieldScale(q),curve(C.shieldGeneratorVolume(q)),'by generator volume');assert.ok(C.fieldScale(z)<C.fieldScale(a)&&C.fieldScale(a)<C.fieldScale(x),'smaller generators give less, whatever the hull length');
});

test('a strategic-map squad flies its craft with the generator rule, the same figure as a fleet unit',()=>{
 // 2026-11-24 (high-effort review): the squad's drive unit is built from the catalogue power profile, which has no class; Rts marks it
 // craftShield so fieldScale reads the generator. Before this the Z-95 squad kept the length figure (5.8e-6 for 6.4e-7).
 const {R}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
 for(const [type,key] of [['ywing','craft_ywing'],['z95','craft_z95'],['awing','craft_awing']]){
  const sq={id:'t-'+type,craft:type,side:0,pos:[0,0,0],h:[1,0,0],laserGas:100};R.squadPropulsion(sq,1,.5,true);
  const s=C.buildDesign(key),S=C.computeStats(s),fleet=C.fleetProfile(S,s.name,s);
  assert.ok(Math.abs(C.fieldScale(sq.drive.p)/C.fieldScale(fleet)-1)<1e-3,type+': '+C.fieldScale(sq.drive.p)+' / '+C.fieldScale(fleet));
 }
});
