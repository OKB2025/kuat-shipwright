const drawAsset=k=>G.turretRenderAsset(C.FITS[k]?.asset||k).asset;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),fit=k=>({id:1,k,p:[60,50,0],a:k==='quad70Side'?4:2,ped:0,base:0,low:0,float:false}),familyKeys=[...C.TURRET_FAMILY_KEYS,...C.LIGHT_TURRET_KEYS,...(C.CAPITAL_TURRET_KEYS||[])].filter(k=>C.REFERENCE_ASSETS[C.FITS[k].asset]?.plainMetal);
const paintUV=[.046142578125,.153564453125],paintColor=[143,150,155];
function sharedPaint(g,label){for(let i=0;i<g.n;i++){assert.deepEqual(Array.from(g.uv.slice(i*2,i*2+2)),paintUV,label+' uses the ISD roof paint');assert.deepEqual(Array.from(g.col.slice(i*4,i*4+4)),[...paintColor,255],label+' uses ISD reference color scaling');}}

test('the procedural craft turret shares the reference paint without adding a second body',()=>{
 assert.equal(C.FITS.cturret.asset,undefined,'this fixture uses the current procedural craft turret');const f=fit('cturret'),mesh=G.meshReferenceFits({fits:[f]});assert.equal(G.meshFits({fits:[f]}).ni,0);assert.ok(mesh.ni>0&&mesh.ni<3000);sharedPaint(mesh,'procedural craft turret');const cached=G.meshReferenceFits({fits:[f]});sharedPaint(cached,'cached procedural craft turret');assert.deepEqual(Array.from(cached.uv.slice(0,cached.n*2)),Array.from(mesh.uv.slice(0,mesh.n*2)));
});

test('original ISD UVs stay unchanged while the DBY draw copy receives ISD paint',()=>{
 for(const k of ['refVen','oct40']){const a=C.REFERENCE_ASSETS[C.FITS[k].asset],decoded=C.decodeReference(C.FITS[k].asset),raw=Array.from(decoded.uv),mesh=G.meshReferenceFits({fits:[fit(k)]});assert.equal(a.plainMetal,false);assert.equal(mesh.ni,drawAsset(k).faces*3);if(k==='oct40')assert.deepEqual(Array.from(mesh.uv.slice(0,mesh.n*2)),raw,k+' keeps its actual source atlas');else sharedPaint(mesh,k);assert.deepEqual(Array.from(decoded.uv),raw,k+' keeps immutable decoded source UVs');}
});

test('textured static gunhouses and moving barrels receive the same reference material shading',()=>{
 for(const k of ['refVen','oct40',...familyKeys]){const s=C.newShip({assembly:true,L:200,W:160,H:50},'Reference material groups');s.parts=[];s.fits=[fit(k)];s.detail=0;const data=G.fleetGeometry(s,{trial:true}),t=data.turrets[0],values=[],r=Object.create(G.Renderer.prototype);
  Object.assign(r,{gl:new Proxy({},{get:(_t,key)=>key==='uniform1f'?(name,value)=>{if(name==='uReference')values.push(value);}:()=>{}}),meshes:{},pm:{p:{},u:new Proxy({},{get:(_t,key)=>key}),a:{aPos:0,aNor:1,aUv:2,aCol:3}},tex:new Proxy({},{get:()=>({a:{},e:{}})}),canvas:{width:100,height:100},cam:{fov:.72,r:100},off:[0,0,0],upload(name,geo){this.meshes[name]={count:geo.ni};}});
  r.meshes=r.loadFleet(k,data).meshes;if(C.REFERENCE_ASSETS[C.FITS[k].asset].elevationIndexStart>0)assert.ok(r.meshes[t.bodyMesh].count>0);assert.ok(r.meshes[t.mesh].count>0);r.drawMesh(t.bodyMesh,{VP:[],eye:[0,0,100]},1);r.drawMesh(t.mesh,{VP:[],eye:[0,0,100]},1);assert.deepEqual(values,C.REFERENCE_ASSETS[C.FITS[k].asset].elevationIndexStart>0?[1,1]:[1],k+' preserves the reference atlas color scale for every visible mechanical group');
 }
});

// Paint is chosen by the renderer, including source machinery and generated
// armor. Archive UVs remain available for geometry edits and future materials.
test('every derived family draw copy uses the same ISD paint and preserves archived UVs',()=>{
 for(const k of familyKeys){const f=fit(k),a=C.REFERENCE_ASSETS[C.FITS[k].asset],d=C.decodeReference(C.FITS[k].asset),raw=Array.from(d.uv),g=G.meshReferenceFits({fits:[f]});
  assert.equal(G.meshFits({fits:[f]}).ni,0,k+' has no duplicate generic fitting material');assert.equal(g.ni,drawAsset(k).faces*3);sharedPaint(g,k);assert.deepEqual(Array.from(d.uv),raw,k+' decoded source stays immutable');
 }
});

test('derived family bodies and moving assemblies use one reference draw material without extra static copies',()=>{
 for(const k of familyKeys){const s=C.newShip({assembly:true,L:200,W:160,H:50},'Matched reference paint');s.parts=[];s.fits=[fit(k)];s.detail=0;const geometry=G.fleetGeometry(s,{trial:true}),t=geometry.turrets[0],body=geometry.meshes[t.bodyMesh],moving=geometry.meshes[t.mesh];
  assert.ok(t.mesh.startsWith('refTur_'));assert.ok(t.bodyMesh.startsWith('refTurBody_'));assert.equal(body.tex,'reference');assert.equal(moving.tex,'reference');assert.equal(geometry.meshes.fits.geo.ni,0);assert.equal(geometry.meshes.refFits.geo.ni,0);assert.equal(body.geo.ni+moving.geo.ni,drawAsset(k).faces*3);if(['quad40Ion','single500'].includes(k))assert.equal(body.geo.ni,0);
 }
});

// Exercise the metadata contract without relying on vertex sharing: generated
// curved faces have duplicated vertices, and the dome cap needs a sharp rim.
test('only marked generated round houses receive radial normals and a hemisphere keeps its flat floor',()=>{
 for(const k of ['twin40Dome','quad40Ion','single500']){
  const a=C.REFERENCE_ASSETS[C.FITS[k].asset],d=C.decodeReference(C.FITS[k].asset),part=a.components.find(p=>/spherical|hemispherical/.test(p.label)&&!p.sourceVertexIndices);assert.ok(part);assert.equal(part.normalMode,'sphere',k+' actual asset must retain its rounded-house normal metadata');assert.ok(Array.isArray(part.normalCenterM)&&part.normalCenterM.length===3&&part.normalCenterM.every(Number.isFinite));if(k==='twin40Dome')assert.ok(Number.isFinite(part.floorYM));
  const draw=G.turretRenderAsset(C.FITS[k].asset),drawPart=draw.asset.components.find(r=>r.label===part.label);assert.ok(drawPart);const saved={normalMode:drawPart.normalMode,normalCenterM:drawPart.normalCenterM,floorYM:drawPart.floorYM},centerM=saved.normalCenterM,floorYM=k==='twin40Dome'?saved.floorYM:undefined;
  try{for(const frame of [...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.95,.3])}]){
   const mount=frame.a;delete drawPart.normalMode;const f={...fit(k),...frame,assetYaw:31,scale:1.3},before=G.meshReferenceFits({fits:[{...f}]}),c=centerM.map((v,j)=>(v-a.c[j])/a.size[j]),center=C.referenceFitPoint(f,c),up=C.norm(C.sub(C.referenceFitPoint(f,[c[0],c[1]+1/a.size[1],c[2]]),center));
   Object.assign(drawPart,{normalMode:'sphere',normalCenterM:centerM,floorYM});const after=G.meshReferenceFits({fits:[{...f}]}),end=drawPart.firstVertex+drawPart.vertices;let floors=0,rounds=0;
   assert.deepEqual(Array.from(after.pos.slice(0,after.n*3)),Array.from(before.pos.slice(0,before.n*3)));assert.deepEqual(Array.from(after.idx.slice(0,after.ni)),Array.from(before.idx.slice(0,before.ni)));assert.deepEqual(Array.from(after.uv.slice(0,after.n*2)),Array.from(before.uv.slice(0,before.n*2)));assert.deepEqual(Array.from(after.col.slice(0,after.n*4)),Array.from(before.col.slice(0,before.n*4)));
   for(let i=0;i<after.n;i++){
    const old=Array.from(before.nor.slice(i*3,i*3+3)),now=Array.from(after.nor.slice(i*3,i*3+3));if(i<drawPart.firstVertex||i>=end){assert.deepEqual(now,old,'unmarked source machinery and armor creases must stay unchanged');continue;}
    if(floorYM!=null&&Math.abs(draw.mesh.pos[i*3+1]*a.size[1]+a.c[1]-floorYM)<.003&&C.dot(old,up)<-63.5){assert.deepEqual(now,old,'the lower cap remains flat');assert.ok(C.dot(C.norm(now),up)<-.999);floors++;continue;}
    const point=C.referenceFitPoint(f,Array.from(draw.mesh.pos.slice(i*3,i*3+3))),radial=C.norm(C.sub(point,center));assert.ok(C.dot(C.norm(now),radial)>.9998,JSON.stringify({k,mount,i,old,now,radial,dot:C.dot(C.norm(now),radial),centerM}));rounds++;
   }
   assert.ok(rounds>100);if(k==='twin40Dome')assert.ok(floors>3);else assert.equal(floors,0);
  }}finally{for(const [name,value]of Object.entries(saved))if(value===undefined)delete drawPart[name];else drawPart[name]=value;}
 }
});
