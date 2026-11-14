const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(__dirname,'..');
function runtime(){const ctx=vm.createContext({console,performance});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});return vm.runInContext('({C:Core,G:Gfx})',ctx);}
function fixture(C){const s=C.newShip({L:100,W:100,H:80,assembly:true});s.parts=[{id:1,k:'struct',form:'box',c:[30,5,0],s:[20,10,10]},{id:2,k:'struct',form:'box',c:[30,30,0],s:[20,10,10]}];s.fits=[];s.hatches=[];return s;}
const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<=eps,`${a} != ${b}`);

test('a parent-scoped ray uses the chosen real structure even behind another one',()=>{
 const {C,G}=runtime(),s=fixture(C),o=[30,60,0],d=[0,-1,0];
 assert.equal(C.surfacePick(s,o,d).host,'p2');
 const hits=G.structureSurfaceCandidates(s,o,d,1);assert.ok(hits.length>=2);
 assert.ok(hits.every(h=>h.parentStructureId===1&&h.host==='p1'&&h.part.id===1));
 near(hits[0].point[1],10);near(hits[0].distance,50);assert.equal(hits[0].hostSurfaceId,hits[0].id);
 assert.notEqual(hits[0].hostSurfaceId,hits[1].hostSurfaceId,'front and rear depth candidates retain separate semantic faces');
 assert.equal(hits[0].face,'top');assert.equal(hits.at(-1).face,'bottom');
 const ids=Array.from(hits,h=>h.id);s.parts.reverse();assert.deepEqual(Array.from(G.structureSurfaceCandidates(s,o,d,1),h=>h.id),ids,'array order is not the face identity');
});

test('a missing parent, missed parent, stale face or wrong parent never falls back',()=>{
 const {C,G}=runtime(),s=fixture(C),o=[30,60,0],d=[0,-1,0],top=G.structureSurfaceCandidates(s,o,d,1)[0];
 for(const parent of [undefined,null,999,'hull'])assert.equal(G.structureSurfaceCandidates(s,o,d,parent).length,0);
 assert.equal(G.structureSurfaceCandidates(s,[100,60,0],d,1).length,0);
 assert.equal(G.structureSurfaceCandidates(s,o,d,2,{surfaceId:top.id}).length,0);
 assert.equal(G.structureSurfaceCandidates(s,o,d,1,{surfaceId:'p1:top:0:removed'}).length,0);
 assert.equal(G.structureSurfaceCandidates(s,o,d,1,{maxDistance:49}).length,0);
 assert.equal(G.structureSurfaceCandidates(s,o,[0,0,0],1).length,0);
 assert.equal(G.structureSurfaceCandidates(s,[NaN,0,0],d,1).length,0);
});

test('a through-cut in the chosen parent stays a missed ray even with a different structure behind it',()=>{
 const {C,G}=runtime(),s=fixture(C);s.parts[1].c=[30,-20,0];
 s.solidCuts=[C.normalizeSolidCut({id:3,shape:'box',c:[30,5,0],s:[4,4,30],structures:true})];
 s.parts[0]._solidCutShip=s;
 assert.equal(G.structureSurfaceCandidates(s,[30,60,0],[0,-1,0],1).length,0,'the removed material cannot be picked');
 const behind=G.structureSurfaceCandidates(s,[30,60,0],[0,-1,0],2);assert.ok(behind.length>0);assert.equal(behind[0].host,'p2');
 assert.ok(G.structureSurfaceCandidates(s,[37,60,0],[0,-1,0],1).length>0,'the uncut part of the same parent remains selectable');
});

test('client picking and diagnostics only read the Worker survey and never run a whole-ship exposure pass',()=>{
 const {C,G}=runtime(),s=fixture(C),surfaces=C.surfacePatches(s,true);s._client=true;s._geoProxy={surfaces,surfacePartitions:JSON.stringify(null)};
 C.surfacePatches=()=>{throw new Error('a pointer event must not rebuild the ship');};
 assert.ok(G.structureSurfaceCandidates(s,[30,60,0],[0,-1,0],1).length>0);
 assert.equal(G.placementSurfaceCandidates(s,[30,60,0],[0,-1,0])[0].parentStructureId,2);
 assert.ok(G.placementDiagnosticLines(s,{parentStructureId:1,status:'pending'}).pos.length>0);
 s._geoProxy.surfacePartitions='outdated';assert.equal(G.structureSurfaceCandidates(s,[30,60,0],[0,-1,0],1).length,0);
 delete s._geoProxy;assert.equal(G.structureSurfaceCandidates(s,[30,60,0],[0,-1,0],1).length,0);
 assert.equal(G.placementSurfaceCandidates(s,[30,60,0],[0,-1,0]).length,0);
 assert.equal(G.placementDiagnosticLines(s,{parentStructureId:1,status:'pending'}).pos.length,0);
});

test('the tapped nearest structure becomes the parent and a deeper parent requires an explicit depth choice',()=>{
 const {C,G}=runtime(),s=fixture(C),o=[30,60,0],d=[0,-1,0],hits=G.placementSurfaceCandidates(s,o,d);assert.ok(hits.length>=4);assert.equal(hits[0].parentStructureId,2);assert.equal(hits[0].host,'p2');near(hits[0].p[1],35);
 const depth=hits.findIndex(h=>h.parentStructureId===1);assert.ok(depth>0);for(const Renderer of [G.Renderer,G.CompatRenderer]){const view={ray:()=>({o,d})},pick=Renderer.prototype.pickPlacementSurface.bind(view);assert.equal(pick(0,0,s).parentStructureId,2);assert.equal(pick(0,0,s,{depthIndex:depth}).parentStructureId,1);assert.equal(pick(0,0,s,{excludePartId:2}).parentStructureId,1);assert.equal(pick(0,0,s,{depthIndex:100}),null);}
 assert.equal(G.placementSurfaceCandidates(s,o,d,{surfaceId:'removed:face'}).length,0,'a stale tapped face cannot be silently replaced');
 s.parts[0].c[0]=5;assert.equal(G.placementSurfaceCandidates(s,[5,60,0],d)[0].parentStructureId,1,'the next tap chooses its own parent rather than retaining a previous parent');
});

test('surface placement receives the exact tapped face, point and triangle normal on a rotated structure',()=>{
 const {C,G}=runtime(),s=fixture(C);s.parts=[{id:1,k:'struct',form:'box',c:[30,20,0],s:[40,30,20],yaw:21,pitch:13,roll:17}];s.nextId=2;const parent=s.parts[0],patch=C.surfacePatches(s,true).find(p=>p.host==='p1'&&p.face==='top'),T=patch.exposedTriangles??patch.triangles,a=Array.from(T.slice(0,3)),b=Array.from(T.slice(3,6)),c=Array.from(T.slice(6,9)),point=a.map((n,i)=>n*.2+b[i]*.3+c[i]*.5),normal=C.norm(C.cross(C.sub(b,a),C.sub(c,a))),o=C.add(point,C.mul(normal,5)),d=C.mul(normal,-1),tap=G.placementSurfaceCandidates(s,o,d)[0];
 assert.ok(tap);assert.equal(tap.parentStructureId,1);assert.equal(tap.hostSurfaceId,patch.id);tap.p.forEach((n,i)=>near(n,point[i]));assert.ok(C.dot(tap.n,normal)>.999999);assert.ok(C.len(C.sub(tap.p,patch.center))>.1,'the tap remains distinct from the face centre');
 const placed=C.solvePlacement(s,{id:-1,k:'struct',form:'box',c:[0,0,0],s:[2,2,2]},{mode:'surface',parentStructureId:tap.parentStructureId,hostSurfaceId:tap.hostSurfaceId,hit:{p:tap.p,n:tap.n,kind:tap.kind}});assert.equal(placed.ok,true,placed.error);assert.equal(placed.part.placement.hostSurfaceId,patch.id);const anchor=C.worldStruct(parent,placed.part.placement.surfaceAnchor);anchor.forEach((n,i)=>near(n,point[i]));assert.ok(C.dot(C.structFrame(placed.part).up,normal)>.999999);
});

test('parent selection uses mesh geometry rather than its bounding box and preserves normals',()=>{
 const {C,G}=runtime(),s=fixture(C);s.parts=[{id:1,k:'struct',form:'trap',c:[30,5,0],s:[20,20,10],angles:[40,0,0,0],yaw:27,pitch:13,roll:7}];
 const p=s.parts[0],tri=C.structTriangles(p);let found=false;
 for(let i=0;i<tri.length;i+=9){const a=Array.from(tri.slice(i,i+3)),b=Array.from(tri.slice(i+3,i+6)),c=Array.from(tri.slice(i+6,i+9)),n=C.norm(C.cross(C.sub(b,a),C.sub(c,a))),q=C.mul(C.add(C.add(a,b),c),1/3),o=C.add(q,C.mul(n,2)),d=C.mul(n,-1),hit=G.structureSurfaceCandidates(s,o,d,1)[0];if(!hit)continue;near(hit.distance,2,3e-5);assert.ok(C.dot(hit.n,n)>.999);found=true;}
 assert.equal(found,true);
});

test('renderer and fallback expose explicit depth choices and clear diagnostics without touching the camera',()=>{
 const {C,G}=runtime(),s=fixture(C),lines={},cam={target:[5,10,15],th:.3,ph:1,r:100},r={cam,ray:()=>({o:[30,60,0],d:[0,-1,0]}),setLines:(name,data)=>lines[name]=data};
 for(const Renderer of [G.Renderer,G.CompatRenderer]){
  const pick=Renderer.prototype.pickStructureSurface.bind(r),before=JSON.stringify(cam),first=pick(0,0,s,1),second=pick(0,0,s,1,{depthIndex:1});
  assert.ok(first&&second);assert.notEqual(first.hostSurfaceId,second.hostSurfaceId);assert.ok(first.distance<second.distance);
  assert.equal(pick(0,0,s,1,{depthIndex:100}),null);assert.equal(JSON.stringify(cam),before);
  Renderer.prototype.setPlacementDiagnostics.call(r,s,{parentStructureId:1,part:s.parts[0],surfaceId:first.id,contactSide:'bottom',status:'pending'});
  assert.ok(lines['placement-diagnostics'].pos.length>0);assert.equal(JSON.stringify(cam),before);
  Renderer.prototype.setPlacementDiagnostics.call(r,s,null);assert.equal(lines['placement-diagnostics'].pos.length,0);
 }
});

test('diagnostic outlines use effective clipped triangles and distinguish strict status',()=>{
 const {C,G}=runtime(),s=fixture(C),T=new Float32Array([1,2,3,4,2,3,1,5,3]),p={...s.parts[0],_clip:{tris:T,volume:4.5}};
 const outline=G.lineSet();outline.part(p,[1,2,3,255]);assert.equal(outline.out().pos.length,18);assert.ok(Array.from(outline.out().pos).every(v=>v<=5));
 const state=status=>G.placementDiagnosticLines(s,{part:p,status}),pending=state('pending'),valid=state('valid'),invalid=state('invalid');
 assert.deepEqual(Array.from(pending.pos),Array.from(valid.pos));assert.deepEqual(Array.from(valid.pos),Array.from(invalid.pos));
 assert.deepEqual(Array.from(pending.col.slice(0,4)),[105,195,220,255]);assert.deepEqual(Array.from(valid.col.slice(0,4)),[95,196,138,255]);assert.deepEqual(Array.from(invalid.col.slice(0,4)),[236,106,92,255]);
 const contact=G.placementDiagnosticLines(s,{effectiveTriangles:T,contactTriangles:T,contactPoints:[[1,2,3]],status:'valid'});assert.ok(contact.pos.length>36);
});

test('the translucent ghost contains exactly the effective mesh rather than its requested box',()=>{
 const {C,G}=runtime(),s=fixture(C),p=s.parts[0],T=new Float32Array([1,2,3,4,2,3,1,5,3]),before=C.publicJSON(s);
 const mesh=G.placementGhostMesh(s,{part:p,effectiveTriangles:T,status:'pending'});assert.equal(mesh.ni,3);assert.equal(mesh.n,3);assert.deepEqual(Array.from(mesh.pos.slice(0,mesh.n*3)),Array.from(T));
 assert.equal(C.publicJSON(s),before,'preview generation cannot commit or reshape the design');
 const packed={...p,_packing:{tris:T,volume:4.5,boxes:[[0,0,0,100,100,100]]}},shape=G.placementGhostMesh(s,{part:packed,status:'valid'});assert.deepEqual(Array.from(shape.pos.slice(0,shape.n*3)),Array.from(T));
 assert.equal(G.placementGhostMesh(s,null).ni,0);assert.equal(G.placementGhostMesh(s,{part:p,showMesh:false}).ni,0);
});

// 2026-11-13 user decision: no fitting. Until then a native hull placed as a child was fitted and rendered and outlined
// from its effective (fitted) triangles, never its reference skin. Now it keeps its own hull, so it renders exactly like
// the same hull without placement: the same section outline and its reference skin.
test('a native hull placed as a child keeps its own hull and renders like the same hull without placement',()=>{
 const {C,G}=runtime(),s=fixture(C);s.parts=[{id:1,k:'struct',form:'box',c:[30,5,0],s:[80,80,20],roll:10}];s.nextId=2;
 const hull={L:10,W:10,H:10,sec:'rect',plan:'rect',bowW:1,bowH:1,stern:1,bowFree:true,stations:[[0,1,1],[1,1,1]]},input={id:2,k:'struct',form:'hull',c:[0,0,0],s:[10,10,10],hullProfile:hull,hullData:{cuts:[],trenches:[],solidCuts:[],subs:[],hatches:[],hullSkin:{enabled:true,asset:'cr90_stl_hull',base:{hull:JSON.parse(JSON.stringify(hull)),trenches:[],cuts:[]}}}},result=C.solvePlacement(s,input,{mode:'horizontal',parentStructureId:1,hit:C.rayPart([30,100,0],[0,-1,0],s.parts[0])});assert.equal(result.ok,true,result.error);
 const p=result.part;assert.equal(p._placementGeometry,undefined);
 const outline=G.lineSet();outline.part(p,[105,195,220,255]);const legacy=JSON.parse(C.publicJSON(p));delete legacy.placement;const oldOutline=G.lineSet();oldOutline.part(legacy,[105,195,220,255]);
 assert.equal(outline.out().pos.length,oldOutline.out().pos.length,'the same section outline');
 assert.ok(G.meshReferenceParts(s,null,[p]).refStruct.ni>0,'its reference skin renders');assert.ok(G.meshReferenceParts(s,null,[legacy]).refStruct.ni>0,'an unchanged legacy reference skin still renders');
});

test('strict fitting ghosts and outlines reuse the mounted turret, pedestal and actual ray geometry',()=>{
 const {C,G}=runtime(),s=fixture(C),fit=C.mountFit(s,{id:7,k:'pd',p:[30,10,0],n:[0,1,0],a:2,ped:3,base:0,low:0,assetYaw:17,mountMode:'top'}),mesh=G.placementFittingMesh(s,fit),sources=[G.meshFits(s,null,null,[fit]),G.meshReferenceFits(s,null,[fit])];assert.ok(mesh.ni>36);assert.equal(mesh.ni,sources.reduce((n,g)=>n+g.ni,0));
 const active=g=>Array.from(g.pos.slice(0,g.n*3));assert.deepEqual(active(mesh),sources.flatMap(active),'the ghost uses the same body and support vertices as the installed equipment');
 const ghost=G.placementGhostMesh(s,{fit,status:'valid'}),alternate=G.placementGhostMesh(s,{list:'fits',part:fit,status:'pending'});assert.deepEqual(active(ghost),active(mesh));assert.deepEqual(active(alternate),active(mesh));assert.deepEqual(Array.from(ghost.col.slice(0,4)),[95,196,138,255]);assert.deepEqual(Array.from(alternate.col.slice(0,4)),[105,195,220,255]);
 const outline=G.lineSet();outline.fit(fit,[236,106,92,255],s);assert.equal(outline.out().pos.length,mesh.ni*6);assert.ok(Math.min(...active(mesh).filter((n,i)=>i%3===1))<C.fitOrigin(fit)[1],'the real pedestal extends below the fitting mount');
 const T=new Float32Array(mesh.ni*3);for(let i=0;i<mesh.ni;i++)T.set(mesh.pos.subarray(mesh.idx[i]*3,mesh.idx[i]*3+3),i*3);let compared=false;for(let i=0;i<T.length&&!compared;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9)),n=C.norm(C.cross(C.sub(b,a),C.sub(c,a)));if(C.len(n)<.5)continue;const p=C.mul(C.add(C.add(a,b),c),1/3),o=C.add(p,C.mul(n,2)),d=C.mul(n,-1),expected=C.rayTris(T,o,d),actual=G.rayFit(o,d,fit);assert.ok(expected&&actual);near(actual.t,expected.t);compared=true;}assert.equal(compared,true);
 const before=active(mesh);fit.assetYaw+=35;assert.notDeepEqual(active(G.placementFittingMesh(s,fit)),before,'editing the authored turret heading invalidates its cached ghost');
 const diagnostics=G.placementDiagnosticLines(s,{fit,parentStructureId:1,status:'valid'});assert.ok(diagnostics.pos.length>outline.out().pos.length,'the fitting and its parent both remain highlighted');
});

test('direct exterior sensor reference meshes follow the full rigid frame while legacy yaw is preserved',()=>{
 const {C,G}=runtime(),s=fixture(C),p={id:7,k:'sensor',d:12,c:[30,20,0],skinAsset:'isd_sensor_port',skinSize:[6,12,3],yaw:22,pitch:13,roll:17,surfaceNormal:C.norm([.3,.9,.2]),placement:{mode:'direct',parentStructureId:1}},raw=C.decodeReference(p.skinAsset),size=p.skinSize,scale=p.d/Math.max(...size),key=v=>Array.from(Float32Array.from(v)).join(','),expected=new Set();for(let i=0;i<raw.pos.length;i+=3)expected.add(key(C.worldStruct(p,Array.from(raw.pos.slice(i,i+3),(n,j)=>n*size[j]*scale))));
 const mesh=G.meshReferenceParts(s,null,[p]).refStruct;assert.ok(mesh.ni>0);for(let i=0;i<mesh.n*3;i+=3)assert.ok(expected.has(Array.from(mesh.pos.slice(i,i+3)).join(',')),'reference vertices use the same rigid basis as Core contact and picking');
 const ghost=G.placementGhostMesh(s,{part:p,status:'valid'});assert.equal(ghost.ni,mesh.ni,'the external device ghost includes its actual reference mesh');const legacy={...p};delete legacy.placement;const old=G.meshReferenceParts(s,null,[legacy]).refStruct;assert.notDeepEqual(Array.from(old.pos.slice(0,old.n*3)),Array.from(mesh.pos.slice(0,mesh.n*3)),'legacy records keep their original yaw-only pose');
});
