const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=q=>JSON.parse(JSON.stringify(q));
function fixture({depth=0,rotated=false,foil=false,count=0}={}){
 const ship=C.newShip({L:240,W:160,H:120,assembly:true},'Layered renderer');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const host=C.placePart(ship,foil?'wing':'struct',[120,60,0],foil?[112,80,8]:[160,80,40],foil?{}:{form:'box',...(rotated?{yaw:29,pitch:21,roll:13,taper:.25}:{})},false);host.paint='#b04020';
 if(foil)host.wing=C.normalizeWing({...host.wing,foil:true,axis:'x',open:10,stow:50});
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face===(foil?'top':'port'));assert.ok(patch?.exposed);
 const result=C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},battery:{weapon:'pd',count},equipment:{kind:'hdis',depth:1,limit:0},style:{kind:'machinery',depth,density:.7,seed:37}});assert.equal(result.ok,true,result.why);
 return {ship,host,patch};
}
function row(ship,patch,opt={}){return G.surfaceVisualPlan(ship,opt).find(q=>q.id===patch.id);}
function triangles(g){const out=[];for(let i=0;i<g.ni;i+=3)out.push([0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))));return out;}
function neutralTriangles(ship,host,opt={}){const ranges={},g=G.meshSurfaceLayers(ship,ranges,{detail:0,maxDetails:0,...opt}).surfaceDevices,out=[];for(const [name,start,count]of ranges[host.id]||[])if(name==='surfaceDevices')for(let i=start;i<start+count;i+=3){if(g.col[g.idx[i]*4+3]===253)continue;out.push([0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))));}return out;}
function projectedArea(T,n){return T.reduce((a,t)=>a+C.dot(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])),n)/2,0);}
function inside(host,p){return C.inPart(host,p)||C.inPart(host,C.add(p,C.mul(C.norm(C.sub(host.c,p)),3e-4)));}

test('automatic relief is a shallow, coarse face mesh with broad horizontal facets',()=>{
 const {ship,host,patch}=fixture(),before=C.publicJSON(ship),r=row(ship,patch,{detail:0,maxDetails:0}),T=neutralTriangles(ship,host),m=G.meshSurfaceLayers(ship,{}, {detail:0,maxDetails:0});
 assert.equal(r.functionalDepth,1);assert.ok(r.visualDepth>0&&r.visualDepth<=4,'automatic relief must remain shallow compared with the forty-metre face');
 assert.ok(T.length>20&&T.length<1200,'a simple face must use a coarse skin rather than thousands of tiny parts');
 const broad=T.filter(t=>C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),patch.normal)>.9);assert.ok(projectedArea(broad,patch.normal)>patch.exposedArea*.5,'broad front facets must occupy most of the face rather than thin edge detail');
 const elongated=T.filter(t=>{const xs=t.map(p=>C.dot(p,r.frame.u)),ys=t.map(p=>C.dot(p,r.frame.v));return Math.max(...xs)-Math.min(...xs)>2*(Math.max(...ys)-Math.min(...ys));});assert.ok(projectedArea(elongated,patch.normal)>patch.exposedArea*.6,'most facets must extend along the face horizontally');
 for(const t of T){const n=C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])));assert.ok(C.dot(n,patch.normal)>.05,'closed boxes or perpendicular shelves must not replace the skin');}
 assert.ok(Math.abs(projectedArea(T,patch.normal)-patch.exposedArea)<patch.exposedArea*.0002,'the connected skin must cover the complete exposed face exactly once');
 for(let i=0;i<m.surfaceDevices.n;i++)assert.ok(inside(host,Array.from(m.surfaceDevices.pos.slice(i*3,i*3+3))));assert.equal(C.publicJSON(ship),before);
});

test('explicit visual depth, cosmetic density and draw budgets do not alter the saved functional source',()=>{
 const {ship,patch}=fixture({depth:4}),before=C.publicJSON(ship),low=row(ship,patch,{detail:0,maxDetails:0}),high=row(ship,patch,{detail:2,maxDetails:1800});assert.equal(low.visualDepth,4);assert.deepEqual(plain(low.field),plain(high.field));assert.equal(low.boxes.length,0);assert.ok(high.boxes.length>0);assert.equal(C.publicJSON(ship),before);
 const bounded=row(ship,patch,{maxField:160,maxDetails:0});assert.ok(bounded.field.length<=160);assert.ok(neutralTriangles(ship,ship.parts[0],{maxField:160}).length<1200);assert.deepEqual(plain(low.reliefFaces),plain(high.reliefFaces),'cosmetic detail must not retessellate the structural face');assert.equal(C.publicJSON(ship),before);
 const saved=JSON.parse(C.publicJSON(ship)),source={parts:saved.parts,fits:saved.fits};assert.equal(C.setSurfaceConfig(ship,patch.id,{style:{depth:12,density:0}}).ok,true);const deeper=row(ship,patch,{detail:0,maxDetails:0});assert.equal(deeper.visualDepth,12);const changed=JSON.parse(C.publicJSON(ship));assert.deepEqual({parts:changed.parts,fits:changed.fits},source);assert.equal(deeper.functionalDepth,1);
});

test('tilted walls keep their relief along the face and inside their tapered host',()=>{
 const {ship,host,patch}=fixture({depth:5,rotated:true}),m=G.meshSurfaceLayers(ship,{}, {detail:0,maxDetails:0}),T=neutralTriangles(ship,host);assert.ok(T.length>20);
 for(const t of T){const n=C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])));assert.ok(C.dot(n,patch.normal)>.05,'facets must follow the tilted wall instead of projecting world-horizontal slabs');}
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
