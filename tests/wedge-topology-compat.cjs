const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x));
function authored(q){const p=plain(q);if(p.aggregate)delete p.aggregate.signature;return p;}
function oldToken(ship,p){let h=2166136261;const s=JSON.stringify([p.k,p.form,null,null,ship.cuts||[],ship.trenches||[],ship.subs||[],ship.solidCuts||[],null]);for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(36);}
test('corrected wedge faces never silently inherit a saved mixed inward-roof/underside identity',()=>{
 const ship=C.newShip({L:240,W:160,H:120,assembly:true},'Wedge identity migration');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};const host=C.placePart(ship,'struct',[120,60,0],[160,80,60],{form:'wedge'},false),patches=C.surfacePatches(ship),bottom=patches.find(p=>p.host==='p'+host.id&&p.face==='bottom');assert.ok(bottom?.exposed);
 const oldId='p'+host.id+':bottom:0:'+oldToken(ship,host);assert.notEqual(bottom.id,oldId,'outward orientation changes the semantic grouping and needs an identity revision');assert.equal(C.setSurfaceConfig(ship,bottom.id,{functionMode:'armor',armor:{material:'dense',thickness:.25}}).ok,true);const q=ship.surfaces.patches.find(q=>q.id===bottom.id);q.id=oldId;const before=authored(q),report=C.surfaceReport(ship);
 assert.equal(report.totals.orphans,1);assert.ok(report.warnings.some(w=>w.code==='surface-orphan'&&w.patch===oldId));assert.equal(C.surfaceConfig(ship,bottom.id).authored,false);assert.equal(C.surfaceConfig(ship,bottom.id).armor.thickness,0,'old mixed-face settings must not move onto the corrected underside');assert.deepEqual(authored(ship.surfaces.patches.find(q=>q.id===oldId)),before,'unresolved saved settings are retained for explicit relocation');
 const loaded=C.deserialize(C.serialize(ship));assert.equal(C.surfaceReport(loaded).totals.orphans,1);assert.deepEqual(authored(loaded.surfaces.patches.find(q=>q.id===oldId)),before);
});
