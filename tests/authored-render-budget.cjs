const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console,performance});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),plain=v=>JSON.parse(JSON.stringify(v)),hash=v=>crypto.createHash('sha256').update(v).digest('hex');
const kinds=['pd','stl','utl','ion','quad200','single500','single200','twin200','twin200Fast','ball175TripleIon','ball175Quad','ball175QuadIon','ball720','monCalPD','monCal34','monCal80','monCal200','monCal200Triple','monCal150Ion','quad1Rapid'];
const fit=k=>({id:1,k,p:[0,0,0],a:2,ped:0,base:0,low:0,float:false,assetYaw:0}),asset=k=>C.REFERENCE_ASSETS[C.FITS[k].asset],draw=k=>G.turretRenderAsset(C.FITS[k].asset),point=(a,m,i)=>[0,1,2].map(k=>m.pos[i*3+k]*a.size[k]+a.c[k]);
function triangles(mesh,start=0,count=mesh.idx.length){const out=[];for(let i=start;i<start+count;i++)out.push(...mesh.pos.subarray(mesh.idx[i]*3,mesh.idx[i]*3+3));return Float32Array.from(out);}
function profiles(a,m,row){const xs=new Map(),eps=Math.max(...a.size)/65532*6;for(let i=row.firstVertex;i<row.firstVertex+row.vertices;i++){const p=point(a,m,i),x=m.pos[i*3],r=Math.hypot(p[1]-row.root[1],p[2]-row.root[2]);if(!xs.has(x))xs.set(x,[]);xs.get(x).push(r);}return [...xs].sort((a,b)=>a[0]-b[0]).map(([x,rs])=>{rs.sort((a,b)=>a-b);const groups=[];for(const r of rs){const last=groups.at(-1);if(!last||r-last.at(-1)>eps)groups.push([r]);else last.push(r);}return [x,groups.map(g=>[g[0],g.at(-1)])];});}

test('authored draw budgets reduce every targeted family without changing source meshes or physical metadata',()=>{
 for(const k of kinds){const a=asset(k),raw=C.decodeReference(C.FITS[k].asset),before=[hash(JSON.stringify(a)),hash(Buffer.from(raw.pos.buffer)),hash(Buffer.from(raw.idx.buffer))],r=draw(k);assert.equal(r.reduced,true,k);assert.ok(r.asset.faces<a.faces,k+' fewer actual triangles');assert.ok(r.asset.n<a.n,k+' compacted vertices');assert.equal(r.mesh.idx.length,r.asset.faces*3);assert.equal(r.mesh.pos.length,r.asset.n*3);assert.equal(new Set(r.mesh.idx).size,r.asset.n,k+' every uploaded vertex is referenced');assert.equal(draw(k),r,k+' reuse per asset');assert.deepEqual([hash(JSON.stringify(a)),hash(Buffer.from(raw.pos.buffer)),hash(Buffer.from(raw.idx.buffer))],before,k+' physical source immutable');}
 for(const [k,budget]of [['monCal34',724],['monCalPD',1204],['single500',844],['ball720',1116],['pd',1424],['stl',3216],['quad1Rapid',3360]])assert.equal(draw(k).asset.faces,budget,k+' bounded production draw count');
});

test('complete draw spheres have outward nondegenerate triangles, exact cardinal extents and smooth normals',()=>{
 for(const k of ['monCal34','monCalPD','single500','ball720','ball175Quad','quad40Ion']){const a=asset(k),r=draw(k),range=r.asset.sphereMeshRange,c=a.sphereCenterM,R=a.sphereRadiusM;assert.equal(range.indices/3,360,k);
  const P=Array.from({length:range.vertices},(_,i)=>point(a,r.mesh,range.firstVertex+i));for(let axis=0;axis<3;axis++){assert.ok(Math.abs(Math.min(...P.map(p=>p[axis]))-(c[axis]-R))<R*1e-6);assert.ok(Math.abs(Math.max(...P.map(p=>p[axis]))-(c[axis]+R))<R*1e-6);}
  for(let i=range.firstIndex;i<range.firstIndex+range.indices;i+=3){const p=Array.from(r.mesh.idx.slice(i,i+3),j=>point(a,r.mesh,j)),n=C.cross(C.sub(p[1],p[0]),C.sub(p[2],p[0])),centre=p[0].map((v,j)=>(v+p[1][j]+p[2][j])/3-c[j]);assert.ok(C.dot(n,centre)>0,k+' visible outward face');}
  const g=G.meshReferenceFits({fits:[fit(k)]});for(let i=range.firstVertex;i<range.firstVertex+range.vertices;i++){const n=Array.from(g.nor.slice(i*3,i*3+3));assert.ok(Math.hypot(...n)>125,k+' normalized smooth sphere lighting');}
 }
});

test('circumferential reduction retains every axial/profile ring including narrow steps and recessed bores',()=>{
 let checked=0;for(const k of kinds){const a=asset(k),source=C.decodeReference(C.FITS[k].asset),r=draw(k);for(const b of a.barrelCenters||[]){const next=r.asset.barrelCenters.find(x=>x.label===b.label&&x.muzzle.every((v,i)=>v===b.muzzle[i]));assert.ok(next,k+' matching barrel');if(next.indices===b.indices)continue;checked++;const before=profiles(a,source,b),after=profiles(a,r.mesh,next),eps=Math.max(...a.size)/65532*8;assert.equal(after.length,before.length,k+' every original axial break');for(let j=0;j<before.length;j++){assert.equal(after[j][0],before[j][0]);assert.equal(after[j][1].length,before[j][1].length,k+' every radial step and bore');for(let q=0;q<before[j][1].length;q++)for(let n=0;n<2;n++)assert.ok(Math.abs(after[j][1][q][n]-before[j][1][q][n])<=eps,k+' profile size');}for(const key of ['root','muzzle','axis','outerRadiusM','boreRadiusM','muzzleRecessM','exposedStartX'])assert.deepEqual(plain(next[key]),plain(b[key]),k+' physical '+key);}}
 assert.ok(checked>=30,'probe all reduced barrel families rather than one demonstration');
});

test('actual reduced GPU gun bores remain open and hit their recessed floor instead of a front cap',()=>{
 for(const k of ['pd','stl','quad200','single500','single200','twin200Fast','ball720','monCal34','monCalPD','monCal150Ion','quad1Rapid']){const f=fit(k),a=asset(k),g=G.meshReferenceFits({fits:[f]}),T=triangles(g,0,g.ni),world=q=>C.referenceFitPoint(f,q.map((v,j)=>(v-a.c[j])/a.size[j]));for(const b of a.barrelCenters){const mouth=world(b.muzzle),rear=world(C.sub(b.muzzle,C.mul(b.axis,b.muzzleRecessM))),dir=C.norm(C.sub(mouth,rear)),offset=.02,hit=C.rayTris(T,C.add(mouth,C.mul(dir,offset)),C.mul(dir,-1));assert.ok(hit,k+' actual bore floor');assert.ok(Math.abs(hit.t-(C.len(C.sub(mouth,rear))+offset))<.04,k+' open mouth reaches authored recess: '+hit.t);}}
});

test('unknown tilted barrels and the already sparse octuple keep their original source topology',()=>{
 const original=asset('pd'),id='render_budget_unknown_axis',copy={...original,barrelCenters:original.barrelCenters.map(b=>({...b,axis:[.99,.1,0]}))};C.REFERENCE_ASSETS[id]=copy;try{const r=G.turretRenderAsset(id);assert.equal(r.reduced,false);assert.equal(r.asset,copy);assert.equal(r.mesh,C.decodeReference(id));}finally{delete C.REFERENCE_ASSETS[id];}
 const r=draw('oct40');assert.equal(r.reduced,false);assert.equal(r.asset,asset('oct40'));assert.equal(r.mesh,C.decodeReference(C.FITS.oct40.asset));
});
