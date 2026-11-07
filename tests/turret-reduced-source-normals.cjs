const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx);

for(const kind of ['triple70','quad70Side'])test(`${kind} reduced source cladding retains nondegenerate triangles and nonzero production normals after quantization`,()=>{
 const a=C.REFERENCE_ASSETS[C.FITS[kind].asset],d=C.decodeReference(C.FITS[kind].asset),parts=a.components.filter(row=>row.simplification?.method==='source-endpoint-quadric-planar-collapse');
 assert.ok(parts.length,'the reduced source body must be identified');
 for(const row of parts){
  const used=new Set();
  for(let j=row.firstIndex;j<row.firstIndex+row.indices;j+=3){
   const ids=Array.from(d.idx.subarray(j,j+3)),P=ids.map(i=>[0,1,2].map(k=>Math.fround(d.pos[i*3+k]*a.size[k]+a.c[k]-a.mount[k])));
   assert.ok(C.len(C.cross(C.sub(P[1],P[0]),C.sub(P[2],P[0])))>1e-12,`${kind}: quantized face ${j/3} supplies a real surface normal`);
   ids.forEach(i=>used.add(i));
  }
  assert.equal(used.size,row.vertices,'reduced components contain no orphaned source vertices');
 }
 const poses=kind==='quad70Side'?[{a:4},{a:5,p:[330,20,0]}]:[{a:2},{a:2,p:[330,20,0],assetYaw:27},{a:2,tilt:C.norm([.2,.93,.3])}];
 for(const pose of poses){
  const fit={id:1,k:kind,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,...pose},g=G.meshReferenceFits({fits:[fit]});
  const drawn=drawAsset(kind);assert.equal(g.n,drawn.n);
  for(const sourceRow of parts){const row=drawn.components.find(r=>r.label===sourceRow.label);assert.ok(row,sourceRow.label+' retains draw metadata');for(let i=row.firstVertex;i<row.firstVertex+row.vertices;i++){
   const n=Array.from(g.nor.subarray(i*3,i*3+3));assert.ok(n.every(Number.isFinite));
   assert.ok(Math.hypot(...n)>0,`${kind}: referenced source vertex ${i} has a nonzero packed production normal`);
  }}
 }
});
