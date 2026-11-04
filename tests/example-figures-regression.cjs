// v13 PERF The design figures of every example ship (mass, volumes, surfaces and armour, the power and heat
// ledger, propulsion, warnings ...) must stay what they were before the computeStats speed-ups: each is
// compared, within floating-point tolerance, with the digest recorded from origin/main 7a63e61 (see
// tests/helpers/figures-digest.cjs; scripts/capture-example-figures.cjs records new ones when a change is
// meant to alter the figures). KS_FIGURES_KEYS=key,key limits the run to some ships.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {figuresDigest,figuresDiff}=require('./helpers/figures-digest.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),recorded=JSON.parse(fs.readFileSync(path.join(__dirname,'helpers','example-figures.json'),'utf8')).ships;
const only=(process.env.KS_FIGURES_KEYS||'').split(',').filter(Boolean),keys=Object.keys(recorded).filter(k=>!only.length||only.includes(k));

test('every buildable example ship has recorded figures',()=>{
 const all=[...['venator','imperial','executor'],...Object.keys(C.SHIP_EXAMPLES)];
 assert.deepEqual(all.filter(k=>!recorded[k]),[]);
});
for(const key of keys)test(`${key}: computeStats figures match the recorded ones`,()=>{
 const s=C.buildDesign(key);C.syncCompartments(s);C.remount(s);C.syncCompartments(s);
 const first=figuresDigest(C.computeStats(s));assert.deepEqual(figuresDiff(recorded[key],first),[],key);
 // A second call (the editor's, after a no-op) is served from the caches and must agree as well.
 assert.deepEqual(figuresDiff(recorded[key],figuresDigest(C.computeStats(s))),[],key+' (repeat)');
});
// After an edit of one structure the figures reuse the union of the structures before it (structuralMaterial) and
// the patches the edit cannot reach (surfacePatches); they must equal those of a fresh ship given the same edit.
for(const [key,which] of [['gozanti','last'],['gozanti','first'],['craft_tie_ln','last']])test(`${key}: figures after moving the ${which} structure equal a fresh computation`,()=>{
 const make=()=>{const s=C.buildDesign(key);C.syncCompartments(s);C.remount(s);C.syncCompartments(s);return s;};
 const edit=s=>{const list=s.parts.filter(p=>p.k==='struct'&&!p.plate).sort((a,b)=>a.id-b.id),p=which==='first'?list[0]:list.at(-1);p.c=[p.c[0]+.75,p.c[1],p.c[2]];C.syncCompartments(s);};
 const a=make();C.computeStats(a);edit(a);const incremental=figuresDigest(C.computeStats(a));
 const b=make();edit(b);assert.deepEqual(figuresDiff(figuresDigest(C.computeStats(b)),incremental,1e-12),[]);
});
