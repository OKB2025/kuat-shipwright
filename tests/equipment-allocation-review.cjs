const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),roles=['weapons','cooling','sensors','habitation'];
const shares=(k,n=100)=>Object.fromEntries(roles.filter(r=>r!=='weapons').map(r=>[r,r===k?n:0]));
function fixture(rotated=false){
 const s=C.newShip({L:200,W:100,H:80,plan:'rect',sec:'rect'},'Independent surface review');s.hull.assembly=true;
 s.parts=[{id:1,k:'struct',form:'box',c:[80,50,60],s:[80,60,40],taper:0,...(rotated?{yaw:31,pitch:27,roll:33}:{})}];s.fits=[];s.nextId=2;
 assert.equal(C.enableSurfaceMode(s,true).ok,true);return s;
}
const face=(s,k='port')=>C.surfacePatches(s).find(p=>p.host==='p1'&&p.face===k);
function equip(s,p,allocation={weapons:25,cooling:25,sensors:25,habitation:25},extra={}){
 const density=Object.fromEntries(roles.filter(k=>k!=='weapons').map(k=>[k,allocation[k]||0]));
 const result=C.setSurfaceConfig(s,p.id,{functionMode:'equipment',allocation:density,battery:{weapon:'claser',count:allocation.weapons>0?2:0,spacing:1},equipment:{kind:'hdis',depth:2},...extra});
 assert.equal(result.ok,true,result.why);return result;
}
const owned=s=>[...s.parts,...s.fits].filter(p=>p.surfacePatch);
const identity=s=>plain(owned(s).map(p=>({id:p.id,k:p.k,patch:p.surfacePatch,cell:p.surfaceCell,normal:p.surfaceNormal||p.n,point:p.surfacePoint})).sort((a,b)=>a.id-b.id));
function unit(s){const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),u=C.fleetUnit('review','review',p,0);u.pos=[0,0,0];u.yaw=0;return {S,u};}

test('v1 mixed faces and independently placed turrets survive a current save/load without redistribution',()=>{
 const s=fixture(),p=face(s);assert.equal(C.setSurfaceConfig(s,p.id,{armor:{material:'dense',thickness:.7},equipment:{kind:'hdis',count:2,depth:2},battery:{weapon:'claser',count:3,spacing:1},style:{seed:71}}).ok,true);
 s.fits.push({id:s.nextId++,k:'claser',p:[120,70,60],a:4,ped:0,base:0,low:0,slope:0,float:false});
 s.surfaces.version=1;for(const q of s.surfaces.patches){delete q.functionMode;delete q.allocation;}
 const before=identity(s),gun=s.fits.find(f=>!f.surfacePatch),loaded=C.deserialize(C.serialize(s));C.surfaceSync(loaded);
 const config=C.surfaceConfig(loaded,p.id);assert.equal(config.functionMode,'legacy');assert.equal(config.armor.thickness,.7);assert.equal(config.battery.count,3);assert.equal(config.equipment.count,2);
 assert.deepEqual(identity(loaded),before);assert.equal(loaded.fits.filter(f=>!f.surfacePatch&&f.id===gun.id).length,1);
 assert.ok(C.surfaceReport(loaded).warnings.some(w=>/legacy|compat|旧|互換/.test(w.code+' '+w.text)),'mixed legacy operation needs an explicit migration warning');
 const again=C.deserialize(C.serialize(loaded));C.surfaceSync(again);assert.deepEqual(plain(again.surfaces),plain(loaded.surfaces));assert.deepEqual(identity(again),before);
});

test('equipment keeps remembered plate choices but applies zero plate mass and combat armor until restored',()=>{
 const s=fixture(),p=face(s);assert.equal(C.setSurfaceConfig(s,p.id,{functionMode:'armor',armor:{material:'dense',thickness:3}}).ok,true);
 const armor=C.surfaceReport(s).patches.find(q=>q.id===p.id);assert.ok(armor.armorMass>0);
 equip(s,p,shares('sensors'));const row=C.surfaceReport(s).patches.find(q=>q.id===p.id),config=C.surfaceConfig(s,p.id);
 assert.equal(config.armor.thickness,3);assert.equal(config.armor.material,'dense');assert.equal(row.armorMass,0);
 const {u}=unit(s),combat=u.p.surface.patches.find(q=>q.id===p.id);assert.equal(combat.armor.thickness,0,'local-hit armor must use the effective equipment-face plate');
 assert.equal(C.setSurfaceConfig(s,p.id,{functionMode:'armor'}).ok,true);const restored=C.surfaceReport(s).patches.find(q=>q.id===p.id);
 assert.equal(restored.armorMass,armor.armorMass);assert.equal(owned(s).filter(q=>q.surfacePatch===p.id).length,0,'an armor face cannot retain invisible equipment capability');
});

test('native generated rooms match the reserved footprints and depth on all six rotated faces',()=>{
 const s=fixture(true),patches=C.surfacePatches(s).filter(p=>p.host==='p1');assert.equal(patches.length,6);
 for(const p of patches){equip(s,p,{weapons:0,cooling:34,sensors:33,habitation:33});const rooms=s.parts.filter(q=>q.surfacePatch===p.id&&!q.surfaceUnplaced);assert.ok(rooms.length>0,p.face);
  for(const q of rooms){assert.ok(q.room?.every(n=>n>0));const T=C.structTriangles(C.roomShape(q)),uv=[],n=[];
   for(let i=0;i<T.length;i+=3){const d=C.sub(Array.from(T.slice(i,i+3)),q.c);uv.push([C.dot(d,p.u),C.dot(d,p.v)]);n.push(C.dot(C.sub(Array.from(T.slice(i,i+3)),q.surfacePoint),p.normal));}
   assert.ok(uv.every(([u,v])=>Math.abs(u)<=q.surfaceFootprint[0]/2+1e-4&&Math.abs(v)<=q.surfaceFootprint[1]/2+1e-4),p.face+' '+q.k+' physically extends outside its reserved tangent rectangle');
   assert.ok(Math.abs(Math.max(...n))<1e-4,p.face+' room must end at its selected face');assert.ok(Math.abs(Math.min(...n)+q.room[2])<1e-4,p.face+' inward depth must match its declared room depth');
  }
 }
});

test('explicit guns and three equipment shares reserve one face and cosmetic density changes no capability',()=>{
 const s=fixture(),p=face(s);equip(s,p);const items=owned(s).filter(q=>q.surfacePatch===p.id),role=q=>q.k==='sensor'?'sensors':q.k==='habitat'?'habitation':q.k==='hdis'?'cooling':'weapons';
 const categories=C.surfaceReport(s).patches.find(q=>q.id===p.id).categories;
 for(const k of roles){const group=items.filter(q=>role(q)===k);assert.ok(group.length>0,k);const occupied=group.reduce((n,q)=>n+q.surfaceFootprint[0]*q.surfaceFootprint[1],0);assert.ok(occupied<=categories[k].budgetArea+1e-6,k+' may consume only its reserved budget of the common face area');}
 for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){const a=items[i],b=items[j],d=C.sub(a.surfacePoint,b.surfacePoint),u=Math.abs(C.dot(d,p.u)),v=Math.abs(C.dot(d,p.v));assert.ok(u>=(a.surfaceFootprint[0]+b.surfaceFootprint[0])/2-1e-5||v>=(a.surfaceFootprint[1]+b.surfaceFootprint[1])/2-1e-5,'two functional devices may not reserve the same part of the face');}
 const before=identity(s),report=plain(C.surfaceReport(s).patches.find(q=>q.id===p.id).categories);assert.equal(C.setSurfaceConfig(s,p.id,{style:{density:0,seed:999}}).ok,true);
 assert.deepEqual(identity(s),before);assert.deepEqual(plain(C.surfaceReport(s).patches.find(q=>q.id===p.id).categories),report);
});

test('splitting and rejoining a face reserves only each child area and restores its native equipment mass',()=>{
 const s=fixture(),p=face(s);equip(s,p,shares('cooling'));const before=C.surfaceReport(s).patches.find(q=>q.id===p.id),volume=()=>s.parts.filter(q=>q.surfacePatch&&!q.surfaceUnplaced).reduce((n,q)=>n+C.partVolume(q),0),originalVolume=volume();
 const split=C.surfaceSplit(s,p.id,'u',.5);assert.equal(split.ok,true);const report=C.surfaceReport(s),children=report.patches.filter(q=>split.ids.includes(q.id));assert.equal(children.length,2);
 assert.ok(Math.abs(children.reduce((n,q)=>n+q.area,0)-before.area)<1e-6);assert.ok(Math.abs(children.reduce((n,q)=>n+q.categories.cooling.budgetArea,0)-before.categories.cooling.budgetArea)<1e-6);
 for(const child of children){assert.equal(child.config.functionMode,'equipment');assert.deepEqual(plain(child.config.allocation),shares('cooling'));assert.ok(child.occupiedArea<=child.area+1e-6);}
 assert.ok(volume()<=originalVolume+1e-6,'both children may not regenerate a complete copy of the original whole-face equipment');
 const merged=C.surfaceMerge(s,split.ids);assert.equal(merged.ok,true,merged.why);const restored=C.surfaceReport(s).patches.find(q=>q.id===merged.ids[0]);assert.ok(restored);assert.equal(restored.mass,before.mass);assert.equal(volume(),originalVolume);
});

test('v3 composite mirroring and repeated reload retain equipment shares, explicit guns and stable devices',()=>{
 const s=fixture(),p=face(s);equip(s,p,{weapons:10,cooling:20,sensors:30,habitation:40},{style:{seed:197,density:.9}});
 const template=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(s,{parts:[1],fits:[]},{name:'Equipment section'}).template));assert.equal(template.surfaces.version,3);
 const dst=C.newShip({L:600,W:300,H:200,plan:'rect',sec:'rect'},'Mirror destination');dst.hull.assembly=true;dst.parts=[];dst.fits=[];
 const placed=C.assemblyPlace(dst,template,[250,70,90],{mirror:true});assert.equal(placed.groups.length,2);const hosts=placed.parts.filter(q=>q.k==='struct');assert.equal(hosts.length,2);
 for(const host of hosts){const q=dst.surfaces.patches.find(q=>q.id.startsWith('p'+host.id+':')&&q.functionMode==='equipment');assert.ok(q);assert.deepEqual(plain(q.allocation),plain(C.surfaceAllocation({cooling:20,sensors:30,habitation:40})));assert.equal(q.battery.count,2);}
 const sourceCount=owned(s).filter(q=>!q.surfaceUnplaced).length;for(const host of hosts)assert.equal(owned(dst).filter(q=>q.surfacePatch.startsWith('p'+host.id+':')&&!q.surfaceUnplaced).length,sourceCount,'a translated/mirrored identical host must keep all physical devices installed');
 const A=hosts.find(q=>q.c[2]>0),B=hosts.find(q=>q.c[2]<0);for(const a of owned(dst).filter(q=>q.surfacePatch.startsWith('p'+A.id+':'))){const b=owned(dst).find(q=>q.surfacePatch.startsWith('p'+B.id+':')&&q.surfaceCell===a.surfaceCell);assert.ok(b,a.surfaceCell);assert.ok(Array.isArray(a.surfaceNormal||a.n)&&Array.isArray(b.surfaceNormal||b.n),a.surfaceCell+' mirrored devices must retain their face normals');assert.ok(C.len(C.sub(b.surfacePoint,C.mirrorP(a.surfacePoint)))<1e-4);assert.ok(C.dot(b.surfaceNormal||b.n,C.mirrorP(a.surfaceNormal||a.n))>.999);}
 const before=identity(dst),loaded=C.deserialize(C.serialize(dst));C.surfaceSync(loaded);C.surfaceSync(loaded);const again=C.deserialize(C.serialize(loaded));C.surfaceSync(again);
 assert.deepEqual(identity(again),before);assert.deepEqual(plain(again.surfaces),plain(loaded.surfaces));
});

test('zero allocations remove real capabilities and sensors consume physical room, mass and power',()=>{
 const s=fixture(),p=face(s);equip(s,p,shares('sensors'));const sensors=s.parts.filter(q=>q.surfacePatch===p.id&&q.k==='sensor');assert.ok(sensors.length>0);
 assert.ok(sensors.every(q=>q.room?.[2]===2&&C.partVolume(q)>0));const S=C.computeStats(s),row=S.surface.patches.find(q=>q.id===p.id),suite=C.sensorSuite(s,S).sens;
 assert.ok(row.mass>0);assert.ok(row.powerDemand>0,'sensor equipment must have a nonzero common electrical demand');assert.ok(Object.values(suite).some(n=>n>0));
 equip(s,p,shares('cooling'));const after=C.computeStats(s),remaining=owned(s).filter(q=>q.surfacePatch===p.id);assert.ok(remaining.length>0);assert.ok(remaining.every(q=>q.k==='hdis'));
 assert.equal(s.fits.filter(q=>q.surfacePatch===p.id).length,0);assert.equal(after.explicitCrewCapacity||0,0);assert.ok(Object.values(C.sensorSuite(s,after).sens).every(n=>n===0),'a former sensor face cannot keep a hidden sensor contribution at zero allocation');
});

test('thin habitation rooms missed by the volume sampler reserve living capacity without crediting it twice',()=>{
 const s=fixture();s.parts[0].s=[2000,1000,800];s.parts[0].c=[1000,400,0];delete s.surfaces;assert.equal(C.enableSurfaceMode(s,true).ok,true);const p=face(s,'top');
 equip(s,p,shares('habitation'),{equipment:{kind:'hdis',depth:.2}});const rooms=s.parts.filter(q=>q.surfacePatch===p.id);assert.ok(rooms.length>0);
 const physical=rooms.reduce((n,q)=>n+C.partVolume(q),0),h=C.habitationSpace(s),S=C.computeStats(s),row=S.surface.patches.find(q=>q.id===p.id);
 assert.ok(physical>0);assert.ok(h.explicitVolume>0,'thin real rooms must remain visible in allocated living capacity even when no volume sample intersects them');
 assert.ok(Math.abs(h.explicitVolume-physical)<physical*1e-8);assert.ok(Math.abs(h.freeVolume+h.explicitVolume-h.volume)<h.volume*1e-10);
 assert.equal(S.explicitHabitationVolume,h.explicitVolume);assert.ok(S.explicitCrewCapacity>0);assert.ok(row.habitationCapacity>0);assert.ok(Math.abs(row.physicalHabitationVolume-physical)<physical*1e-8);
 assert.ok(S.habitableVolume<=h.envelopeVolume+1e-4,'dedicated rooms must reserve the existing living envelope rather than add a second copy of its capacity');
 const profile=C.fleetProfile(S,s.name,s),quarters=profile.modules.filter(m=>m.k==='quarters'),total=quarters.reduce((n,m)=>n+m.size,0);
 assert.ok(Math.abs(total-h.volume)<Math.max(1e-4,h.volume*1e-9),'native and synthetic quarters must share one volume and damage budget');
 const native=quarters.filter(m=>rooms.some(q=>q.id===m.part));assert.equal(native.length,rooms.length);assert.ok(Math.abs(native.reduce((n,m)=>n+m.size,0)-h.explicitVolume)<physical*1e-8);
});

test('a local hit damages an actual habitation room and crew through common quarters damage only',()=>{
 const s=fixture();s.parts.push({id:s.nextId++,k:'gen',c:[80,50,60],d:10});const p=face(s);equip(s,p,shares('habitation'));
 const {S,u}=unit(s),rooms=s.parts.filter(q=>q.surfacePatch===p.id),devices=u.p.surface.devices.filter(d=>rooms.some(q=>q.id===d.id));assert.ok(devices.length>=2);assert.ok(S.explicitHabitationVolume>0);
 const a=devices[0],b=devices[1],m=u.p.modules[a.module];assert.equal(m.k,'quarters');assert.ok(m.part>0);assert.ok(u.p.crewNeed>0);const crew=u.crew,other=u.mods[b.module],Q=Math.max(1,u.p.hp*C.COMBAT.quantum),hp=Math.max(1,m.hits*C.modQ(m,Q));
 C.surfaceHit({time:1,rand:()=>.99,ev(){},out(){},sunk(){}},u,a.center,hp);
 assert.equal(u.mods[a.module],0);assert.equal(u.mods[b.module],other,'a direct local hit cannot uniformly destroy neighboring quarters');assert.ok(u.crew<crew,'destroyed physical quarters must use the common crew-casualty path');assert.equal(u.surfaceLastHit.patch,p.id);
});

test('global fit capacity rejects a new equipment layout atomically instead of silently dropping mounts',()=>{
 const s=fixture(),p=face(s);for(let i=0;i<C.DESIGN_LIMITS.fits;i++)s.fits.push({id:s.nextId++,k:'claser',p:[1000+i*10,0,0],a:4,ped:0,base:0,low:0,slope:0,float:false});
 const before=plain(C.serialize(s)),result=C.setSurfaceConfig(s,p.id,{functionMode:'equipment',allocation:shares('cooling'),battery:{weapon:'claser',count:2,spacing:1},equipment:{depth:2,limit:0}});
 assert.equal(result.ok,false);assert.match(result.why,/上限|限界|limit|capacity/i);assert.deepEqual(plain(C.serialize(s)),before,'failed allocation may not leave a new config, partial devices or consumed IDs');
});

test('global part capacity rejects newly allocated physical equipment without mutating the old face',()=>{
 const s=fixture(),p=face(s);assert.equal(C.setSurfaceConfig(s,p.id,{functionMode:'armor',armor:{material:'light',thickness:.6}}).ok,true);
 for(let i=s.parts.length;i<C.DESIGN_LIMITS.parts;i++)s.parts.push({id:s.nextId++,k:'sensor',c:[1000+i*10,0,0],d:1});
 const before=plain(C.serialize(s)),result=C.setSurfaceConfig(s,p.id,{functionMode:'equipment',allocation:shares('cooling'),equipment:{kind:'hdis',depth:2}});
 assert.equal(result.ok,false);assert.match(result.why,/上限|限界|limit|capacity/i);assert.deepEqual(plain(C.serialize(s)),before);assert.equal(C.surfaceConfig(s,p.id).functionMode,'armor');
});

test('opposite thin-plate faces and adjacent corners cannot install two devices in the same internal volume',()=>{
 for(const sample of [{size:[40,40,4],faces:['top','bottom'],depth:3},{size:[40,40,40],faces:['top','port'],depth:24}]){
  const s=fixture();s.parts[0].s=sample.size;s.parts[0].c=[40,20,0];delete s.surfaces;assert.equal(C.enableSurfaceMode(s,true).ok,true);
  const patches=sample.faces.map(f=>face(s,f));for(const p of patches)equip(s,p,shares('cooling'),{equipment:{kind:'hdis',depth:sample.depth}});
  const byFace=patches.map(p=>s.parts.filter(q=>q.surfacePatch===p.id&&!q.surfaceUnplaced));assert.ok(byFace.flat().length>0);
  for(const a of byFace[0])for(const b of byFace[1]){const A=C.partAABB(a),B=C.partAABB(b),intersection=[0,1,2].map(i=>Math.min(A[i+3],B[i+3])-Math.max(A[i],B[i]));assert.ok(!intersection.every(n=>n>1e-4),sample.faces.join('/')+' rooms reserve the same real internal volume');}
  const report=C.surfaceReport(s);assert.ok(report.warnings.some(w=>/他の面|内部容積|volume|collision|overlap/i.test(w.text)),'a blocked internal reservation needs a visible placement diagnosis');
 }
});

test('one Apply releases earlier-face depth reservations for later faces without requiring a second synchronization',()=>{
 const changes=[{functionMode:'armor'},{allocation:shares('cooling'),battery:{weapon:'none'},equipment:{limit:0}},{equipment:{depth:.2}}];
 for(const change of changes){
  const s=fixture();s.parts[0].s=[40,40,4];s.parts[0].c=[40,2,0];delete s.surfaces;assert.equal(C.enableSurfaceMode(s,true).ok,true);
  const ordered=s.surfaces.patches.filter(q=>/:top:|:bottom:/.test(q.id)),a=ordered[0],b=ordered[1],count=id=>s.parts.filter(q=>q.surfacePatch===id&&!q.surfaceUnplaced).length;
  assert.equal(C.setSurfaceConfig(s,[b.id,a.id],{functionMode:'equipment',allocation:shares('cooling'),equipment:{kind:'hdis',depth:3}}).ok,true);assert.ok(count(a.id)>0);assert.equal(count(b.id),0);
  assert.equal(C.setSurfaceConfig(s,a.id,change).ok,true);assert.ok(count(b.id)>0,'free space from '+JSON.stringify(change)+' must be available in the same Apply');
  const once=identity(s);C.surfaceSync(s);assert.deepEqual(identity(s),once,'a second sync may not be needed to converge the physical design');
  const loaded=C.deserialize(C.serialize(s));C.surfaceSync(loaded);assert.deepEqual(identity(loaded),once);assert.deepEqual(plain(loaded.surfaces.patches.map(q=>q.id)),plain(s.surfaces.patches.map(q=>q.id)),'input selection order must not reorder persisted reservation ownership');
 }
});

test('partial overlap with an independent native room blocks placement even when the candidate center is outside it',()=>{
 const s=fixture(),p=face(s);equip(s,p,shares('cooling'));const seed=s.parts.find(q=>q.surfacePatch===p.id&&!q.surfaceUnplaced);assert.ok(seed);
 const native={id:s.nextId++,k:'sensor',c:C.add(seed.c,C.mul(p.u,6)),room:seed.room.slice(),d:seed.d,surfaceNormal:seed.surfaceNormal.slice(),yaw:seed.yaw};
 const bounds=C.partAABB(native);assert.ok(seed.c.some((n,i)=>n<bounds[i]||n>bounds[i+3]),'the candidate center must defeat a center-inside-box collision test');assert.equal(C.overlapParts(seed,native),true,'the real native volumes still overlap at their edges');
 assert.equal(C.setSurfaceConfig(s,p.id,{functionMode:'armor'}).ok,true);s.parts.push(native);const nativeBefore=plain(C.serialize(s)).parts.find(q=>q.id===native.id);
 equip(s,p,shares('cooling'));const active=s.parts.filter(q=>q.surfacePatch===p.id&&!q.surfaceUnplaced);assert.ok(active.length>0);assert.ok(active.every(q=>!C.overlapParts(q,native)),'no installed device may share physical volume with the independent native sensor');
 assert.deepEqual(plain(C.serialize(s)).parts.find(q=>q.id===native.id),nativeBefore,'allocation must preserve the independent native part and its placement');assert.equal(native.surfacePatch,undefined);
 assert.ok(s.parts.length<=C.DESIGN_LIMITS.parts);assert.ok(s.fits.length<=C.DESIGN_LIMITS.fits);assert.ok(active.length<=256);assert.ok(C.surfaceReport(s).warnings.some(w=>/既存設備と内部容積/.test(w.text)),'blocked native volume needs a visible placement diagnosis');
 const once=identity(s);C.surfaceSync(s);assert.deepEqual(identity(s),once);
});
