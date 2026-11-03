const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(form='wedge',rotated=false){
 const s=C.newShip({L:300,W:180,H:160,assembly:true},'Recess backing regression');s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.detail=0;
 const p=C.placePart(s,'struct',[120,80,0],[160,80,60],{form,skin:'plain',...(rotated?{yaw:29,pitch:17,roll:23}:{})},false),n=form==='wedge'?C.norm(C.sub(C.worldStruct(p,[60,160,0]),p.c)):[0,0,-1],patch=C.surfacePatches(s).find(q=>q.host==='p'+p.id&&C.dot(q.normal,n)>.999);
 assert.ok(patch?.exposed);assert.equal(C.setSurfaceConfig(s,patch.id,{functionMode:'equipment',allocation:{cooling:33,sensors:33,habitation:34},equipment:{depth:1},battery:{count:0},style:{depth:4,density:.25,seed:1}}).ok,true);
 return {s,p,n,id:patch.id,row:G.surfaceVisualPlan(s).find(q=>q.id===patch.id)};
}
function sharedDiagonal(T){const edges=new Map();for(let i=0;i<T.length;i+=9){const p=[0,3,6].map(j=>T.slice(i+j,i+j+3));for(let j=0;j<3;j++){const a=p[j],b=p[(j+1)%3],key=[a.join(','),b.join(',')].sort().join('|'),e=edges.get(key);if(e)e.count++;else edges.set(key,{a,b,count:1});}}const e=[...edges.values()].filter(e=>e.count===2).sort((a,b)=>C.len(C.sub(b.b,b.a))-C.len(C.sub(a.b,a.a)))[0];assert.ok(e);return e;}

test('shared-edge refinement gives the real wedge diagonal its supported recess and continuous horizontal floors',()=>{
 for(const rotated of [false,true]){
  const {s,p,n,id,row}=fixture('wedge',rotated),saved=C.publicJSON(s),e=sharedDiagonal(row.triangles),d=C.sub(e.b,e.a),side=C.norm(C.cross(n,d));
  for(const t of [.25,.5,.75])for(const offset of [-.01,0,.01]){const q=C.add(C.add(e.a,C.mul(d,t)),C.mul(side,offset)),actual=C.surfaceInwardDepth(s,row.patch,q);assert.ok(actual>15,'the requested 4 m recess must genuinely fit here');const hit=C.rayTris(row.backingTriangles,C.add(q,n),C.mul(n,-1));assert.ok(hit);assert.ok(Math.abs(hit.t-1-4)<.005,'actual backing retains a false zero-depth ridge along the original diagonal');}
  assert.ok(row.backingTriangles.length>row.triangles.length&&row.backingTriangles.length<=row.triangles.length+192*27,'three conforming passes must respect the four-way split budget');
  const interior=C.worldStruct(p,[-p.s[0]/4,0,0]);for(let i=0;i<row.backingTriangles.length;i+=3){const q=row.backingTriangles.slice(i,i+3);assert.ok(C.inPart(p,q)||C.inPart(p,C.add(q,C.mul(C.norm(C.sub(interior,q)),.0005))),'recess backing escaped its wedge');}
  const floors=row.field.filter(q=>q.feature==='stratum-floor'),crossing=floors.filter(q=>{const extent=(Math.abs(C.dot(q.u,side))*q.size[0]+Math.abs(C.dot(q.v,side))*q.size[1]+Math.abs(C.dot(q.normal,side))*q.size[2])/2;return Math.abs(C.dot(C.sub(q.center,e.a),side))<extent-.05;});
  assert.ok(crossing.length>0,'the original triangulation diagonal still suppresses continuous floor geometry');
  const high=G.surfaceVisualPlan(s,{detail:2}).find(q=>q.id===id);assert.deepEqual(plain(high.backingTriangles),plain(row.backingTriangles));assert.deepEqual(plain(high.field),plain(row.field));assert.equal(C.publicJSON(s),saved);
 }
});

test('ordinary full-depth equipment walls retain their original backing tessellation',()=>{
 const {n,row}=fixture('box');assert.equal(row.backingTriangles.length,row.triangles.length);
 for(let i=0;i<row.triangles.length;i+=3){const a=row.triangles.slice(i,i+3),b=row.backingTriangles.slice(i,i+3);assert.ok(Math.abs(C.dot(C.sub(a,b),n)-4)<1e-6);}
});
