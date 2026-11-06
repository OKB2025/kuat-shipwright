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

test('electrical feeds and mechanical transmission use separate physical meshes and colors',()=>{
 const ship=fixture(),mesh=G.meshParts(ship,{coded:false}),electrical=C.engineTransmission(ship),drive=C.engineDriveRoutes(ship);
 assert.ok(electrical.parts.length>0&&drive.parts.length===2);for(const p of electrical.parts){assert.ok(hasColor(mesh,p.id,[107,177,198]),'electrical feeds are cyan');assert.equal(hasColor(mesh,p.id,[218,162,72]),false);}
 for(const p of drive.parts){assert.ok(hasColor(mesh,p.id,[218,162,72]),'actual core-to-outlet transmission is amber');assert.equal(hasColor(mesh,p.id,[107,177,198]),false);assert.ok((mesh.ranges[p.id]||[]).length>0);}
});

test('core and nozzle live previews do not solve either complete route network',()=>{
 const ship=fixture(),oldPaths=C.enginePaths,oldPower=C.engineTransmission,oldDrive=C.engineDriveRoutes;
 const forbidden=()=>{throw Error('A complete route solver was called during a pointer preview');};C.enginePaths=C.engineTransmission=C.engineDriveRoutes=forbidden;
 try{const preview=G.meshPreview(ship,ship.parts.filter(p=>p.k==='engineCore'||p.k==='engine'),[],{coded:false});assert.ok(preview.preview.ni>0,'the independent core has a cheap live preview');assert.ok(preview.previewRef.ni>0,'nozzle bells remain visible in the same preview');}
 finally{C.enginePaths=oldPaths;C.engineTransmission=oldPower;C.engineDriveRoutes=oldDrive;}
});
