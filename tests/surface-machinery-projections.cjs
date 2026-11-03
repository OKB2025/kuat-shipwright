const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {projectionSpans,primaryGeometry}=require('./helpers/surface-geometry.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture({rotate=false,cut=false}={}){
 const ship=C.newShip({L:400,W:200,H:180,assembly:true},'Round attached machinery');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;
 const host=C.placePart(ship,'struct',[200,90,0],[240,80,100],{form:'box',...(rotate?{yaw:21,pitch:17,roll:9}:{})},false);host.paint='#b0b0b0';
 if(cut){const at=C.worldStruct(host,[0,0,0]);ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:at,s:[18,200,20],structures:true}));}
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face==='port'&&p.exposed);assert.ok(patch);
 assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:40,sensors:30,habitation:30},equipment:{kind:'hdis',depth:1},battery:{count:0},style:{depth:4,density:0,seed:37}}).ok,true);
 return {ship,host,patch};
}
function model(ship,opt={}){const rows=G.surfaceVisualPlan(ship,{detail:0,maxDetails:0,...opt}),ranges={},meshes=G.meshSurfaceLayers(ship,ranges,{detail:0,maxDetails:0,...opt});return {rows,ranges,meshes,projections:rows.flatMap(r=>r.projections||[])};}
function points(T){const out=[];for(let i=0;i<T.length;i+=3)out.push(Array.from(T.slice(i,i+3)));return out;}
function triangles(T){const out=[];for(let i=0;i<T.length;i+=9)out.push([0,3,6].map(j=>Array.from(T.slice(i+j,i+j+3))));return out;}
function normals(T){return triangles(T).map(t=>C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))));}
function spanTriangles(g,span){const out=[];for(let i=span.start;i<span.start+span.count;i++)out.push(...g.pos.slice(g.idx[i]*3,g.idx[i]*3+3));return out;}
function area(t){return C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2;}
function envelope(q,patch){
 assert.ok(q.maxOutset>0&&q.maxOutset<=3.5,'an attachment cannot claim an unbounded projection exception');
 const D=C.dot(patch.center,q.normal);
 for(const p of points(q.triangles)){
  for(let k=0;k<3;k++)assert.ok(p[k]>=q.bounds[k]-.0001&&p[k]<=q.bounds[k+3]+.0001,'declared world envelope must contain every emitted attachment vertex');
  const uv=[C.dot(p,q.u),C.dot(p,q.v)],z=C.dot(p,q.normal)-D;for(let k=0;k<2;k++)assert.ok(uv[k]>=q.footprint[k]-.0001&&uv[k]<=q.footprint[k+2]+.0001,'a projection must stay within its exact declared face footprint');
  assert.ok(z>=q.normalRange[0]-.0001&&z<=q.normalRange[1]+.0001&&z<=q.maxOutset+.0001,'normal projection must remain in the modest declared envelope');
 }
}

test('round machinery has real radial facets and a horizontal turbine axis, and walks have floors, rails and brackets',()=>{
 const {ship,patch}=fixture(),m=model(ship);assert.deepEqual(plain(m.projections.map(q=>q.kind).sort()),['catwalk','round-housing','turbine']);
 const turbine=m.projections.find(q=>q.kind==='turbine'),P=points(turbine.triangles),N=normals(turbine.triangles),axis=turbine.axis;
 assert.ok(Math.abs(C.dot(axis,patch.normal))<1e-6&&Math.abs(axis[1])<1e-6,'a turbine must run horizontally along its host face');
 const axial=P.map(p=>C.dot(C.sub(p,turbine.center),axis)),radii=P.map(p=>{const d=C.sub(p,turbine.center);return C.len(C.sub(d,C.mul(axis,C.dot(d,axis))));}),diameter=2*Math.max(...radii);assert.ok(Math.max(...axial)-Math.min(...axial)>diameter*2,'round machinery must be an elongated horizontal cylinder, not a painted circle');
 const radial=N.filter(n=>Math.abs(C.dot(n,axis))<.2);assert.ok(new Set(radial.map(n=>n.map(x=>x.toFixed(2)).join(','))).size>=8,'a low-poly cylinder needs multiple actual radial normal directions');assert.ok(radial.some(n=>C.dot(n,patch.normal)>.65)&&radial.some(n=>C.dot(n,patch.normal)<-.65),'the cylinder must have a volumetric radial cross section');
 const dome=m.projections.find(q=>q.kind==='round-housing'),D=points(dome.triangles),DN=normals(dome.triangles),levels=new Set(D.map(p=>C.dot(C.sub(p,dome.anchor),patch.normal).toFixed(2)));assert.ok(levels.size>=4);assert.ok(new Set(DN.filter(n=>Math.abs(C.dot(n,patch.normal))<.95).map(n=>n.map(x=>x.toFixed(2)).join(','))).size>=8,'round housings need real curved silhouette facets');
 const walk=m.projections.find(q=>q.kind==='catwalk'),WT=triangles(walk.triangles),up=[0,1,0],floor=walk.anchor[1],top=WT.filter(t=>C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),up)>.95&&Math.abs(t.reduce((s,p)=>s+p[1],0)/3-floor)<.05),bottom=WT.filter(t=>C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),up)<-.95&&Math.abs(t.reduce((s,p)=>s+p[1],0)/3-(floor-.16))<.05);
 assert.ok(top.reduce((s,t)=>s+area(t),0)>walk.dimensions[0]*walk.catwalkWidth*.8,'a catwalk must emit an actual projecting walking ledge');assert.ok(bottom.reduce((s,t)=>s+area(t),0)>walk.dimensions[0]*walk.catwalkWidth*.8,'the ledge needs a visible underside');
 const WP=points(walk.triangles),rail=WP.filter(p=>p[1]>floor+.75),brackets=WP.filter(p=>p[1]<floor-.7);assert.ok(rail.length>12,'rails and posts must rise above the walking surface');assert.ok(new Set(brackets.map(p=>Math.round(C.dot(C.sub(p,walk.anchor),walk.axis)/(walk.dimensions[0]/8)))).size>=3,'three separated support brackets must reach back below the ledge');
 for(const q of m.projections){envelope(q,patch);assert.ok(q.normalRange[1]>.5,'the requested round machinery and ledges must actually project beyond the base face');}
});

test('only exact attachment index spans receive the projection exception, and their footprints avoid cutouts',()=>{
 for(const rotate of [false,true]){const {ship,host,patch}=fixture({rotate,cut:true}),source=C.publicJSON(ship),m=model(ship),g=m.meshes.surfaceDevices,spans=projectionSpans(m.ranges,'surfaceDevices'),byId=new Map(m.projections.map(q=>[q.id,q]));assert.ok(spans.length>0);
  assert.equal(spans.length,m.projections.length);for(const span of spans){const q=byId.get(span.meta.id);assert.ok(q&&q.kind===span.meta.kind&&span.owner===host.id);assert.deepEqual(spanTriangles(g,span),Array.from(q.triangles),'only the actual declared primitive triangles may be excluded from primary containment');envelope(q,patch);}
  const primary=primaryGeometry(g,m.ranges,'surfaceDevices');for(let i=0;i<primary.n;i++){const p=Array.from(primary.pos.slice(i*3,i*3+3));assert.ok(C.inPart(host,p)||C.inPart(host,C.add(p,C.mul(C.norm(C.sub(host.c,p)),.0005))),'the recessed primary skin keeps its original strict host containment');}
  const visible=patch.exposedTriangles??patch.triangles;for(const q of m.projections)for(const t of triangles(q.triangles)){const center=C.mul(t.reduce((a,p)=>C.add(a,p),[0,0,0]),1/3);assert.ok(C.rayTris(visible,C.add(center,C.mul(patch.normal,20)),C.mul(patch.normal,-1)),'a cylinder, walk or bracket cannot bridge an opening or covered face');}
  assert.equal(C.publicJSON(ship),source);assert.equal(ship.parts.length,1);assert.equal(ship.fits.length,0);
 }
});

test('projection budgets, semantic splits and reloads preserve attachment identities and functional resources',()=>{
 const {ship,host,patch}=fixture(),before=C.computeStats(ship),source=C.publicJSON(ship),m=model(ship),ids=plain(m.projections.map(q=>q.id)),count=m.projections.reduce((s,q)=>s+q.triangles.length/9,0);assert.ok(count>100&&count<=450,'a base face needs a fixed modest attachment triangle budget');assert.equal(model(ship,{maxField:32}).projections.length,0,'a very small visual budget must not bypass the existing coarse mesh limit');assert.ok(model(ship,{maxField:120}).projections.length<=3);assert.equal(C.publicJSON(ship),source);
 const split=C.surfaceSplit(ship,patch.id,'u',.43);assert.equal(split.ok,true,split.why);const divided=model(ship),byId=new Map(divided.projections.map(q=>[q.id,q]));assert.deepEqual([...byId.keys()].sort(),ids.slice().sort(),'a semantic seam cannot drop or duplicate a whole round feature');
 for(const q of m.projections){const T=byId.get(q.id).triangles;assert.equal(T.length,q.triangles.length);for(let i=0;i<T.length;i++)assert.ok(Math.abs(T[i]-q.triangles[i])<.0003,'splitting a face must retain attachment geometry without artificial caps');}
 assert.deepEqual(plain(ship.parts.map(p=>p.id)),[host.id]);assert.equal(ship.fits.length,0);const loaded=C.deserialize(C.serialize(ship));assert.deepEqual(plain(model(loaded).projections.map(q=>q.id).sort()),ids.slice().sort());const after=C.computeStats(loaded);for(const k of ['mass','cost','crew','sensorVolume','explicitHabitationVolume','dissipatorPower'])assert.ok(Math.abs(after[k]-before[k])<=Math.max(1e-6,Math.abs(before[k])*1e-9),k+' cannot depend on attached scenery');
});

test('the emitted neutral skin keeps gray material instead of baking broad black cavities into the paint',()=>{
 const {ship,host,patch}=fixture(),m=model(ship),g=m.meshes.surfaceDevices;let coverage=0,mean=0,dark=0;
 for(const [name,start,count,meta]of m.ranges[host.id])if(name==='surfaceDevices'&&!meta?.projection)for(let i=start;i<start+count;i+=3){const ids=[0,1,2].map(j=>g.idx[i+j]);if(ids.some(k=>g.col[k*4+3]===253))continue;const T=ids.map(k=>Array.from(g.pos.slice(k*3,k*3+3))),n=C.cross(C.sub(T[1],T[0]),C.sub(T[2],T[0])),a=Math.max(0,C.dot(n,patch.normal)/2),tone=ids.reduce((s,k)=>s+g.col[k*4]+g.col[k*4+1]+g.col[k*4+2],0)/(3*528);coverage+=a;mean+=a*tone;if(tone<.4)dark+=a;}
 assert.ok(Math.abs(coverage-patch.exposedArea)<.01);assert.ok(mean/coverage>.68,'the broad neutral machinery material should remain gray before scene lighting');assert.ok(dark/coverage<.05,'small vents may be dark, but cavities cannot paint a large fraction of the face black');
});


function hullFixture(cutCenter){
 const ship=C.newShip({L:400,W:200,H:120,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1,stations:[[0,1,1],[1,1,1]]},'Hull round machinery');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;
 if(cutCenter)ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[cutCenter[0],cutCenter[1],0],s:[12,260,14],structures:false}));
 const faces=C.surfacePatches(ship).filter(p=>p.host==='hull'&&p.face==='port'&&p.exposed);assert.ok(faces.length>0);
 assert.equal(C.setSurfaceConfig(ship,faces.map(p=>p.id),{functionMode:'equipment',allocation:{cooling:40,sensors:30,habitation:30},equipment:{kind:'hdis',depth:1},battery:{count:0},style:{depth:4,density:0,seed:37}}).ok,true);
 return {ship,faces};
}
function clipRect(poly,b){for(const [axis,limit,sign]of [[0,b[0],1],[0,b[2],-1],[1,b[1],1],[1,b[3],-1]]){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],da=(a[axis]-limit)*sign,dc=(c[axis]-limit)*sign;if(da>=-1e-9)out.push(a);if((da<0)!==(dc<0)){const t=da/(da-dc);out.push(a.map((x,j)=>x+(c[j]-x)*t));}}poly=out;if(!poly.length)break;}return poly;}
function area2(poly){return Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;}

test('hull-host attachments have exact nonpart metadata and avoid a new opening at a former attachment site',()=>{
 const {ship}=hullFixture(),source=C.publicJSON(ship),m=model(ship),spans=projectionSpans(m.ranges,'surfaceDevices');assert.ok(m.projections.length>=3,'ordinary planar hull faces need the same actual attached machinery as structural blocks');assert.equal(spans.length,m.projections.length);assert.ok(spans.every(s=>s.owner==='hull'&&s.meta.ownerId==='hull'),'hull scenery metadata must not invent a numeric part or foil owner');
 const byId=new Map(m.projections.map(q=>[q.id,q]));for(const span of spans){const q=byId.get(span.meta.id),row=m.rows.find(r=>r.id===q.patchId);assert.ok(q&&row);assert.deepEqual(spanTriangles(m.meshes.surfaceDevices,span),Array.from(q.triangles));envelope(q,row.patch);}
 const skin=primaryGeometry(m.meshes.surfaceDevices,m.ranges,'surfaceDevices'),center=[200,60,0],seen=new Set();C.hullGeo(ship);ship._lockedCache=ship._cache;try{for(let i=0;i<skin.n;i++){const p=Array.from(skin.pos.slice(i*3,i*3+3)),key=p.map(v=>v.toFixed(5)).join(',');if(seen.has(key))continue;seen.add(key);assert.ok(C.inHull(ship,p)||C.inHull(ship,C.add(p,C.mul(C.norm(C.sub(center,p)),.0005))),'hull primary skin keeps strict containment outside explicit attachment spans: '+p);}}finally{delete ship._lockedCache;}assert.equal(C.publicJSON(ship),source);assert.equal(ship.parts.length,0);assert.equal(ship.fits.length,0);
 const target=m.rows.find(r=>r.projections?.length),ids=plain(m.projections.map(q=>q.id)).sort(),split=C.surfaceSplit(ship,target.id,'u',.43);assert.equal(split.ok,true,split.why);assert.deepEqual(plain(model(ship).projections.map(q=>q.id)).sort(),ids,'a hull semantic split cannot drop, duplicate or retag attached features');
 const former=m.projections.find(q=>q.kind==='turbine')||m.projections[0],cutCenter=former.anchor,{ship:cut}=hullFixture(cutCenter),opened=model(cut),hole=[cutCenter[0]-6,cutCenter[1]-7,cutCenter[0]+6,cutCenter[1]+7];assert.ok(opened.projections.length>0);
 for(const q of opened.projections)for(const tri of triangles(q.triangles))assert.ok(area2(clipRect(tri.map(p=>[p[0],p[1]]),hole))<.0002,'an attached cylinder, housing or ledge cannot bridge the new opening at its previous site');
});

test('many planar base faces share a global projection budget and retain multiple machinery kinds',()=>{
 const ship=C.newShip({L:500,W:500,H:180,assembly:true},'Distributed round machinery');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;
 for(let i=0;i<12;i++)C.placePart(ship,'struct',[60+(i%4)*110,70,Math.floor(i/4)*110],[80,60,80],{form:'box'},false);
 const faces=C.surfacePatches(ship).filter(p=>p.face==='port'&&p.exposed);assert.equal(faces.length,12);assert.equal(C.setSurfaceConfig(ship,faces.map(p=>p.id),{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:.2},battery:{count:0},style:{depth:1,density:0,seed:37}}).ok,true);
 const source=C.publicJSON(ship),maxField=360,m=model(ship,{maxField}),kinds=new Set(m.projections.map(q=>q.kind)),bases=new Set(m.projections.map(q=>q.baseId));
 assert.ok(m.projections.length>=3&&m.projections.length<=Math.floor(maxField/40),'fractional per-base shares must not discard a useful global projection budget');assert.ok(bases.size>=3,'round machinery cannot all be allocated to the first face');assert.ok(kinds.size>=2,'partial quotas must not collapse every face to the first machinery kind');
 assert.ok(m.projections.reduce((n,q)=>n+q.triangles.length/9,0)<=Math.floor(maxField/40)*240,'many faces still share one finite attachment triangle budget');assert.equal(model(ship,{maxField:32}).projections.length,0,'an explicitly tiny total budget must not be multiplied by the number of faces');assert.equal(C.publicJSON(ship),source);const target=m.rows.find(r=>r.projections?.length),ids=plain(m.projections.map(q=>q.id)).sort(),split=C.surfaceSplit(ship,target.id,'u',.43);assert.equal(split.ok,true,split.why);assert.deepEqual(plain(model(ship,{maxField}).projections.map(q=>q.id)).sort(),ids,'subdivision rounding cannot trade equal base faces fractional quotas or change their equipment kinds');assert.equal(ship.parts.length,12);assert.equal(ship.fits.length,0);
});

test('deep visual recesses cannot turn attached machinery into long normal pylons',()=>{
 const {ship,patch}=fixture();assert.equal(C.setSurfaceConfig(ship,patch.id,{style:{depth:30}}).ok,true);const source=C.publicJSON(ship),m=model(ship);assert.ok(m.rows.some(r=>r.reliefFaces?.length>0));
 for(const q of m.projections){
  assert.ok(Number.isFinite(q.attachmentReach)&&q.attachmentReach>=0&&q.attachmentReach<=q.maxAttachmentReach+.0001,'deep faces must reject or shorten scenery whose bracket would span the whole recess');
  const extent=q.normalRange[1]-q.normalRange[0];if(q.kind==='turbine')assert.ok(extent<=q.dimensions[1]*1.7+2,'a turbine must keep a compact radial cross section instead of growing a normal pylon');else if(q.kind==='round-housing')assert.ok(extent<=3.5+.0001,'round equipment cannot become a tall conical extrusion');else if(q.kind==='catwalk')assert.ok(q.attachmentReach<=q.catwalkWidth*2+.0001&&extent<4,'a short walk cannot use a deep wall-sized support web');
 }
 assert.equal(C.publicJSON(ship),source);assert.equal(ship.parts.length,1);assert.equal(ship.fits.length,0);
});
