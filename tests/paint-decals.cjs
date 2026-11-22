// 2026-11-22 Part and gun colours, painted shapes and emblems (user: 「写真などからエンブレムを読み込んで貼り付けれる機能」
// 「図形などで色をつけれる機能」「船体、パーツ、砲も構造物同様色を変えれるように」). The images are the player's own; none ships
// with the game. These tests state the saved form and the geometry; the editor flow is checked in the browser
// (docs/benchmarks/paint-decals-2026-11-22/).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',context),plain=o=>JSON.parse(JSON.stringify(o));
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const raw=()=>JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'data/examples/cr90/design.json.gz'))));

test('decals and their images survive a save and a load, and an unused image is not kept',()=>{
 const o=raw();o.decals=[{id:1,kind:'circle',c:[10,5,3],n:[0,2,0],w:8,h:8,rot:15,color:'#FF0000',mirror:true},{id:2,kind:'image',image:'a',c:[20,5,0],n:[0,1,0],w:10,h:6}];o.decalImages={a:PNG,unused:PNG};
 const s=C.deserialize(o);
 assert.deepEqual(plain(s.decals),[{id:1,kind:'circle',c:[10,5,3],n:[0,1,0],w:8,h:8,rot:15,color:'#ff0000',mirror:true},{id:2,kind:'image',c:[20,5,0],n:[0,1,0],w:10,h:6,rot:0,color:'#ffffff',image:'a'}]);
 assert.deepEqual(Object.keys(s.decalImages),['a']);
 const again=C.deserialize(plain(C.serialize(s)));assert.deepEqual(plain(again.decals),plain(s.decals));assert.equal(again.decalImages.a,PNG);
 assert.equal(C.deserialize(raw()).decals,undefined,'a design without decals has none');
});

test('broken decal data is refused on load',()=>{
 const bad=[[{id:1,kind:'image',image:'x',c:[0,0,0],n:[0,1,0],w:1,h:1}],[{id:1,kind:'blob',c:[0,0,0],n:[0,1,0],w:1,h:1}],[{id:1,kind:'rect',c:[0,0,0],n:[0,0,0],w:1,h:1}],[{id:1,kind:'rect',c:[0,0,0],n:[0,1,0],w:0,h:1}],
  [{id:1,kind:'rect',c:[0,0,0],n:[0,1,0],w:1,h:1},{id:1,kind:'rect',c:[0,0,0],n:[0,1,0],w:1,h:1}],Array.from({length:C.DECAL_LIMITS.count+1},(_,i)=>({id:i+1,kind:'rect',c:[0,0,0],n:[0,1,0],w:1,h:1}))];
 for(const decals of bad)assert.throws(()=>C.deserialize({...raw(),decals}),/塗装・エンブレム/);
 assert.throws(()=>C.deserialize({...raw(),decals:[],decalImages:{a:'javascript:alert(1)'}}),/画像/);
 assert.throws(()=>C.deserialize({...raw(),decals:[],decalImages:{a:'data:image/png;base64,'+'A'.repeat(C.DECAL_LIMITS.imageChars)}}),/画像/);
});

test('the decal frame is right-handed and the mirror image lies across the centre plane without reversing the picture',()=>{
 for(const n of [[0,1,0],[0,-1,0],[1,0,0],[0,.6,.8],[-.3,.2,.93]])for(const rot of [0,37,-120]){const f=C.decalFrame({n,rot});
  for(const v of [f.n,f.u,f.v])assert.ok(Math.abs(C.len(v)-1)<1e-12);assert.ok(Math.abs(C.dot(f.u,f.n))<1e-12&&Math.abs(C.dot(f.v,f.n))<1e-12&&Math.abs(C.dot(f.u,f.v))<1e-12);
  const c=C.cross(f.u,f.v);assert.ok(C.dot(c,f.n)>1-1e-12,'u × v is the outward normal: the picture is not reversed');}
 const d={id:1,kind:'rect',c:[5,6,7],n:[0,.6,.8],w:2,h:1,rot:30,mirror:true},[a,b]=C.decalInstances(d);
 assert.deepEqual(plain(b.c),[5,6,-7]);assert.deepEqual(plain(b.n),[0,.6,-.8]);assert.equal(b.rot,-30);assert.deepEqual(plain(a.c),[5,6,7]);assert.equal(C.decalInstances({...d,mirror:false}).length,1);
});

test('a decal is the hull surface inside its rectangle, lifted along the normal, mapped to its atlas slot',()=>{
 const s=C.deserialize(raw());C.syncCompartments(s);const hit=C.rayEnv(s,[75,500,0],[0,-1,0]);assert.ok(hit?.p&&hit.n,'the top of the CR90 is hit');
 const n=C.dot(hit.n,[0,1,0])>0?hit.n:C.mul(hit.n,-1),w=6,h=4;s.decals=[{id:1,kind:'rect',c:hit.p,n,w,h,rot:0,color:'#ff0000'}];
 const g=G.meshDecals(s);assert.ok(g.ni>0,'triangles');const f=C.decalFrame(s.decals[0]);let area=0;
 for(let i=0;i<g.n;i++){const p=[g.pos[i*3],g.pos[i*3+1],g.pos[i*3+2]],q=C.sub(p,hit.p),u=C.dot(q,f.u),v=C.dot(q,f.v);
  /* lifted along each surface triangle's own normal by .01 × the larger side */assert.ok(Math.abs(u)<=w/2+.07&&Math.abs(v)<=h/2+.07,'inside the rectangle');assert.equal(g.col[i*4+3],248,'decal material');assert.deepEqual([g.col[i*4],g.col[i*4+1],g.col[i*4+2]],[255,0,0]);
  const [s0,t0]=[g.uv[i*2],g.uv[i*2+1]];assert.ok(s0>=0&&s0<=.25&&t0>=0&&t0<=.25,'the rectangle slot (0)');}
 for(let i=0;i<g.ni;i+=3){const P=[0,1,2].map(k=>{const j=g.idx[i+k];return [g.pos[j*3],g.pos[j*3+1],g.pos[j*3+2]];}),c=C.cross(C.sub(P[1],P[0]),C.sub(P[2],P[0]));area+=Math.abs(C.dot(c,f.n))/2;}
 assert.ok(Math.abs(area-w*h)/(w*h)<.02,`projected area ${area} of ${w*h} m² (the top here is flat)`);
 s.decals[0].mirror=true;const m=G.meshDecals(s);assert.ok(Math.abs(m.ni-2*g.ni)<=g.ni*.2,'the mirror adds its image');
 s.decals=[{id:1,kind:'image',image:'b',c:hit.p,n,w,h,rot:0,color:'#ffffff'}];s.decalImages={a:PNG,b:PNG};const im=G.meshDecals(s);
 for(let i=0;i<im.n;i++){const [s0,t0]=[im.uv[i*2],im.uv[i*2+1]];assert.ok(s0>=0&&s0<=.25&&t0>=.25&&t0<=.5,'second image: slot 4 (row 1, column 0)');assert.deepEqual([im.col[i*4],im.col[i*4+1],im.col[i*4+2]],[255,255,255]);}
 delete s.decals;assert.equal(G.meshDecals(s).ni,0);
});

test('a painted gun and a painted equipment part take their colour; the alpha byte (material) is kept',()=>{
 const s=C.deserialize(raw());C.syncCompartments(s);const f=s.fits.find(q=>C.FITS[q.k].cat==='w');assert.ok(f);
 const before=G.meshReferenceFits(s,null,[f]);f.paint='#2040ff';const after=G.meshReferenceFits(s,null,[f]);assert.equal(after.n,before.n);
 let top=0;for(let i=0;i<before.n;i++)top=Math.max(top,.3*before.col[i*4]+.59*before.col[i*4+1]+.11*before.col[i*4+2]);
 for(let i=0;i<after.n;i++){assert.equal(after.col[i*4+3],before.col[i*4+3]);const l=(.3*before.col[i*4]+.59*before.col[i*4+1]+.11*before.col[i*4+2])/top;
  for(const [k,c] of [[0,0x20],[1,0x40],[2,0xff]])assert.ok(Math.abs(after.col[i*4+k]-Math.round(c*l))<=1);}
 const o=plain(C.serialize(s));assert.equal(o.fits.find(q=>q.id===f.id).paint,'#2040ff');assert.equal(C.deserialize(o).fits.find(q=>q.id===f.id).paint,'#2040ff');
 o.fits.find(q=>q.id===f.id).paint='red';assert.equal(C.deserialize(o).fits.find(q=>q.id===f.id).paint,undefined,'a malformed gun colour is dropped');
 const e=s.parts.find(p=>p.k==='engine');e.paint='#30c060';const o2=plain(C.serialize(s));assert.equal(C.deserialize(o2).parts.find(p=>p.id===e.id).paint,'#30c060');
});
