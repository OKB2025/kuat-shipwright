const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),roles=['weapons','cooling','sensors','habitation'];
function fixture(alloc={weapons:25,cooling:25,sensors:25,habitation:25},face='stbd',options={}){
 const ship=C.newShip({L:80,W:60,H:40,assembly:true},'Equipment rendering');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const body=C.placePart(ship,'struct',[40,20,0],[64,40,32],{form:'box',...options},false),patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face===face);
 assert.ok(patch?.exposed,face+' patch');assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:alloc,battery:{weapon:'pd',spacing:.5},equipment:{kind:'hdis',depth:3},style:{kind:'machinery',density:.7,seed:13}}).ok,true);
 return {ship,body,patch:C.surfacePatches(ship).find(p=>p.id===patch.id)};
}
const row=(ship,id,opt)=>G.surfaceVisualPlan(ship,opt).find(q=>q.id===id),features=plan=>plan.devices.flatMap(d=>d.hardware.map(p=>p.feature));
function indexedVertices(g,ranges){const out=[];for(const [,start,count]of ranges)for(let i=start;i<start+count;i++)out.push(Array.from(g.pos.slice(g.idx[i]*3,g.idx[i]*3+3)));return out;}

test('installed category cells supply one exterior kit per real device and native guns keep their identity',()=>{
 const {ship,patch}=fixture(),report=C.surfaceReport(ship).patches.find(q=>q.id===patch.id),plan=row(ship,patch.id);
 assert.deepEqual(plain(plan.devices.map(q=>({id:q.id,cell:q.cell,role:q.role}))),plain(report.cells.map(q=>({id:q.id,cell:q.cell,role:q.role}))));
 assert.equal(new Set(plan.devices.map(q=>q.id)).size,plan.devices.length);for(const role of roles)assert.ok(plan.devices.some(q=>q.role===role),role);
 const f=features(plan);for(const feature of ['cooling-grille','sensor-array','habitation-window','gun-service'])assert.ok(f.includes(feature),feature);
 assert.equal(plan.devices.filter(q=>q.role==='weapons').length,ship.fits.filter(q=>q.surfacePatch===patch.id&&!q.surfaceUnplaced).length);
 assert.ok(plan.devices.filter(q=>q.role==='weapons').every(q=>q.hardware.every(p=>p.feature==='gun-service')),'gun barrels are supplied by the native fit mesh');
});

test('zero allocations never acquire category hardware through decorative density or seed',()=>{
 for(const active of ['cooling','sensors','habitation']){const {ship,patch}=fixture(Object.fromEntries(roles.map(k=>[k,k===active?100:0]))),plan=row(ship,patch.id,{detail:2});assert.ok(plan.devices.length>0);assert.ok(plan.devices.every(q=>q.role===active));assert.ok(new Set(plan.devices.map(q=>q.variant)).size>=3,'seeded '+active+' kits must offer multiple hardware arrangements');
  const f=features(plan);for(const [role,feature]of [['cooling','cooling-grille'],['sensors','sensor-array'],['habitation','habitation-window']])assert.equal(f.includes(feature),role===active,active+' / '+feature);
  const g=G.meshSurfaceLayers(ship,{}).surfaceDevices,ports=Array.from(g.col.slice(0,g.n*4)).filter((_,i)=>i%4===3).filter(v=>v===253).length;assert.equal(ports>0,active==='habitation');
 }
});

test('detail quality changes only bounded service subdetails and stable installed hardware survives save/load',()=>{
 const {ship,patch}=fixture(),before=C.publicJSON(ship),high=row(ship,patch.id,{detail:2,maxDetails:19}),low=row(ship,patch.id,{detail:0});
 assert.ok(high.boxes.length>0&&high.boxes.length<=19);assert.equal(low.boxes.length,0);assert.deepEqual(plain(high.devices.map(q=>q.hardware)),plain(low.devices.map(q=>q.hardware)));
 const full=G.meshSurfaceLayers(ship,{}, {detail:2}),minimal=G.meshSurfaceLayers(ship,{}, {detail:0});assert.equal(full.surfaceDevices.ni,minimal.surfaceDevices.ni);assert.equal(full.surfaceArmor.ni,minimal.surfaceArmor.ni);assert.equal(minimal.surfaceDetail.ni,0);assert.equal(C.publicJSON(ship),before);
 const reloaded=C.deserialize(C.serialize(ship));assert.deepEqual(plain(row(reloaded,patch.id,{detail:2,maxDetails:19}).devices),plain(high.devices));
});

test('all device mesh vertices remain inside their physical service footprints on every face and rotated walls',()=>{
 for(const [face,options]of [['fore',{}],['aft',{}],['top',{}],['bottom',{}],['port',{}],['stbd',{yaw:27}]]){
  const {ship,patch}=fixture({weapons:0,cooling:34,sensors:33,habitation:33},face,options),ranges={},mesh=G.meshSurfaceLayers(ship,ranges),plan=row(ship,patch.id);assert.ok(plan.devices.length>0,face);
  for(const device of plan.devices){const spans=(ranges[device.id]||[]).filter(r=>r[0]==='surfaceDevices'),points=indexedVertices(mesh.surfaceDevices,spans);assert.ok(points.length>0);
   for(const point of points){const local=C.sub(point,device.point);assert.ok(Math.abs(C.dot(local,patch.u))<=device.size[0]/2+1e-5,face+' width '+device.id);assert.ok(Math.abs(C.dot(local,patch.v))<=device.size[1]/2+1e-5,face+' height '+device.id);assert.ok(C.dot(local,patch.normal)>=-.001,face+' outward');}
  }
 }
});

test('equipment is diagnosed as inward rooms while exterior ranges belong only to the real installed IDs',()=>{
 const {ship,body,patch}=fixture(),parts=G.meshParts(ship,{coded:false}),plan=row(ship,patch.id),ids=new Set(plan.devices.map(d=>d.id));
 for(const d of plan.devices.filter(d=>d.role!=='weapons')){assert.ok(parts.ranges[d.id].some(r=>r[0]==='interior'));assert.ok(parts.ranges[d.id].some(r=>r[0]==='surfaceDevices'));assert.ok(!parts.ranges[d.id].some(r=>['struct','gen','shield','hyper'].includes(r[0])));}
 for(const [id,spans]of Object.entries(parts.ranges))if(spans.some(r=>r[0]==='surfaceDevices'))assert.ok(ids.has(+id),'surface projection must retain device identity');
 assert.ok(!parts.ranges[body.id].some(r=>r[0]==='surfaceDevices'),'host/device index ranges must not overlap');
 C.setSurfaceConfig(ship,patch.id,{functionMode:'armor',armor:{thickness:0}});const armor=row(ship,patch.id);assert.equal(armor.devices.length,0);assert.equal(armor.boxes.length,0);assert.ok(G.meshSurfaceLayers(ship,{}).surfaceArmor.ni>0,'even zero-thickness armour hides legacy wall windows');
});

test('surface kits on an articulated foil are partitioned once with their native device owners',()=>{
 const ship=C.newShip({L:100,W:100,H:30,assembly:true},'Equipment foil');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const wing=C.placePart(ship,'wing',[50,15,0],[64,40,6],{},false);wing.wing=C.normalizeWing({...wing.wing,foil:true,axis:'x',open:10,stow:50});const patch=C.surfacePatches(ship).find(p=>p.host==='p'+wing.id&&p.face==='top');
 C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{weapons:0,cooling:34,sensors:33,habitation:33},equipment:{kind:'hdis',depth:1},style:{density:.8}});
 const raw=G.meshSurfaceLayers(ship,{}),asset=G.fleetGeometry(ship),foil=asset.foils.find(f=>f.id===wing.id);assert.ok(foil);for(const source of ['surfaceArmor','surfaceDevices','surfaceDetail']){const moved=foil.meshes.filter(name=>foil.kinds[name]===source);assert.equal(moved.length,1,source+' one partition');assert.equal(asset.meshes[moved[0]].geo.ni,raw[source].ni,source+' no duplicate triangles');assert.equal(asset.meshes[source]?.geo.ni||0,0,source+' no stationary copy');}
});
