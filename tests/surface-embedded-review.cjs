const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x)),only=role=>Object.fromEntries(['weapons','cooling','sensors','habitation'].map(k=>[k,k===role?100:0]));
const near=(a,b,label)=>{assert.equal(a.length,b.length);assert.ok(Math.hypot(...Array.from(a,(v,i)=>v-b[i]))<2e-4,label||'vectors differ');};
function fixture({weapon='pd',face='port',rotate=false,count=2,modern=false,foil=false,allocation=only('weapons')}={}){
 const ship=C.newShip({L:240,W:160,H:140,assembly:true},'Embedded review');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};ship.detail=1;
 const body=C.placePart(ship,foil?'wing':'struct',[100,60,0],foil?[80,50,8]:[120,100,80],foil?{}:{form:'box',...(rotate?{yaw:29,pitch:21,roll:13}:{})},false);assert.ok(body?.id);
 if(foil)body.wing=C.normalizeWing({...body.wing,foil:true,axis:'x',open:10,stow:50});
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face===(foil?'top':face));assert.ok(patch?.exposed);
 const config={functionMode:modern?'equipment':'legacy',battery:{weapon,count,spacing:2,angle:17},equipment:{kind:modern?'hdis':'none',count:0,depth:3},style:{kind:'machinery',density:.8,seed:137},...(modern?{allocation}:{})};
 const result=C.setSurfaceConfig(ship,patch.id,config);assert.equal(result.ok,true,result.why);
 return {ship,body,patch:C.surfacePatches(ship).find(p=>p.id===patch.id)};
}
const active=s=>s.fits.filter(f=>f.surfacePatch&&!f.float&&!f.surfaceUnplaced);
function vertices(g,spans){const out=[];if(!g)return out;for(const [,start,count]of spans||[['',0,g.ni]])for(let i=start;i<start+count;i++)out.push(Array.from(g.pos.slice(g.idx[i]*3,g.idx[i]*3+3)));return out;}
function compact(points,port,label){assert.ok(points.length>0,label+' has no opening geometry');for(const p of points){assert.ok(p.every(Number.isFinite));assert.ok(p.every((v,i)=>v>=port.bounds[i]-2e-4&&v<=port.bounds[i+3]+2e-4),label+' contains a full turret or geometry outside the shared opening bounds');}}
function visibleIdentity(s){return plain(active(s).map(f=>({id:f.id,k:f.k,cell:f.surfaceCell,patch:f.surfacePatch,point:f.surfacePoint})).sort((a,b)=>a.id-b.id));}

test('procedural and reference surface guns render only compact wall openings in every mesh entry point',()=>{
 for(const weapon of ['pd','refVen']){const {ship}=fixture({weapon}),fits=active(ship);assert.equal(fits.length,2);const ranges={},g=G.meshFits(ship,null,ranges),ref=G.meshReferenceFits(ship),preview=G.meshPreview(ship,[],fits);
  assert.equal(ref.ni,0,'surface reference weapons cannot render their original asset');assert.equal(preview.previewRefFits.ni,0);
  for(const f of fits){const port=C.surfaceBatteryGeometry(f);assert.ok(port?.embedded);assert.equal(C.fitSpec(f),C.FITS[weapon],'embedding must not replace or mutate the weapon definition');compact(vertices(g,(ranges[f.id]||[]).filter(r=>r[0]==='fits')),port,weapon+' editor');compact(vertices(G.meshFits(ship,q=>q.id===f.id)),port,weapon+' filtered mesh');}
  assert.equal(preview.previewFits.ni,g.ni);const asset=G.fleetGeometry(ship,{trial:true});
  for(const f of fits){const port=C.surfaceBatteryGeometry(f),t=asset.turrets.find(t=>t.id===f.id);assert.ok(t,'embedded battery remains in common gunnery metadata');assert.equal(t.embedded,true);assert.equal(t.mesh,null,'an aperture must not become a rotating detached turret mesh');near(t.origin,port.mouth);assert.ok(t.fw.every(Number.isFinite)&&C.len(t.fw)>.99);assert.ok(!Object.keys(asset.meshes).some(k=>(k==='tur_'+f.id||k==='refTur_'+f.id)&&asset.meshes[k].geo.ni>0));}
 }
});

test('independent manual guns retain their full native procedural and reference geometry beside surface batteries',()=>{
 for(const weapon of ['pd','refVen']){const {ship,body}=fixture({weapon}),top=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face==='top'),placed=C.placeFit(ship,weapon,top.center,top.normal,0,false),manual=placed.fit;assert.ok(manual,placed.err);assert.equal(C.surfaceBatteryGeometry(manual),null);
  const render=()=>C.FITS[weapon].asset?G.meshReferenceFits(ship,null,[manual]):G.meshFits(ship,f=>f.id===manual.id),mixed=render(),isolated={...ship,fits:[manual]},alone=C.FITS[weapon].asset?G.meshReferenceFits(isolated):G.meshFits(isolated);assert.ok(mixed.ni>0);assert.equal(mixed.ni,alone.ni);assert.deepEqual(plain(vertices(mixed)),plain(vertices(alone)),'surface rendering must not globally scale, replace or hide manual guns');
  const distances=vertices(mixed).map(p=>C.dot(C.sub(p,manual.p),C.fitUp(manual)));assert.ok(Math.max(...distances)>1,'manual turret should still have its original raised body');const a=G.fleetGeometry(ship),t=a.turrets.find(t=>t.id===manual.id);assert.ok(t?.mesh&&a.meshes[t.mesh]?.geo.ni>0);assert.equal(t.embedded,false);
 }
});

test('the real port mouth, compact bounds and combat profile agree on all six rotated mounting faces',()=>{
 for(const face of ['fore','aft','port','stbd','top','bottom']){const {ship,patch}=fixture({face,rotate:true,count:1}),f=active(ship)[0];assert.ok(f,face);const port=C.surfaceBatteryGeometry(f);near(port.point,f.surfacePoint);assert.ok(C.dot(port.normal,patch.normal)>.9999);near(port.dir,patch.normal);near(C.turretOrigin(f),port.mouth);assert.ok(Math.abs(C.dot(C.sub(port.mouth,port.point),port.normal)-port.lip)<1e-8);assert.ok(port.lip<=.2,'port must remain flush instead of growing a turret');near(C.fitAABB(f),port.bounds,'compact common collision bounds');
  assert.ok(Math.abs(C.dot(port.u,port.normal))<1e-8&&Math.abs(C.dot(port.v,port.normal))<1e-8);compact(vertices(G.meshFits(ship)),port,face);
  const S=C.computeStats(ship),profile=C.fleetProfile(S,ship.name,ship),m=profile.surface.mounts.find(m=>m.id===f.id);assert.ok(m?.embedded);near(C.add(m.muzzle,profile.surface.offset),port.mouth);near(m.dir,port.normal);assert.equal(m.barrelLength,0);
 }
});

test('mirrored composite ports keep reflected mouths and compact bounds through repeated public reload',()=>{
 const {ship,body}=fixture({rotate:true,count:1}),template=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(ship,{parts:[body.id],fits:[]},{name:'Embedded section'}).template)),dst=C.newShip({L:600,W:300,H:200,assembly:true},'Mirror embedded');dst.parts=[];dst.fits=[];dst.nextId=1;const result=C.assemblyPlace(dst,template,[250,80,100],{mirror:true});assert.equal(result.groups.length,2);
 const hosts=result.parts.filter(p=>p.k==='struct'),A=hosts.find(p=>p.c[2]>0),B=hosts.find(p=>p.c[2]<0);assert.ok(A&&B);const left=active(dst).filter(f=>f.surfacePatch.startsWith('p'+A.id+':'));assert.equal(left.length,1);
 for(const a of left){const b=active(dst).find(f=>f.surfacePatch.startsWith('p'+B.id+':')&&f.surfaceCell===a.surfaceCell);assert.ok(b);const ga=C.surfaceBatteryGeometry(a),gb=C.surfaceBatteryGeometry(b);near(gb.mouth,C.mirrorP(ga.mouth));near(gb.normal,C.mirrorP(ga.normal));near(gb.bounds,[ga.bounds[0],ga.bounds[1],-ga.bounds[5],ga.bounds[3],ga.bounds[4],-ga.bounds[2]]);}
 const before=visibleIdentity(dst),loaded=C.deserialize(C.serialize(dst));C.surfaceSync(loaded);const twice=C.deserialize(C.serialize(loaded));C.surfaceSync(twice);assert.deepEqual(visibleIdentity(twice),before);for(const f of active(twice))compact(vertices(G.meshFits(twice,q=>q.id===f.id)),C.surfaceBatteryGeometry(f),'reloaded mirrored port');
});

test('static embedded ports move once with their S-foil and own the actual fitting index range',()=>{
 const {ship,body}=fixture({foil:true,count:1}),f=active(ship)[0],port=C.surfaceBatteryGeometry(f),ranges={},raw=G.meshFits(ship,null,ranges),asset=G.fleetGeometry(ship),foil=asset.foils.find(q=>q.id===body.id),meta=asset.turrets.find(t=>t.id===f.id);assert.ok(foil&&meta);assert.equal(meta.foilId,body.id);assert.equal(meta.mesh,null);compact(vertices(raw,ranges[f.id]),port,'articulated port');
 const moving=foil.meshes.filter(k=>foil.kinds[k]==='fits');assert.equal(moving.length,1);assert.equal(asset.meshes[moving[0]].geo.ni,raw.ni);assert.equal(asset.meshes.fits?.geo.ni||0,0,'no stationary copy of the embedded opening');
});

test('actual worker foil clearance keeps embedded mouths and full frames on the moving wall',()=>{
 const engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),start=engine.indexOf('function trialRayPose('),end=engine.indexOf('\nfunction handleTrialRays(',start);assert.ok(start>=0&&end>start);
 vm.runInContext('const C=Core;'+engine.slice(start,end),cx);const poseRays=vm.runInContext('trialRayPose',cx);
 for(const axis of ['x','y','z'])for(const weapon of ['pd','refVen','casemateLight','claser']){
  const ship=C.newShip({L:480,W:320,H:280,assembly:true},'Worker articulated port');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};
  const body=C.placePart(ship,'struct',[200,120,90],[160,100,48],{form:'box',yaw:29,pitch:21,roll:13},false);body.wing=C.normalizeWing({foil:true,axis,open:10,stow:50,pivot:[160,100,20]});
  const patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face==='top');assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'legacy',armor:{thickness:8},battery:{weapon,count:1,spacing:2,angle:17},equipment:{kind:'none',count:0}}).ok,true);
  const fit=active(ship)[0];assert.ok(fit,axis+' '+weapon);const port=C.surfaceBatteryGeometry(fit),frame=C.foilFrame(ship,body),rotate=v=>C.sub(C.foilAt(frame,body,C.add(frame.pv,v),50),frame.pv),held={ship,fits:new Map(ship.fits.map(f=>[f.id,f])),ctx:C.turretRayContext(ship)},before=C.publicJSON(ship),posed=poseRays(held,{[body.id]:0}),copy=posed.fits.get(fit.id),actual=C.surfaceBatteryGeometry(copy);
  near(copy.surfacePoint,C.foilAt(frame,body,fit.surfacePoint,50),'the worker must pose the semantic wall point, not just fit.p');near(C.turretOrigin(copy),C.foilAt(frame,body,port.mouth,50),'worker ray origin must follow the visible mouth');near(actual.normal,rotate(port.normal));near(actual.u,rotate(port.u));near(actual.v,rotate(port.v));assert.equal(actual.armorOffset,8);assert.equal(actual.width,port.width);assert.equal(actual.height,port.height);assert.deepEqual(plain(copy.surfaceFootprint),plain(fit.surfaceFootprint));
  assert.ok(C.turretClear(posed.ship,copy,actual.normal,posed.ctx),'a clear outward ray must leave the actual articulated opening');assert.equal(poseRays(held,{[body.id]:0}),posed,'cached requests use the same posed geometry');assert.equal(C.publicJSON(ship),before,'worker posing cannot mutate the source design');
 }
});

test('an embedded battery takes local common damage and disappears when its weapon allocation reaches zero',()=>{
 const {ship,patch}=fixture({modern:true}),fits=active(ship);assert.ok(fits.length>=2);const S=C.computeStats(ship),p=C.fleetProfile(S,ship.name,ship),u=C.fleetUnit('embedded','embedded',p,0);u.pos=[0,0,0];u.yaw=0;const a=p.surface.mounts.find(m=>m.id===fits[0].id),b=p.surface.mounts.find(m=>m.id===fits[1].id),m=p.modules[a.module],other=u.mods[b.module],hp=Math.max(1,m.hits*C.modQ(m,Math.max(1,p.hp*C.COMBAT.quantum)));
 C.surfaceHit({time:1,rand:()=>.99,ev(){},out(){},sunk(){}},u,a.center,hp);assert.equal(u.mods[a.module],0);assert.equal(u.mods[b.module],other);const ranges={};G.meshFits(ship,null,ranges);assert.ok(ranges[fits[0].id]?.some(r=>r[0]==='fits'),'visible port belongs to the damaged real gun ID');
 assert.equal(C.setSurfaceConfig(ship,patch.id,{allocation:only('cooling')}).ok,true);assert.equal(active(ship).length,0);assert.equal(G.meshFits(ship).ni,0);assert.equal(G.meshReferenceFits(ship).ni,0);assert.equal(G.fleetGeometry(ship).turrets.length,0,'zero weapon allocation cannot retain invisible gunnery state');
});

test('legacy backing armor stays visible around the compact embrasure and an off-port hit does not damage an invisible turret',()=>{
 const {ship,patch}=fixture();assert.equal(C.setSurfaceConfig(ship,patch.id,{armor:{material:'standard',thickness:8}}).ok,true);const f=active(ship)[0],port=C.surfaceBatteryGeometry(f),S=C.computeStats(ship),profile=C.fleetProfile(S,ship.name,ship),u=C.fleetUnit('armored','armored',profile,0);u.pos=[0,0,0];u.yaw=0;
 const m=profile.surface.mounts.find(q=>q.id===f.id),mi=m.module,health=u.mods[mi],offset=port.width/2+.35,outside=C.sub(C.add(f.surfacePoint,C.mul(port.u,offset)),profile.surface.offset),ctx={time:1,rand:()=>.99,ev(){},out(){},sunk(){}};assert.ok(offset<f.surfaceFootprint[0]/2,'fixture must hit the old oversized external turret footprint');
 assert.equal(C.surfaceHit(ctx,u,outside,.001),0,'the backing plate absorbs a small off-port impact');assert.equal(u.mods[mi],health,'an off-port impact cannot hit an invisible raised turret');assert.equal(u.surfaceLastHit?.thickness,8);
 const module=profile.modules[mi],hp=Math.max(1,module.hits*C.modQ(module,Math.max(1,profile.hp*C.COMBAT.quantum)));C.surfaceHit(ctx,u,m.muzzle,Math.max(.1,hp*.25));assert.ok(u.mods[mi]<health,'a direct visible opening hit must still damage the actual gun');assert.equal(u.surfaceLastHit?.patch,patch.id);
 const afterMouth=u.mods[mi];C.surfaceHit(ctx,u,C.sub(f.surfacePoint,profile.surface.offset),Math.max(.1,hp*.1));assert.ok(u.mods[mi]<afterMouth,'the common incoming hull-plane ray must still reach the same narrow opening through its armor well');
 assert.ok(C.dot(C.sub(port.point,f.surfacePoint),port.normal)>=7.99,'the visible opening must reach the outer plate instead of being buried beneath eight metres of armor');compact(vertices(G.meshFits(ship,q=>q.id===f.id)),port,'armored embrasure');
});

test('large machinery cases have genuinely different back and front offsets while graphics preserve native capabilities',()=>{
 const {ship,patch}=fixture({modern:true,allocation:only('cooling')}),stats=()=>{const S=C.computeStats(ship);return plain({mass:S.mass,cost:S.cost,power:S.power,crew:S.crew,parts:ship.parts.filter(q=>q.surfacePatch).map(q=>({id:q.id,k:q.k,c:q.c,room:q.room})),categories:S.surface.patches.find(p=>p.id===patch.id).categories});},before=stats(),blueprint=C.publicJSON(ship),plan=G.surfaceVisualPlan(ship).find(p=>p.id===patch.id),cases=plan.field.filter(q=>q.feature==='service-housing');assert.ok(cases.length>=8);
 const backs=cases.map(q=>C.dot(C.sub(q.center,patch.center),patch.normal)-q.size[2]/2),fronts=cases.map(q=>C.dot(C.sub(q.center,patch.center),patch.normal)+q.size[2]/2),sizes=cases.map(q=>Math.sqrt(q.size[0]*q.size[1])).sort((a,b)=>a-b);assert.ok(sizes[Math.floor(sizes.length/2)]>=3,'the primary field must use larger units than the previous small greebles');assert.ok(Math.max(...backs)-Math.min(...backs)>=.5,'different thickness alone does not offset equipment forwards and backwards');assert.ok(Math.max(...fronts)-Math.min(...fronts)>=.8,'front silhouettes need substantial real depth variation');
 G.meshParts(ship,{coded:false});G.fleetGeometry(ship);G.surfaceVisualPlan(ship,{detail:0,maxDetails:0});assert.equal(C.publicJSON(ship),blueprint);assert.deepEqual(stats(),before,'larger decorative volume cannot create mass, free cooling or new native units');
});
