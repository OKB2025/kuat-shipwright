const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),asset=C.REFERENCE_ASSETS[C.FITS.triple70.asset],mesh=C.decodeReference(C.FITS.triple70.asset);
const native=Array.from({length:asset.n},(_,i)=>[0,1,2].map(k=>mesh.pos[i*3+k]*asset.size[k]+asset.c[k]));
const near=(a,b,e=.004)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`);
const vector=(a,b,e=.004)=>a.forEach((v,i)=>near(v,b[i],e));
const fitting=(extra={})=>({id:1,k:'triple70',p:[121,37,-14],a:2,ped:0,base:0,low:0,float:false,...extra});
const toWorld=(f,p)=>C.referenceFitPoint(f,p.map((v,i)=>(v-asset.c[i])/asset.size[i]));

function rowsFor(labels){const set=new Set(labels);return asset.components.filter(row=>set.has(row.label));}
function role(name,fallback){const labels=asset.frontConnection?.[name];return rowsFor(labels||fallback);}
const caseRows=rowsFor(asset.photoGeometryFeaturesM.mainCase.componentLabels);
const armorRows=role('armorCheekLabels',['integral forward gun-pod bearing cheek']);
const armRows=role('bearingArmLabels',['integral forward gun-pod bearing cheek']);
const axleRows=role('fixedAxleLabels',['forward pod trunnion axle']);
const podRows=role('movingPodLabels',['complete detailed DBY common front gun pod']);
const wheelRows=role('movingWheelLabels',['DBY-827 complete circular elevation bearing']);
const receiverRows=role('receiverLabels',['wide detailed front three-gun receiver']);
const pointsFor=(rows,points=native)=>rows.flatMap(row=>points.slice(row.firstVertex,row.firstVertex+row.vertices));
function bounds(points){return [0,1,2].map(k=>Math.min(...points.map(p=>p[k]))).concat([0,1,2].map(k=>Math.max(...points.map(p=>p[k]))));}
function hull2(points){
 const sorted=[...new Map(points.map(p=>[p.join(','),p])).values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const chain=arr=>{const out=[];for(const p of arr){while(out.length>1&&turn(out.at(-2),out.at(-1),p)<=1e-8)out.pop();out.push(p);}return out;};
 return chain(sorted).slice(0,-1).concat(chain(sorted.slice().reverse()).slice(0,-1));
}
function polygonArea(polygon){let sum=0;for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];sum+=a[0]*b[1]-b[0]*a[1];}return Math.abs(sum)/2;}
function widestSection(){
 // Derive the line from the decoded case surfaces, not caseMaximumWidthXM
 // or another annotation that could conceal a misplaced attachment point.
 const hull=hull2(pointsFor(caseRows).map(p=>[p[0],p[2]]));
 const sample=x=>{const z=[];for(let i=0;i<hull.length;i++){
  const a=hull[i],b=hull[(i+1)%hull.length];
  if(Math.abs(a[0]-x)<1e-7)z.push(a[1]);
  if(Math.abs(b[0]-a[0])>1e-9&&x>=Math.min(a[0],b[0])-1e-7&&x<=Math.max(a[0],b[0])+1e-7)
   z.push(a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]));
 }return {x,low:Math.min(...z),high:Math.max(...z),width:Math.max(...z)-Math.min(...z)};};
 const samples=hull.map(p=>sample(p[0])),width=Math.max(...samples.map(p=>p.width));
 const widest=samples.filter(p=>Math.abs(p.width-width)<.002),x=(Math.min(...widest.map(p=>p.x))+Math.max(...widest.map(p=>p.x)))/2,q=sample(x);
 return {width,midpoint:[x,0,(q.low+q.high)/2],ends:[[x,0,q.low],[x,0,q.high]]};
}
function triangles(row,points){const out=[];for(let i=row.firstIndex;i<row.firstIndex+row.indices;i+=3)out.push(Array.from(mesh.idx.subarray(i,i+3),j=>points[j]));return out;}
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
function surfacesTouch(left,right,points,eps=.012){
 const A=bounds(pointsFor([left],points)),B=bounds(pointsFor([right],points));
 if([0,1,2].some(k=>A[k]>B[k+3]+eps||B[k]>A[k+3]+eps))return false;
 for(const x of triangles(left,points))for(const y of triangles(right,points)){
  if(x.some(p=>pointOnTriangle(p,y,eps))||y.some(p=>pointOnTriangle(p,x,eps)))return true;
  for(let i=0;i<3;i++)if(segmentCrossesTriangle(x[i],x[(i+1)%3],y,eps)||segmentCrossesTriangle(y[i],y[(i+1)%3],x,eps))return true;
 }return false;
}
function uniqueRows(rows){return [...new Map(rows.map(row=>[row.firstIndex,row])).values()];}

test('the 70 TT triple attachment is the actual widest-case cross-section midpoint',()=>{
 assert.ok(caseRows.length>=4);
 const q=widestSection();near(q.width,24,.01);near(q.width,asset.size[2],.01);
 vector(asset.mount,q.midpoint);
 const f=fitting(),joint=C.authoredTurretGeometry(f);
 vector(toWorld(f,q.midpoint),C.fitOrigin(f));vector(joint.yawPivot,C.fitOrigin(f));
 const ends=q.ends.map(p=>toWorld(f,p)),center=C.mul(C.add(...ends),.5);
 vector(center,C.fitOrigin(f));near(C.len(C.sub(ends[0],ends[1])),q.width,.01);
});

test('the base alignment survives all mounting axes, sloped faces, heading, mirroring and scale',()=>{
 const q=widestSection();
 for(const a of [0,1,2,3,4,5])for(const tilt of [null,C.norm([.31,.88,-.35])])for(const yaw of [0,37,90])for(const scale of [.65,1.6]){
  const f=fitting({a,assetYaw:yaw,scale,frameFlip:yaw===90,...(tilt?{tilt}:{})}),origin=C.fitOrigin(f),joint=C.authoredTurretGeometry(f);
  vector(toWorld(f,q.midpoint),origin);vector(joint.yawPivot,origin);
  const ends=q.ends.map(p=>toWorld(f,p));vector(C.mul(C.add(...ends),.5),origin);near(C.len(C.sub(...ends)),q.width*scale,.012);
  const pose=C.aimAuthoredTurret(joint,Math.PI/3,.4);vector(pose.yawPivot,origin);vector(pose.bodyPivot,origin);
 }
});

test('an explicit round or square pedestal is centered below the widest case line without automatic supports',()=>{
 const q=widestSection();assert.equal(asset.noSupportPedestal,true);near(asset.supportStandHeightM,0,1e-12);
 assert.equal(G.meshFits({fits:[fitting()]}).ni,0,'the corrected attachment must not add a generic riser');
 for(const a of [0,1,2,3,4,5])for(const tilt of [null,C.norm([.25,.91,-.33])])for(const pedShape of [undefined,'trap']){
  const f=fitting({a,ped:3,pedShape,assetYaw:37,scale:1.2,...(tilt?{tilt}:{})}),g=G.meshFits({fits:[f]}),o=C.fitOrigin(f),fr=C.fitFrameOf(f);
  assert.ok(g.ni>0);const points=Array.from(new Set(Array.from(g.idx.subarray(0,g.ni))),i=>Array.from(g.pos.subarray(i*3,i*3+3)));
  for(const axis of [fr.fw,fr.rt]){const values=points.map(p=>C.dot(C.sub(p,o),axis));near((Math.min(...values)+Math.max(...values))/2,0,.003);}
  const up=points.map(p=>C.dot(C.sub(p,o),fr.up));near(Math.max(...up),0,.003);near(Math.min(...up),-3,.003);
  vector(toWorld(f,q.midpoint),o);
 }
});

test('the forward armor visibly joins case height to the mounting plane instead of leaving short floating arms',()=>{
 assert.equal(armorRows.length,2);
 const caseBounds=bounds(pointsFor(caseRows)),caseHeight=caseBounds[4]-caseBounds[1],podBounds=bounds(pointsFor(podRows)),podDepth=podBounds[3]-podBounds[0];
 for(const row of armorRows){
  const points=pointsFor([row]),b=bounds(points),area=polygonArea(hull2(points.map(p=>[p[0],p[1]])));
  near(b[1],asset.mount[1],.005);
  assert.ok(b[4]-b[1]>=caseHeight*.8,'the front side armor must span the case, not only the axle height');
  assert.ok(area>=caseHeight*podDepth*.4,'a broad sloping wall must fill the visible side gap');
  assert.ok(b[3]>=podBounds[0]+podDepth*.65,'the lower armor extends beneath the front pod');
  assert.ok(caseRows.some(c=>surfacesTouch(c,row,native)),'each forward wall has real triangle contact with the rear case');
 }
});

test('the case, bearings, moving pod, receiver and all barrels remain physically connected while elevating',()=>{
 assert.equal(axleRows.length,2);assert.equal(wheelRows.length,2);assert.equal(podRows.length,1);assert.equal(asset.barrelCenters.length,3);
 const groups=[...caseRows,...armorRows,...armRows,...axleRows,...podRows,...wheelRows,...receiverRows,...asset.barrelCenters],nodes=uniqueRows(groups);
 for(const degrees of [0,35,85]){
  const angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),pivot=asset.elevationPivot;
  const points=native.map((p,i)=>{if(i<asset.elevationVertexStart)return p;const [x,y,z]=C.sub(p,pivot);return [pivot[0]+x*c-y*s,pivot[1]+x*s+y*c,pivot[2]+z];});
  const edges=nodes.map(()=>[]);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++)if(surfacesTouch(nodes[i],nodes[j],points)){edges[i].push(j);edges[j].push(i);}
  const reached=new Set(caseRows.map(row=>nodes.indexOf(row))),queue=[...reached];
  for(let i=0;i<queue.length;i++)for(const j of edges[queue[i]])if(!reached.has(j)){reached.add(j);queue.push(j);}
  for(const row of [...armorRows,...axleRows,...podRows,...wheelRows,...receiverRows,...asset.barrelCenters])
   assert.ok(reached.has(nodes.indexOf(row)),`${row.label} needs actual case/bearing contact at ${degrees} degrees`);
 }
});

test('ordinary placement and blueprint reload keep the selected base point and heading',()=>{
 const ship=C.newShip({assembly:true,L:220,W:180,H:60},'Centered triple mounting');ship.parts=[];ship.fits=[];
 C.placePart(ship,'struct',[110,0,0],[190,160,20],{form:'box',corner:0},false);
 const placed=C.placeFit(ship,'triple70',[110,10,0],[0,1,0],0,false);assert.ok(placed.fit,placed.err);assert.equal(placed.fit.float,false);
 const f=placed.fit;f.assetYaw=37;const before=f.p.slice(),id=f.id,loaded=C.deserialize(C.serialize(ship)),restored=loaded.fits.find(q=>q.id===id);
 assert.ok(restored);assert.equal(restored.k,'triple70');assert.ok(!restored.float);vector(restored.p,before,1e-8);near(restored.assetYaw,37,1e-12);
 vector(toWorld(restored,widestSection().midpoint),C.fitOrigin(restored));near(restored.ped||0,0,1e-12);near(restored.base||0,0,1e-12);
});
