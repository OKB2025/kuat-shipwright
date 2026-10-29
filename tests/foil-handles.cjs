const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const C=vm.runInContext('Core',context),plain=value=>JSON.parse(JSON.stringify(value));
const fixture=()=>({id:1,k:'struct',form:'box',c:[10,20,30],s:[8,12,4],wing:{foil:true,axis:'x',stow:0,open:15,T:1}});
const samePoint=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-4);
function valid(handles){
 for(const p of handles.points)assert.ok(p.length===3&&p.every(Number.isFinite));
 for(const edge of handles.edges){assert.ok(edge.length===2&&edge.every(i=>Number.isInteger(i)&&i>=0&&i<handles.points.length));assert.notEqual(edge[0],edge[1]);}
 assert.equal(new Set(handles.edges.map(e=>e.slice().sort((a,b)=>a-b).join(','))).size,handles.edges.length);
}

test('box pivot handles contain its eight real corners and twelve edges, without face diagonals',()=>{
 const p=fixture(),before=C.publicJSON(p),handles=C.foilHandles(p);valid(handles);
 assert.equal(handles.points.length,8);assert.equal(handles.edges.length,12);
 for(const q of handles.points)assert.ok([6,14].includes(q[0])&&[18,22].includes(q[1])&&[24,36].includes(q[2]));
 for(const [a,b] of handles.edges)assert.equal(handles.points[a].filter((v,i)=>v!==handles.points[b][i]).length,1,'a real box edge changes only one coordinate');
 assert.equal(C.publicJSON(p),before,'handle extraction must not alter the saved part');
 assert.equal(C.foilHandles(p),handles,'unchanged geometry reuses its handles');
});

test('mesh handles follow the actual transformed vertices and omit triangulation-only vertices',()=>{
 const p=fixture(),mesh=C.structToMesh(p);p.form='mesh';p.mesh=mesh;p.yaw=27;p.pitch=19;p.roll=-11;
 const handles=C.foilHandles(p);valid(handles);assert.equal(handles.points.length,8);assert.equal(handles.edges.length,12);
 const world=mesh.v.map(v=>C.worldStruct(p,[v[0]*p.s[0],v[1]*p.s[2],v[2]*p.s[1]]));
 for(const q of handles.points)assert.ok(world.some(v=>samePoint(q,v)),'every handle belongs to an actual transformed mesh vertex');
 for(const [a,b] of handles.edges){const length=C.len(C.sub(handles.points[a],handles.points[b]));assert.ok([4,8,12].some(v=>Math.abs(v-length)<1e-4),'transformed edges retain their original lengths');}
});

test('sloped outlines keep their physical shape rather than using a bounding-box rectangle',()=>{
 const p=fixture();p.form='trap';p.taper=.4;p.offsetX=2;p.offsetZ=-1;p.yaw=15;
 const handles=C.foilHandles(p);valid(handles);assert.equal(handles.points.length,8);assert.equal(handles.edges.length,12);
 const top=[];for(const q of handles.points){const local=C.localStruct(p,q);if(local[1]>0)top.push(local);}
 assert.equal(top.length,4);
 assert.ok(top.every(q=>Math.abs(q[0]-(-.4))<1e-4||Math.abs(q[0]-4.4)<1e-4));
 assert.ok(top.every(q=>Math.abs(q[2]-(-4.6))<1e-4||Math.abs(q[2]-2.6)<1e-4));
});

test('handle cache refreshes after movement, resizing and replacement mesh edits',()=>{
 const p=fixture(),first=C.foilHandles(p);p.c[0]+=3;const moved=C.foilHandles(p);assert.notEqual(moved,first);
 first.points.forEach((q,i)=>assert.ok(samePoint(moved.points[i],[q[0]+3,q[1],q[2]])));
 p.s[0]=16;const resized=C.foilHandles(p);assert.notEqual(resized,moved);assert.equal(Math.max(...resized.points.map(p=>p[0]))-Math.min(...resized.points.map(p=>p[0])),16);
 p.form='mesh';p.mesh=C.structToMesh(p);const mesh=C.foilHandles(p);
 p.mesh={v:p.mesh.v.map(q=>[q[0]+q[1]*.25,q[1],q[2]]),f:p.mesh.f.map(t=>t.slice())};
 const edited=C.foilHandles(p);assert.notEqual(edited,mesh);assert.ok(edited.points.some((q,i)=>!samePoint(q,mesh.points[i])));
});

test('flat surfaces expose their boundary while malformed or empty structures fail safely',()=>{
 const p=fixture();p.s[2]=0;const flat=C.foilHandles(p);valid(flat);assert.equal(flat.points.length,4);assert.equal(flat.edges.length,4);
 for(const bad of [null,{}, {...fixture(),k:'battery'}, {...fixture(),c:[NaN,0,0]}, {...fixture(),s:[-1,1,1]}, {...fixture(),s:[0,0,0]}, {...fixture(),form:'mesh',mesh:{v:[[NaN,0,0]],f:[[0,1,2]]}}])assert.deepEqual(plain(C.foilHandles(bad)),{points:[],edges:[]});
});

test('large planar meshes retain only the boundary and cache the complete result',()=>{
 const n=75,p=fixture(),v=[],f=[];for(let z=0;z<=n;z++)for(let x=0;x<=n;x++)v.push([x/n-.5,0,z/n-.5]);
 for(let z=0;z<n;z++)for(let x=0;x<n;x++){const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;f.push([a,c,d],[a,d,b]);}
 p.form='mesh';p.mesh={v,f};const handles=C.foilHandles(p);valid(handles);assert.equal(handles.points.length,n*4);assert.equal(handles.edges.length,n*4);assert.equal(C.foilHandles(p),handles);
});
