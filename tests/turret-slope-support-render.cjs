const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture(k='pd',ped=0){
 const ship=C.newShip({L:280,W:200,H:180,assembly:true},'Slope support render');ship.parts=[];ship.fits=[];ship.nextId=1;ship.detail=0;ship.armor={hull:0,cit:0};
 const host=C.placePart(ship,'struct',[140,80,0],[200,160,100],{form:'box',pitch:20,roll:15,yaw:30},false),point=C.worldStruct(host,[0,50,0]),placed=C.placeFit(ship,k,point,[0,1,0],ped,false,{mountMode:'top',assetYaw:23});
 assert.ok(placed.fit,placed.err);const f=placed.fit,support=C.turretSupportGeometry(f);assert.ok(support?.triangles.length,k+' has a sloped foundation');assert.ok(support.volume>0);return {ship,f,support};
}
function triangles(g){return Array.from(g.idx.slice(0,g.ni)).flatMap(i=>Array.from(g.pos.slice(i*3,i*3+3)));}
function sameMesh(a,b){for(const [field,n]of [['pos',a.n*3],['nor',a.n*3],['uv',a.n*2],['col',a.n*4],['idx',a.ni]])assert.deepEqual(Array.from(a[field].slice(0,n)),Array.from(b[field].slice(0,n)),field);assert.equal(a.n,b.n);assert.equal(a.ni,b.ni);}

test('authored slope foundations draw the exact physical solid in editor and preview with selectable bounds',()=>{
 for(const k of ['pd','quad500','monCal150Ion']){
  const {ship,f,support}=fixture(k),ranges={},mesh=G.meshFits(ship,null,ranges),preview=G.meshPreview(ship,[],[f]),bounds=C.fitAABB(f);
  assert.deepEqual(triangles(mesh),Array.from(Float32Array.from(support.triangles)),k+' adds exactly the foundation without a duplicate drum');
  sameMesh(mesh,preview.previewFits);assert.deepEqual(plain(ranges[f.id]),[['fits',0,mesh.ni]]);
  for(let i=0;i<mesh.n*3;i++)assert.ok(mesh.pos[i]>=bounds[i%3]-.00005&&mesh.pos[i]<=bounds[i%3+3]+.00005,k+' foundation is enclosed by selection bounds');
  const gun=G.meshReferenceFits(ship);assert.equal(gun.ni,drawAsset(k).faces*3,k+' retains the complete budgeted gun');
 }
});

test('the foundation and optional manual pedestal stay fixed while authored gun groups articulate',()=>{
 for(const k of ['pd','quad500','monCal150Ion'])for(const ped of [0,4]){
  const {ship,f,support}=fixture(k,ped),mesh=G.meshFits(ship),gun=G.meshReferenceFits(ship),trial=G.fleetGeometry(ship,{trial:true}),turret=trial.turrets.find(t=>t.id===f.id);
  assert.ok(turret?.mesh);sameMesh(mesh,trial.meshes.fits.geo);assert.equal(trial.meshes.refFits.geo.ni,0);
  const moving=trial.meshes[turret.mesh].geo,body=turret.bodyMesh&&trial.meshes[turret.bodyMesh].geo;assert.equal(moving.ni+(body?.ni||0),gun.ni,k+' only the authored gun enters articulated groups');
  if(ped)assert.ok(mesh.ni>support.triangles.length/3,k+' preserves the requested additional pedestal');
 }
});

test('exact picking hits a visible vertical foundation face below the gun',()=>{
 const {ship,f,support}=fixture(),T=support.triangles;let ray=null;
 for(let i=0;i<T.length&&!ray;i+=9){
  const points=[0,3,6].map(j=>T.slice(i+j,i+j+3)),normal=C.norm(C.cross(C.sub(points[1],points[0]),C.sub(points[2],points[0]))),center=[0,1,2].map(a=>(points[0][a]+points[1][a]+points[2][a])/3);
  if(Math.abs(normal[1])>.1||center[1]>C.fitOrigin(f)[1]-.05)continue;
  const o=C.add(center,C.mul(normal,1)),d=C.mul(normal,-1),hit=C.rayTris(T,o,d);if(hit&&Math.abs(hit.t-1)<.0001)ray={o,d,hit};
 }
 assert.ok(ray,'an exposed support face exists');const all=[...triangles(G.meshFits(ship)),...triangles(G.meshReferenceFits(ship))],expected=C.rayTris(all,ray.o,ray.d),actual=G.rayFit(ray.o,ray.d,f);
 assert.ok(actual);assert.ok(Math.abs(actual.t-1)<.0001,'the support itself is selectable');assert.deepEqual(plain(actual),plain(expected));assert.deepEqual(plain(G.rayFit(ray.o,ray.d,f)),plain(actual),'the cached picking mesh retains its support');
});
