#!/usr/bin/env node
// Inspect the real triple70 mounting joint on a native slope and a manual base.
// The coloured measurement markers are DOM overlays; all models use Gfx.Renderer.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),url=process.argv[2]||'http://127.0.0.1:8765';
const output=path.resolve(process.argv[3]||path.join(root,'docs/benchmarks/triple70-mount-browser.json'));
const imageRoot=path.join(root,'docs/images'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const sourceFiles=['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/app.js','js/gfx.js','js/lang-en.js','js/engine.js','index.html'];
const sources=Object.fromEntries(sourceFiles.map(f=>[f,hash(fs.readFileSync(path.join(root,f)))]));
assert.ok(process.env.TRIPLE70_EXPECT_CORE,'TRIPLE70_EXPECT_CORE is required');
assert.equal(sources['js/core.js'],process.env.TRIPLE70_EXPECT_CORE,'use the frozen current Core');
if(process.env.TRIPLE70_EXPECT_SOURCE_HASHES)assert.deepEqual(sources,JSON.parse(fs.readFileSync(process.env.TRIPLE70_EXPECT_SOURCE_HASHES,'utf8')));

async function latest(page){
 await page.waitForFunction(()=>{const Y=window.__yard;return Y.ship?.name==='Triple70 mount connection'&&Y.stats&&Y.eng.geoGen>=Y.eng.gen&&Y.eng.statsGen>=Y.eng.gen&&Y.eng.adoptedGen>=Y.eng.gen&&document.querySelector('#engineStatus')?.hidden;},null,{timeout:180000});
}
async function drawNative(page){
 await page.evaluate(async()=>{const Y=window.__yard;Y.draw();Y.kickLoop();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
}

(async()=>{
 const started=Date.now(),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US'}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(60000);await page.addInitScript(()=>localStorage.setItem('yard.language','en'));page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__yard?.eng.ready,null,{timeout:120000});
  const fixtureStarted=Date.now(),fixture=await page.evaluate(()=>{
   const Y=window.__yard,C=Y.C,s=C.newShip({assembly:true,L:330,W:110,H:100},'Triple70 mount connection');
   s.parts=[];s.fits=[];s.nextId=1;s.armor={hull:0,cit:0};s.detail=1;s.paint='neutral';
   const slopeNormal=C.norm([.20,1,0]),sloped=C.placePart(s,'struct',[85,12,0],[100,72,8],{form:'box',surfaceNormal:slopeNormal,paint:'#78828d',label:'Sloped native mounting plate'},false);
   const flat=C.placePart(s,'struct',[235,5,0],[100,72,10],{form:'box',paint:'#78828d',label:'Manual-base native mounting plate'},false);
   const placements=[];
   for(const spec of [{name:'slope',x:85,pedestal:0},{name:'pedestal',x:235,pedestal:4}]){
    const hit=C.rayEnv(s,[spec.x,90,0],[0,-1,0],{structOnly:true});if(!hit)throw Error('Missing native deck '+spec.name);
    const result=C.placeFit(s,'triple70',hit.p,hit.n,0,false,{tilt:spec.name==='slope'}),f=result.fit||result;
    if(result.err||!Number.isFinite(f.id))throw Error(result.err||'Missing placed triple70');
    f.assetYaw=spec.name==='pedestal'?37:0;
    if(spec.pedestal){f.ped=spec.pedestal;f.pedShape='cyl';f.pedSize=.92;}
    C.normalizeFitMount(f);
    placements.push({name:spec.name,id:f.id,hostId:hit.part?.id||null,hitPoint:hit.p,hitNormal:hit.n,pedestalHeight:spec.pedestal});
   }
   window.__triple70MountQA={placements,slopePart:sloped.id,flatPart:flat.id};Y.setShip(s);Y.st.coded=false;Y.st.view='normal';Y.st.tab='edit';Y.st.editTool='select';Y.st.sel=null;Y.st.multi.fits.clear();Y.st.multi.parts.clear();Y.title.hide();Y.renderPanel();
   return {placements,slopeNormal,parts:[sloped.id,flat.id],fixture:'Two ordinary editable native plates; all weapons placed through rayEnv and placeFit'};
  });
  await latest(page);const readyMs=Date.now()-fixtureStarted;await drawNative(page);
  const measurements=await page.evaluate(()=>{
   const Y=window.__yard,C=Y.C,a=C.REFERENCE_ASSETS[C.FITS.triple70.asset],m=C.decodeReference(C.FITS.triple70.asset);
   const labels=new Set(a.photoGeometryFeaturesM?.mainCase?.componentLabels||[]);if(!labels.size)throw Error('Missing real main-case components');
   const points=a.components.filter(c=>labels.has(c.label)).flatMap(c=>Array.from({length:c.vertices},(_,i)=>[0,1,2].map(k=>m.pos[(c.firstVertex+i)*3+k]*a.size[k]+a.c[k])));
   const zmin=Math.min(...points.map(p=>p[2])),zmax=Math.max(...points.map(p=>p[2])),epsilon=Math.max(.001,a.maxQuantizationErrorM*8);
   const end=z=>{const selected=points.filter(p=>Math.abs(p[2]-z)<epsilon),floor=Math.min(...selected.map(p=>p[1])),bottom=selected.filter(p=>p[1]<floor+epsilon);return [0,1,2].map(k=>bottom.reduce((n,p)=>n+p[k],0)/bottom.length);};
   const left=end(zmin),right=end(zmax),mid=left.map((n,k)=>(n+right[k])/2),rows=window.__triple70MountQA.placements.map(p=>{
    const f=Y.ship.fits.find(f=>f.id===p.id),g=C.authoredTurretGeometry(f),world=v=>C.referenceFitPoint(f,v.map((n,k)=>(n-a.c[k])/a.size[k]));
    const origin=C.fitOrigin(f),ends=[world(left),world(right)],center=world(mid),bounds=C.fitAABB(f),ranges=Y.meshStore.fitRanges[f.id]||[];
    const frame=C.fitFrameOf(f),foot=C.sub(origin,C.mul(frame.up,f.ped||0)),nativeContactError=C.len(C.sub(foot,p.hitPoint));
    const axleLabels=a.frontConnection?.fixedAxleLabels||[];
    return {...p,float:f.float,ped:f.ped||0,base:f.base||0,low:f.low||0,origin,yawPivot:g.yawPivot,alignmentLineWorld:ends,alignmentMidpointWorld:center,alignmentErrorM:C.len(C.sub(center,origin)),yawErrorM:C.len(C.sub(g.yawPivot,origin)),nativeContactErrorM:nativeContactError,frameNormalError:C.len(C.sub(frame.up,p.hitNormal)),frame,bounds,drawnIndices:ranges.reduce((n,r)=>n+r[2],0),elevationPivot:g.elevationPivot,muzzles:g.muzzles,axleLabels};
   });
   window.__triple70MountQA.alignmentNative={left,right,mid,widthM:zmax-zmin};
   return {mount:a.mount.slice(),nativeMaxWidthLine:{left,right,mid,widthM:zmax-zmin},size:a.size.slice(),barrels:a.barrels,rows,renderer:!!Y.view().gl,webglError:Y.view().gl.getError(),workerMode:Y.eng.mode||null,generation:{design:Y.eng.gen,geometry:Y.eng.geoGen,statistics:Y.eng.statsGen}};
  });
  assert.equal(measurements.barrels,3);assert.equal(measurements.webglError,0);assert.ok(measurements.renderer);
  assert.ok(Math.abs(measurements.nativeMaxWidthLine.widthM-24)<.01);
  for(const r of measurements.rows){assert.equal(r.float,false);assert.equal(r.ped,r.pedestalHeight);assert.ok(r.alignmentErrorM<.003);assert.ok(r.yawErrorM<.001);assert.ok(r.nativeContactErrorM<.002);assert.ok(r.frameNormalError<.002);assert.ok(r.drawnIndices>0);}
  assert.ok(Math.abs(fixture.slopeNormal[0])>.15,'the native slope is not a horizontal substitute');

  // Exercise the actual editor picker before using an inspection-only viewport.
  const nativeSelection=[];
  for(const row of measurements.rows){
   await page.evaluate(id=>{const Y=window.__yard,C=Y.C,f=Y.ship.fits.find(f=>f.id===id),b=C.fitAABB(f),v=Y.view();Y.st.tab='edit';Y.st.editTool='select';Y.st.sel=null;Y.renderPanel();v.cam.th=.8;v.cam.ph=1.05;v.cam.r=70;v.cam.ortho=true;v.cam.target=C.add([(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],v.off);Y.draw();},row.id);await drawNative(page);
   const pixel=await page.evaluate(id=>{const Y=window.__yard,C=Y.C,f=Y.ship.fits.find(f=>f.id===id),m=C.decodeReference(C.FITS[f.k].asset),rect=document.querySelector('#cv').getBoundingClientRect();for(let i=0;i<m.idx.length;i+=57){const p=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++)p[k]+=m.pos[m.idx[i+j]*3+k]/3;const q=Y.view().project(C.referenceFitPoint(f,p));if(q[0]<rect.left+20||q[0]>rect.right-20||q[1]<rect.top+20||q[1]>rect.bottom-20)continue;if(Y.pick(q[0],q[1],{parts:true,fits:true})?.fit?.id===id)return q.slice(0,2);}return null;},row.id);
   assert.ok(pixel,'the actual mounted model must be pickable');await page.mouse.click(...pixel);await page.waitForFunction(id=>window.__yard.st.sel?.list==='fits'&&window.__yard.st.sel.id===id,row.id);nativeSelection.push({name:row.name,id:row.id,pixel,nativeCanvasClick:true});
  }
  fs.mkdirSync(imageRoot,{recursive:true});
  await page.evaluate(id=>{const Y=window.__yard,C=Y.C,f=Y.ship.fits.find(f=>f.id===id),b=C.fitAABB(f),v=Y.view();Y.st.sel={list:'fits',id};Y.renderPanel();v.cam.th=1.3;v.cam.ph=1.40;v.cam.r=63;v.cam.ortho=true;v.cam.target=C.add([(b[0]+b[3])/2,(b[1]+b[4])/2,(b[2]+b[5])/2],v.off);Y.draw();},measurements.rows[0].id);await drawNative(page);
  const nativeImage='triple70-mount-native-slope.png';await page.screenshot({path:path.join(imageRoot,nativeImage)});

  await page.setViewportSize({width:1440,height:950});
  await page.evaluate(()=>{
   const Y=window.__yard,C=Y.C,stage=document.createElement('section');stage.id='triple70-mount-stage';stage.style.cssText='position:fixed;inset:0;z-index:999999;overflow:hidden;background:#080d14;color:#e8eef5;font:18px system-ui';stage.innerHTML='<canvas style="display:block;width:100%;height:100%"></canvas><div id="triple70-mount-title" style="position:absolute;left:20px;top:16px;background:#101b2de8;border:1px solid #40536b;border-radius:6px;padding:9px 13px"></div><div id="triple70-mount-note" style="position:absolute;left:20px;bottom:14px;color:#b6c6d6;font:14px system-ui"></div><svg id="triple70-mount-markers" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none"></svg>';document.body.append(stage);
   const v=new Gfx.Renderer(stage.querySelector('canvas')),geometries={};v.off=[0,0,0];
   for(const record of window.__triple70MountQA.placements){
    const geometry=Gfx.fleetGeometry({...Y.ship,parts:Y.ship.parts.filter(p=>p.id===record.hostId),fits:Y.ship.fits.filter(f=>f.id===record.id)},{trial:true});geometries[record.name]=geometry;v.loadFleet(record.name+'-fixture',geometry);
    const isolated={...geometry,meshes:{}};for(const t of geometry.turrets)for(const name of [t.bodyMesh,t.mesh])isolated.meshes[name]=geometry.meshes[name];v.loadFleet(record.name+'-isolated',isolated);
   }
   window.__triple70MountRender={v,geometries,stage};
  });
  const views=[
   {id:'slope-side',name:'slope',theta:Math.PI/2,phi:1.42,elevation:0,title:'70 TT triple · connected front armor on a native sloped deck'},
   {id:'slope-iso',name:'slope',theta:.80,phi:1.05,elevation:0,title:'70 TT triple · integral case, bearing and front gun pod'},
   {id:'slope-25deg',name:'slope',theta:.80,phi:1.05,elevation:25,title:'70 TT triple · actual gun joint at +25°'},
   {id:'slope-55deg',name:'slope',theta:.80,phi:1.05,elevation:55,title:'70 TT triple · actual gun joint at +55°'},
   {id:'pedestal-top',name:'pedestal',theta:Math.PI/2,phi:.025,elevation:0,markers:true,title:'Manual base · center equals the midpoint of the widest case section'},
   {id:'pedestal-iso',name:'pedestal',theta:.80,phi:1.05,elevation:0,markers:true,title:'Manual base · actual mounting/yaw center beneath the widest section'}
  ],rendered=[];
  for(const view of views){
   const trace=await page.evaluate(view=>{
    const Y=window.__yard,C=Y.C,A=window.__triple70MountRender,v=A.v,record=window.__triple70MountQA.placements.find(r=>r.name===view.name),geometry=A.geometries[view.name],f=Y.ship.fits.find(f=>f.id===record.id),a=C.REFERENCE_ASSETS[C.FITS.triple70.asset],bounds=C.fitAABB(f),I=[1,0,0,0,1,0,0,0,1];
    const turrets=geometry.turrets.flatMap(t=>{const g=t.authored,p=C.aimAuthoredTurret(g,0,view.elevation*Math.PI/180);return [{mesh:t.bodyMesh,pivot:p.bodyPivot||p.yawPivot,restPivot:g.yawPivot,rot:p.bodyRotation||p.yawRotation},{mesh:t.mesh,pivot:p.elevationPivot,restPivot:g.elevationPivot,rot:p.rotation}];});
    v.cam.ortho=true;v.cam.th=view.theta;v.cam.ph=view.phi;v.cam.frame=null;v.cam.r=view.id.includes('top')?70:58;v.cam.target=[(bounds[0]+bounds[3])/2,(bounds[1]+bounds[4])/2,(bounds[2]+bounds[5])/2];
    const fleet=suffix=>[{key:view.name+'-'+suffix,pos:geometry.center.slice(),rot:I,glow:0,turrets}];
    v.draw({fleet:fleet('isolated'),noStars:true,lod:false});
    const pixels=new Uint8Array(v.canvas.width*v.canvas.height*4);v.gl.readPixels(0,0,v.canvas.width,v.canvas.height,v.gl.RGBA,v.gl.UNSIGNED_BYTE,pixels);let modelPixels=0;for(let i=0;i<pixels.length;i+=4)if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>70)modelPixels++;const minimumModelPixels=Math.max(2000,Math.round(v.canvas.width*v.canvas.height*.02));if(modelPixels<minimumModelPixels)throw Error(view.id+' has no meaningful model coverage: '+modelPixels);
    v.draw({fleet:fleet('fixture'),noStars:true,lod:false});
    A.stage.querySelector('#triple70-mount-title').textContent=view.title;
    A.stage.querySelector('#triple70-mount-note').textContent=view.markers?'QA markers: cyan = measured maximum-width line; orange ring = actual mount/yaw center. Native geometry and manual base are unchanged.':'Production renderer · native editable structure and real placed fitting · no generated support pedestal · unpowered geometry fixture';
    const svg=A.stage.querySelector('#triple70-mount-markers');svg.replaceChildren();
    const world=p=>C.referenceFitPoint(f,p.map((n,k)=>(n-a.c[k])/a.size[k])),native=window.__triple70MountQA.alignmentNative,ends=[world(native.left),world(native.right)],center=world(native.mid),origin=C.fitOrigin(f),project=p=>v.project(p).slice(0,2),line=ends.map(project),dot=project(origin);
    if(view.markers){const ns='http://www.w3.org/2000/svg',segment=document.createElementNS(ns,'line');segment.setAttribute('x1',line[0][0]);segment.setAttribute('y1',line[0][1]);segment.setAttribute('x2',line[1][0]);segment.setAttribute('y2',line[1][1]);segment.setAttribute('stroke','#61e7ec');segment.setAttribute('stroke-width','3');segment.setAttribute('stroke-dasharray','9 6');svg.append(segment);const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',dot[0]);ring.setAttribute('cy',dot[1]);ring.setAttribute('r','9');ring.setAttribute('fill','none');ring.setAttribute('stroke','#ffad47');ring.setAttribute('stroke-width','3');svg.append(ring);}
    return {id:view.id,name:view.name,requestedElevationDegrees:view.elevation,fixtureVisible:true,pedestalHeight:f.ped||0,assetYaw:f.assetYaw||0,camera:{theta:view.theta,phi:view.phi,orthographic:true},alignmentErrorM:C.len(C.sub(center,origin)),pixelCoverage:{modelPixels,minimumModelPixels,pixels:v.canvas.width*v.canvas.height,fraction:modelPixels/(v.canvas.width*v.canvas.height)},markers:view.markers?{source:'DOM QA overlay, not model geometry',linePixels:line,mountCenterPixel:dot}:null,webglError:v.gl.getError()};
   },view);
   assert.equal(trace.webglError,0);assert.ok(trace.alignmentErrorM<.003);const image='triple70-mount-'+view.id+'.png';await page.locator('#triple70-mount-stage').screenshot({path:path.join(imageRoot,image)});rendered.push({...trace,image});
  }
  assert.deepEqual(errors,[]);for(const [file,sha]of Object.entries(sources))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,file+' changed during verification');
  const result={schemaVersion:1,status:'PASS',date:new Date().toISOString(),sourceSha256:sources,url,readyMs,totalElapsedMs:Date.now()-started,fixture,measurements,nativeSelection,rendered,errors,screenshots:[nativeImage,...rendered.map(r=>r.image)],scope:{verified:['real native tilted plate and Core.placeFit placement','manual pedestal center and authored yaw pivot coincide with the actual widest-case midpoint','native canvas picking and click selection','case/front-pod appearance at source rest pose and +25/+55 degrees','actual production renderer with visible fixture surfaces','nonblank model-only WebGL coverage before any DOM labels or markers'],notVerified:['powered combat or sustained firing','physical device or GPU frame-rate target','all built-in example ships','automatic target tracking']}};
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,readyMs,totalElapsedMs:result.totalElapsedMs,screenshots:result.screenshots},null,2));await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
