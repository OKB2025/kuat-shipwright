const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),fit=k=>({id:1,k,p:[60,50,0],a:k==='quad70Side'?4:2,ped:0,base:0,low:0,float:false}),plainKeys=['pd','quad500'].filter(k=>C.REFERENCE_ASSETS[C.FITS[k].asset]?.plainMetal),familyKeys=C.TURRET_FAMILY_KEYS.filter(k=>C.REFERENCE_ASSETS[C.FITS[k].asset]?.plainMetal);
function metalUV(g,label){for(let i=0;i<g.n;i++){const u=g.uv[i*2],v=g.uv[i*2+1];assert.ok(Number.isFinite(u)&&Number.isFinite(v)&&u>=0&&u<.5&&v>=0&&v<=1,label+' must sample the metal half of the fittings atlas; the right half contains dark windows');}}

test('untextured fitting UVs stay in the metal atlas region without mutating source asset UVs',()=>{
 assert.deepEqual(plainKeys,['pd','quad500']);
 for(const k of plainKeys){const a=C.REFERENCE_ASSETS[C.FITS[k].asset],decoded=C.decodeReference(C.FITS[k].asset),raw=Array.from(decoded.uv),f=fit(k),mesh=G.meshFits({fits:[f]});assert.equal(mesh.ni,a.faces*3);metalUV(mesh,k);metalUV(G.meshFits({fits:[f]}),k+' cached');assert.deepEqual(Array.from(decoded.uv),raw,k+' source UVs remain immutable');}
});

test('plain turret partitions keep metal UVs and draw the full model once, including a wholly moving sphere',()=>{
 for(const k of plainKeys){const s=C.newShip({assembly:true,L:200,W:160,H:50},'Metal material partition');s.parts=[];s.fits=[fit(k)];s.detail=0;const geometry=G.fleetGeometry(s,{trial:true}),t=geometry.turrets[0];assert.ok(t.mesh,k);if(C.TURRET_FAMILY_KEYS.includes(k)||k==='quad500')assert.ok(t.authored,k);assert.equal(geometry.meshes.fits.geo.ni,0,k+' has no duplicate static full model');assert.equal(geometry.meshes.refFits.geo.ni,0,k+' has no duplicate reference full model');
  const body=geometry.meshes[t.bodyMesh]?.geo,moving=geometry.meshes[t.mesh].geo;assert.equal((body?.ni||0)+moving.ni,C.REFERENCE_ASSETS[C.FITS[k].asset].faces*3);if(body)metalUV(body,k+' body');metalUV(moving,k+' moving group');if(k==='quad40Ion')assert.equal(body.ni,0);
 }
});

test('original textured DBY and ISD assets retain their authored UVs',()=>{
 for(const k of ['refVen','oct40']){const a=C.REFERENCE_ASSETS[C.FITS[k].asset],decoded=C.decodeReference(C.FITS[k].asset),raw=Array.from(decoded.uv),mesh=G.meshReferenceFits({fits:[fit(k)]});assert.equal(a.plainMetal,false);assert.equal(mesh.ni,a.faces*3);assert.deepEqual(Array.from(mesh.uv.slice(0,mesh.n*2)),raw,k+' keeps its actual source atlas');assert.deepEqual(Array.from(decoded.uv),raw);}
});

test('textured static gunhouses and moving barrels receive the same reference material shading',()=>{
 for(const k of ['refVen','oct40',...familyKeys]){const s=C.newShip({assembly:true,L:200,W:160,H:50},'Reference material groups');s.parts=[];s.fits=[fit(k)];s.detail=0;const data=G.fleetGeometry(s,{trial:true}),t=data.turrets[0],values=[],r=Object.create(G.Renderer.prototype);
  Object.assign(r,{gl:new Proxy({},{get:(_t,key)=>key==='uniform1f'?(name,value)=>{if(name==='uReference')values.push(value);}:()=>{}}),meshes:{},pm:{p:{},u:new Proxy({},{get:(_t,key)=>key}),a:{aPos:0,aNor:1,aUv:2,aCol:3}},tex:new Proxy({},{get:()=>({a:{},e:{}})}),canvas:{width:100,height:100},cam:{fov:.72,r:100},off:[0,0,0],upload(name,geo){this.meshes[name]={count:geo.ni};}});
  r.meshes=r.loadFleet(k,data).meshes;if(k!=='quad40Ion')assert.ok(r.meshes[t.bodyMesh].count>0);assert.ok(r.meshes[t.mesh].count>0);r.drawMesh(t.bodyMesh,{VP:[],eye:[0,0,100]},1);r.drawMesh(t.mesh,{VP:[],eye:[0,0,100]},1);assert.deepEqual(values,k==='quad40Ion'?[1]:[1,1],k+' preserves the reference atlas color scale for every visible mechanical group');
 }
});

// A derivative keeps source machinery and newly modeled armor in the same
// reference-material draw path. The old fits atlas brightened all copied parts
// and stretched random panel rectangles into triangle-fan camouflage.
test('derived families preserve source machinery UVs and give generated armor one quiet source-paint sample',()=>{
 for(const k of familyKeys){const f=fit(k),a=C.REFERENCE_ASSETS[C.FITS[k].asset],d=C.decodeReference(C.FITS[k].asset),raw=Array.from(d.uv),g=G.meshReferenceFits({fits:[f]}),source=new Set();
  assert.equal(G.meshFits({fits:[f]}).ni,0,k+' has no duplicate generic fitting material');assert.equal(g.ni,a.faces*3);
  for(const p of a.components||[]){if(!p.sourceVertexIndices||p.sourceVertexIndices.length!==p.vertices)continue;const anchor=p.sourceAsset==='ven_turret'?'ven_turret70_native':'isd_heavy_octuple',tone=C.REFERENCE_TONE[anchor]||[1,1,1],color=tone.map(v=>Math.round(128*v));
   for(let i=p.firstVertex;i<p.firstVertex+p.vertices;i++){source.add(i);assert.equal(g.uv[i*2],d.uv[i*2],k+' source u');assert.equal(g.uv[i*2+1],d.uv[i*2+1],k+' source v');assert.deepEqual(Array.from(g.col.slice(i*4,i*4+3)),Array.from(color),k+' source color scale');}}
  assert.ok(source.size>0,k+' retains original mechanical material');const procedural=[];for(let i=0;i<g.n;i++)if(!source.has(i))procedural.push(i);assert.ok(procedural.length>0);const first=procedural[0],paint=[g.uv[first*2],g.uv[first*2+1]];
  const anchorKind=(a.materialReference==='ven_turret70_native'||!a.materialReference&&a.derivedFrom==='ven_turret')?'refVen':'oct40',anchorColor=Array.from(G.meshReferenceFits({fits:[fit(anchorKind)]}).col.slice(0,3));
  for(const i of procedural){assert.equal(g.uv[i*2],paint[0],k+' generated case has no triangle-fan u');assert.equal(g.uv[i*2+1],paint[1],k+' generated case has no triangle-fan v');assert.deepEqual(Array.from(g.col.slice(i*4,i*4+3)),anchorColor,k+' generated armor uses the existing anchor color scale');}
  assert.deepEqual(Array.from(d.uv),raw,k+' decoded source stays immutable');assert.ok([...g.col.slice(0,g.n*4)].filter((_,i)=>i%4!==3).every(v=>v<180),k+' uses reference half-color, not the brighter generic body color');
 }
});

test('derived family bodies and moving assemblies use one reference draw material without extra static copies',()=>{
 for(const k of familyKeys){const s=C.newShip({assembly:true,L:200,W:160,H:50},'Matched reference paint');s.parts=[];s.fits=[fit(k)];s.detail=0;const geometry=G.fleetGeometry(s,{trial:true}),t=geometry.turrets[0],body=geometry.meshes[t.bodyMesh],moving=geometry.meshes[t.mesh];
  assert.ok(t.mesh.startsWith('refTur_'));assert.ok(t.bodyMesh.startsWith('refTurBody_'));assert.equal(body.tex,'reference');assert.equal(moving.tex,'reference');assert.equal(geometry.meshes.fits.geo.ni,0);assert.equal(geometry.meshes.refFits.geo.ni,0);assert.equal(body.geo.ni+moving.geo.ni,C.REFERENCE_ASSETS[C.FITS[k].asset].faces*3);if(k==='quad40Ion')assert.equal(body.geo.ni,0);
 }
});

// Exercise the metadata contract without relying on vertex sharing: generated
// curved faces have duplicated vertices, and the dome cap needs a sharp rim.
test('only marked generated round houses receive radial normals and a hemisphere keeps its flat floor',()=>{
 for(const k of ['twin40Dome','quad40Ion']){
  const a=C.REFERENCE_ASSETS[C.FITS[k].asset],d=C.decodeReference(C.FITS[k].asset),part=a.components.find(p=>/spherical|hemispherical/.test(p.label)&&!p.sourceVertexIndices);assert.ok(part);assert.equal(part.normalMode,'sphere',k+' actual asset must retain its rounded-house normal metadata');assert.ok(Array.isArray(part.normalCenterM)&&part.normalCenterM.length===3&&part.normalCenterM.every(Number.isFinite));if(k==='twin40Dome')assert.ok(Number.isFinite(part.floorYM));
  const saved={normalMode:part.normalMode,normalCenterM:part.normalCenterM,floorYM:part.floorYM},centerM=saved.normalCenterM,floorYM=k==='twin40Dome'?saved.floorYM:undefined;
  try{for(const frame of [...Array.from({length:6},(_,a)=>({a})),{a:2,tilt:C.norm([.2,.95,.3])}]){
   const mount=frame.a;delete part.normalMode;const f={...fit(k),...frame,assetYaw:31,scale:1.3},before=G.meshReferenceFits({fits:[{...f}]}),c=centerM.map((v,j)=>(v-a.c[j])/a.size[j]),center=C.referenceFitPoint(f,c),up=C.norm(C.sub(C.referenceFitPoint(f,[c[0],c[1]+1/a.size[1],c[2]]),center));
   Object.assign(part,{normalMode:'sphere',normalCenterM:centerM,floorYM});const after=G.meshReferenceFits({fits:[{...f}]}),end=part.firstVertex+part.vertices;let floors=0,rounds=0;
   assert.deepEqual(Array.from(after.pos.slice(0,after.n*3)),Array.from(before.pos.slice(0,before.n*3)));assert.deepEqual(Array.from(after.idx.slice(0,after.ni)),Array.from(before.idx.slice(0,before.ni)));assert.deepEqual(Array.from(after.uv.slice(0,after.n*2)),Array.from(before.uv.slice(0,before.n*2)));assert.deepEqual(Array.from(after.col.slice(0,after.n*4)),Array.from(before.col.slice(0,before.n*4)));
   for(let i=0;i<after.n;i++){
    const old=Array.from(before.nor.slice(i*3,i*3+3)),now=Array.from(after.nor.slice(i*3,i*3+3));if(i<part.firstVertex||i>=end){assert.deepEqual(now,old,'unmarked source machinery and armor creases must stay unchanged');continue;}
    if(floorYM!=null&&Math.abs(d.pos[i*3+1]*a.size[1]+a.c[1]-floorYM)<.003&&C.dot(old,up)<-63.5){assert.deepEqual(now,old,'the lower cap remains flat');assert.ok(C.dot(C.norm(now),up)<-.999);floors++;continue;}
    const point=C.referenceFitPoint(f,Array.from(d.pos.slice(i*3,i*3+3))),radial=C.norm(C.sub(point,center));assert.ok(C.dot(C.norm(now),radial)>.9998,JSON.stringify({k,mount,i,old,now,radial,dot:C.dot(C.norm(now),radial),centerM}));rounds++;
   }
   assert.ok(rounds>100);if(k==='twin40Dome')assert.ok(floors>3);else assert.equal(floors,0);
  }}finally{for(const [name,value]of Object.entries(saved))if(value===undefined)delete part[name];else part[name]=value;}
 }
});
