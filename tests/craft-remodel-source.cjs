// The craft examples are the user's designs as sent (reference-fidelity review 2026-11-27): data/imperial2.js CRAFT_REMODEL holds each file
// named in CRAFT_REMODEL_SOURCE (docs/handoff-2026-11-20/refs/) unchanged; the changes made on the way to the example are craftRemodelDesign's
// own (the X-wing's twelve nozzle structures, the TIE Avenger's gun rates) and are tested in tests/track-nozzle.cjs.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8'),m=src.match(/const CRAFT_REMODEL_SOURCE=Object\.freeze\((\{[\s\S]*?\})\)/);
const SOURCE=Function('return '+m[1].replace(/\/\*[\s\S]*?\*\//g,''))(),REMODEL=JSON.parse(JSON.stringify(vm.runInContext('YardImperial2Data.craftRemodel||(typeof CRAFT_REMODEL!=="undefined"?CRAFT_REMODEL:null)',cx)));
test('every craft example source file is held unchanged',()=>{
 assert.ok(REMODEL,'CRAFT_REMODEL is reachable');assert.equal(Object.keys(SOURCE).length,18);
 for(const [id,file] of Object.entries(SOURCE)){const want=JSON.parse(fs.readFileSync(path.join(root,'docs/handoff-2026-11-20/refs',file),'utf8'));assert.ok(REMODEL[id],id+' is held');assert.deepEqual(REMODEL[id],want,id+' = '+file);}
});
