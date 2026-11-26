// 2026-11-25 The GR-75 example is the user's design with its interior rebuilt (「GR-75が輸送船にしては反応炉もシールドも大きすぎる」
// 「GR-75を内部作り直した」), taken as it is. Its engines were not touched, yet two of them gave no thrust: their machinery still
// named auxiliary reactors that the rebuilt interior no longer has (user「エンジンは何も手を加えてないのでバグでは？」). A reactor
// that is gone is no choice any more: such an engine is fed as one with no reactor chosen.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console:{log(){},warn(){},error(){}}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),source=JSON.parse(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs/gr75-remodel-2026-11-25.json'),'utf8'));
const shape=p=>JSON.stringify([p.k,p.form,p.c,p.s,p.d,p.outline,p.label]),seat=f=>JSON.stringify([f.k,f.p,f.a,f.assetYaw||0,f.base||0,f.ped||0]);
test('the example is the user\'s file: every part and both turrets as saved',()=>{
 const s=C.buildDesign('gr75'),file=C.deserialize(JSON.parse(JSON.stringify(source)));
 /* 2026-11-26 expectation changed (the repulsorlift is carried for the mass without a part: user decision 2026-11-26, C.REPULSORLIFT): the example is the user's file less its repulsorlift parts, which a load takes out. Was 77 parts, the file's count. */const lift=p=>p.k==='repulsor'||p.k==='landingGear',lifts=file.parts.filter(lift).length;assert.equal(s.reference,'gr75');assert.equal(s.parts.filter(lift).length,0,'no repulsorlift part is left');const saved=(source.design||source).parts;assert.equal(saved.length,77,'the user\'s file as saved');assert.equal(saved.filter(lift).length,2,'two of them are repulsorlift parts');assert.equal(s.parts.length,saved.length-2,'the example is the file less those two');assert.equal(file.parts.length,s.parts.length,'and a plain load of the file gives the same count');
 assert.equal(JSON.stringify(Array.from(s.parts,shape).sort()),JSON.stringify(Array.from(file.parts,shape).sort()));assert.equal(JSON.stringify(Array.from(s.fits,seat).sort()),JSON.stringify(Array.from(file.fits,seat).sort()));
 assert.equal(s.parts.filter(p=>p.k==='struct').length,54);assert.equal(JSON.stringify(s.hull),JSON.stringify(file.hull));
});
test('one reactor feeds all three engines; the machinery that named the removed reactors is fed by it',()=>{
 const s=C.buildDesign('gr75'),S=C.computeStats(s),reactors=s.parts.filter(p=>p.k==='gen'||p.k==='aux');
 assert.equal(reactors.length,1);const cores=s.parts.filter(p=>p.k==='engineCore');
 assert.ok(cores.some(p=>p.reactor!=null&&!reactors.some(r=>r.id===p.reactor)),'the saved design still names reactors that are gone (it is taken as it is)');
 for(const e of s.parts.filter(p=>p.k==='engine')){assert.equal(S.info[e.id].reactor,reactors[0].id,`engine #${e.id}`);assert.equal(S.info[e.id].vent,true,`engine #${e.id}`);}
 assert.equal(S.engNoSource,0);assert.ok(Math.abs(S.ventEng-S.Veng)<1e-9);
 assert.ok(!S.warnings.some(w=>/噴射口|反応炉に接続されていない/.test(w.text)));
});
test('a consumer whose chosen reactor is gone is fed as one with none chosen; 0 still means none on purpose',()=>{
 const s=C.buildDesign('gr75'),gen=s.parts.find(p=>p.k==='gen'),core=s.parts.find(p=>p.k==='engineCore');
 assert.equal(C.reactorFor(s,{...core,reactor:999999})?.id,gen.id);assert.equal(C.reactorFor(s,{...core,reactor:undefined})?.id,gen.id);assert.equal(C.reactorFor(s,{...core,reactor:gen.id})?.id,gen.id);
 assert.equal(C.reactorFor(s,{...core,reactor:0}),null);
});
test('an engine set to no reactor is reported as that, not as a blocked nozzle',()=>{
 const s=C.buildDesign('gr75');for(const p of s.parts)if(p.k==='engineCore'&&p.id!==s.parts.find(q=>q.k==='engineCore').id)p.reactor=0;
 const S=C.computeStats(s);assert.equal(S.engNoSource,2);
 assert.ok(S.warnings.some(w=>/反応炉に接続されていないエンジンが 2 基/.test(w.text)));assert.ok(!S.warnings.some(w=>/噴射口が塞がった/.test(w.text)));
});
