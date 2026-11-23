// User decision 2026-11-24「シールド性能の補正値は機体の長さではなくシールド発生器そのもののサイズから計算して」: the craft shield curve
// (js/core.js CRAFT_SHIELD, fieldScale) is read at the size of the unit's shield generators, not at its hull length.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),S=C.CRAFT_SHIELD,near=(a,b,m)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*1e-9,`${m}: ${a} != ${b}`);
const gen=(v,k='shield')=>({k,size:v}),cls={name:'戦闘機',craft:true};

test('a generator of the X-wing remodel size gives the X-wing field whatever the hull length',()=>{
 for(const len of [6,13.4,18])near(C.fieldScale({cls,len,modules:[gen(S.refGenV)]}),S.refScale,'len '+len);
 near(C.shieldGeneratorLength({modules:[gen(S.refGenV/2),gen(S.refGenV/2)]}),S.refLen,'two halves are one generator of the sum');
});

test('a generator twice as wide stands for a craft twice as long, a smaller one for a shorter craft',()=>{
 near(C.shieldGeneratorLength({modules:[gen(S.refGenV*8)]}),2*S.refLen,'eight times the volume');
 const E=Math.log(S.refScale)/Math.log(S.refLen/S.fullLen);near(C.fieldScale({cls,len:13.4,modules:[gen(S.refGenV*8)]}),S.refScale*2**E,'the craft power curve at 26.8 m');
 assert.ok(C.fieldScale({cls,len:13.4,modules:[gen(S.refGenV/8)]})<S.refScale,'a smaller generator gives less');
 assert.ok(C.fieldScale({cls,len:13.4,modules:[gen(S.refGenV,'localShield')]})>0,'local shield generators count (the module kind is shield in practice)');
});

test('without generator modules the hull length is used, and ships of blendLen and over keep their curve',()=>{
 near(C.fieldScale({len:13.4}),S.refScale,'no modules: length');
 for(const len of [S.blendLen,150,300,999])near(C.fieldScale({cls,len,modules:[gen(1)]}),C.fieldScale({len}),'long hull '+len);
 for(const len of [25,60,63.8,90])near(C.fieldScale({cls:{name:'コルベット'},len,modules:[gen(.01)]}),C.fieldScale({len}),'ship '+len+' keeps its length (艦は元のまま)');
 assert.equal(C.fieldScale({cls,len:S.fullLen,modules:[gen(1e-3)]}),1);
});

test('the examples: A-wing above, Z-95 below their length rule, X-wing unchanged',()=>{
 const p=k=>{const s=C.buildDesign(k);return {...C.craftCombat(s,C.computeStats(s)).powerProfile,cls};};
 const x=p('craft_xwing');assert.ok(Math.abs(C.fieldScale(x)/C.fieldScale({len:x.len})-1)<.01,'X-wing within 1% (its generator is the reference)');
 const a=p('craft_awing');assert.ok(C.fieldScale(a)>C.fieldScale({len:a.len}),'A-wing two 0.46 m generators on a 6.9 m hull');
 const z=p('craft_z95');assert.ok(C.fieldScale(z)<C.fieldScale({len:z.len}),'Z-95 one 0.51 m generator on a 16.8 m hull');
});
