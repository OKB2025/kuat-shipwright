const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),cx=vm.createContext({console,performance:{now:()=>1000}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const run=code=>vm.runInContext(code,cx),{C,G}=run('({C:Core,G:Gfx})'),plain=v=>JSON.parse(JSON.stringify(v)),I=[1,0,0,0,1,0,0,0,1],VP=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const near=(a,b,eps=1e-6)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<eps,`${i}: ${v} != ${b[i]}`)),apply=(R,v)=>[R[0]*v[0]+R[3]*v[1]+R[6]*v[2],R[1]*v[0]+R[4]*v[1]+R[7]*v[2],R[2]*v[0]+R[5]*v[1]+R[8]*v[2]];
function section(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return app.slice(a,b);}
run(`const C=Core,trial={P:[100,200,300],R:[0,0,1,0,1,0,-1,0,0],asset:{geometry:{center:[25,10,0]}},battle:{E:[1,0,0,0,1,0,0,0,1]},rays:{busy:false,last:0}},fleet={assets:new Map()},tv={add:(a,b,k=1)=>a.map((v,i)=>v+b[i]*k),sub:C.sub,scale:C.mul,cross:C.cross,len:C.len,norm:C.norm,dot:C.dot};
 const spaceRotU=(e,u)=>u.rot||e,spaceWorld=u=>u.pos,spaceHullPoint=()=>[-999,-999,-999],unitFoilDeployments=u=>u.deployments,trialFoilDeployments=()=>({});
 let requested;const YardEngineClient={request:async(type,payload)=>(requested={type,payload},{clear:payload.ids.map(()=>1)})};`);
for(const line of app.split('\n'))if(line.startsWith('const spaceAtt=new WeakMap(),m3Mul='))run(line);
run(section('function trialRot(','const trialWrap='));
run(section('function authoredTurretPose(','const trialLimits='));
run(section('const trialLimits=','function trialAim()'));
run(section('function trialShotGeometry(','function trialGunnery('));
run(section('function trialRays(','function trialRenderSets('));
run(section('function spaceSurfaceTurretPose(','function spaceShots('));
function fixture(kind='quad500',frame={a:2}){
 const f={id:7,k:kind,p:[50,40,15],a:2,base:0,ped:0,low:0,float:false,assetYaw:31,...frame},ship=C.newShip({assembly:true,L:150,W:100,H:60},'Authored turret motion');ship.parts=[];ship.fits=[f];ship.detail=0;
 const geometry=G.fleetGeometry(ship,{trial:true}),t=geometry.turrets.find(q=>q.id===7);assert.ok(t?.authored,kind+' must have a split authored turret');assert.ok(t.bodyMesh);return {f,ship,geometry,t};
}
function triangles(g){const out=[];for(let i=0;i<g.ni;i+=3)out.push(Array.from(g.idx.slice(i,i+3)).flatMap(k=>[...g.pos.slice(k*3,k*3+3),...g.nor.slice(k*3,k*3+3)]).join(','));return out.sort();}

test('both authored turrets partition their actual housing and moving barrels without losing triangles',()=>{
 const palette=vm.createContext({C,ship:C.newShip({L:100,W:50,H:40})});vm.runInContext(section('const PART_KEYS =','const partOffered ='),palette);assert.equal(vm.runInContext("weaponKeys().filter(k=>k==='twin40').length",palette),1,'the new twin is available from the ordinary weapon palette');
 for(const kind of ['quad500','twin40']){const {f,ship,geometry,t}=fixture(kind),a=C.REFERENCE_ASSETS[C.FITS[kind].asset],body=geometry.meshes[t.bodyMesh].geo,barrels=geometry.meshes[t.mesh].geo;
  assert.equal(body.ni,t.authored.indexStart);assert.equal(body.ni+barrels.ni,a.faces*3);assert.deepEqual([...triangles(body),...triangles(barrels)].sort(),[G.meshFits(ship),G.meshReferenceFits(ship)].flatMap(triangles).sort());
  near(t.pivot,t.authored.elevationPivot);near(t.bodyPivot,C.fitOrigin(f));assert.ok(C.dot(C.sub(t.pivot,t.bodyPivot),C.fitUp(f))>0,'barrels use the elevated trunnion rather than the turntable floor');
 }
});

test('manual yaw and elevation move only barrels around the elevated trunnion in all mounting frames',()=>{
 for(const kind of ['quad500','twin40'])for(const frame of [...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.93,.3])}]){
  const {t}=fixture(kind,frame);cx.turret=t;run('turret.yaw=.7;turret.el=.5;trialPoseTurret(turret)');const posed=plain(run('turret')),expected=C.aimAuthoredTurret(t.authored,.7,.5);assert.equal(run('trialLimits(turret).lo'),C.AUTHORED_TURRET_LIMITS.lo);assert.equal(run('trialLimits(turret).hi'),C.AUTHORED_TURRET_LIMITS.hi);
  near(posed.pivot,expected.elevationPivot);near(posed.bodyPivot,expected.yawPivot);near(apply(posed.bodyRot,t.axis),t.axis);near(apply(posed.rot,t.fw),expected.fw);
  assert.ok(C.dot(expected.fw,t.axis)>.45,'positive elevation raises barrels away from the mounting plane');
  near(plain(run('trialBarrel(turret,.7,.5)')),expected.fw);const parts=plain(run('trialTurretDrawParts(turret)'));assert.equal(parts.length,2);near(parts[0].restPivot,t.authored.yawPivot);near(parts[1].restPivot,t.authored.elevationPivot);
 }
});

test('manual projectiles originate at every physical posed muzzle, including both vertical quad rows',()=>{
 for(const kind of ['quad500','twin40']){const {t}=fixture(kind);cx.turret=t;run('turret.yaw=-.4;turret.el=.6;trialPoseTurret(turret)');const shot=plain(run('trialShotGeometry(turret,[1,0,0])')),p=C.aimAuthoredTurret(t.authored,-.4,.6);
  assert.equal(shot.muzzles.length,C.FITS[kind].barrels);p.muzzles.forEach((m,i)=>near(shot.muzzles[i],C.add([100,200,300],apply([0,0,1,0,1,0,-1,0,0],C.sub(m,[25,10,0])))));
  assert.equal(shot.spread,0);assert.equal(new Set(shot.muzzles.map(p=>p.join(','))).size,C.FITS[kind].barrels);
 }
});

test('a moving S-foil carries the elevated hinge, housing and all muzzle mouths as one mount',()=>{
 const {t}=fixture('twin40');cx.turret=t;run("globalThis.hinge=Gfx.foilTransform({pivot:[20,10,-3],axis:'x',open:0,stow:70,sg:1},.4);turret._foilTransform=hinge;turret.yaw=.3;turret.el=.6;trialPoseTurret(turret)");
 const pose=plain(run('turret.authoredPose')),p=C.aimAuthoredTurret(t.authored,.3,.6),X=run('hinge');near(pose.yawPivot,X.point(p.yawPivot));near(pose.elevationPivot,X.point(p.elevationPivot));p.muzzles.forEach((m,i)=>near(pose.muzzles[i],X.point(m)));near(pose.fw,X.direction(p.fw));
 delete t._foilTransform;
});

test('the worker request receives all exact posed mouths and the same rendered barrel direction',async()=>{
 const {t}=fixture();cx.turret=t;run('turret.yaw=.3;turret.el=.4;trial.turrets=[turret];trialRays(1000)');await new Promise(resolve=>setImmediate(resolve));
 const r=plain(run('requested')),p=C.aimAuthoredTurret(t.authored,.3,.4);assert.equal(r.type,'trialRays');assert.equal(r.payload.muzzles[0].length,4);p.muzzles.forEach((m,i)=>near(r.payload.muzzles[0][i],m));near(r.payload.dirs,p.fw,1e-7);assert.equal(run('turret.clear'),true);
});

test('fleet streams and both render parts use the same exact elevated muzzle pose',()=>{
 for(const kind of ['quad500','twin40']){const {t,geometry}=fixture(kind);cx.rest=t;cx.geometry=geometry;
  run(`trial.surfaceTurretPoses=new Map();globalThis.mount={id:7,module:0,cell:'native',fixed:false,barrelLength:999};globalThis.source={id:'source',key:'native',pos:[1000,500,20],rot:[1,0,0,0,1,0,0,0,1],p:{modules:[{k:'weapon'}],surface:{mounts:[mount]}},mods:[1],surfaceLastFire:{cells:[{fit:7,energy:1,gun:1}]}};globalThis.target={pos:[2000,1500,1200]};fleet.assets.set('native',{geometry});`);
  const pose=plain(run('spaceSurfaceTurretPose(source,target,rest,mount,{geometry})')),parts=plain(run('spaceSurfaceTurrets(source,target)'));assert.equal(parts.length,2);near(parts[0].rot,pose.bodyRot);near(parts[1].rot,pose.rot);
  for(let i=0;i<C.FITS[kind].barrels;i++){const emitter=plain(run(`spaceShotEmitter(source,target,${i})`));near(emitter.pos,C.add([1000,500,20],C.sub(pose.muzzles[i],geometry.center)));near(emitter.dir,pose.fw);}
  run('target.pos=tv.add(tv.add(source.pos,tv.sub(rest.authored.elevationPivot,geometry.center)),rest.authored.axis,1000)');assert.equal(run('spaceSurfaceTurretPose(source,target,rest,mount,{geometry}).angles[1]'),C.AUTHORED_TURRET_LIMITS.hi,'a target above the mechanical stop uses the same elevation limit as manual fire');
 }
});

test('the profile’s authored mouths remain exact before a rendered fleet asset is available',()=>{
 const {t}=fixture('twin40');cx.nativeGeometry=t.authored;
 run(`globalThis.mountFallback={id:7,module:0,cell:'native',fixed:false,center:nativeGeometry.elevationPivot,pivot:nativeGeometry.elevationPivot,authored:nativeGeometry,barrelLength:999};globalThis.fallbackSource={id:'fallback',key:'unloaded',pos:[1000,500,20],p:{modules:[{k:'weapon'}],surface:{offset:[0,0,0],mounts:[mountFallback]}},mods:[1],surfaceLastFire:{cells:[{fit:7,energy:1,gun:1}]}};globalThis.fallbackTarget={pos:[2000,1500,1200]};`);
 const direction=C.norm(C.sub([2000,1500,1200],C.add([1000,500,20],t.authored.elevationPivot))),[yaw,elevation]=C.authoredTurretAngles(t.authored,direction),expected=C.aimAuthoredTurret(t.authored,yaw,C.clamp(elevation,C.AUTHORED_TURRET_LIMITS.lo,C.AUTHORED_TURRET_LIMITS.hi));
 for(let i=0;i<2;i++){const e=plain(run(`spaceShotEmitter(fallbackSource,fallbackTarget,${i})`));near(e.pos,C.add([1000,500,20],expected.muzzles[i]));near(e.dir,expected.fw);}
});

function canvas(){return {width:32,height:32,clientWidth:32,clientHeight:32,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}})};}
test('WebGL and software render translated barrel pivots with a distinct yaw-only housing',()=>{
 const {t,geometry}=fixture('twin40');cx.turret=t;run('turret.yaw=.5;turret.el=.7;trialPoseTurret(turret)');const parts=plain(run('trialTurretDrawParts(turret)')),unit={key:'native',pos:[20,30,40],rot:I,turrets:parts},calls=[],r=Object.create(G.Renderer.prototype);
 Object.assign(r,{canvas:canvas(),gl:new Proxy({},{get:()=>()=>{}}),off:[0,0,0],meshes:{},cam:{target:[0,0,0],fov:.72},look:{shadow:false},eye:()=>[0,0,100],upload(name,geo){this.meshes[name]={count:geo.ni,geo};},drawMesh(name){if(name===t.mesh||name===t.bodyMesh)calls.push({name,off:[...this.off],center:[...this.modelCenter],rot:[...this.modelRot]});},setLights(){},drawRays(){},drawLines(){},drawPoints(){},setPoints(){}});
 r.loadFleet('native',geometry);r.drawFleet({VP,eye:r.eye()},{fleet:[unit]});
 const c=new G.CompatRenderer(canvas()),soft=[];c.matrices=()=>({VP});c.paintLines=()=>{};c.loadFleet('native',geometry);c.rasterMesh=(geo,name,alpha,clip,pose)=>{if(geo===geometry.meshes[t.mesh].geo||geo===geometry.meshes[t.bodyMesh].geo)soft.push(pose);};c.draw({fleet:[unit]});
 assert.equal(calls.length,2);assert.equal(soft.length,2);parts.forEach((part,i)=>{const call=calls.find(q=>q.name===part.mesh),expected=C.add(unit.pos,C.sub(part.pivot,geometry.center));near(call.center,part.restPivot);near(call.off,expected);near(soft[i].center,part.restPivot);near(soft[i].off,expected);near(call.rot,part.rot);near(soft[i].rot,part.rot);});
});

test('the side-mounted quad keeps its case fixed while its mantlet follows the shared mechanical limits',()=>{
 const {t}=fixture('quad70Side',{a:4,assetYaw:0});assert.equal(t.authored.housingFixed,true);cx.turret=t;run('turret.yaw=.3;turret.el=.2;trialPoseTurret(turret)');
 const posed=plain(run('turret.authoredPose')),parts=plain(run('trialTurretDrawParts(turret)')),limits=plain(run('trialLimits(turret)'));near(parts[0].rot,I);near(parts[0].pivot,parts[0].restPivot);assert.notDeepEqual(parts[1].rot,I);near(posed.fw,apply(parts[1].rot,t.authored.fw));
 assert.equal(limits.yaw,t.authored.limits.yaw);assert.equal(limits.lo,t.authored.limits.lo);assert.equal(limits.hi,t.authored.limits.hi);assert.ok(Math.abs(limits.yaw-65*Math.PI/180)<1e-9);assert.ok(Math.abs(limits.hi-20*Math.PI/180)<1e-9);
 run("turret._foilTransform=Gfx.foilTransform({pivot:[20,10,-3],axis:'x',open:0,stow:70,sg:1},.4);trialPoseTurret(turret)");near(plain(run('turret.bodyRot')),plain(run('turret._foilTransform.rot')));
});

test('the complete ion sphere and four barrels share one moving group with the lower third below the mount',()=>{
 const {f,t,geometry}=fixture('quad40Ion'),a=C.REFERENCE_ASSETS[C.FITS.quad40Ion.asset],decoded=C.decodeReference(C.FITS.quad40Ion.asset),range=a.sphereMeshRange,moving=geometry.meshes[t.mesh].geo,body=geometry.meshes[t.bodyMesh].geo;
 assert.equal(t.authored.indexStart,0);assert.equal(body.ni,0,'the whole ball must not be replaced with a static case or artificial neck');assert.equal(moving.ni,a.faces*3);assert.equal(t.ion,true);assert.equal(t.barrels,4);assert.ok(range?.vertices>0);
 const sphere=Array.from({length:range.vertices},(_,i)=>{const k=range.firstVertex+i;return {source:Array.from(decoded.pos.slice(k*3,k*3+3)),local:[0,1,2].map(axis=>decoded.pos[k*3+axis]*a.size[axis]+a.c[axis])};}),bottom=Math.min(...sphere.map(q=>q.local[1])),top=Math.max(...sphere.map(q=>q.local[1])),mount=a.mount[1];
 assert.ok(Math.abs((mount-bottom)/(top-bottom)-1/3)<.0002,'one third of the actual sphere diameter lies below the mounting plane');near(a.elevationPivot,a.sphereCenterM);assert.ok(Math.abs(top-bottom-2*a.sphereRadiusM)<.002);
 const crown=sphere.reduce((best,q)=>q.local[1]>best.local[1]?q:best),rest=C.referenceFitPoint(f,crown.source);assert.ok(Array.from({length:moving.n},(_,i)=>C.len(C.sub(Array.from(moving.pos.slice(i*3,i*3+3)),rest))).some(d=>d<.002),'the actual sphere crown belongs to the moving renderer mesh');
 cx.turret=t;run('turret.yaw=.4;turret.el=.35;trialPoseTurret(turret)');const posed=plain(run('turret.authoredPose')),draw=plain(run('trialTurretDrawParts(turret)')).find(q=>q.mesh===t.mesh),crownPos=C.add(draw.pivot,apply(draw.rot,C.sub(rest,draw.restPivot)));
 assert.ok(C.len(C.sub(crownPos,rest))>a.sphereRadiusM*.1,'the visible sphere must elevate with its barrels');t.authored.muzzles.forEach((m,i)=>assert.ok(Math.abs(C.len(C.sub(m,rest))-C.len(C.sub(posed.muzzles[i],crownPos)))<.002,'sphere-to-muzzle distances remain rigid'));
 assert.equal(plain(run('trialShotGeometry(turret,[1,0,0])')).muzzles.length,4);
});
