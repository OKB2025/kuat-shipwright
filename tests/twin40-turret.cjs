const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v)),near=(a,b,e=.003)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const fitting=(k='twin40',extra={})=>({id:1,k,p:[31,-7,19],a:2,ped:0,base:0,low:0,float:false,...extra});
function data(k='twin40'){const d=C.FITS[k];assert.ok(d);const a=C.REFERENCE_ASSETS[d.asset];assert.ok(a);return {d,a,m:C.decodeReference(d.asset)};}
const point=(a,m,i)=>[0,1,2].map(k=>m.pos[i*3+k]*a.size[k]+a.c[k]);
function bounds(a,m,first,count){const b=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(let i=first;i<first+count;i++)point(a,m,i).forEach((v,k)=>{b[k]=Math.min(b[k],v);b[k+3]=Math.max(b[k+3],v);});return b;}
function featureRows(a,name){const labels=a.photoGeometryFeaturesM?.[name]?.componentLabels;assert.ok(labels?.length,`actual ${name} components must be identified`);return labels.flatMap(label=>{const rows=a.components.filter(row=>row.label===label);assert.ok(rows.length,`${name}: ${label}`);return rows;});}
function surfaceTriangles(a,m,row){const out=[];for(let i=row.firstIndex;i<row.firstIndex+row.indices;i+=3)out.push(Array.from(m.idx.subarray(i,i+3),j=>point(a,m,j)));return out;}
function pointOnTriangle(p,[a,b,c],eps){
 const u=C.sub(b,a),v=C.sub(c,a),n=C.cross(u,v),nn=C.dot(n,n);if(nn<1e-16)return false;
 const w=C.sub(p,a);if(Math.abs(C.dot(w,n))/Math.sqrt(nn)>eps)return false;
 const uu=C.dot(u,u),uv=C.dot(u,v),vv=C.dot(v,v),wu=C.dot(w,u),wv=C.dot(w,v),den=uv*uv-uu*vv;if(Math.abs(den)<1e-16)return false;
 const s=(uv*wv-vv*wu)/den,t=(uv*wu-uu*wv)/den,tolerance=eps/Math.max(.01,Math.sqrt(Math.max(uu,vv)));
 return s>=-tolerance&&t>=-tolerance&&s+t<=1+tolerance;
}
function segmentCrossesTriangle(a,b,[p,q,r],eps){
 const direction=C.sub(b,a),u=C.sub(q,p),v=C.sub(r,p),h=C.cross(direction,v),det=C.dot(u,h);if(Math.abs(det)<1e-12)return false;
 const s=C.sub(a,p),inv=1/det,x=C.dot(s,h)*inv;if(x<0||x>1)return false;
 const cross=C.cross(s,u),y=C.dot(direction,cross)*inv;if(y<0||x+y>1)return false;
 const t=C.dot(v,cross)*inv,tolerance=eps/Math.max(.01,C.len(direction));return t>=-tolerance&&t<=1+tolerance;
}
function surfacesTouch(a,m,left,right,eps=.01){
 const A=bounds(a,m,left.firstVertex,left.vertices),B=bounds(a,m,right.firstVertex,right.vertices);if([0,1,2].some(k=>A[k]>B[k+3]+eps||B[k]>A[k+3]+eps))return false;
 const trianglesA=surfaceTriangles(a,m,left),trianglesB=surfaceTriangles(a,m,right);
 for(const x of trianglesA)for(const y of trianglesB){
  if(x.some(p=>pointOnTriangle(p,y,eps))||y.some(p=>pointOnTriangle(p,x,eps)))return true;
  for(let i=0;i<3;i++)if(segmentCrossesTriangle(x[i],x[(i+1)%3],y,eps)||segmentCrossesTriangle(y[i],y[(i+1)%3],x,eps))return true;
 }
 return false;
}

test('the two photographed 40 TT twins have distinct houses while DBY-827 remains a 70 TT twin',()=>{
 const box=data(),dome=data('twin40Dome');assert.equal(box.d.asset,'family_twin40_box');assert.equal(dome.d.asset,'family_twin40_dome');
 for(const {d,a}of [box,dome]){assert.equal(d.barrels,2);assert.equal(d.boltTT,40);assert.equal(d.tt,80);near(d.power*d.cycle/C.TT,80,1e-9);near(C.weaponModelScale(d.key),1,1e-12);assert.equal(a.noSupportPedestal,true);}
 for(const {d,a}of [box,dome])for(const [i,key]of ['fm','hm','wm'].entries())near(a.size[i],d[key],.001);assert.notEqual(dome.a.turretCompartment.volumeM3,box.a.turretCompartment.volumeM3,'different closed houses at the same salvo energy retain their own physical room');
 assert.equal(C.FITS.refVen.tt,140);assert.equal(C.FITS.refVen.boltTT,70);near(C.FITS.refVen.fm,28.861991732993026,.003);assert.equal(C.FITS.refSide,undefined);assert.equal(C.canonicalWeaponKind('refSide'),'twin40');
});

test('the box twin carries two complete source DBY circles entirely outside its case',()=>{
 const {a,m}=data(),source=data('refVen'),lookup=new Map(source.a.sourceVertexIndices.map((old,i)=>[old,i]));assert.equal(a.drivePivots.length,2);const caseSide=Math.max(...a.turretCompartment.convexes.flatMap(q=>q.verticesM.map(p=>Math.abs(p[2]))));
 for(const drive of a.drivePivots){assert.ok([1,3].includes(drive.sourceComponent));assert.equal(drive.vertices,256);assert.equal(drive.indices,666);assert.equal(drive.completeSourceComponent,true);const wanted=new Set(drive.sourceVertexIndices),sourceFaces=[];for(let i=0;i<source.m.idx.length;i+=3){const ids=Array.from(source.m.idx.subarray(i,i+3),v=>source.a.sourceVertexIndices[v]);if(ids.some(v=>wanted.has(v))){assert.ok(ids.every(v=>wanted.has(v)),'a complete original circular-base component cannot cut across any source face');sourceFaces.push(ids.sort((a,b)=>a-b).join(','));}}assert.equal(sourceFaces.length,222);const S=drive.sourceVertexIndices.map(i=>point(source.a,source.m,lookup.get(i))),T=S.map((_,i)=>point(a,m,drive.firstVertex+i)),d=S.map(p=>C.sub(p,S[0]));let j=1,k=2,l=3;for(let i=1;i<S.length;i++)if(C.len(d[i])>C.len(d[j]))j=i;for(let i=1;i<S.length;i++)if(C.len(C.cross(d[j],d[i]))>C.len(C.cross(d[j],d[k])))k=i;const n=C.cross(d[j],d[k]);for(let i=1;i<S.length;i++)if(Math.abs(C.dot(n,d[i]))>Math.abs(C.dot(n,d[l])))l=i;const physicalScale=C.len(C.sub(T[j],T[0]))/C.len(d[j]);assert.ok(physicalScale>0&&Number.isFinite(physicalScale),'the complete40-class circle is uniformly sized from its DBY source');for(let i=0;i<S.length;i++)for(const anchor of [0,j,k,l])near(C.len(C.sub(T[i],T[anchor])),C.len(C.sub(S[i],S[anchor]))*physicalScale,.005);
  const key=ids=>ids.sort((a,b)=>a-b).join(','),faces=(mesh,row,map)=>{const out=[];for(let i=row.firstIndex;i<row.firstIndex+row.indices;i+=3)out.push(key(Array.from(mesh.idx.subarray(i,i+3),map)));return out.sort();};assert.deepEqual(faces(m,drive,i=>drive.sourceVertexIndices[i-drive.firstVertex]),sourceFaces.sort(),'every original circular-base face remains intact');
  const Y=T.map(p=>p[1]);assert.ok(Math.min(...Y)<drive.centerM[1]-drive.radiusM*.8&&Math.max(...Y)>drive.centerM[1]+drive.radiusM*.8,'the whole upper and lower circle are present');const clearance=Math.min(...T.map(p=>Math.abs(p[2])))-caseSide;assert.ok(clearance>.15,'the complete base remains outside the central case wall');near(clearance,drive.caseSideClearanceM,.003);const barrel=a.barrelCenters.find(b=>b.muzzle[2]*drive.centerM[2]>0);assert.ok(barrel);near(barrel.muzzle[2],drive.centerM[2],.01);assert.ok(barrel.root[1]>drive.centerM[1]+barrel.outerRadiusM*.5);
 }
 near(a.supportStandHeightM,0,1e-12);C.fitOrigin(fitting()).forEach((v,k)=>near(v,fitting().p[k],1e-12));
});

test('both regular twin models retain direct placement, heading, save roundtrips and split preview geometry',()=>{
 for(const k of ['twin40','twin40Dome']){const {a}=data(k),s=C.newShip({L:160,W:160,H:50,assembly:true},'Photographed twin mounting');s.parts=[];
  C.placePart(s,'struct',[80,10,0],[150,150,20],{form:'chamfer',corner:.05,skin:'armor'},false);
  const result=C.placeFit(s,k,[80,20,0],[0,1,0],0,false);assert.ok(result.fit,result.err);assert.ok(!result.fit.float);near(result.fit.ped,0,1e-12);near(result.fit.base,0,1e-12);result.fit.assetYaw=27.5;
  const loaded=C.deserialize(C.serialize(s)),f=loaded.fits[0];assert.equal(f.k,k);assert.ok(!f.float);near(f.assetYaw,27.5,1e-12);assert.equal(C.fitSpec(f).tt,80);
  const preview=G.meshPreview(loaded,[],[f]);assert.equal(preview.previewFits.ni+preview.previewRefFits.ni,drawAsset(k).faces*3);
  const fleet=G.fleetGeometry(loaded,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id),joint=C.authoredTurretGeometry(f);assert.ok(t&&joint);assert.equal(fleet.meshes[t.bodyMesh].geo.ni,drawAsset(k).elevationIndexStart);assert.equal(fleet.meshes[t.mesh].geo.ni,drawAsset(k).faces*3-drawAsset(k).elevationIndexStart);t.pivot.forEach((v,i)=>near(v,joint.elevationPivot[i],1e-6));
  assert.deepEqual(plain(C.serialize(C.deserialize(C.serialize(loaded))).fits),plain(C.serialize(loaded).fits));
 }
});

test('the related angular houses credit their closed exterior once without adding a hidden second foundation',()=>{
 const twin=data(),triple=data('triple40');assert.equal(twin.a.sharedCase.key,triple.a.sharedCase.key);
 assert.equal(twin.a.centralEnclosure.closedExterior,true);assert.ok(twin.a.components.some(row=>row.label===twin.a.centralEnclosure.fittedMechanicalCover),'the external-drive case has a real fitted cover');
 const cellVolume=poly=>{let v=0;for(const face of poly.faces)for(let i=1;i+1<face.length;i++)v+=C.dot(poly.verticesM[face[0]],C.cross(poly.verticesM[face[i]],poly.verticesM[face[i+1]]))/6;return Math.abs(v);};
 for(const {a,m}of [twin,triple]){
  const labels=new Set(a.photoGeometryFeaturesM.case.componentLabels),cases=a.components.filter(row=>labels.has(row.label));assert.ok(cases.length>=2);
  assert.ok(cases.every(row=>row.firstIndex+row.indices<=a.elevationIndexStart),'the closed equipment case remains fixed while the guns elevate');
  const independentCellVolume=a.turretCompartment.convexes.reduce((sum,cell)=>sum+cellVolume(cell),0);assert.ok(independentCellVolume>0);
  const bare=C.newShip({assembly:true,L:100,W:100,H:50},'Actual gunhouse room');bare.parts=[];const f=fitting(a.catalogKind);bare.fits=[f];
  const q=C.turretCompartmentProjection(bare,f);near(q.housingVolume,a.turretCompartment.volumeM3,.2);near(q.housingVolume,independentCellVolume,.2); // Any overlapping duplicate foundation would inflate the cell sum without changing the actual union.
  near(q.externalVolume,q.housingVolume,.2);near(q.embeddedVolume,0,.0001);
 }
});

test('the twins and triple share the same physical main case and every triple barrel connects through a real cradle',()=>{
 const A=data(),B=data('triple40'),left=featureRows(A.a,'mainCase'),right=featureRows(B.a,'mainCase');
 const points=(a,m,rows)=>rows.flatMap(row=>Array.from({length:row.vertices},(_,i)=>point(a,m,row.firstVertex+i))),P=points(A.a,A.m,left),Q=points(B.a,B.m,right);
 assert.equal(P.length,Q.length,'the common case must share actual surface topology');for(let i=0;i<P.length;i++)for(let k=0;k<3;k++)near(P[i][k],Q[i][k],.003);
 const exteriorVolume=(a,m,rows)=>rows.reduce((sum,row)=>{let v=0;for(let i=row.firstIndex;i<row.firstIndex+row.indices;i+=3){const [p,q,r]=Array.from(m.idx.subarray(i,i+3),j=>point(a,m,j));v+=C.dot(p,C.cross(q,r))/6;}return sum+Math.abs(v);},0);
 near(exteriorVolume(A.a,A.m,left),exteriorVolume(B.a,B.m,right),.1);
 // The same outer case does not imply equal usable capacitor volume: the
 // internal three-gun cradle may occupy space that the external twin does not.
 const axle=featureRows(B.a,'axle'),cradle=featureRows(B.a,'cradle'),receiver=featureRows(B.a,'receiver');assert.ok(axle.every(row=>row.firstIndex+row.indices<=B.a.elevationIndexStart),'the bearing axle stays fixed in the main case');assert.ok(cradle.every(row=>row.firstIndex>=B.a.elevationIndexStart),'the complete cradle elevates with the guns');
 const cradlePoints=points(B.a,B.m,cradle),receiverPoints=points(B.a,B.m,receiver),span=(points,k)=>Math.max(...points.map(p=>p[k]))-Math.min(...points.map(p=>p[k]));
 assert.ok(span(cradlePoints,2)>=span(receiverPoints,2)*.75&&span(cradlePoints,0)>span(Q,0)*.3&&span(cradlePoints,1)>1,'the three-gun support is a broad mechanical cradle, not a thin post');
 const nodes=[...right,...axle,...cradle,...receiver,...B.a.barrelCenters],cradleStart=right.length+axle.length,edges=nodes.map(()=>[]);
 for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(surfacesTouch(B.a,B.m,nodes[i],nodes[j])){edges[i].push(j);edges[j].push(i);}
 const reached=new Set(right.map((_,i)=>i)),queue=[...reached];for(let i=0;i<queue.length;i++)for(const j of edges[queue[i]])if(!reached.has(j)){reached.add(j);queue.push(j);}
 assert.ok(cradle.some((_,i)=>reached.has(cradleStart+i)),'the cradle must physically meet the shared case');
 for(let i=cradleStart+cradle.length;i<nodes.length;i++)assert.ok(reached.has(i),'each receiver and barrel must have actual triangle contact back to the common case');
});
