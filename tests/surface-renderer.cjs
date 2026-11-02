const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x,(k,v)=>k.startsWith('_')?undefined:v));
function fixture(){
 const ship=C.newShip({L:160,W:100,H:40,assembly:true},'Surface rendering');ship.armor={hull:0,cit:0};ship.detail=1;
 const body=C.placePart(ship,'struct',[80,20,0],[160,100,40],{form:'box'},false),patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face==='top');
 assert.ok(patch?.exposed);const result=C.setSurfaceConfig(ship,[patch.id],{armor:{material:'dense',thickness:.4},equipment:{kind:'hdis',count:2,depth:1},battery:{weapon:'ltl',count:2,spacing:2},style:{kind:'machinery',density:.7,seed:37}});assert.equal(result.ok,true);
 return {ship,body,patch:C.surfacePatches(ship).find(p=>p.id===patch.id)};
}
function functional(ship){const s=C.surfaceReport(ship);return plain({parts:ship.parts.map(p=>({id:p.id,k:p.k,c:p.c,room:p.room,s:p.s,d:p.d})),fits:ship.fits.map(f=>({id:f.id,k:f.k,p:f.p,n:f.n})),counts:s.totals});}
function selectedPlan(ship,patch,opt){const row=G.surfaceVisualPlan(ship,opt).find(p=>p.id===patch.id);assert.ok(row,'the edited semantic patch must have a visual record');return row;}
const identity3=[1,0,0,0,1,0,0,0,1],identity4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],apply=(r,p)=>[r[0]*p[0]+r[3]*p[1]+r[6]*p[2],r[1]*p[0]+r[4]*p[1]+r[7]*p[2],r[2]*p[0]+r[5]*p[1]+r[8]*p[2]];
function rendererFixture(data,kind='webgl'){
 const calls=[],ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}},canvas={width:32,height:700,clientWidth:32,clientHeight:700,getContext:k=>k==='2d'?ctx:null};
 let renderer;if(kind==='webgl'){
  renderer=Object.create(G.Renderer.prototype);Object.assign(renderer,{canvas,gl:new Proxy({}, {get:(_,k)=>/^[A-Z_]+$/.test(String(k))?0:()=>{}}),off:[0,0,0],meshes:{},cam:{target:[0,0,0],fov:.72},look:{shadow:false}});
  renderer.upload=function(name,geo){this.meshes[name]={geo,count:geo.ni};};renderer.drawMesh=function(name){if(this.meshes[name]?.count)calls.push({name,off:this.off.slice(),center:this.modelCenter.slice(),rot:(this.modelRot||identity3).slice()});};
  renderer.setLights=renderer.drawRays=renderer.drawLines=renderer.setPoints=renderer.drawPoints=()=>{};
 }else{
  renderer=new G.CompatRenderer(canvas);renderer.matrices=()=>({VP:identity4});renderer.rasterMesh=(geo,source,alpha,clip,transform)=>{if(geo?.ni){const name=Object.entries(data.meshes).find(([,m])=>m.geo===geo)?.[0]||source;calls.push({name,source,...transform});}};renderer.paintLines=()=>{};
 }
 renderer.eye=()=>[0,0,1000];const asset=renderer.loadFleet('surface-test',data),draw=unit=>kind==='webgl'?renderer.drawFleet({VP:identity4,eye:renderer.eye()},{fleet:[unit],lod:true,mode:'review'}):renderer.draw({fleet:[unit],lod:true,mode:'review'});
 return {renderer,asset,calls,draw};
}
function nearVector(a,b,label){for(let i=0;i<3;i++)assert.ok(Math.abs(a[i]-b[i])<1e-6,label+' component '+i+': '+a[i]+' vs '+b[i]);}

test('surface device ports correspond to installed equipment and remain when cosmetic detail is disabled',()=>{
 const {ship,patch}=fixture(),installed=ship.parts.filter(p=>p.surfacePatch);assert.equal(installed.length,2);assert.equal(ship.fits.length,2);
 const before=C.publicJSON(ship),all=G.surfaceVisualPlan(ship,{detail:1}),near=selectedPlan(ship,patch,{detail:1}),low=selectedPlan(ship,patch,{detail:0});
 assert.equal(all.reduce((n,p)=>n+p.devices.length,0),installed.length,'automatic armor records do not create additional equipment ports');assert.equal(near.devices.length,installed.length);assert.ok(near.boxes.length>0);assert.equal(low.boxes.length,0);assert.deepEqual(plain(low.devices),plain(near.devices));
 assert.equal(C.publicJSON(ship),before,'render quality cannot add or remove functional equipment');
 const highMesh=G.meshSurfaceLayers(ship,{}, {detail:1}),lowMesh=G.meshSurfaceLayers(ship,{}, {detail:0});
 assert.equal(lowMesh.surfaceDevices.ni,highMesh.surfaceDevices.ni);assert.equal(lowMesh.surfaceArmor.ni,highMesh.surfaceArmor.ni);assert.ok(highMesh.surfaceDetail.ni>0);assert.equal(lowMesh.surfaceDetail.ni,0);
});

test('surface visual seeds are reproducible and density changes preserve mount IDs, mass, crew and capacity',()=>{
 const {ship,patch}=fixture(),before=functional(ship),a=selectedPlan(ship,patch),b=selectedPlan(ship,patch);
 assert.deepEqual(plain(a),plain(b));
 C.setSurfaceConfig(ship,[patch.id],{style:{density:0,seed:99}});assert.deepEqual(functional(ship),before);
 const off=selectedPlan(ship,patch);assert.equal(off.boxes.length,0);assert.equal(off.devices.length,2);
 C.setSurfaceConfig(ship,[patch.id],{style:{density:.7,seed:99}});const changed=selectedPlan(ship,patch);assert.notDeepEqual(plain(changed.boxes),plain(a.boxes));assert.deepEqual(functional(ship),before);
});

test('saving and loading the same design restores device anchors and seeded surface detail exactly',()=>{
 const {ship,patch}=fixture(),before=selectedPlan(ship,patch),restored=C.deserialize(C.serialize(ship)),after=selectedPlan(restored,patch);
 assert.deepEqual(plain(after.boxes),plain(before.boxes));assert.deepEqual(plain(after.devices),plain(before.devices));assert.deepEqual(functional(restored),functional(ship));
});

test('the semantic patch outline shows physical boundary edges without triangulation diagonals',()=>{
 const {ship,patch}=fixture(),lines=G.surfaceSelectionLines(ship,[patch.id]);assert.equal(lines.pos.length,4*6);
 const edges=[];for(let i=0;i<lines.pos.length;i+=6){const a=Array.from(lines.pos.slice(i,i+3)),b=Array.from(lines.pos.slice(i+3,i+6));edges.push(C.sub(b,a));}
 for(const e of edges)assert.ok(Math.abs(C.dot(e,patch.u))<1e-5||Math.abs(C.dot(e,patch.v))<1e-5,'a diagonal is not an editable face edge');
 assert.equal(G.surfaceSelectionLines(ship,['missing']).pos.length,0);assert.equal(G.surfaceSelectionLines(null,[patch.id]).pos.length,0);
});

test('surface picking uses the same exposed geometry for WebGL and Canvas2D editors',()=>{
 const {ship,patch}=fixture(),ray={o:C.add(patch.center,C.mul(patch.normal,100)),d:C.mul(patch.normal,-1)},fake={surfaceShip:ship,ray:()=>ray};
 const a=G.Renderer.prototype.pickSurface.call(fake,13,29),b=G.CompatRenderer.prototype.pickSurface.call(fake,13,29);
 assert.equal(a.id,patch.id);assert.equal(b.id,patch.id);assert.deepEqual(plain(a.point),plain(b.point));
 let stored;G.Renderer.prototype.setSurfaceSelection.call({setLines:(name,lines)=>{stored={name,lines};}},ship,[patch.id]);assert.equal(stored.name,'surfaces');assert.equal(stored.lines.pos.length,24);
});

test('surface ornament footprints keep clear of actual turret envelopes and remain bounded by the patch',()=>{
 const {ship,patch}=fixture(),plan=selectedPlan(ship,patch);assert.ok(plan.boxes.length>0);
 const right=C.norm(patch.u),up=C.norm(patch.v),normal=C.norm(patch.normal),bounds=ship.fits.map(f=>C.fitAABB(f));
 for(const box of plan.boxes){const anchor=C.sub(box.center,C.mul(normal,(plan.config.armor.thickness||0)+.015+box.size[2]/2));
  for(const [x,y]of [[-1,-1],[1,-1],[1,1],[-1,1]]){const q=C.add(anchor,C.add(C.mul(right,x*box.size[0]*.6),C.mul(up,y*box.size[1]*.6)));assert.ok(C.rayTris(patch.triangles,C.add(q,C.mul(normal,100)),C.mul(normal,-1)));}
  for(const b of bounds)assert.ok(!box.center.every((v,i)=>v>=b[i]&&v<=b[i+3]),'decorative equipment must not occupy a turret');
 }
});

test('fleet distance LOD omits decorative meshes while preserving the functional design and armor',()=>{
 const {ship}=fixture(),before=C.publicJSON(ship),drawn=[],gl=new Proxy({}, {get:(_,k)=>/^[A-Z_]+$/.test(String(k))?0:()=>{}}),asset={length:160,center:[80,20,0],bounds:[0,0,-50,160,40,50],meshes:{},foils:[],glow:[]};
 const renderer={gl,meshes:{},off:[0,0,0],cam:{target:[0,0,0],fov:.72},canvas:{height:700},eye:()=>[0,0,1000],fleetCache:new Map([['surface',asset]]),look:{shadow:false},drawMesh:name=>drawn.push(name),drawLines:()=>{},drawRays:()=>{},setLights:()=>{},setPoints:()=>{},drawPoints:()=>{}};
 const options={fleet:[{key:'surface',pos:[0,0,0]}],lod:true,mode:'review'};
 G.Renderer.prototype.drawFleet.call(renderer,{},options);assert.ok(drawn.includes('surfaceArmor'));assert.ok(drawn.includes('surfaceDevices'));assert.ok(drawn.includes('surfaceDetail'));
 drawn.length=0;renderer.eye=()=>[0,0,30000];G.Renderer.prototype.drawFleet.call(renderer,{},options);assert.ok(drawn.includes('surfaceArmor'));assert.ok(!drawn.includes('surfaceDetail'));assert.ok(!drawn.includes('surfaceDevices'));assert.equal(C.publicJSON(ship),before);
});

test('surface armor, equipment ports and actual guns remain attached to an animated S-foil',()=>{
 const ship=C.newShip({L:80,W:80,H:20,assembly:true});ship.detail=0;const wing=C.placePart(ship,'wing',[40,10,0],[40,50,4],{},false);wing.wing=C.normalizeWing({...wing.wing,foil:true,open:10,stow:50});
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+wing.id&&p.face==='top');assert.ok(patch);
 assert.equal(C.setSurfaceConfig(ship,[patch.id],{armor:{thickness:.03},equipment:{kind:'radiator',count:1,depth:.2},battery:{weapon:'claser',count:1},style:{density:0}}).ok,true);
 const asset=G.fleetGeometry(ship),foil=asset.foils.find(f=>f.id===wing.id),device=ship.parts.find(p=>p.surfacePatch),gun=ship.fits.find(f=>f.surfacePatch);
 assert.ok(foil.partIds.includes(device.id));assert.ok(foil.fitIds.includes(gun.id));
 for(const kind of ['surfaceArmor','surfaceDevices','fits'])assert.ok(foil.meshes.some(name=>foil.kinds[name]===kind),kind+' must follow the same hinge');
 assert.equal(asset.meshes.surfaceArmor.geo.ni,0,'moving armor is removed from the stationary ship shell');assert.equal(asset.meshes.surfaceDevices.geo.ni,0);
});

test('Canvas2D fleet LOD also separates decorative meshes from the physical armor shell',()=>{
 const {ship}=fixture(),asset=G.fleetGeometry(ship),drawn=[],ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:()=>{}},canvas={width:32,height:32,clientWidth:32,clientHeight:32,getContext:k=>k==='2d'?ctx:null},renderer=new G.CompatRenderer(canvas);
 renderer.loadFleet('surface',asset);renderer.rasterMesh=(g,name)=>{if(g?.ni)drawn.push(name);};renderer.paintLines=()=>{};renderer.eye=()=>[0,0,100];
 renderer.draw({fleet:[{key:'surface',pos:[0,0,0]}],lod:true});assert.ok(drawn.includes('surfaceDevices'));assert.ok(drawn.includes('surfaceDetail'));assert.ok(drawn.includes('surfaceArmor'));
 drawn.length=0;renderer.eye=()=>[0,0,1000];renderer.draw({fleet:[{key:'surface',pos:[0,0,0]}],lod:true});assert.ok(drawn.includes('surfaceArmor'));assert.ok(!drawn.includes('surfaceDetail'));assert.ok(!drawn.includes('surfaceDevices'));
});

test('both renderers retain surface turret metadata and use the requested combat center for uncommanded rest meshes',()=>{
 const {ship}=fixture(),profile=C.fleetProfile(C.computeStats(ship),ship.name,ship),center=profile.surface.offset.slice(),geometry=G.fleetGeometry(ship,{center});
 assert.deepEqual(plain(geometry.center),plain(center));center[0]+=100;assert.deepEqual(plain(geometry.center),plain(profile.surface.offset),'the common center is copied rather than aliased');assert.equal(geometry.surfaceTurrets,true);
 const guns=geometry.turrets.filter(t=>t.mesh);assert.equal(guns.length,ship.fits.length,'each installed tracking gun owns a real mesh');
 const original=G.meshFits(ship),keys=g=>{const out=[];for(let i=0;i<g.ni;i+=3)out.push(Array.from(g.idx.slice(i,i+3)).flatMap(k=>Array.from(g.pos.slice(k*3,k*3+3))).join(','));return out;},partitioned=[geometry.meshes.fits.geo,...guns.map(t=>geometry.meshes[t.mesh].geo)];assert.deepEqual(partitioned.flatMap(keys).sort(),keys(original).sort(),'the common fit mesh is partitioned into pedestals and tracking bodies exactly once');
 for(const kind of ['webgl','compat']){
  const {asset,calls,draw}=rendererFixture(geometry,kind),unit={key:'surface-test',pos:[15,7,-9],rot:[0,0,-1,0,1,0,1,0,0]};assert.equal(asset.surfaceTurrets,true,kind);draw(unit);
  assert.ok((asset.extra||[]).every(m=>!guns.some(t=>t.mesh===m.name)),kind+': moving guns must not also be static extras');
  for(const rest of guns){const matching=calls.filter(c=>c.name===rest.mesh);assert.equal(matching.length,1,kind+': a gun with no explicit aiming update must render exactly once');const call=matching[0],vertex=Array.from(geometry.meshes[rest.mesh].geo.pos.slice(0,3)),actual=C.add(call.off,apply(call.rot,C.sub(vertex,call.center))),expected=C.add(unit.pos,apply(unit.rot,C.sub(vertex,profile.surface.offset)));nearVector(actual,expected,kind+' common center');}
 }
});

test('surface turret fallback follows a moving foil without needing an aiming update',()=>{
 const ship=C.newShip({L:80,W:80,H:20,assembly:true});ship.detail=0;const wing=C.placePart(ship,'wing',[40,10,0],[40,50,4],{},false);wing.wing=C.normalizeWing({...wing.wing,foil:true,axis:'x',open:10,stow:50});
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+wing.id&&p.face==='top');assert.equal(C.setSurfaceConfig(ship,[patch.id],{battery:{weapon:'cturret',count:1},style:{density:0}}).ok,true);
 const center=[31,8,-4],geometry=G.fleetGeometry(ship,{center}),rest=geometry.turrets.find(t=>t.mesh),foil=geometry.foils.find(f=>f.id===wing.id);assert.ok(rest);assert.equal(rest.foilId,wing.id);
 for(const kind of ['webgl','compat']){const {calls,draw}=rendererFixture(geometry,kind),unit={key:'surface-test',pos:[8,12,-7],foils:{[wing.id]:0}};draw(unit);const call=calls.find(c=>c.name===rest.mesh);assert.ok(call,kind+' moving rest turret');const vertex=Array.from(geometry.meshes[rest.mesh].geo.pos.slice(0,3)),actual=C.add(call.off,apply(call.rot,C.sub(vertex,call.center))),expected=C.add(unit.pos,C.sub(G.foilTransform(foil,0).point(vertex),center));nearVector(actual,expected,kind+' foil rest mesh');}
});

test('far surface assets omit cosmetic and turret meshes even when the ship supplies aiming poses',()=>{
 const {ship}=fixture(),geometry=G.fleetGeometry(ship),poses=geometry.turrets.filter(t=>t.mesh).map(t=>({mesh:t.mesh,pivot:t.pivot.slice(),rot:identity3.slice()}));assert.ok(poses.length>0);
 for(const kind of ['webgl','compat']){const {renderer,calls,draw}=rendererFixture(geometry,kind),unit={key:'surface-test',pos:[0,0,0],turrets:poses};draw(unit);assert.ok(calls.some(c=>c.name==='surfaceDetail'),kind+' near detail');assert.ok(calls.some(c=>poses.some(t=>t.mesh===c.name)),kind+' near turret');calls.length=0;renderer.eye=()=>[0,0,30000];draw(unit);assert.ok(calls.some(c=>c.name==='surfaceArmor'),kind+' far physical armor');assert.ok(!calls.some(c=>c.name==='surfaceDetail'||c.name==='surfaceDevices'),kind+' far cosmetics');assert.ok(!calls.some(c=>poses.some(t=>t.mesh===c.name)),kind+' far turret mesh');}
});
