const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),ctx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',ctx),plain=v=>JSON.parse(JSON.stringify(v));
const pointKey=q=>Array.from(Float32Array.from(q)).map(n=>Math.round(n*1e4)/1e4).join(','),triangleKey=q=>[0,3,6].map(i=>pointKey(q.slice(i,i+3))).sort().join(';');
function triangleKeys(T){const keys=[];for(let i=0;i<T.length;i+=9)keys.push(triangleKey(T.slice(i,i+9)));return keys.sort();}
function meshTriangles(g,start=0,count=g.ni){const T=[];for(let i=start;i<start+count;i++)T.push(...g.pos.slice(g.idx[i]*3,g.idx[i]*3+3));return T;}
function assertContains(g,T,label){const keys=new Set(triangleKeys(meshTriangles(g)));for(const key of triangleKeys(T))assert.ok(keys.has(key),label+': '+key);}
function savedImperial(){
 // This tracked archive predates the current request. Its adjacent manifest
 // records its source hash; it is not reconstructed from the user's image.
 const file='assets/source/imperial-ii-user-layout/imperial-ii-upload.json',s=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));s.detail=0;return s;
}
function nozzleBody(p){return plain({c:p.c,dir:p.dir,d:p.d,nozzleLength:p.nozzleLength,bodyLength:p.bodyLength,skinAsset:p.skinAsset,machineryId:p.machineryId,ratedInputW:p.ratedInputW,skin:Array.from(C.engineSkinMesh(p)?.T||[])});}
function slopedMount(){
 const s=C.newShip({assembly:true,L:100,W:100,H:100}),parent={id:1,k:'struct',form:'box',c:[30,20,0],s:[40,40,40],pitch:15},p={id:2,k:'engine',c:[0,20,0],dir:[-1,0,0],d:8,nozzleLength:8,nozzleAppearance:'generic'};s.parts=[parent,p];s.fits=[];s.hatches=[];s.detail=0;const body=nozzleBody(p);C.buildEngineMountSupport(s,p,parent);assert.deepEqual(nozzleBody(p),body);s._client=true;return {s,p};
}
function assertSupportOnlyRay(p,T){
 const bare={...p,engineMountSupport:undefined};let found=false;
 for(let i=0;i<T.length&&!found;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9)),cross=C.cross(C.sub(b,a),C.sub(c,a));if(C.len(cross)<1e-7)continue;
  const n=C.norm(cross),q=C.mul(C.add(C.add(a,b),c),1/3),o=C.add(q,C.mul(n,.03)),d=C.mul(n,-1),expected=C.rayTris(T,o,d),old=C.rayPart(o,d,bare);if(!expected||old&&old.t<=expected.t+.001)continue;
  const hit=C.rayPart(o,d,p);assert.ok(hit,'a support-only ray selects its owning nozzle');assert.ok(Math.abs(hit.t-expected.t)<.0002,'picking uses the actual closed support skin');found=true;
 }
 assert.equal(found,true,'the foundation contributes a selectable surface outside the unchanged nozzle body');
}

test('saved Imperial auxiliary nozzle foundations use the same real triangles in full, coded, preview, ghost and selection meshes',()=>{
 const s=savedImperial(),parts=[55,56,57].map(id=>s.parts.find(p=>p.id===id)),before=parts.map(nozzleBody);assert.ok(parts.every(p=>p?.k==='engine'));
 C.syncEngineMountSupports(s);assert.deepEqual(parts.map(nozzleBody),before,'adding foundations cannot move, aim, resize or retune the saved bells');s._client=true;
 const full=G.meshParts(s,{coded:false}),coded=G.meshParts(s,{coded:true});
 for(const p of parts){
  const support=C.engineMountSupportGeometry(s,p),T=support?.triangles||support?.tris;assert.ok(T?.length&&support.volume>0,'nozzle '+p.id+' has a real finite foundation');assert.deepEqual(triangleKeys(C.engineMountSupportGeometry(null,plain(p)).triangles),triangleKeys(T),'public saved support reconstructs without a ship search');
  for(const [label,result]of [['normal',full],['coded',coded]]){const spans=(result.ranges[p.id]||[]).filter(([layer])=>layer==='struct');assert.ok(spans.length>0,label+' has an independently indexed structural foundation');const tris=spans.flatMap(([layer,start,count])=>meshTriangles(result.g[layer],start,count));assert.deepEqual(triangleKeys(tris),triangleKeys(T),label+' renders exactly the shared physical support');}
  const preview=G.meshPreview(s,[p],[],{coded:false}),ghost=G.placementGhostMesh(s,{part:p,status:'valid'});assertContains(preview.preview,T,'live preview includes the support');assertContains(ghost,T,'strict ghost includes the support');
  const outline=G.lineSet(),expected=G.lineSet();outline.part(p,[1,2,3,255]);expected.triangles(T,[1,2,3,255]);const lines=expected.out().pos;assert.deepEqual(Array.from(outline.out().pos.slice(0,lines.length)),Array.from(lines),'selection outlines the physical foundation before the original bell');
  assertSupportOnlyRay(p,T);const bounds=G.shipBounds(s);assert.ok(support.bounds.every((n,i)=>i<3?n>=bounds[i]-.001:n<=bounds[i]+.001),'camera framing contains the complete foundation');
 }
});

test('a sloped nozzle foundation has independently indexed structural paint and the real support outline and ghost',()=>{
 const {s,p}=slopedMount(),support=C.engineMountSupportGeometry(null,p),T=support?.triangles;assert.ok(T?.length&&support.volume>0);
 for(const coded of [false,true]){const mesh=G.meshParts(s,{coded}),spans=(mesh.ranges[p.id]||[]).filter(([name])=>name==='struct');assert.ok(spans.length);const triangles=spans.flatMap(([name,start,count])=>meshTriangles(mesh.g[name],start,count));assert.deepEqual(triangleKeys(triangles),triangleKeys(T));if(coded){const [name,start]=spans[0],g=mesh.g[name];assert.deepEqual(Array.from(g.col.slice(g.idx[start]*4,g.idx[start]*4+3)),Array.from(C.PARTS.struct.col),'the support uses structure coding rather than the engine glow material');}}
 assertContains(G.meshPreview(s,[p],[]).preview,T,'live preview includes the support');assertContains(G.placementGhostMesh(s,{part:p,status:'valid'}),T,'strict ghost includes the support');const outline=G.lineSet(),expected=G.lineSet();outline.part(p,[1,2,3,255]);expected.triangles(T,[1,2,3,255]);assert.deepEqual(Array.from(outline.out().pos.slice(0,expected.out().pos.length)),Array.from(expected.out().pos));assertSupportOnlyRay(p,T);
});

test('foundation rendering restores public support without generating or changing the parent geometry on the client',()=>{
 const {s,p}=slopedMount(),T=C.engineMountSupportGeometry(s,p).triangles,before=C.publicJSON(s),sync=C.syncEngineMountSupports;
 C.syncEngineMountSupports=()=>{throw new Error('drawing must not regenerate a foundation');};
 try{const ghost=G.placementGhostMesh(s,{part:plain(p),status:'pending'}),outline=G.lineSet();outline.part(plain(p),[1,2,3,255]);assertContains(ghost,T,'the Worker-returned support is sufficient for the ghost');assert.ok(outline.out().pos.length>T.length*2);assert.equal(C.publicJSON(s),before,'rendering cannot commit or mutate placement fields');}finally{C.syncEngineMountSupports=sync;}
});
