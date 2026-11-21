// User decisions 2026-11-21 (「なんでそもそも分断されてると拒否される？」 → option 1, 「このようなことが起こらないように判定基準は合わせて」):
// a clipped room that is really in pieces is still refused, but one solid is not split by how its surface is divided
// (a mirrored hull's centreline seam split a Victory's hangar into 9 'pieces'). Pieces join where they share a corner point
// or where a corner of one lies on a face of the other; pieces with a gap between them stay apart.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console:{log(){},warn(){},error:console.error}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx);
function cube([x0,y0,z0],[x1,y1,z1]){const v=(i)=>[i&1?x1:x0,i&2?y1:y0,i&4?z1:z0],faces=[[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]],out=[];for(const [a,b,c,d] of faces)out.push(...v(a),...v(b),...v(c),...v(a),...v(c),...v(d));return out;}
test('one closed box is one solid; two boxes with a 5 cm gap are two',()=>{
 assert.equal(C.interiorConnectedSolid(Float64Array.from(cube([0,0,0],[1,1,1]))),true);
 assert.equal(C.interiorConnectedSolid(Float64Array.from([...cube([0,0,0],[1,1,1]),...cube([1.05,0,0],[2,1,1])])),false);
});
test('a box resting on the middle of another box face is joined there (its corners lie on that face)',()=>{
 assert.equal(C.interiorConnectedSolid(Float64Array.from([...cube([0,0,0],[1,1,1]),...cube([1,.2,.3],[2,.6,.9])])),true);
});
test('a refused interior placement is an error with its reason, not a warning',()=>{
 const src=fs.readFileSync(path.join(root,'js/core.js'),'utf8');assert.match(src,/if\(p\._interiorPlacementError\)S\.warnings\.push\(\{lv:'bad'/);
});
