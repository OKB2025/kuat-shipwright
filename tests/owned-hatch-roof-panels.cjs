const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx);
function changedPaths(a,b,p=''){if(Object.is(a,b))return [];if(!a||!b||typeof a!=='object'||typeof b!=='object')return[p];return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>changedPaths(a[k],b[k],p+'.'+k));}
function fixture(owned,referenceSkin=false){
 const s=C.newShip({L:200,W:100,H:100,plan:'rect',sec:'rect',bowW:1,bowH:1,stern:1},'Actual roof panels');s.parts=[];s.fits=[];s.detail=0;s.autoHabitation=false;s.armor={hull:0,cit:0};
 const bay=C.placePart(s,'hangar',[100,90,0],40,{room:[40,40,40],allowOverlap:true},false),h=C.openBay(s,bay,'top','open');h.motion='slide';h.open=0;C.syncCompartments(s);
 if(referenceSkin){h.skinAsset='ven_spine';h.skinBayAnchor=Array.from(bay.c);}
 if(owned){C.ensurePrimaryHull(s);C.syncCompartments(s);}C.computeStats(s);return{s,bay,h:s.hatches.find(q=>q.bay===bay.id)};
}
function triangles(g,door,opening=0){const out=new Float32Array(g.ni*3),offset=door?door.side*door.travel*opening:0;for(let i=0;i<g.ni;i++)for(let a=0;a<3;a++)out[i*3+a]=g.pos[g.idx[i]*3+a]+(door&&a===door.axis?offset:0);return out;}
function displayed(data,h,opening){
 const pieces=[];for(const name of ['hull','struct','refHull','refStruct','hatchOpen','refHatches','hangar'])if(data.meshes[name]?.geo)pieces.push(triangles(data.meshes[name].geo));
 for(const d of data.doors)pieces.push(triangles(data.meshes[d.name].geo,d,d.hatchId===h.id?opening:0));const T=new Float32Array(pieces.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of pieces){T.set(p,offset);offset+=p.length;}return T;
}
const sample=[90,100,110].flatMap(x=>[-8,8].map(z=>[x,z]));
test('owned and legacy hull fleet doors cover the real roof when closed and clear it when open',()=>{
 const rows=[];for(const owned of [false,true]){
  const {s,h}=fixture(owned),before=C.publicJSON(s),data=G.fleetGeometry(s),closed=displayed(data,h,0),opened=displayed(data,h,1),rays=[];
  for(const [x,z]of sample){const from=[x,200,z],a=C.rayTris(closed,from,[0,-1,0]),b=C.rayTris(opened,from,[0,-1,0]);assert.ok(a);assert.ok(Math.abs(a.p[1]-100)<.5,'closed door must be at the real 100m roof, not the 90m opening sill');assert.ok(!b||b.p[1]<95,'open door must expose the actual deeper bay');rays.push(a.p[1]);}
  assert.equal(C.publicJSON(s),before,'extracting a roof must not edit the ship, hatch settings or room');rows.push(rays);
 }
 for(let i=0;i<sample.length;i++)assert.ok(Math.abs(rows[0][i]-rows[1][i])<.001,'ownership must preserve roof coverage');
});
test('rest panels come from roof material, stay independent of current opening, and follow owner transforms',()=>{
 const {s,h}=fixture(true),owner=s.parts.find(p=>p.id===h.hullOwner),before=C.publicJSON(s),raw=C.surfaceRenderClone(s),moving=raw.hatches.find(q=>q.id===h.id);moving.open=1;moving._doorDetached=true;
 const panels=C.slidingHatchPanels(raw,moving),T=Float32Array.from(panels.flatMap(p=>Array.from(p.tris)));assert.ok(T.length>0);let projected=0;
 for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9));projected+=Math.abs(C.cross(C.sub(b,a),C.sub(c,a))[1])/2;for(const p of [a,b,c])assert.ok(Math.abs(p[1]-100)<.001,'sill caps and hole walls cannot become the sliding roof');}
 const b=C.openingBounds(raw,moving);assert.ok(Math.abs(projected-(b[3]-b[0])*(b[5]-b[2]))<.01,'two halves cover the full original roof footprint');
 moving.open=0;delete moving._doorDetached;const closed=C.slidingHatchPanels(raw,moving);assert.deepEqual(closed.map(p=>Array.from(p.tris)),panels.map(p=>Array.from(p.tris)),'rest geometry must not depend on the current animation pose');
 owner.c[1]+=12;C.syncHullHatches?.(s,owner);const shifted=G.fleetGeometry(s),hit=C.rayTris(displayed(shifted,h,0),[100,220,8],[0,-1,0]);assert.ok(hit&&Math.abs(hit.p[1]-112)<.5,'owner movement invalidates the source cache and carries the roof');
 owner.c[1]-=12;C.hullStructureGeometry(s,owner);assert.deepEqual(changedPaths(JSON.parse(C.publicJSON(s)),JSON.parse(before)),[],'synchronizing the restored owner also restores its public hatch handles');
});
test('owned fleet bodies contain one roof layer outside the opening, without a permanently parked door copy',()=>{
 const region=[85,99.99,-31,115,100.01,-20],expected=(region[3]-region[0])*(region[5]-region[2]);
 for(const owned of [false,true]){const {s}=fixture(owned),before=C.publicJSON(s),data=G.fleetGeometry(s),g=data.meshes[owned?'struct':'hull'].geo;let area=0;
  for(let i=0;i<g.ni;i+=3){const p=C.clipOpening([0,1,2].map(j=>Array.from(g.pos.subarray(g.idx[i+j]*3,g.idx[i+j]*3+3))),region);let signed=0;for(let j=0;j<p.length;j++)signed+=p[j][0]*p[(j+1)%p.length][2]-p[(j+1)%p.length][0]*p[j][2];area+=Math.abs(signed)/2;}
  assert.ok(Math.abs(area-expected)<.001,'the static body must contain only its original roof area, not another translated panel');assert.equal(C.publicJSON(s),before,'detachment stays inside the private render clone');
 }
});
test('owned authored reference door halves remain complete after moving skins are detached from the body',()=>{
 const rows=[];for(const owned of [false,true]){const {s,h}=fixture(owned,true),before=C.publicJSON(s),data=G.fleetGeometry(s),doors=data.doors.filter(d=>d.hatchId===h.id),meshes=doors.map(d=>data.meshes[d.name].geo);
  assert.equal(doors.length,2);assert.ok(meshes.every(g=>g.ni>0),'detaching the owned local skin cannot empty the animated reference halves');assert.equal(data.meshes.refHatches.geo.ni,0,'animated reference skin must not remain parked in the static body');
  rows.push(meshes.map(g=>({indices:g.ni,bounds:[0,1,2].flatMap(a=>{const values=[];for(let i=0;i<g.ni;i++)values.push(g.pos[g.idx[i]*3+a]);return[Math.min(...values),Math.max(...values)];})})));assert.equal(C.publicJSON(s),before);
 }
 assert.deepEqual(rows[1],rows[0],'ownership preserves the complete original reference skins and their rest pose');
});
