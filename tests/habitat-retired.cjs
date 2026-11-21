// User decision 2026-11-21:「居住区は廃止する方針(余積を居住区扱いのみ)では無かったのか」「外面編集は装甲のみになりそれ以外は無くなったのでは？」.
// The habitation compartment ('habitat') came with the equipment faces' habitation share (2026-11-03) and was left in the parts list
// when those faces were retired (2026-11-05). It is retired like the crew quarters (v19): not offered, and a placed one is dropped
// on load with a notice. The old equipment faces' compatibility rooms (surfacePatch) keep the definition.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
test('the habitation compartment is not offered',()=>{
 assert.equal(C.PARTS.habitat.catalogHidden,true);
 assert.match(app,/const partOffered = k => !!C\.PARTS\[k\]&&!C\.PARTS\[k\]\.catalogHidden/,'the parts list leaves out hidden parts');
});
test('a placed habitation compartment is dropped on load with a count for the notice; a face compatibility room is kept',()=>{
 const s=C.newShip({L:300,W:100,H:60},'Habitat ship');C.placePart(s,'habitat',[150,30,0],10,{room:[10,10,10]},false);const before=s.parts.filter(p=>p.k==='habitat').length;assert.ok(before>=1);
 const j=JSON.parse(JSON.stringify(C.serialize(s))),t=C.deserialize(j);
 assert.equal(t.parts.filter(p=>p.k==='habitat').length,0);assert.equal(t.retiredHabitats,before);
 const k=JSON.parse(JSON.stringify(j));k.parts.filter(p=>p.k==='habitat').forEach(p=>{p.surfacePatch=1;});const u=C.deserialize(k);
 assert.equal(u.retiredHabitats,undefined,'a face room is not a placed compartment');
 assert.match(app,/居住設備区画 \$\{n\} 区画を外しました/,'the editor tells the user');
});
