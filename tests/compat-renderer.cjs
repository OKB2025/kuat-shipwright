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
 return {r,pixel:()=>Array.from(frame.data.slice((12*24+12)*4,(12*24+12)*4+3))};
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
