const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
const measured=JSON.parse(fs.readFileSync(path.join(root,'assets/source/turret-photo-measurements.json'),'utf8'));
const cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),cache=new Map(),metresPerPixel=measured.anchor.metres/measured.anchor.pixelSpan;

function model(kind){
 if(!cache.has(kind)){const asset=C.REFERENCE_ASSETS[C.FITS[kind].asset],mesh=C.decodeReference(C.FITS[kind].asset);cache.set(kind,{asset,mesh});}
 return cache.get(kind);
}
function point(asset,mesh,i){return [0,1,2].map(k=>mesh.pos[i*3+k]*asset.size[k]+asset.c[k]);}
function bounds(points){return [0,1,2].map(k=>Math.min(...points.map(p=>p[k]))).concat([0,1,2].map(k=>Math.max(...points.map(p=>p[k]))));}
function feature(kind,name){
 const {asset,mesh}=model(kind),record=asset.photoGeometryFeaturesM?.[name];
 assert.ok(record&&record.componentLabels?.length,`${kind} must identify its actual ${name} surfaces for photo comparison`);
 const labels=new Set(record.componentLabels),components=asset.components.filter(c=>labels.has(c.label));
 assert.deepEqual([...new Set(components.map(c=>c.label))].sort(),[...labels].sort(),`${kind} ${name} must select real mesh components`);
 const vertices=components.flatMap(c=>Array.from({length:c.vertices},(_,i)=>point(asset,mesh,c.firstVertex+i)));
 assert.ok(vertices.length);const b=bounds(vertices);
 // Declared feature bounds are a convenience for inspection. The comparisons
 // below use decoded vertices, so changing metadata alone cannot pass them.
 if(record.boundsM)for(let k=0;k<3;k++){assert.ok(Math.abs(b[k]-record.boundsM[0][k])<.01);assert.ok(Math.abs(b[k+3]-record.boundsM[1][k])<.01);}
 return {bounds:b,size:[0,1,2].map(k=>b[k+3]-b[k])};
}
function photoNear(actual,pixels,pixelUncertainty,relativeTolerance,label){
 const expected=pixels*metresPerPixel,tolerance=Math.max(pixelUncertainty*metresPerPixel,Math.abs(expected)*relativeTolerance);
 assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: actual ${actual.toFixed(3)} m; photo ${expected.toFixed(3)} ± ${tolerance.toFixed(3)} m`);
}
function wholeLength(kind){const {asset,mesh}=model(kind),b=bounds(Array.from({length:asset.n},(_,i)=>point(asset,mesh,i)));return b[3]-b[0];}
function barrelLengths(kind){
 const {asset,mesh}=model(kind);
 return asset.barrelCenters.map(row=>{
  const values=Array.from({length:row.vertices},(_,i)=>C.dot(point(asset,mesh,row.firstVertex+i),row.axis));
  return Math.max(...values)-Math.min(...values);
 });
}
function rayTriangle(origin,direction,a,b,c){
 const e1=C.sub(b,a),e2=C.sub(c,a),p=C.cross(direction,e2),det=C.dot(e1,p);if(Math.abs(det)<1e-10)return null;
 const inv=1/det,t=C.sub(origin,a),u=C.dot(t,p)*inv;if(u<0||u>1)return null;
 const q=C.cross(t,e1),v=C.dot(direction,q)*inv;if(v<0||u+v>1)return null;
 const distance=C.dot(e2,q)*inv;return distance>=0?distance:null;
}

test('photo measurements retain the original pixel anchor and exclude exhibition pedestals',()=>{
 assert.equal(measured.anchor.asset,'isd_heavy_octuple');assert.equal(measured.anchor.metres,40);
 const [a,b]=measured.anchor.pixelEndpoints;assert.equal(Math.hypot(b[0]-a[0],b[1]-a[1]),measured.anchor.pixelSpan);
 assert.equal(measured.anchor.pixelSpan,246);assert.ok(measured.sourceFiles.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)));
 for(const row of Object.values(measured.profile40))assert.equal(row.caseFloorYPixels,row.caseBoundsPixels[3]);
 const oct=model('oct40').asset;assert.ok(Math.abs(oct.size[0]-40)<.005);assert.ok(Math.abs(oct.size[2]-40)<.005);
});

for(const [kind,row]of Object.entries(measured.profile40))test(`${kind} case, bearing and barrel proportions follow the independent side photograph`,()=>{
 const [x0,y0,x1,y1]=row.caseBoundsPixels,tol=row.relativeTolerance;
 const casing=feature(kind,kind==='twin40Dome'?'hemisphere':'case');
 photoNear(casing.size[0],x1-x0,row.casePixelUncertainty,tol,kind+' case length');
 photoNear(casing.size[1],y1-y0,row.casePixelUncertainty,tol,kind+' case height');
 if(kind==='twin40Dome')assert.ok(Math.abs(casing.size[0]-casing.size[2])<.02,'the enlarged hemisphere must remain circular');
 if(row.wheelDiameterPixels!=null){const wheel=feature(kind,'wheel');photoNear(Math.max(wheel.size[0],wheel.size[1]),row.wheelDiameterPixels,row.wheelPixelUncertainty,tol,kind+' complete bearing diameter');}
 const root=row.barrelRootPixels,tip=row.barrelTipPixels,lengthPixels=Math.hypot(root[0]-tip[0],root[1]-tip[1]);
 for(const length of barrelLengths(kind))photoNear(length,lengthPixels,row.barrelPixelUncertainty,tol,kind+' actual complete barrel length');
 const {asset,mesh}=model(kind),wheel=row.wheelDiameterPixels==null?null:feature(kind,'wheel');
 for(const barrel of asset.barrelCenters){
  const b=bounds(Array.from({length:barrel.vertices},(_,i)=>point(asset,mesh,barrel.firstVertex+i))),axisY=(b[1]+b[4])/2;
  photoNear(axisY-casing.bounds[1],row.caseFloorYPixels-root[1],row.barrelPixelUncertainty,tol,kind+' barrel axis above case floor');
  if(wheel)assert.ok(axisY>wheel.bounds[4]+.1,`${kind} barrel axis must sit above the complete circular bearing, as in the photograph`);
 }
 const projectedLength=Math.max(x1,root[0],tip[0])-Math.min(x0,root[0],tip[0]);
 photoNear(wholeLength(kind),projectedLength,row.casePixelUncertainty,tol,kind+' whole length');
});

test('the 70 TT triple has the photographed broad front pod and compact case around unchanged DBY barrels',()=>{
 const row=measured.perspective70,main=feature('triple70','mainCase'),pod=feature('triple70','frontPod'),dby=model('refVen').asset;
 const podRatio=pod.size[2]/main.size[2],caseRatio=main.size[2]/dby.size[2];
 assert.ok(Math.abs(podRatio-row.podToCaseProjectedWidthRatio)<=row.ratioTolerance,`${podRatio} must follow the photographed pod/case ratio ${row.podToCaseProjectedWidthRatio}`);
 assert.ok(Math.abs(caseRatio-row.tripleToDbyCaseProjectedWidthRatio)<=row.ratioTolerance,`${caseRatio} must follow the photographed triple/DBY case ratio ${row.tripleToDbyCaseProjectedWidthRatio}`);
 assert.ok(Math.abs(model('triple70').asset.size[1]-dby.size[1])<.01,'the triple remains at the original DBY height');
 const original=barrelLengths('refVen');for(const k of ['triple70','quad70Side'])for(const length of barrelLengths(k))assert.ok(original.some(n=>Math.abs(n-length)<.006),'70 TT derivatives retain complete original DBY-length tubes');
});

test('the broadside quad preserves a real opening between its carrier rails without inventing room in the air gap',()=>{
 const {asset,mesh}=model('quad70Side'),carrier=asset.carrier;assert.equal(carrier.style,'open-C-frame');assert.equal(carrier.airGapCreditedAsCompartment,false);
 const gap=carrier.airGapBoundsM;assert.ok(gap&&gap[1][1]>gap[0][1]);const witness=gap[0].map((v,k)=>(v+gap[1][k])/2);
 const top=asset.components.find(c=>c.label==='broadside carrier upper rail'),bottom=asset.components.find(c=>c.label==='broadside carrier lower rail');assert.ok(top&&bottom);
 const yRange=c=>bounds(Array.from({length:c.vertices},(_,i)=>point(asset,mesh,c.firstVertex+i)));
 assert.ok(witness[1]<yRange(top)[1]&&witness[1]>yRange(bottom)[4],'the witness lies between the actual rendered rails');
 const inside=poly=>poly.faces.every(([i,j,k])=>C.dot(C.cross(C.sub(poly.verticesM[j],poly.verticesM[i]),C.sub(poly.verticesM[k],poly.verticesM[i])),C.sub(witness,poly.verticesM[i]))<=1e-6);
 assert.equal(asset.turretCompartment.convexes.some(inside),false,'carrier air is not capacitor room');
 const origin=[witness[0],witness[1],asset.bounds[0][2]-2],direction=[0,0,1];let hits=0;
 for(let i=0;i<mesh.idx.length;i+=3){const hit=rayTriangle(origin,direction,...Array.from(mesh.idx.subarray(i,i+3),j=>point(asset,mesh,j)));if(hit!=null)hits++;}
 assert.equal(hits,0,'the side opening must also exist in the actual rendered triangles, not just metadata');
});
