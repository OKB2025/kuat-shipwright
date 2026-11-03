const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const C=vm.runInContext('Core',cx),plain=x=>JSON.parse(JSON.stringify(x)),near=(a,b)=>assert.ok(C.len(C.sub(a,b))<1e-6,JSON.stringify({a,b}));
function fixture(weapon='pd',face='port',armor=0){const ship=C.newShip({L:160,W:100,H:80,assembly:true},'Embedded battery');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};const body=C.placePart(ship,'struct',[70,30,0],[112,48,32],{form:'box'},false),patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face===face);assert.ok(patch?.exposed);assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'legacy',armor:{thickness:armor},battery:{weapon,count:1,spacing:1}}).ok,true);assert.equal(ship.fits.length,0);assert.equal(C.surfaceDerivedFits(ship).length,1);return {ship,body,patch,fit:C.surfaceDerivedFits(ship)[0]};}

test('embedded design rays start at the actual flush mouth and do not skip a nearby thin obstruction',()=>{
 const {ship,fit}=fixture(),g=C.surfaceBatteryGeometry(fit);assert.ok(C.turretClear(ship,fit,g.dir,C.turretRayContext(ship)));assert.equal(C.turretClear(ship,fit,C.mul(g.dir,-1),C.turretRayContext(ship)),false);near(C.turretOrigin(fit),g.mouth);
 ship.parts.push({id:ship.nextId++,k:'struct',form:'box',c:C.add(g.mouth,C.mul(g.normal,.02)),s:[2,2,.02],surfaceNormal:g.normal.slice()});
 assert.equal(C.turretClear(ship,fit,g.dir,C.turretRayContext(ship)),false,'a blocker 1cm beyond the mouth cannot be skipped using the old turret radius');
 const roof=fixture('casemateLight','top'),up=C.surfaceBatteryGeometry(roof.fit);assert.ok(C.turretClear(roof.ship,roof.fit,up.normal,C.turretRayContext(roof.ship)),'an embedded roof battery is not rejected by the old wall-only global-Y casemate cone');
});

test('embedded fleet rays also detect an obstruction closer than the old presentation offset',()=>{
 const mount={id:1,module:0,patch:'test',center:[0,0,0],muzzle:[0,0,0],pivot:[0,0,0],normal:[0,0,-1],dir:[0,0,-1],embedded:true,fixed:false,barrelLength:0,arcs:[1,1,1,1,1,1],gun:10,ion:0,capacity:100,power:10*C.TT,barrels:1,boltTT:1,crewNeed:0,band:'long'},p={hp:100,len:20,width:20,height:20,grid:{P:100*C.TT,domains:[{id:'main',P:100*C.TT}]},modules:[{k:'weapon',domain:'main',powerConnected:true,size:1,share:1,hits:1,crew:0}],surface:{mounts:[mount],patches:[],shell:[]},wCap:100,gunArcs:[1,1,1,1,1,1],ionArcs:[0,0,0,0,0,0]},u={p,pos:[0,0,0],yaw:0,mods:[1],energy:100,crew:0},target={p:{hp:100,len:20,width:20,height:20},pos:[0,0,-1000],yaw:0};assert.ok(C.surfaceFleetFire(u,target,1000).gun>0);
 p.surface.shell=[-2,-2,-.01,2,-2,-.01,2,2,-.01,-2,-2,-.01,2,2,-.01,-2,2,-.01];assert.equal(C.surfaceFleetFire(u,target,1000).gun,0,'the common runtime ray starts within1mm of the mouth, not beyond a near wall');
});

test('embedding preserves weapon definitions and native fixed flags while tracking guns retain outward geometry',()=>{
 const definitions=JSON.stringify(['pd','claser','refVen'].map(k=>C.FITS[k]));for(const weapon of ['pd','claser']){const {ship,fit}=fixture(weapon,'top'),g=C.surfaceBatteryGeometry(fit),native={...fit};delete native.surfacePatch;assert.equal(C.surfaceBatteryGeometry(native),null);const before=C.publicJSON(ship),a=C.fitSpec(fit),b=C.fitSpec(native);assert.deepEqual(plain(a),plain(b));assert.equal(C.fitBuildCost(fit),C.fitBuildCost(native));assert.equal(C.needsCapacitor(fit),C.needsCapacitor(native));C.surfaceBatteryGeometry(fit);assert.equal(C.publicJSON(ship),before);
  const S=C.computeStats(ship),profile=C.fleetProfile(S,ship.name,ship),m=profile.surface.mounts.find(m=>m.id===fit.id);assert.ok(m.embedded);assert.equal(m.fixed,!!C.FITS[weapon].fixed);assert.equal(m.barrelLength,0);near(m.dir,g.normal);near(C.add(m.muzzle,profile.surface.offset),g.mouth);assert.deepEqual(plain(m.footprint),plain(fit.surfaceFootprint));assert.equal(m.barrels,C.FITS[weapon].barrels||1);
 }assert.equal(JSON.stringify(['pd','claser','refVen'].map(k=>C.FITS[k])),definitions);
});

test('native casemate limits follow the local port frame in design and runtime without limiting normal surface turrets',()=>{
 const {ship,fit}=fixture('casemateLight','top'),g=C.surfaceBatteryGeometry(fit),ray=(yaw,pitch)=>{const y=yaw*Math.PI/180,p=pitch*Math.PI/180;return C.add(C.mul(g.normal,Math.cos(y)*Math.cos(p)),C.add(C.mul(g.u,Math.sin(y)*Math.cos(p)),C.mul(g.v,Math.sin(p))));};
 assert.ok(C.turretClear(ship,fit,ray(30,10),C.turretRayContext(ship)));assert.equal(C.turretClear(ship,fit,ray(0,30),C.turretRayContext(ship)),false,'native case pitch remains20degrees relative to its own roof frame');assert.equal(C.turretClear(ship,fit,ray(70,0),C.turretRayContext(ship)),false);
 const normalGun={...fit,k:'pd'};assert.ok(C.turretClear(ship,normalGun,ray(0,30),C.turretRayContext(ship)),'a normal weapon placed in a wall is not assigned the native casemate balance cone');
 const mount={id:1,module:0,patch:'test',center:[0,0,0],muzzle:[0,0,0],normal:g.normal,dir:g.normal,u:g.u,v:g.v,embedded:true,casemate:true,fixed:false,arcs:[1,1,1,1,1,1],gun:10,ion:0,capacity:100,power:10*C.TT,barrels:1,boltTT:1,crewNeed:0,band:'long'},profile={hp:100,len:20,width:20,height:20,grid:{P:100*C.TT,domains:[{id:'main',P:100*C.TT}]},modules:[{k:'weapon',domain:'main',powerConnected:true,size:1,share:1,hits:1,crew:0}],surface:{mounts:[mount],patches:[],shell:[]},wCap:100,gunArcs:[1,1,1,1,1,1],ionArcs:[0,0,0,0,0,0]},unit={p:profile,pos:[0,0,0],yaw:0,mods:[1],energy:100,crew:0},target=dir=>({p:{hp:100,len:20,width:20,height:20},pos:C.mul(dir,1000),yaw:0});
 assert.ok(C.surfaceFleetFire(unit,target(ray(30,10)),1000).gun>0);assert.equal(C.surfaceFleetFire(unit,target(ray(0,30)),1000).gun,0);assert.equal(C.surfaceFleetFire(unit,target(ray(70,0)),1000).gun,0);mount.casemate=false;assert.ok(C.surfaceFleetFire(unit,target(ray(0,30)),1000).gun>0);
});

test('legacy armored ports retain their outer armor offset through mirrored templates and reload without duplicating capacity',()=>{
 const {ship,body,fit}=fixture('pd','port',8),g=C.surfaceBatteryGeometry(fit),S=C.computeStats(ship);assert.equal(fit.surfaceArmorOffset,8);assert.ok(Math.abs(C.dot(C.sub(g.point,g.wallPoint),g.normal)-8)<1e-6);assert.ok(Math.abs(C.dot(C.sub(g.mouth,g.wallPoint),g.normal)-8-g.lip)<1e-6);near(C.turretOrigin(fit),g.mouth);assert.deepEqual(plain(C.fitAABB(fit)),plain(g.bounds));
 const template=C.normalizeAssemblyTemplate(plain(C.assemblyCapture(ship,{parts:[body.id],fits:[]},{name:'Armored ports'}).template)),dest=C.newShip({L:600,W:400,H:200,assembly:true},'Port mirror');dest.parts=[];dest.fits=[];dest.armor={hull:0,cit:0};C.assemblyPlace(dest,template,[250,80,90],{mirror:true});C.surfaceSync(dest);assert.equal(C.surfaceDerivedFits(dest).length,2);for(const f of C.surfaceDerivedFits(dest)){const p=C.surfaceBatteryGeometry(f);assert.equal(f.surfaceArmorOffset,8);assert.ok(Math.abs(C.dot(C.sub(p.point,p.wallPoint),p.normal)-8)<1e-6);}
 const D=C.computeStats(dest);assert.ok(Math.abs(D.armorMass-2*S.armorMass)<1e-6);assert.equal(D.surface.totals.installed,2);const ids=plain(C.surfaceDerivedFits(dest).map(f=>f.id)),loaded=C.deserialize(C.serialize(dest));C.surfaceSync(loaded);C.surfaceSync(loaded);assert.deepEqual(plain(C.surfaceDerivedFits(loaded).map(f=>f.id)),ids);assert.equal(new Set(ids).size,2);for(const f of C.surfaceDerivedFits(loaded)){assert.equal(f.surfaceArmorOffset,8);near(C.turretOrigin(f),C.surfaceBatteryGeometry(f).mouth);}
});

test('generated port mouths and their saved surface points follow a posed S-foil exactly once',()=>{
 for(const axis of ['x','y','z'])for(const [weapon,armor] of [['pd',0],['refVen',8]]){
  const {ship,body,fit}=fixture(weapon,'port',armor);body.wing=C.normalizeWing({foil:true,axis,open:35,stow:-40,T:1,pivot:[62,18,-12],members:{parts:[],fits:[fit.id]}});
  const frame=C.foilFrame(ship,body),mouth=C.turretOrigin(fit),point=fit.surfacePoint.slice(),before=C.publicJSON(ship);
  for(const angle of [body.wing.open,7,body.wing.stow]){
   const copy=C.foilPose(ship,body,angle).fits.find(f=>f.id===fit.id);assert.ok(copy);assert.notEqual(copy,fit);assert.notEqual(copy.surfacePoint,fit.surfacePoint);
   near(copy.p,C.foilAt(frame,body,fit.p,angle));near(copy.surfacePoint,C.foilAt(frame,body,point,angle));near(C.turretOrigin(copy),C.foilAt(frame,body,mouth,angle));
   const repeat=C.foilPose(ship,body,angle).fits.find(f=>f.id===fit.id);near(C.turretOrigin(repeat),C.turretOrigin(copy));assert.equal(copy.surfaceArmorOffset,armor);
  }
  assert.equal(C.publicJSON(ship),before,'preview poses leave the authored surface position and weapon data unchanged');
 }
});
