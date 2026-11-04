const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const {primarySurfaceLayers}=require('./helpers/surface-geometry.cjs');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=q=>JSON.parse(JSON.stringify(q));
function fixture({depth=0,rotated=false,foil=false,count=0,length=160}={}){
 const ship=C.newShip({L:240,W:160,H:120,assembly:true},'Layered renderer');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const host=C.placePart(ship,foil?'wing':'struct',[120,60,0],foil?[112,80,8]:[length,80,40],foil?{}:{form:'box',...(rotated?{yaw:29,pitch:21,roll:13,taper:.25}:{})},false);host.paint='#b04020';
 if(foil)host.wing=C.normalizeWing({...host.wing,foil:true,axis:'x',open:10,stow:50});
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face===(foil?'top':'port'));assert.ok(patch?.exposed);
 const result=C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},battery:{weapon:'pd',count},equipment:{kind:'hdis',depth:1,limit:0},style:{kind:'machinery',depth,density:.7,seed:37}});assert.equal(result.ok,true,result.why);
 return {ship,host,patch};
}
function row(ship,patch,opt={}){return G.surfaceVisualPlan(ship,opt).find(q=>q.id===patch.id);}
function triangles(g){const out=[];for(let i=0;i<g.ni;i+=3)out.push([0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))));return out;}
function neutralTriangles(ship,host,opt={}){const ranges={},g=G.meshSurfaceLayers(ship,ranges,{detail:0,maxDetails:0,...opt}).surfaceDevices,out=[];for(const [name,start,count,meta]of ranges[host.id]||[])if(name==='surfaceDevices'&&!meta?.projection)for(let i=start;i<start+count;i+=3){if(g.col[g.idx[i]*4+3]===253)continue;out.push([0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))));}return out;}
function projectedArea(T,n){return T.reduce((a,t)=>a+C.dot(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])),n)/2,0);}
function inside(host,p){return C.inPart(host,p)||C.inPart(host,C.add(p,C.mul(C.norm(C.sub(host.c,p)),3e-4)));}

test('automatic relief combines shallow machinery masses with broad horizontal runs',()=>{
 const {ship,host,patch}=fixture(),before=C.publicJSON(ship),r=row(ship,patch,{detail:0,maxDetails:0}),T=neutralTriangles(ship,host),m=primarySurfaceLayers(G,ship,{detail:0,maxDetails:0});
 assert.equal(r.functionalDepth,1);assert.ok(r.visualDepth>0&&r.visualDepth<=8,'automatic block relief must stay inside a bounded fraction of the forty-metre host');
 assert.ok(T.length>20&&T.length<1200,'a simple face must use a coarse skin rather than thousands of tiny parts');
 const broad=T.filter(t=>C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),patch.normal)>.9);assert.ok(projectedArea(broad,patch.normal)>patch.exposedArea*.5,'broad front facets must occupy most of the face rather than thin edge detail');
 const elongated=T.filter(t=>{const xs=t.map(p=>C.dot(p,r.frame.u)),ys=t.map(p=>C.dot(p,r.frame.v));return Math.max(...xs)-Math.min(...xs)>2*(Math.max(...ys)-Math.min(...ys));});assert.ok(projectedArea(elongated,patch.normal)>patch.exposedArea*.25,'horizontal beams must remain substantial alongside compact cabinets and upright machinery');
 for(const t of T){const n=C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])));assert.ok(C.dot(n,patch.normal)>0,'the clipped plate skin must not introduce backward-facing facets');}
 assert.ok(Math.abs(projectedArea(T,patch.normal)-patch.exposedArea)<patch.exposedArea*.0002,'the connected skin must cover the complete exposed face exactly once');
 for(let i=0;i<m.surfaceDevices.n;i++)assert.ok(inside(host,Array.from(m.surfaceDevices.pos.slice(i*3,i*3+3))));assert.equal(C.publicJSON(ship),before);
});

test('explicit visual depth, cosmetic density and draw budgets do not alter the saved functional source',()=>{
 const {ship,patch}=fixture({depth:4}),before=C.publicJSON(ship),low=row(ship,patch,{detail:0,maxDetails:0}),high=row(ship,patch,{detail:2,maxDetails:1800});assert.equal(low.visualDepth,4);assert.deepEqual(plain(low.field),plain(high.field));assert.equal(low.boxes.length,0);assert.ok(high.boxes.length>0);assert.equal(C.publicJSON(ship),before);
 const bounded=row(ship,patch,{maxField:160,maxDetails:0});assert.ok(bounded.field.length<=160);assert.ok(neutralTriangles(ship,ship.parts[0],{maxField:160}).length<1200);assert.deepEqual(plain(low.reliefFaces),plain(high.reliefFaces),'cosmetic detail must not retessellate the structural face');assert.equal(C.publicJSON(ship),before);
 const saved=JSON.parse(C.publicJSON(ship)),source={parts:saved.parts,fits:saved.fits};assert.equal(C.setSurfaceConfig(ship,patch.id,{style:{depth:12,density:0}}).ok,true);const deeper=row(ship,patch,{detail:0,maxDetails:0});assert.equal(deeper.visualDepth,12);const changed=JSON.parse(C.publicJSON(ship));assert.deepEqual({parts:changed.parts,fits:changed.fits},source);assert.equal(deeper.functionalDepth,1);
});

test('tilted walls keep their relief along the face and inside their tapered host',()=>{
 const {ship,host,patch}=fixture({depth:5,rotated:true}),m=primarySurfaceLayers(G,ship,{detail:0,maxDetails:0}),T=neutralTriangles(ship,host);assert.ok(T.length>20);
 for(const t of T){const n=C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])));assert.ok(C.dot(n,patch.normal)>0,'facets must follow the tilted host frame');}
 for(const g of [m.surfaceDevices,m.surfaceDetail])for(let i=0;i<g.n;i++)assert.ok(inside(host,Array.from(g.pos.slice(i*3,i*3+3))),'a face relief vertex escaped its actual host');
});

test('semantic siblings share floor levels and omit their artificial recessed divider',()=>{
 const {ship,patch}=fixture({depth:4}),levels=row(ship,patch).strata.map(q=>q.level),split=C.surfaceSplit(ship,patch.id,'u',.43);assert.equal(split.ok,true,split.why);
 const rows=G.surfaceVisualPlan(ship).filter(q=>split.ids.includes(q.id)),newLevels=rows.flatMap(q=>q.strata.map(q=>q.level));assert.deepEqual([...new Set(newLevels)].sort((a,b)=>a-b),[...new Set(levels)].sort((a,b)=>a-b));
 assert.ok(rows.reduce((n,q)=>n+q.revealBoundary.length,0)<rows.reduce((n,q)=>n+q.boundary.length,0),'an editable split is not a new supporting wall');
 const seam=40+160*.43,mesh=G.meshSurfaceLayers(ship,{}),area=triangles(mesh.surfaceArmor).filter(t=>t.every(p=>Math.abs(p[0]-seam)<.001)).reduce((n,t)=>n+C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2,0);assert.ok(area<.01,'no recessed wall triangles may remain at the shared semantic seam');
});

test('layered surfaces retain foil ownership exactly once and share cached whole-face meshes',()=>{
 const {ship,host,patch}=fixture({depth:2,foil:true}),before=C.publicJSON(ship),first=G.meshSurfaceLayers(ship,{}),again=G.meshSurfaceLayers(ship,{}),asset=G.fleetGeometry(ship,{trial:true}),foil=asset.foils.find(q=>q.id===host.id);assert.ok(foil);assert.ok(row(ship,patch).strata.length>3,'horizontal equipment faces must retain the structural band fallback');assert.equal(first.surfaceDevices,again.surfaceDevices);
 for(const kind of ['surfaceDevices','surfaceDetail']){const names=foil.meshes.filter(n=>foil.kinds[n]===kind);assert.equal(names.length,first[kind].ni?1:0,kind);if(first[kind].ni)assert.equal(asset.meshes[names[0]].geo.ni,first[kind].ni,kind);assert.equal(asset.meshes[kind]?.geo.ni||0,0,kind+' must not retain a stationary duplicate');}assert.equal(C.publicJSON(ship),before);
});


// Reconstruct connected flat front regions from emitted triangles. These are
// geometric measurements, independent of the procedural feature names.
function frontRegions(T,patch){
 const flat=T.filter(t=>C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),patch.normal)>.9999),parents=flat.map((_,i)=>i),edges=new Map(),key=p=>p.map(x=>x.toFixed(4)).join(','),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
 for(let i=0;i<flat.length;i++)for(let j=0;j<3;j++){const edge=[key(flat[i][j]),key(flat[i][(j+1)%3])].sort().join('|'),other=edges.get(edge);if(other==null)edges.set(edge,i);else parents[find(i)]=find(other);}
 const groups=new Map();for(let i=0;i<flat.length;i++){const id=find(i);if(!groups.has(id))groups.set(id,[]);groups.get(id).push(flat[i]);}
 const limits=axis=>[Math.min(...patch.polygon.map(p=>C.dot(p,axis))),Math.max(...patch.polygon.map(p=>C.dot(p,axis)))],[u0,u1]=limits(patch.u),[v0,v1]=limits(patch.v);
 return [...groups.values()].map(tris=>{const ps=tris.flat(),us=ps.map(p=>C.dot(p,patch.u)),vs=ps.map(p=>C.dot(p,patch.v)),loU=Math.min(...us),hiU=Math.max(...us),loV=Math.min(...vs),hiV=Math.max(...vs);return {loU,hiU,loV,hiV,w:hiU-loU,h:hiV-loV,area:projectedArea(tris,patch.normal),height:C.dot(ps[0],patch.normal),boundary:Math.min(Math.abs(loU-u0),Math.abs(hiU-u1),Math.abs(loV-v0),Math.abs(hiV-v1))<.002};}).filter(r=>r.area>2);
}

test('deck blocks overlap recessed texture-backed machinery bays instead of full-width rails',()=>{
 const {ship,host,patch}=fixture({depth:4}),T=neutralTriangles(ship,host),r=row(ship,patch),g=G.meshSurfaceLayers(ship,{}).surfaceDevices;
 const dots=T.flat().map(p=>C.dot(p,patch.normal)),lo=Math.min(...dots),hi=Math.max(...dots);assert.ok(hi-lo>1,'deck edges must have actual depth above recessed machinery');
 const normals=T.map(t=>C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))));assert.ok(normals.some(n=>C.dot(n,r.frame.v)>.98)&&normals.some(n=>C.dot(n,r.frame.v)<-.98),'thin plates need real top and underside facets, not broad slanted ramps');
 const faces=r.reliefFaces,area=q=>projectedArea(Array.from({length:q.triangles.length/9},(_,i)=>[0,3,6].map(j=>q.triangles.slice(i*9+j,i*9+j+3))),patch.normal);
 assert.ok(faces.filter(q=>q.machinery).reduce((n,q)=>n+area(q),0)>patch.exposedArea*.6,'most of the facade must be flat, texture-backed gaps between decks');
 const u=C.dot(patch.center,r.frame.u),vs=patch.polygon.map(p=>C.dot(p,r.frame.v)),low=Math.min(...vs),high=Math.max(...vs),samples=[];
 for(let i=0;i<800;i++){
  const p=C.add(C.add(C.mul(r.frame.u,u),C.mul(r.frame.v,low+(high-low)*(i+.5)/800)),C.mul(patch.normal,hi+10)),hit=C.rayTris(T.flat(2),p,C.mul(patch.normal,-1));assert.ok(hit);samples.push(C.dot(hit.p,patch.normal));
 }
 const raised=samples.map(h=>h>lo+(hi-lo)*.4),bands=raised.filter((q,i)=>q&&!raised[i-1]).length;
 assert.ok(bands>=3,'several real ledges must remain readable at cosmetic detail zero');assert.ok(raised.filter(Boolean).length<samples.length*.65,'thicker deck blocks must still leave visible machinery gaps');
 assert.ok(Array.from(g.col.slice(0,g.n*4)).some((x,i)=>i%4===3&&x===250),'actual emitted machinery triangles use the shared texture material');
 assert.ok(Array.from(g.col.slice(0,g.n*4)).some((x,i)=>i%4===3&&x===249),'actual deck triangles retain plain host-colored material');
});

test('deck plates are thicker, staggered and set back independently without retiming on reload',()=>{
 const {ship,host,patch}=fixture({depth:4}),T=neutralTriangles(ship,host),r=row(ship,patch),regions=frontRegions(T,patch),back=Math.min(...regions.map(q=>q.height)),plates=regions.filter(q=>!q.boundary&&q.height>back+.12&&q.w>q.h*3);
 assert.ok(plates.length>=4,'actual separate plate fronts must replace uninterrupted face-wide rails');
 const median=xs=>xs.sort((a,b)=>a-b)[Math.floor(xs.length/2)];assert.ok(median(plates.map(q=>q.h))>=r.layerPitch*.09,'deck thickness must visibly exceed the old four-percent-pitch lip');
 const unique=xs=>new Set(xs.map(x=>x.toFixed(1))).size;
 assert.ok(unique(plates.map(q=>q.height))>=3,'neighboring plates must have several actual fore/aft setbacks');
 assert.ok(unique(plates.map(q=>q.w))>=3,'plate runs need different lengths rather than copies of one strip');
 assert.ok(plates.some((a,i)=>plates.slice(i+1).some(b=>Math.min(a.hiU,b.hiU)-Math.max(a.loU,b.loU)>Math.min(a.w,b.w)*.5&&Math.abs(a.height-b.height)>.15&&(a.hiV<b.loV||b.hiV<a.loV))),'stacked plates must overlap in plan with different fore/aft setbacks');
 // Front rectangles are recovered from the emitted positions, not feature labels.
 const fronts=r.reliefFaces.filter(q=>!q.machinery).flatMap(q=>Array.from({length:q.triangles.length/9},(_,i)=>[0,3,6].map(j=>q.triangles.slice(i*9+j,i*9+j+3)))).filter(t=>C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),patch.normal)>.9999);
 const starts=fronts.map(t=>Math.min(...t.map(p=>C.dot(p,r.frame.u))));assert.ok(unique(starts)>=5,'longitudinal start positions must vary across stacked rows');
 const before=C.publicJSON(ship);neutralTriangles(ship,host);assert.equal(C.publicJSON(ship),before,'rendering cannot change the saved design');const loaded=C.deserialize(C.serialize(ship));assert.deepEqual(neutralTriangles(loaded,loaded.parts.find(p=>p.id===host.id)),T,'seeded overlaps must be identical after saving and loading');
});


test('block stacks mix short and medium decks with substantial thickness and depth steps',()=>{
 const {ship,host,patch}=fixture({depth:4,length:480}),r=row(ship,patch),regions=frontRegions(neutralTriangles(ship,host),patch),back=Math.min(...regions.map(q=>q.height)),plates=regions.filter(q=>!q.boundary&&q.height>back+.12&&q.w>q.h*2);
 assert.ok(plates.length>=6,'a wide face needs multiple independent blocks, not full-width rails');
 const widths=plates.map(q=>q.w),heights=plates.map(q=>q.h).sort((a,b)=>a-b),depths=plates.map(q=>q.height),longest=Math.max(...widths);
 assert.ok(longest<480*.65,'no interior deck may stretch nearly end to end across this face');
 assert.ok(widths.filter(w=>w<longest*.5).length>=2&&widths.some(w=>w>longest*.5&&w<longest*.8),'actual emitted geometry must include short and medium runs');
 assert.ok(heights[Math.floor(heights.length/2)]>=r.layerPitch*.38,'the median block must be substantially thicker than the earlier thin ledges');
 assert.ok(Math.max(...depths)-Math.min(...depths)>r.visualDepth*.42,'stacked blocks need substantial independent fore/aft steps');
 const auto=fixture(),autoRow=row(auto.ship,auto.patch);assert.ok(autoRow.visualDepth>4&&autoRow.visualDepth<=8,'automatic relief must show the requested deeper stack without exceeding its host budget');assert.equal(r.visualDepth,4,'an explicit visual depth remains authoritative');assert.equal(r.functionalDepth,1,'visual exaggeration must not enlarge functional reservations');
});
