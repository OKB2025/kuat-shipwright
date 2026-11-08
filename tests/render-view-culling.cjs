const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,performance:{now:()=>0}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const G=vm.runInContext('Gfx',context),I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function fixture(bounds=[-.25,-.25,-.25,.25,.25,.25]){
 const calls=[],uniforms=new Map(),gl=new Proxy({createBuffer:()=>({}),uniform3fv:(key,v)=>uniforms.set(key,Array.from(v)),drawElements:(...args)=>calls.push(args),drawArrays:(...args)=>calls.push(args)},{get:(o,k)=>k in o?o[k]:String(k)===String(k).toUpperCase()?k:()=>{}});
 const r=Object.create(G.Renderer.prototype),program={p:{},u:new Proxy({},{get:(_,k)=>k}),a:{aPos:0,aNor:1,aUv:2,aCol:3}};
 Object.assign(r,{gl,canvas:{height:700},cam:{fov:.72},off:[0,0,0],meshes:{},u32:true,pm:program,pray:program,lightK:0,tex:{hull:{a:{},e:{}}}});
 const pos=[];for(let i=0;i<8;i++)pos.push(bounds[i&1?3:0],bounds[i&2?4:1],bounds[i&4?5:2]);
 const geo={n:8,ni:36,pos:Float32Array.from(pos),nor:new Int8Array(24),uv:new Float32Array(16),col:new Uint8Array(32),idx:Uint32Array.from([0,2,1,1,2,3,4,5,6,5,7,6,0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5])};
 r.upload('hull',geo);r.upload('hatchRay',geo);
 return{r,geo,calls,uniforms,draw:(matrix={VP:I,eye:[0,0,5]},name='hull')=>{calls.length=0;r.drawMesh(name,matrix,1);return calls.length;}};
}

test('fully offscreen opaque meshes skip actual draw calls at all six clip planes and reappear after camera movement',()=>{
 const {r,draw,geo}=fixture(),original=Buffer.from(geo.pos.buffer).toString('hex');assert.equal(draw(),1);
 for(const axis of [0,1,2])for(const side of [-1,1]){r.off=[0,0,0];r.off[axis]=side*3;assert.equal(draw(),0);const VP=I.slice();VP[12+axis]=-side*3;assert.equal(draw({VP,eye:[0,0,5]}),1,'moving the camera reveals the same uploaded mesh');}
 assert.equal(Buffer.from(geo.pos.buffer).toString('hex'),original,'culling does not discard or modify geometry');assert.equal(r.meshes.hull.count,36);
});

test('viewport edge, near-plane crossing, and a mesh enclosing the camera stay drawable',()=>{
 const {r,draw}=fixture();for(const x of [1.25,1.250001]){r.off=[x,0,0];assert.equal(draw(),1,'a touching or rounding-close face must not disappear');}
 r.off=[0,0,-1.1];assert.equal(draw(),1,'part of the mesh remains inside the near plane');
 const enclosing=fixture([-10,-10,-10,10,10,10]);assert.equal(enclosing.draw(),1,'no individual corner inside the view is required');
});

test('perspective camera skips meshes wholly behind the eye while keeping a straddling body',()=>{
 const {r,draw}=fixture(),VP=Array.from(G.M4.persp(.72,1,1,100));r.off=[0,0,-5];assert.equal(draw({VP,eye:[0,0,0]}),1);r.off=[0,0,5];assert.equal(draw({VP,eye:[0,0,0]}),0);
 const crossing=fixture([-3,-3,-3,3,3,3]);assert.equal(crossing.draw({VP,eye:[0,0,0]}),1);
});

test('fleet rotation, centre and scale use the same order as the live mesh shader',()=>{
 const {r,draw,uniforms}=fixture([9.75,-.25,-.25,10.25,.25,.25]);r.modelCenter=[10,0,0];r.modelRot=[0,0,1,0,1,0,-1,0,0];assert.equal(draw(),1);
 r.meshScale={hull:[2,1,1]};assert.equal(draw(),0,'scale is applied before subtracting the centre');r.modelCenter=[20,0,0];assert.equal(draw(),1);assert.deepEqual(uniforms.get('uScl'),[2,1,1]);
 r.unitScl=[-1,1,1];assert.equal(draw(),0,'fleet scale overrides the per-mesh scale');r.modelCenter=[-10,0,0];assert.equal(draw(),1);assert.deepEqual(uniforms.get('uScl'),[-1,1,1]);
 r.modelRot=null;r.modelYaw=Math.PI/2;assert.equal(draw(),1);r.off=[0,0,3];assert.equal(draw(),0);
});

test('translucent hatch rays are culled only when their complete uploaded bounds leave the view',()=>{
 const {r,calls}=fixture();r.off=[4,0,0];r.drawRay('hatchRay',{VP:I,eye:[0,0,5]},.5);assert.equal(calls.length,0);r.off=[0,0,0];r.drawRay('hatchRay',{VP:I,eye:[0,0,5]},.5);assert.equal(calls.length,1);
 r.unitScl=[100,100,100];r.off=[4,0,0];calls.length=0;r.drawRay('hatchRay',{VP:I,eye:[0,0,5]},.5);assert.equal(calls.length,0,'ray shader has no unit-scale uniform override');
});

test('unknown bounds or transform conservatively keep the draw instead of hiding geometry',()=>{
 const {r,draw}=fixture();r.off=[4,0,0];for(const bb of [null,[NaN,0,0,1,1,1],[2,0,0,1,1,1]]){r.meshes.hull.bb=bb;assert.equal(draw(),1);}
 r.meshes.hull.bb=[-.25,-.25,-.25,.25,.25,.25];r.modelRot=[NaN,0,0,0,1,0,0,0,1];assert.equal(draw(),1);assert.equal(draw({eye:[0,0,5]}),1);
});

test('large local coordinates retain faces visible after GPU float32 centre subtraction',()=>{
 const {r,draw}=fixture([1e8,-.25,-.25,1e8,.25,.25]);r.modelCenter=[1e8-3,0,0];
 assert.equal(Math.fround(Math.fround(1e8)-Math.fround(r.modelCenter[0])),0,'the GPU keeps this plane inside its depth range');
 const VP=[0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,1];assert.equal(draw({VP,eye:[5,0,0]}),1,'CPU doubles must not incorrectly reject the GPU-visible plane');
});
