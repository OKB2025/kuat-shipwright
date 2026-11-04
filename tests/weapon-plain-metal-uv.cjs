const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.resolve(process.env.KS_TEST_ROOT||path.join(__dirname,'..')),cx=vm.createContext({console});
for(const file of ['data/reference.js','data/imperial2.js','data/fleet.js','js/core.js','js/gfx.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),cx,{filename:file});
const {C,G}=vm.runInContext('({C:Core,G:Gfx})',cx),fit=k=>({id:1,k,p:[60,50,0],a:k==='quad70Side'?4:2,ped:0,base:0,low:0,float:false}),plainKeys=[...C.TURRET_FAMILY_KEYS,'pd','quad500'].filter(k=>C.REFERENCE_ASSETS[C.FITS[k].asset]?.plainMetal);
function metalUV(g,label){for(let i=0;i<g.n;i++){const u=g.uv[i*2],v=g.uv[i*2+1];assert.ok(Number.isFinite(u)&&Number.isFinite(v)&&u>=0&&u<.5&&v>=0&&v<=1,label+' must sample the metal half of the fittings atlas; the right half contains dark windows');}}

test('untextured fitting UVs stay in the metal atlas region without mutating source asset UVs',()=>{
 assert.ok(plainKeys.includes('quad40Ion'));
 for(const k of plainKeys){const a=C.REFERENCE_ASSETS[C.FITS[k].asset],decoded=C.decodeReference(C.FITS[k].asset),raw=Array.from(decoded.uv),f=fit(k),mesh=G.meshFits({fits:[f]});assert.equal(mesh.ni,a.faces*3);metalUV(mesh,k);metalUV(G.meshFits({fits:[f]}),k+' cached');assert.deepEqual(Array.from(decoded.uv),raw,k+' source UVs remain immutable');}
 const ion=C.decodeReference(C.FITS.quad40Ion.asset);assert.ok(Array.from(ion.uv).some((v,i)=>i%2===0&&v>=.5),'the sphere’s raw per-triangle UVs reproduce the original full-atlas/window sampling risk');
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
 for(const k of ['refVen','oct40']){const s=C.newShip({assembly:true,L:200,W:160,H:50},'Reference material groups');s.parts=[];s.fits=[fit(k)];s.detail=0;const data=G.fleetGeometry(s,{trial:true}),t=data.turrets[0],values=[],r=Object.create(G.Renderer.prototype);
  Object.assign(r,{gl:new Proxy({},{get:(_t,key)=>key==='uniform1f'?(name,value)=>{if(name==='uReference')values.push(value);}:()=>{}}),meshes:{},pm:{p:{},u:new Proxy({},{get:(_t,key)=>key}),a:{aPos:0,aNor:1,aUv:2,aCol:3}},tex:new Proxy({},{get:()=>({a:{},e:{}})}),canvas:{width:100,height:100},cam:{fov:.72,r:100},off:[0,0,0],upload(name,geo){this.meshes[name]={count:geo.ni};}});
  r.meshes=r.loadFleet(k,data).meshes;assert.ok(r.meshes[t.bodyMesh].count>0);assert.ok(r.meshes[t.mesh].count>0);r.drawMesh(t.bodyMesh,{VP:[],eye:[0,0,100]},1);r.drawMesh(t.mesh,{VP:[],eye:[0,0,100]},1);assert.deepEqual(values,[1,1],k+' preserves the reference atlas color scale for both mechanical groups');
 }
});
