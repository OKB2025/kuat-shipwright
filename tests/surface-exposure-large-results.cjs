const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js']){
 let source=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='js/core.js'){
  // Exercise the shared private clipper without adding a production export.
  const marker='\nreturn {BROADSIDE_BATTERY_CALIBERS,';assert.ok(source.includes(marker));
  source=source.replace(marker,'\nglobalThis.testSurfaceExposeTriangle=surfaceExposeTriangle;'+marker);
 }
 vm.runInContext(source,cx,{filename:file});
}
const expose=vm.runInContext('testSurfaceExposeTriangle',cx),size=100,points=[[0,0,0],[size,0,0],[size,size,0]],prefix=[99,98,97];
function plane(){
 // Other sections can introduce many slab boundaries without changing this
 // triangle's mask. Keep the section small so the regression is inexpensive.
 return {n:[0,0,1],u:[1,0,0],v:[0,1,0],origin:[0,0,0],eps:1e-10,crossings:Array.from({length:32767},(_,i)=>size*(i+1)/32768)};
}
function section(){return {edges:[[[0,size/4],[size,size/4]],[[0,size/2],[size,size/2]]],events:[0,size]};}
function area(T){let total=0;for(let i=0;i<T.length;i+=9){const cross=(T[i+3]-T[i])*(T[i+7]-T[i+1])-(T[i+4]-T[i+1])*(T[i+6]-T[i]);assert.ok(cross>=-1e-12,'clipping preserves the winding');total+=cross/2;}return total;}

for(const [label,keepInside,expected]of [['exterior',false,11/32],['interior',true,5/32]])test('large '+label+' clipping results preserve geometry beyond function argument limits',()=>{
 const out=prefix.slice();expose(points,plane(),[section()],out,keepInside);
 assert.deepEqual(out.slice(0,prefix.length),prefix,'append to the existing output');
 const T=out.slice(prefix.length);assert.ok(T.length>131072,'the real clipped coordinates exceed ordinary spread-call limits');assert.equal(T.length%9,0);assert.ok(T.every(Number.isFinite));
 assert.ok(Math.abs(area(T)-expected*size*size)<1e-9,'the exact clipped area is retained');
 for(let i=0;i<T.length;i+=3){const [x,y,z]=T.slice(i,i+3);assert.ok(x>=-1e-9&&x<=size+1e-9&&y>=-1e-9&&y<=x+1e-9);assert.equal(z,0);}
});

test('a fully exposed triangle keeps its original coordinates despite many irrelevant slab events',()=>{
 const out=prefix.slice();expose(points,plane(),[],out);
 assert.deepEqual(Array.from(out),prefix.concat(points.flat()));
});
