const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);
const wing=opt=>({k:'wing',form:'airfoil',c:[0,0,0],s:[2,4,.08],outline:plain(C.AERO_WING_OUTLINE),...opt});
const panel=opt=>({k:'solarPanel',form:'outline',c:[0,0,0],s:[2,4,.08],outline:plain(C.AERO_PANEL_OUTLINE),...opt});
function solid(mesh){assert.ok(mesh.v.every(v=>v.length===3&&v.every(Number.isFinite)));assert.ok(mesh.f.length>=4);assert.equal(C.meshTopology(mesh.f).closed,true);const V=mesh.f.reduce((s,[a,b,c])=>s+C.dot(mesh.v[a],C.cross(mesh.v[b],mesh.v[c])),0)/6;assert.ok(V>0,`outward positive volume ${V}`);}

test('the six-corner chord section is thick near the forward leading edge and tapers to the trailing edge',()=>{
 const p=wing(),m=C.aeroWingMesh(p);solid(m);
 const expected=[[0,0],[.22,.5],[.62,.3],[1,0],[.62,-.3],[.22,-.5]];
 for(const z of [-.5,.5]){
  const section=m.v.filter(q=>Math.abs(q[2]-z)<1e-9);assert.equal(section.length,6);
  const leading=Math.max(...section.map(q=>q[0])),trailing=Math.min(...section.map(q=>q[0])),chord=leading-trailing;
  for(const [u,y] of expected)assert.ok(section.some(q=>Math.abs((leading-q[0])/chord-u)<1e-9&&Math.abs(q[1]-y)<1e-9),`section at span ${z} contains chord/height (${u},${y})`);
  const thickest=section.filter(q=>Math.abs(q[1])>.499999);assert.equal(thickest.length,2);
  for(const q of thickest){near((leading-q[0])/chord,.22);assert.ok(q[0]>(leading+trailing)/2,'maximum thickness is on the forward half of the chord');}
  assert.equal(section.filter(q=>Math.abs(q[1])<1e-9).length,2,'leading and trailing edges meet at the chord line');
 }
 const T=C.structTriangles(p);assert.ok(T.length>0);assert.ok(C.partVolume(p)>0);assert.ok(C.inStruct(p,[0,0,0]));
 assert.ok(C.inStruct(p,[.448,.039,0]),'the thick forward shoulder is part of the wing');
 assert.equal(C.inStruct(p,[.78,.035,0]),false,'the leading edge does not have a flat slab corner');
 assert.equal(C.inStruct(p,[-.72,.025,0]),false,'the long aft taper is thinner than the forward shoulder');
 for(const [x,z] of p.outline)assert.ok(m.v.some(q=>Math.abs(q[0]-x)<1e-9&&Math.abs(q[1])<1e-9&&Math.abs(q[2]-z)<1e-9),'the four-corner planform is independent of the six-corner section');
 near(C.aeroArea(p),Math.abs(C.outlineArea(p.outline))*p.s[0]*p.s[1]);
});

test('the forward-heavy chord section follows part rotation and port-starboard mirroring',()=>{
 const s=C.newShip({L:12,W:8,H:4,assembly:true}),p=wing({id:1,c:[3.125,2.375,4.625],yaw:31,pitch:13,roll:-17});s.parts=[p];s.nextId=2;
 const has=(T,q)=>{for(let i=0;i<T.length;i+=3)if(Math.hypot(T[i]-q[0],T[i+1]-q[1],T[i+2]-q[2])<1e-6)return true;return false;};
 const T=C.structTriangles(p),points=[[1,0,-2],[.56,.04,-2],[-1,0,-2]].map(q=>C.worldStruct(p,q));
 for(const q of points)assert.ok(has(T,q),'rotated leading edge, maximum thickness and trailing edge remain in the actual mesh');
 const mirrored=C.mirrorPart(p,s),M=C.structTriangles(mirrored);solid(C.aeroWingMesh(mirrored));
 for(const q of points)assert.ok(has(M,C.mirrorP(q)),'mirroring preserves the chord direction and reflects the same section');
 near(C.aeroArea(mirrored),C.aeroArea(p));
});

test('an explicitly edited wing mesh survives loading without being replaced by the new parametric section',()=>{
 const mesh=C.structToMesh({k:'struct',form:'box',c:[0,0,0],s:[2,4,.08]}),p=wing({id:1,form:'mesh',mesh}),before=plain(mesh);
 assert.strictEqual(C.aeroWingMesh(p),mesh);
 const s=C.newShip({L:12,W:8,H:4,assembly:true});s.parts=[p];s.nextId=2;
 const restored=C.deserialize(C.serialize(s)).parts[0];assert.equal(restored.k,'wing');assert.equal(restored.form,'mesh');
 assert.deepEqual(plain(restored.mesh),before);assert.equal(restored.mesh.v.filter(q=>q.every(v=>Math.abs(Math.abs(v)-.5)<1e-9)).length,8,'an explicit box-shaped user mesh retains its eight corners');
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
