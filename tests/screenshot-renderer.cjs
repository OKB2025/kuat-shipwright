const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),context=vm.createContext({console,window:{devicePixelRatio:2},performance:{now:()=>12345}});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
const {Renderer,CompatRenderer,captureDimensions}=vm.runInContext('Gfx',context),plain=v=>JSON.parse(JSON.stringify(v));
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const triangle={n:3,ni:3,pos:new Float32Array([-.5,-.5,0,.5,-.5,0,0,.5,0]),nor:new Int8Array([127,0,0,127,0,0,127,0,0]),col:new Uint8Array([100,100,100,255,100,100,100,255,100,100,100,255]),idx:new Uint16Array([0,1,2])};
function setup(kind){
 const outputs=[],sizes=[],state={lost:false,rb:8192,viewport:[8192,8192],copyError:false,no2d:false};
 const doc={createElement:()=>{const output={width:0,height:0,getContext:()=>state.no2d?null:{drawImage(source,...args){if(state.copyError)throw new Error('copy failed');output.copied={width:source.width,height:source.height,args,pixels:source.frame?.slice()};}}};outputs.push(output);return output;}};
 const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:image=>canvas.frame=image.data};
 const canvas={width:24,height:16,clientWidth:24,clientHeight:16,ownerDocument:doc,getContext:k=>k==='2d'?ctx:null};
 let r;
 if(kind==='compat')r=new CompatRenderer(canvas);
 else{
  r=Object.create(Renderer.prototype);Object.assign(r,{canvas,kind:'webgl',disposed:false,off:[0,0,0],cam:{th:.8,ph:1,r:10,target:[1,2,3],fov:.7},renderScale:.4,pb:{p:{},a:{aP:0}}});
  r.gl=new Proxy({isContextLost:()=>state.lost,getParameter:p=>p==='MAX_RENDERBUFFER_SIZE'?state.rb:p==='MAX_VIEWPORT_DIMS'?state.viewport:null,getError:()=>0,get drawingBufferWidth(){return canvas.width;},get drawingBufferHeight(){return canvas.height;}},{get:(o,k)=>k in o?o[k]:String(k)===String(k).toUpperCase()?k:()=>{}});
  for(const name of ['setLights','drawLines','drawMesh','drawGlow','drawRays','drawPoints','drawFleet'])r[name]=()=>{};
  r.pickLook=()=>({shadow:false});
 }
 r.matrices=()=>{sizes.push([canvas.width,canvas.height]);return {VP:identity,eye:[0,0,1]};};
 return {r,canvas,state,outputs,sizes};
}
function originalState(r){return {width:r.canvas.width,height:r.canvas.height,cam:r.cam,camJSON:JSON.stringify(r.cam),off:r.off,renderScale:r.renderScale,frames:r.frames,rayTime:r.rayTime,checks:r._errCheck,options:r._lastDrawOptions};}
function restored(r,original){
 assert.equal(r.canvas.width,original.width);assert.equal(r.canvas.height,original.height);assert.equal(r.cam,original.cam);assert.equal(JSON.stringify(r.cam),original.camJSON);assert.equal(r.off,original.off);assert.equal(r.renderScale,original.renderScale);assert.equal(r.frames,original.frames);assert.equal(r.rayTime,original.rayTime);assert.equal(r._errCheck,original.checks);assert.equal(r._lastDrawOptions,original.options);assert.equal(Object.hasOwn(r,'_captureSize'),false);assert.equal(Object.hasOwn(r,'_captureTime'),false);assert.equal(Object.hasOwn(r,'_capturePointDpr'),false);assert.equal(Object.hasOwn(r,'_frame'),false);
}

test('capture dimensions preserve aspect ratio, device density and hard allocation caps',()=>{
 assert.deepEqual(plain(captureDimensions(400,200,2,1)),{width:800,height:400,limited:false});
 assert.deepEqual(plain(captureDimensions(400,200,2,3)),{width:1600,height:800,limited:false});
 const capped=captureDimensions(4000,2000,4,2);assert.equal(capped.limited,true);assert.ok(capped.width<=8192&&capped.height<=8192);assert.ok(capped.width*capped.height<=24000000);assert.ok(Math.abs(capped.width/capped.height-2)<.001);
 assert.deepEqual(plain(captureDimensions(0,NaN,1,NaN)),{width:1,height:1,limited:false});
 for(const scale of [0,-1,3,Infinity,NaN,'2',null])assert.throws(()=>captureDimensions(100,50,scale),{name:'RangeError'});
});

test('GPU export size ignores adaptive renderScale and obeys renderbuffer and viewport limits',()=>{
 const {r,canvas,state}=setup('webgl');canvas.clientWidth=1000;canvas.clientHeight=500;r.renderScale=.4;
 assert.deepEqual(plain(r.captureSize(2)),{width:4000,height:2000,limited:false});r.renderScale=1;assert.equal(r.captureSize(2).width,4000);
 state.rb=2048;assert.deepEqual(plain(r.captureSize(4)),{width:2048,height:1024,limited:true});
 state.rb=8192;state.viewport=[4096,600];assert.deepEqual(plain(r.captureSize(4)),{width:1200,height:600,limited:true});
});

test('software export overrides its interactive 420k-pixel budget but stays within 4MP',()=>{
 const {r,canvas}=setup('compat');canvas.clientWidth=2000;canvas.clientHeight=1000;r.renderScale=.4;r.resize();assert.ok(canvas.width*canvas.height<421000);
 const size=r.captureSize(4);assert.ok(size.width*size.height<=4000000);assert.ok(size.width*size.height>3900000);assert.equal(size.limited,true);assert.ok(Math.abs(size.width/size.height-2)<.002);
});

for(const kind of ['webgl','compat']){
 test(`${kind}: capture redraws at real output resolution and restores the normal frame and camera`,()=>{
  const {r,canvas,outputs,sizes}=setup(kind);if(kind==='compat')r.upload('fits',triangle);
  const options={noStars:true,mode:'cut',clip:[10,10,10]};assert.equal(r.draw(options),true);const original=originalState(r),normalPixels=canvas.frame?.slice();
  sizes.length=0;const output=r.capture(2);assert.equal(output,outputs.at(-1));assert.equal(output.width,96);assert.equal(output.height,64);assert.deepEqual(output.copied.args,[0,0]);assert.equal(output.copied.width,96);assert.equal(output.copied.height,64);assert.deepEqual(sizes,[[96,64],[original.width,original.height]]);restored(r,original);
  if(kind==='compat'){
   assert.equal(output.copied.pixels.length,96*64*4);assert.deepEqual(canvas.frame,normalPixels,'the original software frame is redrawn');
   assert.deepEqual(Array.from(output.copied.pixels.slice((32*96+48)*4,(32*96+48)*4+3)),[68,68,68],'mesh pixels are rasterized at output dimensions');
  }
 });
 test(`${kind}: failed render and failed image copy restore dimensions, state and the last successful scene`,()=>{
  for(const failure of ['render','false','copy']){
   const {r,state}=setup(kind);r.draw({noStars:true});const original=originalState(r),draw=r.draw;
   r.draw=function(options){if(this._captureSize?.width>original.width){if(failure==='render')throw new Error('render failed');if(failure==='false')return false;}return draw.call(this,options);};
   state.copyError=failure==='copy';assert.throws(()=>r.capture(2));restored(r,original);
  }
 });
 test(`${kind}: capture rejects missing frame or 2D context without changing the current image`,()=>{
  const {r,state}=setup(kind);assert.throws(()=>r.capture(),/まだありません/);assert.equal(Object.hasOwn(r,'_captureSize'),false);
  r.draw({noStars:true});const original=originalState(r);state.no2d=true;assert.throws(()=>r.capture(),/作成できません/);restored(r,original);
  r.disposed=true;assert.throws(()=>r.capture(),/利用できません/);
 });
}

test('WebGL capture freezes shield animation time and restores after context loss',()=>{
 const {r,state}=setup('webgl');r.draw({fleet:[],noStars:true});const time=r.rayTime,times=[],drawFleet=r.drawFleet;r.drawFleet=()=>{times.push(r.rayTime);drawFleet();};
 r.capture(2);assert.deepEqual(times,[time,time]);assert.equal(r.rayTime,time);
 const original=originalState(r),draw=r.draw;r.draw=function(options){if(this._captureSize?.width>original.width)state.lost=true;return draw.call(this,options);};
 assert.throws(()=>r.capture(2),/失敗しました/);restored(r,original);assert.throws(()=>r.capture(),/利用できません/);
});


test('WebGL point sizes follow export density while the normal star size is restored',()=>{
 const {r,state}=setup('webgl'),minimums=[];
 r.points={stars:{count:1,pos:{},col:{},size:{}}};r.pp={p:{},a:{aPos:0,aCol:1,aSize:2},u:{uMin:'minimum'}};
 r.drawPoints=Renderer.prototype.drawPoints;r.gl.uniform1f=(uniform,value)=>{if(uniform==='minimum')minimums.push(value);};
 r.draw({});r.capture(2);r.capture(4);assert.deepEqual(minimums,[2,4,2,8,2]);assert.equal(Object.hasOwn(r,'_capturePointDpr'),false);
 state.copyError=true;assert.throws(()=>r.capture(2),/copy failed/);assert.deepEqual(minimums.slice(-2),[4,2]);assert.equal(Object.hasOwn(r,'_capturePointDpr'),false);
});
