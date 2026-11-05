const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b,e=1e-7)=>assert.ok(Math.abs(a-b)<=e,`${a} != ${b}`),vector=(a,b,e)=>a.forEach((v,i)=>near(v,b[i],e));
const MODELS=[
 ['ion','capital_twin175_ion',2,175,true],['stl','capital_twin175',2,175,false],
 ['quad175','capital_quad175',4,175,false],['triple175','capital_triple175',3,175,false],
 ['ball175TripleIon','capital_ball175_triple_ion',3,175,true],['ball175Quad','capital_ball175_quad',4,175,false],
 ['ball175QuadIon','capital_ball175_quad_ion',4,175,true],['ball720','capital_ball720_single',1,720,false],['utl','capital_twin720',2,720,false]
];
const fit=(k,extra={})=>({id:17,k,p:[500,0,0],a:2,base:0,ped:0,low:0,float:false,...extra});
function deck(k){const s=C.newShip({assembly:true,L:1200,W:900,H:200},'Capital weapon equipment');s.parts=[];s.fits=[];C.placePart(s,'struct',[600,-100,0],[1200,900,200],{form:'box'},false);const f=fit(k,{id:s.nextId++});s.fits=[f];return {s,f};}
// Independently integrate the actual available convex room cells below the
// mounting plane. Closing caps lie in Y=0 and contribute no signed tetrahedron
// volume, so this does not reuse the runtime's envelope/solid Boolean clipping.
function roomVolumeBelowMount(a){
 let volume=0;for(const cell of a.turretCompartment.convexes)for(const ids of cell.faces){const face=ids.map(i=>cell.verticesM[i]),clipped=[];
  for(let i=0;i<face.length;i++){const p=face[i],q=face[(i+1)%face.length],inside=p[1]<=0,next=q[1]<=0;if(inside)clipped.push(p);if(inside!==next){const t=-p[1]/(q[1]-p[1]);clipped.push(p.map((v,j)=>v+(q[j]-v)*t));}}
  for(let i=1;i<clipped.length-1;i++)volume+=C.dot(clipped[0],C.cross(clipped[i],clipped[i+1]))/6;
 }return volume;
}

test('nine capital entries use physical native models and exact per-barrel gun or ion energies',()=>{
 assert.deepEqual(plain(C.CAPITAL_TURRET_KEYS),MODELS.map(([k])=>k));
 for(const [k,id,n,bolt,ion]of MODELS){
  const d=C.fitSpec({k}),a=C.REFERENCE_ASSETS[id];assert.ok(a,k+' model must be registered');
  assert.equal(d.asset,id);assert.equal(d.barrels,n);assert.equal(d.boltTT,bolt);
  near(d.tt||0,ion?0:n*bolt);near(d.ion||0,ion?n*bolt:0);near(d.power,n*bolt*C.TT/d.cycle,1e9);
  near(C.weaponModelScale(k),1);assert.equal(C.weaponSizing(k).calibration,'capital-photo-family');
  vector([d.fm,d.hm,d.wm],a.size);assert.equal(d.casemate,false);assert.equal(d.fixed,false);assert.equal(C.fitCanRotate(k),true);
 }
 assert.equal(C.FITS.ionL.asset,undefined,'the existing 120 GT light ion cannon is not rebound to the 175 TT heavy house');
 near(C.FITS.ionL.boltTT,.12);near(C.FITS.pd.boltTT,.02);assert.ok(C.FLEET_PROFILE_VERSION>=10);
});

test('barrel counts share the corrected photographic size anchors and the ion twin owns the cast bowl',()=>{
 for(const k of ['ion','stl','triple175','quad175'])vector([C.FITS[k].fm,C.FITS[k].hm,C.FITS[k].wm],[60,16.5,45],.01);
 vector([C.FITS.utl.fm,C.FITS.utl.hm,C.FITS.utl.wm],[90,24.75,67.5],.01);
 const model=k=>C.REFERENCE_ASSETS[C.FITS[k].asset];assert.equal(model('ion').caseStyle,'flattened-is-cast-bowl');
 for(const k of ['stl','triple175','quad175','utl'])assert.equal(model(k).caseStyle,'forward-wide-naval-hexagon');
 assert.match(C.FITS.ion.desc,/お椀型/);assert.match(C.FITS.stl.desc,/角形/);
 assert.ok(C.FITS.stl.fm>C.FITS.oct40.fm&&C.FITS.stl.wm>C.FITS.oct40.wm,'the normal 175 TT twin is visibly larger than the existing ISD octuple');
 const balls=['ball175TripleIon','ball175Quad','ball175QuadIon','ball720'];
 const common=balls.map(k=>C.REFERENCE_ASSETS[C.FITS[k].asset]);
 for(const a of common){near(a.sphereRadiusM,18,.001);near(a.sphereCenterM[1],6,.001);assert.equal(a.gunhouseElevates,true);assert.equal(a.elevationIndexStart,0);
  const mesh=C.decodeReference(C.FITS[a.catalogKind].asset),range=a.sphereMeshRange,heights=Array.from({length:range.vertices},(_,i)=>mesh.pos[(range.firstVertex+i)*3+1]*a.size[1]+a.c[1]),bottom=Math.min(...heights),top=Math.max(...heights);near(bottom,-12,.01);near(top,24,.01);near(-bottom/(top-bottom),1/3,.001);
  near(a.grossSphereVolumeM3,24143.88428454102,.01);assert.ok(a.turretCompartment.volumeM3<a.grossSphereVolumeM3,'reserved moving machinery is excluded from available charging room');assert.ok(a.reservedMachineryAabbM.lowM.every((v,i)=>v<a.reservedMachineryAabbM.highM[i]));
 }
 for(const a of common.slice(1))near(a.turretCompartment.volumeM3,common[0].turretCompartment.volumeM3,.001);
 near(C.FITS.oct40.fm,40,.005);near(C.FITS.refVen.boltTT,70);near(C.FITS.quad200.boltTT,.2);
});

test('all capital joints and exact muzzle positions follow six mounting axes and a sloped surface',()=>{
 for(const [k,,n]of MODELS)for(const frame of [...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.93,.3])}]){
  const f=fit(k,{...frame,assetYaw:31}),a=C.REFERENCE_ASSETS[C.FITS[k].asset],g=C.authoredTurretGeometry(f);assert.ok(g,k);
  assert.equal(g.muzzles.length,n);assert.equal(g.indexStart,a.elevationIndexStart);
  if(!k.startsWith('ball')){assert.ok(g.indexStart>0,k+' leaves its gunhouse fixed in elevation');assert.notEqual(a.gunhouseElevates,true);}
  const rest=C.aimAuthoredTurret(g,0,0),aimed=C.aimAuthoredTurret(g,.25,.3);
  a.muzzlePoints.forEach((m,i)=>{const world=C.referenceFitPoint(f,m.map((v,j)=>(v-a.c[j])/a.size[j]));vector(g.muzzles[i],world,1e-6);vector(rest.muzzles[i],world,1e-6);});
  assert.ok(C.len(C.sub(aimed.muzzles[0],rest.muzzles[0]))>1,k+' actual muzzle must move with its joint');
  assert.equal(C.authoredTurretInArc(g,aimed.fw),true);assert.equal(C.authoredTurretInArc(g,C.aimAuthoredTurret(g,0,g.limits.hi+.01).fw),false);
 }
});

test('old capital source skins migrate to the new normal model without changing fitting identity or pose',()=>{
 for(const k of ['stl','ion','utl'])for(const skinAsset of ['isd_heavy_twin','isd_turret','isd_turret_3','isdh_turret','isd2_octuple']){
  const old={...fit(k,{p:[201,52,-38],assetYaw:23,a:2}),skinAsset,mountAxis:4,mountOffset:9,chargeSalvos:3,chargeDepth:18};
  const migrated=C.migrateWeaponFit(Object.freeze(old));assert.equal(migrated.k,k);assert.equal(migrated.id,old.id);vector(migrated.p,old.p);
  assert.equal(migrated.a,4);assert.equal(migrated.assetYaw,23);assert.equal(migrated.chargeSalvos,3);assert.equal(migrated.chargeDepth,18);
  assert.equal(migrated.skinAsset,undefined);assert.equal(migrated.mountAxis,undefined);assert.equal(migrated.mountOffset,undefined);assert.equal(old.skinAsset,skinAsset);
 }
 const current=fit('stl',{skinAsset:'capital_twin175'});assert.equal(C.migrateWeaponFit(current),current);assert.equal(current.skinAsset,'capital_twin175');
 const unrelated=fit('stl',{skinAsset:'family_triple40'});assert.equal(C.migrateWeaponFit(unrelated),unrelated);assert.equal(unrelated.skinAsset,'family_triple40','unrelated user skins are not silently removed');
 for(const [legacy,k]of [['refISD','stl'],['refIon','ion'],['refIonH','ion']]){const f=fit(legacy,{skinAsset:'isd_heavy_twin'}),migrated=C.migrateWeaponFit(f);assert.equal(migrated.k,k);assert.equal(migrated.skinAsset,undefined);assert.equal(migrated.id,17);}
});

test('capital gunhouses reserve real closed volume and no more stored energy than physically allocated',()=>{
 for(const k of ['ion','quad175','ball720']){
  const {s,f}=deck(k),a=C.REFERENCE_ASSETS[C.FITS[k].asset];C.syncCompartments(s);
  const q=C.chargingStatus(s)[f.id];assert.ok(q,k+' actual charging allocation');
  near(q.required,(C.fitSpec(f).tt||C.fitSpec(f).ion)/C.CHARGE_TT_M3,1e-5);
  near(q.housingVolume,a.turretCompartment.volumeM3,Math.max(1,a.turretCompartment.volumeM3*.002));
  assert.ok(q.housingVolume<a.size.reduce((n,v)=>n*v,1)*.9,k+' barrels and empty corners are not equipment rooms');
  assert.ok(q.internalRequired>=0);assert.ok(q.volume<=q.plannedVolume+1e-5);near(q.storedTT,q.volume*C.CHARGE_TT_M3,1e-5);
  near(q.ratio,1,1e-5);assert.equal(q.allocationPending,false);
  if(k==='ball720'){const embedded=roomVolumeBelowMount(a);assert.ok(q.embeddedVolume>0&&q.externalVolume>0);near(q.embeddedVolume,embedded,Math.max(.1,a.turretCompartment.volumeM3*.0005));near(q.externalVolume,a.turretCompartment.volumeM3-embedded,Math.max(.1,a.turretCompartment.volumeM3*.0005));assert.ok(q.housingVolume<a.grossSphereVolumeM3,'the whole sphere cannot be credited as available room');}
  const saved=C.deserialize(C.serialize(s)),copy=saved.fits.find(p=>p.id===f.id);assert.ok(copy);assert.equal(copy.k,k);vector(copy.p,f.p,1e-6);near(C.weaponChargeSpec(copy).volleyTT,C.weaponChargeSpec(f).volleyTT);
 }
});

test('the ISD uses six 175 TT twins and the aft ion pair at the existing eight battery stations',()=>{
 const s=C.newShip({assembly:true,L:1600,W:1000,H:200},'ISD battery station fixture');s.parts=[];s.fits=[];s.reference='imperial';
 C.placePart(s,'struct',[800,-50,0],[1600,1000,100],{form:'box'},false);C.attachReferenceSkin(s);
 const guns=s.fits.filter(f=>f.k==='stl'||f.k==='ion');assert.equal(guns.length,8);assert.equal(guns.filter(f=>f.k==='stl').length,6);assert.equal(guns.filter(f=>f.k==='ion').length,2);assert.equal(s.fits.some(f=>f.k==='oct40'),false);
 assert.equal(new Set(guns.map(f=>f.id)).size,8);
 for(let i=0;i<4;i++)for(const sign of [-1,1]){const f=guns.find(f=>Math.abs(f.p[0]-(281.76+62.36*i))<1e-5&&Math.abs(f.p[2]-sign*215.58)<1e-5);assert.ok(f,'existing station '+i+'/'+sign);assert.equal(f.k,i===0?'ion':'stl');assert.equal(f.float,false);near(C.fitSpec(f).boltTT,175);}
});

// Captured from the real profile9 Core at e7308e2096ed21f882f36f09268e47c9a589a15d.
// Its unchanged layout hash would otherwise retain the old35.4m square stl footprint.
const LEGACY_CAPITAL_SURFACE={"sourceCommit":"e7308e2096ed21f882f36f09268e47c9a589a15d","profileVersion":9,"patchId":"p1:port:0:cctl1g","state":{"format":"starship-yard","v":3,"propulsionModelVersion":1,"name":"Profile 9 capital surface cache","hull":{"name":"楔形","plan":"wedge","sec":"rect","L":400,"W":300,"H":200,"bowW":0.02,"bowH":0.5,"stern":1,"assembly":true},"cuts":[],"trenches":[],"solidCuts":[],"subs":[],"parts":[{"id":1,"k":"struct","c":[200,0,0],"s":[300,200,100],"taper":0,"form":"box","yaw":0,"offsetX":0,"offsetZ":0,"pitch":0,"roll":0}],"hatches":[],"fits":[],"armor":{"hull":0,"cit":0},"nextId":3,"systemsVersion":1,"airWings":[],"groundForces":[],"surfaces":{"version":4,"mode":"strict","compatAllowed":true,"patches":[{"id":"p1:port:0:cctl1g","armor":{"material":"standard","thickness":0},"equipment":{"kind":"hdis","count":0,"depth":1},"battery":{"weapon":"stl","count":1,"spacing":1,"angle":0,"reversed":false},"style":{"kind":"standard","depth":0,"density":0.25,"seed":1},"powerDomain":"main","authored":true,"functionMode":"legacy","allocation":{"cooling":33.333333333333336,"sensors":33.333333333333336,"habitation":33.33333333333333},"aggregate":{"version":1,"signature":"1aapvn","cells":[],"guns":[[2,"stl",72.57559774348495,18.203407739909775,-100,5,0,0,-1,72.57559774348495,18.203407739909775,-100,35.406972073290014,35.40681547981955,5.583703951538677,0,0,0,0,1,"b0"]],"errors":[],"requested":1,"requestedEquipment":0,"demand":{"weapons":{"requested":0,"budgetArea":0},"cooling":{"requested":0,"budgetArea":0},"sensors":{"requested":0,"budgetArea":0},"habitation":{"requested":0,"budgetArea":0}}},"boundArea":30000,"layout":{"u":1,"v":1}},{"id":"p1:fore:0:cctl1g","armor":{"material":"standard","thickness":0},"equipment":{"kind":"none","count":0,"depth":1},"battery":{"weapon":"none","count":0,"spacing":2,"angle":0,"reversed":false},"style":{"kind":"standard","depth":0,"density":0.25,"seed":1},"powerDomain":"main","authored":false,"functionMode":"armor","allocation":{"cooling":33.333333333333336,"sensors":33.333333333333336,"habitation":33.33333333333333},"aggregate":{"version":1,"signature":"1aapvn","cells":[],"guns":[],"errors":[],"requested":0,"requestedEquipment":0,"demand":{"weapons":{"requested":0,"budgetArea":0},"cooling":{"requested":0,"budgetArea":0},"sensors":{"requested":0,"budgetArea":0},"habitation":{"requested":0,"budgetArea":0}}},"boundArea":20000,"layout":{"u":1,"v":1}},{"id":"p1:stbd:0:cctl1g","armor":{"material":"standard","thickness":0},"equipment":{"kind":"none","count":0,"depth":1},"battery":{"weapon":"none","count":0,"spacing":2,"angle":0,"reversed":false},"style":{"kind":"standard","depth":0,"density":0.25,"seed":1},"powerDomain":"main","authored":false,"functionMode":"armor","allocation":{"cooling":33.333333333333336,"sensors":33.333333333333336,"habitation":33.33333333333333},"aggregate":{"version":1,"signature":"1aapvn","cells":[],"guns":[],"errors":[],"requested":0,"requestedEquipment":0,"demand":{"weapons":{"requested":0,"budgetArea":0},"cooling":{"requested":0,"budgetArea":0},"sensors":{"requested":0,"budgetArea":0},"habitation":{"requested":0,"budgetArea":0}}},"boundArea":30000,"layout":{"u":1,"v":1}},{"id":"p1:aft:0:cctl1g","armor":{"material":"standard","thickness":0},"equipment":{"kind":"none","count":0,"depth":1},"battery":{"weapon":"none","count":0,"spacing":2,"angle":0,"reversed":false},"style":{"kind":"standard","depth":0,"density":0.25,"seed":1},"powerDomain":"main","authored":false,"functionMode":"armor","allocation":{"cooling":33.333333333333336,"sensors":33.333333333333336,"habitation":33.33333333333333},"aggregate":{"version":1,"signature":"1aapvn","cells":[],"guns":[],"errors":[],"requested":0,"requestedEquipment":0,"demand":{"weapons":{"requested":0,"budgetArea":0},"cooling":{"requested":0,"budgetArea":0},"sensors":{"requested":0,"budgetArea":0},"habitation":{"requested":0,"budgetArea":0}}},"boundArea":20000,"layout":{"u":1,"v":1}},{"id":"p1:bottom:0:cctl1g","armor":{"material":"standard","thickness":0},"equipment":{"kind":"none","count":0,"depth":1},"battery":{"weapon":"none","count":0,"spacing":2,"angle":0,"reversed":false},"style":{"kind":"standard","depth":0,"density":0.25,"seed":1},"powerDomain":"main","authored":false,"functionMode":"armor","allocation":{"cooling":33.333333333333336,"sensors":33.333333333333336,"habitation":33.33333333333333},"aggregate":{"version":1,"signature":"1aapvn","cells":[],"guns":[],"errors":[],"requested":0,"requestedEquipment":0,"demand":{"weapons":{"requested":0,"budgetArea":0},"cooling":{"requested":0,"budgetArea":0},"sensors":{"requested":0,"budgetArea":0},"habitation":{"requested":0,"budgetArea":0}}},"boundArea":60000,"layout":{"u":1,"v":1}},{"id":"p1:top:0:cctl1g","armor":{"material":"standard","thickness":0},"equipment":{"kind":"none","count":0,"depth":1},"battery":{"weapon":"none","count":0,"spacing":2,"angle":0,"reversed":false},"style":{"kind":"standard","depth":0,"density":0.25,"seed":1},"powerDomain":"main","authored":false,"functionMode":"armor","allocation":{"cooling":33.333333333333336,"sensors":33.333333333333336,"habitation":33.33333333333333},"aggregate":{"version":1,"signature":"1aapvn","cells":[],"guns":[],"errors":[],"requested":0,"requestedEquipment":0,"demand":{"weapons":{"requested":0,"budgetArea":0},"cooling":{"requested":0,"budgetArea":0},"sensors":{"requested":0,"budgetArea":0},"habitation":{"requested":0,"budgetArea":0}}},"boundArea":60000,"layout":{"u":1,"v":1}}],"legacyArmor":0},"autoHabitation":true,"hullLocked":false}};

test('saved profile9 surface guns recompile their old physical footprint once under the new model catalog',()=>{
 const old=LEGACY_CAPITAL_SURFACE,record=old.state.surfaces.patches.find(q=>q.id===old.patchId),row=record.aggregate.guns[0];
 assert.equal(old.profileVersion,9);vector(row.slice(12,14),[35.406972073290014,35.40681547981955],1e-8);
 const loaded=C.deserialize(plain(old.state)),derived=C.surfaceDerivedFits(loaded);assert.equal(derived.length,1);assert.equal(derived[0].id,row[0]);assert.equal(derived[0].k,'stl');vector(derived[0].surfaceFootprint,[60,45],1e-8);
 assert.notEqual(C.surfaceConfig(loaded,old.patchId).aggregate.signature,record.aggregate.signature);
 const once=plain(C.serialize(loaded)),again=C.deserialize(plain(once));C.surfaceSync(again);assert.deepEqual(plain(C.serialize(again)),once,'current compiled inventory must stay stable on the next load');
});

const BALLS=['quad40Ion','single500','ball175TripleIon','ball175Quad','ball175QuadIon','ball720'];
test('ball placement pitch rotates the complete spherical body about its fixed center before yaw on every mount frame',()=>{
 for(const k of BALLS){assert.equal(C.isBallTurret(k),true);const a=C.REFERENCE_ASSETS[C.FITS[k].asset],nativeCenter=a.sphereCenterM,mesh=C.decodeReference(C.FITS[k].asset);
  for(const frame of [...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.93,.3])}])for(const degrees of [-90,-35,30,90]){
   const f=fit(k,{...frame,assetYaw:31,assetPitch:degrees}),fr=C.fitFrameOf(f),g=C.authoredTurretGeometry(f),pitch=degrees*Math.PI/180,yaw=31*Math.PI/180;
   const fw=C.add(C.mul(fr.fw,Math.cos(yaw)),C.mul(fr.rt,Math.sin(yaw))),rt=C.add(C.mul(fr.rt,Math.cos(yaw)),C.mul(fr.fw,-Math.sin(yaw))),forward=C.add(C.mul(fw,Math.cos(pitch)),C.mul(fr.up,Math.sin(pitch))),up=C.add(C.mul(fr.up,Math.cos(pitch)),C.mul(fw,-Math.sin(pitch)));
   near(C.ballTurretPitch(f),degrees);vector(C.fitUp(f),fr.up,1e-8);vector(g.axis,fr.up,1e-8);vector(g.fw,forward,1e-8);
   const center=C.referenceFitPoint(f,nativeCenter.map((v,i)=>(v-a.c[i])/a.size[i])),unpitched=C.referenceFitPoint({...f,assetPitch:0},nativeCenter.map((v,i)=>(v-a.c[i])/a.size[i]));vector(center,unpitched,1e-8);vector(g.elevationPivot,center,1e-8);
   a.muzzlePoints.forEach((p,i)=>{const d=C.sub(p,nativeCenter),want=C.add(center,C.add(C.add(C.mul(forward,d[0]),C.mul(up,d[1])),C.mul(rt,d[2])));vector(g.muzzles[i],want,1e-6);near(C.len(C.sub(g.muzzles[i],center)),C.len(d),1e-6);});
   const requested=C.aimAuthoredTurret(g,.19,.28).fw,aimed=C.aimAuthoredTurretAt(g,requested);vector(aimed.fw,requested,1e-7);vector(aimed.elevationPivot,center,1e-7);vector(g.yawPivot,center,1e-7);assert.equal(C.authoredTurretInArc(g,requested),true);assert.equal(C.authoredTurretInArc(g,C.mul(fr.up,degrees< -80?1:-1)),false,'the target beyond the absolute mechanical elevation remains blocked');
   const bounds=C.fitAABB(f);for(let i=0;i<mesh.pos.length;i+=3){const p=C.referenceFitPoint(f,Array.from(mesh.pos.subarray(i,i+3)));assert.ok(p.every((v,j)=>v>=bounds[j]-1e-5&&v<=bounds[j+3]+1e-5),k+' complete posed body remains selectable');}
  }
 }
 for(const k of ['stl','quad175','utl','refVen','pd']){assert.equal(C.isBallTurret(k),false);assert.equal(C.ballTurretPitch(fit(k,{assetPitch:35})),0);}
});

test('placed ball pitch survives mirrored copies, save/load and reusable parent templates while unsupported pitch is cleared',()=>{
 const {s}=deck('ball720');s.fits=[];const placed=C.placeFit(s,'ball720',[500,0,150],[0,1,0],0,true,{assetYaw:29,assetPitch:37});assert.ok(placed.fit,placed.err);assert.equal(s.fits.length,2);const first=placed.fit,other=C.twinOf(s,first,s.fits);assert.ok(other);near(first.assetPitch,37);near(other.assetPitch,37);near(other.assetYaw,-29);
 const a=C.authoredTurretGeometry(first),b=C.authoredTurretGeometry(other);a.muzzles.forEach(p=>assert.ok(b.muzzles.some(q=>C.len(C.sub(q,[p[0],p[1],-p[2]]))<1e-6),'mirrored posed muzzles match the reflected physical gun'));
 const loaded=C.deserialize(C.serialize(s));assert.equal(loaded.fits.length,2);for(const f of loaded.fits){const old=s.fits.find(q=>q.id===f.id);near(f.assetPitch,37);near(f.assetYaw,old.assetYaw);vector(C.fitUp(f),[0,1,0],1e-8);vector(C.authoredTurretGeometry(f).muzzles[0],C.authoredTurretGeometry(old).muzzles[0],1e-7);}
 const captured=C.assemblyCapture(s,{parts:[],fits:[first.id]},{name:'Pitched ball parent',origin:'center'});assert.ok(captured.template);const template=C.normalizeAssemblyTemplate(plain(captured.template));near(template.fits[0].assetPitch,37);
 const dest=C.newShip({assembly:true,L:1200,W:900,H:200},'Template pitch');dest.parts=[];dest.fits=[];const made=C.assemblyPlace(dest,template,[600,100,160],{mirror:true});assert.ok(!made.error,made.error);assert.equal(made.fits.length,2);for(const f of made.fits)near(C.ballTurretPitch(f),37);
 const ordinary=C.assemblyMirrorFit(first);near(ordinary.assetPitch,37);near(ordinary.assetYaw,-first.assetYaw);
 for(const [value,expected]of [[160,90],[-160,-90],[NaN,0],[Infinity,0]]){const f=fit('ball720',{assetPitch:value});C.normalizeFitMount(f);near(C.ballTurretPitch(f),expected);assert.equal(f.assetPitch,expected||undefined);}
 const invalid=C.serialize(s);invalid.fits[0].assetPitch=120;invalid.fits[1].k='stl';invalid.fits[1].assetPitch=40;const clean=C.deserialize(invalid);near(clean.fits[0].assetPitch,90);assert.equal(clean.fits[1].assetPitch,undefined);
 const surface=fit('ball720',{assetPitch:40,surfacePatch:'p1:top:0:test'});assert.equal(C.ballTurretPitch(surface),0);C.normalizeFitMount(surface);assert.equal(surface.assetPitch,undefined,'compiled ports do not acquire a second exterior turret-pitch pose');
});

test('changing ball pitch invalidates real gunhouse and charging caches without tilting its internal charging equipment',()=>{
 const {s,f}=deck('ball720');f.chargeSalvos=3;const first=C.turretCompartmentProjection(s,f),capacitors=C.weaponCapacitors(s);assert.equal(capacitors.length,1);const center=capacitors[0].c.slice();C.allOccupied(s);const firstRooms=s._turretRooms,firstCap=s._capacitors;
 f.assetPitch=43;const next=C.turretCompartmentProjection(s,f),nextCapacitors=C.weaponCapacitors(s);C.allOccupied(s);assert.notEqual(next,first,'a posed gunhouse cannot reuse the old transformed solids');assert.notDeepEqual(next.triangles,first.triangles);near(next.housingVolume,first.housingVolume,.01);assert.notEqual(s._turretRooms.key,firstRooms.key);assert.notEqual(s._capacitors.key,firstCap.key);assert.notEqual(nextCapacitors,capacitors);vector(nextCapacitors[0].c,center,1e-6);vector(nextCapacitors[0].boxFrame.up,[0,1,0],1e-8);assert.ok(nextCapacitors[0].c[1]<f.p[1],'charging plant stays behind the unchanged mounting face');
});

test('pitched native ball guns carry their physical joint, energy, electrical demand and heat owner into the fleet profile',()=>{
 const s=C.newShip({assembly:true,L:200,W:200,H:100},'Pitched sphere runtime profile');s.parts=[];s.fits=[];
 C.placePart(s,'struct',[100,-50,0],[180,180,100],{form:'box'},false);const f=fit('ball720',{id:s.nextId++,p:[100,0,0],assetYaw:33,assetPitch:42});s.fits=[f];C.placePart(s,'gen',[45,-45,0],60,{},false);assert.ok(C.enableSurfaceMode(s,true).ok);
 const S=C.computeStats(s),p=C.fleetProfile(S,s.name,s),m=p.surface.mounts.find(m=>m.id===f.id),g=C.authoredTurretGeometry(f);assert.ok(m?.authored);assert.equal(m.patch,null,'the posed ball remains a normal exterior fitting');
 near(S.alphaTot,720);near(p.wCap,720);near(m.gun,720);near(m.ion,0);near(m.capacity,720);near(m.boltTT,720);near(m.power,720*C.TT/C.ENERGY_MODEL.eta,1e9);near(p.grid.Dw,m.power,1e9);vector(m.normal,[0,1,0],1e-8);vector(m.dir,g.fw,1e-8);vector(m.authored.axis,[0,1,0],1e-8);near(m.authored.restElevation,42*Math.PI/180);
 g.muzzles.forEach((q,i)=>vector(C.add(m.authored.muzzles[i],p.surface.offset),q,1e-6));const direction=C.aimAuthoredTurret(g,.27,.3).fw;vector(C.aimAuthoredTurretAt(m.authored,direction).fw,direction,1e-7);
 const cleaned=C.cleanCraftPowerProfile(plain(p),C.serialize(s));assert.ok(cleaned?.surface);const restored=cleaned.surface.mounts.find(q=>q.id===f.id);near(restored.authored.restElevation,m.authored.restElevation);vector(restored.authored.yawForward,m.authored.yawForward,1e-8);vector(C.aimAuthoredTurretAt(restored.authored,direction).fw,direction,1e-7);
 const source=S.heat.net.src.find(q=>q.fit===f.id),runtime=p.heat.src.find(q=>q.k==='weapon'&&q.m.includes(m.module));assert.ok(source&&runtime);near(source.powerWeight,720*C.TT,1e9);assert.ok(source.rated.combat>0&&source.rated.combat<m.power,'actual heat follows the supplied electrical branch');
 const overPole=C.authoredTurretGeometry({...f,assetPitch:30}),equivalent=C.aimAuthoredTurret(overPole,.2,88*Math.PI/180).fw;assert.equal(C.authoredTurretInArc(overPole,equivalent),true,'an unlimited-yaw ball can use the equivalent mechanical pose across the vertical pole');vector(C.aimAuthoredTurretAt(overPole,equivalent).fw,equivalent,1e-7);
});
