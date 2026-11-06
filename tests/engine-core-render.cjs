const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',context),plain=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const ship=C.newShip({L:240,W:120,H:100,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Independent engine render');ship.parts=[];ship.fits=[];ship.detail=0;ship.armor={hull:0,cit:0};
 ship.parts=[{id:1,k:'gen',c:[200,50,0],d:20},{id:2,k:'engineCore',c:[150,50,0],dir:[-1,0,0],d:12,length:24,reactor:1,propulsionModelVersion:1,ratedInputW:1e19,driveProfileId:'standard',machineryGradeId:'standard'},
  {id:3,k:'engine',c:[5,50,-25],dir:[-1,0,0],d:10,nozzleLength:10,machineryId:2},
  {id:4,k:'engine',c:[5,50,25],dir:[-1,0,0],d:10,nozzleLength:10,machineryId:2}];
 ship.links=[{kind:'power',from:'p1',to:'p2',cap:1e19}];ship.nextId=5;return ship;
}
function trianglesForPart(mesh,id){
 return (mesh.ranges[id]||[]).flatMap(([name,start,count])=>{const g=mesh.g[name],rows=[];for(let i=start;i<start+count;i++){const k=g.idx[i];rows.push({p:Array.from(g.pos.subarray(k*3,k*3+3)),n:Array.from(g.nor.subarray(k*3,k*3+3)),color:Array.from(g.col.subarray(k*4,k*4+3))});}return rows;});
}
function hasColor(mesh,id,color){return trianglesForPart(mesh,id).some(row=>row.color.every((v,i)=>v===color[i]));}

test('one positive engine core keeps its own geometry when independent outlets move, resize or are added',()=>{
 const ship=fixture(),core=ship.parts.find(p=>p.k==='engineCore'),first=G.meshParts(ship,{coded:false}),saved=plain(C.serialize(ship)),body=trianglesForPart(first,core.id);
 assert.ok(body.length>0);assert.ok(first.ranges[core.id].every(([name])=>name==='interior'),'internal machinery is available in the diagnostic layer');
 assert.equal(C.enginePaths(ship).some(p=>p.id===core.id),false,'the authored positive core is not added again as generated hardware');
 assert.equal(C.engineMachineryPaths(ship).some(p=>p.nozzle===3||p.nozzle===4),false,'outlets do not manufacture duplicate machinery bodies');
 const outlet=ship.parts.find(p=>p.id===3);outlet.c[2]-=10;outlet.d=8;outlet.nozzleLength=8;ship.parts.push({...plain(outlet),id:5,c:[5,70,0]});ship.nextId=6;
 const after=G.meshParts(ship,{coded:false});assert.deepEqual(trianglesForPart(after,core.id),body,'outlet dimensions and count cannot move or duplicate the independent machine');
 assert.deepEqual(plain(C.serialize(ship).parts.find(p=>p.id===core.id)),saved.parts.find(p=>p.id===core.id),'drawing leaves the saved machinery specification unchanged');
 const dims=C.partDims(core),u=C.norm(core.dir),radius=dims.rad;for(const {p}of body){const relative=C.sub(p,core.c),axial=C.dot(relative,u),radial=C.len(C.sub(relative,C.mul(u,axial)));assert.ok(Math.abs(axial)<=dims.l/2+.0002);assert.ok(radial<=radius+.0002,'ribs remain inside the physical machinery envelope');}
});

test('moving the independent core preserves the actual nozzle bell meshes',()=>{
 const ship=fixture(),before=G.meshParts(ship,{coded:false}),nozzles=ship.parts.filter(p=>p.k==='engine').map(p=>({id:p.id,geometry:trianglesForPart(before,p.id),c:p.c.slice()}));ship.parts.find(p=>p.k==='engineCore').c[0]-=20;
 const after=G.meshParts(ship,{coded:false});for(const n of nozzles){assert.ok(n.geometry.length>0);assert.deepEqual(trianglesForPart(after,n.id),n.geometry);assert.deepEqual(plain(ship.parts.find(p=>p.id===n.id).c),n.c);}
});

test('normal propulsion hardware uses metal housings while coded view distinguishes the two physical networks',()=>{
 const ship=fixture(),mesh=G.meshParts(ship,{coded:false}),coded=G.meshParts(ship,{coded:true}),electrical=C.engineTransmission(ship),drive=C.engineDriveRoutes(ship);
 assert.ok(electrical.parts.length>0&&drive.parts.length===2);for(const p of electrical.parts){assert.ok(hasColor(mesh,p.id,[125,137,148]),'the electrical feed has its own metal conductor');assert.ok(hasColor(coded,p.id,[107,177,198]),'coded view identifies electrical feeds');assert.equal(hasColor(mesh,p.id,[107,177,198]),false);}
 for(const p of drive.parts){assert.ok(hasColor(mesh,p.id,[110,124,137]),'a continuous steel pressure shell follows the drive');assert.ok(hasColor(mesh,p.id,[166,178,188]),'physical ribs and terminal flanges have a separate metal finish');assert.ok(hasColor(coded,p.id,[218,162,72]),'coded view identifies mechanical transmission');assert.equal(hasColor(mesh,p.id,[218,162,72]),false);assert.ok((mesh.ranges[p.id]||[]).length>0);}
});

test('core and nozzle live previews do not solve either complete route network',()=>{
 const ship=fixture(),oldPaths=C.enginePaths,oldPower=C.engineTransmission,oldDrive=C.engineDriveRoutes;
 const forbidden=()=>{throw Error('A complete route solver was called during a pointer preview');};C.enginePaths=C.engineTransmission=C.engineDriveRoutes=forbidden;
 try{const preview=G.meshPreview(ship,ship.parts.filter(p=>p.k==='engineCore'||p.k==='engine'),[],{coded:false});assert.ok(preview.preview.ni>0,'the independent core has a cheap live preview');assert.ok(preview.previewRef.ni>0,'nozzle bells remain visible in the same preview');}
 finally{C.enginePaths=oldPaths;C.engineTransmission=oldPower;C.engineDriveRoutes=oldDrive;}
});

function segmentContains(p,s,tolerance=.0002){const relative=C.sub(p,s.a),axial=C.dot(relative,s.u);if(axial<-tolerance||axial>s.l+tolerance)return false;const radius=C.lerp(s.r0,s.r1,C.clamp(axial/s.l,0,1)),radial=C.len(C.sub(relative,C.mul(s.u,axial)));return radial<=radius+tolerance;}
function assertPhysicalHousing(mesh,p){
 const rows=trianglesForPart(mesh,p.id),bounds=C.partAABB(p);assert.ok(rows.length>0);let shell=false,rib=false;
 for(const {p:point,n}of rows){assert.ok(point.every(Number.isFinite)&&n.every(Number.isFinite));assert.ok(p.segments.some(s=>segmentContains(point,s)),'every visible surface remains in the paid flat-cap cylinder union');assert.ok(point.every((v,a)=>v>=bounds[a]-.0002&&v<=bounds[a+3]+.0002),'drawing agrees with the selectable physical bounds');
  for(const s of p.segments){if(!segmentContains(point,s))continue;const delta=C.sub(point,s.a),axial=C.dot(delta,s.u),radius=C.lerp(s.r0,s.r1,C.clamp(axial/s.l,0,1)),radial=C.len(C.sub(delta,C.mul(s.u,axial)));if(radius>1e-8&&axial>.0002&&axial<s.l-.0002){shell||=Math.abs(radial/radius-.92)<.0002;rib||=Math.abs(radial/radius-1)<.0002;}}
 }
 assert.ok(shell&&rib,'the housing has a recessed cylindrical shell and full-radius physical ribs');
 const stations=new Set(rows.map(row=>{const s=p.segments[0];return (C.dot(C.sub(row.p,s.a),s.u)/s.l).toFixed(5);}));assert.ok(stations.size>8,'ribs and collars are actual mesh geometry along the run');
 const a=rows[0].p,b=rows[1].p,c=rows[2].p,normal=C.norm(C.cross(C.sub(b,a),C.sub(c,a))),center=C.mul(C.add(C.add(a,b),c),1/3),origin=C.add(center,C.mul(normal,10)),hit=C.rayPart(origin,C.mul(normal,-1),p);assert.ok(hit,'the existing route id still selects the visible housing');assert.ok(hit.t<=10.001);
}

test('real shared-engine drive housings follow their paid routes without changing the machine, outlets or route solids',()=>{
 const ship=fixture(),authored=plain(ship.parts),network=C.engineDriveRoutes(ship),paths=plain(network.parts),mesh=G.meshParts(ship,{coded:false});assert.equal(network.parts.length,2);
 for(const p of network.parts){assertPhysicalHousing(mesh,p);assert.ok(mesh.ranges[p.id].every(([name])=>name==='interior'||name==='engine'));}
 assert.deepEqual(plain(network.parts),paths,'drawing does not move or widen the paid routes');assert.deepEqual(JSON.parse(C.publicJSON(ship.parts)),authored,'a long housing does not create another engine core or alter nozzle dimensions');
});

test('bent tapered housings keep separate exterior segments and never invent an oversized elbow',()=>{
 const segment=(a,b,r0,r1,external=false)=>({a,b,r0,r1,l:C.len(C.sub(b,a)),...C.frameAxis(C.sub(b,a)),...(external?{exteriorEntry:true,housing:true,structuralGap:true}:{})}),segments=[segment([10,20,30],[90,20,30],4,6),segment([90,20,30],[90,75,30],6,3,true)],p={id:-8000000,k:'machinery',drivetrain:true,ok:true,c:[90,20,30],d:12,seg:segments[0],segments,sourcePartIds:[1,2],routeId:'p1>p2'},ship=C.newShip({assembly:true,L:140,W:100,H:100});ship.parts=[];ship.fits=[];ship.detail=0;
 const before=plain(p),paths=C.enginePaths;C.enginePaths=()=>[p];let mesh;try{mesh=G.meshParts(ship,{coded:false});}finally{C.enginePaths=paths;}
 assertPhysicalHousing(mesh,p);assert.deepEqual(plain(p),before);assert.deepEqual(new Set(mesh.ranges[p.id].map(([name])=>name)),new Set(['interior','engine']));
 for(const [name,start,count]of mesh.ranges[p.id]){const g=mesh.g[name],segment=segments[name==='engine'?1:0];for(let i=start;i<start+count;i++)assert.ok(segmentContains(Array.from(g.pos.subarray(g.idx[i]*3,g.idx[i]*3+3)),segment),'each exterior-entry classification retains its own exact segment');}
 assert.equal(C.rayPart([95,15,60],[0,0,-1],p),null,'the unoccupied outside quadrant of the bend stays empty for selection');
});

test('long pressure housings have closely spaced physical ribs while short joins keep only their terminal collars',()=>{
 const render=(length,radius)=>{const a=[10,20,30],b=[10+length,20,30],segment={a,b,r0:radius,r1:radius,l:length,...C.frameAxis(C.sub(b,a))},p={id:-8000000,k:'machinery',drivetrain:true,ok:true,c:[10+length/2,20,30],d:radius*2,seg:segment,segments:[segment]},ship=C.newShip({assembly:true,L:length+20,W:100,H:100});ship.parts=[];ship.fits=[];ship.detail=0;const paths=C.enginePaths;C.enginePaths=()=>[p];let mesh;try{mesh=G.meshParts(ship,{coded:false});}finally{C.enginePaths=paths;}const points=trianglesForPart(mesh,p.id).map(row=>row.p),ringStations=[...new Set(points.filter(q=>Math.abs(Math.hypot(q[1]-20,q[2]-30)-radius)<.0002).map(q=>+(q[0]-10).toFixed(4)))].sort((a,b)=>a-b);assert.ok(points.every(q=>segmentContains(q,segment)));return {ringStations,vertices:mesh.g.interior.n};};
 const long=render(220,16);assert.ok(long.ringStations.length>=26,'a long main-engine housing has many actual narrow circumferential ribs');assert.ok(long.ringStations.length<=52,'the geometry budget caps repeated ribs on arbitrarily long routes');const gaps=long.ringStations.slice(1).map((x,i)=>x-long.ringStations[i]);assert.ok(Math.max(...gaps)<16,'main-drive rib pitch is smaller than its physical radius');assert.ok(long.vertices<10000,'the denser profile remains a bounded indexed mesh');
 const extreme=render(2000,1);assert.ok(extreme.ringStations.length<=52);assert.ok(extreme.vertices<10000);const short=render(8,6);assert.equal(short.ringStations.length,4,'a short joint retains two collars without a crowded set of extra ribs');
});
