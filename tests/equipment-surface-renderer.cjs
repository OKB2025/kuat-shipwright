const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),roles=['weapons','cooling','sensors','habitation'];
function fixture(alloc={weapons:25,cooling:25,sensors:25,habitation:25},face='stbd',options={}){
 const ship=C.newShip({L:80,W:60,H:40,assembly:true},'Equipment rendering');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const body=C.placePart(ship,'struct',[40,20,0],[64,40,32],{form:'box',...options},false),patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face===face);
 const density=Object.fromEntries(roles.filter(k=>k!=='weapons').map(k=>[k,alloc[k]||0]));
 assert.ok(patch?.exposed,face+' patch');assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:density,battery:{weapon:'pd',count:alloc.weapons>0?2:0,spacing:.5},equipment:{kind:'hdis',depth:3},style:{kind:'machinery',density:.7,seed:13}}).ok,true);
 return {ship,body,patch:C.surfacePatches(ship).find(p=>p.id===patch.id)};
}
const row=(ship,id,opt)=>G.surfaceVisualPlan(ship,opt).find(q=>q.id===id),features=plan=>plan.devices.flatMap(d=>d.hardware.map(p=>p.feature));

test('bounded category cues use aggregate role identities while derived guns keep their own geometry',()=>{
 const {ship,patch}=fixture(),report=C.surfaceReport(ship).patches.find(q=>q.id===patch.id),plan=row(ship,patch.id),roleIds=new Set(report.partIds);
 assert.ok(plan.devices.length>0&&plan.devices.length<=96);for(const device of plan.devices){assert.ok(roleIds.has(device.id));assert.equal(device.id,report.categories[device.role].roleid);assert.ok(device.hardware.length>0);}
 for(const role of roles.filter(r=>r!=='weapons'))assert.ok(plan.devices.some(q=>q.role===role),role);
 const f=features(plan);for(const feature of ['cooling-grille','sensor-array','habitation-window'])assert.ok(f.includes(feature),feature);
 const guns=C.surfaceDerivedFits(ship).filter(q=>q.surfacePatch===patch.id&&!q.surfaceUnplaced);assert.equal(guns.length,report.installed);assert.equal(report.cells.length,guns.length);assert.ok(report.cells.every(q=>q.role==='weapons'));
 assert.ok(!plan.devices.some(q=>q.role==='weapons'),'face working cues must not draw replacement gun plates or barrels');assert.ok(G.meshFits(ship).ni>0);assert.ok(![...ship.parts,...ship.fits].some(q=>q.surfacePatch),'source arrays must retain manual objects only');
 assert.ok(plan.field.length>0&&plan.field.every(p=>p.role===null),'continuous service geometry cannot imply extra equipment capacity');
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
 assert.deepEqual(plain(high.field),plain(low.field),'the continuous machinery courses do not disappear at cosmetic detail zero');
 const full=G.meshSurfaceLayers(ship,{}, {detail:2}),minimal=G.meshSurfaceLayers(ship,{}, {detail:0});assert.equal(full.surfaceDevices.ni,minimal.surfaceDevices.ni);assert.equal(full.surfaceArmor.ni,minimal.surfaceArmor.ni);assert.equal(minimal.surfaceDetail.ni,0);assert.equal(C.publicJSON(ship),before);
 const reloaded=C.deserialize(C.serialize(ship));assert.deepEqual(plain(row(reloaded,patch.id,{detail:2,maxDetails:19}).devices),plain(high.devices));
});

test('shared field and local working faces stay inside the actual patch on all six faces and rotated walls',()=>{
 for(const [face,options]of [['fore',{}],['aft',{}],['top',{}],['bottom',{}],['port',{}],['stbd',{yaw:27}]]){
  const {ship,patch}=fixture({weapons:0,cooling:34,sensors:33,habitation:33},face,options),ranges={},mesh=G.meshSurfaceLayers(ship,ranges),plan=row(ship,patch.id);assert.ok(plan.devices.length>0,face);
  for(const p of [...plan.field,...plan.boxes,...plan.devices.flatMap(d=>d.hardware)])for(const [x,y]of [[p.bounds[0],p.bounds[1]],[p.bounds[2],p.bounds[1]],[p.bounds[2],p.bounds[3]],[p.bounds[0],p.bounds[3]]]){const point=C.add(patch.center,C.add(C.mul(plan.frame?.u||patch.u,x),C.mul(plan.frame?.v||patch.v,y))),hit=C.rayTris(patch.triangles,C.add(point,C.mul(patch.normal,100)),C.mul(patch.normal,-1));assert.ok(hit,face+' field footprint must remain on the semantic patch');}
  assert.ok(plan.field.some(p=>p.size[0]>8),'shared courses can span simulation-cell boundaries');
 }
});

test('common role adapters retain functional volumes and exterior batches have exactly one owner',()=>{
 const {ship,body,patch}=fixture(),parts=G.meshParts(ship,{coded:false}),plan=row(ship,patch.id),ids=new Set(plan.devices.map(d=>d.id));
 const adapters=C.surfaceWorkingShip(ship).parts.filter(p=>p.surfacePatch===patch.id&&!p.surfaceUnplaced);assert.equal(adapters.length,3);for(const p of adapters){assert.ok(C.partVolume(p)>0&&p._surfaceAdapter.geometry.length>0);assert.ok(parts.ranges[p.id].some(r=>r[0]==='surfaceDevices'));assert.ok(!parts.ranges[p.id].some(r=>['interior','struct','gen','shield','hyper'].includes(r[0])),'abstract role ownership may not recreate individual device bodies');}
 ids.add(body.id);const ownership=new Uint8Array(parts.g.surfaceDevices.ni);for(const [id,spans]of Object.entries(parts.ranges))for(const [name,start,count]of spans)if(name==='surfaceDevices'){assert.ok(ids.has(+id),'working faces belong to real devices and neutral machinery to the host');for(let i=start;i<start+count;i++)ownership[i]++;}assert.ok(ownership.every(n=>n===1),'host/device index ranges must neither overlap nor leave ownerless geometry');
 C.setSurfaceConfig(ship,patch.id,{functionMode:'armor',armor:{thickness:0}});const armor=row(ship,patch.id);assert.equal(armor.devices.length,0);assert.equal(armor.boxes.length,0);assert.ok(G.meshSurfaceLayers(ship,{}).surfaceArmor.ni>0,'even zero-thickness armour hides legacy wall windows');
});

test('continuous machinery fields on an articulated foil are partitioned once with their real device owners',()=>{
 const ship=C.newShip({L:100,W:100,H:30,assembly:true},'Equipment foil');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const wing=C.placePart(ship,'wing',[50,15,0],[64,40,6],{},false);wing.wing=C.normalizeWing({...wing.wing,foil:true,axis:'x',open:10,stow:50});const patch=C.surfacePatches(ship).find(p=>p.host==='p'+wing.id&&p.face==='top');
 C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{weapons:0,cooling:34,sensors:33,habitation:33},equipment:{kind:'hdis',depth:1},style:{density:.8}});
 const raw=G.meshSurfaceLayers(ship,{}),asset=G.fleetGeometry(ship),foil=asset.foils.find(f=>f.id===wing.id);assert.ok(foil);for(const source of ['surfaceArmor','surfaceDevices','surfaceDetail']){const moved=foil.meshes.filter(name=>foil.kinds[name]===source);assert.equal(moved.length,1,source+' one partition');assert.equal(asset.meshes[moved[0]].geo.ni,raw[source].ni,source+' no duplicate triangles');assert.equal(asset.meshes[source]?.geo.ni||0,0,source+' no stationary copy');}
});
