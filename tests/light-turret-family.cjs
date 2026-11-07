const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x));
const FAMILY=[['single500','light_single500',1,.5],['single200','light_single200',1,.2],['twin200','light_twin200',2,.2],['twin200Fast','light_twin200_fast',2,.2],['quad200','light_quad200',4,.2],['quad500','arq_turret_quad500',4,.5]];
const near=(a,b,e=.004)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((v,i)=>near(v,b[i],e));
function data(k){const d=C.FITS[k];assert.ok(d,k+' regular catalog definition');const a=C.REFERENCE_ASSETS[d.asset];assert.ok(a,k+' actual model');return{d,a,m:C.decodeReference(d.asset)};}
const fit=(k,extra={})=>({id:1,k,p:[100,40,15],a:2,ped:0,base:0,low:0,float:false,...extra});
const point=(a,m,i)=>[0,1,2].map(k=>m.pos[i*3+k]*a.size[k]+a.c[k]);
const points=(a,m,r)=>Array.from({length:r.vertices},(_,i)=>point(a,m,r.firstVertex+i));
const bounds=P=>[...Array(3)].map((_,k)=>Math.min(...P.map(p=>p[k]))).concat([...Array(3)].map((_,k)=>Math.max(...P.map(p=>p[k]))));
const middle=P=>{const b=bounds(P);return[0,1,2].map(k=>(b[k]+b[k+3])/2);};
function triangles(a,m,r){const T=new Float32Array(r.indices*3);for(let i=0;i<r.indices;i++)point(a,m,m.idx[r.firstIndex+i]).forEach((v,k)=>T[i*3+k]=v);return T;}
function connected(m,r){
 const first=r.firstVertex,n=r.vertices,parent=Array.from({length:n},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>parent[find(a)]=find(b),weld=new Map();
 for(let i=first;i<first+n;i++){const key=Array.from(m.pos.subarray(i*3,i*3+3)).join(',');if(weld.has(key))join(i-first,weld.get(key)-first);else weld.set(key,i);}
 for(let i=r.firstIndex;i<r.firstIndex+r.indices;i+=3){const t=Array.from(m.idx.subarray(i,i+3));assert.ok(t.every(v=>v>=first&&v<first+n),'complete triangle inside component range');join(t[0]-first,t[1]-first);join(t[0]-first,t[2]-first);}
 return new Set(parent.map((_,i)=>find(i))).size;
}
const signedVolume=(V,F)=>F.reduce((s,f)=>s+f.slice(1,-1).reduce((s,b,i)=>s+C.dot(V[f[0]],C.cross(V[b],V[f[i+2]]))/6,0),0);

function measuredBarrelProfile(a,m,row,stationFraction=.65){
 // Obtain the axis, neck and diameters from actual triangles/rings. A complete
 // barrel's largest radius belongs to its breech and cannot measure its shaft.
 const P=points(a,m,row),b=bounds(P),center=[(b[1]+b[4])/2,(b[2]+b[5])/2],length=b[3]-b[0],T=triangles(a,m,row),reach=Math.max(b[4]-b[1],b[5]-b[2])+1;
 const diameterAt=x=>{const hits=[[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]].map(direction=>C.rayTris(T,[x,center[0]-direction[1]*reach,center[1]-direction[2]*reach],direction));assert.ok(hits.every(Boolean),row.label+' complete circular cross-section');const dy=hits[0].p[1]-hits[1].p[1],dz=hits[2].p[2]-hits[3].p[2];near(Math.abs(dy),Math.abs(dz),.008);return(Math.abs(dy)+Math.abs(dz))/2;};
 // Scan real outside intersections so a short mid-barrel reinforcing collar
 // cannot be mistaken for the long narrow shaft. Inner bore-floor vertices
 // are excluded by measuring the external surface, rather than ring minima.
 const initialDiameter=Math.min(...Array.from({length:21},(_,i)=>diameterAt(b[0]+length*(.25+i*.03)))),rings=new Map();for(const p of P){const key=p[0].toFixed(5),r=Math.hypot(p[1]-center[0],p[2]-center[1]);if(!rings.has(key)||r>rings.get(key).radius)rings.set(key,{x:p[0],radius:r});}
 const neck=[...rings.values()].filter(r=>r.x>b[0]+.004&&r.x<b[3]-length*.12&&Math.abs(r.radius*2-initialDiameter)<=Math.max(.008,initialDiameter*.015)).sort((a,b)=>a.x-b.x)[0];assert.ok(neck,row.label+' decoded narrow-shaft neck');const visibleLength=b[3]-neck.x,shaftStationX=neck.x+visibleLength*stationFraction,shaftDiameter=diameterAt(shaftStationX),tipRings=P.filter(p=>Math.abs(p[0]-b[3])<.002),muzzleDiameter=2*Math.max(...tipRings.map(p=>Math.hypot(p[1]-center[0],p[2]-center[1])));
 return{rootX:b[0],neckX:neck.x,tipX:b[3],fullLength:length,visibleLength,shaftStationX,shaftDiameter,muzzleDiameter};
}

// These checks count decoded geometry and compare native/game transforms. They
// do not infer physical barrel count, usable room or centering from a label.
test('six light weapons use their requested per-barrel energies and native photo calibration',()=>{
 const ids=[];for(const[k,id,n,tt]of FAMILY){const{d,a}=data(k);ids.push(id);assert.equal(d.asset,id);assert.equal(d.barrels,n);near(d.boltTT,tt,1e-12);near(d.tt,n*tt,1e-12);near(d.power*d.cycle/C.TT,n*tt,1e-10);assert.equal(a.catalogKind,k);vector([d.fm,d.hm,d.wm],a.size,.001);near(C.weaponModelScale(k),1,1e-12);assert.ok(C.weaponSizing(k).calibration);assert.equal(a.noSupportPedestal,true);near(a.supportStandHeightM,0,1e-12);vector(a.forward,[1,0,0],1e-12);vector(a.up,[0,1,0],1e-12);}
 assert.equal(new Set(ids).size,6);assert.ok(C.FITS.twin200Fast.cycle<C.FITS.twin200.cycle,'the explicitly rapid vertical twin has a shorter firing interval');
 assert.ok(C.FITS.quad500.fm>C.FITS.quad200.fm,'the photographed medium quad remains physically larger than the light quad');assert.ok(C.FITS.single500.fm<C.FITS.quad500.fm,'the ball single remains compact');
});

test('the light meshes contain fourteen connected circular barrels with real recessed mouths',()=>{
 let total=0;for(const[k,,n]of FAMILY){const{a,m}=data(k);assert.equal(a.barrelCenters.length,n);assert.equal(a.muzzlePoints.length,n);
  for(const r of a.barrelCenters){total++;assert.equal(connected(m,r),1,k+' complete connected tube');vector(r.axis,[1,0,0],1e-12);const P=points(a,m,r),b=bounds(P),T=triangles(a,m,r),[x,y,z]=r.muzzle;
   assert.ok(b[3]-b[0]>Math.max(b[4]-b[1],b[5]-b[2])*5,k+' genuinely slender +X barrel');near(b[4]-b[1],b[5]-b[2],.008);
   const back=C.rayTris(T,[x+1,y,z],[-1,0,0]),lip=C.rayTris(T,[x+1,y+(r.outerRadiusM+r.boreRadiusM)/2,z],[-1,0,0]);assert.ok(back&&lip,k+' bore and annular lip physically exist');near(lip.p[0],x,.004);near(back.p[0],x-r.muzzleRecessM,.004);assert.ok(back.t>lip.t+.01,k+' recessed bore geometry');
   const tip=P.filter(p=>Math.abs(p[0]-x)<.004&&Math.abs(Math.hypot(p[1]-y,p[2]-z)-r.outerRadiusM)<.008);assert.ok(new Set(tip.map(p=>Math.atan2(p[2]-z,p[1]-y).toFixed(3))).size>=(k==='quad500'?8:16),k+' complete round muzzle ring at its budgeted tessellation');
  }
 }assert.equal(total,14);
});

test('decoded visible shaft lengths and separate shaft/muzzle diameters follow the controlling full-sheet photograph',()=>{
 const photo=JSON.parse(fs.readFileSync(path.join(root,'assets/source/light-turret-photo-measurements.json'),'utf8')),anchor=photo.latestBarrelAnchor,span=Math.hypot(...anchor.wholeLengthEndpointsPixels[0].map((v,i)=>v-anchor.wholeLengthEndpointsPixels[1][i])),metresPerPixel=anchor.physicalLengthM/span;near(anchor.physicalLengthM,C.FITS.oct40.fm,1e-12);near(metresPerPixel,anchor.metresPerPixel,1e-12);assert.equal(photo.latestReferencePrecedence.barrelProfiles,'latest-full-sheet');
 const pixelSpan=ends=>Math.hypot(...ends[0].map((v,i)=>v-ends[1][i]));
 for(const[k]of FAMILY){const{a,m}=data(k),reference=photo.models[k].barrelProfile;assert.equal(reference.photoId,'latest-full-sheet');near(reference.metresPerPixel,metresPerPixel,1e-12);assert.equal(reference.uncertaintyPixels,1,'diameter uncertainty stays explicit at one source pixel');const expectedLength=pixelSpan([reference.axisRootPixels,reference.axisTipPixels])*metresPerPixel,expectedShaft=pixelSpan(reference.shaftEdgesPixels)*metresPerPixel,expectedMuzzle=pixelSpan(reference.muzzleEdgesPixels)*metresPerPixel,diameterTolerance=reference.uncertaintyPixels*metresPerPixel+.004,lengthTolerance=(reference.neckTransitionUncertaintyPixels+reference.muzzleAxisEndpointUncertaintyPixels)*metresPerPixel+.004;
  for(const row of a.barrelCenters){const measured=measuredBarrelProfile(a,m,row,reference.shaftStationFraction);near(measured.visibleLength,expectedLength,lengthTolerance);near(measured.shaftDiameter,expectedShaft,diameterTolerance);near(measured.muzzleDiameter,expectedMuzzle,diameterTolerance);assert.ok(measured.fullLength>measured.visibleLength,'complete breech-to-tip length cannot substitute for the photographed narrow shaft');if(row.exposedStartX!=null)near(measured.neckX,row.exposedStartX,.005);}
 }
});

test('real barrel positions distinguish horizontal, staggered vertical and two-column quad layouts',()=>{
 const centers=k=>{const{a,m}=data(k);return a.barrelCenters.map(r=>middle(points(a,m,r)));};
 const h=centers('twin200');near(h[0][0],h[1][0]);near(h[0][1],h[1][1]);near(h[0][2],-h[1][2]);assert.ok(Math.abs(h[0][2]-h[1][2])>.2,'horizontal twin uses separate port/starboard tubes');
 const v=centers('twin200Fast').sort((a,b)=>a[1]-b[1]);near(v[0][2],v[1][2]);assert.ok(v[1][1]-v[0][1]>.2,'rapid twin stacks two physical bores');assert.ok(Math.abs(v[1][0]-v[0][0])>.15,'upper/lower barrels are staggered fore and aft');
 for(const k of ['quad200','quad500']){const P=centers(k),left=P.filter(p=>p[2]<0).sort((a,b)=>a[1]-b[1]),right=P.filter(p=>p[2]>0).sort((a,b)=>a[1]-b[1]);assert.equal(left.length,2);assert.equal(right.length,2);for(const pair of[left,right]){near(pair[0][0],pair[1][0]);near(pair[0][2],pair[1][2]);assert.ok(pair[1][1]-pair[0][1]>.15,'each external base carries two vertical tubes');}for(let i=0;i<2;i++){near(left[i][0],right[i][0]);near(left[i][1],right[i][1]);near(left[i][2],-right[i][2]);}}
});

test('the 200 GT quad keeps the scaled external-twin case and centers two bores on each outboard drive',()=>{
 const{a,m}=data('quad200'),source=data('twin40'),R=a.sharedCase.meshRange,S=source.a.sharedCase.meshRange;assert.equal(R.vertices,S.vertices);assert.equal(R.indices,S.indices);const P=points(a,m,R),Q=points(source.a,source.m,S),p=bounds(P),q=bounds(Q),scale=(p[5]-p[2])/(q[5]-q[2]);assert.ok(scale>0&&scale<1,'light case is a reduced uniform copy');
 for(let i=0;i<P.length;i++){vector(P[i],Q[i].map(v=>v*scale),.005);if(m.uv&&source.m.uv)for(let u=0;u<2;u++)near(m.uv[(R.firstVertex+i)*2+u],source.m.uv[(S.firstVertex+i)*2+u],1e-6);}
 for(let i=0;i<R.indices;i++)assert.equal(m.idx[R.firstIndex+i]-R.firstVertex,source.m.idx[S.firstIndex+i]-S.firstVertex,'same complete case faces');
 assert.equal(a.drivePivots.length,2);const sideExtent=Math.max(Math.abs(p[2]),Math.abs(p[5]));
 for(const wheel of a.drivePivots){const sign=Math.sign(wheel.centerM[2]),barrels=a.barrelCenters.filter(r=>Math.sign(r.root[2])===sign);assert.equal(barrels.length,2);assert.ok(Math.abs(wheel.centerM[2])>sideExtent,'the circular bases are wholly external to the case');const rows=barrels.map(r=>middle(points(a,m,r))).sort((a,b)=>a[1]-b[1]);near((rows[0][1]+rows[1][1])/2,wheel.centerM[1],.006);for(const v of rows)near(v[2],wheel.centerM[2],.006);assert.ok((rows[1][1]-rows[0][1])<wheel.radiusM*1.5,'the two bores are clustered around the circular base midpoint');}
});

test('the small ball has its actual lower third embedded and its whole closed sphere in the moving group',()=>{
 const{a,m}=data('single500'),R=a.sphereRadiusM,center=a.sphereCenterM;assert.ok(R>0);vector(center,a.elevationPivot);const cells=a.turretCompartment.convexes;assert.ok(cells.length>0);
 const sphere=cells.find(p=>p.verticesM.every(v=>Math.abs(C.len(C.sub(v,center))-R)<.006));assert.ok(sphere,'a closed physical spherical house exists');const b=bounds(sphere.verticesM);near(-b[1]/(b[4]-b[1]),1/3,.003);assert.ok(sphere.meshRange.firstIndex>=a.elevationIndexStart,'the entire ball elevates with the gun');for(const p of points(a,m,sphere.meshRange))near(C.len(C.sub(p,center)),R,.006);
 const s=C.newShip({assembly:true,L:100,W:100,H:60},'Small embedded ball');s.parts=[];s.fits=[];C.placePart(s,'struct',[50,-20,0],[90,90,40],{form:'box',corner:0},false);const f=fit('single500',{p:[50,0,0]});s.fits.push(f);const q=C.turretCompartmentProjection(s,f);assert.ok(q.externalVolume>0&&q.embeddedVolume>0);near(q.embeddedVolume/q.housingVolume,7/27,.016);
});

test('usable room consists only of closed physical gunhouse cells and excludes the long barrel envelope',()=>{
 for(const[k]of FAMILY){const{a,m}=data(k);let total=0;for(const p of a.turretCompartment.convexes){const V=p.verticesM,F=p.faces,edges=new Map();assert.ok(V.length>=4&&F.length>=4);for(const f of F){const[ia,ib,ic]=f,N=C.norm(C.cross(C.sub(V[ib],V[ia]),C.sub(V[ic],V[ia])));for(const v of V)assert.ok(C.dot(N,C.sub(v,V[ia]))<.004,k+' convex cell');for(let i=0;i<f.length;i++){const edge=[f[i],f[(i+1)%f.length]].sort((a,b)=>a-b).join(',');edges.set(edge,(edges.get(edge)||0)+1);}}assert.ok([...edges.values()].every(n=>n===2),k+' closed cell');const volume=signedVolume(V,F);assert.ok(volume>0);near(volume,p.volumeM3,Math.max(.006,volume*.001));total+=volume;
   if(p.meshRange){const R=p.meshRange,rv=[],rf=[];for(let j=R.firstIndex;j<R.firstIndex+R.indices;j+=3){rf.push([rv.length,rv.length+1,rv.length+2]);rv.push(...Array.from(m.idx.subarray(j,j+3),i=>point(a,m,i)));}near(signedVolume(rv,rf),volume,Math.max(.03,volume*.008));}
   else{assert.ok(p.conservative&&p.sourceMeshRange,k+' conservative source cell identifies its physical body');const T=triangles(a,m,p.sourceMeshRange),center=C.mul(V.reduce((s,v)=>C.add(s,v),[0,0,0]),1/V.length);assert.ok(C.rayTris(T,center,[0,1,0]),k+' source cell has a real roof');assert.ok(C.rayTris(T,center,[0,-1,0]),k+' source cell has a real floor');}
  }near(total,a.turretCompartment.volumeM3,Math.max(.01,total*.001));assert.ok(total<a.size.reduce((n,v)=>n*v,1)*.85,k+' empty barrel reach cannot be credited as room');
  if(['single500','twin200','quad200','quad500'].includes(k))assert.ok(total>0,k+' enclosed case has positive room');
 }
});

test('draw, picking and physical muzzle transforms agree on every mount axis and tilted surfaces',()=>{
 for(const[k]of FAMILY){const{a}=data(k);for(const frame of [...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.25,.91,-.31])}]){const f=fit(k,{...frame,assetYaw:31}),geos=[G.meshFits({fits:[f]}),G.meshReferenceFits({fits:[f]})],b=C.fitAABB(f),joint=C.authoredTurretGeometry(f);assert.ok(joint);assert.equal(geos.reduce((s,g)=>s+g.ni,0),drawAsset(k).faces*3,k+' budgeted model drawn exactly once');for(const g of geos)for(let i=0;i<g.ni;i++){const j=g.idx[i]*3;for(let q=0;q<3;q++)assert.ok(g.pos[j+q]>=b[q]-.003&&g.pos[j+q]<=b[q+3]+.003,k+' visible triangle inside selectable bounds');}
  const nativeToWorld=p=>C.referenceFitPoint(f,p.map((v,i)=>(v-a.c[i])/a.size[i]));vector(nativeToWorld(a.mount),C.fitOrigin(f),1e-6);
  for(const r of a.barrelCenters){const start=nativeToWorld(C.add(r.muzzle,[.7,0,0])),end=nativeToWorld(C.sub(r.muzzle,[r.muzzleRecessM,0,0])),hit=G.rayFit(start,C.norm(C.sub(end,start)),f);assert.ok(hit,k+' actual muzzle is pickable');vector(hit.p,end,.008);}
  const pose=C.aimAuthoredTurret(joint,.3,.45);assert.equal(pose.muzzles.length,a.barrels);assert.ok(C.len(C.sub(pose.muzzles[0],joint.muzzles[0]))>.1,k+' barrel mouths follow elevation');assert.ok(C.authoredTurretInArc(joint,pose.fw));
 }}
});

test('fleet and preview partition the same physical meshes at their authored elevation joints',()=>{
 for(const[k]of FAMILY){const{a}=data(k),s=C.newShip({assembly:true,L:120,W:100,H:80},'Light family articulated mesh');s.parts=[];const f=fit(k,{assetYaw:24});s.fits=[f];const g=G.fleetGeometry(s,{trial:true}),t=g.turrets.find(t=>t.id===f.id),joint=C.authoredTurretGeometry(f),preview=G.meshPreview(s,[],[f]);assert.ok(t&&joint);assert.equal(t.barrels,a.barrels);assert.equal(t.bodyMesh?g.meshes[t.bodyMesh].geo.ni:0,drawAsset(k).elevationIndexStart);assert.equal(g.meshes[t.mesh].geo.ni,drawAsset(k).faces*3-drawAsset(k).elevationIndexStart);near(preview.previewFits.ni+preview.previewRefFits.ni,drawAsset(k).faces*3,1e-12);vector(t.pivot,joint.elevationPivot,1e-6);vector(t.bodyPivot||joint.yawPivot,joint.yawPivot,1e-6);}
});
