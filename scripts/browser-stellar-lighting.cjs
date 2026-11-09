#!/usr/bin/env node
// Numerical shader fixtures in actual Chromium WebGL; these are separate from
// the actual public-ship/system screenshots in browser-hatches-night.cjs.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),baseline='7f51a3b4e4d3f4483206df372c97e85807d58895';
async function main(){
 const {chromium}=require('playwright'),output=path.resolve(process.argv[2]||path.join(root,'docs/benchmarks/stellar-lighting-webgl.json'));
 const source=fs.readFileSync(path.join(root,'js/gfx.js'),'utf8'),old=cp.execFileSync('git',['show',baseline+':js/gfx.js'],{cwd:root,encoding:'utf8'}),report={status:'RUNNING',baselineCommit:baseline,sourceSha256:sha(source),baselineSourceSha256:sha(old),scope:'Actual production Renderer and WebGL shaders on explicit neutral-albedo/pure-emission fixture geometry and procedural planet samples. White-light pixels are compared with the previous main renderer. This is a numerical shader regression, not a stock ship flight or iOS/Safari validation.',conditions:{browser:'Chromium SwiftShader on Linux',safari:'Not tested'},startedAt:new Date().toISOString(),errors:[]};
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:320,height:240}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
 try{
  const base=process.env.KS_LIGHT_URL||'http://127.0.0.1:8004/';await page.goto(new URL('docs/',base).href,{waitUntil:'domcontentloaded'});
  for(const f of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])await page.addScriptTag({url:new URL(f,base).href});
  await page.addScriptTag({content:'window.PreviousGfx=(()=>{'+old+';return Gfx;})();'});
  report.measurements=await page.evaluate(()=>{
   const fixture=(API)=>{const cv=document.createElement('canvas');cv.style.cssText='width:96px;height:96px';document.body.append(cv);const r=new API.Renderer(cv);r.cam={th:Math.PI/2,ph:Math.PI/2,r:4,target:[0,0,0],fov:.72};r.resize();r.noShadow=true;r.lightK=0;r.look=r.pickLook({fleet:[],planet:{sun:[0,0,1]}});const gl=r.gl;gl.viewport(0,0,cv.width,cv.height);
    const texture=rgb=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([...rgb,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);return t;};
    r.tex.hull={a:texture([255,255,255]),e:texture([0,0,0])};const black=texture([0,0,0]),blue=texture([20,100,255]);
    const g=new API.Geo(4),v=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]].map((p,i)=>g.v(...p,0,0,1,i===1||i===2?1:0,i>1?1:0,[180,180,180],255));g.tri(v[0],v[1],v[2]);g.tri(v[0],v[2],v[3]);r.upload('fixture',g);
    const pixel=()=>{const p=new Uint8Array(4);gl.readPixels(cv.width/2,cv.height/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p).slice(0,3);};
    // For the pure-emission fixture the source is behind the opaque black face:
    // direct diffuse and the shader's albedo-independent specular are both zero.
    const mesh=(color,emissive=false)=>{r.look=r.pickLook({fleet:[],planet:{sun:emissive?[0,0,-1]:[0,0,1],star:color?{color}:null}});const saved=r.tex.hull;r.tex.hull=emissive?{a:black,e:blue}:saved;gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);r.drawMesh('fixture',r.matrices(),1,1);r.tex.hull=saved;return pixel();};
    const planet=(kind,color,night=false)=>{gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);r.drawPlanet(r.matrices(),{center:[0,0,0],radius:1,kind,sun:night?[0,0,-1]:[0,0,1],axis:[0,0,1],star:color?{color,dir:night?[0,0,-1]:[0,0,1],ang:.13}:null,look:[7.7,-.05,1.2,1]});return pixel();};
    return {mesh,planet,gl};};
   const now=fixture(Gfx),before=fixture(window.PreviousGfx),red=[1,.16,.05],white=[1,1,1],planets=[];
   for(let kind=0;kind<10;kind++)planets.push({kind,previousWhite:before.planet(kind),white:now.planet(kind),red:now.planet(kind,red),error:now.gl.getError()});
   return {mesh:{previousWhite:before.mesh(),white:now.mesh(),explicitWhite:now.mesh(white),red:now.mesh(red)},emission:{white:now.mesh(),pureWhite:now.mesh(white,true),pureRed:now.mesh(red,true)},planets,nightEmission:{cityWhite:now.planet(0,white,true),cityRed:now.planet(0,red,true),lavaWhite:now.planet(9,white,true),lavaRed:now.planet(9,red,true)},glError:now.gl.getError()};
  });
  const m=report.measurements;assert.deepEqual(m.mesh.white,m.mesh.previousWhite);assert.deepEqual(m.mesh.explicitWhite,m.mesh.white);assert.ok(m.mesh.red[0]>m.mesh.red[1]*1.25&&m.mesh.red[1]>m.mesh.red[2]);assert.deepEqual(m.emission.pureRed,m.emission.pureWhite);
  for(const p of m.planets){assert.equal(p.error,0,'planet kind '+p.kind);assert.ok(p.white.every((v,i)=>Math.abs(v-p.previousWhite[i])<=1),'white-light regression kind '+p.kind);}
  const terrestrial=m.planets.find(p=>p.kind===2);assert.ok(terrestrial.red[1]<terrestrial.white[1]*.7&&terrestrial.red[2]<terrestrial.white[2]*.7,'reflected planet light must lose non-red channels');
  assert.deepEqual(m.nightEmission.cityWhite,m.nightEmission.cityRed);assert.deepEqual(m.nightEmission.lavaWhite,m.nightEmission.lavaRed);assert.equal(m.glError,0);assert.deepEqual(report.errors,[]);
  report.sourceStable=sha(fs.readFileSync(path.join(root,'js/gfx.js')) )===report.sourceSha256;assert.ok(report.sourceStable);report.status='PASS';
 }catch(e){report.status='ERROR';report.error=e.stack||String(e);throw e;}finally{report.completedAt=new Date().toISOString();fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');await browser.close();}
 console.log(JSON.stringify({status:report.status,measurements:report.measurements,output}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
