const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),c=vm.createContext({});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{filename:file});
const {CompatRenderer}=vm.runInContext('Gfx',c);
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const geometry={n:3,ni:3,pos:new Float32Array([-.5,-.5,0,.5,-.5,0,0,.5,0]),nor:new Int8Array([127,0,0,127,0,0,127,0,0]),col:new Uint8Array([100,100,100,255,100,100,100,255,100,100,100,255]),idx:new Uint16Array([0,1,2])};
function setup(){
 let frame;
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>{frame=image;}};
 const canvas={width:24,height:24,clientWidth:24,clientHeight:24,getContext:kind=>kind==='2d'?ctx:null};
 const r=new CompatRenderer(canvas);r.matrices=()=>({VP:identity});
 return {r,pixel:()=>Array.from(frame.data.slice((12*24+12)*4,(12*24+12)*4+3)),pixels:()=>frame.data.slice()};
}
test('Canvas2D fallback draws a mesh without WebGL or undeclared rotation variables',()=>{
 const {r,pixel}=setup();r.upload('fits',geometry);
 assert.equal(r.draw(),true);assert.equal(r.frames,1);
 assert.deepEqual(pixel(),[68,68,68]);
});
test('fallback fleet lighting follows full ship rotation, including roll',()=>{
 const {r,pixel}=setup();r.loadFleet('test',{meshes:{fits:{geo:geometry}},center:[0,0,0]});
 assert.equal(r.draw({fleet:[{key:'test',pos:[0,0,0],rot:[0,1,0,-1,0,0,0,0,1]}]}),true);
 assert.deepEqual(pixel(),[96,96,96],'a rolled normal must light like an upward normal');
 assert.equal(r.draw({fleet:[{key:'test',pos:[0,0,0],yaw:0}]}),true);
 assert.deepEqual(pixel(),[68,68,68]);
});
test('fallback hides live-preview index ranges while retaining other parts and the preview',()=>{
 const positions=[-.75,-.25,.25,.75].flatMap(x=>[x-.18,-.4,0,x+.18,-.4,0,x,.4,0]);
 const parts={n:12,ni:12,pos:new Float32Array(positions),nor:new Int8Array(Array.from({length:12},()=>[127,0,0]).flat()),col:new Uint8Array(Array.from({length:12},()=>[100,100,100,255]).flat()),idx:Uint16Array.from({length:12},(_,i)=>i)};
 const preview={...geometry,pos:Float32Array.from(geometry.pos,(v,i)=>i%3===1?v+.4:v)};
 const actual=setup(),expected=setup();
 actual.r.upload('fits',parts);actual.r.upload('previewFits',preview);
 actual.r.draw();const original=actual.pixels();
 expected.r.upload('fits',{...parts,ni:6,idx:new Uint16Array([0,1,2,9,10,11])});expected.r.upload('previewFits',preview);expected.r.draw();
 assert.notDeepEqual(original,expected.pixels(),'the omitted parts must have visible pixels');
 for(const ranges of [[[3,3],[6,3]],[[3,6],[6,3]]]){
  actual.r.draw({hidden:{fits:ranges}});
  assert.deepEqual(actual.pixels(),expected.pixels(),'adjacent and overlapping ranges hide only the old part copies');
 }
 actual.r.draw({hidden:{hull:[[0,12]]}});assert.deepEqual(actual.pixels(),original,'ranges apply only to the named mesh');
 actual.r.draw();assert.deepEqual(actual.pixels(),original,'omitting hidden restores the full mesh');
});
test('fallback applies per-mesh live scaling on all axes and resets it on the next frame',()=>{
 const hull={...geometry,pos:new Float32Array([-.5,-.5,-.3,.5,-.5,0,0,.5,.3])},scale=[1.6,.6,.4];
 const actual=setup(),expected=setup(),VP=identity.slice();VP[8]=.4;VP[9]=.3;
 actual.r.matrices=expected.r.matrices=()=>({VP});
 actual.r.upload('hull',hull);actual.r.upload('fits',{...geometry,pos:Float32Array.from(geometry.pos,(v,i)=>i%3===0?v+.4:v)});
 expected.r.upload('hull',{...hull,pos:Float32Array.from(hull.pos,(v,i)=>v*scale[i%3])});expected.r.upload('fits',actual.r.meshes.fits.geo);
 actual.r.draw();const original=actual.pixels();expected.r.draw();
 assert.notDeepEqual(original,expected.pixels(),'scaling must change the visible hull');
 actual.r.draw({meshScale:{hull:scale}});assert.deepEqual(actual.pixels(),expected.pixels(),'only the named mesh receives all three scale factors');
 actual.r.draw({meshScale:{hull:[1,1,1]}});assert.deepEqual(actual.pixels(),original,'unit scaling retains the original rendering');
 actual.r.draw();assert.deepEqual(actual.pixels(),original,'omitting scaling restores the original rendering');
});
test('fallback fleet draws ignore editor-only hidden ranges and mesh scaling',()=>{
 const {r,pixels}=setup();r.loadFleet('test',{meshes:{fits:{geo:geometry}},center:[0,0,0]});
 const fleet=[{key:'test',pos:[0,0,0],yaw:0}];r.draw({fleet});const original=pixels();
 r.draw({fleet,hidden:{fits:[[0,3]]},meshScale:{fits:[.1,.1,.1]}});
 assert.deepEqual(pixels(),original);
});
