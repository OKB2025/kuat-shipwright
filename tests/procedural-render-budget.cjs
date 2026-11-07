const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js']){
 let code=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/gfx.js'){const anchor='return {meshPreview, clearPreviewCache';assert.equal(code.split(anchor).length,2);code=code.replace(anchor,'return {_primitiveBudget:{sphere,cylX,cyl,axisFrustum,domeL,pedestal},meshPreview, clearPreviewCache');}
 vm.runInContext(code,cx,{filename:file});
}
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),P=G._primitiveBudget,identity=[1,0,0,0,1,0,0,0,1],color=[190,200,210],plain=v=>JSON.parse(JSON.stringify(v));
function mesh(build){const g=new G.Geo(16);build(g);return g;}
const xyz=(g,i)=>Array.from(g.pos.subarray(i*3,i*3+3)),normal=(g,i)=>Array.from(g.nor.subarray(i*3,i*3+3),v=>v/127);
const near=(a,b,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b}`);
function inspect(g){
 const used=new Set(g.idx.subarray(0,g.ni));assert.equal(g.ni%3,0);assert.ok(g.ni>0);
 for(const i of used){assert.ok(Number.isInteger(i)&&i>=0&&i<g.n);assert.ok(xyz(g,i).every(Number.isFinite));assert.ok(C.len(normal(g,i))>.97);assert.ok(Array.from(g.uv.subarray(i*2,i*2+2)).every(Number.isFinite));}
 for(let i=0;i<g.ni;i+=3){const indices=Array.from(g.idx.subarray(i,i+3)),p=indices.map(j=>xyz(g,j)),n=C.cross(C.sub(p[1],p[0]),C.sub(p[2],p[0])),shade=indices.reduce((s,j)=>C.add(s,normal(g,j)),[0,0,0]);assert.ok(C.len(n)>1e-9,'no degenerate pole or cone triangles');assert.ok(C.dot(n,shade)>0,'triangle winding agrees with its lighting normal');}
 return used;
}
function bounds(g){const points=[...new Set(g.idx.subarray(0,g.ni))].map(i=>xyz(g,i));return [0,1,2].map(k=>[Math.min(...points.map(p=>p[k])),Math.max(...points.map(p=>p[k]))]);}

test('small and large sphere draw meshes retain exact envelope, smooth normals and UV seam with at least two-thirds fewer triangles',()=>{
 for(const [radius,oldTriangles,budget]of [[4,1600,528],[100,3136,960]]){
  const center=[13,17,23],g=mesh(g=>P.sphere(g,center,radius,color,8,3)),used=inspect(g);assert.equal(g.ni/3,budget);assert.ok(g.ni/3<oldTriangles*.34);assert.ok(g.n<oldTriangles*.7,'indexed vertex budget also decreases');
  for(const i of used){const p=xyz(g,i),n=C.norm(C.sub(p,center));near(C.len(C.sub(p,center)),radius,2e-5);assert.ok(C.dot(n,normal(g,i))>.98);}
  bounds(g).forEach((b,k)=>{near(b[0],center[k]-radius);near(b[1],center[k]+radius);});
  const poles=[...used].filter(i=>Math.abs(xyz(g,i)[1]-center[1])>radius*.999);assert.ok(poles.length>2,'pole UVs remain separated across sectors');
  assert.ok([...used].some(i=>g.uv[i*2]===0));assert.ok([...used].some(i=>g.uv[i*2]===8));
 }
});

test('axis cylinders keep hard caps and exact end planes with lower radial detail',()=>{
 for(const radius of [1,12,70]){
  const g=mesh(g=>P.cylX(g,[10,20,30],radius,40,color,7,2,{front:true,back:true}));inspect(g);assert.ok(g.ni/3<=(radius>40?96:radius>8?64:48));
  const b=bounds(g);near(b[0][0],-10);near(b[0][1],30);near(b[1][0],20-radius);near(b[1][1],20+radius);near(b[2][0],30-radius);near(b[2][1],30+radius);
  for(const sign of [-1,1])assert.ok(Array.from({length:g.n},(_,i)=>i).some(i=>normal(g,i)[0]===sign&&Math.abs(xyz(g,i)[0]-(10+sign*20))<1e-6),'a separate hard cap is retained');
 }
});

test('shared gun-cylinder rings preserve barrel lengths, caps, cone winding and analytical tapered normals',()=>{
 for(const axis of [0,1])for(const [r0,r1]of [[2,2],[3,1],[0,3],[3,0]]){
  const length=14,g=mesh(g=>P.cyl(g,identity,[0,0,0],0,0,0,r0,r1,length,axis,color,12));inspect(g);assert.ok(g.n<=54,'old 120-vertex capped barrels now share side and cap rings');
  const b=bounds(g);near(b[axis][0],-7);near(b[axis][1],7);
  const slope=(r0-r1)/length,expected=C.norm(axis===0?[slope,1,0]:[1,slope,0]);assert.ok(C.dot(normal(g,0),expected)>.98,'conical lighting follows the true radial/axial gradient');
 }
});

test('arbitrary-axis tubes preserve open ends, inward bores and smooth radial normals within their physical envelope',()=>{
 const a=[3,8,12],b=[40,25,60],delta=C.sub(b,a),length=C.len(delta),u=C.mul(delta,1/length),r0=6,r1=3;
 for(const inward of [false,true]){
  const g=mesh(g=>P.axisFrustum(g,a,b,r0,r1,color,false,inward));inspect(g);assert.equal(g.ni/3,24);assert.equal(g.n,26);
  for(let i=0;i<g.n;i++){const q=xyz(g,i),along=C.dot(C.sub(q,a),u),radius=C.len(C.sub(C.sub(q,a),C.mul(u,along)));assert.ok(Math.abs(along)<1e-5||Math.abs(along-length)<1e-5);near(radius,along<length/2?r0:r1,2e-5);const radial=C.sub(C.sub(q,a),C.mul(u,along)),expected=C.norm(C.add(C.norm(radial),C.mul(u,(r0-r1)/length)));assert.ok(C.dot(normal(g,i),expected)*(inward?-1:1)>.98);}
  for(let i=0;i<g.ni;i+=3){const along=Array.from(g.idx.subarray(i,i+3),j=>C.dot(C.sub(xyz(g,j),a),u));assert.ok(Math.max(...along)-Math.min(...along)>length*.99,'an open bore receives no end cap');}
 }
 const capped=mesh(g=>P.axisFrustum(g,a,b,r0,r1,color,true));inspect(capped);assert.equal(capped.ni/3,48);assert.equal(capped.n,54);
 const cone=mesh(g=>P.axisFrustum(g,a,b,r0,0,color,true));inspect(cone);assert.equal(cone.ni/3,24,'a cone tip is closed by real side triangles, without a zero-area fan');
});

test('turret domes keep their lower hard rim and ellipsoid gradient while removing duplicate vertices and pole degenerates',()=>{
 const g=mesh(g=>P.domeL(g,identity,[0,0,0],0,0,0,8,5,color,12,4));inspect(g);assert.equal(g.ni/3,96);assert.ok(g.n<90,'old 205-vertex domes now share their smooth rings');
 const b=bounds(g);near(b[0][0],-8);near(b[0][1],8);near(b[1][0],0);near(b[1][1],5);near(b[2][0],-8);near(b[2][1],8);
 for(let i=0;i<g.n;i++){const q=xyz(g,i),n=normal(g,i);if(n[1]===-1){near(q[1],0);continue;}const gradient=C.norm([q[0]/64,q[1]/25,q[2]/64]);assert.ok(C.dot(n,gradient)>.98);}
});

test('rendering lower-detail equipment preserves serialized design, volume, analytic bounds and selection',()=>{
 const ship=C.newShip({assembly:true,L:200,W:120,H:100},'Draw-only budget'),part={id:1,k:'gen',c:[50,40,20],d:12};ship.parts=[part];ship.fits=[];ship.detail=0;
 const before=plain({save:C.serialize(ship),volume:C.partVolume(part),bounds:C.partAABB(part),hit:C.rayPart([50,40,100],[0,0,-1],part)}),draw=G.meshParts(ship,{coded:false});
 assert.equal(draw.g.gen.ni/3,528);assert.deepEqual(plain({save:C.serialize(ship),volume:C.partVolume(part),bounds:C.partAABB(part),hit:C.rayPart([50,40,100],[0,0,-1],part)}),before);
});
