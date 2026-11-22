// Verification only: exposes core.js internals in a vm copy (game files untouched) and measures each clipped room:
// raw volume, face-joined clip (clipCompartmentByMesh) volume, grid clip (clipCompartmentMesh) volume, a Monte Carlo
// estimate of unclippedInPart && insideOriginalEnvelope, edge manifoldness of the face-joined mesh, and the volume of the
// face-joined mesh lying outside insideOriginalEnvelope (MC), with where the inside points lie (hull or structure id).
// usage: node clipmc.cjs <root> <key> [N]
const fs=require('fs'),path=require('path'),zlib=require('zlib'),vm=require('vm');
const [root,key,Narg]=process.argv.slice(2),N=+(Narg||1e6);
const ctx=vm.createContext({console,performance});
for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js'])vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
let core=fs.readFileSync(path.join(root,'js/core.js'),'utf8');const head='const Core = (() => {';if(!core.includes(head))throw new Error('head');
core=core.replace(head,head+'globalThis.__I={insideOriginalEnvelope:(...a)=>insideOriginalEnvelope(...a),clipCompartmentByMesh:(...a)=>clipCompartmentByMesh(...a),clipCompartmentMesh:(...a)=>clipCompartmentMesh(...a),unclippedInPart:(...a)=>unclippedInPart(...a),unclippedPartVolume:(...a)=>unclippedPartVolume(...a),partAABB:(...a)=>partAABB(...a),meshVolume:(...a)=>meshVolume(...a),v3InHull:(...a)=>v3InHull(...a),unpiercedInStruct:(...a)=>unpiercedInStruct(...a),isShapePart:(...a)=>isShapePart(...a),solidCutsContain:(...a)=>solidCutsContain(...a)};');
vm.runInContext(core,ctx,{filename:'js/core.js'});const C=vm.runInContext('Core',ctx),I=vm.runInContext('__I',ctx);
const ship=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));C.syncCompartments(ship);C.computeStats(ship);
let seed=12345;const rnd=()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};/* mulberry32 (the earlier LCG put consecutive triples on planes) */
// point in closed triangle mesh: parity along +x ray with a slight tilt
function inMesh(T,q){let n=0;const d=[1,1e-4*Math.SQRT2,1e-4*Math.PI];for(let i=0;i<T.length;i+=9){const a=[T[i],T[i+1],T[i+2]],b=[T[i+3],T[i+4],T[i+5]],c=[T[i+6],T[i+7],T[i+8]];
 const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-15)continue;
 const s=[q[0]-a[0],q[1]-a[1],q[2]-a[2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])/det;if(u<0||u>1)continue;const qq=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*qq[0]+d[1]*qq[1]+d[2]*qq[2])/det;if(v<0||u+v>1)continue;const t=(e2[0]*qq[0]+e2[1]*qq[1]+e2[2]*qq[2])/det;if(t>0)n++;}return n%2===1;}
function manifold(T){const m=new Map(),k=i=>[T[i],T[i+1],T[i+2]].map(v=>Math.round(v*1e5)).join(',');for(let i=0;i<T.length;i+=9){const v=[k(i),k(i+3),k(i+6)];for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3],e=a<b?a+'|'+b:b+'|'+a;m.set(e,(m.get(e)||0)+1);}}let bad=0;for(const c of m.values())if(c!==2)bad++;return {edges:m.size,nonManifold:bad};}
const rows=[];
for(const p of ship.parts.filter(p=>p._clip)){
 const clip=p._clip;delete p._clip;const pk=p._packing;delete p._packing;
 const b=I.partAABB(p),raw=I.unclippedPartVolume(p),mesh=I.clipCompartmentByMesh(ship,p),grid=I.clipCompartmentMesh(ship,p,b);
 const box=(b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2]);let inside=0,inPart=0,meshOut=0,meshIn=0,where={};const n=Math.min(N,Math.max(2e4,Math.round(N*Math.min(1,raw/0.05))));
 const n2=Math.min(n,mesh?Math.max(2e4,Math.round(2e6/Math.max(1,mesh.length/9))):0);
 for(let i=0;i<n;i++){const q=[0,1,2].map(j=>b[j]+(b[j+3]-b[j])*rnd());if(!I.unclippedInPart(p,q))continue;inPart++;const e=I.insideOriginalEnvelope(ship,q);if(e){inside++;}
  if(i<n2&&mesh){const m=inMesh(mesh,q);if(m&&!e)meshOut++;if(m&&e)meshIn++;if(m&&!e){let w=I.v3InHull(ship,q)?'hullButCut':'none';for(const s of ship.parts)if(I.isShapePart(s)&&I.unpiercedInStruct(s,q)){w='struct'+s.id+'('+s.k+')';break;}where[w]=(where[w]||0)+1;}}}
 const f=inside/n,mc=box*f,se=box*Math.sqrt(f*(1-f)/n),fo=meshOut/n2,mcOut=box*fo;
 rows.push({key,id:p.id,k:p.k,raw:+raw.toPrecision(5),grid:+I.meshVolume(grid).toPrecision(5),byMesh:mesh?+I.meshVolume(mesh).toPrecision(5):null,mc:+mc.toPrecision(5),mcSE:+se.toPrecision(2),n,byMeshOutsideEnvelopeMC:mesh?+mcOut.toPrecision(3):null,n2,outsideWhere:where,manifold:mesh?manifold(mesh):null,stored:+clip.volume.toPrecision(5)});
 p._clip=clip;if(pk)p._packing=pk;
}
console.log(JSON.stringify(rows));
