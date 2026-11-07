const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const p of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,p),'utf8'),cx,{filename:p});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x));
const near=(a,b,e=.008,label='coordinate')=>assert.ok(Math.abs(a-b)<=e,`${label}: ${a} != ${b}`);
const vector=(a,b,e=.008,label)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],e,label));};
const FAMILY=[
 ['ion','capital_twin175_ion',2,175,true],['stl','capital_twin175',2,175,false],
 ['quad175','capital_quad175',4,175,false],['triple175','capital_triple175',3,175,false],
 ['ball175TripleIon','capital_ball175_triple_ion',3,175,true],
 ['ball175Quad','capital_ball175_quad',4,175,false],
 ['ball175QuadIon','capital_ball175_quad_ion',4,175,true],
 ['ball720','capital_ball720_single',1,720,false],['utl','capital_twin720',2,720,false]
];
const BALLS=FAMILY.filter(([k])=>k.startsWith('ball')).map(([k])=>k);
const FRONT_BASELINE=JSON.parse(fs.readFileSync(path.join(root,'tests/helpers/capital-front-base-0ef37aa.json'),'utf8'));
const fit=(k,extra={})=>({id:41,k,p:[200,35,-70],a:2,ped:0,base:0,low:0,float:false,assetYaw:23,...extra});
function model(k){const d=C.FITS[k];assert.ok(d,k+' catalog entry');const a=C.REFERENCE_ASSETS[d.asset];assert.ok(a,k+' registered model');return{d,a,m:C.decodeReference(d.asset)};}
const point=(a,m,i)=>[0,1,2].map(k=>m.pos[i*3+k]*a.size[k]+a.c[k]);
const points=(a,m,r={firstVertex:0,vertices:a.n})=>Array.from({length:r.vertices},(_,i)=>point(a,m,r.firstVertex+i));
const bounds=P=>[0,1,2].map(k=>Math.min(...P.map(p=>p[k]))).concat([0,1,2].map(k=>Math.max(...P.map(p=>p[k]))));
const spans=P=>{const b=bounds(P);return[0,1,2].map(k=>b[k+3]-b[k]);};
function rangeTriangles(a,m,r){const T=new Float32Array(r.indices*3);for(let i=0;i<r.indices;i++)point(a,m,m.idx[r.firstIndex+i]).forEach((v,j)=>T[i*3+j]=v);return T;}
const socketFills=a=>a.components.filter(r=>r.structuralSocketFill||r.componentRole==='fixed-socket-structural-fill');
function caseRanges(a,includeContinuous=true){const fills=new Set(socketFills(a).filter(r=>!includeContinuous||!r.continuousSideArmor).map(r=>r.firstIndex+':'+r.indices));return[...new Map([...a.fixedCaseMeshRanges,...a.closedRoof.meshRanges].filter(r=>!fills.has(r.firstIndex+':'+r.indices)).map(r=>[r.firstIndex+':'+r.indices,r])).values()];}
function frontGroups(a,m){
 const all=Array.from({length:a.faces},(_,i)=>i*3),moving=all.filter(i=>i>=a.elevationIndexStart&&!a.barrelCenters.some(r=>i>=r.firstIndex&&i<r.firstIndex+r.indices)),labels=[...a.frontConnection.fixedAxleLabels,...(a.frontConnection.fixedStanchionLabels||[])],fixed=a.components.filter(r=>labels.includes(r.label)).flatMap(r=>Array.from({length:r.indices/3},(_,i)=>r.firstIndex+i*3)),info=I=>{const used=new Set(I.flatMap(i=>Array.from(m.idx.subarray(i,i+3)))),P=Array.from(used,i=>point(a,m,i));return{boundsM:bounds(P),sizeM:spans(P)};};
 return{movingFront:info(moving),completeFront:info([...new Set([...moving,...fixed])]),podShell:{boundsM:bounds(points(a,m,a.frontPod.podMeshRange)),sizeM:spans(points(a,m,a.frontPod.podMeshRange))}};
}
function connected(m,r){
 const parent=Array.from({length:r.vertices},(_,i)=>i),find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},join=(a,b)=>parent[find(a)]=find(b),weld=new Map();
 for(let i=r.firstVertex;i<r.firstVertex+r.vertices;i++){const key=Array.from(m.pos.subarray(i*3,i*3+3)).join(',');if(weld.has(key))join(i-r.firstVertex,weld.get(key)-r.firstVertex);else weld.set(key,i);}
 for(let i=r.firstIndex;i<r.firstIndex+r.indices;i+=3){const q=Array.from(m.idx.subarray(i,i+3));assert.ok(q.every(j=>j>=r.firstVertex&&j<r.firstVertex+r.vertices));join(q[0]-r.firstVertex,q[1]-r.firstVertex);join(q[0]-r.firstVertex,q[2]-r.firstVertex);}
 return new Set(parent.map((_,i)=>find(i))).size;
}
function volume(V,F){return F.reduce((s,f)=>s+f.slice(1,-1).reduce((n,b,i)=>n+C.dot(V[f[0]],C.cross(V[b],V[f[i+2]]))/6,0),0);}
function usedNormals(g,label){for(const i of new Set(g.idx.subarray(0,g.ni))){const n=Array.from(g.nor.subarray(i*3,i*3+3));assert.ok(n.every(Number.isFinite)&&n.some(v=>v!==0),`${label}: indexed GPU normal ${i}`);}}
function touches(A,B){
 const trianglePoints=T=>Array.from({length:T.length/9},(_,i)=>[0,1,2].map(j=>Array.from(T.subarray(i*9+j*3,i*9+j*3+3))));
 const crosses=(p,q,T)=>{const d=C.sub(q,p),L=C.len(d);if(L<1e-9)return false;const hit=C.rayTris(T,p,C.mul(d,1/L));return !!hit&&hit.t<=L+.01;};
 for(const[t,other]of [[trianglePoints(A),B],[trianglePoints(B),A]])for(const q of t)for(let i=0;i<3;i++)if(crosses(q[i],q[(i+1)%3],other))return true;
 return false;
}
function positiveConvexBoxOverlap(V,F,low,high){
 const basis=[[1,0,0],[0,1,0],[0,0,1]],axes=basis.slice(),box=[];
 for(const x of [low[0],high[0]])for(const y of [low[1],high[1]])for(const z of [low[2],high[2]])box.push([x,y,z]);
 for(const f of F){axes.push(C.cross(C.sub(V[f[1]],V[f[0]]),C.sub(V[f[2]],V[f[0]])));for(let i=0;i<f.length;i++){const edge=C.sub(V[f[(i+1)%f.length]],V[f[i]]);for(const b of basis)axes.push(C.cross(edge,b));}}
 for(const raw of axes){if(C.len(raw)<1e-9)continue;const n=C.norm(raw),A=V.map(p=>C.dot(p,n)),B=box.map(p=>C.dot(p,n));if(Math.min(Math.max(...A),Math.max(...B))-Math.max(Math.min(...A),Math.min(...B))<=.006)return false;}
 return true;
}
function volumeBelowYZero(V,F){
 const faces=[],cuts=new Map(),key=p=>p.map(x=>x.toFixed(8)).join(',');
 for(const face of F){const P=face.map(i=>V[i]),out=[];for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length],inside=a[1]<=0,next=b[1]<=0;if(inside)out.push(a);if(inside!==next){const t=-a[1]/(b[1]-a[1]),p=a.map((v,j)=>v+(b[j]-v)*t);p[1]=0;out.push(p);cuts.set(key(p),p);}}if(out.length>=3)faces.push(out);}
 if(cuts.size>=3){let cap=[...cuts.values()],center=C.mul(cap.reduce((s,p)=>C.add(s,p),[0,0,0]),1/cap.length);cap.sort((a,b)=>Math.atan2(a[2]-center[2],a[0]-center[0])-Math.atan2(b[2]-center[2],b[0]-center[0]));const winding=cap.reduce((s,p,i)=>s+C.cross(C.sub(p,center),C.sub(cap[(i+1)%cap.length],center))[1],0);if(winding<0)cap.reverse();faces.push(cap);}
 return Math.max(0,faces.reduce((sum,P)=>sum+P.slice(1,-1).reduce((v,p,i)=>v+C.dot(P[0],C.cross(p,P[i+2]))/6,0),0));
}

test('all nine capital weapons use their native physical models, requested barrel energies and real triangle budgets',()=>{
 assert.deepEqual(Array.from(C.CAPITAL_TURRET_KEYS).sort(),FAMILY.map(([k])=>k).sort());
 const ids=[];
 for(const[k,id,n,bolt,ion]of FAMILY){
  const{d,a,m}=model(k);ids.push(d.asset);assert.equal(d.asset,id);assert.equal(a.catalogKind,k);
  assert.equal(d.barrels,n);near(d.boltTT,bolt,1e-12);near(d.tt||0,ion?0:n*bolt,1e-12);near(d.ion||0,ion?n*bolt:0,1e-12);
  near(d.power*d.cycle/C.TT,n*bolt,1e-9);near(C.weaponModelScale(k),1,1e-12);assert.match(C.weaponSizing(k).calibration,/photo/);
  vector([d.fm,d.hm,d.wm],a.size,.001);assert.equal(a.noSupportPedestal,true);near(a.supportStandHeightM,0,1e-12);
  let raw=a;while(raw.dataFrom)raw=C.REFERENCE_ASSETS[raw.dataFrom];assert.ok(raw?.data);
  assert.equal(Buffer.from(raw.data,'base64').length,a.n*10+a.faces*3*a.indexBytes);assert.equal(m.pos.length,a.n*3);assert.equal(m.idx.length,a.faces*3);
  assert.ok(a.faces>0&&a.faces<=5000,`${k}: ${a.faces} actual fixed + moving triangles`);assert.ok(a.elevationIndexStart>=0&&a.elevationIndexStart<=m.idx.length&&a.elevationIndexStart%3===0);
  for(const i of m.idx)assert.ok(Number.isInteger(i)&&i>=0&&i<a.n);for(const x of m.pos)assert.ok(Number.isFinite(x));
  const geos=[G.meshFits({fits:[fit(k)]}),G.meshReferenceFits({fits:[fit(k)]})];assert.equal(geos.reduce((s,g)=>s+g.ni,0),drawAsset(k).faces*3,'no duplicate mesh or omitted moving assembly');
 }
 assert.equal(new Set(ids).size,9);
});

test('the four angular175TT front modules shrink in three dimensions against the independent0ef37aa baseline',()=>{
 assert.equal(FRONT_BASELINE.sourceCommit,'0ef37aaf3e9b85fe1eaa30552f57c99a7c4129bb');
 for(const k of ['ion','stl','triple175','quad175']){const{a,m}=model(k),original=FRONT_BASELINE.models[k],template=FRONT_BASELINE.models[k==='triple175'?'stl':k],actual=frontGroups(a,m);vector(a.elevationPivot,original.elevationPivotM,1e-9);near(a.frontBaseRevision.uniformFrontHardwareScale,.8,1e-12);
  for(const group of ['movingFront','completeFront','podShell']){const old=template.groups[group],own=original.groups[group],expected=old.boundsM.map((v,i)=>a.elevationPivot[i%3]+(v-a.elevationPivot[i%3])*.8);vector(actual[group].boundsM,expected,.02,k+' '+group+' actual affine reduction');for(let axis=0;axis<3;axis++)assert.ok(actual[group].sizeM[axis]<=own.sizeM[axis]*.8+.02,k+' front width/height/depth is reduced at least20%');}
 }
});

test('closed fixed side armor fills the complete socket gap on both sides with real clearance and case backing',()=>{
 const parents=JSON.parse(fs.readFileSync(path.join(root,'tests/helpers/capital-pre-bevel-hulls.json'),'utf8')).models,bowl=[],center=[6,3,0],ring=[];
 for(let level=0;level<8;level++){const a=level*Math.PI/16;ring.push(Array.from({length:32},(_,i)=>{const t=i*Math.PI/16;return[6+26.25*Math.cos(a)*Math.cos(t),13.65*Math.sin(a),22.5*Math.cos(a)*Math.sin(t)];}));}
 for(let level=0;level<8;level++)for(let i=0;i<32;i++){const A=ring[level][i],B=ring[level][(i+1)%32],D=level===7?[6,13.65,0]:ring[level+1][i];let n=C.norm(C.cross(C.sub(B,A),C.sub(D,A)));if(C.dot(n,C.sub(center,A))>0)n=C.mul(n,-1);bowl.push({normal:n,distanceM:C.dot(n,A)});}bowl.push({normal:[0,-1,0],distanceM:0});
 for(const k of ['ion','stl','triple175','quad175']){const{a,m}=model(k),base=FRONT_BASELINE.models[k==='triple175'?'stl':k],inner=base.oldSocket.halfWidthM*.8,meta=a.frontBaseRevision.sideCaseFill,fills=socketFills(a);assert.ok(meta&&fills.length>=2);near(meta.innerAbsZM,inner,.002);const original=k==='triple175'?'stl':k,planes=k==='ion'?bowl:[...parents[original].planes,...a.frontArmorBevel.clipPlanes],inside=(p,pad)=>planes.every(q=>q.distanceM-C.dot(q.normal,p)>pad*C.len(q.normal));
  const T=Float32Array.from(fills.flatMap(r=>Array.from(rangeTriangles(a,m,r)))),moving=bounds(points(a,m,{firstVertex:a.elevationVertexStart,vertices:a.n-a.elevationVertexStart}));near(a.elevationAxis[0],0,1e-12);near(a.elevationAxis[1],0,1e-12);near(Math.abs(a.elevationAxis[2]),1,1e-12);
  for(const r of fills){assert.equal(r.continuousSideArmor,true);assert.equal(r.addsCapacitorRoom,false);assert.notEqual(r.compartment,true);const P=points(a,m,r),B=bounds(P),sign=B[2]>0?1:-1;assert.ok(sign>0?B[2]>=inner-.008:B[5]<=-inner+.008,'fixed cheeks stay wholly outside the rotating assembly');for(const p of P)for(const q of planes)assert.ok(C.dot(q.normal,p)<=q.distanceM+.008*C.len(q.normal),'side armor is clipped inside the approved original case');const edges=new Map(),Q=rangeTriangles(a,m,r);for(let i=0;i<Q.length;i+=9){const v=[0,1,2].map(j=>Array.from(Q.subarray(i+j*3,i+j*3+3)).join(','));for(let j=0;j<3;j++){const e=[v[j],v[(j+1)%3]].sort().join('|');edges.set(e,(edges.get(e)||0)+1);}}assert.ok([...edges.values()].every(n=>n===2),'each actual side cheek is a closed rendered solid');assert.ok(!a.turretCompartment.convexes.some(c=>c.meshRange?.firstIndex===r.firstIndex&&c.meshRange?.indices===r.indices),'side armor cannot become charging-room capacity');}
  const front=Math.max(...a.caseFootprintVerticesM.map(p=>p[0])),rear=base.oldSocket.rearXM,top=a.closedRoof.nominalRoofYM;
  for(const sign of [-1,1]){const side=fills.flatMap(r=>points(a,m,r)).filter(p=>p[2]*sign>0),edge=sign>0?Math.min(...side.map(p=>p[2])):-Math.max(...side.map(p=>p[2])),clearance=edge-(sign>0?moving[5]:-moving[2]);assert.ok(clearance>.004&&clearance<.04,'the full moving geometry has a small real gap to both fixed cheeks');const sampled=[];
   for(let ix=0;ix<5;ix++)for(let iy=0;iy<5;iy++){const x=rear+(front-rear)*(.1+.2*ix),y=top*(.1+.2*iy),p=[x,y,sign*inner];if(!inside(p,.04))continue;const h=C.rayTris(T,[x,y,0],[0,0,sign]);assert.ok(h,'independent whole-gap grid rays hit continuous side structure');near(h.p[2],sign*inner,.008,'the actual backing starts at the reduced socket edge');assert.ok(C.dot(h.n,[0,0,-sign])>.999);sampled.push(p);}
   assert.ok(sampled.length>=10);assert.ok(spans(sampled)[0]>(front-rear)*.4&&spans(sampled)[1]>top*.5,'coverage spans the socket length and height, not only tiny bearing seats');
  }
 }
});

test('the triple175 asset is the exact complete twin mesh followed only by one centered full barrel',()=>{
 const A=model('stl'),B=model('triple175'),center=B.a.barrelCenters[2],hash=(v,n=v.length)=>crypto.createHash('sha256').update(Buffer.from(v.buffer,v.byteOffset,n*v.BYTES_PER_ELEMENT)).digest('hex');assert.equal(B.a.barrels,3);assert.equal(A.a.barrels,2);vector(B.a.c,A.a.c,1e-12);vector(B.a.size,A.a.size,1e-12);vector(B.a.mount,A.a.mount,1e-12);vector(B.a.elevationPivot,A.a.elevationPivot,1e-12);assert.equal(B.a.elevationIndexStart,A.a.elevationIndexStart);assert.equal(B.a.elevationVertexStart,A.a.elevationVertexStart);
 assert.equal(center.firstVertex,A.a.n);assert.equal(center.firstIndex,A.m.idx.length);assert.equal(B.a.n,A.a.n+center.vertices);assert.equal(B.m.idx.length,A.m.idx.length+center.indices);for(const key of ['pos','uv','idx'])assert.equal(hash(A.m[key]),hash(B.m[key],A.m[key].length),key+' twin body/roof/drives and outer two tubes remain an exact prefix');
 for(let i=0;i<2;i++)for(const key of ['root','muzzle','axis'])vector(B.a.barrelCenters[i][key],A.a.barrelCenters[i][key],1e-12);near(center.root[2],0,1e-12);near(center.muzzle[2],0,1e-12);vector(center.root.slice(0,2),A.a.barrelCenters[0].root.slice(0,2),1e-12);vector(center.muzzle.slice(0,2),A.a.barrelCenters[0].muzzle.slice(0,2),1e-12);assert.equal(crypto.createHash('sha256').update(JSON.stringify(A.a.turretCompartment)).digest('hex'),crypto.createHash('sha256').update(JSON.stringify(B.a.turretCompartment)).digest('hex'),'the exact shared base also has the same real charging cells');
});

test('angular720 and all four ball models preserve exact0ef37aa geometry, articulation and room metadata',()=>{
 for(const k of FRONT_BASELINE.unchangedKinds){const{a}=model(k),baseline=FRONT_BASELINE.models[k],physical={};let raw=a;while(raw.dataFrom)raw=C.REFERENCE_ASSETS[raw.dataFrom];assert.equal(crypto.createHash('sha256').update(Buffer.from(raw.data,'base64')).digest('hex'),baseline.packedGeometrySha256,k+' exact geometry and UV payload');for(const key of baseline.physicalMetadataKeys)physical[key]=a[key];assert.equal(crypto.createHash('sha256').update(JSON.stringify(physical)).digest('hex'),baseline.physicalMetadataSha256,k+' exact components, pivots, barrels and real room cells');}
});

test('twenty-five complete physical barrels have circular mouths, real recessed bores and distinct firing positions',()=>{
 let total=0;
 for(const[k,,n]of FAMILY){const{a,m}=model(k);assert.equal(a.barrelCenters.length,n);assert.equal(a.muzzlePoints.length,n);assert.equal(new Set(a.muzzlePoints.map(p=>p.join(','))).size,n);
  for(const r of a.barrelCenters){total++;assert.equal(connected(m,r),1,k+' connected complete tube');vector(r.axis,[1,0,0],1e-12);const P=points(a,m,r),b=bounds(P),T=rangeTriangles(a,m,r),[x,y,z]=r.muzzle;
   assert.ok(b[3]-b[0]>3*Math.max(b[4]-b[1],b[5]-b[2]),k+' barrel reach cannot be a decorative stub');
   const bore=C.rayTris(T,[x+1,y,z],[-1,0,0]),rim=C.rayTris(T,[x+1,y+(r.outerRadiusM+r.boreRadiusM)/2,z],[-1,0,0]);
   assert.ok(bore&&rim,k+' real bore floor and annular muzzle lip');near(rim.p[0],x);near(bore.p[0],x-r.muzzleRecessM);assert.ok(bore.t>rim.t+.01);
   const ring=P.filter(p=>Math.abs(p[0]-x)<.006&&Math.abs(Math.hypot(p[1]-y,p[2]-z)-r.outerRadiusM)<.01);assert.ok(new Set(ring.map(p=>Math.atan2(p[2]-z,p[1]-y).toFixed(3))).size>=12,k+' round budgeted muzzle');
  }
 }
 assert.equal(total,25);
});

test('capital models share draw, selection, muzzle and GPU normal frames on every mounting axis and sloped walls',()=>{
 const frames=[...Array.from({length:6},(_,a)=>({a,p:[1600,300,-600]})),{a:2,tilt:C.norm([.23,.91,-.34])}];
 for(const[k]of FAMILY){const{a}=model(k);for(const frame of frames){const f=fit(k,{...frame,assetYaw:37}),s={fits:[f]},geos=[G.meshFits(s),G.meshReferenceFits(s)],B=C.fitAABB(f),g=C.authoredTurretGeometry(f);assert.ok(g,k+' authored mechanical joint');assert.equal(geos.reduce((n,q)=>n+q.ni,0),drawAsset(k).faces*3);
  for(const q of geos){usedNormals(q,k);for(const i of q.idx.subarray(0,q.ni))for(let j=0;j<3;j++)assert.ok(q.pos[i*3+j]>=B[j]-.005&&q.pos[i*3+j]<=B[j+3]+.005,k+' visible vertices remain selectable');}
  const world=p=>C.referenceFitPoint(f,p.map((x,i)=>(x-a.c[i])/a.size[i]));vector(world(a.mount),C.fitOrigin(f),1e-6);
  for(const r of a.barrelCenters){const start=world(C.add(r.muzzle,[1,0,0])),end=world(C.sub(r.muzzle,[r.muzzleRecessM,0,0])),hit=G.rayFit(start,C.norm(C.sub(end,start)),f);assert.ok(hit,k+' rendered muzzle selectable');vector(hit.p,end,.012);}
  const pose=C.aimAuthoredTurret(g,.3,.4);assert.equal(pose.muzzles.length,a.barrels);assert.ok(C.len(C.sub(pose.muzzles[0],g.muzzles[0]))>.1);assert.equal(C.authoredTurretInArc(g,pose.fw),true);
 }}
});

test('fleet and editor previews use the same complete fixed and elevating capital geometry',()=>{
 for(const[k]of FAMILY){const{a}=model(k),s=C.newShip({assembly:true,L:200,W:150,H:100},'Capital partition test');s.parts=[];const f=fit(k);s.fits=[f];const fleet=G.fleetGeometry(s,{trial:true}),t=fleet.turrets.find(t=>t.id===f.id),g=C.authoredTurretGeometry(f),preview=G.meshPreview(s,[],[f]);assert.ok(t&&g);
  assert.equal(t.barrels,a.barrels);assert.equal(t.bodyMesh?fleet.meshes[t.bodyMesh].geo.ni:0,drawAsset(k).elevationIndexStart);assert.equal(fleet.meshes[t.mesh].geo.ni,drawAsset(k).faces*3-drawAsset(k).elevationIndexStart);
  for(const name of [t.bodyMesh,t.mesh].filter(Boolean))usedNormals(fleet.meshes[name].geo,k+' '+name);
  assert.equal(preview.previewFits.ni+preview.previewRefFits.ni,drawAsset(k).faces*3);vector(t.pivot,g.elevationPivot,1e-6);vector(t.bodyPivot||g.yawPivot,g.yawPivot,1e-6);
 }
});

test('only closed real gunhouse cells contribute capital charging volume, never the empty barrel envelope',()=>{
 for(const[k]of FAMILY){const{a,m}=model(k);let total=0;assert.ok(a.turretCompartment.convexes.length>0);
  for(const cell of a.turretCompartment.convexes){const V=cell.verticesM,F=cell.faces,edges=new Map();assert.ok(V.length>=4&&F.length>=4);
   for(const f of F){const[ia,ib,ic]=f,N=C.norm(C.cross(C.sub(V[ib],V[ia]),C.sub(V[ic],V[ia])));for(const p of V)assert.ok(C.dot(N,C.sub(p,V[ia]))<.004,k+' convex room');for(let i=0;i<f.length;i++){const e=[f[i],f[(i+1)%f.length]].sort((a,b)=>a-b).join(',');edges.set(e,(edges.get(e)||0)+1);}}
   assert.ok([...edges.values()].every(n=>n===2),k+' watertight room cell');const v=volume(V,F);assert.ok(v>0);near(v,cell.volumeM3,Math.max(.02,v*.001));total+=v;
   if(cell.meshRange){const R=cell.meshRange,rv=[],rf=[];assert.ok(R.indices>0&&R.firstIndex+R.indices<=m.idx.length);for(let i=R.firstIndex;i<R.firstIndex+R.indices;i+=3){rf.push([rv.length,rv.length+1,rv.length+2]);rv.push(...Array.from(m.idx.subarray(i,i+3),j=>point(a,m,j)));}near(volume(rv,rf),v,Math.max(.05,v*.004));}
   else{const source=cell.sourceMeshRange||cell.sourceSphereMeshRange;assert.ok(cell.conservative&&source,k+' source-derived closure must identify a real visible body');const T=rangeTriangles(a,m,source),center=C.mul(V.reduce((s,p)=>C.add(s,p),[0,0,0]),1/V.length);assert.ok(C.rayTris(T,center,[0,1,0]));assert.ok(C.rayTris(T,center,[0,-1,0]));}
  }
  near(total,a.turretCompartment.volumeM3,Math.max(.02,total*.001));assert.ok(total<a.size.reduce((v,n)=>v*n,1)*.85,k+' barrel reach and air are not capacitor space');
 }
});

test('all four capital balls share one closed sphere embedded by one third and aim the whole house',()=>{
 let reference,roomReference;
 for(const k of BALLS){const{a,m}=model(k),R=a.sphereRadiusM,center=a.sphereCenterM;assert.ok(R>0);vector(a.size,[44.5,36,36],.001);vector(spans(points(a,m)),[44.5,36,36]);vector(center,a.elevationPivot,1e-9);assert.equal(a.gunhouseElevates,true);assert.equal(a.elevationIndexStart,0);assert.equal(a.elevationVertexStart,0);
  const caliber=k==='ball720'?1.5:1,ion=k.endsWith('Ion');for(const r of a.barrelCenters){near(r.muzzle[0],26.5,.001);near(spans(points(a,m,r))[0],26.25*caliber,.008,'balls retain the same complete tube as the angular gun, with its hidden root inside');near(r.shaftRadiusM,.825*caliber*(ion?1.25:1),.001);}
  const skin=a.sphereMeshRange;assert.ok(skin);const V=points(a,m,skin),F=[];for(let i=skin.firstIndex;i<skin.firstIndex+skin.indices;i+=3)F.push(Array.from(m.idx.subarray(i,i+3),j=>j-skin.firstVertex));const b=bounds(V),gross=volume(V,F);near(-b[1]/(b[4]-b[1]),1/3,.003);for(const p of V)near(C.len(C.sub(p,center)),R,.008);near(gross,a.grossSphereVolumeM3,Math.max(.1,gross*.002));near(volumeBelowYZero(V,F)/gross,7/27,.017);
  const shape={radius:R,center:plain(center),vertices:plain(V),faces:plain(F)};if(reference)assert.deepEqual(shape,reference,'one physical ball case serves all four requested gun arrangements');else reference=shape;
  const reserve=a.reservedMachineryAabbM;assert.ok(reserve);vector(reserve.lowM,[-13.025,-2.25,-8.25],.001);vector(reserve.highM,[18.15,14.25,8.25],.001);let embedded=0;for(const cell of a.turretCompartment.convexes){assert.ok(!positiveConvexBoxOverlap(cell.verticesM,cell.faces,reserve.lowM,reserve.highM),'available charging cells exclude the full shared internal machinery corridor');embedded+=volumeBelowYZero(cell.verticesM,cell.faces);}
  const rooms={cells:plain(a.turretCompartment.convexes),volume:a.turretCompartment.volumeM3};if(roomReference)assert.deepEqual(rooms,roomReference,'all four balls use the same conservative machinery reservation');else roomReference=rooms;assert.ok(rooms.volume<gross*.9&&rooms.volume>gross*.5,'only available case volume is credited');
  for(const r of a.components.filter(r=>r.firstIndex>=skin.firstIndex+skin.indices))for(const p of points(a,m,r))if(C.len(C.sub(p,center))<R-.01)for(let j=0;j<3;j++)assert.ok(p[j]>=reserve.lowM[j]-.006&&p[j]<=reserve.highM[j]+.006,'actual internal mechanism vertices stay inside the reserved corridor');
  const s=C.newShip({assembly:true,L:200,W:180,H:100},'Embedded capital ball');s.parts=[];s.fits=[];C.placePart(s,'struct',[100,-40,0],[180,170,80],{form:'box'},false);const f=fit(k,{p:[100,0,0],assetYaw:0});s.fits=[f];const q=C.turretCompartmentProjection(s,f);assert.ok(q.externalVolume>0&&q.embeddedVolume>0);near(q.housingVolume,rooms.volume,Math.max(.1,rooms.volume*.003));near(q.embeddedVolume,embedded,Math.max(.1,embedded*.004));near(q.externalVolume,q.housingVolume-embedded,Math.max(.1,rooms.volume*.004));
 }
});

test('the reduced175TT cradles retain their case envelope and the triple uses the narrow twin base',()=>{
 const rows=['ion','stl','triple175','quad175'].map(k=>({k,...model(k)}));
 for(const{a,m,k}of rows){vector(a.size,[60,16.425,45],.001);vector(spans(points(a,m)),[60,16.425,45]);assert.ok(a.caseMaximumWidthXM>0,'maximum width is ahead of the footprint midpoint');near(a.mount[0],a.caseMaximumWidthXM,.001);}
 const widths=[];
 for(const[k,expectedWidth,expectedRowSpan]of [['stl',14.4,7.6],['triple175',14.4,7.6],['quad175',27,17.1]]){const{a,m}=model(k),P=points(a,m,a.frontPod.podMeshRange),B=bounds(P),width=B[5]-B[2];near(width,a.frontPod.widthM);near(width,expectedWidth);widths.push(width);
  const centers=a.barrelCenters.map(r=>{const b=bounds(points(a,m,r));return(b[2]+b[5])/2;});near(Math.max(...centers)-Math.min(...centers),expectedRowSpan,.008,'actual gun rows retain the wider reference spacing');
  const footprint=a.caseFootprintVerticesM;assert.ok(footprint.length>=6);const front=Math.max(...footprint.map(p=>p[0])),frontWidth=Math.max(...footprint.filter(p=>Math.abs(p[0]-front)<.001).map(p=>p[2]))-Math.min(...footprint.filter(p=>Math.abs(p[0]-front)<.001).map(p=>p[2]));
  near(frontWidth,a.caseFrontWidthM);assert.ok(frontWidth>width,'the unchanged case shoulders surround the reduced cradle');
  const fixed=a.fixedCaseMeshRanges.flatMap(r=>points(a,m,r));for(const p of footprint)assert.ok(fixed.some(q=>Math.hypot(p[0]-q[0],p[2]-q[2])<.012),'authored footprint corners belong to real visible fixed armor');
 }
 near(widths[0],widths[1],.001);assert.ok(widths[1]<widths[2]);
 for(const k of ['ion','stl','triple175']){const{a,m}=model(k),used=new Set();for(let i=a.elevationIndexStart;i<m.idx.length;i++)if(!a.barrelCenters.some(r=>i>=r.firstIndex&&i<r.firstIndex+r.indices))used.add(m.idx[i]);assert.ok(used.size);const P=Array.from(used,i=>point(a,m,i));assert.ok(spans(P)[2]<=a.size[2]/2+.01,'the complete narrow mechanism including both drives fits within half the case width');near(spans(points(a,m,a.frontPod.podMeshRange))[2],14.4,.008);const Z=a.barrelCenters.map(r=>{const b=bounds(points(a,m,r));return(b[2]+b[5])/2;});near(Math.max(...Z)-Math.min(...Z),7.6,.008);}
 const original=model('triple70'),old=spans(points(original.a,original.m,original.a.frontPod.movingMeshRange))[2]/original.a.size[2];near(widths[2]/(model('quad175').a.size[2]*.8),old,.005,'the four-gun cradle is reduced20% from its approved70TT-derived proportion');
 const twin=model('stl'),heavy=model('utl'),large=heavy.a;vector(large.size,[90,24.75,67.5],.001);vector(large.size,FRONT_BASELINE.models.stl.sizeM.map(v=>v*1.5),.001);
 for(const r of large.barrelCenters){near(spans(points(large,heavy.m,r))[0],39.375,.012,'actual 720TT tube is the uniformly enlarged 175TT tube');near(r.shaftRadiusM,1.2375,.001);}
 const oct=model('oct40'),octSize=spans(points(oct.a,oct.m)),houseSize=spans(twin.a.fixedCaseMeshRanges.flatMap(r=>points(twin.a,twin.m,r)));
 for(const axis of [0,2])assert.ok(houseSize[axis]>octSize[axis],`the actual angular 175TT twin house exceeds the 40TT octuple on plan axis ${axis}, before barrel reach`);
 for(const{k,a,m}of rows)for(const r of a.barrelCenters){near(r.muzzle[0]-r.root[0],26.25,.001,k+' complete 175TT barrel');near(spans(points(a,m,r))[0],26.25,.008,k+' actual rendered tube reach');near(r.shaftRadiusM,.825*(k==='ion'?1.25:1),.001,k+' calibrated tip shaft radius');}
});

test('capital ion tubes physically taper from fat roots to tips thicker than matching TL shanks',()=>{
 const radius=(M,r,x)=>{const T=rangeTriangles(M.a,M.m,r),y=r.root[1],z=r.root[2],h=C.rayTris(T,[x,y+10*(r.rootShaftRadiusM||r.shaftRadiusM),z],[0,-1,0]);assert.ok(h,'cross-section ray hits the actual closed outer tube');return h.p[1]-y;},at=(r,f)=>r.root[0]+(r.muzzle[0]-r.root[0])*f;
 for(const[ionKind,laserKind]of [['ion','stl'],['ball175TripleIon','ball175Quad'],['ball175QuadIon','ball175Quad']]){
  const I=model(ionKind),L=model(laserKind),reference=L.a.barrelCenters[0],laserRadius=radius(L,reference,at(reference,.5));near(laserRadius,.825,.004);assert.ok(radius(L,reference,at(reference,.15))>radius(L,reference,at(reference,.55))*1.5,'the TL breech narrows into its long shank');
  for(const r of I.a.barrelCenters){assert.equal(r.barrelStyle,'thick-taper-ion-tube');near(r.rootShaftRadiusM,laserRadius*2.2,.006);near(r.shaftRadiusM,laserRadius*1.25,.006);assert.ok(r.taperStartXM>=r.root[0]&&r.taperEndXM<r.muzzle[0]&&r.taperEndXM>r.taperStartXM);let previous=Infinity;
   for(const f of [.02,.35,.65,.98]){const x=r.taperStartXM+(r.taperEndXM-r.taperStartXM)*f,q=radius(I,r,x),expected=laserRadius*(2.2*(1-f)+1.25*f);near(q,expected,.008,ionKind+' actual exposed taper');assert.ok(q<previous,'the exposed ion shaft narrows monotonically toward its muzzle');previous=q;}
   near(radius(I,r,r.taperEndXM-.01),laserRadius*1.25,.006,'the narrow ion tip remains thicker than the matching TL shank');
  }
 }
});

test('actual forward bearing triangles connect each capital pod to its fixed case throughout the common elevation range',()=>{
 for(const k of ['ion','stl','triple175','quad175','utl']){const{a,m}=model(k),components=a.components,labels=a.frontConnection;assert.ok(labels?.fixedAxleLabels.length===2&&labels.movingWheelLabels.length===2);
  const armorT=Float32Array.from(caseRanges(a,false).flatMap(r=>Array.from(rangeTriangles(a,m,r)))),fills=socketFills(a).map(r=>({r,T:rangeTriangles(a,m,r)})),anchored=new Set();let changed=true;while(changed){changed=false;for(let j=0;j<fills.length;j++)if(!anchored.has(j)&&(touches(armorT,fills[j].T)||[...anchored].some(i=>touches(fills[i].T,fills[j].T)))){anchored.add(j);changed=true;}}assert.equal(anchored.size,fills.length,k+' actual socket fills connect to original case armor');for(const{r}of fills)assert.equal(r.addsCapacitorRoom,false);
  const caseT=Float32Array.from([...armorT,...fills.flatMap(q=>Array.from(q.T))]);
  for(let i=0;i<2;i++){const fixed=components.find(r=>r.label===labels.fixedAxleLabels[i]),moving=components.find(r=>r.label===labels.movingWheelLabels[i]);assert.ok(fixed&&moving);assert.ok(fixed.firstIndex+fixed.indices<=a.elevationIndexStart);assert.ok(moving.firstIndex>=a.elevationIndexStart);const axle=rangeTriangles(a,m,fixed);assert.ok(touches(axle,rangeTriangles(a,m,moving)),k+' real fixed axle engages the actual moving wheel, rather than an AABB');const support=labels.fixedStanchionLabels?.[i]&&components.find(r=>r.label===labels.fixedStanchionLabels[i]);if(support){const T=rangeTriangles(a,m,support);assert.ok(touches(caseT,T)&&touches(T,axle),k+' fixed support joins both case and axle');}else assert.ok(touches(caseT,axle),k+' actual case triangles connect the axle to the gunhouse');}
  const cells=a.turretCompartment.convexes.filter(p=>!p.movesWithGun).map(p=>p.faces.map(([ia,ib,ic])=>({p:p.verticesM[ia],n:C.norm(C.cross(C.sub(p.verticesM[ib],p.verticesM[ia]),C.sub(p.verticesM[ic],p.verticesM[ia])))})));
  for(const{r,T}of fills){const planes=[];for(let i=0;i<T.length;i+=9){const p=Array.from(T.subarray(i,i+3)),n=C.norm(C.cross(C.sub(Array.from(T.subarray(i+3,i+6)),p),C.sub(Array.from(T.subarray(i+6,i+9)),p)));planes.push({p,n});}for(const p of points(a,m,r))assert.ok(planes.every(q=>C.dot(q.n,C.sub(p,q.p))<=.008),'socket fill is an actual closed convex body');cells.push(planes);}
  const g=C.authoredTurretGeometry(fit(k,{p:[0,0,0],assetYaw:0}));
  for(const degrees of [-10,0,25,55,85]){const pose=C.aimAuthoredTurret(g,0,degrees*Math.PI/180);assert.ok(C.authoredTurretInArc(g,pose.fw));for(let i=a.elevationVertexStart;i<a.n;i++){const p=C.sub(point(a,m,i),a.elevationPivot),R=pose.rotation,q=C.add(a.elevationPivot,[R[0]*p[0]+R[3]*p[1]+R[6]*p[2],R[1]*p[0]+R[4]*p[1]+R[7]*p[2],R[2]*p[0]+R[5]*p[1]+R[8]*p[2]]);assert.ok(!cells.some(cell=>cell.every(f=>C.dot(f.n,C.sub(q,f.p))<-.005)),`${k}: moving front mechanism enters fixed closed armor at ${degrees}°`);}}
 }
});

test('capital machinery sits over a real closed roof, with raised vent geometry and reserved internal equipment volume',()=>{
 for(const k of ['ion','stl','triple175','quad175','utl']){const{a,m}=model(k),scale=a.size[0]/60,roof=a.closedRoof,reserve=a.interiorEquipmentReservation;assert.ok(roof?.closedArmoredDeck&&roof.meshRanges.length);assert.equal(roof.addsCapacitorRoom,false);assert.ok(reserve?.coveredByActualArmoredRoof&&reserve.excludedFromCapacitorRoom);
  const T=Float32Array.from(roof.meshRanges.flatMap(r=>{assert.ok(r.firstIndex+r.indices<=a.elevationIndexStart);return Array.from(rangeTriangles(a,m,r));}));
  const X=(k==='ion'?[-6,-4.5,-3]:[-10.5,-4.5,1.5]).map(v=>v*scale),Z=(k==='ion'?[-2.7,0,2.7]:[-5.4,0,5.4]).map(v=>v*scale);
  for(const x of X)for(const z of Z){const h=C.rayTris(T,[x,a.size[1]+10*scale,z],[0,-1,0]);assert.ok(h&&h.p[1]>a.size[1]*(k==='ion'?.69:.72),'independent roof-grid rays hit actual high armor rather than a recessed floor');}
  for(const p of roof.coverageSamplesM){const h=C.rayTris(T,[p[0],a.size[1]+10*scale,p[2]],[0,-1,0]);assert.ok(h);near(h.p[1],p[1],.02*scale);}
  for(const cell of a.turretCompartment.convexes)assert.ok(!positiveConvexBoxOverlap(cell.verticesM,cell.faces,reserve.lowM,reserve.highM),'reserved machinery below the opaque roof is not charging room');
  const mech=a.exposedMechanisms;assert.ok(mech?.assemblyMeshRange);if(k==='ion'){assert.equal(mech.rearVentDrums.length,0);assert.equal(mech.ionLowReceiverCoverRanges.length,2);for(const r of mech.ionLowReceiverCoverRanges){const S=spans(points(a,m,r));assert.ok(S[0]>S[2]*1.5&&S[1]<a.size[1]*.25,'the oval ion uses actual low longitudinal covers');}continue;}
  assert.equal(mech.rearVentDrums.length,2);const fixed=rangeTriangles(a,m,{firstIndex:0,indices:a.elevationIndexStart});
  for(const drum of mech.rearVentDrums){vector(drum.axis,[0,1,0],1e-12);const P=points(a,m,drum),B=bounds(P);near(B[1],drum.bottomYM,.01);near(B[4],drum.topYM,.01);for(const axis of [0,2])assert.ok(B[axis+3]-B[axis]>=2*drum.radiusM*Math.cos(Math.PI/12)-.015&&B[axis+3]-B[axis]<=2*drum.radiusM+.015,'round polygon bounds respect the actual radial sampling');
   for(const y of [drum.bottomYM,drum.topYM]){const ring=P.filter(p=>Math.abs(p[1]-y)<.008),radii=ring.map(p=>Math.hypot(p[0]-drum.centerM[0],p[2]-drum.centerM[2]));assert.ok(radii.length&&Math.max(...radii)-Math.min(...radii)<.01,'each end of the capped frustum is a real circle');assert.ok(Math.min(...radii)>drum.radiusM*.7);const angles=[...new Set(ring.map(p=>+Math.atan2(p[2]-drum.centerM[2],p[0]-drum.centerM[0]).toFixed(3)))].sort((a,b)=>a-b);assert.ok(angles.length>=12&&angles.every((v,i)=>(angles[(i+1)%angles.length]+(i===angles.length-1?2*Math.PI:0))-v<2*Math.PI/12+.01),'rear ventilation housings have evenly distributed round sections at both ends');}
   const slats=mech.rearVentSlatRanges.map(r=>({r,B:bounds(points(a,m,r))})).filter(({B})=>Math.abs((B[2]+B[5])/2-drum.centerM[2])<drum.radiusM).sort((p,q)=>(p.B[2]+p.B[5])-(q.B[2]+q.B[5]));assert.ok(slats.length>=4,'each rear round vent carries several raised slots');
   for(const{B}of slats){assert.ok(B[1]<=drum.topYM+.01&&B[4]>drum.topYM+a.size[1]*.015);const x=(B[0]+B[3])/2,z=(B[2]+B[5])/2,h=C.rayTris(fixed,[x,a.size[1]+10*scale,z],[0,-1,0]);assert.ok(h);near(h.p[1],B[4],.02*scale,'raised slats exist in the visible fixed geometry');}
   const p=slats[1].B,q=slats[2].B,gap=(p[5]+q[2])/2,h=C.rayTris(fixed,[drum.centerM[0],a.size[1]+10*scale,gap],[0,-1,0]);assert.ok(h);near(h.p[1],drum.topYM,.02*scale,'the gaps between raised slats expose the lower real vent face');
  }
 }
});

test('all four angular houses retain their lower skirts while the front and both upper cheeks form real oblique armor planes',()=>{
 const file='assets/source/capital-turret-front-bevel-reference.json',raw=fs.readFileSync(path.join(root,file)),ref=JSON.parse(raw),refSha=crypto.createHash('sha256').update(raw).digest('hex');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,ref.image.path))).digest('hex'),ref.image.sha256);assert.deepEqual(ref.scope,['stl','triple175','quad175','utl']);
 const parents=JSON.parse(fs.readFileSync(path.join(root,'tests/helpers/capital-pre-bevel-hulls.json'),'utf8')).models,podWidths={stl:12,triple175:12,quad175:22.5,utl:12};
 const knee=ref.prototypeSideSectionM.lowerFrontKnee,roof=ref.prototypeSideSectionM.upperFrontRoof,k=(knee[0]-roof[0])/(roof[1]-knee[1]);near(knee[0],13.5,1e-12);near(knee[1],3,1e-12);near(roof[0],6.75,1e-12);near(roof[1],8.6,1e-12);
 for(const kind of ref.scope){const{a,m}=model(kind),S=a.size[0]/40,meta=a.frontArmorBevel;assert.ok(meta?.clipPlanes.length===3);assert.equal(meta.referenceFile,file);assert.equal(meta.referenceSha256,refSha);assert.equal(meta.imageSha256,ref.image.sha256);vector(meta.kneeM,knee.map(v=>v*S),.001);vector(meta.roofM,roof.map(v=>v*S),.001);near(meta.roofRetreatM,(knee[0]-roof[0])*S,.001);near(meta.lowerSkirtHeightM,knee[1]*S,.001);assert.ok(meta.meshRanges.length);for(const r of meta.meshRanges)assert.ok(r.firstIndex+r.indices<=a.elevationIndexStart);
  const front=Math.max(...a.caseFootprintVerticesM.map(p=>p[0])),nose=podWidths[kind]/2+1.4,half=15,station=4,side=(half-nose)/(knee[0]-station),up=side*k+.3/(roof[1]-knee[1]);near(a.caseMaximumWidthXM,station*S,.001);near(a.caseFrontWidthM,2*nose*S,.001);
  const expected=[{normal:[1,k,0],distanceM:(knee[0]+knee[1]*k)*S},{normal:[side,up,1],distanceM:(half+station*side+knee[1]*up)*S},{normal:[side,up,-1],distanceM:(half+station*side+knee[1]*up)*S}];
  const ranges=caseRanges(a),P=ranges.flatMap(r=>points(a,m,r)),T=Float32Array.from(ranges.flatMap(r=>Array.from(rangeTriangles(a,m,r))));
  const footprint=[[-13.5,0,-9.8],[4,0,-15],[13.5,0,-nose],[13.5,0,nose],[4,0,15],[-13.5,0,9.8]].map(p=>p.map(v=>v*S));assert.equal(a.caseFootprintVerticesM.length,6);for(const p of footprint){assert.ok(a.caseFootprintVerticesM.some(q=>C.len(C.sub(p,q))<.001),'the original six lower footprint corners remain authored');assert.ok(P.some(q=>C.len(C.sub(p,q))<.015),'the retained lower skirt belongs to actual rendered geometry');}
  const parent=parents[kind==='triple175'?'stl':kind],parentScale=parent.uniformScale||1,parentPlanes=parent.scaledFrom?parents[parent.scaledFrom].planes:parent.planes,contained=[...P,...a.turretCompartment.convexes.filter(c=>!c.movesWithGun).flatMap(c=>c.verticesM)];for(const plane of parentPlanes)for(const p of contained)assert.ok(C.dot(plane.normal,p)<=plane.distanceM*parentScale+.015*parentScale,'post-bevel case, roof and fixed room cells remain inside the independently captured original hull');
  const parentLimit=(axis,sign,other)=>Math.min(...parentPlanes.filter(p=>p.normal[axis]*sign>1e-6).map(p=>(p.distanceM*parentScale-p.normal.reduce((q,v,j)=>q+(j===axis?0:v*other[j]),0))/(p.normal[axis]*sign)));
  for(let j=0;j<expected.length;j++){const p=meta.clipPlanes[j],e=expected[j];vector(C.norm(p.normal),C.norm(e.normal),1e-7);near(p.distanceM/C.len(p.normal),e.distanceM/C.len(e.normal),.001);const n=C.norm(p.normal),D=p.distanceM/C.len(p.normal);for(const v of P)assert.ok(C.dot(n,v)<=D+.012,'actual case and roof stay behind every sloped armor plane');let area=0,on=[];
   for(let i=0;i<T.length;i+=9){const q=[0,1,2].map(b=>Array.from(T.subarray(i+b*3,i+b*3+3)));if(!q.every(v=>Math.abs(C.dot(n,v)-D)<.012))continue;const N=C.cross(C.sub(q[1],q[0]),C.sub(q[2],q[0]));if(C.dot(C.norm(N),n)<=.995)continue;area+=C.len(N)/2;on.push(...q);}
   assert.ok(area>2*S*S&&spans(on)[1]>2*S,'each of the three oblique faces has actual armor area and height');
  }
  // Probe clear of the recoil opening and just below the quantized roof seam.
  const lowY=knee[1]*S*.5,highY=(roof[1]-.01)*S;
  for(const sign of [-1,1]){const z=sign*(nose-.4)*S,cast=y=>C.rayTris(T,[front+20*S,y,z],[-1,0,0]),low=cast(lowY),high=cast(highY);assert.ok(low&&high);near(low.p[0],parentLimit(0,1,[0,lowY,z]),.02,'the lower front keeps its original slight slope');const roofX=high.p[0]-k*.01*S;near(roofX,roof[0]*S,.02,'the measured upper plane retreats to the roof landmark');near(front-roofX,6.75*S,.03);
   const x=(station+2)*S,castSide=y=>C.rayTris(T,[x,y,sign*(a.size[2]+20*S)],[0,0,-sign]),lower=castSide(lowY),upper=castSide(highY);assert.ok(lower&&upper);const upperZ=(half+station*side-side*(station+2)+knee[1]*up-up*(roof[1]-.01))*S;near(Math.abs(lower.p[2]),parentLimit(2,sign,[x,lowY,0]),.025);near(Math.abs(upper.p[2]),upperZ,.025,'both adjacent cheeks lean inward at roof height');assert.ok(Math.abs(lower.p[2])-Math.abs(upper.p[2])>S);
   for(const fraction of [.2,.4,.6,.8,.97]){const y=(knee[1]+(roof[1]-knee[1])*fraction)*S,F=cast(y),Ck=castSide(y);assert.ok(F&&Ck);near(F.p[0],expected[0].distanceM-k*y,.025,'front samples lie on one consistent oblique face');near(Math.abs(Ck.p[2]),expected[1].distanceM-side*x-up*y,.025,'cheek samples lie on their consistent oblique face');assert.ok(C.dot(F.n,C.norm(expected[0].normal))>.9995);assert.ok(C.dot(Ck.n,C.norm(expected[sign>0?1:2].normal))>.9995,'actual armor normals agree across each planar cheek');}
  }
 }
});

test('the flattened IS-style twin uses true ellipsoid lighting on curved armor and preserves hard caps',()=>{
 const{a,m}=model('ion'),curves=a.components.filter(p=>p.normalMode==='ellipsoid');assert.ok(curves.length>0);assert.equal(a.caseStyle,'flattened-is-cast-bowl');assert.equal(model('stl').a.caseStyle,'forward-wide-naval-hexagon');
 const bowl=spans(a.fixedCaseMeshRanges.flatMap(r=>points(a,m,r))),laser=model('stl');assert.ok(bowl[0]>bowl[2]*1.1,'the actual ion case is a front-to-back oval');for(const r of curves)assert.ok(r.normalRadiiM[0]>r.normalRadiiM[2]*1.1,'longitudinal ellipsoid radii preserve the oval casting');
 const ionFore=bounds(points(a,m,a.frontPod.podMeshRange))[3]-a.mount[0],laserFore=bounds(points(laser.a,laser.m,laser.a.frontPod.podMeshRange))[3]-laser.a.mount[0];near(ionFore-laserFore,1.65,.015,'the real ion gun pod projects farther ahead of its traverse center');
 const draw=G.turretRenderAsset(C.FITS.ion.asset),drawCurves=draw.asset.components.filter(p=>p.normalMode==='ellipsoid'),marked=new Set(drawCurves.flatMap(r=>Array.from({length:r.vertices},(_,i)=>r.firstVertex+i))),modes=drawCurves.map(r=>r.normalMode);
 for(const frame of [{a:2,p:[0,0,0],assetYaw:0},{a:5,p:[300,50,-200],assetYaw:37},{a:2,p:[100,30,20],tilt:C.norm([.23,.91,-.34]),assetYaw:23}]){
  let flat;
  try{for(const p of drawCurves)delete p.normalMode;flat=G.meshReferenceFits({fits:[fit('ion',frame)]});}
  finally{drawCurves.forEach((p,i)=>p.normalMode=modes[i]);}
  const f=fit('ion',frame),smooth=G.meshReferenceFits({fits:[f]});assert.equal(smooth.n,draw.asset.n);assert.equal(flat.n,draw.asset.n);
  for(const k of ['pos','uv','col','idx']){const n=k==='idx'?smooth.ni:smooth.n*(k==='col'?4:k==='uv'?2:3);assert.deepEqual(Array.from(smooth[k].subarray(0,n)),Array.from(flat[k].subarray(0,n)),k+' remains unchanged by analytic shading');}
  const nativeToWorld=p=>C.referenceFitPoint(f,p.map((v,i)=>(v-a.c[i])/a.size[i]));let changed=0,hard=0;
  for(let i=0;i<draw.asset.n;i++){const n=Array.from(smooth.nor.subarray(i*3,i*3+3));if(!marked.has(i)){assert.deepEqual(n,Array.from(flat.nor.subarray(i*3,i*3+3)),'unmarked armor cuts remain flat');hard++;continue;}
   const r=drawCurves.find(r=>i>=r.firstVertex&&i<r.firstVertex+r.vertices),p=point(a,draw.mesh,i),normal=r.normalCenterM.map((c,j)=>(p[j]-c)/(r.normalRadiiM[j]**2)),worldNormal=C.norm(C.sub(nativeToWorld(C.add(r.normalCenterM,normal)),nativeToWorld(r.normalCenterM)));
   near(r.normalCenterM.reduce((q,c,j)=>q+((p[j]-c)/r.normalRadiiM[j])**2,0),1,.025,'only actual faceted ellipsoid skin receives analytic normals');assert.ok(C.dot(C.norm(n),worldNormal)>.9998,'cast armor follows the ellipsoid gradient');if(n.some((v,j)=>v!==flat.nor[i*3+j]))changed++;
  }
  assert.ok(changed>20&&hard>20,'curved casting and distinct hard armor cuts are both present');
 }
});

test('independent photo anchors retain measured station intervals and locally scaled ball diameters',()=>{
 const photo=JSON.parse(fs.readFileSync(path.join(root,'assets/source/capital-turret-photo-measurements.json'),'utf8')),anchor=photo.anchor;
 near(anchor.metres,40,1e-12);near(model('oct40').a.size[0],anchor.metres,.001);near(Math.hypot(...anchor.pixelEndpoints[0].map((v,i)=>v-anchor.pixelEndpoints[1][i])),anchor.pixelSpan,1e-9);near(anchor.metres/anchor.pixelSpan,anchor.metresPerPixel,1e-12);
 for(const row of photo.sourceFiles)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,row.path))).digest('hex'),row.sha256,'independent source photograph stays immutable');
 const station=photo.angularAnchor,pitches=station.stationCentersPixels.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-station.stationCentersPixels[i][j])));near(station.nativeStationPitchM,62.36,1e-12);near(pitches.reduce((s,n)=>s+n,0)/pitches.length,station.meanPixelPitch,1e-9);near(station.nativeStationPitchM/station.meanPixelPitch,station.metresPerPixelAlongBattery,1e-12);
 station.nativeStationXCoordinatesM.slice(1).forEach((x,i)=>near(x-station.nativeStationXCoordinatesM[i],station.nativeStationPitchM,1e-9));
 // Photo2 has no recovered camera/depth coefficient. Keep its projected
 // observations as intervals; actual model dimensions/shape are tested above.
 const stationIntervals=[];let diameterComparisons=0,superseded=0;
 for(const[k]of FAMILY){const{a,m}=model(k);for(const feature of photo.models[k].features){let actual,scale,readUncertainty;
   if(feature.measurementUse==='qualitativeOnlySupersededAngularAbsoluteScale'){assert.equal(feature.targetProjectedMetres,undefined);assert.ok(feature.reason);superseded++;continue;}
   if(feature.measurementUse==='localPhoto1BallDiameter'){assert.equal(feature.name,'sphere');actual=a.sphereRadiusM*2;scale=anchor.metresPerPixel;readUncertainty=anchor.pixelUncertainty;diameterComparisons++;}
   else if(feature.measurementUse==='stationRelativeProjected'){
    assert.equal(k,'stl');assert.equal(feature.name,'mountedCaseAndPod');const delta=feature.pixelEndpoints[1].map((v,i)=>v-feature.pixelEndpoints[0][i]);near(Math.abs(delta.reduce((q,v,i)=>q+v*station.batteryAxisUnitImage[i],0)),feature.pixelSpan,1e-9);
    scale=station.metresPerPixelAlongBattery;readUncertainty=station.stationCenterUncertaintyPx;
   }else assert.fail('unhandled independent measurement use '+feature.measurementUse);
   const expected=feature.pixelSpan*scale,tolerance=expected*feature.relativeTolerance+(feature.pixelUncertainty+readUncertainty)*scale;near(expected,feature.targetProjectedMetres,1e-9);if(actual!==undefined)near(actual,expected,tolerance,k+' '+feature.name+' independently measured diameter');else stationIntervals.push([expected-tolerance,expected+tolerance]);
  }}
 assert.equal(diameterComparisons,4);assert.equal(stationIntervals.length,2);assert.ok(Math.max(...stationIntervals.map(p=>p[0]))<=Math.min(...stationIntervals.map(p=>p[1])),'the two independent mounted case/pod observations agree within their declared intervals');assert.ok(superseded>0,'the invalid global angular scaling is explicitly retired');
});

const PRESERVED={
 family_single40:'fbff07976f67547b8d978a67fa2c6ca2f1d8816d9bbde63ada4643a4d75f72a6',
 family_twin40_dome:'a095f1cf45505b2548468aa5a8ee28a39fab2ec220f608db9e316d3d8b28808c',
 family_twin40_box:'574a6f35f8387b962f08cfd0a7e4064edea2411650f941e1dbba75bc3342f3f3',
 family_triple40:'5ea9f9581239ab0042ff82a26c2fd8fe168c7a27f6d1cc95bce45034d8c941e0',
 isd_heavy_octuple:'fbe520a5da746588c72a213b70bda1395fcfb75f3a5f7d34cfda7eb5cf84bb48',
 ven_turret70_native:'e5f20e028ab53d825df2242708a3ad836eae12492a3e20d90b30bb25abc56a14',
 family_triple70:'58896c5edb1e839f9fafded015fb31f246b8c9964c5abc1e9864889eed213257',
 family_quad70_side:'77e89163d2848e20972aab49087eb2b86e0a6f5e19d01644db34b405b85e05a4',
 light_single500:'8b079bfa8f8c4b320525c90e95641f949411474433f072d0f349bfe5b3b273dd',
 light_twin200:'ba45a0e984f240d0c456440179240c2087485ae55e1fb28364c90607a3c1a646',
 arq_turret_quad500:'97ee0740e540bad58770d91e5ec95c6d81382a6ac50af7add954bf6c36b54b58',
 light_quad200:'068529bb17e7e7309d39aa627f9b13fd3aef445d7877f954e5f0d833ace4a448',
 light_single200:'1c7c30c0a5588cefb669b428ffeded9237487cee1bf17345e168638933bd5d5d',
 light_twin200_fast:'4cac82b0e0ab8413458893fd8bc5987bf2ae1a026cb9acb3161ea4d3f02a5c1b'
};
test('adding capital weapons preserves all fourteen unaffected 40/70TT and 200/500GT model payloads and metadata',()=>{
 // Decoding and mounting add enumerable private caches to runtime assets.
 // Hash every authored field while excluding those transient caches.
 // The separately tested quad40 ion keeps its sphere/room, with the user-requested fat ion barrels.
 for(const[id,expected]of Object.entries(PRESERVED)){const a=C.REFERENCE_ASSETS[id];assert.ok(a,id);assert.equal(crypto.createHash('sha256').update(JSON.stringify(a,(k,v)=>k.startsWith('_')?undefined:v)).digest('hex'),expected,id+' unchanged source/model/UV/room/articulation data');}
});
