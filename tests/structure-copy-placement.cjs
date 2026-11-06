const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,tol=1e-6)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,`${a} != ${b}`),vectorNear=(a,b,tol=1e-6)=>a.forEach((v,i)=>near(v,b[i],tol)),publicState=s=>C.publicJSON(s);
function empty(){const s=C.newShip({L:300,W:160,H:120,sec:'rect',plan:'rect',assembly:true},'Structure copy fixture');s.parts=[];s.fits=[];s.links=[];s.groups=[];s.armor={hull:0,cit:0};s.nextId=1;return s;}
function structure(){return {id:1,k:'struct',form:'trap',c:[108,54,-14],s:[2,1.4,1.2],angles:[12,-6,8,3],yaw:13,pitch:7,roll:-11};}
function rotate(point,center,axis,angle){const q=point.map((v,i)=>v-center[i]),co=Math.cos(angle),si=Math.sin(angle),r=q.slice();if(axis===0){r[1]=co*q[1]-si*q[2];r[2]=si*q[1]+co*q[2];}else if(axis===1){r[0]=co*q[0]+si*q[2];r[2]=-si*q[0]+co*q[2];}else{r[0]=co*q[0]-si*q[1];r[1]=si*q[0]+co*q[1];}return r.map((v,i)=>v+center[i]);}
function points(part){const t=C.structTriangles(part),out=[];for(let i=0;i<t.length;i+=3)out.push(Array.from(t.slice(i,i+3)));return out;}
function meshMatches(part,source,transform){const expected=source.map(transform),actual=points(part);assert.equal(actual.length,expected.length);for(const p of actual)assert.ok(expected.some(q=>Math.hypot(...p.map((v,i)=>v-q[i]))<3e-5),'every copied corner must undergo the same rigid transform');}
function assertUnique(ship){const ids=[...ship.parts,...ship.fits,...(ship.groups||[])].map(p=>p.id);assert.equal(ids.length,new Set(ids).size);assert.ok(ship.nextId>Math.max(...ids));}
for(const axis of [0,1,2])test('rotational copies preserve full orientation around axis '+axis,()=>{
 const s=empty(),p=structure(),center=[100,50,-20];s.parts=[p];s.nextId=2;const before=publicState(p),mesh=points(p),r=C.placeRotationalCopies(s,{parts:[1],fits:[]},{center,axis,count:4});assert.equal(r.ok,true,r.error);assert.equal(r.copies.length,3);assert.equal(r.parts.length,3);assert.equal(s.parts.length,4);assert.equal(publicState(p),before,'rotation leaves the original untouched');
 r.copies.forEach((copy,i)=>{const q=s.parts.find(p=>p.id===copy.parts[0]),angle=(i+1)*Math.PI/2;vectorNear(q.c,rotate(p.c,center,axis,angle));meshMatches(q,mesh,v=>rotate(v,center,axis,angle));near(C.partVolume(q),C.partVolume(p),1e-5);});assertUnique(s);
});

test('linear copy endpoints include the unchanged original part position',()=>{
 const s=empty(),p=structure();s.parts=[p];s.nextId=2;const anchor=p.c.slice(),mesh=points(p),before=publicState(p),r=C.placeLinearCopies(s,{parts:[1],fits:[]},{end:[anchor[0]+20,anchor[1]+10,anchor[2]-6],count:3});assert.equal(r.ok,true,r.error);assert.equal(r.copies.length,2);assert.equal(publicState(p),before);
 r.copies.forEach((copy,i)=>{const q=s.parts.find(p=>p.id===copy.parts[0]),delta=[10,5,-3].map(v=>v*(i+1));vectorNear(q.c,p.c.map((v,k)=>v+delta[k]));meshMatches(q,mesh,v=>v.map((x,k)=>x+delta[k]));});assertUnique(s);
});

test('an explicit linear start translates the original and all copied geometry consistently',()=>{
 const s=empty(),p=structure();s.parts=[p];s.nextId=2;const anchor=p.c.slice(),original=plain(p),mesh=points(p),start=[20,-4,8],end=[80,26,-10],r=C.placeLinearCopies(s,{parts:[1],fits:[]},{start,end,count:4});assert.equal(r.ok,true,r.error);const groups=[r.original,...r.copies];assert.equal(groups.length,4);
 groups.forEach((copy,i)=>{const q=s.parts.find(p=>p.id===copy.parts[0]),at=start.map((v,k)=>v+(end[k]-v)*i/3),delta=at.map((v,k)=>v-anchor[k]);vectorNear(q.c,original.c.map((v,k)=>v+delta[k]));meshMatches(q,mesh,v=>v.map((x,k)=>x+delta[k]));});assertUnique(s);
});

function engineGroup(){const s=empty(),R=1e18;s.parts=[{id:1,k:'gen',c:[100,30,0],d:10},{id:2,k:'engineCore',c:[80,30,0],dir:[-1,0,0],d:4,length:8,reactor:1,busFeed:true,propulsionModelVersion:1,ratedInputW:R,driveProfileId:'standard',machineryGradeId:'standard'},...[-8,8].map((z,i)=>({id:3+i,k:'engine',c:[50,30,z],dir:[-1,0,0],d:4,nozzleLength:4,reactor:1,machineryId:2,propulsionModelVersion:1})),{id:5,k:'hdis',c:[80,44,0],d:4},{id:6,k:'struct',form:'trap',c:[70,55,0],s:[6,6,4],angles:[0,0,0,0]}];s.fits=[{id:7,k:'pd',p:[70,57,0],a:2,n:[0,1,0],ped:0,base:0,low:0,host:6,local:[0,.5,0],localNormal:[0,1,0]}];s.links=[{kind:'power',from:'p1',to:'p2',cap:R},{kind:'heat',from:'p2',to:'p5',cap:R}];s.nextId=8;return s;}

test('rotational groups remap independent engine owners, fits and both physical network kinds',()=>{
 const s=engineGroup(),ids={parts:[1,2,3,4,5,6],fits:[7]},r=C.placeRotationalCopies(s,ids,{center:[0,0,0],axis:1,count:3});assert.equal(r.ok,true,r.error);assert.equal(r.copies.length,2);
 for(const copy of r.copies){const m=new Map(ids.parts.map((id,i)=>[id,copy.parts[i]])),core=s.parts.find(p=>p.id===m.get(2));assert.equal(core.reactor,m.get(1));for(const id of [3,4]){const nozzle=s.parts.find(p=>p.id===m.get(id));assert.equal(nozzle.machineryId,m.get(2));assert.equal(nozzle.reactor,m.get(1));vectorNear(nozzle.dir,core.dir);}const f=s.fits.find(f=>f.id===copy.fits[0]);assert.equal(f.host,m.get(6));assert.ok(s.links.some(l=>l.kind==='power'&&l.from==='p'+m.get(1)&&l.to==='p'+m.get(2)&&l.cap===1e18));assert.ok(s.links.some(l=>l.kind==='heat'&&l.from==='p'+m.get(2)&&l.to==='p'+m.get(5)&&l.cap===1e18));}
 assert.equal(s.parts.filter(p=>p.k==='gen').length,3);assert.equal(s.parts.filter(p=>p.k==='engineCore').length,3);assertUnique(s);
});

test('copying an externally funded engine keeps the same finite existing reactor and cooler',()=>{
 const s=engineGroup(),r=C.placeRotationalCopies(s,{parts:[2,3,4],fits:[]},{center:[0,0,0],axis:1,count:3});assert.equal(r.ok,true,r.error);const coreIds=[2,...r.copies.map(copy=>copy.parts[0])];assert.equal(s.parts.filter(p=>p.k==='gen').length,1);assert.equal(s.parts.filter(p=>p.k==='hdis').length,1);
 for(const id of coreIds){assert.equal(s.parts.find(p=>p.id===id).reactor,1);assert.ok(s.links.some(l=>l.kind==='power'&&l.from==='p1'&&l.to==='p'+id));assert.ok(s.links.some(l=>l.kind==='heat'&&l.from==='p'+id&&l.to==='p5'));}
 const power=C.allocateConnectedPower({sources:[{id:'p1',domain:'main',powerW:1e18}],links:s.links.filter(l=>l.kind==='power'),loads:coreIds.map(id=>({id:'engine:'+id,kind:'engines',port:'p'+id,domain:'main',requestedInputW:1e18})),mode:'balanced'});near(power.draw,1e18,1e8);near(power.engines,1e18,1e8);assert.ok(power.consumers.every(c=>c.grantedInputW>0&&c.grantedInputW<1e18));assertUnique(s);
});

test('copy validation and a collision at a later line position fail without partial mutation',()=>{
 for(const action of [s=>C.placeRotationalCopies(s,{parts:[1],fits:[]},{center:[0,0,0],axis:9,count:3}),s=>C.placeRotationalCopies(s,{parts:[1],fits:[]},{center:[NaN,0,0],axis:1,count:3}),s=>C.placeLinearCopies(s,{parts:[1],fits:[]},{end:[20,0,0],count:33}),s=>C.placeLinearCopies(s,{parts:[1],fits:[]},{end:[20,0,0],count:3})]){const s=empty();s.parts=[{id:1,k:'gen',c:[0,0,0],d:2},{id:2,k:'gen',c:[20,0,0],d:2}];s.nextId=3;const before=publicState(s),r=action(s);assert.equal(r.ok,false,'invalid or colliding copies must be rejected');assert.ok(r.error);assert.equal(publicState(s),before,'a valid earlier copy cannot leak through a later failure');}
});

test('assembly copies roundtrip with their real mass and cost and no injected hull',()=>{
 const s=empty(),p=structure();s.parts=[p];s.nextId=2;const before=C.computeStats(s),anchor=p.c.slice(),r=C.placeLinearCopies(s,{parts:[1],fits:[]},{end:[anchor[0]+40,anchor[1],anchor[2]],count:3});assert.equal(r.ok,true,r.error);const after=C.computeStats(s);assert.equal(s.parts.length,3);assert.equal(s.hull.assembly,true);assert.equal(s.parts.filter(p=>p.form==='hull').length,0);near(after.mass,before.mass*3,1e-5);near(after.volume,before.volume*3,1e-4);near(after.cost,before.cost*3,2);
 const saved=plain(C.serialize(s)),loaded=C.deserialize(saved),again=C.computeStats(loaded);assert.equal(loaded.parts.length,3);assert.equal(loaded.hull.assembly,true);assert.equal(loaded.parts.filter(p=>p.form==='hull').length,0);near(again.mass,after.mass,1e-5);near(again.volume,after.volume,1e-4);near(again.cost,after.cost,2);for(const q of loaded.parts){const old=s.parts.find(p=>p.id===q.id);assert.ok(old);assert.equal(q.k,old.k);assert.equal(q.form,old.form);vectorNear(q.c,old.c);vectorNear(q.s,old.s);meshMatches(q,points(old),v=>v);}assertUnique(loaded);
});

test('rotational copies retain native casing roll independently of compact machinery',()=>{
 const s=empty(),source=C.sourceEngine({skinAsset:'ven_inner_port'}),p={...C.equipmentOptions('exposedTurbine'),id:1,k:'engine',c:[108,54,-14],dir:[-1,0,0],d:6,skinAsset:'ven_inner_port',skinAnchor:Array.from(source.anchor),skinDiameter:source.d};C.resizeEngine(p,6,C.engineBaseline('exposed',6,'length'));Object.assign(p,{propulsionModelVersion:1,ratedInputW:1e16,driveProfileId:'standard',machineryGradeId:'standard',machineryShape:'cylinder',machineryLengthM:2,machineryRadiusM:.6,machineryOffsetM:p.nozzleLength/2});s.parts=[p];s.nextId=2;const center=[100,50,-20],original=Array.from(C.engineSkinMesh(p).pos),r=C.placeRotationalCopies(s,{parts:[1],fits:[]},{center,axis:0,count:4});assert.equal(r.ok,true,r.error);
 const check=(ship,id,index)=>{const q=ship.parts.find(p=>p.id===id),mesh=C.engineSkinMesh(q).pos,angle=index*Math.PI/2;vectorNear(q.dir,[-1,0,0]);assert.equal(mesh.length,original.length);for(let i=0;i<mesh.length;i+=3)vectorNear(Array.from(mesh.slice(i,i+3)),rotate(original.slice(i,i+3),center,0,angle),3e-5);near(q.machineryLengthM,2);near(q.machineryRadiusM,.6);};
 r.copies.forEach((copy,i)=>check(s,copy.parts[0],i+1));const loaded=C.deserialize(plain(C.serialize(s)));assert.equal(loaded.parts.length,4);r.copies.forEach((copy,i)=>check(loaded,copy.parts[0],i+1));assertUnique(loaded);
});

test('rotational copies carry authored turret heading and muzzles with their host',()=>{
 for(const axis of [0,1,2]){const s=empty(),p={...structure(),s:[6,4,2],angles:[0,0,0,0],yaw:0,pitch:0,roll:0},f={id:2,k:'pd',p:[108,55,-14],a:2,n:[0,1,0],ped:0,base:0,low:0,host:1,local:[0,.5,0],localNormal:[0,1,0],assetYaw:17};s.parts=[p];s.fits=[f];s.nextId=3;const original=C.authoredTurretGeometry(f);assert.ok(original,'the authored point-defense model exposes real joints and muzzles');const center=[100,50,-20],r=C.placeRotationalCopies(s,{parts:[1],fits:[2]},{center,axis,count:4});assert.equal(r.ok,true,r.error);
  const check=ship=>r.copies.forEach((copy,i)=>{const q=ship.fits.find(f=>f.id===copy.fits[0]),g=C.authoredTurretGeometry(q),angle=(i+1)*Math.PI/2;assert.equal(q.host,copy.parts[0]);assert.ok(g);for(const key of ['yawPivot','elevationPivot'])vectorNear(g[key],rotate(original[key],center,axis,angle),3e-5);for(const key of ['axis','fw'])vectorNear(g[key],rotate(original[key],[0,0,0],axis,angle),3e-6);assert.equal(g.muzzles.length,original.muzzles.length);g.muzzles.forEach((m,j)=>vectorNear(m,rotate(original.muzzles[j],center,axis,angle),3e-5));});check(s);check(C.deserialize(plain(C.serialize(s))));
 }
});

test('linear arrays preserve the paid shell and framing of every real hull part',()=>{
 const s=C.newShip({L:100,W:60,H:40,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'Paid hull array');s.parts=[];s.fits=[];s.armor={hull:0,cit:0};s.detail=0;const p=C.ensurePrimaryHull(s),before=C.computeStats(s),anchor=p.c.slice(),r=C.placeLinearCopies(s,{parts:[p.id],fits:[]},{end:[anchor[0],anchor[1],anchor[2]+200],count:3});assert.equal(r.ok,true,r.error);assert.equal(s.parts.length,3);assert.equal(s.parts.filter(p=>p.form==='hull').length,3);assert.equal(s.hull.assembly,true);
 const after=C.computeStats(s);near(after.volume,before.volume*3,1e-4);near(after.mass,before.mass*3,1e-4);near(after.framingMass,before.framingMass*3,1e-4);near(after.cost,before.cost*3,2);
 const loaded=C.deserialize(plain(C.serialize(s))),again=C.computeStats(loaded);assert.equal(loaded.parts.length,3);assert.equal(loaded.parts.filter(p=>p.form==='hull').length,3);assert.equal(loaded.hull.assembly,true);near(again.volume,after.volume,1e-4);near(again.mass,after.mass,1e-4);near(again.framingMass,after.framingMass,1e-4);near(again.cost,after.cost,2);assertUnique(loaded);
});

test('a single fitting uses its actual mount position for requested linear endpoints',()=>{
 const s=empty(),f={id:1,k:'pd',p:[80,80,0],a:2,n:[0,1,0],ped:0,base:0,low:0,host:2,local:[-80/260,.5,0],localNormal:[0,1,0]};s.parts=[{id:2,k:'struct',form:'trap',c:[160,78,0],s:[260,20,4],angles:[0,0,0,0]}];s.fits=[f];s.nextId=3;const bounds=C.fitAABB(f);assert.ok(Math.abs((bounds[0]+bounds[3])/2-f.p[0])>.1,'the authored asymmetric housing has a different box center');const r=C.placeLinearCopies(s,{parts:[],fits:[1]},{start:[80,80,0],end:[240,80,0],count:3});assert.equal(r.ok,true,r.error);[r.original,...r.copies].forEach((copy,i)=>vectorNear(s.fits.find(f=>f.id===copy.fits[0]).p,[80+i*80,80,0]));assertUnique(s);
});

function symmetryFixture(){const s=empty(),a={id:1,k:'struct',form:'trap',c:[100,80,-4],s:[2,2,2],angles:[0,0,0,0]},b=C.mirrorPart(a,s),c={id:3,k:'struct',form:'trap',c:[110,56,20],s:[2,2,2],angles:[0,0,0,0]},d=C.vmirrorPart(c,s);b.id=2;d.id=4;a.tw=2;b.tw=1;c.vt=4;d.vt=3;s.parts=[a,b,c,d];s.nextId=5;return s;}
function boundsCenter(s){const b=s.parts.map(p=>C.partAABB(p));return [0,1,2].map(k=>(Math.min(...b.map(b=>b[k]))+Math.max(...b.map(b=>b[k+3])))/2);}
function validRetainedPairs(s,copy){const own=new Set(copy.parts);for(const id of own){const p=s.parts.find(p=>p.id===id);for(const [key,reflect]of [['tw',p=>C.mirrorPart(p,s)],['vt',p=>C.vmirrorPart(p,s)]])if(p[key]!=null){assert.ok(own.has(p[key]),'symmetry cannot point back into another placement');const other=s.parts.find(q=>q.id===p[key]);vectorNear(other.c,reflect(p).c);}}}

test('linear composites remap symmetry pairs when their global planes remain valid',()=>{
 const s=symmetryFixture(),anchor=boundsCenter(s),r=C.placeLinearCopies(s,{parts:[1,2,3,4],fits:[]},{end:[anchor[0]+60,anchor[1],anchor[2]],count:3});assert.equal(r.ok,true,r.error);for(const copy of r.copies){const p=copy.parts.map(id=>s.parts.find(p=>p.id===id));assert.equal(p[0].tw,p[1].id);assert.equal(p[1].tw,p[0].id);assert.equal(p[2].vt,p[3].id);assert.equal(p[3].vt,p[2].id);validRetainedPairs(s,copy);}assertUnique(s);
});

test('off-plane line translations clear pair flags that would make later edits jump',()=>{
 for(const [delta,key,indices]of [[[0,0,20],'tw',[0,1]],[[0,20,0],'vt',[2,3]]]){const s=symmetryFixture(),anchor=boundsCenter(s),r=C.placeLinearCopies(s,{parts:[1,2,3,4],fits:[]},{end:anchor.map((v,k)=>v+delta[k]),count:2});assert.equal(r.ok,true,r.error);for(const i of indices)assert.equal(s.parts.find(p=>p.id===r.copies[0].parts[i])[key],undefined);validRetainedPairs(s,r.copies[0]);}
});

test('rotated composites retain only pair flags consistent with actual global reflection',()=>{
 const s=symmetryFixture(),r=C.placeRotationalCopies(s,{parts:[1,2,3,4],fits:[]},{center:[0,60,0],axis:0,count:4});assert.equal(r.ok,true,r.error);for(const copy of r.copies)validRetainedPairs(s,copy);assertUnique(s);
});

test('a saved user-part insertion origin drives all linear endpoints and remains atomic',()=>{
 const s=empty(),anchor=[90,-5,0],start=[20,30,40],end=[60,30,40];s.parts=[{id:1,k:'struct',form:'trap',c:[100,0,0],s:[2,2,2],angles:[0,0,0,0]},{id:2,k:'struct',form:'trap',c:[110,0,0],s:[2,2,2],angles:[0,0,0,0]}];s.groups=[{id:10,name:'Saved user part',parts:[1,2],fits:[],groups:[],assembly:{origin:anchor.slice()}}];s.nextId=11;const before=publicState(s),bad=C.placeLinearCopies(s,{parts:[1,2],fits:[]},{anchor:[NaN,0,0],start,end,count:3});assert.equal(bad.ok,false);assert.equal(publicState(s),before);
 const original=s.parts.map(plain),r=C.placeLinearCopies(s,{parts:[1,2],fits:[]},{anchor,start,end,count:3});assert.equal(r.ok,true,r.error);[r.original,...r.copies].forEach((copy,i)=>{const at=start.map((v,k)=>v+(end[k]-v)*i/2),delta=at.map((v,k)=>v-anchor[k]);copy.parts.forEach((id,j)=>vectorNear(s.parts.find(p=>p.id===id).c,original[j].c.map((v,k)=>v+delta[k])));const group=s.groups.find(g=>g.parts.length===copy.parts.length&&g.parts.every(id=>copy.parts.includes(id)));assert.ok(group?.assembly);vectorNear(group.assembly.origin,at);});assertUnique(s);
});

test('owned hatch save limits reject all copies before changing the original design',()=>{
 for(const projected of [false,true]){const s=C.newShip({L:10,W:6,H:4,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},'Owned hatch budget');s.parts=[];s.fits=[];s.hatches=[];const p=C.ensurePrimaryHull(s);p.hullData.hatches=[0,1,2].map(i=>({id:i+1,k:'open',a:[1+i*3,4,0],b:[2+i*3,4,0],n:[0,1,0],w:1}));if(projected)C.syncHullStructure(s,p,false);const before=publicState(s),r=C.placeLinearCopies(s,{parts:[p.id],fits:[]},{end:[p.c[0],p.c[1],p.c[2]+620],count:32});assert.equal(r.ok,false,'96 owned hatches cannot fit a save format capped at80');assert.equal(r.code,'array-limit');assert.equal(publicState(s),before,'missing projected hatch handles cannot leak a partial synchronization into failure');}
});

function surfaceBudgetFixture(){const s=empty();s.parts=[{id:1,k:'struct',form:'trap',c:[10,10,0],s:[2,2,2],angles:[0,0,0,0]},{id:2,k:'struct',form:'trap',c:[100,10,0],s:[2,2,2],angles:[0,0,0,0]}];s.nextId=3;const patch=C.surfacePatches(s).find(p=>p.host==='p1');assert.ok(patch);return {s,baseId:patch.baseId||patch.id};}

test('surface record and partition budgets reject copies before saved equipment can be truncated',()=>{
 for(const kind of ['patches','partitions']){const {s,baseId}=surfaceBudgetFixture(),selectedId=kind==='partitions'?baseId+'/s0':baseId;s.surfaces={version:1,patches:[C.surfaceConfig(s,selectedId)],partitions:[]};if(kind==='patches')for(let i=0;i<511;i++)s.surfaces.patches.push(C.surfaceConfig(s,'p2:top:0:orphan'+i));else s.surfaces.partitions=[baseId,...Array.from({length:511},(_,i)=>'p2:top:0:orphan'+i)].map(baseId=>({baseId,leaves:[{id:baseId+'/s0',range:[0,0,1,1]}]}));assert.equal(C.normalizeSurfaces(s.surfaces)[kind].length,512,'all original records fit the supported save format');const before=publicState(s),r=C.placeLinearCopies(s,{parts:[1],fits:[]},{end:[30,10,0],count:2});assert.equal(r.ok,false,'one copied owned record would exceed512');assert.ok(r.error);assert.equal(publicState(s),before);}
});

test('repeating incident network links respects the saved link limit atomically',()=>{
 const s=empty();s.parts=[{id:1,k:'gen',c:[0,0,0],d:2},{id:2,k:'hdis',c:[50,0,0],d:2}];s.links=Array.from({length:32000},()=>({kind:'heat',from:'p1',to:'p2',cap:1}));s.nextId=3;assert.equal(C.normalizeLinks(s.links).length,32000);const before=publicState(s),r=C.placeLinearCopies(s,{parts:[1],fits:[]},{end:[20,0,0],count:2});assert.equal(r.ok,false,'copied consumers cannot silently lose incident heat links after save');assert.ok(r.error);assert.equal(publicState(s),before);
});

test('fresh placement IDs remain representable by saved nine-digit network nodes',()=>{
 const s=empty();s.parts=[{id:1,k:'gen',c:[0,0,0],d:2}];s.nextId=999999999;const before=publicState(s),r=C.placeLinearCopies(s,{parts:[1],fits:[]},{end:[40,0,0],count:3});assert.equal(r.ok,false,'a second fresh ID would require an unsupported ten-digit node');assert.ok(r.error);assert.equal(publicState(s),before);
});
