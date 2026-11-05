const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx);
const fit=k=>({id:1,k,p:[40,30,20],a:2,ped:0,base:0,low:0,float:false,assetYaw:23});
const near=(a,b,e=.006)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const point=(a,m,i)=>[0,1,2].map(k=>m.pos[i*3+k]*a.size[k]+a.c[k]);
const rangePoints=(a,m,r)=>Array.from({length:r.vertices},(_,i)=>point(a,m,r.firstVertex+i));
function rangeTriangles(a,m,r){const out=[];for(let i=r.firstIndex;i<r.firstIndex+r.indices;i+=3)out.push(Array.from(m.idx.subarray(i,i+3),j=>point(a,m,j)));return out;}
function pointOnTriangle(p,[a,b,c],eps=.008){
 const u=C.sub(b,a),v=C.sub(c,a),n=C.cross(u,v),nn=C.dot(n,n);if(nn<1e-20)return false;
 const w=C.sub(p,a);if(Math.abs(C.dot(w,n))/Math.sqrt(nn)>eps)return false;
 const uu=C.dot(u,u),uv=C.dot(u,v),vv=C.dot(v,v),wu=C.dot(w,u),wv=C.dot(w,v),den=uu*vv-uv*uv;if(Math.abs(den)<1e-20)return false;
 const x=(vv*wu-uv*wv)/den,y=(uu*wv-uv*wu)/den,tol=eps/Math.max(.01,Math.sqrt(Math.max(uu,vv)));return x>=-tol&&y>=-tol&&x+y<=1+tol;
}
function surfacesTouch(left,right){
 const flat=T=>new Float32Array(T.flat(2)),A=flat(left),B=flat(right);
 const crosses=(p,q,T)=>{const d=C.sub(q,p),length=C.len(d);if(length<1e-9)return false;const hit=C.rayTris(T,p,C.mul(d,1/length));return !!hit&&hit.t<=length+.008;};
 for(const [triangles,other,flatOther]of [[left,right,B],[right,left,A]])for(const t of triangles){
  if(t.some(p=>other.some(q=>pointOnTriangle(p,q))))return true;
  for(let i=0;i<3;i++)if(crosses(t[i],t[(i+1)%3],flatOther))return true;
 }
 return false;
}

for(const [family,limit,count]of [['TURRET_FAMILY_KEYS',5000,9],['LIGHT_TURRET_KEYS',3000,6]])test(`${family} and saved-key aliases stay within ${limit} actual rendered triangles per turret`,()=>{
 const catalog=Array.from(C[family]);assert.equal(catalog.length,count);
 const assets=new Set(catalog.map(k=>C.FITS[k].asset)),kinds=Object.keys(C.FITS).filter(k=>assets.has(C.FITS[k].asset));
 assert.equal(assets.size,count,'each current design retains its own regular model');
 if(family==='TURRET_FAMILY_KEYS')for(const oldSkin of [undefined,'ven_turret','ven_turret_3','dby_twin40_raised']){const legacy={...fit('htl'),...(oldSkin?{skinAsset:oldSkin}:{})},alias=C.fitSpec(legacy);assert.equal(alias.asset,C.FITS.refVen.asset,'the legacy DBY key resolves to the same budgeted native model');assert.ok(assets.has(alias.asset));assert.equal(legacy.skinAsset,undefined,'retired source skins cannot bypass the active model budget');assert.ok((G.meshFits({fits:[legacy]}).ni+G.meshReferenceFits({fits:[legacy]}).ni)/3<=limit);}
 for(const k of kinds){
  const a=C.REFERENCE_ASSETS[C.FITS[k].asset],m=C.decodeReference(C.FITS[k].asset);let source=a;
  const seen=new Set();while(source.dataFrom){assert.ok(!seen.has(source),'acyclic source data');seen.add(source);source=C.REFERENCE_ASSETS[source.dataFrom];assert.ok(source);}
  const packed=Buffer.from(source.data,'base64');assert.ok(a.n>0&&a.faces>0);assert.ok([2,4].includes(a.indexBytes));
  assert.equal(packed.length,a.n*10+a.faces*3*a.indexBytes,k+' packed payload contains exactly the advertised positions, UVs and complete triangles');
  assert.equal(m.pos.length,a.n*3);assert.equal(m.idx.length,a.faces*3);assert.ok(m.idx.length%3===0);
  for(const i of m.idx)assert.ok(Number.isInteger(i)&&i>=0&&i<a.n,k+' valid referenced vertex');
  for(const p of m.pos)assert.ok(Number.isFinite(p),k+' finite rendered coordinate');
  assert.ok(m.idx.length/3<=limit,`${k}: ${m.idx.length/3} triangles exceed ${limit}`);
  const f=fit(k),s={fits:[f]},drawn=G.meshFits(s).ni+G.meshReferenceFits(s).ni;
  assert.equal(drawn,m.idx.length,k+' the complete physical model is drawn exactly once');assert.ok(drawn/3<=limit);
  assert.ok(a.elevationIndexStart>=0&&a.elevationIndexStart<=drawn&&a.elevationIndexStart%3===0,k+' fixed and moving groups share the same budget');
 }
});

for(const kind of ['twin40','quad200'])test(`${kind} has fixed round structural shoulders physically joining its case to both external gun bases`,()=>{
 const a=C.REFERENCE_ASSETS[C.FITS[kind].asset],m=C.decodeReference(C.FITS[kind].asset),rows=a.fixedDriveShoulders;
 assert.equal(rows?.length,2);assert.equal(new Set(rows.map(r=>Math.sign(r.centerM[2]))).size,2);
 const caseRange=a.sharedCase.meshRange,caseTriangles=rangeTriangles(a,m,caseRange);
 for(const r of rows){
  const sign=Math.sign(r.centerM[2]),drive=a.drivePivots.find(d=>Math.sign(d.centerM[2])===sign);assert.ok(drive);
  assert.equal(r.componentRole,'fixed-circular-shoulder');assert.equal(r.structuralArmor,true);assert.equal(r.addsCapacitorRoom,false);
  assert.ok(r.firstIndex>=0&&r.firstIndex+r.indices<=a.elevationIndexStart,'the joining structure stays with the fixed case');
  const P=rangePoints(a,m,r),angles=new Set();assert.ok(P.length>0&&r.radiusM>0);
  for(const p of P){near(Math.hypot(p[0]-r.centerM[0],p[1]-r.centerM[1]),r.radiusM);angles.add(Math.atan2(p[1]-r.centerM[1],p[0]-r.centerM[0]).toFixed(3));}
  assert.ok(angles.size>=12,'decoded circumference is genuinely round rather than a rectangular connector');
  for(const axis of [0,1]){near(Math.min(...P.map(p=>p[axis])),r.centerM[axis]-r.radiusM);near(Math.max(...P.map(p=>p[axis])),r.centerM[axis]+r.radiusM);}
  const Z=P.map(p=>p[2]*sign);assert.ok(Math.min(...Z)<Math.abs(r.driveInnerFaceZM));assert.ok(Math.max(...Z)>Math.abs(r.driveInnerFaceZM),'the round structure reaches into the actual gun-base inner face');
  const T=rangeTriangles(a,m,r),driveTriangles=rangeTriangles(a,m,drive),driveFlat=new Float32Array(driveTriangles.flat(2));assert.ok(surfacesTouch(T,caseTriangles),'actual shoulder triangles connect to the fixed case');assert.ok(surfacesTouch(T,driveTriangles),'actual shoulder triangles engage the complete circular gun base');
  // The source bearing's nearest AABB vertex belongs to its thin axle, not
  // its rear disk. Verify contact around the complete shoulder circumference.
  for(let i=0;i<16;i++){const t=i*Math.PI/8,o=[r.centerM[0]+r.radiusM*Math.cos(t),r.centerM[1]+r.radiusM*Math.sin(t),0],hit=C.rayTris(driveFlat,o,[0,0,sign]);assert.ok(hit,'a real bearing surface exists behind every sampled part of the round shoulder');assert.ok(hit.p[2]*sign<=Math.max(...Z)+.006,'the structural shoulder reaches the actual disk instead of stopping at the axle AABB');}
 }
});

test('the reduced triple70 front pod retains nonzero lighting normals on every indexed vertex',()=>{
 const a=C.REFERENCE_ASSETS[C.FITS.triple70.asset];
 const check=(g,label)=>{const used=new Set(g.idx.subarray(0,g.ni));for(const i of used){const n=Array.from(g.nor.subarray(i*3,i*3+3));assert.equal(n.length,3);assert.ok(n.every(Number.isFinite)&&n.some(v=>v!==0),`${label}: indexed vertex ${i} cannot have a zero lighting normal`);}return used.size;};
 // Validate the GPU's actual packed normal attributes. Unused QEM vertices
 // are harmless; a collinear packed face referenced by the draw list is not.
 const frames=[{a:2,p:[0,0,0],assetYaw:0},...Array.from({length:6},(_,a)=>({a,p:[1600,300,-600],assetYaw:37})),{a:2,p:[40,30,20],assetYaw:23,tilt:C.norm([.25,.91,-.31])}];
 for(const [i,frame]of frames.entries()){
  const f={...fit('triple70'),...frame},s={fits:[f]},regular=[G.meshFits(s),G.meshReferenceFits(s)];
  assert.equal(regular.reduce((n,g)=>n+g.ni,0),a.faces*3);assert.ok(regular.reduce((n,g)=>n+check(g,'pose '+i),0)>0);
 }
 const s=C.newShip({assembly:true,L:200,W:100,H:60},'Reduced triple lighting regression');s.parts=[];s.fits=[{...fit('triple70'),p:[0,0,0],assetYaw:0}];
 const fleet=G.fleetGeometry(s,{trial:true}),turret=fleet.turrets.find(t=>t.id===1);assert.ok(turret?.bodyMesh&&turret.mesh);
 for(const name of [turret.bodyMesh,turret.mesh])assert.ok(check(fleet.meshes[name].geo,'articulated '+name)>0,'fixed and elevating groups both retain their indexed lighting attributes');
});
