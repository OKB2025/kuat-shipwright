const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),engine=fs.readFileSync(path.join(root,'js/engine.js'),'utf8'),gfx=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8');
function declaration(text,start){const a=text.indexOf(start);assert.ok(a>=0);for(let b=text.indexOf('}',a);b>=0;b=text.indexOf('}',b+1)){const body=text.slice(a,b+1);try{new vm.Script(start.startsWith('  upload')?'class Subject{'+body+'}':body);return body;}catch{}}assert.fail(start);}
const context=vm.createContext({});vm.runInContext(declaration(engine,'function geoOut('),context);const geoOut=g=>{context.g=g;return vm.runInContext('geoOut(g,[])',context);};
const upload=vm.runInContext('('+ 'class Subject{'+declaration(gfx,'  upload(name, geo)')+'}'+').prototype.upload',context);
const geometry=()=>({n:2,ni:3,pos:Float32Array.from([4,-2,7,-3,5,1,999,999,999]),nor:new Float32Array(9),uv:new Float32Array(6),col:new Uint8Array(12),idx:Uint32Array.from([0,1,0])});
function renderer(){const data=[],gl={createBuffer:()=>({}),bindBuffer(){},bufferData:(target,values)=>data.push({target,values}),ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,UNSIGNED_INT:4,UNSIGNED_SHORT:5};return{u32:true,meshes:{},gl,data};}
function observed(g){let reads=0;const positions=new Proxy(g.pos,{get:(target,key)=>{if(/^\d+$/.test(String(key)))reads++;const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});return{geo:{...g,pos:positions},reads:()=>reads};}

test('worker bounds use exactly the active Float32 vertices and survive transport unchanged',()=>{
 const g=geoOut(geometry());assert.deepEqual(Array.from(g.bounds),[-3,-2,1,4,5,7]);assert.equal(g.boundsVertexCount,2);assert.equal(g.pos.length,6);assert.deepEqual(Array.from(g.idx),[0,1,0]);
 const r=renderer(),o=observed(g);upload.call(r,'fits',o.geo);assert.deepEqual(Array.from(r.meshes.fits.bb),[-3,-2,1,4,5,7]);assert.equal(o.reads(),0,'renderer must not rescan worker positions');assert.equal(r.meshes.fits.count,3);
});

test('legacy, malformed and mismatched bounds fall back to the original vertex scan',()=>{
 for(const metadata of [{},{bounds:[1,2,3],boundsVertexCount:2},{bounds:[0,0,0,NaN,1,1],boundsVertexCount:2},{bounds:[5,0,0,1,1,1],boundsVertexCount:2},{bounds:[-3,-2,1,4,5,7],boundsVertexCount:99}]){
  const g={...geoOut(geometry()),...metadata};if(!Object.keys(metadata).length){delete g.bounds;delete g.boundsVertexCount;}const r=renderer(),o=observed(g);upload.call(r,'fits',o.geo);assert.deepEqual(Array.from(r.meshes.fits.bb),[-3,-2,1,4,5,7]);assert.equal(o.reads(),6);
 }
});

test('empty geometry preserves the original null shadow bounds and zero draw count',()=>{
 const g=geoOut({...geometry(),n:0,ni:0}),r=renderer();upload.call(r,'empty',g);assert.equal(g.bounds,null);assert.equal(g.boundsVertexCount,0);assert.equal(r.meshes.empty.bb,null);assert.equal(r.meshes.empty.count,0);
});
