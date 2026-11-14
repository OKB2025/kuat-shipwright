const assert=require('node:assert/strict'),path=require('node:path'),{test}=require('node:test');
const {C}=require('../scripts/update-ship-examples.cjs').loadRuntime(path.resolve(__dirname,'..'));
const near=(a,b,eps=3e-5)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=eps,`${a} != ${b}`),plain=v=>JSON.parse(JSON.stringify(v));
function fixture(){const ship=C.newShip({L:200,W:200,H:100,assembly:true});ship.parts=[{id:1,k:'struct',form:'ellipsoid',c:[100,50,0],s:[100,100,40]}];ship.fits=[];ship.hatches=[];ship.links=[];ship.nextId=2;return ship;}
function solve(ship,{mode='horizontal',size=[10,10,10],origin=[100,200,0],direction=[0,-1,0]}={}){const parent=ship.parts[0],hit=C.rayPart(origin,direction,parent);assert.ok(hit);return C.solvePlacement(ship,{id:-1,k:'struct',form:'box',c:[0,0,0],s:size},{mode,parentStructureId:parent.id,hit});}
function closedPositive(part){const T=C.structTriangles(part),ids=new Map(),faces=[],edges=new Map();let signed=0;const vertex=p=>{const key=Array.from(p).map(n=>n.toFixed(7)).join(',');if(!ids.has(key))ids.set(key,ids.size);return ids.get(key);};for(let i=0;i<T.length;i+=9){const a=Array.from(T.slice(i,i+3)),b=Array.from(T.slice(i+3,i+6)),c=Array.from(T.slice(i+6,i+9)),face=[vertex(a),vertex(b),vertex(c)];assert.equal(new Set(face).size,3);faces.push(face);signed+=C.dot(a,C.cross(b,c))/6;for(let j=0;j<3;j++){const x=face[j],y=face[(j+1)%3],key=Math.min(x,y)+':'+Math.max(x,y);if(!edges.has(key))edges.set(key,[]);edges.get(key).push([x,y]);}}
 assert.ok(signed>0,'the fitted material has outward winding and positive signed volume');for(const rows of edges.values()){assert.equal(rows.length,2,'every effective edge has two incident faces');assert.equal(rows[0][0],rows[1][1],'the two normals use opposite edge directions');}near(signed,C.partVolume(part),.002);assert.equal(C.meshTopology(faces).closed,true);
}

// 2026-11-13 user decision: no fitting (no contact-face cut). Until then these tests checked the fitted underside that
// followed the curved parent; now the requested box is kept whole, the seat sinks it until its whole base reaches the
// body (the lowest surface point under the footprint), and it is joined by the overlap.
test('a horizontal child on the curved parent keeps its requested box, its base reaching the lowest surface under it',()=>{
 const ship=fixture(),before=C.publicJSON(ship),result=solve(ship);assert.equal(result.ok,true,result.error);assert.equal(result.contact.connected,true);assert.ok(result.contact.overlap);closedPositive(result.part);near(C.partVolume(result.part),1000,1e-6);
 const b=C.partAABB(result.part);let lowest=Infinity;for(const x of [b[0]+1e-3,b[3]-1e-3])for(const z of [b[2]+1e-3,b[5]-1e-3]){const h=C.rayPart([x,200,z],[0,-1,0],ship.parts[0]);if(h)lowest=Math.min(lowest,h.p[1]);}
 assert.ok(b[1]<=lowest+1e-3&&b[1]>=lowest-.1,`base ${b[1]} at the lowest surface ${lowest}`);near(b[4]-b[1],10);assert.equal(C.publicJSON(ship),before);
});
test('a vertical child keeps the body upright, whole, and the same contact after lateral reflection',()=>{
 const results=[];for(const sign of [1,-1]){const result=solve(fixture(),{mode:'vertical',origin:[100,50,sign*150],direction:[0,0,-sign]});assert.equal(result.ok,true,result.error);closedPositive(result.part);near(C.partVolume(result.part),1000,1e-6*1000);assert.ok(result.contact.connected);const up=C.structFrame(result.part).up;near(up[0],0);near(up[1],1);near(up[2],0);results.push(result);}
 near(C.partAABB(results[0].part)[2],-C.partAABB(results[1].part)[5],1e-6);
});
test('an underside child reverses the contact side and sits against the parent from below, whole',()=>{
 const ship=fixture(),below=solve(ship,{origin:[100,-100,0],direction:[0,1,0]});assert.equal(below.ok,true,below.error);assert.equal(below.part.placement.contactSide,'top');closedPositive(below.part);near(C.partVolume(below.part),1000,1e-6);
 // The parent's bottom is at y 30; the child hangs below it, its top reaching the highest skin point over its footprint.
 const b=C.partAABB(below.part);let highest=-Infinity;for(const x of [b[0]+1e-3,b[3]-1e-3])for(const z of [b[2]+1e-3,b[5]-1e-3]){const h=C.rayPart([x,-200,z],[0,1,0],ship.parts[0]);if(h)highest=Math.max(highest,h.p[1]);}
 assert.ok(b[4]>=highest-1e-3&&b[4]<=highest+.1,`top ${b[4]} at the highest underside point ${highest}`);
});
test('curved finite-parent overhang keeps its requested box beyond the real contact boundary',()=>{
 const ship=fixture(),result=solve(ship,{origin:[148,200,0],size:[20,20,30]});assert.equal(result.ok,true,result.error);closedPositive(result.part);near(C.partVolume(result.part),12000,1e-6*12000);
 const parent=ship.parts[0],base=C.partAABB(result.part)[1],skin=C.rayPart([145,200,0],[0,-1,0],parent);assert.ok(skin);assert.ok(base<=skin.p[1]+1e-6,'the base reaches the skin');assert.equal(C.rayPart([156,200,0],[0,-1,0],parent),null);
 const overhang=C.rayPart([156,0,0],[0,1,0],result.part);assert.ok(overhang);near(overhang.p[1],result.part.c[1]-15);near(C.rayPart([156,200,0],[0,-1,0],result.part).p[1],result.part.c[1]+15);
});
test('a cut through the curved parent and its child remains a real opening',()=>{
 const ship=fixture();ship.solidCuts=[C.normalizeSolidCut({id:3,shape:'box',c:[104,50,0],s:[2,2,100],structures:true})];ship.parts[0]._solidCutShip=ship;ship.nextId=4;
 // 2026-11-13 user decision: no fitting; the child is the requested box carved by the ship cut. The carved triangles are
 // not checked edge by edge: the ship-cut carving leaves T-junctions on main too (a plain carved box: 16 edges).
 const result=solve(ship);assert.equal(result.ok,true,result.error);assert.ok(C.partVolume(result.part)<1000,'the cut carves the child');assert.equal(C.rayPart([104,200,0],[0,-1,0],ship.parts[0]),null);assert.equal(C.rayPart([104,0,0],[0,1,0],result.part),null,'no false floor across the cut');
});

test('saved curved contact regenerates the same material, attachment and editable source',()=>{
 const ship=fixture(),result=solve(ship);assert.equal(result.ok,true,result.error);assert.equal(C.acceptPlacementResult(ship,result).ok,true);const source=plain(result.part.placement.requestedGeometry),volume=C.partVolume(result.part),loaded=C.deserialize(plain(C.serialize(ship))),child=loaded.parts.find(p=>p.id===result.part.id);assert.ok(child);assert.deepEqual(plain(child.placement.requestedGeometry),source);assert.equal(child.placement.parentStructureId,1);near(C.partVolume(child),volume,.002);assert.equal(C.placementDiagnostics(loaded).find(row=>row.partId===child.id).connected,true);closedPositive(child);
});
