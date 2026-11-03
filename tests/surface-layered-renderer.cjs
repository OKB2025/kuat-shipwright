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
function horizontal(g){return triangles(g).filter(t=>{const n=C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]));return C.len(n)>1e-6&&Math.abs(n[1])/C.len(n)>1-1e-7;});}
function inside(host,p){return C.inPart(host,p)||C.inPart(host,C.add(p,C.mul(C.norm(C.sub(host.c,p)),3e-4)));}

test('automatic structural relief is deeper than functional rooms and contains real horizontal floors and occupied bays',()=>{
 const {ship,host,patch}=fixture(),before=C.publicJSON(ship),r=row(ship,patch,{detail:0,maxDetails:0}),m=G.meshSurfaceLayers(ship,{}, {detail:0,maxDetails:0});
 assert.equal(r.functionalDepth,1);assert.ok(r.visualDepth>=6,'visual structure must not be limited to one-metre functional cells');
 const flat=horizontal(m.surfaceDevices),levels=new Set(flat.filter(t=>C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2>10).map(t=>t[0][1].toFixed(3)));assert.ok(levels.size>12,'floors require actual horizontal surfaces at repeated levels');
 const masses=r.field.filter(q=>q.feature==='stratum-machinery'||q.feature==='stratum-core');assert.ok(masses.length>20);assert.ok(masses.some(q=>q.size[1]>r.layerPitch*1.5),'occasional machinery cores must span several storeys');
 assert.ok(masses.filter(q=>C.dot(C.sub(q.center,patch.center),patch.normal)+q.size[2]/2>-r.visualDepth*.25).length>masses.length*.5,'most storeys need near-front machinery, not an empty louver');
 assert.ok(!r.field.some(q=>q.feature==='service-housing'),'the attached housing mosaic must be replaced');
 for(let i=0;i<m.surfaceDevices.n;i++)assert.ok(inside(host,Array.from(m.surfaceDevices.pos.slice(i*3,i*3+3))));assert.equal(C.publicJSON(ship),before);
});

test('explicit visual depth, cosmetic density and draw budgets do not alter the saved functional source',()=>{
 const {ship,patch}=fixture({depth:4}),before=C.publicJSON(ship),low=row(ship,patch,{detail:0,maxDetails:0}),high=row(ship,patch,{detail:2,maxDetails:1800});assert.equal(low.visualDepth,4);assert.deepEqual(plain(low.field),plain(high.field));assert.equal(low.boxes.length,0);assert.ok(high.boxes.length>0);assert.equal(C.publicJSON(ship),before);
 const bounded=row(ship,patch,{maxField:160,maxDetails:0});assert.ok(bounded.field.length<=160);assert.ok(new Set(bounded.strata.map(q=>q.level)).size>8);assert.equal(C.publicJSON(ship),before);
 const saved=JSON.parse(C.publicJSON(ship)),source={parts:saved.parts,fits:saved.fits};assert.equal(C.setSurfaceConfig(ship,patch.id,{style:{depth:12,density:0}}).ok,true);const deeper=row(ship,patch,{detail:0,maxDetails:0});assert.equal(deeper.visualDepth,12);const changed=JSON.parse(C.publicJSON(ship));assert.deepEqual({parts:changed.parts,fits:changed.fits},source);assert.equal(deeper.functionalDepth,1);
});

test('tilted walls keep actual slab tops horizontal and all machine vertices inside their own tapered host',()=>{
 const {ship,host}=fixture({depth:5,rotated:true}),m=G.meshSurfaceLayers(ship,{}, {detail:0,maxDetails:0}),floors=horizontal(m.surfaceDevices).filter(t=>C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2>10);assert.ok(floors.length>12);
 for(const g of [m.surfaceDevices,m.surfaceDetail])for(let i=0;i<g.n;i++)assert.ok(inside(host,Array.from(g.pos.slice(i*3,i*3+3))),'a layered structure vertex escaped its actual host');
});

test('semantic siblings share floor levels and omit their artificial recessed divider',()=>{
 const {ship,patch}=fixture({depth:4}),levels=row(ship,patch).strata.map(q=>q.level),split=C.surfaceSplit(ship,patch.id,'u',.43);assert.equal(split.ok,true,split.why);
 const rows=G.surfaceVisualPlan(ship).filter(q=>split.ids.includes(q.id)),newLevels=rows.flatMap(q=>q.strata.map(q=>q.level));assert.deepEqual([...new Set(newLevels)].sort((a,b)=>a-b),[...new Set(levels)].sort((a,b)=>a-b));
 assert.ok(rows.reduce((n,q)=>n+q.revealBoundary.length,0)<rows.reduce((n,q)=>n+q.boundary.length,0),'an editable split is not a new supporting wall');
 const seam=40+160*.43,mesh=G.meshSurfaceLayers(ship,{}),area=triangles(mesh.surfaceArmor).filter(t=>t.every(p=>Math.abs(p[0]-seam)<.001)).reduce((n,t)=>n+C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2,0);assert.ok(area<.01,'no recessed wall triangles may remain at the shared semantic seam');
});

test('layered surfaces retain foil ownership exactly once and share cached whole-face meshes',()=>{
 const {ship,host,patch}=fixture({depth:2,foil:true}),before=C.publicJSON(ship),first=G.meshSurfaceLayers(ship,{}),again=G.meshSurfaceLayers(ship,{}),asset=G.fleetGeometry(ship,{trial:true}),foil=asset.foils.find(q=>q.id===host.id);assert.ok(foil);assert.ok(row(ship,patch).strata.length>3,'horizontal equipment faces must retain the structural band fallback');assert.equal(first.surfaceDevices,again.surfaceDevices);
 for(const kind of ['surfaceDevices','surfaceDetail']){const names=foil.meshes.filter(n=>foil.kinds[n]===kind);assert.equal(names.length,1,kind);assert.equal(asset.meshes[names[0]].geo.ni,first[kind].ni,kind);assert.equal(asset.meshes[kind]?.geo.ni||0,0,kind+' must not retain a stationary duplicate');}assert.equal(C.publicJSON(ship),before);
});
