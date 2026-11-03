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
function coverage(rows){rows.sort((a,b)=>a[0]-b[0]);let sum=0,end=-Infinity;for(const [a,b]of rows)if(b>end){sum+=b-Math.max(a,end);end=b;}return sum;}
// Observe emitted triangle coordinates, never the generator's feature names or
// row.strata. A decorative shelf stripe or renamed mosaic cannot satisfy the
// full-width area/depth requirement below.
function horizontalGroups(g){const groups=new Map();for(const tri of triangles(g)){const n=C.cross(C.sub(tri[1],tri[0]),C.sub(tri[2],tri[0])),area=C.len(n)/2;if(!area||Math.abs(n[1])<area*2*.999999)continue;const key=tri[0][1].toFixed(3),q=groups.get(key)||{y:tri[0][1],area:0,intervals:[],zs:[]};q.area+=area;q.intervals.push([Math.min(...tri.map(p=>p[0])),Math.max(...tri.map(p=>p[0]))]);q.zs.push(...tri.map(p=>p[2]));groups.set(key,q);}return [...groups.values()].map(q=>({...q,coverage:coverage(q.intervals),depth:Math.max(...q.zs)-Math.min(...q.zs)})).sort((a,b)=>a.y-b.y);}
function slabLevels(g,width,depth=4){const groups=horizontalGroups(g).filter(q=>q.coverage>width*.85&&q.area>width*depth*.20&&q.depth>depth*.25),out=[];for(const q of groups){const last=out.at(-1);if(last&&q.y-last.at(-1).y<.55)last.push(q);else out.push([q]);}return out;}
function geometry(g){return {pos:Array.from(g.pos.slice(0,g.n*3)),idx:Array.from(g.idx.slice(0,g.ni))};}
function conservativeInside(host,p){return C.inPart(host,p)||C.inPart(host,C.add(p,C.mul(C.norm(C.sub(host.c,p)),3e-4)));}

test('the actual face mesh has deep continuous thin floor slabs at cosmetic detail zero',()=>{
 const {ship}=fixture(),low=mesh(ship),high=mesh(ship,{detail:2,maxDetails:1800}),levels=slabLevels(low.surfaceDevices,120);assert.ok(levels.length>=6,'a wall needs repeated deep, nearly full-width floors rather than separate equipment tiles');
 for(const level of levels){assert.ok(level.length>=2,'each floor must have real upper and lower faces');const thickness=level.at(-1).y-level[0].y;assert.ok(thickness>.08&&thickness<.5,'floor slabs must be thin relative to their several-metre pitch');}
 assert.deepEqual(levels.map(q=>q.map(p=>[p.y,p.area,p.coverage,p.depth])),slabLevels(high.surfaceDevices,120).map(q=>q.map(p=>[p.y,p.area,p.coverage,p.depth])),'detail settings must retain the structural floor geometry');assert.equal(low.surfaceDetail.ni,0);assert.ok(high.surfaceDetail.ni>0);const source=G.meshParts(ship,{coded:false}).g.struct,T=triangles(source).flat(2),Y=levels[3][0].y,hit=C.rayTris(T,[100,Y,-60],[0,0,1]);if(hit)assert.ok(hit.p[2]>-21.001,'the original outer wall cannot cover the generated floor strata');
});

test('floors resume on both sides of a real opening and no emitted triangle bridges its empty volume',()=>{
 const {ship,host}=fixture({cut:true}),m=mesh(ship),groups=horizontalGroups(m.surfaceDevices),insideOpening=groups.filter(q=>q.y>44.3&&q.y<55.7&&q.area>100&&q.coverage>100&&q.depth>1);assert.ok(insideOpening.length>=4,'several real floors must pass the opening height');
 for(const q of insideOpening){assert.ok(q.intervals.some(([a,b])=>b<=108.001&&b-a>10),'the port side of a cut course must remain');assert.ok(q.intervals.some(([a,b])=>a>=115.999&&b-a>10),'the other side of a cut course must remain');}
 for(const g of [m.surfaceDevices,m.surfaceDetail])for(const tri of triangles(g)){for(const p of tri)assert.ok(conservativeInside(host,p),'real machinery vertices must remain in their own pierced host');const cy=tri.reduce((n,p)=>n+p[1],0)/3;if(tri.every(p=>p[1]>44.001&&p[1]<55.999))assert.ok(Math.max(...tri.map(p=>p[0]))<=108.001||Math.min(...tri.map(p=>p[0]))>=115.999,'a triangle may not span the opening even when its corners lie outside the hole');}
});

test('tilted tapered walls retain world-horizontal floors inside the actual host envelope',()=>{
 const {ship,host}=fixture({rotated:true}),m=mesh(ship),row=G.surfaceVisualPlan(ship,{detail:0,maxDetails:0}).find(q=>q.host==='p'+host.id&&q.config.functionMode==='equipment');assert.ok(row);
 for(const g of [m.surfaceDevices,m.surfaceDetail]){assert.ok(g.n>0||g===m.surfaceDetail);for(let i=0;i<g.n;i++)assert.ok(conservativeInside(host,Array.from(g.pos.slice(i*3,i*3+3))),'a stratum or its equipment protrudes through its sloped host');}
 const floors=horizontalGroups(m.surfaceDevices).filter(q=>q.area>15&&q.depth>1);assert.ok(floors.length>=6,'sloped faces need real world-horizontal slab surfaces, not slanted rectangular facade tiles');
});

test('semantic split and merge preserve floor phase and do not add an artificial full-height wall divider',()=>{
 const {ship,patch}=fixture(),before=mesh(ship),old=slabLevels(before.surfaceDevices,120).map(q=>q.map(p=>p.y)),result=C.surfaceSplit(ship,patch.id,'u',.43);assert.equal(result.ok,true,result.why);const after=mesh(ship),levels=slabLevels(after.surfaceDevices,120).map(q=>q.map(p=>p.y));assert.deepEqual(levels,old,'a split must not restart floor heights from each child center');
 const patches=C.surfacePatches(ship).filter(p=>result.ids.includes(p.id)),range=patches.map(p=>p.triangles).flatMap(T=>Array.from(T).filter((_,i)=>i%3===0)),seam=40+120*.43;
 const dividers=triangles(after.surfaceArmor).filter(tri=>tri.every(p=>Math.abs(p[0]-seam)<.002)&&Math.max(...tri.map(p=>p[2]))-Math.min(...tri.map(p=>p[2]))>1);const dividerArea=dividers.reduce((sum,t)=>sum+C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2,0);assert.ok(dividerArea<.01,'an editable partition cannot insert a physical wall through continuous machinery');
 assert.ok(range.length>0);const merged=C.surfaceMerge(ship,result.ids);assert.equal(merged.ok,true,merged.why);assert.deepEqual(slabLevels(mesh(ship).surfaceDevices,120).map(q=>q.map(p=>p.y)),old);
});

test('floor coverage survives wider faces and bounded draw budgets while paint/save/seed remain independent of capacity',()=>{
 for(const width of [120,480]){const {ship,host,patch}=fixture({width}),initial=C.publicJSON(ship),before=C.computeStats(ship),m=mesh(ship,{maxField:180}),levels=slabLevels(m.surfaceDevices,width);assert.ok(levels.length>=6,'a bounded renderer may simplify floors but must not leave most of a wide face blank');assert.ok(G.surfaceVisualPlan(ship,{detail:0,maxDetails:0,maxField:180}).find(q=>q.id===patch.id).field.length<=180);
  const geo=geometry(m.surfaceDevices);host.paint='#b04020';assert.deepEqual(geometry(mesh(ship,{maxField:180}).surfaceDevices),geo,'repaint changes color only');const painted=mesh(ship,{maxField:180}).surfaceDevices;for(let i=0;i<painted.n;i++){const c=Array.from(painted.col.slice(i*4,i*4+3));assert.ok(Math.abs(c[0]/176-c[1]/64)<.025&&Math.abs(c[0]/176-c[2]/32)<.04,'neutral machinery must inherit the parent material hue');}
  const restored=C.deserialize(C.serialize(ship));assert.deepEqual(geometry(mesh(restored,{maxField:180}).surfaceDevices),geo,'save/reload preserves actual floor and equipment geometry');C.setSurfaceConfig(ship,patch.id,{style:{seed:99,density:0}});assert.notDeepEqual(geometry(mesh(ship,{maxField:180}).surfaceDevices),geo,'a changed seed must still affect the uneven mechanical landscape');assert.ok(slabLevels(mesh(ship,{maxField:180}).surfaceDevices,width).length>=6);const final=C.computeStats(ship);for(const k of ['mass','cost','crew','sensorVolume','explicitHabitationVolume','dissipatorPower'])assert.equal(final[k],before[k],k+' cannot depend on drawing budget, material or seed');assert.ok(initial.length>0);
 }
});
