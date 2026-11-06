const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..'));
function runtime(){const cx=vm.createContext({console});for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});return vm.runInContext('({C:Core,G:Gfx})',cx);}
function active(g,field){return Array.from(g[field].subarray(0,field==='idx'?g.ni:g.n*({pos:3,nor:3,uv:2,col:4}[field])));}
function prefix(actual,before){for(const field of ['pos','nor','uv','col','idx'])assert.deepEqual(active(actual,field).slice(0,active(before,field).length),active(before,field),field+' retains the unchanged draft');}
const fit=(id,k,x)=>({id,k,p:[x,30,0],a:2,n:[0,1,0],base:0,low:0,ped:0,float:false});

test('a cold missed ray over the actual535 Mandator fittings never constructs their visible meshes',()=>{
 const {C,G}=runtime(),raw=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'assets/source/ship-example-blueprints/mandator2.json.gz')))),ship=C.deserialize(raw);
 let decoded=0,bounds=0;const decode=C.decodeReference,box=C.fitAABB;C.decodeReference=(...a)=>{decoded++;return decode(...a);};C.fitAABB=(...a)=>{bounds++;return box(...a);};
 const origin=[-10000,5000,4000],direction=[-1,0,0];for(const f of ship.fits)assert.equal(G.rayFit(origin,direction,f),null);
 assert.equal(ship.fits.length,535);assert.equal(decoded,0,'a miss is rejected before reference mesh decoding or triangulation');assert.equal(bounds,535);
 for(const f of ship.fits)assert.equal(G.rayFit(origin,direction,f),null);assert.equal(bounds,535,'unchanged fittings reuse their conservative bounds');
 ship.fits[0].p[0]+=50;assert.equal(G.rayFit(origin,direction,ship.fits[0]),null);assert.equal(bounds,536,'a moved fitting invalidates its own bounds');assert.equal(decoded,0);
});

test('adding a gun keeps existing preview geometry without rebuilding unchanged parts or turrets',()=>{
 const {C,G}=runtime(),ship=C.newShip({L:300,W:120,H:60,assembly:true});ship.parts=[{id:1,k:'struct',form:'box',c:[150,20,0],s:[250,100,20]}];ship.fits=[fit(2,'utl',100)];
 const partCalls=[],fitCalls=[],tri=C.structTriangles,point=C.referenceFitPoint;C.structTriangles=p=>{partCalls.push(p.id);return tri(p);};C.referenceFitPoint=(f,p)=>{fitCalls.push(f.id);return point(f,p);};
 const first=G.meshPreview(ship,ship.parts,ship.fits);assert.ok(first.preview.ni>0&&first.previewRefFits.ni>0);partCalls.length=fitCalls.length=0;
 ship.fits.push(fit(3,'pd',220));const added=G.meshPreview(ship,ship.parts,ship.fits);assert.deepEqual(partCalls,[],'the unchanged hull is not triangulated per gun');assert.ok(!fitCalls.includes(2),'the existing heavy turret is not transformed per gun');assert.ok(fitCalls.includes(3));
 for(const name of ['preview','previewRef','previewFits','previewRefFits'])prefix(added[name],first[name]);assert.ok(added.previewRefFits.ni>first.previewRefFits.ni);
 ship.parts[0]._packing={tris:new Float32Array([999,999,999])};partCalls.length=fitCalls.length=0;const workerCache=G.meshPreview(ship,ship.parts,ship.fits);assert.deepEqual(partCalls,[]);assert.deepEqual(fitCalls,[]);assert.deepEqual(active(workerCache.preview,'pos'),active(added.preview,'pos'),'derived worker caches do not change the authored preview');
});

test('the same cleared authored hull proxy is used for preview geometry and subsequent picking',()=>{
 const {C,G}=runtime(),ship=C.newShip({L:180,W:80,H:30}),owner=C.ensurePrimaryHull(ship),proxy={...owner,_packing:undefined,_clip:undefined,_solidCutShip:undefined,_apertures:undefined,_pierced:undefined};let wrongProxy=false;const tri=C.structTriangles;C.structTriangles=p=>{if(p.id===owner.id&&p!==proxy)wrongProxy=true;return tri(p);};
 const resolve=p=>p===owner?proxy:p;const first=G.meshPreview(ship,[owner],[],{requestedPart:resolve});assert.ok(first.preview.ni>0);assert.equal(wrongProxy,false,'the renderer must not replace the stable picking proxy with another clone');assert.ok(proxy._hullShip);
 const local=proxy._hullShip;assert.ok(C.rayPart([90,100,0],[0,-1,0],proxy));assert.equal(proxy._hullShip,local,'picking reuses the already warmed local hull');
 owner.c[0]+=20;proxy.c=owner.c;const moved=G.meshPreview(ship,[owner],[],{requestedPart:resolve});assert.ok(Math.max(...active(moved.preview,'pos').filter((_,i)=>i%3===0))>Math.max(...active(first.preview,'pos').filter((_,i)=>i%3===0))+19);
});

test('preview caches follow moves, deletion, restoration and private aircraft-store changes',()=>{
 const {C,G}=runtime(),ship=C.newShip({L:300,W:120,H:60,assembly:true});ship.parts=[];const f=fit(1,'pd',100);ship.fits=[f];const original=G.meshPreview(ship,[],[f]);
 f.p[0]+=25;const moved=G.meshPreview(ship,[],[f]);assert.notDeepEqual(active(original.previewRefFits,'pos'),active(moved.previewRefFits,'pos'));ship.fits=[];const deleted=G.meshPreview(ship,[],[]);assert.equal(deleted.previewRefFits.ni,0);
 f.p[0]-=25;ship.fits=[f];const restored=G.meshPreview(ship,[],[f]);assert.deepEqual(active(restored.previewRefFits,'pos'),active(original.previewRefFits,'pos'));
 const pylon=fit(2,'cpylon',50),spec=C.fitSpec(pylon),store=Object.keys(C.ORDNANCE).find(k=>C.storeCapacity(spec.store,k)>=2);assert.ok(store);ship.fits=[pylon];pylon._store={k:store,n:1};const one=G.meshPreview(ship,[],[pylon]);pylon._store.n=2;const two=G.meshPreview(ship,[],[pylon]);assert.ok(two.previewFits.ni>one.previewFits.ni,'a private payload change must update the visible stores');
});

test('conservative cold bounds retain exact barrel, pedestal, pod and angled launcher picking through pose edits',()=>{
 const {C,G}=runtime(),kinds=['utl','quad500','pd','monCal150Ion','venSide70','shipMsl','podCombat'],keys=kinds.filter(k=>C.FITS[k]);assert.ok(keys.length>=6);
 const triangles=f=>{const ship={parts:[],fits:[f],hatches:[]},meshes=[G.meshFits(ship,null,null,[f]),G.meshReferenceFits(ship,null,[f])],out=[];for(const g of meshes)for(let i=0;i<g.ni;i++)for(let a=0;a<3;a++)out.push(g.pos[g.idx[i]*3+a]);return out;};
 const check=f=>{const T=triangles(f);assert.ok(T.length,f.k+' has rendered geometry');const picks=[0,Math.max(0,T.length-9)];let max=-Infinity,maxIndex=0;for(let i=0;i<T.length;i+=9){const x=(T[i]+T[i+3]+T[i+6])/3;if(x>max){max=x;maxIndex=i;}}picks.push(maxIndex);
  for(const i of picks){const a=T.slice(i,i+3),b=T.slice(i+3,i+6),c=T.slice(i+6,i+9),normal=C.norm(C.cross(C.sub(b,a),C.sub(c,a)));if(C.len(normal)<.9)continue;const center=C.mul(C.add(C.add(a,b),c),1/3);
   for(const distance of [.01,25]){const origin=C.add(center,C.mul(normal,distance)),direction=C.mul(normal,-1),expected=C.rayTris(T,origin,direction);if(!expected)continue;const hit=G.rayFit(origin,direction,f);assert.ok(hit,f.k+' real visible geometry survived the broadphase');assert.ok(Math.abs(hit.t-expected.t)<1e-5,f.k+' exact triangle distance');}
  }
 };
 for(const [i,k]of keys.entries()){const f={...fit(i+1,k,100+i*500),assetYaw:37,assetPitch:24,ped:90,pedSize:5,pedShape:'trap',tilt:C.norm([.2,1,.3]),...(k==='shipMsl'?{launcherRows:3,launcherCols:5,launchPitch:53,launchYaw:27,launcherEmbedded:true}:{}),...(C.FITS[k].window?{width:120,height:55}:{} )};if(C.FITS[k].wallOnly||C.FITS[k].casemate){f.a=5;f.n=f.tilt=[0,0,-1];f.ped=0;}check(f);f.p[0]+=1100;f.assetYaw=-63;check(f);}
});

function gpu(G){
 const buffers=new Map(),bindings=new Map(),calls=[];let next=0;const gl={ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,DYNAMIC_DRAW:3,STATIC_DRAW:4,UNSIGNED_INT:5,UNSIGNED_SHORT:6,createBuffer(){return ++next;},bindBuffer(kind,id){bindings.set(kind,id);},bufferData(kind,value){const bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);buffers.set(bindings.get(kind),bytes.slice());calls.push({kind:'full',bytes:bytes.length});},bufferSubData(kind,offset,value){const bytes=new Uint8Array(value.buffer,value.byteOffset,value.byteLength),target=buffers.get(bindings.get(kind));assert.ok(offset+bytes.length<=target.length,'dirty upload remains within allocated GPU capacity');target.set(bytes,offset);calls.push({kind:'partial',bytes:bytes.length});}};
 const view={gl,u32:true,meshes:{}},upload=g=>G.Renderer.prototype.upload.call(view,'previewRefFits',g);return{view,upload,calls,buffers};
}
function gpuMatches(renderer,g){const m=renderer.view.meshes.previewRefFits;for(const [key,width]of [['pos',3],['nor',3],['uv',2],['col',4],['idx',1]]){const count=key==='idx'?g.ni:g.n*width,source=g[key].subarray(0,count),actual=renderer.buffers.get(m[key]).subarray(0,source.byteLength);assert.deepEqual(Array.from(actual),Array.from(new Uint8Array(source.buffer,source.byteOffset,source.byteLength)),key+' GPU values match requested geometry');}}

test('incremental previews reuse blocks for30moves and upload only dirty ranges for each view',()=>{
 const {C,G}=runtime(),ship=C.newShip({L:600,W:200,H:80,assembly:true});ship.parts=[];ship.fits=Array.from({length:40},(_,i)=>fit(i+1,'pd',i*12));const first=G.meshPreview(ship,[],ship.fits,{incremental:true}).previewRefFits,primary=gpu(G),secondary=gpu(G);primary.upload(first);secondary.upload(first);const n=first.n,ni=first.ni,full=primary.calls.filter(c=>c.kind==='full').length;
 for(let i=0;i<30;i++){ship.fits[0].p[0]+=1;const moved=G.meshPreview(ship,[],ship.fits,{incremental:true}).previewRefFits;assert.equal(moved,first);assert.equal(moved.n,n,'dragging does not append obsolete vertices');assert.equal(moved.ni,ni,'dragging does not append obsolete triangles');primary.upload(moved);}
 assert.equal(primary.calls.filter(c=>c.kind==='full').length,full,'unchanged capacities use bufferSubData');assert.ok(primary.calls.some(c=>c.kind==='partial'));gpuMatches(primary,first);
 secondary.upload(first);assert.equal(secondary.calls.filter(c=>c.kind==='full').length,10,'a view that missed revisions receives a full current snapshot');gpuMatches(secondary,first);
 primary.view.meshes.previewRefFits.count=0;primary.upload(first);assert.equal(primary.view.meshes.previewRefFits.count,first.ni,'a cleared overlay can be shown again even when its cached geometry did not change');
});

test('shrinking a full draft to one edited fitting compacts its overlay and compat hides removed geometry',()=>{
 const {C,G}=runtime(),ship=C.newShip({L:600,W:200,H:80,assembly:true});ship.parts=[];ship.fits=Array.from({length:40},(_,i)=>fit(i+1,'pd',i*12));const all=G.meshPreview(ship,[],ship.fits,{incremental:true}),one=G.meshPreview(ship,[],[ship.fits[0]],{incremental:true});assert.notEqual(one.previewRefFits,all.previewRefFits);assert.ok(one.previewRefFits.n<all.previewRefFits.n/10,'the tiny overlay does not retain the full draft vertex buffer');
 const compat={meshes:{}};G.CompatRenderer.prototype.upload.call(compat,'previewRefFits',one.previewRefFits);assert.ok(compat.meshes.previewRefFits.count>0);const removed=G.meshPreview(ship,[],[],{incremental:true});G.CompatRenderer.prototype.upload.call(compat,'previewRefFits',removed.previewRefFits);assert.equal(compat.meshes.previewRefFits.count,0,'deleted source geometry is not drawn by the fallback renderer');
 const restored=G.meshPreview(ship,[],[ship.fits[0]],{incremental:true});G.CompatRenderer.prototype.upload.call(compat,'previewRefFits',restored.previewRefFits);assert.ok(compat.meshes.previewRefFits.count>0);G.clearPreviewCache(ship);const reset=G.meshPreview(ship,[],[ship.fits[0]],{incremental:true});assert.notEqual(reset.previewRefFits,restored.previewRefFits,'a completed worker generation releases the old preview buffers');
});

test('progressive draft filling yields between chunks and pauses background work for immediate new edits',()=>{
 const {C,G}=runtime(),ship=C.newShip({L:300,W:120,H:60,assembly:true});ship.parts=Array.from({length:12},(_,i)=>({id:i+1,k:'struct',form:'box',c:[i*20,10,0],s:[10,10,10]}));ship.fits=Array.from({length:10},(_,i)=>fit(100+i,'pd',i*20));let triangles=0;const tri=C.structTriangles;C.structTriangles=(...a)=>{triangles++;return tri(...a);};
 const options={incremental:true,progressive:true,revision:1,budgetMs:0,priorityParts:ship.parts,priorityFits:ship.fits};const initial=G.meshPreview(ship,ship.parts,ship.fits,options);assert.equal(initial.pending,true);assert.equal(triangles,1,'the initial bulk list is not treated as hundreds of urgent edits');
 const paused=G.meshPreview(ship,ship.parts,ship.fits,{...options,priorityParts:[],priorityFits:[],deferBackground:true});assert.equal(paused.pending,true);assert.equal(triangles,1,'camera input pauses bulk triangulation');
 const selected=G.meshPreview(ship,ship.parts,ship.fits,{...options,priorityParts:[],priorityFits:[ship.fits[9]],deferBackground:true});assert.ok(selected.previewRefFits.ni>0,'the newly requested gun is drawn before the existing draft backlog');assert.equal(triangles,1);
 let result=selected,frames=0;while(result.pending&&frames++<30)result=G.meshPreview(ship,ship.parts,ship.fits,{...options,priorityParts:[],priorityFits:[]});assert.equal(result.pending,false);assert.ok(frames>1);assert.equal(triangles,12);assert.ok(result.preview.ni>initial.preview.ni||result.preview===initial.preview,'completed partial batches remain in the visible draft');
});

test('a cold owned hull and its dependent engine wait for worker authoring geometry while other draft items remain usable',()=>{
 const {C,G}=runtime(),ship=C.newShip({L:180,W:80,H:30}),owner=C.ensurePrimaryHull(ship),box={id:ship.nextId++,k:'struct',form:'box',c:[140,45,0],s:[20,20,10]},engine={id:ship.nextId++,k:'engine',c:[-10,15,0],d:5,dir:[-1,0,0]};ship.parts.push(box,engine);ship.fits=[fit(ship.nextId++,'pd',140)];
 const cachedHull=C.structTriangles(owner),struct=C.structTriangles,hull=C.hullStructureGeometry,vented=C.engineVented;let ready=false,hullCalls=0,engineCalls=0;
 C.structTriangles=p=>{if(p.id===owner.id){assert.equal(ready,true,'the main thread must not compile the cold owned hull');hullCalls++;return cachedHull;}return struct(p);};
 C.hullStructureGeometry=(...args)=>{assert.equal(ready,true,'even preview reference checks must wait for worker caches');return hull(...args);};C.engineVented=(...args)=>{assert.equal(ready,true,'dependent engine checks must not start cold hull geometry');engineCalls++;return vented(...args);};
 const options={incremental:true,progressive:true,revision:1,budgetMs:1000,requestedPart:p=>p,canMeshPart:p=>ready||p.id!==owner.id&&p.k!=='engine'};
 const waiting=G.meshPreview(ship,ship.parts,ship.fits,options);assert.equal(waiting.pending,true);assert.equal(hullCalls,0);assert.equal(engineCalls,0);assert.ok(waiting.preview.ni>0&&waiting.previewRefFits.ni>0,'other exact structures and guns render before the hull packet');
 const unchanged=G.meshPreview(ship,ship.parts,ship.fits,{...options,priorityParts:[owner],deferBackground:true});assert.equal(unchanged.pending,true);assert.equal(hullCalls,0,'an urgent selection cannot force cold hull compilation');
 ready=true;const resumed=G.meshPreview(ship,ship.parts,ship.fits,options);assert.equal(resumed.pending,false,'the same draft generation resumes as soon as exact authoring caches arrive');assert.ok(hullCalls>0&&engineCalls>0);assert.equal(ship.parts[0],owner);
});
