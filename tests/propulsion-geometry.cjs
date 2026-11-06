const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v));
function near(a,b,message='coordinate',eps=.0002){assert.ok(Math.abs(a-b)<=eps,`${message}: ${a} != ${b}`);}
function vector(a,b,message){a.forEach((v,i)=>near(v,b[i],message+' ['+i+']'));}
function engine(overrides={}){return {id:1,k:'engine',c:[40,70,-20],dir:C.norm([-.72,.31,.44]),d:30,nozzleLength:12,bodyLength:42,bodyRadius:.45,propulsionModelVersion:C.PROPULSION_MODEL_VERSION,ratedInputW:1e16,driveProfileId:'standard',machineryGradeId:'standard',machineryLengthM:42,machineryRadiusM:13.5,machineryOffsetM:6,machineryFeedRadiusM:3,...overrides};}
function fixture(...parts){const ship=C.newShip({assembly:true,L:200,W:100,H:100},'Independent machinery geometry');ship.parts=parts;ship.fits=[];ship.detail=0;ship.armor={hull:0,cit:0};return ship;}
function sourceEngine(asset){const source=C.sourceEngine({skinAsset:asset}),style=asset.startsWith('ven_')?'exposed':'internal',p={...C.equipmentOptions(style==='exposed'?'exposedTurbine':'internalTurbine'),id:1,c:[40,70,-20],dir:C.norm([-.72,.31,.44]),d:source.d,skinAsset:asset,skinAnchor:source.anchor.slice(),skinDiameter:source.d};C.resizeEngine(p,source.d,C.engineBaseline(style,source.d,'length'));return Object.assign(p,{propulsionModelVersion:C.PROPULSION_MODEL_VERSION,ratedInputW:1e16,driveProfileId:'standard',machineryGradeId:'standard',machineryLengthM:p.bodyLength,machineryRadiusM:p.d*p.bodyRadius,machineryOffsetM:p.nozzleLength/2,machineryFeedRadiusM:3});}
function geometry(g){return plain({pos:Array.from(g.pos.subarray(0,g.n*3)),nor:Array.from(g.nor.subarray(0,g.n*3)),uv:Array.from(g.uv.subarray(0,g.n*2)),col:Array.from(g.col.subarray(0,g.n*4)),idx:Array.from(g.idx.subarray(0,g.ni))});}
function rangeMesh(mesh,rows){const indices=rows.filter(([name])=>name===mesh.name).flatMap(([,start,count])=>Array.from(mesh.geo.idx.subarray(start,start+count)));return indices.map(k=>({p:Array.from(mesh.geo.pos.subarray(k*3,k*3+3)),n:Array.from(mesh.geo.nor.subarray(k*3,k*3+3),v=>v/127)}));}

test('actual machinery dimensions and ratings never deform the complete authored casing or bell root',()=>{
 for(const assetId of ['isdh_engine_main','isdh_engine_aux','ven_inner_port']){
  const p=sourceEngine(assetId),before=C.engineSkinMesh(p),decoded=C.decodeReference(assetId),ship=fixture(p),body=plain(C.engineMachineryPaths(ship)[0].machinerySegment),spec=C.resolveEngineSpec(p,ship);
  assert.equal(before.idx.length,decoded.idx.length,assetId+' retains every source face');assert.equal(before.pos.length,decoded.pos.length,assetId+' retains the source root vertices');
  p.machineryLengthM*=1.25;p.machineryRadiusM*=1.1;p.ratedInputW*=.8;const after=C.engineSkinMesh(p),edited=C.resolveEngineSpec(p,ship),physical=C.engineMachineryPaths(ship)[0].machinerySegment;
  assert.deepEqual(Array.from(after.pos),Array.from(before.pos),assetId+' casing is independent of actual machinery');assert.deepEqual(Array.from(after.idx),Array.from(before.idx));near(physical.l,body.l*1.25);near(physical.r1,body.r1*1.1);assert.ok(edited.effectiveMachineryVolumeM3>spec.effectiveMachineryVolumeM3);assert.equal(edited.ratedInputW,spec.ratedInputW*.8);
  p.d*=1.2;p.nozzleLength*=1.1;assert.notDeepEqual(Array.from(C.engineSkinMesh(p).pos),Array.from(before.pos),'authored nozzle sizing still changes its appearance');
 }
});

test('a source nozzle bound to one real machine preserves its complete visible root without duplicating the machine',()=>{
 for(const asset of ['isdh_engine_main','isdh_engine_aux']){
  const owner=sourceEngine(asset),p=sourceEngine(asset);p.id=3;p.c=[40,70,120];const complete=C.engineSkinMesh(p);p.machineryId=owner.id;const ship=fixture(owner,p),mesh=C.engineSkinMesh(p),decoded=C.decodeReference(asset),forward=C.mul(C.norm(p.dir),-1);
  assert.equal(C.engineMachineryPaths(ship).length,1,'one real owner occupies machinery once');assert.equal(mesh.idx.length,decoded.idx.length);assert.deepEqual(Array.from(mesh.pos),Array.from(complete.pos));let root=0;for(let i=0;i<mesh.pos.length;i+=3)if(C.dot(C.sub(Array.from(mesh.pos.subarray(i,i+3)),p.c),forward)>p.nozzleLength/2+.001)root++;assert.ok(root>0,'owner binding retains source root vertices behind the throat');
  p.machineryId=p.id;assert.deepEqual(Array.from(C.engineSkinMesh(p).pos),Array.from(mesh.pos),'owner metadata cannot alter the authored casing');
 }
});

test('generated machinery body dimensions and position survive nozzle edits and reactor moves',()=>{
 const p=engine(),reactor={id:2,k:'gen',c:[180,70,-20],d:20},ship=C.newShip({L:600,W:200,H:200,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1},'Independent body and physical feed');ship.parts=[p,reactor];ship.fits=[];p.reactor=2;
 const first=C.enginePaths(ship)[0],body=plain(first.machinerySegment),volume=C.resolveEngineSpec(p,ship).effectiveMachineryVolumeM3;
 assert.ok(body,'a derived path identifies its physical machinery body');near(body.l,p.machineryLengthM);near(body.r1,p.machineryRadiusM);
 vector(body.b,C.sub(p.c,C.mul(C.norm(p.dir),p.machineryOffsetM)),'independent offset');
 p.d*=2;p.nozzleLength*=1.7;assert.deepEqual(plain(C.enginePaths(ship)[0].machinerySegment),body,'nozzle dimensions cannot resize or translate machinery');
 const feedLength=C.engineTransmission(ship).length;assert.ok(feedLength>0);reactor.c=[380,110,50];
 const moved=C.enginePaths(ship)[0];assert.deepEqual(plain(moved.machinerySegment),body);assert.ok(C.engineTransmission(ship).length>feedLength);near(C.resolveEngineSpec(p,ship).effectiveMachineryVolumeM3,volume,'feed length cannot create machinery volume');
 ship.parts=[p];assert.deepEqual(plain(C.enginePaths(ship)[0].machinerySegment),body,'an unconnected installed body remains physical');
});

test('a valid small machinery body remains physical before it has a reactor connection',()=>{
 const p=engine({d:6,nozzleLength:.12,machineryLengthM:.05,machineryRadiusM:.02,machineryOffsetM:.06,ratedInputW:1e9}),ship=fixture(p);
 assert.equal(C.resolveEngineSpec(p,ship).valid,true);
 const route=C.enginePaths(ship)[0];assert.ok(route?.machinerySegment);near(route.machinerySegment.l,.05);assert.equal(route.segments.length,1);
 const mesh=G.meshParts(ship,{coded:false});assert.ok(mesh.ranges[route.id]?.some(([,start,count])=>count>0),'a short installed body is still drawn');
});

test('invalid overflowing machinery dimensions cannot enter render geometry or camera bounds',()=>{
 for(const p of [engine(),sourceEngine('isdh_engine_main'),sourceEngine('ven_inner_port')]){p.machineryLengthM=1e200;p.machineryRadiusM=1e200;const ship=fixture(p);assert.equal(C.resolveEngineSpec(p,ship).valid,false);
  assert.equal(C.enginePaths(ship).length,0,'an invalid infinite-volume shape is excluded from physical geometry');assert.ok(C.engineSkinMesh(p).b.every(Number.isFinite),'source bell bounds remain finite when invalid machinery is omitted');assert.ok(G.shipBounds(ship).every(Number.isFinite));assert.equal(C.engineHullEntry(ship,p),null,'invalid source machinery cannot start an unbounded hull scan');
  for(const mesh of Object.values(G.meshParts(ship,{coded:false}).g))assert.ok(Array.from(mesh.pos.subarray(0,mesh.n*3)).every(Number.isFinite),'full editor rendering keeps every vertex finite');
 }
});

test('physical frustum picking, outlines, bounds and rendered normals use the same body',()=>{
 const p=engine(),ship=fixture(p),route=C.enginePaths(ship)[0],s=route.machinerySegment,full=G.meshParts(ship,{coded:false}),rows=full.ranges[route.id],vertices=rangeMesh({name:'engine',geo:full.g.engine},rows),bounds=C.partAABB(route),frame=G.shipBounds(ship);
 assert.ok(vertices.length>0,'the unconnected machinery body is rendered');
 for(const {p:q}of vertices){const t=C.dot(C.sub(q,s.a),s.u),r=C.lerp(s.r0,s.r1,t/s.l),radial=C.len(C.sub(C.sub(q,s.a),C.mul(s.u,t)));assert.ok(t>=-.0002&&t<=s.l+.0002);assert.ok(radial<=r+.0002,'decorative body bands fit the occupied envelope');for(let k=0;k<3;k++){assert.ok(q[k]>=bounds[k]-.0002&&q[k]<=bounds[k+3]+.0002);assert.ok(q[k]>=frame[k]-.0002&&q[k]<=frame[k+3]+.0002);}}
 for(let i=0;i<vertices.length;i+=3){const [a,b,c]=vertices.slice(i,i+3),n=C.norm(C.cross(C.sub(b.p,a.p),C.sub(c.p,a.p)));if(C.len(n)>.1)assert.ok(C.dot(n,a.n)>.97,'winding and outward normals agree');}
 const middle=C.add(s.a,C.mul(s.u,s.l/2)),origin=C.add(middle,C.mul(s.v,s.r1*3)),hit=C.rayPart(origin,C.mul(s.v,-1),route);assert.ok(hit);near(hit.t,s.r1*3-(s.r0+s.r1)/2,'side selection follows the taper');assert.ok(C.inPart(route,hit.p));
 const outside=C.add(C.sub(s.a,C.mul(s.u,10)),C.mul(C.add(s.v,s.w),s.r1*.9));assert.equal(C.rayPart(outside,s.u,route),null,'empty bounding-box corners are not selectable machinery');
 const cap=C.rayPart(C.add(s.b,C.mul(s.u,10)),C.mul(s.u,-1),route);assert.ok(cap);near(cap.t,10,'body end cap');vector(cap.n,s.u,'cap normal');
 const lines=G.lineSet();lines.part(route,[255,255,255,255]);const positions=lines.out().pos;
 for(let i=0;i<positions.length;i+=3){const q=Array.from(positions.subarray(i,i+3)),t=C.dot(C.sub(q,s.a),s.u),rad=C.len(C.sub(C.sub(q,s.a),C.mul(s.u,t)));near(rad,C.lerp(s.r0,s.r1,t/s.l),'outline follows the body radius');}
});

test('generated machinery uses identical geometry in editor, live preview and fleet',()=>{
 const p=engine(),ship=fixture(p),full=G.meshParts(ship,{coded:false}),preview=G.meshPreview(ship,[p],[],{coded:false}),fleet=G.fleetGeometry(ship);
 assert.deepEqual(geometry(preview.preview),geometry(full.g.engine),'the preview includes the same independent body and normals');
 assert.deepEqual(geometry(fleet.meshes.engine.geo),geometry(full.g.engine),'fleet uses the common body mesh');
 for(const assetId of ['isdh_engine_main','ven_inner_port']){const source=sourceEngine(assetId);source.machineryLengthM*=1.4;source.machineryRadiusM*=.8;const model=fixture(source),editor=G.meshParts(model,{coded:false}),live=G.meshPreview(model,[source],[],{coded:false}),flight=G.fleetGeometry(model);assert.deepEqual(geometry(live.previewRef),geometry(editor.g.refEngine),assetId+' source preview');assert.deepEqual(geometry(flight.meshes.refEngine.geo),geometry(editor.g.refEngine),assetId+' source fleet');}
});

test('distance LOD and decorative quality leave shared propulsion, power, heat and damage inputs unchanged',()=>{
 const p=engine({reactor:2}),reactor={id:2,k:'gen',c:[180,70,-20],d:20},ship=fixture(p,reactor),spec={...C.resolveEngineSpec(p,ship),available:true,connected:true,outletAvailable:true,pathCapacityW:p.ratedInputW,domain:'main'},profile={engines:[spec],massKg:1e6,ratedThrustN:spec.ratedThrustN,ratedAccelMps2:spec.ratedThrustN/1e6,accelerationLimitMps2:100},freeze=o=>{if(o&&typeof o==='object'){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
 freeze(profile);
 const context={throttle:.9,states:{1:{thermalLimit:.6,damageLimit:.7}},sources:[{id:'p2',domain:'main',powerW:p.ratedInputW*.3}],links:[{from:'p2',to:'p1',cap:p.ratedInputW*.4,ok:true}],otherLoads:[{id:'cooling',kind:'cooling',port:'p1',domain:'main',requestedInputW:p.ratedInputW*.1}],mode:'balanced'},before=plain(C.solveShipPropulsion(profile,context)),savedProfile=plain(profile),savedContext=plain(context),parts=JSON.parse(C.publicJSON(ship)).parts;
 assert.ok(before.actualInputW>0&&before.actualInputW<spec.ratedInputW*.42);near(before.wasteHeatW/before.actualInputW,.05,'actual-input waste fraction',1e-12);
 for(const detail of [0,1]){
  ship.detail=detail;const asset=G.fleetGeometry(ship),drawn=[],gl=new Proxy({},{get:(_,k)=>/^[A-Z_]+$/.test(String(k))?0:()=>{}}),renderer={gl,meshes:{},off:[0,0,0],cam:{target:[0,0,0],fov:.72},canvas:{height:700},fleetCache:new Map([['propulsion',asset]]),look:{shadow:false},drawMesh:name=>drawn.push(name),drawLines(){},drawRays(){},setLights(){},setPoints(){},drawPoints(){}},unit={key:'propulsion',pos:[0,0,0],p:{propulsion:profile},mods:[.7],ht:{st:[123],lm:[.6]},glow:.7},savedUnit=plain(unit);
  for(const distance of [1000,30000]){drawn.length=0;renderer.eye=()=>[0,0,distance];G.Renderer.prototype.drawFleet.call(renderer,{}, {fleet:[unit],lod:true,mode:'review'});assert.equal(drawn.includes('refEngine'),distance===1000,'the draw path actually changes with distance');assert.deepEqual(plain(C.solveShipPropulsion(profile,context)),before,'visual options cannot change the common W/N/heat/power result');assert.deepEqual(plain(unit),savedUnit,'drawing cannot mutate engine damage or heat state');}
 }
 assert.deepEqual(plain(profile),savedProfile);assert.deepEqual(plain(context),savedContext);assert.deepEqual(JSON.parse(C.publicJSON(ship)).parts,parts);
});
