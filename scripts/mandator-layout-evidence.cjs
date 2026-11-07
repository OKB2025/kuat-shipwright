// Independent, bounded geometry survey of every installed Mandator battery.
// This never constructs a ship or computes engineering statistics.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib');
const EXPECTED=Object.freeze({utl:163,quad175:16,ball720:80,ball175Quad:6,ball175QuadIon:14,pd:160,monCalPD:60});
const clampExamples=(array,value)=>{if(array.length<5)array.push(value);};
function zoneOf(up){return Math.abs(up[1])>=.65?(up[1]>0?'dorsal':'ventral'):Math.abs(up[2])>=.65?(up[2]>0?'starboard':'port'):'end';}
function polygonArea(poly){return poly.reduce((n,p,i)=>{const q=poly[(i+1)%poly.length];return n+p[0]*q[1]-q[0]*p[1];},0)/2;}
function polygonIntersection(subject,clip){
 let out=subject;if(polygonArea(clip)<0)clip=clip.slice().reverse();
 for(let i=0;i<clip.length&&out.length;i++){const a=clip[i],b=clip[(i+1)%clip.length],side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),next=[];let p=out.at(-1),hp=side(p);
  for(const q of out){const hq=side(q);if((hp>=-1e-7)!==(hq>=-1e-7)){const t=hp/(hp-hq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}if(hq>=-1e-7)next.push(q);p=q;hp=hq;}out=next;
 }return out;
}
function jointEvidence(C,f,g,a){
 const poses=[],neutralValid=C.authoredTurretInArc(g,g.fw),radians=Math.PI/180;
 for(const [yaw,elevation]of [[0,0],[-25*radians,0],[25*radians,0],[-20*radians,-5*radians],[20*radians,-5*radians]]){
  const pose=C.aimAuthoredTurret(g,yaw,elevation),M=pose.rotation,columns=[0,3,6].map(i=>M.slice(i,i+3)),det=C.dot(columns[0],C.cross(columns[1],columns[2])),orthogonal=columns.every(v=>Math.abs(C.len(v)-1)<1e-8)&&Math.abs(C.dot(columns[0],columns[1]))<1e-8&&Math.abs(C.dot(columns[0],columns[2]))<1e-8&&Math.abs(C.dot(columns[1],columns[2]))<1e-8,valid=orthogonal&&Math.abs(det-1)<1e-8&&pose.muzzles.length===a.muzzlePoints.length&&pose.muzzles.every(p=>p.every(Number.isFinite))&&C.authoredTurretInArc(g,pose.fw);
  poses.push({yaw,elevation,valid,determinant:det,forward:pose.fw});
 }
 const world=(fit,p)=>C.referenceFitPoint(fit,p.map((v,k)=>(v-a.c[k])/a.size[k])),centre=world(f,a.sphereCenterM),neutralCentre=world({...f,assetPitch:0},a.sphereCenterM),centreInvariant=C.len(C.sub(centre,neutralCentre))<1e-8,up=C.fitUp(f),above=C.dot(C.sub(centre,C.fitOrigin(f)),up),embedding={radiusM:a.sphereRadiusM,centreAboveMountM:above,embeddedDepthM:a.sphereRadiusM-above,diameterFraction:(a.sphereRadiusM-above)/(2*a.sphereRadiusM)};
 const axisUnit=Math.abs(C.len(g.axis)-1)<1e-8,elevationAxisUnit=Math.abs(C.len(g.elevationAxis)-1)<1e-8,mechanicalAxesPerpendicular=Math.abs(C.dot(g.axis,g.elevationAxis))<1e-8;
 return {neutralValid,centreInvariant,axisUnit,elevationAxisUnit,mechanicalAxesPerpendicular,embedding,poses,passed:neutralValid&&centreInvariant&&axisUnit&&elevationAxisUnit&&mechanicalAxesPerpendicular&&Math.abs(embedding.diameterFraction-1/3)<1e-7&&poses.every(p=>p.valid)};
}
function makeSolids(C,ship){
 const rows=ship.parts.filter(p=>p.k==='struct'&&!p.plate).map(p=>({id:p.id,p,b:C.partAABB(p),triangles:null}));
 const locks=[];
 for(const {p}of rows)if(p.hullProfile){if(!p._hullShip)C.inStruct(p,p.c);const local=p._hullShip;if(local){locks.push({local,had:Object.hasOwn(local,'_lockedCache'),previous:local._lockedCache});local._lockedCache=C.cache(local);}}
 if(!ship.hull.assembly){locks.push({local:ship,had:Object.hasOwn(ship,'_lockedCache'),previous:ship._lockedCache});ship._lockedCache=C.cache(ship);}
 const rootHull=ship.hull.assembly?null:C.hullGeo(ship).tris;
 const inside=(q,candidates=rows)=>!!(rootHull&&C.inHull(ship,q)||candidates.some(({p,b})=>q.every((v,i)=>v>b[i]+.015&&v<b[i+3]-.015)&&C.inStruct(p,q)));
 const ray=(o,d,maxT)=>{
  let nearest=rootHull?.length?C.rayTris(rootHull,o,d,maxT):null,partId=nearest?'hull':null;
  for(const row of rows){let near=0,far=maxT;for(let k=0;k<3&&far>=near;k++){if(Math.abs(d[k])<1e-12){if(o[k]<row.b[k]||o[k]>row.b[k+3])far=-1;continue;}let a=(row.b[k]-o[k])/d[k],b=(row.b[k+3]-o[k])/d[k];if(a>b)[a,b]=[b,a];near=Math.max(near,a);far=Math.min(far,b);}if(far<near||nearest&&near>nearest.t)continue;
   row.triangles??=C.structTriangles(row.p);const hit=C.rayTris(row.triangles,o,d,maxT);
   if(hit&&hit.t>1e-5&&hit.t<maxT&&(!nearest||hit.t<nearest.t)){nearest=hit;partId=row.id;}
  }return nearest?{partId,t:nearest.t,p:nearest.p}:null;
 };
 return {rows,inside,ray,restore(){for(const {local,had,previous}of locks){if(had)local._lockedCache=previous;else delete local._lockedCache;}}};
}
function nativeSamples(C,id){
 const a=C.REFERENCE_ASSETS[id],raw=C.decodeReference(id),points=[],seen=new Set(),metres=i=>[0,1,2].map(k=>raw.pos[i*3+k]*a.size[k]+a.c[k]);
 const add=(p,kind)=>{const key=p.map(v=>v.toFixed(6)).join(',');if(!seen.has(key)){seen.add(key);points.push({p,kind});}};
 const barrels=a.barrelCenters||[],isBarrel=row=>barrels.some(b=>b.firstIndex===row.firstIndex&&b.indices===row.indices);
 // Every authored component contributes a real face centroid. A separate
 // whole-housing vertex survey retains silhouette extrema and broad coverage.
 // Tiny decorative source panels must not multiply the survey unboundedly.
 const bodyVertices=new Set();
 for(const row of a.components||[]){if(isBarrel(row))continue;
  for(let j=0;j<row.vertices;j++)bodyVertices.add(row.firstVertex+j);
  const triangle=row.firstIndex+Math.floor(Math.max(0,row.indices/3-1)/2)*3,ids=Array.from(raw.idx.subarray(triangle,triangle+3));if(ids.length===3)add([0,1,2].map(k=>ids.reduce((n,i)=>n+metres(i)[k],0)/3),'housing-face');
 }
 const body=Array.from(bodyVertices),stride=Math.max(1,Math.ceil(body.length/48)),extrema=Array.from({length:6},()=>null);for(let j=0;j<body.length;j++){const p=metres(body[j]);if(j%stride===0||j===body.length-1)add(p,'housing');for(let k=0;k<3;k++){if(!extrema[k]||p[k]<extrema[k][k])extrema[k]=p;if(!extrema[k+3]||p[k]>extrema[k+3][k])extrema[k+3]=p;}}extrema.filter(Boolean).forEach(p=>add(p,'housing'));
 // Every axial/radius station is represented, including collars and bore
 // floors. Sampling the circumference never removes a whole profile station.
 for(const barrel of barrels){const axis=C.norm(barrel.axis||C.sub(barrel.muzzle,barrel.root)),tol=Math.max(.002,(a.maxQuantizationErrorM||0)*3),groups=[];
  for(let j=0;j<barrel.vertices;j++){const p=metres(barrel.firstVertex+j),delta=C.sub(p,barrel.root),along=C.dot(delta,axis),rad=C.len(C.sub(delta,C.mul(axis,along)));let group=groups.at(-1);if(!group||Math.abs(group.along-along)>tol||Math.abs(group.rad-rad)>tol)groups.push(group={along,rad,points:[]});group.points.push(p);}
  for(const {points:group}of groups){const step=Math.max(1,Math.ceil(group.length/8));for(let j=0;j<group.length;j+=step)add(group[j],'barrel');}
  add(barrel.root,'barrel');add(barrel.muzzle,'barrel');
 }
 if(!points.length)for(let i=0;i<a.n;i+=Math.max(1,Math.ceil(a.n/128)))add(metres(i),'asset');
 const bodyPoints=body.map(metres),floor=Math.min(...bodyPoints.map(p=>p[1])),band=Math.max(.03,a.size[1]*.025),unique=new Map();for(const p of bodyPoints)if(p[1]<=floor+band)unique.set(p[0].toFixed(6)+'|'+p[2].toFixed(6),[p[0],floor,p[2]]);
 const ordered=Array.from(unique.values()).sort((a,b)=>a[0]-b[0]||a[2]-b[2]),cross=(o,a,b)=>(a[0]-o[0])*(b[2]-o[2])-(a[2]-o[2])*(b[0]-o[0]),chain=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=1e-10)out.pop();out.push(p);}return out;},lower=chain(ordered),upper=chain(ordered.slice().reverse()),baseFootprint=ordered.length>=3?lower.slice(0,-1).concat(upper.slice(0,-1)):[];
 return {asset:a,points,baseFootprint};
}
function layoutEvidence(C,ship,stats,options={}){
 const started=performance.now(),solids=makeSolids(C,ship),samples=new Map(),footprints=new Map(),distribution={},counts={},rows=[],failures=[],guns=ship.fits.filter(f=>C.FITS[f.k]?.cat==='w'&&!C.FITS[f.k].msl&&!C.FITS[f.k].retired&&((C.FITS[f.k].tt||0)+(C.FITS[f.k].ion||0)>0)),maxRay=Math.max(ship.hull.L,ship.hull.W,ship.hull.H)*2+100;
 let mainIonVolleyTT=0,pdVolleyTT=0,totalSamples=0,totalMuzzles=0;
 try{for(const f of guns){if(options.deadlineMs&&performance.now()-started>options.deadlineMs)throw Error('Mandator layout survey exceeded its explicit time budget');const spec=C.fitSpec(f),up=C.fitUp(f),zone=zoneOf(up),origin=C.fitOrigin(f),assetId=f.skinAsset||spec.asset,g=C.authoredTurretGeometry(f);counts[f.k]=(counts[f.k]||0)+1;const dist=distribution[f.k]??={dorsal:0,ventral:0,starboard:0,port:0,end:0};dist[zone]++;
  const volley=(spec.tt||0)+(spec.ion||0);if(f.k==='pd'||f.k==='monCalPD')pdVolleyTT+=volley;else mainIonVolleyTT+=volley;
  const rise=C.dot(C.sub(origin,f.p),up),ratio=rise/Math.max(.001,spec.hm||0),row={id:f.id,k:f.k,zone,position:f.p.slice(),up:up.slice(),origin,riseM:rise,bodyHeightM:spec.hm,supportBodyRatio:ratio,supportTopM:f.mountSupport?.top??0,manualPedestalM:f.ped||0,sampledPoints:0,embeddedPoints:0,baseFootprintPoints:0,buriedBaseFootprint:0,buriedAbovePlane:0,buriedExamples:[],muzzles:0,buriedMuzzles:[],blockedRays:[],float:!!f.float};
  if(assetId&&g){let native=samples.get(assetId);if(!native){native=nativeSamples(C,assetId);samples.set(assetId,native);}const a=native.asset,bounds=C.fitAABB(f),candidates=solids.rows.filter(({b})=>[0,1,2].every(k=>b[k]<=bounds[k+3]&&b[k+3]>=bounds[k]));
   const zero=C.referenceFitPoint(f,[0,0,0]),basis=[[1,0,0],[0,1,0],[0,0,1]].map(v=>C.sub(C.referenceFitPoint(f,v),zero)),world=p=>{const v=p.map((value,k)=>(value-a.c[k])/a.size[k]);return [0,1,2].map(k=>zero[k]+basis[0][k]*v[0]+basis[1][k]*v[1]+basis[2][k]*v[2]);};
   const frame=C.fitFrameOf(f),centre=a.sphereRadiusM?world(a.sphereCenterM):origin,poly=a.sphereRadiusM?Array.from({length:32},(_,j)=>C.add(centre,C.add(C.mul(frame.fw,a.sphereRadiusM*Math.cos(j*Math.PI/16)),C.mul(frame.rt,a.sphereRadiusM*Math.sin(j*Math.PI/16))))):native.baseFootprint.map(world);footprints.set(f.id,{frame,poly});
   for(const sample of native.points){const q=world(sample.p),height=C.dot(C.sub(q,origin),up);row.sampledPoints++;totalSamples++;
    // The closed ball's lower third and its internal gun root are deliberately
    // embedded. Above the actual attachment plane, visible armor must be free.
    if(height<=.04){row.embeddedPoints++;continue;}if(solids.inside(q,candidates)){row.buriedAbovePlane++;clampExamples(row.buriedExamples,{kind:sample.kind,p:q,heightM:height});}
   }
   if(!a.sphereRadiusM)for(let i=0;i<native.baseFootprint.length;i++){const a0=native.baseFootprint[i],b0=native.baseFootprint[(i+1)%native.baseFootprint.length];for(const t of [0,.25,.5,.75]){const q=world(a0.map((v,k)=>v+(b0[k]-v)*t)),height=C.dot(C.sub(q,origin),up),above=C.add(q,C.mul(up,.05-height));row.baseFootprintPoints++;row.sampledPoints++;totalSamples++;if(solids.inside(above,candidates)){row.buriedBaseFootprint++;clampExamples(row.buriedExamples,{kind:'base-footprint',p:above,heightM:.05});}}}
   for(const [i,m]of g.muzzles.entries()){row.muzzles++;totalMuzzles++;if(solids.inside(m))clampExamples(row.buriedMuzzles,{index:i,p:m});const o=C.add(m,C.mul(g.fw,.05)),hit=solids.ray(o,g.fw,maxRay);if(hit)clampExamples(row.blockedRays,{index:i,...hit});}
   row.firingDirection=g.fw;row.ballHousing=!!a.sphereRadiusM&&a.gunhouseElevates===true;row.barrels=spec.barrels;row.boltTT=spec.boltTT;if(row.ballHousing)row.joint=jointEvidence(C,f,g,a);
  }
  row.footprintRadiusM=spec.r;rows.push(row);if(options.progress&&rows.length%25===0)options.progress({guns:rows.length,samples:totalSamples,elapsedSeconds:(performance.now()-started)/1000});
 }}finally{solids.restore();}
 const heavy=rows.filter(r=>!['pd','monCalPD'].includes(r.k)),crowded=[];
 for(let i=0;i<heavy.length;i++)for(let j=i+1;j<heavy.length;j++){const a=heavy[i],b=heavy[j];if(C.dot(a.up,b.up)<.95)continue;const delta=C.sub(a.origin,b.origin),normalGap=Math.abs(C.dot(delta,a.up));if(normalGap>Math.max(a.bodyHeightM,b.bodyHeightM))continue;const planeDistance=C.len(C.sub(delta,C.mul(a.up,C.dot(delta,a.up))));if(planeDistance>a.footprintRadiusM+b.footprintRadiusM)continue;const first=footprints.get(a.id),second=footprints.get(b.id);if(!first||!second)continue;const project=p=>{const q=C.sub(p,a.origin);return [C.dot(q,first.frame.fw),C.dot(q,first.frame.rt)];},overlap=polygonIntersection(first.poly.map(project),second.poly.map(project)),area=overlap.length>=3?Math.abs(polygonArea(overlap)):0;if(area>.01)crowded.push({a:a.id,b:b.id,projectedOverlapAreaM2:area,centreDistanceM:planeDistance});}
 const ions=rows.filter(r=>r.k==='ball175QuadIon'),sideCounts={port:ions.filter(r=>r.zone==='port').length,starboard:ions.filter(r=>r.zone==='starboard').length},expectedKeys=Object.keys(EXPECTED),countCorrect=expectedKeys.every(k=>counts[k]===EXPECTED[k])&&Object.keys(counts).every(k=>expectedKeys.includes(k));
 const sideBallKinds=['ball720','ball175Quad','ball175QuadIon','monCalPD'],sideRows=rows.filter(r=>r.zone==='port'||r.zone==='starboard'),utlDistribution=distribution.utl||{},quadDistribution=distribution.quad175||{},pdDistribution=distribution.pd||{};
 const checks={
  batteryCounts:countCorrect,
  mainIonVolley:Math.abs(mainIonVolleyTT-317520)<1e-7,
  pdVolley:Math.abs(pdVolleyTT-.00005)<1e-12,
  allPhysicallyAttached:rows.every(r=>!r.float),
  allGunGeometrySurveyed:rows.length===499&&rows.every(r=>r.sampledPoints>0&&r.muzzles>0),
  visibleBodiesOutsideStructure:rows.every(r=>r.buriedAbovePlane===0),
  completeBaseFootprintsAboveStructure:rows.every(r=>r.ballHousing||r.baseFootprintPoints>=12&&r.buriedBaseFootprint===0),
  muzzlesOutsideStructure:rows.every(r=>r.buriedMuzzles.length===0),
  neutralMuzzleRaysClear:rows.every(r=>r.blockedRays.length===0),
  compactFoundations:rows.every(r=>r.riseM>=-.02&&r.supportBodyRatio<=1+1e-6),
  heavyMountsSeparated:crowded.length===0,
  distributedSuperheavy:counts.utl===163&&(utlDistribution.dorsal||0)>0&&(utlDistribution.dorsal||0)<=101&&(utlDistribution.ventral||0)>=51&&counts.ball720===80,
  distributedQuad175:counts.quad175===16&&(quadDistribution.dorsal||0)>0&&(quadDistribution.ventral||0)>0&&counts.ball175Quad===6,
  sideSphericalIons:ions.length===14&&sideCounts.port===7&&sideCounts.starboard===7&&ions.every(r=>r.ballHousing&&r.barrels===4&&r.boltTT===175&&Math.abs(r.up[2])>=.8&&Math.abs(r.up[1])<=.35&&r.up[2]*r.position[2]>0),
  allSideBatteriesSpherical:sideRows.length===160&&sideRows.every(r=>sideBallKinds.includes(r.k)&&r.ballHousing&&Math.abs(r.up[2])>=.8&&Math.abs(r.up[1])<=.35&&r.up[2]*r.position[2]>0),
  sideBallJointsAndEmbedding:sideRows.length===160&&sideRows.every(r=>r.joint?.passed),
  sideSuperheavyBalanced:rows.filter(r=>r.k==='ball720'&&r.zone==='port').length===40&&rows.filter(r=>r.k==='ball720'&&r.zone==='starboard').length===40,
  sideQuad175Balanced:rows.filter(r=>r.k==='ball175Quad'&&r.zone==='port').length===3&&rows.filter(r=>r.k==='ball175Quad'&&r.zone==='starboard').length===3,
  distributedPD:counts.pd===160&&counts.monCalPD===60&&(pdDistribution.dorsal||0)>0&&(pdDistribution.ventral||0)>0&&rows.filter(r=>r.k==='monCalPD'&&r.zone==='port').length===30&&rows.filter(r=>r.k==='monCalPD'&&r.zone==='starboard').length===30,
  noEndFacingBatteries:rows.every(r=>r.zone!=='end')
 };
 if(stats){checks.fullSingleVolleyCharge=guns.filter(f=>C.needsCapacitor(f)).every(f=>(stats.chargeInfo?.[f.id]?.ratio??0)>=.99999&&!stats.chargeInfo?.[f.id]?.blocked);checks.noEquipmentOverlap=!Object.values(stats.info||{}).some(info=>info.overlap);}
 for(const [gate,passed]of Object.entries(checks))if(!passed)failures.push(gate);
 return {schemaVersion:1,scope:'Every installed gun: actual authored component extrema/stratified surface points, every barrel profile station, every physical muzzle and full neutral-axis ray against the actual hull and structural solids. Ball material and gun roots below their attachment plane are legitimate embedding. Internal charging rooms and the gun own foundation are excluded from the structural collision union.',counts,expectedCounts:EXPECTED,distribution,mainIonVolleyTT,pdVolleyTT,sideIonCounts:sideCounts,sampledPoints:totalSamples,muzzleCount:totalMuzzles,crowdedHeavyMounts:crowded,largestFoundations:rows.slice().sort((a,b)=>b.supportBodyRatio-a.supportBodyRatio).slice(0,10).map(({id,k,riseM,bodyHeightM,supportBodyRatio})=>({id,k,riseM,bodyHeightM,supportBodyRatio})),checks,failures,passed:failures.length===0,rows,elapsedSeconds:(performance.now()-started)/1000,resources:{maxRSSKB:process.resourceUsage().maxRSS,cachedStructureTriangles:solids.rows.reduce((n,r)=>n+(r.triangles?.length||0)/9,0),cachedTriangleBytes:solids.rows.reduce((n,r)=>n+(r.triangles?.byteLength||0),0)}};
}
module.exports={layoutEvidence,jointEvidence,EXPECTED};
if(require.main===module){
 const root=path.resolve(__dirname,'..'),input=process.argv[2];if(!input)throw Error('Usage: node scripts/mandator-layout-evidence.cjs blueprint.json[.gz] [output.json]');const bytes=fs.readFileSync(input),ship=JSON.parse(input.endsWith('.gz')?zlib.gunzipSync(bytes):bytes.toString()),cx=vm.createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});const C=vm.runInContext('Core',cx),proof=layoutEvidence(C,ship,undefined,{deadlineMs:90000,progress:state=>console.error(JSON.stringify({phase:'survey',...state,rssMB:process.memoryUsage().rss/1e6}))});if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify({passed:proof.passed,failures:proof.failures,counts:proof.counts,distribution:proof.distribution,sampledPoints:proof.sampledPoints,muzzles:proof.muzzleCount,elapsedSeconds:proof.elapsedSeconds,badRows:proof.rows.filter(r=>r.buriedAbovePlane||r.buriedMuzzles.length||r.blockedRays.length||r.supportBodyRatio>1).map(({id,k,position,buriedAbovePlane,buriedExamples,buriedMuzzles,blockedRays,supportBodyRatio})=>({id,k,position,buriedAbovePlane,buriedExamples,buriedMuzzles,blockedRays,supportBodyRatio}))}));if(!proof.passed)process.exitCode=1;
}
