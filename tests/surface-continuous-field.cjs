const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance:{now:()=>0}});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x,(k,v)=>k.startsWith('_')?undefined:v)),roles=['weapons','cooling','sensors','habitation'];
const only=k=>Object.fromEntries(roles.map(r=>[r,r===k?100:0]));
function fixture({allocation={weapons:25,cooling:25,sensors:25,habitation:25},face='port',rotate=false,hole=false,foil=false}={}){
 let ship=C.newShip({L:160,W:100,H:60,assembly:true},'Continuous machinery acceptance');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const body=C.placePart(ship,foil?'wing':'struct',[70,30,0],foil?[80,40,6]:[112,48,32],foil?{}:{form:'box',...(rotate?{yaw:27,pitch:19,roll:11}:{})},false);
 if(foil)body.wing=C.normalizeWing({...body.wing,foil:true,axis:'x',open:10,stow:50});
 if(hole)ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[81,30,9],s:[5,7,80],structures:true}));
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+body.id&&p.face===(foil?'top':face));assert.ok(patch?.exposed);
 const density=Object.fromEntries(roles.filter(k=>k!=='weapons').map(k=>[k,allocation[k]||0])),pureGuns=allocation.weapons>0&&!Object.values(density).some(n=>n>0);
 assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:density,battery:{weapon:'pd',count:allocation.weapons>0?2:0,spacing:.5},equipment:{kind:'hdis',depth:foil?.6:2,...(pureGuns?{limit:0}:{})},style:{kind:'machinery',density:.75,seed:137}}).ok,true);
 // Preserve a real pre-area count-v1 design for the pure-gun compatibility
 // case. Area-v1 intentionally allocates all nonweapon area and ignores limit.
 if(pureGuns){const saved=C.serialize(ship),cfg=saved.surfaces.patches.find(q=>q.id===patch.id);delete cfg.equipment.capacityModel;delete cfg.aggregate;cfg.equipment.count=0;cfg.equipment.limit=0;ship=C.deserialize(saved);}
 return {ship,body:ship.parts.find(q=>q.id===body.id),patch:C.surfacePatches(ship).find(p=>p.id===patch.id)};
}
const row=(s,p,opt)=>G.surfaceVisualPlan(s,opt).find(q=>q.id===p.id),pieces=r=>[...(r.field||[]),...r.devices.flatMap(d=>d.hardware||[])];
function projectedBox(q,p){
 const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([u,v])=>C.add(q.center,C.add(C.mul(q.u,u*q.size[0]/2),C.mul(q.v,v*q.size[1]/2))));
 const points=corners.map(v=>{const d=C.sub(v,p.center);return [C.dot(d,p.u),C.dot(d,p.v)];});
 return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
function functional(ship){const r=C.surfaceReport(ship);return plain({devices:C.surfaceDerivedFits(ship).map(q=>({id:q.id,k:q.k,cell:q.surfaceCell,role:q.surfaceRole,point:q.surfacePoint,unplaced:q.surfaceUnplaced})),rows:r.patches.filter(q=>q.config.functionMode==='equipment').map(q=>({id:q.id,partIds:q.partIds,fitIds:q.fitIds,categories:q.categories,mass:q.mass,crew:q.crew,coolingCapacity:q.coolingCapacity,armorMass:q.armorMass}))});}
function triangles(g){const out=[];for(let i=0;i<g.ni;i+=3)out.push([0,1,2].map(k=>Array.from(g.pos.slice(g.idx[i+k]*3,g.idx[i+k]*3+3))));return out;}
function project(v,p){const d=C.sub(v,p.center);return [C.dot(d,p.u),C.dot(d,p.v)];}
function area(poly){return Math.abs(poly.reduce((n,a,i)=>{const b=poly[(i+1)%poly.length];return n+a[0]*b[1]-a[1]*b[0];},0))/2;}
function clipRectangle(poly,b){
 for(const [axis,sign,limit]of [[0,-1,-b[0]],[1,-1,-b[1]],[0,1,b[2]],[1,1,b[3]]]){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],c=poly[(i+1)%poly.length],da=limit-sign*a[axis],dc=limit-sign*c[axis];if(da>=0)out.push(a);if((da>=0)!==(dc>=0)){const t=da/(da-dc);out.push([a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t]);}}poly=out;if(!poly.length)break;}return poly;
}

test('the foreground field crosses logical cell seams with unequal spans rather than reproducing an 8m panel grid',()=>{
 const {ship,patch}=fixture({allocation:only('cooling')}),r=row(ship,patch);assert.ok(r.field?.length>12,'equipment needs a face-wide foreground field');
 const foreground=r.field.filter(q=>q.size[2]>.025&&q.size[0]*q.size[1]<patch.area*.3),bounds=foreground.map(q=>projectedBox(q,patch));assert.ok(foreground.length>12);
 const widths=new Set(foreground.map(q=>q.size[0].toFixed(2))),heights=new Set(foreground.map(q=>q.size[1].toFixed(2)));assert.ok(widths.size>=8&&heights.size>=5,'the field needs multiple unequal dimensions, not translated copies of a standard tile');
 const interiorSeams=[];for(let seam=patch._min[0]+8;seam<patch._max[0]-5;seam+=8)interiorSeams.push({u:seam,v:(patch._min[1]+patch._max[1])/2,h:patch._max[1]-patch._min[1]});
 const crossing=new Set(),seams=new Set();for(let i=0;i<bounds.length;i++){const b=bounds[i];for(const s of interiorSeams)if(b[0]<s.u-.15&&b[2]>s.u+.15&&b[1]<s.v+s.h/2&&b[3]>s.v-s.h/2){crossing.add(i);seams.add(s.u.toFixed(2));}}
 assert.ok(crossing.size>=3&&seams.size>=4,'a few internal decorations inside each physical cell do not create a continuous machinery field');
 assert.ok(foreground.some(q=>q.size[0]>12||q.size[1]>12),'some ledges or conduits must connect multiple physical service cells');
});

test('pure-role equipment faces never display an uninstalled category or habitation windows at zero habitation',()=>{
 for(const active of roles){const {ship,patch}=fixture({allocation:only(active)}),r=row(ship,patch),all=pieces(r);assert.equal(r.devices.length>0,active!=='weapons');assert.ok(r.devices.every(d=>d.role===active));
  for(const q of all)if(q.role!=null)assert.equal(q.role,active,'foreground category cues must have an installed functional owner');
  const features=all.map(q=>q.feature||'');for(const [role,pattern]of [['cooling',/cooling-/],['sensors',/sensor-/],['habitation',/habitation-/]])assert.equal(features.some(s=>pattern.test(s)),role===active,active+' face has incorrect '+role+' cues');
  assert.equal(C.surfaceDerivedFits(ship).some(f=>f.surfacePatch===patch.id&&!f.surfaceUnplaced),active==='weapons','weapon cues must remain real native guns rather than duplicated decorative barrels');if(active!=='weapons')assert.ok(features.every(s=>!/gun-/.test(s)));
  const mesh=G.meshSurfaceLayers(ship,{}).surfaceDevices;let windows=0;for(let i=3;i<mesh.n*4;i+=4)if(mesh.col[i]===253)windows++;assert.equal(windows>0,active==='habitation','only installed habitation may generate window material');
 }
});

test('seed and visual quality change no native IDs or functional values and preserve deterministic base geometry',()=>{
 const {ship,patch}=fixture(),before=asStats(ship),model=C.publicJSON(ship),a=row(ship,patch,{detail:2,maxDetails:29}),b=row(ship,patch,{detail:0,maxDetails:0});
 assert.deepEqual(plain(a.field),plain(b.field));assert.deepEqual(plain(a.devices.map(q=>q.hardware)),plain(b.devices.map(q=>q.hardware)));assert.deepEqual(plain(a),plain(row(ship,patch,{detail:2,maxDetails:29})));
 G.meshSurfaceLayers(ship,{}, {detail:0});G.fleetGeometry(ship);assert.equal(C.publicJSON(ship),model);assert.deepEqual(asStats(ship),before);
 const previous=plain(a.field);assert.equal(C.setSurfaceConfig(ship,patch.id,{style:{seed:991,density:0}}).ok,true);assert.deepEqual(asStats(ship),before);assert.notDeepEqual(plain(row(ship,patch).field),previous,'a new seed must produce another continuous field layout');
 const loaded=C.deserialize(C.serialize(ship));assert.deepEqual(asStats(loaded),before);assert.deepEqual(plain(row(loaded,patch).field),plain(row(ship,patch).field));assert.deepEqual(functional(loaded),functional(ship));
 function asStats(s){const S=C.computeStats(s);return plain({functional:functional(s),mass:S.mass,power:S.power,crew:S.crew,sensors:S.sens,habitation:S.explicitHabitationVolume});}
});

test('rendered field triangles stay on the actual patch and leave a small off-center through-hole empty',()=>{
 const {ship,patch}=fixture({allocation:{weapons:0,cooling:34,sensors:33,habitation:33},face:'top',hole:true}),mesh=G.meshSurfaceLayers(ship,{}),cut=ship.solidCuts[0],B=C.solidCutBounds(cut),uv=[];
 for(let mask=0;mask<8;mask++)uv.push(project([B[mask&1?3:0],B[mask&2?4:1],B[mask&4?5:2]],patch));const hole=[Math.min(...uv.map(q=>q[0])),Math.min(...uv.map(q=>q[1])),Math.max(...uv.map(q=>q[0])),Math.max(...uv.map(q=>q[1]))];
 let count=0;for(const name of ['surfaceDevices','surfaceDetail'])for(const T of triangles(mesh[name])){const p=T.map(q=>project(q,patch));assert.ok(area(clipRectangle(p,hole))<1e-5,name+' triangle crosses the actual small cutout');const center=T[0].map((_,i)=>(T[0][i]+T[1][i]+T[2][i])/3);assert.ok(C.rayTris(patch.triangles,C.add(center,C.mul(patch.normal,100)),C.mul(patch.normal,-1)),name+' triangle leaves the clipped semantic patch');count++;}assert.ok(count>100);
});

test('rotated equipment faces keep all foreground and secondary mesh vertices within the actual semantic face',()=>{
 for(const face of ['fore','port','top']){const {ship,patch}=fixture({allocation:{weapons:0,cooling:34,sensors:33,habitation:33},face,rotate:true}),mesh=G.meshSurfaceLayers(ship,{});assert.ok(row(ship,patch).field?.length>0);let checked=0;
  for(const name of ['surfaceDevices','surfaceDetail']){const g=mesh[name],seen=new Set();for(let i=0;i<g.ni;i++){const v=Array.from(g.pos.slice(g.idx[i]*3,g.idx[i]*3+3)),key=v.map(q=>q.toFixed(5)).join(',');if(seen.has(key))continue;seen.add(key);assert.ok(C.rayTris(patch.triangles,C.add(v,C.mul(patch.normal,100)),C.mul(patch.normal,-1)),face+' '+name+' vertex leaves its real face');checked++;}}assert.ok(checked>100);
 }
});

test('cross-cell field fragments keep actual gun, opening and nozzle projections clear',()=>{
 const {ship,patch}=fixture(),normal=patch.normal,at=(u,v,n=0)=>C.add(patch.center,C.add(C.mul(patch.u,u),C.add(C.mul(patch.v,v),C.mul(normal,n)))),nozzle={id:ship.nextId++,k:'engine',c:at(29,0,1),d:4,dir:normal.slice(),nozzleLength:4,bodyLength:4};ship.parts.push(nozzle);
 const bay={id:ship.nextId++,k:'hangar',c:at(0,0,-4),room:[18,12,8],d:12};ship.parts.push(bay);const hatch=C.openBay(ship,bay,'port');C.syncAviationSurfaces(ship);const opening=C.openingBounds(ship,hatch);assert.ok(opening?.every(Number.isFinite));
 assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment'}).ok,true);const r=row(ship,patch),reservations=[opening,C.partAABB(nozzle),...C.surfaceDerivedFits(ship).filter(f=>f.surfacePatch===patch.id&&!f.surfaceUnplaced).map(f=>C.fitAABB(f))].map(B=>{const uv=[];for(let k=0;k<8;k++)uv.push(project([B[k&1?3:0],B[k&2?4:1],B[k&4?5:2]],patch));return [Math.min(...uv.map(p=>p[0])),Math.min(...uv.map(p=>p[1])),Math.max(...uv.map(p=>p[0])),Math.max(...uv.map(p=>p[1]))];});
 assert.ok(C.surfaceDerivedFits(ship).some(f=>f.surfacePatch===patch.id&&!f.surfaceUnplaced));let checked=0;for(const q of [...pieces(r),...r.boxes]){if(q.role==='weapons')continue;const b=projectedBox(q,patch);for(const B of reservations)assert.ok(Math.min(b[2],B[2])-Math.max(b[0],B[0])<=1e-5||Math.min(b[3],B[3])-Math.max(b[1],B[1])<=1e-5,(q.feature||'detail')+' blocks a real gun, opening or nozzle');checked++;}assert.ok(checked>20);
});

test('field and hardware index ranges have one real owner and move with an articulated foil exactly once',()=>{
 const {ship,body,patch}=fixture({allocation:{weapons:0,cooling:34,sensors:33,habitation:33},foil:true}),ranges={},raw=G.meshSurfaceLayers(ship,ranges),r=row(ship,patch),owners=new Set([body.id,...r.devices.map(d=>d.id)]),coverage=new Uint8Array(raw.surfaceDevices.ni);
 assert.ok(r.field?.length>0);for(const [id,spans]of Object.entries(ranges))for(const [kind,start,count]of spans)if(kind==='surfaceDevices'){assert.ok(owners.has(+id),'every field fragment must belong to its host or a real native device');for(let i=start;i<start+count;i++)coverage[i]++;}
 assert.ok(coverage.length>0&&coverage.every(n=>n===1),'host field and device ranges may neither overlap nor leave ownerless geometry');
 const asset=G.fleetGeometry(ship),foil=asset.foils.find(q=>q.id===body.id);assert.ok(foil);for(const kind of ['surfaceArmor','surfaceDevices','surfaceDetail']){const moving=foil.meshes.filter(name=>foil.kinds[name]===kind);assert.equal(moving.length,1,kind+' must have one moving partition');assert.equal(asset.meshes[moving[0]].geo.ni,raw[kind].ni);assert.equal(asset.meshes[kind]?.geo.ni||0,0,kind+' must not remain as a stationary duplicate');}
});

test('constrained structural budgets retain occupied bays without enormous unrefined plates',()=>{
 const {ship,patch}=fixture({allocation:only('cooling')}),before=C.publicJSON(ship);
 for(const maxField of [96,240]){const r=row(ship,patch,{maxField,maxDetails:0}),bodies=r.field.filter(q=>['stratum-machinery','stratum-core'].includes(q.feature));assert.ok(bodies.length>=8);assert.ok(r.field.length<=maxField);
  for(const q of bodies){const b=projectedBox(q,patch);assert.ok((b[2]-b[0])*(b[3]-b[1])<patch.area*.18,'budget leaves a broad untouched wall region as one huge plate');}
 }
 assert.equal(C.publicJSON(ship),before);
});

test('a bounded field budget covers every eligible face instead of starving later faces or distant corners',()=>{
 const ship=C.newShip({L:200,W:100,H:100,assembly:true},'Fair continuous field');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=2;
 for(const x of [55,135])C.placePart(ship,'struct',[x,40,0],[48,48,48],{form:'box'},false);const patches=C.surfacePatches(ship).filter(p=>p.exposed);assert.equal(patches.length,12);
 assert.equal(C.setSurfaceConfig(ship,patches.map(p=>p.id),{functionMode:'equipment',allocation:only('cooling'),equipment:{kind:'hdis',depth:2},style:{kind:'machinery',density:.8,seed:193}}).ok,true);
 const stats=()=>{const S=C.computeStats(ship);return plain({native:functional(ship),mass:S.mass,power:S.power,crew:S.crew,sensors:S.sens,habitation:S.explicitHabitationVolume});},before=stats(),blueprint=C.publicJSON(ship),maxField=240,maxDetails=48,plan=G.surfaceVisualPlan(ship,{detail:2,maxField,maxDetails});
 const eligible=C.surfaceReport(ship).patches.filter(p=>p.config.functionMode==='equipment'&&p.exposed&&(p.exposedArea??p.area)>0);assert.equal(eligible.length,12);assert.ok(plan.reduce((n,p)=>n+(p.field?.length||0),0)<=maxField);assert.ok(plan.reduce((n,p)=>n+p.boxes.length,0)<=maxDetails);
 for(const p of eligible){const r=plan.find(q=>q.id===p.id);assert.ok(r?.field?.length>0,p.id+' was starved by earlier faces');const bounds=r.field.map(q=>projectedBox(q,r.patch)),min=r.patch._min,max=r.patch._max,width=max[0]-min[0],height=max[1]-min[1],quadrants=new Set();
  const extent=[Math.min(...bounds.map(b=>b[0])),Math.min(...bounds.map(b=>b[1])),Math.max(...bounds.map(b=>b[2])),Math.max(...bounds.map(b=>b[3]))];assert.ok(extent[2]-extent[0]>=width*.5&&extent[3]-extent[1]>=height*.5,p.id+' field stays in one corner');
  // A layered structure deliberately contains voids. Measure long structural
  // courses reaching independent regions, rather than mosaic-era solid fill.
  for(const b of bounds)for(let x=0;x<2;x++)for(let y=0;y<2;y++){const a=[min[0]+x*width/2,min[1]+y*height/2,min[0]+(x+1)*width/2,min[1]+(y+1)*height/2];if(Math.min(b[2],a[2])>Math.max(b[0],a[0])+1e-5&&Math.min(b[3],a[3])>Math.max(b[1],a[1])+1e-5)quadrants.add(x+y*2);}
  const longCourses=bounds.filter((b,i)=>r.field[i].stratum&&b[2]-b[0]>width*.5&&b[3]-b[1]<height*.12);assert.ok(longCourses.length>=3,p.id+' needs repeated connected floors across its width');assert.ok(quadrants.size>=3,p.id+' field fails to reach enough independent face regions');
 }
 assert.equal(C.publicJSON(ship),blueprint);assert.deepEqual(stats(),before,'fairer neutral distribution may not alter native IDs or functional statistics');
});
