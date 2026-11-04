const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
// Reference exposure before local triangle broadphase; retained as a geometry oracle.
const ORIGINAL_SURFACE=String.raw`function surfaceExposedTriangles(T,host,meshes){
 if(!T.length)return [];const out=[],planes=new Map(),probe=1e-6,bounds=solidMeshBounds(T),candidates=meshes.filter(m=>m.part!==host&&[0,1,2].every(i=>m.b[i]<=bounds[i+3]+probe&&m.b[i+3]>=bounds[i]-probe));if(!candidates.length)return T;
 for(let i=0;i<T.length;i+=9){const points=[0,3,6].map(j=>Array.from(T.slice(i+j,i+j+3))),raw=cross(sub(points[1],points[0]),sub(points[2],points[0]));if(len(raw)<1e-10)continue;const n=norm(raw),d=dot(n,points[0]),key=n.map(x=>Math.round(x*1e8)).join(',')+'|'+Math.round(d*1e5);let plane=planes.get(key);
  if(!plane){const fr=frameAxis(n),u=fr.v,v=fr.w,origin=mul(n,d),eps=Math.max(1e-8,Math.max(...points.flat().map(Math.abs))*2e-10),sections=[];
   for(const mesh of candidates){const low=mesh.b.slice(0,3).map((x,j)=>(x+mesh.b[j+3])/2),half=mesh.b.slice(0,3).map((x,j)=>(mesh.b[j+3]-x)/2),distance=dot(n,low)-d,extent=half.reduce((s,x,j)=>s+x*Math.abs(n[j]),0);if(distance+extent<=eps||distance-extent>eps)continue;
    const section=surfaceExposurePlane(mesh,n,d,u,v,origin,key+'|out',eps);if(section.edges.length)sections.push(section);
   }plane={n,u,v,origin,eps,sections,crossings:surfaceExposureCrossings(sections,eps)};planes.set(key,plane);
  }
  if(!plane.sections.length){out.push(...points[0],...points[1],...points[2]);continue;}const U=points.map(p=>dot(sub(p,plane.origin),plane.u)),umin=Math.min(...U),umax=Math.max(...U),relevant=plane.sections.filter(s=>s.edges.some(e=>Math.max(e[0][0],e[1][0])>=umin-plane.eps&&Math.min(e[0][0],e[1][0])<=umax+plane.eps));surfaceExposeTriangle(points,plane,relevant,out);
 }return out.length===T.length&&out.every((v,i)=>v===T[i])?T:out;
}`;
function loadCore(unaccelerated=false){const cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){let source=fs.readFileSync(path.join(root,file),'utf8');if(file==='js/core.js'){
 if(process.env.KS_STRUCTURAL_ACCEL_PATCH)source=require(process.env.KS_STRUCTURAL_ACCEL_PATCH)(source);
 // The reference keeps the original vector volume sum and full exposure sections.
 if(unaccelerated){const a=source.indexOf('function surfaceExposedTriangles('),b=source.indexOf('function surfaceVisibleUV(',a);source=source.slice(0,a)+ORIGINAL_SURFACE+'\n'+source.slice(b);}
 const oracle=unaccelerated?'structuralMeshVolume=function(T){if(!T.length)return 0;const b=solidMeshBounds(T),o=[0,1,2].map(i=>(b[i]+b[i+3])/2);let value=0;for(let i=0;i<T.length;i+=9){const a=sub(Array.from(T.slice(i,i+3)),o),b=sub(Array.from(T.slice(i+3,i+6)),o),c=sub(Array.from(T.slice(i+6,i+9)),o);value+=dot(a,cross(b,c));}return Math.abs(value/6);};\n':'';
 source=source.replace(/\nreturn \{(?=allocateConnectedPower)/,'\n'+oracle+'return {__material:structuralMaterial,__join:structuralJoinBoundary,__volume:structuralMeshVolume,__expose:surfaceExposedTriangles,');
 }vm.runInContext(source,cx,{filename:file});}return vm.runInContext('Core',cx);}
const C=loadCore(),referenceCore=loadCore(true),near=(a,b,label)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=Math.max(.002,Math.abs(b)*1e-7),`${label}: ${a} != ${b}`);
function fixture(defs,{hull=false,cut=false}={},api=C){const s=api.newShip({L:2000,W:300,H:200,assembly:!hull,plan:'rect',sec:'rect'},'Local material geometry');s.parts=[];s.armor={hull:0,cit:0};for(const d of defs)api.placePart(s,'struct',d.c,d.s,{form:'box',...d.o},false);if(cut)s.solidCuts=[{id:s.nextId++,shape:'box',c:[100,100,0],s:[2,40,40],rotation:[0,0,0],structures:true}];return s;}
function reference(s){const g=referenceCore.hullGeo(s);let boundary=g.materialTris||g.tris,previous=referenceCore.__volume(boundary);const owned=new Map();for(const p of s.parts){const T=C.structTriangles(p);boundary=referenceCore.__join(boundary,T);const next=referenceCore.__volume(boundary);owned.set(p.id,Math.max(0,next-previous));previous=next;}return {boundary,volume:previous,owned};}
function equivalent(name,s){const old=reference(s),actual=C.__material(s);near(C.__volume(actual.boundary),old.volume,name+' total real volume');assert.deepEqual(Array.from(actual.boundary),Array.from(old.boundary),name+' exact boundary coordinates and original triangle order');for(const p of s.parts){near(actual.envelopeVolumes.get(p.id),old.owned.get(p.id),name+' ownership '+p.id);assert.ok(actual.envelopeVolumes.get(p.id)<=C.partVolume(p)+.002,'no part can own more material than its actual solid');}
 for(let i=0;i<60;i++){const origin=[70+i*1.2,240,-14+((i*17)%29)],a=C.rayTris(old.boundary,origin,[0,-1,0]),b=C.rayTris(actual.boundary,origin,[0,-1,0]);assert.equal(!!b,!!a,name+' physical surface ray '+i);if(a)near(b.t,a.t,name+' surface depth '+i);}
}

test('volume optimization preserves the reference physical union, ownership, cuts and surface rays',()=>{
 equivalent('chain',fixture([0,5,10,25].map(x=>({c:[100+x,100,0],s:[10,10,10]}))));
 equivalent('reversed ownership order',fixture([25,10,5,0].map(x=>({c:[100+x,100,0],s:[10,10,10]}))));
 equivalent('three-way and buried',fixture([{c:[100,100,0],s:[20,20,20]},{c:[105,100,0],s:[20,20,20]},{c:[100,105,5],s:[20,20,20]},{c:[100,100,0],s:[5,5,5]}]));
 equivalent('coincident and touching',fixture([0,0,10].map(x=>({c:[100+x,100,0],s:[10,10,10]}))));
 equivalent('rotated',fixture([{c:[100,100,0],s:[20,10,12],o:{yaw:31,pitch:17,roll:23}},{c:[108,103,2],s:[20,10,12],o:{yaw:-11,pitch:27,roll:-13}}]));
 equivalent('curved and concave',fixture([{c:[100,100,0],s:[30,20,20],o:{form:'roundloft',loft:[[0,.4,.5,0],[.3,1,1,0],[.7,.5,.7,0],[1,.8,.6,0]]}},{c:[111,101,0],s:[18,18,16],o:{form:'chamfer',corner:.2}}]));
 equivalent('real cut',fixture([{c:[100,100,0],s:[20,20,20]},{c:[108,100,0],s:[20,20,20]}],{cut:true}));
 equivalent('main hull priority',fixture([{c:[100,195,0],s:[20,20,20]},{c:[110,205,0],s:[20,20,20]}],{hull:true}));
});

test('volume optimization retains the exact oracle at supported large coordinates',()=>{
 equivalent('translated geometry',fixture([{c:[50000,10000,0],s:[20,10,12],o:{yaw:31,pitch:17,roll:23}},{c:[50008,10003,2],s:[20,10,12],o:{yaw:-11,pitch:27,roll:-13}}]));
});

test('scalar volume sum is bit-identical to the original vector arithmetic',()=>{
 let seed=0x9178af20;const points=[];for(let i=0;i<96*9;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;points.push((seed/2**32-.5)*120000);}
 for(const T of [Float64Array.from(points),Float32Array.from(points),new Float64Array(27)])assert.equal(C.__volume(T),referenceCore.__volume(T));
});

test('surface broadphase preserves physical exposure, face IDs and rays against the original section method',()=>{
 const cases=[
  ['overlap',[{c:[100,100,0],s:[20,20,20]},{c:[108,103,4],s:[20,20,20]},{c:[105,107,0],s:[8,35,10]}]],
  ['rotated',[{c:[100,100,0],s:[30,18,16],o:{yaw:31,pitch:17,roll:23}},{c:[111,103,4],s:[24,22,14],o:{form:'chamfer',corner:.2,yaw:-11,pitch:27,roll:-13}}]],
  ['coincident and touching',[0,0,20].map(x=>({c:[100+x,100,0],s:[20,20,20]}))],
  ['cut',[{c:[100,100,0],s:[24,24,24]},{c:[112,100,4],s:[20,20,20]}],{cut:true}],
  ['high coordinates',[{c:[50000,10000,0],s:[30,20,20],o:{yaw:17,pitch:4}},{c:[50012,10003,2],s:[24,18,24],o:{yaw:-13,roll:6}}]]
 ];
 for(const [name,defs,options]of cases){const a=referenceCore.surfacePatches(fixture(defs,options,referenceCore),true),b=C.surfacePatches(fixture(defs,options),true);
  assert.deepEqual(Array.from(b,p=>p.id),Array.from(a,p=>p.id),name+' stable face IDs');
  for(let i=0;i<a.length;i++){assert.equal(b[i].exposed,a[i].exposed,name+' exposed face');assert.ok(Math.abs(b[i].exposedArea-a[i].exposedArea)<=Math.max(1e-7,a[i].area*1e-10),name+' exposed area');}
  const A=Float64Array.from(a.flatMap(p=>Array.from(p.exposedTriangles||[]))),B=Float64Array.from(b.flatMap(p=>Array.from(p.exposedTriangles||[]))),lo=[0,1,2].map(k=>Math.min(...defs.map(p=>p.c[k]-Math.max(...p.s)))),hi=[0,1,2].map(k=>Math.max(...defs.map(p=>p.c[k]+Math.max(...p.s))));
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1])for(let i=0;i<12;i++){const origin=lo.map((v,k)=>v+(hi[k]-v)*(.05+.9*((i*[.61803398875,.41421356237,.73205080757][k])%1))),direction=[0,0,0];origin[axis]=sign>0?lo[axis]-50:hi[axis]+50;direction[axis]=sign;const x=C.rayTris(A,origin,direction),y=C.rayTris(B,origin,direction);assert.equal(!!y,!!x,name+' ray presence');if(x)assert.ok(Math.abs(x.t-y.t)<1e-6,name+' ray depth');}
 }
});

test('surface pruning preserves first-plane epsilon when the first triangle is far from the occluder',()=>{
 const T=Float64Array.from([50000,0,0,50010,0,0,50000,10,0,0,0,0,10,0,0,0,10,0]),host={};
 const p=[[1,1,-1e-6],[3,1,-1e-6],[3,3,-1e-6],[1,3,-1e-6],[1,1,5e-6],[3,1,5e-6],[3,3,5e-6],[1,3,5e-6]],solid=[];
 for(const q of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])for(let i=1;i+1<q.length;i++)solid.push(...p[q[0]],...p[q[i]],...p[q[i+1]]);
 const mesh={T:Float64Array.from(solid),b:[1,1,-1e-6,3,3,5e-6],part:{},index:0,sections:new Map()},visible=C.__expose(T,host,[mesh]);
 assert.deepEqual(Array.from(visible),Array.from(T),'the far first triangle sets the shared epsilon before the near triangle is locally pruned');
});
