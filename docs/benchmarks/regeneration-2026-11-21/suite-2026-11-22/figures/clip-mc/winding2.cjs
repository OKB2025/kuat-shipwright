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
core=core.replace(head,head+'globalThis.__I={insideOriginalEnvelope:(...a)=>insideOriginalEnvelope(...a),clipCompartmentByMesh:(...a)=>clipCompartmentByMesh(...a),clipCompartmentMesh:(...a)=>clipCompartmentMesh(...a),unclippedInPart:(...a)=>unclippedInPart(...a),unclippedPartVolume:(...a)=>unclippedPartVolume(...a),interiorRawMesh:(...a)=>interiorRawMesh(...a),partAABB:(...a)=>partAABB(...a),meshVolume:(...a)=>meshVolume(...a),v3InHull:(...a)=>v3InHull(...a),unpiercedInStruct:(...a)=>unpiercedInStruct(...a),isShapePart:(...a)=>isShapePart(...a),solidCutsContain:(...a)=>solidCutsContain(...a)};');
vm.runInContext(core,ctx,{filename:'js/core.js'});const C=vm.runInContext('Core',ctx),I=vm.runInContext('__I',ctx);
const ship=C.deserialize(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples',key,'design.json.gz')))));C.syncCompartments(ship);C.computeStats(ship);
let seed=12345;const rnd=()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};/* mulberry32 (the earlier LCG put consecutive triples on planes) */
// point in closed triangle mesh: parity along +x ray with a slight tilt
function inMesh(T,q){let n=0;const d=[1,1e-4*Math.SQRT2,1e-4*Math.PI];for(let i=0;i<T.length;i+=9){const a=[T[i],T[i+1],T[i+2]],b=[T[i+3],T[i+4],T[i+5]],c=[T[i+6],T[i+7],T[i+8]];
 const e1=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],e2=[c[0]-a[0],c[1]-a[1],c[2]-a[2]],p=[d[1]*e2[2]-d[2]*e2[1],d[2]*e2[0]-d[0]*e2[2],d[0]*e2[1]-d[1]*e2[0]],det=e1[0]*p[0]+e1[1]*p[1]+e1[2]*p[2];if(Math.abs(det)<1e-15)continue;
 const s=[q[0]-a[0],q[1]-a[1],q[2]-a[2]],u=(s[0]*p[0]+s[1]*p[1]+s[2]*p[2])/det;if(u<0||u>1)continue;const qq=[s[1]*e1[2]-s[2]*e1[1],s[2]*e1[0]-s[0]*e1[2],s[0]*e1[1]-s[1]*e1[0]],v=(d[0]*qq[0]+d[1]*qq[1]+d[2]*qq[2])/det;if(v<0||u+v>1)continue;const t=(e2[0]*qq[0]+e2[1]*qq[1]+e2[2]*qq[2])/det;if(t>0)n+=det>0?-1:1;}return n;}
function manifold(T){const m=new Map(),k=i=>[T[i],T[i+1],T[i+2]].map(v=>Math.round(v*1e5)).join(',');for(let i=0;i<T.length;i+=9){const v=[k(i),k(i+3),k(i+6)];for(let j=0;j<3;j++){const a=v[j],b=v[(j+1)%3],e=a<b?a+'|'+b:b+'|'+a;m.set(e,(m.get(e)||0)+1);}}let bad=0;for(const c of m.values())if(c!==2)bad++;return {edges:m.size,nonManifold:bad};}
const rows=[];
for(const p of ship.parts.filter(p=>p._clip)){
 const clip=p._clip;delete p._clip;const pk=p._packing;delete p._packing;const rawMesh=I.interiorRawMesh(p);const which=process.argv[5]||'raw';const T=which==='raw'?rawMesh:which==='grid'?I.clipCompartmentMesh(ship,p,I.partAABB(p)):I.clipCompartmentByMesh(ship,p);p._clip=clip;if(pk)p._packing=pk;
 const b=[0,1,2].map(j=>{let m=Infinity;for(let i=j;i<T.length;i+=3)m=Math.min(m,T[i]);return m;}).concat([0,1,2].map(j=>{let m=-Infinity;for(let i=j;i<T.length;i+=3)m=Math.max(m,T[i]);return m;}));
 const box=(b[3]-b[0])*(b[4]-b[1])*(b[5]-b[2]);let inM=0,outPart=0,outEnv=0,w2=0,wneg=0;const n=+(process.argv[4]||40000);
 delete p._clip;for(let i=0;i<n;i++){const q=[0,1,2].map(j=>b[j]+(b[j+3]-b[j])*rnd());const w=inMesh(T,q);if(w<0)wneg++;if(w>=2)w2++;if(w<1)continue;inM++;if(!I.unclippedInPart(p,q))outPart++;else if(!I.insideOriginalEnvelope(ship,q))outEnv++;}p._clip=clip;
 rows.push({key,id:p.id,k:p.k,byMesh:+I.meshVolume(T).toPrecision(5),rawPartVolume:+I.unclippedPartVolume(p).toPrecision(5),rawMeshVolume:+I.meshVolume(rawMesh).toPrecision(5),mcMesh:+(box*inM/n).toPrecision(4),meshOutsidePart:+(box*outPart/n).toPrecision(3),meshOutsidePartSE:+(box*Math.sqrt(outPart)/n).toPrecision(2),meshOutsideEnvelope:+(box*outEnv/n).toPrecision(3),windingAtLeast2:+(box*w2/n).toPrecision(3),negativeWinding:wneg,n});
}
console.log(JSON.stringify(rows));
