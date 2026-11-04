const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v));
const near=(a,b,eps=5e-4)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`),vector=(a,b,eps)=>a.forEach((v,i)=>near(v,b[i],eps));
function data(){const spec=C.FITS.twin40;assert.ok(spec,'the raised 40 TT twin is an independent reusable fitting');const asset=C.REFERENCE_ASSETS[spec.asset];assert.ok(asset);return {spec,asset,mesh:C.decodeReference(spec.asset)};}
function point(a,mesh,i){return [0,1,2].map(k=>mesh.pos[i*3+k]*a.size[k]+a.c[k]);}
function bounds(a,mesh,first,count){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=first;i<first+count;i++)point(a,mesh,i).forEach((v,k)=>{assert.ok(Number.isFinite(v));b[k]=Math.min(b[k],v);b[k+3]=Math.max(b[k+3],v);});return b;}
function components(mesh,first,count,indexFirst,indexCount){
 const last=first+count,parent=Array.from({length:last},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>parent[find(a)]=find(b),coincident=new Map();
 for(let i=first;i<last;i++){const key=Array.from(mesh.pos.subarray(i*3,i*3+3)).join(',');if(coincident.has(key))join(i,coincident.get(key));else coincident.set(key,i);}
 for(let i=indexFirst;i<indexFirst+indexCount;i+=3){const t=Array.from(mesh.idx.subarray(i,i+3));assert.ok(t.every(j=>j>=first&&j<last),'each declared physical range contains its complete triangles');join(t[0],t[1]);join(t[0],t[2]);}
 return new Set(Array.from({length:count},(_,i)=>find(first+i))).size;
}
function triangles(a,mesh,row){const out=new Float32Array(row.indices*3);for(let i=0;i<row.indices;i++)point(a,mesh,mesh.idx[row.firstIndex+i]).forEach((v,k)=>out[i*3+k]=v);return out;}
const fitting=(extra={})=>({id:1,k:'twin40',p:[31,-7,19],a:2,ped:0,base:0,low:0,float:false,...extra});

test('the raised DBY-based twin has two 40 TT barrels and its own photographed native size',()=>{
 const {spec:d,asset:a,mesh}=data();assert.equal(d.asset,'dby_twin40_raised');assert.equal(d.barrels,2);assert.equal(d.boltTT,40);assert.equal(d.tt,80);near(d.power*d.cycle/C.TT,80,1e-10);assert.ok(C.fitCanRotate(fitting()));
 assert.equal(a.derivedFrom,'ven_turret');assert.equal(a.plainMetal,true);assert.equal(a.barrels,2);vector(a.mount,[0,0,0],1e-12);vector(a.forward,[1,0,0],1e-12);vector(a.up,[0,1,0],1e-12);
 let source=C.REFERENCE_ASSETS.ven_turret;while(source.dataFrom)source=C.REFERENCE_ASSETS[source.dataFrom];assert.equal(crypto.createHash('sha256').update(Buffer.from(source.data,'base64')).digest('hex'),a.sourcePackedSha256,'the existing DBY reference asset remains unchanged');
 const b=bounds(a,mesh,0,a.n);vector([b[3]-b[0],b[4]-b[1],b[5]-b[2]],a.size);near(b[1],0);vector([d.fm,d.hm,d.wm],a.size);near(d.fm,28.861991732993026);near(d.fm/C.FITS.quad500.fm,28.861991732993026/17.8304,1e-6);near(C.weaponModelScale('twin40'),1,1e-12);
 assert.equal(C.FITS.refVen.tt,140,'the existing DBY-827 output stays independent');assert.equal(C.FITS.refSide.tt,80,'the existing side turret remains available with its own output');
});

test('two real barrel meshes sit above the physical side-drive trunnion axis',()=>{
 const {asset:a,mesh}=data();assert.equal(a.barrelCenters.length,2);assert.equal(a.drivePivots.length,2);vector(a.elevationAxis,[0,0,1],1e-12);vector(a.barrelAxis,[1,0,0],1e-12);
 const centers=[];
 for(const drive of a.drivePivots){assert.ok(drive.firstVertex+drive.vertices<=a.elevationVertexStart,'the physical drive cylinders stay in the static housing');const b=bounds(a,mesh,drive.firstVertex,drive.vertices),center=[0,1,2].map(i=>(b[i]+b[i+3])/2);vector(center,drive.centerM,.001);vector(b.slice(0,3),drive.boundsM[0],.001);vector(b.slice(3),drive.boundsM[1],.001);near((b[3]-b[0])/2,drive.radiusM,.02);near((b[4]-b[1])/2,drive.radiusM,.02);assert.ok(b[5]-b[2]>3,'the pivot belongs to a physical cylinder with axial depth');centers.push(center);}
 const actualPivot=[0,1,2].map(i=>(centers[0][i]+centers[1][i])/2);assert.ok(C.len(C.cross(C.sub(a.elevationPivot,actualPivot),a.elevationAxis))<.001,'the elevation axis passes through the actual physical drive centers');
 const rows=[];
 for(const row of a.barrelCenters){assert.equal(components(mesh,row.firstVertex,row.vertices,row.firstIndex,row.indices),1,'each advertised barrel is one complete connected physical mesh');const b=bounds(a,mesh,row.firstVertex,row.vertices);assert.ok(b[3]-b[0]>10,'the barrels have their full forward length');assert.ok(row.muzzle[1]>actualPivot[1]+3,'the actual bore is raised above the physical drive pivot');assert.ok(row.root[1]>actualPivot[1]+3,'the full bore, rather than just the muzzle, is raised');rows.push(b);}
 near(a.barrelCenters[0].muzzle[1],a.barrelCenters[1].muzzle[1],1e-9);near(a.barrelCenters[0].muzzle[2],-a.barrelCenters[1].muzzle[2],1e-9);assert.ok(rows[0][5]<rows[1][2],'the left and right physical barrels are separate');
 for(let i=0;i<a.elevationIndexStart;i++)assert.ok(mesh.idx[i]<a.elevationVertexStart,'static housing triangles do not include elevating barrels');for(let i=a.elevationIndexStart;i<mesh.idx.length;i++)assert.ok(mesh.idx[i]>=a.elevationVertexStart,'the moving cradle and full barrels form an independent elevation range');
});

test('both raised bores have exact hollow muzzle geometry rather than front caps',()=>{
 const {asset:a,mesh}=data();
 for(const row of a.barrelCenters){const T=triangles(a,mesh,row),[x,y,z]=row.muzzle,center=C.rayTris(T,[x+1,y,z],[-1,0,0]),rim=C.rayTris(T,[x+1,y+(row.boreRadiusM+row.outerRadiusM)/2,z],[-1,0,0]);assert.ok(center&&rim);near(rim.p[0],x,.002);near(center.p[0],x-row.muzzleRecessM,.002);assert.ok(center.t>rim.t+1,'the visible opening extends into the actual full barrel');
  const ring=Array.from({length:row.vertices},(_,i)=>point(a,mesh,row.firstVertex+i)).filter(p=>Math.abs(p[0]-x)<.002),angles=new Set(ring.filter(p=>Math.abs(Math.hypot(p[1]-y,p[2]-z)-row.outerRadiusM)<.002).map(p=>Math.atan2(p[2]-z,p[1]-y).toFixed(3)));assert.ok(angles.size>=12,'the barrel ends in an actual circular muzzle lip');
 }
});

test('every mount frame uses the same raised twin mesh for drawing, selection and muzzle picking',()=>{
 const {asset:a}=data(),frames=[...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.93,.3])}];
 for(const frame of frames){const f=fitting({assetYaw:31.25,...frame}),origin=a.mount.map((v,i)=>(v-a.c[i])/a.size[i]);vector(C.referenceFitPoint(f,origin),C.fitOrigin(f),1e-6);const geo=G.meshFits({fits:[f]}),b=C.fitAABB(f);assert.equal(geo.ni,a.faces*3);
  for(let i=0;i<geo.ni;i++){const j=geo.idx[i]*3;for(let axis=0;axis<3;axis++)assert.ok(geo.pos[j+axis]>=b[axis]-.001&&geo.pos[j+axis]<=b[axis+3]+.001,'all mounted draw vertices fit the physical selection bounds');}
  const m=a.barrelCenters[0],world=p=>C.referenceFitPoint(f,p.map((v,i)=>(v-a.c[i])/a.size[i])),start=world(C.add(m.muzzle,[1,0,0])),expected=world(C.sub(m.muzzle,[m.muzzleRecessM,0,0])),hit=G.rayFit(start,C.norm(C.sub(expected,start)),f);assert.ok(hit);vector(hit.p,expected,.003);
 }
});

test('ordinary placement, save reload, editor preview and fleet rendering preserve the raised twin',()=>{
 const {asset:a}=data(),s=C.newShip({L:120,W:120,H:50,assembly:true},'Raised heavy twin mounting');s.parts=[];
 C.placePart(s,'struct',[60,10,0],[110,100,20],{form:'chamfer',corner:.05,skin:'armor'},false);
 const result=C.placeFit(s,'twin40',[60,20,0],[0,1,0],0,false);assert.ok(result.fit,result.err);assert.equal(result.fit.float,false);result.fit.assetYaw=27.5;
 const loaded=C.deserialize(C.serialize(s)),f=loaded.fits.find(f=>f.k==='twin40');assert.ok(f);assert.equal(loaded.fits.length,1);assert.ok(!f.float);assert.equal(C.fitSpec(f).tt,80);near(f.assetYaw,27.5,1e-12);const roof=C.rayEnv(loaded,[60,100,0],[0,-1,0],{structOnly:true});assert.ok(roof);near(C.dot(C.sub(f.p,roof.p),C.fitUp(f)),0,.001);
 const editor=G.meshFits(loaded),preview=G.meshPreview(loaded,[],[f]);assert.ok(editor.ni>=a.faces*3);assert.equal(preview.previewFits.ni+preview.previewRefFits.ni,a.faces*3);
 const fleet=G.fleetGeometry(loaded,{trial:true}),turret=fleet.turrets.find(t=>t.id===f.id),joint=C.authoredTurretGeometry(f);assert.ok(turret&&joint);assert.equal(turret.k,'twin40');assert.equal(turret.barrels,2);assert.equal(fleet.meshes[turret.bodyMesh].geo.ni,a.elevationIndexStart);assert.equal(fleet.meshes[turret.mesh].geo.ni,a.faces*3-a.elevationIndexStart);vector(turret.bodyPivot,C.fitOrigin(f),1e-6);vector(turret.pivot,joint.elevationPivot,1e-6);
 assert.equal(Object.hasOwn(f,'scale'),false,'the canonical photo size needs no saved manual scale');assert.deepEqual(plain(C.serialize(C.deserialize(C.serialize(loaded))).fits),plain(C.serialize(loaded).fits));
});
