const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const wing=opt=>({k:'wing',form:'airfoil',c:[0,0,0],s:[2,4,.08],outline:plain(C.AERO_WING_OUTLINE),...opt});
const panel=opt=>({k:'solarPanel',form:'outline',c:[0,0,0],s:[2,4,.08],outline:plain(C.AERO_PANEL_OUTLINE),...opt});
function solid(mesh){assert.ok(mesh.v.every(v=>v.length===3&&v.every(Number.isFinite)));assert.ok(mesh.f.length>=4);assert.equal(C.meshTopology(mesh.f).closed,true);const V=mesh.f.reduce((s,[a,b,c])=>s+C.dot(mesh.v[a],C.cross(mesh.v[b],mesh.v[c])),0)/6;assert.ok(V>0,`outward positive volume ${V}`);}

test('a tapered main wing has a six-corner airfoil section rather than a thin rectangular box',()=>{
 const p=wing(),m=C.aeroWingMesh(p);solid(m);
 for(const z of [-.5,.5]){
  const section=m.v.filter(q=>Math.abs(q[2]-z)<1e-9);assert.equal(section.length,6);
  assert.equal(section.filter(q=>Math.abs(q[1]-.5)<1e-9).length,2);assert.equal(section.filter(q=>Math.abs(q[1]+.5)<1e-9).length,2);assert.equal(section.filter(q=>Math.abs(q[1])<1e-9).length,2);
 }
 const T=C.structTriangles(p);assert.ok(T.length>0);assert.ok(C.partVolume(p)>0);assert.ok(C.inStruct(p,[0,0,0]));assert.equal(C.inStruct(p,[.99,.039,0]),false,'a bevelled leading edge has no box corner');
});

test('concave and swept custom wing outlines remain closed and keep their missing regions',()=>{
 for(const outline of [
  [[-.5,-.5],[.5,-.5],[.5,0],[0,0],[0,.5],[-.5,.5]],
  [[-.5,-.5],[.5,-.5],[.3,0],[.2,.5],[-.3,.5],[-.2,0]]
 ]){const p=wing({outline}),m=C.aeroWingMesh(p);solid(m);near(C.aeroArea(p),Math.abs(C.outlineArea(outline))*8);}
 const p=wing({outline:[[-.5,-.5],[.5,-.5],[.5,0],[0,0],[0,.5],[-.5,.5]]});assert.equal(C.inStruct(p,[.5,0,1]),false);assert.equal(C.inStruct(p,[-.5,0,1]),true);
});

test('the solar collector is a closed six-corner cell sheet with a distinct visible rim and diagonal ribs',()=>{
 const p=panel(),before=JSON.stringify(p),m=C.aeroPanelMesh(p),area=C.aeroArea(p);solid(m);assert.equal(C.AERO_PANEL_OUTLINE.length,6);assert.equal(m.v.length,12);
 const ribs=C.aeroPanelRibs(p);assert.ok(ribs.length>0&&ribs.length%9===0);assert.ok(Array.from(ribs).every(Number.isFinite));assert.ok(Array.from(ribs).filter((v,i)=>i%3===1).some(y=>y>p.s[2]/2));
 const plainBody=C.aeroPanelMesh(p);assert.strictEqual(plainBody,m);near(C.aeroArea(p),area);
 const noFrame=panel({panelFrame:0,panelRib:0});assert.equal(C.aeroPanelRibs(noFrame).length,0);near(C.aeroArea(noFrame),area);
 assert.equal(JSON.stringify(p,(k,v)=>k.startsWith('_')?undefined:v),before,'render caches do not alter public geometry');
});

test('folding a collector preserves cell area and yields a watertight solid at both fold directions and an apex hinge',()=>{
 for(const angle of [-80,-45,0,45,80])for(const knee of [0,.45,.9]){
  const p=panel({panelFold:angle,panelKnee:knee}),m=C.aeroPanelMesh(p);solid(m);near(C.aeroArea(p),6.72);const T=C.structTriangles(p);assert.ok(Array.from(T).every(Number.isFinite));
  if(angle){assert.ok(m.v.some(q=>Math.abs(q[1])>1));assert.ok(C.aeroPanelRibs(p).length>0);}
 }
});

test('useful area scales with chord and span while thickness and frame widths do not create cells',()=>{
 for(const make of [wing,panel]){const p=make(),area=C.aeroArea(p);near(C.aeroArea(make({s:[4,4,.08]})),area*2);near(C.aeroArea(make({s:[4,8,.08]})),area*4);near(C.aeroArea(make({s:[2,4,.8],panelFrame:.3,panelRib:.2})),area);}
});

test('custom panel meshes keep their actual surface and frame geometry without applying a second parametric fold',()=>{
 const original=panel({panelFold:45,panelKnee:.45}),mesh=C.aeroPanelMesh(original),p=panel({form:'mesh',mesh,panelFold:-45});
 assert.strictEqual(C.aeroPanelMesh(p),mesh);solid(mesh);const ribs=C.aeroPanelRibs(p);assert.ok(ribs.length>0);assert.ok(Array.from(ribs).every(Number.isFinite));
 near(C.aeroArea(p),6.72);assert.ok(mesh.cellFaces.length>0,'cell faces are distinct from the sheet perimeter');
 const changed=plain(mesh);for(const v of changed.v)v[0]*=.5;const edited=panel({form:'mesh',mesh:changed});assert.ok(C.aeroArea(edited)<C.aeroArea(p)*.6);assert.notDeepEqual(Array.from(C.aeroPanelRibs(edited)),Array.from(ribs));
});


test('baking a folded panel and saving it preserves exact cell area and editable surface membership',()=>{
 const p=panel({id:1,panelFold:55,panelKnee:.42}),area=C.aeroArea(p),baked=C.aeroBake(p);assert.ok(baked);assert.equal(baked.form,'mesh');assert.ok(baked.mesh.cellFaces.length>0);near(C.aeroArea(baked),area,1e-4);solid(baked.mesh);
 const s=C.newShip({L:8,W:4,H:2,assembly:true});s.parts=[baked];s.nextId=2;const loaded=C.deserialize(C.serialize(s)).parts[0];assert.ok(loaded.mesh.cellFaces.length>0);near(C.aeroArea(loaded),area,1e-4);
 const face=loaded.mesh.f[loaded.mesh.cellFaces[0]],split=C.meshSplitEdge(loaded.mesh,face[0],face[1]);assert.ok(split.cellFaces.length>=loaded.mesh.cellFaces.length);near(C.aeroArea({...loaded,mesh:split}),area,1e-4);solid(split);
});
