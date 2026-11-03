const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),cx,{filename:f});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx);
function fixture(mode='equipment'){
 const ship=C.newShip({L:200,W:120,H:120,assembly:true},'Exposed surface renderer');ship.parts=[];ship.fits=[];ship.armor={hull:0,cit:0};ship.detail=1;
 const host=C.placePart(ship,'struct',[100,50,0],[120,60,40],{form:'box',skin:'plain'},false),patch=C.surfacePatches(ship).find(p=>p.host==='p'+host.id&&p.face==='port');assert.ok(patch?.exposed);
 assert.equal(C.setSurfaceConfig(ship,patch.id,{functionMode:mode,allocation:{cooling:40,sensors:20,habitation:40},equipment:{kind:'hdis',depth:1},battery:{weapon:'pd',count:0},armor:{thickness:mode==='armor'?1.2:0},style:{depth:4,density:.4,seed:37}}).ok,true);
 return {ship,host,id:patch.id};
}
function cover(ship,full=false){return C.placePart(ship,'struct',[98,50,-36],full?[160,80,90]:[32,30,14],{form:'box'},false);}
function selected(ship,id){return C.surfacePatches(ship).find(p=>p.id===id);}
function triangles(g,spans){const out=[];for(const [,start,count]of spans||[['',0,g.ni]])for(let i=start;i<start+count;i+=3)out.push([0,1,2].map(j=>Array.from(g.pos.slice(g.idx[i+j]*3,g.idx[i+j]*3+3))));return out;}
function clipRect(poly,B){for(const [axis,limit,sign]of [[0,B[0],1],[0,B[2],-1],[1,B[1],1],[1,B[3],-1]]){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-limit)*sign,db=(b[axis]-limit)*sign;if(da>=-1e-9)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push(a.map((x,j)=>x+(b[j]-x)*t));}}poly=out;if(!poly.length)break;}return poly;}
function area2(poly){return Math.abs(poly.reduce((sum,a,i)=>{const b=poly[(i+1)%poly.length];return sum+a[0]*b[1]-a[1]*b[0];},0))/2;}
const blocked=[82,43,114,57];
function noBuriedProjection(T,label){for(const tri of T)assert.ok(area2(clipRect(tri.map(p=>[p[0],p[1]]),blocked))<.0002,label+' extends behind the covering host');}

test('partial exposure clips layered backing, machinery and highlights while retaining hidden native skin',()=>{
 const {ship,host,id}=fixture(),before=G.surfaceVisualPlan(ship,{detail:0,maxDetails:0}).find(p=>p.id===id),oldLevels=new Set(before.strata.map(q=>q.level.toFixed(6)));cover(ship);const patch=selected(ship,id);assert.ok(patch.exposedTriangles?.length>0);assert.ok(patch.exposedArea<patch.area&&patch.exposedArea>0);
 const saved=C.publicJSON(ship),row=G.surfaceVisualPlan(ship,{detail:0,maxDetails:0}).find(p=>p.id===id),meshes=G.meshSurfaceLayers(ship,{}, {detail:0,maxDetails:0});assert.ok(row?.field.length>0);noBuriedProjection(Array.from({length:row.backingTriangles.length/9},(_,i)=>[0,1,2].map(j=>row.backingTriangles.slice(i*9+j*3,i*9+j*3+3))),'backing');noBuriedProjection(triangles(meshes.surfaceDevices),'machinery');
 for(const q of row.strata)assert.ok(oldLevels.has(q.level.toFixed(6)),'exposure clipping must retain full-base floor phase');
 const lines=G.surfaceSelectionLines(ship,[id]);assert.ok(lines.pos.length>0);let inner=0;for(let i=0;i<lines.pos.length;i+=6){const a=Array.from(lines.pos.slice(i,i+3)),b=Array.from(lines.pos.slice(i+3,i+6)),m=C.mul(C.add(a,b),.5);assert.ok(Math.abs(a[0]-b[0])<.001||Math.abs(a[1]-b[1])<.001,'triangulation diagonals are not exposed-region boundaries');assert.ok(!(m[0]>82.001&&m[0]<113.999&&m[1]>43.001&&m[1]<56.999),'highlight crosses buried face interior');if(Math.abs(a[0]-82)<.001||Math.abs(a[0]-114)<.001||Math.abs(a[1]-43)<.001||Math.abs(a[1]-57)<.001)inner++;}assert.ok(inner>0,'highlight must include the actual exposed-hole boundary');
 const native=G.meshParts(ship,{coded:false}),spans=(native.ranges[host.id]||[]).filter(q=>q[0]==='struct'),T=triangles(native.g.struct,spans).flat(2),ray=x=>C.rayTris(T,[x,50,-100],[0,0,1]),open=ray(60),hidden=ray(98);assert.ok(!open||open.t>100,'selected exposed native skin was not opened');assert.ok(hidden&&Math.abs(hidden.t-70)<.01,'hidden native skin must remain physically represented');assert.equal(C.publicJSON(ship),saved);
});

test('fully buried faces render and highlight nothing while their full physical armor remains in the report',()=>{
 const {ship,id}=fixture('armor'),fullArea=selected(ship,id).area,oldArmor=C.surfaceReport(ship).patches.find(p=>p.id===id).armorMass;cover(ship,true);const patch=selected(ship,id);assert.equal(patch.exposed,false);assert.equal(patch.exposedArea,0);assert.equal(patch.exposedTriangles.length,0);assert.equal(patch.area,fullArea);
 const saved=C.publicJSON(ship);assert.ok(!G.surfaceVisualPlan(ship).some(p=>p.id===id));assert.equal(G.surfaceSelectionLines(ship,[id]).pos.length,0,'empty exposure masks must not fall back to the original polygon');assert.equal(C.surfaceReport(ship).patches.find(p=>p.id===id).armorMass,oldArmor,'burial does not erase retained armor mass');assert.equal(C.publicJSON(ship),saved);
});

test('partial armor overlays follow clipped exterior fragments instead of drawing across buried interiors',()=>{
 const {ship,host,id}=fixture('armor');cover(ship);const patch=selected(ship,id),row=G.surfaceVisualPlan(ship).find(p=>p.id===id),ranges={},mesh=G.meshSurfaceLayers(ship,ranges).surfaceArmor;assert.ok(row);const selectedTriangles=triangles(mesh,(ranges[host.id]||[]).filter(q=>q[0]==='surfaceArmor')).filter(t=>t.every(p=>C.dot(C.sub(p,patch.center),patch.normal)>=-.001));noBuriedProjection(selectedTriangles,'armor overlay');
 const front=selectedTriangles.filter(t=>t.every(p=>Math.abs(C.dot(C.sub(p,patch.center),patch.normal)-1.21)<.001)),area=front.reduce((sum,t)=>sum+C.len(C.cross(C.sub(t[1],t[0]),C.sub(t[2],t[0])))/2,0);assert.ok(Math.abs(area-patch.exposedArea)<.01,'visible armor area must equal the true exposed fragments');assert.ok(patch.area>area);
});
