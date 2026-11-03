const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=x=>JSON.parse(JSON.stringify(x));
function fixture({width=120,rotated=false,cut=false}={}){
 const ship=C.newShip({L:200,W:100,H:100,assembly:true},'Independent layered geometry');ship.parts=[];ship.fits=[];ship.nextId=1;ship.armor={hull:0,cit:0};ship.detail=1;
 const host=C.placePart(ship,'struct',[100,50,0],[width,50,32],{form:'box',...(rotated?{yaw:29,pitch:21,roll:13,taper:.25}:{})},false);assert.ok(host?.id);
 if(cut)ship.solidCuts.push(C.normalizeSolidCut({id:ship.nextId++,shape:'box',c:[112,50,0],s:[8,100,12],structures:true}));
 const patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face==='port');assert.ok(patch?.exposed);
 const result=C.setSurfaceConfig(ship,patch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:1,limit:0},battery:{weapon:'pd',count:0},style:{depth:4,density:.7,seed:37}});assert.equal(result.ok,true,result.why);
 return {ship,host,patch};
}
function mesh(ship,opt={}){return G.meshSurfaceLayers(ship,{}, {detail:0,maxDetails:0,...opt});}
function triangles(g){const out=[];for(let i=0;i<g.ni;i+=3)out.push([0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))));return out;}
// Inspect emitted positions and owner ranges, rather than accepting feature
// names as evidence that closed part models have become one face mesh.
function neutral(ship,host,opt={}){const ranges={},m=G.meshSurfaceLayers(ship,ranges,{detail:0,maxDetails:0,...opt}),g=m.surfaceDevices,T=[];for(const [name,start,count]of ranges[host.id]||[])if(name==='surfaceDevices')for(let i=start;i<start+count;i+=3){if(g.col[g.idx[i]*4+3]===253)continue;T.push([0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))));}return T;}
function projectedArea(T,n){return T.reduce((a,t)=>a+C.dot(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])),n)/2,0);}
function geometry(g){return {pos:Array.from(g.pos.slice(0,g.n*3)),idx:Array.from(g.idx.slice(0,g.ni))};}
function conservativeInside(host,p){return C.inPart(host,p)||C.inPart(host,C.add(p,C.mul(C.norm(C.sub(host.c,p)),3e-4)));}
function clipRect(poly,B){for(const [axis,limit,sign]of [[0,B[0],1],[0,B[2],-1],[1,B[1],1],[1,B[3],-1]]){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;if(da>=-1e-9)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((x,j)=>x+(b[j]-x)*t));}}poly=out;if(!poly.length)break;}return poly;}
function area2(poly){return Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;}

test('the actual relief is one continuous outward-facing surface at cosmetic detail zero',()=>{
 const {ship,host,patch}=fixture(),low=mesh(ship),high=mesh(ship,{detail:2,maxDetails:1800}),T=neutral(ship,host),edges=new Map(),key=p=>p.map(x=>x.toFixed(4)).join(',');
 assert.ok(T.length>20&&T.length<1200,'coarse face facets must replace the many closed boxes');
 for(const t of T){assert.ok(C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),patch.normal)>.05,'there must be no box backs or perpendicular shelves');for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],k=[key(a),key(b)].sort().join('|'),q=edges.get(k);if(q)q.count++;else edges.set(k,{a,b,count:1});}}
 const external=e=>[0,1].some(k=>Math.abs(e.a[k]-e.b[k])<.001&&[Math.min(...patch.polygon.map(p=>p[k])),Math.max(...patch.polygon.map(p=>p[k]))].some(v=>Math.abs(v-e.a[k])<.001));
 assert.ok([...edges.values()].some(e=>e.count===2),'adjacent facets must share actual edges');for(const e of edges.values()){assert.ok(e.count<=2,'skin triangles cannot overlap');if(e.count===1)assert.ok(external(e),'an unmatched edge inside the face would leave a crack');}
 assert.ok(Math.abs(projectedArea(T,patch.normal)-patch.exposedArea)<patch.exposedArea*.0002,'surface coverage must equal the exposed face once');assert.deepEqual(neutral(ship,host,{detail:2,maxDetails:1800}),T,'detail settings must retain the structural skin');assert.equal(low.surfaceDetail.ni,0);assert.ok(high.surfaceDetail.ni>0);
 const source=G.meshParts(ship,{coded:false}).g.struct,hit=C.rayTris(triangles(source).flat(2),[100,50,-60],[0,0,1]);if(hit)assert.ok(hit.p[2]>-21.001,'the original outer wall cannot cover the face relief');
});

test('the continuous face reaches both sides of an opening without bridging its empty volume',()=>{
 const {ship,host,patch}=fixture({cut:true}),m=mesh(ship),T=neutral(ship,host),opening=[108.0002,44.0002,115.9998,55.9998];
 assert.ok(T.some(t=>t.every(p=>p[0]<108))&&T.some(t=>t.every(p=>p[0]>116)),'machinery must remain on both sides of the opening');
 for(const g of [m.surfaceDevices,m.surfaceDetail])for(const tri of triangles(g)){for(const p of tri)assert.ok(conservativeInside(host,p),'relief vertices must remain in their pierced host');assert.ok(area2(clipRect(tri.map(p=>[p[0],p[1]]),opening))<.0002,'no triangle may cross an opening even when its corners are outside the hole');}
 assert.ok(Math.abs(projectedArea(T,patch.normal)-patch.exposedArea)<patch.exposedArea*.0002,'clipping the opening must retain all surrounding face coverage');
});

test('tilted tapered walls retain forward-facing relief inside their actual host envelope',()=>{
 const {ship,host,patch}=fixture({rotated:true}),m=mesh(ship),T=neutral(ship,host);assert.ok(T.length>20);
 for(const g of [m.surfaceDevices,m.surfaceDetail]){assert.ok(g.n>0||g===m.surfaceDetail);for(let i=0;i<g.n;i++)assert.ok(conservativeInside(host,Array.from(g.pos.slice(i*3,i*3+3))),'face relief protrudes through its sloped host');}
 for(const t of T)assert.ok(C.dot(C.norm(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0]))),patch.normal)>.05,'sloped faces need tangent relief instead of world-horizontal slabs');
 assert.ok(Math.abs(projectedArea(T,patch.normal)-patch.exposedArea)<patch.exposedArea*.0002,'the tilted face must retain its complete projected area');
});

test('semantic split and merge preserve relief height and omit an artificial wall divider',()=>{
 const {ship,host,patch}=fixture(),before=neutral(ship,host).flat(2),points=[];for(const x of [48,64,88,91.6,110,136,152])for(const y of [39,47,58])points.push([x,y,-60]);
 const heights=T=>points.map(p=>{const hit=C.rayTris(T,p,[0,0,1]);assert.ok(hit,'every test ray must reach the face');return hit.p[2];}),old=heights(before),result=C.surfaceSplit(ship,patch.id,'u',.43);assert.equal(result.ok,true,result.why);
 const after=mesh(ship),actual=heights(neutral(ship,host).flat(2));for(let i=0;i<old.length;i++)assert.ok(Math.abs(actual[i]-old[i])<.0001,'a semantic split must not restart the coarse relief phase');
 const seam=40+120*.43,dividers=triangles(after.surfaceArmor).filter(tri=>tri.every(p=>Math.abs(p[0]-seam)<.002)&&Math.max(...tri.map(p=>p[2]))-Math.min(...tri.map(p=>p[2]))>1),dividerArea=dividers.reduce((sum,t)=>sum+C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2,0);assert.ok(dividerArea<.01,'an editable partition cannot insert a physical wall');
 const merged=C.surfaceMerge(ship,result.ids);assert.equal(merged.ok,true,merged.why);const restored=heights(neutral(ship,host).flat(2));for(let i=0;i<old.length;i++)assert.ok(Math.abs(restored[i]-old[i])<.0001);
});

test('wide faces retain full coverage within a coarse budget independently of paint, save and capacity',()=>{
 for(const width of [120,480]){const {ship,host,patch}=fixture({width}),initial=C.publicJSON(ship),before=C.computeStats(ship),m=mesh(ship,{maxField:180}),T=neutral(ship,host,{maxField:180});assert.ok(Math.abs(projectedArea(T,patch.normal)-patch.exposedArea)<patch.exposedArea*.0002,'the bounded renderer cannot leave a wide face blank');assert.ok(T.length<width*10,'a wide surface needs broad facets instead of dense part meshes');assert.ok(G.surfaceVisualPlan(ship,{detail:0,maxDetails:0,maxField:180}).find(q=>q.id===patch.id).field.length<=180);
  const geo=geometry(m.surfaceDevices);host.paint='#b04020';assert.deepEqual(geometry(mesh(ship,{maxField:180}).surfaceDevices),geo,'repaint changes color only');const painted=mesh(ship,{maxField:180}).surfaceDevices;for(let i=0;i<painted.n;i++){if(painted.col[i*4+3]===253)continue;const c=Array.from(painted.col.slice(i*4,i*4+3));assert.ok(Math.abs(c[0]/176-c[1]/64)<.025&&Math.abs(c[0]/176-c[2]/32)<.04,'neutral machinery must inherit the parent material hue');}
  const restored=C.deserialize(C.serialize(ship));assert.deepEqual(geometry(mesh(restored,{maxField:180}).surfaceDevices),geo,'save/reload preserves actual relief');C.setSurfaceConfig(ship,patch.id,{style:{seed:99,density:0}});assert.notDeepEqual(geometry(mesh(ship,{maxField:180}).surfaceDevices),geo,'the seed must affect the mechanical landscape');assert.ok(Math.abs(projectedArea(neutral(ship,host,{maxField:180}),patch.normal)-patch.exposedArea)<patch.exposedArea*.0002);const final=C.computeStats(ship);for(const k of ['mass','cost','crew','sensorVolume','explicitHabitationVolume','dissipatorPower'])assert.equal(final[k],before[k],k+' cannot depend on drawing budget, material or seed');assert.ok(initial.length>0);
 }
});

test('a constrained multi-face budget preserves relief heights when one face is split',()=>{
 const {ship,host,patch}=fixture();ship.hull.L=500;
 const other=C.placePart(ship,'struct',[300,50,0],[120,50,32],{form:'box'},false),otherPatch=C.surfacePatches(ship).find(p=>p.host==='p'+other.id&&p.face==='port');assert.ok(otherPatch?.exposed);
 assert.equal(C.setSurfaceConfig(ship,otherPatch.id,{functionMode:'equipment',allocation:{cooling:100,sensors:0,habitation:0},equipment:{kind:'hdis',depth:1},battery:{count:0},style:{depth:4,density:0,seed:37}}).ok,true);
 const opt={maxField:120},origins=[];for(const x of [48,64,88,91.6,110,136,152])for(const y of [39,47,58])origins.push([x,y,-60]);
 const sample=()=>{const T=neutral(ship,host,opt).flat(2);return origins.map(o=>{const hit=C.rayTris(T,o,[0,0,1]);assert.ok(hit,'the coarsened skin must cover every ray');return hit.p[2];});};
 const resourceTotals=()=>ship.surfaces.patches.reduce((s,q)=>{for(const r of q.aggregate?.cells||[]){s.volume+=r[21];s.cost+=r[22];}return s;},{volume:0,cost:0}),old=sample(),resources=resourceTotals(),nativeIds=ship.parts.map(p=>p.id);
 const split=C.surfaceSplit(ship,patch.id,'u',.43);assert.equal(split.ok,true,split.why);
 const after=sample();for(let i=0;i<old.length;i++)assert.ok(Math.abs(after[i]-old[i])<.00002,'splitting one face must not reallocate its common grid budget or restart its relief');
 assert.deepEqual(ship.parts.map(p=>p.id),nativeIds,'the mesh budget cannot materialize scenery parts');assert.equal(ship.fits.length,0);const next=resourceTotals();for(const k of ['volume','cost'])assert.ok(Math.abs(next[k]-resources[k])<=Math.max(1e-7,Math.abs(resources[k])*1e-9),k+' must remain extensive across the semantic split');
});
