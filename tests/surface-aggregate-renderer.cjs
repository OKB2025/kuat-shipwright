const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v));
function fixture(paint='#a84431'){
 const ship=C.newShip({L:180,W:120,H:80,assembly:true},'Aggregate painted machinery');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const body=C.placePart(ship,'struct',[80,40,0],[128,72,48],{form:'box',paint},false),patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face==='port');assert.ok(patch?.exposed);
 assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:40,sensors:20,habitation:40},equipment:{kind:'hdis',depth:3},battery:{weapon:'pd',count:4},style:{kind:'machinery',seed:83,density:.6}}).ok,true);
 return {ship,body,patch:C.surfacePatches(ship).find(p=>p.id===patch.id)};
}
const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));
function sameHue(color,paint){const channel=paint.indexOf(Math.max(...paint)),scale=color[channel]/paint[channel];for(let i=0;i<3;i++)assert.ok(Math.abs(color[i]-paint[i]*scale)<1.1,'independent machinery color '+color+' on '+paint);}

test('machinery coating and opened structure inherit red or blue parent paint with small brightness variation',()=>{
 for(const paint of ['#a84431','#3862a7']){const {ship,body,patch}=fixture(paint),row=G.surfaceVisualPlan(ship).find(p=>p.id===patch.id),base=rgb(paint);assert.deepEqual(plain(row.paint),base);assert.ok(row.field.length>20);
  const bodies=row.field.filter(q=>['stratum-machinery','stratum-core'].includes(q.feature));for(const q of [...row.field,...row.boxes,...row.devices.flatMap(d=>d.hardware||[])])if(!q.port)sameHue(q.color,base);
  assert.ok(bodies.length>12);for(const q of bodies){const ratio=q.color[0]/base[0];assert.ok(ratio>.78&&ratio<1.05,'machinery retains a detached dark gray palette');}
  const mesh=G.meshSurfaceLayers(ship,{});for(let i=0;i<mesh.surfaceArmor.n;i++)sameHue(Array.from(mesh.surfaceArmor.col.slice(i*4,i*4+3)),base);
  assert.equal(body.paint,paint);
 }
});

test('wholeface batches use bounded aggregate cues and cache independently of camera or native device expansion',()=>{
 const {ship,patch}=fixture('#b04020');assert.equal(C.setSurfaceConfig(ship,patch.id,{style:{seed:101}}).ok,true);const source=C.publicJSON(ship),count=ship.parts.length,original=C.surfaceRenderFaces;let reads=0;C.surfaceRenderFaces=(...a)=>{reads++;return original(...a);};
 try{const a=G.surfaceVisualPlan(ship),row=a.find(r=>r.id===patch.id);assert.ok(row.field.length>20);assert.ok(row.devices.length>0&&row.devices.length<=96);assert.ok(row.devices.every(d=>['cooling','sensors','habitation'].includes(d.role)));
  const ids=new Set(C.surfaceRenderFaces(ship).find(r=>r.id===patch.id).partIds);for(const d of row.devices)assert.ok(ids.has(d.id),'cue must belong to a face aggregate');const afterFirst=reads;
  assert.equal(G.surfaceVisualPlan(ship),a);const one=G.meshSurfaceLayers(ship,{}),two=G.meshSurfaceLayers(ship,{});assert.equal(one.surfaceDevices,two.surfaceDevices);assert.equal(one.surfaceArmor,two.surfaceArmor);assert.equal(reads,afterFirst,'cached plan/meshes re-read functional face data');
  assert.equal(ship.parts.length,count);assert.ok(!ship.parts.some(p=>p.surfacePatch));assert.ok(!ship.fits.some(f=>f.surfacePatch));assert.equal(C.publicJSON(ship),source);
  const points=plain(row.field.map(q=>[q.center,q.size]));ship.parts[0].paint='#2060b0';const repainted=G.surfaceVisualPlan(ship).find(r=>r.id===patch.id);assert.notEqual(repainted,row);assert.deepEqual(plain(repainted.field.map(q=>[q.center,q.size])),points,'repaint moved machinery');for(const q of repainted.field)sameHue(q.color,rgb('#2060b0'));
 }finally{C.surfaceRenderFaces=original;}
});

test('derived casemate ports appear in fleet and targeted preview while manual gun previews stay scoped',()=>{
 const {ship,patch}=fixture('#3862a7'),fits=C.surfaceDerivedFits(ship).filter(f=>f.surfacePatch===patch.id&&!f.float);assert.equal(fits.length,4);const mesh=G.meshFits(ship),fleet=G.fleetGeometry(ship,{trial:true});assert.ok(mesh.ni>0);for(const fit of fits){const t=fleet.turrets.find(t=>t.id===fit.id);assert.ok(t?.embedded);assert.equal(t.mesh,null);}
 const only=G.meshPreview(ship,[],[plain(fits[0])]),all=G.meshPreview(ship,[],fits);assert.ok(only.previewFits.ni>0&&only.previewFits.ni<all.previewFits.ni,'a targeted preview pulled every face port');
 const manual=C.placeFit(ship,'pd',[80,64,0],[0,1,0],0,false).fit;assert.ok(manual);const preview=G.meshPreview(ship,[],[manual]);assert.equal(preview.previewFits.ni,G.meshFits(ship,f=>f.id===manual.id).ni,'manual preview includes unrelated derived ports');
});

test('legacy mixed armor faces retain bounded common-role interfaces without restoring native devices',()=>{
 const {ship,patch}=fixture('#a84431');assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'legacy',armor:{thickness:.4},equipment:{kind:'hdis',count:2,depth:1},battery:{weapon:'ltl',count:2}}).ok,true);
 const before=C.publicJSON(ship),report=C.surfaceRenderFaces(ship).find(r=>r.id===patch.id),row=G.surfaceVisualPlan(ship).find(r=>r.id===patch.id);assert.equal(report.installedEquipment,2);assert.equal(row.devices.length,1);assert.equal(row.devices[0].id,report.categories.cooling.roleid);assert.ok(C.dot(C.sub(row.devices[0].center,patch.center),patch.normal)>.4,'legacy interface is hidden behind its armor');
 assert.ok(G.meshSurfaceLayers(ship,{}).surfaceDevices.ni>0);assert.ok(!ship.parts.some(p=>p.surfacePatch));assert.equal(C.surfaceDerivedFits(ship).filter(f=>f.surfacePatch===patch.id&&!f.float).length,2);assert.equal(C.publicJSON(ship),before);
});

test('opening sliding doors in a render-only asset clone never recompiles the canonical face inventory',()=>{
 const measured=vm.createContext({console,performance:{now:()=>0},__surfacePacking:0});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js']){let text=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){const marker='function surfaceSyncLegacy(ship){';assert.ok(text.includes(marker));text=text.replace(marker,marker+'globalThis.__surfacePacking++;');}vm.runInContext(text,measured,{filename:file});}
 const {C:core,G:gfx}=vm.runInContext('({C:Core,G:Gfx})',measured),ship=core.newShip({L:80,W:60,H:40,assembly:true},'Sliding render inventory');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=0;
 const body=core.placePart(ship,'struct',[40,20,0],[64,40,32],{form:'box'},false),bay={id:ship.nextId++,k:'hangar',c:[40,30,0],room:[20,16,12],d:Math.cbrt(20*16*12),yaw:0};ship.parts.push(bay);const door=core.openBay(ship,bay,'top','open');door.motion='slide';door.open=.25;assert.ok(core.openingBounds(ship,door),'hangar must actually touch the structural roof');
 const patch=core.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face==='port');assert.ok(patch?.exposed);assert.equal(core.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:40,sensors:20,habitation:40},equipment:{kind:'hdis',depth:1,limit:4},battery:{weapon:'pd',count:1},style:{density:0}}).ok,true);assert.ok(measured.__surfacePacking>0,'counter must observe real canonical compilation');
 const before=core.publicJSON(ship),ledger=JSON.stringify(ship.surfaces),guns=plain(core.surfaceDerivedFits(ship).map(f=>({id:f.id,p:f.p,normal:f.n})));measured.__surfacePacking=0;
 const first=gfx.fleetGeometry(ship,{trial:true}),second=gfx.fleetGeometry(ship,{trial:true});assert.equal(measured.__surfacePacking,0,'render-only door opening triggered physical reservation packing');assert.ok(first.doors.length>0&&second.doors.length>0);assert.equal(core.publicJSON(ship),before);assert.equal(JSON.stringify(ship.surfaces),ledger);assert.equal(door.open,.25);assert.ok(!door._doorDetached);assert.deepEqual(plain(core.surfaceDerivedFits(ship).map(f=>({id:f.id,p:f.p,normal:f.n}))),guns);assert.ok(!ship.parts.some(p=>p.surfacePatch)&&!ship.fits.some(f=>f.surfacePatch));
});
