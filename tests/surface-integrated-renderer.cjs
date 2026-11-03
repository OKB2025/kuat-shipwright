const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v));
function fixture({face='port',rotate=false,cut=false,depth=3,armor=false}={}){
 const ship=C.newShip({L:240,W:160,H:120,assembly:true},'Integrated machinery');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const body=C.placePart(ship,'struct',[110,60,0],[160,100,80],{form:'box',...(rotate?{yaw:29,pitch:21,roll:13}:{})},false);
 if(cut)ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[127,60,-40],s:[6,140,8],structures:true}));
 const patch=C.surfacePatches(ship).filter(p=>p.host==='p'+body.id&&p.face===face&&p.exposed).sort((a,b)=>b.area-a.area)[0];assert.ok(patch);
 assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:armor?'armor':'equipment',allocation:{cooling:40,sensors:20,habitation:40},battery:{weapon:'pd',count:armor?0:3,spacing:1},equipment:{kind:'hdis',depth},armor:{thickness:armor?1:0},style:{kind:'machinery',density:.8,seed:97}}).ok,true);
 return {ship,body,patch:C.surfacePatches(ship).find(p=>p.id===patch.id)};
}
function points(g){const seen=new Set(),p=[];for(let i=0;i<g.ni;i++){const j=g.idx[i];if(!seen.has(j)){seen.add(j);p.push(Array.from(g.pos.slice(j*3,j*3+3)));}}return p;}
function tris(g){const T=[];for(let i=0;i<g.ni;i++)T.push(...g.pos.slice(g.idx[i]*3,g.idx[i]*3+3));return T;}
function inside(body,p,n){return C.inPart(body,p)||C.inPart(body,C.sub(p,C.mul(n,.0002)));}
const median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];

test('large staggered machinery and its working faces are inside their actual structure envelope',()=>{
 for(const rotate of [false,true]){const {ship,body,patch}=fixture({rotate}),saved=C.publicJSON(ship),row=G.surfaceVisualPlan(ship).find(r=>r.id===patch.id),mesh=G.meshSurfaceLayers(ship,{}),primary=row.field.filter(q=>['stratum-machinery','stratum-core'].includes(q.feature)&&q.recess);assert.ok(primary.length>12);assert.equal(row.functionalDepth,3);assert.ok(row.recessDepth>3,'structural relief must be independent of the functional room depth');
  const back=primary.map(p=>C.dot(C.sub(p.center,patch.center),patch.normal)-p.size[2]/2),front=primary.map(p=>C.dot(C.sub(p.center,patch.center),patch.normal)+p.size[2]/2);assert.ok(Math.max(...back)-Math.min(...back)>.5);assert.ok(Math.max(...front)-Math.min(...front)>.8);assert.ok(median(primary.map(p=>Math.sqrt(p.size[0]*p.size[1])))>3);
  for(const name of ['surfaceDevices','surfaceDetail']){const P=points(mesh[name]);assert.ok(P.length>100);for(const p of P){assert.ok(C.dot(C.sub(p,patch.center),patch.normal)<.001,name+' protrudes outside the selected wall');assert.ok(inside(body,p,patch.normal),name+' leaves the actual owner volume: '+p);}}
  for(let i=0;i<row.backingTriangles.length;i+=3){const p=row.backingTriangles.slice(i,i+3);assert.ok(inside(body,p,patch.normal));assert.ok(C.dot(C.sub(p,patch.center),patch.normal)<=-row.recessDepth+.1);}
  assert.equal(C.publicJSON(ship),saved,'rendering must not alter native layout or capacity');
 }
});

test('equipment replaces the opaque host wall with recessed backing and retains the roof and underside caps',()=>{
 const {ship,body,patch}=fixture(),row=G.surfaceVisualPlan(ship).find(r=>r.id===patch.id),full=G.meshParts(ship,{coded:false}),T=tris(full.g.struct),primary=row.field.find(q=>['stratum-machinery','stratum-core'].includes(q.feature)&&q.recess),wallPoint=C.sub(primary.center,C.mul(patch.normal,C.dot(C.sub(primary.center,patch.center),patch.normal))),o=C.add(wallPoint,C.mul(patch.normal,10)),hit=C.rayTris(T,o,C.mul(patch.normal,-1));
 assert.ok(!hit||hit.t>20,'the original unbroken wall still obscures the inset machinery');
 const backing=C.rayTris(row.backingTriangles,o,C.mul(patch.normal,-1));assert.ok(backing&&Math.abs(backing.t-(10+row.recessDepth))<1e-5,'backing must be inside the opening');
 for(const face of ['top','bottom']){const p=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face===face),a=C.add(p.center,C.mul(p.normal,4)),h=C.rayTris(T,a,C.mul(p.normal,-1));assert.ok(h&&h.t<4.3,face+' armor cap was removed with the wall');}
 assert.ok(full.g.surfaceArmor.ni>row.backingTriangles.length/3,'equipment opening requires reveal walls at the armor edges');
});

test('split equipment patches uncover only their own region and keep adjacent armor',()=>{
 const {ship,body,patch}=fixture(),split=C.surfaceSplit(ship,patch.id,'u',.5);assert.ok(split.ok);assert.equal(C.setSurfaceConfig(ship,split.ids[1],{functionMode:'armor',armor:{thickness:1}}).ok,true);
 const patches=C.surfacePatches(ship),a=patches.find(p=>p.id===split.ids[0]),b=patches.find(p=>p.id===split.ids[1]),g=G.meshParts(ship,{coded:false}),T=tris(g.g.struct);
 const equipmentHit=C.rayTris(T,C.add(a.center,C.mul(a.normal,5)),C.mul(a.normal,-1)),armorHit=C.rayTris(T,C.add(b.center,C.mul(b.normal,5)),C.mul(b.normal,-1));assert.ok(!equipmentHit||equipmentHit.t>20);assert.ok(armorHit&&Math.abs(armorHit.t-5)<1e-5,'adjacent armor base skin was removed');assert.ok(points(g.g.surfaceDevices).every(p=>inside(body,p,a.normal)));
});

test('cutouts remain empty and every emitted machinery vertex stays inside its cut owner',()=>{
 const {ship,body,patch}=fixture({rotate:true,cut:true}),row=G.surfaceVisualPlan(ship).find(r=>r.id===patch.id),g=G.meshSurfaceLayers(ship,{});assert.ok(row.field.length>10);
 for(const name of ['surfaceDevices','surfaceDetail'])for(const p of points(g[name]))assert.ok(inside(body,p,patch.normal),'cutout or sloped owner was filled by '+name+': '+p);
});

test('sloped armor seams use absolute ship coordinates instead of a diagonal local UV basis',()=>{
 for(const face of ['top','port','fore']){const {ship}=fixture({rotate:true,face,armor:true}),g=G.meshSurfaceLayers(ship,{}).surfaceArmor;assert.ok(g.ni>0);
  for(let i=0;i<g.ni;i+=3){const ids=[g.idx[i],g.idx[i+1],g.idx[i+2]],P=ids.map(k=>Array.from(g.pos.slice(k*3,k*3+3))),n=C.norm(C.cross(C.sub(P[1],P[0]),C.sub(P[2],P[0]))),a=n.map(Math.abs),l=Math.hypot(n[0],n[2])||1;if(C.len(n)<.1)continue;for(let j=0;j<3;j++){const p=P[j],expected=a[1]>=a[0]&&a[1]>=a[2]?[p[0],p[2]]:[(p[0]*n[2]-p[2]*n[0])/l,p[1]];for(let k=0;k<2;k++)assert.ok(Math.abs(g.uv[ids[j]*2+k]-expected[k]/30)<.0001,'armor UV rotates with a local/sloped face');}}
 }
});

test('equipment faces without installed cells retain only neutral structure scenery and add no capacity',()=>{
 const initial=fixture();assert.equal(C.setSurfaceConfig(initial.ship,initial.patch.id,{battery:{count:0}}).ok,true);
 // An imported count-v1 face can retain zero equipment. New area-v1 faces
 // deliberately fill their nonweapon allocation even when an old limit is0.
 const savedSource=C.serialize(initial.ship),cfg=savedSource.surfaces.patches.find(q=>q.id===initial.patch.id);delete cfg.equipment.capacityModel;delete cfg.aggregate;cfg.equipment.count=0;cfg.equipment.limit=0;const ship=C.deserialize(savedSource),body=ship.parts.find(q=>q.id===initial.body.id),patch=C.surfacePatches(ship).find(q=>q.id===initial.patch.id);
 const installed=()=>[...ship.parts,...ship.fits].filter(p=>p.surfacePatch===patch.id&&!p.surfaceUnplaced);assert.equal(installed().length,0);
 const saved=C.publicJSON(ship),stats=plain(C.computeStats(ship)),report=plain(C.surfaceReport(ship)),row=G.surfaceVisualPlan(ship).find(r=>r.id===patch.id);assert.ok(row.field.length>12,'an empty capacity budget must not leave a blank structural wall');assert.equal(row.devices.length,0,'functional working faces require native installed devices');
 for(const q of [...row.field,...row.boxes]){assert.equal(q.ownerId,body.id);assert.equal(q.role,null,'neutral machinery must not impersonate a functional category');assert.ok(!/cooling-|sensor-|habitation-|gun-/.test(q.feature));}
 const g=G.meshSurfaceLayers(ship,{});assert.ok(g.surfaceDevices.ni>0);for(const p of points(g.surfaceDevices))assert.ok(inside(body,p,patch.normal));
 assert.equal(installed().length,0);assert.equal(C.publicJSON(ship),saved);assert.deepEqual(plain(C.computeStats(ship)),stats);assert.deepEqual(plain(C.surfaceReport(ship)),report);
});

test('skin broadphase preserves exact clipped fragments and interpolated reference UVs',()=>{
 const hc=vm.createContext({Core:C,console}),source=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8');assert.ok(source.includes('return {meshPreview,'));vm.runInContext(source.replace('return {meshPreview,','return {equipmentSkinCutters,equipmentSkinFragments,meshPreview,'),hc);const H=vm.runInContext('Gfx',hc);
 const patches=[{triangles:[0,0,0,20,0,0,20,20,0,0,0,0,20,20,0,0,20,0]},{triangles:[50,0,3,60,0,3,50,10,3]}],optimized=H.equipmentSkinCutters(patches),linear=H.equipmentSkinCutters(patches);linear.bounds=[-Infinity,-Infinity,-Infinity,Infinity,Infinity,Infinity];linear.normalBounds=linear.bounds.slice();
 const uv=p=>[...p,p[0]*.037+p[1]*.012,p[1]*.053-p[0]*.008],polys=[];for(let x=-25;x<76;x+=7)for(let y=-20;y<51;y+=9)polys.push([[x,y,0],[x+11,y,0],[x+5,y+13,0]].map(uv));
 // Overlapping AABBs with a perpendicular normal, remote parallel faces,
 // and normals on both sides of the existing dot-product tolerance.
 polys.push([[5,5,-3],[12,5,-3],[5,5,4]].map(uv),[[1,1,8],[10,1,8],[1,10,8]].map(uv));for(const slope of [.00446,.00447,.00448,.00449])polys.push([[1,1,0],[1.2,1,-slope*.2],[1,1.2,0]].map(uv));
 let changed=0,untouched=0;for(const poly of polys){const a=plain(H.equipmentSkinFragments(poly,optimized)),b=plain(H.equipmentSkinFragments(poly,linear));assert.deepEqual(a,b,'broadphase changed a fragment or its UV interpolation');if(JSON.stringify(a)!==JSON.stringify([poly]))changed++;else untouched++;}
 assert.ok(changed>10&&untouched>10,'comparison must include real clipping and rejected candidates');
});
