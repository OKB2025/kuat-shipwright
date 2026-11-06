const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
vm.runInContext(fs.readFileSync(path.join(root,'data/reference.js'),'utf8'),context);
const assets=vm.runInContext('YardReferenceData.assets',context),read=file=>fs.readFileSync(path.join(root,file)),json=file=>JSON.parse(read(file)),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),plain=value=>JSON.parse(JSON.stringify(value));
function stl(file){
 const stored=read(file),bytes=file.endsWith('.gz')?zlib.gunzipSync(stored):stored,count=bytes.readUInt32LE(80);assert.equal(bytes.length,84+count*50,file+' has a complete binary triangle table');
 const triangles=Array.from({length:count},(_,i)=>Array.from({length:3},(_,j)=>Array.from({length:3},(_,k)=>bytes.readFloatLE(84+i*50+12+j*12+k*4))));
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const triangle of triangles)for(const point of triangle)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],point[i]);hi[i]=Math.max(hi[i],point[i]);}return {stored,bytes,triangles,lo,hi};
}
const near=(a,b,tolerance=1e-9)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
const cycle=points=>{const keys=points.map(point=>point.join(','));return [keys.join('|'),[keys[1],keys[2],keys[0]].join('|'),[keys[2],keys[0],keys[1]].join('|')].sort()[0];};
function assertNativeTriangles(asset,source,transform,expectedFaces){
 assert.equal(asset.faces,expectedFaces);const bytes=Buffer.from(asset.data,'base64'),indexSize=asset.indexBytes||2;
 assert.equal(bytes.length,asset.n*10+asset.faces*3*indexSize,'packed geometry contains only its declared positions, UVs and indices');
 const points=Array.from({length:asset.n},(_,i)=>[0,1,2].map(k=>bytes.readInt16LE(i*6+k*2))),sourceTriangles=new Map();
 for(const triangle of source.triangles){const key=cycle(triangle.map(point=>transform(point).map((x,k)=>Math.round((x-asset.c[k])/asset.size[k]*65532))));sourceTriangles.set(key,(sourceTriangles.get(key)||0)+1);}
 for(let i=0;i<asset.faces;i++){
  const triangle=[0,1,2].map(k=>{const offset=asset.n*10+(i*3+k)*indexSize,index=indexSize===2?bytes.readUInt16LE(offset):bytes.readUInt32LE(offset);assert.ok(index<points.length,'native triangle index is in bounds');return points[index];}),key=cycle(triangle),remaining=sourceTriangles.get(key)||0;
  assert.ok(remaining>0,'every packed triangle comes from the measured source in the declared rigid frame and uniform scale');sourceTriangles.set(key,remaining-1);
 }
}
function omitDetachedComponents(source,selections){
 const ids=new Map(),parents=[],index=point=>{const key=point.map(x=>Math.round(x*1e6)).join(',');if(!ids.has(key)){ids.set(key,parents.length);parents.push(parents.length);}return ids.get(key);},find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;},triangles=source.triangles.map(triangle=>triangle.map(index));
 for(const [a,b,c]of triangles){parents[find(b)]=find(a);parents[find(c)]=find(a);}const components=new Map();for(let i=0;i<triangles.length;i++){const id=find(triangles[i][0]);let component=components.get(id);if(!component)components.set(id,component={indices:[],lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity]});component.indices.push(i);for(const point of source.triangles[i])for(let k=0;k<3;k++){component.lo[k]=Math.min(component.lo[k],point[k]);component.hi[k]=Math.max(component.hi[k],point[k]);}}
 const removed=new Set();for(const selection of selections){const matches=[...components.values()].filter(component=>component.lo.every((x,i)=>x>=selection.lo[i]-1e-6)&&component.hi.every((x,i)=>x<=selection.hi[i]+1e-6));assert.equal(matches.reduce((n,component)=>n+component.indices.length,0),selection.faces,'the complete native weapon components are detached');for(const component of matches)for(const index of component.indices){assert.equal(removed.has(index),false);removed.add(index);}}
 return {...source,triangles:source.triangles.filter((_,i)=>!removed.has(i))};
}
function assertClosedCollider(asset){
 assert.ok(Array.isArray(asset.collider)&&asset.collider.length>0&&asset.collider.length%9===0);const edges=new Map(),directed=new Map();let volume=0;
 const increment=(map,key)=>map.set(key,(map.get(key)||0)+1);
 for(let i=0;i<asset.collider.length;i+=9){const a=asset.collider.slice(i,i+3),b=asset.collider.slice(i+3,i+6),c=asset.collider.slice(i+6,i+9),u=b.map((x,k)=>x-a[k]),v=c.map((x,k)=>x-a[k]),cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];assert.ok(Math.hypot(...cross)>1e-12,'collider has no collapsed triangles');
  for(const point of [a,b,c])assert.ok(point.every(x=>Number.isFinite(x)&&Math.abs(x)<=.500001),'physical collider stays within the calibrated source bounds');
  for(const [p,q]of [[a,b],[b,c],[c,a]]){const P=p.join(','),Q=q.join(',');increment(edges,[P,Q].sort().join('|'));increment(directed,P+'|'+Q);}
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 for(const [edge,count]of edges){assert.equal(count,2,'every collision edge has two incident faces');const [a,b]=edge.split('|');assert.equal(directed.get(a+'|'+b),directed.get(b+'|'+a),'collision faces have consistent orientation');}assert.ok(volume>0,'closed physical union has positive signed volume');
}

test('corvette weapon assets retain the supplied STL faces at their measured hull scales',()=>{
 const manifest=json('assets/source/corvette-weapons/manifest.json');
 for(const calibration of Object.values(manifest.scaleCalibration)){near(calibration.lengthM/calibration.sourceLength,calibration.metresPerSourceUnit,1e-14);}
 for(const [key,entry]of Object.entries(manifest.assets)){
  const asset=assets[key];assert.ok(asset,key);const source=stl('assets/source/corvette-weapons/'+entry.sourceFilename);assert.equal(sha(source.bytes),entry.sourceSha256);assert.equal(asset.sourceSha256,entry.sourceSha256);near(asset.sourceScaleMPerUnit,entry.sourceScaleMPerUnit,1e-14);assert.deepEqual(plain(asset.sourceFrame),entry.sourceFrame);
  const {rotationRows:R,mountPointSource:origin}=entry.sourceFrame;for(let i=0;i<3;i++)for(let j=0;j<3;j++)near(R[i].reduce((sum,x,k)=>sum+x*R[j][k],0),i===j?1:0);
  assertNativeTriangles(asset,source,point=>R.map(row=>row.reduce((sum,x,k)=>sum+x*(point[k]-origin[k]),0)*entry.sourceScaleMPerUnit),entry.faces);
 }
});

test('Sphyrna hull keeps native source detail and a closed, bounded physical union',()=>{
 const manifest=json('assets/source/sphyrna-hull-manifest.json'),source=stl(manifest.stored_source),asset=assets[manifest.asset_key];assert.ok(asset);assert.equal(sha(source.bytes),manifest.source_sha256);assert.equal(asset.sourceSha256,manifest.source_sha256);assert.equal(sha(Buffer.from(asset.data,'base64')),manifest.packed_sha256);near((source.hi[1]-source.lo[1])*manifest.uniform_scale,manifest.length_m,1e-9);near(asset.size[0],manifest.length_m,1e-9);
 const hull=omitDetachedComponents(source,manifest.detached_weapons);assertNativeTriangles(asset,hull,point=>[(source.hi[1]-point[1])*manifest.uniform_scale,(point[2]-source.lo[2])*manifest.uniform_scale,-point[0]*manifest.uniform_scale],source.triangles.length-manifest.detached_weapons.reduce((n,weapon)=>n+weapon.faces,0));assertClosedCollider(asset);
});

test('CR90 keeps native hull detail at 150 m after explicit gun and nozzle-cover detachment',()=>{
 const manifest=json('assets/source/cr90/hull-manifest.json'),source=stl(manifest.stored_source),asset=assets[manifest.asset_key];assert.ok(asset,manifest.asset_key);assert.equal(sha(source.stored),manifest.stored_source_sha256);assert.equal(sha(source.bytes),manifest.source_sha256);assert.equal(source.stored.readUInt32LE(4),0,'stored gzip is reproducible');assert.equal(source.triangles.length,manifest.source_triangles);assert.equal(asset.sourceSha256,manifest.source_sha256);assert.equal(sha(Buffer.from(asset.data,'base64')),manifest.packed_sha256);near((source.hi[1]-source.lo[1])*manifest.uniform_scale,150,1e-9);near(asset.size[0],150,1e-9);assert.equal(asset.indexBytes,4,'complete native detail uses 32-bit indices');
 const removed=new Set();for(const weapon of manifest.detached_weapons){assert.equal(weapon.matched_master_face_indices.length,weapon.removed_triangles);for(const index of weapon.matched_master_face_indices){assert.ok(Number.isInteger(index)&&index>=0&&index<source.triangles.length);assert.equal(removed.has(index),false,'detached native gun copies do not overlap');removed.add(index);}}
 const mid=(source.lo[0]+source.hi[0])/2,world=point=>[(source.hi[1]-point[1])*manifest.uniform_scale,(point[2]-source.lo[2])*manifest.uniform_scale,(mid-point[0])*manifest.uniform_scale];assert.equal(removed.size,manifest.detached_weapon_triangles);assert.equal(manifest.engine_mouths.length,11);assert.equal(new Set(manifest.engine_mouths.map(engine=>engine.mouth_m.join(','))).size,11);assert.equal(manifest.detached_nozzle_caps.length,11);
 for(const cap of manifest.detached_nozzle_caps){assert.equal(cap.master_face_indices.length,14);assert.equal(cap.triangles,14);assert.ok(manifest.engine_mouths.some(engine=>engine.mouth_m.every((x,i)=>Math.abs(x-cap.mouth_m[i])<1e-7)),'each removed printed cover belongs to a measured engine mouth');const points=[];for(const index of cap.master_face_indices){assert.ok(Number.isInteger(index)&&index>=0&&index<source.triangles.length);assert.equal(removed.has(index),false,'native nozzle covers and gun copies do not overlap');removed.add(index);points.push(...source.triangles[index].map(world));}const lo=[0,1,2].map(i=>Math.min(...points.map(point=>point[i]))),hi=[0,1,2].map(i=>Math.max(...points.map(point=>point[i])));assert.ok(hi[0]-lo[0]<.001,'only flat printed end covers are removed');assert.ok(lo[0]>=cap.mouth_m[0]&&hi[0]-cap.mouth_m[0]<1);for(const i of [1,2])near((lo[i]+hi[i])/2,cap.mouth_m[i],.001);}
 assert.equal(removed.size,manifest.detached_weapon_triangles+manifest.detached_nozzle_cap_triangles);const hull={...source,triangles:source.triangles.filter((_,i)=>!removed.has(i))};assertNativeTriangles(asset,hull,world,source.triangles.length-removed.size);assertClosedCollider(asset);
});
