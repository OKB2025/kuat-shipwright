const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{test}=require('node:test');
const root=path.resolve(__dirname,'..'),{C}=require('../scripts/update-ship-examples.cjs').loadRuntime(root);
const plain=x=>JSON.parse(C.publicJSON(x)),near=(a,b,t=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=t,`${a} != ${b}`),vector=(a,b,t)=>a.forEach((v,i)=>near(v,b[i],t));
function settings(p){const result=plain(p);delete result.engineMountSupport;return result;}
function fixture(rotation={pitch:20}){const ship=C.newShip({L:200,W:100,H:100,assembly:true},'Nozzle foundation');ship.parts=[{id:1,k:'struct',form:'box',c:[50,0,0],s:[100,80,80],...rotation},{id:2,k:'engine',c:[-12,0,0],d:8,nozzleLength:4,dir:[-1,0,0],ratedInputW:123456,shaftCapacityW:234567,reactor:88,machineryId:77,nozzleShare:.6,driveProfileId:'standard',machineryGradeId:'standard',propulsionModelVersion:1,legacyCoolingInputW:0}];ship.nextId=3;ship.fits=[];ship.hatches=[];ship.links=[];ship.groups=[];ship.armor={hull:0,cit:0};return {ship,parent:ship.parts[0],engine:ship.parts[1]};}
function frame(p){const fw=C.mul(C.norm(p.dir||[-1,0,0]),-1);let rt=C.norm(C.cross(fw,[0,1,0]));if(C.len(rt)<.01)rt=[0,0,1];const up=C.norm(C.cross(rt,fw)),angle=(p.roll||0)*Math.PI/180;return {fw,up:C.add(C.mul(up,Math.cos(angle)),C.mul(rt,Math.sin(angle))),rt:C.sub(C.mul(rt,Math.cos(angle)),C.mul(up,Math.sin(angle)))};}
function world(p,q){const f=frame(p);return C.add(p.c,C.add(C.mul(f.fw,q[0]),C.add(C.mul(f.up,q[1]),C.mul(f.rt,q[2]))));}
function supportPoint(p,q){const f=frame(p),o=world(p,p.engineMountSupport.origin);return C.add(o,C.add(C.mul(f.up,q[0]),C.add(C.mul(f.rt,q[1]),C.mul(p.dir,q[2]))));}
function build(row){const source=settings(row.engine),volume=C.partVolume(row.engine),support=C.buildEngineMountSupport(row.ship,row.engine,row.parent);assert.ok(support,row.engine._engineMountSupportError||'a real gap requires a foundation');assert.deepEqual(settings(row.engine),source,'generating a foundation cannot alter the engine or its functional ownership');near(C.partVolume(row.engine),volume);return geometry(row.engine);}
function geometry(p){const g=C.engineMountSupportGeometry(null,p);assert.ok(g&&g.volume>0&&g.connected);assert.ok(g.tris.length&&g.tris.length%9===0);assert.ok(Array.from(g.tris).every(Number.isFinite));near(C.meshVolume(g.tris),g.volume,Math.max(1e-5,g.volume*1e-6));for(let i=0;i<g.tris.length;i++)assert.ok(g.tris[i]>=g.bounds[i%3]-1e-5&&g.tris[i]<=g.bounds[i%3+3]+1e-5);closed(g.tris);return g;}
function closed(tris){
 // Compare directed edge coverage on complete lines, so valid triangular
 // subdivisions cannot disguise a missing side or be mistaken for a hole.
 const epsilon=1e-5,lines=new Map();let signed=0;const origin=Array.from(tris.slice(0,3));
 for(let i=0;i<tris.length;i+=9){const v=[0,3,6].map(j=>Array.from(tris.slice(i+j,i+j+3))),normal=C.cross(C.sub(v[1],v[0]),C.sub(v[2],v[0]));assert.ok(C.len(normal)>1e-10,'no zero-area support triangles');signed+=C.dot(C.sub(v[0],origin),C.cross(C.sub(v[1],origin),C.sub(v[2],origin)))/6;
  for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3];let d=C.norm(C.sub(b,a));const axis=[0,1,2].reduce((k,n)=>Math.abs(d[n])>Math.abs(d[k])?n:k,0);if(d[axis]<0)d=C.mul(d,-1);const moment=C.cross(a,d),key=d.map(n=>Math.round(n/epsilon)).concat(moment.map(n=>Math.round(n/epsilon))).join(','),x=C.dot(a,d),y=C.dot(b,d),events=lines.get(key)||[];events.push([Math.min(x,y),x<y?1:-1],[Math.max(x,y),x<y?-1:1]);lines.set(key,events);}
 }
 assert.ok(signed>0,'support winding encloses positive material');
 for(const events of lines.values()){events.sort((a,b)=>a[0]-b[0]);let balance=0,last=events[0][0];for(let i=0;i<events.length;){const x=events[i][0];if(x-last>epsilon)assert.equal(balance,0,'every physical edge has an oppositely wound neighbour');let delta=0;while(i<events.length&&events[i][0]-x<=epsilon)delta+=events[i++][1];balance+=delta;last=x;}assert.equal(balance,0);}
}

test('four-sided nozzle roots use a closed twelve-triangle solid on flat and sloped sterns',()=>{
 for(const pitch of [0,20,-20]){const row=fixture({pitch}),g=build(row),{engine,parent}=row,normal=C.worldStruct({...parent,c:[0,0,0]},[-1,0,0]),face=C.worldStruct(parent,[-50,0,0]),flange=world(engine,engine.engineMountSupport.origin);assert.equal(engine.engineMountSupport.parentId,parent.id);assert.equal(engine.engineMountSupport.top,0);assert.equal(engine.engineMountSupport.footprintSegments,4);assert.equal(g.tris.length/9,12,'a planar four-sided wedge needs only twelve triangles');vector(engine.dir,[-1,0,0]);
  const midpoint=[flange[0]-1,(g.bounds[1]+g.bounds[4])/2,(g.bounds[2]+g.bounds[5])/2],skin=C.rayPart(midpoint,[1,0,0],parent),area=(g.bounds[4]-g.bounds[1])*(g.bounds[5]-g.bounds[2]);assert.ok(skin);near(g.volume,area*(skin.p[0]-flange[0]),Math.max(1e-4,g.volume*1e-6));
  for(const poly of engine.engineMountSupport.polys)for(const point of poly){const p=supportPoint(engine,point);near(C.dot(normal,C.sub(p,face)),0,2e-5);assert.ok(p[0]>=flange[0]-1e-5,'the foundation fills only the gap behind the fixed flange');}
  const radius=Math.min(g.bounds[4]-g.bounds[1],g.bounds[5]-g.bounds[2])/4;for(const y of [-radius,0,radius])for(const z of [-radius,0,radius]){const hit=C.rayTris(g.tris,[flange[0]-1,y,z],[1,0,0]);assert.ok(hit,'the centre and interior of the flange footprint are supported');near(hit.p[0],flange[0],2e-5);}
 }
});

test('the foundation contributes structural mass without changing engine volume or rated power',()=>{
 const row=fixture(),v=C.partVolume(row.engine),rating=row.engine.ratedInputW,g=build(row),S=C.computeStats(row.ship),control=plain(row.ship);control.parts.find(p=>p.id===2).c[0]=-1000;delete control.parts.find(p=>p.id===2).engineMountSupport;const base=C.computeStats(control);near(S.engineSupportVolume,g.volume,1e-4);near(S.engineSupportMass,g.volume*.3,1e-4);near(S.mass-base.mass,S.engineSupportMass,1e-4);near(C.partVolume(row.engine),v);assert.equal(row.engine.ratedInputW,rating);assert.equal(row.engine.machineryId,77);assert.equal(row.engine.reactor,88);
});

test('pure geometry reads need no ship and the same engine remains selectable through its foundation',()=>{
 const row=fixture(),g=build(row),source=C.publicJSON(row.ship),p=plain(row.engine),client={...row.ship,_client:true};C.syncEngineMountSupports(client);const projected=C.engineMountSupportGeometry(null,p);near(projected.volume,g.volume);vector(Array.from(projected.tris),Array.from(g.tris),1e-6);assert.equal(C.publicJSON(row.ship),source,'client reads do not rewrite foundation input');const hit=C.rayPart([0,0,0],[-1,0,0],row.engine);assert.ok(hit?.engineSupport);assert.equal(hit.part.id,row.engine.id);
});

test('a flush flange needs no extra hardware and a lost parent cannot leave a fake foundation',()=>{
 const flush=fixture({});flush.engine.c[0]=-2;const source=settings(flush.engine);assert.equal(C.buildEngineMountSupport(flush.ship,flush.engine,flush.parent),null);assert.equal(C.engineMountSupportGeometry(null,flush.engine),null);assert.deepEqual(settings(flush.engine),source);
 const row=fixture();build(row);const original=settings(row.engine);row.ship.parts=[row.engine];C.syncEngineMountSupports(row.ship);assert.equal(C.engineMountSupportGeometry(null,row.engine),null);assert.deepEqual(settings(row.engine),original);assert.equal(row.ship.parts.length,1);
});

test('save and reload preserve the closed foundation and the untouched engine settings',()=>{
 const row=fixture(),g=build(row),before=settings(row.engine),loaded=C.deserialize(C.serialize(row.ship)),p=loaded.parts.find(p=>p.id===2),after=geometry(p);assert.deepEqual(settings(p),before);near(after.volume,g.volume,1e-4);vector(Array.from(after.tris),Array.from(g.tris),2e-5);assert.equal(loaded.parts.filter(p=>p.k==='engine').length,1);
});

test('a rigid rotation carries the stored foundation with the nozzle and regeneration keeps its material volume',()=>{
 const row=fixture(),g=build(row),angle=37*Math.PI/180,rotate=v=>[v[0]*Math.cos(angle)-v[2]*Math.sin(angle),v[1],v[0]*Math.sin(angle)+v[2]*Math.cos(angle)];row.engine.c=rotate(row.engine.c);row.engine.dir=rotate(row.engine.dir);row.parent.c=rotate(row.parent.c);row.parent.yaw=37;const carried=geometry(row.engine);for(let i=0;i<g.tris.length;i+=3)vector(Array.from(carried.tris.slice(i,i+3)),rotate(Array.from(g.tris.slice(i,i+3))),2e-5);C.syncEngineMountSupports(row.ship);const regenerated=geometry(row.engine);near(regenerated.volume,g.volume,Math.max(1e-4,g.volume*2e-4));assert.equal(row.engine.d,8);assert.equal(row.engine.ratedInputW,123456);
});

test('a mirrored stern and nozzle regenerate a mirrored closed foundation without changing nozzle dimensions',()=>{
 const row=fixture({pitch:20,yaw:17});row.engine.c[2]=5;const g=build(row),parent=C.mirrorPart(row.parent,row.ship),engine=C.mirrorPart(row.engine,row.ship);parent.id=3;engine.id=4;row.ship.parts=[parent,engine];C.syncEngineMountSupports(row.ship);const mirrored=geometry(engine);near(mirrored.volume,g.volume,Math.max(1e-4,g.volume*2e-4));near(mirrored.bounds[2],-g.bounds[5],2e-4);near(mirrored.bounds[5],-g.bounds[2],2e-4);assert.equal(engine.d,8);assert.equal(engine.nozzleLength,4);vector(engine.dir,[-1,0,0]);
});

test('the uploaded Imperial hull closes real gaps behind auxiliary nozzles 55, 56 and 57 without remapping their plant',()=>{
 const source=JSON.parse(fs.readFileSync(path.join(root,'assets/source/imperial-ii-user-layout/imperial-ii-upload.json'),'utf8')),ship=plain(source);ship.parts=ship.parts.filter(p=>p.id===178||[55,56,57].includes(p.id));ship.fits=[];ship.hatches=[];ship.links=[];ship.groups=[];ship.hull.assembly=true;const parent=ship.parts.find(p=>p.id===178);
 for(const id of [55,56,57]){const engine=ship.parts.find(p=>p.id===id),g=build({ship,parent,engine});assert.ok(g.volume>1);assert.equal(engine.machineryId,source.parts.find(p=>p.id===id).machineryId);assert.equal(engine.reactor,source.parts.find(p=>p.id===id).reactor);vector(engine.dir,[-1,0,0]);for(const poly of engine.engineMountSupport.polys){const q=[0,1,2].map(i=>poly.reduce((n,p)=>n+p[i],0)/poly.length),point=supportPoint(engine,q),origin=C.add(point,C.mul(engine.dir,300)),hit=C.rayPart(origin,C.mul(engine.dir,-1),parent);assert.ok(hit,'every support patch reaches the selected real hull');near(C.len(C.sub(hit.p,point)),0,2e-3);}}
});

test('a foundation uses real current triangle contact rather than only its parent ID or cached volume',()=>{
 const row=fixture();build(row);assert.equal(C.engineMountSupportContact(row.ship,row.engine,row.parent).connected,true);row.parent.c[1]+=5;const stale=C.engineMountSupportContact(row.ship,row.engine,row.parent);assert.equal(stale.connected,false);assert.equal(stale.reason,'parent-stale');C.syncEngineMountSupports(row.ship);assert.equal(C.engineMountSupportContact(row.ship,row.engine,row.parent).connected,true);
 const elsewhere={...plain(row.parent),id:3,c:[50,300,0]};row.ship.parts.push(elsewhere);assert.equal(C.engineMountSupportContact(row.ship,row.engine,elsewhere).connected,false,'a parent ID or bounding volume cannot establish a separate actual contact');
});

test('saved foundation volume is measured from its mesh and corrupted mesh caches are discarded before reuse',()=>{
 const row=fixture(),g=build(row),saved=C.serialize(row.ship),record=saved.parts.find(p=>p.id===2);record.engineMountSupport.volume=1e12;const measured=C.deserialize(saved,{deferPlacementGeometry:true}).parts.find(p=>p.id===2);near(C.engineMountSupportGeometry(null,measured).volume,g.volume,1e-5);
 record.engineMountSupport.localTriangles[3]+=1;const restored=C.deserialize(saved,{deferPlacementGeometry:true}),part=restored.parts.find(p=>p.id===2);assert.equal(C.engineMountSupportGeometry(null,part),null);assert.equal(part.engineMountSupport.sourceKey,'');C.syncEngineMountSupports(restored);assert.ok(C.engineMountSupportGeometry(null,part)?.volume>0);assert.equal(C.engineMountSupportContact(restored,part,restored.parts.find(p=>p.id===1)).connected,true);
});

test('deleting the first support can retain a nozzle through its foundation contact with a different surviving structure',()=>{
 const row=fixture();build(row);const old=row.engine.engineMountSupport,point=world(row.engine,old.origin),hit=C.rayPart(C.add(point,[50,0,0]),[-1,0,0],row.parent);assert.ok(hit);
 row.engine.placement={modelVersion:C.PLACEMENT_MODEL_VERSION,mode:'direct',geometryRevision:0,parentStructureId:1,parentLocalAnchor:C.localStruct(row.parent,row.engine.c),surfaceAnchor:C.localStruct(row.parent,hit.p),contactNormal:hit.n,contactLocalNormal:C.localStruct({...row.parent,c:[0,0,0]},hit.n),anchorDimensions:[100,80,80],rigidPose:{offset:C.localStruct({...row.parent,c:[0,0,0]},C.sub(row.engine.c,hit.p)),forward:[1,0,0],up:[0,1,0],direction:[-1,0,0]},requestedGeometry:settings(row.engine)};
 const alternate={...plain(row.parent),id:3};row.ship.parts.push(alternate);assert.equal(C.engineMountSupportContact(row.ship,row.engine,alternate).connected,true);const before=settings(row.engine),r=C.removeParts(row.ship,[1]);assert.equal(r.ok,true);assert.ok(row.ship.parts.some(p=>p.id===2));assert.equal(row.engine.placement.parentStructureId,3);assert.equal(row.engine.engineMountSupport.parentId,3);assert.equal(C.engineMountSupportContact(row.ship,row.engine,alternate).connected,true);vector(row.engine.c,before.c);assert.equal(row.engine.ratedInputW,123456);
});


test('an obsolete circular-root cache is regenerated with the current four-sided footprint',()=>{
 const row=fixture();build(row);const old=row.engine.engineMountSupport;old.sourceKey='previous-round-flange-model';old.footprintSegments=24;const source=settings(row.engine);C.buildEngineMountSupport(row.ship,row.engine,row.parent);assert.notEqual(row.engine.engineMountSupport,old);assert.notEqual(row.engine.engineMountSupport.sourceKey,old.sourceKey);assert.equal(row.engine.engineMountSupport.footprintSegments,4);assert.equal(geometry(row.engine).tris.length/9,12);assert.deepEqual(settings(row.engine),source);
});

test('editing a native hull trench invalidates the nozzle foundation source cache',()=>{
 const s=C.newShip({plan:'rect',sec:'rect',L:100,W:80,H:100,bowW:1,bowH:1,stern:1,bowFree:true}),p={id:1,k:'engine',c:[-12,50,0],d:8,nozzleLength:4,dir:[-1,0,0]};s.parts=[p];s.nextId=2;C.syncEngineMountSupports(s);assert.ok(p.engineMountSupport);const old=p.engineMountSupport.sourceKey;s.trenches=[{id:2,mode:'split',from:0,to:.9,level:.5,height:20,depth:10,side:'both',taper:false}];C.syncEngineMountSupports(s);assert.ok(p.engineMountSupport);assert.notEqual(p.engineMountSupport.sourceKey,old);const next=p.engineMountSupport.sourceKey;C.syncEngineMountSupports(s);assert.equal(p.engineMountSupport.sourceKey,next,'unchanged geometry reuses its current cache');
});
