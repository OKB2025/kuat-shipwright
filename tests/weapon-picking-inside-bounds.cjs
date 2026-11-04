const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',context),app=fs.readFileSync(path.join(root,'js/app.js'),'utf8'),near=(a,b)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<.006,`${v} != ${b[i]}`));
function fixture(frame={a:2}){
 const f={id:71,k:'oct40',p:[100,50,0],a:2,ped:0,base:0,low:0,float:false,...frame},asset=C.REFERENCE_ASSETS[C.FITS.oct40.asset],meshes=[G.meshFits({fits:[f]}),G.meshReferenceFits({fits:[f]})],T=Float32Array.from(meshes.flatMap(g=>Array.from(g.idx.slice(0,g.ni)).flatMap(i=>Array.from(g.pos.slice(i*3,i*3+3))))),bounds=[0,1,2].map(a=>Math.min(...Array.from({length:T.length/3},(_,i)=>T[i*3+a]))).concat([0,1,2].map(a=>Math.max(...Array.from({length:T.length/3},(_,i)=>T[i*3+a])))),point=p=>C.referenceFitPoint(f,p.map((v,i)=>(v-asset.c[i])/asset.size[i])),axis=asset.barrelAxis||[1,0,0],miss=C.norm(C.sub(point(axis),point([0,0,0])));
 let probe;for(let i=0;i<asset.muzzlePoints.length&&!probe;i++)for(let j=i+1;j<asset.muzzlePoints.length&&!probe;j++)for(const back of [.1,.5,1,2]){const a=C.sub(asset.muzzlePoints[i],C.mul(axis,back)),b=C.sub(asset.muzzlePoints[j],C.mul(axis,back)),o=point(C.mul(C.add(a,b),.5)),toward=point(a),d=C.norm(C.sub(toward,o));if(!o.every((v,k)=>v>bounds[k]&&v<bounds[k+3])||C.rayTris(T,o,miss))continue;const hit=C.rayTris(T,o,d);if(hit&&hit.t<C.len(C.sub(toward,o)))probe={o,d,expected:hit.p};}
 assert.ok(probe,'the actual parallel barrels must contain an empty gap inside the full bounds with a visible side surface');const {o,d,expected}=probe,box=vm.createContext({C,Gfx:G,ship:{fits:[f]}}),start=app.indexOf('function fitPickHit('),end=app.indexOf('function pick(',start);
 assert.ok(start>=0&&end>start);vm.runInContext(app.slice(start,end),box);const pick=(origin,dir)=>vm.runInContext(`fitHit(${JSON.stringify(origin)},${JSON.stringify(dir)})`,box);
 return {f,T,bounds,o,d,expected,miss,pick};
}

test('a ray from empty space inside native gun bounds can pick a visible barrel on cold and cached paths',()=>{
 for(const frame of [{a:2},{a:3},{a:4},{a:2,assetYaw:37},{a:2,assetYaw:-23,tilt:C.norm([.2,.93,.3])}]){
  const q=fixture(frame),truth=C.rayTris(q.T,q.o,q.d);assert.ok(truth);near(truth.p,q.expected);assert.equal(C.rayAABB(q.o,q.d,q.bounds),null,'Core rayAABB retains its surface-entry contract for an inside origin');
  const first=G.rayFit(q.o,q.d,q.f);assert.ok(first,'the cold geometry path must allow an inside origin');near(first.p,truth.p);const cached=G.rayFit(q.o,q.d,q.f);assert.ok(cached,'the known-bounds path must also allow the same origin');near(cached.p,truth.p);assert.equal(q.pick(q.o,q.d)?.fit.id,q.f.id,'the actual editor picker reaches the same visible barrel');
 }
});

test('inside-bounds empty rays remain unselectable until they hit a real triangle',()=>{
 const q=fixture();assert.equal(C.rayTris(q.T,q.o,q.miss),null);assert.equal(C.rayAABB(q.o,q.miss,q.bounds),null);assert.equal(G.rayFit(q.o,q.miss,q.f),null,'a cold inside-bounds miss is not a hit on the box');assert.equal(q.pick(q.o,q.miss),null,'the editor does not select empty interior space');
 assert.ok(G.rayFit(q.o,q.d,q.f),'an actual bore is still selectable after the miss populated its bounds');assert.equal(G.rayFit(q.o,q.miss,q.f),null,'the warmed cache still tests real triangles');assert.equal(q.pick(q.o,q.miss),null);
});
